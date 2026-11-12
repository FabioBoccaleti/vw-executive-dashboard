import { kvGet, kvSet } from '@/lib/kvClient';

// ── Chaves de armazenamento (KV) ──────────────────────────────────────────────
const KEY_MARCAS = 'remuneracao_produtos_marcas';
const KEY_PRODUTOS = 'remuneracao_produtos_produtos';
const KEY_VENDEDORES = 'remuneracao_produtos_vendedores';
const KEY_MODELOS = 'remuneracao_produtos_modelos';
const KEY_REGISTROS = 'remuneracao_produtos_registros';
const KEY_DEMO_META = 'remuneracao_produtos_demonstrativos';

// ── Departamentos (vendedor) ──────────────────────────────────────────────────
export const DEPARTAMENTOS_RP = [
  'Novos',
  'Usados',
  'Venda Direta',
  'Oficina',
  'Funilaria',
  'Acessorios',
] as const;
export type DepartamentoRP = typeof DEPARTAMENTOS_RP[number];

// ── Cadastros ─────────────────────────────────────────────────────────────────
export interface MarcaRP {
  id: string;
  nome: string;
}

/** Produto disponível para venda, vinculado a uma marca, com o prêmio pago. */
export interface ProdutoRP {
  id: string;
  marcaId: string;
  nome: string;
  premio: string;
}

export interface VendedorRP {
  id: string;
  marcaId: string;
  nome: string;
  matricula: string;
  departamento: string;
  cargo: string;
}

export interface ModeloRP {
  id: string;
  marcaId: string;
  nome: string;
}

// ── Registro de venda ─────────────────────────────────────────────────────────
export interface RegistroVendaRP {
  id: string;
  /** Data da venda (ISO "YYYY-MM-DD"). */
  data: string;
  marcaId: string;
  marca: string;
  vendedorId: string;
  vendedor: string;
  cliente: string;
  modeloId: string;
  modelo: string;
  produtoId: string;
  produto: string;
  /** Valor do prêmio (snapshot do cadastro no momento do registro). */
  valorPremio: string;
  /** Data do pagamento (ISO "YYYY-MM-DD" ou vazio). */
  dataPagamento: string;
}

// ── Marcas ──────────────────────────────────────────────────────────────────
export async function loadMarcasRP(): Promise<MarcaRP[]> {
  return (await kvGet<MarcaRP[]>(KEY_MARCAS)) ?? [];
}
export async function saveMarcasRP(items: MarcaRP[]): Promise<boolean> {
  return kvSet(KEY_MARCAS, items);
}

// ── Produtos ────────────────────────────────────────────────────────────────
export async function loadProdutosRP(): Promise<ProdutoRP[]> {
  return (await kvGet<ProdutoRP[]>(KEY_PRODUTOS)) ?? [];
}
export async function saveProdutosRP(items: ProdutoRP[]): Promise<boolean> {
  return kvSet(KEY_PRODUTOS, items);
}

// ── Vendedores ──────────────────────────────────────────────────────────────
export async function loadVendedoresRP(): Promise<VendedorRP[]> {
  return (await kvGet<VendedorRP[]>(KEY_VENDEDORES)) ?? [];
}
export async function saveVendedoresRP(items: VendedorRP[]): Promise<boolean> {
  return kvSet(KEY_VENDEDORES, items);
}

// ── Modelos ─────────────────────────────────────────────────────────────────
export async function loadModelosRP(): Promise<ModeloRP[]> {
  return (await kvGet<ModeloRP[]>(KEY_MODELOS)) ?? [];
}
export async function saveModelosRP(items: ModeloRP[]): Promise<boolean> {
  return kvSet(KEY_MODELOS, items);
}

// ── Registros ───────────────────────────────────────────────────────────────
export async function loadRegistrosRP(): Promise<RegistroVendaRP[]> {
  return (await kvGet<RegistroVendaRP[]>(KEY_REGISTROS)) ?? [];
}
export async function saveRegistrosRP(items: RegistroVendaRP[]): Promise<boolean> {
  return kvSet(KEY_REGISTROS, items);
}

// ── Demonstrativo de pagamento: assinaturas ───────────────────────────────────
export interface AssinaturaDigitalRP {
  username: string;
  name?: string;
  dataHora: string;
}

export type CampoAssinaturaRP =
  | 'financeiro'
  | 'gerenciaComercial'
  | 'diretoriaComercial'
  | 'diretoria';

export const CAMPO_ASSINATURA_LABELS_RP: Record<CampoAssinaturaRP, string> = {
  financeiro:         'Financeiro',
  gerenciaComercial:  'Gerência Comercial',
  diretoriaComercial: 'Diretoria Comercial',
  diretoria:          'Diretoria',
};

export const CAMPO_ASSINATURA_LABELS_RP_CURTO: Record<CampoAssinaturaRP, string> = {
  financeiro:         'Fin',
  gerenciaComercial:  'G.Com',
  diretoriaComercial: 'D.Com',
  diretoria:          'Dir',
};

export interface DemonstrativoMetaRP {
  assinaturas?: Partial<Record<CampoAssinaturaRP, AssinaturaDigitalRP>>;
  /** Demonstrativo fechado (marcado como pago) para esta competência. */
  pago?: boolean;
  /** Data (ISO) em que foi marcado como pago. */
  dataPagamento?: string;
  /** IDs das vendas congeladas neste demonstrativo pago. */
  vendaIds?: string[];
}

/** Monta a chave de meta por marca/vendedor/competência. */
export function demoMetaKey(brand: 'vw' | 'audi', vendedorId: string, year: number, month: number): string {
  return `${brand}_${vendedorId}_${year}-${String(month).padStart(2, '0')}`;
}

export async function loadDemoMetaRP(): Promise<Record<string, DemonstrativoMetaRP>> {
  return (await kvGet<Record<string, DemonstrativoMetaRP>>(KEY_DEMO_META)) ?? {};
}
export async function saveDemoMetaRP(meta: Record<string, DemonstrativoMetaRP>): Promise<boolean> {
  return kvSet(KEY_DEMO_META, meta);
}
