# ✨ Welcome to Your Spark Template!
You've just launched your brand-new Spark Template Codespace — everything’s fired up and ready for you to explore, build, and create with Spark!

This template is your blank canvas. It comes with a minimal setup to help you get started quickly with Spark development.

🚀 What's Inside?
- A clean, minimal Spark environment
- Pre-configured for local development
- Ready to scale with your ideas
  
🧠 What Can You Do?

Right now, this is just a starting point — the perfect place to begin building and testing your Spark applications.

🧹 Just Exploring?
No problem! If you were just checking things out and don’t need to keep this code:

- Simply delete your Spark.
- Everything will be cleaned up — no traces left behind.

📄 License For Spark Template Resources 

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.

## Recebimentos de consórcio

O módulo abre em **Lançar Vendas** para usuários com acesso a essa aba.
Em **Vendas > A Receber**, o percentual da comissão do produto corresponde ao
cadastro no momento da venda, mesmo que o produto seja alterado depois.
Em **Vendas > Recebida**, a coluna Data do recebimento mostra a data de cada
baixa, também mantida no histórico. A coluna Número do borderô lista os números
de cada recebimento da parcela; recebimentos antigos sem número aparecem com um traço.
O valor da carta da venda é exibido em cada parcela com recebimento.
A aba **Tabela** apresenta uma linha por recebimento, inclusive parciais e
recebimentos anteriores. A data do borderô corresponde à data do recebimento;
o percentual total de comissão é o cadastrado no produto no momento da venda.
Para cada recebimento, o imposto aplica a alíquota vigente na venda ao valor
recebido e é arredondado em centavos; o líquido deduz esse imposto. As
rentabilidades bruta e líquida dividem esses valores pela carta e são exibidas
com duas casas decimais. Ao estornar
um recebimento, sua linha deixa de aparecer na próxima abertura ou atualização.
Cada item do histórico pode ser estornado individualmente na coluna **Ação**.
O item é removido e
o valor volta ao saldo a receber.

Para habilitar o estorno, configure a variável secreta de servidor
`CONSORCIO_ESTORNO_PASSWORD` na Vercel e faça um novo deploy. A senha não deve
ser incluída no código. A confirmação pela interface exige uma sessão válida;
as APIs genéricas de armazenamento continuam podendo alterar os dados sem a
senha, portanto esse bloqueio não é uma proteção contra acesso direto à API.
Para testar localmente, configure `CONSORCIO_ESTORNO_PASSWORD` em
`.env.development.local` e reinicie o servidor de desenvolvimento. A validação
local só aceita conexões da própria máquina; os dados locais usam IndexedDB e
não alteram os dados de produção. A autenticação local é simulada.

## Multas a Receber

Em **Análise Financeira > Multas a Receber**, importe o TXT delimitado por `;`
na aba **Importação de Arquivo**, selecionando o mês de referência. Os títulos
ficam consolidados, sem separação por marca, e não compartilham dados com Duplicatas.
O arquivo deve conter `TITULO`, `NOME_CLIENTE`, `DEPARTAMENTO`, `NOME_DEPARTAMENTO`,
`DTA_VENCIMENTO`, `VENCIDO` e `AVENCER`; todas as origens são consideradas.

Na aba **Análise**, o saldo soma `VENCIDO + AVENCER`, mas a situação é recalculada
pelo vencimento em relação à data-base. Títulos que vencem na data-base ficam a
vencer; títulos sem vencimento são destacados separadamente. A data-base começa
no último dia do mês quando não há uma salva; **Salvar** persiste a escolha por mês.
O filtro de departamento atualiza os indicadores; busca, situação e seleção no
ranking de clientes filtram somente a tabela detalhada.

**Exportar Excel** baixa o mês completo com a data-base selecionada, sem aplicar
os filtros da tela. O arquivo inclui resumo, departamentos, faixas de vencidos e
a vencer, todos os clientes e títulos detalhados, com valores e datas formatados.

## Estoque de Veículos Novos Audi

O inventário é separado em **Novos** e **Test Drive / Courtesy Car** pelo chassi
completo, ignorando diferenças entre maiúsculas/minúsculas e espaços nas pontas.
A referência é o cadastro atual da aba **Veículos** de **Grade de Test Drive Audi
e Rentabilidade**, inclusive veículos marcados como vendidos. Só são considerados
os veículos presentes no inventário do mês selecionado, com valor positivo.
Valores e dias de estoque vêm do inventário, não do cadastro da Grade.

Os três cards de composição mostram valor e quantidade do estoque total e de
cada grupo. Os demais indicadores, a comparação mensal, gráficos, resumos,
veículos pagos (180 dias ou mais) e a tabela geral incluem somente os Novos.
Test Drive / Courtesy Car tem tabela própria, com modelo, chassi, classificação,
dias e valor. O Excel segue a mesma separação, com totais conciliados e aba própria.
Meses anteriores também são classificados usando o cadastro **atual** da Grade;
não é um histórico de emplacamento. Se a Grade não carregar, a análise informa
o erro e permite tentar novamente, sem assumir que todos são novos.

Os estoques de Novos VW e de Usados não são afetados por essa separação.

## Financiamento Banco Volks — custos de seguros

Em **Análise de Resultado**, **Deduções Custos Seguros** permite ao administrador
salvar valores mensais separados para Novos e Usados. A linha **Deduções Custo
Seguros**, após **Total Remuneração + Encargos**, reduz o resultado da operação
e sua margem, sem alterar impostos, receita líquida, remunerações ou o resultado
por vendedor. **Ano todo** soma os valores dos meses com dados de financiamento;
os lançamentos são editados mês a mês e não alteram as Deduções já existentes.

