import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { ChevronRight, ChevronLeft, ChevronDown, Printer, PenLine, ShieldCheck, DollarSign, LockOpen, ClipboardList, FileText, BarChart2, Search, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { apiLogin } from '@/lib/authClient';
import {
  loadVendasResultadoRows,
  type VendasResultadoRow,
} from '@/components/VendasBonificacoesDashboard/vendasResultadoStorage';
import {
  loadPeriodos,
  periodoKey,
  type PeriodoApuracao,
} from './comissoesCalculoPeriodoStorage';
import type { CampoAssinaturaComissao, AssinaturaDigital } from './comissoesLancamentosStorage';
import {
  loadPremios,
  savePremios,
  loadAcaoLancamentos,
  saveAcaoLancamentos,
  loadAcaoConfig,
  saveAcaoConfig,
  type AcaoTab,
  type PremioMap,
  type AcaoLancamentosMap,
  type AcaoLancamento,
  type AcaoConfigMap,
  type AcaoItemSnapshot,
} from './acoesVendasStorage';

// ─── Constantes ───────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'] as const;
const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const AVAILABLE_YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

const CAMPO_LABELS: Record<CampoAssinaturaComissao, string> = {
  financeiro:         'Financeiro',
  gerenciaComercial:  'Gerência Comercial',
  diretoriaComercial: 'Diretoria Comercial',
  diretoria:          'Diretoria',
};
const CAMPO_LABELS_CURTO: Record<CampoAssinaturaComissao, string> = {
  financeiro:         'Fin',
  gerenciaComercial:  'G.Com',
  diretoriaComercial: 'D.Com',
  diretoria:          'Dir',
};
const CAMPOS_ASSINATURA = Object.keys(CAMPO_LABELS) as CampoAssinaturaComissao[];

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
function fixVendedorName(name: string): string {
  return name
    .replace(/JOS[\uFFFD?]\s/gi,        'JOSE ')
    .replace(/LOUREN[\uFFFD?]O/gi,      'LOURENCO')
    .replace(/CONCEI[\uFFFD?]{1,2}O/gi, 'CONCEICAO');
}
function calcDerived(row: VendasResultadoRow) {
  const valorVenda    = n(row.valorVenda);
  const valorCusto    = n(row.valorCusto);
  const bonus         = n(row.bonusVarejo) + n(row.bonusTradeIn);
  const lucroBruto    = valorVenda - valorCusto + bonus;
  const lucroBrutoPct = valorVenda !== 0 ? (lucroBruto / valorVenda) * 100 : 0;
  return { bonus, lucroBruto, lucroBrutoPct };
}
function normalizeKeyPart(v: string | undefined): string {
  return String(v ?? '').trim().toUpperCase();
}
function stableRowKey(row: VendasResultadoRow, idx: number): string {
  if (row.id) return `id:${row.id}`;
  const chassi = normalizeKeyPart(row.chassi);
  const nf     = normalizeKeyPart(row.nfVenda);
  const data   = normalizeKeyPart(row.dataVenda);
  const tx     = normalizeKeyPart(row.transacao);
  if (chassi || nf || data || tx) return `txn:${chassi}|${nf}|${data}|${tx}`;
  return `idx:${idx}`;
}
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Item premiado usado no demonstrativo/resumo
interface PremiadoItem {
  tab: AcaoTab;
  row: VendasResultadoRow;
  premio: number;
  derived: { bonus: number; lucroBruto: number; lucroBrutoPct: number };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function AcoesVendasView() {
  const { session } = useAuth();

  const [filterYear,  setFilterYear]  = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [subView, setSubView] = useState<'relacao' | 'demonstrativo' | 'resumo'>('relacao');
  const [relacaoTab, setRelacaoTab] = useState<AcaoTab>('novos');

  const [rowsNovos,  setRowsNovos]  = useState<VendasResultadoRow[]>([]);
  const [rowsUsados, setRowsUsados] = useState<VendasResultadoRow[]>([]);
  const [periodoNovos,  setPeriodoNovos]  = useState<Record<string, PeriodoApuracao>>({});
  const [periodoUsados, setPeriodoUsados] = useState<Record<string, PeriodoApuracao>>({});
  const [premiosNovos,  setPremiosNovos]  = useState<PremioMap>({});
  const [premiosUsados, setPremiosUsados] = useState<PremioMap>({});
  const [lancamentos, setLancamentos] = useState<AcaoLancamentosMap>({});
  const [configMap, setConfigMap] = useState<AcaoConfigMap>({});
  const [loading, setLoading] = useState(true);

  const [selectedVendedor, setSelectedVendedor] = useState<string | null>(null);
  const [nomeDraft, setNomeDraft] = useState('');
  const [savingNome, setSavingNome] = useState(false);

  const pk = periodoKey(filterYear, filterMonth);
  const competencia = `${MONTH_NAMES[filterMonth - 1]} de ${filterYear}`;
  const nomeAcao = configMap[pk]?.nome ?? '';

  // Carrega tudo ao montar
  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadVendasResultadoRows('novos'),
      loadVendasResultadoRows('usados'),
      loadPeriodos('novos'),
      loadPeriodos('usados'),
      loadPremios('novos'),
      loadPremios('usados'),
      loadAcaoLancamentos(),
      loadAcaoConfig(),
    ]).then(([rn, ru, pn, pu, prn, pru, lancs, cfg]) => {
      setRowsNovos(rn);
      setRowsUsados(ru);
      setPeriodoNovos(pn);
      setPeriodoUsados(pu);
      setPremiosNovos(prn);
      setPremiosUsados(pru);
      setLancamentos(lancs);
      setConfigMap(cfg);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setNomeDraft(configMap[pk]?.nome ?? '');
    setSelectedVendedor(null);
  }, [pk, configMap]);

  // Períodos salvos por aba
  const savedPeriodo = useCallback((tab: AcaoTab): PeriodoApuracao | undefined => {
    return (tab === 'novos' ? periodoNovos : periodoUsados)[pk];
  }, [periodoNovos, periodoUsados, pk]);

  // Linhas do período por aba
  const periodRowsNovos = useMemo(() => filterByPeriodo(rowsNovos, savedPeriodo('novos')), [rowsNovos, savedPeriodo]);
  const periodRowsUsados = useMemo(() => filterByPeriodo(rowsUsados, savedPeriodo('usados')), [rowsUsados, savedPeriodo]);

  const premForTab = (tab: AcaoTab) => (tab === 'novos' ? premiosNovos : premiosUsados)[pk] ?? {};

  // Itens premiados por aba (rowKey selecionado)
  const premiadosNovos = useMemo(
    () => buildPremiados('novos', periodRowsNovos, premiosNovos[pk] ?? {}),
    [periodRowsNovos, premiosNovos, pk],
  );
  const premiadosUsados = useMemo(
    () => buildPremiados('usados', periodRowsUsados, premiosUsados[pk] ?? {}),
    [periodRowsUsados, premiosUsados, pk],
  );

  // Agrupa premiados por vendedor (nome exibição)
  const vendedoresPremiados = useMemo(() => {
    const map = new Map<string, PremiadoItem[]>();
    [...premiadosNovos, ...premiadosUsados].forEach(item => {
      const v = item.row.vendedor?.trim() || '(sem nome)';
      map.set(v, [...(map.get(v) ?? []), item]);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [premiadosNovos, premiadosUsados]);

  // ── Persistência de prêmios ────────────────────────────────────────────────
  const setPremios = (tab: AcaoTab, next: PremioMap, persist = true) => {
    if (tab === 'novos') setPremiosNovos(next); else setPremiosUsados(next);
    if (persist) savePremios(tab, next);
  };

  function toggleSelect(tab: AcaoTab, rowKey: string) {
    const cur = (tab === 'novos' ? premiosNovos : premiosUsados);
    const forPk = { ...(cur[pk] ?? {}) };
    if (rowKey in forPk) delete forPk[rowKey];
    else forPk[rowKey] = 0;
    setPremios(tab, { ...cur, [pk]: forPk });
  }

  function setPremioValue(tab: AcaoTab, rowKey: string, value: number, persist = false) {
    const cur = (tab === 'novos' ? premiosNovos : premiosUsados);
    const forPk = { ...(cur[pk] ?? {}), [rowKey]: value };
    setPremios(tab, { ...cur, [pk]: forPk }, persist);
  }

  function persistPremios(tab: AcaoTab) {
    savePremios(tab, tab === 'novos' ? premiosNovos : premiosUsados);
  }

  // ── Nome da ação ───────────────────────────────────────────────────────────
  async function handleSaveNome() {
    setSavingNome(true);
    try {
      const next = { ...configMap, [pk]: { nome: nomeDraft.trim() } };
      setConfigMap(next);
      await saveAcaoConfig(next);
      toast.success('Nome da ação salvo.');
    } finally {
      setSavingNome(false);
    }
  }

  // ── Lançamentos (pago/assinatura) ──────────────────────────────────────────
  const persistLancamentos = async (next: AcaoLancamentosMap) => {
    setLancamentos(next);
    await saveAcaoLancamentos(next);
  };

  function getLancamento(vendedor: string): AcaoLancamento | undefined {
    return lancamentos[pk]?.[vendedor];
  }

  async function marcarPago(vendedor: string, itens: PremiadoItem[]) {
    const existing = getLancamento(vendedor);
    const snapshotItens: AcaoItemSnapshot[] = itens.map(it => ({ tab: it.tab, row: { ...it.row }, premio: it.premio }));
    const upd: AcaoLancamento = {
      ...existing,
      pago: true,
      dataPagamento: new Date().toISOString().split('T')[0],
      snapshotItens,
      assinaturas: existing?.assinaturas,
    };
    await persistLancamentos({ ...lancamentos, [pk]: { ...(lancamentos[pk] ?? {}), [vendedor]: upd } });
    toast.success('Demonstrativo marcado como pago.');
  }

  async function reabrir(vendedor: string) {
    const existing = getLancamento(vendedor);
    if (!existing) return;
    const upd: AcaoLancamento = { pago: false, assinaturas: {} };
    await persistLancamentos({ ...lancamentos, [pk]: { ...(lancamentos[pk] ?? {}), [vendedor]: upd } });
    toast.success('Demonstrativo reaberto.');
  }

  async function assinar(vendedor: string, campo: CampoAssinaturaComissao, assinatura: AssinaturaDigital) {
    const existing = getLancamento(vendedor) ?? { pago: false };
    const upd: AcaoLancamento = {
      ...existing,
      assinaturas: { ...(existing.assinaturas ?? {}), [campo]: assinatura },
    };
    await persistLancamentos({ ...lancamentos, [pk]: { ...(lancamentos[pk] ?? {}), [vendedor]: upd } });
  }

  // Vendedores com demonstrativo já pago no período (usado para travar edição de prêmios)
  const pagosVendedores = useMemo(() => {
    const set = new Set<string>();
    Object.entries(lancamentos[pk] ?? {}).forEach(([v, l]) => { if (l.pago) set.add(v); });
    return set;
  }, [lancamentos, pk]);

  async function marcarTodosPago() {
    const today = new Date().toISOString().split('T')[0];
    const pkObj = { ...(lancamentos[pk] ?? {}) };
    let changed = false;
    vendedoresPremiados.forEach(([vendedor, itens]) => {
      const existing = pkObj[vendedor];
      if (existing?.pago) return;
      changed = true;
      pkObj[vendedor] = {
        ...existing,
        pago: true,
        dataPagamento: existing?.dataPagamento ?? today,
        snapshotItens: itens.map(it => ({ tab: it.tab, row: { ...it.row }, premio: it.premio })),
        assinaturas: existing?.assinaturas,
      };
    });
    if (changed) {
      await persistLancamentos({ ...lancamentos, [pk]: pkObj });
      toast.success('Todos os demonstrativos marcados como pago.');
    }
  }

  async function assinarTodos(campo: CampoAssinaturaComissao, assinatura: AssinaturaDigital) {
    const pkObj = { ...(lancamentos[pk] ?? {}) };
    let count = 0;
    vendedoresPremiados.forEach(([vendedor]) => {
      const existing = pkObj[vendedor] ?? { pago: false };
      if (existing.assinaturas?.[campo]) return;
      count++;
      pkObj[vendedor] = { ...existing, assinaturas: { ...(existing.assinaturas ?? {}), [campo]: assinatura } };
    });
    if (count > 0) {
      await persistLancamentos({ ...lancamentos, [pk]: pkObj });
      toast.success(`Assinatura de ${CAMPO_LABELS[campo]} registrada em ${count} demonstrativo(s).`);
    }
  }

  // ── Impressão ──────────────────────────────────────────────────────────────
  function printHtml(html: string) {
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
    };
    window.print();
  }

  function periodoLabelFor(tab: AcaoTab): string {
    const sp = savedPeriodo(tab);
    return sp?.de && sp?.ate ? `${fmtDate(sp.de)} a ${fmtDate(sp.ate)}` : '—';
  }

  function buildVendedorHtml(vendedor: string, itens: PremiadoItem[], isLast: boolean): string {
    const lanc = getLancamento(vendedor);
    const source: PremiadoItem[] = lanc?.pago && lanc.snapshotItens?.length
      ? lanc.snapshotItens.map(s => ({ tab: s.tab, row: s.row, premio: s.premio, derived: calcDerived(s.row) }))
      : itens;
    const novos  = source.filter(i => i.tab === 'novos');
    const usados = source.filter(i => i.tab === 'usados');
    const pago = lanc?.pago ?? false;

    const sectionHtml = (label: string, list: PremiadoItem[]) => {
      if (list.length === 0) return '';
      const sorted = [...list].sort((a, b) => (parseDataVenda(a.row.dataVenda)?.getTime() ?? 0) - (parseDataVenda(b.row.dataVenda)?.getTime() ?? 0));
      const tdB = 'padding:6px 5px;border-bottom:1px solid #f1f5f9;font-size:8px;';
      const thS = (bg: string, align = 'left') => `background:${bg};color:white;padding:4px 5px;font-size:7.5px;font-weight:600;white-space:nowrap;text-align:${align};`;
      const tfB = 'background:#1e293b;color:white;padding:5px 6px;font-size:8px;font-weight:700;text-align:right;border-right:1px solid #475569;';
      const numColor = (v: number) => v < 0 ? 'color:#dc2626' : v === 0 ? 'color:#94a3b8' : 'color:#1e293b';
      let totV = 0, totC = 0, totBon = 0, totLB = 0, totP = 0;
      const rowsHtml = sorted.map((it, i) => {
        const vv = n(it.row.valorVenda), vc = n(it.row.valorCusto);
        totV += vv; totC += vc; totBon += it.derived.bonus; totLB += it.derived.lucroBruto; totP += it.premio;
        const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `<tr style="background:${bg}">
          <td style="${tdB}font-family:monospace;color:#334155;">${escapeHtml(it.row.chassi || '—')}</td>
          <td style="${tdB}color:#334155;white-space:normal;word-break:break-word;max-width:110px;">${escapeHtml(it.row.modelo || '—')}</td>
          <td style="${tdB}color:#334155;">${escapeHtml(it.row.nfVenda || '—')}</td>
          <td style="${tdB}font-family:monospace;color:#334155;">${escapeHtml(it.row.dataVenda || '—')}</td>
          <td style="${tdB}color:#334155;">${escapeHtml(it.row.transacao || '—')}</td>
          <td style="${tdB}text-align:right;${numColor(vv)}">${fmtBRL(vv)}</td>
          <td style="${tdB}text-align:right;${numColor(vc)}">${fmtBRL(vc)}</td>
          <td style="${tdB}text-align:right;${numColor(it.derived.bonus)}">${fmtBRL(it.derived.bonus)}</td>
          <td style="${tdB}text-align:right;${numColor(it.derived.lucroBruto)}">${fmtBRL(it.derived.lucroBruto)}</td>
          <td style="${tdB}text-align:right;${numColor(it.derived.lucroBrutoPct)}">${fmtPct(it.derived.lucroBrutoPct)}</td>
          <td style="${tdB}text-align:right;font-weight:700;color:#6d28d9;">${fmtBRL(it.premio)}</td>
        </tr>`;
      }).join('');
      return `<p style="font-size:9px;font-weight:700;color:#334155;margin:10px 0 4px;">${label} — ${list.length} ${list.length === 1 ? 'chassi' : 'chassis'}</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="${thS('#334155')}">Chassi</th>
          <th style="${thS('#334155')}">Modelo</th>
          <th style="${thS('#334155')}">NF Venda</th>
          <th style="${thS('#334155')}">Data Venda</th>
          <th style="${thS('#334155')}">Transação</th>
          <th style="${thS('#065f46', 'right')}">Vl. Venda</th>
          <th style="${thS('#065f46', 'right')}">Vl. Custo</th>
          <th style="${thS('#065f46', 'right')}">Bônus</th>
          <th style="${thS('#0f766e', 'right')}">Lc. Bruto</th>
          <th style="${thS('#0f766e', 'right')}">% LB</th>
          <th style="${thS('#6d28d9', 'right')}">Prêmio</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr>
          <td colspan="5" style="${tfB}text-align:left;">Total ${label}</td>
          <td style="${tfB}">${fmtBRL(totV)}</td>
          <td style="${tfB}">${fmtBRL(totC)}</td>
          <td style="${tfB}">${fmtBRL(totBon)}</td>
          <td style="${tfB}">${fmtBRL(totLB)}</td>
          <td style="${tfB}"></td>
          <td style="${tfB}font-size:9px;">${fmtBRL(totP)}</td>
        </tr></tfoot>
      </table>`;
    };

    const totalPremio = source.reduce((s, i) => s + i.premio, 0);
    const pagoBadge = pago
      ? 'background:#d1fae5;color:#065f46;border:1px solid #6ee7b7'
      : 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d';

    const assinaturas = lanc?.assinaturas ?? {};
    const camposHtml = CAMPOS_ASSINATURA.map(key => {
      const ass = assinaturas[key];
      const label = CAMPO_LABELS[key];
      if (ass) {
        const dt = new Date(ass.dataHora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `<div>
          <p style="font-size:7px;font-weight:600;color:#475569;margin:0 0 4px;">${label}</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:6px 8px;">
            <p style="font-size:7.5px;color:#15803d;font-weight:600;margin:0;">${escapeHtml(ass.name || ass.username)}</p>
            <p style="font-size:7px;color:#16a34a;margin:2px 0 0;">${dt}</p>
            <p style="font-size:6.5px;font-weight:700;color:#15803d;letter-spacing:0.05em;margin:3px 0 0;">&#10003; ASSINATURA ELETRÔNICA</p>
          </div>
        </div>`;
      }
      return `<div>
        <p style="font-size:7px;font-weight:600;color:#475569;margin:0 0 4px;">${label}</p>
        <div style="border:1.5px dashed #cbd5e1;border-radius:6px;padding:8px;text-align:center;"><p style="font-size:7px;color:#94a3b8;margin:0;">—</p></div>
      </div>`;
    }).join('');

    return `<div style="page-break-after:${isLast ? 'avoid' : 'always'};padding-bottom:${isLast ? '0' : '12px'};display:flex;flex-direction:column;min-height:260mm;">
      <div style="background:#1e293b;color:white;border-radius:10px;overflow:hidden;margin-bottom:8px;">
        <div style="padding:14px 18px;display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <p style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 3px;">Demonstrativo de Ação de Vendas${nomeAcao ? ' — ' + escapeHtml(nomeAcao) : ''}</p>
            <p style="font-size:15px;font-weight:700;margin:0 0 3px;">${escapeHtml(fixVendedorName(vendedor))}</p>
          </div>
          <div style="text-align:right;">
            <p style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 3px;">Competência</p>
            <p style="font-size:15px;font-weight:700;margin:0 0 3px;">${competencia}</p>
          </div>
        </div>
        <div style="background:#0f172a;padding:6px 18px;display:flex;align-items:center;gap:8px;">
          <span style="${pagoBadge};padding:2px 8px;border-radius:20px;font-size:7.5px;font-weight:700;">${pago ? 'Pago' : 'Pendente'}</span>
          <span style="background:#f8fafc;color:#475569;border:1px solid #e2e8f0;padding:2px 8px;border-radius:20px;font-size:7.5px;font-weight:600;">Total do prêmio: R$ ${fmtBRL(totalPremio)}</span>
        </div>
      </div>
      ${sectionHtml('Novos', novos)}
      ${sectionHtml('Usados', usados)}
      ${novos.length > 0 && usados.length > 0 ? `<div style="margin-top:10px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:8px 12px;display:flex;justify-content:flex-end;align-items:center;gap:10px;">
        <span style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6d28d9;">Total do prêmio (Novos + Usados)</span>
        <span style="font-size:12px;font-weight:700;color:#6d28d9;">R$ ${fmtBRL(totalPremio)}</span>
      </div>` : ''}
      <div style="margin-top:12px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;">
        <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 8px;">ASSINATURAS</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">${camposHtml}</div>
      </div>
    </div>`;
  }

  function handlePrintVendedor(vendedor: string, itens: PremiadoItem[]) {
    printHtml(buildVendedorHtml(vendedor, itens, true));
  }

  function handlePrintAll() {
    if (vendedoresPremiados.length === 0) { toast.error('Nenhum vendedor premiado no período.'); return; }
    const html = vendedoresPremiados.map(([v, itens], idx, arr) => buildVendedorHtml(v, itens, idx === arr.length - 1)).join('');
    printHtml(html);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Carregando...</div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
      {/* Barra: competência + nome da ação */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ano</span>
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex items-center gap-0.5 flex-wrap">
            {MONTHS.map((m, i) => (
              <button
                key={m}
                onClick={() => setFilterMonth(i + 1)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  filterMonth === i + 1 ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Nome da ação</span>
          <input
            value={nomeDraft}
            onChange={e => setNomeDraft(e.target.value)}
            placeholder="ex: Ação Setembro – Feirão"
            className="border border-slate-200 rounded px-2.5 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleSaveNome}
            disabled={savingNome || nomeDraft.trim() === (configMap[pk]?.nome ?? '')}
            className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded px-3 py-1.5 font-semibold"
          >
            <Check className="w-3.5 h-3.5" /> Salvar
          </button>
        </div>
      </div>

      {/* Sub-abas */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-0 flex-shrink-0">
        {([
          { id: 'relacao'       as const, label: 'Relação dos chassis', icon: ClipboardList },
          { id: 'demonstrativo' as const, label: 'Demonstrativo',       icon: FileText },
          { id: 'resumo'        as const, label: 'Resumo',              icon: BarChart2 },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => { setSubView(t.id); setSelectedVendedor(null); }}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              subView === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {subView === 'relacao' && (
          <RelacaoTab
            relacaoTab={relacaoTab}
            setRelacaoTab={setRelacaoTab}
            periodRows={relacaoTab === 'novos' ? periodRowsNovos : periodRowsUsados}
            premForPk={premForTab(relacaoTab)}
            hasPeriodo={!!savedPeriodo(relacaoTab)?.de && !!savedPeriodo(relacaoTab)?.ate}
            periodoLabel={periodoLabelFor(relacaoTab)}
            pagosVendedores={pagosVendedores}
            onToggle={rk => toggleSelect(relacaoTab, rk)}
            onPremioChange={(rk, v) => setPremioValue(relacaoTab, rk, v)}
            onPremioCommit={() => persistPremios(relacaoTab)}
          />
        )}

        {subView === 'demonstrativo' && (
          selectedVendedor ? (
            <VendedorDemonstrativo
              vendedor={selectedVendedor}
              itens={vendedoresPremiados.find(([v]) => v === selectedVendedor)?.[1] ?? []}
              nomeAcao={nomeAcao}
              competencia={competencia}
              periodoNovosLabel={periodoLabelFor('novos')}
              periodoUsadosLabel={periodoLabelFor('usados')}
              lancamento={getLancamento(selectedVendedor)}
              session={session}
              onBack={() => setSelectedVendedor(null)}
              onMarcarPago={itens => marcarPago(selectedVendedor, itens)}
              onReabrir={() => reabrir(selectedVendedor)}
              onAssinar={(campo, ass) => assinar(selectedVendedor, campo, ass)}
              onPrint={itens => handlePrintVendedor(selectedVendedor, itens)}
            />
          ) : (
            <DemonstrativoLista
              vendedores={vendedoresPremiados}
              lancamentos={lancamentos[pk] ?? {}}
              nomeAcao={nomeAcao}
              session={session}
              onOpen={setSelectedVendedor}
              onPrintAll={handlePrintAll}
              onMarcarTodosPago={marcarTodosPago}
              onAssinarTodos={assinarTodos}
            />
          )
        )}

        {subView === 'resumo' && (
          <ResumoTab
            premiadosNovos={premiadosNovos}
            premiadosUsados={premiadosUsados}
            lancamentosPk={lancamentos[pk] ?? {}}
            nomeAcao={nomeAcao}
            competencia={competencia}
            printHtml={printHtml}
          />
        )}
      </div>
    </div>
  );
}

// ─── Helpers de dados ─────────────────────────────────────────────────────────
function filterByPeriodo(rows: VendasResultadoRow[], sp: PeriodoApuracao | undefined): VendasResultadoRow[] {
  if (!sp?.de || !sp?.ate) return [];
  const de  = new Date(sp.de);
  const ate = new Date(sp.ate);
  ate.setHours(23, 59, 59, 999);
  return rows.filter(r => {
    const d = parseDataVenda(r.dataVenda);
    return d !== null && d >= de && d <= ate;
  });
}

function buildPremiados(tab: AcaoTab, periodRows: VendasResultadoRow[], premForPk: Record<string, number>): PremiadoItem[] {
  const out: PremiadoItem[] = [];
  periodRows.forEach((row, idx) => {
    const key = stableRowKey(row, idx);
    if (key in premForPk) {
      out.push({ tab, row, premio: premForPk[key], derived: calcDerived(row) });
    }
  });
  return out;
}

// ─── Aba: Relação dos chassis ─────────────────────────────────────────────────
function RelacaoTab({
  relacaoTab, setRelacaoTab, periodRows, premForPk, hasPeriodo, periodoLabel, pagosVendedores,
  onToggle, onPremioChange, onPremioCommit,
}: {
  relacaoTab: AcaoTab;
  setRelacaoTab: (t: AcaoTab) => void;
  periodRows: VendasResultadoRow[];
  premForPk: Record<string, number>;
  hasPeriodo: boolean;
  periodoLabel: string;
  pagosVendedores: Set<string>;
  onToggle: (rowKey: string) => void;
  onPremioChange: (rowKey: string, value: number) => void;
  onPremioCommit: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [bulkValue, setBulkValue] = useState('');

  const rowsWithKey = useMemo(
    () => periodRows.map((row, idx) => ({ row, key: stableRowKey(row, idx) })),
    [periodRows],
  );

  const isPago = (row: VendasResultadoRow) => pagosVendedores.has(row.vendedor?.trim() || '(sem nome)');

  const filtered = useMemo(() => {
    const q = busca.trim().toUpperCase();
    if (!q) return rowsWithKey;
    return rowsWithKey.filter(({ row }) =>
      (row.chassi ?? '').toUpperCase().includes(q) ||
      (row.modelo ?? '').toUpperCase().includes(q) ||
      (row.vendedor ?? '').toUpperCase().includes(q),
    );
  }, [rowsWithKey, busca]);

  const selecionados = rowsWithKey.filter(({ key }) => key in premForPk);
  const totalPremios = selecionados.reduce((s, { key }) => s + (premForPk[key] || 0), 0);

  function applyBulk() {
    const v = parseFloat(bulkValue.replace(/\./g, '').replace(',', '.')) || 0;
    // Não altera chassis de vendedores com demonstrativo já pago
    selecionados.filter(({ row }) => !isPago(row)).forEach(({ key }) => onPremioChange(key, v));
    onPremioCommit();
  }

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-4">
      {/* Sub-abas Novos/Usados */}
      <div className="flex items-center gap-2">
        {(['novos', 'usados'] as AcaoTab[]).map(t => (
          <button
            key={t}
            onClick={() => setRelacaoTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              relacaoTab === t ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {t === 'novos' ? 'Novos' : 'Usados'}
          </button>
        ))}
        <span className="text-xs text-slate-400 ml-2">Período: {periodoLabel}</span>
      </div>

      {!hasPeriodo ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          Nenhum período de apuração salvo para este mês em <strong>{relacaoTab === 'novos' ? 'Novos' : 'Usados'}</strong>. Defina o período na aba <strong>Cálculo</strong> para listar os chassis.
        </div>
      ) : (
        <>
          {/* Resumo + ações */}
          <div className="flex flex-wrap items-center gap-4 bg-white border border-slate-200 rounded-lg px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Selecionados</span>
              <span className="text-lg font-bold text-slate-800">{selecionados.length}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Total prêmios</span>
              <span className="text-lg font-bold text-violet-700">R$ {fmtBRL(totalPremios)}</span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Aplicar aos selecionados:</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">R$</span>
                <input
                  value={bulkValue}
                  onChange={e => setBulkValue(e.target.value)}
                  placeholder="0,00"
                  className="w-24 border border-slate-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button
                onClick={applyBulk}
                disabled={selecionados.length === 0}
                className="text-xs bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white rounded px-3 py-1.5 font-semibold"
              >
                Aplicar
              </button>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar chassi, modelo, vendedor"
                className="pl-7 pr-2 py-1.5 border border-slate-200 rounded text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="w-10 px-3 py-2.5" />
                  <th className="text-left px-3 py-2.5 font-semibold">Chassi</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Modelo</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Data</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Vendedor</th>
                  <th className="text-right px-3 py-2.5 font-semibold w-40">Prêmio (R$)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-slate-400 text-sm py-8">Nenhum chassi no período.</td></tr>
                ) : filtered.map(({ row, key }) => {
                  const selected = key in premForPk;
                  const travado = isPago(row);
                  return (
                    <tr key={key} className={`border-b border-slate-100 ${travado ? 'bg-emerald-50/40' : selected ? 'bg-violet-50/40' : 'hover:bg-slate-50/60'}`}>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={travado}
                          onChange={() => onToggle(key)}
                          className="w-4 h-4 accent-violet-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.chassi || '—'}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{row.modelo || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.dataVenda || '—'}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {fixVendedorName(row.vendedor || '—')}
                        {travado && <span className="ml-1.5 text-[9px] font-bold text-emerald-600 bg-emerald-100 rounded px-1 py-0.5">PAGO</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!selected || travado}
                          value={selected ? (premForPk[key] || '') : ''}
                          onChange={e => onPremioChange(key, parseFloat(e.target.value) || 0)}
                          onBlur={onPremioCommit}
                          placeholder="0,00"
                          className="w-32 border border-slate-200 rounded px-2 py-1 text-sm text-right disabled:bg-slate-50 disabled:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Aba: Demonstrativo (lista de vendedores) ─────────────────────────────────
function DemonstrativoLista({
  vendedores, lancamentos, nomeAcao, session, onOpen, onPrintAll, onMarcarTodosPago, onAssinarTodos,
}: {
  vendedores: [string, PremiadoItem[]][];
  lancamentos: Record<string, AcaoLancamento>;
  nomeAcao: string;
  session: ReturnType<typeof useAuth>['session'];
  onOpen: (v: string) => void;
  onPrintAll: () => void;
  onMarcarTodosPago: () => Promise<void>;
  onAssinarTodos: (campo: CampoAssinaturaComissao, ass: AssinaturaDigital) => Promise<void>;
}) {
  const [marcando, setMarcando] = useState(false);
  const [assinaDialog, setAssinaDialog] = useState<{ campo: CampoAssinaturaComissao; senha: string; loading: boolean; erro: string | null } | null>(null);

  const totalPendentes = vendedores.filter(([v]) => !(lancamentos[v]?.pago)).length;

  async function confirmarAssinarTodos() {
    if (!assinaDialog || !session) return;
    setAssinaDialog(p => p ? { ...p, loading: true, erro: null } : p);
    const result = await apiLogin(session.username, assinaDialog.senha);
    if ('error' in result) {
      setAssinaDialog(p => p ? { ...p, loading: false, erro: 'Senha incorreta. Tente novamente.' } : p);
      return;
    }
    const assinatura: AssinaturaDigital = {
      username: session.username,
      name: (result.session.name ?? '') || undefined,
      dataHora: new Date().toISOString(),
    };
    await onAssinarTodos(assinaDialog.campo, assinatura);
    setAssinaDialog(null);
  }

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Vendedores premiados</h3>
          {nomeAcao && <p className="text-xs text-violet-600 font-medium">{nomeAcao}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={async () => { setMarcando(true); await onMarcarTodosPago(); setMarcando(false); }}
            disabled={vendedores.length === 0 || totalPendentes === 0 || marcando}
            className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg px-3 py-2 font-semibold"
          >
            <Check className="w-3.5 h-3.5" /> Marcar todos como pago
          </button>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400">Assinar todos:</span>
            {CAMPOS_ASSINATURA.map(campo => (
              <button
                key={campo}
                onClick={() => setAssinaDialog({ campo, senha: '', loading: false, erro: null })}
                disabled={vendedores.length === 0}
                className="flex items-center gap-1 text-[11px] border border-slate-200 rounded px-2 py-1.5 hover:bg-slate-50 disabled:opacity-40 font-semibold text-slate-600"
                title={`Assinar ${CAMPO_LABELS[campo]} de todos`}
              >
                <PenLine className="w-3 h-3" /> {CAMPO_LABELS_CURTO[campo]}
              </button>
            ))}
          </div>
          <button
            onClick={onPrintAll}
            disabled={vendedores.length === 0}
            className="flex items-center gap-1.5 text-xs border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 disabled:opacity-40 font-semibold text-slate-600"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimir todos
          </button>
        </div>
      </div>

      {vendedores.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-16">Nenhum vendedor com chassi premiado neste período.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {vendedores.map(([v, itens]) => {
            const total = itens.reduce((s, i) => s + i.premio, 0);
            const qtd = itens.length;
            const pago = lancamentos[v]?.pago ?? false;
            return (
              <button
                key={v}
                onClick={() => onOpen(v)}
                className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 hover:border-violet-300 hover:shadow-sm transition-all text-left"
              >
                <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {fixVendedorName(v).charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{fixVendedorName(v)}</p>
                  <p className="text-xs text-slate-400">{qtd} {qtd === 1 ? 'chassi' : 'chassis'}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pago ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {pago ? 'Pago' : 'Pendente'}
                </span>
                <span className="text-sm font-bold text-violet-700 tabular-nums">R$ {fmtBRL(total)}</span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            );
          })}
        </div>
      )}

      {/* Dialog assinar todos */}
      {assinaDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 flex flex-col gap-3">
            <p className="font-semibold text-slate-800 text-sm">Assinar todos — {CAMPO_LABELS[assinaDialog.campo]}</p>
            <p className="text-xs text-slate-500">Confirme sua senha para registrar a assinatura em todos os demonstrativos premiados.</p>
            <input value={session?.username ?? ''} readOnly className="border border-slate-200 bg-slate-50 rounded px-3 py-2 text-sm text-slate-500" />
            <input
              type="password"
              value={assinaDialog.senha}
              onChange={e => setAssinaDialog(p => p ? { ...p, senha: e.target.value, erro: null } : p)}
              onKeyDown={e => { if (e.key === 'Enter') confirmarAssinarTodos(); }}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Senha"
              autoFocus
            />
            {assinaDialog.erro && <p className="text-xs text-red-500">{assinaDialog.erro}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setAssinaDialog(null)} className="text-xs border border-slate-200 rounded px-3 py-2 hover:bg-slate-50">Cancelar</button>
              <button onClick={confirmarAssinarTodos} disabled={assinaDialog.loading} className="text-xs bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded px-4 py-2 font-semibold">
                {assinaDialog.loading ? 'Assinando...' : 'Assinar todos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Demonstrativo do vendedor ────────────────────────────────────────────────
function VendedorDemonstrativo({
  vendedor, itens, nomeAcao, competencia, periodoNovosLabel, periodoUsadosLabel,
  lancamento, session, onBack, onMarcarPago, onReabrir, onAssinar, onPrint,
}: {
  vendedor: string;
  itens: PremiadoItem[];
  nomeAcao: string;
  competencia: string;
  periodoNovosLabel: string;
  periodoUsadosLabel: string;
  lancamento: AcaoLancamento | undefined;
  session: ReturnType<typeof useAuth>['session'];
  onBack: () => void;
  onMarcarPago: (itens: PremiadoItem[]) => void;
  onReabrir: () => void;
  onAssinar: (campo: CampoAssinaturaComissao, ass: AssinaturaDigital) => void;
  onPrint: (itens: PremiadoItem[]) => void;
}) {
  const pago = lancamento?.pago ?? false;
  const source: PremiadoItem[] = pago && lancamento?.snapshotItens?.length
    ? lancamento.snapshotItens.map(s => ({ tab: s.tab, row: s.row, premio: s.premio, derived: calcDerived(s.row) }))
    : itens;
  const novos  = source.filter(i => i.tab === 'novos');
  const usados = source.filter(i => i.tab === 'usados');
  const totalPremio = source.reduce((s, i) => s + i.premio, 0);

  const [reabrirDialog, setReabrirDialog] = useState<{ senha: string; erro: string | null } | null>(null);
  const [assinaDialog, setAssinaDialog] = useState<{ campo: CampoAssinaturaComissao; senha: string; loading: boolean; erro: string | null } | null>(null);
  const [saving, setSaving] = useState(false);

  async function confirmarReabrir() {
    if (!reabrirDialog) return;
    if (reabrirDialog.senha !== '1985') { setReabrirDialog(p => p ? { ...p, erro: 'Senha incorreta.' } : p); return; }
    await onReabrir();
    setReabrirDialog(null);
  }

  async function confirmarAssinatura() {
    if (!assinaDialog || !session) return;
    setAssinaDialog(p => p ? { ...p, loading: true, erro: null } : p);
    const result = await apiLogin(session.username, assinaDialog.senha);
    if ('error' in result) {
      setAssinaDialog(p => p ? { ...p, loading: false, erro: 'Senha incorreta. Tente novamente.' } : p);
      return;
    }
    const assinatura: AssinaturaDigital = {
      username: session.username,
      name: (result.session.name ?? '') || undefined,
      dataHora: new Date().toISOString(),
    };
    await onAssinar(assinaDialog.campo, assinatura);
    toast.success(`Assinatura de ${CAMPO_LABELS[assinaDialog.campo]} registrada!`);
    setAssinaDialog(null);
  }

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-4">
      {/* Ações */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 hover:bg-slate-50">
          <ChevronLeft className="w-3.5 h-3.5" /> Vendedores
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => onPrint(source)} className="flex items-center gap-1.5 text-xs border border-slate-200 rounded px-3 py-1.5 hover:bg-slate-50 font-semibold text-slate-600">
            <Printer className="w-3.5 h-3.5" /> Imprimir PDF
          </button>
          {pago ? (
            <button onClick={() => setReabrirDialog({ senha: '', erro: null })} className="flex items-center gap-1.5 text-xs border border-amber-300 text-amber-700 rounded px-3 py-1.5 hover:bg-amber-50 font-semibold">
              <LockOpen className="w-3.5 h-3.5" /> Reabrir demonstrativo
            </button>
          ) : (
            <button
              onClick={async () => { setSaving(true); await onMarcarPago(source); setSaving(false); }}
              disabled={saving || source.length === 0}
              className="flex items-center gap-1.5 text-xs bg-amber-400 hover:bg-amber-500 disabled:opacity-40 text-amber-900 rounded px-3 py-1.5 font-semibold"
            >
              <DollarSign className="w-3.5 h-3.5" /> Marcar como pago
            </button>
          )}
        </div>
      </div>

      {/* Card demonstrativo */}
      <div id="acao-demo-print-area" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-800 text-white px-6 py-4 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Demonstrativo de Ação de Vendas{nomeAcao ? ` — ${nomeAcao}` : ''}
            </p>
            <p className="text-lg font-bold mt-0.5">{fixVendedorName(vendedor)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Competência</p>
            <p className="text-lg font-bold mt-0.5">{competencia}</p>
          </div>
        </div>
        <div className="bg-slate-900 px-6 py-2 flex items-center gap-3">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pago ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {pago ? 'Pago' : 'Pendente'}
          </span>
          <span className="text-[11px] text-slate-300">Total do prêmio: <strong className="text-white">R$ {fmtBRL(totalPremio)}</strong></span>
        </div>

        <div className="p-4 flex flex-col gap-6">
          {novos.length > 0 && <SecaoTabela label="Novos" itens={novos} periodoLabel={periodoNovosLabel} />}
          {usados.length > 0 && <SecaoTabela label="Usados" itens={usados} periodoLabel={periodoUsadosLabel} />}
          {novos.length > 0 && usados.length > 0 && (
            <div className="flex items-center justify-end gap-3 bg-violet-50 border border-violet-200 rounded-lg px-4 py-3">
              <span className="text-xs font-semibold text-violet-700 uppercase tracking-wider">Total do prêmio (Novos + Usados)</span>
              <span className="text-lg font-bold text-violet-700 tabular-nums">R$ {fmtBRL(totalPremio)}</span>
            </div>
          )}
          {source.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-6">Nenhum chassi premiado para este vendedor.</p>
          )}
        </div>

        {/* Assinaturas */}
        <div className="border-t border-slate-100 px-6 py-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Assinaturas</p>
          <div className="grid grid-cols-2 gap-3">
            {CAMPOS_ASSINATURA.map(campo => {
              const ass = lancamento?.assinaturas?.[campo];
              if (ass) {
                return (
                  <div key={campo} className="border border-emerald-200 rounded-lg px-3 py-2.5 bg-emerald-50">
                    <p className="text-[11px] font-bold text-emerald-700 mb-0.5">{CAMPO_LABELS[campo]}</p>
                    <p className="text-xs font-bold text-emerald-800">{ass.name || ass.username}</p>
                    <p className="text-[10px] text-emerald-500">{new Date(ass.dataHora).toLocaleString('pt-BR')}</p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> ASSINATURA ELETRÔNICA</p>
                  </div>
                );
              }
              return (
                <div key={campo} className="border border-dashed border-slate-300 rounded-lg px-3 py-2.5 bg-slate-50">
                  <p className="text-[11px] font-bold text-slate-400">{CAMPO_LABELS[campo]}</p>
                  <button
                    onClick={() => setAssinaDialog({ campo, senha: '', loading: false, erro: null })}
                    className="mt-2 flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-semibold no-print"
                  >
                    <PenLine className="w-3.5 h-3.5" /> Assinar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dialog reabrir */}
      {reabrirDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 flex flex-col gap-3">
            <p className="font-semibold text-slate-800 text-sm">Reabrir demonstrativo</p>
            <p className="text-xs text-slate-500">Isso remove o pagamento e todas as assinaturas. Digite a senha para confirmar.</p>
            <input
              type="password"
              value={reabrirDialog.senha}
              onChange={e => setReabrirDialog(p => p ? { ...p, senha: e.target.value, erro: null } : p)}
              onKeyDown={e => { if (e.key === 'Enter') confirmarReabrir(); }}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Senha"
              autoFocus
            />
            {reabrirDialog.erro && <p className="text-xs text-red-500">{reabrirDialog.erro}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setReabrirDialog(null)} className="text-xs border border-slate-200 rounded px-3 py-2 hover:bg-slate-50">Cancelar</button>
              <button onClick={confirmarReabrir} className="text-xs bg-amber-500 hover:bg-amber-600 text-white rounded px-4 py-2 font-semibold">Reabrir</button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog assinatura */}
      {assinaDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 flex flex-col gap-3">
            <p className="font-semibold text-slate-800 text-sm">Assinar — {CAMPO_LABELS[assinaDialog.campo]}</p>
            <p className="text-xs text-slate-500">Confirme sua senha para registrar a assinatura eletrônica.</p>
            <input value={session?.username ?? ''} readOnly className="border border-slate-200 bg-slate-50 rounded px-3 py-2 text-sm text-slate-500" />
            <input
              type="password"
              value={assinaDialog.senha}
              onChange={e => setAssinaDialog(p => p ? { ...p, senha: e.target.value, erro: null } : p)}
              onKeyDown={e => { if (e.key === 'Enter') confirmarAssinatura(); }}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Senha"
              autoFocus
            />
            {assinaDialog.erro && <p className="text-xs text-red-500">{assinaDialog.erro}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setAssinaDialog(null)} className="text-xs border border-slate-200 rounded px-3 py-2 hover:bg-slate-50">Cancelar</button>
              <button onClick={confirmarAssinatura} disabled={assinaDialog.loading} className="text-xs bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded px-4 py-2 font-semibold">
                {assinaDialog.loading ? 'Assinando...' : 'Assinar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Seção de tabela (Novos ou Usados) ────────────────────────────────────────
function SecaoTabela({ label, itens, periodoLabel }: { label: string; itens: PremiadoItem[]; periodoLabel: string }) {
  const sorted = [...itens].sort((a, b) => (parseDataVenda(a.row.dataVenda)?.getTime() ?? 0) - (parseDataVenda(b.row.dataVenda)?.getTime() ?? 0));
  const tot = sorted.reduce((acc, it) => {
    acc.v += n(it.row.valorVenda); acc.c += n(it.row.valorCusto);
    acc.bon += it.derived.bonus; acc.lb += it.derived.lucroBruto; acc.p += it.premio;
    return acc;
  }, { v: 0, c: 0, bon: 0, lb: 0, p: 0 });

  const numColor = (v: number) => v < 0 ? 'text-red-600' : v === 0 ? 'text-slate-400' : 'text-slate-800';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-bold text-slate-600">{label} <span className="text-slate-400 font-normal">— {sorted.length} {sorted.length === 1 ? 'chassi' : 'chassis'}</span></p>
        <span className="text-[10px] text-slate-400">Período: {periodoLabel}</span>
      </div>
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="text-left px-2 py-2 font-semibold">Chassi</th>
              <th className="text-left px-2 py-2 font-semibold">Modelo</th>
              <th className="text-left px-2 py-2 font-semibold">NF Venda</th>
              <th className="text-left px-2 py-2 font-semibold">Data Venda</th>
              <th className="text-left px-2 py-2 font-semibold">Transação</th>
              <th className="text-right px-2 py-2 font-semibold">Valor Venda</th>
              <th className="text-right px-2 py-2 font-semibold">Valor Custo</th>
              <th className="text-right px-2 py-2 font-semibold">Bônus</th>
              <th className="text-right px-2 py-2 font-semibold">Lucro Bruto</th>
              <th className="text-right px-2 py-2 font-semibold">% LB</th>
              <th className="text-right px-2 py-2 font-semibold text-violet-700">Prêmio</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((it, i) => (
              <tr key={i} className={`border-t border-slate-100 ${i % 2 ? 'bg-slate-50/50' : ''}`}>
                <td className="px-2 py-1.5 font-mono text-slate-700">{it.row.chassi || '—'}</td>
                <td className="px-2 py-1.5 text-slate-600 max-w-[140px]">{it.row.modelo || '—'}</td>
                <td className="px-2 py-1.5 text-slate-500">{it.row.nfVenda || '—'}</td>
                <td className="px-2 py-1.5 font-mono text-slate-500">{it.row.dataVenda || '—'}</td>
                <td className="px-2 py-1.5 text-slate-500">{it.row.transacao || '—'}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${numColor(n(it.row.valorVenda))}`}>{fmtBRL(n(it.row.valorVenda))}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${numColor(n(it.row.valorCusto))}`}>{fmtBRL(n(it.row.valorCusto))}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${numColor(it.derived.bonus)}`}>{fmtBRL(it.derived.bonus)}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${numColor(it.derived.lucroBruto)}`}>{fmtBRL(it.derived.lucroBruto)}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${numColor(it.derived.lucroBrutoPct)}`}>{fmtPct(it.derived.lucroBrutoPct)}</td>
                <td className="px-2 py-1.5 text-right font-mono font-bold text-violet-700">{fmtBRL(it.premio)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800 text-white text-[11px] font-bold">
              <td colSpan={5} className="px-2 py-2 text-left">Total {label}</td>
              <td className="px-2 py-2 text-right">{fmtBRL(tot.v)}</td>
              <td className="px-2 py-2 text-right">{fmtBRL(tot.c)}</td>
              <td className="px-2 py-2 text-right">{fmtBRL(tot.bon)}</td>
              <td className="px-2 py-2 text-right">{fmtBRL(tot.lb)}</td>
              <td className="px-2 py-2 text-right" />
              <td className="px-2 py-2 text-right">{fmtBRL(tot.p)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Aba: Resumo ──────────────────────────────────────────────────────────────
function ResumoTab({
  premiadosNovos, premiadosUsados, lancamentosPk, nomeAcao, competencia, printHtml,
}: {
  premiadosNovos: PremiadoItem[];
  premiadosUsados: PremiadoItem[];
  lancamentosPk: Record<string, AcaoLancamento>;
  nomeAcao: string;
  competencia: string;
  printHtml: (html: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(v: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  }

  // Agrupa por vendedor: qtd/valor + itens (para o detalhe expandido)
  const linhas = useMemo(() => {
    const map = new Map<string, { qtdN: number; valN: number; qtdU: number; valU: number; novos: PremiadoItem[]; usados: PremiadoItem[] }>();
    const ensure = (v: string) => {
      if (!map.has(v)) map.set(v, { qtdN: 0, valN: 0, qtdU: 0, valU: 0, novos: [], usados: [] });
      return map.get(v)!;
    };
    premiadosNovos.forEach(i => { const e = ensure(i.row.vendedor?.trim() || '(sem nome)'); e.qtdN++; e.valN += i.premio; e.novos.push(i); });
    premiadosUsados.forEach(i => { const e = ensure(i.row.vendedor?.trim() || '(sem nome)'); e.qtdU++; e.valU += i.premio; e.usados.push(i); });
    return [...map.entries()]
      .map(([vendedor, d]) => ({ vendedor, ...d, total: d.valN + d.valU }))
      .sort((a, b) => a.vendedor.localeCompare(b.vendedor));
  }, [premiadosNovos, premiadosUsados]);

  const totais = linhas.reduce((acc, l) => {
    acc.qtdN += l.qtdN; acc.valN += l.valN; acc.qtdU += l.qtdU; acc.valU += l.valU; acc.total += l.total;
    return acc;
  }, { qtdN: 0, valN: 0, qtdU: 0, valU: 0, total: 0 });

  const thCls  = 'px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50';
  const tdCls  = 'px-4 py-2.5 text-sm border-b border-slate-100';
  const numCls = `${tdCls} text-right tabular-nums font-mono`;

  function handlePrint() {
    const rowsHtml = linhas.map(l => {
      const lanc = lancamentosPk[l.vendedor];
      const pago = lanc?.pago ?? false;
      const assinados = CAMPOS_ASSINATURA.filter(c => lanc?.assinaturas?.[c]).map(c => CAMPO_LABELS_CURTO[c]);
      const statusTxt = `${pago ? 'Pago' : 'Pendente'}${assinados.length ? ' · ' + assinados.join(', ') : ''}`;
      return `<tr>
        <td>${escapeHtml(fixVendedorName(l.vendedor))}</td>
        <td style="text-align:center">${l.qtdN}</td>
        <td style="text-align:right">R$ ${fmtBRL(l.valN)}</td>
        <td style="text-align:center">${l.qtdU}</td>
        <td style="text-align:right">R$ ${fmtBRL(l.valU)}</td>
        <td style="text-align:right;font-weight:700">R$ ${fmtBRL(l.total)}</td>
        <td>${statusTxt}</td>
      </tr>`;
    }).join('');
    const html = `<div style="font-family:Inter,system-ui,sans-serif;padding:8px;">
      <h2 style="font-size:14px;margin:0 0 2px;">Resumo da ação${nomeAcao ? ' — ' + escapeHtml(nomeAcao) : ''}</h2>
      <p style="font-size:10px;color:#64748b;margin:0 0 10px;">Competência: ${competencia}</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="text-align:left;padding:6px;border-bottom:1px solid #cbd5e1;">Vendedor</th>
          <th style="padding:6px;border-bottom:1px solid #cbd5e1;">Qtd Novos</th>
          <th style="text-align:right;padding:6px;border-bottom:1px solid #cbd5e1;">Valor Novos</th>
          <th style="padding:6px;border-bottom:1px solid #cbd5e1;">Qtd Usados</th>
          <th style="text-align:right;padding:6px;border-bottom:1px solid #cbd5e1;">Valor Usados</th>
          <th style="text-align:right;padding:6px;border-bottom:1px solid #cbd5e1;">Total Prêmio</th>
          <th style="text-align:left;padding:6px;border-bottom:1px solid #cbd5e1;">Status</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr style="background:#1e293b;color:white;font-weight:700;">
          <td style="padding:6px;">Total geral</td>
          <td style="text-align:center;padding:6px;">${totais.qtdN}</td>
          <td style="text-align:right;padding:6px;">R$ ${fmtBRL(totais.valN)}</td>
          <td style="text-align:center;padding:6px;">${totais.qtdU}</td>
          <td style="text-align:right;padding:6px;">R$ ${fmtBRL(totais.valU)}</td>
          <td style="text-align:right;padding:6px;">R$ ${fmtBRL(totais.total)}</td>
          <td style="padding:6px;"></td>
        </tr></tfoot>
      </table>
    </div>`;
    printHtml(html);
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          Competência: <strong className="text-slate-700">{competencia}</strong>
          {nomeAcao && <span className="ml-2 text-violet-600 font-medium">{nomeAcao}</span>}
        </span>
        <button
          onClick={handlePrint}
          disabled={linhas.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Imprimir PDF
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {linhas.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-16">Nenhum prêmio lançado neste período.</div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Resumo de Prêmios por Vendedor</h2>
              <p className="text-xs text-slate-400 mt-0.5">Competência: {competencia}</p>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={`${thCls} w-8`} />
                  <th className={thCls}>Vendedor</th>
                  <th className={`${thCls} text-right`}>Qtd Novos</th>
                  <th className={`${thCls} text-right`}>Valor Novos</th>
                  <th className={`${thCls} text-right`}>Qtd Usados</th>
                  <th className={`${thCls} text-right`}>Valor Usados</th>
                  <th className={`${thCls} text-right`}>Total Prêmio</th>
                  <th className={thCls}>Status</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => {
                  const isExp = expanded.has(l.vendedor);
                  const lanc = lancamentosPk[l.vendedor];
                  const pago = lanc?.pago ?? false;
                  return (
                    <Fragment key={l.vendedor}>
                      <tr className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => toggleExpand(l.vendedor)}>
                        <td className={tdCls}>
                          {isExp ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </td>
                        <td className={`${tdCls} font-medium text-slate-800`}>{fixVendedorName(l.vendedor)}</td>
                        <td className={numCls}>{l.qtdN || <span className="text-slate-300">—</span>}</td>
                        <td className={numCls}>{l.qtdN ? `R$ ${fmtBRL(l.valN)}` : <span className="text-slate-300">—</span>}</td>
                        <td className={numCls}>{l.qtdU || <span className="text-slate-300">—</span>}</td>
                        <td className={numCls}>{l.qtdU ? `R$ ${fmtBRL(l.valU)}` : <span className="text-slate-300">—</span>}</td>
                        <td className={`${numCls} font-semibold text-violet-700`}>R$ {fmtBRL(l.total)}</td>
                        <td className={tdCls}>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${pago ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {pago ? 'Pago' : 'Pendente'}
                            </span>
                            {CAMPOS_ASSINATURA.map(campo => {
                              const ass = lanc?.assinaturas?.[campo];
                              return (
                                <span
                                  key={campo}
                                  title={ass ? `${ass.name ?? ass.username} — ${new Date(ass.dataHora).toLocaleString('pt-BR')}` : 'Não assinado'}
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-semibold border ${ass ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-slate-400'}`}
                                >
                                  {CAMPO_LABELS_CURTO[campo]}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>

                      {isExp && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50/70 border-b border-slate-100 px-10 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                              {l.novos.length > 0 && <DetalhePremios label="Novos" itens={l.novos} />}
                              {l.usados.length > 0 && <DetalhePremios label="Usados" itens={l.usados} />}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800 text-white font-bold text-xs">
                  <td className="px-4 py-2.5" />
                  <td className="px-4 py-2.5 text-left">Total geral</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{totais.qtdN}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">R$ {fmtBRL(totais.valN)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{totais.qtdU}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">R$ {fmtBRL(totais.valU)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">R$ {fmtBRL(totais.total)}</td>
                  <td className="px-4 py-2.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detalhe expandido de prêmios (Novos ou Usados) ───────────────────────────
function DetalhePremios({ label, itens }: { label: string; itens: PremiadoItem[] }) {
  const total = itens.reduce((s, i) => s + i.premio, 0);
  const sorted = [...itens].sort((a, b) => (parseDataVenda(a.row.dataVenda)?.getTime() ?? 0) - (parseDataVenda(b.row.dataVenda)?.getTime() ?? 0));
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{label}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] text-slate-400">
            <th className="text-left pb-1.5 font-semibold">Chassi</th>
            <th className="text-left pb-1.5 font-semibold">Modelo</th>
            <th className="text-right pb-1.5 font-semibold">Prêmio</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((it, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="py-1 pr-3 font-mono text-slate-500">{it.row.chassi || '—'}</td>
              <td className="py-1 pr-3 text-slate-500">{it.row.modelo || '—'}</td>
              <td className="py-1 text-right tabular-nums font-medium text-violet-700">{fmtBRL(it.premio)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200">
            <td className="pt-1.5 font-semibold text-slate-600" colSpan={2}>Total {label}</td>
            <td className="pt-1.5 text-right tabular-nums font-bold text-slate-800">{fmtBRL(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
