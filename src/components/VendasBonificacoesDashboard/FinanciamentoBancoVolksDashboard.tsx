import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Trash2, FileSpreadsheet, BarChart2, ClipboardList, Pencil, X, Percent, Printer } from 'lucide-react';
import {
  getFinanciamentoMes,
  setFinanciamentoMes,
  deleteFinanciamentoMes,
  type FinanciamentoMesData,
} from './financiamentoBancoVolksStorage';
import {
  loadRemuneracaoRegras,
  saveRemuneracaoRegras,
  type RemuneracaoProdutoRegra,
  type TipoPremio,
} from './financiamentoRemuneracaoStorage';

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

const RESUMO_COLS = [
  'Vendedor CDC, PPS AV, GE, SEGUROS',
  'Total de Comisões',
  'SPF Basico',
  'SPF Normal',
  'SPF Plus',
  'Valor Pacote PRTG',
  'Valor Seguro GE GM',
  'Valor Prepaid Services á Vista',
  'Valor Prepaid Services',
  'Valor Franquia \u2013 GO',
  'Valor GAP \u2013 GO',
  'Valor AP \u2013 GO',
];

const RESUMO_COUNT_COLS = new Set([
  'Valor Pacote PRTG',
  'Valor Seguro GE GM',
  'Valor Prepaid Services á Vista',
  'Valor Prepaid Services',
  'Valor Franquia \u2013 GO',
  'Valor GAP \u2013 GO',
  'Valor AP \u2013 GO',
]);

interface VendedorAgrupado {
  vendedor: string;
  totalComissoes: number;
  spfBasico: number;
  spfNormal: number;
  spfPlus: number;
  counts: Record<string, number>;
}

function agruparPorVendedor(rows: Record<string, unknown>[]): VendedorAgrupado[] {
  const VEND_COL = 'Vendedor CDC, PPS AV, GE, SEGUROS';
  const map = new Map<string, VendedorAgrupado>();
  for (const row of rows) {
    const vendedor = String(row[VEND_COL] ?? '').trim() || '(sem vendedor)';
    if (!map.has(vendedor)) {
      map.set(vendedor, {
        vendedor,
        totalComissoes: 0,
        spfBasico: 0,
        spfNormal: 0,
        spfPlus: 0,
        counts: Object.fromEntries([...RESUMO_COUNT_COLS].map(c => [c, 0])),
      });
    }
    const g = map.get(vendedor)!;
    g.totalComissoes += calcTotalComissoes(row);
    if (/basico|básico/i.test(String(row[SPF_COL] ?? ''))) g.spfBasico++;
    if (/normal/i.test(String(row[SPF_COL] ?? ''))) g.spfNormal++;
    if (/plus/i.test(String(row[SPF_COL] ?? ''))) g.spfPlus++;
    for (const col of RESUMO_COUNT_COLS) {
      if (parseNum(row[col]) > 0) g.counts[col]++;
    }
  }
  return [...map.values()];
}

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
type ActiveSection = 'vendas' | 'cadastro';
type VendasSubTab = 'importar' | 'vendas';
type CadastroSection = 'remuneracao-produto';

interface Props {
  onBack: () => void;
}

