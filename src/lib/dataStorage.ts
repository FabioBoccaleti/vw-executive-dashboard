/**
 * Camada de persistência de dados - Redis Database (Produção) / localStorage (Desenvolvimento)
 * 
 * Este módulo gerencia o armazenamento de dados de métricas de negócio e DRE.
 * Em PRODUÇÃO: dados vêm exclusivamente do banco de dados Redis (Vercel KV)
 * Em DESENVOLVIMENTO: usa localStorage para testes locais
 * Suporta múltiplas marcas (VW, Audi, VW Outros, Audi Outros).
 */

import { businessMetricsData } from '../data/businessMetricsData';
import { businessMetricsData2024 } from '../data/businessMetricsData2024';
import { businessMetricsData2026 } from '../data/businessMetricsData2026';
import { businessMetricsData2027 } from '../data/businessMetricsData2027';

// Imports dos departamentos
import { businessMetricsDataNovos2024 } from '../data/businessMetricsDataNovos2024';
import { businessMetricsDataNovos2025 } from '../data/businessMetricsDataNovos2025';
import { businessMetricsDataNovos2026 } from '../data/businessMetricsDataNovos2026';
import { businessMetricsDataNovos2027 } from '../data/businessMetricsDataNovos2027';
import { businessMetricsDataVendaDireta2024 } from '../data/businessMetricsDataVendaDireta2024';
import { businessMetricsDataVendaDireta2025 } from '../data/businessMetricsDataVendaDireta2025';
import { businessMetricsDataVendaDireta2026 } from '../data/businessMetricsDataVendaDireta2026';
import { businessMetricsDataVendaDireta2027 } from '../data/businessMetricsDataVendaDireta2027';
import { businessMetricsDataUsados2024 } from '../data/businessMetricsDataUsados2024';
import { businessMetricsDataUsados2025 } from '../data/businessMetricsDataUsados2025';
import { businessMetricsDataUsados2026 } from '../data/businessMetricsDataUsados2026';
import { businessMetricsDataUsados2027 } from '../data/businessMetricsDataUsados2027';
import { businessMetricsDataPecas2024 } from '../data/businessMetricsDataPecas2024';
import { businessMetricsDataPecas2025 } from '../data/businessMetricsDataPecas2025';
import { businessMetricsDataPecas2026 } from '../data/businessMetricsDataPecas2026';
import { businessMetricsDataPecas2027 } from '../data/businessMetricsDataPecas2027';
import { businessMetricsDataOficina2024 } from '../data/businessMetricsDataOficina2024';
import { businessMetricsDataOficina2025 } from '../data/businessMetricsDataOficina2025';
import { businessMetricsDataOficina2026 } from '../data/businessMetricsDataOficina2026';
import { businessMetricsDataOficina2027 } from '../data/businessMetricsDataOficina2027';
import { businessMetricsDataFunilaria2024 } from '../data/businessMetricsDataFunilaria2024';
import { businessMetricsDataFunilaria2025 } from '../data/businessMetricsDataFunilaria2025';
import { businessMetricsDataFunilaria2026 } from '../data/businessMetricsDataFunilaria2026';
import { businessMetricsDataFunilaria2027 } from '../data/businessMetricsDataFunilaria2027';
import { businessMetricsDataAdministracao2024 } from '../data/businessMetricsDataAdministracao2024';
import { businessMetricsDataAdministracao2025 } from '../data/businessMetricsDataAdministracao2025';
import { businessMetricsDataAdministracao2026 } from '../data/businessMetricsDataAdministracao2026';
import { businessMetricsDataAdministracao2027 } from '../data/businessMetricsDataAdministracao2027';

import { type Brand, getSavedBrand } from './brands';
import { consolidateMetricsData } from './dataConsolidation';
import { kvGet, kvSet, kvBulkSet, kvBulkGet, kvKeys, kvDelete } from './kvClient';

// =====================================================
// CONFIGURAÇÃO DE AMBIENTE
// =====================================================

/**
 * Verifica se está em ambiente de produção (Vercel)
 */
function isProduction(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname.includes('vercel.app') || 
         (!hostname.includes('localhost') && !hostname.includes('127.0.0.1'));
}

/**
 * Cache local para dados do banco (evita múltiplas requisições)
 */
const dbCache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtém dados do cache ou do banco
 */
async function getFromDbWithCache<T>(key: string): Promise<T | null> {
  const cached = dbCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  
  const data = await kvGet<T>(key);
  if (data) {
    dbCache.set(key, { data, timestamp: Date.now() });
  }
  return data;
}

/**
 * Salva dados no banco e atualiza cache
 */
async function saveToDbWithCache(key: string, value: any): Promise<boolean> {
  const success = await kvSet(key, value);
  if (success) {
    dbCache.set(key, { data: value, timestamp: Date.now() });
  }
  return success;
}

/**
 * Limpa o cache do banco de dados
 */
export function clearDbCache(): void {
  dbCache.clear();
}

/**
 * Marcas já inicializadas - permite recarregar quando muda de marca
 */
const initializedBrands: Set<Brand> = new Set();

/**
 * Reinicializa o cache para uma marca específica
 * Força recarregamento do Redis mesmo se já foi inicializada antes
 */
export async function reinitializeForBrand(brand: Brand): Promise<boolean> {
  console.log(`🔄 [DB] Reinicializando cache para marca: ${brand}`);
  
  // Remove a marca das inicializadas para forçar recarga
  initializedBrands.delete(brand);
  
  // Limpa dados da marca do cache
  for (const key of dbCache.keys()) {
    if (key.startsWith(`${brand}_`)) {
      dbCache.delete(key);
    }
  }
  
  // Reinicializa
  return initializeFromDatabase(brand);
}

/**
 * Inicializa o cache carregando dados do banco de dados Redis
 * IMPORTANTE: Em produção, TODOS os dados vêm do Redis - NÃO usa localStorage
 */
export async function initializeFromDatabase(brand?: Brand): Promise<boolean> {
  // Em produção, SEMPRE inicializa do banco Redis
  // Em desenvolvimento, também usamos Redis quando disponível
  
  const currentBrand = brand || getSavedBrand();
  
  // Se a marca for 'consolidado', inicializa VW e Audi (pois consolidado é calculado a partir deles)
  if (currentBrand === 'consolidado') {
    console.log(`🔄 [DB] Marca Consolidado selecionada - inicializando VW e Audi...`);
    const vwInit = await initializeFromDatabase('vw');
    const audiInit = await initializeFromDatabase('audi');
    
    // Marca consolidado como inicializado se ambos VW e Audi foram inicializados
    if (vwInit && audiInit) {
      initializedBrands.add('consolidado');
      console.log(`✅ [DB] Consolidado inicializado com sucesso (VW + Audi)`);
    }
    return vwInit && audiInit;
  }
  
  // Verifica se já inicializou para esta marca específica
  if (initializedBrands.has(currentBrand)) {
    console.log(`✅ [DB] Banco de dados já inicializado para ${currentBrand}`);
    return true;
  }
  const years: (2024 | 2025 | 2026 | 2027)[] = [2024, 2025, 2026, 2027];
  const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao'];
  
  console.log(`🚀 [DB] Inicializando dados do Redis para ${currentBrand}...`);
  
  try {
    const promises: Promise<void>[] = [];
    
    for (const year of years) {
      // Carrega métricas por departamento
      for (const dept of departments) {
        const key = `${currentBrand}_metrics_${year}_${dept}`;
        promises.push(
          getFromDbWithCache(key).then(data => {
            if (data) {
              console.log(`✅ [DB] Carregado: ${key}`);
            }
          })
        );
        
        // Carrega DRE por departamento
        const dreKey = `${currentBrand}_dre_${year}_${dept}`;
        promises.push(
          getFromDbWithCache(dreKey).then(data => {
            if (data) {
              console.log(`✅ [DB] Carregado DRE: ${dreKey}`);
            }
          })
        );
      }
      
      // Carrega métricas compartilhadas
      const sharedKey = `${currentBrand}_metrics_shared_${year}`;
      promises.push(
        getFromDbWithCache(sharedKey).then(data => {
          if (data) {
            console.log(`✅ [DB] Carregado compartilhado: ${sharedKey}`);
          }
        })
      );
      
      // Carrega projeções por departamento
      for (const dept of departments) {
        const projectionKey = `${currentBrand}_projection_${year}_${dept}`;
        promises.push(
          getFromDbWithCache(projectionKey).then(data => {
            if (data) {
              console.log(`✅ [DB] Carregado projeção: ${projectionKey}`);
            }
          })
        );
      }
    }
    
    await Promise.all(promises);
    
    initializedBrands.add(currentBrand);
    console.log(`🎉 [DB] Inicialização concluída para ${currentBrand}! ${dbCache.size} itens no cache.`);
    return true;
  } catch (error) {
    console.error(`❌ [DB] Erro na inicialização do banco para ${currentBrand}:`, error);
    return false;
  }
}

/**
 * Verifica se o banco foi inicializado para uma marca específica
 */
