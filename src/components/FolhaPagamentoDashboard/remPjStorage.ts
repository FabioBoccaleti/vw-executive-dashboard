import { kvGet, kvSet, kvDelete } from '@/lib/kvClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PjBrand = 'vw' | 'audi';
export type TipoRemuneracao = 'fixa' | 'variavel';
export type StatusPagamento = 'pendente' | 'pago';

/** Item de remuneração vinculado ao cadastro do prestador */
export interface ItemRemuneracao {
  id: string;
  descricao: string;
  tipo: TipoRemuneracao;
  /** Valor base — preenchido apenas para tipo 'fixa' */
  valorBase?: number;
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
  /** ordem de exibição */
  ordem?: number;
}

/** Linha de um lançamento mensal */
export interface LancamentoItem {
  itemId: string;     // referência a ItemRemuneracao.id
  descricao: string;  // snapshot da descrição no momento do lançamento
  tipo: TipoRemuneracao;
  valor: number;
  observacao?: string;
}

/** Lançamento mensal de um prestador */
export interface LancamentoPJ {
  prestadorId: string;
  year: number;
  month: number;
  status: StatusPagamento;
  dataPagamento?: string; // DD/MM/AAAA
  itens: LancamentoItem[];
  observacaoGeral?: string;
}

// ─── Chaves KV ────────────────────────────────────────────────────────────────

const PRESTADORES_KEY = 'rem_pj_prestadores';

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
  return {
    prestadorId: prestador.id,
    year,
    month,
    status: 'pendente',
    itens: prestador.itens.map(item => ({
      itemId: item.id,
      descricao: item.descricao,
      tipo: item.tipo,
      valor: item.tipo === 'fixa' ? (item.valorBase ?? 0) : 0,
    })),
  };
}

/** Helper: soma total de um lançamento */
export function totalLancamento(lanc: LancamentoPJ): number {
  return lanc.itens.reduce((s, i) => s + (i.valor || 0), 0);
}
