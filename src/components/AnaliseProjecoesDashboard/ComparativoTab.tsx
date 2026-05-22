import { useState, useCallback, useRef, useMemo } from 'react';
import { AlertTriangle, Edit3, Check, X, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import {
  DEPT_FIELDS,
  FIELD_LABELS,
  VW_DEPTS,
  AUDI_DEPTS,
  VW_DEPT_LABELS,
  AUDI_DEPT_LABELS,
  parseVal,
  saveBudgetVw,
  saveBudgetAudi,
  type BudgetVwRow,
  type BudgetAudiRow,
  type DeptBudget,
  type VwDept,
  type AudiDept,
} from './projecoesStorage';
import type { DreVwRow } from '../ResumoDREDashboard/dreVwStorage';
import type { DreAudiRow } from '../ResumoDREDashboard/dreAudiStorage';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CompType  = 'real2025_vs_budget2026' | 'budget2026_vs_real2026';
export type MarcaType = 'vw' | 'audi' | 'consolidado';
export type PeriodoType = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

interface PeriodoOption { label: string; months: number[] /* 0-based */ }

export interface ComparativoTabProps {
  compType:          CompType;
  marca:             MarcaType;
  periodoType:       PeriodoType;
  periodoIdx:        number;
  threshold:         number;
  editMode:          boolean;
  budgetVwMonths:    (BudgetVwRow | null)[];   // índice 0=Jan…11=Dez
  budgetAudiMonths:  (BudgetAudiRow | null)[];
  real2025VwMonths:  (DreVwRow | null)[];
  real2025AudiMonths:(DreAudiRow | null)[];
  real2026VwMonths:  (DreVwRow | null)[];
  real2026AudiMonths:(DreAudiRow | null)[];
  deptView:          'all' | VwDept | AudiDept;
  onBudgetVwChange:  (updated: BudgetVwRow, monthIdx: number) => void;
  onBudgetAudiChange:(updated: BudgetAudiRow, monthIdx: number) => void;
  hideZeros?:        boolean;
}

// ─── Linhas DRE ───────────────────────────────────────────────────────────────

export interface DreLineConfig {
  label:        string;
  field:        keyof DeptBudget;
  isTotal?:     boolean; // fundo escuro
  isSubtotal?:  boolean; // negrito + borda
  isBold?:      boolean;
  indent?:      boolean;
  isNegative?:  boolean; // custo: mais = pior
  isPct?:       boolean; // linha de percentual derivado
  separator?:   boolean;
}

export const DRE_LINES: DreLineConfig[] = [
  { label: 'Volume de Vendas',                          field: 'quant' },
  { label: '',                                           field: 'quant',                        separator: true },
  { label: 'Receita Operacional Líquida',               field: 'receitaOperacionalLiquida',     isBold: true },
  { label: '(-) Custo Operacional da Receita',          field: 'custoOperacionalReceita',       indent: true, isNegative: true },
  { label: 'Lucro (Prejuízo) Operacional Bruto',        field: 'lucroPrejOperacionalBruto',     isSubtotal: true },
  { label: 'Outras Receitas Operacionais',              field: 'outrasReceitasOperacionais',    indent: true },
  { label: '(-) Outras Despesas Operacionais',          field: 'outrasDespesasOperacionais',   indent: true, isNegative: true },
  { label: 'MARGEM DE CONTRIBUIÇÃO',                    field: 'margemContribuicao',            isTotal: true },
  { label: '% MARGEM DE CONTRIBUIÇÃO',                  field: 'margemContribuicao',            isPct: true },
  { label: '',                                           field: 'margemContribuicao',            separator: true },
  { label: '(-) Despesas c/ Pessoal',                   field: 'despPessoal',                  indent: true, isNegative: true },
  { label: '(-) Despesas c/ Serv. de Terceiros',        field: 'despServTerceiros',             indent: true, isNegative: true },
  { label: '(-) Despesas c/ Ocupação',                  field: 'despOcupacao',                  indent: true, isNegative: true },
  { label: '(-) Despesas c/ Funcionamento',             field: 'despFuncionamento',             indent: true, isNegative: true },
  { label: '(-) Despesas c/ Vendas',                    field: 'despVendas',                   indent: true, isNegative: true },
  { label: 'LUCRO (PREJUÍZO) OPERACIONAL LÍQUIDO',      field: 'lucroPrejOperacionalLiquido',  isTotal: true },
  { label: '% LUCRO (PREJUÍZO) OPERACIONAL LÍQUIDO',    field: 'lucroPrejOperacionalLiquido',  isPct: true },
  { label: '',                                           field: 'lucroPrejOperacionalLiquido',  separator: true },
  { label: 'Amortizações e Depreciações',               field: 'amortizacoesDepreciacoes',      indent: true, isNegative: true },
  { label: 'Outras Receitas Financeiras',               field: 'outrasReceitasFinanceiras',     indent: true },
  { label: '(-) Despesas Financeiras Não Operacional',  field: 'despFinanceirasNaoOperacional', indent: true, isNegative: true },
  { label: '(-) Despesas Não Operacionais',             field: 'despesasNaoOperacionais',       indent: true, isNegative: true },
  { label: 'Outras Rendas Não Operacionais',            field: 'outrasRendasNaoOperacionais',   indent: true },
  { label: 'Lucro (Prejuízo) Antes dos Impostos',       field: 'lucroPrejAntesImpostos',        isSubtotal: true },
  { label: '(-) Provisões IRPJ e C.S.',                 field: 'provisoesIrpjCs',              indent: true, isNegative: true },
  { label: '(-) Participações',                         field: 'participacoes',                indent: true, isNegative: true },
  { label: 'LUCRO LÍQUIDO DO EXERCÍCIO',                field: 'lucroLiquidoExercicio',         isTotal: true },
  { label: '% LUCRO LÍQUIDO DO EXERCÍCIO',              field: 'lucroLiquidoExercicio',         isPct: true },
];

// ─── Períodos ─────────────────────────────────────────────────────────────────

const MONTHS_FULL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export function getPeriodoOptions(type: PeriodoType): PeriodoOption[] {
  switch (type) {
    case 'mensal':
      return MONTHS_FULL.map((label, i) => ({ label, months: [i] }));
    case 'bimestral':
      return [
        { label: 'Jan–Fev',  months: [0, 1] },
        { label: 'Mar–Abr',  months: [2, 3] },
        { label: 'Mai–Jun',  months: [4, 5] },
        { label: 'Jul–Ago',  months: [6, 7] },
        { label: 'Set–Out',  months: [8, 9] },
        { label: 'Nov–Dez',  months: [10, 11] },
      ];
    case 'trimestral':
      return [
        { label: '1º Trim. (Jan–Mar)', months: [0, 1, 2] },
        { label: '2º Trim. (Abr–Jun)', months: [3, 4, 5] },
        { label: '3º Trim. (Jul–Set)', months: [6, 7, 8] },
        { label: '4º Trim. (Out–Dez)', months: [9, 10, 11] },
      ];
    case 'semestral':
      return [
        { label: '1º Semestre (Jan–Jun)', months: [0, 1, 2, 3, 4, 5] },
        { label: '2º Semestre (Jul–Dez)', months: [6, 7, 8, 9, 10, 11] },
      ];
    case 'anual':
      return [{ label: 'Ano completo', months: [0,1,2,3,4,5,6,7,8,9,10,11] }];
  }
}

// ─── Helpers de formatação e cor ──────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n === 0) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function varColor(varPct: number, isNeg: boolean): string {
  if (Math.abs(varPct) < 0.05) return '#64748b';
  const good = isNeg ? varPct < 0 : varPct > 0;
  return good ? '#16a34a' : '#dc2626';
}

