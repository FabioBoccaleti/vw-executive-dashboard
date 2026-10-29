import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Loader2, Wallet, AlertTriangle, CalendarClock,
  Users, Receipt, TrendingUp, Filter,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { DuplicatasMarca } from './DuplicatasReceberDashboard';
import {
  getAvailableMonths, getDuplicatas, getDepartamentoMap, type DuplicatasImport, type DepartamentoMap,
} from './duplicatasStorage';
import {
  parseDuplicatas, analyze, resumoPorDepartamento, startOfDay,
  type Duplicata, type FaixaResult, type ClienteResumo, type DeptResumo,
} from './duplicatasAnalise';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  const idx = Number(m) - 1;
  return idx >= 0 && idx <= 11 ? `${MONTH_NAMES[idx]} de ${y}` : month;
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtInt = (v: number) => v.toLocaleString('pt-BR');
const fmtPerc = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const fmtBRLshort = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return fmtBRL(v);
};
function fmtDateBR(d: Date | null): string {
  if (!d) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

interface Props {
  marca: DuplicatasMarca;
}

const TOP_N = 10;

export function AnaliseDuplicatasTab({ marca }: Props) {
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState<string>('');
  const [data, setData] = useState<DuplicatasImport | null>(null);
  const [map, setMap] = useState<DepartamentoMap>({});
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState<string>('__todos__');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const referenceDate = useMemo(() => startOfDay(new Date()), []);

  useEffect(() => {
    let cancelled = false;
    void getAvailableMonths(marca.id).then((list) => {
      if (cancelled) return;
      setMonths(list);
      setMonth((prev) => (prev && list.includes(prev) ? prev : list[0] ?? ''));
    });
    return () => { cancelled = true; };
  }, [marca.id]);

  const loadData = useCallback(async () => {
    if (!month) { setData(null); setLoading(false); return; }
    setLoading(true);
    try {
      const [imp, deptMap] = await Promise.all([getDuplicatas(marca.id, month), getDepartamentoMap(marca.id)]);
      setData(imp);
      setMap(deptMap);
    } finally {
      setLoading(false);
    }
  }, [marca.id, month]);

  useEffect(() => { void loadData(); }, [loadData]);

  const duplicatas = useMemo<Duplicata[]>(
    () => (data ? parseDuplicatas(data, map, referenceDate) : []),
    [data, map, referenceDate],
  );

  const resumoDept = useMemo(() => resumoPorDepartamento(duplicatas), [duplicatas]);
  const departamentosDisponiveis = useMemo(() => resumoDept.map((r) => r.departamento), [resumoDept]);

  useEffect(() => {
    if (deptFilter !== '__todos__' && !departamentosDisponiveis.includes(deptFilter)) {
      setDeptFilter('__todos__');
    }
  }, [departamentosDisponiveis, deptFilter]);

  const filtradas = useMemo(
    () => (deptFilter === '__todos__' ? duplicatas : duplicatas.filter((d) => d.departamento === deptFilter)),
    [duplicatas, deptFilter],
  );
  const analysis = useMemo(() => analyze(filtradas), [filtradas]);

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  if (loading) {
    return (
      <div className="mt-4 flex items-center justify-center py-16 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Carregando...
      </div>
    );
  }

  if (!month || !data) {
    return (
      <div className="mt-4 bg-white border border-slate-200 rounded-xl shadow-sm py-16 text-center">
        <p className="text-slate-600 font-medium">Nenhuma duplicata importada para {marca.name}.</p>
        <p className="text-sm text-slate-400 mt-1">Importe um arquivo na aba "Importação de Arquivo" para ver a análise.</p>
      </div>
    );
  }

  const semClassificacao = Object.keys(map).length === 0;

  return (
    <div className="mt-4 space-y-5">
      {/* Controles */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Mês de referência</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as string]: marca.primary }}
          >
            {months.map((m) => (<option key={m} value={m}>{formatMonthLabel(m)}</option>))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Departamento
          </label>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 min-w-[200px]"
            style={{ ['--tw-ring-color' as string]: marca.primary }}
          >
            <option value="__todos__">Todos os departamentos</option>
            {departamentosDisponiveis.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm font-medium text-slate-700">Posição em {fmtDateBR(referenceDate)}</p>
          <p className="text-xs text-slate-400">Vencido/a vencer calculado por DTA_VENCIMENTO</p>
        </div>
      </div>

      {semClassificacao && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Nenhum departamento classificado ainda. Use a aba "Parâmetros" para classificar — por enquanto tudo aparece como "Não classificado".
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<Wallet className="w-5 h-5 text-sky-600" />} accent="bg-sky-50" label="Total a receber" value={fmtBRL(analysis.kpis.totalReceber)} />
        <KpiCard icon={<AlertTriangle className="w-5 h-5 text-rose-600" />} accent="bg-rose-50" label="Vencido" value={fmtBRL(analysis.kpis.totalVencido)} sub={`${fmtPerc(analysis.kpis.percVencido)} do total`} />
        <KpiCard icon={<CalendarClock className="w-5 h-5 text-emerald-600" />} accent="bg-emerald-50" label="A vencer" value={fmtBRL(analysis.kpis.totalAVencer)} />
        <KpiCard icon={<Receipt className="w-5 h-5 text-indigo-600" />} accent="bg-indigo-50" label="Duplicatas" value={fmtInt(analysis.kpis.qtdDuplicatas)} sub={`${fmtInt(analysis.kpis.qtdClientes)} clientes`} />
        <KpiCard icon={<TrendingUp className="w-5 h-5 text-violet-600" />} accent="bg-violet-50" label="Ticket médio" value={fmtBRL(analysis.kpis.ticketMedio)} />
        <KpiCard icon={<Receipt className="w-5 h-5 text-amber-600" />} accent="bg-amber-50" label="Maior duplicata" value={fmtBRL(analysis.kpis.maiorDuplicata)} />
      </div>

      {/* Resumo por departamento + gráfico */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ResumoDepartamentoTable
          rows={resumoDept}
          marca={marca}
          activeFilter={deptFilter}
          onSelect={(dep) => setDeptFilter((prev) => (prev === dep ? '__todos__' : dep))}
        />
        <DeptChart rows={resumoDept} />
      </div>

      {/* Aging */}
      <div className="grid gap-5 lg:grid-cols-2">
        <FaixasTable
          title="Vencidos por faixa de atraso"
          subtitle="Dias de atraso = hoje − DTA_VENCIMENTO"
          faixas={analysis.faixasVencido}
          total={analysis.kpis.totalVencido}
          groupKey="fv"
          accentClass="text-rose-700"
          expanded={expanded}
          toggle={toggle}
        />
        <FaixasTable
          title="A vencer por faixa"
          subtitle="Dias até vencer = DTA_VENCIMENTO − hoje"
          faixas={analysis.faixasAVencer}
          total={analysis.kpis.totalAVencer}
          groupKey="fa"
          accentClass="text-emerald-700"
          expanded={expanded}
          toggle={toggle}
        />
      </div>

      {/* Top clientes */}
      <TopClientesTable
        title="Maiores clientes a receber"
        icon={<Users className="w-4 h-4" />}
        clientes={analysis.topClientes}
        valueOf={(c) => c.total}
        valueLabel="Total a receber"
        groupKey="tc"
        expanded={expanded}
        toggle={toggle}
      />
      <TopClientesTable
        title="Maiores clientes com valor vencido"
        icon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
        clientes={analysis.topClientesVencido}
        valueOf={(c) => c.vencido}
        valueLabel="Valor vencido"
        groupKey="tv"
        expanded={expanded}
        toggle={toggle}
      />
    </div>
  );
}

// ─── KPI ──────────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, accent, sub }: { icon: React.ReactNode; label: string; value: string; accent: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${accent}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-800 tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Resumo por departamento ────────────────────────────────────────────────
function ResumoDepartamentoTable({ rows, marca, activeFilter, onSelect }: {
  rows: DeptResumo[];
  marca: DuplicatasMarca;
  activeFilter: string;
  onSelect: (dep: string) => void;
}) {
  const totals = rows.reduce((a, r) => ({ qtd: a.qtd + r.qtd, total: a.total + r.total, vencido: a.vencido + r.vencido, aVencer: a.aVencer + r.aVencer }), { qtd: 0, total: 0, vencido: 0, aVencer: 0 });
  const percTotal = totals.total > 0 ? (totals.vencido / totals.total) * 100 : 0;
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-700 mb-2">Resumo por departamento</h3>
      <div className="overflow-auto border border-slate-200 rounded-lg">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Departamento</th>
              <th className="text-right px-3 py-2">Dupl.</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-right px-3 py-2">Vencido</th>
              <th className="text-right px-3 py-2">A vencer</th>
              <th className="text-right px-3 py-2">% Venc.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const active = activeFilter === r.departamento;
              return (
                <tr
                  key={r.departamento}
                  onClick={() => onSelect(r.departamento)}
                  className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                  style={active ? { backgroundColor: marca.primaryLight } : undefined}
                >
                  <td className="px-3 py-1.5 font-medium text-slate-700">{r.departamento}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(r.qtd)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(r.total)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-rose-600">{fmtBRL(r.vencido)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">{fmtBRL(r.aVencer)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtPerc(r.percVencido)}</td>
                </tr>
              );
            })}
            <tr className="bg-sky-50 font-bold border-t border-slate-200">
              <td className="px-3 py-1.5">Total</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(totals.qtd)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(totals.total)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-rose-700">{fmtBRL(totals.vencido)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">{fmtBRL(totals.aVencer)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtPerc(percTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400 mt-1">Clique num departamento para filtrar as análises abaixo.</p>
    </div>
  );
}

