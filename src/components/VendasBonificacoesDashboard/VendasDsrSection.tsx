import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  loadVendasDsr,
  saveVendasDsr,
  type VendasDsrConfig,
} from './vendedoresRemuneracaoStorage';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const AVAILABLE_YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

function emptyDsr(): VendasDsrConfig {
  return {
    id: crypto.randomUUID(),
    ano: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    percentual: '',
  };
}

function fmtPct(v: string) {
  if (!v) return '—';
  const n = parseFloat(v);
  return isNaN(n) ? v : `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
}

export function VendasDsrSection() {
  const [items, setItems]       = useState<VendasDsrConfig[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft]       = useState<VendasDsrConfig>(emptyDsr());
  const [newForm, setNewForm]   = useState<VendasDsrConfig>(emptyDsr());

  useEffect(() => {
    loadVendasDsr().then(d => { setItems(d); setLoading(false); });
  }, []);

  async function persist(updated: VendasDsrConfig[]) {
    setSaving(true);
    try {
      await saveVendasDsr(updated);
      setItems(updated);
    } catch {
      toast.error('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    if (!newForm.percentual.trim()) { toast.error('Informe o percentual DSR.'); return; }
    const dup = items.find(i => i.ano === newForm.ano && i.mes === newForm.mes);
    if (dup) { toast.error('Já existe um registro para este Ano/Mês.'); return; }
    await persist([...items, { ...newForm, id: crypto.randomUUID() }]);
    setNewForm(emptyDsr());
    toast.success('DSR cadastrado.');
  }

  function startEdit(item: VendasDsrConfig) {
    setEditingId(item.id);
    setDraft({ ...item });
  }

  async function saveEdit() {
    if (!draft.percentual.trim()) { toast.error('Informe o percentual DSR.'); return; }
    const dup = items.find(i => i.id !== draft.id && i.ano === draft.ano && i.mes === draft.mes);
    if (dup) { toast.error('Já existe um registro para este Ano/Mês.'); return; }
    await persist(items.map(i => i.id === editingId ? draft : i));
    setEditingId(null);
    toast.success('DSR atualizado.');
  }

  async function handleRemove(id: string) {
    await persist(items.filter(i => i.id !== id));
    toast.success('DSR removido.');
  }

  const sorted = [...items].sort((a, b) => b.ano - a.ano || b.mes - a.mes);

  if (loading) {
    return <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Formulário de adição ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Novo Percentual DSR</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Ano *</label>
            <select
              value={newForm.ano}
              onChange={e => setNewForm(f => ({ ...f, ano: Number(e.target.value) }))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Mês *</label>
            <select
              value={newForm.mes}
              onChange={e => setNewForm(f => ({ ...f, mes: Number(e.target.value) }))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">% DSR *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="Ex: 16.67"
              value={newForm.percentual}
              onChange={e => setNewForm(f => ({ ...f, percentual: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleAdd}
            disabled={saving || !newForm.percentual.trim()}
            size="sm"
            className="bg-slate-800 hover:bg-slate-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-4 py-3 text-left text-xs font-semibold">Ano</th>
              <th className="px-4 py-3 text-left text-xs font-semibold">Mês</th>
              <th className="px-4 py-3 text-center text-xs font-semibold w-40">% DSR</th>
              <th className="px-4 py-3 text-center text-xs font-semibold w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-400 text-xs py-8">
                  Nenhum percentual DSR cadastrado.
                </td>
              </tr>
            )}
            {sorted.map((item, idx) => {
              const isEdit = editingId === item.id;
              return (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  {/* Ano */}
                  <td className="px-4 py-2.5 text-xs text-slate-700">
                    {isEdit ? (
                      <select
                        value={draft.ano}
                        onChange={e => setDraft(d => ({ ...d, ano: Number(e.target.value) }))}
                        className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400"
                      >
                        {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    ) : item.ano}
                  </td>
                  {/* Mês */}
                  <td className="px-4 py-2.5 text-xs text-slate-700">
                    {isEdit ? (
                      <select
                        value={draft.mes}
                        onChange={e => setDraft(d => ({ ...d, mes: Number(e.target.value) }))}
                        className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400"
                      >
                        {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                      </select>
                    ) : MONTHS[item.mes - 1]}
                  </td>
                  {/* % DSR */}
                  <td className="px-4 py-2.5 text-xs text-slate-700 text-center">
                    {isEdit ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={draft.percentual}
                        onChange={e => setDraft(d => ({ ...d, percentual: e.target.value }))}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    ) : (
                      <span className="font-semibold text-emerald-700">{fmtPct(item.percentual)}</span>
                    )}
                  </td>
                  {/* Ações */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-1.5">
                      {isEdit ? (
                        <>
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Confirmar"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 rounded text-slate-400 hover:bg-slate-100 transition-colors"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemove(item.id)}
                            className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
    </div>
  );
}
