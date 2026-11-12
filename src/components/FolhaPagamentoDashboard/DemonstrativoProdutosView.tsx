import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronRight as ChevRight, Printer, Check, Clock, ShieldCheck, PenLine, X, Loader2 } from 'lucide-react';
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

interface VendedorInfo {
  id: string;
  nome: string;
  matricula: string;
  departamento: string;
}

interface Grupo {
  info: VendedorInfo;
  vendas: RegistroVendaRP[];
  total: number;
}

interface DemonstrativoProdutosViewProps {
  registros: RegistroVendaRP[];
  vendedores: VendedorRP[];
  demoMeta: Record<string, DemonstrativoMetaRP>;
  onMarkPaid: (brand: Brand, vendedorId: string) => Promise<void>;
  onSaveSign: (key: string, campo: CampoAssinaturaRP, assinatura: AssinaturaDigitalRP | null) => Promise<void>;
}

export function DemonstrativoProdutosView({ registros, vendedores, demoMeta, onMarkPaid, onSaveSign }: DemonstrativoProdutosViewProps) {
  const { session, isAdmin } = useAuth();
  const admin = isAdmin();

  const now = new Date();
  const [brand, setBrand] = useState<Brand>('vw');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [assinaDialog, setAssinaDialog] = useState<{ campo: CampoAssinaturaRP; senha: string; loading: boolean; erro: string | null } | null>(null);

  // Agrupa as vendas pendentes (sem data de pagamento) por vendedor, dentro da marca.
  const grupos = useMemo<Grupo[]>(() => {
    const pend = registros.filter(r => !r.dataPagamento && brandOfMarca(r.marca) === brand);
    const byVend = new Map<string, Grupo>();
    for (const r of pend) {
      const key = r.vendedorId || r.vendedor;
      let g = byVend.get(key);
      if (!g) {
        const v = vendedores.find(x => x.id === r.vendedorId);
        g = {
          info: {
            id: r.vendedorId || key,
            nome: v?.nome ?? r.vendedor,
            matricula: v?.matricula ?? '',
            departamento: v?.departamento ?? '',
          },
          vendas: [],
          total: 0,
        };
        byVend.set(key, g);
      }
      g.vendas.push(r);
      g.total += parseNum(r.valorPremio);
    }
    return Array.from(byVend.values()).sort((a, b) => a.info.nome.localeCompare(b.info.nome));
  }, [registros, vendedores, brand]);

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
    if (!window.confirm('Marcar como pago preencherá a Data do Pagamento (hoje) das vendas pendentes deste vendedor, que sairão do demonstrativo. Continuar?')) return;
    await onMarkPaid(brand, vendedorId);
    setSelectedId(null);
    toast.success('Marcado como pago.');
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
          </div>

          {selected ? (
            /* ───── Demonstrativo individual ───── */
            <>
              <div className="flex items-center gap-2 flex-wrap no-print">
                <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Imprimir PDF
                </button>
                <button onClick={() => handleMarkPaid(selected.info.id)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200">
                  <Check className="w-3.5 h-3.5" /> Marcar como pago
                </button>
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
                      <p className="text-xs opacity-70 mt-0.5">{BRAND_LABEL[brand]}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs opacity-75 uppercase tracking-wider">Competência</p>
                      <p className="text-base font-bold mt-0.5">{periodLabel}</p>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="px-6 py-2 flex items-center gap-3 text-xs font-semibold border-b bg-amber-50 border-amber-200 text-amber-700">
                  <div className="w-2 h-2 rounded-full bg-amber-400" /> Pendente
                </div>

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
                  Nenhuma venda pendente de pagamento para {BRAND_LABEL[brand]}.
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
                          {g.info.departamento && <span className="text-xs text-slate-400 truncate hidden sm:block">· {g.info.departamento}</span>}
                          {g.info.matricula && <span className="text-xs text-slate-500">Mat. {g.info.matricula}</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{g.vendas.length} {g.vendas.length === 1 ? 'venda' : 'vendas'} pendente(s)</p>
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

                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3" /> Pendente
                      </div>

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
    </div>
  );
}
