/**
 * Evolução mensal das linhas cadastradas para a DRE.
 */

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { loadFluxoCaixaIndex } from './fluxoCaixaStorage';
import {
  calcularLinhas, chavePeriodo, listarLinhasDre,
  type LinhaDemonstracao,
} from './DemonstracoesFinanceiras/modelo';
import { loadCadastroDemonstracoes, loadDadosDemonstracoes } from './DemonstracoesFinanceiras/storage';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  selectedYear: number;
  selectedMonth: number;
  onClose: () => void;
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

async function carregarValoresMensais(linhas: LinhaDemonstracao[], ano: number, ateMes: number) {
  const principal = { ano, mes: ateMes };
  const dados = await loadDadosDemonstracoes(principal, principal, 'dre', true);
  const meses: Record<number, Map<string, number | null>> = {};
  for (let mes = 1; mes <= ateMes; mes++) {
    meses[mes] = calcularLinhas(linhas, 'dre', [dados[chavePeriodo({ ano, mes })] ?? null]);
  }
  return meses;
}

// ─── Formatação ───────────────────────────────────────────────────────────────

const fmtBRL = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `R$ ${v < 0 ? '-' : ''}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `R$ ${v < 0 ? '-' : ''}${(abs / 1e3).toFixed(0)}k`;
  return `R$ ${v < 0 ? '-' : ''}` + abs.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const fmtBRLFull = (v: number) =>
  `R$ ${v < 0 ? '-' : ''}` + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Cores ────────────────────────────────────────────────────────────────────

const COLOR_CURRENT = '#3b82f6';
const COLOR_COMPARE = '#94a3b8';

// ─── Tooltip customizado ──────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => {
        const varKey = `var_${entry.dataKey}`;
        const varPct = entry.payload?.[varKey];
        return (
          <div key={i} className="mb-1 last:mb-0">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-mono font-semibold text-foreground">
                {entry.value === null || entry.value === undefined ? '—' : fmtBRLFull(entry.value)}
              </span>
            </div>
            <div className="ml-5 text-xs">
              {varPct === null || varPct === undefined
                ? <span className="text-muted-foreground/60">Var: —</span>
                : <span className={varPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                    Var: {varPct >= 0 ? '+' : ''}{varPct.toFixed(1)}%
                  </span>
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ResultadoCharts({ selectedYear, selectedMonth, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [cadastroDre, setCadastroDre] = useState<LinhaDemonstracao[] | null>(null);
  const [dadosDre, setDadosDre] = useState<Record<number, Map<string, number | null>>>({});
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [compareMonthlyDRE, setCompareMonthlyDRE] = useState<Record<number, Map<string, number | null>>>({});
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro('');
    Promise.all([loadCadastroDemonstracoes(), loadFluxoCaixaIndex()])
      .then(([cadastro, indice]) => {
        if (!ativo) return;
        setCadastroDre(cadastro.linhas.filter(linha => linha.demonstracao === 'dre'));
        const anos = new Set<number>();
        for (const key of Object.keys(indice)) {
          const ano = Number(key.split('_')[0]);
          if (Number.isInteger(ano) && ano !== selectedYear) anos.add(ano);
        }
        setAvailableYears(Array.from(anos).sort((a, b) => b - a));
      })
      .catch(error => {
        if (ativo) setErro(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => { ativo = false; };
  }, [selectedYear]);

  useEffect(() => {
    if (!cadastroDre) return;
    let ativo = true;
    setLoading(true);
    setErro('');
    setDadosDre({});
    carregarValoresMensais(cadastroDre, selectedYear, selectedMonth === 0 ? 12 : selectedMonth)
      .then(valores => { if (ativo) setDadosDre(valores); })
      .catch(error => { if (ativo) setErro(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [cadastroDre, selectedYear, selectedMonth]);

  useEffect(() => {
    if (!cadastroDre || !compareYear) {
      setCompareMonthlyDRE({});
      return;
    }
    let ativo = true;
    carregarValoresMensais(cadastroDre, compareYear, selectedMonth === 0 ? 12 : selectedMonth)
      .then(valores => { if (ativo) setCompareMonthlyDRE(valores); })
      .catch(error => { if (ativo) setErro(error instanceof Error ? error.message : String(error)); });
    return () => { ativo = false; };
  }, [cadastroDre, compareYear, selectedMonth]);

  const upToMonth = selectedMonth === 0 ? 12 : selectedMonth;
  const months = Array.from({ length: upToMonth }, (_, i) => i + 1);
  const linhas = cadastroDre ? listarLinhasDre(cadastroDre) : [];

  const buildChartData = (linhaId: string) => {
    const curKey = String(selectedYear);
    const cmpKey = compareYear ? String(compareYear) : null;
    return months.map((m, idx) => {
      const curVal = dadosDre[m]?.get(linhaId) ?? null;
      const prevCurVal = idx > 0 ? dadosDre[months[idx - 1]]?.get(linhaId) ?? null : null;
      const varCur = curVal !== null && prevCurVal !== null && prevCurVal !== 0
        ? ((curVal - prevCurVal) / Math.abs(prevCurVal)) * 100
        : null;

      const row: Record<string, string | number | null> = {
        name: MONTH_LABELS[m - 1],
        [curKey]: curVal,
        [`var_${curKey}`]: varCur,
      };

      if (cmpKey) {
        const cmpVal = compareMonthlyDRE[m]?.get(linhaId) ?? null;
        const prevCmpVal = idx > 0 ? compareMonthlyDRE[months[idx - 1]]?.get(linhaId) ?? null : null;
        const varCmp = cmpVal !== null && prevCmpVal !== null && prevCmpVal !== 0
          ? ((cmpVal - prevCmpVal) / Math.abs(prevCmpVal)) * 100
          : null;
        row[cmpKey] = cmpVal;
        row[`var_${cmpKey}`] = varCmp;
      }

      return row;
    });
  };

  const totalPeriodo = (valores: Record<number, Map<string, number | null>>, linhaId: string) => {
    const valoresMeses = months.map(mes => valores[mes]?.get(linhaId) ?? null);
    return valoresMeses.some(valor => valor === null)
      ? null
      : valoresMeses.reduce<number>((total, valor) => total + (valor ?? 0), 0);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Carregando dados...</h3>
          <Button variant="outline" size="sm" onClick={onClose}>Voltar</Button>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Evolução Mensal — Resultado (DRE)</h3>
          <Button variant="outline" size="sm" onClick={onClose}>Voltar</Button>
        </div>
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Evolução Mensal — Resultado (DRE)
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedYear} • Jan{upToMonth > 1 ? ` – ${MONTH_LABELS[upToMonth - 1]}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {availableYears.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Comparar com:</span>
              <select
                className="h-8 px-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={compareYear ?? ''}
                onChange={(e) => setCompareYear(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Nenhum</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Voltar</Button>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {linhas.map(({ linha }) => {
          const chartData = buildChartData(linha.id);
          const periodTotal = totalPeriodo(dadosDre, linha.id);
          const comparePeriodTotal = compareYear
            ? totalPeriodo(compareMonthlyDRE, linha.id)
            : null;
          const hasCurrentValue = months.some(mes => {
            const valor = dadosDre[mes]?.get(linha.id);
            return valor !== null && valor !== undefined && valor !== 0;
          });
          const hasCompareValue = compareYear && months.some(mes => {
            const valor = compareMonthlyDRE[mes]?.get(linha.id);
            return valor !== null && valor !== undefined && valor !== 0;
          });
          if (!hasCurrentValue && !hasCompareValue) return null;

          return (
            <Card key={linha.id}>
              <CardContent className="pt-5 pb-4">
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">{linha.nome}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        Total: {periodTotal === null ? '—' : fmtBRLFull(periodTotal)}
                      </span>
                      {compareYear && comparePeriodTotal !== null && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {compareYear}: {fmtBRLFull(comparePeriodTotal)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} barGap={compareYear ? 2 : 0}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtBRL(v)} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    {compareYear && <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />}
                    <Bar
                      dataKey={String(selectedYear)}
                      fill={COLOR_CURRENT}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={40}
                    />
                    {compareYear && (
                      <Bar
                        dataKey={String(compareYear)}
                        fill={COLOR_COMPARE}
                        radius={[3, 3, 0, 0]}
                        maxBarSize={40}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {linhas.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          Nenhuma linha DRE cadastrada na Emissão de Demonstrações Financeiras.
        </p>
      )}
    </div>
  );
}
