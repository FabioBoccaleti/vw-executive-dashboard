/**
 * Configuração de Marcas - Sistema Multimarcas
 * 
 * Este módulo gerencia as marcas disponíveis no sistema e suas configurações visuais.
 */

// Tipo para identificar a marca
export type Brand = 'vw' | 'audi' | 'vw_outros' | 'audi_outros';

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
};

// Lista de marcas disponíveis (para iteração)
export const AVAILABLE_BRANDS: Brand[] = ['vw', 'audi', 'vw_outros', 'audi_outros'];

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
