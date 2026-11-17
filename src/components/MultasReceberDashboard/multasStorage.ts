import { kvGet, kvKeys, kvSet } from '@/lib/kvClient';
import { parseDuplicatasTxt } from '@/components/DuplicatasReceberDashboard/duplicatasStorage';
import { parseDateBR } from '@/components/DuplicatasReceberDashboard/duplicatasAnalise';

export interface MultasImport {
  month: string;
  fileName: string;
  importedAt: number;
  headers: string[];
  rows: string[][];
}

const PREFIX = 'multas_receber:posicao:';
const BASE_PREFIX = 'multas_receber:base_date:';

/** Reutiliza o TXT de duplicatas, sem marca e sem incluir totais/subtotais. */
export function parseMultasTxt(content: string): Pick<MultasImport, 'headers' | 'rows'> {
  const parsed = parseDuplicatasTxt(content.replace(/^\uFEFF/, ''));
  const headers = parsed.headers.map(header => header.toUpperCase());
  const required = ['TITULO', 'NOME_CLIENTE', 'DTA_VENCIMENTO', 'VENCIDO', 'AVENCER', 'DEPARTAMENTO', 'NOME_DEPARTAMENTO'];
  const missing = required.filter(header => !headers.includes(header));
  if (missing.length) throw new Error(`Colunas obrigatórias ausentes: ${missing.join(', ')}.`);
  const index = (name: string) => headers.indexOf(name);
  const rows = parsed.rows.filter(row => row[index('TITULO')] || row[index('DTA_VENCIMENTO')]);
  if (!rows.length) throw new Error('O arquivo não contém títulos para importar.');
  rows.forEach((row, i) => {
    for (const column of ['VENCIDO', 'AVENCER']) {
      const value = row[index(column)];
      if (value && !/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(value)) {
        throw new Error(`Valor inválido na coluna ${column}, título ${i + 1}.`);
      }
      if (value && !Number.isFinite(Number(value.replace(/\./g, '').replace(',', '.')))) {
        throw new Error(`Valor fora do limite na coluna ${column}, título ${i + 1}.`);
      }
    }
    const rawDate = row[index('DTA_VENCIMENTO')];
    if (rawDate) {
      const date = parseDateBR(rawDate);
      const parts = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!date || !parts || date.getDate() !== Number(parts[1])
        || date.getMonth() + 1 !== Number(parts[2]) || date.getFullYear() !== Number(parts[3])) {
        throw new Error(`Vencimento inválido no título ${i + 1}: ${rawDate}.`);
      }
    }
  });
  return { headers, rows };
}

export async function saveMultas(data: MultasImport): Promise<void> {
  if (!await kvSet(`${PREFIX}${data.month}`, data)) {
    throw new Error('Não foi possível salvar as multas importadas.');
  }
}

export function getMultas(month: string): Promise<MultasImport | null> {
  return kvGet<MultasImport>(`${PREFIX}${month}`, { throwOnError: true });
}

export async function getMultasMonths(): Promise<string[]> {
  const keys = await kvKeys(`${PREFIX}*`);
  return keys.map(key => key.slice(PREFIX.length))
    .filter(month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    .sort((a, b) => b.localeCompare(a));
}

export function getMultasBaseDate(month: string): Promise<string | null> {
  return kvGet<string>(`${BASE_PREFIX}${month}`, { throwOnError: true });
}

export async function saveMultasBaseDate(month: string, iso: string): Promise<void> {
  if (!await kvSet(`${BASE_PREFIX}${month}`, iso)) {
    throw new Error('Não foi possível salvar a data-base.');
  }
}
