import { useState } from 'react';
import { ArrowLeft, Car, Shield, Users, Percent, Store, Wrench, ShoppingBag, UserCheck, Receipt, CalendarCog } from 'lucide-react';
import { VeiculosSection } from './sections/VeiculosSection';
import { BlinadorasSection } from './sections/BlinadorasSection';
import { VendedoresSection } from './sections/VendedoresSection';
import { RevendasSection } from './sections/RevendasSection';
import { RegrasSection } from './sections/RegrasSection';
import { PrestadoresSection } from './sections/PrestadoresSection';
import { PeliculasVeiculosSection } from './sections/PeliculasVeiculosSection';
import { PeliculasVendedoresSection } from './sections/PeliculasVendedoresSection';
import { PeliculasRevendasSection } from './sections/PeliculasRevendasSection';
import { PeliculasRegrasSection } from './sections/PeliculasRegrasSection';
import { PeliculasProdutosSection } from './sections/PeliculasProdutosSection';
import { PeliculasVendedoresAcessoriosSection } from './sections/PeliculasVendedoresAcessoriosSection';
import { PeliculasAliquotasSection } from './sections/PeliculasAliquotasSection';
import { PeliculasDsrSection } from './sections/PeliculasDsrSection';
import { EsteticaVeiculosSection } from './sections/EsteticaVeiculosSection';
import { EsteticaVendedoresSection } from './sections/EsteticaVendedoresSection';
import { EsteticaRevendasSection } from './sections/EsteticaRevendasSection';
import { EsteticaRegrasSection } from './sections/EsteticaRegrasSection';
import { EsteticaProdutosSection } from './sections/EsteticaProdutosSection';
import { EsteticaVendedoresAcessoriosSection } from './sections/EsteticaVendedoresAcessoriosSection';
import { EsteticaAliquotasSection } from './sections/EsteticaAliquotasSection';
import { EsteticaDsrSection } from './sections/EsteticaDsrSection';

type SectionId = 'veiculos' | 'blindadoras' | 'prestadores' | 'vendedores' | 'vendedoresAcessorios' | 'revendas' | 'regras' | 'produtos' | 'aliquotas' | 'dsr';

