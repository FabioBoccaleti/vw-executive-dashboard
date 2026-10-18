import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Check, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadEsteticaCustoPreparacao,
  saveEsteticaCustoPreparacao,
  type CustoPreparacaoConfig,
} from '../cadastrosStorage';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function emptyItem(): CustoPreparacaoConfig {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    anoInicio: now.getFullYear(),
    mesInicio: now.getMonth() + 1,
    anoFim: now.getFullYear(),
    mesFim: now.getMonth() + 1,
    percentual: '',
  };
}

function fmtPct(v: string) {
  if (!v) return '—';
  const n = parseFloat(v);
  return isNaN(n) ? v : `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
}

/** Converte ano/mês em um valor comparável (ex: 2026-03 → 24315). */
function toComparable(ano: number, mes: number) {
  return ano * 12 + mes;
}

/** Verifica se dois períodos [a1,a2] e [b1,b2] se sobrepõem. */
function periodsOverlap(a1: number, a2: number, b1: number, b2: number) {
  return a1 <= b2 && b1 <= a2;
}

export function EsteticaCustoPreparacaoSection() {
  const [items, setItems] = useState<CustoPreparacaoConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CustoPreparacaoConfig>(emptyItem());
  const [newForm, setNewForm] = useState<CustoPreparacaoConfig>(emptyItem());

  useEffect(() => {
    loadEsteticaCustoPreparacao().then(d => { setItems(d); setLoading(false); });
  }, []);

  const persist = async (updated: CustoPreparacaoConfig[]) => {
    setSaving(true);
    try {
      const ok = await saveEsteticaCustoPreparacao(updated);
      if (!ok) toast.error('Erro ao salvar.');
      else setItems(updated);
    } finally {
      setSaving(false);
    }
  };

  const validatePeriod = (item: CustoPreparacaoConfig, excludeId?: string): string | null => {
    const inicio = toComparable(item.anoInicio, item.mesInicio);
    const fim = toComparable(item.anoFim, item.mesFim);
    if (fim < inicio) return 'O mês/ano final deve ser igual ou posterior ao mês/ano inicial.';

    const overlap = items.find(i => {
      if (i.id === excludeId) return false;
      const iInicio = toComparable(i.anoInicio, i.mesInicio);
      const iFim = toComparable(i.anoFim, i.mesFim);
      return periodsOverlap(inicio, fim, iInicio, iFim);
    });
    if (overlap) return 'Já existe um período cadastrado que se sobrepõe a este intervalo.';

    return null;
  };

  const add = async () => {
    if (!newForm.percentual.trim()) { toast.error('Informe o percentual de custo.'); return; }
    const error = validatePeriod(newForm);
    if (error) { toast.error(error); return; }
    await persist([...items, { ...newForm, id: crypto.randomUUID() }]);
    setNewForm(emptyItem());
    toast.success('Custo sobre preparação do serviço cadastrado');
  };

  const startEdit = (item: CustoPreparacaoConfig) => { setEditingId(item.id); setDraft({ ...item }); };

  const saveEdit = async () => {
    if (!draft.percentual.trim()) { toast.error('Informe o percentual de custo.'); return; }
    const error = validatePeriod(draft, editingId ?? undefined);
    if (error) { toast.error(error); return; }
    await persist(items.map(i => i.id === editingId ? draft : i));
    setEditingId(null);
    toast.success('Registro atualizado');
  };

  const remove = async (id: string) => {
    await persist(items.filter(i => i.id !== id));
    toast.success('Registro removido');
  };

  // Ordena por período de início, mais recente primeiro
  const sortedItems = [...items].sort((a, b) =>
    toComparable(b.anoInicio, b.mesInicio) - toComparable(a.anoInicio, a.mesInicio)
  );

  const availableYears = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* ── Formulário de adição ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Novo Período de Custo sobre Preparação do Serviço</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Início da validade</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Ano *</label>
                <select
                  value={newForm.anoInicio}
                  onChange={e => setNewForm(f => ({ ...f, anoInicio: Number(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Mês *</label>
                <select
                  value={newForm.mesInicio}
                  onChange={e => setNewForm(f => ({ ...f, mesInicio: Number(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Fim da validade</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Ano *</label>
                <select
                  value={newForm.anoFim}
                  onChange={e => setNewForm(f => ({ ...f, anoFim: Number(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Mês *</label>
                <select
                  value={newForm.mesFim}
                  onChange={e => setNewForm(f => ({ ...f, mesFim: Number(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <label className="text-xs font-medium text-slate-600 mb-1 block">% de Custo sobre a Preparação *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="Ex: 5.00"
            value={newForm.percentual}
            onChange={e => setNewForm(f => ({ ...f, percentual: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') add(); }}
            className="w-full sm:w-48 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={add}
            disabled={saving || !newForm.percentual.trim()}
            size="sm"
            style={{ background: '#0f766e' }}
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
            <tr style={{ background: '#0f766e' }}>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Início da Validade</th>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Fim da Validade</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-40">% Custo</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-400 text-xs py-8">
                  Nenhum percentual de custo sobre a preparação cadastrado
                </td>
              </tr>
            )}
            {sortedItems.map((item, idx) => {
              const isEdit = editingId === item.id;
              return (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-2 text-xs text-slate-700">
                    {isEdit ? (
                      <div className="flex gap-1">
                        <select
                          value={draft.mesInicio}
                          onChange={e => setDraft(d => ({ ...d, mesInicio: Number(e.target.value) }))}
                          className="border border-teal-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
                        >
                          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                        <select
                          value={draft.anoInicio}
                          onChange={e => setDraft(d => ({ ...d, anoInicio: Number(e.target.value) }))}
                          className="border border-teal-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
                        >
                          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    ) : `${MONTHS[item.mesInicio - 1]}/${item.anoInicio}`}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-700">
                    {isEdit ? (
                      <div className="flex gap-1">
                        <select
                          value={draft.mesFim}
                          onChange={e => setDraft(d => ({ ...d, mesFim: Number(e.target.value) }))}
                          className="border border-teal-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
                        >
                          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                        <select
                          value={draft.anoFim}
                          onChange={e => setDraft(d => ({ ...d, anoFim: Number(e.target.value) }))}
                          className="border border-teal-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
                        >
                          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    ) : `${MONTHS[item.mesFim - 1]}/${item.anoFim}`}
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
                        className="w-24 border border-teal-300 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    ) : fmtPct(item.percentual)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {isEdit ? (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={saveEdit} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => startEdit(item)} className="p-1.5 text-teal-600 hover:bg-teal-50 rounded">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => remove(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
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
