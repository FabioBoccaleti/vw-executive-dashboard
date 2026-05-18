import { kvGet, kvSet } from '@/lib/kvClient';

// Chave por aba: 'calculo_periodos_novos' | 'calculo_periodos_usados'
function key(tab: 'novos' | 'usados') {
  return `calculo_periodos_${tab}` as const;
}

export interface PeriodoApuracao {
  de:        string;   // YYYY-MM-DD
  ate:       string;   // YYYY-MM-DD
  bloqueado?: boolean;
}

// Chave interna do mapa: "2026-5"
export function periodoKey(year: number, month: number) {
  return `${year}-${month}`;
}

type PeriodoMap = Record<string, PeriodoApuracao>;

export async function loadPeriodos(tab: 'novos' | 'usados'): Promise<PeriodoMap> {
  try {
    const data = await kvGet(key(tab));
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as PeriodoMap;
    }
    return {};
  } catch {
    return {};
  }
}

export async function savePeriodo(
  tab: 'novos' | 'usados',
  year: number,
  month: number,
  periodo: PeriodoApuracao,
): Promise<void> {
  const current = await loadPeriodos(tab);
  current[periodoKey(year, month)] = periodo;
  await kvSet(key(tab), current);
}
