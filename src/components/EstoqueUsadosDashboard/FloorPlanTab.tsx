import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { toast } from 'sonner';
import { Landmark, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Printer, Car, SlidersHorizontal } from 'lucide-react';
import {
  EstoqueUsadosEntry, FloorPlanMap, FloorPlanLimits,
  loadFloorPlanMap, saveFloorPlanDay, loadFloorPlanLimits, saveFloorPlanLimits,
  calcTotalFloorPlan, formatDateBR, fmtBRL, parseNum,
} from './estoqueUsadosStorage';
import { kvBulkGet } from '@/lib/kvClient';
import { ControleVeiculosTab } from './ControleVeiculosTab';
import { RegrasTab } from './RegrasTab';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  dates: string[]; // lista de datas (desc) com lançamentos de estoque
}

// Cores por marca/banco
const COR_VW    = '#1e3a8a';
const COR_AUDI  = '#b91c1c';
const COR_TOTAL = '#0f172a';
const COR_FP    = '#7c3aed';
const COR_ITAU  = '#ea580c';
const COR_VOLKS = '#0ea5e9';
const COR_COB   = '#16a34a';

// ─── Campo de moeda (inline) ──────────────────────────────────────────────────

function CurrencyCell({
  value, onCommit,
}: {
  value: number;
  onCommit: (v: number) => void;
}) {
  const [display, setDisplay] = useState(fmtBRL(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => { if (!editing) setDisplay(fmtBRL(value)); }, [value, editing]);

  return (
    <div className="flex items-center justify-end gap-1">
      <span className="text-[10px] text-slate-400">R$</span>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onFocus={e => {
          setEditing(true);
          e.target.select();
          setDisplay(value === 0 ? '' : String(value).replace('.', ','));
        }}
        onChange={e => setDisplay(e.target.value)}
        onBlur={e => {
          const parsed = parseNum(e.target.value);
          setEditing(false);
          setDisplay(fmtBRL(parsed));
          if (parsed !== value) onCommit(parsed);
        }}
        className="w-28 text-right text-xs border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent tabular-nums"
      />
    </div>
  );
}

// ─── Painel de Limite por banco ───────────────────────────────────────────────

function LimitePanel({
  cor, titulo, limite, utilizado, testDrive, onChangeLimite, onChangeTestDrive,
}: {
  cor: string;
  titulo: string;
  limite: number;
  utilizado: number;
  testDrive: number;
  onChangeLimite: (v: number) => void;
  onChangeTestDrive: (v: number) => void;
}) {
  const consumido = utilizado + testDrive;
  const disponivel = limite - consumido;
  const pct = limite > 0 ? Math.min(100, (consumido / limite) * 100) : 0;
  const estourado = disponivel < 0;

  const [display, setDisplay] = useState(fmtBRL(limite));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setDisplay(fmtBRL(limite)); }, [limite, editing]);

  const [tdDisplay, setTdDisplay] = useState(fmtBRL(testDrive));
  const [tdEditing, setTdEditing] = useState(false);
  useEffect(() => { if (!tdEditing) setTdDisplay(fmtBRL(testDrive)); }, [testDrive, tdEditing]);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2" style={{ borderLeftColor: cor, borderLeftWidth: 3 }}>
        <Landmark className="w-4 h-4" style={{ color: cor }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cor }}>{titulo}</span>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Limite cadastrado</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={display}
              onFocus={e => { setEditing(true); e.target.select(); setDisplay(limite === 0 ? '' : String(limite).replace('.', ',')); }}
              onChange={e => setDisplay(e.target.value)}
              onBlur={e => {
                const parsed = parseNum(e.target.value);
                setEditing(false);
                setDisplay(fmtBRL(parsed));
                if (parsed !== limite) onChangeLimite(parsed);
              }}
              className="w-32 text-right text-sm font-semibold border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent tabular-nums"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Utilização em Test Drive ou Frota</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={tdDisplay}
              onFocus={e => { setTdEditing(true); e.target.select(); setTdDisplay(testDrive === 0 ? '' : String(testDrive).replace('.', ',')); }}
              onChange={e => setTdDisplay(e.target.value)}
              onBlur={e => {
                const parsed = parseNum(e.target.value);
                setTdEditing(false);
                setTdDisplay(fmtBRL(parsed));
                if (parsed !== testDrive) onChangeTestDrive(parsed);
              }}
              className="w-32 text-right text-sm font-semibold border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent tabular-nums"
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Utilizado (dia mais recente)</span>
          <span className="tabular-nums font-medium text-slate-700">{fmtBRL(utilizado)}</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: estourado ? '#dc2626' : cor }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Disponível</span>
          <span className={`tabular-nums text-sm font-bold ${estourado ? 'text-red-600' : 'text-emerald-600'}`}>
            {fmtBRL(disponivel)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Conteúdo: Posição FloorPlan ──────────────────────────────────────────────

function PosicaoFloorPlanContent({ dates }: Props) {
  const [entries, setEntries]     = useState<Record<string, EstoqueUsadosEntry>>({});
  const [floorplan, setFloorplan] = useState<FloorPlanMap>({});
  const [limits, setLimits]       = useState<FloorPlanLimits>({ itau: 0, volks: 0, itauTestDrive: 0, volksTestDrive: 0 });
  const [loading, setLoading]     = useState(true);
  const [showPorMarca, setShowPorMarca] = useState(false);
  const [showPorBanco, setShowPorBanco] = useState(false);
  const [showCobertura, setShowCobertura] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Carrega estoque + floor plan + limites
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const recent = dates.slice(0, 60);
    const keys = recent.map(d => `estoque_usados:entry:${d}`);

    Promise.all([
      recent.length > 0 ? kvBulkGet<EstoqueUsadosEntry>(keys) : Promise.resolve({}),
      loadFloorPlanMap(),
      loadFloorPlanLimits(),
    ]).then(([entryMap, fpMap, lim]) => {
      if (cancelled) return;
      const byDate: Record<string, EstoqueUsadosEntry> = {};
      for (const d of recent) {
        const v = (entryMap as Record<string, EstoqueUsadosEntry | null>)[`estoque_usados:entry:${d}`];
        if (v) byDate[d] = v;
      }
      setEntries(byDate);
      setFloorplan(fpMap);
      setLimits(lim);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [dates]);

  // Datas em ordem decrescente (mais recente primeiro) para a tabela
  const sortedDates = useMemo(
    () => [...dates].slice(0, 60).sort((a, b) => b.localeCompare(a)),
    [dates],
  );

  const mostRecent = sortedDates[0];
  const fpMaisRecente = mostRecent ? floorplan[mostRecent] : undefined;

  const handleCommitFP = useCallback(async (date: string, bank: 'itau' | 'volks', value: number) => {
    const current = floorplan[date] ?? { itau: 0, volks: 0 };
    const updated = { ...current, [bank]: value };
    setFloorplan(prev => ({ ...prev, [date]: updated }));
    const ok = await saveFloorPlanDay(date, updated);
    if (!ok) toast.error('Erro ao salvar valor de Floor Plan.');
  }, [floorplan]);

  const handleCommitLimit = useCallback(async (field: 'itau' | 'volks' | 'itauTestDrive' | 'volksTestDrive', value: number) => {
    const updated = { ...limits, [field]: value };
    setLimits(updated);
    const ok = await saveFloorPlanLimits(updated);
    if (ok) toast.success('Valor atualizado.');
    else toast.error('Erro ao salvar valor.');
  }, [limits]);

  // Dados do gráfico (últimos 25 dias, ordem cronológica asc)
  const chartData = useMemo(() => {
    return sortedDates.slice(0, 25).reverse().map(d => {
      const e = entries[d];
      const estVW   = e?.vwUsadosPagos ?? 0;
      const estAudi = e?.audiUsadosPago ?? 0;
      const estTotal = estVW + estAudi;
      const fp = floorplan[d] ?? { itau: 0, volks: 0 };
      const fpTotal = calcTotalFloorPlan(fp);
      const cobertura = estTotal > 0 ? (fpTotal / estTotal) * 100 : 0;
      return {
        date: formatDateBR(d).slice(0, 5), // dd/mm
        estVW, estAudi, estTotal,
        itau: fp.itau, volks: fp.volks, fpTotal,
        cobertura: Number(cobertura.toFixed(1)),
      };
    });
  }, [sortedDates, entries, floorplan]);

  // Totais do dia mais recente (para os cards de topo)
  const resumo = useMemo(() => {
    const e = mostRecent ? entries[mostRecent] : undefined;
    const estTotal = (e?.vwUsadosPagos ?? 0) + (e?.audiUsadosPago ?? 0);
    const fpTotal = calcTotalFloorPlan(fpMaisRecente);
    const cobertura = estTotal > 0 ? (fpTotal / estTotal) * 100 : 0;
    const limiteTotal = limits.itau + limits.volks;
    const testDriveTotal = limits.itauTestDrive + limits.volksTestDrive;
    const disponivelTotal = limiteTotal - fpTotal - testDriveTotal;
    return { estTotal, fpTotal, cobertura, limiteTotal, disponivelTotal };
  }, [mostRecent, entries, fpMaisRecente, limits]);

  // Tendência da cobertura (comparando os 2 pontos mais recentes)
  const tendencia = useMemo(() => {
    if (chartData.length < 2) return 0;
    const ultimo = chartData[chartData.length - 1].cobertura;
    const penultimo = chartData[chartData.length - 2].cobertura;
    return ultimo - penultimo;
  }, [chartData]);

  // ── Impressão / PDF (cabeçalho + cards + limites + tabela completa; sem gráfico) ──
  const handlePrint = useCallback(() => {
    const root = document.getElementById('print-root');
    if (!root) { window.print(); return; }
    setPrinting(true);

    const e0 = mostRecent ? entries[mostRecent] : undefined;
    const estTotal = (e0?.vwUsadosPagos ?? 0) + (e0?.audiUsadosPago ?? 0);
    const fpTotal = calcTotalFloorPlan(fpMaisRecente);
    const cobertura = estTotal > 0 ? (fpTotal / estTotal) * 100 : 0;
    const limiteTotal = limits.itau + limits.volks;
    const testDriveTotal = limits.itauTestDrive + limits.volksTestDrive;
    const disponivelTotal = limiteTotal - fpTotal - testDriveTotal;

    const card = (titulo: string, valor: string, sub: string, cor: string) => `
      <div class="fp-card">
        <div class="fp-card-label">${titulo}</div>
        <div class="fp-card-value" style="color:${cor}">${valor}</div>
        <div class="fp-card-sub">${sub}</div>
      </div>`;

    const bancoBox = (titulo: string, cor: string, limite: number, testDrive: number, utilizado: number) => {
      const disponivel = limite - utilizado - testDrive;
      return `
        <div class="fp-banco" style="border-left:3px solid ${cor}">
          <div class="fp-banco-title" style="color:${cor}">${titulo}</div>
          <div class="fp-banco-row"><span>Limite cadastrado</span><span>R$ ${fmtBRL(limite)}</span></div>
          <div class="fp-banco-row"><span>Utilização em Test Drive ou Frota</span><span>R$ ${fmtBRL(testDrive)}</span></div>
          <div class="fp-banco-row"><span>Utilizado (dia mais recente)</span><span>R$ ${fmtBRL(utilizado)}</span></div>
          <div class="fp-banco-row fp-banco-disp"><span>Disponível</span><span style="color:${disponivel < 0 ? '#dc2626' : '#059669'}">R$ ${fmtBRL(disponivel)}</span></div>
        </div>`;
    };

    const rows = sortedDates.map((d, i) => {
      const e = entries[d];
      const estVW = e?.vwUsadosPagos ?? 0;
      const estAudi = e?.audiUsadosPago ?? 0;
      const estTot = estVW + estAudi;
      const fp = floorplan[d] ?? { itau: 0, volks: 0 };
      const fpTot = calcTotalFloorPlan(fp);
      const cob = estTot > 0 ? (fpTot / estTot) * 100 : 0;
      return `<tr class="${i % 2 === 0 ? 'even' : ''}">
        <td class="l">${formatDateBR(d)}</td>
        <td>${fmtBRL(estVW)}</td>
        <td>${fmtBRL(estAudi)}</td>
        <td class="b">${fmtBRL(estTot)}</td>
        <td>${fmtBRL(fp.itau)}</td>
        <td>${fmtBRL(fp.volks)}</td>
        <td class="b">${fmtBRL(fpTot)}</td>
        <td>${cob.toFixed(1)}%</td>
      </tr>`;
    }).join('');

    root.innerHTML = `
      <div id="floorplan-print">
        <div class="fp-header">
          <div>
            <div class="fp-eyebrow">SORANA · CONTROLADORIA FINANCEIRA</div>
            <div class="fp-h1">Floor Plan — Estoque x Floor Plan</div>
            <div class="fp-sub">Posição de estoque de usados e linhas de Floor Plan (Itaú e Volks), com limites e disponibilidade.</div>
          </div>
          <div class="fp-datebox">
            <div class="fp-datelabel">DIA MAIS RECENTE</div>
            <div class="fp-date">${mostRecent ? formatDateBR(mostRecent) : '—'}</div>
          </div>
        </div>

        <div class="fp-cards">
          ${card('Estoque de Usados', 'R$ ' + fmtBRL(estTotal), 'dia mais recente', '#0f172a')}
          ${card('Floor Plan Total', 'R$ ' + fmtBRL(fpTotal), 'Itaú + Volks', '#7c3aed')}
          ${card('Cobertura', cobertura.toFixed(1) + '%', 'Floor Plan / Estoque', '#16a34a')}
          ${card('Limite Disponível', 'R$ ' + fmtBRL(disponivelTotal), 'Limite total R$ ' + fmtBRL(limiteTotal), disponivelTotal < 0 ? '#dc2626' : '#059669')}
        </div>

        <div class="fp-section">Limites das Linhas de Floor Plan</div>
        <div class="fp-bancos">
          ${bancoBox('BANCO ITAÚ', '#ea580c', limits.itau, limits.itauTestDrive, fpMaisRecente?.itau ?? 0)}
          ${bancoBox('BANCO VOLKS', '#0ea5e9', limits.volks, limits.volksTestDrive, fpMaisRecente?.volks ?? 0)}
        </div>

        <div class="fp-section">Estoque x Floor Plan por dia — ${sortedDates.length} dia${sortedDates.length > 1 ? 's' : ''}</div>
        <table class="fp-table">
          <thead>
            <tr>
              <th class="l">Data</th><th>Estoque VW</th><th>Estoque Audi</th><th>Total Estoque</th>
              <th>Floor Plan Itaú</th><th>Floor Plan Volks</th><th>Total Floor Plan</th><th>Cobertura</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    const style = document.createElement('style');
    style.id = '__floorplan-print-override__';
    style.textContent = `
      @page { size: A4 landscape; margin: 0.6cm; }
      #print-root { font-family: Inter, system-ui, sans-serif; color:#0f172a; }
      #print-root, #print-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      #floorplan-print { font-size: 11px; }
      .fp-header { display:flex; justify-content:space-between; align-items:flex-start;
        background: linear-gradient(135deg, #001e50 0%, #6b0018 100%); color:#fff; padding:14px 18px; border-radius:6px; margin-bottom:12px; }
      .fp-eyebrow { font-size:8px; letter-spacing:0.12em; opacity:0.7; text-transform:uppercase; }
      .fp-h1 { font-size:18px; font-weight:700; margin-top:2px; }
      .fp-sub { font-size:9px; opacity:0.75; margin-top:3px; max-width:520px; }
      .fp-datebox { text-align:right; }
      .fp-datelabel { font-size:8px; letter-spacing:0.08em; opacity:0.7; }
      .fp-date { background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); border-radius:4px; padding:4px 12px; margin-top:3px; font-weight:600; }
      .fp-cards { display:flex; gap:10px; margin-bottom:14px; }
      .fp-card { flex:1; border:1px solid #e2e8f0; border-radius:6px; padding:9px 11px; }
      .fp-card-label { font-size:8px; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8; font-weight:700; }
      .fp-card-value { font-size:15px; font-weight:700; margin-top:2px; }
      .fp-card-sub { font-size:8px; color:#94a3b8; margin-top:1px; }
      .fp-section { font-size:12px; font-weight:700; color:#334155; margin:10px 0 7px; }
      .fp-bancos { display:flex; gap:10px; margin-bottom:6px; }
      .fp-banco { flex:1; border:1px solid #e2e8f0; border-radius:6px; padding:9px 11px; }
      .fp-banco-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:5px; }
      .fp-banco-row { display:flex; justify-content:space-between; font-size:9.5px; color:#475569; padding:2px 0; }
      .fp-banco-disp { border-top:1px solid #e2e8f0; margin-top:3px; padding-top:4px; font-weight:700; color:#0f172a; }
      .fp-table { width:100%; border-collapse:collapse; font-size:10px; }
      .fp-table thead tr { background:#f1f5f9; }
      .fp-table th { padding:6px 8px; text-align:right; font-size:8.5px; text-transform:uppercase; letter-spacing:0.04em; color:#475569; border-bottom:2px solid #e2e8f0; }
      .fp-table th.l { text-align:left; }
      .fp-table td { padding:5px 8px; text-align:right; border-bottom:1px solid #f1f5f9; font-variant-numeric: tabular-nums; white-space:nowrap; }
      .fp-table td.l { text-align:left; font-weight:600; }
      .fp-table td.b { font-weight:700; }
      .fp-table tr.even td { background:#f8fafc; }
      .fp-table tr { page-break-inside: avoid; }
    `;
    document.head.appendChild(style);
    setPrinting(false);

    window.onafterprint = () => {
      document.head.querySelector('#__floorplan-print-override__')?.remove();
      root.innerHTML = '';
      window.onafterprint = null;
    };

    window.print();
  }, [sortedDates, entries, floorplan, limits, mostRecent, fpMaisRecente]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-slate-400">
        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Carregando Floor Plan...</span>
      </div>
    );
  }

  if (sortedDates.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
        <Landmark className="w-10 h-10 text-slate-300" />
        <span className="text-sm">Nenhum lançamento de estoque encontrado.</span>
        <span className="text-xs">Registre dados de estoque na aba "Lançar Dados" para começar.</span>
      </div>
    );
  }

  const tendIcon = tendencia > 0.05 ? <TrendingUp className="w-4 h-4 text-emerald-600" />
    : tendencia < -0.05 ? <TrendingDown className="w-4 h-4 text-red-600" />
    : <Minus className="w-4 h-4 text-slate-400" />;

  return (
    <div className="flex-1 bg-slate-50 overflow-auto p-6 space-y-6">

      {/* ── Barra de ações ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700">Floor Plan</h2>
        <button
          onClick={handlePrint}
          disabled={printing}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors disabled:opacity-50"
        >
          <Printer className="w-3.5 h-3.5" />
          {printing ? 'Preparando...' : 'Imprimir / PDF'}
        </button>
      </div>

      {/* ── Cards de resumo (dia mais recente) ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Estoque de Usados</span>
          <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: COR_TOTAL }}>{fmtBRL(resumo.estTotal)}</div>
          <span className="text-xs text-slate-400">dia mais recente · {mostRecent ? formatDateBR(mostRecent) : '—'}</span>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Floor Plan Total</span>
          <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: COR_FP }}>{fmtBRL(resumo.fpTotal)}</div>
          <span className="text-xs text-slate-400">Itaú + Volks</span>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cobertura</span>
            {tendIcon}
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: COR_COB }}>{resumo.cobertura.toFixed(1)}%</div>
          <span className="text-xs text-slate-400">Floor Plan / Estoque</span>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Limite Disponível</span>
          <div className={`mt-1 text-xl font-bold tabular-nums ${resumo.disponivelTotal < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {fmtBRL(resumo.disponivelTotal)}
          </div>
          <span className="text-xs text-slate-400">Limite total {fmtBRL(resumo.limiteTotal)}</span>
        </div>
      </div>

      {/* ── Limites por banco ── */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">Limites das Linhas de Floor Plan</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LimitePanel
            cor={COR_ITAU} titulo="Banco Itaú"
            limite={limits.itau} utilizado={fpMaisRecente?.itau ?? 0}
            testDrive={limits.itauTestDrive}
            onChangeLimite={v => handleCommitLimit('itau', v)}
            onChangeTestDrive={v => handleCommitLimit('itauTestDrive', v)}
          />
          <LimitePanel
            cor={COR_VOLKS} titulo="Banco Volks"
            limite={limits.volks} utilizado={fpMaisRecente?.volks ?? 0}
            testDrive={limits.volksTestDrive}
            onChangeLimite={v => handleCommitLimit('volks', v)}
            onChangeTestDrive={v => handleCommitLimit('volksTestDrive', v)}
          />
        </div>
      </div>

      {/* ── Tabela por dia ── */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">Estoque x Floor Plan por dia</h3>
          <span className="text-xs text-slate-400">{sortedDates.length} dia(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-white">
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Data</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Estoque VW</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Estoque Audi</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap bg-slate-50">Total Estoque</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Floor Plan Itaú</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Floor Plan Volks</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap bg-slate-50">Total Floor Plan</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Cobertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(expanded ? sortedDates : sortedDates.slice(0, 5)).map((d, i) => {
                const e = entries[d];
                const estVW   = e?.vwUsadosPagos ?? 0;
                const estAudi = e?.audiUsadosPago ?? 0;
                const estTotal = estVW + estAudi;
                const fp = floorplan[d] ?? { itau: 0, volks: 0 };
                const fpTotal = calcTotalFloorPlan(fp);
                const cobertura = estTotal > 0 ? (fpTotal / estTotal) * 100 : 0;
                const isFirst = i === 0;
                return (
                  <tr key={d} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700 whitespace-nowrap">{formatDateBR(d)}</span>
                        {isFirst && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 whitespace-nowrap">
                            Mais recente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs whitespace-nowrap" style={{ color: COR_VW }}>{fmtBRL(estVW)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs whitespace-nowrap" style={{ color: COR_AUDI }}>{fmtBRL(estAudi)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs font-semibold text-slate-700 whitespace-nowrap bg-slate-50/60">{fmtBRL(estTotal)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <CurrencyCell value={fp.itau} onCommit={v => handleCommitFP(d, 'itau', v)} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <CurrencyCell value={fp.volks} onCommit={v => handleCommitFP(d, 'volks', v)} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs font-semibold whitespace-nowrap bg-slate-50/60" style={{ color: COR_FP }}>{fmtBRL(fpTotal)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs whitespace-nowrap">
                      <span className={cobertura > 100 ? 'text-red-600 font-semibold' : 'text-slate-500'}>{cobertura.toFixed(1)}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sortedDates.length > 5 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex justify-center">
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Ver menos
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Ver todos ({sortedDates.length} dias)
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Gráfico de tendência ── */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold text-slate-700">Evolução — Estoque x Floor Plan <span className="font-normal text-slate-400">(últimos 25 dias)</span></h3>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPorMarca}
                onChange={e => setShowPorMarca(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
              />
              Estoque por marca (VW/Audi)
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPorBanco}
                onChange={e => setShowPorBanco(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
              />
              Floor Plan por banco
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showCobertura}
                onChange={e => setShowCobertura(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
              />
              Cobertura %
            </label>
          </div>
        </div>
        <div className="p-4" style={{ height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={fmtAxis}
                width={64}
              />
              {showCobertura && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#16a34a' }}
                  tickFormatter={v => `${v}%`}
                  width={44}
                  domain={[0, (dataMax: number) => Math.max(120, Math.ceil(dataMax / 20) * 20)]}
                />
              )}
              <Tooltip content={<FPTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />

              {showPorMarca ? (
                <>
                  <Line yAxisId="left" type="monotone" dataKey="estVW"   name="Estoque VW"   stroke={COR_VW}   strokeWidth={2} dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="estAudi" name="Estoque Audi" stroke={COR_AUDI} strokeWidth={2} dot={false} />
                </>
              ) : (
                <Line yAxisId="left" type="monotone" dataKey="estTotal" name="Total Estoque" stroke={COR_TOTAL} strokeWidth={2.5} dot={false} />
              )}

              <Line yAxisId="left" type="monotone" dataKey="fpTotal" name="Total Floor Plan" stroke={COR_FP} strokeWidth={2.5} dot={false} />

              {showPorBanco && (
                <>
                  <Line yAxisId="left" type="monotone" dataKey="itau"  name="FP Itaú"  stroke={COR_ITAU}  strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="volks" name="FP Volks" stroke={COR_VOLKS} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                </>
              )}

              {showCobertura && (
                <Line yAxisId="right" type="monotone" dataKey="cobertura" name="Cobertura %" stroke={COR_COB} strokeWidth={2} dot={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}

// ─── Sub-aba: botão ───────────────────────────────────────────────────────────

function SubTabBtn({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-all ${
        active
          ? 'bg-white text-indigo-700 shadow-sm'
          : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Componente principal (sub-abas) ──────────────────────────────────────────

export function FloorPlanTab({ dates }: Props) {
  const [subTab, setSubTab] = useState<'posicao' | 'controle' | 'regras'>('posicao');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Barra de sub-abas */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 print:hidden">
        <div className="inline-flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <SubTabBtn
            active={subTab === 'posicao'}
            onClick={() => setSubTab('posicao')}
            icon={<Landmark className="w-3.5 h-3.5" />}
            label="Posição FloorPlan"
          />
          <SubTabBtn
            active={subTab === 'controle'}
            onClick={() => setSubTab('controle')}
            icon={<Car className="w-3.5 h-3.5" />}
            label="Controle de Veículos"
          />
          <SubTabBtn
            active={subTab === 'regras'}
            onClick={() => setSubTab('regras')}
            icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
            label="Regras"
          />
        </div>
      </div>

      {/* Conteúdo da sub-aba */}
      <div className="flex-1 flex flex-col min-h-0">
        {subTab === 'posicao'  && <PosicaoFloorPlanContent dates={dates} />}
        {subTab === 'controle' && <ControleVeiculosTab />}
        {subTab === 'regras'   && <RegrasTab />}
      </div>
    </div>
  );
}

// ─── Helpers de gráfico ───────────────────────────────────────────────────────

function fmtAxis(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return String(v);
}

interface ChartPoint {
  date: string;
  estVW: number;
  estAudi: number;
  estTotal: number;
  itau: number;
  volks: number;
  fpTotal: number;
  cobertura: number;
}

function FPTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const pctEstoque = d.estTotal > 0 ? (d.fpTotal / d.estTotal) * 100 : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2.5 text-xs min-w-[220px]">
      <div className="font-semibold text-slate-700 mb-2">{label}</div>

      {/* Estoque */}
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 font-semibold" style={{ color: COR_TOTAL }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COR_TOTAL }} />
          Total Estoque
        </span>
        <span className="tabular-nums font-semibold text-slate-800">{fmtBRL(d.estTotal)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 pl-3.5 mt-0.5">
        <span style={{ color: COR_VW }}>VW</span>
        <span className="tabular-nums text-slate-600">{fmtBRL(d.estVW)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 pl-3.5 mt-0.5">
        <span style={{ color: COR_AUDI }}>Audi</span>
        <span className="tabular-nums text-slate-600">{fmtBRL(d.estAudi)}</span>
      </div>

      <div className="border-t border-slate-100 my-2" />

      {/* Floor Plan */}
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 font-semibold" style={{ color: COR_FP }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COR_FP }} />
          Total Floor Plan
        </span>
        <span className="tabular-nums font-semibold text-slate-800">{fmtBRL(d.fpTotal)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 pl-3.5 mt-0.5">
        <span style={{ color: COR_COB }}>% sobre estoque</span>
        <span className="tabular-nums font-medium" style={{ color: COR_COB }}>{pctEstoque.toFixed(1)}%</span>
      </div>
    </div>
  );
}
