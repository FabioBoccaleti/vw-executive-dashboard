/**
 * Gera um script JS inline para colar no DevTools do browser.
 * Ele carrega o snapshot do Redis e grava tudo no localStorage (formato __kv__<key>).
 *
 * Uso:
 *   node scripts/generateLocalStorageImport.mjs
 *   → Copie o conteúdo de scripts/import-to-localstorage.js e cole no console do browser.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const snapshotPath = resolve(__dirname, 'redis-snapshot.json');
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'));

const entries = Object.entries(snapshot);

// Gera o script JS que será colado no browser console
const lines = [
  '(function() {',
  `  const data = ${JSON.stringify(snapshot, null, 2)};`,
  '  let count = 0;',
  '  for (const [key, value] of Object.entries(data)) {',
  '    try {',
  '      localStorage.setItem("__kv__" + key, JSON.stringify(value));',
  '      count++;',
  '    } catch(e) {',
  '      console.warn("Erro ao gravar chave:", key, e);',
  '    }',
  '  }',
  `  console.log("✅ " + count + " de ${entries.length} chaves importadas para localStorage.");`,
  '})();',
];

const outPath = resolve(__dirname, 'import-to-localstorage.js');
writeFileSync(outPath, lines.join('\n'), 'utf-8');

console.log(`✅  Script gerado: scripts/import-to-localstorage.js`);
console.log(`    ${entries.length} chaves prontas para importar.`);
console.log('');
console.log('📋  Próximo passo:');
console.log('    1. Abra http://localhost:5001 (ou a porta do dev server)');
console.log('    2. Abra o DevTools (F12) → aba Console');
console.log('    3. Cole o conteúdo do arquivo scripts/import-to-localstorage.js');
console.log('    4. Pressione Enter');
console.log('    5. Recarregue a página — os dados estarão disponíveis');
