import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Check, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadEsteticaAliquotas, saveEsteticaAliquotas, type AliquotaImposto,
} from '../cadastrosStorage';

function emptyAliquota(): AliquotaImposto {
  return { id: crypto.randomUUID(), tipoImposto: '', aliquota: '', encargos: '' };
}

function fmtPct(v: string) {
  if (!v) return '—';
  const n = parseFloat(v);
  return isNaN(n) ? v : `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
}

export function EsteticaAliquotasSection() {
  const [items, setItems] = useState<AliquotaImposto[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AliquotaImposto>(emptyAliquota());
  const [newForm, setNewForm] = useState<AliquotaImposto>(emptyAliquota());

  useEffect(() => {
    loadEsteticaAliquotas().then(d => { setItems(d); setLoading(false); });
  }, []);

  const persist = async (updated: AliquotaImposto[]) => {
    setSaving(true);
    try {
      const ok = await saveEsteticaAliquotas(updated);
      if (!ok) toast.error('Erro ao salvar.');
      else setItems(updated);
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    if (!newForm.tipoImposto.trim()) { toast.error('Informe o Tipo de Imposto.'); return; }
    await persist([...items, { ...newForm, id: crypto.randomUUID() }]);
    setNewForm(emptyAliquota());
    toast.success('Alíquota cadastrada');
  };

  const startEdit = (item: AliquotaImposto) => { setEditingId(item.id); setDraft({ ...item }); };

  const saveEdit = async () => {
    if (!draft.tipoImposto.trim()) { toast.error('Informe o Tipo de Imposto.'); return; }
    await persist(items.map(i => i.id === editingId ? draft : i));
    setEditingId(null);
    toast.success('Alíquota atualizada');
  };

  const remove = async (id: string) => {
    await persist(items.filter(i => i.id !== id));
    toast.success('Alíquota removida');
  };

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* ── Formulário de adição ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Nova Alíquota</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo de Imposto *</label>
            <input
              type="text"
              placeholder="Ex: ISS, PIS, COFINS..."
              value={newForm.tipoImposto}
              onChange={e => setNewForm(f => ({ ...f, tipoImposto: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') add(); }}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={add}
            disabled={saving || !newForm.tipoImposto.trim()}
            size="sm"
            style={{ background: '#312e81' }}
            className="text-white hover:opacity-90"
          >
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#312e81' }}>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Tipo de Imposto</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-36">Alíquota (%)</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-36">Encargos (%)</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-400 text-xs py-8">
                  Nenhuma alíquota cadastrada
                </td>
              </tr>
            )}
            {items.map((item, idx) => {
              const isEdit = editingId === item.id;
              return (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-2 text-xs text-slate-700">
                    {isEdit ? (
                      <input
                        type="text"
                        value={draft.tipoImposto}
                        onChange={e => setDraft(d => ({ ...d, tipoImposto: e.target.value }))}
                        className="w-full border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        autoFocus
                      />
                    ) : item.tipoImposto}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-700 text-center">
                    {isEdit ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={draft.aliquota}
                        onChange={e => setDraft(d => ({ ...d, aliquota: e.target.value }))}
                        className="w-full border border-indigo-300 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    ) : fmtPct(item.aliquota)}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-700 text-center">
                    {isEdit ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={draft.encargos}
                        onChange={e => setDraft(d => ({ ...d, encargos: e.target.value }))}
                        className="w-full border border-indigo-300 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    ) : fmtPct(item.encargos)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1.5">
                      {isEdit ? (
                        <>
                          <button onClick={saveEdit} disabled={saving} className="text-green-600 hover:text-green-700 p-1 rounded">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(item)} className="text-blue-500 hover:text-blue-700 p-1 rounded">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => remove(item.id)} className="text-red-400 hover:text-red-600 p-1 rounded">
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
