import { useEffect, useMemo, useState } from 'react';
import { Edit3, Loader2 } from 'lucide-react';
import {
  createEmptyDreVwRow,
  loadDreVw,
  saveDreVw,
  type DreVwDept,
  type DreVwRow,
} from './dreVwStorage';
import {
  createEmptyDreAudiRow,
  loadDreAudi,
  saveDreAudi,
  type DreAudiDept,
  type DreAudiRow,
} from './dreAudiStorage';
import { loadDREDataAsync } from '@/lib/dbStorage';
import type { Department } from '@/lib/dataStorage';

interface DiagnostivoTabProps {
  year: number;
  month: number;
}

type MarcaTab = 'vw' | 'audi';
type BaseComparacao = 'acumulada' | 'mes-anterior';
type RadarLevel = 'ok' | 'yellow' | 'red' | 'na';

type DepartamentoTab = { id: string; label: string };

type RadarLine = {
  id: string;
  label: string;
  field: keyof DreVwDept;
  tipo: 'volume' | 'receita' | 'despesa';
  monitorar?: boolean;
};

type RadarCell = {
  val: number;
  base: number;
  mom: number | null;
  z: number;
  vert: number;
  deltaVert: number;
  level: RadarLevel;
  noBase: boolean;
};

type RadarLineResult = {
  id: string;
  label: string;
  tipo: 'volume' | 'receita' | 'despesa';
  vals: number[];
  cells?: RadarCell[];
};

const MONTHS_LABEL = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const VW_DEPARTMENTS: DepartamentoTab[] = [
  { id: 'resumo-geral', label: 'Resumo Geral' },
  { id: 'veiculos-novos', label: 'Veiculos Novos' },
  { id: 'venda-direta', label: 'Venda Direta' },
  { id: 'veiculos-usados', label: 'Veiculos Usados' },
  { id: 'pecas-acessorios', label: 'Pecas e Acessorios' },
  { id: 'oficina', label: 'Oficina / Assist. Tecnica' },
  { id: 'funilaria', label: 'Funilaria' },
  { id: 'administracao', label: 'Administracao' },
  { id: 'ajustes', label: 'Ajustes' },
];

const AUDI_DEPARTMENTS: DepartamentoTab[] = [
  { id: 'resumo-geral', label: 'Resumo Geral' },
  { id: 'veiculos-novos', label: 'Veiculos Novos' },
  { id: 'veiculos-usados', label: 'Veiculos Usados' },
  { id: 'pecas-acessorios', label: 'Pecas e Acessorios' },
  { id: 'oficina', label: 'Oficina / Assist. Tecnica' },
  { id: 'funilaria', label: 'Funilaria' },
  { id: 'administracao', label: 'Administracao' },
  { id: 'ajustes', label: 'Ajustes' },
];

const VW_DEPT_KEYS = ['novos', 'direta', 'usados', 'pecas', 'oficina', 'funilaria', 'adm'] as const;
const AUDI_DEPT_KEYS = ['novos', 'usados', 'pecas', 'oficina', 'funilaria', 'adm'] as const;

const VW_DEPT_TO_EXEC: Partial<Record<(typeof VW_DEPT_KEYS)[number], Department>> = {
  novos: 'novos',
  direta: 'vendaDireta',
  usados: 'usados',
  pecas: 'pecas',
  oficina: 'oficina',
  funilaria: 'funilaria',
  adm: 'administracao',
};

const AUDI_DEPT_TO_EXEC: Partial<Record<(typeof AUDI_DEPT_KEYS)[number], Department>> = {
  novos: 'novos',
  usados: 'usados',
  pecas: 'pecas',
  oficina: 'oficina',
  funilaria: 'funilaria',
  adm: 'administracao',
};

