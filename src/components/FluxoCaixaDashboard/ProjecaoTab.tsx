/**
 * ProjecaoTab — Projeção de Caixa e Resultado do Exercício
 *
 * Sub-abas:
 *  1. FC Indireto Projetado (mesmo formato da aba FC Indireto, com totais
 *     Realizado / Projetado / Total Ano)
 *  2. Resultado do Exercício (DRE mensal realizado + projetado)
 */

import { useState, useEffect, useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { kvGet, kvSet } from "@/lib/kvClient";
import { Save, Info } from "lucide-react";

const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export interface ProjecaoPremissas {
  receitas: number; cmv: number; despesasOper: number; rendimentos: number;
  dfc_operacional: number; dfc_investimento: number; dfc_financiamento: number;
}

interface DFCMes {
  resLiq:number; deprec:number;
  dEstoqueVW:number; dEstoqueAudi:number; dCred:number; dContasCorr:number;
  dValDiv:number; dDespAntec:number; dOutrasAtivAudi:number;
  dFornec:number; dObrigTrib:number; dObrigTrab:number; dContasPag:number;
  dRealizLPCred:number; dEmpCP01:number; dOutros221:number; dRecDiferidas:number;
  dPL_extra:number; dIntangivel:number; fluxoOper:number;
  dImobiliz:number; dInvestimentos:number; dRealizLPOutros:number; fluxoInvest:number;
  dEmpCP02:number; dFpFloorAudi:number; dEmpLP:number; dPesLig:number;
  dDebLig:number; dArr:number; dOutPassLP:number; fluxoFinanc:number;
  fluxoTotal:number; saldoCaixa:number; saldoAntCaixa:number;
}

interface Props {
  allMonthsAccounts: Array<Record<string,any>>;
  selectedYear: number; selectedMonth: number;
  fmtBRL: (v:number, compact?:boolean) => string;
}

const DEFAULT_PREM: ProjecaoPremissas = {
  receitas:0, cmv:0, despesasOper:0, rendimentos:0,
  dfc_operacional:0, dfc_investimento:0, dfc_financiamento:0,
};
const premKey = (y:number) => `projecao_premissas_${y}`;
async function loadPremissas(y:number): Promise<ProjecaoPremissas> {
  try { const d = await kvGet<ProjecaoPremissas>(premKey(y)); return d ? {...DEFAULT_PREM,...d} : DEFAULT_PREM; }
  catch { return DEFAULT_PREM; }
}
async function savePremissas(y:number, p:ProjecaoPremissas) {
  try { await kvSet(premKey(y), p); } catch {}
}

function computeDFC(accounts: Record<string,any>): DFCMes {
  const getS = (id:string) => Math.abs(accounts[id]?.saldoAtual || 0);
  const getA = (id:string) => Math.abs(accounts[id]?.saldoAnt   || 0);
  const mov  = (id:string) => Math.abs((accounts[id]?.valDeb||0)-(accounts[id]?.valCred||0));

  const resLiq  = mov("3.1")-mov("3.2")-mov("3.3")-mov("4")-mov("5")+mov("3.4")+mov("3.5")+mov("3.6")-mov("6");
  const deprec  = mov("5.5.2.07.20");
  const dEstoqueVW      = getS("1.1.2")-getA("1.1.2");
  const dEstoqueAudi    = getS("1.1.7.02")-getA("1.1.7.02");
  const dCred           = getS("1.1.3")-getA("1.1.3");
  const dContasCorr     = getS("1.1.4")-getA("1.1.4");
  const dValDiv         = getS("1.1.5")-getA("1.1.5");
  const dDespAntec      = getS("1.1.6")-getA("1.1.6");
  const dOutrasAtivAudi = (getS("1.1.7")-getS("1.1.7.02"))-(getA("1.1.7")-getA("1.1.7.02"));
  const fpAtu=getS("2.1.4.01.01.007"); const fpAnt=getA("2.1.4.01.01.007");
  const dFornec    = (getS("2.1.3")+getS("2.1.4")-fpAtu)-(getA("2.1.3")+getA("2.1.4")-fpAnt);
  const dObrigTrib = getS("2.1.2.02")-getA("2.1.2.02");
  const dObrigTrab = getS("2.1.2.01")-getA("2.1.2.01");
  const dContasPag = getS("2.1.2.03")-getA("2.1.2.03");
  const dRealizLPCred = getS("1.5.1.01.52")-getA("1.5.1.01.52");
  const dEmpCP01   = getS("2.1.1.01")-getA("2.1.1.01");
  const empLPAtu=getS("2.2.1.07"); const empLPAnt=getA("2.2.1.07");
  const pesLigAtu=getS("2.2.1.01"); const pesLigAnt=getA("2.2.1.01");
  const debLigAtu=getS("2.2.1.02"); const debLigAnt=getA("2.2.1.02");
  const arrAtu=getS("2.2.1.15");    const arrAnt=getA("2.2.1.15");
  const g221Atu=getS("2.2.1");      const g221Ant=getA("2.2.1");
  const dOutros221   = (g221Atu-empLPAtu-pesLigAtu-debLigAtu-arrAtu)-(g221Ant-empLPAnt-pesLigAnt-debLigAnt-arrAnt);
  const dRecDiferidas= getS("2.2.2")-getA("2.2.2");
  const PLAtu=getS("2.3"); const PLAnt=getA("2.3");
  const dPL_extra  = (PLAtu-PLAnt)-resLiq;
  const dIntangivel= getS("1.5.7")-getA("1.5.7");

  const fluxoOper = resLiq+deprec
    -dEstoqueVW-dEstoqueAudi-dCred-dContasCorr-dValDiv-dDespAntec-dOutrasAtivAudi
    +dFornec+dObrigTrib+dObrigTrab+dContasPag
    -dRealizLPCred+dEmpCP01+dOutros221+dRecDiferidas+dPL_extra-dIntangivel;

  const dImobiliz      = getS("1.5.5")-getA("1.5.5");
  const dInvestimentos = getS("1.5.3")-getA("1.5.3");
  const dRealizLPOutros= (getS("1.5.1")-getS("1.5.1.01.52"))-(getA("1.5.1")-getA("1.5.1.01.52"));
  const fluxoInvest = -dImobiliz-dInvestimentos-dRealizLPOutros+dIntangivel;

  const dEmpCP02  = getS("2.1.1.02")-getA("2.1.1.02");
  const dFpFloorAudi = fpAtu-fpAnt;
  const dEmpLP=empLPAtu-empLPAnt; const dPesLig=pesLigAtu-pesLigAnt;
  const dDebLig=debLigAtu-debLigAnt; const dArr=arrAtu-arrAnt;
  const dOutPassLP=getS("2.2.3")-getA("2.2.3");
  const fluxoFinanc = dEmpCP02+dFpFloorAudi+dEmpLP+dPesLig+dDebLig+dArr+dOutPassLP-dPL_extra;
  const fluxoTotal = fluxoOper+fluxoInvest+fluxoFinanc;

  return {
    resLiq, deprec,
    dEstoqueVW:-dEstoqueVW, dEstoqueAudi:-dEstoqueAudi,
    dCred:-dCred, dContasCorr:-dContasCorr, dValDiv:-dValDiv,
    dDespAntec:-dDespAntec, dOutrasAtivAudi:-dOutrasAtivAudi,
    dFornec, dObrigTrib, dObrigTrab, dContasPag,
    dRealizLPCred:-dRealizLPCred, dEmpCP01, dOutros221, dRecDiferidas,
    dPL_extra, dIntangivel:-dIntangivel, fluxoOper,
    dImobiliz:-dImobiliz, dInvestimentos:-dInvestimentos, dRealizLPOutros:-dRealizLPOutros,
    fluxoInvest,
    dEmpCP02, dFpFloorAudi, dEmpLP, dPesLig, dDebLig, dArr, dOutPassLP,
    fluxoFinanc, fluxoTotal,
    saldoCaixa:getS("1.1.1"), saldoAntCaixa:getA("1.1.1"),
  };
}

function sumDFC(arr: DFCMes[]): DFCMes {
  const base = {...arr[0]};
  for (let i=1;i<arr.length;i++)
    (Object.keys(base) as Array<keyof DFCMes>).forEach(k => { (base[k] as number)+=(arr[i][k] as number); });
  return base;
}

function projectDFC(avg: DFCMes, nMeses:number, prem: ProjecaoPremissas): DFCMes {
  const o=1+prem.dfc_operacional/100, inv=1+prem.dfc_investimento/100, fin=1+prem.dfc_financiamento/100;
  const n=nMeses;
  const operKeys: Array<keyof DFCMes> = ["resLiq","deprec","dEstoqueVW","dEstoqueAudi","dCred","dContasCorr","dValDiv","dDespAntec","dOutrasAtivAudi","dFornec","dObrigTrib","dObrigTrab","dContasPag","dRealizLPCred","dEmpCP01","dOutros221","dRecDiferidas","dPL_extra","dIntangivel","fluxoOper"];
  const invKeys:  Array<keyof DFCMes> = ["dImobiliz","dInvestimentos","dRealizLPOutros","fluxoInvest"];
  const finKeys:  Array<keyof DFCMes> = ["dEmpCP02","dFpFloorAudi","dEmpLP","dPesLig","dDebLig","dArr","dOutPassLP","fluxoFinanc"];
  const proj = {...avg} as DFCMes;
  operKeys.forEach(k => { (proj[k] as number) = (avg[k] as number)*n*o; });
  invKeys.forEach( k => { (proj[k] as number) = (avg[k] as number)*n*inv; });
  finKeys.forEach( k => { (proj[k] as number) = (avg[k] as number)*n*fin; });
  proj.fluxoTotal = proj.fluxoOper+proj.fluxoInvest+proj.fluxoFinanc;
  proj.saldoCaixa=0; proj.saldoAntCaixa=0;
  return proj;
}

function fmtPct(v:number){ return (v>=0?"+":"")+v.toFixed(0)+"%"; }

function DFC3Row({ label,real,proj,total,indent=0,totalRow=false,highlight=false,fmtBRL,hideIfZero=false }:{
  label:string; real:number; proj:number; total:number;
  indent?:number; totalRow?:boolean; highlight?:boolean;
  fmtBRL:(v:number)=>string; hideIfZero?:boolean;
}) {
  if (hideIfZero && Math.abs(real)<0.5 && Math.abs(proj)<0.5) return null;
  const pad = indent===1?"pl-6":indent===2?"pl-10":"";
  const rowCls = highlight ? "bg-muted/60 font-bold border-t-2 border-border"
               : totalRow  ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-t border-emerald-300/40 font-bold"
               : "border-b border-border/30 hover:bg-muted/20";
  const colVal=(v:number,bg:string)=>cn("text-right font-mono text-xs tabular-nums py-2 px-3",bg,
    (totalRow||highlight)?(v>=0?"text-emerald-600 dark:text-emerald-400":"text-red-600 dark:text-red-400"):"text-foreground");
  const fmt=(v:number)=>Math.abs(v)<0.5?"—":(v>0?"+":"-")+fmtBRL(Math.abs(v));
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
function PremissaRow({label,icon,value,onChange}:{label:string;icon:string;value:number;onChange:(v:number)=>void}) {
  const c=value>0?"text-emerald-600 dark:text-emerald-400":value<0?"text-red-600 dark:text-red-400":"text-muted-foreground";
  return (
    <div className="flex items-center gap-3">
      <span className="text-base w-5 flex-shrink-0">{icon}</span>
      <span className="text-xs text-foreground w-44 flex-shrink-0">{label}</span>
      <input type="range" min={-50} max={100} step={5} value={value}
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
  const [subTab,setSubTab]         = useState<"dfc"|"resultado">("dfc");
  const yr2 = String(selectedYear).slice(2);

  useEffect(()=>{ loadPremissas(selectedYear).then(p=>{ setPremissas(p); setSavedPrem(p); }); },[selectedYear]);

  const isDirty = JSON.stringify(premissas)!==JSON.stringify(savedPrem);
  const handleSave = async () => {
    setSaving(true); await savePremissas(selectedYear,premissas);
    setSavedPrem(premissas); setSaving(false); setSavedOk(true);
    setTimeout(()=>setSavedOk(false),2500);
  };

  // DRE mensal
  const dreReal = useMemo(()=>allMonthsAccounts.map((acc,i)=>{
    if (Object.keys(acc||{}).length<5) return null;
    const mv=(id:string)=>Math.abs((acc[id]?.valDeb||0)-(acc[id]?.valCred||0));
    const recLiquida=mv("3.1")-mv("3.2")-mv("3.3");
    const cmv=mv("4"); const despOper=mv("5");
    const rendimentos=mv("3.4")+mv("3.5")+mv("3.6"); const ir=mv("6");
    return { month:i+1, recLiquida, cmv, despOper, rendimentos, ir,
             resultLiq:recLiquida-cmv-despOper+rendimentos-ir,
             saldoCaixa:Math.abs(acc["1.1.1"]?.saldoAtual||0) };
  }).filter(Boolean) as Array<{month:number;recLiquida:number;cmv:number;despOper:number;rendimentos:number;ir:number;resultLiq:number;saldoCaixa:number}>,[allMonthsAccounts]);

  // DFC mensal
  const dfcReal = useMemo(()=>allMonthsAccounts
    .map(acc=>Object.keys(acc||{}).length>5?computeDFC(acc):null)
    .filter(Boolean) as DFCMes[],[allMonthsAccounts]);

  const nReal = dfcReal.length;
  const lastRealMonth = dreReal.at(-1)?.month??0;
  const nProj = 12-lastRealMonth;

  const dfcSomaReal = useMemo(()=>nReal>0?sumDFC(dfcReal):null,[dfcReal,nReal]);

  const dfcProj = useMemo(()=>{
    if (!dfcSomaReal||nReal===0||nProj===0) return null;
    const avgDFC = Object.fromEntries(
      (Object.keys(dfcSomaReal) as Array<keyof DFCMes>).map(k=>[k,(dfcSomaReal[k] as number)/nReal])
    ) as DFCMes;
    return projectDFC(avgDFC,nProj,premissas);
  },[dfcSomaReal,nReal,nProj,premissas]);

  const dfcTot = useMemo(()=>{
    if (!dfcSomaReal) return null;
    if (!dfcProj) return dfcSomaReal;
    return Object.fromEntries(
      (Object.keys(dfcSomaReal) as Array<keyof DFCMes>).map(k=>[k,(dfcSomaReal[k] as number)+(dfcProj[k] as number)])
    ) as DFCMes;
  },[dfcSomaReal,dfcProj]);

  // DRE projetado mensal completo
  const dreCompleto = useMemo(()=>{
    if (dreReal.length===0) return [];
    const n=dreReal.length;
    const avg=(fn:(d:typeof dreReal[0])=>number)=>dreReal.reduce((s,d)=>s+fn(d),0)/n;
    const aRL=avg(d=>d.recLiquida),aCMV=avg(d=>d.cmv),aD=avg(d=>d.despOper),aR=avg(d=>d.rendimentos),aIR=avg(d=>d.ir);
    const rows: any[] = dreReal.map((d,i)=>({...d,label:`${MONTH_SHORT[d.month-1]}/${yr2}`,resultAcum:0,varCaixa:0,isProjected:false}));
    let prev=dreReal.at(-1)!.saldoCaixa;
    const avgVC=n>1?(dreReal.at(-1)!.saldoCaixa-dreReal[0].saldoCaixa)/(n-1):0;
    const m=(p:number)=>1+p/100;
    for (let mo=lastRealMonth+1;mo<=12;mo++) {
      const rL=aRL*m(premissas.receitas),c=aCMV*m(premissas.cmv),d=aD*m(premissas.despesasOper),r=aR*m(premissas.rendimentos),ir=aIR;
      const rq=rL-c-d+r-ir; const vc=avgVC*m(premissas.receitas*0.5);
      const sc=Math.max(0,prev+vc); prev=sc;
      rows.push({month:mo,label:`${MONTH_SHORT[mo-1]}/${yr2}`,recLiquida:rL,cmv:c,despOper:d,rendimentos:r,ir,resultLiq:rq,saldoCaixa:sc,resultAcum:0,varCaixa:vc,isProjected:true});
    }
    let acum=0; for (const r of rows){acum+=r.resultLiq;r.resultAcum=acum;}
    return rows;
  },[dreReal,premissas,lastRealMonth,yr2]);

  const periodoReal = nReal>0?(nReal===1?`${MONTH_SHORT[dreReal[0].month-1]}/${yr2}`:`Jan–${MONTH_SHORT[lastRealMonth-1]}/${yr2}`):"?";
  const periodoProj = nProj>0?`${MONTH_SHORT[lastRealMonth]}–Dez/${yr2}`:"Concluído";
  const totalRealResult = dreReal.reduce((s,d)=>s+d.resultLiq,0);
  const totalProjResult = dreCompleto.filter((d:any)=>d.isProjected).reduce((s:number,d:any)=>s+d.resultLiq,0);
  const totalAno = totalRealResult+totalProjResult;
  const saldoFinalProj = (dfcSomaReal?.saldoCaixa??0)+(dfcProj?.fluxoTotal??0);
  const splitLabel = dreCompleto.find((d:any)=>d.isProjected)?.label??null;
  const chartDRE = dreCompleto.map((d:any)=>({label:d.label,resultReal:!d.isProjected?d.resultLiq:undefined,resultProj:d.isProjected?d.resultLiq:undefined,acumLinha:d.resultAcum}));

  if (dreReal.length===0) return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
      <div className="text-5xl">??</div>
      <p className="text-base font-semibold">Nenhum dado realizado disponível</p>
      <p className="text-sm text-center max-w-sm">Importe balancetes do ano {selectedYear} para habilitar a proje??o autom?tica.</p>
    </div>
  );

  const R=dfcSomaReal??({} as DFCMes);
  const P=dfcProj??({} as DFCMes);
  const T=dfcTot??({} as DFCMes);
  const row=(label:string,key:keyof DFCMes,indent?:number,hideIfZero?:boolean)=>(
    <DFC3Row key={label} label={label}
      real={R[key] as number??0} proj={P[key] as number??0} total={T[key] as number??0}
      indent={indent} fmtBRL={fmtBRL} hideIfZero={hideIfZero??true}/>
  );

  return (
    <div className="space-y-4">
      {/* Premissas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              ⚙️ Premissas de Projeção
              <span className="text-xs font-normal text-muted-foreground">— base: {nReal} {nReal===1?"mês":"meses"} ({periodoReal}) ? projetando {nProj} meses ({periodoProj})</span>
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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">?? DRE — Resultado do Exercício</p>
              <PremissaRow label="Receitas" icon="??" value={premissas.receitas} onChange={v=>setPremissas(p=>({...p,receitas:v}))}/>
              <PremissaRow label="CMV / Custo de Vendas" icon="??" value={premissas.cmv} onChange={v=>setPremissas(p=>({...p,cmv:v}))}/>
              <PremissaRow label="Despesas Operacionais" icon="??" value={premissas.despesasOper} onChange={v=>setPremissas(p=>({...p,despesasOper:v}))}/>
              <PremissaRow label="Rendimentos / Outros" icon="??" value={premissas.rendimentos} onChange={v=>setPremissas(p=>({...p,rendimentos:v}))}/>
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">💵 Fluxo de Caixa (FC Indireto) ? por bloco</p>
              <PremissaRow label="Bloco Operacional" icon="??" value={premissas.dfc_operacional} onChange={v=>setPremissas(p=>({...p,dfc_operacional:v}))}/>
              <PremissaRow label="Bloco de Investimento" icon="???" value={premissas.dfc_investimento} onChange={v=>setPremissas(p=>({...p,dfc_investimento:v}))}/>
              <PremissaRow label="Bloco de Financiamento" icon="???" value={premissas.dfc_financiamento} onChange={v=>setPremissas(p=>({...p,dfc_financiamento:v}))}/>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1 pt-3">
            <Info className="w-3 h-3 flex-shrink-0"/>
            Cada bloco do FC é ajustado individualmente. Projeção = média mensal × {nProj} meses × (1 + %).
          </p>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {label:"Resultado Realizado",   value:totalRealResult, sub:periodoReal,    icon:"??"},
          {label:"Resultado Projetado",   value:totalProjResult, sub:periodoProj,    icon:"??"},
          {label:"Resultado do Exercício",value:totalAno,        sub:`Total ${selectedYear}`,icon:"??"},
          {label:"Saldo Final Projetado", value:saldoFinalProj,  sub:`Dez/${yr2} estimado`,  icon:"💵"},
        ].map((k,i)=>(
          <Card key={i} className={cn("border-l-4",k.value>=0?"border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/10":"border-l-red-500 bg-red-50/40 dark:bg-red-950/10")}>
            <CardContent className="pt-4 pb-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{k.icon} {k.label}</div>
              <div className={cn("text-lg font-bold font-mono",k.value>=0?"text-emerald-600 dark:text-emerald-400":"text-red-600 dark:text-red-400")}>
                {k.value>0?"+":k.value<0?"-":""}{fmtBRL(k.value,true)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sub-abas */}
      <div className="flex gap-2">
        {([{id:"dfc",label:"💵 FC Indireto Projetado"},{id:"resultado",label:"📊 Resultado do Exercício"}] as const).map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            className={cn("px-4 py-2 text-sm font-semibold rounded-lg border transition-colors",
              subTab===t.id?"bg-green-700 text-white border-green-600":"bg-muted/40 text-muted-foreground border-border hover:bg-muted/70")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* FC Indireto */}
      {subTab==="dfc" && dfcSomaReal && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">💵 Demonstração do Fluxo de Caixa — Método Indireto (Realizado + Projetado)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground w-[44%]">Descri??o</th>
                    <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground w-[18%]">Realizado<br/><span className="text-[9px] font-normal normal-case">{periodoReal}</span></th>
                    <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 w-[18%] bg-blue-50/40 dark:bg-blue-950/10">Projetado<br/><span className="text-[9px] font-normal normal-case">{periodoProj}</span></th>
                    <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-violet-600 dark:text-violet-400 w-[18%] bg-violet-50/30 dark:bg-violet-950/10">Total<br/><span className="text-[9px] font-normal normal-case">{selectedYear}</span></th>
                  </tr>
                </thead>
                <tbody>
                  <DFC3Section label="Atividades Operacionais"/>
                  {row("(+/-) Resultado Líquido do Exercício (base NBC TG 03)","resLiq",1)}
                  {row("(+) Depreciação e Amortização","deprec",1,true)}
                  {row("(+/-) Variação de Estoques VW (1.1.2)","dEstoqueVW",1)}
                  {row("(+/-) Variação de Estoques Audi (1.1.7.02)","dEstoqueAudi",1)}
                  {row("(+/-) Variação de Créditos de Vendas (1.1.3)","dCred",1)}
                  {row("(+/-) Variação de Contas Correntes (1.1.4)","dContasCorr",1,true)}
                  {row("(+/-) Variação de Valores Diversos (1.1.5)","dValDiv",1,true)}
                  {row("(+/-) Variação de Despesas Antecipadas (1.1.6)","dDespAntec",1,true)}
                  {row("(+/-) Outros Ativos Audi excl. estoque (1.1.7 - 1.1.7.02)","dOutrasAtivAudi",1,true)}
                  {row("(+/-) Variação de Fornecedores (2.1.3 + 2.1.4)","dFornec",1)}
                  {row("(+/-) Variação de Obrigações Tributárias (2.1.2.02)","dObrigTrib",1)}
                  {row("(+/-) Variação de Obrigações Trabalhistas (2.1.2.01)","dObrigTrab",1)}
                  {row("(+/-) Variação de Contas a Pagar (2.1.2.03)","dContasPag",1)}
                  {row("(+/-) Créditos c/ Ligadas LP (1.5.1.01.52)","dRealizLPCred",1,true)}
                  {row("(+/-) Fornecedores / Outros CP (2.1.1.01)","dEmpCP01",1,true)}
                  {row("(+/-) Outros Passivos LP não mapeados (2.2.1 ? demais)","dOutros221",1,true)}
                  {row("(+/-) Receitas Diferidas / ICMS ST (2.2.2)","dRecDiferidas",1,true)}
                  {row("(+/-) Aportes / Retiradas de PL (excl. resultado)","dPL_extra",1,true)}
                  {row("(+/-) Variação L?quida do Intangível (1.5.7)","dIntangivel",1,true)}
                  <DFC3Row label="CAIXA LÍQUIDO DAS ATIVIDADES OPERACIONAIS"
                    real={R.fluxoOper} proj={P.fluxoOper??0} total={T.fluxoOper} totalRow fmtBRL={fmtBRL}/>
                  <DFC3Section label="Atividades de Investimento"/>
                  {row("(+/-) Variação L?quida do Imobilizado (1.5.5)","dImobiliz",1)}
                  {row("(+/-) Variação de Investimentos (1.5.3)","dInvestimentos",1,true)}
                  {row("(+/-) Variação Realizável LP excl. cred. ligadas","dRealizLPOutros",1,true)}
                  <DFC3Row label="CAIXA LÍQUIDO DAS ATIVIDADES DE INVESTIMENTO"
                    real={R.fluxoInvest} proj={P.fluxoInvest??0} total={T.fluxoInvest} totalRow fmtBRL={fmtBRL}/>
                  <DFC3Section label="Atividades de Financiamento"/>
                  {row("(+/-) Financiamentos CP / Floor Plan (2.1.1.02)","dEmpCP02",1,true)}
                  {row("(+/-) Floor Plan Novos Audi (2.1.4.01.01.007)","dFpFloorAudi",1,true)}
                  {row("(+/-) Empréstimos Bancários LP (2.2.1.07)","dEmpLP",1,true)}
                  {row("(+/-) Sócios / Pessoas Ligadas (2.2.1.01)","dPesLig",1,true)}
                  {row("(+/-) Débitos com Ligadas LP (2.2.1.02)","dDebLig",1,true)}
                  {row("(+/-) Arrendamentos LP (2.2.1.15)","dArr",1,true)}
                  {row("(+/-) Outros Passivos LP (2.2.3)","dOutPassLP",1,true)}
                  <DFC3Row label="CAIXA LÍQUIDO DAS ATIVIDADES DE FINANCIAMENTO"
                    real={R.fluxoFinanc} proj={P.fluxoFinanc??0} total={T.fluxoFinanc} totalRow fmtBRL={fmtBRL}/>
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50/60 dark:bg-emerald-950/20 border-t-2 border-emerald-500/40">
                    <td className="py-3 px-3 text-sm font-bold text-foreground">VARIAÇÃO TOTAL DE CAIXA NO PERÍODO</td>
                    {([R.fluxoTotal,P.fluxoTotal??0,T.fluxoTotal] as number[]).map((v,i)=>(
                      <td key={i} className={cn("py-3 px-3 text-right font-mono text-sm font-bold",
                        v>=0?"text-emerald-600 dark:text-emerald-400":"text-red-600 dark:text-red-400",
                        i===1&&"bg-blue-50/40 dark:bg-blue-950/10",i===2&&"bg-violet-50/30 dark:bg-violet-950/10")}>
                        {(v>0?"+":v<0?"-":"")+fmtBRL(Math.abs(v))}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-muted/30">
                    <td className="py-2.5 px-3 text-sm text-muted-foreground">Saldo de Caixa — Período Anterior</td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm text-muted-foreground">{fmtBRL(R.saldoAntCaixa)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm text-muted-foreground bg-blue-50/40 dark:bg-blue-950/10">{fmtBRL(R.saldoCaixa)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm text-muted-foreground bg-violet-50/30">{fmtBRL(R.saldoAntCaixa)}</td>
                  </tr>
                  <tr className="bg-muted/50">
                    <td className="py-2.5 px-3 text-sm font-semibold text-foreground">Saldo de Caixa — Final do Período</td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm font-semibold text-foreground">{fmtBRL(R.saldoCaixa)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50/40 dark:bg-blue-950/10">{fmtBRL(R.saldoCaixa+(P.fluxoTotal??0))}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm font-semibold text-violet-700 dark:text-violet-300 bg-violet-50/30 dark:bg-violet-950/10">{fmtBRL(R.saldoCaixa+(P.fluxoTotal??0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground/60">
              * Realizado: soma de {nReal} {nReal===1?"mês":"meses"} importados ({periodoReal}).
              Projetado: média mensal ? {nProj} meses, ajustada pelos blocos configurados.
              Saldo final projetado = saldo atual + variação total projetada.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Resultado DRE */}
      {subTab==="resultado" && (
        <>
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
                    label={{value:"? Real | Proj ?",position:"insideTopLeft",fontSize:9,fill:"hsl(var(--muted-foreground))"}}/>}
                  <Bar dataKey="resultReal" name="Resultado (real)" radius={[3,3,0,0]} maxBarSize={28}>
                    {chartDRE.map((d:any,i:number)=><Cell key={i} fill={(d.resultReal??0)>=0?"#10b981":"#ef4444"}/>)}
                  </Bar>
                  <Bar dataKey="resultProj" name="Resultado (proj.)" radius={[3,3,0,0]} maxBarSize={28} opacity={0.65}>
                    {chartDRE.map((d:any,i:number)=><Cell key={i} fill={(d.resultProj??0)>=0?"#60a5fa":"#fbbf24"}/>)}
                  </Bar>
                  <Line dataKey="acumLinha" name="Acumulado" type="monotone" stroke="#8b5cf6" strokeWidth={2}
                    dot={{r:3,fill:"#8b5cf6"}} connectNulls/>
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">📋 DRE Projetado — Detalhamento Mensal</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="py-2 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Mês</th>
                      <th className="py-2 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Rec. Líq.</th>
                      <th className="py-2 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">CMV</th>
                      <th className="py-2 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Desp. Op.</th>
                      <th className="py-2 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Outros</th>
                      <th className="py-2 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Resultado</th>
                      <th className="py-2 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dreCompleto.map((d:any,i:number)=>(
                      <tr key={i} className={cn("border-b border-border/40",d.isProjected?"bg-blue-50/40 dark:bg-blue-950/10":"hover:bg-muted/30")}>
                        <td className="py-2 px-3 font-medium text-foreground flex items-center gap-1.5">
                          {d.label}
                          {d.isProjected&&<span className="text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded font-semibold">PROJ</span>}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-muted-foreground">{fmtBRL(d.recLiquida)}</td>
                        <td className="py-2 px-3 text-right font-mono text-red-600/80">({fmtBRL(d.cmv)})</td>
                        <td className="py-2 px-3 text-right font-mono text-red-600/80">({fmtBRL(d.despOper)})</td>
                        <td className={cn("py-2 px-3 text-right font-mono",d.rendimentos-d.ir>=0?"text-emerald-600/80":"text-red-600/80")}>
                          {d.rendimentos-d.ir>=0?"+":""}{fmtBRL(d.rendimentos-d.ir)}
                        </td>
                        <td className={cn("py-2 px-3 text-right font-mono font-bold",d.resultLiq>=0?"text-emerald-600 dark:text-emerald-400":"text-red-600 dark:text-red-400")}>
                          {d.resultLiq>=0?"+":"-"}{fmtBRL(Math.abs(d.resultLiq))}
                        </td>
                        <td className={cn("py-2 px-3 text-right font-mono font-semibold",d.resultAcum>=0?"text-violet-600 dark:text-violet-400":"text-red-600 dark:text-red-400")}>
                          {d.resultAcum>=0?"+":"-"}{fmtBRL(Math.abs(d.resultAcum))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/60 border-t-2 border-border font-bold">
                      <td className="py-2.5 px-3 text-sm text-foreground">TOTAL {selectedYear}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{fmtBRL(dreCompleto.reduce((s:number,d:any)=>s+d.recLiquida,0))}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-600/80">({fmtBRL(dreCompleto.reduce((s:number,d:any)=>s+d.cmv,0))})</td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-600/80">({fmtBRL(dreCompleto.reduce((s:number,d:any)=>s+d.despOper,0))})</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{fmtBRL(dreCompleto.reduce((s:number,d:any)=>s+d.rendimentos-d.ir,0))}</td>
                      <td className={cn("py-2.5 px-3 text-right font-mono text-sm",totalAno>=0?"text-emerald-600 dark:text-emerald-400":"text-red-600 dark:text-red-400")}>
                        {totalAno>=0?"+":"-"}{fmtBRL(Math.abs(totalAno))}
                      </td>
                      <td className={cn("py-2.5 px-3 text-right font-mono text-sm",totalAno>=0?"text-violet-600 dark:text-violet-400":"text-red-600 dark:text-red-400")}>
                        {totalAno>=0?"+":"-"}{fmtBRL(Math.abs(totalAno))}
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
        * Projeção baseada na média dos {nReal} {nReal===1?"mês":"meses"} realizados de {selectedYear}. Valores projetados s?o estimativas ? não constituem demonstra??es cont?beis oficiais.
      </p>
    </div>
  );
}
