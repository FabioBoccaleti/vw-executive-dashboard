import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  getAllImportedSemestresData,
  loadClassificacaoRevendas,
  saveClassificacaoRevendas,
  type Marca,
  MARCA_LABELS,
} from './ieoStorage';

export function ClassificacaoRevendasTab() {
  const [loading, setLoading] = useState(true);
  const [revendas, setRevendas] = useState<{ id: string; nome: string }[]>([]);
  const [classificacoes, setClassificacoes] = useState<Record<string, Marca>>({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'classified'>('all');

  useEffect(() => {
    Promise.all([getAllImportedSemestresData(), loadClassificacaoRevendas()])
      .then(([allData, savedClassificacoes]) => {
        const seen = new Map<string, string>(); // id → nome completo (primeira ocorrência)
        
        // Extrair revendas dos dados importados
        for (const data of allData) {
          for (const row of data.rows) {
            if (row.isMain) continue;
            // Procurar por linhas que tenham o padrão de revenda
            // Exemplo: "1 - SORANA NORTE (Revenda)"
            const match = row.conta.match(/^(\d+)\s*-\s*([^(]+)\s*\(Revenda\)/i);
            if (match) {
              const id = match[1];
              const nome = match[2].trim();
              if (!seen.has(id)) {
                seen.set(id, `${id} - ${nome} (Revenda)`);
              }
            }
          }
        }
        
        const sorted = [...seen.entries()]
          .map(([id, nome]) => ({ id, nome }))
          .sort((a, b) => parseInt(a.id) - parseInt(b.id));
        
        setRevendas(sorted);
        setClassificacoes(savedClassificacoes);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleClassify(id: string, marca: Marca | '') {
    const next = { ...classificacoes };
    if (marca === '') delete next[id];
    else next[id] = marca as Marca;
    setClassificacoes(next);
    setSaving(true);
    try {
      await saveClassificacaoRevendas(next);
    } finally {
      setSaving(false);
    }
  }

  const pending = revendas.filter(r => !classificacoes[r.id]);
  const classified = revendas.filter(r => classificacoes[r.id]);
  const displayed =
    filter === 'pending' ? pending :
    filter === 'classified' ? classified :
    [...pending, ...classified];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (revendas.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center space-y-2">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-slate-500 font-medium">Nenhum dado importado ainda</p>
          <p className="text-slate-400 text-sm">
            Importe ao menos um semestre para configurar as revendas.
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
              {pending.length} revenda{pending.length !== 1 ? 's' : ''} sem classificação
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs font-semibold text-green-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Todas as revendas classificadas
            </div>
          )}
          <span className="text-xs text-slate-400">
            {classified.length}/{revendas.length} classificadas
          </span>
          {saving && <span className="text-xs text-slate-400 italic">Salvando...</span>}
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'pending', 'classified'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                filter === f ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : 'Classificadas'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-200">
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Revenda</th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-64">Marca</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((revenda, i) => {
              const isPending = !classificacoes[revenda.id];
              return (
                <tr
                  key={revenda.id}
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
                        {revenda.nome}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={classificacoes[revenda.id] ?? ''}
                      onChange={e => handleClassify(revenda.id, e.target.value as Marca | '')}
                      className={`w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
                        isPending
                          ? 'border-amber-300 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <option value="">— Selecione —</option>
                      <option value="audi">{MARCA_LABELS.audi}</option>
                      <option value="vw">{MARCA_LABELS.vw}</option>
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
