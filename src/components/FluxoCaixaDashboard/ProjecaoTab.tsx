/**
 * ProjecaoTab — Projeção de Caixa e Resultado do Exercício
 *
 * Sub-abas:
 *  1. FC Direto e Indireto projetados conforme o cadastro da DFC
 *  2. Resultado mensal projetado conforme as linhas cadastradas da DRE
 */

import { Fragment, useState, useEffect, useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { kvGet, kvSet } from "@/lib/kvClient";
import { Save, Info } from "lucide-react";
import {
  calcularDfcIndireto,
  calcularLinhas,
  calcularSaldosCaixaEquivalentes,
  encontrarLinhaDrePorNomes,
  listarLinhasDre,
  linhaPai,
  type CadastroDemonstracoes,
  type ContasBalancete,
  type LinhaDemonstracao,
} from "./DemonstracoesFinanceiras/modelo";
import { criarLinhasDfcIndiretoTabela } from "./DemonstracoesFinanceiras/dfcTabela";
import { loadCadastroDemonstracoes } from "./DemonstracoesFinanceiras/storage";
import { DFC_INDIRETO_AJUSTES, DFC_INDIRETO_VARIACOES } from "./DemonstracoesFinanceiras/dfcMetodoIndireto";

const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export interface ProjecaoPremissas {
  dre_linhas: Record<string, number>;
  receitas: number; cmv: number; despesasOper: number; rendimentos: number;
  dfc_operacional: number; dfc_investimento: number; dfc_financiamento: number;
}

type ValoresLinhas = Map<string, number | null>;
type MetodoProjecao = 'dre' | 'direto' | 'indireto';

interface PeriodoProjecao {
  month: number;
  accounts: ContasBalancete;
  dre: ValoresLinhas;
  direto: ValoresLinhas;
  indireto: ValoresLinhas;
}

interface Props {
  allMonthsAccounts: Array<Record<string, ContasBalancete[string]>>;
  selectedYear: number; selectedMonth: number;
  fmtBRL: (v:number, compact?:boolean) => string;
}

const DEFAULT_PREM: ProjecaoPremissas = {
  dre_linhas: {},
  receitas:0, cmv:0, despesasOper:0, rendimentos:0,
  dfc_operacional:0, dfc_investimento:0, dfc_financiamento:0,
};
const premKey = (y:number) => `projecao_premissas_${y}`;
async function loadPremissas(y:number): Promise<ProjecaoPremissas> {
  const data = await kvGet<unknown>(premKey(y), { throwOnError: true });
  if (data === null) return { ...DEFAULT_PREM };
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('As premissas de projeção salvas estão inválidas.');
  }
  const saved = data as Record<string, unknown>;
  const rate = (key: string) => typeof saved[key] === 'number' && Number.isFinite(saved[key])
    ? saved[key] as number
    : DEFAULT_PREM[key as keyof ProjecaoPremissas] as number;
  const dreLinhas = typeof saved.dre_linhas === 'object' && saved.dre_linhas !== null && !Array.isArray(saved.dre_linhas)
    ? Object.fromEntries(Object.entries(saved.dre_linhas as Record<string, unknown>)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])))
    : {};
  return {
    dre_linhas: dreLinhas,
    receitas: rate('receitas'),
    cmv: rate('cmv'),
    despesasOper: rate('despesasOper'),
    rendimentos: rate('rendimentos'),
    dfc_operacional: rate('dfc_operacional'),
    dfc_investimento: rate('dfc_investimento'),
    dfc_financiamento: rate('dfc_financiamento'),
  };
}
async function savePremissas(y:number, p:ProjecaoPremissas) {
  if (!await kvSet(premKey(y), p)) throw new Error('Não foi possível salvar as premissas de projeção.');
}

function arredondarValor(value: number) {
  return Math.round(value * 100) / 100;
}

function carregarPeriodosProjecao(
  accountsByMonth: Props['allMonthsAccounts'],
  cadastro: CadastroDemonstracoes,
): PeriodoProjecao[] {
  return accountsByMonth.flatMap((accounts, index) => {
    if (Object.keys(accounts).length === 0) return [];
    const periodos = [accounts];
    return [{
      month: index + 1,
      accounts,
      dre: calcularLinhas(cadastro.linhas, 'dre', periodos),
      direto: calcularLinhas(cadastro.linhas, 'dfc', periodos),
      indireto: calcularDfcIndireto(cadastro.linhas, cadastro.dfcIndiretoRegras ?? [], periodos).valores,
    }];
  });
}

function somarValores(periods: PeriodoProjecao[], method: MetodoProjecao, id: string): number | null {
  if (periods.length === 0) return null;
  const values = periods.map(period => period[method].get(id) ?? null);
  if (values.some(value => value === null)) return null;
  return arredondarValor(values.reduce<number>((total, value) => total + (value ?? 0), 0));
}

