import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Printer, Check, Save, Loader2, Plus, Trash2, X, History, FileText, PenLine, CheckCircle, ShieldCheck, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import { kvGet } from '@/lib/kvClient';
import { useAuth } from '@/contexts/useAuth';
import { apiLogin } from '@/lib/authClient';
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
  type AssinaturaDigital,
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
  onPremioToggle,
  onAssinar,
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
  onPremioToggle: (itemId: string) => void;
  onAssinar: (campo: 'financeiro' | 'rh') => void;
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
                  <div className="flex items-center gap-2 flex-wrap">
                    {editing && isAdmin ? (
                      <input
                        value={item.descricao}
                        onChange={e => onItemChange(idx, { descricao: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    ) : (
                      <span className="text-sm text-slate-800">{item.descricao}</span>
                    )}
                    {/* Tag P% — visível se o item está na base do prêmio */}
                    {prestador.temPremio && item.tipo !== 'premio' && (() => {
                      const marcado = (lanc.itensPremioIds ?? []).includes(item.itemId);
                      const pctPremio = prestador.percentualPremio;
                      if (!marcado && !editing) return null;
                      return (
                        <button
                          type="button"
                          title={marcado ? 'Incide no Prêmio Adicional — clique para remover' : 'Clique para incluir na base do Prêmio'}
                          onClick={() => editing && isAdmin && onPremioToggle(item.itemId)}
                          className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                            marcado
                              ? 'bg-purple-600 text-white border-purple-600 ' + (editing && isAdmin ? 'cursor-pointer hover:bg-purple-700' : 'cursor-default')
                              : 'bg-white text-purple-400 border-purple-300 cursor-pointer hover:bg-purple-50'
                          }`}
                        >
                          P{pctPremio != null ? ` ${pctPremio}%` : ''}
                        </button>
                      );
                    })()}
                  </div>
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
                    {item.tipo === 'premio' && pct != null && (
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
                        {pct}%
                      </span>
                    )}
                  </div>
                </td>

                {/* Base de Cálculo */}
                <td className="px-4 py-3">
                  {item.tipo === 'variavel' ? (
                    editing ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.valorBaseCalculo || ''}
                          onChange={e => onItemChange(idx, { valorBaseCalculo: parseFloat(e.target.value) || 0 })}
                          className="w-36 border border-slate-300 rounded px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-400"
                          placeholder="0,00"
                        />
                        {shortLabel && (
                          <div className="text-[10px] text-slate-400" title={item.baseCalculoLabel}>{shortLabel}</div>
                        )}
                      </div>
                    ) : (
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
                    )
                  ) : item.tipo === 'premio' ? (
                    (() => {
                      const marcados = lanc.itensPremioIds ?? [];
                      const soma = lanc.itens
                        .filter(it => marcados.includes(it.itemId))
                        .reduce((s, it) => s + (it.valor || 0), 0);
                      return soma > 0 ? (
                        <div className="text-right text-sm font-medium text-purple-700 tabular-nums">{fmtBRL(soma)}</div>
                      ) : (
                        <span className="text-slate-300 text-sm block text-right">—</span>
                      );
                    })()
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

      {/* ─── Seção de Assinaturas ─── */}
      <div className="px-6 py-5 border-t border-slate-200">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Assinaturas</p>
        <div className="grid grid-cols-2 gap-4">
          {(['financeiro', 'rh'] as const).map(campo => {
            const ass = lanc.assinaturas?.[campo];
            const label = campo === 'financeiro' ? 'Financeiro' : 'Recursos Humanos';
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
                    onClick={() => onAssinar(campo)}
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
  initialYear?: number;
  initialMonth?: number;
}

export function PrestadorDemonstrativoPage({ prestador, isAdmin, onBack, initialYear, initialMonth }: PrestadorDemonstrativoPageProps) {
  const now = new Date();
  const [year,  setYear]  = useState(initialYear  ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth() + 1);

  const [lanc,    setLanc]    = useState<LancamentoPJ | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [editing, setEditing] = useState(false);
  const [dirty,   setDirty]   = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [historico, setHistorico] = useState<LancamentoPJ[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // Assinaturas
  const { session } = useAuth();
  type CampoAssinatura = 'financeiro' | 'rh';
  const [assinaDialog, setAssinaDialog] = useState<{
    campo: CampoAssinatura;
    nome: string;
    senha: string;
    loading: boolean;
    erro: string | null;
  } | null>(null);
  const [reabrirDialog, setReopenDialog] = useState<{ senha: string; erro: string | null } | null>(null);

  const ambasAssinadas = !!(lanc?.assinaturas?.financeiro && lanc?.assinaturas?.rh);
  const isLocked = !!(lanc?.assinaturas?.financeiro || lanc?.assinaturas?.rh || lanc?.status === 'pago');

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

      // Sincroniza tipo e percentualUsado do cadastro atual (caso prestador tenha mudado o item)
      base.itens = base.itens.map(item => {
        const prestItem = prestador.itens.find(pi => pi.id === item.itemId);
        if (!prestItem) return item;
        return {
          ...item,
          tipo: prestItem.tipo,
          ...(prestItem.tipo === 'variavel' && {
            percentualUsado: item.percentualUsado ?? prestItem.percentual,
          }),
        };
      });

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

  function handlePremioToggle(itemId: string) {
    setLanc(prev => {
      if (!prev) return prev;
      const atual = prev.itensPremioIds ?? [];
      const marcado = atual.includes(itemId);
      const novosIds = marcado ? atual.filter(id => id !== itemId) : [...atual, itemId];
      // Recalcula o valor do prêmio com base nos itens marcados
      const pct = prestador.percentualPremio ?? 0;
      const baseValor = prev.itens
        .filter(it => novosIds.includes(it.itemId))
        .reduce((s, it) => s + (it.valor || 0), 0);
      const valorPremio = Math.round(baseValor * pct / 100 * 100) / 100;
      const itens = prev.itens.map(it =>
        it.itemId === 'premio_adicional' ? { ...it, valor: valorPremio } : it
      );
      return { ...prev, itensPremioIds: novosIds, itens };
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

  function handleAbrirAssinatura(campo: 'financeiro' | 'rh') {
    if (!session) return;
    setAssinaDialog({ campo, nome: session.name ?? '', senha: '', loading: false, erro: null });
  }

  async function handleConfirmarAssinatura() {
    if (!assinaDialog || !lanc || !session) return;
    setAssinaDialog(prev => prev ? { ...prev, loading: true, erro: null } : prev);
    const result = await apiLogin(session.username, assinaDialog.senha);
    if ('error' in result) {
      setAssinaDialog(prev => prev ? { ...prev, loading: false, erro: 'Senha incorreta. Tente novamente.' } : prev);
      return;
    }
    const assinatura: AssinaturaDigital = {
      username: session.username,
      name: (result.session.name ?? assinaDialog.nome) || undefined,
      dataHora: new Date().toISOString(),
    };
    const novoLanc: LancamentoPJ = {
      ...lanc,
      assinaturas: { ...lanc.assinaturas, [assinaDialog.campo]: assinatura },
    };
    setLanc(novoLanc);
    await saveLancamento(novoLanc);
    setAssinaDialog(null);
    toast.success(`Assinatura de ${assinaDialog.campo === 'financeiro' ? 'Financeiro' : 'RH'} registrada com sucesso!`);
  }

  async function handleConfirmarReabrir() {
    if (!reabrirDialog || !lanc) return;
    if (reabrirDialog.senha !== '1985') {
      setReopenDialog(prev => prev ? { ...prev, erro: 'Senha incorreta.' } : prev);
      return;
    }
    const updated: LancamentoPJ = {
      ...lanc,
      assinaturas: {},
      status: 'pendente',
      dataPagamento: undefined,
    };
    await saveLancamento(updated);
    setLanc(updated);
    setReopenDialog(null);
    toast.success('Demonstrativo reaberto. Assinaturas removidas.');
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
              ) : isLocked ? (
                <button
                  onClick={() => setReopenDialog({ senha: '', erro: null })}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-semibold transition-colors"
                >
                  <LockOpen className="w-3.5 h-3.5" />
                  Reabrir demonstrativo
                </button>
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
              onPremioToggle={handlePremioToggle}
              onAssinar={handleAbrirAssinatura}
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

      {/* ─── Dialog de Reabertura ─── */}
      {reabrirDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <LockOpen className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-800">Reabrir demonstrativo</h3>
              </div>
              <button onClick={() => setReopenDialog(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <p className="text-sm text-slate-600">
                Isso irá <strong>remover todas as assinaturas</strong> e reverter o status para{' '}
                <strong>Pendente</strong>. Digite a senha para confirmar.
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
                disabled={!reabrirDialog.senha}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LockOpen className="w-3.5 h-3.5" />
                Reabrir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Dialog de Assinatura Eletrônica ─── */}
      {assinaDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Assinar — {assinaDialog.campo === 'financeiro' ? 'Financeiro' : 'Recursos Humanos'}
                </h3>
              </div>
              <button onClick={() => setAssinaDialog(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</label>
                <input
                  type="text"
                  autoFocus
                  value={assinaDialog.nome}
                  onChange={e => setAssinaDialog(prev => prev ? { ...prev, nome: e.target.value } : prev)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="Seu nome completo"
                />
              </div>
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assinaDialog.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Confirmar Assinatura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
