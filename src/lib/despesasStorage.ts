/**
 * Sistema de Persistência de Dados - Sistema de Gerenciamento e Aprovação de Despesas
 * Usa Vercel KV (Redis) para armazenamento compartilhado entre usuários em produção.
 *
 * Estratégia de persistência:
 *  - Metadados das despesas → chave `aprovacao_despesas_data` (payload leve)
 *  - Imagens (base64) → chaves individuais `aprovacao_despesas_imagem_{id}`
 *  - localStorage → cache/fallback local para cada visita
 *
 * Isso evita que payloads com imagens grandes ultrapassem o limite de 1MB
 * por valor do Upstash Redis REST API.
 */

import { despesas as despesasIniciais, type Despesa } from '@/data/despesasData';
import { kvGet, kvSet, kvDelete } from './kvClient';

const STORAGE_KEY = 'aprovacao_despesas_data';
const IMAGE_KEY_PREFIX = 'aprovacao_despesas_imagem_';

export interface DespesasState {
  despesas: Despesa[];
  lastUpdate: string;
}

// ── Helpers de imagem ──────────────────────────────────────────────────────────

function imageKey(id: string) {
  return `${IMAGE_KEY_PREFIX}${id}`;
}

/** Remove imagens do payload e as salva individualmente no Redis */
async function saveImages(despesas: Despesa[]): Promise<void> {
  for (const d of despesas) {
    if (d.imagemNotaFiscal) {
      try {
        await kvSet(imageKey(d.id), d.imagemNotaFiscal);
      } catch (err) {
        console.error(`Erro ao salvar imagem da despesa ${d.id} no Redis:`, err);
      }
    }
  }
}

/** Retorna o array sem o campo imagemNotaFiscal */
function stripImages(despesas: Despesa[]): Despesa[] {
  return despesas.map(({ imagemNotaFiscal: _img, ...rest }) => rest as Despesa);
}

/** Reintegra imagens carregadas do Redis a cada despesa */
async function reattachImages(despesas: Despesa[]): Promise<Despesa[]> {
  return Promise.all(
    despesas.map(async (d) => {
      try {
        const img = await kvGet<string>(imageKey(d.id));
        if (img) return { ...d, imagemNotaFiscal: img };
      } catch {
        // silencioso – imagem permanece indefinida
      }
      return d;
    })
  );
}

/** Remove imagem do Redis quando a despesa é deletada */
async function deleteImage(id: string): Promise<void> {
  try {
    await kvDelete(imageKey(id));
  } catch {
    // silencioso
  }
}

// ── CRUD principal ─────────────────────────────────────────────────────────────

/**
 * Carrega as despesas do Redis (ou localStorage como fallback).
 * As imagens são carregadas separadamente para evitar payloads grandes.
 */
export async function loadDespesas(): Promise<Despesa[]> {
  try {
    const state = await kvGet<DespesasState>(STORAGE_KEY);
    if (state && Array.isArray(state.despesas)) {
      // Recarrega imagens em paralelo a partir das chaves individuais
      const withImages = await reattachImages(state.despesas);

      // Atualiza o cache local
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ despesas: withImages, lastUpdate: state.lastUpdate }));
      } catch { /* quota excedida — ignora */ }

      return withImages;
    }
  } catch (error) {
    console.error('Erro ao carregar despesas do Redis, usando localStorage:', error);
  }

  // Fallback: localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const state: DespesasState = JSON.parse(saved);
      if (Array.isArray(state.despesas)) {
        // Tenta sincronizar o cache local de volta ao Redis de forma silenciosa
        saveDespesas(state.despesas).catch(() => {});
        return state.despesas;
      }
    }
  } catch (error) {
    console.error('Erro ao carregar despesas do localStorage:', error);
  }

  return despesasIniciais;
}

/**
 * Salva as despesas no Redis e no localStorage.
 * Imagens são armazenadas em chaves separadas para não ultrapassar o limite de 1MB.
 */
export async function saveDespesas(despesas: Despesa[]): Promise<void> {
  // 1. Persistir imagens individualmente no Redis
  await saveImages(despesas);

  // 2. Persistir metadados sem imagens no Redis
  const state: DespesasState = {
    despesas: stripImages(despesas),
    lastUpdate: new Date().toISOString(),
  };

  try {
    await kvSet(STORAGE_KEY, state);
  } catch (error) {
    console.error('Erro ao salvar metadados das despesas no Redis:', error);
  }

  // 3. Cache local com imagens para acesso offline/instantâneo
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ despesas, lastUpdate: state.lastUpdate }));
  } catch (error) {
    console.error('Erro ao salvar no localStorage:', error);
  }
}

/**
 * Adiciona uma nova despesa
 */
export async function addDespesa(novaDespesa: Omit<Despesa, 'id'>): Promise<Despesa> {
  const despesas = await loadDespesas();
  const ids = despesas.map(d => parseInt(d.id)).filter(n => !isNaN(n));
  const id = ((ids.length > 0 ? Math.max(...ids) : 0) + 1).toString();
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
 * Remove uma despesa e sua imagem associada
 */
export async function deleteDespesa(id: string): Promise<void> {
  const despesas = await loadDespesas();
  const filtered = despesas.filter(d => d.id !== id);
  await saveDespesas(filtered);
  // Remove a imagem do Redis
  await deleteImage(id);
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
