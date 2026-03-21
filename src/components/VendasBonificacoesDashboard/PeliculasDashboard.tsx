import { Fragment, useState, useEffect, useRef, useMemo, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  LogOut, Layers, Pencil, Trash2, Check, X, Plus, Search,
  FilterX, BarChart2, TableProperties, Download, Upload, BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  loadPeliculasRows, savePeliculasRows, createEmptyPeliculasRow,
  recalcPeliculasRow, type PeliculasRow,
} from './peliculasStorage';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

// ─── Campos calculados (somente leitura no modo edição) ──────────────────────
const CALC_READONLY_KEYS = new Set<string>(['receitaLiquida', 'lucroBruto']);
const RESULTADO_KEYS     = new Set<string>(['lucroBruto']);
const RL_KEY             = 'receitaLiquida';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtCurrency(raw: string): string {
  if (!raw) return '—';
  const n = parseFloat(raw);
  return isNaN(n) ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

function fmtDate(v: string): string {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return y && m && d ? `${d}/${m}/${y}` : v;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtPct(raw: string, base: string): string {
  const lb = parseFloat(raw);
  const rl = parseFloat(base);
  if (!rl || isNaN(lb) || isNaN(rl)) return '—';
  return (lb / rl * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

// ─── Column definitions ───────────────────────────────────────────────────────
type ColType = 'text' | 'currency' | 'date';
interface ColDef { key: keyof PeliculasRow; label: string; type: ColType; width: number; }

const COLUMNS: ColDef[] = [
  { key: 'dataRegistro',   label: 'Data de Registro',         type: 'date',     width: 130 },
  { key: 'numeroOS',       label: 'Nº Ordem de Serviço',      type: 'text',     width: 160 },
  { key: 'codigoCliente',  label: 'Código do Cliente',        type: 'text',     width: 130 },
  { key: 'nomeCliente',    label: 'Nome do Cliente',          type: 'text',     width: 185 },
  { key: 'produto',        label: 'Produto',                  type: 'text',     width: 165 },
  { key: 'valorVenda',     label: 'Valor da Venda',           type: 'currency', width: 140 },
  { key: 'impostos',       label: 'Impostos',                 type: 'currency', width: 125 },
  { key: 'receitaLiquida', label: 'Receita Líquida',          type: 'currency', width: 140 },
  { key: 'custoPrestador', label: 'Custo Prestador',          type: 'currency', width: 140 },
  { key: 'lucroBruto',     label: 'Lucro Bruto',              type: 'currency', width: 130 },
];

// % Lucro Bruto is displayed as extra column (not stored)
const EXTRA_PCT_LABEL = '% Lucro Bruto';

// ─── Export to Excel ──────────────────────────────────────────────────────────
async function exportExcel(exportRows: PeliculasRow[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();
  const ws = wb.addWorksheet('Películas Audi', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: 'FF6366F1' } },
  });
  const allLabels = [...COLUMNS.map(c => c.label), EXTRA_PCT_LABEL];
  ws.columns = allLabels.map(() => ({ width: 18 }));
  const today = new Date().toLocaleDateString('pt-BR');
  const titleRow = ws.addRow([`Análise e Controle de Vendas de Películas na Audi — ${today}`]);
  ws.mergeCells(1, 1, 1, allLabels.length);
  titleRow.height = 30;
  titleRow.eachCell(cell => {
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
    cell.font  = { color: { argb: 'FFFFFFFF' }, bold: true, size: 13 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  const headerRow = ws.addRow(allLabels);
  headerRow.height = 36;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9.5 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: allLabels.length } };
  const BTHIN = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const BRL_FMT = '"R$"\\ #,##0.00';
  exportRows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    const pct = fmtPct(row.lucroBruto, row.receitaLiquida);
    const values = [
      ...COLUMNS.map(col => {
        if (col.type === 'currency') return parseFloat(row[col.key] as string) || null;
        if (col.type === 'date') {
          const v = row[col.key] as string;
          if (!v) return null;
          const [y, m, d] = v.split('-');
          return (y && m && d) ? new Date(+y, +m - 1, +d) : v;
        }
        return (row[col.key] as string) || '';
      }),
      pct,
    ];
    const dr = ws.addRow(values);
    dr.height = 17;
    dr.eachCell({ includeEmpty: true }, (cell, ci) => {
      const col = COLUMNS[ci - 1];
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { top: BTHIN, bottom: BTHIN, left: BTHIN, right: BTHIN };
      if (!col) { cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.font = { size: 9.5 }; return; }
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
  const currencyCols = COLUMNS.reduce<number[]>((acc, c, i) => { if (c.type === 'currency') acc.push(i); return acc; }, []);
  const totals = COLUMNS.map((col, i) => {
    if (i === 0) return 'TOTAL';
    if (col.type === 'currency') return exportRows.reduce((s, r) => s + (parseFloat(r[col.key] as string) || 0), 0);
    return null;
  });
  const totalRow = ws.addRow([...totals, null]);
  totalRow.height = 22;
  totalRow.eachCell({ includeEmpty: true }, (cell, ci) => {
    const col = COLUMNS[ci - 1];
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
    if (col?.type === 'currency') {
      cell.numFmt = BRL_FMT;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.font = { bold: true, size: 10, color: { argb: 'FFE0E7FF' }, name: 'Courier New' };
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    }
  });
  void currencyCols;
  const buf = await wb.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `peliculas-audi-${dateStr}.xlsx`
  );
}

// ─── Filter helpers ───────────────────────────────────────────────────────────
type FilterValues = Partial<Record<keyof PeliculasRow, string>>;
function rowMatchesFilters(row: PeliculasRow, filters: FilterValues): boolean {
  for (const [key, term] of Object.entries(filters) as [keyof PeliculasRow, string][]) {
    if (!term) continue;
    const cell = (row[key] ?? '').toString().toLowerCase();
    if (!cell.includes(term.toLowerCase().trim())) return false;
  }
  return true;
}

// ─── CurrencyCell ─────────────────────────────────────────────────────────────
interface CurrencyCellProps { value: string; onChange: (v: string) => void; }
function CurrencyCell({ value, onChange }: CurrencyCellProps) {
  const [local, setLocal] = useState(() => toDisplayNumber(value));
  return (
    <input
      type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={e => e.target.select()}
      onBlur={() => { const p = parseBrazilianNumber(local); onChange(p); setLocal(toDisplayNumber(p)); }}
      className="w-full text-right bg-white border border-indigo-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono tabular-nums"
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
          <div className="absolute inset-x-0 top-1/2 h-px bg-indigo-400" />
          <button
            onClick={onInsert}
            className="relative z-10 flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-indigo-500 text-white rounded-full shadow-md hover:bg-indigo-600 active:scale-95 transition-all"
          >
            <Plus className="w-3 h-3" />
            Inserir linha aqui
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`bg-white rounded-xl border-l-4 shadow-sm p-4 flex flex-col gap-1 ${color}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-xl font-bold text-slate-800 font-mono tabular-nums leading-tight">{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface PeliculasDashboardProps {
  onBack: () => void;
  onOpenCadastros?: () => void;
}

export function PeliculasDashboard({ onBack, onOpenCadastros }: PeliculasDashboardProps) {
  const [rows, setRows]           = useState<PeliculasRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PeliculasRow | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [filters, setFilters]     = useState<FilterValues>({});
  const [activeTab, setActiveTab] = useState<'tabela' | 'analise'>('tabela');
  const [importPreview, setImportPreview] = useState<PeliculasRow[] | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPeliculasRows().then(r => { setRows(r); setLoading(false); });
  }, []);

  useEffect(() => {
    if (activeTab === 'tabela' && tableContainerRef.current) {
      requestAnimationFrame(() => {
        if (tableContainerRef.current)
          tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
      });
    }
  }, [activeTab]);

  const persist = async (updated: PeliculasRow[]) => {
    setSaving(true);
    try {
      const ok = await savePeliculasRows(updated);
      if (!ok) toast.error('Erro ao salvar. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: PeliculasRow) => {
    setDeleteId(null);
    setEditingId(row.id);
    setEditDraft(recalcPeliculasRow({ ...row }));
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

  const changeField = (field: keyof PeliculasRow, value: string) =>
    setEditDraft(prev => {
      if (!prev) return prev;
      const next = recalcPeliculasRow({ ...prev, [field]: value });
      return next;
    });

  const insertAt = async (index: number) => {
    const row = createEmptyPeliculasRow();
    const updated = [...rows];
    updated.splice(index, 0, row);
    setRows(updated);
    await persist(updated);
    startEdit(row);
  };

  const deleteRow = async (id: string) => {
    const updated = rows.filter(r => r.id !== id);
    setRows(updated);
    setDeleteId(null);
    if (editingId === id) { setEditingId(null); setEditDraft(null); }
    await persist(updated);
    toast.success('Registro removido com sucesso');
  };

  const setFilter = (key: keyof PeliculasRow, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }));
  const clearFilters = () => setFilters({});
  const hasActiveFilters = Object.values(filters).some(v => !!v);

  const filteredRows = useMemo(
    () => hasActiveFilters ? rows.filter(r => rowMatchesFilters(r, filters)) : rows,
    [rows, filters, hasActiveFilters]
  );

  // ── Analytics ──────────────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const base = filteredRows.filter(r => !!r.valorVenda);
    const totalVenda    = base.reduce((s, r) => s + (parseFloat(r.valorVenda)     || 0), 0);
    const totalImp      = base.reduce((s, r) => s + (parseFloat(r.impostos)       || 0), 0);
    const totalRL       = base.reduce((s, r) => s + (parseFloat(r.receitaLiquida) || 0), 0);
    const totalCusto    = base.reduce((s, r) => s + (parseFloat(r.custoPrestador) || 0), 0);
    const totalLucro    = base.reduce((s, r) => s + (parseFloat(r.lucroBruto)     || 0), 0);
    const pctMedio      = totalRL > 0 ? (totalLucro / totalRL) * 100 : 0;
    return { qtd: base.length, totalVenda, totalImp, totalRL, totalCusto, totalLucro, pctMedio };
  }, [filteredRows]);

  // ── Import Excel ───────────────────────────────────────────────────────────
  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { cellDates: true });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { toast.error('Planilha não encontrada no arquivo.'); return; }
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      const dataRaws = (raw as unknown[][]).slice(2).filter(row => {
        const first = String(row[0] ?? '').trim();
        const hasData = row.some(c => c !== '' && c !== null && c !== undefined);
        return hasData && first !== 'TOTAL';
      });
      if (dataRaws.length === 0) { toast.error('Nenhum dado encontrado no arquivo.'); return; }
      const str = (v: unknown): string => {
        if (v === null || v === undefined || v === '') return '';
        return String(v).trim();
      };
      const cur = (v: unknown): string => {
        if (v === null || v === undefined || v === '') return '';
        const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
        return isNaN(n) ? '' : String(n);
      };
      const dat = (v: unknown): string => {
        if (!v) return '';
        if (v instanceof Date) {
          return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
        }
        const s = String(v).trim();
        const parts = s.split('/');
        if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        return s;
      };
      // Col mapping: 0:dataRegistro 1:numeroOS 2:codigoCliente 3:nomeCliente 4:produto
      //              5:valorVenda 6:impostos 7:receitaLiquida(skip) 8:custoPrestador
      const imported: PeliculasRow[] = dataRaws.map(row => {
        const draft = createEmptyPeliculasRow();
        draft.dataRegistro   = dat(row[0]);
        draft.numeroOS       = str(row[1]);
        draft.codigoCliente  = str(row[2]);
        draft.nomeCliente    = str(row[3]);
        draft.produto        = str(row[4]);
        draft.valorVenda     = cur(row[5]);
        draft.impostos       = cur(row[6]);
        draft.custoPrestador = cur(row[8]);
        return recalcPeliculasRow(draft);
      });
      setImportPreview(imported);
    } catch {
      toast.error('Erro ao ler o arquivo. Verifique se é um Excel válido exportado por esta tela.');
    }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setRows(importPreview);
    setImportPreview(null);
    await persist(importPreview);
    toast.success(`${importPreview.length} ${importPreview.length === 1 ? 'registro importado' : 'registros importados'} com sucesso`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Carregando dados...</p>
        </div>
      </div>
    );
  }

  const totalCols = COLUMNS.length + 3; // # + colunas + % Lucro + Ações

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ── Header ── */}
      <header
        className="text-white shadow-lg flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)' }}
      >
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight">
                Análise e Controle de Vendas de Películas na Audi
              </h1>
              <p className="text-indigo-200 text-xs mt-0.5">
                {hasActiveFilters
                  ? `${filteredRows.length} de ${rows.length} registros`
                  : `${rows.length} ${rows.length === 1 ? 'registro' : 'registros'}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saving && (
              <span className="flex items-center gap-1.5 text-indigo-200 text-xs">
                <span className="w-3 h-3 border-2 border-indigo-200 border-t-transparent rounded-full animate-spin" />
                Salvando...
              </span>
            )}
            {hasActiveFilters && activeTab === 'tabela' && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs text-indigo-100 border border-indigo-400/50 bg-indigo-700/40 hover:bg-indigo-700/70 rounded-md px-2.5 py-1 transition-colors"
              >
                <FilterX className="w-3.5 h-3.5" />
                Limpar filtros
              </button>
            )}
            {/* Abas */}
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setActiveTab('tabela')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === 'tabela' ? 'bg-indigo-500 text-white shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
              >
                <TableProperties className="w-3.5 h-3.5" />
                Tabela
              </button>
              <button
                onClick={() => setActiveTab('analise')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === 'analise' ? 'bg-indigo-500 text-white shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Análise
              </button>
            </div>
            {onOpenCadastros && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenCadastros}
                className="text-white border border-white/30 hover:bg-white/15 gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Cadastro
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-white border border-white/30 hover:bg-white/15 gap-2"
            >
              <LogOut className="w-4 h-4" />
              Voltar
            </Button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* ── ABA ANÁLISE ── */}
        {activeTab === 'analise' && (
          <div className="flex-1 overflow-auto p-6 space-y-6">
            {/* KPIs */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Visão Geral</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <KpiCard label="Total Registros" value={String(analytics.qtd)} color="border-indigo-400" />
                <KpiCard
                  label="Valor da Venda"
                  value={analytics.totalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  color="border-sky-400"
                />
                <KpiCard
                  label="Total Impostos"
                  value={analytics.totalImp.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  color="border-orange-400"
                />
                <KpiCard
                  label="Receita Líquida"
                  value={analytics.totalRL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  color="border-blue-400"
                />
                <KpiCard
                  label="Custo Prestador"
                  value={analytics.totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  color="border-red-400"
                />
                <KpiCard
                  label="Lucro Bruto"
                  value={analytics.totalLucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  color="border-emerald-400"
                />
                <KpiCard
                  label="% Lucro Bruto Médio"
                  value={analytics.pctMedio.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'}
                  color="border-violet-400"
                />
              </div>
            </div>

            {/* Placeholder gráficos */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 flex flex-col items-center justify-center gap-3 text-center">
              <div className="p-4 rounded-full bg-indigo-50">
                <BarChart2 className="w-10 h-10 text-indigo-300" />
              </div>
              <p className="text-base font-semibold text-slate-400">Análises Gráficas</p>
              <p className="text-sm text-slate-400">Em desenvolvimento — os gráficos serão adicionados em breve.</p>
            </div>
          </div>
        )}

        {/* ── ABA TABELA ── */}
        {activeTab === 'tabela' && (
          <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
            <div
              ref={tableContainerRef}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto flex-1"
              style={{ maxHeight: 'calc(100vh - 180px)' }}
            >
              <table className="border-collapse text-sm" style={{ width: 'max-content', minWidth: '100%' }}>
                <colgroup>
                  <col style={{ width: 56, minWidth: 56 }} />
                  {COLUMNS.map(c => <col key={c.key} style={{ width: c.width, minWidth: c.width }} />)}
                  <col style={{ width: 115, minWidth: 115 }} /> {/* % Lucro Bruto */}
                  <col style={{ width: 110, minWidth: 110 }} /> {/* Ações */}
                </colgroup>

                {/* ── THEAD ── */}
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-40 text-white text-center text-xs font-semibold px-2 py-3 border-r border-indigo-700" style={{ background: '#312e81' }}>#</th>
                    {COLUMNS.map((col, ci) => (
                      <th key={`h-${col.key}-${ci}`} className="sticky top-0 z-30 text-white text-xs font-semibold px-3 py-3 border-r border-indigo-600 align-top leading-snug text-center" style={{ background: '#4338ca' }}>
                        {col.label}
                      </th>
                    ))}
                    <th className="sticky top-0 z-30 text-white text-xs font-semibold px-3 py-3 border-r border-indigo-600 align-top leading-snug text-center" style={{ background: '#4338ca' }}>{EXTRA_PCT_LABEL}</th>
                    <th className="sticky right-0 top-0 z-40 text-white text-center text-xs font-semibold px-2 py-3 border-l border-indigo-700 whitespace-nowrap" style={{ background: '#312e81' }}>Ações</th>
                  </tr>

                  {/* Filter row */}
                  <tr>
                    <th className="sticky left-0 z-40 bg-slate-50 border-r border-b border-slate-200 px-1 py-1.5" style={{ top: 'var(--header-height, 44px)' }} />
                    {COLUMNS.map((col, ci) => (
                      <th key={`f-${col.key}-${ci}`} className="sticky z-30 bg-slate-50 border-r border-b border-slate-200 px-1.5 py-1.5" style={{ top: 'var(--header-height, 44px)' }}>
                        <div className="relative flex items-center">
                          <Search className="absolute left-1.5 w-3 h-3 text-slate-300 pointer-events-none" />
                          <input
                            type="text"
                            value={filters[col.key] ?? ''}
                            onChange={e => setFilter(col.key, e.target.value)}
                            className={`w-full min-w-0 bg-white border rounded pl-5 pr-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 ${(filters[col.key]?.length ?? 0) > 0 ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-slate-200'}`}
                          />
                        </div>
                      </th>
                    ))}
                    <th className="sticky z-30 bg-slate-50 border-r border-b border-slate-200 px-1 py-1.5" style={{ top: 'var(--header-height, 44px)' }} />
                    <th className="sticky right-0 z-40 bg-slate-50 border-l border-b border-slate-200 px-1 py-1.5" style={{ top: 'var(--header-height, 44px)' }} />
                  </tr>
                </thead>

                {/* ── TBODY ── */}
                <tbody>
                  {!hasActiveFilters && (
                    <InsertZoneTr colSpan={totalCols} onInsert={() => insertAt(0)} />
                  )}

                  {filteredRows.map((row, idx) => {
                    const isEditing = editingId === row.id;
                    const isDelete  = deleteId === row.id;
                    const isEven    = idx % 2 === 0;
                    const rowBg     = isEditing ? '#eef2ff' : isEven ? '#ffffff' : '#f8fafc';
                    const draft     = isEditing ? editDraft! : row;
                    const realIdx   = rows.indexOf(row);
                    const pctDisplay = fmtPct(row.lucroBruto, row.receitaLiquida);

                    return (
                      <Fragment key={row.id}>
                        <tr style={{ background: rowBg }} className="transition-colors group/row">

                          {/* Row number */}
                          <td className="sticky left-0 z-20 text-center border-r border-slate-200 px-1 py-1" style={{ background: rowBg, minWidth: '52px' }}>
                            <span className="text-xs text-slate-400 font-mono">{realIdx + 1}</span>
                          </td>

                          {/* Data cells */}
                          {COLUMNS.map((col, ci) => {
                            const val = (draft as PeliculasRow)[col.key] as string;
                            const isRight = col.type === 'currency';
                            const isCalc = CALC_READONLY_KEYS.has(col.key);
                            const cellHighlight = val && RESULTADO_KEYS.has(col.key)
                              ? 'bg-emerald-50 text-emerald-800 font-semibold'
                              : val && col.key === RL_KEY
                              ? 'bg-sky-50 text-sky-800 font-semibold'
                              : 'text-slate-700';

                            return (
                              <td
                                key={`${col.key}-${ci}`}
                                className={`border-r border-slate-100 px-2 py-2.5 text-sm ${isRight ? 'text-right' : 'text-left'} ${cellHighlight}`}
                                style={{ verticalAlign: 'middle' }}
                              >
                                {isEditing ? (
                                  isCalc ? (
                                    <span className={`italic text-sm font-mono tabular-nums ${
                                      val && RESULTADO_KEYS.has(col.key) ? 'text-emerald-700 font-semibold' :
                                      val && col.key === RL_KEY          ? 'text-sky-700 font-semibold' :
                                      'text-slate-400'
                                    }`}>
                                      {col.type === 'currency' ? fmtCurrency(val) : val || '—'}
                                    </span>
                                  ) : col.type === 'currency' ? (
                                    <CurrencyCell value={val} onChange={v => changeField(col.key, v)} />
                                  ) : col.type === 'date' ? (
                                    <input
                                      type="date"
                                      value={val}
                                      onChange={e => changeField(col.key, e.target.value)}
                                      className="w-full border border-indigo-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={val}
                                      onChange={e => changeField(col.key, e.target.value)}
                                      className="w-full bg-white border border-indigo-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                      placeholder="—"
                                    />
                                  )
                                ) : (
                                  col.type === 'currency' ? (
                                    <span className="font-mono tabular-nums">{fmtCurrency(val)}</span>
                                  ) : col.type === 'date' ? (
                                    <span>{fmtDate(val)}</span>
                                  ) : (
                                    val
                                      ? <span>{val}</span>
                                      : <span className="text-slate-300 select-none">—</span>
                                  )
                                )}
                              </td>
                            );
                          })}

                          {/* % Lucro Bruto (extra calc column) */}
                          <td className="border-r border-slate-100 px-2 py-2.5 text-sm text-right font-mono tabular-nums bg-violet-50 text-violet-800 font-semibold" style={{ verticalAlign: 'middle' }}>
                            {pctDisplay}
                          </td>

                          {/* Actions */}
                          <td className="sticky right-0 z-20 border-l border-slate-200 px-2 py-1.5" style={{ background: rowBg, minWidth: 110 }}>
                            {isDelete ? (
                              <div className="flex flex-col items-center gap-1.5 py-0.5">
                                <p className="text-xs text-red-600 font-semibold text-center leading-tight">Remover?</p>
                                <div className="flex gap-1">
                                  <button onClick={() => deleteRow(row.id)} className="px-2.5 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 font-semibold transition-colors">Excluir</button>
                                  <button onClick={() => setDeleteId(null)} className="px-2.5 py-1 bg-slate-200 text-slate-600 text-xs rounded-md hover:bg-slate-300 font-semibold transition-colors">Cancelar</button>
                                </div>
                              </div>
                            ) : isEditing ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button onClick={saveEdit} title="Salvar linha" className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700 font-semibold transition-colors">
                                  <Check className="w-3 h-3" />
                                  Salvar
                                </button>
                                <button onClick={cancelEdit} title="Cancelar edição" className="p-1.5 rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-0.5">
                                <button onClick={() => startEdit(row)} title="Editar linha" className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => { setEditingId(null); setEditDraft(null); setDeleteId(row.id); }} title="Excluir linha" className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>

                        {!hasActiveFilters && (
                          <InsertZoneTr colSpan={totalCols} onInsert={() => insertAt(realIdx + 1)} />
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Footer bar ── */}
            <div className="flex items-center justify-between flex-shrink-0 px-1">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => insertAt(rows.length)}
                  disabled={hasActiveFilters}
                  title={hasActiveFilters ? 'Limpe os filtros para adicionar linhas' : ''}
                  className="text-indigo-700 border-indigo-300 hover:bg-indigo-50 gap-1.5 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar linha
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportExcel(filteredRows)}
                  className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1.5 font-medium"
                >
                  <Download className="w-4 h-4" />
                  Exportar Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => importInputRef.current?.click()}
                  className="text-blue-700 border-blue-300 hover:bg-blue-50 gap-1.5 font-medium"
                >
                  <Upload className="w-4 h-4" />
                  Importar Excel
                </Button>
                <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
                {hasActiveFilters && (
                  <span className="text-xs text-indigo-600 flex items-center gap-1">
                    <Search className="w-3 h-3" />
                    {filteredRows.length === 0
                      ? 'Nenhum registro encontrado'
                      : `${filteredRows.length} de ${rows.length} registros`}
                    {' · '}
                    <button onClick={clearFilters} className="underline hover:text-indigo-800">Limpar filtros</button>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Pencil className="w-3 h-3 inline-block" />
                Clique para editar · Passe o cursor entre linhas para inserir
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal confirmação importação ── */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-blue-100 rounded-xl flex-shrink-0">
                <Upload className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Confirmar Importação</h3>
                <p className="text-sm text-slate-500 mt-1">Esta ação substituirá todos os registros atuais.</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Registros no arquivo:</span>
                <span className="font-bold text-blue-700">{importPreview.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Registros atuais (serão substituídos):</span>
                <span className="font-bold text-red-600">{rows.length}</span>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => setImportPreview(null)} className="border-slate-300 text-slate-600">Cancelar</Button>
              <Button size="sm" onClick={confirmImport} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                <Check className="w-4 h-4" />
                Confirmar Importação
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
