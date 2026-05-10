import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
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

const VW_COLOR     = '#001e50';
const VW_COLOR_DRK = '#001238';
const AUDI_COLOR     = '#bb0a30';
const AUDI_COLOR_DRK = '#9a0827';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL  = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

function parseVal(v: string | number | undefined): number {
  return parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
}

// ─── Linhas da tabela ─────────────────────────────────────────────────────────

interface DreLineConfig {
  label: string;
  field: keyof DreVwDept;
  isSubtotal?: boolean;
  isTotal?: boolean;
  indent?: boolean;
  separator?: boolean;
}

const DRE_LINES: DreLineConfig[] = [
  { label: 'Volume de Vendas',                           field: 'quant' },
  { label: '',                                            field: 'quant',                         separator: true },
  { label: 'Receita Operacional Líquida',                field: 'receitaOperacionalLiquida' },
  { label: '(-) Custo Operacional da Receita',           field: 'custoOperacionalReceita',        indent: true },
  { label: 'Lucro (Prejuízo) Operacional Bruto',         field: 'lucroPrejOperacionalBruto',      isSubtotal: true },
  { label: 'Outras Receitas Operacionais',               field: 'outrasReceitasOperacionais',     indent: true },
  { label: '(-) Outras Despesas Operacionais',           field: 'outrasDespesasOperacionais',     indent: true },
  { label: 'MARGEM DE CONTRIBUIÇÃO',                     field: 'margemContribuicao',             isTotal: true },
  { label: '',                                            field: 'margemContribuicao',             separator: true },
  { label: '(-) Despesas c/ Pessoal',                    field: 'despPessoal',                    indent: true },
  { label: '(-) Despesas c/ Serv. de Terceiros',         field: 'despServTerceiros',              indent: true },
  { label: '(-) Despesas c/ Ocupação',                   field: 'despOcupacao',                   indent: true },
  { label: '(-) Despesas c/ Funcionamento',              field: 'despFuncionamento',              indent: true },
  { label: '(-) Despesas c/ Vendas',                     field: 'despVendas',                     indent: true },
  { label: 'LUCRO (PREJUÍZO) OPERACIONAL LÍQUIDO',       field: 'lucroPrejOperacionalLiquido',    isTotal: true },
  { label: '',                                            field: 'lucroPrejOperacionalLiquido',    separator: true },
  { label: 'Amortizações e Depreciações',                field: 'amortizacoesDepreciacoes',       indent: true },
  { label: 'Outras Receitas Financeiras',                field: 'outrasReceitasFinanceiras',      indent: true },
  { label: '(-) Despesas Financeiras Não Operacional',   field: 'despFinanceirasNaoOperacional',  indent: true },
  { label: '(-) Despesas Não Operacionais',              field: 'despesasNaoOperacionais',        indent: true },
  { label: 'Outras Rendas Não Operacionais',             field: 'outrasRendasNaoOperacionais',    indent: true },
  { label: 'Lucro (Prejuízo) Antes dos Impostos',        field: 'lucroPrejAntesImpostos',         isSubtotal: true },
  { label: '(-) Provisões IRPJ e C.S.',                  field: 'provisoesIrpjCs',                indent: true },
  { label: '(-) Participações',                          field: 'participacoes',                  indent: true },
  { label: 'LUCRO LÍQUIDO DO EXERCÍCIO',                 field: 'lucroLiquidoExercicio',          isTotal: true },
];

const DEPT_FIELDS: (keyof DreVwDept)[] = [
  'quant','receitaOperacionalLiquida','custoOperacionalReceita',
  'lucroPrejOperacionalBruto','outrasReceitasOperacionais','outrasDespesasOperacionais',
  'margemContribuicao','despPessoal','despServTerceiros','despOcupacao','despFuncionamento',
  'despVendas','lucroPrejOperacionalLiquido','amortizacoesDepreciacoes',
  'outrasReceitasFinanceiras','despFinanceirasNaoOperacional','despesasNaoOperacionais',
  'outrasRendasNaoOperacionais','lucroPrejAntesImpostos','provisoesIrpjCs',
  'participacoes','lucroLiquidoExercicio',
];

// ─── Departamentos VW ─────────────────────────────────────────────────────────

