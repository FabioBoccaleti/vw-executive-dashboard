import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Plus, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadVendasResultadoRows,
  saveVendasResultadoRows,
  emptyVendasResultadoRow,
  type VendasResultadoRow,
} from '@/components/VendasBonificacoesDashboard/vendasResultadoStorage';
import { loadAliquotas } from '@/components/VendasBonificacoesDashboard/vendedoresRemuneracaoStorage';
import {
  loadLancamentos,
  type LancamentosMap,
} from './comissoesLancamentosStorage';

// ─── Constantes ───────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'] as const;
const AVAILABLE_YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function n(v: string | undefined): number {
  return parseFloat(String(v ?? '').replace(',', '.')) || 0;
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

function fmtDate(d: string): string {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

function calcImpostosUsados(valorVenda: number, valorCusto: number): number {
  const parte1 = valorVenda * 0.018;
  const base   = valorVenda - valorCusto - parte1;
  return parte1 + (base > 0 ? base * 0.0365 : 0);
}

function rowPeriod(r: VendasResultadoRow): { year: number; month: number } | null {
  if (r.periodoImport) {
    const [y, m] = r.periodoImport.split('-').map(Number);
    if (y > 2000 && m >= 1 && m <= 12) return { year: y, month: m };
  }
  const d = r.dataVenda;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return { year: parseInt(d.split('/')[2]), month: parseInt(d.split('/')[1]) };
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return { year: parseInt(d.split('-')[0]), month: parseInt(d.split('-')[1]) };
  return null;
}

function calcDerived(row: VendasResultadoRow, isUsados: boolean, aliquotaBonPct: number) {
  const valorVenda   = n(row.valorVenda);
  const valorCusto   = n(row.valorCusto);
  const bonusVarejo  = n(row.bonusVarejo);
  const bonusTradeIn = n(row.bonusTradeIn);

  const impostos = isUsados
    ? calcImpostosUsados(valorVenda, valorCusto)
    : n(row.impostos);

  const recLiq = valorVenda - impostos;

  const impBonus = isUsados
    ? bonusVarejo * (aliquotaBonPct / 100)
    : (bonusVarejo + bonusTradeIn) * (aliquotaBonPct / 100);

  const lucroBruto = isUsados
    ? recLiq - valorCusto + bonusVarejo - impBonus
    : recLiq - valorCusto + bonusVarejo + bonusTradeIn - impBonus;

  const lucroBrutoPct = recLiq !== 0 ? (lucroBruto / recLiq) * 100 : 0;

  return { impostos, recLiq, impBonus, lucroBruto, lucroBrutoPct };
}

// ─── Célula com cor para negativos ───────────────────────────────────────────
function NumCell({ value, pct = false }: { value: number; pct?: boolean }) {
  const text = pct ? fmtPct(value) : fmtBRL(value);
  const color = value < 0 ? 'text-red-600' : value === 0 ? 'text-slate-400' : 'text-slate-800';
  return <span className={`font-mono text-xs ${color}`}>{text}</span>;
}

// ─── Totais do rodapé ─────────────────────────────────────────────────────────
function sumRows(rows: VendasResultadoRow[], isUsados: boolean, aliquotaBonPct: number) {
  let totVenda = 0, totImpostos = 0, totRecLiq = 0, totCusto = 0;
  let totBonVarejo = 0, totBonTrade = 0, totImpBonus = 0, totLB = 0;

  for (const r of rows) {
    const d = calcDerived(r, isUsados, aliquotaBonPct);
    totVenda     += n(r.valorVenda);
    totImpostos  += d.impostos;
    totRecLiq    += d.recLiq;
    totCusto     += n(r.valorCusto);
    totBonVarejo += n(r.bonusVarejo);
    totBonTrade  += n(r.bonusTradeIn);
    totImpBonus  += d.impBonus;
    totLB        += d.lucroBruto;
  }

  const totLBPct = totRecLiq !== 0 ? (totLB / totRecLiq) * 100 : 0;
  return { totVenda, totImpostos, totRecLiq, totCusto, totBonVarejo, totBonTrade, totImpBonus, totLB, totLBPct };
}

// ─── Form de linha manual ─────────────────────────────────────────────────────
type RowForm = {
  chassi: string; modelo: string; nfVenda: string; dataVenda: string;
  vendedor: string; transacao: string; valorVenda: string; impostos: string;
  valorCusto: string; bonusVarejo: string; bonusTradeIn: string;
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface ComissoesVendasViewProps {
  tab: 'novos' | 'usados';
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function ComissoesVendasView({ tab }: ComissoesVendasViewProps) {
  const isUsados = tab === 'usados';

  const [filterYear, setFilterYear]   = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [rows, setRows]               = useState<VendasResultadoRow[]>([]);
  const [aliquotaBonPct, setAliquotaBonPct] = useState(0);
  const [lancamentosMap, setLancamentosMap] = useState<LancamentosMap>({});
  const [loading, setLoading]         = useState(true);
  const [rowDialog, setRowDialog]     = useState<{ open: boolean; editId: string | null; form: RowForm }>({
    open: false, editId: null, form: {
      chassi: '', modelo: '', nfVenda: '', dataVenda: '',
      vendedor: '', transacao: '',
      valorVenda: '', impostos: '', valorCusto: '', bonusVarejo: '', bonusTradeIn: '',
    },
  });
  const [savingRow, setSavingRow]     = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadVendasResultadoRows(tab), loadAliquotas(), loadLancamentos(tab)])
      .then(([vendasRows, aliquotas, lancs]) => {
        setRows(vendasRows);
        setAliquotaBonPct(aliquotas.reduce((acc, i) => acc + (parseFloat(i.aliquota) || 0), 0));
        setLancamentosMap(lancs);
      })
      .finally(() => setLoading(false));
  }, [tab]);

  const filteredRows = useMemo(() =>
    rows.filter(r => {
      const p = rowPeriod(r);
      if (!p) return false;
      if (p.year !== filterYear) return false;
      if (filterMonth !== null && p.month !== filterMonth) return false;
      return true;
    }),
  [rows, filterYear, filterMonth]);

  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    rows.forEach(r => {
      const p = rowPeriod(r);
      if (!p || p.year !== filterYear) return;
      counts[p.month] = (counts[p.month] || 0) + 1;
    });
    return counts;
  }, [rows, filterYear]);

  const totals = useMemo(
    () => sumRows(filteredRows, isUsados, aliquotaBonPct),
    [filteredRows, isUsados, aliquotaBonPct],
  );

  // Mapa global chassi → info de comissão (varre todos os períodos)
  // Resolve o mismatch entre competência do lançamento e dataVenda da linha
  const chassiToLanc = useMemo(() => {
    const map = new Map<string, { pago: boolean; dataPagamento?: string; comVenda: number; comLB: number }>();
    Object.values(lancamentosMap).forEach(vendedoresObj => {
      Object.values(vendedoresObj).forEach(lanc => {
        Object.entries(lanc.linhas ?? {}).forEach(([chassi, linha]) => {
          if (chassi) map.set(chassi, {
            pago:          lanc.pago,
            dataPagamento: lanc.dataPagamento,
            comVenda:      linha.comVenda,
            comLB:         linha.comLB,
          });
        });
      });
    });
    return map;
  }, [lancamentosMap]);

  const totComissao = useMemo(() => {
    let total = 0;
    filteredRows.forEach(row => {
      const info = chassiToLanc.get(row.chassi ?? '');
      if (info) total += info.comVenda + info.comLB;
    });
    return total;
  }, [filteredRows, lancamentosMap]);
  const vendedoresList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.vendedor) set.add(r.vendedor); });
    return Array.from(set).sort();
  }, [rows]);

  // ─── Handlers de linha manual ─────────────────────────────────────────────────────
  function openAddDialog() {
    setRowDialog({ open: true, editId: null, form: {
      chassi: '', modelo: '', nfVenda: '', dataVenda: '',
      vendedor: '', transacao: isUsados ? 'U21' : 'V21',
      valorVenda: '', impostos: '', valorCusto: '', bonusVarejo: '', bonusTradeIn: '',
    }});
  }

  function openEditDialog(row: VendasResultadoRow) {
    setRowDialog({ open: true, editId: row.id, form: {
      chassi:       row.chassi,
      modelo:       row.modelo,
      nfVenda:      row.nfVenda,
      dataVenda:    row.dataVenda,
      vendedor:     row.vendedor,
      transacao:    row.transacao,
      valorVenda:   row.valorVenda,
      impostos:     row.impostos,
      valorCusto:   row.valorCusto,
      bonusVarejo:  row.bonusVarejo,
      bonusTradeIn: row.bonusTradeIn,
    }});
  }

  async function handleSaveRow() {
    const { form, editId } = rowDialog;
    setSavingRow(true);
    try {
      const newRow: VendasResultadoRow = {
        ...emptyVendasResultadoRow(),
        id:           editId ?? crypto.randomUUID(),
        chassi:       form.chassi,
        modelo:       form.modelo,
        nfVenda:      form.nfVenda,
        dataVenda:    form.dataVenda,
        vendedor:     form.vendedor,
        transacao:    form.transacao,
        valorVenda:   form.valorVenda,
        impostos:     form.impostos,
        valorCusto:   form.valorCusto,
        bonusVarejo:  form.bonusVarejo,
        bonusTradeIn: form.bonusTradeIn,
        manualEntry:  true,
      };
      const updated = editId
        ? rows.map(r => r.id === editId ? newRow : r)
        : [...rows, newRow];
      await saveVendasResultadoRows(tab, updated);
      setRows(updated);
      setRowDialog(prev => ({ ...prev, open: false }));
      toast.success(editId ? 'Linha atualizada.' : 'Linha incluída.');
    } catch {
      toast.error('Erro ao salvar.');
    } finally {
      setSavingRow(false);
    }
  }

  async function handleDeleteRow(id: string) {
    try {
      const updated = rows.filter(r => r.id !== id);
      await saveVendasResultadoRows(tab, updated);
      setRows(updated);
      toast.success('Linha removida.');
    } catch {
      toast.error('Erro ao remover.');
    }
  }
  // ─── Estilos de header por grupo ────────────────────────────────────────────
  const thId  = 'bg-slate-700 text-white px-3 py-2 text-xs font-semibold whitespace-nowrap border-r border-slate-600 text-left';
  const thFin = 'bg-emerald-700 text-white px-3 py-2 text-xs font-semibold whitespace-nowrap border-r border-emerald-600 text-right';
  const thLB  = 'bg-blue-700 text-white px-3 py-2 text-xs font-semibold whitespace-nowrap border-r border-blue-600 text-right';
  const thRes  = 'bg-teal-700 text-white px-3 py-2 text-xs font-semibold whitespace-nowrap border-r border-teal-600 text-right';
  const thComm = 'bg-violet-700 text-white px-3 py-2 text-xs font-semibold whitespace-nowrap border-r border-violet-600 text-left';

  const tdBase = 'border-b border-slate-100 align-middle px-2 py-1.5';
  const tdL    = `${tdBase} text-left`;
  const tdR    = `${tdBase} text-right`;

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>

      {/* ── Seletor Ano / Mês ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 flex-shrink-0 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">ANO</span>
        <div className="relative mr-2">
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            className="appearance-none text-sm font-bold text-slate-700 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
          >
            {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="w-px h-5 bg-slate-200 mr-1" />
        <button
          onClick={() => setFilterMonth(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterMonth === null ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
        >
          Ano todo
        </button>
        {MONTHS.map((name, idx) => {
          const m = idx + 1;
          const count = monthCounts[m] ?? 0;
          const isActive = filterMonth === m;
          const hasData = count > 0;
          return (
            <button
              key={m}
              onClick={() => setFilterMonth(m)}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : hasData
                  ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  : 'text-slate-300 cursor-default'
              }`}
            >
              {name}
              {hasData && (
                <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 rounded-full leading-none py-0.5 ${
                  isActive ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        <div className="ml-auto">
          <button
            onClick={openAddDialog}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Incluir Linha
          </button>
        </div>
      </div>

      {/* ── Tabela ──────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Carregando...</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="bg-slate-700 border-r border-slate-600" style={{ width: '44px' }} />
                {/* Identificação */}
                <th className={thId}>Chassi</th>
                <th className={thId}>Modelo</th>
                <th className={thId}>NF Venda</th>
                <th className={thId}>Data da Venda</th>
                <th className={thId}>Vendedor</th>
                <th className={thId}>Transação</th>
                {/* Financeiro */}
                <th className={thFin}>Valor Venda</th>
                <th className={thFin}>Impostos</th>
                <th className={thFin}>Rec. Líquida</th>
                {/* Lucro Bruto */}
                <th className={thLB}>Valor Custo</th>
                <th className={thLB}>Bônus Varejo</th>
                <th className={thLB}>Bônus Trade IN</th>
                <th className={thLB}>(-) Imp. s/ Bônus</th>
                {/* Resultado */}
                <th className={thRes}>Lucro Bruto</th>
                <th className={thRes}>% LB</th>
                {/* Comissão */}
                <th className={thComm}>Valor Comissão</th>
                <th className={thComm}>Situação da Comissão</th>
                <th className={thComm}>Data Pgto Comissão</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={19} className="text-center py-16 text-slate-400 text-sm">
                    Nenhum registro encontrado para o período selecionado
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, ri) => {
                  const d   = calcDerived(row, isUsados, aliquotaBonPct);
                  const bg  = ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
                  const tdd = `${tdL} ${bg}`;
                  const tdr = `${tdR} ${bg}`;

                  const period = rowPeriod(row);
                  const info           = chassiToLanc.get(row.chassi ?? '');
                  const valorComissao  = info ? info.comVenda + info.comLB : null;
                  const situacao       = info ? (info.pago ? 'Pago' : 'Pendente de Pagamento') : null;
                  const dataPgto       = info?.pago && info.dataPagamento ? info.dataPagamento : null;
                  void period;

                  return (
                    <tr key={row.id} className={`${bg} hover:bg-emerald-50/40 transition-colors`}>
                      <td className={`${tdBase} ${bg} px-1.5`}>
                        {row.manualEntry && (
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => openEditDialog(row)} className="p-1 rounded hover:bg-emerald-100 text-emerald-600 transition-colors" title="Editar">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleDeleteRow(row.id)} className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors" title="Excluir">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className={tdd}>{row.chassi || '—'}</td>
                      <td className={tdd}>{row.modelo || '—'}</td>
                      <td className={tdd}>{row.nfVenda || '—'}</td>
                      <td className={tdd}>{row.dataVenda || '—'}</td>
                      <td className={tdd}>{row.vendedor || '—'}</td>
                      <td className={tdd}>{row.transacao || '—'}</td>
                      <td className={tdr}><NumCell value={n(row.valorVenda)} /></td>
                      <td className={tdr}><NumCell value={d.impostos} /></td>
                      <td className={tdr}><NumCell value={d.recLiq} /></td>
                      <td className={tdr}><NumCell value={n(row.valorCusto)} /></td>
                      <td className={tdr}><NumCell value={n(row.bonusVarejo)} /></td>
                      <td className={tdr}><NumCell value={n(row.bonusTradeIn)} /></td>
                      <td className={tdr}><NumCell value={d.impBonus} /></td>
                      <td className={tdr}><NumCell value={d.lucroBruto} /></td>
                      <td className={tdr}><NumCell value={d.lucroBrutoPct} pct /></td>
                      <td className={`${tdBase} ${bg} text-right`}>
                        {valorComissao !== null
                          ? <NumCell value={valorComissao} />
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className={`${tdBase} ${bg} text-left`}>
                        {situacao ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${
                            info?.pago
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-amber-50 border-amber-200 text-amber-700'
                          }`}>
                            {situacao}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className={`${tdBase} ${bg} text-left`}>
                        {dataPgto
                          ? <span className="font-mono text-xs text-slate-600">{fmtDate(dataPgto)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* ── Rodapé de totais ─────────────────────────────────────────── */}
            {filteredRows.length > 0 && (
              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-slate-800 text-white font-semibold text-xs">
                  <td colSpan={7} className="px-3 py-2 text-right border-r border-slate-700">
                    Total ({filteredRows.length} reg.)
                  </td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(totals.totVenda)}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(totals.totImpostos)}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(totals.totRecLiq)}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(totals.totCusto)}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(totals.totBonVarejo)}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(totals.totBonTrade)}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmtBRL(totals.totImpBonus)}</td>
                  <td className={`px-2 py-2 text-right font-mono ${totals.totLB < 0 ? 'text-red-300' : ''}`}>
                    {fmtBRL(totals.totLB)}
                  </td>
                  <td className={`px-2 py-2 text-right font-mono ${totals.totLBPct < 0 ? 'text-red-300' : ''}`}>
                    {fmtPct(totals.totLBPct)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {totComissao !== 0 ? fmtBRL(totComissao) : '—'}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {/* ── Dialog de linha manual ──────────────────────────────────────────── */}
      {rowDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRowDialog(prev => ({ ...prev, open: false }))} />
          <div
            className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-slate-800">
                {rowDialog.editId ? 'Editar Linha' : 'Incluir Linha'}
              </h3>
              <button
                onClick={() => setRowDialog(prev => ({ ...prev, open: false }))}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Chassi</label>
                <input type="text" value={rowDialog.form.chassi}
                  onChange={e => setRowDialog(prev => ({ ...prev, form: { ...prev.form, chassi: e.target.value } }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Modelo</label>
                <input type="text" value={rowDialog.form.modelo}
                  onChange={e => setRowDialog(prev => ({ ...prev, form: { ...prev.form, modelo: e.target.value } }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">NF Venda</label>
                <input type="text" value={rowDialog.form.nfVenda}
                  onChange={e => setRowDialog(prev => ({ ...prev, form: { ...prev.form, nfVenda: e.target.value } }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data da Venda</label>
                <input type="date" value={rowDialog.form.dataVenda}
                  onChange={e => setRowDialog(prev => ({ ...prev, form: { ...prev.form, dataVenda: e.target.value } }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Vendedor</label>
                <select value={rowDialog.form.vendedor}
                  onChange={e => setRowDialog(prev => ({ ...prev, form: { ...prev.form, vendedor: e.target.value } }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                  <option value="">Selecione...</option>
                  {vendedoresList.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Transação</label>
                <select value={rowDialog.form.transacao}
                  onChange={e => setRowDialog(prev => ({ ...prev, form: { ...prev.form, transacao: e.target.value } }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                  {isUsados
                    ? <><option value="U21">U21</option><option value="U07">U07</option></>
                    : <><option value="V21">V21</option><option value="V07">V07</option></>
                  }
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Valor Venda</label>
                <input type="text" inputMode="decimal" value={rowDialog.form.valorVenda}
                  onChange={e => setRowDialog(prev => ({ ...prev, form: { ...prev.form, valorVenda: e.target.value } }))}
                  placeholder="0,00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono text-right" />
              </div>
              {!isUsados && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Impostos</label>
                  <input type="text" inputMode="decimal" value={rowDialog.form.impostos}
                    onChange={e => setRowDialog(prev => ({ ...prev, form: { ...prev.form, impostos: e.target.value } }))}
                    placeholder="0,00"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono text-right" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Valor Custo</label>
                <input type="text" inputMode="decimal" value={rowDialog.form.valorCusto}
                  onChange={e => setRowDialog(prev => ({ ...prev, form: { ...prev.form, valorCusto: e.target.value } }))}
                  placeholder="0,00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono text-right" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Bônus Varejo</label>
                <input type="text" inputMode="decimal" value={rowDialog.form.bonusVarejo}
                  onChange={e => setRowDialog(prev => ({ ...prev, form: { ...prev.form, bonusVarejo: e.target.value } }))}
                  placeholder="0,00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono text-right" />
              </div>
              {!isUsados && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bônus Trade IN</label>
                  <input type="text" inputMode="decimal" value={rowDialog.form.bonusTradeIn}
                    onChange={e => setRowDialog(prev => ({ ...prev, form: { ...prev.form, bonusTradeIn: e.target.value } }))}
                    placeholder="0,00"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono text-right" />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setRowDialog(prev => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRow}
                disabled={savingRow}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
              >
                {savingRow ? 'Salvando...' : (rowDialog.editId ? 'Atualizar' : 'Incluir')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
