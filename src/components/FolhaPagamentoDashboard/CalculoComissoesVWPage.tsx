import { useState } from 'react';
import { ClipboardList, TrendingUp, Calculator, Lock } from 'lucide-react';
import { ComissoesVendasView } from './ComissoesVendasView';
import { ComissoesCadastroView } from './ComissoesCadastroView';
import { ComissoesCalculoView } from './ComissoesCalculoView';
import { useAuth } from '@/contexts/useAuth';

type MainView = 'cadastro' | 'vendas' | 'calculo';
type VendasSubTab = 'novos' | 'usados';
type CalculoSubTab = 'novos' | 'usados';

interface CalculoComissoesVWPageProps {
  onBack: () => void;
}



export function CalculoComissoesVWPage({ onBack }: CalculoComissoesVWPageProps) {
  const { canAccessFolhaSub, isAdmin } = useAuth();
  const admin = isAdmin();

  const canCadastro       = admin || canAccessFolhaSub('folha.comissoes_vw.cadastro');
  const canVendas         = admin || canAccessFolhaSub('folha.comissoes_vw.vendas');
  const canVendasNovos    = admin || canAccessFolhaSub('folha.comissoes_vw.vendas.novos');
  const canVendasUsados   = admin || canAccessFolhaSub('folha.comissoes_vw.vendas.usados');
  const canCalculo        = admin || canAccessFolhaSub('folha.comissoes_vw.calculo');
  const canCalculoNovos   = admin || canAccessFolhaSub('folha.comissoes_vw.calculo.novos');
  const canCalculoUsados  = admin || canAccessFolhaSub('folha.comissoes_vw.calculo.usados');

  const firstAllowedView: MainView = canCalculo ? 'calculo' : canVendas ? 'vendas' : 'cadastro';
  const [mainView, setMainView] = useState<MainView>(firstAllowedView);
  const [vendasSubTab,  setVendasSubTab]  = useState<VendasSubTab>(() => canVendasNovos ? 'novos' : 'usados');
  const [calculoSubTab, setCalculoSubTab] = useState<CalculoSubTab>(() => canCalculoNovos ? 'novos' : 'usados');

  if (!admin && !canAccessFolhaSub('folha.comissoes_vw')) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4 text-slate-500">
        <Lock className="w-10 h-10 opacity-40" />
        <p className="text-sm font-medium">Você não tem permissão para acessar este módulo.</p>
        <button onClick={onBack} className="text-xs text-teal-600 hover:underline">
          ← Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Cálculo de Comissões VW</h1>
          <p className="text-xs text-slate-500 mt-0.5">Folha de Pagamento</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Abas de navegação */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            {canCadastro && (
            <button
              onClick={() => setMainView('cadastro')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mainView === 'cadastro' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Cadastro
            </button>
            )}
            {canVendas && (
            <button
              onClick={() => setMainView('vendas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mainView === 'vendas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Vendas
            </button>
            )}
            {canCalculo && (
            <button
              onClick={() => setMainView('calculo')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mainView === 'calculo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              Cálculo
            </button>
            )}
          </div>

          <button
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
          >
            ← Voltar
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      {mainView === 'cadastro' && canCadastro && <ComissoesCadastroView />}

      {/* Cálculo com sub-abas */}
      {mainView === 'calculo' && canCalculo && (
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          {/* Sub-tabs */}
          <div className="bg-white border-b border-slate-200 px-6 flex gap-0 flex-shrink-0">
            {([  
              { id: 'novos' as const,  label: 'Novos',  can: canCalculoNovos },
              { id: 'usados' as const, label: 'Usados', can: canCalculoUsados },
            ]).filter(t => t.can).map(tab => (
              <button
                key={tab.id}
                onClick={() => setCalculoSubTab(tab.id)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  calculoSubTab === tab.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Conteúdo por sub-aba */}
          {calculoSubTab === 'novos'  && canCalculoNovos  && <ComissoesCalculoView tab="novos" />}
          {calculoSubTab === 'usados' && canCalculoUsados && <ComissoesCalculoView tab="usados" />}
        </div>
      )}

      {/* Vendas com sub-abas */}
      {mainView === 'vendas' && canVendas && (
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          {/* Sub-tabs */}
          <div className="bg-white border-b border-slate-200 px-6 flex gap-0 flex-shrink-0">
            {([
              { id: 'novos' as const,  label: 'Vendas Veíc. Novos',   can: canVendasNovos },
              { id: 'usados' as const, label: 'Vendas Veíc. Usados',  can: canVendasUsados },
            ]).filter(t => t.can).map(tab => (
              <button
                key={tab.id}
                onClick={() => setVendasSubTab(tab.id)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  vendasSubTab === tab.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Vendas Veíc. Novos */}
          {vendasSubTab === 'novos'  && canVendasNovos  && <ComissoesVendasView tab="novos" />}

          {/* Vendas Veíc. Usados */}
          {vendasSubTab === 'usados' && canVendasUsados && <ComissoesVendasView tab="usados" />}
        </div>
      )}
    </div>
  );
}
