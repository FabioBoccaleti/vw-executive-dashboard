import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'calculo_pos_vendas_remuneracoes';

export interface CalculoPosVendasRemuneracao {
  id: string;
  periodo: string; // YYYY-M
  vendedor: string;
  comissionado: boolean;
  salarioFixo: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
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
      comissionado: Boolean(item.comissionado),
      salarioFixo: String(item.salarioFixo ?? ''),
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