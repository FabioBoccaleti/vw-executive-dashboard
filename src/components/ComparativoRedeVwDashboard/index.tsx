import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Trash2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteComparativoRedeVwMonth,
  getComparativoRedeVwMonth,
  setComparativoRedeVwMonth,
  type ComparativoRedeVwMonthData,
} from './comparativoRedeVwStorage';

interface Props { onChangeBrand: () => void; }

const EXPECTED_SHEETS = [
  'Indicadores Econômico-Financeiro',
  'Demonstração Resultado Geral',
  'Veículos Novos - VL',
  'Veículos Seminovos',
  'P&A',
  'Assistência Técnica',
];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const YEARS = Array.from({ length: 8 }, (_, index) => new Date().getFullYear() - 3 + index);

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(value);
  return String(value);
}

function parseWorkbook(buffer: ArrayBuffer, fileName: string, year: number, month: number): ComparativoRedeVwMonthData {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const available = new Map(workbook.SheetNames.map(name => [normalizeName(name), name]));
  const missing = EXPECTED_SHEETS.filter(name => !available.has(normalizeName(name)));
  if (missing.length > 0) {
    throw new Error(`Abas não encontradas: ${missing.join(', ')}`);
  }

  const sheets = EXPECTED_SHEETS.map(expectedName => {
    const actualName = available.get(normalizeName(expectedName)) as string;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[actualName], {
      header: 1,
      defval: '',
      raw: true,
    }) as unknown[][];
    return { name: expectedName, rows };
  });

  return { year, month, fileName, importedAt: new Date().toISOString(), sheets };
}

