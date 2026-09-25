import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Printer, Check, Save, Loader2, X, FileText, PenLine, ShieldCheck, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import { kvGet } from '@/lib/kvClient';
import { loadDREDataAsync } from '@/lib/dbStorage';
import { useAuth } from '@/contexts/useAuth';
import { apiLogin } from '@/lib/authClient';
import {
  loadLancamento,
  saveLancamento,
  buildLancamentoVazio,
  buildColaboradorSnapshot,
  buildLancamentoPreview,
  percentualBaseVariavel,
  totalLancamento,
  CAMPO_ASSINATURA_LABELS,
  type Colaborador,
  type ColaboradorSnapshot,
  type LancamentoRV,
  type LancamentoItemRV,
  type AssinaturaDigital,
  type BaseCalculoVariavel,
  type CampoAssinaturaRV,
} from './remVariaveisStorage';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 3 + i);

// ─── Mapeamentos DRE (base automática por departamento) ──────────────────────

/** baseCalculo → chave de departamento no DRE */
const BASE_TO_DEPT: Record<BaseCalculoVariavel, string> = {
  lucro_novos:     'novos',
  lucro_usados:    'usados',
  lucro_vd_direta: 'direta',
  lucro_pecas:     'pecas',
  lucro_oficina:   'oficina',
  lucro_funilaria: 'funilaria',
};

