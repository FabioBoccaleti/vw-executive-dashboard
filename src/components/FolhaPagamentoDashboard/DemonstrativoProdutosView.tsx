import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronRight as ChevRight, Printer, Check, Clock, CheckCircle, ShieldCheck, PenLine, X, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { apiLogin } from '@/lib/authClient';
import {
  CAMPO_ASSINATURA_LABELS_RP,
  CAMPO_ASSINATURA_LABELS_RP_CURTO,
  demoMetaKey,
  type RegistroVendaRP,
  type VendedorRP,
  type DemonstrativoMetaRP,
  type CampoAssinaturaRP,
  type AssinaturaDigitalRP,
} from './remuneracaoProdutosStorage';

const DEMO_TITULO = 'Prêmio sobre Venda de Produtos Revisão Planejada e Garantia Estendida';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 3 + i);

type Brand = 'vw' | 'audi';

const BRAND_COLOR: Record<Brand, string> = { vw: '#001e50', audi: '#bb0a30' };
const BRAND_LABEL: Record<Brand, string> = { vw: 'VW', audi: 'Audi' };

/** Mapeia o nome da marca (cadastro livre) para a sub-aba VW/Audi. */
function brandOfMarca(marca: string): Brand | null {
  const n = (marca ?? '').trim().toLowerCase();
  if (n === 'audi') return 'audi';
  if (n === 'vw' || n === 'volkswagen') return 'vw';
  return null;
}

