import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { DayAnalysis, EspecialResumo } from './analysis';
import type { MonitoramentoBVBrand } from './storage';

const CURRENCY_FMT = 'R$ #,##0.00';
const INT_FMT = '#,##0';
const DIAS_FMT = '0 "dias"';
const TITLE_FILL = 'FF075985'; // sky-800
const HEADER_FILL = 'FF0284C7'; // sky-600
const TOTAL_FILL = 'FFE0F2FE'; // sky-100
const THIN = 'FFE2E8F0'; // slate-200

function brandLabel(brand: MonitoramentoBVBrand) {
  return brand === 'vw' ? 'VW' : 'Audi';
}

function dateBR(iso: string) {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
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
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder();
  });
}

function styleTotal(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };
    cell.border = thinBorder();
  });
}

function borderDataRow(row: ExcelJS.Row) {
  row.eachCell(cell => { cell.border = thinBorder(); });
}

async function download(wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

/** Gera e baixa a análise do dia em Excel formatado, com todas as partes expansíveis já expandidas. */
export async function exportAnaliseExcel(brand: MonitoramentoBVBrand, analysis: DayAnalysis) {
  const marca = brandLabel(brand);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();

  buildResumoSheet(wb, marca, analysis);
  buildFaixaSheet(wb, 'Dias - Vendidos', analysis.bucketsVendidos);
  buildFaixaSheet(wb, 'Dias - Em Estoque', analysis.bucketsNaoVendidos);
  buildFinanciamentoSheet(wb, analysis);
  buildEspecialSheet(wb, analysis.linhaEspecial);

  await download(wb, `Monitoramento_BV_${marca}_${analysis.date}.xlsx`);
}

function buildResumoSheet(wb: ExcelJS.Workbook, marca: string, analysis: DayAnalysis) {
  const ws = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: HEADER_FILL } } });
  ws.columns = [{ width: 46 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 14 }];

  styleTitle(ws, ws.addRow(['Monitoramento de Custo Financeiro Estoque Rotativo Banco Volks']), 5);
  const infoRow = ws.addRow([`Marca: ${marca}`, '', `Data base: ${dateBR(analysis.date)}`]);
  infoRow.font = { italic: true, color: { argb: 'FF64748B' } };
  ws.addRow([]);

  styleTitle(ws, ws.addRow(['Indicadores']), 5);
  styleHeader(ws.addRow(['Indicador', 'Valor']));
  const kpi = (label: string, value: number | null, fmt: string) => {
    const row = ws.addRow([label, value ?? '']);
    row.getCell(2).numFmt = fmt;
    row.getCell(2).alignment = { horizontal: 'right' };
    borderDataRow(row);
  };
  kpi('Total de veículos', analysis.totalVeiculos, INT_FMT);
  kpi('Valor NF total', analysis.totalValorNf, CURRENCY_FMT);
  kpi('Juros (J+Mora+Multa)', analysis.totalJuros, CURRENCY_FMT);
  kpi('Média de dias em estoque', analysis.mediaDiasGeral, DIAS_FMT);
  ws.addRow([]);

  styleTitle(ws, ws.addRow(['Resumo por grupo']), 5);
  styleHeader(ws.addRow(['Grupo', 'Veículos', 'Valor NF', 'Juros', 'Média dias']));
  const grupoRow = (label: string, g: DayAnalysis['vendidos']) => {
    const row = ws.addRow([label, g.qtd, g.valorNf, g.juros, g.mediaDias ?? '']);
    row.getCell(2).numFmt = INT_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = CURRENCY_FMT;
    row.getCell(5).numFmt = DIAS_FMT;
    borderDataRow(row);
  };
  grupoRow('Veículos Vendidos com Programação de pagamento', analysis.vendidos);
  grupoRow('Veículos em Estoque', analysis.naoVendidos);
  const totalRow = ws.addRow([
    'Total',
    analysis.totalVeiculos,
    analysis.totalValorNf,
    analysis.totalJuros,
    analysis.mediaDiasGeral ?? '',
  ]);
  totalRow.getCell(2).numFmt = INT_FMT;
  totalRow.getCell(3).numFmt = CURRENCY_FMT;
  totalRow.getCell(4).numFmt = CURRENCY_FMT;
  totalRow.getCell(5).numFmt = DIAS_FMT;
  styleTotal(totalRow);
}

