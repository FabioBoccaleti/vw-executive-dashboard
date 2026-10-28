import { kvGet, kvSet } from '@/lib/kvClient';

export interface ControleVeiculosLimites {
  /** Limite da linha de crédito — Banco Itau (único). */
  limiteItau: number | null;
  /** Se a provisão de juros abate no saldo — Banco Itau. */
  abaterJurosItau: boolean;
  /** Limite por linha de crédito (DN) — Banco Volks. Chave = DN. */
  limitesVolksPorDN: Record<string, number>;
  /** Se a provisão de juros abate no saldo, por DN — Banco Volks. Chave = DN. */
  abaterJurosVolksPorDN: Record<string, boolean>;
}

const KEY = 'estoque-usados-controle-veiculos-limites';

/** Padrão do "abater juros no saldo" quando um banco/DN ainda não foi configurado. */
export const ABATER_JUROS_DEFAULT = true;

export const EMPTY_LIMITES: ControleVeiculosLimites = {
  limiteItau: null,
  abaterJurosItau: ABATER_JUROS_DEFAULT,
  limitesVolksPorDN: {},
  abaterJurosVolksPorDN: {},
};

export async function getLimites(): Promise<ControleVeiculosLimites> {
  const loaded = await kvGet<Partial<ControleVeiculosLimites>>(KEY);
  return {
    ...EMPTY_LIMITES,
    ...(loaded ?? {}),
    abaterJurosItau: loaded?.abaterJurosItau ?? ABATER_JUROS_DEFAULT,
    limitesVolksPorDN: { ...EMPTY_LIMITES.limitesVolksPorDN, ...(loaded?.limitesVolksPorDN ?? {}) },
    abaterJurosVolksPorDN: { ...EMPTY_LIMITES.abaterJurosVolksPorDN, ...(loaded?.abaterJurosVolksPorDN ?? {}) },
  };
}

export async function setLimites(limites: ControleVeiculosLimites): Promise<boolean> {
  return kvSet(KEY, limites);
}
