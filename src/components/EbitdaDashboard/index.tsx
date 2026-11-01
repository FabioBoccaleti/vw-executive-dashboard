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
import { DespesasFinanceiraAudiTab } from './DespesasFinanceiraAudiTab';
import { DreAudiTab } from './DreAudiTab';

interface Props {
  onChangeBrand: () => void;
}

type View = 'selection' | 'ebitda_vw' | 'ebitda_audi';

export function EbitdaDashboard({ onChangeBrand }: Props) {
  const [view, setView] = useState<View>('selection');

  const headerTitle =
    view === 'ebitda_vw' ? 'Ebitda VW' : view === 'ebitda_audi' ? 'Ebitda Audi' : 'Ebitda';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="px-6 py-3 flex items-center justify-between shadow-md bg-[#059669]">
        <div>
          <h1 className="text-sm font-bold text-white">{headerTitle}</h1>
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
          <div className="flex justify-center gap-6 pt-4 flex-wrap">
            <Card
              className="cursor-pointer transition-all duration-200 hover:shadow-lg w-[260px]"
              style={{ ['--tw-ring-color' as string]: '#059669' }}
              onClick={() => setView('ebitda_vw')}
            >
              <CardContent className="p-8 flex flex-col items-center justify-center gap-4 text-center min-h-[200px]">
                <div className="p-4 rounded-full bg-emerald-100 text-[#059669]">
                  <Car className="w-11 h-11" />
                </div>
                <h3 className="text-lg font-bold text-slate-700">Ebitda VW</h3>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer transition-all duration-200 hover:shadow-lg w-[260px]"
              style={{ ['--tw-ring-color' as string]: '#059669' }}
              onClick={() => setView('ebitda_audi')}
            >
              <CardContent className="p-8 flex flex-col items-center justify-center gap-4 text-center min-h-[200px]">
                <div className="p-4 rounded-full bg-emerald-100 text-[#059669]">
                  <Car className="w-11 h-11" />
                </div>
                <h3 className="text-lg font-bold text-slate-700">Ebitda Audi</h3>
              </CardContent>
            </Card>
          </div>
        ) : view === 'ebitda_vw' ? (
          <div className="w-full flex flex-col flex-1 min-h-0">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Ebitda VW</h2>
            <Tabs defaultValue="dre" className="w-full flex flex-col flex-1 min-h-0">
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
        ) : (
          <div className="w-full flex flex-col flex-1 min-h-0">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Ebitda Audi</h2>
            <Tabs defaultValue="dre" className="w-full flex flex-col flex-1 min-h-0">
              <TabsList>
                <TabsTrigger value="despesas_financeira">Despesas Financeira</TabsTrigger>
                <TabsTrigger value="dre">DRE</TabsTrigger>
              </TabsList>

              <TabsContent value="despesas_financeira" className="flex flex-col flex-1 min-h-0">
                <DespesasFinanceiraAudiTab />
              </TabsContent>

              <TabsContent value="dre" className="flex flex-col flex-1 min-h-0">
                <DreAudiTab />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
