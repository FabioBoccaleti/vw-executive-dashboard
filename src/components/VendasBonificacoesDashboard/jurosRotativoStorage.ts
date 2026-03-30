import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'juros_rotativo';

export interface JurosRotativoRow {
  id: string;
  dataPagamento: string;
  notaFiscal: string;
  jurosPagos: string;
  highlight: boolean;
  annotation: string;
  periodoImport?: string; // "YYYY-MM" — período declarado na importação, tem prioridade no filtro
}

export function createEmptyJurosRotativoRow(): JurosRotativoRow {
  return {
    id: crypto.randomUUID(),
    dataPagamento: '',
    notaFiscal: '',
    jurosPagos: '',
    highlight: false,
    annotation: '',
    periodoImport: undefined,
  };
}

function normalize(r: Record<string, unknown> & { id: string }): JurosRotativoRow {
  return {
    id:            r.id,
    dataPagamento: String(r.dataPagamento ?? ''),
    notaFiscal:    String(r.notaFiscal    ?? ''),
    jurosPagos:    String(r.jurosPagos    ?? ''),
    highlight:     Boolean(r.highlight    ?? false),
    annotation:    String(r.annotation    ?? ''),
  };
}

export async function loadJurosRotativoRows(): Promise<JurosRotativoRow[]> {
  try {
    const data = await kvGet(KEY);
    if (Array.isArray(data)) return (data as (Record<string, unknown> & { id: string })[]).map(normalize);
    return [];
  } catch {
    return [];
  }
}

export async function saveJurosRotativoRows(rows: JurosRotativoRow[]): Promise<boolean> {
  try {
    await kvSet(KEY, rows);
    return true;
  } catch {
    return false;
  }
}

/** Substitui todos os dados (usado na importação por TXT ou Excel) */
export async function replaceJurosRotativoRows(
  rows: Omit<JurosRotativoRow, 'id' | 'highlight' | 'annotation'>[],
  periodoImport?: string, // "YYYY-MM"
): Promise<{ total: number }> {
  const withIds: JurosRotativoRow[] = rows.map(r => ({
    ...r,
    id: crypto.randomUUID(),
    highlight: false,
    annotation: '',
    periodoImport: periodoImport ?? r.periodoImport,
  }));
  await saveJurosRotativoRows(withIds);
  return { total: withIds.length };
}

/**
 * Mescla novos dados no storage, substituindo APENAS as linhas do mesmo
 * período (ano/mês) detectado nos dados novos. Linhas de outros períodos
 * são preservadas intactas.
 */
export async function mergeJurosRotativoByPeriod(
  newRows: Omit<JurosRotativoRow, 'id' | 'highlight' | 'annotation'>[],
): Promise<{ total: number; period: string | null }> {
  if (newRows.length === 0) return { total: 0, period: null };

  // Detecta período predominante dos novos dados
  const periodCounts = new Map<string, { year: number; month: number; count: number }>();
  for (const r of newRows) {
    const d = extractDate(r.dataPagamento);
    if (!d) continue;
    const key = `${d.year}-${String(d.month).padStart(2, '0')}`;
    const cur = periodCounts.get(key);
    periodCounts.set(key, cur ? { ...cur, count: cur.count + 1 } : { year: d.year, month: d.month, count: 1 });
  }
  const dominant = Array.from(periodCounts.values()).sort((a, b) => b.count - a.count)[0];

  // Carrega dados existentes e remove apenas as linhas do mesmo período (descarta linhas completamente vazias)
  const existing = await loadJurosRotativoRows();
  const kept = dominant
    ? existing.filter(r => {
        if (!r.dataPagamento && !r.notaFiscal && !r.jurosPagos) return false; // linha vazia
        const d = extractDate(r.dataPagamento);
        if (!d) return true; // sem data mas tem algum dado: preserva
        return !(d.year === dominant.year && d.month === dominant.month);
      })
    : existing.filter(r => !(!r.dataPagamento && !r.notaFiscal && !r.jurosPagos));

  const toAdd: JurosRotativoRow[] = newRows.map(r => ({
    ...r,
    id: crypto.randomUUID(),
    highlight: false,
    annotation: '',
    periodoImport: dominant
      ? `${dominant.year}-${String(dominant.month).padStart(2, '0')}`
      : undefined,
  }));

  await saveJurosRotativoRows([...kept, ...toAdd]);
  return {
    total: toAdd.length,
    period: dominant ? `${dominant.year}-${String(dominant.month).padStart(2, '0')}` : null,
  };
}

