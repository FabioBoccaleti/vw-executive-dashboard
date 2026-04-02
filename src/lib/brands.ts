/**
 * Configuração de Marcas - Sistema Multimarcas
 * 
 * Este módulo gerencia as marcas disponíveis no sistema e suas configurações visuais.
 */

// Tipo para identificar a marca
export type Brand = 'vw' | 'audi' | 'consolidado' | 'vw_outros' | 'audi_outros' | 'aprovacao_despesas' | 'fluxo_caixa' | 'vendas_bonificacoes' | 'folha_pagamento';

// Interface de configuração visual da marca
export interface BrandConfig {
  id: Brand;
  name: string;
  shortName: string;
  logo?: string;
  colors: {
    primary: string;
    primaryHover: string;
    primaryLight: string;
    secondary: string;
    accent: string;
    headerBg: string;
    headerText: string;
    buttonBg: string;
    buttonText: string;
    badgeBg: string;
    badgeText: string;
  };
  cssVariables: {
    '--brand-primary': string;
    '--brand-primary-hover': string;
    '--brand-primary-light': string;
    '--brand-secondary': string;
    '--brand-accent': string;
  };
}

// Configurações das marcas
export const BRAND_CONFIGS: Record<Brand, BrandConfig> = {
  vw: {
    id: 'vw',
    name: 'Volkswagen',
    shortName: 'VW',
    colors: {
      primary: '#001e50',
      primaryHover: '#00306e',
      primaryLight: '#e8f4fc',
      secondary: '#00b0f0',
      accent: '#6eb9e8',
      headerBg: 'bg-[#001e50]',
      headerText: 'text-white',
      buttonBg: 'bg-[#001e50] hover:bg-[#00306e]',
      buttonText: 'text-white',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/30',
      badgeText: 'text-blue-800 dark:text-blue-200',
    },
    cssVariables: {
      '--brand-primary': '#001e50',
      '--brand-primary-hover': '#00306e',
      '--brand-primary-light': '#e8f4fc',
      '--brand-secondary': '#00b0f0',
      '--brand-accent': '#6eb9e8',
    }
  },
  consolidado: {
    id: 'consolidado',
    name: 'Consolidado',
    shortName: 'Consolidado',
    colors: {
      primary: '#7c3aed',
      primaryHover: '#6d28d9',
      primaryLight: '#f5f3ff',
      secondary: '#a78bfa',
      accent: '#8b5cf6',
      headerBg: 'bg-[#7c3aed]',
      headerText: 'text-white',
      buttonBg: 'bg-[#7c3aed] hover:bg-[#6d28d9]',
      buttonText: 'text-white',
      badgeBg: 'bg-violet-100 dark:bg-violet-900/30',
      badgeText: 'text-violet-800 dark:text-violet-200',
    },
    cssVariables: {
      '--brand-primary': '#7c3aed',
      '--brand-primary-hover': '#6d28d9',
      '--brand-primary-light': '#f5f3ff',
      '--brand-secondary': '#a78bfa',
      '--brand-accent': '#8b5cf6',
    }
  },
  audi: {
    id: 'audi',
    name: 'Audi',
    shortName: 'Audi',
    colors: {
      primary: '#bb0a30',
      primaryHover: '#990826',
      primaryLight: '#fce8ec',
      secondary: '#4a4a4a',
      accent: '#e2001a',
      headerBg: 'bg-[#bb0a30]',
      headerText: 'text-white',
      buttonBg: 'bg-[#bb0a30] hover:bg-[#990826]',
      buttonText: 'text-white',
      badgeBg: 'bg-red-100 dark:bg-red-900/30',
      badgeText: 'text-red-800 dark:text-red-200',
    },
    cssVariables: {
      '--brand-primary': '#bb0a30',
      '--brand-primary-hover': '#990826',
      '--brand-primary-light': '#fce8ec',
      '--brand-secondary': '#4a4a4a',
      '--brand-accent': '#e2001a',
    }
  },
  vw_outros: {
    id: 'vw_outros',
    name: 'VW Outros',
    shortName: 'VW Outros',
    colors: {
      primary: '#0066b3',
      primaryHover: '#0052a3',
      primaryLight: '#e0f0ff',
      secondary: '#5cb8e8',
      accent: '#99d6ff',
      headerBg: 'bg-[#0066b3]',
      headerText: 'text-white',
      buttonBg: 'bg-[#0066b3] hover:bg-[#0052a3]',
      buttonText: 'text-white',
      badgeBg: 'bg-sky-100 dark:bg-sky-900/30',
      badgeText: 'text-sky-800 dark:text-sky-200',
    },
    cssVariables: {
      '--brand-primary': '#0066b3',
      '--brand-primary-hover': '#0052a3',
      '--brand-primary-light': '#e0f0ff',
      '--brand-secondary': '#5cb8e8',
      '--brand-accent': '#99d6ff',
    }
  },
  audi_outros: {
    id: 'audi_outros',
    name: 'Audi Outros',
    shortName: 'Audi Outros',
    colors: {
      primary: '#d4475f',
      primaryHover: '#c23a51',
      primaryLight: '#fdf0f2',
      secondary: '#6b6b6b',
      accent: '#ff8097',
      headerBg: 'bg-[#d4475f]',
      headerText: 'text-white',
      buttonBg: 'bg-[#d4475f] hover:bg-[#c23a51]',
      buttonText: 'text-white',
      badgeBg: 'bg-rose-100 dark:bg-rose-900/30',
      badgeText: 'text-rose-800 dark:text-rose-200',
    },
    cssVariables: {
      '--brand-primary': '#d4475f',
      '--brand-primary-hover': '#c23a51',
      '--brand-primary-light': '#fdf0f2',
      '--brand-secondary': '#6b6b6b',
      '--brand-accent': '#ff8097',
    }
  },
  aprovacao_despesas: {
    id: 'aprovacao_despesas',
    name: 'Sistema de Gerenciamento e Aprovação de Despesas',
    shortName: 'Gerenciamento',
    fullName: 'Sistema de Gerenciamento e Aprovação de Despesas',
    colors: {
      primary: '#059669',
      primaryHover: '#047857',
      primaryLight: '#d1fae5',
      secondary: '#10b981',
      accent: '#34d399',
      headerBg: 'bg-[#059669]',
      headerText: 'text-white',
      buttonBg: 'bg-[#059669] hover:bg-[#047857]',
      buttonText: 'text-white',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      badgeText: 'text-emerald-800 dark:text-emerald-200',
    },
    cssVariables: {
      '--brand-primary': '#059669',
      '--brand-primary-hover': '#047857',
      '--brand-primary-light': '#d1fae5',
      '--brand-secondary': '#10b981',
      '--brand-accent': '#34d399',
    }
  },
  fluxo_caixa: {
    id: 'fluxo_caixa',
    name: 'Fluxo de caixa',
    shortName: 'Fluxo',
    colors: {
      primary: '#16a34a',
      primaryHover: '#15803d',
      primaryLight: '#dcfce7',
      secondary: '#22c55e',
      accent: '#4ade80',
      headerBg: 'bg-[#16a34a]',
      headerText: 'text-white',
      buttonBg: 'bg-[#16a34a] hover:bg-[#15803d]',
      buttonText: 'text-white',
      badgeBg: 'bg-green-100 dark:bg-green-900/30',
      badgeText: 'text-green-800 dark:text-green-200',
    },
    cssVariables: {
      '--brand-primary': '#16a34a',
      '--brand-primary-hover': '#15803d',
      '--brand-primary-light': '#dcfce7',
      '--brand-secondary': '#22c55e',
      '--brand-accent': '#4ade80',
    }
  },
  vendas_bonificacoes: {
    id: 'vendas_bonificacoes',
    name: 'Demonstrativo de Vendas e Bonificações',
    shortName: 'Vendas',
    colors: {
      primary: '#b45309',
      primaryHover: '#92400e',
      primaryLight: '#fef3c7',
      secondary: '#f59e0b',
      accent: '#fbbf24',
      headerBg: 'bg-[#b45309]',
      headerText: 'text-white',
      buttonBg: 'bg-[#b45309] hover:bg-[#92400e]',
      buttonText: 'text-white',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/30',
      badgeText: 'text-amber-800 dark:text-amber-200',
    },
    cssVariables: {
      '--brand-primary': '#b45309',
      '--brand-primary-hover': '#92400e',
      '--brand-primary-light': '#fef3c7',
      '--brand-secondary': '#f59e0b',
      '--brand-accent': '#fbbf24',
    }
  },
  folha_pagamento: {
    id: 'folha_pagamento',
    name: 'Folha de Pagamento',
    shortName: 'Folha',
    colors: {
      primary: '#0f766e',
      primaryHover: '#0d6460',
      primaryLight: '#ccfbf1',
      secondary: '#14b8a6',
      accent: '#2dd4bf',
      headerBg: 'bg-[#0f766e]',
      headerText: 'text-white',
      buttonBg: 'bg-[#0f766e] hover:bg-[#0d6460]',
      buttonText: 'text-white',
      badgeBg: 'bg-teal-100 dark:bg-teal-900/30',
      badgeText: 'text-teal-800 dark:text-teal-200',
    },
    cssVariables: {
      '--brand-primary': '#0f766e',
      '--brand-primary-hover': '#0d6460',
      '--brand-primary-light': '#ccfbf1',
      '--brand-secondary': '#14b8a6',
      '--brand-accent': '#2dd4bf',
    }
  },
};

