import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
const KPI = ({ label, value, sub, color = '#06d6a0', icon }: any) => (
  <div style={{
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 6,
    borderLeft: `3px solid ${color}`, backdropFilter: 'blur(8px)'
  }}>
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.45)', fontFamily: 'DM Sans, sans-serif' }}>
      {icon && <span style={{ marginRight: 6 }}>{icon}</span>}{label}
    </div>
    <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', fontFamily: 'Syne, sans-serif', letterSpacing: -0.5 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'DM Sans, sans-serif' }}>{sub}</div>}
  </div>
);

const TableRow2 = ({ label, ant, atu, highlight, indent = 0 }: any) => {
  const { diff, pct } = fmtVar(ant, atu);
  return (
    <tr style={{ background: highlight ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
      <td style={{ padding: '9px 12px', paddingLeft: 12 + indent * 16, fontSize: 13, color: highlight ? '#fff' : 'rgba(255,255,255,0.75)', fontWeight: highlight ? 700 : 400, fontFamily: 'DM Sans, sans-serif' }}>{label}</td>
      <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 13, fontFamily: 'DM Mono, monospace', color: 'rgba(255,255,255,0.7)' }}>{fmtBRL(ant)}</td>
      <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 13, fontFamily: 'DM Mono, monospace', color: '#fff', fontWeight: highlight ? 700 : 400 }}>{fmtBRL(atu)}</td>
      <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'DM Mono, monospace', color: diff >= 0 ? '#06d6a0' : '#ef476f' }}>
        {pct !== null ? `${diff >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
      </td>
    </tr>
  );
};

const DFCRow = ({ label, value, indent = 0, highlight, total }: any) => {
  const isPos = value >= 0;
  const color = total ? '#fff' : isPos ? '#06d6a0' : '#ef476f';
  return (
    <tr style={{ background: highlight ? 'rgba(6,214,160,0.06)' : total ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
      <td style={{ padding: '10px 12px', paddingLeft: 12 + indent * 20, fontSize: 13, fontFamily: 'DM Sans, sans-serif', color: total ? '#fff' : 'rgba(255,255,255,0.8)', fontWeight: total || highlight ? 700 : 400 }}>{label}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: total || highlight ? 700 : 400, color }}>
        {total ? '' : (value >= 0 ? '' : '(')}
        {total ? '' : fmtBRL(Math.abs(value))}
        {total ? '' : (value < 0 ? ')' : '')}
        {total && <span style={{ color: isPos ? '#06d6a0' : '#ef476f', fontSize: 16 }}>{fmtBRL(value)}</span>}
      </td>
    </tr>
  );
};

const BarGauge = ({ label, value, max, color }: any) => {
  const pct = Math.min(100, (Math.abs(value) / max) * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: 'DM Sans, sans-serif' }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: '#fff' }}>{fmtBRL(value, true)}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 1s cubic-bezier(.4,0,.2,1)' }} />
      </div>
    </div>
  );
};

const SectionTitle = ({ children, icon }: any) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, marginTop: 8 }}>
    {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
    <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.3, margin: 0 }}>{children}</h2>
    <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, rgba(255,255,255,0.15), transparent)', marginLeft: 8 }} />
  </div>
);

const Badge = ({ label, status }: any) => {
  const colors: any = { ok: ['#06d6a0', 'rgba(6,214,160,0.12)'], warn: ['#ffd166', 'rgba(255,209,102,0.12)'], bad: ['#ef476f', 'rgba(239,71,111,0.12)'] };
  const [fg, bg] = colors[status] || colors.ok;
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: bg, color: fg, fontFamily: 'DM Mono, monospace' }}>{label}</span>;
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────────────
interface FluxoCaixaDashboardProps {
  onChangeBrand?: () => void;
}

export function FluxoCaixaDashboard({ onChangeBrand }: FluxoCaixaDashboardProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseBalancete(text);
        if (Object.keys(parsed.accounts).length < 10) throw new Error('Arquivo não reconhecido como balancete válido.');
        setData(parsed);
        setActiveTab('overview');
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    };
    reader.readAsText(file, 'latin1');
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  const TABS = [
    { id: 'overview', label: 'Visão Geral', icon: '📊' },
    { id: 'ativo', label: 'Ativo', icon: '📦' },
    { id: 'passivo', label: 'Passivo + PL', icon: '🏦' },
    { id: 'resultado', label: 'Resultado', icon: '📈' },
    { id: 'caixa', label: 'Fluxo de Caixa', icon: '💰' },
    { id: 'indicadores', label: 'Indicadores', icon: '🎯' },
  ];

  const styles = {
    app: {
      minHeight: '100vh', background: '#0a0e1a',
      backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(6,214,160,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(99,102,241,0.08) 0%, transparent 60%)',
      fontFamily: 'DM Sans, sans-serif', color: '#fff',
    },
    header: {
      padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    content: { maxWidth: 1200, margin: '0 auto', padding: '32px 24px' },
    upload: {
      border: `2px dashed ${dragOver ? '#06d6a0' : 'rgba(255,255,255,0.15)'}`,
      borderRadius: 24, padding: '64px 40px', textAlign: 'center' as const,
      background: dragOver ? 'rgba(6,214,160,0.05)' : 'rgba(255,255,255,0.02)',
      cursor: 'pointer', transition: 'all 0.2s ease',
    },
    tabs: { display: 'flex', gap: 4, marginBottom: 32, overflowX: 'auto' as const, paddingBottom: 4 },
    tab: (active: boolean) => ({
      padding: '10px 20px', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' as const,
      fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', border: 'none',
      background: active ? 'rgba(6,214,160,0.15)' : 'rgba(255,255,255,0.05)',
      color: active ? '#06d6a0' : 'rgba(255,255,255,0.55)',
      transition: 'all 0.15s ease',
    }),
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
    card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24, marginBottom: 24 },
  };

  return (
    <div style={styles.app}>
      {/* Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&family=DM+Mono&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 99px; }
        thead tr { background: rgba(255,255,255,0.05); }
        thead th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.4); font-family: 'DM Sans', sans-serif; font-weight: 600; }
        thead th:not(:first-child) { text-align: right; }
        tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); }
        tbody tr:hover { background: rgba(255,255,255,0.02) !important; }
        .dfc-table tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); }
        .dfc-table tbody tr:hover { background: rgba(255,255,255,0.02) !important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        .upload-btn { background: rgba(6,214,160,0.15); border: 1px solid rgba(6,214,160,0.3); color: #06d6a0; padding: 12px 28px; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
        .upload-btn:hover { background: rgba(6,214,160,0.25); }
      `}</style>

      {/* Header */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #06d6a0, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📒</div>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>BalanceteAI</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>ANÁLISE FINANCEIRA INTELIGENTE</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {data && (
            <button className="upload-btn" onClick={() => { setData(null); setActiveTab('overview'); }}>
              ↑ Novo Arquivo
            </button>
          )}
          {onChangeBrand && (
            <button className="upload-btn" onClick={onChangeBrand}>
              ← Voltar ao Menu
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <main style={styles.content}>
        {!data ? (
          /* ── UPLOAD SCREEN ── */
          <div style={{ maxWidth: 600, margin: '80px auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 40, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 16 }}>
                Análise de Balancete<br />
                <span style={{ background: 'linear-gradient(90deg, #06d6a0, #4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>em segundos</span>
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.7 }}>
                Importe seu arquivo de balancete (.txt) e obtenha análise completa do ativo, passivo, resultado e geração de caixa automaticamente.
              </p>
            </div>

            <div
              style={styles.upload}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".txt,.csv" style={{ display: 'none' }}
                onChange={e => processFile(e.target.files?.[0])} />
              <div style={{ fontSize: 48, marginBottom: 20 }}>📂</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                {dragOver ? 'Solte o arquivo aqui' : 'Arraste seu Balancete'}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 24 }}>
                Formato suportado: arquivo .txt com campos separados por ponto-e-vírgula (;)<br />
                Colunas: Nível; Conta; Descrição; Saldo Anterior; Déb; Créd; Saldo Atual
              </p>
              <button className="upload-btn">Selecionar Arquivo</button>
              {loading && <p style={{ marginTop: 20, color: '#06d6a0', animation: 'pulse 1s infinite' }}>Processando...</p>}
              {error && <p style={{ marginTop: 20, color: '#ef476f', fontSize: 13 }}>⚠️ {error}</p>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 24 }}>
              {['Ativo e Passivo', 'DRE do Período', 'Fluxo de Caixa'].map((f, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{['📊', '📈', '💰'][i]}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'DM Sans, sans-serif' }}>{f}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ── DASHBOARD ── */
          <div className="fade-in">
            {/* Tabs */}
            <div style={styles.tabs}>
              {TABS.map(t => (
                <button key={t.id} style={styles.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Tabs Content */}
            {activeTab === 'overview' && <OverviewTab data={data} fmtBRL={fmtBRL} styles={styles} KPI={KPI} BarGauge={BarGauge} SectionTitle={SectionTitle} />}
            {activeTab === 'ativo' && <AtivoTab data={data} styles={styles} SectionTitle={SectionTitle} TableRow2={TableRow2} />}
            {activeTab === 'passivo' && <PassivoTab data={data} styles={styles} SectionTitle={SectionTitle} TableRow2={TableRow2} />}
            {activeTab === 'resultado' && <ResultadoTab data={data} fmtBRL={fmtBRL} styles={styles} SectionTitle={SectionTitle} />}
            {activeTab === 'caixa' && <CaixaTab data={data} fmtBRL={fmtBRL} styles={styles} SectionTitle={SectionTitle} DFCRow={DFCRow} KPI={KPI} />}
            {activeTab === 'indicadores' && <IndicadoresTab data={data} fmtBRL={fmtBRL} styles={styles} SectionTitle={SectionTitle} Badge={Badge} />}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

function OverviewTab({ data, fmtBRL, styles, KPI, BarGauge, SectionTitle }: any) {
  const d = data;
  const varAtivo = d.ativo.total.atu - d.ativo.total.ant;
  const varCaixa = d.disponib.atu - d.disponib.ant;
  const varEstoque = d.estoques.atu - d.estoques.ant;
  const varPass = d.passivo.circ.atu - d.passivo.circ.ant;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <KPI label="Total do Ativo" value={fmtBRL(d.ativo.total.atu, true)} sub={`Ant: ${fmtBRL(d.ativo.total.ant, true)} | Var: ${fmtBRL(varAtivo, true)}`} color="#06d6a0" icon="📊" />
        <KPI label="Disponibilidades" value={fmtBRL(d.disponib.atu, true)} sub={`Variação: ${varCaixa >= 0 ? '+' : ''}${fmtBRL(varCaixa, true)}`} color={varCaixa >= 0 ? "#06d6a0" : "#ef476f"} icon="💵" />
        <KPI label="Estoques" value={fmtBRL(d.estoques.atu, true)} sub={`Variação: ${fmtBRL(varEstoque, true)}`} color={varEstoque <= 0 ? "#ffd166" : "#ef476f"} icon="🚗" />
        <KPI label="Pass. Circulante" value={fmtBRL(d.passivo.circ.atu, true)} sub={`Variação: ${fmtBRL(varPass, true)}`} color={varPass <= 0 ? "#06d6a0" : "#ef476f"} icon="🏦" />
        <KPI label="Patrimônio Líquido" value={fmtBRL(d.PL.atu, true)} sub="Sem variação no período" color="#4f46e5" icon="💼" />
        <KPI label="Fluxo de Caixa Total" value={fmtBRL(d.dfc.fluxoTotal, true)} sub={`Var. real: ${fmtBRL(d.dfc.varCaixaReal, true)}`} color={d.dfc.fluxoTotal >= 0 ? "#06d6a0" : "#ef476f"} icon="💰" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={styles.card}>
          <SectionTitle icon="📦">Composição do Ativo</SectionTitle>
          <BarGauge label="Ativo Circulante" value={d.ativo.circ.atu} max={d.ativo.total.atu} color="#06d6a0" />
          <BarGauge label="  ↳ Estoques" value={d.estoques.atu} max={d.ativo.total.atu} color="#4f46e5" />
          <BarGauge label="  ↳ Créditos" value={d.creditos.atu} max={d.ativo.total.atu} color="#ffd166" />
          <BarGauge label="  ↳ Disponibilidades" value={d.disponib.atu} max={d.ativo.total.atu} color="#06d6a0" />
          <BarGauge label="Ativo Não Circulante" value={d.ativo.naoCirc.atu} max={d.ativo.total.atu} color="#ef476f" />
        </div>

        <div style={styles.card}>
          <SectionTitle icon="🏦">Composição do Passivo</SectionTitle>
          <BarGauge label="Pass. Circulante" value={d.passivo.circ.atu} max={d.ativo.total.atu} color="#ef476f" />
          <BarGauge label="  ↳ Empréstimos CP" value={d.emprestCP.atu} max={d.ativo.total.atu} color="#c0392b" />
          <BarGauge label="  ↳ Fornecedores" value={d.fornecTotal.atu} max={d.ativo.total.atu} color="#e74c3c" />
          <BarGauge label="Pass. Não Circulante" value={d.passivo.naoCirc.atu} max={d.ativo.total.atu} color="#ffd166" />
          <BarGauge label="Patrimônio Líquido" value={d.PL.atu} max={d.ativo.total.atu} color="#06d6a0" />
        </div>
      </div>

      <div style={styles.card}>
        <SectionTitle icon="⚠️">Pontos de Atenção</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {[
            { tipo: 'bad', icon: '🔴', msg: `Liquidez imediata muito baixa: ${(d.indicadores.liqImediata * 100).toFixed(1)}% do PC coberto por disponibilidades` },
            { tipo: data.indicadores.liqCorrente >= 1 ? 'ok' : 'bad', icon: data.indicadores.liqCorrente >= 1 ? '🟢' : '🔴', msg: `Liquidez corrente: ${d.indicadores.liqCorrente.toFixed(2)}x ${d.indicadores.liqCorrente >= 1 ? '(adequado)' : '(abaixo de 1,0 — atenção)'}` },
            { tipo: 'bad', icon: '🔴', msg: `Alta alavancagem: endividamento total de ${(d.indicadores.endivTotal * 100).toFixed(0)}% sobre o ativo` },
            { tipo: d.estoques.atu < d.estoques.ant ? 'ok' : 'warn', icon: d.estoques.atu < d.estoques.ant ? '🟢' : '🟡', msg: `Estoques ${d.estoques.atu < d.estoques.ant ? 'reduziram — bom giro comercial no período' : 'aumentaram no período'}` },
            { tipo: 'ok', icon: '🟢', msg: `Fluxo de caixa operacional: ${fmtBRL(d.dfc.fluxoOper, true)} — desgiro de estoques e créditos` },
            { tipo: d.emprestCP.atu < d.emprestCP.ant ? 'ok' : 'warn', icon: d.emprestCP.atu < d.emprestCP.ant ? '🟢' : '🟡', msg: `Empréstimos CP ${d.emprestCP.atu < d.emprestCP.ant ? 'reduziram — amortização no período' : 'aumentaram no período'}` },
          ].map((a, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 14, fontSize: 13, color: 'rgba(255,255,255,0.75)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5, display: 'flex', gap: 10 }}>
              <span>{a.icon}</span><span>{a.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AtivoTab({ data, styles, SectionTitle, TableRow2 }: any) {
  const d = data;
  return (
    <div>
      <div style={styles.card}>
        <SectionTitle icon="📦">Detalhamento do Ativo</SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)' }}>Conta</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)' }}>Saldo Anterior</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)' }}>Saldo Atual</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)' }}>Var %</th>
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
      </div>
    </div>
  );
}

function PassivoTab({ data, styles, SectionTitle, TableRow2 }: any) {
  const d = data;
  return (
    <div>
      <div style={styles.card}>
        <SectionTitle icon="🏦">Detalhamento do Passivo e PL</SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)' }}>Conta</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)' }}>Saldo Anterior</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)' }}>Saldo Atual</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)' }}>Var %</th>
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
      </div>
    </div>
  );
}

