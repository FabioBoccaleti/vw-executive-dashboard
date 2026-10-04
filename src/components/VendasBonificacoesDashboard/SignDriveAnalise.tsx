import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, DollarSign, Wrench, Package, Users, Tag } from 'lucide-react';
import type { AssinaturaRow } from './assinaturaStorage';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#db2777', '#7c3aed', '#0891b2', '#dc2626', '#4d7c0f', '#9333ea', '#0d9488'];

type Periodo = number | 'ano';

function num(s?: string): number {
  const n = parseFloat(s ?? '');
  return isNaN(n) ? 0 : n;
}
function fmtCurrency(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  return fmtCurrency(n);
}
function parseDataBR(s: string): { d: number; m: number; y: number } | null {
  const mm = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s ?? '').trim());
  if (!mm) return null;
  return { d: +mm[1], m: +mm[2], y: +mm[3] };
}
const isEmNegociacao = (produto: string): boolean => (produto ?? '').trim().toLowerCase().startsWith('em negocia');

function MetricToggle({ value, onChange }: { value: 'quantidade' | 'valor'; onChange: (v: 'quantidade' | 'valor') => void }) {
  return (
    <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
      <button onClick={() => onChange('quantidade')}
        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${value === 'quantidade' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
        Quantidade
      </button>
      <button onClick={() => onChange('valor')}
        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${value === 'valor' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
        Valor
      </button>
    </div>
  );
}

function SummaryCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  color: 'blue' | 'emerald' | 'amber' | 'violet';
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
  } as const;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800 tabular-nums">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}

export function SignDriveAnalise({ rows }: { rows: AssinaturaRow[] }) {
  // Apenas vendas efetivadas (exclui anuladas e Em Negociação)
  const efetivadas = useMemo(
    () => rows.filter(r => !r.anulada && !isEmNegociacao(r.tipoVenda)),
    [rows],
  );

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>();
    for (const r of efetivadas) {
      const p = parseDataBR(r.dataVenda);
      if (p) set.add(p.y);
    }
    if (set.size === 0) set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [efetivadas]);

  const [year, setYear] = useState<number>(() => anosDisponiveis[0]);
  const [periodo, setPeriodo] = useState<Periodo>('ano');
  const [metricaMes, setMetricaMes] = useState<'quantidade' | 'valor'>('quantidade');
  const [metricaVendedor, setMetricaVendedor] = useState<'quantidade' | 'valor'>('quantidade');

  const anoAtual = anosDisponiveis.includes(year) ? year : anosDisponiveis[0];

  // Linhas do ano selecionado (para o gráfico "por mês")
  const doAno = useMemo(
    () => efetivadas.filter(r => parseDataBR(r.dataVenda)?.y === anoAtual),
    [efetivadas, anoAtual],
  );

  // Linhas do período (ano + mês, quando aplicável) — base dos KPIs e demais blocos
  const periodoRows = useMemo(() => {
    if (periodo === 'ano') return doAno;
    return doAno.filter(r => parseDataBR(r.dataVenda)?.m === periodo);
  }, [doAno, periodo]);

  const periodoLabel = periodo === 'ano' ? `Ano ${anoAtual}` : `${MONTHS[(periodo as number) - 1]}/${anoAtual}`;

  const kpis = useMemo(() => {
    let valorContratos = 0, comissaoBruta = 0, comissaoLiquida = 0;
    for (const r of periodoRows) {
      valorContratos += num(r.valorContrato);
      comissaoBruta += num(r.totalComissoesBruta);
      comissaoLiquida += num(r.totalComissaoLiquida);
    }
    const n = periodoRows.length;
    return {
      nVendas: n,
      valorContratos,
      comissaoBruta,
      comissaoLiquida,
      ticketMedio: n > 0 ? valorContratos / n : 0,
      rentMedia: valorContratos > 0 ? comissaoBruta / valorContratos * 100 : 0,
    };
  }, [periodoRows]);

  // Vendas por mês (ano inteiro)
  const porMes = useMemo(() => {
    const acc = Array.from({ length: 12 }, (_, i) => ({ mes: MONTHS[i], quantidade: 0, valor: 0 }));
    for (const r of doAno) {
      const p = parseDataBR(r.dataVenda);
      if (!p) continue;
      acc[p.m - 1].quantidade += 1;
      acc[p.m - 1].valor += num(r.valorContrato);
    }
    return acc;
  }, [doAno]);

  // Vendas por produto (período)
  const porProduto = useMemo(() => {
    const map = new Map<string, { quantidade: number; valor: number }>();
    for (const r of periodoRows) {
      const k = (r.tipoVenda ?? '').trim() || '(sem produto)';
      const v = map.get(k) ?? { quantidade: 0, valor: 0 };
      v.quantidade += 1;
      v.valor += num(r.valorContrato);
      map.set(k, v);
    }
    return [...map.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.quantidade - a.quantidade);
  }, [periodoRows]);

  // Vendas por vendedor (período)
  const porVendedor = useMemo(() => {
    const map = new Map<string, { quantidade: number; valor: number; comissao: number; comissaoLiquida: number }>();
    for (const r of periodoRows) {
      const k = (r.vendedor ?? '').trim() || '(sem vendedor)';
      const v = map.get(k) ?? { quantidade: 0, valor: 0, comissao: 0, comissaoLiquida: 0 };
      v.quantidade += 1;
      v.valor += num(r.valorContrato);
      v.comissao += num(r.totalComissoesBruta);
      v.comissaoLiquida += num(r.totalComissaoLiquida);
      map.set(k, v);
    }
    return [...map.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.quantidade - a.quantidade);
  }, [periodoRows]);

  // Situação da comissão (período) — exclui anuladas/Em Negociação já na base
  const porSituacao = useMemo(() => {
    let emitida = 0, aReceber = 0;
    for (const r of periodoRows) {
      if ((r.nfComissao ?? '').trim()) emitida += 1;
      else aReceber += 1;
    }
    const arr = [
      { nome: 'Nota Fiscal Emitida', quantidade: emitida, cor: '#16a34a' },
      { nome: 'Comissão a Receber', quantidade: aReceber, cor: '#f59e0b' },
    ].filter(s => s.quantidade > 0);
    return arr;
  }, [periodoRows]);

  if (efetivadas.length === 0) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-slate-700">Sem vendas para analisar</p>
            <p className="text-sm text-slate-400">Registre vendas efetivadas (não anuladas e fora de "Em Negociação") para ver a análise.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 bg-slate-100">
      {/* ── Filtros ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ano</span>
            <select value={anoAtual} onChange={e => setYear(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              {anosDisponiveis.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setPeriodo('ano')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${periodo === 'ano' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              Ano todo
            </button>
            {MONTHS.map((m, mi) => {
              const month = mi + 1;
              return (
                <button key={month} onClick={() => setPeriodo(month)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${periodo === month ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={<TrendingUp className="w-5 h-5" />} color="blue"
          label="Nº de Vendas" value={kpis.nVendas.toLocaleString('pt-BR')} sub={periodoLabel} />
        <SummaryCard icon={<DollarSign className="w-5 h-5" />} color="emerald"
          label="Valor dos Contratos" value={fmtCurrency(kpis.valorContratos)} sub={`Ticket médio ${fmtCurrency(kpis.ticketMedio)}`} />
        <SummaryCard icon={<Package className="w-5 h-5" />} color="amber"
          label="Comissões (Bruta)" value={fmtCurrency(kpis.comissaoBruta)} sub={`Rent. ${kpis.rentMedia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`} />
        <SummaryCard icon={<Wrench className="w-5 h-5" />} color="violet"
          label="Comissões (Líquida)" value={fmtCurrency(kpis.comissaoLiquida)} sub="abatido impostos" />
      </div>

      {/* ── Gráficos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Vendas por mês */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700">Vendas por mês <span className="text-xs font-normal text-slate-400">· {anoAtual}</span></h3>
            <MetricToggle value={metricaMes} onChange={setMetricaMes} />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porMes} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={v => (metricaMes === 'valor' ? fmtCompact(v) : String(v))}
                width={metricaMes === 'valor' ? 60 : 36} />
              <Tooltip formatter={(v: number) => (metricaMes === 'valor' ? fmtCurrency(v) : v.toLocaleString('pt-BR'))}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Bar dataKey={metricaMes === 'quantidade' ? 'quantidade' : 'valor'}
                name={metricaMes === 'quantidade' ? 'Vendas' : 'Valor'} fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Vendas por produto (donut) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-1.5"><Tag className="w-4 h-4 text-slate-400" /> Vendas por produto</h3>
          {porProduto.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">Sem vendas no período.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={porProduto} dataKey="quantidade" nameKey="nome" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {porProduto.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toLocaleString('pt-BR')} venda(s)`}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Situação da comissão (donut) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Situação da Comissão</h3>
          {porSituacao.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">Sem vendas no período.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={porSituacao} dataKey="quantidade" nameKey="nome" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {porSituacao.map((s, i) => <Cell key={i} fill={s.cor} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toLocaleString('pt-BR')} venda(s)`}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Vendas por vendedor (barras) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Users className="w-4 h-4 text-slate-400" /> Vendas por vendedor</h3>
            <MetricToggle value={metricaVendedor} onChange={setMetricaVendedor} />
          </div>
          {porVendedor.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">Sem vendas no período.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={porVendedor} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={v => (metricaVendedor === 'valor' ? fmtCompact(v) : String(v))}
                  width={metricaVendedor === 'valor' ? 60 : 36} />
                <Tooltip formatter={(v: number) => (metricaVendedor === 'valor' ? fmtCurrency(v) : v.toLocaleString('pt-BR'))}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey={metricaVendedor === 'quantidade' ? 'quantidade' : 'valor'}
                  name={metricaVendedor === 'quantidade' ? 'Vendas' : 'Valor'} radius={[6, 6, 0, 0]}>
                  {porVendedor.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Tabela resumo por vendedor ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Resumo por vendedor <span className="text-xs font-normal text-slate-400">· {periodoLabel}</span></h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500">Vendedor</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Vendas</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Valor dos Contratos</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Comissão Bruta</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Comissão Líquida</th>
              </tr>
            </thead>
            <tbody>
              {porVendedor.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-slate-400 text-xs py-8">Sem vendas no período.</td></tr>
              ) : porVendedor.map(v => (
                <tr key={v.nome} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-5 py-2.5 font-medium text-slate-700">{v.nome}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-slate-700">{v.quantidade.toLocaleString('pt-BR')}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{fmtCurrency(v.valor)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{fmtCurrency(v.comissao)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-slate-800">{fmtCurrency(v.comissaoLiquida)}</td>
                </tr>
              ))}
            </tbody>
            {porVendedor.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                  <td className="px-5 py-3 text-slate-800">Total</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-800">{kpis.nVendas.toLocaleString('pt-BR')}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-800">{fmtCurrency(kpis.valorContratos)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-800">{fmtCurrency(kpis.comissaoBruta)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-blue-700">{fmtCurrency(kpis.comissaoLiquida)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