## Base Gerencial — contas classificadas

Em **Importar Dados > Classificação de Tipo de Conta > Classificadas**, use
**Imprimir PDF** para abrir a impressão do navegador e salvar em PDF. O relatório
inclui as contas classificadas exibidas, suas descrições e classificações atuais.

## Emissão de Demonstrações Financeiras

Em **Análise Financeira Sorana > Emissão de Demonstrações Financeiras**, a aba
**Cadastros** reúne empresa/CNPJ, grupos de contas, totalizações e assinantes.
O nome da empresa identifica o documento, sem separar os balancetes por empresa.
Selecione contas pesquisando código/descrição. Na **DRE**, o sinal é automático:
o movimento **créditos − débitos** preserva receitas, deduções, custos, despesas
e estornos com seus sinais contábeis. As totalizações somam os grupos já com seus
sinais, sem escolha de Somar/Subtrair. Operações manuais antigas da DRE deixam
de interferir no cálculo, sem exigir recadastro.
Somente contas completas (analíticas) podem ser selecionadas; contas
com subcontas ou identificadas como sintéticas (`S`) ficam desabilitadas.
Códigos repetidos no arquivo não bloqueiam a leitura: preserva-se a última
ocorrência, como no painel existente, sem somar as repetições.
Em **Ativo**, **Passivo** e **Endividamento**, use **Somar/Subtrair** sobre os
valores absolutos das contas e nas referências entre grupos. Cada demonstração
tem grupos e totalizações próprios. Uma conta do Passivo também pode ser usada
em Endividamento, mas não pode ser cadastrada em dois grupos da mesma
demonstração. Totalizações usam linhas da própria demonstração, sem dupla
contagem. **Salvar cadastro** persiste as configurações e detecta alterações
concorrentes.

O cadastro do balanço migra o **Patrimônio Líquido** para um grupo próprio,
separado do Passivo Não Circulante. O modelo Sorana agrupa Capital Social
(`2.3.1`), Reservas de Capital (`2.3.2.01`), Reservas de Lucros
(`2.3.2.02` e `2.3.2.03`) e Lucros (Prejuízos) Acumulados (`2.3.3`), invertendo
o saldo contábil desses prefixos. A linha de Capital Social pode ser expandida
para identificar as contas analíticas que formam seu total. Depreciação e
amortização acumuladas (`1.5.5.02.01` e `1.5.5.02.02`) são subtraídas do Ativo
quando já classificadas no cadastro.
O **Resultado do Período** é calculado como o inverso da soma dos saldos
analíticos dos grupos `3`, `4`, `5` e `6` e integra o PL; no balancete anual
encerrado, esses grupos zerados não duplicam o valor já transferido a
Lucros/Prejuízos Acumulados. No rodapé do Passivo + PL, **Ativo – (Passivo +
PL)** confere o fechamento, e **Resultado do balancete – Lucro líquido da
DRE** compara o resultado com a linha `LUCRO LÍQUIDO DO EXERCÍCIO` da DRE
(acumulado de janeiro ao mês exibido ou pelo balancete anual). Se houver
diferença, a tela lista as contas de resultado sem classificação na DRE.

Na **DRE**, no **Ativo** e no **Passivo**, o tipo **Linha principal com sublinhas** é opcional: cada sublinha
tem nome e contas próprios, e aparece abaixo da linha principal, que soma seus
valores. Ao converter um grupo de contas existente, suas contas são preservadas
em uma primeira sublinha editável. Ao voltar para grupo de contas, as contas
das sublinhas são reunidas na linha principal. Totalizações existentes precisam
ter suas referências removidas antes de serem convertidas em sublinhas.
No Ativo e Passivo, os sinais Somar/Subtrair configurados em cada conta são
mantidos na conversão e a linha principal soma as sublinhas com seus sinais.
Em **Cadastros**, expanda um grupo para consultar os códigos e as descrições das
contas, organizadas por sublinha quando houver. Na DRE, no Ativo, no Passivo e
no Endividamento, expanda cada grupo de contas para ver seus valores por coluna,
seguindo as mesmas regras de período e sinal do grupo. Totalizações não são
expandidas; contas ausentes no balancete carregado aparecem sem descrição.

Em **Endividamento**, ao adicionar uma linha principal, informe seu nome e
cadastre os bancos ou dívidas, cada um com suas próprias contas. A linha
principal mostra a soma dos saldos dos bancos ou dívidas, apresentados logo
abaixo, por período.
No demonstrativo mensal, use **Editar captação** na linha do banco ou dívida
para informar data, valor, taxa (texto livre), total de parcelas, parcelas
restantes e juros provisionados. As parcelas restantes e os juros são informados
manualmente por mês. Os juros são informativos e não alteram os saldos.
Os detalhes aparecem só na coluna do período mensal selecionado no topo;
as colunas comparativas mostram apenas o saldo.

A **DRE** usa o movimento líquido de cada conta no mês e de janeiro até o mês
selecionado. No modo **Anual**, usa somente o arquivo anual importado.
**Ativo**, **Passivo** e **Endividamento** usam os saldos na data de cada coluna, sem
somar saldos mensais. Se faltar o balancete, a coluna afetada fica indisponível;
se faltar apenas uma conta em um balancete importado, ela contribui com zero.
Impressão/PDF não estão incluídos nesta etapa.
