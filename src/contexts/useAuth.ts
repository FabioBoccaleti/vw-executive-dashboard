import { useContext } from 'react';
import { AuthContext } from './authContextDef';
import type { AuthContextValue } from './authContextDef';

export type { AuthContextValue };

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
