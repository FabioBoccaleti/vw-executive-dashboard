import { kvGet, kvSet, kvDelete } from '@/lib/kvClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type RvBrand = 'vw' | 'audi';
export type TipoRemuneracao = 'fixa' | 'variavel';
export type StatusPagamento = 'pendente' | 'pago';

/** Classificação do item variável (apenas rótulo, não altera o cálculo) */
export type ItemCategoria = 'premio' | 'comissao';
export const CATEGORIA_LABELS: Record<ItemCategoria, string> = {
  premio: 'Prêmio',
  comissao: 'Comissão',
};

/** Modo de cálculo do item variável */
export type ModoVariavel = 'percentual' | 'faixa';

/** Base de cálculo (resultado por departamento, puxado do DRE) */
export type BaseCalculoVariavel =
  | 'lucro_novos'
  | 'lucro_usados'
  | 'lucro_vd_direta'
  | 'lucro_pecas'
  | 'lucro_oficina'
  | 'lucro_funilaria'
  | 'incentivo_siq';

export const BASE_CALCULO_LABELS: Record<BaseCalculoVariavel, string> = {
  lucro_novos:     'LUCRO LÍQUIDO DO EXERCÍCIO - Novos',
  lucro_usados:    'LUCRO LÍQUIDO DO EXERCÍCIO - Usados',
  lucro_vd_direta: 'LUCRO LÍQUIDO DO EXERCÍCIO - VD Direta',
  lucro_pecas:     'LUCRO LÍQUIDO DO EXERCÍCIO - Peças',
  lucro_oficina:   'LUCRO LÍQUIDO DO EXERCÍCIO - Oficina',
  lucro_funilaria: 'LUCRO LÍQUIDO DO EXERCÍCIO - Funilaria',
  incentivo_siq:   'Incentivo SIQ',
};

/** Faixa de resultado → percentual (a % incide sobre o valor total da base) */
export interface FaixaResultado {
  id: string;
  /** Limite inferior (inclusive) */
  de: number;
  /** Limite superior (inclusive). undefined = "acima do limite" */
  ate?: number;
  /** Percentual aplicado quando a base cai nesta faixa */
  percentual: number;
}

/** Item de remuneração vinculado ao cadastro do colaborador */
export interface ItemRemuneracaoRV {
  id: string;
  descricao: string;
  tipo: TipoRemuneracao;
  /** Classificação (rótulo) do item variável: Prêmio ou Comissão */
  categoria?: ItemCategoria;
  /** Valor base — apenas para tipo 'fixa' */
  valorBase?: number;
  /** Modo de cálculo do item variável (default 'percentual') */
  modoVariavel?: ModoVariavel;
  /** Percentual fixo aplicado sobre a base — apenas modo 'percentual' */
  percentual?: number;
  /** Tabela de faixas de resultado → % — apenas modo 'faixa' */
  faixas?: FaixaResultado[];
  /** Base de cálculo (departamento). Se definida, a base é puxada do DRE; senão, manual */
  baseCalculo?: BaseCalculoVariavel;
}

/**
 * Retorna o percentual da faixa em que o valor da base se enquadra.
 * Base menor ou igual a zero => 0%. Sem faixas => 0%.
 */
export function percentualPorFaixa(faixas: FaixaResultado[] | undefined, valorBase: number): number {
  if (!faixas || faixas.length === 0) return 0;
  if (valorBase <= 0) return 0;
  const ordenadas = [...faixas].sort((a, b) => a.de - b.de);
  for (const f of ordenadas) {
    const ate = f.ate ?? Infinity;
    if (valorBase >= f.de && valorBase <= ate) return f.percentual;
  }
  return 0;
}

/** Percentual base de um item variável conforme o modo (fixo ou faixa) */
export function percentualBaseVariavel(item: ItemRemuneracaoRV, valorBase: number): number {
  return (item.modoVariavel ?? 'percentual') === 'faixa'
    ? percentualPorFaixa(item.faixas, valorBase)
    : (item.percentual ?? 0);
}

/** KPI vinculado a um item variável do colaborador */
export interface KpiColaborador {
  id: string;
  descricao: string;
  /** ID do ItemRemuneracaoRV (variável) afetado */
  itemRemuneracaoId: string;
  /** Percentual de bônus adicionado ao % base do item quando atingido */
  percentualBonus: number;
  /** Bônus em valor fixo (R$) somado ao valor do item quando atingido */
  valorBonus?: number;
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
  /** Salário fixo mensal de referência (cadastrado no RH). Congelado no snapshot ao pagar. */
  salarioFixo?: number;
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
  /** Para itens variáveis: classificação (Prêmio/Comissão) */
  categoria?: ItemCategoria;
  /** Para itens variáveis: valor da base de cálculo informado no lançamento */
  valorBaseCalculo?: number;
  /** Para itens variáveis: snapshot do percentual (base + KPIs) no lançamento */
  percentualUsado?: number;
  /** Para itens variáveis: rótulo da base de cálculo */
  baseCalculoLabel?: string;
}

