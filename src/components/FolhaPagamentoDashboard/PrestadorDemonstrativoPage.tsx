import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Printer, Check, Save, Loader2, Plus, Trash2, X, History, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { kvGet } from '@/lib/kvClient';
import {
  loadLancamento,
  saveLancamento,
  deleteLancamento,
  loadHistorico,
  buildLancamentoVazio,
  totalLancamento,
  DESCRICAO_TRIMESTRAL,
  type PrestadorPJ,
  type LancamentoPJ,
  type LancamentoItem,
  type StatusPagamento,
} from './remPjStorage';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 3 + i);

// ─── Mapeamentos DRE ─────────────────────────────────────────────────────────

/** baseCalculo → chave de departamento no DreVwRow / DreAudiRow */
const BASE_TO_DEPT: Record<string, string> = {
  lucro_novos:     'novos',
  lucro_usados:    'usados',
  lucro_vd_direta: 'direta',
  lucro_pecas:     'pecas',
  lucro_oficina:   'oficina',
  lucro_funilaria: 'funilaria',
};

/** Label do chip → chave de departamento no DRE */
const CHIP_TO_DEPT: Record<string, string> = {
  'Novos Varejo': 'novos',
  'VD Direta':    'direta',
  'Usados':       'usados',
  'Peças':        'pecas',
  'Oficina':      'oficina',
  'Funilaria':    'funilaria',
};

function parseValDre(v: string | number | undefined | null): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function prevMonth(y: number, m: number) {
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
}
function nextMonth(y: number, m: number) {
  return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };
}

// ─── Selector de Período ──────────────────────────────────────────────────────