export function isDatabaseInitialized(brand?: Brand): boolean {
  const currentBrand = brand || getSavedBrand();
  return initializedBrands.has(currentBrand);
}

/**
 * Exporta a função isProduction para uso externo
 */
export { isProduction };

// Tipo para departamento
export type Department = 'novos' | 'vendaDireta' | 'usados' | 'pecas' | 'oficina' | 'funilaria' | 'administracao' | 'consolidado';

// Tipos para os dados de métricas
export interface MetricsData {
  months: string[];
  vendasNovos: {
    vendas: number[];
    volumeTrocas: number[];
    percentualTrocas: number[];
  };
  vendasNovosVD: {
    vendas: number[];
    volumeTrocas: number[];
    percentualTrocas: number[];
  };
  vendasUsados: {
    vendas: number[];
    volumeTrocas: number[];
    percentualTrocas: number[];
  };
  volumeVendas: {
    usados: number[];
    repasse: number[];
    percentualRepasse: number[];
  };
  estoqueNovos: {
    quantidade: number[];
    valor: number[];
    aPagar: number[];
    pagos: number[];
  };
  estoqueUsados: {
    quantidade: number[];
    valor: number[];
    aPagar: number[];
    pagos: number[];
  };
  estoquePecas: {
    quantidade?: number[];
    valor: number[];
    aPagar: number[];
    pagos: number[];
  };
  vendasPecas?: {
    balcao?: {
      vendas: number[];
      lucro: number[];
      margem: number[];
    };
    oficina?: {
      vendas: number[];
      lucro: number[];
      margem: number[];
    };
    funilaria?: {
      vendas: number[];
      lucro: number[];
      margem: number[];
    };
    acessorios?: {
      vendas: number[];
      lucro: number[];
      margem: number[];
    };
    seguradoraTotal?: {
      vendas: number[];
      lucro: number[];
      margem: number[];
    };
  };
  seguradoras?: {
    portoSeguro?: {
      vendas: number[];
      lucro: number[];
      margem: number[];
    };
    azul?: {
      vendas: number[];
      lucro: number[];
      margem: number[];
    };
    allianz?: {
      vendas: number[];
      lucro: number[];
      margem: number[];
    };
    tokioMarine?: {
      vendas: number[];
      lucro: number[];
      margem: number[];
    };
  };
  mercadoLivre?: {
    vendas: number[];
    lucro: number[];
    margem: number[];
  };
  juros?: {
    veiculosNovos: number[];
    veiculosUsados: number[];
    pecas: number[];
    emprestimosBancarios: number[];
    contratoMutuo: number[];
  };
  custos?: {
    garantia: number[];
    reparoUsados: number[];
    ticketMedioReparo: number[];
  };
  despesasCartao?: {
    novos: number[];
    vendaDireta: number[];
    usados: number[];
    pecas: number[];
    oficina: number[];
    funilaria: number[];
    administracao: number[];
  };
  bonus?: {
    veiculosNovos: number[];
    veiculosUsados: number[];
    pecas: number[];
    oficina: number[];
    funilaria: number[];
    administracao: number[];
  };
  receitasFinanciamento?: {
    veiculosNovos: number[];
    veiculosUsados: number[];
  };
  creditosICMS?: {
    novos: number[];
    pecas: number[];
    administracao: number[];
  };
  creditosPISCOFINS?: {
    administracao: number[];
  };
  receitaBlindagem?: number[];
  receitaDespachanteUsados?: number[];
  receitaDespachanteNovos?: number[];
  margensOperacionais?: {
    novos: number[];
    usados: number[];
    oficina: number[];
    pecas: number[];
  };
  receitaVendas?: {
    novos: number[];
    usados: number[];
  };
  resultadoFinanceiro?: {
    receitas: number[];
    despesas: number[];
    resultado: number[];
  };
  despesasPessoal?: {
    custo: number[];
    hc: number[];
  };
  receitasOficina?: {
    garantia: number[];
    clientePago: number[];
    interno: number[];
  };
  receitasPecas?: {
    balcao: number[];
    oficina: number[];
    externo: number[];
  };
  fluxoCaixa?: {
    recebimentos: number[];
    pagamentos: number[];
    saldo: number[];
  };
  capital?: {
    capitalProprio: number[];
    capitalTerceiros: number[];
    capitalTotal?: number[];
  };
}

// Interface para Fatos Relevantes no Resultado
export interface FatoRelevante {
  id: string;
  mes: string;
  descricao: string;
  impacto: 'Positivo' | 'Negativo' | 'Nulo';
  valor: number;
}

export type FatosRelevantesData = FatoRelevante[];

// Tipos para os dados de DRE
export interface DRELine {
  id: string;
  label: string;
  values: number[];
  meses?: number[];
  isTotal?: boolean;
  isSubtotal?: boolean;
  indent?: number;
}

export type DREData = DRELine[];

// Re-export Brand type
export type { Brand } from './brands';

// Chaves de armazenamento (mantidas por retrocompatibilidade, usaremos funções com marca)
const STORAGE_KEYS = {
  METRICS_2024: 'vw_metrics_2024',
  METRICS_2025: 'vw_metrics_2025',
  METRICS_2026: 'vw_metrics_2026',
  METRICS_2027: 'vw_metrics_2027',
  DRE_2024: 'vw_dre_2024',
  DRE_2025: 'vw_dre_2025',
  DRE_2026: 'vw_dre_2026',
  DRE_2027: 'vw_dre_2027',
  SELECTED_YEAR: 'vw_selected_fiscal_year',
  SELECTED_DEPARTMENT: 'vw_selected_department'
} as const;

/**
 * Gera a chave de armazenamento com a marca
 * Formato: {brand}_metrics_{year}_{department} ou {brand}_metrics_shared_{year}
 */
function getStorageKeyWithBrand(brand: Brand, baseKey: string): string {
  return `${brand}_${baseKey}`;
}

/**
 * Obtém a marca atual (do parâmetro ou do localStorage)
 */
function getCurrentBrand(brand?: Brand): Brand {
  return brand || getSavedBrand();
}

/**
 * Verifica se a marca é VW (para usar dados padrão existentes)
 */
function isVWBrand(brand: Brand): boolean {
  return brand === 'vw';
}

/**
 * Função auxiliar para obter dados padrão por departamento e ano
 * Apenas VW tem dados padrão pré-carregados, outras marcas começam zeradas
 */
function getDefaultDataForDepartment(department: Department, fiscalYear: 2024 | 2025 | 2026 | 2027, brand?: Brand): MetricsData {
  const currentBrand = getCurrentBrand(brand);
  
  // Apenas VW tem dados padrão pré-carregados
  // Outras marcas começam com dados zerados
  if (!isVWBrand(currentBrand)) {
    return createEmptyMetricsData(fiscalYear);
  }
  
  const key = `${department}_${fiscalYear}`;
  
  // Para Usados (dados existentes)
  if (department === 'usados') {
    switch (fiscalYear) {
      case 2024: return businessMetricsDataUsados2024;
      case 2025: return businessMetricsDataUsados2025;
      case 2026: return businessMetricsDataUsados2026;
      case 2027: return businessMetricsDataUsados2027;
    }
  }
  
  // Para Novos
  if (department === 'novos') {
    switch (fiscalYear) {
      case 2024: return businessMetricsDataNovos2024;
      case 2025: return businessMetricsDataNovos2025;
      case 2026: return businessMetricsDataNovos2026;
      case 2027: return businessMetricsDataNovos2027;
    }
  }
  
  // Para Venda Direta
  if (department === 'vendaDireta') {
    switch (fiscalYear) {
      case 2024: return businessMetricsDataVendaDireta2024;
      case 2025: return businessMetricsDataVendaDireta2025;
      case 2026: return businessMetricsDataVendaDireta2026;
      case 2027: return businessMetricsDataVendaDireta2027;
    }
  }
  
  // Para Peças
  if (department === 'pecas') {
    switch (fiscalYear) {
      case 2024: return businessMetricsDataPecas2024;
      case 2025: return businessMetricsDataPecas2025;
      case 2026: return businessMetricsDataPecas2026;
      case 2027: return businessMetricsDataPecas2027;
    }
  }
  
  // Para Oficina
  if (department === 'oficina') {
    switch (fiscalYear) {
      case 2024: return businessMetricsDataOficina2024;
      case 2025: return businessMetricsDataOficina2025;
      case 2026: return businessMetricsDataOficina2026;
      case 2027: return businessMetricsDataOficina2027;
    }
  }
  
  // Para Funilaria
  if (department === 'funilaria') {
    switch (fiscalYear) {
      case 2024: return businessMetricsDataFunilaria2024;
      case 2025: return businessMetricsDataFunilaria2025;
      case 2026: return businessMetricsDataFunilaria2026;
      case 2027: return businessMetricsDataFunilaria2027;
    }
  }
  
  // Para Administração
  if (department === 'administracao') {
    switch (fiscalYear) {
      case 2024: return businessMetricsDataAdministracao2024;
      case 2025: return businessMetricsDataAdministracao2025;
      case 2026: return businessMetricsDataAdministracao2026;
      case 2027: return businessMetricsDataAdministracao2027;
    }
  }
  
  // Para Consolidado (será calculado dinamicamente)
  if (department === 'consolidado') {
    return calculateConsolidatedData(fiscalYear);
  }
  
  // Fallback
  return businessMetricsDataNovos2024;
}

