import { useState, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  loadVendasResultadoRows,
  type VendasResultadoRow,
} from '@/components/VendasBonificacoesDashboard/vendasResultadoStorage';
import { loadAliquotas } from '@/components/VendasBonificacoesDashboard/vendedoresRemuneracaoStorage';

// ─── Constantes ───────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'] as const;
const AVAILABLE_YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function n(v: string | undefined): number {
  return parseFloat(String(v ?? '').replace(',', '.')) || 0;
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

function calcImpostosUsados(valorVenda: number, valorCusto: number): number {
  const parte1 = valorVenda * 0.018;
  const base   = valorVenda - valorCusto - parte1;
  return parte1 + (base > 0 ? base * 0.0365 : 0);
}

function rowPeriod(r: VendasResultadoRow): { year: number; month: number } | null {
  if (r.periodoImport) {
    const [y, m] = r.periodoImport.split('-').map(Number);
    if (y > 2000 && m >= 1 && m <= 12) return { year: y, month: m };
  }
  const d = r.dataVenda;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return { year: parseInt(d.split('/')[2]), month: parseInt(d.split('/')[1]) };
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return { year: parseInt(d.split('-')[0]), month: parseInt(d.split('-')[1]) };
  return null;
}

function calcDerived(row: VendasResultadoRow, isUsados: boolean, aliquotaBonPct: number) {
  const valorVenda   = n(row.valorVenda);
  const valorCusto   = n(row.valorCusto);
  const bonusVarejo  = n(row.bonusVarejo);
  const bonusTradeIn = n(row.bonusTradeIn);

  const impostos = isUsados
    ? calcImpostosUsados(valorVenda, valorCusto)
    : n(row.impostos);

  const recLiq = valorVenda - impostos;

  const impBonus = isUsados
    ? bonusVarejo * (aliquotaBonPct / 100)
    : (bonusVarejo + bonusTradeIn) * (aliquotaBonPct / 100);

  const lucroBruto = isUsados
    ? recLiq - valorCusto + bonusVarejo - impBonus
    : recLiq - valorCusto + bonusVarejo + bonusTradeIn - impBonus;

  const lucroBrutoPct = recLiq !== 0 ? (lucroBruto / recLiq) * 100 : 0;

  return { impostos, recLiq, impBonus, lucroBruto, lucroBrutoPct };
}

// ─── Célula com cor para negativos ───────────────────────────────────────────
function NumCell({ value, pct = false }: { value: number; pct?: boolean }) {
  const text = pct ? fmtPct(value) : fmtBRL(value);
  const color = value < 0 ? 'text-red-600' : value === 0 ? 'text-slate-400' : 'text-slate-800';
  return <span className={`font-mono text-xs ${color}`}>{text}</span>;
}

// ─── Totais do rodapé ─────────────────────────────────────────────────────────
function sumRows(rows: VendasResultadoRow[], isUsados: boolean, aliquotaBonPct: number) {
  let totVenda = 0, totImpostos = 0, totRecLiq = 0, totCusto = 0;
  let totBonVarejo = 0, totBonTrade = 0, totImpBonus = 0, totLB = 0;

  for (const r of rows) {
    const d = calcDerived(r, isUsados, aliquotaBonPct);
    totVenda     += n(r.valorVenda);
    totImpostos  += d.impostos;
    totRecLiq    += d.recLiq;
    totCusto     += n(r.valorCusto);
    totBonVarejo += n(r.bonusVarejo);
    totBonTrade  += n(r.bonusTradeIn);
    totImpBonus  += d.impBonus;
    totLB        += d.lucroBruto;
  }

  const totLBPct = totRecLiq !== 0 ? (totLB / totRecLiq) * 100 : 0;
  return { totVenda, totImpostos, totRecLiq, totCusto, totBonVarejo, totBonTrade, totImpBonus, totLB, totLBPct };
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ComissoesVendasViewProps {
  tab: 'novos' | 'usados';
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function ComissoesVendasView({ tab }: ComissoesVendasViewProps) {
  const isUsados = tab === 'usados';

  const [filterYear, setFilterYear]   = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [rows, setRows]               = useState<VendasResultadoRow[]>([]);
  const [aliquotaBonPct, setAliquotaBonPct] = useState(0);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadVendasResultadoRows(tab), loadAliquotas()])
      .then(([vendasRows, aliquotas]) => {
        setRows(vendasRows);
        setAliquotaBonPct(aliquotas.reduce((acc, i) => acc + (parseFloat(i.aliquota) || 0), 0));
      })
      .finally(() => setLoading(false));
  }, [tab]);

  const filteredRows = useMemo(() =>
    rows.filter(r => {
      const p = rowPeriod(r);
      if (!p) return false;
      if (p.year !== filterYear) return false;
      if (filterMonth !== null && p.month !== filterMonth) return false;
      return true;
    }),
  [rows, filterYear, filterMonth]);

  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    rows.forEach(r => {
      const p = rowPeriod(r);
      if (!p || p.year !== filterYear) return;
      counts[p.month] = (counts[p.month] || 0) + 1;
    });
    return counts;
  }, [rows, filterYear]);

  const totals = useMemo(
    () => sumRows(filteredRows, isUsados, aliquotaBonPct),
    [filteredRows, isUsados, aliquotaBonPct],
  );

  // ─── Estilos de header por grupo ────────────────────────────────────────────
  const thId  = 'bg-slate-700 text-white px-3 py-2 text-xs font-semibold whitespace-nowrap border-r border-slate-600 text-left';
  const thFin = 'bg-emerald-700 text-white px-3 py-2 text-xs font-semibold whitespace-nowrap border-r border-emerald-600 text-right';
  const thLB  = 'bg-blue-700 text-white px-3 py-2 text-xs font-semibold whitespace-nowrap border-r border-blue-600 text-right';
  const thRes = 'bg-teal-700 text-white px-3 py-2 text-xs font-semibold whitespace-nowrap border-r border-teal-600 text-right';

  const tdBase = 'border-b border-slate-100 align-middle px-2 py-1.5';
  const tdL    = `${tdBase} text-left`;
  const tdR    = `${tdBase} text-right`;

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>

      {/* ── Seletor Ano / Mês ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 flex-shrink-0 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">ANO</span>
        <div className="relative mr-2">
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            className="appearance-none text-sm font-bold text-slate-700 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
          >
            {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="w-px h-5 bg-slate-200 mr-1" />
        <button
          onClick={() => setFilterMonth(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterMonth === null ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
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
              onClick={() => setFilterMonth(m)}
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

      {/* ── Tabela ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Carregando...</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                {/* Identificação */}
                <th className={thId}>Chassi</th>
                <th className={thId}>Modelo</th>
                <th className={thId}>NF Venda</th>
                <th className={thId}>Data da Venda</th>
                <th className={thId}>Vendedor</th>
                <th className={thId}>Transação</th>
                {/* Financeiro */}
                <th className={thFin}>Valor Venda</th>
                <th className={thFin}>Impostos</th>
                <th className={thFin}>Rec. Líquida</th>
                {/* Lucro Bruto */}
                <th className={thLB}>Valor Custo</th>
                <th className={thLB}>Bônus Varejo</th>
                <th className={thLB}>Bônus Trade IN</th>
                <th className={thLB}>(-) Imp. s/ Bônus</th>
                {/* Resultado */}
                <th className={thRes}>Lucro Bruto</th>
                <th className={thRes}>% LB</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={15} className="text-center py-16 text-slate-400 text-sm">
                    Nenhum registro encontrado para o período selecionado
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, ri) => {
                  const d   = calcDerived(row, isUsados, aliquotaBonPct);
                  const bg  = ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
                  const tdd = `${tdL} ${bg}`;
                  const tdr = `${tdR} ${bg}`;

                  return (
                    <tr key={row.id} className={`${bg} hover:bg-emerald-50/40 transition-colors`}>
                      <td className={tdd}>{row.chassi || '—'}</td>
                      <td className={tdd}>{row.modelo || '—'}</td>
                      <td className={tdd}>{row.nfVenda || '—'}</td>
                      <td className={tdd}>{row.dataVenda || '—'}</td>
                      <td className={tdd}>{row.vendedor || '—'}</td>
                      <td className={tdd}>{row.transacao || '—'}</td>
                      <td className={tdr}><NumCell value={n(row.valorVenda)} /></td>
                      <td className={tdr}><NumCell value={d.impostos} /></td>
                      <td className={tdr}><NumCell value={d.recLiq} /></td>
                      <td className={tdr}><NumCell value={n(row.valorCusto)} /></td>
                      <td className={tdr}><NumCell value={n(row.bonusVarejo)} /></td>
                      <td className={tdr}><NumCell value={n(row.bonusTradeIn)} /></td>
                      <td className={tdr}><NumCell value={d.impBonus} /></td>
                      <td className={tdr}><NumCell value={d.lucroBruto} /></td>
                      <td className={tdr}><NumCell value={d.lucroBrutoPct} pct /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* ── Rodapé de totais ─────────────────────────────────────────── */}
            {filteredRows.length > 0 && (
              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-slate-800 text-white font-semibold text-xs">
                  <td colSpan={6} className="px-3 py-2 text-right border-r border-slate-700">
                    Total ({filteredRows.length} reg.)
                  </td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(totals.totVenda)}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(totals.totImpostos)}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(totals.totRecLiq)}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(totals.totCusto)}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(totals.totBonVarejo)}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(totals.totBonTrade)}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(totals.totImpBonus)}</td>
                  <td className={`px-2 py-2 text-right font-mono ${totals.totLB < 0 ? 'text-red-300' : ''}`}>
                    {fmtBRL(totals.totLB)}
                  </td>
                  <td className={`px-2 py-2 text-right font-mono ${totals.totLBPct < 0 ? 'text-red-300' : ''}`}>
                    {fmtPct(totals.totLBPct)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
