import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Printer, Check, Save, Loader2, Plus, Trash2, X, History, FileText, PenLine, CheckCircle, ShieldCheck, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import { kvGet } from '@/lib/kvClient';
import { loadDREDataAsync } from '@/lib/dbStorage';
import { useAuth } from '@/contexts/useAuth';
import { apiLogin } from '@/lib/authClient';
import {
  loadLancamento,
  saveLancamento,
  deleteLancamento,
  loadHistorico,
  buildLancamentoVazio,
  totalLancamento,
  BASE_CALCULO_LABELS,
  DESCRICAO_TRIMESTRAL,
  type PrestadorPJ,
  type PrestadorSnapshotPJ,
  type LancamentoPJ,
  type LancamentoItem,
  type StatusPagamento,
  type AssinaturaDigital,
  type KpiPrestador,
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

/** chave DRE → rótulo de departamento usado no rateio PJ */
const DRE_TO_RATEIO_DEPT: Record<string, string> = {
  novos: 'Novos Varejo',
  direta: 'VD Direta',
  usados: 'Usados',
  pecas: 'Peças',
  oficina: 'Oficina',
  funilaria: 'Funilaria',
};

/** Mapeamento de chave de departamento DRE → Department do Dashboard Executivo */
const DEPT_TO_EXEC_DEPT: Record<string, string> = {
  novos:     'novos',
  usados:    'usados',
  direta:    'vendaDireta',
  pecas:     'pecas',
  oficina:   'oficina',
  funilaria: 'funilaria',
};

/** Extrai lucroLiquidoExercicio de um DRELine[] do Dashboard Executivo para um mês (0-based) */
function extractLucroLiquido(dreLines: any[] | null, monthIndex: number): number {
  if (!dreLines) return 0;
  for (const line of dreLines) {
    const label = String(line.label || line.descricao || '')
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z ]/g, '').trim();
    if (label === 'LUCRO LIQUIDO DO EXERCICIO') {
      const vals: number[] = line.meses || line.values || [];
      return vals[monthIndex] ?? 0;
    }
  }
  return 0;
}

function parseValDre(v: string | number | undefined | null): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
}

