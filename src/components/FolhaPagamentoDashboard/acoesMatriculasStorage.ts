import { kvGet, kvSet } from '@/lib/kvClient';

// { "2026-9": { "NOME VENDEDOR": "12345" } }
export type AcoesMatriculasMap = Record<string, Record<string, string>>;

const KV_KEY = 'acoes_matriculas';

export async function loadAcoesMatriculas(): Promise<AcoesMatriculasMap> {
  const data = await kvGet(KV_KEY);
  return (data as AcoesMatriculasMap) ?? {};
}

export async function saveAcoesMatriculas(map: AcoesMatriculasMap): Promise<void> {
  await kvSet(KV_KEY, map);
}
