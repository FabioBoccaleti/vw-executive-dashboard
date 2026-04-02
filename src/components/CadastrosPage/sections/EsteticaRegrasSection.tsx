import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Check, X, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadEsteticaRegras,
  saveEsteticaRegras,
  loadEsteticaRevendas,
  CARGOS_VENDEDOR_ESTETICA as CARGOS_VENDEDOR,
  BASES_CALCULO_ESTETICA,
  type RegraRemuneracao,
  type FaixaValor,
  type TipoPremio,
  type Revenda,
} from '../cadastrosStorage';

const MAX_FAIXAS = 5;

function formatBRL(raw: string): string {
  if (!raw.trim()) return '';
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  if (isNaN(num)) return raw;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const emptyFaixa = (): FaixaValor => ({ id: crypto.randomUUID(), de: '', ate: '', premio: '' });

const emptyRegra = (): Omit<RegraRemuneracao, 'id'> => ({
  nome: '',
  cargo: CARGOS_VENDEDOR[0],
  baseCalculo: BASES_CALCULO_ESTETICA[0],
  tipoPremio: 'percentual',
  percentual: '',
  faixas: [emptyFaixa()],
  revendaId: '',
});

function FaixasEditor({ faixas, onChange }: { faixas: FaixaValor[]; onChange: (f: FaixaValor[]) => void; }) {
  const update = (id: string, field: keyof FaixaValor, value: string) =>
    onChange(faixas.map(f => f.id === id ? { ...f, [field]: value } : f));

  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-slate-600">Faixas de Comissões</label>
        {faixas.length < MAX_FAIXAS && (
          <button type="button" onClick={() => onChange([...faixas, emptyFaixa()])}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
            <Plus className="w-3 h-3" /> Adicionar faixa
          </button>
        )}
      </div>
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th className="text-left px-3 py-1.5 text-slate-600 font-medium">De %</th>
              <th className="text-left px-3 py-1.5 text-slate-600 font-medium">Até % <span className="text-slate-400 font-normal">(vazio = em diante)</span></th>
              <th className="text-left px-3 py-1.5 text-slate-600 font-medium">Comissão %</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {faixas.map((f, i) => (
              <tr key={f.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-2 py-1">
                  <Input value={f.de} onChange={e => update(f.id, 'de', e.target.value)}
                    onBlur={e => { const v = formatBRL(e.target.value); if (v) update(f.id, 'de', v); }}
                    placeholder="0,00%" className="h-7 text-xs" />
                </td>
                <td className="px-2 py-1">
                  <Input value={f.ate} onChange={e => update(f.id, 'ate', e.target.value)}
                    onBlur={e => { const v = formatBRL(e.target.value); if (v) update(f.id, 'ate', v); }}
                    placeholder="em diante" className="h-7 text-xs" />
                </td>
                <td className="px-2 py-1">
                  <Input value={f.premio} onChange={e => update(f.id, 'premio', e.target.value)}
                    onBlur={e => { const v = formatBRL(e.target.value); if (v) update(f.id, 'premio', v); }}
                    placeholder="0,00%" className="h-7 text-xs" />
                </td>
                <td className="px-2 py-1 text-center">
                  {faixas.length > 1 && (
                    <button onClick={() => onChange(faixas.filter(x => x.id !== f.id))}
                      className="text-red-400 hover:text-red-600 p-0.5 rounded">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormFields({ draft, setDraft, revendas }: {
  draft: Omit<RegraRemuneracao, 'id'>;
  setDraft: (fn: (prev: typeof draft) => typeof draft) => void;
  revendas: Revenda[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Nome da Regra</label>
        <Input placeholder="Ex: Comissão Vendedor Estética" value={draft.nome}
          onChange={e => setDraft(p => ({ ...p, nome: e.target.value }))} className="text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Cargo</label>
        <select value={draft.cargo} onChange={e => setDraft(p => ({ ...p, cargo: e.target.value }))}
          className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
          {CARGOS_VENDEDOR.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Base de Cálculo</label>
        <select value={draft.baseCalculo} onChange={e => setDraft(p => ({ ...p, baseCalculo: e.target.value }))}
          className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
          {BASES_CALCULO_ESTETICA.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Revenda</label>
        <select value={draft.revendaId} onChange={e => setDraft(p => ({ ...p, revendaId: e.target.value }))}
          className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
          <option value="">Todas as revendas</option>
          {revendas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo de Prêmio</label>
        <div className="flex gap-4">
          {(['percentual', 'faixas'] as TipoPremio[]).map(t => (
            <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700">
              <input type="radio" name="tipoPremioP" value={t} checked={draft.tipoPremio === t}
                onChange={() => setDraft(p => ({ ...p, tipoPremio: t }))}
                className="accent-indigo-700" />
              {t === 'percentual' ? 'Percentual (%)' : 'Faixas de Rentabilidade'}
            </label>
          ))}
        </div>
      </div>
      {draft.tipoPremio === 'percentual' && (
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Percentual (%)</label>
          <Input placeholder="Ex: 5.5" type="number" min="0" max="100" step="0.1"
            value={draft.percentual} onChange={e => setDraft(p => ({ ...p, percentual: e.target.value }))} className="text-sm" />
        </div>
      )}
      {draft.tipoPremio === 'faixas' && (
        <FaixasEditor
          faixas={draft.faixas.length > 0 ? draft.faixas : [emptyFaixa()]}
          onChange={faixas => setDraft(p => ({ ...p, faixas }))}
        />
      )}
    </div>
  );
}

export function EsteticaRegrasSection() {
  const [items, setItems] = useState<RegraRemuneracao[]>([]);
  const [revendas, setRevendas] = useState<Revenda[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState(emptyRegra());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<RegraRemuneracao | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadEsteticaRegras(), loadEsteticaRevendas()]).then(([r, rv]) => {
      setItems(r.map(i => ({
        ...i,
        tipoPremio: (i.tipoPremio ?? 'percentual') as TipoPremio,
        faixas: i.faixas ?? [],
        revendaId: i.revendaId ?? '',
      })));
      setRevendas(rv);
      setLoading(false);
    });
  }, []);

  const persist = async (updated: RegraRemuneracao[]) => {
    setSaving(true);
    try {
      const ok = await saveEsteticaRegras(updated);
      if (!ok) toast.error('Erro ao salvar.');
      else setItems(updated);
    } finally {
      setSaving(false);
    }
  };

  const isValid = (r: Omit<RegraRemuneracao, 'id'>) => {
    if (!r.nome.trim()) return false;
    if (r.tipoPremio === 'percentual') return r.percentual.trim() !== '';
    return r.faixas.length > 0 && r.faixas.every(f => f.de.trim() !== '' && f.premio.trim() !== '');
  };

  const add = async () => {
    if (!isValid(novo)) return;
    await persist([...items, { id: crypto.randomUUID(), ...novo, nome: novo.nome.trim() }]);
    setNovo(emptyRegra());
    toast.success('Regra cadastrada');
  };

  const saveEdit = async () => {
    if (!editDraft || !isValid(editDraft)) return;
    await persist(items.map(i => i.id === editDraft.id ? editDraft : i));
    setEditingId(null);
    setEditDraft(null);
    toast.success('Regra atualizada');
  };

  const remove = async (id: string) => {
    await persist(items.filter(i => i.id !== id));
    toast.success('Regra removida');
  };

  const nomeRevenda = (id: string) => revendas.find(r => r.id === id)?.nome ?? 'Todas';

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>;

  return (
    <div>
      <div className="bg-white border rounded-lg p-4 mb-5">
        <FormFields draft={novo} setDraft={fn => setNovo(p => fn(p))} revendas={revendas} />
        <div className="flex justify-end mt-3">
          <Button onClick={add} disabled={saving || !isValid(novo)} size="sm"
            style={{ background: '#312e81' }} className="text-white hover:opacity-90">
            <Plus className="w-4 h-4 mr-1" /> Adicionar Regra
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#312e81' }}>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold w-6" />
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Nome da Regra</th>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Cargo</th>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Base de Cálculo</th>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Revenda</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold">Prêmio</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={7} className="text-center text-slate-400 text-xs py-8">Nenhuma regra cadastrada</td></tr>
            )}
            {items.map((item, idx) => {
              const isEditing = editingId === item.id;
              const isExpanded = expandedId === item.id;
              const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
              return (
                <>
                  <tr key={item.id} className={rowBg}>
                    <td className="px-2 py-2 text-center">
                      {item.tipoPremio === 'faixas' && item.faixas.length > 0 && !isEditing && (
                        <button onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className="text-slate-400 hover:text-slate-700 p-0.5 rounded">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </td>
                    {isEditing && editDraft ? (
                      <td colSpan={5} className="px-4 py-3">
                        <FormFields
                          draft={editDraft}
                          setDraft={fn => setEditDraft(p => p ? fn(p) as RegraRemuneracao : p)}
                          revendas={revendas}
                        />
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-2 text-xs text-slate-700 font-medium">{item.nome}</td>
                        <td className="px-4 py-2 text-xs text-slate-700">{item.cargo}</td>
                        <td className="px-4 py-2 text-xs text-slate-700">{item.baseCalculo}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">{nomeRevenda(item.revendaId)}</td>
                        <td className="px-4 py-2 text-xs text-slate-700 text-center font-mono">
                          {item.tipoPremio === 'percentual'
                            ? `${item.percentual}%`
                            : <span className="text-blue-600">{item.faixas.length} faixa{item.faixas.length !== 1 ? 's' : ''}</span>}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-1.5">
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit} disabled={saving} className="text-green-600 hover:text-green-700 p-1 rounded"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { setEditingId(null); setEditDraft(null); }} className="text-slate-400 hover:text-slate-600 p-1 rounded"><X className="w-3.5 h-3.5" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingId(item.id); setEditDraft({ ...item, faixas: item.faixas.map(f => ({ ...f })) }); setExpandedId(null); }}
                              className="text-blue-500 hover:text-blue-700 p-1 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => remove(item.id)} className="text-red-400 hover:text-red-600 p-1 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && !isEditing && item.tipoPremio === 'faixas' && (
                    <tr key={`${item.id}-faixas`} className={rowBg}>
                      <td />
                      <td colSpan={6} className="px-6 pb-3 pt-0">
                        <table className="w-full text-xs border rounded overflow-hidden">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="text-left px-3 py-1.5 text-slate-600 font-medium">De R$</th>
                              <th className="text-left px-3 py-1.5 text-slate-600 font-medium">Até R$</th>
                              <th className="text-left px-3 py-1.5 text-slate-600 font-medium">Prêmio R$</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.faixas.map((f, fi) => (
                              <tr key={f.id} className={fi % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="px-3 py-1.5 font-mono text-slate-700">{f.de}</td>
                                <td className="px-3 py-1.5 font-mono text-slate-700">{f.ate || 'em diante'}</td>
                                <td className="px-3 py-1.5 font-mono text-slate-700 font-semibold">{f.premio}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
