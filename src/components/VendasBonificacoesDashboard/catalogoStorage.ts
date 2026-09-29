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

// ─── Sign&Drive (dados próprios) ──────────────────────────────────────────────
const KEY_SIGNDRIVE = 'signdrive_catalogo_veiculos';

export async function loadSignDriveCatalogo(): Promise<CatalogoVeiculos> {
  const data = await kvGet<CatalogoVeiculos>(KEY_SIGNDRIVE);
  return data ?? { marcas: [], modelos: [] };
}

export async function saveSignDriveCatalogo(catalogo: CatalogoVeiculos): Promise<boolean> {
  return kvSet(KEY_SIGNDRIVE, catalogo);
}
