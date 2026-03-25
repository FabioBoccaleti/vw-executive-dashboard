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

/**
 * Adiciona linhas à tabela, ignorando duplicatas pelo campo chassi.
 * Retorna quantas foram adicionadas e quais chassi foram duplicatas.
 */
export async function appendTabelaDadosRows(
  newRows: Omit<TabelaDadosRow, 'id'>[],
): Promise<{ added: number; duplicates: string[] }> {
  const existing = await loadTabelaDadosRows();
  const existingChassis = new Set(
    existing.map(r => r.chassi.trim().toLowerCase()).filter(Boolean),
  );
  const toAdd: TabelaDadosRow[] = [];
  const duplicates: string[] = [];

  for (const row of newRows) {
    const chassiKey = row.chassi.trim().toLowerCase();
    if (chassiKey && existingChassis.has(chassiKey)) {
      duplicates.push(row.chassi);
    } else {
      if (chassiKey) existingChassis.add(chassiKey);
      toAdd.push({ ...row, id: crypto.randomUUID() });
    }
  }

  if (toAdd.length > 0) {
    await saveTabelaDadosRows([...existing, ...toAdd]);
  }

  return { added: toAdd.length, duplicates };
}
