import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'peliculas_audi_rows';

export interface PeliculasRow {
  id: string;
  dataRegistro: string;
  dataEncerramento: string;
  numeroOS: string;
  chassi: string;
  codigoCliente: string;
  nomeCliente: string;
  produto: string;
  valorVenda: string;
  impostos: string;
  receitaLiquida: string;   // calculado: valorVenda - impostos
  custoPrestador: string;
  lucroBruto: string;       // calculado: receitaLiquida - custoPrestador
  vendedor: string;
  vendedorAcessorios: string;
  comissaoVendedor: string;
  comissaoVendedorAcessorios: string;
  situacao: string;
}

export function createEmptyPeliculasRow(): PeliculasRow {
  const today = new Date();
  const dataRegistro = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return {
    id: crypto.randomUUID(),
    dataRegistro,
    dataEncerramento: '',
    numeroOS: '',
    chassi: '',
    codigoCliente: '',
    nomeCliente: '',
    produto: '',
    valorVenda: '',
    impostos: '',
    receitaLiquida: '',
    custoPrestador: '',
    lucroBruto: '',
    vendedor: '',
    vendedorAcessorios: '',
    comissaoVendedor: '',
    comissaoVendedorAcessorios: '',
    situacao: '',
  };
}

export function recalcPeliculasRow(row: PeliculasRow, totalAliquotaPct = 0): PeliculasRow {
  const venda = parseFloat(row.valorVenda) || 0;
  row.impostos = row.valorVenda ? String(venda * totalAliquotaPct / 100) : '';
  const imp   = parseFloat(row.impostos)   || 0;
  const rl    = row.valorVenda ? venda - imp : 0;
  row.receitaLiquida = row.valorVenda ? String(rl) : '';
  const custo = parseFloat(row.custoPrestador) || 0;
  row.lucroBruto = row.receitaLiquida ? String(rl - custo) : '';
  return row;
}

export async function loadPeliculasRows(): Promise<PeliculasRow[]> {
  try {
    const data = await kvGet<PeliculasRow[]>(KEY);
    if (data && data.length > 0) return data;
  } catch { /* fallback */ }
  return Array.from({ length: 10 }, createEmptyPeliculasRow);
}

export async function savePeliculasRows(rows: PeliculasRow[]): Promise<boolean> {
  try {
    await kvSet(KEY, rows);
    return true;
  } catch {
    return false;
  }
}
