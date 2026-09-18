import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  CLASSIFICACAO_LABELS,
  calcularRentabilidade,
  diasEntreISO,
  situacaoVendaVeiculo,
  vencimentoGradeVeiculo,
  type GradeTrimestre,
  type VeiculoGrade,
} from './gradeTestDriveStorage';

const CURRENCY_FMT = 'R$ #,##0.00';
const PERCENT_FMT = '0.0"%"';
const HEADER_FILL = 'FF0891B2'; // cyan-600
const TITLE_FILL = 'FF155E75'; // cyan-800

interface ObrigacaoLinha {
  modelo: string;
  classificacao: keyof typeof CLASSIFICACAO_LABELS;
  quantidade: number;
  elegiveis: number;
  faltam: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function styleTitle(row: ExcelJS.Row, colspan: number, ws: ExcelJS.Worksheet) {
  ws.mergeCells(row.number, 1, row.number, colspan);
  row.height = 26;
  const cell = row.getCell(1);
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_FILL } };
  cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
}

function styleSectionHeader(row: ExcelJS.Row) {
  row.height = 22;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
}

async function download(wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

export async function exportGestaoGradeExcel(params: {
  ano: number;
  trimestre: number;
  obrigacoes: ObrigacaoLinha[];
  elegiveis: VeiculoGrade[];
  emEstoqueNaoElegiveis: VeiculoGrade[];
  vendidos: VeiculoGrade[];
  grades: GradeTrimestre[];
  hoje: string;
}) {
  const { ano, trimestre, obrigacoes, elegiveis, emEstoqueNaoElegiveis, vendidos, grades, hoje } = params;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();
  const ws = wb.addWorksheet('Gestão da Grade', { properties: { tabColor: { argb: HEADER_FILL } } });
  ws.columns = Array.from({ length: 7 }, () => ({ width: 22 }));

  styleTitle(ws.addRow([`Gestão da Grade — ${trimestre}º trimestre de ${ano}`]), 7, ws);
  ws.addRow([]);

  // Obrigação de compra
  styleTitle(ws.addRow(['Obrigação de compra']), 7, ws);
  styleSectionHeader(ws.addRow(['Modelo', 'Classificação', 'Exigido', 'Elegíveis', 'Faltam comprar']));
  obrigacoes.forEach(item => {
    ws.addRow([item.modelo, CLASSIFICACAO_LABELS[item.classificacao], item.quantidade, item.elegiveis, item.faltam]);
  });
  const totalRow = ws.addRow([
    'Total',
    '',
    obrigacoes.reduce((sum, item) => sum + item.quantidade, 0),
    obrigacoes.reduce((sum, item) => sum + item.elegiveis, 0),
    obrigacoes.reduce((sum, item) => sum + item.faltam, 0),
  ]);
  totalRow.font = { bold: true };
  totalRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; });
  ws.addRow([]);

  const veiculoHeader = ['Modelo', 'Chassi', 'Classificação', 'Compra', 'Venc. grade', 'Situação', 'Venda'];
  const addVeiculoSection = (titulo: string, lista: VeiculoGrade[], comSituacao: boolean) => {
    styleTitle(ws.addRow([`${titulo} (${lista.length})`]), 7, ws);
    styleSectionHeader(ws.addRow(veiculoHeader));
    if (lista.length === 0) {
      ws.addRow(['—']);
    } else {
      lista.forEach(v => {
        ws.addRow([
          v.modelo,
          v.chassi,
          CLASSIFICACAO_LABELS[v.classificacao],
          formatDate(v.dataCompra),
          formatDate(vencimentoGradeVeiculo(v, grades)),
          comSituacao ? (situacaoVendaVeiculo(v, grades, hoje) === 'disponivel' ? 'Disponível para Venda' : 'Bloqueado para venda') : '—',
          formatDate(v.dataVenda),
        ]);
      });
    }
    ws.addRow([]);
  };

  addVeiculoSection('Elegíveis (garantem a grade)', elegiveis, true);
  addVeiculoSection('Em estoque, não elegíveis no trimestre', emEstoqueNaoElegiveis, true);
  addVeiculoSection('Vendidos', vendidos, false);

  await download(wb, `gestao-grade-${ano}-T${trimestre}.xlsx`);
}

export async function exportResultadoVendasExcel(params: {
  titulo: string;
  filename: string;
  veiculos: VeiculoGrade[];
}) {
  const { titulo, filename, veiculos } = params;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();
  const ws = wb.addWorksheet('Resultado das Vendas', { properties: { tabColor: { argb: HEADER_FILL } } });

  const headers = [
    'Modelo', 'Chassi', 'Compra', 'Venda', 'Dias estoque',
    'Venda R$', 'Impostos', 'Receita Líq.', 'Custo Compra', 'Lucro Bruto',
    'Emplac.', 'IPVA', 'Juros', 'Cortesia', 'Créd. ICMS', 'Lucro Líq.', 'Margem',
  ];
  ws.columns = headers.map((_, index) => ({ width: index < 5 ? 16 : 15 }));

  styleTitle(ws.addRow([titulo]), headers.length, ws);
  styleSectionHeader(ws.addRow(headers));

  const currencyCols = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  const totais = { valorVenda: 0, impostos: 0, receitaLiquida: 0, custoCompra: 0, lucroBruto: 0, custoEmplacamento: 0, custoIPVA: 0, jurosEstoque: 0, cortesia: 0, creditoICMS: 0, lucroLiquido: 0 };

  veiculos.forEach(v => {
    const r = calcularRentabilidade(v);
    totais.valorVenda += r.valorVenda;
    totais.impostos += r.impostos;
    totais.receitaLiquida += r.receitaLiquida;
    totais.custoCompra += r.custoCompra;
    totais.lucroBruto += r.lucroBruto;
    totais.custoEmplacamento += r.custoEmplacamento;
    totais.custoIPVA += r.custoIPVA;
    totais.jurosEstoque += r.jurosEstoque;
    totais.cortesia += r.cortesia;
    totais.creditoICMS += r.creditoICMS;
    totais.lucroLiquido += r.lucroLiquido;
    const row = ws.addRow([
      v.modelo,
      v.chassi,
      formatDate(v.dataCompra),
      formatDate(v.dataVenda),
      v.dataVenda ? diasEntreISO(v.dataCompra, v.dataVenda) : '—',
      r.valorVenda, r.impostos, r.receitaLiquida, r.custoCompra, r.lucroBruto,
      r.custoEmplacamento, r.custoIPVA, r.jurosEstoque, r.cortesia, r.creditoICMS, r.lucroLiquido, r.margem,
    ]);
    currencyCols.forEach(col => { row.getCell(col).numFmt = CURRENCY_FMT; });
    row.getCell(17).numFmt = PERCENT_FMT;
  });

  const margemTotal = totais.valorVenda > 0 ? (totais.lucroLiquido / totais.valorVenda) * 100 : 0;
  const totalRow = ws.addRow([
    `Total (${veiculos.length})`, '', '', '', '',
    totais.valorVenda, totais.impostos, totais.receitaLiquida, totais.custoCompra, totais.lucroBruto,
    totais.custoEmplacamento, totais.custoIPVA, totais.jurosEstoque, totais.cortesia, totais.creditoICMS, totais.lucroLiquido, margemTotal,
  ]);
  totalRow.font = { bold: true };
  currencyCols.forEach(col => { totalRow.getCell(col).numFmt = CURRENCY_FMT; });
  totalRow.getCell(17).numFmt = PERCENT_FMT;
  totalRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  });

  await download(wb, filename);
}
