export function parseValorMonetario(value: string): number | null {
  const limpo = value.replace(/R\$|\s/g, '');
  if (!limpo) return null;
  const numero = Number(limpo.includes(',') || /^\d{1,3}(?:\.\d{3})+$/.test(limpo)
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatPercentLabel(value: string): string {
  return `${value.trim().replace(/\s*%+$/, '') || '0'}%`;
}

export function emCentavos(value: number): number {
  const centavos = Math.round((value + Number.EPSILON) * 100);
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(centavos)) {
    throw new Error('Informe um valor monetário válido.');
  }
  return centavos;
}

export function dataValida(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
