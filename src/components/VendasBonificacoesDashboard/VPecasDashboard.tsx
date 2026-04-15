import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { Upload, Download, FileSpreadsheet, ChevronDown, AlertTriangle, Pencil, Trash2, Highlighter, StickyNote, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  type VPecasRow,
  NF_HEADERS,
  CURRENCY_FIELDS,
  DATE_FIELDS,
  loadVPecasRows,
  appendVPecasRows,
  replaceVPecasRows,
  saveVPecasRows,
  parsePecasTxt,
  parsePecasExcel,
  loadVPecasDevolucaoRows,
  saveVPecasDevolucaoRows,
  appendVPecasDevolucaoRows,
  parsePecasDevolucaoTxt,
} from './vPecasStorage';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const KPI_FIELDS = ['TOT_NOTA_FISCAL', 'LIQ_NOTA_FISCAL', 'TOT_CUSTO_MEDIO', 'VALDESCONTO', 'VAL_ICMS'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseDate(raw: string): { year: number; month: number } | null {
  if (!raw) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('/');
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!isNaN(d.getTime())) return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  return null;
}

function getRowPeriod(r: VPecasRow): { year: number; month: number } | null {
  if (r.periodoImport) {
    const [y, m] = r.periodoImport.split('-').map(Number);
    if (y && m) return { year: y, month: m };
  }
  return (
    parseDate(r.data['DTA_ENTRADA_SAIDA'] ?? '') ??
    parseDate(r.data['DTA_DOCUMENTO'] ?? '')
  );
}

