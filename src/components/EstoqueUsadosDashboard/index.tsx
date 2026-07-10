import { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, PencilLine, History, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardTab }   from './DashboardTab';
import { LancarDadosTab } from './LancarDadosTab';
import { HistoricoTab }   from './HistoricoTab';
import {
  EstoqueUsadosEntry, EstoqueUsadosMeta,
  loadMeta, loadIndex, loadEntry, saveEntry,
  EMPTY_FIELDS,
} from './estoqueUsadosStorage';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'lancar' | 'historico';

interface Props {
  onChangeBrand: () => void;
}

// ─── Tab Button ───────────────────────────────────────────────────────────────

function TabBtn({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-all ${
        active
          ? 'bg-white text-indigo-700 shadow-sm'
          : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function EstoqueUsadosDashboard({ onChangeBrand }: Props) {
  const [activeTab, setActiveTab]       = useState<Tab>('dashboard');
  const [currentEntry, setCurrentEntry] = useState<EstoqueUsadosEntry | null>(null);
  const [meta, setMeta]                 = useState<EstoqueUsadosMeta>({ metaVW: 0, metaAudi: 0 });
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showZeroConfirm, setShowZeroConfirm] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [loadedMeta, dates] = await Promise.all([loadMeta(), loadIndex()]);
    setMeta(loadedMeta);
    setHistoryDates(dates);
    if (dates.length > 0) {
      const latest = await loadEntry(dates[0]);
      setCurrentEntry(latest);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Chamado quando LancarDadosTab salva um novo lançamento
  const handleSaved = (entry: EstoqueUsadosEntry) => {
    setCurrentEntry(entry);
    setHistoryDates(prev => {
      if (prev.includes(entry.date)) return prev;
      return [entry.date, ...prev].sort((a, b) => b.localeCompare(a));
    });
    setActiveTab('dashboard');
  };

  // Chamado quando HistoricoTab clica em "Visualizar"
  const handleViewHistoric = (entry: EstoqueUsadosEntry) => {
    setCurrentEntry(entry);
    setActiveTab('dashboard');
  };

  // Chamado quando HistoricoTab exclui um registro
  const handleDeleted = (date: string) => {
    setHistoryDates(prev => prev.filter(d => d !== date));
    if (currentEntry?.date === date) {
      // Carrega o próximo mais recente
      const remaining = historyDates.filter(d => d !== date);
      if (remaining.length > 0) {
        loadEntry(remaining[0]).then(e => setCurrentEntry(e));
      } else {
        setCurrentEntry(null);
      }
    }
  };

  // Zerar todos os valores
  const handleZerar = async () => {
    if (!currentEntry) return;
    const zeroed: EstoqueUsadosEntry = {
      date: currentEntry.date,
      updatedAt: Date.now(),
      ...EMPTY_FIELDS,
    };
    const ok = await saveEntry(zeroed);
    setShowZeroConfirm(false);
    if (ok) {
      setCurrentEntry(zeroed);
      toast.success('Valores zerados com sucesso.');
    } else {
      toast.error('Erro ao zerar valores.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-400">
          <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col print:block">
      {/* Confirm: Zerar */}
      {showZeroConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Zerar todos os valores?</h3>
              <p className="text-sm text-slate-500 mt-1">
                Isso vai registrar o lançamento atual com todos os campos iguais a zero. Deseja continuar?
              </p>
            </div>
            <div className="px-6 py-4 flex justify-end gap-2">
              <button onClick={() => setShowZeroConfirm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleZerar} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
                Zerar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de navegação superior */}
      <div className="bg-slate-100 border-b border-slate-200 px-6 py-2 flex items-center justify-between print:hidden">
        <button
          onClick={onChangeBrand}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao menu
        </button>

        <div className="flex items-center gap-1 bg-slate-200/70 rounded-lg p-1">
          <TabBtn
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard className="w-3.5 h-3.5" />}
            label="Dashboard"
          />
          <TabBtn
            active={activeTab === 'lancar'}
            onClick={() => setActiveTab('lancar')}
            icon={<PencilLine className="w-3.5 h-3.5" />}
            label="Lançar Dados"
          />
          <TabBtn
            active={activeTab === 'historico'}
            onClick={() => setActiveTab('historico')}
            icon={<History className="w-3.5 h-3.5" />}
            label="Histórico"
          />
        </div>

        <div className="w-24" />
      </div>

      {/* Conteúdo da aba ativa */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'dashboard' && (
          <DashboardTab
            entry={currentEntry}
            meta={meta}
            onEditMeta={() => setActiveTab('lancar')}
            onZerar={() => setShowZeroConfirm(true)}
          />
        )}
        {activeTab === 'lancar' && (
          <LancarDadosTab
            meta={meta}
            initialDate={currentEntry?.date}
            onSaved={handleSaved}
            onMetaChanged={setMeta}
          />
        )}
        {activeTab === 'historico' && (
          <HistoricoTab
            dates={historyDates}
            onView={handleViewHistoric}
            onDeleted={handleDeleted}
          />
        )}
      </div>
    </div>
  );
}
