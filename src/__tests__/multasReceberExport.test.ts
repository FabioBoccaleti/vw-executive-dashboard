import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportMultasExcel } from '@/components/MultasReceberDashboard/multasExport';
import { parseMultas } from '@/components/MultasReceberDashboard/multasAnalise';
import { parseMultasTxt } from '@/components/MultasReceberDashboard/multasStorage';
import { exportDuplicatasExcel } from '@/components/DuplicatasReceberDashboard/duplicatasExport';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

const data = parseMultasTxt([
  'DEPARTAMENTO;NOME_DEPARTAMENTO;CLIENTE;NOME_CLIENTE;TITULO;VENCIDO;AVENCER;DTA_VENCIMENTO;',
  '102;USADOS;1;CLIENTE A;001;100,25;;16/11/2026;',
  '301;ADMIN;2;CLIENTE B;002;;200,50;18/11/2026;',
  '102;USADOS;3;CLIENTE C;003;;50,00;17/11/2026;',
  '102;USADOS;1;CLIENTE A;004;;25,00;;',
].join('\n'));

async function downloadedWorkbook(filename: string) {
  expect(saveAs).toHaveBeenCalledOnce();
  const [blob, name] = vi.mocked(saveAs).mock.calls[0];
  expect(name).toBe(filename);
  expect(blob).toBeInstanceOf(Blob);
  if (!(blob instanceof Blob)) throw new Error('Esperado arquivo Excel em Blob');
  expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error('Arquivo inválido'));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

describe('Excel de Multas a Receber', () => {
  it('gera XLSX com resumos conciliados, datas e valores numéricos e títulos sem vencimento separados', async () => {
    const referenceDate = new Date(2026, 10, 17);
    await exportMultasExcel({ month: '2026-11', referenceDate, titulos: parseMultas(data, referenceDate) });
    const workbook = await downloadedWorkbook('Multas_Receber_2026-11.xlsx');
    expect(workbook.worksheets.map(ws => ws.name)).toEqual([
      'Resumo', 'Por Departamento', 'Vencidos por Faixa', 'A Vencer por Faixa', 'Maiores Clientes', 'Títulos',
    ]);
    const resumo = workbook.getWorksheet('Resumo')!;
    expect(resumo.getCell('A2').value).toContain('Data-base: 17/11/2026');
    expect(resumo.getCell('B5').value).toBe(375.75);
    expect(resumo.getCell('B6').value).toBe(100.25);
    expect(resumo.getCell('B7').value).toBe(250.5);
    expect(resumo.getCell('B8').value).toBe(25);
    expect(resumo.getCell('B5').numFmt).toBe('R$ #,##0.00');
    const dept = workbook.getWorksheet('Por Departamento')!;
    expect(dept.getRow(dept.rowCount).values).toEqual([, 'Total', 4, 375.75, 100.25, 250.5, 25]);
    const vencidos = workbook.getWorksheet('Vencidos por Faixa')!;
    expect(vencidos.getRow(vencidos.rowCount).values).toEqual([, 'Total', 1, 100.25]);
    const avencer = workbook.getWorksheet('A Vencer por Faixa')!;
    expect(avencer.getRow(avencer.rowCount).values).toEqual([, 'Total', 2, 250.5]);
    expect(workbook.getWorksheet('Maiores Clientes')!.rowCount).toBe(7);
    const titulos = workbook.getWorksheet('Títulos')!;
    expect(titulos.getCell('E5').value).toBe('001');
    expect(titulos.getCell('G5').value).toBeInstanceOf(Date);
    expect(titulos.getCell('G5').numFmt).toBe('dd/mm/yyyy');
    expect(titulos.getCell('H6').value).toBe('A vencer');
    expect(titulos.getCell('E8').value).toBe('004');
    expect(titulos.getCell('G8').value).toBe('');
    expect(titulos.getCell('H8').value).toBe('Sem vencimento');
    expect(titulos.getCell('K9').value).toBe(375.75);
    expect(titulos.autoFilter).toBe('A4:K8');
  });

  it('preserva a exportação de Duplicatas após compartilhar os estilos', async () => {
    const referenceDate = new Date(2026, 10, 17);
    await exportDuplicatasExcel({
      marca: { id: 'vw', name: 'VW', primary: '#001e50', primaryLight: '#e8f4fc' },
      month: '2026-11', referenceDate,
      duplicatas: parseMultas(data, referenceDate).filter(titulo => titulo.vencimento),
    });
    const workbook = await downloadedWorkbook('Duplicatas_Receber_VW_2026-11.xlsx');
    expect(workbook.worksheets).toHaveLength(8);
    const resumo = workbook.getWorksheet('Resumo')!;
    expect(resumo.getCell('A1').value).toBe('Duplicatas a Receber — Posição');
    expect(resumo.getCell('B7').value).toBe(350.75);
    expect(resumo.getCell('B7').numFmt).toBe('R$ #,##0.00');
    expect(resumo.getCell('A6').fill).toEqual({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } });
    const detalhes = workbook.getWorksheet('Duplicatas')!;
    expect(detalhes.getCell(`I${detalhes.rowCount}`).value).toBe(350.75);
  });
});
