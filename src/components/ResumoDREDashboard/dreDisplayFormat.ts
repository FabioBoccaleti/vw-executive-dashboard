export function parseDreValue(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const text = String(value).trim();
  if (!text) return 0;
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDreAmount(value: number): string {
  return Math.round(value).toLocaleString('pt-BR');
}

export function formatDreAmountOrDash(value: number): string {
  return value !== 0 ? formatDreAmount(value) : '—';
}
