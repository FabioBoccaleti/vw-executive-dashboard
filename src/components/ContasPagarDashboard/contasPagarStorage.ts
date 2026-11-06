import { kvGet, kvSet, kvKeys, kvDelete } from '@/lib/kvClient';

export type ContasPagarMarcaId = 'audi' | 'vw';

/** Dados de uma importação de Posição de Contas a Pagar, por marca e mês. */
export interface ContasPagarImport {
  marca: ContasPagarMarcaId;
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

const DUPLICATAS_PREFIX = 'contas_pagar:posicao:';
const DEPT_MAP_PREFIX = 'contas_pagar:dept_map:';
const ORIGEM_MAP_PREFIX = 'contas_pagar:origem_map:';

/** Departamentos de classificação (ordem de exibição). */
export const DEPARTAMENTOS = [
  'Veículos Novos',
  'Veículos Usados',
  'Venda Direta',
  'Peças',
  'Acessórios',
  'Oficina',
  'Funilaria',
  'Administração',
] as const;

export type DepartamentoCustom = typeof DEPARTAMENTOS[number];

/** Rótulo usado para duplicatas cujo departamento do arquivo ainda não foi classificado. */
export const DEPARTAMENTO_NAO_CLASSIFICADO = 'Não classificado';

/**
 * Mapeamento do número de DEPARTAMENTO do arquivo para um departamento de classificação.
 * Exclusivo: cada número do arquivo aponta para no máximo um departamento.
 */
export type DepartamentoMap = Record<string, DepartamentoCustom>;

function deptMapKey(marca: ContasPagarMarcaId): string {
  return `${DEPT_MAP_PREFIX}${marca}`;
}

export async function getDepartamentoMap(marca: ContasPagarMarcaId): Promise<DepartamentoMap> {
  const saved = await kvGet<DepartamentoMap>(deptMapKey(marca));
  return saved ?? {};
}

export async function saveDepartamentoMap(marca: ContasPagarMarcaId, map: DepartamentoMap): Promise<boolean> {
  return kvSet(deptMapKey(marca), map);
}

/**
 * Cadastro de origens: conjunto de números de ORIGEM marcados como "cadastrados".
 * Apenas origens cadastradas (valor `true`) entram nos totais da análise.
 * Origens não presentes no mapa (ou com valor `false`) ficam "pendentes" e são excluídas.
 */
export type OrigemMap = Record<string, boolean>;

function origemMapKey(marca: ContasPagarMarcaId): string {
  return `${ORIGEM_MAP_PREFIX}${marca}`;
}

export async function getOrigemMap(marca: ContasPagarMarcaId): Promise<OrigemMap> {
  const saved = await kvGet<OrigemMap>(origemMapKey(marca));
  return saved ?? {};
}

export async function saveOrigemMap(marca: ContasPagarMarcaId, map: OrigemMap): Promise<boolean> {
  return kvSet(origemMapKey(marca), map);
}

/** True quando a origem (pelo número) está cadastrada e deve ser somada na análise. */
export function isOrigemCadastrada(map: OrigemMap, numero: string): boolean {
  return map[numero] === true;
}

function duplicatasKey(marca: ContasPagarMarcaId, month: string): string {
  return `${DUPLICATAS_PREFIX}${marca}:${month}`;
}

export async function saveDuplicatas(data: ContasPagarImport): Promise<boolean> {
  return kvSet(duplicatasKey(data.marca, data.month), data);
}

export async function getDuplicatas(
  marca: ContasPagarMarcaId,
  month: string,
): Promise<ContasPagarImport | null> {
  return kvGet<ContasPagarImport>(duplicatasKey(marca, month));
}

export async function deleteDuplicatas(marca: ContasPagarMarcaId, month: string): Promise<boolean> {
  return kvDelete(duplicatasKey(marca, month));
}

/** Extrai o mês ('YYYY-MM') do fim de uma chave de storage. */
function monthFromKey(key: string): string | null {
  const m = key.match(/(\d{4}-\d{2})$/);
  return m ? m[1] : null;
}

/** Lista os meses ('YYYY-MM') disponíveis para a marca, ordenados do mais recente ao mais antigo. */
export async function getAvailableMonths(marca: ContasPagarMarcaId): Promise<string[]> {
  const keys = await kvKeys(`${DUPLICATAS_PREFIX}${marca}:*`);
  const months = keys.map(monthFromKey).filter((m): m is string => !!m);
  months.sort((a, b) => b.localeCompare(a));
  return months;
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
export function parseDuplicatasTxt(content: string): { headers: string[]; rows: string[][] } {
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
    return headers.map((_, i) => cells[i] ?? '');
  });

  return { headers, rows };
}
