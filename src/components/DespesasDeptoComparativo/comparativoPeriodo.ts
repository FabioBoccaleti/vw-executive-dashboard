// Lógica pura do comparativo por período (mensal, bimestral, trimestral, semestral)
// usada pelas abas Comparativos de Despesas por Departamento (Audi e VW).

export type TipoClassificacao =
  | 'pessoal'
  | 'servicos_terceiros'
  | 'ocupacao'
  | 'funcionamento'
  | 'vendas'
  | 'amort_deprec'
  | 'financeiras'
  | 'outras_operacionais';

export const TIPO_LABELS: Record<TipoClassificacao, string> = {
  pessoal:             'Despesas c/ Pessoal',
  servicos_terceiros:  'Despesas c/ Serviços de Terceiros',
  ocupacao:            'Despesas c/ Ocupação',
  funcionamento:       'Despesas c/ Funcionamento',
  vendas:              'Despesas c/ Vendas',
  amort_deprec:        'Amortizações e Depreciações',
  financeiras:         'Despesas Financeiras',
  outras_operacionais: 'Outras Despesas Operacionais',
};

export const TIPOS_ORDENADOS: TipoClassificacao[] = [
  'pessoal', 'servicos_terceiros', 'ocupacao', 'funcionamento',
  'vendas', 'amort_deprec', 'financeiras', 'outras_operacionais',
];

/** Rótulo do grupo para contas sem classificação. */
export const SEM_CLASSIFICACAO = 'sem_classificacao';

export type GrupoKey = TipoClassificacao | typeof SEM_CLASSIFICACAO;

export const GRUPO_CONFIG: Record<GrupoKey, { color: string; light: string; badge: string; label: string }> = {
  pessoal:             { color: '#1e40af', light: '#eff6ff', badge: '#dbeafe', label: TIPO_LABELS.pessoal },
  servicos_terceiros:  { color: '#5b21b6', light: '#faf5ff', badge: '#ede9fe', label: TIPO_LABELS.servicos_terceiros },
  ocupacao:            { color: '#92400e', light: '#fffbeb', badge: '#fef3c7', label: TIPO_LABELS.ocupacao },
  funcionamento:       { color: '#0f766e', light: '#f0fdfa', badge: '#ccfbf1', label: TIPO_LABELS.funcionamento },
  vendas:              { color: '#c2410c', light: '#fff7ed', badge: '#ffedd5', label: TIPO_LABELS.vendas },
  amort_deprec:        { color: '#334155', light: '#f8fafc', badge: '#e2e8f0', label: TIPO_LABELS.amort_deprec },
  financeiras:         { color: '#991b1b', light: '#fef2f2', badge: '#fee2e2', label: TIPO_LABELS.financeiras },
  outras_operacionais: { color: '#374151', light: '#fafafa', badge: '#f3f4f6', label: TIPO_LABELS.outras_operacionais },
  sem_classificacao:   { color: '#64748b', light: '#f8fafc', badge: '#e2e8f0', label: 'Sem Classificação' },
};

export type DeptoTab =
  | 'veiculos_novos'
  | 'venda_direta'
  | 'veiculos_usados'
  | 'pecas'
  | 'oficina'
  | 'funilaria'
  | 'administracao'
  | 'diretoria';

export type DeptoKey = DeptoTab | 'consolidado';

export const DEPTOS_ORDENADOS: { id: DeptoKey; label: string }[] = [
  { id: 'veiculos_novos', label: 'Veículos Novos' },
  { id: 'venda_direta', label: 'Venda Direta' },
  { id: 'veiculos_usados', label: 'Veículos Usados' },
  { id: 'pecas', label: 'Peças' },
  { id: 'oficina', label: 'Oficina' },
  { id: 'funilaria', label: 'Funilaria' },
  { id: 'administracao', label: 'Administração' },
  { id: 'diretoria', label: 'Diretoria' },
  { id: 'consolidado', label: 'Consolidado (Total)' },
];

