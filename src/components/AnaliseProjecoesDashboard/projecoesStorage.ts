import { kvGet, kvSet } from '@/lib/kvClient';

// ─── KV Keys ──────────────────────────────────────────────────────────────────
const keyVw   = (year: number, month: number) => `projecoes:vw:${year}-${String(month).padStart(2, '0')}`;
const keyAudi = (year: number, month: number) => `projecoes:audi:${year}-${String(month).padStart(2, '0')}`;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DeptBudget {
  quant: string;
  receitaOperacionalLiquida: string;
  custoOperacionalReceita: string;
  lucroPrejOperacionalBruto: string;
  outrasReceitasOperacionais: string;
  outrasDespesasOperacionais: string;
  margemContribuicao: string;
  despPessoal: string;
  despServTerceiros: string;
  despOcupacao: string;
  despFuncionamento: string;
  despVendas: string;
  lucroPrejOperacionalLiquido: string;
  amortizacoesDepreciacoes: string;
  outrasReceitasFinanceiras: string;
  despFinanceirasNaoOperacional: string;
  despesasNaoOperacionais: string;
  outrasRendasNaoOperacionais: string;
  lucroPrejAntesImpostos: string;
  provisoesIrpjCs: string;
  participacoes: string;
  lucroLiquidoExercicio: string;
}

export interface BudgetVwRow {
  periodo: string; // "YYYY-MM"
  novos: DeptBudget;
  usados: DeptBudget;
  direta: DeptBudget;
  pecas: DeptBudget;
  oficina: DeptBudget;
  funilaria: DeptBudget;
  adm: DeptBudget;
}

export interface BudgetAudiRow {
  periodo: string; // "YYYY-MM"
  novos: DeptBudget;
  usados: DeptBudget;
  pecas: DeptBudget;
  oficina: DeptBudget;
  funilaria: DeptBudget;
  adm: DeptBudget;
}

// ─── Constantes de departamento ───────────────────────────────────────────────

export const VW_DEPTS   = ['novos', 'usados', 'direta', 'pecas', 'oficina', 'funilaria', 'adm'] as const;
export const AUDI_DEPTS = ['novos', 'usados', 'pecas', 'oficina', 'funilaria', 'adm'] as const;

export type VwDept   = typeof VW_DEPTS[number];
export type AudiDept = typeof AUDI_DEPTS[number];

export const VW_DEPT_LABELS: Record<VwDept, string> = {
  novos: 'Novos', usados: 'Usados', direta: 'Direta',
  pecas: 'Peças', oficina: 'Oficina', funilaria: 'Funilaria', adm: 'ADM',
};

export const AUDI_DEPT_LABELS: Record<AudiDept, string> = {
  novos: 'Novos', usados: 'Usados', pecas: 'Peças',
  oficina: 'Oficina', funilaria: 'Funilaria', adm: 'ADM',
};

// ─── Campos e rótulos ─────────────────────────────────────────────────────────

export const DEPT_FIELDS: (keyof DeptBudget)[] = [
  'quant', 'receitaOperacionalLiquida', 'custoOperacionalReceita',
  'lucroPrejOperacionalBruto', 'outrasReceitasOperacionais', 'outrasDespesasOperacionais',
  'margemContribuicao', 'despPessoal', 'despServTerceiros', 'despOcupacao',
  'despFuncionamento', 'despVendas', 'lucroPrejOperacionalLiquido',
  'amortizacoesDepreciacoes', 'outrasReceitasFinanceiras', 'despFinanceirasNaoOperacional',
  'despesasNaoOperacionais', 'outrasRendasNaoOperacionais', 'lucroPrejAntesImpostos',
  'provisoesIrpjCs', 'participacoes', 'lucroLiquidoExercicio',
];

