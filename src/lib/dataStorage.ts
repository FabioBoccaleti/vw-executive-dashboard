/**
 * Camada de persistência de dados - localStorage com preparação para migração para database
 * 
 * Este módulo gerencia o armazenamento de dados de métricas de negócio e DRE.
 * Atualmente usa localStorage, mas está preparado para futura migração para banco de dados.
 */

import { businessMetricsData } from '../data/businessMetricsData';
import { businessMetricsData2026 } from '../data/businessMetricsData2026';

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
  METRICS_2025: 'vw_metrics_2025',
  METRICS_2026: 'vw_metrics_2026',
  DRE_2025: 'vw_dre_2025',
  DRE_2026: 'vw_dre_2026',
  SELECTED_YEAR: 'vw_selected_fiscal_year'
} as const;

/**
 * Carrega os dados de métricas de um ano fiscal específico
 */
export function loadMetricsData(fiscalYear: 2025 | 2026): MetricsData {
  try {
    const key = fiscalYear === 2025 ? STORAGE_KEYS.METRICS_2025 : STORAGE_KEYS.METRICS_2026;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      return JSON.parse(stored);
    }
    
    // Retorna dados padrão se não houver dados salvos
    return fiscalYear === 2025 ? businessMetricsData : businessMetricsData2026;
  } catch (error) {
    console.error(`Erro ao carregar dados de métricas de ${fiscalYear}:`, error);
    return fiscalYear === 2025 ? businessMetricsData : businessMetricsData2026;
  }
}

/**
 * Salva os dados de métricas de um ano fiscal específico
 */
export function saveMetricsData(fiscalYear: 2025 | 2026, data: MetricsData): boolean {
  try {
    const key = fiscalYear === 2025 ? STORAGE_KEYS.METRICS_2025 : STORAGE_KEYS.METRICS_2026;
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
export function loadDREData(fiscalYear: 2025 | 2026): DREData | null {
  try {
    const key = fiscalYear === 2025 ? STORAGE_KEYS.DRE_2025 : STORAGE_KEYS.DRE_2026;
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
export function saveDREData(fiscalYear: 2025 | 2026, data: DREData): boolean {
  try {
    const key = fiscalYear === 2025 ? STORAGE_KEYS.DRE_2025 : STORAGE_KEYS.DRE_2026;
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
export function loadSelectedFiscalYear(): 2025 | 2026 {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_YEAR);
    if (stored) {
      const year = parseInt(stored, 10);
      if (year === 2025 || year === 2026) {
        return year;
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
export function saveSelectedFiscalYear(fiscalYear: 2025 | 2026): boolean {
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
export function clearFiscalYearData(fiscalYear: 2025 | 2026): boolean {
  try {
    const metricsKey = fiscalYear === 2025 ? STORAGE_KEYS.METRICS_2025 : STORAGE_KEYS.METRICS_2026;
    const dreKey = fiscalYear === 2025 ? STORAGE_KEYS.DRE_2025 : STORAGE_KEYS.DRE_2026;
    
    localStorage.removeItem(metricsKey);
    localStorage.removeItem(dreKey);
    return true;
  } catch (error) {
    console.error(`Erro ao limpar dados de ${fiscalYear}:`, error);
    return false;
  }
}

/**
 * Limpa todos os dados de todos os anos fiscais
 */
export function clearAllData(): boolean {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (error) {
    console.error('Erro ao limpar todos os dados:', error);
    return false;
  }
}

/**
 * Verifica se há dados salvos para um ano fiscal específico
 */
export function hasStoredData(fiscalYear: 2025 | 2026): boolean {
  const metricsKey = fiscalYear === 2025 ? STORAGE_KEYS.METRICS_2025 : STORAGE_KEYS.METRICS_2026;
  const dreKey = fiscalYear === 2025 ? STORAGE_KEYS.DRE_2025 : STORAGE_KEYS.DRE_2026;
  
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
    metrics2025: loadMetricsData(2025),
    metrics2026: loadMetricsData(2026),
    dre2025: loadDREData(2025),
    dre2026: loadDREData(2026),
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
    
    if (data.metrics2025) saveMetricsData(2025, data.metrics2025);
    if (data.metrics2026) saveMetricsData(2026, data.metrics2026);
    if (data.dre2025) saveDREData(2025, data.dre2025);
    if (data.dre2026) saveDREData(2026, data.dre2026);
    if (data.selectedYear) saveSelectedFiscalYear(data.selectedYear);
    
    return true;
  } catch (error) {
    console.error('Erro ao importar dados:', error);
    return false;
  }
}
