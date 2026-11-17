import { useEffect, useMemo, useState } from 'react';
import { endOfMonth, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CalendarClock, Check, FileDown, Loader2, Receipt, Save, Users, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import type { Duplicata } from '@/components/DuplicatasReceberDashboard/duplicatasAnalise';
import { analisarMultas, fmtMultasBRL, fmtMultasInt, parseMultas } from './multasAnalise';
import { getMultas, getMultasBaseDate, getMultasMonths, saveMultasBaseDate, type MultasImport } from './multasStorage';
import { exportMultasExcel } from './multasExport';

const panel = 'bg-white border border-slate-200 rounded-xl shadow-sm';
const control = 'border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700';
const monthLabel = (month: string) => format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: ptBR });
const percent = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export function AnaliseMultasTab() {
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState('');
  const [data, setData] = useState<MultasImport | null>(null);
  const [baseDate, setBaseDate] = useState('');
  const [savedBaseDate, setSavedBaseDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [departamento, setDepartamento] = useState('');
  const [cliente, setCliente] = useState('');
  const [status, setStatus] = useState('todos');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getMultasMonths().then(list => {
      if (!active) return;
      setMonths(list);
      setMonth(previous => list.includes(previous) ? previous : list[0] ?? '');
      if (!list.length) setLoading(false);
    }).catch(err => {
      console.error('Erro ao listar meses de multas:', err);
      if (active) { setError('Não foi possível carregar os meses de multas.'); setLoading(false); }
    });
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    if (!month) return;
    let active = true;
    setLoading(true);
    setError('');
    setData(null);
    setDepartamento('');
    setCliente('');
    setStatus('todos');
    setSearch('');
    Promise.all([getMultas(month), getMultasBaseDate(month)]).then(([imported, saved]) => {
      if (!active) return;
      setData(imported);
      setBaseDate(saved ?? format(endOfMonth(parseISO(`${month}-01`)), 'yyyy-MM-dd'));
      setSavedBaseDate(saved ?? '');
    }).catch(err => {
      console.error('Erro ao carregar análise de multas:', err);
      if (active) setError('Não foi possível carregar a posição ou a data-base deste mês.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, retry]);

  const titulos = useMemo(() => data && baseDate ? parseMultas(data, parseISO(baseDate)) : [], [data, baseDate]);
  const departamentos = useMemo(() => [...new Set(titulos.map(titulo => titulo.departamento))].sort(), [titulos]);
  const porDepartamento = useMemo(() =>
    departamento ? titulos.filter(titulo => titulo.departamento === departamento) : titulos,
  [titulos, departamento]);
  const analysis = useMemo(() => analisarMultas(porDepartamento), [porDepartamento]);
  const detalhes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return porDepartamento.filter(titulo => {
      if (cliente && titulo.clienteId !== cliente) return false;
      if (status === 'vencido' && !titulo.vencido) return false;
      if (status === 'avencer' && (!titulo.vencimento || titulo.vencido)) return false;
      if (status === 'semdata' && titulo.vencimento) return false;
      return !query || `${titulo.clienteNome} ${titulo.titulo} ${titulo.duplicata} ${titulo.nomeOrigem}`
        .toLocaleLowerCase('pt-BR').includes(query);
    }).sort((a, b) => (a.vencimento?.getTime() ?? Infinity) - (b.vencimento?.getTime() ?? Infinity));
  }, [porDepartamento, cliente, status, search]);

  const save = async () => {
    setSaving(true);
    try {
      await saveMultasBaseDate(month, baseDate);
      setSavedBaseDate(baseDate);
      toast.success('Data-base salva.');
    } catch (err) {
      console.error('Erro ao salvar data-base de multas:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar a data-base.');
    } finally { setSaving(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportMultasExcel({ month, referenceDate: parseISO(baseDate), titulos });
    } catch (err) {
      console.error('Erro ao exportar multas:', err);
      toast.error('Erro ao gerar o Excel de multas.');
    } finally { setExporting(false); }
  };

  if (loading) return <p className="py-16 text-center text-slate-400">Carregando...</p>;
  if (error) return (
    <div role="alert" className={`${panel} p-6 text-red-700`}>
      <p>{error}</p>
      <button onClick={() => setRetry(value => value + 1)} className="mt-3 text-sm underline">Tentar novamente</button>
    </div>
  );
  if (!data) return (
    <div className={`${panel} py-16 text-center`}>
      <p className="text-slate-600 font-medium">Nenhuma posição de multas disponível para análise.</p>
      <p className="text-sm text-slate-400 mt-1">Importe um TXT na aba “Importação de Arquivo”.</p>
    </div>
  );

  const { kpis } = analysis;
  const saved = baseDate === savedBaseDate;
  const cards = [
    { label: 'Total a receber', value: fmtMultasBRL(kpis.totalReceber), sub: 'Saldo consolidado', icon: Wallet, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Vencido', value: fmtMultasBRL(kpis.totalVencido), sub: `${percent(kpis.percVencido)} do saldo`, icon: AlertTriangle, color: 'text-rose-600 bg-rose-50' },
    { label: 'A vencer', value: fmtMultasBRL(kpis.totalAVencer), sub: 'Inclui vencimento na data-base', icon: CalendarClock, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Títulos', value: fmtMultasInt(kpis.qtdDuplicatas), sub: `Ticket médio: ${fmtMultasBRL(kpis.ticketMedio)}`, icon: Receipt, color: 'text-violet-600 bg-violet-50' },
    { label: 'Clientes', value: fmtMultasInt(kpis.qtdClientes), sub: `Maior título: ${fmtMultasBRL(kpis.maiorDuplicata)}`, icon: Users, color: 'text-sky-600 bg-sky-50' },
  ];

  return (
    <div className="space-y-5">
      <div className={`${panel} p-4 flex flex-wrap items-end gap-4`}>
        <div className="flex flex-col gap-1">
          <label htmlFor="multas-analysis-month" className="text-xs font-medium text-slate-500">Mês de referência</label>
          <select id="multas-analysis-month" value={month} disabled={saving} onChange={e => setMonth(e.target.value)} className={control}>
            {months.map(value => <option key={value} value={value}>{monthLabel(value)}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="multas-base-date" className="text-xs font-medium text-slate-500">Data-base (cálculo dos dias)</label>
          <div className="flex gap-2">
            <input id="multas-base-date" type="date" value={baseDate} disabled={saving} className={control}
              onChange={e => {
                if (e.target.value) setBaseDate(e.target.value);
                else toast.error('Selecione uma data-base válida.');
              }} />
            <button onClick={() => void save()} disabled={saving || saved}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-indigo-600 text-white disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'Salvo' : 'Salvar'}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="multas-dept" className="text-xs font-medium text-slate-500">Departamento</label>
          <select id="multas-dept" value={departamento} onChange={e => { setDepartamento(e.target.value); setCliente(''); }} className={control}>
            <option value="">Todos os departamentos</option>
            {departamentos.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-4">
          <button onClick={() => void handleExport()} disabled={exporting || titulos.length === 0}
            title="Exportar o mês completo, sem os filtros da tela"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {exporting ? 'Gerando...' : 'Exportar Excel'}
          </button>
          <div className="text-right text-xs text-slate-400">
            <p className="font-medium text-slate-700">Posição em {format(parseISO(baseDate), 'dd/MM/yyyy')}</p>
            <p>{data.fileName} · Consolidado</p>
            <p>Vencimento anterior à data-base = vencido</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {cards.map(({ label, value, sub, icon: Icon, color }) => (
          <section key={label} aria-label={label} className={`${panel} p-4 flex gap-3 items-start`}>
            <div className={`p-2 rounded-full ${color}`}><Icon className="w-5 h-5" /></div>
            <div>
              <h3 className="text-xs text-slate-500">{label}</h3>
              <p className="text-lg font-bold text-slate-800">{value}</p>
              <p className="text-xs text-slate-400 mt-1">{sub}</p>
            </div>
          </section>
        ))}
      </div>
      {analysis.semVencimento.qtd > 0 && (
        <p role="status" className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
          {analysis.semVencimento.qtd} títulos sem vencimento ({fmtMultasBRL(analysis.semVencimento.valor)}).
          Incluídos no total, mas fora de vencido, a vencer e faixas de atraso.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section aria-label="Saldo por faixa de atraso" className={`${panel} p-4`}>
          <h3 className="text-sm font-bold text-slate-700 mb-3">Saldo por faixa de atraso</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analysis.faixasVencido} layout="vertical" margin={{ left: 0, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={value => fmtMultasBRL(Number(value))} />
              <YAxis type="category" dataKey="label" width={125} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [fmtMultasBRL(value), 'Saldo vencido']} />
              <Bar dataKey="valor" fill="#e11d48" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section aria-label="Resumo de atraso" className={`${panel} p-4`}>
          <h3 className="text-sm font-bold text-slate-700 mb-3">Prioridades de cobrança</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-slate-500 border-b"><th className="text-left py-2">Atraso</th><th className="text-right">Títulos</th><th className="text-right">Valor</th></tr></thead>
            <tbody>{analysis.faixasVencido.map(faixa => (
              <tr key={faixa.label} className="border-b border-slate-100">
                <td className="py-3 text-slate-700">{faixa.label}</td>
                <td className="text-right tabular-nums text-slate-600">{faixa.qtd}</td>
                <td className="text-right tabular-nums font-medium text-rose-600">{fmtMultasBRL(faixa.valor)}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      </div>

      <section aria-label="Clientes com maiores saldos" className={`${panel} p-4 overflow-auto`}>
        <h3 className="text-sm font-bold text-slate-700">Top 10 clientes com maiores saldos</h3>
        <p className="text-xs text-slate-400 mt-1 mb-3">Clique no cliente para filtrar os títulos detalhados abaixo.</p>
        <table className="w-full text-sm">
          <thead><tr className="text-slate-500 border-b"><th className="text-left py-2">Cliente</th><th className="text-right">Títulos</th><th className="text-right">Saldo</th></tr></thead>
          <tbody>{analysis.topClientes.slice(0, 10).map(item => (
            <tr key={item.clienteId} className="border-b border-slate-100">
              <td className="py-2"><button onClick={() => { setCliente(item.clienteId); setStatus('todos'); setSearch(''); }} className="text-left text-indigo-700 hover:underline">{item.clienteNome}</button></td>
              <td className="text-right tabular-nums">{item.qtd}</td>
              <td className="text-right tabular-nums font-medium">{fmtMultasBRL(item.total)}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>

      <section aria-label="Títulos detalhados" className={`${panel} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-3 items-center">
          <h3 className="text-sm font-bold text-slate-700">Títulos detalhados</h3>
          {cliente && <button onClick={() => setCliente('')} className="text-xs text-indigo-700 underline">Limpar filtro de cliente</button>}
          <input aria-label="Buscar títulos" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, título ou origem..." className={`${control} ml-auto w-full sm:w-72`} />
          <select aria-label="Situação dos títulos" value={status} onChange={e => setStatus(e.target.value)} className={control}>
            <option value="todos">Todas as situações</option><option value="vencido">Vencidos</option>
            <option value="avencer">A vencer</option><option value="semdata">Sem vencimento</option>
          </select>
        </div>
        <p className="px-4 pt-3 text-xs text-slate-400">Busca, situação e cliente filtram somente esta tabela.</p>
        <TitulosTable titulos={detalhes} />
        <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
          {fmtMultasInt(detalhes.length)} títulos · Saldo exibido: {fmtMultasBRL(detalhes.reduce((total, titulo) => total + titulo.valor, 0))}
        </p>
      </section>
    </div>
  );
}

function TitulosTable({ titulos }: { titulos: Duplicata[] }) {
  return (
    <div className="overflow-auto max-h-[60vh]">
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="sticky top-0 bg-indigo-600 text-white">
          <tr>{['Cliente', 'Departamento', 'Título / Parcela', 'Origem', 'Vencimento', 'Dias de atraso', 'Valor', 'Situação'].map(label =>
            <th key={label} className="text-left px-3 py-2">{label}</th>)}</tr>
        </thead>
        <tbody>
          {titulos.length === 0 ? <tr><td colSpan={8} className="text-center text-slate-400 py-8">Nenhum título encontrado.</td></tr>
            : titulos.map((titulo, i) => (
              <tr key={`${titulo.clienteId}-${titulo.titulo}-${titulo.duplicata}-${i}`} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                <td className="px-3 py-2 text-slate-700">{titulo.clienteNome}</td>
                <td className="px-3 py-2 text-slate-500">{titulo.departamento}</td>
                <td className="px-3 py-2">{titulo.titulo} / {titulo.duplicata || '—'}</td>
                <td className="px-3 py-2 text-slate-500">{titulo.nomeOrigem || '—'}</td>
                <td className="px-3 py-2">{titulo.vencimento ? format(titulo.vencimento, 'dd/MM/yyyy') : '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{titulo.vencimento ? titulo.diasAtraso : '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtMultasBRL(titulo.valor)}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs rounded-full px-2 py-1 ${!titulo.vencimento ? 'bg-amber-50 text-amber-700' : titulo.vencido ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {!titulo.vencimento ? 'Sem vencimento' : titulo.vencido ? 'Vencido' : 'A vencer'}
                  </span>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
