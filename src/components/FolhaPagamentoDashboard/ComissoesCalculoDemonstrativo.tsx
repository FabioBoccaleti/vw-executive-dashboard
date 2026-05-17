import { useMemo } from 'react';
import { ArrowLeft, Clock } from 'lucide-react';
import type { VendasResultadoRow } from '@/components/VendasBonificacoesDashboard/vendasResultadoStorage';
import type { RemuneracaoData } from '@/components/VendasBonificacoesDashboard/vendedoresRemuneracaoStorage';

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
function fmtPercent(val: string): string {
  const num = parseFloat(val.replace(',', '.'));
  if (isNaN(num)) return '—';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + '%';
}
function calcImpostosUsados(valorVenda: number, valorCusto: number): number {
  const p1 = valorVenda * 0.018;
  const base = valorVenda - valorCusto - p1;
  return p1 + (base > 0 ? base * 0.0365 : 0);
}
function calcDerived(row: VendasResultadoRow) {
  const valorVenda    = n(row.valorVenda);
  const valorCusto    = n(row.valorCusto);
  const bonus         = n(row.bonusVarejo) + n(row.bonusTradeIn);
  const lucroBruto    = valorVenda - valorCusto + bonus;
  const lucroBrutoPct = valorVenda !== 0 ? (lucroBruto / valorVenda) * 100 : 0;
  const comVenda      = 0; // a calcular futuramente
  const comLB         = 0; // a calcular futuramente
  const total         = comVenda + comLB;
  return { bonus, lucroBruto, lucroBrutoPct, comVenda, comLB, total };
}

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// ─── NumCell ──────────────────────────────────────────────────────────────────
function NumCell({ value, pct = false }: { value: number; pct?: boolean }) {
  const text  = pct ? fmtPct(value) : fmtBRL(value);
  const color = value < 0 ? 'text-red-600' : value === 0 ? 'text-slate-400' : 'text-slate-800';
  return <span className={`font-mono text-xs ${color}`}>{text}</span>;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  vendedor:       string;
  rows:           VendasResultadoRow[];
  tab:            'novos' | 'usados';
  remuneracao:    RemuneracaoData;
  aliquotaBonPct: number;
  periodoLabel:   string;
  year:           number;
  month:          number;
  onBack:         () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function ComissoesCalculoDemonstrativo({
  vendedor, rows, tab, remuneracao, aliquotaBonPct, periodoLabel, year, month, onBack,
}: Props) {
  const isUsados  = tab === 'usados';
  const tabLabel  = isUsados ? 'Veículos Usados' : 'Veículos Novos';
  const modal     = remuneracao[tab];
  const competencia = `${MONTH_NAMES[month - 1]} de ${year}`;

  // Valores calculados por linha
  const derivedRows = useMemo(() =>
    rows.map(r => ({ ...r, _d: calcDerived(r) })),
  [rows]);

  // Totais
  const totals = useMemo(() => {
    let totVenda = 0, totCusto = 0, totBonus = 0, totLB = 0, totTotal = 0;
    for (const r of derivedRows) {
      totVenda  += n(r.valorVenda);
      totCusto  += n(r.valorCusto);
      totBonus  += r._d.bonus;
      totLB     += r._d.lucroBruto;
      totTotal  += r._d.total;
    }
    const totLBPct = totVenda !== 0 ? (totLB / totVenda) * 100 : 0;
    return { totVenda, totCusto, totBonus, totLB, totLBPct, totTotal };
  }, [derivedRows]);

  // ── Estilos de header ────────────────────────────────────────────────────
  const thId   = 'bg-slate-700 text-white px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-r border-slate-600 text-left sticky top-0';
  const thFin  = 'bg-emerald-700 text-white px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-r border-emerald-600 text-right sticky top-0';
  const thLB   = 'bg-teal-700 text-white px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-r border-teal-600 text-right sticky top-0';
  const thComm = 'bg-violet-700 text-white px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-r border-violet-600 text-right sticky top-0';
  const tdBase = 'border-b border-slate-100 align-middle px-2 py-1.5 text-xs';

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>

      {/* ── Botão Voltar ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar à lista
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-4">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="bg-slate-800 text-white rounded-xl overflow-hidden">
            <div className="px-6 py-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  Demonstrativo de Comissão de Vendas
                </p>
                <h2 className="text-xl font-bold leading-tight">{vendedor}</h2>
                <p className="text-sm text-slate-300 mt-1">{tabLabel}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  Competência
                </p>
                <p className="text-lg font-bold">{competencia}</p>
                <p className="text-xs text-slate-400 mt-1">Período: {periodoLabel}</p>
              </div>
            </div>
          </div>

          {/* ── Status + Pills de taxas ─────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" />
              Pendente
            </span>
            <div className="w-px h-4 bg-slate-200" />
            {modal.comissaoVenda && (
              <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                % Com. s/ Venda: <strong>{fmtPercent(modal.comissaoVenda)}</strong>
              </span>
            )}
            {modal.comissaoLucroBruto && (
              <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                % Com. s/ LB: <strong>{fmtPercent(modal.comissaoLucroBruto)}</strong>
              </span>
            )}
            <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
              {rows.length} {rows.length === 1 ? 'venda' : 'vendas'} no período
            </span>
          </div>

          {/* ── Tabela ──────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {/* Identificação */}
                    <th className={thId}>Chassi</th>
                    <th className={thId}>Modelo</th>
                    <th className={thId}>NF Venda</th>
                    <th className={thId}>Data Venda</th>
                    <th className={thId}>Transação</th>
                    {/* Financeiro */}
                    <th className={thFin}>Valor Venda</th>
                    <th className={thFin}>Valor Custo</th>
                    <th className={thFin}>Bônus</th>
                    {/* LB */}
                    <th className={thLB}>Lucro Bruto</th>
                    <th className={thLB}>% LB</th>
                    {/* Comissão */}
                    <th className={thComm}>Com. s/ Venda</th>
                    <th className={thComm}>Com. s/ LB</th>
                    <th className={thComm}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {derivedRows.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-slate-400 text-sm">
                        Nenhuma venda encontrada no período.
                      </td>
                    </tr>
                  ) : derivedRows.map((r, ri) => {
                    const bg = ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
                    return (
                      <tr key={r.id} className={bg}>
                        <td className={`${tdBase} ${bg} text-left font-mono text-slate-700`}>{r.chassi || '—'}</td>
                        <td className={`${tdBase} ${bg} text-left text-slate-700`}>{r.modelo || '—'}</td>
                        <td className={`${tdBase} ${bg} text-left font-mono text-slate-700`}>{r.nfVenda || '—'}</td>
                        <td className={`${tdBase} ${bg} text-left font-mono text-slate-700`}>{r.dataVenda || '—'}</td>
                        <td className={`${tdBase} ${bg} text-left text-slate-700`}>{r.transacao || '—'}</td>
                        <td className={`${tdBase} ${bg} text-right`}><NumCell value={n(r.valorVenda)} /></td>
                        <td className={`${tdBase} ${bg} text-right`}><NumCell value={n(r.valorCusto)} /></td>
                        <td className={`${tdBase} ${bg} text-right`}><NumCell value={r._d.bonus} /></td>
                        <td className={`${tdBase} ${bg} text-right`}><NumCell value={r._d.lucroBruto} /></td>
                        <td className={`${tdBase} ${bg} text-right`}><NumCell value={r._d.lucroBrutoPct} pct /></td>
                        {/* Comissão */}
                        <td className={`${tdBase} ${bg} text-right text-slate-300`}>—</td>
                        <td className={`${tdBase} ${bg} text-right text-slate-300`}>—</td>
                        <td className={`${tdBase} ${bg} text-right`}>
                          {r._d.total === 0
                            ? <span className="text-slate-300">—</span>
                            : <NumCell value={r._d.total} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {derivedRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-800 text-white font-semibold text-xs">
                      <td colSpan={5} className="px-3 py-2.5 text-right border-r border-slate-700">
                        Total ({rows.length} {rows.length === 1 ? 'venda' : 'vendas'})
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono">{fmtBRL(totals.totVenda)}</td>
                      <td className="px-2 py-2.5 text-right font-mono">{fmtBRL(totals.totCusto)}</td>
                      <td className="px-2 py-2.5 text-right font-mono">{fmtBRL(totals.totBonus)}</td>
                      <td className={`px-2 py-2.5 text-right font-mono ${totals.totLB < 0 ? 'text-red-300' : ''}`}>
                        {fmtBRL(totals.totLB)}
                      </td>
                      <td className={`px-2 py-2.5 text-right font-mono ${totals.totLBPct < 0 ? 'text-red-300' : ''}`}>
                        {fmtPct(totals.totLBPct)}
                      </td>
                      <td className="px-2 py-2.5 text-right text-slate-400">—</td>
                      <td className="px-2 py-2.5 text-right text-slate-400">—</td>
                      <td className={`px-2 py-2.5 text-right font-mono ${totals.totTotal < 0 ? 'text-red-300' : ''}`}>
                        {totals.totTotal === 0 ? '—' : fmtBRL(totals.totTotal)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
