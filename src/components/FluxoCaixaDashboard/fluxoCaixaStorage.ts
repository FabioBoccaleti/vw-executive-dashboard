// Serviço para persistência dos dados do Fluxo de Caixa no Redis (Vercel KV)

const KV_API_BASE = '/api/kv';
const FLUXO_CAIXA_KEY = 'fluxo_caixa_data';

export interface FluxoCaixaData {
  accounts: Record<string, any>;
  ativo: any;
  disponib: any;
  caixaGeral: any;
  bancos: any;
  aplicLiq: any;
  holdBack: any;
  estoques: any;
  estVeicNovos: any;
  estVeicUsados: any;
  estPecas: any;
  creditos: any;
  contasCorr: any;
  valDiversos: any;
  realizLP: any;
  investimentos: any;
  imobiliz: any;
  passivo: any;
  emprestCP: any;
  obrigTrab: any;
  obrigTrib: any;
  contasPagar: any;
  fornecVW: any;
  fornecAudi: any;
  PL: any;
  capitalSocial: any;
  receitas: any;
  custos: any;
  dfc: any;
  indicadores: any;
  timestamp?: number;
}

/**
 * Salva os dados do Fluxo de Caixa no Redis
 */
export async function saveFluxoCaixaData(data: FluxoCaixaData): Promise<boolean> {
  try {
    // Adiciona timestamp
    const dataWithTimestamp = {
      ...data,
      timestamp: Date.now()
    };

    const response = await fetch(`${KV_API_BASE}/set`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: FLUXO_CAIXA_KEY,
        value: dataWithTimestamp,
      }),
    });

    if (!response.ok) {
      console.error('Erro ao salvar dados no Redis:', await response.text());
      return false;
    }

    const result = await response.json();
    console.log('Dados do Fluxo de Caixa salvos no Redis:', result);
    return result.success === true;
  } catch (error) {
    console.error('Erro ao salvar dados do Fluxo de Caixa:', error);
    return false;
  }
}

/**
 * Carrega os dados do Fluxo de Caixa do Redis
 */
export async function loadFluxoCaixaData(): Promise<FluxoCaixaData | null> {
  try {
    const response = await fetch(`${KV_API_BASE}/get?key=${FLUXO_CAIXA_KEY}`);

    if (!response.ok) {
      console.error('Erro ao carregar dados do Redis:', await response.text());
      return null;
    }

    const result = await response.json();
    
    if (!result.value) {
      console.log('Nenhum dado encontrado no Redis para Fluxo de Caixa');
      return null;
    }

    console.log('Dados do Fluxo de Caixa carregados do Redis');
    return result.value as FluxoCaixaData;
  } catch (error) {
    console.error('Erro ao carregar dados do Fluxo de Caixa:', error);
    return null;
  }
}

/**
 * Limpa os dados do Fluxo de Caixa do Redis
 */
export async function clearFluxoCaixaData(): Promise<boolean> {
  try {
    const response = await fetch(`${KV_API_BASE}/delete?key=${FLUXO_CAIXA_KEY}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      console.error('Erro ao limpar dados do Redis:', await response.text());
      return false;
    }

    console.log('Dados do Fluxo de Caixa removidos do Redis');
    return true;
  } catch (error) {
    console.error('Erro ao limpar dados do Fluxo de Caixa:', error);
    return false;
  }
}
