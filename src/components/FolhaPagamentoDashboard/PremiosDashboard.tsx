import { useState } from 'react';
import { CalendarClock, ClipboardList, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { PlantaoSabadoView } from './PlantaoSabadoView';
import { PesquisaCemView } from './PesquisaCemView';
import { DiversosView } from './DiversosView';

interface PremiosDashboardProps {
  onBack: () => void;
}

type PremioTab = 'plantao_sabado' | 'pesquisa_cem' | 'diversos';

export function PremiosDashboard({ onBack }: PremiosDashboardProps) {
  const { canAccessFolhaSub, isAdmin } = useAuth();
  const admin = isAdmin();
  const canPlantao  = admin || canAccessFolhaSub('folha.premios.plantao_sabado');
  const canPesquisa = admin || canAccessFolhaSub('folha.premios.pesquisa_cem');
  const canDiversos = admin || canAccessFolhaSub('folha.premios.diversos');

  const tabs = [
    { id: 'plantao_sabado' as const, label: 'Plantão aos Sábados', icon: CalendarClock, can: canPlantao },
    { id: 'pesquisa_cem'   as const, label: 'Pesquisa CEM',        icon: ClipboardList, can: canPesquisa },
    { id: 'diversos'       as const, label: 'Diversos',            icon: LayoutGrid,    can: canDiversos },
  ].filter(t => t.can);

  const [tab, setTab] = useState<PremioTab>(() => tabs[0]?.id ?? 'plantao_sabado');

  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Prêmios</h1>
          <p className="text-xs text-slate-500 mt-0.5">Folha de Pagamento</p>
        </div>
        <div className="flex items-center gap-3">
          {tabs.length > 0 && (
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
          >
            ← Voltar
          </button>
        </div>
      </header>

      {tabs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          Você não tem permissão para acessar as abas de Prêmios.
        </div>
      ) : (
        <>
          {tab === 'plantao_sabado' && canPlantao && <PlantaoSabadoView />}
          {tab === 'pesquisa_cem' && canPesquisa && <PesquisaCemView />}
          {tab === 'diversos' && canDiversos && <DiversosView />}
        </>
      )}
    </div>
  );
}

