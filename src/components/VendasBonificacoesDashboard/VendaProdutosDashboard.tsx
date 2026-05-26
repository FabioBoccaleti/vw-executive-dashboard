import { useState, useEffect, useMemo, useRef } from 'react';
import { Download, FileSpreadsheet, ChevronDown, BarChart2, List, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { loadProdutosRows } from './produtosMonitoradosStorage';
import type { VPecasItemRow } from './vPecasItemStorage';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function n(v: string | undefined): number {
  return parseFloat(String(v ?? '').replace(',', '.')) || 0;
}
function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}
function fmtQtd(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ─── Colunas brutas do arquivo ────────────────────────────────────────────────
const RAW_COLS = [
  'NUMERO_NOTA_FISCAL',
  'DTA_ENTRADA_SAIDA',
  'TIPO_TRANSACAO',
  'DEPARTAMENTO',
  'NOME_VENDEDOR',
  'NOME_CLIENTE',
  'ITEM_ESTOQUE_PUB',
  'DES_ITEM_ESTOQUE',
  'QUANTIDADE',
  'VAL_UNITARIO',
  'VAL_VENDA',
  'VAL_IMPOSTOS',
  'CUSTO_MEDIO',
] as const;

const CURRENCY_COLS = new Set(['VAL_UNITARIO', 'VAL_VENDA', 'VAL_IMPOSTOS', 'CUSTO_MEDIO']);
const NUMERIC_COLS  = new Set(['QUANTIDADE']);

// ─── Período ──────────────────────────────────────────────────────────────────
function rowPeriod(r: VPecasItemRow): { year: number; month: number } | null {
  if (r.periodoImport) {
    const [y, m] = r.periodoImport.split('-').map(Number);
    if (y > 2000 && m >= 1 && m <= 12) return { year: y, month: m };
  }
  const dta = r.data['DTA_ENTRADA_SAIDA'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dta)) {
    return { year: parseInt(dta.split('/')[2]), month: parseInt(dta.split('/')[1]) };
  }
  return null;
}

// ─── Cálculos por linha ───────────────────────────────────────────────────────
interface Calc {
  recLiq: number;
  lucroBruto: number;
  lucroBrutoPct: number;
}

function calcRow(d: Record<string, string>): Calc {
  const valVenda    = n(d['VAL_VENDA']);
  const valImpostos = n(d['VAL_IMPOSTOS']);
  const custoMedio  = n(d['CUSTO_MEDIO']);
  const recLiq      = valVenda - valImpostos;
  const lucroBruto  = recLiq - custoMedio;
  const lucroBrutoPct = recLiq !== 0 ? (lucroBruto / recLiq) * 100 : 0;
  return { recLiq, lucroBruto, lucroBrutoPct };
}

