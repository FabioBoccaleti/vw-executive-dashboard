import { kvGet, kvSet, kvKeys, kvDelete } from '@/lib/kvClient';

/** Veículo estruturado a partir da planilha de inventário de usados. */
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

/** Dados de uma importação de inventário de veículos usados, por mês. */
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

/** Marca de veículos usados (cada uma com seu próprio arquivo/armazenamento). */
export type VeiculoBrandId = 'vw' | 'audi';

function inventarioKey(brand: VeiculoBrandId, month: string): string {
  return `estoque_usados_${brand}:inventario:${month}`;
}

export async function saveInventarioVeiculos(brand: VeiculoBrandId, data: VeiculoImport): Promise<boolean> {
  return kvSet(inventarioKey(brand, data.month), data);
}

export async function getInventarioVeiculos(brand: VeiculoBrandId, month: string): Promise<VeiculoImport | null> {
  return kvGet<VeiculoImport>(inventarioKey(brand, month));
}

export async function deleteInventarioVeiculos(brand: VeiculoBrandId, month: string): Promise<boolean> {
  return kvDelete(inventarioKey(brand, month));
}

/** Extrai o mês ('YYYY-MM') do fim de uma chave de storage. */
function monthFromKey(key: string): string | null {
  const m = key.match(/(\d{4}-\d{2})$/);
  return m ? m[1] : null;
}

/** Lista os meses ('YYYY-MM') que possuem inventário importado para a marca. */
export async function getAvailableMonthsVeiculos(brand: VeiculoBrandId): Promise<string[]> {
  const keys = await kvKeys(`estoque_usados_${brand}:inventario:*`);
  return keys
    .map(monthFromKey)
    .filter((m): m is string => !!m)
    .sort();
}

/** Mês mais recente com inventário importado para a marca (ou null). */
export async function getLatestMonthVeiculos(brand: VeiculoBrandId): Promise<string | null> {
  const months = await getAvailableMonthsVeiculos(brand);
  return months.length > 0 ? months[months.length - 1] : null;
}
