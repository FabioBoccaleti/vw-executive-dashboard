import { beforeEach, describe, expect, it, vi } from 'vitest';
import { kvGet, kvKeys, kvSet } from '@/lib/kvClient';
import { analisarMultas, parseMultas } from '@/components/MultasReceberDashboard/multasAnalise';
import {
  getMultas, getMultasBaseDate, getMultasMonths, parseMultasTxt, saveMultas, saveMultasBaseDate,
} from '@/components/MultasReceberDashboard/multasStorage';
import { decodeFileBuffer } from '@/components/DuplicatasReceberDashboard/duplicatasStorage';

vi.mock('@/lib/kvClient', () => ({ kvGet: vi.fn(), kvKeys: vi.fn(), kvSet: vi.fn() }));

const txt = [
  'DEPARTAMENTO;NOME_DEPARTAMENTO;CLIENTE;NOME_CLIENTE;TITULO;DUPLICATA;VENCIDO;AVENCER;DTA_VENCIMENTO;NOME_ORIGEM;',
  '102;VEICULOS USADOS;1;CLIENTE TESTE A;001;01;1.200,50;;16/11/2026;MULTA;',
  '102;VEICULOS USADOS;1;CLIENTE TESTE A;002;01;;200,00;17/11/2026;OUTRA ORIGEM;',
  '301;ADMINISTRACAO;2;CLIENTE TESTE B;003;01;300,00;;18/11/2026;DESPESA;',
  '301;ADMINISTRACAO;3;CLIENTE TESTE C;004;01;;50,00;;MULTA;',
  ';;;;;;1.750,50;;;;',
].join('\r\n');

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(kvSet).mockResolvedValue(true);
  vi.mocked(kvGet).mockResolvedValue(null);
  vi.mocked(kvKeys).mockResolvedValue([]);
});

describe('multas consolidadas', () => {
  it('lê TXT com BOM, ignora totais e inclui todos os títulos e origens', () => {
    const data = parseMultasTxt(`\uFEFF${txt}`);
    expect(data.rows).toHaveLength(4);
    const titulos = parseMultas(data, new Date(2026, 10, 17));
    const analysis = analisarMultas(titulos);
    expect(analysis.kpis.totalReceber).toBeCloseTo(1750.5);
    expect(analysis.kpis.totalVencido).toBeCloseTo(1200.5);
    expect(analysis.kpis.totalAVencer).toBe(500);
    expect(analysis.kpis.qtdClientes).toBe(3);
    expect(analysis.semVencimento).toEqual({ qtd: 1, valor: 50 });
    expect(analysis.faixasVencido[0].qtd).toBe(1);
    expect(analysis.faixasAVencer[0].qtd).toBe(2);
    expect(analysis.topClientes[0].total).toBeCloseTo(1400.5);
    expect(analysis.departamentos.map(dept => dept.departamento)).toEqual(['VEICULOS USADOS', 'ADMINISTRACAO']);
    expect(analysis.departamentos[1].aVencer).toBe(300);
    expect(analysis.departamentos[1].semVencimento).toBe(50);
    expect(titulos[0].diasAtraso).toBe(1);
    expect(titulos[1].vencido).toBe(false);
    expect(analisarMultas(parseMultas(data, new Date(2026, 10, 19))).kpis.totalVencido).toBeCloseTo(1700.5);
  });

  it('decodifica TXT Windows-1252 preservando acentos', () => {
    const buffer = new Uint8Array([0x41, 0xc7, 0xc3, 0x4f]).buffer;
    expect(decodeFileBuffer(buffer)).toBe('AÇÃO');
  });

  it('rejeita cabeçalhos, datas e valores inválidos em vez de salvar saldos incorretos', () => {
    expect(() => parseMultasTxt('CLIENTE;VALOR\nA;100')).toThrow('Colunas obrigatórias');
    expect(() => parseMultasTxt(txt.replace('1.200,50', 'invalido'))).toThrow('Valor inválido');
    expect(() => parseMultasTxt(txt.replace('16/11/2026', '31/02/2026'))).toThrow('Vencimento inválido');
    expect(() => parseMultasTxt(txt.split('\r\n')[0])).toThrow('não contém títulos');
  });

  it('isola posição e data-base por mês sem utilizar chaves de duplicatas ou de marca', async () => {
    const data = { ...parseMultasTxt(txt), month: '2026-11', fileName: 'teste.txt', importedAt: 0 };
    await saveMultas(data);
    await getMultas('2026-11');
    await saveMultasBaseDate('2026-11', '2026-11-17');
    await getMultasBaseDate('2026-11');
    vi.mocked(kvKeys).mockResolvedValue([
      'multas_receber:posicao:2026-10', 'multas_receber:posicao:2026-11', 'multas_receber:posicao:2026-13',
    ]);
    expect(await getMultasMonths()).toEqual(['2026-11', '2026-10']);
    expect(kvSet).toHaveBeenCalledWith('multas_receber:posicao:2026-11', data);
    expect(kvGet).toHaveBeenCalledWith('multas_receber:posicao:2026-11', { throwOnError: true });
    expect(kvSet).toHaveBeenCalledWith('multas_receber:base_date:2026-11', '2026-11-17');
    expect(kvGet).toHaveBeenCalledWith('multas_receber:base_date:2026-11', { throwOnError: true });
  });

  it('propaga falhas de persistência sem retornar sucesso', async () => {
    vi.mocked(kvSet).mockResolvedValue(false);
    await expect(saveMultas({ ...parseMultasTxt(txt), month: '2026-11', fileName: 'teste.txt', importedAt: 0 })).rejects.toThrow('Não foi possível salvar');
    await expect(saveMultasBaseDate('2026-11', '2026-11-17')).rejects.toThrow('Não foi possível salvar');
    vi.mocked(kvGet).mockRejectedValue(new Error('Sem conexão'));
    await expect(getMultas('2026-11')).rejects.toThrow('Sem conexão');
  });
});
