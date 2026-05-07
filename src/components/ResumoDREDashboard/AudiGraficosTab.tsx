import { useState, useEffect } from 'react';
import { Printer, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
  LineChart, Line, ReferenceLine,
} from 'recharts';
import {
  loadDreAudi,
  createEmptyDreAudiRow,
  migrateAjustes,
  type DreAudiRow,
  type DreAudiDept,
} from './dreAudiStorage';
import { loadDREDataAsync } from '@/lib/dbStorage';
import type { Department } from '@/lib/dataStorage';

// ─── Constantes ───────────────────────────────────────────────────────────────

const AUDI_COLOR     = '#bb0a30';
const AUDI_COLOR_DRK = '#9a0827';

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL  = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

type DeptKey = 'novos' | 'usados' | 'pecas' | 'oficina' | 'funilaria' | 'adm';

const DEPTS: { key: DeptKey; label: string; shortLabel: string; color: string }[] = [
  { key: 'novos',     label: 'Veículos Novos',        shortLabel: 'Novos',    color: '#1d4ed8' },
  { key: 'usados',    label: 'Veículos Usados',        shortLabel: 'Usados',   color: '#7c3aed' },
  { key: 'pecas',     label: 'Peças e Acessórios',     shortLabel: 'Peças',    color: '#059669' },
  { key: 'oficina',   label: 'Oficina / Assist. Téc.', shortLabel: 'Oficina',  color: '#d97706' },
  { key: 'funilaria', label: 'Funilaria',               shortLabel: 'Funilaria',color: '#db2777' },
  { key: 'adm',       label: 'Administração',           shortLabel: 'Adm',      color: '#64748b' },
];

const DEPT_KEY_TO_DEPT: Record<DeptKey, Department> = {
  novos:     'novos',
  usados:    'usados',
  pecas:     'pecas',
  oficina:   'oficina',
  funilaria: 'funilaria',
  adm:       'administracao',
};

