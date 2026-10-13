import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronRight, ArrowLeft, Check, CheckCircle, LockOpen, ShieldCheck, Printer, PenLine, Loader2, X, CalendarClock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { apiLogin } from '@/lib/authClient';
import {
  loadAssinaturaRows,
  saveAssinaturaRows,
  type AssinaturaRow,
} from '@/components/VendasBonificacoesDashboard/assinaturaStorage';
import {
  loadSignDriveVendedores,
  loadSignDriveTiposVenda,
  loadSignDriveRegras,
  type Vendedor,
  type TipoVendaSignDrive,
  type RegraRemuneracaoSignDrive,
} from '@/components/CadastrosPage/cadastrosStorage';
import {
  computeEstimativas,
  comissaoVendedorValor,
  isEmNegociacao,
} from '@/components/VendasBonificacoesDashboard/signDriveComissaoVendedor';
import {
  loadAssinaturas,
  saveAssinaturasMap,
  periodoKey,
  type AssinaturasMap,
  type AssinaturaDigital,
  type CampoAssinaturaComissao,
} from './signDriveComissoesAssinaturasStorage';

// ─── Constantes ─────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const CAMPOS: CampoAssinaturaComissao[] = ['financeiro', 'gerenciaComercial', 'diretoriaComercial', 'diretoria'];
const CAMPO_LABELS: Record<CampoAssinaturaComissao, string> = {
  financeiro: 'Financeiro',
  gerenciaComercial: 'Gerência Comercial',
  diretoriaComercial: 'Diretoria Comercial',
  diretoria: 'Diretoria',
};
const CAMPO_SIGLAS: Record<CampoAssinaturaComissao, string> = {
  financeiro: 'Fin',
  gerenciaComercial: 'G.Com',
  diretoriaComercial: 'D.Com',
  diretoria: 'Dir',
};
const SENHA_REABERTURA = '1985';

