import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Wrench } from 'lucide-react';

interface Props {
  onChangeBrand: () => void;
}

type SubPage = 'selection' | 'audi' | 'vw';

interface SubCard {
  id: Exclude<SubPage, 'selection'>;
  name: string;
  primary: string;
  primaryLight: string;
}

const SUB_CARDS: SubCard[] = [
  { id: 'audi', name: 'Estoque de Peças Audi', primary: '#bb0a30', primaryLight: '#fce8ec' },
  { id: 'vw', name: 'Estoque de Peças VW', primary: '#001e50', primaryLight: '#e8f4fc' },
];

export function AnaliseEstoquePecasPage({ onChangeBrand }: Props) {
  const [subPage, setSubPage] = useState<SubPage>('selection');

  if (subPage !== 'selection') {
    const card = SUB_CARDS.find((c) => c.id === subPage)!;
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{card.name}</h1>
            <p className="text-xs text-slate-500 mt-0.5">Análise de Estoque de Peças</p>
          </div>
          <button
            onClick={() => setSubPage('selection')}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
          >
            ← Voltar
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mx-auto">
              <Wrench className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-lg font-semibold text-slate-700">Em desenvolvimento</p>
            <p className="text-sm text-slate-400">Este módulo estará disponível em breve.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Análise de Estoque de Peças</h1>
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
        <div className="w-full max-w-3xl mt-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <Wrench className="w-8 h-8" />
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