function mediaValor(periods: PeriodoProjecao[], method: MetodoProjecao, id: string): number | null {
  const total = somarValores(periods, method, id);
  return total === null ? null : arredondarValor(total / periods.length);
}

function projetarMedia(value: number | null, months: number, rate: number): number | null {
  return value === null ? null : arredondarValor(value * months * (1 + rate / 100));
}

function grupoLegadoDre(linha: LinhaDemonstracao): keyof Pick<ProjecaoPremissas, 'receitas' | 'cmv' | 'despesasOper' | 'rendimentos'> | null {
  const grupos = linha.itens.map(({ referencia }) => {
    if (/^3\.[123](?:\.|$)/.test(referencia)) return 'receitas';
    if (/^4(?:\.|$)/.test(referencia)) return 'cmv';
    if (/^5(?:\.|$)/.test(referencia)) return 'despesasOper';
    if (/^3\.[456](?:\.|$)/.test(referencia)) return 'rendimentos';
    return null;
  });
  return grupos.length > 0 && grupos[0] !== null && grupos.every(grupo => grupo === grupos[0])
    ? grupos[0]
    : null;
}

function migrarPremissasDre(premissas: ProjecaoPremissas, cadastro: CadastroDemonstracoes): ProjecaoPremissas {
  const dre_linhas = { ...premissas.dre_linhas };
  for (const linha of cadastro.linhas.filter(item => item.demonstracao === 'dre' && item.tipo === 'contas')) {
    const grupo = grupoLegadoDre(linha);
    if (dre_linhas[linha.id] === undefined && grupo) dre_linhas[linha.id] = premissas[grupo];
  }
  return { ...premissas, dre_linhas };
}

function projetarDre(
  cadastro: CadastroDemonstracoes,
  periods: PeriodoProjecao[],
  months: number,
  premissas: ProjecaoPremissas,
): ValoresLinhas {
  const linhas = cadastro.linhas.filter(linha => linha.demonstracao === 'dre');
  const porId = new Map(linhas.map(linha => [linha.id, linha]));
  const values = new Map<string, number | null>();
  const visitando = new Set<string>();
  const project = (linha: LinhaDemonstracao): number | null => {
    if (values.has(linha.id)) return values.get(linha.id) ?? null;
    if (visitando.has(linha.id)) throw new Error(`Dependência circular na linha "${linha.nome}".`);
    visitando.add(linha.id);
    let value: number | null;
    if (linha.tipo === 'contas') {
      value = projetarMedia(mediaValor(periods, 'dre', linha.id), months, premissas.dre_linhas[linha.id] ?? 0);
    } else {
      const amounts = linha.itens.map(item => {
        const origin = porId.get(item.referencia);
        return origin ? project(origin) : null;
      });
      value = amounts.some(amount => amount === null)
        ? null
        : arredondarValor(amounts.reduce<number>((total, amount) => total + (amount ?? 0), 0));
    }
    visitando.delete(linha.id);
    values.set(linha.id, value);
    return value;
  };
  for (const linha of linhas) project(linha);
  return values;
}

function percentualBloco(premissas: ProjecaoPremissas, bloco: string | undefined) {
  if (bloco === 'dfc-operacional') return premissas.dfc_operacional;
  if (bloco === 'dfc-investimento') return premissas.dfc_investimento;
  if (bloco === 'dfc-financiamento') return premissas.dfc_financiamento;
  return 0;
}

function projetarDfcDireto(
  cadastro: CadastroDemonstracoes,
  periods: PeriodoProjecao[],
  months: number,
  premissas: ProjecaoPremissas,
): ValoresLinhas {
  const linhas = cadastro.linhas.filter(linha => linha.demonstracao === 'dfc');
  const porId = new Map(linhas.map(linha => [linha.id, linha]));
  const values = new Map<string, number | null>();
  const visitando = new Set<string>();
  const project = (linha: LinhaDemonstracao): number | null => {
    if (values.has(linha.id)) return values.get(linha.id) ?? null;
    if (visitando.has(linha.id)) throw new Error(`Dependência circular na linha "${linha.nome}".`);
    visitando.add(linha.id);
    let value: number | null;
    if (linha.tipo === 'contas') {
      const bloco = linhaPai(linha) ?? linha.id;
      value = projetarMedia(mediaValor(periods, 'direto', linha.id), months, percentualBloco(premissas, bloco));
    } else {
      const amounts = linha.itens.map(item => {
        const origin = porId.get(item.referencia);
        return origin ? project(origin) : null;
      });
      value = amounts.some(amount => amount === null)
        ? null
        : arredondarValor(amounts.reduce<number>((total, amount) => total + (amount ?? 0), 0));
    }
    visitando.delete(linha.id);
    values.set(linha.id, value);
    return value;
  };
  for (const linha of linhas) project(linha);
  return values;
}

