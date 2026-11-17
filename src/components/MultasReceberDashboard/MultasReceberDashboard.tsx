import { useState } from 'react';
import { BarChart3, FolderInput } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImportacaoMultasTab } from './ImportacaoMultasTab';
import { AnaliseMultasTab } from './AnaliseMultasTab';

export function MultasReceberDashboard({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState('analise');
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Multas a Receber</h1>
          <p className="text-xs text-slate-500 mt-0.5">Análise Financeira</p>
        </div>
        <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50">
          ← Voltar
        </button>
      </header>
      <div className="flex-1 p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto p-1">
            <TabsTrigger value="importacao" className="gap-2 text-base px-5 py-2.5" style={tab === 'importacao' ? { backgroundColor: '#4f46e5', color: '#fff' } : undefined}>
              <FolderInput className="w-5 h-5" /> Importação de Arquivo
            </TabsTrigger>
            <TabsTrigger value="analise" className="gap-2 text-base px-5 py-2.5" style={tab === 'analise' ? { backgroundColor: '#4f46e5', color: '#fff' } : undefined}>
              <BarChart3 className="w-5 h-5" /> Análise
            </TabsTrigger>
          </TabsList>
          <TabsContent value="importacao" className="mt-4"><ImportacaoMultasTab /></TabsContent>
          <TabsContent value="analise" className="mt-4"><AnaliseMultasTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
