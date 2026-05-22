import { useState } from 'react';
import { Shield, Layers, Car, Sparkles, Banknote, Wrench, ClipboardList } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import type { VendasSubModuleId } from '@/lib/authTypes';
import { BaseDateBadge } from '@/components/BaseDateBadge';

const BLINDAGEM_SUBS: VendasSubModuleId[] = [
  'blindagem.tabela', 'blindagem.analise', 'blindagem.todas',
  'blindagem.revenda_vw', 'blindagem.revenda_audi', 'blindagem.estoque', 'blindagem.notas_a_emitir',
];
const PELICULAS_SUBS: VendasSubModuleId[] = ['peliculas.tabela', 'peliculas.analise'];
const ESTETICA_SUBS: VendasSubModuleId[] = ['estetica.tabela', 'estetica.analise'];
const FINANCIAMENTO_BV_SUBS: VendasSubModuleId[] = ['financiamento_bv.vendas', 'financiamento_bv.acelera', 'financiamento_bv.cadastro'];
const VPECAS_COND_SUBS: VendasSubModuleId[] = ['vpecas_cond.relatorios', 'vpecas_cond.resumo'];

interface VendasSelectionPageProps {
  onSelect: (option: 'blindagem' | 'peliculas' | 'estetica' | 'importar-pdf' | 'financiamento-banco-volks' | 'vpecas-condicao-pagamento' | 'despachante') => void;
  onChangeBrand: () => void;
}

export function VendasSelectionPage({ onSelect, onChangeBrand }: VendasSelectionPageProps) {
  const { canAccessVendasSub, isAdmin } = useAuth();
  const canBlindagem = isAdmin() || BLINDAGEM_SUBS.some(s => canAccessVendasSub(s));
  const canPeliculas = isAdmin() || PELICULAS_SUBS.some(s => canAccessVendasSub(s));
  const canEstetica  = isAdmin() || ESTETICA_SUBS.some(s => canAccessVendasSub(s));
  const canFinanciamentoBV = isAdmin() || FINANCIAMENTO_BV_SUBS.some(s => canAccessVendasSub(s));
  const canVPecasCond     = isAdmin() || VPECAS_COND_SUBS.some(s => canAccessVendasSub(s));



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

          {/* Card — Análise e Controle de Vendas de Serviços de Estética Audi */}
          {canEstetica && (
          <button
            onClick={() => onSelect('estetica')}
            className="flex-1 bg-white rounded-2xl border-2 border-teal-400 shadow-md hover:shadow-xl hover:border-teal-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-teal-50 group-hover:bg-teal-100 transition-colors">
              <Sparkles className="w-10 h-10 text-teal-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Análise e Controle de Vendas<br />de Serviços de Estética Audi
              </h2>
            </div>
          </button>
          )}

          {/* Card — Central de Vendas VW */}
          <button
            onClick={() => onSelect('importar-pdf')}
            className="flex-1 bg-white rounded-2xl border-2 border-emerald-400 shadow-md hover:shadow-xl hover:border-emerald-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
              <Car className="w-10 h-10 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Central de Vendas VW
              </h2>
              <BaseDateBadge dateKey="base_date:central_vendas_vw" />
            </div>
          </button>

          {/* Card — Financiamento Banco Volks */}
          {canFinanciamentoBV && (
          <button
            onClick={() => onSelect('financiamento-banco-volks')}
            className="flex-1 bg-white rounded-2xl border-2 border-blue-400 shadow-md hover:shadow-xl hover:border-blue-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-blue-50 group-hover:bg-blue-100 transition-colors">
              <Banknote className="w-10 h-10 text-blue-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Financiamento Banco Volks
              </h2>
            </div>
          </button>
          )}

          {/* Card — Vendas Peças, Oficina e Funilaria por Condição de Pagamento */}
          {canVPecasCond && (
          <button
            onClick={() => onSelect('vpecas-condicao-pagamento')}
            className="flex-1 bg-white rounded-2xl border-2 border-orange-400 shadow-md hover:shadow-xl hover:border-orange-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
              <Wrench className="w-10 h-10 text-orange-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Vendas Peças, Oficina e Funilaria<br />por Condição de Pagamento
              </h2>
            </div>
          </button>
          )}

          {/* Card — Serviços de Despachante */}
          <button
            onClick={() => onSelect('despachante')}
            className="flex-1 bg-white rounded-2xl border-2 border-violet-400 shadow-md hover:shadow-xl hover:border-violet-500 hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-violet-50 group-hover:bg-violet-100 transition-colors">
              <ClipboardList className="w-10 h-10 text-violet-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                Serviços de Despachante
              </h2>
            </div>
          </button>

        </div>
      </div>


    </div>
  );
}
