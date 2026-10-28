import { kvGet, kvSet } from '@/lib/kvClient';
import type { ControleVeiculosBrand } from './controleVeiculosStorage';

export type GarantiaBanco = 'itau' | 'volks';

export const GARANTIA_BANCO_LABEL: Record<GarantiaBanco, string> = {
  itau: 'Banco Itau',
  volks: 'Banco Volks',
};

export interface VeiculoGarantiaEntry {
  /** Identidade estável da linha (linha inteira). */
  id: string;
  /** Marca de origem do veículo (VW/Audi). */
  brand: ControleVeiculosBrand;
  /** Linha inteira do arquivo importado (header -> valor). */
  record: Record<string, string>;
  /** Valor da garantia informado pelo usuário. */
  valorGarantia: number;
  /** Data de inclusão (ISO 'YYYY-MM-DD'). */
  dataInclusao: string;
  /** Dias de vencimento vigentes no momento da inclusão (congelado). */
  diasVencimento?: number | null;
  /** Linha de crédito (DN) escolhida — exclusivo do Banco Volks. */
  linhaCreditoDN?: string;
  /** Momento em que foi incluído (timestamp ISO). */
  includedAt: string;
}

const keyFor = (banco: GarantiaBanco) => `estoque-usados-veiculos-garantia:${banco}`;

export async function listGarantia(banco: GarantiaBanco): Promise<VeiculoGarantiaEntry[]> {
  return (await kvGet<VeiculoGarantiaEntry[]>(keyFor(banco))) ?? [];
}

export async function addGarantia(banco: GarantiaBanco, entry: VeiculoGarantiaEntry): Promise<boolean> {
  const list = await listGarantia(banco);
  const filtered = list.filter(e => e.id !== entry.id);
  filtered.push(entry);
  return kvSet(keyFor(banco), filtered);
}

export async function removeGarantia(banco: GarantiaBanco, id: string): Promise<boolean> {
  const list = await listGarantia(banco);
  return kvSet(keyFor(banco), list.filter(e => e.id !== id));
}

/** Atualiza (cadastra/muda) a linha de crédito (DN) de um veículo em garantia. */
export async function updateGarantiaDN(banco: GarantiaBanco, id: string, dn: string): Promise<boolean> {
  const list = await listGarantia(banco);
  return kvSet(keyFor(banco), list.map(e => (e.id === id ? { ...e, linhaCreditoDN: dn } : e)));
}

// ─── Histórico de movimentação (veículos pagos) ───────────────────────────────

export interface VeiculoHistoricoEntry extends VeiculoGarantiaEntry {
  /** Data de pagamento (ISO 'YYYY-MM-DD'). */
  dataPagamento: string;
}

const historicoKeyFor = (banco: GarantiaBanco) => `estoque-usados-veiculos-historico:${banco}`;

export async function listHistorico(banco: GarantiaBanco): Promise<VeiculoHistoricoEntry[]> {
  return (await kvGet<VeiculoHistoricoEntry[]>(historicoKeyFor(banco))) ?? [];
}

export async function addHistorico(banco: GarantiaBanco, entry: VeiculoHistoricoEntry): Promise<boolean> {
  const list = await listHistorico(banco);
  const filtered = list.filter(e => e.id !== entry.id);
  filtered.push(entry);
  return kvSet(historicoKeyFor(banco), filtered);
}

export async function removeHistorico(banco: GarantiaBanco, id: string): Promise<boolean> {
  const list = await listHistorico(banco);
  return kvSet(historicoKeyFor(banco), list.filter(e => e.id !== id));
}

/** Atualiza (cadastra/muda) a linha de crédito (DN) de um veículo no histórico. */
export async function updateHistoricoDN(banco: GarantiaBanco, id: string, dn: string): Promise<boolean> {
  const list = await listHistorico(banco);
  return kvSet(historicoKeyFor(banco), list.map(e => (e.id === id ? { ...e, linhaCreditoDN: dn } : e)));
}
