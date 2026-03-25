import { useState, useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { VWFinancialDashboard } from '@/components/VWFinancialDashboard'
import { DespesasDashboard } from '@/components/DespesasDashboard'
import { FluxoCaixaDashboard } from '@/components/FluxoCaixaDashboard'
import { VendasBonificacoesDashboard } from '@/components/VendasBonificacoesDashboard'
import { VendasSelectionPage } from '@/components/VendasBonificacoesDashboard/VendasSelectionPage'
import { PeliculasDashboard } from '@/components/VendasBonificacoesDashboard/PeliculasDashboard'
import { ImportarPDFPage } from '@/components/VendasBonificacoesDashboard/ImportarPDFPage'
import { CadastrosPage } from '@/components/CadastrosPage'
import { BrandSelector } from '@/components/BrandSelector'
import { Brand, getSavedBrand, saveBrand, applyBrandTheme } from '@/lib/brands'
import { initializeFromDatabase, isProduction, saveSelectedFiscalYear } from '@/lib/dataStorage'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { LoginScreen } from '@/components/LoginScreen'
import { AdminPage } from '@/components/AdminPage'

function AppContent() {
  const { session, isLoading: authLoading, isAdmin, logout } = useAuth()
  const [brand, setBrand] = useState<Brand | null>(null)
  // Sempre mostra o seletor de marca ao iniciar a aplicação
  const [showBrandSelector, setShowBrandSelector] = useState(true)
  const [dbLoading, setDbLoading] = useState(true)
  const [dbError, setDbError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState<'app' | 'admin' | 'cadastros'>(() =>
    window.location.pathname === '/admin' ? 'admin' : 'app'
  )
  const [vendasSubPage, setVendasSubPage] = useState<'selection' | 'blindagem' | 'peliculas' | 'importar-pdf'>('selection')
  const [cadastrosVariant, setCadastrosVariant] = useState<'blindagem' | 'peliculas'>('blindagem')
  
  // Inicializa o banco de dados em produção
  useEffect(() => {
    async function initDb() {
      if (isProduction()) {
        console.log('🚀 [APP] Ambiente de produção detectado - inicializando banco de dados...');
        try {
          const savedBrand = getSavedBrand();
          await initializeFromDatabase(savedBrand);
          console.log('✅ [APP] Banco de dados inicializado');
        } catch (error) {
          console.error('❌ [APP] Erro ao inicializar banco:', error);
          setDbError('Erro ao carregar dados do servidor');
        }
      } else {
        console.log('⚠️ [APP] Ambiente de desenvolvimento - dados em memória local');
      }
      setDbLoading(false);
    }
    
    initDb();
  }, []);
  
  useEffect(() => {
    // Carrega a marca salva para pré-selecionar no seletor, mas não navega automaticamente
    const savedBrand = getSavedBrand()
    if (savedBrand) {
      setBrand(savedBrand)
    }
  }, [])
  
  const DEMONSTRATIVO_BRANDS: Brand[] = ['vw', 'audi', 'consolidado', 'vw_outros', 'audi_outros']

  const handleBrandSelect = async (selectedBrand: Brand) => {
    saveBrand(selectedBrand)
    setBrand(selectedBrand)
    applyBrandTheme(selectedBrand)

    // Força ano fiscal 2026 ao entrar no Demonstrativo de Resultados
    if (DEMONSTRATIVO_BRANDS.includes(selectedBrand)) {
      saveSelectedFiscalYear(2026)
    }
    
    // Inicializa o banco de dados para a nova marca (se em produção)
    if (isProduction()) {
      console.log(`🔄 [APP] Inicializando banco de dados para marca: ${selectedBrand}`);
      try {
        await initializeFromDatabase(selectedBrand);
        console.log(`✅ [APP] Banco de dados inicializado para ${selectedBrand}`);
      } catch (error) {
        console.error(`❌ [APP] Erro ao inicializar banco para ${selectedBrand}:`, error);
      }
    }
    
    setShowBrandSelector(false)
    if (selectedBrand === 'vendas_bonificacoes') setVendasSubPage('selection')
  }
  
  const handleChangeBrand = () => {
    setVendasSubPage('selection')
    setShowBrandSelector(true)
  }

  const handleNavigateAdmin = () => {
    window.history.pushState({}, '', '/admin')
    setCurrentPage('admin')
  }

  const handleBackFromAdmin = () => {
    window.history.pushState({}, '', '/')
    setCurrentPage('app')
  }

  // Redireciona não-admins que chegam via URL /admin
  useEffect(() => {
    if (!authLoading && session && currentPage === 'admin' && session.role !== 'admin') {
      setCurrentPage('app')
      window.history.pushState({}, '', '/')
    }
  }, [authLoading, session, currentPage])

  // Spinner durante carregamento da sessão
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      </div>
    )
  }

  // Tela de login se não autenticado
  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <LoginScreen onSuccess={() => {}} />
        <Toaster />
      </div>
    )
  }

  // Painel administrativo
  if (currentPage === 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <AdminPage onBack={handleBackFromAdmin} />
        <Toaster />
      </div>
    )
  }

  // Página de cadastros
  if (currentPage === 'cadastros') {
    return (
      <div className="min-h-screen bg-background">
        <CadastrosPage onBack={() => setCurrentPage('app')} variant={cadastrosVariant} />
        <Toaster />
      </div>
    )
  }

  // Mostra loading enquanto inicializa o banco de dados
  if (dbLoading && isProduction()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-muted-foreground">Carregando dados do servidor...</div>
        </div>
      </div>
    )
  }
  
  // Mostra erro se houver problema ao carregar do banco
  if (dbError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-destructive">
          <div className="text-lg font-semibold mb-2">Erro ao carregar dados</div>
          <div className="text-sm text-muted-foreground">{dbError}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }
  
  // Mostra o seletor de marca
  if (showBrandSelector) {
    return (
      <div className="min-h-screen bg-background">
        <BrandSelector 
          onSelectBrand={handleBrandSelect} 
          currentBrand={brand || undefined}
          onAdminClick={isAdmin() ? handleNavigateAdmin : undefined}
          onLogout={logout}
        />
        <Toaster />
      </div>
    )
  }
  
  // Se não tiver marca, mostra loading
  if (!brand) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-background">
      {brand === 'aprovacao_despesas' ? (
        <DespesasDashboard onChangeBrand={handleChangeBrand} />
      ) : brand === 'fluxo_caixa' ? (
        <FluxoCaixaDashboard onChangeBrand={handleChangeBrand} />
      ) : brand === 'vendas_bonificacoes' ? (
        vendasSubPage === 'selection' ? (
          <VendasSelectionPage
            onSelect={(option) => setVendasSubPage(option)}
            onChangeBrand={handleChangeBrand}
          />
        ) : vendasSubPage === 'importar-pdf' ? (
          <ImportarPDFPage
            onBack={() => setVendasSubPage('selection')}
          />
        ) : vendasSubPage === 'peliculas' ? (
          <PeliculasDashboard
            onBack={() => setVendasSubPage('selection')}
            onOpenCadastros={() => { setCadastrosVariant('peliculas'); setCurrentPage('cadastros'); }}
          />
        ) : (
          <VendasBonificacoesDashboard
            onChangeBrand={() => setVendasSubPage('selection')}
            onOpenCadastros={() => { setCadastrosVariant('blindagem'); setCurrentPage('cadastros'); }}
          />
        )
      ) : (
        <VWFinancialDashboard 
          brand={brand} 
          onChangeBrand={handleChangeBrand}
        />
      )}
      <Toaster />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
