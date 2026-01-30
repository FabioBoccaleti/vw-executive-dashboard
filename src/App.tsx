import { useState, useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { VWFinancialDashboard } from '@/components/VWFinancialDashboard'
import { BrandSelector } from '@/components/BrandSelector'
import { Brand, getSavedBrand, saveBrand, applyBrandTheme } from '@/lib/brands'
import { initializeFromDatabase, isProduction } from '@/lib/dataStorage'

function App() {
  const [brand, setBrand] = useState<Brand | null>(null)
  // Sempre mostra o seletor de marca ao iniciar a aplicação
  const [showBrandSelector, setShowBrandSelector] = useState(true)
  const [dbLoading, setDbLoading] = useState(true)
  const [dbError, setDbError] = useState<string | null>(null)
  
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
  
  const handleBrandSelect = (selectedBrand: Brand) => {
    saveBrand(selectedBrand)
    setBrand(selectedBrand)
    applyBrandTheme(selectedBrand)
    setShowBrandSelector(false)
  }
  
  const handleChangeBrand = () => {
    setShowBrandSelector(true)
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
      <VWFinancialDashboard 
        brand={brand} 
        onChangeBrand={handleChangeBrand}
      />
      <Toaster />
    </div>
  )
}

export default App
