import { beforeEach, describe, expect, it, vi } from 'vitest';

const kv = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  failedChunk: null as string | null,
}));

vi.mock('@/lib/kvClient', () => ({
  kvSet: vi.fn(async (key: string, value: unknown) => {
    if (kv.failedChunk && key.endsWith(kv.failedChunk)) return false;
    kv.values.set(key, value);
    return true;
  }),
  kvGet: vi.fn(async (key: string) => kv.values.get(key) ?? null),
  kvDelete: vi.fn(async (key: string) => {
    kv.values.delete(key);
    return true;
  }),
  kvKeys: vi.fn(async (pattern: string) => {
    const [prefix, suffix] = pattern.split('*');
    return [...kv.values.keys()].filter(key => key.startsWith(prefix) && key.endsWith(suffix));
  }),
  kvCompareAndSet: vi.fn(async (key: string, value: { version: string }, expectedVersion: string | null) => {
    const current = kv.values.get(key) as { version?: string } | undefined;
    if (expectedVersion === null ? current !== undefined : current?.version !== expectedVersion) {
      throw new Error('version conflict');
    }
    kv.values.set(key, value);
  }),
}));

import {
  createImportSnapshot,
  loadImportSnapshots,
  loadImportSnapshotText,
  markImportSnapshotEmitted,
  markImportSnapshotImported,
} from '@/components/FluxoCaixaDashboard/importHistoryStorage';
import { saveFluxoCaixaData } from '@/components/FluxoCaixaDashboard/fluxoCaixaStorage';

const actor = { userId: 'user-1', username: 'fabio', name: 'Fabio' };

describe('importHistoryStorage', () => {
  beforeEach(() => {
    kv.values.clear();
    kv.failedChunk = null;
  });

  it('grava chunks e acompanha a importação até ser marcada como emitida', async () => {
    const rawText = 'a'.repeat(120_001);
    const snapshot = await createImportSnapshot(rawText, 2026, 1, 'balancete.csv', actor);
    const imported = await markImportSnapshotImported(snapshot);
    const emitted = await markImportSnapshotEmitted(imported, actor);

    await expect(loadImportSnapshotText(emitted)).resolves.toBe(rawText);
    await expect(loadImportSnapshots(2026, 1)).resolves.toEqual([emitted]);
    expect(emitted.status).toBe('imported');
    expect(emitted.emittedBy).toEqual(actor);
    expect(emitted.emittedAt).toBeGreaterThan(0);
  });

  it('cria um snapshot concluído junto com a gravação do balancete atual', async () => {
    const rawText = 'A;1.1.1.01;Caixa;0,00;0,00;10,00;-10,00';

    await expect(saveFluxoCaixaData(rawText, 'balancete.csv', 2026, 1, actor)).resolves.toBe(true);

    const snapshots = await loadImportSnapshots(2026, 1);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].status).toBe('imported');
    expect(kv.values.get('fluxo_caixa_2026_01')).toEqual({
      rawText,
      fileName: 'balancete.csv',
      timestamp: snapshots[0].importedAt,
      snapshotId: snapshots[0].id,
    });
  });

  it('limpa chunks parciais quando a gravação falha', async () => {
    kv.failedChunk = '_chunk_1';

    await expect(createImportSnapshot('a'.repeat(120_001), 2026, 1, 'balancete.csv', actor))
      .rejects.toThrow('Não foi possível guardar o conteúdo do snapshot');
    expect(kv.values.size).toBe(0);
  });
});