const DESCRICAO_TO_FIELD: Record<string, keyof DreVwDept> = {
  'VOLUME DE VENDAS': 'quant',
  'RECEITA OPERACIONAL LIQUIDA': 'receitaOperacionalLiquida',
  'CUSTO OPERACIONAL DA RECEITA': 'custoOperacionalReceita',
  'LUCRO (PREJUIZO) OPERACIONAL BRUTO': 'lucroPrejOperacionalBruto',
  'OUTRAS RECEITAS OPERACIONAIS': 'outrasReceitasOperacionais',
  'OUTRAS DESPESAS OPERACIONAIS': 'outrasDespesasOperacionais',
  'MARGEM DE CONTRIBUICAO': 'margemContribuicao',
  'MARGEM DE CONTRIBUIÇÃO': 'margemContribuicao',
  'DESPESAS C/ PESSOAL': 'despPessoal',
  'DESPESAS C/ SERV. DE TERCEIROS': 'despServTerceiros',
  'DESPESAS C/ OCUPACAO': 'despOcupacao',
  'DESPESAS C/ OCUPAÇÃO': 'despOcupacao',
  'DESPESAS C/ FUNCIONAMENTO': 'despFuncionamento',
  'DESPESAS C/ VENDAS': 'despVendas',
};

const RADAR_LINES: RadarLine[] = [
  { id: 'volume', label: 'Volume de Vendas', field: 'quant', tipo: 'volume' },
  { id: 'rol', label: 'Receita Operacional Liquida', field: 'receitaOperacionalLiquida', tipo: 'receita' },
  { id: 'cmv', label: '(-) Custo Operacional da Receita', field: 'custoOperacionalReceita', tipo: 'despesa', monitorar: true },
  { id: 'outras_rec', label: 'Outras Receitas Operacionais', field: 'outrasReceitasOperacionais', tipo: 'receita' },
  { id: 'outras_desp', label: '(-) Outras Despesas Operacionais', field: 'outrasDespesasOperacionais', tipo: 'despesa', monitorar: true },
  { id: 'pessoal', label: '(-) Despesas c/ Pessoal', field: 'despPessoal', tipo: 'despesa', monitorar: true },
  { id: 'terceiros', label: '(-) Despesas c/ Serv. de Terceiros', field: 'despServTerceiros', tipo: 'despesa', monitorar: true },
  { id: 'ocupacao', label: '(-) Despesas c/ Ocupacao', field: 'despOcupacao', tipo: 'despesa', monitorar: true },
  { id: 'funcionamento', label: '(-) Despesas c/ Funcionamento', field: 'despFuncionamento', tipo: 'despesa', monitorar: true },
  { id: 'vendas', label: '(-) Despesas c/ Vendas', field: 'despVendas', tipo: 'despesa', monitorar: true },
];

const LEVEL_COLOR: Record<RadarLevel, { bg: string; dot: string; txt: string }> = {
  na: { bg: 'transparent', dot: '#94a3b8', txt: '#64748b' },
  ok: { bg: 'transparent', dot: '#3d5a3d', txt: '#1a2b1a' },
  yellow: { bg: 'rgba(193,154,40,0.14)', dot: '#c19a28', txt: '#7a5e00' },
  red: { bg: 'rgba(168,50,40,0.16)', dot: '#a83228', txt: '#8a1f16' },
};

function parseVal(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString('pt-BR');
}

