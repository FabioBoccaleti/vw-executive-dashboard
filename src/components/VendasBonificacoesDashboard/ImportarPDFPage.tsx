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
      const t = (item as { transform: number[] }).transform;
      allItems.push({ x: t[4], y: viewport.height - t[5], str });
    }
  }

  if (allItems.length === 0) return { headers: [], rows: [] };

  // ── 1. Detecta threshold de separação de linhas pela moda dos gaps de Y ───
  // PDFs com cabeçalhos multi-linha têm dois grupos de gaps:
  //   • gaps pequenos  = salto de linha dentro da mesma célula (ex: 10pt)
  //   • gaps maiores   = separação entre linhas de dados        (ex: 20pt)
  // A moda corresponde ao gap mais frequente (linhas de dados).
  // Usamos 70% da moda: gaps abaixo disso → mesma linha lógica (multi-linha).
  const uniqueYs = [...new Set(allItems.map(i => Math.round(i.y)))].sort((a, b) => a - b);
  let rowSepThresh = 8;
  if (uniqueYs.length > 2) {
    const gaps = uniqueYs.slice(1).map((y, i) => y - uniqueYs[i]);
    const cnt = new Map<number, number>();
    for (const g of gaps) {
      const r = Math.round(g / 2) * 2;
      cnt.set(r, (cnt.get(r) ?? 0) + 1);
    }
    let modeGap = 0, modeCount = 0;
    for (const [g, c] of cnt) if (c > modeCount) { modeGap = g; modeCount = c; }
    rowSepThresh = Math.max(4, modeGap * 0.7);
  }

  // ── 2. Agrupa Y em faixas lógicas ────────────────────────────────────────
  // Gaps < threshold → mesma faixa (linhas do cabeçalho multi-linha)
  // Gaps ≥ threshold → nova faixa (próxima linha de dados)
  const bands: number[][] = [[uniqueYs[0]]];
  for (let i = 1; i < uniqueYs.length; i++) {
    const gap = uniqueYs[i] - uniqueYs[i - 1];
    if (gap < rowSepThresh) {
      bands[bands.length - 1].push(uniqueYs[i]);
    } else {
      bands.push([uniqueYs[i]]);
    }
  }

  const yToBand = new Map<number, number>();
  bands.forEach((band, idx) => band.forEach(y => yToBand.set(y, idx)));

  // ── 3. Agrupa itens por faixa ─────────────────────────────────────────────
  const bandItems = new Map<number, RawItem[]>();
  for (const item of allItems) {
    const ry = Math.round(item.y);
    const band = yToBand.get(ry);
    if (band === undefined) continue;
    if (!bandItems.has(band)) bandItems.set(band, []);
    bandItems.get(band)!.push(item);
  }

  // ── 4. Detecta âncoras de colunas agrupando posições X ───────────────────
  const X_GAP = 10;
  const allXsSorted = allItems.map(i => i.x).sort((a, b) => a - b);
  const colAnchors: number[] = [];
  for (const x of allXsSorted) {
    if (!colAnchors.some(cx => Math.abs(cx - x) <= X_GAP)) colAnchors.push(x);
  }
  colAnchors.sort((a, b) => a - b);

  // ── 5. Monta matriz: cada item vai para a coluna mais próxima ─────────────
  // Dentro de uma faixa, ordena por (X asc, Y asc) para que texto multi-linha
  // seja concatenado na ordem correta: linha 1 antes da linha 2 da célula.
  const sortedBandIdxs = [...bandItems.keys()].sort((a, b) => a - b);
  const matrix: string[][] = sortedBandIdxs.map(bandIdx => {
    const cells = new Array<string>(colAnchors.length).fill('');
    const items = bandItems.get(bandIdx)!.sort((a, b) => a.x - b.x || a.y - b.y);
    for (const item of items) {
      let nearest = 0, nearestD = Infinity;
      for (let i = 0; i < colAnchors.length; i++) {
        const d = Math.abs(colAnchors[i] - item.x);
        if (d < nearestD) { nearestD = d; nearest = i; }
      }
      cells[nearest] = cells[nearest] ? cells[nearest] + ' ' + item.str : item.str;
    }
    return cells;
  });

  // ── 6. Remove colunas e linhas completamente vazias ───────────────────────
  const usedCols = colAnchors.map((_, i) => i).filter(i => matrix.some(r => r[i].trim()));
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
