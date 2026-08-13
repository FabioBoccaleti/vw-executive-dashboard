import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  getAllImportedMonthsData,
  loadRegrasDeptos,
  saveRegrasDeptos,
  type DeptoTab,
  DEPTO_TAB_LABELS,
  DEPTO_TABS_ORDENADOS,
} from './despesasDeptoAudiStorage';

export function RegrasDepartamentosTab() {
  const [loading, setLoading] = useState(true);
  const [deptos, setDeptos] = useState<{ prefix: string; fullName: string }[]>([]);
  const [regras, setRegras] = useState<Record<string, DeptoTab>>({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'classified'>('all');

  useEffect(() => {
    Promise.all([getAllImportedMonthsData(), loadRegrasDeptos()])
      .then(([allData, savedRegras]) => {
        const seen = new Map<string, string>(); // prefix → nome completo (primeira ocorrência)
        for (const data of allData) {
          for (const row of data.rows) {
            if (row.isMain) continue;
            if (!/^\d{3,} -/.test(row.conta)) continue;
            const match = row.conta.match(/^(\d+ -)/);
            if (!match) continue;
            const prefix = match[1];
            if (!seen.has(prefix)) seen.set(prefix, row.conta);
          }
        }
        const sorted = [...seen.entries()]
          .map(([prefix, fullName]) => ({ prefix, fullName }))
          .sort((a, b) => parseInt(a.prefix) - parseInt(b.prefix));
        setDeptos(sorted);
        setRegras(savedRegras);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleClassify(prefix: string, tab: DeptoTab | '') {
    const next = { ...regras };
    if (tab === '') delete next[prefix];
    else next[prefix] = tab as DeptoTab;
    setRegras(next);
    setSaving(true);
    try {
      await saveRegrasDeptos(next);
    } finally {
      setSaving(false);
    }
  }

  const pending    = deptos.filter(d => !regras[d.prefix]);
  const classified = deptos.filter(d =>  regras[d.prefix]);
  const displayed  =
    filter === 'pending'    ? pending :
    filter === 'classified' ? classified :
    [...pending, ...classified];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500" />
      </div>
    );
  }

  if (deptos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center space-y-2">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-slate-500 font-medium">Nenhum dado importado ainda</p>
          <p className="text-slate-400 text-sm">
            Importe ao menos um mês para configurar as regras de departamentos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Resumo + filtro */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {pending.length > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-700">
              <AlertCircle className="w-3.5 h-3.5" />
              {pending.length} departamento{pending.length !== 1 ? 's' : ''} sem classificação
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs font-semibold text-green-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Todos os departamentos classificados
            </div>
          )}
          <span className="text-xs text-slate-400">
            {classified.length}/{deptos.length} classificados
          </span>
          {saving && <span className="text-xs text-slate-400 italic">Salvando...</span>}
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'pending', 'classified'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                filter === f ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : 'Classificados'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-200">
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Departamento (CCusto)</th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-72">Pertence a</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((depto, i) => {
              const isPending = !regras[depto.prefix];
              return (
                <tr
                  key={depto.prefix}
                  className={`border-b last:border-0 ${
                    isPending
                      ? 'bg-amber-50 border-amber-100'
                      : i % 2 === 0 ? 'bg-white border-slate-100' : 'bg-slate-50/50 border-slate-100'
                  }`}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold shrink-0">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Classificar
                        </span>
                      )}
                      <span className={`font-${isPending ? 'semibold' : 'medium'} ${isPending ? 'text-slate-800' : 'text-slate-600'}`}>
                        {depto.fullName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={regras[depto.prefix] ?? ''}
                      onChange={e => handleClassify(depto.prefix, e.target.value as DeptoTab | '')}
                      className={`w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 ${
                        isPending
                          ? 'border-amber-300 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <option value="">— Selecione —</option>
                      {DEPTO_TABS_ORDENADOS.map(tab => (
                        <option key={tab} value={tab}>{DEPTO_TAB_LABELS[tab]}</option>
                      ))}
                    </select>
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