export const FIELD_LABELS: Record<keyof DeptBudget, string> = {
  quant:                         'Volume de Vendas',
  receitaOperacionalLiquida:     'Receita Operacional Líquida',
  custoOperacionalReceita:       '(-) Custo Operacional da Receita',
  lucroPrejOperacionalBruto:     'Lucro (Prejuízo) Operacional Bruto',
  outrasReceitasOperacionais:    'Outras Receitas Operacionais',
  outrasDespesasOperacionais:    '(-) Outras Despesas Operacionais',
  margemContribuicao:            'Margem de Contribuição',
  despPessoal:                   '(-) Despesas c/ Pessoal',
  despServTerceiros:             '(-) Despesas c/ Serv. de Terceiros',
  despOcupacao:                  '(-) Despesas c/ Ocupação',
  despFuncionamento:             '(-) Despesas c/ Funcionamento',
  despVendas:                    '(-) Despesas c/ Vendas',
  lucroPrejOperacionalLiquido:   'Lucro (Prejuízo) Operacional Líquido',
  amortizacoesDepreciacoes:      'Amortizações e Depreciações',
  outrasReceitasFinanceiras:     'Outras Receitas Financeiras',
  despFinanceirasNaoOperacional: '(-) Despesas Financeiras Não Operacional',
  despesasNaoOperacionais:       '(-) Despesas Não Operacionais',
  outrasRendasNaoOperacionais:   'Outras Rendas Não Operacionais',
  lucroPrejAntesImpostos:        'Lucro (Prejuízo) Antes dos Impostos',
  provisoesIrpjCs:               '(-) Provisões IRPJ e C.S.',
  participacoes:                 '(-) Participações',
  lucroLiquidoExercicio:         'Lucro Líquido do Exercício',
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

function emptyDept(): DeptBudget {
  return {
    quant: '', receitaOperacionalLiquida: '', custoOperacionalReceita: '',
    lucroPrejOperacionalBruto: '', outrasReceitasOperacionais: '', outrasDespesasOperacionais: '',
    margemContribuicao: '', despPessoal: '', despServTerceiros: '', despOcupacao: '',
    despFuncionamento: '', despVendas: '', lucroPrejOperacionalLiquido: '',
    amortizacoesDepreciacoes: '', outrasReceitasFinanceiras: '', despFinanceirasNaoOperacional: '',
    despesasNaoOperacionais: '', outrasRendasNaoOperacionais: '', lucroPrejAntesImpostos: '',
    provisoesIrpjCs: '', participacoes: '', lucroLiquidoExercicio: '',
  };
}

export function createEmptyBudgetVw(year: number, month: number): BudgetVwRow {
  const p = `${year}-${String(month).padStart(2, '0')}`;
  return {
    periodo: p,
    novos: emptyDept(), usados: emptyDept(), direta: emptyDept(),
    pecas: emptyDept(), oficina: emptyDept(), funilaria: emptyDept(), adm: emptyDept(),
  };
}

export function createEmptyBudgetAudi(year: number, month: number): BudgetAudiRow {
  const p = `${year}-${String(month).padStart(2, '0')}`;
  return {
    periodo: p,
    novos: emptyDept(), usados: emptyDept(),
    pecas: emptyDept(), oficina: emptyDept(), funilaria: emptyDept(), adm: emptyDept(),
  };
}

// ─── Load / Save ──────────────────────────────────────────────────────────────

export async function loadBudgetVw(year: number, month: number): Promise<BudgetVwRow | null> {
  try { return (await kvGet<BudgetVwRow>(keyVw(year, month))) ?? null; } catch { return null; }
}

export async function saveBudgetVw(row: BudgetVwRow): Promise<void> {
  const [yr, mo] = row.periodo.split('-').map(Number);
  const success = await kvSet(keyVw(yr, mo), recalculateBudgetVwRow(row));
  if (!success) {
    throw new Error('Falha ao salvar budget VW');
  }
}

export async function loadBudgetAudi(year: number, month: number): Promise<BudgetAudiRow | null> {
  try { return (await kvGet<BudgetAudiRow>(keyAudi(year, month))) ?? null; } catch { return null; }
}

export async function saveBudgetAudi(row: BudgetAudiRow): Promise<void> {
  const [yr, mo] = row.periodo.split('-').map(Number);
  const success = await kvSet(keyAudi(yr, mo), recalculateBudgetAudiRow(row));
  if (!success) {
    throw new Error('Falha ao salvar budget Audi');
  }
}

export async function loadAllBudgetVw(year: number): Promise<(BudgetVwRow | null)[]> {
  return Promise.all(Array.from({ length: 12 }, (_, i) => loadBudgetVw(year, i + 1)));
}

export async function loadAllBudgetAudi(year: number): Promise<(BudgetAudiRow | null)[]> {
  return Promise.all(Array.from({ length: 12 }, (_, i) => loadBudgetAudi(year, i + 1)));
}

// ─── Helpers de cálculo ───────────────────────────────────────────────────────

export function parseVal(v: string | number | undefined): number {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!s) return 0;
  // Formato brasileiro: vírgula como decimal (ex: "29.762.782,56" ou "737.893,75")
  // → remove pontos de milhar, troca vírgula por ponto
  if (s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  // Formato inglês/neutro: ponto já é decimal (ex: "29762782.56") ou inteiro
  return parseFloat(s) || 0;
}

function formatCalculatedValue(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-9) return '';
  return Number(value.toFixed(6)).toString();
}

