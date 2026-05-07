import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Save, Loader2, RefreshCw, Trash2, Plus, Printer } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadDreAudi,
  saveDreAudi,
  createEmptyDreAudiRow,
  migrateAjustes,
  DEFAULT_AJUSTE_ROWS,
  type DreAudiRow,
  type DreAudiDept,
  type AjusteRow,
} from './dreAudiStorage';
import { loadDREDataAsync } from '@/lib/dbStorage';
import type { Department } from '@/lib/dataStorage';

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

function sumDepts(depts: DreAudiDept[], field: keyof DreAudiDept): string {
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

function parseVal(v: string | number): number {
  return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
}

const DEPT_FIELDS: (keyof DreAudiDept)[] = [
  'quant','receitaOperacionalLiquida','custoOperacionalReceita',
  'lucroPrejOperacionalBruto','outrasReceitasOperacionais','outrasDespesasOperacionais',
  'margemContribuicao','despPessoal','despServTerceiros','despOcupacao','despFuncionamento',
  'despVendas','lucroPrejOperacionalLiquido','amortizacoesDepreciacoes',
  'outrasReceitasFinanceiras','despFinanceirasNaoOperacional','despesasNaoOperacionais',
  'outrasRendasNaoOperacionais','lucroPrejAntesImpostos','provisoesIrpjCs',
  'participacoes','lucroLiquidoExercicio',
];

// ─── Linhas da tabela ──────────────────────────────────────────────────────────

interface DreLineConfig {
  label: string;
  field: keyof DreAudiDept;
  isBold?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
  indent?: boolean;
  isNegative?: boolean;
  separator?: boolean;
}

const DRE_LINES: DreLineConfig[] = [
  { label: 'Volume de Vendas',                           field: 'quant',                         isBold: false },
  { label: '',                                            field: 'quant',                         separator: true },
  { label: 'Receita Operacional Líquida',                field: 'receitaOperacionalLiquida',      isBold: true },
  { label: '(-) Custo Operacional da Receita',           field: 'custoOperacionalReceita',        indent: true, isNegative: true },
  { label: 'Lucro (Prejuízo) Operacional Bruto',         field: 'lucroPrejOperacionalBruto',      isSubtotal: true },
  { label: 'Outras Receitas Operacionais',               field: 'outrasReceitasOperacionais',     indent: true },
  { label: '(-) Outras Despesas Operacionais',           field: 'outrasDespesasOperacionais',     indent: true, isNegative: true },
  { label: 'MARGEM DE CONTRIBUIÇÃO',                     field: 'margemContribuicao',             isTotal: true },
  { label: '',                                            field: 'margemContribuicao',             separator: true },
  { label: '(-) Despesas c/ Pessoal',                    field: 'despPessoal',                    indent: true, isNegative: true },
  { label: '(-) Despesas c/ Serv. de Terceiros',         field: 'despServTerceiros',              indent: true, isNegative: true },
  { label: '(-) Despesas c/ Ocupação',                   field: 'despOcupacao',                   indent: true, isNegative: true },
  { label: '(-) Despesas c/ Funcionamento',              field: 'despFuncionamento',              indent: true, isNegative: true },
  { label: '(-) Despesas c/ Vendas',                     field: 'despVendas',                     indent: true, isNegative: true },
  { label: 'LUCRO (PREJUÍZO) OPERACIONAL LÍQUIDO',       field: 'lucroPrejOperacionalLiquido',    isTotal: true },
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
];

// ─── Departamentos ─────────────────────────────────────────────────────────────

type DeptKey = 'novos' | 'usados' | 'pecas' | 'oficina' | 'funilaria' | 'adm';

const DEPTS: { key: DeptKey; label: string; color: string }[] = [
  { key: 'novos',    label: 'Veículos Novos',      color: '#1d4ed8' },
  { key: 'usados',   label: 'Veículos Usados',     color: '#7c3aed' },
  { key: 'pecas',    label: 'Peças e Acessórios',  color: '#059669' },
  { key: 'oficina',  label: 'Oficina / Assist. Técnica', color: '#d97706' },
  { key: 'funilaria',label: 'Funilaria',            color: '#db2777' },
  { key: 'adm',      label: 'Administração',        color: '#64748b' },
];

// Mapeamento DeptKey → Department do Dashboard Executivo
const DEPT_KEY_TO_DEPT: Record<DeptKey, Department> = {
  novos:     'novos',
  usados:    'usados',
  pecas:     'pecas',
  oficina:   'oficina',
  funilaria: 'funilaria',
  adm:       'administracao',
};

// Mapeamento descricao → campo DreAudiDept
const DESCRICAO_TO_FIELD: Record<string, keyof DreAudiDept> = {
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

function buildDeptFromDREData(dreData: any[] | null, monthIndex: number): DreAudiDept {
  const dept = createEmptyDreAudiRow(0, 0).novos;
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

// ─── Componente ──────────────────────────────────────────────────────────────

interface AudiDreTabProps {
  year: number;
  month: number;
  diasUteis: number;
}

export function AudiDreTab({ year, month }: AudiDreTabProps) {
  const [data, setData]       = useState<DreAudiRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [dirty, setDirty]     = useState(false);
  const [activeSection, setActiveSection] = useState<'resumo' | DeptKey>('resumo');
  const [prevData, setPrevData] = useState<DreAudiRow[]>([]);
  const [annualView, setAnnualView] = useState<'anual' | 'mensal'>('anual');
  const [allMonthRows, setAllMonthRows] = useState<DreAudiRow[]>(
    Array.from({ length: 12 }, (_, i) => createEmptyDreAudiRow(0, i + 1))
  );

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setDirty(false);

    // ── MODO ANUAL ────────────────────────────────────────────────────────────
    if (month === 0) {
      const yr = year as 2024 | 2025 | 2026 | 2027;
      Promise.all([
        Promise.all(Array.from({ length: 12 }, (_, i) => loadDreAudi(year, i + 1))),
        Promise.all(DEPTS.map(d =>
          loadDREDataAsync(yr, DEPT_KEY_TO_DEPT[d.key], 'audi')
            .then(dre => ({ deptKey: d.key as DeptKey, dre }))
        )),
      ]).then(([kvResults, dreResults]) => {
        const dreLk: Record<string, any[] | null> = {};
        for (const { deptKey, dre } of dreResults) dreLk[deptKey] = dre;
        function hasData(dept: DreAudiDept) { return Object.values(dept).some(v => v !== ''); }
        function buildMRow(m: number, kv: DreAudiRow | null): DreAudiRow {
          const row = createEmptyDreAudiRow(year, m);
          for (const d of DEPTS) {
            row[d.key] = (kv && hasData(kv[d.key])) ? kv[d.key] : buildDeptFromDREData(dreLk[d.key] ?? null, m - 1);
          }
          if (kv) row.ajustes = migrateAjustes(kv.ajustes);
          return row;
        }
        const monthRows = kvResults.map((kv, i) => buildMRow(i + 1, kv ?? null));
        setAllMonthRows(monthRows);
        const summed = createEmptyDreAudiRow(year, 0);
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

    // Busca DRE do Dashboard Executivo para cada dept × ano (em paralelo)
    const deptDrePromises = DEPTS.flatMap(d =>
      uniqueYears.map(y =>
        loadDREDataAsync(y, DEPT_KEY_TO_DEPT[d.key], 'audi')
          .then(dre => ({ deptKey: d.key as DeptKey, year: y, dre }))
      )
    );

    // Busca ajustes do KV (Resumo DRE)
    const ajustesPromises = [
      loadDreAudi(year, month),
      ...periods.map(p => loadDreAudi(p.year, p.month)),
    ];

    Promise.all([
      Promise.all(ajustesPromises),
      Promise.all(deptDrePromises),
    ]).then(([ajustesResults, dreResults]) => {
      const [currentAjustes, ...prevAjustesArr] = ajustesResults;

      // Monta lookup: deptKey → year → DREData
      const dreLookup: Record<string, Record<number, any[] | null>> = {};
      for (const { deptKey, year: y, dre } of dreResults) {
        dreLookup[deptKey] ??= {};
        dreLookup[deptKey][y] = dre;
      }

      // Verifica se um DreAudiDept tem algum valor preenchido pelo usuário
      function hasDeptData(dept: DreAudiDept): boolean {
        return Object.values(dept).some(v => v !== '');
      }

      function buildRow(y: number, m: number, kvRow: DreAudiRow | null): DreAudiRow {
        const row = createEmptyDreAudiRow(y, m);
        for (const d of DEPTS) {
          if (kvRow && hasDeptData(kvRow[d.key])) {
            // Usuário já editou/salvou — usa dados do KV
            row[d.key] = kvRow[d.key];
          } else {
            // Pré-preenche do Dashboard Executivo como sugestão
            row[d.key] = buildDeptFromDREData(dreLookup[d.key]?.[y] ?? null, m - 1);
          }
        }
        if (kvRow) {
          row.ajustes = migrateAjustes(kvRow.ajustes);
        }
        return row;
      }

      setData(buildRow(year, month, currentAjustes ?? null));
      setPrevData(periods.map((p, i) => buildRow(p.year, p.month, prevAjustesArr[i] ?? null)));
      setLoading(false);
    });
  }, [year, month]);

  // ── Save ─────────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!data) return;
    setSaving(true);
    const ok = await saveDreAudi(data);
    setSaving(false);
    if (ok) {
      setDirty(false);
      toast.success('Dados salvos com sucesso!');
    } else {
      toast.error('Erro ao salvar. Tente novamente.');
    }
  }, [data]);

  // ── Edição de célula de departamento ────────────────────────────────────────────
  const handleCellChange = useCallback(
    (dept: DeptKey, field: keyof DreAudiDept, value: string) => {
      setData(prev => {
        if (!prev) return prev;
        return { ...prev, [dept]: { ...prev[dept], [field]: value } };
      });
      setDirty(true);
    },
    []
  );

  const handleAjusteChange = useCallback(
    (rowId: string, dept: DeptKey, value: string) => {
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          ajustes: prev.ajustes.map(r =>
            r.id === rowId ? { ...r, values: { ...r.values, [dept]: value } } : r
          ),
        };
      });
      setDirty(true);
    },
    []
  );

  const handleAjusteLabel = useCallback(
    (rowId: string, label: string) => {
      setData(prev => {
        if (!prev) return prev;
        return { ...prev, ajustes: prev.ajustes.map(r => r.id === rowId ? { ...r, label } : r) };
      });
      setDirty(true);
    },
    []
  );

  const handleAddAjusteRow = useCallback(() => {
    const newRow: AjusteRow = {
      id: `custom_${Date.now()}`,
      label: '',
      values: { novos: '', usados: '', pecas: '', oficina: '', funilaria: '', adm: '' },
    };
    setData(prev => {
      if (!prev) return prev;
      return { ...prev, ajustes: [...prev.ajustes, newRow] };
    });
    setDirty(true);
  }, []);

  const handleDeleteAjusteRow = useCallback(
    (rowId: string) => {
      setData(prev => {
        if (!prev) return prev;
        return { ...prev, ajustes: prev.ajustes.filter(r => r.id !== rowId) };
      });
      setDirty(true);
    },
    []
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Carregando dados...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const deptList = DEPTS.map(d => data[d.key]);

  return (
    <div className="flex flex-col gap-0 flex-1">

      {/* ── Sub-navegação de seções ─────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveSection('resumo')}
          className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeSection === 'resumo'
              ? 'border-[#bb0a30] text-[#bb0a30]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Resumo Geral
        </button>
        {DEPTS.map(d => (
          <button
            key={d.key}
            onClick={() => setActiveSection(d.key)}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
              activeSection === d.key
                ? 'border-[#bb0a30] text-[#bb0a30]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {d.label}
          </button>
        ))}
        <button
          onClick={() => setActiveSection('ajustes' as any)}
          className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
            (activeSection as string) === 'ajustes'
              ? 'border-[#bb0a30] text-[#bb0a30]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Ajustes
        </button>

        <div className="flex-1" />

        {/* Badge de sincronização */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[0.65rem] font-medium mr-2">
          <RefreshCw className="w-3 h-3" />
          Sincronizado com Dashboard Executivo
        </div>

        {/* Botão Imprimir PDF */}
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors my-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 mr-1"
        >
          <Printer className="w-3.5 h-3.5" />
          Imprimir PDF
        </button>

        {/* Botão Salvar (apenas ajustes) */}
        <button
          disabled={!dirty || saving}
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors my-1.5 ${
            dirty
              ? 'bg-[#bb0a30] text-black hover:bg-[#990826]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {/* ── Conteúdo ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">

        {/* RESUMO GERAL */}
        {activeSection === 'resumo' && month !== 0 && (
          <ResumoTable data={data} deptList={deptList} year={year} month={month} />
        )}
        {activeSection === 'resumo' && month === 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setAnnualView('anual')}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={annualView === 'anual' ? { backgroundColor: '#bb0a30', color: 'white' } : { backgroundColor: '#f1f5f9', color: '#64748b' }}
              >Resultado Anual</button>
              <button
                onClick={() => setAnnualView('mensal')}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={annualView === 'mensal' ? { backgroundColor: '#bb0a30', color: 'white' } : { backgroundColor: '#f1f5f9', color: '#64748b' }}
              >Evolução Mensal</button>
            </div>
            {annualView === 'anual' && <ResumoTable data={data} deptList={deptList} year={year} month={0} />}
            {annualView === 'mensal' && <AudiEvolucaoMensalTable allMonthRows={allMonthRows} year={year} />}
          </div>
        )}

        {/* DETALHE POR DEPARTAMENTO */}
        {DEPTS.map(d =>
          activeSection === d.key ? (
            month === 0
              ? <AudiDeptEvolucaoTable key={d.key} deptKey={d.key} deptLabel={d.label} allMonthRows={allMonthRows} year={year} />
              : <DeptTable key={d.key} deptKey={d.key} deptLabel={d.label} deptColor={d.color} dept={data[d.key]} prevDepts={prevData.map(row => row[d.key])} prevPeriods={getPrevPeriods(year, month, 3)} year={year} month={month} onChange={(field, value) => handleCellChange(d.key, field, value)} />
          ) : null
        )}

        {/* AJUSTES */}
        {(activeSection as string) === 'ajustes' && (
          <AjustesTable
            ajustes={data.ajustes}
            onChange={handleAjusteChange}
            onLabelChange={handleAjusteLabel}
            onAdd={handleAddAjusteRow}
            onDelete={handleDeleteAjusteRow}
            data={data}
            year={year}
            month={month}
          />
        )}
      </div>

      {/* ── Portal de Impressão ─────────────────────────────────────────── */}
      {typeof document !== 'undefined' && document.getElementById('print-root') &&
        createPortal(
          <PrintableReport
            data={data}
            prevData={prevData}
            year={year}
            month={month}
          />,
          document.getElementById('print-root')!
        )
      }
    </div>
  );
}

