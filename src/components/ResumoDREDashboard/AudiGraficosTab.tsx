import { useState, useEffect } from 'react';
import { Printer, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
  ComposedChart, Area, Line, ReferenceLine,
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

const MONTHS = [
  'Jan','Fev','Mar','Abr','Mai','Jun',
  'Jul','Ago','Set','Out','Nov','Dez',
];
const MONTHS_FULL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
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

// Acumulado de janeiro até o mês informado
function accumulate(rows: DreAudiRow[], upToMonth: number): DreAudiRow {
  const acc = createEmptyDreAudiRow(0, 0);
  for (let i = 0; i < upToMonth; i++) {
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

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, currency = true }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-xs min-w-[140px]">
      <p className="font-bold text-slate-700 mb-2 text-sm">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
            {p.name}
          </span>
          <span className="font-semibold text-slate-800">
            {currency ? fmtBRL(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, subLabel, subValue, delta, isVolume = false, color = AUDI_COLOR,
}: {
  label: string; value: number; subLabel?: string; subValue?: number;
  delta?: number; isVolume?: boolean; color?: string;
}) {
  const hasDelta = delta !== undefined && delta !== null && !isNaN(delta) && isFinite(delta);
  const deltaPositive = hasDelta && delta! > 0;
  const deltaNeutral  = hasDelta && delta! === 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2 min-w-0">
      <span className="text-[0.7rem] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-extrabold tracking-tight ${value < 0 ? 'text-red-600' : 'text-slate-800'}`}>
        {isVolume ? Math.round(value).toLocaleString('pt-BR') : fmtK(value)}
      </span>
      {subValue !== undefined && (
        <span className="text-xs text-slate-500">
          <span className="font-semibold text-slate-600">{subLabel}: </span>
          {isVolume ? Math.round(subValue).toLocaleString('pt-BR') : fmtK(subValue)}
        </span>
      )}
      {hasDelta && (
        <span className={`flex items-center gap-1 text-[0.7rem] font-semibold mt-auto ${
          deltaNeutral ? 'text-slate-400' : deltaPositive ? 'text-emerald-600' : 'text-red-500'
        }`}>
          {deltaNeutral ? <Minus className="w-3 h-3" /> : deltaPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {deltaNeutral ? 'Sem variação' : `${deltaPositive ? '+' : ''}${delta!.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% vs mês ant.`}
        </span>
      )}
    </div>
  );
}

// ─── Waterfall Chart ──────────────────────────────────────────────────────────

function WaterfallChart({ row, title }: { row: DreAudiRow; title: string }) {
  const steps = [
    { label: 'Rec. Líquida',   field: 'receitaOperacionalLiquida'    as keyof DreAudiDept, type: 'pos'   },
    { label: 'Custo Oper.',    field: 'custoOperacionalReceita'       as keyof DreAudiDept, type: 'neg'   },
    { label: 'Outras Rec.',    field: 'outrasReceitasOperacionais'    as keyof DreAudiDept, type: 'pos'   },
    { label: 'Outras Desp.',   field: 'outrasDespesasOperacionais'    as keyof DreAudiDept, type: 'neg'   },
    { label: 'Margem Contr.',  field: 'margemContribuicao'            as keyof DreAudiDept, type: 'total' },
    { label: 'Desp. Pessoal',  field: 'despPessoal'                   as keyof DreAudiDept, type: 'neg'   },
    { label: 'Desp. Terceiros',field: 'despServTerceiros'             as keyof DreAudiDept, type: 'neg'   },
    { label: 'Desp. Ocupação', field: 'despOcupacao'                  as keyof DreAudiDept, type: 'neg'   },
    { label: 'Desp. Funciona.',field: 'despFuncionamento'             as keyof DreAudiDept, type: 'neg'   },
    { label: 'Desp. Vendas',   field: 'despVendas'                    as keyof DreAudiDept, type: 'neg'   },
    { label: 'Luc. Op. Líq.',  field: 'lucroPrejOperacionalLiquido'   as keyof DreAudiDept, type: 'total' },
    { label: 'Amort./Depr.',   field: 'amortizacoesDepreciacoes'      as keyof DreAudiDept, type: 'neg'   },
    { label: 'Rec. Financ.',   field: 'outrasReceitasFinanceiras'     as keyof DreAudiDept, type: 'pos'   },
    { label: 'Desp. Financ.',  field: 'despFinanceirasNaoOperacional' as keyof DreAudiDept, type: 'neg'   },
    { label: 'Lucro Líquido',  field: 'lucroLiquidoExercicio'         as keyof DreAudiDept, type: 'total' },
  ];

  let running = 0;
  const data = steps.map(s => {
    const val = sumDeptField(row, s.field);
    if (s.type === 'total') {
      running = val;
      return { label: s.label, value: val, base: 0, type: 'total' };
    }
    const base = running;
    running += val;
    return { label: s.label, value: Math.abs(val), base: s.type === 'neg' ? running : base, type: s.type };
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3" style={{ backgroundColor: AUDI_COLOR }}>
        <p className="text-white font-bold text-sm">Cascata DRE — {title}</p>
        <p className="text-white/70 text-[0.65rem] mt-0.5">Fluxo de resultado (Receita → Lucro Líquido)</p>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#64748b' }} width={55} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                const rawVal = d?.type === 'neg' ? -(d?.value ?? 0) : (d?.value ?? 0);
                return (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-xs">
                    <p className="font-bold text-slate-700 mb-1">{label}</p>
                    <p className={`font-semibold ${rawVal < 0 ? 'text-red-500' : 'text-slate-800'}`}>{fmtBRL(rawVal)}</p>
                  </div>
                );
              }}
            />
            {/* Barra invisível de base para criar efeito waterfall */}
            <Bar dataKey="base" stackId="a" fill="transparent" legendType="none" />
            <Bar dataKey="value" stackId="a" radius={[3, 3, 0, 0]} legendType="none">
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.type === 'total' ? AUDI_COLOR : d.type === 'neg' ? '#ef4444' : '#22c55e'}
                  opacity={d.type === 'total' ? 1 : 0.85}
                />
              ))}
            </Bar>
            <ReferenceLine y={0} stroke="#cbd5e1" />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 justify-center mt-1 text-[0.65rem] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-green-500 inline-block" /> Positivo</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-red-500 inline-block" /> Negativo</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ backgroundColor: AUDI_COLOR }} /> Total</span>
        </div>
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

  // ── Período de análise ────────────────────────────────────────────────────────
  // month=0 → ano completo (índice 11 = dezembro, acumulado todos os 12)
  const maxMonthIdx = month === 0 ? 11 : month - 1; // índice 0-based do mês selecionado ou dez
  const currentRow  = allMonthRows[maxMonthIdx] ?? createEmptyDreAudiRow(year, maxMonthIdx + 1);
  const prevRow     = maxMonthIdx > 0 ? allMonthRows[maxMonthIdx - 1] : null;
  const accumRow    = accumulate(allMonthRows, maxMonthIdx + 1); // Jan → mês selecionado

  // Filtra para dept específico ou consolidado
  function getVal(row: DreAudiRow, field: keyof DreAudiDept, dept: DeptFilter): number {
    if (dept === 'consolidado') return sumDeptField(row, field);
    return parseVal(row[dept][field]);
  }

  const curReceita  = getVal(currentRow,  'receitaOperacionalLiquida',  deptFilter);
  const curMargem   = getVal(currentRow,  'margemContribuicao',          deptFilter);
  const curLucroOp  = getVal(currentRow,  'lucroPrejOperacionalLiquido', deptFilter);
  const curLucroLiq = getVal(currentRow,  'lucroLiquidoExercicio',       deptFilter);
  const curVolume   = getVal(currentRow,  'quant',                       deptFilter);
  const curDesp     = DEPTS.reduce((s, d) => {
    if (deptFilter !== 'consolidado' && deptFilter !== d.key) return s;
    return s + parseVal(currentRow[d.key].despPessoal)
             + parseVal(currentRow[d.key].despServTerceiros)
             + parseVal(currentRow[d.key].despOcupacao)
             + parseVal(currentRow[d.key].despFuncionamento)
             + parseVal(currentRow[d.key].despVendas);
  }, 0);

  const accReceita  = getVal(accumRow, 'receitaOperacionalLiquida',  deptFilter);
  const accMargem   = getVal(accumRow, 'margemContribuicao',          deptFilter);
  const accLucroLiq = getVal(accumRow, 'lucroLiquidoExercicio',       deptFilter);
  const accVolume   = getVal(accumRow, 'quant',                       deptFilter);
  const accDesp     = DEPTS.reduce((s, d) => {
    if (deptFilter !== 'consolidado' && deptFilter !== d.key) return s;
    return s + parseVal(accumRow[d.key].despPessoal)
             + parseVal(accumRow[d.key].despServTerceiros)
             + parseVal(accumRow[d.key].despOcupacao)
             + parseVal(accumRow[d.key].despFuncionamento)
             + parseVal(accumRow[d.key].despVendas);
  }, 0);

  // Delta vs mês anterior
  const prevReceita  = prevRow ? getVal(prevRow, 'receitaOperacionalLiquida',  deptFilter) : null;
  const prevMargem   = prevRow ? getVal(prevRow, 'margemContribuicao',          deptFilter) : null;
  const prevLucroLiq = prevRow ? getVal(prevRow, 'lucroLiquidoExercicio',       deptFilter) : null;
  const prevVolume   = prevRow ? getVal(prevRow, 'quant',                       deptFilter) : null;
  const prevDesp     = prevRow ? DEPTS.reduce((s, d) => {
    if (deptFilter !== 'consolidado' && deptFilter !== d.key) return s;
    return s + parseVal(prevRow[d.key].despPessoal)
             + parseVal(prevRow[d.key].despServTerceiros)
             + parseVal(prevRow[d.key].despOcupacao)
             + parseVal(prevRow[d.key].despFuncionamento)
             + parseVal(prevRow[d.key].despVendas);
  }, 0) : null;

  function delta(cur: number, prev: number | null) {
    if (prev === null || prev === 0) return undefined;
    return ((cur - prev) / Math.abs(prev)) * 100;
  }

  // Título do período
  const periodoLabel = month === 0
    ? `Ano ${year}`
    : MONTHS_FULL[month - 1] + ' de ' + year;
  const acumLabel = month === 0
    ? `Acum. ${year}`
    : `Acum. Jan–${MONTHS[month - 1]}/${year}`;

  // ── Dados: Lucro Líquido por departamento (mês atual) ────────────────────────
  const lucroByDept = DEPTS.map(d => ({
    name: d.shortLabel,
    value: parseVal(currentRow[d.key].lucroLiquidoExercicio),
    color: d.color,
  }));

  // ── Dados: Receita por departamento (pizza) ───────────────────────────────────
  const receitaByDept = DEPTS
    .map(d => ({ name: d.shortLabel, value: Math.abs(parseVal(currentRow[d.key].receitaOperacionalLiquida)), color: d.color }))
    .filter(d => d.value > 0);

  // ── Dados: Composição de despesas ────────────────────────────────────────────
  const getDepField = (row: DreAudiRow, field: keyof DreAudiDept): number => {
    if (deptFilter === 'consolidado') return sumDeptField(row, field);
    return parseVal(row[deptFilter][field]);
  };
  const despComposicao = [
    { name: 'Pessoal',    value: Math.abs(getDepField(currentRow, 'despPessoal')),         color: '#ef4444' },
    { name: 'Terceiros',  value: Math.abs(getDepField(currentRow, 'despServTerceiros')),   color: '#f97316' },
    { name: 'Ocupação',   value: Math.abs(getDepField(currentRow, 'despOcupacao')),         color: '#eab308' },
    { name: 'Funciona.',  value: Math.abs(getDepField(currentRow, 'despFuncionamento')),   color: '#8b5cf6' },
    { name: 'Vendas',     value: Math.abs(getDepField(currentRow, 'despVendas')),           color: '#06b6d4' },
  ].filter(d => d.value > 0);

  // ── Dados: Evolução mensal (Jan → mês selecionado) ────────────────────────────
  const evolucaoData = allMonthRows.slice(0, maxMonthIdx + 1).map((row, i) => ({
    mes: MONTHS[i],
    receita:   getVal(row, 'receitaOperacionalLiquida',  deptFilter),
    margem:    getVal(row, 'margemContribuicao',          deptFilter),
    lucroLiq:  getVal(row, 'lucroLiquidoExercicio',       deptFilter),
    volume:    getVal(row, 'quant',                       deptFilter),
  }));

  // ── Dados: Receita vs Custo por departamento ─────────────────────────────────
  const recVsCustoByDept = DEPTS.map(d => ({
    name: d.shortLabel,
    receita: parseVal(currentRow[d.key].receitaOperacionalLiquida),
    custo:   Math.abs(parseVal(currentRow[d.key].custoOperacionalReceita)),
    color:   d.color,
  }));

  // ── Dados: Volume de vendas por departamento ──────────────────────────────────
  const volumeByDept = DEPTS
    .map(d => ({ name: d.shortLabel, value: parseVal(currentRow[d.key].quant), color: d.color }))
    .filter(d => d.value > 0);

  // ── Row DRE para waterfall ────────────────────────────────────────────────────
  // Para o waterfall, criamos uma linha "virtual" com os valores do filtro
  const waterfallRow: DreAudiRow = createEmptyDreAudiRow(year, month === 0 ? 0 : month);
  if (deptFilter === 'consolidado') {
    // Usa currentRow diretamente
    for (const d of DEPTS) waterfallRow[d.key] = currentRow[d.key];
  } else {
    // Replica o dept selecionado em todos os slots para sumDeptField funcionar
    waterfallRow[deptFilter] = currentRow[deptFilter];
  }

  const periodLabel2 = deptFilter === 'consolidado'
    ? `${periodoLabel} — Todos os departamentos`
    : `${periodoLabel} — ${DEPTS.find(d => d.key === deptFilter)?.label}`;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-[1400px] mx-auto p-4 flex flex-col gap-5">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Audi — Análise Gráfica</h2>
            <p className="text-sm text-slate-500">{periodoLabel} · Acumulado: {acumLabel}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </button>
        </div>

        {/* ── Seletor de departamento ─────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setDeptFilter('consolidado')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full border transition-all ${
              deptFilter === 'consolidado'
                ? 'text-white border-transparent shadow-sm'
                : 'text-slate-600 bg-white border-slate-200 hover:border-slate-300'
            }`}
            style={deptFilter === 'consolidado' ? { backgroundColor: AUDI_COLOR } : {}}
          >
            Consolidado
          </button>
          {DEPTS.map(d => (
            <button
              key={d.key}
              onClick={() => setDeptFilter(d.key)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                deptFilter === d.key
                  ? 'text-white border-transparent shadow-sm'
                  : 'text-slate-600 bg-white border-slate-200 hover:border-slate-300'
              }`}
              style={deptFilter === d.key ? { backgroundColor: d.color } : {}}
            >
              {d.shortLabel}
            </button>
          ))}
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Volume de Vendas"
            value={curVolume}
            subLabel={acumLabel}
            subValue={accVolume}
            delta={delta(curVolume, prevVolume)}
            isVolume
          />
          <KpiCard
            label="Receita Líquida"
            value={curReceita}
            subLabel={acumLabel}
            subValue={accReceita}
            delta={delta(curReceita, prevReceita)}
          />
          <KpiCard
            label="Margem de Contribuição"
            value={curMargem}
            subLabel={acumLabel}
            subValue={accMargem}
            delta={delta(curMargem, prevMargem)}
          />
          <KpiCard
            label="% Margem"
            value={curReceita !== 0 ? Math.round((curMargem / curReceita) * 1000) / 10 : 0}
            subLabel="Acum."
            subValue={accReceita !== 0 ? Math.round((accMargem / accReceita) * 1000) / 10 : 0}
            isVolume
          />
          <KpiCard
            label="Despesas Totais"
            value={curDesp}
            subLabel={acumLabel}
            subValue={accDesp}
            delta={delta(curDesp, prevDesp)}
          />
          <KpiCard
            label="Lucro Líquido"
            value={curLucroLiq}
            subLabel={acumLabel}
            subValue={accLucroLiq}
            delta={delta(curLucroLiq, prevLucroLiq)}
            color={AUDI_COLOR}
          />
        </div>

        {/* ── Linha 1: Waterfall + Receita por Dept ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <WaterfallChart row={waterfallRow} title={periodLabel2} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3" style={{ backgroundColor: AUDI_COLOR }}>
              <p className="text-white font-bold text-sm">Receita por Departamento</p>
              <p className="text-white/70 text-[0.65rem] mt-0.5">{periodoLabel} — Composição</p>
            </div>
            <div className="p-3">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={receitaByDept}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={10}
                  >
                    {receitaByDept.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Linha 2: Lucro por Dept + Composição Despesas ──────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Lucro Líquido por departamento */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3" style={{ backgroundColor: AUDI_COLOR }}>
              <p className="text-white font-bold text-sm">Lucro Líquido por Departamento</p>
              <p className="text-white/70 text-[0.65rem] mt-0.5">{periodoLabel}</p>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={lucroByDept} layout="vertical" margin={{ left: 0, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} width={60} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Lucro Líquido" radius={[0, 4, 4, 0]}>
                    {lucroByDept.map((d, i) => <Cell key={i} fill={d.value >= 0 ? d.color : '#ef4444'} />)}
                  </Bar>
                  <ReferenceLine x={0} stroke="#cbd5e1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Composição de despesas */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3" style={{ backgroundColor: AUDI_COLOR }}>
              <p className="text-white font-bold text-sm">Composição de Despesas</p>
              <p className="text-white/70 text-[0.65rem] mt-0.5">
                {periodoLabel} — {deptFilter === 'consolidado' ? 'Todos os departamentos' : DEPTS.find(d => d.key === deptFilter)?.label}
              </p>
            </div>
            <div className="p-3">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={despComposicao}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {despComposicao.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Linha 3: Receita vs Custo por dept ─────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3" style={{ backgroundColor: AUDI_COLOR }}>
            <p className="text-white font-bold text-sm">Receita vs Custo por Departamento</p>
            <p className="text-white/70 text-[0.65rem] mt-0.5">{periodoLabel}</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={recVsCustoByDept} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="receita" name="Receita" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="custo"   name="Custo"   fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Linha 4: Volume de Vendas ───────────────────────────────────────── */}
        {deptFilter === 'consolidado' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3" style={{ backgroundColor: AUDI_COLOR }}>
              <p className="text-white font-bold text-sm">Volume de Vendas por Departamento</p>
              <p className="text-white/70 text-[0.65rem] mt-0.5">{periodoLabel} — unidades</p>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={volumeByDept} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip content={(props) => <ChartTooltip {...props} currency={false} />} />
                  <Bar dataKey="value" name="Unidades" radius={[3, 3, 0, 0]}>
                    {volumeByDept.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Linha 5: Evolução Mensal ────────────────────────────────────────── */}
        {evolucaoData.length > 1 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3" style={{ backgroundColor: AUDI_COLOR }}>
              <p className="text-white font-bold text-sm">Evolução Mensal</p>
              <p className="text-white/70 text-[0.65rem] mt-0.5">
                Jan–{MONTHS[maxMonthIdx]}/{year} — {deptFilter === 'consolidado' ? 'Todos os departamentos' : DEPTS.find(d => d.key === deptFilter)?.label}
              </p>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={evolucaoData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#374151' }} />
                  <YAxis yAxisId="left"  tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={v => String(Math.round(v))} tick={{ fontSize: 10, fill: '#64748b' }} width={40} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Area yAxisId="left"  type="monotone" dataKey="receita"  name="Receita Líquida"   fill="#dbeafe" stroke="#3b82f6" strokeWidth={2} fillOpacity={0.4} />
                  <Area yAxisId="left"  type="monotone" dataKey="margem"   name="Margem Contribuição" fill="#dcfce7" stroke="#22c55e" strokeWidth={2} fillOpacity={0.4} />
                  <Line  yAxisId="left"  type="monotone" dataKey="lucroLiq" name="Lucro Líquido"    stroke={AUDI_COLOR} strokeWidth={2.5} dot={{ r: 4, fill: AUDI_COLOR }} />
                  <Bar   yAxisId="right" dataKey="volume"   name="Volume (un.)"  fill="#e0e7ff" radius={[3, 3, 0, 0]} />
                  <ReferenceLine yAxisId="left" y={0} stroke="#cbd5e1" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
