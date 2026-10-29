import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { EstoquePecasMarca } from './EstoquePecasDashboard';
import type { AnaliseResult, AnaliseItem } from './estoqueAnalise';

const CURRENCY_FMT = 'R$ #,##0.00';
const INT_FMT = '#,##0';
const PERC_FMT = '0.0"%"';
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
function statusLabel(it: AnaliseItem): string {
  if (it.parado) return 'Parado';
  if (it.dias === null) return 'Sem info';
  return 'Movimentando';
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
  marca: EstoquePecasMarca;
  month: string;
  analise: AnaliseResult;
}

/** Gera e baixa a análise de estoque de peças em Excel, com uma aba por seção. */
export async function exportEstoqueExcel({ marca, month, analise }: ExportParams) {
  const theme: Theme = { title: hexToArgb(marca.primary), header: hexToArgb(marca.primary) };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();

  buildResumoSheet(wb, theme, marca, month, analise);
  buildFaixaSheet(wb, theme, analise);
  buildAbcSheet(wb, theme, analise);
  buildGruposSheet(wb, theme, analise);
  buildTopParadosSheet(wb, theme, analise);
  buildItensSheet(wb, theme, analise);

  await download(wb, `Estoque_Pecas_${marca.name.replace(/\s+/g, '_')}_${month}.xlsx`);
}

function buildResumoSheet(wb: ExcelJS.Workbook, theme: Theme, marca: EstoquePecasMarca, month: string, a: AnaliseResult) {
  const ws = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: theme.header } } });
  ws.columns = [{ width: 40 }, { width: 22 }, { width: 12 }];

  styleTitle(ws, ws.addRow([marca.name]), 3, theme);
  const info = ws.addRow([`Mês: ${monthLabel(month)}`, `Dias p/ "parado": ${a.threshold}`]);
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
  kpi('Valor total em estoque', a.totalValor, CURRENCY_FMT);
  kpi('Itens (SKUs)', a.totalSkus, INT_FMT);
  kpi('Peças', a.totalPecas, INT_FMT);
  kpi('Valor parado', a.valorParado, CURRENCY_FMT);
  kpi('% Valor parado', a.pctValorParado, PERC_FMT);
  kpi('Itens parados', a.skusParados, INT_FMT);
  kpi('% Itens parados', a.pctSkusParados, PERC_FMT);
  kpi('Peças paradas', a.pecasParadas, INT_FMT);
  kpi('Valor movimentando', a.valorMovimentando, CURRENCY_FMT);
  kpi('Valor sem informação', a.semInfoValor, CURRENCY_FMT);
  kpi('Maior valor parado', a.maiorValorParado?.valorTotal ?? 0, CURRENCY_FMT);
  kpi('Maior valor parado — dias', a.maiorValorParado?.dias ?? '', INT_FMT);
  ws.addRow([]);

  // Donut "Movimentando × Parado" como tabela
  styleTitle(ws, ws.addRow(['Movimentando × Parado (valor)']), 3, theme);
  styleHeader(ws.addRow(['Status', 'Valor', '% do estoque']), theme);
  const linha = (label: string, valor: number) => {
    const pct = a.totalValor > 0 ? (valor / a.totalValor) * 100 : 0;
    const row = ws.addRow([label, valor, pct]);
    row.getCell(2).numFmt = CURRENCY_FMT;
    row.getCell(3).numFmt = PERC_FMT;
    borderDataRow(row);
  };
  linha('Movimentando', a.valorMovimentando);
  linha('Parado', a.valorParado);
  linha('Sem info', a.semInfoValor);
  const totalRow = ws.addRow(['Total', a.totalValor, 100]);
  totalRow.getCell(2).numFmt = CURRENCY_FMT;
  totalRow.getCell(3).numFmt = PERC_FMT;
  styleTotal(totalRow);
}

function buildFaixaSheet(wb: ExcelJS.Workbook, theme: Theme, a: AnaliseResult) {
  const ws = wb.addWorksheet('Por Faixa de Dias', { properties: { tabColor: { argb: theme.header } } });
  ws.columns = [{ width: 18 }, { width: 14 }, { width: 20 }];

  styleTitle(ws, ws.addRow(['Valor em estoque por dias sem movimentação']), 3, theme);
  const sub = ws.addRow(['Equivale ao gráfico de barras por faixa de dias']);
  sub.getCell(1).font = { italic: true, color: { argb: 'FF64748B' } };
  ws.addRow([]);

  styleHeader(ws.addRow(['Faixa (dias)', 'SKUs', 'Valor']), theme);
  let tSkus = 0, tValor = 0;
  for (const b of a.buckets) {
    const row = ws.addRow([b.label, b.skus, b.valor]);
    row.getCell(2).numFmt = INT_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    borderDataRow(row);
    tSkus += b.skus; tValor += b.valor;
  }
  const totalRow = ws.addRow(['Total', tSkus, tValor]);
  totalRow.getCell(2).numFmt = INT_FMT;
  totalRow.getCell(3).numFmt = CURRENCY_FMT;
  styleTotal(totalRow);
}

