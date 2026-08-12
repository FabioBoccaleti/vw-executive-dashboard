import { useRef, useState, useEffect, useCallback } from 'react';
import { Upload, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  getDespesasAdmMes,
  setDespesasAdmMes,
  deleteDespesasAdmMes,
  type DespesaAdmRow,
  type DespesasAdmMesData,
  type DespesasAdmTotalRow,
} from './despesasAdmStorage';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

function parseNum(s: string): number {
  const cleaned = (s ?? '0').trim().replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function isAllZero(row: DespesaAdmRow): boolean {
  return (
    row.saldoAnterior === 0 &&
    row.valDebito === 0 &&
    row.valCredito === 0 &&
    row.saldoPeriodo === 0 &&
    row.saldoAtual === 0
  );
}

function parseTxt(text: string, fileName: string): DespesasAdmMesData {
  // strip BOM if present
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = clean.split('\n');
  const rows: DespesaAdmRow[] = [];
  let totalRow: DespesasAdmTotalRow | null = null;

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
    const isMain = contaRaw === contaRaw.trimStart(); // leading spaces = sub-company

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

type ActiveTab = 'importar' | 'adm_vw' | 'adm_audi' | 'consolidado';

export function DespesasAdministracaoDashboard({ onChangeBrand }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('importar');
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [mesData, setMesData] = useState<DespesasAdmMesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadMes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDespesasAdmMes(selectedYear, selectedMonth);
      setMesData(data);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadMes();
  }, [loadMes]);

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
        // fallback para Windows-1252 (encoding comum em software contábil BR)
        text = new TextDecoder('windows-1252').decode(buffer);
      }
      const data = parseTxt(text, file.name);
      await setDespesasAdmMes(selectedYear, selectedMonth, data);
      setMesData(data);
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
      await deleteDespesasAdmMes(selectedYear, selectedMonth);
      setMesData(null);
      toast.success('Dados removidos com sucesso.');
    } catch {
      toast.error('Erro ao remover dados.');
    } finally {
      setLoading(false);
    }
  }

  const displayRows = mesData?.rows.filter(r => !isAllZero(r)) ?? [];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header
        className="px-6 py-3 flex items-center justify-between shadow-md shrink-0"
        style={{ backgroundColor: '#475569' }}
      >
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">Despesas na Administração</h1>
          <p className="text-xs text-slate-300 mt-0.5">Demonstrativo de Resultados</p>
        </div>
        <button
          onClick={onChangeBrand}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-600 transition-colors"
        >
          ← Voltar
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 p-6 flex flex-col gap-4 min-h-0">
        {/* Tab bar */}
        <div className="flex items-center gap-0 border-b border-slate-200">
          {([
            { id: 'importar',   label: 'Importar Dados',             icon: <FileText className="w-3.5 h-3.5" /> },
            { id: 'adm_vw',     label: 'ADM VW',                     icon: null },
            { id: 'adm_audi',   label: 'ADM Audi',                   icon: null },
            { id: 'consolidado',label: 'Consolidado ADM (Audi / VW)', icon: null },
          ] as { id: ActiveTab; label: string; icon: React.ReactNode }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-slate-700 border-slate-600'
                  : 'text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Toolbar — só aparece na aba Importar */}
        {activeTab !== 'importar' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2 py-20">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.653-4.655m5.24-6.029-.79 2.895M5.28 8.28l2.895-.79M15 3h2.25M15 3v2.25M3 15h2.25M3 15v2.25" />
                </svg>
              </div>
              <p className="text-slate-500 font-medium">Em desenvolvimento</p>
              <p className="text-slate-400 text-sm">O conteúdo desta aba estará disponível em breve.</p>
            </div>
          </div>
        )}
        {activeTab === 'importar' && (
        <>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {mesData && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover dados
              </button>
            )}
            <button
              onClick={handleImportClick}
              disabled={importing || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded transition-colors disabled:opacity-50"
              style={{ backgroundColor: importing ? '#94a3b8' : '#475569' }}
            >
              <Upload className="w-3.5 h-3.5" />
              {importing ? 'Importando...' : 'Importar TXT'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Content area */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500" />
          </div>
        ) : !mesData ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <FileText className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-slate-500 font-medium">
                Nenhum dado importado para {MONTHS[selectedMonth - 1]}/{selectedYear}
              </p>
              <p className="text-slate-400 text-sm">
                Clique em "Importar TXT" para carregar os dados.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
            {/* Import meta info */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 flex items-center justify-between shrink-0">
              <span>
                Arquivo: <strong className="text-slate-700">{mesData.fileName}</strong>
              </span>
              <span>
                Importado em: {new Date(mesData.importedAt).toLocaleString('pt-BR')}
              </span>
            </div>

            {/* Table */}
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 border-b-2 border-slate-200">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600 min-w-[320px]">
                      Conta / Descrição
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                      Saldo Anterior
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                      Val. Débito
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                      Val. Crédito
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                      Saldo Período
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                      Saldo Atual
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row, i) => (
                    <tr
                      key={i}
                      className={
                        row.isMain
                          ? 'bg-slate-50 border-b border-slate-200'
                          : 'bg-white border-b border-slate-100 hover:bg-slate-50/50 transition-colors'
                      }
                    >
                      <td
                        className={`px-4 py-1.5 text-xs ${
                          row.isMain
                            ? 'font-semibold text-slate-800'
                            : 'text-slate-600 pl-10'
                        }`}
                      >
                        {row.conta}
                      </td>
                      <NumCell value={row.saldoAnterior} />
                      <NumCell value={row.valDebito} />
                      <NumCell value={row.valCredito} />
                      <NumCell value={row.saldoPeriodo} />
                      <NumCell value={row.saldoAtual} />
                    </tr>
                  ))}
                </tbody>
                {mesData.totalRow && (
                  <tfoot>
                    <tr className="bg-slate-700 border-t-2 border-slate-600">
                      <td className="px-4 py-2 text-xs font-bold text-white">TOTAL GERAL</td>
                      {(
                        [
                          mesData.totalRow.saldoAnterior,
                          mesData.totalRow.valDebito,
                          mesData.totalRow.valCredito,
                          mesData.totalRow.saldoPeriodo,
                          mesData.totalRow.saldoAtual,
                        ] as number[]
                      ).map((val, vi) => (
                        <td
                          key={vi}
                          className={`px-4 py-2 text-right font-mono text-xs font-bold tabular-nums ${val < 0 ? 'text-red-300' : 'text-white'}`}
                        >
                          {val === 0 ? '—' : val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
        </> // fim do bloco da aba importar
        )}
      </div>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-bold text-slate-800 mb-2">
              Remover dados do mês?
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Isso irá remover todos os dados de{' '}
              <strong>
                {MONTHS[selectedMonth - 1]}/{selectedYear}
              </strong>
              . Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
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
