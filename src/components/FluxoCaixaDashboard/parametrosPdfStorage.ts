import { getSessionData, getSessionToken } from '@/lib/authClient';
import { kvGet, kvSet } from '@/lib/kvClient';

export const PARAMETROS_PDF_KEY = 'analise_financeira_parametros_pdf_v1';
export const MAX_PARAMETROS_PDF_BYTES = 700 * 1024;
const PDF_ENDPOINT = '/api/analise-financeira/parametros-pdf';

export interface ParametrosPdfDocument {
  fileName: string;
  data: string;
  uploadedAt: string;
  uploadedBy: string;
}

function isParametrosPdfDocument(value: unknown): value is ParametrosPdfDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<ParametrosPdfDocument>;
  return typeof document.fileName === 'string'
    && typeof document.data === 'string'
    && typeof document.uploadedAt === 'string'
    && typeof document.uploadedBy === 'string';
}

function authorizationHeaders(): HeadersInit {
  const token = getSessionToken();
  if (!token) throw new Error('Sua sessão expirou. Entre novamente para acessar os parâmetros.');
  return { Authorization: `Bearer ${token}` };
}

async function responseJson(response: Response): Promise<{ document?: unknown; error?: string }> {
  const payload = await response.json() as { document?: unknown; error?: string };
  if (!response.ok) throw new Error(payload.error || `Falha ao acessar o PDF de parâmetros (${response.status}).`);
  return payload;
}

export async function loadParametrosPdf(): Promise<ParametrosPdfDocument | null> {
  if (import.meta.env.DEV) {
    const saved = await kvGet<unknown>(PARAMETROS_PDF_KEY, { throwOnError: true });
    if (saved === null) return null;
    if (!isParametrosPdfDocument(saved)) throw new Error('O PDF de parâmetros salvo localmente está inválido.');
    return saved;
  }

  const response = await fetch(PDF_ENDPOINT, { headers: authorizationHeaders() });
  const payload = await responseJson(response);
  if (payload.document === null || payload.document === undefined) return null;
  if (!isParametrosPdfDocument(payload.document)) throw new Error('O PDF de parâmetros recebido do servidor está inválido.');
  return payload.document;
}

export async function saveParametrosPdf(fileName: string, data: string): Promise<ParametrosPdfDocument> {
  if (import.meta.env.DEV) {
    const session = getSessionData();
    const document: ParametrosPdfDocument = {
      fileName,
      data,
      uploadedAt: new Date().toISOString(),
      uploadedBy: session?.username ?? 'admin local',
    };
    if (!await kvSet(PARAMETROS_PDF_KEY, document)) {
      throw new Error('Não foi possível salvar o PDF neste navegador.');
    }
    return document;
  }

  const response = await fetch(PDF_ENDPOINT, {
    method: 'POST',
    headers: { ...authorizationHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, data }),
  });
  const payload = await responseJson(response);
  if (!isParametrosPdfDocument(payload.document)) throw new Error('O servidor não confirmou o salvamento do PDF.');
  return payload.document;
}
