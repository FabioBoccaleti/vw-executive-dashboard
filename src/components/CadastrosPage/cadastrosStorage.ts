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

export const CARGOS_VENDEDOR_PELICULAS = [
  'Vendedor',
  'Gerência',
  'Diretoria',
  'Vendedor de Acessórios',
] as const;

export type CargoVendedorPeliculas = typeof CARGOS_VENDEDOR_PELICULAS[number];

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

// ── Películas: Prestadores de Serviço ─────────────────────────────────────────
const KEY_PELICULAS_PRESTADORES = 'peliculas_cadastro_prestadores';

export interface Prestador {
  id: string;
  nome: string;
}

export async function loadPrestadores(): Promise<Prestador[]> {
  return (await kvGet<Prestador[]>(KEY_PELICULAS_PRESTADORES)) ?? [];
}

export async function savePrestadores(items: Prestador[]): Promise<boolean> {
  return kvSet(KEY_PELICULAS_PRESTADORES, items);
}

// ── Películas: Vendedores ──────────────────────────────────────────────────────
const KEY_PELICULAS_VENDEDORES = 'peliculas_cadastro_vendedores';

export async function loadPeliculasVendedores(): Promise<Vendedor[]> {
  return (await kvGet<Vendedor[]>(KEY_PELICULAS_VENDEDORES)) ?? [];
}

export async function savePeliculasVendedores(items: Vendedor[]): Promise<boolean> {
  return kvSet(KEY_PELICULAS_VENDEDORES, items);
}

// ── Películas: Revendas ────────────────────────────────────────────────────────
const KEY_PELICULAS_REVENDAS = 'peliculas_cadastro_revendas';

export async function loadPeliculasRevendas(): Promise<Revenda[]> {
  return (await kvGet<Revenda[]>(KEY_PELICULAS_REVENDAS)) ?? [];
}

export async function savePeliculasRevendas(items: Revenda[]): Promise<boolean> {
  return kvSet(KEY_PELICULAS_REVENDAS, items);
}

// ── Películas: Regras de Remuneração ──────────────────────────────────────────
const KEY_PELICULAS_REGRAS = 'peliculas_cadastro_regras';

export const BASES_CALCULO_PELICULAS = [
  'Lucro Bruto',
] as const;

export async function loadPeliculasRegras(): Promise<RegraRemuneracao[]> {
  return (await kvGet<RegraRemuneracao[]>(KEY_PELICULAS_REGRAS)) ?? [];
}

export async function savePeliculasRegras(items: RegraRemuneracao[]): Promise<boolean> {
  return kvSet(KEY_PELICULAS_REGRAS, items);
}

// ── Películas: Produtos / Serviços ─────────────────────────────────────────────
const KEY_PELICULAS_PRODUTOS = 'peliculas_cadastro_produtos';

export interface ProdutoServico {
  id: string;
  nome: string;
}

export async function loadPeliculasProdutos(): Promise<ProdutoServico[]> {
  return (await kvGet<ProdutoServico[]>(KEY_PELICULAS_PRODUTOS)) ?? [];
}

export async function savePeliculasProdutos(items: ProdutoServico[]): Promise<boolean> {
  return kvSet(KEY_PELICULAS_PRODUTOS, items);
}

// ── Películas: Vendedores de Acessórios ────────────────────────────────────────
const KEY_PELICULAS_VENDEDORES_ACESSORIOS = 'peliculas_cadastro_vendedores_acessorios';

export interface VendedorAcessorios {
  id: string;
  nome: string;
}

export async function loadPeliculasVendedoresAcessorios(): Promise<VendedorAcessorios[]> {
  return (await kvGet<VendedorAcessorios[]>(KEY_PELICULAS_VENDEDORES_ACESSORIOS)) ?? [];
}

export async function savePeliculasVendedoresAcessorios(items: VendedorAcessorios[]): Promise<boolean> {
  return kvSet(KEY_PELICULAS_VENDEDORES_ACESSORIOS, items);
}

// ── Películas: Alíquotas de Imposto ────────────────────────────────────────────
const KEY_PELICULAS_ALIQUOTAS = 'peliculas_cadastro_aliquotas';

export interface AliquotaImposto {
  id: string;
  tipoImposto: string;  // ex.: ISS, PIS, COFINS
  aliquota: string;     // percentual (%)
  encargos: string;     // percentual (%)
}

export async function loadPeliculasAliquotas(): Promise<AliquotaImposto[]> {
  return (await kvGet<AliquotaImposto[]>(KEY_PELICULAS_ALIQUOTAS)) ?? [];
}

export async function savePeliculasAliquotas(items: AliquotaImposto[]): Promise<boolean> {
  return kvSet(KEY_PELICULAS_ALIQUOTAS, items);
}
