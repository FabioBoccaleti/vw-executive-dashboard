import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'provisao_piv_config';

// Configuração de rateio por período "YYYY-MM" (ou "YYYY" para ano-todo)
export interface ProvisaoPivConfig {
  // pctOficina salvo por período, ex: { "2026-05": "25", "2026": "30" }
  rateios: Record<string, string>;
}

function normalize(raw: unknown): ProvisaoPivConfig {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    return {
      rateios: r.rateios && typeof r.rateios === 'object' && !Array.isArray(r.rateios)
        ? (r.rateios as Record<string, string>)
        : {},
    };
  }
  return { rateios: {} };
}

export async function loadProvisaoPivConfig(): Promise<ProvisaoPivConfig> {
  try {
    const data = await kvGet(KEY);
    return normalize(data);
  } catch {
    return { rateios: {} };
  }
}

export async function saveProvisaoPivConfig(cfg: ProvisaoPivConfig): Promise<void> {
  try {
    await kvSet(KEY, cfg);
  } catch { /* ignore */ }
}

/** Retorna a chave do período: "YYYY-MM" ou "YYYY" quando mês é null */
export function periodoKey(year: number, month: number | null): string {
  return month === null ? String(year) : `${year}-${String(month).padStart(2, '0')}`;
}
