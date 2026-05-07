import { useState, useEffect } from 'react';
import { Printer, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
  LineChart, Line, ReferenceLine,
} from 'recharts';
import {
  loadDreVw,
  createEmptyDreVwRow,
  migrateVwAjustes,
  type DreVwRow,
  type DreVwDept,
} from './dreVwStorage';
import {
  loadDreAudi,
  createEmptyDreAudiRow,
  migrateAjustes,
  type DreAudiRow,
  type DreAudiDept,
} from './dreAudiStorage';
import { loadDREDataAsync } from '@/lib/dbStorage';
import type { Department } from '@/lib/dataStorage';

// ─── Cores ────────────────────────────────────────────────────────────────────

const CON_COLOR     = '#7c3aed';
const CON_COLOR_DRK = '#5b21b6';
const VW_BRAND_COLOR   = '#001e50';
const AUDI_BRAND_COLOR = '#bb0a30';

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL  = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// ─── Departamentos VW ─────────────────────────────────────────────────────────

type VwDeptKey = 'novos' | 'usados' | 'direta' | 'pecas' | 'oficina' | 'funilaria' | 'adm';

const VW_DEPTS: { key: VwDeptKey; label: string; shortLabel: string; color: string }[] = [
  { key: 'novos',     label: 'Veículos Novos',        shortLabel: 'Novos',    color: '#1d4ed8' },
  { key: 'usados',    label: 'Veículos Usados',        shortLabel: 'Usados',   color: '#7c3aed' },
  { key: 'direta',    label: 'Venda Direta',           shortLabel: 'Direta',   color: '#0891b2' },
  { key: 'pecas',     label: 'Peças e Acessórios',     shortLabel: 'Peças',    color: '#059669' },
  { key: 'oficina',   label: 'Oficina / Assist. Téc.', shortLabel: 'Oficina',  color: '#d97706' },
  { key: 'funilaria', label: 'Funilaria',               shortLabel: 'Funilaria',color: '#db2777' },
  { key: 'adm',       label: 'Administração',           shortLabel: 'Adm',      color: '#64748b' },
];

const VW_DEPT_TO_DEPARTMENT: Record<VwDeptKey, Department> = {
  novos:     'novos',
  usados:    'usados',
  direta:    'vendaDireta',
  pecas:     'pecas',
  oficina:   'oficina',
  funilaria: 'funilaria',
  adm:       'administracao',
};

// ─── Departamentos Audi ───────────────────────────────────────────────────────

type AudiDeptKey = 'novos' | 'usados' | 'pecas' | 'oficina' | 'funilaria' | 'adm';

const AUDI_DEPTS: { key: AudiDeptKey; label: string; shortLabel: string; color: string }[] = [
  { key: 'novos',     label: 'Veículos Novos',        shortLabel: 'Novos',    color: '#1d4ed8' },
  { key: 'usados',    label: 'Veículos Usados',        shortLabel: 'Usados',   color: '#7c3aed' },
  { key: 'pecas',     label: 'Peças e Acessórios',     shortLabel: 'Peças',    color: '#059669' },
  { key: 'oficina',   label: 'Oficina / Assist. Téc.', shortLabel: 'Oficina',  color: '#d97706' },
  { key: 'funilaria', label: 'Funilaria',               shortLabel: 'Funilaria',color: '#db2777' },
  { key: 'adm',       label: 'Administração',           shortLabel: 'Adm',      color: '#64748b' },
];