function normalizeText(value: string | undefined | null): string {
  return String(value ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferBaseCalculoFromItem(
  prestItem?: PrestadorPJ['itens'][number],
  itemAtual?: LancamentoItem,
): keyof typeof BASE_CALCULO_LABELS | undefined {
  if (prestItem?.baseCalculo) return prestItem.baseCalculo;

  const merged = `${prestItem?.descricao ?? ''} ${itemAtual?.descricao ?? ''} ${itemAtual?.baseCalculoLabel ?? ''}`;
  const text = normalizeText(merged);

  if (text.includes('NOVOS') && text.includes('USADOS')) return 'lucro_novos_usados';
  if (text.includes('PECAS') && text.includes('OFICINA')) return 'lucro_pecas_oficina';
  if (text.includes('VD') || text.includes('DIRETA')) return 'lucro_vd_direta';
  if (text.includes('FUNILARIA')) return 'lucro_funilaria';
  if (text.includes('OFICINA')) return 'lucro_oficina';
  if (text.includes('PECAS')) return 'lucro_pecas';
  if (text.includes('USADOS')) return 'lucro_usados';
  if (text.includes('NOVOS')) return 'lucro_novos';

  return undefined;
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildPrestadorSnapshot(prestador: PrestadorPJ): PrestadorSnapshotPJ {
  return {
    ...prestador,
    itens: (prestador.itens ?? []).map(i => ({
      ...i,
      rateio: i.rateio ? i.rateio.map(row => ({ ...row })) : undefined,
      departamentos: i.departamentos ? [...i.departamentos] : undefined,
    })),
    kpis: (prestador.kpis ?? []).map(k => ({ ...k })),
    itensPremioIds: [...(prestador.itensPremioIds ?? [])],
  };
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
  dreYear,
  dreMonth,
  editing,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onPremioToggle,
  onKpiToggle,
  onKpiAlcancadoChange,
  onAssinar,
  isAdmin,
}: {
  prestador: PrestadorPJ | PrestadorSnapshotPJ;
  lanc: LancamentoPJ;
  year: number;
  month: number;
  dreYear: number;
  dreMonth: number;
  editing: boolean;
  onItemChange: (idx: number, patch: Partial<LancamentoItem>) => void;
  onAddItem: () => void;
  onRemoveItem: (idx: number) => void;
  onPremioToggle: (itemId: string) => void;
  onKpiToggle: (kpiId: string) => void;
  onKpiAlcancadoChange: (kpiId: string, valor: number | undefined) => void;
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
              Demonstrativo de Pagamento Prestador de Serviço
            </p>
            <h2 className="text-lg font-bold no-print">{prestador.nome}</h2>
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
                    {item.tipo === 'variavel' && pct != null && (() => {
                      const pctBase = prestador.itens.find(pi => pi.id === item.itemId)?.percentual;
                      const kpiBonus = (prestador.kpis ?? [])
                        .filter(k => k.itemRemuneracaoId === item.itemId && (lanc.kpisAtingidos ?? []).includes(k.id))
                        .reduce((s, k) => s + k.percentualBonus, 0);
                      return (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                            {pct}% s/ base
                          </span>
                          {kpiBonus > 0 && pctBase != null && (
                            <span className="text-[9px] text-teal-600 font-semibold">
                              {pctBase}% + {kpiBonus}% KPI
                            </span>
                          )}
                        </div>
                      );
                    })()}
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
                            <div className="text-[10px] text-slate-700 mt-0.5">
                              {MONTHS_SHORT[dreMonth - 1]}/{String(dreYear).slice(-2)}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </div>
                    )
                  ) : item.tipo === 'premio' ? (
                    (() => {
                      const marcados = lanc.itensPremioIds ?? [];
                      const somaItens = lanc.itens
                        .filter(it => marcados.includes(it.itemId))
                        .reduce((s, it) => s + (it.valor || 0), 0);
                      const deducao = prestador.deducaoBasePremio ?? 0;
                      const baseReal = Math.max(0, somaItens - deducao);
                      if (somaItens === 0) {
                        return <span className="text-slate-300 text-sm block text-right">—</span>;
                      }
                      if (deducao <= 0) {
                        return (
                          <div className="text-right text-sm font-medium text-purple-700 tabular-nums">{fmtBRL(somaItens)}</div>
                        );
                      }
                      return (
                        <div className="text-right flex flex-col gap-0.5">
                          <div className="text-xs text-slate-700 tabular-nums">{fmtBRL(somaItens)}</div>
                          <div className="text-xs text-red-500 tabular-nums">− {fmtBRL(deducao)}</div>
                          <div className="text-sm font-semibold text-purple-700 tabular-nums border-t border-purple-200 pt-0.5">{fmtBRL(baseReal)}</div>
                        </div>
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

      {/* ─── Seção de KPIs ─── */}
      {(prestador.kpis ?? []).length > 0 && (
        <div className="px-6 py-4 border-t border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">KPIs</p>
          <div className="flex flex-col gap-2">
            {(prestador.kpis ?? []).map(kpi => {
              const atingido = (lanc.kpisAtingidos ?? []).includes(kpi.id);
              const alcancado = lanc.kpisAlcancado?.[kpi.id];
              const itemAfetado = prestador.itens.find(it => it.id === kpi.itemRemuneracaoId);
              const temObjetivo = kpi.objetivo != null;
              return (
                <div key={kpi.id} className={`rounded-lg border transition-colors ${
                  atingido ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  {/* Linha principal */}
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    {/* Toggle (apenas em edição e sem objetivo automático) ou ícone fixo */}
                    {editing && isAdmin && !temObjetivo ? (
                      <button
                        type="button"
                        onClick={() => onKpiToggle(kpi.id)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                          atingido
                            ? 'bg-teal-600 text-white hover:bg-teal-700'
                            : 'bg-white border-2 border-slate-300 text-slate-400 hover:border-teal-400'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        atingido ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-400'
                      }`}>
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                    {/* Descrição e item afetado */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${atingido ? 'text-teal-800' : 'text-slate-600'}`}>
                        {kpi.descricao}
                      </p>
                      {itemAfetado && (
                        <p className="text-xs text-slate-400 mt-0.5">{itemAfetado.descricao}</p>
                      )}
                    </div>
                    {/* Bônus e status */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        atingido
                          ? 'bg-teal-100 text-teal-700 border-teal-300'
                          : 'bg-slate-100 text-slate-500 border-slate-300'
                      }`}>
                        +{kpi.percentualBonus}%
                      </span>
                      <span className={`text-xs font-semibold ${atingido ? 'text-teal-600' : 'text-slate-400'}`}>
                        {atingido ? 'Atingido' : 'Não atingido'}
                      </span>
                    </div>
                  </div>

                  {/* Linha objetivo / alcançado (quando há objetivo ou está em edição) */}
                  {(temObjetivo || editing) && (
                    <div className="flex items-center gap-4 px-4 pb-3 pt-0">
                      {/* Objetivo */}
                      {temObjetivo && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Meta:</span>
                          <span className="text-xs font-bold text-slate-500">
                            {kpi.condicao === '<=' ? '≤' : '≥'}
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            {kpi.objetivo?.toLocaleString('pt-BR')}{kpi.unidade ? ` ${kpi.unidade}` : ''}
                          </span>
                        </div>
                      )}
                      {/* Alcançado */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Alcançado:</span>
                        {editing && isAdmin ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={alcancado ?? ''}
                              onChange={e => onKpiAlcancadoChange(kpi.id, e.target.value !== '' ? parseFloat(e.target.value) : undefined)}
                              className={`w-24 border rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 ${
                                atingido
                                  ? 'border-teal-300 focus:ring-teal-400 bg-white'
                                  : 'border-slate-300 focus:ring-slate-400 bg-white'
                              }`}
                              placeholder="0"
                            />
                            {kpi.unidade && <span className="text-[10px] text-slate-400">{kpi.unidade}</span>}
                          </div>
                        ) : (
                          <span className={`text-xs font-bold ${
                            alcancado != null ? (atingido ? 'text-teal-700' : 'text-red-500') : 'text-slate-400 italic'
                          }`}>
                            {alcancado != null
                              ? `${alcancado.toLocaleString('pt-BR')}${kpi.unidade ? ` ${kpi.unidade}` : ''}`
                              : '—'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
  onOpenRateio?: (ctx: {
    year: number;
    month: number;
    lancamento: LancamentoPJ | null;
    prestadorEfetivo: PrestadorPJ | PrestadorSnapshotPJ;
  }) => void;
  initialYear?: number;
  initialMonth?: number;
}

export function PrestadorDemonstrativoPage({ prestador, isAdmin, onBack, onOpenRateio, initialYear, initialMonth }: PrestadorDemonstrativoPageProps) {
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
  const effectivePrestador = lanc?.status === 'pago' && lanc?.snapshotPrestador
    ? lanc.snapshotPrestador
    : prestador;

  // Carrega lançamento do mês selecionado + DRE do mês anterior
  useEffect(() => {
    setLoading(true);
    setEditing(false);
    setDirty(false);

    const drePrev = month === 1
      ? { year: year - 1, month: 12 }
      : { year, month: month - 1 };
    const dreKey = `resumo_dre:${prestador.brand}:${drePrev.year}-${String(drePrev.month).padStart(2, '0')}`;

    async function load() {
      let [existing, kvDreRow] = await Promise.all([
        loadLancamento(prestador.id, year, month),
        kvGet<any>(dreKey),
      ]);

      // Migração automática: lançamentos pagos antigos passam a salvar snapshot
      // para garantir congelamento completo no novo formato.
      if (existing && existing.status === 'pago' && !existing.snapshotPrestador) {
        const migrated: LancamentoPJ = {
          ...existing,
          snapshotPrestador: buildPrestadorSnapshot(prestador),
        };
        await saveLancamento(migrated);
        existing = migrated;
      }

      // Prioriza DRE do dashboard executivo (mais atual) e usa resumo_dre como fallback.
      let dreRow = kvDreRow;
      const monthIndex = drePrev.month - 1;
      const yr = drePrev.year as 2024 | 2025 | 2026 | 2027;
      const brand = prestador.brand as 'vw' | 'audi';
      const deptEntries = Object.entries(DEPT_TO_EXEC_DEPT);
      const dreResults = await Promise.all(
        deptEntries.map(([dk, dept]) =>
          loadDREDataAsync(yr, dept as any, brand).then(d => ({ dk, d }))
        )
      );

      const synthetic: Record<string, { lucroLiquidoExercicio: number }> = {};
      for (const { dk, d } of dreResults) {
        synthetic[dk] = { lucroLiquidoExercicio: extractLucroLiquido(d, monthIndex) };
      }

      // Se o DRE executivo retornou dados válidos, usa ele para evitar defasagem do resumo_dre.
      if (Object.values(synthetic).some(v => v.lucroLiquidoExercicio !== 0)) {
        dreRow = synthetic;
      }
      const base = existing ?? buildLancamentoVazio(prestador, year, month);

      // Somente sincroniza dados do cadastro e recalcula DRE quando o lançamento
      // não está pago (lançamento novo ou pendente). Demonstrativos pagos mantêm
      // exatamente os valores que foram salvos.
      if (!existing || existing.status !== 'pago') {
        // Em pendente, o demonstrativo deve refletir sempre o cadastro atual:
        // atualiza descrição/tipo/valor dos itens cadastrados e preserva apenas itens extras manuais.
        const prestadorItensMap = new Map(prestador.itens.map(pi => [pi.id, pi]));
        const itensAtuaisMap = new Map(base.itens.map(item => [item.itemId, item]));

        const itensCadastroAtualizados: LancamentoItem[] = prestador.itens.map(prestItem => {
          const itemAtual = itensAtuaisMap.get(prestItem.id);

          if (prestItem.tipo === 'fixa') {
            return {
              itemId: prestItem.id,
              descricao: prestItem.descricao,
              tipo: 'fixa',
              valor: prestItem.valorBase ?? 0,
            };
          }

          if (prestItem.tipo === 'variavel') {
            const inferredBaseCalculo = inferBaseCalculoFromItem(prestItem, itemAtual);
            return {
              itemId: prestItem.id,
              descricao: prestItem.descricao,
              tipo: 'variavel',
              valor: itemAtual?.valor ?? 0,
              valorBaseCalculo: itemAtual?.valorBaseCalculo,
              percentualUsado: itemAtual?.percentualUsado ?? prestItem.percentual,
              rateioBases: itemAtual?.rateioBases,
              baseCalculoLabel: prestItem.descricao === DESCRICAO_TRIMESTRAL
                ? 'Lucro Líquido do Trimestre'
                : inferredBaseCalculo ? BASE_CALCULO_LABELS[inferredBaseCalculo] : itemAtual?.baseCalculoLabel,
            };
          }

          return {
            itemId: prestItem.id,
            descricao: prestItem.descricao,
            tipo: 'premio',
            valor: itemAtual?.valor ?? 0,
            percentualUsado: itemAtual?.percentualUsado ?? prestItem.percentual,
          };
        });

        const itensExtras = base.itens.filter(item =>
          item.itemId !== 'premio_adicional' && !prestadorItensMap.has(item.itemId)
        );

        base.itens = [...itensCadastroAtualizados, ...itensExtras];

        const premioIdsValidos = (base.itensPremioIds ?? []).filter(id => prestadorItensMap.has(id));
        base.itensPremioIds = premioIdsValidos.length > 0
          ? premioIdsValidos
          : [...(prestador.itensPremioIds ?? [])];

        const idxPremioAdicional = base.itens.findIndex(it => it.itemId === 'premio_adicional');
        if (prestador.temPremio) {
          if (idxPremioAdicional === -1) {
            base.itens.push({
              itemId: 'premio_adicional',
              descricao: 'Prêmio Adicional',
              tipo: 'premio',
              valor: 0,
              ...(prestador.percentualPremio != null && { percentualUsado: prestador.percentualPremio }),
            });
          } else {
            base.itens[idxPremioAdicional] = {
              ...base.itens[idxPremioAdicional],
              descricao: 'Prêmio Adicional',
              tipo: 'premio',
              ...(prestador.percentualPremio != null && { percentualUsado: prestador.percentualPremio }),
            };
          }
        } else if (idxPremioAdicional !== -1) {
          base.itens.splice(idxPremioAdicional, 1);
        }

        // Preenche valorBaseCalculo de itens variáveis a partir do DRE
        if (dreRow) {
          base.itens = base.itens.map(item => {
            if (item.tipo !== 'variavel') return item;
            const prestItem = prestador.itens.find(pi => pi.id === item.itemId);
            let valorBase = 0;
            const rateioBases: Record<string, number> = {};
            const addBase = (dreKey: string, raw: number) => {
              const departamento = DRE_TO_RATEIO_DEPT[dreKey];
              if (!departamento) return;
              const valorPositivo = Math.max(0, raw || 0);
              if (valorPositivo <= 0) return;
              rateioBases[departamento] = (rateioBases[departamento] ?? 0) + valorPositivo;
            };

            if (item.descricao === DESCRICAO_TRIMESTRAL) {
              // Soma os departamentos selecionados nos chips
              const deps = prestItem?.departamentos ?? [];
              valorBase = deps.reduce((sum, dep) => {
                const dk = CHIP_TO_DEPT[dep];
                const raw = dk ? parseValDre(dreRow[dk]?.lucroLiquidoExercicio) : 0;
                if (dk) addBase(dk, raw);
                return sum + Math.max(0, raw);
              }, 0);
            } else {
              const baseCalculo = inferBaseCalculoFromItem(prestItem, item);
              if (baseCalculo) {
                if (baseCalculo === 'lucro_novos_usados') {
                  const novos = parseValDre(dreRow['novos']?.lucroLiquidoExercicio);
                  const usados = parseValDre(dreRow['usados']?.lucroLiquidoExercicio);
                  addBase('novos', novos);
                  addBase('usados', usados);
                  valorBase = Math.max(0, novos) + Math.max(0, usados);
                } else if (baseCalculo === 'lucro_pecas_oficina') {
                  const pecas = parseValDre(dreRow['pecas']?.lucroLiquidoExercicio);
                  const oficina = parseValDre(dreRow['oficina']?.lucroLiquidoExercicio);
                  addBase('pecas', pecas);
                  addBase('oficina', oficina);
                  valorBase = Math.max(0, pecas) + Math.max(0, oficina);
                } else {
                  const dk = BASE_TO_DEPT[baseCalculo];
                  if (dk) {
                    const raw = parseValDre(dreRow[dk]?.lucroLiquidoExercicio);
                    addBase(dk, raw);
                    valorBase = Math.max(0, raw);
                  }
                }
              }
            }

            const pctBase = prestItem?.percentual ?? 0;
            const kpiBonus = (prestador.kpis ?? [])
              .filter(k => k.itemRemuneracaoId === item.itemId && (base.kpisAtingidos ?? []).includes(k.id))
              .reduce((s, k) => s + k.percentualBonus, 0);
            const pctTotal = pctBase + kpiBonus;
            const valor = Math.max(0, Math.round((valorBase * pctTotal / 100) * 100) / 100);
            return {
              ...item,
              valorBaseCalculo: valorBase,
              valor,
              percentualUsado: pctTotal,
              rateioBases,
            };
          });
        }

        // Recalcula o prêmio adicional com base nos itens marcados e dedução
        if (prestador.temPremio) {
          const itensPremioIds = base.itensPremioIds ?? [];
          const pctPremio = prestador.percentualPremio ?? 0;
          const somaItens = base.itens
            .filter(it => itensPremioIds.includes(it.itemId))
            .reduce((s, it) => s + (it.valor || 0), 0);
          const deducaoPremio = prestador.deducaoBasePremio ?? 0;
          const baseValor = Math.max(0, somaItens - deducaoPremio);
          const valorPremio = Math.round(baseValor * pctPremio / 100 * 100) / 100;
          base.itens = base.itens.map(it =>
            it.itemId === 'premio_adicional' ? { ...it, valor: valorPremio } : it
          );
        }
      }

      setLanc(base);
      setLoading(false);
    }

    load();
  }, [prestador, year, month]);

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
          const pctBase = prestador.itens.find(pi => pi.id === it.itemId)?.percentual ?? 0;
          const kpiBonus = (prestador.kpis ?? [])
            .filter(k => k.itemRemuneracaoId === it.itemId && (prev.kpisAtingidos ?? []).includes(k.id))
            .reduce((s, k) => s + k.percentualBonus, 0);
          const pctTotal = pctBase + kpiBonus;
          updated.percentualUsado = pctTotal;
          updated.valor = Math.max(0, Math.round(((updated.valorBaseCalculo ?? 0) * pctTotal) / 100 * 100) / 100);
          updated.rateioBases = undefined;
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
      // Recalcula o valor do prêmio com base nos itens marcados e dedução
      const pct = prestador.percentualPremio ?? 0;
      const somaItens = prev.itens
        .filter(it => novosIds.includes(it.itemId))
        .reduce((s, it) => s + (it.valor || 0), 0);
      const deducao = prestador.deducaoBasePremio ?? 0;
      const baseValor = Math.max(0, somaItens - deducao);
      const valorPremio = Math.round(baseValor * pct / 100 * 100) / 100;
      const itens = prev.itens.map(it =>
        it.itemId === 'premio_adicional' ? { ...it, valor: valorPremio } : it
      );
      return { ...prev, itensPremioIds: novosIds, itens };
    });
    setDirty(true);
  }

  function handleKpiToggle(kpiId: string) {
    setLanc(prev => {
      if (!prev) return prev;
      const atual = prev.kpisAtingidos ?? [];
      const marcado = atual.includes(kpiId);
      const novosKpisAtingidos = marcado ? atual.filter(id => id !== kpiId) : [...atual, kpiId];
      // Recalcula todos os itens variáveis afetados por este KPI
      const itens = prev.itens.map(it => {
        if (it.tipo !== 'variavel') return it;
        const pctBase = prestador.itens.find(pi => pi.id === it.itemId)?.percentual ?? 0;
        const kpiBonus = (prestador.kpis ?? [])
          .filter(k => k.itemRemuneracaoId === it.itemId && novosKpisAtingidos.includes(k.id))
          .reduce((s, k) => s + k.percentualBonus, 0);
        const pctTotal = pctBase + kpiBonus;
        const valor = Math.max(0, Math.round(((it.valorBaseCalculo ?? 0) * pctTotal / 100) * 100) / 100);
        return { ...it, percentualUsado: pctTotal, valor };
      });
      // Recalcula prêmio se necessário
      let itensFinais = itens;
      if (prestador.temPremio) {
        const itensPremioIds = prev.itensPremioIds ?? [];
        const pctPremio = prestador.percentualPremio ?? 0;
        const somaItens = itens
          .filter(it => itensPremioIds.includes(it.itemId))
          .reduce((s, it) => s + (it.valor || 0), 0);
        const deducao = prestador.deducaoBasePremio ?? 0;
        const baseValor = Math.max(0, somaItens - deducao);
        const valorPremio = Math.round(baseValor * pctPremio / 100 * 100) / 100;
        itensFinais = itens.map(it =>
          it.itemId === 'premio_adicional' ? { ...it, valor: valorPremio } : it
        );
      }
      return { ...prev, kpisAtingidos: novosKpisAtingidos, itens: itensFinais };
    });
    setDirty(true);
  }

  function handleKpiAlcancadoChange(kpiId: string, valor: number | undefined) {
    setLanc(prev => {
      if (!prev) return prev;
      const novoAlcancado = { ...(prev.kpisAlcancado ?? {}), [kpiId]: valor ?? 0 };
      // Verifica se atingiu o objetivo para auto-toggle
      const kpi = prestador.kpis?.find(k => k.id === kpiId);
      let novosKpisAtingidos = prev.kpisAtingidos ?? [];
      if (kpi?.objetivo != null && valor != null) {
        const condicao = kpi.condicao ?? '>=';
        const deveAtigir = condicao === '>=' ? valor >= kpi.objetivo : valor <= kpi.objetivo;
        const jaEstaAtingido = novosKpisAtingidos.includes(kpiId);
        if (deveAtigir && !jaEstaAtingido) {
          novosKpisAtingidos = [...novosKpisAtingidos, kpiId];
        } else if (!deveAtigir && jaEstaAtingido) {
          novosKpisAtingidos = novosKpisAtingidos.filter(id => id !== kpiId);
        }
      }
      // Recalcula itens variáveis com base nos KPIs atingidos atualizados
      const itens = prev.itens.map(it => {
        if (it.tipo !== 'variavel') return it;
        const pctBase = prestador.itens.find(pi => pi.id === it.itemId)?.percentual ?? 0;
        const kpiBonus = (prestador.kpis ?? [])
          .filter(k => k.itemRemuneracaoId === it.itemId && novosKpisAtingidos.includes(k.id))
          .reduce((s, k) => s + k.percentualBonus, 0);
        const pctTotal = pctBase + kpiBonus;
        const valor2 = Math.max(0, Math.round(((it.valorBaseCalculo ?? 0) * pctTotal / 100) * 100) / 100);
        return { ...it, percentualUsado: pctTotal, valor: valor2 };
      });
      // Recalcula prêmio se necessário
      let itensFinais = itens;
      if (prestador.temPremio) {
        const itensPremioIds = prev.itensPremioIds ?? [];
        const pctPremio = prestador.percentualPremio ?? 0;
        const somaItens = itens
          .filter(it => itensPremioIds.includes(it.itemId))
          .reduce((s, it) => s + (it.valor || 0), 0);
        const deducao = prestador.deducaoBasePremio ?? 0;
        const baseValor = Math.max(0, somaItens - deducao);
        const valorPremio = Math.round(baseValor * pctPremio / 100 * 100) / 100;
        itensFinais = itens.map(it =>
          it.itemId === 'premio_adicional' ? { ...it, valor: valorPremio } : it
        );
      }
      return { ...prev, kpisAlcancado: novoAlcancado, kpisAtingidos: novosKpisAtingidos, itens: itensFinais };
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
    if (lanc.status === 'pago') return;
    const updated: LancamentoPJ = {
      ...lanc,
      status: 'pago',
      dataPagamento: new Date().toLocaleDateString('pt-BR'),
      snapshotPrestador: buildPrestadorSnapshot(prestador),
    };
    setLanc(updated);
    await saveLancamento(updated);
    toast.success('Marcado como pago.');
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
      snapshotPrestador: undefined,
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

  const brandColor = effectivePrestador.brand === 'vw' ? '#001e50' : '#bb0a30';

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
              <h2 className="text-base font-bold text-slate-800">{effectivePrestador.nome}</h2>
              <p className="text-xs text-slate-500">
                {effectivePrestador.brand === 'vw' ? 'VW' : 'Audi'}
                {effectivePrestador.cargo ? ` · ${effectivePrestador.cargo}` : ''}
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

            {onOpenRateio && (
              <button
                onClick={() => onOpenRateio({
                  year,
                  month,
                  lancamento: lanc,
                  prestadorEfetivo: effectivePrestador,
                })}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-semibold transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Rateio
              </button>
            )}

            {/* Status pago/pendente */}
            {!editing && lanc?.status !== 'pago' && (
              <button
                onClick={handleToggleStatus}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                Marcar como pago
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
              prestador={effectivePrestador}
              lanc={lanc}
              year={year}
              month={month}
              dreYear={month === 1 ? year - 1 : year}
              dreMonth={month === 1 ? 12 : month - 1}
              editing={editing}
              isAdmin={isAdmin}
              onItemChange={handleItemChange}
              onAddItem={handleAddItem}
              onRemoveItem={handleRemoveItem}
              onPremioToggle={handlePremioToggle}
              onKpiToggle={handleKpiToggle}
              onKpiAlcancadoChange={handleKpiAlcancadoChange}
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
                  prestador={effectivePrestador}
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
