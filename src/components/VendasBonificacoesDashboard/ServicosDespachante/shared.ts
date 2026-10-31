import type { DespachanteMarca } from './storage';

export const DESPACHANTE_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const DESPACHANTE_WEEKS = [1, 2, 3, 4, 5];

export const MARCA_LABEL: Record<DespachanteMarca, string> = { vw: 'VW', audi: 'Audi' };

/** Colunas de texto (as demais são tratadas como monetárias). */
export const TEXT_LABELS = new Set([
  'processo', 'loja', 'nome', 'placa', 'chassi', 'ficha', 'municipio', 'atualmunicipio',
]);

export function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

/** Converte " R$ 2,005.30 " (formato do relatório) para número; "-" e vazio viram 0. */
export function parseMoney(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? '')
    .replace(/r\$/i, '')
    .replace(/\s/g, '')
    .replace(/,/g, '');
  if (cleaned === '' || cleaned === '-') return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

type Row = Record<string, string | number>;

export function sumNumeric(rows: Row[], numericHeaders: string[]): Record<string, number> {
  const totals: Record<string, number> = {};
  numericHeaders.forEach(header => { totals[header] = 0; });
  rows.forEach(row => {
    numericHeaders.forEach(header => { totals[header] += Number(row[header] ?? 0); });
  });
  return totals;
}

export interface LojaGroup {
  loja: string;
  rows: Row[];
  totals: Record<string, number>;
}

/** Agrupa as linhas por LOJA, com subtotais, e devolve também o total geral. */
export function groupByLoja(rows: Row[], numericHeaders: string[]): { groups: LojaGroup[]; totals: Record<string, number> } {
  const map = new Map<string, Row[]>();
  rows.forEach(row => {
    const loja = String(row['LOJA'] ?? '—').trim() || '—';
    if (!map.has(loja)) map.set(loja, []);
    map.get(loja)!.push(row);
  });
  const groups = [...map.entries()]
    .map(([loja, groupRows]) => ({ loja, rows: groupRows, totals: sumNumeric(groupRows, numericHeaders) }))
    .sort((left, right) => left.loja.localeCompare(right.loja, 'pt-BR'));
  return { groups, totals: sumNumeric(rows, numericHeaders) };
}
