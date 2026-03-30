import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown, AlertTriangle, Pencil, Trash2, Highlighter, StickyNote, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  type JurosRotativoRow,
  loadJurosRotativoRows,
  saveJurosRotativoRows,
  replaceJurosRotativoRows,
  createEmptyJurosRotativoRow,
  parseTxtJurosRotativo,
} from './jurosRotativoStorage';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function parseDate(raw: string): { year: number; month: number } | null {
  if (!raw) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [, mm, yyyy] = raw.split('/');
    return { year: Number(yyyy), month: Number(mm) };
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [yyyy, mm] = raw.split('-');
    return { year: Number(yyyy), month: Number(mm) };
  }
  return null;
}

function fmtCurrency(raw: string): string {
  const n = parseFloat(String(raw).replace(',', '.'));
  if (isNaN(n)) return raw || '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function sumJuros(rows: JurosRotativoRow[]): number {
  return rows.reduce((acc, r) => {
    const n = parseFloat(String(r.jurosPagos).replace(',', '.'));
    return acc + (isNaN(n) ? 0 : n);
  }, 0);
}

const COLS = [
  { key: 'dataPagamento', label: 'Data de Pagamento', type: 'date'     },
  { key: 'notaFiscal',    label: 'Nota Fiscal',       type: 'text'     },
  { key: 'jurosPagos',   label: 'Juros Pagos',       type: 'currency' },
] as const;

