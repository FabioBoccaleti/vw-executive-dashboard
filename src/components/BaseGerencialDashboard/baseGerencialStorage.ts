import { kvGet, kvSet, kvKeys } from '@/lib/kvClient';

export interface BaseGerencialRow {
  conta: string;
  isMain: boolean;
  saldoAnterior: number;
  valDebito: number;
  valCredito: number;
  saldoPeriodo: number;
  saldoAtual: number;
}

export interface BaseGerencialTotalRow {
  saldoAnterior: number;
  valDebito: number;
  valCredito: number;
  saldoPeriodo: number;
  saldoAtual: number;
}

export interface BaseGerencialMesData {
  rows: BaseGerencialRow[];
  totalRow: BaseGerencialTotalRow | null;
  importedAt: string;
  fileName: string;
}

const KEY_PREFIX = 'basege';

function makeKey(year: number, mes: number): string {
  return `${KEY_PREFIX}:${year}:M${String(mes).padStart(2, '0')}`;
}

export async function getBaseGerencialMes(
  year: number,
  mes: number,
): Promise<BaseGerencialMesData | null> {
  return kvGet<BaseGerencialMesData>(makeKey(year, mes));
}

export async function setBaseGerencialMes(
  year: number,
  mes: number,
  data: BaseGerencialMesData,
): Promise<void> {
  await kvSet(makeKey(year, mes), data);
}

export async function deleteBaseGerencialMes(year: number, mes: number): Promise<void> {
  await kvSet(makeKey(year, mes), null);
}

export async function getAllImportedMesesData(): Promise<BaseGerencialMesData[]> {
  const keys = await kvKeys(`${KEY_PREFIX}:*`);
  const dataKeys = keys.filter(k => /^basege:\d{4}:M(0[1-9]|1[0-2])$/.test(k));
  const results = await Promise.all(dataKeys.map(k => kvGet<BaseGerencialMesData>(k)));
  return results.filter((d): d is BaseGerencialMesData => d !== null);
}

// ─── Classificação de Revendas (Marca) ───────────────────────────────────────

export type Marca = 'audi' | 'vw';

export const MARCA_LABELS: Record<Marca, string> = {
  audi: 'Audi',
  vw: 'VW',
};

const REVENDAS_KEY = `${KEY_PREFIX}:revendas`;

export async function loadClassificacaoRevendas(): Promise<Record<string, Marca>> {
  return (await kvGet<Record<string, Marca>>(REVENDAS_KEY)) ?? {};
}

export async function saveClassificacaoRevendas(data: Record<string, Marca>): Promise<void> {
  await kvSet(REVENDAS_KEY, data);
}

// ─── Regras de Departamentos ─────────────────────────────────────────────────

export type DeptoClassificacao =
  | 'veiculos_novos'
  | 'venda_direta'
  | 'veiculos_usados'
  | 'pecas'
  | 'oficina'
  | 'funilaria'
  | 'administracao'
  | 'diretoria';

export const DEPTO_CLASSIFICACAO_LABELS: Record<DeptoClassificacao, string> = {
  veiculos_novos:  'Veículos Novos',
  venda_direta:    'Venda Direta',
  veiculos_usados: 'Veículos Usados',
  pecas:           'Peças',
  oficina:         'Oficina',
  funilaria:       'Funilaria',
  administracao:   'Administração',
  diretoria:       'Diretoria',
};

export const DEPTO_CLASSIFICACOES_ORDENADAS: DeptoClassificacao[] = [
  'veiculos_novos', 'venda_direta', 'veiculos_usados', 'pecas',
  'oficina', 'funilaria', 'administracao', 'diretoria',
];

// Para contas que começam com 3 ou 4, a classificação pode depender do Tipo Item
export interface RegraDepto {
  // Classificação padrão (usada para contas que NÃO começam com 3 ou 4)
  default?: DeptoClassificacao;
  // Classificações específicas por Tipo Item (P/S/V) - apenas para contas 3 e 4
  byTipoItem?: {
    P?: DeptoClassificacao;
    S?: DeptoClassificacao;
    V?: DeptoClassificacao;
  };
}

const REGRAS_KEY = `${KEY_PREFIX}:regras_departamentos`;

export async function loadRegrasDeptos(): Promise<Record<string, RegraDepto>> {
  return (await kvGet<Record<string, RegraDepto>>(REGRAS_KEY)) ?? {};
}

export async function saveRegrasDeptos(data: Record<string, RegraDepto>): Promise<void> {
  await kvSet(REGRAS_KEY, data);
}

// ─── Classificação de Tipo de Conta ──────────────────────────────────────────

export type TipoContaClassificacao =
  | 'receita_vendas'
  | 'receitas_operacionais'
  | 'receitas_financeiras'
  | 'receitas_nao_operacionais'
  | 'custos_operacionais'
  | 'despesas_pessoal'
  | 'despesas_servicos_terceiros'
  | 'despesas_ocupacao'
  | 'despesas_funcionamento'
  | 'despesas_vendas'
  | 'amortizacoes_depreciacoes'
  | 'despesas_financeiras'
  | 'outras_despesas_operacionais';

