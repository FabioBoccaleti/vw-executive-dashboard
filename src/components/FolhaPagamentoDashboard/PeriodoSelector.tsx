import { ChevronDown } from 'lucide-react';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;
const DEFAULT_YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

interface PeriodoSelectorProps {
  /** Ano selecionado. */
  year: number;
  /** Mês selecionado (1-12) ou null para "Ano todo". */
  month: number | null;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number | null) => void;
  /** Anos disponíveis no seletor. Padrão: últimos 5 anos. */
  availableYears?: number[];
  /** Contadores opcionais por mês (1-12) para exibir badges. */
  monthCounts?: Record<number, number>;
}

export function PeriodoSelector({
  year,
  month,
  onYearChange,
  onMonthChange,
  availableYears = DEFAULT_YEARS,
  monthCounts,
}: PeriodoSelectorProps) {
  return (
    <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 flex-shrink-0 flex-wrap">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">ANO</span>
      <div className="relative mr-2">
        <select
          value={year}
          onChange={e => onYearChange(Number(e.target.value))}
          className="appearance-none text-sm font-bold text-slate-700 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
        >
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      </div>
      <div className="w-px h-5 bg-slate-200 mr-1" />
      <button
        onClick={() => onMonthChange(null)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          month === null ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
        }`}
      >
        Ano todo
      </button>
      {MONTHS.map((name, idx) => {
        const m = idx + 1;
        const count = monthCounts?.[m] ?? 0;
        const isActive = month === m;
        const hasData = count > 0;
        return (
          <button
            key={m}
            onClick={() => onMonthChange(m)}
            className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isActive
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            {name}
            {hasData && (
              <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 rounded-full leading-none py-0.5 ${
                isActive ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-600'
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
