import { useState, useCallback, useRef, useEffect, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Upload, X, TrendingUp, TrendingDown, DollarSign, Package, Building2, BarChart3, Target, LogOut, Menu, Activity, Landmark, Users, Receipt, HandCoins, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadFluxoCaixaRaw, saveFluxoCaixaData } from "./fluxoCaixaStorage";
import { ComparativosTab } from "./ComparativosTab";
import { DespesasTab } from "./DespesasTab";
import { ComparativoReceitas } from "./ComparativoReceitas";

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
  const resultAcum = { ant: absAnt('2.3.3'), atu: absAtu('2.3.3') };

  // RECEITAS (conta 3 — valores negativos no balancete)
  const recBruta = { ant: absAnt('3.1'), atu: absAtu('3.1') };
  const impostosVendas = { per: absAtu('3.2') };
  const devolucoes = { per: absAtu('3.3') };
  const rendOper = { ant: absAnt('3.4'), per: absAtu('3.4') };
  const rendFinanc = { ant: absAnt('3.5'), per: absAtu('3.5') };
  const rendNaoOper = { ant: absAnt('3.6'), per: absAtu('3.6') };
  const recLiq = { per: recBruta.atu - impostosVendas.per - devolucoes.per };

  // CUSTOS E DESPESAS
  const CMV = { per: absAtu('4') };
  const despPessoal_per = get('2.1.2.01.01').valCred;
  const despFinanc_per = get('5.5.7').valDeb;
  const deprec_per = get('5.5.2.07.20').valDeb;

  // PROVISÃO IR + CSLL
  const provisaoIR = { saldo: absAtu('6') };

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

  // Resultado Líquido via movimentação Déb/Créd — NBC TG 03 / IAS 7
  // absMov: captura o movimento líquido do período (valCred - valDeb para crédito; valDeb - valCred para débito)
  const absMov = (id: string) => { const a = get(id); return Math.abs((a.valCred || 0) - (a.valDeb || 0)); };
  const despOper5Net = (get('5').valDeb || 0) - (get('5').valCred || 0);
  const resLiq_dfc   = absMov('3.1') - absMov('3.2') - absMov('3.3')
                     - absMov('4') - despOper5Net
                     + absMov('3.4') + absMov('3.5') + absMov('3.6') - absMov('6');

  const fluxoOper =
    resLiq_dfc +
    deprec_per +
    ajusteEstoque + ajusteCred + ajusteContasCorr + ajusteValDiv +
    ajusteDespAntec +
    ajusteFornec + ajusteTrib + ajusteTrab + ajusteContasPag;

  // ── Atividades de Investimento ────────────────────────────────────────────
  const dIntangivel   = intangivel.atu   - intangivel.ant;
  const dRealizLPCred = realizLPCred.atu - realizLPCred.ant;
  const dInvestimentos = investimentos.atu - investimentos.ant;
  const fluxoInvest = -(imobiliz.atu - imobiliz.ant)
                    - dIntangivel
                    - dRealizLPCred
                    - dInvestimentos;

  // ── Atividades de Financiamento ─────────────────────────────────────────────
  const dEmprestCP  = emprestCP.atu  - emprestCP.ant;
  const dEmprestLP  = emprestLP.atu  - emprestLP.ant;
  const dPessoasLig = pessoasLig.atu - pessoasLig.ant;
  const dDebitosLig = debitosLig.atu - debitosLig.ant;
  const dArrendLP   = arrendLP.atu   - arrendLP.ant;
  const dOutrosPassLP = outrosPassLP.atu - outrosPassLP.ant; // 2.2.3
  // Resíduo de 2.2.1 — sub-contas não mapeadas individualmente (ex: 2.2.1.03, 2.2.1.05 etc.)
  const grupo2_2_1 = { ant: absAnt('2.2.1'), atu: absAtu('2.2.1') };
  const outros2_2_1Ant = grupo2_2_1.ant - emprestLP.ant - pessoasLig.ant - debitosLig.ant - arrendLP.ant;
  const outros2_2_1Atu = grupo2_2_1.atu - emprestLP.atu - pessoasLig.atu - debitosLig.atu - arrendLP.atu;
  const dOutros2_2_1   = outros2_2_1Atu - outros2_2_1Ant;
  // NOTA: 2.2.2 (Receitas Diferidas) excluída do financiamento — contém ICMS ST Diferido (não-caixa)

  const fluxoFinanc =
    dEmprestCP  +
    dEmprestLP  +
    dPessoasLig +
    dDebitosLig +
    dArrendLP   +
    dOutrosPassLP +
    dOutros2_2_1;

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
      ajusteFornec, ajusteTrib, ajusteTrab, ajusteContasPag,
      fluxoOper, fluxoInvest, fluxoFinanc, fluxoTotal, varCaixaReal,
      dEstoque, dCred, dContasCorr, dValDiv, dDespAntec, dFornec, dObrigTrib, dObrigTrab, dContasPag,
      dEmprestCP, dEmprestLP, dPessoasLig, dDebitosLig, dArrendLP,
      dIntangivel, dRealizLPCred, dInvestimentos,
      dOutrosPassLP, dOutros2_2_1, outros2_2_1Ant, outros2_2_1Atu,
      despOper5Net,
      emprestCPAnt: emprestCP.ant, emprestCPAtu: emprestCP.atu,
      emprestLPAnt: emprestLP.ant, emprestLPAtu: emprestLP.atu,
      pessoasLigAnt: pessoasLig.ant, pessoasLigAtu: pessoasLig.atu,
      debitosLigAnt: debitosLig.ant, debitosLigAtu: debitosLig.atu,
      arrendLPAnt: arrendLP.ant, arrendLPAtu: arrendLP.atu,
      investimentosAnt: investimentos.ant, investimentosAtu: investimentos.atu,
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

