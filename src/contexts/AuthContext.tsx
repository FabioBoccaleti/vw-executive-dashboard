import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { SessionPayload, ModuleId, BrandId } from '@/lib/authTypes';
import { getSessionData, saveSession, clearSession, apiLogin, apiLogout } from '@/lib/authClient';

interface AuthContextValue {
  session: SessionPayload | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  canAccessModule: (module: ModuleId) => boolean;
  canAccessBrand: (brand: BrandId) => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const data = getSessionData();
    setSession(data);
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<string | null> => {
    const result = await apiLogin(username, password);
    if ('error' in result) return result.error;
    saveSession(result.token, result.session);
    setSession(result.session);
    return null;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    clearSession();
    setSession(null);
  }, []);

  const canAccessModule = useCallback((module: ModuleId): boolean => {
    if (!session) return false;
    if (session.role === 'admin') return true;
    return session.modules.includes(module);
  }, [session]);

  const canAccessBrand = useCallback((brand: BrandId): boolean => {
    if (!session) return false;
    if (session.role === 'admin') return true;
    return session.brands.includes(brand);
  }, [session]);

  const isAdmin = useCallback((): boolean => {
    return session?.role === 'admin';
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, isLoading, login, logout, canAccessModule, canAccessBrand, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
