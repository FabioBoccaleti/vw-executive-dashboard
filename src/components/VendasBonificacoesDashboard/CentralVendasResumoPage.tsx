import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Printer, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { loadVendasResultadoRows, type VendasResultadoRow } from './vendasResultadoStorage';
import { loadVPecasRows, type VPecasRow } from './vPecasStorage';
import { loadAliquotas } from './vendedoresRemuneracaoStorage';

// ─── Helpers numéricos ────────────────────────────────────────────────────────
const n = (v?: string | null) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtBRLF = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number, d = 1) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';

// ─── Meses ────────────────────────────────────────────────────────────────────
const MONTHS_LABEL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ─── Cores por departamento ───────────────────────────────────────────────────
const DEPT_COLORS: Record<string, string> = {
  novos:   '#1d4ed8',
  usados:  '#7c3aed',
  direta:  '#0891b2',
  pecas:   '#059669',
  oficina: '#d97706',
  funilaria: '#db2777',
  acessorios: '#ea580c',
};

// ─── Período ──────────────────────────────────────────────────────────────────
function getYrMo(row: VendasResultadoRow): { yr: number; mo: number } {
  if (row.periodoImport) {
    const [y, m] = row.periodoImport.split('-').map(Number);
    if (y > 2000 && m >= 1 && m <= 12) return { yr: y, mo: m };
  }
  const d = row.dataVenda;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return { yr: +d.split('/')[2], mo: +d.split('/')[1] };
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return { yr: +d.split('-')[0], mo: +d.split('-')[1] };
  return { yr: 0, mo: 0 };
}

