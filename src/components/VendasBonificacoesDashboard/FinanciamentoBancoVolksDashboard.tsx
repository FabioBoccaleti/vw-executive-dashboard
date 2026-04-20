import { useRef, useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Trash2, FileSpreadsheet, BarChart2 } from 'lucide-react';
import {
  getFinanciamentoMes,
  setFinanciamentoMes,
  deleteFinanciamentoMes,
  type FinanciamentoMesData,
} from './financiamentoBancoVolksStorage';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

type ActiveTab = 'importar' | 'vendas';

interface Props {
  onBack: () => void;
}

export function FinanciamentoBancoVolksDashboard({ onBack }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('importar');
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-based
  const [mesData, setMesData] = useState<FinanciamentoMesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadMes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFinanciamentoMes(selectedYear, selectedMonth);
      setMesData(data);
    } catch {
      setError('Erro ao carregar dados do mês.');
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

    // Reset input so same file can be re-imported
    e.target.value = '';

    setImporting(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to array of arrays to get raw rows
      const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: false, // keep as strings/numbers as formatted
      });

      if (rawRows.length === 0) {
        setError('O arquivo está vazio.');
        setImporting(false);
        return;
      }

      // First row = headers
      const columns = (rawRows[0] as unknown[]).map((c) =>
        c !== null && c !== undefined && c !== '' ? String(c) : '(sem nome)'
      );

      // Remaining rows = data
      const rows: Record<string, unknown>[] = rawRows.slice(1).map((row) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, idx) => {
          obj[col] = (row as unknown[])[idx] ?? '';
        });
        return obj;
      });

      const data: FinanciamentoMesData = {
        columns,
        rows,
        importedAt: new Date().toISOString(),
        fileName: file.name,
      };

      await setFinanciamentoMes(selectedYear, selectedMonth, data);
      setMesData(data);
    } catch {
      setError('Erro ao ler o arquivo. Verifique se é um arquivo Excel válido (.xlsx ou .xls).');
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    setLoading(true);
    try {
      await deleteFinanciamentoMes(selectedYear, selectedMonth);
      setMesData(null);
    } catch {
      setError('Erro ao remover dados.');
    } finally {
      setLoading(false);
    }
  }

  const formattedImportedAt = mesData?.importedAt
    ? new Date(mesData.importedAt).toLocaleString('pt-BR')
    : null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Financiamento Banco Volks</h1>
          <p className="text-xs text-slate-500 mt-0.5">Demonstrativo de Vendas e Bonificações</p>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
        >
          ← Voltar ao menu
        </button>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-end gap-1">
        <button
          onClick={() => setActiveTab('importar')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'importar'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Importar Dados
        </button>
        <button
          onClick={() => setActiveTab('vendas')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'vendas'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Vendas de Financiamento e Produtos
        </button>
      </div>

      {/* ── ABA: Importar Dados ── */}
      {activeTab === 'importar' && (
        <>
          {/* Controls */}
          <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-3">
            {/* Year selector */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Month selector */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {MONTHS.map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>{m}</option>
              ))}
            </select>

            <div className="flex-1" />

            {/* Delete button */}
            {mesData && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-red-300 text-red-600 text-sm hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Remover dados
              </button>
            )}

            {/* Import button */}
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {importing ? 'Importando...' : 'Importar Excel'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 p-6 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : !mesData ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="p-5 rounded-full bg-blue-50">
                  <FileSpreadsheet className="w-12 h-12 text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="text-slate-700 font-semibold">Nenhum arquivo importado</p>
                  <p className="text-slate-500 text-sm mt-1">
                    Selecione o mês e importe o arquivo Excel para visualizar os dados.
                  </p>
                </div>
                <button
                  onClick={handleImportClick}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Importar Excel
                </button>
              </div>
            ) : (
              /* Table */
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                {/* Table meta */}
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{mesData.rows.length}</span> registro(s) ·{' '}
                    <span className="font-medium text-slate-700">{mesData.columns.length}</span> colunas ·{' '}
                    Arquivo: <span className="font-medium text-slate-700">{mesData.fileName}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Importado em {formattedImportedAt}
                  </div>
                </div>

                {/* Scrollable table */}
                <div className="overflow-auto max-h-[calc(100vh-320px)]">
                  <table className="w-full text-xs border-collapse min-w-max">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-700 text-white">
                        <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r border-slate-600 w-10">
                          #
                        </th>
                        {mesData.columns.map((col, idx) => (
                          <th
                            key={idx}
                            className="px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r border-slate-600 last:border-r-0"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mesData.rows.map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                        >
                          <td className="px-3 py-2 text-slate-400 border-r border-slate-100 font-mono">
                            {rowIdx + 1}
                          </td>
                          {mesData.columns.map((col, colIdx) => (
                            <td
                              key={colIdx}
                              className="px-3 py-2 text-slate-700 border-r border-slate-100 last:border-r-0 whitespace-nowrap"
                            >
                              {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ABA: Vendas de Financiamento e Produtos ── */}
      {activeTab === 'vendas' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="p-5 rounded-full bg-blue-50 inline-flex mb-4">
              <BarChart2 className="w-12 h-12 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-700 mb-2">Vendas de Financiamento e Produtos</h2>
            <p className="text-slate-500 text-sm">Esta seção está sendo desenvolvida.</p>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4">
            <h3 className="text-base font-bold text-slate-800 mb-2">Remover dados do mês?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Os dados de{' '}
              <strong>{MONTHS[selectedMonth - 1]}/{selectedYear}</strong> serão removidos
              permanentemente. Você poderá reimportar o arquivo a qualquer momento.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
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
