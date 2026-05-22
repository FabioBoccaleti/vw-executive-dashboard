import { Fragment, useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, Trash2, Printer, AlertCircle } from 'lucide-react';
import {
  loadLancamentos,
  deleteLancamento,
} from './comissoesLancamentosStorage';
import type { LancamentosMap, LinhaComissao, CampoAssinaturaComissao, AssinaturaDigital } from './comissoesLancamentosStorage';
import { kvGet } from '@/lib/kvClient';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const AVAILABLE_YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const sumLinhas = (linhas: Record<string, LinhaComissao>): number =>
  Object.values(linhas).reduce((s, l) => s + l.comVenda + l.comLB, 0);

/** Corrige nomes com caracteres corrompidos no KV. */
const NAME_FIXES: Record<string, string> = {
  'CARLOS JOS\uFFFD BARGIERI':            'CARLOS JOSE BARGIERI',
  'CARLOS JOS\u00C3\u00B3 BARGIERI':      'CARLOS JOSE BARGIERI',
  'CESAR LUIZ GARCIA LOUREN\uFFFDO':      'CESAR LUIZ GARCIA LOURENCO',
  'CESAR LUIZ GARCIA LOUREN\u00C3\u0087O':'CESAR LUIZ GARCIA LOURENCO',
  'LUCIMEIRE DA CONCEI\uFFFD\uFFFDO SANTOS':           'LUCIMEIRE DA CONCEICAO SANTOS',
  'LUCIMEIRE DA CONCEI\u00C3\u00A7\u00C3\u00A3O SANTOS':'LUCIMEIRE DA CONCEICAO SANTOS',
};
const fixName = (name: string): string => NAME_FIXES[name] ?? name;

// ─── Constantes ──────────────────────────────────────────────────────────────

