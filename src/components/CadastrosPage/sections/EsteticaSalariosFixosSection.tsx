import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  loadEsteticaSalariosFixos,
  saveEsteticaSalariosFixos,
  type SalarioFixoEstetica,
} from '../cadastrosStorage';

type SalarioDraft = Omit<SalarioFixoEstetica, 'id'>;

const emptyDraft = (): SalarioDraft => ({
  nome: '',
  cargo: '',
  salarioFixo: '',
  encargosProvisoes: '',
  planoSaude: '',
  valeTransporte: '',
});

function parseCurrency(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(/R\$/gi, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function employeeCost(item: SalarioDraft): number {
  return parseCurrency(item.salarioFixo)
    + parseCurrency(item.encargosProvisoes)
    + parseCurrency(item.planoSaude)
    + parseCurrency(item.valeTransporte);
}

function FormFields({ draft, onChange }: { draft: SalarioDraft; onChange: (draft: SalarioDraft) => void }) {
  const update = (field: keyof SalarioDraft, value: string) => onChange({ ...draft, [field]: value });
  const moneyFields: Array<{ field: keyof SalarioDraft; label: string }> = [
    { field: 'salarioFixo', label: 'Salário Fixo' },
    { field: 'encargosProvisoes', label: 'Encargos e Provisões' },
    { field: 'planoSaude', label: 'Plano de Saúde' },
    { field: 'valeTransporte', label: 'Vale Transporte' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Nome do Colaborador</label>
        <Input value={draft.nome} onChange={event => update('nome', event.target.value)} placeholder="Ex: Maria da Silva" className="text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Cargo</label>
        <Input value={draft.cargo} onChange={event => update('cargo', event.target.value)} placeholder="Ex: Consultor de Estética" className="text-sm" />
      </div>
      {moneyFields.map(({ field, label }) => (
        <div key={field}>
          <label className="text-xs font-medium text-slate-600 mb-1 block">{label}</label>
          <Input value={draft[field]} onChange={event => update(field, event.target.value)} inputMode="decimal" placeholder="0,00" className="text-sm" />
        </div>
      ))}
      <div>
        <p className="text-xs font-medium text-slate-600 mb-1">Custo do Funcionário</p>
        <div className="h-10 px-3 flex items-center rounded-md border bg-slate-50 text-sm font-semibold text-slate-700 font-mono">
          {formatCurrency(employeeCost(draft))}
        </div>
      </div>
    </div>
  );
}

export function EsteticaSalariosFixosSection() {
  const [items, setItems] = useState<SalarioFixoEstetica[]>([]);
  const [draft, setDraft] = useState<SalarioDraft>(emptyDraft());
  const [editDraft, setEditDraft] = useState<SalarioFixoEstetica | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEsteticaSalariosFixos().then(items => {
      setItems(items);
      setLoading(false);
    });
  }, []);

  const persist = async (updated: SalarioFixoEstetica[]) => {
    setSaving(true);
    try {
      const saved = await saveEsteticaSalariosFixos(updated);
      if (!saved) {
        toast.error('Erro ao salvar os salários fixos.');
        return false;
      }
      setItems(updated);
      return true;
    } finally {
      setSaving(false);
    }
  };

  const isValid = (item: SalarioDraft) => item.nome.trim() !== '' && item.cargo.trim() !== '';

  const add = async () => {
    if (!isValid(draft)) return;
    const saved = await persist([...items, { id: crypto.randomUUID(), ...draft, nome: draft.nome.trim(), cargo: draft.cargo.trim() }]);
    if (saved) {
      setDraft(emptyDraft());
      toast.success('Colaborador cadastrado.');
    }
  };

  const saveEdit = async () => {
    if (!editDraft || !isValid(editDraft)) return;
    const saved = await persist(items.map(item => item.id === editDraft.id ? editDraft : item));
    if (saved) {
      setEditDraft(null);
      toast.success('Colaborador atualizado.');
    }
  };

  const remove = async (id: string) => {
    const saved = await persist(items.filter(item => item.id !== id));
    if (saved) toast.success('Colaborador removido.');
  };

  const totalCost = items.reduce((total, item) => total + employeeCost(item), 0);

  if (loading) return <div className="py-8 text-center text-sm text-slate-400">Carregando...</div>;

  return (
    <div>
      <div className="bg-white border rounded-lg p-4 mb-5">
        <FormFields draft={draft} onChange={setDraft} />
        <div className="flex justify-end mt-3">
          <Button onClick={add} disabled={saving || !isValid(draft)} size="sm" style={{ background: '#0f766e' }} className="text-white hover:opacity-90">
            <Plus className="w-4 h-4 mr-1" /> Adicionar Colaborador
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr style={{ background: '#0f766e' }}>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Colaborador</th>
              <th className="text-white text-left px-4 py-3 text-xs font-semibold">Cargo</th>
              <th className="text-white text-right px-4 py-3 text-xs font-semibold">Salário Fixo</th>
              <th className="text-white text-right px-4 py-3 text-xs font-semibold">Encargos e Provisões</th>
              <th className="text-white text-right px-4 py-3 text-xs font-semibold">Plano de Saúde</th>
              <th className="text-white text-right px-4 py-3 text-xs font-semibold">Vale Transporte</th>
              <th className="text-white text-right px-4 py-3 text-xs font-semibold">Custo do Funcionário</th>
              <th className="text-white text-center px-4 py-3 text-xs font-semibold w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-xs text-slate-400">Nenhum colaborador cadastrado</td></tr>
            )}
            {items.map((item, index) => {
              const isEditing = editDraft?.id === item.id;
              const rowClass = index % 2 === 0 ? 'bg-white' : 'bg-slate-50';
              return isEditing && editDraft ? (
                <tr key={item.id} className={rowClass}>
                  <td colSpan={7} className="px-4 py-3"><FormFields draft={editDraft} onChange={updated => setEditDraft({ ...editDraft, ...updated })} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button type="button" title="Salvar" onClick={saveEdit} disabled={saving} className="text-green-600 hover:text-green-700 p-1 rounded"><Check className="w-3.5 h-3.5" /></button>
                      <button type="button" title="Cancelar" onClick={() => setEditDraft(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={item.id} className={rowClass}>
                  <td className="px-4 py-2 text-xs font-medium text-slate-700">{item.nome}</td>
                  <td className="px-4 py-2 text-xs text-slate-700">{item.cargo}</td>
                  <td className="px-4 py-2 text-right text-xs font-mono text-slate-700">{formatCurrency(parseCurrency(item.salarioFixo))}</td>
                  <td className="px-4 py-2 text-right text-xs font-mono text-slate-700">{formatCurrency(parseCurrency(item.encargosProvisoes))}</td>
                  <td className="px-4 py-2 text-right text-xs font-mono text-slate-700">{formatCurrency(parseCurrency(item.planoSaude))}</td>
                  <td className="px-4 py-2 text-right text-xs font-mono text-slate-700">{formatCurrency(parseCurrency(item.valeTransporte))}</td>
                  <td className="px-4 py-2 text-right text-xs font-mono font-semibold text-slate-900">{formatCurrency(employeeCost(item))}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1.5">
                      <button type="button" title="Editar" onClick={() => setEditDraft({ ...item })} className="text-blue-500 hover:text-blue-700 p-1 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                      <button type="button" title="Excluir" onClick={() => remove(item.id)} className="text-red-400 hover:text-red-600 p-1 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-teal-50 border-t border-teal-100">
                <td colSpan={6} className="px-4 py-3 text-right text-xs font-bold uppercase text-teal-800">Custo total dos colaboradores</td>
                <td className="px-4 py-3 text-right text-sm font-bold font-mono text-teal-900">{formatCurrency(totalCost)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}