const DESCRICAO_TO_FIELD: Record<string, keyof DreAudiDept> = {
  'VOLUME DE VENDAS':                      'quant',
  'RECEITA OPERACIONAL LIQUIDA':           'receitaOperacionalLiquida',
  'CUSTO OPERACIONAL DA RECEITA':          'custoOperacionalReceita',
  'LUCRO (PREJUIZO) OPERACIONAL BRUTO':   'lucroPrejOperacionalBruto',
  'OUTRAS RECEITAS OPERACIONAIS':          'outrasReceitasOperacionais',
  'OUTRAS DESPESAS OPERACIONAIS':          'outrasDespesasOperacionais',
  'MARGEM DE CONTRIBUIÇÃO':               'margemContribuicao',
  'MARGEM DE CONTRIBUICAO':               'margemContribuicao',
  'DESPESAS C/ PESSOAL':                  'despPessoal',
  'DESPESAS C/ SERV. DE TERCEIROS':       'despServTerceiros',
  'DESPESAS C/ OCUPAÇÃO':                 'despOcupacao',
  'DESPESAS C/ OCUPACAO':                 'despOcupacao',
  'DESPESAS C/ FUNCIONAMENTO':            'despFuncionamento',
  'DESPESAS C/ VENDAS':                   'despVendas',
  'LUCRO (PREJUIZO) OPERACIONAL LIQUIDO': 'lucroPrejOperacionalLiquido',
  'AMORTIZAÇÕES E DEPRECIAÇÕES':          'amortizacoesDepreciacoes',
  'AMORTIZACOES E DEPRECIACOES':          'amortizacoesDepreciacoes',
  'OUTRAS RECEITAS FINANCEIRAS':          'outrasReceitasFinanceiras',
  'DESPESAS FINANCEIRAS NÃO OPERACIONAL': 'despFinanceirasNaoOperacional',
  'DESPESAS FINANCEIRAS NAO OPERACIONAL': 'despFinanceirasNaoOperacional',
  'DESPESAS NÃO OPERACIONAIS':            'despesasNaoOperacionais',
  'DESPESAS NAO OPERACIONAIS':            'despesasNaoOperacionais',
  'OUTRAS RENDAS NÃO OPERACIONAIS':       'outrasRendasNaoOperacionais',
  'OUTRAS RENDAS NAO OPERACIONAIS':       'outrasRendasNaoOperacionais',
  'LUCRO (PREJUIZO) ANTES IMPOSTOS':      'lucroPrejAntesImpostos',
  'PROVISÕES IRPJ E C.S.':               'provisoesIrpjCs',
  'PROVISOES IRPJ E C.S.':               'provisoesIrpjCs',
  'PARTICIPAÇÕES':                        'participacoes',
  'PARTICIPACOES':                        'participacoes',
  'LUCRO LIQUIDO DO EXERCICIO':           'lucroLiquidoExercicio',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseVal(v: string | number | undefined): number {
  if (v === undefined || v === null || v === '') return 0;
  return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
}

function fmtK(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'M';
  if (abs >= 1_000)     return (v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + 'K';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function sumDeptField(row: DreAudiRow, field: keyof DreAudiDept): number {
  return DEPTS.reduce((s, d) => s + parseVal(row[d.key][field]), 0);
}

// Soma com regra ADM ROL = 0
function sumField(row: DreAudiRow, field: keyof DreAudiDept, deptFilter: DeptFilter): number {
  if (deptFilter === 'consolidado') {
    return DEPTS.reduce((s, d) => {
      if (d.key === 'adm' && field === 'receitaOperacionalLiquida') return s;
      return s + parseVal(row[d.key][field]);
    }, 0);
  }
  if (deptFilter === 'adm' && field === 'receitaOperacionalLiquida') return 0;
  return parseVal(row[deptFilter][field]);
}

function buildDeptFromDREData(dreData: any[] | null, monthIndex: number): DreAudiDept {
  const dept = createEmptyDreAudiRow(0, 0).novos;
  if (!dreData) return dept;
  for (const line of dreData) {
    const descKey = ((line.descricao as string) || (line.label as string) || '').toUpperCase().trim();
    const field = DESCRICAO_TO_FIELD[descKey];
    if (field) {
      const meses: number[] = line.meses || line.values || [];
      const val = meses[monthIndex];
      if (val !== undefined && val !== null && val !== 0) dept[field] = val.toString();
    }
  }
  return dept;
}

// Acumulado de janeiro até o índice (0-based)
function accumulate(rows: DreAudiRow[], upToIdx: number): DreAudiRow {
  const acc = createEmptyDreAudiRow(0, 0);
  for (let i = 0; i <= upToIdx; i++) {
    const row = rows[i];
    if (!row) continue;
    for (const d of DEPTS) {
      for (const key of Object.keys(acc[d.key]) as (keyof DreAudiDept)[]) {
        const t = parseVal(acc[d.key][key]) + parseVal(row[d.key][key]);
        if (t !== 0) acc[d.key][key] = t.toString();
      }
    }
  }
  return acc;
}

// ─── KPI Card (Mês + Acumulado) ──────────────────────────────────────────────

function KpiCard({
  label, mesValue, accumValue, delta, isVolume = false, isPct = false,
}: {
  label: string; mesValue: number; accumValue: number;
  delta?: number; isVolume?: boolean; isPct?: boolean;
}) {
  const hasDelta = delta !== undefined && !isNaN(delta) && isFinite(delta);
  const isPos    = hasDelta && delta! > 0;
  const isNeg    = hasDelta && delta! < 0;
  const isZero   = hasDelta && delta! === 0;
  const fmt = (v: number) => isPct
    ? v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
    : isVolume ? Math.round(v).toLocaleString('pt-BR') : fmtK(v);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-1.5 min-w-0">
      <span className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider leading-tight">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-extrabold tracking-tight ${mesValue < 0 ? 'text-red-600' : 'text-slate-800'}`}>{fmt(mesValue)}</span>
        <span className="text-[0.6rem] text-slate-400 font-medium">mês</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-sm font-bold ${accumValue < 0 ? 'text-red-500' : 'text-slate-500'}`}>{fmt(accumValue)}</span>
        <span className="text-[0.6rem] text-slate-400">acum.</span>
      </div>
      {hasDelta && (
        <span className={`flex items-center gap-1 text-[0.65rem] font-semibold mt-0.5 ${isZero ? 'text-slate-400' : isPos ? 'text-emerald-600' : 'text-red-500'}`}>
          {isZero ? <Minus className="w-3 h-3" /> : isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isZero ? 'Sem variação' : `${isPos ? '+' : ''}${delta!.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% vs mês ant.`}
        </span>
      )}
    </div>
  );
}

// ─── Waterfall Simplificado (5 blocos) ───────────────────────────────────────

const WF_STEPS: { label: string; field: keyof DreAudiDept }[] = [
  { label: 'Rec. Líquida',  field: 'receitaOperacionalLiquida'    },
  { label: 'Margem Bruta',  field: 'lucroPrejOperacionalBruto'    },
  { label: 'Margem Contr.', field: 'margemContribuicao'           },
  { label: 'Result. Op.',   field: 'lucroPrejOperacionalLiquido'  },
  { label: 'Lucro Líquido', field: 'lucroLiquidoExercicio'        },
];

function WaterfallPanel({
  row, title, subtitle, deptFilter,
}: {
  row: DreAudiRow; title: string; subtitle: string; deptFilter: DeptFilter;
}) {
  const data = WF_STEPS.map(s => ({ label: s.label, value: sumField(row, s.field, deptFilter) }));
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
      <div className="px-4 py-2.5" style={{ backgroundColor: AUDI_COLOR }}>
        <p className="text-white font-bold text-xs">{title}</p>
        <p className="text-white/70 text-[0.6rem] mt-0.5">{subtitle}</p>
      </div>
      <div className="p-3">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} angle={-20} textAnchor="end" interval={0} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} width={48} />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const v = payload[0]?.value as number;
              return (
                <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 text-xs">
                  <p className="font-bold text-slate-700 mb-1">{label}</p>
                  <p className={`font-semibold text-base ${v < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmtBRL(v)}</p>
                </div>
              );
            }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Valor">
              {data.map((d, i) => (
                <Cell key={i} fill={d.value >= 0 ? (i === data.length - 1 ? AUDI_COLOR : '#22c55e') : '#ef4444'} />
              ))}
            </Bar>
            <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1.5} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 text-[0.6rem] text-slate-400 mt-1">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-sm bg-green-500 inline-block" />Positivo</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-sm bg-red-500 inline-block" />Negativo</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-sm inline-block" style={{ backgroundColor: AUDI_COLOR }} />Lucro Líq.</span>
        </div>
      </div>
    </div>
  );
}

