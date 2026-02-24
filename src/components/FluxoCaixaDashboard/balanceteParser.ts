// ─── PARSER DE BALANCETE ─────────────────────────────────────────────────────
// Extraído de index.tsx para ser reutilizado em ComparativosTab e outros componentes

export function parseBalancete(text: string) {
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
  const creditos = { ant: absAnt('1.1.3'), atu: absAtu('1.1.3') };
  const contasCorr = { ant: absAnt('1.1.4'), atu: absAtu('1.1.4') };
  const valDiversos = { ant: absAnt('1.1.5'), atu: absAtu('1.1.5') };
  const ativoNaoCirc = { ant: absAnt('1.5'), atu: absAtu('1.5') };
  const realizLP = { ant: absAnt('1.5.1'), atu: absAtu('1.5.1') };
  const investimentos = { ant: absAnt('1.5.3'), atu: absAtu('1.5.3') };
  const imobiliz = { ant: absAnt('1.5.5'), atu: absAtu('1.5.5') };

  // PASSIVO CIRCULANTE
  const passCirc = { ant: absAnt('2.1'), atu: absAtu('2.1') };
  const emprestCP = { ant: absAnt('2.1.1'), atu: absAtu('2.1.1') };
  const obrigTrab = { ant: absAnt('2.1.2.01'), atu: absAtu('2.1.2.01') };
  const obrigTrib = { ant: absAnt('2.1.2.02'), atu: absAtu('2.1.2.02') };
  const contasPagar = { ant: absAnt('2.1.2.03'), atu: absAtu('2.1.2.03') };
  const fornecVW = { ant: absAnt('2.1.3'), atu: absAtu('2.1.3') };
  const fornecAudi = { ant: absAnt('2.1.4'), atu: absAtu('2.1.4') };
  const fornecTotal = { ant: fornecVW.ant + fornecAudi.ant, atu: fornecVW.atu + fornecAudi.atu };

  // PASSIVO NÃO CIRCULANTE
  const passNaoCirc = { ant: absAnt('2.2'), atu: absAtu('2.2') };

  // PATRIMÔNIO LÍQUIDO
  const PL = { ant: absAnt('2.3'), atu: absAtu('2.3') };
  const capitalSocial = { ant: absAnt('2.3.1.01'), atu: absAtu('2.3.1.01') };

  // RECEITAS (conta 3 — valores negativos no balancete)
  const recBruta = { ant: absAnt('3.1'), atu: get('3.1').valCred };
  const impostosVendas = { per: get('3.2').valDeb };
  const devolucoes = { per: get('3.3').valDeb };
  const rendOper = { ant: absAnt('3.4'), per: get('3.4').valCred };
  const rendFinanc = { ant: absAnt('3.5'), per: get('3.5').valCred };
  const recLiq = { per: recBruta.atu - impostosVendas.per - devolucoes.per };

  // CUSTOS E DESPESAS
  const CMV = { per: get('4').valDeb };
  const despPessoal_per = get('2.1.2.01.01').valCred;
  const despFinanc_per = get('5.5.7').valDeb;
  const deprec_per = get('5.5.2.07.20').valDeb;

  // PROVISÃO IR + CSLL
  const provisaoIR = { saldo: absAtu('6') };

  // GERAÇÃO DE CAIXA (método indireto)
  const dEstoque = estoques.atu - estoques.ant;
  const dCred = creditos.atu - creditos.ant;
  const dContasCorr = contasCorr.atu - contasCorr.ant;
  const dValDiv = valDiversos.atu - valDiversos.ant;
  const dFornec = fornecTotal.atu - fornecTotal.ant;
  const dObrigTrib = obrigTrib.atu - obrigTrib.ant;
  const dObrigTrab = obrigTrab.atu - obrigTrab.ant;
  const dContasPag = contasPagar.atu - contasPagar.ant;

  // Ajustes operacionais
  const ajusteEstoque = -dEstoque;
  const ajusteCred = -dCred;
  const ajusteContasCorr = -dContasCorr;
  const ajusteValDiv = -dValDiv;
  const ajusteFornec = dFornec;
  const ajusteTrib = dObrigTrib;
  const ajusteTrab = dObrigTrab;
  const ajusteContasPag = dContasPag;

  const fluxoOper =
    deprec_per +
    ajusteEstoque + ajusteCred +
    ajusteFornec + ajusteTrib + ajusteTrab + ajusteContasPag;

  const fluxoInvest = -(imobiliz.atu - imobiliz.ant);
  const fluxoFinanc = passNaoCirc.atu - passNaoCirc.ant;
  const fluxoTotal = fluxoOper + fluxoInvest + fluxoFinanc;
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
    estoques, estVeicNovos, estVeicUsados, estPecas,
    creditos, contasCorr, valDiversos,
    realizLP, investimentos, imobiliz,
    passivo: { circ: passCirc, naoCirc: passNaoCirc },
    emprestCP, obrigTrab, obrigTrib, contasPagar, fornecTotal, fornecVW, fornecAudi,
    PL, capitalSocial,
    receitas: { bruta: recBruta, liq: recLiq, impostosVendas, devolucoes, rendOper, rendFinanc },
    custos: { CMV, despPessoal_per, despFinanc_per, deprec_per },
    provisaoIR,
    dfc: {
      deprec: deprec_per,
      ajusteEstoque, ajusteCred, ajusteFornec, ajusteTrib, ajusteTrab, ajusteContasPag,
      fluxoOper, fluxoInvest, fluxoFinanc, fluxoTotal, varCaixaReal,
      dEstoque, dCred, dFornec, dObrigTrib, dObrigTrab, dContasPag
    },
    indicadores: { liqCorrente, liqImediata, endivTotal, partCapTerceiros, margemBruta }
  };
}

export type ParsedBalancete = ReturnType<typeof parseBalancete>;
