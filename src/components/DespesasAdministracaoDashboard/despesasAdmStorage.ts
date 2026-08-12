import { kvGet, kvSet, kvKeys } from '@/lib/kvClient';

export type TipoClassificacao =
  | 'pessoal'
  | 'servicos_terceiros'
  | 'ocupacao'
  | 'funcionamento'
  | 'vendas'
  | 'amort_deprec'
  | 'financeiras'
  | 'outras_operacionais';

export const TIPO_LABELS: Record<TipoClassificacao, string> = {
  pessoal:             'Despesas c/ Pessoal',
  servicos_terceiros:  'Despesas c/ Serviços de Terceiros',
  ocupacao:            'Despesas c/ Ocupação',
  funcionamento:       'Despesas c/ Funcionamento',
  vendas:              'Despesas c/ Vendas',
  amort_deprec:        'Amortizações e Depreciações',
  financeiras:         'Despesas Financeiras',
  outras_operacionais: 'Outras Despesas Operacionais',
};

export const TIPOS_ORDENADOS: TipoClassificacao[] = [
  'pessoal', 'servicos_terceiros', 'ocupacao', 'funcionamento',
  'vendas', 'amort_deprec', 'financeiras', 'outras_operacionais',
];

export interface DespesaAdmRow {
  conta: string;
  isMain: boolean;
  saldoAnterior: number;
  valDebito: number;
  valCredito: number;
  saldoPeriodo: number;
  saldoAtual: number;
}

export interface DespesasAdmTotalRow {
  saldoAnterior: number;
  valDebito: number;
  valCredito: number;
  saldoPeriodo: number;
  saldoAtual: number;
}

export interface DespesasAdmMesData {
  rows: DespesaAdmRow[];
  totalRow: DespesasAdmTotalRow | null;
  importedAt: string;
  fileName: string;
}

function makeKey(year: number, month: number): string {
  return `despesas_adm:${year}:${String(month).padStart(2, '0')}`;
}

export async function getDespesasAdmMes(
  year: number,
  month: number,
): Promise<DespesasAdmMesData | null> {
  return kvGet<DespesasAdmMesData>(makeKey(year, month));
}

export async function setDespesasAdmMes(
  year: number,
  month: number,
  data: DespesasAdmMesData,
): Promise<void> {
  await kvSet(makeKey(year, month), data);
}

export async function deleteDespesasAdmMes(year: number, month: number): Promise<void> {
  await kvSet(makeKey(year, month), null);
}

const CLASSIFICACOES_KEY = 'despesas_adm:classificacoes';

export async function loadClassificacoes(): Promise<Record<string, TipoClassificacao>> {
  return (await kvGet<Record<string, TipoClassificacao>>(CLASSIFICACOES_KEY)) ?? {};
}

export async function saveClassificacoes(data: Record<string, TipoClassificacao>): Promise<void> {
  await kvSet(CLASSIFICACOES_KEY, data);
}

// Merge 5510102013 → 5520103001 (ambas "ASSISTÊNCIA MÉDICA") antes de exibir
export function mergeAssistenciaMedica(valorMap: Map<string, number>): void {
  let sourceKey: string | null = null;
  let targetKey: string | null = null;
  for (const k of valorMap.keys()) {
    if (k.startsWith('5510102013')) sourceKey = k;
    if (k.startsWith('5520103001')) targetKey = k;
  }
  if (!sourceKey) return;
  const sourceVal = valorMap.get(sourceKey) ?? 0;
  if (targetKey) {
    valorMap.set(targetKey, (valorMap.get(targetKey) ?? 0) + sourceVal);
  }
  valorMap.delete(sourceKey);
}

export async function getAllImportedMonthsData(): Promise<DespesasAdmMesData[]> {
  const keys = await kvKeys('despesas_adm:*');
  const monthKeys = keys.filter(k => /^despesas_adm:\d{4}:\d{2}$/.test(k));
  if (monthKeys.length === 0) return [];
  const results = await Promise.all(monthKeys.map(k => kvGet<DespesasAdmMesData>(k)));
  return results.filter((d): d is DespesasAdmMesData => d !== null);
}

