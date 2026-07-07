import { useState, useEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Plus, X, Printer } from 'lucide-react';
import {
  loadDreVw,
  createEmptyDreVwRow,
  type DreVwDept,
  type DreVwRow,
} from './dreVwStorage';
import { loadDREDataAsync } from '@/lib/dbStorage';
import type { Department } from '@/lib/dataStorage';

// ─── Cores VW ─────────────────────────────────────────────────────────────────
const VW_COLOR     = '#001e50';
const VW_COLOR_DRK = '#001238';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Granularidade = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';
type DeptKey = 'novos' | 'usados' | 'direta' | 'pecas' | 'oficina' | 'funilaria' | 'adm';

interface DreLineConfig {
  label: string;
  field: keyof DreVwDept;
  isSubtotal?: boolean;
  isTotal?: boolean;
  indent?: boolean;
  isNegative?: boolean;
  isPct?: boolean;
  separator?: boolean;
}

interface PeriodSelector {
  id: string;
  year: number;
  periodoIndex: number;
}

interface PeriodoOption {
  index: number;
  label: string;
  shortLabel: string;
  months: number[];
}

// ─── Linhas DRE ───────────────────────────────────────────────────────────────
const DRE_LINES: DreLineConfig[] = [
  { label: 'Volume de Vendas',                           field: 'quant' },
  { label: '',                                            field: 'quant',                         separator: true },
  { label: 'Receita Operacional Líquida',                field: 'receitaOperacionalLiquida' },
  { label: '(-) Custo Operacional da Receita',           field: 'custoOperacionalReceita',        indent: true, isNegative: true },
  { label: 'Lucro (Prejuízo) Operacional Bruto',         field: 'lucroPrejOperacionalBruto',      isSubtotal: true },
  { label: 'Outras Receitas Operacionais',               field: 'outrasReceitasOperacionais',     indent: true },
  { label: '(-) Outras Despesas Operacionais',           field: 'outrasDespesasOperacionais',     indent: true, isNegative: true },
  { label: 'MARGEM DE CONTRIBUIÇÃO',                     field: 'margemContribuicao',             isTotal: true },
  { label: '% MARGEM DE CONTRIBUIÇÃO',                   field: 'margemContribuicao',             isPct: true },
  { label: '',                                            field: 'margemContribuicao',             separator: true },
  { label: '(-) Despesas c/ Pessoal',                    field: 'despPessoal',                    indent: true, isNegative: true },
  { label: '(-) Despesas c/ Serv. de Terceiros',         field: 'despServTerceiros',              indent: true, isNegative: true },
  { label: '(-) Despesas c/ Ocupação',                   field: 'despOcupacao',                   indent: true, isNegative: true },
  { label: '(-) Despesas c/ Funcionamento',              field: 'despFuncionamento',              indent: true, isNegative: true },
  { label: '(-) Despesas c/ Vendas',                     field: 'despVendas',                     indent: true, isNegative: true },
  { label: 'LUCRO (PREJUÍZO) OPERACIONAL LÍQUIDO',       field: 'lucroPrejOperacionalLiquido',    isTotal: true },
  { label: '% LUCRO (PREJUÍZO) OPERACIONAL LÍQUIDO',     field: 'lucroPrejOperacionalLiquido',    isPct: true },
  { label: '',                                            field: 'lucroPrejOperacionalLiquido',    separator: true },
  { label: 'Amortizações e Depreciações',                field: 'amortizacoesDepreciacoes',       indent: true, isNegative: true },
  { label: 'Outras Receitas Financeiras',                field: 'outrasReceitasFinanceiras',      indent: true },
  { label: '(-) Despesas Financeiras Não Operacional',   field: 'despFinanceirasNaoOperacional',  indent: true, isNegative: true },
  { label: '(-) Despesas Não Operacionais',              field: 'despesasNaoOperacionais',        indent: true, isNegative: true },
  { label: 'Outras Rendas Não Operacionais',             field: 'outrasRendasNaoOperacionais',    indent: true },
  { label: 'Lucro (Prejuízo) Antes dos Impostos',        field: 'lucroPrejAntesImpostos',         isSubtotal: true },
  { label: '(-) Provisões IRPJ e C.S.',                  field: 'provisoesIrpjCs',                indent: true, isNegative: true },
  { label: '(-) Participações',                          field: 'participacoes',                  indent: true, isNegative: true },
  { label: 'LUCRO LÍQUIDO DO EXERCÍCIO',                 field: 'lucroLiquidoExercicio',          isTotal: true },
  { label: '% LUCRO LÍQUIDO DO EXERCÍCIO',               field: 'lucroLiquidoExercicio',          isPct: true },
];

