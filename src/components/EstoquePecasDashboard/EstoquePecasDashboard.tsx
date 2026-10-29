import { useState } from 'react';
import { FolderInput, BarChart3 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InventarioEstoqueTab } from './InventarioEstoqueTab';
import { MovimentacaoItensTab } from './MovimentacaoItensTab';
import { AnaliseEstoqueTab } from './AnaliseEstoqueTab';

export interface EstoquePecasMarca {
  id: 'audi' | 'vw';
  name: string;
  primary: string;
  primaryLight: string;
}

interface Props {
  marca: EstoquePecasMarca;
  onBack: () => void;
}

type MainTab = 'importacao' | 'analise';
type ImportSubTab = 'inventario' | 'movimentacao';

export function EstoquePecasDashboard({ marca, onBack }: Props) {
  const [mainTab, setMainTab] = useState<MainTab>('analise');
  const [importSubTab, setImportSubTab] = useState<ImportSubTab>('inventario');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{marca.name}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Análise de Estoque de Peças</p>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
        >
          ← Voltar
        </button>
      </header>

      <div className="flex-1 p-6">
        {/* Abas principais */}
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)}>
          <TabsList className="h-auto p-1">
            <TabsTrigger
              value="importacao"
              className="gap-2 text-base px-5 py-2.5"
              style={mainTab === 'importacao' ? { backgroundColor: marca.primary, color: '#fff' } : undefined}
            >
              <FolderInput className="w-5 h-5" />
              Importação de Arquivo
            </TabsTrigger>
            <TabsTrigger
              value="analise"
              className="gap-2 text-base px-5 py-2.5"
              style={mainTab === 'analise' ? { backgroundColor: marca.primary, color: '#fff' } : undefined}
            >
              <BarChart3 className="w-5 h-5" />
              Análise de Estoque
            </TabsTrigger>
          </TabsList>

          <TabsContent value="importacao" className="mt-4">
            {/* Sub-abas de importação */}
            <Tabs value={importSubTab} onValueChange={(v) => setImportSubTab(v as ImportSubTab)}>
              <TabsList>
                <TabsTrigger
                  value="inventario"
                  style={importSubTab === 'inventario' ? { backgroundColor: marca.primary, color: '#fff' } : undefined}
                >
                  Importação de Arquivo Inventario de Estoque
                </TabsTrigger>
                <TabsTrigger
                  value="movimentacao"
                  style={importSubTab === 'movimentacao' ? { backgroundColor: marca.primary, color: '#fff' } : undefined}
                >
                  Importação de Arquivo Movimentação de Itens
                </TabsTrigger>
              </TabsList>

              <TabsContent value="inventario">
                <InventarioEstoqueTab marca={marca} />
              </TabsContent>

              <TabsContent value="movimentacao">
                <MovimentacaoItensTab marca={marca} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="analise" className="mt-4">
            <AnaliseEstoqueTab marca={marca} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
