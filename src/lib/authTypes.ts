// ─── Tipos compartilhados de autenticação ────────────────────────────────────

export type UserRole = 'admin' | 'gestor' | 'leitura';

export type ModuleId = 'demonstrativo' | 'despesas' | 'fluxo_caixa';

export type BrandId = 'vw' | 'audi' | 'consolidado' | 'vw_outros' | 'audi_outros';

export const ALL_MODULES: ModuleId[] = ['demonstrativo', 'despesas', 'fluxo_caixa'];

export const ALL_BRANDS: BrandId[] = ['vw', 'audi', 'consolidado', 'vw_outros', 'audi_outros'];

export const MODULE_LABELS: Record<ModuleId, string> = {
  demonstrativo: 'Demonstrativo de Resultados',
  despesas: 'Gerenciamento de Despesas',
  fluxo_caixa: 'Fluxo de Caixa',
};

export const BRAND_LABELS: Record<BrandId, string> = {
  vw: 'VW',
  audi: 'Audi',
  consolidado: 'Consolidado',
  vw_outros: 'VW Outros',
  audi_outros: 'Audi Outros',
};

export interface UserRecord {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  modules: ModuleId[];
  brands: BrandId[];
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
