import { kvGet, kvSet } from '@/lib/kvClient';

/** Alíquota de impostos — valor único global (percentual). */
const ALIQUOTA_KEY = 'financiamento_analise:aliquota';

/** Dedução lançada por mês, separada por Novos e Usados. */
function deducaoKey(year: number, month: number): string {
  return `financiamento_analise:deducao:${year}:${String(month).padStart(2, '0')}`;
}

export interface AnaliseDeducao {
  novos: number;
  usados: number;
}

function toNumber(v: unknown): number {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

export async function getAnaliseAliquota(): Promise<number> {
  try {
    const v = await kvGet<number>(ALIQUOTA_KEY);
    return toNumber(v);
  } catch {
    return 0;
  }
}

export async function setAnaliseAliquota(pct: number): Promise<void> {
  await kvSet(ALIQUOTA_KEY, pct);
}

export async function getAnaliseDeducao(year: number, month: number): Promise<AnaliseDeducao> {
  try {
    const v = await kvGet<unknown>(deducaoKey(year, month));
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      return { novos: toNumber(o.novos), usados: toNumber(o.usados) };
    }
    // Compatibilidade com o formato antigo (valor único) — considera como Novos.
    if (typeof v === 'number' && isFinite(v)) return { novos: v, usados: 0 };
    return { novos: 0, usados: 0 };
  } catch {
    return { novos: 0, usados: 0 };
  }
}

export async function setAnaliseDeducao(year: number, month: number, valor: AnaliseDeducao): Promise<void> {
  await kvSet(deducaoKey(year, month), valor);
}
