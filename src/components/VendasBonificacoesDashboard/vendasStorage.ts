import { kvGet, kvSet } from '@/lib/kvClient';
import { loadCatalogo, type CatalogoVeiculos } from './catalogoStorage';

const KEY = 'vendas_bonificacoes_rows';

export interface VendasRow {
  id: string;
  veiculo: string;
  chassi: string;
  revenda: string;
  blindadora: string;
  custoBlindagem: string;
  dataPagamentoBlindadora: string;
  situacaoNegociacaoBlindadora: string;
  dataVenda: string;
  valorVendaBlindagem: string;
  lucroOperacao: string;
  localPgtoBlindagem: string;
  nomeVendedor: string;
  remuneracaoVendedor: string;
  remuneracaoGerencia: string;
  remuneracaoDiretoria: string;
  remuneracaoGerenciaSupervisorUsados: string;
  comissaoBrutaSorana: string;
  numeroNFComissao: string;
  situacaoComissao: string;
  valorAPagarBlindadora: string;
  valorAReceberBlindadora: string;
  dataAcerto: string;
}

export function createEmptyRow(): VendasRow {
  return {
    id: crypto.randomUUID(),
    veiculo: '',
    chassi: '',
    revenda: '',
    blindadora: '',
    custoBlindagem: '',
    dataPagamentoBlindadora: '',
    situacaoNegociacaoBlindadora: 'Negociação Direta',
    dataVenda: '',
    valorVendaBlindagem: '',
    lucroOperacao: '',
    localPgtoBlindagem: '',
    nomeVendedor: '',
    remuneracaoVendedor: '',
    remuneracaoGerencia: '',
    remuneracaoDiretoria: '',
    remuneracaoGerenciaSupervisorUsados: '',
    comissaoBrutaSorana: '',
    numeroNFComissao: '',
    situacaoComissao: '',
    valorAPagarBlindadora: '',
    valorAReceberBlindadora: '',
    dataAcerto: '',
  };
}

function normalizeRows(rows: VendasRow[]): { rows: VendasRow[]; changed: boolean } {
  const nameMap: Record<string, string> = {
    'Guska': 'Rodrigo Guska',
    'Bola': 'Luiz Arlindo Rodrigues de Oliveira',
    'Orlando': 'Orlando Chodin Neto',
    'Rodrigo': 'Rodrigo de Araujo Andrade',
    'Adilson': 'Adilson Bezerra Dos Santos',
    'Aide': 'Aide Silva',
    'Alex': 'Alex Sander da Costa Malachim',
    'Geminiani': 'Alexandre Geminiani',
    'Latorre': 'Alexandre Pires Latorre',
    'Aline': 'Alexandre Pires Latorre',
    'Cesar': 'Cesar Luiz Garcia Lourenco',
    'Willian': 'Doarci William Tostes',
    'William': 'Doarci William Tostes',
    'Francisco': 'Francisco Nilton Carlos Soares',
    'Chico': 'Francisco Nilton Carlos Soares',
    'Julio': 'Julio Roberto Crepaldi',
    'Camargo': 'Camargo Leandro Andrade',
    'Leandro': 'Leandro Pereira dos Santos',
    'Capeli': 'Luciano Capeli',
    'Meire': 'Lucimeire da Conceição Santos',
    'Lucimeire': 'Lucimeire da Conceição Santos',
    'Luiz Bola': 'Luiz Arlindo Rodrigues de Oliveira',
    'Noemi': 'Noemi Freitas Lemes',
    'Paulo': 'Paulo Sergio Alves de Oliveira',
    'Roberto': 'Roberto Carlos',
    'Rose': 'Rosemeire Aparecida Campos',
    'Silas': 'Silas Rodrigo Alves dos Santos',
    'Ana Paula': 'Ana Paula Zinato de Novaes',
    'Mirtes': 'Mirtes Cristina Vieira de Moraes',
    'Adriana': 'Adriana Pedrosa Mercatelli de Oliveira',
    'Claudia': 'Claudia Regina de Andrade',
    'Daniel': 'Daniel Pacitti Rizzatto',
    'Gabriele': 'Gabriele Melaine da Conceicao Casone',
    'Ricardo': 'Ricardo de Oliveira Silva',
    'Wanderley': 'Wanderley dos Santos Paizinho',
    'Wanderlei': 'Wanderley dos Santos Paizinho',
    'Ivone': 'Ivone Boscolo',
    'Lucas': 'Lucas de Gaspari Ribeiro Caldas',
    'Gabi': 'Gabriela Sao Mateus',
    'Gabriela': 'Gabriela Sao Mateus',
    'Wellington': 'Wellington Reboucas',
    'Well': 'Wellington Reboucas',
    'Wellingtom': 'Wellington Reboucas',
    'Mariana': 'Mariana Francine Baiadori',
    'mariana': 'Danilo Guimaraes de Brito',
    'Henrique': 'Henrique Souza Sena',
    'Wagner': 'Wagner Jose Amaral Ferrer',
    'Casagrande': 'Carlos Eduardo Casagrande Silva',
    'Carlos Casagrande': 'Carlos Eduardo Casagrande Silva',
    'Luciano': 'Luciano Capeli',
    'Carlos': 'Carlos José Bargieri',
    'Rosemeire': 'Rosemeire Aparecida Campos',
  };
  let changed = false;
  const normalized = rows.map(row => {
    const corrected = nameMap[row.nomeVendedor];
    if (corrected) {
      changed = true;
      return { ...row, nomeVendedor: corrected };
    }
    return row;
  });
  return { rows: normalized, changed };
}

