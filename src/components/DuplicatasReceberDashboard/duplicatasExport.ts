import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { DuplicatasMarca } from './DuplicatasReceberDashboard';
import {
  analyze, resumoPorDepartamento, resumoPorOrigem,
  type Duplicata, type FaixaResult,
} from './duplicatasAnalise';

const CURRENCY_FMT = 'R$ #,##0.00';
const INT_FMT = '#,##0';
const PERC_FMT = '0.0"%"';
const TITLE_FILL = 'FF3730A3'; // indigo-800
const HEADER_FILL = 'FF4F46E5'; // indigo-600
const TOTAL_FILL = 'FFEEF2FF'; // indigo-50
const THIN = 'FFE2E8F0'; // slate-200

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  const idx = Number(m) - 1;
  return idx >= 0 && idx <= 11 ? `${MONTH_NAMES[idx]} de ${y}` : month;
}
function dateBR(d: Date | null): string {
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function situacao(d: Duplicata): string {
  return d.vencido ? `Vencida (${d.diasAtraso}d)` : 'A vencer';
}
function diasValor(d: Duplicata): number | '' {
  if (!d.vencimento) return '';
  return d.vencido ? d.diasAtraso : d.diasAteVencer;
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side = { style: 'thin' as const, color: { argb: THIN } };
  return { top: side, bottom: side, left: side, right: side };
}
function styleTitle(ws: ExcelJS.Worksheet, row: ExcelJS.Row, colspan: number) {
  ws.mergeCells(row.number, 1, row.number, colspan);
  row.height = 24;
  const cell = row.getCell(1);
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_FILL } };
  cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
}
function styleHeader(row: ExcelJS.Row) {
  row.height = 20;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder();
  });
}
function styleTotal(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };
    cell.border = thinBorder();
  });
}
function borderDataRow(row: ExcelJS.Row) {
  row.eachCell((cell) => { cell.border = thinBorder(); });
}
async function download(wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

interface ExportParams {
  marca: DuplicatasMarca;
  month: string;
  referenceDate: Date;
  duplicatas: Duplicata[];
}

/** Gera e baixa a análise de Duplicatas a Receber em Excel, com uma aba por seção. */
export async function exportDuplicatasExcel({ marca, month, referenceDate, duplicatas }: ExportParams) {
  const analysis = analyze(duplicatas);
  const resumoDept = resumoPorDepartamento(duplicatas);
  const resumoOrigem = resumoPorOrigem(duplicatas);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();

  buildResumoSheet(wb, marca, month, referenceDate, analysis.kpis);
  buildDepartamentoSheet(wb, resumoDept);
  buildOrigemSheet(wb, resumoOrigem);
  buildFaixaSheet(wb, 'Vencidos por Faixa', analysis.faixasVencido);
  buildFaixaSheet(wb, 'A Vencer por Faixa', analysis.faixasAVencer);
  buildTopClientesSheet(wb, 'Maiores Clientes', analysis.topClientes, 'total', 'Total a receber');
  buildTopClientesSheet(wb, 'Maiores Clientes Vencido', analysis.topClientesVencido, 'vencido', 'Valor vencido');
  buildDuplicatasSheet(wb, duplicatas);

  await download(wb, `Duplicatas_Receber_${marca.name}_${month}.xlsx`);
}

function buildResumoSheet(
  wb: ExcelJS.Workbook,
  marca: DuplicatasMarca,
  month: string,
  referenceDate: Date,
  kpis: ReturnType<typeof analyze>['kpis'],
) {
  const ws = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: HEADER_FILL } } });
  ws.columns = [{ width: 36 }, { width: 22 }];

  styleTitle(ws, ws.addRow(['Duplicatas a Receber — Posição']), 2);
  const info = ws.addRow([`Marca: ${marca.name}`, `Mês: ${monthLabel(month)}`]);
  info.font = { italic: true, color: { argb: 'FF64748B' } };
  const info2 = ws.addRow([`Posição em: ${dateBR(referenceDate)}`, 'Vencido/a vencer por DTA_VENCIMENTO']);
  info2.font = { italic: true, color: { argb: 'FF64748B' } };
  ws.addRow([]);

  styleTitle(ws, ws.addRow(['Indicadores']), 2);
  styleHeader(ws.addRow(['Indicador', 'Valor']));
  const kpi = (label: string, value: number, fmt: string) => {
    const row = ws.addRow([label, value]);
    row.getCell(2).numFmt = fmt;
    row.getCell(2).alignment = { horizontal: 'right' };
    borderDataRow(row);
  };
  kpi('Total a receber', kpis.totalReceber, CURRENCY_FMT);
  kpi('Vencido', kpis.totalVencido, CURRENCY_FMT);
  kpi('% Vencido', kpis.percVencido, PERC_FMT);
  kpi('A vencer', kpis.totalAVencer, CURRENCY_FMT);
  kpi('Nº de duplicatas', kpis.qtdDuplicatas, INT_FMT);
  kpi('Nº de clientes', kpis.qtdClientes, INT_FMT);
  kpi('Ticket médio', kpis.ticketMedio, CURRENCY_FMT);
  kpi('Maior duplicata', kpis.maiorDuplicata, CURRENCY_FMT);
}

