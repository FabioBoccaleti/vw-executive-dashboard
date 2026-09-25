import { kvGet, kvSet } from '@/lib/kvClient';
import type { CampoAssinaturaComissao, AssinaturaDigital } from './comissoesLancamentosStorage';

export type PlantaoDepto = 'novos' | 'usados' | 'vd';

export const DEPTO_LABELS: Record<PlantaoDepto, string> = {
  novos:  'Novos',
  usados: 'Usados',
  vd:     'Venda Direta',
};
export const DEPTOS: PlantaoDepto[] = ['novos', 'usados', 'vd'];

// ─── Colaboradores (cadastro global, disponível em todos os meses) ────────────
export interface PlantaoColaborador {
  id: string;
  nome: string;
  funcao: string;
  valorPorSabado: number;
  departamento: PlantaoDepto;
  ativo: boolean;
  ordem?: number;
}

const COLAB_KEY = 'plantao_sabado_colaboradores';

export async function loadColaboradores(): Promise<PlantaoColaborador[]> {
  try {
    return (await kvGet<PlantaoColaborador[]>(COLAB_KEY)) ?? [];
  } catch {
    return [];
  }
}
export async function saveColaboradores(list: PlantaoColaborador[]): Promise<void> {
  await kvSet(COLAB_KEY, list);
}

// ─── Dias avulsos por competência (compartilhados, ex: feriados) ──────────────
// { "2026-9": ["2026-09-07", ...] }
export type DiasExtraMap = Record<string, string[]>;

const DIAS_EXTRA_KEY = 'plantao_sabado_dias_extra';

export async function loadDiasExtra(): Promise<DiasExtraMap> {
  try {
    return (await kvGet<DiasExtraMap>(DIAS_EXTRA_KEY)) ?? {};
  } catch {
    return {};
  }
}
export async function saveDiasExtra(map: DiasExtraMap): Promise<void> {
  await kvSet(DIAS_EXTRA_KEY, map);
}

// ─── Seleção de dias por competência / colaborador ────────────────────────────
// { "2026-9": { colaboradorId: ["2026-09-06", ...] } }
export type SelecaoMap = Record<string, Record<string, string[]>>;

const SELECAO_KEY = 'plantao_sabado_selecao';

export async function loadSelecao(): Promise<SelecaoMap> {
  try {
    return (await kvGet<SelecaoMap>(SELECAO_KEY)) ?? {};
  } catch {
    return {};
  }
}
export async function saveSelecao(map: SelecaoMap): Promise<void> {
  await kvSet(SELECAO_KEY, map);
}

// ─── Título da bonificação (por competência, com herança para frente) ─────────
export type TituloMap = Record<string, string>;

const TITULO_KEY = 'plantao_sabado_titulo';

export async function loadTitulos(): Promise<TituloMap> {
  try {
    return (await kvGet<TituloMap>(TITULO_KEY)) ?? {};
  } catch {
    return {};
  }
}
export async function saveTitulos(map: TituloMap): Promise<void> {
  await kvSet(TITULO_KEY, map);
}

/** Título efetivo: último definido (explicitamente) com competência <= ano/mês. */
export function tituloEfetivo(map: TituloMap, year: number, month: number): string {
  const alvo = year * 12 + month;
  let melhor = -1;
  let titulo = '';
  for (const [pk, val] of Object.entries(map)) {
    const [y, m] = pk.split('-').map(Number);
    if (!y || !m) continue;
    const ord = y * 12 + m;
    if (ord <= alvo && ord > melhor) { melhor = ord; titulo = val; }
  }
  return titulo;
}

// ─── Lançamento (pago / assinatura) por competência ───────────────────────────
export interface PlantaoLinhaSnapshot {
  colaboradorId: string;
  nome: string;
  funcao: string;
  departamento: PlantaoDepto;
  valorPorSabado: number;
  dias: string[];
  total: number;
}

export interface PlantaoLancamento {
  pago: boolean;
  dataPagamento?: string; // "YYYY-MM-DD"
  titulo?: string;
  snapshotLinhas?: PlantaoLinhaSnapshot[];
  assinaturas?: Partial<Record<CampoAssinaturaComissao, AssinaturaDigital>>;
}

export type LancamentosMap = Record<string, PlantaoLancamento>;

const LANCAMENTOS_KEY = 'plantao_sabado_lancamentos';

export async function loadLancamentos(): Promise<LancamentosMap> {
  try {
    return (await kvGet<LancamentosMap>(LANCAMENTOS_KEY)) ?? {};
  } catch {
    return {};
  }
}
export async function saveLancamentos(map: LancamentosMap): Promise<void> {
  await kvSet(LANCAMENTOS_KEY, map);
}

// ─── Helpers de datas ─────────────────────────────────────────────────────────
/** Retorna as datas (YYYY-MM-DD) de todos os sábados de um mês (month: 1-12). */
export function sabadosDoMes(year: number, month: number): string[] {
  const out: string[] = [];
  const last = new Date(year, month, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const dt = new Date(year, month - 1, d);
    if (dt.getDay() === 6) {
      out.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }
  return out;
}

/** Formata "YYYY-MM-DD" → "DD/MM/YYYY". */
export function fmtDiaBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** True se a data ISO é um sábado. */
export function isSabado(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() === 6;
}
