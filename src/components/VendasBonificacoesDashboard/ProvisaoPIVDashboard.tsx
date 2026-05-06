import React, { useEffect, useMemo, useState } from 'react';
import { loadVendasResultadoRows, type VendasResultadoRow } from './vendasResultadoStorage';
import { loadProvisaoPivConfig, saveProvisaoPivConfig, periodoKey } from './provisaoPivStorage';
import { Wrench, Car, Layers, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const n = (v?: string | null) => parseFloat(String(v ?? '').replace(',', '.')) || 0;

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function getYr(r: VendasResultadoRow): number {
  if (r.periodoImport) {
    const [y] = r.periodoImport.split('-').map(Number);
    if (y > 2000) return y;
  }
  const d = r.dataVenda;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[2];
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return +d.split('-')[0];
  return 0;
}
function getMo(r: VendasResultadoRow): number {
  if (r.periodoImport) {
    const [, m] = r.periodoImport.split('-').map(Number);
    if (m >= 1 && m <= 12) return m;
  }
  const d = r.dataVenda;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[1];
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return +d.split('-')[1];
  return 0;
}

// ─── Barra bicolor animada ────────────────────────────────────────────────────
function RatioBiBar({ pctOficina }: { pctOficina: number }) {
  const clampedOficina = Math.min(100, Math.max(0, pctOficina));
  const clampedNovos   = 100 - clampedOficina;
  return (
    <div className="relative w-full h-3 rounded-full overflow-hidden bg-slate-100 flex">
      <div
        className="h-full bg-blue-500 transition-all duration-500 ease-out"
        style={{ width: `${clampedNovos}%` }}
      />
      <div
        className="h-full bg-orange-400 transition-all duration-500 ease-out"
        style={{ width: `${clampedOficina}%` }}
      />
    </div>
  );
}

// ─── Card de fonte (PIV ou SIQ) ───────────────────────────────────────────────
function SourceCard({
  label,
  value,
  count,
  color,
  pct,
}: {
  label: string;
  value: number;
  count: number;
  color: 'indigo' | 'violet';
  pct: number;
}) {
  const colorMap = {
    indigo: {
      border: 'border-indigo-200',
      bg: 'bg-indigo-50',
      badge: 'bg-indigo-100 text-indigo-700',
      label: 'text-indigo-600',
      value: 'text-indigo-900',
      dot: 'bg-indigo-500',
    },
    violet: {
      border: 'border-violet-200',
      bg: 'bg-violet-50',
      badge: 'bg-violet-100 text-violet-700',
      label: 'text-violet-600',
      value: 'text-violet-900',
      dot: 'bg-violet-500',
    },
  }[color];

  return (
    <div className={`rounded-xl border ${colorMap.border} ${colorMap.bg} p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold uppercase tracking-widest ${colorMap.label}`}>{label}</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colorMap.badge}`}>
          {count} registro{count !== 1 ? 's' : ''}
        </span>
      </div>
      <p className={`text-2xl font-black tabular-nums ${colorMap.value}`}>{fmtBRL(value)}</p>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${colorMap.dot}`} />
        <span className="text-[11px] text-slate-500">
          {pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% do total
        </span>
      </div>
    </div>
  );
}

