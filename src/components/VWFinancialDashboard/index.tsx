import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TrendingDown, Download, Upload, Calendar, BarChart3, TrendingUp, Eye, GitCompare, Trash2, DollarSign, Building2, Plus, Edit, Save, X, ChevronDown } from "lucide-react"
import { PasswordDialog } from "@/components/PasswordDialog"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis, Legend, LabelList, ComposedChart, Cell } from "recharts"
import { useState, useRef, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailedMetricsTable } from "@/components/DetailedMetricsTable"
import { YearComparison } from "@/components/YearComparison"
import { 
  loadMetricsData, 
  saveMetricsData, 
  loadDREData, 
  saveDREData, 
  loadSelectedFiscalYear, 
  saveSelectedFiscalYear,
  loadSelectedDepartment,
  saveSelectedDepartment,
  clearYearData,
  clearAllData,
  importAllData,
  exportAllData,
  loadSharedMetricsData,
  saveSharedMetricsData,
  loadFatosRelevantes,
  loadFatosRelevantesAsync,
  saveFatosRelevantes,
  loadProjectionData,
  saveProjectionData,
  deleteProjectionData,
  initializeFromDatabase,
  type MetricsData,
  type Department,
  type Brand,
  type FatoRelevante,
  type FatosRelevantesData,
  type ProjectionData
} from "@/lib/dataStorage"
import { 
  importAllDataToCloudAndLocal,
  preloadFromCloud,
  hasAnyData,
  isCloudMode
} from "@/lib/hybridStorage"
import { DEPARTMENT_LABELS, DEPARTMENTS } from "@/lib/types"
import { getBrandConfig, BRAND_CONFIGS } from "@/lib/brands"

// Props interface para VWFinancialDashboard
interface VWFinancialDashboardProps {
  brand: Brand;
  onChangeBrand: () => void;
}

// Dados iniciais DRE - Demonstrativo de Resultados (ano 2025 como base)
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
    total: -3521000,
    percentTotal: -3.67,
    meses: [-300000, -280000, -320000, -310000, -290000, -305000, -295000, -315000, -298000, -308000, -280000, -320000]
  },
  {
    descricao: "PARTICIPAÇÕES",
    total: 0,
    percentTotal: 0.00,
    meses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    descricao: "LUCRO LIQUIDO DO EXERCICIO",
    total: 10561051,
    percentTotal: 11.01,
    meses: [210000, 185000, 220000, 200000, 215000, 195000, 225000, 285000, 275000, 265000, 180000, 906051],
    isHighlight: true,
    isFinal: true
  }
]

// Função helper para calcular média considerando apenas meses com dados (não-zero)
const calculateMonthlyAverage = (values: number[]): number => {
  if (!values || values.length === 0) return 0
  const nonZeroValues = values.filter(v => v !== 0)
  if (nonZeroValues.length === 0) return 0
  return nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length
}

// Função helper para contar meses com dados
const countMonthsWithData = (values: number[]): number => {
  if (!values || values.length === 0) return 0
  return values.filter(v => v !== 0).length
}

