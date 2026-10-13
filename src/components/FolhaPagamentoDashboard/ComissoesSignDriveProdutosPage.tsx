import { useState } from 'react';
import { FileText, BarChart2, Package, Calculator } from 'lucide-react';
import { PeriodoSelector } from './PeriodoSelector';
import { SignDriveDemonstrativoView } from './SignDriveDemonstrativoView';

type MainTab = 'signdrive' | 'produtos';
type SignDriveSubTab = 'demonstrativo' | 'resumo';

interface ComissoesSignDriveProdutosPageProps {
  onBack: () => void;
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto">
          <Calculator className="w-8 h-8 text-teal-500" />
        </div>
        <p className="text-lg font-semibold text-slate-700">{title}</p>
        <p className="text-sm text-slate-400">Este conteúdo estará disponível em breve.</p>
      </div>
    </div>
  );
}

export function ComissoesSignDriveProdutosPage({ onBack }: ComissoesSignDriveProdutosPageProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [mainTab, setMainTab] = useState<MainTab>('signdrive');
  const [signDriveSubTab, setSignDriveSubTab] = useState<SignDriveSubTab>('demonstrativo');

  // Período da aba Sign&Drive — compartilhado por Demonstrativo e Resumo.
  const [signDriveYear, setSignDriveYear] = useState(currentYear);
  const [signDriveMonth, setSignDriveMonth] = useState<number | null>(currentMonth);

  // Período próprio da aba Produtos.
  const [produtosYear, setProdutosYear] = useState(currentYear);
  const [produtosMonth, setProdutosMonth] = useState<number | null>(currentMonth);

  const mainTabs = [
    { id: 'signdrive' as const, label: 'Sign&Drive', icon: FileText },
    { id: 'produtos' as const, label: 'Produtos', icon: Package },
  ];

  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Calculo de Comissões Sign&Drive e Produtos</h1>
          <p className="text-xs text-slate-500 mt-0.5">Folha de Pagamento</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Abas de navegação */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            {mainTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setMainTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    mainTab === tab.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
          >
            ← Voltar
          </button>
        </div>
      </header>

      {/* Aba Sign&Drive */}
      {mainTab === 'signdrive' && (
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          {/* Seletor de período — compartilhado pelas sub-abas */}
          <PeriodoSelector
            year={signDriveYear}
            month={signDriveMonth}
            onYearChange={setSignDriveYear}
            onMonthChange={setSignDriveMonth}
          />

          {/* Sub-abas */}
          <div className="bg-white border-b border-slate-200 px-6 flex gap-0 flex-shrink-0">
            {([
              { id: 'demonstrativo' as const, label: 'Demonstrativo' },
              { id: 'resumo' as const, label: 'Resumo' },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setSignDriveSubTab(tab.id)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  signDriveSubTab === tab.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Conteúdo por sub-aba */}
          {signDriveSubTab === 'demonstrativo' && (
            <SignDriveDemonstrativoView year={signDriveYear} month={signDriveMonth} />
          )}
          {signDriveSubTab === 'resumo' && <Placeholder title="Resumo — Sign&Drive" />}
        </div>
      )}

      {/* Aba Produtos */}
      {mainTab === 'produtos' && (
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          {/* Seletor de período próprio da aba Produtos */}
          <PeriodoSelector
            year={produtosYear}
            month={produtosMonth}
            onYearChange={setProdutosYear}
            onMonthChange={setProdutosMonth}
          />

          <Placeholder title="Produtos" />
        </div>
      )}
    </div>
  );
}