function ResultadoTab({ data, fmtBRL, styles, SectionTitle }: any) {
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ ...styles.card, margin: 0 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Receita Bruta do Período</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 800, color: '#06d6a0' }}>{fmtBRL(recBruta, true)}</div>
        </div>
        <div style={{ ...styles.card, margin: 0 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Receita Líquida</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 800, color: recLiq >= 0 ? '#06d6a0' : '#ef476f' }}>{fmtBRL(recLiq, true)}</div>
        </div>
        <div style={{ ...styles.card, margin: 0 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Lucro/Prej. Bruto</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 800, color: lucBruto >= 0 ? '#06d6a0' : '#ef476f' }}>{fmtBRL(lucBruto, true)}</div>
        </div>
        <div style={{ ...styles.card, margin: 0 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Devoluções</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 800, color: '#ef476f' }}>{fmtBRL(devolucoes, true)}</div>
        </div>
      </div>

      <div style={styles.card}>
        <SectionTitle icon="📈">DRE do Período (Parcial)</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {rows.map((r, i) => {
              const isPos = r.value >= 0;
              const isHeader = r.type === 'header';
              const isSubtotal = r.type === 'subtotal';
              const barPct = Math.min(100, (Math.abs(r.value) / (recBruta || 1)) * 100);
              return (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isHeader ? 'rgba(6,214,160,0.06)' : isSubtotal ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'DM Sans, sans-serif', color: isHeader || isSubtotal ? '#fff' : 'rgba(255,255,255,0.7)', fontWeight: isHeader || isSubtotal ? 700 : 400, width: '40%' }}>{r.label}</td>
                  <td style={{ padding: '12px 16px', width: '35%' }}>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barPct}%`, background: isPos ? '#06d6a0' : '#ef476f', borderRadius: 99 }} />
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: isHeader || isSubtotal ? 700 : 400, color: isPos ? (isHeader || isSubtotal ? '#06d6a0' : 'rgba(255,255,255,0.8)') : '#ef476f', width: '25%' }}>
                    {r.value >= 0 ? fmtBRL(r.value) : `(${fmtBRL(Math.abs(r.value))})`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{ marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}>
          * DRE parcial calculada com base nas variações do balancete (débitos/créditos do período). Para encerramento definitivo, consultar as demonstrações completas.
        </p>
      </div>
    </div>
  );
}

function CaixaTab({ data, fmtBRL, styles, SectionTitle, DFCRow, KPI }: any) {
  const d = data.dfc;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KPI label="Fluxo Operacional" value={fmtBRL(d.fluxoOper, true)} sub="Principal fonte de caixa" color={d.fluxoOper >= 0 ? '#06d6a0' : '#ef476f'} icon="⚙️" />
        <KPI label="Fluxo de Investimento" value={fmtBRL(d.fluxoInvest, true)} sub="Imobilizado (depreciação/vendas)" color={d.fluxoInvest >= 0 ? '#06d6a0' : '#ffd166'} icon="🏗️" />
        <KPI label="Fluxo de Financiamento" value={fmtBRL(d.fluxoFinanc, true)} sub="Passivo não circulante" color={d.fluxoFinanc >= 0 ? '#ffd166' : '#ef476f'} icon="🏛️" />
        <KPI label="Var. Total de Caixa" value={fmtBRL(d.fluxoTotal, true)} sub={`Var. real no balanço: ${fmtBRL(d.varCaixaReal, true)}`} color={d.fluxoTotal >= 0 ? '#06d6a0' : '#ef476f'} icon="💰" />
      </div>

      <div style={styles.card}>
        <SectionTitle icon="💰">Demonstração do Fluxo de Caixa — Método Indireto</SectionTitle>
        <table className="dfc-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)' }}>Descrição</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)' }}>Valor (R$)</th>
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
            <tr style={{ background: 'rgba(6,214,160,0.08)', borderTop: '2px solid rgba(6,214,160,0.3)' }}>
              <td style={{ padding: '14px 12px', fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 800, color: '#fff' }}>VARIAÇÃO TOTAL DE CAIXA NO PERÍODO</td>
              <td style={{ padding: '14px 12px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 16, fontWeight: 700, color: d.fluxoTotal >= 0 ? '#06d6a0' : '#ef476f' }}>{fmtBRL(d.fluxoTotal)}</td>
            </tr>
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '10px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Saldo de Caixa — Período Anterior</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{fmtBRL(data.disponib.ant)}</td>
            </tr>
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '10px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Saldo de Caixa — Período Atual</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#fff', fontWeight: 600 }}>{fmtBRL(data.disponib.atu)}</td>
            </tr>
            <tr style={{ background: 'rgba(79,70,229,0.1)', borderTop: '1px solid rgba(79,70,229,0.3)' }}>
              <td style={{ padding: '12px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Variação Real de Caixa (conferência com balanço)</td>
              <td style={{ padding: '12px 12px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 700, color: d.varCaixaReal >= 0 ? '#06d6a0' : '#ef476f' }}>{fmtBRL(d.varCaixaReal)}</td>
            </tr>
          </tfoot>
        </table>
        <p style={{ marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, fontFamily: 'DM Sans, sans-serif' }}>
          * DFC elaborada pelo método indireto com base nas variações patrimoniais do balancete. Ajustes de resultado (lucro/prejuízo do período) não foram incluídos por falta de encerramento contábil no arquivo. A variação real de caixa é calculada diretamente das disponibilidades do balanço.
        </p>
      </div>
    </div>
  );
}

function IndicadoresTab({ data, fmtBRL, styles, SectionTitle, Badge }: any) {
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
        {indicadores.map((ind2, i) => (
          <div key={i} style={{ ...styles.card, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'DM Sans, sans-serif', marginBottom: 2 }}>{ind2.formula}</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: '#fff' }}>{ind2.label}</div>
              </div>
              <Badge label={ind2.status === 'ok' ? '✓ Ok' : ind2.status === 'warn' ? '⚡ Atenção' : '✗ Crítico'} status={ind2.status} />
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 32, fontWeight: 700, color: ind2.status === 'ok' ? '#06d6a0' : ind2.status === 'warn' ? '#ffd166' : '#ef476f' }}>
              {ind2.value}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}>{ind2.desc}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Mono, monospace' }}>Referência: {ind2.ref}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
