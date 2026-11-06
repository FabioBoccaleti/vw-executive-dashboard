import { useCallback, useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertCircle, Loader2, CalendarRange } from 'lucide-react';
import {
  executarComparativo,
  bucketMonths,
  prevBucket,
  bucketIndexOf,
  bucketAnchorMonth,
  bucketLabel,
  GRAN_ORDENADAS,
  GRAN_LABEL,
  GRAN_BUCKETS_PER_YEAR,
  GRUPO_CONFIG,
  MONTHS_FULL,
  MONTHS_SHORT,
  type ComparativoResultado,
  type ComparativoStorageAdapter,
  type DeptoResultado,
  type Granularidade,
  type GrupoResultado,
  type VariacaoConta,
  type YM,
} from './comparativoPeriodo';

interface Props {
  adapter: ComparativoStorageAdapter;
  /** Cor de destaque da marca (opcional). */
  accent?: string;
}

const DEFAULT_ACCENT = '#be123c';

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function monthKey(ym: YM): string {
  return `${ym.year}-${String(ym.month).padStart(2, '0')}`;
}

// ─── Indicador de variação (aumento de despesa = vermelho; redução = verde) ────
function VariacaoBadge({ variacao, variacaoPerc, size = 'sm' }: { variacao: number; variacaoPerc: number; size?: 'sm' | 'xs' }) {
  let cor = 'text-slate-400';
  let Icone = Minus;
  if (variacaoPerc > 0.05) { cor = 'text-red-600'; Icone = TrendingUp; }
  else if (variacaoPerc < -0.05) { cor = 'text-emerald-600'; Icone = TrendingDown; }

  const textSize = size === 'xs' ? 'text-[11px]' : 'text-xs';
  return (
    <div className="flex items-center justify-end gap-1.5">
      <Icone className={`w-3.5 h-3.5 ${cor}`} />
      <div className="text-right">
        <div className={`${textSize} font-semibold tabular-nums ${cor}`}>
          {variacao > 0 ? '+' : ''}{variacaoPerc.toFixed(1)}%
        </div>
        <div className={`text-[10px] tabular-nums ${cor}`}>
          {variacao > 0 ? '+' : ''}R$ {fmtBRL(variacao)}
        </div>
      </div>
    </div>
  );
}