// ─── Parser TXT ───────────────────────────────────────────────────────────────
// Separador: `;`
// Colunas usadas:
//   Titulo        → notaFiscal
//   Data Pagamento → dataPagamento
//   Acrescimos     → jurosPagos
//
// Regra: notas fiscais repetidas no mesmo mês são somadas.
// ──────────────────────────────────────────────────────────────────────────────

function extractDate(raw: string): { year: number; month: number } | null {
  if (!raw) return null;
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [, mm, yyyy] = raw.split('/');
    return { year: Number(yyyy), month: Number(mm) };
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [yyyy, mm] = raw.split('-');
    return { year: Number(yyyy), month: Number(mm) };
  }
  return null;
}

export function parseTxtJurosRotativo(
  content: string,
): Omit<JurosRotativoRow, 'id' | 'highlight' | 'annotation'>[] {
  const rawLines = content.split(/\r?\n/);

  // Junta linhas de continuação (mesmo padrão do arquivo de registro)
  const lines: string[] = [];
  for (const raw of rawLines) {
    if (!raw.trim()) continue;
    if (lines.length === 0 || /^[A-Za-z\d"]/.test(raw)) {
      lines.push(raw);
    } else {
      lines[lines.length - 1] += raw;
    }
  }

  if (lines.length < 2) return [];

  // Monta mapa de colunas pelo cabeçalho
  const sep = lines[0].includes(';') ? ';' : '\t';
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  const colIndex: Record<string, number> = {};
  headers.forEach((h, i) => { colIndex[h] = i; });

  // Nomes aceitos para cada campo (case-insensitive fallback resolvido abaixo)
  const findIdx = (...candidates: string[]): number => {
    for (const c of candidates) {
      const found = Object.entries(colIndex).find(([k]) => k.toLowerCase() === c.toLowerCase());
      if (found) return found[1];
    }
    return -1;
  };

  const idxTitulo = findIdx('Titulo', 'TITULO', 'Título', 'NUM_TITULO', 'N_TITULO');
  const idxData   = findIdx('Data Pagamento', 'DATA_PAGAMENTO', 'DTA_PAGAMENTO', 'DataPagamento');
  const idxJuros  = findIdx('Acrescimos', 'ACRESCIMOS', 'Acréscimos', 'Acrescimo', 'ACRESCIMO', 'Juros');

  if (idxTitulo === -1 || idxData === -1 || idxJuros === -1) return [];

  const getField = (fields: string[], idx: number) =>
    idx >= 0 ? (fields[idx] ?? '').trim().replace(/^"|"$/g, '') : '';

  // Agrupador: "notaFiscal|ano|mês" → { dataPagamento, jurosPagos acumulado }
  const map = new Map<string, { dataPagamento: string; jurosPagos: number }>();

  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(sep);
    const nota   = getField(fields, idxTitulo);
    const data   = getField(fields, idxData);
    const jurosRaw = getField(fields, idxJuros);

    if (!nota) continue;

    const periodo = extractDate(data);
    const key = periodo
      ? `${nota}|${periodo.year}|${periodo.month}`
      : `${nota}|sem-data`;

    const juros = parseFloat(jurosRaw.replace(',', '.')) || 0;
    if (map.has(key)) {
      map.get(key)!.jurosPagos += juros;
    } else {
      map.set(key, { dataPagamento: data, jurosPagos: juros });
    }
  }

  return Array.from(map.entries()).map(([key, val]) => {
    const nota = key.split('|')[0];
    return {
      notaFiscal:    nota,
      dataPagamento: val.dataPagamento,
      jurosPagos:    val.jurosPagos.toFixed(2),
    };
  });
}
