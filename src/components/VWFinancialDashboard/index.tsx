import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, TrendingDown, Calendar, BarChart3, ArrowUpDown, ArrowLeftRight, Users, Package, Wrench, Building2, Coins, DollarSign } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer, Legend } from "recharts"

export function VWFinancialDashboard() {
  // Dados mensais
  const monthlyData = [
    { mes: "Janeiro", volume: 120, receitaLiquida: 8900, lucroBruto: 520, rendasOperacionais: 420, lucroOperacional: 190, pessoal: 145, terceiros: 48, ocupacao: 22, funcionamento: 95, vendas: 390 },
    { mes: "Fevereiro", volume: 98, receitaLiquida: 8500, lucroBruto: 540, rendasOperacionais: 380, lucroOperacional: 140, pessoal: 145, terceiros: 52, ocupacao: 24, funcionamento: 98, vendas: 421 },
    { mes: "Março", volume: 92, receitaLiquida: 8100, lucroBruto: 610, rendasOperacionais: 320, lucroOperacional: 310, pessoal: 132, terceiros: 45, ocupacao: 25, funcionamento: 88, vendas: 330 },
    { mes: "Abril", volume: 96, receitaLiquida: 7400, lucroBruto: 550, rendasOperacionais: 315, lucroOperacional: 215, pessoal: 138, terceiros: 46, ocupacao: 23, funcionamento: 92, vendas: 356 },
    { mes: "Maio", volume: 82, receitaLiquida: 7100, lucroBruto: 590, rendasOperacionais: 310, lucroOperacional: 260, pessoal: 140, terceiros: 49, ocupacao: 21, funcionamento: 90, vendas: 330 },
    { mes: "Junho", volume: 124, receitaLiquida: 7700, lucroBruto: 580, rendasOperacionais: 298, lucroOperacional: 190, pessoal: 148, terceiros: 51, ocupacao: 26, funcionamento: 105, vendas: 358 },
    { mes: "Julho", volume: 148, receitaLiquida: 8900, lucroBruto: 710, rendasOperacionais: 340, lucroOperacional: 240, pessoal: 155, terceiros: 58, ocupacao: 28, funcionamento: 112, vendas: 457 },
    { mes: "Agosto", volume: 145, receitaLiquida: 11200, lucroBruto: 720, rendasOperacionais: 510, lucroOperacional: 330, pessoal: 162, terceiros: 62, ocupacao: 32, funcionamento: 128, vendas: 508 },
    { mes: "Setembro", volume: 128, receitaLiquida: 11000, lucroBruto: 680, rendasOperacionais: 450, lucroOperacional: 250, pessoal: 168, terceiros: 68, ocupacao: 34, funcionamento: 135, vendas: 525 },
    { mes: "Outubro", volume: 130, receitaLiquida: 9800, lucroBruto: 740, rendasOperacionais: 380, lucroOperacional: 240, pessoal: 175, terceiros: 72, ocupacao: 36, funcionamento: 142, vendas: 535 },
    { mes: "Novembro", volume: 118, receitaLiquida: 11200, lucroBruto: 550, rendasOperacionais: 480, lucroOperacional: 220, pessoal: 182, terceiros: 75, ocupacao: 38, funcionamento: 148, vendas: 557 },
  ]

  // Totais do período
  const totais = {
    volumeTotal: 1249,
    receitaLiquida: 95952,
    lucroOperacional: 2380,
    margemOperacional: 2.48,
    ticketMedio: 77,
    totalDespesas: 8386,
    despesasPessoal: 1705,
    despesasTerceiros: 651,
    despesasOcupacao: 264,
    despesasFuncionamento: 1643,
    despesasVendas: 4123,
    lucroBruto: 6420,
    rendasOperacionais: 4346
  }

  // Configuração dos gráficos
  const chartConfig = {
    volume: {
      label: "Volume",
      color: "hsl(var(--chart-1))",
    },
    receita: {
      label: "Receita Líquida",
      color: "hsl(var(--chart-2))",
    },
    lucro: {
      label: "Lucro",
      color: "hsl(var(--chart-3))",
    },
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-[#001E50] rounded-lg p-3">
              <span className="text-white font-bold text-2xl">VW</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Dashboard Financeiro VW - Dados Mensais - Veículos Usados
            </h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Análise Executiva de Performance • Atualizado em 07/01/2026
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-[#001E50] to-[#003875] text-white border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardDescription className="text-blue-100 text-xs font-medium">VOLUME TOTAL</CardDescription>
            <CardTitle className="text-4xl font-bold">{totais.volumeTotal.toLocaleString('pt-BR')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-100">unidades</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#00396B] to-[#004D8C] text-white border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardDescription className="text-blue-100 text-xs font-medium">RECEITA LÍQUIDA</CardDescription>
            <CardTitle className="text-4xl font-bold">{formatCurrency(totais.receitaLiquida)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-100">total do período</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#004D8C] to-[#0061AD] text-white border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardDescription className="text-blue-100 text-xs font-medium">LUCRO OPERACIONAL</CardDescription>
            <CardTitle className="text-4xl font-bold">{formatCurrency(totais.lucroOperacional)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="bg-red-500/90">
                <TrendingDown className="w-3 h-3 mr-1" />
                -2,48%
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#0061AD] to-[#0075CE] text-white border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardDescription className="text-blue-100 text-xs font-medium">MARGEM OPERACIONAL</CardDescription>
            <CardTitle className="text-4xl font-bold">{totais.margemOperacional.toFixed(2)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="bg-red-500/90">
                <TrendingDown className="w-3 h-3 mr-1" />
                baixa
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#0075CE] to-[#0089EF] text-white border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardDescription className="text-blue-100 text-xs font-medium">TICKET MÉDIO</CardDescription>
            <CardTitle className="text-4xl font-bold">{formatCurrency(totais.ticketMedio)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-100">por unidade</p>
          </CardContent>
        </Card>
      </div>

      {/* Visualização Tabs */}
      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-600" />
            <CardTitle>VISUALIZAÇÃO</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="mensal" className="w-full">
            <TabsList className="grid w-full grid-cols-5 max-w-3xl">
              <TabsTrigger value="mensal" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
                <Calendar className="w-4 h-4 mr-2" />
                Mensal (Sorana)
              </TabsTrigger>
              <TabsTrigger value="trimestral">
                <BarChart3 className="w-4 h-4 mr-2" />
                Trimestral (Sorana)
              </TabsTrigger>
              <TabsTrigger value="satelite">
                <ArrowLeftRight className="w-4 h-4 mr-2" />
                Sorana vs Satélite
              </TabsTrigger>
              <TabsTrigger value="regiao">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                Sorana vs Região
              </TabsTrigger>
              <TabsTrigger value="comparacao">Comparação Tripla</TabsTrigger>
            </TabsList>
            <TabsContent value="mensal" className="mt-6">
              <p className="text-sm text-slate-600 dark:text-slate-400">Visualização mensal detalhada - Sorana</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dados Adicionais */}
      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <CardTitle>DADOS ADICIONAIS</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto py-4 flex items-center justify-start gap-3">
              <ArrowLeftRight className="w-5 h-5 text-blue-600" />
              <span className="text-left">Comparativo de Troca 2024-2025</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex items-center justify-start gap-3">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span className="text-left">Volume de Trocas 2025</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex items-center justify-start gap-3">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span className="text-left">% Vendas de Repasse</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex items-center justify-start gap-3">
              <Wrench className="w-5 h-5 text-blue-600" />
              <span className="text-left">Custos de Reparos e Garantia</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex items-center justify-start gap-3">
              <Package className="w-5 h-5 text-blue-600" />
              <span className="text-left">Estoque de Usados</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex items-center justify-start gap-3">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <span className="text-left">Lucro Bruto + Trade In</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex items-center justify-start gap-3">
              <Coins className="w-5 h-5 text-blue-600" />
              <span className="text-left">Juros s/ Estoque</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Volume de Vendas */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Volume de Vendas</CardTitle>
                <CardDescription>Evolução Temporal</CardDescription>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">Sorana - Total do Período</p>
              <p className="text-2xl font-bold">{totais.volumeTotal.toLocaleString('pt-BR')}</p>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="mes" 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.substring(0, 3)}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="volume" 
                    stroke="#001E50" 
                    strokeWidth={2}
                    dot={{ fill: "#001E50", r: 4 }}
                    name="Sorana"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Receita Líquida */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Receita Líquida</CardTitle>
                <CardDescription>Performance Financeira</CardDescription>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">Sorana - Total do Período</p>
              <p className="text-2xl font-bold">{formatCurrency(totais.receitaLiquida)}</p>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="mes" 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.substring(0, 3)}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="receitaLiquida" 
                    stroke="#0061AD" 
                    strokeWidth={2}
                    dot={{ fill: "#0061AD", r: 4 }}
                    name="Sorana"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Lucro Bruto */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lucro Bruto</CardTitle>
                <CardDescription>Margem de Contribuição</CardDescription>
              </div>
              <Badge className="bg-emerald-500 text-white">Margem de Contribuição</Badge>
            </div>
            <div className="mt-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">Sorana - Total do Período</p>
              <p className="text-2xl font-bold">{formatCurrency(totais.lucroBruto)}</p>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="mes" 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.substring(0, 3)}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="lucroBruto" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: "#10b981", r: 4 }}
                    name="Sorana"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Rendas Operacionais */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Rendas Operacionais</CardTitle>
                <CardDescription>Receitas Acessórias</CardDescription>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">Sorana - Total do Período</p>
              <p className="text-2xl font-bold">{formatCurrency(totais.rendasOperacionais)}</p>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="mes" 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.substring(0, 3)}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="rendasOperacionais" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={{ fill: "#8b5cf6", r: 4 }}
                    name="Sorana"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Categorias de Despesas - Gráfico de Barras Empilhadas */}
      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <CardTitle>Categorias de Despesas</CardTitle>
          <div className="flex items-center gap-4 mt-4">
            <Button variant="outline" size="sm" className="bg-slate-900 text-white hover:bg-slate-800">Pessoal</Button>
            <Button variant="outline" size="sm">Terceiros</Button>
            <Button variant="outline" size="sm">Ocupação</Button>
            <Button variant="outline" size="sm">Funcionamento</Button>
            <Button variant="outline" size="sm">Vendas</Button>
          </div>
          <div className="grid grid-cols-5 gap-4 mt-4">
            <div>
              <p className="text-xs text-slate-600">Pessoal</p>
              <p className="text-lg font-bold">{formatCurrency(totais.despesasPessoal)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Terceiros</p>
              <p className="text-lg font-bold">{formatCurrency(totais.despesasTerceiros)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Ocupação</p>
              <p className="text-lg font-bold">{formatCurrency(totais.despesasOcupacao)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Funcionamento</p>
              <p className="text-lg font-bold">{formatCurrency(totais.despesasFuncionamento)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Vendas</p>
              <p className="text-lg font-bold">{formatCurrency(totais.despesasVendas)}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <p className="text-sm font-medium">Total de Período por Categoria:</p>
            <p className="text-xl font-bold">{formatCurrency(totais.totalDespesas)}</p>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis 
                  dataKey="mes" 
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => value.substring(0, 3)}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="pessoal" stackId="a" fill="#001E50" name="Pessoal" />
                <Bar dataKey="terceiros" stackId="a" fill="#0ea5e9" name="Terceiros" />
                <Bar dataKey="ocupacao" stackId="a" fill="#f59e0b" name="Ocupação" />
                <Bar dataKey="funcionamento" stackId="a" fill="#ef4444" name="Funcionamento" />
                <Bar dataKey="vendas" stackId="a" fill="#8b5cf6" name="Vendas" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Lucro Operacional */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lucro Operacional</CardTitle>
            </div>
            <Badge className="bg-blue-600 text-white">Resultado Final</Badge>
          </div>
          <div className="mt-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Sorana - Total do Período</p>
            <p className="text-2xl font-bold">{formatCurrency(totais.lucroOperacional)}</p>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis 
                  dataKey="mes" 
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => value.substring(0, 3)}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="lucroOperacional" 
                  stroke="#001E50" 
                  strokeWidth={3}
                  dot={{ fill: "#001E50", r: 5 }}
                  name="Sorana"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
