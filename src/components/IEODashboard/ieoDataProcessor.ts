import {
  type IEOSemestreData,
  type IEORow,
  type Marca,
  type DeptoClassificacao,
  type TipoContaClassificacao,
  type RegraDepto,
  getIEOSemestre,
  loadClassificacaoRevendas,
  loadClassificacoesConta,
  loadRegrasDeptos,
} from './ieoStorage';

// ─── Estrutura hierárquica do arquivo importado ──────────────────────────────

interface ContaHierarchy {
  conta: string;
  revenda?: string;
  ccusto?: string;
  tipoItem?: 'P' | 'S' | 'V';
  valor: number; // Crédito - Débito
}

// ─── Resultado processado por departamento ───────────────────────────────────

export interface DepartamentoData {
  grupos: Record<TipoContaClassificacao, GrupoData>;
  total: number;
}

export interface GrupoData {
  contas: ContaDetail[];
  subtotal: number;
}

export interface ContaDetail {
  conta: string;
  valor: number;
}

// ─── Funções de extração da hierarquia ──────────────────────────────────────

/**
 * Extrai a hierarquia completa de uma conta a partir dos dados do semestre
 */
function extractHierarchy(
  rows: IEORow[],
  rowIndex: number,
): ContaHierarchy | null {
  const row = rows[rowIndex];
  if (row.isMain) return null; // Só processamos sub-contas
  
  const valor = row.valCredito - row.valDebito;
  const result: ContaHierarchy = {
    conta: row.conta,
    valor,
  };

  // Navegar para cima para encontrar revenda, ccusto e tipo item
  // A hierarquia é: conta principal -> revenda -> ccusto -> tipo item -> conta final
  // Vamos encontrar o primeiro pai de cada tipo
  
  for (let i = rowIndex - 1; i >= 0; i--) {
    const parentRow = rows[i];
    if (!parentRow.isMain) continue;
    
    const conta = parentRow.conta;
    
    // Tipo Item (Exemplo: "V - Veículos (Tipo)")
    if (!result.tipoItem && /\(Tipo\)/i.test(conta)) {
      const match = conta.match(/^([PSV])\s*-/i);
      if (match) {
        result.tipoItem = match[1].toUpperCase() as 'P' | 'S' | 'V';
      }
      continue;
    }
    
    // CCusto (Exemplo: "101 - VEÍCULOS NOVOS (CCusto)")
    if (!result.ccusto && /\(CCusto\)/i.test(conta)) {
      result.ccusto = conta.replace(/\s*\(CCusto\)/i, '').trim();
      continue;
    }
    
    // Revenda (Exemplo: "1 - SORANA NORTE (Revenda)")
    if (!result.revenda && /\(Revenda\)/i.test(conta)) {
      const match = conta.match(/^(\d+)\s*-/);
      if (match) {
        result.revenda = match[1];
      }
      // Se já encontramos a revenda, podemos parar
      break;
    }
  }
  
  return result;
}

// ─── Função principal de processamento ──────────────────────────────────────

