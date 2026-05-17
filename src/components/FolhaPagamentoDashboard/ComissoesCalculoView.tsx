import { useState, useEffect } from 'react';
import { ChevronDown, Calculator, Save, Check } from 'lucide-react';
import {
  loadPeriodos,
  savePeriodo,
  periodoKey,
  type PeriodoApuracao,
} from './comissoesCalculoPeriodoStorage';

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
