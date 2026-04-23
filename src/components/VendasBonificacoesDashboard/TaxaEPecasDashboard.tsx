import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { Upload, Download, FileSpreadsheet, ChevronDown, AlertTriangle, Pencil, Trash2, Highlighter, StickyNote, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  type TaxaEPecasRow,
  loadTaxaEPecasRows,
  appendTaxaEPecasRows,
  replaceTaxaEPecasRows,
  saveTaxaEPecasRows,
  parseTaxaEPecasTxt,
} from './taxaEPecasStorage';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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

function getRowPeriod(r: TaxaEPecasRow): { year: number; month: number } | null {
  if (r.periodoImport) {
    const [y, m] = r.periodoImport.split('-').map(Number);
    if (y && m) return { year: y, month: m };
  }
  for (const key of Object.keys(r.data)) {
    const lk = key.toLowerCase();
    if (lk.includes('data') || lk.includes('dta') || lk.includes('date')) {
      const parsed = parseDate(r.data[key]);
      if (parsed) return parsed;
    }
  }
  return null;
}

// ─── Exportar Excel ───────────────────────────────────────────────────────────
async function exportToExcel(rows: TaxaEPecasRow[], allCols: string[], filename: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();
  const ws = wb.addWorksheet('Taxa E-Peças', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: 'FF0D9488' } },
  });

  ws.columns = allCols.map(() => ({ width: 18 }));

  const today = new Date().toLocaleDateString('pt-BR');
  const titleRow = ws.addRow([`Taxa E-Peças - ${today}`]);
  ws.mergeCells(1, 1, 1, allCols.length);
  titleRow.height = 30;
  titleRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 13 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const headerRow = ws.addRow(allCols);
  headerRow.height = 36;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: allCols.length } };

  const BTHIN = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };

  rows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF0FDFA';
    const values = allCols.map(h => row.data[h] ?? '');
    const dr = ws.addRow(values);
    dr.height = 17;
    dr.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { top: BTHIN, bottom: BTHIN, left: BTHIN, right: BTHIN };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.font = { size: 9 };
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function TaxaEPecasDashboard() {
  const [rows, setRows]               = useState<TaxaEPecasRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filterYear, setFilterYear]   = useState<number>(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(new Date().getMonth() + 1);

  const txtInputRef  = useRef<HTMLInputElement>(null);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const tableRef     = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const scrollDummyRef = useRef<HTMLDivElement>(null);

  const [importPeriodModal, setImportPeriodModal] = useState(false);
  const [importPeriodYear, setImportPeriodYear]   = useState<number>(new Date().getFullYear());
  const [importPeriodMonth, setImportPeriodMonth] = useState<number>(new Date().getMonth() + 1);
  const [confirmImport, setConfirmImport]         = useState(false);
  const [confirmDeleteId, setConfirmDeleteId]     = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll]   = useState(false);
  const [editModal, setEditModal]                 = useState<TaxaEPecasRow | null>(null);
  const [editValues, setEditValues]               = useState<Record<string, string> | null>(null);
  const [expandedAnnotations, setExpandedAnnotations] = useState<Set<string>>(new Set());

  const allColumns = useMemo(() => {
    const keys = new Set<string>();
    rows.forEach(r => Object.keys(r.data).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [rows]);

  useEffect(() => {
    setLoading(true);
    loadTaxaEPecasRows().then(data => {
      setRows(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (scrollDummyRef.current && tableRef.current)
        scrollDummyRef.current.style.width = tableRef.current.scrollWidth + 'px';
    }, 50);
    return () => clearTimeout(t);
  });

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    rows.forEach(r => { const d = getRowPeriod(r); if (d) years.add(d.year); });
    const sorted = Array.from(years).sort((a, b) => b - a);
    return sorted.length ? sorted : [new Date().getFullYear()];
  }, [rows]);

  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    rows.forEach(r => {
      const d = getRowPeriod(r);
      if (d && d.year === filterYear) counts[d.month] = (counts[d.month] ?? 0) + 1;
    });
    return counts;
  }, [rows, filterYear]);

  const filteredRows = useMemo(() => rows.filter(r => {
    const d = getRowPeriod(r);
    if (!d) return false;
    if (d.year !== filterYear) return false;
    if (filterMonth !== null && d.month !== filterMonth) return false;
    return true;
  }), [rows, filterYear, filterMonth]);

  // ─── Ações ──────────────────────────────────────────────────────────────────
  async function handleToggleHighlight(row: TaxaEPecasRow) {
    const updated = rows.map(r => r.id === row.id ? { ...r, highlight: !r.highlight } : r);
    setRows(updated);
    await saveTaxaEPecasRows(updated);
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteId) return;
    const updated = rows.filter(r => r.id !== confirmDeleteId);
    setRows(updated);
    await saveTaxaEPecasRows(updated);
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

  async function handleAnnotationBlur() {
    await saveTaxaEPecasRows(rows);
  }

  async function handleSaveEditModal() {
    if (!editModal || !editValues) return;
    const updated = rows.map(r =>
      r.id === editModal.id ? { ...r, data: { ...r.data, ...editValues } } : r
    );
    setRows(updated);
    await saveTaxaEPecasRows(updated);
    setEditModal(null);
    setEditValues(null);
    toast.success('Linha salva.');
  }

  async function handleDeleteAll() {
    const kept = rows.filter(r => {
      const d = getRowPeriod(r);
      if (!d) return true;
      return !(d.year === filterYear && d.month === filterMonth!);
    });
    setRows(kept);
    await saveTaxaEPecasRows(kept);
    setConfirmDeleteAll(false);
    toast.success(`Linhas de ${MONTHS[(filterMonth ?? 1) - 1]}/${filterYear} excluídas.`);
  }

  async function handleTxtImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseTaxaEPecasTxt(text);
    if (parsed.length === 0) {
      toast.warning('Nenhum registro reconhecido no arquivo TXT.');
      if (txtInputRef.current) txtInputRef.current.value = '';
      return;
    }
    const periodo = `${importPeriodYear}-${String(importPeriodMonth).padStart(2, '0')}`;
    const { added } = await appendTaxaEPecasRows(parsed.map(r => ({ ...r, periodoImport: periodo })));
    const updated = await loadTaxaEPecasRows();
    setRows(updated);
    toast.success(`${added} linha(s) importada(s) — ${MONTHS[importPeriodMonth - 1]}/${importPeriodYear}.`);
    if (txtInputRef.current) txtInputRef.current.value = '';
  }

  function handleXlsxClick() { setConfirmImport(true); }
  function handleConfirmImport() { setConfirmImport(false); xlsxInputRef.current?.click(); }

  async function handleXlsxImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (raw.length === 0) {
      toast.warning('Nenhum registro encontrado no Excel.');
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';
      return;
    }
    const parsed: Omit<TaxaEPecasRow, 'id'>[] = raw.map(r =>
      ({ data: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])) })
    );
    const { total } = await replaceTaxaEPecasRows(parsed);
    const updated = await loadTaxaEPecasRows();
    setRows(updated);
    toast.success(`${total} registro(s) importado(s) — dados anteriores substituídos.`);
    if (xlsxInputRef.current) xlsxInputRef.current.value = '';
  }

  async function handleExport() {
    try {
      const monthLabel = filterMonth ? MONTHS[filterMonth - 1] : 'Ano-todo';
      await exportToExcel(filteredRows, allColumns, `taxa_epecos_${filterYear}_${monthLabel}.xlsx`);
      toast.success('Arquivo Excel gerado!');
    } catch (err) {
      toast.error(`Erro ao gerar Excel: ${String(err)}`);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
      <input ref={txtInputRef}  type="file" accept=".txt"            className="hidden" onChange={handleTxtImport} />
      <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls,.ods" className="hidden" onChange={handleXlsxImport} />

      {/* Modal: período de importação TXT */}
      {importPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-5">
              <Upload className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Importar TXT — Taxa E-Peças</p>
                <p className="text-slate-500 text-xs mt-1">
                  Todas as colunas do arquivo serão importadas automaticamente.
                  Informe o período para classificar os registros.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Mês</label>
                <select
                  value={importPeriodMonth}
                  onChange={e => setImportPeriodMonth(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Ano</label>
                <select
                  value={importPeriodYear}
                  onChange={e => setImportPeriodYear(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setImportPeriodModal(false)}>Cancelar</Button>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white"
                onClick={() => { setImportPeriodModal(false); txtInputRef.current?.click(); }}
              >
                Confirmar e selecionar arquivo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: confirmar importação Excel */}
      {confirmImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Importar Excel — Taxa E-Peças</p>
                <p className="text-slate-500 text-xs mt-1">Os dados atuais serão <strong>substituídos</strong>.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmImport(false)}>Cancelar</Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConfirmImport}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: confirmar exclusão de linha */}
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
              <button className="text-xs border border-slate-200 rounded px-3 py-1.5 hover:bg-slate-50" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
              <button className="text-xs bg-red-600 hover:bg-red-700 text-white rounded px-3 py-1.5" onClick={handleConfirmDelete}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: confirmar limpar tudo */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Limpar Tudo</p>
                <p className="text-slate-500 text-xs mt-1">
                  Deseja excluir todos os registros de{' '}
                  <strong>{MONTHS[(filterMonth ?? 1) - 1]}/{filterYear}</strong>?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteAll(false)}>Não</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteAll}>Sim, excluir</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: edição de linha */}
      {editModal && editValues && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <p className="font-semibold text-slate-800 text-sm">Editar linha</p>
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
                      className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-300"
                      value={editValues[col] ?? ''}
                      onChange={e => setEditValues(prev => prev ? { ...prev, [col]: e.target.value } : prev)}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 flex-shrink-0">
              <button
                className="text-xs border border-slate-200 rounded px-3 py-1.5 hover:bg-slate-50"
                onClick={() => { setEditModal(null); setEditValues(null); }}
              >Cancelar</button>
              <button
                className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded px-3 py-1.5 flex items-center gap-1.5"
                onClick={handleSaveEditModal}
              >
                <Check className="w-3.5 h-3.5" />Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de botões */}
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-3 flex-shrink-0 flex-wrap">
        <Button
          size="sm"
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white"
          onClick={() => setImportPeriodModal(true)}
        >
          <Upload className="w-4 h-4" />Importar TXT
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
          onClick={handleXlsxClick}
        >
          <FileSpreadsheet className="w-4 h-4" />Importar Excel
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50"
          onClick={handleExport}
        >
          <Download className="w-4 h-4" />Exportar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => setConfirmDeleteAll(true)}
          disabled={filterMonth === null}
        >
          <Trash2 className="w-4 h-4" />Limpar Tudo
        </Button>
        <span className="text-xs text-slate-400">
          TXT: acumula · Excel: substitui
          {allColumns.length > 0 && ` · ${allColumns.length} colunas detectadas`}
        </span>
      </div>

      {/* Filtro Ano / Mês */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 flex-shrink-0 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">ANO</span>
        <div className="relative mr-2">
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            className="appearance-none text-sm font-bold text-slate-700 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="w-px h-5 bg-slate-200 mr-1" />
        <button
          onClick={() => setFilterMonth(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterMonth === null ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
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
                  ? 'bg-teal-600 text-white shadow-sm'
                  : hasData
                  ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  : 'text-slate-300 cursor-default'
              }`}
            >
              {name}
              {hasData && (
                <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 rounded-full leading-none py-0.5 ${
                  isActive ? 'bg-white text-teal-700' : 'bg-teal-100 text-teal-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* KPIs */}
      <div className="bg-white border-b border-slate-100 px-6 py-2 flex items-center gap-6 flex-shrink-0">
        <span className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{filteredRows.length}</span>{' '}
          registro{filteredRows.length !== 1 ? 's' : ''}
        </span>
        {allColumns.length > 0 && (
          <span className="text-xs text-slate-400">{allColumns.length} colunas</span>
        )}
      </div>

      {/* Tabela */}
      <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
        <div
          ref={tableRef}
          onScroll={() => {
            if (scrollbarRef.current && tableRef.current)
              scrollbarRef.current.scrollLeft = tableRef.current.scrollLeft;
          }}
          className="flex-1 overflow-auto"
          style={{ minHeight: 0 }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Carregando...</div>
          ) : allColumns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-2">
              <FileSpreadsheet className="w-10 h-10" />
              <span className="text-sm">Nenhum dado — importe um arquivo TXT ou Excel</span>
              <span className="text-xs text-slate-400">As colunas serão detectadas automaticamente do arquivo</span>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-2">
              <FileSpreadsheet className="w-10 h-10" />
              <span className="text-sm">Nenhum registro no período selecionado</span>
            </div>
          ) : (
            <table className="w-full border-collapse text-xs" style={{ minWidth: Math.max(800, allColumns.length * 120) }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-teal-700 text-white">
                  {allColumns.map((h, i) => (
                    <th
                      key={h}
                      style={i === 0 ? { position: 'sticky', left: 0, zIndex: 21 } : undefined}
                      className="bg-teal-700 px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap border-r border-teal-600"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="sticky right-0 z-20 bg-teal-700 px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap w-24">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row, i) => (
                  <Fragment key={row.id}>
                    <tr
                      className={`${
                        row.highlight
                          ? 'bg-amber-50 border-l-4 border-l-amber-400'
                          : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                      } border-b border-slate-100 hover:bg-teal-50/40 transition-colors`}
                    >
                      {allColumns.map((col, ci) => (
                        <td
                          key={col}
                          style={ci === 0 ? { position: 'sticky', left: 0, zIndex: 4, background: row.highlight ? '#fffbeb' : i % 2 === 0 ? '#ffffff' : '#f8fafc' } : undefined}
                          className="px-3 py-1.5 text-slate-700 max-w-[200px] truncate border-r border-slate-100"
                        >
                          {row.data[col] || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                      <td className="sticky right-0 z-4 bg-white px-2 py-1.5 border-l border-slate-100">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            title="Destacar"
                            onClick={() => handleToggleHighlight(row)}
                            className={`p-1 rounded hover:bg-yellow-100 transition-colors ${row.highlight ? 'text-yellow-500' : 'text-slate-300 hover:text-yellow-400'}`}
                          >
                            <Highlighter className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Anotação"
                            onClick={() => handleToggleAnnotation(row.id)}
                            className={`p-1 rounded hover:bg-blue-50 transition-colors ${row.annotation ? 'text-blue-500' : 'text-slate-300 hover:text-blue-400'}`}
                          >
                            <StickyNote className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Editar"
                            onClick={() => { setEditModal(row); setEditValues({ ...row.data }); }}
                            className="p-1 rounded hover:bg-indigo-50 text-slate-300 hover:text-indigo-500 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Excluir"
                            onClick={() => setConfirmDeleteId(row.id)}
                            className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedAnnotations.has(row.id) && (
                      <tr className="bg-blue-50/60">
                        <td colSpan={allColumns.length + 1} className="px-4 py-2">
                          <textarea
                            autoFocus
                            rows={2}
                            value={row.annotation ?? ''}
                            onChange={e => handleAnnotationChange(row.id, e.target.value)}
                            onBlur={handleAnnotationBlur}
                            placeholder="Anotação..."
                            className="w-full text-xs border border-blue-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white resize-none"
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {/* Barra de scroll horizontal fixa */}
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
