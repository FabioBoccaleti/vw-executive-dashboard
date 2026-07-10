import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  EstoqueUsadosEntry, loadEntry, deleteEntry,
  calcTotalVW, calcTotalAudi, formatDateBR, fmtBRL,
} from './estoqueUsadosStorage';
import { kvBulkGet } from '@/lib/kvClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  dates: string[];          // lista de datas (desc) com lançamentos
  onView: (entry: EstoqueUsadosEntry) => void;
  onDeleted: (date: string) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function HistoricoTab({ dates, onView, onDeleted }: Props) {
  const [entries, setEntries]   = useState<EstoqueUsadosEntry[]>([]);
  const [loading, setLoading]   = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Carrega até 30 lançamentos mais recentes de uma vez
  useEffect(() => {
    if (dates.length === 0) { setEntries([]); return; }

    const recent = dates.slice(0, 30);
    setLoading(true);

    const keys = recent.map(d => `estoque_usados:entry:${d}`);
    kvBulkGet<EstoqueUsadosEntry>(keys).then(map => {
      const loaded: EstoqueUsadosEntry[] = [];
      for (const key of keys) {
        const v = map[key];
        if (v) loaded.push(v);
      }
      setEntries(loaded.sort((a, b) => b.date.localeCompare(a.date)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [dates]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const ok = await deleteEntry(toDelete);
    setDeleting(false);
    setToDelete(null);
    if (ok) {
      toast.success('Lançamento excluído.');
      onDeleted(toDelete);
      setEntries(prev => prev.filter(e => e.date !== toDelete));
    } else {
      toast.error('Erro ao excluir lançamento.');
    }
  };

  return (
    <div className="flex-1 bg-slate-50 overflow-auto p-6">
      {/* Confirmação de exclusão */}
      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Confirmar Exclusão</h3>
              <p className="text-sm text-slate-500 mt-1">
                Deseja excluir o lançamento do dia <strong>{formatDateBR(toDelete)}</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="px-6 py-4 flex justify-end gap-2">
              <button
                onClick={() => setToDelete(null)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          {/* Header da tabela */}
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700">Histórico — últimos 30 dias com lançamentos</h3>
            <span className="text-xs text-slate-400">{entries.length} registro(s)</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40 gap-2">
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-slate-400">Carregando histórico...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <span className="text-slate-400 text-sm">Nenhum lançamento encontrado.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-3 text-left   text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Data</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Total VW</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Total Audi</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Total Geral</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">A Pagar VW</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">A Pagar Audi</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Novos Venc. VW</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Novos Venc. Audi</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((e, i) => {
                    const totalVW   = calcTotalVW(e);
                    const totalAudi = calcTotalAudi(e);
                    const isFirst   = i === 0;
                    return (
                      <tr key={e.date} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700 whitespace-nowrap">{formatDateBR(e.date)}</span>
                            {isFirst && (
                              <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 whitespace-nowrap">
                                Mais recente
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-slate-600 text-xs whitespace-nowrap">
                          {fmtBRL(totalVW)}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-slate-600 text-xs whitespace-nowrap">
                          {fmtBRL(totalAudi)}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums font-semibold text-slate-700 text-xs whitespace-nowrap">
                          {fmtBRL(totalVW + totalAudi)}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-slate-500 text-xs whitespace-nowrap">
                          {fmtBRL(e.vwUsadosLMVendidoaPagar)}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-slate-500 text-xs whitespace-nowrap">
                          {fmtBRL(e.audiUsadosMontadoraaPagar)}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-slate-500 text-xs whitespace-nowrap">
                          {fmtBRL(e.vwNovosProximoVencimento ?? 0)}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-slate-500 text-xs whitespace-nowrap">
                          {fmtBRL(e.audiNovosProximoVencimento ?? 0)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onView(e)}
                              className="px-2.5 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors"
                            >
                              Visualizar
                            </button>
                            <button
                              onClick={() => setToDelete(e.date)}
                              className="px-2.5 py-1 text-xs font-medium text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