function pct(v: number | null, d = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(d).replace('.', ',')}%`;
}

function mean(a: number[]): number {
  if (!a.length) return 0;
  return a.reduce((s, x) => s + x, 0) / a.length;
}

function std(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

function hasDeptData(dept: Record<string, string>): boolean {
  return Object.values(dept).some(v => v !== '');
}

function getBaseIndices(i: number, base: BaseComparacao): number[] {
  if (i === 0) return [];
  return base === 'mes-anterior' ? [i - 1] : Array.from({ length: i }, (_, k) => k);
}

function isDeptSpecific(id: string): boolean {
  return !['resumo-geral', 'ajustes'].includes(id);
}

function buildDeptFromExec(dreData: any[] | null, monthIndex: number): Record<string, string> {
  const dept: Record<string, string> = {};
  if (!dreData) return dept;

  for (const line of dreData) {
    const desc = ((line.descricao as string) || (line.label as string) || '').toUpperCase().trim();
    const field = DESCRICAO_TO_FIELD[desc];
    if (!field) continue;

    const values: number[] = line.meses || line.values || [];
    const value = values[monthIndex];
    if (value !== undefined && value !== null && value !== 0) dept[field] = String(value);
  }

  return dept;
}

export function DiagnostivoTab({ year, month }: DiagnostivoTabProps) {
  const [marcaTab, setMarcaTab] = useState<MarcaTab>('vw');
  const [departamentoAtivo, setDepartamentoAtivo] = useState('resumo-geral');
  const [baseComparacao, setBaseComparacao] = useState<BaseComparacao>('acumulada');
  const [limiteSigma, setLimiteSigma] = useState(1.3);
  const [limiteVertical, setLimiteVertical] = useState(0.1);
  const [limiteMoM, setLimiteMoM] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState(false);
  const [vwRows, setVwRows] = useState<DreVwRow[]>([]);
  const [audiRows, setAudiRows] = useState<DreAudiRow[]>([]);
  const [hoverCell, setHoverCell] = useState<string | null>(null);

  const selectedMonth = month === 0 ? 12 : month;
  const visibleMonthIdx = useMemo(() => Array.from({ length: selectedMonth }, (_, i) => i), [selectedMonth]);
  const periodLabel = month === 0 ? `Ano ${year}` : `${MONTHS_LABEL[month - 1]}/${year}`;

  const departments = marcaTab === 'vw' ? VW_DEPARTMENTS : AUDI_DEPARTMENTS;

  const activeDeptKey = useMemo(() => {
    const map: Record<string, string> = {
      'veiculos-novos': 'novos',
      'venda-direta': 'direta',
      'veiculos-usados': 'usados',
      'pecas-acessorios': 'pecas',
      oficina: 'oficina',
      funilaria: 'funilaria',
      administracao: 'adm',
    };
    return map[departamentoAtivo] ?? null;
  }, [departamentoAtivo]);

  useEffect(() => {
    async function loadRows() {
      setLoading(true);
      const yr = year as 2024 | 2025 | 2026 | 2027;
      const months = Array.from({ length: 12 }, (_, i) => i + 1);

      const [vwKv, audiKv, vwExec, audiExec] = await Promise.all([
        Promise.all(months.map(m => loadDreVw(year, m))),
        Promise.all(months.map(m => loadDreAudi(year, m))),
        Promise.all(VW_DEPT_KEYS.map(k => loadDREDataAsync(yr, VW_DEPT_TO_EXEC[k]!, 'vw').then(d => ({ k, d })))),
        Promise.all(AUDI_DEPT_KEYS.map(k => loadDREDataAsync(yr, AUDI_DEPT_TO_EXEC[k]!, 'audi').then(d => ({ k, d })))),
      ]);

      const vwExecMap: Record<string, any[] | null> = {};
      for (const { k, d } of vwExec) vwExecMap[k] = d;

      const audiExecMap: Record<string, any[] | null> = {};
      for (const { k, d } of audiExec) audiExecMap[k] = d;

      const vwLoaded = months.map((m, i) => {
        const kv = vwKv[i] ?? createEmptyDreVwRow(year, m);
        const row = { ...kv } as DreVwRow;

        for (const deptKey of VW_DEPT_KEYS) {
          const current = (row as any)[deptKey] as Record<string, string>;
          if (!hasDeptData(current)) {
            (row as any)[deptKey] = { ...current, ...buildDeptFromExec(vwExecMap[deptKey] ?? null, m - 1) };
          }
        }

        return row;
      });

      const audiLoaded = months.map((m, i) => {
        const kv = audiKv[i] ?? createEmptyDreAudiRow(year, m);
        const row = { ...kv } as DreAudiRow;

        for (const deptKey of AUDI_DEPT_KEYS) {
          const current = (row as any)[deptKey] as Record<string, string>;
          if (!hasDeptData(current)) {
            (row as any)[deptKey] = { ...current, ...buildDeptFromExec(audiExecMap[deptKey] ?? null, m - 1) };
          }
        }

        return row;
      });

      setVwRows(vwLoaded);
      setAudiRows(audiLoaded);
      setLoading(false);
    }

    loadRows();
  }, [year]);

  const rows = marcaTab === 'vw' ? vwRows : audiRows;

  const radar = useMemo(() => {
    if (!rows.length || departamentoAtivo === 'ajustes') return null;

    const aggregateDepts = marcaTab === 'vw' ? VW_DEPT_KEYS : AUDI_DEPT_KEYS;

    const getLineVal = (monthIdx: number, field: keyof DreVwDept): number => {
      const row = rows[monthIdx];
      if (!row) return 0;

      if (departamentoAtivo === 'resumo-geral') {
        return aggregateDepts.reduce((sum, deptKey) => {
          if (deptKey === 'adm' && field === 'receitaOperacionalLiquida') return sum;
          return sum + parseVal((row as any)[deptKey]?.[field]);
        }, 0);
      }

      if (!activeDeptKey) return 0;
      return parseVal((row as any)[activeDeptKey]?.[field]);
    };

    const linhas: RadarLineResult[] = RADAR_LINES.map(line => ({
      id: line.id,
      label: line.label,
      tipo: line.tipo,
      vals: visibleMonthIdx.map(i => getLineVal(i, line.field)),
    }));

    const rolVals = linhas.find(l => l.id === 'rol')?.vals ?? [];
    const volumeVals = linhas.find(l => l.id === 'volume')?.vals ?? [];
    const mcVals = visibleMonthIdx.map(i => getLineVal(i, 'margemContribuicao'));
    const mcPct = visibleMonthIdx.map((_, i) => (rolVals[i] ? (mcVals[i] / rolVals[i]) * 100 : 0));

    const analisadas = linhas.map(line => {
      if (!RADAR_LINES.find(l => l.id === line.id)?.monitorar) return line;

      const valsAbs = line.vals.map(v => Math.abs(v));
      const cells: RadarCell[] = line.vals.map((_, i) => {
        const baseIdx = getBaseIndices(i, baseComparacao);

        if (!baseIdx.length) {
          return {
            val: valsAbs[i],
            base: valsAbs[i],
            mom: null,
            z: 0,
            vert: rolVals[i] ? (valsAbs[i] / rolVals[i]) * 100 : 0,
            deltaVert: 0,
            level: 'na',
            noBase: true,
          };
        }

        const baseVals = baseIdx.map(idx => valsAbs[idx]);
        const m = mean(baseVals);
        const s = std(baseVals);
        const z = s > 0 ? (valsAbs[i] - m) / s : 0;

        const prev = valsAbs[i - 1] || 0;
        const mom = prev ? ((valsAbs[i] - prev) / prev) * 100 : null;

        const vert = rolVals[i] ? (valsAbs[i] / rolVals[i]) * 100 : 0;
        const baseVert = mean(baseIdx.map(idx => {
          const rol = rolVals[idx] || 0;
          return rol ? (valsAbs[idx] / rol) * 100 : 0;
        }));
        const deltaVert = vert - baseVert;

        const flags = Number(Math.abs(z) >= limiteSigma)
          + Number(Math.abs(deltaVert) >= limiteVertical)
          + Number(mom != null && Math.abs(mom) >= limiteMoM);
        const level: RadarLevel = flags >= 2 ? 'red' : flags === 1 ? 'yellow' : 'ok';

        return { val: valsAbs[i], base: m, mom, z, vert, deltaVert, level, noBase: false };
      });

      return { ...line, cells };
    });

    const alertas = analisadas
      .flatMap(line =>
        (line.cells ?? [])
          .map((cell, i) => ({ line, cell, i }))
          .filter(({ cell }) => cell.level === 'yellow' || cell.level === 'red')
          .map(({ line, cell, i }) => ({
            conta: line.label.replace('(-) ', ''),
            mes: MONTHS_LABEL[visibleMonthIdx[i]],
            level: cell.level as 'yellow' | 'red',
            z: cell.z,
            mom: cell.mom,
            deltaVert: cell.deltaVert,
            val: cell.val,
            base: cell.base,
            severidade: Math.abs(cell.z) + Math.abs(cell.deltaVert) * 2 + (cell.level === 'red' ? 5 : 0),
          })),
      )
      .sort((a, b) => b.severidade - a.severidade);

    const mcVar = mcVals.map((_, i) => {
      if (i === 0) return { dR: null as number | null, dPct: null as number | null, dPctPct: null as number | null };
      const prev = mcVals[i - 1];
      return {
        dR: mcVals[i] - prev,
        dPct: prev ? ((mcVals[i] - prev) / Math.abs(prev)) * 100 : null,
        dPctPct: mcPct[i] - mcPct[i - 1],
      };
    });

    const decomp = mcVals.map((_, i) => {
      if (i === 0) return null;
      const prevVol = volumeVals[i - 1] || 0;
      if (!prevVol) return { efeitoVolume: 0, efeitoMargem: mcVals[i] - mcVals[i - 1] };
      const mcUnitPrev = mcVals[i - 1] / prevVol;
      const efeitoVolume = (volumeVals[i] - volumeVals[i - 1]) * mcUnitPrev;
      const efeitoMargem = mcVals[i] - mcVals[i - 1] - efeitoVolume;
      return { efeitoVolume, efeitoMargem };
    });

    return { linhas: analisadas, alertas, mcVals, mcPct, mcVar, decomp };
  }, [rows, marcaTab, departamentoAtivo, activeDeptKey, visibleMonthIdx, baseComparacao, limiteSigma, limiteVertical, limiteMoM]);

  async function saveEditedMonth(monthIdx: number) {
    if (!isDeptSpecific(departamentoAtivo)) return;
    const row = rows[monthIdx];
    if (!row) return;

    setSaving(true);
    if (marcaTab === 'vw') await saveDreVw(row as DreVwRow);
    else await saveDreAudi(row as DreAudiRow);
    setSaving(false);
  }

  function setVal(lineId: string, monthIdx: number, raw: string) {
    if (!isDeptSpecific(departamentoAtivo) || !activeDeptKey) return;

    const line = RADAR_LINES.find(l => l.id === lineId);
    if (!line) return;

    const parsed = parseFloat(String(raw).replace(/\./g, '').replace(',', '.')) || 0;
    const value = line.tipo === 'despesa' ? -Math.abs(parsed) : parsed;

    if (marcaTab === 'vw') {
      setVwRows(prev => prev.map((row, idx) => {
        if (idx !== monthIdx) return row;

        const next = { ...row } as DreVwRow;
        const dept = { ...(next as any)[activeDeptKey] } as DreVwDept;
        (dept as any)[line.field] = value === 0 ? '' : String(value);
        (next as any)[activeDeptKey] = dept;
        return next;
      }));
      return;
    }

    setAudiRows(prev => prev.map((row, idx) => {
      if (idx !== monthIdx) return row;

      const next = { ...row } as DreAudiRow;
      const dept = { ...(next as any)[activeDeptKey] } as DreAudiDept;
      (dept as any)[line.field] = value === 0 ? '' : String(value);
      (next as any)[activeDeptKey] = dept;
      return next;
    }));
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-[1440px] mx-auto p-4 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Diagnostivo</h2>
          <p className="text-sm text-slate-500">{periodLabel} — {marcaTab === 'vw' ? 'VW Norte' : 'Audi'}</p>
        </div>

        <div className="flex gap-2">
          {([['vw', 'VW'], ['audi', 'Audi']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setMarcaTab(id);
                setDepartamentoAtivo('resumo-geral');
              }}
              className={`px-5 py-2 text-sm font-semibold rounded-lg border transition-all ${
                marcaTab === id
                  ? 'text-white shadow-sm border-transparent bg-slate-700'
                  : 'text-slate-500 bg-white border-slate-200 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-200 px-2 pt-2 bg-white">
            <div className="flex flex-wrap items-center gap-1">
              {departments.map(dep => {
                if (marcaTab === 'audi' && dep.id === 'venda-direta') return null;
                const active = departamentoAtivo === dep.id;
                return (
                  <button
                    key={dep.id}
                    onClick={() => {
                      setDepartamentoAtivo(dep.id);
                      setEditando(false);
                    }}
                    className={`px-4 py-2 text-xs font-semibold rounded-t-lg border border-b-0 transition-all ${
                      active
                        ? 'text-slate-800 bg-slate-50 border-slate-300 -mb-px'
                        : 'text-slate-500 bg-white border-transparent hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {dep.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-6 py-3 text-white font-bold" style={{ backgroundColor: marcaTab === 'vw' ? '#001e50' : '#bb0a30' }}>
            Diagnostivo — {marcaTab === 'vw' ? 'VW Norte' : 'Audi'}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando dados...
            </div>
          ) : departamentoAtivo === 'ajustes' ? (
            <div className="p-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                A aba Ajustes não entra no Radar de Variância nesta versão.
              </div>
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-wrap items-end gap-4 text-xs">
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-600">Base de comparação</span>
                  <select
                    value={baseComparacao}
                    onChange={e => setBaseComparacao(e.target.value as BaseComparacao)}
                    className="border border-slate-200 rounded-md px-2 py-1 text-sm"
                  >
                    <option value="acumulada">Média acumulada (Jan até mês anterior)</option>
                    <option value="mes-anterior">Mês anterior</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1 min-w-[180px]">
                  <span className="font-semibold text-slate-600">Sensibilidade σ: {limiteSigma.toFixed(1)}</span>
                  <input type="range" min="0.8" max="2.5" step="0.1" value={limiteSigma} onChange={e => setLimiteSigma(parseFloat(e.target.value))} />
                </label>

                <label className="flex flex-col gap-1 min-w-[180px]">
                  <span className="font-semibold text-slate-600">Limite vertical: {limiteVertical.toFixed(2)} p.p.</span>
                  <input type="range" min="0.03" max="0.5" step="0.01" value={limiteVertical} onChange={e => setLimiteVertical(parseFloat(e.target.value))} />
                </label>

                <label className="flex flex-col gap-1 min-w-[180px]">
                  <span className="font-semibold text-slate-600">Limite m/m: {limiteMoM.toFixed(0)}%</span>
                  <input type="range" min="10" max="50" step="1" value={limiteMoM} onChange={e => setLimiteMoM(parseFloat(e.target.value))} />
                </label>

                <button
                  onClick={() => setEditando(v => !v)}
                  className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-800 text-white font-semibold"
                  disabled={!isDeptSpecific(departamentoAtivo)}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {editando ? 'Concluir edição' : 'Editar dados'}
                </button>
              </div>

              {saving && <div className="text-xs text-emerald-700 font-medium">Salvando alterações...</div>}

              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-3">Alertas priorizados</h3>
                {!radar || radar.alertas.length === 0 ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    Nenhuma anomalia acima dos limites configurados.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {radar.alertas.map((a, idx) => (
                      <div
                        key={idx}
                        className="rounded-md border px-3 py-2"
                        style={{ borderColor: LEVEL_COLOR[a.level].dot, borderLeftWidth: 4, background: LEVEL_COLOR[a.level].bg }}
                      >
                        <div className="flex justify-between items-center">
                          <strong style={{ color: LEVEL_COLOR[a.level].txt }}>{a.conta}</strong>
                          <span className="text-xs text-slate-500">{a.mes}</span>
                        </div>
                        <div className="text-xs text-slate-700 mt-1">
                          {a.mom != null && <>Variação m/m: <b>{pct(a.mom)}</b> · </>}
                          z-score: <b>{a.z.toFixed(1)}σ</b> · Δ vertical: <b>{a.deltaVert >= 0 ? '+' : ''}{a.deltaVert.toFixed(2)} p.p.</b>
                          <div className="text-[11px] text-slate-600 mt-0.5">R$ {fmt(a.val)} vs esperado R$ {fmt(a.base)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-3">DRE com mapa de calor de variância</h3>
                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="text-left px-3 py-2 min-w-[260px]">Descrição</th>
                        {visibleMonthIdx.map(i => (
                          <th key={i} className="px-3 py-2 text-right min-w-[120px]">{MONTHS_LABEL[i].toUpperCase()}/{year}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const ordered = radar?.linhas ?? [];
                        const idxFixas = ordered.findIndex(l => l.id === 'pessoal');
                        const beforeFixas = idxFixas >= 0 ? ordered.slice(0, idxFixas) : ordered;
                        const fixas = idxFixas >= 0 ? ordered.slice(idxFixas) : [];

                        const renderLine = (line: RadarLineResult) => (
                          <tr key={line.id} className="border-b border-slate-100">
                            <td className={`px-3 py-2 ${line.tipo !== 'despesa' ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>{line.label}</td>
                            {line.vals.map((v, i) => {
                              const cell = line.cells?.[i];
                              const key = `${line.id}-${i}`;
                              const isEditable = editando && isDeptSpecific(departamentoAtivo) && line.id !== 'volume' && line.id !== 'rol';
                              return (
                                <td
                                  key={key}
                                  className="px-3 py-2 text-right font-mono text-[11px] relative"
                                  style={{ background: cell ? LEVEL_COLOR[cell.level].bg : 'transparent' }}
                                  onMouseEnter={() => setHoverCell(key)}
                                  onMouseLeave={() => setHoverCell(null)}
                                >
                                  {isEditable ? (
                                    <input
                                      value={fmt(Math.abs(v))}
                                      onChange={e => setVal(line.id, visibleMonthIdx[i], e.target.value)}
                                      onBlur={() => saveEditedMonth(visibleMonthIdx[i])}
                                      className="w-[100px] border border-slate-200 rounded px-1 py-0.5 text-right"
                                    />
                                  ) : (
                                    <>
                                      {fmt(v)}
                                      {cell && cell.level !== 'ok' && cell.level !== 'na' && (
                                        <span className="inline-block w-1.5 h-1.5 rounded-full ml-1" style={{ background: LEVEL_COLOR[cell.level].dot }} />
                                      )}
                                    </>
                                  )}

                                  {hoverCell === key && cell && (
                                    <div className="absolute right-0 bottom-full mb-1 bg-slate-900 text-white rounded px-2 py-1 text-[10px] whitespace-nowrap z-10 text-left">
                                      {cell.noBase ? (
                                        <div>Sem base de comparação</div>
                                      ) : (
                                        <>
                                          <div>Valor: R$ {fmt(cell.val)}</div>
                                          <div>Esperado: R$ {fmt(cell.base)}</div>
                                          {cell.mom != null && <div>Var. m/m: {pct(cell.mom)}</div>}
                                          <div>z-score: {cell.z.toFixed(2)}σ</div>
                                          <div>% Receita: {pct(cell.vert, 2)}</div>
                                          <div>Δ vertical: {cell.deltaVert >= 0 ? '+' : ''}{cell.deltaVert.toFixed(2)} p.p.</div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );

                        return (
                          <>
                            {beforeFixas.map(renderLine)}

                            {radar && (
                              <>
                                <tr className="bg-slate-900 text-white font-bold">
                                  <td className="px-3 py-2">MARGEM DE CONTRIBUIÇÃO</td>
                                  {radar.mcVals.map((v, i) => <td key={i} className="px-3 py-2 text-right font-mono">{fmt(v)}</td>)}
                                </tr>
                                <tr className="bg-slate-800 text-slate-200 italic">
                                  <td className="px-3 py-2">% Margem de contribuição</td>
                                  {radar.mcPct.map((v, i) => <td key={i} className="px-3 py-2 text-right font-mono">{pct(v)}</td>)}
                                </tr>
                              </>
                            )}

                            {fixas.map(renderLine)}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {radar && (
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-3">Margem de Contribuição — variação e decomposição</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-md border border-slate-200 bg-white p-4">
                      <h4 className="font-semibold text-slate-700 mb-2">Variação mês a mês</h4>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-500">
                            <th className="text-left py-1">Mês</th>
                            <th className="text-right py-1">Δ R$</th>
                            <th className="text-right py-1">Δ %</th>
                            <th className="text-right py-1">Δ % MC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleMonthIdx.map((mIdx, i) => {
                            const v = radar.mcVar[i];
                            if (i === 0) {
                              return (
                                <tr key={mIdx} className="border-b border-slate-100">
                                  <td className="py-1">{MONTHS_LABEL[mIdx]}</td>
                                  <td className="py-1 text-right text-slate-400">base</td>
                                  <td className="py-1 text-right text-slate-400">—</td>
                                  <td className="py-1 text-right text-slate-400">—</td>
                                </tr>
                              );
                            }
                            const neg = (v.dR ?? 0) < 0;
                            return (
                              <tr key={mIdx} className="border-b border-slate-100">
                                <td className="py-1">{MONTHS_LABEL[mIdx]}</td>
                                <td className={`py-1 text-right font-mono ${neg ? 'text-red-700' : 'text-emerald-700'}`}>{(v.dR ?? 0) >= 0 ? '+' : ''}{fmt(v.dR ?? 0)}</td>
                                <td className={`py-1 text-right font-mono ${neg ? 'text-red-700' : 'text-emerald-700'}`}>{v.dPct != null ? `${v.dPct >= 0 ? '+' : ''}${pct(v.dPct)}` : '—'}</td>
                                <td className={`py-1 text-right font-mono ${(v.dPctPct ?? 0) < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{v.dPctPct != null ? `${v.dPctPct >= 0 ? '+' : ''}${v.dPctPct.toFixed(2).replace('.', ',')} p.p.` : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="rounded-md border border-slate-200 bg-white p-4">
                      <h4 className="font-semibold text-slate-700 mb-2">De onde veio a variação?</h4>
                      <p className="text-[11px] text-slate-500 mb-2">Volume (vender mais/menos) vs operação (margem unitária)</p>
                      {visibleMonthIdx.map((mIdx, i) => {
                        if (i === 0) return null;
                        const d = radar.decomp[i];
                        if (!d) return null;
                        const total = Math.abs(d.efeitoVolume) + Math.abs(d.efeitoMargem) || 1;
                        const wVol = (Math.abs(d.efeitoVolume) / total) * 100;
                        return (
                          <div key={mIdx} className="mb-3">
                            <div className="text-xs text-slate-600 mb-1">{MONTHS_LABEL[mIdx]}</div>
                            <div className="flex h-5 rounded overflow-hidden text-[10px] text-white font-mono">
                              <div style={{ width: `${wVol}%`, background: d.efeitoVolume >= 0 ? '#3d5a3d' : '#a83228' }} className="flex items-center justify-center min-w-[70px]">Vol {fmt(d.efeitoVolume)}</div>
                              <div style={{ width: `${100 - wVol}%`, background: d.efeitoMargem >= 0 ? '#5a7a9a' : '#c19a28' }} className="flex items-center justify-center min-w-[70px]">Ope {fmt(d.efeitoMargem)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
