import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'vendedores_remuneracao';

export type ModalidadeVenda = 'novos' | 'usados' | 'vd_frotista';

export interface FaixaBonus {
  id: string;
  de: string;     // número mínimo de vendas (inteiro)
  ate: string;    // número máximo de vendas — vazio = "em diante" (faixa aberta)
  percentual: string; // % bônus sobre a venda, ex: "0.05"
}

export interface RemuneracaoModalidade {
  modalidade: ModalidadeVenda;
  comissaoVenda: string;      // % sobre valor da venda, ex: "1.00"
  comissaoLucroBruto: string; // % sobre lucro bruto, ex: "5.00"
  faixasBonus: FaixaBonus[];
}

export type RemuneracaoData = Record<ModalidadeVenda, RemuneracaoModalidade>;

const DEFAULT_DATA: RemuneracaoData = {
  novos: {
    modalidade: 'novos',
    comissaoVenda: '',
    comissaoLucroBruto: '',
    faixasBonus: [],
  },
  usados: {
    modalidade: 'usados',
    comissaoVenda: '',
    comissaoLucroBruto: '',
    faixasBonus: [],
  },
  vd_frotista: {
    modalidade: 'vd_frotista',
    comissaoVenda: '',
    comissaoLucroBruto: '',
    faixasBonus: [],
  },
};

export async function loadRemuneracao(): Promise<RemuneracaoData> {
  try {
    const data = await kvGet(KEY);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as RemuneracaoData;
    }
    return DEFAULT_DATA;
  } catch {
    return DEFAULT_DATA;
  }
}

export async function saveRemuneracao(data: RemuneracaoData): Promise<void> {
  await kvSet(KEY, data);
}

// ─── DSR de Vendas ────────────────────────────────────────────────────────────
const KEY_DSR = 'vendas_dsr';

export interface VendasDsrConfig {
  id: string;
  ano: number;
  mes: number;       // 1–12
  percentual: string; // ex: "16.67"
}

export async function loadVendasDsr(): Promise<VendasDsrConfig[]> {
  try {
    const data = await kvGet(KEY_DSR);
    if (Array.isArray(data)) return data as VendasDsrConfig[];
    return [];
  } catch { return []; }
}

export async function saveVendasDsr(items: VendasDsrConfig[]): Promise<void> {
  await kvSet(KEY_DSR, items);
}

// ─── Alíquotas de Imposto ─────────────────────────────────────────────────────
const KEY_ALIQUOTAS = 'vendas_aliquotas_imposto';

export interface AliquotaImposto {
  id: string;
  tipo: string;       // ex: "ISS", "PIS", "COFINS"
  aliquota: string;   // % ex: "5.00"
  encargos: string;   // % opcional, ex: "1.50"
}

export async function loadAliquotas(): Promise<AliquotaImposto[]> {
  try {
    const data = await kvGet(KEY_ALIQUOTAS);
    if (Array.isArray(data)) return data as AliquotaImposto[];
    return [];
  } catch { return []; }
}

export async function saveAliquotas(items: AliquotaImposto[]): Promise<void> {
  await kvSet(KEY_ALIQUOTAS, items);
}
