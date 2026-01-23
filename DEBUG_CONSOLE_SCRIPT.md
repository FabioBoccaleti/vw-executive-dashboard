# 🔬 Script de Debug - Verificar Persistência

Cole este script no console do navegador (F12) para diagnosticar o problema:

```javascript
// ============================================
// SCRIPT DE DEBUG - PERSISTÊNCIA DE DADOS
// ============================================

console.clear()
console.log('🔬 === DIAGNÓSTICO DE PERSISTÊNCIA ===\n')

// 1. Verificar todas as chaves VW no localStorage
const vwKeys = Object.keys(localStorage).filter(k => k.startsWith('vw_'))
console.log(`📦 Total de chaves VW: ${vwKeys.length}`)
console.log('Chaves encontradas:', vwKeys)
console.log('')

// 2. Verificar especificamente DRE 2025 Usados
const dre2025Key = 'vw_dre_2025_usados'
const dre2025Exists = localStorage.getItem(dre2025Key) !== null
console.log(`🔍 ${dre2025Key}: ${dre2025Exists ? '✅ EXISTE' : '❌ NÃO EXISTE'}`)

if (dre2025Exists) {
  const dre2025 = JSON.parse(localStorage.getItem(dre2025Key))
  console.log(`  - Total de linhas: ${dre2025.length}`)
  console.log(`  - Primeira linha:`, dre2025[0])
  console.log(`  - Segunda linha:`, dre2025[1])
}
console.log('')

// 3. Verificar métricas 2025 Usados
const metrics2025Key = 'vw_metrics_2025_usados'
const metrics2025Exists = localStorage.getItem(metrics2025Key) !== null
console.log(`🔍 ${metrics2025Key}: ${metrics2025Exists ? '✅ EXISTE' : '❌ NÃO EXISTE'}`)

if (metrics2025Exists) {
  const metrics2025 = JSON.parse(localStorage.getItem(metrics2025Key))
  console.log(`  - Vendas Novos (primeiro mês):`, metrics2025.vendasNovos?.vendas?.[0])
}
console.log('')

// 4. Verificar configurações
const selectedYear = localStorage.getItem('vw_selected_fiscal_year')
const selectedDept = localStorage.getItem('vw_selected_department')
console.log(`⚙️ Ano selecionado: ${selectedYear || 'NÃO DEFINIDO'}`)
console.log(`⚙️ Departamento selecionado: ${selectedDept || 'NÃO DEFINIDO'}`)
console.log('')

// 5. Resumo
console.log('📊 === RESUMO ===')
console.log(`Total de dados salvos: ${vwKeys.length}`)
console.log(`DRE 2025 Usados: ${dre2025Exists ? '✅ OK' : '❌ FALTANDO'}`)
console.log(`Métricas 2025 Usados: ${metrics2025Exists ? '✅ OK' : '❌ FALTANDO'}`)
console.log('')

// 6. Teste de escrita
console.log('🧪 Testando escrita no localStorage...')
const testKey = 'vw_test_persistence'
const testValue = { timestamp: Date.now(), random: Math.random() }
localStorage.setItem(testKey, JSON.stringify(testValue))
const testRead = localStorage.getItem(testKey)
const testSuccess = testRead !== null
console.log(`Escrita de teste: ${testSuccess ? '✅ FUNCIONOU' : '❌ FALHOU'}`)
if (testSuccess) {
  console.log('Valor escrito:', JSON.parse(testRead))
  localStorage.removeItem(testKey)
}
console.log('')

// 7. Instruções
if (!dre2025Exists || !metrics2025Exists) {
  console.log('⚠️ PROBLEMA DETECTADO!')
  console.log('Os dados não estão no localStorage.')
  console.log('')
  console.log('📝 AÇÕES:')
  console.log('1. Tente importar um arquivo JSON novamente')
  console.log('2. Execute este script logo após a importação (ANTES de fechar o navegador)')
  console.log('3. Verifique se aparece "✅ EXISTE" para as chaves acima')
} else {
  console.log('✅ DADOS ENCONTRADOS!')
  console.log('Os dados estão salvos corretamente no localStorage.')
  console.log('')
  console.log('📝 PRÓXIMO TESTE:')
  console.log('1. Feche completamente este navegador')
  console.log('2. Reabra e execute este script novamente')
  console.log('3. Verifique se os dados permanecem')
}

console.log('\n🔬 === FIM DO DIAGNÓSTICO ===')
```

## Instruções de Uso:

### Teste 1: Logo Após Importar
1. Importe um arquivo JSON
2. **ANTES de fechar o navegador**, cole o script acima no console
3. Verifique se aparecem `✅ EXISTE` para as chaves

### Teste 2: Após Fechar e Reabrir
1. Feche completamente o navegador
2. Reabra http://localhost:5001/
3. Cole o mesmo script no console
4. Verifique se os dados **ainda estão lá**

### Teste 3: Salvar Manualmente (Se falhar)
Se os dados não aparecerem após importar, tente salvar manualmente:

```javascript
// Criar dados de teste
const testDRE = [
  {
    descricao: 'RECEITA OPERACIONAL LIQUIDA',
    total: 999999,
    percentTotal: 100.00,
    meses: [10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000, 19000, 20000, 21000]
  },
  {
    descricao: 'CUSTO OPERACIONAL DA RECEITA',
    total: -500000,
    percentTotal: -50.00,
    meses: [-5000, -5500, -6000, -6500, -7000, -7500, -8000, -8500, -9000, -9500, -10000, -10500]
  }
]

// Salvar no localStorage
localStorage.setItem('vw_dre_2025_usados', JSON.stringify(testDRE))
console.log('✅ DRE de teste salvo manualmente')

// Verificar
const saved = localStorage.getItem('vw_dre_2025_usados')
console.log('Verificação:', saved ? 'SALVO ✅' : 'FALHOU ❌')

// Recarregar página
alert('Dados de teste salvos! Recarregando...')
location.reload()
```

## Resultados Esperados:

### ✅ Sucesso:
- Após importar: `✅ EXISTE` para DRE e Métricas
- Após reabrir: Dados **permanecem** no localStorage
- Teste de escrita: `✅ FUNCIONOU`

### ❌ Falha:
- Após importar: `❌ NÃO EXISTE`
- Significa que `importAllData()` não está salvando
- OU localStorage está desabilitado no navegador

## Se Falhar:

Execute este teste de navegador:
```javascript
// Verificar se localStorage funciona
try {
  localStorage.setItem('test', '123')
  const works = localStorage.getItem('test') === '123'
  localStorage.removeItem('test')
  console.log('localStorage funciona:', works ? '✅ SIM' : '❌ NÃO')
} catch (e) {
  console.error('❌ localStorage está BLOQUEADO:', e)
}
```
