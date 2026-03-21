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
    'Adilson': 'Adilson Bezerra Dos Santos',
    'Aide': 'Aide Silva',
    'Alex': 'Alex Sander da Costa Malachim',
    'Geminiani': 'Alexandre Geminiani',
    'Latorre': 'Alexandre Pires Latorre',
    'Aline': 'Alexandre Pires Latorre',
    'Cesar': 'Cesar Luiz Garcia Lourenco',
    'Willian': 'Doarci William Tostes',
    'William': 'Doarci William Tostes',
    'Francisco': 'Francisco Nilton Carlos Soares',
    'Chico': 'Francisco Nilton Carlos Soares',
    'Julio': 'Julio Roberto Crepaldi',
    'Camargo': 'Camargo Leandro Andrade',
    'Leandro': 'Leandro Pereira dos Santos',
    'Capeli': 'Luciano Capeli',
    'Meire': 'Lucimeire da Conceição Santos',
    'Lucimeire': 'Lucimeire da Conceição Santos',
    'Luiz Bola': 'Luiz Arlindo Rodrigues de Oliveira',
    'Noemi': 'Noemi Freitas Lemes',
    'Paulo': 'Paulo Sergio Alves de Oliveira',
    'Roberto': 'Roberto Carlos',
    'Rose': 'Rosemeire Aparecida Campos',
    'Silas': 'Silas Rodrigo Alves dos Santos',
    'Ana Paula': 'Ana Paula Zinato de Novaes',
    'Mirtes': 'Mirtes Cristina Vieira de Moraes',
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