type VwDeptKey = 'novos' | 'usados' | 'direta' | 'pecas' | 'oficina' | 'funilaria' | 'adm';

const VW_DEPTS: VwDeptKey[] = ['novos', 'direta', 'usados', 'pecas', 'oficina', 'funilaria', 'adm'];

const VW_DEPT_TO_DEPARTMENT: Partial<Record<VwDeptKey, Department>> = {
  novos:     'novos',
  direta:    'vendaDireta',
  usados:    'usados',
  pecas:     'pecas',
  oficina:   'oficina',
  funilaria: 'funilaria',
  adm:       'administracao',
};

// ─── Departamentos Audi ───────────────────────────────────────────────────────

type AudiDeptKey = 'novos' | 'usados' | 'pecas' | 'oficina' | 'funilaria' | 'adm';

const AUDI_DEPTS: AudiDeptKey[] = ['novos', 'usados', 'pecas', 'oficina', 'funilaria', 'adm'];

const AUDI_DEPT_TO_DEPARTMENT: Record<AudiDeptKey, Department> = {
  novos:     'novos',
  usados:    'usados',
  pecas:     'pecas',
  oficina:   'oficina',
  funilaria: 'funilaria',
  adm:       'administracao',
};

// ─── DESCRICAO → campo ────────────────────────────────────────────────────────