export interface AssinaturaDigital {
  username: string;
  name?: string;
  dataHora: string;
}

/** Campos de assinatura (mesmo padrão do Cálculo de Comissões VW) */
export type CampoAssinaturaRV =
  | 'financeiro'
  | 'gerenciaComercial'
  | 'diretoriaComercial'
  | 'diretoria';

export const CAMPO_ASSINATURA_LABELS: Record<CampoAssinaturaRV, string> = {
  financeiro:         'Financeiro',
  gerenciaComercial:  'Gerência Comercial',
  diretoriaComercial: 'Diretoria Comercial',
  diretoria:          'Diretoria',
};

export const CAMPO_ASSINATURA_LABELS_CURTO: Record<CampoAssinaturaRV, string> = {
  financeiro:         'Fin',
  gerenciaComercial:  'G.Com',
  diretoriaComercial: 'D.Com',
  diretoria:          'Dir',
};

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
  assinaturas?: Partial<Record<CampoAssinaturaRV, AssinaturaDigital>>;
}

// ─── Chaves KV ────────────────────────────────────────────────────────────────

const COLABORADORES_KEY = 'rem_var_colaboradores';
const DESCRICAO_EXTRAS_KEY = 'rem_var_descricao_extras';
const DESCRICAO_OPCOES_KEY = 'rem_var_descricao_opcoes';

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

/**
 * Lista completa (editável) de opções de descrição. Na primeira leitura, faz a
 * migração a partir das opções padrão + extras legadas e persiste o resultado.
 */
export async function loadDescricaoOpcoes(): Promise<string[]> {
  try {
    const stored = await kvGet<string[]>(DESCRICAO_OPCOES_KEY);
    if (stored && stored.length) return stored;
    const legacyExtras = (await kvGet<string[]>(DESCRICAO_EXTRAS_KEY)) ?? [];
    const seed = [...DESCRICAO_PADRAO, ...legacyExtras.filter(e => !DESCRICAO_PADRAO.includes(e))];
    await kvSet(DESCRICAO_OPCOES_KEY, seed);
    return seed;
  } catch {
    return [...DESCRICAO_PADRAO];
  }
}

export async function addDescricaoOpcao(descricao: string): Promise<boolean> {
  try {
    const list = await loadDescricaoOpcoes();
    if (list.includes(descricao)) return true;
    return kvSet(DESCRICAO_OPCOES_KEY, [...list, descricao]);
  } catch {
    return false;
  }
}

export async function renameDescricaoOpcao(oldName: string, newName: string): Promise<boolean> {
  try {
    const list = await loadDescricaoOpcoes();
    const next = list.map(d => (d === oldName ? newName : d));
    return kvSet(DESCRICAO_OPCOES_KEY, next);
  } catch {
    return false;
  }
}

export async function removeDescricaoOpcao(descricao: string): Promise<boolean> {
  try {
    const list = await loadDescricaoOpcoes();
    return kvSet(DESCRICAO_OPCOES_KEY, list.filter(d => d !== descricao));
  } catch {
    return false;
  }
}

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
      ...(item.tipo === 'variavel' && {
        categoria: item.categoria,
        percentualUsado: (item.modoVariavel ?? 'percentual') === 'faixa' ? 0 : item.percentual,
        baseCalculoLabel: item.baseCalculo ? BASE_CALCULO_LABELS[item.baseCalculo] : undefined,
      }),
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
    const pctBase = percentualBaseVariavel(colabItem, itemAtual?.valorBaseCalculo ?? 0);
    const kpisAtingidos = (colaborador.kpis ?? [])
      .filter(k => k.itemRemuneracaoId === colabItem.id && (lanc.kpisAtingidos ?? []).includes(k.id));
    const kpiBonus = kpisAtingidos.reduce((s, k) => s + k.percentualBonus, 0);
    const kpiValorBonus = kpisAtingidos.reduce((s, k) => s + (k.valorBonus ?? 0), 0);
    const pctTotal = pctBase + kpiBonus;
    const valorBase = itemAtual?.valorBaseCalculo ?? 0;
    return {
      itemId: colabItem.id,
      descricao: colabItem.descricao,
      tipo: 'variavel',
      categoria: colabItem.categoria,
      valor: Math.max(0, Math.round(((valorBase > 0 ? valorBase * pctTotal / 100 : 0) + kpiValorBonus) * 100) / 100),
      valorBaseCalculo: valorBase,
      percentualUsado: pctTotal,
      baseCalculoLabel: colabItem.baseCalculo ? BASE_CALCULO_LABELS[colabItem.baseCalculo] : undefined,
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
