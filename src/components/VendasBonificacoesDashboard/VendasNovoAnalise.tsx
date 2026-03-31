import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line, Cell, PieChart, Pie, LabelList,
} from 'recharts';
import { TrendingUp, TrendingDown, Download, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { loadVendasResultadoRows, type VendasResultadoRow } from './vendasResultadoStorage';
import { loadAliquotas, loadVendasDsr, type VendasDsrConfig } from './vendedoresRemuneracaoStorage';

// ─── Constantes ────────────────────────────────────────────────────────────────
const MS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#e879f9', '#34d399', '#fb7185'];
const PIE_COLS = ['#ef4444', '#f97316', '#f59e0b', '#8b5cf6', '#3b82f6'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function n(v?: string | null): number { return parseFloat(String(v ?? '').replace(',', '.')) || 0; }
function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }); }
function fmtBRLFull(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtPct(v: number, d = 1) { return v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'; }

function getYr(r: VendasResultadoRow): number {
  const d = r.dataVenda;
  if (!d) return 0;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[2];
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return +d.split('-')[0];
  return 0;
}
function getMo(r: VendasResultadoRow): number {
  const d = r.dataVenda;
  if (!d) return 0;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[1];
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return +d.split('-')[1];
  return 0;
}
function dsrFor(cfgs: VendasDsrConfig[], dateStr: string): number {
  let a = 0, m = 0;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) { a = +dateStr.split('/')[2]; m = +dateStr.split('/')[1]; }
  else if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) { a = +dateStr.split('-')[0]; m = +dateStr.split('-')[1]; }
  const c = cfgs.find(x => x.ano === a && x.mes === m);
  return c ? parseFloat(c.percentual) || 0 : 0;
}

// ─── Cálculo por linha (aba Novos) ────────────────────────────────────────────
interface RC {
  recLiq: number; lucroBruto: number; bonuses: number; lucroComBon: number;
  dsr: number; provisoes: number; encargos: number; resultado: number;
}
function calcNovos(r: VendasResultadoRow, aliqBon: number, dsrPct: number): RC {
  const recLiq = n(r.valorVenda) - n(r.impostos);
  const bv = n(r.bonusVarejo), bt = n(r.bonusTradeIn);
  const impBv = (bv + bt) * aliqBon / 100;
  const lb = recLiq - n(r.valorCusto) + bv + bt - impBv;
  const bon = n(r.bonusPIV) + n(r.bonusSIQ) + n(r.bonusPIVE) + n(r.bonusAdic1) + n(r.bonusAdic2) + n(r.bonusAdic3);
  const impBon = bon * aliqBon / 100;
  const lcb = lb + bon - impBon;
  const dsr = n(r.comissaoVenda) * dsrPct / 100;
  const base = n(r.comissaoVenda) + dsr;
  const prov = base * 7 / 36;
  const enc = (base + prov) * 0.358;
  const res = lcb + n(r.recBlindagem) + n(r.recFinanciamento) + n(r.recDespachante)
    - n(r.jurosEstoque) - n(r.ciDesconto) - n(r.cortesiaEmplacamento)
    - n(r.comissaoVenda) - dsr - prov - enc - n(r.outrasDespesas);
  return { recLiq, lucroBruto: lb, bonuses: bon, lucroComBon: lcb, dsr, provisoes: prov, encargos: enc, resultado: res };
}

