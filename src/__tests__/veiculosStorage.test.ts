import { beforeEach, describe, expect, it, vi } from 'vitest';
import { kvDelete, kvGet, kvKeys, kvSet } from '@/lib/kvClient';
import {
  deleteInventarioVeiculos,
  getAvailableMonthsVeiculos,
  getInventarioVeiculos,
  getLatestMonthVeiculos,
  saveInventarioVeiculos,
} from '@/components/EstoqueUsadosVwDashboard/veiculosStorage';

vi.mock('@/lib/kvClient', () => ({
  kvDelete: vi.fn(),
  kvGet: vi.fn(),
  kvKeys: vi.fn(),
  kvSet: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(kvDelete).mockResolvedValue(true);
  vi.mocked(kvGet).mockResolvedValue(null);
  vi.mocked(kvKeys).mockResolvedValue([]);
  vi.mocked(kvSet).mockResolvedValue(true);
});

describe('inventário de veículos por tipo', () => {
  it('mantém o inventário de veículos novos VW separado dos estoques existentes', async () => {
    const data = {
      month: '2026-11',
      fileName: 'estoque.xlsx',
      importedAt: 0,
      headers: [],
      rows: [],
      veiculos: [],
    };

    await saveInventarioVeiculos('vw_novos', data);
    await getInventarioVeiculos('vw_novos', data.month);
    await deleteInventarioVeiculos('vw_novos', data.month);
    await getAvailableMonthsVeiculos('vw_novos');
    await getLatestMonthVeiculos('vw_novos');

    expect(kvSet).toHaveBeenCalledWith('estoque_novos_vw:inventario:2026-11', data);
    expect(kvGet).toHaveBeenCalledWith('estoque_novos_vw:inventario:2026-11');
    expect(kvDelete).toHaveBeenCalledWith('estoque_novos_vw:inventario:2026-11');
    expect(kvKeys).toHaveBeenCalledWith('estoque_novos_vw:inventario:*');
    expect(kvKeys).toHaveBeenCalledTimes(2);
  });

  it('preserva as chaves legadas de veículos usados Audi e VW', async () => {
    await getInventarioVeiculos('vw', '2026-11');
    await getInventarioVeiculos('audi', '2026-11');

    expect(kvGet).toHaveBeenNthCalledWith(1, 'estoque_usados_vw:inventario:2026-11');
    expect(kvGet).toHaveBeenNthCalledWith(2, 'estoque_usados_audi:inventario:2026-11');
  });
});
