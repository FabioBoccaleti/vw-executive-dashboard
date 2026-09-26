import { Wallet, UserCheck, Calculator, TrendingUp, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';

interface FolhaSelectionPageProps {
  onSelect: (option: 'salarios_fixo' | 'remuneracoes_pj' | 'calculo_comissoes_vw' | 'calculo_comissoes_vw_pos_vendas' | 'remuneracoes_variaveis' | 'premios') => void;
  onChangeBrand: () => void;
}

export function FolhaSelectionPage({ onSelect, onChangeBrand }: FolhaSelectionPageProps) {
  const { canAccessFolhaSub, isAdmin } = useAuth();
  const admin = isAdmin();
  const canPJ          = admin || canAccessFolhaSub('folha.pj');
  const canComissoesVW = admin || canAccessFolhaSub('folha.comissoes_vw');
  const canRemVariaveis = admin || canAccessFolhaSub('folha.remuneracoes_variaveis');
  const canPremios     = admin || canAccessFolhaSub('folha.premios');
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Folha de Pagamento</h1>
          <p className="text-xs text-slate-500 mt-0.5">Selecione o módulo desejado</p>
        </div>
        <button
          onClick={onChangeBrand}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
        >
          ← Voltar ao menu
        </button>
      </header>

      {/* Cards */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-6 w-full max-w-3xl">

          {/* Card — Salários Fixo */}
          <button
            onClick={() => onSelect('salarios_fixo')}
            className="w-44 mx-auto bg-white rounded-2xl border-2 border-teal-400 shadow-md hover:shadow-xl hover:border-teal-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-teal-50 group-hover:bg-teal-100 transition-colors">
              <Wallet className="w-10 h-10 text-teal-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Salários Fixo
              </h2>
            </div>
          </button>

          {/* Card — Remunerações PJ */}
          {canPJ && (
          <button
            onClick={() => onSelect('remuneracoes_pj')}
            className="w-44 mx-auto bg-white rounded-2xl border-2 border-teal-400 shadow-md hover:shadow-xl hover:border-teal-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-teal-50 group-hover:bg-teal-100 transition-colors">
              <UserCheck className="w-10 h-10 text-teal-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Remunerações PJ
              </h2>
            </div>
          </button>
          )}

          {/* Card — Cálculo de Comissões VW - Veículos */}
          {canComissoesVW && (
          <button
            onClick={() => onSelect('calculo_comissoes_vw')}
            className="w-44 mx-auto bg-white rounded-2xl border-2 border-teal-400 shadow-md hover:shadow-xl hover:border-teal-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-teal-50 group-hover:bg-teal-100 transition-colors">
              <Calculator className="w-10 h-10 text-teal-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Cálculo de Comissões VW - Veículos
              </h2>
            </div>
          </button>
          )}

          {/* Card — Cálculo de Comissões VW - Pós Vendas */}
          {canComissoesVW && (
          <button
            onClick={() => onSelect('calculo_comissoes_vw_pos_vendas')}
            className="w-44 mx-auto bg-white rounded-2xl border-2 border-teal-400 shadow-md hover:shadow-xl hover:border-teal-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-teal-50 group-hover:bg-teal-100 transition-colors">
              <Calculator className="w-10 h-10 text-teal-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Cálculo de Comissões VW - Pós Vendas
              </h2>
            </div>
          </button>
          )}

          {/* Card — Remunerações Variáveis */}
          {canRemVariaveis && (
          <button
            onClick={() => onSelect('remuneracoes_variaveis')}
            className="w-44 mx-auto bg-white rounded-2xl border-2 border-teal-400 shadow-md hover:shadow-xl hover:border-teal-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-teal-50 group-hover:bg-teal-100 transition-colors">
              <TrendingUp className="w-10 h-10 text-teal-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Remunerações Variáveis
              </h2>
            </div>
          </button>
          )}

          {/* Card — Prêmios */}
          {canPremios && (
          <button
            onClick={() => onSelect('premios')}
            className="w-44 mx-auto bg-white rounded-2xl border-2 border-teal-400 shadow-md hover:shadow-xl hover:border-teal-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-teal-50 group-hover:bg-teal-100 transition-colors">
              <Trophy className="w-10 h-10 text-teal-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Prêmios
              </h2>
            </div>
          </button>
          )}

        </div>
      </div>
    </div>
  );
}
