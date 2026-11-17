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
