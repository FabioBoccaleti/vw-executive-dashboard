import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, ArrowLeft } from "lucide-react"
import { useState, useMemo } from "react"
import { loadMetricsData, loadDREData } from "@/lib/dataStorage"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts"

interface YearComparisonProps {
  onBack: () => void
  initialYear1?: 2024 | 2025 | 2026 | 2027
  initialYear2?: 2024 | 2025 | 2026 | 2027
}

export function YearComparison({ onBack, initialYear1 = 2025, initialYear2 = 2024 }: YearComparisonProps) {
  const [year1, setYear1] = useState<2024 | 2025 | 2026 | 2027>(initialYear1)
  const [year2, setYear2] = useState<2024 | 2025 | 2026 | 2027>(initialYear2)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'mensal' | 'bimestral' | 'trimestral' | 'semestral'>('mensal')

  // Carregar dados dos dois anos
  const data1 = useMemo(() => loadMetricsData(year1), [year1])
  const data2 = useMemo(() => loadMetricsData(year2), [year2])
  const dre1 = useMemo(() => loadDREData(year1), [year1])
  const dre2 = useMemo(() => loadDREData(year2), [year2])

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  const calculateDifference = (value1: number, value2: number) => {
    const absolute = value1 - value2
    const percentage = value2 !== 0 ? ((value1 - value2) / Math.abs(value2)) * 100 : 0
    return { absolute, percentage }
  }

  // Funções auxiliares para buscar dados da DRE
  const getDRELineTotal = (dre: any[] | null, descricao: string) => {
    return dre?.find(line => line.descricao === descricao)?.meses?.reduce((a: number, b: number) => a + b, 0) || 0
  }

  const getDRELineValues = (dre: any[] | null, descricao: string) => {
    return dre?.find(line => line.descricao === descricao)?.meses || []
  }

  const getDifferenceColor = (diff: number) => {
    if (diff > 0) return 'text-green-600 dark:text-green-400'
    if (diff < 0) return 'text-red-600 dark:text-red-400'
    return 'text-slate-600 dark:text-slate-400'
  }

  const getDifferenceIcon = (diff: number) => {
    if (diff > 0) return <TrendingUp className="w-4 h-4" />
    if (diff < 0) return <TrendingDown className="w-4 h-4" />
    return null
  }

  // Função para agregar dados por período
  const aggregateData = (values: number[]) => {
    if (!values || values.length === 0) return []
    
    if (viewMode === 'mensal') return values
    
    const result: number[] = []
    if (viewMode === 'bimestral') {
      for (let i = 0; i < values.length; i += 2) {
        result.push((values[i] || 0) + (values[i + 1] || 0))
      }
    } else if (viewMode === 'trimestral') {
      for (let i = 0; i < values.length; i += 3) {
        result.push((values[i] || 0) + (values[i + 1] || 0) + (values[i + 2] || 0))
      }
    } else if (viewMode === 'semestral') {
      for (let i = 0; i < values.length; i += 6) {
        result.push((values[i] || 0) + (values[i + 1] || 0) + (values[i + 2] || 0) + 
                   (values[i + 3] || 0) + (values[i + 4] || 0) + (values[i + 5] || 0))
      }
    }
    return result
  }

  // Função para obter labels dos períodos
  const getPeriodLabels = () => {
    const baseMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    
    if (viewMode === 'mensal') return baseMonths
    if (viewMode === 'bimestral') return ['1º Bim', '2º Bim', '3º Bim', '4º Bim', '5º Bim', '6º Bim']
    if (viewMode === 'trimestral') return ['1º Trim', '2º Trim', '3º Trim', '4º Trim']
    if (viewMode === 'semestral') return ['1º Sem', '2º Sem']
    return baseMonths
  }

  // Calcular totais anuais
  const calculateAnnualTotal = (data: any, field: string[]) => {
    let obj: any = data
    for (const key of field) {
      obj = obj?.[key]
      if (!obj) return 0
    }
    if (Array.isArray(obj)) {
      return obj.reduce((sum, val) => sum + (val || 0), 0)
    }
    return 0
  }

  // Totalizadores principais
  const totals1 = useMemo(() => {
    const volumeTotal = dre1?.[0]?.meses?.reduce((a: number, b: number) => a + b, 0) || 0
    const receitaLiquida = getDRELineTotal(dre1, 'RECEITA OPERACIONAL LIQUIDA')
    const lucro = getDRELineTotal(dre1, 'LUCRO (PREJUIZO) ANTES IMPOSTOS')
    return { volumeNovos: 0, volumeUsados: 0, volumeTotal, receitaLiquida, lucro }
  }, [dre1])

  const totals2 = useMemo(() => {
    const volumeTotal = dre2?.[0]?.meses?.reduce((a: number, b: number) => a + b, 0) || 0
    const receitaLiquida = getDRELineTotal(dre2, 'RECEITA OPERACIONAL LIQUIDA')
    const lucro = getDRELineTotal(dre2, 'LUCRO (PREJUIZO) ANTES IMPOSTOS')
    return { volumeNovos: 0, volumeUsados: 0, volumeTotal, receitaLiquida, lucro }
  }, [dre2])

  // Dados para gráfico comparativo
  const chartData = [
    {
      name: 'Volume',
      [year1]: totals1.volumeTotal,
      [year2]: totals2.volumeTotal
    },
    {
      name: 'Receita Líquida',
      [year1]: totals1.receitaLiquida / 1000000,
      [year2]: totals2.receitaLiquida / 1000000
    },
    {
      name: 'Lucro',
      [year1]: totals1.lucro / 1000000,
      [year2]: totals2.lucro / 1000000
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:to-slate-900">
      {/* Header da Página de Comparação */}
      <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={onBack}
                variant="ghost"
                size="sm"
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
              <div className="bg-gradient-to-br from-[#001E50] to-[#003875] rounded-xl p-3 shadow-lg">
                <span className="text-white font-bold text-3xl">VW</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Comparação de Anos Fiscais
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Análise Comparativa • Veículos Usados
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Comparar:</span>
              <Select value={year1.toString()} onValueChange={(v) => setYear1(parseInt(v) as any)}>
                <SelectTrigger className="w-[140px] bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <SelectValue>
                    <span className="text-green-800 dark:text-green-200 font-semibold">{year1}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-lg font-bold text-slate-500">vs</span>
              <Select value={year2.toString()} onValueChange={(v) => setYear2(parseInt(v) as any)}>
                <SelectTrigger className="w-[140px] bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <SelectValue>
                    <span className="text-blue-800 dark:text-blue-200 font-semibold">{year2}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                </SelectContent>
              </Select>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 px-4 py-2 text-sm">
                Confidencial
              </Badge>
            </div>
          </div>
          
          {/* Controles de Visualização */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Visualizar:</span>
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                <Button
                  onClick={() => setViewMode('mensal')}
                  variant={viewMode === 'mensal' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                >
                  Mensal
                </Button>
                <Button
                  onClick={() => setViewMode('bimestral')}
                  variant={viewMode === 'bimestral' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                >
                  Bimestral
                </Button>
                <Button
                  onClick={() => setViewMode('trimestral')}
                  variant={viewMode === 'trimestral' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                >
                  Trimestral
                </Button>
                <Button
                  onClick={() => setViewMode('semestral')}
                  variant={viewMode === 'semestral' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                >
                  Semestral
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo da Comparação */}
      <div className="max-w-[1800px] mx-auto px-8 py-8">
        <div className="space-y-6">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Volume Total */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Volume Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{year1}</span>
                    <span className="font-bold text-lg">{totals1.volumeTotal.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{year2}</span>
                    <span className="font-bold text-lg">{totals2.volumeTotal.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className={`flex items-center gap-2 pt-2 border-t ${getDifferenceColor(calculateDifference(totals1.volumeTotal, totals2.volumeTotal).absolute)}`}>
                    {getDifferenceIcon(calculateDifference(totals1.volumeTotal, totals2.volumeTotal).absolute)}
                    <span className="font-semibold text-sm">
                      {calculateDifference(totals1.volumeTotal, totals2.volumeTotal).absolute > 0 ? '+' : ''}
                      {calculateDifference(totals1.volumeTotal, totals2.volumeTotal).absolute.toLocaleString('pt-BR')}
                    </span>
                    <span className="text-xs">
                      ({calculateDifference(totals1.volumeTotal, totals2.volumeTotal).percentage > 0 ? '+' : ''}
                      {calculateDifference(totals1.volumeTotal, totals2.volumeTotal).percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Receita Líquida */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Receita Líquida
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{year1}</span>
                    <span className="font-bold text-lg">{formatCurrency(totals1.receitaLiquida)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{year2}</span>
                    <span className="font-bold text-lg">{formatCurrency(totals2.receitaLiquida)}</span>
                  </div>
                  <div className={`flex items-center gap-2 pt-2 border-t ${getDifferenceColor(calculateDifference(totals1.receitaLiquida, totals2.receitaLiquida).absolute)}`}>
                    {getDifferenceIcon(calculateDifference(totals1.receitaLiquida, totals2.receitaLiquida).absolute)}
                    <span className="font-semibold text-sm">
                      {formatCurrency(calculateDifference(totals1.receitaLiquida, totals2.receitaLiquida).absolute)}
                    </span>
                    <span className="text-xs">
                      ({calculateDifference(totals1.receitaLiquida, totals2.receitaLiquida).percentage > 0 ? '+' : ''}
                      {calculateDifference(totals1.receitaLiquida, totals2.receitaLiquida).percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lucro */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Lucro Antes dos Impostos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{year1}</span>
                    <span className="font-bold text-lg">{formatCurrency(totals1.lucro)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{year2}</span>
                    <span className="font-bold text-lg">{formatCurrency(totals2.lucro)}</span>
                  </div>
                  <div className={`flex items-center gap-2 pt-2 border-t ${getDifferenceColor(calculateDifference(totals1.lucro, totals2.lucro).absolute)}`}>
                    {getDifferenceIcon(calculateDifference(totals1.lucro, totals2.lucro).absolute)}
                    <span className="font-semibold text-sm">
                      {formatCurrency(calculateDifference(totals1.lucro, totals2.lucro).absolute)}
                    </span>
                    <span className="text-xs">
                      ({calculateDifference(totals1.lucro, totals2.lucro).percentage > 0 ? '+' : ''}
                      {calculateDifference(totals1.lucro, totals2.lucro).percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Margem */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Margem (%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{year1}</span>
                    <span className="font-bold text-lg">
                      {totals1.receitaLiquida ? ((totals1.lucro / totals1.receitaLiquida) * 100).toFixed(2) : '0.00'}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{year2}</span>
                    <span className="font-bold text-lg">
                      {totals2.receitaLiquida ? ((totals2.lucro / totals2.receitaLiquida) * 100).toFixed(2) : '0.00'}%
                    </span>
                  </div>
                  <div className={`flex items-center gap-2 pt-2 border-t ${getDifferenceColor(
                    (totals1.receitaLiquida ? (totals1.lucro / totals1.receitaLiquida) * 100 : 0) -
                    (totals2.receitaLiquida ? (totals2.lucro / totals2.receitaLiquida) * 100 : 0)
                  )}`}>
                    {getDifferenceIcon(
                      (totals1.receitaLiquida ? (totals1.lucro / totals1.receitaLiquida) * 100 : 0) -
                      (totals2.receitaLiquida ? (totals2.lucro / totals2.receitaLiquida) * 100 : 0)
                    )}
                    <span className="font-semibold text-sm">
                      {((totals1.receitaLiquida ? (totals1.lucro / totals1.receitaLiquida) * 100 : 0) -
                        (totals2.receitaLiquida ? (totals2.lucro / totals2.receitaLiquida) * 100 : 0)) > 0 ? '+' : ''}
                      {((totals1.receitaLiquida ? (totals1.lucro / totals1.receitaLiquida) * 100 : 0) -
                        (totals2.receitaLiquida ? (totals2.lucro / totals2.receitaLiquida) * 100 : 0)).toFixed(2)} p.p.
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos Detalhados por Métrica */}
          <div className="grid grid-cols-1 gap-6">
            {/* Volume de Vendas */}
            <Card className="bg-white dark:bg-slate-900">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                      Volume de Vendas
                    </CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Unidades comercializadas por período
                    </p>
                  </div>
                  <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {year1} vs {year2}
                  </Badge>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Anual</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {totals1.volumeTotal.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {year1}
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                      {totals2.volumeTotal.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {year2}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Média Mensal</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {Math.round(totals1.volumeTotal / 12).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {year1}
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                      {Math.round(totals2.volumeTotal / 12).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {year2}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Variação</p>
                    <div className={`flex items-center gap-1 ${getDifferenceColor(totals1.volumeTotal - totals2.volumeTotal)}`}>
                      {getDifferenceIcon(totals1.volumeTotal - totals2.volumeTotal)}
                      <div>
                        <p className="text-lg font-bold">
                          {calculateDifference(totals1.volumeTotal, totals2.volumeTotal).percentage > 0 ? '+' : ''}
                          {calculateDifference(totals1.volumeTotal, totals2.volumeTotal).percentage.toFixed(1)}%
                        </p>
                        <p className="text-xs">
                          {calculateDifference(totals1.volumeTotal, totals2.volumeTotal).absolute > 0 ? '+' : ''}
                          {calculateDifference(totals1.volumeTotal, totals2.volumeTotal).absolute.toLocaleString('pt-BR')} un
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart 
                    data={getPeriodLabels().map((label, index) => {
                      const volumeLine1 = dre1?.[0]
                      const volumeLine2 = dre2?.[0]
                      const values1 = aggregateData(volumeLine1?.meses || [])
                      const values2 = aggregateData(volumeLine2?.meses || [])
                      return {
                        name: label,
                        [year1]: values1[index] || 0,
                        [year2]: values2[index] || 0
                      }
                    })}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                              <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.name}</p>
                              <div className="space-y-1">
                                <p className="text-sm">
                                  <span className="text-blue-600 dark:text-blue-400">▪ {year1}: </span>
                                  <span className="font-bold">{formatNumber(Number(payload[0]?.value || 0))} un</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-green-600 dark:text-green-400">▪ {year2}: </span>
                                  <span className="font-bold">{formatNumber(Number(payload[1]?.value || 0))} un</span>
                                </p>
                                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Diferença: <span className={`font-bold ${getDifferenceColor(Number(payload[0]?.value || 0) - Number(payload[1]?.value || 0))}`}>
                                      {Number(payload[0]?.value || 0) - Number(payload[1]?.value || 0) > 0 ? '+' : ''}
                                      {(Number(payload[0]?.value || 0) - Number(payload[1]?.value || 0)).toLocaleString('pt-BR')} un
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                    />
                    <Bar dataKey={String(year1)} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={String(year2)} fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Receita de Vendas Líquidas */}
            <Card className="bg-white dark:bg-slate-900">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                      Receita de Vendas Líquidas
                    </CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Receita operacional líquida por período
                    </p>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    100% Base
                  </Badge>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Acumulado</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatCurrency(totals1.receitaLiquida)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {year1}
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                      {formatCurrency(totals2.receitaLiquida)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {year2}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ticket Médio</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatCurrency(totals1.volumeTotal > 0 ? totals1.receitaLiquida / totals1.volumeTotal : 0)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {year1}
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                      {formatCurrency(totals2.volumeTotal > 0 ? totals2.receitaLiquida / totals2.volumeTotal : 0)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {year2}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Média Mensal</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatCurrency(totals1.receitaLiquida / 12)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {year1}
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                      {formatCurrency(totals2.receitaLiquida / 12)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {year2}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart 
                    data={getPeriodLabels().map((label, index) => {
                      const values1 = aggregateData(getDRELineValues(dre1, 'RECEITA OPERACIONAL LIQUIDA'))
                      const values2 = aggregateData(getDRELineValues(dre2, 'RECEITA OPERACIONAL LIQUIDA'))
                      return {
                        name: label,
                        [year1]: values1[index] || 0,
                        [year2]: values2[index] || 0
                      }
                    })}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                              <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.name}</p>
                              <div className="space-y-1">
                                <p className="text-sm">
                                  <span className="text-blue-600 dark:text-blue-400">▪ {year1}: </span>
                                  <span className="font-bold">{formatCurrency(Number(payload[0]?.value || 0))}</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-green-600 dark:text-green-400">▪ {year2}: </span>
                                  <span className="font-bold">{formatCurrency(Number(payload[1]?.value || 0))}</span>
                                </p>
                                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Diferença: <span className={`font-bold ${getDifferenceColor(Number(payload[0]?.value || 0) - Number(payload[1]?.value || 0))}`}>
                                      {Number(payload[0]?.value || 0) - Number(payload[1]?.value || 0) > 0 ? '+' : ''}
                                      {formatCurrency(Number(payload[0]?.value || 0) - Number(payload[1]?.value || 0))}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                    />
                    <Bar dataKey={String(year1)} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={String(year2)} fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Lucro Bruto */}
            <Card className="bg-white dark:bg-slate-900">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                      Lucro Bruto
                    </CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Receita líquida menos custos operacionais
                    </p>
                  </div>
                  <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                    DRE
                  </Badge>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Acumulado</p>
                    {(() => {
                      const lucroBruto1 = getDRELineTotal(dre1, 'LUCRO (PREJUIZO) OPERACIONAL BRUTO')
                      const lucroBruto2 = getDRELineTotal(dre2, 'LUCRO (PREJUIZO) OPERACIONAL BRUTO')
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {formatCurrency(lucroBruto1)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {formatCurrency(lucroBruto2)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Margem (%)</p>
                    {(() => {
                      const lucroBruto1 = getDRELineTotal(dre1, 'LUCRO (PREJUIZO) OPERACIONAL BRUTO')
                      const lucroBruto2 = getDRELineTotal(dre2, 'LUCRO (PREJUIZO) OPERACIONAL BRUTO')
                      const margem1 = totals1.receitaLiquida > 0 ? (lucroBruto1 / totals1.receitaLiquida) * 100 : 0
                      const margem2 = totals2.receitaLiquida > 0 ? (lucroBruto2 / totals2.receitaLiquida) * 100 : 0
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {margem1.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {margem2.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Variação</p>
                    {(() => {
                      const lucroBruto1 = getDRELineTotal(dre1, 'LUCRO (PREJUIZO) OPERACIONAL BRUTO')
                      const lucroBruto2 = getDRELineTotal(dre2, 'LUCRO (PREJUIZO) OPERACIONAL BRUTO')
                      const diff = calculateDifference(lucroBruto1, lucroBruto2)
                      return (
                        <div className={`flex items-center gap-1 ${getDifferenceColor(diff.absolute)}`}>
                          {getDifferenceIcon(diff.absolute)}
                          <div>
                            <p className="text-lg font-bold">
                              {diff.percentage > 0 ? '+' : ''}{diff.percentage.toFixed(1)}%
                            </p>
                            <p className="text-xs">
                              {formatCurrency(diff.absolute)}
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart 
                    data={getPeriodLabels().map((label, index) => {
                      const lucroBrutoLine1 = dre1?.find(line => line.descricao === 'LUCRO (PREJUIZO) OPERACIONAL BRUTO')
                      const lucroBrutoLine2 = dre2?.find(line => line.descricao === 'LUCRO (PREJUIZO) OPERACIONAL BRUTO')
                      const values1 = aggregateData(lucroBrutoLine1?.meses || [])
                      const values2 = aggregateData(lucroBrutoLine2?.meses || [])
                      return {
                        name: label,
                        [year1]: values1[index] || 0,
                        [year2]: values2[index] || 0
                      }
                    })}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          // Calcular receita líquida do período para calcular a margem
                          const periodoIndex = getPeriodLabels().indexOf(payload[0].payload.name)
                          const receitaLine1 = dre1?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaLine2 = dre2?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaValues1 = aggregateData(receitaLine1?.meses || [])
                          const receitaValues2 = aggregateData(receitaLine2?.meses || [])
                          const receitaPeriodo1 = receitaValues1[periodoIndex] || 0
                          const receitaPeriodo2 = receitaValues2[periodoIndex] || 0
                          
                          const valor1 = Number(payload[0]?.value || 0)
                          const valor2 = Number(payload[1]?.value || 0)
                          const margem1 = receitaPeriodo1 > 0 ? (valor1 / receitaPeriodo1) * 100 : 0
                          const margem2 = receitaPeriodo2 > 0 ? (valor2 / receitaPeriodo2) * 100 : 0
                          
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                              <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.name}</p>
                              <div className="space-y-1">
                                <p className="text-sm">
                                  <span className="text-blue-600 dark:text-blue-400">▪ {year1}: </span>
                                  <span className="font-bold">{formatCurrency(valor1)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem1.toFixed(2)}%)</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-green-600 dark:text-green-400">▪ {year2}: </span>
                                  <span className="font-bold">{formatCurrency(valor2)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem2.toFixed(2)}%)</span>
                                </p>
                                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Diferença: <span className={`font-bold ${getDifferenceColor(valor1 - valor2)}`}>
                                      {formatCurrency(valor1 - valor2)}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                    />
                    <Bar dataKey={String(year1)} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={String(year2)} fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Margem de Contribuição */}
            <Card className="bg-white dark:bg-slate-900">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                      Margem de Contribuição
                    </CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Lucro bruto menos outras despesas e rendas operacionais
                    </p>
                  </div>
                  <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    DRE
                  </Badge>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Acumulado</p>
                    {(() => {
                      const margem1 = dre1?.[6]?.meses?.reduce((a, b) => a + b, 0) || 0
                      const margem2 = dre2?.[6]?.meses?.reduce((a, b) => a + b, 0) || 0
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {formatCurrency(margem1)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {formatCurrency(margem2)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">% Receita</p>
                    {(() => {
                      const margem1 = dre1?.[6]?.meses?.reduce((a, b) => a + b, 0) || 0
                      const margem2 = dre2?.[6]?.meses?.reduce((a, b) => a + b, 0) || 0
                      const percent1 = totals1.receitaLiquida > 0 ? (margem1 / totals1.receitaLiquida) * 100 : 0
                      const percent2 = totals2.receitaLiquida > 0 ? (margem2 / totals2.receitaLiquida) * 100 : 0
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {percent1.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {percent2.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Variação</p>
                    {(() => {
                      const margem1 = dre1?.[6]?.meses?.reduce((a, b) => a + b, 0) || 0
                      const margem2 = dre2?.[6]?.meses?.reduce((a, b) => a + b, 0) || 0
                      const diff = calculateDifference(margem1, margem2)
                      return (
                        <div className={`flex items-center gap-1 ${getDifferenceColor(diff.absolute)}`}>
                          {getDifferenceIcon(diff.absolute)}
                          <div>
                            <p className="text-lg font-bold">
                              {diff.percentage > 0 ? '+' : ''}{diff.percentage.toFixed(1)}%
                            </p>
                            <p className="text-xs">
                              {formatCurrency(diff.absolute)}
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart 
                    data={getPeriodLabels().map((label, index) => {
                      const margemLine1 = dre1?.[6]
                      const margemLine2 = dre2?.[6]
                      const values1 = aggregateData(margemLine1?.meses || [])
                      const values2 = aggregateData(margemLine2?.meses || [])
                      return {
                        name: label,
                        [year1]: values1[index] || 0,
                        [year2]: values2[index] || 0
                      }
                    })}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const periodoIndex = getPeriodLabels().indexOf(payload[0].payload.name)
                          const receitaLine1 = dre1?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaLine2 = dre2?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaValues1 = aggregateData(receitaLine1?.meses || [])
                          const receitaValues2 = aggregateData(receitaLine2?.meses || [])
                          const receitaPeriodo1 = receitaValues1[periodoIndex] || 0
                          const receitaPeriodo2 = receitaValues2[periodoIndex] || 0
                          
                          const valor1 = Number(payload[0]?.value || 0)
                          const valor2 = Number(payload[1]?.value || 0)
                          const margem1 = receitaPeriodo1 > 0 ? (valor1 / receitaPeriodo1) * 100 : 0
                          const margem2 = receitaPeriodo2 > 0 ? (valor2 / receitaPeriodo2) * 100 : 0
                          
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                              <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.name}</p>
                              <div className="space-y-1">
                                <p className="text-sm">
                                  <span className="text-blue-600 dark:text-blue-400">▪ {year1}: </span>
                                  <span className="font-bold">{formatCurrency(valor1)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem1.toFixed(2)}%)</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-green-600 dark:text-green-400">▪ {year2}: </span>
                                  <span className="font-bold">{formatCurrency(valor2)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem2.toFixed(2)}%)</span>
                                </p>
                                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Diferença: <span className={`font-bold ${getDifferenceColor(valor1 - valor2)}`}>
                                      {formatCurrency(valor1 - valor2)}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                    />
                    <Bar dataKey={String(year1)} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={String(year2)} fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Despesas com Pessoal */}
            <Card className="bg-white dark:bg-slate-900">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                      Despesas com Pessoal
                    </CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Custos com folha de pagamento e encargos
                    </p>
                  </div>
                  <Badge className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                    Despesa
                  </Badge>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Acumulado</p>
                    {(() => {
                      const despesa1 = Math.abs(dre1?.find(line => line.descricao === 'DESPESAS C/ PESSOAL')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const despesa2 = Math.abs(dre2?.find(line => line.descricao === 'DESPESAS C/ PESSOAL')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {formatCurrency(despesa1)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {formatCurrency(despesa2)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">% Receita</p>
                    {(() => {
                      const despesa1 = Math.abs(dre1?.find(line => line.descricao === 'DESPESAS C/ PESSOAL')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const despesa2 = Math.abs(dre2?.find(line => line.descricao === 'DESPESAS C/ PESSOAL')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const percent1 = totals1.receitaLiquida > 0 ? (despesa1 / totals1.receitaLiquida) * 100 : 0
                      const percent2 = totals2.receitaLiquida > 0 ? (despesa2 / totals2.receitaLiquida) * 100 : 0
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {percent1.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {percent2.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Variação</p>
                    {(() => {
                      const despesa1 = Math.abs(dre1?.find(line => line.descricao === 'DESPESAS C/ PESSOAL')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const despesa2 = Math.abs(dre2?.find(line => line.descricao === 'DESPESAS C/ PESSOAL')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const diff = calculateDifference(despesa1, despesa2)
                      return (
                        <div className="flex items-center gap-1 text-slate-900 dark:text-white">
                          {getDifferenceIcon(-diff.absolute)}
                          <div>
                            <p className="text-lg font-bold">
                              {diff.percentage > 0 ? '+' : ''}{diff.percentage.toFixed(1)}%
                            </p>
                            <p className="text-xs">
                              {formatCurrency(Math.abs(diff.absolute))}
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart 
                    data={getPeriodLabels().map((label, index) => {
                      const despesaLine1 = dre1?.find(line => line.descricao === 'DESPESAS C/ PESSOAL')
                      const despesaLine2 = dre2?.find(line => line.descricao === 'DESPESAS C/ PESSOAL')
                      const values1 = aggregateData(despesaLine1?.meses || [])
                      const values2 = aggregateData(despesaLine2?.meses || [])
                      return {
                        name: label,
                        [year1]: Math.abs(values1[index] || 0),
                        [year2]: Math.abs(values2[index] || 0)
                      }
                    })}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const periodoIndex = getPeriodLabels().indexOf(payload[0].payload.name)
                          const receitaLine1 = dre1?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaLine2 = dre2?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaValues1 = aggregateData(receitaLine1?.meses || [])
                          const receitaValues2 = aggregateData(receitaLine2?.meses || [])
                          const receitaPeriodo1 = receitaValues1[periodoIndex] || 0
                          const receitaPeriodo2 = receitaValues2[periodoIndex] || 0
                          
                          const valor1 = Number(payload[0]?.value || 0)
                          const valor2 = Number(payload[1]?.value || 0)
                          const margem1 = receitaPeriodo1 > 0 ? (valor1 / receitaPeriodo1) * 100 : 0
                          const margem2 = receitaPeriodo2 > 0 ? (valor2 / receitaPeriodo2) * 100 : 0
                          
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                              <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.name}</p>
                              <div className="space-y-1">
                                <p className="text-sm">
                                  <span className="text-red-600 dark:text-red-400">▪ {year1}: </span>
                                  <span className="font-bold">{formatCurrency(valor1)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem1.toFixed(2)}%)</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-orange-600 dark:text-orange-400">▪ {year2}: </span>
                                  <span className="font-bold">{formatCurrency(valor2)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem2.toFixed(2)}%)</span>
                                </p>
                                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Diferença: <span className="font-bold">
                                      {formatCurrency(Math.abs(valor1 - valor2))}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                    />
                    <Bar dataKey={String(year1)} fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={String(year2)} fill="#eab308" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Despesas com Serviços de Terceiros */}
            <Card className="bg-white dark:bg-slate-900">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                      Despesas com Serviços de Terceiros
                    </CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Custos com prestadores de serviços externos
                    </p>
                  </div>
                  <Badge className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                    Despesa
                  </Badge>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Acumulado</p>
                    {(() => {
                      const despesa1 = Math.abs(dre1?.find(line => line.descricao === 'DESPESAS C/ SERV. DE TERCEIROS')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const despesa2 = Math.abs(dre2?.find(line => line.descricao === 'DESPESAS C/ SERV. DE TERCEIROS')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {formatCurrency(despesa1)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {formatCurrency(despesa2)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">% Receita</p>
                    {(() => {
                      const despesa1 = Math.abs(dre1?.find(line => line.descricao === 'DESPESAS C/ SERV. DE TERCEIROS')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const despesa2 = Math.abs(dre2?.find(line => line.descricao === 'DESPESAS C/ SERV. DE TERCEIROS')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const percent1 = totals1.receitaLiquida > 0 ? (despesa1 / totals1.receitaLiquida) * 100 : 0
                      const percent2 = totals2.receitaLiquida > 0 ? (despesa2 / totals2.receitaLiquida) * 100 : 0
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {percent1.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {percent2.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Variação</p>
                    {(() => {
                      const despesa1 = Math.abs(dre1?.find(line => line.descricao === 'DESPESAS C/ SERV. DE TERCEIROS')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const despesa2 = Math.abs(dre2?.find(line => line.descricao === 'DESPESAS C/ SERV. DE TERCEIROS')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const diff = calculateDifference(despesa1, despesa2)
                      return (
                        <div className="flex items-center gap-1 text-slate-900 dark:text-white">
                          {getDifferenceIcon(-diff.absolute)}
                          <div>
                            <p className="text-lg font-bold">
                              {diff.percentage > 0 ? '+' : ''}{diff.percentage.toFixed(1)}%
                            </p>
                            <p className="text-xs">
                              {formatCurrency(Math.abs(diff.absolute))}
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart 
                    data={getPeriodLabels().map((label, index) => {
                      const despesaLine1 = dre1?.find(line => line.descricao === 'DESPESAS C/ SERV. DE TERCEIROS')
                      const despesaLine2 = dre2?.find(line => line.descricao === 'DESPESAS C/ SERV. DE TERCEIROS')
                      const values1 = aggregateData(despesaLine1?.meses || [])
                      const values2 = aggregateData(despesaLine2?.meses || [])
                      return {
                        name: label,
                        [year1]: Math.abs(values1[index] || 0),
                        [year2]: Math.abs(values2[index] || 0)
                      }
                    })}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const periodoIndex = getPeriodLabels().indexOf(payload[0].payload.name)
                          const receitaLine1 = dre1?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaLine2 = dre2?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaValues1 = aggregateData(receitaLine1?.meses || [])
                          const receitaValues2 = aggregateData(receitaLine2?.meses || [])
                          const receitaPeriodo1 = receitaValues1[periodoIndex] || 0
                          const receitaPeriodo2 = receitaValues2[periodoIndex] || 0
                          
                          const valor1 = Number(payload[0]?.value || 0)
                          const valor2 = Number(payload[1]?.value || 0)
                          const margem1 = receitaPeriodo1 > 0 ? (valor1 / receitaPeriodo1) * 100 : 0
                          const margem2 = receitaPeriodo2 > 0 ? (valor2 / receitaPeriodo2) * 100 : 0
                          
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                              <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.name}</p>
                              <div className="space-y-1">
                                <p className="text-sm">
                                  <span className="text-red-600 dark:text-red-400">▪ {year1}: </span>
                                  <span className="font-bold">{formatCurrency(valor1)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem1.toFixed(2)}%)</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-orange-600 dark:text-orange-400">▪ {year2}: </span>
                                  <span className="font-bold">{formatCurrency(valor2)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem2.toFixed(2)}%)</span>
                                </p>
                                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Diferença: <span className="font-bold">
                                      {formatCurrency(Math.abs(valor1 - valor2))}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                    />
                    <Bar dataKey={String(year1)} fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={String(year2)} fill="#eab308" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Despesas com Ocupação */}
            <Card className="bg-white dark:bg-slate-900">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                      Despesas com Ocupação
                    </CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Aluguel, IPTU e demais custos de ocupação
                    </p>
                  </div>
                  <Badge className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                    Despesa
                  </Badge>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Acumulado</p>
                    {(() => {
                      const despesa1 = Math.abs(dre1?.[9]?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const despesa2 = Math.abs(dre2?.[9]?.meses?.reduce((a, b) => a + b, 0) || 0)
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {formatCurrency(despesa1)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {formatCurrency(despesa2)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">% Receita</p>
                    {(() => {
                      const despesa1 = Math.abs(dre1?.[9]?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const despesa2 = Math.abs(dre2?.[9]?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const percent1 = totals1.receitaLiquida > 0 ? (despesa1 / totals1.receitaLiquida) * 100 : 0
                      const percent2 = totals2.receitaLiquida > 0 ? (despesa2 / totals2.receitaLiquida) * 100 : 0
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {percent1.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {percent2.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Variação</p>
                    {(() => {
                      const despesa1 = Math.abs(dre1?.[9]?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const despesa2 = Math.abs(dre2?.[9]?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const diff = calculateDifference(despesa1, despesa2)
                      return (
                        <div className="flex items-center gap-1 text-slate-900 dark:text-white">
                          {getDifferenceIcon(-diff.absolute)}
                          <div>
                            <p className="text-lg font-bold">
                              {diff.percentage > 0 ? '+' : ''}{diff.percentage.toFixed(1)}%
                            </p>
                            <p className="text-xs">
                              {formatCurrency(Math.abs(diff.absolute))}
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart 
                    data={getPeriodLabels().map((label, index) => {
                      const despesaLine1 = dre1?.[9]
                      const despesaLine2 = dre2?.[9]
                      const values1 = aggregateData(despesaLine1?.meses || [])
                      const values2 = aggregateData(despesaLine2?.meses || [])
                      return {
                        name: label,
                        [year1]: Math.abs(values1[index] || 0),
                        [year2]: Math.abs(values2[index] || 0)
                      }
                    })}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const periodoIndex = getPeriodLabels().indexOf(payload[0].payload.name)
                          const receitaLine1 = dre1?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaLine2 = dre2?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaValues1 = aggregateData(receitaLine1?.meses || [])
                          const receitaValues2 = aggregateData(receitaLine2?.meses || [])
                          const receitaPeriodo1 = receitaValues1[periodoIndex] || 0
                          const receitaPeriodo2 = receitaValues2[periodoIndex] || 0
                          
                          const valor1 = Number(payload[0]?.value || 0)
                          const valor2 = Number(payload[1]?.value || 0)
                          const margem1 = receitaPeriodo1 > 0 ? (valor1 / receitaPeriodo1) * 100 : 0
                          const margem2 = receitaPeriodo2 > 0 ? (valor2 / receitaPeriodo2) * 100 : 0
                          
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                              <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.name}</p>
                              <div className="space-y-1">
                                <p className="text-sm">
                                  <span className="text-red-600 dark:text-red-400">▪ {year1}: </span>
                                  <span className="font-bold">{formatCurrency(valor1)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem1.toFixed(2)}%)</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-orange-600 dark:text-orange-400">▪ {year2}: </span>
                                  <span className="font-bold">{formatCurrency(valor2)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem2.toFixed(2)}%)</span>
                                </p>
                                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Diferença: <span className="font-bold">
                                      {formatCurrency(Math.abs(valor1 - valor2))}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                    />
                    <Bar dataKey={String(year1)} fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={String(year2)} fill="#eab308" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Despesas com Funcionamento */}
            <Card className="bg-white dark:bg-slate-900">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                      Despesas com Funcionamento
                    </CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Custos operacionais gerais da empresa
                    </p>
                  </div>
                  <Badge className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                    Despesa
                  </Badge>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Acumulado</p>
                    {(() => {
                      const despesa1 = Math.abs(dre1?.find(line => line.descricao === 'DESPESAS C/ FUNCIONAMENTO')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const despesa2 = Math.abs(dre2?.find(line => line.descricao === 'DESPESAS C/ FUNCIONAMENTO')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {formatCurrency(despesa1)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {formatCurrency(despesa2)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">% Receita</p>
                    {(() => {
                      const despesa1 = Math.abs(dre1?.find(line => line.descricao === 'DESPESAS C/ FUNCIONAMENTO')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const despesa2 = Math.abs(dre2?.find(line => line.descricao === 'DESPESAS C/ FUNCIONAMENTO')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const percent1 = totals1.receitaLiquida > 0 ? (despesa1 / totals1.receitaLiquida) * 100 : 0
                      const percent2 = totals2.receitaLiquida > 0 ? (despesa2 / totals2.receitaLiquida) * 100 : 0
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {percent1.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {percent2.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Variação</p>
                    {(() => {
                      const despesa1 = Math.abs(dre1?.find(line => line.descricao === 'DESPESAS C/ FUNCIONAMENTO')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const despesa2 = Math.abs(dre2?.find(line => line.descricao === 'DESPESAS C/ FUNCIONAMENTO')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const diff = calculateDifference(despesa1, despesa2)
                      return (
                        <div className="flex items-center gap-1 text-slate-900 dark:text-white">
                          {getDifferenceIcon(-diff.absolute)}
                          <div>
                            <p className="text-lg font-bold">
                              {diff.percentage > 0 ? '+' : ''}{diff.percentage.toFixed(1)}%
                            </p>
                            <p className="text-xs">
                              {formatCurrency(Math.abs(diff.absolute))}
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart 
                    data={getPeriodLabels().map((label, index) => {
                      const despesaLine1 = dre1?.find(line => line.descricao === 'DESPESAS C/ FUNCIONAMENTO')
                      const despesaLine2 = dre2?.find(line => line.descricao === 'DESPESAS C/ FUNCIONAMENTO')
                      const values1 = aggregateData(despesaLine1?.meses || [])
                      const values2 = aggregateData(despesaLine2?.meses || [])
                      return {
                        name: label,
                        [year1]: Math.abs(values1[index] || 0),
                        [year2]: Math.abs(values2[index] || 0)
                      }
                    })}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const periodoIndex = getPeriodLabels().indexOf(payload[0].payload.name)
                          const receitaLine1 = dre1?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaLine2 = dre2?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaValues1 = aggregateData(receitaLine1?.meses || [])
                          const receitaValues2 = aggregateData(receitaLine2?.meses || [])
                          const receitaPeriodo1 = receitaValues1[periodoIndex] || 0
                          const receitaPeriodo2 = receitaValues2[periodoIndex] || 0
                          
                          const valor1 = Number(payload[0]?.value || 0)
                          const valor2 = Number(payload[1]?.value || 0)
                          const margem1 = receitaPeriodo1 > 0 ? (valor1 / receitaPeriodo1) * 100 : 0
                          const margem2 = receitaPeriodo2 > 0 ? (valor2 / receitaPeriodo2) * 100 : 0
                          
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                              <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.name}</p>
                              <div className="space-y-1">
                                <p className="text-sm">
                                  <span className="text-red-600 dark:text-red-400">▪ {year1}: </span>
                                  <span className="font-bold">{formatCurrency(valor1)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem1.toFixed(2)}%)</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-orange-600 dark:text-orange-400">▪ {year2}: </span>
                                  <span className="font-bold">{formatCurrency(valor2)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem2.toFixed(2)}%)</span>
                                </p>
                                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Diferença: <span className="font-bold">
                                      {formatCurrency(Math.abs(valor1 - valor2))}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                    />
                    <Bar dataKey={String(year1)} fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={String(year2)} fill="#eab308" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Despesas com Vendas */}
            <Card className="bg-white dark:bg-slate-900">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                      Despesas com Vendas
                    </CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Comissões, marketing e custos comerciais
                    </p>
                  </div>
                  <Badge className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                    Despesa
                  </Badge>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Acumulado</p>
                    {(() => {
                      const despesa1 = Math.abs(dre1?.find(line => line.descricao === 'DESPESAS C/ VENDAS')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const despesa2 = Math.abs(dre2?.find(line => line.descricao === 'DESPESAS C/ VENDAS')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {formatCurrency(despesa1)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {formatCurrency(despesa2)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">% Receita</p>
                    {(() => {
                      const despesa1 = Math.abs(dre1?.find(line => line.descricao === 'DESPESAS C/ VENDAS')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const despesa2 = Math.abs(dre2?.find(line => line.descricao === 'DESPESAS C/ VENDAS')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const percent1 = totals1.receitaLiquida > 0 ? (despesa1 / totals1.receitaLiquida) * 100 : 0
                      const percent2 = totals2.receitaLiquida > 0 ? (despesa2 / totals2.receitaLiquida) * 100 : 0
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {percent1.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {percent2.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Variação</p>
                    {(() => {
                      const despesa1 = Math.abs(dre1?.find(line => line.descricao === 'DESPESAS C/ VENDAS')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const despesa2 = Math.abs(dre2?.find(line => line.descricao === 'DESPESAS C/ VENDAS')?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const diff = calculateDifference(despesa1, despesa2)
                      return (
                        <div className="flex items-center gap-1 text-slate-900 dark:text-white">
                          {getDifferenceIcon(-diff.absolute)}
                          <div>
                            <p className="text-lg font-bold">
                              {diff.percentage > 0 ? '+' : ''}{diff.percentage.toFixed(1)}%
                            </p>
                            <p className="text-xs">
                              {formatCurrency(Math.abs(diff.absolute))}
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart 
                    data={getPeriodLabels().map((label, index) => {
                      const despesaLine1 = dre1?.find(line => line.descricao === 'DESPESAS C/ VENDAS')
                      const despesaLine2 = dre2?.find(line => line.descricao === 'DESPESAS C/ VENDAS')
                      const values1 = aggregateData(despesaLine1?.meses || [])
                      const values2 = aggregateData(despesaLine2?.meses || [])
                      return {
                        name: label,
                        [year1]: Math.abs(values1[index] || 0),
                        [year2]: Math.abs(values2[index] || 0)
                      }
                    })}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const periodoIndex = getPeriodLabels().indexOf(payload[0].payload.name)
                          const receitaLine1 = dre1?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaLine2 = dre2?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaValues1 = aggregateData(receitaLine1?.meses || [])
                          const receitaValues2 = aggregateData(receitaLine2?.meses || [])
                          const receitaPeriodo1 = receitaValues1[periodoIndex] || 0
                          const receitaPeriodo2 = receitaValues2[periodoIndex] || 0
                          
                          const valor1 = Number(payload[0]?.value || 0)
                          const valor2 = Number(payload[1]?.value || 0)
                          const margem1 = receitaPeriodo1 > 0 ? (valor1 / receitaPeriodo1) * 100 : 0
                          const margem2 = receitaPeriodo2 > 0 ? (valor2 / receitaPeriodo2) * 100 : 0
                          
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                              <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.name}</p>
                              <div className="space-y-1">
                                <p className="text-sm">
                                  <span className="text-red-600 dark:text-red-400">▪ {year1}: </span>
                                  <span className="font-bold">{formatCurrency(valor1)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem1.toFixed(2)}%)</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-orange-600 dark:text-orange-400">▪ {year2}: </span>
                                  <span className="font-bold">{formatCurrency(valor2)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem2.toFixed(2)}%)</span>
                                </p>
                                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Diferença: <span className="font-bold">
                                      {formatCurrency(Math.abs(valor1 - valor2))}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                    />
                    <Bar dataKey={String(year1)} fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={String(year2)} fill="#eab308" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Amortizações e Depreciações */}
            <Card className="bg-white dark:bg-slate-900">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                      Amortizações e Depreciações
                    </CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Depreciação de ativos e amortização de intangíveis
                    </p>
                  </div>
                  <Badge className="bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    Não Operacional
                  </Badge>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Acumulado</p>
                    {(() => {
                      const valor1 = Math.abs(dre1?.[13]?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const valor2 = Math.abs(dre2?.[13]?.meses?.reduce((a, b) => a + b, 0) || 0)
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-600 dark:text-slate-400">
                            {formatCurrency(valor1)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-600 dark:text-slate-400 mt-2">
                            {formatCurrency(valor2)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Média Mensal</p>
                    {(() => {
                      const valor1 = Math.abs(dre1?.[13]?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const valor2 = Math.abs(dre2?.[13]?.meses?.reduce((a, b) => a + b, 0) || 0)
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {formatCurrency(valor1 / 12)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {formatCurrency(valor2 / 12)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Variação</p>
                    {(() => {
                      const valor1 = Math.abs(dre1?.[13]?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const valor2 = Math.abs(dre2?.[13]?.meses?.reduce((a, b) => a + b, 0) || 0)
                      const diff = calculateDifference(valor1, valor2)
                      return (
                        <div className="flex items-center gap-1 text-slate-900 dark:text-white">
                          {getDifferenceIcon(-diff.absolute)}
                          <div>
                            <p className="text-lg font-bold">
                              {diff.percentage > 0 ? '+' : ''}{diff.percentage.toFixed(1)}%
                            </p>
                            <p className="text-xs">
                              {formatCurrency(Math.abs(diff.absolute))}
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart 
                    data={getPeriodLabels().map((label, index) => {
                      const linha1 = dre1?.[13]
                      const linha2 = dre2?.[13]
                      const values1 = aggregateData(linha1?.meses || [])
                      const values2 = aggregateData(linha2?.meses || [])
                      return {
                        name: label,
                        [year1]: Math.abs(values1[index] || 0),
                        [year2]: Math.abs(values2[index] || 0)
                      }
                    })}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const periodoIndex = getPeriodLabels().indexOf(payload[0].payload.name)
                          const receitaLine1 = dre1?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaLine2 = dre2?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaValues1 = aggregateData(receitaLine1?.meses || [])
                          const receitaValues2 = aggregateData(receitaLine2?.meses || [])
                          const receitaPeriodo1 = receitaValues1[periodoIndex] || 0
                          const receitaPeriodo2 = receitaValues2[periodoIndex] || 0
                          
                          const valor1 = Number(payload[0]?.value || 0)
                          const valor2 = Number(payload[1]?.value || 0)
                          const margem1 = receitaPeriodo1 > 0 ? (valor1 / receitaPeriodo1) * 100 : 0
                          const margem2 = receitaPeriodo2 > 0 ? (valor2 / receitaPeriodo2) * 100 : 0
                          
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                              <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.name}</p>
                              <div className="space-y-1">
                                <p className="text-sm">
                                  <span className="text-slate-600 dark:text-slate-400">▪ {year1}: </span>
                                  <span className="font-bold">{formatCurrency(valor1)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem1.toFixed(2)}%)</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-slate-600 dark:text-slate-400">▪ {year2}: </span>
                                  <span className="font-bold">{formatCurrency(valor2)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem2.toFixed(2)}%)</span>
                                </p>
                                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Diferença: <span className="font-bold">
                                      {formatCurrency(Math.abs(valor1 - valor2))}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                    />
                    <Bar dataKey={String(year1)} fill="#64748b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={String(year2)} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Lucro (Prejuízo) Antes dos Impostos */}
            <Card className="bg-white dark:bg-slate-900">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                      Lucro (Prejuízo) Antes dos Impostos
                    </CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Resultado final antes de impostos e participações
                    </p>
                  </div>
                  <Badge className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    Resultado Final
                  </Badge>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Acumulado</p>
                    {(() => {
                      const lucro1 = dre1?.find(line => line.descricao === 'LUCRO (PREJUIZO) ANTES IMPOSTOS')?.meses?.reduce((a, b) => a + b, 0) || 0
                      const lucro2 = dre2?.find(line => line.descricao === 'LUCRO (PREJUIZO) ANTES IMPOSTOS')?.meses?.reduce((a, b) => a + b, 0) || 0
                      return (
                        <>
                          <p className={`text-lg font-bold ${lucro1 >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatCurrency(lucro1)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className={`text-lg font-bold mt-2 ${lucro2 >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatCurrency(lucro2)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Margem (%)</p>
                    {(() => {
                      const lucro1 = dre1?.find(line => line.descricao === 'LUCRO (PREJUIZO) ANTES IMPOSTOS')?.meses?.reduce((a, b) => a + b, 0) || 0
                      const lucro2 = dre2?.find(line => line.descricao === 'LUCRO (PREJUIZO) ANTES IMPOSTOS')?.meses?.reduce((a, b) => a + b, 0) || 0
                      const margem1 = totals1.receitaLiquida > 0 ? (lucro1 / totals1.receitaLiquida) * 100 : 0
                      const margem2 = totals2.receitaLiquida > 0 ? (lucro2 / totals2.receitaLiquida) * 100 : 0
                      return (
                        <>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {margem1.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year1}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                            {margem2.toFixed(2)}%
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{year2}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Variação</p>
                    {(() => {
                      const lucro1 = dre1?.find(line => line.descricao === 'LUCRO (PREJUIZO) ANTES IMPOSTOS')?.meses?.reduce((a, b) => a + b, 0) || 0
                      const lucro2 = dre2?.find(line => line.descricao === 'LUCRO (PREJUIZO) ANTES IMPOSTOS')?.meses?.reduce((a, b) => a + b, 0) || 0
                      const diff = calculateDifference(lucro1, lucro2)
                      return (
                        <div className={`flex items-center gap-1 ${getDifferenceColor(diff.absolute)}`}>
                          {getDifferenceIcon(diff.absolute)}
                          <div>
                            <p className="text-lg font-bold">
                              {diff.percentage > 0 ? '+' : ''}{diff.percentage.toFixed(1)}%
                            </p>
                            <p className="text-xs">
                              {formatCurrency(diff.absolute)}
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart 
                    data={getPeriodLabels().map((label, index) => {
                      const lucroLine1 = dre1?.find(line => line.descricao === 'LUCRO (PREJUIZO) ANTES IMPOSTOS')
                      const lucroLine2 = dre2?.find(line => line.descricao === 'LUCRO (PREJUIZO) ANTES IMPOSTOS')
                      const values1 = aggregateData(lucroLine1?.meses || [])
                      const values2 = aggregateData(lucroLine2?.meses || [])
                      return {
                        name: label,
                        [year1]: values1[index] || 0,
                        [year2]: values2[index] || 0
                      }
                    })}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const periodoIndex = getPeriodLabels().indexOf(payload[0].payload.name)
                          const receitaLine1 = dre1?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaLine2 = dre2?.find(line => line.descricao === 'RECEITA OPERACIONAL LIQUIDA')
                          const receitaValues1 = aggregateData(receitaLine1?.meses || [])
                          const receitaValues2 = aggregateData(receitaLine2?.meses || [])
                          const receitaPeriodo1 = receitaValues1[periodoIndex] || 0
                          const receitaPeriodo2 = receitaValues2[periodoIndex] || 0
                          
                          const valor1 = Number(payload[0]?.value || 0)
                          const valor2 = Number(payload[1]?.value || 0)
                          const margem1 = receitaPeriodo1 > 0 ? (valor1 / receitaPeriodo1) * 100 : 0
                          const margem2 = receitaPeriodo2 > 0 ? (valor2 / receitaPeriodo2) * 100 : 0
                          
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                              <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.name}</p>
                              <div className="space-y-1">
                                <p className="text-sm">
                                  <span className="text-indigo-600 dark:text-indigo-400">▪ {year1}: </span>
                                  <span className="font-bold">{formatCurrency(valor1)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem1.toFixed(2)}%)</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-purple-600 dark:text-purple-400">▪ {year2}: </span>
                                  <span className="font-bold">{formatCurrency(valor2)}</span>
                                  <span className="text-xs text-slate-500 ml-1">({margem2.toFixed(2)}%)</span>
                                </p>
                                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Diferença: <span className={`font-bold ${getDifferenceColor(valor1 - valor2)}`}>
                                      {formatCurrency(valor1 - valor2)}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                    />
                    <Bar dataKey={String(year1)} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={String(year2)} fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico Resumo Geral */}
          <Card>
            <CardHeader>
              <CardTitle>Comparação Visual - Principais Indicadores</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                            <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.name}</p>
                            <div className="space-y-1">
                              <p className="text-sm">
                                <span className="text-blue-600 dark:text-blue-400">▪ {year1}: </span>
                                <span className="font-bold">{formatNumber(Number(payload[0]?.value || 0))}</span>
                              </p>
                              <p className="text-sm">
                                <span className="text-green-600 dark:text-green-400">▪ {year2}: </span>
                                <span className="font-bold">{formatNumber(Number(payload[1]?.value || 0))}</span>
                              </p>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                  />
                  <Bar dataKey={String(year1)} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={String(year2)} fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Comparação DRE Detalhada */}
          {dre1 && dre2 && dre1.length > 0 && dre2.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Comparação DRE - Demonstrativo de Resultados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-2 font-semibold text-slate-700 dark:text-slate-300">Linha DRE</th>
                        <th className="text-right py-3 px-2 font-semibold text-green-700 dark:text-green-400">Total {year1}</th>
                        <th className="text-right py-3 px-2 font-semibold text-blue-700 dark:text-blue-400">Total {year2}</th>
                        <th className="text-right py-3 px-2 font-semibold text-slate-700 dark:text-slate-300">Diferença</th>
                        <th className="text-right py-3 px-2 font-semibold text-slate-700 dark:text-slate-300">Variação %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dre1.map((line1, index) => {
                        const line2 = dre2[index]
                        if (!line2) return null
                        
                        const total1 = line1.meses?.reduce((a, b) => a + b, 0) || 0
                        const total2 = line2.meses?.reduce((a, b) => a + b, 0) || 0
                        const diff = calculateDifference(total1, total2)
                        
                        const isTotal = line1.isHighlight || line1.isFinal
                        const indent = 0
                        
                        return (
                          <tr 
                            key={index} 
                            className={`
                              border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900
                              ${isTotal ? 'bg-slate-50 dark:bg-slate-900 font-semibold' : ''}
                            `}
                          >
                            <td className="py-2 px-2" style={{ paddingLeft: `${8 + indent * 16}px` }}>
                              {line1.descricao}
                            </td>
                            <td className="text-right py-2 px-2 text-green-700 dark:text-green-400 font-medium">
                              {formatCurrency(total1)}
                            </td>
                            <td className="text-right py-2 px-2 text-blue-700 dark:text-blue-400 font-medium">
                              {formatCurrency(total2)}
                            </td>
                            <td className={`text-right py-2 px-2 font-semibold ${getDifferenceColor(diff.absolute)}`}>
                              <div className="flex items-center justify-end gap-1">
                                {getDifferenceIcon(diff.absolute)}
                                {formatCurrency(diff.absolute)}
                              </div>
                            </td>
                            <td className={`text-right py-2 px-2 font-semibold ${getDifferenceColor(diff.percentage)}`}>
                              {diff.percentage > 0 ? '+' : ''}{diff.percentage.toFixed(1)}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
