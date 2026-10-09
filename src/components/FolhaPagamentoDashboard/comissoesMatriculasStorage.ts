import { kvGet, kvSet } from '@/lib/kvClient';

// { "2026-9": { "NOME VENDEDOR": "12345" } }
export type MatriculasMap = Record<string, Record<string, string>>;

const KV_KEY = 'comissoes_matriculas';

export async function loadMatriculas(): Promise<MatriculasMap> {
  const data = await kvGet(KV_KEY);
  return (data as MatriculasMap) ?? {};
}

export async function saveMatriculas(map: MatriculasMap): Promise<void> {
  await kvSet(KV_KEY, map);
}
