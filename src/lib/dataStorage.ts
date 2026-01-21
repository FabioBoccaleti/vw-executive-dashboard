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
  SELECTED_YEAR: 'vw_selected_fiscal_year'
} as const;

/**
 * Carrega os dados de métricas de um ano fiscal específico
 */
export function loadMetricsData(fiscalYear: 2024 | 2025 | 2026 | 2027): MetricsData {
  try {
    let key: string;
    let defaultData: MetricsData;
    
    switch (fiscalYear) {
      case 2024:
        key = STORAGE_KEYS.METRICS_2024;
        defaultData = businessMetricsData2024;
        break;
      case 2025:
        key = STORAGE_KEYS.METRICS_2025;
        defaultData = businessMetricsData;
        break;
      case 2026:
        key = STORAGE_KEYS.METRICS_2026;
        defaultData = businessMetricsData2026;
        break;
      case 2027:
        key = STORAGE_KEYS.METRICS_2027;
        defaultData = businessMetricsData2027;
        break;
    }
    
    const stored = localStorage.getItem(key);
    
    if (stored) {
      return JSON.parse(stored);
    }
    
    return defaultData;
  } catch (error) {
    console.error(`Erro ao carregar dados de métricas de ${fiscalYear}:`, error);
    
    switch (fiscalYear) {
      case 2024: return businessMetricsData2024;
      case 2025: return businessMetricsData;
      case 2026: return businessMetricsData2026;
      case 2027: return businessMetricsData2027;
    }
  }
}

/**
 * Salva os dados de métricas de um ano fiscal específico
 */
