import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Plus, X, Percent, Gift } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadSignDriveRegras,
  saveSignDriveRegras,
  CARGOS_VENDEDOR,
  type RegraRemuneracaoSignDrive,
  type FaixaQtdSignDrive,
  type ComissaoModoSignDrive,
  type PremioModoSignDrive,
  type PremioUnidadeSignDrive,
} from '../cadastrosStorage';

const MAX_FAIXAS = 8;

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const emptyFaixa = (): FaixaQtdSignDrive => ({ id: newId(), de: '', ate: '', valor: '' });

const emptyRegra = (): Omit<RegraRemuneracaoSignDrive, 'id'> => ({
  nome: '',
  cargo: CARGOS_VENDEDOR[0],
  comissaoAtiva: true,
  comissaoModo: 'fixa',
  comissaoPercentual: '',
  comissaoFaixas: [emptyFaixa()],
  premioAtivo: false,
  premioModo: 'fixo',
  premioUnidade: 'valor',
  premioValor: '',
  premioFaixas: [emptyFaixa()],
});

type Draft = Omit<RegraRemuneracaoSignDrive, 'id'>;

// ─── Editor de faixas por quantidade de vendas ──────────────────────────────
function FaixasQtdEditor({
  faixas, onChange, valorLabel,
}: {
  faixas: FaixaQtdSignDrive[];
  onChange: (f: FaixaQtdSignDrive[]) => void;
  valorLabel: string;
}) {
  const update = (id: string, field: keyof FaixaQtdSignDrive, value: string) =>
    onChange(faixas.map(f => (f.id === id ? { ...f, [field]: value } : f)));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-slate-600">Faixas por quantidade de vendas</label>
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
              <th className="text-left px-3 py-1.5 text-slate-600 font-medium">De (qtd)</th>
              <th className="text-left px-3 py-1.5 text-slate-600 font-medium">Até (qtd) <span className="text-slate-400 font-normal">(vazio = em diante)</span></th>
              <th className="text-left px-3 py-1.5 text-slate-600 font-medium">{valorLabel}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {faixas.map((f, i) => (
              <tr key={f.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-2 py-1">
                  <Input type="number" min="0" value={f.de} onChange={e => update(f.id, 'de', e.target.value)}
                    placeholder="1" className="h-7 text-xs" />
                </td>
                <td className="px-2 py-1">
                  <Input type="number" min="0" value={f.ate} onChange={e => update(f.id, 'ate', e.target.value)}
                    placeholder="em diante" className="h-7 text-xs" />
                </td>
                <td className="px-2 py-1">
                  <Input value={f.valor} onChange={e => update(f.id, 'valor', e.target.value)}
                    placeholder={valorLabel.includes('%') ? 'Ex: 5' : 'Ex: 500,00'} className="h-7 text-xs" />
                </td>
                <td className="px-2 py-1 text-center">
                  {faixas.length > 1 && (
                    <button type="button" onClick={() => onChange(faixas.filter(x => x.id !== f.id))}
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

// ─── Formulário de regra (criar/editar) ─────────────────────────────────────
function RegraForm({ draft, setDraft }: { draft: Draft; setDraft: (fn: (p: Draft) => Draft) => void; }) {
  const premioUnidadeLabel = draft.premioUnidade === 'percentual' ? 'Prêmio (%)' : 'Prêmio (R$)';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Nome da Regra</label>
          <Input placeholder="Ex: Comissão Vendedor 2026" value={draft.nome}
            onChange={e => setDraft(p => ({ ...p, nome: e.target.value }))} className="text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Cargo</label>
          <select value={draft.cargo} onChange={e => setDraft(p => ({ ...p, cargo: e.target.value }))}
            className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
            {CARGOS_VENDEDOR.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* ── Comissão ── */}
      <div className="border rounded-lg p-3 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={draft.comissaoAtiva}
            onChange={e => setDraft(p => ({ ...p, comissaoAtiva: e.target.checked }))} className="accent-blue-700" />
          <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Percent className="w-4 h-4 text-blue-600" /> Comissão (%)</span>
        </label>

        {draft.comissaoAtiva && (
          <div className="pl-6 space-y-3">
            <div className="flex gap-4">
              {(['fixa', 'faixas'] as ComissaoModoSignDrive[]).map(m => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700">
                  <input type="radio" name="comissaoModo" value={m} checked={draft.comissaoModo === m}
                    onChange={() => setDraft(p => ({ ...p, comissaoModo: m }))} className="accent-blue-700" />
                  {m === 'fixa' ? 'Fixa' : 'Variável por quantidade de vendas'}
                </label>
              ))}
            </div>
            {draft.comissaoModo === 'fixa' ? (
              <div className="w-40">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Comissão (%)</label>
                <Input value={draft.comissaoPercentual} onChange={e => setDraft(p => ({ ...p, comissaoPercentual: e.target.value }))}
                  placeholder="Ex: 5" className="text-sm" />
              </div>
            ) : (
              <FaixasQtdEditor faixas={draft.comissaoFaixas.length ? draft.comissaoFaixas : [emptyFaixa()]}
                onChange={f => setDraft(p => ({ ...p, comissaoFaixas: f }))} valorLabel="Comissão (%)" />
            )}
          </div>
        )}
      </div>

      {/* ── Prêmio ── */}
      <div className="border rounded-lg p-3 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={draft.premioAtivo}
            onChange={e => setDraft(p => ({ ...p, premioAtivo: e.target.checked }))} className="accent-blue-700" />
          <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Gift className="w-4 h-4 text-emerald-600" /> Prêmio</span>
        </label>

        {draft.premioAtivo && (
          <div className="pl-6 space-y-3">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500">Unidade:</span>
                {(['valor', 'percentual'] as PremioUnidadeSignDrive[]).map(u => (
                  <label key={u} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700">
                    <input type="radio" name="premioUnidade" value={u} checked={draft.premioUnidade === u}
                      onChange={() => setDraft(p => ({ ...p, premioUnidade: u }))} className="accent-emerald-700" />
                    {u === 'valor' ? 'R$' : '%'}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500">Modo:</span>
                {(['fixo', 'faixas'] as PremioModoSignDrive[]).map(m => (
                  <label key={m} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700">
                    <input type="radio" name="premioModo" value={m} checked={draft.premioModo === m}
                      onChange={() => setDraft(p => ({ ...p, premioModo: m }))} className="accent-emerald-700" />
                    {m === 'fixo' ? 'Fixo' : 'Variável por quantidade de vendas'}
                  </label>
                ))}
              </div>
            </div>
            {draft.premioModo === 'fixo' ? (
              <div className="w-40">
                <label className="text-xs font-medium text-slate-600 mb-1 block">{premioUnidadeLabel}</label>
                <Input value={draft.premioValor} onChange={e => setDraft(p => ({ ...p, premioValor: e.target.value }))}
                  placeholder={draft.premioUnidade === 'percentual' ? 'Ex: 3' : 'Ex: 500,00'} className="text-sm" />
              </div>
            ) : (
              <FaixasQtdEditor faixas={draft.premioFaixas.length ? draft.premioFaixas : [emptyFaixa()]}
                onChange={f => setDraft(p => ({ ...p, premioFaixas: f }))} valorLabel={premioUnidadeLabel} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Resumo textual de uma regra ────────────────────────────────────────────
function resumoComissao(r: RegraRemuneracaoSignDrive): string {
  if (!r.comissaoAtiva) return '';
  if (r.comissaoModo === 'fixa') return `Comissão fixa ${r.comissaoPercentual || '—'}%`;
  const fs = r.comissaoFaixas.filter(f => f.de || f.valor);
  return `Comissão por faixa (${fs.length} faixa${fs.length !== 1 ? 's' : ''})`;
}
function resumoPremio(r: RegraRemuneracaoSignDrive): string {
  if (!r.premioAtivo) return '';
  const un = r.premioUnidade === 'percentual' ? '%' : 'R$';
  if (r.premioModo === 'fixo') return `Prêmio fixo ${un === 'R$' ? 'R$ ' : ''}${r.premioValor || '—'}${un === '%' ? '%' : ''}`;
  const fs = r.premioFaixas.filter(f => f.de || f.valor);
  return `Prêmio por faixa (${fs.length} faixa${fs.length !== 1 ? 's' : ''})`;
}

export function SignDriveRegrasSection() {
  const [items, setItems] = useState<RegraRemuneracaoSignDrive[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [novo, setNovo] = useState<Draft>(emptyRegra());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyRegra());

  useEffect(() => {
    loadSignDriveRegras().then(d => { setItems(d); setLoading(false); });
  }, []);

  const persist = async (updated: RegraRemuneracaoSignDrive[]) => {
    setSaving(true);
    try {
      const ok = await saveSignDriveRegras(updated);
      if (!ok) toast.error('Erro ao salvar.');
      else setItems(updated);
      return ok;
    } finally {
      setSaving(false);
    }
  };

  const isValid = (r: Draft): boolean => {
    if (!r.nome.trim()) { toast.error('Informe o nome da regra.'); return false; }
    if (!r.comissaoAtiva && !r.premioAtivo) { toast.error('Ative ao menos Comissão ou Prêmio.'); return false; }
    if (r.comissaoAtiva) {
      if (r.comissaoModo === 'fixa' && !r.comissaoPercentual.trim()) { toast.error('Informe o percentual da comissão fixa.'); return false; }
      if (r.comissaoModo === 'faixas' && !r.comissaoFaixas.some(f => f.de.trim() && f.valor.trim())) { toast.error('Preencha ao menos uma faixa de comissão.'); return false; }
    }
    if (r.premioAtivo) {
      if (r.premioModo === 'fixo' && !r.premioValor.trim()) { toast.error('Informe o valor do prêmio.'); return false; }
      if (r.premioModo === 'faixas' && !r.premioFaixas.some(f => f.de.trim() && f.valor.trim())) { toast.error('Preencha ao menos uma faixa de prêmio.'); return false; }
    }
    return true;
  };

  const addRegra = async () => {
    if (!isValid(novo)) return;
    const ok = await persist([...items, { id: newId(), ...novo, nome: novo.nome.trim() }]);
    if (ok) { setNovo(emptyRegra()); setCreating(false); toast.success('Regra cadastrada'); }
  };

  const startEdit = (r: RegraRemuneracaoSignDrive) => {
    const { id, ...rest } = r;
    void id;
    setEditingId(r.id);
    setEditDraft({
      ...rest,
      comissaoFaixas: rest.comissaoFaixas.length ? rest.comissaoFaixas : [emptyFaixa()],
      premioFaixas: rest.premioFaixas.length ? rest.premioFaixas : [emptyFaixa()],
    });
  };

  const saveEdit = async () => {
    if (!editingId || !isValid(editDraft)) return;
    const ok = await persist(items.map(i => (i.id === editingId ? { id: editingId, ...editDraft, nome: editDraft.nome.trim() } : i)));
    if (ok) { setEditingId(null); toast.success('Regra atualizada'); }
  };

  const remove = async (id: string) => {
    const ok = await persist(items.filter(i => i.id !== id));
    if (ok) toast.success('Regra removida');
  };

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>;

  return (
    <div>
      {/* Cabeçalho + botão criar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-500">
          Defina a remuneração por cargo (comissão, prêmio ou ambos). O cálculo da estimativa será plugado depois.
        </p>
        {!creating && editingId === null && (
          <Button onClick={() => { setNovo(emptyRegra()); setCreating(true); }} size="sm" style={{ background: '#1e3a8a' }} className="text-white hover:opacity-90">
            <Plus className="w-4 h-4 mr-1" /> Nova regra
          </Button>
        )}
      </div>

      {/* Form de criação */}
      {creating && (
        <div className="border rounded-lg p-4 mb-5 bg-slate-50/60">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Nova regra de remuneração</h3>
          <RegraForm draft={novo} setDraft={setNovo} />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => { setCreating(false); setNovo(emptyRegra()); }}>Cancelar</Button>
            <Button size="sm" disabled={saving} onClick={addRegra} style={{ background: '#1e3a8a' }} className="text-white hover:opacity-90">Salvar regra</Button>
          </div>
        </div>
      )}

      {/* Lista de regras */}
      {items.length === 0 && !creating && (
        <div className="text-center text-slate-400 text-sm py-12 border border-dashed rounded-lg">
          Nenhuma regra cadastrada. Clique em "Nova regra" para começar.
        </div>
      )}

      <div className="space-y-3">
        {items.map(r => (
          <div key={r.id} className="border rounded-lg overflow-hidden">
            {editingId === r.id ? (
              <div className="p-4 bg-blue-50/40">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Editar regra</h3>
                <RegraForm draft={editDraft} setDraft={setEditDraft} />
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancelar</Button>
                  <Button size="sm" disabled={saving} onClick={saveEdit} style={{ background: '#1e3a8a' }} className="text-white hover:opacity-90">Salvar alterações</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-800">{r.nome}</h3>
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{r.cargo}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {r.comissaoAtiva && <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{resumoComissao(r)}</span>}
                    {r.premioAtivo && <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{resumoPremio(r)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => startEdit(r)} className="text-blue-500 hover:text-blue-700 p-1 rounded"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(r.id)} className="text-red-400 hover:text-red-600 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
