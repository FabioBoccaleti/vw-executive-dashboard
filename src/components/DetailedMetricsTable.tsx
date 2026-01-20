import React, { useRef } from 'react';
import { businessMetricsData } from '../data/businessMetricsData';

interface DetailedMetricsTableProps {
  data?: typeof businessMetricsData;
  onDataUpdate?: (data: typeof businessMetricsData) => void;
  fileInputRef?: React.RefObject<HTMLInputElement>;
}

export function DetailedMetricsTable({ data = businessMetricsData, onDataUpdate, fileInputRef }: DetailedMetricsTableProps) {
  // Reconstruir allMetrics baseado no prop data usando useMemo
  const allMetrics = React.useMemo(() => [
    // 1-4: Vendas
    { id: 1, bg: 'bg-blue-50 dark:bg-blue-900/20', title: 'Vendas de Veículos Novos', data: data.vendasNovos, fields: ['vendas', 'volumeTrocas', 'percentualTrocas'], labels: ['Vendas de Veículos Novos', 'Volume de Trocas Novos', '% de Trocas Novos'] },
    { id: 2, bg: 'bg-green-50 dark:bg-green-900/20', title: 'Vendas de Veículos Novos VD', data: data.vendasNovosVD, fields: ['vendas', 'volumeTrocas', 'percentualTrocas'], labels: ['Vendas de Veículos Novos VD', 'Volume de Trocas VD', '% de Trocas VD'] },
    { id: 3, bg: 'bg-yellow-50 dark:bg-yellow-900/20', title: 'Vendas de Veículos Usados', data: data.vendasUsados, fields: ['vendas', 'volumeTrocas', 'percentualTrocas'], labels: ['Vendas de Veículos Usados', 'Volume de Trocas Usados', '% de Trocas Usados'] },
    { id: 4, bg: 'bg-purple-50 dark:bg-purple-900/20', title: 'Volume de Vendas', data: data.volumeVendas, fields: ['usados', 'repasse', 'percentualRepasse'], labels: ['Volume de Vendas Usados', 'Volume de Repasse', '% de Repasse'] },
    
    // 5-7: Estoques
    { id: 5, bg: 'bg-red-50 dark:bg-red-900/20', title: 'Estoque de Veículos Novos', data: data.estoqueNovos, fields: ['quantidade', 'valor', 'aPagar', 'pagos'], labels: ['Quantidade', 'Estoque Total', 'A Pagar', 'Pagos'] },
    { id: 6, bg: 'bg-indigo-50 dark:bg-indigo-900/20', title: 'Estoque de Veículos Usados', data: data.estoqueUsados, fields: ['quantidade', 'valor', 'aPagar', 'pagos'], labels: ['Quantidade', 'Estoque Total', 'A Pagar', 'Pagos'] },
    { id: 7, bg: 'bg-cyan-50 dark:bg-cyan-900/20', title: 'Estoque de Peças', data: data.estoquePecas, fields: ['valor', 'aPagar', 'pagos'], labels: ['Estoque Total', 'A Pagar', 'Pagos'] },
    
    // 8-12: Vendas de Peças
    { id: 8, bg: 'bg-purple-50 dark:bg-purple-900/20', title: 'Vendas de Peças - Balcão', data: data.vendasPecas.balcao, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
    { id: 9, bg: 'bg-amber-50 dark:bg-amber-900/20', title: 'Vendas de Peças - Oficina', data: data.vendasPecas.oficina, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
    { id: 10, bg: 'bg-orange-50 dark:bg-orange-900/20', title: 'Vendas de Peças - Funilaria', data: data.vendasPecas.funilaria, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
    { id: 11, bg: 'bg-pink-50 dark:bg-pink-900/20', title: 'Vendas de Peças - Acessórios', data: data.vendasPecas.acessorios, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
    { id: 12, bg: 'bg-teal-50 dark:bg-teal-900/20', title: 'Vendas de Peças - Seguradora', data: data.vendasPecas.seguradoraTotal, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
    
    // 13-16: Seguradoras
    { id: 13, bg: 'bg-sky-50 dark:bg-sky-900/20', title: 'Seguradora - Porto Seguro', data: data.seguradoras.portoSeguro, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
    { id: 14, bg: 'bg-blue-50 dark:bg-blue-900/20', title: 'Seguradora - Azul', data: data.seguradoras.azul, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
    { id: 15, bg: 'bg-indigo-50 dark:bg-indigo-900/20', title: 'Seguradora - Allianz', data: data.seguradoras.allianz, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
    { id: 16, bg: 'bg-violet-50 dark:bg-violet-900/20', title: 'Seguradora - Tokio Marine', data: data.seguradoras.tokioMarine, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
    
    // 17: Mercado Livre
    { id: 17, bg: 'bg-yellow-50 dark:bg-yellow-900/20', title: 'Mercado Livre', data: data.mercadoLivre, fields: ['vendas', 'lucro', 'margem'], labels: ['Vendas', 'Lucro', 'Margem %'] },
    
    // 18-22: Juros
    { id: 18, bg: 'bg-red-50 dark:bg-red-900/20', title: 'Juros - Veículos Novos', data: { valor: data.juros.veiculosNovos }, fields: ['valor'], labels: ['Juros'] },
    { id: 19, bg: 'bg-orange-50 dark:bg-orange-900/20', title: 'Juros - Veículos Usados', data: { valor: data.juros.veiculosUsados }, fields: ['valor'], labels: ['Juros'] },
    { id: 20, bg: 'bg-amber-50 dark:bg-amber-900/20', title: 'Juros - Peças', data: { valor: data.juros.pecas }, fields: ['valor'], labels: ['Juros'] },
    { id: 21, bg: 'bg-lime-50 dark:bg-lime-900/20', title: 'Juros - Empréstimos Bancários', data: { valor: data.juros.emprestimosBancarios }, fields: ['valor'], labels: ['Juros'] },
    { id: 22, bg: 'bg-green-50 dark:bg-green-900/20', title: 'Juros - Contrato de Mútuo', data: { valor: data.juros.contratoMutuo }, fields: ['valor'], labels: ['Juros'] },
    
    // 23-24: Custos
    { id: 23, bg: 'bg-cyan-50 dark:bg-cyan-900/20', title: 'Custos - Garantia', data: { valor: data.custos.garantia }, fields: ['valor'], labels: ['Custos'] },
    { id: 24, bg: 'bg-teal-50 dark:bg-teal-900/20', title: 'Custos - Reparo de Usados', data: data.custos, fields: ['reparoUsados', 'ticketMedioReparo'], labels: ['Custos Reparo', 'Ticket Médio'] },
    
    // 25-31: Despesas Cartão
    { id: 25, bg: 'bg-purple-50 dark:bg-purple-900/20', title: 'Despesas Cartão - Novos', data: { valor: data.despesasCartao.novos }, fields: ['valor'], labels: ['Despesas'] },
    { id: 26, bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20', title: 'Despesas Cartão - Venda Direta', data: { valor: data.despesasCartao.vendaDireta }, fields: ['valor'], labels: ['Despesas'] },
    { id: 27, bg: 'bg-pink-50 dark:bg-pink-900/20', title: 'Despesas Cartão - Usados', data: { valor: data.despesasCartao.usados }, fields: ['valor'], labels: ['Despesas'] },
    { id: 28, bg: 'bg-rose-50 dark:bg-rose-900/20', title: 'Despesas Cartão - Peças', data: { valor: data.despesasCartao.pecas }, fields: ['valor'], labels: ['Despesas'] },
    { id: 29, bg: 'bg-red-50 dark:bg-red-900/20', title: 'Despesas Cartão - Oficina', data: { valor: data.despesasCartao.oficina }, fields: ['valor'], labels: ['Despesas'] },
    { id: 30, bg: 'bg-orange-50 dark:bg-orange-900/20', title: 'Despesas Cartão - Funilaria', data: { valor: data.despesasCartao.funilaria }, fields: ['valor'], labels: ['Despesas'] },
    { id: 31, bg: 'bg-amber-50 dark:bg-amber-900/20', title: 'Despesas Cartão - Administração', data: { valor: data.despesasCartao.administracao }, fields: ['valor'], labels: ['Despesas'] },
    
    // 32-37: Bônus
    { id: 32, bg: 'bg-emerald-50 dark:bg-emerald-900/20', title: 'Bônus - Veículos Novos', data: { valor: data.bonus.veiculosNovos }, fields: ['valor'], labels: ['Bônus'] },
    { id: 33, bg: 'bg-teal-50 dark:bg-teal-900/20', title: 'Bônus - Veículos Usados', data: { valor: data.bonus.veiculosUsados }, fields: ['valor'], labels: ['Bônus'] },
    { id: 34, bg: 'bg-cyan-50 dark:bg-cyan-900/20', title: 'Bônus - Peças', data: { valor: data.bonus.pecas }, fields: ['valor'], labels: ['Bônus'] },
    { id: 35, bg: 'bg-sky-50 dark:bg-sky-900/20', title: 'Bônus - Oficina', data: { valor: data.bonus.oficina }, fields: ['valor'], labels: ['Bônus'] },
    { id: 36, bg: 'bg-blue-50 dark:bg-blue-900/20', title: 'Bônus - Funilaria', data: { valor: data.bonus.funilaria }, fields: ['valor'], labels: ['Bônus'] },
    { id: 37, bg: 'bg-indigo-50 dark:bg-indigo-900/20', title: 'Bônus - Administração', data: { valor: data.bonus.administracao }, fields: ['valor'], labels: ['Bônus'] },
    
    // 38-39: Receitas de Financiamento
    { id: 38, bg: 'bg-violet-50 dark:bg-violet-900/20', title: 'Receitas Financiamento - Novos', data: { valor: data.receitasFinanciamento.veiculosNovos }, fields: ['valor'], labels: ['Receitas'] },
    { id: 39, bg: 'bg-purple-50 dark:bg-purple-900/20', title: 'Receitas Financiamento - Usados', data: { valor: data.receitasFinanciamento.veiculosUsados }, fields: ['valor'], labels: ['Receitas'] },
    
    // 40-42: Créditos ICMS
    { id: 40, bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20', title: 'Créditos ICMS - Novos', data: { valor: data.creditosICMS.novos }, fields: ['valor'], labels: ['Créditos'] },
    { id: 41, bg: 'bg-pink-50 dark:bg-pink-900/20', title: 'Créditos ICMS - Peças', data: { valor: data.creditosICMS.pecas }, fields: ['valor'], labels: ['Créditos'] },
    { id: 42, bg: 'bg-rose-50 dark:bg-rose-900/20', title: 'Créditos ICMS - Administração', data: { valor: data.creditosICMS.administracao }, fields: ['valor'], labels: ['Créditos'] },
    
    // 43: Créditos PIS e COFINS
    { id: 43, bg: 'bg-red-50 dark:bg-red-900/20', title: 'Créditos PIS/COFINS - Admin', data: { valor: data.creditosPISCOFINS.administracao }, fields: ['valor'], labels: ['Créditos'] },
    
    // 44: Receita de Blindagem
    { id: 44, bg: 'bg-amber-50 dark:bg-amber-900/20', title: 'Receita de Blindagem', data: { valor: data.receitaBlindagem }, fields: ['valor'], labels: ['Receitas'] },
    
    // 45: Receita de Despachante Usados
    { id: 45, bg: 'bg-lime-50 dark:bg-lime-900/20', title: 'Receita de Despachante Usados', data: { valor: data.receitaDespachanteUsados }, fields: ['valor'], labels: ['Receitas'] },
    
    // 46: Receita de Despachante Novos
    { id: 46, bg: 'bg-green-50 dark:bg-green-900/20', title: 'Receita de Despachante Novos', data: { valor: data.receitaDespachanteNovos }, fields: ['valor'], labels: ['Receitas'] },
  ], [data]);

  React.useEffect(() => {
    const handleExport = () => {
      handleExportData();
    };
    
    window.addEventListener('exportMetrics', handleExport);
    return () => window.removeEventListener('exportMetrics', handleExport);
  }, [data]);

  const formatValue = (value: number, field: string) => {
    if (field.includes('percentual') || field === 'margem') {
      return `${value.toFixed(2)}%`;
    }
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const months = data.months;

  // Função para exportar dados em formato TXT tabular
  const handleExportData = () => {
    let txtContent = '';
    
    // Cabeçalho
    const header = ['ID', 'Descrição', ...months].map((col, i) => {
      if (i === 0) return col.padEnd(5);
      if (i === 1) return col.padEnd(50);
      return col.padStart(15);
    }).join('\t');
    
    txtContent += '# MÉTRICAS DETALHADAS - ANÁLISE CONSOLIDADA 2025\n';
    txtContent += '# Exportado em: ' + new Date().toLocaleString('pt-BR') + '\n';
    txtContent += '# Formato: ID | Descrição | Valores Mensais\n';
    txtContent += '#\n';
    txtContent += header + '\n';
    txtContent += '='.repeat(200) + '\n';
    
    // Dados
    allMetrics.forEach((metric) => {
      metric.fields.forEach((field, fieldIndex) => {
        const isMainRow = fieldIndex === 0;
        const values = metric.data[field as keyof typeof metric.data] as number[];
        
        const row = [
          (isMainRow ? String(metric.id) : '').padEnd(5),
          (isMainRow ? metric.title : '  ' + metric.labels[fieldIndex]).padEnd(50),
          ...values.map((value) => formatValue(value, field).padStart(15))
        ].join('\t');
        
        txtContent += row + '\n';
      });
    });
    
    // Rodapé
    txtContent += '='.repeat(200) + '\n';
    txtContent += '# Fim do arquivo\n';
    
    // Criar e baixar arquivo
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metricas-detalhadas-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Nota: A lógica de importação agora está no componente pai

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
                const values = (metric.data[field as keyof typeof metric.data] as number[]) || [];
                
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
