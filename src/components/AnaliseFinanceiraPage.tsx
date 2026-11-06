import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Receipt, Banknote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DuplicatasReceberDashboard } from '@/components/DuplicatasReceberDashboard/DuplicatasReceberDashboard';
import { ContasPagarDashboard } from '@/components/ContasPagarDashboard/ContasPagarDashboard';

interface Props {
  onChangeBrand: () => void;
}

type SubPage = 'selection' | 'duplicatas' | 'contas_pagar';

interface SubCard {
  id: Exclude<SubPage, 'selection'>;
  name: string;
  primary: string;
  primaryLight: string;
  icon: LucideIcon;
}

const SUB_CARDS: SubCard[] = [
  { id: 'duplicatas', name: 'Duplicatas a Receber', primary: '#4f46e5', primaryLight: '#eef2ff', icon: Receipt },
  { id: 'contas_pagar', name: 'Contas a Pagar', primary: '#4f46e5', primaryLight: '#eef2ff', icon: Banknote },
];

export function AnaliseFinanceiraPage({ onChangeBrand }: Props) {
  const [subPage, setSubPage] = useState<SubPage>('selection');

  if (subPage === 'duplicatas') {
    return <DuplicatasReceberDashboard onBack={() => setSubPage('selection')} />;
  }

  if (subPage === 'contas_pagar') {
    return <ContasPagarDashboard onBack={() => setSubPage('selection')} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Análise Financeira</h1>
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
            {SUB_CARDS.map((card) => {
              const Icon = card.icon;
              return (
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
                      <Icon className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">{card.name}</h3>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
