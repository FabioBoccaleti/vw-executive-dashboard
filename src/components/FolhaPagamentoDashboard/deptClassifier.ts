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
 * Prioridade: Afastados > Diretoria > Administração > Funilaria > Oficina >
 *             Usados > Novos > Peças > Outros
 */
export function classifyDept(dept: string): GrupoDept {
  if (!dept?.trim()) return 'Outros';

  // 1. Afastados — SEMPRE prevalece
  if (has(dept, 'afastado')) return 'Afastados';

  // 2. Diretoria — "ADM + Diretoria" ou só "Diretoria"
  if (has(dept, 'diretoria')) return 'Diretoria';

  // 3. Administração — ADM sem Diretoria e sem Afastado
  if (has(dept, 'adm')) return 'Administração';

  // 4. Funilaria (antes de Oficina — A.Tec. com funilaria = Funilaria)
  if (has(dept, 'funilaria')) return 'Funilaria';

  // 5. Oficina — A.Tec. (sem funilaria, já tratado acima) ou Express.
  if (has(dept, 'a.tec.', 'express.')) return 'Oficina';

  // 6. Usados
  if (has(dept, 'v.usados', 'v. usados')) return 'Usados';

  // 7. Novos — V.Novos, V. Novos, Frotista, Consorcio/Consórcio, V.Audi Pin
  if (has(dept, 'v.novos', 'v. novos', 'frotista', 'consorcio', 'consórcio', 'v.audi pin')) return 'Novos';

  // 8. Peças
  if (has(dept, 'peças', 'pecas', 'peca')) return 'Peças';

  return 'Outros';
}
