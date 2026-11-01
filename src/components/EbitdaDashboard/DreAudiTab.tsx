/**
 * Aba "DRE" do Ebitda Audi.
 *
 * Reaproveita a aba "Audi" do dashboard "Resumo DRE" (conteúdo, layout e
 * departamentos), exceto a sub-aba "Ajustes", em modo somente leitura. Aplica
 * o overlay de influência das Despesas Financeiras (regra Audi própria) e abre
 * no último mês com dados. Não altera o Resumo DRE original.
 */

import { useEffect, useMemo, useState } from 'react';
import { AudiDreTab } from '@/components/ResumoDREDashboard/AudiDreTab';
import { loadInfluenciaAudiDF, makeInfluenciaAudiOverlay } from './ebitdaInfluenciaAudiStorage';
import type { InfluenciaDFRule } from './ebitdaInfluenciaStorage';
import { detectLatestDrePeriod } from './detectLatestDrePeriod';

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

const MONTHS_LABEL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function DreAudiTab() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [rule, setRule] = useState<InfluenciaDFRule | null>(null);

  useEffect(() => {
    loadInfluenciaAudiDF().then(setRule);
  }, []);

  // Ao abrir, posiciona no último mês/ano com dados na DRE Audi.
  useEffect(() => {
    detectLatestDrePeriod('audi').then(period => {
      if (period) {
        setYear(period.year);
        setMonth(period.month);
      }
    });
  }, []);

  const overlay = useMemo(
    () => (rule ? makeInfluenciaAudiOverlay(rule) : undefined),
    [rule],
  );

  const ajustada = !!rule && (
    (!!rule.targetField && (rule.selectedContas === undefined || rule.selectedContas.length > 0)) ||
    (rule.zeroedLines?.length ?? 0) > 0
  );

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Seletor de período */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm flex items-center gap-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Período</label>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
        >
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={month}
          onChange={e => setMonth(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
        >
          <option value={0}>Ano Completo</option>
          {MONTHS_LABEL.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
      </div>

      {/* Conteúdo da aba Audi do Resumo DRE — somente leitura, sem Ajustes */}
      <div className="flex flex-col flex-1 min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden">
        <AudiDreTab year={year} month={month} diasUteis={22} hideAjustes readOnly overlay={overlay} ajustada={ajustada} />
      </div>
    </div>
  );
}
