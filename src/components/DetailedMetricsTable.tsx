import React from 'react';
import { businessMetricsData } from '../data/businessMetricsData';

// Definição completa de todas as 43 métricas com seus dados
const allMetrics = [
  // 1-4: Vendas
  { id: 1, bg: 'bg-blue-50 dark:bg-blue-900/20', title: 'Vendas de Veículos Novos', data: businessMetricsData.vendasNovos, fields: ['vendas', 'volumeTrocas', 'percentualTrocas'], labels: ['Vendas de Veículos Novos', 'Volume de Trocas Novos', '% de Trocas Novos'] },
  { id: 2, bg: 'bg-green-50 dark:bg-green-900/20', title: 'Vendas de Veículos Novos VD', data: businessMetricsData.vendasNovosVD, fields: ['vendas', 'volumeTrocas', 'percentualTrocas'], labels: ['Vendas de Veículos Novos VD', 'Volume de Trocas VD', '% de Trocas VD'] },
  { id: 3, bg: 'bg-yellow-50 dark:bg-yellow-900/20', title: 'Vendas de Veículos Usados', data: businessMetricsData.vendasUsados, fields: ['vendas', 'volumeTrocas', 'percentualTrocas'], labels: ['Vendas de Veículos Usados', 'Volume de Trocas Usados', '% de Trocas Usados'] },
  { id: 4, bg: 'bg-purple-50 dark:bg-purple-900/20', title: 'Volume de Vendas', data: businessMetricsData.volumeVendas, fields: ['usados', 'repasse', 'percentualRepasse'], labels: ['Volume de Vendas Usados', 'Volume de Repasse', '% de Repasse'] },
  
  // 5-7: Estoques
  { id: 5, bg: 'bg-red-50 dark:bg-red-900/20', title: 'Estoque de Veículos Novos', data: businessMetricsData.estoqueNovos, fields: ['quantidade', 'valor', 'aPagar', 'pagos'], labels: ['Quantidade', 'Estoque Total', 'A Pagar', 'Pagos'] },
  { id: 6, bg: 'bg-indigo-50 dark:bg-indigo-900/20', title: 'Estoque de Veículos Usados', data: businessMetricsData.estoqueUsados, fields: ['quantidade', 'valor', 'aPagar', 'pagos'], labels: ['Quantidade', 'Estoque Total', 'A Pagar', 'Pagos'] },
  { id: 7, bg: 'bg-cyan-50 dark:bg-cyan-900/20', title: 'Estoque de Peças', data: businessMetricsData.estoquePecas, fields: ['valor', 'aPagar', 'pagos'], labels: ['Estoque Total', 'A Pagar', 'Pagos'] },
  
  // 8-12: Vendas de Peças
  { id: 8, bg: 'bg-purple-50 dark:bg-purple-900/20', title: 'Vendas de Peças - Balcão', data: businessMetricsData.vendasPecas.balcao, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
  { id: 9, bg: 'bg-amber-50 dark:bg-amber-900/20', title: 'Vendas de Peças - Oficina', data: businessMetricsData.vendasPecas.oficina, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
  { id: 10, bg: 'bg-orange-50 dark:bg-orange-900/20', title: 'Vendas de Peças - Funilaria', data: businessMetricsData.vendasPecas.funilaria, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
  { id: 11, bg: 'bg-pink-50 dark:bg-pink-900/20', title: 'Vendas de Peças - Acessórios', data: businessMetricsData.vendasPecas.acessorios, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
  { id: 12, bg: 'bg-teal-50 dark:bg-teal-900/20', title: 'Vendas de Peças - Seguradora', data: businessMetricsData.vendasPecas.seguradoraTotal, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
  
  // 13-16: Seguradoras
  { id: 13, bg: 'bg-sky-50 dark:bg-sky-900/20', title: 'Seguradora - Porto Seguro', data: businessMetricsData.seguradoras.portoSeguro, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
  { id: 14, bg: 'bg-blue-50 dark:bg-blue-900/20', title: 'Seguradora - Azul', data: businessMetricsData.seguradoras.azul, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
  { id: 15, bg: 'bg-indigo-50 dark:bg-indigo-900/20', title: 'Seguradora - Allianz', data: businessMetricsData.seguradoras.allianz, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
  { id: 16, bg: 'bg-violet-50 dark:bg-violet-900/20', title: 'Seguradora - Tokio Marine', data: businessMetricsData.seguradoras.tokioMarine, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
  
  // 17: Mercado Livre
  { id: 17, bg: 'bg-yellow-50 dark:bg-yellow-900/20', title: 'Mercado Livre', data: businessMetricsData.mercadoLivre, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
  
  // 18-22: Juros
  { id: 18, bg: 'bg-red-50 dark:bg-red-900/20', title: 'Juros - Veículos Novos', data: { valor: businessMetricsData.juros.veiculosNovos }, fields: ['valor'], labels: ['Juros'] },
  { id: 19, bg: 'bg-orange-50 dark:bg-orange-900/20', title: 'Juros - Veículos Usados', data: { valor: businessMetricsData.juros.veiculosUsados }, fields: ['valor'], labels: ['Juros'] },
  { id: 20, bg: 'bg-amber-50 dark:bg-amber-900/20', title: 'Juros - Peças', data: { valor: businessMetricsData.juros.pecas }, fields: ['valor'], labels: ['Juros'] },
  { id: 21, bg: 'bg-lime-50 dark:bg-lime-900/20', title: 'Juros - Empréstimos Bancários', data: { valor: businessMetricsData.juros.emprestimosBancarios }, fields: ['valor'], labels: ['Juros'] },
  { id: 22, bg: 'bg-green-50 dark:bg-green-900/20', title: 'Juros - Contrato de Mútuo', data: { valor: businessMetricsData.juros.contratoMutuo }, fields: ['valor'], labels: ['Juros'] },
  
  // 23-24: Custos
  { id: 23, bg: 'bg-cyan-50 dark:bg-cyan-900/20', title: 'Custos - Garantia', data: { valor: businessMetricsData.custos.garantia }, fields: ['valor'], labels: ['Custos'] },
  { id: 24, bg: 'bg-teal-50 dark:bg-teal-900/20', title: 'Custos - Reparo de Usados', data: businessMetricsData.custos, fields: ['reparoUsados', 'ticketMedioReparo'], labels: ['Custos Reparo', 'Ticket Médio'] },
  
  // 25-31: Despesas Cartão
  { id: 25, bg: 'bg-purple-50 dark:bg-purple-900/20', title: 'Despesas Cartão - Novos', data: { valor: businessMetricsData.despesasCartao.novos }, fields: ['valor'], labels: ['Despesas'] },
  { id: 26, bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20', title: 'Despesas Cartão - Venda Direta', data: { valor: businessMetricsData.despesasCartao.vendaDireta }, fields: ['valor'], labels: ['Despesas'] },
  { id: 27, bg: 'bg-pink-50 dark:bg-pink-900/20', title: 'Despesas Cartão - Usados', data: { valor: businessMetricsData.despesasCartao.usados }, fields: ['valor'], labels: ['Despesas'] },
  { id: 28, bg: 'bg-rose-50 dark:bg-rose-900/20', title: 'Despesas Cartão - Peças', data: { valor: businessMetricsData.despesasCartao.pecas }, fields: ['valor'], labels: ['Despesas'] },
  { id: 29, bg: 'bg-red-50 dark:bg-red-900/20', title: 'Despesas Cartão - Oficina', data: { valor: businessMetricsData.despesasCartao.oficina }, fields: ['valor'], labels: ['Despesas'] },
  { id: 30, bg: 'bg-orange-50 dark:bg-orange-900/20', title: 'Despesas Cartão - Funilaria', data: { valor: businessMetricsData.despesasCartao.funilaria }, fields: ['valor'], labels: ['Despesas'] },
  { id: 31, bg: 'bg-amber-50 dark:bg-amber-900/20', title: 'Despesas Cartão - Administração', data: { valor: businessMetricsData.despesasCartao.administracao }, fields: ['valor'], labels: ['Despesas'] },
  
  // 32-37: Bônus
  { id: 32, bg: 'bg-emerald-50 dark:bg-emerald-900/20', title: 'Bônus - Veículos Novos', data: { valor: businessMetricsData.bonus.veiculosNovos }, fields: ['valor'], labels: ['Bônus'] },
  { id: 33, bg: 'bg-teal-50 dark:bg-teal-900/20', title: 'Bônus - Veículos Usados', data: { valor: businessMetricsData.bonus.veiculosUsados }, fields: ['valor'], labels: ['Bônus'] },
  { id: 34, bg: 'bg-cyan-50 dark:bg-cyan-900/20', title: 'Bônus - Peças', data: { valor: businessMetricsData.bonus.pecas }, fields: ['valor'], labels: ['Bônus'] },
  { id: 35, bg: 'bg-sky-50 dark:bg-sky-900/20', title: 'Bônus - Oficina', data: { valor: businessMetricsData.bonus.oficina }, fields: ['valor'], labels: ['Bônus'] },
  { id: 36, bg: 'bg-blue-50 dark:bg-blue-900/20', title: 'Bônus - Funilaria', data: { valor: businessMetricsData.bonus.funilaria }, fields: ['valor'], labels: ['Bônus'] },
  { id: 37, bg: 'bg-indigo-50 dark:bg-indigo-900/20', title: 'Bônus - Administração', data: { valor: businessMetricsData.bonus.administracao }, fields: ['valor'], labels: ['Bônus'] },
  
  // 38-39: Receitas de Financiamento
  { id: 38, bg: 'bg-violet-50 dark:bg-violet-900/20', title: 'Receitas Financiamento - Novos', data: { valor: businessMetricsData.receitasFinanciamento.veiculosNovos }, fields: ['valor'], labels: ['Receitas'] },
  { id: 39, bg: 'bg-purple-50 dark:bg-purple-900/20', title: 'Receitas Financiamento - Usados', data: { valor: businessMetricsData.receitasFinanciamento.veiculosUsados }, fields: ['valor'], labels: ['Receitas'] },
  
  // 40-42: Créditos ICMS
  { id: 40, bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20', title: 'Créditos ICMS - Novos', data: { valor: businessMetricsData.creditosICMS.novos }, fields: ['valor'], labels: ['Créditos'] },
  { id: 41, bg: 'bg-pink-50 dark:bg-pink-900/20', title: 'Créditos ICMS - Peças', data: { valor: businessMetricsData.creditosICMS.pecas }, fields: ['valor'], labels: ['Créditos'] },
  { id: 42, bg: 'bg-rose-50 dark:bg-rose-900/20', title: 'Créditos ICMS - Administração', data: { valor: businessMetricsData.creditosICMS.administracao }, fields: ['valor'], labels: ['Créditos'] },
  
  // 43: Créditos PIS e COFINS
  { id: 43, bg: 'bg-red-50 dark:bg-red-900/20', title: 'Créditos PIS/COFINS - Admin', data: { valor: businessMetricsData.creditosPISCOFINS.administracao }, fields: ['valor'], labels: ['Créditos'] },
  
  // 44: Receita de Blindagem
  { id: 44, bg: 'bg-amber-50 dark:bg-amber-900/20', title: 'Receita de Blindagem', data: { valor: businessMetricsData.receitaBlindagem }, fields: ['valor'], labels: ['Receitas'] },
  
  // 45: Receita de Despachante Usados
  { id: 45, bg: 'bg-lime-50 dark:bg-lime-900/20', title: 'Receita de Despachante Usados', data: { valor: businessMetricsData.receitaDespachanteUsados }, fields: ['valor'], labels: ['Receitas'] },
  
  // 46: Receita de Despachante Novos
  { id: 46, bg: 'bg-green-50 dark:bg-green-900/20', title: 'Receita de Despachante Novos', data: { valor: businessMetricsData.receitaDespachanteNovos }, fields: ['valor'], labels: ['Receitas'] },
  
  // 47: Resumo
  { id: 47, bg: 'bg-slate-200 dark:bg-slate-700', title: 'RESUMO CONSOLIDADO', data: { valor: Array(12).fill(0) }, fields: ['valor'], labels: ['TOTAL GERAL'] }
];

export function DetailedMetricsTable() {
  const formatValue = (value: number, field: string) => {
    if (field.includes('percentual') || field === 'margem') {
      return `${value.toFixed(2)}%`;
    }
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const months = businessMetricsData.months;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800">
            <th className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left font-semibold sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 min-w-[50px]">ID</th>
            <th className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left font-semibold min-w-[280px]">Descrição</th>
            {months.map((month, i) => (
              <th key={i} className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-right font-semibold min-w-[100px]">{month}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allMetrics.map((metric) => (
            <React.Fragment key={metric.id}>
              {metric.fields.map((field, fieldIndex) => {
                const isMainRow = fieldIndex === 0;
                const isPercentageRow = field.includes('percentual') || field === 'margem';
                const rowBg = isMainRow ? metric.bg : (isPercentageRow ? 'bg-slate-50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-900');
                const values = metric.data[field as keyof typeof metric.data] as number[];
                
                return (
                  <tr key={`${metric.id}-${field}`} className={`${rowBg} ${isMainRow ? 'font-semibold' : ''}`}>
                    <td className={`border border-slate-300 dark:border-slate-700 px-3 py-2 sticky left-0 ${rowBg} z-10`}>
                      {isMainRow ? metric.id : ''}
                    </td>
                    <td className={`border border-slate-300 dark:border-slate-700 px-3 py-2 ${isMainRow ? '' : 'pl-8'}`}>
                      {isMainRow ? metric.title : metric.labels[fieldIndex]}
                    </td>
                    {values.map((value, monthIndex) => (
                      <td key={monthIndex} className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-right">
                        {formatValue(value, field)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
          
          <tr className="bg-slate-100 dark:bg-slate-800 font-semibold">
            <td colSpan={14} className="border border-slate-300 dark:border-slate-700 px-3 py-3 text-center text-slate-600 dark:text-slate-400 text-xs">
              Tabela completa com 47 classificações de métricas • Role horizontalmente para ver todos os meses
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
