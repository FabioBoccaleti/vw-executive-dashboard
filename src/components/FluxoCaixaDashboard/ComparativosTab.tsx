import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle2, Upload, Trash2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseBalancete } from "./balanceteParser";
import {
  saveComparativo,
  loadComparativosIndex,
  deleteComparativo,
} from "./comparativosStorage";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028];
const MONTHS = [
  { num: 1, label: 'Jan' },
  { num: 2, label: 'Fev' },
  { num: 3, label: 'Mar' },
  { num: 4, label: 'Abr' },
  { num: 5, label: 'Mai' },
  { num: 6, label: 'Jun' },
  { num: 7, label: 'Jul' },
  { num: 8, label: 'Ago' },
  { num: 9, label: 'Set' },
  { num: 10, label: 'Out' },
  { num: 11, label: 'Nov' },
  { num: 12, label: 'Dez' },
];

function makeKey(year: number, month: number) {
  return `${year}_${String(month).padStart(2, '0')}`;
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export function ComparativosTab() {
  // loaded: Record<"YYYY_MM", boolean>
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [indexLoading, setIndexLoading] = useState(true);
  const [indexError, setIndexError] = useState<string | null>(null);

  // Cell-level states: which cell is currently uploading or being deleted
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [cellError, setCellError] = useState<{ key: string; msg: string } | null>(null);

  // Confirm delete dialog
  const [confirmDelete, setConfirmDelete] = useState<{ year: number; month: number } | null>(null);

  // Hidden file input
  const fileRef = useRef<HTMLInputElement>(null);
  // Which cell the file input was opened for
  const pendingCell = useRef<{ year: number; month: number } | null>(null);

  // ─── Load index on mount ──────────────────────────────────────────────────
  useEffect(() => {
    setIndexLoading(true);
    loadComparativosIndex()
      .then((idx) => {
        setLoaded(idx);
        setIndexError(null);
      })
      .catch((e) => setIndexError(String(e)))
      .finally(() => setIndexLoading(false));
  }, []);

  // ─── File upload handler ──────────────────────────────────────────────────
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const cell = pendingCell.current;
      if (!file || !cell) return;
      // Reset input so same file can be re-selected
      e.target.value = '';

      const { year, month } = cell;
      const key = makeKey(year, month);
      setUploading(key);
      setCellError(null);

      try {
        const text = await file.text();
        const parsed = parseBalancete(text);
        await saveComparativo(year, month, parsed.accounts);
        setLoaded((prev) => ({ ...prev, [key]: true }));
      } catch (err: any) {
        setCellError({ key, msg: err?.message ?? 'Erro ao importar arquivo' });
      } finally {
        setUploading(null);
        pendingCell.current = null;
      }
    },
    []
  );

  // ─── Open file picker for a cell ─────────────────────────────────────────
  const openFilePicker = (year: number, month: number) => {
    pendingCell.current = { year, month };
    fileRef.current?.click();
  };

  // ─── Delete handler ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { year, month } = confirmDelete;
    const key = makeKey(year, month);
    setConfirmDelete(null);
    setDeleting(key);
    setCellError(null);
    try {
      await deleteComparativo(year, month);
      setLoaded((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err: any) {
      setCellError({ key, msg: err?.message ?? 'Erro ao excluir' });
    } finally {
      setDeleting(null);
    }
  };

  // ─── Cell click ──────────────────────────────────────────────────────────
  const handleCellClick = (year: number, month: number) => {
    const key = makeKey(year, month);
    if (uploading === key || deleting === key) return;
    if (loaded[key]) {
      // Already loaded → ask to delete or replace
      setConfirmDelete({ year, month });
    } else {
      openFilePicker(year, month);
    }
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────

  if (indexLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        <p className="text-sm">Carregando índice de balancetes...</p>
      </div>
    );
  }

  if (indexError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-red-500">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">Erro ao carregar índice: {indexError}</p>
      </div>
    );
  }

  const totalLoaded = Object.keys(loaded).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Comparativos
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Clique em uma célula para importar o balancete daquele período.{' '}
          {totalLoaded > 0 && (
            <span className="text-green-600 font-medium">
              {totalLoaded} período{totalLoaded !== 1 ? 's' : ''} carregado{totalLoaded !== 1 ? 's' : ''}.
            </span>
          )}
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-4 py-3 text-left font-semibold w-16 rounded-tl-xl">Ano</th>
              {MONTHS.map((m) => (
                <th key={m.num} className="px-3 py-3 text-center font-semibold w-16">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {YEARS.map((year, yi) => (
              <tr
                key={year}
                className={cn(
                  yi % 2 === 0
                    ? 'bg-white dark:bg-slate-900'
                    : 'bg-slate-50 dark:bg-slate-800/50'
                )}
              >
                <td className="px-4 py-2 font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700">
                  {year}
                </td>
                {MONTHS.map((m) => {
                  const key = makeKey(year, m.num);
                  const isLoaded = !!loaded[key];
                  const isUploading = uploading === key;
                  const isDeleting = deleting === key;
                  const hasError = cellError?.key === key;
                  const busy = isUploading || isDeleting;

                  return (
                    <td key={m.num} className="px-1 py-1 text-center">
                      <button
                        onClick={() => handleCellClick(year, m.num)}
                        disabled={busy}
                        title={
                          isLoaded
                            ? `${m.label}/${year} — clique para excluir ou substituir`
                            : `Importar balancete ${m.label}/${year}`
                        }
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center mx-auto transition-all',
                          'border focus:outline-none focus:ring-2 focus:ring-offset-1',
                          busy && 'cursor-wait opacity-70',
                          !busy && isLoaded && !hasError &&
                            'border-green-300 bg-green-50 hover:bg-red-50 hover:border-red-300 dark:bg-green-900/30 dark:border-green-700 group',
                          !busy && !isLoaded && !hasError &&
                            'border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800',
                          hasError &&
                            'border-red-300 bg-red-50 dark:bg-red-900/30'
                        )}
                      >
                        {isUploading || isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        ) : hasError ? (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : isLoaded ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-green-600 group-hover:hidden dark:text-green-400" />
                            <Trash2 className="w-4 h-4 text-red-500 hidden group-hover:block" />
                          </>
                        ) : (
                          <Upload className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded border border-green-300 bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="w-3 h-3 text-green-600" />
          </div>
          <span>Balancete importado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded border border-slate-200 bg-white flex items-center justify-center">
            <Upload className="w-3 h-3 text-slate-400" />
          </div>
          <span>Sem dados — clique para importar</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded border border-red-300 bg-red-50 flex items-center justify-center">
            <Trash2 className="w-3 h-3 text-red-500" />
          </div>
          <span>Passe o mouse para excluir</span>
        </div>
      </div>

      {/* Confirm Delete Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-80 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Excluir balancete?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Deseja excluir ou substituir o balancete de{' '}
              <strong>
                {MONTHS.find((m) => m.num === confirmDelete.month)?.label}/
                {confirmDelete.year}
              </strong>
              ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const { year, month } = confirmDelete;
                  setConfirmDelete(null);
                  openFilePicker(year, month);
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Substituir
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Excluir
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 dark:text-slate-300 dark:border-slate-600 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
