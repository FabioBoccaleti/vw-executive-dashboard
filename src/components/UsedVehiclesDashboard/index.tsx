import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { vehiclesSalesData } from "@/data/vehiclesSalesData"
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Percent, Target } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, XAxis, YAxis } from "recharts"

export function UsedVehiclesDashboard() {
  const data = vehiclesSalesData

  // Preparar dados para os gráficos (excluindo 12/25 que tem volume 0)
  const monthlyDataFiltered = data.monthlyData.filter(m => m.volume > 0)

  // Formatadores
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  // Dados para o gráfico de evolução de receita e lucro
  const revenueData = monthlyDataFiltered.map(m => ({
    month: m.month,
    receita: m.receita / 1_000_000,
    lucroLiquido: m.lucroLiquido / 1_000_000,
    margemPercent: (m.lucroLiquido / m.receita) * 100
  }))

  // Dados para volume de vendas
  const volumeData = monthlyDataFiltered.map(m => ({
    month: m.month,
    volume: m.volume
  }))

  // Dados para margem de contribuição
  const marginData = monthlyDataFiltered.map(m => ({
    month: m.month,
    margemContrib: m.margemContrib / 1_000_000,
    percentual: (m.margemContrib / m.receita) * 100
  }))

  // Dados para lucro bruto
  const lucrosBrutosData = monthlyDataFiltered.map(m => ({
    month: m.month,
    lucroBruto: m.lucroOperacionalBruto / 1_000_000
  }))

  // Dados para despesas
  const despesasData = monthlyDataFiltered.map(m => ({
    month: m.month,
    despesasVendas: Math.abs(m.despesasVendas) / 1_000_000,
    outrosDespesas: Math.abs(m.outrosDespesasOp) / 1_000_000
  }))

  // Dados para lucro operacional
  const lucroOperacionalData = monthlyDataFiltered.map(m => ({
    month: m.month,
    lucroOperacional: m.lucroOperacionalLiq / 1_000_000
  }))

  // Dados para composição de resultado
  const resultComposition = monthlyDataFiltered.map(m => ({
    month: m.month,
    lucroOpBruto: m.lucroOperacionalBruto / 1_000_000,
    despesasVendas: Math.abs(m.despesasVendas) / 1_000_000,
    outrasReceitas: m.outrasReceitasOp / 1_000_000,
    lucroLiquido: m.lucroLiquido / 1_000_000
  }))

  // Dados comparativos (melhor vs pior mês)
  const bestMonth = monthlyDataFiltered.reduce((prev, current) => 
    (current.lucroLiquido > prev.lucroLiquido) ? current : prev
  )
  const worstMonth = monthlyDataFiltered.reduce((prev, current) => 
    (current.lucroLiquido < prev.lucroLiquido) ? current : prev
  )

  // KPIs principais
  const avgTicket = data.totals.receita / data.totals.volume
  const avgMargin = (data.totals.lucroLiquido / data.totals.receita) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
      <div className="max-w-[1800px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-4 border-b-2 border-gradient">
          <div>
            <h1 className="text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-500 dark:from-blue-400 dark:via-cyan-400 dark:to-blue-300">
              Departamento de Veículos Usados
            </h1>
            <p className="text-muted-foreground mt-3 text-xl font-medium">
              Volkswagen • Período: Janeiro a Novembro 2025
            </p>
          </div>
          <div className="flex gap-3">
            <Badge variant="outline" className="text-lg px-6 py-3 border-2 hover:bg-accent transition-colors">
              <TrendingUp className="w-5 h-5 mr-2" />
              {data.totals.volume} Vendas
            </Badge>
            <Badge variant="default" className="text-lg px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 transition-all shadow-lg">
              {formatCurrency(data.totals.lucroLiquido)}
            </Badge>
          </div>
        </div>

        {/* KPIs Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold opacity-95">Receita Total</CardTitle>
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{formatCurrency(data.totals.receita)}</div>
              <p className="text-sm opacity-90 mt-2">100% da receita operacional</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold opacity-95">Lucro Líquido</CardTitle>
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{formatCurrency(data.totals.lucroLiquido)}</div>
              <p className="text-sm opacity-90 mt-2">Margem: {formatPercent(avgMargin)}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold opacity-95">Ticket Médio</CardTitle>
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Target className="w-6 h-6" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{formatCurrency(avgTicket)}</div>
              <p className="text-sm opacity-90 mt-2">Por veículo vendido</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold opacity-95">Volume de Vendas</CardTitle>
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <ShoppingCart className="w-6 h-6" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{data.totals.volume}</div>
              <p className="text-sm opacity-90 mt-2">Veículos comercializados</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos Principais */}
        <div className="space-y-8">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Gráfico de Volume de Vendas */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold">Volume de Vendas</CardTitle>
                <CardDescription className="text-base mt-2">Quantidade de veículos vendidos por mês</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    volume: {
                      label: "Volume",
                      color: "hsl(var(--chart-3))",
                    },
                  }}
                  className="h-[500px]"
                >
                  <BarChart width={800} height={500} data={volumeData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      className="text-sm font-medium"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <YAxis 
                      className="text-sm font-medium"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar 
                      dataKey="volume" 
                      fill="hsl(var(--chart-3))"
                      radius={[8, 8, 0, 0]}
                      name="Volume de Vendas"
                    >
                      {volumeData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.volume > 85 ? "hsl(var(--chart-2))" : "hsl(var(--chart-3))"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Receita Líquida */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold">Receita Líquida</CardTitle>
                <CardDescription className="text-base mt-2">Evolução mensal em milhões de R$</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    receita: {
                      label: "Receita",
                      color: "hsl(var(--chart-1))",
                    },
                  }}
                  className="h-[500px]"
                >
                  <AreaChart width={800} height={500} data={revenueData}>
                    <defs>
                      <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      className="text-sm font-medium"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <YAxis 
                      className="text-sm font-medium"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area 
                      type="monotone" 
                      dataKey="receita" 
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorReceita)" 
                      name="Receita Líquida (R$ MM)"
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Segunda linha de gráficos */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Gráfico de Lucro Bruto */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold">Lucro Operacional Bruto</CardTitle>
                <CardDescription className="text-base mt-2">Evolução mensal em milhões de R$</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    lucroBruto: {
                      label: "Lucro Bruto",
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                  className="h-[500px]"
                >
                  <LineChart width={800} height={500} data={lucrosBrutosData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      className="text-sm font-medium"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <YAxis 
                      className="text-sm font-medium"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="lucroBruto" 
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={3}
                      dot={{ r: 6 }}
                      activeDot={{ r: 8 }}
                      name="Lucro Bruto (R$ MM)"
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Margem de Contribuição */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold">Margem de Contribuição</CardTitle>
                <CardDescription className="text-base mt-2">Evolução mensal em milhões de R$</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    margemContrib: {
                      label: "Margem",
                      color: "hsl(var(--chart-4))",
                    },
                  }}
                  className="h-[500px]"
                >
                  <BarChart width={800} height={500} data={marginData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      className="text-sm font-medium"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <YAxis 
                      className="text-sm font-medium"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar 
                      dataKey="margemContrib" 
                      fill="hsl(var(--chart-4))"
                      radius={[8, 8, 0, 0]}
                      name="Margem de Contribuição (R$ MM)"
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Terceira linha de gráficos */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Gráfico de Despesas */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold">Despesas Operacionais</CardTitle>
                <CardDescription className="text-base mt-2">Evolução mensal em milhões de R$</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    despesasVendas: {
                      label: "Despesas com Vendas",
                      color: "hsl(var(--chart-5))",
                    },
                    outrosDespesas: {
                      label: "Outras Despesas",
                      color: "hsl(var(--chart-6))",
                    },
                  }}
                  className="h-[500px]"
                >
                  <BarChart width={800} height={500} data={despesasData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      className="text-sm font-medium"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <YAxis 
                      className="text-sm font-medium"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar 
                      dataKey="despesasVendas" 
                      fill="hsl(var(--chart-5))"
                      radius={[8, 8, 0, 0]}
                      name="Despesas Vendas (R$ MM)"
                      stackId="a"
                    />
                    <Bar 
                      dataKey="outrosDespesas" 
                      fill="hsl(var(--chart-6))"
                      radius={[8, 8, 0, 0]}
                      name="Outras Despesas (R$ MM)"
                      stackId="a"
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Lucro Operacional */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold">Lucro Operacional Líquido</CardTitle>
                <CardDescription className="text-base mt-2">Evolução mensal em milhões de R$</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    lucroOperacional: {
                      label: "Lucro Operacional",
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                  className="h-[500px]"
                >
                  <AreaChart width={800} height={500} data={lucroOperacionalData}>
                    <defs>
                      <linearGradient id="colorLucroOp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      className="text-sm font-medium"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <YAxis 
                      className="text-sm font-medium"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area 
                      type="monotone" 
                      dataKey="lucroOperacional" 
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorLucroOp)" 
                      name="Lucro Operacional (R$ MM)"
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Métricas Complementares */}
          <div className="mt-8">
            <h2 className="text-3xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">Indicadores Consolidados</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-green-200 dark:border-green-900">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <TrendingUp className="w-5 h-5" />
                    Melhor Desempenho
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Mês:</span>
                    <span className="font-bold text-lg">{bestMonth.month}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Lucro Líquido:</span>
                    <span className="font-bold text-lg text-green-600">{formatCurrency(bestMonth.lucroLiquido)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Volume:</span>
                    <span className="font-bold">{bestMonth.volume} veículos</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Margem:</span>
                    <span className="font-bold">{formatPercent((bestMonth.lucroLiquido / bestMonth.receita) * 100)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-200 dark:border-blue-900 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <ShoppingCart className="w-6 h-6 text-blue-600" />
                    </div>
                    Volume Total de Vendas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total do Período:</span>
                    <span className="font-bold text-2xl text-blue-600">{data.totals.volume}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Média Mensal:</span>
                    <span className="font-bold text-lg">{Math.round(data.totals.volume / 11)} veículos</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Maior Mês:</span>
                    <span className="font-bold">{Math.max(...monthlyDataFiltered.map(m => m.volume))} veículos (Agosto)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Menor Mês:</span>
                    <span className="font-bold">{Math.min(...monthlyDataFiltered.map(m => m.volume))} veículos (Novembro)</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-200 dark:border-green-900 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                      <DollarSign className="w-6 h-6 text-green-600" />
                    </div>
                    Receita Líquida Total
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total do Período:</span>
                    <span className="font-bold text-xl text-green-600">{formatCurrency(data.totals.receita)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Média Mensal:</span>
                    <span className="font-bold text-lg">{formatCurrency(data.totals.receita / 11)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Maior Receita:</span>
                    <span className="font-bold">{formatCurrency(Math.max(...monthlyDataFiltered.map(m => m.receita)))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Menor Receita:</span>
                    <span className="font-bold">{formatCurrency(Math.min(...monthlyDataFiltered.map(m => m.receita)))}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Footer com informações adicionais */}
        <Card className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 shadow-lg mt-8">
          <CardContent className="pt-8 pb-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div className="space-y-2">
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{formatPercent(data.totals.percentualCusto)}</p>
                <p className="text-sm font-medium text-muted-foreground">Custo sobre Receita</p>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{Math.round(data.totals.volume / 11)}</p>
                <p className="text-sm font-medium text-muted-foreground">Vendas/Mês (Média)</p>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(data.totals.receita / 11)}</p>
                <p className="text-sm font-medium text-muted-foreground">Receita/Mês (Média)</p>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(data.totals.lucroLiquido / 11)}</p>
                <p className="text-sm font-medium text-muted-foreground">Lucro/Mês (Média)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
