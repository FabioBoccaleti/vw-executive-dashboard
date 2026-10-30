import { useState } from 'react';
import { FolderInput, BarChart3 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ImportacaoVeiculosTab } from './ImportacaoVeiculosTab';
import { AnaliseVeiculosTab } from './AnaliseVeiculosTab';
import type { VeiculoBrandId } from './veiculosStorage';

export interface VeiculoBrandConfig {
  id: VeiculoBrandId;
  name: string;
  primary: string;
  primaryLight: string;
}

interface Props {
  config: VeiculoBrandConfig;
  onBack: () => void;
}

type MainTab = 'importacao' | 'analise';

export function EstoqueUsadosVwDashboard({ config, onBack }: Props) {
  const [mainTab, setMainTab] = useState<MainTab>('analise');
  const { id, name, primary, primaryLight } = config;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{name}</h1>
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
              style={mainTab === 'importacao' ? { backgroundColor: primary, color: '#fff' } : undefined}
            >
              <FolderInput className="w-5 h-5" />
              Importação de Arquivo
            </TabsTrigger>
            <TabsTrigger
              value="analise"
              className="gap-2 text-base px-5 py-2.5"
              style={mainTab === 'analise' ? { backgroundColor: primary, color: '#fff' } : undefined}
            >
              <BarChart3 className="w-5 h-5" />
              Análise de Estoque
            </TabsTrigger>
          </TabsList>

          <TabsContent value="importacao" className="mt-4">
            <ImportacaoVeiculosTab brand={id} primary={primary} primaryLight={primaryLight} />
          </TabsContent>

          <TabsContent value="analise" className="mt-4">
            <AnaliseVeiculosTab brand={id} name={name} primary={primary} primaryLight={primaryLight} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
