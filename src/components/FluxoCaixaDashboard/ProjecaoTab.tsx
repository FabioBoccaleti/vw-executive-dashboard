/**
 * ProjecaoTab — Projeção de Caixa e Resultado do Exercício
 *
 * Usa os balancetes já importados como base histórica e projeta os meses
 * restantes do ano com base em premissas de ajuste percentual por categoria.
 *
 * Sub-abas:
 *  1. Resultado do Exercício (DRE mensal realizado + projetado)
 *  2. Saldo de Caixa (disponibilidades mês a mês)
 */

import { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { kvGet, kvSet } from '@/lib/kvClient';
import { Save, TrendingUp, TrendingDown, Info } from 'lucide-react';

// ─── Constantes ────────────────────────────────────────────────────────────────

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ProjecaoPremissas {
  receitas: number;       // % ajuste (-100 a +200)
  cmv: number;
  despesasOper: number;
  rendimentos: number;
}

interface MonthRow {
  month: number;
  label: string;
  recLiquida: number;
  cmv: number;
  despOper: number;
  rendimentos: number;
  ir: number;
  resultLiq: number;
  resultAcum: number;
  saldoCaixa: number;
  varCaixa: number;
  isProjected: boolean;
}

interface Props {
  allMonthsAccounts: Array<Record<string, any>>;
  selectedYear: number;
  selectedMonth: number;
  fmtBRL: (v: number, compact?: boolean) => string;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const DEFAULT_PREM: ProjecaoPremissas = { receitas: 0, cmv: 0, despesasOper: 0, rendimentos: 0 };
const premKey = (year: number) => `projecao_premissas_${year}`;

async function loadPremissas(year: number): Promise<ProjecaoPremissas> {
  try {
    const data = await kvGet<ProjecaoPremissas>(premKey(year));
    return data ?? DEFAULT_PREM;
  } catch { return DEFAULT_PREM; }
}

async function savePremissas(year: number, p: ProjecaoPremissas): Promise<void> {
  try { await kvSet(premKey(year), p); } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function absMov(accounts: Record<string, any>, id: string): number {
  const a = accounts[id];
  if (!a) return 0;
  return Math.abs((a.valDeb || 0) - (a.valCred || 0));
}

function fmtPct(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(0) + '%';
}

function extractMonthData(accounts: Record<string, any>, month: number, yr2: string) {
  const recBruta   = absMov(accounts, '3.1');
  const devolucoes = absMov(accounts, '3.3');
  const impostosV  = absMov(accounts, '3.2');
  const recLiquida = recBruta - devolucoes - impostosV;
  const cmv        = absMov(accounts, '4');
  const despOper   = absMov(accounts, '5');
  const rendOper   = absMov(accounts, '3.4');
  const rendFinanc = absMov(accounts, '3.5');
  const rendNOper  = absMov(accounts, '3.6');
  const rendimentos = rendOper + rendFinanc + rendNOper;
  const ir         = absMov(accounts, '6');
  const resultLiq  = recLiquida - cmv - despOper + rendimentos - ir;
  const saldoCaixa = Math.abs(accounts['1.1.1']?.saldoAtual || 0);
  return { month, label: `${MONTH_SHORT[month - 1]}/${yr2}`, recLiquida, cmv, despOper, rendimentos, ir, resultLiq, saldoCaixa };
}

// ─── Tooltip customizado ──────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, fmtBRL }: any) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p: any) => p.value !== undefined && p.value !== null);
  return (
    <div className="bg-white dark:bg-slate-800 border border-border rounded-lg shadow-xl p-3 text-xs min-w-[200px]">
      <p className="font-bold text-foreground mb-2">{label}</p>
      {items.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4 mb-0.5">
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-mono font-semibold" style={{ color: p.color }}>
            {typeof p.value === 'number' ? (p.value >= 0 ? '+' : '') + fmtBRL(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Slider row ───────────────────────────────────────────────────────────────

function PremissaRow({
  label, icon, value, onChange,
}: {
  label: string; icon: string; value: number; onChange: (v: number) => void;
}) {
  const color = value > 0 ? 'text-emerald-600 dark:text-emerald-400'
              : value < 0 ? 'text-red-600 dark:text-red-400'
              : 'text-muted-foreground';
  return (
    <div className="flex items-center gap-3">
      <span className="text-base w-5 flex-shrink-0">{icon}</span>
      <span className="text-xs text-foreground w-36 flex-shrink-0">{label}</span>
      <input
        type="range"
        min={-50}
        max={100}
        step={5}
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-green-600"
      />
      <span className={cn('text-xs font-mono font-bold w-12 text-right flex-shrink-0', color)}>
        {fmtPct(value)}
      </span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ProjecaoTab({ allMonthsAccounts, selectedYear, selectedMonth, fmtBRL }: Props) {
  const [premissas, setPremissas] = useState<ProjecaoPremissas>(DEFAULT_PREM);
  const [savedPremissas, setSavedPremissas] = useState<ProjecaoPremissas>(DEFAULT_PREM);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [subTab, setSubTab] = useState<'resultado' | 'caixa'>('resultado');

  const yr2 = String(selectedYear).slice(2);

  // Carrega premissas do KV ao montar
  useEffect(() => {
    loadPremissas(selectedYear).then(p => {
      setPremissas(p);
      setSavedPremissas(p);
    });
  }, [selectedYear]);

  const isDirty = JSON.stringify(premissas) !== JSON.stringify(savedPremissas);

  const handleSave = async () => {
    setSaving(true);
    await savePremissas(selectedYear, premissas);
    setSavedPremissas(premissas);
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2500);
  };

  // ── Extrai dados realizados de allMonthsAccounts ──────────────────────────
  const realizados = useMemo(() => {
    return allMonthsAccounts
      .map((acc, i) => extractMonthData(acc, i + 1, yr2))
      .filter(d => Object.keys(allMonthsAccounts[d.month - 1] || {}).length > 5);
  }, [allMonthsAccounts, yr2]);

  // ── Calcula dados completos (realizados + projetados) ─────────────────────
  const allData: MonthRow[] = useMemo(() => {
    if (realizados.length === 0) return [];

    const n = realizados.length;

    // Médias dos meses realizados
    const avg = (fn: (d: typeof realizados[0]) => number) =>
      realizados.reduce((s, d) => s + fn(d), 0) / n;

    const avgRecLiquida = avg(d => d.recLiquida);
    const avgCMV        = avg(d => d.cmv);
    const avgDespOper   = avg(d => d.despOper);
    const avgRendimentos = avg(d => d.rendimentos);
    const avgIR         = avg(d => d.ir);

    // Variação média mensal de caixa (para projeção de saldo)
    const lastSaldo = realizados[n - 1].saldoCaixa;
    const avgVarCaixa = n > 1
      ? (realizados[n - 1].saldoCaixa - realizados[0].saldoCaixa) / (n - 1)
      : 0;

    const rows: MonthRow[] = [];

    // Meses realizados
    for (let i = 0; i < realizados.length; i++) {
      const d = realizados[i];
      rows.push({
        ...d,
        resultAcum: 0,
        varCaixa: i === 0 ? 0 : d.saldoCaixa - realizados[i - 1].saldoCaixa,
        isProjected: false,
      });
    }

    // Meses projetados
    const lastRealMonth = realizados[n - 1].month;
    let prevSaldo = lastSaldo;

    const mult = (pct: number) => 1 + pct / 100;

    for (let m = lastRealMonth + 1; m <= 12; m++) {
      const recLiquida  = avgRecLiquida  * mult(premissas.receitas);
      const cmv         = avgCMV         * mult(premissas.cmv);
      const despOper    = avgDespOper    * mult(premissas.despesasOper);
      const rendimentos = avgRendimentos * mult(premissas.rendimentos);
      const ir          = avgIR;
      const resultLiq   = recLiquida - cmv - despOper + rendimentos - ir;

      // Projeção do caixa: variação histórica ajustada pelo crescimento de receitas
      const varCaixa = avgVarCaixa * mult(premissas.receitas * 0.5 + premissas.despesasOper * (-0.3));
      const saldoCaixa = Math.max(0, prevSaldo + varCaixa);
      prevSaldo = saldoCaixa;

      rows.push({
        month: m,
        label: `${MONTH_SHORT[m - 1]}/${yr2}`,
        recLiquida, cmv, despOper, rendimentos, ir, resultLiq,
        resultAcum: 0,
        saldoCaixa, varCaixa,
        isProjected: true,
      });
    }

    // Preenche resultAcum
    let acum = 0;
    for (const r of rows) {
      acum += r.resultLiq;
      r.resultAcum = acum;
    }

    return rows;
  }, [realizados, premissas, yr2]);

  // ── Métricas de resumo ────────────────────────────────────────────────────
  const totalRealResult = realizados.reduce((s, d) => s + d.resultLiq, 0);
  const totalProjResult = allData.filter(d => d.isProjected).reduce((s, d) => s + d.resultLiq, 0);
  const totalAnoResult  = totalRealResult + totalProjResult;
  const lastSaldoReal   = realizados.at(-1)?.saldoCaixa ?? 0;
  const lastSaldoProj   = allData.filter(d => d.isProjected).at(-1)?.saldoCaixa ?? lastSaldoReal;

  // ── Ponto de divisão realizado/projetado ──────────────────────────────────
  const splitLabel = allData.find(d => d.isProjected)?.label ?? null;

  // ── Dados do gráfico ──────────────────────────────────────────────────────
  const chartData = allData.map(d => ({
    label: d.label,
    resultReal:  !d.isProjected ? d.resultLiq  : undefined,
    resultProj:   d.isProjected ? d.resultLiq  : undefined,
    acumLinha:    d.resultAcum,
    saldoReal:   !d.isProjected ? d.saldoCaixa : undefined,
    saldoProj:    d.isProjected ? d.saldoCaixa : undefined,
    varCaixaReal:!d.isProjected ? d.varCaixa   : undefined,
    varCaixaProj: d.isProjected ? d.varCaixa   : undefined,
  }));

  // ── Estado vazio ──────────────────────────────────────────────────────────
  if (realizados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <div className="text-5xl">📊</div>
        <p className="text-base font-semibold">Nenhum dado realizado disponível</p>
        <p className="text-sm text-center max-w-sm">
          Importe balancetes do ano {selectedYear} para habilitar a projeção automática.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Painel de Premissas ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              ⚙️ Premissas de Projeção
              <span className="text-xs font-normal text-muted-foreground">
                — base: média dos {realizados.length} {realizados.length === 1 ? 'mês realizado' : 'meses realizados'} ({realizados[0].label} a {realizados.at(-1)!.label})
              </span>
            </CardTitle>
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all',
                savedOk
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400'
                  : isDirty
                    ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700'
                    : 'bg-muted/40 text-muted-foreground border-border cursor-not-allowed'
              )}
            >
              <Save className="w-3.5 h-3.5" />
              {savedOk ? 'Salvo ✓' : saving ? 'Salvando…' : 'Salvar Premissas'}
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <PremissaRow
            label="Receitas"
            icon="💰"
            value={premissas.receitas}
            onChange={v => setPremissas(p => ({ ...p, receitas: v }))}
          />
          <PremissaRow
            label="CMV / Custo de Vendas"
            icon="📦"
            value={premissas.cmv}
            onChange={v => setPremissas(p => ({ ...p, cmv: v }))}
          />
          <PremissaRow
            label="Despesas Operacionais"
            icon="📋"
            value={premissas.despesasOper}
            onChange={v => setPremissas(p => ({ ...p, despesasOper: v }))}
          />
          <PremissaRow
            label="Rendimentos / Outros"
            icon="📈"
            value={premissas.rendimentos}
            onChange={v => setPremissas(p => ({ ...p, rendimentos: v }))}
          />
          <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1 pt-1">
            <Info className="w-3 h-3" />
            Os ajustes são aplicados sobre a média mensal dos meses realizados. Meses projetados: {12 - realizados.at(-1)!.month} ({allData.filter(d => d.isProjected).map(d => d.label).join(', ')}).
          </p>
        </CardContent>
      </Card>

      {/* ── KPIs de resumo ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Resultado Realizado',
            value: totalRealResult,
            sub: `${realizados.length} ${realizados.length === 1 ? 'mês' : 'meses'} importados`,
            icon: '📊', badge: 'Realizado',
          },
          {
            label: 'Resultado Projetado',
            value: totalProjResult,
            sub: `${12 - realizados.at(-1)!.month} meses restantes`,
            icon: '🔮', badge: 'Projetado',
          },
          {
            label: 'Resultado do Exercício',
            value: totalAnoResult,
            sub: `Ano ${selectedYear} completo`,
            icon: '🏁', badge: 'Total',
          },
          {
            label: subTab === 'caixa' ? 'Saldo Final Projetado' : 'Saldo Caixa Atual',
            value: subTab === 'caixa' ? lastSaldoProj : lastSaldoReal,
            sub: subTab === 'caixa'
              ? `Dez/${yr2} projetado`
              : `${realizados.at(-1)!.label} realizado`,
            icon: '💵', badge: 'Caixa',
          },
        ].map((k, i) => (
          <Card key={i} className={cn(
            'border-l-4',
            k.value >= 0
              ? 'border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/10'
              : 'border-l-red-500 bg-red-50/40 dark:bg-red-950/10',
          )}>
            <CardContent className="pt-4 pb-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {k.icon} {k.label}
              </div>
              <div className={cn(
                'text-lg font-bold font-mono',
                k.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
              )}>
                {k.value > 0 ? '+' : k.value < 0 ? '−' : ''}{fmtBRL(k.value, true)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Sub-abas ── */}
      <div className="flex gap-2">
        {[
          { id: 'resultado' as const, label: '📊 Resultado do Exercício' },
          { id: 'caixa' as const, label: '💵 Saldo de Caixa' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-semibold rounded-lg border transition-colors',
              subTab === t.id
                ? 'bg-green-700 text-white border-green-600'
                : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted/70',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Gráfico ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {subTab === 'resultado' ? '📊 Resultado Mensal + Acumulado' : '💵 Saldo de Caixa Mês a Mês'}
            <span className="text-xs font-normal text-muted-foreground">Jan–Dez/{yr2}</span>
          </CardTitle>
          <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
              Realizado
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-400 inline-block opacity-70" />
              Projetado
            </span>
            <span className="flex items-center gap-1">
              <span className="w-6 h-0.5 bg-violet-500 inline-block" />
              Acumulado
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={v => {
                  const abs = Math.abs(v);
                  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
                  if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
                  return String(v);
                }}
                width={52}
              />
              <Tooltip content={<ChartTooltip fmtBRL={fmtBRL} />} />
              {splitLabel && (
                <ReferenceLine
                  x={splitLabel}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 2"
                  opacity={0.5}
                  label={{ value: '◀ Real | Proj ▶', position: 'insideTopLeft', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                />
              )}

              {subTab === 'resultado' ? (
                <>
                  <Bar dataKey="resultReal" name="Resultado (real)" radius={[3, 3, 0, 0]} maxBarSize={28}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={(d.resultReal ?? 0) >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                  <Bar dataKey="resultProj" name="Resultado (proj.)" radius={[3, 3, 0, 0]} maxBarSize={28} opacity={0.65}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={(d.resultProj ?? 0) >= 0 ? '#60a5fa' : '#fbbf24'} />
                    ))}
                  </Bar>
                  <Line
                    dataKey="acumLinha"
                    name="Acumulado"
                    type="monotone"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#8b5cf6' }}
                    connectNulls
                  />
                </>
              ) : (
                <>
                  <Bar dataKey="saldoReal" name="Saldo caixa (real)" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="saldoProj" name="Saldo caixa (proj.)" fill="#60a5fa" radius={[3, 3, 0, 0]} maxBarSize={28} opacity={0.65} />
                  <Line
                    dataKey="saldoProj"
                    name="Tendência"
                    type="monotone"
                    stroke="#8b5cf6"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    connectNulls
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Tabela detalhada ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {subTab === 'resultado'
              ? '📋 DRE Projetado — Detalhamento Mensal'
              : '💵 Posição de Caixa — Detalhamento Mensal'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            {subTab === 'resultado' ? (
              <table className="w-full border-collapse text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="py-2 px-3 text-left font-semibold uppercase tracking-wider text-muted-foreground">Mês</th>
                    <th className="py-2 px-3 text-right font-semibold uppercase tracking-wider text-muted-foreground">Rec. Líq.</th>
                    <th className="py-2 px-3 text-right font-semibold uppercase tracking-wider text-muted-foreground">CMV</th>
                    <th className="py-2 px-3 text-right font-semibold uppercase tracking-wider text-muted-foreground">Desp. Op.</th>
                    <th className="py-2 px-3 text-right font-semibold uppercase tracking-wider text-muted-foreground">Outros</th>
                    <th className="py-2 px-3 text-right font-semibold uppercase tracking-wider text-muted-foreground">Resultado Mês</th>
                    <th className="py-2 px-3 text-right font-semibold uppercase tracking-wider text-muted-foreground">Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {allData.map((d, i) => (
                    <tr
                      key={i}
                      className={cn(
                        'border-b border-border/40',
                        d.isProjected
                          ? 'bg-blue-50/40 dark:bg-blue-950/10'
                          : 'hover:bg-muted/30',
                      )}
                    >
                      <td className="py-2 px-3 font-medium text-foreground flex items-center gap-1.5">
                        {d.label}
                        {d.isProjected && (
                          <span className="text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded font-semibold">PROJ</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">{fmtBRL(d.recLiquida)}</td>
                      <td className="py-2 px-3 text-right font-mono text-red-600/80">({fmtBRL(d.cmv)})</td>
                      <td className="py-2 px-3 text-right font-mono text-red-600/80">({fmtBRL(d.despOper)})</td>
                      <td className={cn('py-2 px-3 text-right font-mono', d.rendimentos - d.ir >= 0 ? 'text-emerald-600/80' : 'text-red-600/80')}>
                        {d.rendimentos - d.ir >= 0 ? '+' : ''}{fmtBRL(d.rendimentos - d.ir)}
                      </td>
                      <td className={cn('py-2 px-3 text-right font-mono font-bold', d.resultLiq >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                        {d.resultLiq >= 0 ? '+' : '−'}{fmtBRL(Math.abs(d.resultLiq))}
                      </td>
                      <td className={cn('py-2 px-3 text-right font-mono font-semibold', d.resultAcum >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400')}>
                        {d.resultAcum >= 0 ? '+' : '−'}{fmtBRL(Math.abs(d.resultAcum))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/60 border-t-2 border-border font-bold">
                    <td className="py-2.5 px-3 text-sm text-foreground">TOTAL {selectedYear}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{fmtBRL(allData.reduce((s, d) => s + d.recLiquida, 0))}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-red-600/80">({fmtBRL(allData.reduce((s, d) => s + d.cmv, 0))})</td>
                    <td className="py-2.5 px-3 text-right font-mono text-red-600/80">({fmtBRL(allData.reduce((s, d) => s + d.despOper, 0))})</td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{fmtBRL(allData.reduce((s, d) => s + d.rendimentos - d.ir, 0))}</td>
                    <td className={cn('py-2.5 px-3 text-right font-mono text-sm', totalAnoResult >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                      {totalAnoResult >= 0 ? '+' : '−'}{fmtBRL(Math.abs(totalAnoResult))}
                    </td>
                    <td className={cn('py-2.5 px-3 text-right font-mono text-sm', totalAnoResult >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400')}>
                      {totalAnoResult >= 0 ? '+' : '−'}{fmtBRL(Math.abs(totalAnoResult))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="py-2 px-3 text-left font-semibold uppercase tracking-wider text-muted-foreground">Mês</th>
                    <th className="py-2 px-3 text-right font-semibold uppercase tracking-wider text-muted-foreground">Saldo de Caixa</th>
                    <th className="py-2 px-3 text-right font-semibold uppercase tracking-wider text-muted-foreground">Variação no Mês</th>
                    <th className="py-2 px-3 text-right font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allData.map((d, i) => (
                    <tr
                      key={i}
                      className={cn(
                        'border-b border-border/40',
                        d.isProjected ? 'bg-blue-50/40 dark:bg-blue-950/10' : 'hover:bg-muted/30',
                      )}
                    >
                      <td className="py-2 px-3 font-medium text-foreground flex items-center gap-1.5">
                        {d.label}
                        {d.isProjected && (
                          <span className="text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded font-semibold">PROJ</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-foreground">
                        {fmtBRL(d.saldoCaixa)}
                      </td>
                      <td className={cn('py-2 px-3 text-right font-mono', d.varCaixa >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                        {i === 0 ? '—' : (d.varCaixa >= 0 ? '+' : '−') + fmtBRL(Math.abs(d.varCaixa))}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={cn(
                          'text-[9px] px-1.5 py-0.5 rounded font-semibold',
                          d.isProjected
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                            : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400',
                        )}>
                          {d.isProjected ? 'PROJETADO' : 'REALIZADO'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/60 border-t-2 border-border font-bold">
                    <td className="py-2.5 px-3 text-sm text-foreground">Saldo Final Dez/{yr2}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm text-foreground">{fmtBRL(lastSaldoProj)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                      {fmtBRL(lastSaldoProj - (allData[0]?.saldoCaixa ?? 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Nota de rodapé */}
      <p className="text-[10px] text-muted-foreground/60 leading-relaxed px-1">
        * Projeção baseada na média dos {realizados.length} {realizados.length === 1 ? 'mês' : 'meses'} realizados do exercício {selectedYear},
        ajustada pelas premissas configuradas. O saldo de caixa projetado usa a variação histórica média ajustada.
        Valores projetados são estimativas — não constituem demonstrações contábeis.
      </p>
    </div>
  );
}