// ─── Donut por departamento ───────────────────────────────────────────────────

function DonutPanel({
  row, field, title, subtitle, deptFilter,
}: {
  row: DreAudiRow; field: keyof DreAudiDept; title: string; subtitle: string; deptFilter: DeptFilter;
}) {
  const data = DEPTS
    .filter(d => deptFilter === 'consolidado' || d.key === deptFilter)
    .map(d => ({
      name: d.shortLabel,
      value: Math.abs(d.key === 'adm' && field === 'receitaOperacionalLiquida' ? 0 : parseVal(row[d.key][field])),
      color: d.color,
    }))
    .filter(d => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  const renderLabel = ({ cx, cy, midAngle, outerRadius, percent, name }: any) => {
    if (percent < 0.08) return null;
    const RADIAN = Math.PI / 180;
    const r = outerRadius + 16;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#475569" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: 10, fontWeight: 600 }}>
        {(percent * 100).toFixed(1)}%
      </text>
    );
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
      <div className="px-4 py-2.5 border-b border-slate-100" style={{ borderLeft: `4px solid ${AUDI_COLOR}` }}>
        <p className="text-xs font-semibold text-slate-700">{title}</p>
        <p className="text-[0.6rem] text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="p-2">
        {data.length === 0
          ? <div className="flex items-center justify-center h-[200px] text-slate-400 text-xs">Sem dados</div>
          : <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={50} outerRadius={80} paddingAngle={2} label={renderLabel} labelLine={false}>
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0];
                  const pct = total > 0 ? ((p.value as number) / total * 100).toFixed(1) : '0.0';
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 text-xs">
                      <p className="font-bold text-slate-700 mb-1">{p.name}</p>
                      <p className="text-slate-600">R$ {fmtBRL(p.value as number)}</p>
                      <p className="font-semibold" style={{ color: p.payload.color }}>{pct}% do total</p>
                    </div>
                  );
                }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
        }
      </div>
    </div>
  );
}

// ─── Componente Principal ──────────────────────────────────────────────────────

interface Props { year: number; month: number; }

type DeptFilter = 'consolidado' | DeptKey;

