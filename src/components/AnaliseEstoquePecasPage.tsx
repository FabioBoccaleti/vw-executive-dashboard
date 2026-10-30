import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Wrench, Car } from 'lucide-react';
import { EstoquePecasDashboard } from '@/components/EstoquePecasDashboard/EstoquePecasDashboard';
import { EstoqueUsadosVwDashboard } from '@/components/EstoqueUsadosVwDashboard/EstoqueUsadosVwDashboard';

interface Props {
  onChangeBrand: () => void;
}

type SubPage = 'selection' | 'audi' | 'vw' | 'usados_vw';

interface SubCard {
  id: Exclude<SubPage, 'selection'>;
  name: string;
  primary: string;
  primaryLight: string;
  kind: 'pecas' | 'usados';
}

const SUB_CARDS: SubCard[] = [
  { id: 'audi', name: 'Estoque de Peças Audi', primary: '#bb0a30', primaryLight: '#fce8ec', kind: 'pecas' },
  { id: 'vw', name: 'Estoque de Peças VW', primary: '#001e50', primaryLight: '#e8f4fc', kind: 'pecas' },
  { id: 'usados_vw', name: 'Estoque de Veículos Usados VW', primary: '#001e50', primaryLight: '#e8f4fc', kind: 'usados' },
];

export function AnaliseEstoquePecasPage({ onChangeBrand }: Props) {
  const [subPage, setSubPage] = useState<SubPage>('selection');

  if (subPage !== 'selection') {
    const card = SUB_CARDS.find((c) => c.id === subPage)!;
    if (card.kind === 'usados') {
      return <EstoqueUsadosVwDashboard onBack={() => setSubPage('selection')} />;
    }
    return (
      <EstoquePecasDashboard
        marca={{ id: card.id as 'audi' | 'vw', name: card.name, primary: card.primary, primaryLight: card.primaryLight }}
        onBack={() => setSubPage('selection')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Análise de Estoque</h1>
          <p className="text-xs text-slate-500 mt-0.5">Controle Financeiro Sorana</p>
        </div>
        <button
          onClick={onChangeBrand}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
        >
          ← Voltar
        </button>
      </header>

      <div className="flex-1 flex items-start justify-center p-6">
        <div className="w-full max-w-4xl mt-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SUB_CARDS.map((card) => (
              <Card
                key={card.id}
                className="cursor-pointer transition-all duration-300 h-full hover:shadow-md"
                style={{ ['--tw-ring-color' as string]: card.primary }}
                onClick={() => setSubPage(card.id)}
              >
                <CardContent className="p-6 flex flex-col items-center justify-center min-h-[150px] gap-3 text-center">
                  <div
                    className="p-3 rounded-full transition-colors duration-300"
                    style={{ backgroundColor: card.primaryLight, color: card.primary }}
                  >
                    {card.kind === 'usados' ? <Car className="w-8 h-8" /> : <Wrench className="w-8 h-8" />}
                  </div>
                  <h3 className="text-base font-bold text-slate-800">{card.name}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
