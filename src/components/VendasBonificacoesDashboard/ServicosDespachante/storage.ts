import { kvDelete, kvGet, kvKeys, kvSet } from '@/lib/kvClient';

export type DespachanteCategory = 'novos' | 'usados';
export type DespachanteMarca = 'vw' | 'audi';

/** Dados de uma aba (marca) do arquivo semanal já tratados. */
export interface DespachanteMarcaData {
  marca: DespachanteMarca;
  sheetName: string;
  titulo: string;
  /** Data de vencimento extraída do título (dd/mm/aaaa), quando disponível. */
  vencimento: string | null;
  /** Rótulos das colunas na ordem original (já sem colunas vazias/trailing). */
  headers: string[];
  /** Subconjunto de `headers` que corresponde a valores monetários. */
  numericHeaders: string[];
  /** Linhas de dados; colunas de texto como string e monetárias como número. */
  rows: Array<Record<string, string | number>>;
}

/** Conteúdo importado de uma semana (um arquivo com as abas VW e Audi). */
export interface DespachanteWeekData {
  category: DespachanteCategory;
  year: number;
  /** Mês 1-12. */
  month: number;
  /** Semana do mês 1-5. */
  week: number;
  fileName: string;
  importedAt: string;
  marcas: DespachanteMarcaData[];
}

const mm = (month: number) => String(month).padStart(2, '0');

const keyFor = (category: DespachanteCategory, year: number, month: number, week: number) =>
  `despachante:${category}:${year}:M${mm(month)}:S${week}`;

export async function getDespachanteWeek(
  category: DespachanteCategory,
  year: number,
  month: number,
  week: number,
) {
  return kvGet<DespachanteWeekData>(keyFor(category, year, month, week));
}

export async function setDespachanteWeek(data: DespachanteWeekData) {
  return kvSet(keyFor(data.category, data.year, data.month, data.week), data);
}

export async function deleteDespachanteWeek(
  category: DespachanteCategory,
  year: number,
  month: number,
  week: number,
) {
  return kvDelete(keyFor(category, year, month, week));
}

/** Semanas (1-5) já importadas para a categoria/mês, em ordem crescente. */
export async function listDespachanteWeeks(
  category: DespachanteCategory,
  year: number,
  month: number,
): Promise<number[]> {
  const keys = await kvKeys(`despachante:${category}:${year}:M${mm(month)}:S*`);
  return keys
    .map(key => {
      const match = key.match(/:S(\d+)$/);
      return match ? Number(match[1]) : null;
    })
    .filter((week): week is number => week !== null)
    .sort((left, right) => left - right);
}

/** Todas as semanas importadas da categoria/mês, ordenadas por semana. */
export async function getDespachanteMonth(
  category: DespachanteCategory,
  year: number,
  month: number,
): Promise<DespachanteWeekData[]> {
  const weeks = await listDespachanteWeeks(category, year, month);
  const result: DespachanteWeekData[] = [];
  for (const week of weeks) {
    const data = await getDespachanteWeek(category, year, month, week);
    if (data) result.push(data);
  }
  return result;
}
