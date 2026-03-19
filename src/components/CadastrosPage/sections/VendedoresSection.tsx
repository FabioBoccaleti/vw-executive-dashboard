import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Check, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { loadVendedores, saveVendedores, CARGOS_VENDEDOR, type Vendedor, type CargoVendedor } from '../cadastrosStorage';

export function VendedoresSection() {
  const [items, setItems] = useState<Vendedor[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState('');
  const [novoCargo, setNovoCargo] = useState<CargoVendedor>('Vendedor');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCargo, setEditCargo] = useState<CargoVendedor>('Vendedor');

  useEffect(() => {
    loadVendedores().then(d => { setItems(d); setLoading(false); });
  }, []);

  const persist = async (updated: Vendedor[]) => {
    setSaving(true);
    try {
      const ok = await saveVendedores(updated);
      if (!ok) toast.error('Erro ao salvar.');
      else setItems(updated);
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    await persist([...items, { id: crypto.randomUUID(), nome, cargo: novoCargo }]);
    setNovoNome('');
    toast.success('Vendedor cadastrado');
  };

  const saveEdit = async () => {
    const nome = editNome.trim();
    if (!nome || !editingId) return;
    await persist(items.map(i => i.id === editingId ? { ...i, nome, cargo: editCargo } : i));
    setEditingId(null);
    toast.success('Vendedor atualizado');
  };

  const remove = async (id: string) => {
    await persist(items.filter(i => i.id !== id));
    toast.success('Vendedor removido');
  };

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>;

  return (
    <div>
      <div className="flex gap-2 mb-5">
        <Input
          placeholder="Nome do vendedor..."
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          className="flex-1"
        />
        <select
          value={novoCargo}
          onChange={e => setNovoCargo(e.target.value as CargoVendedor)}
          className="border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          {CARGOS_VENDEDOR.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <Button onClick={add} disabled={saving || !novoNome.trim()} size="sm" style={{ background: '#1f2937' }} className="text-white hover:opacity-90">
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#1f2937' }}>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Nome</th>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Cargo</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={3} className="text-center text-slate-400 text-xs py-8">Nenhum vendedor cadastrado</td></tr>
            )}
            {items.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-4 py-2 text-xs text-slate-700">
                  {editingId === item.id ? (
                    <Input value={editNome} onChange={e => setEditNome(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      className="h-7 text-xs" autoFocus />
                  ) : item.nome}
                </td>
                <td className="px-4 py-2 text-xs text-slate-700">
                  {editingId === item.id ? (
                    <select value={editCargo} onChange={e => setEditCargo(e.target.value as CargoVendedor)}
                      className="border rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
                      {CARGOS_VENDEDOR.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : item.cargo}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-center gap-1.5">
                    {editingId === item.id ? (
                      <>
                        <button onClick={saveEdit} disabled={saving} className="text-green-600 hover:text-green-700 p-1 rounded"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded"><X className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(item.id); setEditNome(item.nome); setEditCargo(item.cargo); }} className="text-blue-500 hover:text-blue-700 p-1 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => remove(item.id)} className="text-red-400 hover:text-red-600 p-1 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
