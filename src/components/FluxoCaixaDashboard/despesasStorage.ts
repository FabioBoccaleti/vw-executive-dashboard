// Persistência dos tipos de despesa (labels editáveis por conta do grupo 5)
// Mapa global: conta -> tipo_string (não é por período, é uma classificação permanente)

import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'fluxo_caixa_despesas_tipos';

/** Carrega o mapa de tipos de despesas { '5.x.x.x.x': 'Tipo digitado' } */
export async function loadDespesasTipos(): Promise<Record<string, string>> {
  try {
    return (await kvGet<Record<string, string>>(KEY)) ?? {};
  } catch (err) {
    console.error('Erro ao carregar tipos de despesas:', err);
    return {};
  }
}

/** Salva o mapa completo de tipos de despesas */
export async function saveDespesasTipos(tipos: Record<string, string>): Promise<void> {
  try {
    await kvSet(KEY, tipos);
  } catch (err) {
    console.error('Erro ao salvar tipos de despesas:', err);
  }
}
