import { kvGet, kvSet } from '@/lib/kvClient';
import * as pdfjsLib from 'pdfjs-dist';

// Worker configurado uma única vez para este módulo
let _workerConfigured = false;
function ensurePdfjsWorker() {
  if (_workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href;
  _workerConfigured = true;
}

/**
 * Extrai o texto de um PDF de salários fixos e o converte para o mesmo
 * formato de string que o parser TXT espera, então reutiliza parseSalariosTxt.
 *
 * O PDF gerado pelo sistema possui texto nativo (não é scan), portanto
 * o pdfjs consegue extrair as linhas diretamente.
 * A extração agrupa itens pelo eixo Y (linha visual) e os ordena por X
 * (posição horizontal), reproduzindo a estrutura de colunas do relatório.
 */
export async function parseSalariosPdf(file: File): Promise<ParsedSalarios[]> {
  ensurePdfjsWorker();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page    = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    // Agrupa itens por linha (Y arredondado com tolerância de 3px)
    const byY = new Map<number, { x: number; width: number; str: string }[]>();
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const str   = (item as { str: string }).str;
      if (!str.trim()) continue;
      const t     = (item as { transform: number[]; width: number }).transform;
      const width = (item as { width: number }).width ?? 0;
      const y     = Math.round((viewport.height - t[5]) / 3) * 3;
      const x     = t[4];
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y)!.push({ x, width, str });
    }

    // Ordena linhas por Y crescente e itens dentro de cada linha por X
    const sortedYs = Array.from(byY.keys()).sort((a, b) => a - b);
    for (const y of sortedYs) {
      const items = byY.get(y)!.sort((a, b) => a.x - b.x);
      // Reconstrói a linha usando o gap real entre itens para determinar separador:
      // gap ≤ 10px → palavras do mesmo campo (ex: "Audi" + "Lapa") → 1 espaço
      // gap > 10px → separação de colunas                          → 3 espaços
      // O parser TXT usa 2+ espaços como delimitador de coluna, então 3 espaços
      // garante que ele reconheça as colunas corretamente.
      let line = items[0].str;
      for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1];
        const curr = items[i];
        const gap  = curr.x - (prev.x + prev.width);
        line += gap <= 10 ? ' ' : '   ';
        line += curr.str;
      }
      allLines.push(line);
    }
  }

  // Corrige artefato de PDF: letras maiúsculas isoladas separadas por espaço
  // da sílaba seguinte (ex: "A udi Lapa" → "Audi Lapa").
  // Aplica-se apenas à string completa antes de passar ao parser TXT.
  const fullText = allLines.join('\n').replace(/\b([A-Z]) ([a-z])/g, '$1$2');

  return parseSalariosTxt(fullText);
}

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

export async function updateSalarioFuncionario(
  brand: SalarioBrand,
  year: number,
  month: number,
  id: string,
  updates: { cargo?: string; departamento?: string; salario?: string },
): Promise<boolean> {
  try {
    const existing = await loadSalariosFixos(brand, year, month);
    const updated  = existing.map(e => e.id === id ? { ...e, ...updates } : e);
    return await kvSet(getKey(brand, year, month), updated);
  } catch {
    return false;
  }
}

export async function addSalarioFuncionario(
  brand: SalarioBrand,
  year: number,
  month: number,
  employee: SalarioFuncionario,
): Promise<boolean> {
  try {
    const existing = await loadSalariosFixos(brand, year, month);
    return await kvSet(getKey(brand, year, month), [...existing, employee]);
  } catch {
    return false;
  }
}

export async function deleteSalarioFuncionario(
  brand: SalarioBrand,
  year: number,
  month: number,
  id: string,
): Promise<boolean> {
  try {
    const existing = await loadSalariosFixos(brand, year, month);
    return await kvSet(getKey(brand, year, month), existing.filter(e => e.id !== id));
  } catch {
    return false;
  }
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

/**
 * Retorna o período (ano/mês) mais recente que tenha dados importados.
 * Varre as chaves salarios_fixos_* e pega a mais recente com array não vazio.
 */
export async function findLatestSalariosPeriod(): Promise<{ year: number; month: number } | null> {
  try {
    const { kvKeys } = await import('@/lib/kvClient');
    const keys = await kvKeys('salarios_fixos_*');
    // Formato: salarios_fixos_{brand}_{year}_{mm}
    const periods: { year: number; month: number }[] = [];
    for (const key of keys) {
      const m = key.match(/^salarios_fixos_(?:audi|vw)_(\d{4})_(\d{2})$/);
      if (!m) continue;
      periods.push({ year: parseInt(m[1]), month: parseInt(m[2]) });
    }
    if (periods.length === 0) return null;
    // Remove duplicatas e ordena decrescente
    const unique = Array.from(
      new Map(periods.map(p => [`${p.year}_${p.month}`, p])).values(),
    ).sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
    // Valida que o período mais recente tem dados de fato não vazios
    for (const p of unique) {
      const [audi, vw] = await Promise.all([
        loadSalariosFixos('audi', p.year, p.month),
        loadSalariosFixos('vw',   p.year, p.month),
      ]);
      if (audi.length > 0 || vw.length > 0) return p;
    }
    return null;
  } catch {
    return null;
  }
}
