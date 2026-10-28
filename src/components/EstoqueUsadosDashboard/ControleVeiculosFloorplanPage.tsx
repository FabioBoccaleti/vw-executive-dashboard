import { useState } from 'react';
import { ArrowLeft, Car, SlidersHorizontal, Wallet } from 'lucide-react';
import { ControleVeiculosTab } from './ControleVeiculosTab';
import { RegrasTab } from './RegrasTab';
import { CadastroLimitesTab } from './CadastroLimitesTab';

interface Props {
  onChangeBrand: () => void;
}

type Tab = 'controle' | 'regras' | 'limites';

function TabBtn({
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
          ? 'bg-white text-sky-700 shadow-sm'
          : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function ControleVeiculosFloorplanPage({ onChangeBrand }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('controle');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Barra de navegação superior */}
      <div className="bg-slate-100 border-b border-slate-200 px-6 py-2 flex items-center justify-between">
        <button
          onClick={onChangeBrand}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao menu
        </button>

        <div className="flex items-center gap-1 bg-slate-200/70 rounded-lg p-1">
          <TabBtn
            active={activeTab === 'controle'}
            onClick={() => setActiveTab('controle')}
            icon={<Car className="w-3.5 h-3.5" />}
            label="Controle de Veículos"
          />
          <TabBtn
            active={activeTab === 'regras'}
            onClick={() => setActiveTab('regras')}
            icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
            label="Regras"
          />
          <TabBtn
            active={activeTab === 'limites'}
            onClick={() => setActiveTab('limites')}
            icon={<Wallet className="w-3.5 h-3.5" />}
            label="Cadastro de Limites"
          />
        </div>

        <div className="w-24" />
      </div>

      {/* Título da página */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <h1 className="flex items-center gap-2 text-base font-bold text-slate-800">
          <Car className="w-5 h-5 text-sky-600" />
          Controle de Veículos FloorPlan
        </h1>
      </div>

      {/* Conteúdo da aba ativa */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'controle' && <ControleVeiculosTab />}
        {activeTab === 'regras' && <RegrasTab />}
        {activeTab === 'limites' && <CadastroLimitesTab />}
      </div>
    </div>
  );
}