// ─── Aggregador ───────────────────────────────────────────────────────────────
interface Agg {
  v07: number; netVol: number; recLiq: number; lb: number; bon: number; lcb: number;
  dsr: number; prov: number; enc: number; res: number; marg: number; ticket: number;
  juros: number; ci: number; cort: number; com: number; outras: number;
  blind: number; fin: number; desp: number; mediaDias: number;
}
function agg(rows: VendasResultadoRow[], aliqBon: number, dsrCfg: VendasDsrConfig[]): Agg | null {
  if (rows.length === 0) return null;
  const v07 = rows.filter(r => r.transacao === 'V07').length;
  const netVol = rows.length - v07;
  let recLiq = 0, lb = 0, bon = 0, lcb = 0, dsr = 0, prov = 0, enc = 0, res = 0;
  let juros = 0, ci = 0, cort = 0, com = 0, outras = 0, blind = 0, fin = 0, desp = 0;
  let diasSum = 0, diasCount = 0;
  for (const r of rows) {
    const d = dsrFor(dsrCfg, r.dataVenda);
    const c = calcNovos(r, aliqBon, d);
    recLiq += c.recLiq; lb += c.lucroBruto; bon += c.bonuses;
    lcb += c.lucroComBon; dsr += c.dsr; prov += c.provisoes;
    enc += c.encargos; res += c.resultado;
    juros += n(r.jurosEstoque); ci += n(r.ciDesconto); cort += n(r.cortesiaEmplacamento);
    com += n(r.comissaoVenda); outras += n(r.outrasDespesas);
    blind += n(r.recBlindagem); fin += n(r.recFinanciamento); desp += n(r.recDespachante);
    const dias = n(r.diasEstoque);
    if (dias > 0) { diasSum += dias; diasCount++; }
  }
  const marg = recLiq !== 0 ? res / recLiq * 100 : 0;
  const ticket = netVol > 0 ? res / netVol : 0;
  const mediaDias = diasCount > 0 ? diasSum / diasCount : 0;
  return { v07, netVol, recLiq, lb, bon, lcb, dsr, prov, enc, res, marg, ticket, juros, ci, cort, com, outras, blind, fin, desp, mediaDias };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ST({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{children}</h2>;
}

function KpiCard({ label, value, sub, color = 'text-slate-800', accent, hero, onClick, pinned }: {
  label: string; value: string; sub?: string; color?: string; accent?: string;
  hero?: boolean; onClick?: () => void; pinned?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-xl border shadow-sm flex flex-col gap-1 relative group select-none ${
        hero
          ? 'px-5 py-5 border-slate-200'
          : 'px-3 py-3 border-slate-200 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all duration-150'
      }`}
      style={accent ? { borderLeft: `4px solid ${accent}` } : undefined}
      onClick={onClick}
      title={onClick ? (pinned ? 'Remover do destaque' : 'Fixar como destaque') : undefined}
    >
      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide leading-tight">{label}</span>
      <span className={`font-bold leading-tight truncate ${color} ${hero ? 'text-2xl' : 'text-lg'}`}>{value}</span>
      {sub && <span className="text-[11px] text-slate-400 leading-tight">{sub}</span>}
      {onClick && (
        <span className={`absolute top-2 right-2 text-sm transition-colors ${
          pinned ? 'text-blue-500' : 'text-slate-200 group-hover:text-blue-300'
        }`}>★</span>
      )}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-slate-200">
      <TrendingUp className="w-8 h-8 mb-2" />
      <span className="text-xs">Sem dados</span>
    </div>
  );
}

function WfTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: { value: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.payload?.value ?? 0;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      <p className={`font-mono font-bold ${v >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtBRLFull(v)}</p>
    </div>
  );
}
function MthTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono">{p.name}: {fmtBRLFull(p.value)}</p>
      ))}
    </div>
  );
}
function BonTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => p.value !== 0 && (
        <p key={i} style={{ color: p.color }} className="font-mono">{p.name}: {fmtBRLFull(p.value)}</p>
      ))}
      {total !== 0 && <p className="font-mono font-bold text-slate-700 mt-1 pt-1 border-t border-slate-100">Total: {fmtBRLFull(total)}</p>}
    </div>
  );
}