// ─── Card de resultado do rateio ─────────────────────────────────────────────
function RateioCard({
  label,
  icon,
  value,
  pct,
  color,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  pct: number;
  color: 'blue' | 'orange';
}) {
  const colorMap = {
    blue: {
      border: 'border-blue-200',
      bg: 'from-blue-50 to-white',
      header: 'bg-blue-600',
      value: 'text-blue-900',
      badge: 'bg-blue-100 text-blue-700',
    },
    orange: {
      border: 'border-orange-200',
      bg: 'from-orange-50 to-white',
      header: 'bg-orange-500',
      value: 'text-orange-900',
      badge: 'bg-orange-100 text-orange-700',
    },
  }[color];

  return (
    <div className={`rounded-xl border ${colorMap.border} bg-gradient-to-b ${colorMap.bg} overflow-hidden flex flex-col`}>
      <div className={`${colorMap.header} px-4 py-2 flex items-center gap-2`}>
        <div className="text-white/90">{icon}</div>
        <span className="text-white text-xs font-bold uppercase tracking-widest">{label}</span>
        <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${colorMap.badge}`}>
          {pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
        </span>
      </div>
      <div className="px-4 py-4">
        <p className={`text-3xl font-black tabular-nums ${colorMap.value}`}>{fmtBRL(value)}</p>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
interface Props {
  filterYear: number;
  filterMonth: number | null;
}

export function ProvisaoPIVDashboard({ filterYear, filterMonth }: Props) {
  const [rows, setRows]           = useState<VendasResultadoRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [pctInput, setPctInput]   = useState('');
  const [saved, setSaved]         = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [expanded, setExpanded]   = useState(false); // detalhe por veículo

  // ── Carrega dados e config ────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadVendasResultadoRows('novos'),
      loadProvisaoPivConfig(),
    ]).then(([vendasRows, cfg]) => {
      setRows(vendasRows);
      const key = periodoKey(filterYear, filterMonth);
      setPctInput(cfg.rateios[key] ?? '');
      setConfigLoaded(true);
      setLoading(false);
    });
  }, [filterYear, filterMonth]);

  // ── Filtra por ano/mês ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter(r => {
      const yr = getYr(r);
      const mo = getMo(r);
      if (!yr) return false;
      if (yr !== filterYear) return false;
      if (filterMonth !== null && mo !== filterMonth) return false;
      return true;
    });
  }, [rows, filterYear, filterMonth]);

  // ── Totais ────────────────────────────────────────────────────────────────
  const { totalPiv, totalSiq, countPiv, countSiq } = useMemo(() => {
    let totalPiv = 0, totalSiq = 0, countPiv = 0, countSiq = 0;
    for (const r of filtered) {
      const piv = n(r.bonusPIV);
      const siq = n(r.bonusSIQ);
      if (piv !== 0) { totalPiv += piv; countPiv++; }
      if (siq !== 0) { totalSiq += siq; countSiq++; }
    }
    return { totalPiv, totalSiq, countPiv, countSiq };
  }, [filtered]);

  const totalGeral = totalPiv + totalSiq;

  // ── Rateio ────────────────────────────────────────────────────────────────
  const pctOficina = Math.min(100, Math.max(0, parseFloat(pctInput.replace(',', '.')) || 0));
  const valorOficina = (totalGeral * pctOficina) / 100;
  const valorNovos   = totalGeral - valorOficina;
  const pctNovos     = 100 - pctOficina;

  // ── Salvar % ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const cfg = await loadProvisaoPivConfig();
    const key = periodoKey(filterYear, filterMonth);
    cfg.rateios[key] = pctInput;
    await saveProvisaoPivConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // ── Detalhe por veículo ───────────────────────────────────────────────────
  const rowsWithBonus = useMemo(() =>
    filtered.filter(r => n(r.bonusPIV) !== 0 || n(r.bonusSIQ) !== 0),
    [filtered],
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Carregando...
      </div>
    );
  }

  const periodoLabel = filterMonth === null
    ? String(filterYear)
    : `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][filterMonth - 1]}/${filterYear}`;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-6">

        {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">Provisão PIV + SIQ</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Período: <span className="font-semibold text-slate-700">{periodoLabel}</span>
              {' · '}
              {filtered.length} venda{filtered.length !== 1 ? 's' : ''} no período
            </p>
          </div>
          {totalGeral > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Total Geral</p>
              <p className="text-2xl font-black text-slate-900 tabular-nums">{fmtBRL(totalGeral)}</p>
            </div>
          )}
        </div>

        {/* ── Fontes: PIV + SIQ ────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Fontes de Bônus</p>
          <div className="grid grid-cols-2 gap-4">
            <SourceCard
              label="PIV"
              value={totalPiv}
              count={countPiv}
              color="indigo"
              pct={totalGeral > 0 ? (totalPiv / totalGeral) * 100 : 0}
            />
            <SourceCard
              label="SIQ"
              value={totalSiq}
              count={countSiq}
              color="violet"
              pct={totalGeral > 0 ? (totalSiq / totalGeral) * 100 : 0}
            />
          </div>

          {/* Barra proporcional PIV vs SIQ */}
          {totalGeral > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              <div className="relative w-full h-2.5 rounded-full overflow-hidden bg-slate-100 flex">
                <div
                  className="h-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${(totalPiv / totalGeral) * 100}%` }}
                />
                <div
                  className="h-full bg-violet-500 transition-all duration-500"
                  style={{ width: `${(totalSiq / totalGeral) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                  PIV {totalGeral > 0 ? ((totalPiv / totalGeral) * 100).toFixed(0) : 0}%
                </span>
                <span className="flex items-center gap-1">
                  SIQ {totalGeral > 0 ? ((totalSiq / totalGeral) * 100).toFixed(0) : 0}%
                  <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Separador com seta ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <div className="flex items-center gap-1.5 text-slate-400">
            <Layers className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Rateio</span>
          </div>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* ── Controle de rateio ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start gap-6">
            {/* Input % Oficina */}
            <div className="flex flex-col gap-2 min-w-[180px]">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                % destinado à Oficina
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={pctInput}
                    onChange={e => { setPctInput(e.target.value); setSaved(false); }}
                    placeholder="0"
                    className="w-24 text-2xl font-black text-slate-800 border-2 border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-400 text-center tabular-nums appearance-none"
                    style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                  />
                  <span className="ml-1.5 text-xl font-black text-slate-400">%</span>
                </div>
                <button
                  onClick={handleSave}
                  disabled={!configLoaded}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    saved
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  {saved ? '✓ Salvo' : 'Salvar'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Novos receberá <span className="font-semibold text-blue-600">{pctNovos.toFixed(1)}%</span>
              </p>
            </div>

            {/* Preview da barra + legenda */}
            <div className="flex-1 flex flex-col gap-3 pt-5">
              <RatioBiBar pctOficina={pctOficina} />
              <div className="flex justify-between text-[10px] font-semibold">
                <span className="flex items-center gap-1 text-blue-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  Novos — {pctNovos.toFixed(1)}%
                </span>
                <span className="flex items-center gap-1 text-orange-500">
                  Oficina — {pctOficina.toFixed(1)}%
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Seta de fluxo ───────────────────────────────────────────────── */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-1 text-slate-300">
            <div className="w-px h-4 bg-slate-200" />
            <ArrowRight className="w-4 h-4 rotate-90" />
          </div>
        </div>

        {/* ── Cards de resultado ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <RateioCard
            label="Novos"
            icon={<Car className="w-4 h-4" />}
            value={valorNovos}
            pct={pctNovos}
            color="blue"
          />
          <RateioCard
            label="Oficina"
            icon={<Wrench className="w-4 h-4" />}
            value={valorOficina}
            pct={pctOficina}
            color="orange"
          />
        </div>

        {/* ── Resumo total ─────────────────────────────────────────────────── */}
        <div className="bg-slate-800 rounded-2xl px-5 py-4 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Conferência Total
          </span>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-blue-300 font-semibold tabular-nums">{fmtBRL(valorNovos)}</span>
            <span className="text-slate-500 text-xs">+</span>
            <span className="text-orange-300 font-semibold tabular-nums">{fmtBRL(valorOficina)}</span>
            <span className="text-slate-500 text-xs">=</span>
            <span className="text-white font-black text-base tabular-nums">{fmtBRL(totalGeral)}</span>
          </div>
        </div>

        {/* ── Detalhe por veículo (colapsável) ────────────────────────────── */}
        {rowsWithBonus.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => setExpanded(v => !v)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Detalhe por Veículo</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">
                  {rowsWithBonus.length} veículo{rowsWithBonus.length !== 1 ? 's' : ''}
                </span>
              </div>
              {expanded
                ? <ChevronUp className="w-4 h-4 text-slate-400" />
                : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {expanded && (
              <div className="overflow-x-auto border-t border-slate-100">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-500 text-[10px] uppercase tracking-wide">Modelo</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-500 text-[10px] uppercase tracking-wide">Chassi</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-500 text-[10px] uppercase tracking-wide">Data</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-indigo-600 text-[10px] uppercase tracking-wide">PIV</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-violet-600 text-[10px] uppercase tracking-wide">SIQ</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-slate-600 text-[10px] uppercase tracking-wide">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rowsWithBonus.map((r, i) => {
                      const piv = n(r.bonusPIV);
                      const siq = n(r.bonusSIQ);
                      const tot = piv + siq;
                      return (
                        <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="px-4 py-2.5 font-medium text-slate-700">{r.modelo || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono">{r.chassi || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-400">{r.dataVenda || r.periodoImport || '—'}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-indigo-700 tabular-nums">
                            {piv !== 0 ? fmtBRL(piv) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-violet-700 tabular-nums">
                            {siq !== 0 ? fmtBRL(siq) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-black text-slate-800 tabular-nums">
                            {fmtBRL(tot)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-100 border-t-2 border-slate-300">
                      <td colSpan={3} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Total</td>
                      <td className="px-4 py-2.5 text-right font-black text-indigo-700 tabular-nums">{fmtBRL(totalPiv)}</td>
                      <td className="px-4 py-2.5 text-right font-black text-violet-700 tabular-nums">{fmtBRL(totalSiq)}</td>
                      <td className="px-4 py-2.5 text-right font-black text-slate-900 tabular-nums">{fmtBRL(totalGeral)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Estado vazio ─────────────────────────────────────────────────── */}
        {totalGeral === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-300 gap-3">
            <Layers className="w-12 h-12" />
            <p className="text-sm">Nenhum valor de PIV ou SIQ no período selecionado.</p>
          </div>
        )}

      </div>
    </div>
  );
}
