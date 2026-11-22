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

### 7. Emissão de Demonstrações Financeiras — Conferências

Na aba **Emissão de Demonstrações Financeiras**, abra **Conferências** para revisar os balancetes e demonstrações do período. Cada verificação mostra um semáforo; expanda o item para consultar contas, linhas e diferenças que explicam o resultado.

Os valores monetários dos resumos, detalhes e conferências no Excel são apresentados em **reais**, com separador de milhar e duas casas decimais (por exemplo, **R$ 5.796,00**). Diferenças, médias e movimentos agregados são convertidos de centavos para reais antes da exibição e da comparação com os limites; os saldos importados não são alterados.

Nas DFC **Direta e Indireta**, a tela e o Excel ocultam automaticamente linhas de detalhe cujo valor é **zero em todos os períodos exibidos e no acumulado de cada ano comparado**. Na visualização mensal, também é verificado o acumulado de janeiro até o mês selecionado. Linhas com dados indisponíveis não são consideradas zeradas. Títulos, grupos, subtotais, totais e conciliações permanecem visíveis; cadastros, notas e conferências não são removidos nem filtrados. Os detalhes reaparecem quando algum dos valores considerados deixa de ser zero.

Em **Cadastros**, os botões **Excluir** das linhas solicitam confirmação com o nome da linha e avisam quando sublinhas ou bancos vinculados também serão removidos. **Cancelar** mantém o cadastro intacto; confirmar aplica a exclusão apenas ao cadastro em edição, sendo necessário **Salvar cadastro** para gravá-la. Exclusões que invalidariam totalizações continuam bloqueadas. Os balancetes importados não são excluídos.

O grupo **Patrimônio Líquido** permite editar, mover e excluir como os demais grupos. No editor, é possível alterar nomes, adicionar/remover sublinhas e ajustar contas ou prefixos, preservando o sinal contábil dos saldos. A sublinha **Resultado do Período** permanece calculada automaticamente pelos grupos 3 a 6; seu nome pode ser alterado sem selecionar contas. Enquanto houver essa sublinha calculada, a linha principal deve permanecer com sublinhas, para não perder o cálculo automático. As alterações dependem de **Salvar cadastro**.

Os **sinais patrimoniais são automáticos**, na tela, no Excel e nos cálculos das conferências: **Ativo = saldo importado**; **Passivo, PL e Endividamento = −saldo importado**. Contas analíticas e prefixos preservam saldos de ambos os sinais, sem valor absoluto. Totais e subtotais somam esses valores com sinal. As operações manuais antigas de contas e totalizações não são reaplicadas e não aparecem mais no editor patrimonial. Isso evita inverter novamente contas já negativas, incluindo **1.1.3.01.03.003**, **1.1.3.01.03.006**, depreciações e amortizações do grupo **1.5.7.02**. Saldos contrários à natureza esperada não são corrigidos nem ocultados.

O alerta de sinal invertido lista **todos os saldos não zero** contrários à natureza configurada, respeitando suas exceções e exclusões. O parâmetro **Destaque de sinal invertido (R$)** apenas destaca os maiores na tela e no Excel; não filtra os menores. Detalhes de balancetes e históricos mantêm os saldos originais para auditoria, enquanto os totais e contribuições patrimoniais seguem a convenção acima. Valores absolutos continuam sendo usados apenas para medir limites, ordenar alertas e formatar valores negativos entre parênteses, sem alterar o cálculo das demonstrações.

O painel verifica:

1. Fechamento do balancete (débitos, créditos e saldos).
2. Continuidade dos saldos anteriores, incluindo divergências no mês seguinte.
3. Alterações em reimportações, comparadas à versão emitida e à importação anterior. Cada importação mantém um snapshot; versões importadas podem ser marcadas como emitidas, com usuário e horário.
4. Equação patrimonial: Ativo − (Passivo + PL).
5. Lucro líquido da DRE em relação aos grupos 3 a 6.
6. Variação da DFC e conciliação do caixa com o balanço.
7. Caixa operacional pelos métodos direto e indireto, no mês e no acumulado.
8. Acumulado da DRE, DFC Direta e DFC Indireta em relação à soma dos meses, linha por linha, incluindo subtotais e totais.
9. Contas analíticas com saldo atual **ou** débitos/créditos, sem classificação ou classificadas em mais de uma linha. A classificação reutiliza as regras que geram cada demonstração, inclusive o prefixo mais longo da DFC e os componentes calculados do método indireto. Compensações (`1.3`, `1.9`, `2.4`, `2.9`) são excluídas em todas; contas de balanço não são exigidas na DRE, e contas de resultado não são exigidas no balanço, pois compõem o Resultado do Período. Caixa (`1.1.1` e os prefixos de caixa equivalentes selecionados) e contas cadastradas fora da DFC não são exigidos na DFC. A lista de cada método fica vazia quando sua diferença no item 6 está dentro da tolerância; se o item 6 está OK, ambas ficam vazias. Quando há diferença, o painel e o Excel mostram o efeito de cada conta sem linha na diferença do item 6, sua soma e o valor não explicado, separadamente para Direta e Indireta. O valor não explicado é sinalizado para revisão, sem atribuí-lo artificialmente a contas.
10. Contas novas no plano em relação ao período anterior.
11. Soma das linhas em relação aos totais dos grupos do balancete.
12. Sinais invertidos, movimentos no PL, variações atípicas e passivos de arrendamento.

