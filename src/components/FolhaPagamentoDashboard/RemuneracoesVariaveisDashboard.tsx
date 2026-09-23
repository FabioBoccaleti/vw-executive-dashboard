import { useState } from 'react';
import { Users, LayoutList } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { ColaboradoresListPage } from './ColaboradoresListPage';
import { DemonstrativosVariaveisListPage } from './DemonstrativosVariaveisListPage';
import { ResumoRemuneracoesVariaveisPage } from './ResumoRemuneracoesVariaveisPage';
import { ColaboradorDemonstrativoPage } from './ColaboradorDemonstrativoPage';
import type { Colaborador } from './remVariaveisStorage';

type Aba = 'demonstrativos' | 'resumo' | 'cadastro';

interface RemuneracoesVariaveisDashboardProps {
  onBack: () => void;
}

export function RemuneracoesVariaveisDashboard({ onBack }: RemuneracoesVariaveisDashboardProps) {
  const { isAdmin } = useAuth();
  const admin = isAdmin();

  const [aba, setAba] = useState<Aba>('demonstrativos');
  const [activeColaborador, setActiveColaborador] = useState<Colaborador | null>(null);
  const [activeYear,  setActiveYear]  = useState<number | undefined>();
  const [activeMonth, setActiveMonth] = useState<number | undefined>();

  function handleOpenColaborador(colaborador: Colaborador, year?: number, month?: number) {
    setActiveColaborador(colaborador);
    setActiveYear(year);
    setActiveMonth(month);
  }

  function handleBackToList() {
    setActiveColaborador(null);
    setActiveYear(undefined);
    setActiveMonth(undefined);
  }

  // Sub-view: demonstrativo individual
  if (activeColaborador) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Remunerações Variáveis</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Folha de Pagamento · {activeColaborador.nome}
            </p>
          </div>
          <button
            onClick={handleBackToList}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
          >
            ← Voltar
          </button>
        </header>
        <ColaboradorDemonstrativoPage
          colaborador={activeColaborador}
          isAdmin={admin}
          onBack={handleBackToList}
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
          <h1 className="text-lg font-bold text-slate-800">Remunerações Variáveis</h1>
          <p className="text-xs text-slate-500 mt-0.5">Folha de Pagamento · Colaboradores</p>
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
            { key: 'resumo',         label: 'Resumo',         icon: LayoutList },
            { key: 'cadastro',       label: 'Cadastro',       icon: Users },
          ] as { key: Aba; label: string; icon: React.ElementType }[])
            .map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setAba(key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                aba === key
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      {aba === 'demonstrativos' ? (
        <DemonstrativosVariaveisListPage onOpenColaborador={handleOpenColaborador} />
      ) : aba === 'resumo' ? (
        <ResumoRemuneracoesVariaveisPage />
      ) : (
        <ColaboradoresListPage isAdmin={admin} onOpenColaborador={handleOpenColaborador} />
      )}
    </div>
  );
}