function somarObrigatorios(values: Array<number | null | undefined>): number | null {
  if (values.length === 0 || values.some(value => value === null || value === undefined)) return null;
  return arredondarValor(values.reduce<number>((total, value) => total + (value ?? 0), 0));
}

function projetarDfcIndireto(
  cadastro: CadastroDemonstracoes,
  periods: PeriodoProjecao[],
  months: number,
  premissas: ProjecaoPremissas,
  direto: ValoresLinhas,
): ValoresLinhas {
  const result = new Map<string, number | null>();
  const projetarOperacional = (id: string) =>
    projetarMedia(mediaValor(periods, 'indireto', id), months, premissas.dfc_operacional);
  const ajustes = DFC_INDIRETO_AJUSTES.map(({ codigo }) => projetarOperacional(codigo));
  const variacoes = DFC_INDIRETO_VARIACOES.map(({ codigo }) => projetarOperacional(codigo));
  result.set('RES', projetarOperacional('RES'));
  DFC_INDIRETO_AJUSTES.forEach(({ codigo }, index) => result.set(codigo, ajustes[index] ?? null));
  DFC_INDIRETO_VARIACOES.forEach(({ codigo }, index) => result.set(codigo, variacoes[index] ?? null));
  const dfcLines = cadastro.linhas.filter(linha => linha.demonstracao === 'dfc');
  for (const linha of dfcLines) result.set(linha.id, direto.get(linha.id) ?? null);
  result.set('resultado-ajustado', somarObrigatorios([result.get('RES') ?? null, ...ajustes]));
  result.set('variacoes-capital-giro', somarObrigatorios(variacoes));
  result.set('dfc-operacional', somarObrigatorios([
    result.get('resultado-ajustado') ?? null,
    result.get('variacoes-capital-giro') ?? null,
  ]));
  result.set('dfc-investimento', direto.get('dfc-investimento') ?? null);
  result.set('dfc-financiamento', direto.get('dfc-financiamento') ?? null);
  result.set('dfc-total', somarObrigatorios([
    result.get('dfc-operacional') ?? null,
    result.get('dfc-investimento') ?? null,
    result.get('dfc-financiamento') ?? null,
  ]));
  return result;
}

function fmtPct(v:number){ return (v>=0?"+":"")+v.toFixed(0)+"%"; }

