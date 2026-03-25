import { Shield, Layers, Clock, TableProperties } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { VendasSubModuleId } from '@/lib/authTypes';

const BLINDAGEM_SUBS: VendasSubModuleId[] = [
  'blindagem.tabela', 'blindagem.analise', 'blindagem.todas',
  'blindagem.revenda_vw', 'blindagem.revenda_audi', 'blindagem.estoque', 'blindagem.notas_a_emitir',
];
const PELICULAS_SUBS: VendasSubModuleId[] = ['peliculas.tabela', 'peliculas.analise'];

interface VendasSelectionPageProps {
  onSelect: (option: 'blindagem' | 'peliculas' | 'importar-pdf' | 'tabela-dados') => void;
  onChangeBrand: () => void;
}

export function VendasSelectionPage({ onSelect, onChangeBrand }: VendasSelectionPageProps) {
  const { canAccessVendasSub, isAdmin } = useAuth();
  const canBlindagem = isAdmin() || BLINDAGEM_SUBS.some(s => canAccessVendasSub(s));
  const canPeliculas = isAdmin() || PELICULAS_SUBS.some(s => canAccessVendasSub(s));

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

          {/* Card — Importação de PDF + Tabela de Dados */}
          <div className="flex-1 bg-white rounded-2xl border-2 border-emerald-400 shadow-md hover:shadow-xl hover:border-emerald-500 transition-all duration-200 p-6 flex flex-col items-center gap-4 text-center">
            <div className="p-4 rounded-full bg-emerald-50">
              <Clock className="w-10 h-10 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Importação de PDF /<br />Tabela de Dados
              </h2>
            </div>
            <div className="flex flex-col gap-2 w-full mt-1">
              <button
                onClick={() => onSelect('importar-pdf')}
                className="w-full py-2 px-4 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 active:scale-95 transition-all shadow-sm"
              >
                Importar PDF
              </button>
              <button
                onClick={() => onSelect('tabela-dados')}
                className="w-full py-2 px-4 rounded-xl border-2 border-emerald-400 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <TableProperties className="w-4 h-4" />
                Tabela de Dados
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
