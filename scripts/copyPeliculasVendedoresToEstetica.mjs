/**
 * Copia os vendedores de Películas para a lista de vendedores de Estética (Audi).
 * Apenas adiciona os que ainda NÃO existem (pelo nome, case-insensitive).
 * Vendedores com cargo "Vendedor de Acessórios" são copiados como "Vendedor".
 *
 * Uso: node scripts/copyPeliculasVendedoresToEstetica.mjs
 * Requer: .env.local com KV_REST_API_URL e KV_REST_API_TOKEN
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Lê .env.local ──────────────────────────────────────────────────────────
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

// ── Helpers Upstash REST ───────────────────────────────────────────────────
async function kvGet(key) {
  const res = await fetch(`${KV_URL}/${['GET', key].map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  if (!json.result) return null;
  return typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
}

async function kvSet(key, value) {
  const res = await fetch(`${KV_URL}/${['SET', key, JSON.stringify(value)].map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result === 'OK';
}

// ── Chaves ─────────────────────────────────────────────────────────────────
const KEY_PELICULAS   = 'peliculas_cadastro_vendedores';
const KEY_ESTETICA    = 'estetica_cadastro_vendedores';

// ── Migração ───────────────────────────────────────────────────────────────
console.log('🔍  Lendo vendedores de Películas...');
const peliculas = (await kvGet(KEY_PELICULAS)) ?? [];
console.log(`   ${peliculas.length} vendedor(es) encontrado(s) em Películas.`);

console.log('🔍  Lendo vendedores de Estética...');
const estetica = (await kvGet(KEY_ESTETICA)) ?? [];
console.log(`   ${estetica.length} vendedor(es) já cadastrado(s) em Estética.`);

const nomesExistentes = new Set(estetica.map(v => v.nome.toLowerCase()));

const novos = peliculas
  .filter(v => !nomesExistentes.has(v.nome.toLowerCase()))
  .map(v => ({
    id: randomUUID(),
    ...(v.codigo ? { codigo: v.codigo } : {}),
    nome: v.nome,
    cargo: v.cargo === 'Vendedor de Acessórios' ? 'Vendedor' : v.cargo,
  }));

if (novos.length === 0) {
  console.log('\n✅  Nenhum vendedor novo para copiar — todos já existem em Estética.');
  process.exit(0);
}

console.log(`\n➕  Copiando ${novos.length} vendedor(es):`);
novos.forEach(v => console.log(`   • ${v.nome} (${v.cargo})`));

const updated = [...estetica, ...novos].sort((a, b) =>
  a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
);

const ok = await kvSet(KEY_ESTETICA, updated);
if (ok) {
  console.log(`\n✅  ${novos.length} vendedor(es) copiado(s) com sucesso para Estética!`);
} else {
  console.error('\n❌  Falha ao salvar no Redis.');
  process.exit(1);
}