function DFC3Row({ label,real,proj,total,indent=0,totalRow=false,highlight=false,fmtBRL,hideIfZero=false }:{
  label:string; real:number | null; proj:number | null; total:number | null;
  indent?:number; totalRow?:boolean; highlight?:boolean;
  fmtBRL:(v:number)=>string; hideIfZero?:boolean;
}) {
  if (hideIfZero && [real, proj].every(value => value !== null && Math.abs(value) < 0.5)) return null;
  const pad = indent===1?"pl-6":indent===2?"pl-10":"";
  const rowCls = highlight ? "bg-muted/60 font-bold border-t-2 border-border"
               : totalRow  ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-t border-emerald-300/40 font-bold"
               : "border-b border-border/30 hover:bg-muted/20";
  const colVal=(v:number | null,bg:string)=>cn("text-right font-mono text-xs tabular-nums py-2 px-3",bg,
    v === null ? "text-muted-foreground" : (totalRow||highlight)?(v>=0?"text-emerald-600 dark:text-emerald-400":"text-red-600 dark:text-red-400"):"text-foreground");
  const fmt=(v:number | null)=>v === null || Math.abs(v)<0.5?"—":(v>0?"+":"-")+fmtBRL(Math.abs(v));
  return (
    <tr className={rowCls}>
      <td className={cn("py-2 px-3 text-xs text-foreground",pad,totalRow&&"text-sm font-bold",highlight&&"text-xs font-bold uppercase tracking-wide")}>{label}</td>
      <td className={colVal(real,"")}>{fmt(real)}</td>
      <td className={colVal(proj,"bg-blue-50/40 dark:bg-blue-950/10")}>{fmt(proj)}</td>
      <td className={colVal(total,"bg-violet-50/30 dark:bg-violet-950/10 font-semibold")}>{fmt(total)}</td>
    </tr>
  );
}
function DFC3Section({label}:{label:string}) {
  return <tr className="bg-slate-100/80 dark:bg-slate-800/60"><td colSpan={4} className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-foreground">{label}</td></tr>;
}
function PremissaRow({label,icon,value,onChange,indent=0}:{label:string;icon?:string;value:number;onChange:(v:number)=>void;indent?:number}) {
  const c=value>0?"text-emerald-600 dark:text-emerald-400":value<0?"text-red-600 dark:text-red-400":"text-muted-foreground";
  return (
    <div className="flex items-center gap-3">
      <span className="text-base w-5 flex-shrink-0">{icon ?? "•"}</span>
      <span className={cn("text-xs text-foreground w-44 flex-shrink-0 truncate",indent>0&&"pl-3")} title={label}>{label}</span>
      <input aria-label={`Ajuste de ${label}`} type="range" min={-50} max={100} step={5} value={value}
        onChange={e=>onChange(parseInt(e.target.value))}
        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-green-600"/>
      <span className={cn("text-xs font-mono font-bold w-12 text-right flex-shrink-0",c)}>{fmtPct(value)}</span>
    </div>
  );
}
function ChartTooltip({active,payload,label,fmtBRL}:any) {
  if (!active||!payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-border rounded-lg shadow-xl p-3 text-xs min-w-[200px]">
      <p className="font-bold text-foreground mb-2">{label}</p>
      {payload.filter((p:any)=>p.value!==undefined&&p.value!==null).map((p:any)=>(
        <div key={p.dataKey} className="flex justify-between gap-4 mb-0.5">
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-mono font-semibold" style={{color:p.color}}>
            {typeof p.value==="number"?(p.value>=0?"+":"")+fmtBRL(p.value):p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ProjecaoTab({allMonthsAccounts,selectedYear,selectedMonth,fmtBRL}:Props) {
  const [premissas,setPremissas]   = useState<ProjecaoPremissas>(DEFAULT_PREM);
  const [savedPrem,setSavedPrem]   = useState<ProjecaoPremissas>(DEFAULT_PREM);
  const [saving,setSaving]         = useState(false);
  const [savedOk,setSavedOk]       = useState(false);
  const [saveError,setSaveError]   = useState('');
  const [loadError,setLoadError]   = useState('');
  const [loading,setLoading]       = useState(true);
  const [cadastro,setCadastro]     = useState<CadastroDemonstracoes|null>(null);
  const [subTab,setSubTab]         = useState<"indireto"|"direto"|"resultado">("indireto");
  const yr2 = String(selectedYear).slice(2);

  useEffect(()=>{
    let active=true;
    setLoading(true);
    setLoadError('');
    Promise.all([loadPremissas(selectedYear),loadCadastroDemonstracoes()])
      .then(([saved,cadastroAtualizado])=>{
        if(!active)return;
        const hydrated=migrarPremissasDre(saved,cadastroAtualizado);
        setCadastro(cadastroAtualizado);
        setPremissas(hydrated);
        setSavedPrem(hydrated);
      })
      .catch(error=>{
        if(active)setLoadError(error instanceof Error?error.message:String(error));
      })
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[selectedYear]);

  const isDirty = JSON.stringify(premissas)!==JSON.stringify(savedPrem);
  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await savePremissas(selectedYear,premissas);
      setSavedPrem(premissas);
      setSavedOk(true);
      setTimeout(()=>setSavedOk(false),2500);
    } catch(error) {
      setSaveError(error instanceof Error?error.message:String(error));
    } finally {
      setSaving(false);
    }
  };

  const periodos = useMemo(
    ()=>cadastro?carregarPeriodosProjecao(allMonthsAccounts,cadastro):[],
    [allMonthsAccounts,cadastro],
  );
  const nReal = periodos.length;
  const lastRealMonth = periodos.at(-1)?.month??0;
  const firstRealMonth = periodos[0]?.month??0;
  const nProj = 12-lastRealMonth;
  const cadastroDre = cadastro?.linhas.filter(linha=>linha.demonstracao==='dre')??[];
  const linhasVisiveisDre = cadastro?listarLinhasDre(cadastro.linhas):[];
  const linhasDetalheDre = cadastroDre.filter(linha=>linha.tipo==='contas');
  const linhaResultado = encontrarLinhaDrePorNomes(cadastro?.linhas??[],[
    'Resultado Líquido do Exercício','Resultado Líquido','Lucro Líquido do Exercício','Lucro Líquido',
  ]);
  const resultLineId = linhaResultado?.id;

  const projectedDre = useMemo(
    ()=>cadastro&&nProj>0?projetarDre(cadastro,periodos,1,premissas):new Map<string,number|null>(),
    [cadastro,periodos,nProj,premissas],
  );
  const projectedDirect = useMemo(
    ()=>cadastro&&nProj>0?projetarDfcDireto(cadastro,periodos,nProj,premissas):new Map<string,number|null>(),
    [cadastro,periodos,nProj,premissas],
  );
  const projectedIndirect = useMemo(
    ()=>cadastro&&nProj>0
      ?projetarDfcIndireto(cadastro,periodos,nProj,premissas,projectedDirect)
      :new Map<string,number|null>(),
    [cadastro,periodos,nProj,premissas,projectedDirect],
  );

  const dreRows = useMemo(()=>{
    const actualByMonth=new Map(periodos.map(period=>[period.month,period.dre]));
    let accumulated=0;
    let accumulatedAvailable=Boolean(resultLineId);
    return Array.from({length:12},(_,index)=>{
      const month=index+1;
      const isProjected=month>lastRealMonth;
      const values=isProjected?projectedDre:actualByMonth.get(month)??new Map<string,number|null>();
      const resultValue=resultLineId?values.get(resultLineId)??null:null;
      if(resultValue===null)accumulatedAvailable=false;
      else if(accumulatedAvailable)accumulated=arredondarValor(accumulated+resultValue);
      return {
        month,
        label:`${MONTH_SHORT[index]}/${yr2}`,
        values,
        resultValue,
        resultAcum:accumulatedAvailable?accumulated:null,
        isProjected,
      };
    });
  },[periodos,projectedDre,lastRealMonth,resultLineId,yr2]);

  const periodoReal = nReal>0
    ?firstRealMonth===lastRealMonth?`${MONTH_SHORT[firstRealMonth-1]}/${yr2}`:`${MONTH_SHORT[firstRealMonth-1]}–${MONTH_SHORT[lastRealMonth-1]}/${yr2}`
    :"—";
  const periodoProj = nProj>0?`${MONTH_SHORT[lastRealMonth]}–Dez/${yr2}`:"Concluído";
  const totalRealResult = resultLineId?somarValores(periodos,'dre',resultLineId):null;
  const totalProjResult = resultLineId
    ?nProj===0?0:projetarMedia(projectedDre.get(resultLineId)??null,nProj,0)
    :null;
  const totalAno = totalRealResult!==null&&totalProjResult!==null
    ?arredondarValor(totalRealResult+totalProjResult)
    :null;
  const totalDirectProjected = nProj===0
    ?0
    :somarObrigatorios(['dfc-operacional','dfc-investimento','dfc-financiamento']
      .map(id=>projectedDirect.get(id)??null));
  const totalIndirectProjected = nProj===0?0:projectedIndirect.get('dfc-total')??null;
  const caixaEquivalentes=cadastro
    ?calcularSaldosCaixaEquivalentes(cadastro.dfcContasCaixaEquivalentes??[],periodos.map(period=>period.accounts))
    :{saldoInicial:null,saldoFinal:null,variacaoReal:null};
  const fluxoProjetadoAtivo = subTab==='direto'?totalDirectProjected:totalIndirectProjected;
  const saldoFinalProj = caixaEquivalentes.saldoFinal===null||fluxoProjetadoAtivo===null
    ?null
    :arredondarValor(caixaEquivalentes.saldoFinal+fluxoProjetadoAtivo);
  const splitLabel = dreRows.find(row=>row.isProjected)?.label??null;
  const chartDRE = dreRows.map(row=>({
    label:row.label,
    resultReal:!row.isProjected?row.resultValue??undefined:undefined,
    resultProj:row.isProjected?row.resultValue??undefined:undefined,
    acumLinha:row.resultAcum??undefined,
  }));
  const acumuladoDrePorLinha = (id:string) => {
    const values=dreRows.map(row=>row.values.get(id)??null);
    return values.some(value=>value===null)?null:somarObrigatorios(values);
  };
  const valorReal = (method:MetodoProjecao,id:string) => somarValores(periodos,method,id);
  const valorTotal = (real:number|null,projected:number|null) =>
    real===null||projected===null?null:arredondarValor(real+projected);
  const fluxoPorMetodo = (method:'direto'|'indireto',id:string) => {
    const real=valorReal(method,id);
    const projected=method==='direto'
      ?projectedDirect.get(id)??(nProj===0?0:null)
      :projectedIndirect.get(id)??(nProj===0?0:null);
    return {real,projected,total:valorTotal(real,projected)};
  };
  const totalDirectReal=somarObrigatorios(['dfc-operacional','dfc-investimento','dfc-financiamento']
    .map(id=>valorReal('direto',id)));
  const totalIndirectReal=valorReal('indireto','dfc-total');
  const totalFluxoReal=(method:'direto'|'indireto')=>method==='direto'?totalDirectReal:totalIndirectReal;
  const totalFluxoProjetado=(method:'direto'|'indireto')=>method==='direto'?totalDirectProjected:totalIndirectProjected;
  const saldoFinalMetodo=(method:'direto'|'indireto')=>{
    const flow=totalFluxoProjetado(method);
    return caixaEquivalentes.saldoFinal===null||flow===null
      ?null
      :arredondarValor(caixaEquivalentes.saldoFinal+flow);
  };
  const formatarSaldo=(value:number|null)=>value===null?'—':fmtBRL(value);
  const renderFluxoRow=(method:'direto'|'indireto',id:string,label:string,indent=1,totalRow=false,hideIfZero=false)=> {
    const values=fluxoPorMetodo(method,id);
    return <DFC3Row key={id} label={label} real={values.real} proj={values.projected} total={values.total}
      indent={indent} totalRow={totalRow} fmtBRL={fmtBRL} hideIfZero={hideIfZero}/>;
  };
  const linhasRaizDfc=cadastro?.linhas.filter(linha=>linha.demonstracao==='dfc'&&!linhaPai(linha)&&!linha.foraDfc)??[];
  const linhasTabelaIndireto=cadastro?criarLinhasDfcIndiretoTabela(cadastro.linhas.filter(linha=>linha.demonstracao==='dfc')):[];
  const renderTabelaDfc=(method:'direto'|'indireto')=>{
    const indireto=method==='indireto';
    const totalReal=totalFluxoReal(method);
    const totalProjetado=totalFluxoProjetado(method);
    const totalAno=valorTotal(totalReal,totalProjetado);
    const saldoFinal=saldoFinalMetodo(method);
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">💵 Demonstração do Fluxo de Caixa — Método {indireto?'Indireto':'Direto'} (Realizado + Projetado)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground w-[44%]">Descrição</th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground w-[18%]">Realizado<br/><span className="text-[9px] font-normal normal-case">{periodoReal}</span></th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 w-[18%] bg-blue-50/40 dark:bg-blue-950/10">Projetado<br/><span className="text-[9px] font-normal normal-case">{periodoProj}</span></th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-violet-600 dark:text-violet-400 w-[18%] bg-violet-50/30 dark:bg-violet-950/10">Total<br/><span className="text-[9px] font-normal normal-case">{selectedYear}</span></th>
                </tr>
              </thead>
              <tbody>
                {indireto
                  ?linhasTabelaIndireto.map(linha=>{
                    if(linha.tipo==='titulo'||linha.tipo==='grupo')return <DFC3Section key={linha.id} label={linha.nome}/>;
                    return renderFluxoRow(
                      method,
                      linha.id,
                      linha.nome,
                      linha.tipo==='conta'?1:0,
                      linha.tipo==='total'||linha.tipo==='subtotal',
                      linha.tipo==='conta',
                    );
                  })
                  :linhasRaizDfc.map(raiz=>{
                    const filhas=cadastro?.linhas.filter(linha=>linhaPai(linha)===raiz.id)??[];
                    return (
                      <Fragment key={raiz.id}>
                        {raiz.tipo==='total'&&<DFC3Section label={raiz.nome}/>}
                        {filhas.map(linha=>renderFluxoRow(method,linha.id,linha.nome,1,false,true))}
                        {renderFluxoRow(method,raiz.id,raiz.dfcSubtotalNome??raiz.nome,0,true)}
                      </Fragment>
                    );
                  })}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50/60 dark:bg-emerald-950/20 border-t-2 border-emerald-500/40">
                  <td className="py-3 px-3 text-sm font-bold text-foreground">VARIAÇÃO TOTAL DE CAIXA NO PERÍODO</td>
                  {[totalReal,totalProjetado,totalAno].map((value,index)=>(
                    <td key={index} className={cn("py-3 px-3 text-right font-mono text-sm font-bold",
                      value===null?"text-muted-foreground":value>=0?"text-emerald-600 dark:text-emerald-400":"text-red-600 dark:text-red-400",
                      index===1&&"bg-blue-50/40 dark:bg-blue-950/10",index===2&&"bg-violet-50/30 dark:bg-violet-950/10")}>
                      {value===null?'—':`${value>0?"+":value<0?"-":""}${fmtBRL(Math.abs(value))}`}
                    </td>
                  ))}
                </tr>
                <tr className="bg-muted/30">
                  <td className="py-2.5 px-3 text-sm text-muted-foreground">Saldo de Caixa — Período Anterior</td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm text-muted-foreground">{formatarSaldo(caixaEquivalentes.saldoInicial)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm text-muted-foreground bg-blue-50/40 dark:bg-blue-950/10">{formatarSaldo(caixaEquivalentes.saldoFinal)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm text-muted-foreground bg-violet-50/30">{formatarSaldo(caixaEquivalentes.saldoInicial)}</td>
                </tr>
                <tr className="bg-muted/50">
                  <td className="py-2.5 px-3 text-sm font-semibold text-foreground">Saldo de Caixa — Final do Período</td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm font-semibold text-foreground">{formatarSaldo(caixaEquivalentes.saldoFinal)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50/40 dark:bg-blue-950/10">{formatarSaldo(saldoFinal)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm font-semibold text-violet-700 dark:text-violet-300 bg-violet-50/30">{formatarSaldo(saldoFinal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground/60">
            * Realizado: soma dos {nReal} meses importados ({periodoReal}). Projetado: média mensal × {nProj} meses, ajustada pelo percentual compartilhado do bloco.
          </p>
        </CardContent>
      </Card>
    );
  };

  if(loading) return <p role="status" className="py-12 text-center text-sm text-muted-foreground">Carregando cadastro e premissas da projeção...</p>;
  if(loadError) return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</p>;
  if (nReal===0) return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
      <div className="text-5xl">📊</div>
      <p className="text-base font-semibold">Nenhum dado realizado disponível</p>
      <p className="text-sm text-center max-w-sm">Importe balancetes do ano {selectedYear} para habilitar a projeção automática.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Premissas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              ⚙️ Premissas de Projeção
              <span className="text-xs font-normal text-muted-foreground">— base: {nReal} {nReal===1?"mês":"meses"} ({periodoReal}); projeção de {nProj} meses ({periodoProj})</span>
            </CardTitle>
            <button onClick={handleSave} disabled={saving||!isDirty}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all",
                savedOk?"bg-emerald-50 text-emerald-700 border-emerald-300":
                isDirty?"bg-slate-800 text-white border-slate-700 hover:bg-slate-700":
                "bg-muted/40 text-muted-foreground border-border cursor-not-allowed")}>
              <Save className="w-3.5 h-3.5"/>
              {savedOk?"Salvo ✓":saving?"Salvando…":"Salvar Premissas"}
            </button>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3">
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">📊 DRE — premissas por linha de detalhe</p>
              <div className="max-h-64 space-y-3 overflow-y-auto pr-2">
                {linhasVisiveisDre.filter(({linha})=>linha.tipo==='contas').map(({linha,recuo})=>(
                  <PremissaRow key={linha.id} label={linha.nome} indent={recuo?1:0}
                    value={premissas.dre_linhas[linha.id]??0}
                    onChange={value=>setPremissas(current=>({
                      ...current,
                      dre_linhas:{...current.dre_linhas,[linha.id]:value},
                    }))}/>
                ))}
                {linhasDetalheDre.length===0&&<p className="text-xs text-muted-foreground">Nenhuma linha de detalhe da DRE está cadastrada.</p>}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">💵 FC Direto e Indireto — premissas compartilhadas</p>
              <PremissaRow label="Bloco Operacional" icon="↻" value={premissas.dfc_operacional} onChange={v=>setPremissas(p=>({...p,dfc_operacional:v}))}/>
              <PremissaRow label="Bloco de Investimento" icon="↗" value={premissas.dfc_investimento} onChange={v=>setPremissas(p=>({...p,dfc_investimento:v}))}/>
              <PremissaRow label="Bloco de Financiamento" icon="↔" value={premissas.dfc_financiamento} onChange={v=>setPremissas(p=>({...p,dfc_financiamento:v}))}/>
            </div>
          </div>
          {saveError&&<p role="alert" className="pt-3 text-xs text-red-600">{saveError}</p>}
          <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1 pt-3">
            <Info className="w-3 h-3 flex-shrink-0"/>
            DRE: ajuste individual por linha. FC Direto e Indireto: mesmos ajustes por bloco. Projeção = média mensal × {nProj} meses × (1 + %).
          </p>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {label:"Resultado Realizado",   value:totalRealResult, sub:periodoReal,    icon:"📊"},
          {label:"Resultado Projetado",   value:totalProjResult, sub:periodoProj,    icon:"📈"},
          {label:"Resultado do Exercício",value:totalAno,        sub:`Total ${selectedYear}`,icon:"🧾"},
          {label:`Saldo Final — FC ${subTab==="direto"?"Direto":"Indireto"}`, value:saldoFinalProj, sub:`Dez/${yr2} estimado`, icon:"💵"},
        ].map((k,i)=>(
          <Card key={i} className={cn("border-l-4",k.value===null?"border-l-muted":k.value>=0?"border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/10":"border-l-red-500 bg-red-50/40 dark:bg-red-950/10")}>
            <CardContent className="pt-4 pb-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{k.icon} {k.label}</div>
              <div className={cn("text-lg font-bold font-mono",k.value===null?"text-muted-foreground":k.value>=0?"text-emerald-600 dark:text-emerald-400":"text-red-600 dark:text-red-400")}>
                {k.value===null?"—":`${k.value>0?"+":k.value<0?"-":""}${fmtBRL(k.value,true)}`}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sub-abas */}
      <div className="flex gap-2">
        {([{id:"indireto",label:"💵 FC Indireto Projetado"},{id:"direto",label:"💵 FC Direto Projetado"},{id:"resultado",label:"📊 Resultado do Exercício"}] as const).map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            className={cn("px-4 py-2 text-sm font-semibold rounded-lg border transition-colors",
              subTab===t.id?"bg-green-700 text-white border-green-600":"bg-muted/40 text-muted-foreground border-border hover:bg-muted/70")}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab==="indireto"&&renderTabelaDfc("indireto")}
      {subTab==="direto"&&renderTabelaDfc("direto")}

      {/* DRE projetada com as linhas cadastradas */}
      {subTab === 'resultado' && (
        <>
          {!resultLineId && <p role="status" className="text-sm text-amber-700">Cadastre uma linha de Resultado Líquido na DRE para habilitar o gráfico e os totais do exercício.</p>}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">📊 Resultado Mensal + Acumulado — Jan–Dez/{yr2}</CardTitle>
              <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"/>Realizado</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-400 opacity-70"/>Projetado</span>
                <span className="flex items-center gap-1"><span className="w-5 h-0.5 bg-violet-500"/>Acumulado</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={270}>
                <ComposedChart data={chartDRE} margin={{top:5,right:20,left:10,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4}/>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:"hsl(var(--muted-foreground))"}}/>
                  <YAxis tick={{fontSize:9,fill:"hsl(var(--muted-foreground))"}} width={52}
                    tickFormatter={v=>{const a=Math.abs(v);return a>=1e6?`${(v/1e6).toFixed(1)}M`:a>=1e3?`${(v/1e3).toFixed(0)}k`:String(v);}}/>
                  <Tooltip content={<ChartTooltip fmtBRL={fmtBRL}/>}/>
                  {splitLabel&&<ReferenceLine x={splitLabel} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" opacity={0.5}
                    label={{value:"Real | Projetado",position:"insideTopLeft",fontSize:9,fill:"hsl(var(--muted-foreground))"}}/>}
                  <Bar dataKey="resultReal" name="Resultado (real)" radius={[3,3,0,0]} maxBarSize={28}>
                    {chartDRE.map((row,index)=><Cell key={index} fill={(row.resultReal??0)>=0?"#10b981":"#ef4444"}/>)}
                  </Bar>
                  <Bar dataKey="resultProj" name="Resultado (projetado)" radius={[3,3,0,0]} maxBarSize={28} opacity={0.65}>
                    {chartDRE.map((row,index)=><Cell key={index} fill={(row.resultProj??0)>=0?"#60a5fa":"#fbbf24"}/>)}
                  </Bar>
                  <Line dataKey="acumLinha" name="Acumulado" type="monotone" stroke="#8b5cf6" strokeWidth={2}
                    dot={{r:3,fill:"#8b5cf6"}} connectNulls/>
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">📋 DRE Projetada — Detalhamento Mensal por Linha</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="py-2 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Mês</th>
                      {linhasVisiveisDre.map(({linha,recuo})=>(
                        <th key={linha.id} title={linha.nome} className={cn("py-2 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground min-w-[150px]",recuo&&"pl-6")}>
                          {linha.nome}
                        </th>
                      ))}
                      <th className="py-2 px-3 text-right text-xs uppercase tracking-wider text-violet-600">Resultado Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dreRows.map(row=>(
                      <tr key={row.month} className={cn("border-b border-border/40",row.isProjected?"bg-blue-50/40 dark:bg-blue-950/10":"hover:bg-muted/30")}>
                        <td className="py-2 px-3 font-medium text-foreground whitespace-nowrap">
                          {row.label}{row.isProjected&&<span className="ml-1.5 text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded font-semibold">PROJ</span>}
                        </td>
                        {linhasVisiveisDre.map(({linha})=>{
                          const value=row.values.get(linha.id)??null;
                          return <td key={linha.id} className={cn("py-2 px-3 text-right font-mono whitespace-nowrap",linha.tipo==='total'&&"font-semibold",value===null?"text-muted-foreground":value<0?"text-red-600/80":"text-foreground")}>
                            {value===null?'—':value<0?`(${fmtBRL(Math.abs(value))})`:fmtBRL(value)}
                          </td>;
                        })}
                        <td className={cn("py-2 px-3 text-right font-mono font-semibold whitespace-nowrap",row.resultAcum===null?"text-muted-foreground":row.resultAcum>=0?"text-violet-600 dark:text-violet-400":"text-red-600 dark:text-red-400")}>
                          {row.resultAcum===null?'—':row.resultAcum<0?`(${fmtBRL(Math.abs(row.resultAcum))})`:fmtBRL(row.resultAcum)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/60 border-t-2 border-border font-bold">
                      <td className="py-2.5 px-3 text-sm text-foreground">TOTAL {selectedYear}</td>
                      {linhasVisiveisDre.map(({linha})=>{
                        const value=acumuladoDrePorLinha(linha.id);
                        return <td key={linha.id} className={cn("py-2.5 px-3 text-right font-mono whitespace-nowrap",value===null?"text-muted-foreground":value<0?"text-red-600/80":"text-foreground")}>
                          {value===null?'—':value<0?`(${fmtBRL(Math.abs(value))})`:fmtBRL(value)}
                        </td>;
                      })}
                      <td className={cn("py-2.5 px-3 text-right font-mono text-sm",totalAno===null?"text-muted-foreground":totalAno>=0?"text-violet-600 dark:text-violet-400":"text-red-600 dark:text-red-400")}>
                        {totalAno===null?'—':totalAno<0?`(${fmtBRL(Math.abs(totalAno))})`:fmtBRL(totalAno)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      <p className="text-[10px] text-muted-foreground/60 px-1">
        * Projeção baseada na média dos {nReal} {nReal===1?"mês":"meses"} realizados de {selectedYear}. Valores projetados são estimativas — não substituem demonstrações contábeis oficiais.
      </p>
    </div>
  );
}