// ─── Export Excel ──────────────────────────────────────────────────────────────
async function exportAnalyticsExcel(
  vendorData: { name: string; vol: number; res: number; marg: number; ticket: number; recLiq: number }[],
  monthlyData: { label: string; recLiq: number; lb: number; lcb: number; res: number; marg: number; vol: number }[],
  periodLabel: string,
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();

  // Sheet 1: Vendedores
  const ws1 = wb.addWorksheet('Vendedores', { properties: { tabColor: { argb: 'FF3B82F6' } } });
  const h1 = ws1.addRow([`Análise Novos — ${periodLabel} — Ranking de Vendedores`]);
  ws1.mergeCells(1, 1, 1, 6);
  h1.height = 28; h1.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }; c.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 }; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
  const h2 = ws1.addRow(['Vendedor', 'Volume Líq.', 'Resultado (R$)', 'Margem %', 'Ticket Médio (R$)', 'Receita Líq. (R$)']);
  h2.height = 28; h2.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; c.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
  ws1.columns = [{ width: 28 }, { width: 14 }, { width: 18 }, { width: 12 }, { width: 18 }, { width: 18 }];
  vendorData.forEach((v, i) => {
    const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF0F9FF';
    const dr = ws1.addRow([v.name, v.vol, v.res, v.marg, v.ticket, v.recLiq]);
    dr.height = 17;
    dr.eachCell({ includeEmpty: true }, (cell, ci) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      if (ci === 3 || ci === 5 || ci === 6) { cell.numFmt = '"R$"\\ #,##0.00'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.font = { size: 9.5, name: 'Courier New' }; }
      else if (ci === 4) { cell.numFmt = '#,##0.00"%"'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
      else { cell.alignment = { horizontal: ci === 1 ? 'left' : 'center', vertical: 'middle' }; cell.font = { size: 9.5 }; }
    });
  });

  // Sheet 2: Evolução Mensal
  const ws2 = wb.addWorksheet('Evolução Mensal', { properties: { tabColor: { argb: 'FF10B981' } } });
  const h3 = ws2.addRow([`Análise Novos — ${periodLabel} — Evolução Mensal`]);
  ws2.mergeCells(1, 1, 1, 7);
  h3.height = 28; h3.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }; c.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 }; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
  const h4 = ws2.addRow(['Mês', 'Volume Líq.', 'Receita Líq. (R$)', 'Lucro Bruto (R$)', 'Lucro c/ Bôn. (R$)', 'Resultado (R$)', 'Margem %']);
  h4.height = 28; h4.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; c.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
  ws2.columns = [{ width: 10 }, { width: 12 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 12 }];
  monthlyData.forEach((m, i) => {
    const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF0FDF4';
    const dr = ws2.addRow([m.label, m.vol, m.recLiq, m.lb, m.lcb, m.res, m.marg]);
    dr.height = 17;
    dr.eachCell({ includeEmpty: true }, (cell, ci) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      if ([3, 4, 5, 6].includes(ci)) { cell.numFmt = '"R$"\\ #,##0.00'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.font = { size: 9.5, name: 'Courier New' }; }
      else if (ci === 7) { cell.numFmt = '#,##0.00"%"'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
      else { cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.font = { size: 9.5 }; }
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().split('T')[0];
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `analise-novos-${periodLabel.toLowerCase().replace(/\//g, '-')}-${date}.xlsx`);
}

// ─── Main component ────────────────────────────────────────────────────────────
export function VendasNovoAnalise() {
  const today = new Date();
  const curYear = today.getFullYear();
  const curMonth = today.getMonth() + 1;

  const [allRows, setAllRows] = useState<VendasResultadoRow[]>([]);
  const [aliqBon, setAliqBon] = useState(0);
  const [dsrCfg, setDsrCfg] = useState<VendasDsrConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [year, setYear] = useState(curYear);
  const [month, setMonth] = useState<number | null>(curMonth);
  const [vendedor, setVendedor] = useState('Todos');
  const [modelo, setModelo] = useState('Todos');

  // UI
  const [showDevol, setShowDevol] = useState(false);
  const [pinned, setPinned] = useState<string[]>(['resultado', 'margemRes', 'volumeLiq']);

  useEffect(() => {
    Promise.all([loadVendasResultadoRows('novos'), loadAliquotas(), loadVendasDsr()])
      .then(([rows, aliq, dsr]) => {
        setAllRows(rows);
        setAliqBon(aliq.filter(i => i.tipo.toLowerCase().includes('bonificações')).reduce((s, i) => s + (parseFloat(i.aliquota) || 0), 0));
        setDsrCfg(dsr);
        setLoading(false);
      });
  }, []);

  const availableYears = useMemo(() => {
    const s = new Set(allRows.map(getYr).filter(y => y > 2000));
    [curYear - 1, curYear].forEach(y => s.add(y));
    return [...s].sort();
  }, [allRows]);

  const yearRows = useMemo(() => allRows.filter(r => getYr(r) === year), [allRows, year]);

  const availableVendedores = useMemo(() => {
    const names = [...new Set(yearRows.map(r => r.vendedor?.trim()).filter(Boolean) as string[])].sort();
    return ['Todos', ...names];
  }, [yearRows]);

  const availableModelos = useMemo(() => {
    const mods = [...new Set(yearRows.map(r => r.modelo?.trim()).filter(Boolean) as string[])].sort();
    return ['Todos', ...mods];
  }, [yearRows]);

  const filteredRows = useMemo(() => yearRows.filter(r => {
    if (month !== null && getMo(r) !== month) return false;
    if (vendedor !== 'Todos' && (r.vendedor?.trim() || '') !== vendedor) return false;
    if (modelo !== 'Todos' && (r.modelo?.trim() || '') !== modelo) return false;
    return true;
  }), [yearRows, month, vendedor, modelo]);

  const devolucoes = useMemo(() => filteredRows.filter(r => r.transacao === 'V07'), [filteredRows]);

  const metrics = useMemo(() => agg(filteredRows, aliqBon, dsrCfg), [filteredRows, aliqBon, dsrCfg]);

  // MoM: métricas do mês anterior (para comparação no KPI)
  const prevMetrics = useMemo(() => {
    if (month === null) return null;
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    const prev = allRows.filter(r => getYr(r) === py && getMo(r) === pm);
    return agg(prev, aliqBon, dsrCfg);
  }, [allRows, month, year, aliqBon, dsrCfg]);

  // Dados mensais do ano (todos os 12 meses)
  const monthlyData = useMemo(() => MS.map((label, i) => {
    const m = i + 1;
    const mRows = yearRows.filter(r => getMo(r) === m);
    const a = agg(mRows, aliqBon, dsrCfg);
    return { label, recLiq: a?.recLiq ?? 0, lb: a?.lb ?? 0, lcb: a?.lcb ?? 0, res: a?.res ?? 0, marg: a?.marg ?? 0, vol: a?.netVol ?? 0 };
  }), [yearRows, aliqBon, dsrCfg]);

  // Por vendedor
  const vendorData = useMemo(() => {
    const map = new Map<string, VendasResultadoRow[]>();
    for (const r of filteredRows) {
      const v = r.vendedor?.trim() || '(sem nome)';
      const arr = map.get(v) ?? [];
      arr.push(r);
      map.set(v, arr);
    }
    const items: { name: string; vol: number; res: number; marg: number; ticket: number; recLiq: number }[] = [];
    for (const [name, rows] of map.entries()) {
      const a = agg(rows, aliqBon, dsrCfg);
      if (!a) continue;
      items.push({ name, vol: a.netVol, res: a.res, marg: a.marg, ticket: a.ticket, recLiq: a.recLiq });
    }
    return items.sort((a, b) => b.res - a.res);
  }, [filteredRows, aliqBon, dsrCfg]);

  // Por modelo (top 10)
  const modelData = useMemo(() => {
    const map = new Map<string, VendasResultadoRow[]>();
    for (const r of filteredRows) {
      const k = r.modelo?.trim() || '(sem modelo)';
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    }
    const items: { name: string; vol: number; res: number; marg: number }[] = [];
    for (const [rawName, rows] of map.entries()) {
      const a = agg(rows, aliqBon, dsrCfg);
      if (!a) continue;
      const name = rawName.length > 22 ? rawName.slice(0, 20) + '…' : rawName;
      items.push({ name, vol: a.netVol, res: a.res, marg: a.marg });
    }
    return items.sort((a, b) => b.res - a.res).slice(0, 10);
  }, [filteredRows, aliqBon, dsrCfg]);

  // Composição de bônus por mês (stacked bar — ano inteiro)
  const bonusMonthly = useMemo(() => MS.map((label, i) => {
    const m = i + 1;
    const mRows = yearRows.filter(r => getMo(r) === m);
    return {
      label,
      piv:    mRows.reduce((s, r) => s + n(r.bonusPIV), 0),
      siq:    mRows.reduce((s, r) => s + n(r.bonusSIQ), 0),
      pive:   mRows.reduce((s, r) => s + n(r.bonusPIVE), 0),
      varejo: mRows.reduce((s, r) => s + n(r.bonusVarejo), 0),
      tradein:mRows.reduce((s, r) => s + n(r.bonusTradeIn), 0),
      adics:  mRows.reduce((s, r) => s + n(r.bonusAdic1) + n(r.bonusAdic2) + n(r.bonusAdic3), 0),
    };
  }), [yearRows]);

  // Waterfall (decomposição do resultado)
  const waterfallData = useMemo(() => {
    if (!metrics) return [];
    const steps: { name: string; base: number; bar: number; value: number; type: 'pos' | 'neg' | 'total' }[] = [];
    let run = 0;
    const add = (name: string, value: number, type: 'pos' | 'neg' | 'total') => {
      const bar = Math.abs(value);
      const base = type === 'total' ? 0 : (value >= 0 ? run : run + value);
      steps.push({ name, base, bar, value, type });
      if (type !== 'total') run += value;
    };
    add('Lucro c/ Bônus', metrics.lcb, 'pos');
    const recExt = metrics.blind + metrics.fin + metrics.desp;
    if (recExt > 0) add('Rec. Extras', recExt, 'pos');
    if (metrics.juros > 0) add('Juros Estoque', -metrics.juros, 'neg');
    if (metrics.ci + metrics.cort > 0) add('CI / Cortesias', -(metrics.ci + metrics.cort), 'neg');
    const comTotal = metrics.com + metrics.dsr + metrics.prov + metrics.enc;
    if (comTotal > 0) add('Comissões + Enc.', -comTotal, 'neg');
    if (metrics.outras > 0) add('Outras Desp.', -metrics.outras, 'neg');
    add('Resultado', metrics.res, 'total');
    return steps;
  }, [metrics]);

  // Custos (pie)
  const costData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Comissão + DSR + Enc.', value: metrics.com + metrics.dsr + metrics.prov + metrics.enc },
      { name: 'Juros de Estoque',      value: metrics.juros },
      { name: 'CI Desc + Cortesias',   value: metrics.ci + metrics.cort },
      { name: 'Outras Despesas',       value: metrics.outras },
    ].filter(d => d.value > 0);
  }, [metrics]);

  // KPI definitions (array completo)
  const kpiDefs = useMemo(() => {
    if (!metrics) return [];
    const momRes = prevMetrics ? metrics.res - prevMetrics.res : null;
    const momVol = prevMetrics ? metrics.netVol - prevMetrics.netVol : null;
    return [
      {
        id: 'volumeLiq', label: 'Volume Líquido',
        value: String(metrics.netVol),
        sub: metrics.v07 > 0
          ? `${metrics.v07} devolução(ões) — ${momVol !== null ? (momVol >= 0 ? `+${momVol}` : String(momVol)) + ' vs mês ant.' : ''}`
          : momVol !== null ? `${momVol >= 0 ? '+' : ''}${momVol} vs mês ant.` : undefined,
        color: 'text-blue-700', accent: '#3b82f6',
      },
      {
        id: 'recLiq', label: 'Receita Líquida',
        value: fmtBRL(metrics.recLiq),
        sub: metrics.netVol > 0 ? `Ticket: ${fmtBRL(metrics.recLiq / metrics.netVol)}` : undefined,
        color: 'text-slate-800', accent: '#64748b',
      },
      {
        id: 'resultado', label: 'Resultado Total',
        value: fmtBRL(metrics.res),
        sub: momRes !== null ? `${momRes >= 0 ? '+' : ''}${fmtBRL(momRes)} vs mês ant.` : undefined,
        color: metrics.res >= 0 ? 'text-emerald-700' : 'text-red-600',
        accent: metrics.res >= 0 ? '#10b981' : '#ef4444',
      },
      {
        id: 'margemRes', label: 'Margem Resultado %',
        value: fmtPct(metrics.marg),
        sub: 'sobre Receita Líquida',
        color: metrics.marg >= 2 ? 'text-emerald-700' : metrics.marg >= 0 ? 'text-amber-600' : 'text-red-600',
        accent: metrics.marg >= 2 ? '#10b981' : metrics.marg >= 0 ? '#f59e0b' : '#ef4444',
      },
      {
        id: 'lucroComBon', label: 'Lucro c/ Bônus',
        value: fmtBRL(metrics.lcb),
        sub: metrics.recLiq > 0 ? fmtPct(metrics.lcb / metrics.recLiq * 100) + ' da receita' : undefined,
        color: 'text-indigo-700', accent: '#6366f1',
      },
      {
        id: 'totalBon', label: 'Total de Bônus',
        value: fmtBRL(metrics.bon),
        sub: metrics.recLiq > 0 ? fmtPct(metrics.bon / metrics.recLiq * 100) + ' da receita' : undefined,
        color: 'text-amber-700', accent: '#f59e0b',
      },
      {
        id: 'ticket', label: 'Ticket Médio (Resultado)',
        value: metrics.netVol > 0 ? fmtBRL(metrics.res / metrics.netVol) : '—',
        color: 'text-violet-700', accent: '#8b5cf6',
      },
      {
        id: 'juros', label: 'Juros de Estoque',
        value: fmtBRL(metrics.juros),
        sub: metrics.recLiq > 0 && metrics.juros > 0 ? fmtPct(metrics.juros / metrics.recLiq * 100) + ' da receita' : undefined,
        color: metrics.juros > metrics.recLiq * 0.02 ? 'text-red-600' : 'text-slate-500',
        accent: '#ef4444',
      },
      {
        id: 'mediaDias', label: 'Giro Médio (dias em estoque)',
        value: metrics.mediaDias > 0 ? metrics.mediaDias.toFixed(0) + ' dias' : '—',
        sub: 'tempo médio até a venda',
        color: metrics.mediaDias > 60 ? 'text-red-600' : metrics.mediaDias > 30 ? 'text-amber-600' : 'text-emerald-700',
        accent: '#06b6d4',
      },
    ];
  }, [metrics, prevMetrics]);

  const heroKpis = kpiDefs.filter(k => pinned.includes(k.id));
  const secKpis  = kpiDefs.filter(k => !pinned.includes(k.id));

  function togglePin(id: string) {
    if (pinned.includes(id)) {
      setPinned(p => p.filter(x => x !== id));
    } else if (pinned.length < 3) {
      setPinned(p => [...p, id]);
    } else {
      setPinned(p => [...p.slice(1), id]); // substitui o mais antigo
    }
  }

  // Margem média do grupo (para ranking de vendedores)
  const avgMarg = vendorData.length > 0 ? vendorData.reduce((s, v) => s + v.marg, 0) / vendorData.length : 0;

  const periodLabel = month !== null ? `${MS[month - 1]}/${year}` : String(year);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-5" style={{ minHeight: 0 }}>

      {/* ── Barra de Filtros ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex flex-wrap gap-4 items-center">

        {/* Anos */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-slate-400 font-semibold mr-1">Ano</span>
          {availableYears.map(y => (
            <button
              key={y}
              onClick={() => { setYear(y); setMonth(null); }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                year === y ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >{y}</button>
          ))}
        </div>

        <div className="w-px h-6 bg-slate-200 flex-shrink-0" />

        {/* Meses */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setMonth(null)}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
              month === null ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >Todos</button>
          {MS.map((m, i) => {
            const mi = i + 1;
            const count = yearRows.filter(r => getMo(r) === mi).length;
            return (
              <button
                key={mi}
                onClick={() => setMonth(month === mi ? null : mi)}
                className={`w-9 h-9 rounded-full text-[11px] font-semibold transition-colors relative ${
                  month === mi ? 'bg-blue-600 text-white shadow-md' : count > 0 ? 'bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-700' : 'bg-slate-50 text-slate-300'
                }`}
              >
                {m}
                {count > 0 && month !== mi && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-400 text-white text-[8px] rounded-full flex items-center justify-center font-bold">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="w-px h-6 bg-slate-200 flex-shrink-0" />

        {/* Vendedor + Modelo */}
        <div className="flex items-center gap-2">
          <select
            value={vendedor}
            onChange={e => setVendedor(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {availableVendedores.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select
            value={modelo}
            onChange={e => setModelo(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {availableModelos.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {(vendedor !== 'Todos' || modelo !== 'Todos') && (
            <button
              onClick={() => { setVendedor('Todos'); setModelo('Todos'); }}
              className="text-[11px] text-slate-400 hover:text-red-400 transition-colors"
            >✕ limpar</button>
          )}
        </div>

        {/* Export */}
        <div className="ml-auto">
          <button
            onClick={() => exportAnalyticsExcel(vendorData, monthlyData, periodLabel)}
            disabled={!metrics}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-64 text-slate-300">
          <div className="flex flex-col items-center gap-3">
            <TrendingUp className="w-10 h-10 animate-pulse" />
            <span className="text-sm">Carregando dados...</span>
          </div>
        </div>
      )}

      {/* ── Sem dados ────────────────────────────────────────────────────────── */}
      {!loading && !metrics && (
        <div className="flex items-center justify-center h-64 text-slate-300">
          <div className="flex flex-col items-center gap-3">
            <TrendingUp className="w-10 h-10" />
            <span className="text-sm font-medium">Sem dados para {periodLabel}</span>
            <span className="text-xs text-slate-400">Registros aparecerão aqui ao serem cadastrados na aba Vendas → Vendas Veículos Novos</span>
          </div>
        </div>
      )}

      {!loading && metrics && (
        <>
          {/* ── KPIs Hero ──────────────────────────────────────────────────── */}
          {heroKpis.length > 0 && (
            <div className={`grid gap-4 ${heroKpis.length === 1 ? 'grid-cols-1' : heroKpis.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {heroKpis.map(k => (
                <KpiCard key={k.id} {...k} hero pinned onClick={() => togglePin(k.id)} />
              ))}
            </div>
          )}

          {/* ── KPIs Secundários ───────────────────────────────────────────── */}
          {secKpis.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {secKpis.map(k => (
                <KpiCard key={k.id} {...k} onClick={() => togglePin(k.id)} />
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-400 text-right -mt-3">★ clique em qualquer card para fixar como destaque</p>

          {/* ── Waterfall + Evolução Mensal ────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Waterfall */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <ST>Decomposição do Resultado — {periodLabel}</ST>
              {waterfallData.length === 0 ? <EmptyChart /> : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={waterfallData} margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9.5 }} />
                      <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 9 }} width={90} />
                      <Tooltip content={<WfTooltip />} />
                      <Bar dataKey="base" stackId="s" fill="transparent" legendType="none" isAnimationActive={false} />
                      <Bar dataKey="bar" stackId="s" radius={[4, 4, 0, 0]}>
                        {waterfallData.map((e, i) => (
                          <Cell key={i} fill={e.type === 'total' ? '#3b82f6' : e.type === 'pos' ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex gap-5 justify-center mt-3 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Positivo</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Dedução</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />Resultado Final</span>
                  </div>
                </>
              )}
            </div>

            {/* Evolução Mensal */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <ST>Evolução Mensal — {year}</ST>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={monthlyData} margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 9 }} width={90} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={v => v.toFixed(1) + '%'} tick={{ fontSize: 9 }} width={42} />
                  <Tooltip content={<MthTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="lcb" name="Lucro c/ Bônus" radius={[3, 3, 0, 0]}>
                    {monthlyData.map((_, i) => (
                      <Cell key={i} fill="#6366f1" opacity={month !== null && month !== i + 1 ? 0.4 : 1} />
                    ))}
                  </Bar>
                  <Bar yAxisId="left" dataKey="res" name="Resultado" radius={[3, 3, 0, 0]}>
                    {monthlyData.map((d, i) => (
                      <Cell key={i} fill={d.res < 0 ? '#ef4444' : '#3b82f6'} opacity={month !== null && month !== i + 1 ? 0.4 : 1} />
                    ))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="marg" name="Margem %" stroke="#f59e0b" dot={{ r: 3 }} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Ranking de Vendedores + Mix por Modelo ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Ranking vendedores */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <ST>Ranking de Vendedores — {periodLabel}</ST>
              {vendorData.length === 0 ? <EmptyChart /> : (
                <div className="space-y-2">
                  {vendorData.map((v, i) => {
                    const bestRes = Math.max(...vendorData.map(x => x.res), 1);
                    const barPct = bestRes > 0 ? Math.max(0, (v.res / bestRes) * 100) : 0;
                    const aboveAvg = v.marg >= avgMarg;
                    const isTop = i === 0;
                    const medals = ['🥇', '🥈', '🥉'];
                    return (
                      <div key={v.name} className={`rounded-lg border p-3 transition-colors ${isTop ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            i < 3 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {i < 3 ? medals[i] : i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-sm font-semibold text-slate-700 truncate">{v.name}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-[10px] text-slate-400">{v.vol} vend.</span>
                                <span className={`text-sm font-bold font-mono ${v.res >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtBRL(v.res)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${barPct}%` }} />
                              </div>
                              <span className={`text-[10px] font-bold flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
                                aboveAvg ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                              }`}>
                                {aboveAvg ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                {fmtPct(v.marg)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-slate-400 text-right pt-1">
                    ▲▼ vs média do grupo — margem média: <span className="font-semibold">{fmtPct(avgMarg)}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Mix por modelo */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <ST>Mix por Modelo — Resultado (Top 10)</ST>
              {modelData.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={modelData} layout="vertical" margin={{ left: 4, right: 65, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 9 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9.5 }} width={85} />
                    <Tooltip formatter={(v: number) => [fmtBRLFull(v), 'Resultado']} />
                    <Bar dataKey="res" name="Resultado" radius={[0, 4, 4, 0]}>
                      {modelData.map((d, i) => (
                        <Cell key={i} fill={d.res < 0 ? '#ef4444' : PALETTE[i % PALETTE.length]} />
                      ))}
                      <LabelList dataKey="marg" position="right" formatter={(v: number) => fmtPct(v)} style={{ fontSize: 9.5, fill: '#64748b' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Composição de Bônus por Mês ────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <ST>Composição de Bônus por Mês — {year}</ST>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bonusMonthly} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 9 }} width={90} />
                <Tooltip content={<BonTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="piv"     name="PIV"       stackId="b" fill="#3b82f6" />
                <Bar dataKey="siq"     name="SIQ"       stackId="b" fill="#6366f1" />
                <Bar dataKey="pive"    name="PIVE"      stackId="b" fill="#8b5cf6" />
                <Bar dataKey="varejo"  name="Varejo"    stackId="b" fill="#f59e0b" />
                <Bar dataKey="tradein" name="Trade IN"  stackId="b" fill="#f97316" />
                <Bar dataKey="adics"   name="Adicionais"stackId="b" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Análise de Custos e Despesas ───────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <ST>Análise de Custos e Despesas — {periodLabel}</ST>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Pie */}
              <div className="flex flex-col items-center">
                {costData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={costData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                          {costData.map((_, i) => <Cell key={i} fill={PIE_COLS[i % PIE_COLS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtBRLFull(v)} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </>
                ) : <EmptyChart />}
              </div>

              {/* Tabela detalhada */}
              <div className="space-y-3 flex flex-col justify-center">
                {[
                  { label: 'Comissão + DSR + Provisões + Encargos', value: metrics.com + metrics.dsr + metrics.prov + metrics.enc, color: PIE_COLS[0], sub: 'pessoal de vendas' },
                  { label: 'Juros de Estoque',                       value: metrics.juros, color: PIE_COLS[1], sub: 'custo financeiro flooring' },
                  { label: 'CI Desconto + Cortesias',                value: metrics.ci + metrics.cort, color: PIE_COLS[2], sub: 'descontos e cortesias operacionais' },
                  { label: 'Outras Despesas',                        value: metrics.outras, color: PIE_COLS[3], sub: 'diversas' },
                ].map((item, i) => (
                  item.value > 0 && (
                    <div key={i} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-sm flex-shrink-0 mt-0.5" style={{ background: item.color }} />
                        <div>
                          <p className="text-sm text-slate-700 font-medium leading-tight">{item.label}</p>
                          <p className="text-[10px] text-slate-400">{item.sub}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold font-mono text-red-500">{fmtBRLFull(item.value)}</p>
                        {metrics.recLiq > 0 && <p className="text-[10px] text-slate-400">{fmtPct(item.value / metrics.recLiq * 100)} da receita</p>}
                      </div>
                    </div>
                  )
                ))}
                <div className="flex justify-between pt-1">
                  <span className="text-sm font-bold text-slate-700">Total de Deduções</span>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-red-600">
                      {fmtBRLFull(metrics.juros + metrics.ci + metrics.cort + metrics.com + metrics.dsr + metrics.prov + metrics.enc + metrics.outras)}
                    </span>
                    {metrics.recLiq > 0 && (
                      <p className="text-[10px] text-slate-400">
                        {fmtPct((metrics.juros + metrics.ci + metrics.cort + metrics.com + metrics.dsr + metrics.prov + metrics.enc + metrics.outras) / metrics.recLiq * 100)} da receita líquida
                      </p>
                    )}
                  </div>
                </div>
                {/* Receitas extras (blindagem, financiamento, despachante) */}
                {(metrics.blind + metrics.fin + metrics.desp) > 0 && (
                  <div className="flex justify-between pt-2 border-t border-slate-100">
                    <span className="text-sm text-emerald-700 font-medium">Receitas Extras (Blindagem + Fin. + Desp.)</span>
                    <span className="text-sm font-bold font-mono text-emerald-600">{fmtBRLFull(metrics.blind + metrics.fin + metrics.desp)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Devoluções V07 ─────────────────────────────────────────────── */}
          {devolucoes.length > 0 && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm">
              <button
                onClick={() => setShowDevol(!showDevol)}
                className="w-full flex items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span className="text-sm font-bold text-amber-800">
                    Devoluções (V07) — {devolucoes.length} registro(s) deduzido(s) do volume
                  </span>
                </div>
                {showDevol ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
              </button>
              {showDevol && (
                <div className="px-5 pb-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-amber-200">
                          <th className="text-left py-1.5 px-2 text-amber-700 font-semibold">Chassi</th>
                          <th className="text-left py-1.5 px-2 text-amber-700 font-semibold">Modelo</th>
                          <th className="text-left py-1.5 px-2 text-amber-700 font-semibold">Vendedor</th>
                          <th className="text-left py-1.5 px-2 text-amber-700 font-semibold">Data da Venda</th>
                          <th className="text-right py-1.5 px-2 text-amber-700 font-semibold">Valor de Venda</th>
                          <th className="text-right py-1.5 px-2 text-amber-700 font-semibold">Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {devolucoes.map(r => {
                          const d = dsrFor(dsrCfg, r.dataVenda);
                          const c = calcNovos(r, aliqBon, d);
                          return (
                            <tr key={r.id} className="border-b border-amber-100 hover:bg-amber-100/40">
                              <td className="py-1.5 px-2 font-mono text-slate-600">{r.chassi || '—'}</td>
                              <td className="py-1.5 px-2 text-slate-700">{r.modelo || '—'}</td>
                              <td className="py-1.5 px-2 text-slate-700">{r.vendedor || '—'}</td>
                              <td className="py-1.5 px-2 font-mono text-slate-500">{r.dataVenda || '—'}</td>
                              <td className="py-1.5 px-2 text-right font-mono text-slate-600">{fmtBRLFull(n(r.valorVenda))}</td>
                              <td className={`py-1.5 px-2 text-right font-mono font-semibold ${c.resultado < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmtBRLFull(c.resultado)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </>
      )}
    </div>
  );
}
