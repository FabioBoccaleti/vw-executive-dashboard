import { kvGet, kvSet, kvDelete } from '@/lib/kvClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type RvBrand = 'vw' | 'audi';
export type TipoRemuneracao = 'fixa' | 'variavel';
export type StatusPagamento = 'pendente' | 'pago';

/** Item de remuneração vinculado ao cadastro do colaborador */
export interface ItemRemuneracaoRV {
  id: string;
  descricao: string;
  tipo: TipoRemuneracao;
  /** Valor base — apenas para tipo 'fixa' */
  valorBase?: number;
  /** Percentual aplicado sobre a base informada no mês — apenas 'variavel' */
  percentual?: number;
}

/** KPI vinculado a um item variável do colaborador */
export interface KpiColaborador {
  id: string;
  descricao: string;
  /** ID do ItemRemuneracaoRV (variável) afetado */
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

/** Cadastro permanente do colaborador */
export interface Colaborador {
  id: string;
  nome: string;
  cargo?: string;
  departamento?: string;
  brand: RvBrand;
  ativo: boolean;
  itens: ItemRemuneracaoRV[];
  kpis?: KpiColaborador[];
  /** ordem de exibição */
  ordem?: number;
}

export type ColaboradorSnapshot = Colaborador;

/** Linha de um lançamento mensal */
export interface LancamentoItemRV {
  itemId: string;
  descricao: string;
  tipo: TipoRemuneracao;
  valor: number;
  observacao?: string;
  /** Para itens variáveis: valor da base de cálculo informado no lançamento */
  valorBaseCalculo?: number;
  /** Para itens variáveis: snapshot do percentual (base + KPIs) no lançamento */
  percentualUsado?: number;
}

export interface AssinaturaDigital {
  username: string;
  name?: string;
  dataHora: string;
}

/** Lançamento mensal de um colaborador */
export interface LancamentoRV {
  colaboradorId: string;
  year: number;
  month: number;
  status: StatusPagamento;
  dataPagamento?: string; // DD/MM/AAAA
  itens: LancamentoItemRV[];
  /** Snapshot do cadastro no momento em que foi marcado como pago */
  snapshotColaborador?: ColaboradorSnapshot;
  observacaoGeral?: string;
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

const COLABORADORES_KEY = 'rem_var_colaboradores';
const DESCRICAO_EXTRAS_KEY = 'rem_var_descricao_extras';

function lancamentoKey(colaboradorId: string, year: number, month: number): string {
  const mm = String(month).padStart(2, '0');
  return `rem_var_lanc_${colaboradorId}_${year}_${mm}`;
}

// ─── Opções de Descrição de Remuneração ──────────────────────────────────────

export const DESCRICAO_PADRAO: readonly string[] = [
  'Remuneração Variável',
  'Bônus de Performance',
  'Prêmio por Meta',
  'Comissão',
  'Gratificação',
];

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

// ─── Cadastro de Colaboradores ───────────────────────────────────────────────

export async function loadColaboradores(): Promise<Colaborador[]> {
  try {
    return (await kvGet<Colaborador[]>(COLABORADORES_KEY)) ?? [];
  } catch {
    return [];
  }
}

export async function saveColaboradores(list: Colaborador[]): Promise<boolean> {
  try {
    return await kvSet(COLABORADORES_KEY, list);
  } catch {
    return false;
  }
}

export async function addColaborador(colaborador: Colaborador): Promise<boolean> {
  const list = await loadColaboradores();
  return saveColaboradores([...list, colaborador]);
}

export async function updateColaborador(updated: Colaborador): Promise<boolean> {
  const list = await loadColaboradores();
  return saveColaboradores(list.map(c => c.id === updated.id ? updated : c));
}

export async function deleteColaborador(id: string): Promise<boolean> {
  const list = await loadColaboradores();
  return saveColaboradores(list.filter(c => c.id !== id));
}

// ─── Lançamentos Mensais ──────────────────────────────────────────────────────

export async function loadLancamento(
  colaboradorId: string,
  year: number,
  month: number,
): Promise<LancamentoRV | null> {
  try {
    return await kvGet<LancamentoRV>(lancamentoKey(colaboradorId, year, month));
  } catch {
    return null;
  }
}

export async function saveLancamento(lanc: LancamentoRV): Promise<boolean> {
  try {
    return await kvSet(lancamentoKey(lanc.colaboradorId, lanc.year, lanc.month), lanc);
  } catch {
    return false;
  }
}

export async function deleteLancamento(
  colaboradorId: string,
  year: number,
  month: number,
): Promise<boolean> {
  try {
    return await kvDelete(lancamentoKey(colaboradorId, year, month));
  } catch {
    return false;
  }
}

/** Carrega lançamentos de um colaborador nos últimos N meses */
export async function loadHistorico(
  colaboradorId: string,
  baseYear: number,
  baseMonth: number,
  months = 12,
): Promise<LancamentoRV[]> {
  const periods: { year: number; month: number }[] = [];
  let y = baseYear, m = baseMonth;
  for (let i = 0; i < months; i++) {
    periods.push({ year: y, month: m });
    m--;
    if (m === 0) { m = 12; y--; }
  }
  const results = await Promise.all(
    periods.map(p => loadLancamento(colaboradorId, p.year, p.month))
  );
  return results.filter((l): l is LancamentoRV => l !== null);
}

export function buildColaboradorSnapshot(colaborador: Colaborador): ColaboradorSnapshot {
  return {
    ...colaborador,
    itens: (colaborador.itens ?? []).map(i => ({ ...i })),
    kpis: (colaborador.kpis ?? []).map(k => ({ ...k })),
  };
}

/** Cria um lançamento pré-preenchido a partir dos itens do cadastro do colaborador */
export function buildLancamentoVazio(
  colaborador: Colaborador,
  year: number,
  month: number,
): LancamentoRV {
  return {
    colaboradorId: colaborador.id,
    year,
    month,
    status: 'pendente',
    kpisAtingidos: [],
    itens: colaborador.itens.map(item => ({
      itemId: item.id,
      descricao: item.descricao,
      tipo: item.tipo,
      valor: item.tipo === 'fixa' ? (item.valorBase ?? 0) : 0,
      ...(item.tipo === 'variavel' && { percentualUsado: item.percentual }),
    })),
  };
}

/**
 * Reconstrói um lançamento pendente refletindo o cadastro atual do colaborador,
 * preservando os valores/base já informados. Lançamentos pagos são retornados
 * inalterados (congelados).
 */
export function buildLancamentoPreview(colaborador: Colaborador, lanc: LancamentoRV): LancamentoRV {
  if (lanc.status === 'pago') return lanc;

  const colabItensMap = new Map(colaborador.itens.map(ci => [ci.id, ci]));
  const itensAtuaisMap = new Map(lanc.itens.map(item => [item.itemId, item]));

  const itensCadastro: LancamentoItemRV[] = colaborador.itens.map(colabItem => {
    const itemAtual = itensAtuaisMap.get(colabItem.id);
    if (colabItem.tipo === 'fixa') {
      return {
        itemId: colabItem.id,
        descricao: colabItem.descricao,
        tipo: 'fixa',
        valor: colabItem.valorBase ?? 0,
      };
    }
    const pctBase = colabItem.percentual ?? 0;
    const kpiBonus = (colaborador.kpis ?? [])
      .filter(k => k.itemRemuneracaoId === colabItem.id && (lanc.kpisAtingidos ?? []).includes(k.id))
      .reduce((s, k) => s + k.percentualBonus, 0);
    const pctTotal = pctBase + kpiBonus;
    const valorBase = itemAtual?.valorBaseCalculo ?? 0;
    return {
      itemId: colabItem.id,
      descricao: colabItem.descricao,
      tipo: 'variavel',
      valor: Math.max(0, Math.round((valorBase * pctTotal / 100) * 100) / 100),
      valorBaseCalculo: valorBase,
      percentualUsado: pctTotal,
    };
  });

  // Itens extras adicionados manualmente no lançamento
  const itensExtras = lanc.itens.filter(item => !colabItensMap.has(item.itemId));

  return { ...lanc, itens: [...itensCadastro, ...itensExtras] };
}

/** Helper: soma total de um lançamento */
export function totalLancamento(lanc: LancamentoRV): number {
  return lanc.itens.reduce((s, i) => s + (i.valor || 0), 0);
}
