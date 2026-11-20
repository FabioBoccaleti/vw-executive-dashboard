export const DFC_SECOES_PADRAO = [
  { id: 'operacional', nome: 'Atividades Operacionais' },
  { id: 'investimento', nome: 'Atividades de Investimento' },
  { id: 'financiamento', nome: 'Atividades de Financiamento' },
] as const;

export const DFC_LINHAS_PADRAO = [
  {
    "codigo": "OP01",
    "secao": "operacional",
    "nome": "Recebimentos de clientes"
  },
  {
    "codigo": "OP02",
    "secao": "operacional",
    "nome": "Bônus, comissões da montadora e F&I"
  },
  {
    "codigo": "OP03",
    "secao": "operacional",
    "nome": "Pagamentos a fornecedores e floor plan"
  },
  {
    "codigo": "OP04",
    "secao": "operacional",
    "nome": "Pagamentos a empregados"
  },
  {
    "codigo": "OP05",
    "secao": "operacional",
    "nome": "Despesas operacionais pagas"
  },
  {
    "codigo": "OP06",
    "secao": "operacional",
    "nome": "Impostos sobre vendas e serviços"
  },
  {
    "codigo": "OP07",
    "secao": "operacional",
    "nome": "Parcelamentos tributários"
  },
  {
    "codigo": "OP08",
    "secao": "operacional",
    "nome": "IR/CSLL pagos"
  },
  {
    "codigo": "OP09",
    "secao": "operacional",
    "nome": "Rendas financeiras recebidas"
  },
  {
    "codigo": "OP10",
    "secao": "operacional",
    "nome": "Depósitos judiciais e contingências"
  },
  {
    "codigo": "INV01",
    "secao": "investimento",
    "nome": "Imobilizado e intangível (aquisições líquidas de vendas)"
  },
  {
    "codigo": "INV02",
    "secao": "investimento",
    "nome": "Mútuos com ligadas"
  },
  {
    "codigo": "INV03",
    "secao": "investimento",
    "nome": "Participações e dividendos recebidos"
  },
  {
    "codigo": "FIN01",
    "secao": "financiamento",
    "nome": "Empréstimos e financiamentos bancários"
  },
  {
    "codigo": "FIN02",
    "secao": "financiamento",
    "nome": "Juros e IOF sobre empréstimos"
  },
  {
    "codigo": "FIN03",
    "secao": "financiamento",
    "nome": "Arrendamentos (HPFS)"
  },
  {
    "codigo": "FIN04",
    "secao": "financiamento",
    "nome": "Sócios"
  },
  {
    "codigo": "FIN05",
    "secao": "financiamento",
    "nome": "Ligadas"
  }
] as const;