function buildAbcSheet(wb: ExcelJS.Workbook, theme: Theme, a: AnaliseResult) {
  const ws = wb.addWorksheet('Curva ABC', { properties: { tabColor: { argb: theme.header } } });
  ws.columns = [{ width: 12 }, { width: 14 }, { width: 20 }, { width: 14 }];

  styleTitle(ws, ws.addRow(['Curva ABC (por valor em estoque)']), 4, theme);
  const sub = ws.addRow(['A ≤ 80% · B ≤ 95% · C restante']);
  sub.getCell(1).font = { italic: true, color: { argb: 'FF64748B' } };
  ws.addRow([]);

  styleHeader(ws.addRow(['Classe', 'SKUs', 'Valor', '% Valor']), theme);
  let tSkus = 0, tValor = 0;
  for (const r of a.abc) {
    const row = ws.addRow([r.classe, r.skus, r.valor, r.pctValor]);
    row.getCell(2).numFmt = INT_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = PERC_FMT;
    borderDataRow(row);
    tSkus += r.skus; tValor += r.valor;
  }
  const totalRow = ws.addRow(['Total', tSkus, tValor, 100]);
  totalRow.getCell(2).numFmt = INT_FMT;
  totalRow.getCell(3).numFmt = CURRENCY_FMT;
  totalRow.getCell(4).numFmt = PERC_FMT;
  styleTotal(totalRow);
}

function buildGruposSheet(wb: ExcelJS.Workbook, theme: Theme, a: AnaliseResult) {
  const ws = wb.addWorksheet('Valor Parado por Grupo', { properties: { tabColor: { argb: theme.header } } });
  ws.columns = [{ width: 40 }, { width: 14 }, { width: 20 }];

  styleTitle(ws, ws.addRow(['Valor parado por grupo']), 3, theme);
  ws.addRow([]);

  // Todos os grupos parados (calculados a partir dos itens)
  const grupoMap = new Map<string, { skus: number; valor: number }>();
  for (const it of a.itens) {
    if (!it.parado) continue;
    const key = it.grupo || '(sem grupo)';
    const g = grupoMap.get(key) ?? { skus: 0, valor: 0 };
    g.skus += 1;
    g.valor += it.valorTotal;
    grupoMap.set(key, g);
  }
  const grupos = [...grupoMap.entries()].map(([grupo, g]) => ({ grupo, ...g })).sort((x, y) => y.valor - x.valor);

  styleHeader(ws.addRow(['Grupo', 'SKUs', 'Valor parado']), theme);
  let tSkus = 0, tValor = 0;
  for (const g of grupos) {
    const row = ws.addRow([g.grupo, g.skus, g.valor]);
    row.getCell(2).numFmt = INT_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    borderDataRow(row);
    tSkus += g.skus; tValor += g.valor;
  }
  const totalRow = ws.addRow(['Total', tSkus, tValor]);
  totalRow.getCell(2).numFmt = INT_FMT;
  totalRow.getCell(3).numFmt = CURRENCY_FMT;
  styleTotal(totalRow);
}

function buildTopParadosSheet(wb: ExcelJS.Workbook, theme: Theme, a: AnaliseResult) {
  const ws = wb.addWorksheet('Top Parados', { properties: { tabColor: { argb: theme.header } } });
  ws.columns = [{ width: 8 }, { width: 18 }, { width: 40 }, { width: 24 }, { width: 12 }, { width: 18 }, { width: 10 }];

  styleTitle(ws, ws.addRow(['Itens parados de maior valor']), 7, theme);
  ws.addRow([]);

  styleHeader(ws.addRow(['#', 'Código', 'Descrição', 'Grupo', 'Quantidade', 'Valor total', 'Dias']), theme);
  a.topParados.forEach((it, i) => {
    const row = ws.addRow([i + 1, it.codigo, it.descricao, it.grupo, it.quantidade, it.valorTotal, it.dias ?? '']);
    row.getCell(5).numFmt = INT_FMT;
    row.getCell(6).numFmt = CURRENCY_FMT;
    if (it.dias !== null) row.getCell(7).numFmt = INT_FMT;
    borderDataRow(row);
  });
}

function buildItensSheet(wb: ExcelJS.Workbook, theme: Theme, a: AnaliseResult) {
  const ws = wb.addWorksheet('Itens', { properties: { tabColor: { argb: theme.header } } });
  ws.columns = [
    { width: 18 }, { width: 18 }, { width: 44 }, { width: 24 },
    { width: 12 }, { width: 16 }, { width: 18 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 10 },
  ];

  styleTitle(ws, ws.addRow(['Itens em estoque — Base completa']), 11, theme);
  ws.addRow([]);

  styleHeader(ws.addRow([
    'Código', 'Código interno', 'Descrição', 'Grupo', 'Quantidade',
    'Valor unit.', 'Valor total', 'Dias', 'Status', 'Faixa', 'Classe ABC',
  ]), theme);
  let total = 0;
  const ordenados = [...a.itens].sort((x, y) => {
    const xn = x.dias === null;
    const yn = y.dias === null;
    if (xn && yn) return 0;
    if (xn) return 1;  // itens sem info vão para o fim
    if (yn) return -1;
    return (y.dias as number) - (x.dias as number); // maior nº de dias primeiro
  });
  for (const it of ordenados) {
    const row = ws.addRow([
      it.codigo, it.codigoInterno, it.descricao, it.grupo, it.quantidade,
      it.valorUnit, it.valorTotal, it.dias ?? '', statusLabel(it), it.faixa ?? '', it.classeAbc,
    ]);
    row.getCell(5).numFmt = INT_FMT;
    row.getCell(6).numFmt = CURRENCY_FMT;
    row.getCell(7).numFmt = CURRENCY_FMT;
    if (it.dias !== null) row.getCell(8).numFmt = INT_FMT;
    borderDataRow(row);
    total += it.valorTotal;
  }
  const totalRow = ws.addRow(['Total', '', '', '', '', '', total, '', '', '', '']);
  totalRow.getCell(7).numFmt = CURRENCY_FMT;
  styleTotal(totalRow);
}
