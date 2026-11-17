import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportVeiculosExcel } from '@/components/EstoqueUsadosVwDashboard/veiculosExport';
import { buildAnaliseVeiculos, separarEstoqueTestDrive } from '@/components/EstoqueUsadosVwDashboard/veiculosAnalise';
import type { VeiculoRow } from '@/components/EstoqueUsadosVwDashboard/veiculosStorage';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

const row = (chassi: string, modelo: string, valor: number): VeiculoRow => ({
  veiculo: chassi, chassi, modelo, valor, marca: 'AUDI', nf: '', identificacao: '', entrada: '2026-01-01',
});
const itens = [row('VIN-NOVO', 'AUDI A3', 100), row('VIN-TD', 'AUDI Q5', 200), row('VIN-CC', 'AUDI Q7', 300)];
const grade = [
  { chassi: 'VIN-TD', classificacao: 'test_drive' as const },
  { chassi: 'VIN-CC', classificacao: 'courtesy_car' as const },
];
const params = { name: 'Novos Audi', primary: '#bb0a30', month: '2026-11', baseDate: '2026-11-30' };

async function workbookBaixado() {
  expect(saveAs).toHaveBeenCalledOnce();
  const [blob, filename] = vi.mocked(saveAs).mock.calls[0];
  expect(filename).toBe('Novos_Audi_2026-11.xlsx');
  if (!(blob instanceof Blob)) throw new Error('Esperado um arquivo Excel');
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

describe('Excel de estoque separado por uso', () => {
  it('concilia o total com Novos e Test Drive e mantém somente Novos nas abas analíticas', async () => {
    const total = buildAnaliseVeiculos(itens, params.baseDate, 90);
    const separacao = separarEstoqueTestDrive(total.itens, grade);
    await exportVeiculosExcel({ ...params,
      analise: buildAnaliseVeiculos(separacao.novos, params.baseDate, 90), testDrive: separacao.testDrive });
    const workbook = await workbookBaixado();
    const resumo = workbook.getWorksheet('Resumo')!;
    const indicadores = new Map<string, ExcelJS.CellValue>();
    resumo.eachRow(r => { if (typeof r.getCell(1).value === 'string') indicadores.set(r.getCell(1).text, r.getCell(2).value); });
    expect(indicadores.get('Estoque total - veículos')).toBe(3);
    expect(indicadores.get('Estoque total - valor')).toBe(600);
    expect(indicadores.get('Estoque de Novos - veículos')).toBe(1);
    expect(indicadores.get('Estoque de Novos - valor')).toBe(100);
    expect(indicadores.get('Test Drive / Courtesy Car - veículos')).toBe(2);
    expect(indicadores.get('Test Drive / Courtesy Car - valor')).toBe(500);
    expect(indicadores.get('Ticket médio')).toBe(100);
    for (const name of ['Por Faixa de Dias', 'Por Marca', 'Por Modelo']) {
      const ws = workbook.getWorksheet(name)!;
      expect(ws.getRow(ws.rowCount).getCell(2).value).toBe(1);
      expect(ws.getRow(ws.rowCount).getCell(3).value).toBe(100);
    }
    const novos = workbook.getWorksheet('Veículos')!;
    expect(novos.rowCount).toBe(5);
    expect(novos.getCell('B4').value).toBe('VIN-NOVO');
    expect(novos.getCell('H5').value).toBe(100);
    const testDrive = workbook.getWorksheet('Test Drive - Courtesy Car')!;
    expect(testDrive.getCell('B4').value).toBe('VIN-TD');
    expect(testDrive.getCell('C4').value).toBe('Test Drive');
    expect(testDrive.getCell('C5').value).toBe('Courtesy Car');
    expect(testDrive.getCell('E4').value).toBe(200);
    expect(testDrive.getCell('E4').numFmt).toBe('R$ #,##0.00');
    expect(testDrive.getCell('E6').value).toBe(500);
  });

  it('exporta normalmente quando só há Test Drive, com totais de Novos zerados', async () => {
    const total = buildAnaliseVeiculos(itens.slice(1), params.baseDate, 90);
    const separacao = separarEstoqueTestDrive(total.itens, grade);
    await exportVeiculosExcel({ ...params,
      analise: buildAnaliseVeiculos(separacao.novos, params.baseDate, 90), testDrive: separacao.testDrive });
    const workbook = await workbookBaixado();
    const novos = workbook.getWorksheet('Veículos')!;
    expect(novos.getCell('H4').value).toBe(0);
    expect(workbook.getWorksheet('Test Drive - Courtesy Car')!.getCell('E6').value).toBe(500);
  });

  it('preserva as abas e os totais anteriores quando a separação não se aplica', async () => {
    await exportVeiculosExcel({ ...params, analise: buildAnaliseVeiculos(itens, params.baseDate, 90) });
    const workbook = await workbookBaixado();
    expect(workbook.worksheets.map(ws => ws.name)).toEqual(['Resumo', 'Por Faixa de Dias', 'Por Marca', 'Por Modelo', 'Veículos']);
    const novos = workbook.getWorksheet('Veículos')!;
    expect(novos.rowCount).toBe(7);
    expect(novos.getCell('H7').value).toBe(600);
  });
});
