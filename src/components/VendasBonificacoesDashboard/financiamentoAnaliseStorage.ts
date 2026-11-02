import { kvGet, kvSet } from '@/lib/kvClient';

/** Alíquota de impostos — valor único global (percentual). */
const ALIQUOTA_KEY = 'financiamento_analise:aliquota';

/** Dedução lançada por mês. */
function deducaoKey(year: number, month: number): string {
  return `financiamento_analise:deducao:${year}:${String(month).padStart(2, '0')}`;
}

export async function getAnaliseAliquota(): Promise<number> {
  try {
    const v = await kvGet<number>(ALIQUOTA_KEY);
    return typeof v === 'number' && isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export async function setAnaliseAliquota(pct: number): Promise<void> {
  await kvSet(ALIQUOTA_KEY, pct);
}

export async function getAnaliseDeducao(year: number, month: number): Promise<number> {
  try {
    const v = await kvGet<number>(deducaoKey(year, month));
    return typeof v === 'number' && isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export async function setAnaliseDeducao(year: number, month: number, valor: number): Promise<void> {
  await kvSet(deducaoKey(year, month), valor);
}
