import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { isSitHeader, type ControleVeiculosBrand } from './controleVeiculosStorage';
import type { ControleVeiculosRegras } from './controleVeiculosRegrasStorage';
import type { ControleVeiculosLimites } from './controleVeiculosLimitesStorage';
import type { GarantiaBanco, VeiculoGarantiaEntry, VeiculoHistoricoEntry } from './veiculosGarantiaStorage';
import { GARANTIA_BANCO_LABEL } from './veiculosGarantiaStorage';
import {
  todayISO,
  addDaysISO,
  diffDaysISO,
  estimativaJuros,
  computeSaldoItau,
  computeSaldoVolksPorDN,
  type SaldoInfo,
} from './controleVeiculosCalc';

const CURRENCY_FMT = 'R$ #,##0.00';
const INT_FMT = '#,##0';
const TITLE_FILL = 'FF075985'; // sky-800
const HEADER_FILL = 'FF0284C7'; // sky-600
const TOTAL_FILL = 'FFE0F2FE'; // sky-100
const THIN = 'FFE2E8F0'; // slate-200

const BRAND_LABEL: Record<ControleVeiculosBrand, string> = { vw: 'VW', audi: 'Audi' };

export interface GarantiaExportData {
  regras: ControleVeiculosRegras;
  limites: ControleVeiculosLimites;
  garantiaItau: VeiculoGarantiaEntry[];
  garantiaVolks: VeiculoGarantiaEntry[];
  historicoItau: VeiculoHistoricoEntry[];
  historicoVolks: VeiculoHistoricoEntry[];
}

function dateBR(iso: string | null | undefined): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side = { style: 'thin' as const, color: { argb: THIN } };
  return { top: side, bottom: side, left: side, right: side };
}

