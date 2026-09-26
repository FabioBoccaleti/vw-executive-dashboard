import { kvGet, kvSet } from '@/lib/kvClient';
import type { CampoAssinaturaComissao, AssinaturaDigital } from './comissoesLancamentosStorage';
import {
  type PlantaoDepto as PesquisaDepto,
  DEPTO_LABELS, DEPTOS, tituloEfetivo,
  type TituloMap,
} from './plantaoSabadoStorage';

export type { PesquisaDepto };
export { DEPTO_LABELS, DEPTOS, tituloEfetivo };
export type PesquisaTituloMap = TituloMap;

// ─── Colaboradores (cadastro próprio do Pesquisa CEM) ─────────────────────────
export interface PesquisaColaborador {
  id: string;
  nome: string;
  funcao: string;
  valorPorPesquisa: number;
  departamento: PesquisaDepto;
  ativo: boolean;
  ordem?: number;
}

const COLAB_KEY = 'pesquisa_cem_colaboradores';

export async function loadColaboradores(): Promise<PesquisaColaborador[]> {
  try {
    return (await kvGet<PesquisaColaborador[]>(COLAB_KEY)) ?? [];
  } catch {
    return [];
  }
}
export async function saveColaboradores(list: PesquisaColaborador[]): Promise<void> {
  await kvSet(COLAB_KEY, list);
}

// ─── Respostas por competência / colaborador (nº de pesquisas respondidas) ────
// { "2026-9": { colaboradorId: 12 } }
export type RespostasMap = Record<string, Record<string, number>>;

const RESPOSTAS_KEY = 'pesquisa_cem_respostas';

export async function loadRespostas(): Promise<RespostasMap> {
  try {
    return (await kvGet<RespostasMap>(RESPOSTAS_KEY)) ?? {};
  } catch {
    return {};
  }
}
export async function saveRespostas(map: RespostasMap): Promise<void> {
  await kvSet(RESPOSTAS_KEY, map);
}

// ─── Título da bonificação (por competência, com herança para frente) ─────────
const TITULO_KEY = 'pesquisa_cem_titulo';

export async function loadTitulos(): Promise<PesquisaTituloMap> {
  try {
    return (await kvGet<PesquisaTituloMap>(TITULO_KEY)) ?? {};
  } catch {
    return {};
  }
}
export async function saveTitulos(map: PesquisaTituloMap): Promise<void> {
  await kvSet(TITULO_KEY, map);
}

// ─── Lançamento (pago / assinatura) por competência ───────────────────────────
export interface PesquisaLinhaSnapshot {
  colaboradorId: string;
  nome: string;
  funcao: string;
  departamento: PesquisaDepto;
  valorPorPesquisa: number;
  qtd: number;
  total: number;
}

export interface PesquisaLancamento {
  pago: boolean;
  dataPagamento?: string; // "YYYY-MM-DD"
  titulo?: string;
  snapshotLinhas?: PesquisaLinhaSnapshot[];
  assinaturas?: Partial<Record<CampoAssinaturaComissao, AssinaturaDigital>>;
}

export type LancamentosMap = Record<string, PesquisaLancamento>;

const LANCAMENTOS_KEY = 'pesquisa_cem_lancamentos';

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
