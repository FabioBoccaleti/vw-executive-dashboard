import { useState } from 'react';
import { Car, Building2, Activity } from 'lucide-react';
import { AnaliseDespesasSubPage } from './AnaliseDespesasSubPage';
import type { AnaliseBrand } from './analiseDespesasStorage';

type SubPage = null | AnaliseBrand;

interface AnaliseDespesasDashboardProps {
  onChangeBrand: () => void;
}

export function AnaliseDespesasDashboard({ onChangeBrand }: AnaliseDespesasDashboardProps) {
  const [subPage, setSubPage] = useState<SubPage>(null);

  if (subPage !== null) {
    return (
      <AnaliseDespesasSubPage
        brand={subPage}
        onBack={() => setSubPage(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Análise Evolutiva de Despesas</h1>
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
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-lg">

          {/* Card — VW */}
          <button
            onClick={() => setSubPage('vw')}
            className="flex-1 bg-white rounded-2xl border-2 border-blue-900 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-blue-50 group-hover:bg-blue-100 transition-colors">
              <Car className="w-10 h-10 text-blue-900" />
            </div>
            <h2 className="text-base font-bold text-slate-800 leading-snug">VW</h2>
          </button>

          {/* Card — Audi */}
          <button
            onClick={() => setSubPage('audi')}
            className="flex-1 bg-white rounded-2xl border-2 border-red-700 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-red-50 group-hover:bg-red-100 transition-colors">
              <Building2 className="w-10 h-10 text-red-700" />
            </div>
            <h2 className="text-base font-bold text-slate-800 leading-snug">Audi</h2>
          </button>

        </div>
      </div>
    </div>
  );
}
