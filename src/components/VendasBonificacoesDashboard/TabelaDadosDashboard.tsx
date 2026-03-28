import { Fragment, useState, useEffect, useRef, useMemo } from 'react';
import {
  Pencil, Trash2, Check, X, Plus, Search, FilterX, Download, TableProperties, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  loadTabelaDadosRows, saveTabelaDadosRows, createEmptyTabelaDadosRow,
  type TabelaDadosRow,
} from './tabelaDadosStorage';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(raw: string): string {
  if (!raw) return '—';
  const n = parseFloat(raw.replace(',', '.'));
  return isNaN(n) ? raw : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(v: string): string {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return y && m && d ? `${d}/${m}/${y}` : v;
}

function toDisplayNumber(raw: string): string {
  if (!raw) return '';
  const n = parseFloat(raw);
  return isNaN(n) ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBrazilianNumber(input: string): string {
  const s = input.trim().replace(/R\$\s*/g, '');
  if (!s) return '';
  const lastComma  = s.lastIndexOf(',');
  const lastPeriod = s.lastIndexOf('.');
  const normalized = lastComma > lastPeriod
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/,/g, '');
  const n = parseFloat(normalized);
  return isNaN(n) ? '' : String(n);
}

type SourceTab = 'estoque' | 'frotista';

function isSorana(fp: string): boolean {
  return fp.toLowerCase().includes('sorana');
}

function parseRowDate(row: TabelaDadosRow): { year: number; month: number } | null {
  const v = row.dataFaturamento;
  if (!v) return null;
  const parts = v.split('-');
  if (parts.length < 2) return null;
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  if (isNaN(year) || isNaN(month)) return null;
  return { year, month };
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── Column definitions ────────────────────────────────────────────────────────
type ColType = 'text' | 'currency' | 'date';
interface ColDef { key: keyof TabelaDadosRow; label: string; type: ColType; width: number; }

const COLUMNS_ALL: ColDef[] = [
  { key: 'dataFaturamento',  label: 'Data Faturamento',   type: 'date',     width: 140 },
  { key: 'nota',             label: 'Nota',               type: 'text',     width: 100 },
  { key: 'idVenda',          label: 'ID Venda',           type: 'text',     width: 180 },
  { key: 'pedido',           label: 'Pedido',             type: 'text',     width: 140 },
  { key: 'arrendatario',     label: 'Arrendatário',       type: 'text',     width: 220 },
  { key: 'fontePagadora',    label: 'Fonte Pagadora',     type: 'text',     width: 220 },
  { key: 'vencimento',       label: 'Vencimento',         type: 'date',     width: 130 },
  { key: 'valorNF',          label: 'Valor NF',           type: 'currency', width: 140 },
  { key: 'icmsSubstitutivo', label: 'ICMS Substitutivo',  type: 'currency', width: 155 },
  { key: 'corExterna',       label: 'Cor Externa',        type: 'text',     width: 160 },
  { key: 'chassi',           label: 'Chassi',             type: 'text',     width: 170 },
  { key: 'descricaoVeiculo', label: 'Descrição Veículo',  type: 'text',     width: 220 },
];

// Estoque (Sorana): sem ID Venda e sem Arrendatário
const COLUMNS_ESTOQUE: ColDef[] = COLUMNS_ALL.filter(
  c => c.key !== 'idVenda' && c.key !== 'arrendatario',
);

// ─── Export Excel ─────────────────────────────────────────────────────────────
async function exportExcel(rows: TabelaDadosRow[], columns: ColDef[], sheetName: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: 'FF10B981' } },
  });
  const labels = columns.map(c => c.label);
  ws.columns = labels.map(() => ({ width: 20 }));
  const today = new Date().toLocaleDateString('pt-BR');
  const titleRow = ws.addRow([`${sheetName} — Faturamentos — ${today}`]);
  ws.mergeCells(1, 1, 1, labels.length);
  titleRow.height = 30;
  titleRow.eachCell(cell => {
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    cell.font  = { color: { argb: 'FFFFFFFF' }, bold: true, size: 13 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  const headerRow = ws.addRow(labels);
  headerRow.height = 36;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9.5 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: labels.length } };
  const BTHIN = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const BRL_FMT = '"R$"\\ #,##0.00';
  rows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF0FDF4';
    const values = columns.map(col => {
      if (col.type === 'currency') return parseFloat(row[col.key] as string) || null;
      if (col.type === 'date') {
        const v = row[col.key] as string;
        if (!v) return null;
        const [y, m, d] = v.split('-');
        return (y && m && d) ? new Date(+y, +m - 1, +d) : v;
      }
      return (row[col.key] as string) || '';
    });
    const dr = ws.addRow(values);
    dr.height = 17;
    dr.eachCell({ includeEmpty: true }, (cell, ci) => {
      const col = columns[ci - 1];
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { top: BTHIN, bottom: BTHIN, left: BTHIN, right: BTHIN };
      if (!col) return;
      if (col.type === 'currency') {
        cell.numFmt = BRL_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { size: 9.5, name: 'Courier New' };
      } else if (col.type === 'date') {
        if (cell.value instanceof Date) cell.numFmt = 'DD/MM/YYYY';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { size: 9.5 };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { size: 9.5 };
      }
    });
  });
  // Linha de totais
  const totals = columns.map((col, i) => {
    if (i === 0) return 'TOTAL';
    if (col.type === 'currency') return rows.reduce((s, r) => s + (parseFloat(r[col.key] as string) || 0), 0);
    return null;
  });
  const totalRow = ws.addRow(totals);
  totalRow.height = 22;
  totalRow.eachCell({ includeEmpty: true }, (cell, ci) => {
    const col = columns[ci - 1];
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    if (col?.type === 'currency') {
      cell.numFmt = BRL_FMT;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.font = { bold: true, size: 10, color: { argb: 'FFD1FAE5' }, name: 'Courier New' };
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    }
  });
  const buf = await wb.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `tabela-dados-${sheetName.toLowerCase().replace(/[\s/]+/g, '-')}-${dateStr}.xlsx`,
  );
}

