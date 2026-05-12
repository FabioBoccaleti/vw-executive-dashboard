import { useState, useEffect } from 'react';
import { kvKeys } from '@/lib/kvClient';
import { loadDREDataAsync } from '@/lib/dbStorage';
import { ArrowLeft } from 'lucide-react';
import { AudiDreTab } from './AudiDreTab';
import { AudiGraficosTab } from './AudiGraficosTab';
import { VwDreTab } from './VwDreTab';
import { VwGraficosTab } from './VwGraficosTab';
import { ConsolidadoDreTab } from './ConsolidadoDreTab';
import { ConsolidadoGraficosTab } from './ConsolidadoGraficosTab';
import { MensalDreTab } from './MensalDreTab';
import { SaidasCaixaTab } from './SaidasCaixaTab';
import { EndividamentoDRETab } from './EndividamentoDRETab';
import { AnaliseDespesasEvolucaoTab } from './AnaliseDespesasEvolucaoTab';
import { ReceitaVendasEvolucaoTab } from './ReceitaVendasEvolucaoTab';

interface ResumoDREDashboardProps {
  onChangeBrand: () => void;
}

type TabId = 'vw' | 'audi' | 'consolidado' | 'audi-graficos' | 'vw-graficos' | 'consolidado-graficos' | 'mensal' | 'saidas-caixa' | 'endividamento-dre' | 'analise-evolucao' | 'receita-evolucao';

const TABS: { id: TabId; label: string; color: string; activeColor: string }[] = [
  { id: 'vw',                    label: 'VW',                    color: '#001e50', activeColor: '#001e50' },
  { id: 'vw-graficos',           label: 'VW Gráficos',           color: '#001e50', activeColor: '#001233' },
  { id: 'audi',                  label: 'Audi',                  color: '#bb0a30', activeColor: '#bb0a30' },
  { id: 'audi-graficos',         label: 'Audi Gráficos',         color: '#bb0a30', activeColor: '#9a0827' },
  { id: 'consolidado',           label: 'Consolidado',           color: '#7c3aed', activeColor: '#7c3aed' },
  { id: 'consolidado-graficos',  label: 'Consol. Gráficos',      color: '#7c3aed', activeColor: '#5b21b6' },
  { id: 'mensal',                label: 'Mensal',                color: '#0f766e', activeColor: '#0d6660' },
  { id: 'saidas-caixa',          label: 'Saídas de Caixa',       color: '#dc2626', activeColor: '#b91c1c' },
  { id: 'endividamento-dre',     label: 'Endividamento',          color: '#0284c7', activeColor: '#0369a1' },
  { id: 'analise-evolucao',       label: 'Evolução Despesas',      color: '#0f766e', activeColor: '#0d6660' },
  { id: 'receita-evolucao',        label: 'Evolução Receita',       color: '#0369a1', activeColor: '#025d91' },
];

