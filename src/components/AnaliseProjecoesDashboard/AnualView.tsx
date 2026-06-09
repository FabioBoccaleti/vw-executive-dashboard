import { useState, useMemo } from 'react';
import { AlertTriangle, BarChart2, X, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  type BudgetVwRow,
  type BudgetAudiRow,
  type DeptBudget,
} from './projecoesStorage';
import type { DreVwRow } from '../ResumoDREDashboard/dreVwStorage';
import type { DreAudiRow } from '../ResumoDREDashboard/dreAudiStorage';
import {
  DRE_LINES,
  sumDreVwField,
  sumDreAudiField,
  sumBudgetVwFieldAcc,
  sumBudgetAudiFieldAcc,
  type CompType,
  type MarcaType,
} from './ComparativoTab';
import { exportStyledExcelTable } from './excelUtils';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ShowMode = 'budget' | 'real' | 'varpct';

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export interface AnualViewProps {
  compType:           CompType;
  marca:              MarcaType;
  budgetVwMonths:     (BudgetVwRow | null)[];
  budgetAudiMonths:   (BudgetAudiRow | null)[];
  real2025VwMonths:   (DreVwRow | null)[];
  real2025AudiMonths: (DreAudiRow | null)[];
  real2026VwMonths:   (DreVwRow | null)[];
  real2026AudiMonths: (DreAudiRow | null)[];
  deptView:           string;
  threshold:          number;
  hideZeros:          boolean;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function AnualView({
  compType, marca,
  budgetVwMonths, budgetAudiMonths,
  real2025VwMonths, real2025AudiMonths,
  real2026VwMonths, real2026AudiMonths,
  deptView, threshold, hideZeros,
}: AnualViewProps) {
  const [showMode, setShowMode] = useState<ShowMode>('varpct');
  const [selectedLine, setSelectedLine] = useState<keyof DeptBudget | null>(null);

  const dept     = deptView;
  const audiDept = dept === 'direta' ? 'all' : dept;
  const realYear = compType === 'real2025_vs_budget2026' ? '2025' : '2026';
  const marcaColor = marca === 'vw' ? '#001e50' : marca === 'audi' ? '#bb0a30' : '#4c1d95';

  // ── Helpers de valor ────────────────────────────────────────────────────────

  function fmtNum(n: number): string {
    if (n === 0) return '—';
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  }

  function getB(mi: number, field: keyof DeptBudget): number {
    if (marca === 'vw')   return sumBudgetVwFieldAcc(budgetVwMonths, [mi], field, dept);
    if (marca === 'audi') return sumBudgetAudiFieldAcc(budgetAudiMonths, [mi], field, audiDept);
    return sumBudgetVwFieldAcc(budgetVwMonths, [mi], field, dept)
         + sumBudgetAudiFieldAcc(budgetAudiMonths, [mi], field, audiDept);
  }

  function getR(mi: number, field: keyof DeptBudget): number {
    const realVw   = compType === 'real2025_vs_budget2026' ? real2025VwMonths   : real2026VwMonths;
    const realAudi = compType === 'real2025_vs_budget2026' ? real2025AudiMonths : real2026AudiMonths;
    if (marca === 'vw')   return sumDreVwField(realVw, [mi], field, dept);
    if (marca === 'audi') return sumDreAudiField(realAudi, [mi], field, audiDept);
    return sumDreVwField(realVw, [mi], field, dept)
         + sumDreAudiField(realAudi, [mi], field, audiDept);
  }

  function varPctOf(b: number, r: number): number {
    return r !== 0 ? ((b - r) / Math.abs(r)) * 100 : (b !== 0 ? 100 : 0);
  }

  function heatClass(vp: number, isNeg: boolean): string {
    const abs = Math.abs(vp);
    if (abs < 1) return '';
    const good = isNeg ? vp < 0 : vp > 0;
    if (good) return abs > 25 ? 'bg-green-100' : abs > 10 ? 'bg-green-50' : '';
    return abs > 25 ? 'bg-red-100' : abs > 10 ? 'bg-red-50' : '';
  }

  // ── Chart data ──────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    if (!selectedLine) return [];
    return Array.from({ length: 12 }, (_, mi) => ({
      name:   MONTHS_SHORT[mi],
      Budget: getB(mi, selectedLine),
      Real:   getR(mi, selectedLine),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLine, marca, deptView, compType,
      budgetVwMonths, budgetAudiMonths,
      real2025VwMonths, real2025AudiMonths,
      real2026VwMonths, real2026AudiMonths]);

  const handleExportExcel = async () => {
    const marcaLabel = marca === 'vw' ? 'VW Norte' : marca === 'audi' ? 'Audi' : 'Consolidado';
    const modeLabel = showMode === 'budget' ? 'Budget 2026' : showMode === 'real' ? `Real ${realYear}` : 'Var %';
    const rows = DRE_LINES.map(line => {
      if (line.separator) {
        return { values: Array(14).fill(''), separator: true as const };
      }

      const cells = Array.from({ length: 12 }, (_, mi) => {
        const b = getB(mi, line.field);
        const r = getR(mi, line.field);
        const vp = varPctOf(b, r);
        return { b, r, vp };
      });

      if (hideZeros && cells.every(c => c.b === 0 && c.r === 0)) return null;

      const totalB  = cells.reduce((s, c) => s + c.b, 0);
      const totalR  = cells.reduce((s, c) => s + c.r, 0);
      const totalVp = varPctOf(totalB, totalR);
      const fmtNum = (n: number) => (n === 0 ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 0 }));
      const fmtPct = (n: number) => (n === 0 || !isFinite(n) ? '—' : `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
      const fmtSignedPct = (n: number) => (n === 0 || !isFinite(n) ? '—' : `${n > 0 ? '+' : ''}${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);

      if (line.isPct) {
        const monthValues = cells.map(({ b, r }) => {
          if (showMode === 'budget') {
            const rolB = getB(0, 'receitaOperacionalLiquida') || 1;
            return fmtPct((b / rolB) * 100);
          }
          if (showMode === 'real') {
            const rolR = getR(0, 'receitaOperacionalLiquida') || 1;
            return fmtPct((r / rolR) * 100);
          }
          return '—';
        });

        return {
          values: [line.label, ...monthValues, '—'],
          isPct: true,
          indent: !!line.indent,
          isBold: !!line.isBold,
          isSubtotal: !!line.isSubtotal,
          isTotal: !!line.isTotal,
        };
      }

      const monthValues = cells.map(({ b, r, vp }) => {
        if (showMode === 'budget') return fmtNum(b);
        if (showMode === 'real') return fmtNum(r);
        return fmtSignedPct(vp);
      });

      const totalDisplay = showMode === 'budget'
        ? fmtNum(totalB)
        : showMode === 'real'
          ? fmtNum(totalR)
          : fmtSignedPct(totalVp);

      return {
        values: [line.label, ...monthValues, totalDisplay],
        indent: !!line.indent,
        isBold: !!line.isBold,
        isSubtotal: !!line.isSubtotal,
        isTotal: !!line.isTotal,
      };
    }).filter(Boolean) as NonNullable<ReturnType<typeof DRE_LINES.map>> extends Array<infer T> ? Exclude<T, null> : never[];

    await exportStyledExcelTable({
      fileName: `Analise_Projecoes_Anual_${marcaLabel.replace(/\s+/g, '_')}.xlsx`,
      sheetName: 'Visao Anual',
      title: 'Análise de Projeções',
      subtitle: `Visão Anual — ${modeLabel}`,
      meta: `Marca: ${marcaLabel} | Depto: ${deptView}${threshold > 0 ? ` | Alerta ≥ ${threshold}%` : ''}`,
      headers: ['Descrição', ...MONTHS_SHORT, 'Total'],
      rows,
      columnWidths: [38, ...Array(12).fill(12), 14],
      accentColor: marca === 'vw' ? '#001e50' : marca === 'audi' ? '#bb0a30' : '#4c1d95',
    });
    toast.success('Planilha Excel exportada');
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Sub-toolbar */}
      <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] text-slate-400 uppercase font-medium">Exibir:</span>
        {([
          { v: 'budget' as ShowMode, label: 'Budget 2026' },
          { v: 'real'   as ShowMode, label: `Real ${realYear}` },
          { v: 'varpct' as ShowMode, label: 'Var %' },
        ]).map(m => (
          <button
            key={m.v}
            onClick={() => setShowMode(m.v)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              showMode === m.v
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            {m.label}
          </button>
        ))}
        <button
          onClick={handleExportExcel}
          className="no-print ml-auto flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          title="Exportar a visão anual atual para Excel"
        >
          <Download className="w-3.5 h-3.5" />
          Excel
        </button>
        {showMode === 'varpct' && (
          <span className="text-[10px] text-slate-400 ml-1">
            Verde = favorável · Vermelho = desfavorável
          </span>
        )}
      </div>

      {/* Chart panel */}
      {selectedLine && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <BarChart2 size={13} className="text-orange-500" />
              {DRE_LINES.find(l => l.field === selectedLine && !l.isPct && !l.separator)?.label ?? String(selectedLine)}
              {' — Budget vs Real, 12 meses'}
            </h3>
            <button onClick={() => setSelectedLine(null)} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis
                  tick={{ fontSize: 9 }}
                  width={60}
                  tickFormatter={(v: number) =>
                    Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M`
                      : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(0)}k`
                      : String(v)
                  }
                />
                <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Budget" fill="#f97316" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Real" fill="#64748b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: 1100 }}>
          <thead>
            <tr style={{ backgroundColor: marcaColor }} className="text-white">
              <th
                className="text-left py-2 px-3 font-semibold w-52 sticky left-0 z-10"
                style={{ backgroundColor: marcaColor }}
              >
                Descrição
              </th>
              {MONTHS_SHORT.map(m => (
                <th key={m} className="text-right py-2 px-2 font-semibold" style={{ minWidth: 72 }}>
                  {m}
                </th>
              ))}
              <th className="text-right py-2 px-3 font-semibold" style={{ minWidth: 80 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {DRE_LINES.map((line, idx) => {
              if (line.separator) {
                return <tr key={idx}><td colSpan={14} className="h-px bg-slate-200" /></tr>;
              }

              if (line.isPct) {
                return (
                  <tr key={idx} className="bg-slate-50 border-b border-slate-100">
                    <td className="py-0.5 px-3 text-slate-400 italic text-[10px] sticky left-0 bg-slate-50 pl-6">
                      {line.label}
                    </td>
                    {Array.from({ length: 12 }, (_, mi) => {
                      const rol = showMode === 'budget'
                        ? getB(mi, 'receitaOperacionalLiquida')
                        : getR(mi, 'receitaOperacionalLiquida');
                      const val = showMode === 'budget'
                        ? getB(mi, line.field)
                        : showMode === 'real' ? getR(mi, line.field) : 0;
                      const pct = rol !== 0 ? (val / rol) * 100 : 0;
                      return (
                        <td key={mi} className="text-right py-0.5 px-2 text-slate-500 tabular-nums">
                          {showMode === 'varpct' || pct === 0 ? '—' : `${pct.toFixed(1)}%`}
                        </td>
                      );
                    })}
                    <td className="text-right py-0.5 px-3 text-slate-400">—</td>
                  </tr>
                );
              }

              // Regular rows
              const cells = Array.from({ length: 12 }, (_, mi) => {
                const b = getB(mi, line.field);
                const r = getR(mi, line.field);
                const vp = varPctOf(b, r);
                const display = showMode === 'budget' ? b : showMode === 'real' ? r : vp;
                return { b, r, vp, display };
              });

              if (hideZeros && cells.every(c => c.b === 0 && c.r === 0)) return null;

              // Total column
              const totalB  = cells.reduce((s, c) => s + c.b, 0);
              const totalR  = cells.reduce((s, c) => s + c.r, 0);
              const totalVp = varPctOf(totalB, totalR);
              const totalDisplay = showMode === 'budget' ? totalB : showMode === 'real' ? totalR : totalVp;

              // Row styling
              let rowClass  = 'border-b border-slate-100 hover:bg-slate-50/80 transition-colors';
              let cellClass = 'py-1 px-2';
              let labelClass = 'text-slate-700 cursor-pointer hover:text-orange-600';
              let bgStyle: React.CSSProperties = {};

              if (line.isTotal) {
                bgStyle    = { backgroundColor: marcaColor };
                rowClass   = 'border-b border-slate-300';
                cellClass  = 'py-1.5 px-2';
                labelClass = 'font-bold text-white uppercase text-[11px]';
              } else if (line.isSubtotal) {
                rowClass   = 'border-b-2 border-slate-300 bg-slate-50';
                labelClass = 'font-semibold text-slate-800 cursor-pointer hover:text-orange-600';
              } else if (line.isBold) {
                labelClass = 'font-semibold text-slate-800 cursor-pointer hover:text-orange-600';
              } else if (line.indent) {
                labelClass = 'text-slate-600 pl-5 cursor-pointer hover:text-orange-600';
              }

              const isSelected = selectedLine === line.field && !line.isTotal;
              const textTotal  = line.isTotal ? 'text-white' : '';
              const numStyle: React.CSSProperties = line.isTotal ? { color: '#fff' } : {};

              return (
                <tr
                  key={idx}
                  className={`${rowClass}${isSelected ? ' bg-orange-50/60' : ''}`}
                  style={bgStyle}
                >
                  <td
                    className={`${cellClass} ${labelClass} sticky left-0 z-10`}
                    style={bgStyle}
                    onClick={() => !line.isTotal && setSelectedLine(prev => prev === line.field ? null : line.field)}
                  >
                    {line.indent && <span className="mr-1 text-slate-400">·</span>}
                    {line.label}
                  </td>

                  {cells.map(({ b, r, vp, display }, mi) => {
                    const bg       = showMode === 'varpct' ? heatClass(vp, !!line.isNegative) : '';
                    const hasAlert = showMode === 'varpct' && (b !== 0 || r !== 0) && Math.abs(vp) >= threshold;
                    return (
                      <td
                        key={mi}
                        className={`text-right ${cellClass} tabular-nums ${bg} ${textTotal}`}
                        style={showMode !== 'varpct' ? numStyle : {}}
                      >
                        {showMode === 'varpct'
                          ? (b === 0 && r === 0 ? '—' : (
                            <span className="flex items-center justify-end gap-0.5">
                              {hasAlert && <AlertTriangle size={9} className="text-amber-500 flex-shrink-0" />}
                              <span style={{ color: vp > 0 === !line.isNegative ? '#16a34a' : '#dc2626' }}>
                                {vp > 0 ? '+' : ''}{vp.toFixed(1)}%
                              </span>
                            </span>
                          ))
                          : fmtNum(display)
                        }
                      </td>
                    );
                  })}

                  {/* Total column */}
                  <td
                    className={`text-right ${cellClass} font-medium tabular-nums ${textTotal} ${
                      showMode === 'varpct' ? heatClass(totalVp, !!line.isNegative) : ''
                    }`}
                    style={showMode !== 'varpct' ? numStyle : {}}
                  >
                    {showMode === 'varpct'
                      ? (totalB === 0 && totalR === 0 ? '—' : (
                        <span style={{ color: totalVp > 0 === !line.isNegative ? '#16a34a' : '#dc2626' }}>
                          {totalVp > 0 ? '+' : ''}{totalVp.toFixed(1)}%
                        </span>
                      ))
                      : fmtNum(totalDisplay)
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
