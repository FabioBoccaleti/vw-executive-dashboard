/**
 * Dump completo do Redis (produção) para um arquivo JSON.
 * Uso: node scripts/dumpRedisToJson.mjs
 * Requer: .env.local com KV_REST_API_URL e KV_REST_API_TOKEN
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Lê .env.local manualmente ──────────────────────────────────────────────
const envPath = resolve(__dirname, '../.env.local');
const envLines = readFileSync(envPath, 'utf-8').split('\n');
const env = {};
for (const line of envLines) {
  const m = line.match(/^([^=]+)="?([^"]*)"?/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const KV_URL   = env['KV_REST_API_URL'];
const KV_TOKEN = env['KV_REST_API_TOKEN'];

if (!KV_URL || !KV_TOKEN) {
  console.error('❌  KV_REST_API_URL ou KV_REST_API_TOKEN não encontrados em .env.local');
  process.exit(1);
}

// ── Helpers HTTP para Upstash REST API ────────────────────────────────────
async function upstash(cmd) {
  const res = await fetch(`${KV_URL}/${cmd.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

// ── Dump ──────────────────────────────────────────────────────────────────
console.log('🔍  Buscando todas as chaves...');
const keys = await upstash(['KEYS', '*']);
console.log(`📦  ${keys.length} chave(s) encontrada(s).`);

const snapshot = {};
for (const key of keys) {
  const type = await upstash(['TYPE', key]);

  if (type === 'string') {
    const raw = await upstash(['GET', key]);
    try { snapshot[key] = JSON.parse(raw); } catch { snapshot[key] = raw; }
  } else if (type === 'list') {
    const items = await upstash(['LRANGE', key, '0', '-1']);
    snapshot[key] = items.map(i => { try { return JSON.parse(i); } catch { return i; } });
  } else if (type === 'hash') {
    const pairs = await upstash(['HGETALL', key]);
    const obj = {};
    for (let i = 0; i < pairs.length; i += 2) {
      try { obj[pairs[i]] = JSON.parse(pairs[i + 1]); } catch { obj[pairs[i]] = pairs[i + 1]; }
    }
    snapshot[key] = obj;
  } else {
    snapshot[key] = `[tipo não suportado: ${type}]`;
  }
  process.stdout.write(`  ✓ ${key}\n`);
}

const outPath = resolve(__dirname, '../scripts/redis-snapshot.json');
writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf-8');
console.log(`\n✅  Snapshot salvo em: scripts/redis-snapshot.json`);
console.log(`    Total de chaves: ${keys.length}`);
