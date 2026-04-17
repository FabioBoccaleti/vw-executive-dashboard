import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import type { VPecasRow } from './vPecasStorage';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MS_ABBR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DEPT_LABEL: Record<string, string> = {
  '103': 'Peças',
  '104': 'Oficina',
  '106': 'Funilaria',
  '107': 'Acessórios',
};
const deptName = (code: string) => DEPT_LABEL[code] ?? code;

// Grupos de departamentos para o filtro
const DEPT_GROUPS: { label: string; depts: Set<string> }[] = [
  { label: 'Peças',      depts: new Set(['103', '108']) },
  { label: 'Oficina',    depts: new Set(['104', '122']) },
  { label: 'Funilaria',  depts: new Set(['106', '129']) },
  { label: 'Acessórios', depts: new Set(['107']) },
];

const TRANSACAO_LABEL: Record<string, string> = {
  'P21': 'V. Peças Balcão',
  'O21': 'V. Peças (Of / Fu / Ac)',
  'P24': 'V. Peças Rede VW',
  'P32': 'V. Peças Fora Est s/ST',
  'G21': 'V. Peças Garantia',
  'O26': 'V. Peças Interna (Of / Fu / Ac)',
  'P33': 'V. Peças Rede VW Fora Est',
  'P69': 'V. Peças Exportação',
  'P26': 'V. Peças Interna Balcão',
  'P31': 'V. Peças Fora do Estado',
};
const transacaoName = (code: string) => TRANSACAO_LABEL[code] ?? code;
const n = (v?: string | null) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtPct  = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

