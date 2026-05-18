import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Save, Check, ChevronRight, RefreshCw, Lock, LockOpen, Printer } from 'lucide-react';
import {
  loadVendasResultadoRows,
  type VendasResultadoRow,
} from '@/components/VendasBonificacoesDashboard/vendasResultadoStorage';
import {
  loadRemuneracao,
  loadAliquotas,
  type RemuneracaoData,
} from '@/components/VendasBonificacoesDashboard/vendedoresRemuneracaoStorage';
import {
  loadPeriodos,
  savePeriodo,
  periodoKey,
  type PeriodoApuracao,
} from './comissoesCalculoPeriodoStorage';
import {
  loadLancamentos,
  bulkSaveLancamentos,
  type LancamentoComissao,
  type LancamentosMap,
} from './comissoesLancamentosStorage';
import { ComissoesCalculoDemonstrativo } from './ComissoesCalculoDemonstrativo';

// ─── Constantes ───────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'] as const;
const AVAILABLE_YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseDataVenda(d: string): Date | null {
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) {
    const [dd, mm, yyyy] = d.split('/');
    return new Date(`${yyyy}-${mm}-${dd}`);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return new Date(d);
  return null;
}

function fmtDate(d: string): string {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

// ─── Bulk Print ───────────────────────────────────────────────────────────────
function buildSellerPrintHtml(params: {
  vendedor:    string;
  vRows:       VendasResultadoRow[];
  lancamento:  LancamentoComissao | undefined;
  tab:         'novos' | 'usados';
  competencia: string;
  periodoLabel: string;
  isLast:      boolean;
}): string {
  const { vendedor, vRows, lancamento, tab, competencia, periodoLabel, isLast } = params;

  const n = (v: unknown) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
  const fmtBRL = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  const numColor = (v: number) =>
    v < 0 ? 'color:#dc2626' : v === 0 ? 'color:#94a3b8' : 'color:#1e293b';

  const txVenda    = tab === 'usados' ? 'U21' : 'V21';
  const txDevol    = tab === 'usados' ? 'U07' : 'V07';
  const tabLabel   = tab === 'usados' ? 'Veículos Usados' : 'Veículos Novos';
  const demoTitle  = tab === 'usados'
    ? 'Demonstrativo de Comissão de Vendas Usados'
    : 'Demonstrativo de Comissão de Vendas Novos';

  const derived = vRows.map(r => {
    const valorVenda = n(r.valorVenda);
    const valorCusto = n(r.valorCusto);
    const bonus      = n(r.bonusVarejo) + n(r.bonusTradeIn);
    const lucroBruto = valorVenda - valorCusto + bonus;
    const lucroBrutoPct = valorVenda !== 0 ? (lucroBruto / valorVenda) * 100 : 0;
    return { ...r, _d: { bonus, lucroBruto, lucroBrutoPct } };
  });

  let totVenda = 0, totCusto = 0, totBonus = 0, totLB = 0, totComV = 0, totComLB = 0;
  let hasComissao = false;
  let countVenda  = 0, countDevol = 0;

  derived.forEach((r, ri) => {
    const sign = r.transacao === txDevol ? -1 : 1;
    if (r.transacao === txVenda) countVenda++;
    if (r.transacao === txDevol) countDevol++;
    totVenda += sign * n(r.valorVenda);
    totCusto += sign * n(r.valorCusto);
    totBonus += sign * r._d.bonus;
    totLB    += sign * r._d.lucroBruto;
    const key = r.chassi || String(ri);
    const linha = lancamento?.linhas?.[key];
    if (linha) { totComV += linha.comVenda; totComLB += linha.comLB; hasComissao = true; }
  });

  const totLBPct   = totVenda !== 0 ? (totLB / totVenda) * 100 : 0;
  const netCount   = countVenda - countDevol;
  const pago       = lancamento?.pago ?? false;
  const cntLabel   = `${netCount} ${netCount === 1 ? 'venda' : 'vendas'}`;
  const cntDetail  = countDevol > 0
    ? ` (${countVenda} ${txVenda} − ${countDevol} ${txDevol})`
    : '';

  const tdB = 'padding:3px 5px;border-bottom:1px solid #f1f5f9;font-size:8px;';
  const thS = (bg: string, align = 'left') =>
    `background:${bg};color:white;padding:4px 5px;font-size:7.5px;font-weight:600;white-space:nowrap;text-align:${align};`;
  const tfB = 'background:#1e293b;color:white;padding:5px 6px;font-size:8px;font-weight:700;text-align:right;border-right:1px solid #475569;';

  const rowsHtml = derived.map((r, ri) => {
    const bg    = ri % 2 === 0 ? '#ffffff' : '#f8fafc';
    const key   = r.chassi || String(ri);
    const linha = lancamento?.linhas?.[key];
    const comV  = linha?.comVenda ?? 0;
    const comLB = linha?.comLB    ?? 0;
    const total = comV + comLB;
    const vv    = n(r.valorVenda);
    const vc    = n(r.valorCusto);
    const none  = '<span style="color:#94a3b8">—</span>';
    return `<tr style="background:${bg}">
      <td style="${tdB}font-family:monospace;color:#334155;">${r.chassi || '—'}</td>
      <td style="${tdB}color:#334155;white-space:normal;word-break:break-word;max-width:110px;">${r.modelo || '—'}</td>
      <td style="${tdB}font-family:monospace;color:#334155;">${r.dataVenda || '—'}</td>
      <td style="${tdB}color:#334155;">${r.transacao || '—'}</td>
      <td style="${tdB}text-align:right;${numColor(vv)}">${fmtBRL(vv)}</td>
      <td style="${tdB}text-align:right;${numColor(vc)}">${fmtBRL(vc)}</td>
      <td style="${tdB}text-align:right;${numColor(r._d.bonus)}">${fmtBRL(r._d.bonus)}</td>
      <td style="${tdB}text-align:right;${numColor(r._d.lucroBruto)}">${fmtBRL(r._d.lucroBruto)}</td>
      <td style="${tdB}text-align:right;${numColor(r._d.lucroBrutoPct)}">${fmtPct(r._d.lucroBrutoPct)}</td>
      <td style="${tdB}text-align:right;${numColor(comV)}">${linha ? fmtBRL(comV) : none}</td>
      <td style="${tdB}text-align:right;${numColor(comLB)}">${linha ? fmtBRL(comLB) : none}</td>
      <td style="${tdB}text-align:right;font-weight:600;${numColor(total)}">${linha ? fmtBRL(total) : none}</td>
    </tr>`;
  }).join('');

  const pagoBadge = pago
    ? 'background:#d1fae5;color:#065f46;border:1px solid #6ee7b7'
    : 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d';

  return `<div style="page-break-after:${isLast ? 'avoid' : 'always'};padding-bottom:${isLast ? '0' : '12px'}">
  <div style="background:#1e293b;color:white;border-radius:10px;overflow:hidden;margin-bottom:8px;">
    <div style="padding:14px 18px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <p style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 3px;">${demoTitle}</p>
        <p style="font-size:15px;font-weight:700;margin:0 0 3px;">${vendedor}</p>
        <p style="font-size:11px;color:#cbd5e1;margin:0;">${tabLabel}</p>
      </div>
      <div style="text-align:right;">
        <p style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 3px;">Competência</p>
        <p style="font-size:15px;font-weight:700;margin:0 0 3px;">${competencia}</p>
        <p style="font-size:9px;color:#94a3b8;margin:0;">Período: ${periodoLabel}</p>
      </div>
    </div>
    <div style="background:#0f172a;padding:6px 18px;display:flex;align-items:center;gap:8px;">
      <span style="${pagoBadge};padding:2px 8px;border-radius:20px;font-size:7.5px;font-weight:700;">${pago ? 'Pago' : 'Pendente'}</span>
      <span style="background:#f8fafc;color:#475569;border:1px solid #e2e8f0;padding:2px 8px;border-radius:20px;font-size:7.5px;font-weight:600;">${cntLabel}${cntDetail} no período</span>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="${thS('#334155')}">Chassi</th>
      <th style="${thS('#334155')}">Modelo</th>
      <th style="${thS('#334155')}">Data Venda</th>
      <th style="${thS('#334155')}">Transação</th>
      <th style="${thS('#065f46', 'right')}">Vl. Venda</th>
      <th style="${thS('#065f46', 'right')}">Vl. Custo</th>
      <th style="${thS('#065f46', 'right')}">Bônus</th>
      <th style="${thS('#0f766e', 'right')}">Lc. Bruto</th>
      <th style="${thS('#0f766e', 'right')}">% LB</th>
      <th style="${thS('#6d28d9', 'right')}">Com. Venda</th>
      <th style="${thS('#6d28d9', 'right')}">Com. LB</th>
      <th style="${thS('#6d28d9', 'right')}">Total</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr>
      <td colspan="3" style="${tfB}text-align:left;">Total — ${cntLabel}${cntDetail}</td>
      <td style="${tfB}"></td>
      <td style="${tfB}">${fmtBRL(totVenda)}</td>
      <td style="${tfB}">${fmtBRL(totCusto)}</td>
      <td style="${tfB}">${fmtBRL(totBonus)}</td>
      <td style="${tfB}">${fmtBRL(totLB)}</td>
      <td style="${tfB}">${fmtPct(totLBPct)}</td>
      <td style="${tfB}">${hasComissao ? fmtBRL(totComV) : '—'}</td>
      <td style="${tfB}">${hasComissao ? fmtBRL(totComLB) : '—'}</td>
      <td style="${tfB}font-size:9px;">${hasComissao ? fmtBRL(totComV + totComLB) : '—'}</td>
    </tr></tfoot>
  </table>
</div>`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ComissoesCalculoViewProps {
  tab: 'novos' | 'usados';
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function ComissoesCalculoView({ tab }: ComissoesCalculoViewProps) {
  const [filterYear,  setFilterYear]  = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(new Date().getMonth() + 1);

  // Períodos de apuração
  const [periodoMap, setPeriodoMap] = useState<Record<string, PeriodoApuracao>>({});
  const [editDe,  setEditDe]  = useState('');
  const [editAte, setEditAte] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  // Bloqueio do período
  const [bloqueado,       setBloqueado]       = useState(false);
  const [showUnlockInput, setShowUnlockInput] = useState(false);
  const [unlockPass,      setUnlockPass]      = useState('');
  const [unlockError,     setUnlockError]     = useState<string | null>(null);

  // Dados
  const [rows, setRows]               = useState<VendasResultadoRow[]>([]);
  const [remuneracao, setRemuneracao] = useState<RemuneracaoData | null>(null);
  const [aliquotaBonPct, setAliquotaBonPct] = useState(0);
  const [loading, setLoading]         = useState(true);
  const [lancamentosMap, setLancamentosMap] = useState<LancamentosMap>({});

  // Navegação para demonstrativo
  const [selectedVendedor, setSelectedVendedor] = useState<string | null>(null);

  // Bulk print
  const [printingAll, setPrintingAll] = useState(false);

  // Bulk pagamento
  const [markingAllPaid,  setMarkingAllPaid]  = useState(false);
  const [showReopenInput, setShowReopenInput] = useState(false);
  const [reopenPass,      setReopenPass]      = useState('');
  const [reopenError,     setReopenError]     = useState<string | null>(null);
  const [reopeningAll,    setReopeningAll]    = useState(false);

  // Carrega tudo ao montar / trocar aba
  useEffect(() => {
    setLoading(true);
    setSelectedVendedor(null);
    Promise.all([
      loadVendasResultadoRows(tab),
      loadRemuneracao(),
      loadAliquotas(),
      loadPeriodos(tab),
      loadLancamentos(tab),
    ]).then(([vendasRows, remun, aliquotas, periodos, lancs]) => {
      setRows(vendasRows);
      setRemuneracao(remun);
      setAliquotaBonPct(aliquotas.reduce((acc, i) => acc + (parseFloat(i.aliquota) || 0), 0));
      setPeriodoMap(periodos);
      setLancamentosMap(lancs);
    }).finally(() => setLoading(false));
  }, [tab]);

  // Sincroniza campos de edição ao mudar mês/ano
  useEffect(() => {
    if (filterMonth === null) return;
    const stored = periodoMap[periodoKey(filterYear, filterMonth)];
    setEditDe(stored?.de  ?? '');
    setEditAte(stored?.ate ?? '');
    setBloqueado(stored?.bloqueado ?? false);
    setSaved(false);
    setSelectedVendedor(null);
    setShowUnlockInput(false);
    setUnlockPass('');
    setUnlockError(null);
    setShowReopenInput(false);
    setReopenPass('');
    setReopenError(null);
  }, [filterMonth, filterYear, periodoMap]);

  async function handleSave() {
    if (filterMonth === null) return;
    setSaving(true);
    try {
      const p: PeriodoApuracao = { de: editDe, ate: editAte, bloqueado };
      await savePeriodo(tab, filterYear, filterMonth, p);
      setPeriodoMap(prev => ({ ...prev, [periodoKey(filterYear, filterMonth)]: p }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleLock() {
    if (filterMonth === null || !editDe || !editAte) return;
    setSaving(true);
    try {
      const p: PeriodoApuracao = { de: editDe, ate: editAte, bloqueado: true };
      await savePeriodo(tab, filterYear, filterMonth, p);
      setPeriodoMap(prev => ({ ...prev, [periodoKey(filterYear, filterMonth)]: p }));
      setBloqueado(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlock() {
    if (filterMonth === null) return;
    if (unlockPass !== '1985') { setUnlockError('Senha incorreta.'); return; }
    setSaving(true);
    try {
      const p: PeriodoApuracao = { de: editDe, ate: editAte, bloqueado: false };
      await savePeriodo(tab, filterYear, filterMonth, p);
      setPeriodoMap(prev => ({ ...prev, [periodoKey(filterYear, filterMonth)]: p }));
      setBloqueado(false);
      setShowUnlockInput(false);
      setUnlockPass('');
      setUnlockError(null);
    } finally {
      setSaving(false);
    }
  }

  async function handlePrintAll() {
    if (!remuneracao || filterMonth === null || vendedoresMap.length === 0) return;
    setPrintingAll(true);
    try {
      const pk         = `${filterYear}-${filterMonth}`;
      const competencia = `${MONTH_NAMES[filterMonth - 1]} de ${filterYear}`;
      const lancs       = await loadLancamentos(tab);

      const html = vendedoresMap.map(([vendedor, vRows], idx) =>
        buildSellerPrintHtml({
          vendedor,
          vRows,
          lancamento:  lancs[pk]?.[vendedor],
          tab,
          competencia,
          periodoLabel: savedPeriodo?.de && savedPeriodo?.ate
            ? `${fmtDate(savedPeriodo.de)} a ${fmtDate(savedPeriodo.ate)}`
            : '',
          isLast: idx === vendedoresMap.length - 1,
        })
      ).join('');

      const root = document.getElementById('print-root');
      if (!root) { window.print(); return; }
      root.innerHTML = `<div style="font-family:Inter,system-ui,sans-serif;">${html}</div>`;

      const style = document.createElement('style');
      style.textContent = `
        @page { size: A4 portrait; margin: 1cm; }
        #print-root { font-family: Inter, system-ui, sans-serif; zoom: 73%; }
        #print-root, #print-root * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          forced-color-adjust: none !important;
          color-scheme: light !important;
        }
      `;
      document.head.appendChild(style);

      window.onafterprint = () => {
        document.head.removeChild(style);
        root.innerHTML = '';
        window.onafterprint = null;
        setPrintingAll(false);
      };
      window.print();
    } catch {
      setPrintingAll(false);
    }
  }

  async function handleMarkAllPaid() {
    if (filterMonth === null || vendedoresMap.length === 0) return;
    setMarkingAllPaid(true);
    try {
      const pk    = `${filterYear}-${filterMonth}`;
      const today = new Date().toISOString().split('T')[0];
      const all   = { ...lancamentosMap };
      let changed = false;
      vendedoresMap.forEach(([vendedor]) => {
        const existing = all[pk]?.[vendedor];
        if (!existing || existing.pago) return;
        changed = true;
        all[pk] = {
          ...(all[pk] ?? {}),
          [vendedor]: { ...existing, pago: true, dataPagamento: existing.dataPagamento ?? today },
        };
      });
      if (changed) {
        await bulkSaveLancamentos(tab, all);
        setLancamentosMap(all);
      }
    } finally {
      setMarkingAllPaid(false);
    }
  }

  async function handleReopenAll() {
    if (filterMonth === null) return;
    if (reopenPass !== '1985') { setReopenError('Senha incorreta.'); return; }
    setReopeningAll(true);
    try {
      const pk  = `${filterYear}-${filterMonth}`;
      const all = { ...lancamentosMap };
      let changed = false;
      vendedoresMap.forEach(([vendedor]) => {
        const existing = all[pk]?.[vendedor];
        if (!existing || !existing.pago) return;
        changed = true;
        const { dataPagamento: _, ...rest } = existing;
        void _;
        all[pk] = { ...(all[pk] ?? {}), [vendedor]: { ...rest, pago: false } };
      });
      if (changed) {
        await bulkSaveLancamentos(tab, all);
        setLancamentosMap(all);
      }
      setShowReopenInput(false);
      setReopenPass('');
      setReopenError(null);
    } finally {
      setReopeningAll(false);
    }
  }

  const hasPeriodo = (year: number, month: number) => {
    const p = periodoMap[periodoKey(year, month)];
    return !!(p?.de && p?.ate);
  };

  // Período salvo (não o que está em edição)
  const savedPeriodo = filterMonth !== null
    ? periodoMap[periodoKey(filterYear, filterMonth)]
    : undefined;

  // Filtra vendas pelo período salvo
  const periodRows = useMemo(() => {
    if (!savedPeriodo?.de || !savedPeriodo?.ate) return [];
    const de  = new Date(savedPeriodo.de);
    const ate = new Date(savedPeriodo.ate);
    ate.setHours(23, 59, 59, 999);
    return rows.filter(r => {
      const d = parseDataVenda(r.dataVenda);
      return d !== null && d >= de && d <= ate;
    });
  }, [rows, savedPeriodo]);

  // Agrupa por vendedor (ordenado A-Z)
  const vendedoresMap = useMemo(() => {
    const map = new Map<string, VendasResultadoRow[]>();
    for (const r of periodRows) {
      const v = r.vendedor?.trim() || '(sem nome)';
      map.set(v, [...(map.get(v) ?? []), r]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [periodRows]);

  // Linhas do vendedor selecionado
  const vendedorRows = useMemo(() =>
    vendedoresMap.find(([v]) => v === selectedVendedor)?.[1] ?? [],
  [selectedVendedor, vendedoresMap]);

  const periodoLabel = savedPeriodo?.de && savedPeriodo?.ate
    ? `${fmtDate(savedPeriodo.de)} a ${fmtDate(savedPeriodo.ate)}`
    : '';

  const [countComLanc, countPagos] = useMemo(() => {
    if (filterMonth === null) return [0, 0];
    const pk    = `${filterYear}-${filterMonth}`;
    const lancs = lancamentosMap[pk] ?? {};
    let withLanc = 0, paid = 0;
    vendedoresMap.forEach(([v]) => {
      const l = lancs[v];
      if (l) { withLanc++; if (l.pago) paid++; }
    });
    return [withLanc, paid];
  }, [lancamentosMap, vendedoresMap, filterYear, filterMonth]);

  // ── Exibe demonstrativo quando vendedor selecionado ──────────────────────
  if (selectedVendedor && remuneracao && filterMonth !== null) {
    return (
      <ComissoesCalculoDemonstrativo
        vendedor={selectedVendedor}
        rows={vendedorRows}
        tab={tab}
        remuneracao={remuneracao}
        aliquotaBonPct={aliquotaBonPct}
        periodoLabel={periodoLabel}
        year={filterYear}
        month={filterMonth}
        onBack={() => {
          setSelectedVendedor(null);
          loadLancamentos(tab).then(setLancamentosMap);
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>

      {/* ── Seletor Ano / Mês ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 flex-shrink-0 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">ANO</span>
        <div className="relative mr-2">
          <select
            value={filterYear}
            onChange={e => { setFilterYear(Number(e.target.value)); setSaved(false); }}
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
            filterMonth === null
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
        >
          Ano todo
        </button>
        {MONTHS.map((name, idx) => {
          const m = idx + 1;
          const isActive  = filterMonth === m;
          const temPeriodo = hasPeriodo(filterYear, m);
          return (
            <button
              key={m}
              onClick={() => setFilterMonth(m)}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              {name}
              {temPeriodo && !isActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Barra de Período de Apuração ─────────────────────────────────── */}
      {filterMonth !== null && (
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex items-center gap-3 flex-shrink-0 flex-wrap">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider whitespace-nowrap">
            Período de Apuração
          </span>
          <div className="w-px h-4 bg-emerald-200" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-emerald-700 font-medium whitespace-nowrap">De</label>
            <input
              type="date"
              value={editDe}
              disabled={bloqueado}
              onChange={e => { setEditDe(e.target.value); setSaved(false); }}
              className={`border rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                bloqueado
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-emerald-200'
              }`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-emerald-700 font-medium whitespace-nowrap">até</label>
            <input
              type="date"
              value={editAte}
              disabled={bloqueado}
              onChange={e => { setEditAte(e.target.value); setSaved(false); }}
              className={`border rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                bloqueado
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-emerald-200'
              }`}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !editDe || !editAte || bloqueado}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {saved
              ? <><Check className="w-3.5 h-3.5" /> Salvo</>
              : <><Save className="w-3.5 h-3.5" /> Salvar</>
            }
          </button>

          {/* ── Cadeado ──────────────────────────────────────────────────── */}
          <div className="w-px h-4 bg-emerald-200" />
          {bloqueado ? (
            <button
              onClick={() => { setShowUnlockInput(v => !v); setUnlockError(null); setUnlockPass(''); }}
              title="Período bloqueado — clique para desbloquear"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              Bloqueado
            </button>
          ) : (
            <button
              onClick={handleLock}
              disabled={saving || !editDe || !editAte}
              title="Clique para bloquear o período"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <LockOpen className="w-3.5 h-3.5" />
              Bloquear
            </button>
          )}

          {/* Campo de senha inline para desbloquear */}
          {showUnlockInput && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 shadow-sm">
              <input
                type="password"
                value={unlockPass}
                autoFocus
                placeholder="Senha"
                onChange={e => { setUnlockPass(e.target.value); setUnlockError(null); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleUnlock();
                  if (e.key === 'Escape') { setShowUnlockInput(false); setUnlockPass(''); setUnlockError(null); }
                }}
                className="w-24 text-xs text-slate-700 bg-transparent focus:outline-none"
              />
              <button
                onClick={handleUnlock}
                disabled={saving}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-40"
              >
                OK
              </button>
              <button
                onClick={() => { setShowUnlockInput(false); setUnlockPass(''); setUnlockError(null); }}
                className="text-slate-400 hover:text-slate-600 text-xs leading-none"
              >
                ✕
              </button>
            </div>
          )}
          {unlockError && (
            <span className="text-xs text-red-600 font-medium">{unlockError}</span>
          )}
        </div>
      )}

      {/* ── Conteúdo ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Carregando...
          </div>
        ) : filterMonth === null ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Selecione um mês para configurar o período de apuração.
          </div>
        ) : !savedPeriodo?.de || !savedPeriodo?.ate ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Defina e salve o período de apuração para visualizar as vendas.
          </div>
        ) : vendedoresMap.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Nenhuma venda encontrada no período {periodoLabel}.
          </div>
        ) : (
          <div className="p-4 max-w-4xl mx-auto space-y-3">

            {/* Barra de resumo */}
            <div className="flex items-center gap-2 px-1 py-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-700">
                {MONTH_NAMES[filterMonth - 1]} de {filterYear}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-sm text-slate-500">
                {vendedoresMap.length} {vendedoresMap.length === 1 ? 'vendedor' : 'vendedores'}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-sm text-slate-500">
                {periodRows.length} {periodRows.length === 1 ? 'venda' : 'vendas'} no período
              </span>
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                {countComLanc > 0 && (
                  <span className="text-xs text-slate-400">
                    {countPagos} de {countComLanc} {countComLanc === 1 ? 'pago' : 'pagos'}
                  </span>
                )}

                {/* Marcar todos como pago */}
                {countComLanc > countPagos && (
                  <button
                    onClick={handleMarkAllPaid}
                    disabled={markingAllPaid}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {markingAllPaid ? 'Salvando...' : 'Marcar todos como pago'}
                  </button>
                )}

                {/* Reabrir todos */}
                {countPagos > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setShowReopenInput(v => !v); setReopenError(null); setReopenPass(''); }}
                      disabled={reopeningAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
                    >
                      <LockOpen className="w-3.5 h-3.5" />
                      {reopeningAll ? 'Reabrindo...' : 'Reabrir todos'}
                    </button>
                    {showReopenInput && (
                      <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 shadow-sm">
                        <input
                          type="password"
                          value={reopenPass}
                          autoFocus
                          placeholder="Senha"
                          onChange={e => { setReopenPass(e.target.value); setReopenError(null); }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleReopenAll();
                            if (e.key === 'Escape') { setShowReopenInput(false); setReopenPass(''); setReopenError(null); }
                          }}
                          className="w-24 text-xs text-slate-700 bg-transparent focus:outline-none"
                        />
                        <button onClick={handleReopenAll} disabled={reopeningAll} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-40">OK</button>
                        <button onClick={() => { setShowReopenInput(false); setReopenPass(''); setReopenError(null); }} className="text-slate-400 hover:text-slate-600 text-xs leading-none">✕</button>
                      </div>
                    )}
                    {reopenError && <span className="text-xs text-red-600 font-medium">{reopenError}</span>}
                  </div>
                )}

                <div className="w-px h-4 bg-slate-200" />
                <button
                  onClick={handlePrintAll}
                  disabled={printingAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {printingAll ? 'Gerando...' : 'Imprimir PDF'}
                </button>
              </div>
            </div>

            {/* Cards de vendedores */}
            {vendedoresMap.map(([vendedor, vRows]) => {
              const lanc = filterMonth !== null
                ? lancamentosMap[`${filterYear}-${filterMonth}`]?.[vendedor]
                : undefined;
              const pago = lanc?.pago ?? false;
              return (
                <button
                  key={vendedor}
                  onClick={() => setSelectedVendedor(vendedor)}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-slate-300 hover:shadow-sm transition-all flex items-center gap-4"
                >
                  {/* Avatar com inicial */}
                  <div className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {vendedor.trim().charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{vendedor}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {tab === 'novos' ? 'Veículos Novos' : 'Veículos Usados'}
                      {' · '}
                      {vRows.length} {vRows.length === 1 ? 'venda' : 'vendas'}
                    </p>
                  </div>
                  {/* Status */}
                  {lanc ? (
                    <span className={`px-3 py-1 rounded-full border text-xs font-semibold whitespace-nowrap flex-shrink-0 ${
                      pago
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
                      {pago ? 'Pago' : 'Pendente'}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-400 text-xs font-semibold whitespace-nowrap flex-shrink-0">
                      Sem lançamento
                    </span>
                  )}
                  {/* Data de pagamento ou placeholder */}
                  {pago && lanc?.dataPagamento ? (
                    <span className="text-xs text-emerald-500 whitespace-nowrap flex-shrink-0">
                      {fmtDate(lanc.dataPagamento)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300 whitespace-nowrap flex-shrink-0">—</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              );
            })}

          </div>
        )}
      </div>

    </div>
  );
}
