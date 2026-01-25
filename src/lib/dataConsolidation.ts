/**
 * Utilitário para consolidação de dados VW + Audi
 * 
 * Este módulo consolida os dados das DREs de Volkswagen e Audi,
 * somando valores absolutos e recalculando percentuais com base nos totais.
 */

import { type MetricsData } from './dataStorage';

/**
 * Soma dois arrays numéricos elemento por elemento
 */
function sumArrays(arr1: number[], arr2: number[]): number[] {
  return arr1.map((val, idx) => val + (arr2[idx] || 0));
}

/**
 * Calcula percentual recalculado: (valor1 + valor2) / (total1 + total2) * 100
 */
function recalculatePercentage(
  value1: number[], 
  total1: number[], 
  value2: number[], 
  total2: number[]
): number[] {
  return value1.map((_, idx) => {
    const sumValues = (value1[idx] || 0) + (value2[idx] || 0);
    const sumTotals = (total1[idx] || 0) + (total2[idx] || 0);
    return sumTotals !== 0 ? (sumValues / sumTotals) * 100 : 0;
  });
}

/**
 * Calcula margem recalculada: (lucro1 + lucro2) / (vendas1 + vendas2) * 100
 */
function recalculateMargin(
  lucro1: number[], 
  vendas1: number[], 
  lucro2: number[], 
  vendas2: number[]
): number[] {
  return lucro1.map((_, idx) => {
    const sumLucro = (lucro1[idx] || 0) + (lucro2[idx] || 0);
    const sumVendas = (vendas1[idx] || 0) + (vendas2[idx] || 0);
    return sumVendas !== 0 ? (sumLucro / sumVendas) * 100 : 0;
  });
}

/**
 * Consolida os dados de duas marcas (VW + Audi)
 * Soma valores absolutos e recalcula percentuais e margens
 */
