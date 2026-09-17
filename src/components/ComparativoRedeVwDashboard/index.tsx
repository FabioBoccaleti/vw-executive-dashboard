import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Trash2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteComparativoRedeVwMonth,
  deleteComparativoRedeVwConcessionarias,
  getComparativoRedeVwMonth,
  getComparativoRedeVwConcessionarias,
  setComparativoRedeVwMonth,
  setComparativoRedeVwConcessionarias,
  type ComparativoRedeVwConcessionarias,
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
const EMPTY_CONCESSIONARIAS: ComparativoRedeVwConcessionarias = {
  regiaoTotal: 0,
  regiaoSemSorana: 0,
  sateliteTotal: 0,
  sateliteSemSorana: 0,
};

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(value);
  return String(value);
}

function previousPeriod(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function numericCell(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isVendasLiquidas(label: string) {
  return normalizeName(label).includes('vendasliquidas');
}

function isPercentageUnit(unit: string) {
  return normalizeName(unit).includes('s/vl') || unit.includes('%');
}

function formatNumber(value: number | null, isPercent = false) {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)}${isPercent ? '%' : ''}`;
}

function difference(value: number | null, reference: number | null) {
  return value === null || reference === null ? null : value - reference;
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
  const [activeTab, setActiveTab] = useState<'importar' | 'dados' | 'concessionarias' | 'comparativo'>('importar');
  const [comparativoSheetIndex, setComparativoSheetIndex] = useState(1);
  const [concessionarias, setConcessionarias] = useState<ComparativoRedeVwConcessionarias>(EMPTY_CONCESSIONARIAS);
  const [hasSavedConcessionarias, setHasSavedConcessionarias] = useState(false);
  const [concessionariasSaving, setConcessionariasSaving] = useState(false);
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
      const [monthData, savedConcessionarias] = await Promise.all([
        getComparativoRedeVwMonth(year, month),
        getComparativoRedeVwConcessionarias(year, month),
      ]);
      setData(monthData);

      if (savedConcessionarias) {
        setConcessionarias(savedConcessionarias);
        setHasSavedConcessionarias(true);
      } else {
        const previous = previousPeriod(year, month);
        const previousConcessionarias = await getComparativoRedeVwConcessionarias(previous.year, previous.month);
        setConcessionarias(previousConcessionarias ?? EMPTY_CONCESSIONARIAS);
        setHasSavedConcessionarias(false);
      }
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
      await deleteComparativoRedeVwConcessionarias(year, month);
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
      await setComparativoRedeVwConcessionarias(year, month, concessionarias);
      setHasSavedConcessionarias(true);
      toast.success(`Números de concessionárias salvos para ${periodLabel}.`);
    } finally {
      setConcessionariasSaving(false);
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
          <button onClick={() => setActiveTab('concessionarias')} className={`px-5 py-3 text-sm font-semibold border-b-2 ${activeTab === 'concessionarias' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}>
            Número de Concessionárias
          </button>
          <button onClick={() => setActiveTab('comparativo')} className={`px-5 py-3 text-sm font-semibold border-b-2 ${activeTab === 'comparativo' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}>
            Comparativo de Dados
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
                <p className="text-sm text-slate-500 mt-1">Os números foram copiados automaticamente do mês anterior quando ainda não havia dados para {periodLabel}.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <fieldset className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <legend className="px-2 text-sm font-bold text-teal-700">Região</legend>
                  <NumberField label="Total de concessionárias da região" value={concessionarias.regiaoTotal} onChange={value => setConcessionarias(current => ({ ...current, regiaoTotal: value }))} />
                  <NumberField label="Total da região sem a Sorana" value={concessionarias.regiaoSemSorana} onChange={value => setConcessionarias(current => ({ ...current, regiaoSemSorana: value }))} />
                </fieldset>
                <fieldset className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <legend className="px-2 text-sm font-bold text-teal-700">Satélite</legend>
                  <NumberField label="Total de concessionárias do satélite" value={concessionarias.sateliteTotal} onChange={value => setConcessionarias(current => ({ ...current, sateliteTotal: value }))} />
                  <NumberField label="Total do satélite sem a Sorana" value={concessionarias.sateliteSemSorana} onChange={value => setConcessionarias(current => ({ ...current, sateliteSemSorana: value }))} />
                </fieldset>
              </div>
              <div className="flex justify-end"><button onClick={() => void saveConcessionarias()} disabled={concessionariasSaving} className="bg-teal-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">{concessionariasSaving ? 'Salvando...' : 'Salvar números'}</button></div>
            </div>
          ) : activeTab === 'comparativo' ? (
            <ComparativoDados data={data} sheetIndex={comparativoSheetIndex} onSheetChange={setComparativoSheetIndex} />
          ) : activeTab === 'importar' ? (
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

interface ComparativoDadosProps {
  data: ComparativoRedeVwMonthData | null;
  sheetIndex: number;
  onSheetChange: (index: number) => void;
}

function ComparativoDados({ data, sheetIndex, onSheetChange }: ComparativoDadosProps) {
  const selectedSheet = data?.sheets[sheetIndex];
  const rows = selectedSheet?.rows ?? [];
  const vendasLiquidasRow = rows.find(row => isVendasLiquidas(String(row[0] ?? '')));
  const bases = {
    sorana: numericCell(vendasLiquidasRow?.[2]),
    satelite: numericCell(vendasLiquidasRow?.[3]),
    regiao: numericCell(vendasLiquidasRow?.[5]),
  };
  const comparisonRows = rows.filter(row => {
    const label = String(row[0] ?? '').trim();
    const unit = String(row[1] ?? '').trim();
    return Boolean(label && unit && (numericCell(row[2]) !== null || numericCell(row[3]) !== null || numericCell(row[5]) !== null));
  });

  if (!data) {
    return <div className="py-16 text-center text-slate-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />Nenhum dado importado para comparação.</div>;
  }

  if (!selectedSheet || !vendasLiquidasRow) {
    return <div className="py-16 text-center text-slate-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />A aba selecionada ou a linha Vendas Líquidas não foi encontrada.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Comparativo de Dados</h2>
        <p className="text-sm text-slate-500 mt-1">Os valores originais permanecem preservados; linhas `% s/ VL` também mostram o valor absoluto calculado sobre Vendas Líquidas.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">{data.sheets.map((sheet, index) => <button key={sheet.name} onClick={() => onSheetChange(index)} className={`whitespace-nowrap px-3 py-2 text-xs font-semibold border-b-2 ${sheetIndex === index ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}>{sheet.name}</button>)}</div>
      <div className="grid gap-3 md:grid-cols-3">
        <BaseCard label="Vendas Líquidas - Sorana" value={bases.sorana} />
        <BaseCard label="Vendas Líquidas - Satélite" value={bases.satelite} />
        <BaseCard label="Vendas Líquidas - Região" value={bases.regiao} />
      </div>
      <div className="overflow-auto max-h-[calc(100vh-330px)] border border-slate-200">
        <table className="min-w-[1180px] text-xs border-collapse">
          <thead className="sticky top-0 bg-teal-700 text-white">
            <tr>
              {['Indicador', 'Unidade', 'Sorana original', 'Sorana em valor', 'Satélite original', 'Satélite em valor', 'Região original', 'Região em valor', 'Dif. Sorana x Satélite', 'Dif. Sorana x Região'].map(header => <th key={header} className="px-3 py-2 text-left whitespace-nowrap">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row, index) => {
              const label = String(row[0]);
              const unit = String(row[1]);
              const percentage = isPercentageUnit(unit);
              const sorana = numericCell(row[2]);
              const satelite = numericCell(row[3]);
              const regiao = numericCell(row[5]);
              const soranaValue = percentage && bases.sorana !== null && sorana !== null ? sorana / 100 * bases.sorana : null;
              const sateliteValue = percentage && bases.satelite !== null && satelite !== null ? satelite / 100 * bases.satelite : null;
              const regiaoValue = percentage && bases.regiao !== null && regiao !== null ? regiao / 100 * bases.regiao : null;
              const comparableSorana = percentage ? soranaValue : sorana;
              const comparableSatelite = percentage ? sateliteValue : satelite;
              const comparableRegiao = percentage ? regiaoValue : regiao;
              return (
                <tr key={`${label}-${index}`} className="odd:bg-white even:bg-slate-50">
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap font-medium">{label}</td>
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">{unit}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(sorana, percentage)}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{percentage ? formatNumber(soranaValue) : '—'}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(satelite, percentage)}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{percentage ? formatNumber(sateliteValue) : '—'}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(regiao, percentage)}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{percentage ? formatNumber(regiaoValue) : '—'}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(difference(comparableSorana, comparableSatelite))}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(difference(comparableSorana, comparableRegiao))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BaseCard({ label, value }: { label: string; value: number | null }) {
  return <div className="rounded-lg border border-teal-100 bg-teal-50 px-4 py-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-teal-800">{formatNumber(value)}</p></div>;
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