/**
 * Cria dados de métricas zerados para marcas que não são VW
 * Mantém a estrutura completa mas com todos os valores zerados
 */
function createEmptyMetricsData(fiscalYear: 2024 | 2025 | 2026 | 2027): MetricsData {
  const emptyArray = (): number[] => Array(12).fill(0);
  const yearSuffix = fiscalYear.toString().slice(-2);
  
  return {
    months: [`Jan/${yearSuffix}`, `Fev/${yearSuffix}`, `Mar/${yearSuffix}`, `Abr/${yearSuffix}`, `Mai/${yearSuffix}`, `Jun/${yearSuffix}`, `Jul/${yearSuffix}`, `Ago/${yearSuffix}`, `Set/${yearSuffix}`, `Out/${yearSuffix}`, `Nov/${yearSuffix}`, `Dez/${yearSuffix}`],
    vendasNovos: { vendas: emptyArray(), volumeTrocas: emptyArray(), percentualTrocas: emptyArray() },
    vendasNovosVD: { vendas: emptyArray(), volumeTrocas: emptyArray(), percentualTrocas: emptyArray() },
    vendasUsados: { vendas: emptyArray(), volumeTrocas: emptyArray(), percentualTrocas: emptyArray() },
    volumeVendas: { usados: emptyArray(), repasse: emptyArray(), percentualRepasse: emptyArray() },
    estoqueNovos: { quantidade: emptyArray(), valor: emptyArray(), aPagar: emptyArray(), pagos: emptyArray() },
    estoqueUsados: { quantidade: emptyArray(), valor: emptyArray(), aPagar: emptyArray(), pagos: emptyArray() },
    estoquePecas: { quantidade: emptyArray(), valor: emptyArray(), aPagar: emptyArray(), pagos: emptyArray() },
    vendasPecas: {
      balcao: { vendas: emptyArray(), lucro: emptyArray(), margem: emptyArray() },
      oficina: { vendas: emptyArray(), lucro: emptyArray(), margem: emptyArray() },
      funilaria: { vendas: emptyArray(), lucro: emptyArray(), margem: emptyArray() },
      acessorios: { vendas: emptyArray(), lucro: emptyArray(), margem: emptyArray() },
      seguradoraTotal: { vendas: emptyArray(), lucro: emptyArray(), margem: emptyArray() }
    },
    seguradoras: {
      portoSeguro: { vendas: emptyArray(), lucro: emptyArray(), margem: emptyArray() },
      azul: { vendas: emptyArray(), lucro: emptyArray(), margem: emptyArray() },
      allianz: { vendas: emptyArray(), lucro: emptyArray(), margem: emptyArray() },
      tokioMarine: { vendas: emptyArray(), lucro: emptyArray(), margem: emptyArray() }
    },
    mercadoLivre: { vendas: emptyArray(), lucro: emptyArray(), margem: emptyArray() },
    juros: { veiculosNovos: emptyArray(), veiculosUsados: emptyArray(), pecas: emptyArray(), emprestimosBancarios: emptyArray(), contratoMutuo: emptyArray() },
    custos: { garantia: emptyArray(), reparoUsados: emptyArray(), ticketMedioReparo: emptyArray() },
    despesasCartao: { novos: emptyArray(), vendaDireta: emptyArray(), usados: emptyArray(), pecas: emptyArray(), oficina: emptyArray(), funilaria: emptyArray(), administracao: emptyArray() },
    bonus: { veiculosNovos: emptyArray(), veiculosUsados: emptyArray(), pecas: emptyArray(), oficina: emptyArray(), funilaria: emptyArray(), administracao: emptyArray() },
    receitasFinanciamento: { veiculosNovos: emptyArray(), veiculosUsados: emptyArray() },
    creditosICMS: { novos: emptyArray(), pecas: emptyArray(), administracao: emptyArray() },
    creditosPISCOFINS: { administracao: emptyArray() },
    receitaBlindagem: emptyArray(),
    receitaDespachanteUsados: emptyArray(),
    receitaDespachanteNovos: emptyArray(),
    margensOperacionais: { novos: emptyArray(), usados: emptyArray(), oficina: emptyArray(), pecas: emptyArray() },
    receitaVendas: { novos: emptyArray(), usados: emptyArray() },
    resultadoFinanceiro: { receitas: emptyArray(), despesas: emptyArray(), resultado: emptyArray() },
    despesasPessoal: { custo: emptyArray(), hc: emptyArray() },
    receitasOficina: { garantia: emptyArray(), clientePago: emptyArray(), interno: emptyArray() },
    receitasPecas: { balcao: emptyArray(), oficina: emptyArray(), externo: emptyArray() },
    fluxoCaixa: { recebimentos: emptyArray(), pagamentos: emptyArray(), saldo: emptyArray() },
    capital: { capitalProprio: emptyArray(), capitalTerceiros: emptyArray(), capitalTotal: emptyArray() }
  };
}

/**
 * Calcula os dados consolidados somando todos os departamentos
 */
