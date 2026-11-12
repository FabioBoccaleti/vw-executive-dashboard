import { Package } from 'lucide-react';

interface RemuneracaoProdutosPageProps {
  onBack: () => void;
}

export function RemuneracaoProdutosPage({ onBack }: RemuneracaoProdutosPageProps) {
  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Remuneração Produtos</h1>
          <p className="text-xs text-slate-500 mt-0.5">Folha de Pagamento</p>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
        >
          ← Voltar
        </button>
      </header>

      {/* Conteúdo — Em desenvolvimento */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8 text-teal-500" />
          </div>
          <p className="text-lg font-semibold text-slate-700">Em desenvolvimento</p>
          <p className="text-sm text-slate-400">Esta funcionalidade estará disponível em breve.</p>
        </div>
      </div>
    </div>
  );
}
