import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteDespachanteWeek,
  listDespachanteWeeks,
  setDespachanteWeek,
  type DespachanteCategory,
  type DespachanteMarca,
} from './storage';
import { parseDespachanteWorkbook } from './parse';
import { DESPACHANTE_MONTHS, DESPACHANTE_WEEKS, MARCA_LABEL } from './shared';
import { DadosTab } from './DadosTab';
import { ConsolidadoTab } from './ConsolidadoTab';
import { useAuth } from '@/contexts/useAuth';

interface Props {
  onBack: () => void;
}

type View = 'importacao' | 'semana' | 'consolidado';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, index) => CURRENT_YEAR - 3 + index);

const CATEGORY_LABEL: Record<DespachanteCategory, string> = { novos: 'Novos (0km)', usados: 'Usados' };

export function ServicosDespachanteDashboard({ onBack }: Props) {
  const { canAccessVendasSub, isAdmin } = useAuth();
  const canVw = isAdmin() || canAccessVendasSub('despachante.vw');
  const canAudi = isAdmin() || canAccessVendasSub('despachante.audi');
  const allowedMarcas = (['vw', 'audi'] as DespachanteMarca[]).filter(m => (m === 'vw' ? canVw : canAudi));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<DespachanteCategory>('novos');
  const [view, setView] = useState<View>('importacao');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [week, setWeek] = useState(1);
  const [marca, setMarca] = useState<DespachanteMarca>(canVw ? 'vw' : 'audi');
  const [importedWeeks, setImportedWeeks] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  async function refreshWeeks() {
    setImportedWeeks(await listDespachanteWeeks(category, year, month));
  }

  useEffect(() => {
    void refreshWeeks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, year, month]);

  async function doImport(file: File) {
    setLoading(true);
    try {
      const parsed = parseDespachanteWorkbook(await file.arrayBuffer(), file.name, category, year, month, week);
      await setDespachanteWeek(parsed);
      await refreshWeeks();
      const marcas = parsed.marcas.map(item => `${MARCA_LABEL[item.marca]} (${item.rows.length})`).join(', ');
      toast.success(`Semana ${week} importada · ${marcas}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ler o arquivo Excel.');
    } finally {
      setLoading(false);
      setPendingFile(null);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (importedWeeks.includes(week)) {
      setPendingFile(file);
      setConfirmReplace(true);
      return;
    }
    void doImport(file);
  }

  async function handleDelete(target: number) {
    await deleteDespachanteWeek(category, year, month, target);
    await refreshWeeks();
    setConfirmDelete(null);
    toast.success(`Semana ${target} removida.`);
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Serviços de Despachante</h1>
          <p className="text-xs text-slate-500 mt-0.5">Demonstrativo de Vendas e Bonificações</p>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
        >
          ← Voltar
        </button>
      </header>

      <main className="flex-1 p-4 md:p-6">
        {/* Abas Novos / Usados */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-lg">
          {(['novos', 'usados'] as DespachanteCategory[]).map(item => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                category === item ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {CATEGORY_LABEL[item]}
            </button>
          ))}
        </div>

        <section className="bg-white rounded-b-lg shadow-sm p-4 md:p-6 space-y-5">
          {/* Período + visão */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-slate-600">
              Ano
              <select
                value={year}
                onChange={event => setYear(Number(event.target.value))}
                className="block mt-1 border border-slate-300 rounded px-3 py-2 text-sm"
              >
                {YEARS.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Mês
              <select
                value={month}
                onChange={event => setMonth(Number(event.target.value))}
                className="block mt-1 border border-slate-300 rounded px-3 py-2 text-sm"
              >
                {DESPACHANTE_MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
              </select>
            </label>
            <div className="ml-auto flex gap-2">
              {([['importacao', 'Importação'], ['semana', 'Dados da Semana'], ['consolidado', 'Consolidado do Mês']] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setView(value)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                    view === value ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Seletor de semana (importação e dados da semana) */}
          {view !== 'consolidado' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Semana:</span>
              {DESPACHANTE_WEEKS.map(value => {
                const imported = importedWeeks.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => setWeek(value)}
                    className={`relative text-xs font-medium rounded-full px-4 py-1.5 border transition-colors ${
                      week === value
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Semana {value}
                    {imported && (
                      <CheckCircle2 className={`w-3.5 h-3.5 inline-block ml-1 -mt-0.5 ${week === value ? 'text-white' : 'text-emerald-500'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Marca (dados da semana e consolidado) */}
          {view !== 'importacao' && (
            <div className="flex gap-1 border-b border-slate-100">
              {allowedMarcas.map(item => (
                <button
                  key={item}
                  onClick={() => setMarca(item)}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                    marca === item ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {MARCA_LABEL[item]}
                </button>
              ))}
            </div>
          )}

          {/* Conteúdo */}
          {view === 'importacao' ? (
            <>
              <div className="border border-dashed border-violet-300 bg-violet-50 rounded-lg p-8 text-center">
                <FileSpreadsheet className="w-10 h-10 text-violet-600 mx-auto mb-3" />
                <h2 className="font-bold text-slate-800">
                  Importar arquivo — {CATEGORY_LABEL[category]} · {DESPACHANTE_MONTHS[month - 1]} · Semana {week}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Selecione o arquivo Excel da semana ({category === 'novos' ? 'Taxas 0km' : 'Honorários Usados'}). As abas VW e Audi serão lidas automaticamente.
                </p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="mt-4 inline-flex items-center gap-2 bg-violet-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />{loading ? 'Processando...' : 'Selecionar Excel'}
                </button>
              </div>

              {importedWeeks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600">
                    Semanas importadas — {CATEGORY_LABEL[category]} · {DESPACHANTE_MONTHS[month - 1]}/{year}:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {importedWeeks.map(value => (
                      <span
                        key={value}
                        className="inline-flex items-center gap-2 text-xs font-medium rounded-full px-3 py-1 border border-emerald-300 bg-emerald-50 text-emerald-700"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />Semana {value}
                        <button
                          onClick={() => setConfirmDelete(value)}
                          className="text-red-500 hover:text-red-700"
                          title={`Remover Semana ${value}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : view === 'semana' ? (
            <DadosTab key={`${category}-${year}-${month}-${week}-${marca}`} category={category} year={year} month={month} week={week} marca={marca} />
          ) : (
            <ConsolidadoTab key={`${category}-${year}-${month}-${marca}`} category={category} year={year} month={month} marca={marca} />
          )}
        </section>
      </main>

      {confirmReplace && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
            <h2 className="font-bold text-slate-800">Substituir dados da Semana {week}?</h2>
            <p className="text-sm text-slate-600 mt-2">
              Já existem dados importados para {CATEGORY_LABEL[category]} · {DESPACHANTE_MONTHS[month - 1]}/{year} · Semana {week}. A nova importação substituirá os dados anteriores.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setConfirmReplace(false); setPendingFile(null); }}
                className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setConfirmReplace(false); if (pendingFile) void doImport(pendingFile); }}
                className="px-4 py-2 text-sm rounded bg-violet-600 text-white font-semibold hover:bg-violet-700"
              >
                Substituir
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
            <h2 className="font-bold text-slate-800">Remover Semana {confirmDelete}?</h2>
            <p className="text-sm text-slate-600 mt-2">
              Os dados de {CATEGORY_LABEL[category]} · {DESPACHANTE_MONTHS[month - 1]}/{year} · Semana {confirmDelete} serão excluídos.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleDelete(confirmDelete)}
                className="px-4 py-2 text-sm rounded bg-red-600 text-white font-semibold hover:bg-red-700"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