function fmtCurrency(raw: string): string {
  const n = parseFloat(String(raw).replace(',', '.'));
  if (isNaN(n) || raw === '' || raw === '0') return raw === '0' ? 'R$ 0,00' : (raw || '-');
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function sumField(rows: VPecasRow[], key: string): number {
  return rows.reduce((acc, r) => {
    const n = parseFloat(String(r.data[key] ?? '').replace(',', '.'));
    return acc + (isNaN(n) ? 0 : n);
  }, 0);
}

function colType(key: string): 'currency' | 'date' | 'text' {
  if (CURRENCY_FIELDS.has(key)) return 'currency';
  if (DATE_FIELDS.has(key)) return 'date';
  return 'text';
}

// ─── Exportar Excel ───────────────────────────────────────────────────────────
async function exportToExcel(rows: VPecasRow[], allCols: string[], filename: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();
  const ws = wb.addWorksheet('V. Pecas', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: 'FF7C3AED' } },
  });

  ws.columns = allCols.map(() => ({ width: 18 }));

  const today = new Date().toLocaleDateString('pt-BR');
  const titleRow = ws.addRow([`V. Pecas - ${today}`]);
  ws.mergeCells(1, 1, 1, allCols.length);
  titleRow.height = 30;
  titleRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C1D95' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 13 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const headerRow = ws.addRow(allCols);
  headerRow.height = 36;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: allCols.length } };

  const BTHIN = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const BRL_FMT = '"R$"\\ #,##0.00';

  rows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF5F3FF';
    const values = allCols.map(h => {
      const v = row.data[h] ?? '';
      if (CURRENCY_FIELDS.has(h)) return parseFloat(v.replace(',', '.')) || null;
      if (DATE_FIELDS.has(h)) {
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) { const [d, m, y] = v.split('/'); return new Date(+y, +m - 1, +d); }
        return v;
      }
      return v || '';
    });
    const dr = ws.addRow(values);
    dr.height = 17;
    dr.eachCell({ includeEmpty: true }, (cell, ci) => {
      const h = allCols[ci - 1];
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { top: BTHIN, bottom: BTHIN, left: BTHIN, right: BTHIN };
      if (!h) return;
      if (CURRENCY_FIELDS.has(h)) {
        cell.numFmt = BRL_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { size: 9, name: 'Courier New' };
      } else if (DATE_FIELDS.has(h)) {
        if (cell.value instanceof Date) cell.numFmt = 'DD/MM/YYYY';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { size: 9 };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { size: 9 };
      }
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function VPecasDashboard() {
  const [rows, setRows]               = useState<VPecasRow[]>([]);
  const [devolucaoRows, setDevolucaoRows] = useState<VPecasRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filterYear, setFilterYear]   = useState<number>(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(new Date().getMonth() + 1);

  const txtInputRef  = useRef<HTMLInputElement>(null);
  const devolTxtRef  = useRef<HTMLInputElement>(null);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const tableRef     = useRef<HTMLDivElement>(null);

  const [importPeriodModal, setImportPeriodModal] = useState(false);
  const [importPeriodYear, setImportPeriodYear]   = useState<number>(new Date().getFullYear());
  const [importPeriodMonth, setImportPeriodMonth] = useState<number>(new Date().getMonth() + 1);
  const [devolPeriodModal, setDevolPeriodModal]   = useState(false);
  const [devolPeriodYear, setDevolPeriodYear]     = useState<number>(new Date().getFullYear());
  const [devolPeriodMonth, setDevolPeriodMonth]   = useState<number>(new Date().getMonth() + 1);
  const [confirmImport, setConfirmImport]         = useState(false);
  const [confirmDeleteId, setConfirmDeleteId]     = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll]   = useState(false);
  const [editModal, setEditModal]                 = useState<VPecasRow | null>(null);
  const [editValues, setEditValues]               = useState<Record<string, string> | null>(null);
  const [expandedAnnotations, setExpandedAnnotations] = useState<Set<string>>(new Set());

  // Colunas dinamicas: NF_HEADERS + extras presentes nos dados
  const allColumns = useMemo(() => {
    const extras = new Set<string>();
    [...rows, ...devolucaoRows].forEach(r => Object.keys(r.data).forEach(k => {
      if (!NF_HEADERS.includes(k as never)) extras.add(k);
    }));
    return [...NF_HEADERS, ...Array.from(extras)];
  }, [rows, devolucaoRows]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadVPecasRows(), loadVPecasDevolucaoRows()]).then(([data, devol]) => {
      setRows(data);
      setDevolucaoRows(devol);
      setLoading(false);
    });
  }, []);

  const allRows = useMemo(() => [...rows, ...devolucaoRows], [rows, devolucaoRows]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allRows.forEach(r => { const d = getRowPeriod(r); if (d) years.add(d.year); });
    const sorted = Array.from(years).sort((a, b) => b - a);
    return sorted.length ? sorted : [new Date().getFullYear()];
  }, [allRows]);

  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    allRows.forEach(r => {
      const d = getRowPeriod(r);
      if (d && d.year === filterYear) counts[d.month] = (counts[d.month] ?? 0) + 1;
    });
    return counts;
  }, [allRows, filterYear]);

  const filteredRows = useMemo(() => allRows.filter(r => {
    const d = getRowPeriod(r);
    if (!d) return false;
    if (d.year !== filterYear) return false;
    if (filterMonth !== null && d.month !== filterMonth) return false;
    return true;
  }), [allRows, filterYear, filterMonth]);

  const kpis = useMemo(() =>
    Object.fromEntries(KPI_FIELDS.map(k => [k, sumField(filteredRows, k)])),
    [filteredRows]
  );

  // ─── Acoes ──────────────────────────────────────────────────────────────────
  async function handleToggleHighlight(row: VPecasRow) {
    if (row.isDevolucao) {
      const updated = devolucaoRows.map(r => r.id === row.id ? { ...r, highlight: !r.highlight } : r);
      setDevolucaoRows(updated);
      await saveVPecasDevolucaoRows(updated);
    } else {
      const updated = rows.map(r => r.id === row.id ? { ...r, highlight: !r.highlight } : r);
      setRows(updated);
      await saveVPecasRows(updated);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteId) return;
    const isDevol = devolucaoRows.some(r => r.id === confirmDeleteId);
    if (isDevol) {
      const updated = devolucaoRows.filter(r => r.id !== confirmDeleteId);
      setDevolucaoRows(updated);
      await saveVPecasDevolucaoRows(updated);
    } else {
      const updated = rows.filter(r => r.id !== confirmDeleteId);
      setRows(updated);
      await saveVPecasRows(updated);
    }
    setConfirmDeleteId(null);
    toast.success('Linha excluida.');
  }

  function handleToggleAnnotation(id: string) {
    setExpandedAnnotations(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleAnnotationChange(id: string, text: string) {
    if (devolucaoRows.some(r => r.id === id)) {
      setDevolucaoRows(prev => prev.map(r => r.id === id ? { ...r, annotation: text } : r));
    } else {
      setRows(prev => prev.map(r => r.id === id ? { ...r, annotation: text } : r));
    }
  }

  async function handleAnnotationBlur() {
    await saveVPecasRows(rows);
    await saveVPecasDevolucaoRows(devolucaoRows);
  }

  async function handleSaveEditModal() {
    if (!editModal || !editValues) return;
    if (editModal.isDevolucao) {
      const updated = devolucaoRows.map(r =>
        r.id === editModal.id ? { ...r, data: { ...r.data, ...editValues } } : r
      );
      setDevolucaoRows(updated);
      await saveVPecasDevolucaoRows(updated);
    } else {
      const updated = rows.map(r =>
        r.id === editModal.id ? { ...r, data: { ...r.data, ...editValues } } : r
      );
      setRows(updated);
      await saveVPecasRows(updated);
    }
    setEditModal(null);
    setEditValues(null);
    toast.success('Linha salva.');
  }

  async function handleDeleteAll() {
    const periodFilter = (r: VPecasRow) => {
      const d = getRowPeriod(r);
      if (!d) return true;
      return !(d.year === filterYear && d.month === filterMonth!);
    };
    const keptVendas = rows.filter(periodFilter);
    const keptDevol  = devolucaoRows.filter(periodFilter);
    setRows(keptVendas);
    setDevolucaoRows(keptDevol);
    await saveVPecasRows(keptVendas);
    await saveVPecasDevolucaoRows(keptDevol);
    setConfirmDeleteAll(false);
    toast.success(`Linhas de ${MONTHS[(filterMonth ?? 1) - 1]}/${filterYear} excluidas.`);
  }

  async function handleTxtImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parsePecasTxt(text);
    if (parsed.length === 0) {
      toast.warning('Nenhuma NF reconhecida no arquivo.');
      if (txtInputRef.current) txtInputRef.current.value = '';
      return;
    }
    const periodo = `${importPeriodYear}-${String(importPeriodMonth).padStart(2, '0')}`;
    const { added } = await appendVPecasRows(parsed.map(r => ({ ...r, periodoImport: periodo })));
    const updated = await loadVPecasRows();
    setRows(updated);
    toast.success(`${added} NF(s) importada(s) - ${MONTHS[importPeriodMonth - 1]}/${importPeriodYear}.`);
    if (txtInputRef.current) txtInputRef.current.value = '';
  }

  function handleXlsxClick() { setConfirmImport(true); }
  function handleConfirmImport() { setConfirmImport(false); xlsxInputRef.current?.click(); }

  async function handleDevolucaoTxtImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parsePecasDevolucaoTxt(text);
    if (parsed.length === 0) {
      toast.warning('Nenhuma NF de devolução (P07/A07) reconhecida no arquivo.');
      if (devolTxtRef.current) devolTxtRef.current.value = '';
      return;
    }
    const periodo = `${devolPeriodYear}-${String(devolPeriodMonth).padStart(2, '0')}`;
    const { added, removed } = await appendVPecasDevolucaoRows(periodo, parsed);
    const updated = await loadVPecasDevolucaoRows();
    setDevolucaoRows(updated);
    const msg = removed > 0
      ? `${added} NF(s) de devolução importada(s) · ${removed} substituída(s) — ${MONTHS[devolPeriodMonth - 1]}/${devolPeriodYear}.`
      : `${added} NF(s) de devolução importada(s) — ${MONTHS[devolPeriodMonth - 1]}/${devolPeriodYear}.`;
    toast.success(msg);
    if (devolTxtRef.current) devolTxtRef.current.value = '';
  }

  async function handleXlsxImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const parsed = parsePecasExcel(buffer);
    if (parsed.length === 0) {
      toast.warning('Nenhum registro encontrado no Excel.');
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';
      return;
    }
    const { total } = await replaceVPecasRows(parsed);
    const updated = await loadVPecasRows();
    setRows(updated);
    toast.success(`${total} registro(s) importado(s) - dados anteriores substituidos.`);
    if (xlsxInputRef.current) xlsxInputRef.current.value = '';
  }

  async function handleExport() {
    try {
      const monthLabel = filterMonth ? MONTHS[filterMonth - 1] : 'Ano-todo';
      await exportToExcel(filteredRows, allColumns, `vpecas_${filterYear}_${monthLabel}.xlsx`);
      toast.success('Arquivo Excel gerado!');
    } catch (err) {
      console.error('Erro ao gerar Excel:', err);
      toast.error(`Erro ao gerar Excel: ${String(err)}`);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
      <input ref={txtInputRef}   type="file" accept=".txt"            className="hidden" onChange={handleTxtImport} />
      <input ref={devolTxtRef}   type="file" accept=".txt"            className="hidden" onChange={handleDevolucaoTxtImport} />
      <input ref={xlsxInputRef}  type="file" accept=".xlsx,.xls,.ods" className="hidden" onChange={handleXlsxImport} />

      {importPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-5">
              <Upload className="w-5 h-5 text-violet-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Importar TXT - Periodo?</p>
                <p className="text-slate-500 text-xs mt-1">Os registros serao classificados no mes/ano informado.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Mes</label>
                <select value={importPeriodMonth} onChange={e => setImportPeriodMonth(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Ano</label>
                <select value={importPeriodYear} onChange={e => setImportPeriodYear(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setImportPeriodModal(false)}>Cancelar</Button>
              <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white"
                onClick={() => { setImportPeriodModal(false); txtInputRef.current?.click(); }}>
                Confirmar e selecionar arquivo
              </Button>
            </div>
          </div>
        </div>
      )}

      {devolPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-5">
              <Upload className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Importar Devoluções (P07/A07) — Período?</p>
                <p className="text-slate-500 text-xs mt-1">Os valores monetários serão negativados. Se já houver devoluções neste mês, serão substituídas.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Mes</label>
                <select value={devolPeriodMonth} onChange={e => setDevolPeriodMonth(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Ano</label>
                <select value={devolPeriodYear} onChange={e => setDevolPeriodYear(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setDevolPeriodModal(false)}>Cancelar</Button>
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => { setDevolPeriodModal(false); devolTxtRef.current?.click(); }}>
                Confirmar e selecionar arquivo
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Excluir linha</p>
                <p className="text-slate-500 text-xs mt-1">Esta acao nao pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="text-xs border border-slate-200 rounded px-3 py-1.5 hover:bg-slate-50" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
              <button className="text-xs bg-red-600 hover:bg-red-700 text-white rounded px-3 py-1.5" onClick={handleConfirmDelete}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Limpar Tudo</p>
                <p className="text-slate-500 text-xs mt-1">
                  Deseja excluir todos os registros de <strong>{MONTHS[(filterMonth ?? 1) - 1]}/{filterYear}</strong>?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteAll(false)}>Nao</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteAll}>Sim, excluir</Button>
            </div>
          </div>
        </div>
      )}

      {confirmImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Importar Excel - V. Pecas</p>
                <p className="text-slate-500 text-xs mt-1">Os dados atuais serao <strong>substituidos</strong>.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmImport(false)}>Cancelar</Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConfirmImport}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}

      {editModal && editValues && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <p className="font-semibold text-slate-800 text-sm">
                Editar NF {editModal.data['NUMERO_NOTA_FISCAL'] || editModal.id}
              </p>
              <button onClick={() => { setEditModal(null); setEditValues(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-2 text-xs">
                {allColumns.map(col => (
                  <div key={col}>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 truncate">{col}</label>
                    <input
                      className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300"
                      value={editValues[col] ?? ''}
                      onChange={e => setEditValues(prev => prev ? { ...prev, [col]: e.target.value } : prev)}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 flex-shrink-0">
              <button className="text-xs border border-slate-200 rounded px-3 py-1.5 hover:bg-slate-50"
                onClick={() => { setEditModal(null); setEditValues(null); }}>Cancelar</button>
              <button className="text-xs bg-violet-600 hover:bg-violet-700 text-white rounded px-3 py-1.5 flex items-center gap-1.5"
                onClick={handleSaveEditModal}>
                <Check className="w-3.5 h-3.5" />Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de botoes */}
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-3 flex-shrink-0 flex-wrap">
        <Button size="sm" className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          onClick={() => setImportPeriodModal(true)}>
          <Upload className="w-4 h-4" />Importar TXT
        </Button>
        <Button size="sm" className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white"
          onClick={() => setDevolPeriodModal(true)}>
          <Upload className="w-4 h-4" />Importar Devoluções
        </Button>
        <Button size="sm" variant="outline" className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
          onClick={handleXlsxClick}>
          <FileSpreadsheet className="w-4 h-4" />Importar Excel
        </Button>
        <Button size="sm" variant="outline" className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50"
          onClick={handleExport}>
          <Download className="w-4 h-4" />Exportar
        </Button>
        <Button size="sm" variant="outline"
          className="flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => setConfirmDeleteAll(true)} disabled={filterMonth === null}>
          <Trash2 className="w-4 h-4" />Limpar Tudo
        </Button>
        <span className="text-xs text-slate-400">
          TXT: acumula · Excel: substitui · {allColumns.length} colunas
        </span>
      </div>

      {/* Filtro Ano / Mes */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 flex-shrink-0 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">ANO</span>
        <div className="relative mr-2">
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
            className="appearance-none text-sm font-bold text-slate-700 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer">
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="w-px h-5 bg-slate-200 mr-1" />
        <button onClick={() => setFilterMonth(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterMonth === null ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
          Ano todo
        </button>
        {MONTHS.map((name, idx) => {
          const m = idx + 1;
          const count = monthCounts[m] ?? 0;
          const isActive = filterMonth === m;
          const hasData = count > 0;
          return (
            <button key={m} onClick={() => hasData ? setFilterMonth(m) : undefined}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive ? 'bg-violet-600 text-white shadow-sm' : hasData ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-300 cursor-default'
              }`}>
              {name}
              {hasData && (
                <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 rounded-full leading-none py-0.5 ${
                  isActive ? 'bg-white text-violet-700' : 'bg-violet-100 text-violet-600'
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* KPIs */}
      <div className="bg-white border-b border-slate-100 px-6 py-2 flex items-center gap-6 flex-shrink-0 flex-wrap">
        <span className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{filteredRows.length}</span> NF{filteredRows.length !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-slate-500">
          Total NF: <span className="font-semibold text-violet-700 font-mono">
            {kpis['TOT_NOTA_FISCAL']?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </span>
        <span className="text-xs text-slate-500">
          Liquido: <span className="font-semibold text-emerald-700 font-mono">
            {kpis['LIQ_NOTA_FISCAL']?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </span>
        <span className="text-xs text-slate-500">
          Custo Medio: <span className="font-semibold text-slate-700 font-mono">
            {kpis['TOT_CUSTO_MEDIO']?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </span>
        <span className="text-xs text-slate-500">
          Desconto: <span className="font-semibold text-amber-700 font-mono">
            {kpis['VALDESCONTO']?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </span>
        <span className="text-xs text-slate-500">
          ICMS: <span className="font-semibold text-slate-700 font-mono">
            {kpis['VAL_ICMS']?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </span>
      </div>

      {/* Tabela */}
      <div ref={tableRef} className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Carregando...</div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-2">
            <FileSpreadsheet className="w-10 h-10" />
            <span className="text-sm">Nenhum registro - importe um arquivo TXT ou Excel</span>
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-violet-700 text-white">
                <th className="sticky left-0 z-20 bg-violet-700 px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap w-20">
                  Acoes
                </th>
                {allColumns.map(col => (
                  <th key={col}
                    className="bg-violet-700 px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row, i) => {
                const bgColor = row.highlight ? '#fffbeb' : i % 2 === 0 ? '#ffffff' : '#f8fafc';
                return (
                  <Fragment key={row.id}>
                    <tr className={`${
                      row.highlight ? 'bg-amber-50 border-l-4 border-l-amber-400' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                    } border-b border-slate-100 hover:bg-violet-50/30 transition-colors`}>
                      <td className="px-2 py-1.5 whitespace-nowrap sticky left-0 z-4"
                        style={{ background: bgColor }}>
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => handleToggleHighlight(row)} title="Evidenciar"
                            className={`p-1.5 rounded transition-colors ${row.highlight ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50'}`}>
                            <Highlighter className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleToggleAnnotation(row.id)} title="Anotacao"
                            className={`p-1.5 rounded transition-colors ${row.annotation ? 'text-sky-500 bg-sky-50' : 'text-slate-300 hover:text-sky-400 hover:bg-sky-50'}`}>
                            <StickyNote className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { setEditModal(row); setEditValues({ ...row.data }); }} title="Editar"
                            className="p-1.5 rounded text-slate-300 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setConfirmDeleteId(row.id)} title="Excluir"
                            className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      {allColumns.map(col => {
                        const val = row.data[col] ?? '';
                        const type = colType(col);
                        if (type === 'currency') {
                          return (
                            <td key={col} className="px-3 py-1.5 font-mono text-right whitespace-nowrap text-slate-700 text-[11px]">
                              {fmtCurrency(val)}
                            </td>
                          );
                        }
                        if (col === 'STATUS') {
                          const color = val.toUpperCase() === 'FECHADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600';
                          return (
                            <td key={col} className="px-3 py-1.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>{val || '-'}</span>
                            </td>
                          );
                        }
                        if (col === 'MODALIDADE') {
                          return (
                            <td key={col} className="px-3 py-1.5 whitespace-nowrap text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${val === 'G' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>
                                {val || '-'}
                              </span>
                            </td>
                          );
                        }
                        if (col === 'FISJUR') {
                          return (
                            <td key={col} className="px-3 py-1.5 whitespace-nowrap text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${val === 'J' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                {val || '-'}
                              </span>
                            </td>
                          );
                        }
                        return (
                          <td key={col} className="px-3 py-1.5 text-slate-700 whitespace-nowrap text-[11px] max-w-[220px] truncate">
                            {val || '-'}
                          </td>
                        );
                      })}
                    </tr>
                    {expandedAnnotations.has(row.id) && (
                      <tr key={`${row.id}-annot`} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td colSpan={allColumns.length + 1} className="px-4 pb-2">
                          <textarea
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none bg-sky-50/60"
                            rows={2} placeholder="Adicione uma anotacao..."
                            value={row.annotation ?? ''}
                            onChange={e => handleAnnotationChange(row.id, e.target.value)}
                            onBlur={handleAnnotationBlur}
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
    </div>
  );
}