function getYrMoVPecas(row: VPecasRow): { yr: number; mo: number } {
  if (row.periodoImport) {
    const [y, m] = row.periodoImport.split('-').map(Number);
    if (y > 2000 && m >= 1 && m <= 12) return { yr: y, mo: m };
  }
  const d = row.data['DTA_DOCUMENTO'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return { yr: +d.split('/')[2], mo: +d.split('/')[1] };
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return { yr: +d.split('-')[0], mo: +d.split('-')[1] };
  return { yr: 0, mo: 0 };
}

function getDiaVenda(row: VendasResultadoRow): number {
  const d = row.dataVenda;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[2];
  return 0;
}

function getDiaVPecas(row: VPecasRow): number {
  const d = row.data['DTA_DOCUMENTO'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[2];
  return 0;
}

// ─── Cálculos de LB por fonte ─────────────────────────────────────────────────
function calcNovosRow(r: VendasResultadoRow, aliqBon: number): { recLiq: number; lb: number } {
  const recLiq = n(r.valorVenda) - n(r.impostos);
  const bv = n(r.bonusVarejo), bt = n(r.bonusTradeIn);
  const lb = recLiq - n(r.valorCusto) + bv + bt - (bv + bt) * aliqBon / 100;
  return { recLiq, lb };
}

function calcImpostosUsados(valorVenda: number, valorCusto: number): number {
  const parte1 = valorVenda * 0.018;
  const base   = valorVenda - valorCusto - parte1;
  return parte1 + (base > 0 ? base * 0.0365 : 0);
}

function calcUsadosRow(r: VendasResultadoRow, aliqBon: number): { recLiq: number; lb: number } {
  const impostosBase = calcImpostosUsados(n(r.valorVenda), n(r.valorCusto));
  const recLiq = n(r.valorVenda) - impostosBase;
  const bv = n(r.bonusVarejo);
  const lb = recLiq - n(r.valorCusto) + bv - bv * aliqBon / 100;
  return { recLiq, lb };
}

function calcDiretaRow(r: VendasResultadoRow): { recLiq: number; lb: number } {
  const comBruta = n(r.valorVenda) * n(r.pctComissao) / 100;
  const recLiq   = n(r.valorVenda);
  const lb       = comBruta - n(r.impostos);
  return { recLiq, lb };
}

function calcPecasRow(d: Record<string, string>): { recLiq: number; lb: number; custo: number } {
  const valorVenda    = n(d['LIQ_NOTA_FISCAL']);
  const icms          = n(d['VAL_ICMS']);
  const pis           = n(d['VAL_PIS']);
  const cofins        = n(d['VAL_COFINS']);
  const difal         = n(d['VAL_ICMS_PARTIL_UF_DEST']) + n(d['VAL_ICMS_COMB_POBREZA']);
  const totalImpostos = icms + pis + cofins + difal;
  const recLiq        = valorVenda - totalImpostos;
  const custo         = n(d['TOT_CUSTO_MEDIO']);
  const lb            = recLiq - custo;
  return { recLiq, lb, custo };
}

function calcServicosRow(d: Record<string, string>): { recLiq: number } {
  const valorVenda    = n(d['LIQ_NOTA_FISCAL']);
  const iss           = n(d['VAL_ISS']);
  const icms          = n(d['VAL_ICMS']);
  const pis           = n(d['VAL_PIS']);
  const cofins        = n(d['VAL_COFINS']);
  const difal         = n(d['VAL_ICMS_PARTIL_UF_DEST']) + n(d['VAL_ICMS_COMB_POBREZA']);
  const totalImpostos = iss + icms + pis + cofins + difal;
  return { recLiq: valorVenda - totalImpostos };
}

// ─── Tipagem resultado agregado por departamento ──────────────────────────────
interface DeptResult {
  id: string;
  label: string;
  vol: number;        // quantidade (veículos ou NFs)
  recLiq: number;
  lb: number;         // NaN = não disponível (serviços)
  lbPct: number;      // NaN = não disponível
  recDia: number;     // recLiq / diasUteis
  hasLB: boolean;
  ticketMedio: number;  // recLiq / vol — veículos apenas
  showTicket: boolean;  // true para novos, usados, direta
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function CentralVendasResumoPage() {
  const CURRENT_YEAR = new Date().getFullYear();
  const CURRENT_MONTH = new Date().getMonth() + 1;

  const [year,  setYear]  = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(CURRENT_MONTH);

  // Dias úteis editável
  const [diasUteis, setDiasUteis] = useState(22);

  // Dados brutos
  const [rowsNovos,   setRowsNovos]   = useState<VendasResultadoRow[]>([]);
  const [rowsUsados,  setRowsUsados]  = useState<VendasResultadoRow[]>([]);
  const [rowsDireta,  setRowsDireta]  = useState<VendasResultadoRow[]>([]);
  const [rowsVPecas,  setRowsVPecas]  = useState<VPecasRow[]>([]);
  const [aliqBon,     setAliqBon]     = useState(0);
  const [loading,     setLoading]     = useState(true);

  // Seções expansíveis
  const [chartExpanded, setChartExpanded] = useState(true);
  const [dailyExpanded, setDailyExpanded] = useState(true);

  // ── Carrega dados ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadVendasResultadoRows('novos'),
      loadVendasResultadoRows('usados'),
      loadVendasResultadoRows('direta'),
      loadVPecasRows(),
      loadAliquotas(),
    ]).then(([novos, usados, direta, vpecas, aliq]) => {
      setRowsNovos(novos);
      setRowsUsados(usados);
      setRowsDireta(direta);
      setRowsVPecas(vpecas);
      const al = Array.isArray(aliq) && aliq.length ? aliq[0] : null;
      setAliqBon(al ? (parseFloat(String(al.bonificacao ?? '').replace(',', '.')) || 0) : 0);
      setLoading(false);
    });
  }, []);

  // ── Calcula dados para um mês/ano específico ──────────────────────────────
  const calcMonth = useMemo(() => {
    return (yr: number, mo: number): DeptResult[] => {
      // — Novos —
      const novosRows = rowsNovos.filter(r => { const { yr: y, mo: m } = getYrMo(r); return y === yr && m === mo; });
      let novosRecLiq = 0, novosLb = 0;
      for (const r of novosRows) {
        const c = calcNovosRow(r, aliqBon);
        novosRecLiq += c.recLiq;
        novosLb     += c.lb;
      }
      const novosVol = novosRows.filter(r => r.transacao !== 'V07').length;

      // — Usados —
      const usadosRows = rowsUsados.filter(r => { const { yr: y, mo: m } = getYrMo(r); return y === yr && m === mo; });
      let usadosRecLiq = 0, usadosLb = 0;
      for (const r of usadosRows) {
        const c = calcUsadosRow(r, aliqBon);
        usadosRecLiq += c.recLiq;
        usadosLb     += c.lb;
      }
      const usadosVol = usadosRows.filter(r => r.transacao !== 'U07').length;

      // — VD / Frotista —
      const diretaRows = rowsDireta.filter(r => { const { yr: y, mo: m } = getYrMo(r); return y === yr && m === mo; });
      let diretaRecLiq = 0, diretaLb = 0;
      for (const r of diretaRows) {
        const c = calcDiretaRow(r);
        diretaRecLiq += c.recLiq;
        diretaLb     += c.lb;
      }
      const diretaVol = diretaRows.length;

      // — Peças (dept 103, NFs normais — exclui RPS/OS) —
      const pecasDepts = ['103'];
      const pecasRows = rowsVPecas.filter(r => {
        const { yr: y, mo: m } = getYrMoVPecas(r);
        const dept  = r.data['DEPARTAMENTO']?.trim() ?? '';
        const serie = r.data['SERIE_NOTA_FISCAL']?.trim() ?? '';
        return y === yr && m === mo && pecasDepts.includes(dept) && serie !== 'RPS';
      });
      let pecasRecLiq = 0, pecasLb = 0;
      for (const r of pecasRows) {
        const c = calcPecasRow(r.data);
        pecasRecLiq += c.recLiq;
        pecasLb     += c.lb;
      }

      // — Oficina (dept 104, 122, somente RPS/OS) —
      const oficinaDepts = ['104', '122'];
      const oficinaRows = rowsVPecas.filter(r => {
        const { yr: y, mo: m } = getYrMoVPecas(r);
        const dept  = r.data['DEPARTAMENTO']?.trim() ?? '';
        const serie = r.data['SERIE_NOTA_FISCAL']?.trim() ?? '';
        return y === yr && m === mo && oficinaDepts.includes(dept) && serie === 'RPS';
      });
      let oficinaRecLiq = 0;
      for (const r of oficinaRows) { oficinaRecLiq += calcServicosRow(r.data).recLiq; }

      // — Funilaria (dept 106, 129, somente RPS/OS) —
      const funilariaDepts = ['106', '129'];
      const funitariaRows = rowsVPecas.filter(r => {
        const { yr: y, mo: m } = getYrMoVPecas(r);
        const dept  = r.data['DEPARTAMENTO']?.trim() ?? '';
        const serie = r.data['SERIE_NOTA_FISCAL']?.trim() ?? '';
        return y === yr && m === mo && funilariaDepts.includes(dept) && serie === 'RPS';
      });
      let funitariaRecLiq = 0;
      for (const r of funitariaRows) { funitariaRecLiq += calcServicosRow(r.data).recLiq; }

      // — Acessórios (dept 107, somente RPS/OS) —
      const acessoriosDepts = ['107'];
      const acessoriosRows = rowsVPecas.filter(r => {
        const { yr: y, mo: m } = getYrMoVPecas(r);
        const dept  = r.data['DEPARTAMENTO']?.trim() ?? '';
        const serie = r.data['SERIE_NOTA_FISCAL']?.trim() ?? '';
        return y === yr && m === mo && acessoriosDepts.includes(dept) && serie === 'RPS';
      });
      let acessoriosRecLiq = 0;
      for (const r of acessoriosRows) { acessoriosRecLiq += calcServicosRow(r.data).recLiq; }

      const make = (id: string, label: string, vol: number, recLiq: number, lb: number | null, hasLB: boolean): DeptResult => ({
        id, label, vol, recLiq,
        lb: hasLB ? (lb ?? 0) : NaN,
        lbPct: hasLB && recLiq ? ((lb ?? 0) / recLiq * 100) : NaN,
        recDia: diasUteis > 0 ? recLiq / diasUteis : 0,
        hasLB,
        ticketMedio: vol > 0 ? recLiq / vol : 0,
        showTicket: ['novos', 'usados', 'direta'].includes(id),
      });

      return [
        make('novos',      'Novos',          novosVol,    novosRecLiq,    novosLb,    true),
        make('usados',     'Usados',         usadosVol,   usadosRecLiq,   usadosLb,   true),
        make('direta',     'VD / Frotista',  diretaVol,   diretaRecLiq,   diretaLb,   true),
        make('pecas',      'Peças',          pecasRows.length, pecasRecLiq, pecasLb,  true),
        make('oficina',    'Oficina',        oficinaRows.length,  oficinaRecLiq,  null, false),
        make('funilaria',  'Funilaria',      funitariaRows.length, funitariaRecLiq, null, false),
        make('acessorios', 'Acessórios',       acessoriosRows.length, acessoriosRecLiq, null, false),
      ];
    };
  }, [rowsNovos, rowsUsados, rowsDireta, rowsVPecas, aliqBon, diasUteis]);

  // Dados do mês selecionado e mês anterior
  const deptsCurrent  = useMemo(() => calcMonth(year, month), [calcMonth, year, month]);
  const prevYear  = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const deptsPrev = useMemo(() => calcMonth(prevYear, prevMonth), [calcMonth, prevYear, prevMonth]);

  // ── KPIs consolidados ────────────────────────────────────────────────────
  const totalRecLiqCurrent = deptsCurrent.reduce((s, d) => s + d.recLiq, 0);
  const totalRecLiqPrev    = deptsPrev.reduce((s, d) => s + d.recLiq, 0);
  const totalLbCurrent     = deptsCurrent.filter(d => d.hasLB).reduce((s, d) => s + d.lb, 0);
  const totalLbPctCurrent  = totalRecLiqCurrent ? totalLbCurrent / totalRecLiqCurrent * 100 : 0;
  const totalLbPrev        = deptsPrev.filter(d => d.hasLB).reduce((s, d) => s + d.lb, 0);
  const totalLbPctPrev     = totalRecLiqPrev ? totalLbPrev / totalRecLiqPrev * 100 : 0;
  const recDiaTotal        = diasUteis > 0 ? totalRecLiqCurrent / diasUteis : 0;
  const deltaRecLiq        = totalRecLiqCurrent - totalRecLiqPrev;
  const deltaRecLiqPct     = totalRecLiqPrev ? deltaRecLiq / totalRecLiqPrev * 100 : 0;
  const progressoPct       = totalRecLiqPrev ? Math.min(totalRecLiqCurrent / totalRecLiqPrev * 100, 200) : 0;
  const gapParaAnterior    = totalRecLiqPrev - totalRecLiqCurrent;

  // ── Dados do gráfico comparativo ─────────────────────────────────────────
  const chartData = deptsCurrent.map((d, i) => ({
    name: d.label,
    'Mês Atual': Math.round(d.recLiq / 1000),
    'Mês Anterior': Math.round(deptsPrev[i].recLiq / 1000),
    color: DEPT_COLORS[d.id] ?? '#64748b',
  }));

  // ── Dados diários por departamento ────────────────────────────────────────
  const dailyData = useMemo(() => {
    const map: Record<number, { novos: number; usados: number; direta: number; pecas: number; oficina: number; funilaria: number; acessorios: number }> = {};
    for (let d = 1; d <= 31; d++) {
      map[d] = { novos: 0, usados: 0, direta: 0, pecas: 0, oficina: 0, funilaria: 0, acessorios: 0 };
    }
    rowsNovos
      .filter(r => { const { yr: y, mo: m } = getYrMo(r); return y === year && m === month; })
      .forEach(r => { const dia = getDiaVenda(r); if (dia > 0) map[dia].novos += calcNovosRow(r, aliqBon).recLiq; });
    rowsUsados
      .filter(r => { const { yr: y, mo: m } = getYrMo(r); return y === year && m === month; })
      .forEach(r => { const dia = getDiaVenda(r); if (dia > 0) map[dia].usados += calcUsadosRow(r, aliqBon).recLiq; });
    rowsDireta
      .filter(r => { const { yr: y, mo: m } = getYrMo(r); return y === year && m === month; })
      .forEach(r => { const dia = getDiaVenda(r); if (dia > 0) map[dia].direta += calcDiretaRow(r).recLiq; });
    rowsVPecas
      .filter(r => { const { yr: y, mo: m } = getYrMoVPecas(r); return y === year && m === month; })
      .forEach(r => {
        const dia   = getDiaVPecas(r);
        const dept  = r.data['DEPARTAMENTO']?.trim() ?? '';
        const serie = r.data['SERIE_NOTA_FISCAL']?.trim() ?? '';
        if (dia > 0) {
          if (dept === '103' && serie !== 'RPS')               map[dia].pecas      += calcPecasRow(r.data).recLiq;
          else if (['104','122'].includes(dept) && serie === 'RPS') map[dia].oficina    += calcServicosRow(r.data).recLiq;
          else if (['106','129'].includes(dept) && serie === 'RPS') map[dia].funilaria  += calcServicosRow(r.data).recLiq;
          else if (dept === '107'               && serie === 'RPS') map[dia].acessorios += calcServicosRow(r.data).recLiq;
        }
      });
    return Object.entries(map)
      .map(([dia, vals]) => ({ dia: Number(dia), ...vals, total: vals.novos + vals.usados + vals.direta + vals.pecas + vals.oficina + vals.funilaria + vals.acessorios }))
      .filter(d => d.total > 0)
      .sort((a, b) => a.dia - b.dia);
  }, [rowsNovos, rowsUsados, rowsDireta, rowsVPecas, aliqBon, year, month]);

  // ── Projeção de fechamento e melhor dia ──────────────────────────────────
  const diasComMovimento   = dailyData.length;
  const projecaoFechamento = diasComMovimento > 0 ? (totalRecLiqCurrent / diasComMovimento) * diasUteis : 0;
  const projecaoVsAnterior = totalRecLiqPrev && projecaoFechamento > 0
    ? (projecaoFechamento - totalRecLiqPrev) / totalRecLiqPrev * 100
    : 0;
  const maxDiaTotal = dailyData.length > 0 ? Math.max(...dailyData.map(d => d.total)) : 0;
  const bestDia     = dailyData.find(d => d.total === maxDiaTotal)?.dia ?? -1;

  // ── Anos disponíveis ──────────────────────────────────────────────────────
  const allYears = useMemo(() => {
    const ys = new Set<number>();
    [...rowsNovos, ...rowsUsados, ...rowsDireta].forEach(r => { const { yr } = getYrMo(r); if (yr > 2000) ys.add(yr); });
    rowsVPecas.forEach(r => { const { yr } = getYrMoVPecas(r); if (yr > 2000) ys.add(yr); });
    if (!ys.size) ys.add(CURRENT_YEAR);
    return [...ys].sort((a, b) => b - a);
  }, [rowsNovos, rowsUsados, rowsDireta, rowsVPecas]);

  // ── Cor do LB% ──────────────────────────────────────────────────────────
  function lbColor(pct: number): string {
    if (isNaN(pct)) return 'text-slate-400';
    if (pct >= 8)   return 'text-emerald-600';
    if (pct >= 4)   return 'text-amber-600';
    return 'text-red-600';
  }
  function lbBg(pct: number): string {
    if (isNaN(pct)) return 'bg-slate-50 text-slate-400';
    if (pct >= 8)   return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (pct >= 4)   return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-red-50 text-red-700 border-red-200';
  }

  const prevLabel = `${MONTHS_SHORT[prevMonth - 1]}/${prevYear}`;
  const currLabel = `${MONTHS_LABEL[month - 1]}/${year}`;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Carregando dados...</span>
        </div>
      </div>
    );
  }

  const hasAnyData = totalRecLiqCurrent > 0 || totalRecLiqPrev > 0;

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-auto" id="resumo-executivo-print">
      {/* ── Barra de controles ─────────────────────────────────────────────── */}
      <div className="print-hidden bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Período</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {MONTHS_LABEL.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dias Úteis</label>
          <input
            type="number"
            min={1}
            max={31}
            value={diasUteis}
            onChange={e => setDiasUteis(Math.max(1, Number(e.target.value)))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 w-16 text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Imprimir PDF
        </button>
      </div>

      {/* ── ÁREA DE IMPRESSÃO ─────────────────────────────────────────────── */}
      <div className="resumo-print-area flex-1 p-6 flex flex-col gap-5 max-w-[1400px] mx-auto w-full">

        {/* Cabeçalho de impressão */}
        <div className="print-header hidden print:block mb-2">
          <div className="flex items-end justify-between border-b-2 border-slate-800 pb-3 mb-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Resumo Executivo — Central de Vendas VW</h1>
              <p className="text-sm text-slate-500 mt-0.5">{currLabel} &nbsp;|&nbsp; Comparativo vs. {prevLabel} &nbsp;|&nbsp; {diasUteis} dias úteis</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>Emitido em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>
        </div>

        {/* Título visível na tela */}
        <div className="print:hidden">
          <h2 className="text-base font-bold text-slate-800">Resumo Executivo — {currLabel}</h2>
          <p className="text-xs text-slate-400 mt-0.5">Comparativo vs. {prevLabel} &nbsp;·&nbsp; {diasUteis} dias úteis</p>
        </div>

        {!hasAnyData && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-amber-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Nenhum dado encontrado para o período selecionado. Importe os relatórios na aba Análises.</span>
          </div>
        )}

        {/* ── KPI CARDS ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 print:grid-cols-5">
          {/* Receita Líquida Total */}
          <KpiCard
            label="Receita Líquida Total"
            value={fmtBRL(totalRecLiqCurrent)}
            accent="#1d4ed8"
            delta={deltaRecLiqPct}
            sub={`vs. ${prevLabel}: ${fmtBRL(totalRecLiqPrev)}`}
          />
          {/* LB% Consolidado */}
          <KpiCard
            label="Lucro Bruto % (c/ LB)"
            value={fmtPct(totalLbPctCurrent)}
            accent={totalLbPctCurrent >= 8 ? '#059669' : totalLbPctCurrent >= 4 ? '#d97706' : '#dc2626'}
            delta={totalLbPctCurrent - totalLbPctPrev}
            deltaIsAbsolute
            deltaLabel={`pp vs. ${prevLabel}`}
            sub={`LB R$: ${fmtBRL(totalLbCurrent)}`}
          />
          {/* Receita / Dia Útil */}
          <KpiCard
            label={`Receita / Dia Útil (${diasUteis} dias)`}
            value={fmtBRL(recDiaTotal)}
            accent="#7c3aed"
            sub={`${fmtBRL(diasUteis > 0 ? totalRecLiqPrev / diasUteis : 0)} no mês anterior`}
          />
          {/* Gap vs Anterior */}
          <KpiCard
            label={gapParaAnterior > 0 ? `Faltam para superar ${prevLabel}` : `Superado vs. ${prevLabel}`}
            value={gapParaAnterior > 0 ? fmtBRL(gapParaAnterior) : fmtBRL(Math.abs(gapParaAnterior))}
            accent={gapParaAnterior > 0 ? '#dc2626' : '#059669'}
            badge={gapParaAnterior <= 0 ? 'SUPERADO ✓' : undefined}
            badgeColor={gapParaAnterior <= 0 ? '#059669' : undefined}
            sub={`${fmtPct(Math.min(progressoPct, 100))} do mês anterior atingido`}
          />
          {/* Projeção de fechamento */}
          <KpiCard
            label="Projeção de Fechamento"
            value={projecaoFechamento > 0 ? fmtBRL(projecaoFechamento) : '—'}
            accent="#f59e0b"
            delta={projecaoFechamento > 0 ? projecaoVsAnterior : undefined}
            sub={diasComMovimento > 0
              ? `Base: ${fmtBRL(Math.round(totalRecLiqCurrent / diasComMovimento))}/dia × ${diasUteis} dias úteis`
              : 'Sem dados suficientes para projetar'}
          />
        </div>

        {/* ── RECEITA POR DIA ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header clicável (tela) */}
          <button
            onClick={() => setDailyExpanded(v => !v)}
            className="print-hidden w-full px-6 py-3 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Receita Líquida por Dia — {currLabel}
              {dailyData.length > 0 && <span className="ml-2 font-normal text-slate-400 normal-case">({dailyData.length} dias com movimento)</span>}
            </span>
            {dailyExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {/* Header para impressão */}
          <div className="print:block px-6 py-3 border-b border-slate-100 hidden">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Receita Líquida por Dia — {currLabel}
            </span>
          </div>

          {/* Gráfico de barras empilhadas — visível na tela, oculto na impressão */}
          {dailyExpanded && dailyData.length > 0 && (
            <div className="print:hidden">
              <div className="p-6" style={{ height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="dia"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={v => `Dia ${v}`}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
                      width={55}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const total = (payload as { value: number }[]).reduce((s, p) => s + (p.value ?? 0), 0);
                        return (
                          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 11, minWidth: 200 }}>
                            <p style={{ fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Dia {label}</p>
                            {(payload as { name: string; value: number; color: string }[]).map((p, i) =>
                              p.value > 0 && (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
                                  <span style={{ color: p.color, fontWeight: 600 }}>{p.name}</span>
                                  <span style={{ color: '#334155', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(p.value)}</span>
                                </div>
                              )
                            )}
                            <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 6, paddingTop: 5, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                              <span style={{ fontWeight: 700, color: '#1e293b' }}>Total</span>
                              <span style={{ fontWeight: 700, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(total)}</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="novos"      name="Novos"        stackId="a" fill={DEPT_COLORS.novos} />
                    <Bar dataKey="usados"     name="Usados"       stackId="a" fill={DEPT_COLORS.usados} />
                    <Bar dataKey="direta"     name="VD/Frotista"  stackId="a" fill={DEPT_COLORS.direta} />
                    <Bar dataKey="pecas"      name="Peças"        stackId="a" fill={DEPT_COLORS.pecas} />
                    <Bar dataKey="oficina"    name="Oficina"      stackId="a" fill={DEPT_COLORS.oficina} />
                    <Bar dataKey="funilaria"  name="Funilaria"    stackId="a" fill={DEPT_COLORS.funilaria} />
                    <Bar dataKey="acessorios" name="Acessórios"      stackId="a" fill={DEPT_COLORS.acessorios} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {bestDia > 0 && (
                <div className="px-6 pb-4 flex items-center gap-2">
                  <span className="text-amber-400">&#9733;</span>
                  <span className="text-xs text-slate-500">
                    Melhor dia: <strong className="text-slate-700">Dia {String(bestDia).padStart(2, '0')}/{String(month).padStart(2, '0')}</strong>
                    &nbsp;—&nbsp;<span className="font-semibold text-slate-700">{fmtBRL(maxDiaTotal)}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {dailyExpanded && dailyData.length === 0 && (
            <div className="print-hidden px-6 py-8 text-center text-sm text-slate-400">
              Nenhum movimento diário encontrado para este período.
            </div>
          )}

          {/* Tabela numérica — oculta na tela, visível na impressão */}
          <div className="print:block hidden px-4 pb-4 pt-2">
            {dailyData.length === 0 ? (
              <p className="text-xs text-slate-400 px-2 py-3">Sem dados diários para este período.</p>
            ) : (
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="text-center px-2 py-2 font-bold uppercase tracking-wide">Dia</th>
                    <th className="text-right px-2 py-2 font-bold uppercase tracking-wide">Novos</th>
                    <th className="text-right px-2 py-2 font-bold uppercase tracking-wide">Usados</th>
                    <th className="text-right px-2 py-2 font-bold uppercase tracking-wide">VD/Frot.</th>
                    <th className="text-right px-2 py-2 font-bold uppercase tracking-wide">Peças</th>
                    <th className="text-right px-2 py-2 font-bold uppercase tracking-wide">Oficina</th>
                    <th className="text-right px-2 py-2 font-bold uppercase tracking-wide">Funilaria</th>
                    <th className="text-right px-2 py-2 font-bold uppercase tracking-wide">Acessórios</th>
                    <th className="text-right px-2 py-2 font-bold uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyData.map((d, i) => {
                    const isBestDay = d.dia === bestDia && maxDiaTotal > 0;
                    return (
                      <tr key={d.dia} className={isBestDay ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-2 py-1 text-center font-bold text-slate-700">
                          {isBestDay && <span className="text-amber-500 mr-0.5">&#9733;</span>}
                          {String(d.dia).padStart(2, '0')}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-slate-600">{d.novos      > 0 ? fmtBRL(d.novos)      : <span className="text-slate-300">—</span>}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-slate-600">{d.usados     > 0 ? fmtBRL(d.usados)     : <span className="text-slate-300">—</span>}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-slate-600">{d.direta     > 0 ? fmtBRL(d.direta)     : <span className="text-slate-300">—</span>}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-slate-600">{d.pecas      > 0 ? fmtBRL(d.pecas)      : <span className="text-slate-300">—</span>}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-slate-600">{d.oficina    > 0 ? fmtBRL(d.oficina)    : <span className="text-slate-300">—</span>}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-slate-600">{d.funilaria  > 0 ? fmtBRL(d.funilaria)  : <span className="text-slate-300">—</span>}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-slate-600">{d.acessorios > 0 ? fmtBRL(d.acessorios) : <span className="text-slate-300">—</span>}</td>
                        <td className={`px-2 py-1 text-right tabular-nums font-bold ${isBestDay ? 'text-amber-700' : 'text-slate-900'}`}>{fmtBRL(d.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800 text-white border-t-2 border-slate-600">
                    <td className="px-2 py-1.5 font-black uppercase text-[9px] tracking-wide">TOTAL</td>
                    {(['novos','usados','direta','pecas','oficina','funilaria','acessorios'] as const).map(k => (
                      <td key={k} className="px-2 py-1.5 text-right tabular-nums font-bold">
                        {fmtBRL(deptsCurrent.find(d => d.id === k)?.recLiq ?? 0)}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right tabular-nums font-black">
                      {fmtBRL(totalRecLiqCurrent)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {/* ── BARRA DE PROGRESSO ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Progresso vs. {prevLabel}</span>
            <span className={`text-sm font-bold ${gapParaAnterior <= 0 ? 'text-emerald-600' : progressoPct >= 85 ? 'text-amber-600' : 'text-red-600'}`}>
              {fmtPct(Math.min(progressoPct, 100))}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
            <div
              className={`h-4 rounded-full transition-all duration-700 ${
                gapParaAnterior <= 0 ? 'bg-emerald-500' : progressoPct >= 85 ? 'bg-amber-400' : 'bg-red-400'
              }`}
              style={{ width: `${Math.min(progressoPct, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-400">R$ 0</span>
            <span className={`text-xs font-semibold ${gapParaAnterior <= 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
              {gapParaAnterior > 0
                ? `Faltam ${fmtBRL(gapParaAnterior)} para superar ${prevLabel}`
                : `Superado em ${fmtBRL(Math.abs(gapParaAnterior))} (+${fmtPct(Math.abs(deltaRecLiqPct))})`
              }
            </span>
            <span className="text-xs text-slate-400">{fmtBRL(totalRecLiqPrev)}</span>
          </div>
        </div>

        {/* ── TABELA PRINCIPAL ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Resultado por Departamento</span>
            <span className="text-xs text-slate-400">Todos os valores em R$</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide">Departamento</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide">Qtde</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide">Receita Líq. Mês</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide">LB (R$)</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide">LB%</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide">Rec. / Dia Útil</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide">Mês Anterior</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide">LB% Ant.</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide">Δ R$</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide">Δ%</th>
                </tr>
              </thead>
              <tbody>
                {deptsCurrent.map((dept, idx) => {
                  const prev    = deptsPrev[idx];
                  const delta   = dept.recLiq - prev.recLiq;
                  const deltaPct = prev.recLiq ? delta / prev.recLiq * 100 : 0;
                  const isEven  = idx % 2 === 0;
                  return (
                    <tr
                      key={dept.id}
                      className={`border-b border-slate-100 ${isEven ? 'bg-white' : 'bg-slate-50/60'}`}
                    >
                      <td className="px-5 py-3 font-semibold text-slate-700">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: DEPT_COLORS[dept.id] ?? '#94a3b8' }}
                          />
                          {dept.label}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 font-medium tabular-nums">
                        {dept.vol.toLocaleString('pt-BR')}
                        {dept.showTicket && dept.vol > 0 && (
                          <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                            {fmtBRL(Math.round(dept.ticketMedio))} /un.
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800 tabular-nums">
                        {fmtBRL(dept.recLiq)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                        {dept.hasLB ? fmtBRL(dept.lb) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {dept.hasLB ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${lbBg(dept.lbPct)}`}>
                            {fmtPct(dept.lbPct)}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                        {fmtBRL(dept.recDia)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 tabular-nums">
                        {fmtBRL(prev.recLiq)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {prev.hasLB ? (
                          <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-bold border ${lbBg(prev.lbPct)}`}>
                            {fmtPct(prev.lbPct)}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {delta >= 0 ? '+' : ''}{fmtBRL(delta)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {delta >= 0
                            ? <TrendingUp className="w-3 h-3" />
                            : <TrendingDown className="w-3 h-3" />
                          }
                          {fmtPct(Math.abs(deltaPct))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {/* Subtotal com LB (veículos + peças) */}
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                  {(() => {
                    const withLB = deptsCurrent.filter(d => d.hasLB);
                    const withLBPrev = deptsPrev.filter(d => d.hasLB);
                    const subRec  = withLB.reduce((s, d) => s + d.recLiq, 0);
                    const subLb   = withLB.reduce((s, d) => s + d.lb, 0);
                    const subRecPrev = withLBPrev.reduce((s, d) => s + d.recLiq, 0);
                    const subLbPrev = withLBPrev.reduce((s, d) => s + d.lb, 0);
                    const subLbPctPrev = subRecPrev ? subLbPrev / subRecPrev * 100 : 0;
                    const subDelta   = subRec - subRecPrev;
                    const subDeltaPct = subRecPrev ? subDelta / subRecPrev * 100 : 0;
                    const subDia  = diasUteis > 0 ? subRec / diasUteis : 0;
                    return (
                      <>
                        <td className="px-5 py-2.5 font-bold text-blue-800 text-xs uppercase tracking-wide">Subtotal (c/ LB)</td>
                        <td className="px-4 py-2.5 text-right text-blue-700 font-bold tabular-nums text-xs">
                          {withLB.reduce((s, d) => s + d.vol, 0).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-blue-900 tabular-nums">{fmtBRL(subRec)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-blue-800 tabular-nums">{fmtBRL(subLb)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${lbBg(subRec ? subLb / subRec * 100 : 0)}`}>
                            {fmtPct(subRec ? subLb / subRec * 100 : 0)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-blue-700 tabular-nums">{fmtBRL(subDia)}</td>
                        <td className="px-4 py-2.5 text-right text-blue-600 tabular-nums">{fmtBRL(subRecPrev)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-bold border ${lbBg(subLbPctPrev)}`}>
                            {fmtPct(subLbPctPrev)}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-semibold text-xs ${subDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {subDelta >= 0 ? '+' : ''}{fmtBRL(subDelta)}
                        </td>
                        <td className={`px-4 py-2.5 text-right text-xs font-bold ${subDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {fmtPct(Math.abs(subDeltaPct))}
                        </td>
                      </>
                    );
                  })()}
                </tr>
                {/* Total Geral */}
                <tr className="bg-slate-800 text-white border-t-2 border-slate-600">
                  <td className="px-5 py-3 font-black text-sm uppercase tracking-wide">TOTAL GERAL</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">
                    {deptsCurrent.reduce((s, d) => s + d.vol, 0).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-base tabular-nums">{fmtBRL(totalRecLiqCurrent)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{fmtBRL(totalLbCurrent)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-black bg-white text-slate-800">
                      {fmtPct(totalLbPctCurrent)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{fmtBRL(recDiaTotal)}</td>
                  <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{fmtBRL(totalRecLiqPrev)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-block px-1.5 py-0.5 rounded-full text-xs font-black bg-white text-slate-800">
                      {fmtPct(totalLbPctPrev)}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-bold tabular-nums ${deltaRecLiq >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {deltaRecLiq >= 0 ? '+' : ''}{fmtBRL(deltaRecLiq)}
                  </td>
                  <td className={`px-4 py-3 text-right font-black ${deltaRecLiq >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {fmtPct(Math.abs(deltaRecLiqPct))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── GRÁFICO COMPARATIVO ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setChartExpanded(v => !v)}
            className="print-hidden w-full px-6 py-3 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Comparativo por Departamento — {currLabel} vs. {prevLabel} (R$ mil)
            </span>
            {chartExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          <div className="print:block px-6 py-3 border-b border-slate-100 hidden">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Comparativo por Departamento — {currLabel} vs. {prevLabel} (R$ mil)
            </span>
          </div>

          {/* Gráfico — oculto na impressão */}
          {chartExpanded && (
            <div className="p-6 print:hidden" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v}k`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 12, minWidth: 210 }}>
                          <p style={{ fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{label}</p>
                          {(payload as { name: string; value: number; color: string }[]).map((p, i) => {
                            const monthLabel = p.name === 'Mês Atual' ? currLabel : prevLabel;
                            const textColor  = p.name === 'Mês Atual' ? p.color : '#475569';
                            return (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
                                <span style={{ color: textColor, fontWeight: 600 }}>{monthLabel}</span>
                                <span style={{ color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>R$ {p.value.toLocaleString('pt-BR')} mil</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Mês Atual" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                  <Bar dataKey="Mês Anterior" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabela numérica para impressão (substitui gráfico) */}
          <div className="print:block hidden px-6 pb-5 pt-2">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left px-3 py-2 font-bold text-slate-600">Departamento</th>
                  <th className="text-right px-3 py-2 font-bold text-slate-600">{currLabel} (R$ mil)</th>
                  <th className="text-right px-3 py-2 font-bold text-slate-600">{prevLabel} (R$ mil)</th>
                  <th className="text-right px-3 py-2 font-bold text-slate-600">Δ R$ mil</th>
                  <th className="text-right px-3 py-2 font-bold text-slate-600">Δ%</th>
                </tr>
              </thead>
              <tbody>
                {deptsCurrent.map((dept, i) => {
                  const prev  = deptsPrev[i];
                  const delta = dept.recLiq - prev.recLiq;
                  const dPct  = prev.recLiq ? delta / prev.recLiq * 100 : 0;
                  return (
                    <tr key={dept.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-3 py-1.5 font-medium text-slate-700">{dept.label}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{(dept.recLiq / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{(prev.recLiq / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {delta >= 0 ? '+' : ''}{(delta / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-bold ${delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {delta >= 0 ? '+' : ''}{fmtPct(dPct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rodapé de impressão */}
        <div className="print:block hidden text-center text-[10px] text-slate-400 border-t border-slate-200 pt-3 mt-2">
          Documento gerado automaticamente — uso exclusivo interno — Central de Vendas VW
        </div>

      </div>

      {/* ── CSS de impressão inline (injeta via style tag) ───────────────── */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm 12mm; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-hidden { display: none !important; }
          .resumo-print-area { padding: 0 !important; gap: 12px !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
          thead { background-color: #1e293b !important; color: white !important; }
          tfoot tr:last-child { background-color: #1e293b !important; color: white !important; }
        }
        @media screen {
          .print\\:block { display: none; }
          .print\\:hidden { display: block; }
        }
      `}</style>
    </div>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, accent, delta, deltaIsAbsolute, deltaLabel, badge, badgeColor,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  delta?: number;
  deltaIsAbsolute?: boolean;
  deltaLabel?: string;
  badge?: string;
  badgeColor?: string;
}) {
  const hasDelta = delta !== undefined && !isNaN(delta);
  const positive = hasDelta && delta >= 0;
  return (
    <div
      className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex flex-col gap-1.5"
      style={accent ? { borderLeft: `4px solid ${accent}` } : undefined}
    >
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{label}</span>
      <div className="flex items-end gap-2 flex-wrap">
        <span className="text-xl font-black text-slate-900 leading-tight tabular-nums">{value}</span>
        {badge && (
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-full text-white leading-none"
            style={{ backgroundColor: badgeColor ?? '#059669' }}
          >
            {badge}
          </span>
        )}
      </div>
      {hasDelta && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
          {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {positive ? '+' : ''}{deltaIsAbsolute ? fmtPct(delta, 1) : fmtPct(delta, 1)}
          {deltaLabel && <span className="text-slate-400 font-normal">{deltaLabel}</span>}
        </div>
      )}
      {sub && <span className="text-[11px] text-slate-400 leading-tight">{sub}</span>}
    </div>
  );
}
