import { kvGet, kvSet, kvKeys } from '@/lib/kvClient';

export interface IEORow {
  conta: string;
  isMain: boolean;
  saldoAnterior: number;
  valDebito: number;
  valCredito: number;
  saldoPeriodo: number;
  saldoAtual: number;
}

export interface IEOTotalRow {
  saldoAnterior: number;
  valDebito: number;
  valCredito: number;
  saldoPeriodo: number;
  saldoAtual: number;
}

export interface IEOSemestreData {
  rows: IEORow[];
  totalRow: IEOTotalRow | null;
  importedAt: string;
  fileName: string;
}

const KEY_PREFIX = 'ieo';

function makeKey(year: number, semestre: number): string {
  return `${KEY_PREFIX}:${year}:S${semestre}`;
}

export async function getIEOSemestre(
  year: number,
  semestre: number,
): Promise<IEOSemestreData | null> {
  return kvGet<IEOSemestreData>(makeKey(year, semestre));
}

export async function setIEOSemestre(
  year: number,
  semestre: number,
  data: IEOSemestreData,
): Promise<void> {
  await kvSet(makeKey(year, semestre), data);
}

export async function deleteIEOSemestre(year: number, semestre: number): Promise<void> {
  await kvSet(makeKey(year, semestre), null);
}

export async function getAllImportedSemestresData(): Promise<IEOSemestreData[]> {
  const keys = await kvKeys(`${KEY_PREFIX}:*`);
  const dataKeys = keys.filter(k => /^ieo:\d{4}:S[12]$/.test(k));
  const results = await Promise.all(dataKeys.map(k => kvGet<IEOSemestreData>(k)));
  return results.filter((d): d is IEOSemestreData => d !== null);
}

// ─── Classificação de Revendas (Marca) ───────────────────────────────────────

export type Marca = 'audi' | 'vw';

export const MARCA_LABELS: Record<Marca, string> = {
  audi: 'Audi',
  vw: 'VW',
};

const REVENDAS_KEY = `${KEY_PREFIX}:revendas`;

export async function loadClassificacaoRevendas(): Promise<Record<string, Marca>> {
  return (await kvGet<Record<string, Marca>>(REVENDAS_KEY)) ?? {};
}

export async function saveClassificacaoRevendas(data: Record<string, Marca>): Promise<void> {
  await kvSet(REVENDAS_KEY, data);
}

// ─── Regras de Departamentos ─────────────────────────────────────────────────

export type DeptoClassificacao =
  | 'veiculos_novos'
  | 'venda_direta'
  | 'veiculos_usados'
  | 'pecas'
  | 'oficina'
  | 'funilaria'
  | 'administracao'
  | 'diretoria';

export const DEPTO_CLASSIFICACAO_LABELS: Record<DeptoClassificacao, string> = {
  veiculos_novos:  'Veículos Novos',
  venda_direta:    'Venda Direta',
  veiculos_usados: 'Veículos Usados',
  pecas:           'Peças',
  oficina:         'Oficina',
  funilaria:       'Funilaria',
  administracao:   'Administração',
  diretoria:       'Diretoria',
};

export const DEPTO_CLASSIFICACOES_ORDENADAS: DeptoClassificacao[] = [
  'veiculos_novos', 'venda_direta', 'veiculos_usados', 'pecas',
  'oficina', 'funilaria', 'administracao', 'diretoria',
];

// Para contas que começam com 3 ou 4, a classificação pode depender do Tipo Item
export interface RegraDepto {
  // Classificação padrão (usada para contas que NÃO começam com 3 ou 4)
  default?: DeptoClassificacao;
  // Classificações específicas por Tipo Item (P/S/V) - apenas para contas 3 e 4
  byTipoItem?: {
    P?: DeptoClassificacao;
    S?: DeptoClassificacao;
    V?: DeptoClassificacao;
  };
}

const REGRAS_KEY = `${KEY_PREFIX}:regras_departamentos`;

export async function loadRegrasDeptos(): Promise<Record<string, RegraDepto>> {
  return (await kvGet<Record<string, RegraDepto>>(REGRAS_KEY)) ?? {};
}

export async function saveRegrasDeptos(data: Record<string, RegraDepto>): Promise<void> {
  await kvSet(REGRAS_KEY, data);
}
