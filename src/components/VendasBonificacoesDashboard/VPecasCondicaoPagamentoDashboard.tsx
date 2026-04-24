import { Construction } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export function VPecasCondicaoPagamentoDashboard({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            Vendas Peças, Oficina e Funilaria por Condição de Pagamento
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Demonstrativo de Vendas e Bonificações</p>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
        >
          ← Voltar
        </button>
      </header>

      {/* Conteúdo — Em desenvolvimento */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center gap-5 max-w-md w-full text-center">
          <div className="p-5 rounded-full bg-orange-50">
            <Construction className="w-12 h-12 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-700 mb-2">Em desenvolvimento</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Este módulo está sendo desenvolvido e em breve estará disponível.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
