import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Trash2, FileSpreadsheet, BarChart2, ClipboardList } from 'lucide-react';
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

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

const VENDAS_COLS = [
  'Exercício',
  'Vendedor CDC, PPS AV, GE, SEGUROS',
  'Chassi',
  'Tipo de Plano',
  'Valor Financiado',
  'Plano SPF',
  'Valor Pacote PRTG',
  'Valor Seguro GE GM',
  'Valor Prepaid Services á Vista',
  'Valor Prepaid Services',
  'Valor Franquia \u2013 GO',
  'Valor GAP \u2013 GO',
  'Valor AP \u2013 GO',
  'Valor Bruto do Bônus Ajustado',
  'Valor Bruto da Comissão Descontado PPS',
  'Valor Bruto Serviços Prestados',
  'Total de Comisões',
];
const SUM_COLS = new Set([
  'Valor Bruto do Bônus Ajustado',
  'Valor Bruto da Comissão Descontado PPS',
  'Valor Bruto Serviços Prestados',
]);

const TOTAL_COMISSOES_COL = 'Total de Comisões';
const TOTAL_COMISSOES_BASE = [
  'Valor Bruto do Bônus Ajustado',
  'Valor Bruto da Comissão Descontado PPS',
  'Valor Bruto Serviços Prestados',
];

function calcTotalComissoes(row: Record<string, unknown>): number {
  return TOTAL_COMISSOES_BASE.reduce((acc, col) => acc + parseNum(row[col]), 0);
}

const COUNT_GT0_COLS = new Set([
  'Valor Pacote PRTG',
  'Valor Seguro GE GM',
  'Valor Prepaid Services á Vista',
  'Valor Franquia – GO',
  'Valor GAP – GO',
  'Valor AP – GO',
]);

const SPF_COL = 'Plano SPF';

