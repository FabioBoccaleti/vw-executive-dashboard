import { useMemo, useRef, useState, useEffect, type ReactNode } from 'react';
import { Printer, CheckCircle2, X, Clock, History, PenLine, CheckCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiLogin } from '@/lib/authClient';
import { kvGet, kvSet } from '@/lib/kvClient';
import { useAuth } from '@/contexts/useAuth';
import type { EsteticaRow } from './esteticaStorage';

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

// ─── Assinaturas digitais ─────────────────────────────────────────────────────
type CampoAssinatura = 'diretoriaComercial' | 'diretoria' | 'financeiro';
interface AssinaturaDigital { username: string; name?: string; dataHora: string; }
const CAMPO_LABELS: Record<CampoAssinatura, string> = {
  diretoriaComercial: 'Diretoria Comercial',
  diretoria: 'Diretoria',
  financeiro: 'Financeiro',
};
const CAMPOS = Object.entries(CAMPO_LABELS) as [CampoAssinatura, string][];

// ─── Tipos internos ───────────────────────────────────────────────────────────
interface EntryItem {
  rowId: string;
  role: 'vendedor' | 'acessorios';
  os: string;
  dataRegistro: string;
  cliente: string;
  produto: string;
  valorVenda: number;
  pctLucroBruto: number | null;
  comissao: number;
}

interface Demonstrativo {
  pessoa: string;
  entries: EntryItem[];
  totalComissao: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  rows: EsteticaRow[];
  onPagar: (updatedRows: EsteticaRow[]) => void;
  onClose: () => void;
}

