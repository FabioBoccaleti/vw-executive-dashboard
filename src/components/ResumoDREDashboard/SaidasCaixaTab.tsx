/**
 * SaidasCaixaTab — Saídas de Caixa (Resumo DRE)
 *
 * Exibe o quanto saiu do caixa com pagamento de dívidas:
 *  - Parcelamento Refis  (contas 2.1.2.02.07.020 + 2.2.1.08.01.020)
 *  - Mútuo Sócios        (grupo 2.2.1.01.01 e sub-contas)
 *
 * Dados carregados diretamente do KV do FluxoCaixa (mesma fonte).
 */

import { useState, useEffect } from 'react';
import { Loader2, TrendingDown, AlertCircle, Calendar } from 'lucide-react';
import { loadFluxoCaixaRaw, loadMultipleMonthsRaw } from '@/components/FluxoCaixaDashboard/fluxoCaixaStorage';

// ─── Contas ────────────────────────────────────────────────────────────────────
const REFIS_CP  = '2.1.2.02.07.020';
const REFIS_LP  = '2.2.1.08.01.020';
const MUTUO_GRP = '2.2.1.01.01';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function parseNum(v: string): number {
  return parseFloat((v || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
}

function fmtBRL(v: number, compact = false): string {
  const abs = Math.abs(v);
  if (compact) {
    if (abs >= 1_000_000) return `R$ ${(abs / 1_000_000).toFixed(2).replace('.', ',')}M`;
    if (abs >= 1_000)     return `R$ ${(abs / 1_000).toFixed(1).replace('.', ',')}K`;
  }
  return 'R$ ' + abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

const MONTH_NAMES: Record<number, string> = {
  1:'Jan',2:'Fev',3:'Mar',4:'Abr',5:'Mai',6:'Jun',
  7:'Jul',8:'Ago',9:'Set',10:'Out',11:'Nov',12:'Dez',
};
const MONTH_FULL: Record<number, string> = {
  1:'Janeiro',2:'Fevereiro',3:'Março',4:'Abril',5:'Maio',6:'Junho',
  7:'Julho',8:'Agosto',9:'Setembro',10:'Outubro',11:'Novembro',12:'Dezembro',
};

// ─── Parser balancete ──────────────────────────────────────────────────────────
interface Acc { saldoAnt: number; saldoAtual: number; valDeb: number; valCred: number; desc: string }

function parseRaw(rawText: string): Record<string, Acc> {
  const accounts: Record<string, Acc> = {};
  for (const line of rawText.split('\n')) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, desc, saldoAnt, valDeb, valCred, saldoAtual] = parts;
    if (nivel?.trim() === 'T') continue;
    const id = conta?.trim();
    if (!id) continue;
    accounts[id] = {
      saldoAnt:   parseNum(saldoAnt),
      valDeb:     parseNum(valDeb),
      valCred:    parseNum(valCred),
      saldoAtual: parseNum(saldoAtual),
      desc:       desc?.trim() ?? '',
    };
  }
  return accounts;
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
}

// ─── Sub-contas folha de um grupo ──────────────────────────────────────────────
function leafSubs(accounts: Record<string, Acc>, prefix: string) {
  const all = Object.keys(accounts).filter(k => k.startsWith(prefix + '.'));
  return all.filter(k => !all.some(o => o !== k && o.startsWith(k + '.'))).sort();
}

// ─── Estimativa de quitação ────────────────────────────────────────────────────
function estimatePayoff(
  saldoAtual: number,
  avgMonthlyAmort: number,
  currentYear: number,
  currentMonth: number,
): string {
  if (avgMonthlyAmort <= 0 || saldoAtual <= 0) return '—';
  const monthsLeft = Math.ceil(saldoAtual / avgMonthlyAmort);
  let y = currentYear;
  let m = currentMonth + monthsLeft;
  while (m > 12) { m -= 12; y++; }
  if (y > currentYear + 10) return '> 10 anos';
  return `${MONTH_NAMES[m]}/${String(y).slice(2)}`;
}

// ─── Componente de barra de progresso ─────────────────────────────────────────
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
      <div
        className="h-3 rounded-full transition-all duration-500"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

// ─── Tipos de dados ────────────────────────────────────────────────────────────
interface RefisData {
  saldoAnt: number; // mês anterior
  saldoAtual: number;
  saldoInicioAno: number;
  cpDesc: string;
  cpAnt: number; cpAtu: number;
  lpAnt: number; lpAtu: number;
}

interface MutuoData {
  saldoAnt: number;
  saldoAtual: number;
  saldoInicioAno: number;
  subs: Array<{ conta: string; desc: string; ant: number; atu: number }>;
}

interface PageData {
  refis: RefisData;
  mutuo: MutuoData;
  avgRefisMonthly: number;  // média mensal de amortização no ano
  avgMutuoMonthly: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  year: number;
  month: number; // 0 = anual; 1-12 = mês específico
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function SaidasCaixaTab({ year, month }: Props) {
  const [data,    setData]    = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    async function load() {
      try {
        // Mês efetivo para "atual" — se anual, usa dezembro
        const effectiveMonth = month === 0 ? 12 : month;

        // Mês anterior (para coluna "ant")
        const prevMonth = effectiveMonth === 1 ? 12 : effectiveMonth - 1;
        const prevYear  = effectiveMonth === 1 ? year - 1 : year;

        // Carregar mês atual, mês anterior e Janeiro (para amortização YTD)
        const [currentRaw, prevRaw, janRaw] = await Promise.all([
          loadFluxoCaixaRaw(year, effectiveMonth),
          loadFluxoCaixaRaw(prevYear, prevMonth),
          effectiveMonth > 1 ? loadFluxoCaixaRaw(year, 1) : Promise.resolve(null),
        ]);

        if (!currentRaw?.rawText) {
          if (!cancelled) { setData(null); setLoading(false); }
          return;
        }

        const curr = parseRaw(currentRaw.rawText);
        const prev = prevRaw?.rawText ? parseRaw(prevRaw.rawText) : null;
        const jan  = janRaw?.rawText  ? parseRaw(janRaw.rawText)  : null;

        const getC = (id: string): Acc => curr[id] ?? { saldoAnt: 0, saldoAtual: 0, valDeb: 0, valCred: 0, desc: '' };
        const getP = (id: string): number => prev ? Math.abs(prev[id]?.saldoAtual ?? 0) : Math.abs(getC(id).saldoAnt);

        // ── Refis ────────────────────────────────────────────────────────────
        const cpAtu = Math.abs(getC(REFIS_CP).saldoAtual);
        const lpAtu = Math.abs(getC(REFIS_LP).saldoAtual);
        const cpAnt = getP(REFIS_CP);
        const lpAnt = getP(REFIS_LP);

        // Saldo início do ano: saldoAnt de Janeiro (ou saldoAnt do mês atual se jan=1)
        let refisInicioAno: number;
        if (effectiveMonth === 1) {
          refisInicioAno = Math.abs(getC(REFIS_CP).saldoAnt) + Math.abs(getC(REFIS_LP).saldoAnt);
        } else if (jan) {
          refisInicioAno = Math.abs(jan[REFIS_CP]?.saldoAnt ?? 0) + Math.abs(jan[REFIS_LP]?.saldoAnt ?? 0);
        } else {
          refisInicioAno = cpAnt + lpAnt;
        }

        const cpDesc = getC(REFIS_CP).desc || getC(REFIS_LP).desc || 'Parcelamento Impostos E Contrib.Federais';

        const refis: RefisData = {
          saldoAnt: cpAnt + lpAnt,
          saldoAtual: cpAtu + lpAtu,
          saldoInicioAno: refisInicioAno,
          cpDesc: toTitleCase(cpDesc),
          cpAnt, cpAtu, lpAnt, lpAtu,
        };

        // ── Mútuo Sócios ──────────────────────────────────────────────────────
        const grpAtu = Math.abs(getC(MUTUO_GRP).saldoAtual);
        const grpAnt = getP(MUTUO_GRP);

        let mutuoInicioAno: number;
        if (effectiveMonth === 1) {
          mutuoInicioAno = Math.abs(getC(MUTUO_GRP).saldoAnt);
        } else if (jan) {
          mutuoInicioAno = Math.abs(jan[MUTUO_GRP]?.saldoAnt ?? 0);
        } else {
          mutuoInicioAno = grpAnt;
        }

        const subIds = leafSubs(curr, MUTUO_GRP);
        const subs = subIds.map(id => ({
          conta: id,
          desc: toTitleCase(getC(id).desc || id),
          ant: getP(id),
          atu: Math.abs(getC(id).saldoAtual),
        })).filter(s => s.ant > 0 || s.atu > 0);

        const mutuo: MutuoData = {
          saldoAnt: grpAnt,
          saldoAtual: grpAtu,
          saldoInicioAno: mutuoInicioAno,
          subs,
        };

        // ── Média mensal de amortização (todos os meses do ano até agora) ─────
        let avgRefisMonthly = 0;
        let avgMutuoMonthly = 0;

        if (effectiveMonth >= 2) {
          const months = Array.from({ length: effectiveMonth }, (_, i) => i + 1);
          const rawMap = await loadMultipleMonthsRaw(year, months);

          let prevRefisSaldo = refisInicioAno;
          let prevMutuoSaldo = mutuoInicioAno;
          let totalRefisAmort = 0;
          let totalMutuoAmort = 0;
          let countMonths = 0;

          for (const m of months) {
            const raw = rawMap[m];
            if (!raw) continue;
            const acc = parseRaw(raw);
            const rSaldo = Math.abs(acc[REFIS_CP]?.saldoAtual ?? 0) + Math.abs(acc[REFIS_LP]?.saldoAtual ?? 0);
            const mSaldo = Math.abs(acc[MUTUO_GRP]?.saldoAtual ?? 0);
            // Início: saldoAnt de Janeiro
            const rStart = m === 1
              ? Math.abs(acc[REFIS_CP]?.saldoAnt ?? 0) + Math.abs(acc[REFIS_LP]?.saldoAnt ?? 0)
              : prevRefisSaldo;
            const mStart = m === 1 ? Math.abs(acc[MUTUO_GRP]?.saldoAnt ?? 0) : prevMutuoSaldo;
            totalRefisAmort += Math.max(0, rStart - rSaldo);
            totalMutuoAmort += Math.max(0, mStart - mSaldo);
            prevRefisSaldo = rSaldo;
            prevMutuoSaldo = mSaldo;
            countMonths++;
          }

          if (countMonths > 0) {
            avgRefisMonthly = totalRefisAmort / countMonths;
            avgMutuoMonthly = totalMutuoAmort / countMonths;
          }
        } else {
          // Só 1 mês: usa amortização do mês atual
          avgRefisMonthly = Math.max(0, refisInicioAno - refis.saldoAtual);
          avgMutuoMonthly = Math.max(0, mutuoInicioAno - mutuo.saldoAtual);
        }

        if (!cancelled) {
          setData({ refis, mutuo, avgRefisMonthly, avgMutuoMonthly });
          setLoading(false);
        }
      } catch (err) {
        console.error('SaidasCaixaTab: erro ao carregar dados', err);
        if (!cancelled) { setError('Erro ao carregar dados.'); setLoading(false); }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [year, month]);

  // ── Labels dinâmicos ─────────────────────────────────────────────────────────
  const effectiveMonth = month === 0 ? 12 : month;
  const prevMonth  = effectiveMonth === 1 ? 12 : effectiveMonth - 1;
  const prevYear   = effectiveMonth === 1 ? year - 1 : year;
  const yr2        = String(year).slice(2);
  const colAtual   = month === 0 ? String(year) : `${MONTH_NAMES[effectiveMonth]}/${yr2}`;
  const colAnterior = month === 0
    ? String(year - 1)
    : effectiveMonth === 1
      ? `Dez/${String(year - 1).slice(2)}`
      : `${MONTH_NAMES[prevMonth]}/${String(prevYear).slice(2)}`;
  const amortLabel = month === 0
    ? `Anual ${year}`
    : effectiveMonth === 1
      ? `Jan/${yr2}`
      : `Jan–${MONTH_NAMES[effectiveMonth]}/${yr2}`;

  // ── Estados de carregamento / erro ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-500 text-sm">Carregando dados...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-red-500">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 flex flex-col items-center gap-4 max-w-sm text-center">
          <AlertCircle className="w-10 h-10 text-slate-300" />
          <h2 className="text-base font-semibold text-slate-600">Sem dados para {colAtual}</h2>
          <p className="text-sm text-slate-400">
            Importe o balancete correspondente no Fluxo de Caixa para visualizar as saídas de caixa.
          </p>
        </div>
      </div>
    );
  }

  const { refis, mutuo, avgRefisMonthly, avgMutuoMonthly } = data;

  // Variações
  const refisVar      = refis.saldoAtual   - refis.saldoAnt;
  const mutuoVar      = mutuo.saldoAtual   - mutuo.saldoAnt;
  const refisAmortMes = Math.max(0, refis.saldoAnt   - refis.saldoAtual);
  const mutuoAmortMes = Math.max(0, mutuo.saldoAnt   - mutuo.saldoAtual);
  const refisAmortAno = Math.max(0, refis.saldoInicioAno  - refis.saldoAtual);
  const mutuoAmortAno = Math.max(0, mutuo.saldoInicioAno  - mutuo.saldoAtual);

  const totalSaldoAtual   = refis.saldoAtual + mutuo.saldoAtual;
  const totalAmortMes     = refisAmortMes + mutuoAmortMes;
  const totalAmortAno     = refisAmortAno + mutuoAmortAno;

  // Progresso no ano
  const refisPctAno = refis.saldoInicioAno > 0 ? (refisAmortAno / refis.saldoInicioAno) * 100 : 0;
  const mutuoPctAno = mutuo.saldoInicioAno > 0 ? (mutuoAmortAno / mutuo.saldoInicioAno) * 100 : 0;

  // Estimativa de quitação
  const refisPayoff = estimatePayoff(refis.saldoAtual, avgRefisMonthly, year, effectiveMonth);
  const mutuoPayoff = estimatePayoff(mutuo.saldoAtual, avgMutuoMonthly, year, effectiveMonth);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* ── KPIs unificados ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard
            label={`Saído no mês (${colAtual})`}
            value={fmtBRL(totalAmortMes, true)}
            sub={`Refis: ${fmtBRL(refisAmortMes, true)} · Mútuo: ${fmtBRL(mutuoAmortMes, true)}`}
            color="#0f766e"
            icon={<TrendingDown className="w-4 h-4" />}
          />
          <KPICard
            label={`Saído no ano (${amortLabel})`}
            value={fmtBRL(totalAmortAno, true)}
            sub={`Refis: ${fmtBRL(refisAmortAno, true)} · Mútuo: ${fmtBRL(mutuoAmortAno, true)}`}
            color="#0284c7"
            icon={<TrendingDown className="w-4 h-4" />}
          />
          <KPICard
            label="Saldo devedor total"
            value={fmtBRL(totalSaldoAtual, true)}
            sub={`Refis: ${fmtBRL(refis.saldoAtual, true)} · Mútuo: ${fmtBRL(mutuo.saldoAtual, true)}`}
            color="#dc2626"
            icon={<AlertCircle className="w-4 h-4" />}
          />
        </div>

        {/* ── Parcelamento Refis ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">🧾 Parcelamento Refis</h2>
              <p className="text-xs text-slate-400 mt-0.5">Curto + Longo Prazo</p>
            </div>
            {refisPayoff !== '—' && (
              <div className="flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-amber-700">
                <Calendar className="w-3.5 h-3.5" />
                Estimativa de quitação: <strong>{refisPayoff}</strong>
                <span className="text-amber-400 ml-1">({fmtBRL(avgRefisMonthly, true)}/mês)</span>
              </div>
            )}
          </div>

          <div className="px-6 py-4 space-y-5">
            {/* Barra de progresso */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500 font-medium">Amortizado em {year}</span>
                <span className="text-xs font-bold text-emerald-600">{refisPctAno.toFixed(1)}% quitado</span>
              </div>
              <ProgressBar pct={refisPctAno} color="#10b981" />
              <div className="flex justify-between mt-1 text-xs text-slate-400">
                <span>Início do ano: {fmtBRL(refis.saldoInicioAno, true)}</span>
                <span>Atual: {fmtBRL(refis.saldoAtual, true)}</span>
              </div>
            </div>

            {/* Tabela de detalhe */}
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4 text-left">Conta / Descrição</th>
                    <th className="py-2.5 px-4 text-right">{colAnterior}</th>
                    <th className="py-2.5 px-4 text-right">{colAtual}</th>
                    <th className="py-2.5 px-4 text-right">Variação R$</th>
                    <th className="py-2.5 px-4 text-right">Var %</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const row = { desc: refis.cpDesc, ant: refis.saldoAnt, atu: refis.saldoAtual };
                    const varR = row.atu - row.ant;
                    const varP = row.ant !== 0 ? (varR / row.ant) * 100 : null;
                    return (
                      <tr className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4 text-slate-700">{row.desc}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-500">{fmtBRL(row.ant)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-800">{fmtBRL(row.atu)}</td>
                        <td className={`py-2.5 px-4 text-right font-mono text-xs ${varR > 0 ? 'text-red-600' : varR < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {varR >= 0 ? '-R$ ' : '+R$ '}{fmtBRL(Math.abs(varR)).replace('R$ ', '')}
                        </td>
                        <td className={`py-2.5 px-4 text-right text-xs font-mono ${varR > 0 ? 'text-red-600' : varR < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {varP !== null ? fmtPct(varP) : '—'}
                        </td>
                      </tr>
                    );
                  })()}
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                    <td className="py-2.5 px-4 text-sm text-slate-800">TOTAL GERAL</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">{fmtBRL(refis.saldoAnt)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-800">{fmtBRL(refis.saldoAtual)}</td>
                    <td className={`py-2.5 px-4 text-right font-mono text-xs ${refisVar > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {refisVar >= 0 ? '-R$ ' : '+R$ '}{fmtBRL(Math.abs(refisVar)).replace('R$ ', '')}
                    </td>
                    <td className={`py-2.5 px-4 text-right text-xs font-mono ${refisVar > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {refis.saldoAnt !== 0 ? fmtPct((refisVar / refis.saldoAnt) * 100) : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tabela de amortização */}
            <div className="rounded-xl border-2 border-emerald-200 overflow-hidden">
              <div className="bg-emerald-50 px-4 py-2.5 border-b border-emerald-200">
                <h3 className="text-sm font-bold text-emerald-800">💳 Amortização no Período — {amortLabel} (Saída de Caixa)</h3>
                <p className="text-xs text-emerald-600 mt-0.5">Saldo início do ano − Saldo atual ({colAtual})</p>
              </div>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-emerald-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4 text-left">Conta / Descrição</th>
                    <th className="py-2.5 px-4 text-right">Saldo Início do Ano</th>
                    <th className="py-2.5 px-4 text-right">Saldo Atual ({colAtual})</th>
                    <th className="py-2.5 px-4 text-right text-emerald-700">Amortizado no Período</th>
                    <th className="py-2.5 px-4 text-right">% Quitado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-emerald-100 hover:bg-emerald-50/30 transition-colors">
                    <td className="py-2.5 px-4 text-slate-700">{refis.cpDesc}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">{fmtBRL(refis.saldoInicioAno)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-800">{fmtBRL(refis.saldoAtual)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-600">
                      {refisAmortAno >= 0 ? '-R$ ' : '+R$ '}{fmtBRL(Math.abs(refisAmortAno)).replace('R$ ', '')}
                    </td>
                    <td className="py-2.5 px-4 text-right text-xs font-mono text-emerald-600">
                      {refis.saldoInicioAno > 0 ? `${refisPctAno.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                  <tr className="bg-emerald-50 border-t-2 border-emerald-200 font-bold">
                    <td className="py-2.5 px-4 text-sm text-slate-800">TOTAL AMORTIZADO</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">{fmtBRL(refis.saldoInicioAno)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-800">{fmtBRL(refis.saldoAtual)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                      {refisAmortAno >= 0 ? '-R$ ' : '+R$ '}{fmtBRL(Math.abs(refisAmortAno)).replace('R$ ', '')}
                    </td>
                    <td className="py-2.5 px-4 text-right text-xs font-mono font-bold text-emerald-600">
                      {refis.saldoInicioAno > 0 ? `${refisPctAno.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Mútuo Sócios ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">👥 Mútuo Sócios</h2>
              <p className="text-xs text-slate-400 mt-0.5">Grupo 2.2.1.01.01</p>
            </div>
            {mutuoPayoff !== '—' && (
              <div className="flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-amber-700">
                <Calendar className="w-3.5 h-3.5" />
                Estimativa de quitação: <strong>{mutuoPayoff}</strong>
                <span className="text-amber-400 ml-1">({fmtBRL(avgMutuoMonthly, true)}/mês)</span>
              </div>
            )}
          </div>

          <div className="px-6 py-4 space-y-5">
            {/* Barra de progresso */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500 font-medium">Amortizado em {year}</span>
                <span className="text-xs font-bold text-emerald-600">{mutuoPctAno.toFixed(1)}% quitado</span>
              </div>
              <ProgressBar pct={mutuoPctAno} color="#10b981" />
              <div className="flex justify-between mt-1 text-xs text-slate-400">
                <span>Início do ano: {fmtBRL(mutuo.saldoInicioAno, true)}</span>
                <span>Atual: {fmtBRL(mutuo.saldoAtual, true)}</span>
              </div>
            </div>

            {/* Tabela sub-contas */}
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4 text-left">Conta / Descrição</th>
                    <th className="py-2.5 px-4 text-right">{colAnterior}</th>
                    <th className="py-2.5 px-4 text-right">{colAtual}</th>
                    <th className="py-2.5 px-4 text-right">Variação R$</th>
                    <th className="py-2.5 px-4 text-right">Var %</th>
                  </tr>
                </thead>
                <tbody>
                  {mutuo.subs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-sm text-slate-400">
                        Nenhuma sub-conta encontrada em {MUTUO_GRP}
                      </td>
                    </tr>
                  ) : (
                    mutuo.subs.map(s => {
                      const varR = s.atu - s.ant;
                      const varP = s.ant !== 0 ? (varR / s.ant) * 100 : null;
                      return (
                        <tr key={s.conta} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4">
                            <span className="text-xs font-mono text-slate-400 mr-2">{s.conta}</span>
                            <span className="text-slate-700">{s.desc}</span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-500">{fmtBRL(s.ant)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-800">{fmtBRL(s.atu)}</td>
                          <td className={`py-2.5 px-4 text-right font-mono text-xs ${varR > 0 ? 'text-red-600' : varR < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {varR >= 0 ? '-R$ ' : '+R$ '}{fmtBRL(Math.abs(varR)).replace('R$ ', '')}
                          </td>
                          <td className={`py-2.5 px-4 text-right text-xs font-mono ${varR > 0 ? 'text-red-600' : varR < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {varP !== null ? fmtPct(varP) : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                    <td className="py-2.5 px-4 text-sm text-slate-800">TOTAL MÚTUO SÓCIOS</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">{fmtBRL(mutuo.saldoAnt)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-800">{fmtBRL(mutuo.saldoAtual)}</td>
                    <td className={`py-2.5 px-4 text-right font-mono text-xs ${mutuoVar > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {mutuoVar >= 0 ? '-R$ ' : '+R$ '}{fmtBRL(Math.abs(mutuoVar)).replace('R$ ', '')}
                    </td>
                    <td className={`py-2.5 px-4 text-right text-xs font-mono ${mutuoVar > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {mutuo.saldoAnt !== 0 ? fmtPct((mutuoVar / mutuo.saldoAnt) * 100) : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tabela de amortização */}
            <div className="rounded-xl border-2 border-emerald-200 overflow-hidden">
              <div className="bg-emerald-50 px-4 py-2.5 border-b border-emerald-200">
                <h3 className="text-sm font-bold text-emerald-800">💳 Amortização no Período — {amortLabel} (Saída de Caixa)</h3>
                <p className="text-xs text-emerald-600 mt-0.5">Saldo início do ano − Saldo atual ({colAtual})</p>
              </div>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-emerald-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4 text-left">Descrição</th>
                    <th className="py-2.5 px-4 text-right">Saldo Início do Ano</th>
                    <th className="py-2.5 px-4 text-right">Saldo Atual ({colAtual})</th>
                    <th className="py-2.5 px-4 text-right text-emerald-700">Amortizado no Período</th>
                    <th className="py-2.5 px-4 text-right">% Quitado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-emerald-50 border-t-2 border-emerald-200 font-bold">
                    <td className="py-2.5 px-4 text-sm text-slate-800">TOTAL MÚTUO SÓCIOS</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">{fmtBRL(mutuo.saldoInicioAno)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-800">{fmtBRL(mutuo.saldoAtual)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                      {mutuoAmortAno >= 0 ? '-R$ ' : '+R$ '}{fmtBRL(Math.abs(mutuoAmortAno)).replace('R$ ', '')}
                    </td>
                    <td className="py-2.5 px-4 text-right text-xs font-mono font-bold text-emerald-600">
                      {mutuo.saldoInicioAno > 0 ? `${mutuoPctAno.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