// ─── Gráfico ─────────────────────────────────────────────────────────────────
function DeptChart({ rows }: { rows: DeptResumo[] }) {
  const chartData = rows.map((r) => ({ nome: r.departamento, Vencido: r.vencido, 'A vencer': r.aVencer }));
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-700 mb-2">Vencido × A vencer por departamento</h3>
      <div className="border border-slate-200 rounded-lg bg-white p-3" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtBRLshort(Number(v))} width={70} />
            <Tooltip formatter={(v: number) => fmtBRL(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="A vencer" stackId="a" fill="#10b981" />
            <Bar dataKey="Vencido" stackId="a" fill="#f43f5e" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Faixas de aging ─────────────────────────────────────────────────────────
function FaixasTable({ title, subtitle, faixas, total, groupKey, accentClass, expanded, toggle }: {
  title: string;
  subtitle: string;
  faixas: FaixaResult[];
  total: number;
  groupKey: string;
  accentClass: string;
  expanded: Record<string, boolean>;
  toggle: (key: string) => void;
}) {
  const totalQtd = faixas.reduce((s, f) => s + f.qtd, 0);
  return (
    <div>
      <h3 className={`text-sm font-bold ${accentClass}`}>{title}</h3>
      <p className="text-xs text-slate-400 mb-2">{subtitle}</p>
      <div className="overflow-hidden border border-slate-200 rounded-lg">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 w-8"></th>
              <th className="text-left px-3 py-2">Faixa</th>
              <th className="text-right px-3 py-2">Duplicatas</th>
              <th className="text-right px-3 py-2">Valor</th>
            </tr>
          </thead>
          <tbody>
            {faixas.map((f, index) => {
              const key = `${groupKey}:${index}`;
              const isOpen = expanded[key];
              const canExpand = f.clientes.length > 0;
              return (
                <Fragment key={key}>
                  <tr
                    className={`border-t border-slate-100 ${canExpand ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                    onClick={() => canExpand && toggle(key)}
                  >
                    <td className="px-3 py-1.5 text-slate-400">
                      {canExpand ? (isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : null}
                    </td>
                    <td className="px-3 py-1.5 font-medium text-slate-700">{f.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(f.qtd)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(f.valor)}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td></td>
                      <td colSpan={3} className="px-3 py-2 bg-slate-50">
                        <table className="min-w-full text-[11px]">
                          <thead className="text-slate-500">
                            <tr>
                              <th className="text-left px-2 py-1">Cliente</th>
                              <th className="text-right px-2 py-1">Duplicatas</th>
                              <th className="text-right px-2 py-1">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {f.clientes.map((c) => (
                              <tr key={c.clienteId} className="border-t border-slate-200">
                                <td className="px-2 py-1">{c.clienteNome}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{fmtInt(c.qtd)}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(c.valor)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            <tr className="bg-sky-50 font-bold border-t border-slate-200">
              <td></td>
              <td className="px-3 py-1.5">Total</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(totalQtd)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Top clientes ────────────────────────────────────────────────────────────
function TopClientesTable({ title, icon, clientes, valueOf, valueLabel, groupKey, expanded, toggle }: {
  title: string;
  icon: React.ReactNode;
  clientes: ClienteResumo[];
  valueOf: (c: ClienteResumo) => number;
  valueLabel: string;
  groupKey: string;
  expanded: Record<string, boolean>;
  toggle: (key: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? clientes : clientes.slice(0, TOP_N);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">{icon}{title}</h3>
        {clientes.length > TOP_N && (
          <button
            type="button"
            onClick={() => setShowAll((p) => !p)}
            className="text-xs font-medium text-sky-700 border border-sky-200 rounded-md px-3 py-1.5 hover:bg-sky-50"
          >
            {showAll ? `Ver top ${TOP_N}` : `Ver todos (${fmtInt(clientes.length)})`}
          </button>
        )}
      </div>
      <div className="overflow-hidden border border-slate-200 rounded-lg">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 w-8"></th>
              <th className="text-left px-3 py-2 w-8">#</th>
              <th className="text-left px-3 py-2">Cliente</th>
              <th className="text-right px-3 py-2">Duplicatas</th>
              <th className="text-right px-3 py-2">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">Nenhum cliente neste grupo.</td></tr>
            ) : visible.map((c, i) => {
              const key = `${groupKey}:${c.clienteId}`;
              const isOpen = expanded[key];
              return (
                <Fragment key={key}>
                  <tr className="border-t border-slate-100 cursor-pointer hover:bg-slate-50" onClick={() => toggle(key)}>
                    <td className="px-3 py-1.5 text-slate-400">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                    <td className="px-3 py-1.5 text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium text-slate-700">{c.clienteNome}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(c.qtd)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(valueOf(c))}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td></td>
                      <td colSpan={4} className="px-3 py-2 bg-slate-50">
                        <table className="min-w-full text-[11px]">
                          <thead className="text-slate-500">
                            <tr>
                              <th className="text-left px-2 py-1">Departamento</th>
                              <th className="text-left px-2 py-1">Duplicata</th>
                              <th className="text-left px-2 py-1">Vencimento</th>
                              <th className="text-left px-2 py-1">Situação</th>
                              <th className="text-right px-2 py-1">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.duplicatas.map((d, di) => (
                              <tr key={`${d.duplicata}-${di}`} className="border-t border-slate-200">
                                <td className="px-2 py-1">{d.departamento}</td>
                                <td className="px-2 py-1">{d.duplicata || d.titulo || '—'}</td>
                                <td className="px-2 py-1 tabular-nums">{fmtDateBR(d.vencimento)}</td>
                                <td className="px-2 py-1">
                                  {d.vencido
                                    ? <span className="text-rose-600 font-medium">Vencida ({fmtInt(d.diasAtraso)}d)</span>
                                    : <span className="text-emerald-700">A vencer</span>}
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(d.valor)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
