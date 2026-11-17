import { kvGet, kvSet, kvKeys, kvDelete } from '@/lib/kvClient';

/** Veículo estruturado a partir de uma planilha de inventário. */
export interface VeiculoRow {
  /** Código interno do veículo (coluna VEICULO). */
  veiculo: string;
  /** Chassi / VIN. */
  chassi: string;
  /** Descrição do modelo (coluna MODELO), ex.: "VW JETTA GLI 2.0". */
  modelo: string;
  /** Marca derivada do modelo (ex.: VW, FIAT, JEEP). */
  marca: string;
  /** Número da nota fiscal. */
  nf: string;
  /** Placa / identificação (pode ser vazio). */
  identificacao: string;
  /** Data de entrada no formato ISO 'YYYY-MM-DD' (ou null se não parseável). */
  entrada: string | null;
  /** Valor unitário do veículo. */
  valor: number;
}

/** Dados de uma importação de inventário de veículos, por mês. */
export interface VeiculoImport {
  /** Mês de referência no formato 'YYYY-MM'. */
  month: string;
  /** Nome do arquivo importado. */
  fileName: string;
  /** Timestamp da importação. */
  importedAt: number;
  /** Cabeçalho original do arquivo (para a tabela de pré-visualização). */
  headers: string[];
  /** Linhas originais (cada linha é um array de células na ordem dos headers). */
  rows: string[][];
  /** Veículos estruturados usados na análise. */
  veiculos: VeiculoRow[];
}

/** Identificador de cada inventário de veículos, armazenado separadamente. */
export type VeiculoInventoryId = 'vw' | 'audi' | 'vw_novos';

function inventarioPrefix(inventory: VeiculoInventoryId): string {
  return inventory === 'vw_novos' ? 'estoque_novos_vw' : `estoque_usados_${inventory}`;
}

function inventarioKey(inventory: VeiculoInventoryId, month: string): string {
  return `${inventarioPrefix(inventory)}:inventario:${month}`;
}

export async function saveInventarioVeiculos(inventory: VeiculoInventoryId, data: VeiculoImport): Promise<boolean> {
  return kvSet(inventarioKey(inventory, data.month), data);
}

export async function getInventarioVeiculos(inventory: VeiculoInventoryId, month: string): Promise<VeiculoImport | null> {
  return kvGet<VeiculoImport>(inventarioKey(inventory, month));
}

export async function deleteInventarioVeiculos(inventory: VeiculoInventoryId, month: string): Promise<boolean> {
  return kvDelete(inventarioKey(inventory, month));
}

/** Extrai o mês ('YYYY-MM') do fim de uma chave de storage. */
function monthFromKey(key: string): string | null {
  const m = key.match(/(\d{4}-\d{2})$/);
  return m ? m[1] : null;
}

/** Lista os meses ('YYYY-MM') que possuem inventário importado para a marca. */
export async function getAvailableMonthsVeiculos(inventory: VeiculoInventoryId): Promise<string[]> {
  const keys = await kvKeys(`${inventarioPrefix(inventory)}:inventario:*`);
  return keys
    .map(monthFromKey)
    .filter((m): m is string => !!m)
    .sort();
}

/** Mês mais recente com inventário importado para a marca (ou null). */
export async function getLatestMonthVeiculos(inventory: VeiculoInventoryId): Promise<string | null> {
  const months = await getAvailableMonthsVeiculos(inventory);
  return months.length > 0 ? months[months.length - 1] : null;
}
