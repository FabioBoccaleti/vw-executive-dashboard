import { kvGet, kvSet } from '@/lib/kvClient';

// ── Blindadoras ───────────────────────────────────────────────────────────────
const KEY_BLINDADORAS = 'cadastro_blindadoras';

export interface Blindadora {
  id: string;
  nome: string;
}

export async function loadBlinadadoras(): Promise<Blindadora[]> {
  return (await kvGet<Blindadora[]>(KEY_BLINDADORAS)) ?? [];
}

export async function saveBlinadadoras(items: Blindadora[]): Promise<boolean> {
  return kvSet(KEY_BLINDADORAS, items);
}

// ── Vendedores ────────────────────────────────────────────────────────────────
const KEY_VENDEDORES = 'cadastro_vendedores';

export const CARGOS_VENDEDOR = [
  'Vendedor',
  'Gerência',
  'Diretoria',
  'Supervisor de Usados',
] as const;

export type CargoVendedor = typeof CARGOS_VENDEDOR[number];

export interface Vendedor {
  id: string;
  codigo?: string;
  nome: string;
  cargo: CargoVendedor;
}

export async function loadVendedores(): Promise<Vendedor[]> {
  return (await kvGet<Vendedor[]>(KEY_VENDEDORES)) ?? [];
}

export async function saveVendedores(items: Vendedor[]): Promise<boolean> {
  return kvSet(KEY_VENDEDORES, items);
}

// ── Regras de Remuneração ─────────────────────────────────────────────────────
const KEY_REGRAS = 'cadastro_regras';

export const BASES_CALCULO = [
  'Lucro da Operação',
  'Valor da Venda da Blindagem',
  'Custo da Blindagem',
] as const;

export type TipoPremio = 'percentual' | 'faixas';

export interface FaixaValor {
  id: string;
  de: string;
  ate: string; // vazio = "em diante"
  premio: string;
}

export interface RegraRemuneracao {
  id: string;
  nome: string;
  cargo: string;
  baseCalculo: string;
  tipoPremio: TipoPremio;
  percentual: string;      // usado quando tipoPremio === 'percentual'
  faixas: FaixaValor[];    // usado quando tipoPremio === 'faixas'
  revendaId: string;       // '' = todas as revendas
}

export async function loadRegras(): Promise<RegraRemuneracao[]> {
  return (await kvGet<RegraRemuneracao[]>(KEY_REGRAS)) ?? [];
}

export async function saveRegras(items: RegraRemuneracao[]): Promise<boolean> {
  return kvSet(KEY_REGRAS, items);
}

// ── Revendas ──────────────────────────────────────────────────────────────────
const KEY_REVENDAS = 'cadastro_revendas';

export interface Revenda {
  id: string;
  nome: string;
}

export async function loadRevendas(): Promise<Revenda[]> {
  return (await kvGet<Revenda[]>(KEY_REVENDAS)) ?? [];
}

export async function saveRevendas(items: Revenda[]): Promise<boolean> {
  return kvSet(KEY_REVENDAS, items);
}
