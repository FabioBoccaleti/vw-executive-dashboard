import * as XLSX from 'xlsx';
import {
  DEPT_FIELDS,
  FIELD_LABELS,
  createEmptyBudgetVw,
  createEmptyBudgetAudi,
  type BudgetVwRow,
  type BudgetAudiRow,
  type DeptBudget,
  type VwDept,
  type AudiDept,
} from './projecoesStorage';

// ─── Mapa de abas ─────────────────────────────────────────────────────────────
// Nova estrutura: 1 aba por marca+departamento, meses como colunas

type SheetDef = {
  name:  string;
  brand: 'vw' | 'audi';
  dept:  VwDept | AudiDept;
};

const SHEET_DEFS: SheetDef[] = [
  { name: 'VW Novos',       brand: 'vw',   dept: 'novos'     },
  { name: 'VW Usados',      brand: 'vw',   dept: 'usados'    },
  { name: 'VW Direta',      brand: 'vw',   dept: 'direta'    },
  { name: 'VW Peças',       brand: 'vw',   dept: 'pecas'     },
  { name: 'VW Oficina',     brand: 'vw',   dept: 'oficina'   },
  { name: 'VW Funilaria',   brand: 'vw',   dept: 'funilaria' },
  { name: 'VW ADM',         brand: 'vw',   dept: 'adm'       },
  { name: 'Audi Novos',     brand: 'audi', dept: 'novos'     },
  { name: 'Audi Usados',    brand: 'audi', dept: 'usados'    },
  { name: 'Audi Peças',     brand: 'audi', dept: 'pecas'     },
  { name: 'Audi Oficina',   brand: 'audi', dept: 'oficina'   },
  { name: 'Audi Funilaria', brand: 'audi', dept: 'funilaria' },
  { name: 'Audi ADM',       brand: 'audi', dept: 'adm'       },
];

const MONTHS_FULL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// Chaves internas das colunas de mês — usadas no import para mapeamento
const MONTH_KEYS = Array.from({ length: 12 }, (_, i) => `m${String(i + 1).padStart(2, '0')}`);

// ─── Helper: constrói uma aba ─────────────────────────────────────────────────

function buildSheet(
  _def: SheetDef,
  getVal: (field: keyof DeptBudget, monthIdx: number) => string | number,
): XLSX.WorkSheet {
  const wsData: (string | number)[][] = [];

  // Linha 0 — cabeçalho visual (meses por extenso)
  wsData.push(['Campo', ...MONTHS_FULL]);

  // Linha 1 — chaves internas para import (NÃO apagar ao preencher)
  wsData.push(['__campo__', ...MONTH_KEYS]);

  // Linhas de dados
  for (const field of DEPT_FIELDS) {
    wsData.push([
      FIELD_LABELS[field],
      ...Array.from({ length: 12 }, (_, mi) => getVal(field, mi)),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 45 }, ...Array(12).fill({ wch: 13 })];
  return ws;
}

// ─── Exportar template vazio ──────────────────────────────────────────────────

export function exportBudgetTemplate(year: number): void {
  const wb = XLSX.utils.book_new();
  for (const def of SHEET_DEFS) {
    const ws = buildSheet(def, () => '');
    XLSX.utils.book_append_sheet(wb, ws, def.name);
  }
  XLSX.writeFile(wb, `Budget_${year}_Template.xlsx`);
}

// ─── Exportar com dados existentes ───────────────────────────────────────────

export function exportBudgetWithData(
  year: number,
  budgetVw:   (BudgetVwRow | null)[],
  budgetAudi: (BudgetAudiRow | null)[],
): void {
  const wb = XLSX.utils.book_new();
  for (const def of SHEET_DEFS) {
    const ws = buildSheet(def, (field, mi) => {
      if (def.brand === 'vw') {
        return budgetVw[mi]?.[def.dept as VwDept]?.[field] ?? '';
      } else {
        return budgetAudi[mi]?.[def.dept as AudiDept]?.[field] ?? '';
      }
    });
    XLSX.utils.book_append_sheet(wb, ws, def.name);
  }
  XLSX.writeFile(wb, `Budget_${year}.xlsx`);
}

// ─── Importar do Excel ────────────────────────────────────────────────────────

export interface ImportResult {
  vwRows:         BudgetVwRow[];
  audiRows:       BudgetAudiRow[];
  errors:         string[];
  monthsImported: number;
}

export function importBudgetFromExcel(file: File, year: number): Promise<ImportResult> {
  return new Promise(resolve => {
    const reader = new FileReader();

    reader.onload = e => {
      const errors: string[] = [];

      // Inicializa as 12 linhas vazias para ambas as marcas
      const vwAll   = Array.from({ length: 12 }, (_, i) => createEmptyBudgetVw(year, i + 1));
      const audiAll = Array.from({ length: 12 }, (_, i) => createEmptyBudgetAudi(year, i + 1));
      const monthsWithData = new Set<number>(); // índices 0-based

      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });

        // Mapeia rótulo → chave de campo
        const labelToField: Record<string, keyof DeptBudget> = {};
        for (const f of DEPT_FIELDS) labelToField[FIELD_LABELS[f]] = f;

        for (const def of SHEET_DEFS) {
          const ws = wb.Sheets[def.name];
          if (!ws) { errors.push(`Aba "${def.name}" não encontrada — ignorada`); continue; }

          const raw = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 }) as (string | number)[][];
          if (raw.length < 2) { errors.push(`Aba "${def.name}" sem dados`); continue; }

          // Linha 1 (índice 1): __campo__ | m01 | m02 | ...
          const keyRow = (raw[1] ?? []) as string[];
          const colForMonth: Record<number, number> = {}; // monthIdx(0-based) → colIdx
          keyRow.forEach((key, ci) => {
            const match = String(key).match(/^m(\d{2})$/);
            if (match) colForMonth[parseInt(match[1], 10) - 1] = ci;
          });

          // Linhas de dados a partir do índice 2
          for (let r = 2; r < raw.length; r++) {
            const rowData = raw[r] as (string | number)[];
            if (!rowData || !rowData[0]) continue;
            const campo = String(rowData[0]);
            if (campo === '__campo__') continue;
            const field = labelToField[campo];
            if (!field) continue;

            for (let mi = 0; mi < 12; mi++) {
              const ci = colForMonth[mi];
              if (ci === undefined) continue;
              const val = rowData[ci];
              if (val === undefined || val === null || val === '') continue;

              const strVal = String(val);
              if (def.brand === 'vw') {
                (vwAll[mi][def.dept as VwDept] as DeptBudget)[field] = strVal;
              } else {
                (audiAll[mi][def.dept as AudiDept] as DeptBudget)[field] = strVal;
              }
              monthsWithData.add(mi);
            }
          }
        }
      } catch (err) {
        errors.push(`Erro ao processar arquivo: ${String(err)}`);
      }

      // Retorna apenas os meses que receberam pelo menos um valor
      resolve({
        vwRows:         vwAll.filter((_, i) => monthsWithData.has(i)),
        audiRows:       audiAll.filter((_, i) => monthsWithData.has(i)),
        errors,
        monthsImported: monthsWithData.size,
      });
    };

    reader.onerror = () =>
      resolve({ vwRows: [], audiRows: [], errors: ['Erro ao ler arquivo'], monthsImported: 0 });

    reader.readAsArrayBuffer(file);
  });
}