function PeriodSelector({
  year, month,
  onPrev, onNext,
  onYearChange, onMonthChange,
}: {
  year: number; month: number;
  onPrev: () => void; onNext: () => void;
  onYearChange: (y: number) => void;
  onMonthChange: (m: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
      <button onClick={onPrev} className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <select
        value={month}
        onChange={e => onMonthChange(Number(e.target.value))}
        className="text-sm font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
      >
        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>
      <select
        value={year}
        onChange={e => onYearChange(Number(e.target.value))}
        className="text-sm font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
      >
        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <button onClick={onNext} className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Demonstrativo (área imprimível) ─────────────────────────────────────────

function DemonstrativoTable({
  prestador,
  lanc,
  year,
  month,
  editing,
  onItemChange,
  onAddItem,
  onRemoveItem,
  isAdmin,
}: {
  prestador: PrestadorPJ;
  lanc: LancamentoPJ;
  year: number;
  month: number;
  editing: boolean;
  onItemChange: (idx: number, patch: Partial<LancamentoItem>) => void;
  onAddItem: () => void;
  onRemoveItem: (idx: number) => void;
  isAdmin: boolean;
}) {
  const total = totalLancamento(lanc);
  const brandColor = prestador.brand === 'vw' ? '#001e50' : '#bb0a30';
  const brandDark  = prestador.brand === 'vw' ? '#001238' : '#9a0827';
  const periodLabel = `${MONTHS[month - 1]} de ${year}`;

  return (
    <div id="demonstrativo-print-area" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header com gradiente de marca */}
      <div className="px-6 py-4 text-white" style={{ backgroundColor: brandColor }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold opacity-75 uppercase tracking-wider mb-0.5">
              Demonstrativo de Pagamento PJ
            </p>
            <h2 className="text-lg font-bold">{prestador.nome}</h2>
            {prestador.empresa && (
              <p className="text-sm opacity-80">{prestador.empresa}</p>
            )}
            {prestador.cargo && (
              <p className="text-xs opacity-70 mt-0.5">{prestador.cargo}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs opacity-75 uppercase tracking-wider">Competência</p>
            <p className="text-base font-bold mt-0.5">{periodLabel}</p>
            {prestador.cnpjCpf && (
              <p className="text-xs opacity-70 mt-1">{prestador.cnpjCpf}</p>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className={`px-6 py-2 flex items-center gap-3 text-xs font-semibold border-b ${
        lanc.status === 'pago'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-amber-50 border-amber-200 text-amber-700'
      }`}>
        <div className={`w-2 h-2 rounded-full ${lanc.status === 'pago' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        {lanc.status === 'pago' ? 'Pago' : 'Pendente'}
        {lanc.status === 'pago' && lanc.dataPagamento && (
          <span className="font-normal text-emerald-600">— {lanc.dataPagamento}</span>
        )}
      </div>

      {/* Tabela de itens */}
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-6 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Descrição</th>
            <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider w-32">Tipo / %</th>
            <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider w-48">Base de Cálculo</th>
            <th className="text-right px-6 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider w-40">Valor</th>
            {editing && isAdmin && <th className="w-10" />}
          </tr>
        </thead>
        <tbody>
          {lanc.itens.map((item, idx) => {
            const pct = item.percentualUsado ??
              prestador.itens.find(pi => pi.id === item.itemId)?.percentual;
            const shortLabel = item.baseCalculoLabel
              ? item.baseCalculoLabel.replace('LUCRO LÍQUIDO DO EXERCÍCIO - ', '')
              : undefined;

            return (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                {/* Descrição */}
                <td className="px-6 py-3">
                  {editing && isAdmin ? (
                    <input
                      value={item.descricao}
                      onChange={e => onItemChange(idx, { descricao: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  ) : (
                    <span className="text-sm text-slate-800">{item.descricao}</span>
                  )}
                </td>

                {/* Tipo / % */}
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      item.tipo === 'fixa'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : item.tipo === 'premio'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {item.tipo === 'fixa' ? 'Fixo' : item.tipo === 'premio' ? 'Prêmio' : 'Variável'}
                    </span>
                    {item.tipo === 'variavel' && pct != null && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                        {pct}% s/ base
                      </span>
                    )}
                    {item.tipo === 'variavel' && pct == null && (
                      <span className="text-[10px] text-slate-400 italic">sem %</span>
                    )}
                  </div>
                </td>

                {/* Base de Cálculo — sempre somente leitura, vem do DRE */}
                <td className="px-4 py-3">
                  {item.tipo === 'variavel' ? (
                    <div className="text-right">
                      {item.valorBaseCalculo != null && item.valorBaseCalculo !== 0 ? (
                        <>
                          <div className="text-sm font-medium text-slate-700 tabular-nums">{fmtBRL(item.valorBaseCalculo)}</div>
                          {shortLabel && (
                            <div className="text-[10px] text-slate-500" title={item.baseCalculoLabel}>{shortLabel}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-sm block text-right">—</span>
                  )}
                </td>

                {/* Valor */}
                <td className="px-6 py-3 text-right">
                  {item.tipo === 'variavel' ? (
                    <span className={`text-sm font-semibold tabular-nums ${item.valor ? 'text-slate-800' : 'text-slate-400'}`}>
                      {item.valor ? fmtBRL(item.valor) : '—'}
                    </span>
                  ) : editing && (item.tipo === 'fixa' || item.tipo === 'premio') ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.valor || ''}
                      onChange={e => onItemChange(idx, { valor: parseFloat(e.target.value) || 0 })}
                      className={`w-36 border rounded px-2.5 py-1.5 text-sm text-right focus:outline-none ml-auto block ${
                        item.tipo === 'premio'
                          ? 'border-purple-300 focus:ring-2 focus:ring-purple-400'
                          : 'border-slate-300 focus:ring-2 focus:ring-teal-400'
                      }`}
                      placeholder="0,00"
                    />
                  ) : (
                    <span className={`text-sm font-semibold tabular-nums ${
                      item.tipo === 'premio' ? 'text-purple-700' : 'text-slate-800'
                    }`}>
                      {item.valor ? fmtBRL(item.valor) : <span className="text-slate-400">—</span>}
                    </span>
                  )}
                </td>

                {editing && isAdmin && (
                  <td className="px-2 py-3">
                    <button
                      onClick={() => onRemoveItem(idx)}
                      className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}

          {/* Botão adicionar item (apenas em edição) */}
          {editing && isAdmin && (
            <tr className="border-b border-slate-100">
              <td colSpan={5} className="px-6 py-2">
                <button
                  onClick={onAddItem}
                  className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar item
                </button>
              </td>
            </tr>
          )}

          {/* Observação */}
          {lanc.observacaoGeral && !editing && (
            <tr className="border-b border-slate-100">
              <td colSpan={4} className="px-6 py-3">
                <p className="text-xs text-slate-500 italic">Obs: {lanc.observacaoGeral}</p>
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="text-white" style={{ backgroundColor: brandDark }}>
            <td colSpan={editing ? 4 : 3} className="px-6 py-4 text-sm font-bold">
              Total
            </td>
            <td className="px-6 py-4 text-right text-lg font-bold tabular-nums">
              {fmtBRL(total)}
            </td>
            {editing && isAdmin && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Painel de Histórico ──────────────────────────────────────────────────────

function HistoricoPanel({
  historico,
  prestador,
  brandColor,
}: {
  historico: LancamentoPJ[];
  prestador: PrestadorPJ;
  brandColor: string;
}) {
  if (historico.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex flex-col items-center gap-3 text-slate-400">
        <History className="w-8 h-8 opacity-30" />
        <p className="text-sm">Nenhum lançamento anterior encontrado.</p>
      </div>
    );
  }

  const maxTotal = Math.max(...historico.map(l => totalLancamento(l)));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
        <History className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-semibold text-slate-700">Histórico — Últimos 12 meses</span>
      </div>
      <div className="p-4 flex flex-col gap-2">
        {historico
          .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
          .map(lanc => {
            const total  = totalLancamento(lanc);
            const pct    = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
            const isPago = lanc.status === 'pago';
            return (
              <div key={`${lanc.year}_${lanc.month}`} className="flex items-center gap-3">
                <div className="w-16 text-xs text-slate-500 font-semibold text-right flex-shrink-0">
                  {MONTHS_SHORT[lanc.month - 1]}/{lanc.year}
                </div>
                <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: brandColor, opacity: isPago ? 1 : 0.5 }}
                  />
                </div>
                <div className="w-32 text-xs font-semibold tabular-nums text-right text-slate-700">
                  {fmtBRL(total)}
                </div>
                <div className={`w-16 text-xs font-semibold text-center px-2 py-0.5 rounded-full ${
                  isPago ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {isPago ? 'Pago' : 'Pendente'}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

interface PrestadorDemonstrativoPageProps {
  prestador: PrestadorPJ;
  isAdmin: boolean;
  onBack: () => void;
}

export function PrestadorDemonstrativoPage({ prestador, isAdmin, onBack }: PrestadorDemonstrativoPageProps) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [lanc,    setLanc]    = useState<LancamentoPJ | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [editing, setEditing] = useState(false);
  const [dirty,   setDirty]   = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [historico, setHistorico] = useState<LancamentoPJ[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // Carrega lançamento do mês selecionado + DRE do mês anterior
  useEffect(() => {
    setLoading(true);
    setEditing(false);
    setDirty(false);

    const drePrev = month === 1
      ? { year: year - 1, month: 12 }
      : { year, month: month - 1 };
    const dreKey = `resumo_dre:${prestador.brand}:${drePrev.year}-${String(drePrev.month).padStart(2, '0')}`;

    Promise.all([
      loadLancamento(prestador.id, year, month),
      kvGet<any>(dreKey),
    ]).then(([existing, dreRow]) => {
      const base = existing ?? buildLancamentoVazio(prestador, year, month);

      // Preenche valorBaseCalculo de itens variáveis a partir do DRE
      if (dreRow) {
        base.itens = base.itens.map(item => {
          if (item.tipo !== 'variavel') return item;
          const prestItem = prestador.itens.find(pi => pi.id === item.itemId);
          let valorBase = 0;

          if (item.descricao === DESCRICAO_TRIMESTRAL) {
            // Soma os departamentos selecionados nos chips
            const deps = prestItem?.departamentos ?? [];
            valorBase = deps.reduce((sum, dep) => {
              const dk = CHIP_TO_DEPT[dep];
              return sum + (dk ? parseValDre(dreRow[dk]?.lucroLiquidoExercicio) : 0);
            }, 0);
          } else {
            const baseCalculo = prestItem?.baseCalculo;
            if (baseCalculo) {
              const dk = BASE_TO_DEPT[baseCalculo];
              if (dk) valorBase = parseValDre(dreRow[dk]?.lucroLiquidoExercicio);
            }
          }

          const pct = item.percentualUsado ?? prestItem?.percentual ?? 0;
          const valor = Math.round((valorBase * pct / 100) * 100) / 100;
          return { ...item, valorBaseCalculo: valorBase, valor };
        });
      }

      setLanc(base);
      setLoading(false);
    });
  }, [prestador.id, year, month]);

  // Carrega histórico ao abrir o painel
  useEffect(() => {
    if (!showHistorico) return;
    setHistLoading(true);
    loadHistorico(prestador.id, year, month, 12).then(h => {
      setHistorico(h);
      setHistLoading(false);
    });
  }, [showHistorico, prestador.id, year, month]);

  // Navegação de período
  function handlePrev() {
    const p = prevMonth(year, month);
    setYear(p.year); setMonth(p.month);
  }
  function handleNext() {
    const p = nextMonth(year, month);
    setYear(p.year); setMonth(p.month);
  }

  // Edição de itens
  function handleItemChange(idx: number, patch: Partial<LancamentoItem>) {
    setLanc(prev => {
      if (!prev) return prev;
      const itens = prev.itens.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, ...patch };
        // Auto-calcular valor para itens variáveis quando a base muda
        if (updated.tipo === 'variavel' && 'valorBaseCalculo' in patch) {
          const pct =
            updated.percentualUsado ??
            prestador.itens.find(pi => pi.id === it.itemId)?.percentual ??
            0;
          updated.valor = Math.round(((updated.valorBaseCalculo ?? 0) * pct) / 100 * 100) / 100;
        }
        return updated;
      });
      return { ...prev, itens };
    });
    setDirty(true);
  }

  function handleAddItem() {
    setLanc(prev => {
      if (!prev) return prev;
      const novo: LancamentoItem = {
        itemId: crypto.randomUUID(),
        descricao: '',
        tipo: 'variavel',
        valor: 0,
      };
      return { ...prev, itens: [...prev.itens, novo] };
    });
    setDirty(true);
  }

  function handleRemoveItem(idx: number) {
    setLanc(prev => {
      if (!prev) return prev;
      return { ...prev, itens: prev.itens.filter((_, i) => i !== idx) };
    });
    setDirty(true);
  }

  async function handleSave() {
    if (!lanc) return;
    setSaving(true);
    const ok = await saveLancamento(lanc);
    setSaving(false);
    if (ok) {
      setDirty(false);
      setEditing(false);
      toast.success('Demonstrativo salvo.');
    } else {
      toast.error('Erro ao salvar.');
    }
  }

  async function handleToggleStatus() {
    if (!lanc) return;
    const updated: LancamentoPJ = {
      ...lanc,
      status: lanc.status === 'pago' ? 'pendente' : 'pago',
      dataPagamento: lanc.status === 'pendente'
        ? new Date().toLocaleDateString('pt-BR')
        : undefined,
    };
    setLanc(updated);
    await saveLancamento(updated);
    toast.success(updated.status === 'pago' ? 'Marcado como pago.' : 'Marcado como pendente.');
  }

  function handlePrint() {
    const area = document.getElementById('demonstrativo-print-area');
    const root = document.getElementById('print-root');
    if (area && root) {
      const clone = area.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.no-print').forEach(el => el.remove());
      root.innerHTML = clone.outerHTML;
      const style = document.createElement('style');
      style.textContent = `
        @page { size: A4 portrait; margin: 1cm; }
        #print-root { font-family: Inter, sans-serif; }
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
    } else {
      window.print();
    }
  }

  const brandColor = prestador.brand === 'vw' ? '#001e50' : '#bb0a30';

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto p-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prestadores
            </button>
            <div>
              <h2 className="text-base font-bold text-slate-800">{prestador.nome}</h2>
              <p className="text-xs text-slate-500">
                {prestador.brand === 'vw' ? 'VW' : 'Audi'}
                {prestador.cargo ? ` · ${prestador.cargo}` : ''}
              </p>
            </div>
          </div>

          {/* Controles */}
          <div className="flex items-center gap-2 flex-wrap no-print">
            <PeriodSelector
              year={year} month={month}
              onPrev={handlePrev} onNext={handleNext}
              onYearChange={setYear} onMonthChange={setMonth}
            />

            {/* Histórico toggle */}
            <button
              onClick={() => setShowHistorico(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                showHistorico ? 'bg-slate-700 text-white border-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Histórico
            </button>

            {/* Imprimir */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir PDF
            </button>

            {/* Status pago/pendente */}
            {!editing && (
              <button
                onClick={handleToggleStatus}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  lanc?.status === 'pago'
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                {lanc?.status === 'pago' ? 'Pago' : 'Marcar como pago'}
              </button>
            )}

            {/* Editar / Salvar */}
            {isAdmin && (
              editing ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditing(false); setDirty(false); loadLancamento(prestador.id, year, month).then(l => setLanc(l ?? buildLancamentoVazio(prestador, year, month))); }}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      dirty || saving
                        ? 'bg-teal-600 hover:bg-teal-700 text-white'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-teal-300 bg-white text-teal-600 hover:bg-teal-50 text-xs font-semibold transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Lançar valores
                </button>
              )
            )}
          </div>
        </div>

        {/* Conteúdo */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : lanc ? (
          <>
            <DemonstrativoTable
              prestador={prestador}
              lanc={lanc}
              year={year}
              month={month}
              editing={editing}
              isAdmin={isAdmin}
              onItemChange={handleItemChange}
              onAddItem={handleAddItem}
              onRemoveItem={handleRemoveItem}
            />

            {showHistorico && (
              histLoading ? (
                <div className="flex items-center justify-center py-10 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : (
                <HistoricoPanel
                  historico={historico}
                  prestador={prestador}
                  brandColor={brandColor}
                />
              )
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
