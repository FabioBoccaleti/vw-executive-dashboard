import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { loadVPecasItemRows, type VPecasItemRow } from './vPecasItemStorage';

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

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── Período de uma linha ─────────────────────────────────────────────────────
function rowPeriod(row: VPecasItemRow): { year: number; month: number } | null {
  if (row.periodoImport) {
    const [y, m] = row.periodoImport.split('-').map(Number);
    if (y > 2000 && m >= 1 && m <= 12) return { year: y, month: m };
  }
  const dta = row.data['DTA_ENTRADA_SAIDA'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dta)) {
    return { year: parseInt(dta.split('/')[2]), month: parseInt(dta.split('/')[1]) };
  }
  return null;
}

// ─── Cálculos derivados ───────────────────────────────────────────────────────
interface ItemCalc {
  recLiq: number;
  lucroBruto: number;
  lucroBrutoPct: number;
}

function calcItem(d: Record<string, string>): ItemCalc {
  const valorVenda  = n(d['VAL_VENDA']);
  const impostos    = n(d['VAL_IMPOSTOS']);
  const custoMedio  = n(d['CUSTO_MEDIO']);
  const recLiq      = valorVenda - impostos;
  const lucroBruto  = recLiq - custoMedio;
  const lucroBrutoPct = recLiq !== 0 ? (lucroBruto / recLiq) * 100 : 0;
  return { recLiq, lucroBruto, lucroBrutoPct };
}

// ─── Células de exibição ─────────────────────────────────────────────────────
function CurrencyCell({ value }: { value: number }) {
  const color = value < 0 ? 'text-red-600' : '';
  return <div className={`text-xs font-mono px-1 text-right ${color}`}>R$ {fmt(value)}</div>;
}

function PctCell({ value }: { value: number }) {
  const color = value < 0 ? 'text-red-600' : value > 0 ? 'text-emerald-700' : 'text-slate-400';
  return <div className={`text-xs font-mono font-semibold px-1 text-right ${color}`}>{fmtPct(value)}</div>;
}

function TextCell({ value }: { value?: string }) {
  if (!value) return <span className="text-slate-300 text-xs px-1">—</span>;
  return <div className="text-xs px-1 truncate">{value}</div>;
}

