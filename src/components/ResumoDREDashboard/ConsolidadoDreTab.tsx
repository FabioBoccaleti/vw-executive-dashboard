import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, RefreshCw, Printer } from 'lucide-react';
import {
  loadDreVw,
  createEmptyDreVwRow,
  migrateVwAjustes,
  type DreVwRow,
  type DreVwDept,
  type VwAjusteRow,
} from './dreVwStorage';
import {
  loadDreAudi,
  migrateAjustes,
  type DreAudiRow,
  type DreAudiDept,
} from './dreAudiStorage';
import { loadDREDataAsync } from '@/lib/dbStorage';
import type { Department } from '@/lib/dataStorage';

// ─── Cor principal Consolidado ────────────────────────────────────────────────
const CON_COLOR     = '#7c3aed'; // lilás
const CON_COLOR_DRK = '#5b21b6'; // lilás mais escuro (célula total)

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

function fmtNum(v: string): string {
  const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
  if (isNaN(n)) return v;
  return n.toLocaleString('pt-BR');
}

function sumDeptsArr(depts: DreVwDept[], field: keyof DreVwDept): string {
  const total = depts.reduce((acc, d) => {
    const v = parseFloat(String(d[field]).replace(/\./g, '').replace(',', '.'));
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
  if (total === 0) return '';
  return total.toLocaleString('pt-BR');
}

function getPrevPeriods(year: number, month: number, count: number): { year: number; month: number }[] {
  const periods: { year: number; month: number }[] = [];
  let y = year, m = month;
  for (let i = 0; i < count; i++) {
    m--; if (m < 1) { m = 12; y--; }
    periods.unshift({ year: y, month: m });
  }
  return periods;
}

function parseVal(v: string | number | undefined): number {
  return parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
}

// ─── Linhas da tabela DRE ─────────────────────────────────────────────────────

interface DreLineConfig {
  label: string;
  field: keyof DreVwDept;
  isBold?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
  indent?: boolean;
  separator?: boolean;
}

const DRE_LINES: DreLineConfig[] = [
  { label: 'Volume de Vendas',                           field: 'quant' },
  { label: '',                                            field: 'quant',                         separator: true },
  { label: 'Receita Operacional Líquida',                field: 'receitaOperacionalLiquida',      isBold: true },
  { label: '(-) Custo Operacional da Receita',           field: 'custoOperacionalReceita',        indent: true },
  { label: 'Lucro (Prejuízo) Operacional Bruto',         field: 'lucroPrejOperacionalBruto',      isSubtotal: true },
  { label: 'Outras Receitas Operacionais',               field: 'outrasReceitasOperacionais',     indent: true },
  { label: '(-) Outras Despesas Operacionais',           field: 'outrasDespesasOperacionais',     indent: true },
  { label: 'MARGEM DE CONTRIBUIÇÃO',                     field: 'margemContribuicao',             isTotal: true },
  { label: '',                                            field: 'margemContribuicao',             separator: true },
  { label: '(-) Despesas c/ Pessoal',                    field: 'despPessoal',                    indent: true },
  { label: '(-) Despesas c/ Serv. de Terceiros',         field: 'despServTerceiros',              indent: true },
  { label: '(-) Despesas c/ Ocupação',                   field: 'despOcupacao',                   indent: true },
  { label: '(-) Despesas c/ Funcionamento',              field: 'despFuncionamento',              indent: true },
  { label: '(-) Despesas c/ Vendas',                     field: 'despVendas',                     indent: true },
  { label: 'LUCRO (PREJUÍZO) OPERACIONAL LÍQUIDO',       field: 'lucroPrejOperacionalLiquido',    isTotal: true },
  { label: '',                                            field: 'lucroPrejOperacionalLiquido',    separator: true },
  { label: 'Amortizações e Depreciações',                field: 'amortizacoesDepreciacoes',       indent: true },
  { label: 'Outras Receitas Financeiras',                field: 'outrasReceitasFinanceiras',      indent: true },
  { label: '(-) Despesas Financeiras Não Operacional',   field: 'despFinanceirasNaoOperacional',  indent: true },
  { label: '(-) Despesas Não Operacionais',              field: 'despesasNaoOperacionais',        indent: true },
  { label: 'Outras Rendas Não Operacionais',             field: 'outrasRendasNaoOperacionais',    indent: true },
  { label: 'Lucro (Prejuízo) Antes dos Impostos',        field: 'lucroPrejAntesImpostos',         isSubtotal: true },
  { label: '(-) Provisões IRPJ e C.S.',                  field: 'provisoesIrpjCs',                indent: true },
  { label: '(-) Participações',                          field: 'participacoes',                  indent: true },
  { label: 'LUCRO LÍQUIDO DO EXERCÍCIO',                 field: 'lucroLiquidoExercicio',          isTotal: true },
];

// ─── Departamentos Consolidado ────────────────────────────────────────────────

type DeptKey = 'novos' | 'usados' | 'direta' | 'pecas' | 'oficina' | 'funilaria' | 'adm';

const DEPTS: { key: DeptKey; label: string; color: string }[] = [
  { key: 'novos',     label: 'Veículos Novos',             color: '#1d4ed8' },
  { key: 'direta',    label: 'Venda Direta (VW)',          color: '#0891b2' },
  { key: 'usados',    label: 'Veículos Usados',            color: '#7c3aed' },
  { key: 'pecas',     label: 'Peças e Acessórios',         color: '#059669' },
  { key: 'oficina',   label: 'Oficina / Assist. Técnica',  color: '#d97706' },
  { key: 'funilaria', label: 'Funilaria',                  color: '#db2777' },
  { key: 'adm',       label: 'Administração',              color: '#64748b' },
];

// Mapeamento DeptKey → Department para sincronização via DREDataAsync
const DEPT_TO_DEPT_KEY: Partial<Record<DeptKey, Department>> = {
  novos:     'novos',
  usados:    'usados',
  pecas:     'pecas',
  oficina:   'oficina',
  funilaria: 'funilaria',
  adm:       'administracao',
};

// ─── Lógica de Consolidação ───────────────────────────────────────────────────

const DEPT_FIELDS: (keyof DreVwDept)[] = [
  'quant','receitaOperacionalLiquida','custoOperacionalReceita',
  'lucroPrejOperacionalBruto','outrasReceitasOperacionais','outrasDespesasOperacionais',
  'margemContribuicao','despPessoal','despServTerceiros','despOcupacao','despFuncionamento',
  'despVendas','lucroPrejOperacionalLiquido','amortizacoesDepreciacoes',
  'outrasReceitasFinanceiras','despFinanceirasNaoOperacional','despesasNaoOperacionais',
  'outrasRendasNaoOperacionais','lucroPrejAntesImpostos','provisoesIrpjCs',
  'participacoes','lucroLiquidoExercicio',
];

function sumDept(vw: DreVwDept, audi: DreAudiDept | null): DreVwDept {
  const result = { ...vw };
  for (const field of DEPT_FIELDS) {
    const v = parseVal(vw[field]);
    const a = audi ? parseVal((audi as Record<string, string>)[field] ?? '') : 0;
    const total = v + a;
    result[field] = total !== 0 ? total.toString() : '';
  }
  return result;
}

function consolidateRows(vwRow: DreVwRow, audiRow: DreAudiRow | null): DreVwRow {
  // Combina ajustes dos dois (same ID → soma; ID único → mantém)
  const allIds = new Set([
    ...vwRow.ajustes.map(r => r.id),
    ...(audiRow?.ajustes ?? []).map(r => r.id),
  ]);
  const consolidatedAjustes: VwAjusteRow[] = Array.from(allIds).map(id => {
    const vwA = vwRow.ajustes.find(r => r.id === id);
    const audA = audiRow?.ajustes.find(r => r.id === id);
    const label = vwA?.label ?? audA?.label ?? '';
    function s(a?: string, b?: string) {
      const t = parseVal(a) + parseVal(b);
      return t !== 0 ? t.toString() : '';
    }
    return {
      id,
      label,
      values: {
        novos:     s(vwA?.values.novos,     audA?.values.novos),
        usados:    s(vwA?.values.usados,    audA?.values.usados),
        direta:    vwA?.values.direta ?? '',
        pecas:     s(vwA?.values.pecas,     audA?.values.pecas),
        oficina:   s(vwA?.values.oficina,   audA?.values.oficina),
        funilaria: s(vwA?.values.funilaria, audA?.values.funilaria),
        adm:       s(vwA?.values.adm,       audA?.values.adm),
      },
    };
  });

  return {
    periodo: vwRow.periodo,
    novos:     sumDept(vwRow.novos,     audiRow?.novos     ?? null),
    usados:    sumDept(vwRow.usados,    audiRow?.usados    ?? null),
    direta:    vwRow.direta,  // VW only
    pecas:     sumDept(vwRow.pecas,     audiRow?.pecas     ?? null),
    oficina:   sumDept(vwRow.oficina,   audiRow?.oficina   ?? null),
    funilaria: sumDept(vwRow.funilaria, audiRow?.funilaria ?? null),
    adm:       sumDept(vwRow.adm,       audiRow?.adm       ?? null),
    ajustes: consolidatedAjustes,
  };
}

// ─── Mapeamento descricao → campo (para DREDataAsync) ─────────────────────────

const DESCRICAO_TO_FIELD: Record<string, keyof DreVwDept> = {
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

function buildDeptFromDREData(dreData: any[] | null, monthIndex: number): DreVwDept {
  const dept = createEmptyDreVwRow(0, 0).novos;
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

function hasDeptData(dept: DreVwDept): boolean {
  return Object.values(dept).some(v => v !== '');
}

// ─── Componente Principal ────────────────────────────────────────────────────

interface ConsolidadoDreTabProps {
  year: number;
  month: number;
  diasUteis?: number;
}

export function ConsolidadoDreTab({ year, month }: ConsolidadoDreTabProps) {
  const [data, setData]       = useState<DreVwRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'resumo' | DeptKey | 'ajustes'>('resumo');
  const [prevData, setPrevData] = useState<DreVwRow[]>([]);
  const [annualView, setAnnualView] = useState<'anual' | 'mensal'>('anual');
  const [allMonthRows, setAllMonthRows] = useState<DreVwRow[]>(
    Array.from({ length: 12 }, (_, i) => createEmptyDreVwRow(0, i + 1))
  );

  useEffect(() => {
    setLoading(true);

    // ── MODO ANUAL ────────────────────────────────────────────────────────────
    if (month === 0) {
      const yr = year as 2024 | 2025 | 2026 | 2027;
      const syncable = DEPTS.filter(d => DEPT_TO_DEPT_KEY[d.key]);
      Promise.all([
        Promise.all(Array.from({ length: 12 }, (_, i) => loadDreVw(year, i + 1))),
        Promise.all(Array.from({ length: 12 }, (_, i) => loadDreAudi(year, i + 1))),
        Promise.all(syncable.flatMap(d => [
          loadDREDataAsync(yr, DEPT_TO_DEPT_KEY[d.key]!, 'vw').then(dre => ({ brand: 'vw' as const, deptKey: d.key as DeptKey, dre })),
          loadDREDataAsync(yr, DEPT_TO_DEPT_KEY[d.key]!, 'audi').then(dre => ({ brand: 'audi' as const, deptKey: d.key as DeptKey, dre })),
        ])),
      ]).then(([vwKvs, audiKvs, dreResults]) => {
        const dreLk: Record<string, Record<string, any[] | null>> = {};
        for (const { brand, deptKey, dre } of dreResults) {
          dreLk[brand] ??= {};
          dreLk[brand][deptKey] = dre;
        }
        function buildVwMonth(m: number, kv: DreVwRow | null): DreVwRow {
          const row = createEmptyDreVwRow(year, m);
          for (const d of DEPTS) {
            if (!DEPT_TO_DEPT_KEY[d.key]) { if (kv) row[d.key] = kv[d.key]; continue; }
            if (kv && hasDeptData(kv[d.key])) row[d.key] = kv[d.key];
            else if (dreLk['vw']?.[d.key]) row[d.key] = buildDeptFromDREData(dreLk['vw'][d.key], m - 1);
          }
          if (kv) row.ajustes = migrateVwAjustes(kv.ajustes);
          return row;
        }
        function buildAudiMonth(m: number, kv: DreAudiRow | null): DreAudiRow | null {
          const hasAny = syncable.some(d => dreLk['audi']?.[d.key]);
          if (!kv && !hasAny) return null;
          const row: DreAudiRow = kv
            ? { ...kv, ajustes: migrateAjustes(kv.ajustes) }
            : { periodo: `${year}-${String(m).padStart(2,'0')}`, novos: emptyAudiDept(), usados: emptyAudiDept(), pecas: emptyAudiDept(), oficina: emptyAudiDept(), funilaria: emptyAudiDept(), adm: emptyAudiDept(), ajustes: [] };
          const audiDepts = ['novos','usados','pecas','oficina','funilaria','adm'] as const;
          for (const dk of audiDepts) {
            if (!kv || !hasDeptData(row[dk] as unknown as DreVwDept)) {
              if (dreLk['audi']?.[dk]) (row[dk] as any) = buildDeptFromDREData(dreLk['audi'][dk], m - 1);
            }
          }
          return row;
        }
        const monthRows = Array.from({ length: 12 }, (_, i) => {
          const vwRow   = buildVwMonth(i + 1, vwKvs[i] ?? null);
          const audiRow = buildAudiMonth(i + 1, audiKvs[i] ?? null);
          return consolidateRows(vwRow, audiRow);
        });
        setAllMonthRows(monthRows);
        const summed = createEmptyDreVwRow(year, 0);
        for (const row of monthRows) {
          for (const d of DEPTS) {
            for (const f of DEPT_FIELDS) {
              const t = parseVal(summed[d.key][f]) + parseVal(row[d.key][f]);
              if (t !== 0) summed[d.key][f] = t.toString();
            }
          }
          for (const adj of row.ajustes) {
            const ex = summed.ajustes.find(a => a.id === adj.id);
            if (ex) { for (const d of DEPTS) { const t = parseVal(ex.values[d.key]) + parseVal(adj.values[d.key]); if (t !== 0) ex.values[d.key] = t.toString(); } }
            else summed.ajustes.push({ ...adj, values: { ...adj.values } });
          }
        }
        setData(summed);
        setLoading(false);
      });
      return;
    }

    // ── MODO MENSAL ───────────────────────────────────────────────────────────
    const periods = getPrevPeriods(year, month, 3);
    const allPeriods = [...periods, { year, month }];
    const uniqueYears = [...new Set(allPeriods.map(p => p.year))] as Array<2024 | 2025 | 2026 | 2027>;

    const syncableDepts = DEPTS.filter(d => DEPT_TO_DEPT_KEY[d.key]);

    // Carrega DRE data do Dashboard Executivo para VW e Audi (fallback)
    const deptDrePromises = syncableDepts.flatMap(d =>
      uniqueYears.flatMap(y => [
        loadDREDataAsync(y, DEPT_TO_DEPT_KEY[d.key]!, 'vw')
          .then(dre => ({ brand: 'vw' as const, deptKey: d.key as DeptKey, year: y, dre })),
        loadDREDataAsync(y, DEPT_TO_DEPT_KEY[d.key]!, 'audi')
          .then(dre => ({ brand: 'audi' as const, deptKey: d.key as DeptKey, year: y, dre })),
      ])
    );

    // Carrega KV de VW e Audi para período atual e períodos anteriores
    const vwPromises   = allPeriods.map(p => loadDreVw(p.year, p.month));
    const audiPromises = allPeriods.map(p => loadDreAudi(p.year, p.month));

    Promise.all([
      Promise.all(vwPromises),
      Promise.all(audiPromises),
      Promise.all(deptDrePromises),
    ]).then(([vwResults, audiResults, dreResults]) => {
      // Montar lookup de DRE data: brand → deptKey → year → data
      const dreLookup: Record<string, Record<string, Record<number, any[] | null>>> = {};
      for (const { brand, deptKey, year: y, dre } of dreResults) {
        dreLookup[brand] ??= {};
        dreLookup[brand][deptKey] ??= {};
        dreLookup[brand][deptKey][y] = dre;
      }

      function buildVwRow(y: number, m: number, kvRow: DreVwRow | null): DreVwRow {
        const row = createEmptyDreVwRow(y, m);
        for (const d of DEPTS) {
          if (!DEPT_TO_DEPT_KEY[d.key]) { // 'direta' → VW only, usa KV direto
            if (kvRow) row[d.key] = kvRow[d.key];
            continue;
          }
          if (kvRow && hasDeptData(kvRow[d.key])) {
            row[d.key] = kvRow[d.key];
          } else if (dreLookup['vw']?.[d.key]?.[y]) {
            row[d.key] = buildDeptFromDREData(dreLookup['vw'][d.key][y], m - 1);
          }
        }
        if (kvRow) row.ajustes = migrateVwAjustes(kvRow.ajustes);
        return row;
      }

      function buildAudiRow(y: number, m: number, kvRow: DreAudiRow | null): DreAudiRow | null {
        if (!kvRow) {
          // Tenta construir com DRE data
          const hasSomeDreData = syncableDepts.some(
            d => dreLookup['audi']?.[d.key]?.[y]
          );
          if (!hasSomeDreData) return null;
        }
        // Cria row base a partir do KV ou vazio
        const row: DreAudiRow = kvRow
          ? {
              ...kvRow,
              ajustes: migrateAjustes(kvRow.ajustes),
            }
          : {
              periodo: `${y}-${String(m).padStart(2, '0')}`,
              novos: emptyAudiDept(), usados: emptyAudiDept(), pecas: emptyAudiDept(),
              oficina: emptyAudiDept(), funilaria: emptyAudiDept(), adm: emptyAudiDept(),
              ajustes: [],
            };
        // Fallback para DRE data para depts sem KV
        const audiDepts = ['novos', 'usados', 'pecas', 'oficina', 'funilaria', 'adm'] as const;
        for (const dk of audiDepts) {
          if (!kvRow || !hasDeptData(row[dk] as unknown as DreVwDept)) {
            if (dreLookup['audi']?.[dk]?.[y]) {
              (row[dk] as any) = buildDeptFromDREData(dreLookup['audi'][dk][y], m - 1);
            }
          }
        }
        return row;
      }

      const [currentVw,   ...prevVwArr]   = vwResults;
      const [currentAudi, ...prevAudiArr] = audiResults;

      const currentVwRow   = buildVwRow(year, month, currentVw ?? null);
      const currentAudiRow = buildAudiRow(year, month, currentAudi ?? null);
      setData(consolidateRows(currentVwRow, currentAudiRow));

      const prevRows = periods.map((p, i) => {
        const vwRow   = buildVwRow(p.year, p.month, prevVwArr[i] ?? null);
        const audiRow = buildAudiRow(p.year, p.month, prevAudiArr[i] ?? null);
        return consolidateRows(vwRow, audiRow);
      });
      setPrevData(prevRows);
      setLoading(false);
    });
  }, [year, month]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Carregando dados consolidados...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const deptList = DEPTS.map(d => data[d.key]);

  return (
    <div className="flex flex-col gap-0 flex-1">

      {/* ── Sub-navegação ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveSection('resumo')}
          className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors"
          style={activeSection === 'resumo'
            ? { borderBottomColor: CON_COLOR, color: CON_COLOR }
            : { borderBottomColor: 'transparent', color: '#64748b' }
          }
        >
          Resumo Geral
        </button>
        {DEPTS.map(d => (
          <button
            key={d.key}
            onClick={() => setActiveSection(d.key)}
            className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors"
            style={activeSection === d.key
              ? { borderBottomColor: CON_COLOR, color: CON_COLOR }
              : { borderBottomColor: 'transparent', color: '#64748b' }
            }
          >
            {d.label}
          </button>
        ))}
        <button
          onClick={() => setActiveSection('ajustes')}
          className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors"
          style={activeSection === 'ajustes'
            ? { borderBottomColor: CON_COLOR, color: CON_COLOR }
            : { borderBottomColor: 'transparent', color: '#64748b' }
          }
        >
          Ajustes
        </button>

        <div className="flex-1" />

        {/* Badge de sincronização */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-[0.65rem] font-medium mr-2">
          <RefreshCw className="w-3 h-3" />
          VW + Audi consolidados
        </div>

        {/* Botão Imprimir PDF */}
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors my-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200"
        >
          <Printer className="w-3.5 h-3.5" />
          Imprimir PDF
        </button>
      </div>

      {/* ── Conteúdo ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">

        {activeSection === 'resumo' && month !== 0 && (
          <ResumoTable data={data} deptList={deptList} year={year} month={month} />
        )}
        {activeSection === 'resumo' && month === 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setAnnualView('anual')}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={annualView === 'anual' ? { backgroundColor: CON_COLOR, color: 'white' } : { backgroundColor: '#f1f5f9', color: '#64748b' }}
              >Resultado Anual</button>
              <button
                onClick={() => setAnnualView('mensal')}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={annualView === 'mensal' ? { backgroundColor: CON_COLOR, color: 'white' } : { backgroundColor: '#f1f5f9', color: '#64748b' }}
              >Evolução Mensal</button>
            </div>
            {annualView === 'anual' && <ResumoTable data={data} deptList={deptList} year={year} month={0} />}
            {annualView === 'mensal' && <ConEvolucaoMensalTable allMonthRows={allMonthRows} year={year} />}
          </div>
        )}

        {DEPTS.map(d =>
          activeSection === d.key ? (
            month === 0
              ? <ConDeptEvolucaoTable key={d.key} deptKey={d.key} deptLabel={d.label} allMonthRows={allMonthRows} year={year} />
              : <DeptTable key={d.key} deptLabel={d.label} deptKey={d.key} dept={data[d.key]} prevDepts={prevData.map(row => row[d.key])} prevPeriods={getPrevPeriods(year, month, 3)} year={year} month={month} />
          ) : null
        )}

        {activeSection === 'ajustes' && (
          <AjustesTable data={data} year={year} month={month} />
        )}
      </div>

      {/* ── Portal de Impressão ──────────────────────────────────────────── */}
      {typeof document !== 'undefined' && document.getElementById('print-root') &&
        createPortal(
          <PrintableReport data={data} prevData={prevData} year={year} month={month} />,
          document.getElementById('print-root')!
        )
      }
    </div>
  );
}

// ─── Helpers de estrutura vazia ───────────────────────────────────────────────

function emptyAudiDept(): DreAudiDept {
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

// ─── Tabela Resumo Geral ──────────────────────────────────────────────────────

function ResumoTable({ data, deptList, year, month }: {
  data: DreVwRow; deptList: DreVwDept[]; year: number; month: number;
}) {
  const NCOLS = DEPTS.length + 2;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="text-white px-6 py-3" style={{ backgroundColor: CON_COLOR }}>
        <h2 className="font-bold text-base">CONSOLIDADO — VW + AUDI</h2>
        <p className="text-xs mt-0.5 opacity-80">{month === 0 ? `Ano ${year}` : `${MONTHS[month - 1]} de ${year}`} — Demonstrativo de Resultados</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-200" style={{ borderBottom: `2px solid ${CON_COLOR}` }}>
              <th className="text-left px-4 py-3 font-bold text-slate-800 text-sm w-52 min-w-[13rem]">Descrição</th>
              {DEPTS.map(d => (
                <th key={d.key} className="text-center px-3 py-3 font-bold text-sm min-w-[8rem] text-slate-800">
                  {d.label}
                </th>
              ))}
              <th className="text-center px-3 py-3 font-bold text-sm text-slate-800 min-w-[8rem] bg-slate-300">Total</th>
            </tr>
          </thead>
          <tbody>
            {DRE_LINES.map((line, idx) => {
              if (line.separator) {
                return <tr key={idx}><td colSpan={NCOLS} className="h-px bg-slate-100" /></tr>;
              }
              const isQuant = line.field === 'quant' && idx === 0;
              const rowStyle = line.isTotal ? { backgroundColor: CON_COLOR } : undefined;
              const rowClass = line.isTotal
                ? 'text-white font-bold'
                : line.isSubtotal
                ? 'bg-slate-100 font-semibold text-black'
                : 'hover:bg-slate-50 text-black';

              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`} style={rowStyle}>
                  <td className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''}`}>{line.label}</td>
                  {DEPTS.map(d => {
                    const val = data[d.key][line.field];
                    const display = isQuant
                      ? ((parseInt(String(val)) || 0) > 0 ? String(parseInt(String(val))) : '—')
                      : (parseVal(val) !== 0 ? parseVal(val).toLocaleString('pt-BR') : '—');
                    return <td key={d.key} className="px-3 py-1.5 text-right">{display}</td>;
                  })}
                  <td
                    className={`px-3 py-1.5 text-right font-semibold ${line.isTotal ? 'text-white' : 'bg-slate-50 text-black'}`}
                    style={line.isTotal ? { backgroundColor: CON_COLOR_DRK } : undefined}
                  >
                    {isQuant
                      ? (() => { const t = deptList.reduce((s, dep) => s + (parseInt(dep.quant) || 0), 0); return t > 0 ? t.toString() : '—'; })()
                      : (() => { const s = sumDeptsArr(deptList, line.field); return s ? fmtNum(s) : '—'; })()
                    }
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

// ─── Tabela por Departamento ──────────────────────────────────────────────────

function DeptTable({ deptLabel, deptKey, dept, prevDepts, prevPeriods, year, month }: {
  deptLabel: string; deptKey: DeptKey;
  dept: DreVwDept; prevDepts: DreVwDept[];
  prevPeriods: { year: number; month: number }[];
  year: number; month: number;
}) {
  const totalCols = 1 + prevPeriods.length + 1 + 1 + 1;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-3 text-white font-bold flex items-center gap-3" style={{ backgroundColor: CON_COLOR }}>
        <span className="text-base">Consolidado — {deptLabel}</span>
        <span className="text-xs opacity-75 font-normal">{MONTHS[month - 1]}/{year}</span>
        {deptKey === 'direta' && (
          <span className="text-[0.65rem] opacity-75 font-normal ml-1">(VW Norte somente)</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-200" style={{ borderBottom: `2px solid ${CON_COLOR}` }}>
              <th className="text-left px-4 py-3 font-bold text-sm text-slate-800 w-52 min-w-[13rem]">Descrição</th>
              {prevPeriods.map(p => (
                <th key={`${p.year}-${p.month}`} className="text-center px-3 py-3 font-bold text-sm text-slate-800 min-w-[8rem]">
                  {MONTHS[p.month - 1]}/{p.year}
                </th>
              ))}
              <th className="text-center px-3 py-3 font-bold text-sm text-slate-800 min-w-[8rem]">
                {MONTHS[month - 1]}/{year}
              </th>
              <th className="text-center px-2 py-3 font-bold text-sm text-slate-800 min-w-[5.5rem] bg-slate-300 border-l border-slate-400">Var. M/M</th>
              <th className="text-center px-3 py-3 font-bold text-sm text-slate-800 min-w-[8rem] bg-slate-300">Total</th>
            </tr>
          </thead>
          <tbody>
            {DRE_LINES.map((line, idx) => {
              if (line.separator) {
                return <tr key={idx}><td colSpan={totalCols} className="h-px bg-slate-100" /></tr>;
              }
              const isQuant = line.field === 'quant' && idx === 0;
              const rowStyle = line.isTotal ? { backgroundColor: CON_COLOR } : undefined;
              const rowClass = line.isTotal
                ? 'text-white font-bold'
                : line.isSubtotal
                ? 'bg-slate-100 font-semibold text-black'
                : 'hover:bg-slate-50 text-black';

              const prevDept = prevDepts[prevDepts.length - 1];
              let varMM = '';
              if (prevDept) {
                if (isQuant) {
                  const cur = parseInt(String(dept[line.field])) || 0;
                  const prv = parseInt(String(prevDept[line.field])) || 0;
                  if (prv !== 0) { const pct = ((cur - prv) / Math.abs(prv)) * 100; varMM = (pct >= 0 ? '+' : '') + pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
                } else {
                  const cur = parseVal(dept[line.field]), prv = parseVal(prevDept[line.field]);
                  if (prv !== 0) { const pct = ((cur - prv) / Math.abs(prv)) * 100; varMM = (pct >= 0 ? '+' : '') + pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
                }
              }

              const allDepts = [...prevDepts, dept];
              let totalStr: string;
              if (isQuant) {
                const t = allDepts.reduce((s, d) => s + (parseInt(String(d.quant)) || 0), 0);
                totalStr = t > 0 ? t.toString() : '—';
              } else {
                const t = allDepts.reduce((s, d) => s + parseVal(d[line.field]), 0);
                totalStr = t !== 0 ? t.toLocaleString('pt-BR') : '—';
              }

              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`} style={rowStyle}>
                  <td className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''}`}>{line.label}</td>
                  {prevDepts.map((pd, pi) => {
                    const v = pd[line.field];
                    const num = isQuant ? (parseInt(String(v)) || 0) : parseVal(v);
                    const display = isQuant ? (num > 0 ? num.toString() : '—') : (num !== 0 ? num.toLocaleString('pt-BR') : '—');
                    return <td key={pi} className="px-3 py-1.5 text-right">{display}</td>;
                  })}
                  <td className="px-3 py-1.5 text-right">
                    {isQuant
                      ? ((parseInt(String(dept[line.field])) || 0) > 0 ? String(parseInt(String(dept[line.field]))) : '—')
                      : (parseVal(dept[line.field]) !== 0 ? parseVal(dept[line.field]).toLocaleString('pt-BR') : '—')
                    }
                  </td>
                  <td className="px-2 py-1.5 text-right text-[0.68rem] border-l border-slate-200">{varMM || '—'}</td>
                  <td
                    className={`px-3 py-1.5 text-right font-semibold ${line.isTotal ? 'text-white' : 'bg-slate-50 text-black'}`}
                    style={line.isTotal ? { backgroundColor: CON_COLOR_DRK } : undefined}
                  >
                    {totalStr}
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

// ─── Tabela de Ajustes (somente leitura) ─────────────────────────────────────

function AjustesTable({ data, year, month }: { data: DreVwRow; year: number; month: number }) {
  const deptList = DEPTS.map(d => data[d.key]);
  const totalLiquido = sumDeptsArr(deptList, 'lucroLiquidoExercicio');
  const totalLiqNum = parseVal(totalLiquido);
  const rowTotals = data.ajustes.map(row => DEPTS.reduce((s, d) => s + parseVal(row.values[d.key]), 0));
  const totalAjustes = rowTotals.reduce((s, v) => s + v, 0);
  const totalAjustado = totalLiqNum + totalAjustes;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="text-white px-6 py-3" style={{ backgroundColor: CON_COLOR }}>
        <h2 className="font-bold text-base">CONSOLIDADO — VW + AUDI</h2>
        <p className="text-xs mt-0.5 opacity-80">{month === 0 ? `Ano ${year}` : `${MONTHS[month - 1]} de ${year}`} — Ajustes</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-52 min-w-[13rem]">Descrição</th>
              {DEPTS.map(d => (
                <th key={d.key} className="text-center px-3 py-2.5 font-semibold min-w-[8rem]" style={{ color: CON_COLOR }}>
                  {d.label}
                </th>
              ))}
              <th className="text-center px-3 py-2.5 font-bold text-slate-700 min-w-[8rem] bg-slate-100">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-white font-bold" style={{ backgroundColor: CON_COLOR }}>
              <td className="px-4 py-1.5">Lucro Líquido do Exercício</td>
              {DEPTS.map(d => {
                const v = data[d.key].lucroLiquidoExercicio;
                return <td key={d.key} className="px-3 py-1.5 text-right">{v ? fmtNum(v) : '—'}</td>;
              })}
              <td className="px-3 py-1.5 text-right text-white" style={{ backgroundColor: CON_COLOR_DRK }}>
                {totalLiquido ? fmtNum(totalLiquido) : '—'}
              </td>
            </tr>

            {data.ajustes.map((row, i) => {
              const rTotal = rowTotals[i];
              return (
                <tr key={row.id} className="border-b border-slate-100 text-slate-600">
                  <td className="px-4 py-1.5 pl-7">{row.label || '—'}</td>
                  {DEPTS.map(d => (
                    <td key={d.key} className="px-3 py-1.5 text-right">
                      {parseVal(row.values[d.key]) !== 0 ? parseVal(row.values[d.key]).toLocaleString('pt-BR') : '—'}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right bg-slate-50 text-slate-700 font-semibold">
                    {rTotal !== 0 ? rTotal.toLocaleString('pt-BR') : '—'}
                  </td>
                </tr>
              );
            })}

            <tr className="text-white font-bold" style={{ backgroundColor: CON_COLOR }}>
              <td className="px-4 py-2">RESULTADO DO PERÍODO AJUSTADO</td>
              {DEPTS.map(d => {
                const liq = parseVal(data[d.key].lucroLiquidoExercicio);
                const adj = data.ajustes.reduce((s, r) => s + parseVal(r.values[d.key]), 0);
                return <td key={d.key} className="px-3 py-2 text-right">{(liq + adj) !== 0 ? (liq + adj).toLocaleString('pt-BR') : '—'}</td>;
              })}
              <td className="px-3 py-2 text-right text-white" style={{ backgroundColor: CON_COLOR_DRK }}>
                {totalAjustado !== 0 ? totalAjustado.toLocaleString('pt-BR') : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-slate-100">
        <p className="text-[0.7rem] text-slate-400 italic">Os ajustes são calculados automaticamente com base nos dados salvos em VW e Audi.</p>
      </div>
    </div>
  );
}

// ─── Evolução Mensal (Anual) ─────────────────────────────────────────────────

function ConEvolucaoMensalTable({ allMonthRows, year }: { allMonthRows: DreVwRow[]; year: number }) {
  const monthlyTotals = allMonthRows.map(row =>
    Object.fromEntries(DEPT_FIELDS.map(f => [
      f, DEPTS.reduce((s, d) => s + parseVal(row[d.key][f]), 0)
    ])) as Record<keyof DreVwDept, number>
  );
  const annualTotal = Object.fromEntries(DEPT_FIELDS.map(f => [
    f, monthlyTotals.reduce((s, mt) => s + (mt[f] ?? 0), 0)
  ])) as Record<keyof DreVwDept, number>;
  const NCOLS = 14;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="text-white px-6 py-3" style={{ backgroundColor: CON_COLOR }}>
        <h2 className="font-bold text-base">CONSOLIDADO — VW + AUDI</h2>
        <p className="text-xs mt-0.5 opacity-80">Ano {year} — Evolução Mensal (todos os departamentos)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-200" style={{ borderBottom: `2px solid ${CON_COLOR}` }}>
              <th className="text-left px-4 py-3 font-bold text-slate-800 text-sm w-44 min-w-[11rem]">Descrição</th>
              {MONTHS.map((m, i) => <th key={i} className="text-center px-2 py-3 font-bold text-sm text-slate-800 min-w-[5.5rem]">{m.slice(0,3)}</th>)}
              <th className="text-center px-3 py-3 font-bold text-sm text-slate-800 min-w-[7rem] bg-slate-300">Total Acum.</th>
            </tr>
          </thead>
          <tbody>
            {DRE_LINES.map((line, idx) => {
              if (line.separator) return <tr key={idx}><td colSpan={NCOLS} className="h-px bg-slate-100" /></tr>;
              const isQuant = line.field === 'quant' && idx === 0;
              const rowClass = line.isTotal ? 'text-white font-bold' : line.isSubtotal ? 'bg-slate-100 font-semibold text-black' : 'hover:bg-slate-50 text-black';
              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`} style={line.isTotal ? { backgroundColor: CON_COLOR } : undefined}>
                  <td className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''}`}>{line.label}</td>
                  {monthlyTotals.map((mt, mi) => {
                    const val = mt[line.field] ?? 0;
                    return <td key={mi} className="px-2 py-1.5 text-right">{isQuant ? (Math.round(val) > 0 ? Math.round(val).toString() : '—') : (val !== 0 ? val.toLocaleString('pt-BR') : '—')}</td>;
                  })}
                  <td className={`px-3 py-1.5 text-right font-semibold ${line.isTotal ? 'text-white' : 'bg-slate-50 text-black'}`} style={line.isTotal ? { backgroundColor: CON_COLOR_DRK } : undefined}>
                    {(() => { const v = annualTotal[line.field] ?? 0; return isQuant ? (Math.round(v) > 0 ? Math.round(v).toString() : '—') : (v !== 0 ? v.toLocaleString('pt-BR') : '—'); })()}
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

function ConDeptEvolucaoTable({ deptKey, deptLabel, allMonthRows, year }: {
  deptKey: DeptKey; deptLabel: string; allMonthRows: DreVwRow[]; year: number;
}) {
  const isAdm = deptKey === 'adm';
  const annualTotals = Object.fromEntries(DEPT_FIELDS.map(f => [
    f, allMonthRows.reduce((s, row) => s + parseVal(row[deptKey][f]), 0)
  ])) as Record<keyof DreVwDept, number>;
  const NCOLS = 15;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="text-white px-6 py-3" style={{ backgroundColor: CON_COLOR }}>
        <h2 className="font-bold text-base">Consolidado — {deptLabel}</h2>
        <p className="text-xs mt-0.5 opacity-80">Ano {year} — Evolução Mensal</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-200" style={{ borderBottom: `2px solid ${CON_COLOR}` }}>
              <th className="text-left px-4 py-3 font-bold text-slate-800 text-sm w-44 min-w-[11rem]">Descrição</th>
              {MONTHS.map((m, i) => <th key={i} className="text-center px-2 py-3 font-bold text-sm text-slate-800 min-w-[5.5rem]">{m.slice(0,3)}</th>)}
              <th className="text-center px-2 py-3 font-bold text-sm text-slate-800 min-w-[5.5rem] bg-slate-300 border-l border-slate-400">Var. M/M</th>
              <th className="text-center px-3 py-3 font-bold text-sm text-slate-800 min-w-[7rem] bg-slate-300">Total Anual</th>
            </tr>
          </thead>
          <tbody>
            {DRE_LINES.map((line, idx) => {
              if (line.separator) return <tr key={idx}><td colSpan={NCOLS} className="h-px bg-slate-100" /></tr>;
              const isQuant = line.field === 'quant' && idx === 0;
              const isAdmROL = isAdm && line.field === 'receitaOperacionalLiquida';
              const rowClass = line.isTotal ? 'text-white font-bold' : line.isSubtotal ? 'bg-slate-100 font-semibold text-black' : 'hover:bg-slate-50 text-black';
              const lastVal = parseVal(allMonthRows[allMonthRows.length - 1]?.[deptKey]?.[line.field]);
              const prevVal = parseVal(allMonthRows[allMonthRows.length - 2]?.[deptKey]?.[line.field]);
              let varMM = '';
              if (prevVal !== 0 && !isAdmROL) { const pct = ((lastVal - prevVal) / Math.abs(prevVal)) * 100; varMM = (pct >= 0 ? '+' : '') + pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`} style={line.isTotal ? { backgroundColor: CON_COLOR } : undefined}>
                  <td className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''}`}>{line.label}</td>
                  {allMonthRows.map((row, mi) => {
                    const v = isAdmROL ? 0 : isQuant ? (parseInt(String(row[deptKey][line.field])) || 0) : parseVal(row[deptKey][line.field]);
                    return <td key={mi} className="px-2 py-1.5 text-right">{isAdmROL ? '0,00' : isQuant ? (v > 0 ? v.toString() : '—') : (v !== 0 ? v.toLocaleString('pt-BR') : '—')}</td>;
                  })}
                  <td className="px-2 py-1.5 text-right text-[0.68rem] border-l border-slate-200">{varMM || '—'}</td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${line.isTotal ? 'text-white' : 'bg-slate-50 text-black'}`} style={line.isTotal ? { backgroundColor: CON_COLOR_DRK } : undefined}>
                    {(() => { const v = isAdmROL ? 0 : annualTotals[line.field] ?? 0; return isQuant ? (Math.round(v) > 0 ? Math.round(v).toString() : '—') : (v !== 0 ? v.toLocaleString('pt-BR') : '—'); })()}
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

// ─── Relatório Imprimível ─────────────────────────────────────────────────────

function PrintableReport({ data, prevData, year, month }: {
  data: DreVwRow; prevData: DreVwRow[]; year: number; month: number;
}) {
  const deptList = DEPTS.map(d => data[d.key]);
  const prevPeriods = getPrevPeriods(year, month, 3);
  const totalPages = DEPTS.length + 2;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', colorScheme: 'only light' as any }}>
      <style>{`
        #print-root, #print-root * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          forced-color-adjust: none !important;
          color-scheme: light !important;
        }
        .con-header    { background-color: ${CON_COLOR} !important; color: white !important; }
        .con-row-total { background-color: ${CON_COLOR} !important; color: white !important; }
        .con-cell-total{ background-color: ${CON_COLOR_DRK} !important; color: white !important; }
      `}</style>

      <div className="print-page">
        <PrintResumoTable data={data} deptList={deptList} year={year} month={month} />
        <PrintFooter label="Resumo Geral" page={1} total={totalPages} />
      </div>

      {DEPTS.map((d, i) => (
        <div key={d.key} className="print-page">
          <PrintDeptTable
            deptLabel={d.label}
            deptKey={d.key}
            dept={data[d.key]}
            prevDepts={prevData.map(row => row[d.key])}
            prevPeriods={prevPeriods}
            year={year}
            month={month}
          />
          <PrintFooter label={d.label} page={i + 2} total={totalPages} />
        </div>
      ))}

      <div className="print-page">
        <PrintAjustesTable data={data} year={year} month={month} />
        <PrintFooter label="Ajustes" page={totalPages} total={totalPages} />
      </div>
    </div>
  );
}

function PrintHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="con-header" style={{ backgroundImage: `linear-gradient(to bottom, ${CON_COLOR} 0%, ${CON_COLOR} 100%)`, backgroundColor: CON_COLOR, color: 'white', padding: '6px 12px', marginBottom: '0' } as React.CSSProperties}>
      <div style={{ fontWeight: 700, fontSize: '10pt' }}>{title}</div>
      <div style={{ fontSize: '7.5pt', opacity: 0.8 }}>{subtitle}</div>
    </div>
  );
}

function PrintFooter({ label, page, total }: { label: string; page: number; total: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '7pt', color: '#64748b' }}>
      <span>{label}</span>
      <span>Página {page} de {total}</span>
    </div>
  );
}

function PrintResumoTable({ data, deptList, year, month }: { data: DreVwRow; deptList: DreVwDept[]; year: number; month: number }) {
  const NCOLS = DEPTS.length + 2;
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
      <PrintHeader title="CONSOLIDADO — VW + AUDI" subtitle={`${MONTHS[month - 1]} de ${year} — Demonstrativo de Resultados`} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
        <thead>
          <tr style={{ backgroundColor: '#e2e8f0', borderBottom: `2px solid ${CON_COLOR}` }}>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 700, color: '#111', width: '18%' }}>Descrição</th>
            {DEPTS.map(d => (
              <th key={d.key} style={{ textAlign: 'center', padding: '4px 4px', fontWeight: 700, color: '#111', width: '11%' }}>{d.label}</th>
            ))}
            <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: 700, color: '#111', backgroundColor: '#cbd5e1', width: '11%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {DRE_LINES.map((line, idx) => {
            if (line.separator) return <tr key={idx}><td colSpan={NCOLS} style={{ height: '2px', backgroundColor: '#f1f5f9' }} /></tr>;
            const isQuant = line.field === 'quant' && idx === 0;
            const rowStyle: React.CSSProperties = line.isTotal
              ? { backgroundImage: `linear-gradient(to bottom, ${CON_COLOR} 0%, ${CON_COLOR} 100%)`, backgroundColor: CON_COLOR, color: 'white', borderBottom: '1px solid #f1f5f9' }
              : { backgroundColor: line.isSubtotal ? '#f1f5f9' : 'transparent', color: '#111', borderBottom: '1px solid #f1f5f9' };
            return (
              <tr key={idx} className={line.isTotal ? 'con-row-total' : ''} style={rowStyle}>
                <td style={{ padding: `2px ${line.indent ? '14px' : '6px'}`, fontWeight: line.isTotal || line.isSubtotal ? 700 : 400 }}>{line.label}</td>
                {DEPTS.map(d => {
                  const val = data[d.key][line.field];
                  const display = isQuant ? ((parseInt(String(val)) || 0) > 0 ? String(parseInt(String(val))) : '—') : (parseVal(val) !== 0 ? parseVal(val).toLocaleString('pt-BR') : '—');
                  return <td key={d.key} style={{ textAlign: 'right', padding: '2px 4px' }}>{display}</td>;
                })}
                <td className={line.isTotal ? 'con-cell-total' : ''}
                  style={line.isTotal
                    ? { textAlign: 'right', padding: '2px 6px', fontWeight: 700, backgroundImage: `linear-gradient(to bottom, ${CON_COLOR_DRK} 0%, ${CON_COLOR_DRK} 100%)`, backgroundColor: CON_COLOR_DRK, color: 'white' }
                    : { textAlign: 'right', padding: '2px 6px', fontWeight: 700, backgroundColor: '#f8fafc', color: '#111' }
                  }
                >
                  {isQuant
                    ? (() => { const t = deptList.reduce((s, dep) => s + (parseInt(dep.quant) || 0), 0); return t > 0 ? t.toString() : '—'; })()
                    : (() => { const s = sumDeptsArr(deptList, line.field); return s ? fmtNum(s) : '—'; })()
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PrintDeptTable({ deptLabel, deptKey, dept, prevDepts, prevPeriods, year, month }: {
  deptLabel: string; deptKey: DeptKey;
  dept: DreVwDept; prevDepts: DreVwDept[];
  prevPeriods: { year: number; month: number }[];
  year: number; month: number;
}) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
      <PrintHeader
        title={`CONSOLIDADO — ${deptLabel}${deptKey === 'direta' ? ' (VW somente)' : ''}`}
        subtitle={`${MONTHS[month - 1]} de ${year} — Demonstrativo de Resultados`}
      />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
        <thead>
          <tr style={{ backgroundColor: '#e2e8f0', borderBottom: `2px solid ${CON_COLOR}` }}>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 700, color: '#111', width: '22%' }}>Descrição</th>
            {prevPeriods.map(p => (
              <th key={`${p.year}-${p.month}`} style={{ textAlign: 'center', padding: '4px 4px', fontWeight: 700, color: '#111', width: '12%' }}>
                {MONTHS[p.month - 1]}/{p.year}
              </th>
            ))}
            <th style={{ textAlign: 'center', padding: '4px 4px', fontWeight: 700, color: '#111', width: '12%' }}>{MONTHS[month - 1]}/{year}</th>
            <th style={{ textAlign: 'center', padding: '4px 4px', fontWeight: 700, color: '#111', backgroundColor: '#cbd5e1', width: '8%' }}>Var. M/M</th>
            <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: 700, color: '#111', backgroundColor: '#cbd5e1', width: '14%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {DRE_LINES.map((line, idx) => {
            if (line.separator) return <tr key={idx}><td colSpan={7} style={{ height: '2px', backgroundColor: '#f1f5f9' }} /></tr>;
            const isQuant = line.field === 'quant' && idx === 0;
            const rowStyle: React.CSSProperties = line.isTotal
              ? { backgroundImage: `linear-gradient(to bottom, ${CON_COLOR} 0%, ${CON_COLOR} 100%)`, backgroundColor: CON_COLOR, color: 'white', borderBottom: '1px solid #f1f5f9' }
              : { backgroundColor: line.isSubtotal ? '#f1f5f9' : 'transparent', color: '#111', borderBottom: '1px solid #f1f5f9' };

            const prevDept = prevDepts[prevDepts.length - 1];
            let varMM = '';
            if (prevDept) {
              const cur = isQuant ? (parseInt(String(dept[line.field])) || 0) : parseVal(dept[line.field]);
              const prv = isQuant ? (parseInt(String(prevDept[line.field])) || 0) : parseVal(prevDept[line.field]);
              if (prv !== 0) { const pct = ((cur - prv) / Math.abs(prv)) * 100; varMM = (pct >= 0 ? '+' : '') + pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
            }

            const allDepts = [...prevDepts, dept];
            const totalStr = isQuant
              ? (() => { const t = allDepts.reduce((s, d) => s + (parseInt(String(d.quant)) || 0), 0); return t > 0 ? t.toString() : '—'; })()
              : (() => { const t = allDepts.reduce((s, d) => s + parseVal(d[line.field]), 0); return t !== 0 ? t.toLocaleString('pt-BR') : '—'; })();

            return (
              <tr key={idx} className={line.isTotal ? 'con-row-total' : ''} style={rowStyle}>
                <td style={{ padding: `2px ${line.indent ? '14px' : '6px'}`, fontWeight: line.isTotal || line.isSubtotal ? 700 : 400 }}>{line.label}</td>
                {prevDepts.map((pd, pi) => {
                  const v = pd[line.field], num = isQuant ? (parseInt(String(v)) || 0) : parseVal(v);
                  return <td key={pi} style={{ textAlign: 'right', padding: '2px 4px', color: '#111' }}>{isQuant ? (num > 0 ? num.toString() : '—') : (num !== 0 ? num.toLocaleString('pt-BR') : '—')}</td>;
                })}
                <td style={{ textAlign: 'right', padding: '2px 4px' }}>
                  {isQuant ? ((parseInt(String(dept[line.field])) || 0) > 0 ? String(parseInt(String(dept[line.field]))) : '—') : (parseVal(dept[line.field]) !== 0 ? parseVal(dept[line.field]).toLocaleString('pt-BR') : '—')}
                </td>
                <td style={{ textAlign: 'right', padding: '2px 4px', borderLeft: '1px solid #e2e8f0', color: '#111', fontSize: '6.5pt' }}>{varMM || '—'}</td>
                <td className={line.isTotal ? 'con-cell-total' : ''}
                  style={line.isTotal
                    ? { textAlign: 'right', padding: '2px 6px', fontWeight: 700, backgroundImage: `linear-gradient(to bottom, ${CON_COLOR_DRK} 0%, ${CON_COLOR_DRK} 100%)`, backgroundColor: CON_COLOR_DRK, color: 'white' }
                    : { textAlign: 'right', padding: '2px 6px', fontWeight: 700, backgroundColor: '#f8fafc', color: '#111' }
                  }
                >
                  {totalStr}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PrintAjustesTable({ data, year, month }: { data: DreVwRow; year: number; month: number }) {
  const deptList = DEPTS.map(d => data[d.key]);
  const totalLiquido = sumDeptsArr(deptList, 'lucroLiquidoExercicio');
  const totalLiqNum = parseVal(totalLiquido);
  const rowTotals = data.ajustes.map(row => DEPTS.reduce((s, d) => s + parseVal(row.values[d.key]), 0));
  const totalAjustado = totalLiqNum + rowTotals.reduce((s, v) => s + v, 0);

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
      <PrintHeader title="CONSOLIDADO — VW + AUDI" subtitle={`${MONTHS[month - 1]} de ${year} — Ajustes`} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 600, color: '#111', width: '22%' }}>Descrição</th>
            {DEPTS.map(d => (
              <th key={d.key} style={{ textAlign: 'center', padding: '3px 4px', fontWeight: 600, color: '#111', width: '10%' }}>{d.label}</th>
            ))}
            <th style={{ textAlign: 'center', padding: '3px 6px', fontWeight: 700, color: '#111', backgroundColor: '#f1f5f9', width: '8%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="con-row-total" style={{ backgroundImage: `linear-gradient(to bottom, ${CON_COLOR} 0%, ${CON_COLOR} 100%)`, backgroundColor: CON_COLOR, color: 'white' }}>
            <td style={{ padding: '2px 6px', fontWeight: 700 }}>Lucro Líquido do Exercício</td>
            {DEPTS.map(d => { const v = data[d.key].lucroLiquidoExercicio; return <td key={d.key} style={{ textAlign: 'right', padding: '2px 4px' }}>{v ? fmtNum(v) : '—'}</td>; })}
            <td className="con-cell-total" style={{ textAlign: 'right', padding: '2px 6px', fontWeight: 700, backgroundImage: `linear-gradient(to bottom, ${CON_COLOR_DRK} 0%, ${CON_COLOR_DRK} 100%)`, backgroundColor: CON_COLOR_DRK }}>{totalLiquido ? fmtNum(totalLiquido) : '—'}</td>
          </tr>
          {data.ajustes.map((row, i) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#111' }}>
              <td style={{ padding: '2px 14px' }}>{row.label || '—'}</td>
              {DEPTS.map(d => <td key={d.key} style={{ textAlign: 'right', padding: '2px 4px' }}>{parseVal(row.values[d.key]) !== 0 ? parseVal(row.values[d.key]).toLocaleString('pt-BR') : '—'}</td>)}
              <td style={{ textAlign: 'right', padding: '2px 6px', fontWeight: 700, backgroundColor: '#f8fafc', color: '#111' }}>{rowTotals[i] !== 0 ? rowTotals[i].toLocaleString('pt-BR') : '—'}</td>
            </tr>
          ))}
          <tr className="con-row-total" style={{ backgroundImage: `linear-gradient(to bottom, ${CON_COLOR} 0%, ${CON_COLOR} 100%)`, backgroundColor: CON_COLOR, color: 'white' }}>
            <td style={{ padding: '3px 6px', fontWeight: 700 }}>RESULTADO DO PERÍODO AJUSTADO</td>
            {DEPTS.map(d => { const liq = parseVal(data[d.key].lucroLiquidoExercicio); const adj = data.ajustes.reduce((s, r) => s + parseVal(r.values[d.key]), 0); return <td key={d.key} style={{ textAlign: 'right', padding: '2px 4px' }}>{(liq + adj) !== 0 ? (liq + adj).toLocaleString('pt-BR') : '—'}</td>; })}
            <td className="con-cell-total" style={{ textAlign: 'right', padding: '2px 6px', fontWeight: 700, backgroundImage: `linear-gradient(to bottom, ${CON_COLOR_DRK} 0%, ${CON_COLOR_DRK} 100%)`, backgroundColor: CON_COLOR_DRK }}>{totalAjustado !== 0 ? totalAjustado.toLocaleString('pt-BR') : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