export function saveMetricsData(fiscalYear: 2024 | 2025 | 2026 | 2027, data: MetricsData): boolean {
  try {
    let key: string;
    
    switch (fiscalYear) {
      case 2024: key = STORAGE_KEYS.METRICS_2024; break;
      case 2025: key = STORAGE_KEYS.METRICS_2025; break;
      case 2026: key = STORAGE_KEYS.METRICS_2026; break;
      case 2027: key = STORAGE_KEYS.METRICS_2027; break;
    }
    
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Erro ao salvar dados de métricas de ${fiscalYear}:`, error);
    return false;
  }
}

/**
 * Carrega os dados de DRE de um ano fiscal específico
 */
export function loadDREData(fiscalYear: 2024 | 2025 | 2026 | 2027): DREData | null {
  try {
    let key: string;
    
    switch (fiscalYear) {
      case 2024: key = STORAGE_KEYS.DRE_2024; break;
      case 2025: key = STORAGE_KEYS.DRE_2025; break;
      case 2026: key = STORAGE_KEYS.DRE_2026; break;
      case 2027: key = STORAGE_KEYS.DRE_2027; break;
    }
    
    const stored = localStorage.getItem(key);
    
    if (stored) {
      return JSON.parse(stored);
    }
    
    return null;
  } catch (error) {
    console.error(`Erro ao carregar dados de DRE de ${fiscalYear}:`, error);
    return null;
  }
}

/**
 * Salva os dados de DRE de um ano fiscal específico
 */
export function saveDREData(fiscalYear: 2024 | 2025 | 2026 | 2027, data: DREData): boolean {
  try {
    let key: string;
    
    switch (fiscalYear) {
      case 2024: key = STORAGE_KEYS.DRE_2024; break;
      case 2025: key = STORAGE_KEYS.DRE_2025; break;
      case 2026: key = STORAGE_KEYS.DRE_2026; break;
      case 2027: key = STORAGE_KEYS.DRE_2027; break;
    }
    
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Erro ao salvar dados de DRE de ${fiscalYear}:`, error);
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
 * Limpa todos os dados de um ano fiscal específico
 */
export function clearFiscalYearData(fiscalYear: 2024 | 2025 | 2026 | 2027): boolean {
  try {
    let metricsKey: string;
    let dreKey: string;
    
    switch (fiscalYear) {
      case 2024:
        metricsKey = STORAGE_KEYS.METRICS_2024;
        dreKey = STORAGE_KEYS.DRE_2024;
        break;
      case 2025:
        metricsKey = STORAGE_KEYS.METRICS_2025;
        dreKey = STORAGE_KEYS.DRE_2025;
        break;
      case 2026:
        metricsKey = STORAGE_KEYS.METRICS_2026;
        dreKey = STORAGE_KEYS.DRE_2026;
        break;
      case 2027:
        metricsKey = STORAGE_KEYS.METRICS_2027;
        dreKey = STORAGE_KEYS.DRE_2027;
        break;
    }
    
    localStorage.removeItem(metricsKey);
    localStorage.removeItem(dreKey);
    return true;
  } catch (error) {
    console.error(`Erro ao limpar dados de ${fiscalYear}:`, error);
    return false;
  }
}

/**
 * Verifica se há dados salvos para um ano fiscal específico
 */
export function hasStoredData(fiscalYear: 2024 | 2025 | 2026 | 2027): boolean {
  let metricsKey: string;
  let dreKey: string;
  
  switch (fiscalYear) {
    case 2024:
      metricsKey = STORAGE_KEYS.METRICS_2024;
      dreKey = STORAGE_KEYS.DRE_2024;
      break;
    case 2025:
      metricsKey = STORAGE_KEYS.METRICS_2025;
      dreKey = STORAGE_KEYS.DRE_2025;
      break;
    case 2026:
      metricsKey = STORAGE_KEYS.METRICS_2026;
      dreKey = STORAGE_KEYS.DRE_2026;
      break;
    case 2027:
      metricsKey = STORAGE_KEYS.METRICS_2027;
      dreKey = STORAGE_KEYS.DRE_2027;
      break;
  }
  
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
  const data = {
    metrics2024: loadMetricsData(2024),
    metrics2025: loadMetricsData(2025),
    metrics2026: loadMetricsData(2026),
    metrics2027: loadMetricsData(2027),
    dre2024: loadDREData(2024),
    dre2025: loadDREData(2025),
    dre2026: loadDREData(2026),
    dre2027: loadDREData(2027),
    selectedYear: loadSelectedFiscalYear(),
    exportDate: new Date().toISOString()
  };
  
  return JSON.stringify(data, null, 2);
}

/**
 * Importa todos os dados de um backup
 */
export function importAllData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    
    if (data.metrics2024) saveMetricsData(2024, data.metrics2024);
    if (data.metrics2025) saveMetricsData(2025, data.metrics2025);
    if (data.metrics2026) saveMetricsData(2026, data.metrics2026);
    if (data.metrics2027) saveMetricsData(2027, data.metrics2027);
    if (data.dre2024) saveDREData(2024, data.dre2024);
    if (data.dre2025) saveDREData(2025, data.dre2025);
    if (data.dre2026) saveDREData(2026, data.dre2026);
    if (data.dre2027) saveDREData(2027, data.dre2027);
    if (data.selectedYear) saveSelectedFiscalYear(data.selectedYear);
    
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
    let metricsKey: string;
    let dreKey: string;
    
    switch (fiscalYear) {
      case 2024:
        metricsKey = STORAGE_KEYS.METRICS_2024;
        dreKey = STORAGE_KEYS.DRE_2024;
        break;
      case 2025:
        metricsKey = STORAGE_KEYS.METRICS_2025;
        dreKey = STORAGE_KEYS.DRE_2025;
        break;
      case 2026:
        metricsKey = STORAGE_KEYS.METRICS_2026;
        dreKey = STORAGE_KEYS.DRE_2026;
        break;
      case 2027:
        metricsKey = STORAGE_KEYS.METRICS_2027;
        dreKey = STORAGE_KEYS.DRE_2027;
        break;
    }
    
    localStorage.removeItem(metricsKey);
    localStorage.removeItem(dreKey);
    
    console.log(`✅ Dados do ano ${fiscalYear} limpos com sucesso`);
  } catch (error) {
    console.error(`Erro ao limpar dados de ${fiscalYear}:`, error);
  }
}

/**
 * Limpa todos os dados de todos os anos fiscais
 */
export function clearAllData(): void {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('✅ Todos os dados foram limpos com sucesso');
  } catch (error) {
    console.error('Erro ao limpar todos os dados:', error);
  }
}
