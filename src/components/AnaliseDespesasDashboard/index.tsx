import { Activity } from 'lucide-react';

interface AnaliseDespesasDashboardProps {
  onChangeBrand: () => void;
}

export function AnaliseDespesasDashboard({ onChangeBrand }: AnaliseDespesasDashboardProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <div className="p-5 rounded-full bg-teal-100">
          <Activity className="w-12 h-12 text-teal-700" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800">Análise Evolutiva de Despesas</h1>
        <div className="px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold tracking-wide uppercase">
          Em Desenvolvimento
        </div>
        <p className="text-slate-500 text-base">
          Este módulo está sendo desenvolvido e estará disponível em breve.
        </p>
        <button
          onClick={onChangeBrand}
          className="mt-4 px-6 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-medium transition-colors duration-200"
        >
          Voltar ao Menu
        </button>
      </div>
    </div>
  );
}
