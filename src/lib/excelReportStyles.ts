import type ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const HEADER_FILL = 'FF4F46E5';
const TITLE_FILL = 'FF3730A3';
const TOTAL_FILL = 'FFEEF2FF';
const THIN = 'FFE2E8F0';

function thinBorder(): Partial<ExcelJS.Borders> {
  const side = { style: 'thin' as const, color: { argb: THIN } };
  return { top: side, bottom: side, left: side, right: side };
}

export function styleTitle(ws: ExcelJS.Worksheet, row: ExcelJS.Row, colspan: number) {
  ws.mergeCells(row.number, 1, row.number, colspan);
  row.height = 24;
  const cell = row.getCell(1);
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_FILL } };
  cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
}

export function styleHeader(row: ExcelJS.Row) {
  row.height = 20;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder();
  });
}

export function styleTotal(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };
    cell.border = thinBorder();
  });
}

export function borderDataRow(row: ExcelJS.Row) {
  row.eachCell(cell => { cell.border = thinBorder(); });
}

export async function downloadExcel(wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}