export interface DespesaAdmRow {
  conta: string;
  isMain: boolean;
  saldoAnterior: number;
  valDebito: number;
  valCredito: number;
  saldoPeriodo: number;
  saldoAtual: number;
}

export interface DespesasAdmMesData {
  rows: DespesaAdmRow[];
  totalRow: unknown;
  importedAt: string;
  fileName: string;
}

/** Funções de storage necessárias; cada dashboard (Audi/VW) fornece as suas. */
export interface ComparativoStorageAdapter {
  getDespesasAdmMes(year: number, month: number): Promise<DespesasAdmMesData | null>;
  loadClassificacoes(): Promise<Record<string, TipoClassificacao>>;
  loadRegrasDeptos(): Promise<Record<string, DeptoTab>>;
  extractByDeptoRule(
    data: DespesasAdmMesData,
    tab: DeptoTab,
    regras: Record<string, DeptoTab>,
  ): Map<string, number>;
  extractByDeptoRuleAll(
    data: DespesasAdmMesData,
    regras: Record<string, DeptoTab>,
  ): Map<string, number>;
  applyAllMerges(valorMap: Map<string, number>): void;
  getImportedMonths(): Promise<Array<{ year: number; month: number }>>;
}

// ─── Períodos ────────────────────────────────────────────────────────────────

export type Granularidade = 'mensal' | 'bimestral' | 'trimestral' | 'semestral';

export const GRAN_SIZE: Record<Granularidade, number> = {
  mensal: 1, bimestral: 2, trimestral: 3, semestral: 6,
};

export const GRAN_LABEL: Record<Granularidade, string> = {
  mensal: 'Mensal', bimestral: 'Bimestral', trimestral: 'Trimestral', semestral: 'Semestral',
};

export const GRAN_ORDENADAS: Granularidade[] = ['mensal', 'bimestral', 'trimestral', 'semestral'];

export const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MONTHS_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export interface YM { year: number; month: number; }

