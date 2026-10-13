import { kvGet, kvSet } from '@/lib/kvClient';
import type { AssinaturaDigital, CampoAssinaturaComissao } from './comissoesLancamentosStorage';

export type { AssinaturaDigital, CampoAssinaturaComissao };

/** Assinaturas de um demonstrativo (vendedor em uma competência). */
export interface AssinaturasDemonstrativo {
  assinaturas?: Partial<Record<CampoAssinaturaComissao, AssinaturaDigital>>;
}

// { "2026-10": { "NOME VENDEDOR": AssinaturasDemonstrativo } }
export type AssinaturasMap = Record<string, Record<string, AssinaturasDemonstrativo>>;

const KEY = 'signdrive_comissoes_assinaturas';

export const periodoKey = (year: number, month: number): string => `${year}-${month}`;

export async function loadAssinaturas(): Promise<AssinaturasMap> {
  return (await kvGet<AssinaturasMap>(KEY)) ?? {};
}

export async function saveAssinaturasMap(map: AssinaturasMap): Promise<boolean> {
  return kvSet(KEY, map);
}

/** Grava (ou remove) a assinatura de um papel para um vendedor numa competência. */
export async function setAssinatura(
  year: number,
  month: number,
  vendedor: string,
  campo: CampoAssinaturaComissao,
  assinatura: AssinaturaDigital | null,
): Promise<AssinaturasMap> {
  const pk = periodoKey(year, month);
  const all = await loadAssinaturas();
  const atual = all[pk]?.[vendedor]?.assinaturas ?? {};
  const next = { ...atual };
  if (assinatura) next[campo] = assinatura;
  else delete next[campo];
  const map: AssinaturasMap = {
    ...all,
    [pk]: { ...(all[pk] ?? {}), [vendedor]: { assinaturas: next } },
  };
  await saveAssinaturasMap(map);
  return map;
}
