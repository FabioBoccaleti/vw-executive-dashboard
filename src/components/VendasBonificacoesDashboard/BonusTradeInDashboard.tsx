import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { Download, FileSpreadsheet, ChevronDown, AlertTriangle, Pencil, Trash2, Highlighter, StickyNote, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  type BonusTradeInRow,
  loadBonusTradeInRows,
  saveBonusTradeInRows,
  replaceBonusTradeInRows,
  createEmptyBonusTradeInRow,
} from './bonusTradeInStorage';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function parseDate(raw: string): { year: number; month: number } | null {
  if (!raw) return null;
  let d: Date | null = null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('/');
    d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  } else if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    d = new Date(raw);
  }
  if (!d || isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function fmtCurrency(raw: string): string {
  const n = parseFloat(String(raw).replace(',', '.'));
  if (isNaN(n)) return raw || '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function sumField(rows: BonusTradeInRow[]): number {
  return rows.reduce((acc, r) => {
    const n = parseFloat(String(r.valorTradeIn).replace(',', '.'));
    return acc + (isNaN(n) ? 0 : n);
  }, 0);
}

const COLS_TRADEIN = [
  { key: 'dataVenda',        label: 'Data da Venda',        type: 'date' },
  { key: 'cliente',          label: 'Cliente',              type: 'text' },
  { key: 'chassi',           label: 'Chassi',               type: 'text' },
  { key: 'modelo',           label: 'Modelo',               type: 'text' },
  { key: 'vendedor',         label: 'Vendedor',             type: 'text' },
  { key: 'nTitulo',          label: 'Nº Título',            type: 'text' },
  { key: 'valorTradeIn',     label: 'Valor do Trade IN',    type: 'currency' },
  { key: 'recebido',         label: 'Recebido',             type: 'currency' },
  { key: 'dataRecebimento',  label: 'Data do Recebimento',  type: 'date' },
] as const;

async function exportToExcel(rows: BonusTradeInRow[], sheetName: string, filename: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: 'FF10B981' } },
  });
  const labels = COLS_TRADEIN.map(c => c.label);
  ws.columns = labels.map(() => ({ width: 22 }));
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
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9.5 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: labels.length } };
  const BTHIN = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const BRL_FMT = '"R$"\ #,##0.00';
  rows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF0FDF4';
    const values = COLS_TRADEIN.map(col => {
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
      const col = COLS_TRADEIN[ci - 1];
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

function parseExcelFile(buffer: ArrayBuffer): Omit<BonusTradeInRow, 'id' | 'highlight' | 'annotation'>[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return raw.map(r => ({
    dataVenda:       String(r['Data da Venda']       ?? r['DATA_VENDA']        ?? ''),
    cliente:         String(r['Cliente']             ?? r['CLIENTE']           ?? ''),
    chassi:          String(r['Chassi']              ?? r['CHASSI']            ?? ''),
    modelo:          String(r['Modelo']              ?? r['MODELO']            ?? ''),
    vendedor:        String(r['Vendedor']            ?? r['VENDEDOR']          ?? ''),
    nTitulo:         String(r['N Titulo']            ?? r['N_TITULO']          ?? r['NUM_TITULO'] ?? ''),
    valorTradeIn:    String(r['Valor do Trade IN']   ?? r['VALOR_TRADE_IN']    ?? ''),
    recebido:        String(r['Recebido']            ?? r['RECEBIDO']          ?? ''),
    dataRecebimento: String(r['Data do Recebimento'] ?? r['DATA_RECEBIMENTO']  ?? ''),
  }));
}

const EMPTY_EDIT: BonusTradeInRow = { id: '', dataVenda: '', cliente: '', chassi: '', modelo: '', vendedor: '', nTitulo: '', valorTradeIn: '', recebido: '', dataRecebimento: '', highlight: false, annotation: '' };

const COLUMNS = ['Data da Venda','Cliente','Chassi','Modelo','Vendedor','N Titulo','Valor do Trade IN','Recebido','Data do Recebimento'];

export function BonusTradeInDashboard() {
  const [rows, setRows]               = useState<BonusTradeInRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filterYear, setFilterYear]   = useState<number>(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [confirmImport, setConfirmImport]     = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editValues, setEditValues]   = useState<BonusTradeInRow>(EMPTY_EDIT);
  const [expandedAnnotations, setExpandedAnnotations] = useState<Set<string>>(new Set());
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const xlsxInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    loadBonusTradeInRows().then(async data => {
      if (data.length === 0) {
        const empty = Array.from({ length: 10 }, () => createEmptyBonusTradeInRow());
        await saveBonusTradeInRows(empty);
        setRows(empty);
      } else {
        setRows(data);
      }
      setLoading(false);
    });
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    rows.forEach(r => { const d = parseDate(r.dataVenda); if (d) years.add(d.year); });
    const sorted = Array.from(years).sort((a, b) => b - a);
    return sorted.length ? sorted : [new Date().getFullYear()];
  }, [rows]);

  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    rows.forEach(r => {
      const d = parseDate(r.dataVenda);
      if (d && d.year === filterYear) counts[d.month] = (counts[d.month] ?? 0) + 1;
    });
    return counts;
  }, [rows, filterYear]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const d = parseDate(r.dataVenda);
      if (!d) return true;
      if (d.year !== filterYear) return false;
      if (filterMonth !== null && d.month !== filterMonth) return false;
      return true;
    });
  }, [rows, filterYear, filterMonth]);

  const totalValor = useMemo(() => sumField(filteredRows), [filteredRows]);

  async function persistRows(updated: BonusTradeInRow[]) {
    setRows(updated);
    await saveBonusTradeInRows(updated);
  }

  async function handleDeleteAll() {
    const kept = rows.filter(r => {
      const d = parseDate(r.dataVenda);
      if (!d) return true;
      return !(d.year === filterYear && d.month === filterMonth!);
    });
    await persistRows(kept);
    setConfirmDeleteAll(false);
    toast.success(`Linhas de ${MONTHS[filterMonth! - 1]}/${filterYear} excluídas.`);
  }

  async function handleToggleHighlight(row: BonusTradeInRow) {
    await persistRows(rows.map(r => r.id === row.id ? { ...r, highlight: !r.highlight } : r));
  }

  function handleEdit(row: BonusTradeInRow) { setEditingId(row.id); setEditValues({ ...row }); }
  function handleEditChange(field: keyof BonusTradeInRow, value: string) { setEditValues(prev => ({ ...prev, [field]: value })); }

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
    toast.success('Linha excluida.');
  }

  function handleToggleAnnotation(id: string) {
    setExpandedAnnotations(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function handleAnnotationChange(id: string, text: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, annotation: text } : r));
  }

  async function handleAnnotationBlur() { await saveBonusTradeInRows(rows); }

  function handleXlsxClick() { setConfirmImport(true); }
  function handleConfirmImport() { setConfirmImport(false); xlsxInputRef.current?.click(); }

  async function handleXlsxImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const buffer = await file.arrayBuffer();
    const parsed = parseExcelFile(buffer);
    if (parsed.length === 0) { toast.warning('Nenhum registro encontrado.'); if (xlsxInputRef.current) xlsxInputRef.current.value = ''; return; }
    const { total } = await replaceBonusTradeInRows(parsed);
    setRows(await loadBonusTradeInRows());
    setEditingId(null);
    toast.success(`${total} registro(s) importado(s).`);
    if (xlsxInputRef.current) xlsxInputRef.current.value = '';
  }

  async function handleExport() {
    try {
      const monthLabel = filterMonth ? MONTHS[filterMonth - 1] : 'Ano-todo';
      const sheetName  = `Bônus Trade IN — ${monthLabel}-${filterYear}`;
      await exportToExcel(filteredRows, sheetName, `bonus_trade_in_${filterYear}_${monthLabel}.xlsx`);
      toast.success('Arquivo Excel gerado!');
    } catch (err) {
      console.error('Erro ao gerar Excel:', err);
      toast.error(`Erro ao gerar Excel: ${String(err)}`);
    }
  }

  function cell(row: BonusTradeInRow, field: keyof BonusTradeInRow, w = 'w-24', currency = false) {
    const isEditing = editingId === row.id;
    const val = String(row[field]);
    if (isEditing) {
      return <input className={`${w} border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300`} value={String(editValues[field])} onChange={e => handleEditChange(field, e.target.value)} />;
    }
    if (currency) return <span className="font-mono text-emerald-700">{fmtCurrency(val)}</span>;
    return val ? <span>{val}</span> : <span className="text-slate-300">-</span>;
  }

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
      <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls,.ods" className="hidden" onChange={handleXlsxImport} />

      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Excluir todas as linhas</p>
                <p className="text-slate-500 text-xs mt-1">Deseja excluir todas as linhas de <strong>{MONTHS[filterMonth! - 1]}/{filterYear}</strong>? Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteAll(false)}>Não</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteAll}>Sim, excluir tudo</Button>
            </div>
          </div>
        </div>
      )}

      {confirmImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div><p className="font-semibold text-slate-800 text-sm">Importar Excel — Bonus Trade IN</p><p className="text-slate-500 text-xs mt-1">Os dados atuais serao <strong>substituidos</strong>.</p></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmImport(false)}>Cancelar</Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConfirmImport}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div><p className="font-semibold text-slate-800 text-sm">Excluir linha</p><p className="text-slate-500 text-xs mt-1">Esta acao nao pode ser desfeita.</p></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleConfirmDelete}>Excluir</Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0">
        <span className="px-5 py-3 text-sm font-medium border-b-2 border-emerald-500 text-emerald-700 bg-emerald-50/50">Bonus Trade IN</span>
        <div className="flex items-center gap-2 py-1.5">
          <Button size="sm" variant="outline" className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 h-8 text-xs" onClick={handleXlsxClick}><FileSpreadsheet className="w-3.5 h-3.5" />Importar</Button>
          <Button size="sm" variant="outline" className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs" onClick={handleExport}><Download className="w-3.5 h-3.5" />Exportar</Button>
          <Button size="sm" variant="outline" className="flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50 h-8 text-xs disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => setConfirmDeleteAll(true)} disabled={filterMonth === null}><Trash2 className="w-3.5 h-3.5" />Limpar Tudo</Button>
        </div>
      </div>

      <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 flex-shrink-0 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">ANO</span>
        <div className="relative mr-2">
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="appearance-none text-sm font-bold text-slate-700 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer">
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="w-px h-5 bg-slate-200 mr-1" />
        <button onClick={() => setFilterMonth(null)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterMonth === null ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>Ano todo</button>
        {MONTHS.map((name, idx) => {
          const m = idx + 1; const count = monthCounts[m] ?? 0; const isActive = filterMonth === m; const hasData = count > 0;
          return (
            <button key={m} onClick={() => hasData ? setFilterMonth(m) : undefined} className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isActive ? 'bg-emerald-600 text-white shadow-sm' : hasData ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-800' : 'text-slate-300 cursor-default'}`}>
              {name}
              {hasData && <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 rounded-full leading-none py-0.5 ${isActive ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-600'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="bg-white border-b border-slate-100 px-6 py-2 flex items-center gap-6 flex-shrink-0">
        <span className="text-xs text-slate-500"><span className="font-semibold text-slate-700">{filteredRows.length}</span> registro{filteredRows.length !== 1 ? 's' : ''}</span>
        <span className="text-xs text-slate-500">Total Trade IN: <span className="font-semibold text-slate-700 font-mono">{totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
      </div>

      <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Carregando...</div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-emerald-700 text-white">
                {COLUMNS.map(h => <th key={h} className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap">{h}</th>)}
                <th className="px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap w-28">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row, i) => {
                const isEditing = editingId === row.id;
                const ev = editValues;
                const rowBg = row.highlight ? 'bg-amber-50 border-l-4 border-l-amber-400' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
                return (
                  <Fragment key={row.id}>
                    <tr className={`${rowBg} border-b border-slate-100 hover:bg-emerald-50/40 transition-colors`}>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{isEditing ? <input className="w-24 border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" placeholder="DD/MM/AAAA" value={ev.dataVenda} onChange={e => handleEditChange('dataVenda', e.target.value)} /> : row.dataVenda || <span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{isEditing ? <input className="w-32 border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" value={ev.cliente} onChange={e => handleEditChange('cliente', e.target.value)} /> : row.cliente || <span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">{isEditing ? <input className="w-36 border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" value={ev.chassi} onChange={e => handleEditChange('chassi', e.target.value)} /> : row.chassi || <span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{isEditing ? <input className="w-32 border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" value={ev.modelo} onChange={e => handleEditChange('modelo', e.target.value)} /> : row.modelo || <span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{isEditing ? <input className="w-28 border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" value={ev.vendedor} onChange={e => handleEditChange('vendedor', e.target.value)} /> : row.vendedor || <span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{isEditing ? <input className="w-24 border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" value={ev.nTitulo} onChange={e => handleEditChange('nTitulo', e.target.value)} /> : row.nTitulo || <span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-2 font-mono text-emerald-700 whitespace-nowrap">{isEditing ? <input className="w-28 border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" value={ev.valorTradeIn} onChange={e => handleEditChange('valorTradeIn', e.target.value)} /> : fmtCurrency(row.valorTradeIn)}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{isEditing ? <input className="w-24 border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" value={ev.recebido} onChange={e => handleEditChange('recebido', e.target.value)} /> : row.recebido || <span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{isEditing ? <input className="w-24 border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" placeholder="DD/MM/AAAA" value={ev.dataRecebimento} onChange={e => handleEditChange('dataRecebimento', e.target.value)} /> : row.dataRecebimento || <span className="text-slate-300">-</span>}</td>
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
                            <button onClick={() => handleToggleAnnotation(row.id)} title="Anotacao" className={`p-1.5 rounded transition-colors ${expandedAnnotations.has(row.id) || row.annotation ? 'text-indigo-500 bg-indigo-50' : 'text-slate-300 hover:text-indigo-400 hover:bg-indigo-50'}`}><StickyNote className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {expandedAnnotations.has(row.id) && (
                      <tr className={row.highlight ? 'bg-amber-50/60' : 'bg-slate-50/40'}>
                        <td colSpan={10} className="px-4 pb-2 pt-1">
                          <textarea value={row.annotation} onChange={e => handleAnnotationChange(row.id, e.target.value)} onBlur={handleAnnotationBlur}
                            placeholder="Escreva uma anotacao..."
                            className="w-full text-xs text-slate-600 bg-white border border-indigo-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200" rows={2} />
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
    </div>
  );
}