function heatmapClass(varPct: number, isNeg: boolean): string {
  const abs = Math.abs(varPct);
  if (abs < 1) return '';
  const good = isNeg ? varPct < 0 : varPct > 0;
  if (good) {
    if (abs > 25) return 'bg-green-100';
    if (abs > 10) return 'bg-green-50';
    return '';
  } else {
    if (abs > 25) return 'bg-red-100';
    if (abs > 10) return 'bg-red-50';
    return '';
  }
}

// ─── Extração de valor acumulado de DreVwRow / DreAudiRow ────────────────────

const VW_DRE_DEPTS   = ['novos', 'usados', 'direta', 'pecas', 'oficina', 'funilaria', 'adm'] as const;
const AUDI_DRE_DEPTS = ['novos', 'usados', 'pecas', 'oficina', 'funilaria', 'adm'] as const;

export function sumDreVwField(
  rows: (DreVwRow | null)[],
  months: number[],
  field: keyof DeptBudget,
  dept: string,
): number {
  return months.reduce((acc, mi) => {
    const row = rows[mi];
    if (!row) return acc;
    if (dept === 'all') {
      return acc + VW_DRE_DEPTS.reduce((s, d) => s + parseVal((row[d] as Record<string, string>)[field]), 0);
    }
    return acc + parseVal((row[dept as keyof DreVwRow] as Record<string, string>)?.[field] ?? '');
  }, 0);
}

