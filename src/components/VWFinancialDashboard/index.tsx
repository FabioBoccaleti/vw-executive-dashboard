import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingDown } from "lucide-react"
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

      {/* Gráficos DRE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Volume de Vendas */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Volume de Vendas (DRE)</CardTitle>
            <CardDescription>Unidades vendidas por mês - 2025</CardDescription>
            <div className="mt-2">
              <p className="text-2xl font-bold">{dreData[0].total.toLocaleString('pt-BR')} unidades</p>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dreData[0].meses.map((vol, idx) => ({ 
                  mes: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][idx],
                  volume: vol 
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="volume" fill="#001E50" name="Volume" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Lucro Bruto */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Lucro Bruto (DRE)</CardTitle>
            <CardDescription>Evolução mensal do lucro bruto - 2025</CardDescription>
            <div className="mt-2">
              <p className="text-2xl font-bold">{formatCurrency(dreData[3].total)}</p>
              <p className="text-sm text-slate-600">Margem: {dreData[3].percentTotal?.toFixed(2)}%</p>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dreData[3].meses.map((val, idx) => ({ 
                  mes: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][idx],
                  valor: val 
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <defs>
                    <linearGradient id="colorLucroBruto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="valor" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorLucroBruto)"
                    name="Lucro Bruto"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Margem de Contribuição */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Margem de Contribuição (DRE)</CardTitle>
            <CardDescription>Evolução mensal da margem - 2025</CardDescription>
            <div className="mt-2">
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(dreData[7].total)}</p>
              <p className="text-sm text-slate-600">Margem: {dreData[7].percentTotal?.toFixed(2)}%</p>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dreData[7].meses.map((val, idx) => ({ 
                  mes: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][idx],
                  valor: val 
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="valor" 
                    stroke="#2563eb" 
                    strokeWidth={3}
                    dot={{ fill: "#2563eb", r: 5 }}
                    name="Margem Contribuição"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Despesas Totais */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Despesas por Categoria (DRE)</CardTitle>
            <CardDescription>Distribuição mensal de despesas - 2025</CardDescription>
            <div className="mt-2">
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(
                  dreData[8].total + dreData[9].total + dreData[10].total + dreData[11].total
                )}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dreData[8].meses.map((_, idx) => ({ 
                  mes: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][idx],
                  pessoal: Math.abs(dreData[8].meses[idx]),
                  terceiros: Math.abs(dreData[9].meses[idx]),
                  ocupacao: Math.abs(dreData[10].meses[idx]),
                  funcionamento: Math.abs(dreData[11].meses[idx])
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="pessoal" stackId="a" fill="#dc2626" name="Pessoal" />
                  <Bar dataKey="terceiros" stackId="a" fill="#ea580c" name="Terceiros" />
                  <Bar dataKey="ocupacao" stackId="a" fill="#f59e0b" name="Ocupação" />
                  <Bar dataKey="funcionamento" stackId="a" fill="#fbbf24" name="Funcionamento" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Resultado Operacional Líquido */}
        <Card className="shadow-lg lg:col-span-2">
          <CardHeader>
            <CardTitle>Resultado Operacional Líquido (DRE)</CardTitle>
            <CardDescription>Evolução do resultado operacional - 2025</CardDescription>
            <div className="mt-2 flex items-center gap-6">
              <div>
                <p className="text-sm text-slate-600">Total</p>
                <p className="text-3xl font-bold text-purple-600">{formatCurrency(dreData[12].total)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Margem Operacional</p>
                <p className="text-2xl font-bold">{dreData[12].percentTotal?.toFixed(2)}%</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dreData[12].meses.map((val, idx) => ({ 
                  mes: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][idx],
                  valor: val 
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <defs>
                    <linearGradient id="colorResultado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="valor" 
                    stroke="#7c3aed" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorResultado)"
                    name="Resultado Operacional"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* DRE - Demonstrativo de Resultados */}
      <Card className="shadow-lg mt-6">
        <CardHeader>
          <CardTitle className="text-2xl">DRE - Demonstrativo de Resultados do Exercício</CardTitle>
          <CardDescription>Análise detalhada mensal - Ano 2025</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#001E50] text-white">
                  <th className="p-3 text-left font-semibold sticky left-0 bg-[#001E50] z-10">Descrição</th>
                  <th className="p-3 text-right font-semibold">Total</th>
                  <th className="p-3 text-right font-semibold">%</th>
                  <th className="p-3 text-right font-semibold">Jan/25</th>
                  <th className="p-3 text-right font-semibold">Fev/25</th>
                  <th className="p-3 text-right font-semibold">Mar/25</th>
                  <th className="p-3 text-right font-semibold">Abr/25</th>
                  <th className="p-3 text-right font-semibold">Mai/25</th>
                  <th className="p-3 text-right font-semibold">Jun/25</th>
                  <th className="p-3 text-right font-semibold">Jul/25</th>
                  <th className="p-3 text-right font-semibold">Ago/25</th>
                  <th className="p-3 text-right font-semibold">Set/25</th>
                  <th className="p-3 text-right font-semibold">Out/25</th>
                  <th className="p-3 text-right font-semibold">Nov/25</th>
                  <th className="p-3 text-right font-semibold">Dez/25</th>
                </tr>
              </thead>
              <tbody>
                {dreData.map((linha, index) => (
                  <tr 
                    key={index} 
                    className={`
                      border-b border-slate-200 dark:border-slate-700
                      ${linha.isHighlight ? 'bg-blue-50 dark:bg-blue-900/20 font-semibold' : ''}
                      ${linha.isFinal ? 'bg-green-50 dark:bg-green-900/20 font-bold' : ''}
                      hover:bg-slate-50 dark:hover:bg-slate-800
                    `}
                  >
                    <td className="p-3 sticky left-0 bg-inherit z-10 font-medium">
                      {linha.descricao}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {linha.descricao === "VOLUME DE VENDAS" 
                        ? linha.total.toLocaleString('pt-BR')
                        : formatCurrency(linha.total)
                      }
                    </td>
                    <td className={`p-3 text-right ${linha.percentTotal && linha.percentTotal < 0 ? 'text-red-600' : ''}`}>
                      {linha.percentTotal !== null ? `${linha.percentTotal.toFixed(2)}%` : '-'}
                    </td>
                    {linha.meses.map((valor, mesIndex) => (
                      <td key={mesIndex} className="p-3 text-right">
                        {valor === 0 ? '-' : (
                          linha.descricao === "VOLUME DE VENDAS"
                            ? valor.toLocaleString('pt-BR')
                            : new Intl.NumberFormat('pt-BR', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }).format(valor)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Resumo dos principais indicadores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 p-4 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-1">Receita Operacional</p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                {formatCurrency(95954132)}
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 p-4 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-1">Margem de Contribuição</p>
              <p className="text-lg font-bold text-green-900 dark:text-green-100">
                {formatCurrency(8365271)} <span className="text-sm">(8,72%)</span>
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 p-4 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-1">Lucro Operacional</p>
              <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
                {formatCurrency(4189348)} <span className="text-sm">(4,37%)</span>
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900 dark:to-amber-800 p-4 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-1">Lucro Líquido</p>
              <p className="text-lg font-bold text-amber-900 dark:text-amber-100">
                {formatCurrency(476215)} <span className="text-sm">(0,50%)</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