const DEPT_FIELDS: (keyof DreVwDept)[] = [
  'quant','receitaOperacionalLiquida','custoOperacionalReceita',
  'lucroPrejOperacionalBruto','outrasReceitasOperacionais','outrasDespesasOperacionais',
  'margemContribuicao','despPessoal','despServTerceiros','despOcupacao','despFuncionamento',
  'despVendas','lucroPrejOperacionalLiquido','amortizacoesDepreciacoes',
  'outrasReceitasFinanceiras','despFinanceirasNaoOperacional','despesasNaoOperacionais',
  'outrasRendasNaoOperacionais','lucroPrejAntesImpostos','provisoesIrpjCs',
  'participacoes','lucroLiquidoExercicio',
];

const DEPTS_LIST: DeptKey[] = ['novos', 'usados', 'direta', 'pecas', 'oficina', 'funilaria', 'adm'];

const DEPTS: { key: DeptKey; label: string }[] = [
  { key: 'novos',     label: 'Veículos Novos' },
  { key: 'direta',    label: 'Venda Direta' },
  { key: 'usados',    label: 'Veículos Usados' },
  { key: 'pecas',     label: 'Peças e Acessórios' },
  { key: 'oficina',   label: 'Oficina / Assist. Técnica' },
  { key: 'funilaria', label: 'Funilaria' },
  { key: 'adm',       label: 'Administração' },
];

const DEPT_KEY_TO_DEPT: Partial<Record<DeptKey, Department>> = {
  novos:     'novos',
  direta:    'vendaDireta',
  usados:    'usados',
  pecas:     'pecas',
  oficina:   'oficina',
  funilaria: 'funilaria',
  adm:       'administracao',
};