/** Converte valor de célula Excel (string ou number) para número */
function parseNum(val: unknown): number {
  if (typeof val === 'number') return val;
  if (val === null || val === undefined) return 0;
  const s = String(val).trim().replace(/\s/g, '');
  if (!s || s === '-') return 0;

  const lastComma = s.lastIndexOf(',');
  const lastDot   = s.lastIndexOf('.');

  let normalized: string;
  if (lastComma > lastDot) {
    // Formato brasileiro: 1.234,56 → remove pontos, troca vírgula por ponto
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Formato americano: 1,234.56 → remove vírgulas
    normalized = s.replace(/,/g, '');
  } else {
    // Sem separador de milhar
    normalized = s.replace(',', '.');
  }

  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

/** Formata número no padrão BRL */
function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
type ActiveTab = 'importar' | 'vendas' | 'cadastro';

interface Props {
  onBack: () => void;
}

export function FinanciamentoBancoVolksDashboard({ onBack }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('importar');

  // ── Aba Importar ──
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-based
  const [mesData, setMesData] = useState<FinanciamentoMesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Aba Vendas ──
  const [vendasYear, setVendasYear] = useState(CURRENT_YEAR);
  const [vendasMonth, setVendasMonth] = useState(new Date().getMonth() + 1);
  const [vendasData, setVendasData] = useState<FinanciamentoMesData | null>(null);
  const [vendasLoading, setVendasLoading] = useState(false);
  // set of months (1-12) that have imported data for vendasYear
  const [vendasMonthsWithData, setVendasMonthsWithData] = useState<Set<number>>(new Set());
  const [vendasMonthsChecking, setVendasMonthsChecking] = useState(false);

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

  // Verifica quais meses têm dados para o ano selecionado na aba Vendas
  useEffect(() => {
    if (activeTab !== 'vendas') return;
    setVendasMonthsChecking(true);
    const checks = Array.from({ length: 12 }, (_, i) =>
      getFinanciamentoMes(vendasYear, i + 1).then(d => (d ? i + 1 : null))
    );
    Promise.all(checks).then(results => {
      const withData = new Set(results.filter((m): m is number => m !== null));
      setVendasMonthsWithData(withData);
      // Se o mês selecionado não tem dados, seleciona o primeiro que tem
      if (!withData.has(vendasMonth)) {
        const first = [...withData].sort((a, b) => a - b)[0];
        if (first) setVendasMonth(first);
      }
      setVendasMonthsChecking(false);
    });
  }, [activeTab, vendasYear]);

  // Carrega dados do mês selecionado na aba Vendas
  useEffect(() => {
    if (activeTab !== 'vendas') return;
    setVendasLoading(true);
    getFinanciamentoMes(vendasYear, vendasMonth)
      .then(d => setVendasData(d))
      .finally(() => setVendasLoading(false));
  }, [activeTab, vendasYear, vendasMonth]);

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

  // ── Totais da aba Vendas ──
  const vendasTotals = useMemo<Record<string, string>>(() => {
    if (!vendasData) return {};
    const rows = vendasData.rows;
    const result: Record<string, string> = {};
    for (const col of VENDAS_COLS) {
      if (SUM_COLS.has(col)) {
        const total = rows.reduce((acc, row) => acc + parseNum(row[col]), 0);
        result[col] = fmtBRL(total);
      } else if (col === TOTAL_COMISSOES_COL) {
        const total = rows.reduce((acc, row) => acc + calcTotalComissoes(row), 0);
        result[col] = fmtBRL(total);
      } else if (COUNT_GT0_COLS.has(col)) {
        const count = rows.filter(row => parseNum(row[col]) > 0).length;
        result[col] = String(count);
      } else if (col === SPF_COL) {
        const count = rows.filter(row => String(row[col] ?? '').toUpperCase().includes('SPF')).length;
        result[col] = String(count);
      } else {
        result[col] = '';
      }
    }
    return result;
  }, [vendasData]);

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

        {/* Empurra a próxima aba para a direita */}
        <div className="flex-1" />

        <button
          onClick={() => setActiveTab('cadastro')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'cadastro'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Cadastro de Remuneração
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
        <>
          {/* Barra de filtros */}
          <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ANO</span>
            <select
              value={vendasYear}
              onChange={e => setVendasYear(Number(e.target.value))}
              className="appearance-none text-sm font-bold text-slate-700 border border-slate-200 rounded-lg pl-3 pr-6 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            <div className="w-px h-5 bg-slate-200" />

            {vendasMonthsChecking ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
            ) : (
              <div className="flex items-center gap-1 flex-wrap">
                {MONTHS_SHORT.map((m, i) => {
                  const monthNum = i + 1;
                  const hasData = vendasMonthsWithData.has(monthNum);
                  const isActive = vendasMonth === monthNum;
                  return (
                    <button
                      key={monthNum}
                      disabled={!hasData}
                      onClick={() => setVendasMonth(monthNum)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : hasData
                          ? 'text-slate-600 hover:bg-slate-100'
                          : 'text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Conteúdo */}
          <div className="flex-1 p-6 overflow-hidden">
            {vendasLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : !vendasData || vendasData.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="p-5 rounded-full bg-slate-100">
                  <BarChart2 className="w-12 h-12 text-slate-300" />
                </div>
                <p className="text-slate-500 text-sm font-medium">
                  {vendasMonthsWithData.size === 0
                    ? 'Nenhum arquivo importado para este ano. Importe os dados na aba Importar Dados.'
                    : 'Nenhum dado disponível para o mês selecionado.'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                {/* Meta */}
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{vendasData.rows.length}</span> registro(s) ·{' '}
                    {MONTHS[vendasMonth - 1]}/{vendasYear}
                  </div>
                  <div className="text-xs text-slate-400">
                    Arquivo: {vendasData.fileName}
                  </div>
                </div>

                {/* Tabela */}
                <div className="overflow-auto max-h-[calc(100vh-280px)]">
                  <table className="w-full text-xs border-collapse min-w-max">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-blue-700 text-white">
                        <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r border-blue-600 w-10">#</th>
                        {VENDAS_COLS.map((col, idx) => (
                          <th key={idx} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r border-blue-600 last:border-r-0">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vendasData.rows.map((row, rowIdx) => (
                        <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2 text-slate-400 border-r border-slate-100 font-mono">{rowIdx + 1}</td>
                          {VENDAS_COLS.map((col, colIdx) => {
                            const cellVal = col === TOTAL_COMISSOES_COL
                              ? fmtBRL(calcTotalComissoes(row))
                              : (row[col] !== null && row[col] !== undefined && row[col] !== '' ? String(row[col]) : '');
                            return (
                              <td key={colIdx} className="px-3 py-2 text-slate-700 border-r border-slate-100 last:border-r-0 whitespace-nowrap">
                                {cellVal}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 z-10">
                      <tr className="bg-blue-900 text-white font-bold">
                        <td className="px-3 py-2.5 border-r border-blue-800 whitespace-nowrap text-xs">Total</td>
                        {VENDAS_COLS.map((col, colIdx) => {
                          const val = vendasTotals[col];
                          const isCount = COUNT_GT0_COLS.has(col) || col === SPF_COL;
                          return (
                            <td
                              key={colIdx}
                              className="px-3 py-2.5 border-r border-blue-800 last:border-r-0 whitespace-nowrap text-right text-xs"
                            >
                              {val !== '' ? (
                                isCount ? (
                                  <span className="text-blue-200">{val} reg.</span>
                                ) : (
                                  val
                                )
                              ) : ''}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ABA: Cadastro de Remuneração ── */}
      {activeTab === 'cadastro' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="p-5 rounded-full bg-amber-50 inline-flex mb-4">
              <ClipboardList className="w-12 h-12 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-700 mb-2">Cadastro de Remuneração</h2>
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
