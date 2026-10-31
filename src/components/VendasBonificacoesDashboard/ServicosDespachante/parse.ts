import * as XLSX from 'xlsx';
import type {
  DespachanteCategory,
  DespachanteMarca,
  DespachanteMarcaData,
  DespachanteWeekData,
} from './storage';
import { TEXT_LABELS, normalize, parseMoney } from './shared';

function detectMarca(sheetName: string): DespachanteMarca {
  return normalize(sheetName).includes('audi') ? 'audi' : 'vw';
}

function extractVencimento(title: string): string | null {
  const match = title.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : null;
}

/**
 * Lê o arquivo Excel semanal (uma aba por marca) e devolve os dados tratados:
 * cabeçalhos repetidos, linhas de TOTAL e títulos intermediários são ignorados,
 * e os totais são recalculados a partir das linhas de dados.
 */
export function parseDespachanteWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
  category: DespachanteCategory,
  year: number,
  month: number,
  week: number,
): DespachanteWeekData {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const marcas: DespachanteMarcaData[] = [];

  for (const sheetName of workbook.SheetNames) {
    const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][];
    if (raw.length === 0) continue;

    const titulo = String(raw[0]?.find(cell => String(cell ?? '').trim()) ?? '').trim();
    const vencimento = extractVencimento(titulo);

    const headerRowIdx = raw.findIndex(row => {
      const norm = row.map(normalize);
      return norm.includes('processo') && norm.includes('valortotal');
    });
    if (headerRowIdx < 0) continue;

    const columns = raw[headerRowIdx]
      .map((cell, idx) => ({ idx, label: String(cell ?? '').trim() }))
      .filter(column => column.label !== '')
      .map(column => ({ ...column, numeric: !TEXT_LABELS.has(normalize(column.label)) }));

    const headers = columns.map(column => column.label);
    const numericHeaders = columns.filter(column => column.numeric).map(column => column.label);
    const lojaColumn = columns.find(column => normalize(column.label) === 'loja');

    const rows: Array<Record<string, string | number>> = [];
    for (let i = headerRowIdx + 1; i < raw.length; i += 1) {
      const row = raw[i];
      const n0 = normalize(row[0]);
      const n1 = normalize(row[1]);
      if (n0 === 'processo' || n1 === 'loja') continue; // cabeçalho repetido
      if (n0 === 'total') continue; // subtotal do arquivo
      if (n0.startsWith('relatorio')) continue; // título de bloco
      const loja = lojaColumn ? String(row[lojaColumn.idx] ?? '').trim() : '';
      if (!loja) continue; // linha vazia / separador

      const record: Record<string, string | number> = {};
      columns.forEach(column => {
        record[column.label] = column.numeric
          ? parseMoney(row[column.idx])
          : String(row[column.idx] ?? '').trim();
      });
      rows.push(record);
    }

    marcas.push({
      marca: detectMarca(sheetName),
      sheetName: sheetName.trim(),
      titulo,
      vencimento,
      headers,
      numericHeaders,
      rows,
    });
  }

  if (marcas.length === 0) {
    throw new Error('Não foi possível identificar abas válidas (esperado cabeçalho com PROCESSO e VALOR TOTAL).');
  }

  return {
    category,
    year,
    month,
    week,
    fileName,
    importedAt: new Date().toISOString(),
    marcas,
  };
}
