import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Line,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { type PeliculasRow } from './peliculasStorage';

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
function n(s: string | undefined): number { return parseFloat(s || '') || 0; }

const SITUACOES_VALIDAS = new Set(['Processo Finalizado', 'Encerrada']);

function getRowYear(row: PeliculasRow): number {
  const date = row.dataEncerramento || row.dataRegistro;
  if (!date) return 0;
  return parseInt(date.split('-')[0]) || 0;
}
function getRowMonth(row: PeliculasRow): number {
  const date = row.dataEncerramento || row.dataRegistro;
  if (!date) return 0;
  return parseInt(date.split('-')[1]) || 0;
}

// Apenas linhas válidas para análise (Processo Finalizado ou Encerrada)
function validRows(rows: PeliculasRow[]): PeliculasRow[] {
  return rows.filter(r => SITUACOES_VALIDAS.has(r.situacao));
}

function filterRows(rows: PeliculasRow[], year: number | 'Todos', monthChip: number | null): PeliculasRow[] {
  return rows.filter(r => {
    if (year !== 'Todos' && getRowYear(r) !== year) return false;
    if (monthChip !== null && getRowMonth(r) !== monthChip) return false;
    return true;
  });
}

// ─── Métricas ─────────────────────────────────────────────────────────────────
interface Metrics {
  qtd: number;
  totalVenda: number;
  totalImpostos: number;
  totalRL: number;
  totalCusto: number;
  totalLucro: number;
  pctLucroMedio: number;
  ticketMedio: number;
  totalComissaoVendedor: number;
  totalComissaoAcessorios: number;
  totalComissoes: number;
  comissaoVendedorComDSR: number;
  comissaoAcessoriosComDSR: number;
  totalProvisoes: number;
  totalEncargos: number;
  resultado: number;
}

function calcMetrics(rows: PeliculasRow[]): Metrics {
  const qtd               = rows.length;
  const totalVenda        = rows.reduce((a, r) => a + n(r.valorVenda), 0);
  const totalImpostos     = rows.reduce((a, r) => a + n(r.impostos), 0);
  const totalRL           = rows.reduce((a, r) => a + n(r.receitaLiquida), 0);
  const totalCusto        = rows.reduce((a, r) => a + n(r.custoPrestador), 0);
  const totalLucro        = rows.reduce((a, r) => a + n(r.lucroBruto), 0);
  const pctLucroMedio     = totalRL > 0 ? (totalLucro / totalRL) * 100 : 0;
  const ticketMedio       = qtd > 0 ? totalVenda / qtd : 0;
  const totalComissaoVendedor   = rows.reduce((a, r) => a + n(r.comissaoVendedor), 0);
  const totalComissaoAcessorios = rows.reduce((a, r) => a + n(r.comissaoVendedorAcessorios), 0);
  const totalComissoes          = totalComissaoVendedor + totalComissaoAcessorios;
  // DSR, Provisões e Encargos: fórmulas a definir (atualmente = 0)
  const comissaoVendedorComDSR   = totalComissaoVendedor;   // + DSR quando fórmula estiver disponível
  const comissaoAcessoriosComDSR = totalComissaoAcessorios; // + DSR quando fórmula estiver disponível
  const totalProvisoes           = 0; // fórmula a definir
  const totalEncargos            = 0; // fórmula a definir
  const resultado                = totalLucro - comissaoVendedorComDSR - comissaoAcessoriosComDSR - totalProvisoes - totalEncargos;
  return { qtd, totalVenda, totalImpostos, totalRL, totalCusto, totalLucro, pctLucroMedio, ticketMedio, totalComissaoVendedor, totalComissaoAcessorios, totalComissoes, comissaoVendedorComDSR, comissaoAcessoriosComDSR, totalProvisoes, totalEncargos, resultado };
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16'];

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = 'text-slate-800', accentColor }: { label: string; value: string; sub?: string; color?: string; accentColor?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-3 flex flex-col gap-0.5 min-w-0" style={accentColor ? { borderLeft: `4px solid ${accentColor}` } : undefined}>
      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide leading-tight">{label}</span>
      <span className={`text-lg font-bold leading-tight ${color} truncate`}>{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 mt-1">{children}</h2>;
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-300">
      <span className="text-3xl">📊</span>
      <p className="text-sm">Sem dados para o período selecionado</p>
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

function CustomTooltipBRL({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono">{p.name}: {fmtBRLFull(p.value)}</p>
      ))}
    </div>
  );
}

type PeriodType = 'mes' | 'bimestre' | 'trimestre' | 'semestre' | 'anual';
interface PeriodSlot { year: number; tipo: PeriodType; value: number; vendedor: string; }

