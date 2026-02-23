/**
 * Layout com Sidebar - Sistema de Gerenciamento e Aprovação de Despesas
 */

import { ReactNode } from 'react';
import {
  LayoutDashboard,
  FileText,
  Plus,
  Building2,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export type MenuItem = 'dashboard' | 'todas-despesas' | 'nova-despesa' | 'departamento' | 'integracao' | 'relatorios' | 'configuracoes';

interface LayoutProps {
  children: ReactNode;
  currentPage: MenuItem;
  onPageChange: (page: MenuItem) => void;
  onChangeBrand?: () => void;
}

export function DespesasLayout({ children, currentPage, onPageChange, onChangeBrand }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard' as MenuItem, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'todas-despesas' as MenuItem, label: 'Todas as Despesas', icon: FileText },
    { id: 'nova-despesa' as MenuItem, label: 'Nova Despesa', icon: Plus },
    { id: 'departamento' as MenuItem, label: 'Por Departamento', icon: Building2 },
    { id: 'integracao' as MenuItem, label: 'Integração Linx Bravos', icon: BarChart3 },
    { id: 'relatorios' as MenuItem, label: 'Relatórios', icon: BarChart3 },
    { id: 'configuracoes' as MenuItem, label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-[#059669] text-white shadow-lg fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-white hover:bg-emerald-700"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <div>
              <h1 className="text-xl font-bold">Dashboard Executivo</h1>
              <p className="text-sm text-emerald-100">Grupo Sorana • Audi & Volkswagen</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold">Fabio Boccaleti</p>
              <p className="text-xs text-emerald-100">Gerente Financeiro</p>
            </div>
            <div className="bg-emerald-700 rounded-full w-10 h-10 flex items-center justify-center font-bold">
              FB
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-[60px] bottom-0 w-64 bg-slate-800 text-white z-20 transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  onPageChange(item.id);
                  setSidebarOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left',
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          {onChangeBrand && (
            <button
              onClick={onChangeBrand}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">Trocar Empresa</span>
            </button>
          )}
        </div>
      </aside>

      {/* Overlay para mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 pt-[60px] min-h-screen">
        {children}
      </main>
    </div>
  );
}