function styleTitle(ws: ExcelJS.Worksheet, row: ExcelJS.Row, colspan: number) {
  ws.mergeCells(row.number, 1, row.number, Math.max(colspan, 1));
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
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
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

/** Colunas dinâmicas (Sit + colunas selecionadas nas Regras), na mesma ordem exibida na tela. */
function computeRuleCols(entries: VeiculoGarantiaEntry[], regras: ControleVeiculosRegras): string[] {
  if (entries.length === 0) return [];
  const keys = Object.keys(entries[0].record);
  const sitKey = keys.find(isSitHeader);
  const selected = new Set(regras.colunas);
  return keys.filter(key => key === sitKey || selected.has(key));
}

type SheetKind = 'garantia' | 'historico';

/** Monta uma planilha de veículos (garantia ou histórico) replicando as colunas da tela. */
function buildEntriesSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  titulo: string,
  banco: GarantiaBanco,
  entries: VeiculoGarantiaEntry[],
  regras: ControleVeiculosRegras,
  kind: SheetKind,
) {
  const ws = wb.addWorksheet(sheetName, { properties: { tabColor: { argb: HEADER_FILL } } });
  const showDN = banco === 'volks';
  const ruleCols = computeRuleCols(entries, regras);
  const taxaJuros = banco === 'itau' ? regras.taxaJurosItau : regras.taxaJurosVolks;

  const headers: string[] = [];
  if (showDN) headers.push('DN');
  headers.push(...ruleCols);
  headers.push('Marca', 'Valor da Garantia', 'Estimativa de Juros', 'Data de inclusão', 'Dias em Garantia', 'Data de vencimento');
  headers.push(kind === 'garantia' ? 'Status' : 'Data de pagamento');

  // Índices (1-based) das colunas numéricas para aplicar formato.
  const valorCol = headers.indexOf('Valor da Garantia') + 1;
  const jurosCol = headers.indexOf('Estimativa de Juros') + 1;
  const diasCol = headers.indexOf('Dias em Garantia') + 1;

  ws.columns = headers.map(h => ({ width: Math.min(Math.max(h.length + 4, 12), 30) }));

  styleTitle(ws, ws.addRow([titulo]), headers.length);
  const infoRow = ws.addRow([`${GARANTIA_BANCO_LABEL[banco]} · ${entries.length} veículo(s)`]);
  infoRow.font = { italic: true, color: { argb: 'FF64748B' } };
  ws.addRow([]);

  styleHeader(ws.addRow(headers));

  let totalValor = 0;
  let totalJuros = 0;

  for (const entry of entries) {
    const dataFim = kind === 'historico' ? (entry as VeiculoHistoricoEntry).dataPagamento : todayISO();
    const diasEmGarantia = diffDaysISO(entry.dataInclusao, dataFim);
    const juros = estimativaJuros(entry.valorGarantia, taxaJuros, diasEmGarantia);
    const diasVenc = entry.diasVencimento ?? null;
    const vencimentoISO = diasVenc != null ? addDaysISO(entry.dataInclusao, diasVenc) : null;

    const values: (string | number)[] = [];
    if (showDN) values.push(entry.linhaCreditoDN ?? '');
    for (const col of ruleCols) values.push(entry.record[col] ?? '');
    values.push(BRAND_LABEL[entry.brand]);
    values.push(entry.valorGarantia);
    values.push(juros ?? 0);
    values.push(dateBR(entry.dataInclusao));
    values.push(diasEmGarantia ?? '');
    values.push(dateBR(vencimentoISO));

    if (kind === 'garantia') {
      const vencido = vencimentoISO != null && todayISO() > vencimentoISO;
      values.push(vencimentoISO == null ? '—' : vencido ? 'Vencido' : 'A vencer');
    } else {
      values.push(dateBR((entry as VeiculoHistoricoEntry).dataPagamento));
    }

    const row = ws.addRow(values);
    row.getCell(valorCol).numFmt = CURRENCY_FMT;
    row.getCell(jurosCol).numFmt = CURRENCY_FMT;
    row.getCell(diasCol).numFmt = INT_FMT;
    borderDataRow(row);

    totalValor += entry.valorGarantia;
    if (juros != null) totalJuros += juros;
  }

  // Linha de total
  const totalValues: (string | number)[] = new Array(headers.length).fill('');
  totalValues[0] = `Total (${entries.length} veículo${entries.length === 1 ? '' : 's'})`;
  totalValues[valorCol - 1] = totalValor;
  totalValues[jurosCol - 1] = totalJuros;
  const totalRow = ws.addRow(totalValues);
  totalRow.getCell(valorCol).numFmt = CURRENCY_FMT;
  totalRow.getCell(jurosCol).numFmt = CURRENCY_FMT;
  styleTotal(totalRow);

  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

/** Planilha de resumo com saldos (Itaú e Volks por DN) e totais por banco. */
function buildResumoSheet(wb: ExcelJS.Workbook, data: GarantiaExportData) {
  const { regras, limites, garantiaItau, garantiaVolks, historicoItau, historicoVolks } = data;
  const ws = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: TITLE_FILL } } });
  ws.columns = [{ width: 40 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];

  styleTitle(ws, ws.addRow(['Controle de Veículos FloorPlan — Veículos em Garantia']), 5);
  const infoRow = ws.addRow([`Gerado em ${dateBR(todayISO())}`]);
  infoRow.font = { italic: true, color: { argb: 'FF64748B' } };
  ws.addRow([]);

  // Saldo Banco Itaú
  const itau = computeSaldoItau(limites, garantiaItau, regras);
  styleTitle(ws, ws.addRow(['Saldo — Banco Itaú']), 5);
  styleHeader(ws.addRow(['Limite', 'Utilizado', 'Juros', 'Abater juros?', 'Saldo disponível']));
  const itauRow = ws.addRow([
    itau.limite ?? 0,
    itau.utilizado,
    itau.juros,
    itau.abater ? 'Sim' : 'Não',
    itau.saldo,
  ]);
  [1, 2, 3, 5].forEach(c => { itauRow.getCell(c).numFmt = CURRENCY_FMT; });
  borderDataRow(itauRow);
  ws.addRow([]);

  // Saldo Banco Volks por DN
  const volks = computeSaldoVolksPorDN(limites, garantiaVolks, regras);
  styleTitle(ws, ws.addRow(['Saldo — Banco Volks (por linha de crédito DN)']), 5);
  styleHeader(ws.addRow(['DN', 'Limite', 'Utilizado', 'Juros', 'Saldo disponível']));
  if (volks.length === 0) {
    borderDataRow(ws.addRow(['Nenhum DN cadastrado', '', '', '', '']));
  } else {
    for (const row of volks) {
      const r = ws.addRow([row.dn, row.limite ?? 0, row.utilizado, row.juros, row.saldo]);
      [2, 3, 4, 5].forEach(c => { r.getCell(c).numFmt = CURRENCY_FMT; });
      borderDataRow(r);
    }
    const sum = (fn: (s: SaldoInfo) => number) => volks.reduce((acc, s) => acc + fn(s), 0);
    const totalRow = ws.addRow([
      'Total',
      sum(s => s.limite ?? 0),
      sum(s => s.utilizado),
      sum(s => s.juros),
      sum(s => s.saldo),
    ]);
    [2, 3, 4, 5].forEach(c => { totalRow.getCell(c).numFmt = CURRENCY_FMT; });
    styleTotal(totalRow);
  }
  ws.addRow([]);

  // Totais por banco (garantia e histórico)
  styleTitle(ws, ws.addRow(['Totais por banco']), 5);
  styleHeader(ws.addRow(['Grupo', 'Veículos', 'Valor da Garantia', 'Estimativa de Juros', '']));
  const grupoRow = (label: string, entries: VeiculoGarantiaEntry[], banco: GarantiaBanco, kind: SheetKind) => {
    const taxa = banco === 'itau' ? regras.taxaJurosItau : regras.taxaJurosVolks;
    let valor = 0;
    let juros = 0;
    for (const e of entries) {
      valor += e.valorGarantia;
      const fim = kind === 'historico' ? (e as VeiculoHistoricoEntry).dataPagamento : todayISO();
      const j = estimativaJuros(e.valorGarantia, taxa, diffDaysISO(e.dataInclusao, fim));
      if (j != null) juros += j;
    }
    const r = ws.addRow([label, entries.length, valor, juros, '']);
    r.getCell(2).numFmt = INT_FMT;
    r.getCell(3).numFmt = CURRENCY_FMT;
    r.getCell(4).numFmt = CURRENCY_FMT;
    borderDataRow(r);
  };
  grupoRow('Garantia — Banco Itaú', garantiaItau, 'itau', 'garantia');
  grupoRow('Garantia — Banco Volks', garantiaVolks, 'volks', 'garantia');
  grupoRow('Histórico — Banco Itaú', historicoItau, 'itau', 'historico');
  grupoRow('Histórico — Banco Volks', historicoVolks, 'volks', 'historico');
}