const parseNum = (s: string): number => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };
const fmtBRL = (v: number): string => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const isoToBR = (iso: string): string => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return y && m && d ? `${d}/${m}/${y}` : ''; };
const escapeHtml = (s: string): string => (s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

interface VendedorInfo {
  id: string;
  nome: string;
  matricula: string;
  departamento: string;
  cargo: string;
}

interface Grupo {
  info: VendedorInfo;
  vendas: RegistroVendaRP[];
  total: number;
  pago: boolean;
  dataPagamento: string;
}

interface DemonstrativoProdutosViewProps {
  registros: RegistroVendaRP[];
  vendedores: VendedorRP[];
  demoMeta: Record<string, DemonstrativoMetaRP>;
  onMarkPaid: (brand: Brand, vendedorId: string) => Promise<void>;
  onReopen: (brand: Brand, vendedorId: string, year: number, month: number) => Promise<void>;
  onSaveSign: (key: string, campo: CampoAssinaturaRP, assinatura: AssinaturaDigitalRP | null) => Promise<void>;
}

export function DemonstrativoProdutosView({ registros, vendedores, demoMeta, onMarkPaid, onReopen, onSaveSign }: DemonstrativoProdutosViewProps) {
  const { session, isAdmin } = useAuth();
  const admin = isAdmin();

  const now = new Date();
  const [brand, setBrand] = useState<Brand>('vw');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [assinaDialog, setAssinaDialog] = useState<{ campo: CampoAssinaturaRP; senha: string; loading: boolean; erro: string | null } | null>(null);
  const [reabrirDialog, setReabrirDialog] = useState<{ vendedorId: string; senha: string; erro: string | null } | null>(null);

  function infoFromVendedor(vendedorId: string, fallbackNome: string): VendedorInfo {
    const v = vendedores.find(x => x.id === vendedorId);
    return {
      id: vendedorId,
      nome: v?.nome ?? fallbackNome,
      matricula: v?.matricula ?? '',
      departamento: v?.departamento ?? '',
      cargo: v?.cargo ?? '',
    };
  }

  // Monta os demonstrativos da competência selecionada, derivando pela própria
  // data de pagamento das vendas:
  //  • Pago: vendas da marca cuja data de pagamento cai no mês/ano selecionado.
  //  • Em aberto: vendas da marca sem data de pagamento (um vendedor já com
  //    demonstrativo pago no mês não entra também como aberto).
  const grupos = useMemo<Grupo[]>(() => {
    const compPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const byVend = new Map<string, Grupo>();

    // 1) Pagos nesta competência.
    const pagas = registros.filter(r => brandOfMarca(r.marca) === brand && r.dataPagamento && r.dataPagamento.startsWith(compPrefix));
    for (const r of pagas) {
      const vendedorId = r.vendedorId || r.vendedor;
      let g = byVend.get(vendedorId);
      if (!g) {
        g = { info: infoFromVendedor(vendedorId, r.vendedor), vendas: [], total: 0, pago: true, dataPagamento: '' };
        byVend.set(vendedorId, g);
      }
      g.vendas.push(r);
      g.total += parseNum(r.valorPremio);
    }
    for (const g of byVend.values()) {
      g.dataPagamento = g.vendas.map(v => v.dataPagamento).filter(Boolean).sort().slice(-1)[0] ?? '';
    }

    // 2) Em aberto (sem data de pagamento), exceto quem já está pago no mês.
    const pendentes = registros.filter(r => brandOfMarca(r.marca) === brand && !r.dataPagamento);
    for (const r of pendentes) {
      const vendedorId = r.vendedorId || r.vendedor;
      if (byVend.get(vendedorId)?.pago) continue; // pago tem precedência no mês
      let g = byVend.get(vendedorId);
      if (!g) {
        g = { info: infoFromVendedor(vendedorId, r.vendedor), vendas: [], total: 0, pago: false, dataPagamento: '' };
        byVend.set(vendedorId, g);
      }
      g.vendas.push(r);
      g.total += parseNum(r.valorPremio);
    }

    return Array.from(byVend.values()).sort((a, b) => a.info.nome.localeCompare(b.info.nome));
  }, [registros, vendedores, demoMeta, brand, year, month]);

  const selected = selectedId ? grupos.find(g => g.info.id === selectedId) ?? null : null;

  const metaFor = (vendedorId: string): DemonstrativoMetaRP | undefined => demoMeta[demoMetaKey(brand, vendedorId, year, month)];

  function changeMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  }

  async function handleMarkPaid(vendedorId: string) {
    await onMarkPaid(brand, vendedorId);
    toast.success('Demonstrativo marcado como pago.');
  }

  function handleConfirmarReabrir() {
    if (!reabrirDialog) return;
    if (reabrirDialog.senha !== '1985') {
      setReabrirDialog(prev => prev ? { ...prev, erro: 'Senha incorreta.' } : prev);
      return;
    }
    const vid = reabrirDialog.vendedorId;
    setReabrirDialog(null);
    onReopen(brand, vid, year, month).then(() => toast.success('Demonstrativo reaberto. Data de pagamento e assinaturas removidas.'));
  }

  async function handleConfirmarAssinatura() {
    if (!assinaDialog || !selected || !session) return;
    setAssinaDialog(prev => prev ? { ...prev, loading: true, erro: null } : prev);
    const result = await apiLogin(session.username, assinaDialog.senha);
    if ('error' in result) {
      setAssinaDialog(prev => prev ? { ...prev, loading: false, erro: 'Senha incorreta. Tente novamente.' } : prev);
      return;
    }
    const assinatura: AssinaturaDigitalRP = {
      username: session.username,
      name: result.session.name ?? session.name ?? undefined,
      dataHora: new Date().toISOString(),
    };
    await onSaveSign(demoMetaKey(brand, selected.info.id, year, month), assinaDialog.campo, assinatura);
    setAssinaDialog(null);
    toast.success(`Assinatura de ${CAMPO_ASSINATURA_LABELS_RP[assinaDialog.campo]} registrada!`);
  }

  async function handleRemoverAssinatura(campo: CampoAssinaturaRP) {
    if (!selected) return;
    if (!window.confirm('Remover esta assinatura?')) return;
    await onSaveSign(demoMetaKey(brand, selected.info.id, year, month), campo, null);
    toast.success('Assinatura removida.');
  }

  function handlePrint() {
    const area = document.getElementById('demo-produtos-print-area');
    const root = document.getElementById('print-root');
    if (!area || !root) { window.print(); return; }
    const clone = area.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.no-print').forEach(el => el.remove());
    root.innerHTML = clone.outerHTML;
    const style = document.createElement('style');
    style.textContent = `
      @page { size: A4 portrait; margin: 1cm; }
      @media print { body > *:not(#print-root) { display: none !important; } }
      #print-root { font-family: Inter, sans-serif; }
      #print-root, #print-root * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
        color-scheme: light !important;
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => { root.innerHTML = ''; document.head.removeChild(style); }, 300);
  }

  function buildGroupHtml(g: Grupo): string {
    const meta = metaFor(g.info.id);
    const rows = g.vendas.map(v => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 24px;font-size:12px;color:#334155;white-space:nowrap;">${escapeHtml(isoToBR(v.data)) || '—'}</td>
        <td style="padding:10px 16px;font-size:12px;color:#334155;">${escapeHtml(v.cliente) || '—'}</td>
        <td style="padding:10px 16px;font-size:12px;color:#334155;white-space:nowrap;">${escapeHtml(v.modelo) || '—'}</td>
        <td style="padding:10px 16px;font-size:12px;color:#334155;">${escapeHtml(v.produto) || '—'}</td>
        <td style="padding:10px 24px;font-size:12px;font-weight:600;color:#0f172a;text-align:right;white-space:nowrap;">${fmtBRL(parseNum(v.valorPremio))}</td>
      </tr>`).join('');

    const assinaturas = (Object.keys(CAMPO_ASSINATURA_LABELS_RP) as CampoAssinaturaRP[]).map(campo => {
      const ass = meta?.assinaturas?.[campo];
      const label = CAMPO_ASSINATURA_LABELS_RP[campo];
      return ass ? `
        <div style="border:1px solid #bbf7d0;border-radius:8px;padding:10px 12px;background:#f0fdf4;">
          <div style="font-size:11px;color:#15803d;font-weight:700;margin-bottom:2px;">${label}</div>
          ${ass.name && ass.name !== ass.username ? `<div style="font-size:12px;font-weight:700;color:#166534;">${escapeHtml(ass.name)}</div>` : ''}
          <div style="font-size:11px;color:#16a34a;">${escapeHtml(ass.username)}</div>
          <div style="font-size:10px;color:#15803d;">${new Date(ass.dataHora).toLocaleString('pt-BR')}</div>
          <div style="font-size:10px;font-weight:700;color:#15803d;margin-top:4px;">✓ ASSINATURA ELETRÔNICA</div>
        </div>` : `
        <div style="border:1px dashed #cbd5e1;border-radius:8px;padding:10px 12px;background:#f8fafc;">
          <div style="font-size:11px;color:#94a3b8;font-weight:700;">${label}</div>
          <div style="font-size:10px;color:#cbd5e1;margin-top:16px;border-top:1px solid #e2e8f0;padding-top:4px;">Aguardando assinatura</div>
        </div>`;
    }).join('');

    const statusHtml = g.pago
      ? `<div style="padding:8px 24px;font-size:12px;font-weight:600;background:#ecfdf5;border-bottom:1px solid #a7f3d0;color:#047857;">● Pago${g.dataPagamento ? ' — ' + escapeHtml(isoToBR(g.dataPagamento)) : ''}</div>`
      : `<div style="padding:8px 24px;font-size:12px;font-weight:600;background:#fffbeb;border-bottom:1px solid #fde68a;color:#b45309;">● Pendente</div>`;

    return `
      <div style="page-break-after:always;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:16px;">
        <div style="background:${color};color:#fff;padding:16px 24px;display:flex;justify-content:space-between;gap:16px;">
          <div>
            <div style="font-size:11px;font-weight:600;opacity:.75;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">${DEMO_TITULO}</div>
            <div style="font-size:18px;font-weight:700;">${escapeHtml(g.info.nome)}</div>
            ${g.info.matricula ? `<div style="font-size:12px;opacity:.8;margin-top:2px;">Matrícula: ${escapeHtml(g.info.matricula)}</div>` : ''}
            ${g.info.departamento ? `<div style="font-size:13px;opacity:.8;">${escapeHtml(g.info.departamento)}</div>` : ''}
            ${g.info.cargo ? `<div style="font-size:12px;opacity:.7;margin-top:2px;">${escapeHtml(g.info.cargo)}</div>` : ''}
            <div style="font-size:12px;opacity:.7;margin-top:2px;">${BRAND_LABEL[brand]}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;opacity:.75;text-transform:uppercase;letter-spacing:.05em;">Competência</div>
            <div style="font-size:16px;font-weight:700;margin-top:2px;">${periodLabel}</div>
          </div>
        </div>
        ${statusHtml}
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
              <th style="text-align:left;padding:10px 24px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.05em;">Data</th>
              <th style="text-align:left;padding:10px 16px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.05em;">Cliente</th>
              <th style="text-align:left;padding:10px 16px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.05em;">Modelo</th>
              <th style="text-align:left;padding:10px 16px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.05em;">Produto</th>
              <th style="text-align:right;padding:10px 24px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.05em;">Valor do Prêmio</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:${color};">
              <td colspan="4" style="padding:10px 24px;font-size:13px;font-weight:700;color:#fff;">Total</td>
              <td style="padding:10px 24px;font-size:13px;font-weight:700;color:#fff;text-align:right;white-space:nowrap;">${fmtBRL(g.total)}</td>
            </tr>
          </tfoot>
        </table>
        <div style="border-top:1px solid #f1f5f9;padding:16px 24px;">
          <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">Assinaturas</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${assinaturas}</div>
        </div>
      </div>`;
  }

  function handlePrintAll() {
    if (grupos.length === 0) { toast.info('Nenhum demonstrativo para imprimir.'); return; }
    const root = document.getElementById('print-root');
    if (!root) { window.print(); return; }
    root.innerHTML = grupos.map(buildGroupHtml).join('');
    const style = document.createElement('style');
    style.textContent = `
      @page { size: A4 portrait; margin: 1cm; }
      @media print { body > *:not(#print-root) { display: none !important; } }
      #print-root { font-family: Inter, sans-serif; }
      #print-root div[style*="page-break-after:always"]:last-child { page-break-after: auto !important; }
      #print-root, #print-root * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
        color-scheme: light !important;
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => { root.innerHTML = ''; document.head.removeChild(style); }, 300);
  }

  const periodLabel = `${MONTHS[month - 1]} de ${year}`;
  const color = BRAND_COLOR[brand];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-100">
      {/* Sub-abas Audi / VW */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-0 flex-shrink-0">
        {(['vw', 'audi'] as Brand[]).map(b => (
          <button
            key={b}
            onClick={() => { setBrand(b); setSelectedId(null); }}
            className="px-5 py-3 text-sm font-semibold border-b-2 transition-colors"
            style={brand === b ? { borderColor: BRAND_COLOR[b], color: BRAND_COLOR[b] } : { borderColor: 'transparent', color: '#64748b' }}
          >
            {BRAND_LABEL[b]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          {/* Barra de competência */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {selected ? (
              <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white hover:bg-slate-50 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" /> Vendedores
              </button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1">
                <button onClick={() => changeMonth(-1)} className="p-1 text-slate-400 hover:text-slate-600"><ChevronLeft className="w-4 h-4" /></button>
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className="text-sm font-semibold text-slate-700 bg-transparent focus:outline-none">
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select value={year} onChange={e => setYear(Number(e.target.value))} className="text-sm font-semibold text-slate-700 bg-transparent focus:outline-none">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={() => changeMonth(1)} className="p-1 text-slate-400 hover:text-slate-600"><ChevronRight className="w-4 h-4" /></button>
              </div>
              {!selected && (
                <button onClick={handlePrintAll} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Imprimir Todos
                </button>
              )}
            </div>
          </div>

          {selected ? (
            /* ───── Demonstrativo individual ───── */
            <>
              <div className="flex items-center gap-2 flex-wrap no-print">
                <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Imprimir PDF
                </button>
                {!selected.pago ? (
                  <button onClick={() => handleMarkPaid(selected.info.id)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200">
                    <Check className="w-3.5 h-3.5" /> Marcar como pago
                  </button>
                ) : (
                  <button onClick={() => setReabrirDialog({ vendedorId: selected.info.id, senha: '', erro: null })} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200">
                    <RotateCcw className="w-3.5 h-3.5" /> Reabrir demonstrativo
                  </button>
                )}
              </div>

              <div id="demo-produtos-print-area" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Cabeçalho */}
                <div className="px-6 py-4 text-white" style={{ backgroundColor: color }}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold opacity-75 uppercase tracking-wider mb-1">{DEMO_TITULO}</p>
                      <h2 className="text-lg font-bold">{selected.info.nome}</h2>
                      {selected.info.matricula && <p className="text-xs opacity-80 mt-0.5">Matrícula: {selected.info.matricula}</p>}
                      {selected.info.departamento && <p className="text-sm opacity-80">{selected.info.departamento}</p>}
                      {selected.info.cargo && <p className="text-xs opacity-70 mt-0.5">{selected.info.cargo}</p>}
                      <p className="text-xs opacity-70 mt-0.5">{BRAND_LABEL[brand]}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs opacity-75 uppercase tracking-wider">Competência</p>
                      <p className="text-base font-bold mt-0.5">{periodLabel}</p>
                    </div>
                  </div>
                </div>

                {/* Status */}
                {selected.pago ? (
                  <div className="px-6 py-2 flex items-center gap-3 text-xs font-semibold border-b bg-emerald-50 border-emerald-200 text-emerald-700">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" /> Pago
                    {selected.dataPagamento && <span className="font-normal text-emerald-600">— {isoToBR(selected.dataPagamento)}</span>}
                  </div>
                ) : (
                  <div className="px-6 py-2 flex items-center gap-3 text-xs font-semibold border-b bg-amber-50 border-amber-200 text-amber-700">
                    <div className="w-2 h-2 rounded-full bg-amber-400" /> Pendente
                  </div>
                )}

                {/* Tabela */}
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-6 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Data</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Cliente</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Modelo</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Produto</th>
                      <th className="text-right px-6 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider w-40">Valor do Prêmio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.vendas.map(v => (
                      <tr key={v.id} className="border-b border-slate-100">
                        <td className="px-6 py-3 text-sm text-slate-700 whitespace-nowrap">{isoToBR(v.data) || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{v.cliente || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{v.modelo || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{v.produto || '—'}</td>
                        <td className="px-6 py-3 text-sm text-slate-800 font-semibold text-right tabular-nums whitespace-nowrap">{fmtBRL(parseNum(v.valorPremio))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: color }}>
                      <td colSpan={4} className="px-6 py-3 text-sm font-bold text-white">Total</td>
                      <td className="px-6 py-3 text-sm font-bold text-white text-right tabular-nums whitespace-nowrap">{fmtBRL(selected.total)}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Assinaturas */}
                <div className="border-t border-slate-100 px-6 py-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Assinaturas</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(CAMPO_ASSINATURA_LABELS_RP) as CampoAssinaturaRP[]).map(campo => {
                      const ass = metaFor(selected.info.id)?.assinaturas?.[campo];
                      const label = CAMPO_ASSINATURA_LABELS_RP[campo];
                      if (ass) {
                        return (
                          <div key={campo} className="border border-emerald-200 rounded-lg px-3 py-2.5 bg-emerald-50 relative">
                            <p className="text-[11px] font-bold text-emerald-700 mb-0.5">{label}</p>
                            {ass.name && ass.name !== ass.username && <p className="text-xs font-bold text-emerald-800">{ass.name}</p>}
                            <p className="text-[11px] text-emerald-600">{ass.username}</p>
                            <p className="text-[10px] text-emerald-500">{new Date(ass.dataHora).toLocaleString('pt-BR')}</p>
                            <p className="text-[10px] font-bold text-emerald-600 mt-1">✓ ASSINATURA ELETRÔNICA</p>
                            {admin && (
                              <button onClick={() => handleRemoverAssinatura(campo)} className="absolute top-1.5 right-1.5 p-1 rounded text-emerald-400 hover:text-red-600 hover:bg-red-50 no-print" title="Remover assinatura">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div key={campo} className="border border-dashed border-slate-300 rounded-lg px-3 py-2.5 bg-slate-50">
                          <p className="text-[11px] font-bold text-slate-400">{label}</p>
                          <button onClick={() => setAssinaDialog({ campo, senha: '', loading: false, erro: null })} className="mt-2 flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-semibold no-print">
                            <PenLine className="w-3.5 h-3.5" /> Assinar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ───── Lista de vendedores ───── */
            <>
              <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3">
                <span className="text-sm text-slate-600">{periodLabel} · {grupos.length} {grupos.length === 1 ? 'vendedor' : 'vendedores'}</span>
                <span className="text-sm font-bold text-slate-800">Total: {fmtBRL(grupos.reduce((s, g) => s + g.total, 0))}</span>
              </div>

              {grupos.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl px-5 py-12 text-center text-sm text-slate-400">
                  Nenhum demonstrativo para {BRAND_LABEL[brand]} em {periodLabel}.
                </div>
              ) : (
                grupos.map(g => {
                  const meta = metaFor(g.info.id);
                  return (
                    <button key={g.info.id} onClick={() => setSelectedId(g.info.id)} className="w-full text-left flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-5 py-4 hover:shadow-md hover:border-teal-300 transition-all group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ color, borderColor: color, backgroundColor: `${color}11` }}>{BRAND_LABEL[brand]}</span>
                          <span className="text-sm font-semibold text-slate-800 truncate">{g.info.nome}</span>
                          {g.info.cargo && <span className="text-xs text-slate-500 truncate">{g.info.cargo}</span>}
                          {g.info.departamento && <span className="text-xs text-slate-400 truncate hidden sm:block">· {g.info.departamento}</span>}
                          {g.info.matricula && <span className="text-xs text-slate-500">Mat. {g.info.matricula}</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {g.pago
                            ? `${g.vendas.length} ${g.vendas.length === 1 ? 'venda' : 'vendas'} · pago${g.dataPagamento ? ' em ' + isoToBR(g.dataPagamento) : ''}`
                            : `${g.vendas.length} ${g.vendas.length === 1 ? 'venda' : 'vendas'} em aberto`}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {(Object.keys(CAMPO_ASSINATURA_LABELS_RP_CURTO) as CampoAssinaturaRP[]).map(campo => {
                          const assinado = !!meta?.assinaturas?.[campo];
                          return (
                            <div key={campo} className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${assinado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                              {assinado && <ShieldCheck className="w-3 h-3" />}
                              {CAMPO_ASSINATURA_LABELS_RP_CURTO[campo]}
                            </div>
                          );
                        })}
                      </div>

                      {g.pago ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3" /> Pago
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" /> Pendente
                        </div>
                      )}

                      <div className="text-right flex-shrink-0 w-32">
                        <span className="text-sm font-bold text-slate-800 tabular-nums">{fmtBRL(g.total)}</span>
                      </div>

                      <ChevRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500 flex-shrink-0 transition-colors" />
                    </button>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialog de assinatura */}
      {assinaDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-bold text-slate-800">Assinar — {CAMPO_ASSINATURA_LABELS_RP[assinaDialog.campo]}</h3>
              <button onClick={() => setAssinaDialog(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-500">Confirme sua senha para registrar a assinatura eletrônica como <strong>{session?.name ?? session?.username}</strong>.</p>
            <input
              type="password"
              autoFocus
              value={assinaDialog.senha}
              onChange={e => setAssinaDialog(prev => prev ? { ...prev, senha: e.target.value, erro: null } : prev)}
              onKeyDown={e => e.key === 'Enter' && handleConfirmarAssinatura()}
              placeholder="Sua senha"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            {assinaDialog.erro && <p className="text-xs text-red-600">{assinaDialog.erro}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAssinaDialog(null)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 text-xs font-semibold hover:bg-slate-50">Cancelar</button>
              <button onClick={handleConfirmarAssinatura} disabled={assinaDialog.loading || !assinaDialog.senha} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white disabled:bg-slate-200 disabled:text-slate-400">
                {assinaDialog.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
                Assinar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog de reabertura */}
      {reabrirDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-bold text-slate-800">Reabrir demonstrativo</h3>
              <button onClick={() => setReabrirDialog(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-500">Isto esvaziará a Data do Pagamento das vendas na planilha e removerá as assinaturas desta competência. Informe a senha para continuar.</p>
            <input
              type="password"
              autoFocus
              value={reabrirDialog.senha}
              onChange={e => setReabrirDialog(prev => prev ? { ...prev, senha: e.target.value, erro: null } : prev)}
              onKeyDown={e => e.key === 'Enter' && handleConfirmarReabrir()}
              placeholder="Senha"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            {reabrirDialog.erro && <p className="text-xs text-red-600">{reabrirDialog.erro}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setReabrirDialog(null)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 text-xs font-semibold hover:bg-slate-50">Cancelar</button>
              <button onClick={handleConfirmarReabrir} disabled={!reabrirDialog.senha} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-800 text-white disabled:bg-slate-200 disabled:text-slate-400">
                <RotateCcw className="w-3.5 h-3.5" /> Reabrir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
