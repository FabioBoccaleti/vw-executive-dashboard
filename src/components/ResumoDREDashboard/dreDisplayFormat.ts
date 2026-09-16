export function formatDreAmount(value: number): string {
  return Math.round(value).toLocaleString('pt-BR');
}

export function formatDreAmountOrDash(value: number): string {
  return value !== 0 ? formatDreAmount(value) : '—';
}
