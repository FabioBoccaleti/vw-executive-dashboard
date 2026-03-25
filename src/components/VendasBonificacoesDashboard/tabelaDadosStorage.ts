import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'vendas_tabela_dados_rows';

export interface TabelaDadosRow {
  id: string;
  dataFaturamento: string;
  nota: string;
  idVenda: string;
  pedido: string;
  arrendatario: string;
  fontePagadora: string;
  vencimento: string;
  valorNF: string;
  icmsSubstitutivo: string;
  corExterna: string;
  chassi: string;
  descricaoVeiculo: string;
}

export function createEmptyTabelaDadosRow(): TabelaDadosRow {
  return {
    id: crypto.randomUUID(),
    dataFaturamento: '',
    nota: '',
    idVenda: '',
    pedido: '',
    arrendatario: '',
    fontePagadora: '',
    vencimento: '',
    valorNF: '',
    icmsSubstitutivo: '',
    corExterna: '',
    chassi: '',
    descricaoVeiculo: '',
  };
}

export async function loadTabelaDadosRows(): Promise<TabelaDadosRow[]> {
  try {
    const data = await kvGet(KEY);
    if (Array.isArray(data)) return data as TabelaDadosRow[];
    return [];
  } catch {
    return [];
  }
}

export async function saveTabelaDadosRows(rows: TabelaDadosRow[]): Promise<boolean> {
  try {
    await kvSet(KEY, rows);
    return true;
  } catch {
    return false;
  }
}