// ─── Filter helpers ───────────────────────────────────────────────────────────
type FilterValues = Partial<Record<keyof TabelaDadosRow, string>>;
function rowMatchesFilters(row: TabelaDadosRow, filters: FilterValues): boolean {
  for (const [key, term] of Object.entries(filters) as [keyof TabelaDadosRow, string][]) {
    if (!term) continue;
    const cell = (row[key] ?? '').toString().toLowerCase();
    if (!cell.includes(term.toLowerCase().trim())) return false;
  }
  return true;
}

// ─── CurrencyCell ─────────────────────────────────────────────────────────────
function CurrencyCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(() => toDisplayNumber(value));
  return (
    <input
      type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={e => e.target.select()}
      onBlur={() => { const p = parseBrazilianNumber(local); onChange(p); setLocal(toDisplayNumber(p)); }}
      className="w-full text-right bg-white border border-emerald-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono tabular-nums"
      placeholder="0,00"
    />
  );
}

// ─── InsertZoneTr ─────────────────────────────────────────────────────────────
function InsertZoneTr({ colSpan, onInsert }: { colSpan: number; onInsert: () => void }) {
  return (
    <tr className="group/ins" style={{ height: '10px' }}>
      <td colSpan={colSpan} className="p-0 relative" style={{ height: '10px' }}>
        <div className="absolute inset-x-0 inset-y-0 flex items-center justify-center z-30 opacity-0 group-hover/ins:opacity-100 pointer-events-none group-hover/ins:pointer-events-auto transition-all duration-150">
          <div className="absolute inset-x-0 top-1/2 h-px bg-emerald-400" />
          <button
            onClick={onInsert}
            className="relative z-10 flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-emerald-500 text-white rounded-full shadow-md hover:bg-emerald-600 active:scale-95 transition-all"
          >
            <Plus className="w-3 h-3" />
            Inserir linha aqui
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface TabelaDadosDashboardProps {
  onBack: () => void;
  embedded?: boolean;
}

export function TabelaDadosDashboard({ onBack, embedded = false }: TabelaDadosDashboardProps) {
  const now = new Date();
  const [rows, setRows]                   = useState<TabelaDadosRow[]>([]);
  const [activeSource, setActiveSource]   = useState<SourceTab>('estoque');
  const [filterYear, setFilterYear]       = useState<number>(now.getFullYear());
  const [filterMonth, setFilterMonth]     = useState<number | null>(now.getMonth() + 1);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editDraft, setEditDraft]         = useState<TabelaDadosRow | null>(null);
  const [deleteId, setDeleteId]           = useState<string | null>(null);
  const [saving, setSaving]               = useState(false);
  const [loading, setLoading]             = useState(true);
  const [filters, setFilters]             = useState<FilterValues>({});
  const [showSearch, setShowSearch]       = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const scrollbarRef      = useRef<HTMLDivElement>(null);
  const scrollDummyRef    = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => {
      if (scrollDummyRef.current && tableContainerRef.current)
        scrollDummyRef.current.style.width = tableContainerRef.current.scrollWidth + 'px';
    }, 50);
    return () => clearTimeout(t);
  });

  useEffect(() => {
    loadTabelaDadosRows().then(r => { setRows(r); setLoading(false); });
  }, []);

  // Scroll automático para linha em edição
  useEffect(() => {
    if (!editingId || !tableContainerRef.current) return;
    requestAnimationFrame(() => {
      const el = tableContainerRef.current?.querySelector(`tr[data-row-id="${editingId}"]`) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [editingId]);

  // Colunas ativas conforme aba de origem
  const activeColumns = activeSource === 'estoque' ? COLUMNS_ESTOQUE : COLUMNS_ALL;

  // Anos disponíveis (extraídos de todas as linhas)
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    rows.forEach(r => { const d = parseRowDate(r); if (d) years.add(d.year); });
    if (years.size === 0) years.add(now.getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [rows]);

  // Garante que filterYear é válido quando availableYears muda
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(filterYear)) {
      setFilterYear(availableYears[0]);
    }
  }, [availableYears]);

  // Linhas separadas por aba (Estoque = sorana / VD Frotista = demais)
  const sourceRows = useMemo(
    () => rows.filter(r => activeSource === 'estoque' ? isSorana(r.fontePagadora) : !isSorana(r.fontePagadora)),
    [rows, activeSource],
  );

  // Totais por aba (para badges)
  const estoqueCount  = useMemo(() => rows.filter(r => isSorana(r.fontePagadora)).length, [rows]);
  const frotistaCount = useMemo(() => rows.filter(r => !isSorana(r.fontePagadora)).length, [rows]);

  // Contagem por mês (para exibir badge e desabilitar meses sem dados)
  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) counts[m] = 0;
    sourceRows.forEach(r => {
      const d = parseRowDate(r);
      if (d && d.year === filterYear) counts[d.month]++;
    });
    return counts;
  }, [sourceRows, filterYear]);

  // Linhas filtradas por período
  const periodRows = useMemo(
    () => sourceRows.filter(r => {
      const d = parseRowDate(r);
      if (!d) return filterMonth === null;
      if (d.year !== filterYear) return false;
      if (filterMonth !== null && d.month !== filterMonth) return false;
      return true;
    }),
    [sourceRows, filterYear, filterMonth],
  );

  const persist = async (updated: TabelaDadosRow[]): Promise<boolean> => {
    setSaving(true);
    try {
      const ok = await saveTabelaDadosRows(updated);
      if (!ok) toast.error('Erro ao salvar. Verifique sua conexão.');
      return ok;
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: TabelaDadosRow) => {
    setDeleteId(null);
    setEditingId(row.id);
    setEditDraft({ ...row });
  };

  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };

  const saveEdit = async () => {
    if (!editDraft) return;
    const updated = rows.map(r => r.id === editDraft.id ? editDraft : r);
    setRows(updated);
    setEditingId(null);
    setEditDraft(null);
    await persist(updated);
    toast.success('Linha salva com sucesso');
  };

  const changeField = (field: keyof TabelaDadosRow, value: string) =>
    setEditDraft(prev => prev ? { ...prev, [field]: value } : prev);

  const insertAt = async (index: number) => {
    const row = createEmptyTabelaDadosRow();
    const updated = [...rows];
    updated.splice(index, 0, row);
    setRows(updated);
    await persist(updated);
    startEdit(row);
  };

  const addRow = async () => {
    const row = createEmptyTabelaDadosRow();
    const updated = [...rows, row];
    setRows(updated);
    await persist(updated);
    startEdit(row);
    requestAnimationFrame(() => {
      if (tableContainerRef.current)
        tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
    });
  };

  const deleteRow = async (id: string) => {
    const updated = rows.filter(r => r.id !== id);
    setRows(updated);
    setDeleteId(null);
    if (editingId === id) { setEditingId(null); setEditDraft(null); }
    const ok = await persist(updated);
    if (ok) toast.success('Registro removido');
  };

  const deleteAllRows = async () => {
    const kept = rows.filter(r => {
      const d = parseRowDate(r);
      if (!d) return true;
      return !(d.year === filterYear && d.month === filterMonth!);
    });
    setRows(kept);
    setConfirmDeleteAll(false);
    if (editingId && !kept.find(r => r.id === editingId)) { setEditingId(null); setEditDraft(null); }
    setDeleteId(null);
    await persist(kept);
    toast.success(`Linhas de ${MONTHS[filterMonth! - 1]}/${filterYear} excluídas.`);
  };

  const setFilter = (key: keyof TabelaDadosRow, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }));
  const clearFilters = () => setFilters({});
  const hasActiveFilters = Object.values(filters).some(v => !!v);

  const filteredRows = useMemo(
    () => hasActiveFilters ? periodRows.filter(r => rowMatchesFilters(r, filters)) : periodRows,
    [periodRows, filters, hasActiveFilters],
  );

  // Totais das colunas currency
  const totals = useMemo(() => {
    return activeColumns.reduce<Record<string, number>>((acc, col) => {
      if (col.type === 'currency')
        acc[col.key] = filteredRows.reduce((s, r) => s + (parseFloat(r[col.key] as string) || 0), 0);
      return acc;
    }, {});
  }, [filteredRows, activeColumns]);

  const COL_SPAN = activeColumns.length + 1;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  const toolbar = (
    <div className="flex items-center gap-2 flex-wrap">
      {saving && <span className="text-xs text-slate-400 animate-pulse">Salvando…</span>}
      <button
        onClick={() => { setShowSearch(v => !v); if (showSearch) clearFilters(); }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${showSearch ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
      >
        <Search className="w-3.5 h-3.5" />{showSearch ? 'Fechar filtros' : 'Filtrar'}
      </button>
      {hasActiveFilters && (
        <button onClick={clearFilters} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
          <FilterX className="w-3.5 h-3.5" /> Limpar
        </button>
      )}
      <button
        onClick={() => exportExcel(filteredRows, activeColumns, activeSource === 'estoque' ? 'Estoque' : 'VD Frotista')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <Download className="w-3.5 h-3.5" /> Excel
      </button>
      <button
        onClick={addRow}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
      >
        <Plus className="w-3.5 h-3.5" /> Nova linha
      </button>
      <button
        onClick={() => setConfirmDeleteAll(true)}
        disabled={filterMonth === null}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Trash2 className="w-3.5 h-3.5" /> Limpar Tudo
      </button>
    </div>
  );

  return (
    <div className={embedded ? 'flex flex-col h-full' : 'min-h-screen bg-slate-100 flex flex-col'}>
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <Trash2 className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Excluir todas as linhas</p>
                <p className="text-slate-500 text-xs mt-1">Deseja excluir todas as linhas de <strong>{MONTHS[filterMonth! - 1]}/{filterYear}</strong>? Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="text-xs border border-slate-200 rounded px-3 py-1.5 hover:bg-slate-50" onClick={() => setConfirmDeleteAll(false)}>Não</button>
              <button className="text-xs bg-red-600 hover:bg-red-700 text-white rounded px-3 py-1.5" onClick={deleteAllRows}>Sim, excluir tudo</button>
            </div>
          </div>
        </div>
      )}
      {/* Header — apenas na versão standalone */}
      {!embedded && (
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50 mr-1"
            >
              ← Voltar
            </button>
            <TableProperties className="w-5 h-5 text-emerald-600" />
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">Tabela de Dados</h1>
              <p className="text-xs text-slate-400">Faturamentos — Demonstrativo de Vendas e Bonificações</p>
            </div>
          </div>
          {toolbar}
        </header>
      )}

      {/* Abas de origem: Estoque | VD / Frotista */}
      <div className="bg-white border-b border-slate-200 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex gap-0">
          {([
            ['estoque',  'Estoque',       estoqueCount],
            ['frotista', 'VD / Frotista', frotistaCount],
          ] as [SourceTab, string, number][]).map(([id, label, count]) => (
            <button
              key={id}
              onClick={() => { setActiveSource(id); setFilters({}); }}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeSource === id
                  ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                activeSource === id ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>
        {/* Toolbar no modo embedded fica à direita das abas */}
        {embedded && <div className="py-1.5">{toolbar}</div>}
      </div>

      {/* Seletor Ano / Mês */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 flex-shrink-0 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">ANO</span>
        <div className="relative mr-2">
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            className="appearance-none text-sm font-bold text-slate-700 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="w-px h-5 bg-slate-200 mr-1" />
        <button
          onClick={() => setFilterMonth(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterMonth === null
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
        >
          Ano todo
        </button>
        {MONTHS.map((name, idx) => {
          const m = idx + 1;
          const count = monthCounts[m] ?? 0;
          const isActive = filterMonth === m;
          const hasData = count > 0;
          return (
            <button
              key={m}
              onClick={() => hasData ? setFilterMonth(m) : undefined}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : hasData
                  ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  : 'text-slate-300 cursor-default'
              }`}
            >
              {name}
              {hasData && (
                <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 rounded-full leading-none py-0.5 ${
                  isActive ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      

      </div>

      {/* KPI bar */}
      <div className="bg-white border-b border-slate-100 px-6 py-2 flex items-center gap-6 flex-shrink-0">
        <span className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{filteredRows.length}</span> registro{filteredRows.length !== 1 ? 's' : ''}
          {hasActiveFilters && <span className="ml-1 text-amber-600">(filtrado{filteredRows.length !== 1 ? 's' : ''})</span>}
        </span>
        {Object.entries(totals).map(([key, val]) => {
          const col = activeColumns.find(c => c.key === key);
          return (
            <span key={key} className="text-xs text-slate-500">
              {col?.label}: <span className="font-semibold text-slate-700 font-mono">{val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </span>
          );
        })}
      </div>

      {/* Table */}
      <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
        <div ref={tableContainerRef} onScroll={() => { if (scrollbarRef.current && tableContainerRef.current) scrollbarRef.current.scrollLeft = tableContainerRef.current.scrollLeft; }} className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
        <table className="w-full border-collapse text-xs" style={{ minWidth: activeColumns.reduce((s, c) => s + c.width, 0) + 80 }}>
          <thead className="sticky top-0 z-20">
            {/* Filter row */}
            {showSearch && (
              <tr className="bg-amber-50 border-b border-amber-200">
                <th className="px-2 py-1.5 text-left font-medium text-amber-700 whitespace-nowrap bg-amber-50" style={{ minWidth: 72 }}>
                  <span className="text-[10px] uppercase tracking-wide">Filtros</span>
                </th>
                {activeColumns.map(col => (
                  <th key={col.key} className="px-1 py-1 bg-amber-50" style={{ minWidth: col.width }}>
                    <input
                      type="text"
                      value={filters[col.key] ?? ''}
                      onChange={e => setFilter(col.key, e.target.value)}
                      className="w-full border border-amber-300 rounded px-2 py-1 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                      placeholder="Filtrar…"
                    />
                  </th>
                ))}
              </tr>
            )}
            {/* Column headers */}
            <tr className="bg-emerald-700 text-white">
              <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap" style={{ minWidth: 72 }}>Ações</th>
              {activeColumns.map(col => (
                <th key={col.key} className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap text-left" style={{ minWidth: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={COL_SPAN} className="text-center py-16 text-slate-400">
                  {hasActiveFilters ? 'Nenhum registro encontrado com os filtros aplicados.' : 'Nenhum registro para o período selecionado.'}
                </td>
              </tr>
            )}
            {filteredRows.map((row, ri) => {
              const isEditing = editingId === row.id;
              const isDeleting = deleteId === row.id;
              const rowBg = isEditing
                ? 'bg-emerald-50'
                : isDeleting
                ? 'bg-red-50'
                : ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';

              return (
                <Fragment key={row.id}>
                  <InsertZoneTr colSpan={COL_SPAN} onInsert={() => insertAt(ri)} />
                  <tr data-row-id={row.id} className={`${rowBg} border-b border-slate-100 hover:bg-emerald-50/40 transition-colors group`}>
                    {/* Ações */}
                    <td className="px-2 py-1.5 whitespace-nowrap" style={{ minWidth: 72 }}>
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button onClick={saveEdit} className="p-1.5 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors" title="Salvar"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={cancelEdit} className="p-1.5 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors" title="Cancelar"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : isDeleting ? (
                        <div className="flex gap-1 items-center">
                          <button onClick={() => deleteRow(row.id)} className="p-1.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors" title="Confirmar exclusão"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDeleteId(null)} className="p-1.5 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors" title="Cancelar"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(row)} className="p-1.5 rounded text-slate-500 hover:bg-emerald-100 hover:text-emerald-700 transition-colors" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDeleteId(row.id)} className="p-1.5 rounded text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </td>

                    {/* Cells */}
                    {activeColumns.map(col => {
                      const rawVal = (isEditing ? editDraft : row)?.[col.key] as string ?? '';
                      if (isEditing) {
                        if (col.type === 'currency') {
                          return (
                            <td key={col.key} className="px-1 py-1" style={{ minWidth: col.width }}>
                              <CurrencyCell value={rawVal} onChange={v => changeField(col.key, v)} />
                            </td>
                          );
                        }
                        if (col.type === 'date') {
                          return (
                            <td key={col.key} className="px-1 py-1" style={{ minWidth: col.width }}>
                              <input
                                type="date"
                                value={rawVal}
                                onChange={e => changeField(col.key, e.target.value)}
                                className="w-full border border-emerald-300 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                              />
                            </td>
                          );
                        }
                        return (
                          <td key={col.key} className="px-1 py-1" style={{ minWidth: col.width }}>
                            <input
                              type="text"
                              value={rawVal}
                              onChange={e => changeField(col.key, e.target.value)}
                              className="w-full border border-emerald-300 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                          </td>
                        );
                      }

                      // Display mode
                      const display = col.type === 'currency'
                        ? fmtCurrency(rawVal)
                        : col.type === 'date'
                        ? fmtDate(rawVal)
                        : rawVal || '—';

                      return (
                        <td
                          key={col.key}
                          className={`px-3 py-2 whitespace-nowrap ${col.type === 'currency' ? 'text-right font-mono tabular-nums' : ''} ${isDeleting ? 'text-red-400' : 'text-slate-700'}`}
                          style={{ minWidth: col.width }}
                        >
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })}
            {/* Last insert zone */}
            {filteredRows.length > 0 && (
              <InsertZoneTr colSpan={COL_SPAN} onInsert={() => insertAt(rows.length)} />
            )}
          </tbody>

          {/* Totals footer */}
          {filteredRows.length > 0 && (
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-emerald-800 text-white font-semibold">
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  TOTAL ({filteredRows.length})
                </td>
                {activeColumns.map(col => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 text-xs whitespace-nowrap ${col.type === 'currency' ? 'text-right font-mono tabular-nums' : ''}`}
                    style={{ minWidth: col.width }}
                  >
                    {col.type === 'currency' && totals[col.key] != null
                      ? totals[col.key].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        </div>
        <div ref={scrollbarRef} onScroll={() => { if (tableContainerRef.current && scrollbarRef.current) tableContainerRef.current.scrollLeft = scrollbarRef.current.scrollLeft; }}
          className="overflow-x-auto overflow-y-hidden shrink-0 border-t border-slate-100 bg-white" style={{ height: 14 }}>
          <div ref={scrollDummyRef} style={{ height: 1 }} />
        </div>
      </div>
    </div>
  );
}
