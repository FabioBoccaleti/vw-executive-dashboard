import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { PrestadoresListPage } from './PrestadoresListPage';
import { PrestadorDemonstrativoPage } from './PrestadorDemonstrativoPage';
import type { PrestadorPJ } from './remPjStorage';

interface RemuneracoesPJDashboardProps {
  onBack: () => void;
}

export function RemuneracoesPJDashboard({ onBack }: RemuneracoesPJDashboardProps) {
  const { canAccessFolhaSub, isAdmin } = useAuth();
  const canAccess = isAdmin() || canAccessFolhaSub('folha.pj');

  const [activePrestador, setActivePrestador] = useState<PrestadorPJ | null>(null);

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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header global */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Remunerações PJ</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Folha de Pagamento
            {activePrestador ? ` · ${activePrestador.nome}` : ' · Prestadores de Serviço'}
          </p>
        </div>
        <button
          onClick={activePrestador ? () => setActivePrestador(null) : onBack}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
        >
          ← {activePrestador ? 'Prestadores' : 'Voltar'}
        </button>
      </header>

      {/* Conteúdo */}
      {activePrestador ? (
        <PrestadorDemonstrativoPage
          prestador={activePrestador}
          isAdmin={isAdmin()}
          onBack={() => setActivePrestador(null)}
        />
      ) : (
        <PrestadoresListPage
          isAdmin={isAdmin()}
          onOpenPrestador={setActivePrestador}
        />
      )}
    </div>
  );
}
