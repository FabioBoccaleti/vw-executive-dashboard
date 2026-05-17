import { useState } from 'react';
import { ClipboardList, TrendingUp } from 'lucide-react';
import { ComissoesVendasView } from './ComissoesVendasView';

type MainView = 'cadastro' | 'vendas';
type VendasSubTab = 'novos' | 'usados';

interface CalculoComissoesVWPageProps {
  onBack: () => void;
}

import { Construction } from 'lucide-react';

function EmDesenvolvimento({ label }: { label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm">
        <div className="p-6 rounded-full bg-amber-50">
          <Construction className="w-16 h-16 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">Em Desenvolvimento</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            A aba <strong>{label}</strong> está sendo desenvolvida e estará disponível em breve.
          </p>
        </div>
      </div>
    </div>
  );
}

export function CalculoComissoesVWPage({ onBack }: CalculoComissoesVWPageProps) {
  const [mainView, setMainView] = useState<MainView>('cadastro');
  const [vendasSubTab, setVendasSubTab] = useState<VendasSubTab>('novos');

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
            <button
              onClick={() => setMainView('cadastro')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mainView === 'cadastro' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Cadastro
            </button>
            <button
              onClick={() => setMainView('vendas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mainView === 'vendas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Vendas
            </button>
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
      {mainView === 'cadastro' && <EmDesenvolvimento label="Cadastro" />}

      {/* Vendas com sub-abas */}
      {mainView === 'vendas' && (
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          {/* Sub-tabs */}
          <div className="bg-white border-b border-slate-200 px-6 flex gap-0 flex-shrink-0">
            {([
              { id: 'novos',  label: 'Vendas Veíc. Novos' },
              { id: 'usados', label: 'Vendas Veíc. Usados' },
            ] as const).map(tab => (
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
          {vendasSubTab === 'novos' && <ComissoesVendasView tab="novos" />}

          {/* Vendas Veíc. Usados */}
          {vendasSubTab === 'usados' && <ComissoesVendasView tab="usados" />}
        </div>
      )}
    </div>
  );
}
