import { z } from 'zod';
import { kvCompareAndSet, kvDelete, kvGet, kvKeys, kvSet } from '@/lib/kvClient';

const CHUNK_SIZE = 120_000;

const atorSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  name: z.string().trim().min(1).optional(),
});

const snapshotSchema = z.object({
  version: z.string().min(1),
  id: z.string().uuid(),
  year: z.number().int().min(1900).max(9999),
  month: z.number().int().min(0).max(12),
  fileName: z.string().optional(),
  importedAt: z.number().int().positive(),
  importedBy: atorSchema,
  status: z.enum(['saving', 'imported', 'failed']),
  emittedAt: z.number().int().positive().optional(),
  emittedBy: atorSchema.optional(),
  chunkCount: z.number().int().positive(),
});

export type ImportActor = z.infer<typeof atorSchema>;
export type ImportSnapshot = z.infer<typeof snapshotSchema>;

function snapshotBaseKey(year: number, month: number, id: string) {
  return `fluxo_caixa_import_${year}_${String(month).padStart(2, '0')}_${id}`;
}

function metadataKey(snapshot: Pick<ImportSnapshot, 'year' | 'month' | 'id'>) {
  return `${snapshotBaseKey(snapshot.year, snapshot.month, snapshot.id)}_meta`;
}

function chunkKey(snapshot: Pick<ImportSnapshot, 'year' | 'month' | 'id'>, index: number) {
  return `${snapshotBaseKey(snapshot.year, snapshot.month, snapshot.id)}_chunk_${index}`;
}

export async function createImportSnapshot(
  rawText: string,
  year: number,
  month: number,
  fileName: string | undefined,
  importedBy: ImportActor,
): Promise<ImportSnapshot> {
  const parsedActor = atorSchema.safeParse(importedBy);
  if (!parsedActor.success) throw new Error('Não foi possível registrar quem importou o balancete.');
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || !Number.isInteger(month) || month < 0 || month > 12) {
    throw new Error('O período informado para o histórico de importação é inválido.');
  }
  if (!rawText) throw new Error('Não é possível guardar um snapshot vazio do balancete.');

  const id = crypto.randomUUID();
  const chunkCount = Math.ceil(rawText.length / CHUNK_SIZE);
  const snapshot = snapshotSchema.parse({
    version: crypto.randomUUID(),
    id,
    year,
    month,
    fileName,
    importedAt: Date.now(),
    importedBy: parsedActor.data,
    status: 'saving',
    chunkCount,
  });

  try {
    for (let index = 0; index < chunkCount; index++) {
      const saved = await kvSet(
        chunkKey(snapshot, index),
        rawText.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
      );
      if (!saved) throw new Error('Não foi possível guardar o conteúdo do snapshot de importação.');
    }

    const saved = await kvSet(metadataKey(snapshot), snapshot);
    if (!saved) throw new Error('Não foi possível registrar os metadados do snapshot de importação.');
  } catch (error) {
    const cleanupKeys = [
      ...Array.from({ length: chunkCount }, (_, index) => chunkKey(snapshot, index)),
      metadataKey(snapshot),
    ];
    const deleted = await Promise.all(cleanupKeys.map(key => kvDelete(key)));
    if (deleted.some(result => !result)) {
      throw new Error(`Não foi possível concluir o snapshot e houve falha ao limpar os dados parciais: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw error;
  }
  return snapshot;
}

async function updateSnapshot(
  snapshot: ImportSnapshot,
  update: Partial<Pick<ImportSnapshot, 'status' | 'emittedAt' | 'emittedBy'>>,
): Promise<ImportSnapshot> {
  const key = metadataKey(snapshot);
  const current = await kvGet<unknown>(key, { throwOnError: true });
  const parsed = snapshotSchema.safeParse(current);
  if (!parsed.success) throw new Error('O histórico desta importação está inválido ou indisponível.');
  const next = snapshotSchema.parse({ ...parsed.data, ...update, version: crypto.randomUUID() });
  await kvCompareAndSet(key, next, parsed.data.version);
  return next;
}

export function markImportSnapshotFailed(snapshot: ImportSnapshot) {
  return updateSnapshot(snapshot, { status: 'failed' });
}

export function markImportSnapshotImported(snapshot: ImportSnapshot) {
  return updateSnapshot(snapshot, { status: 'imported' });
}

export async function markImportSnapshotEmitted(snapshot: ImportSnapshot, emittedBy: ImportActor) {
  const parsedActor = atorSchema.safeParse(emittedBy);
  if (!parsedActor.success) throw new Error('Não foi possível registrar quem marcou o demonstrativo como emitido.');
  if (snapshot.status !== 'imported') throw new Error('Somente uma importação concluída pode ser marcada como emitida.');
  return updateSnapshot(snapshot, { emittedAt: Date.now(), emittedBy: parsedActor.data });
}

export async function loadImportSnapshots(year: number, month: number): Promise<ImportSnapshot[]> {
  const prefix = `fluxo_caixa_import_${year}_${String(month).padStart(2, '0')}_`;
  const keys = await kvKeys(`${prefix}*_meta`, { throwOnError: true });
  const documents = await Promise.all(keys.map(key => kvGet<unknown>(key, { throwOnError: true })));
  return documents.map(document => {
    const parsed = snapshotSchema.safeParse(document);
    if (!parsed.success) throw new Error('Um dos registros do histórico de importações está inválido.');
    return parsed.data;
  }).sort((a, b) => b.importedAt - a.importedAt);
}

export async function loadImportSnapshotText(snapshot: ImportSnapshot): Promise<string> {
  const values = await Promise.all(Array.from({ length: snapshot.chunkCount }, (_, index) =>
    kvGet<unknown>(chunkKey(snapshot, index), { throwOnError: true }),
  ));
  const chunks = values.map(value => {
    if (typeof value !== 'string') throw new Error('O conteúdo de uma versão do balancete está incompleto.');
    return value;
  });
  return chunks.join('');
}