/** Soma `delta` meses a (ano, mês), lidando com virada de ano. */
export function addMonths(ym: YM, delta: number): YM {
  const idx = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** `count` meses terminando em `end` (inclusive), do mais antigo ao mais recente. */
export function monthsEndingAt(end: YM, count: number): YM[] {
  const res: YM[] = [];
  for (let i = count - 1; i >= 0; i--) res.push(addMonths(end, -i));
  return res;
}

/** Rótulo de um conjunto de meses contíguos (ex.: "Set/2026" ou "Jul–Set/2026"). */
export function periodLabel(months: YM[]): string {
  if (months.length === 0) return '—';
  if (months.length === 1) return `${MONTHS_SHORT[months[0].month - 1]}/${months[0].year}`;
  const a = months[0];
  const b = months[months.length - 1];
  if (a.year === b.year) return `${MONTHS_SHORT[a.month - 1]}–${MONTHS_SHORT[b.month - 1]}/${a.year}`;
  return `${MONTHS_SHORT[a.month - 1]}/${a.year}–${MONTHS_SHORT[b.month - 1]}/${b.year}`;
}

export interface PeriodosComparados {
  atual: YM[];
  anterior: YM[];
}

/** Quantos buckets de calendário existem por ano para cada granularidade. */
export const GRAN_BUCKETS_PER_YEAR: Record<Granularidade, number> = {
  mensal: 12, bimestral: 6, trimestral: 4, semestral: 2,
};

/** Índice (1-based) do bucket de calendário que contém o mês informado. */
export function bucketIndexOf(month: number, gran: Granularidade): number {
  return Math.ceil(month / GRAN_SIZE[gran]);
}

/** Último mês (1-12) de um bucket — útil como "âncora" ao trocar de granularidade. */
export function bucketAnchorMonth(gran: Granularidade, index: number): number {
  return index * GRAN_SIZE[gran];
}

/** Meses de calendário de um bucket (ex.: bimestral 5 → Set, Out), do mais antigo ao mais recente. */
export function bucketMonths(gran: Granularidade, year: number, index: number): YM[] {
  const size = GRAN_SIZE[gran];
  const start = (index - 1) * size + 1;
  const res: YM[] = [];
  for (let i = 0; i < size; i++) res.push({ year, month: start + i });
  return res;
}

/** Bucket de calendário imediatamente anterior (volta ao ano anterior no 1º bucket). */
export function prevBucket(gran: Granularidade, year: number, index: number): { year: number; index: number } {
  if (index > 1) return { year, index: index - 1 };
  return { year: year - 1, index: GRAN_BUCKETS_PER_YEAR[gran] };
}

/** Rótulo do bucket para o seletor (ex.: "5º Bim (Set–Out)" ou "Outubro"). */
export function bucketLabel(gran: Granularidade, index: number): string {
  if (gran === 'mensal') return MONTHS_FULL[index - 1];
  const months = bucketMonths(gran, 2000, index);
  const a = MONTHS_SHORT[months[0].month - 1];
  const b = MONTHS_SHORT[months[months.length - 1].month - 1];
  const prefix = gran === 'bimestral' ? 'Bim' : gran === 'trimestral' ? 'Tri' : 'Sem';
  return `${index}º ${prefix} (${a}–${b})`;
}

/**
 * Períodos de calendário fixos: o período atual é o bucket (ano, índice) e o
 * anterior é o bucket imediatamente anterior de mesmo tamanho.
 */
export function calcularPeriodos(gran: Granularidade, year: number, index: number): PeriodosComparados {
  const atual = bucketMonths(gran, year, index);
  const prev = prevBucket(gran, year, index);
  const anterior = bucketMonths(gran, prev.year, prev.index);
  return { atual, anterior };
}

// ─── Agregação ───────────────────────────────────────────────────────────────

export interface VariacaoConta {
  conta: string;
  atual: number;
  anterior: number;
  variacao: number;       // atual - anterior
  variacaoPerc: number;   // % sobre |anterior|
}

export interface GrupoResultado {
  grupo: GrupoKey;
  contas: VariacaoConta[];
  totalAtual: number;
  totalAnterior: number;
}

export interface DeptoResultado {
  dept: DeptoKey;
  label: string;
  grupos: GrupoResultado[];
  totalAtual: number;
  totalAnterior: number;
}

export interface ComparativoResultado {
  periodos: PeriodosComparados;
  labelAtual: string;
  labelAnterior: string;
  deptos: DeptoResultado[];
  mesesFaltantes: YM[];
}

export function calcVariacao(atual: number, anterior: number): { variacao: number; variacaoPerc: number } {
  const variacao = atual - anterior;
  if (anterior === 0) return { variacao, variacaoPerc: atual !== 0 ? 100 : 0 };
  return { variacao, variacaoPerc: (variacao / Math.abs(anterior)) * 100 };
}

function grupoDaConta(conta: string, classificacoes: Record<string, TipoClassificacao>): GrupoKey {
  const prefix = conta.match(/^(\d+ -)/)?.[1] ?? '';
  return classificacoes[prefix] ?? SEM_CLASSIFICACAO;
}

const GRUPOS_ORDENADOS: GrupoKey[] = [...TIPOS_ORDENADOS, SEM_CLASSIFICACAO];

/** Agrega um mapa de contas de um departamento num período (soma dos meses). */
function somarPeriodo(
  adapter: ComparativoStorageAdapter,
  dept: DeptoKey,
  dataByKey: Map<string, DespesasAdmMesData | null>,
  months: YM[],
  regras: Record<string, DeptoTab>,
): Map<string, number> {
  const total = new Map<string, number>();
  for (const ym of months) {
    const data = dataByKey.get(`${ym.year}:${ym.month}`);
    if (!data) continue;
    const m = dept === 'consolidado'
      ? adapter.extractByDeptoRuleAll(data, regras)
      : adapter.extractByDeptoRule(data, dept, regras);
    adapter.applyAllMerges(m);
    for (const [conta, val] of m) total.set(conta, (total.get(conta) ?? 0) + val);
  }
  return total;
}

/** Monta os grupos de variação (por tipo) a partir dos mapas atual e anterior de um departamento. */
function montarGrupos(
  atualMap: Map<string, number>,
  anteriorMap: Map<string, number>,
  classificacoes: Record<string, TipoClassificacao>,
): GrupoResultado[] {
  const contasUnion = new Set<string>([...atualMap.keys(), ...anteriorMap.keys()]);
  const buckets = new Map<GrupoKey, VariacaoConta[]>();

  for (const conta of contasUnion) {
    const atual = atualMap.get(conta) ?? 0;
    const anterior = anteriorMap.get(conta) ?? 0;
    if (atual === 0 && anterior === 0) continue;
    const { variacao, variacaoPerc } = calcVariacao(atual, anterior);
    const grupo = grupoDaConta(conta, classificacoes);
    const arr = buckets.get(grupo) ?? [];
    arr.push({ conta, atual, anterior, variacao, variacaoPerc });
    buckets.set(grupo, arr);
  }

  const grupos: GrupoResultado[] = [];
  for (const grupo of GRUPOS_ORDENADOS) {
    const contas = buckets.get(grupo);
    if (!contas || contas.length === 0) continue;
    contas.sort((a, b) => Math.abs(b.atual) - Math.abs(a.atual));
    const totalAtual = contas.reduce((s, c) => s + c.atual, 0);
    const totalAnterior = contas.reduce((s, c) => s + c.anterior, 0);
    grupos.push({ grupo, contas, totalAtual, totalAnterior });
  }
  return grupos;
}

/**
 * Executa o comparativo completo: para cada departamento (e consolidado),
 * soma as contas do período atual e do anterior e calcula as variações.
 */
export async function executarComparativo(
  adapter: ComparativoStorageAdapter,
  periodos: PeriodosComparados,
): Promise<ComparativoResultado> {
  const [classificacoes, regras] = await Promise.all([
    adapter.loadClassificacoes(),
    adapter.loadRegrasDeptos(),
  ]);

  // Carrega cada mês único uma única vez.
  const uniqueKeys = new Map<string, YM>();
  for (const ym of [...periodos.atual, ...periodos.anterior]) {
    uniqueKeys.set(`${ym.year}:${ym.month}`, ym);
  }
  const dataByKey = new Map<string, DespesasAdmMesData | null>();
  await Promise.all(
    Array.from(uniqueKeys.entries()).map(async ([key, ym]) => {
      dataByKey.set(key, await adapter.getDespesasAdmMes(ym.year, ym.month));
    }),
  );

  // Meses faltantes = meses dos períodos sem dados importados.
  const mesesFaltantes: YM[] = [];
  for (const ym of [...periodos.atual, ...periodos.anterior]) {
    if (!dataByKey.get(`${ym.year}:${ym.month}`)) mesesFaltantes.push(ym);
  }

  const deptos: DeptoResultado[] = DEPTOS_ORDENADOS.map(({ id, label }) => {
    const atualMap = somarPeriodo(adapter, id, dataByKey, periodos.atual, regras);
    const anteriorMap = somarPeriodo(adapter, id, dataByKey, periodos.anterior, regras);
    const grupos = montarGrupos(atualMap, anteriorMap, classificacoes);
    const totalAtual = grupos.reduce((s, g) => s + g.totalAtual, 0);
    const totalAnterior = grupos.reduce((s, g) => s + g.totalAnterior, 0);
    return { dept: id, label, grupos, totalAtual, totalAnterior };
  });

  return {
    periodos,
    labelAtual: periodLabel(periodos.atual),
    labelAnterior: periodLabel(periodos.anterior),
    deptos,
    mesesFaltantes,
  };
}