// ─── Tabela Resumo Geral ───────────────────────────────────────────────────────

function ResumoTable({
  data,
  deptList,
  year,
  month,
}: {
  data: DreAudiRow;
  deptList: DreAudiDept[];
  year: number;
  month: number;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Cabeçalho */}
      <div className="bg-[#bb0a30] text-black px-6 py-3">
        <h2 className="font-bold text-base">AUDI LAPA/PINHEIROS</h2>
        <p className="text-xs mt-0.5">{month === 0 ? `Ano ${year}` : `${MONTHS[month - 1]} de ${year}`} — Demonstrativo de Resultados</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-200 border-b-2 border-[#bb0a30]">
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
                return <tr key={idx}><td colSpan={8} className="h-px bg-slate-100" /></tr>;
              }
              const isQuant = line.field === 'quant' && idx === 0;
              const rowClass = line.isTotal
                ? 'text-black font-bold'
                : line.isSubtotal
                ? 'bg-slate-100 font-semibold text-black'
                : 'hover:bg-slate-50 text-black';

              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`} style={line.isTotal ? {backgroundColor:'#bb0a30'} : undefined}>
                  <td className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''}`}>
                    {line.label}
                  </td>
                  {DEPTS.map((d) => {
                    const val = data[d.key][line.field];
                    const display = isQuant
                      ? ((parseInt(String(val)) || 0) > 0 ? String(parseInt(String(val))) : '—')
                      : (parseVal(val) !== 0 ? parseVal(val).toLocaleString('pt-BR') : '—');
                    return (
                      <td key={d.key} className="px-3 py-1.5 text-right">
                        {display}
                      </td>
                    );
                  })}
                  {/* Total */}
                  <td className={`px-3 py-1.5 text-right font-semibold ${line.isTotal ? 'text-black' : 'bg-slate-50 text-black'}`} style={line.isTotal ? {backgroundColor:'#9a0827'} : undefined}>
                    {isQuant
                      ? (() => {
                          const t = deptList.reduce((s, dep) => s + (parseInt(dep.quant) || 0), 0);
                          return t > 0 ? t.toString() : '—';
                        })()
                      : (() => {
                          const s = sumDepts(deptList, line.field);
                          return s ? fmtNum(s) : '—';
                        })()
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

// ─── Tabela por Departamento ───────────────────────────────────────────────────

function DeptTable({
  deptKey,
  deptLabel,
  deptColor,
  dept,
  prevDepts,
  prevPeriods,
  year,
  month,
  onChange,
}: {
  deptKey: DeptKey;
  deptLabel: string;
  deptColor: string;
  dept: DreAudiDept;
  prevDepts: DreAudiDept[];
  prevPeriods: { year: number; month: number }[];
  year: number;
  month: number;
  onChange: (field: keyof DreAudiDept, value: string) => void;
}) {
  const totalCols = 1 + prevPeriods.length + 1 + 1 + 1; // desc + prev + atual + total + %H
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-3 text-black font-bold flex items-center gap-3 bg-[#bb0a30]">
        <span className="text-base">Audi Lapa/Pinheiros — {deptLabel}</span>
        <span className="text-xs opacity-75 font-normal">{MONTHS[month - 1]}/{year}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-200 border-b-2 border-[#bb0a30]">
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
              const isAdmROL = deptKey === 'adm' && line.field === 'receitaOperacionalLiquida';
              const rowClass = line.isTotal
                ? 'text-black font-bold'
                : line.isSubtotal
                ? 'bg-slate-100 font-semibold text-black'
                : 'hover:bg-slate-50 text-black';

              // Var. M/M: mês atual vs mês imediatamente anterior (prevDepts[2])
              const prevDept = prevDepts[prevDepts.length - 1];
              let varMM = '';
              if (prevDept) {
                if (isQuant) {
                  const cur = parseInt(String(dept[line.field])) || 0;
                  const prv = parseInt(String(prevDept[line.field])) || 0;
                  if (prv !== 0) {
                    const pct = ((cur - prv) / Math.abs(prv)) * 100;
                    varMM = (pct >= 0 ? '+' : '') + pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
                  }
                } else if (!isAdmROL) {
                  const cur = parseVal(dept[line.field]);
                  const prv = parseVal(prevDept[line.field]);
                  if (prv !== 0) {
                    const pct = ((cur - prv) / Math.abs(prv)) * 100;
                    varMM = (pct >= 0 ? '+' : '') + pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
                  }
                }
              }

              // Total = soma dos meses anteriores + mês atual
              const allDepts = [...prevDepts, dept];
              let totalStr: string;
              if (isQuant) {
                const t = allDepts.reduce((s, d) => s + (parseInt(String(d.quant)) || 0), 0);
                totalStr = t > 0 ? t.toString() : '—';
              } else if (isAdmROL) {
                totalStr = '0,00';
              } else {
                const t = allDepts.reduce((s, d) => s + parseVal(d[line.field]), 0);
                totalStr = t !== 0 ? t.toLocaleString('pt-BR') : '—';
              }

              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`} style={line.isTotal ? {backgroundColor:'#bb0a30'} : undefined}>
                  <td className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''}`}>{line.label}</td>
                  {prevDepts.map((pd, pi) => {
                    const v = pd[line.field];
                    const num = isQuant ? (parseInt(String(v)) || 0) : parseVal(v);
                    const display = isAdmROL
                      ? '0,00'
                      : isQuant
                      ? (num > 0 ? num.toString() : '—')
                      : (num !== 0 ? num.toLocaleString('pt-BR') : '—');
                    return (
                      <td key={pi} className={`px-3 py-1.5 text-right ${line.isTotal ? 'text-black' : 'text-black'}`}>
                        {display}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-right">
                    {isAdmROL
                      ? <span className="block w-full text-right px-1 py-0.5 min-w-[5rem]">0,00</span>
                      : <EditableCell
                          value={dept[line.field]}
                          onChange={v => onChange(line.field, v)}
                          isTotal={line.isTotal}
                          isNegative={line.isNegative}
                          isQuant={isQuant}
                        />
                    }
                  </td>
                  <td className={`px-2 py-1.5 text-right text-[0.68rem] border-l border-slate-200 text-black`}>
                    {varMM || '—'}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${line.isTotal ? 'text-black' : 'bg-slate-50 text-black'}`} style={line.isTotal ? {backgroundColor:'#9a0827'} : undefined}>
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

// ─── Tabela de Ajustes ────────────────────────────────────────────────────────

function AjustesTable({
  ajustes,
  onChange,
  onLabelChange,
  onAdd,
  onDelete,
  data,
  year,
  month,
}: {
  ajustes: AjusteRow[];
  onChange: (rowId: string, dept: DeptKey, value: string) => void;
  onLabelChange: (rowId: string, label: string) => void;
  onAdd: () => void;
  onDelete: (rowId: string) => void;
  data: DreAudiRow;
  year: number;
  month: number;
}) {
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const prevLen = useRef(ajustes.length);

  // Ao adicionar nova linha com label vazio, inicia edição automaticamente
  useEffect(() => {
    if (ajustes.length > prevLen.current) {
      const last = ajustes[ajustes.length - 1];
      if (!last.label) {
        setEditingLabelId(last.id);
        setLabelDraft('');
      }
    }
    prevLen.current = ajustes.length;
  }, [ajustes]);

  function startEditLabel(row: AjusteRow) {
    setEditingLabelId(row.id);
    setLabelDraft(row.label);
  }

  function confirmLabel() {
    if (editingLabelId !== null) {
      onLabelChange(editingLabelId, labelDraft);
      setEditingLabelId(null);
    }
  }

  const deptList = DEPTS.map(d => data[d.key]);
  const totalLiquido = sumDepts(deptList, 'lucroLiquidoExercicio');
  const totalLiqNum = parseVal(totalLiquido);

  // Total de cada linha de ajuste
  const rowTotals = ajustes.map(row => ({
    id: row.id,
    total: DEPTS.reduce((s, d) => s + parseVal(row.values[d.key]), 0),
  }));
  const totalAjustes = rowTotals.reduce((s, r) => s + r.total, 0);
  const totalAjustado = totalLiqNum + totalAjustes;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-[#bb0a30] text-black px-6 py-3">
        <h2 className="font-bold text-base">AUDI LAPA/PINHEIROS</h2>
        <p className="text-xs mt-0.5">{month === 0 ? `Ano ${year}` : `${MONTHS[month - 1]} de ${year}`} — Ajustes</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="w-7 px-1" />
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-52 min-w-[13rem]">Descrição</th>
              {DEPTS.map(d => (
                <th key={d.key} className="text-center px-3 py-2.5 font-semibold min-w-[8rem] text-[#bb0a30]">
                  {d.label}
                </th>
              ))}
              <th className="text-center px-3 py-2.5 font-bold text-slate-700 min-w-[8rem] bg-slate-100">Total</th>
            </tr>
          </thead>
          <tbody>
            {/* Lucro Líquido do Exercício (fixo, sem excluir) */}
            <tr className="border-b border-red-900 text-black font-bold" style={{backgroundColor:'#bb0a30'}}>
              <td className="w-7" />
              <td className="px-4 py-1.5">Lucro Líquido do Exercício</td>
              {DEPTS.map(d => {
                const v = data[d.key].lucroLiquidoExercicio;
                return (
                  <td key={d.key} className="px-3 py-1.5 text-right">
                    {v ? fmtNum(v) : '—'}
                  </td>
                );
              })}
              <td className="px-3 py-1.5 text-right" style={{backgroundColor:'#9a0827'}}>
                {totalLiquido ? fmtNum(totalLiquido) : '—'}
              </td>
            </tr>

            {/* Linhas dinâmicas de ajuste */}
            {ajustes.map((row) => {
              const rowTotal = rowTotals.find(r => r.id === row.id)?.total ?? 0;
              return (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 text-slate-600 group">
                  {/* Botão excluir */}
                  <td className="w-7 px-1 text-center">
                    <button
                      onClick={() => onDelete(row.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-600 p-0.5 rounded"
                      title="Excluir linha"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                  {/* Descrição editável */}
                  <td className="px-4 py-1 pl-7">
                    {editingLabelId === row.id ? (
                      <input
                        autoFocus
                        className="w-full border border-[#bb0a30] rounded px-2 py-0.5 text-xs outline-none"
                        value={labelDraft}
                        onChange={e => setLabelDraft(e.target.value)}
                        onBlur={confirmLabel}
                        onKeyDown={e => { if (e.key === 'Enter') confirmLabel(); if (e.key === 'Escape') setEditingLabelId(null); }}
                        placeholder="Descrição da linha..."
                      />
                    ) : (
                      <span
                        className="cursor-text hover:text-slate-800 transition-colors"
                        title="Clique para editar descrição"
                        onClick={() => startEditLabel(row)}
                      >
                        {row.label || <span className="text-slate-300 italic">Clique para editar...</span>}
                      </span>
                    )}
                  </td>
                  {/* Valores por departamento */}
                  {DEPTS.map(d => (
                    <td key={d.key} className="px-2 py-1 text-right">
                      <EditableCell
                        value={row.values[d.key]}
                        onChange={v => onChange(row.id, d.key, v)}
                      />
                    </td>
                  ))}
                  {/* Total da linha */}
                  <td className="px-3 py-1.5 text-right bg-slate-50 text-slate-700 font-semibold">
                    {rowTotal !== 0 ? rowTotal.toLocaleString('pt-BR') : '—'}
                  </td>
                </tr>
              );
            })}

            {/* Resultado Ajustado (calculado) */}
            <tr className="text-black font-bold" style={{backgroundColor:'#bb0a30'}}>
              <td className="w-7" />
              <td className="px-4 py-2">RESULTADO DO PERÍODO AJUSTADO</td>
              {DEPTS.map(d => {
                const liq = parseVal(data[d.key].lucroLiquidoExercicio);
                const adj = ajustes.reduce((s, r) => s + parseVal(r.values[d.key]), 0);
                const total = liq + adj;
                return (
                  <td key={d.key} className="px-3 py-2 text-right">
                    {total !== 0 ? total.toLocaleString('pt-BR') : '—'}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right" style={{backgroundColor:'#9a0827'}}>
                {totalAjustado !== 0 ? totalAjustado.toLocaleString('pt-BR') : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Botão Adicionar linha */}
      <div className="px-4 py-2 border-t border-slate-100">
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 text-xs text-[#bb0a30] hover:text-[#9a0827] font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar linha
        </button>
      </div>
    </div>
  );
}

// ─── Evolução Mensal (Anual) ─────────────────────────────────────────────────

function AudiEvolucaoMensalTable({ allMonthRows, year }: { allMonthRows: DreAudiRow[]; year: number }) {
  const monthlyTotals = allMonthRows.map(row =>
    Object.fromEntries(DEPT_FIELDS.map(f => [
      f, DEPTS.reduce((s, d) => s + parseVal(row[d.key][f]), 0)
    ])) as Record<keyof DreAudiDept, number>
  );
  const annualTotal = Object.fromEntries(DEPT_FIELDS.map(f => [
    f, monthlyTotals.reduce((s, mt) => s + (mt[f] ?? 0), 0)
  ])) as Record<keyof DreAudiDept, number>;
  const NCOLS = 14;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-[#bb0a30] text-white px-6 py-3">
        <h2 className="font-bold text-base">AUDI LAPA/PINHEIROS</h2>
        <p className="text-xs mt-0.5 opacity-80">Ano {year} — Evolução Mensal (todos os departamentos)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-200 border-b-2 border-[#bb0a30]">
              <th className="text-left px-4 py-3 font-bold text-slate-800 text-sm w-44 min-w-[11rem]">Descrição</th>
              {MONTHS.map((m, i) => <th key={i} className="text-center px-2 py-3 font-bold text-sm text-slate-800 min-w-[5.5rem]">{m.slice(0,3)}</th>)}
              <th className="text-center px-3 py-3 font-bold text-sm text-slate-800 min-w-[7rem] bg-slate-300">Total Acum.</th>
            </tr>
          </thead>
          <tbody>
            {DRE_LINES.map((line, idx) => {
              if (line.separator) return <tr key={idx}><td colSpan={NCOLS} className="h-px bg-slate-100" /></tr>;
              const isQuant = line.field === 'quant' && idx === 0;
              const rowClass = line.isTotal ? 'text-black font-bold' : line.isSubtotal ? 'bg-slate-100 font-semibold text-black' : 'hover:bg-slate-50 text-black';
              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`} style={line.isTotal ? { backgroundColor: '#bb0a30', color: 'white' } : undefined}>
                  <td className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''}`}>{line.label}</td>
                  {monthlyTotals.map((mt, mi) => {
                    const val = mt[line.field] ?? 0;
                    const display = isQuant ? (Math.round(val) > 0 ? Math.round(val).toString() : '—') : (val !== 0 ? val.toLocaleString('pt-BR') : '—');
                    return <td key={mi} className="px-2 py-1.5 text-right">{display}</td>;
                  })}
                  <td className={`px-3 py-1.5 text-right font-semibold ${line.isTotal ? '' : 'bg-slate-50 text-black'}`} style={line.isTotal ? { backgroundColor: '#9a0827' } : undefined}>
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

function AudiDeptEvolucaoTable({ deptKey, deptLabel, allMonthRows, year }: {
  deptKey: DeptKey; deptLabel: string; allMonthRows: DreAudiRow[]; year: number;
}) {
  const isAdm = deptKey === 'adm';
  const annualTotals = Object.fromEntries(DEPT_FIELDS.map(f => [
    f, allMonthRows.reduce((s, row) => s + parseVal(row[deptKey][f]), 0)
  ])) as Record<keyof DreAudiDept, number>;
  const NCOLS = 15;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-[#bb0a30] text-white px-6 py-3">
        <h2 className="font-bold text-base">Audi Lapa/Pinheiros — {deptLabel}</h2>
        <p className="text-xs mt-0.5 opacity-80">Ano {year} — Evolução Mensal</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-200 border-b-2 border-[#bb0a30]">
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
              const rowClass = line.isTotal ? 'text-black font-bold' : line.isSubtotal ? 'bg-slate-100 font-semibold text-black' : 'hover:bg-slate-50 text-black';
              const lastVal = parseVal(allMonthRows[allMonthRows.length - 1]?.[deptKey]?.[line.field]);
              const prevVal = parseVal(allMonthRows[allMonthRows.length - 2]?.[deptKey]?.[line.field]);
              let varMM = '';
              if (prevVal !== 0 && !isAdmROL) { const pct = ((lastVal - prevVal) / Math.abs(prevVal)) * 100; varMM = (pct >= 0 ? '+' : '') + pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`} style={line.isTotal ? { backgroundColor: '#bb0a30', color: 'white' } : undefined}>
                  <td className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''}`}>{line.label}</td>
                  {allMonthRows.map((row, mi) => {
                    const v = isAdmROL ? 0 : isQuant ? (parseInt(String(row[deptKey][line.field])) || 0) : parseVal(row[deptKey][line.field]);
                    return <td key={mi} className="px-2 py-1.5 text-right">{isAdmROL ? '0,00' : isQuant ? (v > 0 ? v.toString() : '—') : (v !== 0 ? v.toLocaleString('pt-BR') : '—')}</td>;
                  })}
                  <td className="px-2 py-1.5 text-right text-[0.68rem] border-l border-slate-200">{varMM || '—'}</td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${line.isTotal ? '' : 'bg-slate-50 text-black'}`} style={line.isTotal ? { backgroundColor: '#9a0827' } : undefined}>
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

// ─── Célula Editável ──────────────────────────────────────────────────────────

// ─── Relatório Imprimível ─────────────────────────────────────────────────────

function PrintableReport({
  data,
  prevData,
  year,
  month,
}: {
  data: DreAudiRow;
  prevData: DreAudiRow[];
  year: number;
  month: number;
}) {
  const deptList = DEPTS.map(d => data[d.key]);
  const prevPeriods = getPrevPeriods(year, month, 3);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', colorScheme: 'only light' as any }}>
      {/* Injeta regras de cor diretamente no conteúdo imprimível */}
      <style>{`
        #print-root, #print-root * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          forced-color-adjust: none !important;
          color-scheme: light !important;
        }
        .dre-header-red { background-color: #bb0a30 !important; color: black !important; }
        .dre-row-total   { background-color: #bb0a30 !important; color: black !important; }
        .dre-cell-total  { background-color: #9a0827 !important; color: black !important; }
      `}</style>

      {/* ── Página 1: Resumo Geral ── */}
      <div className="print-page">
        <PrintResumoTable data={data} deptList={deptList} year={year} month={month} />
        <PrintFooter label="Resumo Geral" page={1} total={8} />
      </div>

      {/* ── Páginas 2–7: Departamentos ── */}
      {DEPTS.map((d, i) => {
        const prevDepts = prevData.map(row => row[d.key]);
        return (
          <div key={d.key} className="print-page">
            <PrintDeptTable
              deptLabel={d.label}
              deptKey={d.key}
              dept={data[d.key]}
              prevDepts={prevDepts}
              prevPeriods={prevPeriods}
              year={year}
              month={month}
            />
            <PrintFooter label={d.label} page={i + 2} total={8} />
          </div>
        );
      })}

      {/* ── Página 8: Ajustes ── */}
      <div className="print-page">
        <PrintAjustesTable data={data} year={year} month={month} />
        <PrintFooter label="Ajustes" page={8} total={8} />
      </div>
    </div>
  );
}

// ── Cabeçalho padrão de cada página ─────────────────────────────────────────
function PrintHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="dre-header-red" style={{ backgroundImage: 'linear-gradient(to bottom, #bb0a30 0%, #bb0a30 100%)', backgroundColor: '#bb0a30', color: 'black', padding: '6px 12px', marginBottom: '0' } as React.CSSProperties}>
      <div style={{ fontWeight: 700, fontSize: '10pt' }}>{title}</div>
      <div style={{ fontSize: '7.5pt', opacity: 0.8 }}>{subtitle}</div>
    </div>
  );
}

