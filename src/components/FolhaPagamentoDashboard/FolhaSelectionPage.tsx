import { Wallet } from 'lucide-react';

interface FolhaSelectionPageProps {
  onSelect: (option: 'salarios_fixo') => void;
  onChangeBrand: () => void;
}

export function FolhaSelectionPage({ onSelect, onChangeBrand }: FolhaSelectionPageProps) {
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
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">

          {/* Card — Salários Fixo */}
          <button
            onClick={() => onSelect('salarios_fixo')}
            className="flex-1 max-w-xs mx-auto bg-white rounded-2xl border-2 border-teal-400 shadow-md hover:shadow-xl hover:border-teal-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
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

        </div>
      </div>
    </div>
  );
}