const MONTHS_LABEL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export function ResumoDREDashboard({ onChangeBrand }: ResumoDREDashboardProps) {
  const CURRENT_YEAR  = new Date().getFullYear();
  const CURRENT_MONTH = new Date().getMonth() + 1;

  const [activeTab,  setActiveTab]  = useState<TabId>('vw');
  const [year,       setYear]       = useState(CURRENT_YEAR);
  const [month,      setMonth]      = useState(CURRENT_MONTH);
  const [diasUteis,  setDiasUteis]  = useState(22);

  // Ao montar, detecta automaticamente o último mês/ano com dados alimentados no VW DRE
  useEffect(() => {
    async function detectLastPeriod() {
      const yearsToCheck = [CURRENT_YEAR, CURRENT_YEAR - 1] as const;

      for (const yr of yearsToCheck) {
        // Estratégia 1: verifica os dados do Dashboard Executivo (vw_dre_YYYY_novos)
        try {
          const dreData = await loadDREDataAsync(yr as 2024 | 2025 | 2026 | 2027, 'novos', 'vw');
          if (dreData && dreData.length > 0) {
            let lastMonth = 0;
            for (let m = 0; m < 12; m++) {
              const hasData = dreData.some(line => {
                const vals: number[] = (line as any).meses || (line as any).values || [];
                return vals[m] !== undefined && vals[m] !== 0;
              });
              if (hasData) lastMonth = m + 1;
            }
            if (lastMonth > 0) {
              setYear(yr);
              setMonth(lastMonth);
              return;
            }
          }
        } catch {}

        // Estratégia 2: verifica chaves salvas manualmente (resumo_dre:vw:YYYY-MM)
        try {
          const keys = await kvKeys('resumo_dre:vw:*');
          const yearStr = String(yr);
          const months = keys
            .filter(k => k.includes(`:${yearStr}-`))
            .map(k => { const m = k.match(/(\d{4})-(\d{2})$/); return m ? parseInt(m[2]) : 0; })
            .filter(m => m >= 1 && m <= 12);
          if (months.length > 0) {
            setYear(yr);
            setMonth(Math.max(...months));
            return;
          }
        } catch {}
      }
    }

    detectLastPeriod();
  }, []);

  const activeTabConfig = TABS.find(t => t.id === activeTab)!;
  const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">

      {/* ── Header principal ─────────────────────────────────────────────── */}
      <header className="bg-[#0f766e] text-white px-6 py-3 flex items-center gap-4 shadow-md shrink-0">
        <button
          onClick={onChangeBrand}
          className="flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <span className="text-white/40 select-none">|</span>
        <h1 className="text-base font-bold tracking-wide">Resumo DRE</h1>
      </header>

      {/* ── Barra de abas + seletor de período ──────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 shrink-0">

        {/* Abas */}
        <div className="flex items-center gap-1 pt-3">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2 text-sm font-semibold rounded-t-lg border border-b-0 transition-all duration-150 ${
                  isActive
                    ? 'text-white shadow-sm -mb-px z-10'
                    : 'text-slate-500 bg-slate-50 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                }`}
                style={isActive ? { backgroundColor: tab.color, borderColor: tab.color } : {}}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Linha separadora colorida + seletor de período */}
        <div
          className="border-t-2 -mx-6 px-6 py-3 flex flex-wrap items-center gap-4"
          style={{ borderColor: activeTabConfig.color }}
        >
          {/* Seletor de período */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Período</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-300"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-300"
            >
              <option value={0}>Ano Completo</option>
              {MONTHS_LABEL.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>


        </div>
      </div>

      {/* ── Conteúdo da aba ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {activeTab === 'vw' ? (
          <VwDreTab year={year} month={month} diasUteis={diasUteis} />
        ) : activeTab === 'vw-graficos' ? (
          <VwGraficosTab year={year} month={month} />
        ) : activeTab === 'audi' ? (
          <AudiDreTab year={year} month={month} diasUteis={diasUteis} />
        ) : activeTab === 'audi-graficos' ? (
          <AudiGraficosTab year={year} month={month} />
        ) : activeTab === 'consolidado' ? (
          <ConsolidadoDreTab year={year} month={month} diasUteis={diasUteis} />
        ) : activeTab === 'consolidado-graficos' ? (
          <ConsolidadoGraficosTab year={year} month={month} />
        ) : activeTab === 'mensal' ? (
          <MensalDreTab year={year} />
        ) : activeTab === 'saidas-caixa' ? (
          <SaidasCaixaTab year={year} month={month} />
        ) : activeTab === 'analise-evolucao' ? (
          <AnaliseDespesasEvolucaoTab year={year} month={month} />
        ) : activeTab === 'receita-evolucao' ? (
          <ReceitaVendasEvolucaoTab year={year} month={month} />
        ) : (
          <EndividamentoDRETab year={year} month={month} />
        )}
      </div>

    </div>
  );
}
