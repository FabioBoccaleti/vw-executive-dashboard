import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList, ComposedChart, Line,
} from 'recharts';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { type VendasRow } from './vendasStorage';
import { TrendingUp, TrendingDown, Minus, Plus, X, Check, Download } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
function fmtBRLFull(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}
function n(s: string): number { return parseFloat(s) || 0; }

function getRowYear(row: VendasRow): number {
  if (!row.dataVenda) return 0;
  return parseInt(row.dataVenda.split('-')[0]) || 0;
}
function getRowMonth(row: VendasRow): number {
  if (!row.dataVenda) return 0;
  return parseInt(row.dataVenda.split('-')[1]) || 0;
}

// Retorna os meses que fazem parte de um tipo de período
function periodMonths(tipo: PeriodType, value: number): number[] {
  if (tipo === 'mes') return [value];
  if (tipo === 'bimestre') { const s = (value - 1) * 2 + 1; return [s, s + 1]; }
  if (tipo === 'trimestre') { const s = (value - 1) * 3 + 1; return [s, s + 1, s + 2]; }
  if (tipo === 'semestre') { const s = (value - 1) * 6 + 1; return [s, s + 1, s + 2, s + 3, s + 4, s + 5]; }
  if (tipo === 'anual') return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  return [];
}

function periodLabel(tipo: PeriodType, value: number, year: number): string {
  if (tipo === 'mes') return `${MONTHS[value - 1]}/${String(year).slice(2)}`;
  if (tipo === 'bimestre') {
    const s = (value - 1) * 2 + 1;
    return `${MONTHS[s - 1]}-${MONTHS[s]}/${String(year).slice(2)}`;
  }
  if (tipo === 'trimestre') {
    const s = (value - 1) * 3 + 1;
    return `${MONTHS[s - 1]}-${MONTHS[s + 1]}/${String(year).slice(2)}`;
  }
  if (tipo === 'semestre') {
    return value === 1 ? `1º Sem/${String(year).slice(2)}` : `2º Sem/${String(year).slice(2)}`;
  }
  if (tipo === 'anual') return String(year);
  return '';
}

type PeriodType = 'mes' | 'bimestre' | 'trimestre' | 'semestre' | 'anual';
type BrandFilter = 'Todas' | 'VW' | 'Audi';

interface PeriodSlot { year: number; tipo: PeriodType; value: number; }

function filterRows(rows: VendasRow[], year: number, monthChip: number | null, blindadora: string): VendasRow[] {
  return rows.filter(r => {
    if (!r.dataVenda) return false;
    if (getRowYear(r) !== year) return false;
    if (monthChip !== null && getRowMonth(r) !== monthChip) return false;
    if (blindadora !== 'Todas' && r.blindadora !== blindadora) return false;
    return true;
  });
}

function filterByPeriod(rows: VendasRow[], slot: PeriodSlot, blindadora: string): VendasRow[] {
  const months = periodMonths(slot.tipo, slot.value);
  return rows.filter(r => {
    if (!r.dataVenda) return false;
    if (getRowYear(r) !== slot.year) return false;
    if (!months.includes(getRowMonth(r))) return false;
    if (blindadora !== 'Todas' && r.blindadora !== blindadora) return false;
    return true;
  });
}

// ─── Aggregation ──────────────────────────────────────────────────────────────
interface Metrics {
  qtd: number;
  receita: number;
  custo: number;
  lucro: number;
  margem: number;
  sorana: number;
  soranaPct: number;
  ticketMedio: number;
  remVendedor: number;
  remGerencia: number;
  remDiretoria: number;
  remSupervisor: number;
  remTotal: number;
}

function calcMetrics(rows: VendasRow[]): Metrics {
  const qtd = rows.length;
  const receita   = rows.reduce((a, r) => a + n(r.valorVendaBlindagem), 0);
  const custo     = rows.reduce((a, r) => a + n(r.custoBlindagem), 0);
  const lucro     = rows.reduce((a, r) => a + n(r.lucroOperacao), 0);
  const margem    = receita > 0 ? (lucro / receita) * 100 : 0;
  const sorana    = rows.reduce((a, r) => a + n(r.comissaoBrutaSorana), 0);
  const ticketMedio = qtd > 0 ? receita / qtd : 0;
  const remVendedor  = rows.reduce((a, r) => a + n(r.remuneracaoVendedor), 0);
  const remGerencia  = rows.reduce((a, r) => a + n(r.remuneracaoGerencia), 0);
  const remDiretoria = rows.reduce((a, r) => a + n(r.remuneracaoDiretoria), 0);
  const remSupervisor = rows.reduce((a, r) => a + n(r.remuneracaoGerenciaSupervisorUsados), 0);
  const remTotal = remVendedor + remGerencia + remDiretoria + remSupervisor;
  const soranaPct = receita > 0 ? (sorana / receita) * 100 : 0;
  return { qtd, receita, custo, lucro, margem, sorana, soranaPct, ticketMedio, remVendedor, remGerencia, remDiretoria, remSupervisor, remTotal };
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16'];
const PERIOD_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];

// ─── Sub-components ───────────────────────────────────────────────────────────
interface KpiCardProps { label: string; value: string; sub?: string; color?: string; accentColor?: string; }
function KpiCard({ label, value, sub, color = 'text-slate-800', accentColor }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-3 flex flex-col gap-0.5 min-w-0" style={accentColor ? { borderLeft: `4px solid ${accentColor}` } : undefined}>
      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide leading-tight">{label}</span>
      <span className={`text-lg font-bold leading-tight ${color} truncate`}>{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 mt-1">{children}</h2>
  );
}

function CustomTooltipBRL({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {fmtBRLFull(p.value)}
        </p>
      ))}
    </div>
  );
}

function MonthlyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string; payload?: { soranaPct: number; qtd: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const soranaPct = payload[0]?.payload?.soranaPct;
  const qtd = payload[0]?.payload?.qtd;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {qtd !== undefined && (
        <p className="font-mono text-slate-500 mb-1">
          Volume: {qtd} venda{qtd !== 1 ? 's' : ''}
        </p>
      )}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {fmtBRLFull(p.value)}
        </p>
      ))}
      {soranaPct !== undefined && (
        <p className="font-mono mt-1 pt-1 border-t border-slate-100" style={{ color: '#8b5cf6' }}>
          % Rentabilidade Sorana: {fmtPct(soranaPct)}
        </p>
      )}
    </div>
  );
}

function BlindadoraTooltip({ active, payload, label }: { active?: boolean; payload?: { payload?: { qtd: number; receita: number; lucro: number; sorana: number; soranaPct: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      <p className="font-mono" style={{ color: '#64748b' }}>Total de Vendas: {d.qtd}</p>
      <p className="font-mono" style={{ color: '#f59e0b' }}>Receita: {fmtBRLFull(d.receita)}</p>
      <p className="font-mono" style={{ color: '#10b981' }}>Lucro Bruto: {fmtBRLFull(d.lucro)}</p>
      <p className="font-mono" style={{ color: '#8b5cf6' }}>Comissão Sorana: {fmtBRLFull(d.sorana)}</p>
      <p className="font-mono mt-1 pt-1 border-t border-slate-100" style={{ color: '#8b5cf6' }}>
        % Rentabilidade Sorana: {fmtPct(d.soranaPct)}
      </p>
    </div>
  );
}

function DeltaBadge({ base, current }: { base: number; current: number }) {
  if (base === 0) return <span className="text-slate-300 text-xs">—</span>;
  const delta = ((current - base) / Math.abs(base)) * 100;
  if (Math.abs(delta) < 0.05) return <span className="text-slate-400 text-xs flex items-center gap-0.5"><Minus className="w-3 h-3" />0%</span>;
  if (delta > 0) return <span className="text-emerald-600 text-xs font-semibold flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{fmtPct(delta)}</span>;
  return <span className="text-red-500 text-xs font-semibold flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{fmtPct(delta)}</span>;
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
const COLS_NOTAS = [
  { header: '#',               width: 5  },
  { header: 'Revenda',         width: 24 },
  { header: 'Blindadora',      width: 24 },
  { header: 'Chassi',          width: 22 },
  { header: 'Data da Venda',   width: 16 },
  { header: 'Comissão Sorana', width: 22 },
];

async function buildSheetInWb(
  wb: ExcelJS.Workbook,
  sheetRows: VendasRow[],
  sheetName: string,
  tabColor: string,
  titleLabel: string,
) {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: tabColor } },
  });
  ws.columns = COLS_NOTAS.map(c => ({ width: c.width }));

  // Row 1: merged title
  const titleRow = ws.addRow([titleLabel]);
  ws.mergeCells(1, 1, 1, COLS_NOTAS.length);
  titleRow.height = 28;
  titleRow.eachCell(cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.font      = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border    = { top: { style: 'thin', color: { argb: 'FF1E293B' } }, bottom: { style: 'thin', color: { argb: 'FF1E293B' } }, left: { style: 'thin', color: { argb: 'FF1E293B' } }, right: { style: 'thin', color: { argb: 'FF1E293B' } } };
  });

  // Row 2: headers
  const headerRow = ws.addRow(COLS_NOTAS.map(c => c.header));
  headerRow.height = 32;
  headerRow.eachCell(cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    cell.font      = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border    = { top: { style: 'thin', color: { argb: 'FF475569' } }, bottom: { style: 'medium', color: { argb: 'FF94A3B8' } }, left: { style: 'thin', color: { argb: 'FF475569' } }, right: { style: 'thin', color: { argb: 'FF475569' } } };
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: COLS_NOTAS.length } };

  const BTHIN = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const BRL_FMT = '"R$"\\ #,##0.00';

  // Data rows
  sheetRows.forEach((r, ri) => {
    const bg  = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    const dateVal = r.dataVenda ? (() => { const [y, m, d] = r.dataVenda.split('-'); return (y && m && d) ? new Date(+y, +m - 1, +d) : ''; })() : '';
    const dr = ws.addRow([ri + 1, r.revenda || '', r.blindadora || '', r.chassi || '', dateVal, parseFloat(r.comissaoBrutaSorana) || null]);
    dr.height = 17;
    dr.eachCell({ includeEmpty: true }, (cell, ci) => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { top: BTHIN, bottom: BTHIN, left: BTHIN, right: BTHIN };
      cell.font   = { size: 9.5 };
      if (ci === 5) { if (cell.value instanceof Date) cell.numFmt = 'DD/MM/YYYY'; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
      else if (ci === 6) { cell.numFmt = BRL_FMT; cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.font = { size: 9.5, name: 'Courier New' }; }
      else { cell.alignment = { horizontal: ci === 1 ? 'center' : 'left', vertical: 'middle' }; }
    });
  });

  // Totals row
  const total = sheetRows.reduce((s, r) => s + (parseFloat(r.comissaoBrutaSorana) || 0), 0);
  const totRow = ws.addRow(['', '', '', '', 'TOTAL', total]);
  totRow.height = 22;
  totRow.eachCell({ includeEmpty: true }, (cell, ci) => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.border = { top: { style: 'medium', color: { argb: 'FF94A3B8' } }, bottom: { style: 'medium', color: { argb: 'FF334155' } }, left: { style: 'thin', color: { argb: 'FF475569' } }, right: { style: 'thin', color: { argb: 'FF475569' } } };
    if (ci === 5) { cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
    else if (ci === 6) { cell.numFmt = BRL_FMT; cell.font = { bold: true, size: 10, color: { argb: 'FFFBBF24' }, name: 'Courier New' }; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
    else { cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }; }
  });
}

