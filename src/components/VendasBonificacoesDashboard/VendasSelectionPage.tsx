import { useState } from 'react';
import { Shield, Layers, Car, X, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { VendasSubModuleId } from '@/lib/authTypes';

const BLINDAGEM_SUBS: VendasSubModuleId[] = [
  'blindagem.tabela', 'blindagem.analise', 'blindagem.todas',
  'blindagem.revenda_vw', 'blindagem.revenda_audi', 'blindagem.estoque', 'blindagem.notas_a_emitir',
];
const PELICULAS_SUBS: VendasSubModuleId[] = ['peliculas.tabela', 'peliculas.analise'];

interface VendasSelectionPageProps {
  onSelect: (option: 'blindagem' | 'peliculas' | 'importar-pdf') => void;
  onChangeBrand: () => void;
}

export function VendasSelectionPage({ onSelect, onChangeBrand }: VendasSelectionPageProps) {
  const { canAccessVendasSub, isAdmin } = useAuth();
  const canBlindagem = isAdmin() || BLINDAGEM_SUBS.some(s => canAccessVendasSub(s));
  const canPeliculas = isAdmin() || PELICULAS_SUBS.some(s => canAccessVendasSub(s));

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput]         = useState('');
  const [passwordError, setPasswordError]         = useState(false);

  function handleVWCardClick() {
    setPasswordInput('');
    setPasswordError(false);
    setShowPasswordModal(true);
  }

  function handlePasswordSubmit() {
    if (passwordInput === '1985') {
      setShowPasswordModal(false);
      onSelect('importar-pdf');
    } else {
      setPasswordError(true);
      setPasswordInput('');
    }
  }

  function handlePasswordClose() {
    setShowPasswordModal(false);
    setPasswordInput('');
    setPasswordError(false);
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Demonstrativo de Vendas e Bonificações</h1>
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
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">

          {/* Card — Análise e Controle das Vendas de Blindagem */}
          {canBlindagem && (
          <button
            onClick={() => onSelect('blindagem')}
            className="flex-1 bg-white rounded-2xl border-2 border-amber-400 shadow-md hover:shadow-xl hover:border-amber-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-amber-50 group-hover:bg-amber-100 transition-colors">
              <Shield className="w-10 h-10 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Análise e Controle das<br />Vendas de Blindagem
              </h2>
            </div>
          </button>
          )}

          {/* Card — Análise e Controle de Vendas de Películas na Audi */}
          {canPeliculas && (
          <button
            onClick={() => onSelect('peliculas')}
            className="flex-1 bg-white rounded-2xl border-2 border-indigo-400 shadow-md hover:shadow-xl hover:border-indigo-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
              <Layers className="w-10 h-10 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Análise e Controle de Vendas<br />de Películas na Audi
              </h2>
            </div>
          </button>
          )}

          {/* Card — Central de Vendas VW */}
          <button
            onClick={handleVWCardClick}
            className="flex-1 bg-white rounded-2xl border-2 border-emerald-400 shadow-md hover:shadow-xl hover:border-emerald-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
              <Car className="w-10 h-10 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Central de Vendas VW
              </h2>
            </div>
          </button>

        </div>
      </div>

      {/* Modal de senha */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-emerald-50">
                  <Lock className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Central de Vendas VW</h3>
              </div>
              <button onClick={handlePasswordClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-4">Digite a senha para acessar.</p>

            <input
              autoFocus
              type="password"
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Senha"
              className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-colors ${
                passwordError
                  ? 'border-red-400 focus:ring-red-300 bg-red-50'
                  : 'border-slate-300 focus:ring-emerald-300'
              }`}
            />

            {passwordError && (
              <p className="text-xs text-red-500 mt-2 font-medium">Senha incorreta. Tente novamente.</p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={handlePasswordClose}
                className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
              >
                Entrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