const AUDI_DEPT_TO_DEPARTMENT: Record<AudiDeptKey, Department> = {
  novos:     'novos',
  usados:    'usados',
  pecas:     'pecas',
  oficina:   'oficina',
  funilaria: 'funilaria',
  adm:       'administracao',
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

function sumVwRow(row: DreVwRow, field: keyof DreVwDept): number {
  return VW_DEPTS.reduce((s, d) => {
    if (d.key === 'adm' && field === 'receitaOperacionalLiquida') return s;
    return s + parseVal(row[d.key][field]);
  }, 0);
}

function sumAudiRow(row: DreAudiRow, field: keyof DreAudiDept): number {
  return AUDI_DEPTS.reduce((s, d) => {
    if (d.key === 'adm' && field === 'receitaOperacionalLiquida') return s;
    return s + parseVal(row[d.key][field]);
  }, 0);
}

function sumConsolidado(vw: DreVwRow, audi: DreAudiRow, field: keyof DreVwDept & keyof DreAudiDept): number {
  return sumVwRow(vw, field) + sumAudiRow(audi, field as keyof DreAudiDept);
}

const DESCRICAO_TO_VW_FIELD: Record<string, keyof DreVwDept> = {
  'VOLUME DE VENDAS': 'quant', 'RECEITA OPERACIONAL LIQUIDA': 'receitaOperacionalLiquida',
  'CUSTO OPERACIONAL DA RECEITA': 'custoOperacionalReceita', 'LUCRO (PREJUIZO) OPERACIONAL BRUTO': 'lucroPrejOperacionalBruto',
  'OUTRAS RECEITAS OPERACIONAIS': 'outrasReceitasOperacionais', 'OUTRAS DESPESAS OPERACIONAIS': 'outrasDespesasOperacionais',
  'MARGEM DE CONTRIBUIÇÃO': 'margemContribuicao', 'MARGEM DE CONTRIBUICAO': 'margemContribuicao',
  'DESPESAS C/ PESSOAL': 'despPessoal', 'DESPESAS C/ SERV. DE TERCEIROS': 'despServTerceiros',
  'DESPESAS C/ OCUPAÇÃO': 'despOcupacao', 'DESPESAS C/ OCUPACAO': 'despOcupacao',
  'DESPESAS C/ FUNCIONAMENTO': 'despFuncionamento', 'DESPESAS C/ VENDAS': 'despVendas',
  'LUCRO (PREJUIZO) OPERACIONAL LIQUIDO': 'lucroPrejOperacionalLiquido',
  'AMORTIZAÇÕES E DEPRECIAÇÕES': 'amortizacoesDepreciacoes', 'AMORTIZACOES E DEPRECIACOES': 'amortizacoesDepreciacoes',
  'OUTRAS RECEITAS FINANCEIRAS': 'outrasReceitasFinanceiras',
  'DESPESAS FINANCEIRAS NÃO OPERACIONAL': 'despFinanceirasNaoOperacional', 'DESPESAS FINANCEIRAS NAO OPERACIONAL': 'despFinanceirasNaoOperacional',
  'DESPESAS NÃO OPERACIONAIS': 'despesasNaoOperacionais', 'DESPESAS NAO OPERACIONAIS': 'despesasNaoOperacionais',
  'OUTRAS RENDAS NÃO OPERACIONAIS': 'outrasRendasNaoOperacionais', 'OUTRAS RENDAS NAO OPERACIONAIS': 'outrasRendasNaoOperacionais',
  'LUCRO (PREJUIZO) ANTES IMPOSTOS': 'lucroPrejAntesImpostos',
  'PROVISÕES IRPJ E C.S.': 'provisoesIrpjCs', 'PROVISOES IRPJ E C.S.': 'provisoesIrpjCs',
  'PARTICIPAÇÕES': 'participacoes', 'PARTICIPACOES': 'participacoes',
  'LUCRO LIQUIDO DO EXERCICIO': 'lucroLiquidoExercicio',
};

const DESCRICAO_TO_AUDI_FIELD: Record<string, keyof DreAudiDept> = DESCRICAO_TO_VW_FIELD as any;

function buildVwDeptFromDRE(dreData: any[] | null, monthIndex: number): DreVwDept {
  const dept = createEmptyDreVwRow(0, 0).novos;
  if (!dreData) return dept;
  for (const line of dreData) {
    const descKey = ((line.descricao as string) || (line.label as string) || '').toUpperCase().trim();
    const field = DESCRICAO_TO_VW_FIELD[descKey];
    if (field) { const meses: number[] = line.meses || line.values || []; const val = meses[monthIndex]; if (val !== undefined && val !== null && val !== 0) dept[field] = val.toString(); }
  }
  return dept;
}

function buildAudiDeptFromDRE(dreData: any[] | null, monthIndex: number): DreAudiDept {
  const dept = createEmptyDreAudiRow(0, 0).novos;
  if (!dreData) return dept;
  for (const line of dreData) {
    const descKey = ((line.descricao as string) || (line.label as string) || '').toUpperCase().trim();
    const field = DESCRICAO_TO_AUDI_FIELD[descKey];
    if (field) { const meses: number[] = line.meses || line.values || []; const val = meses[monthIndex]; if (val !== undefined && val !== null && val !== 0) dept[field] = val.toString(); }
  }
  return dept;
}

function accumulateVw(rows: DreVwRow[], upToIdx: number): DreVwRow {
  const acc = createEmptyDreVwRow(0, 0);
  for (let i = 0; i <= upToIdx; i++) {
    const row = rows[i]; if (!row) continue;
    for (const d of VW_DEPTS) {
      for (const key of Object.keys(acc[d.key]) as (keyof DreVwDept)[]) {
        const t = parseVal(acc[d.key][key]) + parseVal(row[d.key][key]);
        if (t !== 0) acc[d.key][key] = t.toString();
      }
    }
  }
  return acc;
}

function accumulateAudi(rows: DreAudiRow[], upToIdx: number): DreAudiRow {
  const acc = createEmptyDreAudiRow(0, 0);
  for (let i = 0; i <= upToIdx; i++) {
    const row = rows[i]; if (!row) continue;
    for (const d of AUDI_DEPTS) {
      for (const key of Object.keys(acc[d.key]) as (keyof DreAudiDept)[]) {
        const t = parseVal(acc[d.key][key]) + parseVal(row[d.key][key]);
        if (t !== 0) acc[d.key][key] = t.toString();
      }
    }
  }
  return acc;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, mesValue, accumValue, delta, isVolume = false, isPct = false,
}: {
  label: string; mesValue: number; accumValue: number;
  delta?: number; isVolume?: boolean; isPct?: boolean;
}) {
  const hasDelta = delta !== undefined && !isNaN(delta) && isFinite(delta);
  const isPos    = hasDelta && delta! > 0;
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

// ─── Waterfall Consolidado ────────────────────────────────────────────────────

type WfField = keyof DreVwDept & keyof DreAudiDept;

const WF_STEPS: { label: string; field: WfField }[] = [
  { label: 'Rec. Líquida',  field: 'receitaOperacionalLiquida'   },
  { label: 'Margem Bruta',  field: 'lucroPrejOperacionalBruto'   },
  { label: 'Margem Contr.', field: 'margemContribuicao'          },
  { label: 'Result. Op.',   field: 'lucroPrejOperacionalLiquido' },
  { label: 'Lucro Líquido', field: 'lucroLiquidoExercicio'       },
];

function WaterfallPanel({ vwRow, audiRow, title, subtitle }: { vwRow: DreVwRow; audiRow: DreAudiRow; title: string; subtitle: string }) {
  const data = WF_STEPS.map(s => ({ label: s.label, value: sumConsolidado(vwRow, audiRow, s.field) }));
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
      <div className="px-4 py-2.5" style={{ backgroundColor: CON_COLOR }}>
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
              return <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 text-xs"><p className="font-bold text-slate-700 mb-1">{label}</p><p className={`font-semibold text-base ${v < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmtBRL(v)}</p></div>;
            }} />
            <Bar dataKey="value" radius={[4,4,0,0]} name="Valor">
              {data.map((d, i) => <Cell key={i} fill={d.value >= 0 ? (i === data.length - 1 ? CON_COLOR : '#22c55e') : '#ef4444'} />)}
            </Bar>
            <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1.5} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 text-[0.6rem] text-slate-400 mt-1">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-sm bg-green-500 inline-block" />Positivo</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-sm bg-red-500 inline-block" />Negativo</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-sm inline-block" style={{ backgroundColor: CON_COLOR }} />Lucro Líq.</span>
        </div>
      </div>
    </div>
  );
}

