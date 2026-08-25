import { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { getAllImportedSemestresData, loadContasTipoItem, saveContasTipoItem } from './ieoStorage';

export function ContasTipoItemTab() {
  const [loading, setLoading] = useState(true);
  const [contas, setContas] = useState<string[]>([]);
  const [availableContas, setAvailableContas] = useState<string[]>([]);
  const [newConta, setNewConta] = useState('');
  const [saving, setSaving] = useState(false);
  const [migrated, setMigrated] = useState(false);

  useEffect(() => {
    Promise.all([getAllImportedSemestresData(), loadContasTipoItem()])
      .then(([allData, savedContas]) => {
        const allMainContas = new Set<string>();
        for (const data of allData) {
          for (const row of data.rows) {
            if (row.isMain) allMainContas.add(row.conta);
          }
        }
        setAvailableContas([...allMainContas].sort());

        if (savedContas === null) {
          // Migração automática: pré-popula com contas que começam com 3 ou 4
          const migrationList = [...allMainContas]
            .filter(c => /^[34]/.test(c))
            .sort();
          setContas(migrationList);
          setMigrated(true);
          saveContasTipoItem(migrationList);
        } else {
          setContas(savedContas);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    const value = newConta.trim();
    if (!value || contas.includes(value)) return;
    const next = [...contas, value].sort();
    setContas(next);
    setNewConta('');
    setSaving(true);
    try {
      await saveContasTipoItem(next);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(conta: string) {
    const next = contas.filter(c => c !== conta);
    setContas(next);
    setSaving(true);
    try {
      await saveContasTipoItem(next);
    } finally {
      setSaving(false);
    }
  }

  const notInList = availableContas.filter(c => !contas.includes(c));

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700">
          <p className="font-semibold mb-1">Contas com Regra de Tipo Item (P/S/V)</p>
          <p>
            As contas listadas aqui utilizam o <strong>Tipo Item</strong> (P=Peças, S=Serviços, V=Veículos)
            para classificar o departamento. Todas as demais contas usam o <strong>Centro de Custo</strong>.
          </p>
        </div>
      </div>

      {migrated && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            <strong>Migração automática:</strong> as contas abaixo foram detectadas nos dados importados
            (contas iniciadas em 3 ou 4) e pré-configuradas automaticamente. Revise e ajuste conforme necessário.
          </p>
        </div>
      )}

      {/* Adicionar conta */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-600 mb-3">Adicionar conta</p>
        <div className="flex gap-2">
          <input
            value={newConta}
            onChange={e => setNewConta(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Ex: 3110101001 - VEÍCULOS NACIONAIS/ IMPORTADOS"
            className="flex-1 text-xs border border-slate-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            list="contas-disponiveis-tipo-item"
          />
          <datalist id="contas-disponiveis-tipo-item">
            {notInList.map(c => <option key={c} value={c} />)}
          </datalist>
          <button
            onClick={handleAdd}
            disabled={!newConta.trim() || contas.includes(newConta.trim())}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        </div>
      </div>

      {/* Cabeçalho da lista */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {contas.length} conta{contas.length !== 1 ? 's' : ''} configurada{contas.length !== 1 ? 's' : ''}
        </div>
        {saving && <span className="text-xs text-slate-400 italic">Salvando...</span>}
      </div>

      {contas.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-slate-500 font-medium">Nenhuma conta configurada</p>
            <p className="text-slate-400 text-sm">Todas as contas usarão o Centro de Custo como critério.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-200">
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Conta / Descrição</th>
                <th className="px-4 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {contas.map((conta, i) => (
                <tr
                  key={conta}
                  className={`border-b last:border-0 ${
                    i % 2 === 0 ? 'bg-white border-slate-100' : 'bg-slate-50/50 border-slate-100'
                  }`}
                >
                  <td className="px-4 py-2 font-medium text-slate-700">{conta}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleRemove(conta)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