// ─── Helpers ────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
function todayISO(): string { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function fmtMoney(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDateBR(d: string | undefined): string {
  if (!d) return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) { const [y, m, dd] = d.slice(0, 10).split('-'); return `${dd}/${m}/${y}`; }
  return d;
}
function monthYearOfISO(d: string | undefined): { y: number; m: number } | null {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return null;
  const [y, m] = d.split('-');
  return { y: Number(y), m: Number(m) };
}
function fixVendedorName(name: string): string {
  return name
    .replace(/JOS[\uFFFD?]\s/gi, 'JOSE ')
    .replace(/LOUREN[\uFFFD?]O/gi, 'LOURENCO')
    .replace(/CONCEI[\uFFFD?]{1,2}O/gi, 'CONCEICAO');
}

interface SignDriveDemonstrativoViewProps {
  year: number;
  month: number | null;
}

export function SignDriveDemonstrativoView({ year, month }: SignDriveDemonstrativoViewProps) {
  const { session } = useAuth();

  const [rows, setRows] = useState<AssinaturaRow[]>([]);
  const [regras, setRegras] = useState<RegraRemuneracaoSignDrive[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [tiposVenda, setTiposVenda] = useState<TipoVendaSignDrive[]>([]);
  const [assinMap, setAssinMap] = useState<AssinaturasMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const [reabrirDialog, setReabrirDialog] = useState<{ vendedor: string; senha: string; erro: string | null } | null>(null);
  const [assinDialog, setAssinDialog] = useState<{ vendedor: string; campo: CampoAssinaturaComissao; senha: string; loading: boolean; erro: string | null } | null>(null);
  const [assinTodosDialog, setAssinTodosDialog] = useState<{ campo: CampoAssinaturaComissao; senha: string; loading: boolean; erro: string | null } | null>(null);

  const reload = useCallback(async () => {
    const [r, rg, vd, tv, am] = await Promise.all([
      loadAssinaturaRows(),
      loadSignDriveRegras(),
      loadSignDriveVendedores(),
      loadSignDriveTiposVenda(),
      loadAssinaturas(),
    ]);
    setRows(r); setRegras(rg); setVendedores(vd); setTiposVenda(tv); setAssinMap(am);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const pk = periodoKey(year, month ?? 0);
  const estim = useMemo(
    () => computeEstimativas(rows, regras, vendedores, tiposVenda),
    [rows, regras, vendedores, tiposVenda],
  );

  const isPaid = useCallback((row: AssinaturaRow) => (row.situacaoComissaoVendedor ?? '').trim() !== '', []);
  const isPendente = useCallback((row: AssinaturaRow) =>
    !row.anulada
    && !isEmNegociacao(row.tipoVenda)
    && (row.dataEntrega ?? '').trim() !== ''
    && (row.situacaoComissaoVendedor ?? '').trim() === ''
    && estim.eligibleIds.has(row.id),
  [estim]);
  const paidInPeriod = useCallback((row: AssinaturaRow) => {
    if (!isPaid(row)) return false;
    const my = monthYearOfISO(row.dataPagamentoComissaoVendedor);
    if (!my || my.y !== year) return false;
    return month == null ? true : my.m === month;
  }, [isPaid, year, month]);

  // Vendedores (nome → linhas incluídas: pendentes + pagas no período)
  const vendedorRows = useMemo(() => {
    const map = new Map<string, AssinaturaRow[]>();
    for (const row of rows) {
      if (!isPendente(row) && !paidInPeriod(row)) continue;
      const arr = map.get(row.vendedor) ?? [];
      arr.push(row);
      map.set(row.vendedor, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.dataVenda || '').localeCompare(b.dataVenda || ''));
    }
    return map;
  }, [rows, isPendente, paidInPeriod]);

  const vendedorList = useMemo(
    () => [...vendedorRows.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [vendedorRows],
  );

  const comp = month != null ? `${MONTH_NAMES[month - 1]} de ${year}` : `Ano ${year}`;
  const totalVendas = useMemo(() => [...vendedorRows.values()].reduce((s, a) => s + a.length, 0), [vendedorRows]);

  // ── Ações ──────────────────────────────────────────────────────────────────
  const pagarRows = useCallback(async (target: AssinaturaRow[]) => {
    if (saving) return;
    const pend = target.filter(isPendente);
    if (pend.length === 0) { toast.info('Nenhuma venda pendente para pagar.'); return; }
    setSaving(true);
    const iso = todayISO();
    const dataBR = fmtDateBR(iso);
    const pendIds = new Set(pend.map(r => r.id));
    const next = rows.map(r => {
      if (!pendIds.has(r.id)) return r;
      const valor = comissaoVendedorValor(r, estim.values);
      return { ...r, situacaoComissaoVendedor: `Pago - ${dataBR}`, dataPagamentoComissaoVendedor: iso, estimativaComissaoVendedor: String(valor) };
    });
    const ok = await saveAssinaturaRows(next);
    if (ok) { setRows(next); toast.success(`${pend.length} comissão(ões) marcada(s) como paga(s).`); }
    else toast.error('Falha ao salvar o pagamento.');
    setSaving(false);
  }, [rows, estim, isPendente, saving]);

  const confirmReabrir = useCallback(async () => {
    if (!reabrirDialog) return;
    if (reabrirDialog.senha !== SENHA_REABERTURA) {
      setReabrirDialog(d => d ? { ...d, erro: 'Senha incorreta.' } : d);
      return;
    }
    const alvo = (vendedorRows.get(reabrirDialog.vendedor) ?? []).filter(isPaid);
    const ids = new Set(alvo.map(r => r.id));
    if (ids.size === 0) { setReabrirDialog(null); return; }
    const next = rows.map(r => ids.has(r.id)
      ? { ...r, situacaoComissaoVendedor: '', dataPagamentoComissaoVendedor: '', estimativaComissaoVendedor: '' }
      : r);
    const ok = await saveAssinaturaRows(next);
    if (ok) { setRows(next); toast.success('Demonstrativo reaberto.'); }
    else toast.error('Falha ao reabrir.');
    setReabrirDialog(null);
  }, [reabrirDialog, vendedorRows, rows, isPaid]);

  const confirmAssinatura = useCallback(async () => {
    if (!assinDialog || !session) return;
    setAssinDialog(d => d ? { ...d, loading: true, erro: null } : d);
    const result = await apiLogin(session.username, assinDialog.senha);
    if ('error' in result) {
      setAssinDialog(d => d ? { ...d, loading: false, erro: 'Senha incorreta. Tente novamente.' } : d);
      return;
    }
    const assinatura: AssinaturaDigital = {
      username: session.username,
      name: (result.session.name ?? '') || undefined,
      dataHora: new Date().toISOString(),
    };
    const base = await loadAssinaturas();
    const atual = base[pk]?.[assinDialog.vendedor]?.assinaturas ?? {};
    const full: AssinaturasMap = {
      ...base,
      [pk]: { ...(base[pk] ?? {}), [assinDialog.vendedor]: { assinaturas: { ...atual, [assinDialog.campo]: assinatura } } },
    };
    await saveAssinaturasMap(full);
    setAssinMap(full);
    setAssinDialog(null);
    toast.success(`Assinatura de ${CAMPO_LABELS[assinDialog.campo]} registrada.`);
  }, [assinDialog, session, pk]);

  const confirmAssinarTodos = useCallback(async () => {
    if (!assinTodosDialog || !session) return;
    setAssinTodosDialog(d => d ? { ...d, loading: true, erro: null } : d);
    const result = await apiLogin(session.username, assinTodosDialog.senha);
    if ('error' in result) {
      setAssinTodosDialog(d => d ? { ...d, loading: false, erro: 'Senha incorreta. Tente novamente.' } : d);
      return;
    }
    const assinatura: AssinaturaDigital = {
      username: session.username,
      name: (result.session.name ?? '') || undefined,
      dataHora: new Date().toISOString(),
    };
    const base = await loadAssinaturas();
    const periodMap = { ...(base[pk] ?? {}) };
    for (const vendedor of vendedorList) {
      const cur = periodMap[vendedor]?.assinaturas ?? {};
      periodMap[vendedor] = { assinaturas: { ...cur, [assinTodosDialog.campo]: assinatura } };
    }
    const full: AssinaturasMap = { ...base, [pk]: periodMap };
    await saveAssinaturasMap(full);
    setAssinMap(full);
    setAssinTodosDialog(null);
    toast.success(`Assinatura de ${CAMPO_LABELS[assinTodosDialog.campo]} aplicada a ${vendedorList.length} demonstrativo(s).`);
  }, [assinTodosDialog, session, pk, vendedorList]);

  // ── Impressão (PDF via navegador) ────────────────────────────────────────────
  const printVendedores = useCallback((nomes: string[]) => {
    const esc = (s: string | undefined) => String(s ?? '').replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

    const blocks = nomes.map(nome => {
      const vr = vendedorRows.get(nome) ?? [];
      const hasPend = vr.some(isPendente);
      const hasPaid = vr.some(isPaid);
      const statusTxt = (!hasPend && hasPaid) ? 'Pago' : (hasPend && hasPaid) ? 'Parcial' : 'A pagar';
      const statusCls = (!hasPend && hasPaid) ? 'st-pago' : (hasPend && hasPaid) ? 'st-parc' : 'st-pagar';
      const ass = assinMap[pk]?.[nome]?.assinaturas ?? {};

      const linhas = vr.map(r => {
        const com = comissaoVendedorValor(r, estim.values);
        return `<tr>
          <td>${fmtDateBR(r.dataVenda)}</td>
          <td>${fmtDateBR(r.dataEntrega)}</td>
          <td>${esc(r.tipoVenda)}</td>
          <td>${esc(r.cliente)}</td>
          <td class="r">${fmtMoney(Number(String(r.valorContrato).replace(',', '.')) || 0)}</td>
          <td class="r">${fmtMoney(Number(String(r.totalComissoesBruta).replace(',', '.')) || 0)}</td>
          <td class="com">${fmtMoney(com)}</td>
        </tr>`;
      }).join('');
      const totContrato = vr.reduce((s, r) => s + (Number(String(r.valorContrato).replace(',', '.')) || 0), 0);
      const totBruta = vr.reduce((s, r) => s + (Number(String(r.totalComissoesBruta).replace(',', '.')) || 0), 0);
      const totCom = vr.reduce((s, r) => s + comissaoVendedorValor(r, estim.values), 0);

      const sigCells = CAMPOS.map(campo => {
        const a = ass[campo];
        const label = CAMPO_LABELS[campo];
        if (a) {
          return `<div class="sig-cell">
            <p class="sig-label">${label}</p>
            <div class="sig">
              ${a.name && a.name !== a.username ? `<p class="sig-name">${esc(a.name)}</p>` : ''}
              <p class="sig-user">${esc(a.username)}</p>
              <p class="sig-date">${new Date(a.dataHora).toLocaleString('pt-BR')}</p>
              <p class="sig-el">✓ Assinatura Eletrônica</p>
            </div>
          </div>`;
        }
        return `<div class="sig-cell"><p class="sig-label">${label}</p><div class="sig-empty">Sem assinatura</div></div>`;
      }).join('');

      return `<section class="demo">
        <div class="card">
          <div class="head">
            <div>
              <p class="head-sub">Demonstrativo de Comissão de Vendas Sign Drive</p>
              <h2>${esc(fixVendedorName(nome))}</h2>
              <p class="head-veic">Veículos Novos</p>
            </div>
            <div class="head-right">
              <p class="head-sub">Competência</p>
              <p class="head-comp">${comp}</p>
            </div>
          </div>
          <div class="status"><span class="st ${statusCls}">${statusTxt}</span><span class="st-count">${vr.length} venda(s)</span></div>
          <table>
            <thead><tr>
              <th>Data da Venda</th><th>Data da Entrega</th><th>Produto</th><th>Cliente</th>
              <th class="r">Valor do Contrato</th><th class="r">Total das Comissões Bruta</th><th class="r">Comissão Vendedor</th>
            </tr></thead>
            <tbody>${linhas}</tbody>
            <tfoot><tr>
              <td colspan="4">Totais</td>
              <td class="r">${fmtMoney(totContrato)}</td>
              <td class="r">${fmtMoney(totBruta)}</td>
              <td class="com">${fmtMoney(totCom)}</td>
            </tr></tfoot>
          </table>
        </div>
        <div class="assin">
          <p class="assin-title">Assinaturas</p>
          <div class="assin-grid">${sigCells}</div>
        </div>
      </section>`;
    }).join('');

    const win = window.open('', '_blank');
    if (!win) { toast.error('Habilite pop-ups para imprimir.'); return; }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Comissão Sign&Drive — ${comp}</title>
      <style>
        @page { size: A4 portrait; margin: 1cm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-family: Arial, Helvetica, sans-serif; color:#1e293b; margin:0; padding:20px; }
        .demo { margin-bottom:18px; }
        .demo + .demo { page-break-before: always; }
        .card { border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; }
        .head { background:#1e293b; color:#fff; padding:14px 18px; display:flex; justify-content:space-between; align-items:flex-start; }
        .head-sub { font-size:9px; letter-spacing:.08em; text-transform:uppercase; color:#cbd5e1; margin:0; font-weight:700; }
        .head h2 { font-size:18px; margin:3px 0 0; }
        .head-veic { font-size:11px; color:#cbd5e1; margin:3px 0 0; }
        .head-right { text-align:right; }
        .head-comp { font-size:16px; font-weight:bold; margin:3px 0 0; }
        .status { padding:8px 18px; display:flex; align-items:center; gap:10px; border-bottom:1px solid #f1f5f9; }
        .st { font-size:10px; font-weight:700; border-radius:999px; padding:3px 10px; }
        .st-pago { color:#047857; background:#ecfdf5; border:1px solid #a7f3d0; }
        .st-parc { color:#1d4ed8; background:#eff6ff; border:1px solid #bfdbfe; }
        .st-pagar { color:#b45309; background:#fffbeb; border:1px solid #fde68a; }
        .st-count { font-size:11px; color:#64748b; }
        table { width:100%; border-collapse:collapse; font-size:11px; }
        thead th { background:#334155; color:#fff; padding:7px 8px; text-align:left; font-weight:600; }
        thead th.r { text-align:right; }
        tbody td { padding:6px 8px; border-bottom:1px solid #eef2f6; }
        tbody td.r { text-align:right; }
        td.com { text-align:right; color:#6d28d9; font-weight:600; }
        tfoot td { background:#f8fafc; font-weight:bold; padding:7px 8px; }
        tfoot td.r { text-align:right; }
        tfoot td.com { text-align:right; color:#6d28d9; }
        .assin { border:1px solid #e2e8f0; border-radius:10px; padding:14px 16px; margin-top:16px; }
        .assin-title { font-size:9px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#94a3b8; margin:0 0 12px; }
        .assin-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .sig-label { font-size:11px; color:#64748b; font-weight:500; margin:0 0 5px; }
        .sig { border:1px solid #a7f3d0; background:#ecfdf5; border-radius:8px; padding:10px 14px; }
        .sig-name { font-size:12px; font-weight:bold; color:#064e3b; margin:0; }
        .sig-user { font-size:11px; color:#047857; margin:1px 0 0; }
        .sig-date { font-size:11px; color:#059669; margin:3px 0 0; }
        .sig-el { font-size:9px; font-weight:bold; color:#047857; text-transform:uppercase; letter-spacing:.08em; margin:5px 0 0; }
        .sig-empty { border:1.5px dashed #cbd5e1; border-radius:8px; padding:14px; text-align:center; color:#94a3b8; font-size:11px; }
      </style></head><body>${blocks}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  }, [vendedorRows, estim, comp, assinMap, pk, isPaid, isPendente]);

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const assinaturasDe = (vendedor: string) => assinMap[pk]?.[vendedor]?.assinaturas ?? {};

  // ── Demonstrativo individual ──
  if (selected) {
    const vr = vendedorRows.get(selected) ?? [];
    const ass = assinaturasDe(selected);
    const hasPend = vr.some(isPendente);
    const hasPaid = vr.some(isPaid);
    const totContrato = vr.reduce((s, r) => s + (Number(String(r.valorContrato).replace(',', '.')) || 0), 0);
    const totBruta = vr.reduce((s, r) => s + (Number(String(r.totalComissoesBruta).replace(',', '.')) || 0), 0);
    const totCom = vr.reduce((s, r) => s + comissaoVendedorValor(r, estim.values), 0);

    return (
      <div className="flex-1 overflow-auto bg-slate-100" style={{ minHeight: 0 }}>
        {/* Barra de ações */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-wrap gap-2 sticky top-0 z-10">
          <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 font-medium">
            <ArrowLeft className="w-4 h-4" /> Voltar à lista
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => printVendedores([selected])} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50">
              <Printer className="w-3.5 h-3.5" /> Imprimir PDF
            </button>
            {hasPaid && (
              <button onClick={() => setReabrirDialog({ vendedor: selected, senha: '', erro: null })} className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 border border-amber-300 rounded-lg px-3 py-1.5 hover:bg-amber-50">
                <LockOpen className="w-3.5 h-3.5" /> Reabrir
              </button>
            )}
            {hasPend && (
              <button disabled={saving} onClick={() => pagarRows(vr)} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg px-3 py-1.5 hover:bg-emerald-700 disabled:opacity-50">
                <Check className="w-3.5 h-3.5" /> Marcar como pago
              </button>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto p-6">
          {/* Cabeçalho do demonstrativo */}
          <div className="rounded-t-xl bg-slate-800 text-white px-6 py-4 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">Demonstrativo de Comissão de Vendas Sign Drive</p>
              <h2 className="text-xl font-bold mt-0.5">{fixVendedorName(selected)}</h2>
              <p className="text-xs text-slate-300 mt-0.5">Veículos Novos</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">Competência</p>
              <p className="text-lg font-bold">{comp}</p>
            </div>
          </div>

          {/* Status */}
          <div className="bg-white border-x border-slate-200 px-6 py-3 flex items-center gap-2 flex-wrap">
            {!hasPend && hasPaid ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                <Check className="w-3.5 h-3.5" /> Pago
              </span>
            ) : hasPend && hasPaid ? (
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">Parcial</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                <CalendarClock className="w-3.5 h-3.5" /> A pagar
              </span>
            )}
            <span className="text-xs text-slate-500">{vr.length} venda(s)</span>
          </div>

          {/* Tabela */}
          <div className="bg-white border-x border-b border-slate-200 rounded-b-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700 text-white text-xs">
                  <th className="px-3 py-2 text-left font-semibold">Data da Venda</th>
                  <th className="px-3 py-2 text-left font-semibold">Data da Entrega</th>
                  <th className="px-3 py-2 text-left font-semibold">Produto</th>
                  <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor do Contrato</th>
                  <th className="px-3 py-2 text-right font-semibold">Total das Comissões Bruta</th>
                  <th className="px-3 py-2 text-right font-semibold">Comissão Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {vr.map(r => {
                  const com = comissaoVendedorValor(r, estim.values);
                  return (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="px-3 py-2">{fmtDateBR(r.dataVenda)}</td>
                      <td className="px-3 py-2">{fmtDateBR(r.dataEntrega)}</td>
                      <td className="px-3 py-2">{r.tipoVenda}</td>
                      <td className="px-3 py-2">{r.cliente}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(Number(String(r.valorContrato).replace(',', '.')) || 0)}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(Number(String(r.totalComissoesBruta).replace(',', '.')) || 0)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-violet-700">{fmtMoney(com)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-3 py-2" colSpan={4}>Totais</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(totContrato)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(totBruta)}</td>
                  <td className="px-3 py-2 text-right text-violet-700">{fmtMoney(totCom)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Assinaturas */}
          <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assinaturas</p>
            </div>
            <div className="px-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CAMPOS.map(campo => {
                  const a = ass[campo];
                  return (
                    <div key={campo} className="flex flex-col gap-1.5">
                      <p className="text-xs text-slate-500 font-medium">{CAMPO_LABELS[campo]}</p>
                      {a ? (
                        <div className="border border-emerald-200 rounded-lg px-4 py-3 bg-emerald-50 flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <div className="flex flex-col">
                              {a.name && a.name !== a.username && (
                                <span className="text-sm font-bold text-emerald-900">{a.name}</span>
                              )}
                              <span className="text-xs text-emerald-700">{a.username}</span>
                            </div>
                          </div>
                          <p className="text-xs text-emerald-600">{new Date(a.dataHora).toLocaleString('pt-BR')}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-700" />
                            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Assinatura Eletrônica</p>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAssinDialog({ vendedor: selected, campo, senha: '', loading: false, erro: null })}
                          className="border-2 border-dashed border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-400 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50 transition-colors flex items-center gap-2 justify-center"
                        >
                          <PenLine className="w-4 h-4" />
                          Assinar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {renderDialogs()}
      </div>
    );
  }

  // ── Lista de vendedores ──
  return (
    <div className="flex-1 overflow-auto bg-slate-100" style={{ minHeight: 0 }}>
      <div className="max-w-5xl mx-auto p-6">
        {/* Barra superior */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="text-sm text-slate-600">
            <span className="font-bold text-slate-800">{comp}</span>
            <span className="mx-2 text-slate-300">·</span>
            {vendedorList.length} vendedor(es)
            <span className="mx-2 text-slate-300">·</span>
            {totalVendas} venda(s)
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button disabled={saving} onClick={() => pagarRows(rows)} className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 border border-emerald-300 rounded-lg px-3 py-1.5 hover:bg-emerald-50 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> Marcar todos como pago
            </button>
            <button onClick={() => setAssinTodosDialog({ campo: 'financeiro', senha: '', loading: false, erro: null })} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50">
              <PenLine className="w-3.5 h-3.5" /> Assinar todos
            </button>
            <button onClick={() => printVendedores(vendedorList)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50">
              <Printer className="w-3.5 h-3.5" /> Imprimir PDF
            </button>
          </div>
        </div>

        {vendedorList.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Nenhuma comissão pendente ou paga em {comp}.</p>
            <p className="text-xs mt-1">Vendas aparecem aqui quando têm Data de Entrega informada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {vendedorList.map(nome => {
              const vr = vendedorRows.get(nome) ?? [];
              const ass = assinaturasDe(nome);
              const hasPend = vr.some(isPendente);
              const hasPaid = vr.some(isPaid);
              const totCom = vr.reduce((s, r) => s + comissaoVendedorValor(r, estim.values), 0);
              const inicial = fixVendedorName(nome).charAt(0).toUpperCase();
              return (
                <button
                  key={nome}
                  onClick={() => setSelected(nome)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-4 hover:border-slate-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {inicial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{fixVendedorName(nome)}</p>
                    <p className="text-xs text-slate-500">Veículos Novos · {vr.length} venda(s) · {fmtMoney(totCom)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {CAMPOS.map(campo => (
                      <span key={campo} className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border ${ass[campo] ? 'text-emerald-700 border-emerald-300 bg-emerald-50' : 'text-slate-400 border-slate-200'}`}>
                        {CAMPO_SIGLAS[campo]}
                      </span>
                    ))}
                  </div>
                  {!hasPend && hasPaid ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                      <Check className="w-3.5 h-3.5" /> Pago
                    </span>
                  ) : hasPend && hasPaid ? (
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">Parcial</span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">A pagar</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {renderDialogs()}
    </div>
  );

  // ── Diálogos (reabrir / assinar / assinar todos) ──
  function renderDialogs() {
    return (
      <>
        {reabrirDialog && (
          <DialogShell title="Reabrir demonstrativo" onClose={() => setReabrirDialog(null)}>
            <p className="text-sm text-slate-600">Informe a senha para reabrir as comissões já pagas de <strong>{fixVendedorName(reabrirDialog.vendedor)}</strong>.</p>
            <input
              type="password"
              autoFocus
              value={reabrirDialog.senha}
              onChange={e => setReabrirDialog(d => d ? { ...d, senha: e.target.value, erro: null } : d)}
              onKeyDown={e => { if (e.key === 'Enter') confirmReabrir(); }}
              className="mt-3 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Senha"
            />
            {reabrirDialog.erro && <p className="text-xs text-red-600 mt-1">{reabrirDialog.erro}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setReabrirDialog(null)} className="text-xs font-semibold text-slate-500 px-3 py-2">Cancelar</button>
              <button onClick={confirmReabrir} className="text-xs font-semibold text-white bg-amber-600 rounded-lg px-4 py-2 hover:bg-amber-700">Reabrir</button>
            </div>
          </DialogShell>
        )}

        {assinDialog && (
          <DialogShell title={`Assinar — ${CAMPO_LABELS[assinDialog.campo]}`} onClose={() => setAssinDialog(null)}>
            <p className="text-sm text-slate-600">Confirme sua senha para assinar como <strong>{CAMPO_LABELS[assinDialog.campo]}</strong>.</p>
            <input
              type="password"
              autoFocus
              value={assinDialog.senha}
              onChange={e => setAssinDialog(d => d ? { ...d, senha: e.target.value, erro: null } : d)}
              onKeyDown={e => { if (e.key === 'Enter') confirmAssinatura(); }}
              className="mt-3 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Senha"
            />
            {assinDialog.erro && <p className="text-xs text-red-600 mt-1">{assinDialog.erro}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAssinDialog(null)} className="text-xs font-semibold text-slate-500 px-3 py-2">Cancelar</button>
              <button disabled={assinDialog.loading} onClick={confirmAssinatura} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg px-4 py-2 hover:bg-emerald-700 disabled:opacity-50">
                {assinDialog.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Assinar
              </button>
            </div>
          </DialogShell>
        )}

        {assinTodosDialog && (
          <DialogShell title="Assinar todos os demonstrativos" onClose={() => setAssinTodosDialog(null)}>
            <p className="text-sm text-slate-600">Escolha o papel e confirme sua senha. A assinatura será aplicada a todos os {vendedorList.length} vendedor(es) de {comp}.</p>
            <select
              value={assinTodosDialog.campo}
              onChange={e => setAssinTodosDialog(d => d ? { ...d, campo: e.target.value as CampoAssinaturaComissao } : d)}
              className="mt-3 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {CAMPOS.map(c => <option key={c} value={c}>{CAMPO_LABELS[c]}</option>)}
            </select>
            <input
              type="password"
              value={assinTodosDialog.senha}
              onChange={e => setAssinTodosDialog(d => d ? { ...d, senha: e.target.value, erro: null } : d)}
              onKeyDown={e => { if (e.key === 'Enter') confirmAssinarTodos(); }}
              className="mt-2 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Senha"
            />
            {assinTodosDialog.erro && <p className="text-xs text-red-600 mt-1">{assinTodosDialog.erro}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAssinTodosDialog(null)} className="text-xs font-semibold text-slate-500 px-3 py-2">Cancelar</button>
              <button disabled={assinTodosDialog.loading} onClick={confirmAssinarTodos} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg px-4 py-2 hover:bg-emerald-700 disabled:opacity-50">
                {assinTodosDialog.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Assinar todos
              </button>
            </div>
          </DialogShell>
        )}
      </>
    );
  }
}

function DialogShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
