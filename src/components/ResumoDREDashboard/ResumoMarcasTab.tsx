import { useEffect, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import {
  loadDreVw,
  createEmptyDreVwRow,
  type DreVwRow,
} from './dreVwStorage';
import {
  loadDreAudi,
  createEmptyDreAudiRow,
  type DreAudiRow,
} from './dreAudiStorage';
import { loadDREDataAsync } from '@/lib/dbStorage';
import type { Department } from '@/lib/dataStorage';

const VW_COLOR = '#001e50';
const VW_COLOR_DRK = '#001238';
const AUDI_COLOR = '#bb0a30';
const AUDI_COLOR_DRK = '#9a0827';
const TOTAL_COLOR = '#1e293b';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface DreLineConfig {
  label: string;
  field: string;
  isSubtotal?: boolean;
  isTotal?: boolean;
  indent?: boolean;
  isPct?: boolean;
  separator?: boolean;
}

const DRE_LINES: DreLineConfig[] = [
  { label: 'Volume de Vendas', field: 'quant' },
  { label: '', field: 'quant', separator: true },
  { label: 'Receita Operacional Líquida', field: 'receitaOperacionalLiquida' },
  { label: '(-) Custo Operacional da Receita', field: 'custoOperacionalReceita', indent: true },
  { label: 'Lucro (Prejuízo) Operacional Bruto', field: 'lucroPrejOperacionalBruto', isSubtotal: true },
  { label: 'Outras Receitas Operacionais', field: 'outrasReceitasOperacionais', indent: true },
  { label: '(-) Outras Despesas Operacionais', field: 'outrasDespesasOperacionais', indent: true },
  { label: 'MARGEM DE CONTRIBUIÇÃO', field: 'margemContribuicao', isTotal: true },
  { label: '% MARGEM DE CONTRIBUIÇÃO', field: 'margemContribuicao', isPct: true },
  { label: '', field: 'margemContribuicao', separator: true },
  { label: '(-) Despesas c/ Pessoal', field: 'despPessoal', indent: true },
  { label: '(-) Despesas c/ Serv. de Terceiros', field: 'despServTerceiros', indent: true },
  { label: '(-) Despesas c/ Ocupação', field: 'despOcupacao', indent: true },
  { label: '(-) Despesas c/ Funcionamento', field: 'despFuncionamento', indent: true },
  { label: '(-) Despesas c/ Vendas', field: 'despVendas', indent: true },
  { label: 'LUCRO (PREJUÍZO) OPERACIONAL LÍQUIDO', field: 'lucroPrejOperacionalLiquido', isTotal: true },
  { label: '% LUCRO (PREJUÍZO) OPERACIONAL LÍQUIDO', field: 'lucroPrejOperacionalLiquido', isPct: true },
  { label: '', field: 'lucroPrejOperacionalLiquido', separator: true },
  { label: 'Amortizações e Depreciações', field: 'amortizacoesDepreciacoes', indent: true },
  { label: 'Outras Receitas Financeiras', field: 'outrasReceitasFinanceiras', indent: true },
  { label: '(-) Despesas Financeiras Não Operacional', field: 'despFinanceirasNaoOperacional', indent: true },
  { label: '(-) Despesas Não Operacionais', field: 'despesasNaoOperacionais', indent: true },
  { label: 'Outras Rendas Não Operacionais', field: 'outrasRendasNaoOperacionais', indent: true },
  { label: 'Lucro (Prejuízo) Antes dos Impostos', field: 'lucroPrejAntesImpostos', isSubtotal: true },
  { label: '(-) Provisões IRPJ e C.S.', field: 'provisoesIrpjCs', indent: true },
  { label: '(-) Participações', field: 'participacoes', indent: true },
  { label: 'LUCRO LÍQUIDO DO EXERCÍCIO', field: 'lucroLiquidoExercicio', isTotal: true },
  { label: '% LUCRO LÍQUIDO DO EXERCÍCIO', field: 'lucroLiquidoExercicio', isPct: true },
];

const VW_DEPTS = ['novos', 'direta', 'usados', 'pecas', 'oficina', 'funilaria', 'adm'] as const;
const AUDI_DEPTS = ['novos', 'usados', 'pecas', 'oficina', 'funilaria', 'adm'] as const;

const VW_DEPT_TO_EXEC: Partial<Record<string, Department>> = {
  novos: 'novos',
  direta: 'vendaDireta',
  usados: 'usados',
  pecas: 'pecas',
  oficina: 'oficina',
  funilaria: 'funilaria',
  adm: 'administracao',
};

const AUDI_DEPT_TO_EXEC: Partial<Record<string, Department>> = {
  novos: 'novos',
  usados: 'usados',
  pecas: 'pecas',
  oficina: 'oficina',
  funilaria: 'funilaria',
  adm: 'administracao',
};

const DESCRICAO_TO_FIELD: Record<string, string> = {
  'VOLUME DE VENDAS': 'quant',
  'RECEITA OPERACIONAL LIQUIDA': 'receitaOperacionalLiquida',
  'CUSTO OPERACIONAL DA RECEITA': 'custoOperacionalReceita',
  'LUCRO (PREJUIZO) OPERACIONAL BRUTO': 'lucroPrejOperacionalBruto',
  'OUTRAS RECEITAS OPERACIONAIS': 'outrasReceitasOperacionais',
  'OUTRAS DESPESAS OPERACIONAIS': 'outrasDespesasOperacionais',
  'MARGEM DE CONTRIBUIÇÃO': 'margemContribuicao',
  'MARGEM DE CONTRIBUICAO': 'margemContribuicao',
  'DESPESAS C/ PESSOAL': 'despPessoal',
  'DESPESAS C/ SERV. DE TERCEIROS': 'despServTerceiros',
  'DESPESAS C/ OCUPAÇÃO': 'despOcupacao',
  'DESPESAS C/ OCUPACAO': 'despOcupacao',
  'DESPESAS C/ FUNCIONAMENTO': 'despFuncionamento',
  'DESPESAS C/ VENDAS': 'despVendas',
  'LUCRO (PREJUIZO) OPERACIONAL LIQUIDO': 'lucroPrejOperacionalLiquido',
  'AMORTIZAÇÕES E DEPRECIAÇÕES': 'amortizacoesDepreciacoes',
  'AMORTIZACOES E DEPRECIACOES': 'amortizacoesDepreciacoes',
  'OUTRAS RECEITAS FINANCEIRAS': 'outrasReceitasFinanceiras',
  'DESPESAS FINANCEIRAS NÃO OPERACIONAL': 'despFinanceirasNaoOperacional',
  'DESPESAS FINANCEIRAS NAO OPERACIONAL': 'despFinanceirasNaoOperacional',
  'DESPESAS NÃO OPERACIONAIS': 'despesasNaoOperacionais',
  'DESPESAS NAO OPERACIONAIS': 'despesasNaoOperacionais',
  'OUTRAS RENDAS NÃO OPERACIONAIS': 'outrasRendasNaoOperacionais',
  'OUTRAS RENDAS NAO OPERACIONAIS': 'outrasRendasNaoOperacionais',
  'LUCRO (PREJUIZO) ANTES IMPOSTOS': 'lucroPrejAntesImpostos',
  'PROVISÕES IRPJ E C.S.': 'provisoesIrpjCs',
  'PROVISOES IRPJ E C.S.': 'provisoesIrpjCs',
  'PARTICIPAÇÕES': 'participacoes',
  'PARTICIPACOES': 'participacoes',
  'LUCRO LIQUIDO DO EXERCICIO': 'lucroLiquidoExercicio',
};

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

function sumTotals(
  depts: readonly string[],
  getDept: (key: string) => Record<string, string>,
  field: string,
): number {
  return depts.reduce((sum, deptKey) => {
    if (deptKey === 'adm' && field === 'receitaOperacionalLiquida') return sum;
    return sum + parseVal(getDept(deptKey)[field]);
  }, 0);
}

function getROL(depts: readonly string[], getDept: (key: string) => Record<string, string>): number {
  return sumTotals(depts, getDept, 'receitaOperacionalLiquida');
}

type ResultadoPeriodo = 'mensal' | 'acumulado';
type SubTab = 'resultado' | 'resultado-ajustado';

interface ResultadoBundle {
  vw: DreVwRow;
  audi: DreAudiRow;
}

interface ResumoTabelaProps {
  vwData: DreVwRow | null;
  audiData: DreAudiRow | null;
  periodLabel: string;
  rootId?: string;
  showPrintButton?: boolean;
  onPrint?: () => void;
}

function ResumoTabela({ vwData, audiData, periodLabel, rootId, showPrintButton = false, onPrint }: ResumoTabelaProps) {
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
  const totalROL = vwROL + audiROL;
  const NCOLS = 4;

  return (
    <div id={rootId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div
        className="px-6 py-3 text-white font-bold flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${VW_COLOR} 50%, ${AUDI_COLOR} 100%)` }}
      >
        <div className="flex items-center gap-3">
          <span className="text-base">Resumo — Resultado</span>
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
              <th className="text-center px-4 py-3 font-bold text-sm text-slate-700 min-w-[10rem] bg-slate-100">Total</th>
            </tr>
          </thead>
          <tbody>
            {DRE_LINES.map((line, idx) => {
              if (line.separator) {
                return <tr key={idx}><td colSpan={NCOLS} className="h-px bg-slate-100" /></tr>;
              }

              const isQuant = line.field === 'quant' && idx === 0;
              const vwVal = isQuant
                ? VW_DEPTS.reduce((sum, key) => sum + (parseInt(getVwDept(key).quant || '0') || 0), 0)
                : sumTotals(VW_DEPTS, getVwDept, line.field);
              const audiVal = isQuant
                ? AUDI_DEPTS.reduce((sum, key) => sum + (parseInt(getAudiDept(key).quant || '0') || 0), 0)
                : sumTotals(AUDI_DEPTS, getAudiDept, line.field);
              const totalVal = vwVal + audiVal;

              if (line.isPct) {
                return (
                  <tr key={idx} className="border-b border-slate-100 bg-slate-50/50">
                    <td className="px-4 py-0.5 pl-7 text-[0.68rem] italic text-slate-500">{line.label}</td>
                    <td className="px-4 py-0.5 text-center text-[0.68rem] italic text-slate-500">{pctStr(vwVal, vwROL)}</td>
                    <td className="px-4 py-0.5 text-center text-[0.68rem] italic text-slate-500">{pctStr(audiVal, audiROL)}</td>
                    <td className="px-4 py-0.5 text-center text-[0.68rem] italic text-slate-500 bg-slate-50">{pctStr(totalVal, totalROL)}</td>
                  </tr>
                );
              }

              const fmtVal = (value: number) =>
                isQuant
                  ? (value > 0 ? value.toString() : '—')
                  : (value !== 0 ? value.toLocaleString('pt-BR') : '—');

              const rowClass = line.isTotal
                ? 'font-bold text-white'
                : line.isSubtotal
                ? 'bg-slate-100 font-semibold text-slate-800'
                : 'hover:bg-slate-50 text-slate-700';

              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`}>
                  <td
                    className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''} ${line.isTotal ? 'text-white' : ''}`}
                    style={line.isTotal ? { backgroundColor: VW_COLOR } : undefined}
                  >
                    {line.label}
                  </td>
                  <td
                    className="px-4 py-1.5 text-center tabular-nums"
                    style={{ backgroundColor: line.isTotal ? VW_COLOR_DRK : undefined, color: line.isTotal ? 'white' : undefined }}
                  >
                    {fmtVal(vwVal)}
                  </td>
                  <td
                    className="px-4 py-1.5 text-center tabular-nums"
                    style={{ backgroundColor: line.isTotal ? AUDI_COLOR_DRK : undefined, color: line.isTotal ? 'white' : undefined }}
                  >
                    {fmtVal(audiVal)}
                  </td>
                  <td
                    className={`px-4 py-1.5 text-center tabular-nums font-medium bg-slate-50 ${line.isTotal ? 'text-white' : 'text-slate-700'}`}
                    style={line.isTotal ? { backgroundColor: TOTAL_COLOR } : undefined}
                  >
                    {fmtVal(totalVal)}
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

function ResultadoTab({ year, month, periodo }: { year: number; month: number; periodo: ResultadoPeriodo }) {
  const [loading, setLoading] = useState(true);
  const [mensalData, setMensalData] = useState<ResultadoBundle | null>(null);
  const [acumuladoData, setAcumuladoData] = useState<ResultadoBundle | null>(null);

  useEffect(() => {
    setLoading(true);
    const selectedMonth = month === 0 ? 12 : month;
    const yr = year as 2024 | 2025 | 2026 | 2027;

    async function loadAccumulated(untilMonth: number): Promise<ResultadoBundle> {
      const vwSyncable = VW_DEPTS.filter(key => VW_DEPT_TO_EXEC[key]);
      const audiSyncable = AUDI_DEPTS.filter(key => AUDI_DEPT_TO_EXEC[key]);
      const monthsToLoad = Array.from({ length: untilMonth }, (_, i) => i + 1);
      const deptFields = [
        'quant', 'receitaOperacionalLiquida', 'custoOperacionalReceita',
        'lucroPrejOperacionalBruto', 'outrasReceitasOperacionais', 'outrasDespesasOperacionais',
        'margemContribuicao', 'despPessoal', 'despServTerceiros', 'despOcupacao', 'despFuncionamento',
        'despVendas', 'lucroPrejOperacionalLiquido', 'amortizacoesDepreciacoes',
        'outrasReceitasFinanceiras', 'despFinanceirasNaoOperacional', 'despesasNaoOperacionais',
        'outrasRendasNaoOperacionais', 'lucroPrejAntesImpostos', 'provisoesIrpjCs',
        'participacoes', 'lucroLiquidoExercicio',
      ] as const;

      const [vwMonths, audiMonths, vwExec, audiExec] = await Promise.all([
        Promise.all(monthsToLoad.map(m => loadDreVw(year, m))),
        Promise.all(monthsToLoad.map(m => loadDreAudi(year, m))),
        Promise.all(vwSyncable.map(key => loadDREDataAsync(yr, VW_DEPT_TO_EXEC[key]!, 'vw').then(data => ({ key, data })))),
        Promise.all(audiSyncable.map(key => loadDREDataAsync(yr, AUDI_DEPT_TO_EXEC[key]!, 'audi').then(data => ({ key, data })))),
      ]);

      const vwExecMap: Record<string, any[] | null> = {};
      for (const { key, data } of vwExec) vwExecMap[key] = data;
      const audiExecMap: Record<string, any[] | null> = {};
      for (const { key, data } of audiExec) audiExecMap[key] = data;

      function buildRow(
        kvMonths: (DreVwRow | DreAudiRow | null)[],
        depts: readonly string[],
        execMap: Record<string, any[] | null>,
        emptyFn: () => DreVwRow | DreAudiRow,
      ) {
        const summed = emptyFn();
        for (let monthIndex = 0; monthIndex < monthsToLoad.length; monthIndex++) {
          const kv = kvMonths[monthIndex];
          for (const deptKey of depts) {
            const kvDept = (kv as any)?.[deptKey] as Record<string, string> | undefined;
            const hasKv = kvDept && Object.values(kvDept).some(value => value !== '');
            const source = hasKv ? kvDept : buildDeptFromDREData(execMap[deptKey] ?? null, monthIndex);
            for (const field of deptFields) {
              const prev = parseVal((summed as any)[deptKey][field]);
              const add = parseVal(source[field] ?? '');
              if (add !== 0) (summed as any)[deptKey][field] = (prev + add).toString();
            }
          }
        }
        return summed;
      }

      return {
        vw: buildRow(vwMonths, VW_DEPTS, vwExecMap, () => createEmptyDreVwRow(year, 0)) as DreVwRow,
        audi: buildRow(audiMonths, AUDI_DEPTS, audiExecMap, () => createEmptyDreAudiRow(year, 0)) as DreAudiRow,
      };
    }

    async function loadMensal(targetMonth: number): Promise<ResultadoBundle> {
      const monthIndex = targetMonth - 1;
      const vwSyncable = VW_DEPTS.filter(key => VW_DEPT_TO_EXEC[key]);
      const audiSyncable = AUDI_DEPTS.filter(key => AUDI_DEPT_TO_EXEC[key]);

      const [vwKv, audiKv, vwExec, audiExec] = await Promise.all([
        loadDreVw(year, targetMonth),
        loadDreAudi(year, targetMonth),
        Promise.all(vwSyncable.map(key => loadDREDataAsync(yr, VW_DEPT_TO_EXEC[key]!, 'vw').then(data => ({ key, data })))),
        Promise.all(audiSyncable.map(key => loadDREDataAsync(yr, AUDI_DEPT_TO_EXEC[key]!, 'audi').then(data => ({ key, data })))),
      ]);

      const vwExecMap: Record<string, any[] | null> = {};
      for (const { key, data } of vwExec) vwExecMap[key] = data;
      const audiExecMap: Record<string, any[] | null> = {};
      for (const { key, data } of audiExec) audiExecMap[key] = data;

      function mergeRow(
        kv: DreVwRow | DreAudiRow | null,
        depts: readonly string[],
        execMap: Record<string, any[] | null>,
        emptyFn: () => DreVwRow | DreAudiRow,
      ) {
        const row = emptyFn();
        for (const deptKey of depts) {
          const kvDept = (kv as any)?.[deptKey] as Record<string, string> | undefined;
          const hasKv = kvDept && Object.values(kvDept).some(value => value !== '');
          const source = hasKv ? kvDept : buildDeptFromDREData(execMap[deptKey] ?? null, monthIndex);
          (row as any)[deptKey] = { ...(row as any)[deptKey], ...source };
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
    const printSource = document.getElementById('resumo-marcas-print-both');
    const root = document.getElementById('print-root');
    if (!printSource || !root) {
      window.print();
      return;
    }

    const clone = printSource.cloneNode(true) as HTMLElement;
    clone.style.display = 'block';
    root.innerHTML = clone.outerHTML;

    const style = document.createElement('style');
    style.id = 'resumo-print-override';
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

  if (periodo === 'mensal' && month === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center">
        <p className="text-sm text-slate-500">Selecione um mês para visualizar o resumo mensal.</p>
      </div>
    );
  }

  return (
    <>
      <ResumoTabela
        rootId="resumo-marcas-print-area"
        vwData={activeBundle?.vw ?? null}
        audiData={activeBundle?.audi ?? null}
        periodLabel={activeLabel}
        showPrintButton
        onPrint={handlePrintBoth}
      />

      <div id="resumo-marcas-print-both" style={{ display: 'none' }}>
        {month !== 0 && mensalData && (
          <div className="print-page">
            <ResumoTabela
              vwData={mensalData.vw}
              audiData={mensalData.audi}
              periodLabel={mensalLabel}
            />
          </div>
        )}
        {acumuladoData && (
          <div className="print-page">
            <ResumoTabela
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

function ResultadoAjustadoTab() {
  return (
    <div className="flex items-center justify-center py-32 text-slate-400">
      <p className="text-sm">Em construção</p>
    </div>
  );
}

interface Props {
  year: number;
  month: number;
}

export function ResumoMarcasTab({ year, month }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('resultado');
  const [resultadoPeriodo, setResultadoPeriodo] = useState<ResultadoPeriodo>('mensal');

  const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const periodLabel = month === 0 ? `Ano ${year}` : `${monthsShort[month - 1]}/${year}`;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-[1440px] mx-auto p-4 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Resumo</h2>
          <p className="text-sm text-slate-500">{periodLabel} — VW Norte + Audi</p>
        </div>

        <div className="flex gap-2">
          {([
            ['resultado', 'Resultado'],
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
