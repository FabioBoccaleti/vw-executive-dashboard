import { useMemo, useRef } from 'react';
import { Printer, CheckCircle2, X } from 'lucide-react';
import type { PeliculasRow } from './peliculasStorage';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SITUACOES_VALIDAS = new Set(['Processo Finalizado', 'Encerrada']);
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const mesRefLabel = () => {
  const d = new Date();
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};
const n = (v?: string) => parseFloat(v ?? '') || 0;

// ─── Tipos internos ───────────────────────────────────────────────────────────
interface EntryItem {
  rowId: string;
  role: 'vendedor' | 'acessorios';
  os: string;
  dataRegistro: string;
  cliente: string;
  produto: string;
  valorVenda: number;
  comissao: number;
}

interface Demonstrativo {
  pessoa: string;
  entries: EntryItem[];
  totalComissao: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  rows: PeliculasRow[];
  onPagar: (updatedRows: PeliculasRow[]) => void;
  onClose: () => void;
}

// ─── CSS de impressão (injetado em <style> na janela de print) ────────────────
const PRINT_CSS = `
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; margin: 0; }
  .demo-page { page-break-after: always; padding: 28px 32px; max-width: 800px; margin: 0 auto; }
  .demo-page:last-child { page-break-after: auto; }
  .company-bar { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
  .company-name { font-size: 11pt; font-weight: 700; color: #1e1b4b; }
  .company-dept { font-size: 9pt; color: #4338ca; font-weight: 600; }
  .demo-header { border-bottom: 2px solid #312e81; padding-bottom: 10px; margin-bottom: 16px; }
  .demo-title { font-size: 13pt; font-weight: 700; color: #312e81; }
  .demo-subtitle { font-size: 9pt; color: #555; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th { background: #312e81; color: #fff; padding: 6px 8px; font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; text-align: left; }
  th.r, td.r { text-align: right; }
  th.c, td.c { text-align: center; }
  td { padding: 5px 8px; font-size: 9pt; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8faff; }
  .tfoot-row td { font-weight: 700; border-top: 2px solid #312e81; background: #eef2ff !important; }
  .total-box { background: #312e81; color: #fff; border-radius: 6px; padding: 10px 14px; display: inline-block; margin-bottom: 20px; font-size: 11pt; font-weight: 700; }
  .sigs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; margin-top: 40px; }
  .sig-line { border-top: 1px solid #555; padding-top: 6px; font-size: 8.5pt; color: #444; text-align: center; }
  .badge { display: inline-block; font-size: 7.5pt; padding: 1px 6px; border-radius: 999px; font-weight: 700; }
  .badge-v { background: #dbeafe; color: #1e40af; }
  .badge-a { background: #dcfce7; color: #166534; }
  .data-reg { font-size: 7.5pt; color: #888; margin-top: 1px; }
`;

