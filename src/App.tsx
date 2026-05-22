import { useState, useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { VWFinancialDashboard } from '@/components/VWFinancialDashboard'
import { DespesasDashboard } from '@/components/DespesasDashboard'
import { FluxoCaixaDashboard } from '@/components/FluxoCaixaDashboard'
import { VendasBonificacoesDashboard } from '@/components/VendasBonificacoesDashboard'
import { VendasSelectionPage } from '@/components/VendasBonificacoesDashboard/VendasSelectionPage'
import { PeliculasDashboard } from '@/components/VendasBonificacoesDashboard/PeliculasDashboard'
import { EsteticaDashboard } from '@/components/VendasBonificacoesDashboard/EsteticaDashboard'
import { ImportarPDFPage } from '@/components/VendasBonificacoesDashboard/ImportarPDFPage'
import { FinanciamentoBancoVolksDashboard } from '@/components/VendasBonificacoesDashboard/FinanciamentoBancoVolksDashboard'
import { VPecasCondicaoPagamentoDashboard } from '@/components/VendasBonificacoesDashboard/VPecasCondicaoPagamentoDashboard'
import { FolhaSelectionPage } from '@/components/FolhaPagamentoDashboard/FolhaSelectionPage'
import { SalariosFixosDashboard } from '@/components/FolhaPagamentoDashboard/SalariosFixosDashboard'
import { RemuneracoesPJDashboard } from '@/components/FolhaPagamentoDashboard/RemuneracoesPJDashboard'
import { CalculoComissoesVWPage } from '@/components/FolhaPagamentoDashboard/CalculoComissoesVWPage'
import { CadastrosPage } from '@/components/CadastrosPage'
import { BrandSelector } from '@/components/BrandSelector'
import { Brand, getSavedBrand, saveBrand, applyBrandTheme } from '@/lib/brands'
import { initializeFromDatabase, isProduction, saveSelectedFiscalYear } from '@/lib/dataStorage'
import { AuthProvider } from '@/contexts/AuthContext'
import { useAuth } from '@/contexts/useAuth'
import { LoginScreen } from '@/components/LoginScreen'
import { AdminPage } from '@/components/AdminPage'
import { CustosAlugueisDashboard } from '@/components/CustosAlugueisDashboard'
import { ResumoDREDashboard } from '@/components/ResumoDREDashboard'
import { AnaliseDespesasDashboard } from '@/components/AnaliseDespesasDashboard'

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
  const [vendasSubPage, setVendasSubPage] = useState<'selection' | 'blindagem' | 'peliculas' | 'estetica' | 'importar-pdf' | 'financiamento-banco-volks' | 'vpecas-condicao-pagamento' | 'despachante'>('selection')
  const [folhaSubPage, setFolhaSubPage] = useState<'selection' | 'salarios_fixo' | 'remuneracoes_pj' | 'calculo_comissoes_vw'>('selection')
  const [cadastrosVariant, setCadastrosVariant] = useState<'blindagem' | 'peliculas' | 'estetica'>('blindagem')
  
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
  
  const DEMONSTRATIVO_BRANDS: Brand[] = ['vw', 'audi', 'consolidado', 'resumo_dre', 'vw_outros', 'audi_outros']

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
    if (selectedBrand === 'folha_pagamento') setFolhaSubPage('selection')
  }
  
  const handleChangeBrand = () => {
    setVendasSubPage('selection')
    setFolhaSubPage('selection')
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
      ) : brand === 'folha_pagamento' ? (
        folhaSubPage === 'selection' ? (
          <FolhaSelectionPage
            onSelect={(option) => setFolhaSubPage(option)}
            onChangeBrand={handleChangeBrand}
          />
        ) : folhaSubPage === 'salarios_fixo' ? (
          <SalariosFixosDashboard onBack={() => setFolhaSubPage('selection')} />
        ) : folhaSubPage === 'remuneracoes_pj' ? (
          <RemuneracoesPJDashboard onBack={() => setFolhaSubPage('selection')} />
        ) : folhaSubPage === 'calculo_comissoes_vw' ? (
          <CalculoComissoesVWPage onBack={() => setFolhaSubPage('selection')} />
        ) : null
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
        ) : vendasSubPage === 'estetica' ? (
          <EsteticaDashboard
            onBack={() => setVendasSubPage('selection')}
            onOpenCadastros={() => { setCadastrosVariant('estetica'); setCurrentPage('cadastros'); }}
          />
        ) : vendasSubPage === 'financiamento-banco-volks' ? (
          <FinanciamentoBancoVolksDashboard
            onBack={() => setVendasSubPage('selection')}
          />
        ) : vendasSubPage === 'vpecas-condicao-pagamento' ? (
          <VPecasCondicaoPagamentoDashboard
            onBack={() => setVendasSubPage('selection')}
          />
        ) : vendasSubPage === 'despachante' ? (
          <div className="min-h-screen bg-slate-100 flex flex-col">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
              <div>
                <h1 className="text-lg font-bold text-slate-800">Serviços de Despachante</h1>
                <p className="text-xs text-slate-500 mt-0.5">Demonstrativo de Vendas e Bonificações</p>
              </div>
              <button
                onClick={() => setVendasSubPage('selection')}
                className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
              >
                ← Voltar
              </button>
            </header>
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.653-4.655m5.24-6.029-.79 2.895M5.28 8.28l2.895-.79M15 3h2.25M15 3v2.25M3 15h2.25M3 15v2.25" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-slate-700">Em desenvolvimento</p>
                <p className="text-sm text-slate-400">Este módulo estará disponível em breve.</p>
              </div>
            </div>
          </div>
        ) : (
          <VendasBonificacoesDashboard
            onChangeBrand={() => setVendasSubPage('selection')}
            onOpenCadastros={() => { setCadastrosVariant('blindagem'); setCurrentPage('cadastros'); }}
          />
        )
      ) : brand === 'custos_alugueis' ? (
        <CustosAlugueisDashboard onChangeBrand={handleChangeBrand} />
      ) : brand === 'analise_evolutiva_despesas' ? (
        <AnaliseDespesasDashboard onChangeBrand={handleChangeBrand} />
      ) : brand === 'resumo_dre' ? (
        <ResumoDREDashboard onChangeBrand={handleChangeBrand} />
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