const DESCRICAO_TO_FIELD: Record<string, keyof DreVwDept> = {
  'VOLUME DE VENDAS':                      'quant',
  'RECEITA OPERACIONAL LIQUIDA':           'receitaOperacionalLiquida',
  'CUSTO OPERACIONAL DA RECEITA':          'custoOperacionalReceita',
  'LUCRO (PREJUIZO) OPERACIONAL BRUTO':    'lucroPrejOperacionalBruto',
  'OUTRAS RECEITAS OPERACIONAIS':          'outrasReceitasOperacionais',
  'OUTRAS DESPESAS OPERACIONAIS':          'outrasDespesasOperacionais',
  'MARGEM DE CONTRIBUIÇÃO':               'margemContribuicao',
  'MARGEM DE CONTRIBUICAO':               'margemContribuicao',
  'DESPESAS C/ PESSOAL':                  'despPessoal',
  'DESPESAS C/ SERV. DE TERCEIROS':       'despServTerceiros',
  'DESPESAS C/ OCUPAÇÃO':                 'despOcupacao',
  'DESPESAS C/ OCUPACAO':                 'despOcupacao',
  'DESPESAS C/ FUNCIONAMENTO':            'despFuncionamento',
  'DESPESAS C/ VENDAS':                   'despVendas',
  'LUCRO (PREJUIZO) OPERACIONAL LIQUIDO': 'lucroPrejOperacionalLiquido',
  'AMORTIZAÇÕES E DEPRECIAÇÕES':          'amortizacoesDepreciacoes',
  'AMORTIZACOES E DEPRECIACOES':          'amortizacoesDepreciacoes',
  'OUTRAS RECEITAS FINANCEIRAS':          'outrasReceitasFinanceiras',
  'DESPESAS FINANCEIRAS NÃO OPERACIONAL': 'despFinanceirasNaoOperacional',
  'DESPESAS FINANCEIRAS NAO OPERACIONAL': 'despFinanceirasNaoOperacional',
  'DESPESAS NÃO OPERACIONAIS':            'despesasNaoOperacionais',
  'DESPESAS NAO OPERACIONAIS':            'despesasNaoOperacionais',
  'OUTRAS RENDAS NÃO OPERACIONAIS':       'outrasRendasNaoOperacionais',
  'OUTRAS RENDAS NAO OPERACIONAIS':       'outrasRendasNaoOperacionais',
  'LUCRO (PREJUIZO) ANTES IMPOSTOS':      'lucroPrejAntesImpostos',
  'PROVISÕES IRPJ E C.S.':               'provisoesIrpjCs',
  'PROVISOES IRPJ E C.S.':               'provisoesIrpjCs',
  'PARTICIPAÇÕES':                        'participacoes',
  'PARTICIPACOES':                        'participacoes',
  'LUCRO LIQUIDO DO EXERCICIO':           'lucroLiquidoExercicio',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseVal(v: string | number): number {
  return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
}

function pctStr(val: number, rol: number): string {
  if (!rol) return '—';
  return ((val / rol) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function calcVarPct(cur: number, prev: number): string {
  if (prev === 0) return '—';
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return (pct >= 0 ? '+' : '') + pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function calcVarDelta(cur: number, prev: number): string {
  const delta = cur - prev;
  if (delta === 0) return '—';
  return (delta > 0 ? '+' : '') + delta.toLocaleString('pt-BR');
}

function emptyDept(): DreVwDept {
  return {
    quant: '', receitaOperacionalLiquida: '', custoOperacionalReceita: '',
    lucroPrejOperacionalBruto: '', outrasReceitasOperacionais: '', outrasDespesasOperacionais: '',
    margemContribuicao: '', despPessoal: '', despServTerceiros: '', despOcupacao: '',
    despFuncionamento: '', despVendas: '', lucroPrejOperacionalLiquido: '',
    amortizacoesDepreciacoes: '', outrasReceitasFinanceiras: '', despFinanceirasNaoOperacional: '',
    despesasNaoOperacionais: '', outrasRendasNaoOperacionais: '', lucroPrejAntesImpostos: '',
    provisoesIrpjCs: '', participacoes: '', lucroLiquidoExercicio: '',
  };
}

// ─── Opções de período por granularidade ─────────────────────────────────────

function getPeriodOptions(gran: Granularidade): PeriodoOption[] {
  const MS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  switch (gran) {
    case 'mensal':
      return MS.map((m, i) => ({ index: i, label: m, shortLabel: m, months: [i + 1] }));
    case 'bimestral':
      return [
        { index: 0, label: '1º Bim (Jan-Fev)', shortLabel: '1º Bim', months: [1, 2] },
        { index: 1, label: '2º Bim (Mar-Abr)', shortLabel: '2º Bim', months: [3, 4] },
        { index: 2, label: '3º Bim (Mai-Jun)', shortLabel: '3º Bim', months: [5, 6] },
        { index: 3, label: '4º Bim (Jul-Ago)', shortLabel: '4º Bim', months: [7, 8] },
        { index: 4, label: '5º Bim (Set-Out)', shortLabel: '5º Bim', months: [9, 10] },
        { index: 5, label: '6º Bim (Nov-Dez)', shortLabel: '6º Bim', months: [11, 12] },
      ];
    case 'trimestral':
      return [
        { index: 0, label: '1º Tri (Jan-Mar)', shortLabel: '1º Tri', months: [1, 2, 3] },
        { index: 1, label: '2º Tri (Abr-Jun)', shortLabel: '2º Tri', months: [4, 5, 6] },
        { index: 2, label: '3º Tri (Jul-Set)', shortLabel: '3º Tri', months: [7, 8, 9] },
        { index: 3, label: '4º Tri (Out-Dez)', shortLabel: '4º Tri', months: [10, 11, 12] },
      ];
    case 'semestral':
      return [
        { index: 0, label: '1º Sem (Jan-Jun)', shortLabel: '1º Sem', months: [1, 2, 3, 4, 5, 6] },
        { index: 1, label: '2º Sem (Jul-Dez)', shortLabel: '2º Sem', months: [7, 8, 9, 10, 11, 12] },
      ];
    case 'anual':
      return [{ index: 0, label: 'Ano completo', shortLabel: 'Ano', months: [1,2,3,4,5,6,7,8,9,10,11,12] }];
  }
}

function getColumnLabel(gran: Granularidade, periodoIndex: number, year: number): string {
  const opts = getPeriodOptions(gran);
  const opt  = opts[Math.min(periodoIndex, opts.length - 1)];
  if (gran === 'anual') return String(year);
  return `${opt.shortLabel}/${year}`;
}

// ─── Data loading ─────────────────────────────────────────────────────────────

function buildDeptFromDREData(dreData: any[] | null, monthIndex: number): DreVwDept {
  const dept = emptyDept();
  if (!dreData) return dept;
  for (const line of dreData) {
    const descKey = ((line.descricao as string) || (line.label as string) || '').toUpperCase().trim();
    const field = DESCRICAO_TO_FIELD[descKey];
    if (field) {
      const meses: number[] = line.meses || line.values || [];
      const val = meses[monthIndex];
      if (val !== undefined && val !== null && val !== 0) {
        dept[field] = val.toString();
      }
    }
  }
  return dept;
}

function consolidateDepts(row: DreVwRow): DreVwDept {
  const result = emptyDept();
  for (const key of DEPTS_LIST) {
    const dept = row[key];
    for (const f of DEPT_FIELDS) {
      // ADM ROL = 0, como no Resumo Geral
      if (key === 'adm' && f === 'receitaOperacionalLiquida') continue;
      const v = parseVal(dept[f]);
      if (v !== 0) {
        result[f] = (parseVal(result[f]) + v).toString();
      }
    }
  }
  return result;
}

async function loadPeriodData(
  sel: PeriodSelector,
  gran: Granularidade,
): Promise<DreVwRow> {
  const opts   = getPeriodOptions(gran);
  const opt    = opts[Math.min(sel.periodoIndex, opts.length - 1)];
  const months = opt.months;
  const yr     = sel.year as 2024 | 2025 | 2026 | 2027;

  // Dados anuais do Dashboard Executivo como fallback por departamento
  const dreByDept: Record<string, any[] | null> = {};
  await Promise.all(
    DEPTS_LIST.map(async (deptKey) => {
      const deptName = DEPT_KEY_TO_DEPT[deptKey];
      if (deptName) {
        try { dreByDept[deptKey] = await loadDREDataAsync(yr, deptName, 'vw'); }
        catch { dreByDept[deptKey] = null; }
      }
    })
  );

  // Dados mensais do KV
  const monthRows: DreVwRow[] = await Promise.all(
    months.map(m =>
      loadDreVw(sel.year, m).then(r => r ?? createEmptyDreVwRow(sel.year, m))
    )
  );

  // Mescla: KV tem prioridade; DRE async é fallback
  const processedRows: DreVwRow[] = monthRows.map((kvRow, i) => {
    const monthIdx = months[i] - 1;
    const result = { ...kvRow };
    for (const deptKey of DEPTS_LIST) {
      const hasDeptData = Object.values(kvRow[deptKey]).some(v => v !== '');
      if (!hasDeptData && dreByDept[deptKey]) {
        result[deptKey] = buildDeptFromDREData(dreByDept[deptKey], monthIdx);
      }
    }
    return result;
  });

  // Soma os meses do período
  const summedRow = createEmptyDreVwRow(sel.year, 0);
  for (const row of processedRows) {
    for (const deptKey of DEPTS_LIST) {
      for (const f of DEPT_FIELDS) {
        const v = parseVal(row[deptKey][f]);
        if (v !== 0) {
          summedRow[deptKey][f] = (parseVal(summedRow[deptKey][f]) + v).toString();
        }
      }
    }
  }

  return summedRow;
}

// ─── Componente Principal ─────────────────────────────────────────────────────

interface VwComparativoTabProps {
  year: number;
  month: number;
}

export function VwComparativoTab({ year, month }: VwComparativoTabProps) {
  const CURRENT_YEAR = new Date().getFullYear();
  const defaultPeriodoIndex = month > 0 && month <= 6 ? 0 : 1;

  const [granularidade, setGranularidade] = useState<Granularidade>('semestral');
  const [periodos, setPeriodos] = useState<PeriodSelector[]>([
    { id: 'p1', year: CURRENT_YEAR - 1, periodoIndex: defaultPeriodoIndex },
    { id: 'p2', year: CURRENT_YEAR,     periodoIndex: defaultPeriodoIndex },
  ]);
  const [loadedRows, setLoadedRows] = useState<(DreVwRow | null)[]>([]);
  const [activeSection, setActiveSection] = useState<'resumo' | DeptKey>('resumo');
  const [loading, setLoading] = useState(false);

  function handleGranChange(g: Granularidade) {
    const opts = getPeriodOptions(g);
    setGranularidade(g);
    setPeriodos(prev =>
      prev.map(p => ({
        ...p,
        periodoIndex: Math.min(p.periodoIndex, opts.length - 1),
      }))
    );
  }

  useEffect(() => {
    if (periodos.length === 0) { setLoadedRows([]); return; }
    setLoading(true);
    Promise.all(periodos.map(p => loadPeriodData(p, granularidade)))
      .then(results => { setLoadedRows(results); setLoading(false); })
      .catch(() => setLoading(false));
  }, [granularidade, periodos]);

  function addPeriodo() {
    if (periodos.length >= 4) return;
    const last = periodos[periodos.length - 1];
    setPeriodos(prev => [
      ...prev,
      { id: `p_${Date.now()}`, year: last.year, periodoIndex: last.periodoIndex },
    ]);
  }

  function removePeriodo(id: string) {
    if (periodos.length <= 1) return;
    setPeriodos(prev => prev.filter(p => p.id !== id));
  }

  function updatePeriodo(id: string, changes: Partial<PeriodSelector>) {
    setPeriodos(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p));
  }

  const YEAR_OPTIONS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];
  const periodOptions = getPeriodOptions(granularidade);
  const GRAN_LABELS: Record<Granularidade, string> = {
    mensal: 'Mensal', bimestral: 'Bimestral', trimestral: 'Trimestral',
    semestral: 'Semestral', anual: 'Anual',
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

      {/* ── Barra de controles ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex flex-wrap items-start gap-6">

          {/* Granularidade */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[0.68rem] font-semibold text-slate-500 uppercase tracking-wide">
              Granularidade
            </span>
            <div className="flex gap-1">
              {(['mensal', 'bimestral', 'trimestral', 'semestral', 'anual'] as Granularidade[]).map(g => (
                <button
                  key={g}
                  onClick={() => handleGranChange(g)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={
                    granularidade === g
                      ? { backgroundColor: VW_COLOR, color: 'white' }
                      : { backgroundColor: '#f1f5f9', color: '#64748b' }
                  }
                >
                  {GRAN_LABELS[g]}
                </button>
              ))}
            </div>
          </div>

          {/* Seletores de período */}
          <div className="flex flex-col gap-1.5 flex-1">
            <span className="text-[0.68rem] font-semibold text-slate-500 uppercase tracking-wide">
              Períodos a comparar
            </span>
            <div className="flex flex-wrap gap-2 items-center">
              {periodos.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5"
                >
                  <span
                    className="text-[0.65rem] font-bold rounded px-1.5 py-0.5 text-white shrink-0"
                    style={{ backgroundColor: VW_COLOR }}
                  >
                    #{idx + 1}
                  </span>

                  <select
                    className="text-xs font-semibold outline-none bg-transparent cursor-pointer"
                    style={{ color: VW_COLOR }}
                    value={p.year}
                    onChange={e => updatePeriodo(p.id, { year: parseInt(e.target.value) })}
                  >
                    {YEAR_OPTIONS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>

                  {granularidade !== 'anual' && (
                    <select
                      className="text-xs font-semibold outline-none bg-transparent cursor-pointer"
                      style={{ color: VW_COLOR }}
                      value={p.periodoIndex}
                      onChange={e => updatePeriodo(p.id, { periodoIndex: parseInt(e.target.value) })}
                    >
                      {periodOptions.map(opt => (
                        <option key={opt.index} value={opt.index}>{opt.label}</option>
                      ))}
                    </select>
                  )}

                  {periodos.length > 1 && (
                    <button
                      onClick={() => removePeriodo(p.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors ml-1 shrink-0"
                      title="Remover período"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {periodos.length < 4 && (
                <button
                  onClick={addPeriodo}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar período
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-abas de departamento ────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-1 overflow-x-auto shrink-0">
        <button
          onClick={() => setActiveSection('resumo')}
          className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors"
          style={activeSection === 'resumo'
            ? { borderBottomColor: VW_COLOR, color: VW_COLOR }
            : { borderBottomColor: 'transparent', color: '#64748b' }}
        >
          Resumo Geral
        </button>
        {DEPTS.map(d => (
          <button
            key={d.key}
            onClick={() => setActiveSection(d.key)}
            className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors"
            style={activeSection === d.key
              ? { borderBottomColor: VW_COLOR, color: VW_COLOR }
              : { borderBottomColor: 'transparent', color: '#64748b' }}
          >
            {d.label}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors my-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 shrink-0"
        >
          <Printer className="w-3.5 h-3.5" />
          Imprimir PDF
        </button>
      </div>

      {/* ── Tabela ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Carregando dados...</span>
            </div>
          </div>
        ) : (
          <ComparativoTable
            periodos={periodos}
            loadedRows={loadedRows}
            activeSection={activeSection}
            granularidade={granularidade}
          />
        )}
      </div>

      {/* ── Portal de Impressão ──────────────────────────────────────────── */}
      {typeof document !== 'undefined' && document.getElementById('print-root') &&
        createPortal(
          <div style={{ fontFamily: 'Inter, sans-serif', colorScheme: 'only light' as any }}>
            <style>{`
              #print-root, #print-root * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                forced-color-adjust: none !important;
                color-scheme: light !important;
              }
              .vw-comp-header { background-color: ${VW_COLOR} !important; color: white !important; }
              /* Força fonte e padding compactos para caber em 1 página por seção */
              #print-root table,
              #print-root table th,
              #print-root table td {
                font-size: 7pt !important;
                padding-top: 2px !important;
                padding-bottom: 2px !important;
                padding-left: 5px !important;
                padding-right: 5px !important;
                line-height: 1.2 !important;
              }
              #print-root .print-page {
                page-break-after: always !important;
                page-break-inside: avoid !important;
              }
              #print-root .overflow-x-auto { overflow: visible !important; }
              #print-root .rounded-xl { border-radius: 0 !important; }
              #print-root .shadow-sm { box-shadow: none !important; }
            `}</style>

            {/* Página 1: Resumo Geral */}
            <div className="print-page">
              <div className="vw-comp-header" style={{ backgroundColor: VW_COLOR, color: 'white', padding: '3px 8px', marginBottom: '3px', fontWeight: 700, fontSize: '9pt' } as React.CSSProperties}>
                Resumo Geral
              </div>
              <ComparativoTable
                periodos={periodos}
                loadedRows={loadedRows}
                activeSection="resumo"
                granularidade={granularidade}
              />
            </div>

            {/* Páginas seguintes: um por departamento */}
            {DEPTS.map((d) => (
              <div key={d.key} className="print-page">
                <div className="vw-comp-header" style={{ backgroundColor: VW_COLOR, color: 'white', padding: '3px 8px', marginBottom: '3px', fontWeight: 700, fontSize: '9pt' } as React.CSSProperties}>
                  {d.label}
                </div>
                <ComparativoTable
                  periodos={periodos}
                  loadedRows={loadedRows}
                  activeSection={d.key}
                  granularidade={granularidade}
                />
              </div>
            ))}
          </div>,
          document.getElementById('print-root')!
        )
      }
    </div>
  );
}

// ─── Tabela Comparativa ───────────────────────────────────────────────────────

function ComparativoTable({
  periodos,
  loadedRows,
  activeSection,
  granularidade,
}: {
  periodos: PeriodSelector[];
  loadedRows: (DreVwRow | null)[];
  activeSection: 'resumo' | DeptKey;
  granularidade: Granularidade;
}) {
  // totalCols: 1 (desc) + 1 (P1) + (N-1) × 3 [Δ + Var% + Pn]
  const totalCols = 1 + 1 + (periodos.length - 1) * 3;

  // Resolve o DreVwDept a exibir para cada período com base na seção ativa
  const consolidados: (DreVwDept | null)[] = loadedRows.map(row => {
    if (!row) return null;
    if (activeSection === 'resumo') return consolidateDepts(row);
    return row[activeSection];
  });

  const sectionLabel = activeSection === 'resumo'
    ? 'Todos os Departamentos'
    : DEPTS.find(d => d.key === activeSection)?.label ?? '';

  const isAdmSection = activeSection === 'adm';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="text-white px-6 py-3" style={{ backgroundColor: VW_COLOR }}>
        <h2 className="font-bold text-base">VW NORTE — Comparativo</h2>
        <p className="text-xs mt-0.5 opacity-80">{sectionLabel}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">

          {/* ── Cabeçalho ──────────────────────────────────────────────── */}
          <thead>
            <tr className="bg-slate-200" style={{ borderBottom: `2px solid ${VW_COLOR}` }}>
              <th className="text-left px-4 py-3 font-bold text-sm text-slate-800 w-52 min-w-[13rem]">
                Descrição
              </th>
              {periodos.map((p, pIdx) => (
                <Fragment key={p.id}>
                  <th className="text-center px-3 py-3 font-bold text-sm text-slate-800 min-w-[8rem]">
                    {getColumnLabel(granularidade, p.periodoIndex, p.year)}
                  </th>
                  {pIdx > 0 && (
                    <>
                      <th className="text-center px-2 py-3 font-bold text-xs text-slate-600 min-w-[5rem] bg-slate-100 border-l border-r border-slate-300">
                        Var Δ
                      </th>
                      <th className="text-center px-2 py-3 font-bold text-xs text-slate-600 min-w-[4.5rem] bg-slate-100 border-r border-slate-300">
                        Var %
                      </th>
                    </>
                  )}
                </Fragment>
              ))}
            </tr>
          </thead>

          {/* ── Corpo ──────────────────────────────────────────────────── */}
          <tbody>
            {DRE_LINES.map((line, idx) => {

              /* Linha separadora */
              if (line.separator) {
                return (
                  <tr key={idx}>
                    <td colSpan={totalCols} className="h-px bg-slate-100" />
                  </tr>
                );
              }

              /* Linha de percentual */
              if (line.isPct) {
                return (
                  <tr key={idx} className="border-b border-slate-100 bg-slate-50/50 text-slate-500">
                    <td className="px-4 py-0.5 pl-7 text-[0.68rem] italic">{line.label}</td>
                    {periodos.map((p, pIdx) => {
                      const dept = consolidados[pIdx];
                      const val  = dept ? parseVal(dept[line.field]) : 0;
                      const rol  = dept ? parseVal(dept.receitaOperacionalLiquida) : 0;
                      return (
                        <Fragment key={p.id}>
                          <td className="px-3 py-0.5 text-center text-[0.68rem] italic">
                            {dept ? pctStr(val, rol) : '—'}
                          </td>
                          {pIdx > 0 && (
                            <>
                              <td className="px-2 py-0.5 text-center text-[0.68rem] bg-slate-50 border-l border-r border-slate-200">—</td>
                              <td className="px-2 py-0.5 text-center text-[0.68rem] bg-slate-50 border-r border-slate-200">—</td>
                            </>
                          )}
                        </Fragment>
                      );
                    })}
                  </tr>
                );
              }

              /* Linha de valor */
              const isQuant  = line.field === 'quant' && idx === 0;
              const rowStyle = line.isTotal ? { backgroundColor: VW_COLOR } : undefined;
              const rowClass = line.isTotal
                ? 'text-white font-bold'
                : line.isSubtotal
                ? 'bg-slate-100 font-semibold text-black'
                : 'hover:bg-slate-50 text-black';

              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`} style={rowStyle}>
                  <td className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''}`}>
                    {line.label}
                  </td>

                  {periodos.map((p, pIdx) => {
                    const dept     = consolidados[pIdx];
                    const prevDept = pIdx > 0 ? consolidados[pIdx - 1] : null;
                    const isAdmROL = isAdmSection && line.field === 'receitaOperacionalLiquida';

                    /* Valor formatado */
                    let display: string;
                    if (!dept) {
                      display = '—';
                    } else if (isAdmROL) {
                      display = '0,00';
                    } else if (isQuant) {
                      const v = parseInt(String(dept.quant)) || 0;
                      display = v > 0 ? v.toString() : '—';
                    } else {
                      const v = parseVal(dept[line.field]);
                      display = v !== 0 ? v.toLocaleString('pt-BR') : '—';
                    }

                    /* Variação vs período anterior */
                    let deltaStr = '—';
                    let varStr   = '—';
                    if (pIdx > 0 && dept && prevDept && !isAdmROL) {
                      if (isQuant) {
                        const cur  = parseInt(String(dept.quant)) || 0;
                        const prev = parseInt(String(prevDept.quant)) || 0;
                        const d    = cur - prev;
                        deltaStr   = d !== 0 ? (d > 0 ? '+' : '') + d.toString() : '—';
                        varStr     = calcVarPct(cur, prev);
                      } else {
                        const cur  = parseVal(dept[line.field]);
                        const prev = parseVal(prevDept[line.field]);
                        deltaStr   = calcVarDelta(cur, prev);
                        varStr     = calcVarPct(cur, prev);
                      }
                    }

                    /* Cor da variação */
                    const isPositiveVar = varStr.startsWith('+');
                    const isNegativeVar = varStr.startsWith('-') && varStr !== '—';
                    const varColor = line.isTotal
                      ? undefined
                      : isPositiveVar ? '#16a34a'
                      : isNegativeVar ? '#dc2626'
                      : undefined;

                    const varCellClass = line.isTotal
                      ? 'px-2 py-1.5 text-center text-[0.7rem] font-semibold bg-slate-800 border-l border-slate-600 border-r border-slate-600'
                      : 'px-2 py-1.5 text-center text-[0.7rem] font-semibold bg-slate-50 border-l border-slate-200 border-r border-slate-200';

                    return (
                      <Fragment key={p.id}>
                        <td
                          className="px-3 py-1.5 text-center"
                          style={line.isTotal ? { backgroundColor: VW_COLOR_DRK } : undefined}
                        >
                          {display}
                        </td>
                        {pIdx > 0 && (
                          <>
                            <td
                              className={varCellClass}
                              style={varColor ? { color: varColor } : undefined}
                            >
                              {deltaStr}
                            </td>
                            <td
                              className={varCellClass}
                              style={varColor ? { color: varColor } : undefined}
                            >
                              {varStr}
                            </td>
                          </>
                        )}
                      </Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
