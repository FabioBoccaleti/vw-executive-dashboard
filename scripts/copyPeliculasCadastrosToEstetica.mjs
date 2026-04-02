/**
 * Copia dados de cadastro de Películas para Estética (Audi):
 *   - Alíquotas de Imposto  (por tipoImposto, case-insensitive)
 *   - DSR                   (por ano+mes)
 *   - Regras de Remuneração (por nome+cargo; cargo "Vendedor de Acessórios" → "Vendedor de Serviço de Estética")
 *   - Revendas              (por nome, case-insensitive)
 *
 * Apenas adiciona registros que ainda NÃO existem na Estética.
 *
 * Uso: node scripts/copyPeliculasCadastrosToEstetica.mjs
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
const KEYS = {
  peliculasAliquotas : 'peliculas_cadastro_aliquotas',
  esteticaAliquotas  : 'estetica_cadastro_aliquotas',
  peliculasDsr       : 'peliculas_cadastro_dsr',
  esteticaDsr        : 'estetica_cadastro_dsr',
  peliculasRegras    : 'peliculas_cadastro_regras',
  esteticaRegras     : 'estetica_cadastro_regras',
  peliculasRevendas  : 'peliculas_cadastro_revendas',
  esteticaRevendas   : 'estetica_cadastro_revendas',
};

// ── Utilitário de log ──────────────────────────────────────────────────────
function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// ── 1. Alíquotas de Imposto ────────────────────────────────────────────────
section('Alíquotas de Imposto');
const pelAliq = (await kvGet(KEYS.peliculasAliquotas)) ?? [];
const estAliq = (await kvGet(KEYS.esteticaAliquotas)) ?? [];
console.log(`   Películas: ${pelAliq.length} | Estética existente: ${estAliq.length}`);

const tiposExistentes = new Set(estAliq.map(a => a.tipoImposto.toLowerCase()));
const novosAliq = pelAliq
  .filter(a => !tiposExistentes.has(a.tipoImposto.toLowerCase()))
  .map(a => ({ ...a, id: randomUUID() }));

if (novosAliq.length === 0) {
  console.log('   ✅  Nenhuma alíquota nova — já estão todas cadastradas.');
} else {
  const okAliq = await kvSet(KEYS.esteticaAliquotas, [...estAliq, ...novosAliq]);
  novosAliq.forEach(a => console.log(`   ➕  ${a.tipoImposto} — ${a.aliquota}%`));
  console.log(`   ${okAliq ? '✅' : '❌'}  ${novosAliq.length} alíquota(s) copiada(s).`);
}

// ── 2. DSR ─────────────────────────────────────────────────────────────────
section('DSR');
const pelDsr = (await kvGet(KEYS.peliculasDsr)) ?? [];
const estDsr = (await kvGet(KEYS.esteticaDsr)) ?? [];
console.log(`   Películas: ${pelDsr.length} | Estética existente: ${estDsr.length}`);

const dsrExistentes = new Set(estDsr.map(d => `${d.ano}-${d.mes}`));
const novosDsr = pelDsr
  .filter(d => !dsrExistentes.has(`${d.ano}-${d.mes}`))
  .map(d => ({ ...d, id: randomUUID() }));

if (novosDsr.length === 0) {
  console.log('   ✅  Nenhum DSR novo — já estão todos cadastrados.');
} else {
  const okDsr = await kvSet(KEYS.esteticaDsr, [...estDsr, ...novosDsr]);
  novosDsr.forEach(d => console.log(`   ➕  ${d.ano}/${String(d.mes).padStart(2,'0')} — ${d.percentual}%`));
  console.log(`   ${okDsr ? '✅' : '❌'}  ${novosDsr.length} registro(s) de DSR copiado(s).`);
}

// ── 3. Regras de Remuneração ───────────────────────────────────────────────
section('Regras de Remuneração');
const pelRegras = (await kvGet(KEYS.peliculasRegras)) ?? [];
const estRegras = (await kvGet(KEYS.esteticaRegras)) ?? [];
console.log(`   Películas: ${pelRegras.length} | Estética existente: ${estRegras.length}`);

// Mapeia "Vendedor de Acessórios" → "Vendedor de Serviço de Estética"
function mapCargo(cargo) {
  return cargo === 'Vendedor de Acessórios' ? 'Vendedor de Serviço de Estética' : cargo;
}

const regrasExistentes = new Set(estRegras.map(r => `${r.nome?.toLowerCase()}|${r.cargo?.toLowerCase()}`));
const novosRegras = pelRegras
  .map(r => ({ ...r, id: randomUUID(), cargo: mapCargo(r.cargo) }))
  .filter(r => !regrasExistentes.has(`${r.nome?.toLowerCase()}|${r.cargo?.toLowerCase()}`));

if (novosRegras.length === 0) {
  console.log('   ✅  Nenhuma regra nova — já estão todas cadastradas.');
} else {
  const okRegras = await kvSet(KEYS.esteticaRegras, [...estRegras, ...novosRegras]);
  novosRegras.forEach(r => console.log(`   ➕  ${r.nome} (${r.cargo})`));
  console.log(`   ${okRegras ? '✅' : '❌'}  ${novosRegras.length} regra(s) copiada(s).`);
}

// ── 4. Revendas ────────────────────────────────────────────────────────────
section('Revendas');
const pelRevendas = (await kvGet(KEYS.peliculasRevendas)) ?? [];
const estRevendas = (await kvGet(KEYS.esteticaRevendas)) ?? [];
console.log(`   Películas: ${pelRevendas.length} | Estética existente: ${estRevendas.length}`);

const revendasExistentes = new Set(estRevendas.map(r => r.nome?.toLowerCase()));
const novosRevendas = pelRevendas
  .filter(r => !revendasExistentes.has(r.nome?.toLowerCase()))
  .map(r => ({ ...r, id: randomUUID() }));

if (novosRevendas.length === 0) {
  console.log('   ✅  Nenhuma revenda nova — já estão todas cadastradas.');
} else {
  const okRevendas = await kvSet(KEYS.esteticaRevendas, [...estRevendas, ...novosRevendas]);
  novosRevendas.forEach(r => console.log(`   ➕  ${r.nome}`));
  console.log(`   ${okRevendas ? '✅' : '❌'}  ${novosRevendas.length} revenda(s) copiada(s).`);
}

console.log('\n✅  Migração concluída!\n');
