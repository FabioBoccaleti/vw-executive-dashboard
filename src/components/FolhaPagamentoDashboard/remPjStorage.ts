import { kvGet, kvSet, kvDelete } from '@/lib/kvClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PjBrand = 'vw' | 'audi';
export type TipoRemuneracao = 'fixa' | 'variavel' | 'premio';
export type StatusPagamento = 'pendente' | 'pago';

export type BaseCalculoVariavel =
  | 'lucro_novos'
  | 'lucro_usados'
  | 'lucro_novos_usados'
  | 'lucro_vd_direta'
  | 'lucro_pecas'
  | 'lucro_oficina'
  | 'lucro_pecas_oficina'
  | 'lucro_funilaria'
  | 'lucro_trimestral';

export const BASE_CALCULO_LABELS: Record<BaseCalculoVariavel, string> = {
  lucro_novos:         'LUCRO LÍQUIDO DO EXERCÍCIO - Novos',
  lucro_usados:        'LUCRO LÍQUIDO DO EXERCÍCIO - Usados',
  lucro_novos_usados:  'LUCRO LÍQUIDO DO EXERCÍCIO - Novos + Usados',
  lucro_vd_direta:  'LUCRO LÍQUIDO DO EXERCÍCIO - VD Direta',
  lucro_pecas:         'LUCRO LÍQUIDO DO EXERCÍCIO - Peças',
  lucro_oficina:        'LUCRO LÍQUIDO DO EXERCÍCIO - Oficina',
  lucro_pecas_oficina:  'LUCRO LÍQUIDO DO EXERCÍCIO - Peças + Oficina',
  lucro_funilaria:  'LUCRO LÍQUIDO DO EXERCÍCIO - Funilaria',
  lucro_trimestral: 'Lucro Líquido do Trimestre',
};

/** Item de remuneração vinculado ao cadastro do prestador */
export interface ItemRemuneracao {
  id: string;
  descricao: string;
  tipo: TipoRemuneracao;
  /** Valor base — preenchido apenas para tipo 'fixa' */
  valorBase?: number;
  /** Percentual aplicado sobre a base de cálculo — apenas para tipo 'variavel' */
  percentual?: number;
  /** Base de cálculo — apenas para tipo 'variavel' */
  baseCalculo?: BaseCalculoVariavel;
  /** Departamentos considerados — apenas para Lucro Operacional Trimestral */
  departamentos?: LucroTrimestralDepartamento[];
  /** Rateio automático por departamento para este item */
  rateio?: RateioDepartamentoRateio[];
}

export interface RateioDepartamentoRateio {
  departamento: LucroTrimestralDepartamento;
  percentual: number;
}

/** KPI vinculado a um item variável do prestador */
export interface KpiPrestador {
  id: string;
  descricao: string;
  /** ID do ItemRemuneracao (variável) afetado */
  itemRemuneracaoId: string;
  /** Percentual de bônus adicionado ao % base do item quando atingido */
  percentualBonus: number;
  /** Meta numérica a atingir */
  objetivo?: number;
  /** Unidade da meta (ex: "%", "unid.", "R$") — apenas exibição */
  unidade?: string;
  /** Condição para considerar a meta atingida: '>=' (padrão) ou '<=' */
  condicao?: '>=' | '<=';
}

/** Cadastro permanente do prestador */
export interface PrestadorPJ {
  id: string;
  nome: string;
  cnpjCpf?: string;
  empresa?: string;
  cargo?: string;
  brand: PjBrand;
  dataInicio?: string; // DD/MM/AAAA
  ativo: boolean;
  itens: ItemRemuneracao[];
  /** Tem direito a Prêmio Adicional */
  temPremio?: boolean;
  /** Percentual do Prêmio Adicional */
  percentualPremio?: number;
  /** IDs dos itens que compõem a base do Prêmio por padrão */
  itensPremioIds?: string[];
  /** Valor fixo (R$) a deduzir da base de cálculo do Prêmio Adicional */
  deducaoBasePremio?: number;
  /** KPIs com bônus de % sobre itens variáveis */
  kpis?: KpiPrestador[];
  /** ordem de exibição */
  ordem?: number;
}

export interface PrestadorSnapshotPJ {
  id: string;
  nome: string;
  cnpjCpf?: string;
  empresa?: string;
  cargo?: string;
  brand: PjBrand;
  dataInicio?: string;
  ativo: boolean;
  itens: ItemRemuneracao[];
  temPremio?: boolean;
  percentualPremio?: number;
  itensPremioIds?: string[];
  deducaoBasePremio?: number;
  kpis?: KpiPrestador[];
  ordem?: number;
}

