import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  loadAliquotas,
  saveAliquotas,
  type AliquotaImposto,
} from './vendedoresRemuneracaoStorage';

function emptyForm(): Omit<AliquotaImposto, 'id'> {
  return { tipo: '', aliquota: '', encargos: '' };
}

function fmtPct(v: string) {
  if (!v) return '—';
  const n = parseFloat(v);
  return isNaN(n) ? v : `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
}

export function AliquotasImpostoSection() {
  const [items, setItems]         = useState<AliquotaImposto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [newForm, setNewForm]     = useState<Omit<AliquotaImposto, 'id'>>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft]         = useState<AliquotaImposto | null>(null);

  useEffect(() => {
    loadAliquotas().then(d => { setItems(d); setLoading(false); });
  }, []);

  async function persist(updated: AliquotaImposto[]) {
    setSaving(true);
    try {
      await saveAliquotas(updated);
      setItems(updated);
    } catch {
      toast.error('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    if (!newForm.tipo.trim()) { toast.error('Informe o tipo de imposto.'); return; }
    const dup = items.find(i => i.tipo.trim().toLowerCase() === newForm.tipo.trim().toLowerCase());
    if (dup) { toast.error('Já existe uma alíquota para este tipo de imposto.'); return; }
    await persist([...items, { ...newForm, tipo: newForm.tipo.trim(), id: crypto.randomUUID() }]);
    setNewForm(emptyForm());
    toast.success('Alíquota cadastrada.');
  }

  function startEdit(item: AliquotaImposto) {
    setEditingId(item.id);
    setDraft({ ...item });
  }

  async function saveEdit() {
    if (!draft) return;
    if (!draft.tipo.trim()) { toast.error('Informe o tipo de imposto.'); return; }
    const dup = items.find(i => i.id !== draft.id && i.tipo.trim().toLowerCase() === draft.tipo.trim().toLowerCase());
    if (dup) { toast.error('Já existe uma alíquota para este tipo de imposto.'); return; }
    await persist(items.map(i => i.id === editingId ? { ...draft, tipo: draft.tipo.trim() } : i));
    setEditingId(null);
    toast.success('Alíquota atualizada.');
  }

  async function handleRemove(id: string) {
    await persist(items.filter(i => i.id !== id));
    toast.success('Alíquota removida.');
  }

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* ── Formulário ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Nova Alíquota</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo de Imposto *</label>
            <input
              type="text"
              placeholder="Ex: ISS, PIS, COFINS..."
              value={newForm.tipo}
              onChange={e => setNewForm(f => ({ ...f, tipo: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Alíquota (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="Ex: 5.00"
              value={newForm.aliquota}
              onChange={e => setNewForm(f => ({ ...f, aliquota: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Encargos (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="Ex: 1.50"
              value={newForm.encargos}
              onChange={e => setNewForm(f => ({ ...f, encargos: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleAdd}
            disabled={saving || !newForm.tipo.trim()}
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
              <th className="px-4 py-3 text-left text-xs font-semibold">Tipo de Imposto</th>
              <th className="px-4 py-3 text-center text-xs font-semibold w-36">Alíquota (%)</th>
              <th className="px-4 py-3 text-center text-xs font-semibold w-36">Encargos (%)</th>
              <th className="px-4 py-3 text-center text-xs font-semibold w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-400 text-xs py-8">
                  Nenhuma alíquota cadastrada.
                </td>
              </tr>
            )}
            {items.map((item, idx) => {
              const isEdit = editingId === item.id;
              return (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  {/* Tipo */}
                  <td className="px-4 py-2.5 text-xs text-slate-700 font-medium">
                    {isEdit ? (
                      <input
                        type="text"
                        value={draft!.tipo}
                        onChange={e => setDraft(d => ({ ...d!, tipo: e.target.value }))}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    ) : item.tipo}
                  </td>
                  {/* Alíquota */}
                  <td className="px-4 py-2.5 text-xs text-center">
                    {isEdit ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={draft!.aliquota}
                        onChange={e => setDraft(d => ({ ...d!, aliquota: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    ) : (
                      <span className="font-semibold text-emerald-700">{fmtPct(item.aliquota)}</span>
                    )}
                  </td>
                  {/* Encargos */}
                  <td className="px-4 py-2.5 text-xs text-center">
                    {isEdit ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={draft!.encargos}
                        onChange={e => setDraft(d => ({ ...d!, encargos: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    ) : (
                      <span className={item.encargos ? 'font-semibold text-emerald-700' : 'text-slate-300'}>
                        {fmtPct(item.encargos)}
                      </span>
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