// ─── Export Excel ─────────────────────────────────────────────────────────────
async function exportToExcel(rows: JurosRotativoRow[], sheetName: string, filename: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: 'FF10B981' } },
  });
  const labels = COLS.map(c => c.label);
  ws.columns = labels.map(() => ({ width: 26 }));
  const today = new Date().toLocaleDateString('pt-BR');
  const titleRow = ws.addRow([`${sheetName} — ${today}`]);
  ws.mergeCells(1, 1, 1, labels.length);
  titleRow.height = 30;
  titleRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 13 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  const headerRow = ws.addRow(labels);
  headerRow.height = 36;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: labels.length } };
  const BTHIN = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const BRL_FMT = '"R$"\\ #,##0.00';
  rows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF0FDF4';
    const values = COLS.map(col => {
      const v = String((row as unknown as Record<string, unknown>)[col.key] ?? '');
      if (col.type === 'currency') return parseFloat(v.replace(',', '.')) || null;
      if (col.type === 'date') {
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) { const [d, m, y] = v.split('/'); return new Date(+y, +m - 1, +d); }
        if (/^\d{4}-\d{2}-\d{2}/.test(v)) { const [y, m, d] = v.split('-'); return new Date(+y, +m - 1, +d); }
        return v;
      }
      return v || '';
    });
    const dr = ws.addRow(values);
    dr.height = 17;
    dr.eachCell({ includeEmpty: true }, (cell, ci) => {
      const col = COLS[ci - 1];
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
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
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

// ─── Parse Excel ──────────────────────────────────────────────────────────────
function parseExcelFile(buffer: ArrayBuffer): Omit<JurosRotativoRow, 'id' | 'highlight' | 'annotation'>[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return raw.map(r => ({
    dataPagamento: String(r['Data de Pagamento'] ?? r['DATA_PAGAMENTO'] ?? r['Data Pagamento'] ?? ''),
    notaFiscal:    String(r['Nota Fiscal']       ?? r['NOTA_FISCAL']    ?? r['Titulo']         ?? ''),
    jurosPagos:    String(r['Juros Pagos']       ?? r['JUROS_PAGOS']    ?? r['Acrescimos']     ?? ''),
  }));
}

const EMPTY_EDIT: JurosRotativoRow = {
  id: '', dataPagamento: '', notaFiscal: '', jurosPagos: '', highlight: false, annotation: '', periodoImport: undefined,
};

function getPeriodo(r: JurosRotativoRow): { year: number; month: number } | null {
  if (r.periodoImport) {
    const [y, m] = r.periodoImport.split('-').map(Number);
    if (y && m) return { year: y, month: m };
  }
  return parseDate(r.dataPagamento);
}

/** Detecta o período predominante (ano+mês mais frequente) de um conjunto de linhas importadas */
function detectPeriodo(rows: { dataPagamento: string }[]): { year: number; month: number } | null {
  const counts = new Map<string, { year: number; month: number; count: number }>();
  for (const r of rows) {
    const d = parseDate(r.dataPagamento);
    if (!d) continue;
    const key = `${d.year}-${d.month}`;
    const cur = counts.get(key);
    counts.set(key, cur ? { ...cur, count: cur.count + 1 } : { year: d.year, month: d.month, count: 1 });
  }
  if (counts.size === 0) return null;
  return Array.from(counts.values()).sort((a, b) => b.count - a.count)[0];
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function JurosRotativoDashboard() {
  const [rows, setRows]               = useState<JurosRotativoRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filterYear, setFilterYear]   = useState<number>(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(new Date().getMonth() + 1);

  const [confirmImportTxt, setConfirmImportTxt]   = useState(false);
  const [confirmImportXlsx, setConfirmImportXlsx] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId]     = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll]   = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editValues, setEditValues]   = useState<JurosRotativoRow>(EMPTY_EDIT);
  const [expandedAnnotations, setExpandedAnnotations] = useState<Set<string>>(new Set());

  const txtInputRef    = useRef<HTMLInputElement>(null);
  const xlsxInputRef   = useRef<HTMLInputElement>(null);
  const tableRef       = useRef<HTMLDivElement>(null);
  const scrollbarRef   = useRef<HTMLDivElement>(null);
  const scrollDummyRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => {
      if (scrollDummyRef.current && tableRef.current)
        scrollDummyRef.current.style.width = tableRef.current.scrollWidth + 'px';
    }, 50);
    return () => clearTimeout(t);
  });

  useEffect(() => {
    setLoading(true);
    loadJurosRotativoRows().then(async data => {
      if (data.length === 0) {
        const empty = Array.from({ length: 10 }, () => createEmptyJurosRotativoRow());
        await saveJurosRotativoRows(empty);
        setRows(empty);
      } else {
        setRows(data);
      }
      setLoading(false);
    });
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    rows.forEach(r => {
      // usa periodoImport se disponível, senão dataPagamento
      if (r.periodoImport) {
        const [y] = r.periodoImport.split('-').map(Number);
        if (y) years.add(y);
      } else {
        const d = parseDate(r.dataPagamento);
        if (d) years.add(d.year);
      }
    });
    const sorted = Array.from(years).sort((a, b) => b - a);
    return sorted.length ? sorted : [new Date().getFullYear()];
  }, [rows]);

  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    rows.forEach(r => {
      const periodo = getPeriodo(r);
      if (periodo && periodo.year === filterYear)
        counts[periodo.month] = (counts[periodo.month] ?? 0) + 1;
    });
    return counts;
  }, [rows, filterYear]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const periodo = getPeriodo(r);
      if (!periodo) return true;
      if (periodo.year !== filterYear) return false;
      if (filterMonth !== null && periodo.month !== filterMonth) return false;
      return true;
    });
  }, [rows, filterYear, filterMonth]);

  const totalJuros = useMemo(() => sumJuros(filteredRows), [filteredRows]);

  async function persistRows(updated: JurosRotativoRow[]) {
    setRows(updated);
    await saveJurosRotativoRows(updated);
  }

  async function handleDeleteAll() {
    const kept = rows.filter(r => {
      const d = parseDate(r.dataPagamento);
      if (!d) return true;
      return !(d.year === filterYear && d.month === filterMonth!);
    });
    await persistRows(kept);
    setConfirmDeleteAll(false);
    toast.success(`Linhas de ${MONTHS[filterMonth! - 1]}/${filterYear} excluídas.`);
  }

  async function handleToggleHighlight(row: JurosRotativoRow) {
    await persistRows(rows.map(r => r.id === row.id ? { ...r, highlight: !r.highlight } : r));
  }

  function handleEdit(row: JurosRotativoRow) { setEditingId(row.id); setEditValues({ ...row }); }
  function handleEditChange(field: keyof JurosRotativoRow, value: string) {
    setEditValues(prev => ({ ...prev, [field]: value }));
  }
  async function handleSaveEdit() {
    await persistRows(rows.map(r => r.id === editValues.id ? editValues : r));
    setEditingId(null);
    toast.success('Linha salva.');
  }
  function handleCancelEdit() { setEditingId(null); }

  async function handleConfirmDelete() {
    if (!confirmDeleteId) return;
    await persistRows(rows.filter(r => r.id !== confirmDeleteId));
    setConfirmDeleteId(null);
    toast.success('Linha excluída.');
  }

  function handleToggleAnnotation(id: string) {
    setExpandedAnnotations(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function handleAnnotationChange(id: string, text: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, annotation: text } : r));
  }
  async function handleAnnotationBlur() { await saveJurosRotativoRows(rows); }

  // ─── Importar TXT ────────────────────────────────────────────────────────────
  function handleTxtClick() { setConfirmImportTxt(true); }
  function handleConfirmImportTxt() { setConfirmImportTxt(false); txtInputRef.current?.click(); }

  async function handleTxtImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseTxtJurosRotativo(text);
    if (parsed.length === 0) {
      toast.warning('Nenhum registro reconhecido no arquivo TXT. Verifique o formato.');
      if (txtInputRef.current) txtInputRef.current.value = '';
      return;
    }
    const { total } = await replaceJurosRotativoRows(parsed);
    const updated = await loadJurosRotativoRows();
    setRows(updated);
    setEditingId(null);
    // detecta período predominante para pular o filtro automaticamente
    const periodo = detectPeriodo(parsed);
    if (periodo) { setFilterYear(periodo.year); setFilterMonth(periodo.month); }
    const periodoLabel = periodo ? ` — ${MONTHS[periodo.month - 1]}/${periodo.year}` : '';
    toast.success(`${total} registro(s) importado(s)${periodoLabel}.`);
    if (txtInputRef.current) txtInputRef.current.value = '';
  }

  // ─── Importar Excel ───────────────────────────────────────────────────────────
  function handleXlsxClick() { setConfirmImportXlsx(true); }
  function handleConfirmImportXlsx() { setConfirmImportXlsx(false); xlsxInputRef.current?.click(); }

  async function handleXlsxImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const parsed = parseExcelFile(buffer);
    if (parsed.length === 0) {
      toast.warning('Nenhum registro encontrado.');
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';
      return;
    }
    const { total } = await replaceJurosRotativoRows(parsed);
    const updated = await loadJurosRotativoRows();
    setRows(updated);
    setEditingId(null);
    const periodo = detectPeriodo(parsed);
    if (periodo) { setFilterYear(periodo.year); setFilterMonth(periodo.month); }
    const periodoLabel = periodo ? ` — ${MONTHS[periodo.month - 1]}/${periodo.year}` : '';
    toast.success(`${total} registro(s) importado(s)${periodoLabel}.`);
    if (xlsxInputRef.current) xlsxInputRef.current.value = '';
  }

  // ─── Exportar Excel ───────────────────────────────────────────────────────────
  async function handleExport() {
    try {
      const monthLabel = filterMonth ? MONTHS[filterMonth - 1] : 'Ano-todo';
      const sheetName  = `Juros Rotativo — ${monthLabel}-${filterYear}`;
      await exportToExcel(filteredRows, sheetName, `juros_rotativo_${filterYear}_${monthLabel}.xlsx`);
      toast.success('Arquivo Excel gerado!');
    } catch (err) {
      console.error('Erro ao gerar Excel:', err);
      toast.error(`Erro ao gerar Excel: ${String(err)}`);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
      <input ref={txtInputRef}  type="file" accept=".txt"            className="hidden" onChange={handleTxtImport} />
      <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls,.ods" className="hidden" onChange={handleXlsxImport} />

      {/* Confirmar importar TXT */}
      {confirmImportTxt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Importar TXT — Juros Rotativo</p>
                <p className="text-slate-500 text-xs mt-1">Os dados atuais serão <strong>substituídos</strong>. O período será detectado automaticamente pelas datas do arquivo.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmImportTxt(false)}>Cancelar</Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConfirmImportTxt}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar importar Excel */}
      {confirmImportXlsx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Importar Excel — Juros Rotativo</p>
                <p className="text-slate-500 text-xs mt-1">Os dados atuais serão <strong>substituídos</strong>. O período será detectado automaticamente pelas datas do arquivo.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmImportXlsx(false)}>Cancelar</Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConfirmImportXlsx}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar excluir tudo */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Excluir todas as linhas</p>
                <p className="text-slate-500 text-xs mt-1">Deseja excluir todas as linhas de <strong>{MONTHS[(filterMonth ?? 1) - 1]}/{filterYear}</strong>? Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteAll(false)}>Não</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteAll}>Sim, excluir tudo</Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar excluir linha */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Excluir linha</p>
                <p className="text-slate-500 text-xs mt-1">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleConfirmDelete}>Excluir</Button>
            </div>
          </div>
        </div>
      )}

      {/* Barra superior: título + botões */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0">
        <span className="px-5 py-3 text-sm font-medium border-b-2 border-emerald-500 text-emerald-700 bg-emerald-50/50">
          Juros Rotativo
        </span>
        <div className="flex items-center gap-2 py-1.5">
          <Button size="sm" variant="outline" className="flex items-center gap-2 border-purple-300 text-purple-700 hover:bg-purple-50 h-8 text-xs" onClick={handleTxtClick}>
            <FileText className="w-3.5 h-3.5" />Importar TXT
          </Button>
          <Button size="sm" variant="outline" className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 h-8 text-xs" onClick={handleXlsxClick}>
            <FileSpreadsheet className="w-3.5 h-3.5" />Importar Excel
          </Button>
          <Button size="sm" variant="outline" className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" />Exportar
          </Button>
          <Button size="sm" variant="outline" className="flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50 h-8 text-xs disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => setConfirmDeleteAll(true)} disabled={filterMonth === null}>
            <Trash2 className="w-3.5 h-3.5" />Limpar Tudo
          </Button>
        </div>
      </div>

      {/* Filtro ano / mês */}
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
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterMonth === null ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
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
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isActive ? 'bg-emerald-600 text-white shadow-sm' : hasData ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-800' : 'text-slate-300 cursor-default'}`}
            >
              {name}
              {hasData && (
                <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 rounded-full leading-none py-0.5 ${isActive ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-600'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sumário */}
      <div className="bg-white border-b border-slate-100 px-6 py-2 flex items-center gap-6 flex-shrink-0">
        <span className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{filteredRows.length}</span> registro{filteredRows.length !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-slate-500">
          Total Juros: <span className="font-semibold text-slate-700 font-mono">
            {totalJuros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </span>
      </div>

      {/* Tabela */}
      <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
        <div
          ref={tableRef}
          onScroll={() => { if (scrollbarRef.current && tableRef.current) scrollbarRef.current.scrollLeft = tableRef.current.scrollLeft; }}
          className="flex-1 overflow-auto"
          style={{ minHeight: 0 }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Carregando...</div>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-emerald-700 text-white">
                  {COLS.map(h => (
                    <th key={h.key} className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap">
                      {h.label}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap w-28">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row, i) => {
                  const isEditing = editingId === row.id;
                  const ev = editValues;
                  const rowBg = row.highlight
                    ? 'bg-amber-50 border-l-4 border-l-amber-400'
                    : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
                  return (
                    <Fragment key={row.id}>
                      <tr className={`${rowBg} border-b border-slate-100 hover:bg-emerald-50/40 transition-colors`}>
                        {/* Data de Pagamento */}
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                          {isEditing
                            ? <input className="w-28 border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" placeholder="DD/MM/AAAA" value={ev.dataPagamento} onChange={e => handleEditChange('dataPagamento', e.target.value)} />
                            : row.dataPagamento || <span className="text-slate-300">-</span>
                          }
                        </td>
                        {/* Nota Fiscal */}
                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                          {isEditing
                            ? <input className="w-32 border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" value={ev.notaFiscal} onChange={e => handleEditChange('notaFiscal', e.target.value)} />
                            : row.notaFiscal || <span className="text-slate-300">-</span>
                          }
                        </td>
                        {/* Juros Pagos */}
                        <td className="px-3 py-2 font-mono text-emerald-700 whitespace-nowrap">
                          {isEditing
                            ? <input className="w-28 border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" value={ev.jurosPagos} onChange={e => handleEditChange('jurosPagos', e.target.value)} />
                            : fmtCurrency(row.jurosPagos)
                          }
                        </td>
                        {/* Ações */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={handleSaveEdit} title="Salvar" className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"><Check className="w-4 h-4" /></button>
                              <button onClick={handleCancelEdit} title="Cancelar" className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition-colors"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-0.5">
                              <button onClick={() => handleToggleHighlight(row)} title="Evidenciar linha" className={`p-1.5 rounded transition-colors ${row.highlight ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50'}`}><Highlighter className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleEdit(row)} title="Editar" className="p-1.5 rounded text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setConfirmDeleteId(row.id)} title="Excluir" className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleToggleAnnotation(row.id)} title="Anotação" className={`p-1.5 rounded transition-colors ${expandedAnnotations.has(row.id) || row.annotation ? 'text-indigo-500 bg-indigo-50' : 'text-slate-300 hover:text-indigo-400 hover:bg-indigo-50'}`}><StickyNote className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {expandedAnnotations.has(row.id) && (
                        <tr className={row.highlight ? 'bg-amber-50/60' : 'bg-slate-50/40'}>
                          <td colSpan={4} className="px-4 pb-2 pt-1">
                            <textarea
                              value={row.annotation}
                              onChange={e => handleAnnotationChange(row.id, e.target.value)}
                              onBlur={handleAnnotationBlur}
                              placeholder="Escreva uma anotação..."
                              className="w-full text-xs text-slate-600 bg-white border border-indigo-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              rows={2}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div
          ref={scrollbarRef}
          onScroll={() => { if (tableRef.current && scrollbarRef.current) tableRef.current.scrollLeft = scrollbarRef.current.scrollLeft; }}
          className="overflow-x-auto overflow-y-hidden shrink-0 border-t border-slate-100 bg-white"
          style={{ height: 14 }}
        >
          <div ref={scrollDummyRef} style={{ height: 1 }} />
        </div>
      </div>
    </div>
  );
}
