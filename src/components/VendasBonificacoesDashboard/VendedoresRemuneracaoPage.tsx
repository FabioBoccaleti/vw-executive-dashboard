import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, Car, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  loadRemuneracao,
  saveRemuneracao,
  type ModalidadeVenda,
  type RemuneracaoData,
  type FaixaBonus,
} from './vendedoresRemuneracaoStorage';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function newId() {
  return Math.random().toString(36).slice(2, 10);
}

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
export function VendedoresRemuneracaoPage() {
  const [data, setData] = useState<RemuneracaoData | null>(null);
  const [activeTab, setActiveTab] = useState<ModalidadeVenda>('novos');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // ── Carrega ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadRemuneracao().then(setData);
  }, []);

  // ── Salva ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!data) return;
    setSaving(true);
    try {
      await saveRemuneracao(data);
      setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setSaving(false);
    }
  }, [data]);

  // ── Atualiza campo de texto da modalidade ────────────────────────────────
  function setField(field: 'comissaoVenda' | 'comissaoLucroBruto', value: string) {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [activeTab]: { ...prev[activeTab], [field]: value },
      };
    });
  }

  // ── Faixas de bônus ──────────────────────────────────────────────────────
  function addFaixa() {
    setData(prev => {
      if (!prev) return prev;
      const nova: FaixaBonus = { id: newId(), de: '', ate: '', percentual: '' };
      return {
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          faixasBonus: [...prev[activeTab].faixasBonus, nova],
        },
      };
    });
  }

  function updateFaixa(id: string, field: keyof FaixaBonus, value: string) {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          faixasBonus: prev[activeTab].faixasBonus.map(f =>
            f.id === id ? { ...f, [field]: value } : f
          ),
        },
      };
    });
  }

  function removeFaixa(id: string) {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          faixasBonus: prev[activeTab].faixasBonus.filter(f => f.id !== id),
        },
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  % Comissão s/ Valor da Venda
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={modal.comissaoVenda}
                    onChange={e => setField('comissaoVenda', e.target.value)}
                    placeholder="0,00"
                    className="w-32 border border-slate-300 rounded px-2.5 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  % Comissão s/ Lucro Bruto
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={modal.comissaoLucroBruto}
                    onChange={e => setField('comissaoLucroBruto', e.target.value)}
                    placeholder="0,00"
                    className="w-32 border border-slate-300 rounded px-2.5 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
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
              <Button
                size="sm"
                variant="outline"
                onClick={addFaixa}
                className="h-8 text-xs flex items-center gap-1.5 border-slate-300 text-slate-600 hover:bg-slate-100"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar faixa
              </Button>
            </div>

            {faixas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-400 text-sm gap-2">
                <Car className="w-7 h-7" />
                Nenhuma faixa cadastrada. Clique em "Adicionar faixa" para começar.
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
                      <th className="px-4 py-2.5 text-center font-semibold w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {faixas.map((f, idx) => {
                      const isLast = idx === lastIdx;
                      return (
                        <tr key={f.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                          <td className="px-4 py-2 text-center text-slate-400 text-xs font-mono">
                            {idx + 1}
                          </td>
                          {/* De */}
                          <td className="px-4 py-2 text-center">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={f.de}
                              onChange={e => updateFaixa(f.id, 'de', e.target.value)}
                              placeholder="0"
                              className="w-20 border border-slate-300 rounded px-2 py-1 text-center text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                          </td>
                          {/* Até */}
                          <td className="px-4 py-2 text-center">
                            {isLast ? (
                              <span className="inline-block px-3 py-1 rounded bg-amber-100 text-amber-700 text-xs font-semibold">
                                em diante
                              </span>
                            ) : (
                              <input
                                type="text"
                                inputMode="numeric"
                                value={f.ate}
                                onChange={e => updateFaixa(f.id, 'ate', e.target.value)}
                                placeholder="0"
                                className="w-20 border border-slate-300 rounded px-2 py-1 text-center text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                              />
                            )}
                          </td>
                          {/* % Bônus */}
                          <td className="px-4 py-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={f.percentual}
                                onChange={e => updateFaixa(f.id, 'percentual', e.target.value)}
                                placeholder="0,00"
                                className="w-24 border border-slate-300 rounded px-2 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                              />
                              <span className="text-slate-500 text-xs">%</span>
                              {f.percentual && (
                                <span className="text-emerald-600 font-semibold text-xs min-w-[50px]">
                                  {fmtPercent(f.percentual)}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Remover */}
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => removeFaixa(f.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                              title="Remover faixa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

      {/* ── Botão salvar ── */}
      <div className="flex items-center justify-between">
        {savedAt ? (
          <span className="text-xs text-slate-400">Salvo às {savedAt}</span>
        ) : (
          <span />
        )}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-slate-800 hover:bg-slate-700 text-white h-9 px-5 text-sm flex items-center gap-2"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </div>
    </div>
  );
}
