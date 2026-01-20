import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TrendingDown, Download, Upload, Calendar, BarChart3, TrendingUp, Eye, GitCompare, Trash2 } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis, Legend, LabelList, ComposedChart, Cell } from "recharts"
import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { DetailedMetricsTable } from "@/components/DetailedMetricsTable"
import { businessMetricsData } from "@/data/businessMetricsData"

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
  
  // Estado para controlar exibição da tabela de métricas detalhadas
  const [showDetailedMetrics, setShowDetailedMetrics] = useState(false)
  
  // Estado para controlar exibição do card de % de Trocas
  const [showTrocasChart, setShowTrocasChart] = useState(false)
  
  // Estado para controlar exibição do card de % de Repasse
  const [showRepasseChart, setShowRepasseChart] = useState(false)
  
  // Estado para controlar exibição do card de Estoque de Novos
  const [showEstoqueNovos, setShowEstoqueNovos] = useState(false)
  
  // Estado para controlar exibição do card de Estoque de Usados
  const [showEstoqueUsados, setShowEstoqueUsados] = useState(false)
  
  // Estado para controlar exibição do card de Estoque de Peças
  const [showEstoquePecas, setShowEstoquePecas] = useState(false)
  
  // Estado para controlar exibição do card de Venda de Peças
  const [showVendaPecas, setShowVendaPecas] = useState(false)

  // Estado para controlar exibição do card de Vendas por Seguradora
  const [showVendasSeguradora, setShowVendasSeguradora] = useState(false)

  // Estado para controlar exibição do card de Vendas Mercado Livre
  const [showVendasMercadoLivre, setShowVendasMercadoLivre] = useState(false)

  // Estado para controlar exibição do card de Despesas Financeiras Novos
  const [showDespesasFinanceirasNovos, setShowDespesasFinanceirasNovos] = useState(false)

  // Estado para controlar exibição do card de Despesas Financeiras Usados
  const [showDespesasFinanceirasUsados, setShowDespesasFinanceirasUsados] = useState(false)

  // Estado para controlar exibição do card de Despesas Financeiras Peças
  const [showDespesasFinanceirasPecas, setShowDespesasFinanceirasPecas] = useState(false)

  // Estado para controlar exibição do card de Despesas Financeiras Oficina
  const [showDespesasFinanceirasOficina, setShowDespesasFinanceirasOficina] = useState(false)

  // Estado para controlar exibição do card de Despesas Financeiras Funilaria
  const [showDespesasFinanceirasFunilaria, setShowDespesasFinanceirasFunilaria] = useState(false)

  // Estado para controlar exibição do card de Despesas Financeiras Administração
  const [showDespesasFinanceirasAdministracao, setShowDespesasFinanceirasAdministracao] = useState(false)

  // Estado para controlar exibição do card de Bonus Novos
  const [showBonusNovos, setShowBonusNovos] = useState(false)

  // Estado para controlar exibição do card de Bonus Usados
  const [showBonusUsados, setShowBonusUsados] = useState(false)

  // Estado para controlar exibição do card de Bonus Peças
  const [showBonusPecas, setShowBonusPecas] = useState(false)

  // Estado para controlar exibição do card de Bonus Oficina
  const [showBonusOficina, setShowBonusOficina] = useState(false)

  // Estado para controlar exibição do card de Bonus Funilaria
  const [showBonusFunilaria, setShowBonusFunilaria] = useState(false)

  // Estado para controlar exibição do card de Bonus Administração
  const [showBonusAdministracao, setShowBonusAdministracao] = useState(false)

  // Estado para controlar exibição do card de Receita de Financiamento Novos
  const [showReceitaFinanciamentoNovos, setShowReceitaFinanciamentoNovos] = useState(false)

  // Estado para controlar exibição do card de Receita de Financiamento Usados
  const [showReceitaFinanciamentoUsados, setShowReceitaFinanciamentoUsados] = useState(false)

  // Estado para controlar exibição do card de Crédito ICMS Novos
  const [showCreditoICMSNovos, setShowCreditoICMSNovos] = useState(false)

  // Estado para controlar exibição do card de Crédito ICMS Peças
  const [showCreditoICMSPecas, setShowCreditoICMSPecas] = useState(false)

  // Estado para controlar exibição do card de Crédito ICMS Administração
  const [showCreditoICMSAdministracao, setShowCreditoICMSAdministracao] = useState(false)

  // Estado para controlar exibição do card de Crédito PIS e Cofins Administração
  const [showCreditoPISCofinsAdministracao, setShowCreditoPISCofinsAdministracao] = useState(false)

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
    if (projectionMode && activeScenario && projectedData[activeScenario!]) {
      return projectedData[activeScenario!]
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
                  onClick={() => {
                    setViewMode('mensal')
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                  }}
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
                  onClick={() => {
                    setViewMode('bimestral')
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                  }}
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
                  onClick={() => {
                    setViewMode('trimestral')
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                  }}
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
                  onClick={() => {
                    setViewMode('semestral')
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                  }}
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

          {/* Dados Adicionais */}
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">Dados Adicionais</CardTitle>
              </div>
              <CardDescription className="text-xs">Configurações e filtros complementares</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    setShowDetailedMetrics(!showDetailedMetrics)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowDespesasFinanceirasNovos(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showDetailedMetrics 
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700`}
                >
                  <BarChart3 className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Tabela de Dados</span>
                  <span className="text-[10px] opacity-80">Métricas Completas</span>
                </button>

                <button
                  onClick={() => {
                    setShowTrocasChart(!showTrocasChart)
                    setShowDetailedMetrics(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowDespesasFinanceirasNovos(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showTrocasChart 
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Volume de Troca</span>
                  <span className="text-[10px] opacity-80">Análise de Conversão</span>
                </button>

                <button
                  onClick={() => {
                    setShowRepasseChart(!showRepasseChart)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowDespesasFinanceirasNovos(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showRepasseChart 
                      ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-400 dark:border-rose-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-slate-700`}
                >
                  <GitCompare className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">% de Repasse</span>
                  <span className="text-[10px] opacity-80">Vendas de Repasse</span>
                </button>

                <button
                  onClick={() => {
                    setShowEstoqueNovos(!showEstoqueNovos)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowDespesasFinanceirasNovos(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showEstoqueNovos 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700`}
                >
                  <BarChart3 className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Estoque de Novos</span>
                  <span className="text-[10px] opacity-80">Evolução do Estoque</span>
                </button>

                <button
                  onClick={() => {
                    setShowEstoqueUsados(!showEstoqueUsados)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowDespesasFinanceirasNovos(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showEstoqueUsados 
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-400 dark:border-purple-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-slate-700`}
                >
                  <BarChart3 className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Estoque de Usados</span>
                  <span className="text-[10px] opacity-80">Evolução do Estoque</span>
                </button>

                <button
                  onClick={() => {
                    setShowEstoquePecas(!showEstoquePecas)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowDespesasFinanceirasNovos(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showEstoquePecas 
                      ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-400 dark:border-teal-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-slate-700`}
                >
                  <BarChart3 className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Estoque de Peças</span>
                  <span className="text-[10px] opacity-80">Evolução do Estoque</span>
                </button>

                <button
                  onClick={() => {
                    setShowVendaPecas(!showVendaPecas)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendasSeguradora(false)
                    setShowDespesasFinanceirasNovos(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showVendaPecas 
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400 dark:border-indigo-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Venda de Peças</span>
                  <span className="text-[10px] opacity-80">Por Departamento</span>
                </button>

                <button
                  onClick={() => {
                    setShowVendasSeguradora(!showVendasSeguradora)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showVendasSeguradora 
                      ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-400 dark:border-cyan-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-cyan-300 hover:bg-cyan-50 dark:hover:bg-slate-700`}
                >
                  <BarChart3 className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Vendas por Seguradora</span>
                  <span className="text-[10px] opacity-80">Performance Seguradoras</span>
                </button>
                
                {/* Botão para Vendas Mercado Livre */}
                <button
                  onClick={() => {
                    setShowVendasMercadoLivre(!showVendasMercadoLivre)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowVendasSeguradora(false)
                    setShowDespesasFinanceirasNovos(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showVendasMercadoLivre 
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400 dark:border-orange-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-slate-700`}
                >
                  <BarChart3 className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Vendas Mercado Livre</span>
                  <span className="text-[10px] opacity-80">Performance Marketplace</span>
                </button>

                <button
                  onClick={() => {
                    setShowDespesasFinanceirasNovos(!showDespesasFinanceirasNovos)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasUsados(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showDespesasFinanceirasNovos 
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-red-300 hover:bg-red-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Despesas Financeiras Novos</span>
                  <span className="text-[10px] opacity-80">Juros e Despesas</span>
                </button>

                <button
                  onClick={() => {
                    setShowDespesasFinanceirasUsados(!showDespesasFinanceirasUsados)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasPecas(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showDespesasFinanceirasUsados 
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-400 dark:border-purple-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Despesas Financeiras Usados</span>
                  <span className="text-[10px] opacity-80">Juros e Despesas</span>
                </button>

                <button
                  onClick={() => {
                    setShowDespesasFinanceirasPecas(!showDespesasFinanceirasPecas)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasOficina(false)
                    setShowDespesasFinanceirasFunilaria(false)
                    setShowDespesasFinanceirasAdministracao(false)
                    setShowBonusNovos(false)
                    setShowBonusUsados(false)
                    setShowBonusPecas(false)
                    setShowBonusOficina(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showDespesasFinanceirasPecas 
                      ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-400 dark:border-teal-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Despesas Financeiras Peças</span>
                  <span className="text-[10px] opacity-80">Juros e Despesas</span>
                </button>

                <button
                  onClick={() => {
                    setShowDespesasFinanceirasOficina(!showDespesasFinanceirasOficina)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasPecas(false)
                    setShowDespesasFinanceirasFunilaria(false)
                    setShowDespesasFinanceirasAdministracao(false)
                    setShowBonusNovos(false)
                    setShowBonusUsados(false)
                    setShowBonusPecas(false)
                    setShowBonusOficina(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showDespesasFinanceirasOficina 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Despesas Financeiras Oficina</span>
                  <span className="text-[10px] opacity-80">Cartão de Crédito</span>
                </button>

                <button
                  onClick={() => {
                    setShowDespesasFinanceirasFunilaria(!showDespesasFinanceirasFunilaria)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasPecas(false)
                    setShowDespesasFinanceirasOficina(false)
                    setShowDespesasFinanceirasAdministracao(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showDespesasFinanceirasFunilaria 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Despesas Financeiras Funilaria</span>
                  <span className="text-[10px] opacity-80">Cartão de Crédito</span>
                </button>

                <button
                  onClick={() => {
                    setShowDespesasFinanceirasAdministracao(!showDespesasFinanceirasAdministracao)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasPecas(false)
                    setShowDespesasFinanceirasOficina(false)
                    setShowDespesasFinanceirasFunilaria(false)
                    setShowBonusNovos(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showDespesasFinanceirasAdministracao 
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400 dark:border-indigo-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Despesas Financeiras Administração</span>
                  <span className="text-[10px] opacity-80">Juros e Despesas</span>
                </button>

                <button
                  onClick={() => {
                    setShowBonusNovos(!showBonusNovos)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasPecas(false)
                    setShowDespesasFinanceirasOficina(false)
                    setShowDespesasFinanceirasFunilaria(false)
                    setShowDespesasFinanceirasAdministracao(false)
                    setShowBonusUsados(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showBonusNovos 
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-green-300 hover:bg-green-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Bonus Novos</span>
                  <span className="text-[10px] opacity-80">Bônus Veículos Novos</span>
                </button>

                <button
                  onClick={() => {
                    setShowBonusUsados(!showBonusUsados)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasPecas(false)
                    setShowDespesasFinanceirasOficina(false)
                    setShowDespesasFinanceirasFunilaria(false)
                    setShowDespesasFinanceirasAdministracao(false)
                    setShowBonusNovos(false)
                    setShowBonusPecas(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showBonusUsados 
                      ? 'bg-lime-50 dark:bg-lime-900/20 border-lime-400 dark:border-lime-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-lime-300 hover:bg-lime-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Bonus Usados</span>
                  <span className="text-[10px] opacity-80">Bônus Veículos Usados</span>
                </button>

                <button
                  onClick={() => {
                    setShowBonusPecas(!showBonusPecas)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasPecas(false)
                    setShowDespesasFinanceirasOficina(false)
                    setShowDespesasFinanceirasFunilaria(false)
                    setShowDespesasFinanceirasAdministracao(false)
                    setShowBonusNovos(false)
                    setShowBonusUsados(false)
                    setShowBonusOficina(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showBonusPecas 
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-yellow-300 hover:bg-yellow-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Bonus Peças</span>
                  <span className="text-[10px] opacity-80">Bônus Peças</span>
                </button>

                <button
                  onClick={() => {
                    setShowBonusOficina(!showBonusOficina)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasPecas(false)
                    setShowDespesasFinanceirasOficina(false)
                    setShowDespesasFinanceirasFunilaria(false)
                    setShowDespesasFinanceirasAdministracao(false)
                    setShowBonusNovos(false)
                    setShowBonusUsados(false)
                    setShowBonusPecas(false)
                    setShowBonusFunilaria(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showBonusOficina 
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400 dark:border-orange-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Bonus Oficina</span>
                  <span className="text-[10px] opacity-80">Bônus Oficina</span>
                </button>

                <button
                  onClick={() => {
                    setShowBonusFunilaria(!showBonusFunilaria)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasPecas(false)
                    setShowDespesasFinanceirasOficina(false)
                    setShowDespesasFinanceirasFunilaria(false)
                    setShowDespesasFinanceirasAdministracao(false)
                    setShowBonusNovos(false)
                    setShowBonusUsados(false)
                    setShowBonusPecas(false)
                    setShowBonusOficina(false)
                    setShowBonusAdministracao(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showBonusFunilaria 
                      ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-400 dark:border-pink-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-pink-300 hover:bg-pink-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Bonus Funilaria</span>
                  <span className="text-[10px] opacity-80">Bônus Funilaria</span>
                </button>

                <button
                  onClick={() => {
                    setShowBonusAdministracao(!showBonusAdministracao)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasPecas(false)
                    setShowDespesasFinanceirasOficina(false)
                    setShowDespesasFinanceirasFunilaria(false)
                    setShowDespesasFinanceirasAdministracao(false)
                    setShowBonusNovos(false)
                    setShowBonusUsados(false)
                    setShowBonusPecas(false)
                    setShowBonusOficina(false)
                    setShowBonusFunilaria(false)
                    setShowReceitaFinanciamentoNovos(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showBonusAdministracao 
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-400 dark:border-purple-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Bonus Administração</span>
                  <span className="text-[10px] opacity-80">Bônus Administração</span>
                </button>

                <button
                  onClick={() => {
                    setShowReceitaFinanciamentoNovos(!showReceitaFinanciamentoNovos)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasPecas(false)
                    setShowDespesasFinanceirasOficina(false)
                    setShowDespesasFinanceirasFunilaria(false)
                    setShowDespesasFinanceirasAdministracao(false)
                    setShowBonusNovos(false)
                    setShowBonusUsados(false)
                    setShowBonusPecas(false)
                    setShowBonusOficina(false)
                    setShowBonusFunilaria(false)
                    setShowBonusAdministracao(false)
                    setShowReceitaFinanciamentoUsados(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showReceitaFinanciamentoNovos 
                      ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-400 dark:border-teal-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Receita Financ. Novos</span>
                  <span className="text-[10px] opacity-80">Receita Financiamento</span>
                </button>

                <button
                  onClick={() => {
                    setShowReceitaFinanciamentoUsados(!showReceitaFinanciamentoUsados)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasPecas(false)
                    setShowDespesasFinanceirasOficina(false)
                    setShowDespesasFinanceirasFunilaria(false)
                    setShowDespesasFinanceirasAdministracao(false)
                    setShowBonusNovos(false)
                    setShowBonusUsados(false)
                    setShowBonusPecas(false)
                    setShowBonusOficina(false)
                    setShowBonusFunilaria(false)
                    setShowBonusAdministracao(false)
                    setShowReceitaFinanciamentoNovos(false)
                    setShowCreditoICMSNovos(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showReceitaFinanciamentoUsados 
                      ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-400 dark:border-cyan-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-cyan-300 hover:bg-cyan-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Receita Financ. Usados</span>
                  <span className="text-[10px] opacity-80">Receita Financiamento</span>
                </button>

                <button
                  onClick={() => {
                    setShowCreditoICMSNovos(!showCreditoICMSNovos)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasPecas(false)
                    setShowDespesasFinanceirasOficina(false)
                    setShowDespesasFinanceirasFunilaria(false)
                    setShowDespesasFinanceirasAdministracao(false)
                    setShowBonusNovos(false)
                    setShowBonusUsados(false)
                    setShowBonusPecas(false)
                    setShowBonusOficina(false)
                    setShowBonusFunilaria(false)
                    setShowBonusAdministracao(false)
                    setShowReceitaFinanciamentoNovos(false)
                    setShowReceitaFinanciamentoUsados(false)
                    setShowCreditoICMSPecas(false)
                    setShowCreditoICMSAdministracao(false)
                    setShowCreditoPISCofinsAdministracao(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showCreditoICMSNovos 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Credito de ICMS Novos</span>
                  <span className="text-[10px] opacity-80">Crédito de ICMS</span>
                </button>

                <button
                  onClick={() => {
                    setShowCreditoICMSPecas(!showCreditoICMSPecas)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasPecas(false)
                    setShowDespesasFinanceirasOficina(false)
                    setShowDespesasFinanceirasFunilaria(false)
                    setShowDespesasFinanceirasAdministracao(false)
                    setShowBonusNovos(false)
                    setShowBonusUsados(false)
                    setShowBonusPecas(false)
                    setShowBonusOficina(false)
                    setShowBonusFunilaria(false)
                    setShowBonusAdministracao(false)
                    setShowReceitaFinanciamentoNovos(false)
                    setShowReceitaFinanciamentoUsados(false)
                    setShowCreditoICMSNovos(false)
                    setShowCreditoICMSAdministracao(false)
                    setShowCreditoPISCofinsAdministracao(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showCreditoICMSPecas 
                      ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-400 dark:border-pink-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-pink-300 hover:bg-pink-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Credito de ICMS Pecas</span>
                  <span className="text-[10px] opacity-80">Crédito de ICMS</span>
                </button>

                <button
                  onClick={() => {
                    setShowCreditoICMSAdministracao(!showCreditoICMSAdministracao)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasPecas(false)
                    setShowDespesasFinanceirasOficina(false)
                    setShowDespesasFinanceirasFunilaria(false)
                    setShowDespesasFinanceirasAdministracao(false)
                    setShowBonusNovos(false)
                    setShowBonusUsados(false)
                    setShowBonusPecas(false)
                    setShowBonusOficina(false)
                    setShowBonusFunilaria(false)
                    setShowBonusAdministracao(false)
                    setShowReceitaFinanciamentoNovos(false)
                    setShowReceitaFinanciamentoUsados(false)
                    setShowCreditoICMSNovos(false)
                    setShowCreditoICMSPecas(false)
                    setShowCreditoPISCofinsAdministracao(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showCreditoICMSAdministracao 
                      ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-400 dark:border-violet-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Credito de ICMS Administração</span>
                  <span className="text-[10px] opacity-80">Crédito de ICMS</span>
                </button>

                <button
                  onClick={() => {
                    setShowCreditoPISCofinsAdministracao(!showCreditoPISCofinsAdministracao)
                    setShowDetailedMetrics(false)
                    setShowTrocasChart(false)
                    setShowRepasseChart(false)
                    setShowEstoqueNovos(false)
                    setShowEstoqueUsados(false)
                    setShowEstoquePecas(false)
                    setShowVendaPecas(false)
                    setShowVendasSeguradora(false)
                    setShowVendasMercadoLivre(false)
                    setShowDespesasFinanceirasNovos(false)
                    setShowDespesasFinanceirasUsados(false)
                    setShowDespesasFinanceirasPecas(false)
                    setShowDespesasFinanceirasOficina(false)
                    setShowDespesasFinanceirasFunilaria(false)
                    setShowDespesasFinanceirasAdministracao(false)
                    setShowBonusNovos(false)
                    setShowBonusUsados(false)
                    setShowBonusPecas(false)
                    setShowBonusOficina(false)
                    setShowBonusFunilaria(false)
                    setShowBonusAdministracao(false)
                    setShowReceitaFinanciamentoNovos(false)
                    setShowReceitaFinanciamentoUsados(false)
                    setShowCreditoICMSNovos(false)
                    setShowCreditoICMSPecas(false)
                    setShowCreditoICMSAdministracao(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showCreditoPISCofinsAdministracao 
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Credito de PIS e Cofins Administração</span>
                  <span className="text-[10px] opacity-80">Crédito PIS/Cofins</span>
                </button>
              </div>
            </CardContent>
          </Card>
          
          {/* Renderização condicional dos cards de dados adicionais */}
          <>
            {/* Card de Venda de Peças por Departamento */}
            {showVendaPecas && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Venda de Peças por Departamento
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Análise de receita, lucro e margem por departamento - 2025
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowVendaPecas(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6">
                    {/* Gráfico 1: Balcão (ID 8) */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg">
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          Peças Balcão
                        </h3>
                      </div>
                      
                      {(() => {
                        const receitaTotal = businessMetricsData.vendasPecas.balcao.vendas.reduce((a, b) => a + b, 0);
                        const lucroTotal = businessMetricsData.vendasPecas.balcao.lucro.reduce((a, b) => a + b, 0);
                        const margemMedia = businessMetricsData.vendasPecas.balcao.margem.reduce((a, b) => a + b, 0) / 12;

                        const chartData = businessMetricsData.months.map((month, index) => {
                          const receitaAtual = businessMetricsData.vendasPecas.balcao.vendas[index];
                          const receitaAnterior = index > 0 ? businessMetricsData.vendasPecas.balcao.vendas[index - 1] : receitaAtual;
                          const variacao = ((receitaAtual - receitaAnterior) / receitaAnterior) * 100;

                          return {
                            month,
                            receita: receitaAtual,
                            margem: businessMetricsData.vendasPecas.balcao.margem[index],
                            variacao: index === 0 ? 0 : variacao
                          };
                        });

                        return (
                          <>
                            <div className="grid grid-cols-3 gap-4 mb-6">
                              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Receita Total</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(receitaTotal)}</p>
                              </div>
                              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Lucro Bruto</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(lucroTotal)}</p>
                              </div>
                              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Margem Média</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">{margemMedia.toFixed(2)}%</p>
                              </div>
                            </div>

                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={chartData}>
                                <defs>
                                  <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                                    <stop offset="100%" stopColor="#93c5fd" stopOpacity={1}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 12 }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 12 }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                  tickFormatter={(value) => `R$ ${(value ).toLocaleString("pt-BR")}`}
                                  label={{ value: 'Receita (milhões R$)', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 12 }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Percentual (%)', angle: 90, position: 'insideRight', fill: '#64748b' }}
                                  domain={[-20, 60]}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                                          <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.month}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-400">RECEITA LÍQUIDA</p>
                                          <p className="text-lg font-bold text-blue-600 mb-2">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(Number(payload[0]?.value || 0))}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-400">MARGEM %</p>
                                          <p className="text-lg font-bold text-green-600 mb-2">{Number(payload[1]?.value || 0).toFixed(2)}%</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-400">VAR. MÊS ANT.</p>
                                          <p className="text-lg font-bold text-orange-600">{Number(payload[2]?.value || 0).toFixed(2)}%</p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={36}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="receita" 
                                  fill="url(#blueGradient)" 
                                  name="Receita Líquida"
                                  radius={[8, 8, 0, 0]}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="margem" 
                                  stroke="#10b981" 
                                  strokeWidth={3}
                                  name="Margem %"
                                  dot={{ fill: '#10b981', r: 4 }}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#f59e0b" 
                                  strokeWidth={2}
                                  strokeDasharray="5 5"
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#f59e0b', r: 3 }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </>
                        );
                      })()}
                    </div>

                    {/* Gráfico 2: Oficina (ID 9) */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg">
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          Peças Oficina
                        </h3>
                      </div>
                      
                      {(() => {
                        const receitaTotal = businessMetricsData.vendasPecas.oficina.vendas.reduce((a, b) => a + b, 0);
                        const lucroTotal = businessMetricsData.vendasPecas.oficina.lucro.reduce((a, b) => a + b, 0);
                        const margemMedia = businessMetricsData.vendasPecas.oficina.margem.reduce((a, b) => a + b, 0) / 12;

                        const chartData = businessMetricsData.months.map((month, index) => {
                          const receitaAtual = businessMetricsData.vendasPecas.oficina.vendas[index];
                          const receitaAnterior = index > 0 ? businessMetricsData.vendasPecas.oficina.vendas[index - 1] : receitaAtual;
                          const variacao = ((receitaAtual - receitaAnterior) / receitaAnterior) * 100;

                          return {
                            month,
                            receita: receitaAtual,
                            margem: businessMetricsData.vendasPecas.oficina.margem[index],
                            variacao: index === 0 ? 0 : variacao
                          };
                        });

                        return (
                          <>
                            <div className="grid grid-cols-3 gap-4 mb-6">
                              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Receita Total</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(receitaTotal)}</p>
                              </div>
                              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Lucro Bruto</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(lucroTotal)}</p>
                              </div>
                              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Margem Média</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">{margemMedia.toFixed(2)}%</p>
                              </div>
                            </div>

                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={chartData}>
                                <defs>
                                  <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1}/>
                                    <stop offset="100%" stopColor="#c4b5fd" stopOpacity={1}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 12 }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 12 }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                  tickFormatter={(value) => `R$ ${(value ).toLocaleString("pt-BR")}`}
                                  label={{ value: 'Receita (milhões R$)', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 12 }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Percentual (%)', angle: 90, position: 'insideRight', fill: '#64748b' }}
                                  domain={[-30, 70]}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                                          <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.month}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-400">RECEITA LÍQUIDA</p>
                                          <p className="text-lg font-bold text-purple-600 mb-2">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(Number(payload[0]?.value || 0))}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-400">MARGEM %</p>
                                          <p className="text-lg font-bold text-teal-600 mb-2">{Number(payload[1]?.value || 0).toFixed(2)}%</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-400">VAR. MÊS ANT.</p>
                                          <p className="text-lg font-bold text-orange-600">{Number(payload[2]?.value || 0).toFixed(2)}%</p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={36}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="receita" 
                                  fill="url(#purpleGradient)" 
                                  name="Receita Líquida"
                                  radius={[8, 8, 0, 0]}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="margem" 
                                  stroke="#14b8a6" 
                                  strokeWidth={3}
                                  name="Margem %"
                                  dot={{ fill: '#14b8a6', r: 4 }}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#f59e0b" 
                                  strokeWidth={2}
                                  strokeDasharray="5 5"
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#f59e0b', r: 3 }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </>
                        );
                      })()}
                    </div>

                    {/* Gráfico 3: Funilaria (ID 10) */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg">
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          Peças Funilaria
                        </h3>
                      </div>
                      
                      {(() => {
                        const receitaTotal = businessMetricsData.vendasPecas.funilaria.vendas.reduce((a, b) => a + b, 0);
                        const lucroTotal = businessMetricsData.vendasPecas.funilaria.lucro.reduce((a, b) => a + b, 0);
                        const margemMedia = businessMetricsData.vendasPecas.funilaria.margem.reduce((a, b) => a + b, 0) / 12;

                        const chartData = businessMetricsData.months.map((month, index) => {
                          const receitaAtual = businessMetricsData.vendasPecas.funilaria.vendas[index];
                          const receitaAnterior = index > 0 ? businessMetricsData.vendasPecas.funilaria.vendas[index - 1] : receitaAtual;
                          const variacao = ((receitaAtual - receitaAnterior) / receitaAnterior) * 100;

                          return {
                            month,
                            receita: receitaAtual,
                            margem: businessMetricsData.vendasPecas.funilaria.margem[index],
                            variacao: index === 0 ? 0 : variacao
                          };
                        });

                        return (
                          <>
                            <div className="grid grid-cols-3 gap-4 mb-6">
                              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Receita Total</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(receitaTotal)}</p>
                              </div>
                              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Lucro Bruto</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(lucroTotal)}</p>
                              </div>
                              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Margem Média</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">{margemMedia.toFixed(2)}%</p>
                              </div>
                            </div>

                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={chartData}>
                                <defs>
                                  <linearGradient id="violetGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#a855f7" stopOpacity={1}/>
                                    <stop offset="100%" stopColor="#ddd6fe" stopOpacity={1}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 12 }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 12 }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                  tickFormatter={(value) => `R$ ${(value ).toLocaleString("pt-BR")}`}
                                  label={{ value: 'Receita (milhões R$)', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 12 }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Percentual (%)', angle: 90, position: 'insideRight', fill: '#64748b' }}
                                  domain={[-60, 120]}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                                          <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.month}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-400">RECEITA LÍQUIDA</p>
                                          <p className="text-lg font-bold text-purple-600 mb-2">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(Number(payload[0]?.value || 0))}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-400">MARGEM %</p>
                                          <p className="text-lg font-bold text-green-600 mb-2">{Number(payload[1]?.value || 0).toFixed(2)}%</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-400">VAR. MÊS ANT.</p>
                                          <p className="text-lg font-bold text-orange-600">{Number(payload[2]?.value || 0).toFixed(2)}%</p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={36}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="receita" 
                                  fill="url(#violetGradient)" 
                                  name="Receita Líquida"
                                  radius={[8, 8, 0, 0]}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="margem" 
                                  stroke="#10b981" 
                                  strokeWidth={3}
                                  name="Margem %"
                                  dot={{ fill: '#10b981', r: 4 }}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#f59e0b" 
                                  strokeWidth={2}
                                  strokeDasharray="5 5"
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#f59e0b', r: 3 }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </>
                        );
                      })()}
                    </div>

                    {/* Gráfico 4: Acessórios (ID 11) */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg">
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          Peças Acessórios
                        </h3>
                      </div>
                      
                      {(() => {
                        const receitaTotal = businessMetricsData.vendasPecas.acessorios.vendas.reduce((a, b) => a + b, 0);
                        const lucroTotal = businessMetricsData.vendasPecas.acessorios.lucro.reduce((a, b) => a + b, 0);
                        const margemMedia = businessMetricsData.vendasPecas.acessorios.margem.reduce((a, b) => a + b, 0) / 12;

                        const chartData = businessMetricsData.months.map((month, index) => {
                          const receitaAtual = businessMetricsData.vendasPecas.acessorios.vendas[index];
                          const receitaAnterior = index > 0 ? businessMetricsData.vendasPecas.acessorios.vendas[index - 1] : receitaAtual;
                          const variacao = ((receitaAtual - receitaAnterior) / receitaAnterior) * 100;

                          return {
                            month,
                            receita: receitaAtual,
                            margem: businessMetricsData.vendasPecas.acessorios.margem[index],
                            variacao: index === 0 ? 0 : variacao
                          };
                        });

                        return (
                          <>
                            <div className="grid grid-cols-3 gap-4 mb-6">
                              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Receita Total</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(receitaTotal)}</p>
                              </div>
                              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Lucro Bruto</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(lucroTotal)}</p>
                              </div>
                              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Margem Média</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">{margemMedia.toFixed(2)}%</p>
                              </div>
                            </div>

                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={chartData}>
                                <defs>
                                  <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={1}/>
                                    <stop offset="100%" stopColor="#a5f3fc" stopOpacity={1}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 12 }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 12 }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                  tickFormatter={(value) => `R$ ${(value ).toLocaleString("pt-BR")}`}
                                  label={{ value: 'Receita (milhões R$)', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 12 }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Percentual (%)', angle: 90, position: 'insideRight', fill: '#64748b' }}
                                  domain={[-60, 120]}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                                          <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.month}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-400">RECEITA LÍQUIDA</p>
                                          <p className="text-lg font-bold text-cyan-600 mb-2">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(Number(payload[0]?.value || 0))}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-400">MARGEM %</p>
                                          <p className="text-lg font-bold text-green-600 mb-2">{Number(payload[1]?.value || 0).toFixed(2)}%</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-400">VAR. MÊS ANT.</p>
                                          <p className="text-lg font-bold text-orange-600">{Number(payload[2]?.value || 0).toFixed(2)}%</p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={36}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="receita" 
                                  fill="url(#cyanGradient)" 
                                  name="Receita Líquida"
                                  radius={[8, 8, 0, 0]}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="margem" 
                                  stroke="#10b981" 
                                  strokeWidth={3}
                                  name="Margem %"
                                  dot={{ fill: '#10b981', r: 4 }}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#f59e0b" 
                                  strokeWidth={2}
                                  strokeDasharray="5 5"
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#f59e0b', r: 3 }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </>
                        );
                      })()}
                    </div>

                    {/* Gráfico 5: Total Consolidado (ID 8 + ID 9 + ID 10 + ID 11) */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          Total Consolidado
                        </h3>
                        {(() => {
                          // Calcular vendas consolidadas (soma de Balcão + Oficina + Funilaria + Acessórios)
                          const vendasConsolidadas = businessMetricsData.months.map((_, index) => 
                            businessMetricsData.vendasPecas.balcao.vendas[index] +
                            businessMetricsData.vendasPecas.oficina.vendas[index] +
                            businessMetricsData.vendasPecas.funilaria.vendas[index] +
                            businessMetricsData.vendasPecas.acessorios.vendas[index]
                          );
                          
                          const ultimaReceita = vendasConsolidadas[11];
                          const penultimaReceita = vendasConsolidadas[10];
                          const variacao = ((ultimaReceita - penultimaReceita) / penultimaReceita) * 100;
                          
                          return (
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold ${variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {variacao >= 0 ? '↗' : '↘'} {variacao.toFixed(1)}%
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                      
                      {(() => {
                        // Calcular totais consolidados
                        const vendasConsolidadas = businessMetricsData.months.map((_, index) => 
                          businessMetricsData.vendasPecas.balcao.vendas[index] +
                          businessMetricsData.vendasPecas.oficina.vendas[index] +
                          businessMetricsData.vendasPecas.funilaria.vendas[index] +
                          businessMetricsData.vendasPecas.acessorios.vendas[index]
                        );
                        
                        const lucroConsolidado = businessMetricsData.months.map((_, index) => 
                          businessMetricsData.vendasPecas.balcao.lucro[index] +
                          businessMetricsData.vendasPecas.oficina.lucro[index] +
                          businessMetricsData.vendasPecas.funilaria.lucro[index] +
                          businessMetricsData.vendasPecas.acessorios.lucro[index]
                        );
                        
                        const margemConsolidada = businessMetricsData.months.map((_, index) => 
                          (lucroConsolidado[index] / vendasConsolidadas[index]) * 100
                        );
                        
                        const receitaTotal = vendasConsolidadas.reduce((a, b) => a + b, 0);
                        const lucroTotal = lucroConsolidado.reduce((a, b) => a + b, 0);
                        const margemMedia = margemConsolidada.reduce((a, b) => a + b, 0) / 12;

                        const chartData = businessMetricsData.months.map((month, index) => {
                          const receitaAtual = vendasConsolidadas[index];
                          const receitaAnterior = index > 0 ? vendasConsolidadas[index - 1] : receitaAtual;
                          const variacao = ((receitaAtual - receitaAnterior) / receitaAnterior) * 100;

                          return {
                            month,
                            receita: receitaAtual,
                            margem: margemConsolidada[index],
                            variacao: index === 0 ? 0 : variacao
                          };
                        });

                        return (
                          <>
                            <div className="grid grid-cols-3 gap-4 mb-6">
                              <div className="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-lg">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Receita Total</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(receitaTotal)}</p>
                              </div>
                              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Lucro Bruto</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(lucroTotal)}</p>
                              </div>
                              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Margem Média</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">{margemMedia.toFixed(2)}%</p>
                              </div>
                            </div>

                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={chartData}>
                                <defs>
                                  <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={1}/>
                                    <stop offset="100%" stopColor="#67e8f9" stopOpacity={1}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 12 }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 12 }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                  tickFormatter={(value) => `R$ ${(value ).toLocaleString("pt-BR")}`}
                                  label={{ value: 'Receita (milhões R$)', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 12 }}
                                  axisLine={{ stroke: '#cbd5e1' }}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Percentual (%)', angle: 90, position: 'insideRight', fill: '#64748b' }}
                                  domain={[-20, 60]}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                                          <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.month}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-400">RECEITA LÍQUIDA</p>
                                          <p className="text-lg font-bold text-cyan-600 mb-2">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(Number(payload[0]?.value || 0))}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-400">MARGEM %</p>
                                          <p className="text-lg font-bold text-emerald-600 mb-2">{Number(payload[1]?.value || 0).toFixed(2)}%</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-400">VAR. MÊS ANT.</p>
                                          <p className="text-lg font-bold text-amber-600">{Number(payload[2]?.value || 0).toFixed(2)}%</p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={36}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="receita" 
                                  fill="url(#cyanGradient)" 
                                  name="Receita Líquida"
                                  radius={[8, 8, 0, 0]}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="margem" 
                                  stroke="#10b981" 
                                  strokeWidth={3}
                                  name="Margem %"
                                  dot={{ fill: '#10b981', r: 4 }}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#f59e0b" 
                                  strokeWidth={2}
                                  strokeDasharray="5 5"
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#f59e0b', r: 3 }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Vendas por Seguradora */}
            {showVendasSeguradora && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Vendas por Seguradora - Performance 2025
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Análise de vendas, lucro e margem por seguradora
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowVendasSeguradora(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    {/* Gráfico 1: Porto Seguro */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                      {/* Header com título e variação */}
                      {(() => {
                        const totalVendas = businessMetricsData.seguradoras.portoSeguro.vendas.reduce((a, b) => a + b, 0);
                        const totalLucro = businessMetricsData.seguradoras.portoSeguro.lucro.reduce((a, b) => a + b, 0);
                        const margemMedia = businessMetricsData.seguradoras.portoSeguro.margem.reduce((a, b) => a + b, 0) / 12;
                        const ultimaVenda = businessMetricsData.seguradoras.portoSeguro.vendas[11];
                        const penultimaVenda = businessMetricsData.seguradoras.portoSeguro.vendas[10];
                        const variacaoMes = ((ultimaVenda - penultimaVenda) / penultimaVenda) * 100;
                        
                        return (
                          <>
                            <div className="px-6 py-4">
                              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                Porto Seguro
                              </h3>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-y border-slate-200 dark:border-slate-700">
                              <div className="grid grid-cols-3 gap-6">
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Receita Total</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    R$ {totalVendas.toLocaleString('pt-BR')}
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Lucro Bruto</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    R$ {totalLucro.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Margem Média</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {margemMedia.toFixed(2)}%
                                  </p>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                      
                      {/* Gráfico */}
                      <div className="p-6">
                        <ChartContainer config={{}} className="h-[350px] w-full">
                          <ComposedChart data={businessMetricsData.months.map((month, index) => {
                            const vendaAtual = businessMetricsData.seguradoras.portoSeguro.vendas[index];
                            const vendaAnterior = index > 0 ? businessMetricsData.seguradoras.portoSeguro.vendas[index - 1] : vendaAtual;
                            const variacaoMesAnt = index > 0 ? ((vendaAtual - vendaAnterior) / vendaAnterior) * 100 : 0;
                            
                            return {
                              month,
                              receitaLiquida: vendaAtual,
                              receitaLiquida3d: vendaAtual * 0.92,
                              margem: businessMetricsData.seguradoras.portoSeguro.margem[index],
                              variacaoMesAnt: variacaoMesAnt
                            };
                          })} width={1654} height={350}>
                            <defs>
                              <linearGradient id="barGradientBluePS" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.9}/>
                                <stop offset="50%" stopColor="#64748b" stopOpacity={0.8}/>
                                <stop offset="100%" stopColor="#475569" stopOpacity={0.7}/>
                              </linearGradient>
                              <linearGradient id="barGradientGrayPS" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.5}/>
                                <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.4}/>
                              </linearGradient>
                            </defs>
                            <XAxis 
                              dataKey="month" 
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={{ stroke: '#e2e8f0' }}
                              tickLine={false}
                            />
                            <YAxis 
                              yAxisId="left"
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              label={{ value: 'Receita em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(value) => `${value}%`}
                              label={{ value: 'Percentual (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                            />
                            <ChartTooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                      <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                      <div className="space-y-2">
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Receita Líquida</p>
                                          <p className="text-lg font-bold text-slate-700 dark:text-white">R$ {data.receitaLiquida.toLocaleString('pt-BR')}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Lucro Bruto</p>
                                          <p className="text-lg font-bold text-green-600">R$ {(data.receitaLiquida * data.margem / 100).toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Margem</p>
                                          <p className="text-lg font-bold text-red-600">{data.margem.toFixed(2)}%</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                          <p className={`text-lg font-bold ${data.variacaoMesAnt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {data.variacaoMesAnt >= 0 ? '+' : ''}{data.variacaoMesAnt.toFixed(2)}%
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
                              verticalAlign="bottom" 
                              height={40}
                              iconType="circle"
                              wrapperStyle={{ paddingTop: '20px' }}
                            />
                            <Bar 
                              yAxisId="left"
                              dataKey="receitaLiquida" 
                              fill="url(#barGradientBluePS)"
                              name="Receita Líquida"
                              radius={[8, 8, 0, 0]}
                              barSize={55}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="margem" 
                              stroke="#10b981" 
                              strokeWidth={3}
                              name="Margem %"
                              dot={{ fill: '#10b981', r: 5, strokeWidth: 2, stroke: '#fff' }}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="variacaoMesAnt" 
                              stroke="#f97316" 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              name="Var. Mês Ant. %"
                              dot={{ fill: '#f97316', r: 4, strokeWidth: 2, stroke: '#fff' }}
                            />
                          </ComposedChart>
                        </ChartContainer>
                      </div>
                    </div>

                    {/* Gráfico 2: Azul Seguros */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                      {/* Header com título e variação */}
                      {(() => {
                        const totalVendas = businessMetricsData.seguradoras.azul.vendas.reduce((a, b) => a + b, 0);
                        const totalLucro = businessMetricsData.seguradoras.azul.lucro.reduce((a, b) => a + b, 0);
                        const margemMedia = businessMetricsData.seguradoras.azul.margem.reduce((a, b) => a + b, 0) / 12;
                        const ultimaVenda = businessMetricsData.seguradoras.azul.vendas[11];
                        const penultimaVenda = businessMetricsData.seguradoras.azul.vendas[10];
                        const variacaoMes = ((ultimaVenda - penultimaVenda) / penultimaVenda) * 100;
                        
                        return (
                          <>
                            <div className="px-6 py-4">
                              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                Azul Seguros
                              </h3>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-y border-slate-200 dark:border-slate-700">
                              <div className="grid grid-cols-3 gap-6">
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Receita Total</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    R$ {totalVendas.toLocaleString('pt-BR')}
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Lucro Bruto</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    R$ {totalLucro.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Margem Média</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {margemMedia.toFixed(2)}%
                                  </p>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                      
                      {/* Gráfico */}
                      <div className="p-6">
                        <ChartContainer config={{}} className="h-[350px] w-full">
                          <ComposedChart data={businessMetricsData.months.map((month, index) => {
                            const vendaAtual = businessMetricsData.seguradoras.azul.vendas[index];
                            const vendaAnterior = index > 0 ? businessMetricsData.seguradoras.azul.vendas[index - 1] : vendaAtual;
                            const variacaoMesAnt = index > 0 ? ((vendaAtual - vendaAnterior) / vendaAnterior) * 100 : 0;
                            
                            return {
                              month,
                              receitaLiquida: vendaAtual,
                              receitaLiquida3d: vendaAtual * 0.92,
                              margem: businessMetricsData.seguradoras.azul.margem[index],
                              variacaoMesAnt: variacaoMesAnt
                            };
                          })} width={1654} height={350}>
                            <defs>
                              <linearGradient id="barGradientCyan" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.9}/>
                                <stop offset="50%" stopColor="#22d3ee" stopOpacity={0.8}/>
                                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.7}/>
                              </linearGradient>
                              <linearGradient id="barGradientGrayCyan" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.5}/>
                                <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.4}/>
                              </linearGradient>
                            </defs>
                            <XAxis 
                              dataKey="month" 
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={{ stroke: '#e2e8f0' }}
                              tickLine={false}
                            />
                            <YAxis 
                              yAxisId="left"
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              label={{ value: 'Receita em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(value) => `${value}%`}
                              label={{ value: 'Percentual (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                            />
                            <ChartTooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                      <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                      <div className="space-y-2">
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Receita Líquida</p>
                                          <p className="text-lg font-bold text-slate-700 dark:text-white">R$ {data.receitaLiquida.toLocaleString('pt-BR')}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Lucro Bruto</p>
                                          <p className="text-lg font-bold text-green-600">R$ {(data.receitaLiquida * data.margem / 100).toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Margem</p>
                                          <p className="text-lg font-bold text-red-600">{data.margem.toFixed(2)}%</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                          <p className={`text-lg font-bold ${data.variacaoMesAnt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {data.variacaoMesAnt >= 0 ? '+' : ''}{data.variacaoMesAnt.toFixed(2)}%
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
                              verticalAlign="bottom" 
                              height={40}
                              iconType="circle"
                              wrapperStyle={{ paddingTop: '20px' }}
                            />
                            <Bar 
                              yAxisId="left"
                              dataKey="receitaLiquida" 
                              fill="url(#barGradientCyan)"
                              name="Receita Líquida"
                              radius={[8, 8, 0, 0]}
                              barSize={55}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="margem" 
                              stroke="#10b981" 
                              strokeWidth={3}
                              name="Margem %"
                              dot={{ fill: '#10b981', r: 5, strokeWidth: 2, stroke: '#fff' }}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="variacaoMesAnt" 
                              stroke="#f97316" 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              name="Var. Mês Ant. %"
                              dot={{ fill: '#f97316', r: 4, strokeWidth: 2, stroke: '#fff' }}
                            />
                          </ComposedChart>
                        </ChartContainer>
                      </div>
                    </div>

                    {/* Gráfico 3: Allianz */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                      {/* Header com título e variação */}
                      {(() => {
                        const totalVendas = businessMetricsData.seguradoras.allianz.vendas.reduce((a, b) => a + b, 0);
                        const totalLucro = businessMetricsData.seguradoras.allianz.lucro.reduce((a, b) => a + b, 0);
                        const margemMedia = businessMetricsData.seguradoras.allianz.margem.reduce((a, b) => a + b, 0) / 12;
                        const ultimaVenda = businessMetricsData.seguradoras.allianz.vendas[11];
                        const penultimaVenda = businessMetricsData.seguradoras.allianz.vendas[10];
                        const variacaoMes = ((ultimaVenda - penultimaVenda) / penultimaVenda) * 100;
                        
                        return (
                          <>
                            <div className="px-6 py-4">
                              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                Allianz
                              </h3>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-y border-slate-200 dark:border-slate-700">
                              <div className="grid grid-cols-3 gap-6">
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Receita Total</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    R$ {totalVendas.toLocaleString('pt-BR')}
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Lucro Bruto</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    R$ {totalLucro.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Margem Média</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {margemMedia.toFixed(2)}%
                                  </p>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                      
                      {/* Gráfico */}
                      <div className="p-6">
                        <ChartContainer config={{}} className="h-[350px] w-full">
                          <ComposedChart data={businessMetricsData.months.map((month, index) => {
                            const vendaAtual = businessMetricsData.seguradoras.allianz.vendas[index];
                            const vendaAnterior = index > 0 ? businessMetricsData.seguradoras.allianz.vendas[index - 1] : vendaAtual;
                            const variacaoMesAnt = index > 0 ? ((vendaAtual - vendaAnterior) / vendaAnterior) * 100 : 0;
                            
                            return {
                              month,
                              receitaLiquida: vendaAtual,
                              receitaLiquida3d: vendaAtual * 0.92,
                              margem: businessMetricsData.seguradoras.allianz.margem[index],
                              variacaoMesAnt: variacaoMesAnt
                            };
                          })} width={1654} height={350}>
                            <defs>
                              <linearGradient id="barGradientYellow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#fde047" stopOpacity={0.9}/>
                                <stop offset="50%" stopColor="#facc15" stopOpacity={0.8}/>
                                <stop offset="100%" stopColor="#eab308" stopOpacity={0.7}/>
                              </linearGradient>
                              <linearGradient id="barGradientGrayYellow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.5}/>
                                <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.4}/>
                              </linearGradient>
                            </defs>
                            <XAxis 
                              dataKey="month" 
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={{ stroke: '#e2e8f0' }}
                              tickLine={false}
                            />
                            <YAxis 
                              yAxisId="left"
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              label={{ value: 'Receita em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(value) => `${value}%`}
                              label={{ value: 'Percentual (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                            />
                            <ChartTooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                      <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                      <div className="space-y-2">
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Receita Líquida</p>
                                          <p className="text-lg font-bold text-slate-700 dark:text-white">R$ {data.receitaLiquida.toLocaleString('pt-BR')}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Lucro Bruto</p>
                                          <p className="text-lg font-bold text-green-600">R$ {(data.receitaLiquida * data.margem / 100).toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Margem</p>
                                          <p className="text-lg font-bold text-red-600">{data.margem.toFixed(2)}%</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                          <p className={`text-lg font-bold ${data.variacaoMesAnt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {data.variacaoMesAnt >= 0 ? '+' : ''}{data.variacaoMesAnt.toFixed(2)}%
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
                              verticalAlign="bottom" 
                              height={40}
                              iconType="circle"
                              wrapperStyle={{ paddingTop: '20px' }}
                            />
                            <Bar 
                              yAxisId="left"
                              dataKey="receitaLiquida" 
                              fill="url(#barGradientYellow)"
                              name="Receita Líquida"
                              radius={[8, 8, 0, 0]}
                              barSize={55}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="margem" 
                              stroke="#10b981" 
                              strokeWidth={3}
                              name="Margem %"
                              dot={{ fill: '#10b981', r: 5, strokeWidth: 2, stroke: '#fff' }}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="variacaoMesAnt" 
                              stroke="#f97316" 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              name="Var. Mês Ant. %"
                              dot={{ fill: '#f97316', r: 4, strokeWidth: 2, stroke: '#fff' }}
                            />
                          </ComposedChart>
                        </ChartContainer>
                      </div>
                    </div>

                    {/* Gráfico 4: Tokio Marine */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                      {/* Header com título e variação */}
                      {(() => {
                        const vendas = [105466, 118535, 87858, 37793, 365647, 194721, 192020, 234193, 245247, 338808, 371809, 366783];
                        const lucros = [14528, 10793, 10640, 4958, 51530, 26299, 25900, 30071, 33677, 43209, 45834, 37197];
                        const margens = vendas.map((v, i) => (lucros[i] / v * 100));
                        
                        const totalVendas = vendas.reduce((a, b) => a + b, 0);
                        const totalLucro = lucros.reduce((a, b) => a + b, 0);
                        const margemMedia = (totalLucro / totalVendas * 100);
                        
                        const ultimaVenda = vendas[11];
                        const penultimaVenda = vendas[10];
                        const variacao = ((ultimaVenda - penultimaVenda) / penultimaVenda) * 100;
                        
                        return (
                          <>
                            <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 border-b border-slate-200 dark:border-slate-700">
                              <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                  Tokio Marine
                                </h3>
                                <div className="flex items-center gap-2">
                                  {variacao >= 0 ? (
                                    <TrendingUp className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <TrendingDown className="w-5 h-5 text-red-600" />
                                  )}
                                  <span className={`text-lg font-semibold ${variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {variacao >= 0 ? '+' : ''}{variacao.toFixed(2)}%
                                  </span>
                                </div>
                              </div>
                              
                              {/* KPI Cards */}
                              <div className="grid grid-cols-3 gap-4 mt-4">
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Receita Total</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    R$ {totalVendas.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Lucro Bruto</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    R$ {totalLucro.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Margem Média</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {margemMedia.toFixed(2)}%
                                  </p>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                      
                      {/* Gráfico */}
                      <div className="p-6">
                        <ChartContainer config={{}} className="h-[350px] w-full">
                          <ComposedChart data={businessMetricsData.months.map((month, index) => {
                            const vendas = [105466, 118535, 87858, 37793, 365647, 194721, 192020, 234193, 245247, 338808, 371809, 366783];
                            const lucros = [14528, 10793, 10640, 4958, 51530, 26299, 25900, 30071, 33677, 43209, 45834, 37197];
                            
                            const vendaAtual = vendas[index];
                            const vendaAnterior = index > 0 ? vendas[index - 1] : vendaAtual;
                            const variacaoMesAnt = index > 0 ? ((vendaAtual - vendaAnterior) / vendaAnterior) * 100 : 0;
                            const margem = (lucros[index] / vendaAtual) * 100;
                            
                            return {
                              month,
                              receitaLiquida: vendaAtual,
                              margem: margem,
                              variacaoMesAnt: variacaoMesAnt
                            };
                          })} width={1654} height={350}>
                            <defs>
                              <linearGradient id="barGradientPurple" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#a855f7" stopOpacity={0.9}/>
                                <stop offset="50%" stopColor="#9333ea" stopOpacity={0.8}/>
                                <stop offset="100%" stopColor="#7e22ce" stopOpacity={0.7}/>
                              </linearGradient>
                            </defs>
                            <XAxis 
                              dataKey="month" 
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={{ stroke: '#e2e8f0' }}
                              tickLine={false}
                            />
                            <YAxis 
                              yAxisId="left"
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              label={{ value: 'Receita em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(value) => `${value}%`}
                              label={{ value: 'Percentual (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                            />
                            <ChartTooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  const lucros = [14528, 10793, 10640, 4958, 51530, 26299, 25900, 30071, 33677, 43209, 45834, 37197];
                                  const monthIndex = businessMetricsData.months.indexOf(data.month);
                                  const lucroBruto = lucros[monthIndex];
                                  
                                  return (
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                      <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                      <div className="space-y-2">
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Receita Líquida</p>
                                          <p className="text-lg font-bold text-slate-700 dark:text-white">R$ {data.receitaLiquida.toLocaleString('pt-BR')}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Lucro Bruto</p>
                                          <p className="text-lg font-bold text-green-600">R$ {lucroBruto.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Margem</p>
                                          <p className="text-lg font-bold text-red-600">{data.margem.toFixed(2)}%</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                          <p className={`text-lg font-bold ${data.variacaoMesAnt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {data.variacaoMesAnt >= 0 ? '+' : ''}{data.variacaoMesAnt.toFixed(2)}%
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend 
                              verticalAlign="bottom" 
                              height={40}
                              iconType="circle"
                              wrapperStyle={{ paddingTop: '20px' }}
                            />
                            <Bar 
                              yAxisId="left"
                              dataKey="receitaLiquida" 
                              fill="url(#barGradientPurple)"
                              name="Receita Líquida"
                              radius={[8, 8, 0, 0]}
                              barSize={55}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="margem" 
                              stroke="#10b981" 
                              strokeWidth={3}
                              name="Margem %"
                              dot={{ fill: '#10b981', r: 5, strokeWidth: 2, stroke: '#fff' }}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="variacaoMesAnt" 
                              stroke="#f97316" 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              name="Var. Mês Ant. %"
                              dot={{ fill: '#f97316', r: 4, strokeWidth: 2, stroke: '#fff' }}
                            />
                          </ComposedChart>
                        </ChartContainer>
                      </div>
                    </div>

                    {/* Gráfico 5: Total Consolidado */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                      {/* Header com título e variação */}
                      {(() => {
                        const vendas = [988075, 812288, 682001, 669198, 1081065, 846304, 590311, 573663, 816041, 1125948, 1035220, 1090539];
                        const lucros = [33025, 33059, 30884, 32074, 57252, 37751, 19413, 9997, 23681, 8626, 28212, 12352];
                        
                        const totalVendas = vendas.reduce((a, b) => a + b, 0);
                        const totalLucro = lucros.reduce((a, b) => a + b, 0);
                        const margemMedia = (totalLucro / totalVendas * 100);
                        const ultimaVenda = vendas[11];
                        const penultimaVenda = vendas[10];
                        const variacaoMes = ((ultimaVenda - penultimaVenda) / penultimaVenda) * 100;
                        
                        return (
                          <>
                            <div className="px-6 py-4">
                              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                Total Consolidado
                              </h3>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-y border-slate-200 dark:border-slate-700">
                              <div className="grid grid-cols-3 gap-6">
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Receita Total</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    R$ {totalVendas.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Lucro Bruto</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    R$ {totalLucro.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Margem Média</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {margemMedia.toFixed(2)}%
                                  </p>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                      
                      {/* Gráfico */}
                      <div className="p-6">
                        <ChartContainer config={{}} className="h-[350px] w-full">
                          <ComposedChart data={businessMetricsData.months.map((month, index) => {
                            const vendas = [988075, 812288, 682001, 669198, 1081065, 846304, 590311, 573663, 816041, 1125948, 1035220, 1090539];
                            const lucros = [33025, 33059, 30884, 32074, 57252, 37751, 19413, 9997, 23681, 8626, 28212, 12352];
                            
                            const vendaAtual = vendas[index];
                            const vendaAnterior = index > 0 ? vendas[index - 1] : vendaAtual;
                            const variacaoMesAnt = index > 0 ? ((vendaAtual - vendaAnterior) / vendaAnterior) * 100 : 0;
                            const margem = (lucros[index] / vendaAtual) * 100;
                            
                            return {
                              month,
                              receitaLiquida: vendaAtual,
                              margem: margem,
                              variacaoMesAnt: variacaoMesAnt
                            };
                          })} width={1654} height={350}>
                            <defs>
                              <linearGradient id="barGradientGrayDark" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.9}/>
                                <stop offset="50%" stopColor="#64748b" stopOpacity={0.8}/>
                                <stop offset="100%" stopColor="#475569" stopOpacity={0.7}/>
                              </linearGradient>
                              <linearGradient id="barGradientGrayLight" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.5}/>
                                <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.4}/>
                              </linearGradient>
                            </defs>
                            <XAxis 
                              dataKey="month" 
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={{ stroke: '#e2e8f0' }}
                              tickLine={false}
                            />
                            <YAxis 
                              yAxisId="left"
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              label={{ value: 'Receita em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(value) => `${value}%`}
                              label={{ value: 'Percentual (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                            />
                            <ChartTooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                      <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                      <div className="space-y-2">
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Receita Líquida</p>
                                          <p className="text-lg font-bold text-slate-700 dark:text-white">R$ {data.receitaLiquida.toLocaleString('pt-BR')}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Lucro Bruto</p>
                                          <p className="text-lg font-bold text-green-600">R$ {(data.receitaLiquida * data.margem / 100).toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Margem</p>
                                          <p className="text-lg font-bold text-red-600">{data.margem.toFixed(2)}%</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                          <p className={`text-lg font-bold ${data.variacaoMesAnt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {data.variacaoMesAnt >= 0 ? '+' : ''}{data.variacaoMesAnt.toFixed(2)}%
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
                              verticalAlign="bottom" 
                              height={40}
                              iconType="circle"
                              wrapperStyle={{ paddingTop: '20px' }}
                            />
                            <Bar 
                              yAxisId="left"
                              dataKey="receitaLiquida" 
                              fill="url(#barGradientGrayDark)"
                              name="Receita Líquida"
                              radius={[8, 8, 0, 0]}
                              barSize={55}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="margem" 
                              stroke="#10b981" 
                              strokeWidth={3}
                              name="Margem %"
                              dot={{ fill: '#10b981', r: 5, strokeWidth: 2, stroke: '#fff' }}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="variacaoMesAnt" 
                              stroke="#f97316" 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              name="Var. Mês Ant. %"
                              dot={{ fill: '#f97316', r: 4, strokeWidth: 2, stroke: '#fff' }}
                            />
                          </ComposedChart>
                        </ChartContainer>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Vendas Mercado Livre */}
            {showVendasMercadoLivre && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Vendas Mercado Livre - Performance 2025
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Análise de vendas, lucro e margem no marketplace
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowVendasMercadoLivre(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    {/* Gráfico Mercado Livre */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                      {/* Header com título e variação */}
                      {(() => {
                        const vendas = [295637, 226990, 152428, 231056, 186334, 224765, 274123, 261008, 177273, 146230, 161814, 107544];
                        const lucros = [36424, 24968, 14607, 24554, 16823, 23176, 7967, 1135, 3679, 6500, 5067, 6230];
                        
                        const totalVendas = vendas.reduce((a, b) => a + b, 0);
                        const totalLucro = lucros.reduce((a, b) => a + b, 0);
                        const margemMedia = (totalLucro / totalVendas * 100);
                        
                        const ultimaVenda = vendas[11];
                        const penultimaVenda = vendas[10];
                        const variacao = ((ultimaVenda - penultimaVenda) / penultimaVenda) * 100;
                        
                        return (
                          <>
                            <div className="bg-white dark:bg-slate-800 p-6 border-b border-slate-200 dark:border-slate-700">
                              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                Mercado Livre
                              </h3>
                              
                              {/* KPI Cards */}
                              <div className="grid grid-cols-3 gap-4 mt-4">
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Receita Total</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    R$ {totalVendas.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Lucro Bruto</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    R$ {totalLucro.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Margem Média</p>
                                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {margemMedia.toFixed(2)}%
                                  </p>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                      
                      {/* Gráfico */}
                      <div className="p-6">
                        <ChartContainer config={{}} className="h-[350px] w-full">
                          <ComposedChart data={businessMetricsData.months.map((month, index) => {
                            const vendas = [295637, 226990, 152428, 231056, 186334, 224765, 274123, 261008, 177273, 146230, 161814, 107544];
                            const lucros = [36424, 24968, 14607, 24554, 16823, 23176, 7967, 1135, 3679, 6500, 5067, 6230];
                            
                            const vendaAtual = vendas[index];
                            const vendaAnterior = index > 0 ? vendas[index - 1] : vendaAtual;
                            const variacaoMesAnt = index > 0 ? ((vendaAtual - vendaAnterior) / vendaAnterior) * 100 : 0;
                            const margem = (lucros[index] / vendaAtual) * 100;
                            
                            return {
                              month,
                              receitaLiquida: vendaAtual,
                              margem: margem,
                              variacaoMesAnt: variacaoMesAnt
                            };
                          })} width={1654} height={350}>
                            <defs>
                              <linearGradient id="barGradientOrange" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#fb923c" stopOpacity={0.9}/>
                                <stop offset="50%" stopColor="#f97316" stopOpacity={0.8}/>
                                <stop offset="100%" stopColor="#ea580c" stopOpacity={0.7}/>
                              </linearGradient>
                            </defs>
                            <XAxis 
                              dataKey="month" 
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={{ stroke: '#e2e8f0' }}
                              tickLine={false}
                            />
                            <YAxis 
                              yAxisId="left"
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              label={{ value: 'Receita em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(value) => `${value}%`}
                              label={{ value: 'Percentual (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                            />
                            <ChartTooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  const lucros = [36424, 24968, 14607, 24554, 16823, 23176, 7967, 1135, 3679, 6500, 5067, 6230];
                                  const monthIndex = businessMetricsData.months.indexOf(data.month);
                                  const lucroBruto = lucros[monthIndex];
                                  
                                  return (
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                      <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                      <div className="space-y-2">
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Receita Líquida</p>
                                          <p className="text-lg font-bold text-slate-700 dark:text-white">R$ {data.receitaLiquida.toLocaleString('pt-BR')}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Lucro Bruto</p>
                                          <p className="text-lg font-bold text-green-600">R$ {lucroBruto.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Margem</p>
                                          <p className="text-lg font-bold text-red-600">{data.margem.toFixed(2)}%</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                          <p className={`text-lg font-bold ${data.variacaoMesAnt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {data.variacaoMesAnt >= 0 ? '+' : ''}{data.variacaoMesAnt.toFixed(2)}%
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend 
                              verticalAlign="bottom" 
                              height={40}
                              iconType="circle"
                              wrapperStyle={{ paddingTop: '20px' }}
                            />
                            <Bar 
                              yAxisId="left"
                              dataKey="receitaLiquida" 
                              fill="url(#barGradientOrange)"
                              name="Receita Líquida"
                              radius={[8, 8, 0, 0]}
                              barSize={55}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="margem" 
                              stroke="#10b981" 
                              strokeWidth={3}
                              name="Margem %"
                              dot={{ fill: '#10b981', r: 5, strokeWidth: 2, stroke: '#fff' }}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="variacaoMesAnt" 
                              stroke="#f97316" 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              name="Var. Mês Ant. %"
                              dot={{ fill: '#f97316', r: 4, strokeWidth: 2, stroke: '#fff' }}
                            />
                          </ComposedChart>
                        </ChartContainer>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Despesas Financeiras Novos */}
            {showDespesasFinanceirasNovos && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Despesas Financeiras Novos - Análise 2025
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução das despesas financeiras com juros e cartão de crédito
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowDespesasFinanceirasNovos(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico 1: ID18 - Juros Veículos Novos */}
                    {(() => {
                      const jurosData = [332440, 171449, 320580, 364834, 164951, 369484, 347702, 243077, 338504, 312814, 133644, 239803];
                      const totalJuros = jurosData.reduce((a, b) => a + b, 0);
                      const mediaJuros = totalJuros / 12;
                      const ultimoJuros = jurosData[11];
                      const penultimoJuros = jurosData[10];
                      const variacaoJuros = ((ultimoJuros - penultimoJuros) / penultimoJuros) * 100;

                      const jurosChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = jurosData[index];
                        const valorAnterior = index > 0 ? jurosData[index - 1] : valorAtual;
                        const variacao = index > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-red-50 dark:bg-red-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Juros Veículos Novos
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalJuros.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaJuros.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimoJuros.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={jurosChartData} width={1654} height={350}>
                                <defs>
                                  <linearGradient id="barGradientRed" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f87171" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#ef4444" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#dc2626" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Juros</p>
                                              <p className="text-lg font-bold text-red-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientRed)"
                                  name="Juros Veículos Novos"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Gráfico 2: ID25 - Despesas Cartão Novos */}
                    {(() => {
                      const despesasData = [819, 1175, 2448, 1277, 850, 1214, 2530, 1391, 1047, 2352, 1673, 76381];
                      const totalDespesas = despesasData.reduce((a, b) => a + b, 0);
                      const mediaDespesas = totalDespesas / 12;
                      const ultimaDespesa = despesasData[11];
                      const penultimaDespesa = despesasData[10];
                      const variacaoDespesas = ((ultimaDespesa - penultimaDespesa) / penultimaDespesa) * 100;

                      const despesasChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = despesasData[index];
                        const valorAnterior = index > 0 ? despesasData[index - 1] : valorAtual;
                        const variacao = index > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-orange-50 dark:bg-orange-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Despesas Cartão Novos
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalDespesas.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimaDespesa.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={despesasChartData} width={1654} height={350}>
                                <defs>
                                  <linearGradient id="barGradientOrangeDark" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#fb923c" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#f97316" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#ea580c" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Despesa Cartão</p>
                                              <p className="text-lg font-bold text-orange-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientOrangeDark)"
                                  name="Despesas Cartão Novos"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Despesas Financeiras Usados */}
            {showDespesasFinanceirasUsados && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Despesas Financeiras Usados - Análise 2025
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução das despesas financeiras com juros e cartão de crédito
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowDespesasFinanceirasUsados(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico 1: ID19 - Juros Veículos Usados */}
                    {(() => {
                      const jurosData = [40085, 35059, 15811, 12082, 45632, 26790, 30115, 34626, 40943, 35274, 32290, 46203];
                      const totalJuros = jurosData.reduce((a, b) => a + b, 0);
                      const mediaJuros = totalJuros / 12;
                      const ultimoJuros = jurosData[11];
                      const penultimoJuros = jurosData[10];
                      const variacaoJuros = ((ultimoJuros - penultimoJuros) / penultimoJuros) * 100;

                      const jurosChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = jurosData[index];
                        const valorAnterior = index > 0 ? jurosData[index - 1] : valorAtual;
                        const variacao = index > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-purple-50 dark:bg-purple-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Juros Veículos Usados
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalJuros.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaJuros.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimoJuros.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={jurosChartData} width={1654} height={350}>
                                <defs>
                                  <linearGradient id="barGradientPurpleUsados" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#c084fc" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#a855f7" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#9333ea" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Juros</p>
                                              <p className="text-lg font-bold text-purple-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientPurpleUsados)"
                                  name="Juros Veículos Usados"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Gráfico 2: ID26 - Despesas Cartão Usados */}
                    {(() => {
                      const despesasData = [1510, 1015, 1414, 1679, 1112, 2694, 1602, 1137, 1746, 1765, 3793, 100062];
                      const totalDespesas = despesasData.reduce((a, b) => a + b, 0);
                      const mediaDespesas = totalDespesas / 12;
                      const ultimaDespesa = despesasData[11];
                      const penultimaDespesa = despesasData[10];
                      const variacaoDespesas = ((ultimaDespesa - penultimaDespesa) / penultimaDespesa) * 100;

                      const despesasChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = despesasData[index];
                        const valorAnterior = index > 0 ? despesasData[index - 1] : valorAtual;
                        const variacao = index > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-teal-50 dark:bg-teal-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Despesas Cartão Usados
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalDespesas.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimaDespesa.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={despesasChartData} width={1654} height={350}>
                                <defs>
                                  <linearGradient id="barGradientTealUsados" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#5eead4" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#14b8a6" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Despesa Cartão</p>
                                              <p className="text-lg font-bold text-teal-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientTealUsados)"
                                  name="Despesas Cartão Usados"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Despesas Financeiras Peças */}
            {showDespesasFinanceirasPecas && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Despesas Financeiras Peças - Análise 2025
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução das despesas financeiras com juros e cartão de crédito
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowDespesasFinanceirasPecas(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico 1: ID20 - Juros Peças */}
                    {(() => {
                      const jurosData = [27108, 28252, 19131, 17773, 15994, 21702, 46573, 26607, 35907, 34762, 23603, 25691];
                      const totalJuros = jurosData.reduce((a, b) => a + b, 0);
                      const mediaJuros = totalJuros / 12;
                      const ultimoJuros = jurosData[11];

                      const jurosChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = jurosData[index];
                        const valorAnterior = index > 0 ? jurosData[index - 1] : valorAtual;
                        const variacao = index > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-cyan-50 dark:bg-cyan-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Juros Peças
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalJuros.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaJuros.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimoJuros.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={jurosChartData} width={1654} height={350}>
                                <defs>
                                  <linearGradient id="barGradientCyanPecas" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#06b6d4" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#0891b2" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Juros</p>
                                              <p className="text-lg font-bold text-cyan-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientCyanPecas)"
                                  name="Juros Peças"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Gráfico 2: ID27 - Despesas Cartão Peças */}
                    {(() => {
                      const despesasData = [19928, 20177, 23357, 21477, 15082, 23933, 25923, 20052, 22291, 26477, 26153, 127996];
                      const totalDespesas = despesasData.reduce((a, b) => a + b, 0);
                      const mediaDespesas = totalDespesas / 12;
                      const ultimaDespesa = despesasData[11];

                      const despesasChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = despesasData[index];
                        const valorAnterior = index > 0 ? despesasData[index - 1] : valorAtual;
                        const variacao = index > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-amber-50 dark:bg-amber-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Despesas Cartão Peças
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalDespesas.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimaDespesa.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={despesasChartData} width={1654} height={350}>
                                <defs>
                                  <linearGradient id="barGradientAmberPecas" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#d97706" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Despesa Cartão</p>
                                              <p className="text-lg font-bold text-amber-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientAmberPecas)"
                                  name="Despesas Cartão Peças"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Despesas Financeiras Oficina */}
            {showDespesasFinanceirasOficina && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Despesas Financeiras Oficina - Análise 2025
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução das despesas financeiras com cartão de crédito
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowDespesasFinanceirasOficina(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico: ID28 - Despesas Cartão Oficina */}
                    {(() => {
                      const despesasData = [8547, 4551, 7997, 5298, 6248, 5375, 5655, 6596, 4385, 5874, 6048, 27810];
                      const totalDespesas = despesasData.reduce((a, b) => a + b, 0);
                      const mediaDespesas = totalDespesas / 12;
                      const ultimaDespesa = despesasData[11];

                      const despesasChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = despesasData[index];
                        const valorAnterior = index > 0 ? despesasData[index - 1] : valorAtual;
                        const variacao = index > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-emerald-50 dark:bg-emerald-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Despesas Cartão Oficina
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalDespesas.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimaDespesa.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={despesasChartData} width={1654} height={350}>
                                <defs>
                                  <linearGradient id="barGradientEmeraldOficina" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#6ee7b7" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#10b981" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#059669" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Despesa Cartão</p>
                                              <p className="text-lg font-bold text-emerald-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientEmeraldOficina)"
                                  name="Despesas Cartão Oficina"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Despesas Financeiras Funilaria */}
            {showDespesasFinanceirasFunilaria && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Despesas Financeiras Funilaria - Análise 2025
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução das despesas financeiras com cartão de crédito
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowDespesasFinanceirasFunilaria(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico: ID29 - Despesas Cartão Funilaria */}
                    {(() => {
                      const despesasData = [617, 232, 218, 249, 124, 164, 170, 176, 205, 495, 1336, 7027];
                      const totalDespesas = despesasData.reduce((a, b) => a + b, 0);
                      const mediaDespesas = totalDespesas / 12;
                      const ultimaDespesa = despesasData[11];

                      const despesasChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = despesasData[index];
                        const valorAnterior = index > 0 ? despesasData[index - 1] : valorAtual;
                        const variacao = index > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-blue-50 dark:bg-blue-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Despesas Cartão Funilaria
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalDespesas.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimaDespesa.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={despesasChartData} width={1654} height={350}>
                                <defs>
                                  <linearGradient id="barGradientBlueFunilaria" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Despesa Cartão</p>
                                              <p className="text-lg font-bold text-blue-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientBlueFunilaria)"
                                  name="Despesas Cartão Funilaria"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Despesas Financeiras Administração */}
            {showDespesasFinanceirasAdministracao && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Despesas Financeiras Administração - Análise 2025
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução das despesas financeiras com juros e cartão de crédito
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowDespesasFinanceirasAdministracao(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico 1: ID21 - Juros Empréstimos Bancários */}
                    {(() => {
                      const jurosData = [91568, 94176, 103735, 90198, 88808, 91752, 106100, 108962, 24386, 217520, 143888, 155248];
                      const totalJuros = jurosData.reduce((a, b) => a + b, 0);
                      const mediaJuros = totalJuros / 12;
                      const ultimoJuros = jurosData[11];

                      const jurosChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = jurosData[index];
                        const valorAnterior = index > 0 ? jurosData[index - 1] : valorAtual;
                        const variacao = index > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-indigo-50 dark:bg-indigo-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Juros Empréstimos Bancários
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalJuros.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaJuros.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimoJuros.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={jurosChartData} height={350}>
                                <defs>
                                  <linearGradient id="barGradientIndigoAdm1" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#6366f1" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Juros Bancários</p>
                                              <p className="text-lg font-bold text-indigo-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientIndigoAdm1)"
                                  name="Juros Empréstimos Bancários"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Gráfico 2: ID22 - Juros Contrato Mútuo */}
                    {(() => {
                      const jurosData = [73251, 71147, 69017, 66535, 64025, 61702, 59434, 52781, 45714, 37694, 27627, 24805];
                      const totalJuros = jurosData.reduce((a, b) => a + b, 0);
                      const mediaJuros = totalJuros / 12;
                      const ultimoJuros = jurosData[11];

                      const jurosChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = jurosData[index];
                        const valorAnterior = index > 0 ? jurosData[index - 1] : valorAtual;
                        const variacao = index > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-violet-50 dark:bg-violet-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Juros Contrato Mútuo
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalJuros.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaJuros.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimoJuros.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={jurosChartData} height={350}>
                                <defs>
                                  <linearGradient id="barGradientVioletAdm2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Juros Contrato Mútuo</p>
                                              <p className="text-lg font-bold text-violet-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientVioletAdm2)"
                                  name="Juros Contrato Mútuo"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Gráfico 3: ID30 - Despesas Cartão Administração */}
                    {(() => {
                      const despesasData = [4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 42500];
                      const totalDespesas = despesasData.reduce((a, b) => a + b, 0);
                      const mediaDespesas = totalDespesas / 12;
                      const ultimaDespesa = despesasData[11];

                      const despesasChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = despesasData[index];
                        const valorAnterior = index > 0 ? despesasData[index - 1] : valorAtual;
                        const variacao = index > 0 && valorAnterior > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-fuchsia-50 dark:bg-fuchsia-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Despesas Cartão Administração
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalDespesas.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimaDespesa.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={despesasChartData} height={350}>
                                <defs>
                                  <linearGradient id="barGradientFuchsiaAdm3" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#e879f9" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#d946ef" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#c026d3" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Despesa Cartão</p>
                                              <p className="text-lg font-bold text-fuchsia-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientFuchsiaAdm3)"
                                  name="Despesas Cartão Administração"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Bonus Novos */}
            {showBonusNovos && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Bônus Veículos Novos
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução dos valores de bônus recebidos em vendas de veículos novos
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowBonusNovos(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico: ID32 - Bônus Veículos Novos */}
                    {(() => {
                      const bonusData = [414012, 417830, 529741, 424534, 478495, 497389, 565955, 596658, 447332, 440594, 293895, 352135];
                      const totalBonus = bonusData.reduce((a, b) => a + b, 0);
                      const mediaBonus = totalBonus / 12;
                      const ultimoBonus = bonusData[11];

                      const bonusChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = bonusData[index];
                        const valorAnterior = index > 0 ? bonusData[index - 1] : valorAtual;
                        const variacao = index > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-green-50 dark:bg-green-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Bônus Veículos Novos
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalBonus.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaBonus.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimoBonus.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={bonusChartData} height={350}>
                                <defs>
                                  <linearGradient id="barGradientGreenBonus" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#4ade80" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#22c55e" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Bônus</p>
                                              <p className="text-lg font-bold text-green-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientGreenBonus)"
                                  name="Bônus Veículos Novos"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Bonus Usados */}
            {showBonusUsados && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Bônus Veículos Usados
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução dos valores de bônus recebidos em vendas de veículos usados
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowBonusUsados(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico: ID33 - Bônus Veículos Usados */}
                    {(() => {
                      const bonusData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
                      const totalBonus = bonusData.reduce((a, b) => a + b, 0);
                      const mediaBonus = totalBonus / 12;
                      const ultimoBonus = bonusData[11];

                      const bonusChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = bonusData[index];
                        const valorAnterior = index > 0 ? bonusData[index - 1] : valorAtual;
                        const variacao = index > 0 && valorAnterior > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-lime-50 dark:bg-lime-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Bônus Veículos Usados
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalBonus.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaBonus.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimoBonus.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={bonusChartData} height={350}>
                                <defs>
                                  <linearGradient id="barGradientLimeBonus" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#a3e635" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#84cc16" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#65a30d" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Bônus</p>
                                              <p className="text-lg font-bold text-lime-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientLimeBonus)"
                                  name="Bônus Veículos Usados"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Bonus Peças */}
            {showBonusPecas && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Bônus Peças
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução dos valores de bônus recebidos em vendas de peças
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowBonusPecas(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico: ID34 - Bônus Peças */}
                    {(() => {
                      const bonusData = [400000, 500000, 700000, 250000, 380000, 400000, 600000, 800000, 280000, 350000, 420000, 580000];
                      const totalBonus = bonusData.reduce((a, b) => a + b, 0);
                      const mediaBonus = totalBonus / 12;
                      const ultimoBonus = bonusData[11];

                      const bonusChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = bonusData[index];
                        const valorAnterior = index > 0 ? bonusData[index - 1] : valorAtual;
                        const variacao = index > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Bônus Peças
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalBonus.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaBonus.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimoBonus.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={bonusChartData} height={350}>
                                <defs>
                                  <linearGradient id="barGradientYellowBonus" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#facc15" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#eab308" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#ca8a04" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Bônus</p>
                                              <p className="text-lg font-bold text-yellow-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientYellowBonus)"
                                  name="Bônus Peças"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Bonus Oficina */}
            {showBonusOficina && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Bônus Oficina
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução dos valores de bônus recebidos em oficina
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowBonusOficina(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico: ID35 - Bônus Oficina */}
                    {(() => {
                      const bonusData = [100000, 200000, 180000, 190000, 70000, 0, 80000, 90000, 0, 50000, 75000, 118800];
                      const totalBonus = bonusData.reduce((a, b) => a + b, 0);
                      const mediaBonus = totalBonus / 12;
                      const ultimoBonus = bonusData[11];

                      const bonusChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = bonusData[index];
                        const valorAnterior = index > 0 ? bonusData[index - 1] : valorAtual;
                        const variacao = index > 0 && valorAnterior > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-orange-50 dark:bg-orange-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Bônus Oficina
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalBonus.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaBonus.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimoBonus.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={bonusChartData} height={350}>
                                <defs>
                                  <linearGradient id="barGradientOrangeBonus" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#fb923c" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#f97316" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#ea580c" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Bônus</p>
                                              <p className="text-lg font-bold text-orange-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientOrangeBonus)"
                                  name="Bônus Oficina"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Bonus Funilaria */}
            {showBonusFunilaria && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Bônus Funilaria
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução dos valores de bônus recebidos em funilaria
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowBonusFunilaria(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico: ID35 - Bônus Funilaria */}
                    {(() => {
                      const bonusData = businessMetricsData.bonus.funilaria;
                      const totalBonus = bonusData.reduce((a, b) => a + b, 0);
                      const mediaBonus = totalBonus / 12;
                      const ultimoBonus = bonusData[11];

                      const bonusChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = bonusData[index];
                        const valorAnterior = index > 0 ? bonusData[index - 1] : valorAtual;
                        const variacao = index > 0 && valorAnterior > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-pink-50 dark:bg-pink-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Bônus Funilaria
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalBonus.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaBonus.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimoBonus.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={bonusChartData} height={350}>
                                <defs>
                                  <linearGradient id="barGradientPinkBonus" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f9a8d4" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#ec4899" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#db2777" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Bônus</p>
                                              <p className="text-lg font-bold text-pink-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientPinkBonus)"
                                  name="Bônus Funilaria"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Bonus Administração */}
            {showBonusAdministracao && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Bônus Administração
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução dos valores de bônus recebidos em administração
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowBonusAdministracao(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico: ID36 - Bônus Administração */}
                    {(() => {
                      const bonusData = businessMetricsData.bonus.administracao;
                      const totalBonus = bonusData.reduce((a, b) => a + b, 0);
                      const mediaBonus = totalBonus / 12;
                      const ultimoBonus = bonusData[11];

                      const bonusChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = bonusData[index];
                        const valorAnterior = index > 0 ? bonusData[index - 1] : valorAtual;
                        const variacao = index > 0 && valorAnterior > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-purple-50 dark:bg-purple-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Bônus Administração
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalBonus.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaBonus.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimoBonus.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={bonusChartData} height={350}>
                                <defs>
                                  <linearGradient id="barGradientPurpleBonus" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#c084fc" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#a855f7" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#9333ea" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Bônus</p>
                                              <p className="text-lg font-bold text-purple-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientPurpleBonus)"
                                  name="Bônus Administração"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Receita de Financiamento Novos */}
            {showReceitaFinanciamentoNovos && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Receita de Financiamento Novos
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução das receitas de financiamento de veículos novos
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowReceitaFinanciamentoNovos(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico: ID37 - Receita Financiamento Novos */}
                    {(() => {
                      const receitaData = businessMetricsData.receitasFinanciamento.veiculosNovos;
                      const totalReceita = receitaData.reduce((a, b) => a + b, 0);
                      const mediaReceita = totalReceita / 12;
                      const ultimaReceita = receitaData[11];

                      const receitaChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = receitaData[index];
                        const valorAnterior = index > 0 ? receitaData[index - 1] : valorAtual;
                        const variacao = index > 0 && valorAnterior > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-teal-50 dark:bg-teal-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Receita de Financiamento Novos
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalReceita.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaReceita.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimaReceita.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={receitaChartData} height={350}>
                                <defs>
                                  <linearGradient id="barGradientTealReceita" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#5eead4" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#14b8a6" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#0f766e" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Receita</p>
                                              <p className="text-lg font-bold text-teal-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientTealReceita)"
                                  name="Receita Financiamento Novos"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Crédito ICMS Peças */}
            {showCreditoICMSPecas && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Crédito de ICMS Peças
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução dos créditos de ICMS em peças
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowCreditoICMSPecas(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico: ID41 - Crédito ICMS Peças */}
                    {(() => {
                      const creditoData = businessMetricsData.creditosICMS.pecas;
                      const totalCredito = creditoData.reduce((a, b) => a + b, 0);
                      const mediaCredito = totalCredito / 12;
                      const ultimoCredito = creditoData[11];

                      const creditoChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = creditoData[index];
                        const valorAnterior = index > 0 ? creditoData[index - 1] : valorAtual;
                        const variacao = index > 0 && valorAnterior > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-pink-50 dark:bg-pink-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Crédito de ICMS Peças
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalCredito.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaCredito.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimoCredito.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={creditoChartData} height={350}>
                                <defs>
                                  <linearGradient id="barGradientPinkCredito" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#fbcfe8" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#ec4899" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#db2777" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Crédito ICMS</p>
                                              <p className="text-lg font-bold text-pink-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientPinkCredito)"
                                  name="Crédito ICMS Peças"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#ec4899" 
                                  strokeWidth={3}
                                  dot={{ fill: '#ec4899', r: 5 }}
                                  name="Variação vs Mês Anterior (%)"
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Crédito ICMS Administração */}
            {showCreditoICMSAdministracao && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Crédito de ICMS Administração
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução dos créditos de ICMS em administração
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowCreditoICMSAdministracao(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico: ID42 - Crédito ICMS Administração */}
                    {(() => {
                      const creditoData = businessMetricsData.creditosICMS.administracao;
                      const totalCredito = creditoData.reduce((a, b) => a + b, 0);
                      const mediaCredito = totalCredito / 12;
                      const ultimoCredito = creditoData[11];

                      const creditoChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = creditoData[index];
                        const valorAnterior = index > 0 ? creditoData[index - 1] : valorAtual;
                        const variacao = index > 0 && valorAnterior > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-violet-50 dark:bg-violet-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Crédito de ICMS Administração
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalCredito.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaCredito.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimoCredito.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={creditoChartData} height={350}>
                                <defs>
                                  <linearGradient id="barGradientVioletCredito" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ddd6fe" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Crédito ICMS</p>
                                              <p className="text-lg font-bold text-violet-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientVioletCredito)"
                                  name="Crédito ICMS Administração"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  dot={{ fill: '#8b5cf6', r: 5 }}
                                  name="Variação vs Mês Anterior (%)"
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Crédito PIS e Cofins Administração */}
            {showCreditoPISCofinsAdministracao && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Crédito de PIS e Cofins Administração
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução dos créditos de PIS e Cofins em administração
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowCreditoPISCofinsAdministracao(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico: ID43 - Crédito PIS e Cofins Administração */}
                    {(() => {
                      const creditoData = businessMetricsData.creditosPISCOFINS.administracao;
                      const totalCredito = creditoData.reduce((a, b) => a + b, 0);
                      const mediaCredito = totalCredito / 12;
                      const ultimoCredito = creditoData[11];

                      const creditoChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = creditoData[index];
                        const valorAnterior = index > 0 ? creditoData[index - 1] : valorAtual;
                        const variacao = index > 0 && valorAnterior > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-amber-50 dark:bg-amber-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Crédito de PIS e Cofins Administração
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalCredito.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaCredito.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimoCredito.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={creditoChartData} height={350}>
                                <defs>
                                  <linearGradient id="barGradientAmberCredito" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#fef3c7" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#d97706" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Crédito PIS/Cofins</p>
                                              <p className="text-lg font-bold text-amber-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientAmberCredito)"
                                  name="Crédito PIS/Cofins Administração"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#f59e0b" 
                                  strokeWidth={3}
                                  dot={{ fill: '#f59e0b', r: 5 }}
                                  name="Variação vs Mês Anterior (%)"
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Crédito ICMS Novos */}
            {showCreditoICMSNovos && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Crédito de ICMS Novos
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução dos créditos de ICMS em veículos novos
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowCreditoICMSNovos(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico: ID40 - Crédito ICMS Novos */}
                    {(() => {
                      const creditoData = businessMetricsData.creditosICMS.novos;
                      const totalCredito = creditoData.reduce((a, b) => a + b, 0);
                      const mediaCredito = totalCredito / 12;
                      const ultimoCredito = creditoData[11];

                      const creditoChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = creditoData[index];
                        const valorAnterior = index > 0 ? creditoData[index - 1] : valorAtual;
                        const variacao = index > 0 && valorAnterior > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-emerald-50 dark:bg-emerald-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Crédito de ICMS Novos
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalCredito.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaCredito.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimoCredito.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={creditoChartData} height={350}>
                                <defs>
                                  <linearGradient id="barGradientEmeraldCredito" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#6ee7b7" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#10b981" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#059669" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Crédito ICMS</p>
                                              <p className="text-lg font-bold text-emerald-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientEmeraldCredito)"
                                  name="Crédito ICMS Novos"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#10b981" 
                                  strokeWidth={3}
                                  dot={{ fill: '#10b981', r: 5 }}
                                  name="Variação vs Mês Anterior (%)"
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Receita de Financiamento Usados */}
            {showReceitaFinanciamentoUsados && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Receita de Financiamento Usados
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução das receitas de financiamento de veículos usados
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowReceitaFinanciamentoUsados(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    
                    {/* Gráfico: ID38 - Receita Financiamento Usados */}
                    {(() => {
                      const receitaData = businessMetricsData.receitasFinanciamento.veiculosUsados;
                      const totalReceita = receitaData.reduce((a, b) => a + b, 0);
                      const mediaReceita = totalReceita / 12;
                      const ultimaReceita = receitaData[11];

                      const receitaChartData = businessMetricsData.months.map((month, index) => {
                        const valorAtual = receitaData[index];
                        const valorAnterior = index > 0 ? receitaData[index - 1] : valorAtual;
                        const variacao = index > 0 && valorAnterior > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
                        
                        return {
                          month,
                          valor: valorAtual,
                          variacao: variacao
                        };
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg w-full overflow-hidden">
                          <div className="bg-cyan-50 dark:bg-cyan-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              Receita de Financiamento Usados
                            </h3>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Total Anual</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {totalReceita.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Média Mensal</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {mediaReceita.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dezembro/25</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                  R$ {ultimaReceita.toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            <ChartContainer config={{}} className="h-[350px] w-full">
                              <ComposedChart data={receitaChartData} height={350}>
                                <defs>
                                  <linearGradient id="barGradientCyanReceita" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.9}/>
                                    <stop offset="50%" stopColor="#06b6d4" stopOpacity={0.8}/>
                                    <stop offset="100%" stopColor="#0891b2" stopOpacity={0.7}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={{ stroke: '#e2e8f0' }}
                                  tickLine={false}
                                />
                                <YAxis 
                                  yAxisId="left"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                  label={{ value: 'Valor em R$', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <YAxis 
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: '#64748b', fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${value}%`}
                                  label={{ value: 'Var. Mês Ant. (%)', angle: 90, position: 'insideRight', fill: '#64748b', style: { fontSize: 11 } }}
                                />
                                <ChartTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
                                          <p className="font-bold text-slate-900 dark:text-white mb-3">{data.month}</p>
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Receita</p>
                                              <p className="text-lg font-bold text-cyan-600">R$ {data.valor.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">Var. Mês Ant.</p>
                                              <p className={`text-lg font-bold ${data.variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {data.variacao >= 0 ? '+' : ''}{data.variacao.toFixed(2)}%
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend 
                                  verticalAlign="bottom" 
                                  height={40}
                                  iconType="circle"
                                  wrapperStyle={{ paddingTop: '20px' }}
                                />
                                <Bar 
                                  yAxisId="left"
                                  dataKey="valor" 
                                  fill="url(#barGradientCyanReceita)"
                                  name="Receita Financiamento Usados"
                                  radius={[8, 8, 0, 0]}
                                  barSize={55}
                                />
                                <Line 
                                  yAxisId="right"
                                  type="monotone" 
                                  dataKey="variacao" 
                                  stroke="#8b5cf6" 
                                  strokeWidth={3}
                                  name="Var. Mês Ant. %"
                                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                />
                              </ComposedChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de % de Trocas - Análise de Conversão */}
            {showTrocasChart && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Volume de Troca - Análise de Conversão 2025
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Evolução mensal dos percentuais de trocas em vendas de veículos novos, VD e usados
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowTrocasChart(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 max-w-full">
                    {/* Gráfico 1: % de Trocas Novos */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg w-full">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                      ID 1 - % de Trocas em Veículos Novos
                    </h3>
                    <ChartContainer config={{}} className="h-[300px] w-full">
                      <ComposedChart data={businessMetricsData.months.map((month, index) => ({
                        month,
                        vendas: businessMetricsData.vendasNovos.vendas[index],
                        trocas: businessMetricsData.vendasNovos.volumeTrocas[index],
                        percentual: businessMetricsData.vendasNovos.percentualTrocas[index]
                      }))} width={1654} height={300}>
                          <XAxis 
                            dataKey="month" 
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: '#cbd5e1' }}
                          />
                          <YAxis 
                            yAxisId="left"
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: '#cbd5e1' }}
                            label={{ value: 'Volume', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                          />
                          <YAxis 
                            yAxisId="right"
                            orientation="right"
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: '#cbd5e1' }}
                            tickFormatter={(value) => `${value}%`}
                            label={{ value: '% de Trocas', angle: 90, position: 'insideRight', fill: '#64748b' }}
                          />
                          <ChartTooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                                    <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.month}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">TOTAL DE VENDAS</p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">{payload[0].payload.vendas}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">VENDAS COM TROCA</p>
                                    <p className="text-xl font-bold text-teal-600 mb-2">{payload[0].payload.trocas}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">% DE TROCAS</p>
                                    <p className="text-xl font-bold text-emerald-600">{payload[0].payload.percentual.toFixed(2)}%</p>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            height={36}
                            iconType="circle"
                            wrapperStyle={{ paddingTop: '20px' }}
                          />
                          <Bar 
                            yAxisId="left"
                            dataKey="vendas" 
                            fill="#0f172a" 
                            name="Vendas"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar 
                            yAxisId="left"
                            dataKey="trocas" 
                            fill="#14b8a6" 
                            name="Trocas"
                            radius={[4, 4, 0, 0]}
                          />
                          <Line 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="percentual" 
                            stroke="#f97316" 
                            strokeWidth={3}
                            name="% Troca"
                            dot={{ fill: '#f97316', r: 4 }}
                          />
                        </ComposedChart>
                    </ChartContainer>
                    </div>

                    {/* Gráfico 2: % de Trocas VD */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg w-full">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                      ID 2 - % de Trocas em Veículos Novos VD
                    </h3>
                    <ChartContainer config={{}} className="h-[300px] w-full">
                      <ComposedChart data={businessMetricsData.months.map((month, index) => ({
                        month,
                        vendas: businessMetricsData.vendasNovosVD.vendas[index],
                        trocas: businessMetricsData.vendasNovosVD.volumeTrocas[index],
                        percentual: businessMetricsData.vendasNovosVD.percentualTrocas[index]
                      }))} width={1654} height={300}>
                          <XAxis 
                            dataKey="month" 
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: '#cbd5e1' }}
                          />
                          <YAxis 
                            yAxisId="left"
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: '#cbd5e1' }}
                            label={{ value: 'Volume', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                          />
                          <YAxis 
                            yAxisId="right"
                            orientation="right"
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: '#cbd5e1' }}
                            tickFormatter={(value) => `${value}%`}
                            label={{ value: '% de Trocas', angle: 90, position: 'insideRight', fill: '#64748b' }}
                          />
                          <ChartTooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                                    <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.month}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">TOTAL DE VENDAS</p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">{payload[0].payload.vendas}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">VENDAS COM TROCA</p>
                                    <p className="text-xl font-bold text-teal-600 mb-2">{payload[0].payload.trocas}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">% DE TROCAS</p>
                                    <p className="text-xl font-bold text-emerald-600">{payload[0].payload.percentual.toFixed(2)}%</p>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            height={36}
                            iconType="circle"
                            wrapperStyle={{ paddingTop: '20px' }}
                          />
                          <Bar 
                            yAxisId="left"
                            dataKey="vendas" 
                            fill="#0ea5e9" 
                            name="Vendas"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar 
                            yAxisId="left"
                            dataKey="trocas" 
                            fill="#f59e0b" 
                            name="Trocas"
                            radius={[4, 4, 0, 0]}
                          />
                          <Line 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="percentual" 
                            stroke="#ec4899" 
                            strokeWidth={3}
                            name="% Troca"
                            dot={{ fill: '#ec4899', r: 4 }}
                          />
                        </ComposedChart>
                    </ChartContainer>
                    </div>

                    {/* Gráfico 3: % de Trocas Usados */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg w-full">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                        ID 3 - % de Trocas em Veículos Usados
                      </h3>
                      <ChartContainer config={{}} className="h-[300px] w-full">
                        <ComposedChart data={businessMetricsData.months.map((month, index) => ({
                          month,
                          vendas: businessMetricsData.vendasUsados.vendas[index],
                          trocas: businessMetricsData.vendasUsados.volumeTrocas[index],
                          percentual: businessMetricsData.vendasUsados.percentualTrocas[index]
                        }))} width={1654} height={300}>
                            <XAxis 
                              dataKey="month" 
                              tick={{ fill: '#64748b', fontSize: 12 }}
                              axisLine={{ stroke: '#cbd5e1' }}
                            />
                            <YAxis 
                              yAxisId="left"
                              tick={{ fill: '#64748b', fontSize: 12 }}
                              axisLine={{ stroke: '#cbd5e1' }}
                              label={{ value: 'Volume', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              tick={{ fill: '#64748b', fontSize: 12 }}
                              axisLine={{ stroke: '#cbd5e1' }}
                              tickFormatter={(value) => `${value}%`}
                              label={{ value: '% de Trocas', angle: 90, position: 'insideRight', fill: '#64748b' }}
                            />
                            <ChartTooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                                      <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.month}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">TOTAL DE VENDAS</p>
                                      <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">{payload[0].payload.vendas}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">VENDAS COM TROCA</p>
                                      <p className="text-xl font-bold text-teal-600 mb-2">{payload[0].payload.trocas}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">% DE TROCAS</p>
                                      <p className="text-xl font-bold text-emerald-600">{payload[0].payload.percentual.toFixed(2)}%</p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Legend 
                              verticalAlign="bottom" 
                              height={36}
                              iconType="circle"
                              wrapperStyle={{ paddingTop: '20px' }}
                            />
                            <Bar 
                              yAxisId="left"
                              dataKey="vendas" 
                              fill="#d97706" 
                              name="Vendas"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar 
                              yAxisId="left"
                              dataKey="trocas" 
                              fill="#8b5cf6" 
                              name="Trocas"
                              radius={[4, 4, 0, 0]}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="percentual" 
                              stroke="#14b8a6" 
                              strokeWidth={3}
                              name="% Troca"
                              dot={{ fill: '#14b8a6', r: 4 }}
                            />
                          </ComposedChart>
                      </ChartContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          
            {/* Card de Estoque de Novos */}
            {showEstoqueNovos && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Evolução do Estoque de Novos
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Análise temporal com variação mensal
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowEstoqueNovos(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const mesAtual = businessMetricsData.months[11]; // dezembro
                    const estoqueAtual = businessMetricsData.estoqueNovos.valor[11];
                    const aPagarAtual = businessMetricsData.estoqueNovos.aPagar[11];
                    const pagoAtual = businessMetricsData.estoqueNovos.pagos[11];
                    
                    // Calcular médias anuais
                    const mediaEstoque = businessMetricsData.estoqueNovos.valor.reduce((a, b) => a + b, 0) / 12;
                    const mediaAPagar = businessMetricsData.estoqueNovos.aPagar.reduce((a, b) => a + b, 0) / 12;
                    const mediaPago = businessMetricsData.estoqueNovos.pagos.reduce((a, b) => a + b, 0) / 12;
                    const percentualAPagar = (aPagarAtual / estoqueAtual) * 100;
                    const percentualPago = (pagoAtual / estoqueAtual) * 100;

                    // Preparar dados para o gráfico com variação mês anterior
                    const estoqueChartData = businessMetricsData.months.map((month, index) => {
                      const valorAtual = businessMetricsData.estoqueNovos.valor[index];
                      const valorAnterior = index > 0 ? businessMetricsData.estoqueNovos.valor[index - 1] : valorAtual;
                      const variacao = ((valorAtual - valorAnterior) / valorAnterior) * 100;

                      return {
                        month,
                        aPagar: businessMetricsData.estoqueNovos.aPagar[index],
                        pago: businessMetricsData.estoqueNovos.pagos[index],
                        variacao: index === 0 ? 0 : variacao
                      };
                    });

                    return (
                      <>
                        {/* Cards de Resumo */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Estoque Atual</p>
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">R$ {(estoqueAtual ).toLocaleString("pt-BR")}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{mesAtual}</p>
                          </div>
                          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">A Pagar Atual</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">R$ {(aPagarAtual ).toLocaleString("pt-BR")}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{mesAtual}</p>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Pago Atual</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">R$ {(pagoAtual ).toLocaleString("pt-BR")}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{mesAtual}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Média % A Pagar</p>
                            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{percentualAPagar.toFixed(2)}%</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">12 meses</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Média % Pago</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{percentualPago.toFixed(2)}%</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">12 meses</p>
                          </div>
                        </div>

                        {/* Gráfico */}
                        <ChartContainer config={{}} className="h-[400px] w-full">
                          <ComposedChart data={estoqueChartData} >
                            <XAxis 
                              dataKey="month" 
                              tick={{ fill: '#64748b', fontSize: 12 }}
                              axisLine={{ stroke: '#cbd5e1' }}
                            />
                            <YAxis 
                              yAxisId="left"
                              tick={{ fill: '#64748b', fontSize: 12 }}
                              axisLine={{ stroke: '#cbd5e1' }}
                              tickFormatter={(value) => `R$ ${(value / 1000000).toFixed(0)}M`}
                              label={{ value: '$', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              tick={{ fill: '#64748b', fontSize: 12 }}
                              axisLine={{ stroke: '#cbd5e1' }}
                              tickFormatter={(value) => `${value}%`}
                              label={{ value: 'Var. Mês Anterior (%)', angle: 90, position: 'insideRight', fill: '#64748b' }}
                              domain={[-35, 105]}
                            />
                            <ChartTooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const aPagar = payload[0]?.value || 0;
                                  const pago = payload[1]?.value || 0;
                                  const total = Number(aPagar) + Number(pago);
                                  const variacao = payload[2]?.value || 0;
                                  return (
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                                      <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.month}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">ESTOQUE TOTAL</p>
                                      <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(total)}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">ESTOQUE A PAGAR</p>
                                      <p className="text-xl font-bold text-orange-600 mb-2">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(Number(aPagar))}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">ESTOQUE PAGO</p>
                                      <p className="text-xl font-bold text-green-600 mb-2">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(Number(pago))}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">VAR. MÊS ANTERIOR</p>
                                      <p className="text-xl font-bold text-purple-600">{Number(variacao).toFixed(2)}%</p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Legend 
                              verticalAlign="bottom" 
                              height={36}
                              iconType="circle"
                              wrapperStyle={{ paddingTop: '20px' }}
                            />
                            <Bar 
                              yAxisId="left"
                              dataKey="aPagar" 
                              fill="#fb923c" 
                              name="Estoque A Pagar"
                              stackId="stack"
                              radius={[0, 0, 0, 0]}
                            />
                            <Bar 
                              yAxisId="left"
                              dataKey="pago" 
                              fill="#22c55e" 
                              name="Estoque Pago"
                              stackId="stack"
                              radius={[4, 4, 0, 0]}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="variacao" 
                              stroke="#8b5cf6" 
                              strokeWidth={3}
                              name="Var. Mês Anterior (%)"
                              dot={{ fill: '#8b5cf6', r: 4 }}
                            />
                          </ComposedChart>
                        </ChartContainer>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Card de Estoque de Usados */}
            {showEstoqueUsados && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Evolução do Estoque de Usados
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Análise temporal com variação mensal
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowEstoqueUsados(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const mesAtual = businessMetricsData.months[11]; // dezembro
                    const estoqueAtual = businessMetricsData.estoqueUsados.valor[11];
                    const aPagarAtual = businessMetricsData.estoqueUsados.aPagar[11];
                    const pagoAtual = businessMetricsData.estoqueUsados.pagos[11];
                    
                    // Calcular médias anuais
                    const mediaEstoque = businessMetricsData.estoqueUsados.valor.reduce((a, b) => a + b, 0) / 12;
                    const mediaAPagar = businessMetricsData.estoqueUsados.aPagar.reduce((a, b) => a + b, 0) / 12;
                    const mediaPago = businessMetricsData.estoqueUsados.pagos.reduce((a, b) => a + b, 0) / 12;
                    const percentualAPagar = (aPagarAtual / estoqueAtual) * 100;
                    const percentualPago = (pagoAtual / estoqueAtual) * 100;

                    // Preparar dados para o gráfico com variação mês anterior
                    const estoqueChartData = businessMetricsData.months.map((month, index) => {
                      const valorAtual = businessMetricsData.estoqueUsados.valor[index];
                      const valorAnterior = index > 0 ? businessMetricsData.estoqueUsados.valor[index - 1] : valorAtual;
                      const variacao = ((valorAtual - valorAnterior) / valorAnterior) * 100;

                      return {
                        month,
                        aPagar: businessMetricsData.estoqueUsados.aPagar[index],
                        pago: businessMetricsData.estoqueUsados.pagos[index],
                        variacao: index === 0 ? 0 : variacao
                      };
                    });

                    return (
                      <>
                        {/* Cards de Resumo */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Estoque Atual</p>
                            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">R$ {(estoqueAtual ).toLocaleString("pt-BR")}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{mesAtual}</p>
                          </div>
                          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">A Pagar Atual</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">R$ {(aPagarAtual ).toLocaleString("pt-BR")}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{mesAtual}</p>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Pago Atual</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">R$ {(pagoAtual ).toLocaleString("pt-BR")}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{mesAtual}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Média % A Pagar</p>
                            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{percentualAPagar.toFixed(2)}%</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">12 meses</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Média % Pago</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{percentualPago.toFixed(2)}%</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">12 meses</p>
                          </div>
                        </div>

                        {/* Gráfico */}
                        <ChartContainer config={{}} className="h-[400px] w-full">
                          <ComposedChart data={estoqueChartData} >
                            <XAxis 
                              dataKey="month" 
                              tick={{ fill: '#64748b', fontSize: 12 }}
                              axisLine={{ stroke: '#cbd5e1' }}
                            />
                            <YAxis 
                              yAxisId="left"
                              tick={{ fill: '#64748b', fontSize: 12 }}
                              axisLine={{ stroke: '#cbd5e1' }}
                              tickFormatter={(value) => `R$ ${(value / 1000000).toFixed(0)}M`}
                              label={{ value: '$', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              tick={{ fill: '#64748b', fontSize: 12 }}
                              axisLine={{ stroke: '#cbd5e1' }}
                              tickFormatter={(value) => `${value}%`}
                              label={{ value: 'Var. Mês Anterior (%)', angle: 90, position: 'insideRight', fill: '#64748b' }}
                              domain={[-35, 105]}
                            />
                            <ChartTooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const aPagar = payload[0]?.value || 0;
                                  const pago = payload[1]?.value || 0;
                                  const total = Number(aPagar) + Number(pago);
                                  const variacao = payload[2]?.value || 0;
                                  return (
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                                      <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.month}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">ESTOQUE TOTAL</p>
                                      <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(total)}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">ESTOQUE A PAGAR</p>
                                      <p className="text-xl font-bold text-orange-600 mb-2">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(Number(aPagar))}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">ESTOQUE PAGO</p>
                                      <p className="text-xl font-bold text-green-600 mb-2">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(Number(pago))}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">VAR. MÊS ANTERIOR</p>
                                      <p className="text-xl font-bold text-purple-600">{Number(variacao).toFixed(2)}%</p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Legend 
                              verticalAlign="bottom" 
                              height={36}
                              iconType="circle"
                              wrapperStyle={{ paddingTop: '20px' }}
                            />
                            <Bar 
                              yAxisId="left"
                              dataKey="aPagar" 
                              fill="#fb923c" 
                              name="Estoque A Pagar"
                              stackId="stack"
                              radius={[0, 0, 0, 0]}
                            />
                            <Bar 
                              yAxisId="left"
                              dataKey="pago" 
                              fill="#22c55e" 
                              name="Estoque Pago"
                              stackId="stack"
                              radius={[4, 4, 0, 0]}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="variacao" 
                              stroke="#8b5cf6" 
                              strokeWidth={3}
                              name="Var. Mês Anterior (%)"
                              dot={{ fill: '#8b5cf6', r: 4 }}
                            />
                          </ComposedChart>
                        </ChartContainer>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Card de Estoque de Peças */}
            {showEstoquePecas && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Evolução do Estoque de Peças
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Análise temporal com variação mensal
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowEstoquePecas(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const mesAtual = businessMetricsData.months[11]; // dezembro
                    const estoqueAtual = businessMetricsData.estoquePecas.valor[11];
                    const aPagarAtual = businessMetricsData.estoquePecas.aPagar[11];
                    const pagoAtual = businessMetricsData.estoquePecas.pagos[11];
                    
                    // Calcular médias anuais
                    const mediaEstoque = businessMetricsData.estoquePecas.valor.reduce((a, b) => a + b, 0) / 12;
                    const mediaAPagar = businessMetricsData.estoquePecas.aPagar.reduce((a, b) => a + b, 0) / 12;
                    const mediaPago = businessMetricsData.estoquePecas.pagos.reduce((a, b) => a + b, 0) / 12;
                    const percentualAPagar = (aPagarAtual / estoqueAtual) * 100;
                    const percentualPago = (pagoAtual / estoqueAtual) * 100;

                    // Preparar dados para o gráfico com variação mês anterior
                    const estoqueChartData = businessMetricsData.months.map((month, index) => {
                      const valorAtual = businessMetricsData.estoquePecas.valor[index];
                      const valorAnterior = index > 0 ? businessMetricsData.estoquePecas.valor[index - 1] : valorAtual;
                      const variacao = ((valorAtual - valorAnterior) / valorAnterior) * 100;

                      return {
                        month,
                        aPagar: businessMetricsData.estoquePecas.aPagar[index],
                        pago: businessMetricsData.estoquePecas.pagos[index],
                        variacao: index === 0 ? 0 : variacao
                      };
                    });

                    return (
                      <>
                        {/* Cards de Resumo */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                          <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg border border-teal-200 dark:border-teal-800">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Estoque Atual</p>
                            <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">R$ {(estoqueAtual ).toLocaleString("pt-BR")}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{mesAtual}</p>
                          </div>
                          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">A Pagar Atual</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">R$ {(aPagarAtual ).toLocaleString("pt-BR")}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{mesAtual}</p>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Pago Atual</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">R$ {(pagoAtual ).toLocaleString("pt-BR")}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{mesAtual}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Média % A Pagar</p>
                            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{percentualAPagar.toFixed(2)}%</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">12 meses</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Média % Pago</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{percentualPago.toFixed(2)}%</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">12 meses</p>
                          </div>
                        </div>

                        {/* Gráfico */}
                        <ChartContainer config={{}} className="h-[400px] w-full">
                          <ComposedChart data={estoqueChartData} >
                            <XAxis 
                              dataKey="month" 
                              tick={{ fill: '#64748b', fontSize: 12 }}
                              axisLine={{ stroke: '#cbd5e1' }}
                            />
                            <YAxis 
                              yAxisId="left"
                              tick={{ fill: '#64748b', fontSize: 12 }}
                              axisLine={{ stroke: '#cbd5e1' }}
                              tickFormatter={(value) => `R$ ${(value / 1000000).toFixed(0)}M`}
                              label={{ value: '$', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              tick={{ fill: '#64748b', fontSize: 12 }}
                              axisLine={{ stroke: '#cbd5e1' }}
                              tickFormatter={(value) => `${value}%`}
                              label={{ value: 'Var. Mês Anterior (%)', angle: 90, position: 'insideRight', fill: '#64748b' }}
                              domain={[-35, 105]}
                            />
                            <ChartTooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const aPagar = payload[0]?.value || 0;
                                  const pago = payload[1]?.value || 0;
                                  const total = Number(aPagar) + Number(pago);
                                  const variacao = payload[2]?.value || 0;
                                  return (
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                                      <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.month}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">ESTOQUE TOTAL</p>
                                      <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(total)}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">ESTOQUE A PAGAR</p>
                                      <p className="text-xl font-bold text-orange-600 mb-2">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(Number(aPagar))}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">ESTOQUE PAGO</p>
                                      <p className="text-xl font-bold text-green-600 mb-2">R$ {new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(Number(pago))}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">VAR. MÊS ANTERIOR</p>
                                      <p className="text-xl font-bold text-purple-600">{Number(variacao).toFixed(2)}%</p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Legend 
                              verticalAlign="bottom" 
                              height={36}
                              iconType="circle"
                              wrapperStyle={{ paddingTop: '20px' }}
                            />
                            <Bar 
                              yAxisId="left"
                              dataKey="aPagar" 
                              fill="#fb923c" 
                              name="Estoque A Pagar"
                              stackId="stack"
                              radius={[0, 0, 0, 0]}
                            />
                            <Bar 
                              yAxisId="left"
                              dataKey="pago" 
                              fill="#22c55e" 
                              name="Estoque Pago"
                              stackId="stack"
                              radius={[4, 4, 0, 0]}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="variacao" 
                              stroke="#8b5cf6" 
                              strokeWidth={3}
                              name="Var. Mês Anterior (%)"
                              dot={{ fill: '#8b5cf6', r: 4 }}
                            />
                          </ComposedChart>
                        </ChartContainer>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Card de % de Vendas de Repasse */}
            {showRepasseChart && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Porcentagem de Vendas de Repasse 2025
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Análise mensal do percentual de vendas de repasse em relação ao volume total
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setShowRepasseChart(false)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Calcular totais e média
                    const totalVendas = businessMetricsData.volumeVendas.usados.reduce((a, b) => a + b, 0);
                    const totalRepasse = businessMetricsData.volumeVendas.repasse.reduce((a, b) => a + b, 0);
                    const mediaPercentual = (totalRepasse / totalVendas) * 100;

                    // Preparar dados para o gráfico com cores condicionais
                    const repasseChartData = businessMetricsData.months.map((month, index) => {
                      const percentual = businessMetricsData.volumeVendas.percentualRepasse[index];
                      const limiteVariacao = mediaPercentual * 0.10; // 10% da média
                      let cor = '#0ea5e9'; // Azul - dentro da média
                      
                      if (percentual >= mediaPercentual + limiteVariacao) {
                        cor = '#ef4444'; // Vermelho - acima da média +10%
                      } else if (percentual <= mediaPercentual - limiteVariacao) {
                        cor = '#10b981'; // Verde - abaixo da média -10%
                      }

                      return {
                        month,
                        percentual,
                        cor,
                        usados: businessMetricsData.volumeVendas.usados[index],
                        repasse: businessMetricsData.volumeVendas.repasse[index]
                      };
                    });

                    return (
                      <>
                        {/* Cards de Resumo */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Vendas Totais</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalVendas.toLocaleString('pt-BR')}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Vendas Repasse</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalRepasse}</p>
                          </div>
                          <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-lg border border-rose-200 dark:border-rose-800">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">% de Repasse</p>
                            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{mediaPercentual.toFixed(2)}%</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">% MÉDIO ANUAL</p>
                          </div>
                        </div>

                        {/* Gráfico */}
                        <ChartContainer config={{}} className="h-[400px] w-full">
                          <BarChart data={repasseChartData} >
                            <XAxis 
                              dataKey="month" 
                              tick={{ fill: '#64748b', fontSize: 12 }}
                              axisLine={{ stroke: '#cbd5e1' }}
                            />
                            <YAxis 
                              tick={{ fill: '#64748b', fontSize: 12 }}
                              axisLine={{ stroke: '#cbd5e1' }}
                              tickFormatter={(value) => `${value}%`}
                              label={{ value: '% Repasse', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                              domain={[0, 70]}
                            />
                            <ChartTooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                                      <p className="font-semibold text-slate-900 dark:text-white mb-2">{payload[0].payload.month}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">VENDAS USADOS</p>
                                      <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">{payload[0].payload.usados}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">VENDAS REPASSE</p>
                                      <p className="text-xl font-bold text-teal-600 mb-2">{payload[0].payload.repasse}</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-400">% DE REPASSE</p>
                                      <p className="text-xl font-bold text-rose-600">{payload[0].payload.percentual.toFixed(2)}%</p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Bar 
                              dataKey="percentual" 
                              radius={[4, 4, 0, 0]}
                            >
                              {repasseChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.cor} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ChartContainer>

                        {/* Legenda */}
                        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">LEGENDA DE CORES</p>
                          <div className="flex flex-wrap gap-4">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
                              <span className="text-sm text-slate-600 dark:text-slate-400">Acima da média (+10%)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#0ea5e9' }}></div>
                              <span className="text-sm text-slate-600 dark:text-slate-400">Dentro da média (±10%)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
                              <span className="text-sm text-slate-600 dark:text-slate-400">Abaixo da média (-10%)</span>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Card de Tabela Detalhada de Métricas */}
            {showDetailedMetrics && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Métricas Detalhadas - Análise Consolidada 2025
                      </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Tabela completa com todos os indicadores mensais de vendas, estoques, juros, custos, bônus e créditos fiscais
                    </CardDescription>
                  </div>
                  <button
                    onClick={() => setShowDetailedMetrics(false)}
                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                  >
                    <TrendingDown className="w-5 h-5" />
                  </button>
                </div>
                </CardHeader>
                <CardContent>
                  <DetailedMetricsTable />
                </CardContent>
              </Card>
            )}
          </>
        </div>
      </div>

      {!showDetailedMetrics && !showTrocasChart && !showRepasseChart && !showEstoqueNovos && !showEstoqueUsados && !showEstoquePecas && !showVendaPecas && !showVendasSeguradora && !showVendasMercadoLivre && !showDespesasFinanceirasNovos && !showDespesasFinanceirasUsados && !showDespesasFinanceirasPecas && !showDespesasFinanceirasOficina && !showDespesasFinanceirasFunilaria && !showDespesasFinanceirasAdministracao && !showBonusNovos && !showBonusUsados && !showBonusPecas && !showBonusOficina && !showBonusFunilaria && !showBonusAdministracao && !showReceitaFinanciamentoNovos && !showReceitaFinanciamentoUsados && !showCreditoICMSNovos && !showCreditoICMSPecas && !showCreditoICMSAdministracao && !showCreditoPISCofinsAdministracao && (
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
                      <BarChart 
                        height={220}
                        data={(() => {
                          const periodData = aggregateData(projectedData[activeScenario!]?.[0]?.meses || []);
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
                                      <span className="font-bold text-blue-600">{formatNumber(Number(payload[0]?.value || 0))} unidades</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Projeção: </span>
                                      <span className="font-bold text-emerald-600">{formatNumber(Number(payload[1]?.value || 0))} unidades</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Variação: </span>
                                      <span className="font-bold text-purple-600">{formatNumber(Number(payload[1]?.value || 0) - Number(payload[0]?.value || 0))} unidades</span>
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
                  ) : (
                      <BarChart
                        
                        height={220}
                      data={(() => {
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
                                      <span className="font-bold text-slate-900 dark:text-white">{formatNumber(Number(payload[0].value || 0))} unidades</span>
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
                    <BarChart
                        
                        height={220}
                        data={(() => {
                          const periodData = aggregateData(projectedData[activeScenario!]?.[1].meses);
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
                                      <span className="font-bold text-blue-600">{formatChartValue(Number(payload[0]?.value || 0) * 1000)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Projeção: </span>
                                      <span className="font-bold text-emerald-600">{formatChartValue(Number(payload[1]?.value || 0) * 1000)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Variação: </span>
                                      <span className="font-bold text-purple-600">
                                        {formatChartValue((Number(payload[1]?.value || 0) - Number(payload[0]?.value || 0)) * 1000)}
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
                  ) : (
                    // Gráfico normal com uma barra
                    <BarChart
                        
                        height={220}
                        data={(() => {
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
                                      <span className="font-bold text-slate-900 dark:text-white">{formatChartValue(Number(payload[0].value || 0) * 1000)}</span>
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
                    <BarChart
                        
                        height={220}
                        data={(() => {
                          const periodData = aggregateData(projectedData[activeScenario!]?.[3].meses);
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
                                      <span className="font-bold text-blue-600">{formatChartValue(Number(payload[0]?.value || 0) * 1000)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Projeção: </span>
                                      <span className="font-bold text-emerald-600">{formatChartValue(Number(payload[1]?.value || 0) * 1000)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Variação: </span>
                                      <span className="font-bold text-purple-600">
                                        {formatChartValue((Number(payload[1]?.value || 0) - Number(payload[0]?.value || 0)) * 1000)}
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
                  ) : (
                    <BarChart
                        
                        height={220}
                        data={(() => {
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
                                    <span className="font-bold text-slate-900 dark:text-white">{formatChartValue(Number(payload[0].value || 0) * 1000)}</span>
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
                    <BarChart
                        
                        height={220}
                        data={(() => {
                          const periodData = aggregateData(projectedData[activeScenario!]?.[6].meses);
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
                                      <span className="font-bold text-blue-600">{formatChartValue(Number(payload[0]?.value || 0) * 1000)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Projeção: </span>
                                      <span className="font-bold text-emerald-600">{formatChartValue(Number(payload[1]?.value || 0) * 1000)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Variação: </span>
                                      <span className="font-bold text-purple-600">
                                        {formatChartValue((Number(payload[1]?.value || 0) - Number(payload[0]?.value || 0)) * 1000)}
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
                  ) : (
                    <BarChart
                        
                        height={220}
                        data={(() => {
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
                                    <span className="font-bold text-slate-900 dark:text-white">{formatChartValue(Number(payload[0].value || 0) * 1000)}</span>
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
                  )}
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Despesas por Categoria - Largura Total */}
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
                
                <ChartContainer config={chartConfig} className="h-[220px] w-full">
                  {showComparison && projectionMode ? (
                    // Gráfico de comparação entre original e projeção
                    <BarChart
                        
                        height={220}
                        data={(() => {
                        // Dados originais
                        const aggregatedPessoalOrig = aggregateData(dreData[7].meses.map(v => Math.abs(v)));
                        const aggregatedTerceirosOrig = aggregateData(dreData[8].meses.map(v => Math.abs(v)));
                        const aggregatedOcupacaoOrig = aggregateData(dreData[9].meses.map(v => Math.abs(v)));
                        const aggregatedFuncionamentoOrig = aggregateData(dreData[10].meses.map(v => Math.abs(v)));
                        const aggregatedVendasOrig = aggregateData(dreData[11].meses.map(v => Math.abs(v)));
                        
                        // Dados projetados
                        const aggregatedPessoalProj = aggregateData(projectedData[activeScenario!]?.[7].meses.map(v => Math.abs(v)));
                        const aggregatedTerceirosProj = aggregateData(projectedData[activeScenario!]?.[8].meses.map(v => Math.abs(v)));
                        const aggregatedOcupacaoProj = aggregateData(projectedData[activeScenario!]?.[9].meses.map(v => Math.abs(v)));
                        const aggregatedFuncionamentoProj = aggregateData(projectedData[activeScenario!][10].meses.map(v => Math.abs(v)));
                        const aggregatedVendasProj = aggregateData(projectedData[activeScenario!][11].meses.map(v => Math.abs(v)));
                        
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
                                      <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(Number(payload[0]?.value || 0))}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Projeção: </span>
                                      <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(Number(payload[1]?.value || 0))}</span>
                                    </p>
                                    <p className="text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                                      <span className="text-slate-600 dark:text-slate-400">Diferença: </span>
                                      <span className={`font-bold ${Number(payload[1]?.value || 0) - Number(payload[0]?.value || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {formatCurrency(Math.abs(Number(payload[1]?.value || 0) - Number(payload[0]?.value || 0)))}
                                        {Number(payload[1]?.value || 0) - Number(payload[0]?.value || 0) > 0 ? ' ↑' : ' ↓'}
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
                  ) : (
                  <BarChart
                        
                        height={220}
                        data={(() => {
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
                  )}
                </ChartContainer>

                {/* Total do Período por Categoria */}
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Total do Período por Categoria:</p>
                  <div className="grid grid-cols-5 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#001E50' }}></div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Pessoal</p>
                      </div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(Math.abs(activeDreData[7].total))}
                      </p>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#0089EF' }}></div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Terceiros</p>
                      </div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(Math.abs(activeDreData[8].total))}
                      </p>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#F59E0B' }}></div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Ocupação</p>
                      </div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(Math.abs(activeDreData[9].total))}
                      </p>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#EF4444' }}></div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Funcionamento</p>
                      </div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(Math.abs(activeDreData[10].total))}
                      </p>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#8B5CF6' }}></div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Vendas</p>
                      </div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(Math.abs(activeDreData[11].total))}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Amortizações e Depreciações - Largura Total */}
            <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Amortizações e Depreciações</CardTitle>
                    <CardDescription className="text-sm">Despesas não caixa do período</CardDescription>
                  </div>
                  <Badge className="bg-slate-50 text-slate-700 border-slate-200">{((Math.abs(activeDreData[13].total) / activeDreData[1].total) * 100).toFixed(2)}% ROL</Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total do Período</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(Math.abs(activeDreData[13].total) / 1000)} mil</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">% sobre Receita</p>
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{((Math.abs(activeDreData[13].total) / activeDreData[1].total) * 100).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Média Mensal</p>
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{formatCurrency(Math.abs(activeDreData[13].total) / 12 / 1000)} mil</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ChartContainer config={chartConfig} className="h-[220px] w-full">
                  {showComparison && projectionMode ? (
                    <BarChart
                        
                        height={220}
                        data={(() => {
                          const periodData = aggregateData(projectedData[activeScenario!][13].meses.map(v => Math.abs(v)));
                          const periodDataOriginal = aggregateData(dreData[13].meses.map(v => Math.abs(v)));
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
                                      <span className="font-bold text-blue-600">{formatChartValue(Number(payload[0]?.value || 0) * 1000)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Projeção: </span>
                                      <span className="font-bold text-emerald-600">{formatChartValue(Number(payload[1]?.value || 0) * 1000)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Variação: </span>
                                      <span className="font-bold text-purple-600">
                                        {formatChartValue((Number(payload[1]?.value || 0) - Number(payload[0]?.value || 0)) * 1000)}
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
                        <Bar dataKey="original" fill="#3b82f6" name="Original (mil)" maxBarSize={50} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="projecao" fill="#10b981" name="Projeção (mil)" maxBarSize={50} radius={[4, 4, 0, 0]} />
                      </BarChart>
                  ) : (
                    <BarChart
                        
                        height={220}
                        data={(() => {
                          const periodData = aggregateData(activeDreData[13].meses.map(v => Math.abs(v)));
                          const periodDataReceita = aggregateData(activeDreData[1].meses);
                          const periodLabels = getPeriodLabels();
                          
                          return periodData.map((value, idx) => ({
                            mes: periodLabels[idx],
                            valor: value / 1000,
                            percentual: ((value / periodDataReceita[idx]) * 100).toFixed(2)
                          }));
                        })()} 
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
                                      <span className="text-slate-600 dark:text-slate-400">Valor: </span>
                                      <span className="font-bold text-slate-900 dark:text-white">{formatChartValue(Number(payload[0]?.value || 0) * 1000)}</span>
                                    </p>
                                    <p className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">% Receita: </span>
                                      <span className="font-bold text-slate-700 dark:text-slate-300">{payload[0].payload.percentual}%</span>
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="valor" fill="#64748b" name="Amortizações (mil)" maxBarSize={50} radius={[4, 4, 0, 0]} />
                      </BarChart>
                  )}
                </ChartContainer>
              </CardContent>
            </Card>

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
                <>
                  <BarChart 
                    data={(() => {
                      const periodData = aggregateData(projectedData[activeScenario!][18].meses);
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
                                    R$ {Number(Number(payload[1]?.value || 0) - Number(payload[0]?.value || 0)).toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})} mil
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
                </>
                  ) : (
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
                    {(() => {
                      const periodDataLucro = aggregateData(activeDreData[18].meses);
                      const media = periodDataLucro.reduce((a, b) => a + b, 0) / periodDataLucro.length;
                      return periodDataLucro.map((val, idx) => {
                        const fillColor = val > media * 1.05 ? '#0ea5e9' : val < media * 0.95 ? '#f97316' : '#10b981';
                        return <Cell key={`cell-${idx}`} fill={fillColor} />;
                      });
                    })()}
                    <LabelList 
                      dataKey="percentual" 
                      position="top" 
                      formatter={(value: number) => `${value}%`}
                      style={{ fontSize: '11px', fontWeight: '600', fill: '#64748b' }}
                    />
                  </Bar>
                </BarChart>
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
      )}
    </div>
    </>
  )
}
