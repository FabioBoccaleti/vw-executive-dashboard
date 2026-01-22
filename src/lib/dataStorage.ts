/**
 * Camada de persistência de dados - localStorage com preparação para migração para database
 * 
 * Este módulo gerencia o armazenamento de dados de métricas de negócio e DRE.
 * Atualmente usa localStorage, mas está preparado para futura migração para banco de dados.
 */

import { businessMetricsData } from '../data/businessMetricsData';
import { businessMetricsData2024 } from '../data/businessMetricsData2024';
import { businessMetricsData2026 } from '../data/businessMetricsData2026';
import { businessMetricsData2027 } from '../data/businessMetricsData2027';

// Imports dos departamentos
import { businessMetricsDataNovos2024 } from '../data/businessMetricsDataNovos2024';
import { businessMetricsDataVendaDireta2024 } from '../data/businessMetricsDataVendaDireta2024';
import { businessMetricsDataUsados2024 } from '../data/businessMetricsDataUsados2024';
import { businessMetricsDataUsados2025 } from '../data/businessMetricsDataUsados2025';
import { businessMetricsDataUsados2026 } from '../data/businessMetricsDataUsados2026';
import { businessMetricsDataUsados2027 } from '../data/businessMetricsDataUsados2027';
import { businessMetricsDataPecas2024 } from '../data/businessMetricsDataPecas2024';
import { businessMetricsDataOficina2024 } from '../data/businessMetricsDataOficina2024';
import { businessMetricsDataFunilaria2024 } from '../data/businessMetricsDataFunilaria2024';
import { businessMetricsDataAdministracao2024 } from '../data/businessMetricsDataAdministracao2024';

// Tipo para departamento
export type Department = 'novos' | 'vendaDireta' | 'usados' | 'pecas' | 'oficina' | 'funilaria' | 'administracao' | 'consolidado';

// Tipos para os dados de métricas
export type MetricsData = typeof businessMetricsData;

// Tipos para os dados de DRE
export interface DRELine {
  id: string;
  label: string;
  values: number[];
  isTotal?: boolean;
  isSubtotal?: boolean;
  indent?: number;
}

export type DREData = DRELine[];

// Chaves de armazenamento
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
 * Função auxiliar para obter dados padrão por departamento e ano
 */
function getDefaultDataForDepartment(department: Department, fiscalYear: 2024 | 2025 | 2026 | 2027): MetricsData {
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
    return businessMetricsDataNovos2024; // Por enquanto todos os anos têm dados vazios
  }
  
  // Para Venda Direta
  if (department === 'vendaDireta') {
    return businessMetricsDataVendaDireta2024;
  }
  
  // Para Peças
  if (department === 'pecas') {
    return businessMetricsDataPecas2024;
  }
  
  // Para Oficina
  if (department === 'oficina') {
    return businessMetricsDataOficina2024;
  }
  
  // Para Funilaria
  if (department === 'funilaria') {
    return businessMetricsDataFunilaria2024;
  }
  
  // Para Administração
  if (department === 'administracao') {
    return businessMetricsDataAdministracao2024;
  }
  
  // Para Consolidado (será calculado dinamicamente)
  if (department === 'consolidado') {
    return calculateConsolidatedData(fiscalYear);
  }
  
  // Fallback
  return businessMetricsDataNovos2024;
}

/**
 * Calcula os dados consolidados somando todos os departamentos
 */
function calculateConsolidatedData(fiscalYear: 2024 | 2025 | 2026 | 2027): MetricsData {
  const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao'];
  
  // Carrega dados de cada departamento, evitando recursão infinita
  const allData = departments.map(dept => {
    const key = `vw_metrics_${fiscalYear}_${dept}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.warn(`Erro ao parsear dados de ${key}, usando dados padrão`);
      }
    }
    
    // Retorna dados padrão do departamento
    return getDefaultDataForDepartment(dept, fiscalYear);
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
    }
  };
  
  return consolidated;
}

/**
 * Carrega os dados de métricas de um ano fiscal específico e departamento
 */
export function loadMetricsData(fiscalYear: 2024 | 2025 | 2026 | 2027, department: Department = 'usados'): MetricsData {
  try {
    // Se for consolidado, calcula dinamicamente
    if (department === 'consolidado') {
      return calculateConsolidatedData(fiscalYear);
    }
    
    const key = `vw_metrics_${fiscalYear}_${department}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      return JSON.parse(stored);
    }
    
    return getDefaultDataForDepartment(department, fiscalYear);
  } catch (error) {
    console.error(`Erro ao carregar dados de métricas de ${fiscalYear} - ${department}:`, error);
    return getDefaultDataForDepartment(department, fiscalYear);
  }
}

/**
 * Salva os dados de métricas de um ano fiscal específico e departamento
 */
export function saveMetricsData(fiscalYear: 2024 | 2025 | 2026 | 2027, data: MetricsData, department: Department = 'usados'): boolean {
  try {
    // Não permite salvar dados do consolidado (é calculado)
    if (department === 'consolidado') {
      console.warn('Não é possível salvar dados do consolidado diretamente');
      return false;
    }
    
    const key = `vw_metrics_${fiscalYear}_${department}`;
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Erro ao salvar dados de métricas de ${fiscalYear} - ${department}:`, error);
    return false;
  }
}

/**
 * Carrega os dados de DRE de um ano fiscal específico e departamento
 */
export function loadDREData(fiscalYear: 2024 | 2025 | 2026 | 2027, department: Department = 'usados'): DREData | null {
  try {
    // Se for consolidado, soma todas as DREs
    if (department === 'consolidado') {
      return calculateConsolidatedDRE(fiscalYear);
    }
    
    const key = `vw_dre_${fiscalYear}_${department}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      return JSON.parse(stored);
    }
    
    return null;
  } catch (error) {
    console.error(`Erro ao carregar dados de DRE de ${fiscalYear} - ${department}:`, error);
    return null;
  }
}

