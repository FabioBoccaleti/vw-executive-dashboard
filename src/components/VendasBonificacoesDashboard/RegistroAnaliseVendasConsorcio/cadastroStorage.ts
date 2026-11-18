import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'consorcio_cadastros';

export type BaseComissaoConsorcio = 'valor_carta' | 'bruta' | 'liquida';
export type PagamentoComissaoConsorcio = 'unica' | 'por_parcela';

export interface ProdutoConsorcio {
  id: string;
  nome: string;
  percentualSorana: string;
  parcelasSorana: number;
}

export interface CargoConsorcio {
  id: string;
  nome: string;
}

export interface VendedorConsorcio {
  id: string;
  nome: string;
  cargoId: string;
}

export interface RegraComissaoConsorcio {
  id: string;
  produtoId: string;
  cargoId: string;
  percentual: string;
  base: BaseComissaoConsorcio;
  pagamento: PagamentoComissaoConsorcio;
}

export interface CadastroConsorcio {
  produtos: ProdutoConsorcio[];
  cargos: CargoConsorcio[];
  vendedores: VendedorConsorcio[];
  regrasComissao: RegraComissaoConsorcio[];
  aliquotaImposto: string;
}

const EMPTY_CADASTRO: CadastroConsorcio = {
  produtos: [],
  cargos: [],
  vendedores: [],
  regrasComissao: [],
  aliquotaImposto: '',
};

export async function loadCadastroConsorcio(): Promise<CadastroConsorcio> {
  const data = await kvGet<CadastroConsorcio>(KEY, { throwOnError: true });
  if (!data) return EMPTY_CADASTRO;

  return {
    produtos: Array.isArray(data.produtos) ? data.produtos : [],
    cargos: Array.isArray(data.cargos) ? data.cargos : [],
    vendedores: Array.isArray(data.vendedores) ? data.vendedores : [],
    regrasComissao: Array.isArray(data.regrasComissao) ? data.regrasComissao : [],
    aliquotaImposto: typeof data.aliquotaImposto === 'string' ? data.aliquotaImposto : '',
  };
}

export async function saveCadastroConsorcio(data: CadastroConsorcio): Promise<boolean> {
  return kvSet(KEY, data);
}
