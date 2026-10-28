import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { Loader2, AlertCircle, TrendingDown, Boxes, PackageX, Timer, Search } from 'lucide-react';
import type { EstoquePecasMarca } from './EstoquePecasDashboard';
import { getInventario, getMovimentacao, type ImportedTable } from './estoquePecasStorage';
import { buildAnalise, AGING_BUCKETS, type AnaliseResult, type AnaliseItem } from './estoqueAnalise';

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

const brCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brInteger = new Intl.NumberFormat('pt-BR');
function fmtCurrency(n: number): string { return brCurrency.format(n); }
function fmtInt(n: number): string { return brInteger.format(n); }
function fmtPct(n: number): string { return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`; }
/** Formato compacto para eixos (R$ 1,2 mi / R$ 350 mil). */
function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

interface Props {
  marca: EstoquePecasMarca;
}

export function AnaliseEstoqueTab({ marca }: Props) {
  const [month, setMonth] = useState<string>(currentMonth());
  const [threshold, setThreshold] = useState<number>(180);
  const [thresholdInput, setThresholdInput] = useState<string>('180');
  const [loading, setLoading] = useState(false);
  const [inventario, setInventario] = useState<ImportedTable | null>(null);
  const [movimentacao, setMovimentacao] = useState<ImportedTable | null>(null);

  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'parados' | 'movimentando' | 'sem_info'>('todos');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, mov] = await Promise.all([
        getInventario(marca.id, month),
        getMovimentacao(marca.id, month),
      ]);
      setInventario(inv);
      setMovimentacao(mov);
    } finally {
      setLoading(false);
    }
  }, [marca.id, month]);

  useEffect(() => { load(); }, [load]);

  const analise: AnaliseResult | null = useMemo(() => {
    if (!inventario || !movimentacao) return null;
    return buildAnalise(inventario, movimentacao, threshold);
  }, [inventario, movimentacao, threshold]);

  const applyThreshold = () => {
    const n = parseInt(thresholdInput, 10);
    if (Number.isFinite(n) && n >= 0) setThreshold(n);
    else setThresholdInput(String(threshold));
  };

  const itensFiltrados = useMemo(() => {
    if (!analise) return [];
    const q = search.trim().toLowerCase();
    return analise.itens.filter((it) => {
      if (filtroStatus === 'parados' && !it.parado) return false;
      if (filtroStatus === 'movimentando' && (it.parado || it.dias === null)) return false;
      if (filtroStatus === 'sem_info' && it.dias !== null) return false;
      if (q && !(it.codigo.toLowerCase().includes(q) || it.descricao.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => b.valorTotal - a.valorTotal).slice(0, 500);
  }, [analise, search, filtroStatus]);

  // ─── Estados de carregamento / ausência de dados ──────────────────────────────
  if (loading) {
    return (
      <div className="mt-4 flex items-center justify-center py-16 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
      </div>
    );
  }

  const faltando: string[] = [];
  if (!inventario) faltando.push('Inventário de Estoque');
  if (!movimentacao) faltando.push('Movimentação de Itens');

  return (
    <div className="mt-4 space-y-5">
      {/* Controles */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Mês de referência</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as string]: marca.primary }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Dias para considerar "parado"</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              onBlur={applyThreshold}
              onKeyDown={(e) => { if (e.key === 'Enter') applyThreshold(); }}
              className="w-28 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2"
              style={{ ['--tw-ring-color' as string]: marca.primary }}
            />
            <button
              onClick={applyThreshold}
              className="px-3 py-2 rounded-md text-sm font-semibold text-white"
              style={{ backgroundColor: marca.primary }}
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>

      {faltando.length > 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">
              Dados incompletos para {formatMonthLabel(month)}
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Para gerar a análise, importe: <strong>{faltando.join(' e ')}</strong> na aba
              "Importação de Arquivo" para este mês.
            </p>
          </div>
        </div>
      ) : analise ? (
        <AnaliseConteudo
          marca={marca}
          analise={analise}
          month={month}
          search={search}
          setSearch={setSearch}
          filtroStatus={filtroStatus}
          setFiltroStatus={setFiltroStatus}
          itensFiltrados={itensFiltrados}
        />
      ) : null}
    </div>
  );
}

// ─── Conteúdo da análise ────────────────────────────────────────────────────────

const ABC_COLORS: Record<'A' | 'B' | 'C', string> = { A: '#16a34a', B: '#f59e0b', C: '#dc2626' };

function AnaliseConteudo({
  marca, analise, month, search, setSearch, filtroStatus, setFiltroStatus, itensFiltrados,
}: {
  marca: EstoquePecasMarca;
  analise: AnaliseResult;
  month: string;
  search: string;
  setSearch: (v: string) => void;
  filtroStatus: 'todos' | 'parados' | 'movimentando' | 'sem_info';
  setFiltroStatus: (v: 'todos' | 'parados' | 'movimentando' | 'sem_info') => void;
  itensFiltrados: AnaliseItem[];
}) {
  const donutData = [
    { name: 'Movimentando', value: analise.valorMovimentando, color: '#16a34a' },
    { name: 'Parado', value: analise.valorParado, color: marca.primary },
    { name: 'Sem info', value: analise.semInfoValor, color: '#94a3b8' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-bold text-slate-700">
        Análise de Estoque — {formatMonthLabel(month)}
      </h3>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Boxes className="w-5 h-5" />}
          color={marca.primary}
          label="Valor total em estoque"
          value={fmtCurrency(analise.totalValor)}
          sub={`${fmtInt(analise.totalSkus)} itens · ${fmtInt(analise.totalPecas)} peças`}
        />
        <KpiCard
          icon={<TrendingDown className="w-5 h-5" />}
          color="#dc2626"
          label="Valor parado"
          value={fmtCurrency(analise.valorParado)}
          sub={`${fmtPct(analise.pctValorParado)} do estoque`}
        />
        <KpiCard
          icon={<PackageX className="w-5 h-5" />}
          color="#b45309"
          label="Itens parados"
          value={fmtInt(analise.skusParados)}
          sub={`${fmtPct(analise.pctSkusParados)} dos itens · ${fmtInt(analise.pecasParadas)} peças`}
        />
        <KpiCard
          icon={<Timer className="w-5 h-5" />}
          color="#475569"
          label="Item mais antigo"
          value={analise.maisAntigo?.dias != null ? `${fmtInt(analise.maisAntigo.dias)} dias` : '—'}
          sub={analise.maiorValorParado ? `Maior parado: ${fmtCurrency(analise.maiorValorParado.valorTotal)}` : '—'}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Aging bar */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3">Valor em estoque por dias sem movimentação</h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analise.buckets} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11 }} width={80} />
              <Tooltip
                formatter={(v: number, _n, p) => [`${fmtCurrency(v)} · ${fmtInt((p?.payload as { skus: number }).skus)} itens`, 'Valor']}
              />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {analise.buckets.map((b, i) => {
                  const def = AGING_BUCKETS[i];
                  const parado = def.min >= analise.threshold;
                  return <Cell key={b.label} fill={parado ? '#dc2626' : marca.primary} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-400 mt-1">
            Barras em vermelho = faixas acima do limiar de {fmtInt(analise.threshold)} dias (parado).
          </p>
        </div>

        {/* Donut */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3">Movimentando × Parado (valor)</h4>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {donutData.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resumo por faixa + ABC + Grupos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Resumo por faixa */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3">Resumo por faixa de dias</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-100">
                <th className="text-left py-1.5 font-medium">Faixa</th>
                <th className="text-right py-1.5 font-medium">Itens</th>
                <th className="text-right py-1.5 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {analise.buckets.map((b) => (
                <tr key={b.label} className="border-b border-slate-50">
                  <td className="py-1.5 text-slate-700">{b.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-600">{fmtInt(b.skus)}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-700">{fmtCurrency(b.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Curva ABC */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-1">Curva ABC (por valor)</h4>
          <p className="text-xs text-slate-400 mb-3">A ≤ 80% · B ≤ 95% · C restante do valor</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-100">
                <th className="text-left py-1.5 font-medium">Classe</th>
                <th className="text-right py-1.5 font-medium">Itens</th>
                <th className="text-right py-1.5 font-medium">Valor</th>
                <th className="text-right py-1.5 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {analise.abc.map((a) => (
                <tr key={a.classe} className="border-b border-slate-50">
                  <td className="py-1.5">
                    <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: ABC_COLORS[a.classe] }}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ABC_COLORS[a.classe] }} />
                      {a.classe}
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-slate-600">{fmtInt(a.skus)}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-700">{fmtCurrency(a.valor)}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-600">{fmtPct(a.pctValor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Valor parado por grupo */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3">Valor parado por grupo (top 8)</h4>
          {analise.gruposParados.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum item parado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-100">
                  <th className="text-left py-1.5 font-medium">Grupo</th>
                  <th className="text-right py-1.5 font-medium">Itens</th>
                  <th className="text-right py-1.5 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {analise.gruposParados.map((g) => (
                  <tr key={g.grupo} className="border-b border-slate-50">
                    <td className="py-1.5 text-slate-700 truncate max-w-[160px]" title={g.grupo}>{g.grupo}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-600">{fmtInt(g.skus)}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-700">{fmtCurrency(g.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Top 10 parados */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <h4 className="text-sm font-bold text-slate-700 mb-3">Top 10 itens parados por valor</h4>
        {analise.topParados.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum item acima do limiar de {fmtInt(analise.threshold)} dias.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-left py-2 font-medium">Código</th>
                  <th className="text-left py-2 font-medium">Descrição</th>
                  <th className="text-right py-2 font-medium">Qtd</th>
                  <th className="text-right py-2 font-medium">Valor</th>
                  <th className="text-right py-2 font-medium">Dias</th>
                </tr>
              </thead>
              <tbody>
                {analise.topParados.map((it, i) => (
                  <tr key={`${it.codigoInterno}-${i}`} className="border-b border-slate-50">
                    <td className="py-1.5 text-slate-700 whitespace-nowrap">{it.codigo}</td>
                    <td className="py-1.5 text-slate-600">{it.descricao}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-600">{fmtInt(it.quantidade)}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-800 font-medium">{fmtCurrency(it.valorTotal)}</td>
                    <td className="py-1.5 text-right tabular-nums text-red-600 font-medium">{fmtInt(it.dias ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabela detalhada */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
          <h4 className="text-sm font-bold text-slate-700">Itens analisados</h4>
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar código ou descrição..."
                className="pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 w-64"
                style={{ ['--tw-ring-color' as string]: marca.primary }}
              />
            </div>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
              className="py-1.5 px-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2"
              style={{ ['--tw-ring-color' as string]: marca.primary }}
            >
              <option value="todos">Todos</option>
              <option value="parados">Parados</option>
              <option value="movimentando">Movimentando</option>
              <option value="sem_info">Sem info de dias</option>
            </select>
          </div>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: marca.primary }} className="text-white">
                <th className="text-left px-3 py-2 whitespace-nowrap">Código</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Descrição</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Grupo</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Qtd</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Vl. Unit.</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Valor Total</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Dias</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Situação</th>
              </tr>
            </thead>
            <tbody>
              {itensFiltrados.map((it, i) => (
                <tr key={`${it.codigoInterno}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{it.codigo}</td>
                  <td className="px-3 py-1.5 text-slate-600">{it.descricao}</td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{it.grupo}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{fmtInt(it.quantidade)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{fmtCurrency(it.valorUnit)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-800">{fmtCurrency(it.valorTotal)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{it.dias != null ? fmtInt(it.dias) : '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {it.dias === null ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Sem info</span>
                    ) : it.parado ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Parado</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Movimentando</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
          Mostrando {fmtInt(itensFiltrados.length)} itens (máx. 500) de {fmtInt(analise.totalSkus)}.
        </div>
      </div>
    </div>
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