function periodMonths(tipo: PeriodType, value: number): number[] {
  if (tipo === 'mes') return [value];
  if (tipo === 'bimestre') { const s = (value - 1) * 2 + 1; return [s, s + 1]; }
  if (tipo === 'trimestre') { const s = (value - 1) * 3 + 1; return [s, s + 1, s + 2]; }
  if (tipo === 'semestre') { const s = (value - 1) * 6 + 1; return [s, s + 1, s + 2, s + 3, s + 4, s + 5]; }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

function periodLabel(tipo: PeriodType, value: number, year: number): string {
  if (tipo === 'mes') return `${MONTHS[value - 1]}/${String(year).slice(2)}`;
  if (tipo === 'bimestre') { const s = (value - 1) * 2 + 1; return `${MONTHS[s - 1]}-${MONTHS[s]}/${String(year).slice(2)}`; }
  if (tipo === 'trimestre') { const s = (value - 1) * 3 + 1; return `${MONTHS[s - 1]}-${MONTHS[s + 1]}/${String(year).slice(2)}`; }
  if (tipo === 'semestre') return value === 1 ? `1º Sem/${String(year).slice(2)}` : `2º Sem/${String(year).slice(2)}`;
  return String(year);
}

function filterByPeriod(rows: PeliculasRow[], slot: PeriodSlot): PeliculasRow[] {
  const months = periodMonths(slot.tipo, slot.value);
  return rows.filter(r => getRowYear(r) === slot.year && months.includes(getRowMonth(r)));
}

function prevPeriodSlot(slot: PeriodSlot): PeriodSlot {
  const maxValues: Record<PeriodType, number> = { mes: 12, bimestre: 6, trimestre: 4, semestre: 2, anual: 1 };
  if (slot.tipo === 'anual') return { ...slot, year: slot.year - 1 };
  if (slot.value > 1) return { ...slot, value: slot.value - 1 };
  return { ...slot, year: slot.year - 1, value: maxValues[slot.tipo] };
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface PeliculasAnaliseProps {
  rows: PeliculasRow[];
}

export function PeliculasAnalise({ rows }: PeliculasAnaliseProps) {
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const ACCENT = '#6366f1';

  const [selectedYear, setSelectedYear] = useState<number | 'Todos'>(currentYear);
  const [monthChip, setMonthChip]       = useState<number | null>(null);
  const [periods, setPeriods] = useState<PeriodSlot[]>([
    { year: currentYear, tipo: 'mes', value: currentMonth, vendedor: 'Todos' },
  ]);
  const [sortAcess, setSortAcess] = useState<'totalRL' | 'lucro' | 'qtd'>('totalRL');
  const [selectedProduto, setSelectedProduto] = useState<string>('Todos');

  // Apenas linhas com situação válida
  const baseRows = useMemo(() => validRows(rows), [rows]);

  // Vendedores disponíveis (para o comparativo de períodos)
  const availableVendedores = useMemo(() => {
    const set = new Set<string>();
    baseRows.forEach(r => { const v = r.vendedor?.trim(); if (v) set.add(v); });
    return ['Todos', ...[...set].sort()];
  }, [baseRows]);

  // Anos disponíveis
  const availableYears = useMemo(() => {
    const years = [...new Set(baseRows.map(getRowYear).filter(y => y > 2000))].sort();
    if (!years.includes(currentYear)) years.push(currentYear);
    return years.sort();
  }, [baseRows, currentYear]);

  // Linhas filtradas
  const filteredRows = useMemo(
    () => filterRows(baseRows, selectedYear, monthChip),
    [baseRows, selectedYear, monthChip]
  );

  const metrics = useMemo(() => calcMetrics(filteredRows), [filteredRows]);

  // Métricas mês anterior (para deltas)
  const prevMonthMetrics = useMemo(() => {
    if (monthChip === null || selectedYear === 'Todos') return null;
    const prevM = monthChip === 1 ? 12 : monthChip - 1;
    const prevY = monthChip === 1 ? (selectedYear as number) - 1 : selectedYear as number;
    return calcMetrics(filterRows(baseRows, prevY, prevM));
  }, [baseRows, selectedYear, monthChip]);

  // Dados mensais
  const monthlyData = useMemo(() => {
    const maxMonth = monthChip !== null ? monthChip : 12;
    return MONTHS.slice(0, maxMonth).map((label, mi) => {
      const m = mi + 1;
      const mRows = baseRows.filter(r =>
        (selectedYear === 'Todos' || getRowYear(r) === selectedYear) && getRowMonth(r) === m
      );
      const totalVenda = mRows.reduce((a, r) => a + n(r.valorVenda), 0);
      const lucro      = mRows.reduce((a, r) => a + n(r.lucroBruto), 0);
      const rl         = mRows.reduce((a, r) => a + n(r.receitaLiquida), 0);
      const comissoes  = mRows.reduce((a, r) => a + n(r.comissaoVendedor) + n(r.comissaoVendedorAcessorios), 0);
      const pctLucro   = rl > 0 ? (lucro / rl) * 100 : 0;
      return { label, totalVenda, lucro, comissoes, pctLucro, qtd: mRows.length };
    });
  }, [baseRows, selectedYear, monthChip]);

  // Por produto
  const produtoData = useMemo(() => {
    const map = new Map<string, number>();
    filteredRows.forEach(r => {
      const key = r.produto || 'Não informado';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].map(([name, qtd]) => ({ name, qtd })).sort((a, b) => b.qtd - a.qtd);
  }, [filteredRows]);

  // Mapa de cores consistente entre gráficos (produto → cor)
  const produtoColorMap = useMemo(() => {
    const map = new Map<string, string>();
    produtoData.forEach((p, i) => map.set(p.name, PALETTE[i % PALETTE.length]));
    return map;
  }, [produtoData]);

  // Receita Líquida por produto (para gráfico de barras no modo mês)
  const produtoReceitaData = useMemo(() => {
    const map = new Map<string, { rl: number; qtd: number }>();
    filteredRows.forEach(r => {
      const key = r.produto || 'Não informado';
      const cur = map.get(key) || { rl: 0, qtd: 0 };
      map.set(key, { rl: cur.rl + n(r.receitaLiquida), qtd: cur.qtd + 1 });
    });
    return [...map.entries()]
      .map(([name, v]) => ({ name, rl: v.rl, qtd: v.qtd }))
      .sort((a, b) => b.rl - a.rl);
  }, [filteredRows]);

  // Por vendedor
  const vendedorData = useMemo(() => {
    const map = new Map<string, { qtd: number; totalVenda: number; totalRL: number; lucro: number; comissao: number }>();
    filteredRows.forEach(r => {
      const key = r.vendedor || 'Não informado';
      const cur = map.get(key) || { qtd: 0, totalVenda: 0, totalRL: 0, lucro: 0, comissao: 0 };
      map.set(key, {
        qtd: cur.qtd + 1,
        totalVenda: cur.totalVenda + n(r.valorVenda),
        totalRL: cur.totalRL + n(r.receitaLiquida),
        lucro: cur.lucro + n(r.lucroBruto),
        comissao: cur.comissao + n(r.comissaoVendedor),
      });
    });
    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        ...v,
        ticketMedio: v.qtd > 0 ? v.totalVenda / v.qtd : 0,
        pctLucro: v.totalRL > 0 ? (v.lucro / v.totalRL) * 100 : 0,
      }))
      .sort((a, b) => b.qtd - a.qtd || b.totalRL - a.totalRL);
  }, [filteredRows]);

  // Por vendedor de acessórios
  const vendedorAcessoriosData = useMemo(() => {
    const map = new Map<string, {
      qtd: number; totalVenda: number; totalRL: number; lucro: number; comissao: number;
      produtos: Map<string, { qtd: number; rl: number; lucro: number }>;
    }>();
    filteredRows.forEach(r => {
      const key = r.vendedor || 'Não informado';
      if (!map.has(key)) map.set(key, { qtd: 0, totalVenda: 0, totalRL: 0, lucro: 0, comissao: 0, produtos: new Map() });
      const cur = map.get(key)!;
      cur.qtd += 1;
      cur.totalVenda += n(r.valorVenda);
      cur.totalRL += n(r.receitaLiquida);
      cur.lucro += n(r.lucroBruto);
      cur.comissao += n(r.comissaoVendedor);
      const prod = r.produto || 'Não informado';
      if (!cur.produtos.has(prod)) cur.produtos.set(prod, { qtd: 0, rl: 0, lucro: 0 });
      const cp = cur.produtos.get(prod)!;
      cp.qtd += 1;
      cp.rl += n(r.receitaLiquida);
      cp.lucro += n(r.lucroBruto);
    });
    return [...map.entries()]
      .map(([name, v]) => {
        const TOP_N = 8;
        const prodArr = [...v.produtos.entries()]
          .map(([nome, p]) => ({ nome, ...p, pctLucro: p.rl > 0 ? (p.lucro / p.rl) * 100 : 0 }))
          .sort((a, b) => b.rl - a.rl);
        let produtos = prodArr;
        if (prodArr.length > TOP_N) {
          const top = prodArr.slice(0, TOP_N);
          const rest = prodArr.slice(TOP_N);
          top.push({
            nome: 'Outros',
            qtd: rest.reduce((s, p) => s + p.qtd, 0),
            rl: rest.reduce((s, p) => s + p.rl, 0),
            lucro: rest.reduce((s, p) => s + p.lucro, 0),
            pctLucro: rest.reduce((s, p) => s + p.rl, 0) > 0
              ? (rest.reduce((s, p) => s + p.lucro, 0) / rest.reduce((s, p) => s + p.rl, 0)) * 100 : 0,
          });
          produtos = top;
        }
        return {
          name,
          qtd: v.qtd,
          totalVenda: v.totalVenda,
          totalRL: v.totalRL,
          lucro: v.lucro,
          comissao: v.comissao,
          pctLucro: v.totalRL > 0 ? (v.lucro / v.totalRL) * 100 : 0,
          produtos,
        };
      })
      .sort((a, b) => b.totalRL - a.totalRL);
  }, [filteredRows]);

  const produtoList = useMemo(() => {
    const set = new Set<string>();
    filteredRows.forEach(r => { if (r.produto) set.add(r.produto); });
    return ['Todos', ...[...set].sort()];
  }, [filteredRows]);

  const filteredForProduto = useMemo(() => {
    if (selectedProduto === 'Todos' || !produtoList.includes(selectedProduto)) return vendedorAcessoriosData;
    return vendedorAcessoriosData
      .map(v => {
        const prodData = v.produtos.find((p: { nome: string }) => p.nome === selectedProduto);
        if (!prodData) return null;
        return {
          ...v,
          qtd: prodData.qtd,
          totalRL: prodData.rl,
          lucro: prodData.lucro,
          pctLucro: prodData.rl > 0 ? (prodData.lucro / prodData.rl) * 100 : 0,
          produtos: [prodData],
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }, [vendedorAcessoriosData, selectedProduto, produtoList]);

  const produtoSummary = useMemo(() => {
    if (selectedProduto === 'Todos') return null;
    const rl = filteredForProduto.reduce((s, v) => s + v.totalRL, 0);
    const lucro = filteredForProduto.reduce((s, v) => s + v.lucro, 0);
    const qtd = filteredForProduto.reduce((s, v) => s + v.qtd, 0);
    return { qtd, rl, lucro, pctLucro: rl > 0 ? (lucro / rl) * 100 : 0 };
  }, [filteredForProduto, selectedProduto]);

  const sortedVendedorAcess = useMemo(
    () => [...filteredForProduto].sort((a, b) => b[sortAcess] - a[sortAcess]),
    [filteredForProduto, sortAcess]
  );

  const teamRLAcess = useMemo(
    () => filteredForProduto.reduce((s, v) => s + v.totalRL, 0),
    [filteredForProduto]
  );

  // Custo de Comissões
  const custoComissoesData = useMemo(() => {
    // Grupo Vendedor
    const mapV = new Map<string, number>();
    filteredRows.forEach(r => {
      const key = r.vendedor?.trim() || 'Não informado';
      mapV.set(key, (mapV.get(key) ?? 0) + n(r.comissaoVendedor));
    });
    const grupoVendedor = [...mapV.entries()]
      .map(([nome, comissao]) => ({ nome, comissao }))
      .sort((a, b) => b.comissao - a.comissao);

    // Grupo Vendedor de Acessórios
    const mapA = new Map<string, number>();
    filteredRows.forEach(r => {
      if (!r.vendedorAcessorios?.trim()) return;
      const key = r.vendedorAcessorios.trim();
      mapA.set(key, (mapA.get(key) ?? 0) + n(r.comissaoVendedorAcessorios));
    });
    const grupoAcessorios = [...mapA.entries()]
      .map(([nome, comissao]) => ({ nome, comissao }))
      .sort((a, b) => b.comissao - a.comissao);

    const totalVendedor   = grupoVendedor.reduce((s, v) => s + v.comissao, 0);
    const totalAcessorios = grupoAcessorios.reduce((s, v) => s + v.comissao, 0);
    const totalGeral      = totalVendedor + totalAcessorios;

    return { grupoVendedor, grupoAcessorios, totalVendedor, totalAcessorios, totalGeral };
  }, [filteredRows]);

  // Comparativo de períodos
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
  const periodMetrics = useMemo(
    () => periods.map(slot => {
      const byVendedor = (r: PeliculasRow) =>
        slot.vendedor === 'Todos' || (r.vendedor?.trim() || '') === slot.vendedor;
      const slotRows     = filterByPeriod(baseRows, slot).filter(byVendedor);
      const prevSlotRows = filterByPeriod(baseRows, prevPeriodSlot(slot)).filter(byVendedor);
      return {
        slot,
        metrics: calcMetrics(slotRows),
        prevMetrics: calcMetrics(prevSlotRows),
      };
    }),
    [periods, baseRows]
  );
  const addPeriod = () => { if (periods.length < 4) setPeriods(p => [...p, { year: currentYear, tipo: 'mes', value: currentMonth, vendedor: 'Todos' }]); };
  const removePeriod = (i: number) => setPeriods(p => p.filter((_, idx) => idx !== i));
  const updatePeriod = (i: number, patch: Partial<PeriodSlot>) =>
    setPeriods(p => p.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const comparativoRows: { label: string; key: keyof Metrics; fmt: (v: number) => string; highlight?: boolean; trend?: boolean }[] = [
    { label: 'Qtd de Vendas',           key: 'qtd',                    fmt: v => String(v),  trend: true },
    { label: 'Valor da Venda',          key: 'totalVenda',             fmt: fmtBRLFull },
    { label: 'Impostos',                key: 'totalImpostos',          fmt: fmtBRLFull },
    { label: 'Receita Líquida',         key: 'totalRL',                fmt: fmtBRLFull,      trend: true },
    { label: 'Custo Prestador',         key: 'totalCusto',             fmt: fmtBRLFull },
    { label: 'Lucro Bruto',             key: 'totalLucro',             fmt: fmtBRLFull,      trend: true },
    { label: '% Lucro Bruto',           key: 'pctLucroMedio',          fmt: fmtPct,          trend: true },
    { label: 'Ticket Médio',            key: 'ticketMedio',            fmt: fmtBRLFull },
    { label: 'Com. + DSR Vendedor',      key: 'comissaoVendedorComDSR',   fmt: fmtBRLFull },
    { label: 'Com. + DSR Acessórios',    key: 'comissaoAcessoriosComDSR', fmt: fmtBRLFull },
    { label: 'Provisões',                key: 'totalProvisoes',           fmt: fmtBRLFull },
    { label: 'Encargos',                 key: 'totalEncargos',            fmt: fmtBRLFull },
    { label: 'Resultado',                key: 'resultado',                fmt: fmtBRLFull,     highlight: true, trend: true },
  ];

  const PERIOD_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#8b5cf6'];
  const periodoLabel = `${monthChip ? `${MONTHS[monthChip - 1]}/` : ''}${selectedYear === 'Todos' ? 'Todos os Anos' : selectedYear}`;

  return (
    <div className="p-4 space-y-6 bg-slate-50 min-h-full">

      {/* ── INFO situações consideradas ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 font-medium">
        <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
        Análise considera apenas registros com situação <strong className="mx-1">Encerrada</strong> ou <strong className="mx-1">Processo Finalizado</strong> — total de <strong className="ml-1">{baseRows.length} registro{baseRows.length !== 1 ? 's' : ''}</strong>
      </div>

      {/* ── FILTROS GLOBAIS ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ano</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value === 'Todos' ? 'Todos' : Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="Todos">Todos</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Mês</span>
            <button
              onClick={() => setMonthChip(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${monthChip === null ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
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
                    monthChip === month ? 'bg-indigo-500 text-white'
                    : isCurrent ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-400 hover:bg-indigo-200'
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
        <SectionTitle>Visão Geral — {periodoLabel}</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <KpiCard label="Total de Vendas"   value={String(metrics.qtd)}             color="text-slate-800"   accentColor={ACCENT} />
          <KpiCard label="Valor da Venda"    value={fmtBRL(metrics.totalVenda)}      color="text-indigo-600"  accentColor={ACCENT} />
          <KpiCard label="Receita Líquida"   value={fmtBRL(metrics.totalRL)}         color="text-sky-600"     accentColor={ACCENT}
            sub={metrics.totalVenda > 0 ? `Impostos: ${fmtBRL(metrics.totalImpostos)}` : undefined} />
          <KpiCard label="Custo Prestador"   value={fmtBRL(metrics.totalCusto)}      color="text-red-500"     accentColor={ACCENT} />
          <KpiCard label="Lucro Bruto"       value={fmtBRL(metrics.totalLucro)}      color="text-emerald-600" accentColor={ACCENT}
            sub={metrics.totalRL > 0 ? `${fmtPct(metrics.pctLucroMedio)} da RL` : undefined} />
          <KpiCard label="% Lucro Bruto Médio" value={fmtPct(metrics.pctLucroMedio)}
            color={metrics.pctLucroMedio >= 30 ? 'text-emerald-600' : metrics.pctLucroMedio >= 15 ? 'text-amber-600' : 'text-red-500'}
            accentColor={ACCENT}
            sub={metrics.qtd > 0 ? `Ticket médio: ${fmtBRL(metrics.ticketMedio)}` : undefined} />
        </div>

        {/* Cards de comissões */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <KpiCard label="Comissão Vendedor"          value={fmtBRL(metrics.totalComissaoVendedor)}   color="text-violet-600" accentColor="#8b5cf6"
            sub={metrics.totalRL > 0 ? `${fmtPct(metrics.totalComissaoVendedor / metrics.totalRL * 100)} da RL` : undefined} />
          <KpiCard label="Comissão Vendedor Acessórios" value={fmtBRL(metrics.totalComissaoAcessorios)} color="text-fuchsia-600" accentColor="#d946ef"
            sub={metrics.totalRL > 0 ? `${fmtPct(metrics.totalComissaoAcessorios / metrics.totalRL * 100)} da RL` : undefined} />
          <KpiCard label="Total de Comissões"         value={fmtBRL(metrics.totalComissoes)}          color="text-slate-800"  accentColor="#475569"
            sub={metrics.totalLucro > 0 ? `${fmtPct(metrics.totalComissoes / metrics.totalLucro * 100)} do lucro` : undefined} />
        </div>

        {/* Delta vs mês anterior */}
        {prevMonthMetrics && metrics.qtd > 0 && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-400 font-medium">vs. mês anterior:</span>
            <span className="text-xs text-slate-500">Qtd: <DeltaBadge base={prevMonthMetrics.qtd} current={metrics.qtd} /></span>
            <span className="text-xs text-slate-500">Receita RL: <DeltaBadge base={prevMonthMetrics.totalRL} current={metrics.totalRL} /></span>
            <span className="text-xs text-slate-500">Lucro: <DeltaBadge base={prevMonthMetrics.totalLucro} current={metrics.totalLucro} /></span>
            <span className="text-xs text-slate-500">Comissões: <DeltaBadge base={prevMonthMetrics.totalComissoes} current={metrics.totalComissoes} /></span>
          </div>
        )}
      </div>

      {/* ── Produto + Evolução Mensal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Pizza produtos */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SectionTitle>Distribuição por Produto</SectionTitle>
          {produtoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={produtoData}
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
                  {produtoData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(v, name) => [`${v} venda(s)`, name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        {/* Painel direito: Receita Líquida por Produto (mês selecionado) ou Evolução Mensal (ano todo) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          {monthChip !== null ? (
            <>
              <SectionTitle>Receita Líquida por Produto — {periodoLabel}</SectionTitle>
              {produtoReceitaData.length > 0 && produtoReceitaData.some(d => d.rl > 0) ? (
                <ResponsiveContainer width="100%" height={Math.max(220, produtoReceitaData.length * 58)}>
                  <BarChart
                    data={produtoReceitaData}
                    layout="vertical"
                    margin={{ left: 8, right: 72, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip
                      formatter={(value: number, name: string) => [fmtBRLFull(value), name]}
                      labelFormatter={label => `Produto: ${label}`}
                    />
                    <Bar
                      dataKey="rl"
                      name="Receita Líquida"
                      radius={[0, 4, 4, 0]}
                      label={({ x, y, width, height, index }: { x: number; y: number; width: number; height: number; index: number }) => {
                        const entry = produtoReceitaData[index];
                        if (!entry) return null;
                        return (
                          <text
                            x={x + width + 8}
                            y={y + height / 2}
                            dy={4}
                            fontSize={11}
                            fill="#64748b"
                            fontWeight={600}
                          >
                            {entry.qtd}x
                          </text>
                        );
                      }}
                    >
                      {produtoReceitaData.map((entry, i) => (
                        <Cell key={i} fill={produtoColorMap.get(entry.name) ?? PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </>
          ) : (
            <>
              <SectionTitle>Evolução Mensal — {selectedYear === 'Todos' ? 'Todos os Anos' : selectedYear}</SectionTitle>
              {monthlyData.some(d => d.totalVenda > 0) ? (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={monthlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left"  tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10 }} width={90} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} width={45} />
                    <Tooltip content={<CustomTooltipBRL />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left"  dataKey="totalVenda" name="Valor da Venda"  fill="#6366f1" radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="left"  dataKey="lucro"      name="Lucro Bruto"     fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="left"  dataKey="comissoes"  name="Total Comissões" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="pctLucro" name="% Lucro" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </>
          )}
        </div>
      </div>

      {/* ── Performance Vendedores ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <SectionTitle>Performance por Vendedor</SectionTitle>
          {vendedorData.length > 0 && (
            <span className="text-xs text-slate-400 font-medium px-2.5 py-1 bg-slate-100 rounded-full">
              {vendedorData.length} vendedor{vendedorData.length !== 1 ? 'es' : ''}
            </span>
          )}
        </div>

        {vendedorData.length > 0 ? (
          <div className="space-y-6">
            {/* Pódio Top 3 */}
            {(() => {
              const totalQtd  = vendedorData.reduce((s, v) => s + v.qtd, 0);
              const medals    = ['🥇', '🥈', '🥉'];
              const gradients = ['from-indigo-400 to-indigo-600', 'from-slate-400 to-slate-500', 'from-violet-400 to-violet-500'];
              const bgBorder  = ['bg-indigo-50 border-indigo-200', 'bg-slate-50 border-slate-200', 'bg-violet-50 border-violet-200'];
              const textAccent = ['text-indigo-600', 'text-slate-600', 'text-violet-600'];
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {vendedorData.slice(0, 3).map((v, i) => {
                    const topQtd  = vendedorData[0].qtd;
                    const barPct  = topQtd > 0 ? (v.qtd / topQtd) * 100 : 0;
                    const volPct  = totalQtd > 0 ? (v.qtd / totalQtd) * 100 : 0;
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
                            <p className="text-xs text-slate-400 mb-0.5">Receita Líquida</p>
                            <p className={`text-lg font-bold font-mono ${textAccent[i]}`}>{fmtBRL(v.totalRL)}</p>
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
                            <p className="text-xs text-slate-400">Lucro Bruto: <span className={`font-semibold font-mono ${textAccent[i]}`}>{fmtBRL(v.lucro)}</span></p>
                            <p className="text-xs text-slate-400">% Lucro: <span className="font-semibold font-mono text-emerald-600">{fmtPct(v.pctLucro)}</span></p>
                            <p className="text-xs text-slate-400">Comissão: <span className="font-semibold font-mono text-violet-600">{fmtBRL(v.comissao)}</span></p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Tabela todos os vendedores */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Todos os Vendedores</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-2 text-slate-400 font-semibold w-8">#</th>
                      <th className="text-left py-2 px-2 text-slate-400 font-semibold">Vendedor</th>
                      <th className="text-right py-2 px-2 text-slate-400 font-semibold">Qtd</th>
                      <th className="text-right py-2 px-2 text-slate-400 font-semibold">Receita Líquida</th>
                      <th className="text-right py-2 px-2 text-slate-400 font-semibold">Lucro Bruto</th>
                      <th className="text-right py-2 px-2 text-slate-400 font-semibold">% Lucro</th>
                      <th className="text-right py-2 px-2 text-slate-400 font-semibold">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendedorData.map((v, i) => (
                      <tr key={v.name} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i < 3 ? 'font-semibold' : ''}`}>
                        <td className="py-2 px-2 text-slate-400 font-bold">#{i + 1}</td>
                        <td className="py-2 px-2 text-slate-700">{v.name}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-600">{v.qtd}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-mono text-indigo-600">{fmtBRL(v.totalRL)}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-mono text-emerald-600">{fmtBRL(v.lucro)}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-mono text-amber-600">{fmtPct(v.pctLucro)}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-mono text-violet-600">{fmtBRL(v.comissao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : <EmptyChart />}
      </div>

      {/* ── Performance Vendedor por Produto ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <SectionTitle>Performance Vendedor por Produto</SectionTitle>
            {sortedVendedorAcess.length > 0 && (
              <span className="text-xs text-slate-400 font-medium px-2.5 py-1 bg-slate-100 rounded-full -mt-3">
                {sortedVendedorAcess.length} vendedor{sortedVendedorAcess.length !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
          {sortedVendedorAcess.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 -mt-3">
              {(['totalRL', 'lucro', 'qtd'] as const).map(key => (
                <button
                  key={key}
                  onClick={() => setSortAcess(key)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    sortAcess === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {key === 'totalRL' ? 'Receita' : key === 'lucro' ? 'Lucro' : 'Volume'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filtro por Produto */}
        {produtoList.length > 1 && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Produto</span>
              <select
                value={selectedProduto}
                onChange={e => setSelectedProduto(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-400 text-slate-700"
              >
                {produtoList.map(p => (
                  <option key={p} value={p}>{p === 'Todos' ? 'Todos os produtos' : p}</option>
                ))}
              </select>
            </div>
            {produtoSummary && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-fuchsia-50 border border-fuchsia-200 rounded-lg flex-wrap">
                <span className="text-xs font-bold text-fuchsia-700">{selectedProduto}</span>
                <span className="text-slate-300 text-xs">·</span>
                <span className="text-xs text-slate-500">{produtoSummary.qtd} venda{produtoSummary.qtd !== 1 ? 's' : ''}</span>
                <span className="text-slate-300 text-xs">·</span>
                <span className="text-xs font-mono font-semibold text-fuchsia-600">{fmtBRL(produtoSummary.rl)}</span>
                <span className="text-xs text-slate-400">RL total</span>
                <span className="text-slate-300 text-xs">·</span>
                <span className="text-xs font-mono font-semibold text-emerald-600">{fmtBRL(produtoSummary.lucro)}</span>
                <span className="text-xs text-slate-400">Lucro</span>
                <span className="text-slate-300 text-xs">·</span>
                <span className={`text-xs font-bold ${produtoSummary.pctLucro >= 40 ? 'text-emerald-600' : produtoSummary.pctLucro >= 20 ? 'text-amber-600' : 'text-red-500'}`}>
                  {fmtPct(produtoSummary.pctLucro)}
                </span>
              </div>
            )}
          </div>
        )}

        {sortedVendedorAcess.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedVendedorAcess.map((v, i) => {
              const initials = v.name.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
              const shareRL = teamRLAcess > 0 ? (v.totalRL / teamRLAcess) * 100 : 0;
              const maxProdRL = v.produtos[0]?.rl ?? 1;
              const pctBg = v.pctLucro >= 40 ? 'bg-emerald-50 text-emerald-700' : v.pctLucro >= 20 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600';
              const gradients = [
                'from-fuchsia-400 to-violet-600',
                'from-indigo-400 to-indigo-600',
                'from-sky-400 to-cyan-600',
                'from-emerald-400 to-teal-600',
                'from-amber-400 to-orange-500',
              ];
              const grad = gradients[i % gradients.length];
              return (
                <div key={v.name} className="rounded-xl border border-slate-200 overflow-hidden flex flex-col bg-white hover:shadow-md transition-shadow">
                  {/* Header */}
                  <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
                          {initials}
                        </div>
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                          {i + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate leading-tight">{v.name}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-xs text-slate-500">{v.qtd} venda{v.qtd !== 1 ? 's' : ''}</span>
                          <span className="text-slate-300 text-xs">·</span>
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${pctBg}`}>{fmtPct(v.pctLucro)} lucro</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-base font-bold font-mono text-fuchsia-600">{fmtBRL(v.totalRL)}</p>
                        <p className="text-[10px] text-slate-400 leading-tight">Receita Líquida</p>
                      </div>
                    </div>
                    {/* Barra de participação na equipe */}
                    <div className="mt-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-slate-400">Participação na equipe</span>
                        <span className="text-[10px] font-bold text-slate-500">{fmtPct(shareRL)}</span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-1 rounded-full bg-gradient-to-r ${grad} transition-all`} style={{ width: `${Math.min(shareRL, 100)}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Breakdown por produto */}
                  <div className="px-4 py-3 flex-1 space-y-2.5">
                    {v.produtos.map((p: { nome: string; qtd: number; rl: number; lucro: number; pctLucro: number }, pi: number) => {
                      const barW = maxProdRL > 0 ? Math.max((p.rl / maxProdRL) * 100, 2) : 0;
                      const prodColor = PALETTE[pi % PALETTE.length];
                      const prodPctText = p.pctLucro >= 40 ? 'text-emerald-600' : p.pctLucro >= 20 ? 'text-amber-600' : 'text-red-500';
                      return (
                        <div key={p.nome}>
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: prodColor }} />
                              <span className="text-xs text-slate-600 truncate font-medium">{p.nome}</span>
                              <span className="text-[10px] text-slate-400 flex-shrink-0 bg-slate-100 px-1 rounded">{p.qtd}x</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-[10px] font-bold ${prodPctText}`}>{fmtPct(p.pctLucro)}</span>
                              <span className="text-xs font-mono font-semibold text-slate-700">{fmtBRL(p.rl)}</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${barW}%`, background: prodColor }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Lucro Bruto: <span className="font-semibold text-emerald-600 font-mono">{fmtBRL(v.lucro)}</span></span>
                    <span className="text-xs text-slate-400">Comissão: <span className="font-semibold text-violet-600 font-mono">{fmtBRL(v.comissao)}</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EmptyChart />}
      </div>

      {/* ── Custo de Comissões ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-5">
          <SectionTitle>Custo de Comissões por Vendedor</SectionTitle>
        </div>

        {custoComissoesData.totalGeral > 0 ? (
          <div className="space-y-6">

            {/* Gráfico de barras horizontais — Grupo Vendedor vs Acessórios */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Custo de Comissões por Grupo</p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart
                  layout="vertical"
                  data={[
                    { grupo: 'Vendedor',   comissao: custoComissoesData.totalVendedor },
                    { grupo: 'Acessórios', comissao: custoComissoesData.totalAcessorios },
                  ]}
                  margin={{ left: 8, right: 80, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="grupo" tick={{ fontSize: 12, fontWeight: 600 }} width={100} />
                  <Tooltip formatter={(v: number) => [fmtBRLFull(v), 'Comissão']} />
                  <Bar dataKey="comissao" name="Comissão" radius={[0, 6, 6, 0]} maxBarSize={32}
                    label={{ position: 'right', formatter: (v: number) => fmtBRL(v), fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                  >
                    <Cell fill="#6366f1" />
                    <Cell fill="#d946ef" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabela agrupada */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Vendedor</th>
                    <th className="text-right py-2 px-3 text-slate-400 font-semibold">Comissão</th>
                    <th className="text-right py-2 px-3 text-slate-400 font-semibold">DSR</th>
                    <th className="text-right py-2 px-3 text-slate-400 font-semibold">Total Com. + DSR</th>
                    <th className="text-right py-2 px-3 text-slate-400 font-semibold">Provisões</th>
                    <th className="text-right py-2 px-3 text-slate-400 font-semibold">Encargos</th>
                    <th className="text-right py-2 px-3 text-slate-400 font-semibold bg-slate-50">Custo Folha</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Grupo Vendedor */}
                  <tr className="bg-indigo-50">
                    <td colSpan={7} className="py-1.5 px-3 text-[11px] font-bold text-indigo-600 uppercase tracking-widest">Vendedor</td>
                  </tr>
                  {custoComissoesData.grupoVendedor.map(v => {
                    const dsr = 0; // fórmula a definir
                    const totalComDsr = v.comissao + dsr;
                    const provisoes = 0; // fórmula a definir
                    const encargos = 0;  // fórmula a definir
                    const custoFolha = totalComDsr + provisoes + encargos;
                    return (
                      <tr key={`v-${v.nome}`} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 text-slate-700 font-medium">{v.nome}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-indigo-600">{fmtBRL(v.comissao)}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-400">{fmtBRL(dsr)}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-600">{fmtBRL(totalComDsr)}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-400">{fmtBRL(provisoes)}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-400">{fmtBRL(encargos)}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono font-bold text-slate-800 bg-slate-50">{fmtBRL(custoFolha)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-indigo-50/60 font-semibold border-t border-indigo-100">
                    <td className="py-2 px-3 text-indigo-700 text-[11px] font-bold uppercase">Subtotal Vendedor</td>
                    <td className="py-2 px-3 text-right tabular-nums font-mono text-indigo-700">{fmtBRL(custoComissoesData.totalVendedor)}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-400">{fmtBRL(0)}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-600">{fmtBRL(custoComissoesData.totalVendedor)}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-400">{fmtBRL(0)}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-400">{fmtBRL(0)}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-mono font-bold text-indigo-700 bg-slate-50">{fmtBRL(custoComissoesData.totalVendedor)}</td>
                  </tr>

                  {/* Grupo Vendedor de Acessórios */}
                  {custoComissoesData.grupoAcessorios.length > 0 && (
                    <>
                      <tr className="bg-fuchsia-50">
                        <td colSpan={7} className="py-1.5 px-3 text-[11px] font-bold text-fuchsia-600 uppercase tracking-widest">Vendedor de Acessórios</td>
                      </tr>
                      {custoComissoesData.grupoAcessorios.map(v => {
                        const dsr = 0;
                        const totalComDsr = v.comissao + dsr;
                        const provisoes = 0;
                        const encargos = 0;
                        const custoFolha = totalComDsr + provisoes + encargos;
                        return (
                          <tr key={`a-${v.nome}`} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 text-slate-700 font-medium">{v.nome}</td>
                            <td className="py-2 px-3 text-right tabular-nums font-mono text-fuchsia-600">{fmtBRL(v.comissao)}</td>
                            <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-400">{fmtBRL(dsr)}</td>
                            <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-600">{fmtBRL(totalComDsr)}</td>
                            <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-400">{fmtBRL(provisoes)}</td>
                            <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-400">{fmtBRL(encargos)}</td>
                            <td className="py-2 px-3 text-right tabular-nums font-mono font-bold text-slate-800 bg-slate-50">{fmtBRL(custoFolha)}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-fuchsia-50/60 font-semibold border-t border-fuchsia-100">
                        <td className="py-2 px-3 text-fuchsia-700 text-[11px] font-bold uppercase">Subtotal Acessórios</td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-fuchsia-700">{fmtBRL(custoComissoesData.totalAcessorios)}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-400">{fmtBRL(0)}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-600">{fmtBRL(custoComissoesData.totalAcessorios)}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-400">{fmtBRL(0)}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-slate-400">{fmtBRL(0)}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono font-bold text-fuchsia-700 bg-slate-50">{fmtBRL(custoComissoesData.totalAcessorios)}</td>
                      </tr>
                    </>
                  )}

                  {/* Total Geral */}
                  <tr className="bg-slate-800 text-white">
                    <td className="py-2.5 px-3 text-[11px] font-bold uppercase tracking-widest">Total Geral</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-mono font-bold">{fmtBRL(custoComissoesData.totalGeral)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-mono">{fmtBRL(0)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-mono font-bold">{fmtBRL(custoComissoesData.totalGeral)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-mono">{fmtBRL(0)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-mono">{fmtBRL(0)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-mono font-bold">{fmtBRL(custoComissoesData.totalGeral)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Nota sobre fórmulas pendentes */}
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              Fórmulas de DSR, Provisões e Encargos serão configuradas em breve.
            </div>
          </div>
        ) : <EmptyChart />}
      </div>

      {/* ── Comparativo de Períodos ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Comparativo de Períodos</SectionTitle>
          {periods.length < 4 && (
            <button
              onClick={addPeriod}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              + Adicionar período
            </button>
          )}
        </div>

        {/* Seletores de período */}
        <div className="flex flex-wrap gap-3 mb-5">
          {periods.map((p, i) => (
            <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 px-3 py-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PERIOD_COLORS[i] }} />
              <select
                value={p.year}
                onChange={e => updatePeriod(i, { year: Number(e.target.value) })}
                className="border-0 bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
              >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                value={p.tipo}
                onChange={e => updatePeriod(i, { tipo: e.target.value as PeriodType, value: 1 })}
                className="border-0 bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
              >
                {periodoOptions.map(o => <option key={o.tipo} value={o.tipo}>{o.label}</option>)}
              </select>
              <select
                value={p.value}
                onChange={e => updatePeriod(i, { value: Number(e.target.value) })}
                className="border-0 bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
              >
                {periodoValueLabels[p.tipo].map((lbl, vi) => (
                  <option key={vi} value={vi + 1}>{lbl}</option>
                ))}
              </select>
              {availableVendedores.length > 1 && (
                <select
                  value={p.vendedor}
                  onChange={e => updatePeriod(i, { vendedor: e.target.value })}
                  className="border-0 bg-transparent text-xs font-semibold focus:outline-none max-w-[120px] truncate"
                  style={{ color: p.vendedor === 'Todos' ? '#94a3b8' : PERIOD_COLORS[i] }}
                  title={p.vendedor === 'Todos' ? 'Todos os vendedores' : p.vendedor}
                >
                  {availableVendedores.map(v => (
                    <option key={v} value={v}>{v === 'Todos' ? 'Todos vendedores' : v}</option>
                  ))}
                </select>
              )}
              <span className="text-xs text-slate-400 font-medium">{periodLabel(p.tipo, p.value, p.year)}</span>
              {periods.length > 1 && (
                <button onClick={() => removePeriod(i)} className="text-slate-300 hover:text-red-400 transition-colors ml-1">✕</button>
              )}
            </div>
          ))}
        </div>

        {/* Tabela comparativa */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-2 px-3 text-slate-500 font-semibold">Métrica</th>
                {periodMetrics.map(({ slot }, i) => (
                  <th key={i} className="text-right py-2 px-3 font-bold" style={{ color: PERIOD_COLORS[i] }}>
                    {periodLabel(slot.tipo, slot.value, slot.year)}
                  </th>
                ))}
                {periodMetrics.length === 2 && (
                  <th className="text-right py-2 px-3 text-slate-400 font-semibold">Δ %</th>
                )}
              </tr>
            </thead>
            <tbody>
              {comparativoRows.map(row => (
                <tr
                  key={row.key}
                  className={row.highlight
                    ? 'border-t-2 border-indigo-200 bg-indigo-50'
                    : 'border-b border-slate-50 hover:bg-slate-50 transition-colors'
                  }
                >
                  <td className={`py-2 px-3 font-semibold ${row.highlight ? 'text-indigo-700' : 'text-slate-600'}`}>{row.label}</td>
                  {periodMetrics.map(({ metrics: m, prevMetrics: prev }, i) => (
                    <td key={i} className={`py-2 px-3 text-right ${row.highlight ? 'text-indigo-700 font-bold' : 'text-slate-700'}`}>
                      {row.trend ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="font-mono tabular-nums">{row.fmt(m[row.key] as number)}</span>
                          <DeltaBadge base={prev[row.key] as number} current={m[row.key] as number} />
                        </div>
                      ) : (
                        <span className="font-mono tabular-nums">{row.fmt(m[row.key] as number)}</span>
                      )}
                    </td>
                  ))}
                  {periodMetrics.length === 2 && (
                    <td className="py-2 px-3 text-right">
                      <DeltaBadge
                        base={periodMetrics[0].metrics[row.key] as number}
                        current={periodMetrics[1].metrics[row.key] as number}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
