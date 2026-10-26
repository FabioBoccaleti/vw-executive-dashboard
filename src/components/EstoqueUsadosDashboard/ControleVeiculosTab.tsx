import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Upload, Trash2, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteControleVeiculos,
  getControleVeiculos,
  setControleVeiculos,
  type ControleVeiculosBrand,
  type ControleVeiculosData,
} from './controleVeiculosStorage';

type SubTab = 'importar' | 'disponiveis' | 'garantia';

const SUB_TABS: { value: SubTab; label: string }[] = [
  { value: 'importar', label: 'Importar Arquivo' },
  { value: 'disponiveis', label: 'Veículos Disponíveis' },
  { value: 'garantia', label: 'Veículos em Garantia' },
];

const BRAND_LABEL: Record<ControleVeiculosBrand, string> = { vw: 'VW', audi: 'Audi' };

function formatCell(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString('pt-BR');
  if (typeof value === 'number') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(value);
  return String(value);
}

function parseWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
  brand: ControleVeiculosBrand,
): ControleVeiculosData {
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
  return { brand, fileName, importedAt: new Date().toISOString(), sheets };
}

// ─── Painel de importação por marca ───────────────────────────────────────────

function ImportarBrandPanel({ brand }: { brand: ControleVeiculosBrand }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<ControleVeiculosData | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getControleVeiculos(brand)
      .then(loaded => {
        if (cancelled) return;
        setData(loaded);
        setActiveSheet(0);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brand]);

  async function importFile(file: File) {
    setLoading(true);
    try {
      const parsed = parseWorkbook(await file.arrayBuffer(), file.name, brand);
      await setControleVeiculos(parsed);
      setData(parsed);
      setActiveSheet(0);
      toast.success(`Arquivo importado para ${BRAND_LABEL[brand]}.`);
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
      await deleteControleVeiculos(brand);
      setData(null);
      toast.success(`Dados de ${BRAND_LABEL[brand]} removidos.`);
    } finally {
      setLoading(false);
    }
  }

  const sheets = useMemo(() => data?.sheets ?? [], [data]);
  const selectedSheet = sheets[activeSheet];

  return (
    <div className="space-y-5">
      {/* Área de importação */}
      <div className="border border-dashed border-sky-300 bg-sky-50 rounded-lg p-8 text-center">
        <FileSpreadsheet className="w-10 h-10 text-sky-600 mx-auto mb-3" />
        <h2 className="font-bold text-slate-800">Importar arquivo Excel — {BRAND_LABEL[brand]}</h2>
        <p className="text-sm text-slate-500 mt-1">
          Selecione o arquivo Excel. Todas as abas serão lidas.
        </p>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-sky-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />{loading ? 'Processando...' : 'Selecionar Excel'}
          </button>
          {data && (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 border border-red-300 text-red-600 rounded px-4 py-2 text-sm hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />Remover dados
            </button>
          )}
        </div>
        {data && (
          <p className="text-xs text-slate-500 mt-4">
            Arquivo atual: <strong>{data.fileName}</strong>, importado em {new Date(data.importedAt).toLocaleString('pt-BR')}.
          </p>
        )}
      </div>

      {/* Pré-visualização dos dados importados */}
      <div>
        {!data ? (
          <div className="py-16 text-center text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            Nenhum dado importado para {BRAND_LABEL[brand]}.
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

      {confirmReplace && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
            <h2 className="font-bold text-slate-800">Substituir dados?</h2>
            <p className="text-sm text-slate-600 mt-2">
              Já existem dados importados para {BRAND_LABEL[brand]}. A nova importação substituirá o arquivo anterior.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setConfirmReplace(false); setPendingFile(null); }} className="px-3 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => { setConfirmReplace(false); if (pendingFile) void importFile(pendingFile); }} className="px-3 py-2 text-sm bg-sky-600 text-white rounded">Substituir</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
            <h2 className="font-bold text-slate-800">Remover dados?</h2>
            <p className="text-sm text-slate-600 mt-2">Os dados importados de {BRAND_LABEL[brand]} serão excluídos.</p>
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

// ─── Placeholder: abas em construção ──────────────────────────────────────────

function PlaceholderPanel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-slate-400 py-20">
      {icon}
      <span className="text-sm font-medium text-slate-500">{title}</span>
      <span className="text-xs">Em breve.</span>
    </div>
  );
}

// ─── Aba: Controle de Veículos ────────────────────────────────────────────────

export function ControleVeiculosTab() {
  const [subTab, setSubTab] = useState<SubTab>('importar');
  const [brand, setBrand] = useState<ControleVeiculosBrand>('vw');

  return (
    <div className="flex-1 bg-slate-50 overflow-auto p-4 md:p-6">
      <div className="bg-white rounded-lg shadow-sm">
        {/* Sub-abas: Importar Arquivo / Veículos Disponíveis / Veículos em Garantia */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 md:px-6 pt-4">
          {SUB_TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSubTab(value)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                subTab === value ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Seletores de marca VW / Audi (apenas na importação) */}
        {subTab === 'importar' && (
          <div className="flex border-b border-slate-200 px-4 md:px-6">
            {(['vw', 'audi'] as ControleVeiculosBrand[]).map(item => (
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
        )}

        <div className="p-4 md:p-6">
          {subTab === 'importar' && <ImportarBrandPanel key={brand} brand={brand} />}
          {subTab === 'disponiveis' && (
            <PlaceholderPanel icon={<CheckCircle2 className="w-10 h-10 text-slate-300" />} title="Veículos Disponíveis" />
          )}
          {subTab === 'garantia' && (
            <PlaceholderPanel icon={<ShieldCheck className="w-10 h-10 text-slate-300" />} title="Veículos em Garantia" />
          )}
        </div>
      </div>
    </div>
  );
}
