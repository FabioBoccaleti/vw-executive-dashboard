/**
 * BrandSelector - Componente de seleção de marca
 *
 * Tela inicial para seleção da marca antes de entrar no dashboard.
 * Menu principal com 3 categorias:
 *   1. Demonstrativo de Resultados → expande sub-opções de marcas
 *   2. Sistema de Gerenciamento e Aprovação de Despesas
 *   3. Fluxo de Caixa
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BRAND_CONFIGS, type Brand } from '@/lib/brands';
import { Building2, Car, ChevronRight, ChevronDown, Layers, CheckCircle, DollarSign, BarChart2, Settings } from 'lucide-react';
import { PasswordDialog } from '@/components/PasswordDialog';

// Sub-marcas do Demonstrativo de Resultados
const DEMONSTRATIVO_BRANDS: Brand[] = ['vw', 'audi', 'consolidado', 'vw_outros', 'audi_outros'];

// Opções diretas (sem sub-marcas)
const DIRECT_BRANDS: Brand[] = ['aprovacao_despesas', 'fluxo_caixa'];

// Marcas que requerem senha para acesso
const PROTECTED_BRANDS: Brand[] = ['vw_outros', 'audi_outros', 'aprovacao_despesas', 'fluxo_caixa'];

interface BrandSelectorProps {
  onSelectBrand: (brand: Brand) => void;
  currentBrand?: Brand;
  onAdminClick?: () => void;
}

export function BrandSelector({ onSelectBrand, currentBrand, onAdminClick }: BrandSelectorProps) {
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(currentBrand || null);
  const [hoveredBrand, setHoveredBrand] = useState<Brand | null>(null);
  const [demonstrativoExpanded, setDemonstrativoExpanded] = useState<boolean>(
    currentBrand ? DEMONSTRATIVO_BRANDS.includes(currentBrand) : false
  );
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  const handleToggleDemonstrativo = () => {
    setDemonstrativoExpanded(prev => {
      if (prev && selectedBrand && DEMONSTRATIVO_BRANDS.includes(selectedBrand)) {
        setSelectedBrand(null);
      }
      return !prev;
    });
  };

  const handleSelectBrand = (brand: Brand) => {
    setSelectedBrand(brand);
  };

  const handleSelectDirect = (brand: Brand) => {
    if (demonstrativoExpanded) setDemonstrativoExpanded(false);
    setSelectedBrand(brand);
  };

  const handleConfirm = () => {
    if (!selectedBrand) return;
    if (PROTECTED_BRANDS.includes(selectedBrand)) {
      setShowPasswordDialog(true);
    } else {
      onSelectBrand(selectedBrand);
    }
  };

  const handlePasswordSuccess = () => {
    if (selectedBrand) onSelectBrand(selectedBrand);
  };

  const getBrandIcon = (brand: Brand, size = 'w-8 h-8') => {
    if (brand === 'consolidado') return <Layers className={size} />;
    if (brand === 'aprovacao_despesas') return <CheckCircle className={size} />;
    if (brand === 'fluxo_caixa') return <DollarSign className={size} />;
    if (brand.includes('vw')) return <Car className={size} />;
    return <Building2 className={size} />;
  };

  const isDemonstrativoSelected = selectedBrand ? DEMONSTRATIVO_BRANDS.includes(selectedBrand) : false;
  const confirmColor = selectedBrand ? BRAND_CONFIGS[selectedBrand].colors.primary : '#94a3b8';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-800 dark:text-white mb-3">
            Controle Financeiro Sorana
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Selecione uma opção para acessar o painel
          </p>
        </div>

        {/* ── 3 categorias em linha ── */}
        <div className="grid grid-cols-1 gap-3 mb-8">

          {/* Demonstrativo de Resultados */}
          <Card
            className={`transition-all duration-300 h-full ${
              demonstrativoExpanded || isDemonstrativoSelected
                ? 'ring-2 ring-offset-2 shadow-lg'
                : 'hover:shadow-md cursor-pointer'
            }`}
            style={{
              ['--tw-ring-color' as any]: '#4f46e5',
              borderColor: demonstrativoExpanded || isDemonstrativoSelected ? '#4f46e5' : undefined,
            }}
          >
            {/* Cabeçalho clicável */}
            <CardContent
              className="p-5 flex flex-col items-center justify-center gap-3 text-center cursor-pointer"
              style={{ minHeight: demonstrativoExpanded ? undefined : '140px' }}
              onClick={handleToggleDemonstrativo}
            >
              <div
                className="p-3 rounded-full transition-colors duration-300"
                style={{
                  backgroundColor: demonstrativoExpanded || isDemonstrativoSelected ? '#ede9fe' : '#f1f5f9',
                  color: '#4f46e5',
                }}
              >
                <BarChart2 className="w-8 h-8" />
              </div>
              <h3
                className="text-base font-bold transition-colors duration-300"
                style={{ color: demonstrativoExpanded || isDemonstrativoSelected ? '#4f46e5' : '#334155' }}
              >
                Demonstrativo de Resultados
              </h3>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${demonstrativoExpanded ? 'rotate-180' : ''}`}
              />
            </CardContent>

            {/* Sub-marcas dentro do card */}
            {demonstrativoExpanded && (
              <div className="px-3 pb-4 grid grid-cols-5 gap-2 animate-in fade-in slide-in-from-top-2 duration-300 border-t border-slate-100 pt-3">
                {DEMONSTRATIVO_BRANDS.map((brand) => {
                  const config = BRAND_CONFIGS[brand];
                  const isSelected = selectedBrand === brand;
                  const isHovered = hoveredBrand === brand;
                  return (
                    <Card
                      key={brand}
                      className={`cursor-pointer transition-all duration-200 ${
                        isSelected ? 'ring-2 ring-offset-1 shadow-md' : 'hover:shadow-md'
                      }`}
                      style={{
                        borderColor: isSelected ? config.colors.primary : undefined,
                        ['--tw-ring-color' as any]: config.colors.primary,
                      }}
                      onClick={() => handleSelectBrand(brand)}
                      onMouseEnter={() => setHoveredBrand(brand)}
                      onMouseLeave={() => setHoveredBrand(null)}
                    >
                      <CardContent className="p-2 flex flex-col items-center justify-center gap-1 text-center min-h-[90px]">
                        <div
                          className="p-2 rounded-full transition-colors duration-200"
                          style={{
                            backgroundColor: isSelected || isHovered ? config.colors.primaryLight : '#f1f5f9',
                            color: config.colors.primary,
                          }}
                        >
                          {getBrandIcon(brand, 'w-5 h-5')}
                        </div>
                        <h3
                          className="text-xs font-bold"
                          style={{ color: isSelected || isHovered ? config.colors.primary : '#334155' }}
                        >
                          {config.name}
                        </h3>
                        {isSelected && (
                          <div
                            className="px-1.5 py-0.5 rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: config.colors.primary }}
                          >
                            Selecionado
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Categorias diretas */}
          {DIRECT_BRANDS.map((brand) => {
            const config = BRAND_CONFIGS[brand];
            const isSelected = selectedBrand === brand;
            const isHovered = hoveredBrand === brand;
            return (
              <Card
                key={brand}
                className={`cursor-pointer transition-all duration-300 h-full ${
                  isSelected ? 'ring-2 ring-offset-2 scale-[1.02] shadow-xl' : 'hover:shadow-md'
                }`}
                style={{
                  borderColor: isSelected ? config.colors.primary : undefined,
                  ['--tw-ring-color' as any]: config.colors.primary,
                }}
                onClick={() => handleSelectDirect(brand)}
                onMouseEnter={() => setHoveredBrand(brand)}
                onMouseLeave={() => setHoveredBrand(null)}
              >
                <CardContent className="p-5 flex flex-col items-center justify-center min-h-[140px] gap-3 text-center">
                  <div
                    className="p-3 rounded-full transition-colors duration-300"
                    style={{
                      backgroundColor: isSelected || isHovered ? config.colors.primaryLight : '#f1f5f9',
                      color: config.colors.primary,
                    }}
                  >
                    {getBrandIcon(brand)}
                  </div>
                  <h3
                    className="text-base font-bold transition-colors duration-300"
                    style={{ color: isSelected || isHovered ? config.colors.primary : '#334155' }}
                  >
                    {config.name}
                  </h3>
                  {isSelected && (
                    <div
                      className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: config.colors.primary }}
                    >
                      Selecionado
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Confirm Button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            disabled={!selectedBrand}
            onClick={handleConfirm}
            className={`px-8 py-6 text-lg font-semibold transition-all duration-300 ${
              selectedBrand ? 'opacity-100 hover:scale-105' : 'opacity-50 cursor-not-allowed'
            }`}
            style={{ backgroundColor: confirmColor, color: 'white' }}
          >
            Acessar
            <ChevronRight className="ml-2 w-5 h-5" />
          </Button>
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
          Você poderá trocar de opção a qualquer momento pelo menu do dashboard
        </p>
      </div>

      <PasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onSuccess={handlePasswordSuccess}
        title="Acesso Restrito"
        description={`O acesso a ${selectedBrand ? BRAND_CONFIGS[selectedBrand].name : ''} requer autorização. Digite a senha para continuar:`}
      />

      {/* Botão Admin fixo no canto inferior direito - visível apenas para admins */}
      {onAdminClick && (
        <button
          onClick={onAdminClick}
          title="Painel Administrativo"
          className="fixed bottom-6 right-6 p-3 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 shadow-md transition-colors duration-200 z-50"
        >
          <Settings className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
