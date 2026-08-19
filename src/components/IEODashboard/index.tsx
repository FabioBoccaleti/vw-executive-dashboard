import { useRef, useState, useEffect, useCallback } from 'react';
import { Upload, Trash2, FileText, AlertCircle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { kvKeys } from '@/lib/kvClient';
import {
  getIEOSemestre,
  setIEOSemestre,
  deleteIEOSemestre,
  type IEORow,
  type IEOSemestreData,
  type IEOTotalRow,
} from './ieoStorage';
import { ClassificacaoRevendasTab } from './ClassificacaoRevendasTab';
import { RegrasDepartamentosTab } from './RegrasDepartamentosTab';

const SEMESTRES = ['1º Semestre', '2º Semestre'];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

function parseNum(s: string): number {
  const cleaned = (s ?? '0').trim().replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function isAllZero(row: IEORow): boolean {
  return (
    row.saldoAnterior === 0 &&
    row.valDebito === 0 &&
    row.valCredito === 0 &&
    row.saldoPeriodo === 0 &&
    row.saldoAtual === 0
  );
}

function parseTxt(text: string, fileName: string): IEOSemestreData {
  // strip BOM if present
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = clean.split('\n');
  const rows: IEORow[] = [];
  let totalRow: IEOTotalRow | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(';');
    const nivel = parts[0].trim();

    if (nivel === 'T') {
      totalRow = {
        saldoAnterior: parseNum(parts[2]),
        valDebito: parseNum(parts[3]),
        valCredito: parseNum(parts[4]),
        saldoPeriodo: parseNum(parts[5]),
        saldoAtual: parseNum(parts[6]),
      };
      continue;
    }

    if (nivel !== 'A') continue;
    if (parts.length < 7) continue;

    const contaRaw = parts[1];
    const isMain = contaRaw === contaRaw.trimStart();

    rows.push({
      conta: contaRaw.trim(),
      isMain,
      saldoAnterior: parseNum(parts[2]),
      valDebito: parseNum(parts[3]),
      valCredito: parseNum(parts[4]),
      saldoPeriodo: parseNum(parts[5]),
      saldoAtual: parseNum(parts[6]),
    });
  }

  return { rows, totalRow, importedAt: new Date().toISOString(), fileName };
}

function fmtNum(n: number): string {
  if (n === 0) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function NumCell({ value }: { value: number }) {
  const text = fmtNum(value);
  return (
    <td className={`px-4 py-1.5 text-right font-mono text-xs tabular-nums ${value < 0 ? 'text-red-600' : value === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
      {text}
    </td>
  );
}

interface Props {
  onChangeBrand: () => void;
}

type ActiveTab = 'importar';
type ImportarSubTab = 'dados' | 'revendas' | 'departamentos';

export function IEODashboard({ onChangeBrand }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('importar');
  const [importarSubTab, setImportarSubTab] = useState<ImportarSubTab>('dados');
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedSemestre, setSelectedSemestre] = useState(1); // 1 ou 2
  const [semestreData, setSemestreData] = useState<IEOSemestreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [printing, setPrinting] = useState(false);

  async function handlePrint() {
    setPrinting(true);
    try {
      toast.info('Funcionalidade de impressão será implementada em breve.');
    } finally {
      setPrinting(false);
    }
  }

  // Detecta último semestre com dado importado
  useEffect(() => {
    kvKeys('ieo:*').then(keys => {
      const semestreKeys = keys.filter(k => /^ieo:\d{4}:S[12]$/.test(k));
      if (semestreKeys.length === 0) return;
      const parsed = semestreKeys.map(k => {
        const [, y, s] = k.split(':'); // ieo:2026:S1 → ['ieo','2026','S1']
        return { year: Number(y), semestre: Number(s.replace('S', '')) };
      });
      const last = parsed.reduce((acc, cur) =>
        cur.year > acc.year || (cur.year === acc.year && cur.semestre > acc.semestre) ? cur : acc
      );
      setSelectedYear(last.year);
      setSelectedSemestre(last.semestre);
    });
  }, []);

  const loadSemestre = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getIEOSemestre(selectedYear, selectedSemestre);
      setSemestreData(data);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedSemestre]);

  useEffect(() => {
    loadSemestre();
  }, [loadSemestre]);

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        text = new TextDecoder('windows-1252').decode(buffer);
      }
      const data = parseTxt(text, file.name);
      await setIEOSemestre(selectedYear, selectedSemestre, data);
      setSemestreData(data);
      const nonZero = data.rows.filter(r => !isAllZero(r)).length;
      toast.success(`Dados importados: ${nonZero} registros com valores.`);
    } catch {
      toast.error('Erro ao importar arquivo. Verifique o formato TXT.');
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    setLoading(true);
    try {
      await deleteIEOSemestre(selectedYear, selectedSemestre);
      setSemestreData(null);
      toast.success('Dados removidos com sucesso.');
    } catch {
      toast.error('Erro ao remover dados.');
    } finally {
      setLoading(false);
    }
  }

  const displayRows = semestreData?.rows.filter(r => !isAllZero(r)) ?? [];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header
        className="px-6 py-3 flex items-center justify-between shadow-md shrink-0"
        style={{ backgroundColor: '#10b981' }}
      >
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">Índice de Eficiência Operacional (IEO)</h1>
          <p className="text-xs text-slate-100 mt-0.5">Demonstrativo de Resultados</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white transition-colors disabled:opacity-50 hover:bg-emerald-700"
          >
            <Printer className="w-3.5 h-3.5" />
            {printing ? 'Gerando...' : 'Imprimir PDF'}
          </button>
          <button
            onClick={onChangeBrand}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-slate-200 hover:text-white hover:bg-emerald-700 transition-colors"
          >
            ← Voltar
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 p-6 flex flex-col gap-4 min-h-0">
        {/* Tab bar */}
        <div className="flex items-center gap-0 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('importar')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'importar'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Importar Dados
          </button>
        </div>

        {/* Content */}
        {activeTab === 'importar' && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Sub-tabs */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setImportarSubTab('dados')}
                className={`px-4 py-2 text-xs font-semibold rounded transition-colors ${
                  importarSubTab === 'dados'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Dados do Semestre
              </button>
              <button
                onClick={() => setImportarSubTab('revendas')}
                className={`px-4 py-2 text-xs font-semibold rounded transition-colors ${
                  importarSubTab === 'revendas'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Classificação de Revendas
              </button>
              <button
                onClick={() => setImportarSubTab('departamentos')}
                className={`px-4 py-2 text-xs font-semibold rounded transition-colors ${
                  importarSubTab === 'departamentos'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Regra por Departamento
              </button>
            </div>

            {/* Dados do Semestre */}
            {importarSubTab === 'dados' && (
              <div className="flex-1 flex flex-col gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Seletor Ano + Semestre */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">ANO</span>
                    <select
                      value={selectedYear}
                      onChange={e => setSelectedYear(Number(e.target.value))}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded bg-white text-slate-700 font-semibold"
                    >
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>

                    <div className="w-px h-5 bg-slate-200" />

                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">SEMESTRE</span>
                    <div className="flex items-center gap-1">
                      {SEMESTRES.map((label, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedSemestre(idx + 1)}
                          className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                            selectedSemestre === idx + 1
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleImportClick}
                      disabled={importing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {importing ? 'Importando...' : 'Importar TXT'}
                    </button>
                    {semestreData && (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-red-600 border border-red-300 bg-white hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover dados
                      </button>
                    )}
                  </div>
                </div>

                {/* Aviso sobre filtros do arquivo */}
                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                  <svg className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    O arquivo gerado deve considerar Revendas: <strong>1.1 - 1.6 · 1.4 - 1.9</strong>
                    &nbsp;&nbsp;|&nbsp;&nbsp;
                    Divisões: <strong>Centro de Custo - Revenda' - Tipo Item</strong>
                  </span>
                </div>

                {/* Content area */}
                {loading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                  </div>
                ) : !semestreData ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-slate-500 font-medium">Nenhum dado importado para este semestre</p>
                      <p className="text-slate-400 text-sm">Clique em "Importar TXT" para começar.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto">
                    <div className="space-y-2 mb-3">
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold">Arquivo:</span> {semestreData.fileName}
                      </p>
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold">Importado em:</span>{' '}
                        {new Date(semestreData.importedAt).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold">Registros:</span> {displayRows.length} (exibindo apenas com valores)
                      </p>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-100 border-b-2 border-slate-200">
                            <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Conta / Descrição</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 w-32">Saldo Anterior</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 w-32">Val. Débito</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 w-32">Val. Crédito</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 w-32">Saldo Período</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 w-32">Saldo Atual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayRows.map((row, i) => (
                            <tr
                              key={i}
                              className={`border-b last:border-0 ${
                                i % 2 === 0 ? 'bg-white border-slate-100' : 'bg-slate-50/50 border-slate-100'
                              }`}
                            >
                              <td className="px-4 py-1.5">
                                <span className={`${row.isMain ? 'font-semibold text-slate-700' : 'font-normal text-slate-600 pl-4'}`}>
                                  {row.conta}
                                </span>
                              </td>
                              <NumCell value={row.saldoAnterior} />
                              <NumCell value={row.valDebito} />
                              <NumCell value={row.valCredito} />
                              <NumCell value={row.saldoPeriodo} />
                              <NumCell value={row.saldoAtual} />
                            </tr>
                          ))}
                        </tbody>
                        {semestreData.totalRow && (
                          <tfoot>
                            <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                              <td className="px-4 py-2 font-bold text-emerald-800">TOTAL</td>
                              <NumCell value={semestreData.totalRow.saldoAnterior} />
                              <NumCell value={semestreData.totalRow.valDebito} />
                              <NumCell value={semestreData.totalRow.valCredito} />
                              <NumCell value={semestreData.totalRow.saldoPeriodo} />
                              <NumCell value={semestreData.totalRow.saldoAtual} />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Classificação de Revendas */}
            {importarSubTab === 'revendas' && (
              <div className="flex-1 flex flex-col gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-0 overflow-auto">
                <ClassificacaoRevendasTab />
              </div>
            )}

            {/* Regra por Departamento */}
            {importarSubTab === 'departamentos' && (
              <div className="flex-1 flex flex-col gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-0 overflow-auto">
                <RegrasDepartamentosTab />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm Delete Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-red-100">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800">Confirmar remoção</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Tem certeza que deseja remover os dados do <strong>{SEMESTRES[selectedSemestre - 1]}</strong> de <strong>{selectedYear}</strong>?
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Sim, remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
