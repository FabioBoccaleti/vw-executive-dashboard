import { useState, useEffect, useCallback } from 'react';
import { Save, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadDreAudi,
  saveDreAudi,
  createEmptyDreAudiRow,
  type DreAudiRow,
  type DreAudiDept,
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

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setDirty(false);
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

      function buildRow(y: number, m: number, kvRow: DreAudiRow | null): DreAudiRow {
        const row = createEmptyDreAudiRow(y, m);
        for (const d of DEPTS) {
          row[d.key] = buildDeptFromDREData(dreLookup[d.key]?.[y] ?? null, m - 1);
        }
        if (kvRow) {
          row.ajustes = kvRow.ajustes;
        }
        return row;
      }

      setData(buildRow(year, month, currentAjustes ?? null));
      setPrevData(periods.map((p, i) => buildRow(p.year, p.month, prevAjustesArr[i] ?? null)));
      setLoading(false);
    });
  }, [year, month]);

  // ── Save (somente ajustes) ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!data) return;
    setSaving(true);
    const ok = await saveDreAudi(data);
    setSaving(false);
    if (ok) {
      setDirty(false);
      toast.success('Ajustes salvos com sucesso!');
    } else {
      toast.error('Erro ao salvar. Tente novamente.');
    }
  }, [data]);

  const handleAjusteChange = useCallback(
    (dept: DeptKey, field: 'icmsSt' | 'honorariosAdvogados', value: string) => {
      setData(prev => {
        if (!prev) return prev;
        return { ...prev, ajustes: { ...prev.ajustes, [dept]: { ...prev.ajustes[dept], [field]: value } } };
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
          Ajustes Esporádicos
        </button>

        <div className="flex-1" />

        {/* Badge de sincronização */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[0.65rem] font-medium mr-2">
          <RefreshCw className="w-3 h-3" />
          Sincronizado com Dashboard Executivo
        </div>

        {/* Botão Salvar (apenas ajustes) */}
        <button
          disabled={!dirty || saving}
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors my-1.5 ${
            dirty
              ? 'bg-[#bb0a30] text-white hover:bg-[#990826]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? 'Salvando...' : 'Salvar ajustes'}
        </button>
      </div>

      {/* ── Conteúdo ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">

        {/* RESUMO GERAL — todas as colunas */}
        {activeSection === 'resumo' && (
          <ResumoTable
            data={data}
            deptList={deptList}
            year={year}
            month={month}
          />
        )}

        {/* DETALHE POR DEPARTAMENTO */}
        {DEPTS.map(d =>
          activeSection === d.key ? (
            <DeptTable
              key={d.key}
              deptKey={d.key}
              deptLabel={d.label}
              deptColor={d.color}
              dept={data[d.key]}
              prevDepts={prevData.map(row => row[d.key])}
              prevPeriods={getPrevPeriods(year, month, 3)}
              year={year}
              month={month}
            />
          ) : null
        )}

        {/* AJUSTES */}
        {(activeSection as string) === 'ajustes' && (
          <AjustesTable ajustes={data.ajustes} onChange={handleAjusteChange} data={data} year={year} month={month} />
        )}
      </div>
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
      <div className="bg-[#bb0a30] text-white px-6 py-3">
        <h2 className="font-bold text-base">AUDI LAPA/PINHEIROS</h2>
        <p className="text-xs text-red-200 mt-0.5">{MONTHS[month - 1]} de {year} — Demonstrativo de Resultados</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
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
            {DRE_LINES.map((line, idx) => {
              if (line.separator) {
                return <tr key={idx}><td colSpan={8} className="h-px bg-slate-100" /></tr>;
              }
              const isQuant = line.field === 'quant' && idx === 0;
              const rowClass = line.isTotal
                ? 'bg-slate-800 text-white font-bold'
                : line.isSubtotal
                ? 'bg-slate-100 font-semibold text-slate-700'
                : 'hover:bg-slate-50 text-slate-600';

              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`}>
                  <td className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''} ${line.isTotal ? 'text-white' : ''}`}>
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
                  <td className={`px-3 py-1.5 text-right font-semibold ${line.isTotal ? 'bg-slate-700 text-white' : 'bg-slate-50 text-slate-700'}`}>
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
}: {
  deptKey: DeptKey;
  deptLabel: string;
  deptColor: string;
  dept: DreAudiDept;
  prevDepts: DreAudiDept[];
  prevPeriods: { year: number; month: number }[];
  year: number;
  month: number;
}) {
  const totalCols = 1 + prevPeriods.length + 1 + 1 + 1; // desc + prev + atual + total + %H
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-3 text-white font-bold flex items-center gap-3 bg-[#bb0a30]">
        <span className="text-base">Audi Lapa/Pinheiros — {deptLabel}</span>
        <span className="text-xs opacity-75 font-normal">{MONTHS[month - 1]}/{year}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-52 min-w-[13rem]">Descrição</th>
              {prevPeriods.map(p => (
                <th key={`${p.year}-${p.month}`} className="text-center px-3 py-2.5 font-semibold text-slate-400 min-w-[8rem]">
                  {MONTHS[p.month - 1]}/{p.year}
                </th>
              ))}
              <th className="text-center px-3 py-2.5 font-semibold text-slate-700 min-w-[8rem]">
                {MONTHS[month - 1]}/{year}
              </th>
              <th className="text-center px-2 py-2.5 font-bold text-slate-600 min-w-[5.5rem] bg-slate-50 border-l border-slate-200">Var. M/M</th>
              <th className="text-center px-3 py-2.5 font-bold text-slate-700 min-w-[8rem] bg-slate-100">Total</th>
            </tr>
          </thead>
          <tbody>
            {DRE_LINES.map((line, idx) => {
              if (line.separator) {
                return <tr key={idx}><td colSpan={totalCols} className="h-px bg-slate-100" /></tr>;
              }
              const isQuant = line.field === 'quant' && idx === 0;
              const rowClass = line.isTotal
                ? 'bg-slate-800 text-white font-bold'
                : line.isSubtotal
                ? 'bg-slate-100 font-semibold text-slate-700'
                : 'hover:bg-slate-50 text-slate-600';

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
                } else {
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
              } else {
                const t = allDepts.reduce((s, d) => s + parseVal(d[line.field]), 0);
                totalStr = t !== 0 ? t.toLocaleString('pt-BR') : '—';
              }

              return (
                <tr key={idx} className={`border-b border-slate-100 ${rowClass}`}>
                  <td className={`px-4 py-1.5 ${line.indent ? 'pl-7' : ''}`}>{line.label}</td>
                  {prevDepts.map((pd, pi) => {
                    const v = pd[line.field];
                    const num = isQuant ? (parseInt(String(v)) || 0) : parseVal(v);
                    const display = isQuant
                      ? (num > 0 ? num.toString() : '—')
                      : (num !== 0 ? num.toLocaleString('pt-BR') : '—');
                    return (
                      <td key={pi} className={`px-3 py-1.5 text-right ${line.isTotal ? 'text-slate-300' : 'text-slate-400'}`}>
                        {display}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right">
                    {isQuant
                      ? ((parseInt(String(dept[line.field])) || 0) > 0 ? String(parseInt(String(dept[line.field]))) : '—')
                      : (parseVal(dept[line.field]) !== 0 ? parseVal(dept[line.field]).toLocaleString('pt-BR') : '—')
                    }
                  </td>
                  <td className={`px-2 py-1.5 text-right text-[0.68rem] border-l border-slate-200 ${line.isTotal ? 'text-slate-300' : 'text-slate-500'}`}>
                    {varMM || '—'}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${line.isTotal ? 'bg-slate-700 text-white' : 'bg-slate-50 text-slate-700'}`}>
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
  data,
  year,
  month,
}: {
  ajustes: DreAudiRow['ajustes'];
  onChange: (dept: DeptKey, field: 'icmsSt' | 'honorariosAdvogados', value: string) => void;
  data: DreAudiRow;
  year: number;
  month: number;
}) {
  const deptList = DEPTS.map(d => data[d.key]);
  const totalLiquido = sumDepts(deptList, 'lucroLiquidoExercicio');

  // Totais por linha
  const totalIcmsSt = DEPTS.reduce((s, d) => s + parseVal(ajustes[d.key].icmsSt), 0);
  const totalHonorarios = DEPTS.reduce((s, d) => s + parseVal(ajustes[d.key].honorariosAdvogados), 0);
  const totalLiqNum = parseVal(totalLiquido);
  const totalAjustado = totalLiqNum - totalIcmsSt + totalHonorarios;

  const colSpan = DEPTS.length + 2; // desc + depts + total

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-[#bb0a30] text-white px-6 py-3">
        <h2 className="font-bold text-base">AUDI LAPA/PINHEIROS</h2>
        <p className="text-xs text-red-200 mt-0.5">{MONTHS[month - 1]} de {year} — Ajustes Esporádicos</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
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
            {/* Lucro Líquido do Exercício */}
            <tr className="border-b border-red-900 text-white font-bold" style={{backgroundColor:'#bb0a30'}}>
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

            {/* ICMS ST */}
            <tr className="border-b border-slate-100 hover:bg-slate-50 text-slate-600">
              <td className="px-4 py-1.5 pl-7">(-) ICMS ST recebido do fabricante</td>
              {DEPTS.map(d => (
                <td key={d.key} className="px-2 py-1 text-right">
                  <EditableCell
                    value={ajustes[d.key].icmsSt}
                    onChange={v => onChange(d.key, 'icmsSt', v)}
                    isNegative
                  />
                </td>
              ))}
              <td className="px-3 py-1.5 text-right bg-slate-50 text-slate-700 font-semibold">
                {totalIcmsSt !== 0 ? totalIcmsSt.toLocaleString('pt-BR') : '—'}
              </td>
            </tr>

            {/* Honorários */}
            <tr className="border-b border-slate-100 hover:bg-slate-50 text-slate-600">
              <td className="px-4 py-1.5 pl-7">(+) Honorários advogados s/ ICMS ST recebido</td>
              {DEPTS.map(d => (
                <td key={d.key} className="px-2 py-1 text-right">
                  <EditableCell
                    value={ajustes[d.key].honorariosAdvogados}
                    onChange={v => onChange(d.key, 'honorariosAdvogados', v)}
                  />
                </td>
              ))}
              <td className="px-3 py-1.5 text-right bg-slate-50 text-slate-700 font-semibold">
                {totalHonorarios !== 0 ? totalHonorarios.toLocaleString('pt-BR') : '—'}
              </td>
            </tr>

            {/* Resultado Ajustado */}
            <tr className="text-white font-bold" style={{backgroundColor:'#bb0a30'}}>
              <td className="px-4 py-2">RESULTADO DO PERÍODO AJUSTADO</td>
              {DEPTS.map(d => {
                const liq = parseVal(data[d.key].lucroLiquidoExercicio);
                const icms = parseVal(ajustes[d.key].icmsSt);
                const hon = parseVal(ajustes[d.key].honorariosAdvogados);
                const ajustado = liq - icms + hon;
                return (
                  <td key={d.key} className="px-3 py-2 text-right">
                    {ajustado !== 0 ? ajustado.toLocaleString('pt-BR') : '—'}
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
      } ${isTotal ? (isNeg ? 'text-red-300' : 'text-white') : ''} ${!value ? 'text-slate-300' : ''}`}
    >
      {display || (isQuant ? '—' : '—')}
    </span>
  );
}