// ─── CSS de impressão ─────────────────────────────────────────────────────────
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
export function EsteticaDemonstrativo({ rows, onPagar, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const { session } = useAuth();

  // ── Toggle: pendentes / pagas ──────────────────────────────────────────────
  const [view, setView] = useState<'pendentes' | 'pagas'>('pendentes');
  const [mesFiltro, setMesFiltro] = useState<string>(''); // 'YYYY-MM'

  const mesesDisponiveis = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const d1 = r.comissaoVendedorPagaEm;
      const d2 = r.comissaoAcessoriosPagaEm;
      if (d1) set.add(d1.slice(0, 7));
      if (d2) set.add(d2.slice(0, 7));
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [rows]);

  useEffect(() => {
    if (view === 'pagas' && !mesFiltro && mesesDisponiveis.length > 0) {
      setMesFiltro(mesesDisponiveis[0]);
    }
  }, [view, mesFiltro, mesesDisponiveis]);

  // Agrupa por pessoa — pendentes
  const demonstrativos = useMemo<Demonstrativo[]>(() => {
    const map = new Map<string, EntryItem[]>();
    for (const r of rows) {
      if (!SITUACOES_VALIDAS.has(r.situacao)) continue;
      const comV = n(r.comissaoVendedor);
      if (r.vendedor?.trim() && comV > 0 && !r.comissaoVendedorPagaEm) {
        const pessoa = r.vendedor.trim();
        if (!map.has(pessoa)) map.set(pessoa, []);
        map.get(pessoa)!.push({
          rowId: r.id, role: 'vendedor',
          os: r.numeroOS, dataRegistro: r.dataRegistro, cliente: r.nomeCliente, produto: r.produto,
          valorVenda: n(r.valorVenda),
          pctLucroBruto: n(r.receitaLiquida) > 0 ? (n(r.lucroBruto) / n(r.receitaLiquida)) * 100 : null,
          comissao: comV,
        });
      }
      const comA = n(r.comissaoVendedorAcessorios);
      if (r.vendedorAcessorios?.trim() && comA > 0 && !r.comissaoAcessoriosPagaEm) {
        const pessoa = r.vendedorAcessorios.trim();
        if (!map.has(pessoa)) map.set(pessoa, []);
        map.get(pessoa)!.push({
          rowId: r.id, role: 'acessorios',
          os: r.numeroOS, dataRegistro: r.dataRegistro, cliente: r.nomeCliente, produto: r.produto,
          valorVenda: n(r.valorVenda),
          pctLucroBruto: n(r.receitaLiquida) > 0 ? (n(r.lucroBruto) / n(r.receitaLiquida)) * 100 : null,
          comissao: comA,
        });
      }
    }
    return [...map.entries()]
      .map(([pessoa, entries]) => ({ pessoa, entries, totalComissao: entries.reduce((s, e) => s + e.comissao, 0) }))
      .sort((a, b) => a.pessoa.localeCompare(b.pessoa, 'pt-BR'));
  }, [rows]);

  // Agrupa por pessoa — pagas (filtradas por mês)
  const demonstrativosPagos = useMemo<Demonstrativo[]>(() => {
    if (!mesFiltro) return [];
    const map = new Map<string, EntryItem[]>();
    for (const r of rows) {
      if (!SITUACOES_VALIDAS.has(r.situacao)) continue;
      const comV = n(r.comissaoVendedor);
      if (r.vendedor?.trim() && comV > 0 && r.comissaoVendedorPagaEm?.startsWith(mesFiltro)) {
        const pessoa = r.vendedor.trim();
        if (!map.has(pessoa)) map.set(pessoa, []);
        map.get(pessoa)!.push({
          rowId: r.id, role: 'vendedor',
          os: r.numeroOS, dataRegistro: r.dataRegistro, cliente: r.nomeCliente, produto: r.produto,
          valorVenda: n(r.valorVenda),
          pctLucroBruto: n(r.receitaLiquida) > 0 ? (n(r.lucroBruto) / n(r.receitaLiquida)) * 100 : null,
          comissao: comV,
        });
      }
      const comA = n(r.comissaoVendedorAcessorios);
      if (r.vendedorAcessorios?.trim() && comA > 0 && r.comissaoAcessoriosPagaEm?.startsWith(mesFiltro)) {
        const pessoa = r.vendedorAcessorios.trim();
        if (!map.has(pessoa)) map.set(pessoa, []);
        map.get(pessoa)!.push({
          rowId: r.id, role: 'acessorios',
          os: r.numeroOS, dataRegistro: r.dataRegistro, cliente: r.nomeCliente, produto: r.produto,
          valorVenda: n(r.valorVenda),
          pctLucroBruto: n(r.receitaLiquida) > 0 ? (n(r.lucroBruto) / n(r.receitaLiquida)) * 100 : null,
          comissao: comA,
        });
      }
    }
    return [...map.entries()]
      .map(([pessoa, entries]) => ({ pessoa, entries, totalComissao: entries.reduce((s, e) => s + e.comissao, 0) }))
      .sort((a, b) => a.pessoa.localeCompare(b.pessoa, 'pt-BR'));
  }, [rows, mesFiltro]);

  const demosAtivas = view === 'pendentes' ? demonstrativos : demonstrativosPagos;

  // ── Assinaturas ────────────────────────────────────────────────────────────
  const [assinaturas, setAssinaturas] = useState<Record<string, Partial<Record<CampoAssinatura, AssinaturaDigital>>>>({});
  const [assinaDialog, setAssinaDialog] = useState<{
    pessoa: string; campo: CampoAssinatura; senha: string; loading: boolean; erro: string | null;
  } | null>(null);
  const [assinarTodosDialog, setAssinarTodosDialog] = useState<{
    campo: CampoAssinatura; senha: string; loading: boolean; erro: string | null;
  } | null>(null);

  const activeKvKey = useMemo(() => {
    if (view === 'pagas' && mesFiltro) {
      const [y, m] = mesFiltro.split('-');
      return `estetica:assinaturas:${y}:${m}`;
    }
    const now = new Date();
    return `estetica:assinaturas:${now.getFullYear()}:${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [view, mesFiltro]);

  useEffect(() => {
    setAssinaturas({});
    kvGet(activeKvKey).then((val: unknown) => {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        setAssinaturas(val as Record<string, Partial<Record<CampoAssinatura, AssinaturaDigital>>>);
      }
    });
  }, [activeKvKey]);

  const handleConfirmarAssinatura = async () => {
    if (!assinaDialog || !session) return;
    setAssinaDialog(prev => prev ? { ...prev, loading: true, erro: null } : prev);
    try {
      const res = await apiLogin(session.username, assinaDialog.senha);
      if ('error' in res) {
        setAssinaDialog(prev => prev ? { ...prev, loading: false, erro: 'Senha incorreta.' } : prev);
        return;
      }
      const nova: AssinaturaDigital = {
        username: session.username,
        name: res.session.name,
        dataHora: new Date().toISOString(),
      };
      const updated = {
        ...assinaturas,
        [assinaDialog.pessoa]: { ...(assinaturas[assinaDialog.pessoa] ?? {}), [assinaDialog.campo]: nova },
      };
      await kvSet(activeKvKey, updated);
      setAssinaturas(updated);
      setAssinaDialog(null);
      toast.success(`Assinado por ${nova.name ?? nova.username}`);
    } catch {
      setAssinaDialog(prev => prev ? { ...prev, loading: false, erro: 'Erro ao assinar.' } : prev);
    }
  };

  const handleAssinarTodos = async () => {
    if (!assinarTodosDialog || !session) return;
    setAssinarTodosDialog(prev => prev ? { ...prev, loading: true, erro: null } : prev);
    try {
      const res = await apiLogin(session.username, assinarTodosDialog.senha);
      if ('error' in res) {
        setAssinarTodosDialog(prev => prev ? { ...prev, loading: false, erro: 'Senha incorreta.' } : prev);
        return;
      }
      const nova: AssinaturaDigital = {
        username: session.username,
        name: res.session.name,
        dataHora: new Date().toISOString(),
      };
      const updated = { ...assinaturas };
      for (const demo of demosAtivas) {
        updated[demo.pessoa] = { ...(updated[demo.pessoa] ?? {}), [assinarTodosDialog.campo]: nova };
      }
      await kvSet(activeKvKey, updated);
      setAssinaturas(updated);
      setAssinarTodosDialog(null);
      toast.success(`Todos assinados por ${nova.name ?? nova.username}`);
    } catch {
      setAssinarTodosDialog(prev => prev ? { ...prev, loading: false, erro: 'Erro ao assinar.' } : prev);
    }
  };

  // ── Pagar ─────────────────────────────────────────────────────────────────
  const pagarEntries = (entries: EntryItem[]) => {
    const today = todayISO();
    const updated = rows.map(r => {
      const copy = { ...r };
      for (const e of entries) {
        if (e.rowId !== r.id) continue;
        if (e.role === 'vendedor')   copy.comissaoVendedorPagaEm  = today;
        if (e.role === 'acessorios') copy.comissaoAcessoriosPagaEm = today;
      }
      return copy;
    });
    onPagar(updated);
  };

  const pagarEntry = (entry: EntryItem) => pagarEntries([entry]);
  const pagarTodos = (demo: Demonstrativo) => pagarEntries(demo.entries);
  const pagarTodosGlobal = () => pagarEntries(demonstrativos.flatMap(d => d.entries));

  // ── Impressão ─────────────────────────────────────────────────────────────
  const buildPrintContent = (demos: Demonstrativo[], mesLabel: string) => {
    const pages = demos.map(demo => `
      <div class="demo-page">
        <div class="company-bar">
          <span class="company-name">Sorana Audi</span>
          <span class="company-dept">Departamento: Oficina</span>
        </div>
        <div class="demo-header">
          <div class="demo-title">Demonstrativo de Comissão de Estética — ${demo.pessoa}</div>
          <div class="demo-subtitle">Mês de referência: ${mesLabel}</div>
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
                <td class="c"><span class="badge ${e.role === 'vendedor' ? 'badge-v' : 'badge-a'}">${e.role === 'vendedor' ? 'Vendedor' : 'Serviço'}</span></td>
                <td class="r">${fmtBRL(e.valorVenda)}${e.pctLucroBruto !== null ? `<div class="data-reg">LB: ${e.pctLucroBruto.toFixed(1)}%</div>` : ''}</td>
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
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Demonstrativos de Comissão — Estética</title>
      <style>${PRINT_CSS}</style></head><body>${pages}</body></html>`;
  };

  const imprimir = (demos: Demonstrativo[]) => {
    const mesLabel = view === 'pagas' && mesFiltro
      ? (() => { const [y, m] = mesFiltro.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); })()
      : mesRefLabel();
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(buildPrintContent(demos, mesLabel));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  // ── TabButton helper ───────────────────────────────────────────────────────
  const TabButton = ({ id, label, icon, count }: { id: 'pendentes' | 'pagas'; label: string; icon: ReactNode; count?: number }) => (
    <button
      onClick={() => setView(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${view === id ? 'bg-indigo-700 text-white shadow' : 'bg-white/10 text-indigo-200 hover:bg-white/20'}`}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${view === id ? 'bg-white/20 text-white' : 'bg-white/10 text-indigo-200'}`}>
          {count}
        </span>
      )}
    </button>
  );

  const mesLabel = view === 'pagas' && mesFiltro
    ? (() => { const [y, m] = mesFiltro.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); })()
    : mesRefLabel();

  return (
    <>
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40 backdrop-blur-sm">
      <div className="flex-1 overflow-auto py-6 px-4">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* ── Cabeçalho do modal ── */}
          <div className="bg-indigo-900 rounded-2xl shadow-xl px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Demonstrativos de Comissão</h2>
                <p className="text-indigo-300 text-xs mt-0.5">
                  {view === 'pendentes'
                    ? `Mês de referência: ${mesLabel} · ${demonstrativos.length} ${demonstrativos.length === 1 ? 'pessoa' : 'pessoas'} com comissão pendente`
                    : `Pagas em: ${mesLabel} · ${demonstrativosPagos.length} ${demonstrativosPagos.length === 1 ? 'pessoa' : 'pessoas'}`
                  }
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Toggle Pendentes / Pagas */}
                <div className="flex items-center gap-1 bg-indigo-800 rounded-xl p-1">
                  <TabButton id="pendentes" label="Pendentes" icon={<Clock className="w-3.5 h-3.5" />} count={demonstrativos.length} />
                  <TabButton id="pagas" label="Pagas" icon={<History className="w-3.5 h-3.5" />} />
                </div>
                <button
                  onClick={() => imprimir(demosAtivas)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir Todos
                </button>
                {view === 'pendentes' && (
                  <>
                    <button
                      onClick={() => setAssinarTodosDialog({ campo: 'diretoriaComercial', senha: '', loading: false, erro: null })}
                      className="flex items-center gap-1.5 px-3 py-2 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800 transition-colors"
                    >
                      <PenLine className="w-3.5 h-3.5" /> Assinar Todos
                    </button>
                    <button
                      onClick={pagarTodosGlobal}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Pagar Todos
                    </button>
                  </>
                )}
                <button onClick={onClose} className="p-2 text-indigo-300 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Seletor de mês (view pagas) ── */}
          {view === 'pagas' && mesesDisponiveis.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-medium">Mês pago:</span>
              {mesesDisponiveis.map(mes => {
                const [y, m] = mes.split('-');
                const label = new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
                return (
                  <button
                    key={mes}
                    onClick={() => setMesFiltro(mes)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${mesFiltro === mes ? 'bg-indigo-700 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-700'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Empty states ── */}
          {view === 'pendentes' && demonstrativos.length === 0 && (
            <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-10 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="font-bold text-slate-700 text-lg mb-1">Nenhuma comissão pendente</p>
              <p className="text-slate-500 text-sm">Todas as comissões elegíveis já foram pagas.</p>
            </div>
          )}
          {view === 'pagas' && demonstrativosPagos.length === 0 && (
            <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-10 text-center">
              <History className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="font-bold text-slate-700 text-lg mb-1">Nenhum demonstrativo pago</p>
              <p className="text-slate-500 text-sm">
                {mesesDisponiveis.length === 0 ? 'Nenhuma comissão foi paga ainda.' : 'Selecione um mês acima.'}
              </p>
            </div>
          )}

          {/* ── Cards dos demonstrativos ── */}
          {demosAtivas.length > 0 && (
            <div ref={printRef} className="space-y-4">
              {demosAtivas.map(demo => (
                <div key={demo.pessoa} className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">

                  {/* Faixa empresa/departamento */}
                  <div className="flex items-center justify-between px-6 py-2 border-b border-slate-100 bg-slate-50">
                    <span className="text-[11px] font-bold text-indigo-950 tracking-wide">Sorana Audi</span>
                    <span className="text-[11px] font-semibold text-indigo-600">Departamento: Oficina</span>
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
                        {view === 'pendentes' && (
                          <button
                            onClick={() => pagarTodos(demo)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Pagar Todas
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tabela */}
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
                          {view === 'pendentes' && (
                            <th className="text-white text-center px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Pagar</th>
                          )}
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
                                {e.role === 'vendedor' ? 'Vendedor' : 'Serviço'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-slate-600">
                              {fmtBRL(e.valorVenda)}
                              {e.pctLucroBruto !== null && (
                                <div className="text-[9px] text-slate-400 font-sans font-normal mt-0.5">LB: {e.pctLucroBruto.toFixed(1)}%</div>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-mono font-semibold text-indigo-700">{fmtBRL(e.comissao)}</td>
                            {view === 'pendentes' && (
                              <td className="px-4 py-2 text-center">
                                <button
                                  onClick={() => pagarEntry(e)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold transition-colors"
                                >
                                  Pagar
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-indigo-200 bg-indigo-50">
                          <td colSpan={view === 'pendentes' ? 5 : 5} className="px-4 py-2.5 font-bold text-indigo-900 text-[11px] uppercase tracking-wide">Total</td>
                          <td className="px-4 py-2.5 text-right font-bold font-mono text-indigo-900 text-sm">{fmtBRL(demo.totalComissao)}</td>
                          {view === 'pendentes' && <td />}
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Assinaturas */}
                  <div className="px-6 py-5 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Assinaturas</p>
                    <div className="grid grid-cols-3 gap-3">
                      {CAMPOS.map(([campo, label]) => {
                        const ass = assinaturas[demo.pessoa]?.[campo];
                        return (
                          <div key={campo} className="flex flex-col gap-1.5">
                            <p className="text-xs text-slate-500 font-medium">{label}</p>
                            {ass ? (
                              <div className="border border-emerald-200 rounded-lg px-3 py-2.5 bg-emerald-50 flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                  <div className="flex flex-col">
                                    {ass.name && ass.name !== ass.username && (
                                      <span className="text-sm font-bold text-emerald-900">{ass.name}</span>
                                    )}
                                    <span className="text-xs text-emerald-700">{ass.username}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-emerald-600">{new Date(ass.dataHora).toLocaleString('pt-BR')}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <ShieldCheck className="w-3 h-3 text-emerald-700" />
                                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Assinatura Eletrônica</p>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAssinaDialog({ pessoa: demo.pessoa, campo, senha: '', loading: false, erro: null })}
                                className="border-2 border-dashed border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50 transition-colors flex items-center gap-2 justify-center"
                              >
                                <PenLine className="w-4 h-4" /> Assinar
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>

    {/* ── Dialog: Assinar individual ── */}
    {assinaDialog && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-800">Assinar — {CAMPO_LABELS[assinaDialog.campo]}</p>
            <button onClick={() => setAssinaDialog(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-slate-500 mb-1">{assinaDialog.pessoa}</p>
          <p className="text-xs text-slate-400 mb-3">Confirme sua identidade digitando sua senha:</p>
          <input
            type="password" autoFocus
            placeholder="Sua senha"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={assinaDialog.senha}
            onChange={e => setAssinaDialog(prev => prev ? { ...prev, senha: e.target.value, erro: null } : prev)}
            onKeyDown={e => e.key === 'Enter' && !assinaDialog.loading && handleConfirmarAssinatura()}
          />
          {assinaDialog.erro && <p className="text-xs text-red-500 mt-1">{assinaDialog.erro}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={() => setAssinaDialog(null)} className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors">Cancelar</button>
            <button
              onClick={handleConfirmarAssinatura}
              disabled={assinaDialog.loading || !assinaDialog.senha}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <PenLine className="w-3.5 h-3.5" />
              {assinaDialog.loading ? 'Assinando...' : 'Assinar'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Dialog: Assinar todos ── */}
    {assinarTodosDialog && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-800">Assinar todos os demonstrativos</p>
            <button onClick={() => setAssinarTodosDialog(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100"><X className="w-4 h-4" /></button>
          </div>
          <div className="mb-3">
            <label className="text-xs font-medium text-slate-600 block mb-1">Campo de assinatura:</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={assinarTodosDialog.campo}
              onChange={e => setAssinarTodosDialog(prev => prev ? { ...prev, campo: e.target.value as CampoAssinatura } : prev)}
            >
              {CAMPOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <p className="text-xs text-slate-400 mb-2">Confirme sua identidade digitando sua senha:</p>
          <input
            type="password" autoFocus
            placeholder="Sua senha"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={assinarTodosDialog.senha}
            onChange={e => setAssinarTodosDialog(prev => prev ? { ...prev, senha: e.target.value, erro: null } : prev)}
            onKeyDown={e => e.key === 'Enter' && !assinarTodosDialog.loading && handleAssinarTodos()}
          />
          {assinarTodosDialog.erro && <p className="text-xs text-red-500 mt-1">{assinarTodosDialog.erro}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={() => setAssinarTodosDialog(null)} className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors">Cancelar</button>
            <button
              onClick={handleAssinarTodos}
              disabled={assinarTodosDialog.loading || !assinarTodosDialog.senha}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <PenLine className="w-3.5 h-3.5" />
              {assinarTodosDialog.loading ? 'Assinando...' : 'Assinar'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
