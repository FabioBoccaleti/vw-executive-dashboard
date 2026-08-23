import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, X, TrendingUp, TrendingDown, BarChart2, Save, AlertCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import {
  type Marca,
  type DeptoClassificacao,
  type TipoContaClassificacao,
  type DadosOperacionais,
  type IEOIndicadorConfig,
  type IEOCenario,
  type NumeradorTipo,
  type DenominadorTipo,
  TIPO_CONTA_LABELS,
  TIPOS_CONTA_ORDENADOS,
  DEPTO_CLASSIFICACAO_LABELS,
  DEPTO_CLASSIFICACOES_ORDENADAS,
  loadAllDadosOperacionais,
  saveAllDadosOperacionais,
  dadosOpKey,
  loadCenarios,
  saveCenarios,
  loadClassificacoesConta,
} from './ieoStorage';
import {
  processDepartamentoData,
  processConsolidadoData,
  type DepartamentoData,
} from './ieoDataProcessor';

// ─── Tipos e Constantes ───────────────────────────────────────────────────────

type MainTab = 'vw' | 'audi' | 'configuracoes';
type DeptoFiltro = DeptoClassificacao | 'consolidado';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - 5 + i);

interface Periodo {
  year: number;
  semestre: 1 | 2;
}

const DEFAULT_PERIODOS: Periodo[] = [
  { year: CURRENT_YEAR - 1, semestre: 1 },
  { year: CURRENT_YEAR - 1, semestre: 2 },
  { year: CURRENT_YEAR, semestre: 1 },
];

const DEPTO_FILTROS: Array<{ id: DeptoFiltro; label: string }> = [
  { id: 'consolidado', label: 'Consolidado' },
  ...DEPTO_CLASSIFICACOES_ORDENADAS.map(d => ({
    id: d as DeptoFiltro,
    label: DEPTO_CLASSIFICACAO_LABELS[d],
  })),
];

