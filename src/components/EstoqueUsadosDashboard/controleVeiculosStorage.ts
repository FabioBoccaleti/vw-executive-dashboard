import { kvDelete, kvGet, kvSet } from '@/lib/kvClient';

export type ControleVeiculosBrand = 'vw' | 'audi';

export interface ControleVeiculosSheet {
  name: string;
  rows: unknown[][];
}

export interface ControleVeiculosData {
  brand: ControleVeiculosBrand;
  fileName: string;
  importedAt: string;
  sheets: ControleVeiculosSheet[];
}

const keyFor = (brand: ControleVeiculosBrand) =>
  `estoque-usados-controle-veiculos:${brand}`;

export async function getControleVeiculos(brand: ControleVeiculosBrand) {
  return kvGet<ControleVeiculosData>(keyFor(brand));
}

export async function setControleVeiculos(data: ControleVeiculosData) {
  return kvSet(keyFor(data.brand), data);
}

export async function deleteControleVeiculos(brand: ControleVeiculosBrand) {
  return kvDelete(keyFor(brand));
}
