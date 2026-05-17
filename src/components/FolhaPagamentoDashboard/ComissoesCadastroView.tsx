import { useState, useEffect } from 'react';
import { Users, Car, RefreshCw } from 'lucide-react';
import {
  loadRemuneracao,
  type ModalidadeVenda,
  type RemuneracaoData,
} from '@/components/VendasBonificacoesDashboard/vendedoresRemuneracaoStorage';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtPercent(val: string) {
  const n = parseFloat(val.replace(',', '.'));
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + '%';
}

// ─── Constantes ──────────────────────────────────────────────────────────────
const TABS: { id: ModalidadeVenda; label: string }[] = [
  { id: 'novos',       label: 'Veículos Novos' },
  { id: 'usados',      label: 'Veículos Usados' },
  { id: 'vd_frotista', label: 'VD / Frotista' },
];

// ─── Componente principal ─────────────────────────────────────────────────────
export function ComissoesCadastroView() {
  const [data, setData] = useState<RemuneracaoData | null>(null);
  const [activeTab, setActiveTab] = useState<ModalidadeVenda>('novos');

  useEffect(() => {
    loadRemuneracao().then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Carregando...
      </div>
    );
  }

  const modal = data[activeTab];
  const faixas = modal.faixasBonus;
  const lastIdx = faixas.length - 1;

  return (
    <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
      {/* ── Sidebar ── */}
      <aside className="w-72 bg-white border-r border-slate-200 flex-shrink-0 overflow-y-auto">
        <nav className="p-3 space-y-1">
          <div className="w-full text-left flex items-start gap-3 px-3 py-3 rounded-lg bg-slate-800 text-white shadow-sm">
            <span className="mt-0.5 flex-shrink-0 text-white">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">
                Vendedores e Regra de Remuneração de Venda de Veículos
              </p>
              <p className="text-xs mt-0.5 text-white/70">
                Percentuais de comissão e bônus de produtividade por modalidade de venda
              </p>
            </div>
          </div>
        </nav>
      </aside>

      {/* ── Content area ── */}
      <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          {/* Título da seção */}
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-slate-500" />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Vendedores e Regra de Remuneração de Venda de Veículos
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Percentuais de comissão e bônus de produtividade por modalidade de venda
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* ── Abas de modalidade ── */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex border-b border-slate-200">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                      activeTab === tab.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6 space-y-8">
                {/* ── Comissões ── */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                    Comissões
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Comissão s/ Venda */}
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-600 mb-1">
                        % Comissão s/ Valor da Venda
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="w-32 border border-slate-200 rounded px-2.5 py-1.5 text-right text-sm bg-slate-100 text-slate-700 font-mono">
                          {modal.comissaoVenda || '—'}
                        </span>
                        <span className="text-sm text-slate-500">%</span>
                        {modal.comissaoVenda && (
                          <span className="text-sm text-emerald-600 font-semibold ml-auto">
                            {fmtPercent(modal.comissaoVenda)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Comissão s/ Lucro Bruto */}
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-600 mb-1">
                        % Comissão s/ Lucro Bruto
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="w-32 border border-slate-200 rounded px-2.5 py-1.5 text-right text-sm bg-slate-100 text-slate-700 font-mono">
                          {modal.comissaoLucroBruto || '—'}
                        </span>
                        <span className="text-sm text-slate-500">%</span>
                        {modal.comissaoLucroBruto && (
                          <span className="text-sm text-emerald-600 font-semibold ml-auto">
                            {fmtPercent(modal.comissaoLucroBruto)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* ── Bônus de Produtividade ── */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      Bônus de Produtividade (por volume mensal)
                    </h3>
                  </div>

                  {faixas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-400 text-sm gap-2">
                      <Car className="w-7 h-7" />
                      Nenhuma faixa cadastrada.
                    </div>
                  ) : (
                    <div className="overflow-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wide">
                            <th className="px-4 py-2.5 text-center font-semibold w-12">#</th>
                            <th className="px-4 py-2.5 text-center font-semibold">De (vendas)</th>
                            <th className="px-4 py-2.5 text-center font-semibold">Até (vendas)</th>
                            <th className="px-4 py-2.5 text-center font-semibold">% Bônus s/ Venda</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {faixas.map((f, idx) => {
                            const isLast = idx === lastIdx;
                            return (
                              <tr key={f.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                <td className="px-4 py-2.5 text-center text-slate-400 text-xs font-mono">
                                  {idx + 1}
                                </td>
                                <td className="px-4 py-2.5 text-center text-slate-700 text-xs font-mono">
                                  {f.de || '—'}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  {isLast ? (
                                    <span className="inline-block px-3 py-1 rounded bg-amber-100 text-amber-700 text-xs font-semibold">
                                      em diante
                                    </span>
                                  ) : (
                                    <span className="text-slate-700 text-xs font-mono">
                                      {f.ate || '—'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className="text-slate-700 text-xs font-mono">
                                      {f.percentual || '—'}
                                    </span>
                                    {f.percentual && (
                                      <>
                                        <span className="text-slate-500 text-xs">%</span>
                                        <span className="text-emerald-600 font-semibold text-xs min-w-[50px]">
                                          {fmtPercent(f.percentual)}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {faixas.length > 0 && (
                    <p className="text-xs text-slate-400 mt-2">
                      A última faixa é sempre aberta ("em diante"). Para definir um limite, adicione uma nova faixa abaixo dela.
                    </p>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
