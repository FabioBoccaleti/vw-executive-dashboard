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
  };
}

export async function loadVendasRows(): Promise<VendasRow[]> {
  try {
    const data = await kvGet<VendasRow[]>(KEY);
    if (data && data.length > 0) return data;
  } catch { /* fallback */ }
  return Array.from({ length: 10 }, createEmptyRow);
}

export async function saveVendasRows(rows: VendasRow[]): Promise<boolean> {
  return kvSet(KEY, rows);
}
