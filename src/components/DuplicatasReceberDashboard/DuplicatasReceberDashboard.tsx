import { useState } from 'react';
import { FolderInput, BarChart3 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ImportacaoDuplicatasTab } from './ImportacaoDuplicatasTab';
import { AnaliseDuplicatasTab } from './AnaliseDuplicatasTab';
import type { DuplicatasMarcaId } from './duplicatasStorage';

export interface DuplicatasMarca {
  id: DuplicatasMarcaId;
  name: string;
  primary: string;
  primaryLight: string;
}

interface Props {
  onBack: () => void;
}

type MainTab = 'importacao' | 'analise';

const MARCAS: DuplicatasMarca[] = [
  { id: 'audi', name: 'Audi', primary: '#bb0a30', primaryLight: '#fce8ec' },
  { id: 'vw', name: 'VW', primary: '#001e50', primaryLight: '#e8f4fc' },
];

export function DuplicatasReceberDashboard({ onBack }: Props) {
  const [mainTab, setMainTab] = useState<MainTab>('importacao');
  const [importMarca, setImportMarca] = useState<DuplicatasMarcaId>('audi');
  const [analiseMarca, setAnaliseMarca] = useState<DuplicatasMarcaId>('audi');

  const accent = '#4f46e5';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Duplicatas a Receber</h1>
          <p className="text-xs text-slate-500 mt-0.5">Análise Financeira</p>
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
              style={mainTab === 'importacao' ? { backgroundColor: accent, color: '#fff' } : undefined}
            >
              <FolderInput className="w-5 h-5" />
              Importação de Arquivo
            </TabsTrigger>
            <TabsTrigger
              value="analise"
              className="gap-2 text-base px-5 py-2.5"
              style={mainTab === 'analise' ? { backgroundColor: accent, color: '#fff' } : undefined}
            >
              <BarChart3 className="w-5 h-5" />
              Análise
            </TabsTrigger>
          </TabsList>

          <TabsContent value="importacao" className="mt-4">
            <Tabs value={importMarca} onValueChange={(v) => setImportMarca(v as DuplicatasMarcaId)}>
              <TabsList>
                {MARCAS.map((m) => (
                  <TabsTrigger
                    key={m.id}
                    value={m.id}
                    style={importMarca === m.id ? { backgroundColor: m.primary, color: '#fff' } : undefined}
                  >
                    {m.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {MARCAS.map((m) => (
                <TabsContent key={m.id} value={m.id}>
                  <ImportacaoDuplicatasTab marca={m} />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          <TabsContent value="analise" className="mt-4">
            <Tabs value={analiseMarca} onValueChange={(v) => setAnaliseMarca(v as DuplicatasMarcaId)}>
              <TabsList>
                {MARCAS.map((m) => (
                  <TabsTrigger
                    key={m.id}
                    value={m.id}
                    style={analiseMarca === m.id ? { backgroundColor: m.primary, color: '#fff' } : undefined}
                  >
                    {m.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {MARCAS.map((m) => (
                <TabsContent key={m.id} value={m.id}>
                  <AnaliseDuplicatasTab marca={m} />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
