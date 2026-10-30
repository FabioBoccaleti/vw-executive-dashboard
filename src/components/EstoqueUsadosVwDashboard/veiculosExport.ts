import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { AnaliseVeiculosResult, VeiculoAnaliseItem } from './veiculosAnalise';

const CURRENCY_FMT = 'R$ #,##0.00';
const INT_FMT = '#,##0';
const PERC_FMT = '0.0"%"';
const DATE_FMT = 'dd/mm/yyyy';
const TOTAL_FILL = 'FFF1F5F9'; // slate-100
const THIN = 'FFE2E8F0'; // slate-200

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  const idx = Number(m) - 1;
  return idx >= 0 && idx <= 11 ? `${MONTH_NAMES[idx]} de ${y}` : month;
}
function hexToArgb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`;
}
function statusLabel(it: VeiculoAnaliseItem): string {
  if (it.dias === null) return 'Sem data';
  if (it.parado) return 'Parado';
  return 'OK';
}
function isoToDate(iso: string | null): Date | '' {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d;
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side = { style: 'thin' as const, color: { argb: THIN } };
  return { top: side, bottom: side, left: side, right: side };
}

interface Theme { title: string; header: string; }

function styleTitle(ws: ExcelJS.Worksheet, row: ExcelJS.Row, colspan: number, theme: Theme) {
  ws.mergeCells(row.number, 1, row.number, colspan);
  row.height = 24;
  const cell = row.getCell(1);
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.title } };
  cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
}
function styleHeader(row: ExcelJS.Row, theme: Theme) {
  row.height = 20;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.header } };
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
  primary: string;
  month: string;
  baseDate: string;
  analise: AnaliseVeiculosResult;
}

/** Gera e baixa a análise de estoque de veículos usados em Excel, com uma aba por seção. */
export async function exportVeiculosExcel({ primary, month, baseDate, analise }: ExportParams) {
  const theme: Theme = { title: hexToArgb(primary), header: hexToArgb(primary) };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();

  buildResumoSheet(wb, theme, month, baseDate, analise);
  buildFaixaSheet(wb, theme, analise);
  buildMarcaSheet(wb, theme, analise);
  buildModeloSheet(wb, theme, analise);
  buildVeiculosSheet(wb, theme, analise);

  await download(wb, `Estoque_Veiculos_Usados_VW_${month}.xlsx`);
}

function buildResumoSheet(wb: ExcelJS.Workbook, theme: Theme, month: string, baseDate: string, a: AnaliseVeiculosResult) {
  const ws = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: theme.header } } });
  ws.columns = [{ width: 40 }, { width: 22 }, { width: 12 }];

  styleTitle(ws, ws.addRow(['Estoque de Veículos Usados VW']), 3, theme);
  const [by, bm, bd] = baseDate.split('-');
  const info = ws.addRow([`Mês: ${monthLabel(month)}`, `Data-base: ${bd}/${bm}/${by}`, `Parado > ${a.threshold} dias`]);
  info.font = { italic: true, color: { argb: 'FF64748B' } };
  ws.addRow([]);

  styleTitle(ws, ws.addRow(['Indicadores']), 3, theme);
  styleHeader(ws.addRow(['Indicador', 'Valor']), theme);
  const kpi = (label: string, value: number | '', fmt: string) => {
    const row = ws.addRow([label, value]);
    if (value !== '') row.getCell(2).numFmt = fmt;
    row.getCell(2).alignment = { horizontal: 'right' };
    borderDataRow(row);
  };
  kpi('Veículos em estoque', a.totalVeiculos, INT_FMT);
  kpi('Valor total em estoque', a.totalValor, CURRENCY_FMT);
  kpi('Ticket médio', a.ticketMedio, CURRENCY_FMT);
  kpi('Idade média (dias)', a.idadeMedia != null ? Math.round(a.idadeMedia) : '', INT_FMT);
  kpi(`Veículos parados (> ${a.threshold} dias)`, a.parados, INT_FMT);
  kpi('% Veículos parados', a.pctParados, PERC_FMT);
  kpi('Valor parado', a.valorParado, CURRENCY_FMT);
  kpi('Marcas distintas', a.marcas.length, INT_FMT);
  kpi('Modelos distintos', a.modelos.length, INT_FMT);
}

function buildFaixaSheet(wb: ExcelJS.Workbook, theme: Theme, a: AnaliseVeiculosResult) {
  const ws = wb.addWorksheet('Por Faixa de Dias', { properties: { tabColor: { argb: theme.header } } });
  ws.columns = [{ width: 18 }, { width: 14 }, { width: 20 }];

  styleTitle(ws, ws.addRow(['Veículos em estoque por faixa de dias']), 3, theme);
  ws.addRow([]);

  styleHeader(ws.addRow(['Faixa (dias)', 'Veículos', 'Valor']), theme);
  let tN = 0, tValor = 0;
  for (const b of a.buckets) {
    const row = ws.addRow([b.label, b.n, b.valor]);
    row.getCell(2).numFmt = INT_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    borderDataRow(row);
    tN += b.n; tValor += b.valor;
  }
  const totalRow = ws.addRow(['Total', tN, tValor]);
  totalRow.getCell(2).numFmt = INT_FMT;
  totalRow.getCell(3).numFmt = CURRENCY_FMT;
  styleTotal(totalRow);
}

function buildMarcaSheet(wb: ExcelJS.Workbook, theme: Theme, a: AnaliseVeiculosResult) {
  const ws = wb.addWorksheet('Por Marca', { properties: { tabColor: { argb: theme.header } } });
  ws.columns = [{ width: 24 }, { width: 14 }, { width: 20 }];

  styleTitle(ws, ws.addRow(['Veículos em estoque por marca']), 3, theme);
  ws.addRow([]);

  styleHeader(ws.addRow(['Marca', 'Veículos', 'Valor']), theme);
  let tN = 0, tValor = 0;
  for (const m of a.marcas) {
    const row = ws.addRow([m.marca, m.n, m.valor]);
    row.getCell(2).numFmt = INT_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    borderDataRow(row);
    tN += m.n; tValor += m.valor;
  }
  const totalRow = ws.addRow(['Total', tN, tValor]);
  totalRow.getCell(2).numFmt = INT_FMT;
  totalRow.getCell(3).numFmt = CURRENCY_FMT;
  styleTotal(totalRow);
}

function buildModeloSheet(wb: ExcelJS.Workbook, theme: Theme, a: AnaliseVeiculosResult) {
  const ws = wb.addWorksheet('Por Modelo', { properties: { tabColor: { argb: theme.header } } });
  ws.columns = [{ width: 44 }, { width: 14 }, { width: 20 }];

  styleTitle(ws, ws.addRow(['Modelos em estoque']), 3, theme);
  ws.addRow([]);

  styleHeader(ws.addRow(['Modelo', 'Veículos', 'Valor']), theme);
  let tN = 0, tValor = 0;
  for (const m of a.modelos) {
    const row = ws.addRow([m.modelo, m.n, m.valor]);
    row.getCell(2).numFmt = INT_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    borderDataRow(row);
    tN += m.n; tValor += m.valor;
  }
  const totalRow = ws.addRow(['Total', tN, tValor]);
  totalRow.getCell(2).numFmt = INT_FMT;
  totalRow.getCell(3).numFmt = CURRENCY_FMT;
  styleTotal(totalRow);
}

function buildVeiculosSheet(wb: ExcelJS.Workbook, theme: Theme, a: AnaliseVeiculosResult) {
  const ws = wb.addWorksheet('Veículos', { properties: { tabColor: { argb: theme.header } } });
  ws.columns = [
    { width: 16 }, { width: 24 }, { width: 40 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 10 }, { width: 18 }, { width: 12 }, { width: 12 },
  ];

  styleTitle(ws, ws.addRow(['Veículos em estoque — Base completa']), 10, theme);
  ws.addRow([]);

  styleHeader(ws.addRow([
    'Código', 'Chassi', 'Modelo', 'Marca', 'NF', 'Entrada', 'Dias', 'Valor', 'Situação', 'Faixa',
  ]), theme);

  let total = 0;
  const ordenados = [...a.itens].sort((x, y) => {
    const xn = x.dias === null;
    const yn = y.dias === null;
    if (xn && yn) return 0;
    if (xn) return 1;  // sem data vão para o fim
    if (yn) return -1;
    return (y.dias as number) - (x.dias as number); // maior nº de dias primeiro
  });
  for (const it of ordenados) {
    const row = ws.addRow([
      it.veiculo, it.chassi, it.modelo, it.marca, it.nf,
      isoToDate(it.entrada), it.dias ?? '', it.valor, statusLabel(it), it.faixa ?? '',
    ]);
    if (it.entrada) row.getCell(6).numFmt = DATE_FMT;
    if (it.dias !== null) row.getCell(7).numFmt = INT_FMT;
    row.getCell(8).numFmt = CURRENCY_FMT;
    borderDataRow(row);
    total += it.valor;
  }
  const totalRow = ws.addRow(['Total', '', '', '', '', '', '', total, '', '']);
  totalRow.getCell(8).numFmt = CURRENCY_FMT;
  styleTotal(totalRow);
}