// ─── Export Excel ─────────────────────────────────────────────────────────────
async function exportItemExcel(rows: VPecasItemRow[], filename: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();
  const ws = wb.addWorksheet('Vendas por Item', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: 'FF0EA5E9' } },
  });

  const headers = [
    'Nota Fiscal', 'Data da Venda', 'Transação', 'Departamento', 'Vendedor', 'Cliente',
    'Quantidade', 'Valor Unitário', 'Código Item', 'Descrição do Item',
    'Valor da Venda', 'Valor dos Impostos', 'Receita Líquida',
    'Custo Médio', 'Lucro Bruto', '% Lucro Bruto',
  ];

  const colWidths = [14, 12, 12, 18, 20, 26, 10, 16, 16, 32, 16, 16, 16, 16, 16, 12];
  ws.columns = colWidths.map(w => ({ width: w }));

  const today = new Date().toLocaleDateString('pt-BR');
  const titleRow = ws.addRow([`Vendas de Peças por Item — ${today}`]);
  ws.mergeCells(1, 1, 1, headers.length);
  titleRow.height = 30;
  titleRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF075985' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 13 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const headerRow = ws.addRow(headers);
  headerRow.height = 36;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: headers.length } };

  const BTHIN = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const BRL = '"R$"\\ #,##0.00';
  const PCT = '#,##0.00"%"';

  rows.forEach((row, ri) => {
    const d = row.data;
    const c = calcItem(d);
    const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF0F9FF';
    const vals = [
      d['NUMERO_NOTA_FISCAL'],
      d['DTA_ENTRADA_SAIDA'],
      d['TIPO_TRANSACAO'],
      d['DEPARTAMENTO'],
      d['NOME_VENDEDOR'],
      d['NOME_CLIENTE'],
      d['QUANTIDADE'],
      n(d['VAL_UNITARIO']),
      d['ITEM_ESTOQUE_PUB'],
      d['DES_ITEM_ESTOQUE'],
      n(d['VAL_VENDA']),
      n(d['VAL_IMPOSTOS']),
      c.recLiq,
      n(d['CUSTO_MEDIO']),
      c.lucroBruto,
      c.lucroBrutoPct,
    ];
    const dr = ws.addRow(vals);
    dr.height = 17;
    const currencyCols = [8, 11, 12, 13, 14, 15];
    const pctCols = [16];
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
  saveAs(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function VPecasItemVendasTable() {
  const [allRows, setAllRows] = useState<VPecasItemRow[]>([]);
  const [filterYear, setFilterYear]   = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(new Date().getMonth() + 1);

  useEffect(() => {
    loadVPecasItemRows().then(rows => setAllRows(rows));
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
      counts[p.month] = (counts[p.month] ?? 0) + 1;
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

  const totals = useMemo(() => {
    let valorVenda = 0, impostos = 0, recLiq = 0, custoMedio = 0, lucroBruto = 0;
    filteredRows.forEach(r => {
      const c = calcItem(r.data);
      valorVenda  += n(r.data['VAL_VENDA']);
      impostos    += n(r.data['VAL_IMPOSTOS']);
      recLiq      += c.recLiq;
      custoMedio  += n(r.data['CUSTO_MEDIO']);
      lucroBruto  += c.lucroBruto;
    });
    const lucroBrutoPct = recLiq !== 0 ? (lucroBruto / recLiq) * 100 : 0;
    return { valorVenda, impostos, recLiq, custoMedio, lucroBruto, lucroBrutoPct };
  }, [filteredRows]);

  // Scroll sync
  const tableRef     = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
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
              className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-sky-400"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterMonth(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterMonth === null ? 'bg-sky-600 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Ano todo
            </button>
            {MONTHS.map((m, i) => (
              <button
                key={m}
                onClick={() => setFilterMonth(i + 1)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterMonth === i + 1 ? 'bg-sky-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                } ${monthCounts[i + 1] ? 'font-semibold' : ''}`}
              >
                {m}
                {monthCounts[i + 1] ? <span className="ml-0.5 text-[10px] opacity-70">({monthCounts[i + 1]})</span> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{filteredRows.length} item(s)</span>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                const monthLabel = filterMonth ? MONTHS[filterMonth - 1] : 'Ano-todo';
                await exportItemExcel(
                  filteredRows,
                  `vpecas_item_vendas_${filterYear}_${monthLabel}.xlsx`,
                );
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
          <table className="w-full border-separate border-spacing-0 text-xs" style={{ minWidth: 1600 }}>
            <thead className="sticky top-0 z-10">
              <tr className="text-[10px] font-bold text-white">
                {/* Identificação */}
                {['Nota Fiscal', 'Data da Venda', 'Transação', 'Departamento', 'Vendedor', 'Cliente', 'Qtd', 'Vlr Unitário', 'Código Item', 'Descrição do Item'].map((h, i) => (
                  <th
                    key={h}
                    style={i === 0 ? { position: 'sticky', left: 0, zIndex: 21 } : undefined}
                    className="bg-slate-700 px-3 py-2 text-left whitespace-nowrap border-b border-slate-600 border-r border-slate-600"
                  >
                    {h}
                  </th>
                ))}
                {/* Financeiro */}
                {['Valor da Venda', 'Valor dos Impostos', 'Receita Líquida', 'Custo Médio', 'Lucro Bruto', '% Lucro Bruto'].map(h => (
                  <th key={h} className="bg-emerald-800 px-3 py-2 text-right whitespace-nowrap border-b border-emerald-700 border-r border-emerald-700">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={16} className="text-center text-slate-400 py-16 text-sm">
                    Nenhum item encontrado para o período selecionado.
                  </td>
                </tr>
              )}
              {filteredRows.map((row, ri) => {
                const d = row.data;
                const c = calcItem(d);
                const bg = ri % 2 === 0 ? 'bg-white' : 'bg-sky-50/30';
                const hl = row.highlight ? 'ring-1 ring-inset ring-amber-400' : '';
                return (
                  <tr key={row.id} className={`${bg} ${hl} hover:bg-sky-100/40 transition-colors`}>
                    {/* Identificação */}
                    <td style={{ position: 'sticky', left: 0, zIndex: 1 }}
                      className={`${bg} border-b border-slate-100 border-r border-slate-100 px-3 py-1.5 min-w-[120px] font-mono text-xs`}>
                      {d['NUMERO_NOTA_FISCAL'] || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="border-b border-slate-100 border-r border-slate-100 px-1 py-1.5 min-w-[105px]">
                      <TextCell value={d['DTA_ENTRADA_SAIDA']} />
                    </td>
                    <td className="border-b border-slate-100 border-r border-slate-100 px-1 py-1.5 min-w-[90px]">
                      <TextCell value={d['TIPO_TRANSACAO']} />
                    </td>
                    <td className="border-b border-slate-100 border-r border-slate-100 px-1 py-1.5 min-w-[130px]">
                      <TextCell value={d['DEPARTAMENTO']} />
                    </td>
                    <td className="border-b border-slate-100 border-r border-slate-100 px-1 py-1.5 min-w-[130px]">
                      <TextCell value={d['NOME_VENDEDOR']} />
                    </td>
                    <td className="border-b border-slate-100 border-r border-slate-100 px-1 py-1.5 min-w-[180px] max-w-[220px]">
                      <TextCell value={d['NOME_CLIENTE']} />
                    </td>
                    <td className="border-b border-slate-100 border-r border-slate-100 px-1 py-1.5 min-w-[60px] text-right font-mono text-xs">
                      {d['QUANTIDADE'] || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="border-b border-slate-100 border-r border-slate-100 px-1 py-1.5 min-w-[110px]">
                      <CurrencyCell value={n(d['VAL_UNITARIO'])} />
                    </td>
                    <td className="border-b border-slate-100 border-r border-slate-100 px-1 py-1.5 min-w-[120px] font-mono text-xs">
                      <TextCell value={d['ITEM_ESTOQUE_PUB']} />
                    </td>
                    <td className="border-b border-slate-100 border-r border-slate-100 px-1 py-1.5 min-w-[200px] max-w-[280px]">
                      <TextCell value={d['DES_ITEM_ESTOQUE']} />
                    </td>
                    {/* Financeiro */}
                    <td className="border-b border-slate-100 border-r border-slate-100 px-1 py-1.5 min-w-[120px]">
                      <CurrencyCell value={n(d['VAL_VENDA'])} />
                    </td>
                    <td className="border-b border-slate-100 border-r border-slate-100 px-1 py-1.5 min-w-[120px]">
                      <CurrencyCell value={n(d['VAL_IMPOSTOS'])} />
                    </td>
                    <td className="border-b border-slate-100 border-r border-slate-100 px-1 py-1.5 min-w-[120px]">
                      <CurrencyCell value={c.recLiq} />
                    </td>
                    <td className="border-b border-slate-100 border-r border-slate-100 px-1 py-1.5 min-w-[120px]">
                      <CurrencyCell value={n(d['CUSTO_MEDIO'])} />
                    </td>
                    <td className="border-b border-slate-100 border-r border-slate-100 px-1 py-1.5 min-w-[120px]">
                      <CurrencyCell value={c.lucroBruto} />
                    </td>
                    <td className="border-b border-slate-100 border-r border-slate-100 px-1 py-1.5 min-w-[100px]">
                      <PctCell value={c.lucroBrutoPct} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totais */}
            {filteredRows.length > 0 && (
              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-slate-800 text-white text-xs font-bold">
                  <td colSpan={10} className="px-3 py-2 text-left sticky left-0 bg-slate-800 z-10">
                    TOTAL ({filteredRows.length} itens)
                  </td>
                  <td className="px-1 py-2 text-right font-mono">R$ {fmt(totals.valorVenda)}</td>
                  <td className="px-1 py-2 text-right font-mono">R$ {fmt(totals.impostos)}</td>
                  <td className="px-1 py-2 text-right font-mono">R$ {fmt(totals.recLiq)}</td>
                  <td className="px-1 py-2 text-right font-mono">R$ {fmt(totals.custoMedio)}</td>
                  <td className="px-1 py-2 text-right font-mono">R$ {fmt(totals.lucroBruto)}</td>
                  <td className="px-1 py-2 text-right font-mono">{fmtPct(totals.lucroBrutoPct)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Scrollbar horizontal fixo */}
        <div
          ref={scrollbarRef}
          onScroll={() => { if (tableRef.current && scrollbarRef.current) tableRef.current.scrollLeft = scrollbarRef.current.scrollLeft; }}
          className="overflow-x-auto flex-shrink-0 border-t border-slate-100"
          style={{ height: 14 }}
        >
          <div ref={scrollDummyRef} style={{ height: 1 }} />
        </div>
      </div>
    </div>
  );
}
