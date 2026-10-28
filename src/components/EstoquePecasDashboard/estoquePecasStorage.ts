import { kvGet, kvSet } from '@/lib/kvClient';

export type EstoquePecasMarcaId = 'audi' | 'vw';

/** Dados de um inventário importado, de um mês específico, por marca. */
export interface InventarioImport {
  marca: EstoquePecasMarcaId;
  /** Mês de referência no formato 'YYYY-MM' */
  month: string;
  /** Nome do arquivo importado */
  fileName: string;
  /** Timestamp da importação */
  importedAt: number;
  /** Cabeçalho (nomes das colunas) */
  headers: string[];
  /** Linhas de dados (cada linha é um array de células na ordem dos headers) */
  rows: string[][];
}

const INVENTARIO_PREFIX = 'estoque_pecas:inventario:';

function inventarioKey(marca: EstoquePecasMarcaId, month: string): string {
  return `${INVENTARIO_PREFIX}${marca}:${month}`;
}

export async function saveInventario(data: InventarioImport): Promise<boolean> {
  return kvSet(inventarioKey(data.marca, data.month), data);
}

export async function getInventario(
  marca: EstoquePecasMarcaId,
  month: string,
): Promise<InventarioImport | null> {
  return kvGet<InventarioImport>(inventarioKey(marca, month));
}

/**
 * Decodifica o conteúdo de um arquivo tratando acentuação.
 * Tenta UTF-8 e, se encontrar caractere de substituição (arquivo ANSI),
 * refaz a decodificação como Windows-1252 (latin1 comum em exportações TXT).
 */
export function decodeFileBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  if (utf8.includes('\uFFFD')) {
    try {
      return new TextDecoder('windows-1252').decode(bytes);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

/**
 * Faz o parse de um TXT delimitado por ';'.
 * A primeira linha é o cabeçalho. Espaços nas bordas das células são removidos.
 * Colunas vazias geradas por ';' no fim da linha são descartadas.
 */
export function parseInventarioTxt(content: string): { headers: string[]; rows: string[][] } {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const splitLine = (line: string): string[] => line.split(';').map((c) => c.trim());

  let headers = splitLine(lines[0]);
  while (headers.length > 0 && headers[headers.length - 1] === '') headers.pop();

  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row = headers.map((_, i) => cells[i] ?? '');
    return row;
  });

  return { headers, rows };
}
