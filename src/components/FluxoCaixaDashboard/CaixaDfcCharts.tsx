import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { loadFluxoCaixaIndex } from './fluxoCaixaStorage';
import {
  calcularDfcIndireto,
  calcularLinhas,
  chavePeriodo,
  type LinhaDemonstracao,
} from './DemonstracoesFinanceiras/modelo';
import { criarLinhasDfcIndiretoTabela } from './DemonstracoesFinanceiras/dfcTabela';
import { loadCadastroDemonstracoes, loadDadosDemonstracoes } from './DemonstracoesFinanceiras/storage';

type MetodoDfc = 'direto' | 'indireto';
type ValoresMensais = Record<number, Map<string, number | null>>;

interface Props {
  selectedYear: number;
  selectedMonth: number;
  onClose: () => void;
  title: string;
  method: MetodoDfc;
}

interface LinhaGrafico {
  id: string;
  nome: string;
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const COLOR_CURRENT = '#3b82f6';
const COLOR_COMPARE = '#94a3b8';

const fmtBRL = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `R$ ${value < 0 ? '-' : ''}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `R$ ${value < 0 ? '-' : ''}${(abs / 1e3).toFixed(0)}k`;
  return `R$ ${value < 0 ? '-' : ''}${abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
};

const fmtBRLFull = (value: number) =>
  `R$ ${value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-sm shadow-lg">
      <p className="mb-1.5 font-semibold text-foreground">{label}</p>
      {payload.map((entry: any, index: number) => {
        const variation = entry.payload?.[`var_${entry.dataKey}`];
        return (
          <div key={index} className="mb-1 last:mb-0">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-mono font-semibold text-foreground">
                {entry.value === null || entry.value === undefined ? '—' : fmtBRLFull(entry.value)}
              </span>
            </div>
            <div className="ml-5 text-xs">
              {variation === null || variation === undefined
                ? <span className="text-muted-foreground/60">Var: —</span>
                : <span className={variation >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                    Var: {variation >= 0 ? '+' : ''}{variation.toFixed(1)}%
                  </span>
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}

function obterLinhasGrafico(linhas: LinhaDemonstracao[], method: MetodoDfc): LinhaGrafico[] {
  if (method === 'direto') {
    return linhas.filter(linha => linha.demonstracao === 'dfc' && !linha.foraDfc)
      .map(linha => ({ id: linha.id, nome: linha.dfcSubtotalNome ?? linha.nome }));
  }
  return criarLinhasDfcIndiretoTabela(linhas.filter(linha => linha.demonstracao === 'dfc'))
    .filter(linha => linha.tipo !== 'titulo' && linha.tipo !== 'grupo')
    .map(linha => ({ id: linha.id, nome: linha.nome }));
}

export async function carregarValoresMensaisDfc(
  linhas: LinhaDemonstracao[],
  regras: Awaited<ReturnType<typeof loadCadastroDemonstracoes>>['dfcIndiretoRegras'],
  method: MetodoDfc,
  ano: number,
  ateMes: number,
): Promise<ValoresMensais> {
  const principal = { ano, mes: ateMes };
  const dados = await loadDadosDemonstracoes(principal, [principal], 'dfc', true);
  const meses: ValoresMensais = {};
  for (let mes = 1; mes <= ateMes; mes++) {
    const periodo = dados[chavePeriodo({ ano, mes })] ?? null;
    meses[mes] = method === 'indireto'
      ? calcularDfcIndireto(linhas, regras ?? [], [periodo]).valores
      : calcularLinhas(linhas, 'dfc', [periodo]);
  }
  return meses;
}

function somarPeriodo(values: ValoresMensais, months: number[], lineId: string): number | null {
  const amounts = months.map(month => values[month]?.get(lineId) ?? null);
  if (amounts.length === 0 || amounts.some(amount => amount === null)) return null;
  return Math.round(amounts.reduce<number>((total, amount) => total + Math.round((amount ?? 0) * 100), 0)) / 100;
}

export function CaixaDfcCharts({ selectedYear, selectedMonth, onClose, title, method }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [cadastroDfc, setCadastroDfc] = useState<Awaited<ReturnType<typeof loadCadastroDemonstracoes>> | null>(null);
  const [dadosDfc, setDadosDfc] = useState<ValoresMensais>({});
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [compareDfc, setCompareDfc] = useState<ValoresMensais>({});
  const [erro, setErro] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErro('');
    Promise.all([loadCadastroDemonstracoes(), loadFluxoCaixaIndex()])
      .then(([cadastro, index]) => {
        if (!active) return;
        setCadastroDfc(cadastro);
        const years = new Set<number>();
        for (const key of Object.keys(index)) {
          const year = Number(key.split('_')[0]);
          if (Number.isInteger(year) && year !== selectedYear) years.add(year);
        }
        setAvailableYears(Array.from(years).sort((a, b) => b - a));
      })
      .catch(error => {
        if (active) setErro(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedYear]);

  useEffect(() => {
    if (!cadastroDfc) return;
    let active = true;
    setLoading(true);
    setErro('');
    setDadosDfc({});
    carregarValoresMensaisDfc(
      cadastroDfc.linhas,
      cadastroDfc.dfcIndiretoRegras,
      method,
      selectedYear,
      selectedMonth === 0 ? 12 : selectedMonth,
    )
      .then(values => { if (active) setDadosDfc(values); })
      .catch(error => { if (active) setErro(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cadastroDfc, method, selectedMonth, selectedYear]);

  useEffect(() => {
    if (!cadastroDfc || !compareYear) {
      setCompareDfc({});
      setLoadingCompare(false);
      return;
    }
    let active = true;
    setLoadingCompare(true);
    carregarValoresMensaisDfc(
      cadastroDfc.linhas,
      cadastroDfc.dfcIndiretoRegras,
      method,
      compareYear,
      selectedMonth === 0 ? 12 : selectedMonth,
    )
      .then(values => { if (active) setCompareDfc(values); })
      .catch(error => { if (active) setErro(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (active) setLoadingCompare(false); });
    return () => { active = false; };
  }, [cadastroDfc, compareYear, method, selectedMonth]);

  useEffect(() => {
    if (compareYear === selectedYear) setCompareYear(null);
  }, [compareYear, selectedYear]);

  const upToMonth = selectedMonth === 0 ? 12 : selectedMonth;
  const months = Array.from({ length: upToMonth }, (_, index) => index + 1);
  const rows = cadastroDfc ? obterLinhasGrafico(cadastroDfc.linhas, method) : [];

  const buildChartData = (lineId: string) => {
    const currentKey = String(selectedYear);
    const comparisonKey = compareYear ? String(compareYear) : null;
    return months.map((month, index) => {
      const currentValue = dadosDfc[month]?.get(lineId) ?? null;
      const previousCurrent = index > 0 ? dadosDfc[months[index - 1]]?.get(lineId) ?? null : null;
      const currentVariation = currentValue !== null && previousCurrent !== null && previousCurrent !== 0
        ? ((currentValue - previousCurrent) / Math.abs(previousCurrent)) * 100
        : null;
      const row: Record<string, string | number | null> = {
        name: MONTH_LABELS[month - 1],
        [currentKey]: currentValue,
        [`var_${currentKey}`]: currentVariation,
      };
      if (comparisonKey) {
        const comparisonValue = compareDfc[month]?.get(lineId) ?? null;
        const previousComparison = index > 0 ? compareDfc[months[index - 1]]?.get(lineId) ?? null : null;
        row[comparisonKey] = comparisonValue;
        row[`var_${comparisonKey}`] = comparisonValue !== null && previousComparison !== null && previousComparison !== 0
          ? ((comparisonValue - previousComparison) / Math.abs(previousComparison)) * 100
          : null;
      }
      return row;
    });
  };

  if (loading || loadingCompare) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Carregando dados...</h3>
          <Button variant="outline" size="sm" onClick={onClose}>Voltar</Button>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Evolução Mensal — {title}</h3>
          <Button variant="outline" size="sm" onClick={onClose}>Voltar</Button>
        </div>
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-bold text-foreground">Evolução Mensal — {title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {selectedYear} • Jan{upToMonth > 1 ? ` – ${MONTH_LABELS[upToMonth - 1]}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {availableYears.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-xs text-muted-foreground">Comparar com:</span>
              <select
                className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={compareYear ?? ''}
                onChange={event => setCompareYear(event.target.value ? Number(event.target.value) : null)}
              >
                <option value="">Nenhum</option>
                {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Voltar</Button>
        </div>
      </div>

      {rows.length === 0 && <p role="status" className="text-sm text-muted-foreground">Nenhuma linha DFC cadastrada para os gráficos.</p>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rows.map(line => {
          const chartData = buildChartData(line.id);
          const currentTotal = somarPeriodo(dadosDfc, months, line.id);
          const comparisonTotal = compareYear ? somarPeriodo(compareDfc, months, line.id) : null;
          const hasValue = (values: ValoresMensais) => months.some(month => {
            const amount = values[month]?.get(line.id);
            return amount !== null && amount !== undefined && amount !== 0;
          });
          if (!hasValue(dadosDfc) && (!compareYear || !hasValue(compareDfc))) return null;
          return (
            <Card key={line.id}>
              <CardContent className="pb-4 pt-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{line.nome}</h4>
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      Total: {currentTotal === null ? '—' : fmtBRLFull(currentTotal)}
                    </span>
                    {compareYear && (
                      <span className="whitespace-nowrap rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {compareYear}: {comparisonTotal === null ? '—' : fmtBRLFull(comparisonTotal)}
                      </span>
                    )}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} barGap={compareYear ? 2 : 0}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtBRL} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    {compareYear && <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />}
                    <Bar dataKey={String(selectedYear)} fill={COLOR_CURRENT} radius={[3, 3, 0, 0]} maxBarSize={40} />
                    {compareYear && <Bar dataKey={String(compareYear)} fill={COLOR_COMPARE} radius={[3, 3, 0, 0]} maxBarSize={40} />}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
