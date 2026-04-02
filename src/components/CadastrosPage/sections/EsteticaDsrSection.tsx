import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Check, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { loadEsteticaDsr, saveEsteticaDsr, type DsrConfig } from '../cadastrosStorage';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function emptyDsr(): DsrConfig {
  return { id: crypto.randomUUID(), ano: new Date().getFullYear(), mes: new Date().getMonth() + 1, percentual: '' };
}

function fmtPct(v: string) {
  if (!v) return '—';
  const n = parseFloat(v);
  return isNaN(n) ? v : `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
}

export function EsteticaDsrSection() {
  const [items, setItems] = useState<DsrConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DsrConfig>(emptyDsr());
  const [newForm, setNewForm] = useState<DsrConfig>(emptyDsr());

  useEffect(() => {
    loadEsteticaDsr().then(d => { setItems(d); setLoading(false); });
  }, []);

  const persist = async (updated: DsrConfig[]) => {
    setSaving(true);
    try {
      const ok = await saveEsteticaDsr(updated);
      if (!ok) toast.error('Erro ao salvar.');
      else setItems(updated);
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    if (!newForm.percentual.trim()) { toast.error('Informe o percentual DSR.'); return; }
    const duplicate = items.find(i => i.ano === newForm.ano && i.mes === newForm.mes);
    if (duplicate) { toast.error('Já existe um registro para este Ano/Mês.'); return; }
    await persist([...items, { ...newForm, id: crypto.randomUUID() }]);
    setNewForm(emptyDsr());
    toast.success('DSR cadastrado');
  };

  const startEdit = (item: DsrConfig) => { setEditingId(item.id); setDraft({ ...item }); };

  const saveEdit = async () => {
    if (!draft.percentual.trim()) { toast.error('Informe o percentual DSR.'); return; }
    const duplicate = items.find(i => i.id !== draft.id && i.ano === draft.ano && i.mes === draft.mes);
    if (duplicate) { toast.error('Já existe um registro para este Ano/Mês.'); return; }
    await persist(items.map(i => i.id === editingId ? draft : i));
    setEditingId(null);
    toast.success('DSR atualizado');
  };

  const remove = async (id: string) => {
    await persist(items.filter(i => i.id !== id));
    toast.success('DSR removido');
  };

  // Ordena por ano desc, mês desc
  const sortedItems = [...items].sort((a, b) => b.ano - a.ano || b.mes - a.mes);

  const availableYears = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>;

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
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Mês *</label>
            <select
              value={newForm.mes}
              onChange={e => setNewForm(f => ({ ...f, mes: Number(e.target.value) }))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
              onKeyDown={e => { if (e.key === 'Enter') add(); }}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={add}
            disabled={saving || !newForm.percentual.trim()}
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
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Ano</th>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Mês</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-40">% DSR</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-400 text-xs py-8">
                  Nenhum percentual DSR cadastrado
                </td>
              </tr>
            )}
            {sortedItems.map((item, idx) => {
              const isEdit = editingId === item.id;
              return (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-2 text-xs text-slate-700">
                    {isEdit ? (
                      <select
                        value={draft.ano}
                        onChange={e => setDraft(d => ({ ...d, ano: Number(e.target.value) }))}
                        className="border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    ) : item.ano}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-700">
                    {isEdit ? (
                      <select
                        value={draft.mes}
                        onChange={e => setDraft(d => ({ ...d, mes: Number(e.target.value) }))}
                        className="border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                      </select>
                    ) : MONTHS[item.mes - 1]}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-700 text-center">
                    {isEdit ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={draft.percentual}
                        onChange={e => setDraft(d => ({ ...d, percentual: e.target.value }))}
                        className="w-full border border-indigo-300 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        autoFocus
                      />
                    ) : fmtPct(item.percentual)}
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