function getYr(row: VPecasRow): number {
  if (row.periodoImport) { const [y] = row.periodoImport.split('-').map(Number); if (y > 2000) return y; }
  const d = row.data['DTA_DOCUMENTO'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[2];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[0];
  return 0;
}
function getMo(row: VPecasRow): number {
  if (row.periodoImport) { const [,m] = row.periodoImport.split('-').map(Number); if (m >= 1 && m <= 12) return m; }
  const d = row.data['DTA_DOCUMENTO'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[1];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[1];
  return 0;
}

function calcPecas(d: Record<string, string>) {
  const valorVenda    = n(d['LIQ_NOTA_FISCAL']);
  const icms          = n(d['VAL_ICMS']);
  const pis           = n(d['VAL_PIS']);
  const cofins        = n(d['VAL_COFINS']);
  const difal         = n(d['VAL_ICMS_PARTIL_UF_DEST']) + n(d['VAL_ICMS_COMB_POBREZA']);
  const totalImpostos = icms + pis + cofins + difal;
  const recLiq        = valorVenda - totalImpostos;
  const custo         = n(d['TOT_CUSTO_MEDIO']);
  const lucroBruto    = recLiq - custo;
  const lbPct         = recLiq !== 0 ? (lucroBruto / recLiq) * 100 : 0;
  return { valorVenda, recLiq, lucroBruto, lbPct, nfs: 1 };
}

interface Agg { nfs: number; valorVenda: number; recLiq: number; lucroBruto: number; lbPct: number; }
function aggRows(rows: VPecasRow[]): Agg {
  let nfs = 0, valorVenda = 0, recLiq = 0, lucroBruto = 0;
  for (const r of rows) {
    const c = calcPecas(r.data);
    nfs++; valorVenda += c.valorVenda; recLiq += c.recLiq; lucroBruto += c.lucroBruto;
  }
  return { nfs, valorVenda, recLiq, lucroBruto, lbPct: recLiq !== 0 ? lucroBruto / recLiq * 100 : 0 };
}

// ─── Período (slot) ──────────────────────────────────────────────────────────
type PeriodMode = 'mes' | 'ano';
interface PeriodSlot { id: number; mode: PeriodMode; year: number; month: number; }

const PERIOD_COLORS = ['#7c3aed','#0891b2','#059669','#d97706'];
const PERIOD_NAMES  = ['P1','P2','P3','P4'];

function periodLabel(s: PeriodSlot) {
  return s.mode === 'ano' ? String(s.year) : `${MS_ABBR[s.month - 1]}/${s.year}`;
}

function filterPeriod(rows: VPecasRow[], slot: PeriodSlot): VPecasRow[] {
  return rows.filter(r => {
    if (getYr(r) !== slot.year) return false;
    if (slot.mode === 'mes' && getMo(r) !== slot.month) return false;
    return true;
  });
}

// ─── Delta ───────────────────────────────────────────────────────────────────
function delta(cur: number, ref: number): number | null {
  if (ref === 0) return null;
  return ((cur - ref) / Math.abs(ref)) * 100;
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-300 text-[10px]">—</span>;
  const up   = pct >= 0;
  const fmt  = (up ? '+' : '') + pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
      {up ? '▲' : '▼'} {fmt}
    </span>
  );
}

// ─── Célula de valor com margem colorida ─────────────────────────────────────
function MargemCell({ pct }: { pct: number }) {
  const cls = pct >= 20 ? 'bg-emerald-50 text-emerald-800 font-bold'
    : pct >= 10 ? 'bg-teal-50 text-teal-700 font-semibold'
    : pct >= 0  ? 'bg-yellow-50 text-yellow-700'
    : 'bg-rose-50 text-rose-700 font-bold';
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono ${cls}`}>
      {fmtPct(pct)}
    </span>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface Props { allRows: VPecasRow[]; }

// ─── Componente principal ─────────────────────────────────────────────────────
export default function VPecasComparativo({ allRows }: Props) {
  const curYear = new Date().getFullYear();
  const curMonth = new Date().getMonth() + 1;

  // anos disponíveis
  const availYears = useMemo(() => {
    const s = new Set(allRows.map(getYr).filter(y => y > 2000));
    [curYear - 1, curYear].forEach(y => s.add(y));
    return [...s].sort();
  }, [allRows, curYear]);

  // slots de período (até 4)
  const [slots, setSlots] = useState<PeriodSlot[]>([
    { id: 1, mode: 'mes', year: curYear, month: curMonth },
    { id: 2, mode: 'mes', year: curYear, month: curMonth === 1 ? 12 : curMonth - 1 },
  ]);
  const nextId = useMemo(() => Math.max(0, ...slots.map(s => s.id)) + 1, [slots]);

  function addSlot() {
    if (slots.length >= 4) return;
    setSlots(prev => [...prev, { id: nextId, mode: 'mes', year: curYear, month: curMonth }]);
  }
  function removeSlot(id: number) {
    setSlots(prev => prev.filter(s => s.id !== id));
  }
  function updateSlot(id: number, patch: Partial<PeriodSlot>) {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  // ─── filtro de departamento e visão ──────────────────────────────────────
  const [deptFilter, setDeptFilter] = useState('Todos');
  const [view, setView]             = useState<'transacao' | 'vendedor'>('transacao');
  const [collapsed, setCollapsed]   = useState(false);

  // grupos disponíveis (só os que têm dados)
  const availGroups = useMemo(() => {
    const allDepts = new Set(allRows.map(r => r.data['DEPARTAMENTO']?.trim() || ''));
    return DEPT_GROUPS.filter(g => [...g.depts].some(d => allDepts.has(d)));
  }, [allRows]);

  // depts do grupo selecionado
  const activeDepts = useMemo(() => {
    if (deptFilter === 'Todos') return null;
    return DEPT_GROUPS.find(g => g.label === deptFilter)?.depts ?? null;
  }, [deptFilter]);

  // linhas filtradas por grupo
  const baseRows = useMemo(() =>
    activeDepts === null
      ? allRows
      : allRows.filter(r => activeDepts.has(r.data['DEPARTAMENTO']?.trim() || ''))
  , [allRows, activeDepts]);

  // ─── dados por slot ───────────────────────────────────────────────────────
  const slotRows = useMemo(() =>
    slots.map(s => filterPeriod(baseRows, s))
  , [baseRows, slots]);

  // ─── chaves únicas (transações / vendedores) ──────────────────────────────
  const allKeys = useMemo(() => {
    const s = new Set<string>();
    for (const rows of slotRows) {
      for (const r of rows) {
        const k = view === 'transacao'
          ? (r.data['TIPO_TRANSACAO']?.trim() || '(sem tipo)')
          : (r.data['NOME_VENDEDOR']?.trim()  || '(sem vendedor)');
        s.add(k);
      }
    }
    return [...s].sort();
  }, [slotRows, view]);

  // ─── matriz de dados: { key => Agg[] por slot } ───────────────────────────
  const matrix = useMemo(() => {
    return allKeys.map(key => {
      const aggs = slotRows.map(rows => {
        const filtered = rows.filter(r => {
          const k = view === 'transacao'
            ? (r.data['TIPO_TRANSACAO']?.trim() || '(sem tipo)')
            : (r.data['NOME_VENDEDOR']?.trim()  || '(sem vendedor)');
          return k === key;
        });
        return aggRows(filtered);
      });
      return { key, aggs };
    }).sort((a, b) => (b.aggs[0]?.valorVenda ?? 0) - (a.aggs[0]?.valorVenda ?? 0));
  }, [allKeys, slotRows, view]);

  // ─── totais por slot ──────────────────────────────────────────────────────
  const totals = useMemo(() => slotRows.map(aggRows), [slotRows]);

  if (allRows.length === 0) return null;

  // ─── cabeçalhos de período ────────────────────────────────────────────────
  // colunas por slot: Rec Bruta | Rec Líq | Margem R$ | Margem %  (+ delta vs P1 para P2..P4)
  const COL_W = 'min-w-[90px]';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
      {/* ── Cabeçalho da seção ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
          Comparativo de Períodos
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          {collapsed ? 'Expandir' : 'Recolher'}
        </button>
      </div>

      {!collapsed && <>
        {/* ── Cards de período ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          {slots.map((slot, idx) => {
            const color = PERIOD_COLORS[idx];
            const nfs   = filterPeriod(baseRows, slot).length;
            return (
              <div key={slot.id} className="rounded-xl border-2 overflow-hidden shadow-sm transition-all"
                style={{ borderColor: color }}>
                {/* Header strip */}
                <div className="px-3 py-2.5 flex items-center justify-between"
                  style={{ background: color }}>
                  <span className="text-[12px] font-black uppercase tracking-widest text-white drop-shadow-sm">
                    {PERIOD_NAMES[idx]} — {periodLabel(slot)}
                  </span>
                  {slots.length > 1 && (
                    <button
                      onClick={() => removeSlot(slot.id)}
                      className="text-[11px] text-white/60 hover:text-white transition-colors"
                    >✕</button>
                  )}
                </div>
                {/* Body */}
                <div className="p-3 flex flex-col gap-2" style={{ background: color + '0d' }}>
                  {/* modo */}
                  <div className="flex gap-1">
                    {(['mes', 'ano'] as PeriodMode[]).map(m => (
                      <button key={m}
                        onClick={() => updateSlot(slot.id, { mode: m })}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                          slot.mode === m
                            ? 'text-white border-transparent'
                            : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                        }`}
                        style={slot.mode === m ? { background: color } : undefined}
                      >
                        {m === 'mes' ? 'Mês' : 'Ano'}
                      </button>
                    ))}
                  </div>
                  {/* ano */}
                  <div className="flex gap-1 flex-wrap">
                    {availYears.map(y => (
                      <button key={y}
                        onClick={() => updateSlot(slot.id, { year: y })}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          slot.year === y ? 'text-white' : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'
                        }`}
                        style={slot.year === y ? { background: color } : undefined}
                      >{y}</button>
                    ))}
                  </div>
                  {/* mês — só se mode === 'mes' */}
                  {slot.mode === 'mes' && (
                    <div className="flex flex-wrap gap-1">
                      {MS_ABBR.map((m, mi) => (
                        <button key={mi}
                          onClick={() => updateSlot(slot.id, { month: mi + 1 })}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                            slot.month === mi + 1 ? 'text-white' : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'
                          }`}
                          style={slot.month === mi + 1 ? { background: color } : undefined}
                        >{m}</button>
                      ))}
                    </div>
                  )}
                  {/* NFs */}
                  <span className="text-[10px] font-semibold" style={{ color }}>
                    {nfs.toLocaleString('pt-BR')} NFs
                  </span>
                </div>
              </div>
            );
          })}

          {/* Adicionar período */}
          {slots.length < 4 && (
            <button
              onClick={addSlot}
              className="rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1.5 py-6 text-[11px] font-bold text-slate-400 hover:border-violet-400 hover:text-violet-600 transition-colors min-h-[120px]"
            >
              <Plus className="w-5 h-5" />
              Adicionar período
            </button>
          )}
        </div>

        {/* ── Filtro de departamento ────────────────────────────────────── */}
        <div className="flex gap-1 flex-wrap mb-3">
          <button
            onClick={() => setDeptFilter('Todos')}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all border ${
              deptFilter === 'Todos'
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600'
            }`}
          >
            Todos
          </button>
          {availGroups.map(g => (
            <button
              key={g.label}
              onClick={() => setDeptFilter(g.label)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all border ${
                deptFilter === g.label
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* ── Abas de visão ─────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-4">
          <button
            onClick={() => setView('transacao')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all border ${
              view === 'transacao'
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600'
            }`}
          >
            Por Tipo de Transação
          </button>
          <button
            onClick={() => setView('vendedor')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all border ${
              view === 'vendedor'
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600'
            }`}
          >
            Por Vendedor
          </button>
        </div>

        {/* ── Tabela comparativa ────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              {/* linha 1 — rótulos dos períodos */}
              <tr className="border-b border-slate-200">
                <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide py-2 pr-3 min-w-[140px]">
                  {view === 'transacao' ? 'Transação' : 'Vendedor'}
                </th>
                {slots.map((slot, idx) => (
                  <th
                    key={slot.id}
                    colSpan={idx === 0 ? 4 : 5}
                    className="text-center text-[11px] font-black py-2 px-2 border-l border-slate-100"
                    style={{ color: PERIOD_COLORS[idx] }}
                  >
                    {PERIOD_NAMES[idx]} — {periodLabel(slot)}
                  </th>
                ))}
              </tr>
              {/* linha 2 — sub-cabeçalhos */}
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th />
                {slots.map((slot, idx) => (
                  <>
                    {idx > 0 && (
                      <th key={`${slot.id}-delta`} className={`text-right text-[9px] font-bold text-slate-400 uppercase tracking-wide py-1.5 px-2 border-l border-slate-100 ${COL_W}`}>
                        Δ vs P1
                      </th>
                    )}
                    <th key={`${slot.id}-rb`}  className={`text-right text-[9px] font-bold text-slate-400 uppercase tracking-wide py-1.5 px-2 ${idx === 0 ? 'border-l border-slate-100' : ''} ${COL_W}`}>Rec. Bruta</th>
                    <th key={`${slot.id}-rl`}  className={`text-right text-[9px] font-bold text-slate-400 uppercase tracking-wide py-1.5 px-2 ${COL_W}`}>Rec. Líq.</th>
                    <th key={`${slot.id}-mb`}  className={`text-right text-[9px] font-bold text-slate-400 uppercase tracking-wide py-1.5 px-2 ${COL_W}`}>Marg. R$</th>
                    <th key={`${slot.id}-mp`}  className={`text-right text-[9px] font-bold text-slate-400 uppercase tracking-wide py-1.5 px-2 ${COL_W}`}>Marg. %</th>
                  </>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map(({ key, aggs }, ri) => (
                <tr key={key} className={`border-b border-slate-50 hover:bg-violet-50/30 transition-colors ${ri % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                  <td className="py-1.5 pr-3 font-semibold text-slate-700 truncate max-w-[200px]">
                    {view === 'transacao' ? transacaoName(key) : key}
                  </td>
                  {slots.map((slot, idx) => {
                    const a   = aggs[idx];
                    const ref = aggs[0];
                    return (
                      <>
                        {idx > 0 && (
                          <td key={`${slot.id}-delta`} className="text-right py-1.5 px-2 border-l border-slate-100">
                            <DeltaBadge pct={delta(a.valorVenda, ref.valorVenda)} />
                          </td>
                        )}
                        <td key={`${slot.id}-rb`}  className={`text-right py-1.5 px-2 font-mono text-slate-700 ${idx === 0 ? 'border-l border-slate-100' : ''}`}>
                          {a.valorVenda !== 0 ? fmtBRL(a.valorVenda) : <span className="text-slate-200">—</span>}
                        </td>
                        <td key={`${slot.id}-rl`}  className="text-right py-1.5 px-2 font-mono text-slate-600">
                          {a.recLiq !== 0 ? fmtBRL(a.recLiq) : <span className="text-slate-200">—</span>}
                        </td>
                        <td key={`${slot.id}-mb`}  className={`text-right py-1.5 px-2 font-mono font-semibold ${a.lucroBruto >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {a.valorVenda !== 0 ? fmtBRL(a.lucroBruto) : <span className="text-slate-200">—</span>}
                        </td>
                        <td key={`${slot.id}-mp`}  className="text-right py-1.5 px-2">
                          {a.valorVenda !== 0 ? <MargemCell pct={a.lbPct} /> : <span className="text-slate-200 text-[11px]">—</span>}
                        </td>
                      </>
                    );
                  })}
                </tr>
              ))}

              {/* Linha de totais */}
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                <td className="py-2 pr-3 text-[11px] font-black text-slate-600 uppercase tracking-wide">Total Geral</td>
                {slots.map((slot, idx) => {
                  const t   = totals[idx];
                  const ref = totals[0];
                  return (
                    <>
                      {idx > 0 && (
                        <td key={`${slot.id}-delta`} className="text-right py-2 px-2 border-l border-slate-200">
                          <DeltaBadge pct={delta(t.valorVenda, ref.valorVenda)} />
                        </td>
                      )}
                      <td key={`${slot.id}-rb`}  className={`text-right py-2 px-2 font-mono font-bold text-slate-800 ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                        {fmtBRL(t.valorVenda)}
                      </td>
                      <td key={`${slot.id}-rl`}  className="text-right py-2 px-2 font-mono font-bold text-slate-700">
                        {fmtBRL(t.recLiq)}
                      </td>
                      <td key={`${slot.id}-mb`}  className={`text-right py-2 px-2 font-mono font-bold ${t.lucroBruto >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {fmtBRL(t.lucroBruto)}
                      </td>
                      <td key={`${slot.id}-mp`}  className="text-right py-2 px-2">
                        <MargemCell pct={t.lbPct} />
                      </td>
                    </>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </>}
    </div>
  );
}
