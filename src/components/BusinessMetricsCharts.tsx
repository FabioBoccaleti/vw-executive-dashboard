import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area, ComposedChart, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { businessMetricsData } from '@/data/businessMetricsData';
import { 
  TrendingUp, TrendingDown, Package, CreditCard, Award, Building2, PiggyBank, 
  ShoppingCart, Percent, DollarSign, AlertCircle
} from 'lucide-react';

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];

const COLORS = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  dark: '#1e293b'
};

// Formatar valores em reais
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

// Formatar números grandes
const formatNumber = (value: number) => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toString();
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
        <p className="font-semibold text-slate-900 dark:text-white mb-2">{label}</p>
        {payload.map((entry: any, index: number) => {
          let formattedValue = entry.value;
          
          // Verifica se é um valor de estoque (nome contém 'Valor' ou 'R$' ou 'Estoque')
          if (entry.name && (entry.name.includes('R$') || entry.name.includes('Valor') || entry.name.includes('Estoque'))) {
            // Para valores já em milhões (como novosValor = 44, 48, etc.)
            // Multiplicar por 1.000.000 para obter o valor completo: R$ 44.000.000
            const realValue = entry.value * 1000000;
            // Formatar com separadores de milhares (ponto para pt-BR)
            const formatted = new Intl.NumberFormat('pt-BR', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(realValue);
            formattedValue = `R$ ${formatted}`;
          } else if (entry.value && typeof entry.value === 'number') {
            // Formato padrão para outros valores
            if (entry.value > 100) {
              formattedValue = formatCurrency(entry.value);
            } else {
              formattedValue = `${entry.value.toFixed(2)}%`;
            }
          }
          
          return (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formattedValue}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

export function BusinessMetricsCharts() {
  const { months } = businessMetricsData;
  
  // 1. Vendas de Veículos - Novos vs Usados
  const vendasVeiculosData = months.map((month, index) => ({
    mes: month,
    novos: businessMetricsData.vendasNovos.vendas[index],
    novosVD: businessMetricsData.vendasNovosVD.vendas[index],
    usados: businessMetricsData.vendasUsados.vendas[index]
  }));
  
  // 2. Percentual de Trocas
  const trocasData = months.map((month, index) => ({
    mes: month,
    novos: businessMetricsData.vendasNovos.percentualTrocas[index],
    novosVD: businessMetricsData.vendasNovosVD.percentualTrocas[index],
    usados: businessMetricsData.vendasUsados.percentualTrocas[index]
  }));
  
  // 3. Estoque de Veículos
  const estoqueData = months.map((month, index) => ({
    mes: month,
    novosQtd: businessMetricsData.estoqueNovos.quantidade[index],
    usadosQtd: businessMetricsData.estoqueUsados.quantidade[index],
    novosValor: businessMetricsData.estoqueNovos.valor[index] / 1000000,
    usadosValor: businessMetricsData.estoqueUsados.valor[index] / 1000000
  }));
  
  // 4. Vendas de Peças por Canal
  const vendasPecasData = months.map((month, index) => ({
    mes: month,
    balcao: businessMetricsData.vendasPecas.balcao.vendas[index],
    oficina: businessMetricsData.vendasPecas.oficina.vendas[index],
    funilaria: businessMetricsData.vendasPecas.funilaria.vendas[index],
    acessorios: businessMetricsData.vendasPecas.acessorios.vendas[index]
  }));
  
  // 5. Margens por Canal de Peças
  const margensPecasData = months.map((month, index) => ({
    mes: month,
    balcao: businessMetricsData.vendasPecas.balcao.margem[index],
    oficina: businessMetricsData.vendasPecas.oficina.margem[index],
    funilaria: businessMetricsData.vendasPecas.funilaria.margem[index],
    acessorios: businessMetricsData.vendasPecas.acessorios.margem[index]
  }));
  
  // 6. Seguradoras Performance
  const seguradorasData = months.map((month, index) => ({
    mes: month,
    portoSeguro: businessMetricsData.seguradoras.portoSeguro.vendas[index],
    azul: businessMetricsData.seguradoras.azul.vendas[index],
    allianz: businessMetricsData.seguradoras.allianz.vendas[index],
    tokioMarine: businessMetricsData.seguradoras.tokioMarine.vendas[index]
  }));
  
  // 7. Juros Totais
  const jurosData = months.map((month, index) => ({
    mes: month,
    veiculosNovos: businessMetricsData.juros.veiculosNovos[index],
    veiculosUsados: businessMetricsData.juros.veiculosUsados[index],
    pecas: businessMetricsData.juros.pecas[index],
    emprestimos: businessMetricsData.juros.emprestimosBancarios[index],
    mutuo: businessMetricsData.juros.contratoMutuo[index]
  }));
  
  // 8. Custos Operacionais
  const custosData = months.map((month, index) => ({
    mes: month,
    garantia: businessMetricsData.custos.garantia[index],
    reparo: businessMetricsData.custos.reparoUsados[index],
    ticketMedio: businessMetricsData.custos.ticketMedioReparo[index]
  }));
  
  // 9. Bônus
  const bonusData = months.map((month, index) => ({
    mes: month,
    veiculosNovos: businessMetricsData.bonus.veiculosNovos[index],
    pecas: businessMetricsData.bonus.pecas[index],
    oficina: businessMetricsData.bonus.oficina[index]
  }));
  
  // 10. Créditos Fiscais
  const creditosFiscaisData = months.map((month, index) => ({
    mes: month,
    icmsNovos: businessMetricsData.creditosICMS.novos[index],
    icmsPecas: businessMetricsData.creditosICMS.pecas[index],
    icmsAdmin: businessMetricsData.creditosICMS.administracao[index],
    pisCofins: businessMetricsData.creditosPISCOFINS.administracao[index]
  }));
  
  // 11. Receitas de Financiamento
  const receitasFinanciamentoData = months.map((month, index) => ({
    mes: month,
    novos: businessMetricsData.receitasFinanciamento.veiculosNovos[index],
    usados: businessMetricsData.receitasFinanciamento.veiculosUsados[index]
  }));
  
  // 12. Despesas com Cartão
  const despesasCartaoData = months.map((month, index) => ({
    mes: month,
    novos: businessMetricsData.despesasCartao.novos[index],
    usados: businessMetricsData.despesasCartao.usados[index],
    pecas: businessMetricsData.despesasCartao.pecas[index],
    oficina: businessMetricsData.despesasCartao.oficina[index]
  }));
  
  // Calcular totais anuais para os cards resumo
  const totaisAnuais = {
    vendasNovos: businessMetricsData.vendasNovos.vendas.reduce((a, b) => a + b, 0),
    vendasUsados: businessMetricsData.vendasUsados.vendas.reduce((a, b) => a + b, 0),
    vendasPecasTotal: months.reduce((total, _, index) => {
      return total + 
        businessMetricsData.vendasPecas.balcao.vendas[index] +
        businessMetricsData.vendasPecas.oficina.vendas[index] +
        businessMetricsData.vendasPecas.funilaria.vendas[index] +
        businessMetricsData.vendasPecas.acessorios.vendas[index];
    }, 0),
    bonusTotal: months.reduce((total, _, index) => {
      return total + 
        businessMetricsData.bonus.veiculosNovos[index] +
        businessMetricsData.bonus.pecas[index] +
        businessMetricsData.bonus.oficina[index];
    }, 0)
  };
  
  return (
    <div className="space-y-6">
      {/* Cards Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-blue-100">Vendas Novos</CardDescription>
              <TrendingUp className="w-5 h-5 text-blue-100" />
            </div>
            <CardTitle className="text-3xl font-bold">{totaisAnuais.vendasNovos.toLocaleString('pt-BR')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-100">Unidades vendidas em 2025</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-purple-100">Vendas Usados</CardDescription>
              <Package className="w-5 h-5 text-purple-100" />
            </div>
            <CardTitle className="text-3xl font-bold">{totaisAnuais.vendasUsados.toLocaleString('pt-BR')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-purple-100">Unidades vendidas em 2025</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-green-100">Vendas Peças</CardDescription>
              <DollarSign className="w-5 h-5 text-green-100" />
            </div>
            <CardTitle className="text-3xl font-bold">{formatCurrency(totaisAnuais.vendasPecasTotal)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-100">Faturamento total em 2025</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-amber-100">Bônus Pagos</CardDescription>
              <Award className="w-5 h-5 text-amber-100" />
            </div>
            <CardTitle className="text-3xl font-bold">{formatCurrency(totaisAnuais.bonusTotal)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-100">Total de incentivos em 2025</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Gráfico 1: Vendas de Veículos */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Vendas de Veículos por Categoria
          </CardTitle>
          <CardDescription>Comparativo mensal de vendas entre novos, novos VD e usados</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={vendasVeiculosData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="novos" name="Novos" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="novosVD" name="Novos VD" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="usados" name="Usados" stroke={COLORS.success} strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Gráfico 2: Percentual de Trocas */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-purple-500" />
            Percentual de Trocas por Categoria
          </CardTitle>
          <CardDescription>Evolução mensal do percentual de veículos aceitos em troca</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={trocasData}>
              <defs>
                <linearGradient id="colorNovos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorNovosVD" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorUsados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={COLORS.success} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="novos" name="Novos" stroke={COLORS.primary} fillOpacity={1} fill="url(#colorNovos)" />
              <Area type="monotone" dataKey="novosVD" name="Novos VD" stroke={COLORS.secondary} fillOpacity={1} fill="url(#colorNovosVD)" />
              <Area type="monotone" dataKey="usados" name="Usados" stroke={COLORS.success} fillOpacity={1} fill="url(#colorUsados)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Gráfico 3: Estoque de Veículos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              Quantidade em Estoque
            </CardTitle>
            <CardDescription>Volume de veículos novos e usados em estoque</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={estoqueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: '11px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="novosQtd" name="Novos" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="usadosQtd" name="Usados" fill={COLORS.warning} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Valor do Estoque (Milhões)
            </CardTitle>
            <CardDescription>Valor financeiro do estoque de veículos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={estoqueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: '11px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '11px' }} unit="M" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="novosValor" name="Estoque Novos: Valor (R$)" stroke={COLORS.primary} strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="usadosValor" name="Estoque Usados: Valor (R$)" stroke={COLORS.warning} strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Gráfico 4: Vendas de Peças por Canal */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-green-500" />
            Vendas de Peças por Canal
          </CardTitle>
          <CardDescription>Performance de vendas em balcão, oficina, funilaria e acessórios</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={vendasPecasData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} tickFormatter={formatNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="balcao" name="Balcão" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="oficina" name="Oficina" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="funilaria" name="Funilaria" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="acessorios" name="Acessórios" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Gráfico 5: Margens de Lucro por Canal */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            Margens de Lucro por Canal de Peças (%)
          </CardTitle>
          <CardDescription>Análise de lucratividade por canal de vendas</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={margensPecasData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="balcao" name="Balcão" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="oficina" name="Oficina" stroke={CHART_COLORS[1]} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="funilaria" name="Funilaria" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="acessorios" name="Acessórios" stroke={CHART_COLORS[3]} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Gráfico 6: Performance por Seguradora */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            Vendas por Seguradora
          </CardTitle>
          <CardDescription>Distribuição de vendas entre as principais seguradoras</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={seguradorasData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} tickFormatter={formatNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="portoSeguro" name="Porto Seguro" stackId="1" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.8} />
              <Area type="monotone" dataKey="tokioMarine" name="Tokio Marine" stackId="1" stroke={CHART_COLORS[1]} fill={CHART_COLORS[1]} fillOpacity={0.8} />
              <Area type="monotone" dataKey="azul" name="Azul" stackId="1" stroke={CHART_COLORS[2]} fill={CHART_COLORS[2]} fillOpacity={0.8} />
              <Area type="monotone" dataKey="allianz" name="Allianz" stackId="1" stroke={CHART_COLORS[3]} fill={CHART_COLORS[3]} fillOpacity={0.8} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Gráfico 7: Estrutura de Juros */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-red-500" />
            Despesas Financeiras - Juros
          </CardTitle>
          <CardDescription>Distribuição mensal dos custos financeiros</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={jurosData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} tickFormatter={formatNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="veiculosNovos" name="Veículos Novos" stackId="a" fill={CHART_COLORS[4]} />
              <Bar dataKey="veiculosUsados" name="Veículos Usados" stackId="a" fill={CHART_COLORS[5]} />
              <Bar dataKey="pecas" name="Peças" stackId="a" fill={CHART_COLORS[6]} />
              <Bar dataKey="emprestimos" name="Empréstimos" stackId="a" fill={CHART_COLORS[0]} />
              <Bar dataKey="mutuo" name="Mútuo" stackId="a" fill={CHART_COLORS[1]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Gráfico 8: Custos Operacionais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              Custos com Garantia e Reparo
            </CardTitle>
            <CardDescription>Evolução dos custos operacionais com veículos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={custosData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: '11px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '11px' }} tickFormatter={formatNumber} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="garantia" name="Garantia" fill={COLORS.danger} radius={[4, 4, 0, 0]} />
                <Bar dataKey="reparo" name="Reparo Usados" fill={COLORS.warning} radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-500" />
              Ticket Médio de Reparo
            </CardTitle>
            <CardDescription>Valor médio gasto por reparo de veículo usado</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={custosData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: '11px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="ticketMedio" name="Ticket Médio (R$)" stroke={COLORS.info} strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Gráfico 9: Bônus e Incentivos */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Bônus e Incentivos por Área
          </CardTitle>
          <CardDescription>Distribuição mensal de bônus pagos</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={bonusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} tickFormatter={formatNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="veiculosNovos" name="Veículos Novos" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="pecas" name="Peças" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="oficina" name="Oficina" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Gráfico 10: Créditos Fiscais */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-green-500" />
            Créditos Fiscais (ICMS, PIS e COFINS)
          </CardTitle>
          <CardDescription>Créditos tributários recuperados mensalmente</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={creditosFiscaisData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} tickFormatter={formatNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="icmsNovos" name="ICMS Novos" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="icmsPecas" name="ICMS Peças" fill={CHART_COLORS[5]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="icmsAdmin" name="ICMS Admin" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="pisCofins" name="PIS/COFINS" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Gráfico 11: Receitas de Financiamento */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            Receitas de Financiamento
          </CardTitle>
          <CardDescription>Receitas geradas com financiamento de veículos</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={receitasFinanciamentoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} tickFormatter={formatNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="novos" name="Veículos Novos" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="usados" name="Veículos Usados" fill={COLORS.success} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="novos" stroke={COLORS.dark} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Gráfico 12: Despesas com Cartão */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-500" />
            Despesas com Cartão de Crédito
          </CardTitle>
          <CardDescription>Custos de taxas de cartão por departamento</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={despesasCartaoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} tickFormatter={formatNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="pecas" name="Peças" stackId="1" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.7} />
              <Area type="monotone" dataKey="oficina" name="Oficina" stackId="1" stroke={CHART_COLORS[1]} fill={CHART_COLORS[1]} fillOpacity={0.7} />
              <Area type="monotone" dataKey="usados" name="Usados" stackId="1" stroke={CHART_COLORS[2]} fill={CHART_COLORS[2]} fillOpacity={0.7} />
              <Area type="monotone" dataKey="novos" name="Novos" stackId="1" stroke={CHART_COLORS[3]} fill={CHART_COLORS[3]} fillOpacity={0.7} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