export const DFC_PREFIXOS_PADRAO = [
  {
    "referencia": "1.1.1",
    "linha": "CAIXA"
  },
  {
    "referencia": "1.1.1.04",
    "linha": "CAIXA"
  },
  {
    "referencia": "1.1.2",
    "linha": "OP03"
  },
  {
    "referencia": "1.1.2.06",
    "linha": "OP06"
  },
  {
    "referencia": "1.1.3.01.01",
    "linha": "OP01"
  },
  {
    "referencia": "1.1.3.01.02",
    "linha": "OP01"
  },
  {
    "referencia": "1.1.3.01.03",
    "linha": "OP01"
  },
  {
    "referencia": "1.1.3.01.04",
    "linha": "OP01"
  },
  {
    "referencia": "1.1.3.01.05",
    "linha": "OP01"
  },
  {
    "referencia": "1.1.3.01.06",
    "linha": "OP01"
  },
  {
    "referencia": "1.1.3.01.10",
    "linha": "OP02"
  },
  {
    "referencia": "1.1.4.01",
    "linha": "OP02"
  },
  {
    "referencia": "1.1.4.02",
    "linha": "INV03"
  },
  {
    "referencia": "1.1.4.03",
    "linha": "OP03"
  },
  {
    "referencia": "1.1.4.04",
    "linha": "OP02"
  },
  {
    "referencia": "1.1.5.01",
    "linha": "OP04"
  },
  {
    "referencia": "1.1.5.01.01.009",
    "linha": "FIN02"
  },
  {
    "referencia": "1.1.5.02",
    "linha": "OP05"
  },
  {
    "referencia": "1.1.5.03",
    "linha": "OP06"
  },
  {
    "referencia": "1.1.5.03.01.002",
    "linha": "OP08"
  },
  {
    "referencia": "1.1.5.03.01.003",
    "linha": "OP08"
  },
  {
    "referencia": "1.1.5.03.01.029",
    "linha": "OP08"
  },
  {
    "referencia": "1.1.5.03.01.088",
    "linha": "OP08"
  },
  {
    "referencia": "1.1.5.03.01.089",
    "linha": "OP08"
  },
  {
    "referencia": "1.1.5.04",
    "linha": "OP05"
  },
  {
    "referencia": "1.1.6",
    "linha": "OP05"
  },
  {
    "referencia": "1.1.6.02.07.001",
    "linha": "OP04"
  },
  {
    "referencia": "1.1.6.02.07.022",
    "linha": "FIN02"
  },
  {
    "referencia": "1.1.7",
    "linha": "OP03"
  },
  {
    "referencia": "1.1.8.01",
    "linha": "FIN01"
  },
  {
    "referencia": "1.1.8.02",
    "linha": "FIN01"
  },
  {
    "referencia": "1.1.8.03",
    "linha": "OP01"
  },
  {
    "referencia": "1.1.8.04",
    "linha": "OP03"
  },
  {
    "referencia": "1.1.8.05",
    "linha": "OP03"
  },
  {
    "referencia": "1.2.1.01",
    "linha": "OP01"
  },
  {
    "referencia": "1.2.1.02",
    "linha": "INV02"
  },
  {
    "referencia": "1.2.1.03",
    "linha": "INV03"
  },
  {
    "referencia": "1.2.1.04",
    "linha": "OP10"
  },
  {
    "referencia": "1.2.1.05",
    "linha": "OP10"
  },
  {
    "referencia": "1.2.1.06",
    "linha": "OP10"
  },
  {
    "referencia": "1.2.1.07",
    "linha": "OP01"
  },
  {
    "referencia": "1.2.1.30",
    "linha": "OP10"
  },
  {
    "referencia": "1.2.1.50",
    "linha": "OP10"
  },
  {
    "referencia": "1.2.2",
    "linha": "INV03"
  },
  {
    "referencia": "1.2.3",
    "linha": "INV01"
  },
  {
    "referencia": "1.2.4",
    "linha": "INV01"
  },
  {
    "referencia": "1.2.5",
    "linha": "INV01"
  },
  {
    "referencia": "1.3",
    "linha": "COMP"
  },
  {
    "referencia": "1.4",
    "linha": "OP05"
  },
  {
    "referencia": "1.5.1.01",
    "linha": "OP10"
  },
  {
    "referencia": "1.5.1.01.02",
    "linha": "INV02"
  },
  {
    "referencia": "1.5.1.01.04",
    "linha": "OP08"
  },
  {
    "referencia": "1.5.1.01.05",
    "linha": "OP10"
  },
  {
    "referencia": "1.5.1.01.52",
    "linha": "INV02"
  },
  {
    "referencia": "1.5.2",
    "linha": "INV02"
  },
  {
    "referencia": "1.5.3",
    "linha": "INV03"
  },
  {
    "referencia": "1.5.5",
    "linha": "INV01"
  },
  {
    "referencia": "1.5.7",
    "linha": "INV01"
  },
  {
    "referencia": "1.5.7.01.01.055",
    "linha": "OP05"
  },
  {
    "referencia": "1.5.7.02.01.055",
    "linha": "OP05"
  },
  {
    "referencia": "1.5.8",
    "linha": "INV01"
  },
  {
    "referencia": "1.9",
    "linha": "COMP"
  },
  {
    "referencia": "2.1.1.01.01",
    "linha": "OP03"
  },
  {
    "referencia": "2.1.1.01.02",
    "linha": "OP03"
  },
  {
    "referencia": "2.1.1.01.03",
    "linha": "OP01"
  },
  {
    "referencia": "2.1.1.02.01",
    "linha": "FIN01"
  },
  {
    "referencia": "2.1.1.02.01.001",
    "linha": "OP03"
  },
  {
    "referencia": "2.1.1.02.01.002",
    "linha": "OP03"
  },
  {
    "referencia": "2.1.1.02.01.007",
    "linha": "FIN01"
  },
  {
    "referencia": "2.1.1.02.02",
    "linha": "FIN01"
  },
  {
    "referencia": "2.1.1.02.03",
    "linha": "FIN01"
  },
  {
    "referencia": "2.1.1.02.03.012",
    "linha": "OP03"
  },
  {
    "referencia": "2.1.1.02.03.021",
    "linha": "OP03"
  },
  {
    "referencia": "2.1.1.02.04",
    "linha": "FIN01"
  },
  {
    "referencia": "2.1.1.02.05",
    "linha": "FIN01"
  },
  {
    "referencia": "2.1.1.02.06",
    "linha": "FIN02"
  },
  {
    "referencia": "2.1.2.01",
    "linha": "OP04"
  },
  {
    "referencia": "2.1.2.02.01",
    "linha": "OP06"
  },
  {
    "referencia": "2.1.2.02.02",
    "linha": "OP06"
  },
  {
    "referencia": "2.1.2.02.03",
    "linha": "OP06"
  },
  {
    "referencia": "2.1.2.02.04",
    "linha": "OP06"
  },
  {
    "referencia": "2.1.2.02.05",
    "linha": "OP08"
  },
  {
    "referencia": "2.1.2.02.06",
    "linha": "OP08"
  },
  {
    "referencia": "2.1.2.02.07",
    "linha": "OP07"
  },
  {
    "referencia": "2.1.2.02.08",
    "linha": "OP05"
  },
  {
    "referencia": "2.1.2.02.08.001",
    "linha": "OP04"
  },
  {
    "referencia": "2.1.2.02.09",
    "linha": "OP08"
  },
  {
    "referencia": "2.1.2.02.10",
    "linha": "OP08"
  },
  {
    "referencia": "2.1.2.02.15",
    "linha": "FIN02"
  },
  {
    "referencia": "2.1.2.03",
    "linha": "OP05"
  },
  {
    "referencia": "2.1.2.03.02",
    "linha": "FIN03"
  },
  {
    "referencia": "2.1.3.01",
    "linha": "FIN05"
  },
  {
    "referencia": "2.1.3.02",
    "linha": "FIN04"
  },
  {
    "referencia": "2.1.3.03",
    "linha": "OP05"
  },
  {
    "referencia": "2.1.3.04",
    "linha": "FIN04"
  },
  {
    "referencia": "2.1.3.09",
    "linha": "FIN05"
  },
  {
    "referencia": "2.1.4",
    "linha": "OP03"
  },
  {
    "referencia": "2.2.1.01",
    "linha": "FIN04"
  },
  {
    "referencia": "2.2.1.02",
    "linha": "FIN05"
  },
  {
    "referencia": "2.2.1.03",
    "linha": "OP08"
  },
  {
    "referencia": "2.2.1.04",
    "linha": "OP10"
  },
  {
    "referencia": "2.2.1.05",
    "linha": "OP10"
  },
  {
    "referencia": "2.2.1.06",
    "linha": "OP10"
  },
  {
    "referencia": "2.2.1.07",
    "linha": "FIN01"
  },
  {
    "referencia": "2.2.1.08",
    "linha": "OP07"
  },
  {
    "referencia": "2.2.1.09",
    "linha": "FIN04"
  },
  {
    "referencia": "2.2.1.15",
    "linha": "FIN03"
  },
  {
    "referencia": "2.2.1.15.20.055",
    "linha": "OP05"
  },
  {
    "referencia": "2.2.2",
    "linha": "OP02"
  },
  {
    "referencia": "2.3",
    "linha": "PL"
  },
  {
    "referencia": "2.4",
    "linha": "COMP"
  },
  {
    "referencia": "2.5",
    "linha": "OP05"
  },
  {
    "referencia": "2.9",
    "linha": "COMP"
  },
  {
    "referencia": "3.1",
    "linha": "OP01"
  },
  {
    "referencia": "3.2",
    "linha": "OP06"
  },
  {
    "referencia": "3.3",
    "linha": "OP01"
  },
  {
    "referencia": "3.4.1",
    "linha": "OP02"
  },
  {
    "referencia": "3.4.2",
    "linha": "OP02"
  },
  {
    "referencia": "3.4.3",
    "linha": "OP02"
  },
  {
    "referencia": "3.4.4",
    "linha": "OP06"
  },
  {
    "referencia": "3.5.1",
    "linha": "OP09"
  },
  {
    "referencia": "3.5.2",
    "linha": "OP09"
  },
  {
    "referencia": "3.5.3",
    "linha": "OP09"
  },
  {
    "referencia": "3.5.4",
    "linha": "OP09"
  },
  {
    "referencia": "3.5.5",
    "linha": "OP09"
  },
  {
    "referencia": "3.5.6",
    "linha": "OP09"
  },
  {
    "referencia": "3.5.7",
    "linha": "OP09"
  },
  {
    "referencia": "3.5.9",
    "linha": "OP06"
  },
  {
    "referencia": "3.6.1.01",
    "linha": "INV01"
  },
  {
    "referencia": "3.6.1.02",
    "linha": "INV03"
  },
  {
    "referencia": "3.6.1.03",
    "linha": "INV03"
  },
  {
    "referencia": "3.9.1.01",
    "linha": "OP01"
  },
  {
    "referencia": "3.9.1.02",
    "linha": "OP06"
  },
  {
    "referencia": "4.1.1",
    "linha": "OP03"
  },
  {
    "referencia": "4.1.2",
    "linha": "OP03"
  },
  {
    "referencia": "4.1.3",
    "linha": "OP03"
  },
  {
    "referencia": "4.1.5",
    "linha": "OP04"
  },
  {
    "referencia": "4.2",
    "linha": "OP03"
  },
  {
    "referencia": "5.1.1",
    "linha": "OP04"
  },
  {
    "referencia": "5.1.2",
    "linha": "OP05"
  },
  {
    "referencia": "5.1.3",
    "linha": "OP05"
  },
  {
    "referencia": "5.1.3.04",
    "linha": "INV01"
  },
  {
    "referencia": "5.1.4",
    "linha": "OP05"
  },
  {
    "referencia": "5.1.5",
    "linha": "OP05"
  },
  {
    "referencia": "5.1.5.01",
    "linha": "OP04"
  },
  {
    "referencia": "5.2.1",
    "linha": "FIN02"
  },
  {
    "referencia": "5.2.2",
    "linha": "FIN02"
  },
  {
    "referencia": "5.2.3",
    "linha": "OP05"
  },
  {
    "referencia": "5.2.4",
    "linha": "OP05"
  },
  {
    "referencia": "5.2.5",
    "linha": "FIN02"
  },
  {
    "referencia": "5.2.6",
    "linha": "OP03"
  },
  {
    "referencia": "5.2.7",
    "linha": "OP01"
  },
  {
    "referencia": "5.2.8.01",
    "linha": "OP05"
  },
  {
    "referencia": "5.2.8.02",
    "linha": "FIN02"
  },
  {
    "referencia": "5.2.9.01",
    "linha": "FIN02"
  },
  {
    "referencia": "5.2.9.02",
    "linha": "OP07"
  },
  {
    "referencia": "5.2.9.03",
    "linha": "OP05"
  },
  {
    "referencia": "5.2.9.04",
    "linha": "FIN02"
  },
  {
    "referencia": "5.2.9.05",
    "linha": "OP10"
  },
  {
    "referencia": "5.2.9.06",
    "linha": "OP09"
  },
  {
    "referencia": "5.3.1.01",
    "linha": "INV01"
  },
  {
    "referencia": "5.3.1.01.03",
    "linha": "INV03"
  },
  {
    "referencia": "5.3.1.01.04",
    "linha": "OP05"
  },
  {
    "referencia": "5.3.1.01.05",
    "linha": "OP05"
  },
  {
    "referencia": "5.3.1.03",
    "linha": "FIN04"
  },
  {
    "referencia": "5.3.1.06",
    "linha": "INV03"
  },
  {
    "referencia": "5.5.1.01",
    "linha": "OP04"
  },
  {
    "referencia": "5.5.1.02",
    "linha": "OP05"
  },
  {
    "referencia": "5.5.1.80",
    "linha": "OP05"
  },
  {
    "referencia": "5.5.2.01",
    "linha": "OP04"
  },
  {
    "referencia": "5.5.2.05",
    "linha": "OP05"
  },
  {
    "referencia": "5.5.2.07",
    "linha": "OP05"
  },
  {
    "referencia": "5.5.2.07.20",
    "linha": "INV01"
  },
  {
    "referencia": "5.5.2.20",
    "linha": "OP05"
  },
  {
    "referencia": "5.5.7.01.01.001",
    "linha": "FIN02"
  },
  {
    "referencia": "5.5.7.01.01.005",
    "linha": "FIN02"
  },
  {
    "referencia": "5.5.7.01.01.008",
    "linha": "OP03"
  },
  {
    "referencia": "5.5.7.01.01.009",
    "linha": "FIN03"
  },
  {
    "referencia": "5.5.7.01.01.015",
    "linha": "OP05"
  },
  {
    "referencia": "5.5.7.01.01.020",
    "linha": "FIN04"
  },
  {
    "referencia": "5.5.7.01.05",
    "linha": "FIN02"
  },
  {
    "referencia": "5.5.7.01.25",
    "linha": "OP05"
  },
  {
    "referencia": "5.5.9",
    "linha": "INV01"
  },
  {
    "referencia": "5.9",
    "linha": "OP05"
  },
  {
    "referencia": "6.1",
    "linha": "PL"
  },
  {
    "referencia": "6.2",
    "linha": "PL"
  },
  {
    "referencia": "6.3",
    "linha": "PL"
  },
  {
    "referencia": "6.4",
    "linha": "OP08"
  },
  {
    "referencia": "6.5",
    "linha": "PL"
  }
] as const;
