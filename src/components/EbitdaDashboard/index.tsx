/**
 * Dashboard Ebitda — Demonstrativo de Resultados
 *
 * Exibe os cards de Ebitda por marca. Por enquanto, o card "Ebitda VW"
 * abre uma tela de "em desenvolvimento".
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Car } from 'lucide-react';
import { DespesasFinanceiraTab } from './DespesasFinanceiraTab';
import { DreTab } from './DreTab';

interface Props {
  onChangeBrand: () => void;
}

type View = 'selection' | 'ebitda_vw';

export function EbitdaDashboard({ onChangeBrand }: Props) {
  const [view, setView] = useState<View>('selection');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="px-6 py-3 flex items-center justify-between shadow-md bg-[#059669]">
        <div>
          <h1 className="text-sm font-bold text-white">{view === 'ebitda_vw' ? 'Ebitda VW' : 'Ebitda'}</h1>
          <p className="text-xs text-emerald-100 mt-0.5">Demonstrativo de Resultados</p>
        </div>
        <button
          onClick={() => (view === 'selection' ? onChangeBrand() : setView('selection'))}
          className="px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#047857] rounded"
        >
          ← Voltar
        </button>
      </header>

      <main className="flex-1 p-4 md:p-6 flex flex-col min-h-0">
        {view === 'selection' ? (
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card
                className="cursor-pointer transition-all duration-200 hover:shadow-lg"
                style={{ ['--tw-ring-color' as string]: '#059669' }}
                onClick={() => setView('ebitda_vw')}
              >
                <CardContent className="p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[140px]">
                  <div className="p-3 rounded-full bg-emerald-100 text-[#059669]">
                    <Car className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-700">Ebitda VW</h3>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col flex-1 min-h-0">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Ebitda VW</h2>
            <Tabs defaultValue="despesas_financeira" className="w-full flex flex-col flex-1 min-h-0">
              <TabsList>
                <TabsTrigger value="despesas_financeira">Despesas Financeira</TabsTrigger>
                <TabsTrigger value="dre">DRE</TabsTrigger>
              </TabsList>

              <TabsContent value="despesas_financeira" className="flex flex-col flex-1 min-h-0">
                <DespesasFinanceiraTab />
              </TabsContent>

              <TabsContent value="dre" className="flex flex-col flex-1 min-h-0">
                <DreTab />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
