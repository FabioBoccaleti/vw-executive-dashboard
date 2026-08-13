import { type TipoClassificacao, TIPO_LABELS } from './despesasDeptoAudiStorage';

export const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const GRUPO_CONFIG: Record<TipoClassificacao, { color: string; light: string; badge: string }> = {
  pessoal:             { color: '#1e40af', light: '#eff6ff', badge: '#dbeafe' },
  servicos_terceiros:  { color: '#5b21b6', light: '#faf5ff', badge: '#ede9fe' },
  ocupacao:            { color: '#92400e', light: '#fffbeb', badge: '#fef3c7' },
  funcionamento:       { color: '#0f766e', light: '#f0fdfa', badge: '#ccfbf1' },
  vendas:              { color: '#c2410c', light: '#fff7ed', badge: '#ffedd5' },
  amort_deprec:        { color: '#334155', light: '#f8fafc', badge: '#e2e8f0' },
  financeiras:         { color: '#991b1b', light: '#fef2f2', badge: '#fee2e2' },
  outras_operacionais: { color: '#374151', light: '#fafafa', badge: '#f3f4f6' },
};

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  tipo: TipoClassificacao;
  rows: { conta: string; valor: number }[];
  monthMaps: Map<string, number>[];   // índice 0-11
  monthsWithData: number[];           // meses com dados importados (1-12)
}

export function YearModeGroupSection({ tipo, rows, monthMaps, monthsWithData }: Props) {
  const cfg = GRUPO_CONFIG[tipo];
  const grandTotal = rows.reduce((acc, r) => acc + r.valor, 0);

  const monthSubtotals = monthsWithData.map(m =>
    rows.reduce((acc, r) => acc + (monthMaps[m - 1].get(r.conta) ?? 0), 0)
  );

  return (
    <div
      className="bg-white rounded-xl overflow-hidden shadow-sm"
      style={{ border: `1px solid ${cfg.badge}`, borderLeft: `4px solid ${cfg.color}` }}
    >
      {/* Cabeçalho do grupo */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: cfg.light }}>
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
          <span className="text-sm font-bold" style={{ color: cfg.color }}>{TIPO_LABELS[tipo]}</span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: cfg.badge, color: cfg.color }}
          >
            {rows.length} conta{rows.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-sm font-bold tabular-nums" style={{ color: cfg.color }}>
          Total: R$&nbsp;{fmtBRL(grandTotal)}
        </span>
      </div>

      {/* Tabela com colunas por mês */}
      <div className="overflow-x-auto">
        <table className="table-fixed text-xs w-auto min-w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-2 font-semibold text-slate-500 w-64 sticky left-0 bg-slate-50 z-10">
                Conta / Descrição
              </th>
              {monthsWithData.map(m => (
                <th key={m} className="text-right px-3 py-2 font-semibold text-slate-500 w-24 whitespace-nowrap">
                  {MONTHS_SHORT[m - 1]}
                </th>
              ))}
              <th className="text-right px-4 py-2 font-bold text-slate-600 w-28 whitespace-nowrap bg-slate-100">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.conta}
                className={`border-b border-slate-50 transition-colors hover:bg-slate-50/50 ${
                  i % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'
                }`}
              >
                <td className="px-4 py-1.5 text-slate-700 font-medium sticky left-0 bg-inherit z-10 truncate" title={row.conta}>
                  {row.conta}
                </td>
                {monthsWithData.map(m => {
                  const val = monthMaps[m - 1].get(row.conta) ?? 0;
                  return (
                    <td
                      key={m}
                      className={`px-3 py-1.5 text-right font-mono tabular-nums ${
                        val === 0 ? 'text-slate-300' : val < 0 ? 'text-red-600' : 'text-slate-700'
                      }`}
                    >
                      {val === 0 ? '—' : fmtBRL(val)}
                    </td>
                  );
                })}
                <td className={`px-4 py-1.5 text-right font-mono tabular-nums font-bold bg-slate-50/60 ${
                  row.valor < 0 ? 'text-red-600' : 'text-slate-800'
                }`}>
                  {fmtBRL(row.valor)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: cfg.badge }}>
              <td
                className="px-4 py-2 text-xs font-bold sticky left-0 z-10"
                style={{ color: cfg.color, backgroundColor: cfg.badge }}
              >
                Subtotal — {TIPO_LABELS[tipo]}
              </td>
              {monthSubtotals.map((sub, idx) => (
                <td
                  key={monthsWithData[idx]}
                  className="px-3 py-2 text-right text-xs font-bold tabular-nums"
                  style={{ color: sub === 0 ? '#94a3b8' : cfg.color }}
                >
                  {sub === 0 ? '—' : fmtBRL(sub)}
                </td>
              ))}
              <td
                className="px-4 py-2 text-right text-xs font-bold tabular-nums"
                style={{ color: cfg.color }}
              >
                {fmtBRL(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