const CAMPOS: CampoAssinaturaComissao[] = ['financeiro', 'gerenciaComercial', 'diretoriaComercial', 'diretoria'];
const CAMPO_ABBREV: Record<CampoAssinaturaComissao, string> = {
  financeiro:         'Fin',
  gerenciaComercial:  'G.Com',
  diretoriaComercial: 'D.Com',
  diretoria:          'Dir',
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RowData {
  vendedor:    string;
  novos:       number | null;   // null = sem lançamento nessa aba
  usados:      number | null;
  total:       number;
  novosPago:   boolean | undefined;
  usadosPago:  boolean | undefined;
  novosLinhas:  Record<string, LinhaComissao>;
  usadosLinhas: Record<string, LinhaComissao>;
  novosAssinaturas:  Partial<Record<CampoAssinaturaComissao, AssinaturaDigital>> | undefined;
  usadosAssinaturas: Partial<Record<CampoAssinaturaComissao, AssinaturaDigital>> | undefined;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function ComissoesResumoView() {
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [novosMap,      setNovosMap]      = useState<LancamentosMap>({});
  const [usadosMap,     setUsadosMap]     = useState<LancamentosMap>({});
  const [inativosNovos, setInativosNovos] = useState<Set<string>>(new Set());
  const [inativosUsados,setInativosUsados]= useState<Set<string>>(new Set());

  const [expanded,       setExpanded]       = useState<Set<string>>(new Set());
  const [deleteTarget,   setDeleteTarget]   = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError,    setDeleteError]    = useState('');
  const [loading,        setLoading]        = useState(false);

  // ── Carregamento de dados ────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      loadLancamentos('novos'),
      loadLancamentos('usados'),
      kvGet<string[]>('comissoes:inativos:novos'),
      kvGet<string[]>('comissoes:inativos:usados'),
    ]).then(([n, u, inN, inU]) => {
      setNovosMap(n);
      setUsadosMap(u);
      setInativosNovos(new Set(inN ?? []));
      setInativosUsados(new Set(inU ?? []));

      // Auto-seleciona o último mês que tenha pelo menos um lançamento
      const keysComDados = new Set([
        ...Object.entries(n).filter(([, v]) => Object.keys(v).length > 0).map(([k]) => k),
        ...Object.entries(u).filter(([, v]) => Object.keys(v).length > 0).map(([k]) => k),
      ]);
      const validKeys = [...keysComDados].filter(k => /^\d{4}-\d{1,2}$/.test(k));
      if (validKeys.length > 0) {
        const latestKey = validKeys.sort((a, b) => {
          const [ay, am] = a.split('-').map(Number);
          const [by, bm] = b.split('-').map(Number);
          return (by * 12 + bm) - (ay * 12 + am);
        })[0];
        const [ly, lm] = latestKey.split('-').map(Number);
        setYear(ly);
        setMonth(lm);
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Linhas computadas ────────────────────────────────────────────────────
  const rows = useMemo<RowData[]>(() => {
    const pk              = `${year}-${month}`;
    const novosForPeriod  = novosMap[pk]  ?? {};
    const usadosForPeriod = usadosMap[pk] ?? {};
    const allVendedores   = new Set([
      ...Object.keys(novosForPeriod),
      ...Object.keys(usadosForPeriod),
    ]);

    const result: RowData[] = [];

    for (const vendedor of allVendedores) {
      const novosLanc  = novosForPeriod[vendedor];
      const usadosLanc = usadosForPeriod[vendedor];
      const isInativoN = inativosNovos.has(vendedor);
      const isInativoU = inativosUsados.has(vendedor);

      // Ocultar se inativo em todos os tabs onde tem dados
      const hasNovos  = !!novosLanc  && !isInativoN;
      const hasUsados = !!usadosLanc && !isInativoU;
      if (!hasNovos && !hasUsados) continue;

      const novosVal  = hasNovos  ? sumLinhas(novosLanc!.linhas)  : null;
      const usadosVal = hasUsados ? sumLinhas(usadosLanc!.linhas) : null;
      const total     = (novosVal ?? 0) + (usadosVal ?? 0);

      result.push({
        vendedor,
        novos:        novosVal,
        usados:       usadosVal,
        total,
        novosPago:    novosLanc?.pago,
        usadosPago:   usadosLanc?.pago,
        novosLinhas:  novosLanc?.linhas  ?? {},
        usadosLinhas: usadosLanc?.linhas ?? {},
        novosAssinaturas:  novosLanc?.assinaturas,
        usadosAssinaturas: usadosLanc?.assinaturas,
      });
    }

    result.sort((a, b) => a.vendedor.localeCompare(b.vendedor, 'pt-BR'));
    return result;
  }, [novosMap, usadosMap, year, month, inativosNovos, inativosUsados]);

  const totals = useMemo(() => ({
    novos:  rows.reduce((s, r) => s + (r.novos  ?? 0), 0),
    usados: rows.reduce((s, r) => s + (r.usados ?? 0), 0),
    total:  rows.reduce((s, r) => s + r.total, 0),
  }), [rows]);

  // ── Expand ────────────────────────────────────────────────────────────────
  function toggleExpand(vendedor: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(vendedor)) next.delete(vendedor); else next.add(vendedor);
      return next;
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDeleteConfirm() {
    if (deletePassword !== '1985') {
      setDeleteError('Senha incorreta.');
      return;
    }
    if (!deleteTarget) return;

    // Atualiza estado local
    const pk = `${year}-${month}`;
    setNovosMap(prev => {
      const upd = { ...prev };
      if (upd[pk]) {
        const { [deleteTarget]: _r, ...rest } = upd[pk];
        upd[pk] = rest;
      }
      return upd;
    });
    setUsadosMap(prev => {
      const upd = { ...prev };
      if (upd[pk]) {
        const { [deleteTarget]: _r, ...rest } = upd[pk];
        upd[pk] = rest;
      }
      return upd;
    });

    // Persiste nos dois tabs
    await Promise.all([
      deleteLancamento('novos',  year, month, deleteTarget),
      deleteLancamento('usados', year, month, deleteTarget),
    ]);

    setDeleteTarget(null);
    setDeletePassword('');
    setDeleteError('');
  }

  // ── Print ─────────────────────────────────────────────────────────────────
  function handlePrint() {
    const competencia = `${MONTHS_NAMES[month - 1]}/${year}`;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;

    const rowsHtml = rows.map(r => `
      <tr>
        <td>${fixName(r.vendedor)}</td>
        <td class="num">${r.novos  !== null ? 'R$ ' + fmtBRL(r.novos)  : '<span class="dash">—</span>'}</td>
        <td class="num">${r.usados !== null ? 'R$ ' + fmtBRL(r.usados) : '<span class="dash">—</span>'}</td>
        <td class="num"><strong>R$ ${fmtBRL(r.total)}</strong></td>
        <td>${[
          r.novos  !== null ? `<span class="${r.novosPago  ? 'pago' : 'pendente'}">N: ${r.novosPago  ? 'Pago' : 'Pendente'}</span>` : '',
          r.usados !== null ? `<span class="${r.usadosPago ? 'pago' : 'pendente'}">U: ${r.usadosPago ? 'Pago' : 'Pendente'}</span>` : '',
        ].filter(Boolean).join('&nbsp;')}</td>
      </tr>`).join('');

    w.document.write(`<!DOCTYPE html><html><head><title>Resumo de Comissões — ${competencia}</title><style>
body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; margin: 24px; }
.modulo { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin-bottom: 2px; }
h2  { font-size: 14px; margin-bottom: 4px; }
.meta { font-size: 10px; color: #64748b; margin-bottom: 16px; }
table { width: 100%; border-collapse: collapse; }
th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing: .05em;
     padding: 6px 10px; text-align: left; border-bottom: 2px solid #cbd5e1; }
td { padding: 10px 10px; border-bottom: 1px solid #e2e8f0; }
.num  { text-align: right; font-variant-numeric: tabular-nums; }
.dash { color: #94a3b8; }
tfoot td { font-weight: bold; background: #f8fafc; border-top: 2px solid #cbd5e1; }
.pago     { color: #16a34a; font-size: 10px; }
.pendente { color: #d97706; font-size: 10px; }
@media print { body { margin: 0; } }
</style></head><body>
<div class="modulo">Cálculo de Comissões VW</div>
<h2>Resumo de Comissões Pagas ao Vendedor</h2>
<div class="meta">Competência: <strong>${competencia}</strong> &nbsp;|&nbsp; Impresso em: ${new Date().toLocaleString('pt-BR')}</div>
<table>
  <thead><tr>
    <th>Vendedor</th>
    <th style="text-align:right">Novos</th>
    <th style="text-align:right">Usados</th>
    <th style="text-align:right">Total</th>
    <th>Status</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
  <tfoot><tr>
    <td>Total Geral</td>
    <td class="num">R$ ${fmtBRL(totals.novos)}</td>
    <td class="num">R$ ${fmtBRL(totals.usados)}</td>
    <td class="num">R$ ${fmtBRL(totals.total)}</td>
    <td></td>
  </tr></tfoot>
</table>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 500);
  }

  // ── Classes CSS ───────────────────────────────────────────────────────────
  const thCls  = 'px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50';
  const tdCls  = 'px-4 py-2.5 text-sm border-b border-slate-100';
  const numCls = `${tdCls} text-right tabular-nums font-mono`;

  const competenciaLabel = `${MONTHS_NAMES[month - 1]}/${year}`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>

      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
          >
            {AVAILABLE_YEARS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
          >
            {MONTHS_NAMES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400">
            Competência: <strong className="text-slate-700">{competenciaLabel}</strong>
          </span>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Imprimir PDF
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            Carregando…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
            <AlertCircle className="w-8 h-8 opacity-30" />
            <p className="text-sm">Nenhum lançamento encontrado para {competenciaLabel}.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            {/* Título */}
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">
                Resumo de Comissões Pagas ao Vendedor
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Competência: {competenciaLabel}</p>
            </div>

            {/* Tabela */}
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={`${thCls} w-8`} />
                  <th className={thCls}>Vendedor</th>
                  <th className={`${thCls} text-right`}>Novos</th>
                  <th className={`${thCls} text-right`}>Usados</th>
                  <th className={`${thCls} text-right`}>Total</th>
                  <th className={thCls}>Status</th>
                  <th className={`${thCls} w-10`} />
                </tr>
              </thead>

              <tbody>
                {rows.map(r => {
                  const isExp = expanded.has(r.vendedor);
                  return (
                    <Fragment key={r.vendedor}>
                      {/* Linha principal */}
                      <tr
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => toggleExpand(r.vendedor)}
                      >
                        <td className={tdCls}>
                          {isExp
                            ? <ChevronDown  className="w-4 h-4 text-slate-400" />
                            : <ChevronRight className="w-4 h-4 text-slate-400" />
                          }
                        </td>
                        <td className={`${tdCls} font-medium text-slate-800`}>{fixName(r.vendedor)}</td>
                        <td className={numCls}>
                          {r.novos !== null
                            ? `R$ ${fmtBRL(r.novos)}`
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                        <td className={numCls}>
                          {r.usados !== null
                            ? `R$ ${fmtBRL(r.usados)}`
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                        <td className={`${numCls} font-semibold text-slate-800`}>
                          R$ {fmtBRL(r.total)}
                        </td>
                        <td className={tdCls}>
                          <div className="flex flex-col gap-1.5">
                            {r.novos !== null && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  r.novosPago
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  N: {r.novosPago ? 'Pago' : 'Pendente'}
                                </span>
                                {CAMPOS.map(campo => {
                                  const ass = r.novosAssinaturas?.[campo];
                                  return (
                                    <span
                                      key={campo}
                                      title={ass ? `${ass.name ?? ass.username} — ${new Date(ass.dataHora).toLocaleString('pt-BR')}` : 'Não assinado'}
                                      className={`text-[9px] px-1.5 py-0.5 rounded font-semibold border ${
                                        ass
                                          ? 'bg-emerald-600 border-emerald-600 text-white'
                                          : 'bg-white border-slate-300 text-slate-400'
                                      }`}
                                    >
                                      {CAMPO_ABBREV[campo]}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {r.usados !== null && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  r.usadosPago
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  U: {r.usadosPago ? 'Pago' : 'Pendente'}
                                </span>
                                {CAMPOS.map(campo => {
                                  const ass = r.usadosAssinaturas?.[campo];
                                  return (
                                    <span
                                      key={campo}
                                      title={ass ? `${ass.name ?? ass.username} — ${new Date(ass.dataHora).toLocaleString('pt-BR')}` : 'Não assinado'}
                                      className={`text-[9px] px-1.5 py-0.5 rounded font-semibold border ${
                                        ass
                                          ? 'bg-emerald-600 border-emerald-600 text-white'
                                          : 'bg-white border-slate-300 text-slate-400'
                                      }`}
                                    >
                                      {CAMPO_ABBREV[campo]}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className={tdCls} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setDeleteTarget(r.vendedor);
                              setDeletePassword('');
                              setDeleteError('');
                            }}
                            className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                            title="Excluir lançamentos do vendedor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>

                      {/* Detalhe expandido */}
                      {isExp && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50/70 border-b border-slate-100 px-10 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                              {/* Detalhe Novos */}
                              {r.novos !== null && Object.keys(r.novosLinhas).length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                                    Novos
                                  </p>
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-[10px] text-slate-400">
                                        <th className="text-left pb-1.5 font-semibold">Chassi</th>
                                        <th className="text-right pb-1.5 font-semibold">Com. Venda</th>
                                        <th className="text-right pb-1.5 font-semibold">Com. LB</th>
                                        <th className="text-right pb-1.5 font-semibold">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Object.entries(r.novosLinhas).map(([chassi, l]) => (
                                        <tr key={chassi} className="border-t border-slate-100">
                                          <td className="py-1 pr-3 font-mono text-slate-500">{chassi}</td>
                                          <td className="py-1 pr-3 text-right tabular-nums">{fmtBRL(l.comVenda)}</td>
                                          <td className="py-1 pr-3 text-right tabular-nums">{fmtBRL(l.comLB)}</td>
                                          <td className="py-1 text-right tabular-nums font-medium text-slate-700">
                                            {fmtBRL(l.comVenda + l.comLB)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t-2 border-slate-200">
                                        <td className="pt-1.5 font-semibold text-slate-600" colSpan={3}>Total Novos</td>
                                        <td className="pt-1.5 text-right tabular-nums font-bold text-slate-800">
                                          {fmtBRL(r.novos)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}

                              {/* Detalhe Usados */}
                              {r.usados !== null && Object.keys(r.usadosLinhas).length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                                    Usados
                                  </p>
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-[10px] text-slate-400">
                                        <th className="text-left pb-1.5 font-semibold">Chassi</th>
                                        <th className="text-right pb-1.5 font-semibold">Com. Venda</th>
                                        <th className="text-right pb-1.5 font-semibold">Com. LB</th>
                                        <th className="text-right pb-1.5 font-semibold">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Object.entries(r.usadosLinhas).map(([chassi, l]) => (
                                        <tr key={chassi} className="border-t border-slate-100">
                                          <td className="py-1 pr-3 font-mono text-slate-500">{chassi}</td>
                                          <td className="py-1 pr-3 text-right tabular-nums">{fmtBRL(l.comVenda)}</td>
                                          <td className="py-1 pr-3 text-right tabular-nums">{fmtBRL(l.comLB)}</td>
                                          <td className="py-1 text-right tabular-nums font-medium text-slate-700">
                                            {fmtBRL(l.comVenda + l.comLB)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t-2 border-slate-200">
                                        <td className="pt-1.5 font-semibold text-slate-600" colSpan={3}>Total Usados</td>
                                        <td className="pt-1.5 text-right tabular-nums font-bold text-slate-800">
                                          {fmtBRL(r.usados)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>

              {/* Rodapé de totais */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className={tdCls} />
                  <td className={`${tdCls} font-semibold text-slate-700`}>Total Geral</td>
                  <td className={`${numCls} font-semibold text-slate-700`}>R$ {fmtBRL(totals.novos)}</td>
                  <td className={`${numCls} font-semibold text-slate-700`}>R$ {fmtBRL(totals.usados)}</td>
                  <td className={`${numCls} font-bold text-slate-900`}>R$ {fmtBRL(totals.total)}</td>
                  <td className={tdCls} />
                  <td className={tdCls} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal de exclusão */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-80 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Excluir lançamentos</p>
                <p className="text-xs text-slate-500 mt-1">
                  Serão excluídos todos os lançamentos de{' '}
                  <strong>{deleteTarget}</strong> em {competenciaLabel} (Novos e Usados).{' '}
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Senha de confirmação</label>
              <input
                type="password"
                value={deletePassword}
                onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleDeleteConfirm()}
                className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-red-400"
                placeholder="••••"
                autoFocus
              />
              {deleteError && (
                <p className="text-xs text-red-500">{deleteError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setDeleteTarget(null); setDeletePassword(''); setDeleteError(''); }}
                className="px-3 py-1.5 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