/** Gera e baixa a exportação em Excel da aba "Veículos em Garantia", com abas separadas. */
export async function exportGarantiaExcel(data: GarantiaExportData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();

  buildResumoSheet(wb, data);
  buildEntriesSheet(wb, 'Banco Itaú', 'Veículos em Garantia — Banco Itaú', 'itau', data.garantiaItau, data.regras, 'garantia');
  buildEntriesSheet(wb, 'Banco Volks', 'Veículos em Garantia — Banco Volks', 'volks', data.garantiaVolks, data.regras, 'garantia');

  const historico = [
    ...data.historicoItau.map(e => ({ entry: e, banco: 'itau' as GarantiaBanco })),
    ...data.historicoVolks.map(e => ({ entry: e, banco: 'volks' as GarantiaBanco })),
  ];
  buildHistoricoSheet(wb, data.regras, historico);

  await download(wb, `Controle_Veiculos_Garantia_${todayISO()}.xlsx`);
}

/** Planilha única de Histórico de Movimentação combinando os dois bancos. */
function buildHistoricoSheet(
  wb: ExcelJS.Workbook,
  regras: ControleVeiculosRegras,
  items: { entry: VeiculoHistoricoEntry; banco: GarantiaBanco }[],
) {
  const ws = wb.addWorksheet('Histórico de Movimentação', { properties: { tabColor: { argb: HEADER_FILL } } });
  const allEntries = items.map(i => i.entry);
  const ruleCols = computeRuleCols(allEntries, regras);

  const headers = ['Banco', 'DN', ...ruleCols, 'Marca', 'Valor da Garantia', 'Estimativa de Juros', 'Data de inclusão', 'Dias em Garantia', 'Data de vencimento', 'Data de pagamento'];
  const valorCol = headers.indexOf('Valor da Garantia') + 1;
  const jurosCol = headers.indexOf('Estimativa de Juros') + 1;
  const diasCol = headers.indexOf('Dias em Garantia') + 1;

  ws.columns = headers.map(h => ({ width: Math.min(Math.max(h.length + 4, 12), 30) }));

  styleTitle(ws, ws.addRow(['Histórico de Movimentação — Veículos Pagos']), headers.length);
  const infoRow = ws.addRow([`${items.length} veículo(s) pago(s)`]);
  infoRow.font = { italic: true, color: { argb: 'FF64748B' } };
  ws.addRow([]);

  styleHeader(ws.addRow(headers));

  let totalValor = 0;
  let totalJuros = 0;

  for (const { entry, banco } of items) {
    const taxa = banco === 'itau' ? regras.taxaJurosItau : regras.taxaJurosVolks;
    const diasEmGarantia = diffDaysISO(entry.dataInclusao, entry.dataPagamento);
    const juros = estimativaJuros(entry.valorGarantia, taxa, diasEmGarantia);
    const diasVenc = entry.diasVencimento ?? null;
    const vencimentoISO = diasVenc != null ? addDaysISO(entry.dataInclusao, diasVenc) : null;

    const values: (string | number)[] = [GARANTIA_BANCO_LABEL[banco], entry.linhaCreditoDN ?? ''];
    for (const col of ruleCols) values.push(entry.record[col] ?? '');
    values.push(BRAND_LABEL[entry.brand]);
    values.push(entry.valorGarantia);
    values.push(juros ?? 0);
    values.push(dateBR(entry.dataInclusao));
    values.push(diasEmGarantia ?? '');
    values.push(dateBR(vencimentoISO));
    values.push(dateBR(entry.dataPagamento));

    const row = ws.addRow(values);
    row.getCell(valorCol).numFmt = CURRENCY_FMT;
    row.getCell(jurosCol).numFmt = CURRENCY_FMT;
    row.getCell(diasCol).numFmt = INT_FMT;
    borderDataRow(row);

    totalValor += entry.valorGarantia;
    if (juros != null) totalJuros += juros;
  }

  const totalValues: (string | number)[] = new Array(headers.length).fill('');
  totalValues[0] = `Total (${items.length} veículo${items.length === 1 ? '' : 's'})`;
  totalValues[valorCol - 1] = totalValor;
  totalValues[jurosCol - 1] = totalJuros;
  const totalRow = ws.addRow(totalValues);
  totalRow.getCell(valorCol).numFmt = CURRENCY_FMT;
  totalRow.getCell(jurosCol).numFmt = CURRENCY_FMT;
  styleTotal(totalRow);

  ws.views = [{ state: 'frozen', ySplit: 4 }];
}
