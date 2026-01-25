/**
 * BrandSelector - Componente de seleção de marca
 * 
 * Tela inicial para seleção da marca antes de entrar no dashboard.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BRAND_CONFIGS, AVAILABLE_BRANDS, type Brand } from '@/lib/brands';
import { Building2, Car, ChevronRight, Layers } from 'lucide-react';

interface BrandSelectorProps {
  onSelectBrand: (brand: Brand) => void;
  currentBrand?: Brand;
}

export function BrandSelector({ onSelectBrand, currentBrand }: BrandSelectorProps) {
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(currentBrand || null);
  const [hoveredBrand, setHoveredBrand] = useState<Brand | null>(null);

  const handleSelect = (brand: Brand) => {
    setSelectedBrand(brand);
  };

  const handleConfirm = () => {
    if (selectedBrand) {
      onSelectBrand(selectedBrand);
    }
  };

  const getBrandIcon = (brand: Brand) => {
    if (brand === 'consolidado') {
      return <Layers className="w-8 h-8" />;
    }
    if (brand.includes('vw')) {
      return <Car className="w-8 h-8" />;
    }
    return <Building2 className="w-8 h-8" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 dark:text-white mb-3">
            Dashboard Financeiro
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Selecione a marca para acessar o painel
          </p>
        </div>

        {/* Brand Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {AVAILABLE_BRANDS.map((brand) => {
            const config = BRAND_CONFIGS[brand];
            const isSelected = selectedBrand === brand;
            const isHovered = hoveredBrand === brand;

            return (
              <Card
                key={brand}
                className={`
                  cursor-pointer transition-all duration-300 transform
                  ${isSelected 
                    ? 'ring-4 ring-offset-2 scale-105 shadow-xl' 
                    : 'hover:shadow-lg hover:scale-102'
                  }
                  ${isHovered && !isSelected ? 'shadow-md' : ''}
                `}
                style={{
                  borderColor: isSelected ? config.colors.primary : undefined,
                  // Ring color is applied via CSS custom property
                  ['--tw-ring-color' as any]: isSelected ? config.colors.primary : undefined,
                }}
                onClick={() => handleSelect(brand)}
                onMouseEnter={() => setHoveredBrand(brand)}
                onMouseLeave={() => setHoveredBrand(null)}
              >
                <CardContent className="p-4 flex flex-col items-center justify-center min-h-[140px]">
                  {/* Brand Icon with color */}
                  <div
                    className="mb-3 p-3 rounded-full transition-colors duration-300"
                    style={{
                      backgroundColor: isSelected || isHovered 
                        ? config.colors.primaryLight 
                        : '#f1f5f9',
                      color: config.colors.primary,
                    }}
                  >
                    {getBrandIcon(brand)}
                  </div>

                  {/* Brand Name */}
                  <h3
                    className="text-base font-bold text-center transition-colors duration-300"
                    style={{
                      color: isSelected || isHovered 
                        ? config.colors.primary 
                        : '#334155',
                    }}
                  >
                    {config.name}
                  </h3>

                  {/* Selection indicator */}
                  {isSelected && (
                    <div
                      className="mt-2 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
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
            className={`
              px-8 py-6 text-lg font-semibold transition-all duration-300
              ${selectedBrand 
                ? 'opacity-100 transform hover:scale-105' 
                : 'opacity-50 cursor-not-allowed'
              }
            `}
            style={{
              backgroundColor: selectedBrand 
                ? BRAND_CONFIGS[selectedBrand].colors.primary 
                : '#94a3b8',
              color: 'white',
            }}
          >
            Acessar Dashboard
            <ChevronRight className="ml-2 w-5 h-5" />
          </Button>
        </div>

        {/* Footer info */}
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
          Você poderá trocar de marca a qualquer momento pelo menu do dashboard
        </p>
      </div>
    </div>
  );
}
