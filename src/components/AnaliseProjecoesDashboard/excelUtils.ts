import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
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

export type ExcelRowStyle = {
  isTotal?: boolean;
  isSubtotal?: boolean;
  isBold?: boolean;
  isPct?: boolean;
  indent?: boolean;
  separator?: boolean;
};

export interface StyledExcelTableOptions {
  fileName: string;
  sheetName: string;
  title: string;
  subtitle?: string;
  meta?: string;
  headers: string[];
  rows: Array<{ values: (string | number | null)[] } & ExcelRowStyle>;
  columnWidths: number[];
  accentColor?: string;
}

const BRL_FMT = '#,##0';

function toArgb(color: string): string {
  const hex = color.replace('#', '').toUpperCase();
  return hex.length === 8 ? hex : `FF${hex}`;
}

async function writeStyledWorkbook(options: StyledExcelTableOptions): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();

  const accentColor = options.accentColor ?? '#001e50';
  const accentArgb = toArgb(accentColor);
  const ws = wb.addWorksheet(options.sheetName, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
    properties: { tabColor: { argb: accentArgb } },
  });

  ws.columns = options.columnWidths.map(width => ({ width }));

  const rowCount = options.headers.length;

  const titleRow = ws.addRow([options.title]);
  ws.mergeCells(1, 1, 1, rowCount);
  titleRow.height = 24;
  titleRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    cell.font = { bold: true, size: 12, color: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  const subtitleRow = ws.addRow([options.subtitle ?? '']);
  ws.mergeCells(2, 1, 2, rowCount);
  subtitleRow.height = 20;
  subtitleRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    cell.font = { size: 10.5, color: { argb: 'FF475569' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  const metaRow = ws.addRow([options.meta ?? '']);
  ws.mergeCells(3, 1, 3, rowCount);
  metaRow.height = 18;
  metaRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    cell.font = { size: 9, color: { argb: 'FF64748B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  ws.addRow([]);

  const headerRow = ws.addRow(options.headers);
  headerRow.height = 22;
  headerRow.eachCell((cell, ci) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accentArgb } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9.5 };
    cell.alignment = {
      vertical: 'middle',
      horizontal: ci === 1 ? 'left' : 'right',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: accentArgb } },
      bottom: { style: 'thin', color: { argb: accentArgb } },
      left: { style: 'thin', color: { argb: accentArgb } },
      right: { style: 'thin', color: { argb: accentArgb } },
    };
  });

  const thinBorder = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const lightBg = 'FFF8FAFC';

  options.rows.forEach((row, index) => {
    if (row.separator) {
      const sep = ws.addRow(Array(rowCount).fill(''));
      sep.height = 5;
      sep.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      });
      return;
    }

    const values = row.values.map(value => value ?? '—');
    const dr = ws.addRow(values);
    dr.height = row.isTotal ? 20 : row.isSubtotal ? 18 : 17;

    const bg = row.isTotal ? accentColor : row.isSubtotal ? lightBg : index % 2 === 0 ? '#FFFFFF' : 'FFFDFEFF';
    dr.eachCell({ includeEmpty: true }, (cell, ci) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(bg) } };
      cell.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

      const isFirst = ci === 1;
      const text = String(cell.value ?? '');
      if (isFirst) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        cell.font = {
          size: 9.5,
          bold: !!(row.isTotal || row.isSubtotal || row.isBold),
          italic: !!row.isPct && !row.isTotal,
          color: { argb: row.isTotal ? 'FFFFFFFF' : row.isSubtotal ? 'FF0F172A' : 'FF334155' },
        };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: false };
        cell.font = {
          size: 9.5,
          bold: !!row.isTotal,
          italic: !!row.isPct && !row.isTotal,
          color: { argb: row.isTotal ? 'FFFFFFFF' : row.isSubtotal ? 'FF0F172A' : 'FF334155' },
        };
      }

      if (row.indent && isFirst) {
        cell.value = `· ${text}`;
      }
      if (row.isTotal) {
        cell.font = { ...cell.font, bold: true, color: { argb: 'FFFFFFFF' } };
      }
    });
  });

  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: rowCount } };

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    options.fileName,
  );
}

export async function exportStyledExcelTable(options: StyledExcelTableOptions): Promise<void> {
  await writeStyledWorkbook(options);
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

// ─── Exportar a tabela visível atual para Excel ──────────────────────────────

function normalizeTableCloneForExcel(table: HTMLTableElement): HTMLTableElement {
  const clone = table.cloneNode(true) as HTMLTableElement;

  clone.querySelectorAll('input').forEach(input => {
    const value = (input as HTMLInputElement).value;
    const parentCell = input.closest('td, th');
    if (parentCell) parentCell.textContent = value || '—';
  });

  return clone;
}

export function exportVisibleAnaliseProjecoesTableToExcel(
  table: HTMLTableElement,
  fileName = 'Analise_Projecoes.xlsx',
  sheetName = 'Analise de Projecoes',
): void {
  const tableClone = normalizeTableCloneForExcel(table);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.table_to_sheet(tableClone);
  const colCount = tableClone.querySelectorAll('tr:first-child th, tr:first-child td').length || 0;

  if (colCount > 0) {
    ws['!cols'] = Array.from({ length: colCount }, (_, idx) => ({ wch: idx === 0 ? 42 : 16 }));
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}
