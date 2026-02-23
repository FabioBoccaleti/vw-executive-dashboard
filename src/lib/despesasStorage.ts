/**
 * Sistema de Persistência de Dados - Aprovação de Despesas
 */

import { despesas as despesasIniciais, type Despesa } from '@/data/despesasData';

const STORAGE_KEY = 'aprovacao_despesas_data';

export interface DespesasState {
  despesas: Despesa[];
  lastUpdate: string;
}

/**
 * Carrega os dados do localStorage ou retorna dados iniciais
 */
export function loadDespesas(): Despesa[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const state: DespesasState = JSON.parse(saved);
      return state.despesas;
    }
  } catch (error) {
    console.error('Erro ao carregar despesas:', error);
  }
  return despesasIniciais;
}

/**
 * Salva os dados no localStorage
 */
export function saveDespesas(despesas: Despesa[]): void {
  try {
    const state: DespesasState = {
      despesas,
      lastUpdate: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Erro ao salvar despesas:', error);
  }
}

/**
 * Adiciona uma nova despesa
 */
export function addDespesa(novaDespesa: Omit<Despesa, 'id'>): Despesa {
  const despesas = loadDespesas();
  const id = (Math.max(...despesas.map(d => parseInt(d.id)), 0) + 1).toString();
  const despesa: Despesa = { ...novaDespesa, id };
  
  despesas.unshift(despesa);
  saveDespesas(despesas);
  
  return despesa;
}

/**
 * Atualiza uma despesa existente
 */
export function updateDespesa(id: string, updates: Partial<Despesa>): void {
  const despesas = loadDespesas();
  const index = despesas.findIndex(d => d.id === id);
  
  if (index !== -1) {
    despesas[index] = { ...despesas[index], ...updates };
    saveDespesas(despesas);
  }
}

/**
 * Remove uma despesa
 */
export function deleteDespesa(id: string): void {
  const despesas = loadDespesas();
  const filtered = despesas.filter(d => d.id !== id);
  saveDespesas(filtered);
}

/**
 * Aprova uma despesa
 */
export function aprovarDespesa(id: string, aprovador: string): void {
  updateDespesa(id, {
    status: 'aprovado',
    dataAprovacao: new Date().toISOString().split('T')[0],
    aprovador,
  });
}

/**
 * Rejeita uma despesa
 */
export function rejeitarDespesa(id: string, aprovador: string, observacao?: string): void {
  updateDespesa(id, {
    status: 'reprovado',
    dataAprovacao: new Date().toISOString().split('T')[0],
    aprovador,
    observacao,
  });
}

/**
 * Reseta os dados para o estado inicial
 */
export function resetDespesas(): void {
  saveDespesas(despesasIniciais);
}
