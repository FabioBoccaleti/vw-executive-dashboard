import { readFileSync, writeFileSync, readdirSync } from 'fs';

const base = 'src/components/VendasBonificacoesDashboard/';
const sections = 'src/components/CadastrosPage/sections/';
const cadastrosStoragePath = 'src/components/CadastrosPage/cadastrosStorage.ts';

// ── 1. cadastrosStorage: append Estetica functions ────────────────────────────
const esteticaBlock = `

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
`;

let cadastros = readFileSync(cadastrosStoragePath, 'utf8');
if (!cadastros.includes('KEY_ESTETICA_VENDEDORES')) {
  writeFileSync(cadastrosStoragePath, cadastros + esteticaBlock);
  console.log('cadastrosStorage OK');
} else {
  console.log('cadastrosStorage already has Estetica');
}

// ── 2. esteticaStorage.ts ─────────────────────────────────────────────────────
let stor = readFileSync(base + 'peliculasStorage.ts', 'utf8');
stor = stor
  .replace(/peliculas_audi_rows/g, 'estetica_audi_rows')
  .replace(/PeliculasRow/g, 'EsteticaRow')
  .replace(/Peliculas/g, 'Estetica')
  .replace(/peliculas/g, 'estetica')
  .replace(/loadPelicula/g, 'loadEstetica')
  .replace(/savePelicula/g, 'saveEstetica')
  .replace(/createEmptyPelicula/g, 'createEmptyEstetica')
  .replace(/recalcPelicula/g, 'recalcEstetica');
writeFileSync(base + 'esteticaStorage.ts', stor);
console.log('esteticaStorage.ts OK');

// ── 3. EsteticaDashboard.tsx ──────────────────────────────────────────────────
let dash = readFileSync(base + 'PeliculasDashboard.tsx', 'utf8');
dash = dash
  .replace(/PeliculasRow/g, 'EsteticaRow')
  .replace(/PeliculasAnalise/g, 'EsteticaAnalise')
  .replace(/peliculasStorage/g, 'esteticaStorage')
  .replace(/loadPeliculas/g, 'loadEstetica')
  .replace(/savePeliculas/g, 'saveEstetica')
  .replace(/createEmptyPeliculas/g, 'createEmptyEstetica')
  .replace(/recalcPeliculas/g, 'recalcEstetica')
  .replace(/Peliculas/g, 'Estetica')
  .replace(/peliculas\./g, 'estetica.')
  .replace(/peliculas,/g, 'estetica,')
  .replace(/peliculas\)/g, 'estetica)')
  .replace(/Películas/g, 'Estética')
  .replace(/películas/g, 'estética')
  .replace(/Análise e Controle de Vendas de Películas na Audi/g, 'Análise e Controle de Vendas de Serviços de Estética Audi')
  .replace(/Películas - Audi/g, 'Estética - Audi')
  .replace(/loadPeliculasVendedores/g, 'loadEsteticaVendedores')
  .replace(/loadPeliculasVendedoresAcessorios/g, 'loadEsteticaVendedoresAcessorios')
  .replace(/loadPeliculasProdutos/g, 'loadEsteticaProdutos')
  .replace(/loadPeliculasAliquotas/g, 'loadEsteticaAliquotas')
  .replace(/loadPeliculasRegras/g, 'loadEsteticaRegras');
writeFileSync(base + 'EsteticaDashboard.tsx', dash);
console.log('EsteticaDashboard.tsx OK');

// ── 4. EsteticaAnalise.tsx ────────────────────────────────────────────────────
let analise = readFileSync(base + 'PeliculasAnalise.tsx', 'utf8');
analise = analise
  .replace(/PeliculasRow/g, 'EsteticaRow')
  .replace(/Peliculas/g, 'Estetica')
  .replace(/peliculas/g, 'estetica')
  .replace(/Películas/g, 'Estética')
  .replace(/películas/g, 'estética')
  .replace(/peliculasStorage/g, 'esteticaStorage');
writeFileSync(base + 'EsteticaAnalise.tsx', analise);
console.log('EsteticaAnalise.tsx OK');

// ── 5. Seções de cadastro ─────────────────────────────────────────────────────
const sectionFiles = readdirSync(sections).filter(f => f.startsWith('Peliculas'));
sectionFiles.forEach(f => {
  let s = readFileSync(sections + f, 'utf8');
  s = s
    .replace(/loadPeliculasVendedores/g, 'loadEsteticaVendedores')
    .replace(/savePeliculasVendedores/g, 'saveEsteticaVendedores')
    .replace(/loadPeliculasVendedoresAcessorios/g, 'loadEsteticaVendedoresAcessorios')
    .replace(/savePeliculasVendedoresAcessorios/g, 'saveEsteticaVendedoresAcessorios')
    .replace(/loadPeliculasProdutos/g, 'loadEsteticaProdutos')
    .replace(/savePeliculasProdutos/g, 'saveEsteticaProdutos')
    .replace(/loadPeliculasAliquotas/g, 'loadEsteticaAliquotas')
    .replace(/savePeliculasAliquotas/g, 'saveEsteticaAliquotas')
    .replace(/loadPeliculasRegras/g, 'loadEsteticaRegras')
    .replace(/savePeliculasRegras/g, 'saveEsteticaRegras')
    .replace(/loadPeliculasRevendas/g, 'loadEsteticaRevendas')
    .replace(/savePeliculasRevendas/g, 'saveEsteticaRevendas')
    .replace(/loadPeliculasDsr/g, 'loadEsteticaDsr')
    .replace(/savePeliculasDsr/g, 'saveEsteticaDsr')
    .replace(/loadPeliculasVeiculos/g, 'loadEsteticaVeiculos')
    .replace(/savePeliculasVeiculos/g, 'saveEsteticaVeiculos')
    .replace(/BASES_CALCULO_PELICULAS/g, 'BASES_CALCULO_ESTETICA')
    .replace(/CARGOS_VENDEDOR_PELICULAS/g, 'CARGOS_VENDEDOR_ESTETICA')
    .replace(/CargoVendedorPeliculas/g, 'CargoVendedorEstetica')
    .replace(/PeliculasRow/g, 'EsteticaRow')
    .replace(/Peliculas/g, 'Estetica')
    .replace(/peliculas/g, 'estetica')
    .replace(/Películas/g, 'Estética')
    .replace(/películas/g, 'estética');
  const newName = f.replace('Peliculas', 'Estetica');
  writeFileSync(sections + newName, s);
  console.log(newName + ' OK');
});

console.log('\nAll files created successfully!');
