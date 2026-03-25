import { useRef, useState } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';

// Vite resolve este path para a URL correta do worker (dev e build)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

interface TableData {
  headers: string[];
  rows: string[][];
}

interface ImportarPDFPageProps {
  onBack: () => void;
}

async function extractTableFromPDF(file: File): Promise<TableData> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  type RawItem = { x: number; y: number; str: string };
  const allItems: RawItem[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const str = (item as { str: string }).str.trim();
      if (!str) continue;
      const transform = (item as { transform: number[] }).transform;
      // Converte Y do PDF (cresce para cima) para Y de tela (cresce para baixo)
      allItems.push({
        x: transform[4],
        y: viewport.height - transform[5],
        str,
      });
    }
  }

  if (allItems.length === 0) return { headers: [], rows: [] };

  // ── 1. Agrupa itens em linhas pela coordenada Y (tolerância ±4px) ──────────
  const Y_TOL = 4;
  const rowGroups: RawItem[][] = [];

  const sortedByY = [...allItems].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const item of sortedByY) {
    const existing = rowGroups.find(g => Math.abs(g[0].y - item.y) <= Y_TOL);
    if (existing) {
      existing.push(item);
    } else {
      rowGroups.push([item]);
    }
  }
  rowGroups.sort((a, b) => a[0].y - b[0].y);
  for (const row of rowGroups) row.sort((a, b) => a.x - b.x);

  // ── 2. Detecta âncoras de colunas clusterizando posições X de todos os items ─
  const X_GAP = 12; // itens dentro desse gap pertencem à mesma coluna
  const allXs = [...allItems].map(i => i.x).sort((a, b) => a - b);
  const colAnchors: number[] = [];
  for (const x of allXs) {
    if (!colAnchors.some(cx => Math.abs(cx - x) <= X_GAP)) {
      colAnchors.push(x);
    }
  }
  colAnchors.sort((a, b) => a - b);

  // ── 3. Monta matriz: cada item vai para a coluna mais próxima ──────────────
  const matrix: string[][] = rowGroups.map(row => {
    const cells = new Array<string>(colAnchors.length).fill('');
    for (const item of row) {
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < colAnchors.length; i++) {
        const d = Math.abs(colAnchors[i] - item.x);
        if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
      }
      // Múltiplos runs na mesma célula são concatenados
      cells[nearestIdx] = cells[nearestIdx]
        ? cells[nearestIdx] + ' ' + item.str
        : item.str;
    }
    return cells;
  });

  // ── 4. Remove colunas e linhas inteiramente vazias ─────────────────────────
  const usedCols = colAnchors
    .map((_, i) => i)
    .filter(i => matrix.some(r => r[i].trim()));

  const trimmed = matrix
    .map(row => usedCols.map(i => row[i]))
    .filter(row => row.some(c => c.trim()));

  if (trimmed.length === 0) return { headers: [], rows: [] };

  const [headers, ...rows] = trimmed;
  return { headers, rows };
}

export function ImportarPDFPage({ onBack }: ImportarPDFPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Aceita por extensão também, pois alguns sistemas retornam MIME vazio
    const isLikelyPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isLikelyPdf) {
      toast.error('Selecione um arquivo PDF válido.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
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
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      toast.error('Erro ao processar o PDF.');
    } finally {
      setLoading(false);
      // Limpa o input para permitir reimportar o mesmo arquivo
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleClear() {
    setTableData(null);
    setFileName(null);
    setErrorMsg(null);
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

        {/* Spinner */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Lendo o PDF...</span>
            </div>
          </div>
        )}

        {/* Erro detalhado */}
        {!loading && errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 mb-1">Erro ao processar o PDF</p>
              <p className="text-xs text-red-600 font-mono break-all">{errorMsg}</p>
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
