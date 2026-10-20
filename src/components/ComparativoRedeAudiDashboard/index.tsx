import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Trash2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteComparativoRedeAudiMonth,
  deleteComparativoRedeAudiConcessionarias,
  getLatestComparativoRedeAudiMonth,
  getComparativoRedeAudiMonth,
  getComparativoRedeAudiConcessionarias,
  setComparativoRedeAudiMonth,
  setComparativoRedeAudiConcessionarias,
  type ComparativoRedeAudiConcessionarias,
  type ComparativoRedeAudiMonthData,
} from './comparativoRedeAudiStorage';

interface Props { onChangeBrand: () => void; }

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const YEARS = Array.from({ length: 8 }, (_, index) => new Date().getFullYear() - 3 + index);

const CODE_COL = 0;
const LABEL_COL = 1;
const AC_LAPA = { value: 3, pct: 4 };

type GroupKey = 'mediaNacional' | 'porteG' | 'regiaoSE' | 'top25';

interface GroupDef {
  key: GroupKey;
  label: string;
  short: string;
  value: number;
  pct: number;
  totalField: keyof ComparativoRedeAudiConcessionarias;
  semField: keyof ComparativoRedeAudiConcessionarias;
}

const GROUPS: GroupDef[] = [
  { key: 'mediaNacional', label: 'Média Nacional', short: 'Média Nac.', value: 6, pct: 7, totalField: 'mediaNacionalTotal', semField: 'mediaNacionalSemSorana' },
  { key: 'porteG', label: 'Porte G', short: 'Porte G', value: 9, pct: 10, totalField: 'porteGTotal', semField: 'porteGSemSorana' },
  { key: 'regiaoSE', label: 'Região SE Capitais', short: 'Reg. SE', value: 12, pct: 13, totalField: 'regiaoSETotal', semField: 'regiaoSESemSorana' },
  { key: 'top25', label: 'Top 25%', short: 'Top 25%', value: 15, pct: 16, totalField: 'top25Total', semField: 'top25SemSorana' },
];

const EMPTY_CONCESSIONARIAS: ComparativoRedeAudiConcessionarias = {
  mediaNacionalTotal: 0,
  mediaNacionalSemSorana: 0,
  porteGTotal: 0,
  porteGSemSorana: 0,
  regiaoSETotal: 0,
  regiaoSESemSorana: 0,
  top25Total: 0,
  top25SemSorana: 0,
};

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function numericCell(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(value);
  return String(value);
}

