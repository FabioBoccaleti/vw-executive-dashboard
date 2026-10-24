import { kvGet, kvSet, kvDelete } from '@/lib/kvClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface EstoqueUsadosEntry {
  date: string;       // 'YYYY-MM-DD'
  updatedAt: number;  // timestamp
  // ESTOQUE VW / OUTROS
  vwUsadosPagos: number;
  vwNovosPagos: number;
  vwValoresCheque: number;
  vwUsadosLMaPagar: number;
  vwUsadosPendenteEntrada: number;
  // ESTOQUE AUDI / OUTROS
  audiUsadosPago: number;
  audiNovosPagos: number;
  audiUsadosPendenteEntrada: number;
  // ESTOQUE A PAGAR VW (não compõe total VW/Outros)
  vwUsadosLMVendidoaPagar: number;
  // Valores próximos do vencimento VW em até 30 dias (informativo, não compõe total)
  vwVencimento30Dias: number;
  // ESTOQUE A PAGAR AUDI (não compõe total Audi/Outros)
  audiUsadosMontadoraaPagar: number;
  // Valores próximos do vencimento AUDI em até 30 dias (informativo, não compõe total)
  audiVencimento30Dias: number;
  // NOVOS PRÓX. VENCIMENTO VW (não compõe total VW/Outros)
  vwNovosProximoVencimento: number;
  // NOVOS PRÓX. VENCIMENTO AUDI (não compõe total Audi/Outros)
  audiNovosProximoVencimento: number;
}

export interface EstoqueUsadosMeta {
  metaVW: number;
  metaAudi: number;
}

// ─── Floor Plan ───────────────────────────────────────────────────────────────

/** Valor de Floor Plan lançado em um dia, por banco */
export interface FloorPlanDay {
  itau: number;
  volks: number;
}

/** Mapa de datas ('YYYY-MM-DD') → valores de Floor Plan do dia */
export type FloorPlanMap = Record<string, FloorPlanDay>;

/** Limites de crédito das linhas de Floor Plan, por banco */
export interface FloorPlanLimits {
  itau: number;
  volks: number;
}

// ─── Chaves de storage ────────────────────────────────────────────────────────

const ENTRY_PREFIX     = 'estoque_usados:entry:';
const META_KEY         = 'estoque_usados:meta';
const INDEX_KEY        = 'estoque_usados:index';
const FLOORPLAN_KEY    = 'estoque_usados:floorplan';
const FLOORPLAN_LIMITS_KEY = 'estoque_usados:floorplan_limits';

// ─── Helpers de cálculo ───────────────────────────────────────────────────────

export function calcTotalVW(e: Partial<EstoqueUsadosEntry>): number {
  return (e.vwUsadosPagos ?? 0)
    + (e.vwNovosPagos ?? 0)
    + (e.vwValoresCheque ?? 0)
    + (e.vwUsadosLMaPagar ?? 0)
    + (e.vwUsadosPendenteEntrada ?? 0);
}

export function calcTotalAudi(e: Partial<EstoqueUsadosEntry>): number {
  return (e.audiUsadosPago ?? 0)
    + (e.audiNovosPagos ?? 0)
    + (e.audiUsadosPendenteEntrada ?? 0);
}

export const EMPTY_FIELDS: Omit<EstoqueUsadosEntry, 'date' | 'updatedAt'> = {
  vwUsadosPagos: 0,
  vwNovosPagos: 0,
  vwValoresCheque: 0,
  vwUsadosLMaPagar: 0,
  vwUsadosPendenteEntrada: 0,
  audiUsadosPago: 0,
  audiNovosPagos: 0,
  audiUsadosPendenteEntrada: 0,
  vwUsadosLMVendidoaPagar: 0,
  vwVencimento30Dias: 0,
  audiUsadosMontadoraaPagar: 0,
  audiVencimento30Dias: 0,
  vwNovosProximoVencimento: 0,
  audiNovosProximoVencimento: 0,
};

// ─── CRUD Lançamentos ─────────────────────────────────────────────────────────

