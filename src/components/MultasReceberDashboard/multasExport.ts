import ExcelJS from 'exceljs';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { HEADER_FILL, borderDataRow, downloadExcel, styleHeader, styleTitle, styleTotal } from '@/lib/excelReportStyles';
import type { Duplicata, FaixaResult } from '@/components/DuplicatasReceberDashboard/duplicatasAnalise';
import { analisarMultas } from './multasAnalise';

const CURRENCY_FMT = 'R$ #,##0.00';
const INT_FMT = '#,##0';

interface ExportParams {
  month: string;
  referenceDate: Date;
  titulos: Duplicata[];
}

/** Exporta o mês completo; filtros da tela não alteram o arquivo. */
export async function exportMultasExcel(params: ExportParams) {
  const workbook = buildMultasWorkbook(params);
  await downloadExcel(workbook, `Multas_Receber_${params.month}.xlsx`);
}

function buildMultasWorkbook({ month, referenceDate, titulos }: ExportParams): ExcelJS.Workbook {
  const analysis = analisarMultas(titulos);
  const { kpis } = analysis;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sorana Executive Dashboard';
  workbook.created = new Date();
  const info = `Mês: ${format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: ptBR })} · Data-base: ${format(referenceDate, 'dd/MM/yyyy')}`;
  const sheet = (name: string, headers: string[], widths: number[]) => {
    const ws = workbook.addWorksheet(name, { properties: { tabColor: { argb: HEADER_FILL } } });
    ws.columns = widths.map(width => ({ width }));
    styleTitle(ws, ws.addRow([`Multas a Receber — ${name}`]), headers.length);
    ws.addRow([info]);
    ws.addRow([]);
    styleHeader(ws.addRow(headers));
    ws.views = [{ state: 'frozen', ySplit: 4 }];
    return ws;
  };
  const addRow = (ws: ExcelJS.Worksheet, values: ExcelJS.CellValue[], formats: Record<number, string> = {}) => {
    const row = ws.addRow(values);
    for (const [column, numFmt] of Object.entries(formats)) row.getCell(Number(column)).numFmt = numFmt;
    borderDataRow(row);
    return row;
  };

  const resumo = sheet('Resumo', ['Indicador', 'Valor'], [54, 28]);
  const indicators: Array<[string, number, string]> = [
    ['Total a receber', kpis.totalReceber, CURRENCY_FMT],
    ['Vencido', kpis.totalVencido, CURRENCY_FMT],
    ['A vencer', kpis.totalAVencer, CURRENCY_FMT],
    ['Sem vencimento', analysis.semVencimento.valor, CURRENCY_FMT],
    ['% Vencido', kpis.percVencido, '0.0"%"'],
    ['Nº de títulos', kpis.qtdDuplicatas, INT_FMT],
    ['Nº de clientes', kpis.qtdClientes, INT_FMT],
    ['Ticket médio', kpis.ticketMedio, CURRENCY_FMT],
    ['Maior título', kpis.maiorDuplicata, CURRENCY_FMT],
    ['Títulos sem vencimento', analysis.semVencimento.qtd, INT_FMT],
  ];
  indicators.forEach(([label, value, numFmt]) => addRow(resumo, [label, value], { 2: numFmt }));
  resumo.addRow([]);
  resumo.addRow(['Vencimento anterior à data-base = vencido; vencimento na data-base = a vencer.']);
  resumo.addRow(['Sem vencimento: incluído no total, mas fora de vencido, a vencer e faixas.']);
  resumo.addRow(['Exportação integral do mês, sem os filtros da tela.']);

  const departamentos = sheet('Por Departamento', ['Departamento', 'Títulos', 'Total', 'Vencido', 'A vencer', 'Sem vencimento'], [28, 12, 22, 22, 22, 22]);
  const deptFormats = { 2: INT_FMT, 3: CURRENCY_FMT, 4: CURRENCY_FMT, 5: CURRENCY_FMT, 6: CURRENCY_FMT };
  analysis.departamentos.forEach(dept => addRow(departamentos,
    [dept.departamento, dept.qtd, dept.total, dept.vencido, dept.aVencer, dept.semVencimento], deptFormats));
  styleTotal(addRow(departamentos,
    ['Total', kpis.qtdDuplicatas, kpis.totalReceber, kpis.totalVencido, kpis.totalAVencer, analysis.semVencimento.valor], deptFormats));

  const faixaSheet = (name: string, faixas: FaixaResult[]) => {
    const ws = sheet(name, ['Faixa', 'Títulos', 'Valor'], [26, 14, 24]);
    faixas.forEach(faixa => addRow(ws, [faixa.label, faixa.qtd, faixa.valor], { 2: INT_FMT, 3: CURRENCY_FMT }));
    styleTotal(addRow(ws, ['Total', faixas.reduce((sum, faixa) => sum + faixa.qtd, 0), faixas.reduce((sum, faixa) => sum + faixa.valor, 0)],
      { 2: INT_FMT, 3: CURRENCY_FMT }));
  };
  faixaSheet('Vencidos por Faixa', analysis.faixasVencido);
  faixaSheet('A Vencer por Faixa', analysis.faixasAVencer);

  const clientes = sheet('Maiores Clientes', ['#', 'Cliente', 'Títulos', 'Total a receber'], [8, 48, 14, 24]);
  analysis.topClientes.forEach((cliente, i) => addRow(clientes,
    [i + 1, cliente.clienteNome, cliente.qtd, cliente.total], { 1: INT_FMT, 3: INT_FMT, 4: CURRENCY_FMT }));

  const detalhes = sheet('Títulos', ['Departamento', 'Origem', 'Cliente', 'CNPJ/CPF', 'Título', 'Parcela', 'Vencimento', 'Situação', 'Dias de atraso', 'Dias até vencer', 'Valor'],
    [26, 28, 48, 22, 18, 12, 18, 20, 18, 18, 24]);
  [...titulos].sort((a, b) => (a.vencimento?.getTime() ?? Infinity) - (b.vencimento?.getTime() ?? Infinity)).forEach(titulo => {
    addRow(detalhes, [
      titulo.departamento, titulo.nomeOrigem, titulo.clienteNome, titulo.cgccpf, titulo.titulo, titulo.duplicata,
      titulo.vencimento ?? '',
      !titulo.vencimento ? 'Sem vencimento' : titulo.vencido ? 'Vencido' : 'A vencer',
      titulo.vencimento ? titulo.diasAtraso : '',
      titulo.vencimento ? titulo.diasAteVencer : '',
      titulo.valor,
    ], { 7: 'dd/mm/yyyy', 9: INT_FMT, 10: INT_FMT, 11: CURRENCY_FMT });
  });
  detalhes.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + titulos.length, column: 11 } };
  styleTotal(addRow(detalhes, ['Total', '', '', '', '', '', '', '', '', '', kpis.totalReceber], { 11: CURRENCY_FMT }));
  return workbook;
}