// Lista de marcas disponíveis (para iteração) - ordem de exibição
export const AVAILABLE_BRANDS: Brand[] = ['vw', 'audi', 'consolidado', 'vw_outros', 'audi_outros', 'aprovacao_despesas', 'fluxo_caixa', 'vendas_bonificacoes', 'folha_pagamento'];

// Chave de armazenamento para marca selecionada
export const SELECTED_BRAND_KEY = 'selected_brand';

/**
 * Obtém a marca salva no localStorage ou retorna a padrão (VW)
 */
export function getSavedBrand(): Brand {
  if (typeof window === 'undefined') return 'vw';
  const saved = localStorage.getItem(SELECTED_BRAND_KEY);
  if (saved && AVAILABLE_BRANDS.includes(saved as Brand)) {
    return saved as Brand;
  }
  return 'vw';
}

/**
 * Salva a marca selecionada no localStorage
 */
export function saveBrand(brand: Brand): void {
  localStorage.setItem(SELECTED_BRAND_KEY, brand);
}

/**
 * Obtém a configuração da marca
 */
export function getBrandConfig(brand: Brand): BrandConfig {
  return BRAND_CONFIGS[brand];
}

/**
 * Aplica as variáveis CSS da marca ao documento
 */
export function applyBrandTheme(brand: Brand): void {
  const config = BRAND_CONFIGS[brand];
  const root = document.documentElement;
  
  Object.entries(config.cssVariables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

/**
 * Gera a chave de armazenamento com a marca
 */
export function getStorageKey(brand: Brand, baseKey: string): string {
  return `${brand}_${baseKey}`;
}
