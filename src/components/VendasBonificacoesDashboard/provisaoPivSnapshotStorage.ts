import { kvGet, kvSet } from '@/lib/kvClient';

const SNAPSHOT_KEY = 'provisao_piv_snapshot';

// SHA-256("1985") – armazenado como hash; a senha não aparece em texto plano no código.
const UNLOCK_HASH = '78e370b587b145920213731b7c7c725e512b3b6577c51c800218a7c764c532ae';

export interface SnapshotRow {
  id: string;
  modelo: string;
  chassi: string;
  date: string;
  piv: number;
  siq: number;
  total: number;
  recebidoPiv: number | null;
  recebidoSiq: number | null;
  mesRecebimento: string | null;
  diferenca: number | null;
}

export interface SnapshotResumoItem {
  modelo: string;
  piv: number;
  siq: number;
  total: number;
  bonusVarejo: number;
}

export interface ProvisaoPivSnapshot {
  lockedAt: string;
  periodoLabel: string;
  totalPiv: number;
  totalSiq: number;
  totalGeral: number;
  pctInput: string;
  pctOficina: number;
  pctNovos: number;
  valorOficina: number;
  valorNovos: number;
  countPiv: number;
  countSiq: number;
  filteredCount: number;
  rowsWithBonus: SnapshotRow[];
  resumoPorModelo: SnapshotResumoItem[];
  detalheRecebidoTotais: {
    recebidoPiv: number;
    recebidoSiq: number;
    diferenca: number | null;
    hasRecebido: boolean;
    mesRecebimentoResumo: string | null;
  };
}

type SnapshotStore = Record<string, ProvisaoPivSnapshot>;

export async function loadSnapshotStore(): Promise<SnapshotStore> {
  const raw = await kvGet(SNAPSHOT_KEY);
  return (raw as SnapshotStore | null) ?? {};
}

export async function saveSnapshotForPeriod(
  pk: string,
  snapshot: ProvisaoPivSnapshot,
): Promise<void> {
  const store = await loadSnapshotStore();
  store[pk] = snapshot;
  await kvSet(SNAPSHOT_KEY, store);
}

export async function deleteSnapshotForPeriod(pk: string): Promise<void> {
  const store = await loadSnapshotStore();
  delete store[pk];
  await kvSet(SNAPSHOT_KEY, store);
}

export async function verifyUnlockPassword(input: string): Promise<boolean> {
  try {
    const encoded = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return hashHex === UNLOCK_HASH;
  } catch {
    return false;
  }
}
