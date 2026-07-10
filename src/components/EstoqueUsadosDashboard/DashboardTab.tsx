import * as XLSX from 'xlsx';
import { useRef, useState } from 'react';
import { kvBulkGet } from '@/lib/kvClient';
import {
  EstoqueUsadosEntry, EstoqueUsadosMeta,
  calcTotalVW, calcTotalAudi, formatDateBR, fmtBRL,
} from './estoqueUsadosStorage';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  entry: EstoqueUsadosEntry | null;
  meta: EstoqueUsadosMeta;
  historyDates: string[];
  onEditMeta: () => void;
  onZerar: () => void;
}

// ─── Sub-componente: Painel de Estoque ────────────────────────────────────────

function PainelEstoque({
  cor, titulo, total, meta, items, infoItems, nota, showMeta = true,
}: {
  cor: string;
  titulo: string;
  total: number;
  meta: number;
  items: { label: string; value: number }[];
  infoItems?: { label: string; value: number }[];
  nota?: string;
  showMeta?: boolean;
}) {
  const pct = meta > 0 ? Math.min(100, (total / meta) * 100) : 0;
  const acima = meta > 0 && total > meta;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* Cabeçalho do painel */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: cor }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cor }}>
              {titulo}
            </span>
          </div>
          <span className="text-base font-bold text-red-600">{fmtBRL(total)}</span>
        </div>
      </div>

      {/* Seção de Meta */}
      {showMeta && (
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
          <span className="font-bold">OBJETIVO — META DE ESTOQUE</span>
          <span className="font-bold text-slate-800">{fmtBRL(meta)}</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-slate-400 w-8 shrink-0">META</span>
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: acima ? '#ef4444' : (pct > 0 ? cor : 'transparent'),
              }}
            />
          </div>
        </div>
        {meta === 0 && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-blue-500">Defina uma meta para comparar</span>
            <span className="text-xs text-slate-300">—</span>
          </div>
        )}
        {meta > 0 && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-slate-400">
              {pct.toFixed(1)}% da meta atingida
            </span>
            {acima && <span className="text-xs text-red-500 font-medium">Acima da meta</span>}
          </div>
        )}
      </div>
      )}

      {/* Itens regulares */}
      <div className="px-5 divide-y divide-slate-100">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between py-2.5">
            <span className="text-xs text-[#001e50] pr-4">{item.label}</span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-slate-400">R$</span>
              <span
                className={`text-xs font-medium w-28 text-right tabular-nums ${
                  item.value === 0 ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                {fmtBRL(item.value)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Itens informativos — destaque âmbar com ícone de relógio */}
      {infoItems && infoItems.length > 0 && (
        <div className="mx-5 mb-3 mt-2 rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-amber-200 bg-amber-100/60">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
              Informativo
            </span>
          </div>
          {infoItems.map(item => (
            <div key={item.label} className="flex items-center justify-between px-3 py-2.5">
              <span className="text-xs text-amber-800 pr-4 italic">{item.label}</span>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-amber-400">R$</span>
                <span className={`text-xs font-semibold w-28 text-right tabular-nums ${
                  item.value === 0 ? 'text-amber-300' : 'text-amber-700'
                }`}>
                  {fmtBRL(item.value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nota informativa */}
      {nota && (
        <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-start gap-2">
          <span className="text-amber-500 text-xs mt-0.5">ⓘ</span>
          <span className="text-xs text-amber-700">{nota}</span>
        </div>
      )}
    </div>
  );
}

// ─── Export Excel ─────────────────────────────────────────────────────────────

function exportExcel(entry: EstoqueUsadosEntry, meta: EstoqueUsadosMeta) {
  const totalVW   = calcTotalVW(entry);
  const totalAudi = calcTotalAudi(entry);

  const rows: (string | number)[][] = [
    ['Posição de Valores em Estoque'],
    ['Data de Atualização:', formatDateBR(entry.date)],
    [],
    ['ESTOQUE VW / OUTROS', '', 'Valor (R$)'],
    ['Estoque de Veículos Usados VW Pagos', '', entry.vwUsadosPagos],
    ['Estoque de Veículos Novos VW Pagos', '', entry.vwNovosPagos],
    ['Valores em Cheque VW', '', entry.vwValoresCheque],
    ['Estoque Veículos Usados VW LM a Pagar', '', entry.vwUsadosLMaPagar],
    ['Veículos Usados Pendente de Entrada', '', entry.vwUsadosPendenteEntrada],
    ['TOTAL VW', '', totalVW],
    ['Meta VW', '', meta.metaVW],
    [],
    ['ESTOQUE AUDI / OUTROS', '', 'Valor (R$)'],
    ['Estoque de Veículos Usados Audi Pago', '', entry.audiUsadosPago],
    ['Estoque de Veículos Novos Audi Pagos', '', entry.audiNovosPagos],
    ['Veículos Usados Pendente de Entrada', '', entry.audiUsadosPendenteEntrada],
    ['TOTAL AUDI', '', totalAudi],
    ['Meta Audi', '', meta.metaAudi],
    [],
    ['ESTOQUE A PAGAR VW', '', 'Valor (R$)'],
    ['Estoque Veículos Usados VW LM Vendido a Pagar', '', entry.vwUsadosLMVendidoaPagar],
    ['[Informativo] Valores próximos do vencimento (em até 30 dias)', '', entry.vwVencimento30Dias ?? 0],
    ['(Não compõe total VW/Outros)'],
    [],
    ['ESTOQUE A PAGAR AUDI', '', 'Valor (R$)'],
    ['Estoque Veículos Usados Montadora a Pagar', '', entry.audiUsadosMontadoraaPagar],
    ['[Informativo] Valores próximos do vencimento (em até 30 dias)', '', entry.audiVencimento30Dias ?? 0],
    ['(Não compõe total Audi/Outros)'],
    [],
    ['NOVOS PRÓXIMO VENCIMENTO (180 dias) VW', '', 'Valor (R$)'],
    ['Estoque de Veículos Novos próximo do vencimento (180 dias)', '', entry.vwNovosProximoVencimento ?? 0],
    ['(Não compõe total VW/Outros)'],
    [],
    ['NOVOS PRÓXIMO VENCIMENTO (180 dias) AUDI', '', 'Valor (R$)'],
    ['Estoque de Veículos Novos próximo do vencimento (180 dias)', '', entry.audiNovosProximoVencimento ?? 0],
    ['(Não compõe total Audi/Outros)'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Estoque Usados');
  XLSX.writeFile(wb, `Estoque_Usados_${entry.date}.xlsx`);
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function DashboardTab({ entry, meta, historyDates, onEditMeta, onZerar }: Props) {
  const totalVW   = entry ? calcTotalVW(entry)   : 0;
  const totalAudi = entry ? calcTotalAudi(entry) : 0;
  const printRef  = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const handlePDF = async () => {
    const printSource = printRef.current;
    const root = document.getElementById('print-root');
    if (!printSource || !root) return;

    setPrinting(true);

    // ── Página 1: dashboard atual ─────────────────────────────────────────
    const clone = printSource.cloneNode(true) as HTMLElement;
    clone.style.display = 'block';
    let printHTML = clone.outerHTML;

    // ── Página 2: histórico (até 10 lançamentos) ──────────────────────────
    const recentDates = historyDates.slice(0, 10);
    if (recentDates.length > 0) {
      const keys = recentDates.map(d => `estoque_usados:entry:${d}`);
      let histEntries: EstoqueUsadosEntry[] = [];
      try {
        const map = await kvBulkGet<EstoqueUsadosEntry>(keys);
        histEntries = keys
          .map(k => map[k])
          .filter((e): e is EstoqueUsadosEntry => !!e)
          .sort((a, b) => b.date.localeCompare(a.date));
      } catch { /* silencia erro — página 2 não aparece */ }

      if (histEntries.length > 0) {
        const cols = [
          { label: 'Data',              fn: (e: EstoqueUsadosEntry) => formatDateBR(e.date) },
          { label: 'Total VW',          fn: (e: EstoqueUsadosEntry) => fmtBRL(calcTotalVW(e)) },
          { label: 'Total Audi',        fn: (e: EstoqueUsadosEntry) => fmtBRL(calcTotalAudi(e)) },
          { label: 'Total Geral',       fn: (e: EstoqueUsadosEntry) => fmtBRL(calcTotalVW(e) + calcTotalAudi(e)) },
          { label: 'A Pagar VW',        fn: (e: EstoqueUsadosEntry) => fmtBRL(e.vwUsadosLMVendidoaPagar ?? 0) },
          { label: 'A Pagar Audi',      fn: (e: EstoqueUsadosEntry) => fmtBRL(e.audiUsadosMontadoraaPagar ?? 0) },
          { label: 'Novos Venc. VW',    fn: (e: EstoqueUsadosEntry) => fmtBRL(e.vwNovosProximoVencimento ?? 0) },
          { label: 'Novos Venc. Audi',  fn: (e: EstoqueUsadosEntry) => fmtBRL(e.audiNovosProximoVencimento ?? 0) },
        ];

        const theadCells = cols.map(c => `<th>${c.label}</th>`).join('');
        const tbodyRows  = histEntries.map((e, i) => {
          const cells = cols.map((c, ci) =>
            `<td style="${ci === 0 ? 'font-weight:600' : ci === 3 ? 'font-weight:700' : ''}">${c.fn(e)}</td>`
          ).join('');
          return `<tr class="${i % 2 === 0 ? 'even' : ''}">${cells}</tr>`;
        }).join('');

        printHTML += `
          <div class="hist-page">
            <div class="hist-header">
              <div class="hist-title">Histórico</div>
              <div class="hist-subtitle">Últimos ${histEntries.length} lançamento${histEntries.length > 1 ? 's' : ''} registrado${histEntries.length > 1 ? 's' : ''}</div>
            </div>
            <table class="hist-table">
              <thead><tr>${theadCells}</tr></thead>
              <tbody>${tbodyRows}</tbody>
            </table>
          </div>`;
      }
    }

    root.innerHTML = printHTML;

    const style = document.createElement('style');
    style.id = '__estoque-print-override__';
    style.textContent = `
      @page { size: A4 landscape; margin: 0.5cm; }
      #print-root {
        font-family: Inter, system-ui, sans-serif;
        zoom: 0.82;
      }
      #print-root, #print-root * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
        color-scheme: light !important;
      }
      #print-root .overflow-auto,
      #print-root [class*="overflow-auto"],
      #print-root [class*="overflow-y"] {
        overflow: visible !important;
        max-height: none !important;
        height: auto !important;
      }
      #print-root .flex-1 { flex: none !important; height: auto !important; }
      #print-root .min-h-0 { min-height: 0 !important; }

      /* ── Página 2: Histórico ── */
      .hist-page {
        page-break-before: always;
        padding: 0;
        font-family: Inter, system-ui, sans-serif;
      }
      .hist-header {
        background: linear-gradient(135deg, #001e50 0%, #6b0018 100%);
        padding: 14px 20px;
        color: white;
        margin-bottom: 16px;
      }
      .hist-title {
        font-size: 20px;
        font-weight: 700;
      }
      .hist-subtitle {
        font-size: 10px;
        opacity: 0.7;
        margin-top: 2px;
      }
      .hist-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      .hist-table thead tr {
        background: #f1f5f9;
      }
      .hist-table th {
        padding: 8px 12px;
        text-align: center;
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #475569;
        border-bottom: 2px solid #e2e8f0;
      }
      .hist-table th:first-child { text-align: left; }
      .hist-table td {
        padding: 7px 12px;
        text-align: center;
        color: #334155;
        border-bottom: 1px solid #f1f5f9;
        font-variant-numeric: tabular-nums;
      }
      .hist-table td:first-child { text-align: left; }
      .hist-table tr.even td { background: #f8fafc; }
    `;
    document.head.appendChild(style);

    setPrinting(false);

    window.onafterprint = () => {
      document.head.querySelector('#__estoque-print-override__')?.remove();
      root.innerHTML = '';
      window.onafterprint = null;
    };

    window.print();
  };

  return (
    <div className="flex flex-col min-h-0">
      {/* Área capturável para PDF */}
      <div ref={printRef} id="estoque-dashboard-print">
      <div
        className="px-8 py-6 print:px-4 print:py-3"
        style={{ background: 'linear-gradient(135deg, #001e50 0%, #6b0018 100%)' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-blue-200/70 uppercase tracking-widest mb-1 font-medium">
              SORANA · CONTROLADORIA FINANCEIRA
            </p>
            <h1 className="text-2xl font-bold text-white mb-1">
              Posição de Valores em Estoque
            </h1>
            <p className="text-sm text-blue-100/70 max-w-lg">
              Acompanhamento de estoque VW e Audi, valores a pagar vinculados e comparação
              com a meta de cada marca.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0 ml-6">
            <span className="text-xs text-blue-200/70 uppercase tracking-wider font-medium">
              DATA DE ATUALIZAÇÃO
            </span>
            <div className="bg-white/10 border border-white/20 rounded-md px-4 py-1.5 text-white text-sm font-medium min-w-[120px] text-center">
              {entry ? formatDateBR(entry.date) : 'dd/mm/aaaa'}
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 bg-slate-100 p-6 overflow-auto">
        {!entry ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">Nenhum dado lançado ainda</p>
            <p className="text-sm text-slate-400">Acesse a aba "Lançar Dados" para registrar o primeiro lançamento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 max-w-5xl mx-auto">
            {/* ESTOQUE VW / OUTROS */}
            <PainelEstoque
              cor="#001e50"
              titulo="ESTOQUE VW / OUTROS"
              total={totalVW}
              meta={meta.metaVW}
              items={[
                { label: 'Estoque de Veículos Usados VW Pagos', value: entry.vwUsadosPagos },
                { label: 'Estoque de Veículos Novos VW Pagos', value: entry.vwNovosPagos },
                { label: 'Valores em Cheque VW', value: entry.vwValoresCheque },
                { label: 'Estoque Veículos Usados VW LM a Pagar', value: entry.vwUsadosLMaPagar },
                { label: 'Veículos Usados Pendente de Entrada', value: entry.vwUsadosPendenteEntrada },
              ]}
            />

            {/* ESTOQUE AUDI / OUTROS */}
            <PainelEstoque
              cor="#bb0a30"
              titulo="ESTOQUE AUDI / OUTROS"
              total={totalAudi}
              meta={meta.metaAudi}
              items={[
                { label: 'Estoque de Veículos Usados Audi Pago', value: entry.audiUsadosPago },
                { label: 'Estoque de Veículos Novos Audi Pagos', value: entry.audiNovosPagos },
                { label: 'Veículos Usados Pendente de Entrada', value: entry.audiUsadosPendenteEntrada },
              ]}
            />

            {/* ESTOQUE A PAGAR VW */}
            <PainelEstoque
              cor="#001e50"
              titulo="ESTOQUE A PAGAR VW"
              total={entry.vwUsadosLMVendidoaPagar}
              meta={0}
              showMeta={false}
              items={[
                { label: 'Estoque Veículos Usados VW LM Vendido a Pagar', value: entry.vwUsadosLMVendidoaPagar },
              ]}
              infoItems={[
                { label: 'Valores próximos do vencimento (em até 30 dias)', value: entry.vwVencimento30Dias ?? 0 },
              ]}
              nota="Este valor não compõe o total de Estoque VW / Outros."
            />

            {/* ESTOQUE A PAGAR AUDI */}
            <PainelEstoque
              cor="#bb0a30"
              titulo="ESTOQUE A PAGAR AUDI"
              total={entry.audiUsadosMontadoraaPagar}
              meta={0}
              showMeta={false}
              items={[
                { label: 'Estoque Veículos Usados Montadora a Pagar', value: entry.audiUsadosMontadoraaPagar },
              ]}
              infoItems={[
                { label: 'Valores próximos do vencimento (em até 30 dias)', value: entry.audiVencimento30Dias ?? 0 },
              ]}
              nota="Este valor não compõe o total de Estoque Audi / Outros."
            />

            {/* NOVOS PRÓX. VENCIMENTO VW */}
            <PainelEstoque
              cor="#001e50"
              titulo="NOVOS PRÓXIMO VENCIMENTO (180 DIAS) VW"
              total={entry.vwNovosProximoVencimento ?? 0}
              meta={0}
              showMeta={false}
              items={[
                { label: 'Estoque de Veículos Novos próximo do vencimento (180 dias)', value: entry.vwNovosProximoVencimento ?? 0 },
              ]}
              nota="Este valor não compõe o total de Estoque VW / Outros."
            />

            {/* NOVOS PRÓX. VENCIMENTO AUDI */}
            <PainelEstoque
              cor="#bb0a30"
              titulo="NOVOS PRÓXIMO VENCIMENTO (180 DIAS) AUDI"
              total={entry.audiNovosProximoVencimento ?? 0}
              meta={0}
              showMeta={false}
              items={[
                { label: 'Estoque de Veículos Novos próximo do vencimento (180 dias)', value: entry.audiNovosProximoVencimento ?? 0 },
              ]}
              nota="Este valor não compõe o total de Estoque Audi / Outros."
            />
          </div>
        )}
      </div>
      </div>{/* fim da área capturável */}

      {/* Footer com ações */}
      <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between print:hidden">
        <span className="text-xs text-slate-400">
          {entry
            ? `Última atualização: ${new Date(entry.updatedAt).toLocaleString('pt-BR')}`
            : 'Status: sem dados'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onEditMeta}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Configurar Meta
          </button>
          <button
            onClick={() => entry && exportExcel(entry, meta)}
            disabled={!entry}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Exportar para Excel
          </button>
          <button
            onClick={handlePDF}
            disabled={!entry || printing}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {printing ? 'Carregando...' : 'Imprimir / Salvar PDF'}
          </button>
          <button
            onClick={onZerar}
            disabled={!entry}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Zerar todos os valores
          </button>
        </div>
      </div>
    </div>
  );
}
