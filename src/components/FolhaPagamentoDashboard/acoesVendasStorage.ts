import { kvGet, kvSet } from '@/lib/kvClient';
import type { VendasResultadoRow } from '@/components/VendasBonificacoesDashboard/vendasResultadoStorage';
import type { CampoAssinaturaComissao, AssinaturaDigital } from './comissoesLancamentosStorage';

export type AcaoTab = 'novos' | 'usados';

// ─── Prêmios por chassi ────────────────────────────────────────────────────────
// Estrutura: { "2026-9": { rowKey: premio } } — presença da rowKey = chassi selecionado
export type PremioMap = Record<string, Record<string, number>>;

const PREMIOS_KEYS: Record<AcaoTab, string> = {
  novos:  'acoes_vendas_premios_novos',
  usados: 'acoes_vendas_premios_usados',
};

export async function loadPremios(tab: AcaoTab): Promise<PremioMap> {
  try {
    return (await kvGet<PremioMap>(PREMIOS_KEYS[tab])) ?? {};
  } catch {
    return {};
  }
}

export async function savePremios(tab: AcaoTab, map: PremioMap): Promise<void> {
  await kvSet(PREMIOS_KEYS[tab], map);
}

// ─── Lançamentos (pago / assinatura) — compartilhados por vendedor ─────────────
export interface AcaoItemSnapshot {
  tab: AcaoTab;
  row: VendasResultadoRow;
  premio: number;
}

export interface AcaoLancamento {
  pago: boolean;
  dataPagamento?: string; // "YYYY-MM-DD"
  snapshotItens?: AcaoItemSnapshot[];
  assinaturas?: Partial<Record<CampoAssinaturaComissao, AssinaturaDigital>>;
}

// Estrutura: { "2026-9": { "VENDEDOR": AcaoLancamento } }
export type AcaoLancamentosMap = Record<string, Record<string, AcaoLancamento>>;

const LANCAMENTOS_KEY = 'acoes_vendas_lancamentos';

export async function loadAcaoLancamentos(): Promise<AcaoLancamentosMap> {
  try {
    return (await kvGet<AcaoLancamentosMap>(LANCAMENTOS_KEY)) ?? {};
  } catch {
    return {};
  }
}

export async function saveAcaoLancamentos(map: AcaoLancamentosMap): Promise<void> {
  await kvSet(LANCAMENTOS_KEY, map);
}

// ─── Configuração da ação (nome) por competência ──────────────────────────────
export type AcaoConfigMap = Record<string, { nome: string }>;

const CONFIG_KEY = 'acoes_vendas_config';

export async function loadAcaoConfig(): Promise<AcaoConfigMap> {
  try {
    return (await kvGet<AcaoConfigMap>(CONFIG_KEY)) ?? {};
  } catch {
    return {};
  }
}

export async function saveAcaoConfig(map: AcaoConfigMap): Promise<void> {
  await kvSet(CONFIG_KEY, map);
}
