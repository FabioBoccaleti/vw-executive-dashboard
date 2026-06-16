import { useState } from 'react';
import { Lock, Users, LayoutList } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { PrestadoresListPage } from './PrestadoresListPage';
import { DemonstrativosListPage } from './DemonstrativosListPage';
import { ResumoRemuneracoesPJPage } from './ResumoRemuneracoesPJPage';
import { PrestadorDemonstrativoPage } from './PrestadorDemonstrativoPage';
import { PrestadorRateioPage } from './PrestadorRateioPage';
import type { PrestadorPJ, PrestadorSnapshotPJ, LancamentoPJ } from './remPjStorage';

type Aba = 'cadastro' | 'demonstrativos' | 'resumo';
type ActiveView = 'demonstrativo' | 'rateio';

interface RemuneracoesPJDashboardProps {
  onBack: () => void;
}

export function RemuneracoesPJDashboard({ onBack }: RemuneracoesPJDashboardProps) {
  const { canAccessFolhaSub, isAdmin } = useAuth();
  const admin = isAdmin();
  const canAccess      = admin || canAccessFolhaSub('folha.pj');
  const canDemonst     = admin || canAccessFolhaSub('folha.pj.demonstrativos');
  const canCadastro    = admin || canAccessFolhaSub('folha.pj.cadastro');
  const canResumo      = canDemonst;

  const [aba, setAba] = useState<Aba>(() => canDemonst ? 'demonstrativos' : 'cadastro');
  const [activePrestador, setActivePrestador] = useState<PrestadorPJ | null>(null);
  const [activeYear,  setActiveYear]  = useState<number | undefined>();
  const [activeMonth, setActiveMonth] = useState<number | undefined>();
  const [activeView, setActiveView] = useState<ActiveView>('demonstrativo');
  const [rateioLancamento, setRateioLancamento] = useState<LancamentoPJ | null>(null);
  const [rateioPrestador, setRateioPrestador] = useState<PrestadorPJ | PrestadorSnapshotPJ | null>(null);

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4 text-slate-500">
        <Lock className="w-10 h-10 opacity-40" />
        <p className="text-sm font-medium">Você não tem permissão para acessar este módulo.</p>
        <button onClick={onBack} className="text-xs text-teal-600 hover:underline">
          ← Voltar
        </button>
      </div>
    );
  }

  function handleOpenPrestador(prestador: PrestadorPJ, year?: number, month?: number) {
    setActivePrestador(prestador);
    setActiveYear(year);
    setActiveMonth(month);
    setActiveView('demonstrativo');
    setRateioLancamento(null);
    setRateioPrestador(null);
  }

  function handleBack() {
    setActivePrestador(null);
    setActiveYear(undefined);
    setActiveMonth(undefined);
    setActiveView('demonstrativo');
    setRateioLancamento(null);
    setRateioPrestador(null);
  }

  // Sub-view: demonstrativo individual
  if (activePrestador) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Remunerações PJ</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Folha de Pagamento · {activePrestador.nome}
            </p>
          </div>
          <button
            onClick={handleBack}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
          >
            ← Voltar
          </button>
        </header>
            {activeView === 'rateio' ? (
              <PrestadorRateioPage
                prestador={activePrestador}
                onBack={() => setActiveView('demonstrativo')}
                initialYear={activeYear}
                initialMonth={activeMonth}
                initialLancamento={rateioLancamento}
                initialPrestador={rateioPrestador}
              />
            ) : (
              <PrestadorDemonstrativoPage
                prestador={activePrestador}
                isAdmin={isAdmin()}
                onBack={handleBack}
                onOpenRateio={(ctx) => {
                  setActiveYear(ctx.year);
                  setActiveMonth(ctx.month);
                  setRateioLancamento(ctx.lancamento);
                  setRateioPrestador(ctx.prestadorEfetivo);
                  setActiveView('rateio');
                }}
                initialYear={activeYear}
                initialMonth={activeMonth}
              />
            )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header global */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Remunerações PJ</h1>
          <p className="text-xs text-slate-500 mt-0.5">Folha de Pagamento · Prestadores de Serviço</p>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
        >
          ← Voltar
        </button>
      </header>

      {/* Abas */}
      <div className="bg-white border-b border-slate-200 px-6 flex-shrink-0">
        <div className="flex gap-0">
          {([
            { key: 'demonstrativos', label: 'Demonstrativos', icon: LayoutList, can: canDemonst },
            { key: 'resumo',         label: 'Resumo',         icon: LayoutList, can: canResumo },
            { key: 'cadastro',       label: 'Cadastro',       icon: Users,       can: canCadastro },
          ] as { key: Aba; label: string; icon: React.ElementType; can: boolean }[])
            .filter(t => t.can)
            .map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setAba(key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                aba === key
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo da aba */}
      {aba === 'cadastro' ? (
        <PrestadoresListPage
          isAdmin={isAdmin()}
          onOpenPrestador={p => handleOpenPrestador(p)}
        />
      ) : aba === 'resumo' ? (
        <ResumoRemuneracoesPJPage />
      ) : (
        <DemonstrativosListPage
          onOpenPrestador={(p, y, m) => handleOpenPrestador(p, y, m)}
        />
      )}
    </div>
  );
}

