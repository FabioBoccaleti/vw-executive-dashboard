/**
 * Sistema de Persistência de Dados - Aprovação de Despesas
 * Usa Vercel KV para armazenamento compartilhado entre usuários
 */

import { despesas as despesasIniciais, type Despesa } from '@/data/despesasData';
import { kvGet, kvSet } from './kvClient';

const STORAGE_KEY = 'aprovacao_despesas_data';

export interface DespesasState {
  despesas: Despesa[];
  lastUpdate: string;
}

/**
 * Carrega os dados do Vercel KV (ou localStorage como fallback)
 */
export async function loadDespesas(): Promise<Despesa[]> {
  try {
    // Tenta carregar do Vercel KV primeiro
    const state = await kvGet<DespesasState>(STORAGE_KEY);
    if (state && state.despesas) {
      return state.despesas;
    }
  } catch (error) {
    console.error('Erro ao carregar do KV, usando localStorage:', error);
  }

  // Fallback para localStorage
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
 * Salva os dados no Vercel KV (e localStorage como backup)
 */
export async function saveDespesas(despesas: Despesa[]): Promise<void> {
  const state: DespesasState = {
    despesas,
    lastUpdate: new Date().toISOString(),
  };

  try {
    // Salva no Vercel KV
    await kvSet(STORAGE_KEY, state);
  } catch (error) {
    console.error('Erro ao salvar no KV:', error);
  }

  // Salva no localStorage como backup
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Erro ao salvar no localStorage:', error);
  }
}

/**
 * Adiciona uma nova despesa
 */
export async function addDespesa(novaDespesa: Omit<Despesa, 'id'>): Promise<Despesa> {
  const despesas = await loadDespesas();
  const id = (Math.max(...despesas.map(d => parseInt(d.id)), 0) + 1).toString();
  const despesa: Despesa = { ...novaDespesa, id };
  
  despesas.unshift(despesa);
  await saveDespesas(despesas);
  
  return despesa;
}

/**
 * Atualiza uma despesa existente
 */
export async function updateDespesa(id: string, updates: Partial<Despesa>): Promise<void> {
  const despesas = await loadDespesas();
  const index = despesas.findIndex(d => d.id === id);
  
  if (index !== -1) {
    despesas[index] = { ...despesas[index], ...updates };
    await saveDespesas(despesas);
  }
}

/**
 * Remove uma despesa
 */
export async function deleteDespesa(id: string): Promise<void> {
  const despesas = await loadDespesas();
  const filtered = despesas.filter(d => d.id !== id);
  await saveDespesas(filtered);
}

/**
 * Aprova uma despesa
 */
export async function aprovarDespesa(id: string, aprovador: string): Promise<void> {
  await updateDespesa(id, {
    status: 'aprovado',
    dataAprovacao: new Date().toISOString().split('T')[0],
    aprovador,
  });
}

/**
 * Rejeita uma despesa
 */
export async function rejeitarDespesa(id: string, aprovador: string, observacao?: string): Promise<void> {
  await updateDespesa(id, {
    status: 'reprovado',
    dataAprovacao: new Date().toISOString().split('T')[0],
    aprovador,
    observacao,
  });
}

/**
 * Reseta os dados para o estado inicial
 */
export async function resetDespesas(): Promise<void> {
  await saveDespesas(despesasIniciais);
}
