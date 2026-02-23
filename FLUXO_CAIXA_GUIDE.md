# Guia de Uso - Fluxo de Caixa

## Visão Geral

O módulo de **Fluxo de Caixa** (BalanceteAI) é uma ferramenta completa de análise financeira que permite importar balancetes contábeis e obter automaticamente:

- ✅ Análise de Ativo e Passivo
- ✅ Demonstração de Resultado do Exercício (DRE) parcial
- ✅ Demonstração do Fluxo de Caixa (DFC) pelo método indireto
- ✅ Indicadores financeiros essenciais
- ✅ Visualizações gráficas interativas

## Como Acessar

1. Na tela inicial do sistema, selecione a opção **"Fluxo de caixa"**
2. Digite a senha de acesso (marca protegida)
3. Você será direcionado para a tela de upload de balancete

## Formato do Arquivo

O sistema aceita arquivos `.txt` ou `.csv` com campos separados por **ponto-e-vírgula (;)** e codificação **Latin1**.

### Estrutura do Arquivo

O arquivo deve conter as seguintes colunas:

```
Nível;Conta;Descrição;Saldo Anterior;Débito;Crédito;Saldo Atual
```

### Exemplo de Arquivo

```csv
A;1;ATIVO;1000000,00;500000,00;300000,00;1200000,00
A;1.1;ATIVO CIRCULANTE;700000,00;300000,00;150000,00;850000,00
A;1.1.1;DISPONIBILIDADES;50000,00;100000,00;80000,00;70000,00
A;1.1.1.01;CAIXA GERAL;10000,00;50000,00;45000,00;15000,00
A;1.1.1.02;BANCOS CONTA MOVIMENTO;30000,00;40000,00;30000,00;40000,00
A;1.1.1.03;APLICACOES LIQUIDEZ IMEDIATA;10000,00;10000,00;5000,00;15000,00
A;1.1.2;ESTOQUES;400000,00;150000,00;50000,00;500000,00
A;1.1.2.01;VEICULOS NOVOS;250000,00;100000,00;30000,00;320000,00
A;1.1.2.02;VEICULOS USADOS;100000,00;40000,00;15000,00;125000,00
A;1.1.2.03;PECAS;50000,00;10000,00;5000,00;55000,00
A;1.1.3;CREDITOS DE VENDAS;200000,00;40000,00;15000,00;225000,00
P;2.1;PASSIVO CIRCULANTE;500000,00;100000,00;150000,00;550000,00
P;2.1.1;EMPRESTIMOS FLOOR PLAN CP;200000,00;30000,00;50000,00;220000,00
P;2.1.2.01;OBRIGACOES TRABALHISTAS;80000,00;15000,00;20000,00;85000,00
P;2.1.2.02;OBRIGACOES TRIBUTARIAS;70000,00;12000,00;18000,00;76000,00
P;2.1.2.03;CONTAS A PAGAR;50000,00;10000,00;15000,00;55000,00
P;2.1.3;FORNECEDORES VW;80000,00;25000,00;35000,00;90000,00
P;2.1.4;FORNECEDORES AUDI;20000,00;8000,00;12000,00;24000,00
P;2.3;PATRIMONIO LIQUIDO;400000,00;0,00;0,00;400000,00
P;2.3.1.01;CAPITAL SOCIAL;400000,00;0,00;0,00;400000,00
```

### Regras Importantes

1. **Nível**: Campo que indica o tipo de conta (A = Ativo, P = Passivo)
2. **Conta**: Código do plano de contas
3. **Valores**: Use vírgula como separador decimal (ex: 1000,00)
4. **Contas Essenciais**: O sistema espera encontrar contas específicas do plano de contas:
   - `1` - Ativo Total
   - `1.1` - Ativo Circulante
   - `1.1.1` - Disponibilidades
   - `1.1.2` - Estoques
   - `2.1` - Passivo Circulante
   - `2.3` - Patrimônio Líquido
   - `3.1` - Receita Bruta
   - `4` - CMV (Custo das Mercadorias Vendidas)

## Funcionalidades

### 1. Visão Geral
- KPIs principais (Ativo Total, Disponibilidades, Estoques, etc.)
- Composição gráfica do Ativo e Passivo
- Pontos de atenção automáticos

### 2. Ativo
- Detalhamento completo do Ativo Circulante
- Detalhamento do Ativo Não Circulante
- Variações percentuais entre períodos

### 3. Passivo + PL
- Análise do Passivo Circulante
- Análise do Passivo Não Circulante
- Composição do Patrimônio Líquido

### 4. Resultado
- Receita Bruta e Líquida
- Custo das Mercadorias Vendidas
- Lucro/Prejuízo Bruto
- Visualização em barras proporcionais

### 5. Fluxo de Caixa
- **Método Indireto** - DFC completa
- Atividades Operacionais
- Atividades de Investimento
- Atividades de Financiamento
- Reconciliação com saldo de caixa do balanço

### 6. Indicadores
Cards com análise detalhada de:
- **Liquidez Corrente** (AC/PC)
- **Liquidez Imediata** (Disponib./PC)
- **Endividamento Geral** (PT/AT)
- **Participação de Capital de Terceiros** (PT/PL)
- **Imobilização do PL** (ANC/PL)
- **Margem Bruta** (LB/Rec.Líq.)

Cada indicador mostra:
- ✅ Status (Ok / Atenção / Crítico)
- 📊 Valor calculado
- 📝 Descrição
- 🎯 Referência de mercado

## Upload de Arquivo

### Por Drag & Drop
1. Arraste o arquivo `.txt` ou `.csv` para a área indicada
2. O sistema processará automaticamente

### Por Seleção Manual
1. Clique no botão "Selecionar Arquivo"
2. Escolha o arquivo de balancete
3. Aguarde o processamento

### Erros Comuns

**"Arquivo não reconhecido como balancete válido"**
- Verifique se o arquivo tem o formato correto (separado por `;`)
- Certifique-se de que há pelo menos 10 contas no arquivo
- Confirme a codificação (deve ser Latin1 ou UTF-8)

**Valores zerados ou incorretos**
- Verifique se os valores usam vírgula como separador decimal
- Confirme que as colunas estão na ordem correta
- Certifique-se de que não há linhas em branco no meio do arquivo

## Navegação

- Use as **abas superiores** para alternar entre as visualizações
- Clique em **"Novo Arquivo"** para importar outro balancete
- Clique em **"Voltar ao Menu"** para retornar à seleção de marcas

## Dicas de Uso

1. **Prepare o arquivo**: Antes de importar, verifique se todas as contas estão presentes
2. **Período de análise**: Os saldos "anterior" e "atual" devem ser de períodos consecutivos
3. **Conferência**: Use a aba "Fluxo de Caixa" para conferir a variação calculada vs. real
4. **Indicadores**: Verifique regularmente a aba de Indicadores para monitorar a saúde financeira

## Tecnologias

- React + TypeScript
- Processamento client-side (privacidade total dos dados)
- Visualizações em tempo real
- Responsive design

## Suporte

Para dúvidas ou problemas:
1. Verifique este guia
2. Confirme o formato do arquivo
3. Entre em contato com o suporte técnico

---

**Versão**: 1.0.0  
**Última atualização**: Fevereiro 2026