export async function processDepartamentoData(
  marca: Marca,
  depto: DeptoClassificacao,
  year: number,
  semestre: number, // 0 = ano todo, 1 = S1, 2 = S2
): Promise<DepartamentoData> {
  // Carregar dados necessários
  const [revendasMap, contasMap, regrasMap] = await Promise.all([
    loadClassificacaoRevendas(),
    loadClassificacoesConta(),
    loadRegrasDeptos(),
  ]);

  // Determinar quais semestres carregar
  const semestres: number[] = semestre === 0 ? [1, 2] : [semestre];
  
  // Carregar dados dos semestres
  const semestreDataList = await Promise.all(
    semestres.map(s => getIEOSemestre(year, s))
  );

  // Inicializar estrutura de resultado
  const grupos: Record<TipoContaClassificacao, GrupoData> = {
    receita_vendas: { contas: [], subtotal: 0 },
    receitas_operacionais: { contas: [], subtotal: 0 },
    receitas_financeiras: { contas: [], subtotal: 0 },
    receitas_nao_operacionais: { contas: [], subtotal: 0 },
    custos_operacionais: { contas: [], subtotal: 0 },
    despesas_pessoal: { contas: [], subtotal: 0 },
    despesas_servicos_terceiros: { contas: [], subtotal: 0 },
    despesas_ocupacao: { contas: [], subtotal: 0 },
    despesas_funcionamento: { contas: [], subtotal: 0 },
    despesas_vendas: { contas: [], subtotal: 0 },
    amortizacoes_depreciacoes: { contas: [], subtotal: 0 },
    despesas_financeiras: { contas: [], subtotal: 0 },
    outras_despesas_operacionais: { contas: [], subtotal: 0 },
  };

  // Processar cada semestre
  for (const semestreData of semestreDataList) {
    if (!semestreData) continue;

    // Processar cada linha do arquivo
    for (let i = 0; i < semestreData.rows.length; i++) {
      const row = semestreData.rows[i];
      if (row.isMain) continue; // Pular contas principais

      const hierarchy = extractHierarchy(semestreData.rows, i);
      if (!hierarchy) continue;

      // Filtrar por marca
      if (!hierarchy.revenda || !revendasMap[hierarchy.revenda]) continue;
      if (revendasMap[hierarchy.revenda] !== marca) continue;

      // Filtrar por departamento
      if (!hierarchy.ccusto) continue;
      const regra = regrasMap[hierarchy.ccusto];
      if (!regra) continue;

      let deptoClassificado: DeptoClassificacao | undefined;

      // Determinar departamento baseado na regra
      const ccustoNum = hierarchy.ccusto.match(/^\d+/)?.[0];
      const isContas3ou4 = ccustoNum && (ccustoNum.startsWith('3') || ccustoNum.startsWith('4'));

      if (isContas3ou4 && hierarchy.tipoItem && regra.byTipoItem) {
        deptoClassificado = regra.byTipoItem[hierarchy.tipoItem];
      }
      
      if (!deptoClassificado) {
        deptoClassificado = regra.default;
      }

      if (deptoClassificado !== depto && depto !== 'consolidado') continue;

      // Obter classificação da conta
      const tipoClassificacao = contasMap[hierarchy.conta];
      if (!tipoClassificacao) continue;

      // Adicionar aos grupos
      if (!grupos[tipoClassificacao]) continue;

      grupos[tipoClassificacao].contas.push({
        conta: hierarchy.conta,
        valor: hierarchy.valor,
      });
      grupos[tipoClassificacao].subtotal += hierarchy.valor;
    }
  }

  // Calcular total
  const total = Object.values(grupos).reduce((sum, grupo) => sum + grupo.subtotal, 0);

  return { grupos, total };
}

// ─── Processar consolidado (soma de todos os departamentos) ─────────────────

export async function processConsolidadoData(
  marca: Marca,
  year: number,
  semestre: number,
): Promise<DepartamentoData> {
  const departamentos: DeptoClassificacao[] = [
    'veiculos_novos', 'venda_direta', 'veiculos_usados', 'pecas',
    'oficina', 'funilaria', 'administracao', 'diretoria',
  ];

  // Processar cada departamento
  const deptoDataList = await Promise.all(
    departamentos.map(d => processDepartamentoData(marca, d, year, semestre))
  );

  // Consolidar resultados
  const grupos: Record<TipoContaClassificacao, GrupoData> = {
    receita_vendas: { contas: [], subtotal: 0 },
    receitas_operacionais: { contas: [], subtotal: 0 },
    receitas_financeiras: { contas: [], subtotal: 0 },
    receitas_nao_operacionais: { contas: [], subtotal: 0 },
    custos_operacionais: { contas: [], subtotal: 0 },
    despesas_pessoal: { contas: [], subtotal: 0 },
    despesas_servicos_terceiros: { contas: [], subtotal: 0 },
    despesas_ocupacao: { contas: [], subtotal: 0 },
    despesas_funcionamento: { contas: [], subtotal: 0 },
    despesas_vendas: { contas: [], subtotal: 0 },
    amortizacoes_depreciacoes: { contas: [], subtotal: 0 },
    despesas_financeiras: { contas: [], subtotal: 0 },
    outras_despesas_operacionais: { contas: [], subtotal: 0 },
  };

  for (const deptoData of deptoDataList) {
    for (const [tipo, grupoData] of Object.entries(deptoData.grupos)) {
      const tipoKey = tipo as TipoContaClassificacao;
      grupos[tipoKey].contas.push(...grupoData.contas);
      grupos[tipoKey].subtotal += grupoData.subtotal;
    }
  }

  const total = Object.values(grupos).reduce((sum, grupo) => sum + grupo.subtotal, 0);

  return { grupos, total };
}
