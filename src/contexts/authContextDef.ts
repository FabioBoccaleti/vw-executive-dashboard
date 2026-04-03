import { createContext } from 'react';
import type { SessionPayload, ModuleId, BrandId, VendasSubModuleId, FolhaSubModuleId } from '@/lib/authTypes';

export interface AuthContextValue {
  session: SessionPayload | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  canAccessModule: (module: ModuleId) => boolean;
  canAccessBrand: (brand: BrandId) => boolean;
  canAccessVendasSub: (sub: VendasSubModuleId) => boolean;
  canAccessFolhaSub: (sub: FolhaSubModuleId) => boolean;
  isAdmin: () => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