// ── Rodapé com número de página ───────────────────────────────────────────────
function PrintFooter({ label, page, total }: { label: string; page: number; total: number }) {
  return (
    <div className="print-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '7pt', color: '#64748b' }}>
      <span>{label}</span>
      <span>Página {page} de {total}</span>
    </div>
  );
}

// ── Tabela Resumo Geral (impressão) ──────────────────────────────────────────
function PrintResumoTable({ data, deptList, year, month }: { data: DreAudiRow; deptList: DreAudiDept[]; year: number; month: number }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
      <PrintHeader title="AUDI LAPA/PINHEIROS" subtitle={`${MONTHS[month - 1]} de ${year} — Demonstrativo de Resultados`} />
      <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
        <thead>
          <tr style={{ backgroundColor: '#e2e8f0', borderBottom: '2px solid #bb0a30' }}>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 700, color: '#111111', fontSize: '9pt', width: '18%' }}>Descrição</th>
            {DEPTS.map(d => (
              <th key={d.key} style={{ textAlign: 'center', padding: '4px 4px', fontWeight: 700, color: '#111111', fontSize: '9pt', width: '11%' }}>{d.label}</th>
            ))}
            <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: 700, color: '#111111', fontSize: '9pt', backgroundColor: '#cbd5e1', width: '10%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {DRE_LINES.map((line, idx) => {
            if (line.separator) return <tr key={idx}><td colSpan={8} style={{ height: '2px', backgroundColor: '#f1f5f9' }} /></tr>;
            const isQuant = line.field === 'quant' && idx === 0;
            const rowBg = line.isTotal ? '#bb0a30' : line.isSubtotal ? '#f1f5f9' : 'transparent';
            const rowColor = line.isTotal ? 'black' : '#111111';
            const totalVal = isQuant
              ? (() => { const t = deptList.reduce((s, dep) => s + (parseInt(dep.quant) || 0), 0); return t > 0 ? t.toString() : '—'; })()
              : (() => { const s = sumDepts(deptList, line.field); return s ? fmtNum(s) : '—'; })();
            const rowStyle: React.CSSProperties = line.isTotal
              ? { backgroundImage: 'linear-gradient(to bottom, #bb0a30 0%, #bb0a30 100%)', backgroundColor: '#bb0a30', color: 'black', borderBottom: '1px solid #f1f5f9' }
              : { backgroundColor: rowBg, color: rowColor, borderBottom: '1px solid #f1f5f9' };
            const totalCellStyle: React.CSSProperties = line.isTotal
              ? { textAlign: 'right', padding: '2px 6px', fontWeight: 700, backgroundImage: 'linear-gradient(to bottom, #9a0827 0%, #9a0827 100%)', backgroundColor: '#9a0827', color: 'black' }
              : { textAlign: 'right', padding: '2px 6px', fontWeight: 700, backgroundColor: '#f8fafc', color: '#111111' };
            return (
              <tr key={idx} className={line.isTotal ? 'dre-row-total' : ''} style={rowStyle}>
                <td style={{ padding: `2px ${line.indent ? '16px' : '6px'}`, fontWeight: line.isTotal || line.isSubtotal ? 700 : 400 }}>{line.label}</td>
                {DEPTS.map(d => {
                  const val = data[d.key][line.field];
                  const display = isQuant
                    ? ((parseInt(String(val)) || 0) > 0 ? String(parseInt(String(val))) : '—')
                    : (parseVal(val) !== 0 ? parseVal(val).toLocaleString('pt-BR') : '—');
                  return <td key={d.key} style={{ textAlign: 'right', padding: '2px 4px' }}>{display}</td>;
                })}
                <td className={line.isTotal ? 'dre-cell-total' : ''} style={totalCellStyle}>{totalVal}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Tabela por Departamento (impressão) ──────────────────────────────────────
function PrintDeptTable({
  deptLabel, deptKey, dept, prevDepts, prevPeriods, year, month,
}: {
  deptLabel: string;
  deptKey: DeptKey;
  dept: DreAudiDept;
  prevDepts: DreAudiDept[];
  prevPeriods: { year: number; month: number }[];
  year: number;
  month: number;
}) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
      <PrintHeader title={`Audi Lapa/Pinheiros — ${deptLabel}`} subtitle={`${MONTHS[month - 1]} de ${year}`} />
      <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
        <thead>
          <tr style={{ backgroundColor: '#e2e8f0', borderBottom: '2px solid #bb0a30' }}>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 700, color: '#111111', fontSize: '9pt', width: '28%' }}>Descrição</th>
            {prevPeriods.map(p => (
              <th key={`${p.year}-${p.month}`} style={{ textAlign: 'center', padding: '4px 4px', fontWeight: 700, color: '#111111', fontSize: '9pt', width: '14%' }}>
                {MONTHS[p.month - 1]}/{p.year}
              </th>
            ))}
            <th style={{ textAlign: 'center', padding: '4px 4px', fontWeight: 700, color: '#111111', fontSize: '9pt', width: '14%' }}>{MONTHS[month - 1]}/{year}</th>
            <th style={{ textAlign: 'center', padding: '4px 4px', fontWeight: 700, color: '#111111', fontSize: '9pt', width: '10%', borderLeft: '1px solid #94a3b8' }}>Var. M/M</th>
            <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: 700, color: '#111111', fontSize: '9pt', backgroundColor: '#cbd5e1', width: '14%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {DRE_LINES.map((line, idx) => {
            if (line.separator) return <tr key={idx}><td colSpan={7} style={{ height: '2px', backgroundColor: '#f1f5f9' }} /></tr>;
            const isQuant = line.field === 'quant' && idx === 0;
            const isAdmROL = deptKey === 'adm' && line.field === 'receitaOperacionalLiquida';
            const rowBg = line.isTotal ? '#bb0a30' : line.isSubtotal ? '#f1f5f9' : 'transparent';
            const rowColor = line.isTotal ? 'black' : '#111111';

            const prevDept = prevDepts[prevDepts.length - 1];
            let varMM = '';
            if (prevDept) {
              if (isQuant) {
                const cur = parseInt(String(dept[line.field])) || 0;
                const prv = parseInt(String(prevDept[line.field])) || 0;
                if (prv !== 0) { const pct = ((cur - prv) / Math.abs(prv)) * 100; varMM = (pct >= 0 ? '+' : '') + pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
              } else if (!isAdmROL) {
                const cur = parseVal(dept[line.field]); const prv = parseVal(prevDept[line.field]);
                if (prv !== 0) { const pct = ((cur - prv) / Math.abs(prv)) * 100; varMM = (pct >= 0 ? '+' : '') + pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
              }
            }

            const allDepts = [...prevDepts, dept];
            const totalStr = isQuant
              ? (() => { const t = allDepts.reduce((s, d) => s + (parseInt(String(d.quant)) || 0), 0); return t > 0 ? t.toString() : '—'; })()
              : isAdmROL
              ? '0,00'
              : (() => { const t = allDepts.reduce((s, d) => s + parseVal(d[line.field]), 0); return t !== 0 ? t.toLocaleString('pt-BR') : '—'; })();

            const deptRowStyle: React.CSSProperties = line.isTotal
              ? { backgroundImage: 'linear-gradient(to bottom, #bb0a30 0%, #bb0a30 100%)', backgroundColor: '#bb0a30', color: 'black', borderBottom: '1px solid #f1f5f9' }
              : { backgroundColor: rowBg, color: rowColor, borderBottom: '1px solid #f1f5f9' };
            const deptTotalCellStyle: React.CSSProperties = line.isTotal
              ? { textAlign: 'right', padding: '2px 6px', fontWeight: 700, backgroundImage: 'linear-gradient(to bottom, #9a0827 0%, #9a0827 100%)', backgroundColor: '#9a0827', color: 'black' }
              : { textAlign: 'right', padding: '2px 6px', fontWeight: 700, backgroundColor: '#f8fafc', color: '#111111' };
            return (
              <tr key={idx} className={line.isTotal ? 'dre-row-total' : ''} style={deptRowStyle}>
                <td style={{ padding: `2px ${line.indent ? '14px' : '6px'}`, fontWeight: line.isTotal || line.isSubtotal ? 700 : 400 }}>{line.label}</td>
                {prevDepts.map((pd, pi) => {
                  const v = pd[line.field]; const num = isQuant ? (parseInt(String(v)) || 0) : parseVal(v);
                  const display = isAdmROL
                    ? '0,00'
                    : isQuant ? (num > 0 ? num.toString() : '—') : (num !== 0 ? num.toLocaleString('pt-BR') : '—');
                  return <td key={pi} style={{ textAlign: 'right', padding: '2px 4px', color: '#111111' }}>{display}</td>;
                })}
                <td style={{ textAlign: 'right', padding: '2px 4px' }}>
                  {isAdmROL
                    ? '0,00'
                    : isQuant
                    ? ((parseInt(String(dept[line.field])) || 0) > 0 ? String(parseInt(String(dept[line.field]))) : '—')
                    : (parseVal(dept[line.field]) !== 0 ? parseVal(dept[line.field]).toLocaleString('pt-BR') : '—')}
                </td>
                <td style={{ textAlign: 'right', padding: '2px 4px', borderLeft: '1px solid #e2e8f0', color: '#111111', fontSize: '6.5pt' }}>{varMM || '—'}</td>
                <td className={line.isTotal ? 'dre-cell-total' : ''} style={deptTotalCellStyle}>{totalStr}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Tabela de Ajustes (impressão) ─────────────────────────────────────────────
function PrintAjustesTable({ data, year, month }: { data: DreAudiRow; year: number; month: number }) {
  const deptList = DEPTS.map(d => data[d.key]);
  const totalLiquido = sumDepts(deptList, 'lucroLiquidoExercicio');
  const totalLiqNum = parseVal(totalLiquido);
  const rowTotals = data.ajustes.map(row => DEPTS.reduce((s, d) => s + parseVal(row.values[d.key]), 0));
  const totalAjustes = rowTotals.reduce((s, v) => s + v, 0);
  const totalAjustado = totalLiqNum + totalAjustes;

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
      <PrintHeader title="AUDI LAPA/PINHEIROS" subtitle={`${MONTHS[month - 1]} de ${year} — Ajustes`} />
      <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 600, color: '#111111', width: '22%' }}>Descrição</th>
            {DEPTS.map(d => (
              <th key={d.key} style={{ textAlign: 'center', padding: '3px 4px', fontWeight: 600, color: '#111111', width: '11%' }}>{d.label}</th>
            ))}
            <th style={{ textAlign: 'center', padding: '3px 6px', fontWeight: 700, color: '#111111', backgroundColor: '#f1f5f9', width: '10%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {/* Lucro Líquido */}
          <tr className="dre-row-total" style={{ backgroundImage: 'linear-gradient(to bottom, #bb0a30 0%, #bb0a30 100%)', backgroundColor: '#bb0a30', color: 'black', borderBottom: '1px solid #9a0827' }}>
            <td style={{ padding: '2px 6px', fontWeight: 700 }}>Lucro Líquido do Exercício</td>
            {DEPTS.map(d => {
              const v = data[d.key].lucroLiquidoExercicio;
              return <td key={d.key} style={{ textAlign: 'right', padding: '2px 4px' }}>{v ? fmtNum(v) : '—'}</td>;
            })}
            <td className="dre-cell-total" style={{ textAlign: 'right', padding: '2px 6px', fontWeight: 700, backgroundImage: 'linear-gradient(to bottom, #9a0827 0%, #9a0827 100%)', backgroundColor: '#9a0827' }}>{totalLiquido ? fmtNum(totalLiquido) : '—'}</td>
          </tr>
          {/* Linhas dinâmicas */}
          {data.ajustes.map((row, i) => {
            const rTotal = rowTotals[i];
            return (
              <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#111111' }}>
                <td style={{ padding: '2px 14px' }}>{row.label || '—'}</td>
                {DEPTS.map(d => (
                  <td key={d.key} style={{ textAlign: 'right', padding: '2px 4px' }}>
                    {parseVal(row.values[d.key]) !== 0 ? parseVal(row.values[d.key]).toLocaleString('pt-BR') : '—'}
                  </td>
                ))}
                <td style={{ textAlign: 'right', padding: '2px 6px', fontWeight: 700, backgroundColor: '#f8fafc', color: '#111111' }}>
                  {rTotal !== 0 ? rTotal.toLocaleString('pt-BR') : '—'}
                </td>
              </tr>
            );
          })}
          {/* Resultado Ajustado */}
          <tr className="dre-row-total" style={{ backgroundImage: 'linear-gradient(to bottom, #bb0a30 0%, #bb0a30 100%)', backgroundColor: '#bb0a30', color: 'black' }}>
            <td style={{ padding: '3px 6px', fontWeight: 700 }}>RESULTADO DO PERÍODO AJUSTADO</td>
            {DEPTS.map(d => {
              const liq = parseVal(data[d.key].lucroLiquidoExercicio);
              const adj = data.ajustes.reduce((s, r) => s + parseVal(r.values[d.key]), 0);
              const total = liq + adj;
              return <td key={d.key} style={{ textAlign: 'right', padding: '2px 4px' }}>{total !== 0 ? total.toLocaleString('pt-BR') : '—'}</td>;
            })}
            <td className="dre-cell-total" style={{ textAlign: 'right', padding: '2px 6px', fontWeight: 700, backgroundImage: 'linear-gradient(to bottom, #9a0827 0%, #9a0827 100%)', backgroundColor: '#9a0827' }}>
              {totalAjustado !== 0 ? totalAjustado.toLocaleString('pt-BR') : '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Célula Editável ──────────────────────────────────────────────────────────

function EditableCell({
  value,
  onChange,
  isTotal = false,
  isNegative = false,
  isQuant = false,
}: {
  value: string;
  onChange: (v: string) => void;
  isTotal?: boolean;
  isNegative?: boolean;
  isQuant?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');

  const numVal = parseFloat(value.replace(/\./g, '').replace(',', '.'));
  const isNeg  = !isNaN(numVal) && numVal < 0;
  const display = value ? fmtNum(value) : '';

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }

  function commitEdit() {
    onChange(draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
        className={`w-full text-right bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 outline-none text-xs ${isTotal ? 'text-slate-800' : ''}`}
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      title="Clique para editar"
      className={`block w-full text-right cursor-pointer rounded px-1 py-0.5 hover:bg-yellow-50 hover:ring-1 hover:ring-yellow-200 transition-colors min-w-[5rem] ${
        isNeg ? 'text-red-600' : ''
      } ${isTotal ? (isNeg ? 'text-red-700' : 'text-black') : ''} ${!value ? 'text-slate-300' : ''}`}
    >
      {display || (isQuant ? '—' : '—')}
    </span>
  );
}