// ─── Grupo de contas de um departamento ────────────────────────────────────────
function GrupoSection({ grupo, labelAtual, labelAnterior }: { grupo: GrupoResultado; labelAtual: string; labelAnterior: string }) {
  const cfg = GRUPO_CONFIG[grupo.grupo];
  const varGrupo = grupo.totalAtual - grupo.totalAnterior;
  const percGrupo = grupo.totalAnterior !== 0
    ? (varGrupo / Math.abs(grupo.totalAnterior)) * 100
    : (grupo.totalAtual !== 0 ? 100 : 0);

  return (
    <div
      className="bg-white rounded-xl overflow-hidden shadow-sm"
      style={{ border: `1px solid ${cfg.badge}`, borderLeft: `4px solid ${cfg.color}` }}
    >
      <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: cfg.light }}>
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
          <span className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: cfg.badge, color: cfg.color }}
          >
            {grupo.contas.length} conta{grupo.contas.length !== 1 ? 's' : ''}
          </span>
        </div>
        <VariacaoBadge variacao={varGrupo} variacaoPerc={percGrupo} />
      </div>

      <div className="overflow-x-auto">
        <table className="table-fixed w-full text-xs">
          <colgroup>
            <col style={{ width: '38%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '28%' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="text-left px-4 py-2 font-semibold text-slate-500">Conta / Descrição</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-500">Atual · {labelAtual}</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-500">Anterior · {labelAnterior}</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-500">Variação</th>
            </tr>
          </thead>
          <tbody>
            {grupo.contas.map((c: VariacaoConta, i) => (
              <tr
                key={c.conta}
                className={`border-b border-slate-50 transition-colors hover:bg-slate-50/50 ${
                  i % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'
                }`}
              >
                <td className="px-4 py-2 text-slate-700 font-medium truncate" title={c.conta}>{c.conta}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums font-semibold text-slate-800">{fmtBRL(c.atual)}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-500">{fmtBRL(c.anterior)}</td>
                <td className="px-4 py-2"><VariacaoBadge variacao={c.variacao} variacaoPerc={c.variacaoPerc} size="xs" /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: cfg.badge }}>
              <td className="px-4 py-2 text-xs font-bold" style={{ color: cfg.color }}>Subtotal — {cfg.label}</td>
              <td className="px-4 py-2 text-right text-xs font-bold tabular-nums" style={{ color: cfg.color }}>{fmtBRL(grupo.totalAtual)}</td>
              <td className="px-4 py-2 text-right text-xs font-bold tabular-nums" style={{ color: cfg.color }}>{fmtBRL(grupo.totalAnterior)}</td>
              <td className="px-4 py-2"><VariacaoBadge variacao={varGrupo} variacaoPerc={percGrupo} size="xs" /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Visão de um departamento ──────────────────────────────────────────────────
function DeptoView({ depto, labelAtual, labelAnterior }: { depto: DeptoResultado; labelAtual: string; labelAnterior: string }) {
  if (depto.grupos.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-16 text-center">
        <p className="text-slate-600 font-medium">Sem despesas classificadas para {depto.label}.</p>
        <p className="text-sm text-slate-400 mt-1">Verifique a classificação de contas e as regras de departamento.</p>
      </div>
    );
  }
  const varTotal = depto.totalAtual - depto.totalAnterior;
  const percTotal = depto.totalAnterior !== 0
    ? (varTotal / Math.abs(depto.totalAnterior)) * 100
    : (depto.totalAtual !== 0 ? 100 : 0);

  return (
    <div className="space-y-3">
      {/* Cartões de total do departamento */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Período atual · {labelAtual}</p>
          <p className="text-xl font-bold text-slate-800 tabular-nums mt-1">R$ {fmtBRL(depto.totalAtual)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Período anterior · {labelAnterior}</p>
          <p className="text-xl font-bold text-slate-500 tabular-nums mt-1">R$ {fmtBRL(depto.totalAnterior)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">Variação total</p>
          <VariacaoBadge variacao={varTotal} variacaoPerc={percTotal} />
        </div>
      </div>

      {depto.grupos.map((g) => (<GrupoSection key={g.grupo} grupo={g} labelAtual={labelAtual} labelAnterior={labelAnterior} />))}
    </div>
  );
}

// ─── Aba Resumo (todos os departamentos) ───────────────────────────────────────
function ResumoView({ resultado }: { resultado: ComparativoResultado }) {
  const deptos = resultado.deptos.filter((d) => d.dept !== 'consolidado');
  const consolidado = resultado.deptos.find((d) => d.dept === 'consolidado');

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 font-semibold">Departamento</th>
              <th className="text-right px-4 py-2.5 font-semibold">Atual · {resultado.labelAtual}</th>
              <th className="text-right px-4 py-2.5 font-semibold">Anterior · {resultado.labelAnterior}</th>
              <th className="text-right px-4 py-2.5 font-semibold">Variação</th>
            </tr>
          </thead>
          <tbody>
            {deptos.map((d, i) => {
              const v = d.totalAtual - d.totalAnterior;
              const p = d.totalAnterior !== 0 ? (v / Math.abs(d.totalAnterior)) * 100 : (d.totalAtual !== 0 ? 100 : 0);
              return (
                <tr key={d.dept} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  <td className="px-4 py-2 font-medium text-slate-700">{d.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-800">{fmtBRL(d.totalAtual)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500">{fmtBRL(d.totalAnterior)}</td>
                  <td className="px-4 py-2"><VariacaoBadge variacao={v} variacaoPerc={p} size="xs" /></td>
                </tr>
              );
            })}
          </tbody>
          {consolidado && (
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-200">
                <td className="px-4 py-2.5 text-slate-800">{consolidado.label}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{fmtBRL(consolidado.totalAtual)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{fmtBRL(consolidado.totalAnterior)}</td>
                <td className="px-4 py-2.5">
                  <VariacaoBadge
                    variacao={consolidado.totalAtual - consolidado.totalAnterior}
                    variacaoPerc={consolidado.totalAnterior !== 0
                      ? ((consolidado.totalAtual - consolidado.totalAnterior) / Math.abs(consolidado.totalAnterior)) * 100
                      : (consolidado.totalAtual !== 0 ? 100 : 0)}
                    size="xs"
                  />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Seletor de bucket (bimestre/trimestre/semestre) com Ano + período ─────────
function BucketPeriodSelector({ titulo, gran, yearsWithData, selYear, selIndex, onChange, accent }: {
  titulo: string;
  gran: Granularidade;
  yearsWithData: number[];
  selYear: number | null;
  selIndex: number | null;
  onChange: (year: number, index: number) => void;
  accent: string;
}) {
  const periodLabel = gran === 'bimestral' ? 'Bimestre' : gran === 'trimestral' ? 'Trimestre' : 'Semestre';
  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-500">{titulo} — Ano</label>
        <select
          value={selYear ?? ''}
          onChange={(e) => onChange(Number(e.target.value), selIndex ?? 1)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 min-w-[100px]"
          style={{ ['--tw-ring-color' as string]: accent }}
        >
          {yearsWithData.map((y) => (<option key={y} value={y}>{y}</option>))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-500">{periodLabel}</label>
        <select
          value={selIndex ?? ''}
          onChange={(e) => onChange(selYear ?? yearsWithData[yearsWithData.length - 1] ?? new Date().getFullYear(), Number(e.target.value))}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 min-w-[170px]"
          style={{ ['--tw-ring-color' as string]: accent }}
        >
          {Array.from({ length: GRAN_BUCKETS_PER_YEAR[gran] }, (_, i) => i + 1).map((idx) => (
            <option key={idx} value={idx}>{bucketLabel(gran, idx)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function ComparativoPeriodo({ adapter, accent = DEFAULT_ACCENT }: Props) {
  const [availableMonths, setAvailableMonths] = useState<YM[]>([]);
  const [gran, setGran] = useState<Granularidade>('mensal');
  // Período atual e período de comparação, cada um = (ano, índice do bucket na granularidade).
  const [atualYear, setAtualYear] = useState<number | null>(null);
  const [atualIndex, setAtualIndex] = useState<number | null>(null);
  const [antYear, setAntYear] = useState<number | null>(null);
  const [antIndex, setAntIndex] = useState<number | null>(null);
  const [resultado, setResultado] = useState<ComparativoResultado | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('resumo');

  // Carrega meses disponíveis; atual = mês mais recente, comparação = mês anterior (mensal).
  useEffect(() => {
    let cancelled = false;
    void adapter.getImportedMonths().then((months) => {
      if (cancelled) return;
      setAvailableMonths(months);
      if (months.length > 0) {
        const last = months[months.length - 1];
        setAtualYear(last.year);
        setAtualIndex(last.month);
        const prev = prevBucket('mensal', last.year, last.month);
        setAntYear(prev.year);
        setAntIndex(prev.index);
      }
    });
    return () => { cancelled = true; };
  }, [adapter]);

  // Anos com dados (para os seletores de ano nos modos bi/tri/semestral).
  const yearsWithData = useMemo(() => {
    const set = new Set<number>(availableMonths.map((m) => m.year));
    return Array.from(set).sort((a, b) => a - b);
  }, [availableMonths]);

  const periodos = useMemo(
    () => (atualYear != null && atualIndex != null && antYear != null && antIndex != null
      ? { atual: bucketMonths(gran, atualYear, atualIndex), anterior: bucketMonths(gran, antYear, antIndex) }
      : null),
    [gran, atualYear, atualIndex, antYear, antIndex],
  );

  const run = useCallback(async () => {
    if (!periodos) { setResultado(null); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await executarComparativo(adapter, periodos);
      setResultado(res);
    } finally {
      setLoading(false);
    }
  }, [adapter, periodos]);

  useEffect(() => { void run(); }, [run]);

  // Troca de granularidade preservando o mês "âncora"; comparação volta ao bucket anterior.
  const changeGran = (newGran: Granularidade) => {
    if (atualYear == null || atualIndex == null) { setGran(newGran); return; }
    const anchor = bucketAnchorMonth(gran, atualIndex);
    const newIndex = bucketIndexOf(anchor, newGran);
    setGran(newGran);
    setAtualIndex(newIndex);
    const prev = prevBucket(newGran, atualYear, newIndex);
    setAntYear(prev.year);
    setAntIndex(prev.index);
  };

  // Ao mudar o período atual, a comparação assume o bucket imediatamente anterior (editável).
  const changeAtual = (y: number, idx: number) => {
    setAtualYear(y);
    setAtualIndex(idx);
    const prev = prevBucket(gran, y, idx);
    setAntYear(prev.year);
    setAntIndex(prev.index);
  };

  const atualKey = atualYear != null && atualIndex != null ? monthKey({ year: atualYear, month: atualIndex }) : '';
  const antKey = antYear != null && antIndex != null ? monthKey({ year: antYear, month: antIndex }) : '';

  const tabs = useMemo(() => {
    const base = [{ id: 'resumo', label: 'Resumo' }];
    if (resultado) {
      for (const d of resultado.deptos) base.push({ id: d.dept, label: d.label });
    }
    return base;
  }, [resultado]);

  const activeDepto = useMemo(
    () => resultado?.deptos.find((d) => d.dept === activeTab) ?? null,
    [resultado, activeTab],
  );

  if (availableMonths.length === 0 && !loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-16 text-center">
        <p className="text-slate-600 font-medium">Nenhum mês com dados importados.</p>
        <p className="text-sm text-slate-400 mt-1">Importe pelo menos um mês na aba "Importar Dados" para usar os comparativos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-500">Granularidade</label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {GRAN_ORDENADAS.map((g) => (
              <button
                key={g}
                onClick={() => changeGran(g)}
                className="px-3 py-1.5 text-sm font-medium transition-colors"
                style={gran === g
                  ? { backgroundColor: accent, color: '#fff' }
                  : { backgroundColor: '#fff', color: '#475569' }}
              >
                {GRAN_LABEL[g]}
              </button>
            ))}
          </div>
        </div>

        {gran === 'mensal' ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500">Período atual</label>
              <select
                value={atualKey}
                onChange={(e) => { const [y, m] = e.target.value.split('-').map(Number); changeAtual(y, m); }}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 min-w-[180px]"
                style={{ ['--tw-ring-color' as string]: accent }}
              >
                {availableMonths.map((ym) => (
                  <option key={monthKey(ym)} value={monthKey(ym)}>{MONTHS_FULL[ym.month - 1]} / {ym.year}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-2 text-xs font-medium text-slate-400">vs</div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500">Período de comparação</label>
              <select
                value={antKey}
                onChange={(e) => { const [y, m] = e.target.value.split('-').map(Number); setAntYear(y); setAntIndex(m); }}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 min-w-[180px]"
                style={{ ['--tw-ring-color' as string]: accent }}
              >
                {availableMonths.map((ym) => (
                  <option key={monthKey(ym)} value={monthKey(ym)}>{MONTHS_FULL[ym.month - 1]} / {ym.year}</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            <BucketPeriodSelector
              titulo="Período atual"
              gran={gran}
              yearsWithData={yearsWithData}
              selYear={atualYear}
              selIndex={atualIndex}
              onChange={changeAtual}
              accent={accent}
            />
            <div className="flex items-end pb-2 text-xs font-medium text-slate-400">vs</div>
            <BucketPeriodSelector
              titulo="Período de comparação"
              gran={gran}
              yearsWithData={yearsWithData}
              selYear={antYear}
              selIndex={antIndex}
              onChange={(y, idx) => { setAntYear(y); setAntIndex(idx); }}
              accent={accent}
            />
          </>
        )}

        {resultado && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <CalendarRange className="w-4 h-4 text-slate-400" />
            <span className="font-semibold px-2.5 py-1 rounded-md" style={{ backgroundColor: `${accent}14`, color: accent }}>
              {resultado.labelAtual}
            </span>
            <span className="text-slate-400">vs</span>
            <span className="font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600">
              {resultado.labelAnterior}
            </span>
          </div>
        )}
      </div>

      {/* Aviso de meses faltantes */}
      {resultado && resultado.mesesFaltantes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Sem dados importados para {resultado.mesesFaltantes.map((m) => `${MONTHS_SHORT[m.month - 1]}/${m.year}`).join(', ')}
          {' '}— {resultado.mesesFaltantes.length === 1 ? 'esse mês é tratado' : 'esses meses são tratados'} como R$ 0 na soma do período.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Calculando comparativo...
        </div>
      ) : resultado ? (
        <>
          {/* Sub-abas por departamento */}
          <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                style={activeTab === t.id
                  ? { backgroundColor: accent, color: '#fff' }
                  : { backgroundColor: '#f1f5f9', color: '#475569' }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'resumo'
            ? <ResumoView resultado={resultado} />
            : activeDepto
              ? <DeptoView depto={activeDepto} labelAtual={resultado.labelAtual} labelAnterior={resultado.labelAnterior} />
              : null}
        </>
      ) : null}
    </div>
  );
}