// ─── Componente ───────────────────────────────────────────────────────────────
export function PeliculasDemonstrativo({ rows, onPagar, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  // Agrupa por pessoa (combinando papel vendedor + acessórios)
  const demonstrativos = useMemo<Demonstrativo[]>(() => {
    const map = new Map<string, EntryItem[]>();

    for (const r of rows) {
      if (!SITUACOES_VALIDAS.has(r.situacao)) continue;

      // Comissão do vendedor (pendente = não paga ainda)
      const comV = n(r.comissaoVendedor);
      if (r.vendedor?.trim() && comV > 0 && !r.comissaoVendedorPagaEm) {
        const pessoa = r.vendedor.trim();
        if (!map.has(pessoa)) map.set(pessoa, []);
        map.get(pessoa)!.push({
          rowId: r.id, role: 'vendedor',
          os: r.numeroOS, dataRegistro: r.dataRegistro, cliente: r.nomeCliente, produto: r.produto,
          valorVenda: n(r.valorVenda), comissao: comV,
        });
      }

      // Comissão do vendedor de acessórios (pendente)
      const comA = n(r.comissaoVendedorAcessorios);
      if (r.vendedorAcessorios?.trim() && comA > 0 && !r.comissaoAcessoriosPagaEm) {
        const pessoa = r.vendedorAcessorios.trim();
        if (!map.has(pessoa)) map.set(pessoa, []);
        map.get(pessoa)!.push({
          rowId: r.id, role: 'acessorios',
          os: r.numeroOS, dataRegistro: r.dataRegistro, cliente: r.nomeCliente, produto: r.produto,
          valorVenda: n(r.valorVenda), comissao: comA,
        });
      }
    }

    return [...map.entries()]
      .map(([pessoa, entries]) => ({
        pessoa,
        entries,
        totalComissao: entries.reduce((s, e) => s + e.comissao, 0),
      }))
      .sort((a, b) => a.pessoa.localeCompare(b.pessoa, 'pt-BR'));
  }, [rows]);

  // ── Pagar linhas individuais ───────────────────────────────────────────────
  const pagarEntries = (entries: EntryItem[]) => {
    const today = todayISO();
    const updated = rows.map(r => {
      const copy = { ...r };
      for (const e of entries) {
        if (e.rowId !== r.id) continue;
        if (e.role === 'vendedor')    copy.comissaoVendedorPagaEm  = today;
        if (e.role === 'acessorios')  copy.comissaoAcessoriosPagaEm = today;
      }
      return copy;
    });
    onPagar(updated);
  };

  const pagarEntry = (entry: EntryItem) => pagarEntries([entry]);
  const pagarTodos = (demo: Demonstrativo) => pagarEntries(demo.entries);
  const pagarTodosGlobal = () => {
    const all = demonstrativos.flatMap(d => d.entries);
    pagarEntries(all);
  };

  // ── Impressão ─────────────────────────────────────────────────────────────
  const buildPrintContent = (demos: Demonstrativo[]) => {
    const mes = mesRefLabel();
    const pages = demos.map(demo => `
      <div class="demo-page">
        <div class="company-bar">
          <span class="company-name">Sorana Audi</span>
          <span class="company-dept">Departamento: Acessórios</span>
        </div>
        <div class="demo-header">
          <div class="demo-title">Demonstrativo de Comissão de Películas — ${demo.pessoa}</div>
          <div class="demo-subtitle">Mês de referência: ${mes}</div>
        </div>
        <table>
          <thead><tr>
            <th>Nº OS</th><th>Nome do Cliente</th><th>Produto</th>
            <th class="c">Função</th><th class="r">Valor da Venda</th><th class="r">Comissão</th>
          </tr></thead>
          <tbody>
            ${demo.entries.map(e => `
              <tr>
                <td>${e.os || '—'}${e.dataRegistro ? `<div class="data-reg">Reg: ${fmtDate(e.dataRegistro)}</div>` : ''}</td>
                <td>${e.cliente || '—'}</td>
                <td>${e.produto || '—'}</td>
                <td class="c"><span class="badge ${e.role === 'vendedor' ? 'badge-v' : 'badge-a'}">${e.role === 'vendedor' ? 'Vendedor' : 'Acessórios'}</span></td>
                <td class="r">${fmtBRL(e.valorVenda)}</td>
                <td class="r">${fmtBRL(e.comissao)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot><tr class="tfoot-row">
            <td colspan="5">Total</td>
            <td class="r">${fmtBRL(demo.totalComissao)}</td>
          </tr></tfoot>
        </table>
        <div class="total-box">Total a receber: ${fmtBRL(demo.totalComissao)}</div>
        <div class="sigs">
          <div class="sig-line">Diretoria Comercial</div>
          <div class="sig-line">Diretoria</div>
          <div class="sig-line">Financeiro</div>
        </div>
      </div>
    `).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Demonstrativos de Comissão</title>
      <style>${PRINT_CSS}</style></head><body>${pages}</body></html>`;
  };

  const imprimir = (demos: Demonstrativo[]) => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(buildPrintContent(demos));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  const mesLabel = mesRefLabel();

  if (demonstrativos.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="font-bold text-slate-700 text-lg mb-1">Nenhuma comissão pendente</p>
          <p className="text-slate-500 text-sm mb-5">Todas as comissões elegíveis já foram pagas.</p>
          <button onClick={onClose} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">Fechar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40 backdrop-blur-sm">
      <div className="flex-1 overflow-auto py-6 px-4">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ── Cabeçalho do modal ── */}
          <div className="bg-white rounded-2xl shadow-xl px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-indigo-900">Demonstrativos de Comissão</h2>
              <p className="text-xs text-slate-500 mt-0.5">Mês de referência: <span className="font-semibold text-indigo-700">{mesLabel}</span> · {demonstrativos.length} {demonstrativos.length === 1 ? 'pessoa' : 'pessoas'} com comissão pendente</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => imprimir(demonstrativos)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir Todos
              </button>
              <button
                onClick={pagarTodosGlobal}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Pagar Todos
              </button>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── Demonstrativos ── */}
          <div ref={printRef} className="space-y-6">
            {demonstrativos.map(demo => (
              <div key={demo.pessoa} className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">

                {/* Faixa empresa/departamento */}
                <div className="flex items-center justify-between px-6 py-2 border-b border-slate-100 bg-slate-50">
                  <span className="text-[11px] font-bold text-indigo-950 tracking-wide">Sorana Audi</span>
                  <span className="text-[11px] font-semibold text-indigo-600">Departamento: Acessórios</span>
                </div>

                {/* Header do card */}
                <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-bold text-base leading-tight">{demo.pessoa}</p>
                      <p className="text-indigo-200 text-xs mt-0.5">Mês de referência: {mesLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => imprimir([demo])}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" /> Imprimir
                      </button>
                      <button
                        onClick={() => pagarTodos(demo)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Pagar Todas
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tabela de vendas */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ background: '#4338ca' }}>
                        <th className="text-white text-left px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Nº OS</th>
                        <th className="text-white text-left px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Cliente</th>
                        <th className="text-white text-left px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Produto</th>
                        <th className="text-white text-center px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Função</th>
                        <th className="text-white text-right px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Valor da Venda</th>
                        <th className="text-white text-right px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Comissão</th>
                        <th className="text-white text-center px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Pagar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demo.entries.map((e, i) => (
                        <tr key={`${e.rowId}-${e.role}`} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                          <td className="px-4 py-2 font-mono text-slate-600">
                            {e.os || '—'}
                            {e.dataRegistro && (
                              <div className="text-[9px] text-slate-400 font-sans font-normal mt-0.5">Reg: {fmtDate(e.dataRegistro)}</div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-700">{e.cliente || '—'}</td>
                          <td className="px-4 py-2 text-slate-600">{e.produto || '—'}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${e.role === 'vendedor' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {e.role === 'vendedor' ? 'Vendedor' : 'Acessórios'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-slate-600">{fmtBRL(e.valorVenda)}</td>
                          <td className="px-4 py-2 text-right font-mono font-semibold text-indigo-700">{fmtBRL(e.comissao)}</td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => pagarEntry(e)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold transition-colors"
                            >
                              Pagar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-indigo-200 bg-indigo-50">
                        <td colSpan={5} className="px-4 py-2.5 font-bold text-indigo-900 text-[11px] uppercase tracking-wide">Total</td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono text-indigo-900 text-sm">{fmtBRL(demo.totalComissao)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Assinaturas (visíveis apenas na tela, decorativas — para impressão usar o print CSS) */}
                <div className="grid grid-cols-3 gap-6 px-6 py-5 border-t border-slate-100">
                  {['Diretoria Comercial', 'Diretoria', 'Financeiro'].map(label => (
                    <div key={label} className="text-center">
                      <div className="border-t border-slate-400 pt-2 text-[11px] text-slate-500">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