export function ComparativoRedeVwDashboard({ onChangeBrand }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<ComparativoRedeVwMonthData | null>(null);
  const [activeTab, setActiveTab] = useState<'importar' | 'dados'>('importar');
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedSheet = data?.sheets[activeSheet];
  const periodLabel = `${MONTHS[month - 1]} de ${year}`;

  async function loadMonth() {
    setLoading(true);
    try {
      setData(await getComparativoRedeVwMonth(year, month));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadMonth(); }, [year, month]);

  async function importFile(file: File) {
    setLoading(true);
    try {
      const parsed = parseWorkbook(await file.arrayBuffer(), file.name, year, month);
      await setComparativoRedeVwMonth(parsed);
      setData(parsed);
      setActiveTab('dados');
      toast.success(`Arquivo importado para ${periodLabel}.`);
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
      await deleteComparativoRedeVwMonth(year, month);
      setData(null);
      toast.success(`Dados de ${periodLabel} removidos.`);
    } finally {
      setLoading(false);
    }
  }

  const availableSheets = useMemo(() => data?.sheets ?? [], [data]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="px-6 py-3 flex items-center justify-between shadow-md bg-teal-700">
        <div>
          <h1 className="text-sm font-bold text-white">Comparativo Rede VW</h1>
          <p className="text-xs text-teal-100 mt-0.5">Demonstrativo de Resultados</p>
        </div>
        <button onClick={onChangeBrand} className="px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 rounded">← Voltar</button>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <div className="flex border-b border-slate-200 bg-white rounded-t-lg">
          <button onClick={() => setActiveTab('importar')} className={`px-5 py-3 text-sm font-semibold border-b-2 ${activeTab === 'importar' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}>
            <Upload className="inline w-4 h-4 mr-2" />Importar Dados
          </button>
          <button onClick={() => setActiveTab('dados')} className={`px-5 py-3 text-sm font-semibold border-b-2 ${activeTab === 'dados' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}>
            Dados do Mês
          </button>
        </div>

        <section className="bg-white rounded-b-lg shadow-sm p-4 md:p-6">
          <div className="flex flex-wrap items-end gap-3 mb-5">
            <label className="text-xs font-semibold text-slate-600">Ano<select value={year} onChange={event => setYear(Number(event.target.value))} className="block mt-1 border border-slate-300 rounded px-3 py-2 text-sm"><option value="">Selecione</option>{YEARS.map(item => <option key={item}>{item}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-600">Mês<select value={month} onChange={event => setMonth(Number(event.target.value))} className="block mt-1 border border-slate-300 rounded px-3 py-2 text-sm">{MONTHS.map((item, index) => <option key={item} value={index + 1}>{item}</option>)}</select></label>
            {data && <button onClick={() => setConfirmDelete(true)} className="ml-auto flex items-center gap-2 border border-red-300 text-red-600 rounded px-3 py-2 text-sm hover:bg-red-50"><Trash2 className="w-4 h-4" />Remover dados</button>}
          </div>

          {activeTab === 'importar' ? (
            <div className="space-y-5">
              <div className="border border-dashed border-teal-300 bg-teal-50 rounded-lg p-8 text-center">
                <FileSpreadsheet className="w-10 h-10 text-teal-600 mx-auto mb-3" />
                <h2 className="font-bold text-slate-800">Importar relatório Excel</h2>
                <p className="text-sm text-slate-500 mt-1">Selecione um arquivo com as seis abas do relatório para {periodLabel}.</p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="mt-4 inline-flex items-center gap-2 bg-teal-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"><Upload className="w-4 h-4" />{loading ? 'Processando...' : 'Selecionar Excel'}</button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {EXPECTED_SHEETS.map(name => <div key={name} className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 className="w-4 h-4 text-teal-600" />{name}</div>)}
              </div>
              {data && <p className="text-xs text-slate-500">Arquivo atual: <strong>{data.fileName}</strong>, importado em {new Date(data.importedAt).toLocaleString('pt-BR')}.</p>}
            </div>
          ) : (
            <div>
              {!data ? <div className="py-16 text-center text-slate-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />Nenhum dado importado para {periodLabel}.</div> : <>
                <div className="flex gap-1 overflow-x-auto border-b border-slate-200 mb-4">{availableSheets.map((sheet, index) => <button key={sheet.name} onClick={() => setActiveSheet(index)} className={`whitespace-nowrap px-3 py-2 text-xs font-semibold border-b-2 ${activeSheet === index ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}>{sheet.name}</button>)}</div>
                <div className="overflow-auto max-h-[calc(100vh-290px)] border border-slate-200"><table className="min-w-max text-xs border-collapse"><tbody>{selectedSheet?.rows.map((row, rowIndex) => <tr key={rowIndex} className={rowIndex < 8 ? 'bg-teal-50 font-semibold' : 'odd:bg-white even:bg-slate-50'}>{row.map((cell, columnIndex) => <td key={columnIndex} className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">{formatCell(cell)}</td>)}</tr>)}</tbody></table></div>
              </>}
            </div>
          )}
        </section>
      </main>

      {confirmReplace && <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4"><div className="bg-white rounded-lg p-6 max-w-md shadow-xl"><h2 className="font-bold text-slate-800">Substituir dados?</h2><p className="text-sm text-slate-600 mt-2">Já existem dados para {periodLabel}. A nova importação substituirá as seis abas.</p><div className="flex justify-end gap-2 mt-5"><button onClick={() => { setConfirmReplace(false); setPendingFile(null); }} className="px-3 py-2 text-sm text-slate-600">Cancelar</button><button onClick={() => { setConfirmReplace(false); if (pendingFile) void importFile(pendingFile); }} className="px-3 py-2 text-sm bg-teal-600 text-white rounded">Substituir</button></div></div></div>}
      {confirmDelete && <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4"><div className="bg-white rounded-lg p-6 max-w-md shadow-xl"><h2 className="font-bold text-slate-800">Remover dados?</h2><p className="text-sm text-slate-600 mt-2">Os dados de {periodLabel} serão excluídos.</p><div className="flex justify-end gap-2 mt-5"><button onClick={() => setConfirmDelete(false)} className="px-3 py-2 text-sm text-slate-600">Cancelar</button><button onClick={() => void handleDelete()} className="px-3 py-2 text-sm bg-red-600 text-white rounded">Remover</button></div></div></div>}
    </div>
  );
}
