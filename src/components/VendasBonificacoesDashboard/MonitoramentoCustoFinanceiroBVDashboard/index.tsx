import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Upload, Trash2, AlertCircle, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteMonitoramentoBVDay,
  getMonitoramentoBVDay,
  listMonitoramentoBVDates,
  setMonitoramentoBVDay,
  type MonitoramentoBVBrand,
  type MonitoramentoBVDayData,
} from './storage';
import { AnaliseTab } from './AnaliseTab';

interface Props {
  onBack: () => void;
}

const BRAND_LABEL: Record<MonitoramentoBVBrand, string> = { vw: 'VW', audi: 'Audi' };

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDateBR(iso: string) {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString('pt-BR');
  if (typeof value === 'number') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(value);
  return String(value);
}

function parseWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
  brand: MonitoramentoBVBrand,
  date: string,
): MonitoramentoBVDayData {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheets = workbook.SheetNames.map(name => ({
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      defval: '',
      raw: true,
    }) as unknown[][],
  }));
  if (sheets.length === 0) {
    throw new Error('O arquivo não possui abas legíveis.');
  }
  return { brand, date, fileName, importedAt: new Date().toISOString(), sheets };
}

export function MonitoramentoCustoFinanceiroBVDashboard({ onBack }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [brand, setBrand] = useState<MonitoramentoBVBrand>('vw');
  const [view, setView] = useState<'importacao' | 'analise'>('importacao');
  const [date, setDate] = useState<string>(todayISO());
  const [data, setData] = useState<MonitoramentoBVDayData | null>(null);
  const [importedDates, setImportedDates] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dateLabel = formatDateBR(date);

  async function loadDay() {
    if (!date) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const dayData = await getMonitoramentoBVDay(brand, date);
      setData(dayData);
      setActiveSheet(0);
    } finally {
      setLoading(false);
    }
  }

  async function refreshDates() {
    setImportedDates(await listMonitoramentoBVDates(brand));
  }

  useEffect(() => {
    void loadDay();
    void refreshDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, date]);

  async function importFile(file: File) {
    if (!date) {
      toast.error('Selecione a data base do arquivo antes de importar.');
      return;
    }
    setLoading(true);
    try {
      const parsed = parseWorkbook(await file.arrayBuffer(), file.name, brand, date);
      await setMonitoramentoBVDay(parsed);
      setData(parsed);
      setActiveSheet(0);
      await refreshDates();
      toast.success(`Arquivo importado para ${BRAND_LABEL[brand]} · ${dateLabel}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ler o arquivo Excel.');
    } finally {
      setLoading(false);
      setPendingFile(null);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (data) {
      setPendingFile(file);
      setConfirmReplace(true);
      return;
    }
    await importFile(file);
  }

  async function handleDelete() {
    setConfirmDelete(false);
    setLoading(true);
    try {
      await deleteMonitoramentoBVDay(brand, date);
      setData(null);
      await refreshDates();
      toast.success(`Dados de ${BRAND_LABEL[brand]} · ${dateLabel} removidos.`);
    } finally {
      setLoading(false);
    }
  }

  const sheets = useMemo(() => data?.sheets ?? [], [data]);
  const selectedSheet = sheets[activeSheet];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Monitoramento de Custo Financeiro Estoque Rotativo Banco Volks</h1>
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
        {/* Abas VW / Audi */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-lg">
          {(['vw', 'audi'] as MonitoramentoBVBrand[]).map(item => (
            <button
              key={item}
              onClick={() => setBrand(item)}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                brand === item ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {BRAND_LABEL[item]}
            </button>
          ))}
        </div>

        <section className="bg-white rounded-b-lg shadow-sm p-4 md:p-6 space-y-5">
          {/* Sub-abas Importação / Análise */}
          <div className="flex gap-2 border-b border-slate-100 pb-3">
            {([['importacao', 'Importação'], ['analise', 'Análise']] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setView(value)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                  view === value ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === 'analise' ? (
            <AnaliseTab key={brand} brand={brand} />
          ) : (
          <>
          {/* Seletor de data base + remover */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-slate-600">
              Data base do arquivo
              <div className="mt-1 flex items-center gap-2 border border-slate-300 rounded px-3 py-2">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={date}
                  onChange={event => setDate(event.target.value)}
                  className="text-sm focus:outline-none"
                />
              </div>
            </label>
            {data && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="ml-auto flex items-center gap-2 border border-red-300 text-red-600 rounded px-3 py-2 text-sm hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />Remover dados
              </button>
            )}
          </div>

          {/* Área de importação */}
          <div className="border border-dashed border-sky-300 bg-sky-50 rounded-lg p-8 text-center">
            <FileSpreadsheet className="w-10 h-10 text-sky-600 mx-auto mb-3" />
            <h2 className="font-bold text-slate-800">Importar arquivo Excel — {BRAND_LABEL[brand]}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {date
                ? `Selecione o arquivo Excel referente ao dia ${dateLabel}. Todas as abas serão lidas.`
                : 'Selecione uma data base para importar o arquivo.'}
            </p>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || !date}
              className="mt-4 inline-flex items-center gap-2 bg-sky-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />{loading ? 'Processando...' : 'Selecionar Excel'}
            </button>
            {data && (
              <p className="text-xs text-slate-500 mt-4">
                Arquivo atual: <strong>{data.fileName}</strong>, importado em {new Date(data.importedAt).toLocaleString('pt-BR')}.
              </p>
            )}
          </div>

          {/* Datas já importadas */}
          {importedDates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">Dias importados ({BRAND_LABEL[brand]}):</p>
              <div className="flex flex-wrap gap-2">
                {importedDates.map(item => (
                  <button
                    key={item}
                    onClick={() => setDate(item)}
                    className={`text-xs font-medium rounded-full px-3 py-1 border transition-colors ${
                      item === date
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {formatDateBR(item)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pré-visualização dos dados importados */}
          <div>
            {!data ? (
              <div className="py-16 text-center text-slate-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                Nenhum dado importado para {BRAND_LABEL[brand]} · {dateLabel}.
              </div>
            ) : (
              <>
                <div className="flex gap-1 overflow-x-auto border-b border-slate-200 mb-4">
                  {sheets.map((sheet, index) => (
                    <button
                      key={`${sheet.name}-${index}`}
                      onClick={() => setActiveSheet(index)}
                      className={`whitespace-nowrap px-3 py-2 text-xs font-semibold border-b-2 ${
                        activeSheet === index ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500'
                      }`}
                    >
                      {sheet.name}
                    </button>
                  ))}
                </div>
                <div className="overflow-auto max-h-[calc(100vh-430px)] border border-slate-200">
                  <table className="min-w-max text-xs border-collapse">
                    <tbody>
                      {(selectedSheet?.rows ?? []).map((row, rowIndex) => (
                        <tr key={rowIndex} className={rowIndex === 0 ? 'bg-sky-50 font-semibold' : 'odd:bg-white even:bg-slate-50'}>
                          {row.map((cell, columnIndex) => (
                            <td key={columnIndex} className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">
                              {formatCell(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          </>
          )}
        </section>
      </main>

      {confirmReplace && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
            <h2 className="font-bold text-slate-800">Substituir dados?</h2>
            <p className="text-sm text-slate-600 mt-2">
              Já existem dados para {BRAND_LABEL[brand]} · {dateLabel}. A nova importação substituirá o arquivo anterior.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setConfirmReplace(false); setPendingFile(null); }} className="px-3 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => { setConfirmReplace(false); if (pendingFile) void importFile(pendingFile); }} className="px-3 py-2 text-sm bg-sky-600 text-white rounded">Substituir</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
            <h2 className="font-bold text-slate-800">Remover dados?</h2>
            <p className="text-sm text-slate-600 mt-2">Os dados de {BRAND_LABEL[brand]} · {dateLabel} serão excluídos.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => void handleDelete()} className="px-3 py-2 text-sm bg-red-600 text-white rounded">Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