function calculateConsolidatedData(fiscalYear: 2024 | 2025 | 2026 | 2027, brand?: Brand): MetricsData {
  const currentBrand = getCurrentBrand(brand);
  const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao'];
  
  // Carrega dados de cada departamento, evitando recursão infinita
  const allData = departments.map(dept => {
    // Usa chave com marca
    const key = `${currentBrand}_metrics_${fiscalYear}_${dept}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.warn(`Erro ao parsear dados de ${key}, usando dados padrão`);
      }
    }
    
    // Retorna dados padrão do departamento
    return getDefaultDataForDepartment(dept, fiscalYear, currentBrand);
  });
  
  // Filtra dados válidos
  const validData = allData.filter(d => d && typeof d === 'object');
  
  if (validData.length === 0) {
    // Retorna estrutura vazia se não houver dados válidos
    return businessMetricsDataNovos2024; // Usa estrutura base
  }
  
  // Função auxiliar para somar arrays
  const sumArrays = (arrays: number[][]): number[] => {
    if (arrays.length === 0) return [];
    
    // Filtra arrays válidos
    const validArrays = arrays.filter(arr => Array.isArray(arr) && arr.length > 0);
    if (validArrays.length === 0) return [];
    
    const length = validArrays[0].length;
    return Array.from({ length }, (_, i) => 
      validArrays.reduce((sum, arr) => sum + (arr[i] || 0), 0)
    );
  };
  
  // Helper para extrair valores com segurança
  const safeMap = <T>(mapper: (d: MetricsData) => T): T[] => {
    return validData.map(d => {
      try {
        return mapper(d);
      } catch (e) {
        return [] as T;
      }
    });
  };
  
  // Consolida todos os dados
  const consolidated: MetricsData = {
    months: validData[0].months,
    
    vendasNovos: {
      vendas: sumArrays(safeMap(d => d.vendasNovos?.vendas || [])),
      volumeTrocas: sumArrays(safeMap(d => d.vendasNovos?.volumeTrocas || [])),
      percentualTrocas: sumArrays(safeMap(d => d.vendasNovos?.percentualTrocas || []))
    },
    
    vendasNovosVD: {
      vendas: sumArrays(safeMap(d => d.vendasNovosVD?.vendas || [])),
      volumeTrocas: sumArrays(safeMap(d => d.vendasNovosVD?.volumeTrocas || [])),
      percentualTrocas: sumArrays(safeMap(d => d.vendasNovosVD?.percentualTrocas || []))
    },
    
    vendasUsados: {
      vendas: sumArrays(safeMap(d => d.vendasUsados?.vendas || [])),
      volumeTrocas: sumArrays(safeMap(d => d.vendasUsados?.volumeTrocas || [])),
      percentualTrocas: sumArrays(safeMap(d => d.vendasUsados?.percentualTrocas || []))
    },
    
    volumeVendas: {
      usados: sumArrays(safeMap(d => d.volumeVendas?.usados || [])),
      repasse: sumArrays(safeMap(d => d.volumeVendas?.repasse || [])),
      percentualRepasse: sumArrays(safeMap(d => d.volumeVendas?.percentualRepasse || []))
    },
    
    estoqueNovos: {
      quantidade: sumArrays(safeMap(d => d.estoqueNovos?.quantidade || [])),
      valor: sumArrays(safeMap(d => d.estoqueNovos?.valor || [])),
      aPagar: sumArrays(safeMap(d => d.estoqueNovos?.aPagar || [])),
      pagos: sumArrays(safeMap(d => d.estoqueNovos?.pagos || []))
    },
    
    estoqueUsados: {
      quantidade: sumArrays(safeMap(d => d.estoqueUsados?.quantidade || [])),
      valor: sumArrays(safeMap(d => d.estoqueUsados?.valor || [])),
      aPagar: sumArrays(safeMap(d => d.estoqueUsados?.aPagar || [])),
      pagos: sumArrays(safeMap(d => d.estoqueUsados?.pagos || []))
    },
    
    estoquePecas: {
      quantidade: sumArrays(safeMap(d => d.estoquePecas?.quantidade || [])),
      valor: sumArrays(safeMap(d => d.estoquePecas?.valor || [])),
      aPagar: sumArrays(safeMap(d => d.estoquePecas?.aPagar || [])),
      pagos: sumArrays(safeMap(d => d.estoquePecas?.pagos || []))
    },
    
    margensOperacionais: {
      novos: sumArrays(safeMap(d => d.margensOperacionais?.novos || [])),
      usados: sumArrays(safeMap(d => d.margensOperacionais?.usados || [])),
      oficina: sumArrays(safeMap(d => d.margensOperacionais?.oficina || [])),
      pecas: sumArrays(safeMap(d => d.margensOperacionais?.pecas || []))
    },
    
    receitaVendas: {
      novos: sumArrays(safeMap(d => d.receitaVendas?.novos || [])),
      usados: sumArrays(safeMap(d => d.receitaVendas?.usados || []))
    },
    
    resultadoFinanceiro: {
      receitas: sumArrays(safeMap(d => d.resultadoFinanceiro?.receitas || [])),
      despesas: sumArrays(safeMap(d => d.resultadoFinanceiro?.despesas || [])),
      resultado: sumArrays(safeMap(d => d.resultadoFinanceiro?.resultado || []))
    },
    
    despesasPessoal: {
      custo: sumArrays(safeMap(d => d.despesasPessoal?.custo || [])),
      hc: sumArrays(safeMap(d => d.despesasPessoal?.hc || []))
    },
    
    receitasOficina: {
      garantia: sumArrays(safeMap(d => d.receitasOficina?.garantia || [])),
      clientePago: sumArrays(safeMap(d => d.receitasOficina?.clientePago || [])),
      interno: sumArrays(safeMap(d => d.receitasOficina?.interno || []))
    },
    
    receitasPecas: {
      balcao: sumArrays(safeMap(d => d.receitasPecas?.balcao || [])),
      oficina: sumArrays(safeMap(d => d.receitasPecas?.oficina || [])),
      externo: sumArrays(safeMap(d => d.receitasPecas?.externo || []))
    },
    
    fluxoCaixa: {
      recebimentos: sumArrays(safeMap(d => d.fluxoCaixa?.recebimentos || [])),
      pagamentos: sumArrays(safeMap(d => d.fluxoCaixa?.pagamentos || [])),
      saldo: sumArrays(safeMap(d => d.fluxoCaixa?.saldo || []))
    },
    
    capital: {
      capitalProprio: sumArrays(safeMap(d => d.capital?.capitalProprio || [])),
      capitalTerceiros: sumArrays(safeMap(d => d.capital?.capitalTerceiros || [])),
      capitalTotal: sumArrays(safeMap(d => d.capital?.capitalTotal || []))
    },
    
    // Dados Adicionais consolidados
    bonus: {
      veiculosNovos: sumArrays(safeMap(d => d.bonus?.veiculosNovos || [])),
      veiculosUsados: sumArrays(safeMap(d => d.bonus?.veiculosUsados || [])),
      pecas: sumArrays(safeMap(d => d.bonus?.pecas || [])),
      oficina: sumArrays(safeMap(d => d.bonus?.oficina || [])),
      funilaria: sumArrays(safeMap(d => d.bonus?.funilaria || [])),
      administracao: sumArrays(safeMap(d => d.bonus?.administracao || []))
    },
    
    receitasFinanciamento: {
      veiculosNovos: sumArrays(safeMap(d => d.receitasFinanciamento?.veiculosNovos || [])),
      veiculosUsados: sumArrays(safeMap(d => d.receitasFinanciamento?.veiculosUsados || []))
    },
    
    creditosICMS: {
      novos: sumArrays(safeMap(d => d.creditosICMS?.novos || [])),
      pecas: sumArrays(safeMap(d => d.creditosICMS?.pecas || [])),
      administracao: sumArrays(safeMap(d => d.creditosICMS?.administracao || []))
    },
    
    creditosPISCOFINS: {
      administracao: sumArrays(safeMap(d => d.creditosPISCOFINS?.administracao || []))
    },
    
    receitaBlindagem: sumArrays(safeMap(d => d.receitaBlindagem || [])),
    receitaDespachanteUsados: sumArrays(safeMap(d => d.receitaDespachanteUsados || [])),
    receitaDespachanteNovos: sumArrays(safeMap(d => d.receitaDespachanteNovos || []))
  };
  
  return consolidated;
}

/**
 * Carrega os dados de métricas de um ano fiscal específico e departamento
 * IMPORTANTE: Dados vêm EXCLUSIVAMENTE do banco de dados Redis (cache)
 * NÃO usa localStorage para dados de negócio
 * @param fiscalYear - Ano fiscal (2024-2027)
 * @param department - Departamento
 * @param brand - Marca (opcional, usa a marca salva se não fornecida)
 */
export function loadMetricsData(fiscalYear: 2024 | 2025 | 2026 | 2027, department: Department = 'usados', brand?: Brand): MetricsData {
  const currentBrand = getCurrentBrand(brand);
  
  try {
    // Se a marca for 'consolidado', soma dados de VW + Audi
    if (currentBrand === 'consolidado') {
      const vwData = loadMetricsData(fiscalYear, department, 'vw');
      const audiData = loadMetricsData(fiscalYear, department, 'audi');
      return consolidateMetricsData(vwData, audiData);
    }
    
    // Se for consolidado de departamentos, calcula dinamicamente
    if (department === 'consolidado') {
      return calculateConsolidatedData(fiscalYear, currentBrand);
    }
    
    const key = `${currentBrand}_metrics_${fiscalYear}_${department}`;
    
    // Verifica cache do banco de dados (Redis)
    const cached = dbCache.get(key);
    if (cached) {
      console.log(`✅ [DB] Dados do cache: ${key}`);
      return cached.data;
    }
    
    // Se não houver dados no cache, retorna dados padrão
    // NÃO usa localStorage - dados devem vir do Redis
    console.log(`⚠️ [DB] Cache vazio para: ${key} - usando dados padrão`);
    return getDefaultDataForDepartment(department, fiscalYear, currentBrand);
  } catch (error) {
    console.error(`Erro ao carregar dados de métricas de ${fiscalYear} - ${department} - ${currentBrand}:`, error);
    return getDefaultDataForDepartment(department, fiscalYear, currentBrand);
  }
}

/**
 * Carrega os dados de métricas compartilhadas (Dados Adicionais) que são iguais para todos os departamentos
 * IMPORTANTE: Dados vêm EXCLUSIVAMENTE do banco de dados Redis (cache)
 * NÃO usa localStorage para dados de negócio
 * @param fiscalYear - Ano fiscal (2024-2027)
 * @param brand - Marca (opcional, usa a marca salva se não fornecida)
 */
export function loadSharedMetricsData(fiscalYear: 2024 | 2025 | 2026 | 2027, brand?: Brand): MetricsData {
  const currentBrand = getCurrentBrand(brand);
  
  try {
    // Se a marca for 'consolidado', soma dados de VW + Audi
    if (currentBrand === 'consolidado') {
      const vwData = loadSharedMetricsData(fiscalYear, 'vw');
      const audiData = loadSharedMetricsData(fiscalYear, 'audi');
      return consolidateMetricsData(vwData, audiData);
    }
    
    const key = `${currentBrand}_metrics_shared_${fiscalYear}`;
    
    // Verifica cache do banco de dados (Redis)
    const cached = dbCache.get(key);
    if (cached) {
      console.log(`✅ [DB] Dados compartilhados do cache: ${key}`);
      return cached.data;
    }
    
    // Se não houver dados no cache, retorna dados padrão
    // NÃO usa localStorage - dados devem vir do Redis
    console.log(`⚠️ [DB] Cache vazio para compartilhados: ${key}`);
    return getDefaultDataForDepartment('usados', fiscalYear, currentBrand);
  } catch (error) {
    console.error(`Erro ao carregar dados de métricas compartilhadas de ${fiscalYear} - ${currentBrand}:`, error);
    return getDefaultDataForDepartment('usados', fiscalYear, currentBrand);
  }
}

/**
 * Salva os dados de métricas de um ano fiscal específico e departamento
 * IMPORTANTE: Salva EXCLUSIVAMENTE no banco de dados Redis
 * NÃO salva no localStorage para dados de negócio
 * @param fiscalYear - Ano fiscal (2024-2027)
 * @param data - Dados de métricas
 * @param department - Departamento
 * @param brand - Marca (opcional, usa a marca salva se não fornecida)
 */
export function saveMetricsData(fiscalYear: 2024 | 2025 | 2026 | 2027, data: MetricsData, department: Department = 'usados', brand?: Brand): boolean {
  const currentBrand = getCurrentBrand(brand);
  
  try {
    // Não permite salvar dados do consolidado (é calculado dinamicamente)
    if (department === 'consolidado') {
      console.warn('Não é possível salvar dados do consolidado diretamente');
      return false;
    }
    
    // Não permite salvar dados quando a MARCA é 'consolidado' (dados são calculados de VW + Audi)
    if (currentBrand === 'consolidado') {
      console.warn('⚠️ Marca Consolidado: dados são calculados dinamicamente de VW + Audi. Não é possível salvar.');
      return false;
    }
    
    const key = `${currentBrand}_metrics_${fiscalYear}_${department}`;
    
    // Salva EXCLUSIVAMENTE no banco de dados Redis
    console.log(`💾 [DB] Salvando métricas no Redis: ${key}`);
    saveToDbWithCache(key, data).then(success => {
      if (success) {
        console.log(`✅ [DB] Métricas salvas no Redis: ${key}`);
      } else {
        console.error(`❌ [DB] Erro ao salvar métricas no Redis: ${key}`);
      }
    });
    
    // NÃO salva no localStorage - dados devem ir apenas para o Redis
    return true;
  } catch (error) {
    console.error(`Erro ao salvar dados de métricas de ${fiscalYear} - ${department} - ${currentBrand}:`, error);
    return false;
  }
}

/**
 * Salva os dados de métricas compartilhadas (Dados Adicionais) que são iguais para todos os departamentos
 * IMPORTANTE: Salva EXCLUSIVAMENTE no banco de dados Redis
 * NÃO salva no localStorage para dados de negócio
 * @param fiscalYear - Ano fiscal (2024-2027)
 * @param data - Dados de métricas
 * @param brand - Marca (opcional, usa a marca salva se não fornecida)
 */
export function saveSharedMetricsData(fiscalYear: 2024 | 2025 | 2026 | 2027, data: MetricsData, brand?: Brand): boolean {
  const currentBrand = getCurrentBrand(brand);
  
  try {
    // Não permite salvar dados quando a MARCA é 'consolidado' (dados são calculados de VW + Audi)
    if (currentBrand === 'consolidado') {
      console.warn('⚠️ Marca Consolidado: dados compartilhados são calculados dinamicamente de VW + Audi. Não é possível salvar.');
      return false;
    }
    
    const key = `${currentBrand}_metrics_shared_${fiscalYear}`;
    
    // Salva EXCLUSIVAMENTE no banco de dados Redis
    console.log(`💾 [DB] Salvando compartilhados no Redis: ${key}`);
    saveToDbWithCache(key, data).then(success => {
      if (success) {
        console.log(`✅ [DB] Compartilhados salvos no Redis: ${key}`);
      } else {
        console.error(`❌ [DB] Erro ao salvar compartilhados no Redis: ${key}`);
      }
    });
    
    // NÃO salva no localStorage - dados devem ir apenas para o Redis
    return true;
  } catch (error) {
    console.error(`Erro ao salvar dados de métricas compartilhadas de ${fiscalYear} - ${currentBrand}:`, error);
    return false;
  }
}

/**
 * Carrega os dados de DRE de um ano fiscal específico e departamento
 * IMPORTANTE: Dados vêm EXCLUSIVAMENTE do banco de dados Redis (cache)
 * NÃO usa localStorage para dados de negócio
 * @param fiscalYear - Ano fiscal (2024-2027)
 * @param department - Departamento
 * @param brand - Marca (opcional, usa a marca salva se não fornecida)
 */
export function loadDREData(fiscalYear: 2024 | 2025 | 2026 | 2027, department: Department = 'usados', brand?: Brand): DREData | null {
  const currentBrand = getCurrentBrand(brand);
  
  try {
    // Se a marca for 'consolidado', soma dados de VW + Audi
    if (currentBrand === 'consolidado') {
      const vwDRE = loadDREData(fiscalYear, department, 'vw');
      const audiDRE = loadDREData(fiscalYear, department, 'audi');
      
      // Se ambos os DREs existirem, consolida
      if (vwDRE && audiDRE) {
        return vwDRE.map((line, index) => {
          const audiLine = audiDRE[index];
          const meses = line.meses || [];
          const summedMeses = meses.map((vwValue, monthIndex) => {
            const audiValue = audiLine?.meses?.[monthIndex] || 0;
            return vwValue + audiValue;
          });
          
          // Soma também o total
          const vwTotal = line.total || 0;
          const audiTotal = audiLine?.total || 0;
          const summedTotal = vwTotal + audiTotal;
          
          return {
            ...line,
            total: summedTotal,
            meses: summedMeses
          };
        });
      }
      
      // Se apenas VW existir, soma com Audi vazio (zeros)
      if (vwDRE && !audiDRE) {
        console.warn('⚠️ DRE Audi não encontrado, consolidando apenas VW');
        return vwDRE;
      }
      
      // Se apenas Audi existir, soma com VW vazio (zeros)
      if (!vwDRE && audiDRE) {
        console.warn('⚠️ DRE VW não encontrado, consolidando apenas Audi');
        return audiDRE;
      }
      
      // Se nenhum existir, retorna null
      return null;
    }
    
    const key = `${currentBrand}_dre_${fiscalYear}_${department}`;
    
    // Verifica cache do banco de dados (Redis)
    const cached = dbCache.get(key);
    if (cached) {
      console.log(`✅ [DB] DRE do cache: ${key}`);
      return cached.data;
    }
    
    // Se não houver dados no cache e for consolidado, calcula dinamicamente
    if (department === 'consolidado') {
      console.log(`📊 [DB] Calculando DRE consolidada dinamicamente`);
      return calculateConsolidatedDRE(fiscalYear, currentBrand);
    }
    
    // NÃO usa localStorage - dados devem vir do Redis
    console.log(`⚠️ [DB] Cache vazio para DRE: ${key} - retornando null`);
    return null;
  } catch (error) {
    console.error(`❌ Erro ao carregar dados de DRE de ${fiscalYear} - ${department}:`, error);
    return null;
  }
}

/**
 * Calcula DRE consolidada somando todos os departamentos
 */
function calculateConsolidatedDRE(fiscalYear: 2024 | 2025 | 2026 | 2027, brand?: Brand): DREData | null {
  const currentBrand = getCurrentBrand(brand);
  const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao'];
  const allDREs = departments.map(dept => loadDREData(fiscalYear, dept, currentBrand)).filter(dre => dre !== null) as DREData[];
  
  if (allDREs.length === 0) return null;
  
  // Pega a estrutura da primeira DRE
  const firstDRE = allDREs[0];
  
  // Soma os valores de cada linha
  const consolidated: DREData = firstDRE.map((line, index) => {
    const meses = line.meses || [];
    const summedMeses = meses.map((_, monthIndex) => {
      return allDREs.reduce((sum, dre) => {
        const dreValue = dre[index]?.meses?.[monthIndex] || 0;
        return sum + dreValue;
      }, 0);
    });
    
    return {
      ...line,
      meses: summedMeses
    };
  });
  
  return consolidated;
}

/**
 * Salva os dados de DRE de um ano fiscal específico e departamento
 * IMPORTANTE: Salva EXCLUSIVAMENTE no banco de dados Redis
 * NÃO salva no localStorage para dados de negócio
 * @param fiscalYear - Ano fiscal (2024-2027)
 * @param data - Dados de DRE
 * @param department - Departamento
 * @param forceConsolidated - Permite salvar consolidado (para dados importados)
 * @param brand - Marca (opcional, usa a marca salva se não fornecida)
 */
export function saveDREData(fiscalYear: 2024 | 2025 | 2026 | 2027, data: DREData, department: Department = 'usados', forceConsolidated: boolean = false, brand?: Brand): boolean {
  const currentBrand = getCurrentBrand(brand);
  
  try {
    // Permite salvar dados do consolidado apenas se forceConsolidated for true (dados importados)
    if (department === 'consolidado' && !forceConsolidated) {
      console.warn('Não é possível salvar dados do consolidado diretamente (use forceConsolidated=true para dados importados)');
      return false;
    }
    
    // Não permite salvar dados quando a MARCA é 'consolidado' (dados são calculados de VW + Audi)
    if (currentBrand === 'consolidado') {
      console.warn('⚠️ Marca Consolidado: dados DRE são calculados dinamicamente de VW + Audi. Não é possível salvar.');
      return false;
    }
    
    const key = `${currentBrand}_dre_${fiscalYear}_${department}`;
    
    // Salva EXCLUSIVAMENTE no banco de dados Redis
    console.log(`💾 [DB] Salvando DRE no Redis: ${key}`);
    saveToDbWithCache(key, data).then(success => {
      if (success) {
        console.log(`✅ [DB] DRE salvo no Redis: ${key}`);
      } else {
        console.error(`❌ [DB] Erro ao salvar DRE no Redis: ${key}`);
      }
    });
    
    // NÃO salva no localStorage - dados devem ir apenas para o Redis
    return true;
  } catch (error) {
    console.error(`Erro ao salvar dados de DRE de ${fiscalYear} - ${department} - ${currentBrand}:`, error);
    return false;
  }
}

/**
 * Carrega o ano fiscal selecionado
 * NOTA: Este é um dado de preferência LOCAL do usuário - pode usar localStorage
 */
export function loadSelectedFiscalYear(): 2024 | 2025 | 2026 | 2027 {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_YEAR);
    if (stored) {
      const year = parseInt(stored, 10);
      if (year === 2024 || year === 2025 || year === 2026 || year === 2027) {
        return year as 2024 | 2025 | 2026 | 2027;
      }
    }
    return 2025; // Padrão: 2025
  } catch (error) {
    console.error('Erro ao carregar ano fiscal selecionado:', error);
    return 2025;
  }
}

/**
 * Salva o ano fiscal selecionado
 */
export function saveSelectedFiscalYear(fiscalYear: 2024 | 2025 | 2026 | 2027): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.SELECTED_YEAR, fiscalYear.toString());
    return true;
  } catch (error) {
    console.error('Erro ao salvar ano fiscal selecionado:', error);
    return false;
  }
}

/**
 * Carrega o departamento selecionado
 */
export function loadSelectedDepartment(): Department {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_DEPARTMENT);
    if (stored && ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao', 'consolidado'].includes(stored)) {
      return stored as Department;
    }
    return 'usados'; // Padrão: Usados
  } catch (error) {
    console.error('Erro ao carregar departamento selecionado:', error);
    return 'usados';
  }
}

/**
 * Salva o departamento selecionado
 */
export function saveSelectedDepartment(department: Department): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.SELECTED_DEPARTMENT, department);
    return true;
  } catch (error) {
    console.error('Erro ao salvar departamento selecionado:', error);
    return false;
  }
}

/**
 * Limpa todos os dados de um ano fiscal específico e departamento
 * @param fiscalYear - Ano fiscal
 * @param department - Departamento (opcional, limpa todos se não fornecido)
 * @param brand - Marca (opcional, usa a marca salva se não fornecida)
 */
export function clearFiscalYearData(fiscalYear: 2024 | 2025 | 2026 | 2027, department?: Department, brand?: Brand): boolean {
  const currentBrand = getCurrentBrand(brand);
  
  try {
    if (department) {
      const metricsKey = `${currentBrand}_metrics_${fiscalYear}_${department}`;
      const dreKey = `${currentBrand}_dre_${fiscalYear}_${department}`;
      localStorage.removeItem(metricsKey);
      localStorage.removeItem(dreKey);
    } else {
      // Limpa todos os departamentos daquele ano
      const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao'];
      departments.forEach(dept => {
        const metricsKey = `${currentBrand}_metrics_${fiscalYear}_${dept}`;
        const dreKey = `${currentBrand}_dre_${fiscalYear}_${dept}`;
        localStorage.removeItem(metricsKey);
        localStorage.removeItem(dreKey);
      });
    }
    return true;
  } catch (error) {
    console.error(`Erro ao limpar dados de ${fiscalYear} - ${currentBrand}:`, error);
    return false;
  }
}

/**
 * Verifica se há dados salvos para um ano fiscal específico e departamento
 * @param fiscalYear - Ano fiscal
 * @param department - Departamento
 * @param brand - Marca (opcional, usa a marca salva se não fornecida)
 */
export function hasStoredData(fiscalYear: 2024 | 2025 | 2026 | 2027, department: Department = 'usados', brand?: Brand): boolean {
  const currentBrand = getCurrentBrand(brand);
  
  const metricsKey = `${currentBrand}_metrics_${fiscalYear}_${department}`;
  const dreKey = `${currentBrand}_dre_${fiscalYear}_${department}`;
  const sharedKey = `${currentBrand}_metrics_shared_${fiscalYear}`;
  
  return localStorage.getItem(metricsKey) !== null || 
         localStorage.getItem(dreKey) !== null ||
         localStorage.getItem(sharedKey) !== null;
}

/**
 * Função para futura migração para database
 * Esta função deve ser implementada quando houver um backend disponível
 */
export async function migrateToDatabase(): Promise<boolean> {
  // TODO: Implementar migração quando backend estiver disponível
  console.warn('Migração para database ainda não implementada');
  return false;
}

/**
 * Exporta todos os dados para backup
 * Em PRODUÇÃO: exporta do banco de dados
 * Em DESENVOLVIMENTO: exporta do localStorage
 * @param brand - Marca (opcional, usa a marca salva se não fornecida)
 */
export async function exportAllDataAsync(brand?: Brand): Promise<string> {
  const currentBrand = getCurrentBrand(brand);
  const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao', 'consolidado'];
  const years: (2024 | 2025 | 2026 | 2027)[] = [2024, 2025, 2026, 2027];
  
  console.log(`📤 [EXPORT] Iniciando exportação para ${currentBrand}...`);
  console.log(`📤 [EXPORT] Ambiente: ${isProduction() ? 'PRODUÇÃO (DB)' : 'DESENVOLVIMENTO (localStorage)'}`);
  
  const data: any = {
    selectedYear: loadSelectedFiscalYear(),
    selectedDepartment: loadSelectedDepartment(),
    exportDate: new Date().toISOString(),
    brand: currentBrand,
    source: isProduction() ? 'database' : 'localStorage',
    data: {},
    sharedData: {}
  };
  
  if (isProduction()) {
    // Em PRODUÇÃO: busca do banco de dados
    console.log(`📤 [EXPORT] Buscando dados do banco de dados...`);
    
    for (const year of years) {
      data.data[year] = {};
      
      for (const dept of departments) {
        const metricsKey = `${currentBrand}_metrics_${year}_${dept}`;
        const dreKey = `${currentBrand}_dre_${year}_${dept}`;
        
        const [metrics, dre] = await Promise.all([
          getFromDbWithCache<MetricsData>(metricsKey),
          getFromDbWithCache<DREData>(dreKey)
        ]);
        
        data.data[year][dept] = { metrics, dre };
        
        if (metrics || dre) {
          console.log(`✅ [EXPORT] ${year} - ${dept}: métricas=${!!metrics}, DRE=${!!dre}`);
        }
      }
      
      // Dados compartilhados
      const sharedKey = `${currentBrand}_metrics_shared_${year}`;
      const sharedMetrics = await getFromDbWithCache<MetricsData>(sharedKey);
      data.sharedData[year] = { metrics: sharedMetrics };
      
      if (sharedMetrics) {
        console.log(`✅ [EXPORT] ${year} - compartilhados: OK`);
      }
    }
  } else {
    // Em DESENVOLVIMENTO: busca do localStorage
    years.forEach(year => {
      data.data[year] = {};
      departments.forEach(dept => {
        data.data[year][dept] = {
          metrics: loadMetricsData(year, dept, currentBrand),
          dre: loadDREData(year, dept, currentBrand)
        };
      });
    });
    
    years.forEach(year => {
      data.sharedData[year] = {
        metrics: loadSharedMetricsData(year, currentBrand)
      };
    });
  }
  
  console.log(`✅ [EXPORT] Exportação concluída!`);
  return JSON.stringify(data, null, 2);
}

/**
 * Versão síncrona para retrocompatibilidade (usa localStorage)
 * @deprecated Use exportAllDataAsync em produção
 */
export function exportAllData(brand?: Brand): string {
  const currentBrand = getCurrentBrand(brand);
  const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao', 'consolidado'];
  const years: (2024 | 2025 | 2026 | 2027)[] = [2024, 2025, 2026, 2027];
  
  const data: any = {
    selectedYear: loadSelectedFiscalYear(),
    selectedDepartment: loadSelectedDepartment(),
    exportDate: new Date().toISOString(),
    brand: currentBrand, // Inclui a marca no export para referência
    data: {},
    sharedData: {} // Nova seção para dados compartilhados
  };
  
  // Dados por departamento (existente)
  years.forEach(year => {
    data.data[year] = {};
    departments.forEach(dept => {
      data.data[year][dept] = {
        metrics: loadMetricsData(year, dept, currentBrand),
        dre: loadDREData(year, dept, currentBrand)
      };
    });
  });
  
  // Dados compartilhados (novos)
  years.forEach(year => {
    data.sharedData[year] = {
      metrics: loadSharedMetricsData(year, currentBrand)
    };
  });
  
  return JSON.stringify(data, null, 2);
}

/**
 * Importa todos os dados de um backup
 * Em PRODUÇÃO: salva no banco de dados
 * Em DESENVOLVIMENTO: salva no localStorage
 * @param jsonString - JSON string com os dados
 * @param brand - Marca (opcional, usa a marca salva se não fornecida)
 */
export async function importAllDataAsync(jsonString: string, brand?: Brand): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand);
  
  try {
    console.log(`📥 [IMPORT] Iniciando importação para marca: ${currentBrand}...`);
    console.log(`📥 [IMPORT] Ambiente: ${isProduction() ? 'PRODUÇÃO (DB)' : 'DESENVOLVIMENTO (localStorage)'}`);
    
    const backup = JSON.parse(jsonString);
    
    if (!backup.data) {
      console.error('❌ [IMPORT] Formato de backup inválido: propriedade "data" não encontrada');
      return false;
    }
    
    let successCount = 0;
    let totalItems = 0;
    const failures: string[] = [];
    const itemsToSave: Array<{ key: string; value: any }> = [];
    
    // Preparar dados por departamento
    Object.entries(backup.data).forEach(([year, depts]: [string, any]) => {
      const fiscalYear = parseInt(year) as 2024 | 2025 | 2026 | 2027;
      
      if (![2024, 2025, 2026, 2027].includes(fiscalYear)) {
        console.warn(`⚠️ [IMPORT] Ano fiscal inválido ignorado: ${year}`);
        return;
      }
      
      Object.entries(depts).forEach(([dept, data]: [string, any]) => {
        const department = dept as Department;
        
        if (data.metrics) {
          totalItems++;
          const metricsKey = `${currentBrand}_metrics_${fiscalYear}_${department}`;
          itemsToSave.push({ key: metricsKey, value: data.metrics });
        }
        
        if (data.dre) {
          totalItems++;
          const dreKey = `${currentBrand}_dre_${fiscalYear}_${department}`;
          itemsToSave.push({ key: dreKey, value: data.dre });
        }
      });
    });
    
    // Preparar dados compartilhados
    if (backup.sharedData) {
      Object.entries(backup.sharedData).forEach(([year, data]: [string, any]) => {
        const fiscalYear = parseInt(year) as 2024 | 2025 | 2026 | 2027;
        
        if (![2024, 2025, 2026, 2027].includes(fiscalYear)) {
          return;
        }
        
        if (data.metrics) {
          totalItems++;
          const sharedKey = `${currentBrand}_metrics_shared_${fiscalYear}`;
          itemsToSave.push({ key: sharedKey, value: data.metrics });
        }
      });
    }
    
    console.log(`📥 [IMPORT] Total de itens a importar: ${totalItems}`);
    
    // Salva EXCLUSIVAMENTE no banco de dados Redis
    console.log(`💾 [IMPORT] Salvando no banco de dados Redis...`);
    
    const batchSize = 10;
    for (let i = 0; i < itemsToSave.length; i += batchSize) {
      const batch = itemsToSave.slice(i, i + batchSize);
      const success = await kvBulkSet(batch);
      
      if (success) {
        batch.forEach(item => {
          console.log(`✅ [IMPORT] Salvo no Redis: ${item.key}`);
          successCount++;
          // Atualiza cache local (memória)
          dbCache.set(item.key, { data: item.value, timestamp: Date.now() });
        });
      } else {
        batch.forEach(item => {
          console.error(`❌ [IMPORT] Erro ao salvar no Redis: ${item.key}`);
          failures.push(item.key);
        });
      }
    }
    
    // NÃO salva no localStorage - dados devem ir apenas para o Redis
    
    // Salvar configurações de seleção (sempre no localStorage - são preferências locais)
    try {
      if (backup.selectedYear) {
        saveSelectedFiscalYear(backup.selectedYear);
      }
      if (backup.selectedDepartment) {
        saveSelectedDepartment(backup.selectedDepartment);
      }
    } catch (error) {
      console.warn('⚠️ [IMPORT] Erro ao salvar configurações de seleção:', error);
    }
    
    // Relatório final
    console.log(`📊 [IMPORT] Relatório:`);
    console.log(`  - Total: ${totalItems}`);
    console.log(`  - Sucesso no Redis: ${successCount}`);
    console.log(`  - Falhas: ${failures.length}`);
    
    if (failures.length > 0) {
      console.log(`❌ [IMPORT] Itens que falharam:`, failures);
    }
    
    return successCount > 0;
  } catch (error) {
    console.error('❌ [IMPORT] Erro crítico:', error);
    return false;
  }
}

/**
 * Versão síncrona para importação de dados
 * IMPORTANTE: Salva EXCLUSIVAMENTE no banco de dados Redis e cache local
 * NÃO salva no localStorage para dados de negócio
 * @deprecated Prefira usar importAllDataAsync para melhor controle assíncrono
 */
export function importAllData(jsonString: string, brand?: Brand): boolean {
  const currentBrand = getCurrentBrand(brand);
  
  try {
    console.log(`📥 Iniciando importação de dados para marca: ${currentBrand}...`);
    const backup = JSON.parse(jsonString);
    
    if (!backup.data) {
      console.error('❌ Formato de backup inválido: propriedade "data" não encontrada');
      return false;
    }
    
    let successCount = 0;
    let totalItems = 0;
    const failures: string[] = [];
    const itemsToSave: Array<{ key: string; value: any }> = [];
    
    // Importar dados por departamento
    Object.entries(backup.data).forEach(([year, depts]: [string, any]) => {
      const fiscalYear = parseInt(year) as 2024 | 2025 | 2026 | 2027;
      
      if (![2024, 2025, 2026, 2027].includes(fiscalYear)) {
        console.warn(`⚠️ Ano fiscal inválido ignorado: ${year}`);
        return;
      }
      
      Object.entries(depts).forEach(([dept, data]: [string, any]) => {
        const department = dept as Department;
        
        // Para métricas, preparar para salvar no Redis
        if (data.metrics) {
          totalItems++;
          const metricsKey = `${currentBrand}_metrics_${fiscalYear}_${department}`;
          itemsToSave.push({ key: metricsKey, value: data.metrics });
          // Atualiza cache local imediatamente
          dbCache.set(metricsKey, { data: data.metrics, timestamp: Date.now() });
        }
        
        // Para DRE, preparar para salvar no Redis
        if (data.dre) {
          totalItems++;
          const dreKey = `${currentBrand}_dre_${fiscalYear}_${department}`;
          itemsToSave.push({ key: dreKey, value: data.dre });
          // Atualiza cache local imediatamente
          dbCache.set(dreKey, { data: data.dre, timestamp: Date.now() });
        }
      });
    });
    
    // Importar dados compartilhados
    if (backup.sharedData) {
      console.log('📤 Importando dados compartilhados...');
      Object.entries(backup.sharedData).forEach(([year, data]: [string, any]) => {
        const fiscalYear = parseInt(year) as 2024 | 2025 | 2026 | 2027;
        
        if (![2024, 2025, 2026, 2027].includes(fiscalYear)) {
          console.warn(`⚠️ Ano fiscal inválido ignorado nos dados compartilhados: ${year}`);
          return;
        }
        
        if (data.metrics) {
          totalItems++;
          const sharedKey = `${currentBrand}_metrics_shared_${fiscalYear}`;
          itemsToSave.push({ key: sharedKey, value: data.metrics });
          // Atualiza cache local imediatamente
          dbCache.set(sharedKey, { data: data.metrics, timestamp: Date.now() });
        }
      });
    }
    
    // Salvar EXCLUSIVAMENTE no Redis (assíncrono)
    console.log(`💾 [IMPORT] Salvando ${itemsToSave.length} itens no Redis...`);
    kvBulkSet(itemsToSave).then(success => {
      if (success) {
        console.log(`✅ [IMPORT] ${itemsToSave.length} itens salvos no Redis com sucesso`);
      } else {
        console.error(`❌ [IMPORT] Erro ao salvar itens no Redis`);
      }
    }).catch(error => {
      console.error(`❌ [IMPORT] Erro ao salvar no Redis:`, error);
    });
    
    // NÃO salva no localStorage - dados devem ir apenas para o Redis
    successCount = itemsToSave.length;
    
    // Salvar configurações de seleção (preferências locais - podem usar localStorage)
    try {
      if (backup.selectedYear) {
        saveSelectedFiscalYear(backup.selectedYear);
        console.log(`✅ Ano fiscal selecionado: ${backup.selectedYear}`);
      }
      if (backup.selectedDepartment) {
        saveSelectedDepartment(backup.selectedDepartment);
        console.log(`✅ Departamento selecionado: ${backup.selectedDepartment}`);
      }
    } catch (error) {
      console.warn('⚠️ Erro ao salvar configurações de seleção:', error);
    }
    
    // Relatório final
    console.log(`📊 Relatório de importação:`);
    console.log(`  - Total de itens: ${totalItems}`);
    console.log(`  - Itens preparados para Redis: ${successCount}`);
    console.log(`  - Cache local atualizado: ✅`);
    
    return successCount > 0;
  } catch (error) {
    console.error('❌ Erro crítico ao importar dados:', error);
    return false;
  }
}

/**
 * Limpa os dados de um ano fiscal específico (força volta aos dados padrão)
 * IMPORTANTE: Limpa EXCLUSIVAMENTE do Redis e cache local
 * NÃO gerencia localStorage para dados de negócio
 * @param fiscalYear - Ano fiscal
 * @param brand - Marca (opcional, usa a marca salva se não fornecida)
 */
export function clearYearData(fiscalYear: 2024 | 2025 | 2026 | 2027, brand?: Brand): void {
  const currentBrand = getCurrentBrand(brand);
  
  try {
    const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao'];
    const keysToDelete: string[] = [];
    
    departments.forEach(dept => {
      const metricsKey = `${currentBrand}_metrics_${fiscalYear}_${dept}`;
      const dreKey = `${currentBrand}_dre_${fiscalYear}_${dept}`;
      keysToDelete.push(metricsKey, dreKey);
      // Limpa cache local
      dbCache.delete(metricsKey);
      dbCache.delete(dreKey);
    });
    
    // Também limpa dados compartilhados
    const sharedKey = `${currentBrand}_metrics_shared_${fiscalYear}`;
    keysToDelete.push(sharedKey);
    dbCache.delete(sharedKey);
    
    // Limpa do Redis (assíncrono)
    keysToDelete.forEach(key => {
      kvDelete(key).then(success => {
        if (success) {
          console.log(`✅ Removido do Redis: ${key}`);
        }
      }).catch(error => {
        console.error(`❌ Erro ao remover do Redis: ${key}`, error);
      });
    });
    
    console.log(`✅ Dados do ano ${fiscalYear} da marca ${currentBrand} limpos com sucesso`);
  } catch (error) {
    console.error(`Erro ao limpar dados de ${fiscalYear} - ${currentBrand}:`, error);
  }
}

/**
 * Limpa todos os dados de uma marca específica
 * IMPORTANTE: Limpa EXCLUSIVAMENTE do Redis e cache local
 * NÃO gerencia localStorage para dados de negócio
 * @param brand - Marca (opcional, usa a marca salva se não fornecida)
 */
export function clearAllData(brand?: Brand): void {
  const currentBrand = getCurrentBrand(brand);
  
  try {
    // Limpa cache local
    for (const key of dbCache.keys()) {
      if (key.startsWith(`${currentBrand}_`)) {
        dbCache.delete(key);
      }
    }
    
    // Limpa do Redis (usando padrão)
    const pattern = `${currentBrand}_*`;
    kvKeys(pattern).then(keys => {
      keys.forEach(key => {
        kvDelete(key).then(success => {
          if (success) {
            console.log(`✅ Removido do Redis: ${key}`);
          }
        });
      });
    }).catch(error => {
      console.error(`❌ Erro ao listar chaves do Redis: ${pattern}`, error);
    });
    
    console.log(`✅ Todos os dados da marca ${currentBrand} foram limpos com sucesso`);
  } catch (error) {
    console.error(`Erro ao limpar todos os dados da marca ${currentBrand}:`, error);
  }
}

/**
 * Limpa TODOS os dados de TODAS as marcas (cuidado!)
 * IMPORTANTE: Limpa EXCLUSIVAMENTE do Redis e cache local
 */
export function clearAllBrandsData(): void {
  try {
    const brands: Brand[] = ['vw', 'audi', 'vw_outros', 'audi_outros'];
    
    // Limpa cache local
    dbCache.clear();
    
    // Limpa do Redis para cada marca
    brands.forEach(brand => {
      const pattern = `${brand}_*`;
      kvKeys(pattern).then(keys => {
        keys.forEach(key => {
          kvDelete(key).then(success => {
            if (success) {
              console.log(`✅ Removido do Redis: ${key}`);
            }
          });
        });
      }).catch(error => {
        console.error(`❌ Erro ao listar chaves do Redis: ${pattern}`, error);
      });
    });
    
    // Também limpa configurações de preferência (essas podem ficar no localStorage)
    localStorage.removeItem(STORAGE_KEYS.SELECTED_YEAR);
    localStorage.removeItem(STORAGE_KEYS.SELECTED_DEPARTMENT);
    
    console.log('✅ Todos os dados de todas as marcas foram limpos com sucesso');
  } catch (error) {
    console.error('Erro ao limpar todos os dados de todas as marcas:', error);
  }
}

/**
 * Carrega os dados de Fatos Relevantes no Resultado
 * IMPORTANTE: Dados vêm do Redis (cache)
 * @param fiscalYear - Ano fiscal
 * @param department - Departamento
 * @param brand - Marca (opcional, usa a marca salva se não fornecida)
 * @returns Array de fatos relevantes
 */
export function loadFatosRelevantes(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  brand?: Brand
): FatosRelevantesData {
  const currentBrand = getCurrentBrand(brand);
  
  try {
    const key = `${currentBrand}_fatos_relevantes_${fiscalYear}_${department}`;
    
    // Verifica cache do banco de dados (Redis)
    const cached = dbCache.get(key);
    if (cached) {
      console.log(`✅ Fatos Relevantes carregados do cache: ${currentBrand} - ${department} - ${fiscalYear}`);
      return cached.data;
    }
    
    console.log(`ℹ️ Nenhum dado de Fatos Relevantes encontrado para: ${currentBrand} - ${department} - ${fiscalYear}`);
    return [];
  } catch (error) {
    console.error(`Erro ao carregar Fatos Relevantes (${currentBrand} - ${department} - ${fiscalYear}):`, error);
    return [];
  }
}

/**
 * Salva os dados de Fatos Relevantes no Resultado
 * IMPORTANTE: Salva EXCLUSIVAMENTE no Redis
 * Dados são específicos por marca, departamento e ano fiscal
 * @param fiscalYear - Ano fiscal
 * @param department - Departamento
 * @param data - Array de fatos relevantes
 * @param brand - Marca (opcional, usa a marca salva se não fornecida)
 */
export function saveFatosRelevantes(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  data: FatosRelevantesData,
  brand?: Brand
): void {
  const currentBrand = getCurrentBrand(brand);
  
  try {
    const key = `${currentBrand}_fatos_relevantes_${fiscalYear}_${department}`;
    
    // Salva EXCLUSIVAMENTE no Redis
    saveToDbWithCache(key, data).then(success => {
      if (success) {
        console.log(`✅ Fatos Relevantes salvos no Redis: ${currentBrand} - ${department} - ${fiscalYear}`);
      } else {
        console.error(`❌ Erro ao salvar Fatos Relevantes no Redis: ${key}`);
      }
    });
    
    // NÃO salva no localStorage
  } catch (error) {
    console.error(`Erro ao salvar Fatos Relevantes (${currentBrand} - ${department} - ${fiscalYear}):`, error);
  }
}

// =====================================================
// PROJEÇÕES - ARMAZENAMENTO NO REDIS
// =====================================================

/**
 * Interface para dados de projeção
 */
export interface ProjectionData {
  scenarios: { id: string; name: string }[];
  percentages: { [scenarioId: string]: { [lineIndex: number]: number[] } };
  projectedData: { [scenarioId: string]: DREItem[] };
  activeScenario: string | null;
}

/**
 * Gera a chave de armazenamento para projeções
 */
function getProjectionKey(brand: Brand, fiscalYear: number, department: Department): string {
  return `${brand}_projection_${fiscalYear}_${department}`;
}

/**
 * Carrega dados de projeção do Redis
 * @param fiscalYear - Ano fiscal
 * @param department - Departamento
 * @param brand - Marca (opcional)
 */
export async function loadProjectionData(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  brand?: Brand
): Promise<ProjectionData | null> {
  const currentBrand = getCurrentBrand(brand);
  const key = getProjectionKey(currentBrand, fiscalYear, department);
  
  try {
    // Primeiro verifica cache local
    const cached = dbCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`📊 [Projeções] Carregado do cache: ${key}`);
      return cached.data as ProjectionData;
    }
    
    // Se não tem cache, busca do Redis
    const data = await kvGet<ProjectionData>(key);
    if (data) {
      dbCache.set(key, { data, timestamp: Date.now() });
      console.log(`📊 [Projeções] Carregado do Redis: ${key}`);
      return data;
    }
    
    console.log(`📊 [Projeções] Nenhum dado encontrado para: ${key}`);
    return null;
  } catch (error) {
    console.error(`❌ [Projeções] Erro ao carregar: ${key}`, error);
    return null;
  }
}

/**
 * Salva dados de projeção no Redis
 * @param fiscalYear - Ano fiscal
 * @param department - Departamento
 * @param data - Dados de projeção
 * @param brand - Marca (opcional)
 */
export async function saveProjectionData(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  data: ProjectionData,
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand);
  const key = getProjectionKey(currentBrand, fiscalYear, department);
  
  try {
    const success = await kvSet(key, data);
    if (success) {
      dbCache.set(key, { data, timestamp: Date.now() });
      console.log(`✅ [Projeções] Salvo no Redis: ${key}`);
    } else {
      console.error(`❌ [Projeções] Falha ao salvar no Redis: ${key}`);
    }
    return success;
  } catch (error) {
    console.error(`❌ [Projeções] Erro ao salvar: ${key}`, error);
    return false;
  }
}

/**
 * Remove dados de projeção do Redis
 * @param fiscalYear - Ano fiscal
 * @param department - Departamento
 * @param brand - Marca (opcional)
 */
export async function deleteProjectionData(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand);
  const key = getProjectionKey(currentBrand, fiscalYear, department);
  
  try {
    const success = await kvDelete(key);
    if (success) {
      dbCache.delete(key);
      console.log(`🗑️ [Projeções] Removido do Redis: ${key}`);
    }
    return success;
  } catch (error) {
    console.error(`❌ [Projeções] Erro ao remover: ${key}`, error);
    return false;
  }
}
