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