/**
 * Calcula DRE consolidada somando todos os departamentos
 */
function calculateConsolidatedDRE(fiscalYear: 2024 | 2025 | 2026 | 2027): DREData | null {
  const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao'];
  const allDREs = departments.map(dept => loadDREData(fiscalYear, dept)).filter(dre => dre !== null) as DREData[];
  
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
 */
export function saveDREData(fiscalYear: 2024 | 2025 | 2026 | 2027, data: DREData, department: Department = 'usados'): boolean {
  try {
    // Não permite salvar dados do consolidado (é calculado)
    if (department === 'consolidado') {
      console.warn('Não é possível salvar dados do consolidado diretamente');
      return false;
    }
    
    const key = `vw_dre_${fiscalYear}_${department}`;
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Erro ao salvar dados de DRE de ${fiscalYear} - ${department}:`, error);
    return false;
  }
}

/**
 * Carrega o ano fiscal selecionado
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
 */
export function clearFiscalYearData(fiscalYear: 2024 | 2025 | 2026 | 2027, department?: Department): boolean {
  try {
    if (department) {
      const metricsKey = `vw_metrics_${fiscalYear}_${department}`;
      const dreKey = `vw_dre_${fiscalYear}_${department}`;
      localStorage.removeItem(metricsKey);
      localStorage.removeItem(dreKey);
    } else {
      // Limpa todos os departamentos daquele ano
      const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao'];
      departments.forEach(dept => {
        const metricsKey = `vw_metrics_${fiscalYear}_${dept}`;
        const dreKey = `vw_dre_${fiscalYear}_${dept}`;
        localStorage.removeItem(metricsKey);
        localStorage.removeItem(dreKey);
      });
    }
    return true;
  } catch (error) {
    console.error(`Erro ao limpar dados de ${fiscalYear}:`, error);
    return false;
  }
}

/**
 * Verifica se há dados salvos para um ano fiscal específico e departamento
 */
export function hasStoredData(fiscalYear: 2024 | 2025 | 2026 | 2027, department: Department = 'usados'): boolean {
  const metricsKey = `vw_metrics_${fiscalYear}_${department}`;
  const dreKey = `vw_dre_${fiscalYear}_${department}`;
  
  return localStorage.getItem(metricsKey) !== null || localStorage.getItem(dreKey) !== null;
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
 */
export function exportAllData(): string {
  const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao'];
  const years: (2024 | 2025 | 2026 | 2027)[] = [2024, 2025, 2026, 2027];
  
  const data: any = {
    selectedYear: loadSelectedFiscalYear(),
    selectedDepartment: loadSelectedDepartment(),
    exportDate: new Date().toISOString(),
    data: {}
  };
  
  years.forEach(year => {
    data.data[year] = {};
    departments.forEach(dept => {
      data.data[year][dept] = {
        metrics: loadMetricsData(year, dept),
        dre: loadDREData(year, dept)
      };
    });
  });
  
  return JSON.stringify(data, null, 2);
}

/**
 * Importa todos os dados de um backup
 */
export function importAllData(jsonString: string): boolean {
  try {
    const backup = JSON.parse(jsonString);
    
    if (backup.data) {
      Object.entries(backup.data).forEach(([year, depts]: [string, any]) => {
        const fiscalYear = parseInt(year) as 2024 | 2025 | 2026 | 2027;
        Object.entries(depts).forEach(([dept, data]: [string, any]) => {
          if (data.metrics) saveMetricsData(fiscalYear, data.metrics, dept as Department);
          if (data.dre) saveDREData(fiscalYear, data.dre, dept as Department);
        });
      });
    }
    
    if (backup.selectedYear) saveSelectedFiscalYear(backup.selectedYear);
    if (backup.selectedDepartment) saveSelectedDepartment(backup.selectedDepartment);
    
    return true;
  } catch (error) {
    console.error('Erro ao importar dados:', error);
    return false;
  }
}

/**
 * Limpa os dados de um ano fiscal específico (força volta aos dados padrão)
 */
export function clearYearData(fiscalYear: 2024 | 2025 | 2026 | 2027): void {
  try {
    const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao'];
    departments.forEach(dept => {
      const metricsKey = `vw_metrics_${fiscalYear}_${dept}`;
      const dreKey = `vw_dre_${fiscalYear}_${dept}`;
      localStorage.removeItem(metricsKey);
      localStorage.removeItem(dreKey);
    });
    
    console.log(`✅ Dados do ano ${fiscalYear} limpos com sucesso`);
  } catch (error) {
    console.error(`Erro ao limpar dados de ${fiscalYear}:`, error);
  }
}

/**
 * Limpa todos os dados de todos os anos fiscais e departamentos
 */
export function clearAllData(): void {
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('vw_')) {
        localStorage.removeItem(key);
      }
    });
    console.log('✅ Todos os dados foram limpos com sucesso');
  } catch (error) {
    console.error('Erro ao limpar todos os dados:', error);
  }
}
