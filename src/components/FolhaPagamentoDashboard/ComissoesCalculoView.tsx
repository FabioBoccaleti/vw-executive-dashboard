import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Save, Check, ChevronRight, RefreshCw, Lock, LockOpen, Printer, PenLine, ShieldCheck, UserX, UserCheck } from 'lucide-react';
import { kvGet, kvSet } from '@/lib/kvClient';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { apiLogin } from '@/lib/authClient';
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
  type CampoAssinaturaComissao,
  type AssinaturaDigital,
} from './comissoesLancamentosStorage';
import { ComissoesCalculoDemonstrativo } from './ComissoesCalculoDemonstrativo';

// ─── Constantes ───────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'] as const;
const AVAILABLE_YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
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

function normalizeKeyPart(v: string | undefined): string {
  return String(v ?? '').trim().toUpperCase();
}

const MODEL_BASE_RULES: Array<{ pattern: RegExp; model: string }> = [
  { pattern: /\bT[\s-]?CROSS\b/, model: 'T-CROSS' },
  { pattern: /\bTIGUAN\b/, model: 'TIGUAN' },
  { pattern: /\bNIVUS\b/, model: 'NIVUS' },
  { pattern: /\bTAOS\b/, model: 'TAOS' },
  { pattern: /\bPOLO\b/, model: 'POLO' },
  { pattern: /\bJETTA\b/, model: 'JETTA' },
  { pattern: /\bVIRTUS\b/, model: 'VIRTUS' },
  { pattern: /\bSAVEIRO\b/, model: 'SAVEIRO' },
  { pattern: /\bAMAROK\b/, model: 'AMAROK' },
];

function normalizeModelBase(modelo?: string | null): string {
  const raw = String(modelo ?? '').trim().toUpperCase();
  if (!raw) return 'SEM MODELO';

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const rule of MODEL_BASE_RULES) {
    if (rule.pattern.test(normalized)) return rule.model;
  }

  const ignoredPrefixes = new Set(['NOVO', 'NOVA']);
  const tokens = normalized.split(' ').filter(Boolean);
  const base = tokens.find(token => !ignoredPrefixes.has(token));

  return base || normalized;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function stableRowKey(row: VendasResultadoRow, idx: number): string {
  if (row.id) return `id:${row.id}`;
  const chassi = normalizeKeyPart(row.chassi);
  const nf     = normalizeKeyPart(row.nfVenda);
  const data   = normalizeKeyPart(row.dataVenda);
  const tx     = normalizeKeyPart(row.transacao);
  if (chassi || nf || data || tx) return `txn:${chassi}|${nf}|${data}|${tx}`;
  return `idx:${idx}`;
}

function legacyRowKey(row: VendasResultadoRow, idx: number): string {
  return row.chassi ? `${row.chassi}_${idx}` : String(idx);
}