export async function saveEntry(entry: EstoqueUsadosEntry): Promise<boolean> {
  try {
    const ok = await kvSet(`${ENTRY_PREFIX}${entry.date}`, entry);
    if (ok) {
      const idx = (await kvGet<string[]>(INDEX_KEY)) ?? [];
      if (!idx.includes(entry.date)) {
        await kvSet(INDEX_KEY, [...idx, entry.date]);
      }
    }
    return ok;
  } catch (err) {
    console.error('[EstoqueUsados] Erro ao salvar:', err);
    return false;
  }
}

export async function loadEntry(date: string): Promise<EstoqueUsadosEntry | null> {
  try {
    return await kvGet<EstoqueUsadosEntry>(`${ENTRY_PREFIX}${date}`);
  } catch (err) {
    console.error('[EstoqueUsados] Erro ao carregar entrada:', err);
    return null;
  }
}

export async function deleteEntry(date: string): Promise<boolean> {
  try {
    const ok = await kvDelete(`${ENTRY_PREFIX}${date}`);
    if (ok) {
      const idx = (await kvGet<string[]>(INDEX_KEY)) ?? [];
      await kvSet(INDEX_KEY, idx.filter(d => d !== date));
    }
    return ok;
  } catch (err) {
    console.error('[EstoqueUsados] Erro ao excluir:', err);
    return false;
  }
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export async function saveMeta(meta: EstoqueUsadosMeta): Promise<boolean> {
  try {
    return await kvSet(META_KEY, meta);
  } catch (err) {
    console.error('[EstoqueUsados] Erro ao salvar meta:', err);
    return false;
  }
}

export async function loadMeta(): Promise<EstoqueUsadosMeta> {
  try {
    return (await kvGet<EstoqueUsadosMeta>(META_KEY)) ?? { metaVW: 0, metaAudi: 0 };
  } catch {
    return { metaVW: 0, metaAudi: 0 };
  }
}

// ─── Floor Plan ───────────────────────────────────────────────────────────────

/** Soma os valores de Floor Plan de um dia (Itaú + Volks) */
export function calcTotalFloorPlan(d: Partial<FloorPlanDay> | null | undefined): number {
  return (d?.itau ?? 0) + (d?.volks ?? 0);
}

/** Carrega o mapa completo de lançamentos de Floor Plan (por data) */
export async function loadFloorPlanMap(): Promise<FloorPlanMap> {
  try {
    return (await kvGet<FloorPlanMap>(FLOORPLAN_KEY)) ?? {};
  } catch (err) {
    console.error('[EstoqueUsados] Erro ao carregar floor plan:', err);
    return {};
  }
}

/** Salva/atualiza os valores de Floor Plan de um único dia */
export async function saveFloorPlanDay(date: string, day: FloorPlanDay): Promise<boolean> {
  try {
    const map = await loadFloorPlanMap();
    map[date] = { itau: day.itau ?? 0, volks: day.volks ?? 0 };
    return await kvSet(FLOORPLAN_KEY, map);
  } catch (err) {
    console.error('[EstoqueUsados] Erro ao salvar floor plan do dia:', err);
    return false;
  }
}

/** Carrega os limites das linhas de Floor Plan */
export async function loadFloorPlanLimits(): Promise<FloorPlanLimits> {
  try {
    return (await kvGet<FloorPlanLimits>(FLOORPLAN_LIMITS_KEY)) ?? { itau: 0, volks: 0 };
  } catch {
    return { itau: 0, volks: 0 };
  }
}

/** Salva os limites das linhas de Floor Plan */
export async function saveFloorPlanLimits(limits: FloorPlanLimits): Promise<boolean> {
  try {
    return await kvSet(FLOORPLAN_LIMITS_KEY, { itau: limits.itau ?? 0, volks: limits.volks ?? 0 });
  } catch (err) {
    console.error('[EstoqueUsados] Erro ao salvar limites de floor plan:', err);
    return false;
  }
}

// ─── Índice de datas ──────────────────────────────────────────────────────────

/** Retorna a lista de datas com lançamentos, ordenada decrescente (mais recente primeiro) */
export async function loadIndex(): Promise<string[]> {
  try {
    const idx = (await kvGet<string[]>(INDEX_KEY)) ?? [];
    return idx.sort((a, b) => b.localeCompare(a));
  } catch {
    return [];
  }
}

// ─── Formatação ───────────────────────────────────────────────────────────────

export function formatDateBR(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export const fmtBRL = (v: number | undefined | null) =>
  (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const parseNum = (s: string) =>
  parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
