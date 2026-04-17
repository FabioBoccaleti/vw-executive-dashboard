import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { Upload, Download, FileSpreadsheet, ChevronDown, AlertTriangle, Pencil, Trash2, Highlighter, StickyNote, Check, X, Package } from 'lucide-react';
import { VPecasDashboard } from './VPecasDashboard';
import { VPecasItemDashboard } from './VPecasItemDashboard';
import { VPecasSeguradoraDashboard } from './VPecasSeguradoraDashboard';
import { VPecasMercadoLivreDashboard } from './VPecasMercadoLivreDashboard';
import { VPecasEPecasDashboard } from './VPecasEPecasDashboard';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  type RegistroSubTab,
  type RegistroVendasRow,
  loadRegistroRows,
  appendRegistroRows,
  replaceRegistroRows,
  saveRegistroRows,
  parseTxtLines,
  TRANSACAO_MAP,
} from './registroVendasStorage';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const SUB_TABS: { id: RegistroSubTab; label: string }[] = [
  { id: 'novos',    label: 'Veículos Novos' },
  { id: 'frotista', label: 'Veículos VD / Frotista' },
  { id: 'usados',   label: 'Veículos Usados' },
];

function parseDate(raw: string): { year: number; month: number } | null {
  if (!raw) return null;
  // Suporta DD/MM/YYYY ou YYYY-MM-DD
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

// Retorna o período de classificação da linha: usa periodoImport quando disponível
function getRowPeriod(r: RegistroVendasRow): { year: number; month: number } | null {
  if (r.periodoImport) {
    const [y, m] = r.periodoImport.split('-').map(Number);
    if (y && m) return { year: y, month: m };
  }
  return parseDate(r.dtaVenda);
}

function fmtCurrency(raw: string): string {
  const n = parseFloat(raw.replace(',', '.'));
  if (isNaN(n)) return raw || '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function sumField(rows: RegistroVendasRow[], field: 'valVenda' | 'valCusto'): number {
  return rows.reduce((acc, r) => {
    const n = parseFloat(r[field].replace(',', '.'));
    return acc + (isNaN(n) ? 0 : n);
  }, 0);
}

// ─── Exporta para Excel (estilizado) ───────────────────────────────────────────────
const COLS_REGISTRO = [
  { key: 'chassi',       label: 'Chassi',       type: 'text' },
  { key: 'modelo',       label: 'Modelo',       type: 'text' },
  { key: 'valVenda',     label: 'Val. Venda',   type: 'currency' },
  { key: 'nfVenda',      label: 'NF Venda',     type: 'text' },
  { key: 'nfEntrada',    label: 'NF Entrada',   type: 'text' },
  { key: 'valCusto',     label: 'Val. Custo',   type: 'currency' },
  { key: 'dtaEntrada',   label: 'Dt. Entrada',  type: 'date' },
  { key: 'dtaVenda',     label: 'Dt. Venda',    type: 'date' },
  { key: 'nomeCor',      label: 'Cor',          type: 'text' },
  { key: 'nomeVendedor', label: 'Vendedor',     type: 'text' },
  { key: 'transacao',    label: 'Transação',   type: 'text' },
] as const;

async function exportToExcel(rows: RegistroVendasRow[], sheetName: string, filename: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: 'FF10B981' } },
  });
  const labels = COLS_REGISTRO.map(c => c.label);
  ws.columns = labels.map(() => ({ width: 20 }));
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
    const values = COLS_REGISTRO.map(col => {
      const v = (row as Record<string, string>)[col.key] ?? '';
      if (col.type === 'currency') return parseFloat(String(v).replace(',', '.')) || null;
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
      const col = COLS_REGISTRO[ci - 1];
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

// ─── Lê Excel e converte para rows ────────────────────────────────────────────
function parseExcelFile(
  buffer: ArrayBuffer,
  tab: RegistroSubTab,
): Omit<RegistroVendasRow, 'id'>[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return raw.map(r => ({
    chassi:       String(r['Chassi'] ?? r['CHASSI'] ?? ''),
    modelo:       String(r['Modelo'] ?? r['DES_MODELO'] ?? ''),
    valVenda:     String(r['Val. Venda'] ?? r['VAL_VENDA'] ?? ''),
    nfVenda:      String(r['NF Venda'] ?? r['NUMERO_NOTA_FISCAL'] ?? ''),
    nfEntrada:    String(r['NF Entrada'] ?? r['NUMERO_NOTA_NFENTRADA'] ?? ''),
    valCusto:     String(r['Val. Custo'] ?? r['VAL_CUSTO_CONTABIL'] ?? ''),
    dtaEntrada:   String(r['Dt. Entrada'] ?? r['DTA_ENTRADA'] ?? ''),
    dtaVenda:     String(r['Dt. Venda'] ?? r['DTA_VENDA'] ?? ''),
    nomeCor:      String(r['Cor'] ?? r['NOME_COR'] ?? ''),
    nomeVendedor: String(r['Vendedor'] ?? r['NOME_VENDEDOR'] ?? ''),
    transacao:    String(r['Transação'] ?? r['TIPO_TRANSACAO'] ?? TRANSACAO_MAP[tab][0]),
  }));
}

// ─── Componente principal ──────────────────────────────────────────────────────
export function RegistroVendasDashboard() {
  const [activeTab, setActiveTab]       = useState<RegistroSubTab>('novos');
  const [rows, setRows]                 = useState<RegistroVendasRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterYear, setFilterYear]     = useState<number>(new Date().getFullYear());
  const [filterMonth, setFilterMonth]   = useState<number | null>(new Date().getMonth() + 1);

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
  const [confirmImport, setConfirmImport] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editModal, setEditModal]     = useState<RegistroVendasRow | null>(null);
  const [editValues, setEditValues]   = useState<RegistroVendasRow | null>(null);
  const [expandedAnnotations, setExpandedAnnotations] = useState<Set<string>>(new Set());
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [importPeriodModal, setImportPeriodModal] = useState(false);
  const [importPeriodYear, setImportPeriodYear]   = useState<number>(new Date().getFullYear());
  const [importPeriodMonth, setImportPeriodMonth] = useState<number>(new Date().getMonth() + 1);
  const [showVPecas, setShowVPecas]               = useState(false);
  const [showVPecasItem, setShowVPecasItem]         = useState(false);
  const [showVPecasSeg, setShowVPecasSeg]           = useState(false);
  const [showVPecasML, setShowVPecasML]             = useState(false);
  const [showVPecasEP, setShowVPecasEP]             = useState(false);

  // Carrega dados ao trocar de aba
  useEffect(() => {
    if (showVPecas || showVPecasItem || showVPecasSeg || showVPecasML || showVPecasEP) { setLoading(false); return; }
    setLoading(true);
    loadRegistroRows(activeTab).then(data => {
      setRows(data);
      setLoading(false);
    });
  }, [activeTab, showVPecas, showVPecasItem, showVPecasSeg, showVPecasML, showVPecasEP]);

  // Anos disponíveis
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    rows.forEach(r => {
      const d = getRowPeriod(r);
      if (d) years.add(d.year);
    });
    const sorted = Array.from(years).sort((a, b) => b - a);
    return sorted.length ? sorted : [new Date().getFullYear()];
  }, [rows]);

  // Contagem por mês para o filtro
  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    rows.forEach(r => {
      const d = getRowPeriod(r);
      if (d && d.year === filterYear) counts[d.month] = (counts[d.month] ?? 0) + 1;
    });
    return counts;
  }, [rows, filterYear]);

  // Linhas filtradas
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const d = getRowPeriod(r);
      if (!d) return false;
      if (d.year !== filterYear) return false;
      if (filterMonth !== null && d.month !== filterMonth) return false;
      return true;
    });
  }, [rows, filterYear, filterMonth]);

  // KPIs
  const totalVenda = useMemo(() => sumField(filteredRows, 'valVenda'), [filteredRows]);
  const totalCusto = useMemo(() => sumField(filteredRows, 'valCusto'), [filteredRows]);

  // ─── Ações por linha ──────────────────────────────────────────────────────────
  async function handleToggleHighlight(row: RegistroVendasRow) {
    const updated = rows.map(r => r.id === row.id ? { ...r, highlight: !r.highlight } : r);
    setRows(updated);
    await saveRegistroRows(activeTab, updated);
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteId) return;
    const updated = rows.filter(r => r.id !== confirmDeleteId);
    setRows(updated);
    await saveRegistroRows(activeTab, updated);
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
    await saveRegistroRows(activeTab, rows);
  }

  async function handleSaveEditModal() {
    if (!editValues) return;
    const updated = rows.map(r => r.id === editValues.id ? editValues : r);
    setRows(updated);
    await saveRegistroRows(activeTab, updated);
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
    await saveRegistroRows(activeTab, kept);
    setConfirmDeleteAll(false);
    toast.success(`Linhas de ${MONTHS[filterMonth! - 1]}/${filterYear} excluídas.`);
  }

  // ─── Importar TXT ─────────────────────────────────────────────────
  async function handleTxtImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseTxtLines(text);

    const total = parsed.novos.length + parsed.frotista.length + parsed.usados.length;
    if (total === 0) {
      toast.warning('Nenhum registro reconhecido no arquivo.');
      if (txtInputRef.current) txtInputRef.current.value = '';
      return;
    }

    // Aplica o período declarado em todos os registros
    const periodo = `${importPeriodYear}-${String(importPeriodMonth).padStart(2, '0')}`;
    const applyPeriod = <T extends object>(items: T[]) =>
      items.map(r => ({ ...r, periodoImport: periodo }));

    const tabs: RegistroSubTab[] = ['novos', 'frotista', 'usados'];
    await Promise.all(tabs.map(t =>
      parsed[t].length > 0
        ? appendRegistroRows(t, applyPeriod(parsed[t]))
        : Promise.resolve({ added: 0 })
    ));

    // Recarrega a aba atual
    const updated = await loadRegistroRows(activeTab);
    setRows(updated);

    const parts = [
      parsed.novos.length    > 0 ? `${parsed.novos.length} Novos`       : null,
      parsed.frotista.length > 0 ? `${parsed.frotista.length} VD/Frotista` : null,
      parsed.usados.length   > 0 ? `${parsed.usados.length} Usados`     : null,
    ].filter(Boolean);
    toast.success(`Importado (${MONTHS[importPeriodMonth - 1]}/${importPeriodYear}): ${parts.join(' · ')}`);
    if (txtInputRef.current) txtInputRef.current.value = '';
  }

  // ─── Importar Excel ───────────────────────────────────────────────────────────
  function handleXlsxClick() {
    setConfirmImport(true);
  }

  function handleConfirmImport() {
    setConfirmImport(false);
    xlsxInputRef.current?.click();
  }

  async function handleXlsxImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const parsed = parseExcelFile(buffer, activeTab);
    if (parsed.length === 0) {
      toast.warning('Nenhum registro encontrado no Excel.');
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';
      return;
    }
    const { total } = await replaceRegistroRows(activeTab, parsed);
    const updated = await loadRegistroRows(activeTab);
    setRows(updated);
    toast.success(`${total} registro(s) importado(s) (dados anteriores substituídos).`);
    if (xlsxInputRef.current) xlsxInputRef.current.value = '';
  }

  // ─── Exportar Excel ───────────────────────────────────────────────────────────
  async function handleExport() {
    try {
      const monthLabel = filterMonth ? MONTHS[filterMonth - 1] : 'Ano-todo';
      const tabLabel   = (SUB_TABS.find(t => t.id === activeTab)?.label ?? activeTab).replace(/[*?:\\/\[\]]/g, '-');
      const sheetName  = `Reg. Vendas - ${tabLabel} - ${monthLabel}-${filterYear}`.slice(0, 31);
      await exportToExcel(filteredRows, sheetName, `registro_${activeTab}_${filterYear}_${monthLabel}.xlsx`);
      toast.success('Arquivo Excel gerado!');
    } catch (err) {
      console.error('Erro ao gerar Excel:', err);
      toast.error(`Erro ao gerar Excel: ${String(err)}`);
    }
  }

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
      {/* Input ocultos */}
      <input ref={txtInputRef}  type="file" accept=".txt"            className="hidden" onChange={handleTxtImport} />
      <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls,.ods" className="hidden" onChange={handleXlsxImport} />

      {/* Modal: selecionar período do TXT */}
      {importPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-5">
              <Upload className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Importar TXT — Qual é o período deste relatório?</p>
                <p className="text-slate-500 text-xs mt-1">Os registros serão classificados no mês/ano que você informar, independente da data de venda do ERP.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Mês</label>
                <select
                  value={importPeriodMonth}
                  onChange={e => setImportPeriodMonth(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Ano</label>
                <select
                  value={importPeriodYear}
                  onChange={e => setImportPeriodYear(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setImportPeriodModal(false)}>Cancelar</Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setImportPeriodModal(false); txtInputRef.current?.click(); }}>
                Confirmar e selecionar arquivo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: confirmar exclusão */}
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

      {/* Modal: edição de linha */}
      {editModal && editValues && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-slate-800 text-sm">Editar registro</p>
              <button onClick={() => { setEditModal(null); setEditValues(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {([
                ['chassi','Chassi'],['modelo','Modelo'],['valVenda','Val. Venda'],['nfVenda','NF Venda'],
                ['nfEntrada','NF Entrada'],['valCusto','Val. Custo'],['dtaEntrada','Dt. Entrada'],
                ['dtaVenda','Dt. Venda'],['nomeCor','Cor'],['nomeVendedor','Vendedor'],['transacao','Transação'],
              ] as [keyof RegistroVendasRow, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    value={String(editValues[field] ?? '')}
                    onChange={e => setEditValues(prev => prev ? { ...prev, [field]: e.target.value } : prev)}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="text-xs border border-slate-200 rounded px-3 py-1.5 hover:bg-slate-50" onClick={() => { setEditModal(null); setEditValues(null); }}>Cancelar</button>
              <button className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded px-3 py-1.5 flex items-center gap-1.5" onClick={handleSaveEditModal}><Check className="w-3.5 h-3.5" />Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog de confirmação de importação Excel */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Excluir todas as linhas</p>
                <p className="text-slate-500 text-xs mt-1">Deseja excluir todas as linhas de <strong>{SUB_TABS.find(t => t.id === activeTab)?.label}</strong> de <strong>{MONTHS[filterMonth! - 1]}/{filterYear}</strong>? Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteAll(false)}>Não</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteAll}>Sim, excluir tudo</Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog de confirmação de importação Excel */}
      {confirmImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Importar Excel — {SUB_TABS.find(t => t.id === activeTab)?.label}</p>
                <p className="text-slate-500 text-xs mt-1">Os dados atuais de <strong>{SUB_TABS.find(t => t.id === activeTab)?.label}</strong> serão <strong>substituídos</strong> pelo conteúdo do arquivo. As outras abas não serão afetadas.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmImport(false)}>Cancelar</Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConfirmImport}>Confirmar importação</Button>
            </div>
          </div>
        </div>
      )}

      {/* Barra superior — Importar TXT (apenas veículos, alimenta as 3 abas) */}
      {!showVPecas && !showVPecasItem && !showVPecasSeg && (
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <Button
          size="sm"
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setImportPeriodModal(true)}
        >
          <Upload className="w-4 h-4" />
          Importar TXT
        </Button>
        <span className="text-xs text-slate-400">Os dados serão distribuídos automaticamente entre as abas pelo tipo de transação.</span>
      </div>
      )}

      {/* Sub-abas + botões de Excel por aba */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex gap-0">
          {SUB_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setShowVPecas(false); setShowVPecasItem(false); setShowVPecasSeg(false); setShowVPecasML(false); setShowVPecasEP(false); }}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                !showVPecas && !showVPecasItem && !showVPecasSeg && !showVPecasML && !showVPecasEP && activeTab === id
                  ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => { setShowVPecas(true); setShowVPecasItem(false); setShowVPecasSeg(false); setShowVPecasML(false); setShowVPecasEP(false); }}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              showVPecas && !showVPecasItem && !showVPecasSeg && !showVPecasML && !showVPecasEP
                ? 'border-violet-500 text-violet-700 bg-violet-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4" />
            V. Peças
          </button>
          <button
            onClick={() => { setShowVPecasItem(true); setShowVPecas(false); setShowVPecasSeg(false); setShowVPecasML(false); setShowVPecasEP(false); }}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              showVPecasItem
                ? 'border-teal-500 text-teal-700 bg-teal-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4" />
            Itens de Peças
          </button>
          <button
            onClick={() => { setShowVPecasSeg(true); setShowVPecas(false); setShowVPecasItem(false); setShowVPecasML(false); setShowVPecasEP(false); }}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              showVPecasSeg
                ? 'border-sky-500 text-sky-700 bg-sky-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4" />
            Peças Seg. Balcão
          </button>
          <button
            onClick={() => { setShowVPecasML(true); setShowVPecas(false); setShowVPecasItem(false); setShowVPecasSeg(false); setShowVPecasEP(false); }}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              showVPecasML
                ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4" />
            Peças Mercado Livre
          </button>
          <button
            onClick={() => { setShowVPecasEP(true); setShowVPecas(false); setShowVPecasItem(false); setShowVPecasSeg(false); setShowVPecasML(false); }}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              showVPecasEP
                ? 'border-indigo-500 text-indigo-700 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4" />
            Peças E-Peças
          </button>
        </div>
        {!showVPecas && !showVPecasItem && !showVPecasSeg && !showVPecasML && !showVPecasEP && (
        <div className="flex items-center gap-2 py-1.5">
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 h-8 text-xs"
            onClick={handleXlsxClick}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Importar · {SUB_TABS.find(t => t.id === activeTab)?.label}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs"
            onClick={handleExport}
          >
            <Download className="w-3.5 h-3.5" />
            Exportar · {SUB_TABS.find(t => t.id === activeTab)?.label}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50 h-8 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => setConfirmDeleteAll(true)}
            disabled={filterMonth === null}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar Tudo
          </Button>
        </div>
        )}
      </div>

      {/* V. Peças */}
      {showVPecas && !showVPecasItem && (
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          <VPecasDashboard />
        </div>
      )}

      {showVPecasItem && (
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          <VPecasItemDashboard />
        </div>
      )}

      {showVPecasSeg && (
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          <VPecasSeguradoraDashboard />
        </div>
      )}

      {showVPecasML && (
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          <VPecasMercadoLivreDashboard />
        </div>
      )}

      {showVPecasEP && (
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          <VPecasEPecasDashboard />
        </div>
      )}

      {/* Filtro Ano / Mês — apenas veículos */}
      {!showVPecas && !showVPecasItem && !showVPecasSeg && !showVPecasML && !showVPecasEP && (<>
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

      {/* KPIs */}
      <div className="bg-white border-b border-slate-100 px-6 py-2 flex items-center gap-6 flex-shrink-0">
        <span className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{filteredRows.length}</span> registro{filteredRows.length !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-slate-500">
          Val. Venda: <span className="font-semibold text-slate-700 font-mono">{totalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </span>
        <span className="text-xs text-slate-500">
          Val. Custo: <span className="font-semibold text-slate-700 font-mono">{totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </span>
      </div>

      {/* Tabela */}
      <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
        <div ref={tableRef} onScroll={() => { if (scrollbarRef.current && tableRef.current) scrollbarRef.current.scrollLeft = tableRef.current.scrollLeft; }} className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Carregando...</div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-2">
            <FileSpreadsheet className="w-10 h-10" />
            <span className="text-sm">Nenhum registro — importe um arquivo TXT ou Excel</span>
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-emerald-700 text-white">
                {['Chassi','Modelo','Val. Venda','NF Venda','NF Entrada','Val. Custo','Dt. Entrada','Dt. Venda','Cor','Vendedor','Transação'].map((h,i) => (
                  <th key={h} style={i === 0 ? { position: 'sticky', left: 0, zIndex: 21 } : undefined}
                    className="bg-emerald-700 px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
                <th className="sticky right-0 z-20 bg-emerald-700 px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap w-28">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row, i) => (
                <Fragment key={row.id}>
                  <tr className={`${row.highlight ? 'bg-amber-50 border-l-4 border-l-amber-400' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} border-b border-slate-100 hover:bg-emerald-50/40 transition-colors`}>
                  <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap" style={{ position: 'sticky', left: 0, zIndex: 4, background: row.highlight ? '#fffbeb' : i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>{row.chassi || '-'}</td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.modelo || '-'}</td>
                  <td className="px-3 py-2 font-mono text-emerald-700 whitespace-nowrap">{fmtCurrency(row.valVenda)}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.nfVenda || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.nfEntrada || '-'}</td>
                  <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">{fmtCurrency(row.valCusto)}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.dtaEntrada || '-'}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.dtaVenda || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.nomeCor || '-'}</td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.nomeVendedor || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                      {row.transacao || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={() => handleToggleHighlight(row)} title="Evidenciar linha"
                        className={`p-1.5 rounded transition-colors ${row.highlight ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50'}`}>
                        <Highlighter className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setEditModal(row); setEditValues({ ...row }); }} title="Editar"
                        className="p-1.5 rounded text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(row.id)} title="Excluir"
                        className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleToggleAnnotation(row.id)} title="Anotação"
                        className={`p-1.5 rounded transition-colors ${expandedAnnotations.has(row.id) || row.annotation ? 'text-indigo-500 bg-indigo-50' : 'text-slate-300 hover:text-indigo-400 hover:bg-indigo-50'}`}>
                        <StickyNote className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedAnnotations.has(row.id) && (
                  <tr className={row.highlight ? 'bg-amber-50/60' : 'bg-slate-50/40'}>
                    <td colSpan={12} className="px-4 pb-2 pt-1">
                      <textarea value={row.annotation ?? ''} onChange={e => handleAnnotationChange(row.id, e.target.value)} onBlur={handleAnnotationBlur}
                        placeholder="Escreva uma anotação..."
                        className="w-full text-xs text-slate-600 bg-white border border-indigo-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200" rows={2} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}        </div>
        <div ref={scrollbarRef} onScroll={() => { if (tableRef.current && scrollbarRef.current) tableRef.current.scrollLeft = scrollbarRef.current.scrollLeft; }}
          className="overflow-x-auto overflow-y-hidden shrink-0 border-t border-slate-100 bg-white" style={{ height: 14 }}>
          <div ref={scrollDummyRef} style={{ height: 1 }} />
        </div>      </div>
      </>)}
    </div>
  );
}