function formatNumber(value: number | null, isPercent = false) {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)}${isPercent ? '%' : ''}`;
}

function formatValor(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(value));
}

function difference(value: number | null, reference: number | null) {
  return value === null || reference === null ? null : value - reference;
}

function adjustedAverage(average: number | null, sorana: number | null, total: number, totalWithoutSorana: number) {
  if (average === null || sorana === null || total <= 1 || totalWithoutSorana <= 0) return null;
  return (average * total - sorana) / totalWithoutSorana;
}

function previousPeriod(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function rowLabel(row: unknown[]) {
  return String(row[LABEL_COL] ?? '').trim();
}

function rowHasPercent(row: unknown[]) {
  return numericCell(row[AC_LAPA.pct]) !== null;
}

function isComparableRow(row: unknown[]) {
  if (!rowLabel(row)) return false;
  return numericCell(row[AC_LAPA.value]) !== null || GROUPS.some(group => numericCell(row[group.value]) !== null);
}

function isDataSheetRows(rows: unknown[][]) {
  return rows.slice(0, 7).some(row => row.some(cell => String(cell).trim() === 'AC Lapa'));
}

function findReceitaLiquida(rows: unknown[][], column: number): number | null {
  const row = rows.find(current => {
    const normalized = normalizeName(rowLabel(current));
    return normalized.startsWith('total') && normalized.includes('receitaliquida');
  });
  return row ? numericCell(row[column]) : null;
}

function parseWorkbook(buffer: ArrayBuffer, fileName: string, year: number, month: number): ComparativoRedeAudiMonthData {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheets = workbook.SheetNames
    .map(name => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: '', raw: true }) as unknown[][] }))
    .filter(sheet => isDataSheetRows(sheet.rows));

  if (sheets.length === 0) {
    throw new Error('Nenhuma aba no formato esperado foi encontrada (não localizei os cabeçalhos AC Lapa / Média Nacional).');
  }

  return { year, month, fileName, importedAt: new Date().toISOString(), sheets };
}

export function ComparativoRedeAudiDashboard({ onChangeBrand }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<ComparativoRedeAudiMonthData | null>(null);
  const [activeTab, setActiveTab] = useState<'importar' | 'dados' | 'concessionarias' | 'comparativo' | 'ajustado' | 'demonstrativo'>('importar');
  const [comparativoSheetIndex, setComparativoSheetIndex] = useState(0);
  const [concessionarias, setConcessionarias] = useState<ComparativoRedeAudiConcessionarias>(EMPTY_CONCESSIONARIAS);
  const [hasSavedConcessionarias, setHasSavedConcessionarias] = useState(false);
  const [concessionariasSaving, setConcessionariasSaving] = useState(false);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const selectedSheet = data?.sheets[activeSheet];
  const periodLabel = `${MONTHS[month - 1]} de ${year}`;

  async function loadMonth() {
    setLoading(true);
    try {
      const [monthData, savedConcessionarias] = await Promise.all([
        getComparativoRedeAudiMonth(year, month),
        getComparativoRedeAudiConcessionarias(year, month),
      ]);
      setData(monthData);

      if (savedConcessionarias) {
        setConcessionarias(savedConcessionarias);
        setHasSavedConcessionarias(true);
      } else {
        const previous = previousPeriod(year, month);
        const previousConcessionarias = await getComparativoRedeAudiConcessionarias(previous.year, previous.month);
        setConcessionarias(previousConcessionarias ?? EMPTY_CONCESSIONARIAS);
        setHasSavedConcessionarias(false);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      setLoading(true);
      try {
        const latest = await getLatestComparativoRedeAudiMonth();
        if (cancelled) return;
        if (latest) {
          setYear(latest.year);
          setMonth(latest.month);
        }
        setActiveTab('demonstrativo');
        setInitialized(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (initialized) void loadMonth();
  }, [initialized, year, month]);

  async function importFile(file: File) {
    setLoading(true);
    try {
      const parsed = parseWorkbook(await file.arrayBuffer(), file.name, year, month);
      await setComparativoRedeAudiMonth(parsed);
      setData(parsed);
      setComparativoSheetIndex(0);
      setActiveSheet(0);
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
      await deleteComparativoRedeAudiMonth(year, month);
      await deleteComparativoRedeAudiConcessionarias(year, month);
      setData(null);
      setConcessionarias(EMPTY_CONCESSIONARIAS);
      setHasSavedConcessionarias(false);
      toast.success(`Dados de ${periodLabel} removidos.`);
    } finally {
      setLoading(false);
    }
  }

  async function saveConcessionarias() {
    setConcessionariasSaving(true);
    try {
      await setComparativoRedeAudiConcessionarias(year, month, concessionarias);
      setHasSavedConcessionarias(true);
      toast.success(`Números de concessionárias salvos para ${periodLabel}.`);
    } finally {
      setConcessionariasSaving(false);
    }
  }

  const availableSheets = useMemo(() => data?.sheets ?? [], [data]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="px-6 py-3 flex items-center justify-between shadow-md bg-[#c8102e]">
        <div>
          <h1 className="text-sm font-bold text-white">Comparativo Rede Audi</h1>
          <p className="text-xs text-red-100 mt-0.5">Demonstrativo de Resultados</p>
        </div>
        <button onClick={onChangeBrand} className="px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#a60d26] rounded">← Voltar</button>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <div className="flex border-b border-slate-200 bg-white rounded-t-lg">
          <button onClick={() => setActiveTab('importar')} className={`px-5 py-3 text-sm font-semibold border-b-2 ${activeTab === 'importar' ? 'border-[#c8102e] text-[#c8102e]' : 'border-transparent text-slate-500'}`}>
            <Upload className="inline w-4 h-4 mr-2" />Importar Dados
          </button>
          <button onClick={() => setActiveTab('dados')} className={`px-5 py-3 text-sm font-semibold border-b-2 ${activeTab === 'dados' ? 'border-[#c8102e] text-[#c8102e]' : 'border-transparent text-slate-500'}`}>
            Dados do Mês
          </button>
          <button onClick={() => setActiveTab('concessionarias')} className={`px-5 py-3 text-sm font-semibold border-b-2 ${activeTab === 'concessionarias' ? 'border-[#c8102e] text-[#c8102e]' : 'border-transparent text-slate-500'}`}>
            Número de Concessionárias
          </button>
          <button onClick={() => setActiveTab('comparativo')} className={`px-5 py-3 text-sm font-semibold border-b-2 ${activeTab === 'comparativo' ? 'border-[#c8102e] text-[#c8102e]' : 'border-transparent text-slate-500'}`}>
            Comparativo de Dados
          </button>
          <button onClick={() => setActiveTab('ajustado')} className={`px-5 py-3 text-sm font-semibold border-b-2 ${activeTab === 'ajustado' ? 'border-[#c8102e] text-[#c8102e]' : 'border-transparent text-slate-500'}`}>
            Comparativo Ajustado
          </button>
          <button onClick={() => setActiveTab('demonstrativo')} className={`px-5 py-3 text-sm font-semibold border-b-2 ${activeTab === 'demonstrativo' ? 'border-[#c8102e] text-[#c8102e]' : 'border-transparent text-slate-500'}`}>
            Demonstrativo
          </button>
        </div>

        <section className="bg-white rounded-b-lg shadow-sm p-4 md:p-6">
          <div className="flex flex-wrap items-end gap-3 mb-5">
            <label className="text-xs font-semibold text-slate-600">Ano<select value={year} onChange={event => setYear(Number(event.target.value))} className="block mt-1 border border-slate-300 rounded px-3 py-2 text-sm"><option value="">Selecione</option>{YEARS.map(item => <option key={item}>{item}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-600">Mês<select value={month} onChange={event => setMonth(Number(event.target.value))} className="block mt-1 border border-slate-300 rounded px-3 py-2 text-sm">{MONTHS.map((item, index) => <option key={item} value={index + 1}>{item}</option>)}</select></label>
            {(data || hasSavedConcessionarias) && <button onClick={() => setConfirmDelete(true)} className="ml-auto flex items-center gap-2 border border-red-300 text-red-600 rounded px-3 py-2 text-sm hover:bg-red-50"><Trash2 className="w-4 h-4" />Remover dados</button>}
          </div>

          {activeTab === 'concessionarias' ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Número de Concessionárias</h2>
                <p className="text-sm text-slate-500 mt-1">Informe quantas concessionárias compõem cada grupo e quantas restam ao excluir a Sorana Audi (AC Lapa). Os números foram copiados do mês anterior quando ainda não havia dados para {periodLabel}.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {GROUPS.map(group => (
                  <fieldset key={group.key} className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <legend className="px-2 text-sm font-bold text-[#c8102e]">{group.label}</legend>
                    <NumberField label={`Total de concessionárias (${group.label})`} value={concessionarias[group.totalField]} onChange={value => setConcessionarias(current => ({ ...current, [group.totalField]: value }))} />
                    <NumberField label="Total sem a Sorana" value={concessionarias[group.semField]} onChange={value => setConcessionarias(current => ({ ...current, [group.semField]: value }))} />
                  </fieldset>
                ))}
              </div>
              <div className="flex justify-end"><button onClick={() => void saveConcessionarias()} disabled={concessionariasSaving} className="bg-[#c8102e] text-white rounded px-4 py-2 text-sm font-semibold hover:bg-[#a60d26] disabled:opacity-50">{concessionariasSaving ? 'Salvando...' : 'Salvar números'}</button></div>
            </div>
          ) : activeTab === 'comparativo' ? (
            <ComparativoDados data={data} sheetIndex={comparativoSheetIndex} onSheetChange={setComparativoSheetIndex} />
          ) : activeTab === 'ajustado' ? (
            <ComparativoAjustado data={data} concessionarias={concessionarias} sheetIndex={comparativoSheetIndex} onSheetChange={setComparativoSheetIndex} />
          ) : activeTab === 'demonstrativo' ? (
            <DemonstrativoTab year={year} month={month} concessionarias={concessionarias} />
          ) : activeTab === 'importar' ? (
            <div className="space-y-5">
              <div className="border border-dashed border-red-300 bg-red-50 rounded-lg p-8 text-center">
                <FileSpreadsheet className="w-10 h-10 text-[#c8102e] mx-auto mb-3" />
                <h2 className="font-bold text-slate-800">Importar relatório Excel (Superflex)</h2>
                <p className="text-sm text-slate-500 mt-1">Selecione o relatório do Audi para {periodLabel}. As abas de comparação são identificadas automaticamente.</p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="mt-4 inline-flex items-center gap-2 bg-[#c8102e] text-white rounded px-4 py-2 text-sm font-semibold hover:bg-[#a60d26] disabled:opacity-50"><Upload className="w-4 h-4" />{loading ? 'Processando...' : 'Selecionar Excel'}</button>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                Grupos de comparação: <strong>AC Lapa (Sorana Audi)</strong>, {GROUPS.map(group => group.label).join(', ')}.
              </div>
              {data && <>
                <div className="grid gap-2 md:grid-cols-3">
                  {data.sheets.map(sheet => <div key={sheet.name} className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 className="w-4 h-4 text-[#c8102e]" />{sheet.name}</div>)}
                </div>
                <p className="text-xs text-slate-500">Arquivo atual: <strong>{data.fileName}</strong>, importado em {new Date(data.importedAt).toLocaleString('pt-BR')}.</p>
              </>}
            </div>
          ) : (
            <div>
              {!data ? <div className="py-16 text-center text-slate-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />Nenhum dado importado para {periodLabel}.</div> : <>
                <div className="flex gap-1 overflow-x-auto border-b border-slate-200 mb-4">{availableSheets.map((sheet, index) => <button key={sheet.name} onClick={() => setActiveSheet(index)} className={`whitespace-nowrap px-3 py-2 text-xs font-semibold border-b-2 ${activeSheet === index ? 'border-[#c8102e] text-[#c8102e]' : 'border-transparent text-slate-500'}`}>{sheet.name}</button>)}</div>
                <div className="overflow-auto max-h-[calc(100vh-290px)] border border-slate-200"><table className="min-w-max text-xs border-collapse"><tbody>{selectedSheet?.rows.map((row, rowIndex) => <tr key={rowIndex} className={rowIndex < 8 ? 'bg-red-50 font-semibold' : 'odd:bg-white even:bg-slate-50'}>{row.map((cell, columnIndex) => <td key={columnIndex} className="border border-slate-200 px-2 py-1 whitespace-nowrap text-right">{formatCell(cell)}</td>)}</tr>)}</tbody></table></div>
              </>}
            </div>
          )}
        </section>
      </main>

      {confirmReplace && <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4"><div className="bg-white rounded-lg p-6 max-w-md shadow-xl"><h2 className="font-bold text-slate-800">Substituir dados?</h2><p className="text-sm text-slate-600 mt-2">Já existem dados para {periodLabel}. A nova importação substituirá as abas atuais.</p><div className="flex justify-end gap-2 mt-5"><button onClick={() => { setConfirmReplace(false); setPendingFile(null); }} className="px-3 py-2 text-sm text-slate-600">Cancelar</button><button onClick={() => { setConfirmReplace(false); if (pendingFile) void importFile(pendingFile); }} className="px-3 py-2 text-sm bg-[#c8102e] text-white rounded">Substituir</button></div></div></div>}
      {confirmDelete && <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4"><div className="bg-white rounded-lg p-6 max-w-md shadow-xl"><h2 className="font-bold text-slate-800">Remover dados?</h2><p className="text-sm text-slate-600 mt-2">Os dados de {periodLabel} serão excluídos.</p><div className="flex justify-end gap-2 mt-5"><button onClick={() => setConfirmDelete(false)} className="px-3 py-2 text-sm text-slate-600">Cancelar</button><button onClick={() => void handleDelete()} className="px-3 py-2 text-sm bg-red-600 text-white rounded">Remover</button></div></div></div>}
    </div>
  );
}

interface ComparativoDadosProps {
  data: ComparativoRedeAudiMonthData | null;
  sheetIndex: number;
  onSheetChange: (index: number) => void;
}

function ComparativoDados({ data, sheetIndex, onSheetChange }: ComparativoDadosProps) {
  const selectedSheet = data?.sheets[sheetIndex];
  const rows = selectedSheet?.rows ?? [];
  const comparisonRows = rows.filter(isComparableRow);

  if (!data) {
    return <div className="py-16 text-center text-slate-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />Nenhum dado importado para comparação.</div>;
  }

  if (!selectedSheet) {
    return <div className="py-16 text-center text-slate-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />A aba selecionada não foi encontrada.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Comparativo de Dados</h2>
        <p className="text-sm text-slate-500 mt-1">Valores (R$) e % da Receita Líquida de cada grupo, exatamente como importados do relatório.</p>
      </div>
      <SheetTabs sheets={data.sheets} sheetIndex={sheetIndex} onSheetChange={onSheetChange} />
      <div className="overflow-auto max-h-[calc(100vh-320px)] border border-slate-200">
        <table className="min-w-[1280px] text-xs border-collapse">
          <thead className="sticky top-0 bg-[#c8102e] text-white">
            <tr>
              <th className="px-3 py-2 text-left whitespace-nowrap">Indicador</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">AC Lapa</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">AC Lapa % RL</th>
              {GROUPS.map(group => [
                <th key={`${group.key}-v`} className="px-3 py-2 text-right whitespace-nowrap">{group.label}</th>,
                <th key={`${group.key}-p`} className="px-3 py-2 text-right whitespace-nowrap">% RL</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row, index) => {
              const label = rowLabel(row);
              const acValue = numericCell(row[AC_LAPA.value]);
              const acPercent = numericCell(row[AC_LAPA.pct]);
              return (
                <tr key={`${label}-${index}`} className="odd:bg-white even:bg-slate-50">
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap font-medium">{label}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatValor(acValue)}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(acPercent, true)}</td>
                  {GROUPS.map(group => [
                    <td key={`${group.key}-v`} className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatValor(numericCell(row[group.value]))}</td>,
                    <td key={`${group.key}-p`} className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(numericCell(row[group.pct]), true)}</td>,
                  ])}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ComparativoAjustadoProps {
  data: ComparativoRedeAudiMonthData | null;
  concessionarias: ComparativoRedeAudiConcessionarias;
  sheetIndex: number;
  onSheetChange: (index: number) => void;
}

function ComparativoAjustado({ data, concessionarias, sheetIndex, onSheetChange }: ComparativoAjustadoProps) {
  const selectedSheet = data?.sheets[sheetIndex];
  const rows = selectedSheet?.rows ?? [];
  const comparisonRows = rows.filter(isComparableRow);

  const acReceitaLiquida = findReceitaLiquida(rows, AC_LAPA.value);
  const adjustedReceitaLiquida = new Map<GroupKey, number | null>(
    GROUPS.map(group => [group.key, adjustedAverage(findReceitaLiquida(rows, group.value), acReceitaLiquida, concessionarias[group.totalField], concessionarias[group.semField])]),
  );

  if (!data) {
    return <div className="py-16 text-center text-slate-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />Nenhum dado importado para o comparativo ajustado.</div>;
  }

  if (!selectedSheet) {
    return <div className="py-16 text-center text-slate-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />A aba selecionada não foi encontrada.</div>;
  }

  const anyValidCounts = GROUPS.some(group => concessionarias[group.totalField] > 1 && concessionarias[group.semField] > 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Comparativo Ajustado</h2>
        <p className="text-sm text-slate-500 mt-1">Cada grupo é recalculado sem a participação da Sorana Audi (AC Lapa), linha por linha, sobre valores absolutos.</p>
      </div>
      <SheetTabs sheets={data.sheets} sheetIndex={sheetIndex} onSheetChange={onSheetChange} />
      <div className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-[#a60d26]">
        Fórmula: (média do grupo × total de concessionárias − valor AC Lapa) ÷ total sem a Sorana. O % RL é recalculado sobre a Receita Líquida ajustada do grupo.
      </div>
      {!anyValidCounts && <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Informe o número de concessionárias (total {'>'} 1 e total sem Sorana {'>'} 0) na aba "Número de Concessionárias" para habilitar o cálculo ajustado.</div>}
      <div className="overflow-auto max-h-[calc(100vh-360px)] border border-slate-200">
        <table className="min-w-[1180px] text-xs border-collapse">
          <thead className="sticky top-0 bg-[#c8102e] text-white">
            <tr>
              <th className="px-3 py-2 text-left whitespace-nowrap">Indicador</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">AC Lapa</th>
              {GROUPS.map(group => [
                <th key={`${group.key}-v`} className="px-3 py-2 text-right whitespace-nowrap">{group.short} s/ Sorana</th>,
                <th key={`${group.key}-p`} className="px-3 py-2 text-right whitespace-nowrap">% RL</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row, index) => {
              const label = rowLabel(row);
              const hasPercent = rowHasPercent(row);
              const acValue = numericCell(row[AC_LAPA.value]);
              return (
                <tr key={`${label}-${index}`} className="odd:bg-white even:bg-slate-50">
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap font-medium">{label}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatValor(acValue)}</td>
                  {GROUPS.map(group => {
                    const adjusted = adjustedAverage(numericCell(row[group.value]), acValue, concessionarias[group.totalField], concessionarias[group.semField]);
                    const adjustedRL = adjustedReceitaLiquida.get(group.key) ?? null;
                    const adjustedPercent = hasPercent && adjusted !== null && adjustedRL ? adjusted / adjustedRL * 100 : null;
                    return [
                      <td key={`${group.key}-v`} className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatValor(adjusted)}</td>,
                      <td key={`${group.key}-p`} className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(adjustedPercent, true)}</td>,
                    ];
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SheetTabs({ sheets, sheetIndex, onSheetChange }: { sheets: ComparativoRedeAudiMonthData['sheets']; sheetIndex: number; onSheetChange: (index: number) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {sheets.map((sheet, index) => <button key={sheet.name} onClick={() => onSheetChange(index)} className={`whitespace-nowrap px-3 py-2 text-xs font-semibold border-b-2 ${sheetIndex === index ? 'border-[#c8102e] text-[#c8102e]' : 'border-transparent text-slate-500'}`}>{sheet.name}</button>)}
    </div>
  );
}

type DemonstrativoPeriodicity = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

interface DemonstrativoTabProps {
  year: number;
  month: number;
  concessionarias: ComparativoRedeAudiConcessionarias;
}

interface DemonstrativoRow {
  label: string;
  hasPercent: boolean;
  isCurrency: boolean;
  sorana: number | null;
  base: number | null;
  soranaPercent: number | null;
  basePercent: number | null;
}

function periodMonths(year: number, periodicity: DemonstrativoPeriodicity, periodNumber: number) {
  if (periodicity === 'mensal') return [{ year, month: periodNumber }];
  const size = periodicity === 'bimestral' ? 2 : periodicity === 'trimestral' ? 3 : periodicity === 'semestral' ? 6 : 12;
  const start = (periodNumber - 1) * size + 1;
  return Array.from({ length: size }, (_, index) => ({ year, month: start + index }));
}

function periodOptions(periodicity: DemonstrativoPeriodicity) {
  if (periodicity === 'mensal') return MONTHS.map((name, index) => ({ value: index + 1, label: name }));
  const size = periodicity === 'bimestral' ? 2 : periodicity === 'trimestral' ? 3 : periodicity === 'semestral' ? 6 : 12;
  const count = 12 / size;
  return Array.from({ length: count }, (_, index) => ({ value: index + 1, label: `${index + 1}º período` }));
}

function isExpense(label: string) {
  const normalized = normalizeName(label);
  return normalized.includes('despesa') || normalized.includes('juros') || normalized.includes('custo') || normalized.includes('imposto');
}

function DemonstrativoTab({ year, month, concessionarias }: DemonstrativoTabProps) {
  const [periodicity, setPeriodicity] = useState<DemonstrativoPeriodicity>('mensal');
  const [periodNumber, setPeriodNumber] = useState(month);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [comparisonBase, setComparisonBase] = useState<GroupKey>('mediaNacional');
  const [sections, setSections] = useState<string[]>([]);
  const [rows, setRows] = useState<DemonstrativoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const options = periodOptions(periodicity);
  const baseGroup = GROUPS.find(group => group.key === comparisonBase) as GroupDef;

  useEffect(() => {
    if (periodicity === 'mensal') setPeriodNumber(month);
    else setPeriodNumber(1);
  }, [month, periodicity]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const periods = periodMonths(year, periodicity, periodNumber);
      const loaded = await Promise.all(periods.map(async period => ({
        data: await getComparativoRedeAudiMonth(period.year, period.month),
        concessionarias: await getComparativoRedeAudiConcessionarias(period.year, period.month),
      })));
      if (cancelled) return;

      const sectionNames = loaded.find(entry => entry.data)?.data?.sheets.map(sheet => sheet.name) ?? [];
      const effectiveSection = Math.min(sectionIndex, Math.max(0, sectionNames.length - 1));

      const monthlyRows = loaded.flatMap(({ data: monthData, concessionarias: monthlyCounts }) => {
        const sheet = monthData?.sheets[effectiveSection];
        const values = sheet?.rows ?? [];
        const counts = monthlyCounts ?? concessionarias;
        return values.filter(isComparableRow).map(row => {
          const label = rowLabel(row);
          const hasPercent = rowHasPercent(row);
          const sorana = numericCell(row[AC_LAPA.value]);
          const base = adjustedAverage(numericCell(row[baseGroup.value]), sorana, counts[baseGroup.totalField], counts[baseGroup.semField]);
          return { label, hasPercent, isCurrency: hasPercent, sorana, base } as { label: string; hasPercent: boolean; isCurrency: boolean; sorana: number | null; base: number | null };
        });
      });

      const grouped = new Map<string, Array<{ label: string; hasPercent: boolean; isCurrency: boolean; sorana: number | null; base: number | null }>>();
      monthlyRows.forEach(row => {
        const group = grouped.get(row.label) ?? [];
        group.push(row);
        grouped.set(row.label, group);
      });

      const consolidated = Array.from(grouped.values()).map(group => {
        const first = group[0];
        const sum = (field: 'sorana' | 'base') => group.reduce<number | null>((total, row) => total === null || row[field] === null ? total : total + (row[field] as number), 0);
        const last = (field: 'sorana' | 'base') => group[group.length - 1][field];
        const sorana = first.isCurrency ? sum('sorana') : last('sorana');
        const base = first.isCurrency ? sum('base') : last('base');
        return { label: first.label, hasPercent: first.hasPercent, isCurrency: first.isCurrency, sorana, base };
      });

      const soranaRL = consolidated.find(row => { const n = normalizeName(row.label); return n.startsWith('total') && n.includes('receitaliquida'); })?.sorana ?? null;
      const baseRL = consolidated.find(row => { const n = normalizeName(row.label); return n.startsWith('total') && n.includes('receitaliquida'); })?.base ?? null;

      if (cancelled) return;
      setSections(sectionNames);
      setRows(consolidated.map(row => ({
        ...row,
        soranaPercent: row.hasPercent && soranaRL ? (row.sorana ?? 0) / soranaRL * 100 : null,
        basePercent: row.hasPercent && baseRL ? (row.base ?? 0) / baseRL * 100 : null,
      })));
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [year, periodicity, periodNumber, sectionIndex, comparisonBase, concessionarias, baseGroup]);

  const summaryCards = [
    { title: 'Lucro Bruto', match: (label: string) => label.includes('lucrobruto') && !label.includes('oreceitas') },
    { title: 'Margem de Contribuição I', match: (label: string) => label.includes('margemcontribuicaoi') },
    { title: 'Lucro Operacional', match: (label: string) => label.includes('lucrooperacional') },
    { title: 'Lucro antes do IR (LAIR)', match: (label: string) => label.includes('lair') },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Demonstrativo</h2>
        <p className="text-sm text-slate-500 mt-1">Resultados consolidados com base no Comparativo Ajustado: grupo selecionado recalculado sem a Sorana Audi.</p>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold text-slate-600">Periodicidade<select value={periodicity} onChange={event => setPeriodicity(event.target.value as DemonstrativoPeriodicity)} className="block mt-1 border border-slate-300 rounded px-3 py-2 text-sm"><option value="mensal">Mensal</option><option value="bimestral">Bimestral</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option></select></label>
        <label className="text-xs font-semibold text-slate-600">Período<select value={periodNumber} onChange={event => setPeriodNumber(Number(event.target.value))} className="block mt-1 border border-slate-300 rounded px-3 py-2 text-sm">{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <div className="text-xs font-semibold text-slate-600">Comparar com<div className="mt-1 inline-flex rounded border border-slate-300 overflow-hidden">{GROUPS.map(group => <button key={group.key} onClick={() => setComparisonBase(group.key)} className={`px-3 py-2 text-sm font-semibold ${comparisonBase === group.key ? 'bg-[#c8102e] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{group.short}</button>)}</div></div>
      </div>
      {sections.length > 0 && <div className="flex gap-1 overflow-x-auto border-b border-slate-200">{sections.map((name, index) => <button key={name} onClick={() => setSectionIndex(index)} className={`whitespace-nowrap px-3 py-2 text-xs font-semibold border-b-2 ${sectionIndex === index ? 'border-[#c8102e] text-[#c8102e]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{name}</button>)}</div>}
      {loading ? <div className="py-12 text-center text-slate-500">Calculando demonstrativo...</div> : rows.length === 0 ? <div className="py-12 text-center text-slate-500">Não há dados para o período selecionado.</div> : <>
        <div className="grid gap-3 md:grid-cols-4">
          {summaryCards.map(card => {
            const row = rows.find(item => card.match(normalizeName(item.label)));
            if (!row) return null;
            return <div key={card.title} className="rounded-lg border border-red-100 bg-red-50 px-4 py-3"><p className="text-xs text-slate-500">{card.title}</p><p className="mt-1 text-sm font-bold text-[#a60d26]">AC Lapa: {formatValor(row.sorana)}{row.soranaPercent != null ? ` (${formatNumber(row.soranaPercent, true)})` : ''}</p><p className="text-xs text-slate-600">{baseGroup.label}: {formatValor(row.base)}{row.basePercent != null ? ` (${formatNumber(row.basePercent, true)})` : ''}</p></div>;
          })}
        </div>
        <div className="overflow-x-auto border border-slate-200"><table className="min-w-[820px] w-full text-xs border-collapse"><thead className="sticky top-0 bg-[#c8102e] text-white"><tr>{['Indicador', 'AC Lapa', 'AC Lapa %', `${baseGroup.label} sem Sorana`, `${baseGroup.short} %`, `Dif. x ${baseGroup.short}`].map(header => <th key={header} className="px-3 py-2 text-left whitespace-nowrap">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <DemonstrativoTableRow key={`${row.label}-${index}`} row={row} />)}</tbody></table></div>
      </>}
    </div>
  );
}

function DemonstrativoTableRow({ row }: { row: DemonstrativoRow }) {
  const differenceBase = difference(row.sorana, row.base);
  const favorable = (value: number | null) => value === null ? '' : (isExpense(row.label) ? value <= 0 : value >= 0) ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50';
  const normalizedLabel = normalizeName(row.label);
  const isClosingResult = normalizedLabel.includes('lair') || normalizedLabel.includes('resultadoliquidodoexercicio');
  const isPrimaryResult = (normalizedLabel.includes('lucrobruto') && !normalizedLabel.includes('oreceitas')) || normalizedLabel.includes('lucrooperacional') || normalizedLabel.includes('ebitda');
  const isIntermediateMargin = normalizedLabel.includes('margemcontribuicao');
  const isFinancial = normalizedLabel.includes('resultadofinanceiro') || normalizedLabel.includes('totalgeraldejuros');
  const rowClass = isClosingResult
    ? 'bg-emerald-100 font-bold border-t-2 border-emerald-600'
    : isPrimaryResult
      ? 'bg-emerald-50 font-semibold border-t border-emerald-200'
      : isIntermediateMargin
        ? 'bg-sky-50 font-semibold border-t border-sky-200'
        : isFinancial
          ? 'bg-amber-50 font-semibold border-t border-amber-200'
          : 'odd:bg-white even:bg-slate-50';
  const formatValue = (value: number | null) => row.isCurrency ? formatValor(value) : formatNumber(value);
  return <tr className={rowClass}><td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap font-medium">{row.label}</td><td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatValue(row.sorana)}</td><td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(row.soranaPercent, true)}</td><td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatValue(row.base)}</td><td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(row.basePercent, true)}</td><td className={`border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap ${favorable(differenceBase)}`}>{formatValue(differenceBase)}</td></tr>;
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function NumberField({ label, value, onChange }: NumberFieldProps) {
  return (
    <label className="block text-sm text-slate-600">
      {label}
      <input type="number" min="0" step="1" value={value} onChange={event => onChange(Math.max(0, Number(event.target.value)))} className="mt-1 block w-full border border-slate-300 rounded px-3 py-2 text-sm" />
    </label>
  );
}
