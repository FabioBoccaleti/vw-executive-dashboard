import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Pencil, Check, X, Download, Highlighter, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { kvGet, kvSet } from '@/lib/kvClient';
import { loadVPecasMLRows, loadVPecasMLDevolucaoRows } from './vPecasMercadoLivreStorage';
import type { VPecasMLRow as VPecasRow } from './vPecasMercadoLivreStorage';
import { loadTaxaMLRows } from './taxaMercadoLivreStorage';
import type { TaxaMLRow } from './taxaMercadoLivreStorage';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function n(v: string | undefined): number {
  return parseFloat(String(v ?? '').replace(',', '.')) || 0;
}
function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

// ─── Overrides editáveis por NF ───────────────────────────────────────────────
const OV_KEY = 'vendas_pecas_ml_vendas_ov';

interface PecasOverride {
  condPgto: string;
  taxaML: string;
  taxaEPecas: string;
  comissao: string;
  dsr: string;
  provisoes: string;
}

function emptyOv(): PecasOverride {
  return { condPgto: '', taxaML: '', taxaEPecas: '', comissao: '', dsr: '', provisoes: '' };
}

async function loadOverrides(): Promise<Record<string, PecasOverride>> {
  try {
    const data = await kvGet(OV_KEY);
    if (data && typeof data === 'object' && !Array.isArray(data))
      return data as Record<string, PecasOverride>;
    return {};
  } catch { return {}; }
}

async function saveOverrides(ov: Record<string, PecasOverride>): Promise<void> {
  try { await kvSet(OV_KEY, ov); } catch { /* ignore */ }
}

// ─── Meses ────────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── Chave de override por linha ─────────────────────────────────────────────
function ovKey(d: Record<string, string>): string {
  return `${d['NUMERO_NOTA_FISCAL'] ?? ''}_${d['SERIE_NOTA_FISCAL'] ?? ''}_${d['DTA_DOCUMENTO'] ?? ''}`;
}

// ─── Período da linha ─────────────────────────────────────────────────────────
function rowPeriod(row: VPecasRow): { year: number; month: number } | null {
  if (row.periodoImport) {
    const [y, m] = row.periodoImport.split('-').map(Number);
    if (y > 2000 && m >= 1 && m <= 12) return { year: y, month: m };
  }
  const dtaDoc = row.data['DTA_DOCUMENTO'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dtaDoc)) {
    return { year: parseInt(dtaDoc.split('/')[2]), month: parseInt(dtaDoc.split('/')[1]) };
  }
  const dtaEnt = row.data['DTA_ENTRADA_SAIDA'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dtaEnt)) {
    return { year: parseInt(dtaEnt.split('/')[2]), month: parseInt(dtaEnt.split('/')[1]) };
  }
  return null;
}

// ─── Cálculos por linha ───────────────────────────────────────────────────────
interface PecasCalc {
  difal: number;
  recLiq: number;
  lucroBruto: number;
  lucroBrutoPct: number;
  resultado: number;
}

function calcPecasRow(d: Record<string, string>, ov: PecasOverride, autoTaxaML?: number): PecasCalc {
  const valorVenda = n(d['LIQ_NOTA_FISCAL']);
  const icms       = n(d['VAL_ICMS']);
  const pis        = n(d['VAL_PIS']);
  const cofins     = n(d['VAL_COFINS']);
  const difal      = n(d['VAL_ICMS_PARTIL_UF_DEST']) + n(d['VAL_ICMS_COMB_POBREZA']);
  const taxaML     = autoTaxaML !== undefined ? autoTaxaML : n(ov.taxaML);
  const taxaEPecas = n(ov.taxaEPecas);
  const recLiq     = valorVenda - icms - pis - cofins - difal;
  const custo      = n(d['TOT_CUSTO_MEDIO']);
  const lucroBruto = recLiq - taxaML - taxaEPecas - custo;
  const lucroBrutoPct = recLiq !== 0 ? (lucroBruto / recLiq) * 100 : 0;
  const comissao   = n(ov.comissao);
  const dsr        = n(ov.dsr);
  const provisoes  = n(ov.provisoes);
  const resultado  = lucroBruto - comissao - dsr - provisoes;
  return { difal, recLiq, lucroBruto, lucroBrutoPct, resultado };
}