function buildDepartamentoSheet(wb: ExcelJS.Workbook, rows: ReturnType<typeof resumoPorDepartamento>) {
  const ws = wb.addWorksheet('Por Departamento', { properties: { tabColor: { argb: HEADER_FILL } } });
  ws.columns = [{ width: 22 }, { width: 12 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 12 }];

  styleTitle(ws, ws.addRow(['Resumo por Departamento']), 6);
  const sub = ws.addRow(['Representa também o gráfico Vencido × A vencer por departamento']);
  sub.getCell(1).font = { italic: true, color: { argb: 'FF64748B' } };
  ws.addRow([]);

  styleHeader(ws.addRow(['Departamento', 'Duplicatas', 'Total', 'Vencido', 'A vencer', '% Venc.']));
  let tQtd = 0, tTotal = 0, tVenc = 0, tAVenc = 0;
  for (const r of rows) {
    const row = ws.addRow([r.departamento, r.qtd, r.total, r.vencido, r.aVencer, r.percVencido]);
    row.getCell(2).numFmt = INT_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = CURRENCY_FMT;
    row.getCell(5).numFmt = CURRENCY_FMT;
    row.getCell(6).numFmt = PERC_FMT;
    borderDataRow(row);
    tQtd += r.qtd; tTotal += r.total; tVenc += r.vencido; tAVenc += r.aVencer;
  }
  const totalRow = ws.addRow(['Total', tQtd, tTotal, tVenc, tAVenc, tTotal > 0 ? (tVenc / tTotal) * 100 : 0]);
  totalRow.getCell(2).numFmt = INT_FMT;
  totalRow.getCell(3).numFmt = CURRENCY_FMT;
  totalRow.getCell(4).numFmt = CURRENCY_FMT;
  totalRow.getCell(5).numFmt = CURRENCY_FMT;
  totalRow.getCell(6).numFmt = PERC_FMT;
  styleTotal(totalRow);
  ws.addRow([]);

  // Detalhe por título
  styleTitle(ws, ws.addRow(['Detalhado por título']), 6);
  styleHeader(ws.addRow(['Departamento', 'Cliente', 'Título', 'Vencimento', 'Situação', 'Valor']));
  for (const r of rows) {
    for (const d of r.duplicatas) {
      const row = ws.addRow([r.departamento, d.clienteNome, d.titulo, dateBR(d.vencimento), situacao(d), d.valor]);
      row.getCell(6).numFmt = CURRENCY_FMT;
      borderDataRow(row);
    }
  }
}

function buildOrigemSheet(wb: ExcelJS.Workbook, rows: ReturnType<typeof resumoPorOrigem>) {
  const ws = wb.addWorksheet('Por Origem', { properties: { tabColor: { argb: HEADER_FILL } } });
  ws.columns = [{ width: 26 }, { width: 12 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 12 }];

  styleTitle(ws, ws.addRow(['Resumo por Origem']), 6);
  ws.addRow([]);

  styleHeader(ws.addRow(['Origem', 'Duplicatas', 'Total', 'Vencido', 'A vencer', '% Venc.']));
  let tQtd = 0, tTotal = 0, tVenc = 0, tAVenc = 0;
  for (const r of rows) {
    const row = ws.addRow([r.origem, r.qtd, r.total, r.vencido, r.aVencer, r.percVencido]);
    row.getCell(2).numFmt = INT_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = CURRENCY_FMT;
    row.getCell(5).numFmt = CURRENCY_FMT;
    row.getCell(6).numFmt = PERC_FMT;
    borderDataRow(row);
    tQtd += r.qtd; tTotal += r.total; tVenc += r.vencido; tAVenc += r.aVencer;
  }
  const totalRow = ws.addRow(['Total', tQtd, tTotal, tVenc, tAVenc, tTotal > 0 ? (tVenc / tTotal) * 100 : 0]);
  totalRow.getCell(2).numFmt = INT_FMT;
  totalRow.getCell(3).numFmt = CURRENCY_FMT;
  totalRow.getCell(4).numFmt = CURRENCY_FMT;
  totalRow.getCell(5).numFmt = CURRENCY_FMT;
  totalRow.getCell(6).numFmt = PERC_FMT;
  styleTotal(totalRow);
  ws.addRow([]);

  styleTitle(ws, ws.addRow(['Detalhado por título']), 6);
  styleHeader(ws.addRow(['Origem', 'Cliente', 'Departamento', 'Título', 'Vencimento', 'Valor']));
  for (const r of rows) {
    for (const d of r.duplicatas) {
      const row = ws.addRow([r.origem, d.clienteNome, d.departamento, d.titulo, dateBR(d.vencimento), d.valor]);
      row.getCell(6).numFmt = CURRENCY_FMT;
      borderDataRow(row);
    }
  }
}

