import { useState } from 'react';
import { Users, Car, CalendarCog, Receipt } from 'lucide-react';
import { VeiculosRegrasPage } from './VeiculosRegrasPage';
import { VendedoresRemuneracaoPage } from './VendedoresRemuneracaoPage';
import { VendasDsrSection } from './VendasDsrSection';
import { AliquotasImpostoSection } from './AliquotasImpostoSection';

type SectionId = 'vendedores' | 'veiculos' | 'dsr' | 'aliquotas';

interface MenuItem {
  id: SectionId;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'vendedores',
    label: 'Vendedores e Regra de Remuneração de Venda de Veículos',
    description: 'Percentuais de comissão e bônus de produtividade por modalidade de venda',
    icon: <Users className="w-5 h-5" />,
  },
  {
    id: 'veiculos',
    label: 'Veículos e Regra de Bonificação',
    description: 'Modelos e regras de bonificação por veículo',
    icon: <Car className="w-5 h-5" />,
  },
  {
    id: 'dsr',
    label: 'DSR',
    description: 'Percentual de DSR por ano e mês',
    icon: <CalendarCog className="w-5 h-5" />,
  },
  {
    id: 'aliquotas',
    label: 'Alíquotas de Imposto',
    description: 'Tipos de imposto, alíquotas e encargos',
    icon: <Receipt className="w-5 h-5" />,
  },
];

export function CadastrosVWPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('vendedores');

  const current = MENU_ITEMS.find(m => m.id === activeSection)!;

  return (
    <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
      {/* ── Sidebar ── */}
      <aside className="w-72 bg-white border-r border-slate-200 flex-shrink-0 overflow-y-auto">
        <nav className="p-3 space-y-1">
          {MENU_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-lg transition-all ${
                activeSection === item.id
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
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
      <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-slate-400">{current.icon}</span>
              <h2 className="text-lg font-bold text-slate-800">{current.label}</h2>
            </div>
            <p className="text-sm text-slate-500">{current.description}</p>
          </div>

          {/* Placeholders — conteúdo será implementado futuramente */}
          {activeSection === 'vendedores' && <VendedoresRemuneracaoPage />}

          {activeSection === 'veiculos' && <VeiculosRegrasPage />}

          {activeSection === 'dsr' && <VendasDsrSection />}

          {activeSection === 'aliquotas' && <AliquotasImpostoSection />}
        </div>
      </main>
    </div>
  );
}
