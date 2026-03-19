import { useState } from 'react';
import { ArrowLeft, Car, Shield, Users, Percent, Store } from 'lucide-react';
import { VeiculosSection } from './sections/VeiculosSection';
import { BlinadorasSection } from './sections/BlinadorasSection';
import { VendedoresSection } from './sections/VendedoresSection';
import { RevendasSection } from './sections/RevendasSection';
import { RegrasSection } from './sections/RegrasSection';

type SectionId = 'veiculos' | 'blindadoras' | 'vendedores' | 'revendas' | 'regras';

interface MenuItem {
  id: SectionId;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'veiculos',    label: 'Veículos',               description: 'Marcas e modelos',          icon: <Car className="w-5 h-5" /> },
  { id: 'blindadoras', label: 'Blindadoras',             description: 'Empresas de blindagem',     icon: <Shield className="w-5 h-5" /> },
  { id: 'revendas',    label: 'Revendas',                description: 'Concessionárias e revendas', icon: <Store className="w-5 h-5" /> },
  { id: 'vendedores',  label: 'Vendedores',              description: 'Equipe de vendas e cargos', icon: <Users className="w-5 h-5" /> },
  { id: 'regras',      label: 'Regras de Remuneração',   description: 'Percentuais e bases de cálculo', icon: <Percent className="w-5 h-5" /> },
];

interface CadastrosPageProps {
  onBack: () => void;
}

export function CadastrosPage({ onBack }: CadastrosPageProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('veiculos');

  const current = MENU_ITEMS.find(m => m.id === activeSection)!;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* ── Header ── */}
      <header
        className="text-white shadow-lg flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)' }}
      >
        <div className="px-6 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm border border-white/30 hover:bg-white/15 rounded-md px-3 py-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <div className="h-5 w-px bg-white/30" />
          <h1 className="text-base font-bold tracking-tight">Cadastros</h1>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 overflow-y-auto">
          <nav className="p-3 space-y-1">
            {MENU_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-lg transition-all ${
                  activeSection === item.id
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                style={activeSection === item.id ? { background: '#1f2937' } : {}}
              >
                <span className={`mt-0.5 flex-shrink-0 ${activeSection === item.id ? 'text-white' : 'text-slate-400'}`}>
                  {item.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold leading-tight">{item.label}</p>
                  <p className={`text-xs mt-0.5 ${activeSection === item.id ? 'text-white/70' : 'text-slate-400'}`}>
                    {item.description}
                  </p>
                </div>
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Content area ── */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-slate-400">{current.icon}</span>
                <h2 className="text-lg font-bold text-slate-800">{current.label}</h2>
              </div>
              <p className="text-sm text-slate-500">{current.description}</p>
            </div>

            {activeSection === 'veiculos'    && <VeiculosSection />}
            {activeSection === 'blindadoras' && <BlinadorasSection />}
            {activeSection === 'revendas'    && <RevendasSection />}
            {activeSection === 'vendedores'  && <VendedoresSection />}
            {activeSection === 'regras'      && <RegrasSection />}
          </div>
        </main>
      </div>
    </div>
  );
}
