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
  nfPrestador: string;
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
    nfPrestador: '',
    situacao: '',
  };
}

export interface ComissaoContext {
  regras: Array<{ cargo: string; tipoPremio: string; faixas: Array<{ de: string; ate: string; premio: string }> }>;
  vendedores: Array<{ nome: string; cargo: string }>;
}

function parseBRNum(s: string): number {
  if (!s?.trim()) return NaN;
  return parseFloat(s.replace(/\./g, '').replace(',', '.'));
}

function calcComissaoPorCargo(
  cargo: string,
  lucroBruto: number,
  receitaLiquida: number,
  regras: ComissaoContext['regras'],
): string {
  if (!cargo || lucroBruto <= 0) return '0';
  const matched = regras.filter(r => r.cargo === cargo && r.tipoPremio === 'faixas');
  if (!matched.length) return '0';
  const pctLB = receitaLiquida ? (lucroBruto / receitaLiquida) * 100 : 0;
  const regra = matched[0];
  const faixa = regra.faixas.find(f => {
    const de = parseBRNum(f.de);
    const ate = f.ate?.trim() ? parseBRNum(f.ate) : Infinity;
    return !isNaN(de) && pctLB >= de && pctLB <= ate;
  });
  if (!faixa) return '0';
  const pct = parseBRNum(faixa.premio);
  return isNaN(pct) ? '0' : String(lucroBruto * pct / 100);
}

export function recalcPeliculasRow(row: PeliculasRow, totalAliquotaPct = 0, comissaoCtx?: ComissaoContext): PeliculasRow {
  const venda = parseFloat(row.valorVenda) || 0;
  row.impostos = row.valorVenda ? String(venda * totalAliquotaPct / 100) : '';
  const imp   = parseFloat(row.impostos)   || 0;
  const rl    = row.valorVenda ? venda - imp : 0;
  row.receitaLiquida = row.valorVenda ? String(rl) : '';
  const custo = parseFloat(row.custoPrestador) || 0;
  row.lucroBruto = row.receitaLiquida ? String(rl - custo) : '';
  const lb = parseFloat(row.lucroBruto) || 0;
  if (comissaoCtx) {
    const cargoVendedor = comissaoCtx.vendedores.find(v => v.nome === row.vendedor)?.cargo ?? '';
    row.comissaoVendedor = calcComissaoPorCargo(cargoVendedor, lb, rl, comissaoCtx.regras);
    row.comissaoVendedorAcessorios = row.vendedorAcessorios?.trim()
      ? calcComissaoPorCargo('Vendedor de Acessórios', lb, rl, comissaoCtx.regras)
      : '0';
  }
  // Situação automática
  if (!row.dataEncerramento?.trim()) {
    row.situacao = 'Em Andamento';
  } else if (row.nfPrestador?.trim()) {
    row.situacao = 'Processo Finalizado';
  } else {
    row.situacao = 'Encerrada';
  }
  return row;
}

export async function loadPeliculasRows(): Promise<PeliculasRow[]> {
  try {
    const data = await kvGet<PeliculasRow[]>(KEY);
    if (data) return data;
  } catch { /* fallback */ }
  return [];
}

export async function savePeliculasRows(rows: PeliculasRow[]): Promise<boolean> {
  try {
    return await kvSet(KEY, rows);
  } catch {
    return false;
  }
}