export function recalculateDeptBudget(dept: DeptBudget): DeptBudget {
  const receitaOperacionalLiquida = parseVal(dept.receitaOperacionalLiquida);
  const custoOperacionalReceita = parseVal(dept.custoOperacionalReceita);
  const lucroPrejOperacionalBruto = receitaOperacionalLiquida + custoOperacionalReceita;

  const outrasReceitasOperacionais = parseVal(dept.outrasReceitasOperacionais);
  const outrasDespesasOperacionais = parseVal(dept.outrasDespesasOperacionais);
  const margemContribuicao =
    lucroPrejOperacionalBruto +
    outrasReceitasOperacionais +
    outrasDespesasOperacionais;

  const despPessoal = parseVal(dept.despPessoal);
  const despServTerceiros = parseVal(dept.despServTerceiros);
  const despOcupacao = parseVal(dept.despOcupacao);
  const despFuncionamento = parseVal(dept.despFuncionamento);
  const despVendas = parseVal(dept.despVendas);
  const lucroPrejOperacionalLiquido =
    margemContribuicao +
    despPessoal +
    despServTerceiros +
    despOcupacao +
    despFuncionamento +
    despVendas;

  const amortizacoesDepreciacoes = parseVal(dept.amortizacoesDepreciacoes);
  const outrasReceitasFinanceiras = parseVal(dept.outrasReceitasFinanceiras);
  const despFinanceirasNaoOperacional = parseVal(dept.despFinanceirasNaoOperacional);
  const despesasNaoOperacionais = parseVal(dept.despesasNaoOperacionais);
  const outrasRendasNaoOperacionais = parseVal(dept.outrasRendasNaoOperacionais);
  const lucroPrejAntesImpostos =
    lucroPrejOperacionalLiquido +
    amortizacoesDepreciacoes +
    outrasReceitasFinanceiras +
    despFinanceirasNaoOperacional +
    despesasNaoOperacionais +
    outrasRendasNaoOperacionais;

  const provisoesIrpjCs = parseVal(dept.provisoesIrpjCs);
  const participacoes = parseVal(dept.participacoes);
  const lucroLiquidoExercicio = lucroPrejAntesImpostos + provisoesIrpjCs + participacoes;

  return {
    ...dept,
    lucroPrejOperacionalBruto: formatCalculatedValue(lucroPrejOperacionalBruto),
    margemContribuicao: formatCalculatedValue(margemContribuicao),
    lucroPrejOperacionalLiquido: formatCalculatedValue(lucroPrejOperacionalLiquido),
    lucroPrejAntesImpostos: formatCalculatedValue(lucroPrejAntesImpostos),
    lucroLiquidoExercicio: formatCalculatedValue(lucroLiquidoExercicio),
  };
}

export function recalculateBudgetVwRow(row: BudgetVwRow): BudgetVwRow {
  return {
    ...row,
    novos: recalculateDeptBudget(row.novos),
    usados: recalculateDeptBudget(row.usados),
    direta: recalculateDeptBudget(row.direta),
    pecas: recalculateDeptBudget(row.pecas),
    oficina: recalculateDeptBudget(row.oficina),
    funilaria: recalculateDeptBudget(row.funilaria),
    adm: recalculateDeptBudget(row.adm),
  };
}

export function recalculateBudgetAudiRow(row: BudgetAudiRow): BudgetAudiRow {
  return {
    ...row,
    novos: recalculateDeptBudget(row.novos),
    usados: recalculateDeptBudget(row.usados),
    pecas: recalculateDeptBudget(row.pecas),
    oficina: recalculateDeptBudget(row.oficina),
    funilaria: recalculateDeptBudget(row.funilaria),
    adm: recalculateDeptBudget(row.adm),
  };
}

/** Soma todos os departamentos de uma linha VW para um campo */
export function sumVwField(row: BudgetVwRow | null, field: keyof DeptBudget): number {
  if (!row) return 0;
  return VW_DEPTS.reduce((acc, dept) => acc + parseVal(row[dept][field]), 0);
}

/** Soma todos os departamentos de uma linha Audi para um campo */
export function sumAudiField(row: BudgetAudiRow | null, field: keyof DeptBudget): number {
  if (!row) return 0;
  return AUDI_DEPTS.reduce((acc, dept) => acc + parseVal(row[dept][field]), 0);
}

/** Soma um campo específico de um departamento VW em vários meses (acumulado) */
export function accumulateVwField(
  rows: (BudgetVwRow | null)[],
  monthIndices: number[], // 0-based
  field: keyof DeptBudget,
  dept: VwDept | 'all',
): number {
  let sum = 0;
  for (const mi of monthIndices) {
    const row = rows[mi];
    if (!row) continue;
    if (dept === 'all') {
      sum += VW_DEPTS.reduce((acc, d) => acc + parseVal(row[d][field]), 0);
    } else {
      sum += parseVal(row[dept][field]);
    }
  }
  return sum;
}

/** Soma um campo específico de um departamento Audi em vários meses (acumulado) */
export function accumulateAudiField(
  rows: (BudgetAudiRow | null)[],
  monthIndices: number[], // 0-based
  field: keyof DeptBudget,
  dept: AudiDept | 'all',
): number {
  let sum = 0;
  for (const mi of monthIndices) {
    const row = rows[mi];
    if (!row) continue;
    if (dept === 'all') {
      sum += AUDI_DEPTS.reduce((acc, d) => acc + parseVal(row[d][field]), 0);
    } else {
      sum += parseVal(row[dept][field]);
    }
  }
  return sum;
}
