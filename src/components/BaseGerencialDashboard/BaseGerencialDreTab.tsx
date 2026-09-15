import { useEffect, useState } from 'react';
import {
  dadosOpKey,
  loadAllDadosOperacionais,
  loadRegrasDre,
  getBaseGerencialDreCache,
  setBaseGerencialDreCache,
  saveAllDadosOperacionais,
  type DeptoClassificacao,
  type BaseGerencialDreLine,
  type BaseGerencialDreRules,
  type TipoContaClassificacao,
  type Marca,
} from './baseGerencialStorage';
import {
  processConsolidadoData,
  processDepartamentoData,
  type DepartamentoData,
} from './baseGerencialDataProcessor';

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const DRE_ROWS = [
  { id: 'volumeVendas', label: 'VOLUME DE VENDAS', kind: 'normal' },
  { id: 'receitaOperacionalLiquida', label: 'RECEITA OPERACIONAL LÍQUIDA', kind: 'bold' },
  { id: 'custoOperacionalReceita', label: 'CUSTO OPERACIONAL DA RECEITA', kind: 'negative' },
  { id: 'lucroOperacionalBruto', label: 'LUCRO (PREJUÍZO) OPERACIONAL BRUTO', kind: 'subtotal' },
  { id: 'outrasReceitasOperacionais', label: 'OUTRAS RECEITAS OPERACIONAIS', kind: 'normal' },
  { id: 'outrasDespesasOperacionais', label: 'OUTRAS DESPESAS OPERACIONAIS', kind: 'negative' },
  { id: 'margemContribuicao', label: 'MARGEM DE CONTRIBUIÇÃO', kind: 'subtotal' },
  { id: 'despesasPessoal', label: 'DESPESAS C/ PESSOAL', kind: 'negative' },
  { id: 'despesasServTerceiros', label: 'DESPESAS C/ SERV. DE TERCEIROS', kind: 'negative' },
  { id: 'despesasOcupacao', label: 'DESPESAS C/ OCUPAÇÃO', kind: 'negative' },
  { id: 'despesasFuncionamento', label: 'DESPESAS C/ FUNCIONAMENTO', kind: 'negative' },
  { id: 'despesasVendas', label: 'DESPESAS C/ VENDAS', kind: 'negative' },
  { id: 'lucroOperacionalLiquido', label: 'LUCRO (PREJUÍZO) OPERACIONAL LÍQUIDO', kind: 'subtotal' },
  { id: 'amortizacoesDepreciacoes', label: 'AMORTIZAÇÕES E DEPRECIAÇÕES', kind: 'negative' },
  { id: 'outrasReceitasFinanceiras', label: 'OUTRAS RECEITAS FINANCEIRAS', kind: 'normal' },
  { id: 'despesasFinanceirasNaoOperacional', label: 'DESPESAS FINANCEIRAS NÃO OPERACIONAL', kind: 'negative' },
  { id: 'despesasNaoOperacionais', label: 'DESPESAS NÃO OPERACIONAIS', kind: 'negative' },
  { id: 'outrasRendasNaoOperacionais', label: 'OUTRAS RENDAS NÃO OPERACIONAIS', kind: 'normal' },
  { id: 'lucroAntesImpostos', label: 'LUCRO (PREJUÍZO) ANTES IMPOSTOS', kind: 'subtotal' },
  { id: 'provisoesIrpjCs', label: 'PROVISÕES IRPJ E C.S.', kind: 'negative' },
  { id: 'participacoes', label: 'PARTICIPAÇÕES', kind: 'negative' },
  { id: 'lucroLiquidoExercicio', label: 'LUCRO LÍQUIDO DO EXERCÍCIO', kind: 'total' },
] as const;

type DreLineId = typeof DRE_ROWS[number]['id'];
type MonthlyValues = Record<DreLineId, number[]>;

const BASE_LINE_IDS: DreLineId[] = [
  'volumeVendas', 'receitaOperacionalLiquida', 'custoOperacionalReceita',
  'outrasReceitasOperacionais', 'outrasDespesasOperacionais', 'despesasPessoal',
  'despesasServTerceiros', 'despesasOcupacao', 'despesasFuncionamento', 'despesasVendas',
  'amortizacoesDepreciacoes', 'outrasReceitasFinanceiras', 'despesasFinanceirasNaoOperacional',
  'despesasNaoOperacionais', 'outrasRendasNaoOperacionais', 'provisoesIrpjCs', 'participacoes',
];

