import { useState, useEffect } from 'react';
import { Plus, X, TrendingUp, TrendingDown } from 'lucide-react';
import {
  type Marca,
  type DeptoClassificacao,
  type TipoContaClassificacao,
  TIPO_CONTA_LABELS,
  TIPOS_CONTA_ORDENADOS,
  DEPTO_CLASSIFICACAO_LABELS,
  DEPTO_CLASSIFICACOES_ORDENADAS,
} from './ieoStorage';
import {
  processDepartamentoData,
  processConsolidadoData,
  type DepartamentoData,
} from './ieoDataProcessor';

// ─── Tipos e Constantes ───────────────────────────────────────────────────────

type DeptoFiltro = DeptoClassificacao | 'consolidado';

interface Periodo {
  year: number;
  semestre: 1 | 2;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - 5 + i);

const DEFAULT_PERIODOS: Periodo[] = [
  { year: CURRENT_YEAR - 1, semestre: 1 },
  { year: CURRENT_YEAR - 1, semestre: 2 },
  { year: CURRENT_YEAR, semestre: 1 },
];

const DEPTOS: Array<{ id: DeptoFiltro; label: string }> = [
  { id: 'consolidado', label: 'Consolidado' },
  ...DEPTO_CLASSIFICACOES_ORDENADAS.map(d => ({
    id: d as DeptoFiltro,
    label: DEPTO_CLASSIFICACAO_LABELS[d],
  })),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function periodoKey(p: Periodo) {
  return `${p.year}:S${p.semestre}`;
}

function fmtPeriodo(p: Periodo) {
  return `${p.semestre}º Sem/${p.year}`;
}

function fmtCurrency(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function calcVariacao(base: number, atual: number): { delta: number; pct: number | null } {
  const delta = atual - base;
  const pct = base !== 0 ? ((atual - base) / Math.abs(base)) * 100 : null;
  return { delta, pct };
}

// Reúne union de contas de um grupo em todos os períodos
function unionContas(dataMap: Record<string, DepartamentoData>, periodos: Periodo[], tipo: TipoContaClassificacao): string[] {
  const seen = new Map<string, number>();
  periodos.forEach(p => {
    const data = dataMap[periodoKey(p)];
    data?.grupos[tipo]?.contas.forEach(c => {
      if (!seen.has(c.conta)) seen.set(c.conta, c.valor);
    });
  });
  return Array.from(seen.keys());
}

function getContaValor(data: DepartamentoData | undefined, tipo: TipoContaClassificacao, conta: string): number {
  return data?.grupos[tipo]?.contas.find(c => c.conta === conta)?.valor ?? 0;
}

function calcReceitasLiquidas(data: DepartamentoData): number {
  return (
    (data.grupos.receita_vendas?.subtotal ?? 0) +
    (data.grupos.receitas_operacionais?.subtotal ?? 0) +
    (data.grupos.receitas_financeiras?.subtotal ?? 0)
  );
}

function calcCustosDespesas(data: DepartamentoData): number {
  return (
    (data.grupos.custos_operacionais?.subtotal ?? 0) +
    (data.grupos.despesas_pessoal?.subtotal ?? 0) +
    (data.grupos.despesas_servicos_terceiros?.subtotal ?? 0) +
    (data.grupos.despesas_ocupacao?.subtotal ?? 0) +
    (data.grupos.despesas_funcionamento?.subtotal ?? 0) +
    (data.grupos.despesas_vendas?.subtotal ?? 0) +
    (data.grupos.amortizacoes_depreciacoes?.subtotal ?? 0) +
    (data.grupos.despesas_financeiras?.subtotal ?? 0) +
    (data.grupos.outras_despesas_operacionais?.subtotal ?? 0)
  );
}

// ─── Células de Variação ──────────────────────────────────────────────────────

interface VarCellProps {
  base: number;
  atual: number;
  /** true = positivo é bom (receitas), false = negativo é bom (custos) */
  positiveIsGood: boolean;
}

function VarCells({ base, atual, positiveIsGood }: VarCellProps) {
  const { delta, pct } = calcVariacao(base, atual);
  const isPositive = delta > 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  const colorClass =
    delta === 0
      ? 'text-slate-400'
      : isGood
      ? 'text-emerald-600'
      : 'text-red-500';

  return (
    <>
      <td className={`py-1.5 px-3 text-right font-mono tabular-nums text-xs ${colorClass}`}>
        {delta === 0 ? '—' : (delta > 0 ? '+' : '') + fmtCurrency(delta)}
      </td>
      <td className={`py-1.5 px-3 text-right font-mono tabular-nums text-xs ${colorClass}`}>
        {pct === null ? '—' : (
          <span className="inline-flex items-center gap-0.5">
            {delta > 0 && pct !== 0 && <TrendingUp className="w-2.5 h-2.5 shrink-0" />}
            {delta < 0 && pct !== 0 && <TrendingDown className="w-2.5 h-2.5 shrink-0" />}
            {pct === 0 ? '0,0%' : fmtPct(pct)}
          </span>
        )}
      </td>
    </>
  );
}

// ─── Cabeçalho de Variação ─────────────────────────────────────────────────────

function VarHeaders({ periodos }: { periodos: Periodo[] }) {
  if (periodos.length < 2) return null;
  const label = `Δ ${fmtPeriodo(periodos[0])} → ${fmtPeriodo(periodos[periodos.length - 1])}`;
  return (
    <>
      <th className="py-2 px-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">
        {label} (R$)
      </th>
      <th className="py-2 px-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wide">
        Δ %
      </th>
    </>
  );
}

// ─── Card de Totais ───────────────────────────────────────────────────────────

interface TotaisCardProps {
  label: string;
  subtitle?: string;
  values: Array<{ periodo: Periodo; value: number }>;
  positiveIsGood: boolean;
}

function TotaisCard({ label, subtitle, values, positiveIsGood }: TotaisCardProps) {
  const hasMultiple = values.length > 1;
  const first = values[0]?.value ?? 0;
  const last = values[values.length - 1]?.value ?? 0;
  const { delta, pct } = calcVariacao(first, last);
  const isGood = positiveIsGood ? delta >= 0 : delta <= 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-2 min-w-[200px]">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
      {subtitle && <div className="text-[10px] text-slate-400 -mt-1">{subtitle}</div>}
      <div className="space-y-1.5">
        {values.map(({ periodo, value }) => (
          <div key={periodoKey(periodo)} className="flex items-center justify-between gap-4">
            <span className="text-[10px] text-slate-500 whitespace-nowrap">{fmtPeriodo(periodo)}</span>
            <span className={`text-sm font-bold tabular-nums ${value < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {fmtCurrency(value)}
            </span>
          </div>
        ))}
      </div>
      {hasMultiple && (
        <div className={`flex items-center justify-between border-t border-slate-100 pt-2 mt-1 ${delta === 0 ? 'text-slate-400' : isGood ? 'text-emerald-600' : 'text-red-500'}`}>
          <span className="text-[10px] font-semibold">Variação</span>
          <div className="flex flex-col items-end text-xs font-bold tabular-nums gap-0.5">
            <span>{delta === 0 ? '—' : (delta > 0 ? '+' : '') + fmtCurrency(delta)}</span>
            {pct !== null && pct !== 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px]">
                {delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {fmtPct(pct)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Grupo de Contas ──────────────────────────────────────────────────────────

interface GrupoContasProps {
  tipo: TipoContaClassificacao;
  periodos: Periodo[];
  dataMap: Record<string, DepartamentoData>;
}

function GrupoContas({ tipo, periodos, dataMap }: GrupoContasProps) {
  const contas = unionContas(dataMap, periodos, tipo);
  const hasMultiple = periodos.length > 1;

  const first = dataMap[periodoKey(periodos[0])];
  const last = dataMap[periodoKey(periodos[periodos.length - 1])];

  const firstSubtotal = first?.grupos[tipo]?.subtotal ?? 0;
  const lastSubtotal = last?.grupos[tipo]?.subtotal ?? 0;

  // Só mostra grupos que têm pelo menos algum valor em algum período
  const hasAnyValue = periodos.some(p => (dataMap[periodoKey(p)]?.grupos[tipo]?.subtotal ?? 0) !== 0);
  if (!hasAnyValue) return null;

  // Filtra contas que têm algum valor em algum período
  const contasComValor = contas.filter(conta =>
    periodos.some(p => getContaValor(dataMap[periodoKey(p)], tipo, conta) !== 0)
  );

  const colSpan = 1 + periodos.length + (hasMultiple ? 2 : 0);

  return (
    <div className="space-y-0">
      {/* Cabeçalho do Grupo */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b-2 border-emerald-500 bg-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <h3 className="text-sm font-bold text-slate-700">{TIPO_CONTA_LABELS[tipo]}</h3>
          <span className="text-xs text-slate-400">{contasComValor.length} conta{contasComValor.length !== 1 ? 's' : ''}</span>
        </div>
        {/* Subtotais por período no header */}
        <div className="flex items-center gap-6">
          {periodos.map(p => {
            const sub = dataMap[periodoKey(p)]?.grupos[tipo]?.subtotal ?? 0;
            return (
              <div key={periodoKey(p)} className="text-right">
                <div className="text-[10px] text-slate-400">{fmtPeriodo(p)}</div>
                <div className={`text-sm font-bold ${sub < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {sub !== 0 ? fmtCurrency(sub) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabela de Contas */}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="py-2 px-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide">Conta</th>
            {periodos.map(p => (
              <th key={periodoKey(p)} className="py-2 px-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                {fmtPeriodo(p)}
              </th>
            ))}
            <VarHeaders periodos={periodos} />
          </tr>
        </thead>
        <tbody>
          {contasComValor.map(conta => {
            const firstVal = getContaValor(first, tipo, conta);
            const lastVal = getContaValor(last, tipo, conta);
            return (
              <tr key={conta} className="hover:bg-slate-50 border-b border-slate-50 transition-colors">
                <td className="py-1.5 px-3 text-slate-600 max-w-xs truncate">{conta}</td>
                {periodos.map(p => {
                  const val = getContaValor(dataMap[periodoKey(p)], tipo, conta);
                  return (
                    <td key={periodoKey(p)} className={`py-1.5 px-3 text-right font-mono tabular-nums ${val < 0 ? 'text-red-600' : val === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                      {val !== 0 ? fmtCurrency(val) : '—'}
                    </td>
                  );
                })}
                {hasMultiple && (
                  <VarCells base={firstVal} atual={lastVal} positiveIsGood={firstSubtotal >= 0} />
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-emerald-50 border-t-2 border-emerald-200">
            <td className="py-2 px-3 text-xs font-bold text-emerald-800">Subtotal — {TIPO_CONTA_LABELS[tipo]}</td>
            {periodos.map(p => {
              const sub = dataMap[periodoKey(p)]?.grupos[tipo]?.subtotal ?? 0;
              return (
                <td key={periodoKey(p)} className={`py-2 px-3 text-right font-mono tabular-nums text-xs font-bold ${sub < 0 ? 'text-red-700' : 'text-emerald-800'}`}>
                  {sub !== 0 ? fmtCurrency(sub) : '—'}
                </td>
              );
            })}
            {hasMultiple && (
              <VarCells base={firstSubtotal} atual={lastSubtotal} positiveIsGood={firstSubtotal >= 0} />
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function ComparativoTab() {
  const [mainTab, setMainTab] = useState<'vw' | 'audi'>('vw');
  const [depto, setDepto] = useState<DeptoFiltro>('consolidado');
  const [periodos, setPeriodos] = useState<Periodo[]>(DEFAULT_PERIODOS);
  const [dataMap, setDataMap] = useState<Record<string, DepartamentoData>>({});
  const [loading, setLoading] = useState(false);

  const marca: Marca = mainTab;
  const hasMultiple = periodos.length > 1;

  function addPeriodo() {
    if (periodos.length >= 4) return;
    const last = periodos[periodos.length - 1];
    const next: Periodo =
      last.semestre === 1
        ? { year: last.year, semestre: 2 }
        : { year: last.year + 1, semestre: 1 };
    setPeriodos([...periodos, next]);
  }

  function removePeriodo(idx: number) {
    if (periodos.length <= 1) return;
    setPeriodos(periodos.filter((_, i) => i !== idx));
  }

  function updatePeriodo(idx: number, field: 'year' | 'semestre', value: number) {
    setPeriodos(periodos.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  useEffect(() => {
    setLoading(true);
    Promise.all(
      periodos.map(async p => {
        const key = periodoKey(p);
        const data =
          depto === 'consolidado'
            ? await processConsolidadoData(marca, p.year, p.semestre)
            : await processDepartamentoData(marca, depto, p.year, p.semestre);
        return [key, data] as const;
      }),
    ).then(entries => {
      setDataMap(Object.fromEntries(entries));
      setLoading(false);
    });
  }, [marca, depto, periodos]);

  // Dados resumidos por período para os cards de totais
  const totaisValues = periodos.map(p => {
    const data = dataMap[periodoKey(p)];
    return {
      periodo: p,
      resultado: data?.total ?? 0,
      receitasLiquidas: data ? calcReceitasLiquidas(data) : 0,
      custosDespesas: data ? calcCustosDespesas(data) : 0,
    };
  });

  const gruposComValores = TIPOS_CONTA_ORDENADOS.filter(tipo =>
    periodos.some(p => (dataMap[periodoKey(p)]?.grupos[tipo]?.subtotal ?? 0) !== 0),
  );

  return (
    <div className="flex-1 flex flex-col gap-0 min-h-0">
      {/* Abas de Marca */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-0 shrink-0">
        {(['vw', 'audi'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMainTab(m)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              mainTab === m
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {m === 'vw' ? 'VW' : 'Audi'}
          </button>
        ))}
      </div>

      {/* Seletor de Departamento */}
      <div className="flex items-center gap-1 flex-wrap py-3 border-b border-slate-100 shrink-0">
        {DEPTOS.map(d => (
          <button
            key={d.id}
            onClick={() => setDepto(d.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              depto === d.id
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Seletor de Períodos */}
      <div className="flex items-center gap-2 py-3 border-b border-slate-100 shrink-0 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Períodos</span>
        {periodos.map((p, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 shadow-sm"
          >
            <select
              value={p.year}
              onChange={e => updatePeriodo(idx, 'year', Number(e.target.value))}
              className="text-xs font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={p.semestre}
              onChange={e => updatePeriodo(idx, 'semestre', Number(e.target.value) as 1 | 2)}
              className="text-xs font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
            >
              <option value={1}>S1</option>
              <option value={2}>S2</option>
            </select>
            {periodos.length > 1 && (
              <button
                onClick={() => removePeriodo(idx)}
                className="text-slate-300 hover:text-red-400 transition-colors ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {periodos.length < 4 && (
          <button
            onClick={addPeriodo}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Período
          </button>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Cards de Totais */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <TotaisCard
                label="Resultado do Período"
                values={totaisValues.map(t => ({ periodo: t.periodo, value: t.resultado }))}
                positiveIsGood={true}
              />
              <TotaisCard
                label="Total das Receitas Líquidas"
                subtitle="Rec. Vendas + Rec. Operacionais + Rec. Financeiras"
                values={totaisValues.map(t => ({ periodo: t.periodo, value: t.receitasLiquidas }))}
                positiveIsGood={true}
              />
              <TotaisCard
                label="Total de Custos e Despesas"
                subtitle="Custos + Despesas Operacionais + Financeiras"
                values={totaisValues.map(t => ({ periodo: t.periodo, value: t.custosDespesas }))}
                positiveIsGood={false}
              />
            </div>

            {/* Linha de Totais Consolidados (tabela) */}
            {hasMultiple && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Resumo por Período</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-2 px-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide">Métrica</th>
                        {periodos.map(p => (
                          <th key={periodoKey(p)} className="py-2 px-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                            {fmtPeriodo(p)}
                          </th>
                        ))}
                        <VarHeaders periodos={periodos} />
                      </tr>
                    </thead>
                    <tbody>
                      {/* Resultado do Período */}
                      <tr className="hover:bg-slate-50 border-b border-slate-50">
                        <td className="py-2 px-4 font-semibold text-slate-700">Resultado do Período</td>
                        {totaisValues.map(t => (
                          <td key={periodoKey(t.periodo)} className={`py-2 px-4 text-right font-mono tabular-nums font-semibold ${t.resultado < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {fmtCurrency(t.resultado)}
                          </td>
                        ))}
                        <VarCells
                          base={totaisValues[0]?.resultado ?? 0}
                          atual={totaisValues[totaisValues.length - 1]?.resultado ?? 0}
                          positiveIsGood={true}
                        />
                      </tr>
                      {/* Total das Receitas Líquidas */}
                      <tr className="hover:bg-slate-50 border-b border-slate-50">
                        <td className="py-2 px-4 font-semibold text-slate-700">Total das Receitas Líquidas</td>
                        {totaisValues.map(t => (
                          <td key={periodoKey(t.periodo)} className={`py-2 px-4 text-right font-mono tabular-nums font-semibold ${t.receitasLiquidas < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {fmtCurrency(t.receitasLiquidas)}
                          </td>
                        ))}
                        <VarCells
                          base={totaisValues[0]?.receitasLiquidas ?? 0}
                          atual={totaisValues[totaisValues.length - 1]?.receitasLiquidas ?? 0}
                          positiveIsGood={true}
                        />
                      </tr>
                      {/* Total de Custos e Despesas */}
                      <tr className="hover:bg-slate-50">
                        <td className="py-2 px-4 font-semibold text-slate-700">Total de Custos e Despesas</td>
                        {totaisValues.map(t => (
                          <td key={periodoKey(t.periodo)} className={`py-2 px-4 text-right font-mono tabular-nums font-semibold ${t.custosDespesas < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {fmtCurrency(t.custosDespesas)}
                          </td>
                        ))}
                        <VarCells
                          base={totaisValues[0]?.custosDespesas ?? 0}
                          atual={totaisValues[totaisValues.length - 1]?.custosDespesas ?? 0}
                          positiveIsGood={false}
                        />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Grupos de Contas */}
            {gruposComValores.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center space-y-2">
                  <p className="text-slate-500 font-medium">Nenhum dado encontrado</p>
                  <p className="text-slate-400 text-sm">Verifique se os dados foram importados para os períodos selecionados.</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {TIPOS_CONTA_ORDENADOS.map(tipo => (
                    <GrupoContas
                      key={tipo}
                      tipo={tipo}
                      periodos={periodos}
                      dataMap={dataMap}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
