import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Loader2, Boxes, DollarSign, Tag, Timer, PackageX, Search, ChevronRight, ChevronDown, Car,
} from 'lucide-react';
import { getInventarioVeiculos, getLatestMonthVeiculos, type VeiculoImport } from './veiculosStorage';
import {
  buildAnaliseVeiculos, AGING_BUCKETS, type VeiculoAnaliseItem,
} from './veiculosAnalise';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return month;
  return `${MONTH_NAMES[idx]} de ${y}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const brCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brInteger = new Intl.NumberFormat('pt-BR');
function fmtCurrency(n: number): string { return brCurrency.format(n); }
function fmtInt(n: number): string { return brInteger.format(n); }
function fmtPct(n: number): string { return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`; }
function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

interface Props {
  primary: string;
  primaryLight: string;
}

export function AnaliseVeiculosTab({ primary, primaryLight }: Props) {
  const [month, setMonth] = useState<string>(currentMonth());
  const [monthResolved, setMonthResolved] = useState(false);
  const [baseDate, setBaseDate] = useState<string>(todayISO());
  const [threshold, setThreshold] = useState<number>(90);
  const [thresholdInput, setThresholdInput] = useState<string>('90');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VeiculoImport | null>(null);

  const [search, setSearch] = useState('');
  const [filtroMarca, setFiltroMarca] = useState<string>('todas');
  const [filtroFaixa, setFiltroFaixa] = useState<string>('todas');
  const [expandedFaixa, setExpandedFaixa] = useState<string | null>(null);
  const [expandedMarca, setExpandedMarca] = useState<string | null>(null);
  const [expandedModelo, setExpandedModelo] = useState<string | null>(null);
  const [showAllModelos, setShowAllModelos] = useState(false);

  // Resolve o mês mais recente disponível ao abrir.
  useEffect(() => {
    let active = true;
    setMonthResolved(false);
    getLatestMonthVeiculos().then((latest) => {
      if (!active) return;
      if (latest) setMonth(latest);
      setMonthResolved(true);
    });
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const inv = await getInventarioVeiculos(month);
      setData(inv);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    if (monthResolved) load();
  }, [monthResolved, load]);

  const analise = useMemo(() => {
    if (!data) return null;
    return buildAnaliseVeiculos(data.veiculos, baseDate, threshold);
  }, [data, baseDate, threshold]);

  const itensFiltrados = useMemo(() => {
    if (!analise) return [] as VeiculoAnaliseItem[];
    const q = search.trim().toLowerCase();
    return analise.itens
      .filter((it) => {
        if (filtroMarca !== 'todas' && it.marca !== filtroMarca) return false;
        if (filtroFaixa !== 'todas' && it.faixa !== filtroFaixa) return false;
        if (q) {
          const hay = `${it.modelo} ${it.marca} ${it.chassi} ${it.veiculo} ${it.identificacao}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 500);
  }, [analise, search, filtroMarca, filtroFaixa]);

  const applyThreshold = () => {
    const n = Number(thresholdInput);
    if (Number.isFinite(n) && n >= 0) setThreshold(Math.round(n));
    else setThresholdInput(String(threshold));
  };

  if (!monthResolved || loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Carregando...
      </div>
    );
  }

  if (!data || !analise || analise.totalVeiculos === 0) {
    return (
      <div className="mt-4 bg-white border border-slate-200 rounded-xl shadow-sm py-16">
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: primaryLight, color: primary }}
          >
            <Car className="w-8 h-8" />
          </div>
          <p className="text-slate-600 font-medium">
            Nenhum inventário disponível para análise.
          </p>
          <p className="text-sm text-slate-400">
            Importe o arquivo Excel na aba "Importação de Arquivo" para gerar a análise.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Controles */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Mês de referência</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as string]: primary }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Data-base (cálculo dos dias)</label>
          <input
            type="date"
            value={baseDate}
            onChange={(e) => setBaseDate(e.target.value || todayISO())}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as string]: primary }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Parado acima de (dias)</label>
          <input
            type="number"
            min={0}
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
            onBlur={applyThreshold}
            onKeyDown={(e) => { if (e.key === 'Enter') applyThreshold(); }}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 w-32 focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as string]: primary }}
          />
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm font-medium text-slate-700">{formatMonthLabel(data.month)}</p>
          <p className="text-xs text-slate-400">{data.fileName}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={<Boxes className="w-5 h-5" />}
          color={primary}
          label="Veículos em estoque"
          value={fmtInt(analise.totalVeiculos)}
          sub={`${analise.marcas.length} marcas`}
        />
        <KpiCard
          icon={<DollarSign className="w-5 h-5" />}
          color="#0f766e"
          label="Valor total em estoque"
          value={fmtCurrency(analise.totalValor)}
          sub="Soma do valor unitário"
        />
        <KpiCard
          icon={<Tag className="w-5 h-5" />}
          color="#475569"
          label="Ticket médio"
          value={fmtCurrency(analise.ticketMedio)}
          sub="Valor médio por veículo"
        />
        <KpiCard
          icon={<Timer className="w-5 h-5" />}
          color="#b45309"
          label="Idade média"
          value={analise.idadeMedia != null ? `${fmtInt(Math.round(analise.idadeMedia))} dias` : '—'}
          sub="Tempo médio em estoque"
        />
        <KpiCard
          icon={<PackageX className="w-5 h-5" />}
          color="#dc2626"
          label={`Parados (> ${fmtInt(analise.threshold)} dias)`}
          value={fmtInt(analise.parados)}
          sub={`${fmtPct(analise.pctParados)} · ${fmtCurrency(analise.valorParado)}`}
        />
      </div>

      {/* Gráfico de faixas + resumo por faixa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3">Veículos em estoque por faixa de dias</h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analise.buckets} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
              <Tooltip
                formatter={(v: number, _n, p) => [
                  `${fmtInt(v)} veículos · ${fmtCurrency((p?.payload as { valor: number }).valor)}`,
                  'Quantidade',
                ]}
              />
              <Bar dataKey="n" radius={[4, 4, 0, 0]}>
                {analise.buckets.map((b, i) => {
                  const def = AGING_BUCKETS[i];
                  const parado = def.min >= analise.threshold;
                  return <Cell key={b.label} fill={parado ? '#dc2626' : primary} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-400 mt-1">
            Barras em vermelho = faixas acima do limiar de {fmtInt(analise.threshold)} dias (parado).
          </p>
        </div>

        {/* Resumo por faixa (expansível) */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-1">Resumo por faixa de dias</h4>
          <p className="text-xs text-slate-400 mb-3">Clique em uma faixa para ver os veículos.</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-100">
                <th className="text-left py-1.5 font-medium">Faixa</th>
                <th className="text-right py-1.5 font-medium">Veículos</th>
                <th className="text-right py-1.5 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {analise.buckets.map((b) => {
                const isOpen = expandedFaixa === b.label;
                const itensFaixa = isOpen
                  ? analise.itens.filter((it) => it.faixa === b.label).sort((a, c) => c.valor - a.valor)
                  : [];
                return (
                  <ExpandRow
                    key={b.label}
                    label={b.label}
                    n={b.n}
                    valor={b.valor}
                    isOpen={isOpen}
                    onToggle={() => setExpandedFaixa(isOpen ? null : b.label)}
                    itens={itensFaixa}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Estoque por marca + por modelo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3">Veículos em estoque por marca</h4>
          <ResponsiveContainer width="100%" height={Math.max(220, analise.marcas.length * 30)}>
            <BarChart
              data={analise.marcas}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="marca" tick={{ fontSize: 12 }} width={90} />
              <Tooltip
                formatter={(v: number, _n, p) => [
                  `${fmtInt(v)} veículos · ${fmtCurrency((p?.payload as { valor: number }).valor)}`,
                  'Quantidade',
                ]}
              />
              <Bar dataKey="n" radius={[0, 4, 4, 0]} fill={primary} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabela por marca (expansível) */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-1">Resumo por marca</h4>
          <p className="text-xs text-slate-400 mb-3">Clique em uma marca para ver os veículos.</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-100">
                <th className="text-left py-1.5 font-medium">Marca</th>
                <th className="text-right py-1.5 font-medium">Veículos</th>
                <th className="text-right py-1.5 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {analise.marcas.map((m) => {
                const isOpen = expandedMarca === m.marca;
                const itensMarca = isOpen
                  ? analise.itens.filter((it) => it.marca === m.marca).sort((a, c) => c.valor - a.valor)
                  : [];
                return (
                  <ExpandRow
                    key={m.marca}
                    label={m.marca}
                    n={m.n}
                    valor={m.valor}
                    isOpen={isOpen}
                    onToggle={() => setExpandedMarca(isOpen ? null : m.marca)}
                    itens={itensMarca}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modelos em estoque */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-700">
            {showAllModelos ? 'Modelos em estoque' : 'Top modelos em estoque'}
          </h4>
          {analise.modelos.length > 15 && (
            <button
              onClick={() => setShowAllModelos((v) => !v)}
              className="text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors hover:bg-slate-50"
              style={{ color: primary, borderColor: primary }}
            >
              {showAllModelos ? 'Mostrar top 15' : `Mostrar todos (${fmtInt(analise.modelos.length)})`}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-3">Clique em um modelo com mais de um veículo para ver os itens.</p>
        <div className="overflow-auto max-h-[50vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-slate-500 border-b border-slate-100">
                <th className="text-left py-1.5 font-medium">Modelo</th>
                <th className="text-right py-1.5 font-medium">Veículos</th>
                <th className="text-right py-1.5 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {(showAllModelos ? analise.modelos : analise.modelos.slice(0, 15)).map((m) => {
                const isOpen = expandedModelo === m.modelo;
                const itensModelo = isOpen
                  ? analise.itens.filter((it) => it.modelo === m.modelo).sort((a, c) => c.valor - a.valor)
                  : [];
                return (
                  <ModeloRow
                    key={m.modelo}
                    modelo={m.modelo}
                    n={m.n}
                    valor={m.valor}
                    isOpen={isOpen}
                    onToggle={() => setExpandedModelo(isOpen ? null : m.modelo)}
                    itens={itensModelo}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela detalhada */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-slate-700">Veículos em estoque</h3>
          <div className="relative ml-auto">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar modelo, chassi, código..."
              className="border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 w-64"
              style={{ ['--tw-ring-color' as string]: primary }}
            />
          </div>
          <select
            value={filtroMarca}
            onChange={(e) => setFiltroMarca(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as string]: primary }}
          >
            <option value="todas">Todas as marcas</option>
            {analise.marcas.map((m) => (
              <option key={m.marca} value={m.marca}>{m.marca}</option>
            ))}
          </select>
          <select
            value={filtroFaixa}
            onChange={(e) => setFiltroFaixa(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as string]: primary }}
          >
            <option value="todas">Todas as faixas</option>
            {AGING_BUCKETS.map((b) => (
              <option key={b.label} value={b.label}>{b.label} dias</option>
            ))}
          </select>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: primary }} className="text-white">
                <th className="text-left px-3 py-2 whitespace-nowrap">Código</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Modelo</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Marca</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Chassi</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Entrada</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Dias</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Valor</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Situação</th>
              </tr>
            </thead>
            <tbody>
              {itensFiltrados.map((it, i) => (
                <tr key={`${it.veiculo}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{it.veiculo}</td>
                  <td className="px-3 py-1.5 text-slate-600">{it.modelo}</td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{it.marca}</td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{it.chassi}</td>
                  <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{fmtDate(it.entrada)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{it.dias != null ? fmtInt(it.dias) : '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-800">{fmtCurrency(it.valor)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {it.dias === null ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Sem data</span>
                    ) : it.parado ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Parado</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
          Mostrando {fmtInt(itensFiltrados.length)} veículos (máx. 500) de {fmtInt(analise.totalVeiculos)}.
        </div>
      </div>
    </div>
  );
}

function ExpandRow({
  label, n, valor, isOpen, onToggle, itens,
}: {
  label: string;
  n: number;
  valor: number;
  isOpen: boolean;
  onToggle: () => void;
  itens: VeiculoAnaliseItem[];
}) {
  return (
    <>
      <tr className="border-b border-slate-50 cursor-pointer hover:bg-slate-50" onClick={onToggle}>
        <td className="py-1.5 text-slate-700">
          <span className="inline-flex items-center gap-1">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            {label}
          </span>
        </td>
        <td className="py-1.5 text-right tabular-nums text-slate-600">{fmtInt(n)}</td>
        <td className="py-1.5 text-right tabular-nums text-slate-700">{fmtCurrency(valor)}</td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={3} className="p-0">
            {itens.length === 0 ? (
              <p className="text-xs text-slate-400 px-2 py-2">Nenhum veículo.</p>
            ) : (
              <div className="max-h-64 overflow-auto bg-slate-50 rounded-md my-1">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr className="text-slate-500">
                      <th className="text-left px-2 py-1 font-medium">Modelo</th>
                      <th className="text-right px-2 py-1 font-medium">Dias</th>
                      <th className="text-right px-2 py-1 font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((it, i) => (
                      <tr key={`${it.veiculo}-${i}`} className="border-b border-slate-100 last:border-0">
                        <td className="px-2 py-1 text-slate-700">
                          <span className="block truncate max-w-[200px]" title={`${it.veiculo} — ${it.modelo}`}>
                            {it.modelo || it.veiculo}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-slate-600">{it.dias != null ? fmtInt(it.dias) : '—'}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-slate-700">{fmtCurrency(it.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ModeloRow({
  modelo, n, valor, isOpen, onToggle, itens,
}: {
  modelo: string;
  n: number;
  valor: number;
  isOpen: boolean;
  onToggle: () => void;
  itens: VeiculoAnaliseItem[];
}) {
  const expandable = n > 1;
  return (
    <>
      <tr
        className={`border-b border-slate-50 ${expandable ? 'cursor-pointer hover:bg-slate-50' : ''}`}
        onClick={expandable ? onToggle : undefined}
      >
        <td className="py-1.5 text-slate-700">
          <span className="inline-flex items-center gap-1 max-w-[280px]" title={modelo}>
            {expandable ? (
              isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <span className="truncate">{modelo}</span>
          </span>
        </td>
        <td className="py-1.5 text-right tabular-nums text-slate-600">{fmtInt(n)}</td>
        <td className="py-1.5 text-right tabular-nums text-slate-700">{fmtCurrency(valor)}</td>
      </tr>
      {expandable && isOpen && (
        <tr>
          <td colSpan={3} className="p-0">
            <div className="max-h-64 overflow-auto bg-slate-50 rounded-md my-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100">
                  <tr className="text-slate-500">
                    <th className="text-left px-2 py-1 font-medium">Chassi</th>
                    <th className="text-right px-2 py-1 font-medium">Dias</th>
                    <th className="text-right px-2 py-1 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it, i) => (
                    <tr key={`${it.veiculo}-${i}`} className="border-b border-slate-100 last:border-0">
                      <td className="px-2 py-1 text-slate-700 whitespace-nowrap">{it.chassi || '—'}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-slate-600">{it.dias != null ? fmtInt(it.dias) : '—'}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-slate-700">{fmtCurrency(it.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function KpiCard({ icon, color, label, value, sub }: {
  icon: React.ReactNode; color: string; label: string; value: string; sub: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: color }}>
          {icon}
        </div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}
