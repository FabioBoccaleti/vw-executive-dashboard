import { kvDelete, kvGet, kvSet } from '@/lib/kvClient';

export type ControleVeiculosBrand = 'vw' | 'audi';

export interface ControleVeiculosSheet {
  name: string;
  rows: unknown[][];
}

export interface ControleVeiculosData {
  brand: ControleVeiculosBrand;
  fileName: string;
  importedAt: string;
  sheets: ControleVeiculosSheet[];
}

const keyFor = (brand: ControleVeiculosBrand) =>
  `estoque-usados-controle-veiculos:${brand}`;

export async function getControleVeiculos(brand: ControleVeiculosBrand) {
  return kvGet<ControleVeiculosData>(keyFor(brand));
}

export async function setControleVeiculos(data: ControleVeiculosData) {
  return kvSet(keyFor(data.brand), data);
}

export async function deleteControleVeiculos(brand: ControleVeiculosBrand) {
  return kvDelete(keyFor(brand));
}

// ─── Extração da tabela de veículos (auto-detecta a aba com coluna "Sit") ──────

export interface VehicleTable {
  /** Títulos do cabeçalho na ordem da planilha. */
  headers: string[];
  /** Índice da coluna "Sit" dentro de headers. */
  sitIndex: number;
  /** Linhas de dados (células cruas), alinhadas aos headers. */
  rows: unknown[][];
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim();
}

function isSitHeader(value: unknown): boolean {
  return normalizeHeader(value).toLowerCase().replace(/\.+$/, '') === 'sit';
}

/**
 * Procura, em todas as abas da planilha importada, a primeira linha que contenha
 * uma coluna "Sit". Essa linha é tratada como cabeçalho e as linhas seguintes
 * (não vazias) como dados.
 */
export function extractVehicleTable(data: ControleVeiculosData | null): VehicleTable | null {
  if (!data) return null;
  for (const sheet of data.sheets) {
    const rows = sheet.rows;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      const sitIndex = row.findIndex(cell => isSitHeader(cell));
      if (sitIndex >= 0) {
        const headers = row.map(cell => normalizeHeader(cell));
        const dataRows = rows
          .slice(r + 1)
          .filter(rw => Array.isArray(rw) && rw.some(cell => normalizeHeader(cell) !== ''));
        return { headers, sitIndex, rows: dataRows as unknown[][] };
      }
    }
  }
  return null;
}
