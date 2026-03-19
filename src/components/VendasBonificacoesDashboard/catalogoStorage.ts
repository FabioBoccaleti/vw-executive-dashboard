import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'catalogo_veiculos';

export interface MarcaVeiculo {
  id: string;
  nome: string;
}

export interface ModeloVeiculo {
  id: string;
  marcaId: string;
  modelo: string;
}

export interface CatalogoVeiculos {
  marcas: MarcaVeiculo[];
  modelos: ModeloVeiculo[];
}

export async function loadCatalogo(): Promise<CatalogoVeiculos> {
  const data = await kvGet<CatalogoVeiculos>(KEY);
  return data ?? { marcas: [], modelos: [] };
}

export async function saveCatalogo(catalogo: CatalogoVeiculos): Promise<boolean> {
  return kvSet(KEY, catalogo);
}
