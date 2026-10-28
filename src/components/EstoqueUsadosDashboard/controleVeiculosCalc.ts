/** Funções de cálculo compartilhadas do Controle de Veículos (datas e juros). */

import { ABATER_JUROS_DEFAULT, type ControleVeiculosLimites } from './controleVeiculosLimitesStorage';
import type { ControleVeiculosRegras } from './controleVeiculosRegrasStorage';
import type { VeiculoGarantiaEntry } from './veiculosGarantiaStorage';

/** Data de hoje em ISO 'YYYY-MM-DD' (horário local). */
export function todayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** Soma dias a uma data ISO 'YYYY-MM-DD' e retorna outra data ISO. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Diferença em dias entre duas datas ISO 'YYYY-MM-DD' (toISO - fromISO). */
export function diffDaysISO(fromISO: string, toISO: string): number | null {
  if (!fromISO || !toISO) return null;
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const [ty, tm, td] = toISO.split('-').map(Number);
  const from = new Date(fy, (fm ?? 1) - 1, fd ?? 1);
  const to = new Date(ty, (tm ?? 1) - 1, td ?? 1);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/** Estimativa de juros simples: valor × (taxa%/100) × (dias/30). */
export function estimativaJuros(valor: number, taxaPct: number | null, dias: number | null): number | null {
  if (taxaPct == null || dias == null) return null;
  return valor * (taxaPct / 100) * (dias / 30);
}

/** Soma o valor de garantia e a provisão de juros de uma lista de veículos. */
export function somarTotais(
  entries: VeiculoGarantiaEntry[],
  taxaPct: number | null,
): { utilizado: number; juros: number } {
  let utilizado = 0;
  let juros = 0;
  entries.forEach(entry => {
    utilizado += entry.valorGarantia;
    const dias = diffDaysISO(entry.dataInclusao, todayISO());
    const j = estimativaJuros(entry.valorGarantia, taxaPct, dias);
    if (j != null) juros += j;
  });
  return { utilizado, juros };
}

/** Saldo disponível = Limite − Utilizado − (abater ? Juros : 0). */
export function calcSaldo(limite: number | null, utilizado: number, juros: number, abater: boolean): number {
  return (limite ?? 0) - utilizado - (abater ? juros : 0);
}

export interface SaldoInfo {
  limite: number | null;
  utilizado: number;
  juros: number;
  abater: boolean;
  saldo: number;
}

/** Calcula o saldo disponível do Banco Itaú a partir dos limites cadastrados e da garantia. */
export function computeSaldoItau(
  limites: ControleVeiculosLimites,
  garantiaItau: VeiculoGarantiaEntry[],
  regras: ControleVeiculosRegras,
): SaldoInfo {
  const { utilizado, juros } = somarTotais(garantiaItau, regras.taxaJurosItau);
  const limite = limites.limiteItau;
  const abater = limites.abaterJurosItau;
  return { limite, utilizado, juros, abater, saldo: calcSaldo(limite, utilizado, juros, abater) };
}

/** Calcula o saldo disponível por DN do Banco Volks. */
export function computeSaldoVolksPorDN(
  limites: ControleVeiculosLimites,
  garantiaVolks: VeiculoGarantiaEntry[],
  regras: ControleVeiculosRegras,
): (SaldoInfo & { dn: string })[] {
  return regras.linhasCreditoDNVolks.map(dn => {
    const entries = garantiaVolks.filter(e => e.linhaCreditoDN === dn);
    const { utilizado, juros } = somarTotais(entries, regras.taxaJurosVolks);
    const limite = limites.limitesVolksPorDN[dn] ?? null;
    const abater = limites.abaterJurosVolksPorDN[dn] ?? ABATER_JUROS_DEFAULT;
    return { dn, limite, utilizado, juros, abater, saldo: calcSaldo(limite, utilizado, juros, abater) };
  });
}