async function exportNotasExcel(pendingRows: VendasRow[], brandLabel: string, tabColor: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();

  const today     = new Date().toLocaleDateString('pt-BR');
  const titleGeral = `Notas de Intermediação a Emitir — ${brandLabel} — ${today}`;
  await buildSheetInWb(wb, pendingRows, 'Geral', tabColor, titleGeral);

  const byBlindadora = new Map<string, VendasRow[]>();
  pendingRows.forEach(r => {
    const key = r.blindadora || 'Não informada';
    if (!byBlindadora.has(key)) byBlindadora.set(key, []);
    byBlindadora.get(key)!.push(r);
  });
  for (const [name, rows] of byBlindadora.entries()) {
    await buildSheetInWb(wb, rows, name.slice(0, 31), tabColor, `${name} — ${today}`);
  }

  const buf     = await wb.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().split('T')[0];
  const brand   = brandLabel.toLowerCase().replace(/\s+/g, '-');
  saveAs(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `notas-intermediacao-${brand}-${dateStr}.xlsx`
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface VendasAnaliseProps { rows: VendasRow[]; }

export function VendasAnalise({ rows }: VendasAnaliseProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // ── Filtros globais ──
  const [selectedYear, setSelectedYear]         = useState(currentYear);
  const [monthChip, setMonthChip]               = useState<number | null>(null);
  const [selectedBlindadora, setSelectedBlindadora] = useState('Todas');
  const [selectedBrand, setSelectedBrand]       = useState<BrandFilter>('Todas');

  // ── Comparativo ──
  const [periods, setPeriods] = useState<PeriodSlot[]>([
    { year: currentYear, tipo: 'mes', value: currentMonth },
  ]);

  const [showAllVendedores, setShowAllVendedores] = useState(false);
  const [showAllRanking, setShowAllRanking] = useState(false);

  // Anos disponíveis nos dados
  const availableYears = useMemo(() => {
    const years = [...new Set(rows.map(getRowYear).filter(y => y > 2000))].sort();
    if (!years.includes(currentYear)) years.push(currentYear);
    return years.sort();
  }, [rows, currentYear]);

  // Linhas pré-filtradas por marca
  const brandRows = useMemo(() => {
    if (selectedBrand === 'Todas') return rows;
    const term = selectedBrand.toLowerCase();
    return rows.filter(r => r.revenda.toLowerCase().includes(term));
  }, [rows, selectedBrand]);

  // Blindadoras disponíveis (restritas à marca selecionada)
  const availableBlindadoras = useMemo(() => {
    return ['Todas', ...[...new Set(brandRows.map(r => r.blindadora).filter(Boolean))].sort()];
  }, [brandRows]);

  // Linhas filtradas para análise principal
  const filteredRows = useMemo(
    () => filterRows(brandRows, selectedYear, monthChip, selectedBlindadora),
    [brandRows, selectedYear, monthChip, selectedBlindadora]
  );

  const metrics = useMemo(() => calcMetrics(filteredRows), [filteredRows]);

  // ── Métricas do mês anterior (para deltas no Spotlight) ──
  const prevMonthMetrics = useMemo(() => {
    if (monthChip === null) return null;
    const prevM = monthChip === 1 ? 12 : monthChip - 1;
    const prevY = monthChip === 1 ? selectedYear - 1 : selectedYear;
    const prevRows = filterRows(brandRows, prevY, prevM, selectedBlindadora);
    return { ...calcMetrics(prevRows), label: `${MONTHS[prevM - 1]}/${prevY}` };
  }, [brandRows, selectedYear, monthChip, selectedBlindadora]);

  // ── Dados mensais (gráfico de evolução) ──
  const monthlyData = useMemo(() => {
    const maxMonth = monthChip !== null ? monthChip : 12;
    return MONTHS.slice(0, maxMonth).map((label, mi) => {
      const m = mi + 1;
      const mRows = brandRows.filter(r =>
        getRowYear(r) === selectedYear &&
        getRowMonth(r) === m &&
        (selectedBlindadora === 'Todas' || r.blindadora === selectedBlindadora)
      );
      const receita = mRows.reduce((a, r) => a + n(r.valorVendaBlindagem), 0);
      const lucro   = mRows.reduce((a, r) => a + n(r.lucroOperacao), 0);
      const sorana  = mRows.reduce((a, r) => a + n(r.comissaoBrutaSorana), 0);
      const soranaPct = receita > 0 ? (sorana / receita) * 100 : 0;
      return { label, receita, lucro, sorana, soranaPct, qtd: mRows.length };
    });
  }, [brandRows, selectedYear, selectedBlindadora, monthChip]);

  // ── Por modelo ──
  const modeloData = useMemo(() => {
    const map = new Map<string, number>();
    filteredRows.forEach(r => {
      const key = r.veiculo || 'Não informado';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].map(([name, qtd]) => ({ name, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 8);
  }, [filteredRows]);

  // ── Por revenda ──
  const revendaData = useMemo(() => {
    const map = new Map<string, { qtd: number; receita: number; sorana: number }>();
    filteredRows.forEach(r => {
      const key = r.revenda || 'Não informada';
      const cur = map.get(key) || { qtd: 0, receita: 0, sorana: 0 };
      map.set(key, { qtd: cur.qtd + 1, receita: cur.receita + n(r.valorVendaBlindagem), sorana: cur.sorana + n(r.comissaoBrutaSorana) });
    });
    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        qtd: v.qtd,
        receita: v.receita,
        sorana: v.sorana,
        ticketMedio: v.qtd > 0 ? v.receita / v.qtd : 0,
        tmComissao: v.qtd > 0 ? v.sorana / v.qtd : 0,
      }))
      .sort((a, b) => b.receita - a.receita);
  }, [filteredRows]);

  // ── Por vendedor ──
  const vendedorData = useMemo(() => {
    const map = new Map<string, { qtd: number; receita: number; lucro: number; remVendedor: number; sorana: number }>();
    filteredRows.forEach(r => {
      const key = r.nomeVendedor || 'Não informado';
      const cur = map.get(key) || { qtd: 0, receita: 0, lucro: 0, remVendedor: 0, sorana: 0 };
      map.set(key, {
        qtd: cur.qtd + 1,
        receita: cur.receita + n(r.valorVendaBlindagem),
        lucro: cur.lucro + n(r.lucroOperacao),
        remVendedor: cur.remVendedor + n(r.remuneracaoVendedor),
        sorana: cur.sorana + n(r.comissaoBrutaSorana),
      });
    });
    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        qtd: v.qtd,
        receita: v.receita,
        lucro: v.lucro,
        margem: v.receita > 0 ? (v.lucro / v.receita) * 100 : 0,
        remVendedor: v.remVendedor,
        sorana: v.sorana,
        soranaPct: v.receita > 0 ? (v.sorana / v.receita) * 100 : 0,
      }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [filteredRows]);

  // ── Por blindadora ──
  const blindadoraData = useMemo(() => {
    const map = new Map<string, { qtd: number; receita: number; custo: number; lucro: number; sorana: number }>();
    brandRows.filter(r => getRowYear(r) === selectedYear && (monthChip === null || getRowMonth(r) === monthChip)).forEach(r => {
      const key = r.blindadora || 'Não informada';
      const cur = map.get(key) || { qtd: 0, receita: 0, custo: 0, lucro: 0, sorana: 0 };
      map.set(key, {
        qtd: cur.qtd + 1,
        receita: cur.receita + n(r.valorVendaBlindagem),
        custo: cur.custo + n(r.custoBlindagem),
        lucro: cur.lucro + n(r.lucroOperacao),
        sorana: cur.sorana + n(r.comissaoBrutaSorana),
      });
    });
    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        qtd: v.qtd,
        custoMedio: v.qtd > 0 ? v.custo / v.qtd : 0,
        lucro: v.lucro,
        receita: v.receita,
        sorana: v.sorana,
        soranaPct: v.receita > 0 ? (v.sorana / v.receita) * 100 : 0,
      }))
      .sort((a, b) => b.receita - a.receita);
  }, [brandRows, selectedYear, monthChip]);

  // ── Remunerações pizza ──
  const remPieData = useMemo(() => [
    { name: 'Vendedor',    value: metrics.remVendedor,  color: '#f59e0b' },
    { name: 'Gerência',    value: metrics.remGerencia,  color: '#3b82f6' },
    { name: 'Diretoria Comercial', value: metrics.remDiretoria, color: '#8b5cf6' },
    { name: 'Sup. Usados', value: metrics.remSupervisor,color: '#10b981' },
    { name: 'Sorana',      value: metrics.sorana,       color: '#ef4444' },
  ].filter(d => d.value > 0), [metrics]);

  // ── Comparativo de períodos ──
  const periodMetrics = useMemo(
    () => periods.map(slot => ({ slot, metrics: calcMetrics(filterByPeriod(brandRows, slot, selectedBlindadora)) })),
    [periods, brandRows, selectedBlindadora]
  );

  const addPeriod = () => {
    if (periods.length >= 4) return;
    setPeriods(prev => [...prev, { year: currentYear, tipo: 'mes', value: currentMonth }]);
  };
  const removePeriod = (i: number) => setPeriods(prev => prev.filter((_, idx) => idx !== i));
  const updatePeriod = (i: number, patch: Partial<PeriodSlot>) =>
    setPeriods(prev => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));

  const periodoOptions: { tipo: PeriodType; label: string; count: number }[] = [
    { tipo: 'mes', label: 'Mês', count: 12 },
    { tipo: 'bimestre', label: 'Bimestre', count: 6 },
    { tipo: 'trimestre', label: 'Trimestre', count: 4 },
    { tipo: 'semestre', label: 'Semestre', count: 2 },
    { tipo: 'anual', label: 'Anual', count: 1 },
  ];

  const periodoValueLabels: Record<PeriodType, string[]> = {
    mes: MONTHS,
    bimestre: ['1º Bim (Jan-Fev)', '2º Bim (Mar-Abr)', '3º Bim (Mai-Jun)', '4º Bim (Jul-Ago)', '5º Bim (Set-Out)', '6º Bim (Nov-Dez)'],
    trimestre: ['1º Trim (Jan-Mar)', '2º Trim (Abr-Jun)', '3º Trim (Jul-Set)', '4º Trim (Out-Dez)'],
    semestre: ['1º Sem (Jan-Jun)', '2º Sem (Jul-Dez)'],
    anual: ['Ano Completo'],
  };

  const comparativoRows: { label: string; key: keyof Metrics; fmt: (v: number) => string }[] = [
    { label: 'Qtd de Vendas',      key: 'qtd',        fmt: v => String(v) },
    { label: 'Receita',            key: 'receita',    fmt: fmtBRLFull },
    { label: 'Custo',              key: 'custo',      fmt: fmtBRLFull },
    { label: 'Lucro Bruto',  key: 'lucro',      fmt: fmtBRLFull },
    { label: 'Margem Bruta %',      key: 'margem',     fmt: fmtPct },
    { label: 'Ticket Médio',       key: 'ticketMedio',fmt: fmtBRLFull },
    { label: 'Comissão Sorana',    key: 'sorana',     fmt: fmtBRLFull },
    { label: '% Rentabilidade Sorana', key: 'soranaPct', fmt: fmtPct },
    { label: 'Rem. Vendedores',    key: 'remVendedor',fmt: fmtBRLFull },
    { label: 'Rem. Gerência',      key: 'remGerencia',fmt: fmtBRLFull },
    { label: 'Rem. Diretoria Comercial', key: 'remDiretoria',fmt: fmtBRLFull },
    { label: 'Rem. Sup. Usados',   key: 'remSupervisor',fmt: fmtBRLFull },
    { label: 'Total Remunerações', key: 'remTotal',   fmt: fmtBRLFull },
  ];

  // ── Notas a emitir por blindadora (total geral, apenas filtro de marca) ──
  const notasAEmitirData = useMemo(() => {
    const pending = brandRows.filter(r => !r.numeroNFComissao && !!r.dataVenda);
    const map = new Map<string, { qtd: number; valor: number }>();
    pending.forEach(r => {
      const key = r.blindadora || 'Não informada';
      const cur = map.get(key) || { qtd: 0, valor: 0 };
      map.set(key, { qtd: cur.qtd + 1, valor: cur.valor + n(r.comissaoBrutaSorana) });
    });
    const items = [...map.entries()]
      .map(([blindadora, v]) => ({ blindadora, qtd: v.qtd, valor: v.valor }))
      .sort((a, b) => b.valor - a.valor);
    const totalQtd  = items.reduce((a, i) => a + i.qtd, 0);
    const totalValor = items.reduce((a, i) => a + i.valor, 0);
    return { items, totalQtd, totalValor };
  }, [brandRows]);

  // ── Contagem por marca (badges do seletor) ──
  const brandCounts = useMemo(() => {
    const scoped = rows.filter(r =>
      getRowYear(r) === selectedYear && (monthChip === null || getRowMonth(r) === monthChip)
    );
    return {
      todas: scoped.length,
      vw:   scoped.filter(r => r.revenda.toLowerCase().includes('vw')).length,
      audi: scoped.filter(r => r.revenda.toLowerCase().includes('audi')).length,
    };
  }, [rows, selectedYear, monthChip]);

  const hasData = filteredRows.length > 0;

  const brandOptions: { value: BrandFilter; label: string; shortLabel: string; color: string; textColor: string; count: number }[] = [
    { value: 'Todas', label: 'Todas as Revendas', shortLabel: 'Todas',       color: '#f59e0b', textColor: '#ffffff', count: brandCounts.todas },
    { value: 'VW',    label: 'Revenda VW',        shortLabel: 'Revenda VW',  color: '#001E50', textColor: '#ffffff', count: brandCounts.vw   },
    { value: 'Audi',  label: 'Revenda Audi',      shortLabel: 'Revenda Audi',color: '#BB0A21', textColor: '#ffffff', count: brandCounts.audi },
  ];

  return (
    <div className="p-4 space-y-6 bg-slate-50 min-h-full">

      {/* ── BRAND SWITCHER ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Visualizar por</span>
          <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
            {brandOptions.map(opt => {
              const isActive = selectedBrand === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setSelectedBrand(opt.value)}
                  className="relative flex items-center gap-2.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none"
                  style={isActive
                    ? { background: opt.color, color: opt.textColor, boxShadow: `0 2px 8px ${opt.color}55` }
                    : { color: '#64748b' }
                  }
                >
                  <span className="whitespace-nowrap">{opt.shortLabel}</span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full font-bold tabular-nums transition-all duration-200"
                    style={isActive
                      ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#ffffff' }
                      : { backgroundColor: '#e2e8f0', color: '#64748b' }
                    }
                  >
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedBrand !== 'Todas' && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: brandOptions.find(o => o.value === selectedBrand)!.color + '18', color: brandOptions.find(o => o.value === selectedBrand)!.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: brandOptions.find(o => o.value === selectedBrand)!.color }} />
              Filtrado: {brandOptions.find(o => o.value === selectedBrand)!.label}
            </span>
          )}
        </div>
      </div>

      {/* ── FILTROS GLOBAIS ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">

          {/* Ano */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ano</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Blindadora */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Blindadora</span>
            <select
              value={selectedBlindadora}
              onChange={e => setSelectedBlindadora(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {availableBlindadoras.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Chips de mês */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Mês</span>
            <button
              onClick={() => setMonthChip(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${monthChip === null ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              Ano todo
            </button>
            {MONTHS.map((m, mi) => {
              const month = mi + 1;
              const isCurrent = month === currentMonth && selectedYear === currentYear;
              return (
                <button
                  key={month}
                  onClick={() => setMonthChip(monthChip === month ? null : month)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    monthChip === month
                      ? 'bg-amber-500 text-white'
                      : isCurrent
                      ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-400 hover:bg-amber-200'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div>
        <SectionTitle>Visão Geral — {monthChip ? `${MONTHS[monthChip - 1]}/${selectedYear}` : String(selectedYear)}</SectionTitle>
        {(() => {
          const accent = selectedBrand === 'VW' ? '#001E50' : selectedBrand === 'Audi' ? '#BB0A21' : '#3b82f6';
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              <KpiCard label="Total de Vendas" value={String(metrics.qtd)} color="text-slate-800" accentColor={accent} />
              <KpiCard label="Receita Total" value={fmtBRL(metrics.receita)} color="text-amber-600" accentColor={accent} />
              <KpiCard label="Custo Total" value={fmtBRL(metrics.custo)} color="text-red-500" accentColor={accent} />
              <KpiCard label="Lucro Bruto" value={fmtBRL(metrics.lucro)} color="text-emerald-600" accentColor={accent} />
              <KpiCard label="Margem Bruta%" value={fmtPct(metrics.margem)} color={metrics.margem >= 20 ? 'text-emerald-600' : metrics.margem >= 10 ? 'text-amber-600' : 'text-red-500'} accentColor={accent} />
              <KpiCard label="Ticket Médio" value={fmtBRL(metrics.ticketMedio)} color="text-sky-600" sub={metrics.qtd > 0 ? `TM Comissão: ${fmtBRL(metrics.sorana / metrics.qtd)}` : undefined} accentColor={accent} />
              <KpiCard label="Comissão Sorana" value={fmtBRL(metrics.sorana)} color="text-violet-600" sub={metrics.receita > 0 ? fmtPct(metrics.sorana / metrics.receita * 100) + ' da receita' : undefined} accentColor={accent} />
              <KpiCard label="% Rentabilidade Sorana" value={metrics.receita > 0 ? fmtPct(metrics.sorana / metrics.receita * 100) : '—'} color="text-fuchsia-600" accentColor={accent} />
            </div>
          );
        })()}
      </div>

      {/* ── ANÁLISE POR DIMENSÃO ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Modelos */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SectionTitle>Vendas por Modelo</SectionTitle>
          {modeloData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={modeloData}
                  dataKey="qtd"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={45}
                  paddingAngle={2}
                  label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                  labelLine={false}
                >
                  {modeloData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(v, name) => [`${v} venda(s)`, name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        {/* Revendas */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <SectionTitle>Revendas — Volume & Ticket Médio de Vendas</SectionTitle>
          {revendaData.length > 0 ? (
            <>
              {/* Ranking TM Vendas */}
              <div className="space-y-2">
                {revendaData.map((r, i) => (
                  <div key={r.name} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-700 truncate">{r.name}</span>
                        <span className="text-xs font-semibold text-slate-500 flex-shrink-0">{r.qtd} venda{r.qtd !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: `${revendaData[0].receita > 0 ? (r.receita / revendaData[0].receita) * 100 : 0}%`, background: PALETTE[i % PALETTE.length] }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0 font-mono">TM: {fmtBRL(r.ticketMedio)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100" />

              {/* Ranking TM Comissão */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ticket Médio de Comissões</p>
                {(() => {
                  const maxTmComissao = Math.max(...revendaData.map(r => r.tmComissao), 0);
                  return (
                <div className="space-y-2">
                  {revendaData.map((r, i) => (
                    <div key={r.name} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-700 truncate">{r.name}</span>
                          <span className="text-xs font-semibold text-slate-500 flex-shrink-0">{r.qtd} venda{r.qtd !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{
                                width: `${maxTmComissao > 0 ? Math.min((r.tmComissao / maxTmComissao) * 100, 100) : 0}%`,
                                background: PALETTE[i % PALETTE.length],
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0 font-mono">TM: {fmtBRL(r.tmComissao)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                  );
                })()}
              </div>
            </>
          ) : <EmptyChart />}
        </div>

        {/* Blindadoras */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SectionTitle>Comparativo entre Blindadoras</SectionTitle>
          {blindadoraData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={blindadoraData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10 }} width={70} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip content={<BlindadoraTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receita" name="Receita" fill="#f59e0b" radius={[0, 3, 3, 0]}>
                  <LabelList dataKey="qtd" position="right" formatter={(v: number) => `${v}x`} style={{ fontSize: 11, fill: '#64748b' }} />
                </Bar>
                <Bar dataKey="lucro" name="Lucro Bruto" fill="#10b981" radius={[0, 3, 3, 0]} />
                <Bar dataKey="sorana" name="Comissão Sorana" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>

      {/* ── EVOLUÇÃO MENSAL ── */}
      {monthChip === null && (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Evolução Mensal — {String(selectedYear)}</SectionTitle>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={monthlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10 }} width={85} />
            <Tooltip content={<MonthlyTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="receita" name="Receita" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="left" dataKey="lucro" name="Lucro Bruto" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="left" dataKey="sorana" name="Comissão Sorana" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      )}

      {/* ── PERFORMANCE POR VENDEDOR ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Performance por Vendedor</h2>
          {vendedorData.length > 0 && (
            <span className="text-xs text-slate-400 font-medium px-2.5 py-1 bg-slate-100 rounded-full">
              {vendedorData.length} vendedor{vendedorData.length !== 1 ? 'es' : ''}
            </span>
          )}
        </div>

        {vendedorData.length > 0 ? (
          <div className="space-y-6">

            {/* ── Pódio Top 3 ── */}
            {(() => {
              const totalQtd = vendedorData.reduce((s, v) => s + v.qtd, 0);
              const medals  = ['🥇', '🥈', '🥉'];
              const gradients = ['from-amber-400 to-amber-600', 'from-slate-400 to-slate-500', 'from-orange-400 to-orange-500'];
              const bgBorder  = ['bg-amber-50 border-amber-200', 'bg-slate-50 border-slate-200', 'bg-orange-50 border-orange-200'];
              const textAccent = ['text-amber-600', 'text-slate-600', 'text-orange-500'];
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {vendedorData.slice(0, 3).map((v, i) => {
                    const topQtd = vendedorData[0].qtd;
                    const barPct = topQtd > 0 ? (v.qtd / topQtd) * 100 : 0;
                    const volPct = totalQtd > 0 ? (v.qtd / totalQtd) * 100 : 0;
                    const initials = v.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
                    return (
                      <div key={v.name} className={`rounded-xl border p-4 ${bgBorder[i]} relative overflow-hidden`}>
                        <div className="flex items-start gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradients[i]} flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm`}>
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-base leading-none">{medals[i]}</span>
                              <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-800 leading-tight truncate">{v.name}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-slate-400 mb-0.5">Comissão Sorana</p>
                            <p className={`text-lg font-bold font-mono ${textAccent[i]}`}>{fmtBRL(v.sorana)}</p>
                          </div>
                          <div className="w-full bg-white/70 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full bg-gradient-to-r ${gradients[i]} transition-all`} style={{ width: `${barPct}%` }} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                              <span className="font-semibold">{v.qtd}</span> venda{v.qtd !== 1 ? 's' : ''}
                              <span className="ml-1 text-slate-400">({fmtPct(volPct)} do volume)</span>
                            </span>
                          </div>
                          <div className="pt-1.5 border-t border-white/60 space-y-1">
                            <p className="text-xs text-slate-400">% Rentabilidade: <span className="font-semibold text-fuchsia-600 font-mono">{fmtPct(v.soranaPct)}</span></p>
                            <p className="text-xs text-slate-400">Remuneração Vendedor: <span className="font-semibold text-sky-600 font-mono">{fmtBRL(v.remVendedor)}</span></p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── Tabela Todos os Vendedores ── */}
            {(() => {
              const totalQtd = vendedorData.reduce((s, v) => s + v.qtd, 0);
              return (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Todos os Vendedores</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-2 px-2 text-slate-400 font-semibold w-8">#</th>
                          <th className="text-left py-2 px-2 text-slate-400 font-semibold">Vendedor</th>
                          <th className="text-right py-2 px-2 text-slate-400 font-semibold">Qtd</th>
                          <th className="text-right py-2 px-2 text-slate-400 font-semibold">% Volume</th>
                          <th className="text-right py-2 px-2 text-slate-400 font-semibold">Comissão Sorana</th>
                          <th className="text-right py-2 px-2 text-slate-400 font-semibold">% Rent. Sorana</th>
                          <th className="text-right py-2 px-2 text-slate-400 font-semibold">Remuneração Vendedor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendedorData.map((v, i) => {
                          const volPct = totalQtd > 0 ? (v.qtd / totalQtd) * 100 : 0;
                          const isPodium = i < 3;
                          return (
                            <tr key={v.name} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${isPodium ? 'font-semibold' : ''}`}>
                              <td className="py-2 px-2 text-slate-400 font-bold">#{i + 1}</td>
                              <td className="py-2 px-2 text-slate-700">{v.name}</td>
                              <td className="py-2 px-2 text-right tabular-nums text-slate-600">{v.qtd}</td>
                              <td className="py-2 px-2 text-right tabular-nums text-slate-500">{fmtPct(volPct)}</td>
                              <td className="py-2 px-2 text-right tabular-nums font-mono text-violet-600">{fmtBRL(v.sorana)}</td>
                              <td className="py-2 px-2 text-right tabular-nums font-mono text-fuchsia-600">{fmtPct(v.soranaPct)}</td>
                              <td className="py-2 px-2 text-right tabular-nums font-mono text-sky-600">{fmtBRL(v.remVendedor)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}


          </div>
        ) : <EmptyChart />}
      </div>

      {/* ── REMUNERAÇÕES ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <SectionTitle>Remunerações e Comissões</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cards + tabela */}
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Vendedores',    value: metrics.remVendedor,  color: 'text-amber-600' },
                { label: 'Gerência',      value: metrics.remGerencia,  color: 'text-blue-600' },
                { label: 'Diretoria Comercial', value: metrics.remDiretoria, color: 'text-violet-600' },
                { label: 'Sup. Usados',   value: metrics.remSupervisor,color: 'text-emerald-600' },
                { label: 'Sorana',        value: metrics.sorana,       color: 'text-red-600' },
                { label: 'Total',         value: metrics.remTotal + metrics.sorana, color: 'text-slate-800' },
              ].map(c => (
                <div key={c.label} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">{c.label}</p>
                  <p className={`text-sm font-bold font-mono ${c.color}`}>{fmtBRL(c.value)}</p>
                </div>
              ))}
            </div>
            {/* Ranking individual de vendedores */}
            {vendedorData.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Ranking individual</p>
                <div className="space-y-1">
                  {(showAllRanking ? vendedorData : vendedorData.slice(0, 5)).map((v, i) => {
                    const topRem = vendedorData[0]?.remVendedor || 0;
                    const barPct = topRem > 0 ? (v.remVendedor / topRem) * 100 : 0;
                    const initials = v.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
                    return (
                      <div key={v.name} className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-slate-50 transition-colors">
                        <span className="text-xs font-bold text-slate-300 w-4 text-right flex-shrink-0">{i + 1}</span>
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold flex-shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-xs font-medium text-slate-700 truncate">{v.name}</span>
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <div className="text-right">
                                <p className="text-[10px] text-slate-400 leading-none mb-0.5">Volume</p>
                                <p className="text-xs font-mono font-semibold text-slate-600 tabular-nums">{v.qtd}x</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-slate-400 leading-none mb-0.5">Remuneração</p>
                                <p className="text-xs font-mono font-semibold text-amber-600">{fmtBRL(v.remVendedor)}</p>
                              </div>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1">
                            <div className="h-1 rounded-full bg-amber-400 transition-all" style={{ width: `${barPct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {vendedorData.length > 5 && (
                  <button
                    onClick={() => setShowAllRanking(prev => !prev)}
                    className="mt-2 w-full text-center text-xs font-semibold text-slate-400 hover:text-amber-600 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    {showAllRanking ? '▲ Mostrar menos' : `▼ Ver todos os ${vendedorData.length} vendedores`}
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Pizza */}
          {remPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={remPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  paddingAngle={2}
                  label={({ name, percent }) => percent > 0.04 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                  labelLine={false}
                >
                  {remPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtBRLFull(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>

      {/* ── COMPARATIVO DE PERÍODOS ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Comparativo de Períodos</SectionTitle>
          {periods.length < 4 && (
            <button
              onClick={addPeriod}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Período
            </button>
          )}
        </div>

        {/* Seletores de período */}
        <div className="flex flex-wrap gap-3 mb-5">
          {periods.map((slot, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-2 text-sm"
              style={{ borderColor: PERIOD_COLORS[i] + '66' }}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: PERIOD_COLORS[i] }}
              />
              <span className="text-xs font-semibold text-slate-500">{i === 0 ? 'Base' : `P${i + 1}`}</span>

              {/* Ano */}
              <select
                value={slot.year}
                onChange={e => updatePeriod(i, { year: Number(e.target.value) })}
                className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>

              {/* Tipo */}
              <select
                value={slot.tipo}
                onChange={e => updatePeriod(i, { tipo: e.target.value as PeriodType, value: 1 })}
                className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                {periodoOptions.map(o => <option key={o.tipo} value={o.tipo}>{o.label}</option>)}
              </select>

              {/* Valor */}
              {slot.tipo !== 'anual' && (
                <select
                  value={slot.value}
                  onChange={e => updatePeriod(i, { value: Number(e.target.value) })}
                  className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  {periodoValueLabels[slot.tipo].map((label, vi) => (
                    <option key={vi + 1} value={vi + 1}>{label}</option>
                  ))}
                </select>
              )}

              {periods.length > 1 && (
                <button
                  onClick={() => removePeriod(i)}
                  className="text-slate-300 hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Tabela comparativa */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Métrica</th>
                {periodMetrics.map(({ slot }, i) => (
                  <th key={i} className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wide" style={{ color: PERIOD_COLORS[i] }}>
                    {i === 0 ? '🔵 Base — ' : `P${i + 1} — `}{periodLabel(slot.tipo, slot.value, slot.year)}
                  </th>
                ))}
                {periodMetrics.slice(1).map((_, i) => (
                  <th key={`d${i}`} className="text-right py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Δ vs Base
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparativoRows.map((row, ri) => (
                <tr key={row.key} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="py-2 px-3 font-medium text-slate-700 border-r border-slate-100">{row.label}</td>
                  {periodMetrics.map(({ metrics: m }, i) => (
                    <td key={i} className="py-2 px-3 text-right font-mono text-slate-700">
                      {row.fmt(m[row.key] as number)}
                    </td>
                  ))}
                  {periodMetrics.slice(1).map(({ metrics: m }, i) => (
                    <td key={`d${i}`} className="py-2 px-3 text-right">
                      <DeltaBadge base={periodMetrics[0].metrics[row.key] as number} current={m[row.key] as number} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Gráfico comparativo */}
        {periods.length > 1 && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Receita vs Lucro por Período</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={['receita', 'lucro', 'sorana'].map(key => ({
                  name: key === 'receita' ? 'Receita' : key === 'lucro' ? 'Lucro' : 'Sorana',
                  ...Object.fromEntries(periodMetrics.map(({ slot, metrics: m }, i) => [
                    periodLabel(slot.tipo, slot.value, slot.year),
                    m[key as keyof Metrics],
                  ])),
                }))}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10 }} width={80} />
                <Tooltip content={<CustomTooltipBRL />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {periodMetrics.map(({ slot }, i) => (
                  <Bar key={i} dataKey={periodLabel(slot.tipo, slot.value, slot.year)} fill={PERIOD_COLORS[i]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── NOTAS DE INTERMEDIAÇÃO A EMITIR ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Notas de Intermediação a Emitir</SectionTitle>
          <div className="flex items-center gap-2">
            {notasAEmitirData.totalQtd > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                {notasAEmitirData.totalQtd} nota{notasAEmitirData.totalQtd !== 1 ? 's' : ''} pendente{notasAEmitirData.totalQtd !== 1 ? 's' : ''}
              </span>
            )}
            {notasAEmitirData.totalQtd > 0 && (
              <button
                onClick={async () => {
                  const opt = brandOptions.find(o => o.value === selectedBrand)!;
                  const tabColor = selectedBrand === 'VW' ? 'FF001E50' : selectedBrand === 'Audi' ? 'FFBB0A21' : 'FF1E293B';
                  await exportNotasExcel(
                    brandRows.filter(r => !r.numeroNFComissao && !!r.dataVenda),
                    opt.label,
                    tabColor,
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar Excel
              </button>
            )}
          </div>
        </div>

        {notasAEmitirData.items.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <Check className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Nenhuma nota pendente</p>
            <p className="text-xs mt-0.5">Todas as comissões já possuem nota emitida.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="text-left py-2.5 px-3 text-xs font-bold text-slate-400 uppercase tracking-wide">#</th>
                  <th className="text-left py-2.5 px-3 text-xs font-bold text-slate-400 uppercase tracking-wide">Blindadora</th>
                  <th className="text-center py-2.5 px-3 text-xs font-bold text-slate-400 uppercase tracking-wide">Qtd. Notas</th>
                  <th className="text-right py-2.5 px-3 text-xs font-bold text-slate-400 uppercase tracking-wide">Valor Total (Comissão Sorana)</th>
                  <th className="text-right py-2.5 px-3 text-xs font-bold text-slate-400 uppercase tracking-wide">% do Total</th>
                </tr>
              </thead>
              <tbody>
                {notasAEmitirData.items.map((item, i) => (
                  <tr key={item.blindadora} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-700">{item.blindadora}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                        {item.qtd}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-red-600">
                      {fmtBRLFull(item.valor)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-400 text-xs">
                      {notasAEmitirData.totalValor > 0 ? fmtPct(item.valor / notasAEmitirData.totalValor * 100) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={2} className="py-3 px-3 text-xs font-bold text-slate-600 uppercase tracking-wide">Total Geral</td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                      {notasAEmitirData.totalQtd}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-red-700 text-base">
                    {fmtBRLFull(notasAEmitirData.totalValor)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-400 text-xs">100,0%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {!hasData && (
        <div className="text-center py-16 text-slate-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum dado para o período selecionado</p>
          <p className="text-sm mt-1">Ajuste os filtros acima para visualizar a análise.</p>
        </div>
      )}

    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[200px] flex items-center justify-center text-slate-300 text-sm">
      Sem dados no período
    </div>
  );
}
