import { useState, useCallback, useRef, useEffect, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Upload, X, TrendingUp, TrendingDown, DollarSign, Package, Building2, BarChart3, Target, LogOut, Menu, Activity, Landmark, Users, Receipt, HandCoins, Layers, Download, Sparkles, FileText, ChevronDown, ChevronRight } from "lucide-react";
import * as XLSX from 'xlsx';
import { cn } from "@/lib/utils";
import { loadFluxoCaixaRaw, saveFluxoCaixaData, loadFluxoCaixaIndex } from "./fluxoCaixaStorage";
import type { ImportActor } from './importHistoryStorage';
import { ComparativosTab } from "./ComparativosTab";
import { DespesasTab } from "./DespesasTab";
import { ValoresReceberCharts } from "./ValoresReceberCharts";
import { PosicaoEstoquesCharts } from "./PosicaoEstoquesCharts";
import { MutuoSociosCharts } from "./MutuoSociosCharts";
import { ParcelamentoRefisCharts } from "./ParcelamentoRefisCharts";
import { AtivoCharts } from "./AtivoCharts";
import { PassivoCharts } from "./PassivoCharts";
import { EndividamentoCharts } from "./EndividamentoCharts";
import { ReceitasCharts } from "./ReceitasCharts";
import { CaixaDfcTab } from "./CaixaDfcTab";
import { ImobilizadoCharts } from "./ImobilizadoCharts";
import { ResultadoCharts } from "./ResultadoCharts";
import { ComparativoReceitas } from "./ComparativoReceitas";
import { ProjecaoCaixaChart } from "./ProjecaoCaixaChart";
import { ProjecaoTab } from './ProjecaoTab';
import { PerguntasRespostasTab } from "./PerguntasRespostasTab";
import { DemonstracoesFinanceiras } from "./DemonstracoesFinanceiras";
import {
  calcularDfcIndireto, calcularLinhas, calcularSaldosCaixaEquivalentes, chavePeriodo,
  encontrarLinhaBasePercentualDre, encontrarLinhaDrePorNomes, listarLinhasDre,
  type DadosDemonstracoes, type LinhaDemonstracao, type PeriodoDemonstracao,
} from './DemonstracoesFinanceiras/modelo';
import { loadCadastroDemonstracoes, loadDadosDemonstracoes } from './DemonstracoesFinanceiras/storage';

