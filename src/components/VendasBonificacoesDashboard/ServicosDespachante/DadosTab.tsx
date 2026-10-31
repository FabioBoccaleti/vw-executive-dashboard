import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import {
  getDespachanteWeek,
  type DespachanteCategory,
  type DespachanteMarca,
  type DespachanteMarcaData,
  type DespachanteWeekData,
} from './storage';
import { formatBRL, groupByLoja, normalize } from './shared';

interface Props {
  category: DespachanteCategory;
  year: number;
  month: number;
  week: number;
  marca: DespachanteMarca;
}

export function DadosTab({ category, year, month, week, marca }: Props) {
  const [data, setData] = useState<DespachanteWeekData | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDespachanteWeek(category, year, month, week)
      .then(result => { if (!cancelled) setData(result); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [category, year, month, week]);

  const marcaData = data?.marcas.find(item => item.marca === marca) ?? null;

  if (loading) {
    return <div className="py-16 text-center text-slate-500">Carregando dados...</div>;
  }

  if (!marcaData) {
    return (
      <div className="py-16 text-center text-slate-500">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
        Nenhum dado importado para a Semana {week} ({marca === 'vw' ? 'VW' : 'Audi'}).
      </div>
    );
  }

  return <MarcaTable marcaData={marcaData} search={search} onSearch={setSearch} />;
}

export function MarcaTable({
  marcaData,
  search,
  onSearch,
}: {
  marcaData: DespachanteMarcaData;
  search: string;
  onSearch: (value: string) => void;
}) {
  const textHeaders = useMemo(
    () => marcaData.headers.filter(header => !marcaData.numericHeaders.includes(header)),
    [marcaData],
  );

  // Colunas exibidas: exclui LOJA (vira agrupamento) e colunas de texto totalmente vazias.
  const displayHeaders = useMemo(
    () => marcaData.headers.filter(header => {
      if (normalize(header) === 'loja') return false;
      const isNumeric = marcaData.numericHeaders.includes(header);
      if (!isNumeric && marcaData.rows.every(row => !String(row[header] ?? '').trim())) return false;
      return true;
    }),
    [marcaData],
  );

  const textDisplayCount = displayHeaders.filter(header => !marcaData.numericHeaders.includes(header)).length;

  const filteredRows = useMemo(() => {
    const query = normalize(search);
    if (!query) return marcaData.rows;
    return marcaData.rows.filter(row =>
      textHeaders.some(header => normalize(row[header]).includes(query)),
    );
  }, [marcaData, textHeaders, search]);

  const { groups, totals } = useMemo(
    () => groupByLoja(filteredRows, marcaData.numericHeaders),
    [filteredRows, marcaData.numericHeaders],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={event => onSearch(event.target.value)}
            placeholder="Buscar por nome, placa, município..."
            className="pl-9 pr-3 py-2 text-sm border border-slate-300 rounded w-72 focus:outline-none focus:ring-1 focus:ring-violet-400"
          />
        </div>
        <p className="text-xs text-slate-500">
          {filteredRows.length} registro(s) · Total:{' '}
          <strong className="text-slate-700">{formatBRL(totals['VALOR TOTAL'] ?? 0)}</strong>
        </p>
      </div>

      {marcaData.vencimento && (
        <p className="text-xs text-slate-400">Vencimento do arquivo: {marcaData.vencimento}</p>
      )}

      <div className="overflow-auto max-h-[calc(100vh-430px)] border border-slate-200 rounded">
        <table className="min-w-max w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-violet-700 text-white">
            <tr>
              {displayHeaders.map(header => (
                <th
                  key={header}
                  className={`px-3 py-2 whitespace-nowrap ${marcaData.numericHeaders.includes(header) ? 'text-right' : 'text-left'}`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={displayHeaders.length} className="px-3 py-6 text-center text-slate-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              groups.map(group => (
                <GroupRows
                  key={group.loja}
                  group={group}
                  displayHeaders={displayHeaders}
                  numericHeaders={marcaData.numericHeaders}
                  textDisplayCount={textDisplayCount}
                />
              ))
            )}
          </tbody>
          {groups.length > 0 && (
            <tfoot className="sticky bottom-0 bg-violet-100 font-bold text-slate-800">
              <tr>
                {displayHeaders.map((header, index) => {
                  const isNumeric = marcaData.numericHeaders.includes(header);
                  if (index === 0) {
                    return (
                      <td key={header} className="px-3 py-2 border-t-2 border-violet-400" colSpan={isNumeric ? 1 : textDisplayCount}>
                        TOTAL GERAL
                      </td>
                    );
                  }
                  if (!isNumeric) return null;
                  return (
                    <td key={header} className="px-3 py-2 text-right whitespace-nowrap border-t-2 border-violet-400">
                      {formatBRL(totals[header] ?? 0)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function GroupRows({
  group,
  displayHeaders,
  numericHeaders,
  textDisplayCount,
}: {
  group: { loja: string; rows: Array<Record<string, string | number>>; totals: Record<string, number> };
  displayHeaders: string[];
  numericHeaders: string[];
  textDisplayCount: number;
}) {
  return (
    <>
      <tr className="bg-slate-200/70">
        <td colSpan={displayHeaders.length} className="px-3 py-1.5 font-semibold text-slate-700">
          {group.loja} <span className="text-slate-500 font-normal">· {group.rows.length} registro(s)</span>
        </td>
      </tr>
      {group.rows.map((row, index) => (
        <tr key={index} className="odd:bg-white even:bg-slate-50">
          {displayHeaders.map(header => {
            const isNumeric = numericHeaders.includes(header);
            return (
              <td
                key={header}
                className={`px-3 py-1.5 border-t border-slate-100 whitespace-nowrap ${isNumeric ? 'text-right tabular-nums' : 'text-left'}`}
              >
                {isNumeric ? formatBRL(Number(row[header] ?? 0)) : String(row[header] ?? '')}
              </td>
            );
          })}
        </tr>
      ))}
      <tr className="bg-violet-50 font-semibold text-slate-700">
        {displayHeaders.map((header, index) => {
          const isNumeric = numericHeaders.includes(header);
          if (index === 0) {
            return (
              <td key={header} className="px-3 py-1.5 border-t border-violet-200" colSpan={isNumeric ? 1 : textDisplayCount}>
                Subtotal {group.loja}
              </td>
            );
          }
          if (!isNumeric) return null;
          return (
            <td key={header} className="px-3 py-1.5 text-right whitespace-nowrap border-t border-violet-200">
              {formatBRL(group.totals[header] ?? 0)}
            </td>
          );
        })}
      </tr>
    </>
  );
}
