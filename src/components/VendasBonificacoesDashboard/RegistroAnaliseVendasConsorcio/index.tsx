import { useState } from 'react';
import { useAuth } from '@/contexts/useAuth';
import { Button } from '@/components/ui/button';
import { Handshake, TableProperties, BarChart2, BookOpen, LogOut } from 'lucide-react';

interface RegistroAnaliseVendasConsorcioDashboardProps {
  onChangeBrand: () => void;
  onOpenCadastros: () => void;
}

export function RegistroAnaliseVendasConsorcioDashboard({ onChangeBrand, onOpenCadastros }: RegistroAnaliseVendasConsorcioDashboardProps) {
  const { canAccessVendasSub, isAdmin } = useAuth();
  const canTabela   = isAdmin() || canAccessVendasSub('consorcio.tabela');
  const canAnalise  = isAdmin() || canAccessVendasSub('consorcio.analise');
  const canCadastro = isAdmin() || canAccessVendasSub('consorcio.cadastro');

  const [activeTab, setActiveTab] = useState<'tabela' | 'analise'>(canTabela ? 'tabela' : 'analise');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ── Header ── */}
      <header
        className="text-white shadow-lg flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)' }}
      >
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-lg">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight">
                Registro e Análise de Vendas de Consorcio
              </h1>
              <p className="text-cyan-100 text-xs mt-0.5">Demonstrativo de Vendas e Bonificações</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Abas */}
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 gap-0.5">
              {canTabela && (
              <button
                onClick={() => setActiveTab('tabela')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === 'tabela'
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <TableProperties className="w-3.5 h-3.5" />
                Tabela
              </button>
              )}
              {canAnalise && (
              <button
                onClick={() => setActiveTab('analise')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === 'analise'
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Análise
              </button>
              )}
            </div>
            {canCadastro && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenCadastros}
              className="text-white border border-white/30 hover:bg-white/15 gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Cadastro
            </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onChangeBrand}
              className="text-white border border-white/30 hover:bg-white/15 gap-2"
            >
              <LogOut className="w-4 h-4" />
              Trocar painel
            </Button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      {activeTab === 'tabela' && canTabela && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-5 rounded-full bg-cyan-50">
              <TableProperties className="w-12 h-12 text-cyan-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Em desenvolvimento</h2>
          </div>
        </div>
      )}

      {activeTab === 'analise' && canAnalise && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-5 rounded-full bg-cyan-50">
              <BarChart2 className="w-12 h-12 text-cyan-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Em desenvolvimento</h2>
          </div>
        </div>
      )}
    </div>
  );
}
