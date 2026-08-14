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

const KEY_PREFIX = 'despesas_depto_audi';

function makeKey(year: number, month: number): string {
  return `${KEY_PREFIX}:${year}:${String(month).padStart(2, '0')}`;
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

const CLASSIFICACOES_KEY = `${KEY_PREFIX}:classificacoes`;

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

// Merge SALÁRIOS E ORDENADOS: soma 4150101001 + 5520101001 → 5510101003
export function mergeSalariosOrdenados(valorMap: Map<string, number>): void {
  let conta4150: string | null = null;
  let conta5520: string | null = null;
  let conta5510: string | null = null;
  
  for (const k of valorMap.keys()) {
    if (k.startsWith('4150101001')) conta4150 = k;
    if (k.startsWith('5520101001')) conta5520 = k;
    if (k.startsWith('5510101003')) conta5510 = k;
  }
  
  // Se não existe a conta principal, não faz nada
  if (!conta5510) return;
  
  // Soma os valores das contas 4150101001 e 5520101001 na conta 5510101003
  const val4150 = conta4150 ? (valorMap.get(conta4150) ?? 0) : 0;
  const val5520 = conta5520 ? (valorMap.get(conta5520) ?? 0) : 0;
  
  if (val4150 !== 0 || val5520 !== 0) {
    valorMap.set(conta5510, (valorMap.get(conta5510) ?? 0) + val4150 + val5520);
  }
  
  // Remove as contas que foram somadas
  if (conta4150) valorMap.delete(conta4150);
  if (conta5520) valorMap.delete(conta5520);
}

// Merge HORAS EXTRAS: soma 4150101004 → 5520101002
export function mergeHorasExtras(valorMap: Map<string, number>): void {
  let conta4150: string | null = null;
  let conta5520: string | null = null;
  
  for (const k of valorMap.keys()) {
    if (k.startsWith('4150101004')) conta4150 = k;
    if (k.startsWith('5520101002')) conta5520 = k;
  }
  
  // Se não existe a conta principal, não faz nada
  if (!conta5520) return;
  
  // Soma o valor da conta 4150101004 na conta 5520101002
  const val4150 = conta4150 ? (valorMap.get(conta4150) ?? 0) : 0;
  
  if (val4150 !== 0) {
    valorMap.set(conta5520, (valorMap.get(conta5520) ?? 0) + val4150);
  }
  
  // Remove a conta que foi somada
  if (conta4150) valorMap.delete(conta4150);
}

// Merge ADICIONAIS: soma 4150101005 → 5510101004
export function mergeAdicionais(valorMap: Map<string, number>): void {
  let conta4150: string | null = null;
  let conta5510: string | null = null;
  
  for (const k of valorMap.keys()) {
    if (k.startsWith('4150101005')) conta4150 = k;
    if (k.startsWith('5510101004')) conta5510 = k;
  }
  
  // Se não existe a conta principal, não faz nada
  if (!conta5510) return;
  
  // Soma o valor da conta 4150101005 na conta 5510101004
  const val4150 = conta4150 ? (valorMap.get(conta4150) ?? 0) : 0;
  
  if (val4150 !== 0) {
    valorMap.set(conta5510, (valorMap.get(conta5510) ?? 0) + val4150);
  }
  
  // Remove a conta que foi somada
  if (conta4150) valorMap.delete(conta4150);
}

// Merge INDENIZAÇÕES TRABALHISTAS: soma 4150101008 + 5510102008 → 5520101008
export function mergeIndenizacoesTrabalistas(valorMap: Map<string, number>): void {
  let conta4150: string | null = null;
  let conta5510: string | null = null;
  let conta5520: string | null = null;
  
  for (const k of valorMap.keys()) {
    if (k.startsWith('4150101008')) conta4150 = k;
    if (k.startsWith('5510102008')) conta5510 = k;
    if (k.startsWith('5520101008')) conta5520 = k;
  }
  
  // Se não existe a conta principal, não faz nada
  if (!conta5520) return;
  
  // Soma os valores das contas 4150101008 e 5510102008 na conta 5520101008
  const val4150 = conta4150 ? (valorMap.get(conta4150) ?? 0) : 0;
  const val5510 = conta5510 ? (valorMap.get(conta5510) ?? 0) : 0;
  
  if (val4150 !== 0 || val5510 !== 0) {
    valorMap.set(conta5520, (valorMap.get(conta5520) ?? 0) + val4150 + val5510);
  }
  
  // Remove as contas que foram somadas
  if (conta4150) valorMap.delete(conta4150);
  if (conta5510) valorMap.delete(conta5510);
}

// Merge 13º SALÁRIO: soma 4150102001 → 5510102001
export function merge13Salario(valorMap: Map<string, number>): void {
  let conta4150: string | null = null;
  let conta5510: string | null = null;
  
  for (const k of valorMap.keys()) {
    if (k.startsWith('4150102001')) conta4150 = k;
    if (k.startsWith('5510102001')) conta5510 = k;
  }
  
  // Se não existe a conta principal, não faz nada
  if (!conta5510) return;
  
  // Soma o valor da conta 4150102001 na conta 5510102001
  const val4150 = conta4150 ? (valorMap.get(conta4150) ?? 0) : 0;
  
  if (val4150 !== 0) {
    valorMap.set(conta5510, (valorMap.get(conta5510) ?? 0) + val4150);
  }
  
  // Remove a conta que foi somada
  if (conta4150) valorMap.delete(conta4150);
}

// Merge 13º SALÁRIO INDENIZADO: soma 4150102002 → 5520102002
export function merge13SalarioIndenizado(valorMap: Map<string, number>): void {
  let conta4150: string | null = null;
  let conta5520: string | null = null;
  
  for (const k of valorMap.keys()) {
    if (k.startsWith('4150102002')) conta4150 = k;
    if (k.startsWith('5520102002')) conta5520 = k;
  }
  
  // Se não existe a conta principal, não faz nada
  if (!conta5520) return;
  
  // Soma o valor da conta 4150102002 na conta 5520102002
  const val4150 = conta4150 ? (valorMap.get(conta4150) ?? 0) : 0;
  
  if (val4150 !== 0) {
    valorMap.set(conta5520, (valorMap.get(conta5520) ?? 0) + val4150);
  }
  
  // Remove a conta que foi somada
  if (conta4150) valorMap.delete(conta4150);
}

// Merge FÉRIAS INDENIZADAS: soma 4150102004 + 5510102004 → 5520102004
export function mergeFeriasIndenizadas(valorMap: Map<string, number>): void {
  let conta4150: string | null = null;
  let conta5510: string | null = null;
  let conta5520: string | null = null;
  
  for (const k of valorMap.keys()) {
    if (k.startsWith('4150102004')) conta4150 = k;
    if (k.startsWith('5510102004')) conta5510 = k;
    if (k.startsWith('5520102004')) conta5520 = k;
  }
  
  // Se não existe a conta principal, não faz nada
  if (!conta5520) return;
  
  // Soma os valores das contas 4150102004 e 5510102004 na conta 5520102004
  const val4150 = conta4150 ? (valorMap.get(conta4150) ?? 0) : 0;
  const val5510 = conta5510 ? (valorMap.get(conta5510) ?? 0) : 0;
  
  if (val4150 !== 0 || val5510 !== 0) {
    valorMap.set(conta5520, (valorMap.get(conta5520) ?? 0) + val4150 + val5510);
  }
  
  // Remove as contas que foram somadas
  if (conta4150) valorMap.delete(conta4150);
  if (conta5510) valorMap.delete(conta5510);
}

// Merge FÉRIAS: soma 4150102003 → 5510102003
export function mergeFerias(valorMap: Map<string, number>): void {
  let conta4150: string | null = null;
  let conta5510: string | null = null;
  
  for (const k of valorMap.keys()) {
    if (k.startsWith('4150102003')) conta4150 = k;
    if (k.startsWith('5510102003')) conta5510 = k;
  }
  
  // Se não existe a conta principal, não faz nada
  if (!conta5510) return;
  
  // Soma o valor da conta 4150102003 na conta 5510102003
  const val4150 = conta4150 ? (valorMap.get(conta4150) ?? 0) : 0;
  
  if (val4150 !== 0) {
    valorMap.set(conta5510, (valorMap.get(conta5510) ?? 0) + val4150);
  }
  
  // Remove a conta que foi somada
  if (conta4150) valorMap.delete(conta4150);
}

// Merge I.N.S.S.: soma 4150102010 → 5510102010
export function mergeInss(valorMap: Map<string, number>): void {
  let conta4150: string | null = null;
  let conta5510: string | null = null;
  
  for (const k of valorMap.keys()) {
    if (k.startsWith('4150102010')) conta4150 = k;
    if (k.startsWith('5510102010')) conta5510 = k;
  }
  
  // Se não existe a conta principal, não faz nada
  if (!conta5510) return;
  
  // Soma o valor da conta 4150102010 na conta 5510102010
  const val4150 = conta4150 ? (valorMap.get(conta4150) ?? 0) : 0;
  
  if (val4150 !== 0) {
    valorMap.set(conta5510, (valorMap.get(conta5510) ?? 0) + val4150);
  }
  
  // Remove a conta que foi somada
  if (conta4150) valorMap.delete(conta4150);
}

// Merge F.G.T.S.: soma 4150102012 → 5510102011
export function mergeFgts(valorMap: Map<string, number>): void {
  let conta4150: string | null = null;
  let conta5510: string | null = null;
  
  for (const k of valorMap.keys()) {
    if (k.startsWith('4150102012')) conta4150 = k;
    if (k.startsWith('5510102011')) conta5510 = k;
  }
  
  // Se não existe a conta principal, não faz nada
  if (!conta5510) return;
  
  // Soma o valor da conta 4150102012 na conta 5510102011
  const val4150 = conta4150 ? (valorMap.get(conta4150) ?? 0) : 0;
  
  if (val4150 !== 0) {
    valorMap.set(conta5510, (valorMap.get(conta5510) ?? 0) + val4150);
  }
  
  // Remove a conta que foi somada
  if (conta4150) valorMap.delete(conta4150);
}

// Merge F.G.T.S. - MULTA: soma 4150102013 → 5520102013
export function mergeFgtsMulta(valorMap: Map<string, number>): void {
  let conta4150: string | null = null;
  let conta5520: string | null = null;
  
  for (const k of valorMap.keys()) {
    if (k.startsWith('4150102013')) conta4150 = k;
    if (k.startsWith('5520102013')) conta5520 = k;
  }
  
  // Se não existe a conta principal, não faz nada
  if (!conta5520) return;
  
  // Soma o valor da conta 4150102013 na conta 5520102013
  const val4150 = conta4150 ? (valorMap.get(conta4150) ?? 0) : 0;
  
  if (val4150 !== 0) {
    valorMap.set(conta5520, (valorMap.get(conta5520) ?? 0) + val4150);
  }
  
  // Remove a conta que foi somada
  if (conta4150) valorMap.delete(conta4150);
}

// Merge ASSISTÊNCIA MÉDICA (nova regra): soma 4150103001 → 5520103001
export function mergeAssistenciaMedicaNova(valorMap: Map<string, number>): void {
  let conta4150: string | null = null;
  let conta5520: string | null = null;
  
  for (const k of valorMap.keys()) {
    if (k.startsWith('4150103001')) conta4150 = k;
    if (k.startsWith('5520103001')) conta5520 = k;
  }
  
  // Se não existe a conta principal, não faz nada
  if (!conta5520) return;
  
  // Soma o valor da conta 4150103001 na conta 5520103001
  const val4150 = conta4150 ? (valorMap.get(conta4150) ?? 0) : 0;
  
  if (val4150 !== 0) {
    valorMap.set(conta5520, (valorMap.get(conta5520) ?? 0) + val4150);
  }
  
  // Remove a conta que foi somada
  if (conta4150) valorMap.delete(conta4150);
}

// Merge VALE TRANSPORTE: soma 4150103010 + 5510102015 → 5520103010
export function mergeValeTransporte(valorMap: Map<string, number>): void {
  let conta4150: string | null = null;
  let conta5510: string | null = null;
  let conta5520: string | null = null;
  
  for (const k of valorMap.keys()) {
    if (k.startsWith('4150103010')) conta4150 = k;
    if (k.startsWith('5510102015')) conta5510 = k;
    if (k.startsWith('5520103010')) conta5520 = k;
  }
  
  // Se não existe a conta principal, não faz nada
  if (!conta5520) return;
  
  // Soma os valores das contas 4150103010 e 5510102015 na conta 5520103010
  const val4150 = conta4150 ? (valorMap.get(conta4150) ?? 0) : 0;
  const val5510 = conta5510 ? (valorMap.get(conta5510) ?? 0) : 0;
  
  if (val4150 !== 0 || val5510 !== 0) {
    valorMap.set(conta5520, (valorMap.get(conta5520) ?? 0) + val4150 + val5510);
  }
  
  // Remove as contas que foram somadas
  if (conta4150) valorMap.delete(conta4150);
  if (conta5510) valorMap.delete(conta5510);
}

// Merge PRÊMIOS E GRATIFICAÇÕES: soma 5510101002 + 4150101003 → 5520101004
export function mergePremiosGratificacoes(valorMap: Map<string, number>): void {
  let conta4150: string | null = null;
  let conta5510: string | null = null;
  let conta5520: string | null = null;
  
  for (const k of valorMap.keys()) {
    if (k.startsWith('4150101003')) conta4150 = k;
    if (k.startsWith('5510101002')) conta5510 = k;
    if (k.startsWith('5520101004')) conta5520 = k;
  }
  
  // Se não existe a conta principal, não faz nada
  if (!conta5520) return;
  
  // Soma os valores das contas 5510101002 e 4150101003 na conta 5520101004
  const val4150 = conta4150 ? (valorMap.get(conta4150) ?? 0) : 0;
  const val5510 = conta5510 ? (valorMap.get(conta5510) ?? 0) : 0;
  
  if (val4150 !== 0 || val5510 !== 0) {
    valorMap.set(conta5520, (valorMap.get(conta5520) ?? 0) + val4150 + val5510);
  }
  
  // Remove as contas que foram somadas
  if (conta4150) valorMap.delete(conta4150);
  if (conta5510) valorMap.delete(conta5510);
}

export async function getAllImportedMonthsData(): Promise<DespesasAdmMesData[]> {
  const keys = await kvKeys(`${KEY_PREFIX}:*`);
  const monthKeys = keys.filter(k => new RegExp(`^${KEY_PREFIX}:\\d{4}:\\d{2}$`).test(k));
  if (monthKeys.length === 0) return [];
  const results = await Promise.all(monthKeys.map(k => kvGet<DespesasAdmMesData>(k)));
  return results.filter((d): d is DespesasAdmMesData => d !== null);
}

// ─── Extrator hierárquico (empresa → depto) ───────────────────────────────────
export function extractByCompaniesAndDepts(
  data: DespesasAdmMesData,
  companies: string[],
  depts: string[],
): Map<string, number> {
  const result = new Map<string, number>();
  let currentMain: string | null = null;
  let currentEntryKey: string | null = null;
  let isTargetCompany = false;

  const entries = new Map<string, {
    companyValor: number;
    deptTotal: number;
    hasAnyDept: boolean;
    hasMatchingDept: boolean;
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
        e.hasAnyDept = true;
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
      valor = e.deptTotal;
    } else if (!e.hasAnyDept) {
      valor = e.companyValor;
    } else {
      valor = 0;
    }
    if (valor !== 0) result.set(mainAccount, (result.get(mainAccount) ?? 0) + valor);
  }

  return result;
}