export function AudiGraficosTab({ year, month }: Props) {
  const [loading, setLoading]         = useState(true);
  const [allMonthRows, setAllMonthRows] = useState<DreAudiRow[]>([]);
  const [deptFilter, setDeptFilter]   = useState<DeptFilter>('consolidado');

  // ── Load: sempre carrega 12 meses + meses acumulados ─────────────────────────
  useEffect(() => {
    setLoading(true);
    const yr = year as 2024 | 2025 | 2026 | 2027;
    Promise.all([
      Promise.all(Array.from({ length: 12 }, (_, i) => loadDreAudi(year, i + 1))),
      Promise.all(DEPTS.map(d =>
        loadDREDataAsync(yr, DEPT_KEY_TO_DEPT[d.key], 'audi')
          .then(dre => ({ deptKey: d.key as DeptKey, dre }))
      )),
    ]).then(([kvResults, dreResults]) => {
      const dreLk: Record<string, any[] | null> = {};
      for (const { deptKey, dre } of dreResults) dreLk[deptKey] = dre;
      function hasData(dept: DreAudiDept) { return Object.values(dept).some(v => v !== ''); }
      const rows = kvResults.map((kv, i) => {
        const row = createEmptyDreAudiRow(year, i + 1);
        for (const d of DEPTS) {
          row[d.key] = (kv && hasData(kv[d.key])) ? kv[d.key] : buildDeptFromDREData(dreLk[d.key] ?? null, i);
        }
        if (kv) row.ajustes = migrateAjustes(kv.ajustes);
        return row;
      });
      setAllMonthRows(rows);
      setLoading(false);
    });
  }, [year, month]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Carregando dados...</span>
        </div>
      </div>
    );
  }

  // ── Períodos ─────────────────────────────────────────────────────────────────
  const selIdx  = month === 0 ? 11 : month - 1;
  const mesRow  = allMonthRows[selIdx] ?? createEmptyDreAudiRow(year, selIdx + 1);
  const prevRow = selIdx > 0 ? allMonthRows[selIdx - 1] : null;
  const accumRow = accumulate(allMonthRows, selIdx);

  const mesReceita  = sumField(mesRow,   'receitaOperacionalLiquida',  deptFilter);
  const mesMargemC  = sumField(mesRow,   'margemContribuicao',          deptFilter);
  const mesLucroLiq = sumField(mesRow,   'lucroLiquidoExercicio',       deptFilter);
  const mesVolume   = sumField(mesRow,   'quant',                       deptFilter);
  const deptList    = deptFilter === 'consolidado' ? DEPTS : DEPTS.filter(d => d.key === deptFilter);
  const sumDesp     = (row: DreAudiRow) => deptList.reduce((s, d) =>
    s + parseVal(row[d.key].despPessoal) + parseVal(row[d.key].despServTerceiros)
      + parseVal(row[d.key].despOcupacao) + parseVal(row[d.key].despFuncionamento)
      + parseVal(row[d.key].despVendas), 0);
  const mesDesp     = sumDesp(mesRow);

  const accReceita  = sumField(accumRow, 'receitaOperacionalLiquida',  deptFilter);
  const accMargemC  = sumField(accumRow, 'margemContribuicao',          deptFilter);
  const accLucroLiq = sumField(accumRow, 'lucroLiquidoExercicio',       deptFilter);
  const accVolume   = sumField(accumRow, 'quant',                       deptFilter);
  const accDesp     = sumDesp(accumRow);

  const prevReceita  = prevRow ? sumField(prevRow, 'receitaOperacionalLiquida',  deptFilter) : null;
  const prevMargemC  = prevRow ? sumField(prevRow, 'margemContribuicao',          deptFilter) : null;
  const prevLucroLiq = prevRow ? sumField(prevRow, 'lucroLiquidoExercicio',       deptFilter) : null;
  const prevVolume   = prevRow ? sumField(prevRow, 'quant',                       deptFilter) : null;
  const prevDesp     = prevRow ? sumDesp(prevRow) : null;

  function delta(cur: number, prev: number | null) {
    if (prev === null || prev === 0) return undefined;
    return ((cur - prev) / Math.abs(prev)) * 100;
  }

  const mesLabel    = month === 0 ? `Dez/${year}` : MONTHS_SHORT[month - 1] + `/${year}`;
  const accumLabel  = month === 0 ? `Ano ${year}` : `Jan–${MONTHS_SHORT[month - 1]}/${year}`;
  const periodoFull = month === 0 ? `Ano ${year}` : `${MONTHS_FULL[month - 1]} de ${year}`;
  const mesPctMargem   = mesReceita  !== 0 ? (mesMargemC  / mesReceita)  * 100 : 0;
  const accumPctMargem = accReceita  !== 0 ? (accMargemC  / accReceita)  * 100 : 0;

  // ── Dados para gráficos ───────────────────────────────────────────────────────
  const barByDept = deptList.map(d => ({
    name: d.shortLabel, color: d.color,
    receitaMes:   d.key === 'adm' ? 0 : parseVal(mesRow[d.key].receitaOperacionalLiquida),
    margemMes:    parseVal(mesRow[d.key].margemContribuicao),
    lucroMes:     parseVal(mesRow[d.key].lucroLiquidoExercicio),
    receitaAcum:  d.key === 'adm' ? 0 : parseVal(accumRow[d.key].receitaOperacionalLiquida),
    margemAcum:   parseVal(accumRow[d.key].margemContribuicao),
    lucroAcum:    parseVal(accumRow[d.key].lucroLiquidoExercicio),
  }));

  const evolucao = allMonthRows.slice(0, selIdx + 1).map((row, i) => ({
    mes:     MONTHS_SHORT[i],
    receita: sumField(row, 'receitaOperacionalLiquida',  deptFilter),
    margem:  sumField(row, 'margemContribuicao',          deptFilter),
    lucro:   sumField(row, 'lucroLiquidoExercicio',       deptFilter),
  }));

  const buildDespData = (row: DreAudiRow) => [
    { name: 'Pessoal',   value: Math.abs(deptList.reduce((s, d) => s + parseVal(row[d.key].despPessoal), 0)),         color: '#ef4444' },
    { name: 'Terceiros', value: Math.abs(deptList.reduce((s, d) => s + parseVal(row[d.key].despServTerceiros), 0)),   color: '#f97316' },
    { name: 'Ocupação',  value: Math.abs(deptList.reduce((s, d) => s + parseVal(row[d.key].despOcupacao), 0)),         color: '#eab308' },
    { name: 'Funciona.', value: Math.abs(deptList.reduce((s, d) => s + parseVal(row[d.key].despFuncionamento), 0)),   color: '#8b5cf6' },
    { name: 'Vendas',    value: Math.abs(deptList.reduce((s, d) => s + parseVal(row[d.key].despVendas), 0)),           color: '#06b6d4' },
  ].filter(d => d.value > 0);

  const despMes  = buildDespData(mesRow);
  const despAcum = buildDespData(accumRow);
  const deptLabel = deptFilter === 'consolidado' ? 'Todos os depts.' : DEPTS.find(d => d.key === deptFilter)?.label ?? '';

  // ── Semáforo ──────────────────────────────────────────────────────────────────
  const semaforoData = DEPTS.map(d => {
    const lucro     = parseVal(mesRow[d.key].lucroLiquidoExercicio);
    const lucroPrev = prevRow ? parseVal(prevRow[d.key].lucroLiquidoExercicio) : 0;
    const status    = lucro > 0 && lucro >= lucroPrev ? 'verde' : lucro > 0 ? 'amarelo' : 'vermelho';
    return { ...d, lucro, status };
  });


  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div id="audi-graficos-print-area" className="max-w-[1440px] mx-auto p-4 flex flex-col gap-4">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Audi — Análise Gráfica</h2>
            <p className="text-sm text-slate-500">{periodoFull} · Acumulado: {accumLabel}</p>
          </div>
          <button
            onClick={() => {
              const area = document.getElementById('audi-graficos-print-area');
              const root = document.getElementById('print-root');
              if (area && root) {
                root.innerHTML = area.outerHTML;
                window.print();
                root.innerHTML = '';
              } else {
                window.print();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </button>
        </div>

        {/* ── Semáforo de Saúde ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider mb-3">Saúde dos Departamentos — {mesLabel}</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {semaforoData.map(d => (
              <div key={d.key} className="flex flex-col items-center gap-1.5">
                <div className="w-4 h-4 rounded-full shadow-sm"
                  style={{ backgroundColor: d.status === 'verde' ? '#22c55e' : d.status === 'amarelo' ? '#eab308' : '#ef4444' }} />
                <span className="text-[0.65rem] font-semibold text-slate-600 text-center leading-tight">{d.shortLabel}</span>
                <span className={`text-[0.6rem] font-bold ${d.lucro >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtK(d.lucro)}</span>
              </div>
            ))}
          </div>
          <p className="text-[0.6rem] text-slate-400 mt-2">🟢 Positivo e crescendo · 🟡 Positivo mas caindo · 🔴 Negativo</p>
        </div>

        {/* ── Seletor de Departamento ──────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider">Filtrar dept:</span>
          {(['consolidado', ...DEPTS.map(d => d.key)] as DeptFilter[]).map(key => {
            const dept = DEPTS.find(d => d.key === key);
            const isActive = deptFilter === key;
            return (
              <button key={key} onClick={() => setDeptFilter(key)}
                className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${isActive ? 'text-white border-transparent shadow-sm' : 'text-slate-600 bg-white border-slate-200 hover:border-slate-300'}`}
                style={isActive ? { backgroundColor: dept?.color ?? AUDI_COLOR } : {}}
              >
                {dept?.shortLabel ?? 'Consolidado'}
              </button>
            );
          })}
        </div>

        {/* ── 6 KPI Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Volume de Vendas"       mesValue={mesVolume}   accumValue={accVolume}   delta={delta(mesVolume,   prevVolume)}   isVolume />
          <KpiCard label="Receita Líquida"        mesValue={mesReceita}  accumValue={accReceita}  delta={delta(mesReceita,  prevReceita)} />
          <KpiCard label="Margem de Contribuição" mesValue={mesMargemC}  accumValue={accMargemC}  delta={delta(mesMargemC,  prevMargemC)} />
          <KpiCard label="% Margem s/ Receita"    mesValue={mesPctMargem} accumValue={accumPctMargem} isPct />
          <KpiCard label="Despesas Totais"        mesValue={mesDesp}     accumValue={accDesp}     delta={delta(mesDesp,     prevDesp)} />
          <KpiCard label="Lucro Líquido"          mesValue={mesLucroLiq} accumValue={accLucroLiq} delta={delta(mesLucroLiq, prevLucroLiq)} />
        </div>

        {/* ── Painel Duplo: Waterfall Mês | Acumulado ─────────────────────── */}
        <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider">Resultado do Período</p>
        <div className="flex gap-4">
          <WaterfallPanel row={mesRow}   title={`DRE — ${mesLabel}`}   subtitle={`Resultado do mês · ${deptLabel}`}   deptFilter={deptFilter} />
          <WaterfallPanel row={accumRow} title={`DRE — ${accumLabel}`} subtitle={`Acumulado · ${deptLabel}`}           deptFilter={deptFilter} />
        </div>

        {/* ── Donuts Receita por Dept (só Consolidado) ────────────────────── */}
        <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider">Composição</p>
        {deptFilter === 'consolidado' && (
          <div className="flex gap-4">
            <DonutPanel row={mesRow}   field="receitaOperacionalLiquida" title={`Receita por Dept — ${mesLabel}`}   subtitle="Composição da Receita Líquida" deptFilter={deptFilter} />
            <DonutPanel row={accumRow} field="receitaOperacionalLiquida" title={`Receita por Dept — ${accumLabel}`} subtitle="Composição da Receita Líquida" deptFilter={deptFilter} />
          </div>
        )}

        {/* ── Donuts Despesas Mês | Acumulado ─────────────────────────────── */}
        <div className="flex gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
            <div className="px-4 py-2.5 border-b border-slate-100" style={{ borderLeft: `4px solid ${AUDI_COLOR}` }}>
              <p className="text-xs font-semibold text-slate-700">Composição de Despesas — {mesLabel}</p>
              <p className="text-[0.6rem] text-slate-400 mt-0.5">{deptLabel}</p>
            </div>
            <div className="p-2">
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={despMes} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={50} outerRadius={80} paddingAngle={2}
                    label={({ cx, cy, midAngle, outerRadius, percent }: any) => {
                      if (percent < 0.08) return null;
                      const r = outerRadius + 16;
                      const x = cx + r * Math.cos(-midAngle * Math.PI / 180);
                      const y = cy + r * Math.sin(-midAngle * Math.PI / 180);
                      return <text x={x} y={y} fill="#475569" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: 10, fontWeight: 600 }}>{(percent * 100).toFixed(1)}%</text>;
                    }}
                    labelLine={false}
                  >
                    {despMes.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0];
                    const tot = despMes.reduce((s, d) => s + d.value, 0);
                    const pct = tot > 0 ? ((p.value as number) / tot * 100).toFixed(1) : '0.0';
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 text-xs">
                        <p className="font-bold text-slate-700 mb-1">{p.name}</p>
                        <p className="text-slate-600">R$ {fmtBRL(p.value as number)}</p>
                        <p className="font-semibold" style={{ color: p.payload.color }}>{pct}% do total</p>
                      </div>
                    );
                  }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
            <div className="px-4 py-2.5 border-b border-slate-100" style={{ borderLeft: `4px solid ${AUDI_COLOR}` }}>
              <p className="text-xs font-semibold text-slate-700">Composição de Despesas — {accumLabel}</p>
              <p className="text-[0.6rem] text-slate-400 mt-0.5">{deptLabel}</p>
            </div>
            <div className="p-2">
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={despAcum} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={50} outerRadius={80} paddingAngle={2}
                    label={({ cx, cy, midAngle, outerRadius, percent }: any) => {
                      if (percent < 0.08) return null;
                      const r = outerRadius + 16;
                      const x = cx + r * Math.cos(-midAngle * Math.PI / 180);
                      const y = cy + r * Math.sin(-midAngle * Math.PI / 180);
                      return <text x={x} y={y} fill="#475569" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: 10, fontWeight: 600 }}>{(percent * 100).toFixed(1)}%</text>;
                    }}
                    labelLine={false}
                  >
                    {despAcum.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0];
                    const tot = despAcum.reduce((s, d) => s + d.value, 0);
                    const pct = tot > 0 ? ((p.value as number) / tot * 100).toFixed(1) : '0.0';
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 text-xs">
                        <p className="font-bold text-slate-700 mb-1">{p.name}</p>
                        <p className="text-slate-600">R$ {fmtBRL(p.value as number)}</p>
                        <p className="font-semibold" style={{ color: p.payload.color }}>{pct}% do total</p>
                      </div>
                    );
                  }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Por Departamento ────────────────────────────────────────────── */}
        <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider">Por Departamento</p>
        <div className="flex gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
            <div className="px-4 py-2.5 border-b border-slate-100" style={{ borderLeft: `4px solid ${AUDI_COLOR}` }}>
              <p className="text-xs font-semibold text-slate-700">Receita por Departamento</p>
              <p className="text-[0.6rem] text-slate-400 mt-0.5">{mesLabel} vs {accumLabel}</p>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={barByDept} margin={{ top: 5, right: 8, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="receitaMes" name={mesLabel} radius={[3,3,0,0]}>
                    {barByDept.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                  <Bar dataKey="receitaAcum" name={accumLabel} radius={[3,3,0,0]}>
                    {barByDept.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.4} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
            <div className="px-4 py-2.5 border-b border-slate-100" style={{ borderLeft: `4px solid ${AUDI_COLOR}` }}>
              <p className="text-xs font-semibold text-slate-700">Lucro Líquido por Departamento</p>
              <p className="text-[0.6rem] text-slate-400 mt-0.5">{mesLabel} vs {accumLabel}</p>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={barByDept} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} width={60} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="lucroMes"  name={mesLabel}   fill={AUDI_COLOR}     radius={[0,3,3,0]} />
                  <Bar dataKey="lucroAcum" name={accumLabel} fill={AUDI_COLOR_DRK} fillOpacity={0.6} radius={[0,3,3,0]} />
                  <ReferenceLine x={0} stroke="#cbd5e1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Evolução Mensal ──────────────────────────────────────────────── */}
        {evolucao.length > 1 && (<>
          <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider">Tendência</p>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100" style={{ borderLeft: `4px solid ${AUDI_COLOR}` }}>
              <p className="text-xs font-semibold text-slate-700">Evolução Mensal</p>
              <p className="text-[0.6rem] text-slate-400 mt-0.5">Jan–{MONTHS_SHORT[selIdx]}/{year} · {deptLabel}</p>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={evolucao} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#374151' }} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-xs">
                        <p className="font-bold text-slate-700 mb-2">{label}</p>
                        {payload.map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 text-slate-500">
                              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.stroke }} />
                              {p.name}
                            </span>
                            <span className={`font-semibold ${p.value < 0 ? 'text-red-500' : 'text-slate-800'}`}>{fmtBRL(p.value)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="receita" name="Receita Líquida"       stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="margem"  name="Margem Contribuição"  stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="lucro"   name="Lucro Líquido"        stroke={AUDI_COLOR} strokeWidth={2.5} dot={{ r: 4, fill: AUDI_COLOR }} />
                  <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>)}

      </div>
    </div>
  );
}
