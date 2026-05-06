import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'arquivo_piv_montadora';

export interface ArquivoPivHeader {
  dn: string;
  cnpj: string;
  valorCredito: string;
  creditoAtacado: string;
  creditoSatisfacao: string;
  mesApurado: string;   // "01/2026"
  dataEmissao: string;
  horaEmissao: string;
}

export interface ArquivoPivResumo {
  criterioAtacadoPct: string;
  motivosAtacado: string[];
  criterioSatisfacaoPct: string;
  motivosSatisfacao: string[];
}

export interface ArquivoPivCriterioSat {
  periodo: string;
  notaDN: string;
  notaReg: string;
  bonif: string;
  motivo: string;
}

export interface ArquivoPivRow {
  id: string;
  mes: string;
  chassi: string;
  modelGroup: string;
  precoPublico: string;
  critAtacado: string;
  direitoBonusAtacado: string;
  motivoPenalizacaoAtacado: string;
  valorBonusAtacado: string;
  critSatisfacao: string;
  direitoBonusSatisfacao: string;
  motivoPenalizacaoSatisfacao: string;
  valorBonusSatisfacao: string;
  dataFaturamentoAtacado: string;
  dataVendaVarejo: string;
  dataEmplacamento: string;
  cidadeEstado: string;
}

export interface ArquivoPivData {
  header: ArquivoPivHeader;
  resumo: ArquivoPivResumo;
  criterioSat: ArquivoPivCriterioSat;
  rows: ArquivoPivRow[];
  importedAt: string;
  fileName: string;
  periodoKey: string;
}

type ArquivoPivStore = Record<string, ArquivoPivData>;

export async function loadArquivoPivStore(): Promise<ArquivoPivStore> {
  try {
    const data = await kvGet(KEY);
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as ArquivoPivStore;
    return {};
  } catch { return {}; }
}

export async function loadArquivoPivData(pk: string): Promise<ArquivoPivData | null> {
  const store = await loadArquivoPivStore();
  return store[pk] ?? null;
}

export async function saveArquivoPivData(pk: string, data: ArquivoPivData): Promise<void> {
  try {
    const store = await loadArquivoPivStore();
    store[pk] = data;
    await kvSet(KEY, store);
  } catch { /* ignore */ }
}
