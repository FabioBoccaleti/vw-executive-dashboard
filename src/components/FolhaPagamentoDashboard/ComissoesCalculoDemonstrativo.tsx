import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Clock, CheckCircle2, History, Printer, DollarSign, Save, LockOpen, PenLine, CheckCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { apiLogin } from '@/lib/authClient';
import type { VendasResultadoRow } from '@/components/VendasBonificacoesDashboard/vendasResultadoStorage';
import type { RemuneracaoData } from '@/components/VendasBonificacoesDashboard/vendedoresRemuneracaoStorage';
import {
  loadLancamentos,
  saveLancamento,
  type LancamentoComissao,
  type LinhaComissao,
  type LancamentosMap,
  type CampoAssinaturaComissao,
  type AssinaturaDigital,
} from './comissoesLancamentosStorage';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function n(v: string | undefined): number {
  return parseFloat(String(v ?? '').replace(',', '.')) || 0;
}
function nInput(v: string): number {
  // Remove separadores de milhar (ponto) e converte vírgula decimal → ponto
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
}
function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

function parseDV(d: string): number {
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) {
    const [dd, mm, yyyy] = d.split('/');
    return new Date(`${yyyy}-${mm}-${dd}`).getTime();
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return new Date(d).getTime();
  return 0;
}

// Corrige artefatos de encoding em nomes de vendedores (exibição apenas)
function fixVendedorName(name: string): string {
  return name
    .replace(/JOS[\uFFFD?]\s/gi,              'JOSE ')
    .replace(/LOUREN[\uFFFD?]O/gi,            'LOURENCO')
    .replace(/CONCEI[\uFFFD?]{1,2}O/gi,       'CONCEICAO');
}
function fmtPercent(val: string): string {
  const num = parseFloat(val.replace(',', '.'));
  if (isNaN(num)) return '—';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + '%';
}
function calcDerived(row: VendasResultadoRow) {
  const valorVenda    = n(row.valorVenda);
  const valorCusto    = n(row.valorCusto);
  const bonus         = n(row.bonusVarejo) + n(row.bonusTradeIn);
  const lucroBruto    = valorVenda - valorCusto + bonus;
  const lucroBrutoPct = valorVenda !== 0 ? (lucroBruto / valorVenda) * 100 : 0;
  return { bonus, lucroBruto, lucroBrutoPct };
}

function getTierPct(
  pos:    number,
  faixas: Array<{ de: string; ate: string; percentual: string }>,
): number {
  const faixa = faixas.find(f => {
    const de  = parseInt(f.de)  || 0;
    const ate = f.ate === '' ? Infinity : (parseInt(f.ate) || 0);
    return pos >= de && pos <= ate;
  });
  if (!faixa) return 0;
  return parseFloat(String(faixa.percentual).replace(',', '.')) || 0;
}

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const CAMPO_LABELS: Record<CampoAssinaturaComissao, string> = {
  financeiro:         'Financeiro',
  gerenciaComercial:  'Gerência Comercial',
  diretoriaComercial: 'Diretoria Comercial',
  diretoria:          'Diretoria',
};