export function FinanciamentoBancoVolksDashboard({ onBack }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeSection, setActiveSection] = useState<ActiveSection>('vendas');
  const [vendasSubTab, setVendasSubTab] = useState<VendasSubTab>('importar');
  const [cadastroSection, setCadastroSection] = useState<CadastroSection>('remuneracao-produto');

  // ── Aba Importar ──
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-based
  const [mesData, setMesData] = useState<FinanciamentoMesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Aba Cadastro de Remuneração ──
  const [regras, setRegras] = useState<RemuneracaoProdutoRegra[]>([]);
  const [regrasLoading, setRegrasLoading] = useState(false);
  const [regraForm, setRegraForm] = useState<{ produto: string; tipoPremio: TipoPremio; valorPremio: string }>({
    produto: '', tipoPremio: 'fixo', valorPremio: '',
  });
  const [regraError, setRegraError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Aba vendas
  const [vendasYear, setVendasYear] = useState(CURRENT_YEAR);
  const [vendasMonth, setVendasMonth] = useState(new Date().getMonth() + 1);
  const [vendasData, setVendasData] = useState<FinanciamentoMesData | null>(null);
  const [vendasLoading, setVendasLoading] = useState(false);
  // set of months (1-12) that have imported data for vendasYear
  const [vendasMonthsWithData, setVendasMonthsWithData] = useState<Set<number>>(new Set());
  const [vendasMonthsChecking, setVendasMonthsChecking] = useState(false);
  type VendasInnerTab = 'tabela' | 'resumo-novos' | 'resumo-usados' | 'resumo-total' | 'demonstrativo';
  const [vendasInnerTab, setVendasInnerTab] = useState<VendasInnerTab>('tabela');

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
    if (activeSection !== 'vendas') return;
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
  }, [activeSection, vendasYear]);

  // Carrega dados do mês selecionado na aba Vendas
  useEffect(() => {
    if (activeSection !== 'vendas') return;
    setVendasLoading(true);
    getFinanciamentoMes(vendasYear, vendasMonth)
      .then(d => setVendasData(d))
      .finally(() => setVendasLoading(false));
  }, [activeSection, vendasYear, vendasMonth]);

  // Carrega regras de remuneração (sempre ao montar, pois são usadas no demonstrativo)
  useEffect(() => {
    setRegrasLoading(true);
    loadRemuneracaoRegras().then(r => setRegras(r)).finally(() => setRegrasLoading(false));
  }, []);

  async function handleSalvarRegra() {
    if (!regraForm.produto.trim()) { setRegraError('Informe o nome do produto.'); return; }
    if (!regraForm.valorPremio.trim()) { setRegraError('Informe o valor do prêmio.'); return; }
    setRegraError(null);
    let novas: RemuneracaoProdutoRegra[];
    if (editingId) {
      novas = regras.map(r => r.id === editingId ? { ...r, ...regraForm } : r);
      setEditingId(null);
    } else {
      novas = [...regras, { id: crypto.randomUUID(), ...regraForm }];
    }
    await saveRemuneracaoRegras(novas);
    setRegras(novas);
    setRegraForm({ produto: '', tipoPremio: 'fixo', valorPremio: '' });
  }

  function handleEditarRegra(r: RemuneracaoProdutoRegra) {
    setEditingId(r.id);
    setRegraForm({ produto: r.produto, tipoPremio: r.tipoPremio, valorPremio: r.valorPremio });
    setRegraError(null);
  }

  async function handleDeletarRegra(id: string) {
    const novas = regras.filter(r => r.id !== id);
    await saveRemuneracaoRegras(novas);
    setRegras(novas);
    setDeletingId(null);
  }

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
      {/* Header escuro com navegação integrada */}
      <header className="print-hidden bg-slate-800 px-6 py-3 flex items-center justify-between shadow-md shrink-0">
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">Financiamento Banco Volks</h1>
          <p className="text-xs text-slate-400 mt-0.5">Demonstrativo de Vendas e Bonificações</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveSection('vendas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeSection === 'vendas'
                ? 'bg-white text-slate-800'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Vendas
          </button>
          <button
            onClick={() => setActiveSection('cadastro')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeSection === 'cadastro'
                ? 'bg-white text-slate-800'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Cadastro
          </button>
          <div className="w-px h-5 bg-slate-600 mx-1" />
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            ← Voltar
          </button>
        </div>
      </header>

      {/* Sub-abas da seção Vendas */}
      {activeSection === 'vendas' && (
        <div className="bg-white border-b border-slate-200 px-6 flex items-end gap-1 shrink-0">
          <button
            onClick={() => setVendasSubTab('importar')}
            className={`print-hidden flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              vendasSubTab === 'importar'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importar Dados
          </button>
          <button
            onClick={() => setVendasSubTab('vendas')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              vendasSubTab === 'vendas'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Vendas de Financiamento e Produtos
          </button>
        </div>
      )}

      {/* ── SEÇÃO: Vendas / Importar Dados ── */}
      {activeSection === 'vendas' && vendasSubTab === 'importar' && (
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

      {/* ── SEÇÃO: Vendas / Vendas de Financiamento e Produtos ── */}
      {activeSection === 'vendas' && vendasSubTab === 'vendas' && (
        <>
          {/* Barra de filtros (ano + meses) */}
          <div className="print-hidden bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-3 flex-wrap shrink-0">
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

          {/* Sub-abas internas */}
          <div className="print-hidden bg-white border-b border-slate-200 px-6 flex items-end gap-1 shrink-0">
            {(['tabela', 'resumo-novos', 'resumo-usados', 'resumo-total', 'demonstrativo'] as const).map(tab => {
              const labels: Record<string, string> = {
                'tabela': 'Tabela de Vendas',
                'resumo-novos': 'Resumo Vendas Novos',
                'resumo-usados': 'Resumo Vendas Usados',
                'resumo-total': 'Resumo Total de Vendas',
                'demonstrativo': 'Demonstrativo de Pagamento',
              };
              const isActive = vendasInnerTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setVendasInnerTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* Conteúdo da sub-aba */}
          <div className="flex-1 p-6 overflow-hidden">

            {/* Tabela de Vendas */}
            {vendasInnerTab === 'tabela' && (
              vendasLoading ? (
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
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{vendasData.rows.length}</span> registro(s) ·{' '}
                      {MONTHS[vendasMonth - 1]}/{vendasYear}
                    </div>
                    <div className="text-xs text-slate-400">Arquivo: {vendasData.fileName}</div>
                  </div>
                  <div className="overflow-auto max-h-[calc(100vh-320px)]">
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
                              <td key={colIdx} className="px-3 py-2.5 border-r border-blue-800 last:border-r-0 whitespace-nowrap text-right text-xs">
                                {val !== '' ? (
                                  isCount ? <span className="text-blue-200">{val} reg.</span> : val
                                ) : ''}
                              </td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )
            )}

            {/* Resumo Vendas Novos */}
            {vendasInnerTab === 'resumo-novos' && (() => {
              const rows = (vendasData?.rows ?? []).filter(r => !String(r['Tipo de Plano'] ?? '').toLowerCase().includes('semi'));
              if (vendasLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
              if (rows.length === 0) return (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <div className="p-5 rounded-full bg-slate-100"><BarChart2 className="w-12 h-12 text-slate-300" /></div>
                  <p className="text-slate-500 text-sm font-medium">Nenhum registro de venda nova para o mês selecionado.</p>
                </div>
              );
              return (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">Resumo Vendas Novos — {MONTHS[vendasMonth - 1]}/{vendasYear}</p>
                    <span className="text-xs text-slate-400">{agruparPorVendedor(rows).length} vendedor(es) · {rows.length} registro(s)</span>
                  </div>
                  <div className="overflow-auto max-h-[calc(100vh-320px)]">
                    <table className="w-full text-xs border-collapse min-w-max">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-blue-700 text-white">
                          <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r border-blue-600 w-10">#</th>
                          {RESUMO_COLS.map((col, i) => (
                            <th key={i} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r border-blue-600 last:border-r-0">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {agruparPorVendedor(rows).map((g, rowIdx) => (
                          <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-3 py-2 text-slate-400 border-r border-slate-100 font-mono">{rowIdx + 1}</td>
                            {RESUMO_COLS.map((col, colIdx) => {
                              let val: string;
                              if (col === 'Vendedor CDC, PPS AV, GE, SEGUROS') val = g.vendedor;
                              else if (col === TOTAL_COMISSOES_COL) val = g.totalComissoes !== 0 ? fmtBRL(g.totalComissoes) : '';
                              else if (col === 'SPF Basico') val = g.spfBasico > 0 ? String(g.spfBasico) : '';
                              else if (col === 'SPF Normal') val = g.spfNormal > 0 ? String(g.spfNormal) : '';
                              else if (col === 'SPF Plus') val = g.spfPlus > 0 ? String(g.spfPlus) : '';
                              else if (RESUMO_COUNT_COLS.has(col)) val = g.counts[col] > 0 ? String(g.counts[col]) : '';
                              else val = '';
                              return <td key={colIdx} className="px-3 py-2 text-slate-700 border-r border-slate-100 last:border-r-0 whitespace-nowrap text-center">{val}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-10">
                        <tr className="bg-blue-900 text-white font-bold">
                          <td className="px-3 py-2.5 border-r border-blue-800 text-xs">Total</td>
                          {(() => {
                            const grouped = agruparPorVendedor(rows);
                            return RESUMO_COLS.map((col, i) => {
                              let cell = '';
                              if (col === 'Vendedor CDC, PPS AV, GE, SEGUROS') cell = grouped.length + ' vend.';
                              else if (col === TOTAL_COMISSOES_COL) cell = fmtBRL(grouped.reduce((a, g) => a + g.totalComissoes, 0));
                              else if (col === 'SPF Basico') cell = String(grouped.reduce((a, g) => a + g.spfBasico, 0));
                              else if (col === 'SPF Normal') cell = String(grouped.reduce((a, g) => a + g.spfNormal, 0));
                              else if (col === 'SPF Plus') cell = String(grouped.reduce((a, g) => a + g.spfPlus, 0));
                              else if (RESUMO_COUNT_COLS.has(col)) cell = String(grouped.reduce((a, g) => a + g.counts[col], 0));
                              return <td key={i} className="px-3 py-2.5 border-r border-blue-800 last:border-r-0 whitespace-nowrap text-right text-xs">{cell}</td>;
                            });
                          })()}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Resumo Vendas Usados */}
            {vendasInnerTab === 'resumo-usados' && (() => {
              const rows = (vendasData?.rows ?? []).filter(r => String(r['Tipo de Plano'] ?? '').toLowerCase().includes('semi'));
              if (vendasLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
              if (rows.length === 0) return (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <div className="p-5 rounded-full bg-slate-100"><BarChart2 className="w-12 h-12 text-slate-300" /></div>
                  <p className="text-slate-500 text-sm font-medium">Nenhum registro de venda usada para o mês selecionado.</p>
                </div>
              );
              return (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">Resumo Vendas Usados — {MONTHS[vendasMonth - 1]}/{vendasYear}</p>
                    <span className="text-xs text-slate-400">{agruparPorVendedor(rows).length} vendedor(es) · {rows.length} registro(s)</span>
                  </div>
                  <div className="overflow-auto max-h-[calc(100vh-320px)]">
                    <table className="w-full text-xs border-collapse min-w-max">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-blue-700 text-white">
                          <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r border-blue-600 w-10">#</th>
                          {RESUMO_COLS.map((col, i) => (
                            <th key={i} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r border-blue-600 last:border-r-0">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {agruparPorVendedor(rows).map((g, rowIdx) => (
                          <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-3 py-2 text-slate-400 border-r border-slate-100 font-mono">{rowIdx + 1}</td>
                            {RESUMO_COLS.map((col, colIdx) => {
                              let val: string;
                              if (col === 'Vendedor CDC, PPS AV, GE, SEGUROS') val = g.vendedor;
                              else if (col === TOTAL_COMISSOES_COL) val = g.totalComissoes !== 0 ? fmtBRL(g.totalComissoes) : '';
                              else if (col === 'SPF Basico') val = g.spfBasico > 0 ? String(g.spfBasico) : '';
                              else if (col === 'SPF Normal') val = g.spfNormal > 0 ? String(g.spfNormal) : '';
                              else if (col === 'SPF Plus') val = g.spfPlus > 0 ? String(g.spfPlus) : '';
                              else if (RESUMO_COUNT_COLS.has(col)) val = g.counts[col] > 0 ? String(g.counts[col]) : '';
                              else val = '';
                              return <td key={colIdx} className="px-3 py-2 text-slate-700 border-r border-slate-100 last:border-r-0 whitespace-nowrap text-center">{val}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-10">
                        <tr className="bg-blue-900 text-white font-bold">
                          <td className="px-3 py-2.5 border-r border-blue-800 text-xs">Total</td>
                          {(() => {
                            const grouped = agruparPorVendedor(rows);
                            return RESUMO_COLS.map((col, i) => {
                              let cell = '';
                              if (col === 'Vendedor CDC, PPS AV, GE, SEGUROS') cell = grouped.length + ' vend.';
                              else if (col === TOTAL_COMISSOES_COL) cell = fmtBRL(grouped.reduce((a, g) => a + g.totalComissoes, 0));
                              else if (col === 'SPF Basico') cell = String(grouped.reduce((a, g) => a + g.spfBasico, 0));
                              else if (col === 'SPF Normal') cell = String(grouped.reduce((a, g) => a + g.spfNormal, 0));
                              else if (col === 'SPF Plus') cell = String(grouped.reduce((a, g) => a + g.spfPlus, 0));
                              else if (RESUMO_COUNT_COLS.has(col)) cell = String(grouped.reduce((a, g) => a + g.counts[col], 0));
                              return <td key={i} className="px-3 py-2.5 border-r border-blue-800 last:border-r-0 whitespace-nowrap text-right text-xs">{cell}</td>;
                            });
                          })()}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Demonstrativo de Pagamento */}
            {vendasInnerTab === 'demonstrativo' && (() => {
              const allRows = vendasData?.rows ?? [];
              if (vendasLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
              if (allRows.length === 0) return (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <div className="p-5 rounded-full bg-slate-100"><BarChart2 className="w-12 h-12 text-slate-300" /></div>
                  <p className="text-slate-500 text-sm font-medium">Nenhum registro para o mês selecionado.</p>
                </div>
              );

              const VEND_COL = 'Vendedor CDC, PPS AV, GE, SEGUROS';
              const mesBaseMonth = vendasMonth === 1 ? 12 : vendasMonth - 1;
              const mesBaseYear = vendasMonth === 1 ? vendasYear - 1 : vendasYear;
              const vendors = [...new Map(allRows.map(r => [String(r[VEND_COL] ?? '').trim(), true] as [string, boolean])).keys()].filter(v => v);

              const DEMO_COLS = [
                'Chassi', 'Valor Financiado', 'Comissão Financiamento',
                'SPF Basico', 'SPF Normal', 'SPF Plus',
                'PRTG', 'Garantia Estendida', 'Revisão Planejada',
                'Seguro Franquia', 'Seguro GAP', 'Seguro AP',
              ];

              const getCell = (row: Record<string, unknown>, col: string): string => {
                if (col === 'Chassi') return String(row['Chassi'] ?? '');
                if (col === 'Valor Financiado') { const v = parseNum(row['Valor Financiado']); return v !== 0 ? fmtBRL(v) : ''; }
                if (col === 'Comissão Financiamento') { const v = calcTotalComissoes(row); return v !== 0 ? fmtBRL(v) : ''; }
                if (col === 'SPF Basico') return /basico|básico/i.test(String(row[SPF_COL] ?? '')) ? '1' : '';
                if (col === 'SPF Normal') return /normal/i.test(String(row[SPF_COL] ?? '')) ? '1' : '';
                if (col === 'SPF Plus') return /plus/i.test(String(row[SPF_COL] ?? '')) ? '1' : '';
                if (col === 'PRTG') return parseNum(row['Valor Pacote PRTG']) > 0 ? '1' : '';
                if (col === 'Garantia Estendida') return parseNum(row['Valor Seguro GE GM']) > 0 ? '1' : '';
                if (col === 'Revisão Planejada') {
                  const count = (parseNum(row['Valor Prepaid Services á Vista']) > 0 ? 1 : 0) + (parseNum(row['Valor Prepaid Services']) > 0 ? 1 : 0);
                  return count !== 0 ? String(count) : '';
                }
                if (col === 'Seguro Franquia') return parseNum(row['Valor Franquia \u2013 GO']) > 0 ? '1' : '';
                if (col === 'Seguro GAP') return parseNum(row['Valor GAP \u2013 GO']) > 0 ? '1' : '';
                if (col === 'Seguro AP') return parseNum(row['Valor AP \u2013 GO']) > 0 ? '1' : '';
                return '';
              };

              const getFooter = (rows: Record<string, unknown>[], col: string): string => {
                if (col === 'Chassi') return rows.length + ' reg.';
                if (col === 'Valor Financiado') return fmtBRL(rows.reduce((a, r) => a + parseNum(r['Valor Financiado']), 0));
                if (col === 'Comissão Financiamento') return fmtBRL(rows.reduce((a, r) => a + calcTotalComissoes(r), 0));
                if (col === 'SPF Basico') return String(rows.filter(r => /basico|básico/i.test(String(r[SPF_COL] ?? ''))).length);
                if (col === 'SPF Normal') return String(rows.filter(r => /normal/i.test(String(r[SPF_COL] ?? ''))).length);
                if (col === 'SPF Plus') return String(rows.filter(r => /plus/i.test(String(r[SPF_COL] ?? ''))).length);
                if (col === 'PRTG') return String(rows.filter(r => parseNum(r['Valor Pacote PRTG']) > 0).length);
                if (col === 'Garantia Estendida') return String(rows.filter(r => parseNum(r['Valor Seguro GE GM']) > 0).length);
                if (col === 'Revisão Planejada') return String(rows.reduce((a, r) => a + (parseNum(r['Valor Prepaid Services á Vista']) > 0 ? 1 : 0) + (parseNum(r['Valor Prepaid Services']) > 0 ? 1 : 0), 0));
                if (col === 'Seguro Franquia') return String(rows.filter(r => parseNum(r['Valor Franquia \u2013 GO']) > 0).length);
                if (col === 'Seguro GAP') return String(rows.filter(r => parseNum(r['Valor GAP \u2013 GO']) > 0).length);
                if (col === 'Seguro AP') return String(rows.filter(r => parseNum(r['Valor AP \u2013 GO']) > 0).length);
                return '';
              };

              // ── Cálculo de Remuneração ──
              const normProd = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
              interface DemoProdutoConfig {
                label: string;
                tipo: 'comissao' | 'premio';
                getBase: (rows: Record<string, unknown>[]) => number;
                isMonetaryBase: boolean; // true = base é R$ (Financiamento), false = quantidade
                match: (n: string) => boolean;
              }
              const DEMO_PRODUTOS_CONFIG: DemoProdutoConfig[] = [
                { label: 'Financiamento', tipo: 'comissao', isMonetaryBase: true, getBase: (rows) => rows.reduce((a, r) => a + calcTotalComissoes(r), 0), match: (n) => n.includes('retorno') },
                { label: 'SPF Basico', tipo: 'premio', isMonetaryBase: false, getBase: (rows) => rows.filter(r => /basico|básico/i.test(String(r[SPF_COL] ?? ''))).length, match: (n) => n.includes('spf basico') || n.includes('spf b') },
                { label: 'SPF Normal', tipo: 'premio', isMonetaryBase: false, getBase: (rows) => rows.filter(r => /normal/i.test(String(r[SPF_COL] ?? ''))).length, match: (n) => n.includes('spf') && n.includes('normal') },
                { label: 'SPF Plus', tipo: 'premio', isMonetaryBase: false, getBase: (rows) => rows.filter(r => /plus/i.test(String(r[SPF_COL] ?? ''))).length, match: (n) => n.includes('spf') && n.includes('plus') },
                { label: 'PRTG', tipo: 'premio', isMonetaryBase: false, getBase: (rows) => rows.filter(r => parseNum(r['Valor Pacote PRTG']) > 0).length, match: (n) => n.includes('prtg') },
                { label: 'Garantia Estendida', tipo: 'premio', isMonetaryBase: false, getBase: (rows) => rows.filter(r => parseNum(r['Valor Seguro GE GM']) > 0).length, match: (n) => n.includes('garantia') },
                { label: 'Revisão Planejada', tipo: 'premio', isMonetaryBase: false, getBase: (rows) => rows.reduce((a, r) => a + (parseNum(r['Valor Prepaid Services á Vista']) > 0 ? 1 : 0) + (parseNum(r['Valor Prepaid Services']) > 0 ? 1 : 0), 0), match: (n) => n.includes('revisao') || n.includes('planejada') || n.includes('prepaid') },
                { label: 'Seguro Franquia', tipo: 'premio', isMonetaryBase: false, getBase: (rows) => rows.filter(r => parseNum(r['Valor Franquia \u2013 GO']) > 0).length, match: (n) => n.includes('franquia') },
                { label: 'Seguro GAP', tipo: 'premio', isMonetaryBase: false, getBase: (rows) => rows.filter(r => parseNum(r['Valor GAP \u2013 GO']) > 0).length, match: (n) => n.includes('gap') },
                { label: 'Seguro AP', tipo: 'premio', isMonetaryBase: false, getBase: (rows) => rows.filter(r => parseNum(r['Valor AP \u2013 GO']) > 0).length, match: (n) => !n.includes('gap') && (n === 'ap' || n === 'seguro ap' || n.endsWith(' ap') || n.startsWith('ap ')) },
              ];

              interface RemuneracaoLinha {
                label: string;
                tipo: 'comissao' | 'premio';
                baseNovos: number;
                baseUsados: number;
                valorNovos: number;
                valorUsados: number;
                total: number;
                isMonetaryBase: boolean;
                premioDisplay: string;
                hasRegra: boolean;
              }

              const calcRemuneracaoLinhas = (novosRows: Record<string, unknown>[], usadosRows: Record<string, unknown>[]): RemuneracaoLinha[] => {
                return DEMO_PRODUTOS_CONFIG.map(cfg => {
                  const regra = regras.find(r => cfg.match(normProd(r.produto)));
                  const baseN = cfg.getBase(novosRows);
                  const baseU = cfg.getBase(usadosRows);
                  if (!regra) {
                    return { label: cfg.label, tipo: cfg.tipo, baseNovos: baseN, baseUsados: baseU, valorNovos: 0, valorUsados: 0, total: 0, isMonetaryBase: cfg.isMonetaryBase, premioDisplay: '—', hasRegra: false };
                  }
                  const premio = parseNum(regra.valorPremio);
                  const calc = (base: number) => regra.tipoPremio === 'percentual' ? base * premio / 100 : base * premio;
                  const valorN = calc(baseN);
                  const valorU = calc(baseU);
                  const premioDisplay = regra.tipoPremio === 'percentual' ? `${regra.valorPremio}%` : `R$ ${regra.valorPremio}`;
                  return { label: cfg.label, tipo: cfg.tipo, baseNovos: baseN, baseUsados: baseU, valorNovos: valorN, valorUsados: valorU, total: valorN + valorU, isMonetaryBase: cfg.isMonetaryBase, premioDisplay, hasRegra: true };
                });
              };

              const renderTable = (rows: Record<string, unknown>[], title: string) => (
                <div className="mb-4">
                  <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wide mb-1">{title}</p>
                  <table className="w-full text-[9px] border-collapse">
                    <thead>
                      <tr className="bg-blue-800 text-white">
                        <th className="px-1 py-1 text-left border border-blue-700 w-5">#</th>
                        {DEMO_COLS.map((c, i) => <th key={i} className="px-1 py-1 text-center border border-blue-700 font-semibold leading-tight" style={{ maxWidth: 70, wordBreak: 'break-word' }}>{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, ri) => (
                        <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-1.5 py-0.5 border border-slate-200 text-slate-400 font-mono">{ri + 1}</td>
                          {DEMO_COLS.map((col, ci) => (
                            <td key={ci} className="px-1.5 py-0.5 border border-slate-200 text-center text-slate-700">{getCell(row, col)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-900 text-white font-bold">
                        <td className="px-1.5 py-1 border border-blue-800">Total</td>
                        {DEMO_COLS.map((col, i) => (
                          <td key={i} className="px-1.5 py-1 border border-blue-800 text-center">{getFooter(rows, col)}</td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );

              return (
                <div className="overflow-auto max-h-[calc(100vh-280px)] print:overflow-visible print:max-h-none">
                  <style>{`
                    @media print {
                      @page { size: A4 landscape; margin: 1cm; }
                      body * { visibility: hidden; }
                      .demo-print-area, .demo-print-area * { visibility: visible; }
                      .demo-print-area { position: absolute; top: 0; left: 0; width: 100%; }
                      .demo-page {
                        page-break-after: always;
                        break-after: page;
                        page-break-inside: avoid;
                        break-inside: avoid;
                      }
                      .demo-page:last-of-type {
                        page-break-after: avoid;
                        break-after: avoid;
                      }
                      .print-hidden { display: none !important; }
                    }
                  `}</style>
                  <div className="print-hidden flex justify-end mb-3 sticky top-0 bg-white z-10 py-2 border-b border-slate-100">
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimir
                    </button>
                  </div>
                  <div className="demo-print-area">
                  {vendors.map((vendor, vi) => {
                    const vendorRows = allRows.filter(r => String(r[VEND_COL] ?? '').trim() === vendor);
                    const novos = vendorRows.filter(r => !String(r['Tipo de Plano'] ?? '').toLowerCase().includes('semi'));
                    const usados = vendorRows.filter(r => String(r['Tipo de Plano'] ?? '').toLowerCase().includes('semi'));
                    return (
                      <div key={vi} className="demo-page bg-white border border-slate-200 rounded-xl p-5 mb-4">
                        <div className="text-center pb-2 mb-3 border-b border-slate-200">
                          <p className="text-sm font-bold text-slate-800">Sorana VW</p>
                          <p className="text-xs font-semibold text-slate-700">Remuneração Produção Banco Volks</p>
                        </div>
                        <div className="flex justify-between items-center mb-4 text-xs text-slate-600">
                          <div><span className="font-semibold">Vendedor:</span> {vendor}</div>
                          <div className="flex gap-6">
                            <div><span className="font-semibold">Mês de Apuração:</span> {MONTHS[vendasMonth - 1]}/{vendasYear}</div>
                            <div><span className="font-semibold">Mês Base:</span> {MONTHS[mesBaseMonth - 1]}/{mesBaseYear}</div>
                          </div>
                        </div>
                        {novos.length > 0 && renderTable(novos, 'Veículos Novos')}
                        {usados.length > 0 && renderTable(usados, 'Veículos Usados / Semi-Novos')}
                        {/* Resumo de Remuneração */}
                        {(() => {
                          const linhas = calcRemuneracaoLinhas(novos, usados);
                          const comissoes = linhas.filter(l => l.tipo === 'comissao');
                          const premios = linhas.filter(l => l.tipo === 'premio');
                          const subComissaoN = comissoes.reduce((a, l) => a + l.valorNovos, 0);
                          const subComissaoU = comissoes.reduce((a, l) => a + l.valorUsados, 0);
                          const subComissaoT = subComissaoN + subComissaoU;
                          const subPremioN = premios.reduce((a, l) => a + l.valorNovos, 0);
                          const subPremioU = premios.reduce((a, l) => a + l.valorUsados, 0);
                          const subPremioT = subPremioN + subPremioU;
                          const totalNovos = subComissaoN + subPremioN;
                          const totalUsados = subComissaoU + subPremioU;
                          const totalGeral = totalNovos + totalUsados;

                          const renderLinhas = (grupo: RemuneracaoLinha[]) => grupo.map((l, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="px-2 py-1 border border-slate-200 font-medium text-slate-700 pl-4">{l.label}</td>
                              <td className="px-2 py-1 border border-slate-200 text-center text-slate-500">{l.hasRegra ? l.premioDisplay : <span className="text-amber-500 font-semibold">sem regra</span>}</td>
                              <td className="px-2 py-1 border border-slate-200 text-center text-slate-600">
                                {l.baseNovos !== 0 ? (l.isMonetaryBase ? 'R$ ' + fmtBRL(l.baseNovos) : String(l.baseNovos)) : '—'}
                              </td>
                              <td className="px-2 py-1 border border-slate-200 text-right font-medium text-slate-700">
                                {l.valorNovos !== 0 ? 'R$ ' + fmtBRL(l.valorNovos) : '—'}
                              </td>
                              <td className="px-2 py-1 border border-slate-200 text-center text-slate-600">
                                {l.baseUsados !== 0 ? (l.isMonetaryBase ? 'R$ ' + fmtBRL(l.baseUsados) : String(l.baseUsados)) : '—'}
                              </td>
                              <td className="px-2 py-1 border border-slate-200 text-right font-medium text-slate-700">
                                {l.valorUsados !== 0 ? 'R$ ' + fmtBRL(l.valorUsados) : '—'}
                              </td>
                              <td className="px-2 py-1 border border-slate-200 text-right font-bold text-slate-800 bg-slate-50">
                                {l.total !== 0 ? 'R$ ' + fmtBRL(l.total) : '—'}
                              </td>
                            </tr>
                          ));

                          return (
                            <div className="mt-3 border border-slate-300 rounded-lg overflow-hidden">
                              <div className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between">
                                <p className="text-[10px] font-bold uppercase tracking-wide">Resumo de Remuneração</p>
                                <p className="text-[10px] text-slate-300">Total a Receber: <span className="font-bold text-white">R$ {fmtBRL(totalGeral)}</span></p>
                              </div>
                              <table className="w-full text-[9px] border-collapse">
                                <thead>
                                  <tr className="bg-slate-100 text-slate-600">
                                    <th className="px-2 py-1 text-left border border-slate-200 font-semibold">Produto</th>
                                    <th className="px-2 py-1 text-center border border-slate-200 font-semibold">Regra</th>
                                    <th className="px-2 py-1 text-center border border-slate-200 font-semibold">Base Novos</th>
                                    <th className="px-2 py-1 text-right border border-slate-200 font-semibold">Valor Novos</th>
                                    <th className="px-2 py-1 text-center border border-slate-200 font-semibold">Base Usados</th>
                                    <th className="px-2 py-1 text-right border border-slate-200 font-semibold">Valor Usados</th>
                                    <th className="px-2 py-1 text-right border border-slate-200 font-semibold bg-slate-200">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* Grupo: Comissão */}
                                  <tr className="bg-emerald-700 text-white">
                                    <td className="px-2 py-1 border border-emerald-600 font-bold text-[9px] uppercase tracking-wide" colSpan={7}>Comissão</td>
                                  </tr>
                                  {renderLinhas(comissoes)}
                                  <tr className="bg-emerald-50 text-emerald-900 font-bold">
                                    <td className="px-2 py-1 border border-emerald-200 pl-4" colSpan={3}>Subtotal Comissão</td>
                                    <td className="px-2 py-1 border border-emerald-200 text-right">{subComissaoN !== 0 ? 'R$ ' + fmtBRL(subComissaoN) : '—'}</td>
                                    <td className="px-2 py-1 border border-emerald-200 text-center">—</td>
                                    <td className="px-2 py-1 border border-emerald-200 text-right">{subComissaoU !== 0 ? 'R$ ' + fmtBRL(subComissaoU) : '—'}</td>
                                    <td className="px-2 py-1 border border-emerald-200 text-right">R$ {fmtBRL(subComissaoT)}</td>
                                  </tr>
                                  {/* Grupo: Prêmios */}
                                  <tr className="bg-blue-700 text-white">
                                    <td className="px-2 py-1 border border-blue-600 font-bold text-[9px] uppercase tracking-wide" colSpan={7}>Prêmios</td>
                                  </tr>
                                  {renderLinhas(premios)}
                                  <tr className="bg-blue-50 text-blue-900 font-bold">
                                    <td className="px-2 py-1 border border-blue-200 pl-4" colSpan={3}>Subtotal Prêmios</td>
                                    <td className="px-2 py-1 border border-blue-200 text-right">{subPremioN !== 0 ? 'R$ ' + fmtBRL(subPremioN) : '—'}</td>
                                    <td className="px-2 py-1 border border-blue-200 text-center">—</td>
                                    <td className="px-2 py-1 border border-blue-200 text-right">{subPremioU !== 0 ? 'R$ ' + fmtBRL(subPremioU) : '—'}</td>
                                    <td className="px-2 py-1 border border-blue-200 text-right">R$ {fmtBRL(subPremioT)}</td>
                                  </tr>
                                </tbody>
                                <tfoot>
                                  <tr className="bg-slate-800 text-white font-bold text-[9px]">
                                    <td className="px-2 py-1.5 border border-slate-700" colSpan={3}>TOTAL A RECEBER</td>
                                    <td className="px-2 py-1.5 border border-slate-700 text-right">R$ {fmtBRL(totalNovos)}</td>
                                    <td className="px-2 py-1.5 border border-slate-700 text-center">—</td>
                                    <td className="px-2 py-1.5 border border-slate-700 text-right">R$ {fmtBRL(totalUsados)}</td>
                                    <td className="px-2 py-1.5 border border-slate-700 text-right">R$ {fmtBRL(totalGeral)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          );
                        })()}
                        {/* Campos de Assinatura */}
                        <div className="mt-6 pt-4 border-t border-slate-200">
                          <div className="grid grid-cols-4 gap-6">
                            {['Gerência Comercial', 'Diretoria Comercial', 'Diretoria', 'Financeiro'].map((cargo) => (
                              <div key={cargo} className="flex flex-col items-center gap-1">
                                <div className="w-full border-b border-slate-400" style={{ height: 40 }} />
                                <p className="text-[9px] font-semibold text-slate-600 text-center">{cargo}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              );
            })()}

            {/* Resumo Total de Vendas */}
            {vendasInnerTab === 'resumo-total' && (() => {
              const rows = vendasData?.rows ?? [];
              if (vendasLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
              if (rows.length === 0) return (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <div className="p-5 rounded-full bg-slate-100"><BarChart2 className="w-12 h-12 text-slate-300" /></div>
                  <p className="text-slate-500 text-sm font-medium">Nenhum registro para o mês selecionado.</p>
                </div>
              );
              return (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">Resumo Total de Vendas — {MONTHS[vendasMonth - 1]}/{vendasYear}</p>
                    <span className="text-xs text-slate-400">{agruparPorVendedor(rows).length} vendedor(es) · {rows.length} registro(s)</span>
                  </div>
                  <div className="overflow-auto max-h-[calc(100vh-320px)]">
                    <table className="w-full text-xs border-collapse min-w-max">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-blue-700 text-white">
                          <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r border-blue-600 w-10">#</th>
                          {RESUMO_COLS.map((col, i) => (
                            <th key={i} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r border-blue-600 last:border-r-0">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {agruparPorVendedor(rows).map((g, rowIdx) => (
                          <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-3 py-2 text-slate-400 border-r border-slate-100 font-mono">{rowIdx + 1}</td>
                            {RESUMO_COLS.map((col, colIdx) => {
                              let val: string;
                              if (col === 'Vendedor CDC, PPS AV, GE, SEGUROS') val = g.vendedor;
                              else if (col === TOTAL_COMISSOES_COL) val = g.totalComissoes !== 0 ? fmtBRL(g.totalComissoes) : '';
                              else if (col === 'SPF Basico') val = g.spfBasico > 0 ? String(g.spfBasico) : '';
                              else if (col === 'SPF Normal') val = g.spfNormal > 0 ? String(g.spfNormal) : '';
                              else if (col === 'SPF Plus') val = g.spfPlus > 0 ? String(g.spfPlus) : '';
                              else if (RESUMO_COUNT_COLS.has(col)) val = g.counts[col] > 0 ? String(g.counts[col]) : '';
                              else val = '';
                              return <td key={colIdx} className="px-3 py-2 text-slate-700 border-r border-slate-100 last:border-r-0 whitespace-nowrap text-center">{val}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-10">
                        <tr className="bg-blue-900 text-white font-bold">
                          <td className="px-3 py-2.5 border-r border-blue-800 text-xs">Total</td>
                          {(() => {
                            const grouped = agruparPorVendedor(rows);
                            return RESUMO_COLS.map((col, i) => {
                              let cell = '';
                              if (col === 'Vendedor CDC, PPS AV, GE, SEGUROS') cell = grouped.length + ' vend.';
                              else if (col === TOTAL_COMISSOES_COL) cell = fmtBRL(grouped.reduce((a, g) => a + g.totalComissoes, 0));
                              else if (col === 'SPF Basico') cell = String(grouped.reduce((a, g) => a + g.spfBasico, 0));
                              else if (col === 'SPF Normal') cell = String(grouped.reduce((a, g) => a + g.spfNormal, 0));
                              else if (col === 'SPF Plus') cell = String(grouped.reduce((a, g) => a + g.spfPlus, 0));
                              else if (RESUMO_COUNT_COLS.has(col)) cell = String(grouped.reduce((a, g) => a + g.counts[col], 0));
                              return <td key={i} className="px-3 py-2.5 border-r border-blue-800 last:border-r-0 whitespace-nowrap text-right text-xs">{cell}</td>;
                            });
                          })()}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })()}

          </div>
        </>
      )}

      {/* ── SEÇÃO: Cadastro de Remuneração ── */}
      {activeSection === 'cadastro' && (
        <div className="flex-1 flex overflow-hidden">

          {/* Sidebar de navegação */}
          <aside className="w-56 shrink-0 overflow-y-auto flex flex-col" style={{ background: 'linear-gradient(to bottom, #1e1b4b, #1e3a8a)' }}>
            <button
              onClick={() => setCadastroSection('remuneracao-produto')}
              className={`flex items-start gap-3 px-4 py-4 text-left w-full transition-colors ${
                cadastroSection === 'remuneracao-produto'
                  ? 'bg-white/20 border-l-2 border-white'
                  : 'border-l-2 border-transparent text-indigo-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Percent className={`w-4 h-4 mt-0.5 shrink-0 ${
                cadastroSection === 'remuneracao-produto' ? 'text-white' : 'text-indigo-300'
              }`} />
              <div>
                <p className={`text-xs font-bold leading-tight ${
                  cadastroSection === 'remuneracao-produto' ? 'text-white' : 'text-indigo-200'
                }`}>Regra de Remuneração Produto</p>
                <p className="text-[10px] mt-0.5 leading-tight text-indigo-300 opacity-80">Produtos e regras de prêmio</p>
              </div>
            </button>
            {/* Novos itens de cadastro serão adicionados aqui */}
          </aside>

          {/* Área de conteúdo */}
          <div className="flex-1 overflow-auto bg-slate-100 p-6">
            {cadastroSection === 'remuneracao-produto' && (
              <div className="max-w-3xl space-y-5">

                {/* Cabeçalho da seção */}
                <div className="flex items-center gap-3">
                  <Percent className="w-5 h-5 text-slate-500" />
                  <div>
                    <h2 className="text-base font-bold text-slate-800">Regra de Remuneração Produto</h2>
                    <p className="text-xs text-slate-500">Produtos e regras de prêmio</p>
                  </div>
                </div>

                {/* Formulário */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Produto */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Produto *</label>
                      <input
                        type="text"
                        value={regraForm.produto}
                        onChange={e => setRegraForm(f => ({ ...f, produto: e.target.value }))}
                        placeholder="Ex: CDC, Seguro, GAP..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    </div>

                    {/* Tipo de Prêmio */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Prêmio</label>
                      <div className="flex items-center gap-6 mt-1">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="tipoPremio"
                            checked={regraForm.tipoPremio === 'fixo'}
                            onChange={() => setRegraForm(f => ({ ...f, tipoPremio: 'fixo' }))}
                            className="accent-amber-500"
                          />
                          Valor fixo (R$)
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="tipoPremio"
                            checked={regraForm.tipoPremio === 'percentual'}
                            onChange={() => setRegraForm(f => ({ ...f, tipoPremio: 'percentual' }))}
                            className="accent-amber-500"
                          />
                          Percentual (%)
                        </label>
                      </div>
                    </div>

                    {/* Valor do Prêmio */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        {regraForm.tipoPremio === 'fixo' ? 'Valor do Prêmio (R$) *' : 'Percentual (%) *'}
                      </label>
                      <input
                        type="text"
                        value={regraForm.valorPremio}
                        onChange={e => setRegraForm(f => ({ ...f, valorPremio: e.target.value }))}
                        placeholder={regraForm.tipoPremio === 'fixo' ? 'Ex: 150,00' : 'Ex: 2,5'}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    </div>
                  </div>

                  {regraError && (
                    <p className="text-xs text-red-500 font-medium">{regraError}</p>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={handleSalvarRegra}
                      className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
                    >
                      {editingId ? 'Salvar alterações' : '+ Adicionar Regra'}
                    </button>
                    {editingId && (
                      <button
                        onClick={() => { setEditingId(null); setRegraForm({ produto: '', tipoPremio: 'fixo', valorPremio: '' }); setRegraError(null); }}
                        className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabela de regras */}
                {regrasLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500" />
                  </div>
                ) : regras.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr style={{ background: 'linear-gradient(to right, #1e1b4b, #1e3a8a)' }} className="text-white">
                          <th className="px-4 py-3 text-left font-semibold">Produto</th>
                          <th className="px-4 py-3 text-left font-semibold">Tipo de Prêmio</th>
                          <th className="px-4 py-3 text-left font-semibold">Valor / Percentual</th>
                          <th className="px-4 py-3 text-center font-semibold w-24">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {regras.map((r, idx) => (
                          <tr key={r.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-4 py-3 text-slate-800 font-medium">{r.produto}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                r.tipoPremio === 'fixo'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {r.tipoPremio === 'fixo' ? 'Valor fixo (R$)' : 'Percentual (%)'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {r.tipoPremio === 'fixo' ? `R$ ${r.valorPremio}` : `${r.valorPremio}%`}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEditarRegra(r)}
                                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                                  title="Editar"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeletingId(r.id)}
                                  className="text-slate-400 hover:text-red-500 transition-colors"
                                  title="Remover"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal confirmar exclusão de regra */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">Remover regra?</h3>
              <button onClick={() => setDeletingId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              A regra <strong>{regras.find(r => r.id === deletingId)?.produto}</strong> será removida permanentemente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeletarRegra(deletingId)}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
              >
                Remover
              </button>
            </div>
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
