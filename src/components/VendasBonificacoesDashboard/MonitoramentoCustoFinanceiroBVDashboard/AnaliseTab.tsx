import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, Car, DollarSign, Percent, CalendarClock } from 'lucide-react';
import { getMonitoramentoBVDay, listMonitoramentoBVDates, type MonitoramentoBVBrand } from './storage';
import { analyzeDay, FAIXAS, type BucketResult, type DayAnalysis } from './analysis';

interface Props {
  brand: MonitoramentoBVBrand;
}

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const fmtBRL = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtInt = (value: number) => value.toLocaleString('pt-BR');
const fmtDias = (value: number | null) => (value === null ? '—' : `${Math.round(value)} dias`);

function formatDateBR(iso: string) {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function AnaliseTab({ brand }: Props) {
  const [dates, setDates] = useState<string[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number | 'all'>('all');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, DayAnalysis>>({});
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void listMonitoramentoBVDates(brand).then(result => {
      if (!cancelled) setDates(result);
    });
    return () => { cancelled = true; };
  }, [brand]);

  const years = useMemo(() => {
    const set = new Set<number>(dates.map(date => Number(date.slice(0, 4))));
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [dates]);

  useEffect(() => {
    if (!years.includes(year) && years.length > 0) setYear(years[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years]);

  const filteredDates = useMemo(() => {
    return dates.filter(date => {
      if (Number(date.slice(0, 4)) !== year) return false;
      if (month === 'all') return true;
      return Number(date.slice(5, 7)) === month;
    });
  }, [dates, year, month]);

  const filteredKey = filteredDates.join('|');
  useEffect(() => {
    setSelectedDays(prev => {
      const stillValid = prev.filter(day => filteredDates.includes(day));
      if (stillValid.length > 0) return stillValid;
      return filteredDates.length > 0 ? [filteredDates[0]] : [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredKey]);

  useEffect(() => {
    const missing = selectedDays.filter(day => !analyses[day]);
    if (missing.length === 0) return;
    let cancelled = false;
    setLoading(true);
    void Promise.all(
      missing.map(async day => {
        const data = await getMonitoramentoBVDay(brand, day);
        return { day, analysis: data ? analyzeDay(data) : null };
      }),
    ).then(results => {
      if (cancelled) return;
      setAnalyses(prev => {
        const next = { ...prev };
        for (const { day, analysis } of results) if (analysis) next[day] = analysis;
        return next;
      });
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDays.join('|'), brand]);

  function toggleDay(day: string) {
    setSelectedDays(prev => (prev.includes(day) ? prev.filter(item => item !== day) : [...prev, day]));
  }

  const monthChip = (value: number | 'all', label: string) => (
    <button
      key={label}
      onClick={() => setMonth(value)}
      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
        month === value ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );

  const orderedSelection = filteredDates.filter(day => selectedDays.includes(day));
  const singleAnalysis = orderedSelection.length === 1 ? analyses[orderedSelection[0]] : null;

  return (
    <div className="space-y-5">
      {/* Seletor Ano / Mês */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500 mr-1">ANO</span>
        <select
          value={year}
          onChange={event => setYear(Number(event.target.value))}
          className="border border-slate-300 rounded-full px-3 py-1 text-xs font-semibold"
        >
          {years.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        {monthChip('all', 'Ano todo')}
        {MONTHS_SHORT.map((label, index) => monthChip(index + 1, label))}
      </div>

      {/* Seleção de dias */}
      {filteredDates.length === 0 ? (
        <div className="py-16 text-center text-slate-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          Nenhum dia importado para o período selecionado.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">
              Dias disponíveis — selecione 1 para a análise detalhada ou vários para comparar:
            </p>
            <div className="flex flex-wrap gap-2">
              {filteredDates.map(day => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`text-xs font-medium rounded-full px-3 py-1 border transition-colors ${
                    selectedDays.includes(day)
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {formatDateBR(day)}
                </button>
              ))}
            </div>
          </div>

          {loading && <p className="text-sm text-slate-500">Processando análise...</p>}

          {orderedSelection.length === 0 ? (
            <p className="text-sm text-slate-500">Selecione ao menos um dia.</p>
          ) : singleAnalysis ? (
            singleAnalysis.reconhecido ? (
              <SingleDayView analysis={singleAnalysis} expanded={expanded} setExpanded={setExpanded} />
            ) : (
              <div className="py-12 text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                Não foi possível reconhecer a tabela (coluna "Chassi") no arquivo de {formatDateBR(singleAnalysis.date)}.
              </div>
            )
          ) : (
            <ComparisonView days={orderedSelection} analyses={analyses} />
          )}
        </>
      )}
    </div>
  );
}

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${accent}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-800 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

// ─── Visão de 1 dia ──────────────────────────────────────────────────────────

function SingleDayView({
  analysis,
  expanded,
  setExpanded,
}: {
  analysis: DayAnalysis;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<Car className="w-5 h-5 text-sky-600" />} accent="bg-sky-50" label="Total de veículos" value={fmtInt(analysis.totalVeiculos)} />
        <KpiCard icon={<DollarSign className="w-5 h-5 text-emerald-600" />} accent="bg-emerald-50" label="Valor NF total" value={fmtBRL(analysis.totalValorNf)} />
        <KpiCard icon={<Percent className="w-5 h-5 text-rose-600" />} accent="bg-rose-50" label="Juros (J+Mora+Multa)" value={fmtBRL(analysis.totalJuros)} />
        <KpiCard icon={<CalendarClock className="w-5 h-5 text-amber-600" />} accent="bg-amber-50" label="Média de dias em estoque" value={fmtDias(analysis.mediaDiasGeral)} />
      </div>

      {/* Vendidos x Não vendidos */}
      <div className="grid gap-3 md:grid-cols-2">
        <GrupoCard title="Veículos com data de venda" grupo={analysis.vendidos} accent="text-emerald-700" />
        <GrupoCard title="Veículos sem data de venda" grupo={analysis.naoVendidos} accent="text-amber-700" />
      </div>

      {/* Faixas de dias */}
      <div className="grid gap-5 lg:grid-cols-2">
        <FaixasTable
          title="Faixas de dias — Vendidos"
          subtitle="Dias = Data da Venda − Emissão NF"
          buckets={analysis.bucketsVendidos}
          groupKey="v"
          expanded={expanded}
          setExpanded={setExpanded}
        />
        <FaixasTable
          title="Faixas de dias — Sem data de venda"
          subtitle="Dias = Data base do arquivo − Emissão NF"
          buckets={analysis.bucketsNaoVendidos}
          groupKey="n"
          expanded={expanded}
          setExpanded={setExpanded}
        />
      </div>

      {/* Por produto */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-2">Resumo por produto</h3>
        <div className="overflow-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2">Produto</th>
                <th className="text-right px-3 py-2">Veículos</th>
                <th className="text-right px-3 py-2">Valor NF</th>
                <th className="text-right px-3 py-2">Juros</th>
                <th className="text-right px-3 py-2">Média dias</th>
              </tr>
            </thead>
            <tbody>
              {analysis.porProduto.map(item => (
                <tr key={item.produto} className="odd:bg-white even:bg-slate-50">
                  <td className="px-3 py-1.5 font-medium text-slate-700">{item.produto}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(item.qtd)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(item.valorNf)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(item.juros)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtDias(item.mediaDias)}</td>
                </tr>
              ))}
              <tr className="bg-sky-50 font-bold">
                <td className="px-3 py-1.5">Total</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(analysis.totalVeiculos)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(analysis.totalValorNf)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(analysis.totalJuros)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtDias(analysis.mediaDiasGeral)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GrupoCard({ title, grupo, accent }: { title: string; grupo: DayAnalysis['vendidos']; accent: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <p className={`text-sm font-bold ${accent}`}>{title}</p>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div>
          <p className="text-xs text-slate-500">Veículos</p>
          <p className="text-base font-bold text-slate-800 tabular-nums">{fmtInt(grupo.qtd)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Valor NF</p>
          <p className="text-base font-bold text-slate-800 tabular-nums">{fmtBRL(grupo.valorNf)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Juros</p>
          <p className="text-base font-bold text-slate-800 tabular-nums">{fmtBRL(grupo.juros)}</p>
        </div>
      </div>
    </div>
  );
}

function FaixasTable({
  title,
  subtitle,
  buckets,
  groupKey,
  expanded,
  setExpanded,
}: {
  title: string;
  subtitle: string;
  buckets: BucketResult[];
  groupKey: string;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const totalQtd = buckets.reduce((sum, b) => sum + b.qtd, 0);
  const totalJuros = buckets.reduce((sum, b) => sum + b.juros, 0);
  const totalValor = buckets.reduce((sum, b) => sum + b.valorNf, 0);

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-700">{title}</h3>
      <p className="text-xs text-slate-400 mb-2">{subtitle}</p>
      <div className="overflow-hidden border border-slate-200 rounded-lg">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 w-8"></th>
              <th className="text-left px-3 py-2">Faixa</th>
              <th className="text-right px-3 py-2">Veículos</th>
              <th className="text-right px-3 py-2">Valor NF</th>
              <th className="text-right px-3 py-2">Juros</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket, index) => {
              const key = `${groupKey}:${index}`;
              const isOpen = expanded[key];
              const canExpand = bucket.veiculos.length > 0;
              return (
                <Fragment key={key}>
                  <tr
                    className={`border-t border-slate-100 ${canExpand ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                    onClick={() => canExpand && setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
                  >
                    <td className="px-3 py-1.5 text-slate-400">
                      {canExpand ? (isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : null}
                    </td>
                    <td className="px-3 py-1.5 font-medium text-slate-700">{FAIXAS[index].label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(bucket.qtd)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(bucket.valorNf)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(bucket.juros)}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td></td>
                      <td colSpan={4} className="px-3 py-2 bg-slate-50">
                        <table className="min-w-full text-[11px]">
                          <thead className="text-slate-500">
                            <tr>
                              <th className="text-left px-2 py-1">Chassi</th>
                              <th className="text-left px-2 py-1">Produto</th>
                              <th className="text-right px-2 py-1">Dias</th>
                              <th className="text-right px-2 py-1">Juros</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bucket.veiculos.map(veiculo => (
                              <tr key={veiculo.chassi} className="border-t border-slate-200">
                                <td className="px-2 py-1 font-mono">{veiculo.chassi}</td>
                                <td className="px-2 py-1">{veiculo.produto}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{fmtDias(veiculo.diasEstoque)}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(veiculo.juros)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            <tr className="bg-sky-50 font-bold border-t border-slate-200">
              <td></td>
              <td className="px-3 py-1.5">Total</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(totalQtd)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(totalValor)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(totalJuros)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Comparativo entre dias ──────────────────────────────────────────────────

function ComparisonView({ days, analyses }: { days: string[]; analyses: Record<string, DayAnalysis> }) {
  const cols = days.map(day => ({ day, a: analyses[day] })).filter(col => col.a && col.a.reconhecido);
  if (cols.length === 0) {
    return <div className="py-12 text-center text-slate-500">Sem dados reconhecidos para comparar.</div>;
  }

  const rows: Array<{ label: string; render: (a: DayAnalysis) => string }> = [
    { label: 'Total de veículos', render: a => fmtInt(a.totalVeiculos) },
    { label: 'Com data de venda', render: a => fmtInt(a.vendidos.qtd) },
    { label: 'Sem data de venda', render: a => fmtInt(a.naoVendidos.qtd) },
    { label: 'Valor NF total', render: a => fmtBRL(a.totalValorNf) },
    { label: 'Juros total (J+Mora+Multa)', render: a => fmtBRL(a.totalJuros) },
    { label: 'Média de dias em estoque', render: a => fmtDias(a.mediaDiasGeral) },
  ];

  const faixaJuros = (a: DayAnalysis, index: number) =>
    a.bucketsVendidos[index].juros + a.bucketsNaoVendidos[index].juros;
  const faixaQtd = (a: DayAnalysis, index: number) =>
    a.bucketsVendidos[index].qtd + a.bucketsNaoVendidos[index].qtd;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-slate-700">Comparativo entre dias</h3>
      <div className="overflow-auto border border-slate-200 rounded-lg">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Indicador</th>
              {cols.map(col => <th key={col.day} className="text-right px-3 py-2 whitespace-nowrap">{formatDateBR(col.day)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label} className="odd:bg-white even:bg-slate-50">
                <td className="px-3 py-1.5 font-medium text-slate-700">{row.label}</td>
                {cols.map(col => <td key={col.day} className="px-3 py-1.5 text-right tabular-nums">{row.render(col.a!)}</td>)}
              </tr>
            ))}
            <tr className="bg-slate-100">
              <td className="px-3 py-1.5 font-bold text-slate-700" colSpan={cols.length + 1}>Juros por faixa de dias (veículos)</td>
            </tr>
            {FAIXAS.map((faixa, index) => (
              <tr key={faixa.label} className="odd:bg-white even:bg-slate-50">
                <td className="px-3 py-1.5 font-medium text-slate-700">{faixa.label}</td>
                {cols.map(col => (
                  <td key={col.day} className="px-3 py-1.5 text-right tabular-nums">
                    {fmtBRL(faixaJuros(col.a!, index))}
                    <span className="text-slate-400"> ({fmtInt(faixaQtd(col.a!, index))})</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
