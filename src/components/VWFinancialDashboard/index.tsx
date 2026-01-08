import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TrendingDown, Download, Upload, Calendar, BarChart3, TrendingUp, Eye, GitCompare, Trash2 } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer, Legend, LabelList } from "recharts"
import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"

export function VWFinancialDashboard() {
  // Estado para controlar categorias de despesas selecionadas
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['pessoal', 'terceiros', 'ocupacao', 'funcionamento'])
  const [viewMode, setViewMode] = useState<'mensal' | 'bimestral' | 'trimestral' | 'semestral'>('mensal')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Estado para dados DRE
  const [dreData, setDreData] = useState<any[]>([])
  
  // Estados para sistema de projeções
  const [projectionMode, setProjectionMode] = useState(false)
  const [projectionScenarios, setProjectionScenarios] = useState<{id: string, name: string}[]>([])
  const [activeScenario, setActiveScenario] = useState<string | null>(null)
  const [projectionPercentages, setProjectionPercentages] = useState<{[scenarioId: string]: {[lineIndex: number]: number[]}}>({})
  const [projectedData, setProjectedData] = useState<{[scenarioId: string]: any[]}>({})
  const [showComparison, setShowComparison] = useState(false)
  const [showProjectionModal, setShowProjectionModal] = useState(false)

  // Função para agregar dados por período
  const aggregateData = (meses: number[]) => {
    if (viewMode === 'mensal') return meses
    
    const periods: number[] = []
    if (viewMode === 'bimestral') {
      // 6 períodos de 2 meses
      for (let i = 0; i < 12; i += 2) {
        periods.push(meses[i] + meses[i + 1])
      }
    } else if (viewMode === 'trimestral') {
      // 4 períodos de 3 meses
      for (let i = 0; i < 12; i += 3) {
        periods.push(meses[i] + meses[i + 1] + meses[i + 2])
      }
    } else if (viewMode === 'semestral') {
      // 2 períodos de 6 meses
      for (let i = 0; i < 12; i += 6) {
        periods.push(meses[i] + meses[i + 1] + meses[i + 2] + meses[i + 3] + meses[i + 4] + meses[i + 5])
      }
    }
    return periods
  }

  // Função para obter labels de períodos
  const getPeriodLabels = () => {
    if (viewMode === 'mensal') {
      return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    } else if (viewMode === 'bimestral') {
      return ['Jan-Fev', 'Mar-Abr', 'Mai-Jun', 'Jul-Ago', 'Set-Out', 'Nov-Dez']
    } else if (viewMode === 'trimestral') {
      return ['1º Tri', '2º Tri', '3º Tri', '4º Tri']
    } else {
      return ['1º Sem', '2º Sem']
    }
  }

  // Função para baixar template
  const downloadTemplate = () => {
    // Função para formatar valores em moeda brasileira
    const formatCurrency = (value: number) => {
      if (value === 0) return 'R$ 0'
      const formatted = Math.abs(value).toLocaleString('pt-BR')
      return value < 0 ? `-R$ ${formatted}` : `R$ ${formatted}`
    }
    
    // Função para formatar percentual
    const formatPercent = (value: number | null) => {
      if (value === null || value === 0) return '-'
      return `${value.toFixed(2)}%`
    }
    
    // Criar cabeçalho
    const header = [
      'DESCRIÇÃO'.padEnd(50),
      'TOTAL'.padStart(20),
      '%'.padStart(12),
      'JAN'.padStart(18),
      'FEV'.padStart(18),
      'MAR'.padStart(18),
      'ABR'.padStart(18),
      'MAI'.padStart(18),
      'JUN'.padStart(18),
      'JUL'.padStart(18),
      'AGO'.padStart(18),
      'SET'.padStart(18),
      'OUT'.padStart(18),
      'NOV'.padStart(18),
      'DEZ'.padStart(18),
      'HIGHLIGHT'.padStart(10),
      'FINAL'.padStart(10)
    ].join('\t')
    
    // Criar linhas de exemplo
    const lines = dreData.map(item => {
      const mesesFormatted = item.meses.map(m => formatCurrency(m ?? 0).padStart(18))
      return [
        item.descricao.padEnd(50),
        formatCurrency(item.total ?? 0).padStart(20),
        formatPercent(item.percentTotal).padStart(12),
        ...mesesFormatted,
        String(item.isHighlight ?? false).padStart(10),
        String(item.isFinal ?? false).padStart(10)
      ].join('\t')
    })
    
    const content = [
      '# TEMPLATE DRE - FORMATO TABULAR COM MOEDA BRASILEIRA',
      '# Instruções: Cada linha representa um item da DRE',
      '# Os valores devem ser separados por TAB',
      '# Valores monetários devem estar no formato: R$ 1.234.567 ou -R$ 1.234.567',
      '# Percentuais devem estar no formato: 12.34%',
      '# HIGHLIGHT e FINAL devem ser "true" ou "false"',
      '',
      header,
      ...lines
    ].join('\n')
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-dre.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Função para importar dados
  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        
        // Tentar parsear como JSON (formato antigo)
        if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
          const importedData = JSON.parse(content)
          console.log('Dados importados (JSON):', importedData)
          alert('Dados importados com sucesso! (Funcionalidade de atualização em desenvolvimento)')
          return
        }
        
        // Parsear formato tabular TXT
        const lines = content.split('\n').filter(line => 
          line.trim() && !line.trim().startsWith('#')
        )
        
        if (lines.length < 2) {
          throw new Error('Arquivo vazio ou inválido')
        }
        
        // Pular o cabeçalho (primeira linha não comentada)
        const dataLines = lines
        
        const parseCurrency = (value: string): number => {
          if (value === '-' || !value.trim() || value === 'R$ 0') return 0
          
          // Verificar se é negativo
          const isNegative = value.trim().startsWith('-')
          
          // Remover R$, espaços, sinais negativos e pontos de milhares
          const cleaned = value
            .replace(/-/g, '')
            .replace(/R\$/g, '')
            .replace(/\s/g, '')
            .replace(/\./g, '')
            .replace(',', '.')
            .trim()
          
          const num = parseFloat(cleaned) || 0
          return isNegative ? -num : num
        }
        
        const parsePercent = (value: string): number | null => {
          if (value === '-' || !value.trim()) return null
          return parseFloat(value.replace('%', '').replace(',', '.')) || null
        }
        
        const importedData = dataLines.map(line => {
          // Dividir por TAB e remover espaços extras do padding
          const columns = line.split('\t').map(col => col.trim())
          
          return {
            descricao: columns[0]?.trim() || '',
            total: parseCurrency(columns[1] || '0'),
            percentTotal: parsePercent(columns[2] || '-'),
            meses: [
              parseCurrency(columns[3] || '0'),
              parseCurrency(columns[4] || '0'),
              parseCurrency(columns[5] || '0'),
              parseCurrency(columns[6] || '0'),
              parseCurrency(columns[7] || '0'),
              parseCurrency(columns[8] || '0'),
              parseCurrency(columns[9] || '0'),
              parseCurrency(columns[10] || '0'),
              parseCurrency(columns[11] || '0'),
              parseCurrency(columns[12] || '0'),
              parseCurrency(columns[13] || '0'),
              parseCurrency(columns[14] || '0')
            ],
            isHighlight: columns[15]?.trim() === 'true',
            isFinal: columns[16]?.trim() === 'true'
          }
        })
        
        console.log('Dados importados (TXT):', importedData)
        setDreData(importedData)
        alert(`${importedData.length} linhas importadas e atualizadas com sucesso!`)
        
      } catch (error) {
        alert('Erro ao importar dados. Verifique se o arquivo está no formato correto.')
        console.error('Erro ao importar:', error)
      }
    }
    reader.readAsText(file)
    
    // Limpar o input para permitir reimportação do mesmo arquivo
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

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

  // Função para criar novo cenário de projeção
  const createProjectionScenario = () => {
    const newScenarioNumber = projectionScenarios.length + 1
    const newScenario = {
      id: `projection-${Date.now()}`,
      name: `Projeção ${newScenarioNumber}`
    }
    
    setProjectionScenarios(prev => [...prev, newScenario])
    setActiveScenario(newScenario.id)
    setProjectionMode(true)
    
    // Inicializar percentuais zerados para este cenário
    const initialPercentages: {[lineIndex: number]: number[]} = {}
    dreData.forEach((_, index) => {
      initialPercentages[index] = Array(12).fill(0)
    })
    setProjectionPercentages(prev => ({
      ...prev,
      [newScenario.id]: initialPercentages
    }))
    
    // Clonar dados originais como base
    setProjectedData(prev => ({
      ...prev,
      [newScenario.id]: JSON.parse(JSON.stringify(dreData))
    }))
    
    setShowProjectionModal(true)
  }

  // Função para deletar cenário de projeção
  const deleteProjection = () => {
    if (!activeScenario) return
    
    if (!confirm('Tem certeza que deseja deletar esta projeção?')) return
    
    // Remover cenário da lista
    setProjectionScenarios(prev => prev.filter(s => s.id !== activeScenario))
    
    // Remover dados relacionados
    setProjectionPercentages(prev => {
      const updated = { ...prev }
      delete updated[activeScenario]
      return updated
    })
    
    setProjectedData(prev => {
      const updated = { ...prev }
      delete updated[activeScenario]
      return updated
    })
    
    // Limpar do localStorage
    localStorage.removeItem('vw-projection-scenarios')
    localStorage.removeItem('vw-projection-percentages')
    localStorage.removeItem('vw-projected-data')
    localStorage.removeItem('vw-active-scenario')
    
    // Voltar ao modo original
    setProjectionMode(false)
    setActiveScenario(null)
    setShowComparison(false)
    
    alert('Projeção deletada com sucesso!')
  }

  // Função para calcular projeção baseada nos percentuais
  const calculateProjection = () => {
    if (!activeScenario) return
    
    const percentages = projectionPercentages[activeScenario]
    if (!percentages) return
    
    // Clonar dados originais
    const projected = JSON.parse(JSON.stringify(dreData))
    
    // Índices de linhas editáveis (não calculadas)
    const editableIndices = [0, 1, 2, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20]
    
    // Aplicar percentuais às linhas editáveis
    editableIndices.forEach(index => {
      if (percentages[index]) {
        projected[index].meses = dreData[index].meses.map((val: number, monthIdx: number) => {
          const percentage = percentages[index][monthIdx] || 0
          return val * (1 + percentage / 100)
        })
        // Recalcular total
        projected[index].total = projected[index].meses.reduce((acc: number, val: number) => acc + val, 0)
        // Recalcular percentTotal (se aplicável)
        if (projected[1]?.total && projected[1].total !== 0) {
          projected[index].percentTotal = (projected[index].total / projected[1].total) * 100
        }
      }
    })
    
    // Recalcular linhas derivadas (todas as despesas já vêm como valores negativos, então somamos tudo)
    // [3] LUCRO BRUTO = [1] RECEITA + [2] CUSTO (custo já é negativo)
    projected[3].meses = projected[1].meses.map((v: number, i: number) => v + projected[2].meses[i])
    projected[3].total = projected[3].meses.reduce((acc: number, val: number) => acc + val, 0)
    projected[3].percentTotal = projected[1].total !== 0 ? (projected[3].total / projected[1].total) * 100 : 0
    
    // [6] MARGEM DE CONTRIBUIÇÃO = [3] + [4] + [5] (despesas já são negativas)
    projected[6].meses = projected[3].meses.map((v: number, i: number) => 
      v + projected[4].meses[i] + projected[5].meses[i]
    )
    projected[6].total = projected[6].meses.reduce((acc: number, val: number) => acc + val, 0)
    projected[6].percentTotal = projected[1].total !== 0 ? (projected[6].total / projected[1].total) * 100 : 0
    
    // [12] LUCRO OPERACIONAL LÍQUIDO = [6] + [7] + [8] + [9] + [10] + [11] (todas despesas já negativas)
    projected[12].meses = projected[6].meses.map((v: number, i: number) => 
      v + projected[7].meses[i] + projected[8].meses[i] + projected[9].meses[i] + projected[10].meses[i] + projected[11].meses[i]
    )
    projected[12].total = projected[12].meses.reduce((acc: number, val: number) => acc + val, 0)
    projected[12].percentTotal = projected[1].total !== 0 ? (projected[12].total / projected[1].total) * 100 : 0
    
    // [18] LUCRO ANTES DOS IMPOSTOS = [12] + [13] + [14] + [15] + [16] + [17] (despesas já negativas)
    projected[18].meses = projected[12].meses.map((v: number, i: number) => 
      v + projected[13].meses[i] + projected[14].meses[i] + projected[15].meses[i] + projected[16].meses[i] + projected[17].meses[i]
    )
    projected[18].total = projected[18].meses.reduce((acc: number, val: number) => acc + val, 0)
    projected[18].percentTotal = projected[1].total !== 0 ? (projected[18].total / projected[1].total) * 100 : 0
    
    // [21] LUCRO LÍQUIDO = [18] + [19] + [20] (despesas já negativas)
    projected[21].meses = projected[18].meses.map((v: number, i: number) => 
      v + projected[19].meses[i] + projected[20].meses[i]
    )
    projected[21].total = projected[21].meses.reduce((acc: number, val: number) => acc + val, 0)
    projected[21].percentTotal = projected[1].total !== 0 ? (projected[21].total / projected[1].total) * 100 : 0
    
    // Atualizar dados projetados
    setProjectedData(prev => ({
      ...prev,
      [activeScenario]: projected
    }))
    
    alert('Projeção recalculada com sucesso!')
  }

  // Função para obter dados ativos (original ou projetado)
  const getActiveData = () => {
    if (projectionMode && activeScenario && projectedData[activeScenario]) {
      return projectedData[activeScenario]
    }
    return dreData
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

  // Dados iniciais DRE - Demonstrativo de Resultados
  const initialDreData = [
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
      descricao: "DESPESAS C/ VENDAS",
      total: -4122456,
      percentTotal: -4.30,
      meses: [-307898, -328716, -305425, -273361, -317639, -370988, -426223, -441343, -440566, -438685, -471612, 0]
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
      total: 14082051,
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
      descricao: "PARTICIPAÇÕES",
      total: 0,
      percentTotal: 0.00,
      meses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    {
      descricao: "LUCRO LIQUIDO DO EXERCICIO",
      total: 476215,
      percentTotal: 0.50,
      meses: [292222, 264860, 415322, 389575, 392905, 293033, 399105, 525973, 494420, 378461, 236175, 0],
      isHighlight: true,
      isFinal: true
    }
  ]
  
  // Inicializar dreData se estiver vazio
  if (dreData.length === 0) {
    setDreData(initialDreData)
  }

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
  
  // Dados ativos (original ou projetado)
  const activeDreData = getActiveData()

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
  
  // Formatador para tooltips de gráficos (valores em milhares)
  const formatChartValue = (value: number) => {
    if (value === 0) return 'R$ 0'
    const formatted = Math.abs(value).toLocaleString('pt-BR')
    return value < 0 ? `-R$ ${formatted}` : `R$ ${formatted}`
  }
  
  // Formatador para valores absolutos (sem moeda)
  const formatNumber = (value: number) => {
    return value.toLocaleString('pt-BR')
  }
  
  // Inicializar dreData com dados iniciais
  useEffect(() => {
    if (dreData.length === 0) {
      setDreData(initialDreData)
    }
  }, [])
  
  // Persistir cenários no localStorage
  useEffect(() => {
    if (projectionScenarios.length > 0) {
      localStorage.setItem('vw-projection-scenarios', JSON.stringify(projectionScenarios))
      localStorage.setItem('vw-projection-percentages', JSON.stringify(projectionPercentages))
      localStorage.setItem('vw-projected-data', JSON.stringify(projectedData))
      localStorage.setItem('vw-active-scenario', activeScenario || '')
    }
  }, [projectionScenarios, projectionPercentages, projectedData, activeScenario])
  
  // Carregar cenários do localStorage na inicialização
  useEffect(() => {
    const savedScenarios = localStorage.getItem('vw-projection-scenarios')
    const savedPercentages = localStorage.getItem('vw-projection-percentages')
    const savedProjectedData = localStorage.getItem('vw-projected-data')
    const savedActiveScenario = localStorage.getItem('vw-active-scenario')
    
    if (savedScenarios) {
      try {
        setProjectionScenarios(JSON.parse(savedScenarios))
        if (savedPercentages) setProjectionPercentages(JSON.parse(savedPercentages))
        if (savedProjectedData) setProjectedData(JSON.parse(savedProjectedData))
        if (savedActiveScenario && savedActiveScenario !== '') {
          setActiveScenario(savedActiveScenario)
          setProjectionMode(true)
        }
      } catch (e) {
        console.error('Erro ao carregar projeções salvas:', e)
      }
    }
  }, [])
  
  // Verificar se os dados estão carregados
  if (dreData.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">Carregando...</div>
        </div>
      </div>
    )
  }

  // Nomes dos meses para o modal
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  
  // Índices de linhas editáveis (não calculadas)
  const editableLineIndices = [0, 1, 2, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20]

  return (
    <>
      {/* Modal de Edição de Percentuais */}
      <Dialog open={showProjectionModal} onOpenChange={setShowProjectionModal}>
        <DialogContent className="max-w-[99vw] w-[99vw] max-h-[96vh] h-[96vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              DRE PROJEÇÃO - {projectionScenarios.find(s => s.id === activeScenario)?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe os percentuais de variação mês a mês para cada linha da DRE base.
              Exemplo: +10 para aumentar 10%, -5 para reduzir 5%
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="border p-1 text-left sticky left-0 bg-slate-100 dark:bg-slate-800 min-w-[180px] text-[10px] font-semibold">
                      Linha DRE
                    </th>
                    {monthNames.map(month => (
                      <th key={month} className="border p-1 text-center min-w-[60px] text-[10px] font-semibold">
                        {month}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dreData.map((line, lineIndex) => {
                    if (!editableLineIndices.includes(lineIndex)) return null
                    
                    return (
                      <tr key={lineIndex} className={lineIndex % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}>
                        <td className="border p-1 text-[10px] font-medium sticky left-0 bg-inherit">
                          {line.descricao}
                        </td>
                        {monthNames.map((_, monthIndex) => (
                          <td key={monthIndex} className="border p-0.5">
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="0"
                              value={projectionPercentages[activeScenario!]?.[lineIndex]?.[monthIndex] || ''}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0
                                setProjectionPercentages(prev => ({
                                  ...prev,
                                  [activeScenario!]: {
                                    ...prev[activeScenario!],
                                    [lineIndex]: {
                                      ...prev[activeScenario!]?.[lineIndex],
                                      [monthIndex]: value
                                    }
                                  }
                                }))
                              }}
                              className="w-full text-center text-[10px] p-0.5 h-6"
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowProjectionModal(false)}
              >
                Fechar
              </Button>
              <Button
                onClick={() => {
                  calculateProjection()
                  setShowProjectionModal(false)
                }}
                className="gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Recalcular Projeção
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:to-slate-900">{/* Executive Header */}
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
          
          {/* Controles de Projeção e Cenários */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Button
              onClick={createProjectionScenario}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Criar Projeção
            </Button>
            
            {/* Controles de Cenários */}
            {projectionScenarios.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 dark:text-slate-400">Cenários:</span>
                {projectionScenarios.map(scenario => (
                  <Button
                    key={scenario.id}
                    onClick={() => {
                      setActiveScenario(scenario.id)
                      setProjectionMode(true)
                    }}
                    variant={activeScenario === scenario.id ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                  >
                    {scenario.name}
                  </Button>
                ))}
                <Button
                  onClick={() => {
                    setProjectionMode(false)
                    setActiveScenario(null)
                    setShowComparison(false)
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                >
                  Ver Original
                </Button>
              </div>
            )}
            
            {/* Toggle de Visualização (só aparece em modo projeção) */}
            {projectionMode && activeScenario && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowComparison(false)}
                  variant={!showComparison ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Só Projeção
                </Button>
                <Button
                  onClick={() => setShowComparison(true)}
                  variant={showComparison ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                >
                  <GitCompare className="w-4 h-4" />
                  Comparar
                </Button>
                <Button
                  onClick={() => setShowProjectionModal(true)}
                  variant="outline"
                  size="sm"
                >
                  Editar %
                </Button>
                <Button
                  onClick={deleteProjection}
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Deletar
                </Button>
              </div>
            )}
          </div>

          {/* Seleção de Visualização */}
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">Visualização</CardTitle>
              </div>
              <CardDescription className="text-xs">Selecione o período de agregação dos dados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => setViewMode('mensal')}
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                    viewMode === 'mensal'
                      ? 'bg-amber-500 border-amber-500 text-white shadow-lg'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Calendar className="w-6 h-6 mb-2" />
                  <span className="text-sm font-semibold">Mensal</span>
                  <span className="text-xs opacity-80">(Sorana)</span>
                </button>

                <button
                  onClick={() => setViewMode('bimestral')}
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                    viewMode === 'bimestral'
                      ? 'bg-amber-500 border-amber-500 text-white shadow-lg'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <BarChart3 className="w-6 h-6 mb-2" />
                  <span className="text-sm font-semibold">Bimestral</span>
                  <span className="text-xs opacity-80">(Sorana)</span>
                </button>

                <button
                  onClick={() => setViewMode('trimestral')}
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                    viewMode === 'trimestral'
                      ? 'bg-amber-500 border-amber-500 text-white shadow-lg'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <BarChart3 className="w-6 h-6 mb-2" />
                  <span className="text-sm font-semibold">Trimestral</span>
                  <span className="text-xs opacity-80">(Sorana)</span>
                </button>

                <button
                  onClick={() => setViewMode('semestral')}
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                    viewMode === 'semestral'
                      ? 'bg-amber-500 border-amber-500 text-white shadow-lg'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <BarChart3 className="w-6 h-6 mb-2" />
                  <span className="text-sm font-semibold">Semestral</span>
                  <span className="text-xs opacity-80">(Sorana)</span>
                </button>
              </div>
            </CardContent>
          </Card>
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

        {/* Performance Analytics - Charts */}
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Análise de Performance</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Evolução dos principais indicadores operacionais e financeiros</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Volume de Vendas */}
            <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Volume de Vendas</CardTitle>
                    <CardDescription className="text-sm">Unidades comercializadas por período</CardDescription>
                  </div>
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200">2025</Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total Anual</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{activeDreData[0].total.toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Média Mensal</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{Math.round(activeDreData[0].total / 12).toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Maior Volume</p>
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{Math.max(...activeDreData[0].meses).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ChartContainer config={chartConfig} className="w-full">
                  {showComparison && projectionMode ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart 
                        data={(() => {
                          const periodData = aggregateData(projectedData[activeScenario][0].meses);
                          const periodDataOriginal = aggregateData(dreData[0].meses);
                          const labels = getPeriodLabels();
                          return labels.map((mes, idx) => ({
                            mes,
                            original: periodDataOriginal[idx],
                            projecao: periodData[idx]
                          }));
                        })()} 
                        barGap={4}
                        barCategoryGap="20%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => formatNumber(value)} />
                        <ChartTooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                                  <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.mes}</p>
                                  <div className="space-y-1">
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Original: </span>
                                      <span className="font-bold text-blue-600">{formatNumber(payload[0]?.value || 0)} unidades</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Projeção: </span>
                                      <span className="font-bold text-emerald-600">{formatNumber(payload[1]?.value || 0)} unidades</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Variação: </span>
                                      <span className="font-bold text-purple-600">{formatNumber((payload[1]?.value || 0) - (payload[0]?.value || 0))} unidades</span>
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ fontSize: '12px' }} 
                          content={() => (
                            <div className="flex items-center justify-center gap-4 text-xs mt-2">
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                                <span>Original</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></div>
                                <span>Projeção</span>
                              </div>
                            </div>
                          )}
                        />
                        <Bar dataKey="original" fill="#3b82f6" name="Original" maxBarSize={50} />
                        <Bar dataKey="projecao" fill="#10b981" name="Projeção" maxBarSize={50} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={(() => {
                        const periodData = aggregateData(activeDreData[0].meses);
                        const labels = getPeriodLabels();
                        const media = periodData.reduce((a, b) => a + b, 0) / periodData.length;
                        return periodData.map((vol, idx) => ({
                          mes: labels[idx],
                          volume: vol,
                          fill: vol > media * 1.05 ? '#0284c7' : vol < media * 0.95 ? '#b91c1c' : '#ea580c'
                        }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => formatNumber(value)} />
                        <ChartTooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                                  <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.mes}</p>
                                  <div className="space-y-1">
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Volume: </span>
                                      <span className="font-bold text-slate-900 dark:text-white">{formatNumber(payload[0].value || 0)} unidades</span>
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ fontSize: '12px' }} 
                          content={() => (
                            <div className="flex items-center justify-center gap-4 text-xs mt-2">
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#0284c7' }}></div>
                                <span>Acima da Média</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ea580c' }}></div>
                                <span>Média</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#b91c1c' }}></div>
                                <span>Abaixo da Média</span>
                              </div>
                            </div>
                          )}
                        />
                        <Bar dataKey="volume" name="Volume" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Receita de Vendas Líquidas */}
            <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Receita de Vendas Líquidas</CardTitle>
                    <CardDescription className="text-sm">Receita operacional líquida por período</CardDescription>
                  </div>
                  <Badge className="bg-cyan-50 text-cyan-700 border-cyan-200">100% Base</Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total Acumulado</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(activeDreData[1].total / 1000)} mil</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Ticket Médio</p>
                    <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{formatCurrency(activeDreData[1].total / activeDreData[0].total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Média Mensal</p>
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{formatCurrency(activeDreData[1].total / 12 / 1000)} mil</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ChartContainer config={chartConfig} className="w-full">
                  {showComparison && projectionMode ? (
                    // Gráfico de comparação com duas barras
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart 
                        data={(() => {
                          const periodData = aggregateData(projectedData[activeScenario][1].meses);
                          const periodDataOriginal = aggregateData(dreData[1].meses);
                          const labels = getPeriodLabels();
                          return labels.map((mes, idx) => ({
                            mes,
                            original: periodDataOriginal[idx] / 1000,
                            projecao: periodData[idx] / 1000
                          }));
                        })()} 
                        barGap={4}
                        barCategoryGap="20%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis 
                          tick={{ fontSize: 12, fill: '#64748b' }} 
                          axisLine={false} 
                          tickLine={false} 
                          tickFormatter={(value) => formatNumber(value)}
                        />
                        <ChartTooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                                  <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.mes}</p>
                                  <div className="space-y-1">
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Original: </span>
                                      <span className="font-bold text-blue-600">{formatChartValue((payload[0]?.value || 0) * 1000)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Projeção: </span>
                                      <span className="font-bold text-emerald-600">{formatChartValue((payload[1]?.value || 0) * 1000)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Variação: </span>
                                      <span className="font-bold text-purple-600">
                                        {formatChartValue(((payload[1]?.value || 0) - (payload[0]?.value || 0)) * 1000)}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ fontSize: '12px' }} 
                          content={() => (
                            <div className="flex items-center justify-center gap-4 text-xs mt-2">
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                                <span>Original</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></div>
                                <span>Projeção</span>
                              </div>
                            </div>
                          )}
                        />
                        <Bar dataKey="original" fill="#3b82f6" name="Original (mil)" maxBarSize={50} />
                        <Bar dataKey="projecao" fill="#10b981" name="Projeção (mil)" maxBarSize={50} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    // Gráfico normal com uma barra
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={(() => {
                        const periodData = aggregateData(activeDreData[1].meses);
                        const labels = getPeriodLabels();
                        const media = periodData.reduce((a, b) => a + b, 0) / periodData.length;
                        return periodData.map((val, idx) => ({
                          mes: labels[idx],
                          valor: val / 1000,
                          fill: val > media * 1.05 ? '#14b8a6' : val < media * 0.95 ? '#dc2626' : '#f97316'
                        }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis 
                          tick={{ fontSize: 12, fill: '#64748b' }} 
                          axisLine={false} 
                          tickLine={false} 
                          tickFormatter={(value) => formatNumber(value)}
                        />
                        <ChartTooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                                  <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.mes}</p>
                                  <div className="space-y-1">
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Receita Líquida: </span>
                                      <span className="font-bold text-slate-900 dark:text-white">{formatChartValue((payload[0].value || 0) * 1000)}</span>
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ fontSize: '12px' }} 
                          content={() => (
                            <div className="flex items-center justify-center gap-4 text-xs mt-2">
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#06b6d4' }}></div>
                                <span>Acima da Média</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
                                <span>Média</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></div>
                                <span>Abaixo da Média</span>
                              </div>
                            </div>
                          )}
                        />
                        <Bar dataKey="valor" radius={[6, 6, 0, 0]} name="Receita Líquida (mil)" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Lucro Bruto */}
            <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Lucro Bruto</CardTitle>
                    <CardDescription className="text-sm">Resultado bruto das operações</CardDescription>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">{activeDreData[3].percentTotal?.toFixed(2)}% ROL</Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total Acumulado</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(activeDreData[3].total / 1000)} mil</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Margem Bruta</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeDreData[3].percentTotal?.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Por Unidade</p>
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{formatCurrency(activeDreData[3].total / activeDreData[0].total)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ChartContainer config={chartConfig} className="w-full">
                  {showComparison && projectionMode ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={(() => {
                          const periodData = aggregateData(projectedData[activeScenario][3].meses);
                          const periodDataOriginal = aggregateData(dreData[3].meses);
                          const labels = getPeriodLabels();
                          return labels.map((mes, idx) => ({
                            mes,
                            original: periodDataOriginal[idx] / 1000,
                            projecao: periodData[idx] / 1000
                          }));
                        })()} 
                        barGap={4}
                        barCategoryGap="20%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => formatNumber(value)} />
                        <ChartTooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                                  <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.mes}</p>
                                  <div className="space-y-1">
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Original: </span>
                                      <span className="font-bold text-blue-600">{formatChartValue((payload[0]?.value || 0) * 1000)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Projeção: </span>
                                      <span className="font-bold text-emerald-600">{formatChartValue((payload[1]?.value || 0) * 1000)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Variação: </span>
                                      <span className="font-bold text-purple-600">
                                        {formatChartValue(((payload[1]?.value || 0) - (payload[0]?.value || 0)) * 1000)}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ fontSize: '12px' }} 
                          content={() => (
                            <div className="flex items-center justify-center gap-4 text-xs mt-2">
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                                <span>Original</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></div>
                                <span>Projeção</span>
                              </div>
                            </div>
                          )}
                        />
                        <Bar dataKey="original" fill="#3b82f6" name="Original (mil)" maxBarSize={50} />
                        <Bar dataKey="projecao" fill="#10b981" name="Projeção (mil)" maxBarSize={50} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={(() => {
                        const periodDataLucro = aggregateData(activeDreData[3].meses);
                        const periodDataReceita = aggregateData(activeDreData[1].meses);
                        const labels = getPeriodLabels();
                        const media = periodDataLucro.reduce((a, b) => a + b, 0) / periodDataLucro.length;
                        return periodDataLucro.map((val, idx) => ({
                          mes: labels[idx],
                          valor: val / 1000,
                          margem: parseFloat((val / periodDataReceita[idx] * 100).toFixed(1)),
                          fill: val > media * 1.05 ? '#059669' : val < media * 0.95 ? '#991b1b' : '#d97706'
                        }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => formatNumber(value)} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#059669' }} axisLine={false} tickLine={false} domain={[0, 10]} tickFormatter={(value) => `${value}%`} />
                      <ChartTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                                <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.mes}</p>
                                <div className="space-y-1">
                                  <p className="text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Lucro Bruto: </span>
                                    <span className="font-bold text-slate-900 dark:text-white">{formatChartValue((payload[0].value || 0) * 1000)}</span>
                                  </p>
                                  <p className="text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Margem: </span>
                                    <span className="font-bold text-emerald-600">{payload[0].payload.margem}%</span>
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '12px' }} 
                        content={() => (
                          <div className="flex items-center justify-center gap-4 text-xs mt-2">
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#059669' }}></div>
                              <span>Acima da Média</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#d97706' }}></div>
                              <span>Média</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#991b1b' }}></div>
                              <span>Abaixo da Média</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 border-2 border-emerald-600 rounded"></div>
                              <span>Margem %</span>
                            </div>
                          </div>
                        )}
                      />
                      <Bar 
                        yAxisId="left"
                        dataKey="valor" 
                        radius={[6, 6, 0, 0]}
                        name="Lucro Bruto (mil)"
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="margem" 
                        stroke="#059669" 
                        strokeWidth={2}
                        dot={{ fill: "#059669", r: 3 }}
                        name="Margem %"
                      />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Margem de Contribuição */}
            <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Margem de Contribuição</CardTitle>
                    <CardDescription className="text-sm">Contribuição marginal do negócio</CardDescription>
                  </div>
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200">{activeDreData[6].percentTotal?.toFixed(2)}% ROL</Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total Período</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(activeDreData[6].total / 1000)} mil</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">% sobre Receita</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{activeDreData[6].percentTotal?.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Contribuição/Un</p>
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{formatCurrency(activeDreData[6].total / activeDreData[0].total)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ChartContainer config={chartConfig} className="w-full">
                  {showComparison && projectionMode ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart 
                        data={(() => {
                          const periodData = aggregateData(projectedData[activeScenario][6].meses);
                          const periodDataOriginal = aggregateData(dreData[6].meses);
                          const labels = getPeriodLabels();
                          return labels.map((mes, idx) => ({
                            mes,
                            original: periodDataOriginal[idx] / 1000,
                            projecao: periodData[idx] / 1000
                          }));
                        })()} 
                        barGap={4}
                        barCategoryGap="20%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => formatNumber(value)} />
                        <ChartTooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                                  <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.mes}</p>
                                  <div className="space-y-1">
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Original: </span>
                                      <span className="font-bold text-blue-600">{formatChartValue((payload[0]?.value || 0) * 1000)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Projeção: </span>
                                      <span className="font-bold text-emerald-600">{formatChartValue((payload[1]?.value || 0) * 1000)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Variação: </span>
                                      <span className="font-bold text-purple-600">
                                        {formatChartValue(((payload[1]?.value || 0) - (payload[0]?.value || 0)) * 1000)}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ fontSize: '12px' }} 
                          content={() => (
                            <div className="flex items-center justify-center gap-4 text-xs mt-2">
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                                <span>Original</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></div>
                                <span>Projeção</span>
                              </div>
                            </div>
                          )}
                        />
                        <Bar dataKey="original" fill="#3b82f6" name="Original (mil)" maxBarSize={50} />
                        <Bar dataKey="projecao" fill="#10b981" name="Projeção (mil)" maxBarSize={50} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={(() => {
                        const periodDataMargem = aggregateData(activeDreData[6].meses);
                        const periodDataReceita = aggregateData(activeDreData[1].meses);
                        const labels = getPeriodLabels();
                        const media = periodDataMargem.reduce((a, b) => a + b, 0) / periodDataMargem.length;
                        return periodDataMargem.map((val, idx) => ({
                          mes: labels[idx],
                          valor: val / 1000,
                          margem: parseFloat((val / periodDataReceita[idx] * 100).toFixed(1)),
                          fill: val > media * 1.05 ? '#2563eb' : val < media * 0.95 ? '#7f1d1d' : '#c2410c'
                        }));
                      })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => formatNumber(value)} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#2563eb' }} axisLine={false} tickLine={false} domain={[0, 15]} tickFormatter={(value) => `${value}%`} />
                      <ChartTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                                <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.mes}</p>
                                <div className="space-y-1">
                                  <p className="text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Margem Contribuição: </span>
                                    <span className="font-bold text-slate-900 dark:text-white">{formatChartValue((payload[0].value || 0) * 1000)}</span>
                                  </p>
                                  <p className="text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">% sobre Receita: </span>
                                    <span className="font-bold text-blue-600">{payload[0].payload.margem}%</span>
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '12px' }} 
                        content={() => (
                          <div className="flex items-center justify-center gap-4 text-xs mt-2">
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#2563eb' }}></div>
                              <span>Acima da Média</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#c2410c' }}></div>
                              <span>Média</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#7f1d1d' }}></div>
                              <span>Abaixo da Média</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 border-2 border-blue-700 rounded"></div>
                              <span>Margem %</span>
                            </div>
                          </div>
                        )}
                      />
                      <Bar 
                        yAxisId="left"
                        dataKey="valor" 
                        radius={[6, 6, 0, 0]}
                        name="Margem (mil)"
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="margem" 
                        stroke="#1d4ed8" 
                        strokeWidth={2}
                        dot={{ fill: "#1d4ed8", r: 3 }}
                        name="Margem %"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  )}
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Despesas por Categoria */}
            <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Despesas por Categoria</CardTitle>
                    <CardDescription className="text-sm">Composição das despesas operacionais</CardDescription>
                  </div>
                  <Badge className="bg-slate-50 text-slate-700 border-slate-200">{((Math.abs(activeDreData[7].total + activeDreData[8].total + activeDreData[9].total + activeDreData[10].total + activeDreData[11].total) / activeDreData[1].total) * 100).toFixed(2)}% ROL</Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total de Despesas</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(Math.abs(activeDreData[7].total + activeDreData[8].total + activeDreData[9].total + activeDreData[10].total + activeDreData[11].total) / 1000)} mil</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">% sobre Receita</p>
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{((Math.abs(activeDreData[7].total + activeDreData[8].total + activeDreData[9].total + activeDreData[10].total + activeDreData[11].total) / activeDreData[1].total) * 100).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Média Mensal</p>
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{formatCurrency(Math.abs(activeDreData[7].total + activeDreData[8].total + activeDreData[9].total + activeDreData[10].total + activeDreData[11].total) / 12 / 1000)} mil</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="mb-4">
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Categorias de Despesa:</p>
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
                
                <ChartContainer config={chartConfig} className="w-full">
                  {showComparison && projectionMode ? (
                    // Gráfico de comparação entre original e projeção
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={(() => {
                        // Dados originais
                        const aggregatedPessoalOrig = aggregateData(dreData[7].meses.map(v => Math.abs(v)));
                        const aggregatedTerceirosOrig = aggregateData(dreData[8].meses.map(v => Math.abs(v)));
                        const aggregatedOcupacaoOrig = aggregateData(dreData[9].meses.map(v => Math.abs(v)));
                        const aggregatedFuncionamentoOrig = aggregateData(dreData[10].meses.map(v => Math.abs(v)));
                        const aggregatedVendasOrig = aggregateData(dreData[11].meses.map(v => Math.abs(v)));
                        
                        // Dados projetados
                        const aggregatedPessoalProj = aggregateData(projectedData[activeScenario][7].meses.map(v => Math.abs(v)));
                        const aggregatedTerceirosProj = aggregateData(projectedData[activeScenario][8].meses.map(v => Math.abs(v)));
                        const aggregatedOcupacaoProj = aggregateData(projectedData[activeScenario][9].meses.map(v => Math.abs(v)));
                        const aggregatedFuncionamentoProj = aggregateData(projectedData[activeScenario][10].meses.map(v => Math.abs(v)));
                        const aggregatedVendasProj = aggregateData(projectedData[activeScenario][11].meses.map(v => Math.abs(v)));
                        
                        const periodLabels = getPeriodLabels();
                        
                        return aggregatedPessoalOrig.map((_, idx) => ({
                          mes: periodLabels[idx],
                          original: aggregatedPessoalOrig[idx] + aggregatedTerceirosOrig[idx] + aggregatedOcupacaoOrig[idx] + aggregatedFuncionamentoOrig[idx] + aggregatedVendasOrig[idx],
                          projecao: aggregatedPessoalProj[idx] + aggregatedTerceirosProj[idx] + aggregatedOcupacaoProj[idx] + aggregatedFuncionamentoProj[idx] + aggregatedVendasProj[idx]
                        }));
                      })()} 
                      barGap={4}
                      barCategoryGap="20%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => formatNumber(value)} />
                        <ChartTooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                                  <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.mes}</p>
                                  <div className="space-y-1">
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Original: </span>
                                      <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(payload[0].value || 0)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Projeção: </span>
                                      <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(payload[1]?.value || 0)}</span>
                                    </p>
                                    <p className="text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                                      <span className="text-slate-600 dark:text-slate-400">Diferença: </span>
                                      <span className={`font-bold ${((payload[1]?.value || 0) - (payload[0].value || 0)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {formatCurrency(Math.abs((payload[1]?.value || 0) - (payload[0].value || 0)))}
                                        {((payload[1]?.value || 0) - (payload[0].value || 0)) > 0 ? ' ↑' : ' ↓'}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="original" fill="#64748b" name="Original" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="projecao" fill="#0ea5e9" name="Projeção" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={(() => {
                      const aggregatedPessoal = aggregateData(activeDreData[7].meses.map(v => Math.abs(v)));
                      const aggregatedTerceiros = aggregateData(activeDreData[8].meses.map(v => Math.abs(v)));
                      const aggregatedOcupacao = aggregateData(activeDreData[9].meses.map(v => Math.abs(v)));
                      const aggregatedFuncionamento = aggregateData(activeDreData[10].meses.map(v => Math.abs(v)));
                      const aggregatedVendas = aggregateData(activeDreData[11].meses.map(v => Math.abs(v)));
                      const aggregatedReceita = aggregateData(activeDreData[1].meses);
                      const periodLabels = getPeriodLabels();
                      
                      return aggregatedPessoal.map((_, idx) => ({
                        mes: periodLabels[idx],
                        pessoal: aggregatedPessoal[idx] / 1000,
                        terceiros: aggregatedTerceiros[idx] / 1000,
                        ocupacao: aggregatedOcupacao[idx] / 1000,
                        funcionamento: aggregatedFuncionamento[idx] / 1000,
                        vendas: aggregatedVendas[idx] / 1000,
                        total: (aggregatedPessoal[idx] + aggregatedTerceiros[idx] + aggregatedOcupacao[idx] + aggregatedFuncionamento[idx] + aggregatedVendas[idx]) / 1000,
                        totalPct: (((aggregatedPessoal[idx] + aggregatedTerceiros[idx] + aggregatedOcupacao[idx] + aggregatedFuncionamento[idx] + aggregatedVendas[idx]) / aggregatedReceita[idx]) * 100).toFixed(1),
                        pessoalPct: ((aggregatedPessoal[idx] / aggregatedReceita[idx]) * 100).toFixed(2),
                        terceirosPct: ((aggregatedTerceiros[idx] / aggregatedReceita[idx]) * 100).toFixed(2),
                        ocupacaoPct: ((aggregatedOcupacao[idx] / aggregatedReceita[idx]) * 100).toFixed(2),
                        funcionamentoPct: ((aggregatedFuncionamento[idx] / aggregatedReceita[idx]) * 100).toFixed(2),
                        vendasPct: ((aggregatedVendas[idx] / aggregatedReceita[idx]) * 100).toFixed(2)
                      }));
                    })()} barCategoryGap="15%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => formatNumber(value)} />
                      <ChartTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                                <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.mes}</p>
                                <div className="space-y-1 mb-3">
                                  {payload.map((entry: any) => (
                                    <div key={entry.name} className="flex items-center justify-between gap-4">
                                      <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }}></div>
                                        <span className="text-xs text-slate-600 dark:text-slate-400">{entry.name}:</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                                          {formatChartValue(entry.value * 1000)}
                                        </span>
                                        <span className="text-xs text-slate-600 dark:text-slate-400 ml-2">
                                          ({entry.name === 'Pessoal' ? payload[0].payload.pessoalPct :
                                            entry.name === 'Terceiros' ? payload[0].payload.terceirosPct :
                                            entry.name === 'Ocupação' ? payload[0].payload.ocupacaoPct :
                                            entry.name === 'Funcionamento' ? payload[0].payload.funcionamentoPct :
                                            payload[0].payload.vendasPct}%)
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total:</span>
                                    <div className="text-right">
                                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                                        {formatChartValue(payload[0].payload.total * 1000)}
                                      </span>
                                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 ml-2">
                                        ({payload[0].payload.totalPct}%)
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      {selectedCategories.includes('pessoal') && (
                        <Bar dataKey="pessoal" stackId="a" fill="#001E50" name="Pessoal" maxBarSize={45} />
                      )}
                      {selectedCategories.includes('terceiros') && (
                        <Bar dataKey="terceiros" stackId="a" fill="#0089EF" name="Terceiros" maxBarSize={45} />
                      )}
                      {selectedCategories.includes('ocupacao') && (
                        <Bar dataKey="ocupacao" stackId="a" fill="#F59E0B" name="Ocupação" maxBarSize={45} />
                      )}
                      {selectedCategories.includes('funcionamento') && (
                        <Bar dataKey="funcionamento" stackId="a" fill="#EF4444" name="Funcionamento" maxBarSize={45} />
                      )}
                      {selectedCategories.includes('vendas') && (
                        <Bar dataKey="vendas" stackId="a" fill="#8B5CF6" name="Vendas" maxBarSize={45} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                  )}
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Resultado Operacional - Destaque */}
        <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Lucro (Prejuízo) Antes dos Impostos</CardTitle>
                <CardDescription className="text-sm">Resultado operacional antes da tributação</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-50 text-purple-700 text-xs">{activeDreData[18].percentTotal?.toFixed(2)}% ROL</Badge>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6 mt-4">
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total do Período</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(activeDreData[18].total / 1000)} mil</p>
              </div>
              
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Margem Líquida</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{activeDreData[18].percentTotal?.toFixed(2)}%</p>
              </div>
              
              
              
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Média Mensal</p>
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{formatCurrency(activeDreData[18].total / 12 / 1000)} mil</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              {showComparison && projectionMode ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={(() => {
                      const periodData = aggregateData(projectedData[activeScenario][18].meses);
                      const periodDataOriginal = aggregateData(dreData[18].meses);
                      const labels = getPeriodLabels();
                      return labels.map((mes, idx) => ({
                        mes,
                        original: periodDataOriginal[idx] / 1000,
                        projecao: periodData[idx] / 1000
                      }));
                    })()} 
                    barGap={4}
                    barCategoryGap="20%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                              <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.mes}</p>
                              <div className="space-y-1">
                                <p className="text-sm">
                                  <span className="text-slate-600 dark:text-slate-400">Original: </span>
                                  <span className="font-bold text-blue-600">R$ {Number(payload[0]?.value || 0).toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})} mil</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-slate-600 dark:text-slate-400">Projeção: </span>
                                  <span className="font-bold text-emerald-600">R$ {Number(payload[1]?.value || 0).toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})} mil</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-slate-600 dark:text-slate-400">Variação: </span>
                                  <span className="font-bold text-purple-600">
                                    R$ {Number((payload[1]?.value || 0) - (payload[0]?.value || 0)).toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})} mil
                                  </span>
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '12px' }} 
                      content={() => (
                        <div className="flex items-center justify-center gap-4 text-xs mt-2">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                            <span>Original</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></div>
                            <span>Projeção</span>
                          </div>
                        </div>
                      )}
                    />
                    <Bar dataKey="original" fill="#3b82f6" name="Original (mil)" maxBarSize={50} />
                    <Bar dataKey="projecao" fill="#10b981" name="Projeção (mil)" maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(() => {
                  const periodDataLucro = aggregateData(activeDreData[18].meses);
                  const periodDataReceita = aggregateData(activeDreData[1].meses);
                  const labels = getPeriodLabels();
                  const media = periodDataLucro.reduce((a, b) => a + b, 0) / periodDataLucro.length;
                  return periodDataLucro.map((val, idx) => ({
                    mes: labels[idx],
                    valor: val / 1000,
                    percentual: ((val / periodDataReceita[idx]) * 100).toFixed(2),
                    fill: val > media * 1.05 ? '#0ea5e9' : val < media * 0.95 ? '#f97316' : '#10b981'
                  }));
                })()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis 
                    dataKey="mes" 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                    axisLine={false} 
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                    axisLine={false} 
                    tickLine={false}
                  />
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                            <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.mes}</p>
                            <div className="space-y-1">
                              <p className="text-sm">
                                <span className="text-slate-600 dark:text-slate-400">Lucro Antes dos Impostos: </span>
                                <span className="font-bold text-slate-900 dark:text-white">R$ {Number(payload[0].value).toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})} mil</span>
                              </p>
                              <p className="text-sm">
                                <span className="text-slate-600 dark:text-slate-400">% sobre Receita: </span>
                                <span className="font-bold text-purple-600">{payload[0].payload.percentual}%</span>
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px' }} 
                    content={() => (
                      <div className="flex items-center justify-center gap-4 text-xs mt-2">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#0ea5e9' }}></div>
                          <span>Acima da Média</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></div>
                          <span>Média</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f97316' }}></div>
                          <span>Abaixo da Média</span>
                        </div>
                      </div>
                    )}
                  />
                  <Bar 
                    dataKey="valor" 
                    radius={[6, 6, 0, 0]}
                    name="Lucro Líquido (mil)"
                  >
                    <LabelList 
                      dataKey="percentual" 
                      position="top" 
                      formatter={(value: number) => `${value}%`}
                      style={{ fontSize: '11px', fontWeight: '600', fill: '#64748b' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              )}
            </ChartContainer>
          </CardContent>
        </Card>

        {/* DRE - Demonstrativo de Resultados do Exercício */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Demonstrativo de Resultados (DRE)</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Relatório detalhado de desempenho mensal - Ano Fiscal 2025</p>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Importar Dados
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Baixar Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDreData(initialDreData)
                  alert('Dados revertidos para o estado inicial!')
                }}
                className="gap-2 text-orange-600 hover:text-orange-700 hover:border-orange-300"
              >
                <TrendingDown className="w-4 h-4" />
                Reverter Dados
              </Button>
            </div>
          </div>

          <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-800 dark:bg-slate-950 border border-slate-700">
                      <th className="text-left px-2 py-2 font-semibold text-white sticky left-0 bg-slate-800 dark:bg-slate-950 z-10 min-w-[220px] text-[10px] uppercase tracking-wider border-r border-slate-700">Descrição</th>
                      <th className="text-right px-2 py-2 font-semibold text-white min-w-[90px] text-[10px] uppercase tracking-wider border-r border-slate-700">Total</th>
                      <th className="text-right px-2 py-2 font-semibold text-white min-w-[50px] text-[10px] uppercase tracking-wider border-r border-slate-700">%</th>
                      <th className="text-right px-2 py-2 font-semibold text-white min-w-[80px] text-[10px] uppercase tracking-wider border-r border-slate-700">Jan</th>
                      <th className="text-right px-2 py-2 font-semibold text-white min-w-[80px] text-[10px] uppercase tracking-wider border-r border-slate-700">Fev</th>
                      <th className="text-right px-2 py-2 font-semibold text-white min-w-[80px] text-[10px] uppercase tracking-wider border-r border-slate-700">Mar</th>
                      <th className="text-right px-2 py-2 font-semibold text-white min-w-[80px] text-[10px] uppercase tracking-wider border-r border-slate-700">Abr</th>
                      <th className="text-right px-2 py-2 font-semibold text-white min-w-[80px] text-[10px] uppercase tracking-wider border-r border-slate-700">Mai</th>
                      <th className="text-right px-2 py-2 font-semibold text-white min-w-[80px] text-[10px] uppercase tracking-wider border-r border-slate-700">Jun</th>
                      <th className="text-right px-2 py-2 font-semibold text-white min-w-[80px] text-[10px] uppercase tracking-wider border-r border-slate-700">Jul</th>
                      <th className="text-right px-2 py-2 font-semibold text-white min-w-[80px] text-[10px] uppercase tracking-wider border-r border-slate-700">Ago</th>
                      <th className="text-right px-2 py-2 font-semibold text-white min-w-[80px] text-[10px] uppercase tracking-wider border-r border-slate-700">Set</th>
                      <th className="text-right px-2 py-2 font-semibold text-white min-w-[80px] text-[10px] uppercase tracking-wider border-r border-slate-700">Out</th>
                      <th className="text-right px-2 py-2 font-semibold text-white min-w-[80px] text-[10px] uppercase tracking-wider border-r border-slate-700">Nov</th>
                      <th className="text-right px-2 py-2 font-semibold text-white min-w-[80px] text-[10px] uppercase tracking-wider">Dez</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDreData.map((item, index) => (
                      <tr 
                        key={index}
                        className={`
                          ${item.isHighlight && !item.isFinal ? 'bg-blue-50 dark:bg-blue-950/30 font-semibold' : ''}
                          ${item.isFinal ? 'bg-purple-100 dark:from-purple-950/40 font-bold' : ''}
                          ${!item.isHighlight && !item.isFinal ? 'hover:bg-slate-50 dark:hover:bg-slate-800/30' : ''}
                          border-b border-slate-300 dark:border-slate-700
                        `}
                      >
                        <td className={`px-2 py-1.5 sticky left-0 bg-inherit z-10 border-r border-slate-200 dark:border-slate-700 ${item.isFinal ? 'text-purple-900 dark:text-purple-200 text-[11px] font-bold' : item.isHighlight ? 'text-blue-900 dark:text-blue-200 text-[10px] font-semibold' : 'text-slate-700 dark:text-slate-300 text-[10px]'}`}>
                          {item.descricao}
                        </td>
                        <td className={`px-2 py-1.5 text-right border-r border-slate-200 dark:border-slate-700 ${item.total < 0 ? 'text-red-600 dark:text-red-400 text-[10px] font-medium' : item.isFinal ? 'text-purple-900 dark:text-purple-200 text-[10px] font-bold' : item.isHighlight ? 'text-blue-900 dark:text-blue-200 text-[10px] font-semibold' : 'text-slate-900 dark:text-white text-[10px]'}`}>
                          {index === 0 ? item.total.toLocaleString('pt-BR') : formatCurrency(item.total)}
                        </td>
                        <td className={`px-2 py-1.5 text-right border-r border-slate-200 dark:border-slate-700 ${item.isFinal ? 'text-purple-700 dark:text-purple-300 text-[10px] font-bold' : 'text-slate-600 dark:text-slate-400 text-[10px]'}`}>
                          {item.percentTotal !== undefined && item.percentTotal !== null ? `${item.percentTotal.toFixed(2)}%` : '-'}
                        </td>
                        {item.meses.map((valor, mesIdx) => (
                          <td 
                            key={mesIdx}
                            className={`px-2 py-1.5 text-right border-r border-slate-200 dark:border-slate-700 last:border-r-0 ${valor < 0 ? 'text-red-600 dark:text-red-400 text-[10px]' : item.isFinal ? 'text-purple-900 dark:text-purple-200 text-[10px] font-bold' : item.isHighlight ? 'text-blue-900 dark:text-blue-200 text-[10px] font-semibold' : 'text-slate-900 dark:text-white text-[10px]'} ${valor === 0 && index !== 0 ? 'text-slate-400 dark:text-slate-600' : ''}`}
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
      </div>
    </div>
    </>
  )
}
