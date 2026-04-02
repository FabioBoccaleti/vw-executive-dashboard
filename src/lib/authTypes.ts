// ─── Tipos compartilhados de autenticação ────────────────────────────────────

export type UserRole = 'admin' | 'gestor' | 'leitura';

export type ModuleId = 'demonstrativo' | 'despesas' | 'fluxo_caixa' | 'vendas_bonificacoes' | 'folha_pagamento';

export type BrandId = 'vw' | 'audi' | 'consolidado' | 'vw_outros' | 'audi_outros';

export const ALL_MODULES: ModuleId[] = ['demonstrativo', 'despesas', 'fluxo_caixa', 'vendas_bonificacoes', 'folha_pagamento'];

export const ALL_BRANDS: BrandId[] = ['vw', 'audi', 'consolidado', 'vw_outros', 'audi_outros'];

export const MODULE_LABELS: Record<ModuleId, string> = {
  demonstrativo: 'Demonstrativo de Resultados',
  despesas: 'Gerenciamento de Despesas',
  fluxo_caixa: 'Fluxo de Caixa',
  vendas_bonificacoes: 'Demonstrativo de Vendas e Bonificações',
  folha_pagamento: 'Folha de Pagamento',
};

export const BRAND_LABELS: Record<BrandId, string> = {
  vw: 'VW',
  audi: 'Audi',
  consolidado: 'Consolidado',
  vw_outros: 'VW Outros',
  audi_outros: 'Audi Outros',
};

// Subpermissões do módulo vendas_bonificacoes
export type VendasSubModuleId =
  | 'blindagem.tabela'
  | 'blindagem.analise'
  | 'blindagem.todas'
  | 'blindagem.revenda_vw'
  | 'blindagem.revenda_audi'
  | 'blindagem.estoque'
  | 'blindagem.notas_a_emitir'
  | 'peliculas.tabela'
  | 'peliculas.analise'
  | 'estetica.tabela'
  | 'estetica.analise';

export const VENDAS_SUB_MODULE_LABELS: Record<VendasSubModuleId, string> = {
  'blindagem.tabela': 'Tabela',
  'blindagem.analise': 'Análise',
  'blindagem.todas': 'Todas',
  'blindagem.revenda_vw': 'Revenda VW',
  'blindagem.revenda_audi': 'Revenda Audi',
  'blindagem.estoque': 'Em Estoque',
  'blindagem.notas_a_emitir': 'Notas a Emitir',
  'peliculas.tabela': 'Tabela',
  'peliculas.analise': 'Análise',
  'estetica.tabela': 'Tabela',
  'estetica.analise': 'Análise',
};

export interface UserRecord {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  modules: ModuleId[];
  brands: BrandId[];
  vendasSubModules?: VendasSubModuleId[];
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SessionPayload {
  userId: string;
  username: string;
  role: UserRole;
  modules: ModuleId[];
  brands: BrandId[];
  vendasSubModules?: VendasSubModuleId[];
  expiresAt: number;
}

export interface AccessLogEntry {
  id: string;
  userId: string;
  username: string;
  action: string;
  module?: string;
  timestamp: number;
}

// Dados públicos do usuário (sem passwordHash)
export type PublicUser = Omit<UserRecord, 'passwordHash'>;
