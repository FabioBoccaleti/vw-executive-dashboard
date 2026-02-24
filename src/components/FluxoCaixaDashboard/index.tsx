import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, X, TrendingUp, TrendingDown, DollarSign, Package, Building2, BarChart3, Target, LogOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { BALANCETE_EXEMPLO } from "./balanceteExemplo";
import { loadFluxoCaixaData, saveFluxoCaixaData } from "./fluxoCaixaStorage";

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
  const fileRef = useRef<HTMLInputElement>(null);

  // Carrega dados do Redis ou usa exemplo como fallback
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        
        // Tenta carregar do Redis primeiro
        const savedData = await loadFluxoCaixaData();
        
        if (savedData && Object.keys(savedData.accounts || {}).length >= 10) {
          console.log('✅ Dados carregados do Redis');
          setData(savedData);
          setActiveTab('overview');
        } else {
          // Se não houver dados salvos, usa dados de exemplo
          console.log('📄 Usando dados de exemplo');
          const parsed = parseBalancete(BALANCETE_EXEMPLO);
          if (Object.keys(parsed.accounts).length >= 10) {
            setData(parsed);
            setActiveTab('overview');
            // Salva os dados de exemplo no Redis para próxima vez
            await saveFluxoCaixaData(parsed);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        // Fallback para dados de exemplo em caso de erro
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
        
        // Salva os dados processados no Redis
        const saved = await saveFluxoCaixaData(parsed);
        if (saved) {
          console.log('✅ Dados salvos no Redis com sucesso');
        } else {
          console.warn('⚠️ Não foi possível salvar no Redis, mas os dados estão em memória');
        }
        
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
    { id: 'overview', label: 'Visão Geral', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'ativo', label: 'Ativo', icon: <Package className="w-4 h-4" /> },
    { id: 'passivo', label: 'Passivo + PL', icon: <Building2 className="w-4 h-4" /> },
    { id: 'resultado', label: 'Resultado', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'caixa', label: 'Fluxo de Caixa', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'indicadores', label: 'Indicadores', icon: <Target className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-[#16a34a] text-white shadow-lg fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            {data && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-white hover:bg-green-700"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            )}
            <div>
              <h1 className="text-xl font-bold">BalanceteAI - Análise Financeira</h1>
              <p className="text-sm text-green-100">Fluxo de Caixa & Indicadores</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-green-700 hidden sm:flex"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Novo Arquivo
            </Button>
            {onChangeBrand && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-green-700"
                onClick={onChangeBrand}
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Voltar ao Menu</span>
              </Button>
            )}
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
      {data && (
        <>
          <aside
            className={cn(
              'fixed left-0 top-[60px] bottom-0 w-64 bg-slate-800 text-white z-20 transition-transform duration-300',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            )}
          >
            <nav className="p-4 space-y-1">
              {TABS.map((tab) => (
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

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left"
              >
                <Upload className="w-5 h-5" />
                <span className="text-sm font-medium">Novo Arquivo</span>
              </button>
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
      )}

      {/* Main Content */}
      <main className={cn('pt-[60px] min-h-screen', data && 'lg:ml-64')}>
        <div className="p-6 max-w-7xl mx-auto">
          {loading && !data ? (
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
              {activeTab === 'overview' && <OverviewTab data={data} fmtBRL={fmtBRL} KPI={KPI} BarGauge={BarGauge} SectionTitle={SectionTitle} />}
              {activeTab === 'ativo' && <AtivoTab data={data} SectionTitle={SectionTitle} TableRow2={TableRow2} />}
              {activeTab === 'passivo' && <PassivoTab data={data} SectionTitle={SectionTitle} TableRow2={TableRow2} />}
              {activeTab === 'resultado' && <ResultadoTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} />}
              {activeTab === 'caixa' && <CaixaTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} DFCRow={DFCRow} KPI={KPI} />}
              {activeTab === 'indicadores' && <IndicadoresTab data={data} fmtBRL={fmtBRL} SectionTitle={SectionTitle} Badge={StatusBadge} />}
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
            <BarGauge label="  ↳ Estoques" value={d.estoques.atu} max={d.ativo.total.atu} color="violet" />
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
              <TableRow2 label="Estoques" ant={d.estoques.ant} atu={d.estoques.atu} highlight indent={1} />
              <TableRow2 label="Veículos Novos" ant={d.estVeicNovos.ant} atu={d.estVeicNovos.atu} indent={2} />
              <TableRow2 label="Veículos Usados" ant={d.estVeicUsados.ant} atu={d.estVeicUsados.atu} indent={2} />
              <TableRow2 label="Peças" ant={d.estPecas.ant} atu={d.estPecas.atu} indent={2} />
              <TableRow2 label="Créditos de Vendas" ant={d.creditos.ant} atu={d.creditos.atu} highlight indent={1} />
              <TableRow2 label="Contas Correntes" ant={d.contasCorr.ant} atu={d.contasCorr.atu} indent={1} />
              <TableRow2 label="Valores Diversos" ant={d.valDiversos.ant} atu={d.valDiversos.atu} indent={1} />
              <TableRow2 label="ATIVO NÃO CIRCULANTE" ant={d.ativo.naoCirc.ant} atu={d.ativo.naoCirc.atu} highlight />
              <TableRow2 label="Realizável a Longo Prazo" ant={d.realizLP.ant} atu={d.realizLP.atu} indent={1} />
              <TableRow2 label="Investimentos" ant={d.investimentos.ant} atu={d.investimentos.atu} indent={1} />
              <TableRow2 label="Imobilizado" ant={d.imobiliz.ant} atu={d.imobiliz.atu} indent={1} />
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
        <KPI label="Fluxo de Investimento" value={fmtBRL(d.fluxoInvest, true)} sub="Imobilizado (depreciação/vendas)" color={d.fluxoInvest >= 0 ? 'emerald' : 'amber'} icon="🏗️" />
        <KPI label="Fluxo de Financiamento" value={fmtBRL(d.fluxoFinanc, true)} sub="Passivo não circulante" color={d.fluxoFinanc >= 0 ? 'amber' : 'red'} icon="🏛️" />
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
            <DFCRow label={`${d.ajusteEstoque >= 0 ? '(+)' : '(–)'} Variação de Estoques ${d.dEstoque < 0 ? '— redução (fonte de caixa)' : '— aumento (uso de caixa)'}`} value={d.ajusteEstoque} indent={1} />
            <DFCRow label={`${d.ajusteCred >= 0 ? '(+)' : '(–)'} Variação de Créditos ${d.dCred < 0 ? '— redução (fonte de caixa)' : '— aumento (uso de caixa)'}`} value={d.ajusteCred} indent={1} />
            <DFCRow label={`${d.ajusteFornec >= 0 ? '(+)' : '(–)'} Variação de Fornecedores ${d.dFornec < 0 ? '— redução (uso de caixa)' : '— aumento (fonte)'}`} value={d.ajusteFornec} indent={1} />
            <DFCRow label={`${d.ajusteTrib >= 0 ? '(+)' : '(–)'} Variação de Obrigações Tributárias`} value={d.ajusteTrib} indent={1} />
            <DFCRow label={`${d.ajusteTrab >= 0 ? '(+)' : '(–)'} Variação de Obrigações Trabalhistas`} value={d.ajusteTrab} indent={1} />
            <DFCRow label={`${d.ajusteContasPag >= 0 ? '(+)' : '(–)'} Variação de Contas a Pagar`} value={d.ajusteContasPag} indent={1} />
            <DFCRow label="CAIXA LÍQUIDO DAS ATIVIDADES OPERACIONAIS" value={d.fluxoOper} total highlight />

            <DFCRow label="ATIVIDADES DE INVESTIMENTO" value={0} highlight />
            <DFCRow label="Variação Líquida do Imobilizado (depreciação / venda de ativos)" value={d.fluxoInvest} indent={1} />
            <DFCRow label="CAIXA LÍQUIDO DAS ATIVIDADES DE INVESTIMENTO" value={d.fluxoInvest} total highlight />

            <DFCRow label="ATIVIDADES DE FINANCIAMENTO" value={0} highlight />
            <DFCRow label="Variação do Passivo Não Circulante (captações / amortizações LP)" value={d.fluxoFinanc} indent={1} />
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
          * DFC elaborada pelo método indireto com base nas variações patrimoniais do balancete. Ajustes de resultado (lucro/prejuízo do período) não foram incluídos por falta de encerramento contábil no arquivo. A variação real de caixa é calculada diretamente das disponibilidades do balanço.
        </p>
        </CardContent>
      </Card>
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