const DFCRow = ({ label, value, value2, hasAcum, indent = 0, highlight, total }: any) => {
  const isPos = value >= 0;
  const isPos2 = (value2 ?? 0) >= 0;
  const renderVal = (v: number, pos: boolean) => (
    <td className={cn('py-2.5 px-3 text-right font-mono text-sm', total || highlight ? 'font-bold' : '', hasAcum && 'w-[20%]')}>
      {total ? '' : (v >= 0 ? '' : '(')}
      <span className={cn(total ? (pos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400') : 'text-foreground')}>
        {total ? '' : fmtBRL(Math.abs(v))}
        {total && `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtBRL(v)}`}
      </span>
      {total ? '' : (v < 0 ? ')' : '')}
    </td>
  );
  return (
    <tr className={cn(highlight && 'bg-emerald-50 dark:bg-emerald-950/20', total && 'bg-muted/50')}>
      <td className={cn('py-2.5 px-3 text-sm', total || highlight ? 'font-bold text-foreground' : 'text-muted-foreground')} style={{ paddingLeft: 12 + indent * 20 }}>{label}</td>
      {renderVal(value, isPos)}
      {hasAcum && value2 !== undefined && renderVal(value2, isPos2)}
      {hasAcum && value2 === undefined && <td className="py-2.5 px-3 text-right text-muted-foreground/40 w-[20%] border-l border-border/20">—</td>}
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
}

export function FluxoCaixaDashboard({ onChangeBrand }: FluxoCaixaDashboardProps) {
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
  const [selectedYear, setSelectedYearState] = useState<2025 | 2026>(() => {
    try {
      const stored = localStorage.getItem('fluxo_caixa_selected_year');
      return (stored === '2026' ? 2026 : 2025) as 2025 | 2026;
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

  const setSelectedYear = (year: 2025 | 2026) => {
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

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setData(null);

        const raw = await loadFluxoCaixaRaw(selectedYear, selectedMonth);

        // Carregar balancete de Janeiro para cálculo acumulado YTD
        if (selectedMonth > 1) {
          const janRaw = await loadFluxoCaixaRaw(selectedYear, 1);
          if (janRaw?.rawText) {
            const janParsed = parseBalancete(janRaw.rawText);
            setJanAccounts(Object.keys(janParsed.accounts).length >= 10 ? janParsed.accounts : null);
          } else {
            setJanAccounts(null);
          }
        } else {
          setJanAccounts(null);
        }

        // Carregar balancete do mês anterior para cálculo de receitas
        if (selectedMonth !== 0) {
          const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
          const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
          const prevRaw = await loadFluxoCaixaRaw(prevYear, prevMonth);
          if (prevRaw?.rawText) {
            const prevParsed = parseBalancete(prevRaw.rawText);
            setPrevMonthAccounts(Object.keys(prevParsed.accounts).length >= 10 ? prevParsed.accounts : null);
          } else {
            setPrevMonthAccounts(null);
          }
        } else {
          setPrevMonthAccounts(null);
        }

        if (raw?.rawText) {
          console.log(`✅ Balancete ${MONTH_NAMES[selectedMonth]}/${selectedYear} carregado do Redis — re-parseando...`);
          const parsed = parseBalancete(raw.rawText);
          if (Object.keys(parsed.accounts).length >= 10) {
            setData(parsed);
            setSavedFileNames(prev => ({ ...prev, [savedFileKey]: raw.fileName }));
            setActiveTab('overview');
            return;
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

        const saved = await saveFluxoCaixaData(text, file.name, selectedYear, selectedMonth);
        if (saved) {
          console.log(`✅ Balancete ${MONTH_NAMES[selectedMonth]}/${selectedYear} salvo no Redis com sucesso:`, file.name);
          setRedisWarning(null);
        } else {
          console.warn('⚠️ Não foi possível salvar no Redis, mas os dados estão em memória');
          setRedisWarning('Os dados foram carregados na sessão, mas não foi possível salvar no banco de dados (Redis). Ao recarregar a página os dados serão perdidos. Verifique se as variáveis KV_REST_API_URL e KV_REST_API_TOKEN estão configuradas na Vercel.');
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
  }, [selectedYear, selectedMonth, savedFileKey]);

  const TABS = [
    { id: 'overview', label: 'Visão Geral', icon: <BarChart3 className="w-4 h-4" />, requiresData: true },
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
    { id: 'receitas', label: 'Receitas', icon: <TrendingUp className="w-4 h-4" />, requiresData: true },
    { id: 'despesas', label: 'Despesas', icon: <Receipt className="w-4 h-4" />, requiresData: true },
    { id: 'indicadores', label: 'Indicadores', icon: <Target className="w-4 h-4" />, requiresData: true },
    { id: 'diagnostico', label: 'Diagnóstico', icon: <Activity className="w-4 h-4" />, requiresData: true },
    { id: 'comparativos', label: 'Comparativos', icon: <BarChart3 className="w-4 h-4" />, requiresData: false },
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
              onChange={e => setSelectedYear(Number(e.target.value) as 2025 | 2026)}
              className="appearance-none bg-white text-green-700 font-bold text-sm rounded-lg px-3 py-1.5 pr-8 border border-green-200 shadow-sm cursor-pointer focus:outline-none"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2316a34a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
            >
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
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
              'fixed left-0 top-[60px] bottom-0 w-64 bg-slate-800 text-white z-20 transition-transform duration-300',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            )}
          >
            <nav className="p-4 space-y-1">
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

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700 space-y-1">
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
              <ComparativosTab />
            </div>
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
              {activeTab === 'ativo' && <AtivoTab data={data} SectionTitle={SectionTitle} TableRow2={TableRow2} colAnterior={colAnterior} colAtual={colAtual} />}
              {activeTab === 'passivo' && <PassivoTab data={data} SectionTitle={SectionTitle} TableRow2={TableRow2} colAnterior={colAnterior} colAtual={colAtual} />}
              {activeTab === 'resultado' && <ResultadoTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} colAnterior={colAnterior} colAtual={colAtual} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'caixa' && <CaixaTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} DFCRow={DFCRow} KPI={KPI} colAnterior={colAnterior} colAtual={colAtual} janAccounts={janAccounts} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'caixaDireto' && <CaixaDiretoTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} DFCRow={DFCRow} KPI={KPI} colAnterior={colAnterior} colAtual={colAtual} janAccounts={janAccounts} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'posicaoEstoques' && <PosicaoEstoquesTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} KPI={KPI} colAnterior={colAnterior} colAtual={colAtual} />}
              {activeTab === 'valoresReceber' && <ValoresReceberTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} KPI={KPI} colAnterior={colAnterior} colAtual={colAtual} />}
              {activeTab === 'receitas' && receitasView === 'normal' && <ReceitasTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} KPI={KPI} colAnterior={colAnterior} colAtual={colAtual} prevMonthAccounts={prevMonthAccounts} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
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
              {activeTab === 'endividamento' && <EndividamentoTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} KPI={KPI} TableRow2={TableRow2} colAnterior={colAnterior} colAtual={colAtual} janAccounts={janAccounts} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'despesas' && <DespesasTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} KPI={KPI} showTabela={showTabelaDespesas} setShowTabela={setShowTabelaDespesas} despesasView={despesasView} setDespesasView={setDespesasView} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'mutuoSocios' && <MutuoSociosTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} KPI={KPI} colAnterior={colAnterior} colAtual={colAtual} janAccounts={janAccounts} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'parcelamentoRefis' && <ParcelamentoRefisTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} KPI={KPI} colAnterior={colAnterior} colAtual={colAtual} janAccounts={janAccounts} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
              {activeTab === 'indicadores' && <IndicadoresTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} Badge={StatusBadge} />}
              {activeTab === 'diagnostico' && <DiagnosticoTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

function PosicaoEstoquesTab({ data, fmtBRL, SectionTitle, KPI, colAnterior, colAtual }: any) {
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
                      {varR >= 0 ? '+' : ''}{fmtBRL(varR)}
                    </td>
                    <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-emerald-600 dark:text-emerald-400' : varR < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      {varP !== null ? `${varP >= 0 ? '+' : ''}${varP.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/50 font-bold">
                <td className="py-2.5 px-3 text-sm font-bold text-foreground">TOTAL</td>
                <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">{fmtBRL(totalAntLocal)}</td>
                <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-foreground">{fmtBRL(totalAtuLocal)}</td>
                <td className={`py-2.5 px-3 text-right text-sm font-mono font-bold ${totalAtuLocal - totalAntLocal > 0 ? 'text-emerald-600 dark:text-emerald-400' : totalAtuLocal - totalAntLocal < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                  {totalAtuLocal - totalAntLocal >= 0 ? '+' : ''}{fmtBRL(totalAtuLocal - totalAntLocal)}
                </td>
                <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-muted-foreground">
                  {totalAntLocal !== 0 ? `${((totalAtuLocal - totalAntLocal) / totalAntLocal * 100) >= 0 ? '+' : ''}${((totalAtuLocal - totalAntLocal) / totalAntLocal * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
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
                        {varR >= 0 ? '+' : ''}{fmtBRL(varR)}
                      </td>
                      <td className={`py-2.5 px-3 text-right text-xs font-mono ${isTotal ? 'font-bold ' : ''}${varR > 0 ? 'text-emerald-600 dark:text-emerald-400' : varR < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {varP !== null ? `${varP >= 0 ? '+' : ''}${varP.toFixed(1)}%` : '—'}
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
  );
}

function ValoresReceberTab({ data, fmtBRL, SectionTitle, KPI, colAnterior, colAtual }: any) {
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

  return (
    <div className="space-y-6">
      {/* KPI Total */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI
          label="Total Anterior"
          value={fmtBRL(totalAnt, true)}
          sub="Saldo do período anterior"
          color="blue"
          icon="📋"
        />
        <KPI
          label="Total Atual"
          value={fmtBRL(totalAtu, true)}
          sub="Saldo do período atual"
          color={totalAtu > totalAnt ? 'emerald' : 'red'}
          icon="💰"
        />
        <KPI
          label="Variação"
          value={fmtBRL(varTotal, true)}
          sub={varTotalPct !== null ? `${varTotalPct >= 0 ? '+' : ''}${varTotalPct.toFixed(1)}%` : '—'}
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
                        {varR >= 0 ? '+' : ''}{fmtBRL(varR)}
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
                    {varTotal >= 0 ? '+' : ''}{fmtBRL(varTotal)}
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
  );
}

function ReceitasTab({ data, fmtBRL, SectionTitle, KPI, colAnterior, colAtual, prevMonthAccounts, selectedMonth, selectedYear }: any) {
  const accounts = data.accounts as Record<string, any>;
  const getAcc = (id: string) => accounts[id] || { saldoAnt: 0, saldoAtual: 0, valDeb: 0, valCred: 0 };
  const getPrev = (id: string) => (prevMonthAccounts || {})[id] || { valDeb: 0, valCred: 0 };

  // Movimentação do mês atual: crédito − débito (contas de receita têm natureza credora)
  const mov = (id: string) => { const a = getAcc(id); return a.valCred - a.valDeb; };
  // Movimentação do mês anterior (zero se balancete não disponível)
  const movPrev = (id: string) => { if (!prevMonthAccounts) return 0; const a = getPrev(id); return a.valCred - a.valDeb; };
  // YTD acumulado: saldoAtual já é cumulativo Jan→mês atual
  const ytdVal = (id: string) => Math.abs(getAcc(id).saldoAtual);

  // Label do acumulado ex: "Jan–Jul/25"
  const MSHORT = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const yr2 = String(selectedYear).slice(2);
  const ytdLabel = selectedMonth === 0
    ? String(selectedYear)
    : selectedMonth === 1
      ? `Jan/${yr2}`
      : `Jan–${MSHORT[selectedMonth]}/${yr2}`;

  const makeSimples = (ids: string[]) => ids.map(id => {
    const acc = getAcc(id);
    return { conta: id, desc: acc.desc || id, ant: movPrev(id), atu: mov(id), ytd: ytdVal(id) };
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
      desc: g.desc || p.gross,
      ant: prevMonthAccounts ? (gP.valCred - gP.valDeb) - (dP.valDeb - dP.valCred) : 0,
      atu: (g.valCred - g.valDeb) - (d.valDeb - d.valCred),
      ytd: Math.abs(g.saldoAtual) - Math.abs(d.saldoAtual),
    };
  });

  const GROUPS: Array<{ label: string; contas: Array<{ conta: string; desc: string; ant: number; atu: number }> }> = [
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

  return (
    <div className="space-y-6">
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
          value={fmtBRL(varTotal, true)}
          sub={varTotalPct !== null ? `${varTotalPct >= 0 ? '+' : ''}${varTotalPct.toFixed(1)}%` : '—'}
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
                              {varR >= 0 ? '+' : ''}{fmtBRL(varR)}
                            </td>
                            <td className={`py-2 px-3 text-right text-xs font-mono ${
                              varR > 0 ? 'text-emerald-600 dark:text-emerald-400'
                              : varR < 0 ? 'text-red-600 dark:text-red-400'
                              : 'text-muted-foreground'
                            }`}>
                              {varP !== null ? `${varP >= 0 ? '+' : ''}${varP.toFixed(1)}%` : '—'}
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
                          {gVar >= 0 ? '+' : ''}{fmtBRL(gVar)}
                        </td>
                        <td className={`py-2 px-3 text-right text-xs font-mono font-semibold ${
                          gVar > 0 ? 'text-emerald-600 dark:text-emerald-400'
                          : gVar < 0 ? 'text-red-600 dark:text-red-400'
                          : 'text-muted-foreground'
                        }`}>
                          {gVarPct !== null ? `${gVarPct >= 0 ? '+' : ''}${gVarPct.toFixed(1)}%` : '—'}
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
                    {varTotal >= 0 ? '+' : ''}{fmtBRL(varTotal)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-muted-foreground">
                    {varTotalPct !== null ? `${varTotalPct >= 0 ? '+' : ''}${varTotalPct.toFixed(1)}%` : '—'}
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

function EndividamentoTab({ data, fmtBRL, SectionTitle, KPI, TableRow2, colAnterior, colAtual, janAccounts, selectedMonth, selectedYear }: any) {
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
  const CA_ytdLbl = (isMo && selectedMonth > 1) ? `Jan – ${CA_MS[selectedMonth]}/${CA_yr2}` : colAtual;
  const CA_hasYTD = isMo && selectedMonth > 1 && !!janAccounts;
  const CA_nCols = isMo ? (CA_hasYTD ? 6 : 4) : 4;
  const jg = (id: string) => ((janAccounts as Record<string, any>) || {})[id] || { saldoAnt: 0, valDeb: 0, valCred: 0 };
  const jst = (id: string) => janAccounts ? Math.abs(jg(id).saldoAnt) : 0;
  const enrichCA = (conta: string, label: string, saldoAtu: number, deltaMes: number, janStart: number) => {
    const deltaYTD = saldoAtu - janStart;
    return {
      conta, label, saldoAtu,
      captMes:   Math.max(0,  deltaMes),
      amortMes:  Math.max(0, -deltaMes),
      captYTD:   Math.max(0,  deltaYTD),
      amortYTD:  Math.max(0, -deltaYTD),
      captAnual: Math.abs((accounts[conta] || {}).valCred || 0),
      amortAnual: Math.abs((accounts[conta] || {}).valDeb || 0),
    };
  };
  const janSt1CA = janAccounts ? Math.max(0, Math.abs(jg('2.1.1.02.01.001').saldoAnt) - Math.abs(jg('1.1.2.01.01.001').saldoAnt)) : 0;
  const janSt2CA = janAccounts ? Math.max(0, Math.abs(jg('2.1.4.01.01.007').saldoAnt) - Math.abs(jg('1.1.7.02.01.001').saldoAnt)) : 0;
  const cpCA = [
    ...cpSubs.map(s => enrichCA(s.conta, s.desc ? toTitleCase(s.desc) : s.conta, s.atu, s.atu - s.ant, jst(s.conta))),
    enrichCA('2.1.1.02.01.001', 'Banco Volks Floor Plan Novos VW',   netAcc1.atu, netAcc1.atu - netAcc1.ant, janSt1CA),
    enrichCA('2.1.4.01.01.007', 'Banco Volks Floor Plan Novos Audi', netAcc2.atu, netAcc2.atu - netAcc2.ant, janSt2CA),
  ];
  const lpCA = lpSubs.map(s => enrichCA(s.conta, s.desc ? toTitleCase(s.desc) : s.conta, s.atu, s.atu - s.ant, jst(s.conta)));
  const rollCA = (rows: { saldoAtu: number; captMes: number; amortMes: number; captYTD: number; amortYTD: number; captAnual: number; amortAnual: number }[]) =>
    rows.reduce((a, r) => ({
      saldoAtu:   a.saldoAtu   + r.saldoAtu,
      captMes:    a.captMes    + r.captMes,
      amortMes:   a.amortMes   + r.amortMes,
      captYTD:    a.captYTD    + r.captYTD,
      amortYTD:   a.amortYTD   + r.amortYTD,
      captAnual:  a.captAnual  + r.captAnual,
      amortAnual: a.amortAnual + r.amortAnual,
    }), { saldoAtu: 0, captMes: 0, amortMes: 0, captYTD: 0, amortYTD: 0, captAnual: 0, amortAnual: 0 });
  const cpTotCA = rollCA(cpCA);
  const lpTotCA = rollCA(lpCA);
  const grandCA = rollCA([...cpCA, ...lpCA]);
  const [showCaptAmort, setShowCaptAmort] = useState(false);
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

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI
          label="Empréstimos Curto Prazo"
          value={fmtBRL(cpTotal.atu, true)}
          sub={`Ant: ${fmtBRL(cpTotal.ant, true)} | Var: ${fmtBRL(cpTotal.atu - cpTotal.ant, true)}`}
          color={cpTotal.atu > cpTotal.ant ? 'red' : 'emerald'}
          icon="📅"
        />
        <KPI
          label="Empréstimos Longo Prazo"
          value={fmtBRL(lpTotal.atu, true)}
          sub={`Ant: ${fmtBRL(lpTotal.ant, true)} | Var: ${fmtBRL(lpTotal.atu - lpTotal.ant, true)}`}
          color={lpTotal.atu > lpTotal.ant ? 'red' : 'emerald'}
          icon="📆"
        />
        <KPI
          label="Endividamento Bancário Total"
          value={fmtBRL(totalAtu, true)}
          sub={`Ant: ${fmtBRL(totalAnt, true)} | Var: ${varTotalPct !== null ? (varTotal >= 0 ? '+' : '') + varTotalPct.toFixed(1) + '%' : '—'}`}
          color={totalAtu > totalAnt ? 'red' : 'emerald'}
          icon="🏦"
        />
      </div>

      {/* Tabela CP */}
      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon="📅">Empréstimos Bancários — Curto Prazo (2.1.1.02.03)</SectionTitle>
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
                {cpSubs.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Nenhuma sub-conta encontrada em 2.1.1.02.03</td></tr>
                ) : (
                  cpSubs.map(a => {
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
                          {varR >= 0 ? '+' : ''}{fmtBRL(varR)}
                        </td>
                        <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                          {varP !== null ? `${varP >= 0 ? '+' : ''}${varP.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
                {/* 2.1.1.02.01.001 líq. 1.1.2.01.01.001 */}
                {(() => {
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
                      <td className={`py-2 px-3 text-right text-sm font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {varR >= 0 ? '+' : ''}{fmtBRL(varR)}
                      </td>
                      <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {varP !== null ? `${varP >= 0 ? '+' : ''}${varP.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })()}
                {/* 2.1.4.01.01.007 líq. 1.1.7.02.01.001 */}
                {(() => {
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
                      <td className={`py-2 px-3 text-right text-sm font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {varR >= 0 ? '+' : ''}{fmtBRL(varR)}
                      </td>
                      <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {varP !== null ? `${varP >= 0 ? '+' : ''}${varP.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })()}
                <tr className="bg-muted/50 font-bold">
                  <td className="py-2.5 px-3 text-sm font-bold text-foreground">TOTAL CURTO PRAZO</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">{fmtBRL(cpTotal.ant)}</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-foreground">{fmtBRL(cpTotal.atu)}</td>
                  <td className={`py-2.5 px-3 text-right text-sm font-mono font-bold ${cpTotal.atu - cpTotal.ant > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {cpTotal.atu - cpTotal.ant >= 0 ? '+' : ''}{fmtBRL(cpTotal.atu - cpTotal.ant)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-muted-foreground">
                    {cpTotal.ant !== 0 ? `${((cpTotal.atu - cpTotal.ant) / cpTotal.ant * 100) >= 0 ? '+' : ''}${((cpTotal.atu - cpTotal.ant) / cpTotal.ant * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tabela LP */}
      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon="📆">Empréstimos Bancários — Longo Prazo (2.2.1.07)</SectionTitle>
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
                {lpSubs.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Nenhuma sub-conta encontrada em 2.2.1.07</td></tr>
                ) : (
                  lpSubs.map(a => {
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
                          {varR >= 0 ? '+' : ''}{fmtBRL(varR)}
                        </td>
                        <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                          {varP !== null ? `${varP >= 0 ? '+' : ''}${varP.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
                <tr className="bg-muted/50 font-bold">
                  <td className="py-2.5 px-3 text-sm font-bold text-foreground">TOTAL LONGO PRAZO</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">{fmtBRL(lpTotal.ant)}</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-foreground">{fmtBRL(lpTotal.atu)}</td>
                  <td className={`py-2.5 px-3 text-right text-sm font-mono font-bold ${lpTotal.atu - lpTotal.ant > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {lpTotal.atu - lpTotal.ant >= 0 ? '+' : ''}{fmtBRL(lpTotal.atu - lpTotal.ant)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-muted-foreground">
                    {lpTotal.ant !== 0 ? `${((lpTotal.atu - lpTotal.ant) / lpTotal.ant * 100) >= 0 ? '+' : ''}${((lpTotal.atu - lpTotal.ant) / lpTotal.ant * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Consolidado */}
      <Card className="border-2 border-border">
        <CardContent className="pt-6">
          <SectionTitle icon="🏦">Consolidado do Endividamento Bancário</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Classificação</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAnterior}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAtual}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Variação R$</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Var %</th>
                </tr>
              </thead>
              <tbody>
                {[{ label: 'Curto Prazo (2.1.1.02.03)', ant: cpTotal.ant, atu: cpTotal.atu }, { label: 'Longo Prazo (2.2.1.07)', ant: lpTotal.ant, atu: lpTotal.atu }, { label: 'TOTAL GERAL', ant: totalAnt, atu: totalAtu }].map((row, i) => {
                  const isTotal = i === 2;
                  const varR = row.atu - row.ant;
                  const varP = row.ant !== 0 ? (varR / row.ant) * 100 : null;
                  return (
                    <tr key={row.label} className={isTotal ? 'bg-muted/70 font-bold' : 'border-b border-border/50'}>
                      <td className={`py-2.5 px-3 text-sm ${isTotal ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{row.label}</td>
                      <td className={`py-2.5 px-3 text-right text-sm font-mono ${isTotal ? 'font-bold text-muted-foreground' : 'text-muted-foreground'}`}>{fmtBRL(row.ant)}</td>
                      <td className={`py-2.5 px-3 text-right text-sm font-mono ${isTotal ? 'font-bold text-foreground' : 'text-foreground'}`}>{fmtBRL(row.atu)}</td>
                      <td className={`py-2.5 px-3 text-right text-sm font-mono ${isTotal ? 'font-bold ' : ''}${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {varR >= 0 ? '+' : ''}{fmtBRL(varR)}
                      </td>
                      <td className={`py-2.5 px-3 text-right text-xs font-mono ${isTotal ? 'font-bold ' : ''}${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {varP !== null ? `${varP >= 0 ? '+' : ''}${varP.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
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
                      <th rowSpan={2} className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground align-bottom w-[13%]">Saldo Atual</th>
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
                    <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground w-[15%]">Saldo Atual</th>
                    <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-red-500 dark:text-red-400 border-l border-border/40 w-[20%]">Captação</th>
                    <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 w-[20%]">Amortização</th>
                  </tr>
                )}
              </thead>
              <tbody>
                <tr className="bg-muted/20">
                  <td colSpan={CA_nCols} className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Curto Prazo</td>
                </tr>
                {cpCA.map(r => (
                  <tr key={r.conta} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 text-foreground">
                      <span className="text-xs font-mono text-muted-foreground mr-2">{r.conta}</span>{r.label}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground">{fmtBRL(r.saldoAtu)}</td>
                    {movColsCA(r, false)}
                  </tr>
                ))}
                <tr className="bg-muted/50 border-b-2 border-border">
                  <td className="py-2.5 px-3 font-bold text-foreground">Total Curto Prazo</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">{fmtBRL(cpTotCA.saldoAtu)}</td>
                  {movColsCA(cpTotCA, true)}
                </tr>
                {lpCA.length > 0 && <>
                  <tr className="bg-muted/20">
                    <td colSpan={CA_nCols} className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Longo Prazo</td>
                  </tr>
                  {lpCA.map(r => (
                    <tr key={r.conta} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 text-foreground">
                        <span className="text-xs font-mono text-muted-foreground mr-2">{r.conta}</span>{r.label}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground">{fmtBRL(r.saldoAtu)}</td>
                      {movColsCA(r, false)}
                    </tr>
                  ))}
                  <tr className="bg-muted/50 border-b-2 border-border">
                    <td className="py-2.5 px-3 font-bold text-foreground">Total Longo Prazo</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">{fmtBRL(lpTotCA.saldoAtu)}</td>
                    {movColsCA(lpTotCA, true)}
                  </tr>
                </>}
                <tr className="bg-primary/10">
                  <td className="py-3 px-3 font-bold text-foreground">TOTAL GERAL</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-foreground">{fmtBRL(grandCA.saldoAtu)}</td>
                  {movColsCA(grandCA, true)}
                </tr>
              </tbody>
            </table>
          </div>
          </>}
        </CardContent>
      </Card>
    </div>
  );
}

function MutuoSociosTab({ data, fmtBRL, SectionTitle, KPI, colAnterior, colAtual, janAccounts, selectedMonth, selectedYear }: any) {
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

  return (
    <div className="space-y-6">
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
          value={fmtBRL(totalAtu - totalAnt, true)}
          sub={totalAnt !== 0 ? `${((totalAtu - totalAnt) / totalAnt * 100) >= 0 ? '+' : ''}${((totalAtu - totalAnt) / totalAnt * 100).toFixed(1)}%` : '—'}
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
                          {varR >= 0 ? '+' : ''}{fmtBRL(varR)}
                        </td>
                        <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                          {varP !== null ? `${varP >= 0 ? '+' : ''}${varP.toFixed(1)}%` : '—'}
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
                    {totalAtu - totalAnt >= 0 ? '+' : ''}{fmtBRL(totalAtu - totalAnt)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-muted-foreground">
                    {totalAnt !== 0 ? `${((totalAtu - totalAnt) / totalAnt * 100) >= 0 ? '+' : ''}${((totalAtu - totalAnt) / totalAnt * 100).toFixed(1)}%` : '—'}
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
  );
}

function ParcelamentoRefisTab({ data, fmtBRL, SectionTitle, KPI, colAnterior, colAtual, janAccounts, selectedMonth, selectedYear }: any) {
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

  const rows = [
    { conta: '2.1.2.02.07.020', desc: cpDesc, ant: cpAnt, atu: cpAtu, label: 'Curto Prazo (Circ.)' },
    { conta: '2.2.1.08.01.020', desc: lpDesc, ant: lpAnt, atu: lpAtu, label: 'Longo Prazo (Não Circ.)' },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI
          label="Curto Prazo (2.1.2.02.07.020)"
          value={fmtBRL(cpAtu, true)}
          sub={`Ant: ${fmtBRL(cpAnt, true)} | Var: ${fmtBRL(cpAtu - cpAnt, true)}`}
          color={cpAtu > cpAnt ? 'red' : 'emerald'}
          icon="📅"
        />
        <KPI
          label="Longo Prazo (2.2.1.08.01.020)"
          value={fmtBRL(lpAtu, true)}
          sub={`Ant: ${fmtBRL(lpAnt, true)} | Var: ${fmtBRL(lpAtu - lpAnt, true)}`}
          color={lpAtu > lpAnt ? 'red' : 'emerald'}
          icon="📆"
        />
        <KPI
          label="Total Parcelamento Refis"
          value={fmtBRL(totalAtu, true)}
          sub={`Ant: ${fmtBRL(totalAnt, true)} | Var: ${varTotalPct !== null ? (varTotal >= 0 ? '+' : '') + varTotalPct.toFixed(1) + '%' : '—'}`}
          color={totalAtu > totalAnt ? 'red' : 'emerald'}
          icon="🧾"
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
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Classificação</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAnterior}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">{colAtual}</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Variação R$</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Var %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(a => {
                  const varR = a.atu - a.ant;
                  const varP = a.ant !== 0 ? (varR / a.ant) * 100 : null;
                  return (
                    <tr key={a.conta} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3">
                        <span className="text-xs font-mono text-muted-foreground mr-2">{a.conta}</span>
                        <span className="text-sm text-foreground">{a.desc ? toTitleCase(a.desc) : a.conta}</span>
                      </td>
                      <td className="py-2 px-3 text-right text-xs text-muted-foreground">{a.label}</td>
                      <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">{fmtBRL(a.ant)}</td>
                      <td className="py-2 px-3 text-right text-sm font-mono font-semibold text-foreground">{fmtBRL(a.atu)}</td>
                      <td className={`py-2 px-3 text-right text-sm font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {varR >= 0 ? '+' : ''}{fmtBRL(varR)}
                      </td>
                      <td className={`py-2 px-3 text-right text-xs font-mono ${varR > 0 ? 'text-red-600 dark:text-red-400' : varR < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {varP !== null ? `${varP >= 0 ? '+' : ''}${varP.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/50 font-bold">
                  <td colSpan={2} className="py-2.5 px-3 text-sm font-bold text-foreground">TOTAL GERAL</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">{fmtBRL(totalAnt)}</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-foreground">{fmtBRL(totalAtu)}</td>
                  <td className={`py-2.5 px-3 text-right text-sm font-mono font-bold ${varTotal > 0 ? 'text-red-600 dark:text-red-400' : varTotal < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {varTotal >= 0 ? '+' : ''}{fmtBRL(varTotal)}
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

      {/* ── Tabela de Amortização ── */}
      {(() => {
        const CONTAS_AMORT = [
          { id: '2.1.2.02.07.020', desc: cpDesc },
          { id: '2.2.1.08.01.020', desc: lpDesc },
        ];
        const amortRows = CONTAS_AMORT.map(c => ({
          id: c.id,
          desc: c.desc,
          saldoInicioAno: getJanAnt(c.id),
          saldoAtual: Math.abs(getAcc(c.id).saldoAtual),
        }));
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
          value={fmtBRL(d.dfc.fluxoTotal, true)}
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

function AtivoTab({ data, SectionTitle, TableRow2, colAnterior, colAtual }: any) {
  const d = data;
  const accounts = d.accounts as Record<string, any>;
  const sa = (prefix: string) => subAccs(accounts, prefix);

  return (
    <div>
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

function PassivoTab({ data, SectionTitle, TableRow2, colAnterior, colAtual }: any) {
  const d = data;
  const accounts = d.accounts as Record<string, any>;
  const sa = (prefix: string) => subAccs(accounts, prefix);

  return (
    <div>
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

function ResultadoTab({ data, fmtBRL, SectionTitle, colAnterior, colAtual, selectedMonth, selectedYear }: any) {
  const d = data;
  const accounts = d.accounts as Record<string, any>;
  const get = (id: string) => accounts[id] || { saldoAnt: 0, saldoAtual: 0, valDeb: 0, valCred: 0, desc: '' };

  // Acumulado YTD — usa saldoAtual
  const absAtu = (id: string) => Math.abs(get(id).saldoAtual);
  // Movimento do mês — usa valDeb / valCred
  const absMon = (id: string) => { const a = get(id); return Math.abs(a.valDeb - a.valCred); };
  const isMonthly = selectedMonth > 0;

  // ── Valores Acumulado (saldoAtual) ────────────────────────────────────
  const recBruta    = absAtu('3.1');
  const impostosV   = absAtu('3.2');
  const devolucoes  = absAtu('3.3');
  const recLiq      = recBruta - impostosV - devolucoes;
  const CMV         = absAtu('4');
  const lucBruto    = recLiq - CMV;
  const rendOper    = absAtu('3.4');
  const rendFinanc  = absAtu('3.5');
  const rendNaoOper = absAtu('3.6');

  const allKeys5 = Object.keys(accounts).filter(k => k.startsWith('5.'));
  const leaves5  = allKeys5.filter(k => !allKeys5.some(other => other !== k && other.startsWith(k + '.')));

  const groupTotals: Record<string, { desc: string; valor: number }> = {};
  for (const k of leaves5) {
    const val = get(k).saldoAtual;
    if (val === 0) continue;
    const gk = k.split('.').slice(0, 2).join('.');
    if (!groupTotals[gk]) groupTotals[gk] = { desc: accounts[gk]?.desc || gk, valor: 0 };
    groupTotals[gk].valor += val;
  }

  // ── Valores Mês (valDeb / valCred) ───────────────────────────────────
  const recBrutaMes    = absMon('3.1');
  const impostosVMes   = absMon('3.2');
  const devolucoesMes  = absMon('3.3');
  const recLiqMes      = recBrutaMes - impostosVMes - devolucoesMes;
  const CMVMes         = absMon('4');
  const lucBrutoMes    = recLiqMes - CMVMes;
  const rendOperMes    = absMon('3.4');
  const rendFinancMes  = absMon('3.5');
  const rendNaoOperMes = absMon('3.6');

  const groupTotalsMes: Record<string, { desc: string; valor: number }> = {};
  for (const k of leaves5) {
    const val = get(k).valDeb - get(k).valCred;
    if (val === 0) continue;
    const gk = k.split('.').slice(0, 2).join('.');
    if (!groupTotalsMes[gk]) groupTotalsMes[gk] = { desc: accounts[gk]?.desc || gk, valor: 0 };
    groupTotalsMes[gk].valor += val;
  }

  // ── Merge union de despesas (acumulado + mês) ─────────────────────────
  const allDespKeys = Array.from(new Set([...Object.keys(groupTotals), ...Object.keys(groupTotalsMes)])).sort();
  const allDespRows = allDespKeys
    .map(k => ({
      conta: k,
      desc: groupTotals[k]?.desc || groupTotalsMes[k]?.desc || k,
      valorMes: groupTotalsMes[k]?.valor || 0,
      valorAcu: groupTotals[k]?.valor || 0,
    }))
    .filter(r => r.valorMes !== 0 || r.valorAcu !== 0);

  const despTotal    = allDespRows.reduce((s, x) => s + x.valorAcu, 0);
  const despTotalMes = allDespRows.reduce((s, x) => s + x.valorMes, 0);

  const lucAnteIR    = lucBruto    - despTotal    + rendOper    + rendFinanc    + rendNaoOper;
  const lucAnteIRMes = lucBrutoMes - despTotalMes + rendOperMes + rendFinancMes + rendNaoOperMes;
  const provisaoIR    = absAtu('6');
  const provisaoIRMes = absMon('6');
  const resLiq    = lucAnteIR    - provisaoIR;
  const resLiqMes = lucAnteIRMes - provisaoIRMes;

  // ── Cabeçalhos das colunas ────────────────────────────────────────────
  const MONTH_SHORT: Record<number, string> = {
    1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
    7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
  };
  const shortYear = String(selectedYear).slice(2);
  const headerMes = colAtual; // ex: "Jun/25"
  const headerAcu = isMonthly ? `Jan – ${MONTH_SHORT[selectedMonth]}/${shortYear}` : colAtual;

  // ── Linhas do DRE ─────────────────────────────────────────────────────
  type DRERow = { label: string; valueMes: number; valueAcu: number; type: string };
  const rows: DRERow[] = [
    { label: 'RECEITA BRUTA DE VENDAS',                    valueMes: recBrutaMes,    valueAcu: recBruta,    type: 'header'   },
    { label: '  (–) Impostos sobre Vendas',                valueMes: -impostosVMes,  valueAcu: -impostosV,  type: 'sub'      },
    { label: '  (–) Devoluções de Vendas',                 valueMes: -devolucoesMes, valueAcu: -devolucoes, type: 'sub'      },
    { label: 'RECEITA LÍQUIDA',                            valueMes: recLiqMes,      valueAcu: recLiq,      type: 'subtotal' },
    { label: '  (–) Custo das Mercadorias Vendidas (CMV)', valueMes: -CMVMes,        valueAcu: -CMV,        type: 'sub'      },
    { label: 'LUCRO (PREJUÍZO) BRUTO',                     valueMes: lucBrutoMes,    valueAcu: lucBruto,    type: 'subtotal' },
    { label: 'RENDAS OPERACIONAIS',                        valueMes: rendOperMes,    valueAcu: rendOper,    type: 'group'    },
    ...((rendNaoOper !== 0 || rendNaoOperMes !== 0)
      ? [{ label: 'RENDAS NÃO OPERACIONAIS', valueMes: rendNaoOperMes, valueAcu: rendNaoOper, type: 'group' }]
      : []),
    { label: 'DESPESAS OPERACIONAIS',                      valueMes: -despTotalMes,  valueAcu: -despTotal,  type: 'group'    },
    ...allDespRows.map(s => ({
      label: `    (–) ${toTitleCase(s.desc)}`,
      valueMes: -s.valorMes,
      valueAcu: -s.valorAcu,
      type: 'sub',
    })),
    { label: '  (+) Rendas Financeiras',                   valueMes: rendFinancMes,  valueAcu: rendFinanc,  type: 'sub'      },
    { label: 'RESULTADO ANTES DO IR/CSLL',                 valueMes: lucAnteIRMes,   valueAcu: lucAnteIR,   type: 'subtotal' },
    ...((provisaoIR > 0 || provisaoIRMes > 0)
      ? [{ label: '  (–) Provisão IR + CSLL', valueMes: -provisaoIRMes, valueAcu: -provisaoIR, type: 'sub' }]
      : []),
    { label: 'RESULTADO LÍQUIDO DO EXERCÍCIO',             valueMes: resLiqMes,      valueAcu: resLiq,      type: 'total'    },
  ];

  const renderCell = (val: number, important: boolean) => ({
    text: val >= 0 ? fmtBRL(val) : `(${fmtBRL(Math.abs(val))})`,
    color: important
      ? (val >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')
      : (val >= 0 ? 'text-foreground/80' : 'text-red-600 dark:text-red-400'),
  });

  return (
    <div>
      {/* KPIs — duplo quando mensal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Receita Bruta',       mes: recBrutaMes,  acu: recBruta,  icon: '💼' },
          { label: 'Receita Líquida',     mes: recLiqMes,    acu: recLiq,    icon: '📊' },
          { label: 'Lucro / Prej. Bruto', mes: lucBrutoMes,  acu: lucBruto,  icon: '📦' },
          { label: 'Resultado Líquido',   mes: resLiqMes,    acu: resLiq,    icon: '🏆' },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {kpi.icon} {kpi.label}
              </div>
              {isMonthly ? (
                <div className="space-y-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-foreground mb-0.5">{headerMes}</div>
                    <div className={cn('text-lg font-bold', kpi.mes >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                      {fmtBRL(kpi.mes, true)}
                    </div>
                  </div>
                  <div className="border-t border-border/50 pt-2">
                    <div className="text-[10px] uppercase tracking-wider text-foreground mb-0.5">{headerAcu}</div>
                    <div className={cn('text-xl font-bold', kpi.acu >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                      {fmtBRL(kpi.acu, true)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={cn('text-2xl font-bold', kpi.acu >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                  {fmtBRL(kpi.acu, true)}
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
                <th className={cn(
                  'py-2.5 px-4 text-right text-xs font-bold uppercase tracking-wider w-[22%]',
                  isMonthly ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                )}>
                  {headerAcu}
                </th>
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
                return (
                  <tr key={i} className={cn(
                    'border-b border-border',
                    isHeader && 'bg-emerald-50/50 dark:bg-emerald-950/20',
                    isSub    && 'bg-muted/30',
                    isTotal  && 'bg-primary/10',
                    isGroup  && 'bg-amber-50/40 dark:bg-amber-950/20',
                  )}>
                    <td className={cn('py-3 px-4 text-sm', important ? 'font-bold text-foreground' : 'text-muted-foreground')}>
                      {r.label}
                    </td>
                    {isMonthly && (
                      <td className={cn('py-3 px-4 text-right text-sm font-mono tabular-nums', important ? 'font-bold' : '', mesCell.color)}>
                        {mesCell.text}
                      </td>
                    )}
                    <td className={cn('py-3 px-4 text-right text-sm font-mono tabular-nums', important ? 'font-bold' : '', acuCell.color)}>
                      {acuCell.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted-foreground/70 leading-relaxed">
            {isMonthly
              ? `* Mês (${headerMes}): movimentação do período (Déb/Créd). Acumulado (${headerAcu}): saldo atual YTD.`
              : '* DRE calculada com base no saldo atual (YTD) do balancete. Para encerramento definitivo, consultar as demonstrações completas.'
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CaixaTab({ data, fmtBRL, SectionTitle, DFCRow, KPI, colAnterior, colAtual, janAccounts, selectedMonth, selectedYear }: any) {
  const d = data.dfc;
  const hasAcum = selectedMonth > 1 && janAccounts !== null;

  // ── Cabeçalhos de colunas ─────────────────────────────────────────────
  const MONTH_SHORT: Record<number, string> = {
    1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
    7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
  };
  const shortYear = String(selectedYear).slice(2);
  const headerMes = colAtual;
  const headerAcu = hasAcum ? `Jan – ${MONTH_SHORT[selectedMonth]}/${shortYear}` : '';

  // ── Cálculo acumulado YTD (Jan–Mês selecionado) ───────────────────────
  let dAcum: any = null;
  if (hasAcum) {
    const cur = data.accounts as Record<string, any>;
    const jan = janAccounts as Record<string, any>;
    const getAtu = (id: string) => Math.abs(cur[id]?.saldoAtual || 0);
    // saldoAnt do balancete de Janeiro = encerramento de Dez/ano anterior
    const getJanAnt = (id: string) => Math.abs(jan[id]?.saldoAnt || 0);

    // Variações patrimoniais YTD: saldoAtual(mês) - saldoAnt(Jan=Dez anterior)
    const estoques_ant = getJanAnt('1.1.2');
    const estoques_atu = getAtu('1.1.2');
    const estAudi_ant  = getJanAnt('1.1.7.02');
    const estAudi_atu  = getAtu('1.1.7.02');
    const dEstoque_acum    = (estoques_atu + estAudi_atu) - (estoques_ant + estAudi_ant);
    const dCred_acum       = getAtu('1.1.3') - getJanAnt('1.1.3');
    const dContasCorr_acum = getAtu('1.1.4') - getJanAnt('1.1.4');
    const dDespAntec_acum  = getAtu('1.1.6') - getJanAnt('1.1.6');
    const dValDiv_acum     = getAtu('1.1.5') - getJanAnt('1.1.5');
    const dFornec_acum     = (getAtu('2.1.3') + getAtu('2.1.4')) - (getJanAnt('2.1.3') + getJanAnt('2.1.4'));
    const dObrigTrib_acum  = getAtu('2.1.2.02') - getJanAnt('2.1.2.02');
    const dObrigTrab_acum  = getAtu('2.1.2.01') - getJanAnt('2.1.2.01');
    const dContasPag_acum  = getAtu('2.1.2.03') - getJanAnt('2.1.2.03');

    const ajusteEstoque_acum    = -dEstoque_acum;
    const ajusteCred_acum       = -dCred_acum;
    const ajusteContasCorr_acum = -dContasCorr_acum;
    const ajusteDespAntec_acum  = -dDespAntec_acum;
    const ajusteValDiv_acum     = -dValDiv_acum;
    const ajusteFornec_acum     = dFornec_acum;
    const ajusteTrib_acum       = dObrigTrib_acum;
    const ajusteTrab_acum       = dObrigTrab_acum;
    const ajusteContasPag_acum  = dContasPag_acum;

    // Contas de resultado: saldoAtual já é o acumulado YTD
    const absAtu_acum = (id: string) => Math.abs(cur[id]?.saldoAtual || 0);
    const despOper5Net_acum = Math.abs(cur['5']?.saldoAtual || 0);
    const resLiq_dfc_acum = absAtu_acum('3.1') - absAtu_acum('3.2') - absAtu_acum('3.3')
                           - absAtu_acum('4') - despOper5Net_acum
                           + absAtu_acum('3.4') + absAtu_acum('3.5') + absAtu_acum('3.6') - absAtu_acum('6');
    const deprec_acum = Math.abs(cur['5.5.2.07.20']?.saldoAtual || 0);

    const fluxoOper_acum = resLiq_dfc_acum + deprec_acum
      + ajusteEstoque_acum + ajusteCred_acum + ajusteContasCorr_acum + ajusteValDiv_acum
      + ajusteDespAntec_acum + ajusteFornec_acum + ajusteTrib_acum + ajusteTrab_acum + ajusteContasPag_acum;

    // Investimento
    const dImobiliz_acum     = getAtu('1.5.5')          - getJanAnt('1.5.5');
    const dIntangivel_acum   = getAtu('1.5.7')          - getJanAnt('1.5.7');
    const dRealizLPCred_acum = getAtu('1.5.1.01.52')    - getJanAnt('1.5.1.01.52');
    const dInvestimentos_acum = getAtu('1.5.3')         - getJanAnt('1.5.3');
    const fluxoInvest_acum = -dImobiliz_acum - dIntangivel_acum - dRealizLPCred_acum - dInvestimentos_acum;

    // Financiamento
    const emprestCP_ant   = getJanAnt('2.1.1');    const emprestCP_atu   = getAtu('2.1.1');
    const emprestLP_ant   = getJanAnt('2.2.1.07'); const emprestLP_atu   = getAtu('2.2.1.07');
    const pessoasLig_ant  = getJanAnt('2.2.1.01'); const pessoasLig_atu  = getAtu('2.2.1.01');
    const debitosLig_ant  = getJanAnt('2.2.1.02'); const debitosLig_atu  = getAtu('2.2.1.02');
    const arrendLP_ant    = getJanAnt('2.2.1.15'); const arrendLP_atu    = getAtu('2.2.1.15');
    const outrosPassLP_ant = getJanAnt('2.2.3');   const outrosPassLP_atu = getAtu('2.2.3');
    const grupo2_2_1_ant  = getJanAnt('2.2.1');    const grupo2_2_1_atu  = getAtu('2.2.1');
    const outros2_2_1_ant = grupo2_2_1_ant - emprestLP_ant - pessoasLig_ant - debitosLig_ant - arrendLP_ant;
    const outros2_2_1_atu = grupo2_2_1_atu - emprestLP_atu - pessoasLig_atu - debitosLig_atu - arrendLP_atu;

    const dEmprestCP_acum   = emprestCP_atu   - emprestCP_ant;
    const dEmprestLP_acum   = emprestLP_atu   - emprestLP_ant;
    const dPessoasLig_acum  = pessoasLig_atu  - pessoasLig_ant;
    const dDebitosLig_acum  = debitosLig_atu  - debitosLig_ant;
    const dArrendLP_acum    = arrendLP_atu    - arrendLP_ant;
    const dOutrosPassLP_acum = outrosPassLP_atu - outrosPassLP_ant;
    const dOutros2_2_1_acum = outros2_2_1_atu - outros2_2_1_ant;

    const fluxoFinanc_acum = dEmprestCP_acum + dEmprestLP_acum + dPessoasLig_acum + dDebitosLig_acum
                           + dArrendLP_acum + dOutrosPassLP_acum + dOutros2_2_1_acum;
    const fluxoTotal_acum  = fluxoOper_acum + fluxoInvest_acum + fluxoFinanc_acum;
    const disponibAnt_jan  = getJanAnt('1.1.1');
    const varCaixaReal_acum = getAtu('1.1.1') - disponibAnt_jan;

    dAcum = {
      resLiq: resLiq_dfc_acum, deprec: deprec_acum,
      ajusteEstoque: ajusteEstoque_acum, ajusteCred: ajusteCred_acum,
      ajusteContasCorr: ajusteContasCorr_acum, ajusteValDiv: ajusteValDiv_acum,
      ajusteDespAntec: ajusteDespAntec_acum, ajusteFornec: ajusteFornec_acum,
      ajusteTrib: ajusteTrib_acum, ajusteTrab: ajusteTrab_acum,
      ajusteContasPag: ajusteContasPag_acum,
      fluxoOper: fluxoOper_acum, fluxoInvest: fluxoInvest_acum,
      fluxoFinanc: fluxoFinanc_acum, fluxoTotal: fluxoTotal_acum,
      varCaixaReal: varCaixaReal_acum,
      dEstoque: dEstoque_acum, dCred: dCred_acum, dContasCorr: dContasCorr_acum,
      dValDiv: dValDiv_acum, dDespAntec: dDespAntec_acum, dFornec: dFornec_acum,
      dObrigTrib: dObrigTrib_acum, dObrigTrab: dObrigTrab_acum, dContasPag: dContasPag_acum,
      dEmprestCP: dEmprestCP_acum, dEmprestLP: dEmprestLP_acum,
      dPessoasLig: dPessoasLig_acum, dDebitosLig: dDebitosLig_acum,
      dArrendLP: dArrendLP_acum, dIntangivel: dIntangivel_acum,
      dRealizLPCred: dRealizLPCred_acum, dInvestimentos: dInvestimentos_acum,
      dOutrosPassLP: dOutrosPassLP_acum, dOutros2_2_1: dOutros2_2_1_acum,
      outros2_2_1Ant: outros2_2_1_ant, outros2_2_1Atu: outros2_2_1_atu,
      despOper5Net: despOper5Net_acum,
      emprestCPAnt: emprestCP_ant, emprestCPAtu: emprestCP_atu,
      emprestLPAnt: emprestLP_ant, emprestLPAtu: emprestLP_atu,
      pessoasLigAnt: pessoasLig_ant, pessoasLigAtu: pessoasLig_atu,
      debitosLigAnt: debitosLig_ant, debitosLigAtu: debitosLig_atu,
      arrendLPAnt: arrendLP_ant, arrendLPAtu: arrendLP_atu,
      estoques: { ant: estoques_ant, atu: estoques_atu },
      estAudi:  { ant: estAudi_ant,  atu: estAudi_atu  },
      imobiliz: { ant: getJanAnt('1.5.5'), atu: getAtu('1.5.5') },
      investimentosAnt: getJanAnt('1.5.3'), investimentosAtu: getAtu('1.5.3'),
      disponibAnt: disponibAnt_jan, disponibAtu: getAtu('1.1.1'),
    };
  }

  // Alias para o acumulado ou mensal dependendo do modo (usado nos KPIs sem acum)
  const da = dAcum ?? d;

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Fluxo Operacional',    mes: d.fluxoOper,   acu: dAcum?.fluxoOper,   icon: '⚙️',  color: (v: number) => v >= 0 ? 'emerald' : 'red',   sub: 'Principal fonte de caixa' },
          { label: 'Fluxo de Investimento', mes: d.fluxoInvest, acu: dAcum?.fluxoInvest, icon: '🏗️', color: (v: number) => v >= 0 ? 'emerald' : 'amber',  sub: 'Imobilizado + Intangível + Créditos LP' },
          { label: 'Fluxo de Financiamento',mes: d.fluxoFinanc, acu: dAcum?.fluxoFinanc, icon: '🏛️', color: (v: number) => v >= 0 ? 'amber' : 'red',     sub: `Floor Plan ${d.dEmprestCP >= 0 ? '+' : ''}${fmtBRL(d.dEmprestCP, true)} | Arrend. ${d.dArrendLP >= 0 ? '+' : ''}${fmtBRL(d.dArrendLP, true)}` },
          { label: 'Var. Total de Caixa',   mes: d.fluxoTotal,  acu: dAcum?.fluxoTotal,  icon: '💰',  color: (v: number) => v >= 0 ? 'emerald' : 'red',   sub: `Var. real no balanço: ${fmtBRL(d.varCaixaReal, true)}` },
        ].map((kpi, i) => {
          const colorClasses: any = {
            emerald: 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
            amber:   'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30',
            red:     'border-l-red-500 bg-red-50 dark:bg-red-950/30',
          };
          return (
            <Card key={i} className={cn('border-l-4', colorClasses[kpi.color(kpi.mes)])}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {kpi.icon} {kpi.label}
                </div>
              </CardHeader>
              <CardContent>
                {hasAcum ? (
                  <div className="space-y-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-foreground mb-0.5">{headerMes}</div>
                      <div className={cn('text-lg font-bold', kpi.mes >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                        {kpi.mes > 0 ? '+' : kpi.mes < 0 ? '−' : ''}{fmtBRL(kpi.mes, true)}
                      </div>
                    </div>
                    <div className="border-t border-border/50 pt-2">
                      <div className="text-[10px] uppercase tracking-wider text-foreground mb-0.5">{headerAcu}</div>
                      <div className={cn('text-xl font-bold', (kpi.acu ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                        {(kpi.acu ?? 0) > 0 ? '+' : (kpi.acu ?? 0) < 0 ? '−' : ''}{fmtBRL(kpi.acu ?? 0, true)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={cn('text-2xl font-bold mb-1', kpi.mes >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{kpi.mes > 0 ? '+' : kpi.mes < 0 ? '−' : ''}{fmtBRL(kpi.mes, true)}</div>
                    <div className="text-sm text-muted-foreground">{kpi.sub}</div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-6">
        <SectionTitle icon="💰">Demonstração do Fluxo de Caixa — Método Indireto</SectionTitle>
        <table className="dfc-table w-full border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Descrição</th>
              <th className={cn('py-2.5 px-3 text-right text-xs uppercase tracking-wider', hasAcum ? 'font-bold text-blue-600 dark:text-blue-400 w-[20%]' : 'text-muted-foreground w-[22%]')}>
                {hasAcum ? headerMes : 'Valor (R$)'}
              </th>
              {hasAcum && (
                <th className="py-2.5 px-3 text-right text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 w-[20%] border-l border-border/30">
                  {headerAcu}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            <DFCRow label="ATIVIDADES OPERACIONAIS" value={0} value2={0} hasAcum={hasAcum} highlight />
            <DFCRow label={`${d.resLiq >= 0 ? '(+)' : '(–)'} Resultado Líquido do Exercício (base NBC TG 03)`} value={d.resLiq} value2={dAcum?.resLiq} hasAcum={hasAcum} indent={1} />
            <DFCRow label="(+) Depreciações e Amortizações (não caixa)" value={d.deprec} value2={dAcum?.deprec} hasAcum={hasAcum} indent={1} />
            <DFCRow label={`${d.ajusteEstoque >= 0 ? '(+)' : '(–)'} Variação de Estoques VW + Audi ${d.dEstoque < 0 ? '— redução (fonte de caixa)' : '— aumento (uso de caixa)'} (1.1.2 + 1.1.7.02)`} value={d.ajusteEstoque} value2={dAcum?.ajusteEstoque} hasAcum={hasAcum} indent={1} />
            <DFCRow label={`    ↳ Estoques VW (1.1.2): ${fmtBRL(data.estoques.ant, true)} → ${fmtBRL(data.estoques.atu, true)}`} value={-(data.estoques.atu - data.estoques.ant)} value2={dAcum ? -(dAcum.estoques.atu - dAcum.estoques.ant) : undefined} hasAcum={hasAcum} indent={2} />
            <DFCRow label={`    ↳ Estoques Audi (1.1.7.02): ${fmtBRL(data.estAudi.ant, true)} → ${fmtBRL(data.estAudi.atu, true)}`} value={-(data.estAudi.atu - data.estAudi.ant)} value2={dAcum ? -(dAcum.estAudi.atu - dAcum.estAudi.ant) : undefined} hasAcum={hasAcum} indent={2} />
            <DFCRow label={`${d.ajusteCred >= 0 ? '(+)' : '(–)'} Variação de Créditos de Vendas (1.1.3) ${d.dCred < 0 ? '— redução (fonte de caixa)' : '— aumento (uso de caixa)'}`} value={d.ajusteCred} value2={dAcum?.ajusteCred} hasAcum={hasAcum} indent={1} />
            {(d.dContasCorr !== 0 || (dAcum && dAcum.dContasCorr !== 0)) && <DFCRow label={`${d.ajusteContasCorr >= 0 ? '(+)' : '(–)'} Variação de Contas Correntes (1.1.4) ${d.dContasCorr > 0 ? '— aumento (uso de caixa)' : '— redução (fonte de caixa)'}`} value={d.ajusteContasCorr} value2={dAcum?.ajusteContasCorr} hasAcum={hasAcum} indent={1} />}
            {(d.dValDiv !== 0 || (dAcum && dAcum.dValDiv !== 0)) && <DFCRow label={`${d.ajusteValDiv >= 0 ? '(+)' : '(–)'} Variação de Valores Diversos (1.1.5) ${d.dValDiv > 0 ? '— aumento (uso de caixa)' : '— redução (fonte de caixa)'}`} value={d.ajusteValDiv} value2={dAcum?.ajusteValDiv} hasAcum={hasAcum} indent={1} />}
            <DFCRow label={`${d.ajusteDespAntec >= 0 ? '(+)' : '(–)'} Variação de Despesas Antecipadas (1.1.6) ${d.dDespAntec > 0 ? '— aumento (uso de caixa)' : '— redução (fonte de caixa)'}`} value={d.ajusteDespAntec} value2={dAcum?.ajusteDespAntec} hasAcum={hasAcum} indent={1} />
            <DFCRow label={`${d.ajusteFornec >= 0 ? '(+)' : '(–)'} Variação de Fornecedores (2.1.3 + 2.1.4) ${d.dFornec < 0 ? '— redução (uso de caixa)' : '— aumento (fonte)'}`} value={d.ajusteFornec} value2={dAcum?.ajusteFornec} hasAcum={hasAcum} indent={1} />
            <DFCRow label={`${d.ajusteTrib >= 0 ? '(+)' : '(–)'} Variação de Obrigações Tributárias (2.1.2.02)`} value={d.ajusteTrib} value2={dAcum?.ajusteTrib} hasAcum={hasAcum} indent={1} />
            <DFCRow label={`${d.ajusteTrab >= 0 ? '(+)' : '(–)'} Variação de Obrigações Trabalhistas (2.1.2.01)`} value={d.ajusteTrab} value2={dAcum?.ajusteTrab} hasAcum={hasAcum} indent={1} />
            <DFCRow label={`${d.ajusteContasPag >= 0 ? '(+)' : '(–)'} Variação de Contas a Pagar (2.1.2.03)`} value={d.ajusteContasPag} value2={dAcum?.ajusteContasPag} hasAcum={hasAcum} indent={1} />
            <DFCRow label="CAIXA LÍQUIDO DAS ATIVIDADES OPERACIONAIS" value={d.fluxoOper} value2={dAcum?.fluxoOper} hasAcum={hasAcum} total highlight />

            <DFCRow label="ATIVIDADES DE INVESTIMENTO" value={0} value2={0} hasAcum={hasAcum} highlight />
            <DFCRow label={`${-(data.imobiliz.atu - data.imobiliz.ant) >= 0 ? '(+)' : '(–)'} Variação Líquida do Imobilizado (1.5.5)`} value={-(data.imobiliz.atu - data.imobiliz.ant)} value2={dAcum ? -(dAcum.imobiliz.atu - dAcum.imobiliz.ant) : undefined} hasAcum={hasAcum} indent={1} />
            <DFCRow label={`${-d.dIntangivel >= 0 ? '(+)' : '(–)'} Variação Líquida do Intangível (1.5.7)`} value={-d.dIntangivel} value2={dAcum ? -dAcum.dIntangivel : undefined} hasAcum={hasAcum} indent={1} />
            {(d.dInvestimentos !== 0 || (dAcum && dAcum.dInvestimentos !== 0)) && <DFCRow label={`${-d.dInvestimentos >= 0 ? '(+)' : '(–)'} Variação de Investimentos (1.5.3) ${fmtBRL(d.investimentosAnt, true)} → ${fmtBRL(d.investimentosAtu, true)}`} value={-d.dInvestimentos} value2={dAcum ? -dAcum.dInvestimentos : undefined} hasAcum={hasAcum} indent={1} />}
            <DFCRow label={`${-d.dRealizLPCred >= 0 ? '(+)' : '(–)'} Variação Créditos c/ Ligadas LP (1.5.1.01.52)`} value={-d.dRealizLPCred} value2={dAcum ? -dAcum.dRealizLPCred : undefined} hasAcum={hasAcum} indent={1} />
            <DFCRow label="CAIXA LÍQUIDO DAS ATIVIDADES DE INVESTIMENTO" value={d.fluxoInvest} value2={dAcum?.fluxoInvest} hasAcum={hasAcum} total highlight />

            <DFCRow label="ATIVIDADES DE FINANCIAMENTO" value={0} value2={0} hasAcum={hasAcum} highlight />
            {(d.emprestCPAnt > 0 || d.emprestCPAtu > 0) && (
              <DFCRow label={`${d.dEmprestCP >= 0 ? '(+) Captação' : '(–) Amortização'} Empréstimos CP / Floor Plan  (${fmtBRL(d.emprestCPAnt, true)} → ${fmtBRL(d.emprestCPAtu, true)})`} value={d.dEmprestCP} value2={dAcum?.dEmprestCP} hasAcum={hasAcum} indent={1} />
            )}
            {(d.emprestLPAnt > 0 || d.emprestLPAtu > 0) && (
              <DFCRow label={`${d.dEmprestLP >= 0 ? '(+) Captação' : '(–) Amortização'} Empréstimos Bancários LP  (${fmtBRL(d.emprestLPAnt, true)} → ${fmtBRL(d.emprestLPAtu, true)})`} value={d.dEmprestLP} value2={dAcum?.dEmprestLP} hasAcum={hasAcum} indent={1} />
            )}
            {(d.pessoasLigAnt > 0 || d.pessoasLigAtu > 0) && (
              <DFCRow label={`${d.dPessoasLig >= 0 ? '(+) Aporte' : '(–) Retirada'} Sócios / Pessoas Ligadas  (${fmtBRL(d.pessoasLigAnt, true)} → ${fmtBRL(d.pessoasLigAtu, true)})`} value={d.dPessoasLig} value2={dAcum?.dPessoasLig} hasAcum={hasAcum} indent={1} />
            )}
            {(d.debitosLigAnt > 0 || d.debitosLigAtu > 0) && (
              <DFCRow label={`${d.dDebitosLig >= 0 ? '(+) Captação' : '(–) Liquidação'} Débitos com Ligadas LP  (${fmtBRL(d.debitosLigAnt, true)} → ${fmtBRL(d.debitosLigAtu, true)})`} value={d.dDebitosLig} value2={dAcum?.dDebitosLig} hasAcum={hasAcum} indent={1} />
            )}
            {(d.arrendLPAnt > 0 || d.arrendLPAtu > 0) && (
              <DFCRow label={`${d.dArrendLP >= 0 ? '(+) Novos Arrendamentos LP' : '(–) Amortização Arrendamentos LP'}  (${fmtBRL(d.arrendLPAnt, true)} → ${fmtBRL(d.arrendLPAtu, true)})`} value={d.dArrendLP} value2={dAcum?.dArrendLP} hasAcum={hasAcum} indent={1} />
            )}
            {(d.dOutrosPassLP !== 0) && (
              <DFCRow label={`${d.dOutrosPassLP >= 0 ? '(+) Captação' : '(–) Liquidação'} Outros Passivos LP (2.2.3)`} value={d.dOutrosPassLP} value2={dAcum?.dOutrosPassLP} hasAcum={hasAcum} indent={1} />
            )}
            {(Math.abs(d.dOutros2_2_1) > 0.01) && (
              <DFCRow label={`${d.dOutros2_2_1 >= 0 ? '(+)' : '(–)'} Outros Passivos L.P. não mapeados (2.2.1 — demais) (${fmtBRL(d.outros2_2_1Ant, true)} → ${fmtBRL(d.outros2_2_1Atu, true)})`} value={d.dOutros2_2_1} value2={dAcum?.dOutros2_2_1} hasAcum={hasAcum} indent={1} />
            )}
            <DFCRow label="CAIXA LÍQUIDO DAS ATIVIDADES DE FINANCIAMENTO" value={d.fluxoFinanc} value2={dAcum?.fluxoFinanc} hasAcum={hasAcum} total highlight />
          </tbody>
          <tfoot>
            <tr className="bg-emerald-50/50 dark:bg-emerald-950/20 border-t-2 border-emerald-500/30">
              <td className="py-3.5 px-3 text-sm font-bold text-foreground">VARIAÇÃO TOTAL DE CAIXA NO PERÍODO</td>
              <td className={cn('py-3.5 px-3 text-right font-mono text-base font-bold', d.fluxoTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{(d.fluxoTotal > 0 ? '+' : d.fluxoTotal < 0 ? '−' : '') + fmtBRL(d.fluxoTotal)}</td>
              {hasAcum && <td className={cn('py-3.5 px-3 text-right font-mono text-base font-bold border-l border-border/30', (dAcum.fluxoTotal ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{((dAcum.fluxoTotal ?? 0) > 0 ? '+' : (dAcum.fluxoTotal ?? 0) < 0 ? '−' : '') + fmtBRL(dAcum.fluxoTotal)}</td>}
            </tr>
            <tr className="bg-muted/30">
              <td className="py-2.5 px-3 text-sm text-muted-foreground">Saldo de Caixa — Período Anterior</td>
              <td className="py-2.5 px-3 text-right font-mono text-sm text-muted-foreground">{fmtBRL(data.disponib.ant)}</td>
              {hasAcum && <td className="py-2.5 px-3 text-right font-mono text-sm text-muted-foreground border-l border-border/30">{fmtBRL(dAcum.disponibAnt)}</td>}
            </tr>
            <tr className="bg-muted/30">
              <td className="py-2.5 px-3 text-sm text-muted-foreground">Saldo de Caixa — Período Atual</td>
              <td className="py-2.5 px-3 text-right font-mono text-sm font-semibold text-foreground">{fmtBRL(data.disponib.atu)}</td>
              {hasAcum && <td className="py-2.5 px-3 text-right font-mono text-sm font-semibold text-foreground border-l border-border/30">{fmtBRL(dAcum.disponibAtu)}</td>}
            </tr>
            <tr className="bg-violet-50/50 dark:bg-violet-950/20 border-t border-violet-500/30">
              <td className="py-3 px-3 text-sm font-semibold text-foreground/80">Variação Real de Caixa (conferência com balanço)</td>
              <td className={cn('py-3 px-3 text-right font-mono text-sm font-bold', d.varCaixaReal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{(d.varCaixaReal > 0 ? '+' : d.varCaixaReal < 0 ? '−' : '') + fmtBRL(d.varCaixaReal)}</td>
              {hasAcum && <td className={cn('py-3 px-3 text-right font-mono text-sm font-bold border-l border-border/30', dAcum.varCaixaReal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{(dAcum.varCaixaReal > 0 ? '+' : dAcum.varCaixaReal < 0 ? '−' : '') + fmtBRL(dAcum.varCaixaReal)}</td>}
            </tr>
          </tfoot>
        </table>
        <p className="mt-4 text-xs text-muted-foreground/70 leading-relaxed">
          {hasAcum
            ? `* ${headerMes}: movimentação do mês (Déb/Créd). ${headerAcu}: variação patrimonial usando saldo de Dez/${String(selectedYear - 1).slice(2)} como base (saldoAnt de Jan/${shortYear}); contas de resultado consideradas pelo saldoAtual acumulado.`
            : '* DFC pelo método indireto. Correções aplicadas: (1) Intangível 1.5.7 incluído no investimento; (2) Realizável LP limitado aos créditos com ligadas 1.5.1.01.52; (3) Receitas Diferidas 2.2.2 excluída do financiamento — contém ICMS ST Diferido (não-caixa); (4) Arrendamentos LP mapeados em 2.2.1.15; (5) Estoque Audi (1.1.7.02) consolidado no ajuste operacional de estoques.'
          }
        </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── FLUXO DE CAIXA DIRETO ──────────────────────────────────────────────────
function CaixaDiretoTab({ data, fmtBRL, SectionTitle, DFCRow, KPI, colAnterior, colAtual, janAccounts, selectedMonth, selectedYear }: any) {
  const d = data.dfc;
  const rec = data.receitas;
  const hasAcum = selectedMonth > 1 && janAccounts !== null;

  // ── Cabeçalhos de colunas ─────────────────────────────────────────────
  const MONTH_SHORT: Record<number, string> = {
    1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
    7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
  };
  const shortYear = String(selectedYear).slice(2);
  const headerMes = colAtual;
  const headerAcu = hasAcum ? `Jan – ${MONTH_SHORT[selectedMonth]}/${shortYear}` : '';

  // ── Mês: contas de resultado via valDeb/valCred; patrimonial via saldoAtual–saldoAnt ──
  const mAccounts = data.accounts as Record<string, any>;
  const absMov = (id: string) => { const a = mAccounts[id] || {}; return Math.abs((a.valDeb || 0) - (a.valCred || 0)); };
  const recBrutaMes    = absMov('3.1');
  const devolucoesMes  = absMov('3.3');
  const impostosVMes   = absMov('3.2');
  const CMVMes         = absMov('4');
  const rendOperMes    = absMov('3.4');
  const rendFinancMes  = absMov('3.5');
  const rendNaoOperMes = absMov('3.6');
  const provisaoIRMes  = absMov('6');

  const recebClientes = recBrutaMes - devolucoesMes - d.dCred - d.dContasCorr;
  const pagFornec     = -(CMVMes + d.dEstoque - d.dFornec);
  const pagImpostos   = -(impostosVMes - d.dObrigTrib);
  const despOperCaixa = -(
    (d.despOper5Net - d.deprec) - d.dContasPag - d.dObrigTrab + d.dDespAntec + d.dValDiv
  );
  const pagIR           = -provisaoIRMes;
  const rendasRecebidas = rendOperMes + rendFinancMes + rendNaoOperMes;
  const fluxoOperDireto = recebClientes + pagFornec + pagImpostos + despOperCaixa + pagIR + rendasRecebidas;
  const diff = Math.abs(fluxoOperDireto - d.fluxoOper);

  // ── Acumulado YTD: usando saldoAtual (resultado) e variação Jan→mês (patrimonial) ──
  let acum: any = null;
  if (hasAcum) {
    const cur = data.accounts as Record<string, any>;
    const jan = janAccounts as Record<string, any>;
    const getAtu  = (id: string) => Math.abs(cur[id]?.saldoAtual || 0);
    const getJanAnt = (id: string) => Math.abs(jan[id]?.saldoAnt || 0);

    // Contas de resultado: saldoAtual já acumulado YTD
    const recBruta_a       = getAtu('3.1');
    const devolucoes_a     = getAtu('3.3');
    const impostosV_a      = getAtu('3.2');
    const CMV_a            = getAtu('4');
    const rendOper_a       = getAtu('3.4');
    const rendFinanc_a     = getAtu('3.5');
    const rendNaoOper_a    = getAtu('3.6');
    const provisaoIR_a     = getAtu('6');
    const despOper5Net_a   = Math.abs(cur['5']?.saldoAtual || 0);
    const deprec_a         = Math.abs(cur['5.5.2.07.20']?.saldoAtual || 0);

    // Variações patrimoniais YTD: saldoAtual(mês) – saldoAnt(Jan=Dez anterior)
    const dCred_a       = getAtu('1.1.3')       - getJanAnt('1.1.3');
    const dContasCorr_a = getAtu('1.1.4')       - getJanAnt('1.1.4');
    const dEstoque_a    = (getAtu('1.1.2') + getAtu('1.1.7.02')) - (getJanAnt('1.1.2') + getJanAnt('1.1.7.02'));
    const dFornec_a     = (getAtu('2.1.3') + getAtu('2.1.4')) - (getJanAnt('2.1.3') + getJanAnt('2.1.4'));
    const dObrigTrib_a  = getAtu('2.1.2.02')    - getJanAnt('2.1.2.02');
    const dObrigTrab_a  = getAtu('2.1.2.01')    - getJanAnt('2.1.2.01');
    const dContasPag_a  = getAtu('2.1.2.03')    - getJanAnt('2.1.2.03');
    const dDespAntec_a  = getAtu('1.1.6')       - getJanAnt('1.1.6');
    const dValDiv_a     = getAtu('1.1.5')        - getJanAnt('1.1.5');

    // Derivados FC Direto acumulado
    const recebClientes_a = recBruta_a - devolucoes_a - dCred_a - dContasCorr_a;
    const pagFornec_a     = -(CMV_a + dEstoque_a - dFornec_a);
    const pagImpostos_a   = -(impostosV_a - dObrigTrib_a);
    const despOperCaixa_a = -(
      (despOper5Net_a - deprec_a) - dContasPag_a - dObrigTrab_a + dDespAntec_a + dValDiv_a
    );
    const pagIR_a           = -provisaoIR_a;
    const rendasRecebidas_a = rendOper_a + rendFinanc_a + rendNaoOper_a;
    const fluxoOperDireto_a = recebClientes_a + pagFornec_a + pagImpostos_a + despOperCaixa_a + pagIR_a + rendasRecebidas_a;

    // Investimento e financiamento: reusa dAcum calculado da mesma forma
    const dImobiliz_a     = getAtu('1.5.5')       - getJanAnt('1.5.5');
    const dIntangivel_a   = getAtu('1.5.7')        - getJanAnt('1.5.7');
    const dRealizLPCred_a = getAtu('1.5.1.01.52') - getJanAnt('1.5.1.01.52');
    const dInvest_a       = getAtu('1.5.3')        - getJanAnt('1.5.3');
    const fluxoInvest_a   = -dImobiliz_a - dIntangivel_a - dRealizLPCred_a - dInvest_a;

    const empCP_ant = getJanAnt('2.1.1');     const empCP_atu = getAtu('2.1.1');
    const empLP_ant = getJanAnt('2.2.1.07'); const empLP_atu = getAtu('2.2.1.07');
    const pesLig_ant = getJanAnt('2.2.1.01'); const pesLig_atu = getAtu('2.2.1.01');
    const debLig_ant = getJanAnt('2.2.1.02'); const debLig_atu = getAtu('2.2.1.02');
    const arr_ant    = getJanAnt('2.2.1.15'); const arr_atu    = getAtu('2.2.1.15');
    const outLP_ant  = getJanAnt('2.2.3');    const outLP_atu  = getAtu('2.2.3');
    const g221_ant   = getJanAnt('2.2.1');    const g221_atu   = getAtu('2.2.1');
    const out221_ant = g221_ant - empLP_ant - pesLig_ant - debLig_ant - arr_ant;
    const out221_atu = g221_atu - empLP_atu - pesLig_atu - debLig_atu - arr_atu;
    const fluxoFinanc_a = (empCP_atu - empCP_ant) + (empLP_atu - empLP_ant) + (pesLig_atu - pesLig_ant)
                        + (debLig_atu - debLig_ant) + (arr_atu - arr_ant) + (outLP_atu - outLP_ant)
                        + (out221_atu - out221_ant);
    const fluxoTotal_a  = fluxoOperDireto_a + fluxoInvest_a + fluxoFinanc_a;
    const disponibJan   = getJanAnt('1.1.1');

    acum = {
      recBruta: recBruta_a, devolucoes: devolucoes_a,
      dCred: dCred_a, dContasCorr: dContasCorr_a,
      CMV: CMV_a, dEstoque: dEstoque_a, dFornec: dFornec_a,
      despOper5Net: despOper5Net_a, deprec: deprec_a,
      dContasPag: dContasPag_a, dObrigTrab: dObrigTrab_a,
      dDespAntec: dDespAntec_a, dValDiv: dValDiv_a,
      impostosV: impostosV_a, dObrigTrib: dObrigTrib_a,
      provisaoIR: provisaoIR_a, rendOper: rendOper_a,
      rendFinanc: rendFinanc_a, rendNaoOper: rendNaoOper_a,
      recebClientes: recebClientes_a, pagFornec: pagFornec_a,
      pagImpostos: pagImpostos_a, despOperCaixa: despOperCaixa_a,
      pagIR: pagIR_a, rendasRecebidas: rendasRecebidas_a,
      fluxoOperDireto: fluxoOperDireto_a,
      fluxoInvest: fluxoInvest_a, fluxoFinanc: fluxoFinanc_a,
      fluxoTotal: fluxoTotal_a,
      dImobiliz: dImobiliz_a, dIntangivel: dIntangivel_a,
      dRealizLPCred: dRealizLPCred_a, dInvest: dInvest_a,
      dEmprestCP: empCP_atu - empCP_ant,   empCP_ant, empCP_atu,
      dEmprestLP: empLP_atu - empLP_ant,   empLP_ant, empLP_atu,
      dPessoasLig: pesLig_atu - pesLig_ant, pesLig_ant, pesLig_atu,
      dDebitosLig: debLig_atu - debLig_ant, debLig_ant, debLig_atu,
      dArrendLP:   arr_atu - arr_ant,       arr_ant,   arr_atu,
      dOutrosPassLP: outLP_atu - outLP_ant,
      dOutros221: out221_atu - out221_ant,
      varCaixaReal: getAtu('1.1.1') - disponibJan,
      disponibAnt: disponibJan, disponibAtu: getAtu('1.1.1'),
      imobiliz: { ant: getJanAnt('1.5.5'), atu: getAtu('1.5.5') },
      investAnt: getJanAnt('1.5.3'), investAtu: getAtu('1.5.3'),
    };
  }

  const diffAcum = acum ? Math.abs(acum.fluxoOperDireto - (acum.fluxoInvest + acum.fluxoFinanc + acum.fluxoTotal - acum.fluxoTotal)) : 0;
  // Validação cruzada acum: compara com fluxo indireto acumulado (não disponível aqui — skip)

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Caixa Operacional (Direto)', mes: fluxoOperDireto, acu: acum?.fluxoOperDireto, icon: '🏭', color: (v: number) => v >= 0 ? 'emerald' : 'red' },
          { label: 'Caixa de Investimento',      mes: d.fluxoInvest,   acu: acum?.fluxoInvest,    icon: '🏗️', color: (v: number) => v >= 0 ? 'emerald' : 'amber' },
          { label: 'Caixa de Financiamento',     mes: d.fluxoFinanc,   acu: acum?.fluxoFinanc,    icon: '🏦', color: (v: number) => v >= 0 ? 'blue' : 'amber' },
          { label: 'Variação Total de Caixa',    mes: d.fluxoTotal,    acu: acum?.fluxoTotal,     icon: '💰', color: (v: number) => v >= 0 ? 'emerald' : 'red' },
        ].map((kpi, i) => {
          const colorMap: any = {
            emerald: 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
            amber:   'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30',
            red:     'border-l-red-500 bg-red-50 dark:bg-red-950/30',
            blue:    'border-l-blue-500 bg-blue-50 dark:bg-blue-950/30',
          };
          return (
            <Card key={i} className={cn('border-l-4', colorMap[kpi.color(kpi.mes)])}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {kpi.icon} {kpi.label}
                </div>
              </CardHeader>
              <CardContent>
                {hasAcum ? (
                  <div className="space-y-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-foreground mb-0.5">{headerMes}</div>
                      <div className={cn('text-lg font-bold', kpi.mes >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{kpi.mes > 0 ? '+' : kpi.mes < 0 ? '−' : ''}{fmtBRL(kpi.mes, true)}</div>
                    </div>
                    <div className="border-t border-border/50 pt-2">
                      <div className="text-[10px] uppercase tracking-wider text-foreground mb-0.5">{headerAcu}</div>
                      <div className={cn('text-xl font-bold', (kpi.acu ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{(kpi.acu ?? 0) > 0 ? '+' : (kpi.acu ?? 0) < 0 ? '−' : ''}{fmtBRL(kpi.acu ?? 0, true)}</div>
                    </div>
                  </div>
                ) : (
                  <div className={cn('text-2xl font-bold', kpi.mes >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{kpi.mes > 0 ? '+' : kpi.mes < 0 ? '−' : ''}{fmtBRL(kpi.mes, true)}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {diff > 1 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-sm">
          ⚠️ Diferença de {fmtBRL(diff)} entre método direto e indireto ({headerMes}) — verifique contas não mapeadas.
        </div>
      )}
      {diff <= 1 && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          ✅ Validação cruzada ({headerMes}): método direto e indireto convergem ({fmtBRL(diff)} de diferença).
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon="💵">DFC — Método Direto (NBC TG 03)</SectionTitle>
          <table className="dfc-table w-full border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Descrição</th>
                <th className={cn('py-2.5 px-3 text-right text-xs uppercase tracking-wider w-[20%]', hasAcum ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-muted-foreground')}>
                  {hasAcum ? headerMes : 'Valor (R$)'}
                </th>
                {hasAcum && (
                  <th className="py-2.5 px-3 text-right text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 w-[20%] border-l border-border/30">
                    {headerAcu}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {/* ── Operacional ── */}
              <DFCRow label="ATIVIDADES OPERACIONAIS" value={0} value2={0} hasAcum={hasAcum} highlight />
              <DFCRow label="(+) Recebimentos de Clientes" value={recebClientes} value2={acum?.recebClientes} hasAcum={hasAcum} indent={1} />
              <DFCRow label={`    ↳ Receita Bruta: ${fmtBRL(recBrutaMes, true)}`} value={recBrutaMes} value2={acum?.recBruta} hasAcum={hasAcum} indent={2} />
              {(devolucoesMes !== 0 || (acum && acum.devolucoes !== 0)) && <DFCRow label="    ↳ (–) Devoluções devolvidas a clientes" value={-devolucoesMes} value2={acum ? -acum.devolucoes : undefined} hasAcum={hasAcum} indent={2} />}
              {(d.dCred !== 0 || (acum && acum.dCred !== 0)) && <DFCRow label={`    ↳ ${d.dCred > 0 ? '(–)' : '(+)'} Variação Créditos de Vendas (1.1.3)`} value={-d.dCred} value2={acum ? -acum.dCred : undefined} hasAcum={hasAcum} indent={2} />}
              {(d.dContasCorr !== 0 || (acum && acum.dContasCorr !== 0)) && <DFCRow label={`    ↳ ${d.dContasCorr > 0 ? '(–)' : '(+)'} Variação Contas Correntes (1.1.4)`} value={-d.dContasCorr} value2={acum ? -acum.dContasCorr : undefined} hasAcum={hasAcum} indent={2} />}

              <DFCRow label="(–) Pagamentos a Fornecedores" value={pagFornec} value2={acum?.pagFornec} hasAcum={hasAcum} indent={1} />
              <DFCRow label={`    ↳ CMV do período: ${fmtBRL(CMVMes, true)}`} value={-CMVMes} value2={acum ? -acum.CMV : undefined} hasAcum={hasAcum} indent={2} />
              {(d.dEstoque !== 0 || (acum && acum.dEstoque !== 0)) && <DFCRow label={`    ↳ ${d.dEstoque > 0 ? '(–)' : '(+)'} Variação Estoques (1.1.2 + 1.1.7.02)`} value={-d.dEstoque} value2={acum ? -acum.dEstoque : undefined} hasAcum={hasAcum} indent={2} />}
              {(d.dFornec !== 0 || (acum && acum.dFornec !== 0)) && <DFCRow label={`    ↳ ${d.dFornec > 0 ? '(+)' : '(–)'} Variação Fornecedores (2.1.3 + 2.1.4)`} value={d.dFornec} value2={acum?.dFornec} hasAcum={hasAcum} indent={2} />}

              <DFCRow label="(–) Pagamentos de Despesas Operacionais" value={despOperCaixa} value2={acum?.despOperCaixa} hasAcum={hasAcum} indent={1} />
              <DFCRow label={`    ↳ Despesas operacionais do período (conta 5, líquido): ${fmtBRL(d.despOper5Net, true)}`} value={-d.despOper5Net} value2={acum ? -acum.despOper5Net : undefined} hasAcum={hasAcum} indent={2} />
              <DFCRow label={`    ↳ (+) Depreciação/Amortização (não-caixa): ${fmtBRL(d.deprec, true)}`} value={d.deprec} value2={acum?.deprec} hasAcum={hasAcum} indent={2} />
              {(d.dContasPag !== 0 || (acum && acum.dContasPag !== 0)) && <DFCRow label={`    ↳ ${d.dContasPag > 0 ? '(+)' : '(–)'} Variação Contas a Pagar (2.1.2.03)`} value={d.dContasPag} value2={acum?.dContasPag} hasAcum={hasAcum} indent={2} />}
              {(d.dObrigTrab !== 0 || (acum && acum.dObrigTrab !== 0)) && <DFCRow label={`    ↳ ${d.dObrigTrab > 0 ? '(+)' : '(–)'} Variação Obrig. Trabalhistas (2.1.2.01)`} value={d.dObrigTrab} value2={acum?.dObrigTrab} hasAcum={hasAcum} indent={2} />}
              {(d.dDespAntec !== 0 || (acum && acum.dDespAntec !== 0)) && <DFCRow label={`    ↳ ${d.dDespAntec > 0 ? '(–)' : '(+)'} Variação Despesas Antecipadas (1.1.6)`} value={-d.dDespAntec} value2={acum ? -acum.dDespAntec : undefined} hasAcum={hasAcum} indent={2} />}
              {(d.dValDiv !== 0 || (acum && acum.dValDiv !== 0)) && <DFCRow label={`    ↳ ${d.dValDiv > 0 ? '(–)' : '(+)'} Variação Valores Diversos (1.1.5)`} value={-d.dValDiv} value2={acum ? -acum.dValDiv : undefined} hasAcum={hasAcum} indent={2} />}

              <DFCRow label="(–) Pagamentos de Impostos sobre Vendas" value={pagImpostos} value2={acum?.pagImpostos} hasAcum={hasAcum} indent={1} />
              <DFCRow label={`    ↳ Impostos sobre Vendas do período: ${fmtBRL(impostosVMes, true)}`} value={-impostosVMes} value2={acum ? -acum.impostosV : undefined} hasAcum={hasAcum} indent={2} />
              {(d.dObrigTrib !== 0 || (acum && acum.dObrigTrib !== 0)) && <DFCRow label={`    ↳ ${d.dObrigTrib > 0 ? '(+)' : '(–)'} Variação Obrig. Tributárias (2.1.2.02)`} value={d.dObrigTrib} value2={acum?.dObrigTrib} hasAcum={hasAcum} indent={2} />}

              {(pagIR !== 0 || (acum && acum.pagIR !== 0)) && <DFCRow label="(–) IR + CSLL pago (conta 6)" value={pagIR} value2={acum?.pagIR} hasAcum={hasAcum} indent={1} />}

              {(rendasRecebidas !== 0 || (acum && acum.rendasRecebidas !== 0)) && <DFCRow label="(+) Rendas Recebidas (Oper. + Financ. + Não Oper.)" value={rendasRecebidas} value2={acum?.rendasRecebidas} hasAcum={hasAcum} indent={1} />}
              {(rendOperMes !== 0 || (acum && acum.rendOper !== 0)) && <DFCRow label={`    ↳ Rendas Operacionais (3.4): ${fmtBRL(rendOperMes, true)}`} value={rendOperMes} value2={acum?.rendOper} hasAcum={hasAcum} indent={2} />}
              {(rendFinancMes !== 0 || (acum && acum.rendFinanc !== 0)) && <DFCRow label={`    ↳ Rendas Financeiras (3.5): ${fmtBRL(rendFinancMes, true)}`} value={rendFinancMes} value2={acum?.rendFinanc} hasAcum={hasAcum} indent={2} />}
              {(rendNaoOperMes !== 0 || (acum && acum.rendNaoOper !== 0)) && <DFCRow label={`    ↳ Rendas Não Operacionais (3.6): ${fmtBRL(rendNaoOperMes, true)}`} value={rendNaoOperMes} value2={acum?.rendNaoOper} hasAcum={hasAcum} indent={2} />}

              <DFCRow label="CAIXA LÍQUIDO DAS ATIVIDADES OPERACIONAIS" value={fluxoOperDireto} value2={acum?.fluxoOperDireto} hasAcum={hasAcum} total highlight />

              {/* ── Investimento ── */}
              <DFCRow label="ATIVIDADES DE INVESTIMENTO" value={0} value2={0} hasAcum={hasAcum} highlight />
              <DFCRow label={`${-(data.imobiliz.atu - data.imobiliz.ant) >= 0 ? '(+)' : '(–)'} Variação Líquida do Imobilizado (1.5.5)`} value={-(data.imobiliz.atu - data.imobiliz.ant)} value2={acum ? -(acum.imobiliz.atu - acum.imobiliz.ant) : undefined} hasAcum={hasAcum} indent={1} />
              <DFCRow label={`${-d.dIntangivel >= 0 ? '(+)' : '(–)'} Variação Líquida do Intangível (1.5.7)`} value={-d.dIntangivel} value2={acum ? -acum.dIntangivel : undefined} hasAcum={hasAcum} indent={1} />
              {(d.dInvestimentos !== 0 || (acum && acum.dInvest !== 0)) && <DFCRow label={`${-d.dInvestimentos >= 0 ? '(+)' : '(–)'} Variação de Investimentos (1.5.3) ${fmtBRL(d.investimentosAnt, true)} → ${fmtBRL(d.investimentosAtu, true)}`} value={-d.dInvestimentos} value2={acum ? -acum.dInvest : undefined} hasAcum={hasAcum} indent={1} />}
              <DFCRow label={`${-d.dRealizLPCred >= 0 ? '(+)' : '(–)'} Variação Créditos c/ Ligadas LP (1.5.1.01.52)`} value={-d.dRealizLPCred} value2={acum ? -acum.dRealizLPCred : undefined} hasAcum={hasAcum} indent={1} />
              <DFCRow label="CAIXA LÍQUIDO DAS ATIVIDADES DE INVESTIMENTO" value={d.fluxoInvest} value2={acum?.fluxoInvest} hasAcum={hasAcum} total highlight />

              {/* ── Financiamento ── */}
              <DFCRow label="ATIVIDADES DE FINANCIAMENTO" value={0} value2={0} hasAcum={hasAcum} highlight />
              {(d.emprestCPAnt > 0 || d.emprestCPAtu > 0) && <DFCRow label={`${d.dEmprestCP >= 0 ? '(+) Captação' : '(–) Amortização'} Empréstimos CP / Floor Plan (${fmtBRL(d.emprestCPAnt, true)} → ${fmtBRL(d.emprestCPAtu, true)})`} value={d.dEmprestCP} value2={acum?.dEmprestCP} hasAcum={hasAcum} indent={1} />}
              {(d.emprestLPAnt > 0 || d.emprestLPAtu > 0) && <DFCRow label={`${d.dEmprestLP >= 0 ? '(+) Captação' : '(–) Amortização'} Empréstimos Bancários LP (${fmtBRL(d.emprestLPAnt, true)} → ${fmtBRL(d.emprestLPAtu, true)})`} value={d.dEmprestLP} value2={acum?.dEmprestLP} hasAcum={hasAcum} indent={1} />}
              {(d.pessoasLigAnt > 0 || d.pessoasLigAtu > 0) && <DFCRow label={`${d.dPessoasLig >= 0 ? '(+) Aporte' : '(–) Retirada'} Sócios / Pessoas Ligadas (${fmtBRL(d.pessoasLigAnt, true)} → ${fmtBRL(d.pessoasLigAtu, true)})`} value={d.dPessoasLig} value2={acum?.dPessoasLig} hasAcum={hasAcum} indent={1} />}
              {(d.debitosLigAnt > 0 || d.debitosLigAtu > 0) && <DFCRow label={`${d.dDebitosLig >= 0 ? '(+) Captação' : '(–) Liquidação'} Débitos com Ligadas LP (${fmtBRL(d.debitosLigAnt, true)} → ${fmtBRL(d.debitosLigAtu, true)})`} value={d.dDebitosLig} value2={acum?.dDebitosLig} hasAcum={hasAcum} indent={1} />}
              {(d.arrendLPAnt > 0 || d.arrendLPAtu > 0) && <DFCRow label={`${d.dArrendLP >= 0 ? '(+) Novos Arrendamentos LP' : '(–) Amortização Arrendamentos LP'} (${fmtBRL(d.arrendLPAnt, true)} → ${fmtBRL(d.arrendLPAtu, true)})`} value={d.dArrendLP} value2={acum?.dArrendLP} hasAcum={hasAcum} indent={1} />}
              {(d.dOutrosPassLP !== 0 || (acum && acum.dOutrosPassLP !== 0)) && <DFCRow label={`${d.dOutrosPassLP >= 0 ? '(+) Captação' : '(–) Liquidação'} Outros Passivos LP (2.2.3)`} value={d.dOutrosPassLP} value2={acum?.dOutrosPassLP} hasAcum={hasAcum} indent={1} />}
              {(Math.abs(d.dOutros2_2_1) > 0.01 || (acum && Math.abs(acum.dOutros221) > 0.01)) && <DFCRow label={`${d.dOutros2_2_1 >= 0 ? '(+)' : '(–)'} Outros Passivos LP não mapeados (2.2.1 — demais)`} value={d.dOutros2_2_1} value2={acum?.dOutros221} hasAcum={hasAcum} indent={1} />}
              <DFCRow label="CAIXA LÍQUIDO DAS ATIVIDADES DE FINANCIAMENTO" value={d.fluxoFinanc} value2={acum?.fluxoFinanc} hasAcum={hasAcum} total highlight />
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50/50 dark:bg-emerald-950/20 border-t-2 border-emerald-500/30">
                <td className="py-3.5 px-3 text-sm font-bold text-foreground">VARIAÇÃO TOTAL DE CAIXA NO PERÍODO</td>
                <td className={cn('py-3.5 px-3 text-right font-mono text-base font-bold', d.fluxoTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{(d.fluxoTotal > 0 ? '+' : d.fluxoTotal < 0 ? '−' : '') + fmtBRL(d.fluxoTotal)}</td>
                {hasAcum && <td className={cn('py-3.5 px-3 text-right font-mono text-base font-bold border-l border-border/30', (acum.fluxoTotal ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{((acum.fluxoTotal ?? 0) > 0 ? '+' : (acum.fluxoTotal ?? 0) < 0 ? '−' : '') + fmtBRL(acum.fluxoTotal)}</td>}
              </tr>
              <tr className="bg-muted/30">
                <td className="py-2.5 px-3 text-sm text-muted-foreground">Saldo de Caixa — Período Anterior</td>
                <td className="py-2.5 px-3 text-right font-mono text-sm text-muted-foreground">{fmtBRL(data.disponib.ant)}</td>
                {hasAcum && <td className="py-2.5 px-3 text-right font-mono text-sm text-muted-foreground border-l border-border/30">{fmtBRL(acum.disponibAnt)}</td>}
              </tr>
              <tr className="bg-muted/30">
                <td className="py-2.5 px-3 text-sm text-muted-foreground">Saldo de Caixa — Período Atual</td>
                <td className="py-2.5 px-3 text-right font-mono text-sm font-semibold text-foreground">{fmtBRL(data.disponib.atu)}</td>
                {hasAcum && <td className="py-2.5 px-3 text-right font-mono text-sm font-semibold text-foreground border-l border-border/30">{fmtBRL(acum.disponibAtu)}</td>}
              </tr>
              <tr className="bg-violet-50/50 dark:bg-violet-950/20 border-t border-violet-500/30">
                <td className="py-3 px-3 text-sm font-semibold text-foreground/80">Variação Real de Caixa (conferência com balanço)</td>
                <td className={cn('py-3 px-3 text-right font-mono text-sm font-bold', d.varCaixaReal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{(d.varCaixaReal > 0 ? '+' : d.varCaixaReal < 0 ? '−' : '') + fmtBRL(d.varCaixaReal)}</td>
                {hasAcum && <td className={cn('py-3 px-3 text-right font-mono text-sm font-bold border-l border-border/30', acum.varCaixaReal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{(acum.varCaixaReal > 0 ? '+' : acum.varCaixaReal < 0 ? '−' : '') + fmtBRL(acum.varCaixaReal)}</td>}
              </tr>
            </tfoot>
          </table>
          <p className="mt-4 text-xs text-muted-foreground/70 leading-relaxed">
            {hasAcum
              ? `* ${headerMes}: movimentação do mês (Déb/Créd). ${headerAcu}: variação patrimonial usando saldo de Dez/${String(selectedYear - 1).slice(2)} como base; contas de resultado pelo saldoAtual acumulado YTD.`
              : '* DFC pelo método direto. Recebimentos e pagamentos calculados a partir das variações do balancete (accrual → caixa). Atividades de Investimento e Financiamento idênticas ao método indireto. O total operacional deve convergir com o método indireto — divergências indicam contas não mapeadas.'
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── DIAGNÓSTICO DE GERAÇÃO DE CAIXA ────────────────────────────────────────
function DiagnosticoTab({ data, fmtBRL, SectionTitle }: any) {
  const d = data.dfc;

  // Utilitário: percentual absoluto de `part` em relação a `whole`
  const pctOf = (part: number, whole: number) =>
    whole !== 0 ? Math.round((Math.abs(part) / Math.abs(whole)) * 100) : 0;

  // ── Flags de sustentabilidade ──────────────────────────────────────────────
  const queimouEstoque  = d.ajusteEstoque > 0;                      // estoque caiu → entrou caixa
  const estoquePct      = d.fluxoOper > 0 ? pctOf(d.ajusteEstoque, d.fluxoOper) : 0;
  const queimouSignif   = queimouEstoque && estoquePct >= 30;        // ≥ 30% do oper vem de estoque

  const atrasouFornec   = d.ajusteFornec > 0;                       // fornecedores subiram → postergação
  const fornecPct       = d.fluxoOper > 0 ? pctOf(d.ajusteFornec, d.fluxoOper) : 0;
  const atrasouSignif   = atrasouFornec && fornecPct >= 30;

  const deprecPct       = d.fluxoOper > 0 ? pctOf(d.deprec, d.fluxoOper) : 0;
  const credPct         = d.fluxoOper > 0 ? pctOf(d.ajusteCred, d.fluxoOper) : 0;

  const operPositivo    = d.fluxoOper > 0;
  const operSustentavel = operPositivo && !queimouSignif && !atrasouSignif;
  const gerarCaixa      = d.fluxoTotal >= 0;

  // ── Semáforo ───────────────────────────────────────────────────────────────
  type SemStatus = 'green' | 'yellow' | 'red';
  let status: SemStatus;
  let titulo: string;
  let descricao: string;

  if (operSustentavel) {
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
    { label: 'Operacional',    value: d.fluxoOper,   icon: '⚙️', desc: 'Resultado das atividades-fim da empresa (vendas, custos e capital de giro)' },
    { label: 'Investimento',   value: d.fluxoInvest, icon: '🏗️', desc: 'Compra/venda de imobilizado, intangível e créditos de longo prazo' },
    { label: 'Financiamento',  value: d.fluxoFinanc, icon: '🏛️', desc: 'Empréstimos, arrendamentos, aportes e retiradas de sócios' },
  ];

  // ── Checklist ──────────────────────────────────────────────────────────────
  const checks = [
    {
      ok: gerarCaixa,
      label: 'Empresa gerou caixa no período',
      detail: `Variação total: ${d.fluxoTotal >= 0 ? '+' : ''}${fmtBRL(d.fluxoTotal)}`,
    },
    {
      ok: operPositivo,
      label: 'Atividade operacional gera caixa',
      detail: `Fluxo operacional: ${d.fluxoOper >= 0 ? '+' : ''}${fmtBRL(d.fluxoOper)}`,
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
      ok: d.varCaixaReal >= 0,
      label: 'Saldo de caixa aumentou (conferência com o balanço)',
      detail: `Variação real: ${d.varCaixaReal >= 0 ? '+' : ''}${fmtBRL(d.varCaixaReal)}`,
    },
  ];

  return (
    <div className="space-y-6">

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
                {d.fluxoTotal >= 0 ? '✅' : '❌'} {d.fluxoTotal >= 0 ? '+' : ''}{fmtBRL(d.fluxoTotal)}
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
        <SectionTitle icon="🔍">De qual atividade veio o caixa?</SectionTitle>
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
                    {isPos ? '+' : ''}{fmtBRL(a.value)}
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
            {d.fluxoOper !== 0 && (
              <div className="mb-5">
                <div className="text-sm font-semibold text-foreground mb-4">
                  Composição do Fluxo Operacional&nbsp;
                  <span className={cn('font-mono', d.fluxoOper >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>{d.fluxoOper >= 0 ? '+' : ''}{fmtBRL(d.fluxoOper)}</span>
                </div>
                {[
                  { label: 'Depreciação / Amortização (não-caixa)', value: d.deprec, pctVal: deprecPct, color: 'bg-blue-400', neutral: true, warn: false, note: 'Ajuste contábil — sempre positivo, mas não representa entrada real de dinheiro.' },
                  { label: 'Variação de Estoques', value: d.ajusteEstoque, pctVal: estoquePct, color: queimouSignif ? 'bg-amber-400' : 'bg-emerald-400', neutral: false, warn: queimouSignif, note: queimouEstoque ? `Redução de estoque (fonte de caixa). ${queimouSignif ? `Representa ${estoquePct}% do caixa oper. — sinal de queima de estoque.` : `${estoquePct}% do caixa oper. — patamar aceitável.`}` : 'Aumento de estoque (uso de caixa — empresa está investindo em produto).' },
                  { label: 'Variação de Fornecedores', value: d.ajusteFornec, pctVal: fornecPct, color: atrasouSignif ? 'bg-amber-400' : 'bg-emerald-400', neutral: false, warn: atrasouSignif, note: atrasouFornec ? `Aumento de fornecedores (postergação de pagamentos). ${atrasouSignif ? `${fornecPct}% do caixa oper. — atenção ao prazo prometido.` : `${fornecPct}% do caixa oper. — controlado.`}` : 'Redução de fornecedores (pagamentos realizados no período).' },
                  { label: 'Créditos a Receber', value: d.ajusteCred, pctVal: credPct, color: d.ajusteCred >= 0 ? 'bg-emerald-400' : 'bg-red-400', neutral: false, warn: false, note: d.ajusteCred >= 0 ? 'Redução de créditos (recebimentos efetuados — bom sinal).' : 'Aumento de créditos (mais a receber, mas o caixa ainda não entrou).' },
                ].filter(i => Math.abs(i.value) > 0).map((item, idx) => (
                  <div key={idx} className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                        {item.warn      && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded dark:bg-amber-950 dark:text-amber-400">⚠️ Pontual</span>}
                        {item.neutral   && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded dark:bg-blue-950 dark:text-blue-400">ℹ️ Não-caixa</span>}
                        {!item.warn && !item.neutral && item.value > 0 && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded dark:bg-emerald-950 dark:text-emerald-400">✓ OK</span>}
                      </div>
                      <span className="text-xs font-mono font-semibold text-foreground shrink-0">{item.value >= 0 ? '+' : ''}{fmtBRL(item.value, true)}</span>
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

function IndicadoresTab({ data, fmtBRL, SectionTitle, Badge }: any) {
  const ind = data.indicadores;
  const lqcStatus = ind.liqCorrente >= 1.5 ? 'ok' : ind.liqCorrente >= 1 ? 'warn' : 'bad';
  const lqiStatus = ind.liqImediata >= 0.2 ? 'ok' : ind.liqImediata >= 0.1 ? 'warn' : 'bad';
  const endStatus = ind.endivTotal <= 0.5 ? 'ok' : ind.endivTotal <= 0.7 ? 'warn' : 'bad';
  const pctStatus = ind.partCapTerceiros <= 2 ? 'ok' : ind.partCapTerceiros <= 4 ? 'warn' : 'bad';

  const indicadores = [
    { label: 'Liquidez Corrente', formula: 'AC / PC', value: `${ind.liqCorrente.toFixed(2)}x`, ref: '≥ 1,5x ideal', status: lqcStatus, desc: 'Mede a capacidade de pagar obrigações de curto prazo com ativos circulantes.' },
    { label: 'Liquidez Imediata', formula: 'Disponib. / PC', value: `${(ind.liqImediata * 100).toFixed(1)}%`, ref: '≥ 20% aceitável', status: lqiStatus, desc: 'Percentual do passivo circulante coberto pelo caixa disponível imediatamente.' },
    { label: 'Endividamento Geral', formula: 'PT / AT', value: `${(ind.endivTotal * 100).toFixed(1)}%`, ref: '≤ 50% saudável', status: endStatus, desc: 'Proporção do ativo financiada por capital de terceiros (dívidas).' },
    { label: 'Participação Capital 3ºs', formula: 'PT / PL', value: `${ind.partCapTerceiros.toFixed(1)}x`, ref: '≤ 2x baixo risco', status: pctStatus, desc: 'Quantas vezes o capital de terceiros supera o patrimônio líquido.' },
    { label: 'Imobilização do PL', formula: 'ANC / PL', value: `${(data.ativo.naoCirc.atu / data.PL.atu * 100).toFixed(0)}%`, ref: '≤ 100%', status: data.ativo.naoCirc.atu <= data.PL.atu ? 'ok' : 'bad', desc: 'Percentual do PL comprometido com ativos não circulantes. Acima de 100% indica que o ANC é financiado por dívidas.' },
    { label: 'Margem Bruta', formula: 'LB / Rec.Líq.', value: `${ind.margemBruta.toFixed(1)}%`, ref: '> 10% saudável', status: ind.margemBruta > 10 ? 'ok' : ind.margemBruta >= 0 ? 'warn' : 'bad', desc: 'Percentual da receita líquida que sobra após deduzir o custo dos produtos vendidos.' },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {indicadores.map((ind2, i) => (
          <Card key={i}>
            <CardContent className="pt-6 flex flex-col gap-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">{ind2.formula}</div>
                  <div className="text-base font-bold text-foreground">{ind2.label}</div>
                </div>
                <Badge label={ind2.status === 'ok' ? '✓ Ok' : ind2.status === 'warn' ? '⚡ Atenção' : '✗ Crítico'} status={ind2.status} />
              </div>
              <div className={cn('font-mono text-3xl font-bold', ind2.status === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : ind2.status === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')}>
                {ind2.value}
              </div>
              <div className="text-xs text-muted-foreground/70 leading-relaxed">{ind2.desc}</div>
              <div className="text-xs font-mono text-muted-foreground/60">Referência: {ind2.ref}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
