import { useRef, useState, useEffect } from 'react';
import { Upload, FileText, Printer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';
import { kvGet, kvSet, kvDelete } from '@/lib/kvClient';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

// ─── KV helpers (compartilhado entre todos os usuários via Redis em produção) ─
const KV_KEY = 'manual_relatorios:pdf';

interface StoredManual { base64: string; fileName: string; }

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function saveManualToKV(data: ArrayBuffer, fileName: string): Promise<void> {
  const base64 = arrayBufferToBase64(data);
  await kvSet(KV_KEY, { base64, fileName } satisfies StoredManual);
}

async function loadManualFromKV(): Promise<{ data: ArrayBuffer; fileName: string } | null> {
  const stored = await kvGet<StoredManual>(KV_KEY);
  if (!stored?.base64) return null;
  return { data: base64ToArrayBuffer(stored.base64), fileName: stored.fileName };
}

async function deleteManualFromKV(): Promise<void> {
  await kvDelete(KV_KEY);
}

// ─── Renderiza cada página do PDF como data URL JPEG ─────────────────────────
interface RenderedPage { pageNum: number; dataUrl: string; total: number; }

async function renderPDF(
  arrayBuffer: ArrayBuffer,
  onProgress?: (msg: string) => void,
): Promise<RenderedPage[]> {
  // Copia o buffer para evitar que pdfjs o detache (transfira)
  const pdf   = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
  const scale = 1.5;
  const pages: RenderedPage[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(`Renderizando página ${i} de ${pdf.numPages}...`);
    const page     = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas   = document.createElement('canvas');
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({ pageNum: i, dataUrl: canvas.toDataURL('image/jpeg', 0.92), total: pdf.numPages });
  }
  return pages;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function ManualRelatoriosPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [renderedPages, setRenderedPages] = useState<RenderedPage[]>([]);
  const [fileName, setFileName]           = useState<string | null>(null);
  const [loading, setLoading]             = useState(false);
  const [loadingMsg, setLoadingMsg]       = useState('Carregando...');

  // Carrega do KV (compartilhado entre todos os usuários) ao montar
  useEffect(() => {
    (async () => {
      try {
        const stored = await loadManualFromKV();
        if (!stored) return;
        setLoading(true);
        setLoadingMsg('Carregando manual salvo...');
        const pages = await renderPDF(stored.data.slice(0), setLoadingMsg);
        setFileName(stored.fileName);
        setRenderedPages(pages);
      } catch (err) {
        console.error('[ManualRelatorios] Erro ao carregar manual:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      toast.error('Selecione um arquivo PDF válido.');
      return;
    }
    setLoading(true);
    setLoadingMsg('Lendo o PDF...');
    setRenderedPages([]);
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Salva no KV (compartilhado) antes de renderizar
      await saveManualToKV(arrayBuffer.slice(0), file.name);
      const pages = await renderPDF(arrayBuffer.slice(0), setLoadingMsg);
      setFileName(file.name);
      setRenderedPages(pages);
      toast.success(`Manual importado com ${pages.length} página(s)!`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar o PDF.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleClear() {
    await deleteManualFromKV();
    setRenderedPages([]);
    setFileName(null);
    toast.success('Manual removido.');
  }

  function handlePrint() {
    if (renderedPages.length === 0) return;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Permita pop-ups para imprimir.'); return; }
    const imgs = renderedPages
      .map(p => `<div class="page"><img src="${p.dataUrl}" /></div>`)
      .join('');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${fileName ?? 'Manual de Relatórios'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fff; }
    .page { text-align: center; page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
    img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>${imgs}</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  return (
    <div className="flex-1 p-6 flex flex-col gap-4 overflow-auto">
      {/* Barra de ações */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-center gap-3">
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Upload className="w-4 h-4" />
          {loading ? 'Processando...' : fileName ? 'Substituir Manual (PDF)' : 'Importar Manual (PDF)'}
        </Button>

        {fileName && !loading && (
          <>
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded px-3 py-1.5">
              <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <span className="max-w-xs truncate">{fileName}</span>
              <span className="text-slate-400 text-xs ml-1">· {renderedPages.length} pág.</span>
            </div>

            <Button
              onClick={handlePrint}
              variant="outline"
              className="flex items-center gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>

            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remover manual
            </button>
          </>
        )}

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
            <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-center max-w-xs">{loadingMsg}</span>
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {!loading && renderedPages.length === 0 && (
        <div className="flex-1 flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4 text-center">
            <FileText className="w-16 h-16 text-slate-200" />
            <div>
              <p className="text-base font-semibold text-slate-400">Nenhum manual importado</p>
              <p className="text-sm text-slate-400 mt-1">
                Clique em "Importar Manual (PDF)" para carregar o arquivo
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Páginas renderizadas */}
      {!loading && renderedPages.length > 0 && (
        <div className="flex flex-col gap-3">
          {renderedPages.map(p => (
            <div
              key={p.pageNum}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500">
                  Página {p.pageNum} de {p.total}
                </span>
              </div>
              <div className="p-3 flex justify-center bg-slate-100">
                <img
                  src={p.dataUrl}
                  alt={`Página ${p.pageNum}`}
                  style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                  className="shadow"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
