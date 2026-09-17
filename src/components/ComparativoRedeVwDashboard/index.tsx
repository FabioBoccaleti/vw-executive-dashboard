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

function formatDemonstrativoValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(value));
}

function difference(value: number | null, reference: number | null) {
  return value === null || reference === null ? null : value - reference;
}

function adjustedAverage(average: number | null, sorana: number | null, total: number, totalWithoutSorana: number) {
  if (average === null || sorana === null || total <= 0 || totalWithoutSorana <= 0) return null;
  return (average * total - sorana) / totalWithoutSorana;
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
  const [activeTab, setActiveTab] = useState<'importar' | 'dados' | 'concessionarias' | 'comparativo' | 'ajustado' | 'demonstrativo'>('importar');
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
          <button onClick={() => setActiveTab('ajustado')} className={`px-5 py-3 text-sm font-semibold border-b-2 ${activeTab === 'ajustado' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}>
            Comparativo Ajustado
          </button>
          <button onClick={() => setActiveTab('demonstrativo')} className={`px-5 py-3 text-sm font-semibold border-b-2 ${activeTab === 'demonstrativo' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}>
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
          ) : activeTab === 'ajustado' ? (
            <ComparativoAjustado data={data} concessionarias={concessionarias} sheetIndex={comparativoSheetIndex} onSheetChange={setComparativoSheetIndex} />
          ) : activeTab === 'demonstrativo' ? (
            <DemonstrativoTab year={year} month={month} concessionarias={concessionarias} />
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

  if (!selectedSheet) {
    return <div className="py-16 text-center text-slate-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />A aba selecionada não foi encontrada.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Comparativo de Dados</h2>
        <p className="text-sm text-slate-500 mt-1">Os valores originais permanecem preservados; linhas `% s/ VL` também mostram o valor absoluto calculado sobre Vendas Líquidas.</p>
        {!vendasLiquidasRow && <p className="mt-2 text-xs text-amber-700">Esta seção não possui uma linha de Vendas Líquidas; os valores originais continuam disponíveis e os cálculos dependentes dessa base ficam indisponíveis.</p>}
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

interface ComparativoAjustadoProps {
  data: ComparativoRedeVwMonthData | null;
  concessionarias: ComparativoRedeVwConcessionarias;
  sheetIndex: number;
  onSheetChange: (index: number) => void;
}

function ComparativoAjustado({ data, concessionarias, sheetIndex, onSheetChange }: ComparativoAjustadoProps) {
  const selectedSheet = data?.sheets[sheetIndex];
  const rows = selectedSheet?.rows ?? [];
  const usesVendasLiquidasBase = sheetIndex !== 0;
  const vendasLiquidasRow = rows.find(row => isVendasLiquidas(String(row[0] ?? '')));
  const vendasLiquidas = {
    sorana: numericCell(vendasLiquidasRow?.[2]),
    satelite: numericCell(vendasLiquidasRow?.[3]),
    regiao: numericCell(vendasLiquidasRow?.[5]),
  };
  const adjustedVendasLiquidas = {
    satelite: adjustedAverage(vendasLiquidas.satelite, vendasLiquidas.sorana, concessionarias.sateliteTotal, concessionarias.sateliteSemSorana),
    regiao: adjustedAverage(vendasLiquidas.regiao, vendasLiquidas.sorana, concessionarias.regiaoTotal, concessionarias.regiaoSemSorana),
  };
  const comparisonRows = rows.filter(row => {
    const label = String(row[0] ?? '').trim();
    const unit = String(row[1] ?? '').trim();
    return Boolean(label && unit && (numericCell(row[2]) !== null || numericCell(row[3]) !== null || numericCell(row[5]) !== null));
  });
  const validCounts = concessionarias.sateliteTotal > 1 && concessionarias.sateliteSemSorana > 0 && concessionarias.regiaoTotal > 1 && concessionarias.regiaoSemSorana > 0;

  if (!data) {
    return <div className="py-16 text-center text-slate-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />Nenhum dado importado para o comparativo ajustado.</div>;
  }

  if (!selectedSheet) {
    return <div className="py-16 text-center text-slate-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />A aba selecionada não foi encontrada.</div>;
  }

  if (!validCounts) {
    return <div className="py-16 text-center text-slate-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" /><p>Informe números de concessionárias válidos antes de calcular.</p><p className="text-xs mt-1">Os totais devem ser maiores que 1 e os totais sem Sorana devem ser maiores que zero.</p></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Comparativo Ajustado</h2>
        <p className="text-sm text-slate-500 mt-1">Região e Satélite recalculados sem a participação da Sorana. O cálculo é feito linha por linha sobre valores absolutos.</p>
        <p className="text-xs text-teal-700 mt-1">{usesVendasLiquidasBase ? 'Esta seção converte percentuais usando Vendas Líquidas antes do ajuste.' : 'Esta seção usa diretamente os valores originais, sem base de Vendas Líquidas.'}</p>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">{data.sheets.map((sheet, index) => <button key={sheet.name} onClick={() => onSheetChange(index)} className={`whitespace-nowrap px-3 py-2 text-xs font-semibold border-b-2 ${sheetIndex === index ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}>{sheet.name}</button>)}</div>
      <div className="grid gap-3 md:grid-cols-3">
        {usesVendasLiquidasBase ? <>
          <BaseCard label="Sorana - Vendas Líquidas" value={vendasLiquidas.sorana} />
          <BaseCard label="Região sem Sorana - Vendas Líquidas" value={adjustedVendasLiquidas.regiao} />
          <BaseCard label="Satélite sem Sorana - Vendas Líquidas" value={adjustedVendasLiquidas.satelite} />
        </> : <div className="md:col-span-3 rounded border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">Indicadores Econômico-Financeiros: ajuste direto da média, sem cálculo sobre Vendas Líquidas.</div>}
      </div>
      <div className="rounded border border-teal-100 bg-teal-50 px-3 py-2 text-xs text-teal-800">
        Fórmula: (média original × total de concessionárias - valor Sorana) ÷ total sem Sorana.
      </div>
      <div className="overflow-auto max-h-[calc(100vh-360px)] border border-slate-200">
        <table className="min-w-[1080px] text-xs border-collapse">
          <thead className="sticky top-0 bg-teal-700 text-white">
            <tr>{['Indicador', 'Unidade', 'Sorana', 'Região sem Sorana', 'Região % s/ VL', 'Satélite sem Sorana', 'Satélite % s/ VL'].map(header => <th key={header} className="px-3 py-2 text-left whitespace-nowrap">{header}</th>)}</tr>
          </thead>
          <tbody>
            {comparisonRows.map((row, index) => {
              const label = String(row[0]);
              const unit = String(row[1]);
              const percentage = isPercentageUnit(unit);
              const sorana = numericCell(row[2]);
              const satelite = numericCell(row[3]);
              const regiao = numericCell(row[5]);
              const soranaValue = usesVendasLiquidasBase && percentage && vendasLiquidas.sorana !== null && sorana !== null ? sorana / 100 * vendasLiquidas.sorana : sorana;
              const sateliteValue = usesVendasLiquidasBase && percentage && vendasLiquidas.satelite !== null && satelite !== null ? satelite / 100 * vendasLiquidas.satelite : satelite;
              const regiaoValue = usesVendasLiquidasBase && percentage && vendasLiquidas.regiao !== null && regiao !== null ? regiao / 100 * vendasLiquidas.regiao : regiao;
              const adjustedRegiao = adjustedAverage(regiaoValue, soranaValue, concessionarias.regiaoTotal, concessionarias.regiaoSemSorana);
              const adjustedSatelite = adjustedAverage(sateliteValue, soranaValue, concessionarias.sateliteTotal, concessionarias.sateliteSemSorana);
              const adjustedRegiaoPercent = usesVendasLiquidasBase && percentage && adjustedVendasLiquidas.regiao ? (adjustedRegiao ?? 0) / adjustedVendasLiquidas.regiao * 100 : null;
              const adjustedSatelitePercent = usesVendasLiquidasBase && percentage && adjustedVendasLiquidas.satelite ? (adjustedSatelite ?? 0) / adjustedVendasLiquidas.satelite * 100 : null;
              return (
                <tr key={`${label}-${index}`} className="odd:bg-white even:bg-slate-50">
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap font-medium">{label}</td>
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">{unit}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(soranaValue)}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(adjustedRegiao)}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(adjustedRegiaoPercent, true)}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(adjustedSatelite)}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(adjustedSatelitePercent, true)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type DemonstrativoPeriodicity = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

interface DemonstrativoTabProps {
  year: number;
  month: number;
  concessionarias: ComparativoRedeVwConcessionarias;
}

interface DemonstrativoRow {
  label: string;
  unit: string;
  sorana: number | null;
  regiao: number | null;
  satelite: number | null;
  soranaPercent: number | null;
  regiaoPercent: number | null;
  satelitePercent: number | null;
}

const DEMONSTRATIVO_SECTIONS = EXPECTED_SHEETS.slice(1).map((name, index) => ({ name, sheetIndex: index + 1 }));

function periodMonths(year: number, month: number, periodicity: DemonstrativoPeriodicity, periodNumber: number) {
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

function isLastMonthValue(label: string) {
  const normalized = normalizeName(label);
  return normalized.includes('funcionario') || normalized.includes('vendedor') || normalized.includes('estoque') || normalized.includes('diasdeestoque');
}

function isExpense(label: string) {
  return normalizeName(label).includes('despesa') || normalizeName(label).includes('juros');
}

function DemonstrativoTab({ year, month, concessionarias }: DemonstrativoTabProps) {
  const [periodicity, setPeriodicity] = useState<DemonstrativoPeriodicity>('mensal');
  const [periodNumber, setPeriodNumber] = useState(month);
  const [sectionIndex, setSectionIndex] = useState(1);
  const [rows, setRows] = useState<DemonstrativoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const options = periodOptions(periodicity);

  useEffect(() => {
    if (periodicity === 'mensal') setPeriodNumber(month);
    else setPeriodNumber(1);
  }, [month, periodicity]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const periods = periodMonths(year, month, periodicity, periodNumber);
      const loaded = await Promise.all(periods.map(async period => ({
        data: await getComparativoRedeVwMonth(period.year, period.month),
        concessionarias: await getComparativoRedeVwConcessionarias(period.year, period.month),
      })));
      if (cancelled) return;
      const monthlyRows = loaded.flatMap(({ data: monthData, concessionarias: monthlyCounts }) => {
        const sheet = monthData?.sheets[sectionIndex];
        const values = sheet?.rows ?? [];
        const salesRow = values.find(row => isVendasLiquidas(String(row[0] ?? '')));
        const sales = {
          sorana: numericCell(salesRow?.[2]),
          satelite: numericCell(salesRow?.[3]),
          regiao: numericCell(salesRow?.[5]),
        };
        return values.filter(row => String(row[0] ?? '').trim() && String(row[1] ?? '').trim()).map(row => {
          const label = String(row[0]);
          const unit = String(row[1]);
          const percentage = isPercentageUnit(unit);
          const soranaOriginal = numericCell(row[2]);
          const sateliteOriginal = numericCell(row[3]);
          const regiaoOriginal = numericCell(row[5]);
          const soranaValue = percentage && sales.sorana !== null && soranaOriginal !== null ? soranaOriginal / 100 * sales.sorana : soranaOriginal;
          const sateliteValue = percentage && sales.satelite !== null && sateliteOriginal !== null ? sateliteOriginal / 100 * sales.satelite : sateliteOriginal;
          const regiaoValue = percentage && sales.regiao !== null && regiaoOriginal !== null ? regiaoOriginal / 100 * sales.regiao : regiaoOriginal;
          return {
            label,
            unit,
            sorana: soranaValue,
            satelite: adjustedAverage(sateliteValue, soranaValue, monthlyCounts?.sateliteTotal ?? concessionarias.sateliteTotal, monthlyCounts?.sateliteSemSorana ?? concessionarias.sateliteSemSorana),
            regiao: adjustedAverage(regiaoValue, soranaValue, monthlyCounts?.regiaoTotal ?? concessionarias.regiaoTotal, monthlyCounts?.regiaoSemSorana ?? concessionarias.regiaoSemSorana),
            soranaPercent: percentage ? soranaOriginal : null,
            satelitePercent: percentage ? sateliteOriginal : null,
            regiaoPercent: percentage ? regiaoOriginal : null,
          } as DemonstrativoRow;
        });
      });
      const grouped = new Map<string, DemonstrativoRow[]>();
      monthlyRows.forEach(row => {
        const key = `${row.label}\u0000${row.unit}`;
        const group = grouped.get(key) ?? [];
        group.push(row);
        grouped.set(key, group);
      });
      const periodCount = periods.length;
      const consolidated = Array.from(grouped.values()).map(group => {
        const first = group[0];
        const lastValue = (field: 'sorana' | 'regiao' | 'satelite') => group[group.length - 1][field];
        const aggregate = (field: 'sorana' | 'regiao' | 'satelite') => group.reduce<number | null>((total, row) => total === null || row[field] === null ? total : total + (row[field] as number), 0);
        const useLast = first.unit.toUpperCase().includes('QT') && isLastMonthValue(first.label);
        const sorana = useLast ? lastValue('sorana') : aggregate('sorana');
        const regiao = useLast ? lastValue('regiao') : aggregate('regiao');
        const satelite = useLast ? lastValue('satelite') : aggregate('satelite');
        return { ...first, sorana, regiao, satelite, soranaPercent: null, regiaoPercent: null, satelitePercent: null, periodCount };
      });
      const sales = consolidated.find(row => isVendasLiquidas(row.label));
      setRows(consolidated.map(row => ({
        ...row,
        soranaPercent: row.unit.includes('%') && sales?.sorana ? (row.sorana ?? 0) / sales.sorana * 100 : null,
        regiaoPercent: row.unit.includes('%') && sales?.regiao ? (row.regiao ?? 0) / sales.regiao * 100 : null,
        satelitePercent: row.unit.includes('%') && sales?.satelite ? (row.satelite ?? 0) / sales.satelite * 100 : null,
      })));
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [year, month, periodicity, periodNumber, sectionIndex, concessionarias]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Demonstrativo</h2>
        <p className="text-sm text-slate-500 mt-1">Resultados com base no Comparativo Ajustado: Região e Satélite sem a Sorana.</p>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold text-slate-600">Periodicidade<select value={periodicity} onChange={event => setPeriodicity(event.target.value as DemonstrativoPeriodicity)} className="block mt-1 border border-slate-300 rounded px-3 py-2 text-sm"><option value="mensal">Mensal</option><option value="bimestral">Bimestral</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option></select></label>
        <label className="text-xs font-semibold text-slate-600">Período<select value={periodNumber} onChange={event => setPeriodNumber(Number(event.target.value))} className="block mt-1 border border-slate-300 rounded px-3 py-2 text-sm">{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">{DEMONSTRATIVO_SECTIONS.map(section => <button key={section.sheetIndex} onClick={() => setSectionIndex(section.sheetIndex)} className={`whitespace-nowrap px-3 py-2 text-xs font-semibold border-b-2 ${sectionIndex === section.sheetIndex ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{section.name}</button>)}</div>
      {loading ? <div className="py-12 text-center text-slate-500">Calculando demonstrativo...</div> : rows.length === 0 ? <div className="py-12 text-center text-slate-500">Não há dados ajustados para o período selecionado.</div> : <>
        <div className="grid gap-3 md:grid-cols-3">{['Lucro Bruto', 'Margem de Contribuição', 'Lucro Operacional VW'].map(indicator => { const row = rows.find(item => normalizeName(item.label).includes(normalizeName(indicator))); return <div key={indicator} className="rounded-lg border border-teal-100 bg-teal-50 px-4 py-3"><p className="text-xs text-slate-500">{indicator}</p><p className="mt-1 text-sm font-bold text-teal-800">Sorana: {formatDemonstrativoValue(row?.sorana ?? null)}</p><p className="text-xs text-slate-600">Satélite: {formatDemonstrativoValue(row?.satelite ?? null)} | Região: {formatDemonstrativoValue(row?.regiao ?? null)}</p></div>; })}</div>
        <div className="overflow-x-auto border border-slate-200"><table className="min-w-[1180px] w-full text-xs border-collapse"><thead className="sticky top-0 bg-teal-700 text-white"><tr>{['Indicador', 'Unidade', 'Sorana', 'Sorana %', 'Satélite sem Sorana', 'Satélite %', 'Dif. x Satélite', 'Região sem Sorana', 'Região %', 'Dif. x Região'].map(header => <th key={header} className="px-3 py-2 text-left whitespace-nowrap">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <DemonstrativoTableRow key={`${row.label}-${index}`} row={row} />)}</tbody></table></div>
      </>}
    </div>
  );
}

function DemonstrativoTableRow({ row }: { row: DemonstrativoRow }) {
  const differenceRegion = difference(row.sorana, row.regiao);
  const differenceSatelite = difference(row.sorana, row.satelite);
  const favorable = (value: number | null) => value === null ? '' : (isExpense(row.label) ? value <= 0 : value >= 0) ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50';
  const normalizedLabel = normalizeName(row.label);
  const isFinancial = normalizedLabel.includes('rendasfinanceiras');
  const isFinancialExpense = normalizedLabel.includes('despesasfinanceiras');
  const isClosingResult = normalizedLabel.includes('lai') || normalizedLabel.includes('lucroantesdoimpostoderenda');
  const isPrimaryResult = normalizedLabel.includes('lucrobruto') || normalizedLabel.includes('lucrooperacionalvw') || normalizedLabel.includes('lucrooperacionalii') || normalizedLabel.includes('lucrooperacionaliii');
  const isIntermediateMargin = normalizedLabel.includes('margemdecontribuicao') || normalizedLabel.includes('lucroatividadevw');
  const rowClass = isClosingResult
    ? 'bg-emerald-100 font-bold border-t-2 border-emerald-600'
    : isPrimaryResult
      ? 'bg-emerald-50 font-semibold border-t border-emerald-200'
      : isIntermediateMargin
        ? 'bg-sky-50 font-semibold border-t border-sky-200'
        : isFinancialExpense
          ? 'bg-rose-50 font-semibold border-t border-rose-200'
          : isFinancial
            ? 'bg-amber-50 font-semibold border-t border-amber-200'
            : 'odd:bg-white even:bg-slate-50';
  return <tr className={rowClass}><td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap font-medium">{row.label}</td><td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">{row.unit}</td><td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatDemonstrativoValue(row.sorana)}</td><td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(row.soranaPercent, true)}</td><td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatDemonstrativoValue(row.satelite)}</td><td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(row.satelitePercent, true)}</td><td className={`border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap ${favorable(differenceSatelite)}`}>{formatDemonstrativoValue(differenceSatelite)}</td><td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatDemonstrativoValue(row.regiao)}</td><td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">{formatNumber(row.regiaoPercent, true)}</td><td className={`border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap ${favorable(differenceRegion)}`}>{formatDemonstrativoValue(differenceRegion)}</td></tr>;
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
