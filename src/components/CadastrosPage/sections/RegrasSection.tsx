import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Check, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { loadRegras, saveRegras, CARGOS_VENDEDOR, BASES_CALCULO, type RegraRemuneracao } from '../cadastrosStorage';

const emptyRegra = (): Omit<RegraRemuneracao, 'id'> => ({
  nome: '',
  cargo: CARGOS_VENDEDOR[0],
  baseCalculo: BASES_CALCULO[0],
  percentual: '',
});

export function RegrasSection() {
  const [items, setItems] = useState<RegraRemuneracao[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState(emptyRegra());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<RegraRemuneracao | null>(null);

  useEffect(() => {
    loadRegras().then(d => { setItems(d); setLoading(false); });
  }, []);

  const persist = async (updated: RegraRemuneracao[]) => {
    setSaving(true);
    try {
      const ok = await saveRegras(updated);
      if (!ok) toast.error('Erro ao salvar.');
      else setItems(updated);
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    if (!novo.nome.trim() || !novo.percentual.trim()) return;
    await persist([...items, { id: crypto.randomUUID(), ...novo, nome: novo.nome.trim() }]);
    setNovo(emptyRegra());
    toast.success('Regra cadastrada');
  };

  const saveEdit = async () => {
    if (!editDraft || !editDraft.nome.trim() || !editDraft.percentual.trim()) return;
    await persist(items.map(i => i.id === editDraft.id ? editDraft : i));
    setEditingId(null);
    setEditDraft(null);
    toast.success('Regra atualizada');
  };

  const remove = async (id: string) => {
    await persist(items.filter(i => i.id !== id));
    toast.success('Regra removida');
  };

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>;

  return (
    <div>
      {/* Formulário de adição */}
      <div className="bg-white border rounded-lg p-4 mb-5 grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Nome da Regra</label>
          <Input placeholder="Ex: Comissão Vendedor VW" value={novo.nome}
            onChange={e => setNovo(p => ({ ...p, nome: e.target.value }))} className="text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Cargo</label>
          <select value={novo.cargo} onChange={e => setNovo(p => ({ ...p, cargo: e.target.value }))}
            className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
            {CARGOS_VENDEDOR.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Base de Cálculo</label>
          <select value={novo.baseCalculo} onChange={e => setNovo(p => ({ ...p, baseCalculo: e.target.value }))}
            className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
            {BASES_CALCULO.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Percentual (%)</label>
          <Input placeholder="Ex: 5.5" type="number" min="0" max="100" step="0.1"
            value={novo.percentual} onChange={e => setNovo(p => ({ ...p, percentual: e.target.value }))} className="text-sm" />
        </div>
        <div className="col-span-2 flex justify-end">
          <Button onClick={add} disabled={saving || !novo.nome.trim() || !novo.percentual.trim()} size="sm"
            style={{ background: '#1f2937' }} className="text-white hover:opacity-90">
            <Plus className="w-4 h-4 mr-1" /> Adicionar Regra
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#1f2937' }}>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Nome da Regra</th>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Cargo</th>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Base de Cálculo</th>
              <th className="text-white text-right px-4 py-3 text-xs font-semibold">%</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={5} className="text-center text-slate-400 text-xs py-8">Nenhuma regra cadastrada</td></tr>
            )}
            {items.map((item, idx) => {
              const isEditing = editingId === item.id;
              const d = isEditing ? editDraft! : item;
              return (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-2 text-xs text-slate-700">
                    {isEditing
                      ? <Input value={d.nome} onChange={e => setEditDraft(p => p ? { ...p, nome: e.target.value } : p)} className="h-7 text-xs" autoFocus />
                      : item.nome}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-700">
                    {isEditing
                      ? <select value={d.cargo} onChange={e => setEditDraft(p => p ? { ...p, cargo: e.target.value } : p)}
                          className="border rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
                          {CARGOS_VENDEDOR.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      : item.cargo}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-700">
                    {isEditing
                      ? <select value={d.baseCalculo} onChange={e => setEditDraft(p => p ? { ...p, baseCalculo: e.target.value } : p)}
                          className="border rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
                          {BASES_CALCULO.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      : item.baseCalculo}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-700 text-right font-mono">
                    {isEditing
                      ? <Input value={d.percentual} onChange={e => setEditDraft(p => p ? { ...p, percentual: e.target.value } : p)}
                          type="number" min="0" max="100" step="0.1" className="h-7 text-xs text-right w-20 ml-auto" />
                      : `${item.percentual}%`}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1.5">
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} disabled={saving} className="text-green-600 hover:text-green-700 p-1 rounded"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { setEditingId(null); setEditDraft(null); }} className="text-slate-400 hover:text-slate-600 p-1 rounded"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(item.id); setEditDraft({ ...item }); }} className="text-blue-500 hover:text-blue-700 p-1 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => remove(item.id)} className="text-red-400 hover:text-red-600 p-1 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
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
