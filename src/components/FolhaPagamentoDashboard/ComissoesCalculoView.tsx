import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Save, Check, ChevronRight, RefreshCw } from 'lucide-react';
import {
  loadVendasResultadoRows,
  type VendasResultadoRow,
} from '@/components/VendasBonificacoesDashboard/vendasResultadoStorage';
import {
  loadRemuneracao,
  loadAliquotas,
  type RemuneracaoData,
} from '@/components/VendasBonificacoesDashboard/vendedoresRemuneracaoStorage';
import {
  loadPeriodos,
  savePeriodo,
  periodoKey,
  type PeriodoApuracao,
} from './comissoesCalculoPeriodoStorage';
import { ComissoesCalculoDemonstrativo } from './ComissoesCalculoDemonstrativo';

// ─── Constantes ───────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'] as const;
const AVAILABLE_YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseDataVenda(d: string): Date | null {
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) {
    const [dd, mm, yyyy] = d.split('/');
    return new Date(`${yyyy}-${mm}-${dd}`);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return new Date(d);
  return null;
}

function fmtDate(d: string): string {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ComissoesCalculoViewProps {
  tab: 'novos' | 'usados';
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function ComissoesCalculoView({ tab }: ComissoesCalculoViewProps) {
  const [filterYear,  setFilterYear]  = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(new Date().getMonth() + 1);

  // Períodos de apuração
  const [periodoMap, setPeriodoMap] = useState<Record<string, PeriodoApuracao>>({});
  const [editDe,  setEditDe]  = useState('');
  const [editAte, setEditAte] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  // Dados
  const [rows, setRows]               = useState<VendasResultadoRow[]>([]);
  const [remuneracao, setRemuneracao] = useState<RemuneracaoData | null>(null);
  const [aliquotaBonPct, setAliquotaBonPct] = useState(0);
  const [loading, setLoading]         = useState(true);

  // Navegação para demonstrativo
  const [selectedVendedor, setSelectedVendedor] = useState<string | null>(null);

  // Carrega tudo ao montar / trocar aba
  useEffect(() => {
    setLoading(true);
    setSelectedVendedor(null);
    Promise.all([
      loadVendasResultadoRows(tab),
      loadRemuneracao(),
      loadAliquotas(),
      loadPeriodos(tab),
    ]).then(([vendasRows, remun, aliquotas, periodos]) => {
      setRows(vendasRows);
      setRemuneracao(remun);
      setAliquotaBonPct(aliquotas.reduce((acc, i) => acc + (parseFloat(i.aliquota) || 0), 0));
      setPeriodoMap(periodos);
    }).finally(() => setLoading(false));
  }, [tab]);

  // Sincroniza campos de edição ao mudar mês/ano
  useEffect(() => {
    if (filterMonth === null) return;
    const stored = periodoMap[periodoKey(filterYear, filterMonth)];
    setEditDe(stored?.de  ?? '');
    setEditAte(stored?.ate ?? '');
    setSaved(false);
    setSelectedVendedor(null);
  }, [filterMonth, filterYear, periodoMap]);

  async function handleSave() {
    if (filterMonth === null) return;
    setSaving(true);
    try {
      await savePeriodo(tab, filterYear, filterMonth, { de: editDe, ate: editAte });
      setPeriodoMap(prev => ({
        ...prev,
        [periodoKey(filterYear, filterMonth)]: { de: editDe, ate: editAte },
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const hasPeriodo = (year: number, month: number) => {
    const p = periodoMap[periodoKey(year, month)];
    return !!(p?.de && p?.ate);
  };

  // Período salvo (não o que está em edição)
  const savedPeriodo = filterMonth !== null
    ? periodoMap[periodoKey(filterYear, filterMonth)]
    : undefined;

  // Filtra vendas pelo período salvo
  const periodRows = useMemo(() => {
    if (!savedPeriodo?.de || !savedPeriodo?.ate) return [];
    const de  = new Date(savedPeriodo.de);
    const ate = new Date(savedPeriodo.ate);
    ate.setHours(23, 59, 59, 999);
    return rows.filter(r => {
      const d = parseDataVenda(r.dataVenda);
      return d !== null && d >= de && d <= ate;
    });
  }, [rows, savedPeriodo]);

  // Agrupa por vendedor (ordenado A-Z)
  const vendedoresMap = useMemo(() => {
    const map = new Map<string, VendasResultadoRow[]>();
    for (const r of periodRows) {
      const v = r.vendedor?.trim() || '(sem nome)';
      map.set(v, [...(map.get(v) ?? []), r]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [periodRows]);

  // Linhas do vendedor selecionado
  const vendedorRows = useMemo(() =>
    vendedoresMap.find(([v]) => v === selectedVendedor)?.[1] ?? [],
  [selectedVendedor, vendedoresMap]);

  const periodoLabel = savedPeriodo?.de && savedPeriodo?.ate
    ? `${fmtDate(savedPeriodo.de)} a ${fmtDate(savedPeriodo.ate)}`
    : '';

  // ── Exibe demonstrativo quando vendedor selecionado ──────────────────────
  if (selectedVendedor && remuneracao && filterMonth !== null) {
    return (
      <ComissoesCalculoDemonstrativo
        vendedor={selectedVendedor}
        rows={vendedorRows}
        tab={tab}
        remuneracao={remuneracao}
        aliquotaBonPct={aliquotaBonPct}
        periodoLabel={periodoLabel}
        year={filterYear}
        month={filterMonth}
        onBack={() => setSelectedVendedor(null)}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>

      {/* ── Seletor Ano / Mês ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 flex-shrink-0 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">ANO</span>
        <div className="relative mr-2">
          <select
            value={filterYear}
            onChange={e => { setFilterYear(Number(e.target.value)); setSaved(false); }}
            className="appearance-none text-sm font-bold text-slate-700 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
          >
            {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="w-px h-5 bg-slate-200 mr-1" />
        <button
          onClick={() => setFilterMonth(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterMonth === null
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
        >
          Ano todo
        </button>
        {MONTHS.map((name, idx) => {
          const m = idx + 1;
          const isActive  = filterMonth === m;
          const temPeriodo = hasPeriodo(filterYear, m);
          return (
            <button
              key={m}
              onClick={() => setFilterMonth(m)}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              {name}
              {temPeriodo && !isActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Barra de Período de Apuração ─────────────────────────────────── */}
      {filterMonth !== null && (
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex items-center gap-3 flex-shrink-0 flex-wrap">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider whitespace-nowrap">
            Período de Apuração
          </span>
          <div className="w-px h-4 bg-emerald-200" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-emerald-700 font-medium whitespace-nowrap">De</label>
            <input
              type="date"
              value={editDe}
              onChange={e => { setEditDe(e.target.value); setSaved(false); }}
              className="border border-emerald-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-emerald-700 font-medium whitespace-nowrap">até</label>
            <input
              type="date"
              value={editAte}
              onChange={e => { setEditAte(e.target.value); setSaved(false); }}
              className="border border-emerald-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !editDe || !editAte}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {saved
              ? <><Check className="w-3.5 h-3.5" /> Salvo</>
              : <><Save className="w-3.5 h-3.5" /> Salvar</>
            }
          </button>
        </div>
      )}

      {/* ── Conteúdo ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Carregando...
          </div>
        ) : filterMonth === null ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Selecione um mês para configurar o período de apuração.
          </div>
        ) : !savedPeriodo?.de || !savedPeriodo?.ate ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Defina e salve o período de apuração para visualizar as vendas.
          </div>
        ) : vendedoresMap.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Nenhuma venda encontrada no período {periodoLabel}.
          </div>
        ) : (
          <div className="p-4 max-w-4xl mx-auto space-y-3">

            {/* Barra de resumo */}
            <div className="flex items-center gap-2 px-1 py-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-700">
                {MONTH_NAMES[filterMonth - 1]} de {filterYear}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-sm text-slate-500">
                {vendedoresMap.length} {vendedoresMap.length === 1 ? 'vendedor' : 'vendedores'}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-sm text-slate-500">
                {periodRows.length} {periodRows.length === 1 ? 'venda' : 'vendas'} no período
              </span>
            </div>

            {/* Cards de vendedores */}
            {vendedoresMap.map(([vendedor, vRows]) => (
              <button
                key={vendedor}
                onClick={() => setSelectedVendedor(vendedor)}
                className="w-full text-left bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-slate-300 hover:shadow-sm transition-all flex items-center gap-4"
              >
                {/* Avatar com inicial */}
                <div className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {vendedor.trim().charAt(0).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{vendedor}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {tab === 'novos' ? 'Veículos Novos' : 'Veículos Usados'}
                    {' · '}
                    {vRows.length} {vRows.length === 1 ? 'venda' : 'vendas'}
                  </p>
                </div>
                {/* Status */}
                <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold whitespace-nowrap flex-shrink-0">
                  Pendente
                </span>
                {/* Valor placeholder */}
                <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                  Sem lançamento
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </button>
            ))}

          </div>
        )}
      </div>

    </div>
  );
}


// ─── Constantes ───────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'] as const;
const AVAILABLE_YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

// ─── Props ────────────────────────────────────────────────────────────────────
interface ComissoesCalculoViewProps {
  tab: 'novos' | 'usados';
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function ComissoesCalculoView({ tab }: ComissoesCalculoViewProps) {
  const [filterYear, setFilterYear]   = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(new Date().getMonth() + 1);

  // Mapa de períodos carregados do storage: "year-month" → { de, ate }
  const [periodoMap, setPeriodoMap] = useState<Record<string, PeriodoApuracao>>({});
  // Campos em edição para o mês selecionado
  const [editDe,  setEditDe]  = useState('');
  const [editAte, setEditAte] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  // Carrega todos os períodos do storage ao montar / trocar aba
  useEffect(() => {
    loadPeriodos(tab).then(setPeriodoMap);
  }, [tab]);

  // Sincroniza campos de edição ao mudar mês/ano
  useEffect(() => {
    if (filterMonth === null) return;
    const stored = periodoMap[periodoKey(filterYear, filterMonth)];
    setEditDe(stored?.de  ?? '');
    setEditAte(stored?.ate ?? '');
    setSaved(false);
  }, [filterMonth, filterYear, periodoMap]);

  async function handleSave() {
    if (filterMonth === null) return;
    setSaving(true);
    try {
      await savePeriodo(tab, filterYear, filterMonth, { de: editDe, ate: editAte });
      setPeriodoMap(prev => ({
        ...prev,
        [periodoKey(filterYear, filterMonth)]: { de: editDe, ate: editAte },
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const hasPeriodo = (year: number, month: number) => {
    const p = periodoMap[periodoKey(year, month)];
    return !!(p?.de && p?.ate);
  };

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>

      {/* ── Seletor Ano / Mês ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 flex-shrink-0 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">ANO</span>
        <div className="relative mr-2">
          <select
            value={filterYear}
            onChange={e => { setFilterYear(Number(e.target.value)); setSaved(false); }}
            className="appearance-none text-sm font-bold text-slate-700 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
          >
            {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="w-px h-5 bg-slate-200 mr-1" />
        <button
          onClick={() => setFilterMonth(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterMonth === null
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
        >
          Ano todo
        </button>
        {MONTHS.map((name, idx) => {
          const m = idx + 1;
          const isActive = filterMonth === m;
          const temPeriodo = hasPeriodo(filterYear, m);
          return (
            <button
              key={m}
              onClick={() => setFilterMonth(m)}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              {name}
              {temPeriodo && !isActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Barra de Período de Apuração (somente quando mês selecionado) ── */}
      {filterMonth !== null && (
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex items-center gap-3 flex-shrink-0 flex-wrap">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider whitespace-nowrap">
            Período de Apuração
          </span>
          <div className="w-px h-4 bg-emerald-200" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-emerald-700 font-medium whitespace-nowrap">De</label>
            <input
              type="date"
              value={editDe}
              onChange={e => { setEditDe(e.target.value); setSaved(false); }}
              className="border border-emerald-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-emerald-700 font-medium whitespace-nowrap">até</label>
            <input
              type="date"
              value={editAte}
              onChange={e => { setEditAte(e.target.value); setSaved(false); }}
              className="border border-emerald-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !editDe || !editAte}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {saved
              ? <><Check className="w-3.5 h-3.5" /> Salvo</>
              : <><Save className="w-3.5 h-3.5" /> Salvar</>
            }
          </button>
        </div>
      )}

      {/* ── Conteúdo ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <Calculator className="w-12 h-12 text-slate-300" />
          <p className="text-sm text-slate-400">
            Cálculo de comissões em desenvolvimento.
          </p>
        </div>
      </div>

    </div>
  );
}
