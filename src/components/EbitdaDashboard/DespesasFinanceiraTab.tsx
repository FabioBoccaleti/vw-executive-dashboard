/**
 * Aba "Despesas Financeira" do Ebitda VW.
 *
 * Reaproveita os tabs de departamento do dashboard "Despesas por Departamento
 * na Sorana VW", exibindo apenas o grupo "Despesas Financeiras" (tipo
 * `financeiras`) em modo Ano todo (todos os meses). Como lê exatamente a mesma
 * fonte de dados, qualquer importação/atualização lá reflete aqui
 * automaticamente. Possui apenas seletor de ano (sem seletor de mês).
 */

import { useState } from 'react';
import { AdmVwTab } from '@/components/DespesasDeptoVwDashboard/AdmVwTab';
import { VendaDiretaTab } from '@/components/DespesasDeptoVwDashboard/VendaDiretaTab';
import { AdmAudiTab } from '@/components/DespesasDeptoVwDashboard/AdmAudiTab';
import { PecasTab } from '@/components/DespesasDeptoVwDashboard/PecasTab';
import { OficinaTab } from '@/components/DespesasDeptoVwDashboard/OficinaTab';
import { FunalariaTab } from '@/components/DespesasDeptoVwDashboard/FunalariaTab';
import { AdministracaoTab } from '@/components/DespesasDeptoVwDashboard/AdministracaoTab';
import { DireitoriaTab } from '@/components/DespesasDeptoVwDashboard/DireitoriaTab';
import { ConsolidadoAdmTab } from '@/components/DespesasDeptoVwDashboard/ConsolidadoAdmTab';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_MODE = 0; // "Ano todo"
const ONLY_TIPO = 'financeiras' as const;

type DeptoTab =
  | 'adm_vw' | 'venda_direta' | 'adm_audi' | 'pecas' | 'oficina'
  | 'funilaria' | 'administracao' | 'diretoria' | 'consolidado';

const DEPTO_TABS: { id: DeptoTab; label: string }[] = [
  { id: 'adm_vw',        label: 'Veículos Novos' },
  { id: 'venda_direta',  label: 'Venda Direta' },
  { id: 'adm_audi',      label: 'Veículos Usados' },
  { id: 'pecas',         label: 'Peças' },
  { id: 'oficina',       label: 'Oficina' },
  { id: 'funilaria',     label: 'Funilaria' },
  { id: 'administracao', label: 'Administração' },
  { id: 'diretoria',     label: 'Diretoria' },
  { id: 'consolidado',   label: 'Consolidado (Total)' },
];

interface YearSelectorProps {
  year: number;
  onYearChange: (y: number) => void;
}

function YearSelector({ year, onYearChange }: YearSelectorProps) {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ANO</span>
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
        <button
          onClick={() => onYearChange(year - 1)}
          className="text-slate-400 hover:text-slate-700 font-bold px-0.5 transition-colors"
        >
          ‹
        </button>
        <span className="text-sm font-bold text-slate-700 min-w-[38px] text-center select-none">
          {year}
        </span>
        <button
          onClick={() => onYearChange(year + 1)}
          className="text-slate-400 hover:text-slate-700 font-bold px-0.5 transition-colors"
        >
          ›
        </button>
      </div>
    </div>
  );
}

export function DespesasFinanceiraTab() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [activeTab, setActiveTab] = useState<DeptoTab>('adm_vw');

  return (
    <div className="flex flex-col gap-4">
      {/* Seletor de ano */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 shadow-sm">
        <YearSelector year={year} onYearChange={setYear} />
      </div>

      {/* Sub-abas por departamento */}
      <div className="flex items-center gap-0 border-b border-slate-200 overflow-x-auto">
        {DEPTO_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'text-slate-700 border-slate-600'
                : 'text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo — somente grupo Despesas Financeiras, modo Ano todo */}
      <div>
        {activeTab === 'adm_vw'        && <AdmVwTab        year={year} month={YEAR_MODE} onlyTipo={ONLY_TIPO} />}
        {activeTab === 'venda_direta'  && <VendaDiretaTab  year={year} month={YEAR_MODE} onlyTipo={ONLY_TIPO} />}
        {activeTab === 'adm_audi'      && <AdmAudiTab      year={year} month={YEAR_MODE} onlyTipo={ONLY_TIPO} />}
        {activeTab === 'pecas'         && <PecasTab        year={year} month={YEAR_MODE} onlyTipo={ONLY_TIPO} />}
        {activeTab === 'oficina'       && <OficinaTab      year={year} month={YEAR_MODE} onlyTipo={ONLY_TIPO} />}
        {activeTab === 'funilaria'     && <FunalariaTab    year={year} month={YEAR_MODE} onlyTipo={ONLY_TIPO} />}
        {activeTab === 'administracao' && <AdministracaoTab year={year} month={YEAR_MODE} onlyTipo={ONLY_TIPO} />}
        {activeTab === 'diretoria'     && <DireitoriaTab   year={year} month={YEAR_MODE} onlyTipo={ONLY_TIPO} />}
        {activeTab === 'consolidado'   && <ConsolidadoAdmTab year={year} month={YEAR_MODE} onlyTipo={ONLY_TIPO} />}
      </div>
    </div>
  );
}
