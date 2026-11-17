export const MODELO_NAO_INFORMADO = 'Não informado';

/**
 * Remove prefixos NOVO/NOVA e códigos de concessionária e preserva o nome base.
 */
export function normalizarModelo(desModelo: string): string {
  const raw = (desModelo ?? '').trim();
  if (!raw) return MODELO_NAO_INFORMADO;

  const tokens = raw.toUpperCase().replace(/\s+/g, ' ').trim().split(' ');
  const isCodigo = (t: string) => /\d/.test(t) && /[A-Z]/.test(t);

  while (tokens.length > 1) {
    const t = tokens[0];
    if (t === 'NOVO' || t === 'NOVA' || t === '-' || t === '' || isCodigo(t)) tokens.shift();
    else break;
  }

  const base = (tokens[0] ?? '').replace(/^[^A-Z0-9]+/, '').replace(/[^A-Z0-9-]+$/, '');
  return base || MODELO_NAO_INFORMADO;
}