export const TIPO_CONTA_LABELS: Record<TipoContaClassificacao, string> = {
  receita_vendas:                'Receita de Vendas',
  receitas_operacionais:         'Receitas Operacionais',
  receitas_financeiras:          'Receitas Financeiras',
  receitas_nao_operacionais:     'Receitas não Operacionais',
  custos_operacionais:           'Custos Operacionais',
  despesas_pessoal:              'Despesas c/ Pessoal',
  despesas_servicos_terceiros:   'Despesas c/ Serviços de Terceiros',
  despesas_ocupacao:             'Despesas c/ Ocupação',
  despesas_funcionamento:        'Despesas de Funcionamento',
  despesas_vendas:               'Despesas c/ Vendas',
  amortizacoes_depreciacoes:     'Amortizações de Depreciações',
  despesas_financeiras:          'Despesas Financeiras',
  outras_despesas_operacionais:  'Outras Despesas Operacionais',
};

export const TIPOS_CONTA_ORDENADOS: TipoContaClassificacao[] = [
  'receita_vendas',
  'receitas_operacionais',
  'receitas_financeiras',
  'receitas_nao_operacionais',
  'custos_operacionais',
  'despesas_pessoal',
  'despesas_servicos_terceiros',
  'despesas_ocupacao',
  'despesas_funcionamento',
  'despesas_vendas',
  'amortizacoes_depreciacoes',
  'despesas_financeiras',
  'outras_despesas_operacionais',
];

const CLASSIFICACOES_CONTA_KEY = `${KEY_PREFIX}:classificacoes_conta`;

export async function loadClassificacoesConta(): Promise<Record<string, TipoContaClassificacao>> {
  return (await kvGet<Record<string, TipoContaClassificacao>>(CLASSIFICACOES_CONTA_KEY)) ?? {};
}

export async function saveClassificacoesConta(data: Record<string, TipoContaClassificacao>): Promise<void> {
  await kvSet(CLASSIFICACOES_CONTA_KEY, data);
}

// ─── Dados Operacionais por Período e Departamento ───────────────────────────

export interface DadosOperacionais {
  funcionarios?: number;
  volumeVendas?: number;
}

const DADOS_OP_KEY = `${KEY_PREFIX}:dados_operacionais`;

export function dadosOpKey(
  year: number,
  mes: number,
  marca: Marca,
  departamento: DeptoClassificacao | 'consolidado',
): string {
  return `${year}:M${String(mes).padStart(2, '0')}:${marca}:${departamento}`;
}

export async function loadAllDadosOperacionais(): Promise<Record<string, DadosOperacionais>> {
  return (await kvGet<Record<string, DadosOperacionais>>(DADOS_OP_KEY)) ?? {};
}

export async function saveAllDadosOperacionais(
  data: Record<string, DadosOperacionais>,
): Promise<void> {
  await kvSet(DADOS_OP_KEY, data);
}

// ─── Cenários de Análise de Eficiência ───────────────────────────────────────

export type NumeradorTipo =
  | { tipo: 'resultado' }
  | { tipo: 'resultado_sem_fin' }
  | { tipo: 'grupo'; grupo: TipoContaClassificacao }
  | { tipo: 'multi_grupo'; grupos: TipoContaClassificacao[] }
  | { tipo: 'conta'; conta: string }
  | { tipo: 'multi_conta'; contas: string[] };

export type DenominadorTipo =
  | { tipo: 'funcionarios' }
  | { tipo: 'volume_vendas' }
  | { tipo: 'resultado' }
  | { tipo: 'resultado_sem_fin' }
  | { tipo: 'grupo'; grupo: TipoContaClassificacao }
  | { tipo: 'multi_grupo'; grupos: TipoContaClassificacao[] }
  | { tipo: 'conta'; conta: string }
  | { tipo: 'multi_conta'; contas: string[] };

export interface BaseGerencialIndicadorConfig {
  id: string;
  nome: string;
  numerador: NumeradorTipo;
  denominador: DenominadorTipo;
  formato: 'reais' | 'percentual' | 'reais_por_unidade';
  meta?: number; // em reais ou em % (ex: 15 significa 15%)
  melhorQuando: 'maior' | 'menor';
}

export interface BaseGerencialCenario {
  id: string;
  nome: string;
  departamento: DeptoClassificacao | 'consolidado'; // sem marca: cenário se aplica a VW e Audi
  indicadores: BaseGerencialIndicadorConfig[];
  criadoEm: string;
}

const CENARIOS_KEY = `${KEY_PREFIX}:cenarios`;

export async function loadCenarios(): Promise<BaseGerencialCenario[]> {
  return (await kvGet<BaseGerencialCenario[]>(CENARIOS_KEY)) ?? [];
}

export async function saveCenarios(cenarios: BaseGerencialCenario[]): Promise<void> {
  await kvSet(CENARIOS_KEY, cenarios);
}

// ─── Contas que usam Regra de Tipo Item (P/S/V) ──────────────────────────────

const CONTAS_TIPO_ITEM_KEY = `${KEY_PREFIX}:contas_tipo_item`;

// Retorna null se nunca foi configurado (permite fallback para comportamento legado)
export async function loadContasTipoItem(): Promise<string[] | null> {
  return kvGet<string[]>(CONTAS_TIPO_ITEM_KEY);
}

export async function saveContasTipoItem(contas: string[]): Promise<void> {
  await kvSet(CONTAS_TIPO_ITEM_KEY, contas);
}