// ─── Donut por Marca ──────────────────────────────────────────────────────────

function DonutMarca({ data, title, subtitle, brandColor }: { data: { name: string; value: number; color: string }[]; title: string; subtitle: string; brandColor: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const renderLabel = ({ cx, cy, midAngle, outerRadius, percent }: any) => {
    if (percent < 0.08) return null;
    const r = outerRadius + 16;
    const x = cx + r * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + r * Math.sin(-midAngle * Math.PI / 180);
    return <text x={x} y={y} fill="#475569" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: 10, fontWeight: 600 }}>{(percent * 100).toFixed(1)}%</text>;
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
      <div className="px-4 py-2.5 border-b border-slate-100" style={{ borderLeft: `4px solid ${brandColor}` }}>
        <p className="text-xs font-semibold text-slate-700">{title}</p>
        <p className="text-[0.6rem] text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="p-2">
        {data.filter(d => d.value > 0).length === 0
          ? <div className="flex items-center justify-center h-[200px] text-slate-400 text-xs">Sem dados</div>
          : <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={data.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={50} outerRadius={80} paddingAngle={2} label={renderLabel} labelLine={false}>
                  {data.filter(d => d.value > 0).map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0];
                  const pct = total > 0 ? ((p.value as number) / total * 100).toFixed(1) : '0.0';
                  return <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 text-xs"><p className="font-bold text-slate-700 mb-1">{p.name}</p><p className="text-slate-600">R$ {fmtBRL(p.value as number)}</p><p className="font-semibold" style={{ color: p.payload.color }}>{pct}% do total</p></div>;
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

export function ConsolidadoGraficosTab({ year, month }: Props) {
  const [loading, setLoading]             = useState(true);
  const [vwRows, setVwRows]               = useState<DreVwRow[]>([]);
  const [audiRows, setAudiRows]           = useState<DreAudiRow[]>([]);

  useEffect(() => {
    setLoading(true);
    const yr = year as 2024 | 2025 | 2026 | 2027;
    Promise.all([
      // VW: KV + DRE fallback
      Promise.all(Array.from({ length: 12 }, (_, i) => loadDreVw(year, i + 1))),
      Promise.all(VW_DEPTS.map(d =>
        loadDREDataAsync(yr, VW_DEPT_TO_DEPARTMENT[d.key], 'vw').then(dre => ({ key: d.key, dre }))
      )),
      // Audi: KV + DRE fallback
      Promise.all(Array.from({ length: 12 }, (_, i) => loadDreAudi(year, i + 1))),
      Promise.all(AUDI_DEPTS.map(d =>
        loadDREDataAsync(yr, AUDI_DEPT_TO_DEPARTMENT[d.key], 'audi').then(dre => ({ key: d.key, dre }))
      )),
    ]).then(([vwKv, vwDre, auKv, auDre]) => {
      const vwDreLk: Record<string, any[] | null> = {};
      for (const { key, dre } of vwDre) vwDreLk[key] = dre;
      const auDreLk: Record<string, any[] | null> = {};
      for (const { key, dre } of auDre) auDreLk[key] = dre;

      const hasVwData = (dept: DreVwDept)   => Object.values(dept).some(v => v !== '');
      const hasAuData = (dept: DreAudiDept) => Object.values(dept).some(v => v !== '');

      const vwBuilt = vwKv.map((kv, i) => {
        const row = createEmptyDreVwRow(year, i + 1);
        for (const d of VW_DEPTS) row[d.key] = (kv && hasVwData(kv[d.key])) ? kv[d.key] : buildVwDeptFromDRE(vwDreLk[d.key] ?? null, i);
        if (kv) row.ajustes = migrateVwAjustes(kv.ajustes);
        return row;
      });

      const auBuilt = auKv.map((kv, i) => {
        const row = createEmptyDreAudiRow(year, i + 1);
        for (const d of AUDI_DEPTS) row[d.key] = (kv && hasAuData(kv[d.key])) ? kv[d.key] : buildAudiDeptFromDRE(auDreLk[d.key] ?? null, i);
        if (kv) row.ajustes = migrateAjustes(kv.ajustes);
        return row;
      });

      setVwRows(vwBuilt);
      setAudiRows(auBuilt);
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

  const selIdx      = month === 0 ? 11 : month - 1;
  const vwMes       = vwRows[selIdx]   ?? createEmptyDreVwRow(year, selIdx + 1);
  const auMes       = audiRows[selIdx] ?? createEmptyDreAudiRow(year, selIdx + 1);
  const vwPrev      = selIdx > 0 ? vwRows[selIdx - 1]   : null;
  const auPrev      = selIdx > 0 ? audiRows[selIdx - 1] : null;
  const vwAccum     = accumulateVw(vwRows, selIdx);
  const auAccum     = accumulateAudi(audiRows, selIdx);

  // KPIs consolidados
  const mesReceita  = sumConsolidado(vwMes, auMes, 'receitaOperacionalLiquida');
  const mesMargemC  = sumConsolidado(vwMes, auMes, 'margemContribuicao');
  const mesLucroLiq = sumConsolidado(vwMes, auMes, 'lucroLiquidoExercicio');
  const mesVolume   = sumConsolidado(vwMes, auMes, 'quant');
  const accReceita  = sumConsolidado(vwAccum, auAccum, 'receitaOperacionalLiquida');
  const accMargemC  = sumConsolidado(vwAccum, auAccum, 'margemContribuicao');
  const accLucroLiq = sumConsolidado(vwAccum, auAccum, 'lucroLiquidoExercicio');
  const accVolume   = sumConsolidado(vwAccum, auAccum, 'quant');

  const sumDesp = (vw: DreVwRow, au: DreAudiRow) =>
    [...VW_DEPTS, ...AUDI_DEPTS].reduce((s, d) => {
      const row = VW_DEPTS.find(x => x.key === d.key) ? vw : au;
      return s + parseVal((row as any)[d.key].despPessoal) + parseVal((row as any)[d.key].despServTerceiros)
               + parseVal((row as any)[d.key].despOcupacao) + parseVal((row as any)[d.key].despFuncionamento)
               + parseVal((row as any)[d.key].despVendas);
    }, 0) / 2; // divide por 2 porque iteramos depts duplicados (vw e audi têm os mesmos nomes exceto direta)

  // Calcula despesas corretamente sem duplicação
  const sumDespCorreto = (vw: DreVwRow, au: DreAudiRow) => {
    const vwDesp = VW_DEPTS.reduce((s, d) =>
      s + parseVal(vw[d.key].despPessoal) + parseVal(vw[d.key].despServTerceiros)
        + parseVal(vw[d.key].despOcupacao) + parseVal(vw[d.key].despFuncionamento)
        + parseVal(vw[d.key].despVendas), 0);
    const auDesp = AUDI_DEPTS.reduce((s, d) =>
      s + parseVal(au[d.key].despPessoal) + parseVal(au[d.key].despServTerceiros)
        + parseVal(au[d.key].despOcupacao) + parseVal(au[d.key].despFuncionamento)
        + parseVal(au[d.key].despVendas), 0);
    return vwDesp + auDesp;
  };
  void sumDesp; // suppress unused warning

  const mesDesp  = sumDespCorreto(vwMes, auMes);
  const accDesp  = sumDespCorreto(vwAccum, auAccum);
  const prevReceita  = vwPrev && auPrev ? sumConsolidado(vwPrev, auPrev, 'receitaOperacionalLiquida') : null;
  const prevMargemC  = vwPrev && auPrev ? sumConsolidado(vwPrev, auPrev, 'margemContribuicao') : null;
  const prevLucroLiq = vwPrev && auPrev ? sumConsolidado(vwPrev, auPrev, 'lucroLiquidoExercicio') : null;
  const prevVolume   = vwPrev && auPrev ? sumConsolidado(vwPrev, auPrev, 'quant') : null;
  const prevDesp     = vwPrev && auPrev ? sumDespCorreto(vwPrev, auPrev) : null;

  function delta(cur: number, prev: number | null) {
    if (prev === null || prev === 0) return undefined;
    return ((cur - prev) / Math.abs(prev)) * 100;
  }

  const mesLabel    = month === 0 ? `Dez/${year}` : MONTHS_SHORT[month - 1] + `/${year}`;
  const accumLabel  = month === 0 ? `Ano ${year}` : `Jan–${MONTHS_SHORT[month - 1]}/${year}`;
  const periodoFull = month === 0 ? `Ano ${year}` : `${MONTHS_FULL[month - 1]} de ${year}`;
  const mesPctMargem   = mesReceita  !== 0 ? (mesMargemC  / mesReceita)  * 100 : 0;
  const accumPctMargem = accReceita  !== 0 ? (accMargemC  / accReceita)  * 100 : 0;

  // Donuts receita por dept — VW
  const vwReceitaMes = VW_DEPTS.filter(d => d.key !== 'adm').map(d => ({
    name: d.shortLabel, value: Math.abs(parseVal(vwMes[d.key].receitaOperacionalLiquida)), color: d.color,
  }));
  const vwReceitaAcum = VW_DEPTS.filter(d => d.key !== 'adm').map(d => ({
    name: d.shortLabel, value: Math.abs(parseVal(vwAccum[d.key].receitaOperacionalLiquida)), color: d.color,
  }));
  // Donuts receita por dept — Audi
  const auReceitaMes = AUDI_DEPTS.filter(d => d.key !== 'adm').map(d => ({
    name: d.shortLabel, value: Math.abs(parseVal(auMes[d.key].receitaOperacionalLiquida)), color: d.color,
  }));
  const auReceitaAcum = AUDI_DEPTS.filter(d => d.key !== 'adm').map(d => ({
    name: d.shortLabel, value: Math.abs(parseVal(auAccum[d.key].receitaOperacionalLiquida)), color: d.color,
  }));

  // Donuts despesas por tipo — consolidado
  const buildDespData = (vw: DreVwRow, au: DreAudiRow) => [
    { name: 'Pessoal',   value: Math.abs(VW_DEPTS.reduce((s,d) => s+parseVal(vw[d.key].despPessoal),0)   + AUDI_DEPTS.reduce((s,d) => s+parseVal(au[d.key].despPessoal),0)),   color: '#ef4444' },
    { name: 'Terceiros', value: Math.abs(VW_DEPTS.reduce((s,d) => s+parseVal(vw[d.key].despServTerceiros),0) + AUDI_DEPTS.reduce((s,d) => s+parseVal(au[d.key].despServTerceiros),0)), color: '#f97316' },
    { name: 'Ocupação',  value: Math.abs(VW_DEPTS.reduce((s,d) => s+parseVal(vw[d.key].despOcupacao),0)  + AUDI_DEPTS.reduce((s,d) => s+parseVal(au[d.key].despOcupacao),0)),  color: '#eab308' },
    { name: 'Funciona.', value: Math.abs(VW_DEPTS.reduce((s,d) => s+parseVal(vw[d.key].despFuncionamento),0) + AUDI_DEPTS.reduce((s,d) => s+parseVal(au[d.key].despFuncionamento),0)), color: '#8b5cf6' },
    { name: 'Vendas',    value: Math.abs(VW_DEPTS.reduce((s,d) => s+parseVal(vw[d.key].despVendas),0)    + AUDI_DEPTS.reduce((s,d) => s+parseVal(au[d.key].despVendas),0)),    color: '#06b6d4' },
  ].filter(d => d.value > 0);

  const despMes  = buildDespData(vwMes, auMes);
  const despAcum = buildDespData(vwAccum, auAccum);

  // Barras VW vs Audi
  const barMarcas = [
    {
      name: 'VW', color: VW_BRAND_COLOR,
      receitaMes:  sumVwRow(vwMes,   'receitaOperacionalLiquida'),
      margemMes:   sumVwRow(vwMes,   'margemContribuicao'),
      lucroMes:    sumVwRow(vwMes,   'lucroLiquidoExercicio'),
      receitaAcum: sumVwRow(vwAccum, 'receitaOperacionalLiquida'),
      margemAcum:  sumVwRow(vwAccum, 'margemContribuicao'),
      lucroAcum:   sumVwRow(vwAccum, 'lucroLiquidoExercicio'),
    },
    {
      name: 'Audi', color: AUDI_BRAND_COLOR,
      receitaMes:  sumAudiRow(auMes,   'receitaOperacionalLiquida'),
      margemMes:   sumAudiRow(auMes,   'margemContribuicao'),
      lucroMes:    sumAudiRow(auMes,   'lucroLiquidoExercicio'),
      receitaAcum: sumAudiRow(auAccum, 'receitaOperacionalLiquida'),
      margemAcum:  sumAudiRow(auAccum, 'margemContribuicao'),
      lucroAcum:   sumAudiRow(auAccum, 'lucroLiquidoExercicio'),
    },
  ];

  // Evolução mensal — VW, Audi, Total
  const maxIdx = Math.min(vwRows.length, audiRows.length, selIdx + 1);
  const evolucao = Array.from({ length: maxIdx }, (_, i) => {
    const vw = vwRows[i]   ?? createEmptyDreVwRow(year, i + 1);
    const au = audiRows[i] ?? createEmptyDreAudiRow(year, i + 1);
    return {
      mes:    MONTHS_SHORT[i],
      vw:     sumVwRow(vw,   'lucroLiquidoExercicio'),
      audi:   sumAudiRow(au, 'lucroLiquidoExercicio'),
      total:  sumConsolidado(vw, au, 'lucroLiquidoExercicio'),
    };
  });

  // Semáforo VW + Audi
  const semaforoVw = VW_DEPTS.map(d => {
    const lucro     = parseVal(vwMes[d.key].lucroLiquidoExercicio);
    const lucroPrev = vwPrev ? parseVal(vwPrev[d.key].lucroLiquidoExercicio) : 0;
    return { key: `vw-${d.key}`, shortLabel: `VW ${d.shortLabel}`, lucro, brandColor: VW_BRAND_COLOR,
      status: lucro > 0 && lucro >= lucroPrev ? 'verde' : lucro > 0 ? 'amarelo' : 'vermelho' };
  });
  const semaforoAudi = AUDI_DEPTS.map(d => {
    const lucro     = parseVal(auMes[d.key].lucroLiquidoExercicio);
    const lucroPrev = auPrev ? parseVal(auPrev[d.key].lucroLiquidoExercicio) : 0;
    return { key: `au-${d.key}`, shortLabel: `Audi ${d.shortLabel}`, lucro, brandColor: AUDI_BRAND_COLOR,
      status: lucro > 0 && lucro >= lucroPrev ? 'verde' : lucro > 0 ? 'amarelo' : 'vermelho' };
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div id="consolidado-graficos-print-area" className="max-w-[1440px] mx-auto p-4 flex flex-col gap-4">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Consolidado — Análise Gráfica</h2>
            <p className="text-sm text-slate-500">{periodoFull} · Acumulado: {accumLabel}</p>
          </div>
          <button
            onClick={() => {
              const area = document.getElementById('consolidado-graficos-print-area');
              const root = document.getElementById('print-root');
              if (area && root) { root.innerHTML = area.outerHTML; window.print(); root.innerHTML = ''; }
              else window.print();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </button>
        </div>

        {/* ── Semáforo ────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider mb-3">Saúde dos Departamentos — {mesLabel}</p>
          <div className="mb-2">
            <p className="text-[0.6rem] font-semibold uppercase tracking-wider mb-2" style={{ color: VW_BRAND_COLOR }}>VW Norte</p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {semaforoVw.map(d => (
                <div key={d.key} className="flex flex-col items-center gap-1">
                  <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: d.status === 'verde' ? '#22c55e' : d.status === 'amarelo' ? '#eab308' : '#ef4444' }} />
                  <span className="text-[0.6rem] font-semibold text-slate-600 text-center leading-tight">{d.shortLabel.replace('VW ', '')}</span>
                  <span className={`text-[0.55rem] font-bold ${d.lucro >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtK(d.lucro)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-slate-100 pt-2 mt-1">
            <p className="text-[0.6rem] font-semibold uppercase tracking-wider mb-2" style={{ color: AUDI_BRAND_COLOR }}>Audi</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {semaforoAudi.map(d => (
                <div key={d.key} className="flex flex-col items-center gap-1">
                  <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: d.status === 'verde' ? '#22c55e' : d.status === 'amarelo' ? '#eab308' : '#ef4444' }} />
                  <span className="text-[0.6rem] font-semibold text-slate-600 text-center leading-tight">{d.shortLabel.replace('Audi ', '')}</span>
                  <span className={`text-[0.55rem] font-bold ${d.lucro >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtK(d.lucro)}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[0.6rem] text-slate-400 mt-2">🟢 Positivo e crescendo · 🟡 Positivo mas caindo · 🔴 Negativo</p>
        </div>

        {/* ── KPI Cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Volume de Vendas"       mesValue={mesVolume}    accumValue={accVolume}    delta={delta(mesVolume,   prevVolume)}   isVolume />
          <KpiCard label="Receita Líquida"        mesValue={mesReceita}   accumValue={accReceita}   delta={delta(mesReceita,  prevReceita)} />
          <KpiCard label="Margem de Contribuição" mesValue={mesMargemC}   accumValue={accMargemC}   delta={delta(mesMargemC,  prevMargemC)} />
          <KpiCard label="% Margem s/ Receita"    mesValue={mesPctMargem} accumValue={accumPctMargem} isPct />
          <KpiCard label="Despesas Totais"        mesValue={mesDesp}      accumValue={accDesp}      delta={delta(mesDesp,     prevDesp)} />
          <KpiCard label="Lucro Líquido"          mesValue={mesLucroLiq}  accumValue={accLucroLiq}  delta={delta(mesLucroLiq, prevLucroLiq)} />
        </div>

        {/* ── RESULTADO DO PERÍODO ─────────────────────────────────────────── */}
        <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider">Resultado do Período</p>
        <div className="flex gap-4">
          <WaterfallPanel vwRow={vwMes}   audiRow={auMes}   title={`DRE — ${mesLabel}`}   subtitle="Resultado do mês · VW + Audi" />
          <WaterfallPanel vwRow={vwAccum} audiRow={auAccum} title={`DRE — ${accumLabel}`} subtitle="Acumulado · VW + Audi" />
        </div>

        {/* ── COMPOSIÇÃO POR MARCA ─────────────────────────────────────────── */}
        <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider">Composição por Marca</p>
        {/* Receita VW por dept */}
        <div className="flex gap-4">
          <DonutMarca data={vwReceitaMes}  title={`Receita VW por Dept — ${mesLabel}`}   subtitle="Composição da Receita Líquida VW" brandColor={VW_BRAND_COLOR} />
          <DonutMarca data={auReceitaMes}  title={`Receita Audi por Dept — ${mesLabel}`} subtitle="Composição da Receita Líquida Audi" brandColor={AUDI_BRAND_COLOR} />
        </div>
        <div className="flex gap-4">
          <DonutMarca data={vwReceitaAcum}  title={`Receita VW por Dept — ${accumLabel}`}   subtitle="Composição da Receita Líquida VW" brandColor={VW_BRAND_COLOR} />
          <DonutMarca data={auReceitaAcum}  title={`Receita Audi por Dept — ${accumLabel}`} subtitle="Composição da Receita Líquida Audi" brandColor={AUDI_BRAND_COLOR} />
        </div>

        {/* Despesas consolidadas */}
        <div className="flex gap-4">
          <DonutMarca data={despMes}  title={`Composição de Despesas — ${mesLabel}`}   subtitle="Consolidado VW + Audi" brandColor={CON_COLOR} />
          <DonutMarca data={despAcum} title={`Composição de Despesas — ${accumLabel}`} subtitle="Consolidado VW + Audi" brandColor={CON_COLOR} />
        </div>

        {/* ── POR MARCA ────────────────────────────────────────────────────── */}
        <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider">VW vs Audi</p>
        <div className="flex gap-4">
          {/* Receita por marca */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
            <div className="px-4 py-2.5 border-b border-slate-100" style={{ borderLeft: `4px solid ${CON_COLOR}` }}>
              <p className="text-xs font-semibold text-slate-700">Receita por Marca</p>
              <p className="text-[0.6rem] text-slate-400 mt-0.5">{mesLabel} vs {accumLabel}</p>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={barMarcas} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="receitaMes"  name={mesLabel}   radius={[3,3,0,0]}>
                    {barMarcas.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                  <Bar dataKey="receitaAcum" name={accumLabel} radius={[3,3,0,0]}>
                    {barMarcas.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.4} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Lucro por marca */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
            <div className="px-4 py-2.5 border-b border-slate-100" style={{ borderLeft: `4px solid ${CON_COLOR}` }}>
              <p className="text-xs font-semibold text-slate-700">Lucro Líquido por Marca</p>
              <p className="text-[0.6rem] text-slate-400 mt-0.5">{mesLabel} vs {accumLabel}</p>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={barMarcas} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} width={50} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="lucroMes"  name={mesLabel}   radius={[0,3,3,0]}>
                    {barMarcas.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                  <Bar dataKey="lucroAcum" name={accumLabel} radius={[0,3,3,0]}>
                    {barMarcas.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.5} />)}
                  </Bar>
                  <ReferenceLine x={0} stroke="#cbd5e1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── TENDÊNCIA ───────────────────────────────────────────────────── */}
        {evolucao.length > 1 && (<>
          <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider">Tendência</p>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100" style={{ borderLeft: `4px solid ${CON_COLOR}` }}>
              <p className="text-xs font-semibold text-slate-700">Evolução do Lucro Líquido — VW vs Audi vs Consolidado</p>
              <p className="text-[0.6rem] text-slate-400 mt-0.5">Jan–{MONTHS_SHORT[selIdx]}/{year}</p>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={240}>
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
                  <Line type="monotone" dataKey="vw"    name="VW Norte"      stroke={VW_BRAND_COLOR}   strokeWidth={2}   dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="audi"  name="Audi"          stroke={AUDI_BRAND_COLOR} strokeWidth={2}   dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="total" name="Consolidado"   stroke={CON_COLOR}        strokeWidth={2.5} dot={{ r: 4, fill: CON_COLOR }} />
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
