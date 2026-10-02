/**
 * Persistência das Passagens de Oficina e Funilaria VW por ano/mês.
 * Chaveamento: passagem_oficina_funilaria_vw_{YYYY}_{MM}
 */

import { kvGet, kvSet } from '@/lib/kvClient';

export interface PassagemRow {
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
