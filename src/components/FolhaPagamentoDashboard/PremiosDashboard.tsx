import { useState } from 'react';
import { CalendarClock, ClipboardList } from 'lucide-react';
import { PlantaoSabadoView } from './PlantaoSabadoView';
import { PesquisaCemView } from './PesquisaCemView';

interface PremiosDashboardProps {
  onBack: () => void;
}

type PremioTab = 'plantao_sabado' | 'pesquisa_cem';

export function PremiosDashboard({ onBack }: PremiosDashboardProps) {
  const [tab, setTab] = useState<PremioTab>('plantao_sabado');

  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Prêmios</h1>
          <p className="text-xs text-slate-500 mt-0.5">Folha de Pagamento</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setTab('plantao_sabado')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                tab === 'plantao_sabado' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              Plantão de Sábado
            </button>
            <button
              onClick={() => setTab('pesquisa_cem')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                tab === 'pesquisa_cem' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Pesquisa CEM
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

      {tab === 'plantao_sabado' && <PlantaoSabadoView />}
      {tab === 'pesquisa_cem' && <PesquisaCemView />}
    </div>
  );
}

