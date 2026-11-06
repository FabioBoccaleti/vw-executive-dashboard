import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getBaseGerencialMes,
  loadClassificacoesConta,
  loadContasTipoItem,
  loadRegrasDeptos,
  type BaseGerencialMesData,
  type BaseGerencialRow,
} from '@/components/BaseGerencialDashboard/baseGerencialStorage';
import { processCustoFixoPinheirosData } from '@/components/BaseGerencialDashboard/baseGerencialDataProcessor';

vi.mock('@/components/BaseGerencialDashboard/baseGerencialStorage', async importOriginal => ({
  ...await importOriginal<typeof import('@/components/BaseGerencialDashboard/baseGerencialStorage')>(),
  getBaseGerencialMes: vi.fn(),
  loadClassificacoesConta: vi.fn(),
  loadRegrasDeptos: vi.fn(),
  loadContasTipoItem: vi.fn(),
}));

const SALARIOS = '5110101001 - SALARIOS';
const ALUGUEL = '5110101002 - ALUGUEL';
const RECEITA = '3110101001 - RECEITA';
const CUSTO = '4110101001 - CUSTO';
const NOVOS = '101 - NOVOS (CCusto)';
const OFICINA = '103 - OFICINA (CCusto)';
const revenda = (numero: number) => `${numero} - REVENDA (Revenda)`;

function row(conta: string, valor: number, isMain = false): BaseGerencialRow {
  return {
    conta, isMain, saldoAnterior: 0, saldoAtual: 99999, saldoPeriodo: 99999,
    valCredito: valor > 0 ? valor : 0,
    valDebito: valor < 0 ? -valor : 0,
  };
}

function month(rows: BaseGerencialRow[]): BaseGerencialMesData {
  return { rows, totalRow: null, importedAt: '', fileName: 'teste.txt' };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getBaseGerencialMes).mockResolvedValue(null);
  vi.mocked(loadClassificacoesConta).mockResolvedValue({
    [SALARIOS]: 'despesas_pessoal',
    [ALUGUEL]: 'despesas_ocupacao',
    [RECEITA]: 'receita_vendas',
    [CUSTO]: 'custos_operacionais',
  });
  vi.mocked(loadRegrasDeptos).mockResolvedValue({
    '101 -': { default: 'veiculos_novos' },
    '103 -': { default: 'oficina' },
  });
  vi.mocked(loadContasTipoItem).mockResolvedValue([]);
});

