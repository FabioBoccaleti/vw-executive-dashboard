import {
  type BaseGerencialMesData,
  type BaseGerencialRow,
  type Marca,
  type DeptoClassificacao,
  type TipoContaClassificacao,
  type RegraDepto,
  getBaseGerencialMes,
  loadClassificacaoRevendas,
  loadClassificacoesConta,
  loadRegrasDeptos,
  loadContasTipoItem,
} from './baseGerencialStorage';

// ─── Estrutura hierárquica do arquivo importado ──────────────────────────────

interface ContaHierarchy {
  conta: string; // Conta com valor
  contaPrincipal?: string; // Conta principal (para buscar classificação)
  revenda?: string;
  ccusto?: string;
  tipoItem?: 'P' | 'S' | 'V' | 'L';
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
 * Extrai a hierarquia completa de uma conta a partir dos dados do mês
 */
function extractHierarchy(
  rows: BaseGerencialRow[],
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
  
  // Se a linha atual é um Tipo (ex: "V - Veículos (Tipo)", "L - Lubrificantes (Tipo)")
  if (/\(Tipo\)/i.test(currentConta)) {
    const match = currentConta.match(/^([PSVL])\s*-/i);
    if (match) {
      result.tipoItem = match[1].toUpperCase() as 'P' | 'S' | 'V' | 'L';
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

  // Se a linha atual é uma linha intermediária da hierarquia (CCusto ou Revenda),
  // ela NÃO deve buscar tipoItem nos pais, pois representa um total agregado
  // Apenas linhas de Tipo (P, S, V) devem ter tipoItem
  const isLinhaIntermediaria = /\(CCusto\)|(\(Revenda\))/i.test(currentConta);

  // Navegar para cima para encontrar revenda, ccusto e tipo item que ainda não foram encontrados
  // A hierarquia é: conta principal -> revenda -> ccusto -> tipo item -> conta final
  // Vamos encontrar o primeiro pai de cada tipo
  
  for (let i = rowIndex - 1; i >= 0; i--) {
    const parentRow = rows[i];
    const conta = parentRow.conta;
    
    // Tipo Item (Exemplo: "V - Veículos (Tipo)")
    // Não buscar tipoItem se a linha atual for intermediária (CCusto ou Revenda)
    if (!result.tipoItem && !isLinhaIntermediaria && /\(Tipo\)/i.test(conta)) {
      const match = conta.match(/^([PSVL])\s*-/i);
      if (match) {
        result.tipoItem = match[1].toUpperCase() as 'P' | 'S' | 'V' | 'L';
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
        !/\(Revenda\)|\(CCusto\)|\(Tipo\)/i.test(conta) &&
        /^\d+/.test(conta)) {
      // Salvar a conta principal completa (ex: "3110101001 - VEÍCULOS NACIONAIS/ IMPORTADOS")
      result.contaPrincipal = conta;
      break; // Encontramos tudo que precisamos
    }
  }
  
  return result;
}

// ─── Função principal de processamento ──────────────────────────────────────

async function _processDepartamentoDataRaw(
  marca: Marca,
  depto: DeptoClassificacao,
  year: number,
  mes: number, // 0 = ano todo, 1-12 = mês específico
): Promise<DepartamentoData> {
  // Carregar dados necessários
  const [revendasMap, contasMap, regrasMap, contasTipoItemRaw] = await Promise.all([
    loadClassificacaoRevendas(),
    loadClassificacoesConta(),
    loadRegrasDeptos(),
    loadContasTipoItem(),
  ]);

  // null = nunca configurado → usa fallback legado (prefixo 3 ou 4)
  const contasTipoItemNums: Set<string> | null = contasTipoItemRaw !== null
    ? new Set(contasTipoItemRaw.map(c => c.match(/^(\d+)/)?.[1] ?? '').filter(Boolean))
    : null;

  console.log(`[BASEGE DEBUG] ========== Processando ${marca} / ${depto} / ${year} / M${String(mes).padStart(2, '0')} ==========`);
  console.log(`[BASEGE DEBUG] Revendas classificadas:`, Object.keys(revendasMap).length, revendasMap);
  console.log(`[BASEGE DEBUG] Contas classificadas:`, Object.keys(contasMap).length, Object.keys(contasMap).slice(0, 20));
  console.log(`[BASEGE DEBUG] Regras de departamento:`, Object.keys(regrasMap).length, regrasMap);
  
  // Inicializar array de logs de adição
  const additionLogs: string[] = [];

  // Determinar quais meses carregar
  const meses: number[] = mes === 0 ? Array.from({ length: 12 }, (_, i) => i + 1) : [mes];
  
  // Carregar dados dos meses
  const mesDataList = await Promise.all(
    meses.map(m => getBaseGerencialMes(year, m))
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

  // Maps para computação de gap (itens sem Tipo no arquivo-fonte)
  const ccustoGapMap = new Map<string, { valor: number; ccustoKey: string; contaPrincipal: string; revenda: string }>();
  const tipoSumMap = new Map<string, number>();
  const _gapKey = (rev: string, cc: string, cp: string) => `${rev}|${cc}|${cp}`;

  // Processar cada mês
  for (const mesData of mesDataList) {
    if (!mesData) continue;

    console.log(`[BASEGE DEBUG] Processando mês. Total de linhas: ${mesData.rows.length}`);

    // Pre-pass: coleta totais de CCusto e somas de Tipo para gap computation
    for (let i = 0; i < mesData.rows.length; i++) {
      const pr = mesData.rows[i];
      if (pr.isMain) continue;
      const ph = extractHierarchy(mesData.rows, i);
      if (!ph || !ph.revenda || !ph.contaPrincipal) continue;
      if (!revendasMap[ph.revenda] || revendasMap[ph.revenda] !== marca) continue;
      const pcNum = (ph.contaPrincipal || ph.conta).match(/^\d+/)?.[0];
      if (!pcNum) continue;
      const pUsaTipo = contasTipoItemNums !== null ? contasTipoItemNums.has(pcNum) : (pcNum.startsWith('3') || pcNum.startsWith('4'));
      if (!pUsaTipo) continue;
      if (/\(CCusto\)/i.test(ph.conta) && ph.ccusto) {
        const ccKey = ph.ccusto.match(/^(\d+\s*-)/)?.[1];
        if (!ccKey || !regrasMap[ccKey]?.default) continue;
        const k = _gapKey(ph.revenda, ph.ccusto, ph.contaPrincipal);
        const ex = ccustoGapMap.get(k);
        if (ex) ex.valor += ph.valor;
        else ccustoGapMap.set(k, { valor: ph.valor, ccustoKey: ccKey, contaPrincipal: ph.contaPrincipal, revenda: ph.revenda });
      } else if (ph.tipoItem && /\(Tipo\)/i.test(ph.conta) && ph.ccusto) {
        // Coletar apenas a linha (Tipo) em si, não sub-linhas que herdam tipoItem
        const k = _gapKey(ph.revenda, ph.ccusto, ph.contaPrincipal);
        tipoSumMap.set(k, (tipoSumMap.get(k) ?? 0) + ph.valor);
      }
    }

    // Processar cada linha do arquivo
    for (let i = 0; i < mesData.rows.length; i++) {
      const row = mesData.rows[i];
      if (row.isMain) continue; // Pular contas principais

      const hierarchy = extractHierarchy(mesData.rows, i);
      if (!hierarchy) continue;

      // Determinar se esta conta usa a regra de Tipo Item
      const contaPrincipalNum = (hierarchy.contaPrincipal || hierarchy.conta).match(/^\d+/)?.[0];
      const usaTipoItem = contasTipoItemNums !== null
        ? (contaPrincipalNum != null && contasTipoItemNums.has(contaPrincipalNum))
        : (contaPrincipalNum != null && (contaPrincipalNum.startsWith('3') || contaPrincipalNum.startsWith('4')));

      // Contas com TipoItem: processa linhas de TipoItem E linhas sem tipo (usa default do CCusto)
      // Demais contas: processar apenas linhas de CCusto
      if (usaTipoItem) {
        // Ignorar linhas-cabeçalho de agregação (CCusto e Revenda são subtotais)
        if (/\(CCusto\)|\(Revenda\)/i.test(hierarchy.conta)) continue;
        // Sub-linhas sob (Tipo) já estão somadas na linha (Tipo) — pular para evitar dupla contagem
        if (hierarchy.tipoItem && !/\(Tipo\)/i.test(hierarchy.conta)) continue;
        // Exige ao menos CCusto para ter contexto de classificação
        if (!hierarchy.ccusto) continue;
      } else {
        // Linhas (Revenda) são subtotais — pular para evitar que encontrem CCusto de outra revenda anterior
        if (/\(Revenda\)/i.test(hierarchy.conta)) continue;
        if (!hierarchy.ccusto || hierarchy.tipoItem) continue;
      }

      // Filtrar por marca
      if (!hierarchy.revenda || !revendasMap[hierarchy.revenda]) {
        console.log(`[BASEGE DEBUG] ❌ Revenda não encontrada ou não classificada: ${hierarchy.revenda}`);
        continue;
      }
      if (revendasMap[hierarchy.revenda] !== marca) {
        console.log(`[BASEGE DEBUG] ❌ Revenda ${hierarchy.revenda} não pertence à marca ${marca} (é ${revendasMap[hierarchy.revenda]})`);
        continue;
      }

      console.log(`[BASEGE DEBUG] ✓ Revenda OK: ${hierarchy.revenda} → ${marca}`);

      // Filtrar por departamento
      if (!hierarchy.ccusto) {
        console.log(`[BASEGE DEBUG] ❌ CCusto não encontrado`);
        continue;
      }
      
      // Extrair chave do CCusto (número + hífen, ex: "101 -")
      const ccustoKey = hierarchy.ccusto.match(/^(\d+\s*-)/)?.[1];
      if (!ccustoKey) {
        console.log(`[BASEGE DEBUG] ❌ Não foi possível extrair chave do CCusto: ${hierarchy.ccusto}`);
        continue;
      }
      
      const regra = regrasMap[ccustoKey];
      if (!regra) {
        console.log(`[BASEGE DEBUG] ❌ Regra não encontrada para CCusto: ${ccustoKey} (original: ${hierarchy.ccusto})`);
        continue;
      }

      console.log(`[BASEGE DEBUG] ✓ CCusto OK: ${ccustoKey}, Regra:`, JSON.stringify(regra));

      let deptoClassificado: DeptoClassificacao | undefined;

      console.log(`[BASEGE DEBUG] Conta: ${hierarchy.contaPrincipal || hierarchy.conta}, Num: ${contaPrincipalNum}, usaTipoItem: ${usaTipoItem}, TipoItem: ${hierarchy.tipoItem}`);

      // Tipo L sempre usa CCusto (default); P/S/V usam byTipoItem
      if (usaTipoItem && hierarchy.tipoItem && hierarchy.tipoItem !== 'L' && regra.byTipoItem) {
        deptoClassificado = regra.byTipoItem[hierarchy.tipoItem];
        console.log(`[BASEGE DEBUG] Usando byTipoItem[${hierarchy.tipoItem}] = ${deptoClassificado}`);
        
        if (!deptoClassificado) {
          console.log(`[BASEGE DEBUG] ❌ Sem regra específica para TipoItem ${hierarchy.tipoItem}, pulando...`);
          continue;
        }
      } else if (!deptoClassificado) {
        deptoClassificado = regra.default;
        console.log(`[BASEGE DEBUG] Usando default = ${deptoClassificado}`);
      }

      console.log(`[BASEGE DEBUG] Departamento classificado: ${deptoClassificado}, Filtro depto: ${depto}`);

      if (deptoClassificado !== depto && depto !== 'consolidado') {
        console.log(`[BASEGE DEBUG] ❌ Pulando: ${deptoClassificado} !== ${depto}`);
        continue;
      }
      
      console.log(`[BASEGE DEBUG] ✅ PASSOU NO FILTRO! Será adicionado.`);

      // Obter classificação da conta
      // Tentar primeiro pela conta de valor, depois pela conta principal
      let tipoClassificacao = contasMap[hierarchy.conta];
      
      if (!tipoClassificacao && hierarchy.contaPrincipal) {
        tipoClassificacao = contasMap[hierarchy.contaPrincipal];
        console.log(`[BASEGE DEBUG] 🔍 Tentando conta principal: ${hierarchy.contaPrincipal}`);
      }
      
      if (!tipoClassificacao) {
        console.log(`[BASEGE DEBUG] ❌ Tipo de classificação não encontrado para conta: ${hierarchy.conta}${hierarchy.contaPrincipal ? ` nem para conta principal: ${hierarchy.contaPrincipal}` : ''}`);
        continue;
      }

      console.log(`[BASEGE DEBUG] ✓ Tipo de classificação OK: ${hierarchy.contaPrincipal || hierarchy.conta} → ${tipoClassificacao}`);

      // Usar a conta principal (ou a conta de valor se não tiver principal)
      const contaParaExibir = hierarchy.contaPrincipal || hierarchy.conta;

      // Adicionar aos grupos
      if (!grupos[tipoClassificacao]) continue;

      // Para consolidado: agrupar por conta, somando valores
      // Para departamentos específicos: agrupar por conta, somando valores do mesmo departamento
      const contaExistente = grupos[tipoClassificacao].contas.find(c => c.conta === contaParaExibir);
      
      console.log(`[BASEGE DEBUG] 💰 Adicionando valor R$ ${hierarchy.valor.toFixed(2)} à conta ${contaParaExibir} no grupo ${tipoClassificacao}`);
      additionLogs.push(`LINHA: ${i} | VALOR: R$ ${hierarchy.valor.toFixed(2)} | CONTA: ${contaParaExibir} | CONTA_RAW: ${row.conta} | REVENDA: ${hierarchy.revenda} | GRUPO: ${tipoClassificacao} | CCUSTO: ${hierarchy.ccusto} | TIPO: ${hierarchy.tipoItem} | DEPTO: ${deptoClassificado}`);
      
      if (contaExistente) {
        console.log(`[BASEGE DEBUG] 📊 Conta já existe com R$ ${contaExistente.valor.toFixed(2)}, somando...`);
        contaExistente.valor += hierarchy.valor;
        console.log(`[BASEGE DEBUG] 📊 Novo total da conta: R$ ${contaExistente.valor.toFixed(2)}`);
      } else {
        grupos[tipoClassificacao].contas.push({
          conta: contaParaExibir,
          ccusto: depto === 'consolidado' ? undefined : hierarchy.ccusto,
          valor: hierarchy.valor,
        });
      }
      
      grupos[tipoClassificacao].subtotal += hierarchy.valor;
      
      console.log(`[BASEGE DEBUG] ✓✓✓ Conta adicionada com sucesso!`);
    }
  }

  // Post-pass: adiciona gap (itens sem Tipo no arquivo) classificado pelo default do CCusto
  for (const [k, info] of ccustoGapMap.entries()) {
    const gap = info.valor - (tipoSumMap.get(k) ?? 0);
    if (Math.abs(gap) < 0.01) continue;
    const gapRegra = regrasMap[info.ccustoKey];
    const gapDepto = gapRegra?.default;
    if (!gapDepto) continue;
    if (gapDepto !== depto && depto !== 'consolidado') continue;
    const gapTipo = contasMap[info.contaPrincipal];
    if (!gapTipo || !grupos[gapTipo]) continue;
    const gapContaExistente = grupos[gapTipo].contas.find(c => c.conta === info.contaPrincipal);
    if (gapContaExistente) {
      gapContaExistente.valor += gap;
    } else {
      grupos[gapTipo].contas.push({ conta: info.contaPrincipal, valor: gap });
    }
    grupos[gapTipo].subtotal += gap;
    additionLogs.push(`GAP: ${info.ccustoKey} | R$ ${gap.toFixed(2)} | CONTA: ${info.contaPrincipal} | DEPTO: ${gapDepto}`);
  }

  // Calcular total
  const total = Object.values(grupos).reduce((sum, grupo) => sum + grupo.subtotal, 0);

  // Salvar logs para debug
  if (additionLogs.length > 0) {
    try {
      localStorage.setItem(`basege_debug_logs_${marca}_${depto}_${year}`, JSON.stringify(additionLogs));
      console.log(`[BASEGE DEBUG] 📝 ${additionLogs.length} logs salvos em localStorage`);
    } catch (e) {
      console.error('[BASEGE DEBUG] Erro ao salvar logs:', e);
    }
  }

  return { grupos, total };
}

function _emptyDepartamentoData(): DepartamentoData {
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
  return { grupos, total: 0 };
}

// Audi: soma Venda Direta em Veículos Novos — mesma conta soma, conta única é adicionada
function _mergeDepartamentoData(a: DepartamentoData, b: DepartamentoData): DepartamentoData {
  const tipos = Object.keys(a.grupos) as TipoContaClassificacao[];
  const grupos = {} as Record<TipoContaClassificacao, GrupoData>;
  for (const tipo of tipos) {
    const contaMap = new Map<string, ContaDetail>();
    for (const c of a.grupos[tipo].contas) contaMap.set(c.conta, { ...c });
    for (const c of b.grupos[tipo].contas) {
      const existing = contaMap.get(c.conta);
      if (existing) {
        contaMap.set(c.conta, { conta: existing.conta, valor: existing.valor + c.valor });
      } else {
        contaMap.set(c.conta, { ...c });
      }
    }
    const contas = Array.from(contaMap.values());
    grupos[tipo] = { contas, subtotal: contas.reduce((s, c) => s + c.valor, 0) };
  }
  return { grupos, total: Object.values(grupos).reduce((s, g) => s + g.subtotal, 0) };
}

export async function processDepartamentoData(
  marca: Marca,
  depto: DeptoClassificacao,
  year: number,
  mes: number,
): Promise<DepartamentoData> {
  if (marca === 'audi' && depto === 'venda_direta') return _emptyDepartamentoData();
  if (marca === 'audi' && depto === 'veiculos_novos') {
    const [novos, vd] = await Promise.all([
      _processDepartamentoDataRaw('audi', 'veiculos_novos', year, mes),
      _processDepartamentoDataRaw('audi', 'venda_direta', year, mes),
    ]);
    return _mergeDepartamentoData(novos, vd);
  }
  return _processDepartamentoDataRaw(marca, depto, year, mes);
}

// ─── Processar consolidado (soma de todos os departamentos) ─────────────────

export async function processConsolidadoData(
  marca: Marca,
  year: number,
  mes: number,
): Promise<DepartamentoData> {
  const departamentos: DeptoClassificacao[] = [
    'veiculos_novos', 'venda_direta', 'veiculos_usados', 'pecas',
    'oficina', 'funilaria', 'administracao', 'diretoria',
  ];

  // Processar cada departamento
  const deptoDataList = await Promise.all(
    departamentos.map(d => processDepartamentoData(marca, d, year, mes))
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
      grupos[tipoKey].subtotal += grupoData.subtotal;

      for (const conta of grupoData.contas) {
        const contaExistente = grupos[tipoKey].contas.find(item => item.conta === conta.conta);
        if (contaExistente) {
          contaExistente.valor += conta.valor;
        } else {
          grupos[tipoKey].contas.push({ ...conta, ccusto: undefined });
        }
      }
    }
  }

  const total = Object.values(grupos).reduce((sum, grupo) => sum + grupo.subtotal, 0);

  return { grupos, total };
}