const DRE_RULE_LINE_BY_ID: Partial<Record<DreLineId, BaseGerencialDreLine>> = {
  receitaOperacionalLiquida: 'receita_operacional_liquida',
  custoOperacionalReceita: 'custo_operacional_receita',
  outrasReceitasOperacionais: 'outras_receitas_operacionais',
  outrasDespesasOperacionais: 'outras_despesas_operacionais',
  despesasPessoal: 'despesas_pessoal',
  despesasServTerceiros: 'despesas_servicos_terceiros',
  despesasOcupacao: 'despesas_ocupacao',
  despesasFuncionamento: 'despesas_funcionamento',
  despesasVendas: 'despesas_vendas',
  amortizacoesDepreciacoes: 'amortizacoes_depreciacoes',
  outrasReceitasFinanceiras: 'outras_receitas_financeiras',
  despesasFinanceirasNaoOperacional: 'despesas_financeiras_nao_operacional',
  despesasNaoOperacionais: 'despesas_nao_operacionais',
  outrasRendasNaoOperacionais: 'outras_rendas_nao_operacionais',
  provisoesIrpjCs: 'provisoes_irpj_cs',
  participacoes: 'participacoes',
};

function createEmptyMonthlyValues(): MonthlyValues {
  return Object.fromEntries(DRE_ROWS.map(row => [row.id, Array(12).fill(0)])) as MonthlyValues;
}

function calculateDreValues(baseValues: MonthlyValues): MonthlyValues {
  const values = createEmptyMonthlyValues();
  for (const id of BASE_LINE_IDS) values[id] = [...baseValues[id]];

  for (let month = 0; month < 12; month += 1) {
    values.lucroOperacionalBruto[month] =
      values.receitaOperacionalLiquida[month] + values.custoOperacionalReceita[month];
    values.margemContribuicao[month] =
      values.lucroOperacionalBruto[month] +
      values.outrasReceitasOperacionais[month] +
      values.outrasDespesasOperacionais[month];
    values.lucroOperacionalLiquido[month] =
      values.margemContribuicao[month] +
      values.despesasPessoal[month] +
      values.despesasServTerceiros[month] +
      values.despesasOcupacao[month] +
      values.despesasFuncionamento[month] +
      values.despesasVendas[month];
    values.lucroAntesImpostos[month] =
      values.lucroOperacionalLiquido[month] +
      values.amortizacoesDepreciacoes[month] +
      values.outrasReceitasFinanceiras[month] +
      values.despesasFinanceirasNaoOperacional[month] +
      values.despesasNaoOperacionais[month] +
      values.outrasRendasNaoOperacionais[month];
    values.lucroLiquidoExercicio[month] =
      values.lucroAntesImpostos[month] +
      values.provisoesIrpjCs[month] +
      values.participacoes[month];
  }

  return values;
}

function sumRuleGroups(
  data: DepartamentoData,
  rules: BaseGerencialDreRules,
  lineId: DreLineId,
): number {
  const ruleLine = DRE_RULE_LINE_BY_ID[lineId];
  if (!ruleLine) return 0;
  return (rules[ruleLine] ?? []).reduce(
    (sum, group: TipoContaClassificacao) => sum + (data.grupos[group]?.subtotal ?? 0),
    0,
  );
}

const DEPARTMENTS = [
  'Veículos Novos',
  'Venda Direta',
  'Veículos Usados',
  'Peças',
  'Oficina',
  'Funilaria',
  'Administração',
  'Diretoria',
  'Consolidado (Total)',
] as const;

const DEPARTMENT_TO_STORAGE: Record<(typeof DEPARTMENTS)[number], DeptoClassificacao | null> = {
  'Veículos Novos': 'veiculos_novos',
  'Venda Direta': 'venda_direta',
  'Veículos Usados': 'veiculos_usados',
  'Peças': 'pecas',
  'Oficina': 'oficina',
  'Funilaria': 'funilaria',
  'Administração': 'administracao',
  'Diretoria': 'diretoria',
  'Consolidado (Total)': null,
};

