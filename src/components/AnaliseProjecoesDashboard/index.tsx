import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Download, Upload, Edit3, Check, X,
  BarChart2, AlertTriangle, Loader2, Settings, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  loadAllBudgetVw,
  loadAllBudgetAudi,
  saveBudgetVw,
  saveBudgetAudi,
  type BudgetVwRow,
  type BudgetAudiRow,
} from './projecoesStorage';
import {
  exportBudgetTemplate,
  exportBudgetWithData,
  importBudgetFromExcel,
} from './excelUtils';
import {
  ComparativoTab,
  DeptSelector,
  getPeriodoOptions,
  type CompType,
  type MarcaType,
  type PeriodoType,
} from './ComparativoTab';
import { AnualView } from './AnualView';
import { loadAllDreVw, type DreVwRow } from '../ResumoDREDashboard/dreVwStorage';
import { loadAllDreAudi, type DreAudiRow } from '../ResumoDREDashboard/dreAudiStorage';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AnaliseProjecoesDashboardProps {
  onChangeBrand: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PERIODO_TYPES: { value: PeriodoType; label: string }[] = [
  { value: 'mensal',     label: 'Mensal' },
  { value: 'bimestral',  label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral',  label: 'Semestral' },
  { value: 'anual',      label: 'Anual' },
];

const MARCAS: { value: MarcaType; label: string; color: string }[] = [
  { value: 'vw',         label: 'VW Norte',    color: '#001e50' },
  { value: 'audi',       label: 'Audi',        color: '#bb0a30' },
  { value: 'consolidado',label: 'Consolidado', color: '#4c1d95' },
];

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ─── Componente ───────────────────────────────────────────────────────────────

export function AnaliseProjecoesDashboard({ onChangeBrand }: AnaliseProjecoesDashboardProps) {
  const BUDGET_YEAR = 2026;

  // ── Estado de dados ────────────────────────────────────────────────────────
  const [budgetVw,     setBudgetVw]     = useState<(BudgetVwRow | null)[]>(Array(12).fill(null));
  const [budgetAudi,   setBudgetAudi]   = useState<(BudgetAudiRow | null)[]>(Array(12).fill(null));
  const [real2025Vw,   setReal2025Vw]   = useState<(DreVwRow | null)[]>(Array(12).fill(null));
  const [real2025Audi, setReal2025Audi] = useState<(DreAudiRow | null)[]>(Array(12).fill(null));
  const [real2026Vw,   setReal2026Vw]   = useState<(DreVwRow | null)[]>(Array(12).fill(null));
  const [real2026Audi, setReal2026Audi] = useState<(DreAudiRow | null)[]>(Array(12).fill(null));
  const [loading,      setLoading]      = useState(true);

  // ── Estado de UI ───────────────────────────────────────────────────────────
  const [activeComp,   setActiveComp]   = useState<CompType>('real2025_vs_budget2026');
  const [marca,        setMarca]        = useState<MarcaType>('vw');
  const [periodoType,  setPeriodoType]  = useState<PeriodoType>('mensal');
  const [periodoIdx,   setPeriodoIdx]   = useState<number>(new Date().getMonth());
  const [threshold,    setThreshold]    = useState<number>(10);
  const [editMode,     setEditMode]     = useState(false);
  const [deptView,     setDeptView]     = useState<string>('all');
  const [importing,    setImporting]    = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [anualMode,    setAnualMode]    = useState(false);
  const [hideZeros,    setHideZeros]    = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Carga inicial de dados ─────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [bvw, baudi, r25vw, r25audi, r26vw, r26audi] = await Promise.all([
          loadAllBudgetVw(BUDGET_YEAR),
          loadAllBudgetAudi(BUDGET_YEAR),
          loadAllDreVw(2025),
          loadAllDreAudi(2025),
          loadAllDreVw(2026),
          loadAllDreAudi(2026),
        ]);
        setBudgetVw(bvw);
        setBudgetAudi(baudi);
        setReal2025Vw(r25vw);
        setReal2025Audi(r25audi);
        setReal2026Vw(r26vw);
        setReal2026Audi(r26audi);
      } catch (err) {
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Ao mudar tipo de período, ajusta o índice para o mês atual (ou 0)
  useEffect(() => {
    const opts = getPeriodoOptions(periodoType);
    const currentMonth = new Date().getMonth();
    if (periodoType === 'mensal') {
      setPeriodoIdx(Math.min(currentMonth, 11));
    } else {
      // Encontra o período que contém o mês atual
      const idx = opts.findIndex(opt => opt.months.includes(currentMonth));
      setPeriodoIdx(idx >= 0 ? idx : 0);
    }
  }, [periodoType]);

  // ── Callbacks de edição ────────────────────────────────────────────────────
  const handleBudgetVwChange = (updated: BudgetVwRow, monthIdx: number) => {
    setBudgetVw(prev => {
      const next = [...prev];
      next[monthIdx] = updated;
      return next;
    });
  };

  const handleBudgetAudiChange = (updated: BudgetAudiRow, monthIdx: number) => {
    setBudgetAudi(prev => {
      const next = [...prev];
      next[monthIdx] = updated;
      return next;
    });
  };

  // ── Export / Import ────────────────────────────────────────────────────────
  const handleExportTemplate = () => {
    exportBudgetTemplate(BUDGET_YEAR);
    toast.success('Template exportado');
  };

  const handleExportWithData = () => {
    exportBudgetWithData(BUDGET_YEAR, budgetVw, budgetAudi);
    toast.success('Budget exportado com dados');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImporting(true);
    try {
      const result = await importBudgetFromExcel(file, BUDGET_YEAR);

      if (result.errors.length > 0) {
        result.errors.forEach(err => toast.error(err));
      }

      if (result.monthsImported === 0) {
        toast.error('Nenhum mês importado. Verifique o arquivo.');
        return;
      }

      // Persiste no KV e atualiza estado
      await Promise.all([
        ...result.vwRows.map(row => saveBudgetVw(row)),
        ...result.audiRows.map(row => saveBudgetAudi(row)),
      ]);

      // Atualiza os meses importados no estado
      setBudgetVw(prev => {
        const next = [...prev];
        result.vwRows.forEach(row => {
          const mi = Number(row.periodo.split('-')[1]) - 1;
          next[mi] = row;
        });
        return next;
      });
      setBudgetAudi(prev => {
        const next = [...prev];
        result.audiRows.forEach(row => {
          const mi = Number(row.periodo.split('-')[1]) - 1;
          next[mi] = row;
        });
        return next;
      });

      toast.success(`${result.monthsImported} mês(es) importado(s) com sucesso`);
    } catch (err) {
      toast.error('Erro ao importar arquivo');
    } finally {
      setImporting(false);
    }
  };

  // ── Verifica se há dados de budget ────────────────────────────────────────
  const hasBudgetData = budgetVw.some(r => r !== null) || budgetAudi.some(r => r !== null);

  // ── Período atual ─────────────────────────────────────────────────────────
  const periodoOptions = getPeriodoOptions(periodoType);
  const safeIdx = Math.min(periodoIdx, periodoOptions.length - 1);
  const selectedPeriodLabel = (() => {
    if (periodoType === 'mensal') return periodoOptions[safeIdx]?.label ?? null;
    if (periodoType === 'bimestral') return `${safeIdx + 1}º Bim`;
    if (periodoType === 'trimestral') return `${safeIdx + 1}º Trim`;
    if (periodoType === 'semestral') return `${safeIdx + 1}º Sem`;
    return null;
  })();
  const budgetLabel = selectedPeriodLabel ? `Budget ${selectedPeriodLabel} ${BUDGET_YEAR}` : `Budget ${BUDGET_YEAR}`;
  const real2025Label = selectedPeriodLabel ? `Real ${selectedPeriodLabel} 2025` : 'Real 2025';
  const real2026Label = selectedPeriodLabel ? `Real ${selectedPeriodLabel} 2026` : 'Real 2026';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onChangeBrand}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50 flex items-center gap-1"
          >
            <ArrowLeft size={13} /> Voltar
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
              <BarChart2 size={14} className="text-orange-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 leading-tight">Análise de Projeções</h1>
              <p className="text-[10px] text-slate-400">Demonstrativo de Resultados</p>
            </div>
          </div>
        </div>

        {/* Ações do header */}
        <div className="flex items-center gap-2">
          {/* Botões Export/Import */}
          <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3 mr-1">
            <button
              onClick={handleExportTemplate}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] border border-slate-200 rounded text-slate-600 hover:bg-slate-50 transition-colors"
              title="Exportar template vazio para preenchimento"
            >
              <Download size={12} /> Template
            </button>
            {hasBudgetData && (
              <button
                onClick={handleExportWithData}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] border border-slate-200 rounded text-slate-600 hover:bg-slate-50 transition-colors"
                title="Exportar budget com dados já preenchidos"
              >
                <Download size={12} /> Budget
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] border border-orange-300 rounded text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors disabled:opacity-50"
              title="Importar budget via Excel"
            >
              {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Importar
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImport}
            />
          </div>

          {/* Edição */}
          <button
            onClick={() => setEditMode(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded border font-medium transition-colors ${
              editMode
                ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title={editMode ? 'Sair do modo edição' : 'Editar valores do budget'}
          >
            {editMode ? <><Check size={12} /> Editar: ON</> : <><Edit3 size={12} /> Editar Budget</>}
          </button>

          {/* Configurações (threshold) */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(v => !v)}
              className={`p-1.5 rounded border transition-colors ${showSettings ? 'bg-slate-100 border-slate-300' : 'border-slate-200 hover:bg-slate-50'}`}
              title="Configurações de alerta"
            >
              <Settings size={14} className="text-slate-500" />
            </button>
            {showSettings && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 w-64 z-30">
                <p className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-amber-500" />
                  Alertas de distorção
                </p>
                <label className="text-xs text-slate-600 block mb-1">
                  Alertar quando variação ≥
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={threshold}
                    onChange={e => setThreshold(Number(e.target.value))}
                    className="w-20 text-sm border border-slate-200 rounded px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Ícone ⚠️ aparece nas linhas onde |Var %| ≥ {threshold}%
                </p>
                <button
                  onClick={() => setShowSettings(false)}
                  className="mt-3 w-full text-xs text-center text-slate-500 hover:text-slate-700"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Tabs de comparação ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-0">
          {([
            { key: 'real2025_vs_budget2026', label: '2025 Real vs Budget 2026', desc: 'Divergência entre realizado 2025 e o orçamento projetado' },
            { key: 'budget2026_vs_real2026', label: 'Budget 2026 vs 2026 Real',   desc: 'Aderência do executado 2026 ao orçamento' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveComp(tab.key)}
              title={tab.desc}
              className={`px-5 py-3 text-xs font-medium border-b-2 transition-colors ${
                activeComp === tab.key
                  ? 'border-orange-500 text-orange-700 bg-orange-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Faixa 1: Marca + Modo + Zeros ───────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-6 py-2 flex flex-wrap items-center gap-3">

        {/* Marca */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Marca</span>
          <div className="flex gap-1">
            {MARCAS.map(m => (
              <button
                key={m.value}
                onClick={() => { setMarca(m.value); setDeptView('all'); }}
                className="px-2.5 py-1 rounded text-xs font-medium border transition-all"
                style={marca === m.value
                  ? { backgroundColor: m.color, color: '#fff', borderColor: m.color }
                  : { backgroundColor: '#fff', color: '#475569', borderColor: '#e2e8f0' }
                }
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-4 w-px bg-slate-200" />

        {/* Tipo de período + Anual */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Modo</span>
          <select
            value={periodoType}
            onChange={e => { setPeriodoType(e.target.value as PeriodoType); setAnualMode(false); }}
            disabled={anualMode}
            className={`text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white transition-opacity ${anualMode ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {PERIODO_TYPES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <button
            onClick={() => setAnualMode(v => !v)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              anualMode
                ? 'bg-slate-700 text-white border-slate-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Ver todos os 12 meses como colunas"
          >
            Anual
          </button>
        </div>

        <div className="h-4 w-px bg-slate-200" />

        {/* Zeros */}
        <button
          onClick={() => setHideZeros(v => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
            hideZeros
              ? 'bg-slate-700 text-white border-slate-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
          title="Ocultar linhas com todos os valores zerados"
        >
          {hideZeros ? <Eye size={12} /> : <EyeOff size={12} />}
          Zeros
        </button>

        {/* Indicador de modo edição */}
        {editMode && (
          <div className="ml-auto flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded px-2.5 py-1">
            <Edit3 size={11} className="text-orange-500" />
            <span className="text-[11px] text-orange-700 font-medium">Modo edição ativo — clique nos valores do Budget para editar. Salvo automaticamente ao confirmar.</span>
            <button onClick={() => setEditMode(false)} className="ml-1 text-orange-400 hover:text-orange-600">
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* ─── Faixa 2: Pills de período (some em modo Anual) ───────────────────── */}
      {!anualMode && (
        <div className="bg-white border-b border-slate-100 px-6 py-1.5 flex flex-wrap items-center gap-1">
          {periodoType === 'mensal'
            ? MONTHS_SHORT.map((m, i) => {
                const hasBudget = budgetVw[i] !== null || budgetAudi[i] !== null;
                const isActive  = safeIdx === i;
                return (
                  <button
                    key={i}
                    onClick={() => setPeriodoIdx(i)}
                    className={`relative px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                      isActive
                        ? 'bg-slate-700 text-white border-slate-700'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {m}
                    {hasBudget && (
                      <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-white ${
                        isActive ? 'bg-orange-300' : 'bg-orange-500'
                      }`} />
                    )}
                  </button>
                );
              })
            : periodoType !== 'anual'
              ? periodoOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setPeriodoIdx(i)}
                    className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                      safeIdx === i
                        ? 'bg-slate-700 text-white border-slate-700'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))
              : null
          }
        </div>
      )}

      {/* ─── Faixa 3: Departamento ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mr-0.5">Depto</span>
        <DeptSelector marca={marca} value={deptView} onChange={setDeptView} />
      </div>

      {/* ─── Conteúdo principal ───────────────────────────────────────────────── */}
      <div className="flex-1 p-4 md:p-6">

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-orange-400" />
          </div>
        ) : (
          <>
            {/* Banner quando não há budget carregado */}
            {!hasBudgetData && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Nenhum budget importado para {BUDGET_YEAR}</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Clique em <strong>Template</strong> para baixar o modelo Excel, preencha e importe com <strong>Importar</strong>.
                    Você também pode editar os valores diretamente aqui com o botão <strong>Editar Budget</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Card da tabela */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Título do card */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-700">
                    {activeComp === 'real2025_vs_budget2026'
                      ? `Comparativo: ${real2025Label} vs ${budgetLabel}`
                      : `Comparativo: ${budgetLabel} vs ${real2026Label}`}
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {MARCAS.find(m => m.value === marca)?.label} · {anualMode ? 'Visão Anual — 12 meses' : periodoOptions[safeIdx]?.label}
                    {deptView !== 'all' && ` · Depto: ${deptView}`}
                    {threshold > 0 && ` · Alerta ≥ ${threshold}%`}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-100 inline-block border border-green-200" /> Var. favorável</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-100 inline-block border border-red-200" /> Var. desfavorável</span>
                  <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-amber-500" /> Distor. ≥{threshold}%</span>
                </div>
              </div>

              {anualMode ? (
                <AnualView
                  compType={activeComp}
                  marca={marca}
                  budgetVwMonths={budgetVw}
                  budgetAudiMonths={budgetAudi}
                  real2025VwMonths={real2025Vw}
                  real2025AudiMonths={real2025Audi}
                  real2026VwMonths={real2026Vw}
                  real2026AudiMonths={real2026Audi}
                  deptView={deptView}
                  threshold={threshold}
                  hideZeros={hideZeros}
                />
              ) : (
                <ComparativoTab
                  compType={activeComp}
                  marca={marca}
                  periodoType={periodoType}
                  periodoIdx={safeIdx}
                  threshold={threshold}
                  editMode={editMode}
                  budgetVwMonths={budgetVw}
                  budgetAudiMonths={budgetAudi}
                  real2025VwMonths={real2025Vw}
                  real2025AudiMonths={real2025Audi}
                  real2026VwMonths={real2026Vw}
                  real2026AudiMonths={real2026Audi}
                  deptView={deptView}
                  onBudgetVwChange={handleBudgetVwChange}
                  onBudgetAudiChange={handleBudgetAudiChange}
                  hideZeros={hideZeros}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