/** Linha de um lançamento mensal */
export interface LancamentoItem {
  itemId: string;     // referência a ItemRemuneracao.id
  descricao: string;  // snapshot da descrição no momento do lançamento
  tipo: TipoRemuneracao;
  valor: number;
  observacao?: string;
  /** Para itens variáveis: valor da base de cálculo informado no lançamento */
  valorBaseCalculo?: number;
  /** Para itens variáveis: snapshot do percentual no momento do lançamento */
  percentualUsado?: number;
  /** Para itens variáveis: snapshot do label da base de cálculo */
  baseCalculoLabel?: string;
}

/** Lançamento mensal de um prestador */
export interface AssinaturaDigital {
  username: string;   // e-mail / username do usuário logado
  name?: string;      // nome completo do usuário
  dataHora: string;   // ISO 8601
}

export interface LancamentoPJ {
  prestadorId: string;
  year: number;
  month: number;
  status: StatusPagamento;
  dataPagamento?: string; // DD/MM/AAAA
  itens: LancamentoItem[];
  /** Snapshot do cadastro do prestador no momento em que foi marcado como pago */
  snapshotPrestador?: PrestadorSnapshotPJ;
  observacaoGeral?: string;
  /** IDs dos itens que compõem a base do Prêmio neste mês (snapshot editável) */
  itensPremioIds?: string[];
  /** IDs dos KPIs atingidos neste mês */
  kpisAtingidos?: string[];
  /** Valores alcançados por KPI neste mês: kpiId → valor */
  kpisAlcancado?: Record<string, number>;
  /** Assinaturas eletrônicas */
  assinaturas?: {
    financeiro?: AssinaturaDigital;
    rh?: AssinaturaDigital;
  };
}

// ─── Chaves KV ────────────────────────────────────────────────────────────────

const PRESTADORES_KEY = 'rem_pj_prestadores';
const DESCRICAO_EXTRAS_KEY = 'rem_pj_descricao_extras';

// ─── Opções de Descrição de Remuneração ──────────────────────────────────────

export const DESCRICAO_PADRAO: readonly string[] = [
  'Prestação de Serviço',
  'Lucro Operacional Veic. Novos Varejo',
  'Lucro Operacional Veic. Novos VD / Direta',
  'Lucro Operacional Veic. Usados',
  'Lucro Operacional Peças',
  'Lucro Operacional Oficina',
  'Lucro Operacional Funilaria',
  'Lucro Operacional Trimestral',
  'Lucro Operacional Veíc. Novos Varejo e Veíc. Usados',
  'Lucro Operacional Peças e Oficina',
  'Premiação s/ Venda de Financiamento Novos',
  'Premiação s/ Venda de Financiamento Usados',
  'Premiação de Venda Serviço Despachante Novos',
  'Premiação de Venda Serviço Despachante Usados',
  'Comissão de Vendas',
  'Adicional de Dias Trabalhados',
];

export const DESCRICAO_TRIMESTRAL = 'Lucro Operacional Trimestral';

export const LUCRO_TRIMESTRAL_DEPARTAMENTOS = [
  'Novos Varejo',
  'VD Direta',
  'Usados',
  'Peças',
  'Oficina',
  'Funilaria',
] as const;

export type LucroTrimestralDepartamento = typeof LUCRO_TRIMESTRAL_DEPARTAMENTOS[number];

export async function loadDescricaoExtras(): Promise<string[]> {
  try {
    return (await kvGet<string[]>(DESCRICAO_EXTRAS_KEY)) ?? [];
  } catch {
    return [];
  }
}

export async function addDescricaoExtra(descricao: string): Promise<boolean> {
  try {
    const extras = await loadDescricaoExtras();
    if (extras.includes(descricao)) return true;
    return kvSet(DESCRICAO_EXTRAS_KEY, [...extras, descricao]);
  } catch {
    return false;
  }
}

export async function removeDescricaoExtra(descricao: string): Promise<boolean> {
  try {
    const extras = await loadDescricaoExtras();
    return kvSet(DESCRICAO_EXTRAS_KEY, extras.filter(e => e !== descricao));
  } catch {
    return false;
  }
}

function lancamentoKey(prestadorId: string, year: number, month: number): string {
  const mm = String(month).padStart(2, '0');
  return `rem_pj_lanc_${prestadorId}_${year}_${mm}`;
}

// ─── Cadastro de Prestadores ─────────────────────────────────────────────────

export async function loadPrestadores(): Promise<PrestadorPJ[]> {
  try {
    return (await kvGet<PrestadorPJ[]>(PRESTADORES_KEY)) ?? [];
  } catch {
    return [];
  }
}

export async function savePrestadores(list: PrestadorPJ[]): Promise<boolean> {
  try {
    return await kvSet(PRESTADORES_KEY, list);
  } catch {
    return false;
  }
}

export async function addPrestador(prestador: PrestadorPJ): Promise<boolean> {
  const list = await loadPrestadores();
  return savePrestadores([...list, prestador]);
}

export async function updatePrestador(updated: PrestadorPJ): Promise<boolean> {
  const list = await loadPrestadores();
  return savePrestadores(list.map(p => p.id === updated.id ? updated : p));
}

