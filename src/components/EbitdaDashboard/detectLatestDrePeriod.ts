/**
 * Detecta o último período (ano/mês) com dados alimentados na DRE VW.
 * Mesma estratégia usada pelo Resumo DRE: prioriza a Base Gerencial, depois o
 * Dashboard Executivo e, por fim, as chaves salvas manualmente.
 */

import { kvKeys } from '@/lib/kvClient';
import { loadDREDataAsync } from '@/lib/dbStorage';

const CURRENT_YEAR = new Date().getFullYear();

export async function detectLatestVwDrePeriod(): Promise<{ year: number; month: number } | null> {
  const yearsToCheck = [CURRENT_YEAR, CURRENT_YEAR - 1];

  for (const yr of yearsToCheck) {
    // Estratégia 1: último mês importado na Base Gerencial.
    try {
      const keys = await kvKeys('basege:*');
      const months = keys
        .filter(key => key.startsWith(`basege:${yr}:M`))
        .map(key => {
          const match = key.match(/:M(\d{2})$/);
          return match ? Number(match[1]) : 0;
        })
        .filter(m => m >= 1 && m <= 12);
      if (months.length > 0) return { year: yr, month: Math.max(...months) };
    } catch {}

    // Estratégia 2: dados do Dashboard Executivo (vw_dre_YYYY_novos).
    try {
      const dreData = await loadDREDataAsync(yr as 2024 | 2025 | 2026 | 2027, 'novos', 'vw');
      if (dreData && dreData.length > 0) {
        let lastMonth = 0;
        for (let m = 0; m < 12; m++) {
          const hasData = dreData.some(line => {
            const vals: number[] = (line as any).meses || (line as any).values || [];
            return vals[m] !== undefined && vals[m] !== 0;
          });
          if (hasData) lastMonth = m + 1;
        }
        if (lastMonth > 0) return { year: yr, month: lastMonth };
      }
    } catch {}

    // Estratégia 3: chaves salvas manualmente (resumo_dre:vw:YYYY-MM).
    try {
      const keys = await kvKeys('resumo_dre:vw:*');
      const yearStr = String(yr);
      const months = keys
        .filter(k => k.includes(`:${yearStr}-`))
        .map(k => { const m = k.match(/(\d{4})-(\d{2})$/); return m ? parseInt(m[2]) : 0; })
        .filter(m => m >= 1 && m <= 12);
      if (months.length > 0) return { year: yr, month: Math.max(...months) };
    } catch {}
  }

  return null;
}
