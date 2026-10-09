import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'signdrive_registros';

export interface AssinaturaRow {
  id: string;
  dataRegistro: string;
  dataVenda: string;
  numeroPedido: string;
  cliente: string;
  tipoVenda: string;
  veiculo: string;
  chassi: string;
  placa: string;
  vendedor: string;
  valorContrato: string;
  comissaoEntrega: string;
  comissaoVenda: string;
  totalComissoesBruta: string;
  pctRentabilidadeBruta: string;
  impostosComissao: string;
  totalComissaoLiquida: string;
  pctRentabilidadeLiquida: string;
  dataEntrega: string;
  nfComissao: string;
  situacaoComissao: string;
  situacaoComissaoVendedor: string;
  /** Valor congelado da estimativa de comissão (preenchido ao travar via Sit. Comissão vendedor). */
  estimativaComissaoVendedor?: string;
  anulada?: boolean;
  comissaoEditada?: boolean;
}

export async function loadAssinaturaRows(): Promise<AssinaturaRow[]> {
  return (await kvGet<AssinaturaRow[]>(KEY)) ?? [];
}

export async function saveAssinaturaRows(rows: AssinaturaRow[]): Promise<boolean> {
  return kvSet(KEY, rows);
}