// ─── CalcCell ─────────────────────────────────────────────────────────────────
function CalcCell({ value, pct, negative }: { value: number; pct?: boolean; negative?: boolean }) {
  const color = value > 0 ? 'text-emerald-700' : value < 0 ? 'text-red-600' : 'text-slate-400';
  const text = pct ? fmtPct(value) : `R$ ${fmt(value)}`;
  return (
    <div className={`text-xs font-semibold font-mono px-1 py-0.5 ${color} ${negative && value < 0 ? 'bg-red-50 rounded' : ''}`}>
      {text}
    </div>
  );
}

// ─── EditCell ─────────────────────────────────────────────────────────────────
function EditCell({ value, type, onSave }: { value: string; type: 'text' | 'currency'; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => { onSave(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-0">
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          className="border border-orange-400 rounded px-1 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        <button onClick={commit} className="text-orange-600 hover:text-orange-700 flex-shrink-0"><Check className="w-3 h-3" /></button>
        <button onClick={cancel} className="text-slate-400 hover:text-slate-600 flex-shrink-0"><X className="w-3 h-3" /></button>
      </div>
    );
  }

  const display = (type === 'currency' && value)
    ? `R$ ${fmt(n(value))}`
    : value || <span className="text-slate-300">—</span>;

  return (
    <div
      className="group flex items-center justify-between gap-1 cursor-pointer hover:bg-orange-50 rounded px-1 py-0.5 min-w-0"
      onClick={() => { setDraft(value); setEditing(true); }}
    >
      <span className={`truncate text-xs ${type === 'currency' ? 'font-mono' : ''}`}>{display}</span>
      <Pencil className="w-2.5 h-2.5 text-slate-300 group-hover:text-orange-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// ─── ReadCell ─────────────────────────────────────────────────────────────────
function ReadCell({ value, currency }: { value: string; currency?: boolean }) {
  if (!value) return <span className="text-slate-300 text-xs px-1">—</span>;
  if (currency) {
    return <div className="text-xs font-mono px-1">{`R$ ${fmt(n(value))}`}</div>;
  }
  return <div className="text-xs px-1 truncate">{value}</div>;
}

// ─── Export Excel ─────────────────────────────────────────────────────────────
async function exportPecasExcel(
  rows: VPecasRow[],
  overrides: Record<string, PecasOverride>,
  sheetName: string,
  filename: string,
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard'; wb.created = new Date();
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: 'FFEA580C' } },
  });

  const headers = [
    'Nota Fiscal', 'Série', 'Transação', 'Data da Venda', 'Departamento', 'Vendedor',
    'Cond. de Pagamento', 'Cliente', 'Cidade', 'Estado',
    'Valor Venda (Rec. Bruta)', 'ICMS', 'PIS', 'COFINS', 'Difal',
    'Receita Líquida', 'Taxa Mercado Livre', 'Taxa E-Peças',
    'Custo Médio', 'Lucro Bruto', '% Lucro Bruto',
    'Comissão', 'DSR', 'Provisões', 'Resultado Líquido Venda',
    'Nota Fiscal (Adic.)', 'Valor do Título',
  ];

  const colWidths = [12, 8, 12, 12, 16, 18, 20, 22, 14, 8, 20, 14, 14, 14, 14, 18, 14, 18, 14, 14, 12, 14, 14, 14, 20, 18, 18];
  ws.columns = colWidths.map(w => ({ width: w }));

  const today = new Date().toLocaleDateString('pt-BR');
  const titleRow = ws.addRow([`${sheetName} — ${today}`]);
  ws.mergeCells(1, 1, 1, headers.length);
  titleRow.height = 30;
  titleRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9A3412' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 13 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const headerRow = ws.addRow(headers);
  headerRow.height = 36;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: headers.length } };

  const BTHIN = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const BRL = '"R$"\\ #,##0.00';
  const PCT = '#,##0.00"%"';

  rows.forEach((row, ri) => {
    const d = row.data;
    const ov = overrides[ovKey(d)] ?? emptyOv();
    const c = calcPecasRow(d, ov);
    const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFFFF7ED';
    const vals = [
      d['NUMERO_NOTA_FISCAL'], d['SERIE_NOTA_FISCAL'], d['TIPO_TRANSACAO'], d['DTA_DOCUMENTO'],
      d['DEPARTAMENTO'], d['NOME_VENDEDOR'], ov.condPgto, d['NOME_CLIENTE'], d['CIDADE'], d['ESTADO'],
      n(d['LIQ_NOTA_FISCAL']), n(d['VAL_ICMS']), n(d['VAL_PIS']), n(d['VAL_COFINS']), c.difal,
      c.recLiq, n(ov.taxaML), n(ov.taxaEPecas),
      n(d['TOT_CUSTO_MEDIO']), c.lucroBruto, c.lucroBrutoPct,
      n(ov.comissao), n(ov.dsr), n(ov.provisoes), c.resultado,
      '', 0, // Nota Fiscal / Valor do Título — preenchidos no render
    ];
    const dr = ws.addRow(vals);
    dr.height = 17;
    const currencyCols = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 27];
    const pctCols = [21];
    dr.eachCell({ includeEmpty: true }, (cell, ci) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { top: BTHIN, bottom: BTHIN, left: BTHIN, right: BTHIN };
      cell.font = { size: 9 };
      if (currencyCols.includes(ci)) {
        cell.numFmt = BRL;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { size: 9, name: 'Courier New' };
      } else if (pctCols.includes(ci)) {
        cell.numFmt = PCT;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { size: 9, name: 'Courier New' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function VPecasMercadoLivreVendasDashboard() {
  const [allRows, setAllRows] = useState<VPecasRow[]>([]);
  const [taxaMLRows, setTaxaMLRows] = useState<TaxaMLRow[]>([]);
  const [overrides, setOverrides] = useState<Record<string, PecasOverride>>({});
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState('');

  useEffect(() => {
    Promise.all([loadVPecasMLRows(), loadVPecasMLDevolucaoRows(), loadOverrides(), loadTaxaMLRows()]).then(([rows, devol, ov, taxaRows]) => {
      const combined = [...rows, ...devol];
      setAllRows(combined.filter(r => r.data['SERIE_NOTA_FISCAL'] !== 'RPS'));
      setOverrides(ov);
      setTaxaMLRows(taxaRows as TaxaMLRow[]);
    });
  }, []);

  const availableYears = useMemo(() => {
    const yrs = new Set<number>();
    allRows.forEach(r => {
      const p = rowPeriod(r);
      if (p) yrs.add(p.year);
    });
    const cur = new Date().getFullYear();
    [cur - 1, cur, cur + 1].forEach(y => yrs.add(y));
    return [...yrs].sort();
  }, [allRows]);

  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    allRows.forEach(r => {
      const p = rowPeriod(r);
      if (!p || p.year !== filterYear) return;
      counts[p.month] = (counts[p.month] || 0) + 1;
    });
    return counts;
  }, [allRows, filterYear]);

  const filteredRows = useMemo(() => {
    return allRows.filter(r => {
      const p = rowPeriod(r);
      if (!p) return false;
      if (p.year !== filterYear) return false;
      if (filterMonth !== null && p.month !== filterMonth) return false;
      return true;
    });
  }, [allRows, filterYear, filterMonth]);

  // Taxa ML: lookup por TITULO == NUMERO_NOTA_FISCAL → Map para O(1)
  const taxaMLLookup = useMemo(() => {
    const periodo = filterMonth !== null
      ? `${filterYear}-${String(filterMonth).padStart(2, '0')}`
      : null;
    const filtered = periodo
      ? taxaMLRows.filter(r => r.periodoImport === periodo)
      : taxaMLRows.filter(r => {
          const p = r.periodoImport?.split('-').map(Number);
          return p && p[0] === filterYear;
        });
    const map = new Map<string, TaxaMLRow>();
    filtered.forEach(r => {
      const titulo = r.data['TITULO'];
      if (titulo) map.set(titulo, r);
    });
    return map;
  }, [taxaMLRows, filterYear, filterMonth]);

  async function updateOverride(key: string, field: keyof PecasOverride, value: string) {
    const updated = { ...overrides, [key]: { ...(overrides[key] ?? emptyOv()), [field]: value } };
    setOverrides(updated);
    await saveOverrides(updated);
  }

  function toggleHighlight(id: string) {
    setAllRows(prev => prev.map(r => r.id === id ? { ...r, highlight: !r.highlight } : r));
  }

  const totals = useMemo(() => {
    let valorVenda = 0, icms = 0, pis = 0, cofins = 0, difal = 0;
    let taxaML = 0, taxaEPecas = 0, recLiq = 0;
    let custo = 0, lucroBruto = 0, comissao = 0, dsr = 0, provisoes = 0, resultado = 0;
    filteredRows.forEach(r => {
      const d = r.data;
      const ov = overrides[ovKey(d)] ?? emptyOv();
      const taxaMLMatch = taxaMLLookup.get(d['NUMERO_NOTA_FISCAL']);
      const tituloVal   = taxaMLMatch?.data['VAL_TITULO'] ?? '';
      const autoTaxaML  = tituloVal ? n(d['LIQ_NOTA_FISCAL']) - n(tituloVal) : 0;
      const c = calcPecasRow(d, ov, autoTaxaML);
      valorVenda  += n(d['LIQ_NOTA_FISCAL']);
      icms        += n(d['VAL_ICMS']);
      pis         += n(d['VAL_PIS']);
      cofins      += n(d['VAL_COFINS']);
      difal       += c.difal;
      taxaML      += autoTaxaML;
      taxaEPecas  += n(ov.taxaEPecas);
      recLiq      += c.recLiq;
      custo       += n(d['TOT_CUSTO_MEDIO']);
      lucroBruto  += c.lucroBruto;
      comissao    += n(ov.comissao);
      dsr         += n(ov.dsr);
      provisoes   += n(ov.provisoes);
      resultado   += c.resultado;
    });
    const lucroBrutoPct = recLiq !== 0 ? (lucroBruto / recLiq) * 100 : 0;
    const totalValTitulo = Array.from(taxaMLLookup.values()).reduce((acc, r) => acc + n(r.data['VAL_TITULO']), 0);
    return { valorVenda, icms, pis, cofins, difal, taxaML, taxaEPecas, recLiq, custo, lucroBruto, lucroBrutoPct, comissao, dsr, provisoes, resultado, totalValTitulo };
  }, [filteredRows, overrides, taxaMLLookup]);

  // ─── Scroll sync (barra horizontal fixa) ─────────────────────────────────────
  const tableRef       = useRef<HTMLDivElement>(null);
  const scrollbarRef   = useRef<HTMLDivElement>(null);
  const scrollDummyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      if (scrollDummyRef.current && tableRef.current)
        scrollDummyRef.current.style.width = tableRef.current.scrollWidth + 'px';
    }, 50);
    return () => clearTimeout(t);
  });

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-100 px-6 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
            ANO
            <select
              value={filterYear}
              onChange={e => setFilterYear(+e.target.value)}
              className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterMonth(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterMonth === null ? 'bg-orange-600 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Ano todo
            </button>
            {MONTHS.map((m, i) => (
              <button
                key={m}
                onClick={() => setFilterMonth(i + 1)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterMonth === i + 1 ? 'bg-orange-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                } ${monthCounts[i + 1] ? 'font-semibold' : ''}`}
              >
                {m}
                {monthCounts[i + 1] ? <span className="ml-0.5 text-[10px] opacity-70">({monthCounts[i + 1]})</span> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{filteredRows.length} registro{filteredRows.length !== 1 ? 's' : ''}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                const monthLabel = filterMonth ? MONTHS[filterMonth - 1] : 'Ano-todo';
                const sheetName = `Peças ML - ${monthLabel}-${filterYear}`.slice(0, 31);
                await exportPecasExcel(filteredRows, overrides, sheetName, `vendas_pecas_ml_${filterYear}_${monthLabel}.xlsx`);
                toast.success('Arquivo Excel gerado!');
              } catch (err) {
                toast.error(`Erro ao gerar Excel: ${String(err)}`);
              }
            }}
            className="h-8 text-xs gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
        </div>
      </div>

      {/* Aviso de fonte dos dados */}
      <div className="mx-4 mb-2 mt-1 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-xs text-orange-800">
        <span className="mt-0.5 shrink-0">ℹ️</span>
        <span>
          Dados importados via <strong>Registros → Registro de Vendas → Peças Mercado Livre</strong>.
          Também são excluídas notas com <strong>SERIE = RPS</strong>.
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
          <table className="w-full border-separate border-spacing-0 text-xs" style={{ minWidth: 3100 }}>
            <thead className="sticky top-0 z-10">
              {/* Grupos de cabeçalho */}
              <tr>
                <th colSpan={10} className="bg-slate-700 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-r border-slate-600">IDENTIFICAÇÃO</th>
                <th colSpan={5}  className="bg-orange-800 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-r border-orange-700">RECEITA BRUTA</th>
                <th colSpan={1}  className="bg-emerald-800 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-r border-emerald-700">REC. LÍQUIDA</th>
                <th colSpan={2}  className="bg-indigo-700 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-r border-indigo-600">DEDUÇÕES EXTRAS</th>
                <th colSpan={3}  className="bg-teal-700 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-r border-teal-600">CUSTO / LUCRO BRUTO</th>
                <th colSpan={3}  className="bg-orange-700 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-r border-orange-600">DESPESAS</th>
                <th colSpan={1}  className="bg-slate-800 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-r border-slate-700">RESULTADO</th>
                <th className="bg-slate-600 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-r border-slate-500">AÇÕES</th>
                <th colSpan={2}   className="bg-violet-800 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-l-4 border-l-violet-950">DADOS ADICIONAIS</th>
              </tr>
              {/* Colunas */}
              <tr className="text-[10px] font-bold text-white">
                {/* IDENTIFICAÇÃO */}
                {['NF', 'Série', 'Transação', 'Data Venda', 'Departamento', 'Vendedor', 'Cond. Pagamento', 'Cliente', 'Cidade', 'Estado'].map((h, i) => (
                  <th
                    key={i}
                    style={i === 0 ? { position: 'sticky', left: 0, zIndex: 21 } : undefined}
                    className="bg-slate-700 px-3 py-2 text-left whitespace-nowrap border-b border-slate-600 border-r border-slate-600"
                  >
                    {h}
                  </th>
                ))}
                {/* RECEITA BRUTA */}
                {['Valor Venda', 'ICMS', 'PIS', 'COFINS', 'Difal'].map((h, i) => (
                  <th key={i} className="bg-orange-800 px-3 py-2 text-right whitespace-nowrap border-b border-orange-700 border-r border-orange-700">{h}</th>
                ))}
                {/* REC. LÍQUIDA */}
                <th className="bg-emerald-800 px-3 py-2 text-right whitespace-nowrap border-b border-emerald-700 border-r border-emerald-700">Rec. Líquida</th>
                {/* DEDUÇÕES EXTRAS */}
                {['Taxa Mercado Livre', 'Taxa E-Peças'].map((h, i) => (
                  <th key={i} className="bg-indigo-700 px-3 py-2 text-right whitespace-nowrap border-b border-indigo-600 border-r border-indigo-600">{h}</th>
                ))}
                {/* CUSTO / LUCRO BRUTO */}
                {['Custo Médio', 'Lucro Bruto', 'LB %'].map((h, i) => (
                  <th key={i} className="bg-teal-700 px-3 py-2 text-right whitespace-nowrap border-b border-teal-600 border-r border-teal-600">{h}</th>
                ))}
                {/* DESPESAS */}
                {['Comissão', 'DSR', 'Provisões'].map((h, i) => (
                  <th key={i} className="bg-orange-700 px-3 py-2 text-right whitespace-nowrap border-b border-orange-600 border-r border-orange-600">{h}</th>
                ))}
                {/* RESULTADO */}
                <th className="bg-slate-800 px-3 py-2 text-right whitespace-nowrap border-b border-slate-700 border-r border-slate-700">Resultado Líq.</th>
                <th className="bg-slate-600 px-3 py-2 text-center whitespace-nowrap border-b border-slate-500 border-r border-slate-500">Ações</th>
                {/* DADOS ADICIONAIS */}
                <th className="bg-violet-800 px-3 py-2 text-left whitespace-nowrap border-b border-violet-700 border-r border-violet-700 border-l-4 border-l-violet-950">Nota Fiscal</th>
                <th className="bg-violet-800 px-3 py-2 text-right whitespace-nowrap border-b border-violet-700">Valor do Título</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={28} className="text-center py-16 text-slate-300 text-sm">
                    Nenhum registro — importe dados de Peças Mercado Livre na aba Registros
                  </td>
                </tr>
              )}
              {filteredRows.map((row, ri) => {
                const d = row.data;
                const key = ovKey(d);
                const ov = overrides[key] ?? emptyOv();
                const taxaMLMatch = taxaMLLookup.get(d['NUMERO_NOTA_FISCAL']);
                const tituloNF  = taxaMLMatch?.data['TITULO'] ?? '';
                const tituloVal = taxaMLMatch?.data['VAL_TITULO'] ?? '';
                const autoTaxaML = tituloVal ? n(d['LIQ_NOTA_FISCAL']) - n(tituloVal) : 0;
                const c = calcPecasRow(d, ov, autoTaxaML);
                const bg = row.highlight ? 'bg-yellow-50' : ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
                const td = `${bg} border-b border-slate-100 align-middle`;
                const tdR = `${td} text-right`;

                return (
                  <tr key={row.id} className="group transition-colors hover:bg-orange-50/30">
                    {/* IDENTIFICAÇÃO */}
                    <td
                      className={`${td} px-2 min-w-[100px]`}
                      style={{ position: 'sticky', left: 0, zIndex: 4, background: row.highlight ? '#fef9c3' : ri % 2 === 0 ? '#ffffff' : '#f1f5f9' }}
                    >
                      <ReadCell value={d['NUMERO_NOTA_FISCAL']} />
                    </td>
                    <td className={`${td} px-2 min-w-[60px]`}><ReadCell value={d['SERIE_NOTA_FISCAL']} /></td>
                    <td className={`${td} px-2 min-w-[90px]`}><ReadCell value={d['TIPO_TRANSACAO']} /></td>
                    <td className={`${td} px-2 min-w-[100px]`}><ReadCell value={d['DTA_DOCUMENTO']} /></td>
                    <td className={`${td} px-2 min-w-[120px]`}><ReadCell value={d['DEPARTAMENTO']} /></td>
                    <td className={`${td} px-2 min-w-[130px]`}><ReadCell value={d['NOME_VENDEDOR']} /></td>
                    <td className={`${td} px-2 min-w-[130px]`}>
                      <EditCell value={ov.condPgto} type="text" onSave={v => updateOverride(key, 'condPgto', v)} />
                    </td>
                    <td className={`${td} px-2 min-w-[160px]`}><ReadCell value={d['NOME_CLIENTE']} /></td>
                    <td className={`${td} px-2 min-w-[110px]`}><ReadCell value={d['CIDADE']} /></td>
                    <td className={`${td} px-2 min-w-[60px]`}><ReadCell value={d['ESTADO']} /></td>
                    {/* RECEITA BRUTA */}
                    <td className={`${tdR} px-2 min-w-[120px]`}><ReadCell value={d['LIQ_NOTA_FISCAL']} currency /></td>
                    <td className={`${tdR} px-2 min-w-[100px]`}><ReadCell value={d['VAL_ICMS']} currency /></td>
                    <td className={`${tdR} px-2 min-w-[90px]`}><ReadCell value={d['VAL_PIS']} currency /></td>
                    <td className={`${tdR} px-2 min-w-[100px]`}><ReadCell value={d['VAL_COFINS']} currency /></td>
                    <td className={`${tdR} px-2 min-w-[100px]`}><CalcCell value={c.difal} /></td>
                    {/* REC. LÍQUIDA */}
                    <td className={`${tdR} px-2 min-w-[120px]`}><CalcCell value={c.recLiq} /></td>
                    {/* DEDUÇÕES EXTRAS */}
                    <td className={`${tdR} px-2 min-w-[120px]`}>
                      <CalcCell value={autoTaxaML} />
                    </td>
                    <td className={`${tdR} px-2 min-w-[110px]`}>
                      <EditCell value={ov.taxaEPecas} type="currency" onSave={v => updateOverride(key, 'taxaEPecas', v)} />
                    </td>
                    {/* CUSTO / LUCRO BRUTO */}
                    <td className={`${tdR} px-2 min-w-[120px]`}><ReadCell value={d['TOT_CUSTO_MEDIO']} currency /></td>
                    <td className={`${tdR} px-2 min-w-[110px]`}><CalcCell value={c.lucroBruto} negative /></td>
                    <td className={`${tdR} px-2 min-w-[80px]`}><CalcCell value={c.lucroBrutoPct} pct negative /></td>
                    {/* DESPESAS */}
                    <td className={`${tdR} px-2 min-w-[110px]`}>
                      <EditCell value={ov.comissao} type="currency" onSave={v => updateOverride(key, 'comissao', v)} />
                    </td>
                    <td className={`${tdR} px-2 min-w-[90px]`}>
                      <EditCell value={ov.dsr} type="currency" onSave={v => updateOverride(key, 'dsr', v)} />
                    </td>
                    <td className={`${tdR} px-2 min-w-[100px]`}>
                      <EditCell value={ov.provisoes} type="currency" onSave={v => updateOverride(key, 'provisoes', v)} />
                    </td>
                    {/* RESULTADO */}
                    <td className={`${tdR} px-2 min-w-[120px]`}><CalcCell value={c.resultado} negative /></td>
                    {/* AÇÕES */}
                    <td className={`${td} px-2 text-center border-l border-slate-100 min-w-[80px]`}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          title="Destacar"
                          onClick={() => toggleHighlight(row.id)}
                          className={`p-1 rounded hover:bg-yellow-100 transition-colors ${row.highlight ? 'text-yellow-500' : 'text-slate-300 hover:text-yellow-400'}`}
                        >
                          <Highlighter className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Anotação"
                          onClick={() => { setEditingAnnotation(row.id); setAnnotationDraft(row.annotation ?? ''); }}
                          className={`p-1 rounded hover:bg-blue-50 transition-colors ${row.annotation ? 'text-blue-500' : 'text-slate-300 hover:text-blue-400'}`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    {/* DADOS ADICIONAIS */}
                    <td className={`${td} px-2 min-w-[130px] border-l-4 border-l-violet-300`}>
                      <ReadCell value={tituloNF} />
                    </td>
                    <td className={`${tdR} px-2 min-w-[130px]`}>
                      <ReadCell value={tituloVal} currency />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Linha de totais */}
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-800 text-white text-xs font-bold">
                  <td colSpan={10} className="px-3 py-2 text-left">TOTAIS ({filteredRows.length} registros)</td>
                  <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.valorVenda)}</td>
                  <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.icms)}</td>
                  <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.pis)}</td>
                  <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.cofins)}</td>
                  <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.difal)}</td>
                  <td className={`px-2 py-2 text-right font-mono ${totals.recLiq >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>R$ {fmt(totals.recLiq)}</td>
                  <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.taxaML)}</td>
                  <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.taxaEPecas)}</td>
                  <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.custo)}</td>
                  <td className={`px-2 py-2 text-right font-mono ${totals.lucroBruto >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>R$ {fmt(totals.lucroBruto)}</td>
                  <td className={`px-2 py-2 text-right font-mono ${totals.lucroBrutoPct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{fmtPct(totals.lucroBrutoPct)}</td>
                  <td className="px-2 py-2 text-right font-mono text-red-300">R$ {fmt(totals.comissao)}</td>
                  <td className="px-2 py-2 text-right font-mono text-red-300">R$ {fmt(totals.dsr)}</td>
                  <td className="px-2 py-2 text-right font-mono text-red-300">R$ {fmt(totals.provisoes)}</td>
                  <td className={`px-2 py-2 text-right font-mono ${totals.resultado >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>R$ {fmt(totals.resultado)}</td>
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2 border-l-4 border-l-violet-600" />
                  <td className="px-2 py-2 text-right font-mono text-violet-300">R$ {fmt(totals.totalValTitulo)}</td>
                </tr>
              </tfoot>
            )}
          </table>
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

      {/* Modal de anotação */}
      {editingAnnotation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
            <h3 className="font-semibold text-slate-800 mb-3">Anotação</h3>
            <textarea
              autoFocus
              value={annotationDraft}
              onChange={e => setAnnotationDraft(e.target.value)}
              rows={4}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              placeholder="Digite uma anotação..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setEditingAnnotation(null)}>Cancelar</Button>
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => {
                  setAllRows(prev => prev.map(r => r.id === editingAnnotation ? { ...r, annotation: annotationDraft } : r));
                  setEditingAnnotation(null);
                }}
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
