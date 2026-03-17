// ─── PARSER DE BALANCETE ─────────────────────────────────────────────────────
// Extraído de index.tsx para ser reutilizado em ComparativosTab e outros componentes

/** Analisa um dicionário de contas já extraído e retorna o objeto estruturado */
export function analyzeAccounts(accounts: Record<string, any>) {
  const get = (id: string) => accounts[id] || { saldoAnt: 0, saldoAtual: 0, valDeb: 0, valCred: 0, desc: '' };
  const absAnt = (id: string) => Math.abs(get(id).saldoAnt);
  const absAtu = (id: string) => Math.abs(get(id).saldoAtual);

  // ATIVO
  const ativoTotal = { ant: absAnt('1'), atu: absAtu('1') };
  const ativoCirc = { ant: absAnt('1.1'), atu: absAtu('1.1') };
  const disponib = { ant: absAnt('1.1.1'), atu: absAtu('1.1.1') };
  const caixaGeral = { ant: absAnt('1.1.1.01'), atu: absAtu('1.1.1.01') };
  const bancos = { ant: absAnt('1.1.1.02'), atu: absAtu('1.1.1.02') };
  const aplicLiq = { ant: absAnt('1.1.1.03'), atu: absAtu('1.1.1.03') };
  const holdBack = { ant: absAnt('1.1.1.04'), atu: absAtu('1.1.1.04') };
  const estoques = { ant: absAnt('1.1.2'), atu: absAtu('1.1.2') };
  const estVeicNovos = { ant: absAnt('1.1.2.01'), atu: absAtu('1.1.2.01') };
  const estVeicUsados = { ant: absAnt('1.1.2.02'), atu: absAtu('1.1.2.02') };
  const estPecas = { ant: absAnt('1.1.2.03'), atu: absAtu('1.1.2.03') };
  // Estoques Audi (grupo 1.1.7) — atividade separada da VW
  const estAudi          = { ant: absAnt('1.1.7.02'),    atu: absAtu('1.1.7.02') };
  const estAudiVeicNovos = { ant: absAnt('1.1.7.02.01'), atu: absAtu('1.1.7.02.01') };
  const estAudiVeicUsados = { ant: absAnt('1.1.7.02.02'), atu: absAtu('1.1.7.02.02') };
  const estAudiPecas     = { ant: absAnt('1.1.7.02.03'), atu: absAtu('1.1.7.02.03') };
  const outrasAtivAudi   = { ant: absAnt('1.1.7'),       atu: absAtu('1.1.7') };
  const creditos = { ant: absAnt('1.1.3'), atu: absAtu('1.1.3') };
  const contasCorr = { ant: absAnt('1.1.4'), atu: absAtu('1.1.4') };
  const valDiversos = { ant: absAnt('1.1.5'), atu: absAtu('1.1.5') };
  // Despesas antecipadas / exercício seguinte (1.1.6)
  const despAntec     = { ant: absAnt('1.1.6'),    atu: absAtu('1.1.6') };
  const despAntecEnc  = { ant: absAnt('1.1.6.01'), atu: absAtu('1.1.6.01') };
  const despAntecGast = { ant: absAnt('1.1.6.02'), atu: absAtu('1.1.6.02') };
  const ativoNaoCirc = { ant: absAnt('1.5'), atu: absAtu('1.5') };
  const realizLP     = { ant: absAnt('1.5.1'),       atu: absAtu('1.5.1') };
  const realizLPCred = { ant: absAnt('1.5.1.01.52'), atu: absAtu('1.5.1.01.52') }; // créditos com ligadas LP
  const investimentos = { ant: absAnt('1.5.3'),       atu: absAtu('1.5.3') };
  const imobiliz      = { ant: absAnt('1.5.5'),       atu: absAtu('1.5.5') };
  const intangivel    = { ant: absAnt('1.5.7'),       atu: absAtu('1.5.7') };

  // PASSIVO CIRCULANTE
  const passCirc = { ant: absAnt('2.1'), atu: absAtu('2.1') };
  const emprestCP = { ant: absAnt('2.1.1'), atu: absAtu('2.1.1') };
  // 2.1.1 dividido: 01 = Fornecedores (operacional) · 02 = Financiamentos CP (financiamento)
  const emprestCP_01 = { ant: absAnt('2.1.1.01'), atu: absAtu('2.1.1.01') }; // Fornecedores → operacional
  const emprestCP_02 = { ant: absAnt('2.1.1.02'), atu: absAtu('2.1.1.02') }; // Financiamentos CP → financiamento
  const obrigTrab = { ant: absAnt('2.1.2.01'), atu: absAtu('2.1.2.01') };
  const obrigTrib = { ant: absAnt('2.1.2.02'), atu: absAtu('2.1.2.02') };
  const contasPagar = { ant: absAnt('2.1.2.03'), atu: absAtu('2.1.2.03') };
  const fornecVW = { ant: absAnt('2.1.3'), atu: absAtu('2.1.3') };
  const fornecAudi = { ant: absAnt('2.1.4'), atu: absAtu('2.1.4') };
  const fornecTotal = { ant: fornecVW.ant + fornecAudi.ant, atu: fornecVW.atu + fornecAudi.atu };

  // PASSIVO NÃO CIRCULANTE
  const passNaoCirc  = { ant: absAnt('2.2'),       atu: absAtu('2.2') };
  const emprestLP    = { ant: absAnt('2.2.1.07'), atu: absAtu('2.2.1.07') }; // Empréstimos bancários LP
  const pessoasLig   = { ant: absAnt('2.2.1.01'), atu: absAtu('2.2.1.01') }; // Sócios / pessoas ligadas
  const debitosLig   = { ant: absAnt('2.2.1.02'), atu: absAtu('2.2.1.02') }; // Débitos com ligadas
  const arrendLP     = { ant: absAnt('2.2.1.15'), atu: absAtu('2.2.1.15') }; // Arrendamentos LP (HPFS)
  const outrosPassLP = { ant: absAnt('2.2.3'),    atu: absAtu('2.2.3') };    // Outros passivos LP

  // PATRIMÔNIO LÍQUIDO
  const PL = { ant: absAnt('2.3'), atu: absAtu('2.3') };
  const capitalSocial = { ant: absAnt('2.3.1.01'), atu: absAtu('2.3.1.01') };

  // RECEITAS (conta 3 — valores negativos no balancete)
  // Usa movimento líquido (valCred − valDeb) para funcionar tanto no mensal quanto no anual
  const recBruta = { ant: absAnt('3.1'), atu: Math.abs((get('3.1').valCred || 0) - (get('3.1').valDeb || 0)) };
  const impostosVendas = { per: Math.abs((get('3.2').valDeb || 0) - (get('3.2').valCred || 0)) };
  const devolucoes = { per: Math.abs((get('3.3').valDeb || 0) - (get('3.3').valCred || 0)) };
  const rendOper = { ant: absAnt('3.4'), per: Math.abs((get('3.4').valCred || 0) - (get('3.4').valDeb || 0)) };
  const rendFinanc = { ant: absAnt('3.5'), per: Math.abs((get('3.5').valCred || 0) - (get('3.5').valDeb || 0)) };
  const rendNaoOper = { ant: absAnt('3.6'), per: Math.abs((get('3.6').valCred || 0) - (get('3.6').valDeb || 0)) };
  const recLiq = { per: recBruta.atu - impostosVendas.per - devolucoes.per };

  // CUSTOS E DESPESAS
  const CMV = { per: Math.abs((get('4').valDeb || 0) - (get('4').valCred || 0)) };
  const despPessoal_per = get('2.1.2.01.01').valCred;
  const despFinanc_per = get('5.5.7').valDeb;
  const deprec_per = get('5.5.2.07.20').valDeb;
  // despOper5Net — soma folhas de '5.' (conta-pai '5' pode não existir ou ter valor parcial)
  const allKeys5_bp = Object.keys(accounts).filter(k => k.startsWith('5.'));
  const leaves5_bp  = allKeys5_bp.filter(k => !allKeys5_bp.some(o => o !== k && o.startsWith(k + '.')));
  const despOper5Net_bp = leaves5_bp.reduce((s, k) => s + ((get(k).valDeb || 0) - (get(k).valCred || 0)), 0);

  // PROVISÃO IR + CSLL — sinal preservado: devedor → positivo (deduz), credor → negativo (adiciona)
  const provisaoIR = { saldo: (get('6').valDeb || 0) - (get('6').valCred || 0) };

  // GERAÇÃO DE CAIXA (método indireto)
  // Estoque total = VW (1.1.2) + Audi (1.1.7.02)
  const estoqueTotalAnt = estoques.ant + estAudi.ant;
  const estoqueTotalAtu = estoques.atu + estAudi.atu;
  // ── Variações de capital de giro operacional ────────────────────────────────────────────
  const dEstoque    = estoqueTotalAtu - estoqueTotalAnt; // VW (1.1.2) + Audi (1.1.7.02)
  const dCred       = creditos.atu   - creditos.ant;
  const dFornec     = fornecTotal.atu - fornecTotal.ant;
  const dObrigTrib  = obrigTrib.atu  - obrigTrib.ant;
  const dObrigTrab  = obrigTrab.atu  - obrigTrab.ant;
  const dContasPag  = contasPagar.atu - contasPagar.ant;
  const dContasCorr = contasCorr.atu  - contasCorr.ant;
  const dDespAntec  = despAntec.atu   - despAntec.ant; // aumento = uso de caixa
  const dValDiv     = valDiversos.atu - valDiversos.ant;

  // Ajustes operacionais (redução de ativo = fonte; redução de passivo = uso)
  const ajusteEstoque    = -dEstoque;
  const ajusteCred       = -dCred;
  const ajusteContasCorr = -dContasCorr;
  const ajusteDespAntec  = -dDespAntec;
  const ajusteValDiv     = -dValDiv;
  const ajusteFornec     = dFornec;
  const ajusteTrib       = dObrigTrib;
  const ajusteTrab       = dObrigTrab;
  const ajusteContasPag  = dContasPag;

  const fluxoOper =
    deprec_per +
    ajusteEstoque + ajusteCred +
    ajusteDespAntec +
    ajusteFornec + ajusteTrib + ajusteTrab + ajusteContasPag
    + dEmprestCP_01; // Fornecedores 2.1.1.01 → operacional

  // ── Atividades de Investimento ────────────────────────────────────────────
  const dIntangivel   = intangivel.atu   - intangivel.ant;
  const dRealizLPCred = realizLPCred.atu - realizLPCred.ant;
  const fluxoInvest = -(imobiliz.atu - imobiliz.ant)
                    - dIntangivel
                    - dRealizLPCred;

  // ── Atividades de Financiamento ─────────────────────────────────────────────
  const dEmprestCP  = emprestCP.atu  - emprestCP.ant; // total 2.1.1 (referência)
  const dEmprestCP_01 = emprestCP_01.atu - emprestCP_01.ant; // Fornecedores → operacional
  const dEmprestCP_02 = emprestCP_02.atu - emprestCP_02.ant; // Financiamentos CP → financiamento
  const dEmprestLP  = emprestLP.atu  - emprestLP.ant;
  const dPessoasLig = pessoasLig.atu - pessoasLig.ant;
  const dDebitosLig = debitosLig.atu - debitosLig.ant;
  const dArrendLP   = arrendLP.atu   - arrendLP.ant;
  const dOutrosPassLP = outrosPassLP.atu - outrosPassLP.ant; // eslint-disable-line @typescript-eslint/no-unused-vars
  // NOTA: 2.2.2 (Receitas Diferidas) excluída do financiamento — contém ICMS ST Diferido (não-caixa)

  const fluxoFinanc =
    dEmprestCP_02 +
    dEmprestLP  +
    dPessoasLig +
    dDebitosLig +
    dArrendLP;

  const fluxoTotal   = fluxoOper + fluxoInvest + fluxoFinanc;
  const varCaixaReal = disponib.atu - disponib.ant;

  // INDICADORES
  const liqCorrente = passCirc.atu > 0 ? ativoCirc.atu / passCirc.atu : 0;
  const liqImediata = passCirc.atu > 0 ? disponib.atu / passCirc.atu : 0;
  const endivTotal = ativoTotal.atu > 0 ? (passCirc.atu + passNaoCirc.atu) / ativoTotal.atu : 0;
  const partCapTerceiros = PL.atu > 0 ? (passCirc.atu + passNaoCirc.atu) / PL.atu : 0;
  const margemBruta = recLiq.per !== 0 ? ((recLiq.per - CMV.per) / recLiq.per) * 100 : 0;

  return {
    accounts,
    ativo: { total: ativoTotal, circ: ativoCirc, naoCirc: ativoNaoCirc },
    disponib, caixaGeral, bancos, aplicLiq, holdBack,
    estoques, estVeicNovos, estVeicUsados, estPecas, estAudi, estAudiVeicNovos, estAudiVeicUsados, estAudiPecas, outrasAtivAudi,
    creditos, contasCorr, valDiversos, despAntec, despAntecEnc, despAntecGast,
    realizLP, realizLPCred, investimentos, imobiliz, intangivel,
    passivo: { circ: passCirc, naoCirc: passNaoCirc },
    emprestCP, obrigTrab, obrigTrib, contasPagar, fornecTotal, fornecVW, fornecAudi,
    PL, capitalSocial,
    receitas: { bruta: recBruta, liq: recLiq, impostosVendas, devolucoes, rendOper, rendFinanc, rendNaoOper },
    custos: { CMV, despPessoal_per, despFinanc_per, deprec_per },
    provisaoIR,
    dfc: {
      deprec: deprec_per,
      ajusteEstoque, ajusteCred, ajusteDespAntec, ajusteFornec, ajusteTrib, ajusteTrab, ajusteContasPag,
      fluxoOper, fluxoInvest, fluxoFinanc, fluxoTotal, varCaixaReal,
      dEstoque, dCred, dDespAntec, dFornec, dObrigTrib, dObrigTrab, dContasPag,
      dEmprestCP, dEmprestCP_01, dEmprestCP_02, dEmprestLP, dPessoasLig, dDebitosLig, dArrendLP,
      dIntangivel, dRealizLPCred,
      emprestCPAnt: emprestCP.ant, emprestCPAtu: emprestCP.atu,
      emprestCP_01Ant: emprestCP_01.ant, emprestCP_01Atu: emprestCP_01.atu,
      emprestCP_02Ant: emprestCP_02.ant, emprestCP_02Atu: emprestCP_02.atu,
      emprestLPAnt: emprestLP.ant, emprestLPAtu: emprestLP.atu,
      pessoasLigAnt: pessoasLig.ant, pessoasLigAtu: pessoasLig.atu,
      debitosLigAnt: debitosLig.ant, debitosLigAtu: debitosLig.atu,
      arrendLPAnt: arrendLP.ant, arrendLPAtu: arrendLP.atu,
    },
    indicadores: { liqCorrente, liqImediata, endivTotal, partCapTerceiros, margemBruta }
  };
}

/** Extrai o mapa de contas de um texto de balancete semicolonado */
export function extractAccounts(text: string): Record<string, any> {
  const lines = text.split('\n').filter(l => l.trim());
  const accounts: Record<string, any> = {};
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, desc, saldoAnt, valDeb, valCred, saldoAtual] = parts;
    if (nivel === 'T') continue;
    const parse = (v: string) => parseFloat((v || '0').replace(',', '.')) || 0;
    accounts[conta?.trim()] = {
      nivel: nivel?.trim(),
      conta: conta?.trim(),
      desc: desc?.trim(),
      saldoAnt: parse(saldoAnt),
      valDeb: parse(valDeb),
      valCred: parse(valCred),
      saldoAtual: parse(saldoAtual),
    };
  }
  return accounts;
}

/** Parser completo: extrai contas do texto e retorna análise estruturada */
export function parseBalancete(text: string) {
  const accounts = extractAccounts(text);
  return analyzeAccounts(accounts);
}

export type ParsedBalancete = ReturnType<typeof analyzeAccounts>;