/** chave de departamento DRE → Department do Dashboard Executivo */
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
  year, month, onPrev, onNext, onYearChange, onMonthChange,
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
  colaborador,
  lanc,
  year,
  month,
  editing,
  isAdmin,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onKpiAlcancadoChange,
  onAssinar,
}: {
  colaborador: Colaborador | ColaboradorSnapshot;
  lanc: LancamentoRV;
  year: number;
  month: number;
  editing: boolean;
  isAdmin: boolean;
  onItemChange: (idx: number, patch: Partial<LancamentoItemRV>) => void;
  onAddItem: () => void;
  onRemoveItem: (idx: number) => void;
  onKpiAlcancadoChange: (kpiId: string, valor: number | undefined) => void;
  onAssinar: (campo: CampoAssinaturaRV) => void;
}) {
  const total = totalLancamento(lanc);
  const brandColor = colaborador.brand === 'vw' ? '#001e50' : '#bb0a30';
  const brandDark  = colaborador.brand === 'vw' ? '#001238' : '#9a0827';
  const periodLabel = `${MONTHS[month - 1]} de ${year}`;
  const kpis = colaborador.kpis ?? [];

  return (
    <div id="demonstrativo-print-area" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 text-white" style={{ backgroundColor: brandColor }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold opacity-75 uppercase tracking-wider mb-0.5">
              Demonstrativo de Remuneração Variável
            </p>
            <h2 className="text-lg font-bold">{colaborador.nome}</h2>
            {colaborador.departamento && (
              <p className="text-sm opacity-80">{colaborador.departamento}</p>
            )}
            {colaborador.cargo && (
              <p className="text-xs opacity-70 mt-0.5">{colaborador.cargo}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs opacity-75 uppercase tracking-wider">Competência</p>
            <p className="text-base font-bold mt-0.5">{periodLabel}</p>
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
              colaborador.itens.find(ci => ci.id === item.itemId)?.percentual;
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-slate-800">{item.descricao}</span>
                      {item.tipo === 'variavel' && item.categoria && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                          {item.categoria === 'premio' ? 'Prêmio' : 'Comissão'}
                        </span>
                      )}
                    </div>
                  )}
                </td>

                {/* Tipo / % */}
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      item.tipo === 'fixa'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {item.tipo === 'fixa' ? 'Fixo' : 'Variável'}
                    </span>
                    {item.tipo === 'variavel' && pct != null && (() => {
                      const pctBase = colaborador.itens.find(ci => ci.id === item.itemId)?.percentual;
                      const kpiBonus = (colaborador.kpis ?? [])
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
                        {item.baseCalculoLabel && (
                          <span className="text-[9px] text-slate-400 text-right leading-tight">
                            {item.baseCalculoLabel.replace('LUCRO LÍQUIDO DO EXERCÍCIO - ', '')} · DRE
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-0.5">
                        <p className="text-right text-sm text-slate-600 tabular-nums">
                          {item.valorBaseCalculo ? fmtBRL(item.valorBaseCalculo) : '—'}
                        </p>
                        {item.baseCalculoLabel && (
                          <span className="text-[9px] text-slate-400 text-right leading-tight">
                            {item.baseCalculoLabel.replace('LUCRO LÍQUIDO DO EXERCÍCIO - ', '')}
                          </span>
                        )}
                      </div>
                    )
                  ) : (
                    <p className="text-right text-sm text-slate-300">—</p>
                  )}
                </td>

                {/* Valor */}
                <td className="px-6 py-3 text-right">
                  {editing && isAdmin && item.tipo === 'fixa' ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.valor || ''}
                      onChange={e => onItemChange(idx, { valor: parseFloat(e.target.value) || 0 })}
                      className="w-32 border border-slate-300 rounded px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-400"
                      placeholder="0,00"
                    />
                  ) : (
                    <span className="text-sm font-bold text-slate-800 tabular-nums">
                      {item.valor ? fmtBRL(item.valor) : '—'}
                    </span>
                  )}
                </td>

                {editing && isAdmin && (
                  <td className="pr-4">
                    <button
                      onClick={() => onRemoveItem(idx)}
                      className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 no-print"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: brandDark }}>
            <td colSpan={3} className="px-6 py-3 text-sm font-bold text-white">Total Variável</td>
            <td className="px-6 py-3 text-right text-base font-bold text-white tabular-nums">{fmtBRL(total)}</td>
            {editing && isAdmin && <td />}
          </tr>
        </tfoot>
      </table>

      {/* Resumo consolidado — Salário Fixo (RH) + Variável */}
      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-slate-500">Salário Fixo</span>
              <span className="font-semibold text-slate-700 tabular-nums">{fmtBRL(colaborador.salarioFixo ?? 0)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-500">Remuneração Variável</span>
              <span className="font-semibold text-slate-700 tabular-nums">{fmtBRL(total)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5 rounded-lg px-4 py-2 border border-teal-200 bg-teal-50">
            <span className="text-[11px] font-semibold text-teal-600 uppercase tracking-wider">Total a Receber no Mês</span>
            <span className="text-xl font-bold text-teal-700 tabular-nums">{fmtBRL((colaborador.salarioFixo ?? 0) + total)}</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          O salário fixo já está cadastrado no RH; valor informativo para conferência do total a ser recebido pelo colaborador.
        </p>
      </div>

      {/* Adicionar item (edição) */}
      {editing && isAdmin && (
        <div className="px-6 py-3 border-t border-slate-100 no-print">
          <button
            onClick={onAddItem}
            className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-semibold"
          >
            <FileText className="w-3.5 h-3.5" />
            Adicionar item avulso
          </button>
        </div>
      )}

      {/* KPIs — controle de atingimento (edição) */}
      {editing && isAdmin && kpis.length > 0 && (
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col gap-2 no-print">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">KPIs do mês</p>
          {kpis.map(kpi => {
            const alcancado = lanc.kpisAlcancado?.[kpi.id];
            const atingido = (lanc.kpisAtingidos ?? []).includes(kpi.id);
            return (
              <div key={kpi.id} className={`flex items-center gap-3 flex-wrap rounded-lg px-3 py-2 border ${
                atingido ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">{kpi.descricao || 'KPI'}</span>
                {kpi.objetivo != null && (
                  <span className="text-xs text-slate-400">
                    Meta: {kpi.condicao ?? '>='} {kpi.objetivo}{kpi.unidade ? ` ${kpi.unidade}` : ''}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500">Alcançado:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={alcancado ?? ''}
                    onChange={e => onKpiAlcancadoChange(kpi.id, e.target.value === '' ? undefined : parseFloat(e.target.value))}
                    className="w-24 border border-slate-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-400"
                    placeholder="0"
                  />
                  {kpi.unidade && <span className="text-xs text-slate-400">{kpi.unidade}</span>}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  atingido ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {atingido ? `+${kpi.percentualBonus}%` : 'não atingido'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Assinaturas */}
      <div className="border-t border-slate-100 px-6 py-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Assinaturas</p>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(CAMPO_ASSINATURA_LABELS) as CampoAssinaturaRV[]).map(campo => {
            const ass = lanc.assinaturas?.[campo];
            const label = CAMPO_ASSINATURA_LABELS[campo];
            if (ass) {
              return (
                <div key={campo} className="border border-emerald-200 rounded-lg px-3 py-2.5 bg-emerald-50">
                  <p className="text-[11px] font-bold text-emerald-700 mb-0.5">{label}</p>
                  {ass.name && ass.name !== ass.username && (
                    <p className="text-xs font-bold text-emerald-800">{ass.name}</p>
                  )}
                  <p className="text-[11px] text-emerald-600">{ass.username}</p>
                  <p className="text-[10px] text-emerald-500">{new Date(ass.dataHora).toLocaleString('pt-BR')}</p>
                  <p className="text-[10px] font-bold text-emerald-600 mt-1">✓ ASSINATURA ELETRÔNICA</p>
                </div>
              );
            }
            return (
              <div key={campo} className="border border-dashed border-slate-300 rounded-lg px-3 py-2.5 bg-slate-50">
                <p className="text-[11px] font-bold text-slate-400">{label}</p>
                <button
                  onClick={() => onAssinar(campo)}
                  className="mt-2 flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-semibold no-print"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  Assinar
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

interface ColaboradorDemonstrativoPageProps {
  colaborador: Colaborador;
  isAdmin: boolean;
  onBack: () => void;
  initialYear?: number;
  initialMonth?: number;
}

export function ColaboradorDemonstrativoPage({ colaborador, isAdmin, onBack, initialYear, initialMonth }: ColaboradorDemonstrativoPageProps) {
  const now = new Date();
  const [year,  setYear]  = useState(initialYear  ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth() + 1);

  const [lanc,    setLanc]    = useState<LancamentoRV | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [editing, setEditing] = useState(false);
  const [dirty,   setDirty]   = useState(false);

  const { session } = useAuth();
  const [assinaDialog, setAssinaDialog] = useState<{
    campo: CampoAssinaturaRV;
    nome: string;
    senha: string;
    loading: boolean;
    erro: string | null;
  } | null>(null);
  const [reabrirDialog, setReopenDialog] = useState<{ senha: string; erro: string | null } | null>(null);

  const isLocked = !!(
    lanc?.assinaturas?.financeiro ||
    lanc?.assinaturas?.gerenciaComercial ||
    lanc?.assinaturas?.diretoriaComercial ||
    lanc?.assinaturas?.diretoria ||
    lanc?.status === 'pago'
  );
  const effectiveColaborador = lanc?.status === 'pago' && lanc?.snapshotColaborador
    ? lanc.snapshotColaborador
    : colaborador;

  // Carrega lançamento do mês selecionado + base do DRE (mês anterior, igual PJ)
  useEffect(() => {
    setLoading(true);
    setEditing(false);
    setDirty(false);

    const drePrev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
    const dreKey = `resumo_dre:${colaborador.brand}:${drePrev.year}-${String(drePrev.month).padStart(2, '0')}`;

    async function load() {
      const [existing, kvDreRow] = await Promise.all([
        loadLancamento(colaborador.id, year, month),
        kvGet<any>(dreKey),
      ]);

      if (existing && existing.status === 'pago') {
        setLanc(existing);
        setLoading(false);
        return;
      }

      // Monta a linha de DRE por departamento (prioriza o Dashboard Executivo)
      let dreRow = kvDreRow;
      const monthIndex = drePrev.month - 1;
      const deptEntries = Object.entries(DEPT_TO_EXEC_DEPT);
      const dreResults = await Promise.all(
        deptEntries.map(([dk, dept]) =>
          loadDREDataAsync(drePrev.year as any, dept as any, colaborador.brand).then(d => ({ dk, d }))
        )
      );
      const synthetic: Record<string, { lucroLiquidoExercicio: number }> = {};
      for (const { dk, d } of dreResults) {
        synthetic[dk] = { lucroLiquidoExercicio: extractLucroLiquido(d, monthIndex) };
      }
      if (Object.values(synthetic).some(v => v.lucroLiquidoExercicio !== 0)) {
        dreRow = synthetic;
      }

      const raw = existing ?? buildLancamentoVazio(colaborador, year, month);
      let base = buildLancamentoPreview(colaborador, raw);

      // Preenche a base dos itens variáveis com baseCalculo a partir do DRE e recalcula o valor
      if (dreRow) {
        base = {
          ...base,
          itens: base.itens.map(item => {
            if (item.tipo !== 'variavel') return item;
            const colabItem = colaborador.itens.find(ci => ci.id === item.itemId);
            if (!colabItem?.baseCalculo) return item;
            const dk = BASE_TO_DEPT[colabItem.baseCalculo];
            const valorBase = Math.max(0, parseValDre(dreRow[dk]?.lucroLiquidoExercicio));
            const kpiBonus = (colaborador.kpis ?? [])
              .filter(k => k.itemRemuneracaoId === colabItem.id && (base.kpisAtingidos ?? []).includes(k.id))
              .reduce((s, k) => s + k.percentualBonus, 0);
            const pctTotal = percentualBaseVariavel(colabItem, valorBase) + kpiBonus;
            const valor = valorBase > 0 ? Math.max(0, Math.round((valorBase * pctTotal / 100) * 100) / 100) : 0;
            return { ...item, valorBaseCalculo: valorBase, percentualUsado: pctTotal, valor };
          }),
        };
      }

      setLanc(base);
      setLoading(false);
    }
    load();
  }, [colaborador, year, month]);

  function handlePrev() {
    const p = prevMonth(year, month);
    setYear(p.year); setMonth(p.month);
  }
  function handleNext() {
    const p = nextMonth(year, month);
    setYear(p.year); setMonth(p.month);
  }

  function recalcVariavel(it: LancamentoItemRV, kpisAtingidos: string[]): LancamentoItemRV {
    if (it.tipo !== 'variavel') return it;
    const colabItem = colaborador.itens.find(ci => ci.id === it.itemId);
    const kpiBonus = (colaborador.kpis ?? [])
      .filter(k => k.itemRemuneracaoId === it.itemId && kpisAtingidos.includes(k.id))
      .reduce((s, k) => s + k.percentualBonus, 0);
    const valorBase = it.valorBaseCalculo ?? 0;
    const pctBase = colabItem ? percentualBaseVariavel(colabItem, valorBase) : 0;
    const pctTotal = pctBase + kpiBonus;
    const valor = valorBase > 0 ? Math.max(0, Math.round(((valorBase * pctTotal) / 100) * 100) / 100) : 0;
    return { ...it, percentualUsado: pctTotal, valor };
  }

  function handleItemChange(idx: number, patch: Partial<LancamentoItemRV>) {
    setLanc(prev => {
      if (!prev) return prev;
      const itens = prev.itens.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, ...patch };
        if (updated.tipo === 'variavel' && 'valorBaseCalculo' in patch) {
          return recalcVariavel(updated, prev.kpisAtingidos ?? []);
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
      const novo: LancamentoItemRV = {
        itemId: crypto.randomUUID(),
        descricao: '',
        tipo: 'fixa',
        valor: 0,
      };
      return { ...prev, itens: [...prev.itens, novo] };
    });
    setDirty(true);
  }

  function handleRemoveItem(idx: number) {
    setLanc(prev => prev ? { ...prev, itens: prev.itens.filter((_, i) => i !== idx) } : prev);
    setDirty(true);
  }

  function handleKpiAlcancadoChange(kpiId: string, valor: number | undefined) {
    setLanc(prev => {
      if (!prev) return prev;
      const novoAlcancado = { ...(prev.kpisAlcancado ?? {}), [kpiId]: valor ?? 0 };
      const kpi = colaborador.kpis?.find(k => k.id === kpiId);
      let novosKpisAtingidos = prev.kpisAtingidos ?? [];
      if (kpi?.objetivo != null && valor != null) {
        const condicao = kpi.condicao ?? '>=';
        const deveAtingir = condicao === '>=' ? valor >= kpi.objetivo : valor <= kpi.objetivo;
        const jaAtingido = novosKpisAtingidos.includes(kpiId);
        if (deveAtingir && !jaAtingido) novosKpisAtingidos = [...novosKpisAtingidos, kpiId];
        else if (!deveAtingir && jaAtingido) novosKpisAtingidos = novosKpisAtingidos.filter(id => id !== kpiId);
      }
      const itens = prev.itens.map(it => recalcVariavel(it, novosKpisAtingidos));
      return { ...prev, kpisAlcancado: novoAlcancado, kpisAtingidos: novosKpisAtingidos, itens };
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
    if (!lanc || lanc.status === 'pago') return;
    const updated: LancamentoRV = {
      ...lanc,
      status: 'pago',
      dataPagamento: new Date().toLocaleDateString('pt-BR'),
      snapshotColaborador: buildColaboradorSnapshot(colaborador),
    };
    setLanc(updated);
    await saveLancamento(updated);
    toast.success('Marcado como pago.');
  }

  function handleAbrirAssinatura(campo: CampoAssinaturaRV) {
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
    const novoLanc: LancamentoRV = {
      ...lanc,
      assinaturas: { ...lanc.assinaturas, [assinaDialog.campo]: assinatura },
    };
    setLanc(novoLanc);
    await saveLancamento(novoLanc);
    setAssinaDialog(null);
    toast.success(`Assinatura de ${CAMPO_ASSINATURA_LABELS[assinaDialog.campo]} registrada!`);
  }

  async function handleConfirmarReabrir() {
    if (!reabrirDialog || !lanc) return;
    if (reabrirDialog.senha !== '1985') {
      setReopenDialog(prev => prev ? { ...prev, erro: 'Senha incorreta.' } : prev);
      return;
    }
    const updated: LancamentoRV = {
      ...lanc,
      assinaturas: {},
      status: 'pendente',
      dataPagamento: undefined,
      snapshotColaborador: undefined,
    };
    await saveLancamento(updated);
    setLanc(buildLancamentoPreview(colaborador, updated));
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
              Colaboradores
            </button>
            <div>
              <h2 className="text-base font-bold text-slate-800">{effectiveColaborador.nome}</h2>
              <p className="text-xs text-slate-500">
                {effectiveColaborador.brand === 'vw' ? 'VW' : 'Audi'}
                {effectiveColaborador.cargo ? ` · ${effectiveColaborador.cargo}` : ''}
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

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir PDF
            </button>

            {!editing && lanc?.status !== 'pago' && (
              <button
                onClick={handleToggleStatus}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200"
              >
                <Check className="w-3.5 h-3.5" />
                Marcar como pago
              </button>
            )}

            {isAdmin && (
              editing ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditing(false); setDirty(false);
                      loadLancamento(colaborador.id, year, month).then(l =>
                        setLanc(buildLancamentoPreview(colaborador, l ?? buildLancamentoVazio(colaborador, year, month)))
                      );
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      dirty || saving ? 'bg-teal-600 hover:bg-teal-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
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
          <DemonstrativoTable
            colaborador={effectiveColaborador}
            lanc={lanc}
            year={year}
            month={month}
            editing={editing}
            isAdmin={isAdmin}
            onItemChange={handleItemChange}
            onAddItem={handleAddItem}
            onRemoveItem={handleRemoveItem}
            onKpiAlcancadoChange={handleKpiAlcancadoChange}
            onAssinar={handleAbrirAssinatura}
          />
        ) : null}
      </div>

      {/* Dialog de Reabertura */}
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

      {/* Dialog de Assinatura Eletrônica */}
      {assinaDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Assinar — {CAMPO_ASSINATURA_LABELS[assinaDialog.campo]}
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
