import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { TableProperties, Users, Wrench, DollarSign, Package, CarFront, ChevronDown, ChevronUp, LayoutGrid, Tags, Ban } from 'lucide-react';
import {
  getRegrasDepartamentos,
  getRegrasAnoChassi,
  getCategorias,
  getPassagensPeriodo,
  analisarGrupos,
  analisarPorAno,
  analisarPorModelo,
  analisarOsPorCategoria,
  faturamentoPontos,
  listarChassisNaoIdentificados,
  ANO_NAO_IDENTIFICADO,
  MODELO_NAO_INFORMADO,
  type RegraDepartamento,
  type RegraAnoChassi,
  type CategoriaOS,
  type PassagemRow,
  type GrupoAnalise,
  type AnoAnalise,
  type ModeloAnalise,
  type OsCategoriaResumo,
} from './passagemStorage';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#db2777', '#7c3aed', '#0891b2', '#dc2626', '#4d7c0f'];

type Periodo = number | 'ano';

function fmtCurrency(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  return fmtCurrency(n);
}

export function AnaliseSection() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [periodo, setPeriodo] = useState<Periodo>(now.getMonth() + 1);
  const [vendedor, setVendedor] = useState<string>('todos');
  const [subAba, setSubAba] = useState<'geral' | 'osCategoria'>('geral');
  const [metricaBar, setMetricaBar] = useState<'quantidade' | 'valor'>('quantidade');
  const [metricaAno, setMetricaAno] = useState<'quantidade' | 'valor'>('quantidade');
  const [metricaModelo, setMetricaModelo] = useState<'quantidade' | 'valor'>('quantidade');
  const [showNaoId, setShowNaoId] = useState(false);
  const [showAnoTable, setShowAnoTable] = useState(false);
  const [showModeloTable, setShowModeloTable] = useState(false);

  const [grupos, setGrupos] = useState<RegraDepartamento[]>([]);
  const [regrasAnoChassi, setRegrasAnoChassi] = useState<RegraAnoChassi[]>([]);
  const [categoriasCadastro, setCategoriasCadastro] = useState<CategoriaOS[]>([]);
  const [rows, setRows] = useState<PassagemRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRegrasDepartamentos().then(setGrupos);
    getRegrasAnoChassi().then(setRegrasAnoChassi);
    getCategorias().then(setCategoriasCadastro);
  }, []);

  const loadRows = useCallback(async (y: number, p: Periodo) => {
    setLoading(true);
    try {
      setRows(await getPassagensPeriodo(y, p));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows(year, periodo);
  }, [year, periodo, loadRows]);

  // Vendedores distintos do período (independente do filtro atual)
  const vendedores = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const v = r.nomeVendedor?.trim();
      if (v) set.add(v);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [rows]);

  // Mantém "todos" se o vendedor selecionado sumir ao trocar de período
  useEffect(() => {
    if (vendedor !== 'todos' && !vendedores.includes(vendedor)) setVendedor('todos');
  }, [vendedores, vendedor]);

  const rowsFiltradas = useMemo(
    () => (vendedor === 'todos' ? rows : rows.filter(r => r.nomeVendedor?.trim() === vendedor)),
    [rows, vendedor],
  );

  // Só grupos que têm ao menos um departamento associado
  const gruposAtivos = useMemo(() => grupos.filter(g => g.departamentos.length > 0), [grupos]);

  const analise: GrupoAnalise[] = useMemo(
    () => analisarGrupos(rowsFiltradas, gruposAtivos),
    [rowsFiltradas, gruposAtivos],
  );

  const totais = useMemo(() => {
    return analise.reduce(
      (acc, g) => ({
        passagens: acc.passagens + g.passagens,
        totalOs: acc.totalOs + g.totalOs,
        totalPecas: acc.totalPecas + g.totalPecas,
        totalServicos: acc.totalServicos + g.totalServicos,
      }),
      { passagens: 0, totalOs: 0, totalPecas: 0, totalServicos: 0 },
    );
  }, [analise]);

  const chartData = useMemo(
    () => analise.map(g => ({
      nome: g.nome,
      passagens: g.passagens,
      totalOs: g.totalOs,
      totalPecas: g.totalPecas,
      totalServicos: g.totalServicos,
    })),
    [analise],
  );

  const donutData = useMemo(() => chartData.filter(d => d.totalOs > 0), [chartData]);

  const anoData: AnoAnalise[] = useMemo(
    () => analisarPorAno(rowsFiltradas, gruposAtivos, regrasAnoChassi),
    [rowsFiltradas, gruposAtivos, regrasAnoChassi],
  );

  const chassisNaoId = useMemo(
    () => listarChassisNaoIdentificados(rowsFiltradas, gruposAtivos, regrasAnoChassi),
    [rowsFiltradas, gruposAtivos, regrasAnoChassi],
  );

  const modeloData: ModeloAnalise[] = useMemo(
    () => analisarPorModelo(rowsFiltradas, gruposAtivos),
    [rowsFiltradas, gruposAtivos],
  );

  const nomeCategoriaByCodigo = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categoriasCadastro) map.set(c.codigo, c.categoria);
    return map;
  }, [categoriasCadastro]);

  const periodoLabel = periodo === 'ano' ? `Ano ${year}` : `${MONTHS[(periodo as number) - 1]}/${year}`;

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 min-h-0 overflow-y-auto">
      {/* ── Seletor de ano / mês / vendedor ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ano</span>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setPeriodo('ano')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                periodo === 'ano' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              Ano todo
            </button>
            {MONTHS.map((m, mi) => {
              const month = mi + 1;
              return (
                <button
                  key={month}
                  onClick={() => setPeriodo(month)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    periodo === month ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Users className="w-4 h-4 text-slate-400" />
            <select
              value={vendedor}
              onChange={e => setVendedor(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white max-w-[260px] focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="todos">Todos os vendedores</option>
              {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Carregando…</div>
      ) : gruposAtivos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-slate-700">Nenhum departamento configurado</p>
            <p className="text-sm text-slate-400">
              Crie grupos em <strong>Cadastro → Regra Departamentos</strong> para ver a análise.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Sub-abas ── */}
          <div className="flex gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1 w-fit">
            <button
              onClick={() => setSubAba('geral')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                subAba === 'geral' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <LayoutGrid className="w-4 h-4" /> Visão Geral
            </button>
            <button
              onClick={() => setSubAba('osCategoria')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                subAba === 'osCategoria' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Tags className="w-4 h-4" /> OS por Categoria
            </button>
          </div>

          {subAba === 'geral' && (
          <>
          {/* ── Cards-resumo ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard icon={<TableProperties className="w-5 h-5" />} color="blue"
              label="Total de Passagens" value={totais.passagens.toLocaleString('pt-BR')} sub={periodoLabel} />
            <SummaryCard icon={<DollarSign className="w-5 h-5" />} color="emerald"
              label="Total OS (líquido)" value={fmtCurrency(totais.totalOs)} sub="Peças + Serviços" />
            <SummaryCard icon={<Package className="w-5 h-5" />} color="amber"
              label="Total Peças (líq.)" value={fmtCurrency(totais.totalPecas)} sub="abatido desconto" />
            <SummaryCard icon={<Wrench className="w-5 h-5" />} color="violet"
              label="Total Serviços (líq.)" value={fmtCurrency(totais.totalServicos)} sub="abatido desconto" />
          </div>

          {/* ── Gráficos ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Barras: passagens / valor por departamento */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700">
                  {metricaBar === 'quantidade' ? 'Passagens' : 'Total OS'} por departamento
                </h3>
                <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setMetricaBar('quantidade')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      metricaBar === 'quantidade' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Quantidade
                  </button>
                  <button
                    onClick={() => setMetricaBar('valor')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      metricaBar === 'valor' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Valor
                  </button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={v => (metricaBar === 'valor' ? fmtCompact(v) : String(v))}
                    width={metricaBar === 'valor' ? 60 : 36}
                  />
                  <Tooltip
                    formatter={(v: number) => (metricaBar === 'valor' ? fmtCurrency(v) : v.toLocaleString('pt-BR'))}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Bar
                    dataKey={metricaBar === 'quantidade' ? 'passagens' : 'totalOs'}
                    name={metricaBar === 'quantidade' ? 'Passagens' : 'Total OS'}
                    radius={[6, 6, 0, 0]}
                  >
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pizza/donut: participação no Total OS */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Participação no Total OS</h3>
              {donutData.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">
                  Sem valores no período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="totalOs"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {donutData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => fmtCurrency(v)}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Barras empilhadas: Peças x Serviços por departamento */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:col-span-2">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Peças × Serviços (líquidos) por departamento</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={fmtCompact} width={60} />
                  <Tooltip
                    formatter={(v: number) => fmtCurrency(v)}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="totalPecas" name="Peças" stackId="v" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="totalServicos" name="Serviços" stackId="v" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Tabela de detalhe ── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-700">Detalhe por departamento</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500">Departamento</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Passagens</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Total Peças</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Total Serviços</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Total OS</th>
                  </tr>
                </thead>
                <tbody>
                  {analise.map((g, i) => (
                    <tr key={g.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-5 py-2.5 text-slate-700">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="font-medium">{g.nome}</span>
                          <span className="text-xs text-slate-400">({g.departamentos.length} dep.)</span>
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-slate-700">
                        {g.passagens.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{fmtCurrency(g.totalPecas)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{fmtCurrency(g.totalServicos)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-slate-800">{fmtCurrency(g.totalOs)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                    <td className="px-5 py-3 text-slate-800">Total</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-800">{totais.passagens.toLocaleString('pt-BR')}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-800">{fmtCurrency(totais.totalPecas)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-800">{fmtCurrency(totais.totalServicos)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-blue-700">{fmtCurrency(totais.totalOs)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── Passagens por ano do veículo ── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CarFront className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-700">Passagens por ano do veículo</h3>
              </div>
              <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setMetricaAno('quantidade')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    metricaAno === 'quantidade' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Quantidade
                </button>
                <button
                  onClick={() => setMetricaAno('valor')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    metricaAno === 'valor' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Valor
                </button>
              </div>
            </div>

            {anoData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
                Sem passagens no período.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={anoData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="ano" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={v => (metricaAno === 'valor' ? fmtCompact(v) : String(v))}
                      width={metricaAno === 'valor' ? 60 : 36}
                    />
                    <Tooltip
                      formatter={(v: number) => (metricaAno === 'valor' ? fmtCurrency(v) : v.toLocaleString('pt-BR'))}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Bar
                      dataKey={metricaAno === 'quantidade' ? 'passagens' : 'totalOs'}
                      name={metricaAno === 'quantidade' ? 'Passagens' : 'Total OS'}
                      radius={[6, 6, 0, 0]}
                      onClick={(d: { ano?: string }) => { if (d?.ano === ANO_NAO_IDENTIFICADO) setShowNaoId(true); }}
                    >
                      {anoData.map((a, i) => (
                        <Cell
                          key={i}
                          fill={a.ano === ANO_NAO_IDENTIFICADO ? '#94a3b8' : '#2563eb'}
                          cursor={a.ano === ANO_NAO_IDENTIFICADO ? 'pointer' : 'default'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <button
                  onClick={() => setShowAnoTable(v => !v)}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {showAnoTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showAnoTable ? 'Ocultar detalhamento por ano' : 'Ver detalhamento por ano'}
                </button>

                {showAnoTable && (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500">Ano do veículo</th>
                        <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Passagens</th>
                        <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Total Peças</th>
                        <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Total Serviços</th>
                        <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Total OS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anoData.map(a => {
                        const isNaoId = a.ano === ANO_NAO_IDENTIFICADO;
                        return (
                          <tr
                            key={a.ano}
                            onClick={isNaoId ? () => setShowNaoId(true) : undefined}
                            className={`border-t border-slate-100 ${isNaoId ? 'cursor-pointer hover:bg-amber-50' : 'hover:bg-slate-50/60'}`}
                          >
                            <td className="px-5 py-2.5 text-slate-700 font-medium">
                              {isNaoId ? (
                                <span className="inline-flex items-center gap-1.5 text-amber-600">
                                  {a.ano}
                                  <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">ver chassis</span>
                                </span>
                              ) : a.ano}
                            </td>
                            <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-slate-700">
                              {a.passagens.toLocaleString('pt-BR')}
                            </td>
                            <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{fmtCurrency(a.totalPecas)}</td>
                            <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{fmtCurrency(a.totalServicos)}</td>
                            <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-slate-800">{fmtCurrency(a.totalOs)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                        <td className="px-5 py-3 text-slate-800">Total</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-800">{totais.passagens.toLocaleString('pt-BR')}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-800">{fmtCurrency(totais.totalPecas)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-800">{fmtCurrency(totais.totalServicos)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-blue-700">{fmtCurrency(totais.totalOs)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                )}
              </>
            )}
          </div>

          {/* ── Passagens por modelo ── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CarFront className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-700">Passagens por modelo</h3>
              </div>
              <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setMetricaModelo('quantidade')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    metricaModelo === 'quantidade' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Quantidade
                </button>
                <button
                  onClick={() => setMetricaModelo('valor')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    metricaModelo === 'valor' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Valor
                </button>
              </div>
            </div>

            {modeloData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
                Sem passagens no período.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={modeloData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="modelo"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      interval={0}
                      angle={-40}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={v => (metricaModelo === 'valor' ? fmtCompact(v) : String(v))}
                      width={metricaModelo === 'valor' ? 60 : 36}
                    />
                    <Tooltip
                      formatter={(v: number) => (metricaModelo === 'valor' ? fmtCurrency(v) : v.toLocaleString('pt-BR'))}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Bar
                      dataKey={metricaModelo === 'quantidade' ? 'passagens' : 'totalOs'}
                      name={metricaModelo === 'quantidade' ? 'Passagens' : 'Total OS'}
                      radius={[6, 6, 0, 0]}
                    >
                      {modeloData.map((m, i) => (
                        <Cell key={i} fill={m.modelo === MODELO_NAO_INFORMADO ? '#94a3b8' : '#16a34a'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <button
                  onClick={() => setShowModeloTable(v => !v)}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {showModeloTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showModeloTable ? 'Ocultar detalhamento por modelo' : 'Ver detalhamento por modelo'}
                </button>

                {showModeloTable && (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500">Modelo</th>
                        <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Passagens</th>
                        <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Total Peças</th>
                        <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Total Serviços</th>
                        <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Total OS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modeloData.map(m => {
                        const isNaoInf = m.modelo === MODELO_NAO_INFORMADO;
                        return (
                          <tr key={m.modelo} className="border-t border-slate-100 hover:bg-slate-50/60">
                            <td className="px-5 py-2.5 font-medium">
                              {isNaoInf ? <span className="text-slate-400">{m.modelo}</span> : <span className="text-slate-700">{m.modelo}</span>}
                            </td>
                            <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-slate-700">
                              {m.passagens.toLocaleString('pt-BR')}
                            </td>
                            <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{fmtCurrency(m.totalPecas)}</td>
                            <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{fmtCurrency(m.totalServicos)}</td>
                            <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-slate-800">{fmtCurrency(m.totalOs)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                        <td className="px-5 py-3 text-slate-800">Total</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-800">{totais.passagens.toLocaleString('pt-BR')}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-800">{fmtCurrency(totais.totalPecas)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-800">{fmtCurrency(totais.totalServicos)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-green-700">{fmtCurrency(totais.totalOs)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                )}
              </>
            )}
          </div>
          </>
          )}

          {subAba === 'osCategoria' && (
            <OsCategoriaView
              rows={rowsFiltradas}
              grupos={gruposAtivos}
              agruparPorMes={periodo === 'ano'}
              nomeCategoriaByCodigo={nomeCategoriaByCodigo}
            />
          )}
        </>
      )}

      {/* ── Modal: chassis não identificados ── */}
      <Dialog open={showNaoId} onOpenChange={setShowNaoId}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chassis não identificados</DialogTitle>
            <DialogDescription>
              {chassisNaoId.length} chassi(s) sem ano determinável. Cadastre o código da posição 10
              em <strong>Cadastro → Regra Ano / Chassi</strong> para identificá-los.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto -mx-1">
            {chassisNaoId.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Nenhum chassi não identificado no período.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="bg-slate-50">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Chassi</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500">Cód. pos. 10</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Nº OS</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Departamento</th>
                  </tr>
                </thead>
                <tbody>
                  {chassisNaoId.map((c, i) => (
                    <tr key={`${c.chassi}-${i}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{c.chassi || <span className="text-slate-400 italic">(vazio)</span>}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-block font-mono text-xs font-semibold bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{c.codigoPos10}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{c.qtdOs.toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{c.departamentos.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OsCategoriaView({
  rows, grupos, agruparPorMes, nomeCategoriaByCodigo,
}: {
  rows: PassagemRow[];
  grupos: RegraDepartamento[];
  agruparPorMes: boolean;
  nomeCategoriaByCodigo: Map<string, string>;
}) {
  const [metricaCat, setMetricaCat] = useState<'quantidade' | 'valor'>('quantidade');
  const [metricaDep, setMetricaDep] = useState<'quantidade' | 'valor'>('quantidade');
  const [showCatTable, setShowCatTable] = useState(true);
  const [showDepTable, setShowDepTable] = useState(true);
  const [fatDepto, setFatDepto] = useState<string>('todos');
  const [fatCategoria, setFatCategoria] = useState<string>('todos');

  const resumo: OsCategoriaResumo = useMemo(
    () => analisarOsPorCategoria(rows, grupos, agruparPorMes),
    [rows, grupos, agruparPorMes],
  );

  const fatPontos = useMemo(
    () => faturamentoPontos(rows, grupos, agruparPorMes, fatDepto, fatCategoria),
    [rows, grupos, agruparPorMes, fatDepto, fatCategoria],
  );

  const catChart = useMemo(
    () => resumo.porCategoria.map(c => ({
      rotulo: nomeCategoriaByCodigo.get(c.categoria) ? `${c.categoria} · ${nomeCategoriaByCodigo.get(c.categoria)}` : c.categoria,
      qtdOs: c.qtdOs,
      valor: c.valor,
    })),
    [resumo.porCategoria, nomeCategoriaByCodigo],
  );

  const semDados = resumo.totalOs === 0 && resumo.totalOsZero === 0;

  return (
    <>
      {/* Cards-resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard icon={<Tags className="w-5 h-5" />} color="blue"
          label="Total de OS (valor > 0)" value={resumo.totalOs.toLocaleString('pt-BR')} sub="ordens de serviço" />
        <SummaryCard icon={<DollarSign className="w-5 h-5" />} color="emerald"
          label="Faturamento (líquido)" value={fmtCurrency(resumo.faturamento)} sub="Peças + Serviços" />
        <SummaryCard icon={<Ban className="w-5 h-5" />} color="amber"
          label="OS com R$ 0,00" value={resumo.totalOsZero.toLocaleString('pt-BR')} sub="fora da contagem" />
      </div>

      {semDados ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-400">
          Sem OS no período (verifique departamentos agrupados e importação).
        </div>
      ) : (
        <>
          {/* Faturamento diário / mensal */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-slate-700">
                Faturamento {agruparPorMes ? 'mensal' : 'diário'} <span className="font-normal text-slate-400">(por Dt. Encerramento)</span>
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={fatDepto}
                  onChange={e => setFatDepto(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="todos">Todos os departamentos</option>
                  {grupos.map(g => <option key={g.id} value={g.nome}>{g.nome}</option>)}
                </select>
                <select
                  value={fatCategoria}
                  onChange={e => setFatCategoria(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="todos">Todas as categorias</option>
                  {resumo.porCategoria.map(c => (
                    <option key={c.categoria} value={c.categoria}>
                      {nomeCategoriaByCodigo.get(c.categoria) ? `${c.categoria} · ${nomeCategoriaByCodigo.get(c.categoria)}` : c.categoria}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {fatPontos.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-slate-400">
                Sem faturamento para o filtro selecionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={fatPontos} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="rotulo" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" angle={-40} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={fmtCompact} width={60} />
                  <Tooltip
                    formatter={(v: number) => fmtCurrency(v)}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="pecas" name="Peças" stackId="f" fill="#f59e0b" />
                  <Bar dataKey="servicos" name="Serviços" stackId="f" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* OS por categoria */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-700">OS por categoria</h3>
              <MetricToggle value={metricaCat} onChange={setMetricaCat} />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={catChart} margin={{ top: 5, right: 10, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => (metricaCat === 'valor' ? fmtCompact(v) : String(v))} width={metricaCat === 'valor' ? 60 : 36} />
                <Tooltip formatter={(v: number) => (metricaCat === 'valor' ? fmtCurrency(v) : v.toLocaleString('pt-BR'))} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey={metricaCat === 'quantidade' ? 'qtdOs' : 'valor'} name={metricaCat === 'quantidade' ? 'Qtd OS' : 'Valor'} fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <CollapseButton open={showCatTable} onToggle={() => setShowCatTable(v => !v)} label="detalhamento por categoria" />
            {showCatTable && (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500">Categoria</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Qtd OS</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Valor (líq.)</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">OS R$ 0,00</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.porCategoria.map(c => (
                      <tr key={c.categoria} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-5 py-2.5 text-slate-700 font-medium">
                          {c.categoria}
                          {nomeCategoriaByCodigo.get(c.categoria) && <span className="text-slate-400 font-normal"> · {nomeCategoriaByCodigo.get(c.categoria)}</span>}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-slate-700">{c.qtdOs.toLocaleString('pt-BR')}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{fmtCurrency(c.valor)}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-amber-600">{c.qtdOsZero.toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                      <td className="px-5 py-3 text-slate-800">Total</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-800">{resumo.totalOs.toLocaleString('pt-BR')}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-blue-700">{fmtCurrency(resumo.faturamento)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-amber-600">{resumo.totalOsZero.toLocaleString('pt-BR')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* OS por departamento */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-700">OS por departamento</h3>
              <MetricToggle value={metricaDep} onChange={setMetricaDep} />
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={resumo.porDepartamento} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="departamento" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => (metricaDep === 'valor' ? fmtCompact(v) : String(v))} width={metricaDep === 'valor' ? 60 : 36} />
                <Tooltip formatter={(v: number) => (metricaDep === 'valor' ? fmtCurrency(v) : v.toLocaleString('pt-BR'))} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey={metricaDep === 'quantidade' ? 'qtdOs' : 'valor'} name={metricaDep === 'quantidade' ? 'Qtd OS' : 'Valor'} fill="#7c3aed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <CollapseButton open={showDepTable} onToggle={() => setShowDepTable(v => !v)} label="detalhamento por departamento" />
            {showDepTable && (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500">Departamento</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Qtd OS</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Valor (líq.)</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">OS R$ 0,00</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.porDepartamento.map(d => (
                      <tr key={d.departamento} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-5 py-2.5 text-slate-700 font-medium">{d.departamento}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-slate-700">{d.qtdOs.toLocaleString('pt-BR')}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{fmtCurrency(d.valor)}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-amber-600">{d.qtdOsZero.toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                      <td className="px-5 py-3 text-slate-800">Total</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-800">{resumo.totalOs.toLocaleString('pt-BR')}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-violet-700">{fmtCurrency(resumo.faturamento)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-amber-600">{resumo.totalOsZero.toLocaleString('pt-BR')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function MetricToggle({ value, onChange }: { value: 'quantidade' | 'valor'; onChange: (v: 'quantidade' | 'valor') => void }) {
  return (
    <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
      <button
        onClick={() => onChange('quantidade')}
        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${value === 'quantidade' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
      >
        Quantidade
      </button>
      <button
        onClick={() => onChange('valor')}
        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${value === 'valor' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
      >
        Valor
      </button>
    </div>
  );
}

function CollapseButton({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
    >
      {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      {open ? `Ocultar ${label}` : `Ver ${label}`}
    </button>
  );
}

function SummaryCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
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
