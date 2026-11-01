/**
 * Aba "DRE" do Ebitda VW.
 *
 * Reaproveita integralmente a aba "VW" do dashboard "Resumo DRE"
 * (conteúdo, layout e departamentos), exceto a sub-aba "Ajustes", em modo
 * somente leitura. Como o `VwDreTab` lê exatamente a mesma fonte de dados,
 * qualquer atualização/importação no Resumo DRE VW reflete aqui
 * automaticamente. Possui seletor de período (ano + mês, com "Ano Completo").
 */

import { useEffect, useMemo, useState } from 'react';
import { VwDreTab } from '@/components/ResumoDREDashboard/VwDreTab';
import { loadInfluenciaDF, makeInfluenciaOverlay, type InfluenciaDFRule } from './ebitdaInfluenciaStorage';

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

const MONTHS_LABEL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function DreTab() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [rule, setRule] = useState<InfluenciaDFRule | null>(null);

  useEffect(() => {
    loadInfluenciaDF().then(setRule);
  }, []);

  const overlay = useMemo(
    () => (rule ? makeInfluenciaOverlay(rule) : undefined),
    [rule],
  );

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Seletor de período */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm flex items-center gap-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Período</label>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
        >
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={month}
          onChange={e => setMonth(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
        >
          <option value={0}>Ano Completo</option>
          {MONTHS_LABEL.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
      </div>

      {/* Conteúdo da aba VW do Resumo DRE — somente leitura, sem Ajustes */}
      <div className="flex flex-col flex-1 min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden">
        <VwDreTab year={year} month={month} diasUteis={22} hideAjustes readOnly overlay={overlay} />
      </div>
    </div>
  );
}