describe('Custo Fixo Pinheiros — processamento', () => {
  it('soma apenas despesas das revendas 4 e 5 e detalha os departamentos, sem duplicar totais', async () => {
    vi.mocked(getBaseGerencialMes).mockResolvedValue(month([
      row(SALARIOS, -4000, true),
      row(NOVOS, -3000),
      row(revenda(4), -100),
      row('V - Veiculos (Tipo)', -100),
      row('999 - DETALHE', -100),
      row(revenda(5), -200),
      row(revenda(6), -2700),
      row(OFICINA, -1000),
      row(revenda(4), -300),
      row(revenda(5), -400),
      row(revenda(9), -300),
      row(RECEITA, 5000, true), row(NOVOS, 5000), row(revenda(4), 5000),
      row(CUSTO, -800, true), row(NOVOS, -800), row(revenda(5), -800),
      row(ALUGUEL, -50, true), row(NOVOS, -50), row(revenda(4), -50),
    ]));
    const data = await processCustoFixoPinheirosData(2026, 9);
    expect(getBaseGerencialMes).toHaveBeenCalledExactlyOnceWith(2026, 9);
    expect(data.total).toBe(-1050);
    expect(data.grupos.map(grupo => grupo.tipo)).toEqual(['despesas_pessoal', 'despesas_ocupacao']);
    expect(data.grupos[0]).toEqual({
      tipo: 'despesas_pessoal', subtotal: -1000,
      contas: [{
        conta: SALARIOS, valor: -1000,
        departamentos: [
          { departamento: 'Oficina', valor: -700 },
          { departamento: 'Veículos Novos', valor: -300 },
        ],
      }],
    });
  });

  it('também aceita Revenda antes de CCusto, sem herdar o departamento da revenda anterior', async () => {
    vi.mocked(getBaseGerencialMes).mockResolvedValue(month([
      row(SALARIOS, -1800, true),
      row(revenda(4), -300), row(NOVOS, -100), row(OFICINA, -200),
      row(revenda(6), -900), row(OFICINA, -900),
      row(revenda(5), -600), row(NOVOS, -600),
    ]));
    const data = await processCustoFixoPinheirosData(2026, 1);
    expect(data.total).toBe(-900);
    expect(data.grupos[0].contas[0].departamentos).toEqual([
      { departamento: 'Oficina', valor: -200 },
      { departamento: 'Veículos Novos', valor: -700 },
    ]);
  });

  it('aplica Tipo Item configurado, lubrificantes e residual no departamento padrão', async () => {
    vi.mocked(loadContasTipoItem).mockResolvedValue([SALARIOS]);
    vi.mocked(loadRegrasDeptos).mockResolvedValue({
      '101 -': { default: 'administracao', byTipoItem: { P: 'pecas', S: 'oficina', V: 'venda_direta' } },
    });
    vi.mocked(getBaseGerencialMes).mockResolvedValue(month([
      row(SALARIOS, -1000, true), row(NOVOS, -1000), row(revenda(4), -1000),
      row('P - Pecas (Tipo)', -100), row('999 - DETALHE', -100),
      row('S - Servicos (Tipo)', -200), row('V - Veiculos (Tipo)', -300),
      row('L - Lubrificantes (Tipo)', -50),
    ]));
    const data = await processCustoFixoPinheirosData(2026, 1);
    expect(data.total).toBe(-1000);
    expect(data.grupos[0].contas[0].departamentos).toEqual([
      { departamento: 'Administração', valor: -400 },
      { departamento: 'Oficina', valor: -200 },
      { departamento: 'Peças', valor: -100 },
      { departamento: 'Venda Direta', valor: -300 },
    ]);
  });

  it('ano todo soma os doze meses do ano solicitado e ignora meses sem importação', async () => {
    vi.mocked(getBaseGerencialMes).mockImplementation(async (year, mes) =>
      mes === 1 || mes === 9
        ? month([row(SALARIOS, -mes * 10, true), row(NOVOS, -mes * 10), row(revenda(4), -mes * 10)])
        : null
    );
    const data = await processCustoFixoPinheirosData(2025, 0);
    expect(getBaseGerencialMes).toHaveBeenCalledTimes(12);
    expect(vi.mocked(getBaseGerencialMes).mock.calls).toEqual(
      Array.from({ length: 12 }, (_, i) => [2025, i + 1])
    );
    expect(data.total).toBe(-100);
    expect(data.grupos[0].contas[0].departamentos).toEqual([
      { departamento: 'Veículos Novos', valor: -100 },
    ]);
  });

  it('preserva despesas sem regra de departamento, identificando o centro de custo', async () => {
    vi.mocked(loadRegrasDeptos).mockResolvedValue({});
    vi.mocked(getBaseGerencialMes).mockResolvedValue(month([
      row(ALUGUEL, -50, true), row(NOVOS, -50), row(revenda(5), -50),
    ]));
    const data = await processCustoFixoPinheirosData(2026, 1);
    expect(data.total).toBe(-50);
    expect(data.grupos[0].contas[0].departamentos).toEqual([
      { departamento: '101 - NOVOS (sem classificação)', valor: -50 },
    ]);
  });

  it('mantém grupos e contas com saldo zero quando há compensações entre departamentos', async () => {
    vi.mocked(getBaseGerencialMes).mockResolvedValue(month([
      row(SALARIOS, 0, true), row(NOVOS, -100), row(revenda(4), -100),
      row(OFICINA, 100), row(revenda(5), 100),
    ]));
    const data = await processCustoFixoPinheirosData(2026, 1);
    expect(data.total).toBe(0);
    expect(data.grupos).toHaveLength(1);
    expect(data.grupos[0].contas[0].departamentos).toHaveLength(2);
  });

  it('inclui depreciações e despesas financeiras, mas não outras rendas, provisões ou participações', async () => {
    const tipos = [
      'amortizacoes_depreciacoes', 'despesas_financeiras', 'outras_despesas_operacionais',
      'despesas_financeiras_nao_operacional', 'despesas_nao_operacionais',
      'outras_rendas_nao_operacionais', 'provisoes_irpj_cs', 'participacoes',
    ] as const;
    vi.mocked(loadClassificacoesConta).mockResolvedValue(
      Object.fromEntries(tipos.map((tipo, i) => [`500${i} - CONTA`, tipo]))
    );
    vi.mocked(getBaseGerencialMes).mockResolvedValue(month(tipos.flatMap((_, i) => [
      row(`500${i} - CONTA`, -10, true), row(NOVOS, -10), row(revenda(4), -10),
    ])));
    const data = await processCustoFixoPinheirosData(2026, 1);
    expect(data.total).toBe(-50);
    expect(data.grupos).toHaveLength(5);
  });

  it('retorna vazio sem dados e propaga falhas de carregamento', async () => {
    expect(await processCustoFixoPinheirosData(2026, 1)).toEqual({ grupos: [], total: 0 });
    vi.mocked(getBaseGerencialMes).mockRejectedValue(new Error('Falha de leitura'));
    await expect(processCustoFixoPinheirosData(2026, 1)).rejects.toThrow('Falha de leitura');
  });
});