// ─── Export Excel ─────────────────────────────────────────────────────────────
async function exportToExcel(rows: VPecasItemRow[], filename: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();
  const ws = wb.addWorksheet('Venda de Produtos', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: 'FF7C3AED' } },
  });

  const headers = [
    'NF', 'Data', 'Tipo Transação', 'Departamento', 'Vendedor', 'Cliente',
    'ITEM_ESTOQUE_PUB', 'Descrição', 'Quantidade',
    'Val. Unitário', 'Val. Venda', 'Val. Impostos',
    'Receita Líquida', 'Custo Médio', 'Lucro Bruto', '% Lucro Bruto',
  ];
  ws.columns = headers.map(() => ({ width: 20 }));

  const today = new Date().toLocaleDateString('pt-BR');
  const titleRow = ws.addRow([`Venda de Produtos — ${today}`]);
  ws.mergeCells(1, 1, 1, headers.length);
  titleRow.height = 30;
  titleRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C1D95' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 13 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const headerRow = ws.addRow(headers);
  headerRow.height = 36;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: headers.length } };

  const BTHIN = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const BRL_FMT = '"R$"\\ #,##0.00';
  const PCT_FMT = '#,##0.00"%"';

  rows.forEach((row, ri) => {
    const d = row.data;
    const c = calcRow(d);
    const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF5F3FF';
    const vals = [
      d['NUMERO_NOTA_FISCAL'] ?? '',
      d['DTA_ENTRADA_SAIDA']  ?? '',
      d['TIPO_TRANSACAO']     ?? '',
      d['DEPARTAMENTO']       ?? '',
      d['NOME_VENDEDOR']      ?? '',
      d['NOME_CLIENTE']       ?? '',
      d['ITEM_ESTOQUE_PUB']   ?? '',
      d['DES_ITEM_ESTOQUE']   ?? '',
      n(d['QUANTIDADE']),
      n(d['VAL_UNITARIO']),
      n(d['VAL_VENDA']),
      n(d['VAL_IMPOSTOS']),
      c.recLiq,
      n(d['CUSTO_MEDIO']),
      c.lucroBruto,
      c.lucroBrutoPct,
    ];
    const dr = ws.addRow(vals);
    dr.height = 17;
    const currencyCols = [10, 11, 12, 13, 14, 15];
    const pctCols      = [16];
    const numCols      = [9];
    dr.eachCell({ includeEmpty: true }, (cell, ci) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { top: BTHIN, bottom: BTHIN, left: BTHIN, right: BTHIN };
      if (currencyCols.includes(ci)) {
        cell.numFmt = BRL_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { size: 9, name: 'Courier New' };
      } else if (pctCols.includes(ci)) {
        cell.numFmt = PCT_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { size: 9, name: 'Courier New' };
      } else if (numCols.includes(ci)) {
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

// ─── Resumo por item ──────────────────────────────────────────────────────────
interface ItemSummary {
  pub: string;
  des: string;
  qtd: number;
  valVenda: number;
  recLiq: number;
  lucroBruto: number;
  lucroBrutoPct: number;
}

function buildSummary(rows: VPecasItemRow[]): ItemSummary[] {
  const map = new Map<string, ItemSummary>();
  for (const row of rows) {
    const pub = row.data['ITEM_ESTOQUE_PUB'] ?? '(sem código)';
    const des = row.data['DES_ITEM_ESTOQUE'] ?? '';
    const c   = calcRow(row.data);
    const existing = map.get(pub);
    if (existing) {
      existing.qtd        += n(row.data['QUANTIDADE']);
      existing.valVenda   += n(row.data['VAL_VENDA']);
      existing.recLiq     += c.recLiq;
      existing.lucroBruto += c.lucroBruto;
    } else {
      map.set(pub, {
        pub, des,
        qtd:        n(row.data['QUANTIDADE']),
        valVenda:   n(row.data['VAL_VENDA']),
        recLiq:     c.recLiq,
        lucroBruto: c.lucroBruto,
        lucroBrutoPct: 0,
      });
    }
  }
  // Recalcula % Lucro Bruto pela soma
  for (const s of map.values()) {
    s.lucroBrutoPct = s.recLiq !== 0 ? (s.lucroBruto / s.recLiq) * 100 : 0;
  }
  return Array.from(map.values()).sort((a, b) => b.recLiq - a.recLiq);
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function VendaProdutosDashboard() {
  const [rows, setRows]               = useState<VPecasItemRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filterYear, setFilterYear]   = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [showSummary, setShowSummary] = useState(true);
  const [summaryView, setSummaryView] = useState<'cards' | 'ranking'>('cards');
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    loadProdutosRows().then(data => { setRows(data); setLoading(false); });
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    rows.forEach(r => { const p = rowPeriod(r); if (p) years.add(p.year); });
    const sorted = Array.from(years).sort((a, b) => b - a);
    return sorted.length ? sorted : [new Date().getFullYear()];
  }, [rows]);

  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    rows.forEach(r => {
      const p = rowPeriod(r);
      if (p && p.year === filterYear) counts[p.month] = (counts[p.month] ?? 0) + 1;
    });
    return counts;
  }, [rows, filterYear]);

  const filteredRows = useMemo(() => rows.filter(r => {
    const p = rowPeriod(r);
    if (!p) return false;
    if (p.year !== filterYear) return false;
    if (filterMonth !== null && p.month !== filterMonth) return false;
    return true;
  }), [rows, filterYear, filterMonth]);

  // KPIs globais
  const kpis = useMemo(() => {
    const totals = filteredRows.reduce((acc, r) => {
      const c = calcRow(r.data);
      return {
        valVenda:    acc.valVenda   + n(r.data['VAL_VENDA']),
        valImpostos: acc.valImpostos + n(r.data['VAL_IMPOSTOS']),
        recLiq:      acc.recLiq    + c.recLiq,
        custoMedio:  acc.custoMedio + n(r.data['CUSTO_MEDIO']),
        lucroBruto:  acc.lucroBruto + c.lucroBruto,
        qtd:         acc.qtd       + n(r.data['QUANTIDADE']),
      };
    }, { valVenda: 0, valImpostos: 0, recLiq: 0, custoMedio: 0, lucroBruto: 0, qtd: 0 });
    const lucroBrutoPct = totals.recLiq !== 0 ? (totals.lucroBruto / totals.recLiq) * 100 : 0;
    return { ...totals, lucroBrutoPct };
  }, [filteredRows]);

  const summary = useMemo(() => buildSummary(filteredRows), [filteredRows]);

  async function handleExport() {
    try {
      const monthLabel = filterMonth ? MONTHS[filterMonth - 1] : 'Ano-todo';
      await exportToExcel(filteredRows, `venda_produtos_${filterYear}_${monthLabel}.xlsx`);
      toast.success('Arquivo Excel gerado!');
    } catch (err) {
      toast.error(`Erro ao gerar Excel: ${String(err)}`);
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50" style={{ minHeight: 0 }}>

      {/* Banner */}
      <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs text-violet-800 flex-shrink-0">
        <span className="mt-0.5 shrink-0">ℹ️</span>
        <span>
          Dados sincronizados automaticamente dos <strong>Produtos Monitorados</strong> em
          Registros → Itens de Peças. Valores de Receita Líquida, Lucro Bruto e % Lucro Bruto
          são calculados: <strong>Rec. Líq. = Val. Venda − Val. Impostos</strong> ·{' '}
          <strong>Lucro = Rec. Líq. − Custo Médio</strong>.
        </span>
      </div>

      {/* Barra de ações */}
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-3 flex-shrink-0 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          className={`flex items-center gap-2 h-8 text-xs ${showSummary ? 'border-violet-400 text-violet-700 bg-violet-50' : 'border-slate-300 text-slate-700'}`}
          onClick={() => setShowSummary(v => !v)}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          Resumo por Produto
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs"
          onClick={handleExport}
        >
          <Download className="w-3.5 h-3.5" />
          Exportar Excel
        </Button>
        <span className="text-xs text-slate-400 ml-auto">
          {filteredRows.length} transação(ões) · dados de Registros → Produtos
        </span>
      </div>

      {/* Filtro Ano / Mês */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 flex-shrink-0 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">ANO</span>
        <div className="relative mr-2">
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            className="appearance-none text-sm font-bold text-slate-700 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="w-px h-5 bg-slate-200 mr-1" />
        <button
          onClick={() => setFilterMonth(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterMonth === null ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
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
                isActive ? 'bg-violet-600 text-white shadow-sm' : hasData ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-300 cursor-default'
              }`}
            >
              {name}
              {hasData && (
                <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 rounded-full leading-none py-0.5 ${isActive ? 'bg-white text-violet-700' : 'bg-violet-100 text-violet-600'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* KPIs */}
      <div className="bg-white border-b border-slate-100 px-6 py-2 flex items-center gap-6 flex-shrink-0 flex-wrap">
        <span className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{filteredRows.length}</span> transação(ões)
        </span>
        <span className="text-xs text-slate-500">
          Val. Venda: <span className="font-semibold text-violet-700 font-mono">{fmtBRL(kpis.valVenda)}</span>
        </span>
        <span className="text-xs text-slate-500">
          Impostos: <span className="font-semibold text-slate-600 font-mono">{fmtBRL(kpis.valImpostos)}</span>
        </span>
        <span className="text-xs text-slate-500">
          Rec. Líquida: <span className="font-semibold text-teal-700 font-mono">{fmtBRL(kpis.recLiq)}</span>
        </span>
        <span className="text-xs text-slate-500">
          Custo Médio: <span className="font-semibold text-slate-600 font-mono">{fmtBRL(kpis.custoMedio)}</span>
        </span>
        <span className="text-xs text-slate-500">
          Lucro Bruto:{' '}
          <span className={`font-semibold font-mono ${kpis.lucroBruto >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {fmtBRL(kpis.lucroBruto)}
          </span>
        </span>
        <span className="text-xs text-slate-500">
          % Lucro:{' '}
          <span className={`font-semibold font-mono ${kpis.lucroBrutoPct >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {fmtPct(kpis.lucroBrutoPct)}
          </span>
        </span>
        <span className="text-xs text-slate-500">
          Qtde: <span className="font-semibold text-slate-700 font-mono">{fmtQtd(kpis.qtd)}</span>
        </span>
      </div>

      {/* ─── Resumo por produto ─────────────────────────────────────────────── */}
      {showSummary && filteredRows.length > 0 && (
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Resumo por Produto</span>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setSummaryView('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${summaryView === 'cards' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <BarChart2 className="w-3.5 h-3.5" /> Cards
              </button>
              <button
                onClick={() => setSummaryView('ranking')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${summaryView === 'ranking' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <List className="w-3.5 h-3.5" /> Ranking
              </button>
            </div>
          </div>

          {summaryView === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {summary.map(s => (
                <div key={s.pub} className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-violet-700 font-mono truncate">{s.pub}</p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5" title={s.des}>{s.des || '—'}</p>
                    </div>
                    <span className={`flex-shrink-0 flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      s.lucroBrutoPct >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {s.lucroBrutoPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {fmtPct(s.lucroBrutoPct)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide">Qtde</span>
                      <span className="text-xs font-semibold text-slate-700 font-mono">{fmtQtd(s.qtd)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide">Val. Venda</span>
                      <span className="text-xs font-semibold text-violet-700 font-mono">{fmtBRL(s.valVenda)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide">Rec. Líquida</span>
                      <span className="text-xs font-semibold text-teal-700 font-mono">{fmtBRL(s.recLiq)}</span>
                    </div>
                    <div className="h-px bg-slate-200 my-1" />
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide">Lucro Bruto</span>
                      <span className={`text-xs font-bold font-mono ${s.lucroBruto >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {fmtBRL(s.lucroBruto)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide">% Lucro Bruto</span>
                      <span className={`text-xs font-bold font-mono ${s.lucroBrutoPct >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {fmtPct(s.lucroBrutoPct)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-violet-700 text-white">
                    {['#', 'Código', 'Descrição', 'Qtde', 'Val. Venda', 'Rec. Líquida', 'Lucro Bruto', '% Lucro Bruto'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s, i) => (
                    <tr key={s.pub} className={i % 2 === 0 ? 'bg-white' : 'bg-violet-50/40'}>
                      <td className="px-3 py-2 text-slate-400 text-center font-mono">{i + 1}</td>
                      <td className="px-3 py-2 font-mono font-bold text-violet-700">{s.pub}</td>
                      <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{s.des || '—'}</td>
                      <td className="px-3 py-2 font-mono text-right text-slate-700">{fmtQtd(s.qtd)}</td>
                      <td className="px-3 py-2 font-mono text-right text-violet-700">{fmtBRL(s.valVenda)}</td>
                      <td className="px-3 py-2 font-mono text-right text-teal-700">{fmtBRL(s.recLiq)}</td>
                      <td className={`px-3 py-2 font-mono text-right font-semibold ${s.lucroBruto >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {fmtBRL(s.lucroBruto)}
                      </td>
                      <td className={`px-3 py-2 font-mono text-right font-semibold ${s.lucroBrutoPct >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {fmtPct(s.lucroBrutoPct)}
                      </td>
                    </tr>
                  ))}
                  {/* Totais */}
                  <tr className="bg-violet-100 font-bold border-t-2 border-violet-300">
                    <td colSpan={3} className="px-3 py-2 text-violet-800 text-xs uppercase tracking-wide">Total</td>
                    <td className="px-3 py-2 font-mono text-right text-slate-700">{fmtQtd(kpis.qtd)}</td>
                    <td className="px-3 py-2 font-mono text-right text-violet-800">{fmtBRL(kpis.valVenda)}</td>
                    <td className="px-3 py-2 font-mono text-right text-teal-800">{fmtBRL(kpis.recLiq)}</td>
                    <td className={`px-3 py-2 font-mono text-right ${kpis.lucroBruto >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>{fmtBRL(kpis.lucroBruto)}</td>
                    <td className={`px-3 py-2 font-mono text-right ${kpis.lucroBrutoPct >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>{fmtPct(kpis.lucroBrutoPct)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Tabela de transações ────────────────────────────────────────────── */}
      <div ref={tableRef} className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Carregando...</div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-2">
            <FileSpreadsheet className="w-10 h-10" />
            <span className="text-sm">
              {rows.length === 0
                ? 'Nenhum dado — importe um TXT em Registros → Itens de Peças'
                : 'Nenhuma transação no período selecionado'}
            </span>
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-violet-700 text-white">
                {[
                  'NF', 'Data', 'Tipo', 'Depto', 'Vendedor', 'Cliente',
                  'Código', 'Descrição', 'Qtde',
                  'Val. Unitário', 'Val. Venda', 'Val. Impostos',
                  'Rec. Líquida', 'Custo Médio', 'Lucro Bruto', '% Lucro Bruto',
                ].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row, i) => {
                const d = row.data;
                const c = calcRow(d);
                const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
                return (
                  <tr key={row.id} className={`${rowBg} hover:bg-violet-50/30 transition-colors border-b border-slate-100`}>
                    {/* Colunas brutas */}
                    {RAW_COLS.map(col => {
                      const val = d[col] ?? '';
                      if (CURRENCY_COLS.has(col)) {
                        return (
                          <td key={col} className="px-3 py-1.5 font-mono text-right whitespace-nowrap text-slate-700 text-[11px]">
                            {fmtBRL(n(val))}
                          </td>
                        );
                      }
                      if (NUMERIC_COLS.has(col)) {
                        return (
                          <td key={col} className="px-3 py-1.5 font-mono text-center whitespace-nowrap text-slate-700 text-[11px]">
                            {fmtQtd(n(val))}
                          </td>
                        );
                      }
                      return (
                        <td key={col} className="px-3 py-1.5 text-slate-700 whitespace-nowrap text-[11px] max-w-[200px] truncate">
                          {val || '—'}
                        </td>
                      );
                    })}
                    {/* Receita Líquida */}
                    <td className="px-3 py-1.5 font-mono text-right whitespace-nowrap text-teal-700 text-[11px] font-semibold">
                      {fmtBRL(c.recLiq)}
                    </td>
                    {/* Lucro Bruto */}
                    <td className={`px-3 py-1.5 font-mono text-right whitespace-nowrap text-[11px] font-semibold ${c.lucroBruto >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {fmtBRL(c.lucroBruto)}
                    </td>
                    {/* % Lucro Bruto */}
                    <td className={`px-3 py-1.5 font-mono text-right whitespace-nowrap text-[11px] font-semibold ${c.lucroBrutoPct >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {fmtPct(c.lucroBrutoPct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