export function consolidateMetricsData(
  vwData: MetricsData, 
  audiData: MetricsData
): MetricsData {
  return {
    months: vwData.months, // Usa os meses de uma das marcas (devem ser iguais)
    
    // Vendas de Novos
    vendasNovos: {
      vendas: sumArrays(vwData.vendasNovos.vendas, audiData.vendasNovos.vendas),
      volumeTrocas: sumArrays(vwData.vendasNovos.volumeTrocas, audiData.vendasNovos.volumeTrocas),
      percentualTrocas: recalculatePercentage(
        vwData.vendasNovos.volumeTrocas,
        vwData.vendasNovos.vendas,
        audiData.vendasNovos.volumeTrocas,
        audiData.vendasNovos.vendas
      )
    },
    
    // Vendas de Novos VD
    vendasNovosVD: {
      vendas: sumArrays(vwData.vendasNovosVD.vendas, audiData.vendasNovosVD.vendas),
      volumeTrocas: sumArrays(vwData.vendasNovosVD.volumeTrocas, audiData.vendasNovosVD.volumeTrocas),
      percentualTrocas: recalculatePercentage(
        vwData.vendasNovosVD.volumeTrocas,
        vwData.vendasNovosVD.vendas,
        audiData.vendasNovosVD.volumeTrocas,
        audiData.vendasNovosVD.vendas
      )
    },
    
    // Vendas de Usados
    vendasUsados: {
      vendas: sumArrays(vwData.vendasUsados.vendas, audiData.vendasUsados.vendas),
      volumeTrocas: sumArrays(vwData.vendasUsados.volumeTrocas, audiData.vendasUsados.volumeTrocas),
      percentualTrocas: recalculatePercentage(
        vwData.vendasUsados.volumeTrocas,
        vwData.vendasUsados.vendas,
        audiData.vendasUsados.volumeTrocas,
        audiData.vendasUsados.vendas
      )
    },
    
    // Volume de Vendas
    volumeVendas: {
      usados: sumArrays(vwData.volumeVendas.usados, audiData.volumeVendas.usados),
      repasse: sumArrays(vwData.volumeVendas.repasse, audiData.volumeVendas.repasse),
      percentualRepasse: recalculatePercentage(
        vwData.volumeVendas.repasse,
        vwData.volumeVendas.usados,
        audiData.volumeVendas.repasse,
        audiData.volumeVendas.usados
      )
    },
    
    // Estoque de Veículos Novos
    estoqueNovos: {
      quantidade: sumArrays(vwData.estoqueNovos.quantidade, audiData.estoqueNovos.quantidade),
      valor: sumArrays(vwData.estoqueNovos.valor, audiData.estoqueNovos.valor),
      aPagar: sumArrays(vwData.estoqueNovos.aPagar, audiData.estoqueNovos.aPagar),
      pagos: sumArrays(vwData.estoqueNovos.pagos, audiData.estoqueNovos.pagos)
    },
    
    // Estoque de Veículos Usados
    estoqueUsados: {
      quantidade: sumArrays(vwData.estoqueUsados.quantidade, audiData.estoqueUsados.quantidade),
      valor: sumArrays(vwData.estoqueUsados.valor, audiData.estoqueUsados.valor),
      aPagar: sumArrays(vwData.estoqueUsados.aPagar, audiData.estoqueUsados.aPagar),
      pagos: sumArrays(vwData.estoqueUsados.pagos, audiData.estoqueUsados.pagos)
    },
    
    // Estoque de Peças
    estoquePecas: {
      quantidade: vwData.estoquePecas.quantidade && audiData.estoquePecas.quantidade
        ? sumArrays(vwData.estoquePecas.quantidade, audiData.estoquePecas.quantidade)
        : undefined,
      valor: sumArrays(vwData.estoquePecas.valor, audiData.estoquePecas.valor),
      aPagar: sumArrays(vwData.estoquePecas.aPagar, audiData.estoquePecas.aPagar),
      pagos: sumArrays(vwData.estoquePecas.pagos, audiData.estoquePecas.pagos)
    },
    
    // Vendas de Peças
    vendasPecas: vwData.vendasPecas && audiData.vendasPecas ? {
      balcao: vwData.vendasPecas.balcao && audiData.vendasPecas.balcao ? {
        vendas: sumArrays(vwData.vendasPecas.balcao.vendas, audiData.vendasPecas.balcao.vendas),
        lucro: sumArrays(vwData.vendasPecas.balcao.lucro, audiData.vendasPecas.balcao.lucro),
        margem: recalculateMargin(
          vwData.vendasPecas.balcao.lucro,
          vwData.vendasPecas.balcao.vendas,
          audiData.vendasPecas.balcao.lucro,
          audiData.vendasPecas.balcao.vendas
        )
      } : undefined,
      oficina: vwData.vendasPecas.oficina && audiData.vendasPecas.oficina ? {
        vendas: sumArrays(vwData.vendasPecas.oficina.vendas, audiData.vendasPecas.oficina.vendas),
        lucro: sumArrays(vwData.vendasPecas.oficina.lucro, audiData.vendasPecas.oficina.lucro),
        margem: recalculateMargin(
          vwData.vendasPecas.oficina.lucro,
          vwData.vendasPecas.oficina.vendas,
          audiData.vendasPecas.oficina.lucro,
          audiData.vendasPecas.oficina.vendas
        )
      } : undefined,
      funilaria: vwData.vendasPecas.funilaria && audiData.vendasPecas.funilaria ? {
        vendas: sumArrays(vwData.vendasPecas.funilaria.vendas, audiData.vendasPecas.funilaria.vendas),
        lucro: sumArrays(vwData.vendasPecas.funilaria.lucro, audiData.vendasPecas.funilaria.lucro),
        margem: recalculateMargin(
          vwData.vendasPecas.funilaria.lucro,
          vwData.vendasPecas.funilaria.vendas,
          audiData.vendasPecas.funilaria.lucro,
          audiData.vendasPecas.funilaria.vendas
        )
      } : undefined,
      acessorios: vwData.vendasPecas.acessorios && audiData.vendasPecas.acessorios ? {
        vendas: sumArrays(vwData.vendasPecas.acessorios.vendas, audiData.vendasPecas.acessorios.vendas),
        lucro: sumArrays(vwData.vendasPecas.acessorios.lucro, audiData.vendasPecas.acessorios.lucro),
        margem: recalculateMargin(
          vwData.vendasPecas.acessorios.lucro,
          vwData.vendasPecas.acessorios.vendas,
          audiData.vendasPecas.acessorios.lucro,
          audiData.vendasPecas.acessorios.vendas
        )
      } : undefined,
      seguradoraTotal: vwData.vendasPecas.seguradoraTotal && audiData.vendasPecas.seguradoraTotal ? {
        vendas: sumArrays(vwData.vendasPecas.seguradoraTotal.vendas, audiData.vendasPecas.seguradoraTotal.vendas),
        lucro: sumArrays(vwData.vendasPecas.seguradoraTotal.lucro, audiData.vendasPecas.seguradoraTotal.lucro),
        margem: recalculateMargin(
          vwData.vendasPecas.seguradoraTotal.lucro,
          vwData.vendasPecas.seguradoraTotal.vendas,
          audiData.vendasPecas.seguradoraTotal.lucro,
          audiData.vendasPecas.seguradoraTotal.vendas
        )
      } : undefined
    } : undefined,
    
    // Seguradoras
    seguradoras: vwData.seguradoras && audiData.seguradoras ? {
      portoSeguro: vwData.seguradoras.portoSeguro && audiData.seguradoras.portoSeguro ? {
        vendas: sumArrays(vwData.seguradoras.portoSeguro.vendas, audiData.seguradoras.portoSeguro.vendas),
        lucro: sumArrays(vwData.seguradoras.portoSeguro.lucro, audiData.seguradoras.portoSeguro.lucro),
        margem: recalculateMargin(
          vwData.seguradoras.portoSeguro.lucro,
          vwData.seguradoras.portoSeguro.vendas,
          audiData.seguradoras.portoSeguro.lucro,
          audiData.seguradoras.portoSeguro.vendas
        )
      } : undefined,
      azul: vwData.seguradoras.azul && audiData.seguradoras.azul ? {
        vendas: sumArrays(vwData.seguradoras.azul.vendas, audiData.seguradoras.azul.vendas),
        lucro: sumArrays(vwData.seguradoras.azul.lucro, audiData.seguradoras.azul.lucro),
        margem: recalculateMargin(
          vwData.seguradoras.azul.lucro,
          vwData.seguradoras.azul.vendas,
          audiData.seguradoras.azul.lucro,
          audiData.seguradoras.azul.vendas
        )
      } : undefined,
      allianz: vwData.seguradoras.allianz && audiData.seguradoras.allianz ? {
        vendas: sumArrays(vwData.seguradoras.allianz.vendas, audiData.seguradoras.allianz.vendas),
        lucro: sumArrays(vwData.seguradoras.allianz.lucro, audiData.seguradoras.allianz.lucro),
        margem: recalculateMargin(
          vwData.seguradoras.allianz.lucro,
          vwData.seguradoras.allianz.vendas,
          audiData.seguradoras.allianz.lucro,
          audiData.seguradoras.allianz.vendas
        )
      } : undefined,
      tokioMarine: vwData.seguradoras.tokioMarine && audiData.seguradoras.tokioMarine ? {
        vendas: sumArrays(vwData.seguradoras.tokioMarine.vendas, audiData.seguradoras.tokioMarine.vendas),
        lucro: sumArrays(vwData.seguradoras.tokioMarine.lucro, audiData.seguradoras.tokioMarine.lucro),
        margem: recalculateMargin(
          vwData.seguradoras.tokioMarine.lucro,
          vwData.seguradoras.tokioMarine.vendas,
          audiData.seguradoras.tokioMarine.lucro,
          audiData.seguradoras.tokioMarine.vendas
        )
      } : undefined
    } : undefined,
    
    // Mercado Livre
    mercadoLivre: vwData.mercadoLivre && audiData.mercadoLivre ? {
      vendas: sumArrays(vwData.mercadoLivre.vendas, audiData.mercadoLivre.vendas),
      lucro: sumArrays(vwData.mercadoLivre.lucro, audiData.mercadoLivre.lucro),
      margem: recalculateMargin(
        vwData.mercadoLivre.lucro,
        vwData.mercadoLivre.vendas,
        audiData.mercadoLivre.lucro,
        audiData.mercadoLivre.vendas
      )
    } : undefined,
    
    // Juros
    juros: vwData.juros && audiData.juros ? {
      veiculosNovos: sumArrays(vwData.juros.veiculosNovos, audiData.juros.veiculosNovos),
      veiculosUsados: sumArrays(vwData.juros.veiculosUsados, audiData.juros.veiculosUsados),
      pecas: sumArrays(vwData.juros.pecas, audiData.juros.pecas),
      emprestimosBancarios: sumArrays(vwData.juros.emprestimosBancarios, audiData.juros.emprestimosBancarios),
      contratoMutuo: sumArrays(vwData.juros.contratoMutuo, audiData.juros.contratoMutuo)
    } : undefined,
    
    // Custos
    custos: vwData.custos && audiData.custos ? {
      garantia: sumArrays(vwData.custos.garantia, audiData.custos.garantia),
      reparoUsados: sumArrays(vwData.custos.reparoUsados, audiData.custos.reparoUsados),
      ticketMedioReparo: vwData.custos.ticketMedioReparo.map((vwVal, idx) => {
        const audiVal = audiData.custos!.ticketMedioReparo[idx] || 0;
        const vwQtd = vwData.custos!.reparoUsados[idx] || 0;
        const audiQtd = audiData.custos!.reparoUsados[idx] || 0;
        const totalQtd = vwQtd + audiQtd;
        return totalQtd !== 0 ? ((vwVal * vwQtd) + (audiVal * audiQtd)) / totalQtd : 0;
      })
    } : undefined,
    
    // Despesas Cartão
    despesasCartao: vwData.despesasCartao && audiData.despesasCartao ? {
      novos: sumArrays(vwData.despesasCartao.novos, audiData.despesasCartao.novos),
      vendaDireta: sumArrays(vwData.despesasCartao.vendaDireta, audiData.despesasCartao.vendaDireta),
      usados: sumArrays(vwData.despesasCartao.usados, audiData.despesasCartao.usados),
      pecas: sumArrays(vwData.despesasCartao.pecas, audiData.despesasCartao.pecas),
      oficina: sumArrays(vwData.despesasCartao.oficina, audiData.despesasCartao.oficina),
      funilaria: sumArrays(vwData.despesasCartao.funilaria, audiData.despesasCartao.funilaria),
      administracao: sumArrays(vwData.despesasCartao.administracao, audiData.despesasCartao.administracao)
    } : undefined,
    
    // Bônus
    bonus: vwData.bonus && audiData.bonus ? {
      veiculosNovos: sumArrays(vwData.bonus.veiculosNovos, audiData.bonus.veiculosNovos),
      veiculosUsados: sumArrays(vwData.bonus.veiculosUsados, audiData.bonus.veiculosUsados),
      pecas: sumArrays(vwData.bonus.pecas, audiData.bonus.pecas),
      oficina: sumArrays(vwData.bonus.oficina, audiData.bonus.oficina),
      funilaria: sumArrays(vwData.bonus.funilaria, audiData.bonus.funilaria),
      administracao: sumArrays(vwData.bonus.administracao, audiData.bonus.administracao)
    } : undefined,
    
    // Receitas de Financiamento
    receitasFinanciamento: vwData.receitasFinanciamento && audiData.receitasFinanciamento ? {
      veiculosNovos: sumArrays(vwData.receitasFinanciamento.veiculosNovos, audiData.receitasFinanciamento.veiculosNovos),
      veiculosUsados: sumArrays(vwData.receitasFinanciamento.veiculosUsados, audiData.receitasFinanciamento.veiculosUsados)
    } : undefined,
    
    // Créditos ICMS
    creditosICMS: vwData.creditosICMS && audiData.creditosICMS ? {
      novos: sumArrays(vwData.creditosICMS.novos, audiData.creditosICMS.novos),
      pecas: sumArrays(vwData.creditosICMS.pecas, audiData.creditosICMS.pecas),
      administracao: sumArrays(vwData.creditosICMS.administracao, audiData.creditosICMS.administracao)
    } : undefined,
    
    // Créditos PIS/COFINS
    creditosPISCOFINS: vwData.creditosPISCOFINS && audiData.creditosPISCOFINS ? {
      administracao: sumArrays(vwData.creditosPISCOFINS.administracao, audiData.creditosPISCOFINS.administracao)
    } : undefined,
    
    // Receitas Simples
    receitaBlindagem: vwData.receitaBlindagem && audiData.receitaBlindagem
      ? sumArrays(vwData.receitaBlindagem, audiData.receitaBlindagem)
      : undefined,
    receitaDespachanteUsados: vwData.receitaDespachanteUsados && audiData.receitaDespachanteUsados
      ? sumArrays(vwData.receitaDespachanteUsados, audiData.receitaDespachanteUsados)
      : undefined,
    receitaDespachanteNovos: vwData.receitaDespachanteNovos && audiData.receitaDespachanteNovos
      ? sumArrays(vwData.receitaDespachanteNovos, audiData.receitaDespachanteNovos)
      : undefined,
    
    // Margens Operacionais (formato simplificado)
    margensOperacionais: vwData.margensOperacionais && audiData.margensOperacionais ? {
      novos: sumArrays(vwData.margensOperacionais.novos, audiData.margensOperacionais.novos),
      usados: sumArrays(vwData.margensOperacionais.usados, audiData.margensOperacionais.usados),
      oficina: sumArrays(vwData.margensOperacionais.oficina, audiData.margensOperacionais.oficina),
      pecas: sumArrays(vwData.margensOperacionais.pecas, audiData.margensOperacionais.pecas)
    } : undefined,
    
    // Receita Vendas
    receitaVendas: vwData.receitaVendas && audiData.receitaVendas ? {
      novos: sumArrays(vwData.receitaVendas.novos, audiData.receitaVendas.novos),
      usados: sumArrays(vwData.receitaVendas.usados, audiData.receitaVendas.usados)
    } : undefined,
    
    // Resultado Financeiro
    resultadoFinanceiro: vwData.resultadoFinanceiro && audiData.resultadoFinanceiro ? {
      receitas: sumArrays(vwData.resultadoFinanceiro.receitas, audiData.resultadoFinanceiro.receitas),
      despesas: sumArrays(vwData.resultadoFinanceiro.despesas, audiData.resultadoFinanceiro.despesas),
      resultado: sumArrays(vwData.resultadoFinanceiro.resultado, audiData.resultadoFinanceiro.resultado)
    } : undefined,
    
    // Despesas Pessoal
    despesasPessoal: vwData.despesasPessoal && audiData.despesasPessoal ? {
      custo: sumArrays(vwData.despesasPessoal.custo, audiData.despesasPessoal.custo),
      hc: sumArrays(vwData.despesasPessoal.hc, audiData.despesasPessoal.hc)
    } : undefined,
    
    // Receitas Oficina
    receitasOficina: vwData.receitasOficina && audiData.receitasOficina ? {
      garantia: sumArrays(vwData.receitasOficina.garantia, audiData.receitasOficina.garantia),
      clientePago: sumArrays(vwData.receitasOficina.clientePago, audiData.receitasOficina.clientePago),
      interno: sumArrays(vwData.receitasOficina.interno, audiData.receitasOficina.interno)
    } : undefined,
    
    // Receitas Peças
    receitasPecas: vwData.receitasPecas && audiData.receitasPecas ? {
      balcao: sumArrays(vwData.receitasPecas.balcao, audiData.receitasPecas.balcao),
      oficina: sumArrays(vwData.receitasPecas.oficina, audiData.receitasPecas.oficina),
      externo: sumArrays(vwData.receitasPecas.externo, audiData.receitasPecas.externo)
    } : undefined,
    
    // Fluxo de Caixa
    fluxoCaixa: vwData.fluxoCaixa && audiData.fluxoCaixa ? {
      recebimentos: sumArrays(vwData.fluxoCaixa.recebimentos, audiData.fluxoCaixa.recebimentos),
      pagamentos: sumArrays(vwData.fluxoCaixa.pagamentos, audiData.fluxoCaixa.pagamentos),
      saldo: sumArrays(vwData.fluxoCaixa.saldo, audiData.fluxoCaixa.saldo)
    } : undefined,
    
    // Capital
    capital: vwData.capital && audiData.capital ? {
      capitalProprio: sumArrays(vwData.capital.capitalProprio || [], audiData.capital.capitalProprio || []),
      capitalTerceiros: sumArrays(vwData.capital.capitalTerceiros || [], audiData.capital.capitalTerceiros || []),
      capitalTotal: sumArrays(vwData.capital.capitalTotal || [], audiData.capital.capitalTotal || [])
    } : undefined
  };
}
