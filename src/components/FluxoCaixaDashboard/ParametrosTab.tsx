import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, FileText, Upload } from 'lucide-react';
import {
  loadParametrosPdf,
  MAX_PARAMETROS_PDF_BYTES,
  saveParametrosPdf,
  type ParametrosPdfDocument,
} from './parametrosPdfStorage';

const PDF_INICIAL_URL = '/parametros-de-relatorios.pdf';
const PDF_INICIAL_NOME = 'Parâmetros de Relatórios.pdf';

interface ParametrosTabProps {
  isAdmin: boolean;
}

function criarUrlPdf(data: string): string {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

async function arquivoParaBase64(file: File): Promise<string> {
  if (file.size > MAX_PARAMETROS_PDF_BYTES) {
    throw new Error(`O PDF deve ter no máximo ${Math.floor(MAX_PARAMETROS_PDF_BYTES / 1024)} KB.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') {
    throw new Error('O arquivo selecionado não contém um PDF válido.');
  }
  let binary = '';
  const tamanhoBloco = 0x8000;
  for (let inicio = 0; inicio < bytes.length; inicio += tamanhoBloco) {
    binary += String.fromCharCode(...bytes.subarray(inicio, inicio + tamanhoBloco));
  }
  return btoa(binary);
}

export function ParametrosTab({ isAdmin }: ParametrosTabProps) {
  const [documento, setDocumento] = useState<ParametrosPdfDocument | null>(null);
  const [pdfUrl, setPdfUrl] = useState(PDF_INICIAL_URL);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ativo = true;
    loadParametrosPdf()
      .then(saved => {
        if (ativo) setDocumento(saved);
      })
      .catch(error => {
        if (ativo) setErro(error instanceof Error ? error.message : 'Não foi possível carregar o PDF de parâmetros.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (!documento) {
      setPdfUrl(PDF_INICIAL_URL);
      return;
    }
    try {
      const url = criarUrlPdf(documento.data);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch {
      setErro('O PDF armazenado não pôde ser exibido. Importe novamente um arquivo válido.');
      setPdfUrl(PDF_INICIAL_URL);
    }
  }, [documento]);

  async function importarPdf(file?: File) {
    if (!file) return;
    setErro(null);
    setAviso(null);
    setSalvando(true);
    try {
      if (!file.name.toLocaleLowerCase().endsWith('.pdf')) {
        throw new Error('Selecione um arquivo com extensão .pdf.');
      }
      const data = await arquivoParaBase64(file);
      setDocumento(await saveParametrosPdf(file.name, data));
      setAviso('PDF de parâmetros atualizado. Ele já está disponível para os usuários.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível salvar o PDF de parâmetros.');
    } finally {
      setSalvando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const nomeArquivo = documento?.fileName ?? PDF_INICIAL_NOME;
  const linkProps = pdfUrl.startsWith('blob:') ? { download: nomeArquivo } : { download: PDF_INICIAL_NOME };

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-700" />
            <h2 className="text-xl font-bold text-slate-800">Parâmetros</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Consulte o PDF de referência para gerar os relatórios no formato esperado.
          </p>
        </div>
        {isAdmin && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              aria-label="Selecionar PDF de parâmetros"
              onChange={event => { void importarPdf(event.target.files?.[0]); }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {salvando ? 'Importando PDF…' : 'Importar / substituir PDF'}
            </button>
          </>
        )}
      </header>

      {carregando && <p role="status" className="text-sm text-slate-600">Carregando PDF de parâmetros…</p>}
      {erro && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {aviso && <p role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{aviso}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{nomeArquivo}</p>
          {documento && (
            <p className="mt-0.5 text-xs text-slate-500">
              Atualizado em {new Date(documento.uploadedAt).toLocaleString('pt-BR')} por {documento.uploadedBy}
            </p>
          )}
          {!isAdmin && <p className="mt-0.5 text-xs text-slate-500">Apenas administradores podem substituir este documento.</p>}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            {...linkProps}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir PDF
          </a>
          <a
            href={pdfUrl}
            {...linkProps}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar
          </a>
        </div>
      </div>

      <iframe
        title="Visualizador do PDF de parâmetros para geração de relatórios"
        src={pdfUrl}
        className="h-[calc(100vh-17rem)] min-h-[480px] w-full rounded-lg border border-slate-300 bg-white"
      />
      {isAdmin && <p className="text-xs text-slate-500">O arquivo deve ser um PDF válido de até 700 KB.</p>}
    </section>
  );
}
