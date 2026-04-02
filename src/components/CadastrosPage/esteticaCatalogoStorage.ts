import { kvGet, kvSet } from '@/lib/kvClient';
import {
  loadCatalogo as loadBlinCatalogo,
  type CatalogoVeiculos,
  type MarcaVeiculo,
  type ModeloVeiculo,
} from '@/components/VendasBonificacoesDashboard/catalogoStorage';

export type { CatalogoVeiculos, MarcaVeiculo, ModeloVeiculo };

const KEY = 'estetica_cadastro_catalogo';

export async function loadEsteticaCatalogo(): Promise<CatalogoVeiculos> {
  const existing = await kvGet<CatalogoVeiculos>(KEY);
  if (existing && existing.marcas.length > 0) return existing;

  // Primeiro acesso: semeia com marca Audi e modelos Audi do catálogo de Blindagem
  try {
    const blin = await loadBlinCatalogo();
    const audiMarca = blin.marcas.find(m => m.nome.toLowerCase().includes('audi'));
    if (audiMarca) {
      const audiModelos = blin.modelos.filter(m => m.marcaId === audiMarca.id);
      const seeded: CatalogoVeiculos = { marcas: [audiMarca], modelos: audiModelos };
      await saveEsteticaCatalogo(seeded);
      return seeded;
    }
  } catch { /* fallback: começa vazio */ }

  return { marcas: [], modelos: [] };
}

export async function saveEsteticaCatalogo(catalogo: CatalogoVeiculos): Promise<boolean> {
  return kvSet(KEY, catalogo);
}
