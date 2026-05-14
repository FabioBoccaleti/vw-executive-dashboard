import { useState } from 'react';
import { Lock, Users, LayoutList } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { PrestadoresListPage } from './PrestadoresListPage';
import { DemonstrativosListPage } from './DemonstrativosListPage';
import { PrestadorDemonstrativoPage } from './PrestadorDemonstrativoPage';
import type { PrestadorPJ } from './remPjStorage';

type Aba = 'cadastro' | 'demonstrativos';

interface RemuneracoesPJDashboardProps {
  onBack: () => void;
}

export function RemuneracoesPJDashboard({ onBack }: RemuneracoesPJDashboardProps) {
  const { canAccessFolhaSub, isAdmin } = useAuth();
  const canAccess = isAdmin() || canAccessFolhaSub('folha.pj');

  const [aba, setAba] = useState<Aba>('demonstrativos');
  const [activePrestador, setActivePrestador] = useState<PrestadorPJ | null>(null);
  const [activeYear,  setActiveYear]  = useState<number | undefined>();
  const [activeMonth, setActiveMonth] = useState<number | undefined>();

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
  }

  function handleBack() {
    setActivePrestador(null);
    setActiveYear(undefined);
    setActiveMonth(undefined);
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
            ← Demonstrativos
          </button>
        </header>
        <PrestadorDemonstrativoPage
          prestador={activePrestador}
          isAdmin={isAdmin()}
          onBack={handleBack}
          initialYear={activeYear}
          initialMonth={activeMonth}
        />
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
            { key: 'demonstrativos', label: 'Demonstrativos', icon: LayoutList },
            { key: 'cadastro',       label: 'Cadastro',       icon: Users },
          ] as { key: Aba; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
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
      ) : (
        <DemonstrativosListPage
          onOpenPrestador={(p, y, m) => handleOpenPrestador(p, y, m)}
        />
      )}
    </div>
  );
}

