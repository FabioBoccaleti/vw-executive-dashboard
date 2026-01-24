import { useState, useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { VWFinancialDashboard } from '@/components/VWFinancialDashboard'
import { BrandSelector } from '@/components/BrandSelector'
import { Brand, getSavedBrand, saveBrand, applyBrandTheme } from '@/lib/brands'

function App() {
  const [brand, setBrand] = useState<Brand | null>(null)
  const [showBrandSelector, setShowBrandSelector] = useState(false)
  
  useEffect(() => {
    // Verifica se já existe uma marca salva
    const savedBrand = getSavedBrand()
    if (savedBrand) {
      setBrand(savedBrand)
      applyBrandTheme(savedBrand)
    } else {
      setShowBrandSelector(true)
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
