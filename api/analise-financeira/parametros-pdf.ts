import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractToken, getSession, redis, requireAdmin } from '../auth/_helpers';
import { PARAMETROS_PDF_KEY } from '../kv/_parametrosPdfGuard';

const MAX_PDF_BYTES = 700 * 1024;

interface ParametrosPdfDocument {
  fileName: string;
  data: string;
  uploadedAt: string;
  uploadedBy: string;
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '2mb' },
  },
};

function readDocument(value: unknown): ParametrosPdfDocument | null {
  const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value;
  if (!parsed || typeof parsed !== 'object') return null;
  const document = parsed as Partial<ParametrosPdfDocument>;
  if (typeof document.fileName !== 'string'
    || typeof document.data !== 'string'
    || typeof document.uploadedAt !== 'string'
    || typeof document.uploadedBy !== 'string') return null;
  return document as ParametrosPdfDocument;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const authorization = req.headers.authorization;
  if (req.method === 'GET') {
    const token = extractToken(authorization);
    const session = token ? await getSession(token) : null;
    if (!session) return res.status(401).json({ error: 'Não autenticado.' });
    if (session.role !== 'admin' && !session.modules.includes('fluxo_caixa')) {
      return res.status(403).json({ error: 'Sem permissão para acessar os parâmetros.' });
    }

    try {
      const stored = await redis.get<unknown>(PARAMETROS_PDF_KEY);
      if (stored === null) return res.status(200).json({ document: null });
      const document = readDocument(stored);
      if (!document) return res.status(500).json({ error: 'O PDF armazenado está inválido.' });
      return res.status(200).json({ document });
    } catch (error) {
      console.error('Erro ao carregar PDF de parâmetros:', error);
      return res.status(500).json({ error: 'Não foi possível carregar o PDF de parâmetros.' });
    }
  }

  const admin = await requireAdmin(authorization);
  if (!admin) return res.status(403).json({ error: 'Somente administradores podem substituir o PDF.' });

  const body = req.body as { fileName?: unknown; data?: unknown } | undefined;
  if (!body || typeof body.fileName !== 'string' || typeof body.data !== 'string') {
    return res.status(400).json({ error: 'Informe o nome e o conteúdo do arquivo PDF.' });
  }
  const fileName = body.fileName.trim().replace(/[\r\n]/g, '');
  const data = body.data;
  if (!fileName || fileName.length > 180 || !fileName.toLocaleLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ error: 'O nome do arquivo deve terminar em .pdf e ter até 180 caracteres.' });
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) {
    return res.status(400).json({ error: 'O conteúdo do arquivo PDF está inválido.' });
  }

  const bytes = Buffer.from(data, 'base64');
  if (bytes.length > MAX_PDF_BYTES) {
    return res.status(413).json({ error: 'O PDF deve ter no máximo 700 KB.' });
  }
  if (bytes.length === 0 || bytes.toString('base64') !== data || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return res.status(400).json({ error: 'O arquivo selecionado não contém um PDF válido.' });
  }

  const document: ParametrosPdfDocument = {
    fileName,
    data,
    uploadedAt: new Date().toISOString(),
    uploadedBy: admin.username,
  };
  try {
    await redis.set(PARAMETROS_PDF_KEY, JSON.stringify(document));
    return res.status(200).json({ document });
  } catch (error) {
    console.error('Erro ao salvar PDF de parâmetros:', error);
    return res.status(500).json({ error: 'Não foi possível salvar o PDF de parâmetros.' });
  }
}