const DEPTOS_OPTS: Array<{ id: DeptoClassificacao | 'consolidado'; label: string }> = [
  { id: 'consolidado', label: 'Consolidado (Total)' },
  ...DEPTO_CLASSIFICACOES_ORDENADAS.map(d => ({
    id: d as DeptoClassificacao | 'consolidado',
    label: DEPTO_CLASSIFICACAO_LABELS[d],
  })),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPeriodo(p: Periodo) {
  return `${p.semestre}º Sem/${p.year}`;
}

function fmtVal(n: number | null, formato: IEOIndicadorConfig['formato']): string {
  if (n === null) return '—';
  if (formato === 'percentual') {
    return `${(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtMeta(meta: number, formato: IEOIndicadorConfig['formato']): string {
  if (formato === 'percentual') return `${meta}%`;
  return meta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcDelta(
  first: number | null,
  last: number | null,
  melhorQuando: 'maior' | 'menor',
): { text: string; isPositive: boolean | null } {
  if (first === null || last === null || first === 0) return { text: '—', isPositive: null };
  const pct = ((last - first) / Math.abs(first)) * 100;
  const sign = pct >= 0 ? '+' : '';
  const text = `${sign}${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  return { text, isPositive: melhorQuando === 'maior' ? pct >= 0 : pct <= 0 };
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Opções de Numerador / Denominador ───────────────────────────────────────

const NUMERADOR_OPTS: Array<{ key: string; label: string }> = [
  { key: 'resultado',         label: 'Resultado Operacional (todos os grupos)' },
  { key: 'resultado_sem_fin', label: 'Resultado s/ Despesas Financeiras' },
  ...TIPOS_CONTA_ORDENADOS.map(g => ({ key: `grupo:${g}`, label: TIPO_CONTA_LABELS[g] })),
];

const DENOMINADOR_OPTS: Array<{ key: string; label: string }> = [
  { key: 'funcionarios',      label: 'Nº de Funcionários' },
  { key: 'volume_vendas',     label: 'Volume de Vendas / OS (unidades)' },
  { key: 'resultado',         label: 'Resultado Operacional' },
  { key: 'resultado_sem_fin', label: 'Resultado s/ Despesas Financeiras' },
  ...TIPOS_CONTA_ORDENADOS.map(g => ({ key: `grupo:${g}`, label: TIPO_CONTA_LABELS[g] })),
];

function numeradorToKey(n: NumeradorTipo): string {
  if (n.tipo === 'resultado') return 'resultado';
  if (n.tipo === 'resultado_sem_fin') return 'resultado_sem_fin';
  if (n.tipo === 'conta') return `conta:${n.conta}`;
  return `grupo:${n.grupo}`;
}

function denominadorToKey(d: DenominadorTipo): string {
  if (d.tipo === 'funcionarios') return 'funcionarios';
  if (d.tipo === 'volume_vendas') return 'volume_vendas';
  if (d.tipo === 'resultado') return 'resultado';
  if (d.tipo === 'resultado_sem_fin') return 'resultado_sem_fin';
  if (d.tipo === 'conta') return `conta:${d.conta}`;
  return `grupo:${d.grupo}`;
}

function keyToNumerador(key: string): NumeradorTipo {
  if (key === 'resultado') return { tipo: 'resultado' };
  if (key === 'resultado_sem_fin') return { tipo: 'resultado_sem_fin' };
  if (key.startsWith('conta:')) return { tipo: 'conta', conta: key.slice(6) };
  return { tipo: 'grupo', grupo: key.replace('grupo:', '') as TipoContaClassificacao };
}

function keyToDenominador(key: string): DenominadorTipo {
  if (key === 'funcionarios') return { tipo: 'funcionarios' };
  if (key === 'volume_vendas') return { tipo: 'volume_vendas' };
  if (key === 'resultado') return { tipo: 'resultado' };
  if (key === 'resultado_sem_fin') return { tipo: 'resultado_sem_fin' };
  if (key.startsWith('conta:')) return { tipo: 'conta', conta: key.slice(6) };
  return { tipo: 'grupo', grupo: key.replace('grupo:', '') as TipoContaClassificacao };
}

function extractValue(
  data: DepartamentoData,
  tipo: NumeradorTipo | DenominadorTipo,
  dadosOp: DadosOperacionais,
): number | null {
  if (tipo.tipo === 'grupo') return data.grupos[tipo.grupo]?.subtotal ?? 0;
  if (tipo.tipo === 'resultado') return data.total;
  if (tipo.tipo === 'resultado_sem_fin') {
    return data.total - (data.grupos.despesas_financeiras?.subtotal ?? 0);
  }
  if (tipo.tipo === 'funcionarios') return dadosOp.funcionarios ?? null;
  if (tipo.tipo === 'volume_vendas') return dadosOp.volumeVendas ?? null;
  if (tipo.tipo === 'conta') {
    // Soma o valor da conta em todos os grupos (pode aparecer em apenas um)
    let total = 0;
    for (const grupo of Object.values(data.grupos)) {
      const found = grupo.contas.find(c => c.conta === tipo.conta);
      if (found) total += found.valor;
    }
    return total;
  }
  return null;
}

// ─── CenarioSection ───────────────────────────────────────────────────────────
// Seção expandida de um cenário — valores calculados a partir do deptoDataMap já carregado

interface CenarioSectionProps {
  cenario: IEOCenario;
  periodos: Periodo[];
  deptoDataMap: Record<string, DepartamentoData | null>;
  allDadosOp: Record<string, DadosOperacionais>;
  onEdit: () => void;
  onDelete: () => void;
}

function CenarioSection({
  cenario, periodos, deptoDataMap, allDadosOp, onEdit, onDelete,
}: CenarioSectionProps) {
  const hasMultiple = periodos.length > 1;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-100">
        <span className="font-bold text-slate-700 text-sm">{cenario.nome}</span>
        <div className="flex gap-0.5">
          <button
            onClick={onEdit}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
            title="Editar"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {cenario.indicadores.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400">
          Nenhum indicador.{' '}
          <button onClick={onEdit} className="text-emerald-600 underline">
            Adicionar indicadores
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-44">
                  Indicador
                </th>
                {periodos.map((p, idx) => (
                  <th key={idx} className="text-right py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {fmtPeriodo(p)}
                  </th>
                ))}
                {hasMultiple && (
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    Δ {fmtPeriodo(periodos[0])} → {fmtPeriodo(periodos[periodos.length - 1])}
                  </th>
                )}
                <th className="text-right py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Meta
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {cenario.indicadores.map(ind => {
                const vals = periodos.map(p => {
                  const key = `${p.year}:S${p.semestre}`;
                  const data = deptoDataMap[key];
                  if (!data) return null;
                  const dadosOp = allDadosOp[dadosOpKey(p.year, p.semestre, cenario.departamento)] ?? {};
                  const num = extractValue(data, ind.numerador, dadosOp);
                  const den = extractValue(data, ind.denominador, dadosOp);
                  if (num === null || den === null || den === 0) return null;
                  return num / den;
                });

                const delta = hasMultiple
                  ? calcDelta(vals[0], vals[vals.length - 1], ind.melhorQuando)
                  : null;

                return (
                  <tr key={ind.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 text-slate-700 font-medium">{ind.nome}</td>
                    {vals.map((v, idx) => {
                      const meetsMeta =
                        ind.meta !== undefined && v !== null
                          ? ind.melhorQuando === 'maior'
                            ? (ind.formato === 'percentual' ? v * 100 >= ind.meta : v >= ind.meta)
                            : (ind.formato === 'percentual' ? v * 100 <= ind.meta : v <= ind.meta)
                          : null;
                      return (
                        <td key={idx} className={`py-2.5 px-4 text-right font-mono tabular-nums text-xs ${
                          meetsMeta === true  ? 'text-emerald-600 font-semibold' :
                          meetsMeta === false ? 'text-red-500 font-semibold' :
                          v === null          ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          {fmtVal(v, ind.formato)}
                        </td>
                      );
                    })}
                    {hasMultiple && delta && (
                      <td className={`py-2.5 px-4 text-right font-mono tabular-nums text-xs font-semibold whitespace-nowrap ${
                        delta.isPositive === null ? 'text-slate-400' :
                        delta.isPositive         ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        <div className="flex items-center justify-end gap-1">
                          {delta.isPositive === true  && <TrendingUp   className="w-3 h-3" />}
                          {delta.isPositive === false && <TrendingDown className="w-3 h-3" />}
                          {delta.text}
                        </div>
                      </td>
                    )}
                    <td className="py-2.5 px-4 text-right text-xs text-slate-400">
                      {ind.meta !== undefined ? fmtMeta(ind.meta, ind.formato) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── MarcaAnalise ─────────────────────────────────────────────────────────────
// Vista de uma marca: departamento + períodos globais + todos os cenários do depto expandidos

interface MarcaAnaliseProps {
  marca: Marca;
  cenarios: IEOCenario[];
  allDadosOp: Record<string, DadosOperacionais>;
  periodos: Periodo[];
  depto: DeptoFiltro;
  onPeriodosChange: (p: Periodo[]) => void;
  onDeptoChange: (d: DeptoFiltro) => void;
  onEdit: (c: IEOCenario) => void;
  onDelete: (id: string) => void;
  onNew: (depto: DeptoFiltro) => void;
}

function MarcaAnalise({
  marca, cenarios, allDadosOp, periodos, depto,
  onPeriodosChange, onDeptoChange, onEdit, onDelete, onNew,
}: MarcaAnaliseProps) {
  const [deptoDataMap, setDeptoDataMap] = useState<Record<string, DepartamentoData | null>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all(
      periodos.map(async p => {
        const key = `${p.year}:S${p.semestre}`;
        const data =
          depto === 'consolidado'
            ? await processConsolidadoData(marca, p.year, p.semestre)
            : await processDepartamentoData(marca, depto, p.year, p.semestre);
        return [key, data] as const;
      }),
    ).then(entries => {
      setDeptoDataMap(Object.fromEntries(entries));
      setLoading(false);
    });
  }, [marca, depto, periodos]);

  const cenariosDoDepto = cenarios.filter(c => c.departamento === depto);
  const deptoLabel =
    depto === 'consolidado' ? 'Consolidado' : DEPTO_CLASSIFICACAO_LABELS[depto];

  function addPeriodo() {
    if (periodos.length >= 4) return;
    onPeriodosChange([...periodos, { year: CURRENT_YEAR, semestre: 2 }]);
  }

  function removePeriodo(idx: number) {
    if (periodos.length <= 1) return;
    onPeriodosChange(periodos.filter((_, i) => i !== idx));
  }

  function updatePeriodo(idx: number, field: keyof Periodo, value: number) {
    onPeriodosChange(periodos.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtro de departamento */}
      <div className="flex items-center gap-1 flex-wrap">
        {DEPTO_FILTROS.map(d => (
          <button
            key={d.id}
            onClick={() => onDeptoChange(d.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              depto === d.id
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-200'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Seletor global de períodos (compartilhado entre VW e Audi) */}
      <div className="flex items-center gap-2 flex-wrap bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest shrink-0">
          Períodos
        </span>
        {periodos.map((p, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1"
          >
            <select
              value={p.year}
              onChange={e => updatePeriodo(idx, 'year', Number(e.target.value))}
              className="text-xs font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={p.semestre}
              onChange={e => updatePeriodo(idx, 'semestre', Number(e.target.value) as 1 | 2)}
              className="text-xs font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
            >
              <option value={1}>S1</option>
              <option value={2}>S2</option>
            </select>
            {periodos.length > 1 && (
              <button
                onClick={() => removePeriodo(idx)}
                className="text-slate-300 hover:text-red-400 transition-colors ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {periodos.length < 4 && (
          <button
            onClick={addPeriodo}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 rounded-lg border border-dashed border-emerald-300 transition-colors"
          >
            <Plus className="w-3 h-3" /> Período
          </button>
        )}
        {loading && (
          <span className="text-xs text-slate-400 italic ml-2">Calculando...</span>
        )}
      </div>

      {/* Cenários do departamento — todos expandidos */}
      {cenariosDoDepto.length > 0 ? (
        <div className="flex flex-col gap-3">
          {cenariosDoDepto.map(c => (
            <CenarioSection
              key={c.id}
              cenario={c}
              periodos={periodos}
              deptoDataMap={deptoDataMap}
              allDadosOp={allDadosOp}
              onEdit={() => onEdit(c)}
              onDelete={() => onDelete(c.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          <p className="text-sm font-medium text-slate-400">
            Nenhum cenário para {deptoLabel}.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Use o botão abaixo ou acesse "Configurações" para criar cenários.
          </p>
        </div>
      )}

      {/* Botão contextual de novo cenário */}
      <button
        onClick={() => onNew(depto)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 transition-colors text-xs font-semibold w-fit"
      >
        <Plus className="w-4 h-4" />
        Novo cenário — {deptoLabel}
      </button>
    </div>
  );
}

// ─── ConfiguracoesCenarios ────────────────────────────────────────────────────
// Lista gerenciável de todos os cenários + dados operacionais por período

interface ConfigProps {
  cenarios: IEOCenario[];
  onEdit: (c: IEOCenario) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

function ConfiguracoesCenarios({ cenarios, onEdit, onDelete, onNew }: ConfigProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dadosOpYear, setDadosOpYear] = useState(CURRENT_YEAR);
  const [dadosOpSemestre, setDadosOpSemestre] = useState<1 | 2>(1);
  const [allDadosOp, setAllDadosOp] = useState<Record<string, DadosOperacionais>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAllDadosOperacionais().then(setAllDadosOp);
  }, []);

  async function handleDadosOpChange(
    dept: DeptoClassificacao | 'consolidado',
    field: keyof DadosOperacionais,
    rawValue: string,
  ) {
    const key = dadosOpKey(dadosOpYear, dadosOpSemestre, dept);
    const parsed = rawValue === '' ? undefined : parseInt(rawValue, 10) || undefined;
    const next: Record<string, DadosOperacionais> = {
      ...allDadosOp,
      [key]: { ...allDadosOp[key], [field]: parsed },
    };
    setAllDadosOp(next);
    setSaving(true);
    try {
      await saveAllDadosOperacionais(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Lista de cenários */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/70">
          <span className="text-sm font-bold text-slate-700">Cenários de Análise</span>
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Cenário
          </button>
        </div>

        {cenarios.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Nenhum cenário criado ainda.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {cenarios.map(c => (
              <div
                key={c.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
              >
                <div>
                  <span className="text-sm font-semibold text-slate-700">{c.nome}</span>
                  <span className="ml-3 text-xs text-slate-400">
                    {c.departamento === 'consolidado'
                      ? 'Consolidado'
                      : DEPTO_CLASSIFICACAO_LABELS[c.departamento as DeptoClassificacao]}
                    {' · '}{c.indicadores.length} indicador{c.indicadores.length !== 1 ? 'es' : ''}
                  </span>
                </div>
                <div className="flex gap-0.5">
                  <button
                    onClick={() => onEdit(c)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(c.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dados Operacionais */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70">
          <h3 className="text-sm font-bold text-slate-700">Dados Operacionais por Período</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Nº de funcionários e volume de vendas/OS — usados nos cálculos dos indicadores.
          </p>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Período</span>
            <select
              value={dadosOpYear}
              onChange={e => setDadosOpYear(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded bg-white text-slate-700 font-semibold"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {([1, 2] as const).map(s => (
              <button
                key={s}
                onClick={() => setDadosOpSemestre(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  dadosOpSemestre === s ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {s}º Semestre
              </button>
            ))}
            {saving && <span className="text-xs text-slate-400 italic">Salvando...</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Departamento</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nº Funcionários</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Volume Vendas / OS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {DEPTOS_OPTS.map(({ id, label }) => {
                  const key = dadosOpKey(dadosOpYear, dadosOpSemestre, id);
                  const val = allDadosOp[key] ?? {};
                  return (
                    <tr key={id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-slate-700 font-medium text-sm">{label}</td>
                      <td className="py-2 px-3">
                        <input
                          type="number" min="0" step="1"
                          value={val.funcionarios ?? ''}
                          onChange={e => handleDadosOpChange(id, 'funcionarios', e.target.value)}
                          placeholder="—"
                          className="w-full text-right px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number" min="0" step="1"
                          value={val.volumeVendas ?? ''}
                          onChange={e => handleDadosOpChange(id, 'volumeVendas', e.target.value)}
                          placeholder="—"
                          className="w-full text-right px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmação de exclusão */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-red-50 shrink-0">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Excluir cenário?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  "{cenarios.find(c => c.id === confirmDeleteId)?.nome}" será permanentemente excluído.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null); }}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CenarioEditorDialog ──────────────────────────────────────────────────────

interface EditorProps {
  initial?: IEOCenario;
  defaultDepto?: DeptoFiltro;
  onSave: (c: IEOCenario) => void;
  onClose: () => void;
}

function CenarioEditorDialog({ initial, defaultDepto, onSave, onClose }: EditorProps) {
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [departamento, setDepartamento] = useState<DeptoClassificacao | 'consolidado'>(
    initial?.departamento ?? defaultDepto ?? 'consolidado',
  );
  const [indicadores, setIndicadores] = useState<IEOIndicadorConfig[]>(
    initial?.indicadores ?? [],
  );
  const [contasDisponiveis, setContasDisponiveis] = useState<string[]>([]);

  useEffect(() => {
    loadClassificacoesConta().then(map => {
      setContasDisponiveis(Object.keys(map).sort());
    });
  }, []);

  // Select reutilizável com optgroups: Resultados | Dados Operacionais (opcional) | Grupos | Contas
  function IndicadorSelect({
    value, onChange, includeDadosOp = false,
  }: {
    value: string;
    onChange: (v: string) => void;
    includeDadosOp?: boolean;
  }) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
      >
        <optgroup label="Resultados">
          <option value="resultado">Resultado Operacional (todos os grupos)</option>
          <option value="resultado_sem_fin">Resultado s/ Despesas Financeiras</option>
        </optgroup>
        {includeDadosOp && (
          <optgroup label="Dados Operacionais">
            <option value="funcionarios">Nº de Funcionários</option>
            <option value="volume_vendas">Volume de Vendas / OS (unidades)</option>
          </optgroup>
        )}
        <optgroup label="Grupos de Contas">
          {TIPOS_CONTA_ORDENADOS.map(g => (
            <option key={g} value={`grupo:${g}`}>{TIPO_CONTA_LABELS[g]}</option>
          ))}
        </optgroup>
        {contasDisponiveis.length > 0 && (
          <optgroup label="Contas Específicas">
            {contasDisponiveis.map(c => (
              <option key={c} value={`conta:${c}`}>{c}</option>
            ))}
          </optgroup>
        )}
      </select>
    );
  }

  function addIndicador() {
    setIndicadores(prev => [
      ...prev,
      {
        id: genId(),
        nome: '',
        numerador: { tipo: 'resultado' },
        denominador: { tipo: 'funcionarios' },
        formato: 'reais',
        melhorQuando: 'maior',
      },
    ]);
  }

  function removeIndicador(id: string) {
    setIndicadores(prev => prev.filter(i => i.id !== id));
  }

  function updateIndicador(id: string, patch: Partial<IEOIndicadorConfig>) {
    setIndicadores(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
  }

  function handleSave() {
    if (!nome.trim()) { toast.error('Informe o nome do cenário.'); return; }
    onSave({
      id: initial?.id ?? genId(),
      nome: nome.trim(),
      departamento,
      indicadores,
      criadoEm: initial?.criadoEm ?? new Date().toISOString(),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-800">
            {initial ? 'Editar Cenário' : 'Novo Cenário de Análise'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nome do Cenário</label>
              <input
                type="text" value={nome} onChange={e => setNome(e.target.value)}
                placeholder="Ex: Eficiência da Oficina"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Departamento</label>
              <select
                value={departamento}
                onChange={e => setDepartamento(e.target.value as DeptoClassificacao | 'consolidado')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {DEPTOS_OPTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Indicadores ({indicadores.length})
              </span>
              <button
                onClick={addIndicador}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>

            {indicadores.length === 0 && (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">
                Clique em "Adicionar" para configurar os indicadores.
              </div>
            )}

            <div className="space-y-3">
              {indicadores.map((ind, idx) => (
                <div key={ind.id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Indicador {idx + 1}</span>
                    <button onClick={() => removeIndicador(ind.id)} className="text-slate-300 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Nome</label>
                    <input
                      type="text" value={ind.nome}
                      onChange={e => updateIndicador(ind.id, { nome: e.target.value })}
                      placeholder="Ex: Custo de Publicidade por Venda"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Numerador</label>
                      <IndicadorSelect
                        value={numeradorToKey(ind.numerador)}
                        onChange={v => updateIndicador(ind.id, { numerador: keyToNumerador(v) })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Denominador (divisor)</label>
                      <IndicadorSelect
                        value={denominadorToKey(ind.denominador)}
                        onChange={v => updateIndicador(ind.id, { denominador: keyToDenominador(v) })}
                        includeDadosOp
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Formato</label>
                      <select
                        value={ind.formato}
                        onChange={e => updateIndicador(ind.id, { formato: e.target.value as IEOIndicadorConfig['formato'] })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      >
                        <option value="reais">R$ (Reais)</option>
                        <option value="reais_por_unidade">R$ / unidade</option>
                        <option value="percentual">% (Percentual)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Melhor quando</label>
                      <select
                        value={ind.melhorQuando}
                        onChange={e => updateIndicador(ind.id, { melhorQuando: e.target.value as 'maior' | 'menor' })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      >
                        <option value="maior">Maior ↑ (receita, margem)</option>
                        <option value="menor">Menor ↓ (custo, despesa)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">
                        Meta {ind.formato === 'percentual' ? '(%)' : '(R$)'} — opcional
                      </label>
                      <input
                        type="number" value={ind.meta ?? ''}
                        onChange={e => updateIndicador(ind.id, { meta: e.target.value === '' ? undefined : Number(e.target.value) })}
                        placeholder="—"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancelar
          </button>
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">
            <Save className="w-4 h-4" /> Salvar Cenário
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AnaliseCenariosTab (Export Principal) ────────────────────────────────────

export function AnaliseCenariosTab() {
  const [mainTab, setMainTab] = useState<MainTab>('vw');
  const [cenarios, setCenarios] = useState<IEOCenario[]>([]);
  const [allDadosOp, setAllDadosOp] = useState<Record<string, DadosOperacionais>>({});
  // Períodos e departamento compartilhados entre VW e Audi para facilitar comparação
  const [periodos, setPeriodos] = useState<Periodo[]>(DEFAULT_PERIODOS);
  const [depto, setDepto] = useState<DeptoFiltro>('consolidado');
  const [editing, setEditing] = useState<{
    cenario?: IEOCenario;
    defaultDepto?: DeptoFiltro;
  } | null>(null);

  useEffect(() => {
    Promise.all([loadCenarios(), loadAllDadosOperacionais()]).then(([c, op]) => {
      setCenarios(c);
      setAllDadosOp(op);
    });
  }, []);

  async function handleSave(cenario: IEOCenario) {
    const exists = cenarios.some(c => c.id === cenario.id);
    const next = exists
      ? cenarios.map(c => (c.id === cenario.id ? cenario : c))
      : [...cenarios, cenario];
    setCenarios(next);
    await saveCenarios(next);
    setEditing(null);
    toast.success(exists ? 'Cenário atualizado.' : 'Cenário criado.');
  }

  async function handleDelete(id: string) {
    const next = cenarios.filter(c => c.id !== id);
    setCenarios(next);
    await saveCenarios(next);
    toast.success('Cenário excluído.');
  }

  const tabCls = (active: boolean) =>
    `flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
      active
        ? 'border-emerald-600 text-emerald-700'
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      {/* Sub-tabs: VW | Audi | Configurações */}
      <div className="flex items-center gap-0 border-b border-slate-200">
        <button onClick={() => setMainTab('vw')} className={tabCls(mainTab === 'vw')}>
          VW
        </button>
        <button onClick={() => setMainTab('audi')} className={tabCls(mainTab === 'audi')}>
          Audi
        </button>
        <button onClick={() => setMainTab('configuracoes')} className={tabCls(mainTab === 'configuracoes')}>
          <Settings className="w-3.5 h-3.5" /> Configurações
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {(mainTab === 'vw' || mainTab === 'audi') && (
          <MarcaAnalise
            marca={mainTab}
            cenarios={cenarios}
            allDadosOp={allDadosOp}
            periodos={periodos}
            depto={depto}
            onPeriodosChange={setPeriodos}
            onDeptoChange={setDepto}
            onEdit={c => setEditing({ cenario: c })}
            onDelete={handleDelete}
            onNew={d => setEditing({ defaultDepto: d })}
          />
        )}

        {mainTab === 'configuracoes' && (
          <ConfiguracoesCenarios
            cenarios={cenarios}
            onEdit={c => setEditing({ cenario: c })}
            onDelete={handleDelete}
            onNew={() => setEditing({})}
          />
        )}
      </div>

      {editing !== null && (
        <CenarioEditorDialog
          initial={editing.cenario}
          defaultDepto={editing.defaultDepto}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
