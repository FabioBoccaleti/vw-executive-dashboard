import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { loadVPecasRows, loadVPecasDevolucaoRows, type VPecasRow } from './vPecasStorage';

// ─── Constantes ────────────────────────────────────────────────────────────────
const MS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const OFICINA_DEPTS = new Set(['104', '122']);
const VIOLET  = '#7c3aed';
const TEAL    = '#0d9488';
const EMERALD = '#10b981';
const ROSE    = '#f43f5e';
const CMP_COLORS = ['#7c3aed', '#0d9488', '#f59e0b', '#f43f5e'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const n   = (v?: string | null) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtBRLF = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct  = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

function getYr(row: VPecasRow): number {
  if (row.periodoImport) { const [y] = row.periodoImport.split('-').map(Number); if (y > 2000) return y; }
  const d = row.data['DTA_DOCUMENTO'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[2];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[0];
  return 0;
}
function getMo(row: VPecasRow): number {
  if (row.periodoImport) { const [, m] = row.periodoImport.split('-').map(Number); if (m >= 1 && m <= 12) return m; }
  const d = row.data['DTA_DOCUMENTO'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[1];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[1];
  return 0;
}
function getDia(row: VPecasRow): number {
  const d = row.data['DTA_DOCUMENTO'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[2];
  return 0;
}

function calcPecas(d: Record<string, string>) {
  const recBruta    = n(d['LIQ_NOTA_FISCAL']);
  const icms        = n(d['VAL_ICMS']);
  const pis         = n(d['VAL_PIS']);
  const cofins      = n(d['VAL_COFINS']);
  const difal       = n(d['VAL_ICMS_PARTIL_UF_DEST']) + n(d['VAL_ICMS_COMB_POBREZA']);
  const recLiq      = recBruta - icms - pis - cofins - difal;
  const custo       = n(d['TOT_CUSTO_MEDIO']);
  const lucroBruto  = recLiq - custo;
  return { recBruta, recLiq, lucroBruto };
}

function calcServicos(d: Record<string, string>) {
  const recBruta = n(d['LIQ_NOTA_FISCAL']);
  const iss      = n(d['VAL_ISS']);
  const icms     = n(d['VAL_ICMS']);
  const pis      = n(d['VAL_PIS']);
  const cofins   = n(d['VAL_COFINS']);
  const difal    = n(d['VAL_ICMS_PARTIL_UF_DEST']) + n(d['VAL_ICMS_COMB_POBREZA']);
  const recLiq   = recBruta - iss - icms - pis - cofins - difal;
  return { recBruta, recLiq };
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
type ChartTab = 'pecas' | 'servicos' | 'total';
type SortKey  = 'pecasRec' | 'pecasLucro' | 'servRec' | 'nome';

interface ConsultorEntry {
  nome: string;
  pecas:    { nfs: number; recBruta: number; recLiq: number; lucroBruto: number; margem: number };
  servicos: { nfs: number; recBruta: number; recLiq: number };
}

interface Props {
  /** Linhas já filtradas por SERIE_NOTA_FISCAL === 'RPS' e DEPARTAMENTO ∈ {104, 122} */
  servicosRows: VPecasRow[];
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function VServicosConsultorAnalise({ servicosRows }: Props) {
  const curYear = new Date().getFullYear();

  const [pecasRows, setPecasRows] = useState<VPecasRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [year, setYear]           = useState(curYear);
  const [month, setMonth]         = useState<number>(new Date().getMonth() + 1);
  const [chartTab, setChartTab]   = useState<ChartTab>('pecas');
  const [selConsultor, setSelConsultor] = useState<string | null>(null);
  const [sortBy, setSortBy]       = useState<SortKey>('pecasRec');
  const [cmpConsultores, setCmpConsultores] = useState<string[]>([]);
  const [pecasTransAtivas, setPecasTransAtivas]       = useState<Set<string> | null>(null);
  const [servicosTransAtivas, setServicosTransAtivas] = useState<Set<string> | null>(null);

  // Carrega peças (SERIE ≠ RPS) de dept oficina
  useEffect(() => {
    Promise.all([loadVPecasRows(), loadVPecasDevolucaoRows()]).then(([rows, devol]) => {
      const combined = [...rows, ...devol];
      setPecasRows(
        combined.filter(r =>
          r.data['SERIE_NOTA_FISCAL'] !== 'RPS' &&
          OFICINA_DEPTS.has(r.data['DEPARTAMENTO']?.trim() ?? '')
        )
      );
      setLoading(false);
    });
  }, []);

  // Reseta seleção ao trocar período
  useEffect(() => { setSelConsultor(null); setCmpConsultores([]); }, [year, month]);

  const availYears = useMemo(() => {
    const s = new Set([...pecasRows, ...servicosRows].map(getYr).filter(y => y > 2000));
    [curYear - 1, curYear].forEach(y => s.add(y));
    return [...s].sort();
  }, [pecasRows, servicosRows, curYear]);

  const filteredPecas = useMemo(
    () => pecasRows.filter(r => getYr(r) === year && getMo(r) === month),
    [pecasRows, year, month]
  );
  const filteredServicos = useMemo(
    () => servicosRows.filter(r => getYr(r) === year && getMo(r) === month),
    [servicosRows, year, month]
  );

  // Agrupamento por consultor
  const pecasByC = useMemo(() => {
    const m = new Map<string, VPecasRow[]>();
    for (const r of filteredPecas) {
      const k = r.data['NOME_VENDEDOR']?.trim() || '(sem nome)';
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  }, [filteredPecas]);

  const servicosByC = useMemo(() => {
    const m = new Map<string, VPecasRow[]>();
    for (const r of filteredServicos) {
      const k = r.data['NOME_VENDEDOR']?.trim() || '(sem nome)';
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  }, [filteredServicos]);

  // Apenas consultores com AMBOS peças e serviços
  const consultores = useMemo<ConsultorEntry[]>(() => {
    const names = [...pecasByC.keys()].filter(nome => servicosByC.has(nome));
    return names.map(nome => {
      const pRows = pecasByC.get(nome)!;
      const sRows = servicosByC.get(nome)!;

      let pRecBruta = 0, pRecLiq = 0, pLucroBruto = 0;
      for (const r of pRows) {
        const c = calcPecas(r.data);
        pRecBruta += c.recBruta; pRecLiq += c.recLiq; pLucroBruto += c.lucroBruto;
      }
      let sRecBruta = 0, sRecLiq = 0;
      for (const r of sRows) {
        const c = calcServicos(r.data);
        sRecBruta += c.recBruta; sRecLiq += c.recLiq;
      }
      const pMargem = pRecLiq !== 0 ? (pLucroBruto / pRecLiq) * 100 : 0;
      return {
        nome,
        pecas:    { nfs: pRows.length, recBruta: pRecBruta, recLiq: pRecLiq, lucroBruto: pLucroBruto, margem: pMargem },
        servicos: { nfs: sRows.length, recBruta: sRecBruta, recLiq: sRecLiq },
      };
    });
  }, [pecasByC, servicosByC]);

  const sortedConsultores = useMemo(() => {
    return [...consultores].sort((a, b) => {
      if (sortBy === 'pecasRec')   return b.pecas.recBruta - a.pecas.recBruta;
      if (sortBy === 'pecasLucro') return b.pecas.lucroBruto - a.pecas.lucroBruto;
      if (sortBy === 'servRec')    return b.servicos.recBruta - a.servicos.recBruta;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [consultores, sortBy]);

  // ─── Dados para tabela comparativa (até 4 consultores) ───────────────────────
  const cmpData = useMemo(() => {
    return cmpConsultores.map(nome => {
      const pRows = pecasByC.get(nome) ?? [];
      const sRows = servicosByC.get(nome) ?? [];

      const pecasByTrans: Record<string, number> = {};
      let pRecBruta = 0, pRecLiq = 0, pLucroBruto = 0;
      for (const r of pRows) {
        const tipo = r.data['TIPO_TRANSACAO']?.trim() || '(sem tipo)';
        const c = calcPecas(r.data);
        pecasByTrans[tipo] = (pecasByTrans[tipo] ?? 0) + c.recBruta;
        pRecBruta += c.recBruta; pRecLiq += c.recLiq; pLucroBruto += c.lucroBruto;
      }

      const servicosByTrans: Record<string, number> = {};
      let sRecBruta = 0, sRecLiq = 0;
      for (const r of sRows) {
        const tipo = r.data['TIPO_TRANSACAO']?.trim() || '(sem tipo)';
        const c = calcServicos(r.data);
        servicosByTrans[tipo] = (servicosByTrans[tipo] ?? 0) + c.recBruta;
        sRecBruta += c.recBruta; sRecLiq += c.recLiq;
      }

      const pMargem = pRecLiq !== 0 ? (pLucroBruto / pRecLiq) * 100 : 0;
      return {
        nome,
        pecasByTrans,
        pecas: { recBruta: pRecBruta, recLiq: pRecLiq, lucroBruto: pLucroBruto, margem: pMargem },
        servicosByTrans,
        servicos: { recBruta: sRecBruta, recLiq: sRecLiq },
        total: { recBruta: pRecBruta + sRecBruta, recLiq: pRecLiq + sRecLiq },
      };
    });
  }, [cmpConsultores, pecasByC, servicosByC]);

  const cmpPecasTipos = useMemo(() => {
    const s = new Set<string>();
    for (const d of cmpData) Object.keys(d.pecasByTrans).forEach(t => s.add(t));
    return [...s].sort();
  }, [cmpData]);

  const cmpServicosTipos = useMemo(() => {
    const s = new Set<string>();
    for (const d of cmpData) Object.keys(d.servicosByTrans).forEach(t => s.add(t));
    return [...s].sort();
  }, [cmpData]);

  // Dados diários para o gráfico
  const daysInMonth = useMemo(() => {
    const total = new Date(year, month, 0).getDate();
    return Array.from({ length: total }, (_, i) => i + 1);
  }, [year, month]);

  const dailyData = useMemo(() => {
    const filterBy = (source: VPecasRow[]) =>
      selConsultor
        ? source.filter(r => (r.data['NOME_VENDEDOR']?.trim() || '(sem nome)') === selConsultor)
        : source;
    const pFiltered = filterBy(filteredPecas);
    const sFiltered = filterBy(filteredServicos);
    return daysInMonth.map(day => {
      const pRows = pFiltered.filter(r => getDia(r) === day);
      const sRows = sFiltered.filter(r => getDia(r) === day);
      let pecas = 0, servicos = 0;
      for (const r of pRows) pecas += n(r.data['LIQ_NOTA_FISCAL']);
      for (const r of sRows) servicos += n(r.data['LIQ_NOTA_FISCAL']);
      return {
        dia: String(day).padStart(2, '0'),
        pecas,
        servicos,
        total: pecas + servicos,
        nfsPecas: pRows.length,
        nfsServicos: sRows.length,
      };
    });
  }, [daysInMonth, filteredPecas, filteredServicos, selConsultor]);

  // ─── Tipos de transação únicos ───────────────────────────────────────────────
  const pecasTransacoes = useMemo(() => {
    const filterBy = (source: VPecasRow[]) =>
      selConsultor ? source.filter(r => (r.data['NOME_VENDEDOR']?.trim() || '(sem nome)') === selConsultor) : source;
    const s = new Set(filterBy(filteredPecas).map(r => r.data['TIPO_TRANSACAO']?.trim() || '(sem tipo)'));
    return [...s].sort();
  }, [filteredPecas, selConsultor]);

  const servicosTransacoes = useMemo(() => {
    const filterBy = (source: VPecasRow[]) =>
      selConsultor ? source.filter(r => (r.data['NOME_VENDEDOR']?.trim() || '(sem nome)') === selConsultor) : source;
    const s = new Set(filterBy(filteredServicos).map(r => r.data['TIPO_TRANSACAO']?.trim() || '(sem tipo)'));
    return [...s].sort();
  }, [filteredServicos, selConsultor]);

  // ─── Paleta de cores por tipo de transação ───────────────────────────────────
  const TRANS_PALETTE = ['#7c3aed','#06b6d4','#f59e0b','#10b981','#f97316','#e879f9','#84cc16','#3b82f6','#fb7185','#fbbf24','#a78bfa','#34d399'];
  const TRANS_LABEL: Record<string, string> = { 'G21': 'Garantia', 'O26': 'Serviço Interno', 'O21': 'Venda' };
  const transLabel = (t: string) => TRANS_LABEL[t] ?? t;
  function transColor(tipos: string[], tipo: string) {
    const idx = tipos.indexOf(tipo);
    return TRANS_PALETTE[idx % TRANS_PALETTE.length];
  }

  // ─── Dados diários por transação ─────────────────────────────────────────────
  const dailyPecasByTrans = useMemo(() => {
    const filterBy = (source: VPecasRow[]) =>
      selConsultor ? source.filter(r => (r.data['NOME_VENDEDOR']?.trim() || '(sem nome)') === selConsultor) : source;
    const rows = filterBy(filteredPecas);
    return daysInMonth.map(day => {
      const obj: Record<string, number> = { dia: day } as any;
      obj['dia_str'] = String(day).padStart(2, '0');
      for (const t of pecasTransacoes) obj[t] = 0;
      for (const r of rows.filter(r2 => getDia(r2) === day)) {
        const t = r.data['TIPO_TRANSACAO']?.trim() || '(sem tipo)';
        obj[t] = (obj[t] ?? 0) + n(r.data['LIQ_NOTA_FISCAL']);
      }
      return obj;
    });
  }, [daysInMonth, filteredPecas, selConsultor, pecasTransacoes]);

  const dailyServicosByTrans = useMemo(() => {
    const filterBy = (source: VPecasRow[]) =>
      selConsultor ? source.filter(r => (r.data['NOME_VENDEDOR']?.trim() || '(sem nome)') === selConsultor) : source;
    const rows = filterBy(filteredServicos);
    return daysInMonth.map(day => {
      const obj: Record<string, number> = { dia: day } as any;
      obj['dia_str'] = String(day).padStart(2, '0');
      for (const t of servicosTransacoes) obj[t] = 0;
      for (const r of rows.filter(r2 => getDia(r2) === day)) {
        const t = r.data['TIPO_TRANSACAO']?.trim() || '(sem tipo)';
        obj[t] = (obj[t] ?? 0) + n(r.data['LIQ_NOTA_FISCAL']);
      }
      return obj;
    });
  }, [daysInMonth, filteredServicos, selConsultor, servicosTransacoes]);

  if (loading) {
    return (
      <div className="p-10 text-center text-slate-300 text-sm animate-pulse">
        Carregando dados de peças...
      </div>
    );
  }

  const SH = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
      {right}
    </div>
  );

  return (
    <div className="flex-1 overflow-auto bg-slate-50 px-6 py-5 space-y-5" style={{ minHeight: 0 }}>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          ANO
          <select
            value={year}
            onChange={e => setYear(+e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
          >
            {availYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {MS.map((m, i) => (
            <button
              key={m}
              onClick={() => setMonth(i + 1)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                month === i + 1
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-slate-400">
          {consultores.length} consultor{consultores.length !== 1 ? 'es' : ''} com Peças + Serviços
        </span>
      </div>

      {/* Estado vazio */}
      {consultores.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-10 text-center text-slate-400 text-sm">
          Nenhum consultor com vendas de Peças <strong>e</strong> Serviços em {MS[month - 1]}/{year}.<br />
          <span className="text-xs text-slate-300 mt-1 block">
            Peças = SERIE ≠ RPS · Serviços = SERIE = RPS · Depts 104 e 122
          </span>
        </div>
      )}

      {consultores.length > 0 && (
        <>
          {/* Gráfico diário */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
            <SH
              right={
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={selConsultor ?? ''}
                    onChange={e => setSelConsultor(e.target.value || null)}
                    className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 max-w-[200px]"
                  >
                    <option value="">Todos os consultores</option>
                    {sortedConsultores.map(c => (
                      <option key={c.nome} value={c.nome}>{c.nome}</option>
                    ))}
                  </select>
                  {(['pecas', 'servicos', 'total'] as const).map(tab => {
                    const labels: Record<ChartTab, string> = { pecas: 'Peças', servicos: 'Serviços', total: 'Total' };
                    const active = chartTab === tab;
                    const cls = {
                      pecas:    active ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600',
                      servicos: active ? 'bg-teal-600 text-white border-teal-600 shadow-sm'    : 'bg-white text-slate-500 border-slate-200 hover:border-teal-300 hover:text-teal-600',
                      total:    active ? 'bg-slate-700 text-white border-slate-700 shadow-sm'  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700',
                    }[tab];
                    return (
                      <button key={tab} onClick={() => setChartTab(tab)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${cls}`}>
                        {labels[tab]}
                      </button>
                    );
                  })}
                </div>
              }
            >
              Evolução Diária — {MS[month - 1]}/{year}
              {selConsultor && <span className="text-teal-600 normal-case ml-1 text-[11px]">· {selConsultor}</span>}
            </SH>

            {dailyData.every(d => d.total === 0) ? (
              <div className="h-32 flex items-center justify-center text-slate-300 text-xs">
                Sem dados no período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart key={chartTab} data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} angle={-45} textAnchor="end" height={36} />
                  <YAxis tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} width={52} />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      if (chartTab === 'total') {
                        return (
                          <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-3 py-2.5 text-xs min-w-[200px]">
                            <p className="font-bold text-slate-700 mb-1.5">Dia {label} — {MS[month - 1]}/{year}</p>
                            <div className="flex justify-between gap-4">
                              <span style={{ color: VIOLET }} className="font-semibold">Peças</span>
                              <span className="font-mono text-slate-700">{fmtBRLF(d?.pecas ?? 0)}</span>
                            </div>
                            <div className="flex justify-between gap-4 mt-0.5">
                              <span style={{ color: TEAL }} className="font-semibold">Serviços</span>
                              <span className="font-mono text-slate-700">{fmtBRLF(d?.servicos ?? 0)}</span>
                            </div>
                            <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
                              <span className="font-bold text-slate-700">Total</span>
                              <span className="font-mono font-bold text-slate-800">{fmtBRLF(d?.total ?? 0)}</span>
                            </div>
                            <div className="flex justify-between gap-4 mt-0.5">
                              <span className="text-slate-400">NFs</span>
                              <span className="font-mono text-slate-500">{(d?.nfsPecas ?? 0) + (d?.nfsServicos ?? 0)}</span>
                            </div>
                          </div>
                        );
                      }
                      const color = chartTab === 'pecas' ? VIOLET : TEAL;
                      const val = chartTab === 'pecas' ? d?.pecas : d?.servicos;
                      const nfs = chartTab === 'pecas' ? d?.nfsPecas : d?.nfsServicos;
                      return (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-3 py-2.5 text-xs min-w-[160px]">
                          <p className="font-bold text-slate-700 mb-1.5">Dia {label} — {MS[month - 1]}/{year}</p>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Rec. Bruta</span>
                            <span className="font-mono font-semibold" style={{ color }}>{fmtBRLF(val ?? 0)}</span>
                          </div>
                          <div className="flex justify-between gap-4 mt-0.5">
                            <span className="text-slate-500">NFs</span>
                            <span className="font-mono text-slate-600">{nfs ?? 0}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {chartTab === 'total' && <Legend wrapperStyle={{ fontSize: 11 }} />}
                  {chartTab === 'total' && <Bar dataKey="pecas" name="Peças" stackId="a" fill={VIOLET} fillOpacity={0.85} radius={[0, 0, 0, 0]} />}
                  {chartTab === 'total' && <Bar dataKey="servicos" name="Serviços" stackId="a" fill={TEAL} fillOpacity={0.85} radius={[3, 3, 0, 0]} />}
                  {chartTab !== 'total' && (
                    <Bar dataKey={chartTab} name={chartTab === 'pecas' ? 'Peças' : 'Serviços'} radius={[3, 3, 0, 0]}>
                      {dailyData.map((d, i) => (
                        <Cell key={i} fill={chartTab === 'pecas' ? VIOLET : TEAL}
                          fillOpacity={(chartTab === 'pecas' ? d.pecas : d.servicos) > 0 ? 0.85 : 0.15} />
                      ))}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Gráficos por Transação lado a lado */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Peças por Transação */}
            {(() => {
              const ativos = pecasTransAtivas ?? new Set(pecasTransacoes);
              const hasData = dailyPecasByTrans.some(d => pecasTransacoes.some(t => (d[t] ?? 0) > 0));
              return (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
                  <SH
                    right={
                      <div className="flex gap-1 flex-wrap justify-end">
                        {pecasTransacoes.map((t, i) => {
                          const color = TRANS_PALETTE[i % TRANS_PALETTE.length];
                          const active = ativos.has(t);
                          return (
                            <button
                              key={t}
                              onClick={() => {
                                const next = new Set(ativos);
                                if (active) { if (next.size > 1) next.delete(t); }
                                else next.add(t);
                                setPecasTransAtivas(next);
                              }}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                                active
                                  ? 'text-white border-transparent shadow-sm'
                                  : 'bg-white text-slate-400 border-slate-200'
                              }`}
                              style={active ? { background: color, borderColor: color } : undefined}
                            >
                              {active ? '✓ ' : ''}{transLabel(t)}
                            </button>
                          );
                        })}
                        {pecasTransAtivas && (
                          <button
                            onClick={() => setPecasTransAtivas(null)}
                            className="px-2 py-0.5 rounded-full text-[10px] text-slate-400 border border-slate-200 hover:text-slate-600 transition-all"
                          >
                            Todos
                          </button>
                        )}
                      </div>
                    }
                  >
                    Peças por Tipo de Serviço
                  </SH>
                  {!hasData ? (
                    <div className="h-32 flex items-center justify-center text-slate-300 text-xs">Sem dados</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart key={`pt-${selConsultor ?? 'all'}`} data={dailyPecasByTrans} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="dia_str" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} angle={-45} textAnchor="end" height={36} />
                        <YAxis tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} width={52} />
                        <Tooltip
                          content={({ active, payload, label }: any) => {
                            if (!active || !payload?.length) return null;
                            const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
                            return (
                              <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-3 py-2.5 text-xs min-w-[180px]">
                                <p className="font-bold text-slate-700 mb-1.5">Dia {label} — Peças</p>
                                {payload.map((p: any, i: number) => p.value > 0 && (
                                  <div key={i} className="flex justify-between gap-4">
                                    <span style={{ color: p.fill }} className="font-semibold">{p.name}</span>
                                    <span className="font-mono text-slate-700">{fmtBRLF(p.value)}</span>
                                  </div>
                                ))}
                                {payload.length > 1 && (
                                  <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
                                    <span className="font-bold text-slate-700">Total</span>
                                    <span className="font-mono font-bold text-slate-800">{fmtBRLF(total)}</span>
                                  </div>
                                )}
                              </div>
                            );
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        {pecasTransacoes.filter(t => ativos.has(t)).map((t, i) => (
                          <Bar key={t} dataKey={t} name={transLabel(t)} stackId="p" fill={transColor(pecasTransacoes, t)} fillOpacity={0.85}
                            radius={i === pecasTransacoes.filter(tt => ativos.has(tt)).length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              );
            })()}

            {/* Serviços por Transação */}
            {(() => {
              const ativos = servicosTransAtivas ?? new Set(servicosTransacoes);
              const hasData = dailyServicosByTrans.some(d => servicosTransacoes.some(t => (d[t] ?? 0) > 0));
              return (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
                  <SH
                    right={
                      <div className="flex gap-1 flex-wrap justify-end">
                        {servicosTransacoes.map((t, i) => {
                          const color = TRANS_PALETTE[i % TRANS_PALETTE.length];
                          const active = ativos.has(t);
                          return (
                            <button
                              key={t}
                              onClick={() => {
                                const next = new Set(ativos);
                                if (active) { if (next.size > 1) next.delete(t); }
                                else next.add(t);
                                setServicosTransAtivas(next);
                              }}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                                active
                                  ? 'text-white border-transparent shadow-sm'
                                  : 'bg-white text-slate-400 border-slate-200'
                              }`}
                              style={active ? { background: color, borderColor: color } : undefined}
                            >
                              {active ? '✓ ' : ''}{transLabel(t)}
                            </button>
                          );
                        })}
                        {servicosTransAtivas && (
                          <button
                            onClick={() => setServicosTransAtivas(null)}
                            className="px-2 py-0.5 rounded-full text-[10px] text-slate-400 border border-slate-200 hover:text-slate-600 transition-all"
                          >
                            Todos
                          </button>
                        )}
                      </div>
                    }
                  >
                    Tipo de Serviço
                  </SH>
                  {!hasData ? (
                    <div className="h-32 flex items-center justify-center text-slate-300 text-xs">Sem dados</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart key={`st-${selConsultor ?? 'all'}`} data={dailyServicosByTrans} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="dia_str" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} angle={-45} textAnchor="end" height={36} />
                        <YAxis tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} width={52} />
                        <Tooltip
                          content={({ active, payload, label }: any) => {
                            if (!active || !payload?.length) return null;
                            const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
                            return (
                              <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-3 py-2.5 text-xs min-w-[180px]">
                                <p className="font-bold text-slate-700 mb-1.5">Dia {label} — Serviços</p>
                                {payload.map((p: any, i: number) => p.value > 0 && (
                                  <div key={i} className="flex justify-between gap-4">
                                    <span style={{ color: p.fill }} className="font-semibold">{p.name}</span>
                                    <span className="font-mono text-slate-700">{fmtBRLF(p.value)}</span>
                                  </div>
                                ))}
                                {payload.length > 1 && (
                                  <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
                                    <span className="font-bold text-slate-700">Total</span>
                                    <span className="font-mono font-bold text-slate-800">{fmtBRLF(total)}</span>
                                  </div>
                                )}
                              </div>
                            );
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        {servicosTransacoes.filter(t => ativos.has(t)).map((t, i) => (
                          <Bar key={t} dataKey={t} name={transLabel(t)} stackId="s" fill={transColor(servicosTransacoes, t)} fillOpacity={0.85}
                            radius={i === servicosTransacoes.filter(tt => ativos.has(tt)).length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Ranking */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
            <SH
              right={
                <span className="text-[10px] text-slate-400">
                  Clique no cabeçalho para ordenar · Clique na linha para comparar (até 4)
                </span>
              }
            >
              Ranking por Consultor — {MS[month - 1]}/{year}
            </SH>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="text-left px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100" rowSpan={2}>#</th>
                    <th
                      className="text-left px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 cursor-pointer hover:text-teal-600 whitespace-nowrap"
                      rowSpan={2}
                      onClick={() => setSortBy('nome')}
                    >
                      Consultor {sortBy === 'nome' && '▲'}
                    </th>
                    <th className="text-center px-2 py-1.5 text-[10px] font-bold text-violet-500 uppercase tracking-wider border-b border-slate-100 bg-violet-50/40" colSpan={5}>
                      Peças (SERIE ≠ RPS)
                    </th>
                    <th className="text-center px-2 py-1.5 text-[10px] font-bold text-teal-500 uppercase tracking-wider border-b border-slate-100 bg-teal-50/40" colSpan={3}>
                      Serviços (SERIE = RPS)
                    </th>
                  </tr>
                  <tr>
                    {/* Peças sub-headers */}
                    <th className="text-right px-2 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-100 bg-violet-50/20 whitespace-nowrap">NFs</th>
                    <th
                      className="text-right px-2 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-100 bg-violet-50/20 cursor-pointer hover:text-violet-600 whitespace-nowrap"
                      onClick={() => setSortBy('pecasRec')}
                    >
                      Rec. Bruta {sortBy === 'pecasRec' && '▼'}
                    </th>
                    <th className="text-right px-2 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-100 bg-violet-50/20 whitespace-nowrap">Rec. Líquida</th>
                    <th
                      className="text-right px-2 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-100 bg-violet-50/20 cursor-pointer hover:text-violet-600 whitespace-nowrap"
                      onClick={() => setSortBy('pecasLucro')}
                    >
                      Lucro Bruto {sortBy === 'pecasLucro' && '▼'}
                    </th>
                    <th className="text-right px-2 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-100 bg-violet-50/20 whitespace-nowrap">Margem</th>
                    {/* Serviços sub-headers */}
                    <th className="text-right px-2 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-100 bg-teal-50/20 whitespace-nowrap">NFs</th>
                    <th
                      className="text-right px-2 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-100 bg-teal-50/20 cursor-pointer hover:text-teal-600 whitespace-nowrap"
                      onClick={() => setSortBy('servRec')}
                    >
                      Rec. Bruta {sortBy === 'servRec' && '▼'}
                    </th>
                    <th className="text-right px-2 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-100 bg-teal-50/20 whitespace-nowrap">Rec. Líquida</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedConsultores.map((c, i) => {
                    const isSelected = cmpConsultores.includes(c.nome);
                    const cmpIdx     = cmpConsultores.indexOf(c.nome);
                    const medals     = ['①', '②', '③'];
                    const medaColors = ['#f59e0b', '#9ca3af', '#cd7f32'];
                    return (
                      <tr
                        key={c.nome}
                        onClick={() => {
                          if (isSelected) {
                            setCmpConsultores(prev => prev.filter(n => n !== c.nome));
                          } else if (cmpConsultores.length < 4) {
                            setCmpConsultores(prev => [...prev, c.nome]);
                          }
                        }}
                        className={`transition-colors ${
                          isSelected
                            ? 'cursor-pointer'
                            : cmpConsultores.length >= 4
                              ? 'opacity-50 cursor-not-allowed'
                              : 'cursor-pointer ' + (i % 2 === 0 ? 'hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-100/60')
                        }`}
                        style={isSelected ? { background: CMP_COLORS[cmpIdx] + '18', boxShadow: `inset 0 0 0 1px ${CMP_COLORS[cmpIdx]}` } : undefined}
                        <td className="px-2 py-2 text-center border-b border-slate-50">
                          {i < 3
                            ? <span className="text-[11px] font-black" style={{ color: medaColors[i] }}>{medals[i]}</span>
                            : <span className="text-[10px] text-slate-400">{i + 1}</span>
                          }
                        </td>
                        <td className="px-2 py-2 font-semibold text-slate-700 border-b border-slate-50 max-w-[160px]">
                          <span className="truncate block">{c.nome}</span>
                          {isSelected && <span className="text-[9px] font-bold" style={{ color: CMP_COLORS[cmpIdx] }}>● na comparação #{cmpIdx + 1}</span>}
                        </td>
                        {/* Peças */}
                        <td className="px-2 py-2 text-right font-mono text-slate-500 border-b border-slate-50 bg-violet-50/10">{c.pecas.nfs}</td>
                        <td className="px-2 py-2 text-right font-mono font-semibold text-violet-700 border-b border-slate-50 bg-violet-50/10 whitespace-nowrap">{fmtBRL(c.pecas.recBruta)}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-600 border-b border-slate-50 bg-violet-50/10 whitespace-nowrap">{fmtBRL(c.pecas.recLiq)}</td>
                        <td className={`px-2 py-2 text-right font-mono font-semibold border-b border-slate-50 bg-violet-50/10 whitespace-nowrap ${c.pecas.lucroBruto >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {fmtBRL(c.pecas.lucroBruto)}
                        </td>
                        <td className={`px-2 py-2 text-right font-mono text-xs border-b border-slate-50 bg-violet-50/10 ${c.pecas.margem >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {fmtPct(c.pecas.margem)}
                        </td>
                        {/* Serviços */}
                        <td className="px-2 py-2 text-right font-mono text-slate-500 border-b border-slate-50 bg-teal-50/10">{c.servicos.nfs}</td>
                        <td className="px-2 py-2 text-right font-mono font-semibold text-teal-700 border-b border-slate-50 bg-teal-50/10 whitespace-nowrap">{fmtBRL(c.servicos.recBruta)}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-600 border-b border-slate-50 bg-teal-50/10 whitespace-nowrap">{fmtBRL(c.servicos.recLiq)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totais */}
                <tfoot>
                  <tr className="bg-slate-50">
                    <td />
                    <td className="px-2 py-2 text-xs font-bold text-slate-600 border-t border-slate-200">Total</td>
                    <td className="px-2 py-2 text-right font-mono font-bold text-slate-700 border-t border-slate-200 bg-violet-50/20">
                      {sortedConsultores.reduce((s, c) => s + c.pecas.nfs, 0)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-bold text-violet-700 border-t border-slate-200 bg-violet-50/20 whitespace-nowrap">
                      {fmtBRL(sortedConsultores.reduce((s, c) => s + c.pecas.recBruta, 0))}
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-bold text-slate-700 border-t border-slate-200 bg-violet-50/20 whitespace-nowrap">
                      {fmtBRL(sortedConsultores.reduce((s, c) => s + c.pecas.recLiq, 0))}
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-bold border-t border-slate-200 bg-violet-50/20 whitespace-nowrap" style={{ color: sortedConsultores.reduce((s, c) => s + c.pecas.lucroBruto, 0) >= 0 ? EMERALD : ROSE }}>
                      {fmtBRL(sortedConsultores.reduce((s, c) => s + c.pecas.lucroBruto, 0))}
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-bold text-slate-500 border-t border-slate-200 bg-violet-50/20">
                      {(() => {
                        const totalRecLiq = sortedConsultores.reduce((s, c) => s + c.pecas.recLiq, 0);
                        const totalLucro  = sortedConsultores.reduce((s, c) => s + c.pecas.lucroBruto, 0);
                        return fmtPct(totalRecLiq !== 0 ? (totalLucro / totalRecLiq) * 100 : 0);
                      })()}
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-bold text-slate-700 border-t border-slate-200 bg-teal-50/20">
                      {sortedConsultores.reduce((s, c) => s + c.servicos.nfs, 0)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-bold text-teal-700 border-t border-slate-200 bg-teal-50/20 whitespace-nowrap">
                      {fmtBRL(sortedConsultores.reduce((s, c) => s + c.servicos.recBruta, 0))}
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-bold text-slate-700 border-t border-slate-200 bg-teal-50/20 whitespace-nowrap">
                      {fmtBRL(sortedConsultores.reduce((s, c) => s + c.servicos.recLiq, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tabela Comparativa */}
          {cmpConsultores.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
              <SH
                right={
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">
                      {cmpConsultores.length}/4 selecionados · valor em destaque = melhor da linha
                    </span>
                    <button
                      onClick={() => setCmpConsultores([])}
                      className="px-2.5 py-1 rounded-full text-[10px] text-rose-400 border border-rose-200 hover:bg-rose-50 transition-all"
                    >
                      Limpar
                    </button>
                  </div>
                }
              >
                Comparativo de Consultores — {MS[month - 1]}/{year}
              </SH>

              <div className="overflow-x-auto mt-3">
                <table className="w-full text-xs border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 min-w-[170px]">
                        Métrica
                      </th>
                      {cmpData.map((d, i) => (
                        <th key={d.nome} className="text-right px-3 py-2 text-[11px] font-black uppercase tracking-wide border-b border-slate-200 min-w-[150px] whitespace-nowrap"
                          style={{ color: CMP_COLORS[i], borderBottom: `2px solid ${CMP_COLORS[i]}` }}>
                          {d.nome.split(' ').slice(0, 2).join(' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* ── PEÇAS ── */}
                    <tr>
                      <td colSpan={cmpData.length + 1} className="px-3 py-1.5 text-[10px] font-black text-violet-600 uppercase tracking-widest bg-violet-50/60 border-b border-violet-100">
                        Peças (SERIE ≠ RPS)
                      </td>
                    </tr>
                    {cmpPecasTipos.map(tipo => {
                      const vals = cmpData.map(d => d.pecasByTrans[tipo] ?? 0);
                      const best = Math.max(...vals);
                      return (
                        <tr key={`p-t-${tipo}`} className="hover:bg-slate-50/60">
                          <td className="px-3 py-1.5 text-slate-400 border-b border-slate-50 pl-7 italic">{transLabel(tipo)}</td>
                          {vals.map((v, i) => (
                            <td key={i} className={`px-3 py-1.5 text-right font-mono border-b border-slate-50 whitespace-nowrap ${v === best && best > 0 ? 'font-bold text-[12px]' : 'text-slate-400'}`}
                              style={v === best && best > 0 ? { color: CMP_COLORS[i] } : undefined}>
                              {v > 0 ? fmtBRL(v) : <span className="text-slate-200">—</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    {([
                      { label: 'Rec. Bruta', fn: (d: typeof cmpData[0]) => d.pecas.recBruta, bold: false },
                      { label: 'Rec. Líquida', fn: (d: typeof cmpData[0]) => d.pecas.recLiq, bold: false },
                      { label: 'Lucro Bruto', fn: (d: typeof cmpData[0]) => d.pecas.lucroBruto, bold: true },
                    ] as const).map(({ label, fn, bold }) => {
                      const vals = cmpData.map(fn);
                      const best = Math.max(...vals);
                      return (
                        <tr key={`p-${label}`} className="hover:bg-slate-50/60">
                          <td className="px-3 py-1.5 font-semibold text-slate-600 border-b border-slate-100 bg-violet-50/20">{label}</td>
                          {vals.map((v, i) => (
                            <td key={i} className={`px-3 py-1.5 text-right font-mono border-b border-slate-100 bg-violet-50/20 whitespace-nowrap ${v === best && best > 0 ? (bold ? 'font-black text-[12px]' : 'font-bold') : 'text-slate-500'}`}
                              style={v === best && best > 0 ? { color: CMP_COLORS[i] } : undefined}>
                              {fmtBRL(v)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    {/* Margem */}
                    {(() => {
                      const vals = cmpData.map(d => d.pecas.margem);
                      const best = Math.max(...vals);
                      return (
                        <tr className="hover:bg-slate-50/60">
                          <td className="px-3 py-1.5 font-semibold text-slate-600 border-b border-slate-200 bg-violet-50/20">Margem %</td>
                          {vals.map((v, i) => (
                            <td key={i} className={`px-3 py-1.5 text-right font-mono border-b border-slate-200 bg-violet-50/20 ${v === best && best > 0 ? 'font-bold text-[12px]' : 'text-slate-500'}`}
                              style={v === best && best > 0 ? { color: CMP_COLORS[i] } : undefined}>
                              {fmtPct(v)}
                            </td>
                          ))}
                        </tr>
                      );
                    })()}

                    {/* ── SERVIÇOS ── */}
                    <tr>
                      <td colSpan={cmpData.length + 1} className="px-3 py-1.5 text-[10px] font-black text-teal-600 uppercase tracking-widest bg-teal-50/60 border-b border-teal-100">
                        Serviços (SERIE = RPS)
                      </td>
                    </tr>
                    {cmpServicosTipos.map(tipo => {
                      const vals = cmpData.map(d => d.servicosByTrans[tipo] ?? 0);
                      const best = Math.max(...vals);
                      return (
                        <tr key={`s-t-${tipo}`} className="hover:bg-slate-50/60">
                          <td className="px-3 py-1.5 text-slate-400 border-b border-slate-50 pl-7 italic">{transLabel(tipo)}</td>
                          {vals.map((v, i) => (
                            <td key={i} className={`px-3 py-1.5 text-right font-mono border-b border-slate-50 whitespace-nowrap ${v === best && best > 0 ? 'font-bold text-[12px]' : 'text-slate-400'}`}
                              style={v === best && best > 0 ? { color: CMP_COLORS[i] } : undefined}>
                              {v > 0 ? fmtBRL(v) : <span className="text-slate-200">—</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    {([
                      { label: 'Rec. Bruta', fn: (d: typeof cmpData[0]) => d.servicos.recBruta },
                      { label: 'Rec. Líquida', fn: (d: typeof cmpData[0]) => d.servicos.recLiq },
                    ] as const).map(({ label, fn }) => {
                      const vals = cmpData.map(fn);
                      const best = Math.max(...vals);
                      return (
                        <tr key={`s-${label}`} className="hover:bg-slate-50/60">
                          <td className="px-3 py-1.5 font-semibold text-slate-600 border-b border-slate-200 bg-teal-50/20">{label}</td>
                          {vals.map((v, i) => (
                            <td key={i} className={`px-3 py-1.5 text-right font-mono border-b border-slate-200 bg-teal-50/20 whitespace-nowrap ${v === best && best > 0 ? 'font-bold' : 'text-slate-500'}`}
                              style={v === best && best > 0 ? { color: CMP_COLORS[i] } : undefined}>
                              {fmtBRL(v)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}

                    {/* ── TOTAL GERAL ── */}
                    <tr>
                      <td colSpan={cmpData.length + 1} className="px-3 py-1.5 text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100/80 border-b border-slate-200">
                        Total Geral (Peças + Serviços)
                      </td>
                    </tr>
                    {([
                      { label: 'Rec. Bruta Total', fn: (d: typeof cmpData[0]) => d.total.recBruta },
                      { label: 'Rec. Líquida Total', fn: (d: typeof cmpData[0]) => d.total.recLiq },
                    ] as const).map(({ label, fn }) => {
                      const vals = cmpData.map(fn);
                      const best = Math.max(...vals);
                      return (
                        <tr key={`t-${label}`} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2 font-bold text-slate-700 border-b border-slate-100 bg-slate-50/60">{label}</td>
                          {vals.map((v, i) => (
                            <td key={i} className={`px-3 py-2 text-right font-mono border-b border-slate-100 bg-slate-50/60 whitespace-nowrap ${v === best && best > 0 ? 'font-black text-[13px]' : 'text-slate-500'}`}
                              style={v === best && best > 0 ? { color: CMP_COLORS[i] } : undefined}>
                              {fmtBRL(v)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}