function buildFaixaSheet(wb: ExcelJS.Workbook, name: string, faixas: FaixaResult[]) {
  const ws = wb.addWorksheet(name, { properties: { tabColor: { argb: HEADER_FILL } } });
  ws.columns = [{ width: 20 }, { width: 30 }, { width: 20 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 18 }];

  styleTitle(ws, ws.addRow([name]), 7);
  ws.addRow([]);

  // Resumo das faixas
  styleHeader(ws.addRow(['Faixa', 'Duplicatas', 'Valor']));
  let tQtd = 0, tValor = 0;
  for (const f of faixas) {
    const row = ws.addRow([f.label, f.qtd, f.valor]);
    row.getCell(2).numFmt = INT_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    borderDataRow(row);
    tQtd += f.qtd; tValor += f.valor;
  }
  const totalRow = ws.addRow(['Total', tQtd, tValor]);
  totalRow.getCell(2).numFmt = INT_FMT;
  totalRow.getCell(3).numFmt = CURRENCY_FMT;
  styleTotal(totalRow);
  ws.addRow([]);

  // Detalhe por título
  styleTitle(ws, ws.addRow(['Detalhado por título']), 7);
  styleHeader(ws.addRow(['Faixa', 'Cliente', 'Departamento', 'Título', 'Origem', 'Vencimento', 'Valor']));
  for (const f of faixas) {
    for (const d of f.duplicatas) {
      const row = ws.addRow([f.label, d.clienteNome, d.departamento, d.titulo, d.nomeOrigem, dateBR(d.vencimento), d.valor]);
      row.getCell(7).numFmt = CURRENCY_FMT;
      borderDataRow(row);
    }
  }
}

function buildTopClientesSheet(
  wb: ExcelJS.Workbook,
  name: string,
  clientes: ReturnType<typeof analyze>['topClientes'],
  valueKey: 'total' | 'vencido',
  valueLabel: string,
) {
  const ws = wb.addWorksheet(name, { properties: { tabColor: { argb: HEADER_FILL } } });
  ws.columns = [{ width: 8 }, { width: 40 }, { width: 12 }, { width: 18 }];

  styleTitle(ws, ws.addRow([name]), 4);
  ws.addRow([]);

  styleHeader(ws.addRow(['#', 'Cliente', 'Duplicatas', valueLabel]));
  clientes.forEach((c, i) => {
    const row = ws.addRow([i + 1, c.clienteNome, c.qtd, c[valueKey]]);
    row.getCell(3).numFmt = INT_FMT;
    row.getCell(4).numFmt = CURRENCY_FMT;
    borderDataRow(row);
  });
}

function buildDuplicatasSheet(wb: ExcelJS.Workbook, duplicatas: Duplicata[]) {
  const ws = wb.addWorksheet('Duplicatas', { properties: { tabColor: { argb: HEADER_FILL } } });
  ws.columns = [
    { width: 20 }, { width: 24 }, { width: 36 }, { width: 20 },
    { width: 14 }, { width: 14 }, { width: 16 }, { width: 10 }, { width: 18 },
  ];

  styleTitle(ws, ws.addRow(['Duplicatas a Receber — Base completa']), 9);
  ws.addRow([]);

  styleHeader(ws.addRow(['Departamento', 'Origem', 'Cliente', 'CNPJ/CPF', 'Título', 'Vencimento', 'Situação', 'Dias', 'Valor']));
  const ordenadas = [...duplicatas].sort((a, z) => {
    const av = a.vencimento ? a.vencimento.getTime() : Infinity;
    const zv = z.vencimento ? z.vencimento.getTime() : Infinity;
    return av - zv;
  });
  let total = 0;
  for (const d of ordenadas) {
    const row = ws.addRow([
      d.departamento, d.nomeOrigem, d.clienteNome, d.cgccpf, d.titulo,
      dateBR(d.vencimento), situacao(d), diasValor(d), d.valor,
    ]);
    row.getCell(8).numFmt = INT_FMT;
    row.getCell(9).numFmt = CURRENCY_FMT;
    borderDataRow(row);
    total += d.valor;
  }
  const totalRow = ws.addRow(['Total', '', '', '', '', '', '', '', total]);
  totalRow.getCell(9).numFmt = CURRENCY_FMT;
  styleTotal(totalRow);
}
