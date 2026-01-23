# 🧪 Testes Manuais de Persistência de Dados

## ✅ Testes Automatizados Passando

Todos os **6 testes** de persistência passaram:
```bash
npm test -- --run persistenceImport
```

✓ deve salvar dados importados no localStorage
✓ deve manter dados importados após "reload" simulado
✓ deve importar arquivo JSON completo e manter dados após reload
✓ deve importar dados consolidados e manter após reload
✓ deve fazer ciclo completo: exportar -> importar -> verificar persistência
✓ deve verificar que dados permanecem após múltiplos reloads simulados

---

## 🌐 Teste Manual no Navegador

**Servidor rodando em:** http://localhost:5001/

### Passo 1: Verificar Estado Inicial

1. Abra http://localhost:5001/ no navegador
2. Abra o Console (F12)
3. Execute para ver os dados atuais:
```javascript
console.log('Dados no localStorage:', Object.keys(localStorage).filter(k => k.startsWith('vw_')))
```

### Passo 2: Exportar Dados

1. No dashboard, clique no botão **"Exportar Dados JSON"**
2. Salve o arquivo (ex: `backup_vw_dados_20260122_232630.json`)
3. Verifique no console:
```javascript
console.log('✅ Arquivo exportado com sucesso')
```

### Passo 3: Limpar Dados

1. No console, execute:
```javascript
// Limpar TODOS os dados do localStorage
localStorage.clear()
console.log('🗑️ localStorage limpo, total de itens:', localStorage.length)
```

2. Recarregue a página (F5)
3. Verifique que os dados voltaram aos padrões (dados originais do código)

### Passo 4: Importar Dados

1. Clique no botão **"Importar Dados"**
2. Selecione o arquivo JSON exportado no Passo 2
3. **IMPORTANTE**: A página será recarregada automaticamente
4. Após reload, verifique no console:
```javascript
// Verificar se dados foram importados e salvos
const keys = Object.keys(localStorage).filter(k => k.startsWith('vw_'))
console.log('✅ Dados importados, total de chaves:', keys.length)
console.log('Chaves:', keys)

// Verificar um dado específico
const metrics2025 = localStorage.getItem('vw_metrics_2025_consolidado')
if (metrics2025) {
  const parsed = JSON.parse(metrics2025)
  console.log('✅ Métricas 2025 consolidado:', parsed.vendasNovos.vendas.slice(0, 3))
} else {
  console.log('❌ Não encontrou dados de 2025 consolidado')
}
```

### Passo 5: Fechar e Reabrir Servidor (Teste de Persistência Real)

1. Feche o navegador completamente
2. No terminal, pare o servidor: `Ctrl+C`
3. Reinicie o servidor:
```bash
npm run dev
```
4. Abra novamente http://localhost:5001/
5. Verifique no console:
```javascript
// Verificar se dados ainda estão lá
const keys = Object.keys(localStorage).filter(k => k.startsWith('vw_'))
console.log('✅ Após reiniciar servidor, dados persistidos:', keys.length)

// Verificar integridade
const metrics = localStorage.getItem('vw_metrics_2025_consolidado')
if (metrics) {
  console.log('✅ SUCESSO: Dados permaneceram após reiniciar servidor!')
} else {
  console.log('❌ FALHOU: Dados foram perdidos')
}
```

### Passo 6: Teste com Dados Consolidados

1. Mude para departamento **"Consolidado"**
2. Exporte os dados
3. Limpe o localStorage:
```javascript
localStorage.clear()
```
4. Recarregue a página (F5)
5. Importe o arquivo exportado
6. Verifique no console:
```javascript
// Verificar dados consolidados
const consolidado = localStorage.getItem('vw_metrics_2025_consolidado')
const dreConsolidado = localStorage.getItem('vw_dre_2025_consolidado')

if (consolidado && dreConsolidado) {
  console.log('✅ Dados consolidados salvos corretamente!')
  console.log('Métricas:', JSON.parse(consolidado).vendasNovos.vendas.slice(0, 3))
  console.log('DRE:', JSON.parse(dreConsolidado).slice(0, 2))
} else {
  console.log('❌ Problema com dados consolidados')
}
```

---

## 📊 Resultados Esperados

### ✅ Sucesso:
- Dados exportados contêm todos os anos e departamentos
- Após importar, localStorage contém as chaves `vw_metrics_*` e `vw_dre_*`
- Dados permanecem após recarregar página (F5)
- Dados permanecem após fechar/reabrir navegador
- Dados permanecem após parar/reiniciar servidor
- Dados consolidados são importados e salvos corretamente

### ❌ Falha:
- localStorage vazio após importação
- Dados desaparecem após reload
- Erro ao importar dados consolidados
- Console mostra erros JavaScript

---

## 🐛 Debug

Se algo falhar, execute no console:

```javascript
// Ver todos os dados do localStorage
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i)
  if (key && key.startsWith('vw_')) {
    console.log(key, ':', localStorage.getItem(key)?.substring(0, 100) + '...')
  }
}

// Verificar função de importação
console.log('importAllData disponível?', typeof window.importAllData)

// Forçar salvamento de teste
const testData = {
  months: ['Jan', 'Fev'],
  vendasNovos: { vendas: [999, 888], volumeTrocas: [], percentualTrocas: [] },
  vendasNovosVD: { vendas: [], volumeTrocas: [], percentualTrocas: [] },
  vendasUsados: { vendas: [], volumeTrocas: [], percentualTrocas: [] },
  volumeVendas: { usados: [], repasse: [], percentualRepasse: [] },
  estoqueNovos: { quantidade: [], valor: [], aPagar: [], pagos: [] },
  estoqueUsados: { quantidade: [], valor: [], aPagar: [], pagos: [] },
  estoquePecas: { quantidade: [], valor: [], aPagar: [], pagos: [] },
  margensOperacionais: { novos: [], usados: [], oficina: [], pecas: [] },
  receitaVendas: { novos: [], usados: [] },
  resultadoFinanceiro: { receitas: [], despesas: [], resultado: [] }
}

localStorage.setItem('test_metrics', JSON.stringify(testData))
console.log('Teste salvo?', localStorage.getItem('test_metrics') !== null)
```

---

## 📝 Checklist Final

- [ ] Testes automatizados passando (6/6)
- [ ] Exportação funciona
- [ ] Importação salva no localStorage
- [ ] Dados permanecem após F5
- [ ] Dados permanecem após fechar navegador
- [ ] Dados permanecem após reiniciar servidor
- [ ] Dados consolidados funcionam
- [ ] Console mostra logs `✅ Métricas importadas: ...`
- [ ] Nenhum erro JavaScript no console
