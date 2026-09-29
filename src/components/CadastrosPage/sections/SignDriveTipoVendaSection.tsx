import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Check, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { loadSignDriveTiposVenda, saveSignDriveTiposVenda, type TipoVendaSignDrive } from '../cadastrosStorage';

export function SignDriveTipoVendaSection() {
  const [items, setItems] = useState<TipoVendaSignDrive[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoPctComissaoVenda, setNovoPctComissaoVenda] = useState('');
  const [novoPctComissaoEntrega, setNovoPctComissaoEntrega] = useState('');
  const [novoPctImpostos, setNovoPctImpostos] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescricao, setEditDescricao] = useState('');
  const [editPctComissaoVenda, setEditPctComissaoVenda] = useState('');
  const [editPctComissaoEntrega, setEditPctComissaoEntrega] = useState('');
  const [editPctImpostos, setEditPctImpostos] = useState('');

  useEffect(() => {
    loadSignDriveTiposVenda().then(d => { setItems(d); setLoading(false); });
  }, []);

  const persist = async (updated: TipoVendaSignDrive[]) => {
    setSaving(true);
    try {
      const ok = await saveSignDriveTiposVenda(updated);
      if (!ok) toast.error('Erro ao salvar.');
      else setItems(updated);
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    const descricao = novaDescricao.trim();
    if (!descricao) return;
    await persist([...items, {
      id: crypto.randomUUID(),
      descricao,
      pctComissaoVenda: novoPctComissaoVenda.trim(),
      pctComissaoEntrega: novoPctComissaoEntrega.trim(),
      pctImpostos: novoPctImpostos.trim(),
    }]);
    setNovaDescricao('');
    setNovoPctComissaoVenda('');
    setNovoPctComissaoEntrega('');
    setNovoPctImpostos('');
    toast.success('Tipo de venda cadastrado');
  };

  const saveEdit = async () => {
    const descricao = editDescricao.trim();
    if (!descricao || !editingId) return;
    await persist(items.map(i => i.id === editingId
      ? { ...i, descricao, pctComissaoVenda: editPctComissaoVenda.trim(), pctComissaoEntrega: editPctComissaoEntrega.trim(), pctImpostos: editPctImpostos.trim() }
      : i));
    setEditingId(null);
    toast.success('Tipo de venda atualizado');
  };

  const remove = async (id: string) => {
    await persist(items.filter(i => i.id !== id));
    toast.success('Tipo de venda removido');
  };

  const fmtPct = (v?: string) => (v ?? '').trim() === '' ? '—' : `${v}%`;

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>;

  return (
    <div>
      <div className="flex gap-2 mb-5">
        <Input
          placeholder="Tipo da venda / produto..."
          value={novaDescricao}
          onChange={e => setNovaDescricao(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          className="flex-1"
        />
        <Input
          placeholder="% Comissão Venda"
          value={novoPctComissaoVenda}
          onChange={e => setNovoPctComissaoVenda(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          className="w-36"
        />
        <Input
          placeholder="% Comissão Entrega"
          value={novoPctComissaoEntrega}
          onChange={e => setNovoPctComissaoEntrega(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          className="w-36"
        />
        <Input
          placeholder="% Impostos"
          value={novoPctImpostos}
          onChange={e => setNovoPctImpostos(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          className="w-32"
        />
        <Button onClick={add} disabled={saving || !novaDescricao.trim()} size="sm" style={{ background: '#1e3a8a' }} className="text-white hover:opacity-90">
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#1e3a8a' }}>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Tipo da Venda</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-36">% Comissão da Venda</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-36">% Comissão Entrega</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-36">% Impostos</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={5} className="text-center text-slate-400 text-xs py-8">Nenhum tipo de venda cadastrado</td></tr>
            )}
            {items.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-4 py-2 text-xs text-slate-700">
                  {editingId === item.id ? (
                    <Input value={editDescricao} onChange={e => setEditDescricao(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      className="h-7 text-xs" autoFocus />
                  ) : item.descricao}
                </td>
                <td className="px-4 py-2 text-xs text-slate-700 text-center">
                  {editingId === item.id ? (
                    <Input value={editPctComissaoVenda} onChange={e => setEditPctComissaoVenda(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      className="h-7 text-xs text-center" placeholder="% Comissão Venda" />
                  ) : fmtPct(item.pctComissaoVenda)}
                </td>
                <td className="px-4 py-2 text-xs text-slate-700 text-center">
                  {editingId === item.id ? (
                    <Input value={editPctComissaoEntrega} onChange={e => setEditPctComissaoEntrega(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      className="h-7 text-xs text-center" placeholder="% Comissão Entrega" />
                  ) : fmtPct(item.pctComissaoEntrega)}
                </td>
                <td className="px-4 py-2 text-xs text-slate-700 text-center">
                  {editingId === item.id ? (
                    <Input value={editPctImpostos} onChange={e => setEditPctImpostos(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      className="h-7 text-xs text-center" placeholder="% Impostos" />
                  ) : fmtPct(item.pctImpostos)}
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
                        <button onClick={() => { setEditingId(item.id); setEditDescricao(item.descricao); setEditPctComissaoVenda(item.pctComissaoVenda ?? ''); setEditPctComissaoEntrega(item.pctComissaoEntrega ?? ''); setEditPctImpostos(item.pctImpostos ?? ''); }} className="text-blue-500 hover:text-blue-700 p-1 rounded"><Pencil className="w-3.5 h-3.5" /></button>
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
