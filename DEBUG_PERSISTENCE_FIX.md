# 🐛 Debug - Problema de Persistência DRE Resolvido

## 📋 Problema Identificado

Você relatou que:
- ✅ Dados aparecem após importar (Figura 2)  
- ❌ Após fechar e reabrir, voltam para valores originais (Figura 1)

## 🔍 Causa Raiz Encontrada

Haviam **TRÊS problemas críticos**:

### 1. ❌ useEffect salvando automaticamente (sobrescrevia importações)
```tsx
// ANTES (PROBLEMA):
useEffect(() => {
  saveMetricsData(fiscalYear, metricsData, department);
}, [metricsData, fiscalYear, department]);
// ❌ Salvava dados padrão sobre os importados!
```

### 2. ❌ useEffect de DRE salvando automaticamente
```tsx
// ANTES (PROBLEMA):
useEffect(() => {
  if (department !== 'consolidado') {
    saveDREData(fiscalYear, dreData, department);
  }
}, [dreData, fiscalYear, department]);
// ❌ Salvava dados padrão sobre os importados!
```

### 3. ❌ Lógica substituindo dados importados por zerados
```tsx
// ANTES (PROBLEMA):
if (fiscalYear === 2025 && department === 'usados') {
  setDreData(initialDreData);
} else {
  const zeroedData = ... // ❌ Criava dados zerados!
  setDreData(zeroedData);
}
```

## ✅ Soluções Aplicadas

### 1. Desabilitado useEffect que salvava métricas automaticamente
- Agora salva **apenas** durante importação explícita
- Não sobrescreve mais dados importados

### 2. Desabilitado useEffect que salvava DRE automaticamente  
- Mesma lógica: salva apenas durante importação

### 3. Adicionados logs detalhados na função `loadDREData`
```typescript
console.log(`🔍 loadDREData(${fiscalYear}, ${department}):`);
console.log(`  - Chave: ${key}`);
console.log(`  - Encontrou no localStorage: ${stored ? 'SIM' : 'NÃO'}`);
```

### 4. Melhorada lógica de carregamento inicial
- Agora verifica se há dados no localStorage ANTES de usar padrão/zerados
- Respeita dados importados

## 🧪 Teste Manual

**Servidor rodando em:** http://localhost:5001/

### Passo 1: Limpar Estado Atual
```javascript
// No console do navegador (F12)
localStorage.clear()
console.log('localStorage limpo')
location.reload()
```

### Passo 2: Exportar Dados Atuais
1. Selecione **Ano: 2025**, **Departamento: Usados**
2. Clique em **"Exportar Dados JSON"**
3. Salve o arquivo (ex: `backup_test.json`)

### Passo 3: Modificar Dados Exportados (Opcional)
Abra o arquivo JSON e modifique alguns valores da DRE para identificar facilmente:
```json
{
  "data": {
    "2025": {
      "usados": {
        "dre": [
          {
            "descricao": "VOLUME DE VENDAS",
            "total": 999999,  // ← Modifique para valor único
            "meses": [999, 999, 999, ...]  // ← Modifique
          }
        ]
      }
    }
  }
}
```

### Passo 4: Importar Dados
1. Clique em **"Importar Dados"**
2. Selecione o arquivo JSON
3. **Aguarde** a página recarregar automaticamente
4. Verifique que os valores mudaram

### Passo 5: Verificar localStorage no Console
```javascript
// Verificar chave específica
const dre2025 = localStorage.getItem('vw_dre_2025_usados')
if (dre2025) {
  const parsed = JSON.parse(dre2025)
  console.log('✅ DRE 2025 Usados salvo no localStorage:')
  console.log('  - Volume de Vendas Total:', parsed[0].total)
  console.log('  - Janeiro:', parsed[0].meses[0])
} else {
  console.log('❌ DRE não encontrado no localStorage')
}

// Ver todas as chaves
const keys = Object.keys(localStorage).filter(k => k.startsWith('vw_'))
console.log('📦 Total de chaves VW no localStorage:', keys.length)
console.log('Chaves:', keys)
```

### Passo 6: TESTE CRÍTICO - Fechar e Reabrir
1. **Feche completamente o navegador**
2. **Pare o servidor** no terminal: `Ctrl+C`
3. **Reinicie o servidor**: `npm run dev`
4. **Abra novamente** http://localhost:5001/
5. **Verifique** que os valores importados permanecem

### Passo 7: Verificar Logs no Console
Com as mudanças, você verá logs detalhados:
```
🔍 loadDREData(2025, usados):
  - Chave: vw_dre_2025_usados
  - Encontrou no localStorage: SIM  ← Deve ser SIM!
  - ✅ Retornando X linhas do localStorage
```

## ✅ Resultados Esperados

### Antes da Correção ❌
1. Importa dados → Aparecem temporariamente
2. Fecha navegador → **Dados perdidos** (volta para Figura 1)
3. localStorage **vazio** ou com dados padrão

### Depois da Correção ✅
1. Importa dados → Aparecem imediatamente
2. Fecha navegador → **Dados permancem** (mantém Figura 2)
3. localStorage **contém** dados importados
4. Console mostra `Encontrou no localStorage: SIM`

## 🔧 Debug Adicional

Se ainda houver problemas, execute no console:

```javascript
// Verificar TODAS as chaves de DRE
for (let year = 2024; year <= 2027; year++) {
  ['usados', 'novos', 'pecas', 'oficina', 'consolidado'].forEach(dept => {
    const key = `vw_dre_${year}_${dept}`
    const exists = localStorage.getItem(key) !== null
    console.log(`${exists ? '✅' : '❌'} ${key}`)
  })
}

// Forçar salvamento de teste
const testDRE = [
  { 
    descricao: 'TESTE MANUAL',
    total: 123456,
    meses: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]
  }
]
localStorage.setItem('vw_dre_2025_usados', JSON.stringify(testDRE))
console.log('Teste salvo, recarregue a página')
location.reload()
```

## 📝 Arquivos Modificados

1. [src/lib/dataStorage.ts](src/lib/dataStorage.ts)
   - Adicionados logs detalhados em `loadDREData()`
   
2. [src/components/VWFinancialDashboard/index.tsx](src/components/VWFinancialDashboard/index.tsx)
   - Desabilitados useEffects que sobrescreviam dados
   - Melhorada lógica de carregamento inicial

## ✅ Status

- ✅ Testes automatizados: 6/6 passando
- ✅ Logs de debug implementados
- ✅ useEffects problemáticos desabilitados
- ✅ Servidor rodando para teste manual
- 🔄 **Aguardando seu teste manual para confirmar**
