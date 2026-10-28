import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, FolderInput } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InventarioEstoqueTab } from './InventarioEstoqueTab';

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

type MainTab = 'importacao';
type ImportSubTab = 'inventario' | 'movimentacao';

function ImportCard({
  titulo,
  descricao,
  marca,
}: {
  titulo: string;
  descricao: string;
  marca: EstoquePecasMarca;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
        <div className="flex flex-col items-center text-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: marca.primaryLight, color: marca.primary }}
          >
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">{titulo}</h3>
            <p className="text-sm text-slate-500 mt-1">{descricao}</p>
          </div>

          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: marca.primary }}
          >
            <Upload className="w-4 h-4" />
            Selecionar arquivo
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />

          {fileName && (
            <p className="text-sm text-slate-600">
              Arquivo selecionado: <span className="font-medium">{fileName}</span>
            </p>
          )}

          <p className="text-xs text-slate-400">
            O processamento do arquivo será configurado na próxima etapa.
          </p>
        </div>
      </div>
    </div>
  );
}

export function EstoquePecasDashboard({ marca, onBack }: Props) {
  const [mainTab, setMainTab] = useState<MainTab>('importacao');
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
          <TabsList>
            <TabsTrigger value="importacao" className="gap-1.5">
              <FolderInput className="w-4 h-4" />
              Importação de Arquivo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="importacao" className="mt-4">
            {/* Sub-abas de importação */}
            <Tabs value={importSubTab} onValueChange={(v) => setImportSubTab(v as ImportSubTab)}>
              <TabsList>
                <TabsTrigger value="inventario">
                  Importação de Arquivo Inventario de Estoque
                </TabsTrigger>
                <TabsTrigger value="movimentacao">
                  Importação de Arquivo Movimentação de Itens
                </TabsTrigger>
              </TabsList>

              <TabsContent value="inventario">
                <InventarioEstoqueTab marca={marca} />
              </TabsContent>

              <TabsContent value="movimentacao">
                <ImportCard
                  titulo="Importação de Arquivo Movimentação de Itens"
                  descricao="Selecione o arquivo de movimentação de itens para importação."
                  marca={marca}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