function buildFaixaSheet(wb: ExcelJS.Workbook, name: string, buckets: DayAnalysis['bucketsVendidos']) {
  const ws = wb.addWorksheet(name, { properties: { tabColor: { argb: HEADER_FILL } } });
  ws.columns = [{ width: 18 }, { width: 24 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 16 }];

  styleTitle(ws, ws.addRow([`${name} — detalhado por chassi`]), 6);
  styleHeader(ws.addRow(['Faixa', 'Chassi', 'Produto', 'Dias em estoque', 'Valor NF', 'Juros']));

  for (const bucket of buckets) {
    for (const v of bucket.veiculos) {
      const row = ws.addRow([bucket.label, v.chassi, v.produto, v.diasEstoque ?? '', v.valorNf, v.juros]);
      row.getCell(4).numFmt = INT_FMT;
      row.getCell(5).numFmt = CURRENCY_FMT;
      row.getCell(6).numFmt = CURRENCY_FMT;
      borderDataRow(row);
    }
  }

  const totalQtd = buckets.reduce((s, b) => s + b.qtd, 0);
  const totalValor = buckets.reduce((s, b) => s + b.valorNf, 0);
  const totalJuros = buckets.reduce((s, b) => s + b.juros, 0);
  const totalRow = ws.addRow(['Total', '', '', totalQtd, totalValor, totalJuros]);
  totalRow.getCell(4).numFmt = INT_FMT;
  totalRow.getCell(5).numFmt = CURRENCY_FMT;
  totalRow.getCell(6).numFmt = CURRENCY_FMT;
  styleTotal(totalRow);
}

function buildFinanciamentoSheet(wb: ExcelJS.Workbook, analysis: DayAnalysis) {
  const ws = wb.addWorksheet('Linha Financiamento', { properties: { tabColor: { argb: HEADER_FILL } } });
  ws.columns = [{ width: 24 }, { width: 14 }, { width: 18 }, { width: 16 }, { width: 14 }];

  styleTitle(ws, ws.addRow(['Resumo por Linha de Financiamento']), 5);
  ws.addRow([]);

  const section = (titulo: string, rows: DayAnalysis['porProduto'], total: DayAnalysis['vendidos']) => {
    styleTitle(ws, ws.addRow([titulo]), 5);
    styleHeader(ws.addRow(['Linha de Financiamento', 'Veículos', 'Valor NF', 'Juros', 'Média dias']));
    if (rows.length === 0) {
      borderDataRow(ws.addRow(['Nenhum veículo neste grupo', '', '', '', '']));
    } else {
      for (const item of rows) {
        const row = ws.addRow([item.produto, item.qtd, item.valorNf, item.juros, item.mediaDias ?? '']);
        row.getCell(2).numFmt = INT_FMT;
        row.getCell(3).numFmt = CURRENCY_FMT;
        row.getCell(4).numFmt = CURRENCY_FMT;
        row.getCell(5).numFmt = DIAS_FMT;
        borderDataRow(row);
      }
    }
    const totalRow = ws.addRow(['Total', total.qtd, total.valorNf, total.juros, total.mediaDias ?? '']);
    totalRow.getCell(2).numFmt = INT_FMT;
    totalRow.getCell(3).numFmt = CURRENCY_FMT;
    totalRow.getCell(4).numFmt = CURRENCY_FMT;
    totalRow.getCell(5).numFmt = DIAS_FMT;
    styleTotal(totalRow);
    ws.addRow([]);
  };

  section('Veículos Vendidos', analysis.porProdutoVendidos, analysis.vendidos);
  section('Veículos em Estoque', analysis.porProdutoNaoVendidos, analysis.naoVendidos);
}

function buildEspecialSheet(wb: ExcelJS.Workbook, especial: EspecialResumo) {
  const ws = wb.addWorksheet('Linha Especial', { properties: { tabColor: { argb: HEADER_FILL } } });
  ws.columns = [{ width: 22 }, { width: 24 }, { width: 16 }, { width: 18 }];

  styleTitle(ws, ws.addRow(['Linha especial (FP-CES-ESP) — dias de caixa']), 4);
  const subtitle = ws.addRow(['Dias de caixa = Data p/ Liq. − Data da Venda']);
  subtitle.getCell(1).font = { italic: true, color: { argb: 'FF64748B' } };
  ws.addRow([]);

  styleHeader(ws.addRow(['Resumo', 'Veículos', 'Valor NF', 'Média dias']));
  const resumoRow = ws.addRow(['Total linha especial', especial.qtd, especial.valorNf, especial.mediaDias ?? '']);
  resumoRow.getCell(2).numFmt = INT_FMT;
  resumoRow.getCell(3).numFmt = CURRENCY_FMT;
  resumoRow.getCell(4).numFmt = DIAS_FMT;
  styleTotal(resumoRow);
  ws.addRow([]);

  styleTitle(ws, ws.addRow(['Detalhado por chassi']), 4);
  styleHeader(ws.addRow(['Faixa de dias de caixa', 'Chassi', 'Dias de caixa', 'Valor NF']));
  for (const bucket of especial.buckets) {
    for (const v of bucket.veiculos) {
      const row = ws.addRow([bucket.label, v.chassi, v.diasCaixa, v.valorNf]);
      row.getCell(3).numFmt = INT_FMT;
      row.getCell(4).numFmt = CURRENCY_FMT;
      borderDataRow(row);
    }
  }
}
