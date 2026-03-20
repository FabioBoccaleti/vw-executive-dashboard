import { Shield, Clock } from 'lucide-react';

interface VendasSelectionPageProps {
  onSelect: (option: 'blindagem') => void;
  onChangeBrand: () => void;
}

export function VendasSelectionPage({ onSelect, onChangeBrand }: VendasSelectionPageProps) {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Demonstrativo de Vendas e Bonificações</h1>
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
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">

          {/* Card ativo — Análise e Controle das Vendas de Blindagem */}
          <button
            onClick={() => onSelect('blindagem')}
            className="flex-1 bg-white rounded-2xl border-2 border-amber-400 shadow-md hover:shadow-xl hover:border-amber-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-amber-50 group-hover:bg-amber-100 transition-colors">
              <Shield className="w-10 h-10 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Análise e Controle das<br />Vendas de Blindagem
              </h2>
            </div>
          </button>

          {/* Card desabilitado — Em Desenvolvimento */}
          <div className="flex-1 bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-8 flex flex-col items-center gap-4 text-center opacity-50 cursor-not-allowed select-none">
            <div className="p-4 rounded-full bg-slate-100">
              <Clock className="w-10 h-10 text-slate-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-400 leading-snug">
                Em Desenvolvimento
              </h2>
              <span className="inline-block mt-2 text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-3 py-0.5">
                Em breve
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