export function VWFinancialDashboard({ brand, onChangeBrand }: VWFinancialDashboardProps) {
  // Configuração da marca atual
  const brandConfig = getBrandConfig(brand);
  
  // Estado para o ano fiscal selecionado e departamento
  const [fiscalYear, setFiscalYear] = useState<2024 | 2025 | 2026 | 2027>(() => loadSelectedFiscalYear())
  const [department, setDepartment] = useState<Department>(() => loadSelectedDepartment())
  
  // Estado para controlar categorias de despesas selecionadas
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['pessoal', 'terceiros', 'ocupacao', 'funcionamento', 'vendas'])
  const [viewMode, setViewMode] = useState<'mensal' | 'bimestral' | 'trimestral' | 'semestral'>('mensal')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const metricsFileInputRef = useRef<HTMLInputElement>(null)
  
  // Estado para dados DRE
  const [dreData, setDreData] = useState<any[]>([])
  
  // Estados para sistema de projeções - ISOLADOS POR DEPARTAMENTO/ANO/MARCA
  const [projectionMode, setProjectionMode] = useState(false)
  const [projectionScenarios, setProjectionScenarios] = useState<{id: string, name: string}[]>([])
  const [activeScenario, setActiveScenario] = useState<string | null>(null)
  const [projectionPercentages, setProjectionPercentages] = useState<{[scenarioId: string]: {[lineIndex: number]: number[]}}>({})
  const [projectedData, setProjectedData] = useState<{[scenarioId: string]: any[]}>({})
  const [showComparison, setShowComparison] = useState(false)
  const [showProjectionModal, setShowProjectionModal] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordAction, setPasswordAction] = useState<'edit' | 'delete' | null>(null)
  
  // Referência para controlar se está carregando projeções (evita salvar durante carregamento)
  const isLoadingProjections = useRef(false)
  // Referência para rastrear o contexto atual (departamento/ano/marca)
  const currentProjectionContext = useRef(`${brand}_${fiscalYear}_${department}`)
  
  // Estado para controlar exibição da tabela de métricas detalhadas
  const [showDetailedMetrics, setShowDetailedMetrics] = useState(false)
  
  // Estado para controlar navegação entre views
  const [currentView, setCurrentView] = useState<'dashboard' | 'comparison'>('dashboard')
  
  // Flag para controlar quando uma importação está acontecendo
  const [isImporting, setIsImporting] = useState(false)
  
  // Estado para dados de métricas de negócios (para permitir importação/exportação)
  const [metricsData, setMetricsData] = useState<MetricsData>(() => loadMetricsData(fiscalYear, department, brand))
  
  // Estado para dados compartilhados entre todos os departamentos (Dados Adicionais)
  const [sharedMetricsData, setSharedMetricsData] = useState<MetricsData>(() => loadSharedMetricsData(fiscalYear, brand))
  
  // Estados para controle dos diálogos de senha
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [dataPasswordAction, setDataPasswordAction] = useState<'import' | 'export' | 'template' | 'revert' | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  
  // Expor funções de limpeza no console (apenas para desenvolvimento)
  useEffect(() => {
    (window as any).clearYearData = (year: 2024 | 2025 | 2026 | 2027) => clearYearData(year, brand);
    (window as any).clearAllData = () => clearAllData(brand);
    (window as any).reloadDashboard = () => window.location.reload();
    
    // Função de debug para verificar estado do cache
    (window as any).debugStorage = () => {
      console.clear();
      console.log(`🔬 === DIAGNÓSTICO DE PERSISTÊNCIA - MARCA: ${brand.toUpperCase()} ===\n`);
      console.log('ℹ️ NOTA: TODOS os dados são armazenados no Redis (banco de dados na nuvem)');
      console.log('ℹ️ Isso inclui: DRE, Métricas, Dados Adicionais, Fatos Relevantes e Projeções.\n');
      
      console.log('🔍 DADOS ATUAIS NA INTERFACE:');
      console.log(`  - Ano fiscal: ${fiscalYear}`);
      console.log(`  - Departamento: ${department}`);
      console.log(`  - Importando: ${isImporting}`);
      console.log(`  - Linhas DRE carregadas: ${dreData.length}`);
      console.log(`  - Métricas carregadas:`, metricsData);
      
      console.log('\n🛠️ FUNÇÕES DISPONÍVEIS:');
      console.log('  - clearYearData(ano) - Limpa dados de um ano no Redis');
      console.log('  - clearAllData() - Limpa todos os dados no Redis');
      console.log('  - reloadDashboard() - Recarrega a página');
      console.log('  - debugStorage() - Repete este diagnóstico');
    };
    
    console.log('🛠️ Funções de desenvolvimento disponíveis:');
    console.log('  - clearYearData(2024) - Limpa dados de um ano específico');
    console.log('  - clearAllData() - Limpa todos os dados');
    console.log('  - reloadDashboard() - Recarrega a página');
    console.log('  - debugStorage() - Diagnóstico do estado atual');
  }, [brand, fiscalYear, department, isImporting, dreData.length, metricsData]);
  
  // Effect para pré-carregar dados da nuvem (Redis) na inicialização
  // IMPORTANTE: Inicializa o cache do banco de dados para a marca selecionada
  useEffect(() => {
    const initCloudData = async () => {
      console.log(`☁️ Inicializando dados na nuvem para marca: ${brand}...`);
      try {
        // Primeiro, inicializa o cache do banco de dados para esta marca
        // Isso garante que o dbCache tenha os dados da marca correta
        await initializeFromDatabase(brand);
        
        // Depois, pré-carrega dados adicionais da nuvem
        await preloadFromCloud(brand);
        console.log(`☁️ Pré-carregamento da nuvem concluído para ${brand}`);
      } catch (error) {
        console.warn('⚠️ Erro ao pré-carregar dados da nuvem:', error);
      }
    };
    
    initCloudData();
  }, [brand]);
  
  // Effect para carregar dados quando o ano fiscal, departamento ou marca mudarem
  useEffect(() => {
    // Não recarregar durante uma importação para evitar sobrescrita
    if (isImporting) {
      console.log('🚫 Carregamento bloqueado - importação em andamento');
      return;
    }
    
    console.log(`🔄 Carregando dados para: ${brand.toUpperCase()} - ${fiscalYear} - ${DEPARTMENT_LABELS[department]}`);
    
    // Função para tentar carregar dados com retry
    const loadDataWithRetry = (retryCount = 0) => {
      const newMetricsData = loadMetricsData(fiscalYear, department, brand);
      const newSharedMetricsData = loadSharedMetricsData(fiscalYear, brand);
      const newDreData = loadDREData(fiscalYear, department, brand);
      
      console.log('📊 Métricas carregadas:', newMetricsData);
      console.log('🔗 Métricas compartilhadas carregadas:', newSharedMetricsData);
      console.log('🔍 Comparação de dados:');
      console.log('  - Métricas normais (específicas dept):', newMetricsData?.bonus?.veiculosUsados || 'não carregado');
      console.log('  - Métricas compartilhadas (todos depts):', newSharedMetricsData?.bonus?.veiculosUsados || 'não carregado');
      console.log('📈 DRE carregado:', newDreData);
      console.log('📍 Origem dos dados: cache Redis');
      
      // Logs de verificação de carregamento (dados vêm do cache Redis)
      console.log('🔍 Verificação de carregamento:');
      console.log(`  - Métricas ${fiscalYear}/${department}: ${newMetricsData ? '✅ carregado' : '❌ não encontrado'}`);
      console.log(`  - Métricas compartilhadas ${fiscalYear}: ${newSharedMetricsData ? '✅ carregado' : '❌ não encontrado'}`);
      console.log(`  - DRE ${fiscalYear}/${department}: ${newDreData ? '✅ carregado' : '❌ não encontrado'}`);
      
      // Se DRE não foi carregado do cache e deveria tentar novamente
      if (!newDreData && retryCount < 3) {
        console.log(`🔄 Retry ${retryCount + 1}/3 - tentando recarregar dados do cache`);
        setTimeout(() => loadDataWithRetry(retryCount + 1), 100);
        return;
      }
      
      // Atualizar métricas normais
      console.log('🔍 Verificação - Bonus Veículos Usados (ID 33):', newMetricsData.bonus?.veiculosUsados);
      console.log('🔍 Verificação - Bonus Peças (ID 34):', newMetricsData.bonus?.pecas);
      console.log('🔍 Verificação - Receitas Financiamento Novos (ID 38):', newMetricsData.receitasFinanciamento?.veiculosNovos);
      setMetricsData(newMetricsData);
      
      // Atualizar métricas compartilhadas
      console.log('🔗 Atualizando métricas compartilhadas na interface');
      setSharedMetricsData(newSharedMetricsData);
      
      // Atualizar DRE
      if (newDreData && newDreData.length > 0) {
        console.log('✅ Usando dados do cache Redis para DRE');
        setDreData(newDreData);
      } else {
        console.log('⚠️ Sem dados no cache Redis, usando dados padrão/zerados');
        // Se não houver dados salvos e for marca VW, usar dados iniciais apenas para 2025/usados
        if (brand === 'vw' && fiscalYear === 2025 && department === 'usados') {
          setDreData(initialDreData);
        } else {
          // Para outros casos, criar estrutura zerada
          const zeroedData = initialDreData.map(line => ({
            ...line,
            total: 0,
            percentTotal: line.percentTotal !== null ? 0 : null,
            meses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          }));
          setDreData(zeroedData);
        }
      }
    };
    
    loadDataWithRetry();
    
    saveSelectedFiscalYear(fiscalYear);
    saveSelectedDepartment(department);
  }, [fiscalYear, department, brand, isImporting]);
  
  // Effect para carregar Fatos Relevantes quando mudar departamento, ano ou marca
  useEffect(() => {
    if (!isImporting) {
      // Primeiro tenta carregar do cache (síncrono)
      const cachedFatos = loadFatosRelevantes(fiscalYear, department, brand);
      if (cachedFatos.length > 0) {
        setFatosRelevantes(cachedFatos);
        console.log(`✅ Fatos Relevantes carregados do cache: ${brand} - ${department} - ${fiscalYear}`, cachedFatos);
      } else {
        // Se não estiver no cache, busca do Redis (assíncrono)
        loadFatosRelevantesAsync(fiscalYear, department, brand).then(loadedFatos => {
          setFatosRelevantes(loadedFatos);
          console.log(`✅ Fatos Relevantes carregados do Redis: ${brand} - ${department} - ${fiscalYear}`, loadedFatos);
        });
      }
    }
  }, [fiscalYear, department, brand, isImporting]);
  
  // Effect para salvar dados de métricas quando mudarem (DESABILITADO para não sobrescrever importações)
  // As métricas são salvas apenas durante importação ou edição explícita
  // useEffect(() => {
  //   saveMetricsData(fiscalYear, metricsData, department);
  // }, [metricsData, fiscalYear, department]);
  
  // Effect para salvar dados de DRE quando mudarem (DESABILITADO para não sobrescrever importações)
  // Os dados são salvos apenas durante a importação manual ou edição explícita
  // useEffect(() => {
  //   if (dreData.length > 0) {
  //     if (department !== 'consolidado') {
  //       saveDREData(fiscalYear, dreData, department);
  //     }
  //   }
  // }, [dreData, fiscalYear, department]);
  
  // Handler para mudança de ano fiscal
  const handleFiscalYearChange = (year: string) => {
    const newYear = parseInt(year) as 2024 | 2025 | 2026 | 2027;
    setFiscalYear(newYear);
  };
  
  // Handlers para importação e exportação de métricas (protegido por senha)
  const requestExportMetrics = () => {
    setDataPasswordAction('export')
    setPasswordDialogOpen(true)
  }

  const handleExportMetrics = () => {
    // Exportar dados compartilhados além dos dados normais
    const allData = {
      exportDate: new Date().toISOString(),
      fiscalYear,
      department,
      normalMetrics: metricsData,
      sharedMetrics: sharedMetricsData,
      message: 'Exportação de Dados Adicionais - Dados Compartilhados entre todos os departamentos'
    };
    
    const jsonString = JSON.stringify(allData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${brand}-dados-adicionais-${fiscalYear}-${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✅ Dados Adicionais exportados:', allData);
  };

  const handleImportMetrics = () => {
    metricsFileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('=== INÍCIO DA IMPORTAÇÃO ===');
    console.log('📁 Arquivo selecionado:', file.name);
    console.log('📏 Tamanho:', (file.size / 1024).toFixed(2), 'KB');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        console.log('📄 Arquivo lido com sucesso');
        console.log('📊 Primeiras 300 chars:', content.substring(0, 300));
        
        // Parsear o conteúdo
        const lines = content.split('\n').filter(line => 
          line.trim() && !line.trim().startsWith('#') && !line.trim().startsWith('=')
        );
        
        console.log('✅ Linhas válidas encontradas:', lines.length);
        
        if (lines.length < 2) {
          console.error('❌ Arquivo inválido ou vazio');
          alert('Arquivo inválido ou vazio');
          return;
        }
        
        // Pular o cabeçalho
        const dataLines = lines.slice(1);
        
        // Função para parsear valores
        const parseValue = (value: string, field: string): number => {
          if (!value || value.trim() === '') return 0;
          
          let cleaned = value.trim();
          
          if (cleaned.includes('%')) {
            return parseFloat(cleaned.replace('%', '').replace(',', '.')) || 0;
          }
          
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
          return parseFloat(cleaned) || 0;
        };
        
        // Criar novo objeto de dados baseado nos dados compartilhados (se importando compartilhado)
        // ou nos dados normais (se importando específico)
        const isSharedImport = showDetailedMetrics;
        const newData = JSON.parse(JSON.stringify(isSharedImport ? sharedMetricsData : metricsData));
        
        console.log('🔧 Base de dados para importação:', isSharedImport ? 'sharedMetricsData' : 'metricsData');
        
        let currentMetricId: number | null = null;
        let currentFieldIndex = 0;
        let processedIds: number[] = [];
        
        // Definir métricas para mapear IDs
        const metricsMap: {[key: number]: {fields: string[], dataPath: string[]}} = {
          1: {fields: ['vendas', 'volumeTrocas', 'percentualTrocas'], dataPath: ['vendasNovos']},
          2: {fields: ['vendas', 'volumeTrocas', 'percentualTrocas'], dataPath: ['vendasNovosVD']},
          3: {fields: ['vendas', 'volumeTrocas', 'percentualTrocas'], dataPath: ['vendasUsados']},
          4: {fields: ['usados', 'repasse', 'percentualRepasse'], dataPath: ['volumeVendas']},
          5: {fields: ['quantidade', 'valor', 'aPagar', 'pagos'], dataPath: ['estoqueNovos']},
          6: {fields: ['quantidade', 'valor', 'aPagar', 'pagos'], dataPath: ['estoqueUsados']},
          7: {fields: ['valor', 'aPagar', 'pagos'], dataPath: ['estoquePecas']},
          8: {fields: ['vendas', 'lucro', 'margem'], dataPath: ['vendasPecas', 'balcao']},
          9: {fields: ['vendas', 'lucro', 'margem'], dataPath: ['vendasPecas', 'oficina']},
          10: {fields: ['vendas', 'lucro', 'margem'], dataPath: ['vendasPecas', 'funilaria']},
          11: {fields: ['vendas', 'lucro', 'margem'], dataPath: ['vendasPecas', 'acessorios']},
          12: {fields: ['vendas', 'lucro', 'margem'], dataPath: ['vendasPecas', 'seguradoraTotal']},
          13: {fields: ['vendas', 'lucro', 'margem'], dataPath: ['seguradoras', 'portoSeguro']},
          14: {fields: ['vendas', 'lucro', 'margem'], dataPath: ['seguradoras', 'azul']},
          15: {fields: ['vendas', 'lucro', 'margem'], dataPath: ['seguradoras', 'allianz']},
          16: {fields: ['vendas', 'lucro', 'margem'], dataPath: ['seguradoras', 'tokioMarine']},
          17: {fields: ['vendas', 'lucro', 'margem'], dataPath: ['mercadoLivre']},
          18: {fields: ['valor'], dataPath: ['juros', 'veiculosNovos']},
          19: {fields: ['valor'], dataPath: ['juros', 'veiculosUsados']},
          20: {fields: ['valor'], dataPath: ['juros', 'pecas']},
          21: {fields: ['valor'], dataPath: ['juros', 'emprestimosBancarios']},
          22: {fields: ['valor'], dataPath: ['juros', 'contratoMutuo']},
          23: {fields: ['valor'], dataPath: ['custos', 'garantia']},
          24: {fields: ['reparoUsados', 'ticketMedioReparo'], dataPath: ['custos']},
          25: {fields: ['valor'], dataPath: ['despesasCartao', 'novos']},
          26: {fields: ['valor'], dataPath: ['despesasCartao', 'vendaDireta']},
          27: {fields: ['valor'], dataPath: ['despesasCartao', 'usados']},
          28: {fields: ['valor'], dataPath: ['despesasCartao', 'pecas']},
          29: {fields: ['valor'], dataPath: ['despesasCartao', 'oficina']},
          30: {fields: ['valor'], dataPath: ['despesasCartao', 'funilaria']},
          31: {fields: ['valor'], dataPath: ['despesasCartao', 'administracao']},
          32: {fields: ['valor'], dataPath: ['bonus', 'veiculosNovos']},
          33: {fields: ['valor'], dataPath: ['bonus', 'veiculosUsados']},
          34: {fields: ['valor'], dataPath: ['bonus', 'pecas']},
          35: {fields: ['valor'], dataPath: ['bonus', 'oficina']},
          36: {fields: ['valor'], dataPath: ['bonus', 'funilaria']},
          37: {fields: ['valor'], dataPath: ['bonus', 'administracao']},
          38: {fields: ['valor'], dataPath: ['receitasFinanciamento', 'veiculosNovos']},
          39: {fields: ['valor'], dataPath: ['receitasFinanciamento', 'veiculosUsados']},
          40: {fields: ['valor'], dataPath: ['creditosICMS', 'novos']},
          41: {fields: ['valor'], dataPath: ['creditosICMS', 'pecas']},
          42: {fields: ['valor'], dataPath: ['creditosICMS', 'administracao']},
          43: {fields: ['valor'], dataPath: ['creditosPISCOFINS', 'administracao']},
          44: {fields: ['valor'], dataPath: ['receitaBlindagem']},
          45: {fields: ['valor'], dataPath: ['receitaDespachanteUsados']},
          46: {fields: ['valor'], dataPath: ['receitaDespachanteNovos']},
        };
        
        dataLines.forEach(line => {
          const columns = line.split('\t').map(col => col.trim());
          
          if (columns.length < 3) return;
          
          const id = columns[0];
          const values = columns.slice(2, 14);
          
          if (id) {
            currentMetricId = parseInt(id);
            currentFieldIndex = 0;
            if (!isNaN(currentMetricId)) {
              processedIds.push(currentMetricId);
            }
          } else {
            currentFieldIndex++;
          }
          
          if (!currentMetricId || !metricsMap[currentMetricId]) return;
          
          const metric = metricsMap[currentMetricId];
          const field = metric.fields[currentFieldIndex];
          if (!field) return;
          
          const parsedValues = values.map(v => parseValue(v, field));
          
          // Log para debug de IDs específicos (18-43)
          if (currentMetricId >= 18 && currentMetricId <= 43) {
            console.log(`📝 ID ${currentMetricId} - ${metric.dataPath.join('.')} - ${field}:`, parsedValues.slice(0, 3), '...');
          }
          
          // Navegar no objeto usando o dataPath e garantir que os objetos intermediários existam
          let target: any = newData;
          for (let i = 0; i < metric.dataPath.length - 1; i++) {
            const pathPart = metric.dataPath[i];
            if (!target[pathPart]) {
              target[pathPart] = {};
            }
            target = target[pathPart];
          }
          
          const lastPath = metric.dataPath[metric.dataPath.length - 1];
          
          // Para métricas com apenas 1 campo 'valor' (IDs 18-23, 25-43, 44-46)
          // Os dados são arrays diretos, não objetos com campo 'valor'
          if (metric.fields.length === 1 && metric.fields[0] === 'valor') {
            if (metric.dataPath.length === 1) {
              // IDs 44, 45, 46 - arrays no nível raiz
              newData[lastPath] = parsedValues;
            } else {
              // IDs 18-23, 25-43 - arrays dentro de objetos aninhados (ex: juros.veiculosNovos)
              target[lastPath] = parsedValues;
            }
          } else {
            // Para métricas com múltiplos campos (IDs 1-17, 24)
            // Os dados são objetos com múltiplas propriedades
            if (metric.dataPath.length === 1) {
              if (!newData[lastPath]) {
                newData[lastPath] = {};
              }
              newData[lastPath][field] = parsedValues;
            } else {
              if (!target[lastPath]) {
                target[lastPath] = {};
              }
              target[lastPath][field] = parsedValues;
            }
          }
        });
        
        console.log('✨ Processamento concluído');
        console.log('📊 IDs processados:', processedIds);
        console.log('💾 Aplicando novos dados ao estado...');
        console.log('📋 Preview dos dados importados (IDs 18-43):');
        console.log('  - ID 18 (Juros Novos):', newData.juros?.veiculosNovos);
        console.log('  - ID 19 (Juros Usados):', newData.juros?.veiculosUsados);
        console.log('  - ID 20 (Juros Peças):', newData.juros?.pecas);
        console.log('  - ID 21 (Juros Emp. Banc.):', newData.juros?.emprestimosBancarios);
        console.log('  - ID 22 (Juros Contrato Mútuo):', newData.juros?.contratoMutuo);
        console.log('  - ID 23 (Custos Garantia):', newData.custos?.garantia);
        console.log('  - ID 25 (Desp Cartão Novos):', newData.despesasCartao?.novos);
        console.log('  - ID 27 (Desp Cartão Usados):', newData.despesasCartao?.usados);
        console.log('  - ID 32 (Bônus Novos):', newData.bonus?.veiculosNovos);
        console.log('  - ID 33 (Bônus Usados):', newData.bonus?.veiculosUsados);
        console.log('  - ID 34 (Bônus Peças):', newData.bonus?.pecas);
        console.log('  - ID 38 (Receitas Fin. Novos):', newData.receitasFinanciamento?.veiculosNovos);
        console.log('  - ID 40 (Créditos ICMS Novos):', newData.creditosICMS?.novos);
        console.log('  - ID 42 (Créditos ICMS Admin):', newData.creditosICMS?.administracao);
        console.log('  - ID 43 (Créditos PIS/COFINS):', newData.creditosPISCOFINS?.administracao);
        
        // isSharedImport já foi definido no início do processamento
        
        if (isSharedImport) {
          console.log('📤 Salvando como dados COMPARTILHADOS (visível em todos os departamentos)...');
          // Salvar como dados compartilhados
          const sharedSaved = saveSharedMetricsData(fiscalYear, newData, brand);
          console.log('💾 Salvamento compartilhado:', sharedSaved ? '✅ Sucesso' : '❌ Falhou');
          
          if (sharedSaved) {
            // Recarregar dados compartilhados do Redis para garantir sincronização
            const reloadedSharedData = loadSharedMetricsData(fiscalYear, brand);
            console.log('🔄 Dados compartilhados recarregados do Redis:', reloadedSharedData);
            console.log('🔍 Verificação pós-importação:');
            console.log('  - Bonus Veículos Usados (ID 33):', reloadedSharedData.bonus?.veiculosUsados);
            console.log('  - Bonus Peças (ID 34):', reloadedSharedData.bonus?.pecas);
            console.log('  - Receitas Financiamento Novos (ID 38):', reloadedSharedData.receitasFinanciamento?.veiculosNovos);
            console.log('  - Créditos ICMS Administração (ID 42):', reloadedSharedData.creditosICMS?.administracao);
            
            // Atualizar tanto o estado normal quanto o compartilhado
            setMetricsData(reloadedSharedData);
            setSharedMetricsData(reloadedSharedData);
            
            console.log('🔄 Todos os departamentos agora terão acesso aos dados importados!');
            alert('Dados importados e compartilhados com TODOS os departamentos!');
          } else {
            alert('Erro ao salvar dados compartilhados.');
          }
        } else {
          console.log('📤 Salvando como dados específicos do departamento...');
          // Salvar apenas para o departamento atual (comportamento antigo)
          const saved = saveMetricsData(fiscalYear, newData, department);
          console.log('💾 Salvamento no Redis:', saved ? '✅ Sucesso' : '❌ Falhou');
          
          if (saved) {
            setMetricsData(newData);
            alert('Dados importados com sucesso!');
          } else {
            alert('Erro ao salvar dados.');
          }
        }
        
        console.log('✅ Estado atualizado com sucesso!');
        console.log('=== FIM DA IMPORTAÇÃO ===\n');
        
      } catch (error) {
        console.error('❌ ERRO durante importação:', error);
        console.error('Stack trace:', (error as Error).stack);
        alert('Erro ao importar dados. Verifique o formato do arquivo.');
      }
    };
    
    reader.readAsText(file);
    
    // Reset do input
    if (event.target) {
      event.target.value = '';
    }
  };
  
  // Estado para controlar exibição do card de % de Trocas
  const [showTrocasChart, setShowTrocasChart] = useState(false)
  
  // Estado para controlar exibição do card de % de Repasse
  const [showRepasseChart, setShowRepasseChart] = useState(false)
  
  // Estado para controlar exibição do card de Estoque de Novos
  const [showEstoqueNovos, setShowEstoqueNovos] = useState(false)
  
  // Estado para controlar exibição do card de Insights
  const [showInsights, setShowInsights] = useState(false)
  
  // Estado para controlar exibição do card de Dados Adicionais
  const [showDadosAdicionais, setShowDadosAdicionais] = useState(false)
  
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

  // Estado para controlar exibição do card de Receita de Blindagem
  const [showReceitaBlindagem, setShowReceitaBlindagem] = useState(false)

  // Estado para controlar exibição do card de Receita de Despachante Usados
  const [showReceitaDespachanteUsados, setShowReceitaDespachanteUsados] = useState(false)

  // Estado para controlar exibição do card de Receita de Despachante Novos
  const [showReceitaDespachanteNovos, setShowReceitaDespachanteNovos] = useState(false)

  // Estado para controlar exibição do card de Fatos Relevantes
  const [showFatosRelevantes, setShowFatosRelevantes] = useState(true)
  
  // Estado para controlar se o toggle de Fatos Relevantes está aberto/fechado
  const [fatosRelevantesExpanded, setFatosRelevantesExpanded] = useState(false)
  
  // Estado para os dados de Fatos Relevantes
  const [fatosRelevantes, setFatosRelevantes] = useState<FatosRelevantesData>([])
  
  // Estado para controlar qual linha está em modo de edição
  const [editingFatoId, setEditingFatoId] = useState<string | null>(null)

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
      return ['1º Bim', '2º Bim', '3º Bim', '4º Bim', '5º Bim', '6º Bim']
    } else if (viewMode === 'trimestral') {
      return ['1º Tri', '2º Tri', '3º Tri', '4º Tri']
    } else {
      return ['1º Sem', '2º Sem']
    }
  }

  // Função executada após validação de senha bem-sucedida
  const executePasswordProtectedAction = () => {
    switch (dataPasswordAction) {
      case 'template':
        downloadTemplate()
        break
      case 'import':
        if (pendingFile) {
          processImportFile(pendingFile)
          setPendingFile(null)
        }
        break
      case 'export':
        handleExportMetrics()
        break
      case 'revert':
        executeRevertData()
        break
    }
    setDataPasswordAction(null)
  }

  // Função para processar arquivo de importação
  const processImportFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        await handleImportDataContent(content)
      } catch (error) {
        alert('Erro ao importar dados. Verifique o formato do arquivo.')
        console.error('Erro ao importar:', error)
      }
    }
    reader.readAsText(file)
  }
  
  // Função de reverter dados após validação de senha
  const executeRevertData = () => {
    setDreData(initialDreData)
    alert('Dados revertidos para o estado inicial!')
  }
  
  // Função para requisitar reversão com senha
  const requestRevertData = () => {
    setDataPasswordAction('revert')
    setPasswordDialogOpen(true)
  }

  const requestDownloadTemplate = () => {
    setDataPasswordAction('template')
    setPasswordDialogOpen(true)
  }

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

  // Função para importar dados (protegida por senha)
  const requestImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    setPendingFile(file)
    setDataPasswordAction('import')
    setPasswordDialogOpen(true)
    
    // Resetar o input para permitir selecionar o mesmo arquivo novamente
    event.target.value = ''
  }

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        await handleImportDataContent(content)
      } catch (error) {
        alert('Erro ao importar dados. Verifique o formato do arquivo.')
        console.error('Erro ao importar:', error)
      }
    }
    reader.readAsText(file)
  }

  // Função auxiliar para processar o conteúdo do arquivo de importação
  const handleImportDataContent = async (content: string) => {
    try {
      // Tentar parsear como JSON (formato de backup completo)
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        console.log(`📥 Iniciando importação JSON para marca: ${brand}...`);
        setIsImporting(true);
        
        try {
          // Salva EXCLUSIVAMENTE no Redis (nuvem) para compartilhar com todos os usuários
          // NÃO usa localStorage para dados de negócio
          const cloudResult = await importAllDataToCloudAndLocal(content, brand);
          
          // Também atualiza o cache local via importAllData (que agora salva no cache + Redis)
          const localCacheSuccess = importAllData(content, brand);
          
          if (cloudResult.success || localCacheSuccess) {
            console.log('✅ Dados importados:');
            console.log(`  - Redis (nuvem): ${cloudResult.cloudSaved ? '✅' : '❌ FALHOU'}`);
            console.log(`  - Cache local: ${localCacheSuccess ? '✅' : '❌'}`);
            
            // Aguardar um momento para garantir persistência e depois recarregar dados
            setTimeout(() => {
              console.log('🔄 Recarregando dados após importação...');
              
              // Recarregar dados do cache Redis para atualizar a interface
              const reloadedMetrics = loadMetricsData(fiscalYear, department, brand);
              const reloadedDRE = loadDREData(fiscalYear, department, brand);
              
              console.log('🔍 Dados recarregados do cache:');
              console.log('  - Métricas:', reloadedMetrics);
              console.log('  - DRE:', reloadedDRE);
              
              if (reloadedMetrics) {
                console.log('📊 Atualizando métricas na interface');
                setMetricsData(reloadedMetrics);
              }
              if (reloadedDRE) {
                console.log('📈 Atualizando DRE na interface');
                setDreData(reloadedDRE);
              }
              
              setIsImporting(false);
              
              // Mensagem de sucesso
              if (cloudResult.cloudSaved) {
                alert('Dados importados com sucesso! ☁️ Sincronizado com a nuvem - todos os usuários verão os mesmos dados.');
              } else {
                alert('⚠️ ERRO: Dados NÃO foram salvos no banco de dados. Verifique a conexão com o servidor e tente novamente.');
              }
            }, 200);
          } else {
            setIsImporting(false);
            alert('❌ ERRO: Não foi possível salvar os dados no banco de dados. Verifique a conexão com o servidor.');
          }
        } catch (error) {
          console.error('❌ Erro durante importação JSON:', error);
          setIsImporting(false);
          alert('Erro ao importar dados JSON. Verifique o formato do arquivo.');
        }
        return;
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
      
      console.log('📥 Dados importados (TXT):', importedData);
      setIsImporting(true);
      
      // SALVAR NO REDIS para persistir os dados importados
      const isConsolidado = department === 'consolidado';
      const saved = saveDREData(fiscalYear, importedData, department, isConsolidado, brand);
      
      if (saved) {
        console.log(`✅ DRE salvo no Redis: ${brand}_dre_${fiscalYear}_${department}`);
        
        // Aguardar um momento para garantir persistência e depois atualizar interface
        setTimeout(() => {
          console.log('🔄 Atualizando interface após importação TXT...');
          setDreData(importedData);
          setIsImporting(false);
          
          // Verificar se os dados realmente persistiram
          const verification = loadDREData(fiscalYear, department, brand);
          if (verification && verification.length > 0) {
            console.log('✅ Verificação: dados persistiram corretamente');
            alert(`${importedData.length} linhas importadas e salvas com sucesso!`);
          } else {
            console.warn('⚠️ Verificação: possível problema de persistência');
            alert(`Dados importados, mas verifique a persistência. ${importedData.length} linhas processadas.`);
          }
        }, 100);
      } else {
        console.error(`❌ Falha ao salvar DRE no Redis`);
        setIsImporting(false);
        alert('Erro: falha ao salvar dados no banco de dados');
      }
    } catch (error) {
      alert('Erro ao importar dados. Verifique o formato do arquivo.')
      console.error('Erro ao importar:', error)
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
  const executeCreateProjection = () => {
    const newScenarioNumber = projectionScenarios.length + 1
    const newScenario = {
      id: `projection-${department}-${Date.now()}`,
      name: `projecao_${department}_${newScenarioNumber}`
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

  // Função para validar senha e executar ação
  const handlePasswordSubmit = () => {
    const correctPassword = '1985'
    
    if (passwordInput === correctPassword) {
      setShowPasswordDialog(false)
      setPasswordInput('')
      
      if (passwordAction === 'edit') {
        setShowProjectionModal(true)
      } else if (passwordAction === 'delete') {
        executeDeleteProjection()
      } else if (passwordAction === 'create') {
        executeCreateProjection()
      }
      
      setPasswordAction(null)
    } else {
      alert('Senha incorreta!')
      setPasswordInput('')
    }
  }

  // Função para solicitar senha antes de editar %
  const handleEditPercentages = () => {
    setPasswordAction('edit')
    setShowPasswordDialog(true)
  }

  // Função para solicitar senha antes de deletar
  const handleDeleteClick = () => {
    setPasswordAction('delete')
    setShowPasswordDialog(true)
  }

  // Função para solicitar senha antes de criar projeção
  const handleCreateProjectionClick = () => {
    setPasswordAction('create')
    setShowPasswordDialog(true)
  }

  // Função para deletar cenário de projeção
  const executeDeleteProjection = () => {
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
    
    // A remoção do Redis será tratada automaticamente pelo useEffect de persistência
    // quando projectionScenarios.length === 0, ele chama deleteProjectionData
    
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
    const projected = JSON.parse(JSON.stringify(safeDreData))
    
    // Índices de linhas editáveis (não calculadas)
    const editableIndices = [0, 1, 2, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20]
    
    // Aplicar percentuais às linhas editáveis
    editableIndices.forEach(index => {
      if (percentages[index]) {
        projected[index].meses = safeDreData[index].meses.map((val: number, monthIdx: number) => {
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
    // Retorna initialDreData se dreData estiver vazio para evitar erros durante renderização inicial
    return dreData.length > 0 ? dreData : initialDreData
  }
  
  // Dados DRE com fallback para initialDreData (evita erros quando dreData está vazio)
  const safeDreData = dreData.length > 0 ? dreData : initialDreData
  
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
  // Dados ativos (original ou projetado)
  const activeDreData = getActiveData()
  
  // Calcular totais dinamicamente a partir dos dados ativos
  const totais = activeDreData.length > 0 ? {
    volumeTotal: activeDreData[0]?.total || 0,
    receitaLiquida: activeDreData[1]?.total || 0,
    lucroOperacional: activeDreData[21]?.total || 0,
    margemOperacional: activeDreData[21]?.percentTotal || 0,
    ticketMedio: activeDreData[0]?.total ? activeDreData[1]?.total / activeDreData[0]?.total : 0,
    totalDespesas: Math.abs((activeDreData[7]?.total || 0) + (activeDreData[8]?.total || 0) + (activeDreData[9]?.total || 0) + (activeDreData[10]?.total || 0) + (activeDreData[11]?.total || 0)),
    despesasPessoal: Math.abs(activeDreData[7]?.total || 0),
    despesasTerceiros: Math.abs(activeDreData[8]?.total || 0),
    despesasOcupacao: Math.abs(activeDreData[9]?.total || 0),
    despesasFuncionamento: Math.abs(activeDreData[10]?.total || 0),
    despesasVendas: Math.abs(activeDreData[11]?.total || 0),
    lucroBruto: activeDreData[3]?.total || 0,
    rendasOperacionais: activeDreData[5]?.total || 0
  } : {
    volumeTotal: initialDreData[0].total,
    receitaLiquida: initialDreData[1].total,
    lucroOperacional: initialDreData[21].total,
    margemOperacional: initialDreData[21].percentTotal || 0,
    ticketMedio: initialDreData[1].total / initialDreData[0].total,
    totalDespesas: Math.abs(initialDreData[7].total + initialDreData[8].total + initialDreData[9].total + initialDreData[10].total + initialDreData[11].total),
    despesasPessoal: Math.abs(initialDreData[7].total),
    despesasTerceiros: Math.abs(initialDreData[8].total),
    despesasOcupacao: Math.abs(initialDreData[9].total),
    despesasFuncionamento: Math.abs(initialDreData[10].total),
    despesasVendas: Math.abs(initialDreData[11].total),
    lucroBruto: initialDreData[3].total,
    rendasOperacionais: initialDreData[5].total
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

  // ========== HANDLERS PARA FATOS RELEVANTES ==========
  
  const mesesOptions = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  const handleAddFatoRelevante = () => {
    const novoFato: FatoRelevante = {
      id: Date.now().toString(),
      mes: 'Janeiro',
      descricao: '',
      impacto: 'Positivo',
      valor: 0
    };
    const novosFatos = [...fatosRelevantes, novoFato];
    setFatosRelevantes(novosFatos);
    setEditingFatoId(novoFato.id);
  };
  
  const handleEditFato = (id: string) => {
    setEditingFatoId(id);
  };
  
  const handleSaveFato = (id: string) => {
    setEditingFatoId(null);
    saveFatosRelevantes(fiscalYear, department, fatosRelevantes, brand);
  };
  
  const handleDeleteFato = (id: string) => {
    const novosFatos = fatosRelevantes.filter(fato => fato.id !== id);
    setFatosRelevantes(novosFatos);
    saveFatosRelevantes(fiscalYear, department, novosFatos, brand);
    if (editingFatoId === id) {
      setEditingFatoId(null);
    }
  };
  
  const handleChangeFato = (id: string, field: 'mes' | 'descricao' | 'impacto' | 'valor', value: string | number) => {
    const novosFatos = fatosRelevantes.map(fato => {
      if (fato.id === id) {
        return { ...fato, [field]: value };
      }
      return fato;
    });
    setFatosRelevantes(novosFatos);
  };

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
  
  // REMOVIDO: Este useEffect estava causando conflito com o carregamento inicial
  // O carregamento correto já acontece no useEffect das linhas 240-275
  // useEffect(() => {
  //   if (dreData.length === 0) {
  //     setDreData(initialDreData)
  //   }
  // }, [])
  
  // Carregar projeções do Redis quando mudar departamento/ano/marca
  useEffect(() => {
    const newContext = `${brand}_${fiscalYear}_${department}`
    
    // Sempre resetar e recarregar quando o contexto mudar
    isLoadingProjections.current = true
    currentProjectionContext.current = newContext
    
    console.log(`[Projeções] Carregando do Redis para contexto: ${newContext}`)
    
    // Carregar projeções do Redis de forma assíncrona
    loadProjectionData(fiscalYear, department, brand).then((data) => {
      if (data && data.scenarios && data.scenarios.length > 0) {
        console.log(`[Projeções] Encontrado ${data.scenarios.length} cenário(s) no Redis para ${department}`)
        
        setProjectionScenarios(data.scenarios)
        setProjectionPercentages(data.percentages || {})
        setProjectedData(data.projectedData || {})
        
        if (data.activeScenario && data.activeScenario !== '') {
          setActiveScenario(data.activeScenario)
          setProjectionMode(true)
        } else {
          setActiveScenario(null)
          setProjectionMode(false)
        }
      } else {
        console.log(`[Projeções] Nenhuma projeção salva no Redis para ${department}`)
        setProjectionScenarios([])
        setProjectionPercentages({})
        setProjectedData({})
        setActiveScenario(null)
        setProjectionMode(false)
      }
      
      // Permitir salvamento após um pequeno delay
      setTimeout(() => {
        isLoadingProjections.current = false
      }, 100)
    }).catch((error) => {
      console.error('[Projeções] Erro ao carregar do Redis:', error)
      setProjectionScenarios([])
      setProjectionPercentages({})
      setProjectedData({})
      setActiveScenario(null)
      setProjectionMode(false)
      isLoadingProjections.current = false
    })
  }, [brand, fiscalYear, department])
  
  // Persistir projeções no Redis (apenas quando não está carregando)
  useEffect(() => {
    // Não salvar durante o carregamento inicial
    if (isLoadingProjections.current) {
      return
    }
    
    // Verificar se o contexto ainda é o mesmo
    const currentContext = `${brand}_${fiscalYear}_${department}`
    if (currentProjectionContext.current !== currentContext) {
      return
    }
    
    // Salvar no Redis
    const projectionData: ProjectionData = {
      scenarios: projectionScenarios,
      percentages: projectionPercentages,
      projectedData: projectedData,
      activeScenario: activeScenario
    }
    
    if (projectionScenarios.length > 0) {
      console.log(`[Projeções] Salvando ${projectionScenarios.length} cenário(s) no Redis para ${department}`)
      saveProjectionData(fiscalYear, department, projectionData, brand)
    } else {
      console.log(`[Projeções] Removendo projeções do Redis para ${department}`)
      deleteProjectionData(fiscalYear, department, brand)
    }
  }, [projectionScenarios, projectionPercentages, projectedData, activeScenario, brand, fiscalYear, department])
  
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
  
  // Meses dinâmicos baseados no ano fiscal selecionado (para gráficos de Dados Adicionais)
  const yearSuffix = fiscalYear.toString().slice(-2)
  const dynamicMonths = monthNames.map(m => `${m}/${yearSuffix}`)
  
  // Índices de linhas editáveis (não calculadas)
  const editableLineIndices = [0, 1, 2, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20]

  // Renderizar view de comparação se ativa
  if (currentView === 'comparison') {
    return (
      <YearComparison 
        onBack={() => setCurrentView('dashboard')}
        initialYear1={fiscalYear}
        initialYear2={fiscalYear === 2024 ? 2025 : (fiscalYear - 1) as any}
        department={department}
        brand={brand}
      />
    )
  }

  return (
    <>
      {/* Diálogo de Senha para Proteção */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Senha Necessária</DialogTitle>
            <DialogDescription>
              Digite a senha para {passwordAction === 'edit' ? 'editar percentuais' : passwordAction === 'delete' ? 'deletar a projeção' : 'criar projeção'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Input
                type="password"
                placeholder="Digite a senha"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePasswordSubmit()
                  }
                }}
                autoFocus
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordDialog(false)
                  setPasswordInput('')
                  setPasswordAction(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handlePasswordSubmit}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              <div 
                className="rounded-xl p-3 shadow-lg cursor-pointer hover:opacity-80 transition-opacity"
                style={{ background: `linear-gradient(135deg, ${brandConfig.colors.primary}, ${brandConfig.colors.secondary})` }}
                onClick={onChangeBrand}
                title="Clique para trocar de marca"
              >
                <span className="text-white font-bold text-3xl">{brandConfig.shortName}</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Dashboard Executivo - {brandConfig.name}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {DEPARTMENT_LABELS[department]} • Análise Gerencial • Atualizado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={onChangeBrand}
                variant="outline"
                size="sm"
                className="gap-2 bg-red-600 dark:bg-red-700 border-red-700 dark:border-red-800 hover:bg-red-700 dark:hover:bg-red-800"
              >
                <Building2 className="w-4 h-4 text-blue-950 dark:text-blue-900" />
                <span className="text-blue-950 dark:text-blue-900 font-bold">Trocar Marca</span>
              </Button>
              <Button
                onClick={() => setCurrentView('comparison')}
                variant="outline"
                size="sm"
                className="gap-2 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900"
              >
                <GitCompare className="w-4 h-4" />
                Comparar Anos
              </Button>
              <Select value={fiscalYear.toString()} onValueChange={handleFiscalYearChange}>
                <SelectTrigger className="w-[180px] bg-yellow-400 dark:bg-yellow-500 border-yellow-500 dark:border-yellow-600">
                  <SelectValue>
                    <span className="text-green-700 dark:text-green-800 font-bold text-base">
                      Ano Fiscal {fiscalYear}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">
                    <span className="font-semibold">Ano Fiscal 2024</span>
                  </SelectItem>
                  <SelectItem value="2025">
                    <span className="font-semibold">Ano Fiscal 2025</span>
                  </SelectItem>
                  <SelectItem value="2026">
                    <span className="font-semibold">Ano Fiscal 2026</span>
                  </SelectItem>
                  <SelectItem value="2027">
                    <span className="font-semibold">Ano Fiscal 2027</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Badge 
                className="px-4 py-2 text-sm"
                style={{ 
                  backgroundColor: `${brandConfig.colors.primary}15`,
                  color: brandConfig.colors.primary,
                  borderColor: `${brandConfig.colors.primary}30`
                }}
              >
                Confidencial
              </Badge>
            </div>
          </div>
          
          {/* Tabs de Departamentos */}
          <div className="mt-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {DEPARTMENTS.map((dept) => (
                <button
                  key={dept}
                  onClick={() => setDepartment(dept)}
                  className={`
                    px-6 py-2.5 rounded-t-lg text-sm font-medium transition-all whitespace-nowrap
                    ${department === dept
                      ? 'bg-[#001E50] text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }
                  `}
                >
                  {DEPARTMENT_LABELS[dept]}
                </button>
              ))}
            </div>
          </div>
          
          {/* Controles de Projeção e Cenários */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Button
              onClick={handleCreateProjectionClick}
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
                  onClick={handleEditPercentages}
                  variant="outline"
                  size="sm"
                >
                  Editar %
                </Button>
                <Button
                  onClick={handleDeleteClick}
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

          {/* Insights */}
          {showInsights && (
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                    <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">INSIGHTS</CardTitle>
                  </div>
                  <button
                    onClick={() => setShowInsights(false)}
                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    title="Ocultar Insights"
                  >
                    <TrendingDown className="w-5 h-5" />
                  </button>
                </div>
              </CardHeader>
            <CardContent>
              {(() => {
                // Verificar se dreData tem os dados necessários
                if (!activeDreData || activeDreData.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                      Dados insuficientes para calcular insights
                    </div>
                  );
                }
                
                // Usar dados do DRE
                // Índice 0: Volume de Vendas
                // Índice 1: Receita Operacional Líquida (Faturamento)
                // Índice 6: Margem de Contribuição
                // Índice 7-11: Despesas (Pessoal, Terceiros, Ocupação, Funcionamento, Vendas)
                // Índice 12: Resultado Operacional Líquido
                
                const volumeData = aggregateData(activeDreData[0]?.meses || []);
                const faturamentoData = aggregateData(activeDreData[1]?.meses || []);
                const margemContribuicaoData = aggregateData(activeDreData[6]?.meses || []);
                
                // Somar todas as categorias de despesas (linhas 7 a 11)
                const despesasData = aggregateData([...Array(12)].map((_, i) => 
                  Math.abs(activeDreData[7]?.meses?.[i] || 0) + 
                  Math.abs(activeDreData[8]?.meses?.[i] || 0) + 
                  Math.abs(activeDreData[9]?.meses?.[i] || 0) + 
                  Math.abs(activeDreData[10]?.meses?.[i] || 0) + 
                  Math.abs(activeDreData[11]?.meses?.[i] || 0)
                ));
                
                const labels = getPeriodLabels();
                
                // Encontrar maior e menor
                const findMaxMin = (data: number[]) => {
                  const maxValue = Math.max(...data);
                  const minValue = Math.min(...data);
                  const maxIndex = data.indexOf(maxValue);
                  const minIndex = data.indexOf(minValue);
                  return { maxValue, minValue, maxIndex, minIndex };
                };
                
                const volume = findMaxMin(volumeData);
                const faturamento = findMaxMin(faturamentoData);
                const margemContribuicao = findMaxMin(margemContribuicaoData);
                const despesas = findMaxMin(despesasData);
                
                // Usar Lucro (Prejuízo) Antes dos Impostos diretamente do DRE (índice 18)
                const resultadoData = aggregateData(activeDreData[18]?.meses || []);
                const resultado = findMaxMin(resultadoData);
                
                // Calcular margem % usando Resultado / Receita Operacional Líquida
                const margemData = resultadoData.map((r, i) => faturamentoData[i] > 0 ? (r / faturamentoData[i]) * 100 : 0);
                const margem = findMaxMin(margemData);

                return (
                  <div className="space-y-6">
                    {/* Insights Mensais */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Volume */}
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 font-medium">Volume</p>
                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <TrendingUp className="w-3 h-3 text-emerald-500" />
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Maior</span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{labels[volume.maxIndex]}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{volume.maxValue.toLocaleString('pt-BR')} unid.</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <TrendingDown className="w-3 h-3 text-red-500" />
                              <span className="text-xs text-red-600 dark:text-red-400 font-medium">Menor</span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{labels[volume.minIndex]}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{volume.minValue.toLocaleString('pt-BR')} unid.</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Receita Líquida */}
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 font-medium">Receita Líquida</p>
                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <TrendingUp className="w-3 h-3 text-emerald-500" />
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Maior</span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{labels[faturamento.maxIndex]}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">R$ {faturamento.maxValue.toLocaleString('pt-BR')}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <TrendingDown className="w-3 h-3 text-red-500" />
                              <span className="text-xs text-red-600 dark:text-red-400 font-medium">Menor</span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{labels[faturamento.minIndex]}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">R$ {faturamento.minValue.toLocaleString('pt-BR')}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Margem de Contribuição */}
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 font-medium">Margem de Contribuição</p>
                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <TrendingUp className="w-3 h-3 text-emerald-500" />
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Maior</span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{labels[margemContribuicao.maxIndex]}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">R$ {margemContribuicao.maxValue.toLocaleString('pt-BR')}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <TrendingDown className="w-3 h-3 text-red-500" />
                              <span className="text-xs text-red-600 dark:text-red-400 font-medium">Menor</span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{labels[margemContribuicao.minIndex]}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">R$ {margemContribuicao.minValue.toLocaleString('pt-BR')}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Despesas */}
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 font-medium">Despesas</p>
                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <TrendingUp className="w-3 h-3 text-red-500" />
                              <span className="text-xs text-red-600 dark:text-red-400 font-medium">Maior</span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{labels[despesas.maxIndex]}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">R$ {despesas.maxValue.toLocaleString('pt-BR')}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <TrendingDown className="w-3 h-3 text-emerald-500" />
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Menor</span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{labels[despesas.minIndex]}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">R$ {despesas.minValue.toLocaleString('pt-BR')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Lucro (Prejuízo) Antes dos Impostos */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <DollarSign className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">LUCRO (PREJUÍZO) ANTES DOS IMPOSTOS</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Por Valor Absoluto */}
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 font-medium">Por Valor Absoluto</p>
                          <div className="space-y-2">
                            <div>
                              <div className="flex items-center gap-1 mb-1">
                                <TrendingUp className="w-3 h-3 text-emerald-500" />
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Melhor</span>
                              </div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{labels[resultado.maxIndex]}</p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">R$ {resultado.maxValue.toLocaleString('pt-BR')}</p>
                            </div>
                            <div>
                              <div className="flex items-center gap-1 mb-1">
                                <TrendingDown className="w-3 h-3 text-red-500" />
                                <span className="text-xs text-red-600 dark:text-red-400 font-medium">Pior</span>
                              </div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{labels[resultado.minIndex]}</p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">R$ {resultado.minValue.toLocaleString('pt-BR')}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Por Margem % */}
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 font-medium">Por Margem %</p>
                          <div className="space-y-2">
                            <div>
                              <div className="flex items-center gap-1 mb-1">
                                <TrendingUp className="w-3 h-3 text-emerald-500" />
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Melhor</span>
                              </div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{labels[margem.maxIndex]}</p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">{margem.maxValue.toFixed(2)}%</p>
                            </div>
                            <div>
                              <div className="flex items-center gap-1 mb-1">
                                <TrendingDown className="w-3 h-3 text-red-500" />
                                <span className="text-xs text-red-600 dark:text-red-400 font-medium">Pior</span>
                              </div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{labels[margem.minIndex]}</p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">{margem.minValue.toFixed(2)}%</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
            </Card>
          )}

          {/* Botão para mostrar Insights quando oculto */}
          {!showInsights && (
            <div className="mt-6">
              <button
                onClick={() => setShowInsights(true)}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700 transition-all"
              >
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm font-semibold">Mostrar Insights</span>
              </button>
            </div>
          )}

          {/* Dados Adicionais */}
          {showDadosAdicionais && (
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                      <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">Dados Adicionais</CardTitle>
                    </div>
                    <CardDescription className="text-xs">Configurações e filtros complementares</CardDescription>
                  </div>
                  <button
                    onClick={() => setShowDadosAdicionais(false)}
                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    title="Ocultar Dados Adicionais"
                  >
                    <TrendingDown className="w-5 h-5" />
                  </button>
                </div>
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

                {department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'vendaDireta' && department !== 'usados' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'usados' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'usados' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'usados' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}
                
                {/* Botão para Vendas Mercado Livre */}
                {department !== 'novos' && department !== 'vendaDireta' && department !== 'usados' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'vendaDireta' && department !== 'usados' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'usados' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'usados' && department !== 'pecas' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'usados' && department !== 'pecas' && department !== 'oficina' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'usados' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && (
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
                )}

                {department !== 'vendaDireta' && department !== 'usados' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'usados' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'usados' && department !== 'pecas' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'usados' && department !== 'pecas' && department !== 'oficina' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'usados' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && (
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
                )}

                {department !== 'vendaDireta' && department !== 'usados' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                )}

                {department !== 'vendaDireta' && department !== 'usados' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                    setShowReceitaBlindagem(false)
                    setShowReceitaDespachanteUsados(false)
                    setShowReceitaDespachanteNovos(false)
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'usados' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
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
                    setShowReceitaBlindagem(false)
                    setShowReceitaDespachanteUsados(false)
                    setShowReceitaDespachanteNovos(false)
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'usados' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && (
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
                    setShowReceitaBlindagem(false)
                    setShowReceitaDespachanteUsados(false)
                    setShowReceitaDespachanteNovos(false)
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
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'usados' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && (
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
                )}

                {department !== 'vendaDireta' && department !== 'usados' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
                <button
                  onClick={() => {
                    setShowReceitaBlindagem(!showReceitaBlindagem)
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
                    setShowCreditoPISCofinsAdministracao(false)
                    setShowReceitaDespachanteUsados(false)
                    setShowReceitaDespachanteNovos(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showReceitaBlindagem 
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400 dark:border-indigo-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Receita de Blindagem</span>
                  <span className="text-[10px] opacity-80">Receita Adicional</span>
                </button>
                )}

                {department !== 'novos' && department !== 'vendaDireta' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
                <button
                  onClick={() => {
                    setShowReceitaDespachanteUsados(!showReceitaDespachanteUsados)
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
                    setShowCreditoPISCofinsAdministracao(false)
                    setShowReceitaBlindagem(false)
                    setShowReceitaDespachanteNovos(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showReceitaDespachanteUsados 
                      ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-400 dark:border-teal-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Receita de Despachante Usados</span>
                  <span className="text-[10px] opacity-80">Receita Adicional</span>
                </button>
                )}

                {department !== 'vendaDireta' && department !== 'usados' && department !== 'pecas' && department !== 'oficina' && department !== 'funilaria' && department !== 'administracao' && (
                <button
                  onClick={() => {
                    setShowReceitaDespachanteNovos(!showReceitaDespachanteNovos)
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
                    setShowCreditoPISCofinsAdministracao(false)
                    setShowReceitaBlindagem(false)
                    setShowReceitaDespachanteUsados(false)
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                    showReceitaDespachanteNovos 
                      ? 'bg-lime-50 dark:bg-lime-900/20 border-lime-400 dark:border-lime-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  } text-slate-700 dark:text-slate-300 hover:border-lime-300 hover:bg-lime-50 dark:hover:bg-slate-700`}
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-semibold">Receita de Despachante Novos</span>
                  <span className="text-[10px] opacity-80">Receita Adicional</span>
                </button>
                )}
              </div>
            </CardContent>
            </Card>
          )}

          {/* Botão para mostrar Dados Adicionais quando oculto */}
          {!showDadosAdicionais && (
            <div className="mt-6">
              <button
                onClick={() => setShowDadosAdicionais(true)}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700 transition-all"
              >
                <BarChart3 className="w-5 h-5" />
                <span className="text-sm font-semibold">Mostrar Dados Adicionais</span>
              </button>
            </div>
          )}

          {/* Fatos Relevantes no Resultado */}
          {showFatosRelevantes && (
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                      <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">Fatos Relevantes no Resultado</CardTitle>
                    </div>
                    <CardDescription className="text-xs">Registro de fatos relevantes que impactaram o resultado</CardDescription>
                  </div>
                  <button
                    onClick={() => setShowFatosRelevantes(false)}
                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    title="Ocultar Fatos Relevantes"
                  >
                    <TrendingDown className="w-5 h-5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Toggle "Fatos Relevantes" */}
                <div className="space-y-4">
                  <button
                    onClick={() => setFatosRelevantesExpanded(!fatosRelevantesExpanded)}
                    className="w-full flex items-center justify-center p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all relative"
                  >
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">Fatos Relevantes</span>
                      {fatosRelevantes.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {fatosRelevantes.length} {fatosRelevantes.length === 1 ? 'item' : 'itens'}
                        </Badge>
                      )}
                    </div>
                    <ChevronDown 
                      className={`w-5 h-5 text-slate-500 dark:text-slate-400 transition-transform duration-200 absolute right-4 ${
                        fatosRelevantesExpanded ? 'transform rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Conteúdo do Toggle */}
                  {fatosRelevantesExpanded && (
                    <div className="space-y-4 animate-in fade-in-50 duration-200">
                      {/* Botão Adicionar Linha */}
                      <div className="flex justify-end">
                        <Button
                          onClick={handleAddFatoRelevante}
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar Linha
                        </Button>
                      </div>

                      {/* Tabela */}
                      {fatosRelevantes.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-slate-100 dark:bg-slate-800">
                                <th className="border border-slate-300 dark:border-slate-600 px-4 py-2 text-left text-sm font-semibold w-32">Mês</th>
                                <th className="border border-slate-300 dark:border-slate-600 px-4 py-2 text-left text-sm font-semibold">Descrição do Fato Relevante</th>
                                <th className="border border-slate-300 dark:border-slate-600 px-4 py-2 text-left text-sm font-semibold w-32">Impacto</th>
                                <th className="border border-slate-300 dark:border-slate-600 px-4 py-2 text-left text-sm font-semibold w-40">Valor</th>
                                <th className="border border-slate-300 dark:border-slate-600 px-4 py-2 text-center text-sm font-semibold w-24">Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fatosRelevantes.map((fato) => {
                                const isEditing = editingFatoId === fato.id;
                                return (
                                  <tr key={fato.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="border border-slate-300 dark:border-slate-600 px-4 py-2">
                                      {isEditing ? (
                                        <Select
                                          value={fato.mes}
                                          onValueChange={(value) => handleChangeFato(fato.id, 'mes', value)}
                                        >
                                          <SelectTrigger className="w-full">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {mesesOptions.map((mes) => (
                                              <SelectItem key={mes} value={mes}>
                                                {mes}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <span className="text-sm">{fato.mes}</span>
                                      )}
                                    </td>
                                    <td className="border border-slate-300 dark:border-slate-600 px-4 py-2">
                                      {isEditing ? (
                                        <Input
                                          type="text"
                                          value={fato.descricao}
                                          onChange={(e) => handleChangeFato(fato.id, 'descricao', e.target.value)}
                                          className="w-full"
                                          placeholder="Digite a descrição"
                                        />
                                      ) : (
                                        <span className="text-sm">{fato.descricao}</span>
                                      )}
                                    </td>
                                    <td className="border border-slate-300 dark:border-slate-600 px-4 py-2">
                                      {isEditing ? (
                                        <Select
                                          value={fato.impacto}
                                          onValueChange={(value) => handleChangeFato(fato.id, 'impacto', value as 'Positivo' | 'Negativo' | 'Nulo')}
                                        >
                                          <SelectTrigger className="w-full">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="Positivo">Positivo</SelectItem>
                                            <SelectItem value="Negativo">Negativo</SelectItem>
                                            <SelectItem value="Nulo">Nulo</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <span className="text-sm">{fato.impacto}</span>
                                      )}
                                    </td>
                                    <td className="border border-slate-300 dark:border-slate-600 px-4 py-2">
                                      {isEditing ? (
                                        <Input
                                          type="number"
                                          value={fato.valor}
                                          onChange={(e) => handleChangeFato(fato.id, 'valor', parseFloat(e.target.value) || 0)}
                                          className="w-full"
                                          placeholder="0.00"
                                          step="0.01"
                                        />
                                      ) : (
                                        <span className="text-sm">
                                          {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL'
                                          }).format(fato.valor)}
                                        </span>
                                      )}
                                    </td>
                                    <td className="border border-slate-300 dark:border-slate-600 px-4 py-2">
                                      <div className="flex items-center justify-center gap-2">
                                        {isEditing ? (
                                          <>
                                            <Button
                                              size="sm"
                                              variant="default"
                                              onClick={() => handleSaveFato(fato.id)}
                                              className="p-2"
                                              title="Salvar"
                                            >
                                              <Save className="w-4 h-4" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => setEditingFatoId(null)}
                                              className="p-2"
                                              title="Cancelar"
                                            >
                                              <X className="w-4 h-4" />
                                            </Button>
                                          </>
                                        ) : (
                                          <>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleEditFato(fato.id)}
                                              className="p-2"
                                              title="Editar"
                                            >
                                              <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="destructive"
                                              onClick={() => handleDeleteFato(fato.id)}
                                              className="p-2"
                                              title="Excluir"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                          <p className="text-sm">Nenhum fato relevante registrado.</p>
                          <p className="text-xs mt-1">Clique em "Adicionar Linha" para começar.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botão para mostrar Fatos Relevantes quando oculto */}
          {!showFatosRelevantes && (
            <div className="mt-6">
              <button
                onClick={() => setShowFatosRelevantes(true)}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700 transition-all"
              >
                <DollarSign className="w-5 h-5" />
                <span className="text-sm font-semibold">Mostrar Fatos Relevantes</span>
              </button>
            </div>
          )}
          
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
                        Análise de receita, lucro e margem por departamento - {fiscalYear}
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
                    {sharedMetricsData.vendasPecas?.balcao && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg">
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          Peças Balcão
                        </h3>
                      </div>
                      
                      {(() => {
                        const receitaTotal = sharedMetricsData.vendasPecas?.balcao?.vendas?.reduce((a, b) => a + b, 0) || 0;
                        const lucroTotal = sharedMetricsData.vendasPecas?.balcao?.lucro?.reduce((a, b) => a + b, 0) || 0;
                        const margemMedia = calculateMonthlyAverage(sharedMetricsData.vendasPecas?.balcao?.margem || []);

                        const chartData = dynamicMonths.map((month, index) => {
                          const receitaAtual = sharedMetricsData.vendasPecas?.balcao?.vendas[index] || 0;
                          const receitaAnterior = index > 0 ? (sharedMetricsData.vendasPecas?.balcao?.vendas[index - 1] || 0) : receitaAtual;
                          const variacao = receitaAnterior !== 0 ? ((receitaAtual - receitaAnterior) / receitaAnterior) * 100 : 0;

                          return {
                            month,
                            receita: receitaAtual,
                            margem: sharedMetricsData.vendasPecas?.balcao?.margem[index] || 0,
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
                    )}

                    {/* Gráfico 2: Oficina (ID 9) */}
                    {sharedMetricsData.vendasPecas?.oficina && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg">
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          Peças Oficina
                        </h3>
                      </div>
                      
                      {(() => {
                        const receitaTotal = sharedMetricsData.vendasPecas?.oficina?.vendas?.reduce((a, b) => a + b, 0) || 0;
                        const lucroTotal = sharedMetricsData.vendasPecas?.oficina?.lucro?.reduce((a, b) => a + b, 0) || 0;
                        const margemMedia = calculateMonthlyAverage(sharedMetricsData.vendasPecas?.oficina?.margem || []);

                        const chartData = dynamicMonths.map((month, index) => {
                          const receitaAtual = sharedMetricsData.vendasPecas?.oficina?.vendas[index] || 0;
                          const receitaAnterior = index > 0 ? (sharedMetricsData.vendasPecas?.oficina?.vendas[index - 1] || 0) : receitaAtual;
                          const variacao = receitaAnterior !== 0 ? ((receitaAtual - receitaAnterior) / receitaAnterior) * 100 : 0;

                          return {
                            month,
                            receita: receitaAtual,
                            margem: sharedMetricsData.vendasPecas?.oficina?.margem[index] || 0,
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
                    )}

                    {/* Gráfico 3: Funilaria (ID 10) */}
                    {sharedMetricsData.vendasPecas?.funilaria && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg">
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          Peças Funilaria
                        </h3>
                      </div>
                      
                      {(() => {
                        const receitaTotal = sharedMetricsData.vendasPecas?.funilaria?.vendas?.reduce((a, b) => a + b, 0) || 0;
                        const lucroTotal = sharedMetricsData.vendasPecas?.funilaria?.lucro?.reduce((a, b) => a + b, 0) || 0;
                        const margemMedia = calculateMonthlyAverage(sharedMetricsData.vendasPecas?.funilaria?.margem || []);

                        const chartData = dynamicMonths.map((month, index) => {
                          const receitaAtual = sharedMetricsData.vendasPecas?.funilaria?.vendas[index] || 0;
                          const receitaAnterior = index > 0 ? (sharedMetricsData.vendasPecas?.funilaria?.vendas[index - 1] || 0) : receitaAtual;
                          const variacao = receitaAnterior !== 0 ? ((receitaAtual - receitaAnterior) / receitaAnterior) * 100 : 0;

                          return {
                            month,
                            receita: receitaAtual,
                            margem: sharedMetricsData.vendasPecas?.funilaria?.margem[index] || 0,
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
                    )}

                    {/* Gráfico 4: Acessórios (ID 11) */}
                    {sharedMetricsData.vendasPecas?.acessorios && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg">
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          Peças Acessórios
                        </h3>
                      </div>
                      
                      {(() => {
                        const receitaTotal = sharedMetricsData.vendasPecas?.acessorios?.vendas?.reduce((a, b) => a + b, 0) || 0;
                        const lucroTotal = sharedMetricsData.vendasPecas?.acessorios?.lucro?.reduce((a, b) => a + b, 0) || 0;
                        const margemMedia = calculateMonthlyAverage(sharedMetricsData.vendasPecas?.acessorios?.margem || []);

                        const chartData = dynamicMonths.map((month, index) => {
                          const receitaAtual = sharedMetricsData.vendasPecas?.acessorios?.vendas[index] || 0;
                          const receitaAnterior = index > 0 ? (sharedMetricsData.vendasPecas?.acessorios?.vendas[index - 1] || 0) : receitaAtual;
                          const variacao = receitaAnterior !== 0 ? ((receitaAtual - receitaAnterior) / receitaAnterior) * 100 : 0;

                          return {
                            month,
                            receita: receitaAtual,
                            margem: sharedMetricsData.vendasPecas?.acessorios?.margem[index] || 0,
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
                    )}

                    {/* Gráfico 5: Total Consolidado (ID 8 + ID 9 + ID 10 + ID 11) */}
                    {sharedMetricsData.vendasPecas?.balcao && sharedMetricsData.vendasPecas?.oficina && 
                     sharedMetricsData.vendasPecas?.funilaria && sharedMetricsData.vendasPecas?.acessorios && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          Total Consolidado
                        </h3>
                        {(() => {
                          // Calcular vendas consolidadas (soma de Balcão + Oficina + Funilaria + Acessórios)
                          const vendasConsolidadas = dynamicMonths.map((_, index) => 
                            (sharedMetricsData.vendasPecas?.balcao?.vendas[index] || 0) +
                            (sharedMetricsData.vendasPecas?.oficina?.vendas[index] || 0) +
                            (sharedMetricsData.vendasPecas?.funilaria?.vendas[index] || 0) +
                            (sharedMetricsData.vendasPecas?.acessorios?.vendas[index] || 0)
                          );
                          
                          const ultimaReceita = vendasConsolidadas[11];
                          const penultimaReceita = vendasConsolidadas[10];
                          const variacao = penultimaReceita !== 0 ? ((ultimaReceita - penultimaReceita) / penultimaReceita) * 100 : 0;
                          
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
                        const vendasConsolidadas = dynamicMonths.map((_, index) => 
                          (sharedMetricsData.vendasPecas?.balcao?.vendas[index] || 0) +
                          (sharedMetricsData.vendasPecas?.oficina?.vendas[index] || 0) +
                          (sharedMetricsData.vendasPecas?.funilaria?.vendas[index] || 0) +
                          (sharedMetricsData.vendasPecas?.acessorios?.vendas[index] || 0)
                        );
                        
                        const lucroConsolidado = dynamicMonths.map((_, index) => 
                          (sharedMetricsData.vendasPecas?.balcao?.lucro[index] || 0) +
                          (sharedMetricsData.vendasPecas?.oficina?.lucro[index] || 0) +
                          (sharedMetricsData.vendasPecas?.funilaria?.lucro[index] || 0) +
                          (sharedMetricsData.vendasPecas?.acessorios?.lucro[index] || 0)
                        );
                        
                        const margemConsolidada = dynamicMonths.map((_, index) => 
                          vendasConsolidadas[index] !== 0 ? (lucroConsolidado[index] / vendasConsolidadas[index]) * 100 : 0
                        );
                        
                        const receitaTotal = vendasConsolidadas.reduce((a, b) => a + b, 0);
                        const lucroTotal = lucroConsolidado.reduce((a, b) => a + b, 0);
                        const margemMedia = calculateMonthlyAverage(margemConsolidada);

                        const chartData = dynamicMonths.map((month, index) => {
                          const receitaAtual = vendasConsolidadas[index];
                          const receitaAnterior = index > 0 ? vendasConsolidadas[index - 1] : receitaAtual;
                          const variacao = receitaAnterior !== 0 ? ((receitaAtual - receitaAnterior) / receitaAnterior) * 100 : 0;

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
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card de Vendas por Seguradora */}
            {showVendasSeguradora && sharedMetricsData.seguradoras && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mt-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        Vendas por Seguradora - Performance {fiscalYear}
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
                        const totalVendas = sharedMetricsData.seguradoras?.portoSeguro?.vendas?.reduce((a, b) => a + b, 0) || 0;
                        const totalLucro = sharedMetricsData.seguradoras?.portoSeguro?.lucro?.reduce((a, b) => a + b, 0) || 0;
                        const margemMedia = calculateMonthlyAverage(sharedMetricsData.seguradoras?.portoSeguro?.margem || []);
                        const ultimaVenda = sharedMetricsData.seguradoras?.portoSeguro?.vendas[11] || 0;
                        const penultimaVenda = sharedMetricsData.seguradoras?.portoSeguro?.vendas[10] || 0;
                        const variacaoMes = penultimaVenda !== 0 ? ((ultimaVenda - penultimaVenda) / penultimaVenda) * 100 : 0;
                        
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
                          <ComposedChart data={dynamicMonths.map((month, index) => {
                            const vendaAtual = sharedMetricsData.seguradoras?.portoSeguro?.vendas[index] || 0;
                            const vendaAnterior = index > 0 ? (sharedMetricsData.seguradoras?.portoSeguro?.vendas[index - 1] || 0) : vendaAtual;
                            const variacaoMesAnt = vendaAnterior !== 0 && index > 0 ? ((vendaAtual - vendaAnterior) / vendaAnterior) * 100 : 0;
                            
                            return {
                              month,
                              receitaLiquida: vendaAtual,
                              receitaLiquida3d: vendaAtual * 0.92,
                              margem: sharedMetricsData.seguradoras?.portoSeguro?.margem[index] || 0,
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
                        const totalVendas = sharedMetricsData.seguradoras?.azul?.vendas?.reduce((a, b) => a + b, 0) || 0;
                        const totalLucro = sharedMetricsData.seguradoras?.azul?.lucro?.reduce((a, b) => a + b, 0) || 0;
                        const margemMedia = calculateMonthlyAverage(sharedMetricsData.seguradoras?.azul?.margem || []);
                        const ultimaVenda = sharedMetricsData.seguradoras?.azul?.vendas[11] || 0;
                        const penultimaVenda = sharedMetricsData.seguradoras?.azul?.vendas[10] || 0;
                        const variacaoMes = penultimaVenda !== 0 ? ((ultimaVenda - penultimaVenda) / penultimaVenda) * 100 : 0;
                        
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
                          <ComposedChart data={dynamicMonths.map((month, index) => {
                            const vendaAtual = sharedMetricsData.seguradoras?.azul?.vendas[index] || 0;
                            const vendaAnterior = index > 0 ? (sharedMetricsData.seguradoras?.azul?.vendas[index - 1] || 0) : vendaAtual;
                            const variacaoMesAnt = vendaAnterior !== 0 && index > 0 ? ((vendaAtual - vendaAnterior) / vendaAnterior) * 100 : 0;
                            
                            return {
                              month,
                              receitaLiquida: vendaAtual,
                              receitaLiquida3d: vendaAtual * 0.92,
                              margem: sharedMetricsData.seguradoras?.azul?.margem[index] || 0,
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
                        const totalVendas = sharedMetricsData.seguradoras?.allianz?.vendas?.reduce((a, b) => a + b, 0) || 0;
                        const totalLucro = sharedMetricsData.seguradoras?.allianz?.lucro?.reduce((a, b) => a + b, 0) || 0;
                        const margemMedia = calculateMonthlyAverage(sharedMetricsData.seguradoras?.allianz?.margem || []);
                        const ultimaVenda = sharedMetricsData.seguradoras?.allianz?.vendas[11] || 0;
                        const penultimaVenda = sharedMetricsData.seguradoras?.allianz?.vendas[10] || 0;
                        const variacaoMes = penultimaVenda !== 0 ? ((ultimaVenda - penultimaVenda) / penultimaVenda) * 100 : 0;
                        
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
                          <ComposedChart data={dynamicMonths.map((month, index) => {
                            const vendaAtual = sharedMetricsData.seguradoras?.allianz?.vendas[index] || 0;
                            const vendaAnterior = index > 0 ? (sharedMetricsData.seguradoras?.allianz?.vendas[index - 1] || 0) : vendaAtual;
                            const variacaoMesAnt = vendaAnterior !== 0 && index > 0 ? ((vendaAtual - vendaAnterior) / vendaAnterior) * 100 : 0;
                            
                            return {
                              month,
                              receitaLiquida: vendaAtual,
                              receitaLiquida3d: vendaAtual * 0.92,
                              margem: sharedMetricsData.seguradoras?.allianz?.margem[index] || 0,
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
                        // Usar dados dinâmicos de sharedMetricsData em vez de valores hardcoded
                        const vendas = sharedMetricsData.seguradoras?.tokioMarine?.vendas || Array(12).fill(0);
                        const lucros = sharedMetricsData.seguradoras?.tokioMarine?.lucro || Array(12).fill(0);
                        const margens = vendas.map((v, i) => v > 0 ? (lucros[i] / v * 100) : 0);
                        
                        const totalVendas = vendas.reduce((a, b) => a + b, 0);
                        const totalLucro = lucros.reduce((a, b) => a + b, 0);
                        const margemMedia = totalVendas > 0 ? (totalLucro / totalVendas * 100) : 0;
                        
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
                          <ComposedChart data={dynamicMonths.map((month, index) => {
                            // Usar dados dinâmicos de sharedMetricsData em vez de valores hardcoded
                            const vendas = sharedMetricsData.seguradoras?.tokioMarine?.vendas || Array(12).fill(0);
                            const lucros = sharedMetricsData.seguradoras?.tokioMarine?.lucro || Array(12).fill(0);
                            
                            const vendaAtual = vendas[index] || 0;
                            const vendaAnterior = index > 0 ? (vendas[index - 1] || 0) : vendaAtual;
                            const variacaoMesAnt = index > 0 && vendaAnterior > 0 ? ((vendaAtual - vendaAnterior) / vendaAnterior) * 100 : 0;
                            const margem = vendaAtual > 0 ? ((lucros[index] || 0) / vendaAtual) * 100 : 0;
                            
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
                                  const monthIndex = metricsData.months.indexOf(data.month);
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
                        // Usar dados dinâmicos de sharedMetricsData - soma de todas as seguradoras
                        const portoVendas = sharedMetricsData.seguradoras?.portoSeguro?.vendas || Array(12).fill(0);
                        const portoLucros = sharedMetricsData.seguradoras?.portoSeguro?.lucro || Array(12).fill(0);
                        const azulVendas = sharedMetricsData.seguradoras?.azul?.vendas || Array(12).fill(0);
                        const azulLucros = sharedMetricsData.seguradoras?.azul?.lucro || Array(12).fill(0);
                        const allianzVendas = sharedMetricsData.seguradoras?.allianz?.vendas || Array(12).fill(0);
                        const allianzLucros = sharedMetricsData.seguradoras?.allianz?.lucro || Array(12).fill(0);
                        const tokioVendas = sharedMetricsData.seguradoras?.tokioMarine?.vendas || Array(12).fill(0);
                        const tokioLucros = sharedMetricsData.seguradoras?.tokioMarine?.lucro || Array(12).fill(0);
                        
                        // Calcular total consolidado (soma de todas as seguradoras por mês)
                        const vendas = portoVendas.map((_, i) => 
                          (portoVendas[i] || 0) + (azulVendas[i] || 0) + (allianzVendas[i] || 0) + (tokioVendas[i] || 0)
                        );
                        const lucros = portoLucros.map((_, i) => 
                          (portoLucros[i] || 0) + (azulLucros[i] || 0) + (allianzLucros[i] || 0) + (tokioLucros[i] || 0)
                        );
                        
                        const totalVendas = vendas.reduce((a, b) => a + b, 0);
                        const totalLucro = lucros.reduce((a, b) => a + b, 0);
                        const margemMedia = totalVendas > 0 ? (totalLucro / totalVendas * 100) : 0;
                        const ultimaVenda = vendas[11] || 0;
                        const penultimaVenda = vendas[10] || 0;
                        const variacaoMes = penultimaVenda > 0 ? ((ultimaVenda - penultimaVenda) / penultimaVenda) * 100 : 0;
                        
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
                          <ComposedChart data={dynamicMonths.map((month, index) => {
                            // Usar dados dinâmicos de sharedMetricsData - soma de todas as seguradoras
                            const portoVendas = sharedMetricsData.seguradoras?.portoSeguro?.vendas || Array(12).fill(0);
                            const portoLucros = sharedMetricsData.seguradoras?.portoSeguro?.lucro || Array(12).fill(0);
                            const azulVendas = sharedMetricsData.seguradoras?.azul?.vendas || Array(12).fill(0);
                            const azulLucros = sharedMetricsData.seguradoras?.azul?.lucro || Array(12).fill(0);
                            const allianzVendas = sharedMetricsData.seguradoras?.allianz?.vendas || Array(12).fill(0);
                            const allianzLucros = sharedMetricsData.seguradoras?.allianz?.lucro || Array(12).fill(0);
                            const tokioVendas = sharedMetricsData.seguradoras?.tokioMarine?.vendas || Array(12).fill(0);
                            const tokioLucros = sharedMetricsData.seguradoras?.tokioMarine?.lucro || Array(12).fill(0);
                            
                            const vendaAtual = (portoVendas[index] || 0) + (azulVendas[index] || 0) + (allianzVendas[index] || 0) + (tokioVendas[index] || 0);
                            const lucroAtual = (portoLucros[index] || 0) + (azulLucros[index] || 0) + (allianzLucros[index] || 0) + (tokioLucros[index] || 0);
                            
                            const vendaAnterior = index > 0 ? 
                              (portoVendas[index - 1] || 0) + (azulVendas[index - 1] || 0) + (allianzVendas[index - 1] || 0) + (tokioVendas[index - 1] || 0) 
                              : vendaAtual;
                            const variacaoMesAnt = index > 0 && vendaAnterior > 0 ? ((vendaAtual - vendaAnterior) / vendaAnterior) * 100 : 0;
                            const margem = vendaAtual > 0 ? (lucroAtual / vendaAtual) * 100 : 0;
                            
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
                        Vendas Mercado Livre - Performance {fiscalYear}
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
                        const vendas = sharedMetricsData.mercadoLivre?.vendas || [];
                        const lucros = sharedMetricsData.mercadoLivre?.lucro || [];
                        
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
                          <ComposedChart data={dynamicMonths.map((month, index) => {
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
                                  const monthIndex = metricsData.months.indexOf(data.month);
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
                        Despesas Financeiras Novos - Análise {fiscalYear}
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
                      const jurosData = sharedMetricsData.juros?.veiculosNovos || [];
                      const totalJuros = jurosData.reduce((a, b) => a + b, 0);
                      const mediaJuros = calculateMonthlyAverage(jurosData);
                      const ultimoJuros = jurosData[11];
                      const penultimoJuros = jurosData[10];
                      const variacaoJuros = ((ultimoJuros - penultimoJuros) / penultimoJuros) * 100;

                      const jurosChartData = dynamicMonths.map((month, index) => {
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
                      const despesasData = sharedMetricsData.despesasCartao?.novos || [];
                      const totalDespesas = despesasData.reduce((a, b) => a + b, 0);
                      const mediaDespesas = calculateMonthlyAverage(despesasData);
                      const ultimaDespesa = despesasData[11];
                      const penultimaDespesa = despesasData[10];
                      const variacaoDespesas = ((ultimaDespesa - penultimaDespesa) / penultimaDespesa) * 100;

                      const despesasChartData = dynamicMonths.map((month, index) => {
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
                                  R$ {totalDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
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
                                  R$ {ultimaDespesa.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
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
                                              <p className="text-lg font-bold text-orange-600">R$ {data.valor.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
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
                        Despesas Financeiras Usados - Análise {fiscalYear}
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
                      const jurosData = sharedMetricsData.juros?.veiculosUsados || [];
                      const totalJuros = jurosData.reduce((a, b) => a + b, 0);
                      const mediaJuros = calculateMonthlyAverage(jurosData);
                      const ultimoJuros = jurosData[11];
                      const penultimoJuros = jurosData[10];
                      const variacaoJuros = ((ultimoJuros - penultimoJuros) / penultimoJuros) * 100;

                      const jurosChartData = dynamicMonths.map((month, index) => {
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

                    {/* Gráfico 2: ID27 - Despesas Cartão Usados */}
                    {(() => {
                      const despesasData = sharedMetricsData.despesasCartao?.usados || [];
                      const totalDespesas = despesasData.reduce((a, b) => a + b, 0);
                      const mediaDespesas = calculateMonthlyAverage(despesasData);
                      const ultimaDespesa = despesasData[11];
                      const penultimaDespesa = despesasData[10];
                      const variacaoDespesas = ((ultimaDespesa - penultimaDespesa) / penultimaDespesa) * 100;

                      const despesasChartData = dynamicMonths.map((month, index) => {
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
                        Despesas Financeiras Peças - Análise {fiscalYear}
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
                      const jurosData = sharedMetricsData.juros?.pecas || [];
                      const totalJuros = jurosData.reduce((a, b) => a + b, 0);
                      const mediaJuros = calculateMonthlyAverage(jurosData);
                      const ultimoJuros = jurosData[11];

                      const jurosChartData = dynamicMonths.map((month, index) => {
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

                    {/* Gráfico 2: ID28 - Despesas Cartão Peças */}
                    {(() => {
                      const despesasData = sharedMetricsData.despesasCartao?.pecas || [];
                      const totalDespesas = despesasData.reduce((a, b) => a + b, 0);
                      const mediaDespesas = calculateMonthlyAverage(despesasData);
                      const ultimaDespesa = despesasData[11];

                      const despesasChartData = dynamicMonths.map((month, index) => {
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
                        Despesas Financeiras Oficina - Análise {fiscalYear}
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
                    
                    {/* Gráfico: ID29 - Despesas Cartão Oficina */}
                    {(() => {
                      const despesasData = sharedMetricsData.despesasCartao?.oficina || [];
                      const totalDespesas = despesasData.reduce((a, b) => a + b, 0);
                      const mediaDespesas = calculateMonthlyAverage(despesasData);
                      const ultimaDespesa = despesasData[11];

                      const despesasChartData = dynamicMonths.map((month, index) => {
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
                        Despesas Financeiras Funilaria - Análise {fiscalYear}
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
                    
                    {/* Gráfico: ID30 - Despesas Cartão Funilaria */}
                    {(() => {
                      const despesasData = sharedMetricsData.despesasCartao?.funilaria || [];
                      const totalDespesas = despesasData.reduce((a, b) => a + b, 0);
                      const mediaDespesas = calculateMonthlyAverage(despesasData);
                      const ultimaDespesa = despesasData[11];

                      const despesasChartData = dynamicMonths.map((month, index) => {
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
                                  R$ {totalDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
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
                                  R$ {ultimaDespesa.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
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
                                              <p className="text-lg font-bold text-blue-600">R$ {data.valor.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
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
                        Despesas Financeiras Administração - Análise {fiscalYear}
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
                      const jurosData = sharedMetricsData.juros?.emprestimosBancarios || [];
                      const totalJuros = jurosData.reduce((a, b) => a + b, 0);
                      const mediaJuros = calculateMonthlyAverage(jurosData);
                      const ultimoJuros = jurosData[11];

                      const jurosChartData = dynamicMonths.map((month, index) => {
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
                      const jurosData = sharedMetricsData.juros?.contratoMutuo || [];
                      const totalJuros = jurosData.reduce((a, b) => a + b, 0);
                      const mediaJuros = 