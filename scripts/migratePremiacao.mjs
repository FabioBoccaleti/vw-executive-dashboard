/**
 * Migração: renomeia itens de premiação nos prestadores e lançamentos do KV.
 *
 * Renomeações:
 *   "Premiação s/ Venda de Financiamento"    → "Premiação s/ Venda de Financiamento Novos"
 *   "Premiação de Venda Serviço Despachante" → "Premiação de Venda Serviço Despachante Novos"
 *
 * Uso: node scripts/migratePremiacao.mjs
 * Requer: .env.local com KV_REST_API_URL e KV_REST_API_TOKEN
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Lê .env.local ─────────────────────────────────────────────────────────────
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

// ── Helpers Upstash REST ───────────────────────────────────────────────────────
async function upstashRaw(cmd) {
  const res = await fetch(`${KV_URL}/${cmd.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

async function kvGet(key) {
  const raw = await upstashRaw(['GET', key]);
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

async function kvSet(key, value) {
  await upstashRaw(['SET', key, JSON.stringify(value)]);
}

async function kvKeys(pattern) {
  return await upstashRaw(['KEYS', pattern]);
}

// ── Mapa de renomeações ────────────────────────────────────────────────────────
const RENAMES = {
  'Premiação s/ Venda de Financiamento':    'Premiação s/ Venda de Financiamento Novos',
  'Premiação de Venda Serviço Despachante': 'Premiação de Venda Serviço Despachante Novos',
};

function aplicarRenames(descricao) {
  return RENAMES[descricao] ?? descricao;
}

// ── 1. Migrar prestadores ──────────────────────────────────────────────────────
console.log('\n📋  Migrando prestadores (rem_pj_prestadores)...');
const prestadores = await kvGet('rem_pj_prestadores');

if (!Array.isArray(prestadores)) {
  console.log('   ⚠️  Nenhum prestador encontrado.');
} else {
  let totalItensAlterados = 0;
  const prestadoresMigrados = prestadores.map(p => {
    const itensMigrados = (p.itens ?? []).map(it => {
      const novaDescricao = aplicarRenames(it.descricao);
      if (novaDescricao !== it.descricao) {
        console.log(`   ✏️  [${p.nome}] "${it.descricao}" → "${novaDescricao}"`);
        totalItensAlterados++;
        return { ...it, descricao: novaDescricao };
      }
      return it;
    });
    return { ...p, itens: itensMigrados };
  });

  if (totalItensAlterados > 0) {
    await kvSet('rem_pj_prestadores', prestadoresMigrados);
    console.log(`   ✅  ${totalItensAlterados} item(ns) renomeado(s) em ${prestadores.length} prestador(es).`);
  } else {
    console.log('   ℹ️  Nenhum item para renomear nos prestadores.');
  }
}

// ── 2. Migrar lançamentos ──────────────────────────────────────────────────────
console.log('\n📅  Buscando lançamentos (rem_pj_lanc_*)...');
const lancKeys = await kvKeys('rem_pj_lanc_*');
console.log(`   ${lancKeys.length} lançamento(s) encontrado(s).`);

let totalLancAlterados = 0;
for (const key of lancKeys) {
  const lanc = await kvGet(key);
  if (!lanc || !Array.isArray(lanc.itens)) continue;

  let alterado = false;
  const itensMigrados = lanc.itens.map(it => {
    const novaDescricao = aplicarRenames(it.descricao);
    if (novaDescricao !== it.descricao) {
      console.log(`   ✏️  [${key}] "${it.descricao}" → "${novaDescricao}"`);
      alterado = true;
      totalLancAlterados++;
      return { ...it, descricao: novaDescricao };
    }
    return it;
  });

  if (alterado) {
    await kvSet(key, { ...lanc, itens: itensMigrados });
    console.log(`   ✅  Lançamento ${key} atualizado.`);
  }
}

if (totalLancAlterados === 0) {
  console.log('   ℹ️  Nenhum item para renomear nos lançamentos.');
}

console.log('\n🎉  Migração concluída!');
console.log(`    Itens renomeados em prestadores: ${typeof prestadores !== 'undefined' ? '(ver acima)' : 0}`);
console.log(`    Itens renomeados em lançamentos: ${totalLancAlterados}`);