const CONSOLIDATED_DEPARTMENTS: DeptoClassificacao[] = [
  'veiculos_novos', 'venda_direta', 'veiculos_usados', 'pecas',
  'oficina', 'funilaria', 'administracao', 'diretoria',
];

interface Props {
  marca: Marca;
  year: number;
  years: number[];
  onYearChange: (year: number) => void;
}

function formatValue(label: string, value: number): string {
  if (label === 'VOLUME DE VENDAS') return String(value);
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function BaseGerencialDreTab({
  marca,
  year,
  years,
  onYearChange,
}: Props) {
  const [activeDepartment, setActiveDepartment] = useState<(typeof DEPARTMENTS)[number]>('Veículos Novos');
  const [allDadosOperacionais, setAllDadosOperacionais] = useState<Record<string, { volumeVendas?: number }>>({});
  const [dreRules, setDreRules] = useState<BaseGerencialDreRules>({});
  const [departmentValues, setDepartmentValues] = useState<MonthlyValues>(createEmptyMonthlyValues);
  const [loadingDre, setLoadingDre] = useState(true);
  const [dreError, setDreError] = useState<string | null>(null);
  const [dependenciesReady, setDependenciesReady] = useState(false);
  const isAudiVendaDireta = marca === 'audi' && activeDepartment === 'Venda Direta';
  const storageDepartment = DEPARTMENT_TO_STORAGE[activeDepartment];

  useEffect(() => {
    let active = true;
    setDreError(null);
    setDependenciesReady(false);
    setLoadingDre(true);
    Promise.all([loadAllDadosOperacionais(), loadRegrasDre()])
      .then(([operationalData, rules]) => {
        if (active) {
          setAllDadosOperacionais(operationalData);
          setDreRules(rules);
          setDependenciesReady(true);
        }
      });
      return () => { active = false; };
  }, [marca, year]);

  useEffect(() => {
    let active = true;
    if (!dependenciesReady) return () => { active = false; };
    setLoadingDre(true);
    setDreError(null);
    const loadDepartmentValues = async () => {
      if (isAudiVendaDireta) {
        if (active) setDepartmentValues(createEmptyMonthlyValues());
        setLoadingDre(false);
        return;
      }
      const cacheDepartment = storageDepartment ?? 'consolidado';
      const cached = await getBaseGerencialDreCache(marca, year, cacheDepartment);
      if (cached?.version === 1 && active) {
        setDepartmentValues(cached.values as MonthlyValues);
        setLoadingDre(false);
        return;
      }
      const monthlyData = await Promise.all(
        MONTHS.map((_, index) => storageDepartment === null
          ? processConsolidadoData(marca, year, index + 1)
          : processDepartamentoData(marca, storageDepartment, year, index + 1))
      );
      const nextValues = createEmptyMonthlyValues();
      nextValues.volumeVendas = MONTHS.map((_, month) => {
        const departments = storageDepartment ? [storageDepartment] : CONSOLIDATED_DEPARTMENTS;
        return departments.reduce((sum, department) => sum + getVolume(department, month), 0);
      });
      for (const line of BASE_LINE_IDS) {
        if (line === 'volumeVendas') continue;
        nextValues[line] = monthlyData.map(data => sumRuleGroups(data, dreRules, line));
      }
      if (active) {
        setDepartmentValues(nextValues);
        await setBaseGerencialDreCache(marca, year, cacheDepartment, nextValues);
        setLoadingDre(false);
      }
    };
    loadDepartmentValues().catch(error => {
      console.error('Erro ao carregar dados da DRE:', error);
      if (active) {
        setDreError(error instanceof Error ? error.message : 'Não foi possível carregar os dados da DRE.');
        setLoadingDre(false);
      }
    });
    return () => { active = false; };
  }, [marca, year, storageDepartment, isAudiVendaDireta, dreRules, allDadosOperacionais, dependenciesReady]);

  function getVolume(department: DeptoClassificacao, month: number): number {
    return Number(allDadosOperacionais[dadosOpKey(year, month + 1, marca, department)]?.volumeVendas ?? 0);
  }

  const values = calculateDreValues(departmentValues);

  async function handleVolumeChange(month: number, rawValue: string) {
    if (!storageDepartment) return;
    const value = rawValue === '' ? 0 : Math.max(0, Math.trunc(Number(rawValue)) || 0);
    const key = dadosOpKey(year, month + 1, marca, storageDepartment);
    const next = {
      ...allDadosOperacionais,
      [key]: { ...allDadosOperacionais[key], volumeVendas: value },
    };
    setAllDadosOperacionais(next);
    await saveAllDadosOperacionais(next);
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <div className="bg-white rounded-xl border border-slate-200 px-4 shadow-sm">
        <div className="flex items-center gap-3 py-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ANO</span>
          <select
            value={year}
            onChange={event => onYearChange(Number(event.target.value))}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded bg-white text-slate-700 font-semibold"
          >
            {years.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-0 border-b border-slate-200 overflow-x-auto">
        {DEPARTMENTS.map(department => (
          <button
            key={department}
            onClick={() => setActiveDepartment(department)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeDepartment === department
                ? 'text-slate-700 border-emerald-600'
                : 'text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-300'
            }`}
          >
            {department}
          </button>
        ))}
      </div>

      {isAudiVendaDireta ? (
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-center space-y-2">
            <p className="text-slate-500 font-medium">Dados incluídos em Veículos Novos</p>
            <p className="text-slate-400 text-sm">
              Na Audi, os dados de Venda Direta são somados e exibidos junto ao departamento Veículos Novos.
            </p>
          </div>
        </div>
      ) : loadingDre ? (
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      ) : dreError ? (
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-red-200 shadow-sm">
          <div className="text-center space-y-2 px-6">
            <p className="text-red-600 font-semibold">Erro ao carregar os dados da DRE</p>
            <p className="text-slate-500 text-sm">{dreError}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="mb-3">
            <h2 className="text-base font-bold text-slate-800">Demonstrativo de Resultados (DRE)</h2>
            <p className="text-xs text-slate-500">{activeDepartment} - Ano Fiscal {year}</p>
          </div>
          <table className="w-full min-w-[1120px] border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="w-64 border-r border-slate-600 px-2 py-2 text-left font-bold">DESCRIÇÃO</th>
                <th className="w-32 min-w-32 border-r border-slate-600 px-3 py-2 text-right font-bold">TOTAL</th>
                <th className="w-14 border-r border-slate-600 px-2 py-2 text-right font-bold">%</th>
                {MONTHS.map(month => (
                  <th key={month} className="min-w-16 border-r border-slate-600 px-2 py-2 text-right font-bold">{month}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DRE_ROWS.map((row, index) => {
                const isTotal = row.kind === 'total';
                const isSubtotal = row.kind === 'subtotal';
                const isNegative = row.kind === 'negative';
                const monthlyValues = values[row.id];
                const total = monthlyValues.reduce((sum, value) => sum + value, 0);
                return (
                  <tr
                    key={row.label}
                    className={`${isTotal ? 'bg-purple-100 text-purple-900 font-bold' : isSubtotal ? 'bg-slate-100 font-semibold' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b border-slate-200`}
                  >
                    <td className="px-2 py-1.5 font-medium">{row.label}</td>
                    <td className={`w-32 min-w-32 px-3 py-1.5 text-right tabular-nums ${isNegative ? 'text-red-600' : ''}`}>{formatValue(row.label, total)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">-</td>
                    {MONTHS.map(month => (
                      <td key={`${row.label}-${month}`} className={`border-l border-slate-200 px-2 py-1.5 text-right tabular-nums ${isNegative ? 'text-red-600' : ''}`}>
                        {row.id === 'volumeVendas' && storageDepartment ? (
                          <input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            value={getVolume(storageDepartment, MONTHS.indexOf(month)) || ''}
                            onChange={event => handleVolumeChange(MONTHS.indexOf(month), event.target.value)}
                            className="w-full min-w-14 bg-transparent text-right tabular-nums outline-none focus:bg-emerald-50 focus:ring-1 focus:ring-emerald-400 rounded px-1"
                          />
                        ) : (
                          formatValue(row.label, monthlyValues[MONTHS.indexOf(month)])
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
