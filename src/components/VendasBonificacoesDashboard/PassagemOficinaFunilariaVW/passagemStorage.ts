/**
 * Persistência das Passagens de Oficina e Funilaria VW por ano/mês.
 * Chaveamento: passagem_oficina_funilaria_vw_{YYYY}_{MM}
 */

import { kvGet, kvSet } from '@/lib/kvClient';

export interface PassagemRow {
  nroOs: string;
  nomeDepartamento: string;
  dtaEmissao: string;
  dtaEncerramento: string;
  nomeVendedor: string;
  categoriaOs: string;
  chassi: string;
  valTotalOs: number;
  valTotalPecas: number;
  valTotalServicos: number;
  totalDesconto: number;
  valPecaExterno: number;
  valServicoExterno: number;
  valPecaInterno: number;
  valServicoInterno: number;
  valPecaGarantia: number;
  valServicoGarantia: number;
  valPecaRevisao: number;
  valServicoRevisao: number;
  descontoPeca: number;
  descontoServ: number;
}

export interface PassagemMesData {
  rows: PassagemRow[];
  fileName?: string;
  timestamp?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const key = (year: number, month: number) => `passagem_oficina_funilaria_vw_${year}_${pad(month)}`;

export async function getPassagemMes(year: number, month: number): Promise<PassagemMesData | null> {
  return kvGet<PassagemMesData>(key(year, month));
}

export async function setPassagemMes(year: number, month: number, data: PassagemMesData): Promise<boolean> {
  return kvSet(key(year, month), data);
}

// ─── Regra Ano / Chassi (de-para letra da posição 10 → ano) ──────────────────
export interface RegraAnoChassi {
  id: string;
  letra: string;  // 1 caractere A-Z (posição 10 do chassi)
  ano: number;
}

const REGRA_ANO_CHASSI_KEY = 'passagem_oficina_funilaria_vw_regra_ano_chassi';

export async function getRegrasAnoChassi(): Promise<RegraAnoChassi[]> {
  return (await kvGet<RegraAnoChassi[]>(REGRA_ANO_CHASSI_KEY)) ?? [];
}

export async function setRegrasAnoChassi(regras: RegraAnoChassi[]): Promise<boolean> {
  return kvSet(REGRA_ANO_CHASSI_KEY, regras);
}

// ─── Categoria (de-para código → categoria) ──────────────────────────────────
export interface CategoriaOS {
  id: string;
  codigo: string;  // número (código da CATEGORIA_OS)
  categoria: string;
}

const CATEGORIA_KEY = 'passagem_oficina_funilaria_vw_categoria';

export async function getCategorias(): Promise<CategoriaOS[]> {
  return (await kvGet<CategoriaOS[]>(CATEGORIA_KEY)) ?? [];
}

export async function setCategorias(categorias: CategoriaOS[]): Promise<boolean> {
  return kvSet(CATEGORIA_KEY, categorias);
}


