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
  conta: string; // Conta com valor
  contaPrincipal?: string; // Conta principal (para buscar classificação)
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
  ccusto?: string; // Centro de custo (opcional - só aparece quando não é consolidado)
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

  // Primeiro, verificar se a linha atual já é um dos tipos de hierarquia
  const currentConta = row.conta;
  
  // Se a linha atual é um Tipo (ex: "V - Veículos (Tipo)")
  if (/\(Tipo\)/i.test(currentConta)) {
    const match = currentConta.match(/^([PSV])\s*-/i);
    if (match) {
      result.tipoItem = match[1].toUpperCase() as 'P' | 'S' | 'V';
    }
  }
  
  // Se a linha atual é um CCusto (ex: "101 - VEÍCULOS NOVOS (CCusto)")
  if (/\(CCusto\)/i.test(currentConta)) {
    result.ccusto = currentConta.replace(/\s*\(CCusto\)/i, '').trim();
  }
  
  // Se a linha atual é uma Revenda (ex: "1 - SORANA NORTE (Revenda)")
  if (/\(Revenda\)/i.test(currentConta)) {
    const match = currentConta.match(/^(\d+)\s*-/);
    if (match) {
      result.revenda = match[1];
    }
  }

  // Navegar para cima para encontrar revenda, ccusto e tipo item que ainda não foram encontrados
  // A hierarquia é: conta principal -> revenda -> ccusto -> tipo item -> conta final
  // Vamos encontrar o primeiro pai de cada tipo
  
  for (let i = rowIndex - 1; i >= 0; i--) {
    const parentRow = rows[i];
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
      continue; // Não parar aqui, continuar buscando a conta principal
    }
    
    // Conta Principal (não tem marcador)
    // É a conta mais acima que não tem (Revenda), (CCusto) ou (Tipo)
    if (!result.contaPrincipal && 
        !/(Revenda|CCusto|Tipo)/i.test(conta) &&
        /^\d+/.test(conta)) {
      // Salvar a conta principal completa (ex: "3110101001 - VEÍCULOS NACIONAIS/ IMPORTADOS")
      result.contaPrincipal = conta;
      break; // Encontramos tudo que precisamos
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

  console.log(`[IEO DEBUG] ========== Processando ${marca} / ${depto} / ${year} / S${semestre} ==========`);
  console.log(`[IEO DEBUG] Revendas classificadas:`, Object.keys(revendasMap).length, revendasMap);
  console.log(`[IEO DEBUG] Contas classificadas:`, Object.keys(contasMap).length, Object.keys(contasMap).slice(0, 20));
  console.log(`[IEO DEBUG] Regras de departamento:`, Object.keys(regrasMap).length, regrasMap);
  
  // Inicializar array de logs de adição
  const additionLogs: string[] = [];

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

    console.log(`[IEO DEBUG] Processando semestre. Total de linhas: ${semestreData.rows.length}`);

    // Processar cada linha do arquivo
    for (let i = 0; i < semestreData.rows.length; i++) {
      const row = semestreData.rows[i];
      if (row.isMain) continue; // Pular contas principais

      const hierarchy = extractHierarchy(semestreData.rows, i);
      if (!hierarchy) continue;

      // IMPORTANTE: Processar apenas linhas de "Tipo Item" (P, S, V) para evitar duplicação
      // As linhas de Revenda e CCusto intermediárias contêm os mesmos valores somados
      if (!hierarchy.tipoItem) {
        continue;
      }

      // Filtrar por marca
      if (!hierarchy.revenda || !revendasMap[hierarchy.revenda]) {
        console.log(`[IEO DEBUG] ❌ Revenda não encontrada ou não classificada: ${hierarchy.revenda}`);
        continue;
      }
      if (revendasMap[hierarchy.revenda] !== marca) {
        console.log(`[IEO DEBUG] ❌ Revenda ${hierarchy.revenda} não pertence à marca ${marca} (é ${revendasMap[hierarchy.revenda]})`);
        continue;
      }

      console.log(`[IEO DEBUG] ✓ Revenda OK: ${hierarchy.revenda} → ${marca}`);

      // Filtrar por departamento
      if (!hierarchy.ccusto) {
        console.log(`[IEO DEBUG] ❌ CCusto não encontrado`);
        continue;
      }
      
      // Extrair chave do CCusto (número + hífen, ex: "101 -")
      const ccustoKey = hierarchy.ccusto.match(/^(\d+\s*-)/)?.[1];
      if (!ccustoKey) {
        console.log(`[IEO DEBUG] ❌ Não foi possível extrair chave do CCusto: ${hierarchy.ccusto}`);
        continue;
      }
      
      const regra = regrasMap[ccustoKey];
      if (!regra) {
        console.log(`[IEO DEBUG] ❌ Regra não encontrada para CCusto: ${ccustoKey} (original: ${hierarchy.ccusto})`);
        continue;
      }

      console.log(`[IEO DEBUG] ✓ CCusto OK: ${ccustoKey}, Regra:`, JSON.stringify(regra));

      let deptoClassificado: DeptoClassificacao | undefined;

      // Determinar departamento baseado na regra
      // Verificar se a CONTA CONTÁBIL começa com 3 ou 4 (não o CCusto)
      const contaPrincipalNum = (hierarchy.contaPrincipal || hierarchy.conta).match(/^\d+/)?.[0];
      const isContas3ou4 = contaPrincipalNum && (contaPrincipalNum.startsWith('3') || contaPrincipalNum.startsWith('4'));

      console.log(`[IEO DEBUG] Conta: ${hierarchy.contaPrincipal || hierarchy.conta}, Num: ${contaPrincipalNum}, isContas3ou4: ${isContas3ou4}, TipoItem: ${hierarchy.tipoItem}`);

      if (isContas3ou4 && hierarchy.tipoItem && regra.byTipoItem) {
        deptoClassificado = regra.byTipoItem[hierarchy.tipoItem];
        console.log(`[IEO DEBUG] Usando byTipoItem[${hierarchy.tipoItem}] = ${deptoClassificado}`);
        
        // Se não tem regra específica para este tipo de item, não adicionar em nenhum departamento
        if (!deptoClassificado) {
          console.log(`[IEO DEBUG] ❌ Sem regra específica para TipoItem ${hierarchy.tipoItem}, pulando...`);
          continue;
        }
      } else if (!deptoClassificado) {
        // Apenas usar default se NÃO for contas 3 ou 4
        deptoClassificado = regra.default;
        console.log(`[IEO DEBUG] Usando default = ${deptoClassificado}`);
      }

      console.log(`[IEO DEBUG] Departamento classificado: ${deptoClassificado}, Filtro depto: ${depto}`);

      if (deptoClassificado !== depto && depto !== 'consolidado') {
        console.log(`[IEO DEBUG] ❌ Pulando: ${deptoClassificado} !== ${depto}`);
        continue;
      }
      
      console.log(`[IEO DEBUG] ✅ PASSOU NO FILTRO! Será adicionado.`);

      // Obter classificação da conta
      // Tentar primeiro pela conta de valor, depois pela conta principal
      let tipoClassificacao = contasMap[hierarchy.conta];
      
      if (!tipoClassificacao && hierarchy.contaPrincipal) {
        tipoClassificacao = contasMap[hierarchy.contaPrincipal];
        console.log(`[IEO DEBUG] 🔍 Tentando conta principal: ${hierarchy.contaPrincipal}`);
      }
      
      if (!tipoClassificacao) {
        console.log(`[IEO DEBUG] ❌ Tipo de classificação não encontrado para conta: ${hierarchy.conta}${hierarchy.contaPrincipal ? ` nem para conta principal: ${hierarchy.contaPrincipal}` : ''}`);
        continue;
      }

      console.log(`[IEO DEBUG] ✓ Tipo de classificação OK: ${hierarchy.contaPrincipal || hierarchy.conta} → ${tipoClassificacao}`);

      // Usar a conta principal (ou a conta de valor se não tiver principal)
      const contaParaExibir = hierarchy.contaPrincipal || hierarchy.conta;

      // Adicionar aos grupos
      if (!grupos[tipoClassificacao]) continue;

      // Para consolidado: agrupar por conta, somando valores
      // Para departamentos específicos: agrupar por conta, somando valores do mesmo departamento
      const contaExistente = grupos[tipoClassificacao].contas.find(c => c.conta === contaParaExibir);
      
      console.log(`[IEO DEBUG] 💰 Adicionando valor R$ ${hierarchy.valor.toFixed(2)} à conta ${contaParaExibir} no grupo ${tipoClassificacao}`);
      additionLogs.push(`VALOR: R$ ${hierarchy.valor.toFixed(2)} | CONTA: ${contaParaExibir} | GRUPO: ${tipoClassificacao} | CCUSTO: ${hierarchy.ccusto} | TIPO: ${hierarchy.tipoItem} | DEPTO: ${deptoClassificado}`);
      
      if (contaExistente) {
        console.log(`[IEO DEBUG] 📊 Conta já existe com R$ ${contaExistente.valor.toFixed(2)}, somando...`);
        contaExistente.valor += hierarchy.valor;
        console.log(`[IEO DEBUG] 📊 Novo total da conta: R$ ${contaExistente.valor.toFixed(2)}`);
      } else {
        grupos[tipoClassificacao].contas.push({
          conta: contaParaExibir,
          ccusto: depto === 'consolidado' ? undefined : hierarchy.ccusto,
          valor: hierarchy.valor,
        });
      }
      
      grupos[tipoClassificacao].subtotal += hierarchy.valor;
      
      console.log(`[IEO DEBUG] ✓✓✓ Conta adicionada com sucesso!`);
    }
  }

  // Calcular total
  const total = Object.values(grupos).reduce((sum, grupo) => sum + grupo.subtotal, 0);

  // Salvar logs para debug
  if (additionLogs.length > 0) {
    try {
      localStorage.setItem(`ieo_debug_logs_${marca}_${depto}_${year}`, JSON.stringify(additionLogs));
      console.log(`[IEO DEBUG] 📝 ${additionLogs.length} logs salvos em localStorage`);
    } catch (e) {
      console.error('[IEO DEBUG] Erro ao salvar logs:', e);
    }
  }

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
