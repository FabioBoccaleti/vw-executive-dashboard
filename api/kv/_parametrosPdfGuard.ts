import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../auth/_helpers';

export const PARAMETROS_PDF_KEY = 'analise_financeira_parametros_pdf_v1';

export async function permitirAlteracaoParametrosPdf(
  req: VercelRequest,
  res: VercelResponse,
  key: string,
): Promise<boolean> {
  if (key !== PARAMETROS_PDF_KEY) return true;
  if (await requireAdmin(req.headers.authorization)) return true;
  res.status(403).json({ error: 'Somente administradores podem substituir o PDF de parâmetros.' });
  return false;
}