function makeObsKey(prefix: string, year: number, month: number): string {
  return `${KEY_PREFIX}:obs_${prefix}:${year}:${String(month).padStart(2, '0')}`;
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

export async function loadObsVendaDireta(year: number, month: number): Promise<Record<string, string>> {
  return (await kvGet<Record<string, string>>(makeObsKey('venda_direta', year, month))) ?? {};
}

export async function saveObsVendaDireta(year: number, month: number, obs: Record<string, string>): Promise<void> {
  await kvSet(makeObsKey('venda_direta', year, month), obs);
}

export async function loadObsPecas(year: number, month: number): Promise<Record<string, string>> {
  return (await kvGet<Record<string, string>>(makeObsKey('pecas', year, month))) ?? {};
}

export async function saveObsPecas(year: number, month: number, obs: Record<string, string>): Promise<void> {
  await kvSet(makeObsKey('pecas', year, month), obs);
}

export async function loadObsOficina(year: number, month: number): Promise<Record<string, string>> {
  return (await kvGet<Record<string, string>>(makeObsKey('oficina', year, month))) ?? {};
}

export async function saveObsOficina(year: number, month: number, obs: Record<string, string>): Promise<void> {
  await kvSet(makeObsKey('oficina', year, month), obs);
}

export async function loadObsFunilaria(year: number, month: number): Promise<Record<string, string>> {
  return (await kvGet<Record<string, string>>(makeObsKey('funilaria', year, month))) ?? {};
}

export async function saveObsFunilaria(year: number, month: number, obs: Record<string, string>): Promise<void> {
  await kvSet(makeObsKey('funilaria', year, month), obs);
}

export async function loadObsAdministracao(year: number, month: number): Promise<Record<string, string>> {
  return (await kvGet<Record<string, string>>(makeObsKey('administracao', year, month))) ?? {};
}

export async function saveObsAdministracao(year: number, month: number, obs: Record<string, string>): Promise<void> {
  await kvSet(makeObsKey('administracao', year, month), obs);
}

// ─── Regras de Departamentos ─────────────────────────────────────────────────

export type DeptoTab =
  | 'veiculos_novos'
  | 'venda_direta'
  | 'veiculos_usados'
  | 'pecas'
  | 'oficina'
  | 'funilaria'
  | 'administracao'
  | 'diretoria';

export const DEPTO_TAB_LABELS: Record<DeptoTab, string> = {
  veiculos_novos:  'Veículos Novos',
  venda_direta:    'Venda Direta',
  veiculos_usados: 'Veículos Usados',
  pecas:           'Peças',
  oficina:         'Oficina',
  funilaria:       'Funilaria',
  administracao:   'Administração',
  diretoria:       'Diretoria',
};

export const DEPTO_TABS_ORDENADOS: DeptoTab[] = [
  'veiculos_novos', 'venda_direta', 'veiculos_usados', 'pecas',
  'oficina', 'funilaria', 'administracao', 'diretoria',
];

const REGRAS_KEY = `${KEY_PREFIX}:regras_departamentos`;

export async function loadRegrasDeptos(): Promise<Record<string, DeptoTab>> {
  return (await kvGet<Record<string, DeptoTab>>(REGRAS_KEY)) ?? {};
}

export async function saveRegrasDeptos(data: Record<string, DeptoTab>): Promise<void> {
  await kvSet(REGRAS_KEY, data);
}

// Extrai contas filtradas pelo departamento classificado para a aba alvo
export function extractByDeptoRule(
  data: DespesasAdmMesData,
  targetTab: DeptoTab,
  regras: Record<string, DeptoTab>,
): Map<string, number> {
  const result = new Map<string, number>();
  let currentMain: string | null = null;

  for (const row of data.rows) {
    if (row.isMain) {
      currentMain = row.conta;
    } else if (currentMain) {
      if (!/^\d{3,} -/.test(row.conta)) continue;
      const prefix = row.conta.match(/^(\d+ -)/)?.[1] ?? '';
      if (regras[prefix] !== targetTab) continue;
      const valor = row.valDebito - row.valCredito;
      if (valor !== 0) result.set(currentMain, (result.get(currentMain) ?? 0) + valor);
    }
  }

  return result;
}

// Extrai todos os deptos com qualquer classificação (para Consolidado)
export function extractByDeptoRuleAll(
  data: DespesasAdmMesData,
  regras: Record<string, DeptoTab>,
): Map<string, number> {
  const result = new Map<string, number>();
  let currentMain: string | null = null;

  for (const row of data.rows) {
    if (row.isMain) {
      currentMain = row.conta;
    } else if (currentMain) {
      if (!/^\d{3,} -/.test(row.conta)) continue;
      const prefix = row.conta.match(/^(\d+ -)/)?.[1] ?? '';
      if (!regras[prefix]) continue;
      const valor = row.valDebito - row.valCredito;
      if (valor !== 0) result.set(currentMain, (result.get(currentMain) ?? 0) + valor);
    }
  }

  return result;
}
