import { useState } from 'react';
import { FolderInput, BarChart3 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ImportacaoVeiculosTab } from './ImportacaoVeiculosTab';
import { AnaliseVeiculosTab } from './AnaliseVeiculosTab';

interface Props {
  onBack: () => void;
}

const PRIMARY = '#001e50';
const PRIMARY_LIGHT = '#e8f4fc';

type MainTab = 'importacao' | 'analise';

export function EstoqueUsadosVwDashboard({ onBack }: Props) {
  const [mainTab, setMainTab] = useState<MainTab>('analise');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Estoque de Veículos Usados VW</h1>
          <p className="text-xs text-slate-500 mt-0.5">Análise de Estoque</p>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
        >
          ← Voltar
        </button>
      </header>

      <div className="flex-1 p-6">
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)}>
          <TabsList className="h-auto p-1">
            <TabsTrigger
              value="importacao"
              className="gap-2 text-base px-5 py-2.5"
              style={mainTab === 'importacao' ? { backgroundColor: PRIMARY, color: '#fff' } : undefined}
            >
              <FolderInput className="w-5 h-5" />
              Importação de Arquivo
            </TabsTrigger>
            <TabsTrigger
              value="analise"
              className="gap-2 text-base px-5 py-2.5"
              style={mainTab === 'analise' ? { backgroundColor: PRIMARY, color: '#fff' } : undefined}
            >
              <BarChart3 className="w-5 h-5" />
              Análise de Estoque
            </TabsTrigger>
          </TabsList>

          <TabsContent value="importacao" className="mt-4">
            <ImportacaoVeiculosTab primary={PRIMARY} primaryLight={PRIMARY_LIGHT} />
          </TabsContent>

          <TabsContent value="analise" className="mt-4">
            <AnaliseVeiculosTab primary={PRIMARY} primaryLight={PRIMARY_LIGHT} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