interface MenuItem {
  id: SectionId;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const MENU_BLINDAGEM: MenuItem[] = [
  { id: 'veiculos',    label: 'Veículos',               description: 'Marcas e modelos',               icon: <Car className="w-5 h-5" /> },
  { id: 'blindadoras', label: 'Blindadoras',             description: 'Empresas de blindagem',          icon: <Shield className="w-5 h-5" /> },
  { id: 'revendas',    label: 'Revendas',                description: 'Concessionárias e revendas',     icon: <Store className="w-5 h-5" /> },
  { id: 'vendedores',  label: 'Vendedores',              description: 'Equipe de vendas e cargos',      icon: <Users className="w-5 h-5" /> },
  { id: 'regras',      label: 'Regras de Remuneração',   description: 'Percentuais e bases de cálculo', icon: <Percent className="w-5 h-5" /> },
];

const MENU_PELICULAS: MenuItem[] = [
  { id: 'veiculos',              label: 'Veículos',                  description: 'Marcas e modelos',               icon: <Car className="w-5 h-5" /> },
  { id: 'prestadores',           label: 'Prestadores de Serviço',    description: 'Empresas prestadoras',           icon: <Wrench className="w-5 h-5" /> },
  { id: 'produtos',              label: 'Produtos / Serviços',       description: 'Catálogo de produtos e serviços', icon: <ShoppingBag className="w-5 h-5" /> },
  { id: 'revendas',              label: 'Revendas',                  description: 'Concessionárias e revendas',     icon: <Store className="w-5 h-5" /> },
  { id: 'vendedores',            label: 'Vendedores',                description: 'Equipe de vendas e cargos',      icon: <Users className="w-5 h-5" /> },
  { id: 'vendedoresAcessorios',  label: 'Vendedores de Acessórios',  description: 'Equipe de vendedores de acessórios', icon: <UserCheck className="w-5 h-5" /> },
  { id: 'aliquotas',             label: 'Alíquotas de Imposto',       description: 'Tipos de imposto, alíquotas e encargos', icon: <Receipt className="w-5 h-5" /> },
  { id: 'dsr',                   label: 'DSR',                        description: 'Percentual de DSR por Ano e Mês',   icon: <CalendarCog className="w-5 h-5" /> },
  { id: 'regras',                label: 'Regras de Remuneração',     description: 'Percentuais e bases de cálculo', icon: <Percent className="w-5 h-5" /> },
];

const MENU_ESTETICA: MenuItem[] = [
  { id: 'veiculos',              label: 'Veículos',                  description: 'Marcas e modelos',               icon: <Car className="w-5 h-5" /> },
  { id: 'produtos',              label: 'Produtos / Serviços',       description: 'Catálogo de produtos e serviços', icon: <ShoppingBag className="w-5 h-5" /> },
  { id: 'revendas',              label: 'Revendas',                  description: 'Concessionárias e revendas',     icon: <Store className="w-5 h-5" /> },
  { id: 'vendedores',            label: 'Vendedores',                description: 'Equipe de vendas e cargos',      icon: <Users className="w-5 h-5" /> },
  { id: 'vendedoresAcessorios',  label: 'Vendedores de Serviço de Estética', description: 'Equipe de vendedores de serviços de estética', icon: <UserCheck className="w-5 h-5" /> },
  { id: 'aliquotas',             label: 'Alíquotas de Imposto',       description: 'Tipos de imposto, alíquotas e encargos', icon: <Receipt className="w-5 h-5" /> },
  { id: 'dsr',                   label: 'DSR',                        description: 'Percentual de DSR por Ano e Mês',   icon: <CalendarCog className="w-5 h-5" /> },
  { id: 'regras',                label: 'Regras de Remuneração',     description: 'Percentuais e bases de cálculo', icon: <Percent className="w-5 h-5" /> },
];

interface CadastrosPageProps {
  onBack: () => void;
  variant?: 'blindagem' | 'peliculas' | 'estetica';
}

export function CadastrosPage({ onBack, variant = 'blindagem' }: CadastrosPageProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('veiculos');
  const isPeliculas = variant === 'peliculas';
  const isEstetica  = variant === 'estetica';
  const MENU_ITEMS = isEstetica ? MENU_ESTETICA : isPeliculas ? MENU_PELICULAS : MENU_BLINDAGEM;

  const current = MENU_ITEMS.find(m => m.id === activeSection)!;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* ── Header ── */}
      <header
        className="text-white shadow-lg flex-shrink-0"
        style={isPeliculas
          ? { background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)' }
          : isEstetica
          ? { background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)' }
          : { background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)' }}
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
          <div>
            <h1 className="text-base font-bold tracking-tight">Cadastros</h1>
            {isPeliculas && <p className="text-xs text-white/60 mt-0.5">Películas na Audi</p>}
            {isEstetica  && <p className="text-xs text-white/60 mt-0.5">Estética Audi</p>}
          </div>
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
                style={activeSection === item.id ? { background: isPeliculas ? '#312e81' : '#1f2937' } : {}}
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

            {!isPeliculas && !isEstetica && activeSection === 'veiculos'    && <VeiculosSection />}
            {!isPeliculas && !isEstetica && activeSection === 'blindadoras' && <BlinadorasSection />}
            {!isPeliculas && !isEstetica && activeSection === 'revendas'    && <RevendasSection />}
            {!isPeliculas && !isEstetica && activeSection === 'vendedores'  && <VendedoresSection />}
            {!isPeliculas && !isEstetica && activeSection === 'regras'      && <RegrasSection />}
            {isPeliculas  && activeSection === 'veiculos'             && <PeliculasVeiculosSection />}
            {isPeliculas  && activeSection === 'prestadores'          && <PrestadoresSection />}
            {isPeliculas  && activeSection === 'produtos'             && <PeliculasProdutosSection />}
            {isPeliculas  && activeSection === 'revendas'             && <PeliculasRevendasSection />}
            {isPeliculas  && activeSection === 'vendedores'           && <PeliculasVendedoresSection />}
            {isPeliculas  && activeSection === 'vendedoresAcessorios' && <PeliculasVendedoresAcessoriosSection />}
            {isPeliculas  && activeSection === 'aliquotas'             && <PeliculasAliquotasSection />}
            {isPeliculas  && activeSection === 'dsr'                   && <PeliculasDsrSection />}
            {isPeliculas  && activeSection === 'regras'               && <PeliculasRegrasSection />}
            {isEstetica   && activeSection === 'veiculos'             && <EsteticaVeiculosSection />}
            {isEstetica   && activeSection === 'produtos'             && <EsteticaProdutosSection />}
            {isEstetica   && activeSection === 'revendas'             && <EsteticaRevendasSection />}
            {isEstetica   && activeSection === 'vendedores'           && <EsteticaVendedoresSection />}
            {isEstetica   && activeSection === 'vendedoresAcessorios' && <EsteticaVendedoresAcessoriosSection />}
            {isEstetica   && activeSection === 'aliquotas'             && <EsteticaAliquotasSection />}
            {isEstetica   && activeSection === 'dsr'                   && <EsteticaDsrSection />}
            {isEstetica   && activeSection === 'regras'               && <EsteticaRegrasSection />}
          </div>
        </main>
      </div>
    </div>
  );
}