export function sumDreAudiField(
  rows: (DreAudiRow | null)[],
  months: number[],
  field: keyof DeptBudget,
  dept: string,
): number {
  return months.reduce((acc, mi) => {
    const row = rows[mi];
    if (!row) return acc;
    if (dept === 'all') {
      return acc + AUDI_DRE_DEPTS.reduce((s, d) => s + parseVal((row[d] as Record<string, string>)[field]), 0);
    }
    return acc + parseVal((row[dept as keyof DreAudiRow] as Record<string, string>)?.[field] ?? '');
  }, 0);
}

export function sumBudgetVwFieldAcc(
  rows: (BudgetVwRow | null)[],
  months: number[],
  field: keyof DeptBudget,
  dept: string,
): number {
  return months.reduce((acc, mi) => {
    const row = rows[mi];
    if (!row) return acc;
    if (dept === 'all') {
      return acc + VW_DEPTS.reduce((s, d) => s + parseVal(row[d][field]), 0);
    }
    return acc + parseVal((row[dept as VwDept])?.[field] ?? '');
  }, 0);
}

export function sumBudgetAudiFieldAcc(
  rows: (BudgetAudiRow | null)[],
  months: number[],
  field: keyof DeptBudget,
  dept: string,
): number {
  return months.reduce((acc, mi) => {
    const row = rows[mi];
    if (!row) return acc;
    if (dept === 'all') {
      return acc + AUDI_DEPTS.reduce((s, d) => s + parseVal(row[d][field]), 0);
    }
    return acc + parseVal((row[dept as AudiDept])?.[field] ?? '');
  }, 0);
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function ComparativoTab({
  compType, marca, periodoType, periodoIdx, threshold, editMode,
  budgetVwMonths, budgetAudiMonths, real2025VwMonths, real2025AudiMonths,
  real2026VwMonths, real2026AudiMonths, deptView,
  onBudgetVwChange, onBudgetAudiChange, hideZeros = false,
}: ComparativoTabProps) {

  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue]     = useState('');
  const [selectedLine, setSelectedLine] = useState<keyof DeptBudget | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const periodoOptions = getPeriodoOptions(periodoType);
  const safeIdx   = Math.min(periodoIdx, periodoOptions.length - 1);
  const months    = periodoOptions[safeIdx]?.months ?? [0];
  const deptKey   = deptView as string;

  // Labels das colunas conforme tipo de comparação
  const [col1Label, col2Label] =
    compType === 'real2025_vs_budget2026'
      ? ['Real 2025', 'Budget 2026']
      : ['Budget 2026', 'Real 2026'];

  // Função que retorna os valores coluna1 e coluna2 para um field + dept
  const getValues = useCallback((field: keyof DeptBudget): { v1: number; v2: number } => {
    const dept = deptKey;

    if (marca === 'vw') {
      if (compType === 'real2025_vs_budget2026') {
        return {
          v1: sumDreVwField(real2025VwMonths, months, field, dept),
          v2: sumBudgetVwFieldAcc(budgetVwMonths, months, field, dept),
        };
      } else {
        return {
          v1: sumBudgetVwFieldAcc(budgetVwMonths, months, field, dept),
          v2: sumDreVwField(real2026VwMonths, months, field, dept),
        };
      }
    }

    if (marca === 'audi') {
      const audiDept = dept === 'direta' ? 'all' : dept; // Audi não tem "direta"
      if (compType === 'real2025_vs_budget2026') {
        return {
          v1: sumDreAudiField(real2025AudiMonths, months, field, audiDept),
          v2: sumBudgetAudiFieldAcc(budgetAudiMonths, months, field, audiDept),
        };
      } else {
        return {
          v1: sumBudgetAudiFieldAcc(budgetAudiMonths, months, field, audiDept),
          v2: sumDreAudiField(real2026AudiMonths, months, field, audiDept),
        };
      }
    }

    // Consolidado = VW + Audi
    const audiDept = dept === 'direta' ? 'all' : dept;
    if (compType === 'real2025_vs_budget2026') {
      return {
        v1: sumDreVwField(real2025VwMonths, months, field, dept)
          + sumDreAudiField(real2025AudiMonths, months, field, audiDept),
        v2: sumBudgetVwFieldAcc(budgetVwMonths, months, field, dept)
          + sumBudgetAudiFieldAcc(budgetAudiMonths, months, field, audiDept),
      };
    } else {
      return {
        v1: sumBudgetVwFieldAcc(budgetVwMonths, months, field, dept)
          + sumBudgetAudiFieldAcc(budgetAudiMonths, months, field, audiDept),
        v2: sumDreVwField(real2026VwMonths, months, field, dept)
          + sumDreAudiField(real2026AudiMonths, months, field, audiDept),
      };
    }
  }, [compType, marca, months, deptKey,
      budgetVwMonths, budgetAudiMonths,
      real2025VwMonths, real2025AudiMonths,
      real2026VwMonths, real2026AudiMonths]);

  // ROL acumulado (denominador para % derivadas)
  const rol = getValues('receitaOperacionalLiquida');

  // ─── Edição inline ──────────────────────────────────────────────────────────

  const startEdit = (cellId: string, currentVal: number) => {
    if (!editMode) return;
    setEditingCell(cellId);
    setEditValue(currentVal === 0 ? '' : String(currentVal));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitEdit = async (cellId: string) => {
    if (editingCell !== cellId) return;
    setEditingCell(null);

    // cellId format: "vw|month-idx|dept|field" or "audi|month-idx|dept|field"
    const [brandKey, miStr, dept, field] = cellId.split('|');
    const mi = Number(miStr);
    const f  = field as keyof DeptBudget;
    const rawVal = editValue.trim();

    if (brandKey === 'vw') {
      const row: BudgetVwRow = {
        ...(budgetVwMonths[mi] ?? {
          periodo: `2026-${String(mi + 1).padStart(2, '0')}`,
          novos: {} as DeptBudget, usados: {} as DeptBudget, direta: {} as DeptBudget,
          pecas: {} as DeptBudget, oficina: {} as DeptBudget, funilaria: {} as DeptBudget, adm: {} as DeptBudget,
        }),
      };
      (row[dept as VwDept] as DeptBudget)[f] = rawVal;
      onBudgetVwChange(row, mi);
      try { await saveBudgetVw(row); toast.success('Salvo'); } catch { toast.error('Erro ao salvar'); }
    } else {
      const row: BudgetAudiRow = {
        ...(budgetAudiMonths[mi] ?? {
          periodo: `2026-${String(mi + 1).padStart(2, '0')}`,
          novos: {} as DeptBudget, usados: {} as DeptBudget,
          pecas: {} as DeptBudget, oficina: {} as DeptBudget, funilaria: {} as DeptBudget, adm: {} as DeptBudget,
        }),
      };
      (row[dept as AudiDept] as DeptBudget)[f] = rawVal;
      onBudgetAudiChange(row, mi);
      try { await saveBudgetAudi(row); toast.success('Salvo'); } catch { toast.error('Erro ao salvar'); }
    }
  };

  // ─── Renderização ───────────────────────────────────────────────────────────

  // Cor dos cabeçalhos por marca
  const marcaColor =
    marca === 'vw'          ? '#001e50' :
    marca === 'audi'        ? '#bb0a30' :
    /* consolidado */         '#4c1d95';

  const renderCell = (val: number, isEditable: boolean, cellId: string) => {
    if (isEditable && editMode) {
      if (editingCell === cellId) {
        return (
          <input
            ref={inputRef}
            className="w-full text-right text-xs px-1 py-0.5 border-2 border-orange-400 rounded outline-none bg-orange-50"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => commitEdit(cellId)}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(cellId); if (e.key === 'Escape') setEditingCell(null); }}
          />
        );
      }
      return (
        <button
          onClick={() => startEdit(cellId, val)}
          className="w-full text-right text-xs hover:bg-orange-50 px-1 py-0.5 rounded transition-colors cursor-text"
          title="Clique para editar"
        >
          {val === 0 ? <span className="text-slate-300">—</span> : fmtNum(val)}
        </button>
      );
    }
    return <span>{val === 0 ? '—' : fmtNum(val)}</span>;
  };

  // Budget é col2 na aba "Real 2025 vs Budget 2026" (col1=Real2025, col2=Budget2026)
  // Budget é col1 na aba "Budget 2026 vs Real 2026" (col1=Budget2026, col2=Real2026)
  const budgetIsCol2 = compType === 'real2025_vs_budget2026';

  // Meses selecionados para edição inline — usa o primeiro mês da seleção em modo multi-mês
  // (edição inline só faz sentido em modo mensal; nos acumulados desabilitamos)
  const isSingleMonth = months.length === 1;

  const chartData = useMemo(() => {
    if (!selectedLine) return [];
    const audiDept = deptKey === 'direta' ? 'all' : deptKey;
    return Array.from({ length: 12 }, (_, mi) => {
      let budgetVal = 0, realVal = 0;
      if (marca === 'vw') {
        budgetVal = sumBudgetVwFieldAcc(budgetVwMonths, [mi], selectedLine, deptKey);
        realVal   = compType === 'real2025_vs_budget2026'
          ? sumDreVwField(real2025VwMonths, [mi], selectedLine, deptKey)
          : sumDreVwField(real2026VwMonths, [mi], selectedLine, deptKey);
      } else if (marca === 'audi') {
        budgetVal = sumBudgetAudiFieldAcc(budgetAudiMonths, [mi], selectedLine, audiDept);
        realVal   = compType === 'real2025_vs_budget2026'
          ? sumDreAudiField(real2025AudiMonths, [mi], selectedLine, audiDept)
          : sumDreAudiField(real2026AudiMonths, [mi], selectedLine, audiDept);
      } else {
        const realVwData   = compType === 'real2025_vs_budget2026' ? real2025VwMonths   : real2026VwMonths;
        const realAudiData = compType === 'real2025_vs_budget2026' ? real2025AudiMonths : real2026AudiMonths;
        budgetVal = sumBudgetVwFieldAcc(budgetVwMonths, [mi], selectedLine, deptKey)
                 + sumBudgetAudiFieldAcc(budgetAudiMonths, [mi], selectedLine, audiDept);
        realVal   = sumDreVwField(realVwData, [mi], selectedLine, deptKey)
                 + sumDreAudiField(realAudiData, [mi], selectedLine, audiDept);
      }
      return { name: MONTHS_SHORT[mi], Budget: budgetVal, Real: realVal };
    });
  }, [selectedLine, marca, deptKey, compType,
      budgetVwMonths, budgetAudiMonths,
      real2025VwMonths, real2025AudiMonths,
      real2026VwMonths, real2026AudiMonths]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ backgroundColor: marcaColor }} className="text-white">
            <th className="text-left py-2 px-3 font-semibold w-72 sticky left-0 z-10" style={{ backgroundColor: marcaColor }}>
              Descrição
            </th>
            <th className="text-right py-2 px-3 font-semibold min-w-[110px]">{col1Label}</th>
            <th className="text-right py-2 px-3 font-semibold min-w-[110px]">
              {col2Label}
              {editMode && isSingleMonth && <span className="ml-1 text-orange-300 text-[10px]">✏</span>}
            </th>
            <th className="text-right py-2 px-3 font-semibold min-w-[110px]">Var R$</th>
            <th className="text-right py-2 px-3 font-semibold min-w-[90px]">Var %</th>
          </tr>
        </thead>
        <tbody>
          {DRE_LINES.map((line, idx) => {
            if (line.separator) {
              return <tr key={idx}><td colSpan={5} className="h-px bg-slate-200" /></tr>;
            }

            // Calcula os valores desta linha
            let v1: number, v2: number;

            if (line.isPct) {
              // Percentual derivado: valor_campo / ROL acumulado
              const raw = getValues(line.field);
              const rolV1 = rol.v1 || 1;
              const rolV2 = rol.v2 || 1;
              const pct1 = rolV1 !== 0 ? (raw.v1 / rolV1) * 100 : 0;
              const pct2 = rolV2 !== 0 ? (raw.v2 / rolV2) * 100 : 0;
              v1 = pct1; v2 = pct2;

              const varPct = pct2 - pct1; // diferença de pontos percentuais
              const abs    = Math.abs(varPct);
              const hasAlert = abs >= threshold;
              const colorStyle = { color: varColor(varPct, !!line.isNegative) };

              return (
                <tr key={idx} className="bg-slate-50 border-b border-slate-100">
                  <td className="py-1 px-3 text-slate-400 italic text-[10px] sticky left-0 bg-slate-50 pl-6">{line.label}</td>
                  <td className="text-right py-1 px-3 text-slate-500">{fmtPct(v1)}</td>
                  <td className="text-right py-1 px-3 text-slate-500">{fmtPct(v2)}</td>
                  <td className="text-right py-1 px-3 text-slate-400">—</td>
                  <td className={`text-right py-1 px-3 font-medium ${heatmapClass(varPct, !!line.isNegative)}`} style={colorStyle}>
                    <span className="flex items-center justify-end gap-1">
                      {hasAlert && <AlertTriangle size={10} className="text-amber-500 flex-shrink-0" />}
                      {fmtPct(varPct)} <span className="text-[9px] text-slate-400 ml-0.5">pp</span>
                    </span>
                  </td>
                </tr>
              );
            }

            const raw = getValues(line.field);
            v1 = raw.v1; v2 = raw.v2;
            if (hideZeros && v1 === 0 && v2 === 0) return null;
            const varR  = v2 - v1;
            const varPct = v1 !== 0 ? (varR / Math.abs(v1)) * 100 : (v2 !== 0 ? 100 : 0);
            const abs    = Math.abs(varPct);
            const hasAlert = (v1 !== 0 || v2 !== 0) && abs >= threshold;
            const colorStyle = (v1 !== 0 || v2 !== 0) ? { color: varColor(varPct, !!line.isNegative) } : {};

            // Determina cellId para edição inline
            // Budget 2026 é col2 se compType === 'budget2026_vs_real2026', senão é col1
            const budgetCellId = (() => {
              if (!isSingleMonth || !editMode) return null;
              const mi = months[0];
              const d  = deptKey === 'all' ? (marca === 'vw' ? 'novos' : 'novos') : deptKey; // all→edita individualmente pelo dept
              const brand = marca === 'consolidado' ? 'vw' : marca;
              return `${brand}|${mi}|${d}|${line.field}`;
            })();

            const isEditableCell = editMode && isSingleMonth && budgetCellId !== null &&
              DEPT_FIELDS.includes(line.field);

            // Row styling
            let rowClass = 'border-b border-slate-100 hover:bg-slate-50 transition-colors';
            let cellClass = 'py-1.5 px-3';
            let labelClass = 'text-slate-700';
            let bgStyle: React.CSSProperties = {};

            if (line.isTotal) {
              bgStyle = { backgroundColor: marcaColor };
              rowClass = 'border-b border-slate-300';
              cellClass = 'py-2 px-3';
              labelClass = 'font-bold text-white uppercase text-[11px]';
            } else if (line.isSubtotal) {
              rowClass = 'border-b-2 border-slate-300 bg-slate-50';
              cellClass = 'py-1.5 px-3';
              labelClass = 'font-semibold text-slate-800';
            } else if (line.isBold) {
              labelClass = 'font-semibold text-slate-800';
            } else if (line.indent) {
              labelClass = 'text-slate-600 pl-5';
            }

            const textColorTotal = line.isTotal ? 'text-white' : '';
            const numColorTotal  = line.isTotal ? { color: '#ffffff' } : {};

            const isSelected = selectedLine === line.field && !line.isTotal;
            return (
              <tr key={idx} className={`${rowClass}${isSelected ? ' bg-orange-50/50' : ''}`} style={bgStyle}>
                <td
                  className={`${cellClass} ${labelClass} sticky left-0 z-10${!line.isTotal ? ' cursor-pointer' : ''}`}
                  style={bgStyle}
                  onClick={!line.isTotal ? () => setSelectedLine(prev => prev === line.field ? null : line.field) : undefined}
                >
                  {line.indent && <span className="mr-1 text-slate-400">·</span>}
                  {line.label}
                </td>
                {/* Coluna 1 */}
                <td className={`text-right ${cellClass} ${textColorTotal} tabular-nums`} style={numColorTotal}>
                  {fmtNum(v1)}
                </td>
                {/* Coluna 2 — sempre mostra v2; editável apenas quando Budget é col2 */}
                <td className={`text-right ${cellClass} ${textColorTotal} tabular-nums ${isEditableCell && budgetIsCol2 ? 'cursor-pointer' : ''}`}
                  style={numColorTotal}
                >
                  {isEditableCell && budgetIsCol2
                    ? renderCell(v2, true, budgetCellId!)
                    : fmtNum(v2)}
                </td>
                {/* Var R$ */}
                <td className={`text-right ${cellClass} font-medium tabular-nums ${heatmapClass(varPct, !!line.isNegative)}`}
                  style={(v1 !== 0 || v2 !== 0) ? colorStyle : {}}
                >
                  {v1 === 0 && v2 === 0 ? '—' : fmtNum(varR)}
                </td>
                {/* Var % */}
                <td className={`text-right ${cellClass} font-medium tabular-nums ${heatmapClass(varPct, !!line.isNegative)}`}
                  style={(v1 !== 0 || v2 !== 0) ? colorStyle : {}}
                >
                  {v1 === 0 && v2 === 0 ? '—' : (
                    <span className="flex items-center justify-end gap-1">
                      {hasAlert && <AlertTriangle size={10} className="text-amber-500 flex-shrink-0" />}
                      {fmtPct(varPct)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Gráfico rápido da linha selecionada */}
      {selectedLine && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <BarChart2 size={13} className="text-orange-500" />
              {DRE_LINES.find(l => l.field === selectedLine && !l.isPct && !l.separator)?.label ?? String(selectedLine)}
              {' — evolução 12 meses'}
            </h3>
            <button onClick={() => setSelectedLine(null)} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 9 }} width={60} tickFormatter={(v: number) =>
                  Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M`
                    : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(0)}k`
                    : String(v)
                } />
                <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Budget" fill="#f97316" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Real" fill="#64748b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {editMode && !isSingleMonth && (
        <p className="text-center text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-3 mx-4">
          <AlertTriangle size={12} className="inline mr-1" />
          A edição inline está disponível apenas no modo <strong>Mensal</strong>. Selecione um mês específico para editar valores.
        </p>
      )}
    </div>
  );
}

// ─── Seletor de departamento ──────────────────────────────────────────────────

interface DeptSelectorProps {
  marca:    MarcaType;
  value:    string;
  onChange: (v: string) => void;
}

export function DeptSelector({ marca, value, onChange }: DeptSelectorProps) {
  const depts = marca === 'audi'
    ? AUDI_DEPTS.map(d => ({ key: d, label: AUDI_DEPT_LABELS[d] }))
    : VW_DEPTS.map(d => ({ key: d, label: VW_DEPT_LABELS[d] }));

  return (
    <div className="flex flex-wrap gap-1">
      <button
        onClick={() => onChange('all')}
        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
          value === 'all'
            ? 'bg-slate-700 text-white border-slate-700'
            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
        }`}
      >
        Todos
      </button>
      {depts.map(d => (
        <button
          key={d.key}
          onClick={() => onChange(d.key)}
          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
            value === d.key
              ? 'bg-slate-700 text-white border-slate-700'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
          }`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
