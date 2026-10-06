import { loadAllDreVw, loadDreVw, type DreVwRow } from '../ResumoDREDashboard/dreVwStorage';
import { loadAllDreAudi, loadDreAudi, type DreAudiRow } from '../ResumoDREDashboard/dreAudiStorage';
import { loadCanonicalVwRow, loadCanonicalAudiRow } from '../ResumoDREDashboard/canonicalDreSource';

/**
 * Carrega o Real (DRE) de um ano usando a MESMA fonte do Resumo DRE: o snapshot
 * canônico da Base Gerencial, caindo nas strings cruas do KV apenas como
 * fallback (importação manual via Card VW / Card Audi).
 *
 * Isso garante que a Análise de Projeções apresente exatamente os mesmos números
 * do Resumo DRE e no mesmo formato, independentemente de como os dados foram
 * importados (Base Gerencial ou manualmente).
 */

function hasVwDeptData(row: DreVwRow): boolean {
  const depts = ['novos', 'usados', 'direta', 'pecas', 'oficina', 'funilaria', 'adm'] as const;
  return depts.some(d => Object.values(row[d]).some(v => v !== '' && v !== '0'));
}

function hasAudiDeptData(row: DreAudiRow): boolean {
  const depts = ['novos', 'usados', 'pecas', 'oficina', 'funilaria', 'adm'] as const;
  return depts.some(d => Object.values(row[d]).some(v => v !== '' && v !== '0'));
}

export async function loadAllRealVw(year: number): Promise<(DreVwRow | null)[]> {
  const fallbacks = await loadAllDreVw(year);
  return Promise.all(
    Array.from({ length: 12 }, async (_, i) => {
      const month = i + 1;
      const fallback = fallbacks[i] ?? (await loadDreVw(year, month));
      const row = await loadCanonicalVwRow(year, month, fallback);
      return hasVwDeptData(row) ? row : null;
    }),
  );
}

export async function loadAllRealAudi(year: number): Promise<(DreAudiRow | null)[]> {
  const fallbacks = await loadAllDreAudi(year);
  return Promise.all(
    Array.from({ length: 12 }, async (_, i) => {
      const month = i + 1;
      const fallback = fallbacks[i] ?? (await loadDreAudi(year, month));
      const row = await loadCanonicalAudiRow(year, month, fallback);
      return hasAudiDeptData(row) ? row : null;
    }),
  );
}
