import { Construction } from 'lucide-react';

interface Props {
  onChangeBrand: () => void;
}

export function IEODashboard({ onChangeBrand }: Props) {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header
        className="px-6 py-3 flex items-center justify-between shadow-md shrink-0"
        style={{ backgroundColor: '#10b981' }}
      >
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">Índice de Eficiência Operacional (IEO)</h1>
          <p className="text-xs text-slate-100 mt-0.5">Demonstrativo de Resultados</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onChangeBrand}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-slate-200 hover:text-white hover:bg-emerald-700 transition-colors"
          >
            ← Voltar
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="flex justify-center">
            <div
              className="p-6 rounded-full"
              style={{ backgroundColor: '#d1fae5' }}
            >
              <Construction className="w-16 h-16" style={{ color: '#10b981' }} />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-800">
              Em Desenvolvimento
            </h2>
            <p className="text-slate-600 text-base">
              Esta funcionalidade está sendo desenvolvida e estará disponível em breve.
            </p>
          </div>

          <div className="pt-4">
            <button
              onClick={onChangeBrand}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: '#10b981' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#059669'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10b981'}
            >
              Voltar ao Menu Principal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
