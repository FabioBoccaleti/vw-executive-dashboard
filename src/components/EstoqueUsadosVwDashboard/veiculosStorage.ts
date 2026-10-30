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

const INVENTARIO_PREFIX = 'estoque_usados_vw:inventario:';

function inventarioKey(month: string): string {
  return `${INVENTARIO_PREFIX}${month}`;
}

export async function saveInventarioVeiculos(data: VeiculoImport): Promise<boolean> {
  return kvSet(inventarioKey(data.month), data);
}

export async function getInventarioVeiculos(month: string): Promise<VeiculoImport | null> {
  return kvGet<VeiculoImport>(inventarioKey(month));
}

export async function deleteInventarioVeiculos(month: string): Promise<boolean> {
  return kvDelete(inventarioKey(month));
}

/** Extrai o mês ('YYYY-MM') do fim de uma chave de storage. */
function monthFromKey(key: string): string | null {
  const m = key.match(/(\d{4}-\d{2})$/);
  return m ? m[1] : null;
}

/** Lista os meses ('YYYY-MM') que possuem inventário importado. */
export async function getAvailableMonthsVeiculos(): Promise<string[]> {
  const keys = await kvKeys(`${INVENTARIO_PREFIX}*`);
  return keys
    .map(monthFromKey)
    .filter((m): m is string => !!m)
    .sort();
}

/** Mês mais recente com inventário importado (ou null). */
export async function getLatestMonthVeiculos(): Promise<string | null> {
  const months = await getAvailableMonthsVeiculos();
  return months.length > 0 ? months[months.length - 1] : null;
}
