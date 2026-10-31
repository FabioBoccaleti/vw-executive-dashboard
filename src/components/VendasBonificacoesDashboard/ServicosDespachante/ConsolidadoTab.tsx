import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  getDespachanteMonth,
  type DespachanteCategory,
  type DespachanteMarca,
  type DespachanteWeekData,
} from './storage';
import { formatBRL, groupByLoja, sumNumeric } from './shared';

interface Props {
  category: DespachanteCategory;
  year: number;
  month: number;
  marca: DespachanteMarca;
}

export function ConsolidadoTab({ category, year, month, marca }: Props) {
  const [weeksData, setWeeksData] = useState<DespachanteWeekData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDespachanteMonth(category, year, month)
      .then(result => { if (!cancelled) setWeeksData(result); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [category, year, month]);

  const marcaWeeks = useMemo(
    () => weeksData
      .map(week => ({ week: week.week, marcaData: week.marcas.find(item => item.marca === marca) ?? null }))
      .filter((entry): entry is { week: number; marcaData: NonNullable<typeof entry.marcaData> } => entry.marcaData !== null),
    [weeksData, marca],
  );

  const numericHeaders = marcaWeeks[0]?.marcaData.numericHeaders ?? [];
  const allRows = useMemo(() => marcaWeeks.flatMap(entry => entry.marcaData.rows), [marcaWeeks]);

  const perWeek = useMemo(
    () => marcaWeeks.map(entry => ({
      week: entry.week,
      count: entry.marcaData.rows.length,
      totals: sumNumeric(entry.marcaData.rows, numericHeaders),
    })),
    [marcaWeeks, numericHeaders],
  );

  const { groups, totals } = useMemo(() => groupByLoja(allRows, numericHeaders), [allRows, numericHeaders]);
  const totalCount = allRows.length;

  if (loading) {
    return <div className="py-16 text-center text-slate-500">Carregando consolidado...</div>;
  }

  if (marcaWeeks.length === 0) {
    return (
      <div className="py-16 text-center text-slate-500">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
        Nenhuma semana importada neste mês para {marca === 'vw' ? 'VW' : 'Audi'}.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-2">
          Totais por Semana <span className="font-normal text-slate-500">({marcaWeeks.length} semana(s) importada(s))</span>
        </h3>
        <div className="overflow-auto border border-slate-200 rounded">
          <table className="min-w-max w-full text-xs border-collapse">
            <thead className="bg-violet-700 text-white">
              <tr>
                <th className="px-3 py-2 text-left whitespace-nowrap">Semana</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Registros</th>
                {numericHeaders.map(header => (
                  <th key={header} className="px-3 py-2 text-right whitespace-nowrap">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perWeek.map(entry => (
                <tr key={entry.week} className="odd:bg-white even:bg-slate-50">
                  <td className="px-3 py-1.5 border-t border-slate-100 font-medium whitespace-nowrap">Semana {entry.week}</td>
                  <td className="px-3 py-1.5 border-t border-slate-100 text-right">{entry.count}</td>
                  {numericHeaders.map(header => (
                    <td key={header} className="px-3 py-1.5 border-t border-slate-100 text-right tabular-nums whitespace-nowrap">
                      {formatBRL(entry.totals[header] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-violet-100 font-bold text-slate-800">
              <tr>
                <td className="px-3 py-2 border-t-2 border-violet-400 whitespace-nowrap">TOTAL DO MÊS</td>
                <td className="px-3 py-2 border-t-2 border-violet-400 text-right">{totalCount}</td>
                {numericHeaders.map(header => (
                  <td key={header} className="px-3 py-2 border-t-2 border-violet-400 text-right whitespace-nowrap">
                    {formatBRL(totals[header] ?? 0)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-2">Totais por Loja (consolidado do mês)</h3>
        <div className="overflow-auto border border-slate-200 rounded">
          <table className="min-w-max w-full text-xs border-collapse">
            <thead className="bg-violet-700 text-white">
              <tr>
                <th className="px-3 py-2 text-left whitespace-nowrap">Loja</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Registros</th>
                {numericHeaders.map(header => (
                  <th key={header} className="px-3 py-2 text-right whitespace-nowrap">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <tr key={group.loja} className="odd:bg-white even:bg-slate-50">
                  <td className="px-3 py-1.5 border-t border-slate-100 font-medium whitespace-nowrap">{group.loja}</td>
                  <td className="px-3 py-1.5 border-t border-slate-100 text-right">{group.rows.length}</td>
                  {numericHeaders.map(header => (
                    <td key={header} className="px-3 py-1.5 border-t border-slate-100 text-right tabular-nums whitespace-nowrap">
                      {formatBRL(group.totals[header] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-violet-100 font-bold text-slate-800">
              <tr>
                <td className="px-3 py-2 border-t-2 border-violet-400 whitespace-nowrap">TOTAL GERAL</td>
                <td className="px-3 py-2 border-t-2 border-violet-400 text-right">{totalCount}</td>
                {numericHeaders.map(header => (
                  <td key={header} className="px-3 py-2 border-t-2 border-violet-400 text-right whitespace-nowrap">
                    {formatBRL(totals[header] ?? 0)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