// ─── NumCell ──────────────────────────────────────────────────────────────────
function NumCell({ value, pct = false }: { value: number; pct?: boolean }) {
  const text  = pct ? fmtPct(value) : fmtBRL(value);
  const color = value < 0 ? 'text-red-600' : value === 0 ? 'text-slate-400' : 'text-slate-800';
  return <span className={`font-mono text-xs ${color}`}>{text}</span>;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  vendedor:       string;
  rows:           VendasResultadoRow[];
  tab:            'novos' | 'usados';
  remuneracao:    RemuneracaoData;
  aliquotaBonPct: number;
  periodoLabel:   string;
  year:           number;
  month:          number;
  onBack:         () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function ComissoesCalculoDemonstrativo({
  vendedor, rows, tab, remuneracao, periodoLabel, year, month, onBack,
}: Props) {
  const tabLabel    = tab === 'usados' ? 'Veículos Usados' : 'Veículos Novos';
  const modal       = remuneracao[tab];
  const competencia = `${MONTH_NAMES[month - 1]} de ${year}`;
  const pk          = `${year}-${month}`;
  const txVenda     = tab === 'usados' ? 'U21' : 'V21';  // transação de venda
  const txDevol     = tab === 'usados' ? 'U07' : 'V07';  // transação de devolução
  const { session } = useAuth();

  // ── Estado de lançamentos ──────────────────────────────────────────────────
  const [lancamentosMap,    setLancamentosMap]    = useState<LancamentosMap>({});
  const [lancamentosLoaded, setLancamentosLoaded] = useState(false);
  const [showHistorico,     setShowHistorico]     = useState(false);
  const [editMode,          setEditMode]          = useState(false);
  const [editValues,        setEditValues]        = useState<Record<string, { comVenda: string; comLB: string }>>({})
  const [savingLanc,        setSavingLanc]        = useState(false);
  const [savingPago,        setSavingPago]        = useState(false);
  const [reabrirDialog,     setReopenDialog]      = useState<{ senha: string; erro: string | null } | null>(null);
  const [assinaDialog,      setAssinaDialog]      = useState<{
    campo:   CampoAssinaturaComissao;
    senha:   string;
    loading: boolean;
    erro:    string | null;
  } | null>(null);

  function handlePrint() {
    const area = document.getElementById('demonstrativo-comissao-print-area');
    const root = document.getElementById('print-root');
    if (!area || !root) { window.print(); return; }
    const clone = area.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.no-print').forEach(el => el.remove());
    // colSpan=5 cobre Chassi, Modelo, NF Venda, Data Venda, Transação
    // NF Venda e Transação são removidas → colSpan deve ser 3
    const tfootLabel = clone.querySelector('tfoot tr td[colspan]') as HTMLTableCellElement | null;
    if (tfootLabel) tfootLabel.colSpan = 3;
    // Abreviar cabeçalhos para caber em retrato A4
    const abbrev: Record<string, string> = {
      'Valor Venda':   'Vl. Venda',
      'Lucro Bruto':   'Lc. Bruto',
      'Com. s/ Venda': 'Com. Venda',
      'Com. s/ LB':    'Com. LB',
    };
    clone.querySelectorAll('thead th').forEach(th => {
      const t = th.textContent?.trim() ?? '';
      if (abbrev[t]) th.textContent = abbrev[t];
    });
    root.innerHTML = clone.outerHTML;
    const style = document.createElement('style');
    style.textContent = `
      @page { size: A4 portrait; margin: 1cm; }
      #print-root { font-family: Inter, sans-serif; zoom: 70%; }
      #print-root, #print-root * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
        color-scheme: light !important;
      }
      #print-root table {
        font-size: 8px !important;
        width: 100% !important;
      }
      #print-root table th,
      #print-root table td {
        padding: 3px 5px !important;
        white-space: nowrap !important;
      }
      /* Coluna Modelo (2ª após remoção das colunas no-print) pode quebrar linha */
      #print-root table td:nth-child(2),
      #print-root table th:nth-child(2) {
        white-space: normal !important;
        word-break: break-word !important;
        max-width: 110px !important;
      }
    `;
    document.head.appendChild(style);
    window.onafterprint = () => {
      document.head.removeChild(style);
      root.innerHTML = '';
      window.onafterprint = null;
    };
    window.print();
  }

  useEffect(() => {
    setLancamentosLoaded(false);
    loadLancamentos(tab).then(data => {
      setLancamentosMap(data);
      setLancamentosLoaded(true);
    });
  }, [tab]);

  // ── Auto-cálculo de comissões (Novos e Usados) ──────────────────────────────
  useEffect(() => {
    if (!lancamentosLoaded) return;
    if (derivedRows.length === 0) return;

    const pctLB    = parseFloat(String(modal.comissaoLucroBruto ?? '').replace(',', '.'));
    const temPctLB = !isNaN(pctLB) && pctLB > 0;

    const existing       = lancamentosMap[pk]?.[vendedor];
    const existingLinhas = existing?.linhas ?? {};

    // Se já tem comVenda manual (algum valor ≠ 0), não sobrescreve
    const hasManualComVenda = Object.values(existingLinhas).some(l => l.comVenda !== 0);
    if (hasManualComVenda) return;

    // Se há lançamento mas comVenda zerado → só recalcula comVenda, preserva comLB
    const onlyFillComVenda = !!existing && !hasManualComVenda;

    const linhas: Record<string, LinhaComissao> = {};

    if (tab === 'usados') {
      // ── Usados: cálculo progressivo por faixa, ordenado por data de venda ──
      const temFaixas = (modal.faixasBonus?.length ?? 0) > 0;
      if (!temPctLB && !temFaixas) return;
      if (onlyFillComVenda && !temFaixas) return;

      // Preserva índice original para chave correta após reordenação por data
      const indexed = derivedRows.map((r, ri) => ({ r, ri, key: r.chassi || String(ri) }));
      const sorted  = [...indexed].sort((a, b) =>
        parseDV(a.r.dataVenda ?? '') - parseDV(b.r.dataVenda ?? '')
      );

      // Cada U21 avança o contador e recebe o % da faixa correspondente;
      // cada U07 usa o % atual e depois recua o contador (desfaz uma posição)
      const comVendaByKey: Record<string, number> = {};
      let pos = 0;
      sorted.forEach(({ r, key }) => {
        if (r.transacao === txVenda) {
          pos++;
          const pct = getTierPct(pos, modal.faixasBonus ?? []);
          comVendaByKey[key] = pct > 0 ? n(r.valorVenda) * (pct / 100) : 0;
        } else if (r.transacao === txDevol) {
          const pct = getTierPct(pos, modal.faixasBonus ?? []);
          comVendaByKey[key] = pct > 0 ? n(r.valorVenda) * (pct / 100) : 0;
          pos = Math.max(0, pos - 1);
        } else {
          comVendaByKey[key] = 0;
        }
      });

      derivedRows.forEach((r, ri) => {
        const key  = r.chassi || String(ri);
        const lb   = r._d.lucroBruto;
        linhas[key] = {
          comVenda: temFaixas ? (comVendaByKey[key] ?? 0) : 0,
          comLB: onlyFillComVenda
            ? (existingLinhas[key]?.comLB ?? 0)
            : (temPctLB && (lb > 0 || r.transacao === txDevol) ? lb * (pctLB / 100) : 0),
        };
      });

    } else {
      // ── Novos: comissão flat + bônus de produtividade ──────────────────────
      const pctVendaBase = parseFloat(String(modal.comissaoVenda ?? '').replace(',', '.'));
      const temPctVenda  = !isNaN(pctVendaBase) && pctVendaBase > 0;
      if (!temPctLB && !temPctVenda) return;
      if (onlyFillComVenda && !temPctVenda) return;

      // Bônus de produtividade (volume líquido vendas − devoluções)
      const countV21 = derivedRows.filter(r => r.transacao === txVenda).length;
      const countV07 = derivedRows.filter(r => r.transacao === txDevol).length;
      const netCount  = countV21 - countV07;
      let bonusPct = 0;
      if (modal.faixasBonus?.length > 0) {
        const faixa = modal.faixasBonus.find(f => {
          const de  = parseInt(f.de)  || 0;
          const ate = f.ate === '' ? Infinity : (parseInt(f.ate) || 0);
          return netCount >= de && netCount <= ate;
        });
        if (faixa) bonusPct = parseFloat(String(faixa.percentual).replace(',', '.')) || 0;
      }
      const pctVenda = (isNaN(pctVendaBase) ? 0 : pctVendaBase) + bonusPct;

      derivedRows.forEach((r, ri) => {
        const key  = r.chassi || String(ri);
        const lb   = r._d.lucroBruto;
        const vv   = n(r.valorVenda);
        linhas[key] = {
          comVenda: pctVenda > 0 ? vv * (pctVenda / 100) : 0,
          comLB: onlyFillComVenda
            ? (existingLinhas[key]?.comLB ?? 0)          // preserva comLB já salvo
            : (temPctLB && (lb > 0 || r.transacao === txDevol) ? lb * (pctLB / 100) : 0),
        };
      });
    }

    const newLanc: LancamentoComissao = {
      linhas,
      pago:          existing?.pago          ?? false,
      dataPagamento: existing?.dataPagamento,
      assinaturas:   existing?.assinaturas,
    };
    saveLancamento(tab, year, month, vendedor, newLanc).then(() => {
      setLancamentosMap(prev => ({
        ...prev,
        [pk]: { ...(prev[pk] ?? {}), [vendedor]: newLanc },
      }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lancamentosLoaded]);

  const lancamento = lancamentosMap[pk]?.[vendedor];
  const pago       = lancamento?.pago ?? false;

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleMarcarPago() {
    setSavingPago(true);
    try {
      const upd: LancamentoComissao = {
        linhas:        lancamento?.linhas ?? {},
        pago:          !pago,
        dataPagamento: !pago ? new Date().toISOString().split('T')[0] : undefined,
        assinaturas:   lancamento?.assinaturas,
      };
      await saveLancamento(tab, year, month, vendedor, upd);
      setLancamentosMap(prev => ({
        ...prev,
        [pk]: { ...(prev[pk] ?? {}), [vendedor]: upd },
      }));
    } finally {
      setSavingPago(false);
    }
  }

  function rowKey(chassi: string | undefined, idx: number): string {
    return chassi || String(idx);
  }

  async function handleConfirmarReabrir() {
    if (!reabrirDialog) return;
    if (reabrirDialog.senha !== '1985') {
      setReopenDialog(prev => prev ? { ...prev, erro: 'Senha incorreta.' } : prev);
      return;
    }
    const upd: LancamentoComissao = {
      linhas:        lancamento?.linhas ?? {},
      pago:          false,
      dataPagamento: undefined,
      assinaturas:   {},
    };
    await saveLancamento(tab, year, month, vendedor, upd);
    setLancamentosMap(prev => ({
      ...prev,
      [pk]: { ...(prev[pk] ?? {}), [vendedor]: upd },
    }));
    setReopenDialog(null);
  }

  function openEdit() {
    const linhas = lancamento?.linhas ?? {};
    const init: Record<string, { comVenda: string; comLB: string }> = {};
    derivedRows.forEach((r, ri) => {
      const key = rowKey(r.chassi, ri);
      const l   = linhas[key];
      init[key] = {
        comVenda: l && l.comVenda !== 0 ? fmtBRL(l.comVenda) : '',
        comLB:    l && l.comLB    !== 0 ? fmtBRL(l.comLB)    : '',
      };
    });
    setEditValues(init);
    setEditMode(true);
  }

  function handleCancelEdit() {
    setEditMode(false);
    setEditValues({});
  }

  async function handleSaveAll() {
    setSavingLanc(true);
    try {
      const linhas: Record<string, LinhaComissao> = {};
      derivedRows.forEach((r, ri) => {
        const key = rowKey(r.chassi, ri);
        const ev  = editValues[key];
        if (ev) {
          linhas[key] = { comVenda: nInput(ev.comVenda), comLB: nInput(ev.comLB) };
        }
      });
      const upd: LancamentoComissao = {
        linhas,
        pago:          lancamento?.pago          ?? false,
        dataPagamento: lancamento?.dataPagamento,
        assinaturas:   lancamento?.assinaturas,
      };
      await saveLancamento(tab, year, month, vendedor, upd);
      setLancamentosMap(prev => ({
        ...prev,
        [pk]: { ...(prev[pk] ?? {}), [vendedor]: upd },
      }));
      setEditMode(false);
      setEditValues({});
    } finally {
      setSavingLanc(false);
    }
  }

  function handleAbrirAssinatura(campo: CampoAssinaturaComissao) {
    if (!session) return;
    setAssinaDialog({ campo, senha: '', loading: false, erro: null });
  }

  async function handleConfirmarAssinatura() {
    if (!assinaDialog || !lancamento || !session) return;
    setAssinaDialog(prev => prev ? { ...prev, loading: true, erro: null } : prev);
    const result = await apiLogin(session.username, assinaDialog.senha);
    if ('error' in result) {
      setAssinaDialog(prev => prev ? { ...prev, loading: false, erro: 'Senha incorreta. Tente novamente.' } : prev);
      return;
    }
    const assinatura: AssinaturaDigital = {
      username: session.username,
      name:     (result.session.name ?? '') || undefined,
      dataHora: new Date().toISOString(),
    };
    const upd: LancamentoComissao = {
      ...lancamento,
      assinaturas: { ...(lancamento.assinaturas ?? {}), [assinaDialog.campo]: assinatura },
    };
    await saveLancamento(tab, year, month, vendedor, upd);
    setLancamentosMap(prev => ({
      ...prev,
      [pk]: { ...(prev[pk] ?? {}), [vendedor]: upd },
    }));
    toast.success(`Assinatura de ${CAMPO_LABELS[assinaDialog.campo]} registrada com sucesso!`);
    setAssinaDialog(null);
  }

  // ── Cálculo por linha ─────────────────────────────────────────────────────
  const derivedRows = useMemo(() =>
    rows.map(r => ({ ...r, _d: calcDerived(r) })),
  [rows]);

  // ── Totais ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let totVenda = 0, totCusto = 0, totBonus = 0, totLB = 0;
    let totComV = 0, totComLB = 0;
    let hasComissao = false;
    let countV21 = 0, countV07 = 0;
    derivedRows.forEach((r, ri) => {
      const sign = r.transacao === txDevol ? -1 : 1;
      if (r.transacao === txVenda) countV21++;
      if (r.transacao === txDevol) countV07++;
      totVenda += sign * n(r.valorVenda);
      totCusto += sign * n(r.valorCusto);
      totBonus += sign * r._d.bonus;
      totLB    += sign * r._d.lucroBruto;
      const key = r.chassi || String(ri);
      if (editMode) {
        const ev = editValues[key];
        if (ev) { totComV += nInput(ev.comVenda); totComLB += nInput(ev.comLB); hasComissao = true; }
      } else {
        const linha = lancamento?.linhas?.[key];
        if (linha) { totComV += linha.comVenda; totComLB += linha.comLB; hasComissao = true; }
      }
    });
    const totLBPct = totVenda !== 0 ? (totLB / totVenda) * 100 : 0;
    const netCount = countV21 - countV07;
    return {
      totVenda, totCusto, totBonus, totLB, totLBPct,
      totComV:  hasComissao ? totComV  : null,
      totComLB: hasComissao ? totComLB : null,
      totTotal: hasComissao ? totComV + totComLB : null,
      countV21, countV07, netCount,
    };
  }, [derivedRows, lancamento, editMode, editValues, txVenda, txDevol]);

  // ── Faixa de bônus ativa para o período ─────────────────────────────────
  const bonusFaixaAtual = useMemo(() => {
    if (!modal.faixasBonus?.length) return null;
    const faixa = modal.faixasBonus.find(f => {
      const de  = parseInt(f.de)  || 0;
      const ate = f.ate === '' ? Infinity : (parseInt(f.ate) || 0);
      return totals.netCount >= de && totals.netCount <= ate;
    });
    if (!faixa) return null;
    const pct = parseFloat(String(faixa.percentual).replace(',', '.'));
    return isNaN(pct) || pct <= 0 ? null : faixa;
  }, [tab, modal.faixasBonus, totals.netCount]);

  // ── Histórico (últimos 12 meses) ──────────────────────────────────────────
  const historico = useMemo(() => {
    const result = [];
    for (let i = 0; i < 12; i++) {
      let y = year, m = month - i;
      while (m <= 0) { m += 12; y--; }
      const lanc  = lancamentosMap[`${y}-${m}`]?.[vendedor];
      const total = lanc
        ? Object.values(lanc.linhas ?? {}).reduce((s, l) => s + l.comVenda + l.comLB, 0)
        : 0;
      result.push({ year: y, month: m, lancamento: lanc, total });
    }
    return result;
  }, [lancamentosMap, year, month, vendedor]);
  const thId   = 'bg-slate-700 text-white px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-r border-slate-600 text-left sticky top-0';
  const thFin  = 'bg-emerald-700 text-white px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-r border-emerald-600 text-right sticky top-0';
  const thLB   = 'bg-teal-700 text-white px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-r border-teal-600 text-right sticky top-0';
  const thComm = 'bg-violet-700 text-white px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-r border-violet-600 text-right sticky top-0';
  const tdBase = 'border-b border-slate-100 align-middle px-2 py-1.5 text-xs';

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>

      {/* ── Barra superior ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 flex-shrink-0 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar à lista
        </button>
        <div className="flex-1" />
        {/* Botões de ação */}
        <button
          onClick={() => setShowHistorico(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            showHistorico
              ? 'bg-slate-700 text-white border-slate-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Histórico
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Imprimir PDF
        </button>
        <button
          onClick={handleMarcarPago}
          disabled={savingPago}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
            pago
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
              : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {pago ? 'Pago ✓' : 'Marcar como pago'}
        </button>
        {pago && (
          <button
            onClick={() => setReopenDialog({ senha: '', erro: null })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <LockOpen className="w-3.5 h-3.5" />
            Reabrir demonstrativo
          </button>
        )}
        {editMode ? (
          <>
            <button
              onClick={handleCancelEdit}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveAll}
              disabled={savingLanc}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {savingLanc ? 'Salvando...' : 'Salvar lançamentos'}
            </button>
          </>
        ) : (
          <button
            onClick={openEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
          >
            <DollarSign className="w-3.5 h-3.5" />
            Lançar valores
          </button>
        )}
      </div>

      <div id="demonstrativo-comissao-print-area" className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-4">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="bg-slate-800 text-white rounded-xl overflow-hidden">
            <div className="px-6 py-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  {tab === 'usados' ? 'Demonstrativo de Comissão de Vendas Usados VW' : 'Demonstrativo de Comissão de Vendas Novos VW'}
                </p>
                <h2 className="text-xl font-bold leading-tight">{fixVendedorName(vendedor)}</h2>
                <p className="text-sm text-slate-300 mt-1">{tabLabel}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  Competência
                </p>
                <p className="text-lg font-bold">{competencia}</p>
                <p className="text-xs text-slate-400 mt-1">Período: {periodoLabel}</p>
              </div>
            </div>
          </div>

          {/* ── Status + Pills ───────────────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            {pago ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Pago
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                <Clock className="w-3.5 h-3.5" />
                Pendente
              </span>
            )}
            <div className="w-px h-4 bg-slate-200" />
            {modal.comissaoVenda && (
              <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                % Com. s/ Venda: <strong>{fmtPercent(modal.comissaoVenda)}</strong>
              </span>
            )}
            {modal.comissaoLucroBruto && (
              <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                % Com. s/ LB: <strong>{fmtPercent(modal.comissaoLucroBruto)}</strong>
              </span>
            )}
            {bonusFaixaAtual && tab === 'novos' && (
              <span className="px-3 py-1.5 rounded-full bg-yellow-50 text-yellow-700 text-xs font-medium border border-yellow-300">
                Bônus Produt.: <strong>{fmtPercent(bonusFaixaAtual.percentual)}</strong>
              </span>
            )}
            <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
              {totals.netCount} {totals.netCount === 1 ? 'venda' : 'vendas'} no período
              {totals.countV07 > 0 && (
                <span className="ml-1 text-emerald-500">({totals.countV21} V21 − {totals.countV07} V07)</span>
              )}
            </span>
            {editMode && (
              <span className="px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 text-xs font-medium border border-violet-200 animate-pulse">
                Modo de edição ativo
              </span>
            )}
          </div>

          {/* ── Tabela ──────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className={thId}>Chassi</th>
                    <th className={thId}>Modelo</th>
                    <th className={`${thId} no-print`}>NF Venda</th>
                    <th className={thId}>Data Venda</th>
                    <th className={`${thId} no-print`}>Transação</th>
                    <th className={thFin}>Valor Venda</th>
                    <th className={`${thFin} no-print`}>Valor Custo</th>
                    <th className={`${thFin} no-print`}>Bônus</th>
                    <th className={thLB}>Lucro Bruto</th>
                    <th className={thLB}>% LB</th>
                    <th className={thComm}>Com. s/ Venda</th>
                    <th className={thComm}>Com. s/ LB</th>
                    <th className={thComm}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {derivedRows.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-slate-400 text-sm">
                        Nenhuma venda encontrada no período.
                      </td>
                    </tr>
                  ) : [...derivedRows]
                    .map((r, ri) => ({ r, ri }))
                    .sort((a, b) => parseDV(a.r.dataVenda ?? '') - parseDV(b.r.dataVenda ?? ''))
                    .map(({ r, ri }, dri) => {
                    const bg     = dri % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
                    const key    = r.chassi || String(ri);
                    const linha  = lancamento?.linhas?.[key];
                    const ev     = editValues[key];
                    const cvVal  = editMode ? nInput(ev?.comVenda ?? '') : (linha?.comVenda ?? 0);
                    const clVal  = editMode ? nInput(ev?.comLB    ?? '') : (linha?.comLB    ?? 0);
                    const hasVal = editMode ? (cvVal !== 0 || clVal !== 0) : !!linha;
                    return (
                      <tr key={key} className={bg}>
                        <td className={`${tdBase} ${bg} text-left font-mono text-slate-700`}>{r.chassi || '—'}</td>
                        <td className={`${tdBase} ${bg} text-left text-slate-700`}>{r.modelo || '—'}</td>
                        <td className={`${tdBase} ${bg} text-left font-mono text-slate-700 no-print`}>{r.nfVenda || '—'}</td>
                        <td className={`${tdBase} ${bg} text-left font-mono text-slate-700`}>{r.dataVenda || '—'}</td>
                        <td className={`${tdBase} ${bg} text-left text-slate-700 no-print`}>{r.transacao || '—'}</td>
                        <td className={`${tdBase} ${bg} text-right`}><NumCell value={n(r.valorVenda)} /></td>
                        <td className={`${tdBase} ${bg} text-right no-print`}><NumCell value={n(r.valorCusto)} /></td>
                        <td className={`${tdBase} ${bg} text-right no-print`}><NumCell value={r._d.bonus} /></td>
                        <td className={`${tdBase} ${bg} text-right`}><NumCell value={r._d.lucroBruto} /></td>
                        <td className={`${tdBase} ${bg} text-right`}><NumCell value={r._d.lucroBrutoPct} pct /></td>
                        {editMode ? (
                          <td className={`${tdBase} ${bg} p-1`}>
                            <input
                              type="text" inputMode="numeric"
                              value={ev?.comVenda ?? ''}
                              onChange={e => setEditValues(prev => ({ ...prev, [key]: { ...prev[key], comVenda: e.target.value } }))}
                              placeholder="0,00"
                              className="w-28 border border-violet-200 rounded px-2 py-1 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
                            />
                          </td>
                        ) : (
                          <td className={`${tdBase} ${bg} text-right`}>
                            {linha ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <NumCell value={linha.comVenda} />
                                {tab === 'usados' && linha.comVenda !== 0 && n(r.valorVenda) !== 0 && (
                                  <span className="text-[9px] text-slate-400 font-mono leading-none">
                                    {fmtPct(Math.abs(linha.comVenda) / Math.abs(n(r.valorVenda)) * 100)}
                                  </span>
                                )}
                              </div>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                        )}
                        {editMode ? (
                          <td className={`${tdBase} ${bg} p-1`}>
                            <input
                              type="text" inputMode="numeric"
                              value={ev?.comLB ?? ''}
                              onChange={e => setEditValues(prev => ({ ...prev, [key]: { ...prev[key], comLB: e.target.value } }))}
                              placeholder="0,00"
                              className="w-28 border border-violet-200 rounded px-2 py-1 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
                            />
                          </td>
                        ) : (
                          <td className={`${tdBase} ${bg} text-right`}>
                            {linha ? <NumCell value={linha.comLB} /> : <span className="text-slate-300">—</span>}
                          </td>
                        )}
                        <td className={`${tdBase} ${bg} text-right`}>
                          {hasVal ? <NumCell value={cvVal + clVal} /> : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {derivedRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-800 text-white font-semibold text-xs">
                      <td colSpan={5} className="px-3 py-2.5 text-right border-r border-slate-700">
                        Total ({totals.netCount} {totals.netCount === 1 ? 'venda' : 'vendas'})
                        {totals.countV07 > 0 && (
                          <span className="ml-1 text-slate-400 font-normal text-[10px]">({totals.countV21} V21 − {totals.countV07} V07)</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono">{fmtBRL(totals.totVenda)}</td>
                      <td className="px-2 py-2.5 text-right font-mono no-print">{fmtBRL(totals.totCusto)}</td>
                      <td className="px-2 py-2.5 text-right font-mono no-print">{fmtBRL(totals.totBonus)}</td>
                      <td className={`px-2 py-2.5 text-right font-mono ${totals.totLB < 0 ? 'text-red-300' : ''}`}>
                        {fmtBRL(totals.totLB)}
                      </td>
                      <td className={`px-2 py-2.5 text-right font-mono ${totals.totLBPct < 0 ? 'text-red-300' : ''}`}>
                        {fmtPct(totals.totLBPct)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono">
                        {totals.totComV !== null ? fmtBRL(totals.totComV) : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono">
                        {totals.totComLB !== null ? fmtBRL(totals.totComLB) : '—'}
                      </td>
                      <td className={`px-2 py-2.5 text-right font-mono ${totals.totTotal !== null && totals.totTotal < 0 ? 'text-red-300' : ''}`}>
                        {totals.totTotal !== null ? fmtBRL(totals.totTotal) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* ── Histórico ─────────────────────────────────────────────────── */}
          {showHistorico && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">Histórico · Últimos 12 meses</span>
              </div>
              <div className="divide-y divide-slate-100">
                {historico.map(({ year: y, month: m, lancamento: lanc, total }) => (
                  <div key={`${y}-${m}`} className="px-4 py-3 flex items-center gap-3">
                    <span className="w-40 text-sm text-slate-700 flex-shrink-0">
                      {MONTH_NAMES[m - 1]} de {y}
                    </span>
                    {lanc ? (
                      lanc.pago ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Pago
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                          <Clock className="w-3 h-3" /> Pendente
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-slate-300">Sem lançamento</span>
                    )}
                    {lanc && total > 0 && (
                      <span className="ml-auto text-sm font-mono font-semibold text-slate-700">
                        R$ {fmtBRL(total)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Assinaturas ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assinaturas</p>
            </div>
            <div className="px-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                {(Object.entries(CAMPO_LABELS) as [CampoAssinaturaComissao, string][]).map(([campo, label]) => {
                  const ass = lancamento?.assinaturas?.[campo];
                  return (
                    <div key={campo} className="flex flex-col gap-1.5">
                      <p className="text-xs text-slate-500 font-medium">{label}</p>
                      {ass ? (
                        <div className="border border-emerald-200 rounded-lg px-4 py-3 bg-emerald-50 flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <div className="flex flex-col">
                              {ass.name && ass.name !== ass.username && (
                                <span className="text-sm font-bold text-emerald-900">{ass.name}</span>
                              )}
                              <span className="text-xs text-emerald-700">{ass.username}</span>
                            </div>
                          </div>
                          <p className="text-xs text-emerald-600">{new Date(ass.dataHora).toLocaleString('pt-BR')}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-700" />
                            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Assinatura Eletrônica</p>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAbrirAssinatura(campo)}
                          className="border-2 border-dashed border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-400 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50 transition-colors flex items-center gap-2 justify-center no-print"
                        >
                          <PenLine className="w-4 h-4" />
                          Assinar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>
      {/* ── Dialog: Reabrir demonstrativo ─────────────────────────────── */}
      {reabrirDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <LockOpen className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-800">Reabrir demonstrativo</h3>
              </div>
              <button onClick={() => setReopenDialog(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">
                ✕
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <p className="text-sm text-slate-600">
                Isso irá reverter o status para <strong>Pendente</strong>. Digite a senha para confirmar.
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Senha</label>
                <input
                  type="password"
                  autoFocus
                  value={reabrirDialog.senha}
                  onChange={e => setReopenDialog(prev => prev ? { ...prev, senha: e.target.value, erro: null } : prev)}
                  onKeyDown={e => e.key === 'Enter' && handleConfirmarReabrir()}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Digite a senha de reabertura"
                />
                {reabrirDialog.erro && (
                  <p className="text-xs text-red-500 mt-0.5">{reabrirDialog.erro}</p>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setReopenDialog(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarReabrir}
                className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors"
              >
                Reabrir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog: Assinatura Eletrônica ─────────────────────────── */}
      {assinaDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Assinar — {CAMPO_LABELS[assinaDialog.campo]}
                </h3>
              </div>
              <button onClick={() => setAssinaDialog(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">✕</button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuário</label>
                <div className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-slate-50 select-none">
                  {session?.username ?? '—'}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Senha</label>
                <input
                  type="password"
                  autoFocus
                  value={assinaDialog.senha}
                  onChange={e => setAssinaDialog(prev => prev ? { ...prev, senha: e.target.value, erro: null } : prev)}
                  onKeyDown={e => e.key === 'Enter' && !assinaDialog.loading && handleConfirmarAssinatura()}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="Digite sua senha"
                />
                {assinaDialog.erro && (
                  <p className="text-xs text-red-500 mt-0.5">{assinaDialog.erro}</p>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setAssinaDialog(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarAssinatura}
                disabled={assinaDialog.loading || !assinaDialog.senha}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                <PenLine className="w-3.5 h-3.5" />
                {assinaDialog.loading ? 'Assinando...' : 'Assinar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
