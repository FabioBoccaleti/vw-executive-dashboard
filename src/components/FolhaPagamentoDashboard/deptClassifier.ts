/**
 * Classificação de departamentos para análise de salários fixos.
 * Regras definidas pela gestão — ordem de prioridade importa.
 */

export type GrupoDept =
  | 'Afastados'
  | 'Diretoria'
  | 'Administração'
  | 'Funilaria'
  | 'Oficina'
  | 'Usados'
  | 'Novos'
  | 'Peças'
  | 'Outros';

export const GRUPO_COLORS: Record<GrupoDept, string> = {
  Afastados:     '#94a3b8', // slate
  Diretoria:     '#7c3aed', // violet
  Administração: '#2563eb', // blue
  Funilaria:     '#d97706', // amber
  Oficina:       '#059669', // emerald
  Usados:        '#0891b2', // cyan
  Novos:         '#16a34a', // green
  Peças:         '#dc2626', // red
  Outros:        '#6b7280', // gray
};

export const GRUPO_ORDER: GrupoDept[] = [
  'Novos', 'Usados', 'Peças', 'Oficina', 'Funilaria',
  'Administração', 'Diretoria', 'Afastados', 'Outros',
];

function has(dept: string, ...terms: string[]): boolean {
  const d = dept.toLowerCase();
  return terms.some(t => d.includes(t.toLowerCase()));
}

/**
 * Mapeia o nome bruto do departamento (vindo do TXT) para um grupo analítico.
 * Prioridade: Afastados > Diretoria > Funilaria > Oficina >
 *             Usados > Novos > Peças > Administração > Outros
 *
 * "adm" vem por ÚLTIMO entre os grupos específicos: o TXT pode prefixar
 * qualquer seção com "ADM" (ex: "ADM V.Usados", "ADM Peças"),
 * então só classifica como Administração se nenhum outro termo específico bater.
 */
export function classifyDept(dept: string): GrupoDept {
  if (!dept?.trim()) return 'Outros';

  // 1. Afastados — SEMPRE prevalece
  if (has(dept, 'afastado')) return 'Afastados';

  // 2. Diretoria — "ADM + Diretoria" ou só "Diretoria"
  if (has(dept, 'diretoria')) return 'Diretoria';

  // 3. Funilaria — vem antes de Oficina
  if (has(dept, 'funilaria')) return 'Funilaria';

  // 4. Oficina — A.Tec. ou Express. (só NÃO é Oficina se tiver "funilaria")
  if (has(dept, 'a.tec.', 'express.')) return 'Oficina';

  // 5. Usados — ANTES do "adm" para evitar "ADM V.Usados" virar Administração
  if (has(dept, 'v.usados', 'v. usados', 'usados')) return 'Usados';

  // 6. Novos — ANTES do "adm"
  if (has(dept, 'v.novos', 'v. novos', 'frotista', 'consorcio', 'consórcio', 'v.audi pin')) return 'Novos';

  // 7. Peças — ANTES do "adm" para evitar "ADM Peças" virar Administração
  if (has(dept, 'peças', 'pecas', 'peca')) return 'Peças';

  // 8. Administração — somente ADM sem nenhuma categoria específica acima
  if (has(dept, 'adm')) return 'Administração';

  return 'Outros';
}
