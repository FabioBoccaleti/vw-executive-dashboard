import { useState, useEffect } from 'react';
import { Pencil, Trash2, Check, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getRegrasAnoChassi, setRegrasAnoChassi, type RegraAnoChassi } from './passagemStorage';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function RegraAnoChassiSection() {
  const [regras, setRegras] = useState<RegraAnoChassi[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [novaLetra, setNovaLetra] = useState('');
  const [novoAno, setNovoAno] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLetra, setEditLetra] = useState('');
  const [editAno, setEditAno] = useState('');

  useEffect(() => {
    getRegrasAnoChassi().then(r => { setRegras(r); setLoading(false); });
  }, []);

  const persist = async (updated: RegraAnoChassi[]) => {
    setSaving(true);
    try {
      const ok = await setRegrasAnoChassi(updated);
      if (!ok) toast.error('Erro ao salvar.');
      else setRegras(updated);
      return ok;
    } finally {
      setSaving(false);
    }
  };

  const sanitizeLetra = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);

  const add = async () => {
    const letra = sanitizeLetra(novaLetra);
    const ano = parseInt(novoAno, 10);
    if (!letra) { toast.error('Informe o código (A–Z ou 0–9).'); return; }
    if (!ano || ano < 1900 || ano > 2100) { toast.error('Informe um ano válido.'); return; }
    if (regras.some(r => r.letra === letra)) { toast.error(`O código "${letra}" já está cadastrado.`); return; }
    const ok = await persist([...regras, { id: newId(), letra, ano }].sort((a, b) => a.letra.localeCompare(b.letra)));
    if (ok) { setNovaLetra(''); setNovoAno(''); toast.success('Regra cadastrada.'); }
  };

  const startEdit = (r: RegraAnoChassi) => {
    setEditingId(r.id);
    setEditLetra(r.letra);
    setEditAno(String(r.ano));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const letra = sanitizeLetra(editLetra);
    const ano = parseInt(editAno, 10);
    if (!letra) { toast.error('Informe o código (A–Z ou 0–9).'); return; }
    if (!ano || ano < 1900 || ano > 2100) { toast.error('Informe um ano válido.'); return; }
    if (regras.some(r => r.letra === letra && r.id !== editingId)) { toast.error(`O código "${letra}" já está cadastrado.`); return; }
    const ok = await persist(regras.map(r => r.id === editingId ? { ...r, letra, ano } : r).sort((a, b) => a.letra.localeCompare(b.letra)));
    if (ok) { setEditingId(null); toast.success('Regra atualizada.'); }
  };

  const remove = async (id: string) => {
    const ok = await persist(regras.filter(r => r.id !== id));
    if (ok) toast.success('Regra removida.');
  };

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>;

  return (
    <div>
      {/* Adicionar */}
      <div className="flex flex-wrap gap-2 mb-5">
        <input
          placeholder="Código (posição 10)"
          value={novaLetra}
          onChange={e => setNovaLetra(sanitizeLetra(e.target.value))}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          maxLength={1}
          className="w-40 border border-slate-200 rounded-md px-3 py-2 text-sm bg-white uppercase focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          placeholder="Ano (ex. 2023)"
          value={novoAno}
          onChange={e => setNovoAno(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          inputMode="numeric"
          className="w-40 border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={add}
          disabled={saving || !novaLetra.trim() || !novoAno.trim()}
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
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Código (posição 10)</th>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Ano</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {regras.length === 0 && (
              <tr><td colSpan={3} className="text-center text-slate-400 text-xs py-8">Nenhuma regra cadastrada</td></tr>
            )}
            {regras.map((r, idx) => (
              <tr key={r.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-4 py-2 text-xs text-slate-700">
                  {editingId === r.id ? (
                    <input value={editLetra} onChange={e => setEditLetra(sanitizeLetra(e.target.value))}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      maxLength={1} autoFocus
                      className="h-7 w-20 border border-slate-200 rounded px-2 text-xs uppercase focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  ) : <span className="font-semibold">{r.letra}</span>}
                </td>
                <td className="px-4 py-2 text-xs text-slate-700">
                  {editingId === r.id ? (
                    <input value={editAno} onChange={e => setEditAno(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      inputMode="numeric"
                      className="h-7 w-24 border border-slate-200 rounded px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  ) : r.ano}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-center gap-1.5">
                    {editingId === r.id ? (
                      <>
                        <button onClick={saveEdit} disabled={saving} className="text-green-600 hover:text-green-700 p-1 rounded"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded"><X className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(r)} className="text-blue-500 hover:text-blue-700 p-1 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => remove(r.id)} className="text-red-400 hover:text-red-600 p-1 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
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
