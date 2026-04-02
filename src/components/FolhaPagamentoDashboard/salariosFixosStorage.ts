import { kvGet, kvSet } from '@/lib/kvClient';

export type SalarioBrand = 'audi' | 'vw';

export interface SalarioFuncionario {
  id: string;
  codigo: string;
  nome: string;
  dataAdmissao: string; // DD/MM/YYYY from TXT
  cargo: string;
  salario: string;      // numeric string, e.g. "2835"
  departamento: string;
  revenda: string;      // e.g. "Audi Lapa", "B.L 295"
}

export interface ParsedSalarios {
  brand: SalarioBrand;
  year: number;
  month: number;
  revenda: string;
  employees: SalarioFuncionario[];
}

// ── Key pattern ───────────────────────────────────────────────────────────────
function getKey(brand: SalarioBrand, year: number, month: number): string {
  const mm = String(month).padStart(2, '0');
  return `salarios_fixos_${brand}_${year}_${mm}`;
}

// ── Company → Brand mapping ───────────────────────────────────────────────────
const REVENDA_BRAND_MAP: Array<{ pattern: string; brand: SalarioBrand; label: string }> = [
  { pattern: 'Audi Lapa',  brand: 'audi', label: 'Audi Lapa'  },
  { pattern: 'Pinheiros',  brand: 'audi', label: 'Pinheiros'  },
  { pattern: 'Luiz Gatti', brand: 'audi', label: 'Luiz Gatti' },
  { pattern: 'B.L 295',    brand: 'vw',   label: 'B.L 295'    },
  { pattern: 'S.L 88',     brand: 'vw',   label: 'S.L 88/192' },
];

// ── TXT Parser — suporta múltiplas seções (Audi + VW no mesmo arquivo) ────────
type Section = {
  brand: SalarioBrand;
  revendaLabel: string;
  year: number;
  month: number;
  currentDept: string;
  employees: SalarioFuncionario[];
};

export function parseSalariosTxt(text: string): ParsedSalarios[] {
  const lines    = text.split('\n');
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;

    // ── Nova seção ou continuação de página: linha com 'Sorana -' ──────────
    if (rawLine.includes('Sorana -')) {
      const revendaMatch = rawLine.match(/Sorana\s*-\s*(.+?)(?:\s{3,}|$)/);
      if (revendaMatch) {
        const name = revendaMatch[1].trim();
        let foundBrand: SalarioBrand | null = null;
        let foundLabel = '';
        for (const mapping of REVENDA_BRAND_MAP) {
          if (name.includes(mapping.pattern)) {
            foundBrand = mapping.brand;
            foundLabel = mapping.label;
            break;
          }
        }
        if (foundBrand) {
          const dateMatches = [...rawLine.matchAll(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g)];
          let month = 0, year = 0;
          if (dateMatches.length > 0) {
            const last = dateMatches[dateMatches.length - 1];
            month = parseInt(last[2], 10);
            year  = parseInt(last[3], 10);
          }
          // Se já existe seção para esta revenda+período, é quebra de página:
          // reutiliza a seção existente para preservar o departamento atual.
          const existing = sections.find(s =>
            s.brand === foundBrand &&
            s.revendaLabel === foundLabel &&
            (month === 0 || (s.year === year && s.month === month)),
          );
          if (existing) {
            current = existing;
          } else {
            current = { brand: foundBrand, revendaLabel: foundLabel, year, month, currentDept: '', employees: [] };
            sections.push(current);
          }
        }
      }
      continue;
    }

    if (!current) continue;

    // ── Linhas de totais — ignorar ────────────────────────────────────────────
    if (/^\s*Total\s+do\(/i.test(rawLine)) continue;
    if (/^\s*Total\s+Geral/i.test(rawLine)) continue;

    // ── Linha de funcionário: tem data DD/MM/YYYY E salário ───────────────────
    const empMatch = rawLine.match(
      /^\s*(\d+)\s{2,}(.+?)\s{2,}(\d{2}\/\d{2}\/\d{4})\s{2,}(.+?)\s{2,}(?:\d+\s{2,})?(\d[\d.]*,\d{2})\s*$/,
    );
    if (empMatch) {
      const raw = empMatch[5].replace(/\./g, '').replace(',', '.');
      const salarioNum = parseFloat(raw);
      current.employees.push({
        id: crypto.randomUUID(),
        codigo:       empMatch[1].trim(),
        nome:         empMatch[2].trim(),
        dataAdmissao: empMatch[3].trim(),
        cargo:        empMatch[4].trim(),
        salario:      isNaN(salarioNum) ? '0' : String(salarioNum),
        departamento: current.currentDept,
        revenda:      current.revendaLabel,
      });
      continue;
    }

    // ── Cabeçalho de departamento: código + nome (sem data, sem salário) ──────
    const deptMatch = rawLine.match(/^\s*(\d+)\s{2,}([A-Za-zÀ-ÿ][\w\s/\-.()]*?)\s*$/);
    if (
      deptMatch &&
      !/\d{2}\/\d{2}\/\d{4}/.test(rawLine) &&
      !/[\d.]+,\d{2}/.test(rawLine)
    ) {
      current.currentDept = deptMatch[2].trim();
    }
  }

  return sections
    .filter(s => s.employees.length > 0 && s.year > 0 && s.month > 0)
    .map(s => ({ brand: s.brand, year: s.year, month: s.month, revenda: s.revendaLabel, employees: s.employees }));
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function loadSalariosFixos(
  brand: SalarioBrand,
  year: number,
  month: number,
): Promise<SalarioFuncionario[]> {
  try {
    const data = await kvGet<SalarioFuncionario[]>(getKey(brand, year, month));
    return data ?? [];
  } catch {
    return [];
  }
}

export async function saveSalariosFixos(
  brand: SalarioBrand,
  year: number,
  month: number,
  revenda: string,
  newEmployees: SalarioFuncionario[],
): Promise<boolean> {
  try {
    const existing = await loadSalariosFixos(brand, year, month);
    // Replace records from THIS revenda, keep records from other revendas
    const filtered = existing.filter(e => e.revenda !== revenda);
    const merged   = [...filtered, ...newEmployees];
    return await kvSet(getKey(brand, year, month), merged);
  } catch {
    return false;
  }
}

/**
 * Importa todas as seções de um arquivo (pode conter Audi + VW).
 * Substitui TODOS os dados de cada brand+mês+ano encontrado no arquivo.
 */
export async function saveAllParsedSalarios(sections: ParsedSalarios[]): Promise<{ brand: SalarioBrand; count: number; revenda: string }[]> {
  // Agrupa por brand+year+month e acumula todos os funcionários
  const grouped = new Map<string, ParsedSalarios & { allEmployees: SalarioFuncionario[] }>();
  for (const s of sections) {
    const key = `${s.brand}_${s.year}_${s.month}`;
    if (!grouped.has(key)) {
      grouped.set(key, { ...s, allEmployees: [] });
    }
    grouped.get(key)!.allEmployees.push(...s.employees);
  }

  const results: { brand: SalarioBrand; count: number; revenda: string }[] = [];
  await Promise.all(
    Array.from(grouped.values()).map(async g => {
      try {
        await kvSet(getKey(g.brand, g.year, g.month), g.allEmployees);
        results.push({ brand: g.brand, count: g.allEmployees.length, revenda: g.revenda });
      } catch { /* continua */ }
    }),
  );
  return results;
}

export async function clearSalariosFixos(
  brand: SalarioBrand,
  year: number,
  month: number,
): Promise<boolean> {
  try {
    return await kvSet(getKey(brand, year, month), []);
  } catch {
    return false;
  }
}
