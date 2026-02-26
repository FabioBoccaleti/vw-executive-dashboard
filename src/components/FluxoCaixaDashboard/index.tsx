import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, X, TrendingUp, TrendingDown, DollarSign, Package, Building2, BarChart3, Target, LogOut, Menu, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { BALANCETE_EXEMPLO } from "./balanceteExemplo";
import { loadFluxoCaixaRaw, saveFluxoCaixaData } from "./fluxoCaixaStorage";
import { ComparativosTab } from "./ComparativosTab";

// ─── PARSER ─────────────────────────────────────────────────────────────────
function parseBalancete(text: string) {
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
  // Estoques Audi (grupo 1.1.7) — atividade separada da VW
  const estAudi        = { ant: absAnt('1.1.7.02'), atu: absAtu('1.1.7.02') };
  const outrasAtivAudi = { ant: absAnt('1.1.7'),    atu: absAtu('1.1.7') };
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
    ajusteFornec + ajusteTrib + ajusteTrab + ajusteContasPag;

  // ── Atividades de Investimento ────────────────────────────────────────────
  const dIntangivel   = intangivel.atu   - intangivel.ant;
  const dRealizLPCred = realizLPCred.atu - realizLPCred.ant;
  const fluxoInvest = -(imobiliz.atu - imobiliz.ant)
                    - dIntangivel
                    - dRealizLPCred;

  // ── Atividades de Financiamento ─────────────────────────────────────────────
  const dEmprestCP  = emprestCP.atu  - emprestCP.ant;
  const dEmprestLP  = emprestLP.atu  - emprestLP.ant;
  const dPessoasLig = pessoasLig.atu - pessoasLig.ant;
  const dDebitosLig = debitosLig.atu - debitosLig.ant;
  const dArrendLP   = arrendLP.atu   - arrendLP.ant;
  // NOTA: 2.2.2 (Receitas Diferidas) excluída do financiamento — contém ICMS ST Diferido (não-caixa)

  const fluxoFinanc =
    dEmprestCP  +
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
    estoques, estVeicNovos, estVeicUsados, estPecas, estAudi, outrasAtivAudi,
    creditos, contasCorr, valDiversos, despAntec, despAntecEnc, despAntecGast,
    realizLP, realizLPCred, investimentos, imobiliz, intangivel,
    passivo: { circ: passCirc, naoCirc: passNaoCirc },
    emprestCP, obrigTrab, obrigTrib, contasPagar, fornecTotal, fornecVW, fornecAudi,
    PL, capitalSocial,
    receitas: { bruta: recBruta, liq: recLiq, impostosVendas, devolucoes, rendOper, rendFinanc },
    custos: { CMV, despPessoal_per, despFinanc_per, deprec_per },
    provisaoIR,
    dfc: {
      deprec: deprec_per,
      ajusteEstoque, ajusteCred, ajusteDespAntec, ajusteFornec, ajusteTrib, ajusteTrab, ajusteContasPag,
      fluxoOper, fluxoInvest, fluxoFinanc, fluxoTotal, varCaixaReal,
      dEstoque, dCred, dDespAntec, dFornec, dObrigTrib, dObrigTrab, dContasPag,
      dEmprestCP, dEmprestLP, dPessoasLig, dDebitosLig, dArrendLP,
      dIntangivel, dRealizLPCred,
      emprestCPAnt: emprestCP.ant, emprestCPAtu: emprestCP.atu,
      emprestLPAnt: emprestLP.ant, emprestLPAtu: emprestLP.atu,
      pessoasLigAnt: pessoasLig.ant, pessoasLigAtu: pessoasLig.atu,
      debitosLigAnt: debitosLig.ant, debitosLigAtu: debitosLig.atu,
      arrendLPAnt: arrendLP.ant, arrendLPAtu: arrendLP.atu,
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
const KPI = ({ label, value, sub, color = 'emerald', icon }: any) => {
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
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground mb-1">{value}</div>
        {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
};

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

const DFCRow = ({ label, value, indent = 0, highlight, total }: any) => {
  const isPos = value >= 0;
  return (
    <tr className={cn(highlight && 'bg-emerald-50 dark:bg-emerald-950/20', total && 'bg-muted/50')}>
      <td className={cn('py-2.5 px-3 text-sm', total || highlight ? 'font-bold text-foreground' : 'text-muted-foreground')} style={{ paddingLeft: 12 + indent * 20 }}>{label}</td>
      <td className={cn('py-2.5 px-3 text-right font-mono text-sm', total || highlight ? 'font-bold' : '')}>
        {total ? '' : (value >= 0 ? '' : '(')}
        <span className={cn(total ? (isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400') : 'text-foreground')}>
          {total ? '' : fmtBRL(Math.abs(value))}
          {total && fmtBRL(value)}
        </span>
        {total ? '' : (value < 0 ? ')' : '')}
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
}

export function FluxoCaixaDashboard({ onChangeBrand }: FluxoCaixaDashboardProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [redisWarning, setRedisWarning] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Carrega dados do Redis ou usa exemplo como fallback
  const [savedFileName, setSavedFileName] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);

        // Carrega o texto bruto do Redis (chave fluxo_caixa_raw_v2)
        const raw = await loadFluxoCaixaRaw();

        if (raw?.rawText) {
          console.log('✅ Balancete carregado do Redis — re-parseando...');
          const parsed = parseBalancete(raw.rawText);
          if (Object.keys(parsed.accounts).length >= 10) {
            setData(parsed);
            setSavedFileName(raw.fileName);
            setActiveTab('overview');
            return; // sucesso — sai sem usar o exemplo
          }
        }

        // Nenhum dado no Redis: usa exemplos locais
        console.log('📄 Nenhum balancete no Redis — usando dados de exemplo');
        const parsed = parseBalancete(BALANCETE_EXEMPLO);
        if (Object.keys(parsed.accounts).length >= 10) {
          setData(parsed);
          setActiveTab('overview');
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        try {
          const parsed = parseBalancete(BALANCETE_EXEMPLO);
          if (Object.keys(parsed.accounts).length >= 10) {
            setData(parsed);
            setActiveTab('overview');
          }
        } catch (parseErr) {
          console.error('Erro ao carregar balancete de exemplo:', parseErr);
        }
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

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

        // Persiste o TEXTO BRUTO no Redis — re-parse automático em futuras sessões
        const saved = await saveFluxoCaixaData(text, file.name);
        if (saved) {
          console.log('✅ Balancete salvo no Redis com sucesso:', file.name);
          setRedisWarning(null);
        } else {
          console.warn('⚠️ Não foi possível salvar no Redis, mas os dados estão em memória');
          setRedisWarning('Os dados foram carregados na sessão, mas não foi possível salvar no banco de dados (Redis). Ao recarregar a página os dados serão perdidos. Verifique se as variáveis KV_REST_API_URL e KV_REST_API_TOKEN estão configuradas na Vercel.');
        }

        setSavedFileName(file.name);
        setData(parsed);
        setActiveTab('overview');
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    };
    reader.readAsText(file, 'latin1');
  }, []);

  const TABS = [
    { id: 'overview', label: 'Visão Geral', icon: <BarChart3 className="w-4 h-4" />, requiresData: true },
    { id: 'ativo', label: 'Ativo', icon: <Package className="w-4 h-4" />, requiresData: true },
    { id: 'passivo', label: 'Passivo + PL', icon: <Building2 className="w-4 h-4" />, requiresData: true },
    { id: 'resultado', label: 'Resultado', icon: <TrendingUp className="w-4 h-4" />, requiresData: true },
    { id: 'caixa', label: 'Fluxo de Caixa', icon: <DollarSign className="w-4 h-4" />, requiresData: true },
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
                {savedFileName ? `📂 ${savedFileName}` : 'Fluxo de Caixa & Indicadores'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3" />
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
              {activeTab === 'ativo' && <AtivoTab data={data} SectionTitle={SectionTitle} TableRow2={TableRow2} />}
              {activeTab === 'passivo' && <PassivoTab data={data} SectionTitle={SectionTitle} TableRow2={TableRow2} />}
              {activeTab === 'resultado' && <ResultadoTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} />}
              {activeTab === 'caixa' && <CaixaTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} DFCRow={DFCRow} KPI={KPI} />}
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

function OverviewTab({ data, fmtBRL, KPI, BarGauge, SectionTitle }: any) {
  const d = data;
  const varAtivo = d.ativo.total.atu - d.ativo.total.ant;
  const varCaixa = d.disponib.atu - d.disponib.ant;
  const varEstoque = d.estoques.atu - d.estoques.ant;
  const varPass = d.passivo.circ.atu - d.passivo.circ.ant;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <KPI label="Total do Ativo" value={fmtBRL(d.ativo.total.atu, true)} sub={`Ant: ${fmtBRL(d.ativo.total.ant, true)} | Var: ${fmtBRL(varAtivo, true)}`} color="emerald" icon="📊" />
        <KPI label="Disponibilidades" value={fmtBRL(d.disponib.atu, true)} sub={`Variação: ${varCaixa >= 0 ? '+' : ''}${fmtBRL(varCaixa, true)}`} color={varCaixa >= 0 ? "emerald" : "red"} icon="💵" />
        <KPI label="Estoques" value={fmtBRL(d.estoques.atu, true)} sub={`Variação: ${fmtBRL(varEstoque, true)}`} color={varEstoque <= 0 ? "amber" : "red"} icon="🚗" />
        <KPI label="Pass. Circulante" value={fmtBRL(d.passivo.circ.atu, true)} sub={`Variação: ${fmtBRL(varPass, true)}`} color={varPass <= 0 ? "emerald" : "red"} icon="🏦" />
        <KPI label="Patrimônio Líquido" value={fmtBRL(d.PL.atu, true)} sub="Sem variação no período" color="violet" icon="💼" />
        <KPI label="Fluxo de Caixa Total" value={fmtBRL(d.dfc.fluxoTotal, true)} sub={`Var. real: ${fmtBRL(d.dfc.varCaixaReal, true)}`} color={d.dfc.fluxoTotal >= 0 ? "emerald" : "red"} icon="💰" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <Card>
          <CardContent className="pt-6">
            <SectionTitle icon="📦">Composição do Ativo</SectionTitle>
            <BarGauge label="Ativo Circulante" value={d.ativo.circ.atu} max={d.ativo.total.atu} color="emerald" />
            <BarGauge label="  ↳ Estoques VW (1.1.2)" value={d.estoques.atu} max={d.ativo.total.atu} color="violet" />
            <BarGauge label="  ↳ Estoques Audi (1.1.7.02)" value={d.estAudi.atu} max={d.ativo.total.atu} color="violet" />
            <BarGauge label="  ↳ Créditos" value={d.creditos.atu} max={d.ativo.total.atu} color="amber" />
            <BarGauge label="  ↳ Disponibilidades" value={d.disponib.atu} max={d.ativo.total.atu} color="emerald" />
            <BarGauge label="Ativo Não Circulante" value={d.ativo.naoCirc.atu} max={d.ativo.total.atu} color="red" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <SectionTitle icon="🏦">Composição do Passivo</SectionTitle>
            <BarGauge label="Pass. Circulante" value={d.passivo.circ.atu} max={d.ativo.total.atu} color="red" />
            <BarGauge label="  ↳ Empréstimos CP" value={d.emprestCP.atu} max={d.ativo.total.atu} color="red" />
            <BarGauge label="  ↳ Fornecedores" value={d.fornecTotal.atu} max={d.ativo.total.atu} color="red" />
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

function AtivoTab({ data, SectionTitle, TableRow2 }: any) {
  const d = data;
  return (
    <div>
      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon="📦">Detalhamento do Ativo</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted/50"><tr>
                <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Conta</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Saldo Anterior</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Saldo Atual</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Var %</th>
              </tr></thead>
            <tbody>
              <TableRow2 label="ATIVO CIRCULANTE" ant={d.ativo.circ.ant} atu={d.ativo.circ.atu} highlight />
              <TableRow2 label="Disponibilidades" ant={d.disponib.ant} atu={d.disponib.atu} indent={1} />
              <TableRow2 label="Caixa Geral" ant={d.caixaGeral.ant} atu={d.caixaGeral.atu} indent={2} />
              <TableRow2 label="Bancos Conta Movimento" ant={d.bancos.ant} atu={d.bancos.atu} indent={2} />
              <TableRow2 label="Aplicações de Liquidez Imediata" ant={d.aplicLiq.ant} atu={d.aplicLiq.atu} indent={2} />
              <TableRow2 label="Hold Back" ant={d.holdBack.ant} atu={d.holdBack.atu} indent={2} />
              <TableRow2 label="Estoques VW (1.1.2)" ant={d.estoques.ant} atu={d.estoques.atu} highlight indent={1} />
              <TableRow2 label="Veículos Novos" ant={d.estVeicNovos.ant} atu={d.estVeicNovos.atu} indent={2} />
              <TableRow2 label="Veículos Usados" ant={d.estVeicUsados.ant} atu={d.estVeicUsados.atu} indent={2} />
              <TableRow2 label="Peças" ant={d.estPecas.ant} atu={d.estPecas.atu} indent={2} />
              <TableRow2 label="Estoques Audi (1.1.7.02)" ant={d.estAudi.ant} atu={d.estAudi.atu} highlight indent={1} />
              <TableRow2 label="Veículos Novos" ant={d.estAudiVeicNovos?.ant ?? 0} atu={d.estAudiVeicNovos?.atu ?? 0} indent={2} />
              <TableRow2 label="Veículos Usados" ant={d.estAudiVeicUsados?.ant ?? 0} atu={d.estAudiVeicUsados?.atu ?? 0} indent={2} />
              <TableRow2 label="Peças" ant={d.estAudiPecas?.ant ?? 0} atu={d.estAudiPecas?.atu ?? 0} indent={2} />
              <TableRow2 label="Créditos de Vendas" ant={d.creditos.ant} atu={d.creditos.atu} highlight indent={1} />
              <TableRow2 label="Contas Correntes" ant={d.contasCorr.ant} atu={d.contasCorr.atu} indent={1} />
              <TableRow2 label="Valores Diversos" ant={d.valDiversos.ant} atu={d.valDiversos.atu} indent={1} />
              <TableRow2 label="Despesas Antecipadas (1.1.6)" ant={d.despAntec.ant} atu={d.despAntec.atu} highlight indent={1} />
              <TableRow2 label="  ↳ Encargos Financeiros" ant={d.despAntecEnc.ant} atu={d.despAntecEnc.atu} indent={2} />
              <TableRow2 label="  ↳ Gastos Operacionais" ant={d.despAntecGast.ant} atu={d.despAntecGast.atu} indent={2} />
              <TableRow2 label="ATIVO NÃO CIRCULANTE" ant={d.ativo.naoCirc.ant} atu={d.ativo.naoCirc.atu} highlight />
              <TableRow2 label="Realizável a Longo Prazo" ant={d.realizLP.ant} atu={d.realizLP.atu} indent={1} />
              <TableRow2 label="Investimentos" ant={d.investimentos.ant} atu={d.investimentos.atu} indent={1} />
              <TableRow2 label="Imobilizado" ant={d.imobiliz.ant} atu={d.imobiliz.atu} indent={1} />
              <TableRow2 label="Intangível (1.5.7)" ant={d.intangivel.ant} atu={d.intangivel.atu} indent={1} />
              <TableRow2 label="TOTAL DO ATIVO" ant={d.ativo.total.ant} atu={d.ativo.total.atu} highlight />
            </tbody>
          </table>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PassivoTab({ data, SectionTitle, TableRow2 }: any) {
  const d = data;
  return (
    <div>
      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon="🏦">Detalhamento do Passivo e PL</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted/50"><tr>
                <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Conta</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Saldo Anterior</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Saldo Atual</th>
                <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Var %</th>
              </tr></thead>
            <tbody>
              <TableRow2 label="PASSIVO CIRCULANTE" ant={d.passivo.circ.ant} atu={d.passivo.circ.atu} highlight />
              <TableRow2 label="Empréstimos e Floor Plan (CP)" ant={d.emprestCP.ant} atu={d.emprestCP.atu} indent={1} />
              <TableRow2 label=" Trabalhistas" ant={d.obrigTrab.ant} atu={d.obrigTrab.atu} indent={1} />
              <TableRow2 label="Obrigações Tributárias" ant={d.obrigTrib.ant} atu={d.obrigTrib.atu} indent={1} />
              <TableRow2 label="Contas a Pagar" ant={d.contasPagar.ant} atu={d.contasPagar.atu} indent={1} />
              <TableRow2 label="Fornecedores VW" ant={d.fornecVW.ant} atu={d.fornecVW.atu} indent={1} />
              <TableRow2 label="Fornecedores Audi" ant={d.fornecAudi.ant} atu={d.fornecAudi.atu} indent={1} />
              <TableRow2 label="PASSIVO NÃO CIRCULANTE" ant={d.passivo.naoCirc.ant} atu={d.passivo.naoCirc.atu} highlight />
              <TableRow2 label="PATRIMÔNIO LÍQUIDO" ant={d.PL.ant} atu={d.PL.atu} highlight />
              <TableRow2 label="Capital Social" ant={d.capitalSocial.ant} atu={d.capitalSocial.atu} indent={1} />
              <TableRow2 label="TOTAL PASSIVO + PL" ant={d.ativo.total.ant} atu={d.ativo.total.atu} highlight />
            </tbody>
          </table>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultadoTab({ data, fmtBRL, SectionTitle }: any) {
  const d = data;
  const recBruta = d.receitas.bruta.atu;
  const impostosV = d.receitas.impostosVendas.per;
  const devolucoes = d.receitas.devolucoes.per;
  const recLiq = d.receitas.liq.per;
  const CMV = d.custos.CMV.per;
  const lucBruto = recLiq - CMV;
  const despFinanc = d.custos.despFinanc_per;
  const deprec = d.custos.deprec_per;

  const rows = [
    { label: 'RECEITA BRUTA DE VENDAS', value: recBruta, type: 'header' },
    { label: '  (–) Impostos sobre Vendas', value: -impostosV, type: 'sub' },
    { label: '  (–) Devoluções de Vendas', value: -devolucoes, type: 'sub' },
    { label: 'RECEITA LÍQUIDA', value: recLiq, type: 'subtotal' },
    { label: '  (–) Custo das Mercadorias Vendidas', value: -CMV, type: 'sub' },
    { label: 'LUCRO (PREJUÍZO) BRUTO', value: lucBruto, type: 'subtotal' },
    { label: '  (–) Despesas Financeiras', value: -despFinanc, type: 'sub' },
    { label: '  (–) Depreciações/Amortizações', value: -deprec, type: 'sub' },
    { label: '  (+) Rendas Operacionais', value: d.receitas.rendOper.per, type: 'sub' },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Receita Bruta do Período</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(recBruta, true)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Receita Líquida</div>
            <div className={cn('text-2xl font-bold', recLiq >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{fmtBRL(recLiq, true)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Lucro/Prej. Bruto</div>
            <div className={cn('text-2xl font-bold', lucBruto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{fmtBRL(lucBruto, true)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Devoluções</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{fmtBRL(devolucoes, true)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon="📈">DRE do Período (Parcial)</SectionTitle>
          <table className="w-full border-collapse">
            <tbody>
              {rows.map((r, i) => {
                const isPos = r.value >= 0;
                const isHeader = r.type === 'header';
                const isSubtotal = r.type === 'subtotal';
                const barPct = Math.min(100, (Math.abs(r.value) / (recBruta || 1)) * 100);
                return (
                  <tr key={i} className={cn('border-b border-border', isHeader && 'bg-emerald-50/50 dark:bg-emerald-950/20', isSubtotal && 'bg-muted/30')}>
                    <td className={cn('py-3 px-4 text-sm w-2/5', isHeader || isSubtotal ? 'font-bold text-foreground' : 'text-muted-foreground')}>{r.label}</td>
                    <td className="py-3 px-4 w-1/3">
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', isPos ? 'bg-emerald-500' : 'bg-red-500')} style={{ width: `${barPct}%` }} />
                      </div>
                    </td>
                    <td className={cn('py-3 px-4 text-right text-sm font-mono w-1/4', isHeader || isSubtotal ? 'font-bold' : '', isPos ? (isHeader || isSubtotal ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/80') : 'text-red-600 dark:text-red-400')}>
                      {r.value >= 0 ? fmtBRL(r.value) : `(${fmtBRL(Math.abs(r.value))})`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted-foreground/70 leading-relaxed">
            * DRE parcial calculada com base nas variações do balancete (débitos/créditos do período). Para encerramento definitivo, consultar as demonstrações completas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CaixaTab({ data, fmtBRL, SectionTitle, DFCRow, KPI }: any) {
  const d = data.dfc;
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI label="Fluxo Operacional" value={fmtBRL(d.fluxoOper, true)} sub="Principal fonte de caixa" color={d.fluxoOper >= 0 ? 'emerald' : 'red'} icon="⚙️" />
        <KPI label="Fluxo de Investimento" value={fmtBRL(d.fluxoInvest, true)} sub="Imobilizado + Intangível + Créditos LP" color={d.fluxoInvest >= 0 ? 'emerald' : 'amber'} icon="🏗️" />
        <KPI label="Fluxo de Financiamento" value={fmtBRL(d.fluxoFinanc, true)} sub={`Floor Plan ${d.dEmprestCP >= 0 ? '+' : ''}${fmtBRL(d.dEmprestCP, true)} | Arrend. ${d.dArrendLP >= 0 ? '+' : ''}${fmtBRL(d.dArrendLP, true)}`} color={d.fluxoFinanc >= 0 ? 'amber' : 'red'} icon="🏛️" />
        <KPI label="Var. Total de Caixa" value={fmtBRL(d.fluxoTotal, true)} sub={`Var. real no balanço: ${fmtBRL(d.varCaixaReal, true)}`} color={d.fluxoTotal >= 0 ? 'emerald' : 'red'} icon="💰" />
      </div>

      <Card>
        <CardContent className="pt-6">
        <SectionTitle icon="💰">Demonstração do Fluxo de Caixa — Método Indireto</SectionTitle>
        <table className="dfc-table w-full border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Descrição</th>
              <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Valor (R$)</th>
            </tr>
          </thead>
          <tbody>
            <DFCRow label="ATIVIDADES OPERACIONAIS" value={0} highlight />
            <DFCRow label="(+) Depreciações e Amortizações (não caixa)" value={d.deprec} indent={1} />
            <DFCRow label={`${d.ajusteEstoque >= 0 ? '(+)' : '(–)'} Variação de Estoques VW + Audi ${d.dEstoque < 0 ? '— redução (fonte de caixa)' : '— aumento (uso de caixa)'} (1.1.2 + 1.1.7.02)`} value={d.ajusteEstoque} indent={1} />
            <DFCRow label={`    ↳ Estoques VW (1.1.2): ${fmtBRL(data.estoques.ant, true)} → ${fmtBRL(data.estoques.atu, true)}`} value={-(data.estoques.atu - data.estoques.ant)} indent={2} />
            <DFCRow label={`    ↳ Estoques Audi (1.1.7.02): ${fmtBRL(data.estAudi.ant, true)} → ${fmtBRL(data.estAudi.atu, true)}`} value={-(data.estAudi.atu - data.estAudi.ant)} indent={2} />
            <DFCRow label={`${d.ajusteCred >= 0 ? '(+)' : '(–)'} Variação de Créditos ${d.dCred < 0 ? '— redução (fonte de caixa)' : '— aumento (uso de caixa)'}`} value={d.ajusteCred} indent={1} />
            <DFCRow label={`${d.ajusteDespAntec >= 0 ? '(+)' : '(–)'} Variação de Despesas Antecipadas (1.1.6) ${d.dDespAntec > 0 ? '— aumento (uso de caixa)' : '— redução (fonte de caixa)'}`} value={d.ajusteDespAntec} indent={1} />
            <DFCRow label={`${d.ajusteFornec >= 0 ? '(+)' : '(–)'} Variação de Fornecedores ${d.dFornec < 0 ? '— redução (uso de caixa)' : '— aumento (fonte)'}`} value={d.ajusteFornec} indent={1} />
            <DFCRow label={`${d.ajusteTrib >= 0 ? '(+)' : '(–)'} Variação de Obrigações Tributárias`} value={d.ajusteTrib} indent={1} />
            <DFCRow label={`${d.ajusteTrab >= 0 ? '(+)' : '(–)'} Variação de Obrigações Trabalhistas`} value={d.ajusteTrab} indent={1} />
            <DFCRow label={`${d.ajusteContasPag >= 0 ? '(+)' : '(–)'} Variação de Contas a Pagar`} value={d.ajusteContasPag} indent={1} />
            <DFCRow label="CAIXA LÍQUIDO DAS ATIVIDADES OPERACIONAIS" value={d.fluxoOper} total highlight />

            <DFCRow label="ATIVIDADES DE INVESTIMENTO" value={0} highlight />
            <DFCRow label={`${-(data.imobiliz.atu - data.imobiliz.ant) >= 0 ? '(+)' : '(–)'} Variação Líquida do Imobilizado 1.5.5 (inclui depreciação acumulada)`} value={-(data.imobiliz.atu - data.imobiliz.ant)} indent={1} />
            <DFCRow label={`${-d.dIntangivel >= 0 ? '(+)' : '(–)'} Variação Líquida do Intangível 1.5.7 (inclui amortização acumulada)`} value={-d.dIntangivel} indent={1} />
            <DFCRow label={`${-d.dRealizLPCred >= 0 ? '(+)' : '(–)'} Variação Créditos c/ Ligadas LP 1.5.1.01.52`} value={-d.dRealizLPCred} indent={1} />
            <DFCRow label="CAIXA LÍQUIDO DAS ATIVIDADES DE INVESTIMENTO" value={d.fluxoInvest} total highlight />

            <DFCRow label="ATIVIDADES DE FINANCIAMENTO" value={0} highlight />
            {(d.emprestCPAnt > 0 || d.emprestCPAtu > 0) && (
              <DFCRow label={`${d.dEmprestCP >= 0 ? '(+) Captação' : '(–) Amortização'} Empréstimos CP / Floor Plan  (${fmtBRL(d.emprestCPAnt, true)} → ${fmtBRL(d.emprestCPAtu, true)})`} value={d.dEmprestCP} indent={1} />
            )}
            {(d.emprestLPAnt > 0 || d.emprestLPAtu > 0) && (
              <DFCRow label={`${d.dEmprestLP >= 0 ? '(+) Captação' : '(–) Amortização'} Empréstimos Bancários LP  (${fmtBRL(d.emprestLPAnt, true)} → ${fmtBRL(d.emprestLPAtu, true)})`} value={d.dEmprestLP} indent={1} />
            )}
            {(d.pessoasLigAnt > 0 || d.pessoasLigAtu > 0) && (
              <DFCRow label={`${d.dPessoasLig >= 0 ? '(+) Aporte' : '(–) Retirada'} Sócios / Pessoas Ligadas  (${fmtBRL(d.pessoasLigAnt, true)} → ${fmtBRL(d.pessoasLigAtu, true)})`} value={d.dPessoasLig} indent={1} />
            )}
            {(d.debitosLigAnt > 0 || d.debitosLigAtu > 0) && (
              <DFCRow label={`${d.dDebitosLig >= 0 ? '(+) Captação' : '(–) Liquidação'} Débitos com Ligadas LP  (${fmtBRL(d.debitosLigAnt, true)} → ${fmtBRL(d.debitosLigAtu, true)})`} value={d.dDebitosLig} indent={1} />
            )}
            {(d.arrendLPAnt > 0 || d.arrendLPAtu > 0) && (
              <DFCRow label={`${d.dArrendLP >= 0 ? '(+) Novos Arrendamentos LP' : '(–) Amortização Arrendamentos LP'}  (${fmtBRL(d.arrendLPAnt, true)} → ${fmtBRL(d.arrendLPAtu, true)})`} value={d.dArrendLP} indent={1} />
            )}
            <DFCRow label="CAIXA LÍQUIDO DAS ATIVIDADES DE FINANCIAMENTO" value={d.fluxoFinanc} total highlight />
          </tbody>
          <tfoot>
            <tr className="bg-emerald-50/50 dark:bg-emerald-950/20 border-t-2 border-emerald-500/30">
              <td className="py-3.5 px-3 text-sm font-bold text-foreground">VARIAÇÃO TOTAL DE CAIXA NO PERÍODO</td>
              <td className={cn('py-3.5 px-3 text-right font-mono text-base font-bold', d.fluxoTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{fmtBRL(d.fluxoTotal)}</td>
            </tr>
            <tr className="bg-muted/30">
              <td className="py-2.5 px-3 text-sm text-muted-foreground">Saldo de Caixa — Período Anterior</td>
              <td className="py-2.5 px-3 text-right font-mono text-sm text-muted-foreground">{fmtBRL(data.disponib.ant)}</td>
            </tr>
            <tr className="bg-muted/30">
              <td className="py-2.5 px-3 text-sm text-muted-foreground">Saldo de Caixa — Período Atual</td>
              <td className="py-2.5 px-3 text-right font-mono text-sm font-semibold text-foreground">{fmtBRL(data.disponib.atu)}</td>
            </tr>
            <tr className="bg-violet-50/50 dark:bg-violet-950/20 border-t border-violet-500/30">
              <td className="py-3 px-3 text-sm font-semibold text-foreground/80">Variação Real de Caixa (conferência com balanço)</td>
              <td className={cn('py-3 px-3 text-right font-mono text-sm font-bold', d.varCaixaReal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{fmtBRL(d.varCaixaReal)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-4 text-xs text-muted-foreground/70 leading-relaxed">
          * DFC pelo método indireto. Correções aplicadas: (1) Intangível 1.5.7 incluído no investimento; (2) Realizável LP limitado aos créditos com ligadas 1.5.1.01.52; (3) Receitas Diferidas 2.2.2 excluída do financiamento — contém ICMS ST Diferido (não-caixa); (4) Arrendamentos LP mapeados em 2.2.1.15; (5) Estoque Audi (1.1.7.02) consolidado no ajuste operacional de estoques.
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
