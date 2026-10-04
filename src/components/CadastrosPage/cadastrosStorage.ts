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

export const CARGOS_VENDEDOR_ESTETICA = [
  'Vendedor',
  'Gerência',
  'Diretoria',
  'Vendedor de Serviço de Estética',
] as const;

export type CargoVendedorEstetica = typeof CARGOS_VENDEDOR_ESTETICA[number];

export interface Vendedor {
  id: string;
  codigo?: string;
  nome: string;
  cargo: CargoVendedor;
  salarioFixo?: string;
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
  custo?: string;
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

// ── DSR ──
const KEY_PELICULAS_DSR = 'peliculas_cadastro_dsr';

export interface DsrConfig {
  id: string;
  ano: number;
  mes: number;   // 1–12
  percentual: string; // % DSR (ex: "16.67")
}

export async function loadPeliculasDsr(): Promise<DsrConfig[]> {
  return (await kvGet<DsrConfig[]>(KEY_PELICULAS_DSR)) ?? [];
}

export async function savePeliculasDsr(items: DsrConfig[]): Promise<boolean> {
  return kvSet(KEY_PELICULAS_DSR, items);
}


// ── Estética: Vendedores ───────────────────────────────────────────────────────
const KEY_ESTETICA_VENDEDORES = 'estetica_cadastro_vendedores';

export async function loadEsteticaVendedores(): Promise<Vendedor[]> {
  return (await kvGet<Vendedor[]>(KEY_ESTETICA_VENDEDORES)) ?? [];
}
export async function saveEsteticaVendedores(items: Vendedor[]): Promise<boolean> {
  return kvSet(KEY_ESTETICA_VENDEDORES, items);
}

// ── Estética: Revendas ─────────────────────────────────────────────────────────
const KEY_ESTETICA_REVENDAS = 'estetica_cadastro_revendas';

export async function loadEsteticaRevendas(): Promise<Revenda[]> {
  return (await kvGet<Revenda[]>(KEY_ESTETICA_REVENDAS)) ?? [];
}
export async function saveEsteticaRevendas(items: Revenda[]): Promise<boolean> {
  return kvSet(KEY_ESTETICA_REVENDAS, items);
}

// ── Estética: Regras de Remuneração ───────────────────────────────────────────
const KEY_ESTETICA_REGRAS = 'estetica_cadastro_regras';

export const BASES_CALCULO_ESTETICA = [
  'Lucro Bruto',
] as const;

export async function loadEsteticaRegras(): Promise<RegraRemuneracao[]> {
  return (await kvGet<RegraRemuneracao[]>(KEY_ESTETICA_REGRAS)) ?? [];
}
export async function saveEsteticaRegras(items: RegraRemuneracao[]): Promise<boolean> {
  return kvSet(KEY_ESTETICA_REGRAS, items);
}

// ── Estética: Produtos / Serviços ─────────────────────────────────────────────
const KEY_ESTETICA_PRODUTOS = 'estetica_cadastro_produtos';

export async function loadEsteticaProdutos(): Promise<ProdutoServico[]> {
  return (await kvGet<ProdutoServico[]>(KEY_ESTETICA_PRODUTOS)) ?? [];
}
export async function saveEsteticaProdutos(items: ProdutoServico[]): Promise<boolean> {
  return kvSet(KEY_ESTETICA_PRODUTOS, items);
}

// ── Estética: Vendedores de Acessórios ────────────────────────────────────────
const KEY_ESTETICA_VENDEDORES_ACESSORIOS = 'estetica_cadastro_vendedores_acessorios';

export async function loadEsteticaVendedoresAcessorios(): Promise<VendedorAcessorios[]> {
  return (await kvGet<VendedorAcessorios[]>(KEY_ESTETICA_VENDEDORES_ACESSORIOS)) ?? [];
}
export async function saveEsteticaVendedoresAcessorios(items: VendedorAcessorios[]): Promise<boolean> {
  return kvSet(KEY_ESTETICA_VENDEDORES_ACESSORIOS, items);
}

// ── Estética: Alíquotas de Imposto ────────────────────────────────────────────
const KEY_ESTETICA_ALIQUOTAS = 'estetica_cadastro_aliquotas';

export async function loadEsteticaAliquotas(): Promise<AliquotaImposto[]> {
  return (await kvGet<AliquotaImposto[]>(KEY_ESTETICA_ALIQUOTAS)) ?? [];
}
export async function saveEsteticaAliquotas(items: AliquotaImposto[]): Promise<boolean> {
  return kvSet(KEY_ESTETICA_ALIQUOTAS, items);
}

// ── Estética: DSR ─────────────────────────────────────────────────────────────
const KEY_ESTETICA_DSR = 'estetica_cadastro_dsr';

export async function loadEsteticaDsr(): Promise<DsrConfig[]> {
  return (await kvGet<DsrConfig[]>(KEY_ESTETICA_DSR)) ?? [];
}
export async function saveEsteticaDsr(items: DsrConfig[]): Promise<boolean> {
  return kvSet(KEY_ESTETICA_DSR, items);
}

// ── Estética: Salários Fixos ──────────────────────────────────────────────────
const KEY_ESTETICA_SALARIOS_FIXOS = 'estetica_cadastro_salarios_fixos';

export interface SalarioFixoEstetica {
  id: string;
  nome: string;
  cargo: string;
  salarioFixo: string;
  encargosProvisoes: string;
  planoSaude: string;
  valeTransporte: string;
}

export async function loadEsteticaSalariosFixos(): Promise<SalarioFixoEstetica[]> {
  return (await kvGet<SalarioFixoEstetica[]>(KEY_ESTETICA_SALARIOS_FIXOS)) ?? [];
}

export async function saveEsteticaSalariosFixos(items: SalarioFixoEstetica[]): Promise<boolean> {
  return kvSet(KEY_ESTETICA_SALARIOS_FIXOS, items);
}

// ── Estética: Veículos ────────────────────────────────────────────────────────
const KEY_ESTETICA_VEICULOS = 'estetica_cadastro_veiculos';

export interface Veiculo {
  id: string;
  modelo: string;
  placa?: string;
}

export async function loadEsteticaVeiculos(): Promise<Veiculo[]> {
  return (await kvGet<Veiculo[]>(KEY_ESTETICA_VEICULOS)) ?? [];
}
export async function saveEsteticaVeiculos(items: Veiculo[]): Promise<boolean> {
  return kvSet(KEY_ESTETICA_VEICULOS, items);
}

// ── Sign&Drive: Vendedores (dados próprios) ───────────────────────────────────
const KEY_SIGNDRIVE_VENDEDORES = 'signdrive_cadastro_vendedores';

export async function loadSignDriveVendedores(): Promise<Vendedor[]> {
  return (await kvGet<Vendedor[]>(KEY_SIGNDRIVE_VENDEDORES)) ?? [];
}
export async function saveSignDriveVendedores(items: Vendedor[]): Promise<boolean> {
  return kvSet(KEY_SIGNDRIVE_VENDEDORES, items);
}

// ── Sign&Drive: Tipos de Venda ────────────────────────────────────────────────
const KEY_SIGNDRIVE_TIPOS_VENDA = 'signdrive_cadastro_tipos_venda';

export interface TipoVendaSignDrive {
  id: string;
  descricao: string;
  pctComissaoVenda: string;
  pctComissaoEntrega: string;
  pctImpostos: string;
}

export async function loadSignDriveTiposVenda(): Promise<TipoVendaSignDrive[]> {
  return (await kvGet<TipoVendaSignDrive[]>(KEY_SIGNDRIVE_TIPOS_VENDA)) ?? [];
}
export async function saveSignDriveTiposVenda(items: TipoVendaSignDrive[]): Promise<boolean> {
  return kvSet(KEY_SIGNDRIVE_TIPOS_VENDA, items);
}

// ── Sign&Drive: Regras de Remuneração ─────────────────────────────────────────
const KEY_SIGNDRIVE_REGRAS = 'signdrive_cadastro_regras';

/** Faixa por quantidade de vendas: de–até (vazio = "em diante") → valor. */
export interface FaixaQtdSignDrive {
  id: string;
  de: string;    // quantidade mínima de vendas
  ate: string;   // quantidade máxima ('' = em diante)
  valor: string; // % (comissão) ou % / R$ (prêmio), conforme a unidade
}

export type ComissaoModoSignDrive = 'fixa' | 'faixas';
export type PremioModoSignDrive = 'fixo' | 'faixas';
export type PremioUnidadeSignDrive = 'percentual' | 'valor'; // % ou R$

/**
 * Regra de remuneração do Sign&Drive, associada a um cargo.
 * Pode conter Comissão (sempre em %) e/ou Prêmio (em % ou R$).
 * O cálculo que combina esses parâmetros será definido posteriormente.
 */
export interface RegraRemuneracaoSignDrive {
  id: string;
  nome: string;
  cargo: string; // CargoVendedor

  // Comissão (sempre em %)
  comissaoAtiva: boolean;
  comissaoModo: ComissaoModoSignDrive;  // 'fixa' | 'faixas'
  comissaoPercentual: string;           // usado quando 'fixa'
  comissaoFaixas: FaixaQtdSignDrive[];  // usado quando 'faixas' (valor = %)

  // Prêmio (unidade selecionável: % ou R$)
  premioAtivo: boolean;
  premioModo: PremioModoSignDrive;      // 'fixo' | 'faixas'
  premioUnidade: PremioUnidadeSignDrive; // 'percentual' | 'valor'
  premioValor: string;                  // usado quando 'fixo'
  premioFaixas: FaixaQtdSignDrive[];    // usado quando 'faixas'
}

export async function loadSignDriveRegras(): Promise<RegraRemuneracaoSignDrive[]> {
  return (await kvGet<RegraRemuneracaoSignDrive[]>(KEY_SIGNDRIVE_REGRAS)) ?? [];
}
export async function saveSignDriveRegras(items: RegraRemuneracaoSignDrive[]): Promise<boolean> {
  return kvSet(KEY_SIGNDRIVE_REGRAS, items);
}
