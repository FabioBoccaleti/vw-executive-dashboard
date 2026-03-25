import { useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface TableData {
  headers: string[];
  rows: string[][];
}

interface ImportarPDFPageProps {
  onBack: () => void;
}

async function extractTableFromPDF(file: File): Promise<TableData> {
  // Importação dinâmica para evitar problemas de SSR
  const pdfjsLib = await import('pdfjs-dist');
  // Worker servido localmente (copiado de node_modules para public/)
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Coleta todos os itens de texto de todas as páginas
  type TextItem = { str: string; transform: number[]; width: number; height: number };
  const allItems: TextItem[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if ('str' in item && (item as TextItem).str.trim()) {
        allItems.push(item as TextItem);
      }
    }
  }

  if (allItems.length === 0) {
    return { headers: [], rows: [] };
  }

  // Agrupa itens por linha (coordenada Y arredondada)
  const lineMap = new Map<number, { x: number; str: string }[]>();
  for (const item of allItems) {
    const y = Math.round(item.transform[5]);
    if (!lineMap.has(y)) lineMap.set(y, []);
    lineMap.get(y)!.push({ x: item.transform[4], str: item.str });
  }

  // Ordena linhas de cima para baixo (Y maior = mais alto em PDF)
  const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);

  // Para cada linha, ordena itens da esquerda para direita e une
  const lines: string[][] = sortedYs.map((y) => {
    const cells = lineMap.get(y)!.sort((a, b) => a.x - b.x);
    return cells.map((c) => c.str.trim()).filter(Boolean);
  });

  // Filter out empty lines
  const nonEmptyLines = lines.filter((l) => l.length > 0);

  if (nonEmptyLines.length === 0) {
    return { headers: [], rows: [] };
  }

  // A primeira linha vira cabeçalho; o resto são linhas de dados
  const [headers, ...rows] = nonEmptyLines;
  return { headers, rows };
}

export function ImportarPDFPage({ onBack }: ImportarPDFPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Selecione um arquivo PDF válido.');
      return;
    }
    setLoading(true);
    setFileName(file.name);
    setTableData(null);
    try {
      const data = await extractTableFromPDF(file);
      if (data.headers.length === 0 && data.rows.length === 0) {
        toast.warning('Nenhum texto encontrado no PDF.');
      } else {
        toast.success('PDF importado com sucesso!');
      }
      setTableData(data);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar o PDF. Verifique o arquivo e tente novamente.');
    } finally {
      setLoading(false);
      // Limpa o input para permitir reimportar o mesmo arquivo
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleClear() {
    setTableData(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Importação de PDF</h1>
          <p className="text-xs text-slate-500 mt-0.5">Importe um PDF com tabela para visualizar os dados</p>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
        >
          ← Voltar
        </button>
      </header>

      {/* Conteúdo */}
      <div className="flex-1 p-6 flex flex-col gap-6">
        {/* Área de importação */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col items-start gap-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Upload className="w-4 h-4" />
              {loading ? 'Processando...' : 'Importar PDF'}
            </Button>

            {fileName && !loading && (
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded px-3 py-1.5">
                <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="max-w-xs truncate">{fileName}</span>
                <button onClick={handleClear} className="text-slate-400 hover:text-red-500 transition-colors ml-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400">
            Selecione um arquivo PDF contendo uma tabela. Os dados serão exibidos abaixo para revisão.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Tabela de resultado */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Lendo o PDF...</span>
            </div>
          </div>
        )}

        {!loading && tableData && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                Dados extraídos
                {tableData.rows.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {tableData.rows.length} linha{tableData.rows.length !== 1 ? 's' : ''}
                  </span>
                )}
              </h2>
            </div>

            {tableData.headers.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
                Nenhum dado encontrado no PDF.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      {tableData.headers.map((h, i) => (
                        <th
                          key={i}
                          className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}
                      >
                        {tableData.headers.map((_, colIdx) => (
                          <td
                            key={colIdx}
                            className="px-4 py-2 text-slate-700 border-b border-slate-100 whitespace-nowrap"
                          >
                            {row[colIdx] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!loading && !tableData && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-3">
            <FileText className="w-12 h-12" />
            <span className="text-sm">Nenhum PDF importado ainda</span>
          </div>
        )}
      </div>
    </div>
  );
}
