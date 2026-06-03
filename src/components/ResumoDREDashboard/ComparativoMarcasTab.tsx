import { useState, useEffect } from 'react';
import { Loader2, Printer } from 'lucide-react';
import {
  loadDreVw,
  createEmptyDreVwRow,
  type DreVwDept,
  type DreVwRow,
} from './dreVwStorage';
import {
  loadDreAudi,
  createEmptyDreAudiRow,
  type DreAudiDept,
  type DreAudiRow,
} from './dreAudiStorage';
import { loadDREDataAsync } from '@/lib/dbStorage';
import type { Department } from '@/lib/dataStorage';

// ─── Cores ────────────────────────────────────────────────────────────────────
const VW_COLOR      = '#001e50';
const VW_COLOR_DRK  = '#001238';
const AUDI_COLOR    = '#bb0a30';
const AUDI_COLOR_DRK = '#9a0827';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// ─── DRE lines (idênticas às abas VW/Audi) ───────────────────────────────────
interface DreLineConfig {
  label: string;
  field: string;
  isBold?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
  indent?: boolean;
  isNegative?: boolean;
  isPct?: boolean;
  separator?: boolean;
}

const DRE_LINES: DreLineConfig[] = [
  { label: 'Volume de Vendas',                           field: 'quant' },
  { label: '',                                            field: 'quant',                         separator: true },
  { label: 'Receita Operacional Líquida',                field: 'receitaOperacionalLiquida',      isBold: true },
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

// ─── Mapeamentos dept → Dashboard Executivo ───────────────────────────────────
const VW_DEPTS   = ['novos','direta','usados','pecas','oficina','funilaria','adm'] as const;
const AUDI_DEPTS = ['novos','usados','pecas','oficina','funilaria','adm'] as const;

const VW_DEPT_TO_EXEC: Partial<Record<string, Department>> = {
  novos: 'novos', direta: 'vendaDireta', usados: 'usados',
  pecas: 'pecas', oficina: 'oficina', funilaria: 'funilaria',
  adm: 'administracao',
};
const AUDI_DEPT_TO_EXEC: Partial<Record<string, Department>> = {
  novos: 'novos', usados: 'usados', pecas: 'pecas', oficina: 'oficina', funilaria: 'funilaria', adm: 'administracao',
};

const VW_DESCRICAO_TO_FIELD: Record<string, string> = {
  'VOLUME DE VENDAS':                      'quant',
  'RECEITA OPERACIONAL LIQUIDA':           'receitaOperacionalLiquida',
  'CUSTO OPERACIONAL DA RECEITA':          'custoOperacionalReceita',
  'LUCRO (PREJUIZO) OPERACIONAL BRUTO':   'lucroPrejOperacionalBruto',
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

function parseVal(v: string | number | undefined | null): number {
  if (v == null || v === '') return 0;
  return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
}

function pctStr(val: number, rol: number): string {
  if (!rol) return '—';
  return ((val / rol) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function buildDeptFromDREData(dreData: any[] | null, monthIndex: number): Record<string, string> {
  const dept: Record<string, string> = {};
  if (!dreData) return dept;
  for (const line of dreData) {
    const descKey = ((line.descricao as string) || (line.label as string) || '').toUpperCase().trim();
    const field = VW_DESCRICAO_TO_FIELD[descKey];
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

/** Soma todos os depts; para ROL exclui ADM */
function sumTotals(
  depts: readonly string[],
  getDept: (key: string) => Record<string, string>,
  field: string,
): number {
  return depts.reduce((s, dKey) => {
    if (dKey === 'adm' && field === 'receitaOperacionalLiquida') return s;
    return s + parseVal(getDept(dKey)[field]);
  }, 0);
}

/** ROL total (excl ADM) — usado para calcular percentuais */
function getROL(
  depts: readonly string[],
  getDept: (key: string) => Record<string, string>,
): number {
  return sumTotals(depts, getDept, 'receitaOperacionalLiquida');
}

type ResultadoPeriodo = 'mensal' | 'acumulado';

interface ResultadoBundle {
  vw: DreVwRow;
  audi: DreAudiRow;
}

interface ComparativoTabelaProps {
  vwData: DreVwRow | null;
  audiData: DreAudiRow | null;
  periodLabel: string;
  rootId?: string;
  showPrintButton?: boolean;
  onPrint?: () => void;
}

function ComparativoTabela({ vwData, audiData, periodLabel, rootId, showPrintButton = false, onPrint }: ComparativoTabelaProps) {
  if (!vwData || !audiData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center">
        <p className="text-sm text-slate-500">Dados indisponíveis para o período selecionado.</p>
      </div>
    );
  }

  const getVwDept = (key: string): Record<string, string> => (vwData as any)?.[key] ?? {};
  const getAudiDept = (key: string): Record<string, string> => (audiData as any)?.[key] ?? {};

  const vwROL = getROL(VW_DEPTS, getVwDept);
  const audiROL = getROL(AUDI_DEPTS, getAudiDept);
  const NCOLS = 5;

  return (
    <div id={rootId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div
        className="px-6 py-3 text-white font-bold flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${VW_COLOR} 50%, ${AUDI_COLOR} 100%)` }}
      >
        <div className="flex items-center gap-3">
          <span className="text-base">Comparativo de Marcas — Resultado</span>
          <span className="text-base">{periodLabel}</span>
        </div>
        {showPrintButton && (
          <button
            onClick={onPrint}
            className="no-print flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/20 hover:bg-white/30 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir PDF
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-200" style={{ borderBottom: '2px solid #334155' }}>
              <th className="text-left px-4 py-3 font-bold text-slate-800 text-sm w-64 min-w-[16rem]">Descrição</th>
              <th className="text-center px-4 py-3 font-bold text-sm text-white min-w-[10rem]" style={{ backgroundColor: VW_COLOR }}>VW Norte</th>
              <th className="text-center px-4 py-3 font-bold text-sm text-white min-w-[10rem]" style={{ backgroundColor: AUDI_COLOR }}>Audi</th>
              <th className="text-center px-4 py-3 font-bold text-sm text-slate-700 min-w-[10rem] bg-slate-100">Var R$ (Audi – VW)</th>
              <th className="text-center px-4 py-3 font-bold text-sm text-slate-700 min-w-[8rem] bg-slate-100">Var %</th>
            </tr>
          </thead>
          <tbody>
            {DRE_LINES.map((line, idx) => {
              if (line.separator) {
                return <tr key={idx}><td colSpan={NCOLS} className="h-px bg-slate-100" /></tr>;
              }

              const isQuant = line.field === 'quant' && idx === 0;

              if (line.isPct) {
                const vwV = sumTotals(VW_DEPTS, getVwDept, line.field);
                const auV = sumTotals(AUDI_DEPTS, getAudiDept, line.field);
                return (
                  <tr key={idx} className="border-b border-slate-100 bg-slate-50/50">
                    <td className="px-4 py-0.5 pl-7 text-[0.68rem] italic text-slate-500">{line.label}</td>
                    <td className="px-4 py-0.5 text-right text-[0.68rem] italic text-slate-500">{pctStr(vwV, vwROL)}</td>
                    <td className="px-4 py-0.5 text-right text-[0.68rem] italic text-slate-500">{pctStr(auV, audiROL)}</td>
                    <td className="px-4 py-0.5 text-right text-[0.68rem] italic text-slate-400 bg-slate-50">—</td>
                    <td className="px-4 py-0.5 text-right text-[0.68rem] italic text-slate-400 bg-slate-50">—</td>
                  </tr>
                );
              }

              const vwVal = isQuant
                ? VW_DEPTS.reduce((s, k) => s + (parseInt(getVwDept(k)['quant'] || '0') || 0), 0)
                : sumTotals(VW_DEPTS, getVwDept, line.field);
              const auVal = isQuant
                ? AUDI_DEPTS.reduce((s, k) => s + (parseInt(getAudiDept(k)['quant'] || '0') || 0), 0)
                : sumTotals(AUDI_DEPTS, getAudiDept, line.field);

              const varR = auVal - vwVal;
              const varPct = vwVal !== 0 ? (varR / Math.abs(vwVal)) * 100 : 0;

              const fmtVal = (v: number) =>
                isQuant
                  ? (v > 0 ? v.toString() : '—')
                  : (v !== 0 ? v.toLocaleString('pt-BR') : '—');

              const rowStyle = line.isTotal ? {} : undefined;
              const rowClass = line.isTotal
                ? 'font-bold text-white'
                : line.isSubtotal
                ? 'bg-slate-100 font-semibold text-slate-800'
                : 'hover:bg-slate-50 text-slate-700';

              const vwCellBg = line.isTotal ? VW_COLOR_DRK : undefined;
              const auCellBg = line.isTotal ? AUDI_COLOR_DRK : undefined;
              const varCellBg = line.isTotal ? '#1e293b' : undefined;

              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`} style={rowStyle}>
                  <td
                    className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''} ${line.isTotal ? 'text-white' : ''}`}
                    style={line.isTotal ? { backgroundColor: VW_COLOR } : undefined}
                  >
                    {line.label}
                  </td>
                  <td
                    className="px-4 py-1.5 text-right tabular-nums"
                    style={{ backgroundColor: vwCellBg ?? (line.isTotal ? VW_COLOR : undefined), color: line.isTotal ? 'white' : undefined }}
                  >
                    {fmtVal(vwVal)}
                  </td>
                  <td
                    className="px-4 py-1.5 text-right tabular-nums"
                    style={{ backgroundColor: auCellBg ?? (line.isTotal ? AUDI_COLOR : undefined), color: line.isTotal ? 'white' : undefined }}
                  >
                    {fmtVal(auVal)}
                  </td>
                  <td
                    className={`px-4 py-1.5 text-right tabular-nums font-medium bg-slate-50 ${
                      !line.isTotal
                        ? varR > 0 ? 'text-emerald-600' : varR < 0 ? 'text-red-600' : 'text-slate-400'
                        : 'text-white'
                    }`}
                    style={line.isTotal ? { backgroundColor: varCellBg } : undefined}
                  >
                    {!isQuant && (vwVal !== 0 || auVal !== 0)
                      ? (varR >= 0 ? '+' : '') + varR.toLocaleString('pt-BR')
                      : '—'}
                  </td>
                  <td
                    className={`px-4 py-1.5 text-right tabular-nums font-bold bg-slate-50 ${
                      !line.isTotal
                        ? varPct > 0 ? 'text-emerald-600' : varPct < 0 ? 'text-red-600' : 'text-slate-400'
                        : 'text-white'
                    }`}
                    style={line.isTotal ? { backgroundColor: varCellBg } : undefined}
                  >
                    {!isQuant && vwVal !== 0
                      ? (varPct >= 0 ? '+' : '') + varPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sub-aba Resultado ────────────────────────────────────────────────────────

function ResultadoTab({ year, month, periodo }: { year: number; month: number; periodo: ResultadoPeriodo }) {
  const [loading, setLoading] = useState(true);
  const [mensalData, setMensalData] = useState<ResultadoBundle | null>(null);
  const [acumuladoData, setAcumuladoData] = useState<ResultadoBundle | null>(null);

  useEffect(() => {
    setLoading(true);

    const selectedMonth = month === 0 ? 12 : month;
    const yr = year as 2024 | 2025 | 2026 | 2027;

    async function loadAccumulated(untilMonth: number): Promise<ResultadoBundle> {
      const vwSyncable   = VW_DEPTS.filter(k => VW_DEPT_TO_EXEC[k]);
      const audiSyncable = AUDI_DEPTS.filter(k => AUDI_DEPT_TO_EXEC[k]);
      const monthsToLoad = Array.from({ length: untilMonth }, (_, i) => i + 1);
      const DEPT_FIELDS = [
        'quant','receitaOperacionalLiquida','custoOperacionalReceita',
        'lucroPrejOperacionalBruto','outrasReceitasOperacionais','outrasDespesasOperacionais',
        'margemContribuicao','despPessoal','despServTerceiros','despOcupacao','despFuncionamento',
        'despVendas','lucroPrejOperacionalLiquido','amortizacoesDepreciacoes',
        'outrasReceitasFinanceiras','despFinanceirasNaoOperacional','despesasNaoOperacionais',
        'outrasRendasNaoOperacionais','lucroPrejAntesImpostos','provisoesIrpjCs',
        'participacoes','lucroLiquidoExercicio',
      ] as const;

      const [vwMonths, audiMonths, vwExec, audiExec] = await Promise.all([
        Promise.all(monthsToLoad.map(m => loadDreVw(year, m))),
        Promise.all(monthsToLoad.map(m => loadDreAudi(year, m))),
        Promise.all(vwSyncable.map(k => loadDREDataAsync(yr, VW_DEPT_TO_EXEC[k]!, 'vw').then(d => ({ k, d })))),
        Promise.all(audiSyncable.map(k => loadDREDataAsync(yr, AUDI_DEPT_TO_EXEC[k]!, 'audi').then(d => ({ k, d })))),
      ]);

      const vwExecMap: Record<string, any[] | null> = {};
      for (const { k, d } of vwExec) vwExecMap[k] = d;
      const audiExecMap: Record<string, any[] | null> = {};
      for (const { k, d } of audiExec) audiExecMap[k] = d;

      function buildRow(
        kvMonths: (DreVwRow | DreAudiRow | null)[],
        depts: readonly string[],
        execMap: Record<string, any[] | null>,
        emptyFn: () => DreVwRow | DreAudiRow,
      ) {
        const summed = emptyFn();
        for (let mi = 0; mi < monthsToLoad.length; mi++) {
          const kv = kvMonths[mi];
          for (const dKey of depts) {
            const kvDept = (kv as any)?.[dKey] as Record<string, string> | undefined;
            const hasKv  = kvDept && Object.values(kvDept).some(v => v !== '');
            const src: Record<string, string> = hasKv
              ? (kvDept as Record<string, string>)
              : buildDeptFromDREData(execMap[dKey] ?? null, mi);
            for (const f of DEPT_FIELDS) {
              const prev = parseVal((summed as any)[dKey][f]);
              const add  = parseVal(src[f] ?? '');
              if (add !== 0) (summed as any)[dKey][f] = (prev + add).toString();
            }
          }
        }
        return summed;
      }

      const vwSummed   = buildRow(vwMonths, VW_DEPTS, vwExecMap, () => createEmptyDreVwRow(year, 0));
      const audiSummed = buildRow(audiMonths, AUDI_DEPTS, audiExecMap, () => createEmptyDreAudiRow(year, 0));

      return {
        vw: vwSummed as DreVwRow,
        audi: audiSummed as DreAudiRow,
      };
    }

    async function loadMensal(targetMonth: number): Promise<ResultadoBundle> {
      const mIdx = targetMonth - 1;
      const vwSyncable   = VW_DEPTS.filter(k => VW_DEPT_TO_EXEC[k]);
      const audiSyncable = AUDI_DEPTS.filter(k => AUDI_DEPT_TO_EXEC[k]);

      const [vwKv, audiKv, vwExec, audiExec] = await Promise.all([
        loadDreVw(year, targetMonth),
        loadDreAudi(year, targetMonth),
        Promise.all(vwSyncable.map(k => loadDREDataAsync(yr, VW_DEPT_TO_EXEC[k]!, 'vw').then(d => ({ k, d })))),
        Promise.all(audiSyncable.map(k => loadDREDataAsync(yr, AUDI_DEPT_TO_EXEC[k]!, 'audi').then(d => ({ k, d })))),
      ]);

      const vwExecMap: Record<string, any[] | null> = {};
      for (const { k, d } of vwExec) vwExecMap[k] = d;
      const audiExecMap: Record<string, any[] | null> = {};
      for (const { k, d } of audiExec) audiExecMap[k] = d;

      function mergeRow(
        kv: DreVwRow | DreAudiRow | null,
        depts: readonly string[],
        execMap: Record<string, any[] | null>,
        emptyFn: () => DreVwRow | DreAudiRow,
      ) {
        const row = emptyFn();
        for (const dKey of depts) {
          const kvDept = (kv as any)?.[dKey] as Record<string, string> | undefined;
          const hasKv  = kvDept && Object.values(kvDept).some(v => v !== '');
          const src    = hasKv ? kvDept : buildDeptFromDREData(execMap[dKey] ?? null, mIdx);
          (row as any)[dKey] = { ...(row as any)[dKey], ...src };
        }
        return row;
      }

      return {
        vw: mergeRow(vwKv, VW_DEPTS, vwExecMap, () => createEmptyDreVwRow(year, targetMonth)) as DreVwRow,
        audi: mergeRow(audiKv, AUDI_DEPTS, audiExecMap, () => createEmptyDreAudiRow(year, targetMonth)) as DreAudiRow,
      };
    }

    let cancelled = false;

    (async () => {
      if (month === 0) {
        const acumulado = await loadAccumulated(12);
        if (!cancelled) {
          setMensalData(null);
          setAcumuladoData(acumulado);
          setLoading(false);
        }
        return;
      }

      const [mensal, acumulado] = await Promise.all([
        loadMensal(month),
        loadAccumulated(selectedMonth),
      ]);

      if (!cancelled) {
        setMensalData(mensal);
        setAcumuladoData(acumulado);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const mensalLabel = month === 0 ? `Mês não selecionado/${year}` : `${MONTHS[month - 1]}/${year}`;
  const acumuladoLabel = `Acumulado de Janeiro a ${MONTHS[(month === 0 ? 12 : month) - 1]} de ${year}`;
  const activeLabel = periodo === 'mensal' ? mensalLabel : acumuladoLabel;

  const activeBundle = periodo === 'mensal' ? mensalData : acumuladoData;

  const handlePrintBoth = () => {
    const printSource = document.getElementById('comparativo-marcas-print-both');
    const root = document.getElementById('print-root');
    if (!printSource || !root) {
      window.print();
      return;
    }

    const clone = printSource.cloneNode(true) as HTMLElement;
    clone.style.display = 'block';
    root.innerHTML = clone.outerHTML;

    const style = document.createElement('style');
    style.id = 'comparativo-print-override';
    style.textContent = `
      @page { size: A4 landscape; margin: 0.4cm !important; }
      #print-root {
        zoom: 0.82;
        font-family: Inter, sans-serif;
      }
      #print-root, #print-root * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
        color-scheme: light !important;
      }
      #print-root .print-page {
        page-break-after: always;
        break-after: page;
        margin-bottom: 0.4cm;
      }
      #print-root .print-page:last-child {
        page-break-after: auto;
        break-after: auto;
        margin-bottom: 0;
      }
    `;
    document.head.appendChild(style);

    window.onafterprint = () => {
      document.head.removeChild(style);
      root.innerHTML = '';
      window.onafterprint = null;
    };

    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const NCOLS = 5; // Descrição | VW | Audi | Var R$ | Var %

  if (periodo === 'mensal' && month === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center">
        <p className="text-sm text-slate-500">Selecione um mês para visualizar o comparativo mensal.</p>
      </div>
    );
  }

  return (
    <>
      <ComparativoTabela
        rootId="comparativo-marcas-print-area"
        vwData={activeBundle?.vw ?? null}
        audiData={activeBundle?.audi ?? null}
        periodLabel={activeLabel}
        showPrintButton
        onPrint={handlePrintBoth}
      />

      <div id="comparativo-marcas-print-both" style={{ display: 'none' }}>
        {month !== 0 && mensalData && (
          <div className="print-page">
            <ComparativoTabela
              vwData={mensalData.vw}
              audiData={mensalData.audi}
              periodLabel={mensalLabel}
            />
          </div>
        )}
        {acumuladoData && (
          <div className="print-page">
            <ComparativoTabela
              vwData={acumuladoData.vw}
              audiData={acumuladoData.audi}
              periodLabel={acumuladoLabel}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ─── Sub-aba Resultado Ajustado ───────────────────────────────────────────────
function ResultadoAjustadoTab() {
  return (
    <div className="flex items-center justify-center py-32 text-slate-400">
      <p className="text-sm">Em construção</p>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

type SubTab = 'resultado' | 'resultado-ajustado';

interface Props { year: number; month: number; }

export function ComparativoMarcasTab({ year, month }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('resultado');
  const [resultadoPeriodo, setResultadoPeriodo] = useState<ResultadoPeriodo>('mensal');

  const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const periodLabel = month === 0
    ? `Ano ${year}`
    : `${MONTHS_SHORT[month - 1]}/${year}`;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-[1440px] mx-auto p-4 flex flex-col gap-4">

        {/* Header */}
        <div>
          <h2 className="text-lg font-bold text-slate-800">Comparativo de Marcas</h2>
          <p className="text-sm text-slate-500">{periodLabel} — VW Norte vs Audi</p>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-2">
          {([
            ['resultado',          'Resultado'],
            ['resultado-ajustado', 'Resultado Ajustado'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              className={`px-5 py-2 text-sm font-semibold rounded-lg border transition-all ${
                subTab === id
                  ? 'text-white shadow-sm border-transparent bg-slate-700'
                  : 'text-slate-500 bg-white border-slate-200 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        {subTab === 'resultado' ? (
          <>
            <div className="flex gap-2">
              {([
                ['mensal', 'Mensal'],
                ['acumulado', 'Acumulado'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setResultadoPeriodo(id)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    resultadoPeriodo === id
                      ? 'text-white shadow-sm border-transparent bg-slate-700'
                      : 'text-slate-500 bg-white border-slate-200 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <ResultadoTab year={year} month={month} periodo={resultadoPeriodo} />
          </>
        ) : (
          <ResultadoAjustadoTab />
        )}

      </div>
    </div>
  );
}
