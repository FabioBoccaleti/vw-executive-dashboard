import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingDown } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer, Legend } from "recharts"
import { useState } from "react"

export function VWFinancialDashboard() {
  // Estado para controlar categorias de despesas selecionadas
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['pessoal', 'terceiros', 'ocupacao', 'funcionamento', 'vendas'])

  // Função para toggle de categoria
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        // Não permitir desselecionar todas
        if (prev.length === 1) return prev
        return prev.filter(c => c !== category)
      } else {
        return [...prev, category]
      }
    })
  }
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

  // Dados DRE - Demonstrativo de Resultados
  const dreData = [
    {
      descricao: "VOLUME DE VENDAS",
      total: 934,
      percentTotal: null,
      meses: [100, 100, 98, 83, 83, 95, 70, 75, 102, 85, 79, 64]
    },
    {
      descricao: "RECEITA OPERACIONAL LIQUIDA",
      total: 95954132,
      percentTotal: 100.00,
      meses: [8328316, 8483342, 7902231, 7138470, 7226733, 8336360, 8485005, 10826922, 8927513, 9761159, 8538082, 0]
    },
    {
      descricao: "CUSTO OPERACIONAL DA RECEITA",
      total: -89534647,
      percentTotal: -93.31,
      meses: [-7835540, -7979610, -7280972, -6621037, -6634322, -7753002, -9965913, -10094242, -8199050, -9148803, -8022155, 0]
    },
    {
      descricao: "LUCRO (PREJUIZO) OPERACIONAL BRUTO",
      total: 6419485,
      percentTotal: 6.69,
      meses: [492776, 503732, 621259, 517432, 592411, 583358, 519092, 732680, 728463, 612356, 515927, 0]
    },
    {
      descricao: "DESPESAS C/ VENDAS",
      total: -4122456,
      percentTotal: -4.30,
      meses: [-307898, -328716, -305425, -273361, -317639, -370988, -426223, -441343, -440566, -438685, -471612, 0]
    },
    {
      descricao: "OUTRAS DESPESAS OPERACIONAIS",
      total: 1710743,
      percentTotal: 1.78,
      meses: [104975, 132525, 98310, 188520, 142952, 100280, 175314, 180902, 250305, 135840, 200820, 0]
    },
    {
      descricao: "OUTRAS RECEITAS OPERACIONAIS",
      total: 4357499,
      percentTotal: 4.54,
      meses: [379638, 362411, 323692, 310751, 295513, 360671, 524479, 450968, 373505, 535010, 440860, 0]
    },
    {
      descricao: "MARGEM DE CONTRIBUIÇÃO",
      total: 8365271,
      percentTotal: 8.72,
      meses: [669490, 669951, 737837, 743342, 713237, 673321, 792662, 923206, 911707, 844521, 685996, 0],
      isHighlight: true
    },
    {
      descricao: "DESPESAS C/ PESSOAL",
      total: -1705053,
      percentTotal: -1.78,
      meses: [-135776, -161711, -135728, -148064, -116746, -175251, -167967, -151586, -150194, -175864, -186164, 0]
    },
    {
      descricao: "DESPESAS C/ SERV. DE TERCEIROS",
      total: -650650,
      percentTotal: -0.68,
      meses: [-49272, -41589, -40445, -48066, -47524, -64734, -73389, -66365, -71881, -99203, -48182, 0]
    },
    {
      descricao: "DESPESAS C/ OCUPAÇÃO",
      total: -177636,
      percentTotal: -0.19,
      meses: [-13120, -13120, -13355, -13355, -13355, -13355, -13355, -21156, -21156, -21156, -21156, 0]
    },
    {
      descricao: "DESPESAS C/ FUNCIONAMENTO",
      total: -1642583,
      percentTotal: -1.71,
      meses: [-162040, -177923, -124227, -135629, -134151, -117842, -130073, -149322, -165388, -160983, -185006, 0]
    },
    {
      descricao: "LUCRO (PREJUIZO) OPERACIONAL LIQUIDO",
      total: 4189348,
      percentTotal: 4.37,
      meses: [309282, 275608, 424081, 398229, 401462, 302139, 407878, 534777, 503088, 387315, 245488, 0],
      isHighlight: true
    },
    {
      descricao: "AMORTIZAÇÕES E DEPRECIAÇÕES",
      total: -87251,
      percentTotal: -0.09,
      meses: [-8441, -2167, -8489, -8489, -8404, -8545, -8545, -8545, -8545, -8545, -8536, 0]
    },
    {
      descricao: "OUTRAS RECEITAS FINANCEIRAS",
      total: 0,
      percentTotal: 0.00,
      meses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    {
      descricao: "DESPESAS FINANCEIRAS NÃO OPERACIONAL",
      total: -20046,
      percentTotal: -0.02,
      meses: [-8619, -8581, -270, -165, -153, -561, -227, -259, -123, -310, -778, 0]
    },
    {
      descricao: "DESPESAS NÃO OPERACIONAIS",
      total: 0,
      percentTotal: 0.00,
      meses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    {
      descricao: "OUTRAS RENDAS NÃO OPERACIONAIS",
      total: 0,
      percentTotal: 0.00,
      meses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    {
      descricao: "LUCRO (PREJUIZO) ANTES IMPOSTOS",
      total: 4082051,
      percentTotal: 4.25,
      meses: [292222, 264860, 415322, 389575, 392905, 293033, 399105, 525973, 494420, 378461, 236175, 0],
      isHighlight: true
    },
    {
      descricao: "PROVISÕES IRPJ E C.S.",
      total: 0,
      percentTotal: 0.00,
      meses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    {
      descricao: "PARTICIPACÕES",
      total: 0,
      percentTotal: 0.00,
      meses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    {
      descricao: "LUCRO LIQUIDO DO EXERCICIO",
      total: 476215,
      percentTotal: 0.50,
      meses: [292222, 264860, 415322, 389575, 392905, 293033, 399105, 525973, 494420, 378461, 236175, 476215],
      isHighlight: true,
      isFinal: true
    }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:to-slate-900">
      {/* Executive Header */}
      <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-[#001E50] to-[#003875] rounded-xl p-3 shadow-lg">
                <span className="text-white font-bold text-3xl">VW</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Dashboard Executivo
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Veículos Usados • Análise Gerencial • Atualizado em 07/01/2026
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-green-100 text-green-800 border-green-200 px-4 py-2 text-sm">
                Ano Fiscal 2025
              </Badge>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 px-4 py-2 text-sm">
                Confidencial
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-8 py-8 space-y-8">
        {/* Executive Summary - KPIs */}
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Resumo Executivo</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Principais indicadores de performance</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="bg-white dark:bg-slate-900 border-l-4 border-l-blue-600 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardDescription className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Volume Total</CardDescription>
                <CardTitle className="text-3xl font-bold text-slate-900 dark:text-white">{totais.volumeTotal.toLocaleString('pt-BR')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-50 text-blue-700 text-xs">unidades</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-l-4 border-l-emerald-600 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardDescription className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Receita Líquida</CardDescription>
                <CardTitle className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(totais.receitaLiquida)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-50 text-emerald-700 text-xs">100,00%</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-l-4 border-l-purple-600 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardDescription className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Lucro Operacional</CardDescription>
                <CardTitle className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(totais.lucroOperacional)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200 text-xs">
                    <TrendingDown className="w-3 h-3 mr-1" />
                    -2,48%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-l-4 border-l-amber-600 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardDescription className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Margem Operacional</CardDescription>
                <CardTitle className="text-3xl font-bold text-slate-900 dark:text-white">{totais.margemOperacional.toFixed(2)}%</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-50 text-amber-700 text-xs">Abaixo do Target</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-l-4 border-l-slate-600 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardDescription className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Ticket Médio</CardDescription>
                <CardTitle className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(totais.ticketMedio)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge className="bg-slate-50 text-slate-700 text-xs">por unidade</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        </div>

        {/* Performance Analytics - Charts */}
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Análise de Performance</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Evolução dos principais indicadores operacionais e financeiros</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Receita de Vendas Líquidas */}
            <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Receita de Vendas Líquidas</CardTitle>
                    <CardDescription className="text-sm">Receita operacional líquida por período</CardDescription>
                  </div>
                  <Badge className="bg-cyan-50 text-cyan-700 border-cyan-200">100%</Badge>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(dreData[1].total / 1000)}</span>
                  <span className="text-sm text-slate-600">mil</span>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dreData[1].meses.map((val, idx) => ({ 
                      mes: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][idx],
                      valor: val / 1000
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <defs>
                        <linearGradient id="gradientReceita" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <Area 
                        type="monotone" 
                        dataKey="valor" 
                        stroke="#06b6d4" 
                        strokeWidth={2.5}
                        fill="url(#gradientReceita)"
                        name="Receita Líquida"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Volume de Vendas */}
            <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Volume de Vendas</CardTitle>
                    <CardDescription className="text-sm">Unidades comercializadas por período</CardDescription>
                  </div>
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200">2025</Badge>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">{dreData[0].total.toLocaleString('pt-BR')}</span>
                  <span className="text-sm text-slate-600">unidades</span>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dreData[0].meses.map((vol, idx) => ({ 
                      mes: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][idx],
                      volume: vol 
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="volume" fill="#0ea5e9" name="Volume" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Lucro Bruto */}
            <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Lucro Bruto</CardTitle>
                    <CardDescription className="text-sm">Resultado bruto das operações</CardDescription>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">{dreData[3].percentTotal?.toFixed(2)}%</Badge>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(dreData[3].total / 1000)}</span>
                  <span className="text-sm text-slate-600">mil</span>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dreData[3].meses.map((val, idx) => ({ 
                      mes: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][idx],
                      valor: val / 1000
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <defs>
                        <linearGradient id="gradientLucroBruto" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <Area 
                        type="monotone" 
                        dataKey="valor" 
                        stroke="#10b981" 
                        strokeWidth={2.5}
                        fill="url(#gradientLucroBruto)"
                        name="Lucro Bruto"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Margem de Contribuição */}
            <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Margem de Contribuição</CardTitle>
                    <CardDescription className="text-sm">Contribuição marginal do negócio</CardDescription>
                  </div>
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200">{dreData[7].percentTotal?.toFixed(2)}%</Badge>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(dreData[7].total / 1000)}</span>
                  <span className="text-sm text-slate-600">mil</span>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dreData[7].meses.map((val, idx) => ({ 
                      mes: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][idx],
                      valor: val / 1000
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line 
                        type="monotone" 
                        dataKey="valor" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={{ fill: "#3b82f6", r: 4, strokeWidth: 2, stroke: '#fff' }}
                        name="Margem"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Despesas por Categoria */}
            <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800 lg:col-span-2">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-6">
                <div className="flex items-start justify-between mb-6">
                  <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">Despesas por Categoria</CardTitle>
                  <div className="text-right">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total de Despesas</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">
                      {formatCurrency(Math.abs(dreData[8].total + dreData[9].total + dreData[10].total + dreData[11].total + dreData[4].total))}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Categorias de Despesa:</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge 
                        className={`cursor-pointer transition-all ${
                          selectedCategories.includes('pessoal') 
                            ? 'bg-[#001E50] text-white border-[#001E50] hover:bg-[#003875]' 
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                        onClick={() => toggleCategory('pessoal')}
                      >
                        Pessoal
                      </Badge>
                      <Badge 
                        className={`cursor-pointer transition-all ${
                          selectedCategories.includes('terceiros') 
                            ? 'bg-[#0089EF] text-white border-[#0089EF] hover:bg-[#0075CE]' 
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                        onClick={() => toggleCategory('terceiros')}
                      >
                        Terceiros
                      </Badge>
                      <Badge 
                        className={`cursor-pointer transition-all ${
                          selectedCategories.includes('ocupacao') 
                            ? 'bg-[#F59E0B] text-white border-[#F59E0B] hover:bg-[#D97706]' 
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                        onClick={() => toggleCategory('ocupacao')}
                      >
                        Ocupação
                      </Badge>
                      <Badge 
                        className={`cursor-pointer transition-all ${
                          selectedCategories.includes('funcionamento') 
                            ? 'bg-[#EF4444] text-white border-[#EF4444] hover:bg-[#DC2626]' 
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                        onClick={() => toggleCategory('funcionamento')}
                      >
                        Funcionamento
                      </Badge>
                      <Badge 
                        className={`cursor-pointer transition-all ${
                          selectedCategories.includes('vendas') 
                            ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] hover:bg-[#7C3AED]' 
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                        onClick={() => toggleCategory('vendas')}
                      >
                        Vendas
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Total do Período por Categoria:</p>
                    <div className="grid grid-cols-5 gap-4">
                      <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <div className="w-4 h-4 rounded-full bg-[#001E50] mx-auto mb-2"></div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Pessoal</p>
                        <p className="text-base font-bold text-slate-900 dark:text-white">{formatCurrency(Math.abs(dreData[8].total) / 1000)} mil</p>
                      </div>
                      <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <div className="w-4 h-4 rounded-full bg-[#0089EF] mx-auto mb-2"></div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Terceiros</p>
                        <p className="text-base font-bold text-slate-900 dark:text-white">{formatCurrency(Math.abs(dreData[9].total) / 1000)} mil</p>
                      </div>
                      <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <div className="w-4 h-4 rounded-full bg-[#F59E0B] mx-auto mb-2"></div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Ocupação</p>
                        <p className="text-base font-bold text-slate-900 dark:text-white">{formatCurrency(Math.abs(dreData[10].total) / 1000)} mil</p>
                      </div>
                      <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <div className="w-4 h-4 rounded-full bg-[#EF4444] mx-auto mb-2"></div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Funcionamento</p>
                        <p className="text-base font-bold text-slate-900 dark:text-white">{formatCurrency(Math.abs(dreData[11].total) / 1000)} mil</p>
                      </div>
                      <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <div className="w-4 h-4 rounded-full bg-[#8B5CF6] mx-auto mb-2"></div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Vendas</p>
                        <p className="text-base font-bold text-slate-900 dark:text-white">{formatCurrency(Math.abs(dreData[4].total) / 1000)} mil</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ChartContainer config={chartConfig} className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dreData[8].meses.map((_, idx) => ({ 
                      mes: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][idx],
                      pessoal: Math.abs(dreData[8].meses[idx]),
                      terceiros: Math.abs(dreData[9].meses[idx]),
                      ocupacao: Math.abs(dreData[10].meses[idx]),
                      funcionamento: Math.abs(dreData[11].meses[idx]),
                      vendas: Math.abs(dreData[4].meses[idx])
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      {selectedCategories.includes('pessoal') && (
                        <Bar dataKey="pessoal" stackId="a" fill="#001E50" name="Pessoal" />
                      )}
                      {selectedCategories.includes('terceiros') && (
                        <Bar dataKey="terceiros" stackId="a" fill="#0089EF" name="Terceiros" />
                      )}
                      {selectedCategories.includes('ocupacao') && (
                        <Bar dataKey="ocupacao" stackId="a" fill="#F59E0B" name="Ocupação" />
                      )}
                      {selectedCategories.includes('funcionamento') && (
                        <Bar dataKey="funcionamento" stackId="a" fill="#EF4444" name="Funcionamento" />
                      )}
                      {selectedCategories.includes('vendas') && (
                        <Bar dataKey="vendas" stackId="a" fill="#8B5CF6" name="Vendas" />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Resultado Operacional - Destaque */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 shadow-xl border-0">
          <CardHeader className="border-b border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-white">Resultado Operacional Líquido</CardTitle>
                <CardDescription className="text-slate-300 text-base">Desempenho operacional consolidado</CardDescription>
              </div>
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 text-base px-4 py-2">
                {dreData[12].percentTotal?.toFixed(2)}%
              </Badge>
            </div>
            <div className="mt-6 flex items-center gap-8">
              <div>
                <p className="text-sm text-slate-400 mb-1">Total do Período</p>
                <p className="text-4xl font-bold text-white">{formatCurrency(dreData[12].total / 1000)} <span className="text-2xl text-slate-400">mil</span></p>
              </div>
              <div className="h-12 w-px bg-slate-700"></div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Margem Operacional</p>
                <p className="text-4xl font-bold text-purple-400">{dreData[12].percentTotal?.toFixed(2)}%</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ChartContainer config={chartConfig} className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dreData[12].meses.map((val, idx) => ({ 
                  mes: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][idx],
                  valor: val / 1000
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 13, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 13, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <defs>
                    <linearGradient id="gradientResultado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.6}/>
                      <stop offset="100%" stopColor="#a855f7" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="valor" 
                    stroke="#a855f7" 
                    strokeWidth={3}
                    fill="url(#gradientResultado)"
                    name="Resultado Operacional"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* DRE - Demonstrativo de Resultados do Exercício */}
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Demonstrativo de Resultados (DRE)</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Relatório detalhado de desempenho mensal - Ano Fiscal 2025</p>
          </div>

          <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 min-w-[300px]">Descrição</th>
                      <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300 min-w-[120px]">Total</th>
                      <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300 min-w-[80px]">%</th>
                      <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">Jan</th>
                      <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">Fev</th>
                      <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">Mar</th>
                      <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">Abr</th>
                      <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">Mai</th>
                      <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">Jun</th>
                      <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">Jul</th>
                      <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">Ago</th>
                      <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">Set</th>
                      <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">Out</th>
                      <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">Nov</th>
                      <th className="text-right p-4 font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">Dez</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dreData.map((item, index) => (
                      <tr 
                        key={index}
                        className={`
                          ${item.isHighlight ? 'bg-blue-50 dark:bg-blue-950/20 font-semibold' : ''}
                          ${item.isFinal ? 'bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-600' : ''}
                          ${!item.isHighlight && !item.isFinal ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}
                          border-b border-slate-100 dark:border-slate-800
                        `}
                      >
                        <td className="p-4 text-slate-900 dark:text-white sticky left-0 bg-inherit z-10">{item.descricao}</td>
                        <td className={`p-4 text-right ${item.total < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                          {index === 0 ? item.total.toLocaleString('pt-BR') : formatCurrency(item.total)}
                        </td>
                        <td className="p-4 text-right text-slate-600 dark:text-slate-400">
                          {item.percentTotal !== undefined && item.percentTotal !== null ? `${item.percentTotal.toFixed(2)}%` : '-'}
                        </td>
                        {item.meses.map((valor, mesIdx) => (
                          <td 
                            key={mesIdx}
                            className={`p-4 text-right ${valor < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}
                          >
                            {index === 0 ? valor.toLocaleString('pt-BR') : formatCurrency(valor)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Insights Executivos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardDescription className="text-xs font-semibold text-blue-700 dark:text-blue-400">Receita Operacional Líquida</CardDescription>
              <CardTitle className="text-2xl text-blue-900 dark:text-blue-100">{formatCurrency(95954132)}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/50 border-emerald-200 dark:border-emerald-800">
            <CardHeader className="pb-3">
              <CardDescription className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Margem de Contribuição</CardDescription>
              <CardTitle className="text-2xl text-emerald-900 dark:text-emerald-100">
                {formatCurrency(8365271)} <span className="text-sm">(8,72%)</span>
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-3">
              <CardDescription className="text-xs font-semibold text-purple-700 dark:text-purple-400">Lucro Operacional</CardDescription>
              <CardTitle className="text-2xl text-purple-900 dark:text-purple-100">
                {formatCurrency(4189348)} <span className="text-sm">(4,37%)</span>
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50 border-amber-200 dark:border-amber-800">
            <CardHeader className="pb-3">
              <CardDescription className="text-xs font-semibold text-amber-700 dark:text-amber-400">Lucro Líquido</CardDescription>
              <CardTitle className="text-2xl text-amber-900 dark:text-amber-100">
                {formatCurrency(476215)} <span className="text-sm">(0,50%)</span>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
  )
}