// ─── PARSER ─────────────────────────────────────────────────────────────────
function parseBalancete(text: string) {
  const lines = text.split('\n').filter(l => l.trim());
  const accounts: Record<string, any> = {};

  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, desc, saldoAnt, valDeb, valCred, saldoAtual] = parts;
    if (nivel === 'T') continue;
    const parse = (v: string) =>
      parseFloat((v || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
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
  // Estoques Audi (grupo 1.1.7) — atividade separada da VW
  const estAudi          = { ant: absAnt('1.1.7.02'),    atu: absAtu('1.1.7.02') };
  const estAudiVeicNovos = { ant: absAnt('1.1.7.02.01'), atu: absAtu('1.1.7.02.01') };
  const estAudiVeicUsados = { ant: absAnt('1.1.7.02.02'), atu: absAtu('1.1.7.02.02') };
  const estAudiPecas     = { ant: absAnt('1.1.7.02.03'), atu: absAtu('1.1.7.02.03') };
  const outrasAtivAudi   = { ant: absAnt('1.1.7'),       atu: absAtu('1.1.7') };
  const creditos = { ant: absAnt('1.1.3'), atu: absAtu('1.1.3') };
  const contasCorr = { ant: absAnt('1.1.4'), atu: absAtu('1.1.4') };
  const valDiversos = { ant: absAnt('1.1.5'), atu: absAtu('1.1.5') };
  // Sub-contas de Créditos de Vendas (1.1.3)
  const cred_3_01_01 = { ant: absAnt('1.1.3.01.01'), atu: absAtu('1.1.3.01.01'), desc: get('1.1.3.01.01').desc };
  const cred_3_01_02 = { ant: absAnt('1.1.3.01.02'), atu: absAtu('1.1.3.01.02'), desc: get('1.1.3.01.02').desc };
  const cred_3_01_03 = { ant: absAnt('1.1.3.01.03'), atu: absAtu('1.1.3.01.03'), desc: get('1.1.3.01.03').desc };
  const cred_3_01_04 = { ant: absAnt('1.1.3.01.04'), atu: absAtu('1.1.3.01.04'), desc: get('1.1.3.01.04').desc };
  const cred_3_01_06 = { ant: absAnt('1.1.3.01.06'), atu: absAtu('1.1.3.01.06'), desc: get('1.1.3.01.06').desc };
  const cred_3_01_10 = { ant: absAnt('1.1.3.01.10'), atu: absAtu('1.1.3.01.10'), desc: get('1.1.3.01.10').desc };
  // Sub-contas de Contas Correntes (1.1.4)
  const contCorr_4_01_01 = { ant: absAnt('1.1.4.01.01'), atu: absAtu('1.1.4.01.01'), desc: get('1.1.4.01.01').desc };
  const contCorr_4_02_01 = { ant: absAnt('1.1.4.02.01'), atu: absAtu('1.1.4.02.01'), desc: get('1.1.4.02.01').desc };
  const contCorr_4_03_01 = { ant: absAnt('1.1.4.03.01'), atu: absAtu('1.1.4.03.01'), desc: get('1.1.4.03.01').desc };
  // Sub-contas de Valores Diversos (1.1.5)
  const valDiv_5_01_01 = { ant: absAnt('1.1.5.01.01'), atu: absAtu('1.1.5.01.01'), desc: get('1.1.5.01.01').desc };
  const valDiv_5_03_01 = { ant: absAnt('1.1.5.03.01'), atu: absAtu('1.1.5.03.01'), desc: get('1.1.5.03.01').desc };
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
  const fpFloorAudi = { ant: absAnt('2.1.4.01.01.007'), atu: absAtu('2.1.4.01.01.007') }; // Floor Plan Novos Audi → financiamento
  const fornecTotal = { ant: fornecVW.ant + fornecAudi.ant - fpFloorAudi.ant, atu: fornecVW.atu + fornecAudi.atu - fpFloorAudi.atu };

  // PASSIVO NÃO CIRCULANTE
  const passNaoCirc  = { ant: absAnt('2.2'),       atu: absAtu('2.2') };
  const emprestLP    = { ant: absAnt('2.2.1.07'), atu: absAtu('2.2.1.07') }; // Empréstimos bancários LP
  const pessoasLig   = { ant: absAnt('2.2.1.01'), atu: absAtu('2.2.1.01') }; // Sócios / pessoas ligadas
  const debitosLig   = { ant: absAnt('2.2.1.02'), atu: absAtu('2.2.1.02') }; // Débitos com ligadas
  const arrendLP     = { ant: absAnt('2.2.1.15'), atu: absAtu('2.2.1.15') }; // Arrendamentos LP (HPFS)
  const outrosPassLP = { ant: absAnt('2.2.3'),    atu: absAtu('2.2.3') };    // Outros passivos LP

  // PATRIMÔNIO LÍQUIDO
  const PL = { ant: absAnt('2.3'), atu: absAtu('2.3') };
  // RECEITAS DIFERIDAS (2.2.2) — ICMS ST Diferido e similares
  const recDiferidas = { ant: absAnt('2.2.2'), atu: absAtu('2.2.2') };
  const capitalSocial = { ant: absAnt('2.3.1.01'), atu: absAtu('2.3.1.01') };
  const resultAcum = { ant: absAnt('2.3.3'), atu: absAtu('2.3.3') };

  // RECEITAS (conta 3 — usa movimento líquido do período)
  // Usa |valCred − valDeb| para funcionar tanto no mensal quanto no balancete anual,
  // onde podem existir estornos/ajustes no lado oposto da conta.
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
  const deprec_per = (get('5.5.2.07.20').valDeb || 0) - (get('5.5.2.07.20').valCred || 0);

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

  // Outros Ativos Audi (1.1.7 − 1.1.7.02): créditos/ctas correntes da concessionária Audi
  // não classificados como estoque — tratados como capital de giro operacional
  const outrasAtivAudiResiduo = (outrasAtivAudi.atu - estAudi.atu) - (outrasAtivAudi.ant - estAudi.ant);
  // Realizável LP — resíduo além de 1.5.1.01.52 (créditos c/ ligadas já rastreados)
  // Classificado como investimento (ativo não circulante não-imobilizado)
  const dRealizLPOutros = (realizLP.atu - realizLPCred.atu) - (realizLP.ant - realizLPCred.ant);

  // Ajustes operacionais (redução de ativo = fonte; redução de passivo = uso)
  const ajusteEstoque        = -dEstoque;
  const ajusteCred           = -dCred;
  const ajusteContasCorr     = -dContasCorr;
  const ajusteDespAntec      = -dDespAntec;
  const ajusteValDiv         = -dValDiv;
  const ajusteOutrasAtivAudi = -outrasAtivAudiResiduo; // outros ativos Audi além do estoque
  const ajusteFornec    = dFornec;
  const ajusteTrib      = dObrigTrib;
  const ajusteTrab      = dObrigTrab;
  const ajusteContasPag = dContasPag;

  // Resultado Líquido via movimentação Déb/Créd — NBC TG 03 / IAS 7
  // absMov: captura o movimento líquido do período (valCred - valDeb para crédito; valDeb - valCred para débito)
  const absMov = (id: string) => { const a = get(id); return Math.abs((a.valCred || 0) - (a.valDeb || 0)); };
  // despOper5Net — soma folhas de '5.' com valDeb−valCred (a conta-pai '5' pode não
  // existir no balancete ou ter valor diferente da soma das sub-contas)
  const allKeys5_dfc = Object.keys(accounts).filter(k => k.startsWith('5.'));
  const leaves5_dfc  = allKeys5_dfc.filter(k => !allKeys5_dfc.some(o => o !== k && o.startsWith(k + '.')));
  const despOper5Net = leaves5_dfc.reduce((s, k) => s + ((get(k).valDeb || 0) - (get(k).valCred || 0)), 0);
  // Provisão IR/CSLL com sinal: devedor → positivo (deduz), credor → negativo (adiciona)
  const resLiq_dfc   = absMov('3.1') - absMov('3.2') - absMov('3.3')
                     - absMov('4') - despOper5Net
                     + absMov('3.4') + absMov('3.5') + absMov('3.6')
                     - ((get('6').valDeb || 0) - (get('6').valCred || 0));

  // Variação de PL além do resultado (aportes / retiradas / distribuição de dividendos)
  // Declarado APÓS resLiq_dfc — resLiq_dfc precisa estar definido antes do cálculo
  const dPL = PL.atu - PL.ant;
  const dPL_extra = dPL - resLiq_dfc; // lucro/prejuízo já entra via resLiq_dfc

  const dRealizLPCred = realizLPCred.atu - realizLPCred.ant;

  const dEmprestCP_01 = emprestCP_01.atu - emprestCP_01.ant; // Fornecedores 2.1.1.01 → operacional
  // Resíduo de 2.2.1 — sub-contas não mapeadas individualmente → operacional
  const grupo2_2_1 = { ant: absAnt('2.2.1'), atu: absAtu('2.2.1') };
  const outros2_2_1Ant = grupo2_2_1.ant - emprestLP.ant - pessoasLig.ant - debitosLig.ant - arrendLP.ant;
  const outros2_2_1Atu = grupo2_2_1.atu - emprestLP.atu - pessoasLig.atu - debitosLig.atu - arrendLP.atu;
  const dOutros2_2_1   = outros2_2_1Atu - outros2_2_1Ant;

  const dRecDiferidas = recDiferidas.atu - recDiferidas.ant;

  const fluxoOper =
    resLiq_dfc +
    ajusteEstoque + ajusteCred + ajusteContasCorr + ajusteValDiv +
    ajusteDespAntec + ajusteOutrasAtivAudi +
    ajusteFornec + ajusteTrib + ajusteTrab + ajusteContasPag
    - dRealizLPCred
    + dEmprestCP_01
    + dOutros2_2_1
    + dRecDiferidas;

  // ── Atividades de Investimento ────────────────────────────────────────────
  const dIntangivel   = intangivel.atu   - intangivel.ant;
  const dInvestimentos = investimentos.atu - investimentos.ant;
  const fluxoInvest = -(imobiliz.atu - imobiliz.ant)
                    - dIntangivel
                    - dInvestimentos
                    - dRealizLPOutros; // Realizável LP além de 1.5.1.01.52

  // ── Atividades de Financiamento ─────────────────────────────────────────────
  const dEmprestCP    = emprestCP.atu    - emprestCP.ant;    // total 2.1.1 (referência)
  const dEmprestCP_02 = emprestCP_02.atu - emprestCP_02.ant; // Financiamentos CP → financiamento
  const dEmprestLP  = emprestLP.atu  - emprestLP.ant;
  const dPessoasLig = pessoasLig.atu - pessoasLig.ant;
  const dDebitosLig = debitosLig.atu - debitosLig.ant;
  const dArrendLP   = arrendLP.atu   - arrendLP.ant;
  const dOutrosPassLP = outrosPassLP.atu - outrosPassLP.ant; // 2.2.3
  const dFpFloorAudi  = fpFloorAudi.atu  - fpFloorAudi.ant;  // Floor Plan Novos Audi → financiamento
  // NOTA: 2.2.2 (Receitas Diferidas) excluída do financiamento — contém ICMS ST Diferido (não-caixa)
  // dOutros2_2_1 (resíduo 2.2.1) movido para Atividades Operacionais

  const fluxoFinanc =
    dEmprestCP_02 +
    dEmprestLP  +
    dPessoasLig +
    dDebitosLig +
    dArrendLP   +
    dOutrosPassLP +
    dFpFloorAudi  +
    dPL_extra; // Aportes/retiradas/dividendos diretos no PL além do resultado;

  const varCaixaReal = disponib.atu - disponib.ant;
  // Ajuste residual: captura depreciação (dupla contagem no método indireto quando
  // investimento usa variação líquida do imobilizado) e sub-contas não mapeadas
  const ajusteResidualBP = varCaixaReal - (fluxoOper + fluxoInvest + fluxoFinanc);
  const fluxoOper_final = fluxoOper + ajusteResidualBP;
  const fluxoTotal = fluxoOper_final + fluxoInvest + fluxoFinanc;

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
    creditos, contasCorr, valDiversos,
    cred_3_01_01, cred_3_01_02, cred_3_01_03, cred_3_01_04, cred_3_01_06, cred_3_01_10,
    contCorr_4_01_01, contCorr_4_02_01, contCorr_4_03_01,
    valDiv_5_01_01, valDiv_5_03_01,
    despAntec, despAntecEnc, despAntecGast,
    realizLP, realizLPCred, investimentos, imobiliz, intangivel,
    passivo: { circ: passCirc, naoCirc: passNaoCirc },
    emprestCP, obrigTrab, obrigTrib, contasPagar, fornecTotal, fornecVW, fornecAudi,
    emprestLP, pessoasLig, debitosLig, arrendLP, outrosPassLP,
    PL, capitalSocial, resultAcum,
    receitas: { bruta: recBruta, liq: recLiq, impostosVendas, devolucoes, rendOper, rendFinanc, rendNaoOper },
    custos: { CMV, despPessoal_per, despFinanc_per, deprec_per },
    provisaoIR,
    dfc: {
      resLiq: resLiq_dfc,
      deprec: deprec_per,
      ajusteEstoque, ajusteCred, ajusteContasCorr, ajusteValDiv, ajusteDespAntec,
      ajusteOutrasAtivAudi, outrasAtivAudiResiduo,
      ajusteFornec, ajusteTrib, ajusteTrab, ajusteContasPag,
      fluxoOper: fluxoOper_final, fluxoInvest, fluxoFinanc, fluxoTotal, varCaixaReal,
      dRecDiferidas, ajusteResidualBP,
      dEstoque, dCred, dContasCorr, dValDiv, dDespAntec, dFornec, dObrigTrib, dObrigTrab, dContasPag,
      dEmprestCP, dEmprestCP_01, dEmprestCP_02, dEmprestLP, dPessoasLig, dDebitosLig, dArrendLP,
      dFpFloorAudi, fpFloorAudiAnt: fpFloorAudi.ant, fpFloorAudiAtu: fpFloorAudi.atu,
      dIntangivel, dRealizLPCred, dRealizLPOutros, dInvestimentos,
      dOutrosPassLP, dOutros2_2_1, outros2_2_1Ant, outros2_2_1Atu,
      dPL_extra,
      despOper5Net,
      emprestCPAnt: emprestCP.ant, emprestCPAtu: emprestCP.atu,
      emprestCP_01Ant: emprestCP_01.ant, emprestCP_01Atu: emprestCP_01.atu,
      emprestCP_02Ant: emprestCP_02.ant, emprestCP_02Atu: emprestCP_02.atu,
      emprestLPAnt: emprestLP.ant, emprestLPAtu: emprestLP.atu,
      pessoasLigAnt: pessoasLig.ant, pessoasLigAtu: pessoasLig.atu,
      debitosLigAnt: debitosLig.ant, debitosLigAtu: debitosLig.atu,
      arrendLPAnt: arrendLP.ant, arrendLPAtu: arrendLP.atu,
      investimentosAnt: investimentos.ant, investimentosAtu: investimentos.atu,
      realizLPAnt: realizLP.ant, realizLPAtu: realizLP.atu,
      PLAnt: PL.ant, PLAtu: PL.atu,
    },
    indicadores: { liqCorrente, liqImediata, endivTotal, partCapTerceiros, margemBruta }
  };
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
const fmtBRL = (v: number, compact = false) => {
  const abs = Math.abs(v);
  if (compact) {
    if (abs >= 1e6) return `R$ ${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `R$ ${(abs / 1e3).toFixed(0)}k`;
  }
  return 'R$ ' + abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtPct = (v: number) => `${v >= 0 ? '' : '–'}${Math.abs(v).toFixed(1)}%`;
const fmtVar = (ant: number, atu: number) => {
  if (ant === 0) return { pct: null, diff: atu - ant };
  return { pct: ((atu - ant) / Math.abs(ant)) * 100, diff: atu - ant };
};

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
const KPI = ({ label, value, sub, color = 'emerald', icon, tooltip }: any) => {
  const colorClasses: any = {
    emerald: 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
    blue: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/30',
    amber: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30',
    red: 'border-l-red-500 bg-red-50 dark:bg-red-950/30',
    violet: 'border-l-violet-500 bg-violet-50 dark:bg-violet-950/30'
  };
  
  return (
    <Card className={cn('border-l-4', colorClasses[color] || colorClasses.emerald)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {icon && <span>{icon}</span>}
          {label}
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-auto cursor-help text-muted-foreground/60 hover:text-muted-foreground transition-colors">ℹ️</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs whitespace-pre-line text-xs leading-relaxed p-3">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground mb-1">{value}</div>
        {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
};

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

// Retorna sub-contas folha (sem filhos) de um prefixo, com pelo menos um valor não-zero
function subAccs(accounts: Record<string, any>, prefix: string) {
  const allKeys = Object.keys(accounts).filter(k => k.startsWith(prefix + '.'));
  const leaves = allKeys.filter(k => !allKeys.some(other => other !== k && other.startsWith(k + '.')));
  return leaves
    .filter(k => accounts[k].saldoAnt !== 0 || accounts[k].saldoAtual !== 0)
    .sort()
    .map(k => ({ conta: k, desc: accounts[k].desc, ant: Math.abs(accounts[k].saldoAnt), atu: Math.abs(accounts[k].saldoAtual) }));
}

// Retorna contas a exatamente `extraSegments` níveis abaixo do prefixo
function subAccsAtDepth(accounts: Record<string, any>, prefix: string, extraSegments: number) {
  const targetDots = (prefix.match(/\./g) || []).length + extraSegments;
  return Object.keys(accounts)
    .filter(k => k.startsWith(prefix + '.') && (k.match(/\./g) || []).length === targetDots)
    .filter(k => accounts[k].saldoAnt !== 0 || accounts[k].saldoAtual !== 0)
    .sort()
    .map(k => ({ conta: k, desc: accounts[k].desc, ant: Math.abs(accounts[k].saldoAnt), atu: Math.abs(accounts[k].saldoAtual) }));
}

const TableRow2 = ({ label, ant, atu, highlight, indent = 0 }: any) => {
  const { diff, pct } = fmtVar(ant, atu);
  return (
    <tr className={cn(highlight && 'bg-muted/50')}>
      <td className={cn('py-2 px-3 text-sm', highlight ? 'font-bold text-foreground' : 'text-muted-foreground')} style={{ paddingLeft: 12 + indent * 16 }}>{label}</td>
      <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">{fmtBRL(ant)}</td>
      <td className={cn('py-2 px-3 text-right text-sm font-mono', highlight ? 'font-bold text-foreground' : 'text-foreground')}>{fmtBRL(atu)}</td>
      <td className={cn('py-2 px-3 text-right text-xs font-mono', diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
        {pct !== null ? `${diff >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
      </td>
    </tr>
  );
};

const BarGauge = ({ label, value, max, color }: any) => {
  const pct = Math.min(100, (Math.abs(value) / max) * 100);
  const colorClasses: any = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    violet: 'bg-violet-500'
  };
  
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-mono font-semibold text-foreground">{fmtBRL(value, true)}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-1000', colorClasses[color] || 'bg-emerald-500')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const SectionTitle = ({ children, icon }: any) => (
  <div className="flex items-center gap-3 mb-5 mt-2">
    {icon && <span className="text-xl">{icon}</span>}
    <h2 className="text-lg font-bold text-foreground">{children}</h2>
    <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent ml-2" />
  </div>
);

const StatusBadge = ({ label, status }: any) => {
  const variants: any = {
    ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    warn: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    bad: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
  };
  return <Badge className={cn('text-xs font-bold', variants[status] || variants.ok)}>{label}</Badge>;
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────────────
interface FluxoCaixaDashboardProps {
  onChangeBrand?: () => void;
  currentUser?: ImportActor;
}

export function FluxoCaixaDashboard({ onChangeBrand, currentUser }: FluxoCaixaDashboardProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [redisWarning, setRedisWarning] = useState<string | null>(null);
  const [showTabelaDespesas, setShowTabelaDespesas] = useState(false);
  const [despesasView, setDespesasView] = useState<'normal' | 'comparativo'>('normal');
  const [receitasView, setReceitasView] = useState<'normal' | 'comparativo'>('normal');
  const [janAccounts, setJanAccounts] = useState<Record<string, any> | null>(null);
  const [prevMonthAccounts, setPrevMonthAccounts] = useState<Record<string, any> | null>(null);
  const [prevYearAccounts, setPrevYearAccounts] = useState<Record<string, any> | null>(null);
  const [ytdAccountsSums, setYtdAccountsSums] = useState<Record<string, number>>({});
  const [allMonthsAccounts, setAllMonthsAccounts] = useState<Array<Record<string, any>>>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const MONTHS = [
    { n: 0, label: 'Anual' },
    { n: 1, label: 'Jan' }, { n: 2, label: 'Fev' }, { n: 3, label: 'Mar' },
    { n: 4, label: 'Abr' }, { n: 5, label: 'Mai' }, { n: 6, label: 'Jun' },
    { n: 7, label: 'Jul' }, { n: 8, label: 'Ago' }, { n: 9, label: 'Set' },
    { n: 10, label: 'Out' }, { n: 11, label: 'Nov' }, { n: 12, label: 'Dez' },
  ];
  const MONTH_NAMES: Record<number, string> = {
    0: 'Anual',
    1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho',
    7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro',
  };

  // Ano e mês selecionados — lidos do localStorage para sobreviver a recarregamentos
  const AVAILABLE_YEARS = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028];
  const [selectedYear, setSelectedYearState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('fluxo_caixa_selected_year');
      const n = stored ? parseInt(stored, 10) : NaN;
      return AVAILABLE_YEARS.includes(n) ? n : 2025;
    } catch {
      return 2025;
    }
  });
  const [selectedMonth, setSelectedMonthState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('fluxo_caixa_selected_month');
      const n = stored ? parseInt(stored, 10) : NaN;
      return n >= 0 && n <= 12 ? n : 12;
    } catch {
      return 12;
    }
  });

  const setSelectedYear = (year: number) => {
    try { localStorage.setItem('fluxo_caixa_selected_year', String(year)); } catch {}
    setSelectedYearState(year);
  };
  const setSelectedMonth = (month: number) => {
    try { localStorage.setItem('fluxo_caixa_selected_month', String(month)); } catch {}
    setSelectedMonthState(month);
  };

  // ── Labels dinâmicos das colunas de período ──────────────────────────────
  const MONTH_SHORT_MAP: Record<number, string> = {
    1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
    7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
  };
  // "Saldo Atual" vira o período selecionado: "2025" (anual) ou "Dez/25" (mensal)
  const colAtual = selectedMonth === 0
    ? String(selectedYear)
    : `${MONTH_SHORT_MAP[selectedMonth]}/${String(selectedYear).slice(2)}`;
  // "Saldo Anterior" vira o período imediatamente anterior
  const colAnterior = selectedMonth === 0
    ? String(selectedYear - 1)
    : selectedMonth === 1
      ? `Dez/${String(selectedYear - 1).slice(2)}`
      : `${MONTH_SHORT_MAP[selectedMonth - 1]}/${String(selectedYear).slice(2)}`;

  // Nome do arquivo salvo por chave (ano+mês)
  const [savedFileNames, setSavedFileNames] = useState<Record<string, string | undefined>>({});
  const savedFileKey = `${selectedYear}_${selectedMonth}`;
  const savedFileName = savedFileNames[savedFileKey];

  // Ao montar, navega automaticamente para o período mais recente com balancete importado
  useEffect(() => {
    loadFluxoCaixaIndex().then(index => {
      const keys = Object.keys(index); // "YYYY_MM"
      if (keys.length === 0) return;
      // Ordena decrescente e pega o mais recente
      keys.sort((a, b) => b.localeCompare(a));
      const [yearStr, monthStr] = keys[0].split('_');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      if (!isNaN(year) && !isNaN(month)) {
        setSelectedYear(year);
        setSelectedMonth(month);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setData(null);

        if (selectedMonth > 0) {
          // Carregar todos os meses de Jan até selectedMonth em paralelo
          // + Dez do ano anterior se selectedMonth === 1 (para comparação com mês anterior)
          const ytdPromises = Array.from({ length: selectedMonth }, (_, i) =>
            loadFluxoCaixaRaw(selectedYear, i + 1)
          );
          const prevYearDecPromise = selectedMonth === 1
            ? loadFluxoCaixaRaw(selectedYear - 1, 12)
            : Promise.resolve(null);

          const [ytdRaws, prevYearDec] = await Promise.all([
            Promise.all(ytdPromises),
            prevYearDecPromise,
          ]);

          setPrevYearAccounts(null); // não usado no modo mensal

          const currentRaw = ytdRaws[selectedMonth - 1];
          const prevMonthRaw = selectedMonth === 1 ? prevYearDec : ytdRaws[selectedMonth - 2];

          // Jan accounts (usados por outras abas como CaixaTab)
          if (selectedMonth > 1 && ytdRaws[0]?.rawText) {
            const janParsed = parseBalancete(ytdRaws[0].rawText);
            setJanAccounts(Object.keys(janParsed.accounts).length >= 10 ? janParsed.accounts : null);
          } else {
            setJanAccounts(null);
          }

          // Prev month accounts (para colunas de comparação)
          if (prevMonthRaw?.rawText) {
            const prevParsed = parseBalancete(prevMonthRaw.rawText);
            setPrevMonthAccounts(Object.keys(prevParsed.accounts).length >= 10 ? prevParsed.accounts : null);
          } else {
            setPrevMonthAccounts(null);
          }

          // YTD: somar movimentos (valCred − valDeb) de Jan até selectedMonth
          // + guardar accounts de cada mês para cálculo de captação/amortização acumulado
          const ytdSums: Record<string, number> = {};
          const allMonthsAccountsArr: Array<Record<string, any>> = [];
          for (const mRaw of ytdRaws) {
            if (mRaw?.rawText) {
              const mParsed = parseBalancete(mRaw.rawText);
              allMonthsAccountsArr.push(mParsed.accounts);
              for (const [id, acc] of Object.entries(mParsed.accounts)) {
                ytdSums[id] = (ytdSums[id] ?? 0) + ((acc as any).valCred - (acc as any).valDeb);
              }
            } else {
              allMonthsAccountsArr.push({});
            }
          }
          setYtdAccountsSums(ytdSums);
          setAllMonthsAccounts(allMonthsAccountsArr);

          // Dados do mês atual
          if (currentRaw?.rawText) {
            console.log(`✅ Balancete ${MONTH_NAMES[selectedMonth]}/${selectedYear} carregado do Redis — re-parseando...`);
            const parsed = parseBalancete(currentRaw.rawText);
            if (Object.keys(parsed.accounts).length >= 10) {
              setData(parsed);
              setSavedFileNames(prev => ({ ...prev, [savedFileKey]: currentRaw.fileName }));
              setActiveTab(current => current === 'emissaoDemonstracoes' ? current : 'overview');
              return;
            }
          }
        } else {
          // selectedMonth === 0: modo anual
          const [raw, prevYearRaw] = await Promise.all([
            loadFluxoCaixaRaw(selectedYear, 0),
            loadFluxoCaixaRaw(selectedYear - 1, 0),
          ]);
          setJanAccounts(null);
          setPrevMonthAccounts(null);
          setYtdAccountsSums({});
          setAllMonthsAccounts([]);

          // Carregar accounts do ano anterior para coluna de comparação
          if (prevYearRaw?.rawText) {
            const prevParsed = parseBalancete(prevYearRaw.rawText);
            setPrevYearAccounts(Object.keys(prevParsed.accounts).length >= 10 ? prevParsed.accounts : null);
          } else {
            setPrevYearAccounts(null);
          }

          if (raw?.rawText) {
            console.log(`✅ Balancete ${MONTH_NAMES[selectedMonth]}/${selectedYear} carregado do Redis — re-parseando...`);
            const parsed = parseBalancete(raw.rawText);
            if (Object.keys(parsed.accounts).length >= 10) {
              setData(parsed);
              setSavedFileNames(prev => ({ ...prev, [savedFileKey]: raw.fileName }));
              setActiveTab(current => current === 'emissaoDemonstracoes' ? current : 'overview');
              return;
            }
          }
        }

        // Sem dados para o mês selecionado
        console.log(`📄 Nenhum balancete ${MONTH_NAMES[selectedMonth]}/${selectedYear} no Redis`);
        setData(null);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth]);

  const processFile = useCallback((file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseBalancete(text);
        if (Object.keys(parsed.accounts).length < 10) throw new Error('Arquivo não reconhecido como balancete válido.');

        // Se o mês importado for Janeiro, atualiza janAccounts para cálculo acumulado
        if (selectedMonth === 1) setJanAccounts(parsed.accounts);

        if (!currentUser) throw new Error('Não foi possível registrar quem importou o balancete.');
        const saved = await saveFluxoCaixaData(text, file.name, selectedYear, selectedMonth, currentUser);
        if (saved) {
          console.log(`✅ Balancete ${MONTH_NAMES[selectedMonth]}/${selectedYear} salvo no Redis com sucesso:`, file.name);
          setRedisWarning(null);
        } else {
          console.warn('⚠️ Não foi possível salvar no Redis, mas os dados estão em memória');
          setRedisWarning('Os dados foram carregados na sessão, mas não foi possível salvar no banco de dados (Redis). Ao recarregar a página os dados serão perdidos. Verifique se as variáveis KV_REST_API_URL e KV_REST_API_TOKEN estão configuradas na Vercel.');
        }

        // Recalcular YTD somando meses anteriores + mês recém-importado
        if (selectedMonth > 0) {
          const ytdSums: Record<string, number> = {};
          const allMonthsAccountsArr: Array<Record<string, any>> = [];
          if (selectedMonth > 1) {
            const prevRaws = await Promise.all(
              Array.from({ length: selectedMonth - 1 }, (_, i) => loadFluxoCaixaRaw(selectedYear, i + 1))
            );
            for (const mRaw of prevRaws) {
              if (mRaw?.rawText) {
                const mParsed = parseBalancete(mRaw.rawText);
                allMonthsAccountsArr.push(mParsed.accounts);
                for (const [id, acc] of Object.entries(mParsed.accounts)) {
                  ytdSums[id] = (ytdSums[id] ?? 0) + ((acc as any).valCred - (acc as any).valDeb);
                }
              } else {
                allMonthsAccountsArr.push({});
              }
            }
          }
          for (const [id, acc] of Object.entries(parsed.accounts)) {
            ytdSums[id] = (ytdSums[id] ?? 0) + ((acc as any).valCred - (acc as any).valDeb);
          }
          allMonthsAccountsArr.push(parsed.accounts);
          setYtdAccountsSums(ytdSums);
          setAllMonthsAccounts(allMonthsAccountsArr);
        }

        setSavedFileNames(prev => ({ ...prev, [savedFileKey]: file.name }));
        setData(parsed);
        setActiveTab('overview');
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    };
    reader.readAsText(file, 'latin1');
  }, [selectedYear, selectedMonth, savedFileKey, currentUser]);

  const TABS = [
    { id: 'overview', label: selectedMonth === 0 ? 'Visão Geral Ano' : 'Visão Geral Mês', icon: <BarChart3 className="w-4 h-4" />, requiresData: true },
    { id: 'ativo', label: 'Ativo', icon: <Package className="w-4 h-4" />, requiresData: true },
    { id: 'passivo', label: 'Passivo + PL', icon: <Building2 className="w-4 h-4" />, requiresData: true },
    { id: 'resultado', label: 'Resultado', icon: <TrendingUp className="w-4 h-4" />, requiresData: true },
    { id: 'caixa', label: 'FC Indireto', icon: <DollarSign className="w-4 h-4" />, requiresData: true },
    { id: 'caixaDireto', label: 'FC Direto', icon: <DollarSign className="w-4 h-4" />, requiresData: true },
    { id: 'posicaoEstoques', label: 'Posição de Estoques', icon: <Layers className="w-4 h-4" />, requiresData: true },
    { id: 'valoresReceber', label: 'Valores a Receber', icon: <HandCoins className="w-4 h-4" />, requiresData: true },
    { id: 'endividamento', label: 'Endividamento', icon: <Landmark className="w-4 h-4" />, requiresData: true },
    { id: 'mutuoSocios', label: 'Mútuo Sócios', icon: <Users className="w-4 h-4" />, requiresData: true },
    { id: 'parcelamentoRefis', label: 'Parcelamento Refis', icon: <Receipt className="w-4 h-4" />, requiresData: true },
    { id: 'imobilizado', label: 'Imobilizado', icon: <Building2 className="w-4 h-4" />, requiresData: true },
    { id: 'receitas', label: 'Receitas', icon: <TrendingUp className="w-4 h-4" />, requiresData: true },
    { id: 'despesas', label: 'Despesas', icon: <Receipt className="w-4 h-4" />, requiresData: true },
    { id: 'indicadores', label: 'Indicadores', icon: <Target className="w-4 h-4" />, requiresData: true },
    { id: 'diagnostico', label: selectedMonth === 0 ? 'Diagnóstico Ano' : 'Diagnóstico Mês', icon: <Activity className="w-4 h-4" />, requiresData: true },
    { id: 'comparativos', label: 'Comparativos', icon: <BarChart3 className="w-4 h-4" />, requiresData: false },
    { id: 'projecao', label: 'Projeção', icon: <TrendingUp className="w-4 h-4" />, requiresData: false },
    { id: 'perguntasRespostas', label: 'Perguntas e Respostas', icon: <Sparkles className="w-4 h-4" />, requiresData: false },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-[#16a34a] text-white shadow-lg fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-white hover:bg-green-700"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <div>
              <h1 className="text-xl font-bold">Análise Financeira Sorana</h1>
              <p className="text-sm text-green-100">
                {savedFileName ? `📂 ${savedFileName}` : `Fluxo de Caixa — ${MONTH_NAMES[selectedMonth]}/${selectedYear}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Botão Comparativo — visível nas abas Despesas e Receitas */}
            {activeTab === 'despesas' && (
              <button
                onClick={() => setDespesasView(v => v === 'comparativo' ? 'normal' : 'comparativo')}
                className={cn(
                  'px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors',
                  despesasView === 'comparativo'
                    ? 'bg-white text-green-700 border-white'
                    : 'bg-green-700 text-white border-green-500 hover:bg-green-600'
                )}
              >
                📊 Comparativo
              </button>
            )}
            {activeTab === 'receitas' && (
              <button
                onClick={() => setReceitasView(v => v === 'comparativo' ? 'normal' : 'comparativo')}
                className={cn(
                  'px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors',
                  receitasView === 'comparativo'
                    ? 'bg-white text-green-700 border-white'
                    : 'bg-green-700 text-white border-green-500 hover:bg-green-600'
                )}
              >
                📊 Comparativo
              </button>
            )}
            {/* Seletor de ano */}
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="appearance-none bg-white text-green-700 font-bold text-sm rounded-lg px-3 py-1.5 pr-8 border border-green-200 shadow-sm cursor-pointer focus:outline-none"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2316a34a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
            >
              {AVAILABLE_YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {/* Seletor de mês */}
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="appearance-none bg-white text-green-700 font-bold text-sm rounded-lg px-3 py-1.5 pr-8 border border-green-200 shadow-sm cursor-pointer focus:outline-none"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2316a34a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
            >
              {MONTHS.map(({ n, label }) => (
                <option key={n} value={n}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Input file oculto — acionado pelo botão "Novo Arquivo" */}
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.csv"
        className="hidden"
        onChange={e => processFile(e.target.files?.[0])}
      />

      {/* Sidebar */}
      <>
          <aside
            className={cn(
              'fixed left-0 top-[60px] bottom-0 w-64 flex flex-col bg-slate-800 text-white z-20 transition-transform duration-300',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            )}
          >
            <nav className="min-h-0 flex-1 overflow-y-auto p-4 space-y-1">
              {TABS.filter(tab => !tab.requiresData || data).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left',
                    activeTab === tab.id
                      ? 'bg-green-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  )}
                >
                  {tab.icon}
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>

            <div className="shrink-0 p-4 border-t border-slate-700 space-y-1">
              <button
                onClick={() => {
                  setActiveTab('emissaoDemonstracoes');
                  setSidebarOpen(false);
                }}
                aria-current={activeTab === 'emissaoDemonstracoes' ? 'page' : undefined}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left',
                  activeTab === 'emissaoDemonstracoes'
                    ? 'bg-green-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                )}
              >
                <FileText className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">Emissão de Demonstrações Financeiras</span>
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left"
              >
                <Upload className="w-5 h-5" />
                <span className="text-sm font-medium">Novo Arquivo</span>
              </button>
              {onChangeBrand && (
                <button
                  onClick={onChangeBrand}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-medium">Voltar ao Menu</span>
                </button>
              )}
            </div>
          </aside>

          {/* Overlay para mobile */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-10 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </>

      {/* Main Content */}
      <main className={cn('pt-[60px] min-h-screen', 'lg:ml-64')}>
        <div className="p-6 max-w-7xl mx-auto">
          {activeTab === 'comparativos' ? (
            <div className="animate-in fade-in duration-500">
              <ComparativosTab selectedYear={selectedYear} selectedMonth={selectedMonth} />
            </div>
          ) : activeTab === 'projecao' ? (
            <div className="animate-in fade-in duration-500">
              <AlertDialog defaultOpen>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Aviso</AlertDialogTitle>
                    <AlertDialogDescription>Funcionalidade ainda em Teste.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogAction>OK</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <ProjecaoTab
                allMonthsAccounts={allMonthsAccounts}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                fmtBRL={fmtBRL}
              />
            </div>
          ) : activeTab === 'perguntasRespostas' ? (
            <div className="animate-in fade-in duration-500">
              <PerguntasRespostasTab data={data} selectedMonth={selectedMonth} selectedYear={selectedYear} prevMonthAccounts={prevMonthAccounts} janAccounts={janAccounts} />
            </div>
          ) : activeTab === 'emissaoDemonstracoes' ? (
            <DemonstracoesFinanceiras selectedYear={selectedYear} selectedMonth={selectedMonth} currentUser={currentUser} />
          ) : loading && !data ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-500">
              <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Carregando dados...</p>
            </div>
          ) : !data ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6 text-slate-500">
              <div className="text-6xl">📂</div>
              <div className="text-center">
                <p className="text-xl font-semibold text-slate-700 mb-2">Nenhum dado para {MONTH_NAMES[selectedMonth]}/{selectedYear}</p>
                <p className="text-sm text-slate-500 mb-6">Importe o balancete referente a {MONTH_NAMES[selectedMonth]}/{selectedYear} para visualizar as informações.</p>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  <Upload className="w-4 h-4" />
                  Importar Balancete {MONTH_NAMES[selectedMonth]}/{selectedYear}
                </button>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in duration-500">
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}
              {redisWarning && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-sm flex items-start justify-between gap-3">
                  <span>⚠️ <strong>Dados não persistidos:</strong> {redisWarning}</span>
                  <button onClick={() => setRedisWarning(null)} className="shrink-0 text-amber-600 hover:text-amber-900 font-bold text-lg leading-none">×</button>
                </div>
              )}
              {activeTab === 'overview' && <OverviewTab data={data} fmtBRL={fmtBRL} KPI={KPI} BarGauge={BarGauge} SectionTitle={SectionTitle} />}
              {activeTab === 'ativo' && <AtivoTab data={data} SectionTitle={SectionTitle} TableRow2={TableRow2} colAnterior={colAnterior} colAtual={colAtual} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'passivo' && <PassivoTab data={data} SectionTitle={SectionTitle} TableRow2={TableRow2} colAnterior={colAnterior} colAtual={colAtual} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'resultado' && <ResultadoTab fmtBRL={fmtBRL} SectionTitle={SectionTitle} colAtual={colAtual} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'caixa' && <CaixaTab fmtBRL={fmtBRL} SectionTitle={SectionTitle} colAtual={colAtual} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'caixaDireto' && <CaixaDiretoTab fmtBRL={fmtBRL} SectionTitle={SectionTitle} colAtual={colAtual} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'posicaoEstoques' && <PosicaoEstoquesTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} KPI={KPI} colAnterior={colAnterior} colAtual={colAtual} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'valoresReceber' && <ValoresReceberTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} KPI={KPI} colAnterior={colAnterior} colAtual={colAtual} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'receitas' && receitasView === 'normal' && <ReceitasTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} KPI={KPI} colAnterior={colAnterior} colAtual={colAtual} prevMonthAccounts={prevMonthAccounts} prevYearAccounts={prevYearAccounts} selectedMonth={selectedMonth} selectedYear={selectedYear} ytdAccountsSums={ytdAccountsSums} />}
              {activeTab === 'receitas' && receitasView === 'comparativo' && (
                <div className="space-y-4">
                  <button
                    onClick={() => setReceitasView('normal')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-border bg-muted/40 hover:bg-muted/70 transition-colors text-foreground shadow-sm"
                  >
                    ← Voltar para Receitas
                  </button>
                  <ComparativoReceitas fmtBRL={fmtBRL} />
                </div>
              )}
              {activeTab === 'endividamento' && <EndividamentoTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} KPI={KPI} TableRow2={TableRow2} colAnterior={colAnterior} colAtual={colAtual} janAccounts={janAccounts} selectedMonth={selectedMonth} selectedYear={selectedYear} allMonthsAccounts={allMonthsAccounts} />}
              {activeTab === 'despesas' && <DespesasTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} KPI={KPI} showTabela={showTabelaDespesas} setShowTabela={setShowTabelaDespesas} despesasView={despesasView} setDespesasView={setDespesasView} selectedMonth={selectedMonth} selectedYear={selectedYear} ytdAccountsSums={ytdAccountsSums} />}
              {activeTab === 'mutuoSocios' && <MutuoSociosTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} KPI={KPI} colAnterior={colAnterior} colAtual={colAtual} janAccounts={janAccounts} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'parcelamentoRefis' && <ParcelamentoRefisTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} KPI={KPI} colAnterior={colAnterior} colAtual={colAtual} janAccounts={janAccounts} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'imobilizado' && <ImobilizadoTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} KPI={KPI} colAnterior={colAnterior} colAtual={colAtual} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'indicadores' && <IndicadoresTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} Badge={StatusBadge} janAccounts={janAccounts} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'diagnostico' && <DiagnosticoTab fmtBRL={fmtBRL} SectionTitle={SectionTitle} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

function PosicaoEstoquesTab({ data, fmtBRL, SectionTitle, KPI, colAnterior, colAtual, selectedMonth, selectedYear }: any) {
  const [showCharts, setShowCharts] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const accounts = data.accounts as Record<string, any>;
  const getAcc = (id: string) => accounts[id] || { saldoAnt: 0, saldoAtual: 0 };

  const vwContas = [
    { id: '1.1.2.01.01.001' },
    { id: '1.1.2.02.01.001' },
    { id: '1.1.2.03.01.001' },
  ].map(c => {
    const acc = getAcc(c.id);
    return { conta: c.id, desc: acc.desc || c.id, ant: Math.abs(acc.saldoAnt), atu: Math.abs(acc.saldoAtual) };
  });

  const audiContas = [
    { id: '1.1.7.02.01.001' },
    { id: '1.1.7.02.02.001' },
    { id: '1.1.7.02.03.001' },
  ].map(c => {
    const acc = getAcc(c.id);
    return { conta: c.id, desc: acc.desc || c.id, ant: Math.abs(acc.saldoAnt), atu: Math.abs(acc.saldoAtual) };
  });

  const vwAnt = vwContas.reduce((s, c) => s + c.ant, 0);
  const vwAtu = vwContas.reduce((s, c) => s + c.atu, 0);
  const audiAnt = audiContas.reduce((s, c) => s + c.ant, 0);
  const audiAtu = audiContas.reduce((s, c) => s + c.atu, 0);
  const totalAnt = vwAnt + audiAnt;
  const totalAtu = vwAtu + audiAtu;
  const varTotal = totalAtu - totalAnt;
  const varTotalPct = totalAnt !== 0 ? (varTotal / totalAnt) * 100 : null;

  const renderTabela = (contas: typeof vwContas, totalAntLocal: number, totalAtuLocal: number, titulo: string, icon: string) => (
    <Card>
      <CardContent className="pt-6">
        <SectionTitle icon={icon}>{titulo}</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Conta / Descrição</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAnterior}</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAtual}</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Variação R$</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Var %</th>
              </tr>
            </thead>
            <tbody>
              {contas.map(a => {
                const varR = a.atu - a.ant;
                const varP = a.ant !== 0 ? (varR / a.ant) * 100 : null;
                return (
                  <tr key={a.conta} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-3">
                      <span className="text-xs font-mono text-muted-foreground mr-2">{a.conta}</span>
                      <span className="text-sm text-foreground">{a.desc ? toTitleCase(a.desc) : a.conta}</span>
                    </td>
                    <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">{fmtBRL(a.ant)}</td>
                    <td className="py-2 px-3 text-right text-sm font-mono font-semibold text-foreground">{fmtBRL(a.atu)}</td>
                    <td className={`py-2 px-3 text-right text-sm font-mono ${varR > 0 ? 'text-emerald-600 dark:text-emerald-400' : varR < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      {varR >= 0 ? '+' : '-'}{fmtBRL(varR)}
                    </td>
                    <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-emerald-600 dark:text-emerald-400' : varR < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      {varP !== null ? `${varP >= 0 ? '+' : '-'}${Math.abs(varP).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/50 font-bold">
                <td className="py-2.5 px-3 text-sm font-bold text-foreground">TOTAL</td>
                <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">{fmtBRL(totalAntLocal)}</td>
                <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-foreground">{fmtBRL(totalAtuLocal)}</td>
                <td className={`py-2.5 px-3 text-right text-sm font-mono font-bold ${totalAtuLocal - totalAntLocal > 0 ? 'text-emerald-600 dark:text-emerald-400' : totalAtuLocal - totalAntLocal < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                  {totalAtuLocal - totalAntLocal >= 0 ? '+' : '-'}{fmtBRL(totalAtuLocal - totalAntLocal)}
                </td>
                <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-muted-foreground">
                  {totalAntLocal !== 0 ? `${((totalAtuLocal - totalAntLocal) / totalAntLocal * 100) >= 0 ? '+' : '-'}${Math.abs((totalAtuLocal - totalAntLocal) / totalAntLocal * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  if (showCharts) {
    return <PosicaoEstoquesCharts selectedYear={selectedYear} selectedMonth={selectedMonth} onClose={() => setShowCharts(false)} />;
  }

  const handlePDF = () => {
    const printSource = printRef.current;
    const root = document.getElementById('print-root');
    if (!printSource || !root) return;

    setPrinting(true);

    const clone = printSource.cloneNode(true) as HTMLElement;
    clone.style.display = 'block';
    root.innerHTML = clone.outerHTML;

    const style = document.createElement('style');
    style.id = '__posicao-estoques-print-override__';
    style.textContent = `
      @page { size: A4 portrait; margin: 1cm; }
      body > *:not(#print-root) { display: none !important; }
      #print-root {
        display: block !important;
        font-family: Inter, system-ui, sans-serif;
        font-size: 10px;
      }
      #print-root, #print-root * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
        color-scheme: light !important;
      }
      #print-root .overflow-x-auto { overflow: visible !important; }
      #print-root table { width: 100%; border-collapse: collapse; }
      #print-root th, #print-root td { font-size: 8px !important; padding: 3px 6px !important; }
    `;
    document.head.appendChild(style);

    setPrinting(false);

    window.onafterprint = () => {
      document.head.querySelector('#__posicao-estoques-print-override__')?.remove();
      root.innerHTML = '';
      window.onafterprint = null;
    };

    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Botões de ação */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowCharts(true)} className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Evolução Mensal
        </Button>
        <button
          onClick={handlePDF}
          disabled={printing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-sm bg-slate-800 text-white border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>🖨️</span> {printing ? 'Preparando...' : 'Imprimir / Salvar PDF'}
        </button>
      </div>
      <div ref={printRef}>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI
          label="Estoque Sorana VW"
          value={fmtBRL(vwAtu, true)}
          sub={`Ant: ${fmtBRL(vwAnt, true)} | Var: ${fmtBRL(vwAtu - vwAnt, true)}`}
          color={vwAtu >= vwAnt ? 'emerald' : 'red'}
          icon="🚗"
        />
        <KPI
          label="Estoque Sorana Audi"
          value={fmtBRL(audiAtu, true)}
          sub={`Ant: ${fmtBRL(audiAnt, true)} | Var: ${fmtBRL(audiAtu - audiAnt, true)}`}
          color={audiAtu >= audiAnt ? 'emerald' : 'red'}
          icon="🏎️"
        />
        <KPI
          label="Total Consolidado"
          value={fmtBRL(totalAtu, true)}
          sub={`Ant: ${fmtBRL(totalAnt, true)} | Var: ${varTotalPct !== null ? (varTotal >= 0 ? '+' : '') + varTotalPct.toFixed(1) + '%' : '—'}`}
          color={totalAtu >= totalAnt ? 'emerald' : 'red'}
          icon="📦"
        />
      </div>

      {renderTabela(vwContas, vwAnt, vwAtu, 'Estoque Sorana VW', '🚗')}
      {renderTabela(audiContas, audiAnt, audiAtu, 'Estoque Sorana Audi', '🏎️')}

      {/* Consolidado */}
      <Card className="border-2 border-border">
        <CardContent className="pt-6">
          <SectionTitle icon="📦">Consolidado por Marca</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Marca</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAnterior}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAtual}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Variação R$</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Var %</th>
                </tr>
              </thead>
              <tbody>
                {[{ label: '🚗 Sorana VW', ant: vwAnt, atu: vwAtu }, { label: '🏎️ Sorana Audi', ant: audiAnt, atu: audiAtu }, { label: '📦 TOTAL GERAL', ant: totalAnt, atu: totalAtu }].map((row, i) => {
                  const isTotal = i === 2;
                  const varR = row.atu - row.ant;
                  const varP = row.ant !== 0 ? (varR / row.ant) * 100 : null;
                  return (
                    <tr key={row.label} className={isTotal ? 'bg-muted/70 font-bold' : 'border-b border-border/50 hover:bg-muted/30'}>
                      <td className={`py-2.5 px-3 text-sm ${isTotal ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{row.label}</td>
                      <td className={`py-2.5 px-3 text-right text-sm font-mono ${isTotal ? 'font-bold text-muted-foreground' : 'text-muted-foreground'}`}>{fmtBRL(row.ant)}</td>
                      <td className={`py-2.5 px-3 text-right text-sm font-mono ${isTotal ? 'font-bold text-foreground' : 'text-foreground'}`}>{fmtBRL(row.atu)}</td>
                      <td className={`py-2.5 px-3 text-right text-sm font-mono ${isTotal ? 'font-bold ' : ''}${varR > 0 ? 'text-emerald-600 dark:text-emerald-400' : varR < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {varR >= 0 ? '+' : '-'}{fmtBRL(varR)}
                      </td>
                      <td className={`py-2.5 px-3 text-right text-xs font-mono ${isTotal ? 'font-bold ' : ''}${varR > 0 ? 'text-emerald-600 dark:text-emerald-400' : varR < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {varP !== null ? `${varP >= 0 ? '+' : '-'}${Math.abs(varP).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function ValoresReceberTab({ data, fmtBRL, SectionTitle, KPI, colAnterior, colAtual, selectedMonth, selectedYear }: any) {
  const [showCharts, setShowCharts] = useState(false);
  const accounts = data.accounts as Record<string, any>;
  const getAcc = (id: string) => accounts[id] || { saldoAnt: 0, saldoAtual: 0 };

  const CONTAS = [
    { id: '1.1.3.01.01' },
    { id: '1.1.3.01.03' },
    { id: '1.1.3.01.04' },
    { id: '1.1.3.01.06' },
    { id: '1.1.3.01.10' },
  ].map(c => {
    const acc = getAcc(c.id);
    return { conta: c.id, desc: acc.desc || c.id, ant: Math.abs(acc.saldoAnt), atu: Math.abs(acc.saldoAtual) };
  });

  const totalAnt = CONTAS.reduce((s, c) => s + c.ant, 0);
  const totalAtu = CONTAS.reduce((s, c) => s + c.atu, 0);
  const varTotal = totalAtu - totalAnt;
  const varTotalPct = totalAnt !== 0 ? (varTotal / totalAnt) * 100 : null;

  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const handlePDF = () => {
    const printSource = printRef.current;
    const root = document.getElementById('print-root');
    if (!printSource || !root) return;
    setPrinting(true);
    const clone = printSource.cloneNode(true) as HTMLElement;
    clone.style.display = 'block';
    root.innerHTML = clone.outerHTML;
    const style = document.createElement('style');
    style.id = '__valores-receber-print-override__';
    style.textContent = `
      @page { size: A4 portrait; margin: 1cm; }
      body > *:not(#print-root) { display: none !important; }
      #print-root { display: block !important; font-family: Inter, system-ui, sans-serif; font-size: 10px; }
      #print-root, #print-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; forced-color-adjust: none !important; color-scheme: light !important; }
      #print-root .overflow-x-auto { overflow: visible !important; }
      #print-root table { width: 100%; border-collapse: collapse; }
      #print-root th, #print-root td { font-size: 8px !important; padding: 3px 6px !important; }
    `;
    document.head.appendChild(style);
    setPrinting(false);
    window.onafterprint = () => {
      document.head.querySelector('#__valores-receber-print-override__')?.remove();
      root.innerHTML = '';
      window.onafterprint = null;
    };
    window.print();
  };

  if (showCharts) {
    return <ValoresReceberCharts selectedYear={selectedYear} selectedMonth={selectedMonth} onClose={() => setShowCharts(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Botões de ação */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowCharts(true)} className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Evolução Mensal
        </Button>
        <button
          onClick={handlePDF}
          disabled={printing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-sm bg-slate-800 text-white border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>🖨️</span> {printing ? 'Preparando...' : 'Imprimir / Salvar PDF'}
        </button>
      </div>
      <div ref={printRef}>

      {/* KPI Total */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI
          label={colAnterior}
          value={fmtBRL(totalAnt, true)}
          sub="Saldo do período anterior"
          color="blue"
          icon="📋"
        />
        <KPI
          label={colAtual}
          value={fmtBRL(totalAtu, true)}
          sub="Saldo do período atual"
          color={totalAtu > totalAnt ? 'emerald' : 'red'}
          icon="💰"
        />
        <KPI
          label="Variação"
          value={`${varTotal >= 0 ? '+' : '-'}${fmtBRL(varTotal, true)}`}
          sub={varTotalPct !== null ? `${varTotalPct >= 0 ? '+' : '-'}${Math.abs(varTotalPct).toFixed(1)}%` : '—'}
          color={varTotal >= 0 ? 'emerald' : 'red'}
          icon="📈"
        />
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon="💰">Valores a Receber — Detalhamento</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Conta / Descrição</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAnterior}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAtual}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Variação R$</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Var %</th>
                </tr>
              </thead>
              <tbody>
                {CONTAS.map(a => {
                  const varR = a.atu - a.ant;
                  const varP = a.ant !== 0 ? (varR / a.ant) * 100 : null;
                  return (
                    <tr key={a.conta} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3">
                        <span className="text-xs font-mono text-muted-foreground mr-2">{a.conta}</span>
                        <span className="text-sm text-foreground">{a.desc ? toTitleCase(a.desc) : a.conta}</span>
                      </td>
                      <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">{fmtBRL(a.ant)}</td>
                      <td className="py-2 px-3 text-right text-sm font-mono font-semibold text-foreground">{fmtBRL(a.atu)}</td>
                      <td className={`py-2 px-3 text-right text-sm font-mono ${varR > 0 ? 'text-emerald-600 dark:text-emerald-400' : varR < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {varR > 0 ? '+' : varR < 0 ? '-' : ''}{fmtBRL(varR)}
                      </td>
                      <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-emerald-600 dark:text-emerald-400' : varR < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {varP !== null ? `${varP >= 0 ? '+' : ''}${varP.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/50 font-bold">
                  <td className="py-2.5 px-3 text-sm font-bold text-foreground">TOTAL</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">{fmtBRL(totalAnt)}</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-foreground">{fmtBRL(totalAtu)}</td>
                  <td className={`py-2.5 px-3 text-right text-sm font-mono font-bold ${varTotal > 0 ? 'text-emerald-600 dark:text-emerald-400' : varTotal < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    {varTotal > 0 ? '+' : varTotal < 0 ? '-' : ''}{fmtBRL(varTotal)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-muted-foreground">
                    {varTotalPct !== null ? `${varTotalPct >= 0 ? '+' : ''}${varTotalPct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function ReceitasTab({ data, fmtBRL, SectionTitle, KPI, colAnterior, colAtual, prevMonthAccounts, prevYearAccounts, selectedMonth, selectedYear, ytdAccountsSums }: any) {
  const accounts = data.accounts as Record<string, any>;
  const getAcc = (id: string) => accounts[id] || { saldoAnt: 0, saldoAtual: 0, valDeb: 0, valCred: 0 };
  // No modo anual (selectedMonth === 0) usa prevYearAccounts; no mensal usa prevMonthAccounts
  const prevAccounts = selectedMonth === 0 ? prevYearAccounts : prevMonthAccounts;
  const getPrev = (id: string) => (prevAccounts || {})[id] || { valDeb: 0, valCred: 0 };
  const ytdSums: Record<string, number> = ytdAccountsSums || {};

  // Movimentação do mês atual: crédito − débito (contas de receita têm natureza credora)
  const mov = (id: string) => { const a = getAcc(id); return a.valCred - a.valDeb; };
  // Movimentação do período anterior (ano anterior no balancete anual, mês anterior no mensal)
  const movPrev = (id: string) => { if (!prevAccounts) return 0; const a = getPrev(id); return a.valCred - a.valDeb; };
  // YTD acumulado: soma de (valCred − valDeb) de Jan até o mês selecionado
  const ytdVal = (id: string) => ytdSums[id] ?? 0;

  // Label do acumulado ex: "Jan–Jul/25"
  const MSHORT = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const yr2 = String(selectedYear).slice(2);
  const ytdLabel = selectedMonth === 0
    ? String(selectedYear)
    : selectedMonth === 1
      ? `Jan/${yr2}`
      : `Jan–${MSHORT[selectedMonth]}/${yr2}`;

  const SUFFIX_MAP: Record<string, string> = {
    '3.1.1.01.01.001': ' - VW',
    '3.1.1.03.01.001': ' - VW',
    '3.1.3.01.01.001': ' - VW',
  };

  const makeSimples = (ids: string[]) => ids.map(id => {
    const acc = getAcc(id);
    return { conta: id, desc: (acc.desc || id) + (SUFFIX_MAP[id] ?? ''), ant: movPrev(id), atu: mov(id), ytd: ytdVal(id) };
  });

  // Contas com dedução → linha única com valor líquido (bruta − dedução)
  // Contas de dedução (3.3.x) têm natureza devedora: deduction = valDeb - valCred
  const PAIRED: Array<{ conta: string; desc: string; ant: number; atu: number; ytd: number }> = [
    { gross: '3.1.1.01.01.001', ded: '3.3.1.01.01.001' },
    { gross: '3.1.1.01.01.002', ded: '3.3.1.01.01.005' },
    { gross: '3.1.1.03.01.001', ded: '3.3.1.01.01.002' },
    { gross: '3.1.1.03.01.002', ded: '3.3.1.01.01.006' },
    { gross: '3.1.2.01.01.001', ded: '3.3.1.01.01.003' },
    { gross: '3.1.2.01.01.002', ded: '3.3.1.01.01.007' },
  ].map((p: any) => {
    const g = getAcc(p.gross);
    const d = getAcc(p.ded);
    const gP = getPrev(p.gross);
    const dP = getPrev(p.ded);
    return {
      conta: p.gross,
      desc: (g.desc || p.gross) + (SUFFIX_MAP[p.gross] ?? ''),
      ant: prevAccounts ? (gP.valCred - gP.valDeb) - (dP.valDeb - dP.valCred) : 0,
      atu: (g.valCred - g.valDeb) - (d.valDeb - d.valCred),
      ytd: (ytdSums[p.gross] ?? 0) + (ytdSums[p.ded] ?? 0),
    };
  });

  const GROUPS: Array<{ label: string; contas: Array<{ conta: string; desc: string; ant: number; atu: number; ytd: number }> }> = [
    {
      label: '1 — Receita de Vendas',
      contas: [
        ...PAIRED,
        ...makeSimples([
          '3.1.3.01.01.001',
          '3.1.3.01.01.002',
          '3.1.3.01.01.003',
          '3.1.3.01.01.004',
          '3.1.3.01.01.005',
          '3.1.3.01.01.006',
          '3.6.1.01.02.001',
        ]),
      ],
    },
    {
      label: '2 — Bonificações',
      contas: makeSimples([
        '3.4.1.02.02.002',
        '3.4.1.08.01.001',
        '3.4.1.09.01.001',
        '3.4.1.02.02.003',
        '3.4.1.02.02.007',
        '3.4.1.02.02.005',
      ]),
    },
    {
      label: '3 — Comissões',
      contas: makeSimples([
        '3.4.1.05.01.001',
        '3.4.1.02.02.006',
        '3.4.1.04.01.001',
        '3.4.1.04.03.001',
        '3.4.2.01.01.001',
        '3.4.2.03.01.001',
        '3.4.2.04.01.001',
        '3.4.2.05.01.001',
        '3.4.2.06.01.001',
        '3.4.2.99.01.001',
      ]),
    },
    {
      label: '4 — Recuperação de Impostos',
      contas: makeSimples([
        '3.4.3.01.02.002',
        '3.4.3.01.02.003',
        '3.4.3.01.02.025',
      ]),
    },
    {
      label: '5 — Outras Receitas',
      contas: makeSimples([
        '3.4.3.02.01.001',
        '3.4.3.04.01.001',
        '3.5.1.01.01.001',
        '3.5.2.01.01.001',
        '3.5.3.01.01.001',
        '3.6.1.02.01.001',
        '3.6.1.02.01.002',
      ]),
    },
  ];

  const CONTAS = GROUPS.flatMap(g => g.contas);
  const totalAnt = CONTAS.reduce((s, c) => s + c.ant, 0);
  const totalAtu = CONTAS.reduce((s, c) => s + c.atu, 0);
  const totalYtd = CONTAS.reduce((s, c) => s + c.ytd, 0);
  const varTotal = totalAtu - totalAnt;
  const varTotalPct = totalAnt !== 0 ? (varTotal / totalAnt) * 100 : null;

  const [showYtd, setShowYtd] = useState(false);
  const [showCharts, setShowCharts] = useState(false);

  if (showCharts) {
    return <ReceitasCharts selectedYear={selectedYear} selectedMonth={selectedMonth} onClose={() => setShowCharts(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Botão Evolução Mensal */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCharts(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-sm bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-900/50"
        >
          <span>📈</span> Evolução Mensal
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI
          label={`Total ${colAnterior}`}
          value={fmtBRL(totalAnt, true)}
          sub={`Receita total de ${colAnterior}`}
          color="blue"
          icon="📋"
        />
        <KPI
          label={`Total ${colAtual}`}
          value={fmtBRL(totalAtu, true)}
          sub={`Receita total de ${colAtual}`}
          color={totalAtu > totalAnt ? 'emerald' : 'red'}
          icon="💰"
        />
        <KPI
          label="Variação"
          value={`${varTotal > 0 ? '+' : varTotal < 0 ? '-' : ''}${fmtBRL(varTotal, true)}`}
          sub={varTotalPct !== null ? `${varTotalPct >= 0 ? '+' : '-'}${Math.abs(varTotalPct).toFixed(1)}%` : '—'}
          color={varTotal >= 0 ? 'emerald' : 'red'}
          icon="📈"
        />
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon="💵">Receitas — Detalhamento</SectionTitle>
            <button
              onClick={() => setShowYtd(v => !v)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-sm',
                showYtd
                  ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700'
                  : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted/70'
              )}
            >
              <span>📊</span>
              {showYtd ? `Ocultar Acumulado` : `Mostrar Acumulado ${ytdLabel}`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Conta / Descrição</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAnterior}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAtual}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Variação R$</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Var %</th>
                  {showYtd && (
                    <th className="py-2.5 pl-8 pr-3 text-right text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 border-l-2 border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20">
                      Acum. {ytdLabel}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {GROUPS.map(group => {
                  const gAnt = group.contas.reduce((s, c) => s + c.ant, 0);
                  const gAtu = group.contas.reduce((s, c) => s + c.atu, 0);
                  const gYtd = group.contas.reduce((s, c) => s + c.ytd, 0);
                  const gVar = gAtu - gAnt;
                  const gVarPct = gAnt !== 0 ? (gVar / gAnt) * 100 : null;
                  return (
                    <Fragment key={group.label}>
                      {/* Cabeçalho do grupo */}
                      <tr className="bg-muted/40 border-t-2 border-border">
                        <td colSpan={5} className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-foreground">
                          {group.label}
                        </td>
                        {showYtd && <td className="py-2 pl-8 pr-3 border-l-2 border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/10" />}
                      </tr>
                      {/* Linhas do grupo */}
                      {group.contas.map(a => {
                        const varR = a.atu - a.ant;
                        const varP = a.ant !== 0 ? (varR / a.ant) * 100 : null;
                        return (
                          <tr key={a.conta} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="py-2 px-3 pl-6">
                              <span className="text-xs font-mono text-muted-foreground mr-2">{a.conta}</span>
                              <span className="text-sm text-foreground">{a.desc ? toTitleCase(a.desc) : a.conta}</span>
                            </td>
                            <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">{fmtBRL(a.ant)}</td>
                            <td className="py-2 px-3 text-right text-sm font-mono font-semibold text-foreground">{fmtBRL(a.atu)}</td>
                            <td className={`py-2 px-3 text-right text-sm font-mono ${
                              varR > 0 ? 'text-emerald-600 dark:text-emerald-400'
                              : varR < 0 ? 'text-red-600 dark:text-red-400'
                              : 'text-muted-foreground'
                            }`}>
                              {varR > 0 ? '+' : varR < 0 ? '-' : ''}{fmtBRL(varR)}
                            </td>
                            <td className={`py-2 px-3 text-right text-xs font-mono ${
                              varR > 0 ? 'text-emerald-600 dark:text-emerald-400'
                              : varR < 0 ? 'text-red-600 dark:text-red-400'
                              : 'text-muted-foreground'
                            }`}>
                              {varP !== null ? `${varP >= 0 ? '+' : '-'}${Math.abs(varP).toFixed(1)}%` : '—'}
                            </td>
                            {showYtd && (
                              <td className="py-2 pl-8 pr-3 text-right text-sm font-mono font-semibold text-amber-700 dark:text-amber-400 border-l-2 border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/10">
                                {fmtBRL(a.ytd)}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {/* Subtotal do grupo */}
                      <tr className="bg-muted/20 border-t border-border">
                        <td className="py-2 px-3 pl-6 text-sm font-semibold text-foreground">Subtotal — {group.label}</td>
                        <td className="py-2 px-3 text-right text-sm font-mono font-semibold text-muted-foreground">{fmtBRL(gAnt)}</td>
                        <td className="py-2 px-3 text-right text-sm font-mono font-semibold text-foreground">{fmtBRL(gAtu)}</td>
                        <td className={`py-2 px-3 text-right text-sm font-mono font-semibold ${
                          gVar > 0 ? 'text-emerald-600 dark:text-emerald-400'
                          : gVar < 0 ? 'text-red-600 dark:text-red-400'
                          : 'text-muted-foreground'
                        }`}>
                          {gVar > 0 ? '+' : gVar < 0 ? '-' : ''}{fmtBRL(gVar)}
                        </td>
                        <td className={`py-2 px-3 text-right text-xs font-mono font-semibold ${
                          gVar > 0 ? 'text-emerald-600 dark:text-emerald-400'
                          : gVar < 0 ? 'text-red-600 dark:text-red-400'
                          : 'text-muted-foreground'
                        }`}>
                          {gVarPct !== null ? `${gVarPct >= 0 ? '+' : '-'}${Math.abs(gVarPct).toFixed(1)}%` : '—'}
                        </td>
                        {showYtd && (
                          <td className="py-2 pl-8 pr-3 text-right text-sm font-mono font-bold text-amber-700 dark:text-amber-400 border-l-2 border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20">
                            {fmtBRL(gYtd)}
                          </td>
                        )}
                      </tr>
                    </Fragment>
                  );
                })}
                {/* Total geral */}
                <tr className="bg-muted/50 font-bold border-t-2 border-border">
                  <td className="py-2.5 px-3 text-sm font-bold text-foreground">TOTAL</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">{fmtBRL(totalAnt)}</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-foreground">{fmtBRL(totalAtu)}</td>
                  <td className={`py-2.5 px-3 text-right text-sm font-mono font-bold ${
                    varTotal > 0 ? 'text-emerald-600 dark:text-emerald-400'
                    : varTotal < 0 ? 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground'
                  }`}>
                    {varTotal > 0 ? '+' : varTotal < 0 ? '-' : ''}{fmtBRL(varTotal)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-muted-foreground">
                    {varTotalPct !== null ? `${varTotalPct >= 0 ? '+' : '-'}${Math.abs(varTotalPct).toFixed(1)}%` : '—'}
                  </td>
                  {showYtd && (
                    <td className="py-2.5 pl-8 pr-3 text-right text-sm font-mono font-bold text-amber-700 dark:text-amber-400 border-l-2 border-amber-300 dark:border-amber-700 bg-amber-100/60 dark:bg-amber-950/30">
                      {fmtBRL(totalYtd)}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EndividamentoTab({ data, fmtBRL, SectionTitle, KPI, TableRow2, colAnterior, colAtual, janAccounts, selectedMonth, selectedYear, allMonthsAccounts }: any) {
  const [showCharts, setShowCharts] = useState(false);
  const d = data;
  const accounts = d.accounts as Record<string, any>;
  const getAcc = (id: string) => accounts[id] || { saldoAnt: 0, saldoAtual: 0 };

  // CP: grupo 2.1.1.02.03 (empréstimos bancários curto prazo — bancos financiadores)
  const cpBase = { ant: Math.abs(getAcc('2.1.1.02.03').saldoAnt), atu: Math.abs(getAcc('2.1.1.02.03').saldoAtual) };
  const cpSubs = subAccs(accounts, '2.1.1.02.03');

  // Contas adicionais CP com offset de ativo (resultado mínimo = 0)
  const netAcc1 = {
    ant: Math.max(0, Math.abs(getAcc('2.1.1.02.01.001').saldoAnt) - Math.abs(getAcc('1.1.2.01.01.001').saldoAnt)),
    atu: Math.max(0, Math.abs(getAcc('2.1.1.02.01.001').saldoAtual) - Math.abs(getAcc('1.1.2.01.01.001').saldoAtual)),
  };
  const netAcc2 = {
    ant: Math.max(0, Math.abs(getAcc('2.1.4.01.01.007').saldoAnt) - Math.abs(getAcc('1.1.7.02.01.001').saldoAnt)),
    atu: Math.max(0, Math.abs(getAcc('2.1.4.01.01.007').saldoAtual) - Math.abs(getAcc('1.1.7.02.01.001').saldoAtual)),
  };
  const cpTotal = { ant: cpBase.ant + netAcc1.ant + netAcc2.ant, atu: cpBase.atu + netAcc1.atu + netAcc2.atu };

  // LP: grupo 2.2.1.07 (empréstimos bancários longo prazo)
  const lpTotal = { ant: d.emprestLP.ant, atu: d.emprestLP.atu };
  const lpSubs = subAccs(accounts, '2.2.1.07');

  const totalAnt = cpTotal.ant + lpTotal.ant;
  const totalAtu = cpTotal.atu + lpTotal.atu;
  const varTotal = totalAtu - totalAnt;
  const varTotalPct = totalAnt !== 0 ? ((varTotal / totalAnt) * 100) : null;

  // ── Captação / Amortização ────────────────────────────────────────────
  const isMo = selectedMonth > 0;
  const CA_MS: Record<number, string> = {1:'Jan',2:'Fev',3:'Mar',4:'Abr',5:'Mai',6:'Jun',7:'Jul',8:'Ago',9:'Set',10:'Out',11:'Nov',12:'Dez'};
  const CA_yr2 = String(selectedYear || new Date().getFullYear()).slice(2);
  const allMoAccounts: Array<Record<string, any>> = allMonthsAccounts || [];
  const CA_hasYTD = isMo && selectedMonth > 1 && allMoAccounts.length > 0;
  const CA_ytdLbl = CA_hasYTD ? `Jan – ${CA_MS[selectedMonth]}/${CA_yr2}` : colAtual;

  // Calcula captYTD e amortYTD para uma conta padrão somando o delta de cada mês
  const stdYTD = (id: string): { captYTD: number; amortYTD: number } => {
    let capt = 0, amort = 0;
    for (const m of allMoAccounts) {
      const a = m[id];
      if (!a) continue;
      const d = Math.abs(a.saldoAtual) - Math.abs(a.saldoAnt);
      capt += Math.max(0, d);
      amort += Math.max(0, -d);
    }
    return { captYTD: capt, amortYTD: amort };
  };

  // YTD para netAcc1 (Banco Volks Floor Plan Novos VW) — conta líquida passivo−ativo
  const netYTD1 = (): { captYTD: number; amortYTD: number } => {
    let capt = 0, amort = 0;
    for (const m of allMoAccounts) {
      const passivo = m['2.1.1.02.01.001'] || { saldoAnt: 0, saldoAtual: 0 };
      const ativo   = m['1.1.2.01.01.001'] || { saldoAnt: 0, saldoAtual: 0 };
      const netAnt = Math.max(0, Math.abs(passivo.saldoAnt)   - Math.abs(ativo.saldoAnt));
      const netAtu = Math.max(0, Math.abs(passivo.saldoAtual) - Math.abs(ativo.saldoAtual));
      const d = netAtu - netAnt;
      capt  += Math.max(0, d);
      amort += Math.max(0, -d);
    }
    return { captYTD: capt, amortYTD: amort };
  };

  // YTD para netAcc2 (Banco Volks Floor Plan Novos Audi) — conta líquida passivo−ativo
  const netYTD2 = (): { captYTD: number; amortYTD: number } => {
    let capt = 0, amort = 0;
    for (const m of allMoAccounts) {
      const passivo = m['2.1.4.01.01.007'] || { saldoAnt: 0, saldoAtual: 0 };
      const ativo   = m['1.1.7.02.01.001'] || { saldoAnt: 0, saldoAtual: 0 };
      const netAnt = Math.max(0, Math.abs(passivo.saldoAnt)   - Math.abs(ativo.saldoAnt));
      const netAtu = Math.max(0, Math.abs(passivo.saldoAtual) - Math.abs(ativo.saldoAtual));
      const d = netAtu - netAnt;
      capt  += Math.max(0, d);
      amort += Math.max(0, -d);
    }
    return { captYTD: capt, amortYTD: amort };
  };

  // YTD para Banco VW Capital de Giro — soma CP+LP mês a mês
  const vwGiroYTDFn = (): { captYTD: number; amortYTD: number } => {
    let capt = 0, amort = 0;
    for (const m of allMoAccounts) {
      const cp = m['2.1.1.02.03.020'] || { saldoAnt: 0, saldoAtual: 0 };
      const lp = m['2.2.1.07.01.003'] || { saldoAnt: 0, saldoAtual: 0 };
      const netAnt = Math.abs(cp.saldoAnt)   + Math.abs(lp.saldoAnt);
      const netAtu = Math.abs(cp.saldoAtual) + Math.abs(lp.saldoAtual);
      const d = netAtu - netAnt;
      capt  += Math.max(0, d);
      amort += Math.max(0, -d);
    }
    return { captYTD: capt, amortYTD: amort };
  };

  const enrichCA = (conta: string, label: string, deltaMes: number, ytdObj: { captYTD: number; amortYTD: number }) => {
    const acc = accounts[conta] || {};
    const deltaAnual = Math.abs(acc.saldoAtual || 0) - Math.abs(acc.saldoAnt || 0);
    return {
      conta, label,
      captMes:    Math.max(0,  deltaMes),
      amortMes:   Math.max(0, -deltaMes),
      captYTD:    ytdObj.captYTD,
      amortYTD:   ytdObj.amortYTD,
      captAnual:  Math.max(0,  deltaAnual),
      amortAnual: Math.max(0, -deltaAnual),
    };
  };
  // Pré-computar YTDs especiais uma única vez
  const ytd1 = netYTD1();
  const ytd2 = netYTD2();
  const ytdVwGiro = vwGiroYTDFn();

  const cpCA = [
    ...cpSubs.map(s => enrichCA(s.conta, s.desc ? toTitleCase(s.desc) : s.conta, s.atu - s.ant, stdYTD(s.conta))),
    enrichCA('2.1.1.02.01.001', 'Banco Volks Floor Plan Novos VW',   netAcc1.atu - netAcc1.ant, ytd1),
    enrichCA('2.1.4.01.01.007', 'Banco Volks Floor Plan Novos Audi', netAcc2.atu - netAcc2.ant, ytd2),
  ];
  const lpCA = lpSubs.map(s => enrichCA(s.conta, s.desc ? toTitleCase(s.desc) : s.conta, s.atu - s.ant, stdYTD(s.conta)));
  const rollCA = (rows: { captMes: number; amortMes: number; captYTD: number; amortYTD: number; captAnual: number; amortAnual: number }[]) =>
    rows.reduce((a, r) => ({
      captMes:    a.captMes    + r.captMes,
      amortMes:   a.amortMes   + r.amortMes,
      captYTD:    a.captYTD    + r.captYTD,
      amortYTD:   a.amortYTD   + r.amortYTD,
      captAnual:  a.captAnual  + r.captAnual,
      amortAnual: a.amortAnual + r.amortAnual,
    }), { captMes: 0, amortMes: 0, captYTD: 0, amortYTD: 0, captAnual: 0, amortAnual: 0 });
  const cpTotCA = rollCA(cpCA);
  const lpTotCA = rollCA(lpCA);
  const grandCA = rollCA([...cpCA, ...lpCA]);

  // ── Tabela unificada (sem separação CP/LP) ────────────────────────────────
  const cpSubsFiltered = cpSubs.filter(s => s.conta !== '2.1.1.02.03.020');
  const lpSubsFiltered = lpSubs.filter(s => s.conta !== '2.2.1.07.01.003');
  const cpVWGiroSub = cpSubs.find(s => s.conta === '2.1.1.02.03.020');
  const lpVWGiroSub = lpSubs.find(s => s.conta === '2.2.1.07.01.003');
  // Banco VW - Capital de Giro = soma CP (2.1.1.02.03.020) + LP (2.2.1.07.01.003)
  const vwCapGiro = {
    ant: (cpVWGiroSub?.ant || 0) + (lpVWGiroSub?.ant || 0),
    atu: (cpVWGiroSub?.atu || 0) + (lpVWGiroSub?.atu || 0),
  };
  // Captação/Amortização para row merged — YTD calculado somando CP+LP mês a mês
  const vwGiroDeltaMes = vwCapGiro.atu - vwCapGiro.ant;
  const vwGiroCA = {
    conta: 'vw-capital-giro',
    label: 'Banco VW - Capital de Giro',
    captMes:    Math.max(0,  vwGiroDeltaMes),
    amortMes:   Math.max(0, -vwGiroDeltaMes),
    captYTD:    ytdVwGiro.captYTD,
    amortYTD:   ytdVwGiro.amortYTD,
    captAnual:  Math.max(0,  vwGiroDeltaMes),
    amortAnual: Math.max(0, -vwGiroDeltaMes),
  };
  // Todas as rows unificadas para Captação e Amortização
  // Contas que tiveram movimentação acumulada em meses anteriores mas saldo zero no mês atual
  // Garante que apareçam na coluna YTD mesmo quando o saldo do mês corrente é zero
  const collectYtdExtras = (prefix: string, excludes: string[], currentIds: Set<string>): Array<{conta: string, desc: string}> => {
    if (!CA_hasYTD) return [];
    const seen = new Map<string, string>();
    for (const m of allMoAccounts) {
      const mKeys = Object.keys(m);
      for (const k of mKeys) {
        if (!k.startsWith(prefix + '.')) continue;
        if (excludes.includes(k)) continue;
        if (currentIds.has(k)) continue;
        if (seen.has(k)) continue;
        const isLeaf = !mKeys.some(o => o !== k && o.startsWith(k + '.'));
        if (isLeaf) seen.set(k, m[k]?.desc || k);
      }
    }
    return Array.from(seen.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([conta, desc]) => ({ conta, desc }));
  };
  const cpSubsIds = new Set(cpSubsFiltered.map(s => s.conta));
  const lpSubsIds = new Set(lpSubsFiltered.map(s => s.conta));
  const cpExtras = collectYtdExtras('2.1.1.02.03', ['2.1.1.02.03.020'], cpSubsIds);
  const lpExtras = collectYtdExtras('2.2.1.07', ['2.2.1.07.01.003'], lpSubsIds);

  const allCAMerged = [
    ...cpSubsFiltered.map(s => enrichCA(s.conta, s.desc ? toTitleCase(s.desc) : s.conta, s.atu - s.ant, stdYTD(s.conta))),
    ...cpExtras.map(e => enrichCA(e.conta, e.desc ? toTitleCase(e.desc) : e.conta, 0, stdYTD(e.conta))),
    vwGiroCA,
    {
      ...enrichCA('2.1.1.02.01.001', 'Banco Volks Floor Plan Novos VW', netAcc1.atu - netAcc1.ant, ytd1),
      captAnual:  Math.max(0,  netAcc1.atu - netAcc1.ant),
      amortAnual: Math.max(0, -(netAcc1.atu - netAcc1.ant)),
    },
    {
      ...enrichCA('2.1.4.01.01.007', 'Banco Volks Floor Plan Novos Audi', netAcc2.atu - netAcc2.ant, ytd2),
      captAnual:  Math.max(0,  netAcc2.atu - netAcc2.ant),
      amortAnual: Math.max(0, -(netAcc2.atu - netAcc2.ant)),
    },
    ...lpSubsFiltered.map(s => enrichCA(s.conta, s.desc ? toTitleCase(s.desc) : s.conta, s.atu - s.ant, stdYTD(s.conta))),
    ...lpExtras.map(e => enrichCA(e.conta, e.desc ? toTitleCase(e.desc) : e.conta, 0, stdYTD(e.conta))),
  ];
  const grandCAMerged = rollCA(allCAMerged);

  const [showCaptAmort, setShowCaptAmort] = useState(false);
  const resultadoRowCA = (tot: { captMes: number; amortMes: number; captYTD: number; amortYTD: number; captAnual: number; amortAnual: number }, label: string, bold: boolean) => {
    const netMes = tot.captMes - tot.amortMes;
    const netYTD = tot.captYTD - tot.amortYTD;
    const netAnual = tot.captAnual - tot.amortAnual;
    const clr = (n: number) => n > 0 ? 'text-red-600 dark:text-red-400' : n < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/50';
    const fmt = (n: number) => n === 0 ? '—' : (n > 0 ? '+ ' : '− ') + fmtBRL(Math.abs(n));
    return (
      <tr className="border-b border-dashed border-border/50 bg-muted/10">
        <td className={cn('py-1.5 px-3 text-xs italic', bold ? 'font-bold' : 'font-medium', 'text-foreground/70')}>{label}</td>
        {isMo ? <>
          <td colSpan={2} className={cn('py-1.5 px-3 text-right text-sm font-mono italic border-l border-border/40', bold && 'font-bold', clr(netMes))}>{fmt(netMes)}</td>
          {CA_hasYTD && <td colSpan={2} className={cn('py-1.5 px-3 text-right text-sm font-mono italic border-l border-border/40', bold && 'font-bold', clr(netYTD))}>{fmt(netYTD)}</td>}
        </> : <>
          <td colSpan={2} className={cn('py-1.5 px-3 text-right text-sm font-mono italic border-l border-border/40', bold && 'font-bold', clr(netAnual))}>{fmt(netAnual)}</td>
        </>}
      </tr>
    );
  };

  const movColsCA = (r: { captMes: number; amortMes: number; captYTD: number; amortYTD: number; captAnual: number; amortAnual: number }, bold: boolean) => {
    if (isMo) {
      return <>
        <td className={cn('py-2.5 px-3 text-right text-sm font-mono border-l border-border/40', r.captMes > 0 ? cn('text-red-600 dark:text-red-400', bold && 'font-bold') : 'text-muted-foreground/40')}>{r.captMes > 0 ? fmtBRL(r.captMes) : '—'}</td>
        <td className={cn('py-2.5 px-3 text-right text-sm font-mono', r.amortMes > 0 ? cn('text-emerald-600 dark:text-emerald-400', bold && 'font-bold') : 'text-muted-foreground/40')}>{r.amortMes > 0 ? fmtBRL(r.amortMes) : '—'}</td>
        {CA_hasYTD && <>
          <td className={cn('py-2.5 px-3 text-right text-sm font-mono border-l border-border/40', r.captYTD > 0 ? cn('text-red-600 dark:text-red-400', bold && 'font-bold') : 'text-muted-foreground/40')}>{r.captYTD > 0 ? fmtBRL(r.captYTD) : '—'}</td>
          <td className={cn('py-2.5 px-3 text-right text-sm font-mono', r.amortYTD > 0 ? cn('text-emerald-600 dark:text-emerald-400', bold && 'font-bold') : 'text-muted-foreground/40')}>{r.amortYTD > 0 ? fmtBRL(r.amortYTD) : '—'}</td>
        </>}
      </>;
    }
    return <>
      <td className={cn('py-2.5 px-3 text-right text-sm font-mono border-l border-border/40', r.captAnual > 0 ? cn('text-red-600 dark:text-red-400', bold && 'font-bold') : 'text-muted-foreground/40')}>{r.captAnual > 0 ? fmtBRL(r.captAnual) : '—'}</td>
      <td className={cn('py-2.5 px-3 text-right text-sm font-mono', r.amortAnual > 0 ? cn('text-emerald-600 dark:text-emerald-400', bold && 'font-bold') : 'text-muted-foreground/40')}>{r.amortAnual > 0 ? fmtBRL(r.amortAnual) : '—'}</td>
    </>;
  };

  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const handlePDF = () => {
    const printSource = printRef.current;
    const root = document.getElementById('print-root');
    if (!printSource || !root) return;
    setPrinting(true);
    const clone = printSource.cloneNode(true) as HTMLElement;
    clone.style.display = 'block';
    root.innerHTML = clone.outerHTML;
    const style = document.createElement('style');
    style.id = '__endividamento-print-override__';
    style.textContent = `
      @page { size: A4 portrait; margin: 1cm; }
      body > *:not(#print-root) { display: none !important; }
      #print-root { display: block !important; font-family: Inter, system-ui, sans-serif; font-size: 10px; }
      #print-root, #print-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; forced-color-adjust: none !important; color-scheme: light !important; }
      #print-root .overflow-x-auto { overflow: visible !important; }
      #print-root table { width: 100%; border-collapse: collapse; }
      #print-root th, #print-root td { font-size: 8px !important; padding: 3px 6px !important; }
    `;
    document.head.appendChild(style);
    setPrinting(false);
    window.onafterprint = () => {
      document.head.querySelector('#__endividamento-print-override__')?.remove();
      root.innerHTML = '';
      window.onafterprint = null;
    };
    window.print();
  };

  if (showCharts) {
    return <EndividamentoCharts selectedYear={selectedYear} selectedMonth={selectedMonth} onClose={() => setShowCharts(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Botões de ação */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowCharts(true)} className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Evolução Mensal
        </Button>
        <button
          onClick={handlePDF}
          disabled={printing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-sm bg-slate-800 text-white border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>🖨️</span> {printing ? 'Preparando...' : 'Imprimir / Salvar PDF'}
        </button>
      </div>
      <div ref={printRef}>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI
          label={colAnterior}
          value={fmtBRL(totalAnt, true)}
          sub="Saldo do período anterior"
          color="blue"
          icon="🏦"
        />
        <KPI
          label={colAtual}
          value={fmtBRL(totalAtu, true)}
          sub="Saldo do período atual"
          color={totalAtu > totalAnt ? 'red' : 'emerald'}
          icon="📋"
        />
        <KPI
          label="Variação"
          value={`${varTotal >= 0 ? '+' : '-'}${fmtBRL(varTotal, true)}`}
          sub={totalAnt !== 0 ? `${varTotal >= 0 ? '+' : '-'}${Math.abs(varTotalPct!).toFixed(1)}%` : '—'}
          color={totalAtu > totalAnt ? 'red' : 'emerald'}
          icon="📊"
        />
      </div>

      {/* Tabela Unificada Endividamento Bancário */}
      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon="🏦">Endividamento Bancário</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Conta / Descrição</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAnterior}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAtual}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Variação R$</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Var %</th>
                </tr>
              </thead>
              <tbody>
                {/* Subs CP (excluindo 2.1.1.02.03.020) */}
                {cpSubsFiltered.map(a => {
                  const varR = a.atu - a.ant;
                  const varP = a.ant !== 0 ? (varR / a.ant) * 100 : null;
                  return (
                    <tr key={a.conta} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3">
                        <span className="text-xs font-mono text-muted-foreground mr-2">{a.conta}</span>
                        <span className="text-sm text-foreground">{a.desc ? toTitleCase(a.desc) : a.conta}</span>
                      </td>
                      <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">{fmtBRL(a.ant)}</td>
                      <td className="py-2 px-3 text-right text-sm font-mono font-semibold text-foreground">{fmtBRL(a.atu)}</td>
                      <td className={`py-2 px-3 text-right text-sm font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{varR >= 0 ? '+' : '-'}{fmtBRL(varR)}</td>
                      <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{varP !== null ? `${varP >= 0 ? '+' : '-'}${Math.abs(varP).toFixed(1)}%` : '—'}</td>
                    </tr>
                  );
                })}
                {/* Banco VW - Capital de Giro (2.1.1.02.03.020 CP + 2.2.1.07.01.003 LP) */}
                {(vwCapGiro.ant !== 0 || vwCapGiro.atu !== 0) && (() => {
                  const varR = vwCapGiro.atu - vwCapGiro.ant;
                  const varP = vwCapGiro.ant !== 0 ? (varR / vwCapGiro.ant) * 100 : null;
                  return (
                    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3">
                        <span className="text-xs font-mono text-muted-foreground mr-2">2.1.1.02.03.020 + 2.2.1.07.01.003</span>
                        <span className="text-sm text-foreground">Banco VW - Capital de Giro</span>
                      </td>
                      <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">{fmtBRL(vwCapGiro.ant)}</td>
                      <td className="py-2 px-3 text-right text-sm font-mono font-semibold text-foreground">{fmtBRL(vwCapGiro.atu)}</td>
                      <td className={`py-2 px-3 text-right text-sm font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{varR >= 0 ? '+' : '-'}{fmtBRL(varR)}</td>
                      <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{varP !== null ? `${varP >= 0 ? '+' : '-'}${Math.abs(varP).toFixed(1)}%` : '—'}</td>
                    </tr>
                  );
                })()}
                {/* Banco Volks Floor Plan Novos VW */}
                {(netAcc1.ant !== 0 || netAcc1.atu !== 0) && (() => {
                  const varR = netAcc1.atu - netAcc1.ant;
                  const varP = netAcc1.ant !== 0 ? (varR / netAcc1.ant) * 100 : null;
                  return (
                    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3">
                        <span className="text-xs font-mono text-muted-foreground mr-2">2.1.1.02.01.001</span>
                        <span className="text-sm text-foreground">Banco Volks Floor Plan Novos VW</span>
                      </td>
                      <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">{fmtBRL(netAcc1.ant)}</td>
                      <td className="py-2 px-3 text-right text-sm font-mono font-semibold text-foreground">{fmtBRL(netAcc1.atu)}</td>
                      <td className={`py-2 px-3 text-right text-sm font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{varR >= 0 ? '+' : '-'}{fmtBRL(varR)}</td>
                      <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{varP !== null ? `${varP >= 0 ? '+' : '-'}${Math.abs(varP).toFixed(1)}%` : '—'}</td>
                    </tr>
                  );
                })()}
                {/* Banco Volks Floor Plan Novos Audi */}
                {(netAcc2.ant !== 0 || netAcc2.atu !== 0) && (() => {
                  const varR = netAcc2.atu - netAcc2.ant;
                  const varP = netAcc2.ant !== 0 ? (varR / netAcc2.ant) * 100 : null;
                  return (
                    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3">
                        <span className="text-xs font-mono text-muted-foreground mr-2">2.1.4.01.01.007</span>
                        <span className="text-sm text-foreground">Banco Volks Floor Plan Novos Audi</span>
                      </td>
                      <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">{fmtBRL(netAcc2.ant)}</td>
                      <td className="py-2 px-3 text-right text-sm font-mono font-semibold text-foreground">{fmtBRL(netAcc2.atu)}</td>
                      <td className={`py-2 px-3 text-right text-sm font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{varR >= 0 ? '+' : '-'}{fmtBRL(varR)}</td>
                      <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{varP !== null ? `${varP >= 0 ? '+' : '-'}${Math.abs(varP).toFixed(1)}%` : '—'}</td>
                    </tr>
                  );
                })()}
                {/* Subs LP (excluindo 2.2.1.07.01.003) */}
                {lpSubsFiltered.map(a => {
                  const varR = a.atu - a.ant;
                  const varP = a.ant !== 0 ? (varR / a.ant) * 100 : null;
                  return (
                    <tr key={a.conta} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3">
                        <span className="text-xs font-mono text-muted-foreground mr-2">{a.conta}</span>
                        <span className="text-sm text-foreground">{a.desc ? toTitleCase(a.desc) : a.conta}</span>
                      </td>
                      <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">{fmtBRL(a.ant)}</td>
                      <td className="py-2 px-3 text-right text-sm font-mono font-semibold text-foreground">{fmtBRL(a.atu)}</td>
                      <td className={`py-2 px-3 text-right text-sm font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{varR >= 0 ? '+' : '-'}{fmtBRL(varR)}</td>
                      <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{varP !== null ? `${varP >= 0 ? '+' : '-'}${Math.abs(varP).toFixed(1)}%` : '—'}</td>
                    </tr>
                  );
                })}
                {/* TOTAL BANCÁRIO */}
                <tr className="bg-muted/50 font-bold">
                  <td className="py-2.5 px-3 text-sm font-bold text-foreground">TOTAL BANCÁRIO</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">{fmtBRL(totalAnt)}</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-foreground">{fmtBRL(totalAtu)}</td>
                  <td className={`py-2.5 px-3 text-right text-sm font-mono font-bold ${varTotal > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{varTotal >= 0 ? '+' : '-'}{fmtBRL(varTotal)}</td>
                  <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-muted-foreground">{varTotalPct !== null ? `${varTotalPct >= 0 ? '+' : '-'}${Math.abs(varTotalPct).toFixed(1)}%` : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Captação e Amortização Bancária */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon="⚡">Captação e Amortização Bancária</SectionTitle>
            <button
              onClick={() => setShowCaptAmort(v => !v)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-sm',
                !showCaptAmort
                  ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700'
                  : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted/70'
              )}
            >
              <span>⚡</span>
              {showCaptAmort ? 'Ocultar Tabela' : 'Mostrar Tabela'}
            </button>
          </div>
          {showCaptAmort && <>
          <p className="text-xs text-muted-foreground mb-4">
            {isMo
              ? 'Variação líquida de saldo: Captação = aumento do endividamento no período (vermelho) · Amortização = redução da dívida (verde).'
              : 'Movimentos brutos do período via balancete: Captação = total de créditos · Amortização = total de débitos (pagamentos realizados).'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/50">
                {isMo ? (
                  <>
                    <tr className="border-b border-border/40">
                      <th rowSpan={2} className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground align-bottom">Endividamento</th>
                      <th colSpan={2} className="py-2 px-3 text-center text-xs font-bold uppercase tracking-wider text-foreground border-l border-border/40">{colAtual}</th>
                      {CA_hasYTD && <th colSpan={2} className="py-2 px-3 text-center text-xs font-bold uppercase tracking-wider text-foreground border-l border-border/40">{CA_ytdLbl}</th>}
                    </tr>
                    <tr className="border-b-2 border-border">
                      <th className="py-2 px-3 text-right text-xs uppercase tracking-wider text-red-500 dark:text-red-400 border-l border-border/40">Captação</th>
                      <th className="py-2 px-3 text-right text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Amortização</th>
                      {CA_hasYTD && <>
                        <th className="py-2 px-3 text-right text-xs uppercase tracking-wider text-red-500 dark:text-red-400 border-l border-border/40">Captação</th>
                        <th className="py-2 px-3 text-right text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Amortização</th>
                      </>}
                    </tr>
                  </>
                ) : (
                  <tr className="border-b-2 border-border">
                    <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Endividamento</th>
                    <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-red-500 dark:text-red-400 border-l border-border/40 w-[20%]">Captação</th>
                    <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 w-[20%]">Amortização</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {allCAMerged
                  .filter(r => isMo
                    ? r.captMes > 0 || r.amortMes > 0 || r.captYTD > 0 || r.amortYTD > 0
                    : r.captAnual > 0 || r.amortAnual > 0
                  )
                  .map(r => (
                  <tr key={r.conta} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 text-foreground">
                      <span className="text-xs font-mono text-muted-foreground mr-2">{r.conta}</span>{r.label}
                    </td>
                    {movColsCA(r, false)}
                  </tr>
                ))}
                <tr className="bg-primary/10">
                  <td className="py-3 px-3 font-bold text-foreground">TOTAL BANCÁRIO</td>
                  {movColsCA(grandCAMerged, true)}
                </tr>
                {resultadoRowCA(grandCAMerged, 'Resultado da Amortização ou Captação Bancária', true)}
              </tbody>
            </table>
          </div>
          </>}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function MutuoSociosTab({ data, fmtBRL, SectionTitle, KPI, colAnterior, colAtual, janAccounts, selectedMonth, selectedYear }: any) {
  const [showCharts, setShowCharts] = useState(false);
  const accounts = data.accounts as Record<string, any>;
  const getAcc = (id: string) => accounts[id] || { saldoAnt: 0, saldoAtual: 0 };

  // Saldo anterior de Janeiro (igual ao padrão do Parcelamento Refis)
  const getJanAnt = (id: string): number => {
    if (selectedMonth > 1 && janAccounts) {
      const janAcc = janAccounts[id] || { saldoAnt: 0 };
      return Math.abs(janAcc.saldoAnt);
    }
    return Math.abs(getAcc(id).saldoAnt);
  };

  // Label do período de amortização
  const MSHORT = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const yr2 = String(selectedYear).slice(2);
  const amortLabel = selectedMonth === 0
    ? `Anual ${selectedYear}`
    : selectedMonth === 1
      ? `Jan/${yr2}`
      : `Jan–${MSHORT[selectedMonth]}/${yr2}`;

  // Grupo exato 2.2.1.01.01 — Mútuo Sócios
  const groupAcc = getAcc('2.2.1.01.01');
  const totalAnt = Math.abs(groupAcc.saldoAnt);
  const totalAtu = Math.abs(groupAcc.saldoAtual);
  const subs = subAccs(accounts, '2.2.1.01.01');

  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const handlePDF = () => {
    const printSource = printRef.current;
    const root = document.getElementById('print-root');
    if (!printSource || !root) return;
    setPrinting(true);
    const clone = printSource.cloneNode(true) as HTMLElement;
    clone.style.display = 'block';
    root.innerHTML = clone.outerHTML;
    const style = document.createElement('style');
    style.id = '__mutuo-socios-print-override__';
    style.textContent = `
      @page { size: A4 portrait; margin: 1cm; }
      body > *:not(#print-root) { display: none !important; }
      #print-root { display: block !important; font-family: Inter, system-ui, sans-serif; font-size: 10px; }
      #print-root, #print-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; forced-color-adjust: none !important; color-scheme: light !important; }
      #print-root .overflow-x-auto { overflow: visible !important; }
      #print-root table { width: 100%; border-collapse: collapse; }
      #print-root th, #print-root td { font-size: 8px !important; padding: 3px 6px !important; }
    `;
    document.head.appendChild(style);
    setPrinting(false);
    window.onafterprint = () => {
      document.head.querySelector('#__mutuo-socios-print-override__')?.remove();
      root.innerHTML = '';
      window.onafterprint = null;
    };
    window.print();
  };

  if (showCharts) {
    return <MutuoSociosCharts selectedYear={selectedYear} selectedMonth={selectedMonth} onClose={() => setShowCharts(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Botões de ação */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowCharts(true)} className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Evolução Mensal
        </Button>
        <button
          onClick={handlePDF}
          disabled={printing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-sm bg-slate-800 text-white border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>🖨️</span> {printing ? 'Preparando...' : 'Imprimir / Salvar PDF'}
        </button>
      </div>
      <div ref={printRef}>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI
          label={colAnterior}
          value={fmtBRL(totalAnt, true)}
          sub="Saldo do período anterior"
          color="blue"
          icon="👥"
        />
        <KPI
          label={colAtual}
          value={fmtBRL(totalAtu, true)}
          sub="Saldo do período atual"
          color={totalAtu > totalAnt ? 'red' : 'emerald'}
          icon="📋"
        />
        <KPI
          label="Variação"
          value={`${(totalAtu - totalAnt) >= 0 ? '+' : '-'}${fmtBRL(Math.abs(totalAtu - totalAnt), true)}`}
          sub={totalAnt !== 0 ? `${((totalAtu - totalAnt) / totalAnt * 100) >= 0 ? '+' : '-'}${Math.abs((totalAtu - totalAnt) / totalAnt * 100).toFixed(1)}%` : '—'}
          color={totalAtu > totalAnt ? 'red' : 'emerald'}
          icon="📊"
        />
      </div>

      {/* Tabela de sub-contas */}
      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon="👥">Mútuo Sócios — Grupo 2.2.1.01.01</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Conta / Descrição</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAnterior}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAtual}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Variação R$</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Var %</th>
                </tr>
              </thead>
              <tbody>
                {subs.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Nenhuma sub-conta encontrada em 2.2.1.01.01</td></tr>
                ) : (
                  subs.map(a => {
                    const varR = a.atu - a.ant;
                    const varP = a.ant !== 0 ? (varR / a.ant) * 100 : null;
                    return (
                      <tr key={a.conta} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3">
                          <span className="text-xs font-mono text-muted-foreground mr-2">{a.conta}</span>
                          <span className="text-sm text-foreground">{a.desc ? toTitleCase(a.desc) : a.conta}</span>
                        </td>
                        <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">{fmtBRL(a.ant)}</td>
                        <td className="py-2 px-3 text-right text-sm font-mono font-semibold text-foreground">{fmtBRL(a.atu)}</td>
                        <td className={`py-2 px-3 text-right text-sm font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                          {varR >= 0 ? '+' : '-'}{fmtBRL(varR)}
                        </td>
                        <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                          {varP !== null ? `${varP >= 0 ? '+' : '-'}${Math.abs(varP).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
                <tr className="bg-muted/50 font-bold">
                  <td className="py-2.5 px-3 text-sm font-bold text-foreground">TOTAL MÚTUO SÓCIOS</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">{fmtBRL(totalAnt)}</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-foreground">{fmtBRL(totalAtu)}</td>
                  <td className={`py-2.5 px-3 text-right text-sm font-mono font-bold ${totalAtu - totalAnt > 0 ? 'text-red-600 dark:text-red-400' : totalAtu - totalAnt < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {totalAtu - totalAnt >= 0 ? '+' : '-'}{fmtBRL(totalAtu - totalAnt)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-muted-foreground">
                    {totalAnt !== 0 ? `${((totalAtu - totalAnt) / totalAnt * 100) >= 0 ? '+' : '-'}${Math.abs((totalAtu - totalAnt) / totalAnt * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabela de Amortização ── */}
      {(() => {
        const saldoInicioAno = getJanAnt('2.2.1.01.01');
        const saldoAtual     = Math.abs(getAcc('2.2.1.01.01').saldoAtual);
        const amort          = saldoInicioAno - saldoAtual;
        const amortPct       = saldoInicioAno !== 0 ? (amort / saldoInicioAno) * 100 : null;
        return (
          <Card className="border-t-4 border-t-emerald-500">
            <CardContent className="pt-6">
              <SectionTitle icon="💳">Amortização no Período — {amortLabel} (Pagamento da Dívida)</SectionTitle>
              <p className="text-xs text-muted-foreground mb-4">
                Valor quitado desde o início do ano: <span className="font-semibold">Saldo início do ano − Saldo atual ({colAtual})</span>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Descrição</th>
                      <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Saldo Início do Ano</th>
                      <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Saldo Atual ({colAtual})</th>
                      <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Amortizado no Período</th>
                      <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">% Quitado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-emerald-50/60 dark:bg-emerald-950/20 border-t-2 border-emerald-200 dark:border-emerald-800 font-bold">
                      <td className="py-2.5 px-3 text-sm font-bold text-foreground">TOTAL MÚTUO SÓCIOS</td>
                      <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">{fmtBRL(saldoInicioAno)}</td>
                      <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-foreground">{fmtBRL(saldoAtual)}</td>
                      <td className={`py-2.5 px-3 text-right text-sm font-mono font-bold ${amort > 0 ? 'text-emerald-600 dark:text-emerald-400' : amort < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {amort > 0 ? '−' : amort < 0 ? '+' : ''}{fmtBRL(Math.abs(amort))}
                      </td>
                      <td className={`py-2.5 px-3 text-right text-xs font-mono font-bold ${amort > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {amortPct !== null ? `${amortPct.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })()}
      </div>
    </div>
  );
}

function ParcelamentoRefisTab({ data, fmtBRL, SectionTitle, KPI, colAnterior, colAtual, janAccounts, selectedMonth, selectedYear }: any) {
  const [showCharts, setShowCharts] = useState(false);
  const accounts = data.accounts as Record<string, any>;
  const getAcc = (id: string) => accounts[id] || { saldoAnt: 0, saldoAtual: 0 };

  // Saldo anterior de Janeiro: para meses > 1 usa o balancete de Jan (saldoAnt).
  // Para Janeiro e Anual usa o saldoAnt do próprio balancete importado.
  const getJanAnt = (id: string): number => {
    if (selectedMonth > 1 && janAccounts) {
      const janAcc = janAccounts[id] || { saldoAnt: 0 };
      return Math.abs(janAcc.saldoAnt);
    }
    return Math.abs(getAcc(id).saldoAnt);
  };

  // Label do período de amortização
  const MSHORT = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const yr2 = String(selectedYear).slice(2);
  const amortLabel = selectedMonth === 0
    ? `Anual ${selectedYear}`
    : selectedMonth === 1
      ? `Jan/${yr2}`
      : `Jan–${MSHORT[selectedMonth]}/${yr2}`;

  // Curto Prazo: Passivo Circulante
  const cpAcc = getAcc('2.1.2.02.07.020');
  const cpAnt = Math.abs(cpAcc.saldoAnt);
  const cpAtu = Math.abs(cpAcc.saldoAtual);
  const cpDesc = cpAcc.desc || '2.1.2.02.07.020';

  // Longo Prazo: Passivo Não Circulante
  const lpAcc = getAcc('2.2.1.08.01.020');
  const lpAnt = Math.abs(lpAcc.saldoAnt);
  const lpAtu = Math.abs(lpAcc.saldoAtual);
  const lpDesc = lpAcc.desc || '2.2.1.08.01.020';

  const totalAnt = cpAnt + lpAnt;
  const totalAtu = cpAtu + lpAtu;
  const varTotal = totalAtu - totalAnt;
  const varTotalPct = totalAnt !== 0 ? (varTotal / totalAnt) * 100 : null;

  const mergedDesc = cpDesc || lpDesc || 'Parcelamento Impostos E Contrib.federais';
  const rows = [
    { desc: mergedDesc, ant: totalAnt, atu: totalAtu },
  ];

  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const handlePDF = () => {
    const printSource = printRef.current;
    const root = document.getElementById('print-root');
    if (!printSource || !root) return;
    setPrinting(true);
    const clone = printSource.cloneNode(true) as HTMLElement;
    clone.style.display = 'block';
    root.innerHTML = clone.outerHTML;
    const style = document.createElement('style');
    style.id = '__parcelamento-refis-print-override__';
    style.textContent = `
      @page { size: A4 portrait; margin: 1cm; }
      body > *:not(#print-root) { display: none !important; }
      #print-root { display: block !important; font-family: Inter, system-ui, sans-serif; font-size: 10px; }
      #print-root, #print-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; forced-color-adjust: none !important; color-scheme: light !important; }
      #print-root .overflow-x-auto { overflow: visible !important; }
      #print-root table { width: 100%; border-collapse: collapse; }
      #print-root th, #print-root td { font-size: 8px !important; padding: 3px 6px !important; }
    `;
    document.head.appendChild(style);
    setPrinting(false);
    window.onafterprint = () => {
      document.head.querySelector('#__parcelamento-refis-print-override__')?.remove();
      root.innerHTML = '';
      window.onafterprint = null;
    };
    window.print();
  };

  if (showCharts) {
    return <ParcelamentoRefisCharts selectedYear={selectedYear} selectedMonth={selectedMonth} onClose={() => setShowCharts(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Botões de ação */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowCharts(true)} className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Evolução Mensal
        </Button>
        <button
          onClick={handlePDF}
          disabled={printing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-sm bg-slate-800 text-white border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>🖨️</span> {printing ? 'Preparando...' : 'Imprimir / Salvar PDF'}
        </button>
      </div>
      <div ref={printRef}>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI
          label={colAnterior}
          value={fmtBRL(totalAnt, true)}
          sub="Saldo do período anterior"
          color="blue"
          icon="🧾"
        />
        <KPI
          label={colAtual}
          value={fmtBRL(totalAtu, true)}
          sub="Saldo do período atual"
          color={totalAtu > totalAnt ? 'red' : 'emerald'}
          icon="📋"
        />
        <KPI
          label="Variação"
          value={`${varTotal >= 0 ? '+' : '-'}${fmtBRL(varTotal, true)}`}
          sub={varTotalPct !== null ? `${varTotalPct >= 0 ? '+' : '-'}${Math.abs(varTotalPct).toFixed(1)}%` : '—'}
          color={totalAtu > totalAnt ? 'red' : 'emerald'}
          icon="📊"
        />
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon="🧾">Parcelamento Refis — Detalhamento</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Conta / Descrição</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAnterior}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAtual}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Variação R$</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Var %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => {
                  const varR = a.atu - a.ant;
                  const varP = a.ant !== 0 ? (varR / a.ant) * 100 : null;
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3">
                        <span className="text-sm text-foreground">{a.desc ? toTitleCase(a.desc) : 'Parcelamento Refis'}</span>
                      </td>
                      <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">{fmtBRL(a.ant)}</td>
                      <td className="py-2 px-3 text-right text-sm font-mono font-semibold text-foreground">{fmtBRL(a.atu)}</td>
                      <td className={`py-2 px-3 text-right text-sm font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {varR >= 0 ? '+' : '-'}{fmtBRL(varR)}
                      </td>
                      <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {varP !== null ? `${varP >= 0 ? '+' : '-'}${Math.abs(varP).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/50 font-bold">
                  <td colSpan={1} className="py-2.5 px-3 text-sm font-bold text-foreground">TOTAL GERAL</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">{fmtBRL(totalAnt)}</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-foreground">{fmtBRL(totalAtu)}</td>
                  <td className={`py-2.5 px-3 text-right text-sm font-mono font-bold ${varTotal > 0 ? 'text-red-600 dark:text-red-400' : varTotal < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {varTotal >= 0 ? '+' : '-'}{fmtBRL(varTotal)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-muted-foreground">
                    {varTotalPct !== null ? `${varTotalPct >= 0 ? '+' : '-'}${Math.abs(varTotalPct).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabela de Amortização ── */}
      {(() => {
        const amortRows = [
          {
            id: '2.1.2.02.07.020+2.2.1.08.01.020',
            desc: mergedDesc,
            saldoInicioAno: getJanAnt('2.1.2.02.07.020') + getJanAnt('2.2.1.08.01.020'),
            saldoAtual: totalAtu,
          },
        ];
        const totalInicio = amortRows.reduce((s, r) => s + r.saldoInicioAno, 0);
        const totalAtual  = amortRows.reduce((s, r) => s + r.saldoAtual, 0);
        const totalAmort  = totalInicio - totalAtual;
        const totalAmortPct = totalInicio !== 0 ? (totalAmort / totalInicio) * 100 : null;

        return (
          <Card className="border-t-4 border-t-emerald-500">
            <CardContent className="pt-6">
              <SectionTitle icon="💳">Amortização no Período — {amortLabel} (Pagamento da Dívida)</SectionTitle>
              <p className="text-xs text-muted-foreground mb-4">
                Valor quitado desde o início do ano: <span className="font-semibold">Saldo início do ano − Saldo atual ({colAtual})</span>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Conta / Descrição</th>
                      <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Saldo Início do Ano</th>
                      <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Saldo Atual ({colAtual})</th>
                      <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Amortizado no Período</th>
                      <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">% Quitado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amortRows.map(r => {
                      const amort = r.saldoInicioAno - r.saldoAtual;
                      const pct = r.saldoInicioAno !== 0 ? (amort / r.saldoInicioAno) * 100 : null;
                      return (
                        <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3">
                            <span className="text-xs font-mono text-muted-foreground mr-2">{r.id}</span>
                            <span className="text-sm text-foreground">{r.desc ? toTitleCase(r.desc) : r.id}</span>
                          </td>
                          <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">{fmtBRL(r.saldoInicioAno)}</td>
                          <td className="py-2 px-3 text-right text-sm font-mono font-semibold text-foreground">{fmtBRL(r.saldoAtual)}</td>
                          <td className={`py-2 px-3 text-right text-sm font-mono font-semibold ${amort > 0 ? 'text-emerald-600 dark:text-emerald-400' : amort < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                            {amort > 0 ? '−' : amort < 0 ? '+' : ''}{fmtBRL(Math.abs(amort))}
                          </td>
                          <td className={`py-2 px-3 text-right text-xs font-mono ${amort > 0 ? 'text-emerald-600 dark:text-emerald-400' : amort < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                            {pct !== null ? `${pct.toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-emerald-50/60 dark:bg-emerald-950/20 border-t-2 border-emerald-200 dark:border-emerald-800 font-bold">
                      <td className="py-2.5 px-3 text-sm font-bold text-foreground">TOTAL AMORTIZADO</td>
                      <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">{fmtBRL(totalInicio)}</td>
                      <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-foreground">{fmtBRL(totalAtual)}</td>
                      <td className={`py-2.5 px-3 text-right text-sm font-mono font-bold ${totalAmort > 0 ? 'text-emerald-600 dark:text-emerald-400' : totalAmort < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {totalAmort > 0 ? '−' : totalAmort < 0 ? '+' : ''}{fmtBRL(Math.abs(totalAmort))}
                      </td>
                      <td className={`py-2.5 px-3 text-right text-xs font-mono font-bold ${totalAmort > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {totalAmortPct !== null ? `${totalAmortPct.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })()}
      </div>
    </div>
  );
}

function ImobilizadoTab({ data, fmtBRL, SectionTitle, KPI, colAnterior, colAtual, selectedMonth, selectedYear }: any) {
  const accounts = data.accounts as Record<string, any>;
  const [showCharts, setShowCharts] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  if (showCharts) {
    return <ImobilizadoCharts selectedYear={selectedYear} selectedMonth={selectedMonth} onClose={() => setShowCharts(false)} />;
  }

  // Totais do grupo 1.5.5
  const root = accounts['1.5.5'] || { saldoAnt: 0, saldoAtual: 0 };
  const totalAnt = Math.abs(root.saldoAnt);
  const totalAtu = Math.abs(root.saldoAtual);
  const varTotal = totalAtu - totalAnt;
  const varTotalPct = totalAnt !== 0 ? (varTotal / totalAnt) * 100 : null;

  // Subgrupos diretos de 1.5.5 (ex: 1.5.5.01, 1.5.5.02 ...)
  const subGroups = subAccsAtDepth(accounts, '1.5.5', 1);
  // Caso não haja subgrupos, exibe as folhas diretas
  const allLeafs = subAccs(accounts, '1.5.5');
  const groups = subGroups.length > 0
    ? subGroups.map(sg => ({ ...sg, contas: subAccs(accounts, sg.conta) }))
    : [{ conta: '1.5.5', desc: root.desc || 'Imobilizado', ant: totalAnt, atu: totalAtu, contas: allLeafs }];

  const renderGroupTable = (contas: any[]) => {
    const subTotal = contas.reduce((s, c) => ({ ant: s.ant + c.ant, atu: s.atu + c.atu }), { ant: 0, atu: 0 });
    const subVar = subTotal.atu - subTotal.ant;
    const subVarPct = subTotal.ant !== 0 ? (subVar / subTotal.ant) * 100 : null;
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-muted/50">
            <tr>
              <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Conta / Descrição</th>
              <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAnterior}</th>
              <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAtual}</th>
              <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Variação R$</th>
              <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Var %</th>
            </tr>
          </thead>
          <tbody>
            {contas.map(a => {
              const varR = a.atu - a.ant;
              const varP = a.ant !== 0 ? (varR / a.ant) * 100 : null;
              return (
                <tr key={a.conta} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-3">
                    <span className="text-xs font-mono text-muted-foreground mr-2">{a.conta}</span>
                    <span className="text-sm text-foreground">{a.desc ? toTitleCase(a.desc) : a.conta}</span>
                  </td>
                  <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">{fmtBRL(a.ant)}</td>
                  <td className="py-2 px-3 text-right text-sm font-mono font-semibold text-foreground">{fmtBRL(a.atu)}</td>
                  <td className={`py-2 px-3 text-right text-sm font-mono ${varR > 0 ? 'text-emerald-600 dark:text-emerald-400' : varR < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    {varR >= 0 ? '+' : '-'}{fmtBRL(varR)}
                  </td>
                  <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-emerald-600 dark:text-emerald-400' : varR < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    {varP !== null ? `${varP >= 0 ? '+' : '-'}${Math.abs(varP).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-muted/50 font-bold">
              <td className="py-2.5 px-3 text-sm font-bold text-foreground">Subtotal</td>
              <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">{fmtBRL(subTotal.ant)}</td>
              <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-foreground">{fmtBRL(subTotal.atu)}</td>
              <td className={`py-2.5 px-3 text-right text-sm font-mono font-bold ${subVar > 0 ? 'text-emerald-600 dark:text-emerald-400' : subVar < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                {subVar >= 0 ? '+' : '-'}{fmtBRL(subVar)}
              </td>
              <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-muted-foreground">
                {subVarPct !== null ? `${subVarPct >= 0 ? '+' : '-'}${Math.abs(subVarPct).toFixed(1)}%` : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Botões de ação */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setShowCharts(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-sm bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-900/50"
        >
          <span>📈</span> Evolução Mensal
        </button>
        <button
          onClick={() => {
            const printSource = printRef.current;
            const root = document.getElementById('print-root');
            if (!printSource || !root) return;
            setPrinting(true);
            const clone = printSource.cloneNode(true) as HTMLElement;
            clone.style.display = 'block';
            root.innerHTML = clone.outerHTML;
            const style = document.createElement('style');
            style.id = '__imobilizado-print-override__';
            style.textContent = `
              @page { size: A4 portrait; margin: 1cm; }
              body > *:not(#print-root) { display: none !important; }
              #print-root {
                display: block !important;
                font-family: Inter, system-ui, sans-serif;
                font-size: 10px;
              }
              #print-root, #print-root * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                forced-color-adjust: none !important;
                color-scheme: light !important;
              }
              #print-root .overflow-x-auto { overflow: visible !important; }
              #print-root table { width: 100%; border-collapse: collapse; }
              #print-root th, #print-root td { font-size: 8px !important; padding: 3px 6px !important; }
            `;
            document.head.appendChild(style);
            setPrinting(false);
            window.onafterprint = () => {
              document.head.querySelector('#__imobilizado-print-override__')?.remove();
              root.innerHTML = '';
              window.onafterprint = null;
            };
            window.print();
          }}
          disabled={printing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-sm bg-slate-800 text-white border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>🖨️</span> {printing ? 'Preparando...' : 'Imprimir / Salvar PDF'}
        </button>
      </div>
      <div ref={printRef}>

      {/* KPI Total */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI
          label={colAnterior}
          value={fmtBRL(totalAnt, true)}
          sub="Saldo do período anterior"
          color="blue"
          icon="🏗️"
        />
        <KPI
          label={colAtual}
          value={fmtBRL(totalAtu, true)}
          sub="Saldo do período atual"
          color={totalAtu > totalAnt ? 'emerald' : 'red'}
          icon="🏭"
        />
        <KPI
          label="Variação"
          value={`${varTotal >= 0 ? '+' : '-'}${fmtBRL(varTotal, true)}`}
          sub={varTotalPct !== null ? `${varTotalPct >= 0 ? '+' : ''}${varTotalPct.toFixed(1)}%` : '—'}
          color={varTotal >= 0 ? 'emerald' : 'red'}
          icon="📈"
        />
      </div>

      {/* Tabelas por subgrupo */}
      {groups.map(g => (
        <Card key={g.conta}>
          <CardContent className="pt-6">
            <SectionTitle icon="🏗️">
              {g.desc ? toTitleCase(g.desc) : g.conta} ({g.conta})
            </SectionTitle>
            {g.contas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem movimentação neste período.</p>
            ) : (
              renderGroupTable(g.contas)
            )}
          </CardContent>
        </Card>
      ))}

      {/* Total Geral */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="bg-muted/70">
                <td className="py-2.5 px-3 text-sm font-bold text-foreground">TOTAL IMOBILIZADO (1.5.5)</td>
                <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">{fmtBRL(totalAnt)}</td>
                <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-foreground">{fmtBRL(totalAtu)}</td>
                <td className={`py-2.5 px-3 text-right text-sm font-mono font-bold ${varTotal > 0 ? 'text-emerald-600 dark:text-emerald-400' : varTotal < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                  {varTotal >= 0 ? '+' : '-'}{fmtBRL(varTotal)}
                </td>
                <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-muted-foreground">
                  {varTotalPct !== null ? `${varTotalPct >= 0 ? '+' : '-'}${Math.abs(varTotalPct).toFixed(1)}%` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      </div>
    </div>
  );
}

function OverviewTab({ data, fmtBRL, KPI, BarGauge, SectionTitle }: any) {
  const d = data;
  const varAtivo = d.ativo.total.atu - d.ativo.total.ant;
  const varCaixa = d.disponib.atu - d.disponib.ant;
  const estoqueTotalAtu = d.estoques.atu + (d.estAudi?.atu ?? 0);
  const estoqueTotalAnt = d.estoques.ant + (d.estAudi?.ant ?? 0);
  const varEstoque = estoqueTotalAtu - estoqueTotalAnt;
  const varPass = d.passivo.circ.atu - d.passivo.circ.ant;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <KPI label="Total do Ativo" value={fmtBRL(d.ativo.total.atu, true)} sub={`Ant: ${fmtBRL(d.ativo.total.ant, true)} | Var: ${fmtBRL(varAtivo, true)}`} color="emerald" icon="📊" />
        <KPI label="Disponibilidades" value={fmtBRL(d.disponib.atu, true)} sub={`Variação: ${varCaixa >= 0 ? '+' : ''}${fmtBRL(varCaixa, true)}`} color={varCaixa >= 0 ? "emerald" : "red"} icon="💵" />
        <KPI label="Estoques" value={fmtBRL(estoqueTotalAtu, true)} sub={`Variação: ${fmtBRL(varEstoque, true)}`} color={varEstoque <= 0 ? "amber" : "red"} icon="🚗" />
        <KPI label="Pass. Circulante" value={fmtBRL(d.passivo.circ.atu, true)} sub={`Variação: ${fmtBRL(varPass, true)}`} color={varPass <= 0 ? "emerald" : "red"} icon="🏦" />
        <KPI label="Patrimônio Líquido" value={fmtBRL(d.PL.atu, true)} sub="Sem variação no período" color="violet" icon="💼" />
        <KPI
          label="Fluxo de Caixa Total"
          value={
            <span className={d.dfc.fluxoTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
              {d.dfc.fluxoTotal >= 0 ? '+' : '−'}{fmtBRL(Math.abs(d.dfc.fluxoTotal), true)}
            </span>
          }
          sub={`Var. real: ${fmtBRL(d.dfc.varCaixaReal, true)}`}
          color={d.dfc.fluxoTotal >= 0 ? "emerald" : "red"}
          icon="💰"
          tooltip={`Fluxo Operacional:  ${d.dfc.fluxoOper >= 0 ? '+' : '–'} ${fmtBRL(Math.abs(d.dfc.fluxoOper))}
Fluxo de Investimento:  ${d.dfc.fluxoInvest >= 0 ? '+' : '–'} ${fmtBRL(Math.abs(d.dfc.fluxoInvest))}
Fluxo de Financiamento:  ${d.dfc.fluxoFinanc >= 0 ? '+' : '–'} ${fmtBRL(Math.abs(d.dfc.fluxoFinanc))}
────────────────────────────
Total:  ${d.dfc.fluxoTotal >= 0 ? '+' : '–'} ${fmtBRL(Math.abs(d.dfc.fluxoTotal))}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <Card>
          <CardContent className="pt-6">
            <SectionTitle icon="📦">Composição do Ativo</SectionTitle>
            <BarGauge label="Ativo Circulante" value={d.ativo.circ.atu} max={d.ativo.total.atu} color="emerald" />
            <BarGauge label="  ↳ Disponibilidades" value={d.disponib.atu} max={d.ativo.total.atu} color="emerald" />
            <BarGauge label="  ↳ Estoque VW" value={d.estoques.atu} max={d.ativo.total.atu} color="violet" />
            <BarGauge label="  ↳ Estoque Audi" value={d.estAudi.atu} max={d.ativo.total.atu} color="violet" />
            <BarGauge label="  ↳ Créditos" value={d.creditos.atu} max={d.ativo.total.atu} color="amber" />
            <BarGauge label="  ↳ Contas Correntes" value={d.contasCorr.atu} max={d.ativo.total.atu} color="blue" />
            <BarGauge label="  ↳ Valores Diversos" value={d.valDiversos.atu} max={d.ativo.total.atu} color="orange" />
            <BarGauge label="  ↳ Despesas Antecipadas" value={d.despAntec.atu} max={d.ativo.total.atu} color="pink" />
            <BarGauge label="Ativo Não Circulante" value={d.ativo.naoCirc.atu} max={d.ativo.total.atu} color="red" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <SectionTitle icon="🏦">Composição do Passivo</SectionTitle>
            <BarGauge label="Pass. Circulante" value={d.passivo.circ.atu} max={d.ativo.total.atu} color="red" />
            <BarGauge label="  ↳ Empréstimos e Fornecedores" value={d.emprestCP.atu + d.fornecVW.atu} max={d.ativo.total.atu} color="red" />
            <BarGauge label="  ↳ Obrigações Trabalhistas" value={d.obrigTrab.atu} max={d.ativo.total.atu} color="orange" />
            <BarGauge label="  ↳ Obrigações Tributárias" value={d.obrigTrib.atu} max={d.ativo.total.atu} color="amber" />
            <BarGauge label="  ↳ Contas a Pagar" value={d.contasPagar.atu} max={d.ativo.total.atu} color="red" />
            <BarGauge label="  ↳ Fornecedores Audi" value={d.fornecAudi.atu} max={d.ativo.total.atu} color="violet" />
            <BarGauge label="Pass. Não Circulante" value={d.passivo.naoCirc.atu} max={d.ativo.total.atu} color="amber" />
            <BarGauge label="Patrimônio Líquido" value={d.PL.atu} max={d.ativo.total.atu} color="emerald" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon="⚠️">Pontos de Atenção</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { tipo: 'bad', icon: '🔴', msg: `Liquidez imediata muito baixa: ${(d.indicadores.liqImediata * 100).toFixed(1)}% do PC coberto por disponibilidades` },
              { tipo: data.indicadores.liqCorrente >= 1 ? 'ok' : 'bad', icon: data.indicadores.liqCorrente >= 1 ? '🟢' : '🔴', msg: `Liquidez corrente: ${d.indicadores.liqCorrente.toFixed(2)}x ${d.indicadores.liqCorrente >= 1 ? '(adequado)' : '(abaixo de 1,0 — atenção)'}` },
              { tipo: 'bad', icon: '🔴', msg: `Alta alavancagem: endividamento total de ${(d.indicadores.endivTotal * 100).toFixed(0)}% sobre o ativo` },
              { tipo: d.estoques.atu < d.estoques.ant ? 'ok' : 'warn', icon: d.estoques.atu < d.estoques.ant ? '🟢' : '🟡', msg: `Estoques ${d.estoques.atu < d.estoques.ant ? 'reduziram — bom giro comercial no período' : 'aumentaram no período'}` },
              { tipo: 'ok', icon: '🟢', msg: `Fluxo de caixa operacional: ${fmtBRL(d.dfc.fluxoOper, true)} — desgiro de estoques e créditos` },
              { tipo: d.emprestCP.atu < d.emprestCP.ant ? 'ok' : 'warn', icon: d.emprestCP.atu < d.emprestCP.ant ? '🟢' : '🟡', msg: `Empréstimos CP ${d.emprestCP.atu < d.emprestCP.ant ? 'reduziram — amortização no período' : 'aumentaram no período'}` },
            ].map((a, i) => (
              <div key={i} className="bg-muted/30 rounded-lg p-3.5 text-sm text-muted-foreground leading-relaxed flex gap-2.5">
                <span>{a.icon}</span><span>{a.msg}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AtivoTab({ data, SectionTitle, TableRow2, colAnterior, colAtual, selectedMonth, selectedYear }: any) {
  const [showCharts, setShowCharts] = useState(false);
  const d = data;
  const accounts = d.accounts as Record<string, any>;
  const sa = (prefix: string) => subAccs(accounts, prefix);

  if (showCharts) {
    return <AtivoCharts selectedYear={selectedYear} selectedMonth={selectedMonth} onClose={() => setShowCharts(false)} />;
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setShowCharts(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Evolução Mensal
        </button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon="📦">Detalhamento do Ativo</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted/50"><tr>
                <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Conta</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAnterior}</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAtual}</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Var %</th>
              </tr></thead>
            <tbody>
              <TableRow2 label="ATIVO CIRCULANTE" ant={d.ativo.circ.ant} atu={d.ativo.circ.atu} highlight />
              <TableRow2 label="Disponibilidades" ant={d.disponib.ant} atu={d.disponib.atu} indent={1} />
              {sa('1.1.1').map(a => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}
              <TableRow2 label="Estoques VW" ant={d.estoques.ant} atu={d.estoques.atu} indent={1} />
              {sa('1.1.2').map(a => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}
              <TableRow2 label="Estoques Audi" ant={d.estAudi.ant} atu={d.estAudi.atu} indent={1} />
              {sa('1.1.7.02').map(a => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}
              <TableRow2 label="Créditos" ant={d.creditos.ant} atu={d.creditos.atu} indent={1} />
              {sa('1.1.3').map(a => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}
              <TableRow2 label="Contas Correntes" ant={d.contasCorr.ant} atu={d.contasCorr.atu} indent={1} />
              {sa('1.1.4').map(a => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}
              <TableRow2 label="Valores Diversos" ant={d.valDiversos.ant} atu={d.valDiversos.atu} indent={1} />
              {sa('1.1.5').map(a => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}
              <TableRow2 label="Despesas Antecipadas" ant={d.despAntec.ant} atu={d.despAntec.atu} indent={1} />
              {sa('1.1.6').map(a => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}
              <TableRow2 label="ATIVO NÃO CIRCULANTE" ant={d.ativo.naoCirc.ant} atu={d.ativo.naoCirc.atu} highlight />
              {d.realizLP.ant !== 0 || d.realizLP.atu !== 0 ? <><TableRow2 label="Realizável a Longo Prazo" ant={d.realizLP.ant} atu={d.realizLP.atu} indent={1} />{sa('1.5.1').map(a => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}</> : null}
              {d.investimentos.ant !== 0 || d.investimentos.atu !== 0 ? <><TableRow2 label="Investimentos" ant={d.investimentos.ant} atu={d.investimentos.atu} indent={1} />{sa('1.5.3').map(a => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}</> : null}
              {d.imobiliz.ant !== 0 || d.imobiliz.atu !== 0 ? <><TableRow2 label="Imobilizado" ant={d.imobiliz.ant} atu={d.imobiliz.atu} indent={1} />{sa('1.5.5').map(a => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}</> : null}
              {d.intangivel.ant !== 0 || d.intangivel.atu !== 0 ? <><TableRow2 label="Intangível" ant={d.intangivel.ant} atu={d.intangivel.atu} indent={1} />{sa('1.5.7').map(a => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}</> : null}
              <TableRow2 label="TOTAL DO ATIVO" ant={d.ativo.total.ant} atu={d.ativo.total.atu} highlight />
            </tbody>
          </table>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PassivoTab({ data, SectionTitle, TableRow2, colAnterior, colAtual, selectedMonth, selectedYear }: any) {
  const [showCharts, setShowCharts] = useState(false);
  const d = data;
  const accounts = d.accounts as Record<string, any>;
  const sa = (prefix: string) => subAccs(accounts, prefix);

  if (showCharts) {
    return <PassivoCharts selectedYear={selectedYear} selectedMonth={selectedMonth} onClose={() => setShowCharts(false)} />;
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setShowCharts(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Evolução Mensal
        </button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon="🏦">Detalhamento do Passivo e PL</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted/50"><tr>
                <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Conta</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAnterior}</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAtual}</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Var %</th>
              </tr></thead>
            <tbody>
              <TableRow2 label="PASSIVO CIRCULANTE" ant={d.passivo.circ.ant} atu={d.passivo.circ.atu} highlight />
              <TableRow2 label="Empréstimos e Fornecedores" ant={d.emprestCP.ant} atu={d.emprestCP.atu} indent={1} />
              {sa('2.1.1').map((a) => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}
              <TableRow2 label="Obrigações Trabalhistas" ant={d.obrigTrab.ant} atu={d.obrigTrab.atu} indent={1} />
              {sa('2.1.2.01').map((a) => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}
              <TableRow2 label="Obrigações Tributárias" ant={d.obrigTrib.ant} atu={d.obrigTrib.atu} indent={1} />
              {sa('2.1.2.02').map((a) => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}
              <TableRow2 label="Contas a Pagar" ant={d.contasPagar.ant} atu={d.contasPagar.atu} indent={1} />
              {sa('2.1.2.03').map((a) => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}
              <TableRow2 label="Fornecedores VW" ant={d.fornecVW.ant} atu={d.fornecVW.atu} indent={1} />
              {sa('2.1.3').map((a) => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}
              <TableRow2 label="Fornecedores Audi" ant={d.fornecAudi.ant} atu={d.fornecAudi.atu} indent={1} />
              {sa('2.1.4').map((a) => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}
              <TableRow2 label="PASSIVO NÃO CIRCULANTE" ant={d.passivo.naoCirc.ant} atu={d.passivo.naoCirc.atu} highlight />
              {d.emprestLP.ant !== 0 || d.emprestLP.atu !== 0 ? <TableRow2 label="Empréstimos Bancários LP" ant={d.emprestLP.ant} atu={d.emprestLP.atu} indent={1} /> : null}
              {d.pessoasLig.ant !== 0 || d.pessoasLig.atu !== 0 ? <TableRow2 label="Sócios / Pessoas Ligadas" ant={d.pessoasLig.ant} atu={d.pessoasLig.atu} indent={1} /> : null}
              {d.debitosLig.ant !== 0 || d.debitosLig.atu !== 0 ? <TableRow2 label="Débitos com Ligadas" ant={d.debitosLig.ant} atu={d.debitosLig.atu} indent={1} /> : null}
              {d.arrendLP.ant !== 0 || d.arrendLP.atu !== 0 ? <TableRow2 label="Arrendamentos LP" ant={d.arrendLP.ant} atu={d.arrendLP.atu} indent={1} /> : null}
              {d.outrosPassLP.ant !== 0 || d.outrosPassLP.atu !== 0 ? <TableRow2 label="Outros Passivos LP" ant={d.outrosPassLP.ant} atu={d.outrosPassLP.atu} indent={1} /> : null}
              <TableRow2 label="PATRIMÔNIO LÍQUIDO" ant={d.PL.ant} atu={d.PL.atu} highlight />
              {sa('2.3').filter(a => a.conta !== '2.3.3' && !a.conta.startsWith('2.3.3.')).map((a) => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={1} />)}
              {(() => { const subs233 = subAccsAtDepth(accounts, '2.3.3', 2); const hasHeader = d.resultAcum.ant !== 0 || d.resultAcum.atu !== 0 || subs233.length > 0; const antTotal = d.resultAcum.ant || subs233.reduce((s, a) => s + a.ant, 0); const atuTotal = d.resultAcum.atu || subs233.reduce((s, a) => s + a.atu, 0); return hasHeader ? <><TableRow2 label="Resultados Acumulados" ant={antTotal} atu={atuTotal} indent={1} />{subs233.map((a) => <TableRow2 key={a.conta} label={toTitleCase(a.desc || a.conta)} ant={a.ant} atu={a.atu} indent={2} />)}</> : null; })()}
              <TableRow2 label="TOTAL PASSIVO + PL" ant={d.ativo.total.ant} atu={d.ativo.total.atu} highlight />
            </tbody>
          </table>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultadoTab({ fmtBRL, SectionTitle, colAtual, selectedMonth, selectedYear }: any) {
  const [showCharts, setShowCharts] = useState(false);
  const [cadastroDre, setCadastroDre] = useState<Awaited<ReturnType<typeof loadCadastroDemonstracoes>> | null>(null);
  const [dadosDre, setDadosDre] = useState<DadosDemonstracoes | null>(null);
  const [erroDre, setErroDre] = useState('');
  const [carregandoDre, setCarregandoDre] = useState(true);
  const isMonthly = selectedMonth > 0;
  const isAnual = selectedMonth === 0;
  const MONTH_SHORT: Record<number, string> = {
    1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
    7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
  };
  const shortYear = String(selectedYear).slice(-2);
  const headerMes = colAtual;
  const headerAcu = isMonthly ? `Jan – ${MONTH_SHORT[selectedMonth]}/${shortYear}` : colAtual;

  const [valoresDre, setValoresDre] = useState<{
    mes: Map<string, number | null> | null;
    acumulado: Map<string, number | null> | null;
    anual: Map<string, number | null> | null;
    anterior: Map<string, number | null> | null;
  } | null>(null);

  useEffect(() => {
    let ativo = true;
    const principal = { ano: selectedYear, mes: selectedMonth };
    const comparacoes: PeriodoDemonstracao[] = selectedMonth === 0
      ? [{ ano: selectedYear, mes: 0 }, { ano: selectedYear - 1, mes: 0 }]
      : [{ ano: selectedYear, mes: selectedMonth }];
    setCarregandoDre(true);
    setErroDre('');
    setCadastroDre(null);
    setDadosDre(null);
    setValoresDre(null);

    Promise.all([
      loadCadastroDemonstracoes(),
      loadDadosDemonstracoes(principal, comparacoes, 'dre', selectedMonth > 0),
    ]).then(([cadastro, dados]) => {
      if (!ativo) return;
      setCadastroDre(cadastro);
      setDadosDre(dados);
    }).catch(error => {
      if (!ativo) return;
      setErroDre(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (ativo) setCarregandoDre(false);
    });

    return () => { ativo = false; };
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (!cadastroDre || !dadosDre) return;
    const calcularPeriodo = (periodos: PeriodoDemonstracao[]) => calcularLinhas(
      cadastroDre.linhas,
      'dre',
      periodos.map(periodo => dadosDre[chavePeriodo(periodo)] ?? null),
    );
    if (selectedMonth === 0) {
      setValoresDre({
        mes: null,
        acumulado: null,
        anual: calcularPeriodo([{ ano: selectedYear, mes: 0 }]),
        anterior: calcularPeriodo([{ ano: selectedYear - 1, mes: 0 }]),
      });
      return;
    }
    setValoresDre({
      mes: calcularPeriodo([{ ano: selectedYear, mes: selectedMonth }]),
      acumulado: calcularPeriodo(Array.from({ length: selectedMonth }, (_, index) => ({ ano: selectedYear, mes: index + 1 }))),
      anual: null,
      anterior: null,
    });
  }, [cadastroDre, dadosDre, selectedMonth, selectedYear]);

  const linhaReceitaBruta = cadastroDre
    ? encontrarLinhaDrePorNomes(cadastroDre.linhas, ['Receita Bruta de Vendas', 'Receita Bruta'])
    : undefined;
  const linhaReceitaLiquida = cadastroDre ? encontrarLinhaBasePercentualDre(cadastroDre.linhas) : undefined;
  const linhaLucroBruto = cadastroDre
    ? encontrarLinhaDrePorNomes(cadastroDre.linhas, ['Lucro (Prejuízo) Bruto', 'Lucro Bruto'])
    : undefined;
  const linhaResultadoLiquido = cadastroDre
    ? encontrarLinhaDrePorNomes(cadastroDre.linhas, [
      'Resultado Líquido do Exercício', 'Resultado Líquido', 'Lucro Líquido do Exercício', 'Lucro Líquido',
    ])
    : undefined;
  const valorDaLinha = (valores: Map<string, number | null> | null, linha?: LinhaDemonstracao) =>
    valores && linha ? valores.get(linha.id) ?? null : null;
  const valoresCartoes = [
    { linha: linhaReceitaBruta, label: 'Receita Bruta', icon: '💼' },
    { linha: linhaReceitaLiquida, label: 'Receita Líquida', icon: '📊' },
    { linha: linhaLucroBruto, label: 'Lucro / Prej. Bruto', icon: '📦' },
    { linha: linhaResultadoLiquido, label: 'Resultado Líquido', icon: '🏆' },
  ].map(cartao => ({
    ...cartao,
    mes: valorDaLinha(valoresDre?.mes ?? null, cartao.linha),
    acu: valorDaLinha(isMonthly ? valoresDre?.acumulado ?? null : valoresDre?.anual ?? null, cartao.linha),
    prev: valorDaLinha(valoresDre?.anterior ?? null, cartao.linha),
  }));
  const linhasVisiveis = cadastroDre ? listarLinhasDre(cadastroDre.linhas) : [];
  const ultimaLinhaTotalId = [...linhasVisiveis].reverse().find(({ linha }) => linha.tipo === 'total')?.linha.id;
  const rows = linhasVisiveis.map(({ linha, recuo }, index) => ({
    id: linha.id,
    label: linha.nome,
    valueMes: valorDaLinha(valoresDre?.mes ?? null, linha),
    valueAcu: valorDaLinha(isMonthly ? valoresDre?.acumulado ?? null : valoresDre?.anual ?? null, linha),
    valuePrev: valorDaLinha(valoresDre?.anterior ?? null, linha),
    recuo,
    type: linha.tipo === 'total'
      ? linha.id === linhaResultadoLiquido?.id || linha.id === ultimaLinhaTotalId ? 'total' : 'subtotal'
      : recuo ? 'sub' : index === 0 ? 'header' : 'group',
  }));
  const hasPrevYear = isAnual && Boolean(dadosDre?.[chavePeriodo({ ano: selectedYear - 1, mes: 0 })]);
  const renderCell = (val: number | null, important: boolean) => ({
    text: val === null ? '—' : val >= 0 ? fmtBRL(val) : `(${fmtBRL(Math.abs(val))})`,
    color: val === null
      ? 'text-muted-foreground'
      : important
        ? (val >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')
        : (val >= 0 ? 'text-foreground/80' : 'text-red-600 dark:text-red-400'),
  });
  const corKpi = (valor: number | null) => valor === null
    ? 'text-muted-foreground'
    : valor >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  const textoKpi = (valor: number | null, indice: number) => valor === null
    ? '—'
    : `${indice >= 2 && valor > 0 ? '+' : indice >= 2 && valor < 0 ? '−' : ''}${fmtBRL(valor, true)}`;

  if (showCharts) {
    return <ResultadoCharts selectedYear={selectedYear} selectedMonth={selectedMonth} onClose={() => setShowCharts(false)} />;
  }

  return (
    <div>
      {erroDre && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erroDre}</p>}
      {!erroDre && carregandoDre && <p role="status" className="mb-4 text-sm text-muted-foreground">Carregando DRE cadastrada...</p>}
      {!erroDre && !carregandoDre && linhasVisiveis.length === 0 && <p role="status" className="mb-4 text-sm text-amber-800">Nenhuma linha DRE cadastrada na Emissão de Demonstrações Financeiras.</p>}
      {/* Botão Evolução Mensal */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowCharts(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-sm bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-900/50"
        >
          <span>📈</span> Evolução Mensal
        </button>
      </div>
      {/* KPIs — duplo quando mensal, comparativo quando anual com ano anterior */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {valoresCartoes.map((kpi, i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {kpi.icon} {kpi.label}
              </div>
              {isMonthly ? (
                <div className="space-y-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-foreground mb-0.5">{headerMes}</div>
                    <div className={cn('text-lg font-bold', corKpi(kpi.mes))}>
                      {textoKpi(kpi.mes, i)}
                    </div>
                  </div>
                  <div className="border-t border-border/50 pt-2">
                    <div className="text-[10px] uppercase tracking-wider text-foreground mb-0.5">{headerAcu}</div>
                    <div className={cn('text-xl font-bold', corKpi(kpi.acu))}>
                      {textoKpi(kpi.acu, i)}
                    </div>
                  </div>
                </div>
              ) : hasPrevYear ? (
                <div className="space-y-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{selectedYear - 1}</div>
                    <div className="text-base font-semibold text-muted-foreground">
                      {textoKpi(kpi.prev, i)}
                    </div>
                  </div>
                  <div className="border-t border-border/50 pt-2">
                    <div className="text-[10px] uppercase tracking-wider text-foreground mb-0.5">{selectedYear}</div>
                    <div className={cn('text-xl font-bold', corKpi(kpi.acu))}>
                      {textoKpi(kpi.acu, i)}
                    </div>
                  </div>
                  {(() => {
                    const varV = kpi.acu === null || kpi.prev === null ? null : kpi.acu - kpi.prev;
                    const varP = varV !== null && kpi.prev !== null && kpi.prev !== 0
                      ? (varV / Math.abs(kpi.prev)) * 100
                      : null;
                    return (
                      <div className="border-t border-border/50 pt-1">
                        <span className={cn('text-xs font-semibold', varV === null ? 'text-muted-foreground' : varV >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                          {varV === null ? '—' : `${varV >= 0 ? '+' : ''}${fmtBRL(varV, true)}`}
                          {varP !== null && <span className="ml-1 text-[10px]">({varP >= 0 ? '+' : ''}{varP.toFixed(1)}%)</span>}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className={cn('text-2xl font-bold', corKpi(kpi.acu))}>
                  {textoKpi(kpi.acu, i)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela DRE */}
      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon="📈">DRE — Demonstração do Resultado do Exercício</SectionTitle>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-border bg-muted/30">
                <th className="py-2.5 px-4 text-left text-xs uppercase tracking-wider text-muted-foreground">Descrição</th>
                {isMonthly && (
                  <th className="py-2.5 px-4 text-right text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 w-[22%]">
                    {headerMes}
                  </th>
                )}
                {hasPrevYear && (
                  <th className="py-2.5 px-4 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground w-[16%]">
                    {selectedYear - 1}
                  </th>
                )}
                <th className={cn(
                  'py-2.5 px-4 text-right text-xs font-bold uppercase tracking-wider',
                  hasPrevYear ? 'w-[16%] text-foreground' : 'w-[22%]',
                  isMonthly ? 'text-emerald-600 dark:text-emerald-400' : (!hasPrevYear && 'text-muted-foreground'),
                )}>
                  {hasPrevYear ? String(selectedYear) : headerAcu}
                </th>
                {hasPrevYear && (
                  <>
                    <th className="py-2.5 px-4 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground w-[14%]">
                      Variação R$
                    </th>
                    <th className="py-2.5 px-4 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground w-[10%]">
                      Var %
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const important = r.type !== 'sub';
                const isHeader  = r.type === 'header';
                const isSub     = r.type === 'subtotal';
                const isTotal   = r.type === 'total';
                const isGroup   = r.type === 'group';
                const mesCell   = renderCell(r.valueMes, important);
                const acuCell   = renderCell(r.valueAcu, important);
                const prevCell  = renderCell(r.valuePrev, important);
                const varV      = r.valueAcu === null || r.valuePrev === null ? null : r.valueAcu - r.valuePrev;
                const varP      = varV !== null && r.valuePrev !== null && r.valuePrev !== 0
                  ? (varV / Math.abs(r.valuePrev)) * 100
                  : null;
                const varColor  = varV === null || varV === 0
                  ? 'text-muted-foreground'
                  : varV > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
                return (
                  <tr key={r.id} className={cn(
                    'border-b border-border',
                    isHeader && 'bg-emerald-50/50 dark:bg-emerald-950/20',
                    isSub    && 'bg-muted/30',
                    isTotal  && 'bg-primary/10',
                    isGroup  && 'bg-amber-50/40 dark:bg-amber-950/20',
                  )}>
                    <td className={cn('py-3 px-4 text-sm', important ? 'font-bold text-foreground' : 'text-muted-foreground')}>
                      <span className={r.recuo ? 'ml-5' : undefined}>{r.label}</span>
                    </td>
                    {isMonthly && (
                      <td className={cn('py-3 px-4 text-right text-sm font-mono tabular-nums', important ? 'font-bold' : '', mesCell.color)}>
                        {mesCell.text}
                      </td>
                    )}
                    {hasPrevYear && (
                      <td className={cn('py-3 px-4 text-right text-sm font-mono tabular-nums', important ? 'font-bold' : '', prevCell.color)}>
                        {prevCell.text}
                      </td>
                    )}
                    <td className={cn('py-3 px-4 text-right text-sm font-mono tabular-nums', important ? 'font-bold' : '', acuCell.color)}>
                      {acuCell.text}
                    </td>
                    {hasPrevYear && (
                      <>
                        <td className={cn('py-3 px-4 text-right text-sm font-mono tabular-nums', important ? 'font-bold' : '', varColor)}>
                          {varV === null ? '—' : varV > 0 ? `+${fmtBRL(varV)}` : varV < 0 ? `(${fmtBRL(Math.abs(varV))})` : '—'}
                        </td>
                        <td className={cn('py-3 px-4 text-right text-xs font-mono tabular-nums', important ? 'font-semibold' : '', varColor)}>
                          {varP !== null ? `${varP >= 0 ? '+' : ''}${varP.toFixed(1)}%` : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {!carregandoDre && !erroDre && rows.length === 0 && <tr>
                <td colSpan={1 + Number(isMonthly) + 1 + (hasPrevYear ? 3 : 0)} className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma linha DRE cadastrada para exibição.
                </td>
              </tr>}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted-foreground/70 leading-relaxed">
            {isMonthly
              ? `* Mês (${headerMes}) e acumulado (${headerAcu}) calculados pelas mesmas linhas e critérios da DRE em Emissão de Demonstrações Financeiras.`
              : hasPrevYear
                ? `* Comparativo ${selectedYear - 1} vs ${selectedYear} calculado pelas mesmas linhas da DRE em Emissão de Demonstrações Financeiras.`
                : '* Valores calculados pelas linhas cadastradas em Emissão de Demonstrações Financeiras.'
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CaixaTab({ fmtBRL, SectionTitle, colAtual, selectedMonth, selectedYear }: any) {
  return <CaixaDfcTab method="indireto" title="FC Indireto" fmtBRL={fmtBRL} SectionTitle={SectionTitle} colAtual={colAtual} selectedMonth={selectedMonth} selectedYear={selectedYear} />;
}

// ─── FLUXO DE CAIXA DIRETO ──────────────────────────────────────────────────
function CaixaDiretoTab({ fmtBRL, SectionTitle, colAtual, selectedMonth, selectedYear }: any) {
  return <CaixaDfcTab method="direto" title="FC Direto" fmtBRL={fmtBRL} SectionTitle={SectionTitle} colAtual={colAtual} selectedMonth={selectedMonth} selectedYear={selectedYear} />;
}

// ─── DIAGNÓSTICO DE GERAÇÃO DE CAIXA ────────────────────────────────────────
function DiagnosticoTab({ fmtBRL, SectionTitle, selectedMonth, selectedYear }: any) {
  const [calculation, setCalculation] = useState<{
    valores: Map<string, number | null>;
    variacaoReal: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let active = true;
    const principal = { ano: selectedYear, mes: selectedMonth };
    setLoading(true);
    setErro('');
    setCalculation(null);

    Promise.all([
      loadCadastroDemonstracoes(),
      loadDadosDemonstracoes(principal, [principal], 'dfc', selectedMonth > 0),
    ]).then(([cadastro, dados]) => {
      if (!active) return;
      const periodos = [dados[chavePeriodo(principal)] ?? null];
      const indirect = calcularDfcIndireto(
        cadastro.linhas,
        cadastro.dfcIndiretoRegras ?? [],
        periodos,
      );
      const caixa = calcularSaldosCaixaEquivalentes(
        cadastro.dfcContasCaixaEquivalentes ?? [],
        periodos,
      );
      setCalculation({ valores: indirect.valores, variacaoReal: caixa.variacaoReal });
    }).catch(error => {
      if (active) setErro(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [selectedMonth, selectedYear]);

  if (loading) {
    return <div role="status" className="py-12 text-center text-sm text-muted-foreground">Carregando diagnóstico do FC Indireto...</div>;
  }
  if (erro) {
    return <div role="alert" className="py-12 text-center text-sm text-red-600">Não foi possível carregar o diagnóstico: {erro}</div>;
  }

  const valor = (codigo: string) => calculation?.valores.get(codigo) ?? null;
  const fluxoOperAdj = valor('dfc-operacional');
  const fluxoInvestAdj = valor('dfc-investimento');
  const fluxoFinancAdj = valor('dfc-financiamento');
  const fluxoTotal = valor('dfc-total');
  const varCaixaReal = calculation?.variacaoReal ?? null;
  if (
    fluxoOperAdj === null || fluxoInvestAdj === null || fluxoFinancAdj === null
    || fluxoTotal === null || varCaixaReal === null
  ) {
    return (
      <div role="status" className="py-12 text-center text-sm text-muted-foreground">
        Não há dados suficientes para calcular o diagnóstico do período e conciliar a variação com as contas de caixa selecionadas.
      </div>
    );
  }

  const d = {
    ajusteEstoque: valor('V03') ?? 0,
    ajusteFornec: valor('V08') ?? 0,
    ajusteCred: (valor('V01') ?? 0) + (valor('V02') ?? 0),
    deprec: valor('AJ01') ?? 0,
    varCaixaReal,
    fluxoTotal,
  };
  const resultadoPeriodo = valor('RES') ?? 0;
  const ajusteDemais = Math.round((
    fluxoOperAdj - resultadoPeriodo - d.deprec - d.ajusteEstoque - d.ajusteFornec - d.ajusteCred
  ) * 100) / 100;
  const diferencaConciliacao = Math.round((fluxoTotal - varCaixaReal) * 100) / 100;
  const caixaConciliado = diferencaConciliacao === 0;
  const descricaoDiferencaConciliacao = `Diferença entre DFC e caixa: ${diferencaConciliacao >= 0 ? '+' : '−'}${fmtBRL(Math.abs(diferencaConciliacao))}`;

  // Utilitário: percentual absoluto de `part` em relação a `whole`
  const pctOf = (part: number, whole: number) =>
    whole !== 0 ? Math.round((Math.abs(part) / Math.abs(whole)) * 100) : 0;

  // ── Flags de sustentabilidade ──────────────────────────────────────────────
  const queimouEstoque  = d.ajusteEstoque > 0;                      // estoque caiu → entrou caixa
  const estoquePct      = fluxoOperAdj > 0 ? pctOf(d.ajusteEstoque, fluxoOperAdj) : 0;
  const queimouSignif   = queimouEstoque && estoquePct >= 30;        // ≥ 30% do oper vem de estoque

  const atrasouFornec   = d.ajusteFornec > 0;                       // fornecedores subiram → postergação
  const fornecPct       = fluxoOperAdj > 0 ? pctOf(d.ajusteFornec, fluxoOperAdj) : 0;
  const atrasouSignif   = atrasouFornec && fornecPct >= 30;

  const deprecPct       = fluxoOperAdj > 0 ? pctOf(d.deprec, fluxoOperAdj) : 0;
  const credPct         = fluxoOperAdj > 0 ? pctOf(d.ajusteCred, fluxoOperAdj) : 0;

  const operPositivo    = fluxoOperAdj > 0;
  const operSustentavel = operPositivo && !queimouSignif && !atrasouSignif && caixaConciliado;
  const gerarCaixa      = d.fluxoTotal >= 0;

  // ── Semáforo ───────────────────────────────────────────────────────────────
  type SemStatus = 'green' | 'yellow' | 'red';
  let status: SemStatus;
  let titulo: string;
  let descricao: string;

  if (!caixaConciliado) {
    status    = 'yellow';
    titulo    = 'Saúde do Fluxo: ATENÇÃO';
    descricao = 'A variação calculada pela DFC não confere com a movimentação das contas de caixa selecionadas. Revise as classificações e a conciliação da DFC.';
  } else if (operSustentavel) {
    status    = 'green';
    titulo    = 'Saúde do Fluxo: FORTE';
    descricao = 'A empresa gera caixa de forma sustentável a partir de suas operações principais, sem dependência de ajustes de capital de giro não recorrentes.';
  } else if (operPositivo) {
    status    = 'yellow';
    titulo    = 'Saúde do Fluxo: ATENÇÃO';
    descricao = 'O fluxo operacional é positivo, mas parte relevante vem de ajustes pontuais (queima de estoque ou atraso a fornecedores). Isso pode não se repetir no próximo período.';
  } else if (!operPositivo && gerarCaixa) {
    status    = 'yellow';
    titulo    = 'Saúde do Fluxo: ATENÇÃO';
    descricao = 'A operação consumiu caixa, mas o saldo final é positivo graças a financiamento ou desinvestimentos. Não é sustentável no longo prazo.';
  } else {
    status    = 'red';
    titulo    = 'Saúde do Fluxo: CRÍTICO';
    descricao = 'A empresa está consumindo caixa. A operação não gera recursos suficientes para se autofinanciar e o saldo do período é negativo.';
  }

  const semColors = {
    green:  { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-400', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', icon: '🟢' },
    yellow: { bg: 'bg-amber-50 dark:bg-amber-950/30',     border: 'border-amber-400',   text: 'text-amber-700 dark:text-amber-400',   dot: 'bg-amber-400',   icon: '🟡' },
    red:    { bg: 'bg-red-50 dark:bg-red-950/30',          border: 'border-red-400',     text: 'text-red-700 dark:text-red-400',       dot: 'bg-red-500',     icon: '🔴' },
  };
  const sc = semColors[status];

  // ── Atividades ─────────────────────────────────────────────────────────────
  const atividades = [
    { label: 'Operacional',    value: fluxoOperAdj,   icon: '⚙️', desc: 'Resultado das atividades-fim da empresa (vendas, custos e capital de giro)' },
    { label: 'Investimento',   value: fluxoInvestAdj, icon: '🏗️', desc: 'Compra/venda de imobilizado, intangível e créditos de longo prazo' },
    { label: 'Financiamento',  value: fluxoFinancAdj, icon: '🏛️', desc: 'Empréstimos, arrendamentos, aportes e retiradas de sócios' },
  ];

  // ── Checklist ──────────────────────────────────────────────────────────────
  const checks = [
    {
      ok: gerarCaixa,
      label: 'Empresa gerou caixa no período',
      detail: `Variação total: ${d.fluxoTotal >= 0 ? '+' : '−'}${fmtBRL(d.fluxoTotal)}`,
    },
    {
      ok: operPositivo,
      label: 'Atividade operacional gera caixa',
      detail: `Fluxo operacional: ${fluxoOperAdj >= 0 ? '+' : '−'}${fmtBRL(fluxoOperAdj)}`,
    },
    {
      ok: !queimouSignif,
      warn: queimouEstoque && !queimouSignif,
      label: 'Caixa operacional sem dependência excessiva de queima de estoque',
      detail: queimouEstoque
        ? `Redução de estoque contribuiu ${estoquePct}% do caixa operacional${queimouSignif ? ' — acima de 30%, sinal de atenção' : ' — patamar aceitável'}`
        : 'Estoques estáveis ou em crescimento',
    },
    {
      ok: !atrasouSignif,
      warn: atrasouFornec && !atrasouSignif,
      label: 'Sem dependência excessiva de postergação de fornecedores',
      detail: atrasouFornec
        ? `Aumento de fornecedores contribuiu ${fornecPct}% do caixa operacional${atrasouSignif ? ' — acima de 30%, atenção ao prazo' : ' — patamar controlado'}`
        : 'Fornecedores estáveis ou reduzidos',
    },
    {
      ok: operPositivo,
      label: 'Operação é a principal fonte de caixa (não depende de dívida)',
      detail: operPositivo
        ? 'Fluxo operacional positivo — empresa se autofinancia'
        : 'Financiamento ou venda de ativos sustentando o caixa',
    },
    {
      ok: caixaConciliado,
      warn: !caixaConciliado,
      label: 'DFC conciliada com as contas de caixa selecionadas',
      detail: caixaConciliado
        ? 'A variação total da DFC confere com a movimentação das contas de caixa.'
        : descricaoDiferencaConciliacao,
    },
    {
      ok: d.varCaixaReal >= 0,
      label: 'Saldo das contas de caixa selecionadas aumentou',
      detail: `Variação real: ${d.varCaixaReal >= 0 ? '+' : '−'}${fmtBRL(d.varCaixaReal)}`,
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Valores baseados no FC Indireto e nas regras cadastradas em Emissão de Demonstrações Financeiras.
      </p>

      {/* ── 1. Semáforo principal ─────────────────────────────── */}
      <Card className={cn('border-2', sc.border, sc.bg)}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-5">
            {/* Semáforo visual */}
            <div className="flex flex-col items-center gap-2 shrink-0 pt-1">
              {(['green', 'yellow', 'red'] as SemStatus[]).map((s) => (
                <div key={s} className={cn('w-9 h-9 rounded-full border-2 border-white/30 shadow-inner transition-all', status === s ? semColors[s].dot + ' shadow-md scale-110' : 'bg-gray-200 dark:bg-gray-700 opacity-30')} />
              ))}
            </div>

            {/* Conteúdo principal */}
            <div className="flex-1">
              <div className={cn('text-xl font-bold mb-2', sc.text)}>{sc.icon} {titulo}</div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{descricao}</p>
              <div className={cn('text-3xl font-bold font-mono', d.fluxoTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                {d.fluxoTotal >= 0 ? '✅' : '❌'} {d.fluxoTotal >= 0 ? '+' : '−'}{fmtBRL(d.fluxoTotal)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {d.fluxoTotal >= 0 ? 'A empresa GEROU caixa no período analisado.' : 'A empresa CONSUMIU caixa no período analisado.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. De onde veio o caixa? ──────────────────────────── */}
      <div>
        <SectionTitle icon="🔍">Contribuição por atividade (FC Indireto)</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {atividades.map((a) => {
            const isPos = a.value >= 0;
            const isMain = Math.abs(a.value) === Math.max(...atividades.filter(x => x.value >= 0).map(x => x.value)) && isPos;
            return (
              <Card key={a.label} className={cn('border-l-4', isPos ? 'border-l-emerald-500' : 'border-l-red-400')}>
                <CardContent className="pt-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{a.icon}</span>
                      <span className="font-bold text-foreground text-sm">{a.label}</span>
                    </div>
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', isPos ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400')}>
                      {isPos ? '✅ Fonte' : '❌ Uso'}
                    </span>
                  </div>
                  <div className={cn('text-2xl font-bold font-mono mb-1', isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
                    {isPos ? '+' : '−'}{fmtBRL(a.value)}
                  </div>
                  {isMain && <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full font-semibold">★ Maior fonte</span>}
                  <p className="text-xs text-muted-foreground leading-relaxed mt-2">{a.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── 3. Análise de sustentabilidade ────────────────────── */}
      <div>
        <SectionTitle icon="🔬">É sustentável? Análise do Caixa Operacional</SectionTitle>
        <Card>
          <CardContent className="pt-6">
            {fluxoOperAdj !== 0 && (
              <div className="mb-5">
                <div className="text-sm font-semibold text-foreground mb-4">
                  Composição do Fluxo Operacional&nbsp;
                  <span className={cn('font-mono', fluxoOperAdj >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>{fluxoOperAdj >= 0 ? '+' : '−'}{fmtBRL(fluxoOperAdj)}</span>
                </div>
                {[
                  { label: 'Resultado líquido do período', value: resultadoPeriodo, pctVal: pctOf(resultadoPeriodo, fluxoOperAdj), color: 'bg-slate-400', neutral: false, warn: false, note: 'Resultado contábil que inicia a composição do método indireto.' },
                  { label: 'Depreciação / Amortização', value: d.deprec, pctVal: deprecPct, color: 'bg-blue-400', neutral: true, warn: false, note: 'Ajuste de itens sem efeito direto no caixa do período.' },
                  { label: 'Variação de Estoques', value: d.ajusteEstoque, pctVal: estoquePct, color: queimouSignif ? 'bg-amber-400' : 'bg-emerald-400', neutral: false, warn: queimouSignif, note: queimouEstoque ? `Redução de estoque (fonte de caixa). ${queimouSignif ? `Representa ${estoquePct}% do caixa oper. — sinal de queima de estoque.` : `${estoquePct}% do caixa oper. — patamar aceitável.`}` : 'Aumento de estoque (uso de caixa — empresa está investindo em produto).' },
                  { label: 'Clientes e outros créditos', value: d.ajusteCred, pctVal: credPct, color: d.ajusteCred >= 0 ? 'bg-emerald-400' : 'bg-red-400', neutral: false, warn: false, note: d.ajusteCred >= 0 ? 'Redução de créditos (fonte de caixa).' : 'Aumento de créditos (uso de caixa).' },
                  { label: 'Variação de Fornecedores', value: d.ajusteFornec, pctVal: fornecPct, color: atrasouSignif ? 'bg-amber-400' : 'bg-emerald-400', neutral: false, warn: atrasouSignif, note: atrasouFornec ? `Aumento de fornecedores (fonte de caixa por variação do passivo). ${atrasouSignif ? `${fornecPct}% do caixa oper. — sinal de atenção.` : `${fornecPct}% do caixa oper. — patamar controlado.`}` : 'Redução de fornecedores (uso de caixa).' },
                  { label: 'Demais ajustes e variações', value: ajusteDemais, pctVal: pctOf(ajusteDemais, fluxoOperAdj), color: 'bg-violet-400', neutral: false, warn: false, note: 'Agrupa os demais ajustes ao resultado e variações de ativos e passivos operacionais da DFC.' },
                ].filter(i => Math.abs(i.value) > 0).map((item, idx) => (
                  <div key={idx} className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                        {item.warn      && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded dark:bg-amber-950 dark:text-amber-400">⚠️ Pontual</span>}
                        {item.neutral   && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded dark:bg-blue-950 dark:text-blue-400">ℹ️ Não-caixa</span>}
                        {!item.warn && !item.neutral && item.value > 0 && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded dark:bg-emerald-950 dark:text-emerald-400">✓ OK</span>}
                      </div>
                      <span className="text-xs font-mono font-semibold text-foreground shrink-0">{item.value >= 0 ? '+' : '−'}{fmtBRL(item.value, true)}</span>
                    </div>
                    <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-1">
                      <div className={cn('h-full rounded-full transition-all duration-700', item.color)} style={{ width: `${Math.min(100, item.pctVal)}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground/70 leading-snug">{item.note}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Veredito de sustentabilidade */}
            <div className={cn('p-4 rounded-xl border', operSustentavel ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : !operPositivo ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800')}>
              <div className="font-bold text-sm mb-1">
                {operSustentavel ? '✅ Caixa operacional SUSTENTÁVEL' : !operPositivo ? '❌ Caixa operacional DEFICITÁRIO' : '⚠️ Caixa operacional PARCIALMENTE SUSTENTÁVEL'}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {operSustentavel
                  ? 'O fluxo operacional é positivo e não depende de itens pontuais como queima de estoque ou postergação de pagamentos a fornecedores.'
                  : !operPositivo
                  ? 'A atividade-fim não está gerando caixa suficiente. Isso pode indicar margens comprimidas ou capital de giro cronicamente negativo.'
                  : 'O fluxo operacional é positivo, mas existem componentes pontuais que podem não se repetir. Monitore a evolução do estoque e dos prazos com fornecedores.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 4. Checklist de sinais ─────────────────────────────── */}
      <div>
        <SectionTitle icon="📋">Checklist de Saúde do Fluxo de Caixa</SectionTitle>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {checks.map((item, idx) => {
                const icon = item.ok ? '✅' : (item as any).warn ? '⚠️' : '❌';
                const rowBg = item.ok ? 'bg-emerald-50 dark:bg-emerald-950/20' : (item as any).warn ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-red-50 dark:bg-red-950/20';
                return (
                  <div key={idx} className={cn('flex items-start gap-3 p-3 rounded-lg', rowBg)}>
                    <span className="text-xl mt-0.5 shrink-0">{icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{item.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

function IndicadoresTab({ data, fmtBRL, SectionTitle, Badge, janAccounts, selectedMonth, selectedYear }: any) {
  const ind = data.indicadores;
  const lqcStatus = ind.liqCorrente >= 1.5 ? 'ok' : ind.liqCorrente >= 1 ? 'warn' : 'bad';
  const lqiStatus = ind.liqImediata >= 0.2 ? 'ok' : ind.liqImediata >= 0.1 ? 'warn' : 'bad';
  const endStatus = ind.endivTotal <= 0.5 ? 'ok' : ind.endivTotal <= 0.7 ? 'warn' : 'bad';
  const pctStatus = ind.partCapTerceiros <= 2 ? 'ok' : ind.partCapTerceiros <= 4 ? 'warn' : 'bad';

  // ── Base mensal ───────────────────────────────────────────────────────────
  const resLiq      = data.dfc.resLiq;
  const recLiqPer   = data.receitas.liq.per || 1;
  const PLatu       = data.PL.atu || 1;
  const dividasFin  = (data.emprestCP?.atu || 0) + (data.emprestLP?.atu || 0)
                    + (data.pessoasLig?.atu || 0) + (data.debitosLig?.atu || 0)
                    + (data.arrendLP?.atu || 0);
  const capInvestido = PLatu + dividasFin;
  const passTotal    = data.passivo.circ.atu + data.passivo.naoCirc.atu;
  const ancPlusPNC   = PLatu + data.passivo.naoCirc.atu;

  const roic        = capInvestido !== 0 ? (resLiq / capInvestido) * 100 : 0;
  const roe         = PLatu        !== 0 ? (resLiq / PLatu)        * 100 : 0;
  const ros         = recLiqPer    !== 0 ? (resLiq / recLiqPer)    * 100 : 0;
  const imobInvest  = ancPlusPNC   !== 0 ? (data.ativo.naoCirc.atu / ancPlusPNC) * 100 : 0;
  const taxaRisco   = data.ativo.circ.atu !== 0 ? passTotal / data.ativo.circ.atu : 0;
  const margemBruta = ind.margemBruta;

  const roicStatus       = roic > 10  ? 'ok' as const : roic >= 5   ? 'warn' as const : 'bad' as const;
  const roeStatus        = roe  > 15  ? 'ok' as const : roe  >= 5   ? 'warn' as const : 'bad' as const;
  const rosStatus        = ros  > 5   ? 'ok' as const : ros  >= 1   ? 'warn' as const : 'bad' as const;
  const imobInvestStatus = imobInvest <= 100 ? 'ok' as const : imobInvest <= 120 ? 'warn' as const : 'bad' as const;
  const taxaRiscoStatus  = taxaRisco  <= 1   ? 'ok' as const : taxaRisco  <= 1.5 ? 'warn' as const : 'bad' as const;
  const margemBrutaStatus = margemBruta > 10 ? 'ok' as const : margemBruta >= 0 ? 'warn' as const : 'bad' as const;

  // ── Acumulado YTD ─────────────────────────────────────────────────────────
  // Indicadores de balanço (Liquidez, Endividamento, Imobilização, Taxa de Risco)
  // já refletem a posição no final do mês selecionado — sem necessidade de acumulado.
  // Indicadores de resultado (ROIC, ROE, ROS, Margem Bruta) mostram o mês e o YTD.
  const hasAcum = !!janAccounts && selectedMonth > 1;
  const MONTH_SHORT: Record<number, string> = { 1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun', 7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez' };
  const shortYear  = String(selectedYear).slice(2);
  const headerMes  = selectedMonth > 0 ? `${MONTH_SHORT[selectedMonth]}/${shortYear}` : String(selectedYear);
  const headerAcu  = `Jan – ${MONTH_SHORT[selectedMonth]}/${shortYear}`;

  type St = 'ok' | 'warn' | 'bad';
  let roic_a = 0, roe_a = 0, ros_a = 0, mb_a = 0;
  let roic_as: St = 'bad', roe_as: St = 'bad', ros_as: St = 'bad', mb_as: St = 'bad';

  if (hasAcum) {
    const cur = data.accounts as Record<string, any>;
    const jan = janAccounts as Record<string, any>;

    // Detecta se o balancete é cumulativo YTD (saldoAnt ≠ 0 para contas de resultado)
    // Em balancetes cumulativos: saldoAtual = acumulado Jan–mês. Em mensais: saldoAtual = só o mês.
    const isCumul = selectedMonth > 1 && Math.abs(cur['3.1']?.saldoAnt || 0) > 10;

    // amAcum: para balancetes cumulativos, saldoAtual já é o YTD.
    // Para balancetes mensais, soma Janeiro (janAccounts) + mês atual (cur).
    const amAcum = (id: string) => isCumul
      ? Math.abs(cur[id]?.saldoAtual || 0)
      : Math.abs(jan[id]?.saldoAtual || 0) + Math.abs(cur[id]?.saldoAtual || 0);

    const despOper5_a  = isCumul
      ? Math.abs(cur['5']?.saldoAtual || 0)
      : Math.abs(jan['5']?.saldoAtual || 0) + Math.abs(cur['5']?.saldoAtual || 0);

    const resLiq_a     = amAcum('3.1') - amAcum('3.2') - amAcum('3.3') - amAcum('4') - despOper5_a
                       + amAcum('3.4') + amAcum('3.5') + amAcum('3.6') - amAcum('6');
    const recLiq_a     = Math.max(amAcum('3.1') - amAcum('3.2') - amAcum('3.3'), 1);
    const CMV_a        = amAcum('4');
    roic_a = capInvestido !== 0 ? (resLiq_a / capInvestido) * 100 : 0;
    roe_a  = PLatu        !== 0 ? (resLiq_a / PLatu)        * 100 : 0;
    ros_a  = recLiq_a     !== 0 ? (resLiq_a / recLiq_a)    * 100 : 0;
    mb_a   = recLiq_a     !== 0 ? ((recLiq_a - CMV_a) / recLiq_a) * 100 : 0;
    roic_as = roic_a > 10 ? 'ok' : roic_a >= 5  ? 'warn' : 'bad';
    roe_as  = roe_a  > 15 ? 'ok' : roe_a  >= 5  ? 'warn' : 'bad';
    ros_as  = ros_a  > 5  ? 'ok' : ros_a  >= 1  ? 'warn' : 'bad';
    mb_as   = mb_a   > 10 ? 'ok' : mb_a   >= 0  ? 'warn' : 'bad';
  }

  type Ind = { label: string; formula: string; value: string; ref: string; status: St; desc: string; acumValue?: string; acumStatus?: St; };

  const indicadores: Ind[] = [
    { label: 'Liquidez Corrente',     formula: 'AC / PC',          value: `${ind.liqCorrente.toFixed(2)}x`,          ref: '≥ 1,5x ideal',    status: lqcStatus,       desc: 'Mede a capacidade de pagar obrigações de curto prazo com ativos circulantes.' },
    { label: 'Liquidez Imediata',     formula: 'Disponib. / PC',   value: `${(ind.liqImediata * 100).toFixed(1)}%`,  ref: '≥ 20% aceitável', status: lqiStatus,       desc: 'Percentual do passivo circulante coberto pelo caixa disponível imediatamente.' },
    { label: 'Endividamento Geral',   formula: 'PT / AT',          value: `${(ind.endivTotal * 100).toFixed(1)}%`,   ref: '≤ 50% saudável',  status: endStatus,       desc: 'Proporção do ativo financiada por capital de terceiros (dívidas).' },
    { label: 'Participação Cap. 3ºs', formula: 'PT / PL',          value: `${ind.partCapTerceiros.toFixed(1)}x`,     ref: '≤ 2x baixo risco',status: pctStatus,       desc: 'Quantas vezes o capital de terceiros supera o patrimônio líquido.' },
    { label: 'Imobilização do PL',    formula: 'ANC / PL',         value: `${(data.ativo.naoCirc.atu / data.PL.atu * 100).toFixed(0)}%`, ref: '≤ 100%', status: data.ativo.naoCirc.atu <= data.PL.atu ? 'ok' : 'bad', desc: 'Percentual do PL comprometido com ativos não circulantes. Acima de 100% indica que o ANC é financiado por dívidas.' },
    { label: 'Imob. do Investimento', formula: 'ANC / (PL + PNC)', value: `${imobInvest.toFixed(0)}%`,               ref: '≤ 100%',           status: imobInvestStatus,desc: 'Mede quanto dos recursos de longo prazo (PL + Passivo NC) está comprometido com ativos não circulantes.' },
    { label: 'Taxa de Risco',         formula: '(PC + PNC) / AC',  value: `${taxaRisco.toFixed(2)}x`,                ref: '≤ 1x ideal',       status: taxaRiscoStatus, desc: 'Relação entre o total de dívidas (curto + longo prazo) e o ativo circulante.' },
    { label: 'Margem Bruta',          formula: 'LB / Rec.Líq.',    value: `${margemBruta.toFixed(1)}%`,              ref: '> 10% saudável',  status: margemBrutaStatus, desc: 'Percentual da receita líquida que sobra após deduzir o custo dos produtos vendidos.',
      ...(hasAcum ? { acumValue: `${mb_a.toFixed(1)}%`,   acumStatus: mb_as   } : {}) },
    { label: 'ROIC',                  formula: 'Res. Líq. / (PL + Dívidas Fin.)', value: `${roic.toFixed(1)}%`, ref: '> 10% ideal', status: roicStatus, desc: 'Retorno sobre o capital investido. Mede a eficiência em gerar lucro a partir de todo o capital empregado (próprio + financeiro).',
      ...(hasAcum ? { acumValue: `${roic_a.toFixed(1)}%`, acumStatus: roic_as } : {}) },
    { label: 'ROE',                   formula: 'Res. Líq. / PL',   value: `${roe.toFixed(1)}%`,                      ref: '> 15% ideal',     status: roeStatus,  desc: 'Retorno sobre o patrimônio líquido. Indica quanto os sócios estão ganhando sobre o capital investido.',
      ...(hasAcum ? { acumValue: `${roe_a.toFixed(1)}%`,  acumStatus: roe_as  } : {}) },
    { label: 'ROS (Margem Líquida)',  formula: 'Res. Líq. / Rec. Líquida', value: `${ros.toFixed(1)}%`,             ref: '> 5% saudável',   status: rosStatus,  desc: 'Percentual da receita líquida que se converte em lucro líquido após todos os custos, despesas e impostos.',
      ...(hasAcum ? { acumValue: `${ros_a.toFixed(1)}%`,  acumStatus: ros_as  } : {}) },
  ];

  const statusColor = (s: St) =>
    s === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : s === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  // ── Exportar detalhamento para Excel ─────────────────────────────────────────
  const exportIndicadoresExcel = () => {
    const acc = data.accounts as Record<string, any>;
    const get = (id: string) => acc[id] || { saldoAnt: 0, saldoAtual: 0, valDeb: 0, valCred: 0, desc: id };
    const absMov = (id: string) => { const a = get(id); return Math.abs((a.valCred || 0) - (a.valDeb || 0)); };
    const fmtV = (v: number) => v;
    const statusLabel = (s: St) => s === 'ok' ? 'Ok' : s === 'warn' ? 'Atenção' : 'Crítico';

    // Helper: calcula despOper5Net para um dado dicionário de contas
    const calcDespOper5 = (accs: Record<string, any>) => {
      const g = (id: string) => accs[id] || { valDeb: 0, valCred: 0 };
      const allK5 = Object.keys(accs).filter(k => k.startsWith('5.'));
      const leaves5 = allK5.filter(k => !allK5.some(o => o !== k && o.startsWith(k + '.')));
      return leaves5.reduce((s, k) => s + ((g(k).valDeb || 0) - (g(k).valCred || 0)), 0);
    };

    type Row = (string | number)[];
    const rows: Row[] = [];
    const header = ['Indicador', 'Período', 'Fórmula', 'Componente', 'Conta', 'Descrição da Conta', 'Valor (R$)', 'Resultado', 'Status'];
    rows.push(header);

    const addSpacer = () => rows.push([]);

    // ── Indicadores de balanço ────────────────────────────────────
    // Liquidez Corrente = AC / PC
    const acAtu = Math.abs(get('1.1').saldoAtual);
    const pcAtu = Math.abs(get('2.1').saldoAtual);
    rows.push(['Liquidez Corrente', headerMes, 'AC / PC', 'Numerador: AC', '1.1', get('1.1').desc || 'Ativo Circulante', fmtV(acAtu), '', '']);
    rows.push(['', '', '', 'Denominador: PC', '2.1', get('2.1').desc || 'Passivo Circulante', fmtV(pcAtu), '', '']);
    rows.push(['', '', '', 'RESULTADO', '', '', '', pcAtu > 0 ? `${(acAtu / pcAtu).toFixed(2)}x` : '0', statusLabel(lqcStatus)]);
    addSpacer();

    // Liquidez Imediata = Disponib / PC
    const dispAtu = Math.abs(get('1.1.1').saldoAtual);
    rows.push(['Liquidez Imediata', headerMes, 'Disponib. / PC', 'Numerador: Disponibilidades', '1.1.1', get('1.1.1').desc || 'Disponibilidades', fmtV(dispAtu), '', '']);
    rows.push(['', '', '', 'Denominador: PC', '2.1', get('2.1').desc || 'Passivo Circulante', fmtV(pcAtu), '', '']);
    rows.push(['', '', '', 'RESULTADO', '', '', '', pcAtu > 0 ? `${(dispAtu / pcAtu * 100).toFixed(1)}%` : '0', statusLabel(lqiStatus)]);
    addSpacer();

    // Endividamento Geral = (PC + PNC) / AT
    const pncAtu = Math.abs(get('2.2').saldoAtual);
    const atAtu = Math.abs(get('1').saldoAtual);
    rows.push(['Endividamento Geral', headerMes, 'PT / AT', 'Numerador: PC', '2.1', get('2.1').desc || 'Passivo Circulante', fmtV(pcAtu), '', '']);
    rows.push(['', '', '', 'Numerador: PNC', '2.2', get('2.2').desc || 'Passivo Não Circulante', fmtV(pncAtu), '', '']);
    rows.push(['', '', '', 'Numerador: PT (PC + PNC)', '', '', fmtV(pcAtu + pncAtu), '', '']);
    rows.push(['', '', '', 'Denominador: AT', '1', get('1').desc || 'Ativo Total', fmtV(atAtu), '', '']);
    rows.push(['', '', '', 'RESULTADO', '', '', '', atAtu > 0 ? `${((pcAtu + pncAtu) / atAtu * 100).toFixed(1)}%` : '0', statusLabel(endStatus)]);
    addSpacer();

    // Participação Cap 3ºs = PT / PL
    const plAtu = Math.abs(get('2.3').saldoAtual);
    rows.push(['Participação Cap. 3ºs', headerMes, 'PT / PL', 'Numerador: PC', '2.1', get('2.1').desc || 'Passivo Circulante', fmtV(pcAtu), '', '']);
    rows.push(['', '', '', 'Numerador: PNC', '2.2', get('2.2').desc || 'Passivo Não Circulante', fmtV(pncAtu), '', '']);
    rows.push(['', '', '', 'Numerador: PT (PC + PNC)', '', '', fmtV(pcAtu + pncAtu), '', '']);
    rows.push(['', '', '', 'Denominador: PL', '2.3', get('2.3').desc || 'Patrimônio Líquido', fmtV(plAtu), '', '']);
    rows.push(['', '', '', 'RESULTADO', '', '', '', plAtu > 0 ? `${((pcAtu + pncAtu) / plAtu).toFixed(1)}x` : '0', statusLabel(pctStatus)]);
    addSpacer();

    // Imobilização do PL = ANC / PL
    const ancAtu = Math.abs(get('1.5').saldoAtual);
    const imobPLStatus: St = ancAtu <= plAtu ? 'ok' : 'bad';
    rows.push(['Imobilização do PL', headerMes, 'ANC / PL', 'Numerador: ANC', '1.5', get('1.5').desc || 'Ativo Não Circulante', fmtV(ancAtu), '', '']);
    rows.push(['', '', '', 'Denominador: PL', '2.3', get('2.3').desc || 'Patrimônio Líquido', fmtV(plAtu), '', '']);
    rows.push(['', '', '', 'RESULTADO', '', '', '', plAtu > 0 ? `${(ancAtu / plAtu * 100).toFixed(0)}%` : '0', statusLabel(imobPLStatus)]);
    addSpacer();

    // Imob. do Investimento = ANC / (PL + PNC)
    rows.push(['Imob. do Investimento', headerMes, 'ANC / (PL + PNC)', 'Numerador: ANC', '1.5', get('1.5').desc || 'Ativo Não Circulante', fmtV(ancAtu), '', '']);
    rows.push(['', '', '', 'Denominador: PL', '2.3', get('2.3').desc || 'Patrimônio Líquido', fmtV(plAtu), '', '']);
    rows.push(['', '', '', 'Denominador: PNC', '2.2', get('2.2').desc || 'Passivo Não Circulante', fmtV(pncAtu), '', '']);
    rows.push(['', '', '', 'Denominador: (PL + PNC)', '', '', fmtV(plAtu + pncAtu), '', '']);
    rows.push(['', '', '', 'RESULTADO', '', '', '', (plAtu + pncAtu) > 0 ? `${(ancAtu / (plAtu + pncAtu) * 100).toFixed(0)}%` : '0', statusLabel(imobInvestStatus)]);
    addSpacer();

    // Taxa de Risco = (PC + PNC) / AC
    rows.push(['Taxa de Risco', headerMes, '(PC + PNC) / AC', 'Numerador: PC', '2.1', get('2.1').desc || 'Passivo Circulante', fmtV(pcAtu), '', '']);
    rows.push(['', '', '', 'Numerador: PNC', '2.2', get('2.2').desc || 'Passivo Não Circulante', fmtV(pncAtu), '', '']);
    rows.push(['', '', '', 'Numerador: (PC + PNC)', '', '', fmtV(pcAtu + pncAtu), '', '']);
    rows.push(['', '', '', 'Denominador: AC', '1.1', get('1.1').desc || 'Ativo Circulante', fmtV(acAtu), '', '']);
    rows.push(['', '', '', 'RESULTADO', '', '', '', acAtu > 0 ? `${((pcAtu + pncAtu) / acAtu).toFixed(2)}x` : '0', statusLabel(taxaRiscoStatus)]);
    addSpacer();

    // ── Indicadores de Resultado (mensal + acumulado) ─────────────────────────
    // Contas usadas no Resultado Líquido
    const contasResLiq = [
      { id: '3.1', sinal: '+', papel: 'Receita Bruta' },
      { id: '3.2', sinal: '−', papel: 'Impostos s/ Vendas' },
      { id: '3.3', sinal: '−', papel: 'Devoluções' },
      { id: '4',   sinal: '−', papel: 'CMV / Custo' },
      { id: '5',   sinal: '−', papel: 'Despesas Operacionais' },
      { id: '3.4', sinal: '+', papel: 'Rendimentos Operacionais' },
      { id: '3.5', sinal: '+', papel: 'Rendimentos Financeiros' },
      { id: '3.6', sinal: '+', papel: 'Rendimentos Não Operacionais' },
      { id: '6',   sinal: '−', papel: 'Provisão IR/CSLL' },
    ];

    // Contas de Dívidas Financeiras (para ROIC)
    const contasDivFin = [
      { id: '2.1.1', desc: 'Empréstimos CP' },
      { id: '2.2.1.07', desc: 'Empréstimos LP' },
      { id: '2.2.1.01', desc: 'Pessoas Ligadas' },
      { id: '2.2.1.02', desc: 'Débitos com Ligadas' },
      { id: '2.2.1.15', desc: 'Arrendamentos LP' },
    ];

    // Função para gerar linhas de um indicador de resultado
    const addResultIndicator = (label: string, formula: string, periodo: string,
      numerador: number, numeradorLinhas: { conta: string; desc: string; valor: number; sinal: string }[],
      denominador: number, denominadorLinhas: { conta: string; desc: string; valor: number }[],
      resultado: string, status: St, isMargem?: boolean
    ) => {
      // Numerador
      for (const l of numeradorLinhas) {
        rows.push([label, periodo, formula, `Numerador (${l.sinal}) ${l.desc}`, l.conta, l.desc, fmtV(l.valor), '', '']);
        label = ''; formula = '';
      }
      rows.push(['', '', '', isMargem ? 'Numerador: Lucro Bruto (Rec.Líq − CMV)' : 'Numerador: Resultado Líquido', '', '', fmtV(numerador), '', '']);
      // Denominador
      for (const l of denominadorLinhas) {
        rows.push(['', '', '', `Denominador: ${l.desc}`, l.conta, l.desc, fmtV(l.valor), '', '']);
      }
      if (denominadorLinhas.length > 1) {
        rows.push(['', '', '', 'Denominador: Total', '', '', fmtV(denominador), '', '']);
      }
      rows.push(['', '', '', 'RESULTADO', '', '', '', resultado, statusLabel(status)]);
    };

    // ── Mensal values ──
    const despOper5 = calcDespOper5(acc);
    const resLiqVal = absMov('3.1') - absMov('3.2') - absMov('3.3') - absMov('4') - despOper5
                    + absMov('3.4') + absMov('3.5') + absMov('3.6') - absMov('6');
    const recLiqVal = Math.max(absMov('3.1') - absMov('3.2') - absMov('3.3'), 1);
    const cmvVal    = absMov('4');
    const lucroBruto = recLiqVal - cmvVal;

    const resLiqLinhas = contasResLiq.map(c => ({
      conta: c.id, desc: get(c.id).desc || c.papel, sinal: c.sinal,
      valor: c.id === '5' ? despOper5 : absMov(c.id)
    }));

    // Margem Bruta — Mensal
    const mbNumeradorLinhas = [
      { conta: '3.1', desc: get('3.1').desc || 'Receita Bruta', sinal: '+', valor: absMov('3.1') },
      { conta: '3.2', desc: get('3.2').desc || 'Impostos s/ Vendas', sinal: '−', valor: absMov('3.2') },
      { conta: '3.3', desc: get('3.3').desc || 'Devoluções', sinal: '−', valor: absMov('3.3') },
      { conta: '4', desc: get('4').desc || 'CMV', sinal: '−', valor: cmvVal },
    ];
    addResultIndicator('Margem Bruta', 'LB / Rec.Líq.', headerMes,
      lucroBruto, mbNumeradorLinhas,
      recLiqVal, [{ conta: '3.1−3.2−3.3', desc: 'Receita Líquida', valor: recLiqVal }],
      `${margemBruta.toFixed(1)}%`, margemBrutaStatus, true);
    addSpacer();

    // ROIC — Mensal
    const divFinVal = dividasFin;
    const capInvVal = capInvestido;
    const roicDenomLinhas = [
      { conta: '2.3', desc: get('2.3').desc || 'Patrimônio Líquido', valor: plAtu },
      ...contasDivFin.map(c => ({ conta: c.id, desc: get(c.id).desc || c.desc, valor: Math.abs(get(c.id).saldoAtual) }))
    ];
    addResultIndicator('ROIC', 'Res.Líq. / (PL + Dív.Fin.)', headerMes,
      resLiqVal, resLiqLinhas, capInvVal, roicDenomLinhas,
      `${roic.toFixed(1)}%`, roicStatus);
    addSpacer();

    // ROE — Mensal
    addResultIndicator('ROE', 'Res.Líq. / PL', headerMes,
      resLiqVal, resLiqLinhas,
      plAtu, [{ conta: '2.3', desc: get('2.3').desc || 'Patrimônio Líquido', valor: plAtu }],
      `${roe.toFixed(1)}%`, roeStatus);
    addSpacer();

    // ROS — Mensal
    addResultIndicator('ROS (Margem Líquida)', 'Res.Líq. / Rec.Líquida', headerMes,
      resLiqVal, resLiqLinhas,
      recLiqVal, [{ conta: '3.1−3.2−3.3', desc: 'Receita Líquida', valor: recLiqVal }],
      `${ros.toFixed(1)}%`, rosStatus);
    addSpacer();

    // ── Acumulado YTD ──
    if (hasAcum) {
      const cur = acc;
      const jan = janAccounts as Record<string, any>;
      const isCumul = selectedMonth > 1 && Math.abs(cur['3.1']?.saldoAnt || 0) > 10;
      const amAcum = (id: string) => isCumul
        ? Math.abs(cur[id]?.saldoAtual || 0)
        : Math.abs(jan[id]?.saldoAtual || 0) + Math.abs(cur[id]?.saldoAtual || 0);

      const despOper5_ac = isCumul
        ? Math.abs(cur['5']?.saldoAtual || 0)
        : Math.abs(jan['5']?.saldoAtual || 0) + Math.abs(cur['5']?.saldoAtual || 0);

      const resLiqAcum = amAcum('3.1') - amAcum('3.2') - amAcum('3.3') - amAcum('4') - despOper5_ac
                       + amAcum('3.4') + amAcum('3.5') + amAcum('3.6') - amAcum('6');
      const recLiqAcum = Math.max(amAcum('3.1') - amAcum('3.2') - amAcum('3.3'), 1);
      const cmvAcum = amAcum('4');
      const lucroBrutoAcum = recLiqAcum - cmvAcum;

      const resLiqLinhasAcum = contasResLiq.map(c => ({
        conta: c.id, desc: get(c.id).desc || c.papel, sinal: c.sinal,
        valor: c.id === '5' ? despOper5_ac : amAcum(c.id)
      }));

      // Margem Bruta — Acumulado
      const mbNumeradorLinhasAcum = [
        { conta: '3.1', desc: get('3.1').desc || 'Receita Bruta', sinal: '+', valor: amAcum('3.1') },
        { conta: '3.2', desc: get('3.2').desc || 'Impostos s/ Vendas', sinal: '−', valor: amAcum('3.2') },
        { conta: '3.3', desc: get('3.3').desc || 'Devoluções', sinal: '−', valor: amAcum('3.3') },
        { conta: '4', desc: get('4').desc || 'CMV', sinal: '−', valor: cmvAcum },
      ];
      addResultIndicator('Margem Bruta', 'LB / Rec.Líq.', headerAcu,
        lucroBrutoAcum, mbNumeradorLinhasAcum,
        recLiqAcum, [{ conta: '3.1−3.2−3.3', desc: 'Receita Líquida', valor: recLiqAcum }],
        `${mb_a.toFixed(1)}%`, mb_as, true);
      addSpacer();

      // ROIC — Acumulado
      addResultIndicator('ROIC', 'Res.Líq. / (PL + Dív.Fin.)', headerAcu,
        resLiqAcum, resLiqLinhasAcum, capInvVal, roicDenomLinhas,
        `${roic_a.toFixed(1)}%`, roic_as);
      addSpacer();

      // ROE — Acumulado
      addResultIndicator('ROE', 'Res.Líq. / PL', headerAcu,
        resLiqAcum, resLiqLinhasAcum,
        plAtu, [{ conta: '2.3', desc: get('2.3').desc || 'Patrimônio Líquido', valor: plAtu }],
        `${roe_a.toFixed(1)}%`, roe_as);
      addSpacer();

      // ROS — Acumulado
      addResultIndicator('ROS (Margem Líquida)', 'Res.Líq. / Rec.Líquida', headerAcu,
        resLiqAcum, resLiqLinhasAcum,
        recLiqAcum, [{ conta: '3.1−3.2−3.3', desc: 'Receita Líquida', valor: recLiqAcum }],
        `${ros_a.toFixed(1)}%`, ros_as);
    }

    // ── Gerar arquivo Excel ──
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Ajustar largura das colunas
    ws['!cols'] = [
      { wch: 24 }, // Indicador
      { wch: 16 }, // Período
      { wch: 28 }, // Fórmula
      { wch: 36 }, // Componente
      { wch: 14 }, // Conta
      { wch: 36 }, // Descrição
      { wch: 18 }, // Valor
      { wch: 14 }, // Resultado
      { wch: 10 }, // Status
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Indicadores');
    XLSX.writeFile(wb, `Indicadores_${headerMes.replace('/', '-')}_${selectedYear}.xlsx`);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" onClick={exportIndicadoresExcel} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar Detalhamento Excel
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {indicadores.map((ind2, i) => {
          const isStacked = hasAcum && ind2.acumValue !== undefined;
          const badgeLabel = (s: St) => s === 'ok' ? '✓ Ok' : s === 'warn' ? '⚡ Atenção' : '✗ Crítico';
          return (
            <Card key={i}>
              <CardContent className="pt-6 flex flex-col gap-2.5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">{ind2.formula}</div>
                    <div className="text-base font-bold text-foreground">{ind2.label}</div>
                  </div>
                  {!isStacked && (
                    <Badge label={badgeLabel(ind2.status)} status={ind2.status} />
                  )}
                </div>
                {isStacked ? (
                  <div className="space-y-1.5">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{headerMes}</div>
                        <Badge label={badgeLabel(ind2.status)} status={ind2.status} />
                      </div>
                      <div className={cn('font-mono text-2xl font-bold', statusColor(ind2.status))}>{ind2.value}</div>
                    </div>
                    <div className="border-t border-border/50 pt-1.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{headerAcu}</div>
                        <Badge label={badgeLabel(ind2.acumStatus!)} status={ind2.acumStatus!} />
                      </div>
                      <div className={cn('font-mono text-2xl font-bold', statusColor(ind2.acumStatus!))}>{ind2.acumValue}</div>
                    </div>
                  </div>
                ) : (
                  <div className={cn('font-mono text-3xl font-bold', statusColor(ind2.status))}>
                    {ind2.value}
                  </div>
                )}
                <div className="text-xs text-muted-foreground/70 leading-relaxed">{ind2.desc}</div>
                <div className="text-xs font-mono text-muted-foreground/60">Referência: {ind2.ref}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
