import { useState } from 'react';
import { FolderInput, BarChart3, SlidersHorizontal, ListChecks } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ImportacaoContasPagarTab } from './ImportacaoContasPagarTab';
import { AnaliseContasPagarTab } from './AnaliseContasPagarTab';
import { DepartamentosContasPagarTab } from './DepartamentosContasPagarTab';
import { CadastroOrigemTab } from './CadastroOrigemTab';
import type { ContasPagarMarcaId } from './contasPagarStorage';

export interface ContasPagarMarca {
  id: ContasPagarMarcaId;
  name: string;
  primary: string;
  primaryLight: string;
}

interface Props {
  onBack: () => void;
}

type MainTab = 'importacao' | 'analise' | 'parametros' | 'origens';

const MARCAS: ContasPagarMarca[] = [
  { id: 'audi', name: 'Audi', primary: '#bb0a30', primaryLight: '#fce8ec' },
  { id: 'vw', name: 'VW', primary: '#001e50', primaryLight: '#e8f4fc' },
];

export function ContasPagarDashboard({ onBack }: Props) {
  const [mainTab, setMainTab] = useState<MainTab>('analise');
  const [importMarca, setImportMarca] = useState<ContasPagarMarcaId>('audi');
  const [analiseMarca, setAnaliseMarca] = useState<ContasPagarMarcaId>('audi');
  const [parametrosMarca, setParametrosMarca] = useState<ContasPagarMarcaId>('audi');
  const [origensMarca, setOrigensMarca] = useState<ContasPagarMarcaId>('audi');

  const accent = '#4f46e5';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Contas a Pagar</h1>
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
            <TabsTrigger
              value="parametros"
              className="gap-2 text-base px-5 py-2.5"
              style={mainTab === 'parametros' ? { backgroundColor: accent, color: '#fff' } : undefined}
            >
              <SlidersHorizontal className="w-5 h-5" />
              Parâmetros
            </TabsTrigger>
            <TabsTrigger
              value="origens"
              className="gap-2 text-base px-5 py-2.5"
              style={mainTab === 'origens' ? { backgroundColor: accent, color: '#fff' } : undefined}
            >
              <ListChecks className="w-5 h-5" />
              Cadastro origem
            </TabsTrigger>
          </TabsList>

          <TabsContent value="importacao" className="mt-4">
            <Tabs value={importMarca} onValueChange={(v) => setImportMarca(v as ContasPagarMarcaId)}>
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
                  <ImportacaoContasPagarTab marca={m} />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          <TabsContent value="analise" className="mt-4">
            <Tabs value={analiseMarca} onValueChange={(v) => setAnaliseMarca(v as ContasPagarMarcaId)}>
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
                  <AnaliseContasPagarTab marca={m} />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          <TabsContent value="parametros" className="mt-4">
            <Tabs value={parametrosMarca} onValueChange={(v) => setParametrosMarca(v as ContasPagarMarcaId)}>
              <TabsList>
                {MARCAS.map((m) => (
                  <TabsTrigger
                    key={m.id}
                    value={m.id}
                    style={parametrosMarca === m.id ? { backgroundColor: m.primary, color: '#fff' } : undefined}
                  >
                    {m.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {MARCAS.map((m) => (
                <TabsContent key={m.id} value={m.id}>
                  <DepartamentosContasPagarTab marca={m} />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          <TabsContent value="origens" className="mt-4">
            <Tabs value={origensMarca} onValueChange={(v) => setOrigensMarca(v as ContasPagarMarcaId)}>
              <TabsList>
                {MARCAS.map((m) => (
                  <TabsTrigger
                    key={m.id}
                    value={m.id}
                    style={origensMarca === m.id ? { backgroundColor: m.primary, color: '#fff' } : undefined}
                  >
                    {m.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {MARCAS.map((m) => (
                <TabsContent key={m.id} value={m.id}>
                  <CadastroOrigemTab marca={m} />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
