// ─── Tipos compartilhados de autenticação ────────────────────────────────────

export type UserRole = 'admin' | 'gestor' | 'leitura';

export type ModuleId = 'demonstrativo' | 'despesas' | 'fluxo_caixa' | 'vendas_bonificacoes' | 'folha_pagamento' | 'central_vendas_vw' | 'custos_alugueis';

export type BrandId = 'vw' | 'audi' | 'consolidado' | 'vw_outros' | 'audi_outros';

export const ALL_MODULES: ModuleId[] = ['demonstrativo', 'despesas', 'fluxo_caixa', 'vendas_bonificacoes', 'folha_pagamento', 'central_vendas_vw', 'custos_alugueis'];

export const ALL_BRANDS: BrandId[] = ['vw', 'audi', 'consolidado', 'vw_outros', 'audi_outros'];

export const MODULE_LABELS: Record<ModuleId, string> = {
  demonstrativo: 'Demonstrativo de Resultados',
  despesas: 'Gerenciamento de Despesas',
  fluxo_caixa: 'Fluxo de Caixa',
  vendas_bonificacoes: 'Demonstrativo de Vendas e Bonificações',
  folha_pagamento: 'Folha de Pagamento',
  central_vendas_vw: 'Central de Vendas VW',
  custos_alugueis: 'Custos com Aluguéis',
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
  | 'estetica.analise'
  | 'financiamento_bv.vendas'
  | 'financiamento_bv.acelera'
  | 'financiamento_bv.cadastro'
  | 'vpecas_cond.relatorios'
  | 'vpecas_cond.resumo';

// Subpermissões do módulo folha_pagamento
export type FolhaSubModuleId =
  | 'folha.analise'
  | 'folha.relacao'
  | 'folha.audi'
  | 'folha.vw'
  | 'folha.total';

export const FOLHA_SUB_MODULE_LABELS: Record<FolhaSubModuleId, string> = {
  'folha.analise': 'Análise',
  'folha.relacao': 'Relação de Salários Fixos',
  'folha.audi':   'Audi',
  'folha.vw':     'VW',
  'folha.total':  'Total',
};

// Subpermissões do módulo central_vendas_vw
export type CentralVendasVWSubModuleId =
  | 'central_vw.analises'
  | 'central_vw.vendas'
  | 'central_vw.financeiro'
  | 'central_vw.registros'
  | 'central_vw.cadastros';

export const CENTRAL_VENDAS_VW_SUB_MODULE_LABELS: Record<CentralVendasVWSubModuleId, string> = {
  'central_vw.analises': 'Análises',
  'central_vw.vendas': 'Vendas',
  'central_vw.financeiro': 'Financeiro',
  'central_vw.registros': 'Registros',
  'central_vw.cadastros': 'Cadastros',
};

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
  'financiamento_bv.vendas': 'Vendas',
  'financiamento_bv.acelera': 'Acelera',
  'financiamento_bv.cadastro': 'Cadastro',
  'vpecas_cond.relatorios': 'Relatórios',
  'vpecas_cond.resumo': 'Resumo',
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
  centralVendasVWSubModules?: CentralVendasVWSubModuleId[];
  folhaSubModules?: FolhaSubModuleId[];
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
  centralVendasVWSubModules?: CentralVendasVWSubModuleId[];
  folhaSubModules?: FolhaSubModuleId[];
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