const DESCRICAO_TO_FIELD: Record<string, keyof DreVwDept> = {
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

// ─── Build dept from DRE data ─────────────────────────────────────────────────

function buildVwDeptFromDREData(dreData: any[] | null, monthIndex: number): DreVwDept {
  const dept = createEmptyDreVwRow(0, 0).novos;
  if (!dreData) return dept;
  for (const line of dreData) {
    const descKey = ((line.descricao as string) || (line.label as string) || '').toUpperCase().trim();
    const field = DESCRICAO_TO_FIELD[descKey];
    if (field) {
      const meses: number[] = line.meses || line.values || [];
      const val = meses[monthIndex];
      if (val !== undefined && val !== null && val !== 0) {
        dept[field] = val.toString();
      }
    }
  }
  return dept;
}

function buildAudiDeptFromDREData(dreData: any[] | null, monthIndex: number): DreAudiDept {
  const dept = createEmptyDreAudiRow(0, 0).novos;
  if (!dreData) return dept;
  for (const line of dreData) {
    const descKey = ((line.descricao as string) || (line.label as string) || '').toUpperCase().trim();
    const field = DESCRICAO_TO_FIELD[descKey] as keyof DreAudiDept | undefined;
    if (field) {
      const meses: number[] = line.meses || line.values || [];
      const val = meses[monthIndex];
      if (val !== undefined && val !== null && val !== 0) {
        (dept as any)[field] = val.toString();
      }
    }
  }
  return dept;
}

// ─── Soma todos os departamentos de um DreVwRow ───────────────────────────────

function sumVwDepts(row: DreVwRow, field: keyof DreVwDept): number {
  return VW_DEPTS.reduce((s, dk) => s + parseVal(row[dk][field]), 0);
}

function sumAudiDepts(row: DreAudiRow, field: keyof DreAudiDept): number {
  return AUDI_DEPTS.reduce((s, dk) => s + parseVal(row[dk][field as keyof DreAudiDept]), 0);
}

// ─── Tabela de Evolução Mensal ────────────────────────────────────────────────

interface EvolucaoMensalTableProps {
  title: string;
  subtitle: string;
  color: string;
  colorDrk: string;
  monthRows: { totals: Record<keyof DreVwDept, number> }[];
}

function EvolucaoMensalTable({ title, subtitle, color, colorDrk, monthRows }: EvolucaoMensalTableProps) {
  const NCOLS = 14; // descrição + 12 meses + total

  const annualTotal = Object.fromEntries(
    DEPT_FIELDS.map(f => [f, monthRows.reduce((s, mr) => s + (mr.totals[f] ?? 0), 0)])
  ) as Record<keyof DreVwDept, number>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="text-white px-6 py-3" style={{ backgroundColor: color }}>
        <h2 className="font-bold text-base">{title}</h2>
        <p className="text-xs mt-0.5 opacity-80">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-200" style={{ borderBottom: `2px solid ${color}` }}>
              <th className="text-left px-4 py-3 font-bold text-slate-800 text-sm w-52 min-w-[13rem]">Descrição</th>
              {MONTHS_SHORT.map((m, i) => (
                <th key={i} className="text-center px-2 py-3 font-bold text-sm text-slate-800 min-w-[5.5rem]">{m}</th>
              ))}
              <th className="text-center px-3 py-3 font-bold text-sm text-slate-800 min-w-[7rem] bg-slate-300">Total Acum.</th>
            </tr>
          </thead>
          <tbody>
            {DRE_LINES.map((line, idx) => {
              if (line.separator) {
                return <tr key={idx}><td colSpan={NCOLS} className="h-px bg-slate-100" /></tr>;
              }

              const isQuant = line.field === 'quant' && idx === 0;
              const rowStyle = line.isTotal ? { backgroundColor: color } : undefined;
              const rowClass = line.isTotal
                ? 'text-white font-bold'
                : line.isSubtotal
                ? 'bg-slate-100 font-semibold text-black'
                : 'hover:bg-slate-50 text-black';

              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`} style={rowStyle}>
                  <td className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''}`}>{line.label}</td>

                  {monthRows.map((mr, mi) => {
                    const val = mr.totals[line.field] ?? 0;
                    const display = isQuant
                      ? (Math.round(val) > 0 ? Math.round(val).toString() : '—')
                      : (val !== 0 ? val.toLocaleString('pt-BR') : '—');
                    return (
                      <td key={mi} className="px-2 py-1.5 text-right">{display}</td>
                    );
                  })}

                  <td
                    className={`px-3 py-1.5 text-right font-semibold ${line.isTotal ? 'text-white' : 'bg-slate-50 text-black'}`}
                    style={line.isTotal ? { backgroundColor: colorDrk } : undefined}
                  >
                    {(() => {
                      const v = annualTotal[line.field] ?? 0;
                      return isQuant
                        ? (Math.round(v) > 0 ? Math.round(v).toString() : '—')
                        : (v !== 0 ? v.toLocaleString('pt-BR') : '—');
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Componente Principal ────────────────────────────────────────────────────

interface MensalDreTabProps {
  year: number;
}

export function MensalDreTab({ year }: MensalDreTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'vw' | 'audi'>('vw');
  const [loadingVw, setLoadingVw]       = useState(true);
  const [loadingAudi, setLoadingAudi]   = useState(true);

  // Cada item = totais (soma de todos os depts) por mês
  const [vwMonthData, setVwMonthData]     = useState<{ totals: Record<keyof DreVwDept, number> }[]>(
    Array.from({ length: 12 }, () => ({ totals: Object.fromEntries(DEPT_FIELDS.map(f => [f, 0])) as Record<keyof DreVwDept, number> }))
  );
  const [audiMonthData, setAudiMonthData] = useState<{ totals: Record<keyof DreVwDept, number> }[]>(
    Array.from({ length: 12 }, () => ({ totals: Object.fromEntries(DEPT_FIELDS.map(f => [f, 0])) as Record<keyof DreVwDept, number> }))
  );

  // ── Carrega VW ────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingVw(true);
    const yr = year as 2024 | 2025 | 2026 | 2027;

    Promise.all([
      Promise.all(Array.from({ length: 12 }, (_, i) => loadDreVw(year, i + 1))),
      Promise.all(
        (Object.entries(VW_DEPT_TO_DEPARTMENT) as [VwDeptKey, Department][])
          .map(([dk, dept]) =>
            loadDREDataAsync(yr, dept, 'vw').then(dre => ({ deptKey: dk, dre }))
          )
      ),
    ]).then(([kvResults, dreResults]) => {
      const dreLk: Partial<Record<VwDeptKey, any[] | null>> = {};
      for (const { deptKey, dre } of dreResults) dreLk[deptKey] = dre;

      function hasDeptData(dept: DreVwDept) { return Object.values(dept).some(v => v !== ''); }

      const monthData = Array.from({ length: 12 }, (_, mi) => {
        const m = mi + 1;
        const kv = kvResults[mi] ?? null;

        // Constrói cada departamento
        const deptValues: Partial<Record<VwDeptKey, DreVwDept>> = {};
        for (const dk of VW_DEPTS) {
          if (kv && hasDeptData(kv[dk])) {
            deptValues[dk] = kv[dk];
          } else if (dreLk[dk]) {
            deptValues[dk] = buildVwDeptFromDREData(dreLk[dk] ?? null, mi);
          } else {
            deptValues[dk] = createEmptyDreVwRow(year, m)[dk];
          }
        }

        // Soma todos os departamentos
        const totals = Object.fromEntries(
          DEPT_FIELDS.map(f => [
            f,
            VW_DEPTS.reduce((s, dk) => s + parseVal(deptValues[dk]?.[f]), 0),
          ])
        ) as Record<keyof DreVwDept, number>;

        return { totals };
      });

      setVwMonthData(monthData);
      setLoadingVw(false);
    });
  }, [year]);

  // ── Carrega Audi ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingAudi(true);
    const yr = year as 2024 | 2025 | 2026 | 2027;

    Promise.all([
      Promise.all(Array.from({ length: 12 }, (_, i) => loadDreAudi(year, i + 1))),
      Promise.all(
        (Object.entries(AUDI_DEPT_TO_DEPARTMENT) as [AudiDeptKey, Department][])
          .map(([dk, dept]) =>
            loadDREDataAsync(yr, dept, 'audi').then(dre => ({ deptKey: dk, dre }))
          )
      ),
    ]).then(([kvResults, dreResults]) => {
      const dreLk: Partial<Record<AudiDeptKey, any[] | null>> = {};
      for (const { deptKey, dre } of dreResults) dreLk[deptKey] = dre;

      function hasDeptData(dept: DreAudiDept) { return Object.values(dept).some(v => v !== ''); }

      const monthData = Array.from({ length: 12 }, (_, mi) => {
        const m = mi + 1;
        const kv = kvResults[mi] ?? null;

        const deptValues: Partial<Record<AudiDeptKey, DreAudiDept>> = {};
        for (const dk of AUDI_DEPTS) {
          if (kv && hasDeptData(kv[dk])) {
            deptValues[dk] = kv[dk];
          } else if (dreLk[dk]) {
            deptValues[dk] = buildAudiDeptFromDREData(dreLk[dk] ?? null, mi);
          } else {
            deptValues[dk] = createEmptyDreAudiRow(year, m)[dk];
          }
        }

        const totals = Object.fromEntries(
          DEPT_FIELDS.map(f => [
            f,
            AUDI_DEPTS.reduce((s, dk) => s + parseVal((deptValues[dk] as any)?.[f]), 0),
          ])
        ) as Record<keyof DreVwDept, number>;

        return { totals };
      });

      setAudiMonthData(monthData);
      setLoadingAudi(false);
    });
  }, [year]);

  const loading = activeSubTab === 'vw' ? loadingVw : loadingAudi;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sub-navegação */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-1">
        <button
          onClick={() => setActiveSubTab('vw')}
          className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors"
          style={
            activeSubTab === 'vw'
              ? { borderBottomColor: VW_COLOR, color: VW_COLOR }
              : { borderBottomColor: 'transparent', color: '#64748b' }
          }
        >
          VW Mensal
        </button>
        <button
          onClick={() => setActiveSubTab('audi')}
          className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors"
          style={
            activeSubTab === 'audi'
              ? { borderBottomColor: AUDI_COLOR, color: AUDI_COLOR }
              : { borderBottomColor: 'transparent', color: '#64748b' }
          }
        >
          Audi Mensal
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto p-6 min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Carregando dados mensais...</span>
            </div>
          </div>
        ) : activeSubTab === 'vw' ? (
          <EvolucaoMensalTable
            title="VW NORTE"
            subtitle={`Ano ${year} — Evolução Mensal (todos os departamentos)`}
            color={VW_COLOR}
            colorDrk={VW_COLOR_DRK}
            monthRows={vwMonthData}
          />
        ) : (
          <EvolucaoMensalTable
            title="AUDI LAPA/PINHEIROS"
            subtitle={`Ano ${year} — Evolução Mensal (todos os departamentos)`}
            color={AUDI_COLOR}
            colorDrk={AUDI_COLOR_DRK}
            monthRows={audiMonthData}
          />
        )}
      </div>
    </div>
  );
}