// ─── Extrator hierárquico (empresa → depto) ───────────────────────────────────
// Detecta nível pela forma do código: "1 -" = empresa, "105 -" = depto (CCusto)
// Se não encontrar linhas de depto, usa o valor da linha da empresa (retrocompat.)

export function extractByCompaniesAndDepts(
  data: DespesasAdmMesData,
  companies: string[], // prefixos do conta trimado, ex: ['1 -']
  depts: string[],     // prefixos do conta trimado, ex: ['105 -', '120 -']
): Map<string, number> {
  const result = new Map<string, number>();
  let currentMain: string | null = null;
  let currentEntryKey: string | null = null;
  let isTargetCompany = false;

  // chave = "mainAccount\x00companyRow"
  const entries = new Map<string, {
    companyValor: number;
    deptTotal: number;
    hasAnyDept: boolean;    // existem linhas de depto (qualquer)
    hasMatchingDept: boolean; // existem linhas de depto que batem nos critérios
  }>();

  for (const row of data.rows) {
    if (row.isMain) {
      currentMain = row.conta;
      currentEntryKey = null;
      isTargetCompany = false;
    } else if (currentMain) {
      const isCompany = /^\d{1,2} -/.test(row.conta);
      const isDept    = /^\d{3,} -/.test(row.conta);

      if (isCompany) {
        isTargetCompany = companies.some(p => row.conta.startsWith(p));
        currentEntryKey = `${currentMain}\x00${row.conta}`;
        if (isTargetCompany) {
          entries.set(currentEntryKey, {
            companyValor: row.valDebito - row.valCredito,
            deptTotal: 0,
            hasAnyDept: false,
            hasMatchingDept: false,
          });
        }
      } else if (isDept && isTargetCompany && currentEntryKey) {
        const e = entries.get(currentEntryKey)!;
        e.hasAnyDept = true; // registra que há linhas de depto (mesmo que não batam)
        if (depts.some(d => row.conta.startsWith(d))) {
          e.deptTotal += row.valDebito - row.valCredito;
          e.hasMatchingDept = true;
        }
      }
    }
  }

  for (const [key, e] of entries) {
    const mainAccount = key.split('\x00')[0];
    let valor: number;
    if (e.hasMatchingDept) {
      valor = e.deptTotal;                  // usa só os deptos que batem
    } else if (!e.hasAnyDept) {
      valor = e.companyValor;               // sem deptos no arquivo → formato antigo, usa empresa
    } else {
      valor = 0;                            // tem deptos mas nenhum bate → não inclui
    }
    if (valor !== 0) result.set(mainAccount, (result.get(mainAccount) ?? 0) + valor);
  }

  return result;
}

function makeObsKey(prefix: string, year: number, month: number): string {
  return `despesas_adm:obs_${prefix}:${year}:${String(month).padStart(2, '0')}`;
}

export async function loadObsVw(year: number, month: number): Promise<Record<string, string>> {
  return (await kvGet<Record<string, string>>(makeObsKey('vw', year, month))) ?? {};
}

export async function saveObsVw(year: number, month: number, obs: Record<string, string>): Promise<void> {
  await kvSet(makeObsKey('vw', year, month), obs);
}

export async function loadObsAudi(year: number, month: number): Promise<Record<string, string>> {
  return (await kvGet<Record<string, string>>(makeObsKey('audi', year, month))) ?? {};
}

export async function saveObsAudi(year: number, month: number, obs: Record<string, string>): Promise<void> {
  await kvSet(makeObsKey('audi', year, month), obs);
}

export async function loadObsConsolidado(year: number, month: number): Promise<Record<string, string>> {
  return (await kvGet<Record<string, string>>(makeObsKey('consolidado', year, month))) ?? {};
}

export async function saveObsConsolidado(year: number, month: number, obs: Record<string, string>): Promise<void> {
  await kvSet(makeObsKey('consolidado', year, month), obs);
}

export async function loadObsDiretoria(year: number, month: number): Promise<Record<string, string>> {
  return (await kvGet<Record<string, string>>(makeObsKey('diretoria', year, month))) ?? {};
}

export async function saveObsDiretoria(year: number, month: number, obs: Record<string, string>): Promise<void> {
  await kvSet(makeObsKey('diretoria', year, month), obs);
}