function getLinhaComissao(
  linhas: Record<string, { comVenda: number; comLB: number }> | undefined,
  row: VendasResultadoRow,
  idx: number,
): { comVenda: number; comLB: number } | undefined {
  if (!linhas) return undefined;
  return linhas[stableRowKey(row, idx)] ?? linhas[legacyRowKey(row, idx)];
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
    ? 'Demonstrativo de Comissão de Vendas Usados VW'
    : 'Demonstrativo de Comissão de Vendas Novos VW';

  const visibleRows = lancamento?.pago && (lancamento.snapshotRows?.length ?? 0) > 0
    ? lancamento.snapshotRows
    : vRows;

  const derived = visibleRows.map((r, ri) => {
    const valorVenda = n(r.valorVenda);
    const valorCusto = n(r.valorCusto);
    const bonus      = n(r.bonusVarejo) + n(r.bonusTradeIn);
    const lucroBruto = valorVenda - valorCusto + bonus;
    const lucroBrutoPct = valorVenda !== 0 ? (lucroBruto / valorVenda) * 100 : 0;
    return { ...r, _ri: ri, _d: { bonus, lucroBruto, lucroBrutoPct } };
  });

  let totVenda = 0, totCusto = 0, totBonus = 0, totLB = 0, totComV = 0, totComLB = 0;
  let hasComissao = false;
  let countVenda  = 0, countDevol = 0;

  derived.forEach(r => {
    const sign = r.transacao === txDevol ? -1 : 1;
    if (r.transacao === txVenda) countVenda++;
    if (r.transacao === txDevol) countDevol++;
    totVenda += sign * n(r.valorVenda);
    totCusto += sign * n(r.valorCusto);
    totBonus += sign * r._d.bonus;
    totLB    += sign * r._d.lucroBruto;
    const linha = getLinhaComissao(lancamento?.linhas, r, r._ri);
    if (linha) { totComV += linha.comVenda; totComLB += linha.comLB; hasComissao = true; }
  });

  const totLBPct   = totVenda !== 0 ? (totLB / totVenda) * 100 : 0;
  const netCount   = countVenda - countDevol;
  const pago       = lancamento?.pago ?? false;
  const cntLabel   = `${netCount} ${netCount === 1 ? 'venda' : 'vendas'}`;
  const cntDetail  = countDevol > 0
    ? ` (${countVenda} ${txVenda} − ${countDevol} ${txDevol})`
    : '';

  const rowPad = Math.max(4, Math.min(18, Math.round(90 / Math.max(vRows.length, 1))));
  const tdB = `padding:${rowPad}px 5px;border-bottom:1px solid #f1f5f9;font-size:8px;`;
  const thS = (bg: string, align = 'left') =>
    `background:${bg};color:white;padding:4px 5px;font-size:7.5px;font-weight:600;white-space:nowrap;text-align:${align};`;
  const tfB = 'background:#1e293b;color:white;padding:5px 6px;font-size:8px;font-weight:700;text-align:right;border-right:1px solid #475569;';

  const displayDerived = [...derived].sort((a, b) => {
    const da = parseDataVenda(a.dataVenda ?? '');
    const db = parseDataVenda(b.dataVenda ?? '');
    return (da?.getTime() ?? 0) - (db?.getTime() ?? 0);
  });
  const rowsHtml = displayDerived.map((r, dri) => {
    const bg    = dri % 2 === 0 ? '#ffffff' : '#f8fafc';
    const linha = getLinhaComissao(lancamento?.linhas, r, r._ri);
    const comV  = linha?.comVenda ?? 0;
    const comLB = linha?.comLB    ?? 0;
    const total = comV + comLB;
    const vv    = n(r.valorVenda);
    const vc    = n(r.valorCusto);
    const none  = '<span style="color:#94a3b8">—</span>';
    const comVPct = tab === 'usados' && linha && comV !== 0 && Math.abs(vv) > 0
      ? `<br><span style="font-size:7px;color:#94a3b8;font-family:monospace;">${fmtPct(Math.abs(comV) / Math.abs(vv) * 100)}</span>`
      : '';
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
      <td style="${tdB}text-align:right;${numColor(comV)}">${linha ? fmtBRL(comV) + comVPct : none}</td>
      <td style="${tdB}text-align:right;${numColor(comLB)}">${linha ? fmtBRL(comLB) : none}</td>
      <td style="${tdB}text-align:right;font-weight:600;${numColor(total)}">${linha ? fmtBRL(total) : none}</td>
    </tr>`;
  }).join('');

  const pagoBadge = pago
    ? 'background:#d1fae5;color:#065f46;border:1px solid #6ee7b7'
    : 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d';

  return `<div style="page-break-after:${isLast ? 'avoid' : 'always'};padding-bottom:${isLast ? '0' : '12px'};display:flex;flex-direction:column;min-height:260mm;">
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
  ${(() => {
    const assinaturas = lancamento?.assinaturas ?? {};
    const campos = [
      { key: 'financeiro'         as const, label: 'Financeiro' },
      { key: 'gerenciaComercial'  as const, label: 'Gerência Comercial' },
      { key: 'diretoriaComercial' as const, label: 'Diretoria Comercial' },
      { key: 'diretoria'          as const, label: 'Diretoria' },
    ];
    const camposHtml = campos.map(({ key, label }) => {
      const ass = assinaturas[key];
      if (ass) {
        const dt = new Date(ass.dataHora).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        return `<div>
          <p style="font-size:7px;font-weight:600;color:#475569;margin:0 0 4px;">${label}</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:6px 8px;">
            <p style="font-size:7.5px;color:#15803d;font-weight:600;margin:0;">${ass.name || ass.username}</p>
            <p style="font-size:7px;color:#16a34a;margin:2px 0 0;">${dt}</p>
            <p style="font-size:6.5px;font-weight:700;color:#15803d;letter-spacing:0.05em;margin:3px 0 0;">&#10003; ASSINATURA ELETRÔNICA</p>
          </div>
        </div>`;
      }
      return `<div>
        <p style="font-size:7px;font-weight:600;color:#475569;margin:0 0 4px;">${label}</p>
        <div style="border:1.5px dashed #cbd5e1;border-radius:6px;padding:8px;text-align:center;">
          <p style="font-size:7px;color:#94a3b8;margin:0;">—</p>
        </div>
      </div>`;
    }).join('');
    return `<div style="margin-top:auto;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;">
      <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 8px;">ASSINATURAS</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">${camposHtml}</div>
    </div>`;
  })()}
</div>`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ComissoesCalculoViewProps {
  tab: 'novos' | 'usados';
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function ComissoesCalculoView({ tab }: ComissoesCalculoViewProps) {
  const { session } = useAuth();

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

  // Vendedores inativos (global por tab, persiste no KV)
  const [inativosSet, setInativosSet] = useState<Set<string>>(new Set());
  const inativosKey = `comissoes:inativos:${tab}`;
  useEffect(() => {
    kvGet<string[]>(inativosKey).then(v => setInativosSet(new Set(v ?? [])));
  }, [inativosKey]);
  async function toggleInativo(vendedor: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = new Set(inativosSet);
    if (next.has(vendedor)) next.delete(vendedor); else next.add(vendedor);
    setInativosSet(next);
    await kvSet(inativosKey, [...next]);
  }

  // Bulk print
  const [printingAll, setPrintingAll] = useState(false);
  const [printingResumo, setPrintingResumo] = useState(false);
  const [resumoExpanded, setResumoExpanded] = useState(false);
  const [resumoPorVendedorExpanded, setResumoPorVendedorExpanded] = useState(false);
  const [resumoVendedorOpenSet, setResumoVendedorOpenSet] = useState<Set<string>>(new Set());

  // Bulk pagamento
  const [markingAllPaid,  setMarkingAllPaid]  = useState(false);
  const [showReopenInput, setShowReopenInput] = useState(false);
  const [reopenPass,      setReopenPass]      = useState('');
  const [reopenError,     setReopenError]     = useState<string | null>(null);
  const [reopeningAll,    setReopeningAll]    = useState(false);

  // Confirmação inativar/reativar
  const [confirmInativoTarget, setConfirmInativoTarget] = useState<string | null>(null);

  // Bulk assinatura
  const [assinaTodasDialog, setAssinaTodasDialog] = useState<{
    campo:   CampoAssinaturaComissao;
    senha:   string;
    loading: boolean;
    erro:    string | null;
  } | null>(null);

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

      const html = vendedoresMap.filter(([v]) => !inativosSet.has(v)).map(([vendedor, vRows], idx, arr) =>
        buildSellerPrintHtml({
          vendedor,
          vRows,
          lancamento:  lancs[pk]?.[vendedor],
          tab,
          competencia,
          periodoLabel: savedPeriodo?.de && savedPeriodo?.ate
            ? `${fmtDate(savedPeriodo.de)} a ${fmtDate(savedPeriodo.ate)}`
            : '',
          isLast: idx === arr.length - 1,
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
      vendedoresMap.forEach(([vendedor, vRows]) => {
        const existing = all[pk]?.[vendedor];
        if (existing?.pago) return;
        changed = true;
        all[pk] = {
          ...(all[pk] ?? {}),
          [vendedor]: existing
            ? {
                ...existing,
                pago: true,
                dataPagamento: existing.dataPagamento ?? today,
                snapshotRows: existing.snapshotRows ?? vRows.map(r => ({ ...r })),
              }
            : { linhas: {}, pago: true, dataPagamento: today, snapshotRows: vRows.map(r => ({ ...r })) },
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
        const { dataPagamento: _, snapshotRows: __, ...rest } = existing;
        void _;
        void __;
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

  async function handleAssinarTodos() {
    if (!assinaTodasDialog || !session || filterMonth === null) return;
    setAssinaTodasDialog(prev => prev ? { ...prev, loading: true, erro: null } : prev);
    const result = await apiLogin(session.username, assinaTodasDialog.senha);
    if ('error' in result) {
      setAssinaTodasDialog(prev => prev ? { ...prev, loading: false, erro: 'Senha incorreta. Tente novamente.' } : prev);
      return;
    }
    const assinatura: AssinaturaDigital = {
      username: session.username,
      name:     (result.session.name ?? '') || undefined,
      dataHora: new Date().toISOString(),
    };
    const pk  = `${filterYear}-${filterMonth}`;
    const all = { ...lancamentosMap };
    let count = 0;
    vendedoresMap.forEach(([vendedor]) => {
      const existing = all[pk]?.[vendedor];
      if (!existing) return;
      if (existing.assinaturas?.[assinaTodasDialog.campo]) return;
      count++;
      all[pk] = {
        ...(all[pk] ?? {}),
        [vendedor]: {
          ...existing,
          assinaturas: { ...(existing.assinaturas ?? {}), [assinaTodasDialog.campo]: assinatura },
        },
      };
    });
    if (count > 0) {
      await bulkSaveLancamentos(tab, all);
      setLancamentosMap(all);
    }
    toast.success(`Assinatura de ${CAMPO_LABELS[assinaTodasDialog.campo]} aplicada em ${count} demonstrativo${count !== 1 ? 's' : ''}!`);
    setAssinaTodasDialog(null);
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
  // Exclui chassis já pagos em OUTRA competência (devem aparecer apenas no mês em que foram pagos)
  const periodRows = useMemo(() => {
    if (!savedPeriodo?.de || !savedPeriodo?.ate) return [];
    const de  = new Date(savedPeriodo.de);
    const ate = new Date(savedPeriodo.ate);
    ate.setHours(23, 59, 59, 999);

    const currentPk = filterMonth !== null ? `${filterYear}-${filterMonth}` : null;
    const chassiPaidElsewhere = new Set<string>();
    Object.entries(lancamentosMap).forEach(([pk, vendedoresObj]) => {
      if (pk === currentPk) return; // mesmo período: não excluir
      Object.values(vendedoresObj).forEach(lanc => {
        if (!lanc.pago) return;
        Object.keys(lanc.linhas ?? {}).forEach(chassi => {
          if (chassi) chassiPaidElsewhere.add(chassi);
        });
      });
    });

    return rows.filter(r => {
      const d = parseDataVenda(r.dataVenda);
      if (d === null || d < de || d > ate) return false;
      if (r.chassi && chassiPaidElsewhere.has(r.chassi)) return false;
      return true;
    });
  }, [rows, savedPeriodo, lancamentosMap, filterYear, filterMonth]);

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
    const paid  = vendedoresMap.filter(([v]) => lancs[v]?.pago).length;
    return [vendedoresMap.length, paid];
  }, [lancamentosMap, vendedoresMap, filterYear, filterMonth]);

  const resumoComissoesPorModelo = useMemo(() => {
    if (tab !== 'novos' || filterMonth === null) return [] as Array<{
      modelo: string;
      comVenda: number;
      comLB: number;
      total: number;
    }>;

    const pk = `${filterYear}-${filterMonth}`;
    const lancsPeriodo = lancamentosMap[pk] ?? {};
    const map = new Map<string, { modelo: string; comVenda: number; comLB: number; total: number }>();

    for (const [vendedor, vRows] of vendedoresMap) {
      const lanc = lancsPeriodo[vendedor];
      if (!lanc?.pago) continue;

      const rowsBase = (lanc.snapshotRows?.length ?? 0) > 0 ? lanc.snapshotRows! : vRows;
      rowsBase.forEach((r, idx) => {
        const linha = getLinhaComissao(lanc.linhas, r, idx);
        if (!linha) return;

        const modelo = normalizeModelBase(r.modelo);
        const comVenda = linha.comVenda ?? 0;
        const comLB = linha.comLB ?? 0;
        const total = comVenda + comLB;

        const current = map.get(modelo);
        if (current) {
          current.comVenda += comVenda;
          current.comLB += comLB;
          current.total += total;
        } else {
          map.set(modelo, { modelo, comVenda, comLB, total });
        }
      });
    }

    return Array.from(map.values()).sort((a, b) => a.modelo.localeCompare(b.modelo, 'pt-BR'));
  }, [tab, filterMonth, filterYear, lancamentosMap, vendedoresMap]);

  const totaisResumoModelo = useMemo(() => {
    return resumoComissoesPorModelo.reduce((acc, item) => {
      acc.comVenda += item.comVenda;
      acc.comLB += item.comLB;
      acc.total += item.total;
      return acc;
    }, { comVenda: 0, comLB: 0, total: 0 });
  }, [resumoComissoesPorModelo]);

  const resumoComissoesPorModeloVendedor = useMemo(() => {
    if (tab !== 'novos' || filterMonth === null) return [] as Array<{
      vendedor: string;
      modelos: Array<{ modelo: string; comVenda: number; comLB: number; total: number }>;
      totais: { comVenda: number; comLB: number; total: number };
    }>;

    const pk = `${filterYear}-${filterMonth}`;
    const lancsPeriodo = lancamentosMap[pk] ?? {};
    const result: Array<{
      vendedor: string;
      modelos: Array<{ modelo: string; comVenda: number; comLB: number; total: number }>;
      totais: { comVenda: number; comLB: number; total: number };
    }> = [];

    for (const [vendedor, vRows] of vendedoresMap) {
      const lanc = lancsPeriodo[vendedor];
      if (!lanc?.pago) continue;

      const rowsBase = (lanc.snapshotRows?.length ?? 0) > 0 ? lanc.snapshotRows! : vRows;
      const map = new Map<string, { modelo: string; comVenda: number; comLB: number; total: number }>();

      rowsBase.forEach((r, idx) => {
        const linha = getLinhaComissao(lanc.linhas, r, idx);
        if (!linha) return;

        const modelo = normalizeModelBase(r.modelo);
        const comVenda = linha.comVenda ?? 0;
        const comLB = linha.comLB ?? 0;
        const total = comVenda + comLB;
        const current = map.get(modelo);

        if (current) {
          current.comVenda += comVenda;
          current.comLB += comLB;
          current.total += total;
        } else {
          map.set(modelo, { modelo, comVenda, comLB, total });
        }
      });

      const modelos = Array.from(map.values()).sort((a, b) => a.modelo.localeCompare(b.modelo, 'pt-BR'));
      if (modelos.length === 0) continue;

      const totais = modelos.reduce((acc, item) => {
        acc.comVenda += item.comVenda;
        acc.comLB += item.comLB;
        acc.total += item.total;
        return acc;
      }, { comVenda: 0, comLB: 0, total: 0 });

      result.push({ vendedor, modelos, totais });
    }

    return result;
  }, [tab, filterMonth, filterYear, lancamentosMap, vendedoresMap]);

  function toggleResumoVendedor(vendedor: string) {
    setResumoVendedorOpenSet(prev => {
      const next = new Set(prev);
      if (next.has(vendedor)) next.delete(vendedor);
      else next.add(vendedor);
      return next;
    });
  }

  function handlePrintResumoModelo() {
    if (tab !== 'novos' || filterMonth === null || resumoComissoesPorModelo.length === 0) return;

    setPrintingResumo(true);
    const root = document.getElementById('print-root');
    if (!root) {
      window.print();
      setPrintingResumo(false);
      return;
    }

    const fmtBRL = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const competencia = `${MONTH_NAMES[filterMonth - 1]} de ${filterYear}`;

    const rowsHtml = resumoComissoesPorModelo.map(item => `
      <tr>
        <td>${escapeHtml(item.modelo)}</td>
        <td class="r">${fmtBRL(item.comVenda)}</td>
        <td class="r">${fmtBRL(item.comLB)}</td>
        <td class="r strong">${fmtBRL(item.total)}</td>
      </tr>
    `).join('');

    root.innerHTML = `
      <div class="print-page comissoes-resumo-print-page">
        <div class="comissoes-resumo-wrap">
          <h1>Resumo de Comissoes Pagas por Modelo</h1>
          <p>Competencia: ${escapeHtml(competencia)}</p>
          <p>Apenas comissoes com status Pago</p>

          <table>
            <thead>
              <tr>
                <th>Modelo</th>
                <th class="r">Com. s/ Venda</th>
                <th class="r">Com. s/ LB</th>
                <th class="r">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="total-row">
                <td>Total</td>
                <td class="r">${fmtBRL(totaisResumoModelo.comVenda)}</td>
                <td class="r">${fmtBRL(totaisResumoModelo.comLB)}</td>
                <td class="r strong">${fmtBRL(totaisResumoModelo.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      @page { size: A4 portrait; margin: 1cm; }
      .comissoes-resumo-wrap {
        font-family: Arial, sans-serif;
        color: #0f172a;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 14px;
      }
      .comissoes-resumo-wrap h1 {
        font-size: 16px;
        margin: 0 0 6px;
      }
      .comissoes-resumo-wrap p {
        font-size: 11px;
        color: #475569;
        margin: 0 0 6px;
      }
      .comissoes-resumo-wrap table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
        font-size: 11px;
      }
      .comissoes-resumo-wrap th,
      .comissoes-resumo-wrap td {
        border: 1px solid #e2e8f0;
        padding: 6px 8px;
      }
      .comissoes-resumo-wrap th {
        background: #f8fafc;
        text-align: left;
        font-weight: 700;
      }
      .comissoes-resumo-wrap .r { text-align: right; }
      .comissoes-resumo-wrap .strong { font-weight: 800; }
      .comissoes-resumo-wrap .total-row td {
        background: #f1f5f9;
        font-weight: 700;
      }
    `;
    document.head.appendChild(style);

    window.onafterprint = () => {
      if (style.parentNode) style.parentNode.removeChild(style);
      root.innerHTML = '';
      window.onafterprint = null;
      setPrintingResumo(false);
    };

    window.print();
  }

  // ─── Auto-cálculo em massa ─────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !remuneracao || filterMonth === null) return;
    if (!savedPeriodo?.de || !savedPeriodo?.ate) return;
    if (vendedoresMap.length === 0) return;

    const parseNum = (v: unknown) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
    const pk      = `${filterYear}-${filterMonth}`;
    const modal   = remuneracao[tab];
    const pctLB   = parseFloat(String(modal.comissaoLucroBruto ?? '').replace(',', '.'));
    const temPctLB  = !isNaN(pctLB) && pctLB > 0;
    const temFaixas = (modal.faixasBonus?.length ?? 0) > 0;
    const txVenda   = tab === 'usados' ? 'U21' : 'V21';
    const txDevol   = tab === 'usados' ? 'U07' : 'V07';
    const pctVendaBase = tab === 'novos'
      ? parseFloat(String(modal.comissaoVenda ?? '').replace(',', '.'))
      : NaN;
    const temPctVenda = !isNaN(pctVendaBase) && pctVendaBase > 0;

    if (tab === 'usados' && !temPctLB && !temFaixas) return;
    if (tab === 'novos'  && !temPctLB && !temPctVenda) return;

    const all = { ...lancamentosMap };
    let changed = false;

    vendedoresMap.forEach(([vendedor, vRows]) => {
      const existing       = all[pk]?.[vendedor];
      // Demonstrativo pago: nunca sobrescrever — preserva linhas, assinaturas e pago
      if (existing?.pago) return;
      const existingLinhas = existing?.linhas ?? {};
      const hasManualComVenda = Object.values(existingLinhas).some(l => l.comVenda !== 0);

      const derived = vRows.map((r, ri) => {
        const valorVenda = parseNum(r.valorVenda);
        const valorCusto = parseNum(r.valorCusto);
        const bonus      = parseNum(r.bonusVarejo) + parseNum(r.bonusTradeIn);
        return { ...r, _ri: ri, _lb: valorVenda - valorCusto + bonus };
      });
      if (derived.length === 0) return;

      const hasNewRows = derived.some((r, ri) => !getLinhaComissao(existingLinhas, r, ri));
      // Linhas de venda já no lançamento mas com comVenda=0 (manual adicionada com transação vazia)
      const hasUnpricedSaleRows = derived.some((r, ri) => {
        const linha = getLinhaComissao(existingLinhas, r, ri);
        return r.transacao === txVenda && !!linha && (linha.comVenda ?? 0) === 0;
      });
      if (hasManualComVenda && !hasNewRows && !hasUnpricedSaleRows) return;

      const onlyFillComVenda =
        !!existing && !hasManualComVenda && !hasNewRows && !hasUnpricedSaleRows;
      const linhas: Record<string, { comVenda: number; comLB: number }> = {};

      if (tab === 'usados') {
        if (onlyFillComVenda && !temFaixas) return;
        const sorted = [...derived].sort((a, b) => {
          const da = parseDataVenda(a.dataVenda ?? '');
          const db = parseDataVenda(b.dataVenda ?? '');
          return (da?.getTime() ?? 0) - (db?.getTime() ?? 0);
        });
        const comVendaByKey: Record<string, number> = {};
        let pos = 0;
        sorted.forEach((r, _si) => {
          // índice original (não reordenado) para gerar a chave correta
          const ri  = derived.indexOf(r);
          const key = stableRowKey(r, ri);
          if (r.transacao === txVenda) {
            pos++;
            const pct = getTierPct(pos, modal.faixasBonus ?? []);
            comVendaByKey[key] = pct > 0 ? parseNum(r.valorVenda) * (pct / 100) : 0;
          } else if (r.transacao === txDevol) {
            const pct = getTierPct(pos, modal.faixasBonus ?? []);
            comVendaByKey[key] = pct > 0 ? parseNum(r.valorVenda) * (pct / 100) : 0;
            pos = Math.max(0, pos - 1);
          } else {
            comVendaByKey[key] = 0;
          }
        });
        derived.forEach((r, ri) => {
          const key  = stableRowKey(r, ri);
          const prevLinha = getLinhaComissao(existingLinhas, r, ri);
          linhas[key] = {
            comVenda: temFaixas ? (comVendaByKey[key] ?? 0) : 0,
            comLB: onlyFillComVenda
              ? (prevLinha?.comLB ?? 0)
              : (temPctLB && (r._lb > 0 || r.transacao === txDevol) ? r._lb * (pctLB / 100) : 0),
          };
        });
      } else {
        if (onlyFillComVenda && !temPctVenda) return;
        const countV21 = derived.filter(r => r.transacao === txVenda).length;
        const countV07 = derived.filter(r => r.transacao === txDevol).length;
        const netCount = countV21 - countV07;
        let bonusPct = 0;
        if ((modal.faixasBonus?.length ?? 0) > 0) {
          const faixa = modal.faixasBonus.find((f: { de: string; ate: string; percentual: string }) => {
            const de  = parseInt(f.de)  || 0;
            const ate = f.ate === '' ? Infinity : (parseInt(f.ate) || 0);
            return netCount >= de && netCount <= ate;
          });
          if (faixa) bonusPct = parseFloat(String(faixa.percentual).replace(',', '.')) || 0;
        }
        const pctVenda = (isNaN(pctVendaBase) ? 0 : pctVendaBase) + bonusPct;
        derived.forEach((r, ri) => {
          const key  = stableRowKey(r, ri);
          const prevLinha = getLinhaComissao(existingLinhas, r, ri);
          linhas[key] = {
            comVenda: pctVenda > 0 ? parseNum(r.valorVenda) * (pctVenda / 100) : 0,
            comLB: onlyFillComVenda
              ? (prevLinha?.comLB ?? 0)
              : (temPctLB && (r._lb > 0 || r.transacao === txDevol) ? r._lb * (pctLB / 100) : 0),
          };
        });
      }

      all[pk] = {
        ...(all[pk] ?? {}),
        [vendedor]: {
          linhas,
          pago:          existing?.pago          ?? false,
          dataPagamento: existing?.dataPagamento,
          snapshotRows:  existing?.snapshotRows,
          assinaturas:   existing?.assinaturas,
        },
      };
      changed = true;
    });

    if (!changed) return;
    bulkSaveLancamentos(tab, all).then(() => setLancamentosMap(all));
    // lancamentosMap intencionalmente fora das deps para evitar loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, remuneracao, tab, filterYear, filterMonth, vendedoresMap, savedPeriodo]);

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
        isInativo={inativosSet.has(selectedVendedor)}
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

                {/* Assinar todos */}
                <button
                  onClick={() => setAssinaTodasDialog({ campo: 'financeiro', senha: '', loading: false, erro: null })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  Assinar todos
                </button>

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

            {tab === 'novos' && resumoComissoesPorModelo.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setResumoExpanded(v => !v)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Resumo de Comissões Pagas por Modelo</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">
                      {resumoComissoesPorModelo.length} modelo{resumoComissoesPorModelo.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${resumoExpanded ? 'rotate-180' : ''}`} />
                </button>

                {resumoExpanded && (
                  <div className="border-t border-slate-100">
                    <div className="px-4 py-2.5 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">
                        Apenas status Pago
                      </span>
                      <button
                        onClick={handlePrintResumoModelo}
                        disabled={printingResumo}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        {printingResumo ? 'Gerando Resumo...' : 'Imprimir Resumo PDF'}
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-2.5 text-left font-semibold text-slate-500 text-[10px] uppercase tracking-wide">Modelo</th>
                            <th className="px-4 py-2.5 text-right font-semibold text-indigo-600 text-[10px] uppercase tracking-wide">Com. s/ Venda</th>
                            <th className="px-4 py-2.5 text-right font-semibold text-violet-600 text-[10px] uppercase tracking-wide">Com. s/ LB</th>
                            <th className="px-4 py-2.5 text-right font-semibold text-slate-600 text-[10px] uppercase tracking-wide">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {resumoComissoesPorModelo.map((item, i) => (
                            <tr key={item.modelo} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="px-4 py-2.5 font-medium text-slate-700">{item.modelo}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-indigo-700 tabular-nums">
                                {item.comVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-violet-700 tabular-nums">
                                {item.comLB.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                              <td className="px-4 py-2.5 text-right font-black text-slate-800 tabular-nums">
                                {item.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-100 border-t-2 border-slate-300">
                            <td className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Total</td>
                            <td className="px-4 py-2.5 text-right font-black text-indigo-700 tabular-nums">
                              {totaisResumoModelo.comVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="px-4 py-2.5 text-right font-black text-violet-700 tabular-nums">
                              {totaisResumoModelo.comLB.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="px-4 py-2.5 text-right font-black text-slate-900 tabular-nums">
                              {totaisResumoModelo.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'novos' && resumoComissoesPorModeloVendedor.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setResumoPorVendedorExpanded(v => !v)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Resumo por Modelo de Cada Vendedor</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">
                      {resumoComissoesPorModeloVendedor.length} vendedor{resumoComissoesPorModeloVendedor.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${resumoPorVendedorExpanded ? 'rotate-180' : ''}`} />
                </button>

                {resumoPorVendedorExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {resumoComissoesPorModeloVendedor.map(item => {
                      const isOpen = resumoVendedorOpenSet.has(item.vendedor);
                      return (
                        <div key={item.vendedor}>
                          <button
                            onClick={() => toggleResumoVendedor(item.vendedor)}
                            className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{item.vendedor}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {item.modelos.length} modelo{item.modelos.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 ml-3">
                              <span className="text-xs font-bold text-slate-800 tabular-nums">
                                {item.totais.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </div>
                          </button>

                          {isOpen && (
                            <div className="overflow-x-auto border-t border-slate-100">
                              <table className="w-full text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500 text-[10px] uppercase tracking-wide">Modelo</th>
                                    <th className="px-4 py-2.5 text-right font-semibold text-indigo-600 text-[10px] uppercase tracking-wide">Com. s/ Venda</th>
                                    <th className="px-4 py-2.5 text-right font-semibold text-violet-600 text-[10px] uppercase tracking-wide">Com. s/ LB</th>
                                    <th className="px-4 py-2.5 text-right font-semibold text-slate-600 text-[10px] uppercase tracking-wide">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {item.modelos.map((modelo, idx) => (
                                    <tr key={`${item.vendedor}-${modelo.modelo}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                      <td className="px-4 py-2.5 font-medium text-slate-700">{modelo.modelo}</td>
                                      <td className="px-4 py-2.5 text-right font-semibold text-indigo-700 tabular-nums">
                                        {modelo.comVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </td>
                                      <td className="px-4 py-2.5 text-right font-semibold text-violet-700 tabular-nums">
                                        {modelo.comLB.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </td>
                                      <td className="px-4 py-2.5 text-right font-black text-slate-800 tabular-nums">
                                        {modelo.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </td>
                                    </tr>
                                  ))}
                                  <tr className="bg-slate-100 border-t-2 border-slate-300">
                                    <td className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Total</td>
                                    <td className="px-4 py-2.5 text-right font-black text-indigo-700 tabular-nums">
                                      {item.totais.comVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-black text-violet-700 tabular-nums">
                                      {item.totais.comLB.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-black text-slate-900 tabular-nums">
                                      {item.totais.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Cards de vendedores */}
            {vendedoresMap.map(([vendedor, vRows]) => {
              const lanc = filterMonth !== null
                ? lancamentosMap[`${filterYear}-${filterMonth}`]?.[vendedor]
                : undefined;
              const pago = lanc?.pago ?? false;
              const inativo = inativosSet.has(vendedor);
              return (
                <button
                  key={vendedor}
                  onClick={() => setSelectedVendedor(vendedor)}
                  className={`w-full text-left rounded-xl border px-5 py-4 hover:shadow-sm transition-all flex items-center gap-4 ${
                    inativo
                      ? 'bg-slate-50 border-slate-200 opacity-70'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Avatar com inicial */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    inativo ? 'bg-slate-400 text-white' : 'bg-slate-700 text-white'
                  }`}>
                    {vendedor.trim().charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${inativo ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{vendedor}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {tab === 'novos' ? 'Veículos Novos' : 'Veículos Usados'}
                      {' · '}
                      {vRows.length} {vRows.length === 1 ? 'venda' : 'vendas'}
                    </p>
                  </div>
                  {/* Assinaturas */}
                  {filterMonth !== null && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {([
                        ['Fin',    'financeiro'],
                        ['G.Com',  'gerenciaComercial'],
                        ['D.Com',  'diretoriaComercial'],
                        ['Dir',    'diretoria'],
                      ] as [string, CampoAssinaturaComissao][]).map(([label, campo]) => {
                        const assinado = !!lanc?.assinaturas?.[campo];
                        return (
                          <div key={campo} className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            assinado
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}>
                            {assinado && <ShieldCheck className="w-3 h-3" />}
                            {label}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Status */}
                  {inativo ? (
                    <span className="px-3 py-1 rounded-full border text-xs font-semibold whitespace-nowrap flex-shrink-0 bg-slate-100 border-slate-300 text-slate-500">
                      Inativo
                    </span>
                  ) : (
                    <span className={`px-3 py-1 rounded-full border text-xs font-semibold whitespace-nowrap flex-shrink-0 ${
                      pago
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
                      {pago ? 'Pago' : 'Pendente'}
                    </span>
                  )}
                  {/* Data de pagamento ou placeholder */}
                  {pago && lanc?.dataPagamento && !inativo ? (
                    <span className="text-xs text-emerald-500 whitespace-nowrap flex-shrink-0">
                      {fmtDate(lanc.dataPagamento)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300 whitespace-nowrap flex-shrink-0">—</span>
                  )}
                  {/* Botão inativar/reativar */}
                  <button
                    disabled={pago}
                    onClick={e => { e.stopPropagation(); if (!pago) setConfirmInativoTarget(vendedor); }}
                    title={pago ? 'Não é possível alterar o status de um vendedor com pagamento confirmado' : inativo ? 'Reativar vendedor' : 'Marcar como inativo'}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors flex-shrink-0 ${
                      pago
                        ? 'bg-slate-50 border-slate-150 text-slate-300 cursor-not-allowed'
                        : inativo
                          ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                    }`}
                  >
                    {inativo ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    {inativo ? 'Reativar' : 'Inativar'}
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              );
            })}

          </div>
        )}
      </div>

      {/* ── Dialog: Confirmar Inativar/Reativar ───────────────────────── */}
      {confirmInativoTarget !== null && (() => {
        const isInativo = inativosSet.has(confirmInativoTarget);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setConfirmInativoTarget(null); }}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isInativo ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  {isInativo
                    ? <UserCheck className="w-5 h-5 text-emerald-600" />
                    : <UserX    className="w-5 h-5 text-red-600" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {isInativo ? 'Reativar vendedor' : 'Inativar vendedor'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                    {isInativo
                      ? 'O vendedor voltará a aparecer nos lançamentos futuros.'
                      : 'O vendedor será ocultado dos lançamentos futuros.'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-700 mb-6">
                Deseja realmente <strong>{isInativo ? 'reativar' : 'inativar'}</strong> o vendedor{' '}
                <strong>{confirmInativoTarget}</strong>?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmInativoTarget(null)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    const target = confirmInativoTarget;
                    setConfirmInativoTarget(null);
                    await toggleInativo(target, { stopPropagation: () => {} } as React.MouseEvent);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${isInativo ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {isInativo ? 'Reativar' : 'Inativar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Dialog: Assinar todos ──────────────────────────────────────── */}
      {assinaTodasDialog !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget && !assinaTodasDialog.loading) setAssinaTodasDialog(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Assinar todos os demonstrativos</p>
                <p className="text-xs text-slate-500 mt-0.5">Somente quem ainda não possui a assinatura selecionada</p>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Campo de assinatura</label>
              <select
                value={assinaTodasDialog.campo}
                onChange={e => setAssinaTodasDialog(prev => prev ? { ...prev, campo: e.target.value as CampoAssinaturaComissao } : prev)}
                disabled={assinaTodasDialog.loading}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
              >
                {(Object.entries(CAMPO_LABELS) as [CampoAssinaturaComissao, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Usuário</label>
              <input
                type="text"
                value={session?.username ?? ''}
                disabled
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>

            <div className="mb-5">
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Senha</label>
              <input
                type="password"
                value={assinaTodasDialog.senha}
                autoFocus
                disabled={assinaTodasDialog.loading}
                placeholder="Digite sua senha"
                onChange={e => setAssinaTodasDialog(prev => prev ? { ...prev, senha: e.target.value, erro: null } : prev)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAssinarTodos();
                  if (e.key === 'Escape' && !assinaTodasDialog.loading) setAssinaTodasDialog(null);
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {assinaTodasDialog.erro && (
                <p className="text-xs text-red-600 mt-1.5">{assinaTodasDialog.erro}</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { if (!assinaTodasDialog.loading) setAssinaTodasDialog(null); }}
                disabled={assinaTodasDialog.loading}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssinarTodos}
                disabled={assinaTodasDialog.loading || !assinaTodasDialog.senha}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40"
              >
                {assinaTodasDialog.loading ? 'Assinando...' : 'Assinar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