As comparações de continuidade e reimportação ignoram diferenças de até **R$ 1,00**. Os critérios de natureza, tolerâncias, limites de variação e prefixos de arrendamento podem ser ajustados em **Parâmetros das conferências**. Variações atípicas exigem pelo menos dois meses anteriores disponíveis; verificações que dependem de períodos ausentes aparecem como indisponíveis.

O item **8 — Acumulado = soma dos meses** utiliza os mesmos cálculos que geram DRE, DFC Direta e DFC Indireta. Compara cada linha acumulada com a soma dos valores mensais de janeiro até o mês selecionado; na seleção anual, compara o balancete anual com os 12 meses. Qualquer diferença de um centavo ou mais gera **Erro** e uma lista de divergências na tela e no Excel, com demonstração, linha, acumulado, soma dos meses e diferença. Linhas zeradas ocultas na apresentação também são verificadas; títulos sem valores não participam. Meses ou cálculos ausentes não são convertidos em zero nem produzem **OK**. A comparação é independente do item 7: diferenças entre métodos só geram erro no item 8 quando o acumulado realmente diverge da soma dos meses.

No alerta de **sinal invertido**, as compensações `1.3`, `1.9`, `2.4` e `2.9` são excluídas, inclusive das sugestões. São aplicadas naturezas **credoras** às redutoras do ativo `1.1.3.01.03.003`, `1.1.3.01.03.006`, `1.1.5.01.01.009`, `1.1.4.02.01.003`, `1.1.4.02.01.004` e `1.5.1.01.50.999`, e à redutora do custo `4.1.5.01.03.098`. As redutoras do passivo `2.1.2.03.02.099`, `2.2.1.15.20.099` e `2.1.4.01.01.005` têm natureza **devedora**. Uma natureza específica prevalece sobre exclusões genéricas mais curtas, como `1.1.4` para as SCP; uma exclusão tão específica quanto a natureza continua prevalecendo. Redutoras com natureza configurada não aparecem como sugestão, mas continuam gerando alerta se seu saldo tiver o sinal contrário. Permanecem os alertas de saldo devedor em `2.2.1.06.01.001` e credor em `4.1.1.01.01.002`, sem modificar os saldos importados.

Parâmetros antigos recebem essas novas regras ao carregar, preservando os demais ajustes e a versão usada para gravação. Ao salvar os parâmetros, a atualização é registrada e não sobrescreve novamente edições posteriores.

No item 11, **DFC — seções − variação de caixa** compara **Operacional + Investimento + Financiamento** com **saldo final − saldo inicial** das mesmas contas de caixa selecionadas no cadastro e usadas no item 6 (padrão `1.1.1`). A diferença é a soma das seções menos a variação real, sem subtrair novamente contas fora da DFC ou diferenças entre débitos e créditos. A tela e o Excel apresentam a variação real, a soma das seções e a diferença; com conciliação exata no item 6, a diferença é zero. Diferenças reais continuam visíveis, sujeitas à mesma tolerância do item 6, e dados indisponíveis não são substituídos por zero.

O alerta de **variação atípica** analisa somente linhas de detalhe, sem totais, subtotais, linhas calculadas ou contas fora da DFC. Para **capital de giro**, a variação deve ultrapassar **simultaneamente** o limite monetário (padrão **R$ 5.000.000**) e o percentual configurado (padrão **50%**), inclusive em inversões de sinal; a regra de sempre alertar acima de R$ 2.000.000 não se aplica a essas linhas. Se a média anterior for zero, não há percentual calculável e essa regra conjunta não dispara. As demais linhas mantêm os critérios anteriores. No Balanço, são reconhecidos automaticamente Estoque/Estoques, Contas a receber, Fornecedores, Contas correntes, Adiantamentos com/de/a clientes e Empréstimos/Financiamentos do circulante (contas `2.1`, incluindo floor plan). Sublinhas herdam a categoria pelo nome de seu grupo. Nomes adicionais podem ser definidos nos parâmetros, sem recadastrar os existentes. Percentuais são exibidos como **12%** ou **73,1%**, não como fração decimal; no Excel, a coluna **Variação percentual** mantém valores numéricos com formato percentual de uma casa decimal (por exemplo, `0,731` aparece como **73,1%**).

O botão **Exportar Excel** inclui uma planilha **Conferências** de janeiro até o mês selecionado, para todos os anos comparados nas demais planilhas. Quando selecionado **Anual**, inclui janeiro a dezembro de cada ano comparado. A planilha começa com um resumo dos 12 semáforos por mês; os comentários das células explicam cada resultado. Em seguida, traz os detalhes completos separados por período: contas e linhas, comparações de versões e histórico de importações. Os parâmetros salvos aparecem uma única vez ao final. Meses sem balancete permanecem no relatório, com as verificações correspondentes indisponíveis, sem substituição por zeros. As leituras de balancetes são reutilizadas entre as conferências mensais. A exportação não marca versões como emitidas nem altera os parâmetros. Falhas ao carregar dados ou histórico interrompem a exportação e são informadas na tela.

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
