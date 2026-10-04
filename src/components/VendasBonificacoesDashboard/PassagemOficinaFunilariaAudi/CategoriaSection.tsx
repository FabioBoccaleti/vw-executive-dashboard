import { useState, useEffect } from 'react';
import { Pencil, Trash2, Check, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getCategorias, setCategorias, type CategoriaOS } from './passagemStorage';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const onlyDigits = (v: string) => v.replace(/[^0-9]/g, '');

export function CategoriaSection() {
  const [itens, setItens] = useState<CategoriaOS[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [novoCodigo, setNovoCodigo] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCodigo, setEditCodigo] = useState('');
  const [editCategoria, setEditCategoria] = useState('');

  useEffect(() => {
    getCategorias().then(c => { setItens(c); setLoading(false); });
  }, []);

  const persist = async (updated: CategoriaOS[]) => {
    setSaving(true);
    try {
      const ok = await setCategorias(updated);
      if (!ok) toast.error('Erro ao salvar.');
      else setItens(updated);
      return ok;
    } finally {
      setSaving(false);
    }
  };

  const sortByCodigo = (arr: CategoriaOS[]) => [...arr].sort((a, b) => Number(a.codigo) - Number(b.codigo));

  const add = async () => {
    const codigo = onlyDigits(novoCodigo);
    const categoria = novaCategoria.trim();
    if (!codigo) { toast.error('Informe o código (número).'); return; }
    if (!categoria) { toast.error('Informe a categoria.'); return; }
    if (itens.some(i => i.codigo === codigo)) { toast.error(`O código "${codigo}" já está cadastrado.`); return; }
    const ok = await persist(sortByCodigo([...itens, { id: newId(), codigo, categoria }]));
    if (ok) { setNovoCodigo(''); setNovaCategoria(''); toast.success('Categoria cadastrada.'); }
  };

  const startEdit = (i: CategoriaOS) => {
    setEditingId(i.id);
    setEditCodigo(i.codigo);
    setEditCategoria(i.categoria);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const codigo = onlyDigits(editCodigo);
    const categoria = editCategoria.trim();
    if (!codigo) { toast.error('Informe o código (número).'); return; }
    if (!categoria) { toast.error('Informe a categoria.'); return; }
    if (itens.some(i => i.codigo === codigo && i.id !== editingId)) { toast.error(`O código "${codigo}" já está cadastrado.`); return; }
    const ok = await persist(sortByCodigo(itens.map(i => i.id === editingId ? { ...i, codigo, categoria } : i)));
    if (ok) { setEditingId(null); toast.success('Categoria atualizada.'); }
  };

  const remove = async (id: string) => {
    const ok = await persist(itens.filter(i => i.id !== id));
    if (ok) toast.success('Categoria removida.');
  };

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>;

  return (
    <div>
      {/* Adicionar */}
      <div className="flex flex-wrap gap-2 mb-5">
        <input
          placeholder="Código (ex. 1)"
          value={novoCodigo}
          onChange={e => setNovoCodigo(onlyDigits(e.target.value))}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          inputMode="numeric"
          className="w-40 border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          placeholder="Categoria (ex. Garantia)"
          value={novaCategoria}
          onChange={e => setNovaCategoria(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          className="flex-1 min-w-[200px] border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={add}
          disabled={saving || !novoCodigo.trim() || !novaCategoria.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </div>

      {/* Tabela */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-700">
              <th className="text-white text-left px-4 py-3 text-xs font-semibold w-40">Código</th>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Categoria</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && (
              <tr><td colSpan={3} className="text-center text-slate-400 text-xs py-8">Nenhuma categoria cadastrada</td></tr>
            )}
            {itens.map((i, idx) => (
              <tr key={i.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-4 py-2 text-xs text-slate-700">
                  {editingId === i.id ? (
                    <input value={editCodigo} onChange={e => setEditCodigo(onlyDigits(e.target.value))}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      inputMode="numeric" autoFocus
                      className="h-7 w-24 border border-slate-200 rounded px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  ) : <span className="font-semibold">{i.codigo}</span>}
                </td>
                <td className="px-4 py-2 text-xs text-slate-700">
                  {editingId === i.id ? (
                    <input value={editCategoria} onChange={e => setEditCategoria(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      className="h-7 w-full border border-slate-200 rounded px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  ) : i.categoria}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-center gap-1.5">
                    {editingId === i.id ? (
                      <>
                        <button onClick={saveEdit} disabled={saving} className="text-green-600 hover:text-green-700 p-1 rounded"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded"><X className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(i)} className="text-blue-500 hover:text-blue-700 p-1 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => remove(i.id)} className="text-red-400 hover:text-red-600 p-1 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
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
