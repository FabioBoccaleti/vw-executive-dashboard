import { kvGet, kvSet } from '@/lib/kvClient';

// { "2026-4": { "NOME VENDEDOR": "12345" } }
export type FinanciamentoMatriculasMap = Record<string, Record<string, string>>;

const KV_KEY = 'financiamento:matriculas';

export async function loadFinanciamentoMatriculas(): Promise<FinanciamentoMatriculasMap> {
  return (await kvGet<FinanciamentoMatriculasMap>(KV_KEY)) ?? {};
}

export async function saveFinanciamentoMatriculas(map: FinanciamentoMatriculasMap): Promise<void> {
  await kvSet(KV_KEY, map);
}

const periodValue = (pk: string): number => {
  const [y, m] = pk.split('-').map(Number);
  return y * 12 + m;
};

/** Matrícula do mês anterior mais recente com valor preenchido (cópia automática). */
export function resolveFinanciamentoMatricula(
  map: FinanciamentoMatriculasMap,
  year: number,
  month: number,
  vendedor: string,
): string {
  const target = year * 12 + month;
  let best = '';
  let bestVal = -1;
  for (const [pk, rec] of Object.entries(map)) {
    if (!/^\d{4}-\d{1,2}$/.test(pk)) continue;
    const val = periodValue(pk);
    const mat = rec[vendedor];
    if (val < target && mat && mat.trim() && val > bestVal) {
      bestVal = val;
      best = mat;
    }
  }
  return best;
}
