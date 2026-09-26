import { kvGet, kvSet } from '@/lib/kvClient';
import type { CampoAssinaturaComissao, AssinaturaDigital } from './comissoesLancamentosStorage';
import {
  type PlantaoDepto as DiversosDepto,
  DEPTO_LABELS, DEPTOS, tituloEfetivo,
  type TituloMap,
} from './plantaoSabadoStorage';

export type { DiversosDepto };
export { DEPTO_LABELS, DEPTOS, tituloEfetivo };
export type DiversosTituloMap = TituloMap;

// ─── Colaboradores (cadastro próprio: apenas nome e função) ───────────────────
export interface DiversosColaborador {
  id: string;
  nome: string;
  funcao: string;
  ativo: boolean;
  ordem?: number;
}

const COLAB_KEY = 'diversos_colaboradores';

export async function loadColaboradores(): Promise<DiversosColaborador[]> {
  try {
    return (await kvGet<DiversosColaborador[]>(COLAB_KEY)) ?? [];
  } catch {
    return [];
  }
}
export async function saveColaboradores(list: DiversosColaborador[]): Promise<void> {
  await kvSet(COLAB_KEY, list);
}

// ─── Premiações por competência / colaborador ─────────────────────────────────
// { "2026-9": { colaboradorId: { motivo, departamento, valor } } }
export interface PremiacaoEntry {
  motivo: string;
  departamento: DiversosDepto;
  valor: number;
}
export type PremiacoesMap = Record<string, Record<string, PremiacaoEntry>>;

const PREMIACOES_KEY = 'diversos_premiacoes';

export async function loadPremiacoes(): Promise<PremiacoesMap> {
  try {
    return (await kvGet<PremiacoesMap>(PREMIACOES_KEY)) ?? {};
  } catch {
    return {};
  }
}
export async function savePremiacoes(map: PremiacoesMap): Promise<void> {
  await kvSet(PREMIACOES_KEY, map);
}

// ─── Título da bonificação (por competência, com herança para frente) ─────────
const TITULO_KEY = 'diversos_titulo';

export async function loadTitulos(): Promise<DiversosTituloMap> {
  try {
    return (await kvGet<DiversosTituloMap>(TITULO_KEY)) ?? {};
  } catch {
    return {};
  }
}
export async function saveTitulos(map: DiversosTituloMap): Promise<void> {
  await kvSet(TITULO_KEY, map);
}

// ─── Lançamento (pago / assinatura) por competência ───────────────────────────
export interface DiversosLinhaSnapshot {
  colaboradorId: string;
  nome: string;
  funcao: string;
  motivo: string;
  departamento: DiversosDepto;
  valor: number;
}

export interface DiversosLancamento {
  pago: boolean;
  dataPagamento?: string; // "YYYY-MM-DD"
  titulo?: string;
  snapshotLinhas?: DiversosLinhaSnapshot[];
  assinaturas?: Partial<Record<CampoAssinaturaComissao, AssinaturaDigital>>;
}

export type LancamentosMap = Record<string, DiversosLancamento>;

const LANCAMENTOS_KEY = 'diversos_lancamentos';

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
