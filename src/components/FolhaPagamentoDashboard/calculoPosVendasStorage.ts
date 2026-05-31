import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'calculo_pos_vendas_remuneracoes';
const KEY_PERIODOS = 'calculo_pos_vendas_periodos';

export type DepartamentoColaborador = '' | 'pecas' | 'oficina' | 'funilaria' | 'acessorios';

function normalizeDepartamentoColaborador(value: unknown): DepartamentoColaborador {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('pec')) return 'pecas';
  if (normalized.includes('ofic')) return 'oficina';
  if (normalized.includes('funil')) return 'funilaria';
  if (normalized.includes('acess')) return 'acessorios';
  return '';
}

export interface CalculoPosVendasRemuneracao {
  id: string;
  periodo: string; // YYYY-M
  vendedor: string;
  departamentoColaborador: DepartamentoColaborador;
  cargoColaborador: string;
  comissionado: boolean;
  salarioFixo: string;
  diasFerias: string;
  comissaoPecasPct: string;
  comissaoAcessoriosPct: string;
  comissaoRpsPct: string;
  comissaoMecanicoPct: string;
  comissaoTotalPecasPct: string;
  bonusProdutividade: string;
  premioProduto: string;
  premioAdicional: string;
  departamentos: string[];
  transacoes: string[];
  bonusEscalas: Array<{
    id: string;
    de: string;
    ate: string;
    bonus: string;
  }>;
  descontarDevolucao: boolean;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CalculoPosVendasPeriodo {
  de: string; // YYYY-MM-DD
  ate: string; // YYYY-MM-DD
  bloqueado?: boolean;
  buscaAtiva?: boolean;
}

export function calculoPeriodoKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export async function loadCalculoPosVendasRemuneracoes(): Promise<CalculoPosVendasRemuneracao[]> {
  try {
    const data = await kvGet(KEY);
    if (!Array.isArray(data)) return [];
    return (data as Record<string, unknown>[]).map((item) => ({
      id: String(item.id ?? crypto.randomUUID()),
      periodo: String(item.periodo ?? ''),
      vendedor: String(item.vendedor ?? ''),
      departamentoColaborador: normalizeDepartamentoColaborador(item.departamentoColaborador),
      cargoColaborador: String(item.cargoColaborador ?? '').trim(),
      comissionado: Boolean(item.comissionado),
      salarioFixo: String(item.salarioFixo ?? ''),
      diasFerias: String(item.diasFerias ?? ''),
      comissaoPecasPct: String(item.comissaoPecasPct ?? ''),
      comissaoAcessoriosPct: String(item.comissaoAcessoriosPct ?? ''),
      comissaoRpsPct: String(item.comissaoRpsPct ?? ''),
      comissaoMecanicoPct: String(item.comissaoMecanicoPct ?? ''),
      comissaoTotalPecasPct: String(item.comissaoTotalPecasPct ?? ''),
      bonusProdutividade: String(item.bonusProdutividade ?? ''),
      premioProduto: String(item.premioProduto ?? ''),
      premioAdicional: String(item.premioAdicional ?? ''),
      departamentos: Array.isArray(item.departamentos) ? item.departamentos.map((value) => String(value ?? '').trim()).filter(Boolean) : [],
      transacoes: Array.isArray(item.transacoes) ? item.transacoes.map((value) => String(value ?? '').trim()).filter(Boolean) : [],
      bonusEscalas: Array.isArray(item.bonusEscalas)
        ? item.bonusEscalas.map((faixa) => ({
            id: String((faixa as Record<string, unknown>).id ?? crypto.randomUUID()),
            de: String((faixa as Record<string, unknown>).de ?? ''),
            ate: String((faixa as Record<string, unknown>).ate ?? ''),
            bonus: String((faixa as Record<string, unknown>).bonus ?? ''),
          }))
        : [],
      descontarDevolucao: Boolean(item.descontarDevolucao),
      ativo: item.ativo === undefined ? true : Boolean(item.ativo),
      criadoEm: String(item.criadoEm ?? new Date().toISOString()),
      atualizadoEm: String(item.atualizadoEm ?? new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

export async function saveCalculoPosVendasRemuneracoes(items: CalculoPosVendasRemuneracao[]): Promise<boolean> {
  try {
    return await kvSet(KEY, items);
  } catch {
    return false;
  }
}

export function upsertCalculoPosVendasRemuneracao(
  items: CalculoPosVendasRemuneracao[],
  nextItem: CalculoPosVendasRemuneracao,
): CalculoPosVendasRemuneracao[] {
  const others = items.filter((item) => !(item.periodo === nextItem.periodo && item.vendedor === nextItem.vendedor));
  return [...others, nextItem];
}

export async function loadCalculoPosVendasPeriodos(): Promise<Record<string, CalculoPosVendasPeriodo>> {
  try {
    const data = await kvGet(KEY_PERIODOS);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return data as Record<string, CalculoPosVendasPeriodo>;
  } catch {
    return {};
  }
}

export async function saveCalculoPosVendasPeriodos(items: Record<string, CalculoPosVendasPeriodo>): Promise<boolean> {
  try {
    return await kvSet(KEY_PERIODOS, items);
  } catch {
    return false;
  }
}