export async function deletePrestador(id: string): Promise<boolean> {
  const list = await loadPrestadores();
  return savePrestadores(list.filter(p => p.id !== id));
}

// ─── Lançamentos Mensais ──────────────────────────────────────────────────────

export async function loadLancamento(
  prestadorId: string,
  year: number,
  month: number,
): Promise<LancamentoPJ | null> {
  try {
    return await kvGet<LancamentoPJ>(lancamentoKey(prestadorId, year, month));
  } catch {
    return null;
  }
}

export async function saveLancamento(lanc: LancamentoPJ): Promise<boolean> {
  try {
    return await kvSet(lancamentoKey(lanc.prestadorId, lanc.year, lanc.month), lanc);
  } catch {
    return false;
  }
}

export async function deleteLancamento(
  prestadorId: string,
  year: number,
  month: number,
): Promise<boolean> {
  try {
    return await kvDelete(lancamentoKey(prestadorId, year, month));
  } catch {
    return false;
  }
}

/** Carrega lançamentos de todos os prestadores em um mês/ano */
export async function loadLancamentosMes(
  prestadores: PrestadorPJ[],
  year: number,
  month: number,
): Promise<LancamentoPJ[]> {
  const results = await Promise.all(
    prestadores.map(p => loadLancamento(p.id, year, month))
  );
  return results.filter((l): l is LancamentoPJ => l !== null);
}

/** Carrega lançamentos de um prestador nos últimos N meses */
export async function loadHistorico(
  prestadorId: string,
  baseYear: number,
  baseMonth: number,
  months = 12,
): Promise<LancamentoPJ[]> {
  const periods: { year: number; month: number }[] = [];
  let y = baseYear, m = baseMonth;
  for (let i = 0; i < months; i++) {
    periods.push({ year: y, month: m });
    m--;
    if (m === 0) { m = 12; y--; }
  }
  const results = await Promise.all(
    periods.map(p => loadLancamento(prestadorId, p.year, p.month))
  );
  return results.filter((l): l is LancamentoPJ => l !== null);
}

/** Cria um lançamento pré-preenchido a partir dos itens do cadastro do prestador */
export function buildLancamentoVazio(
  prestador: PrestadorPJ,
  year: number,
  month: number,
): LancamentoPJ {
  const itensPremioIds = prestador.itensPremioIds ?? [];
  const pct = prestador.percentualPremio ?? 0;
  // valor inicial do prêmio = soma dos itens fixos marcados * pct / 100
  // (os variáveis ainda não têm base neste ponto, serão recalculados no useEffect do DRE)
  const baseFixa = prestador.itens
    .filter(it => itensPremioIds.includes(it.id) && it.tipo === 'fixa')
    .reduce((s, it) => s + (it.valorBase ?? 0), 0);
  const deducao = prestador.deducaoBasePremio ?? 0;
  const baseFixaReal = Math.max(0, baseFixa - deducao);
  const valorPremioInicial = Math.round(baseFixaReal * pct / 100 * 100) / 100;

  return {
    prestadorId: prestador.id,
    year,
    month,
    status: 'pendente',
    snapshotPrestador: {
      ...prestador,
      itens: prestador.itens.map(item => ({
        ...item,
        rateio: item.rateio ? item.rateio.map(row => ({ ...row })) : undefined,
        departamentos: item.departamentos ? [...item.departamentos] : undefined,
      })),
      kpis: prestador.kpis ? prestador.kpis.map(kpi => ({ ...kpi })) : undefined,
      itensPremioIds: prestador.itensPremioIds ? [...prestador.itensPremioIds] : undefined,
    },
    itensPremioIds,
    kpisAtingidos: [],
    itens: [
      ...prestador.itens.map(item => ({
        itemId: item.id,
        descricao: item.descricao,
        tipo: item.tipo,
        valor: item.tipo === 'fixa' ? (item.valorBase ?? 0) : 0,
        ...(item.tipo === 'premio' && { valor: 0 }),
        ...(item.tipo === 'variavel' && {
          percentualUsado: item.percentual,
          baseCalculoLabel: item.descricao === DESCRICAO_TRIMESTRAL
            ? BASE_CALCULO_LABELS['lucro_trimestral']
            : item.baseCalculo ? BASE_CALCULO_LABELS[item.baseCalculo] : undefined,
        }),
      })),
      ...(prestador.temPremio ? [{
        itemId: 'premio_adicional',
        descricao: 'Prêmio Adicional',
        tipo: 'premio' as TipoRemuneracao,
        valor: valorPremioInicial,
        ...(prestador.percentualPremio != null && { percentualUsado: prestador.percentualPremio }),
      }] : []),
    ],
  };
}

/** Helper: soma total de um lançamento */
export function totalLancamento(lanc: LancamentoPJ): number {
  return lanc.itens.reduce((s, i) => s + (i.valor || 0), 0);
}