function normalizeVeiculos(
  rows: VendasRow[],
  catalogo: CatalogoVeiculos
): { rows: VendasRow[]; changed: boolean } {
  // Nomes de todas as marcas conhecidas (para detectar se já tem marca)
  const allBrandNames = catalogo.marcas.map(m => m.nome.toLowerCase());

  // Apenas marcas VW
  const vwBrands = catalogo.marcas.filter(m =>
    m.nome.toLowerCase() === 'vw' || m.nome.toLowerCase() === 'volkswagen'
  );
  const vwBrandIds = new Set(vwBrands.map(m => m.id));

  // Modelos VW ordenados do mais longo para o mais curto (casa nomes compostos primeiro)
  const vwModelos = catalogo.modelos
    .filter(m => vwBrandIds.has(m.marcaId))
    .sort((a, b) => b.modelo.length - a.modelo.length);

  if (vwModelos.length === 0) return { rows, changed: false };

  let changed = false;
  const normalized = rows.map(row => {
    const v = row.veiculo.trim();
    if (!v) return row;

    // Já começa com uma marca conhecida → não mexe
    const vLower = v.toLowerCase();
    const hasBrand = allBrandNames.some(b => vLower === b || vLower.startsWith(b + ' '));
    if (hasBrand) return row;

    // Tenta casar com algum modelo VW (case-insensitive)
    const match = vwModelos.find(m => {
      const mLower = m.modelo.toLowerCase();
      return vLower === mLower || vLower.startsWith(mLower + ' ') || vLower.startsWith(mLower);
    });

    if (match) {
      changed = true;
      return { ...row, veiculo: `VW ${match.modelo}` };
    }

    return row;
  });

  return { rows: normalized, changed };
}

export async function loadVendasRows(): Promise<VendasRow[]> {
  try {
    const [data, catalogo] = await Promise.all([
      kvGet<VendasRow[]>(KEY),
      loadCatalogo(),
    ]);
    if (data && data.length > 0) {
      const { rows: r1, changed: c1 } = normalizeRows(data);
      const { rows: r2, changed: c2 } = normalizeVeiculos(r1, catalogo);
      if (c1 || c2) await kvSet(KEY, r2);
      return r2;
    }
  } catch { /* fallback */ }
  return Array.from({ length: 10 }, createEmptyRow);
}

export async function saveVendasRows(rows: VendasRow[]): Promise<boolean> {
  return kvSet(KEY, rows);
}
