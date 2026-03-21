import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'vendas_bonificacoes_rows';

export interface VendasRow {
  id: string;
  veiculo: string;
  chassi: string;
  revenda: string;
  blindadora: string;
  custoBlindagem: string;
  dataPagamentoBlindadora: string;
  situacaoNegociacaoBlindadora: string;
  dataVenda: string;
  valorVendaBlindagem: string;
  lucroOperacao: string;
  localPgtoBlindagem: string;
  nomeVendedor: string;
  remuneracaoVendedor: string;
  remuneracaoGerencia: string;
  remuneracaoDiretoria: string;
  remuneracaoGerenciaSupervisorUsados: string;
  comissaoBrutaSorana: string;
  numeroNFComissao: string;
  situacaoComissao: string;
  valorAPagarBlindadora: string;
  valorAReceberBlindadora: string;
  dataAcerto: string;
}

export function createEmptyRow(): VendasRow {
  return {
    id: crypto.randomUUID(),
    veiculo: '',
    chassi: '',
    revenda: '',
    blindadora: '',
    custoBlindagem: '',
    dataPagamentoBlindadora: '',
    situacaoNegociacaoBlindadora: 'Negociação Direta',
    dataVenda: '',
    valorVendaBlindagem: '',
    lucroOperacao: '',
    localPgtoBlindagem: '',
    nomeVendedor: '',
    remuneracaoVendedor: '',
    remuneracaoGerencia: '',
    remuneracaoDiretoria: '',
    remuneracaoGerenciaSupervisorUsados: '',
    comissaoBrutaSorana: '',
    numeroNFComissao: '',
    situacaoComissao: '',
    valorAPagarBlindadora: '',
    valorAReceberBlindadora: '',
    dataAcerto: '',
  };
}

function normalizeRows(rows: VendasRow[]): { rows: VendasRow[]; changed: boolean } {
  const nameMap: Record<string, string> = {
    'Guska': 'Rodrigo Guska',
    'Bola': 'Luiz Arlindo Rodrigues de Oliveira',
    'Orlando': 'Orlando Chodin Neto',
    'Rodrigo': 'Rodrigo de Araujo Andrade',
  };
  let changed = false;
  const normalized = rows.map(row => {
    const corrected = nameMap[row.nomeVendedor];
    if (corrected) {
      changed = true;
      return { ...row, nomeVendedor: corrected };
    }
    return row;
  });
  return { rows: normalized, changed };
}

export async function loadVendasRows(): Promise<VendasRow[]> {
  try {
    const data = await kvGet<VendasRow[]>(KEY);
    if (data && data.length > 0) {
      const { rows, changed } = normalizeRows(data);
      if (changed) await kvSet(KEY, rows);
      return rows;
    }
  } catch { /* fallback */ }
  return Array.from({ length: 10 }, createEmptyRow);
}

export async function saveVendasRows(rows: VendasRow[]): Promise<boolean> {
  return kvSet(KEY, rows);
}
