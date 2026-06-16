import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Loader2, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  loadPrestadores,
  loadLancamento,
  totalLancamento,
  type PrestadorPJ,
  type TipoRemuneracao,
} from './remPjStorage';

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - 5 + i);

type BrandFilter = 'todos' | 'vw' | 'audi';

const VERBA_TYPES = [
  { key: 'fixa', label: 'Fixa' },
  { key: 'variavel', label: 'Variável' },
  { key: 'premio', label: 'Prêmio' },
] as const;

interface ResumoRow {
  id: string;
  nome: string;
  categoria: string;
  brand: PrestadorPJ['brand'];
  monthTotals: number[];
  total: number;
  totalVw: number;
  totalAudi: number;
  mesesComPagamento: number;
  verbaTotals: Record<TipoRemuneracao, number>;
  verbaMonthTotals: Record<TipoRemuneracao, number[]>;
  variavelItemTotals: Record<string, number>;
  variavelItemMonthTotals: Record<string, number[]>;
}

function fmtBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function ResumoRemuneracoesPJPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [filterBrand, setFilterBrand] = useState<BrandFilter>('todos');
  const [loadingPrestadores, setLoadingPrestadores] = useState(true);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);
  const [prestadores, setPrestadores] = useState<PrestadorPJ[]>([]);
  const [rows, setRows] = useState<ResumoRow[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const tableRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    loadPrestadores().then((list) => {
      if (!mounted) return;
      setPrestadores(list.filter((p) => p.ativo));
      setLoadingPrestadores(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const carregarResumo = useCallback(async () => {
    setLoadingResumo(true);
    const result = await Promise.all(
      prestadores.map(async (prestador): Promise<ResumoRow> => {
        const monthTotals = Array.from({ length: 12 }, () => 0);
        const verbaTotals: Record<TipoRemuneracao, number> = { fixa: 0, variavel: 0, premio: 0 };
        const verbaMonthTotals: Record<TipoRemuneracao, number[]> = {
          fixa: Array.from({ length: 12 }, () => 0),
          variavel: Array.from({ length: 12 }, () => 0),
          premio: Array.from({ length: 12 }, () => 0),
        };
        const variavelItemTotals: Record<string, number> = {};
        const variavelItemMonthTotals: Record<string, number[]> = {};
        let mesesComPagamento = 0;

        for (let month = 1; month <= 12; month += 1) {
          const lanc = await loadLancamento(prestador.id, year, month);
          if (!lanc || lanc.status !== 'pago') continue;

          const totalMes = round2(totalLancamento(lanc));
          monthTotals[month - 1] = totalMes;
          if (totalMes > 0) mesesComPagamento += 1;

          lanc.itens.forEach((item) => {
            const valorItem = item.valor || 0;
            verbaTotals[item.tipo] = round2(verbaTotals[item.tipo] + valorItem);
            verbaMonthTotals[item.tipo][month - 1] = round2(verbaMonthTotals[item.tipo][month - 1] + valorItem);

            if (item.tipo === 'variavel') {
              const key = item.descricao || 'Variável';
              if (!variavelItemTotals[key]) variavelItemTotals[key] = 0;
              if (!variavelItemMonthTotals[key]) variavelItemMonthTotals[key] = Array.from({ length: 12 }, () => 0);
              variavelItemTotals[key] = round2(variavelItemTotals[key] + valorItem);
              variavelItemMonthTotals[key][month - 1] = round2(variavelItemMonthTotals[key][month - 1] + valorItem);
            }
          });
        }

        const total = round2(monthTotals.reduce((sum, value) => sum + value, 0));

        return {
          id: prestador.id,
          nome: prestador.nome,
          categoria: prestador.cargo || 'Sem categoria',
          brand: prestador.brand,
          monthTotals,
          total,
          totalVw: prestador.brand === 'vw' ? total : 0,
          totalAudi: prestador.brand === 'audi' ? total : 0,
          mesesComPagamento,
          verbaTotals,
          verbaMonthTotals,
          variavelItemTotals,
          variavelItemMonthTotals,
        };
      }),
    );

    setRows(result.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    setLoadingResumo(false);
  }, [prestadores, year]);

  useEffect(() => {
    if (prestadores.length === 0) {
      setRows([]);
      return;
    }
    carregarResumo();
  }, [prestadores, carregarResumo]);

  const filteredRows = useMemo(
    () => rows.filter((row) => filterBrand === 'todos' || row.brand === filterBrand),
    [rows, filterBrand],
  );

  const totalVw = useMemo(() => round2(filteredRows.reduce((sum, row) => sum + row.totalVw, 0)), [filteredRows]);
  const totalAudi = useMemo(() => round2(filteredRows.reduce((sum, row) => sum + row.totalAudi, 0)), [filteredRows]);
  const totalGeral = round2(totalVw + totalAudi);

  const totalMeses = useMemo(() => {
    const totals = Array.from({ length: 12 }, () => 0);
    filteredRows.forEach((row) => {
      row.monthTotals.forEach((value, index) => {
        totals[index] = round2(totals[index] + value);
      });
    });
    return totals;
  }, [filteredRows]);

  const totalVerbas = useMemo(() => ({
    fixa: round2(filteredRows.reduce((sum, row) => sum + row.verbaTotals.fixa, 0)),
    variavel: round2(filteredRows.reduce((sum, row) => sum + row.verbaTotals.variavel, 0)),
    premio: round2(filteredRows.reduce((sum, row) => sum + row.verbaTotals.premio, 0)),
  }), [filteredRows]);

  const sortedVariavelItemsByRow = useMemo(() => {
    const map = new Map<string, string[]>();
    filteredRows.forEach((row) => {
      map.set(
        row.id,
        Object.entries(row.variavelItemTotals)
          .sort((a, b) => b[1] - a[1])
          .map(([descricao]) => descricao),
      );
    });
    return map;
  }, [filteredRows]);

  function toggleExpanded(rowId: string) {
    setExpandedRows((prev) => ({ ...prev, [rowId]: !prev[rowId] }));
  }

  function handleExportExcel() {
    if (filteredRows.length === 0) return;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);
    const merges: XLSX.Range[] = [];
    const currencyFormat = '"R$" #,##0.00';
    const headers = [
      'Prestador',
      'VW',
      'Audi',
      ...MONTHS_SHORT,
      'Total anual',
      'Meses pagos',
      'Fixa anual',
      'Variável anual',
      'Prêmio anual',
    ];
    const totalColumns = headers.length;
    let currentRow = 0;
    const titleStyle = {
      font: { bold: true, sz: 16, color: { rgb: '0F172A' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      fill: { fgColor: { rgb: 'E2E8F0' } },
    };
    const sectionStyle = {
      font: { bold: true, sz: 12, color: { rgb: '0F172A' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      fill: { fgColor: { rgb: 'F1F5F9' } },
    };
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: { fgColor: { rgb: '0F766E' } },
    };
    const detailHeaderStyle = {
      font: { bold: true, color: { rgb: '334155' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: { fgColor: { rgb: 'E2E8F0' } },
    };
    const leftCellStyle = {
      alignment: { horizontal: 'left', vertical: 'center' },
      font: { color: { rgb: '0F172A' } },
    };
    const centerCellStyle = {
      alignment: { horizontal: 'center', vertical: 'center' },
      font: { color: { rgb: '0F172A' } },
    };
    const totalStyle = {
      alignment: { horizontal: 'center', vertical: 'center' },
      font: { bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: 'F8FAFC' } },
    };
    const detailLabelStyle = {
      alignment: { horizontal: 'left', vertical: 'center' },
      font: { bold: true, color: { rgb: '334155' } },
    };
    const detailItemStyle = {
      alignment: { horizontal: 'left', vertical: 'center' },
      font: { color: { rgb: '475569' } },
    };

    const appendRow = (values: Array<string | number | null>) => {
      XLSX.utils.sheet_add_aoa(ws, [values], { origin: { r: currentRow, c: 0 } });
      currentRow += 1;
      return currentRow - 1;
    };

    const mergeRow = (rowIndex: number, startColumn: number, endColumn: number) => {
      merges.push({ s: { r: rowIndex, c: startColumn }, e: { r: rowIndex, c: endColumn } });
    };

    const formatCell = (rowIndex: number, columnIndex: number, format: string) => {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      if (ws[cellAddress]) ws[cellAddress].z = format;
    };

    const styleCell = (rowIndex: number, columnIndex: number, style: Record<string, unknown>) => {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = ws[cellAddress] as (XLSX.CellObject & { s?: Record<string, unknown> }) | undefined;
      if (cell) cell.s = style;
    };

    const styleRow = (rowIndex: number, startColumn: number, endColumn: number, style: Record<string, unknown>) => {
      for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
        styleCell(rowIndex, columnIndex, style);
      }
    };

    const formatCurrencyColumns = (rowIndex: number, columns: number[]) => {
      columns.forEach((columnIndex) => {
        formatCell(rowIndex, columnIndex, currencyFormat);
      });
    };

    const centerRow = (rowIndex: number) => {
      styleCell(rowIndex, 0, leftCellStyle);
      for (let columnIndex = 1; columnIndex < totalColumns; columnIndex += 1) {
        styleCell(rowIndex, columnIndex, centerCellStyle);
      }
    };

    const centerDetailRow = (rowIndex: number, lastColumn: number) => {
      styleCell(rowIndex, 0, leftCellStyle);
      for (let columnIndex = 1; columnIndex <= lastColumn; columnIndex += 1) {
        styleCell(rowIndex, columnIndex, centerCellStyle);
      }
    };

    const reportTitleRow = appendRow(['Remunerações PJ · Resumo']);
    mergeRow(reportTitleRow, 0, totalColumns - 1);
    styleCell(reportTitleRow, 0, titleStyle);

    const reportMetaRow = appendRow([
      `Ano ${year}`,
      `Filtro: ${filterBrand === 'todos' ? 'Todos' : filterBrand.toUpperCase()}`,
      `Prestadores: ${filteredRows.length}`,
    ]);
    styleRow(reportMetaRow, 0, 2, sectionStyle);
    appendRow([]);

    const tableHeaderRow = appendRow(headers);
    styleRow(tableHeaderRow, 0, totalColumns - 1, headerStyle);

    const moneyColumns = [1, 2, ...MONTHS_SHORT.map((_, index) => index + 3), 15, 17, 18, 19];

    filteredRows.forEach((row) => {
      const dataRow = appendRow([
        row.nome,
        row.totalVw,
        row.totalAudi,
        ...row.monthTotals,
        row.total,
        row.mesesComPagamento,
        row.verbaTotals.fixa,
        row.verbaTotals.variavel,
        row.verbaTotals.premio,
      ]);
      centerRow(dataRow);
      formatCurrencyColumns(dataRow, moneyColumns);

      const detailHeaderRow = appendRow(['Remuneração', ...MONTHS_SHORT, 'Total']);
      mergeRow(detailHeaderRow, 0, 2);
      styleRow(detailHeaderRow, 0, MONTHS_SHORT.length + 1, detailHeaderStyle);
      styleCell(detailHeaderRow, 0, { ...detailHeaderStyle, alignment: { horizontal: 'left', vertical: 'center' } });

      const fixaDetailRow = appendRow([
        'Fixa',
        ...row.verbaMonthTotals.fixa.map((value) => (value > 0 ? value : null)),
        row.verbaTotals.fixa,
      ]);
      centerDetailRow(fixaDetailRow, MONTHS_SHORT.length + 1);
      styleCell(fixaDetailRow, 0, detailLabelStyle);
      formatCurrencyColumns(fixaDetailRow, Array.from({ length: MONTHS_SHORT.length + 1 }, (_, index) => index + 1));

      (sortedVariavelItemsByRow.get(row.id) ?? []).forEach((descricao) => {
        const itemRow = appendRow([
          `    ${descricao}`,
          ...row.variavelItemMonthTotals[descricao].map((value) => (value > 0 ? value : null)),
          row.variavelItemTotals[descricao],
        ]);
        centerDetailRow(itemRow, MONTHS_SHORT.length + 1);
        styleCell(itemRow, 0, detailItemStyle);
        formatCurrencyColumns(itemRow, Array.from({ length: MONTHS_SHORT.length + 1 }, (_, index) => index + 1));
      });

      const premioDetailRow = appendRow([
        'Prêmio',
        ...row.verbaMonthTotals.premio.map((value) => (value > 0 ? value : null)),
        row.verbaTotals.premio,
      ]);
      centerDetailRow(premioDetailRow, MONTHS_SHORT.length + 1);
      styleCell(premioDetailRow, 0, detailLabelStyle);
      formatCurrencyColumns(premioDetailRow, Array.from({ length: MONTHS_SHORT.length + 1 }, (_, index) => index + 1));

      appendRow([]);
    });

    const totalRow = appendRow([
      'Totais',
      totalVw,
      totalAudi,
      ...totalMeses,
      totalGeral,
      '',
      totalVerbas.fixa,
      totalVerbas.variavel,
      totalVerbas.premio,
    ]);
    styleRow(totalRow, 0, totalColumns - 1, totalStyle);
    styleCell(totalRow, 0, sectionStyle);
    formatCurrencyColumns(totalRow, moneyColumns);

    ws['!cols'] = [
      { wch: 28 },
      { wch: 12 },
      { wch: 12 },
      ...MONTHS_SHORT.map(() => ({ wch: 11 })),
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];
    ws['!merges'] = merges;
    ws['!rows'] = Array.from({ length: currentRow }, (_, index) => ({ hpt: index === 0 ? 24 : 20 }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: tableHeaderRow, c: 0 }, e: { r: totalRow - 1, c: totalColumns - 1 } }) };

    XLSX.utils.book_append_sheet(wb, ws, 'Resumo');
    XLSX.writeFile(wb, `resumo-remuneracoes-pj-${year}.xlsx`);
  }

  function handlePrintPdf() {
    if (filteredRows.length === 0) return;
    setPrintingPdf(true);
    const rootId = 'print-root-resumo-pj';
    let root = document.getElementById(rootId);
    if (!root) {
      root = document.createElement('div');
      root.id = rootId;
      document.body.appendChild(root);
    }

    const fmt = (v: number) => fmtBRL(v);

    const cards = filteredRows.map((row) => {
      // Fixa row
      const fixaRow = `
        <tr>
          <td class="tipo">Fixa</td>
          ${row.verbaMonthTotals.fixa.map((value) => `<td>${value > 0 ? fmt(value) : '—'}</td>`).join('')}
          <td class="total">${fmt(row.verbaTotals.fixa)}</td>
        </tr>
      `;

      // Variável items rows
      const variavelItemsRows = (sortedVariavelItemsByRow.get(row.id) ?? [])
        .map((descricao) => `
          <tr>
            <td class="item">${descricao}</td>
            ${row.variavelItemMonthTotals[descricao].map((value) => `<td>${value > 0 ? fmt(value) : '—'}</td>`).join('')}
            <td class="total">${fmt(row.variavelItemTotals[descricao])}</td>
          </tr>
        `)
        .join('');

      // Prêmio row
      const premioRow = `
        <tr>
          <td class="tipo">Prêmio</td>
          ${row.verbaMonthTotals.premio.map((value) => `<td>${value > 0 ? fmt(value) : '—'}</td>`).join('')}
          <td class="total">${fmt(row.verbaTotals.premio)}</td>
        </tr>
      `;

      const colsTotalMes = row.monthTotals
        .map((value) => `<td>${value > 0 ? fmt(value) : '—'}</td>`)
        .join('');

      return `
        <section class="prestador-card">
          <header class="prestador-head">
            <div>
              <h2>${row.nome}</h2>
              <p>${row.brand.toUpperCase()} · ${row.categoria}</p>
            </div>
            <div class="meta">
              <div>Total anual: <strong>${fmt(row.total)}</strong></div>
              <div>Meses pagos: <strong>${row.mesesComPagamento}</strong></div>
            </div>
          </header>

          <table>
            <thead>
              <tr>
                <th>Remuneração</th>
                ${MONTHS_SHORT.map((m) => `<th>${m}</th>`).join('')}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="tipo">Total mensal</td>
                ${colsTotalMes}
                <td class="total">${fmt(row.total)}</td>
              </tr>
              ${fixaRow}
              ${variavelItemsRows}
              ${premioRow}
            </tbody>
          </table>
        </section>
      `;
    }).join('');

    root.innerHTML = `
      <div class="print-wrap">
        <header class="report-head">
          <h1>Remunerações PJ · Resumo</h1>
          <p>Ano ${year} · Filtro marca: ${filterBrand === 'todos' ? 'Todos' : filterBrand.toUpperCase()} · Prestadores: ${filteredRows.length}</p>
        </header>
        ${cards}
      </div>
    `;

    const style = document.createElement('style');
    style.id = 'resumo-pj-print-style';
    style.textContent = `
      @page { size: A4 landscape; margin: 8mm; }
      @media print {
        body > *:not(#${rootId}) { display: none !important; }
        #${rootId} { display: block !important; font-family: Inter, sans-serif; color: #0f172a; }
        #${rootId} .print-wrap { font-size: 11px; }
        #${rootId} .report-head { margin-bottom: 10px; }
        #${rootId} .report-head h1 { margin: 0; font-size: 18px; }
        #${rootId} .report-head p { margin: 2px 0 0; color: #475569; font-size: 11px; }
        #${rootId} .prestador-card {
          border: 1px solid #dbe3ee;
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 8px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        #${rootId} .prestador-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 6px;
        }
        #${rootId} .prestador-head h2 { margin: 0; font-size: 13px; }
        #${rootId} .prestador-head p { margin: 2px 0 0; font-size: 10px; color: #64748b; }
        #${rootId} .meta { text-align: right; font-size: 10px; color: #334155; }
        #${rootId} table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        #${rootId} th,
        #${rootId} td {
          border: 1px solid #e2e8f0;
          padding: 4px 5px;
          text-align: right;
          white-space: nowrap;
          font-size: 10px;
        }
        #${rootId} th:first-child,
        #${rootId} td:first-child { text-align: left; width: 90px; }
        #${rootId} .tipo { font-weight: 600; }
        #${rootId} .item { color: #334155; padding-left: 16px; }
        #${rootId} .total { font-weight: 700; }
      }
    `;
    document.head.appendChild(style);

    window.onafterprint = () => {
      const existing = document.getElementById('resumo-pj-print-style');
      if (existing) existing.remove();
      const printRoot = document.getElementById(rootId);
      if (printRoot) printRoot.innerHTML = '';
      setPrintingPdf(false);
      window.onafterprint = null;
    };

    window.print();
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="w-full max-w-none mx-auto px-4 py-6 lg:px-5 xl:px-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 flex-wrap print-hide">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ano</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="text-sm font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-white rounded-lg border border-slate-200 overflow-hidden">
            {(['todos', 'vw', 'audi'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setFilterBrand(b)}
                className={`px-4 py-2 text-xs font-semibold transition-colors ${
                  filterBrand === b ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {b === 'todos' ? 'Todos' : b === 'vw' ? 'VW' : 'Audi'}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <button
            onClick={handleExportExcel}
            disabled={filteredRows.length === 0 || loadingResumo}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Excel
          </button>

          <button
            onClick={handlePrintPdf}
            disabled={filteredRows.length === 0 || loadingResumo || printingPdf}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {printingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
            Imprimir PDF
          </button>
        </div>

        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">
            Ano {year} · {filteredRows.length} prestador{filteredRows.length !== 1 ? 'es' : ''}
          </span>
          <span className="text-sm font-bold text-slate-800 tabular-nums">Total anual: {fmtBRL(totalGeral)}</span>
        </div>

        <div ref={tableRef} className="relative bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden">
          {(loadingPrestadores || loadingResumo) && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
              <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
            </div>
          )}

          <div className="overflow-auto">
            <table className="min-w-[1440px] w-full text-[11px] xl:min-w-[1500px]">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="sticky left-0 z-[1] bg-slate-100 border-b border-r border-slate-300 px-2.5 py-2.5 text-left font-semibold">Prestador</th>
                  <th className="border-b border-r border-slate-300 px-2.5 py-2.5 text-center font-semibold">VW</th>
                  <th className="border-b border-r border-slate-300 px-2.5 py-2.5 text-center font-semibold">Audi</th>
                  {MONTHS_SHORT.map((month) => (
                    <th key={month} className="w-[72px] min-w-[72px] border-b border-r border-slate-300 px-2 py-2.5 text-center font-semibold last:border-r-0">
                      {month}
                    </th>
                  ))}
                  <th className="border-b border-r border-slate-300 px-2.5 py-2.5 text-center font-semibold">Total anual</th>
                  <th className="border-b border-r border-slate-300 px-2.5 py-2.5 text-center font-semibold">Meses pagos</th>
                  <th className="border-b border-r border-slate-300 px-2.5 py-2.5 text-center font-semibold">Fixa anual</th>
                  <th className="border-b border-r border-slate-300 px-2.5 py-2.5 text-center font-semibold">Variável anual</th>
                  <th className="border-b border-r border-slate-300 px-2.5 py-2.5 text-center font-semibold">Prêmio anual</th>
                  <th className="border-b border-slate-300 px-2.5 py-2.5 text-center font-semibold">Detalhe mensal</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.length === 0 && !loadingPrestadores && !loadingResumo ? (
                  <tr>
                    <td colSpan={21} className="px-4 py-10 text-center text-slate-400">
                      Nenhum prestador com pagamentos no filtro selecionado.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <Fragment key={row.id}>
                      <tr className="border-b border-slate-200 hover:bg-slate-50/80">
                        <td className="sticky left-0 bg-white border-r border-slate-200 px-2.5 py-2.5 shadow-[1px_0_0_0_theme(colors.slate.200)]">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                row.brand === 'vw'
                                  ? 'text-blue-700 bg-blue-50 border-blue-200'
                                  : 'text-red-700 bg-red-50 border-red-200'
                              }`}
                            >
                              {row.brand.toUpperCase()}
                            </span>
                            <span className="font-semibold text-slate-800 whitespace-nowrap">{row.nome}</span>
                          </div>
                        </td>
                        <td className="border-r border-slate-200 px-2.5 py-2.5 text-center tabular-nums">{fmtBRL(row.totalVw)}</td>
                        <td className="border-r border-slate-200 px-2.5 py-2.5 text-center tabular-nums">{fmtBRL(row.totalAudi)}</td>
                        {row.monthTotals.map((value, index) => (
                          <td key={`${row.id}-${index}`} className="w-[72px] min-w-[72px] border-r border-slate-200 px-2 py-2.5 text-center tabular-nums text-slate-700 last:border-r-0">
                            {value > 0 ? fmtBRL(value) : '—'}
                          </td>
                        ))}
                        <td className="border-r border-slate-200 px-2.5 py-2.5 text-center font-semibold tabular-nums text-slate-900">{fmtBRL(row.total)}</td>
                        <td className="border-r border-slate-200 px-2.5 py-2.5 text-center font-semibold text-slate-700">{row.mesesComPagamento}</td>
                        <td className="border-r border-slate-200 px-2.5 py-2.5 text-center tabular-nums text-slate-700">{fmtBRL(row.verbaTotals.fixa)}</td>
                        <td className="border-r border-slate-200 px-2.5 py-2.5 text-center tabular-nums text-slate-700">{fmtBRL(row.verbaTotals.variavel)}</td>
                        <td className="border-r border-slate-200 px-2.5 py-2.5 text-center tabular-nums text-slate-700">{fmtBRL(row.verbaTotals.premio)}</td>
                        <td className="px-2.5 py-2.5 text-center">
                          <button
                            onClick={() => toggleExpanded(row.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            {expandedRows[row.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {expandedRows[row.id] ? 'Ocultar' : 'Detalhar'}
                          </button>
                        </td>
                      </tr>

                      {expandedRows[row.id] && (
                        <tr key={`${row.id}-detail`} className="bg-slate-100/80 border-b-2 border-slate-300">
                          <td colSpan={21} className="px-3 py-3">
                            <div className="rounded-lg border border-slate-300 bg-white overflow-auto shadow-sm">
                              <table className="min-w-[920px] w-full text-[11px]">
                                <thead className="bg-slate-100 text-slate-700">
                                  <tr>
                                    <th className="border-b border-r border-slate-300 px-2.5 py-2.5 text-left font-semibold">Remuneração</th>
                                    {MONTHS_SHORT.map((month) => (
                                      <th key={`${row.id}-detail-head-${month}`} className="w-[72px] min-w-[72px] border-b border-r border-slate-300 px-2 py-2.5 text-center font-semibold last:border-r-0">
                                        {month}
                                      </th>
                                    ))}
                                    <th className="border-b border-slate-300 px-2.5 py-2.5 text-right font-semibold">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-t border-slate-200">
                                    <td className="border-r border-slate-200 px-2.5 py-2.5 font-semibold text-slate-700">Fixa</td>
                                    {row.verbaMonthTotals.fixa.map((value, index) => (
                                      <td key={`${row.id}-fixa-${index}`} className="w-[72px] min-w-[72px] border-r border-slate-200 px-2 py-2.5 text-center tabular-nums text-slate-700 last:border-r-0">
                                        {value > 0 ? fmtBRL(value) : '—'}
                                      </td>
                                    ))}
                                    <td className="px-2.5 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                                      {fmtBRL(row.verbaTotals.fixa)}
                                    </td>
                                  </tr>

                                  {(sortedVariavelItemsByRow.get(row.id) ?? []).map((descricao) => (
                                    <tr key={`${row.id}-var-${descricao}`} className="border-t border-slate-200 bg-slate-50/40">
                                      <td className="border-r border-slate-200 px-2.5 py-2.5 pl-5 text-slate-600 text-[10px]">{descricao}</td>
                                      {row.variavelItemMonthTotals[descricao].map((value, index) => (
                                        <td key={`${row.id}-${descricao}-${index}`} className="w-[72px] min-w-[72px] border-r border-slate-200 px-2 py-2.5 text-center tabular-nums text-slate-700 last:border-r-0">
                                          {value > 0 ? fmtBRL(value) : '—'}
                                        </td>
                                      ))}
                                      <td className="px-2.5 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                                        {fmtBRL(row.variavelItemTotals[descricao])}
                                      </td>
                                    </tr>
                                  ))}

                                  <tr className="border-t border-slate-200">
                                    <td className="border-r border-slate-200 px-2.5 py-2.5 font-semibold text-slate-700">Prêmio</td>
                                    {row.verbaMonthTotals.premio.map((value, index) => (
                                      <td key={`${row.id}-premio-${index}`} className="w-[72px] min-w-[72px] border-r border-slate-200 px-2 py-2.5 text-center tabular-nums text-slate-700 last:border-r-0">
                                        {value > 0 ? fmtBRL(value) : '—'}
                                      </td>
                                    ))}
                                    <td className="px-2.5 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                                      {fmtBRL(row.verbaTotals.premio)}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>

              <tfoot className="bg-slate-100 text-slate-800">
                <tr>
                  <td className="sticky left-0 bg-slate-100 border-t-2 border-r border-slate-300 px-2.5 py-2.5 font-bold">Totais</td>
                  <td className="border-t-2 border-r border-slate-300 px-2.5 py-2.5 text-center font-bold tabular-nums">{fmtBRL(totalVw)}</td>
                  <td className="border-t-2 border-r border-slate-300 px-2.5 py-2.5 text-center font-bold tabular-nums">{fmtBRL(totalAudi)}</td>
                  {totalMeses.map((value, index) => (
                    <td key={`total-${index}`} className="w-[72px] min-w-[72px] border-t-2 border-r border-slate-300 px-2 py-2.5 text-center font-bold tabular-nums last:border-r-0">
                      {fmtBRL(value)}
                    </td>
                  ))}
                  <td className="border-t-2 border-r border-slate-300 px-2.5 py-2.5 text-center font-bold tabular-nums">{fmtBRL(totalGeral)}</td>
                  <td className="border-t-2 border-r border-slate-300 px-2.5 py-2.5" />
                  <td className="border-t-2 border-r border-slate-300 px-2.5 py-2.5 text-center font-bold tabular-nums">{fmtBRL(totalVerbas.fixa)}</td>
                  <td className="border-t-2 border-r border-slate-300 px-2.5 py-2.5 text-center font-bold tabular-nums">{fmtBRL(totalVerbas.variavel)}</td>
                  <td className="border-t-2 border-r border-slate-300 px-2.5 py-2.5 text-center font-bold tabular-nums">{fmtBRL(totalVerbas.premio)}</td>
                  <td className="border-t-2 border-slate-300 px-2.5 py-2.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
