import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Loader2, LockOpen, PenLine, Settings2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { apiLogin } from '@/lib/authClient';
import { loadDREDataAsync } from '@/lib/dbStorage';
import type { Department } from '@/lib/dataStorage';
import {
  type AnaliseBrand,
  type RateioCirculanteConfig,
  type RateioContabilAssinaturasYearData,
  type RateioDepartamentoBrandYearData,
  type RateioDepartamentoValores,
  type RateioEndividamentoBrandYearData,
  type RateioOutrosBancosLinha,
  type RateioOutrosBancosDepartamentosYearData,
  type RateioOutrosBancosYearData,
  type RateioResultadoLinha,
  type RateioResultadosBrandYearData,
  type RateioAssinaturaDigital,
  type RateioTaxaJurosYearData,
  loadRateioDepartamento,
  loadRateioEndividamento,
  loadMultipleMonthsAnaliseDespesas,
  loadRateioContabilAssinaturas,
  loadRateioContabilOutrosBancosAssinaturas,
  loadRateioContabilOutrosBancos,
  loadRateioContabilOutrosBancosDepartamentos,
  loadRateioCirculanteConfig,
  loadRateioResultados,
  loadRateioTaxaJuros,
  saveRateioContabilAssinaturas,
  saveRateioContabilOutrosBancosAssinaturas,
  saveRateioContabilOutrosBancos,
  saveRateioContabilOutrosBancosDepartamentos,
  saveRateioCirculanteConfig,
  saveRateioDepartamento,
  saveRateioEndividamento,
  saveRateioResultados,
  saveRateioTaxaJuros,
} from './analiseDespesasStorage';
import { loadDreVw, type DreVwRow } from '../ResumoDREDashboard/dreVwStorage';
import { loadDreAudi, type DreAudiRow } from '../ResumoDREDashboard/dreAudiStorage';

type CirculanteGroup = 'ativo' | 'passivo';
type MonthChoice = 'all' | number;
type MainTab = 'rotativo' | 'departamento' | 'contabil' | 'contabilOutrosBancos';
type DepartmentKey = keyof RateioDepartamentoValores;
type VwDreDeptKey = keyof Omit<DreVwRow, 'periodo' | 'ajustes'>;
type AudiDreDeptKey = keyof Omit<DreAudiRow, 'periodo' | 'ajustes'>;

interface ParsedAccount {
  conta: string;
  desc: string;
  saldoAtual: number;
}

type AccountsByConta = Record<string, ParsedAccount>;
type AccountsByMonth = Record<number, AccountsByConta>;

interface RateioDespesasFinanceirasPageProps {
  onBackToRateios: () => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const DEFAULT_CONFIG: RateioCirculanteConfig = {
  shared: { ativo: [], passivo: [] },
  vw: { ativo: [], passivo: [] },
  audi: { ativo: [], passivo: [] },
};

const BRAND_LABEL: Record<AnaliseBrand, string> = {
  vw: 'VW',
  audi: 'Audi',
};

const BRAND_PANEL_BORDER_CLASS: Record<AnaliseBrand, string> = {
  vw: 'border-blue-400',
  audi: 'border-red-400',
};

const DEPARTMENT_ORDER: DepartmentKey[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria'];
const DEPARTMENT_LABELS: Record<DepartmentKey, string> = {
  novos: 'Novos',
  vendaDireta: 'Venda Direta',
  usados: 'Usados',
  pecas: 'Peças',
  oficina: 'Oficina',
  funilaria: 'Funilaria',
};
const JUROS_CONTA_CONTABIL = '5.5.7.01.01.008 - Juros S/ Estoques';
const OUTROS_BANCOS_DEBITO_CONTA = '5.5.7.01.01.008';
const OUTROS_BANCOS_CREDITO_CONTA = '5.5.7.01.01.001';

const EMPTY_RESULTS_BY_MONTH: RateioResultadosBrandYearData = {
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
  7: [],
  8: [],
  9: [],
  10: [],
  11: [],
  12: [],
};

const EMPTY_ENDIVIDAMENTO_BY_MONTH: RateioEndividamentoBrandYearData = {
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
  7: [],
  8: [],
  9: [],
  10: [],
  11: [],
  12: [],
};

const EMPTY_TAXA_JUROS_BY_MONTH: RateioTaxaJurosYearData = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
  6: 0,
  7: 0,
  8: 0,
  9: 0,
  10: 0,
  11: 0,
  12: 0,
};

const EMPTY_DEPARTAMENTO_VALORES: RateioDepartamentoValores = {
  novos: 0,
  vendaDireta: 0,
  usados: 0,
  pecas: 0,
  oficina: 0,
  funilaria: 0,
};

const EMPTY_DEPARTAMENTO_BY_MONTH: RateioDepartamentoBrandYearData = {
  1: {},
  2: {},
  3: {},
  4: {},
  5: {},
  6: {},
  7: {},
  8: {},
  9: {},
  10: {},
  11: {},
  12: {},
};

const EMPTY_ASSINATURAS_FINANCEIRO_BY_MONTH: RateioContabilAssinaturasYearData = {
  1: null,
  2: null,
  3: null,
  4: null,
  5: null,
  6: null,
  7: null,
  8: null,
  9: null,
  10: null,
  11: null,
  12: null,
};

const EMPTY_OUTROS_BANCOS_BY_MONTH: RateioOutrosBancosYearData = {
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
  7: [],
  8: [],
  9: [],
  10: [],
  11: [],
  12: [],
};

const DEFAULT_OUTROS_BANCOS_DEPARTMENTS = DEPARTMENT_ORDER;

const EMPTY_OUTROS_BANCOS_DEPARTMENTS_BY_MONTH: RateioOutrosBancosDepartamentosYearData = {
  1: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
  2: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
  3: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
  4: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
  5: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
  6: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
  7: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
  8: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
  9: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
  10: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
  11: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
  12: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
};

const VW_DRE_DEPT_KEYS: VwDreDeptKey[] = ['novos', 'direta', 'usados', 'pecas', 'oficina', 'funilaria', 'adm'];
const AUDI_DRE_DEPT_KEYS: AudiDreDeptKey[] = ['novos', 'usados', 'pecas', 'oficina', 'funilaria', 'adm'];
const VW_DRE_DEPT_TO_DEPARTMENT: Record<VwDreDeptKey, Department> = {
  novos: 'novos',
  direta: 'vendaDireta',
  usados: 'usados',
  pecas: 'pecas',
  oficina: 'oficina',
  funilaria: 'funilaria',
  adm: 'administracao',
};
const AUDI_DRE_DEPT_TO_DEPARTMENT: Record<AudiDreDeptKey, Department> = {
  novos: 'novos',
  usados: 'usados',
  pecas: 'pecas',
  oficina: 'oficina',
  funilaria: 'funilaria',
  adm: 'administracao',
};

function parseBalanceteCirculante(text: string): AccountsByConta {
  const out: AccountsByConta = {};
  const lines = text.split('\n').filter((line) => line.trim());

  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;

    const [nivel, conta, desc, , , , saldoAtual] = parts;
    if (nivel?.trim() === 'T') continue;

    const contaId = (conta ?? '').trim();
    if (!contaId) continue;

    const isAtivo = contaId.startsWith('1.1');
    const isPassivo = contaId.startsWith('2.1');
    if (!isAtivo && !isPassivo) continue;

    const saldo = parseFloat((saldoAtual || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
    out[contaId] = {
      conta: contaId,
      desc: (desc ?? '').trim(),
      saldoAtual: saldo,
    };
  }

  return out;
}

function uniqueSorted(items: string[]): string[] {
  return Array.from(new Set(items)).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function cloneResultsByMonth(data?: RateioResultadosBrandYearData): RateioResultadosBrandYearData {
  const out: RateioResultadosBrandYearData = {
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: [], 11: [], 12: [],
  };
  if (!data) return out;
  for (const month of MONTHS) {
    out[month] = (data[month] ?? []).map((row) => ({ ...row }));
  }
  return out;
}

function cloneEndividamentoByMonth(data?: RateioEndividamentoBrandYearData): RateioEndividamentoBrandYearData {
  const out: RateioEndividamentoBrandYearData = {
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: [], 11: [], 12: [],
  };
  if (!data) return out;
  for (const month of MONTHS) {
    out[month] = Array.from(new Set(data[month] ?? []));
  }
  return out;
}

function cloneDepartamentoByMonth(data?: RateioDepartamentoBrandYearData): RateioDepartamentoBrandYearData {
  const out: RateioDepartamentoBrandYearData = {
    1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {}, 8: {}, 9: {}, 10: {}, 11: {}, 12: {},
  };
  if (!data) return out;
  for (const month of MONTHS) {
    const monthData = data[month] ?? {};
    const rows: Record<string, RateioDepartamentoValores> = {};
    for (const [conta, valores] of Object.entries(monthData)) {
      rows[conta] = { ...EMPTY_DEPARTAMENTO_VALORES, ...valores };
    }
    out[month] = rows;
  }
  return out;
}

function cloneDepartamentoValores(data?: RateioDepartamentoValores): RateioDepartamentoValores {
  return { ...EMPTY_DEPARTAMENTO_VALORES, ...(data ?? {}) };
}

function cloneOutrosBancosByMonth(data?: RateioOutrosBancosYearData): RateioOutrosBancosYearData {
  const out: RateioOutrosBancosYearData = {
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: [], 11: [], 12: [],
  };
  if (!data) return out;
  for (const month of MONTHS) {
    out[month] = (data[month] ?? []).map((row) => ({
      id: row.id,
      instituicao: row.instituicao,
      juros: Number.isFinite(Number(row.juros)) ? Number(row.juros) : 0,
    }));
  }
  return out;
}

function cloneOutrosBancosDepartmentsByMonth(data?: RateioOutrosBancosDepartamentosYearData): RateioOutrosBancosDepartamentosYearData {
  const out: RateioOutrosBancosDepartamentosYearData = {
    1: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
    2: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
    3: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
    4: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
    5: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
    6: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
    7: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
    8: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
    9: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
    10: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
    11: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
    12: { vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS], audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS] },
  };

  if (!data) return out;

  for (const month of MONTHS) {
    const monthData = data[month] ?? { vw: [], audi: [] };
    out[month] = {
      vw: Array.from(new Set((monthData.vw ?? []).filter((dept): dept is DepartmentKey => DEPARTMENT_ORDER.includes(dept as DepartmentKey)))) as DepartmentKey[],
      audi: Array.from(new Set((monthData.audi ?? []).filter((dept): dept is DepartmentKey => DEPARTMENT_ORDER.includes(dept as DepartmentKey)))) as DepartmentKey[],
    };
  }

  return out;
}

function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseManualValue(raw: string): number {
  if (!raw.trim()) return 0;
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePercentValue(raw: string): number {
  if (!raw.trim()) return 0;
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function parseDreNumber(value: string | number | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDreLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function getLucroLiquidoFromDreDataLines(lines: any[] | null, monthIndex: number): number {
  if (!Array.isArray(lines)) return 0;
  const target = lines.find((item) => {
    const label = String(item?.descricao ?? item?.label ?? '');
    return normalizeDreLabel(label) === 'LUCRO LIQUIDO DO EXERCICIO';
  });
  if (!target) return 0;

  const meses = Array.isArray(target?.meses) ? target.meses : Array.isArray(target?.values) ? target.values : [];
  const raw = meses[monthIndex];
  return Number.isFinite(Number(raw)) ? Number(raw) : 0;
}

function hasVwDeptData(row: DreVwRow | null, deptKey: VwDreDeptKey): boolean {
  if (!row) return false;
  return Object.values(row[deptKey]).some((value) => String(value ?? '').trim() !== '');
}

function hasAudiDeptData(row: DreAudiRow | null, deptKey: AudiDreDeptKey): boolean {
  if (!row) return false;
  return Object.values(row[deptKey]).some((value) => String(value ?? '').trim() !== '');
}

function getSelectedAccounts(config: RateioCirculanteConfig, brand: AnaliseBrand, group: CirculanteGroup): string[] {
  return uniqueSorted([...(config.shared[group] ?? []), ...(config[brand][group] ?? [])]);
}

function getBrandMonthTotal(
  brand: AnaliseBrand,
  month: number,
  config: RateioCirculanteConfig,
  accountsByMonth: AccountsByMonth,
  resultRows: RateioResultadoLinha[],
  resultadoPeriodo: number,
): number {
  const monthAccounts = accountsByMonth[month] ?? {};
  const ativoTotal = getSelectedAccounts(config, brand, 'ativo').reduce(
    (sum, conta) => sum + (monthAccounts[conta]?.saldoAtual ?? 0),
    0,
  );
  const passivoTotal = getSelectedAccounts(config, brand, 'passivo').reduce(
    (sum, conta) => sum + (monthAccounts[conta]?.saldoAtual ?? 0),
    0,
  );
  const resultadoAjustado = resultadoPeriodo + resultRows.reduce((sum, row) => sum + row.value, 0);
  return ativoTotal + passivoTotal + resultadoAjustado;
}

function getBrandMonthTotalGeral(
  brand: AnaliseBrand,
  month: number,
  config: RateioCirculanteConfig,
  accountsByMonth: AccountsByMonth,
  resultRows: RateioResultadoLinha[],
  resultadoPeriodo: number,
): number {
  const monthAccounts = accountsByMonth[month] ?? {};
  const ativoTotal = getSelectedAccounts(config, brand, 'ativo').reduce(
    (sum, conta) => sum + (monthAccounts[conta]?.saldoAtual ?? 0),
    0,
  );
  const passivoTotal = getSelectedAccounts(config, brand, 'passivo').reduce(
    (sum, conta) => sum + (monthAccounts[conta]?.saldoAtual ?? 0),
    0,
  );
  const resultadoAjustado = resultadoPeriodo + resultRows.reduce((sum, row) => sum + row.value, 0);
  const resultadoUsoCirculante = -resultadoAjustado;
  return ativoTotal + passivoTotal + resultadoUsoCirculante;
}

function getBrandMonthEndividamentoTotal(
  brand: AnaliseBrand,
  month: number,
  selectedContas: string[],
  accountsByMonth: AccountsByMonth,
): number {
  const monthAccounts = accountsByMonth[month] ?? {};
  const raw = selectedContas.reduce((sum, conta) => sum + (monthAccounts[conta]?.saldoAtual ?? 0), 0);
  return raw > 0 ? 0 : raw;
}

function getRowDepartamentoTotal(valores: RateioDepartamentoValores): number {
  return DEPARTMENT_ORDER.reduce((sum, departamento) => sum + (Number(valores[departamento]) || 0), 0);
}

function getRowDepartamentoDiff(saldoAtual: number, valores: RateioDepartamentoValores): number {
  return saldoAtual - getRowDepartamentoTotal(valores);
}

function ConfigSection({
  title,
  contas,
  selected,
  onToggle,
}: {
  title: string;
  contas: Array<{ conta: string; desc: string }>;
  selected: string[];
  onToggle: (conta: string) => void;
}) {
  const [busca, setBusca] = useState('');
  const filtered = busca.trim()
    ? contas.filter(
        (item) =>
          item.conta.toLowerCase().includes(busca.toLowerCase()) ||
          (item.desc || '').toLowerCase().includes(busca.toLowerCase()),
      )
    : contas;

  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <h4 className="text-sm font-semibold text-slate-700 mb-2">{title}</h4>
      <input
        type="text"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar conta ou descrição..."
        className="w-full mb-2 h-8 px-2 text-sm rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="max-h-64 overflow-auto space-y-1 pr-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-500">
            {contas.length === 0 ? 'Nenhuma conta disponível neste grupo para o ano selecionado.' : 'Nenhuma conta encontrada para a busca.'}
          </p>
        ) : (
          filtered.map((item) => (
            <label key={item.conta} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(item.conta)}
                onChange={() => onToggle(item.conta)}
                className="mt-0.5"
              />
              <span>
                <strong>{item.conta}</strong> - {item.desc || 'Sem descrição'}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

function MonthTaxaJurosControl({
  month,
  taxaPercent,
  onApply,
}: {
  month: number;
  taxaPercent: number;
  onApply: (month: number, value: number) => void;
}) {
  const [draftTaxa, setDraftTaxa] = useState(String(taxaPercent).replace('.', ','));

  useEffect(() => {
    setDraftTaxa(String(taxaPercent).replace('.', ','));
  }, [taxaPercent, month]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-slate-700">Taxa de Juros do Mês (%)</span>
      <input
        type="text"
        value={draftTaxa}
        onChange={(e) => setDraftTaxa(e.target.value)}
        className="h-8 w-28 px-2 text-sm rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        onClick={() => onApply(month, parsePercentValue(draftTaxa))}
        className="h-8 px-3 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
      >
        Aplicar do mês em diante
      </button>
      <span className="text-xs text-slate-500">Atualiza este mês e os próximos meses do ano.</span>
    </div>
  );
}

function BrandMonthTable({
  brand,
  month,
  config,
  accountsByMonth,
  descriptions,
  resultadoPeriodo,
  resultRows,
  endividamentoContas,
  onAddResultLine,
  onRemoveResultLine,
  canRemoveResultLine,
  onChangeResultLineValue,
  onAddEndividamentoConta,
  onRemoveEndividamentoConta,
  circulantePercent,
  taxaJurosPercent,
  endividamentoBaseMarca,
  jurosCalculadoMarca,
}: {
  brand: AnaliseBrand;
  month: number;
  config: RateioCirculanteConfig;
  accountsByMonth: AccountsByMonth;
  descriptions: Record<string, string>;
  resultadoPeriodo: number;
  resultRows: RateioResultadoLinha[];
  endividamentoContas: string[];
  onAddResultLine: (brand: AnaliseBrand, month: number, label: string, value: number) => void;
  onRemoveResultLine: (brand: AnaliseBrand, month: number, lineId: string) => void;
  canRemoveResultLine: (brand: AnaliseBrand, month: number, lineId: string) => boolean;
  onChangeResultLineValue: (brand: AnaliseBrand, month: number, lineId: string, value: number) => void;
  onAddEndividamentoConta: (brand: AnaliseBrand, month: number, conta: string) => void;
  onRemoveEndividamentoConta: (brand: AnaliseBrand, month: number, conta: string) => void;
  circulantePercent: number;
  taxaJurosPercent: number;
  endividamentoBaseMarca: number;
  jurosCalculadoMarca: number;
}) {
  const [newLineName, setNewLineName] = useState('');
  const [newLineValue, setNewLineValue] = useState('0');
  const [endividamentoContaToAdd, setEndividamentoContaToAdd] = useState('');

  function getGroupData(group: CirculanteGroup) {
    const selectedContas = getSelectedAccounts(config, brand, group);
    const monthAccounts = accountsByMonth[month] ?? {};

    const rows = selectedContas.map((conta) => {
      const hit = monthAccounts[conta];
      return {
        conta,
        desc: hit?.desc || descriptions[conta] || 'Conta não encontrada no balancete do mês',
        value: hit?.saldoAtual ?? 0,
      };
    });

    const total = rows.reduce((sum, row) => sum + row.value, 0);

    return { rows, total };
  }

  const ativoData = getGroupData('ativo');
  const passivoData = getGroupData('passivo');
  const totalExtras = resultRows.reduce((sum, row) => sum + row.value, 0);
  const resultadoAjustado = resultadoPeriodo + totalExtras;
  const resultadoUsoCirculante = -resultadoAjustado;
  const totalGeral = ativoData.total + passivoData.total + resultadoUsoCirculante;
  const endividamentoSelectableContas = uniqueSorted([
    ...ativoData.rows.map((row) => row.conta),
    ...passivoData.rows.map((row) => row.conta),
  ]);
  const endividamentoRows = endividamentoContas.map((conta) => {
    const monthAccounts = accountsByMonth[month] ?? {};
    const hit = monthAccounts[conta];
    return {
      conta,
      desc: hit?.desc || descriptions[conta] || 'Conta não encontrada no balancete do mês',
      value: hit?.saldoAtual ?? 0,
    };
  });
  const totalEndividamentoRaw = endividamentoRows.reduce((sum, row) => sum + row.value, 0);
  const totalEndividamento = totalEndividamentoRaw > 0 ? 0 : totalEndividamentoRaw;

  function renderGroup(title: string, rows: Array<{ conta: string; desc: string; value: number }>, total: number) {

    return (
      <div className="mb-4">
        <h4 className="text-sm font-bold text-slate-700 mb-2">{title}</h4>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Conta</th>
                <th className="text-left px-3 py-2 font-semibold">Descrição</th>
                <th className="text-right px-3 py-2 font-semibold">Saldo Atual</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-slate-500 text-center">
                    Nenhuma conta selecionada para {title.toLowerCase()}.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.conta} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{row.conta}</td>
                    <td className="px-3 py-2 text-slate-700">{row.desc}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(row.value)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={2} className="px-3 py-2 text-right font-semibold text-slate-700">
                  Total {title}
                </td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  function renderResultadosTable() {
    return (
      <div className="mb-1">
        <h4 className="text-sm font-bold text-slate-700 mb-2">Tabela de Resultados</h4>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Linha</th>
                <th className="text-right px-3 py-2 font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100 bg-slate-50/60">
                <td className="px-3 py-2 font-semibold text-slate-700">Resultado do Período</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(resultadoPeriodo)}</td>
              </tr>
              {resultRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{row.label}</td>
                  <td className="px-3 py-2 text-right">
                    {(() => {
                      const isRemovable = canRemoveResultLine(brand, month, row.id);

                      return (
                    <div className="flex items-center justify-end gap-2">
                      <input
                        type="text"
                        value={String(row.value).replace('.', ',')}
                        onChange={(e) => onChangeResultLineValue(brand, month, row.id, parseManualValue(e.target.value))}
                        className="w-36 h-8 px-2 text-sm text-right rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveResultLine(brand, month, row.id)}
                        disabled={!isRemovable}
                        title={isRemovable ? 'Excluir esta linha deste mês em diante' : 'Exclusao disponivel apenas no mes em que a linha foi criada'}
                        className={`h-8 px-2 text-xs font-semibold rounded border ${
                          isRemovable
                            ? 'border-red-300 text-red-700 hover:bg-red-50'
                            : 'border-slate-200 text-slate-400 cursor-not-allowed bg-slate-50'
                        }`}
                      >
                        Excluir
                      </button>
                    </div>
                      );
                    })()}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-100 bg-slate-50">
                <td className="px-3 py-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newLineName}
                      onChange={(e) => setNewLineName(e.target.value)}
                      placeholder="Nome da nova linha"
                      className="h-8 px-2 text-sm rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={newLineValue}
                      onChange={(e) => setNewLineValue(e.target.value)}
                      placeholder="Valor"
                      className="h-8 px-2 text-sm rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => {
                        const cleanName = newLineName.trim();
                        if (!cleanName) return;
                        onAddResultLine(brand, month, cleanName, parseManualValue(newLineValue));
                        setNewLineName('');
                        setNewLineValue('0');
                      }}
                      className="h-8 px-3 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Incluir linha
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-500 align-middle">
                  Replica automaticamente ate dezembro
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-blue-50">
                <td className="px-3 py-2 text-right font-bold text-slate-800">Resultado do Periodo Ajustado</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(resultadoAjustado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  function renderTotalTable() {
    return (
      <div className="mt-4">
        <h4 className="text-sm font-bold text-slate-700 mb-2">Tabela de Total</h4>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Composição</th>
                <th className="text-right px-3 py-2 font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700">Total Ativo Circulante</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(ativoData.total)}</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700">Total Passivo Circulante</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(passivoData.total)}</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700">Resultado do Periodo Ajustado</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(resultadoUsoCirculante)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-emerald-50">
                <td className="px-3 py-2 text-right font-bold text-slate-800">Total Geral</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(totalGeral)}</td>
              </tr>
              <tr className="border-t border-slate-200 bg-sky-50">
                <td className="px-3 py-2 text-right font-semibold text-slate-700">% Uso Circulante {BRAND_LABEL[brand]}</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">
                  {circulantePercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  function renderEndividamentoTable() {
    const contasDisponiveisParaAdicionar = endividamentoSelectableContas.filter(
      (conta) => !endividamentoContas.includes(conta),
    );

    return (
      <div className="mt-4">
        <h4 className="text-sm font-bold text-slate-700 mb-2">Tabela de Endividamento Banco Volks Credito Rotativo</h4>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select
            value={endividamentoContaToAdd}
            onChange={(e) => setEndividamentoContaToAdd(e.target.value)}
            className="h-8 px-2 text-sm rounded border border-slate-300 bg-white text-slate-700"
          >
            <option value="">Selecionar conta de Ativo/Passivo</option>
            {contasDisponiveisParaAdicionar.map((conta) => (
              <option key={conta} value={conta}>
                {conta} - {descriptions[conta] || 'Sem descrição'}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (!endividamentoContaToAdd) return;
              onAddEndividamentoConta(brand, month, endividamentoContaToAdd);
              setEndividamentoContaToAdd('');
            }}
            className="h-8 px-3 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
            disabled={!endividamentoContaToAdd}
          >
            Adicionar conta
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Conta</th>
                <th className="text-left px-3 py-2 font-semibold">Descrição</th>
                <th className="text-right px-3 py-2 font-semibold">Saldo Atual</th>
                <th className="text-center px-3 py-2 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {endividamentoRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-slate-500 text-center">
                    Nenhuma conta selecionada para endividamento.
                  </td>
                </tr>
              ) : (
                endividamentoRows.map((row) => (
                  <tr key={row.conta} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{row.conta}</td>
                    <td className="px-3 py-2 text-slate-700">{row.desc}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(row.value)}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => onRemoveEndividamentoConta(brand, month, row.conta)}
                        className="h-7 px-2 text-xs rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-amber-50">
                <td colSpan={2} className="px-3 py-2 text-right font-bold text-slate-800">Total Endividamento Banco Volks</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(totalEndividamento)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  function renderRateioJurosTable() {
    return (
      <div className="mt-4">
        <h4 className="text-sm font-bold text-slate-700 mb-2">Tabela de Rateio de Juros do Rotativo</h4>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Composição</th>
                <th className="text-right px-3 py-2 font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700">Endividamento Base da Marca (valor absoluto)</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(endividamentoBaseMarca)}</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700">Taxa de Juros do Mês (%)</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">
                  {taxaJurosPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%
                </td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700">Juros Calculado da Marca</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(jurosCalculadoMarca)}</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700">% Uso Circulante da Marca</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">
                  {circulantePercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-violet-50">
                <td className="px-3 py-2 text-right font-bold text-slate-800">Juros da Marca</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(jurosCalculadoMarca)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border-2 ${BRAND_PANEL_BORDER_CLASS[brand]} rounded-xl shadow-sm p-4`}>
      <h3 className="text-base font-bold text-slate-800 mb-3">
        {BRAND_LABEL[brand]} - {MONTH_NAMES[month - 1]}
      </h3>
      {renderGroup('Ativo Circulante', ativoData.rows, ativoData.total)}
      {renderGroup('Passivo Circulante', passivoData.rows, passivoData.total)}
      {renderResultadosTable()}
      {renderTotalTable()}
      {renderEndividamentoTable()}
      {renderRateioJurosTable()}
    </div>
  );
}

function DepartamentoLinhasTable({
  brand,
  month,
  title,
  rows,
  allocations,
  onChangeAllocation,
}: {
  brand: AnaliseBrand;
  month: number;
  title: string;
  rows: Array<{ conta: string; desc: string; saldoAtual: number }>;
  allocations: Record<string, RateioDepartamentoValores>;
  onChangeAllocation: (brand: AnaliseBrand, month: number, conta: string, departamento: DepartmentKey, value: number) => void;
}) {
  const baseTotal = rows.reduce((sum, row) => sum + row.saldoAtual, 0);
  const percentBase = Math.abs(baseTotal);
  const departmentTotals = DEPARTMENT_ORDER.reduce((acc, dept) => {
    acc[dept] = rows.reduce((sum, row) => sum + (Number(allocations[row.conta]?.[dept]) || 0), 0);
    return acc;
  }, {} as Record<DepartmentKey, number>);

  const anyError = rows.some((row) => getRowDepartamentoDiff(row.saldoAtual, allocations[row.conta] ?? EMPTY_DEPARTAMENTO_VALORES) !== 0);

  return (
    <div className="mb-4">
      <h4 className="text-sm font-bold text-slate-700 mb-2">{title}</h4>
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-600 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Conta</th>
              <th className="text-left px-3 py-2 font-semibold">Descrição</th>
              <th className="text-right px-3 py-2 font-semibold">Saldo Atual</th>
              {DEPARTMENT_ORDER.map((dept) => (
                <th key={dept} className="text-right px-2 py-2 font-semibold whitespace-nowrap">{DEPARTMENT_LABELS[dept]}</th>
              ))}
              <th className="text-right px-3 py-2 font-semibold">Total Deptos</th>
              <th className="text-right px-3 py-2 font-semibold">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3 + DEPARTMENT_ORDER.length + 2} className="px-3 py-4 text-center text-slate-500">Nenhuma conta selecionada para este grupo.</td>
              </tr>
            ) : (
              rows.map((row) => {
                const values = cloneDepartamentoValores(allocations[row.conta]);
                const totalDeptos = getRowDepartamentoTotal(values);
                const diff = getRowDepartamentoDiff(row.saldoAtual, values);
                const rowError = diff !== 0;

                return (
                  <tr key={row.conta} className={`border-t border-slate-100 ${rowError ? 'bg-red-50/40' : ''}`}>
                    <td className="px-3 py-2 font-mono text-[11px]">{row.conta}</td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.desc}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(row.saldoAtual)}</td>
                    {DEPARTMENT_ORDER.map((dept) => (
                      <td key={dept} className="px-2 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={Number(values[dept] ?? 0)}
                          onChange={(e) => onChangeAllocation(brand, month, row.conta, dept, Number(e.target.value) || 0)}
                          className="w-24 h-8 px-2 text-right rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                    ))}
                    <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${rowError ? 'text-red-700' : 'text-slate-800'}`}>
                      {formatCurrency(totalDeptos)}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${rowError ? 'text-red-700' : 'text-emerald-700'}`}>
                      {formatCurrency(diff)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className={`border-t-2 border-slate-200 bg-slate-50 ${anyError ? 'bg-red-50' : ''}`}>
              <td colSpan={3} className="px-3 py-2 text-right font-bold text-slate-800">Total {title}</td>
              {DEPARTMENT_ORDER.map((dept) => (
                <td key={dept} className="px-2 py-2 text-right font-bold text-slate-900 whitespace-nowrap">{formatCurrency(departmentTotals[dept])}</td>
              ))}
              <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(rows.reduce((sum, row) => sum + row.saldoAtual, 0))}</td>
              <td className={`px-3 py-2 text-right font-bold ${anyError ? 'text-red-700' : 'text-emerald-700'}`}>{anyError ? 'Há diferenças' : 'OK'}</td>
            </tr>
            <tr className="border-t border-slate-100 bg-sky-50">
              <td colSpan={3} className="px-3 py-2 text-right font-semibold text-slate-700">% sobre base circulante</td>
              {DEPARTMENT_ORDER.map((dept) => (
                <td key={dept} className="px-2 py-2 text-right font-bold text-slate-900 whitespace-nowrap">
                  {percentBase > 0 ? `${((departmentTotals[dept] / percentBase) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '0,00%'}
                </td>
              ))}
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function RateioDespesasFinanceirasPage({ onBackToRateios }: RateioDespesasFinanceirasPageProps) {
  const { session } = useAuth();
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  const [activeTab, setActiveTab] = useState<MainTab>('rotativo');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<MonthChoice>('all');
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<RateioCirculanteConfig>(DEFAULT_CONFIG);
  const [draftConfig, setDraftConfig] = useState<RateioCirculanteConfig>(DEFAULT_CONFIG);
  const [vwData, setVwData] = useState<AccountsByMonth>({});
  const [audiData, setAudiData] = useState<AccountsByMonth>({});
  const [vwResults, setVwResults] = useState<RateioResultadosBrandYearData>(cloneResultsByMonth(EMPTY_RESULTS_BY_MONTH));
  const [audiResults, setAudiResults] = useState<RateioResultadosBrandYearData>(cloneResultsByMonth(EMPTY_RESULTS_BY_MONTH));
  const [vwEndividamento, setVwEndividamento] = useState<RateioEndividamentoBrandYearData>(
    cloneEndividamentoByMonth(EMPTY_ENDIVIDAMENTO_BY_MONTH),
  );
  const [audiEndividamento, setAudiEndividamento] = useState<RateioEndividamentoBrandYearData>(
    cloneEndividamentoByMonth(EMPTY_ENDIVIDAMENTO_BY_MONTH),
  );
  const [taxaJurosByMonth, setTaxaJurosByMonth] = useState<RateioTaxaJurosYearData>({ ...EMPTY_TAXA_JUROS_BY_MONTH });
  const [vwDepartamento, setVwDepartamento] = useState<RateioDepartamentoBrandYearData>(cloneDepartamentoByMonth(EMPTY_DEPARTAMENTO_BY_MONTH));
  const [audiDepartamento, setAudiDepartamento] = useState<RateioDepartamentoBrandYearData>(cloneDepartamentoByMonth(EMPTY_DEPARTAMENTO_BY_MONTH));
  const [vwLucroLiquidoMensal, setVwLucroLiquidoMensal] = useState<Record<number, number>>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
  });
  const [audiLucroLiquidoMensal, setAudiLucroLiquidoMensal] = useState<Record<number, number>>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
  });
  const [assinaturasFinanceiroByMonth, setAssinaturasFinanceiroByMonth] = useState<RateioContabilAssinaturasYearData>({
    ...EMPTY_ASSINATURAS_FINANCEIRO_BY_MONTH,
  });
  const [assinaturasFinanceiroOutrosBancosByMonth, setAssinaturasFinanceiroOutrosBancosByMonth] = useState<RateioContabilAssinaturasYearData>({
    ...EMPTY_ASSINATURAS_FINANCEIRO_BY_MONTH,
  });
  const [outrosBancosByMonth, setOutrosBancosByMonth] = useState<RateioOutrosBancosYearData>(
    cloneOutrosBancosByMonth(EMPTY_OUTROS_BANCOS_BY_MONTH),
  );
  const [outrosBancosDepartamentosByMonth, setOutrosBancosDepartamentosByMonth] = useState<RateioOutrosBancosDepartamentosYearData>(
    cloneOutrosBancosDepartmentsByMonth(EMPTY_OUTROS_BANCOS_DEPARTMENTS_BY_MONTH),
  );
  const [newInstituicaoByMonth, setNewInstituicaoByMonth] = useState<Record<number, string>>({
    1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '', 9: '', 10: '', 11: '', 12: '',
  });
  const [newJurosByMonth, setNewJurosByMonth] = useState<Record<number, string>>({
    1: '0', 2: '0', 3: '0', 4: '0', 5: '0', 6: '0', 7: '0', 8: '0', 9: '0', 10: '0', 11: '0', 12: '0',
  });
  const [assinaFinanceiroDialog, setAssinaFinanceiroDialog] = useState<{
    month: number;
    senha: string;
    loading: boolean;
    erro: string | null;
  } | null>(null);
  const [reabrirAssinaturaDialog, setReabrirAssinaturaDialog] = useState<{
    month: number;
    senha: string;
    loading: boolean;
    erro: string | null;
  } | null>(null);
  const [assinaFinanceiroOutrosBancosDialog, setAssinaFinanceiroOutrosBancosDialog] = useState<{
    month: number;
    senha: string;
    loading: boolean;
    erro: string | null;
  } | null>(null);
  const [reabrirAssinaturaOutrosBancosDialog, setReabrirAssinaturaOutrosBancosDialog] = useState<{
    month: number;
    senha: string;
    loading: boolean;
    erro: string | null;
  } | null>(null);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [ativoOptions, setAtivoOptions] = useState<Array<{ conta: string; desc: string }>>([]);
  const [passivoOptions, setPassivoOptions] = useState<Array<{ conta: string; desc: string }>>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      try {
        const [
          savedConfig,
          rawVwMonths,
          rawAudiMonths,
          savedVwResults,
          savedAudiResults,
          savedVwEndividamento,
          savedAudiEndividamento,
          savedTaxaJuros,
          savedVwDepartamento,
          savedAudiDepartamento,
          savedContabilAssinaturas,
          savedContabilOutrosBancosAssinaturas,
          savedOutrosBancos,
          savedOutrosBancosDepartamentos,
          loadedVwKvRows,
          loadedAudiKvRows,
          loadedVwDreByDept,
          loadedAudiDreByDept,
        ] = await Promise.all([
          loadRateioCirculanteConfig(),
          loadMultipleMonthsAnaliseDespesas('vw', selectedYear, MONTHS),
          loadMultipleMonthsAnaliseDespesas('audi', selectedYear, MONTHS),
          loadRateioResultados('vw', selectedYear),
          loadRateioResultados('audi', selectedYear),
          loadRateioEndividamento('vw', selectedYear),
          loadRateioEndividamento('audi', selectedYear),
          loadRateioTaxaJuros(selectedYear),
          loadRateioDepartamento('vw', selectedYear),
          loadRateioDepartamento('audi', selectedYear),
          loadRateioContabilAssinaturas(selectedYear),
          loadRateioContabilOutrosBancosAssinaturas(selectedYear),
          loadRateioContabilOutrosBancos(selectedYear),
          loadRateioContabilOutrosBancosDepartamentos(selectedYear),
          Promise.all(MONTHS.map((m) => loadDreVw(selectedYear, m))),
          Promise.all(MONTHS.map((m) => loadDreAudi(selectedYear, m))),
          Promise.all(
            VW_DRE_DEPT_KEYS.map((deptKey) =>
              loadDREDataAsync(selectedYear as 2024 | 2025 | 2026 | 2027, VW_DRE_DEPT_TO_DEPARTMENT[deptKey], 'vw').then((dre) => ({ deptKey, dre })),
            ),
          ),
          Promise.all(
            AUDI_DRE_DEPT_KEYS.map((deptKey) =>
              loadDREDataAsync(selectedYear as 2024 | 2025 | 2026 | 2027, AUDI_DRE_DEPT_TO_DEPARTMENT[deptKey], 'audi').then((dre) => ({ deptKey, dre })),
            ),
          ),
        ]);

        if (cancelled) return;

        const nextVwData: AccountsByMonth = {};
        const nextAudiData: AccountsByMonth = {};
        const descMap: Record<string, string> = {};
        const ativoMap = new Map<string, string>();
        const passivoMap = new Map<string, string>();

        for (const month of MONTHS) {
          const vwRaw = rawVwMonths[month];
          const audiRaw = rawAudiMonths[month];

          const vwParsed = vwRaw ? parseBalanceteCirculante(vwRaw) : {};
          const audiParsed = audiRaw ? parseBalanceteCirculante(audiRaw) : {};

          nextVwData[month] = vwParsed;
          nextAudiData[month] = audiParsed;

          const merged = { ...vwParsed, ...audiParsed };
          for (const account of Object.values(merged)) {
            if (!descMap[account.conta] && account.desc) descMap[account.conta] = account.desc;
            if (account.conta.startsWith('1.1')) ativoMap.set(account.conta, account.desc);
            if (account.conta.startsWith('2.1')) passivoMap.set(account.conta, account.desc);
          }
        }

        const lastMonthWithData = MONTHS.reduce((lastMonth, month) => {
          const vwRaw = String(rawVwMonths[month] ?? '').trim();
          const audiRaw = String(rawAudiMonths[month] ?? '').trim();
          return vwRaw || audiRaw ? month : lastMonth;
        }, 0);

        setConfig(savedConfig);
        setDraftConfig(savedConfig);
        setSelectedMonth(lastMonthWithData > 0 ? lastMonthWithData : 'all');
        setVwData(nextVwData);
        setAudiData(nextAudiData);
        setVwResults(cloneResultsByMonth(savedVwResults));
        setAudiResults(cloneResultsByMonth(savedAudiResults));
        setVwEndividamento(cloneEndividamentoByMonth(savedVwEndividamento));
        setAudiEndividamento(cloneEndividamentoByMonth(savedAudiEndividamento));
        setTaxaJurosByMonth({ ...EMPTY_TAXA_JUROS_BY_MONTH, ...savedTaxaJuros });
        setVwDepartamento(cloneDepartamentoByMonth(savedVwDepartamento));
        setAudiDepartamento(cloneDepartamentoByMonth(savedAudiDepartamento));
        const vwDreLookup = loadedVwDreByDept.reduce((acc, item) => {
          acc[item.deptKey] = item.dre;
          return acc;
        }, {} as Record<VwDreDeptKey, any[] | null>);
        const audiDreLookup = loadedAudiDreByDept.reduce((acc, item) => {
          acc[item.deptKey] = item.dre;
          return acc;
        }, {} as Record<AudiDreDeptKey, any[] | null>);

        const nextVwMensal: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };
        const nextAudiMensal: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };

        for (const month of MONTHS) {
          const monthIndex = month - 1;
          const vwKv = loadedVwKvRows[monthIndex] ?? null;
          const audiKv = loadedAudiKvRows[monthIndex] ?? null;

          nextVwMensal[month] = VW_DRE_DEPT_KEYS.reduce((sum, deptKey) => {
            if (hasVwDeptData(vwKv, deptKey)) {
              return sum + parseDreNumber(vwKv?.[deptKey]?.lucroLiquidoExercicio);
            }
            return sum + getLucroLiquidoFromDreDataLines(vwDreLookup[deptKey] ?? null, monthIndex);
          }, 0);

          nextAudiMensal[month] = AUDI_DRE_DEPT_KEYS.reduce((sum, deptKey) => {
            if (hasAudiDeptData(audiKv, deptKey)) {
              return sum + parseDreNumber(audiKv?.[deptKey]?.lucroLiquidoExercicio);
            }
            return sum + getLucroLiquidoFromDreDataLines(audiDreLookup[deptKey] ?? null, monthIndex);
          }, 0);
        }

        setVwLucroLiquidoMensal(nextVwMensal);
        setAudiLucroLiquidoMensal(nextAudiMensal);
        setAssinaturasFinanceiroByMonth({ ...EMPTY_ASSINATURAS_FINANCEIRO_BY_MONTH, ...savedContabilAssinaturas });
        setAssinaturasFinanceiroOutrosBancosByMonth({ ...EMPTY_ASSINATURAS_FINANCEIRO_BY_MONTH, ...savedContabilOutrosBancosAssinaturas });
        setOutrosBancosByMonth(cloneOutrosBancosByMonth(savedOutrosBancos));
        setOutrosBancosDepartamentosByMonth(cloneOutrosBancosDepartmentsByMonth(savedOutrosBancosDepartamentos));
        setDescriptions(descMap);
        setAtivoOptions(
          Array.from(ativoMap.entries())
            .map(([conta, desc]) => ({ conta, desc }))
            .sort((a, b) => a.conta.localeCompare(b.conta, 'pt-BR', { numeric: true })),
        );
        setPassivoOptions(
          Array.from(passivoMap.entries())
            .map(([conta, desc]) => ({ conta, desc }))
            .sort((a, b) => a.conta.localeCompare(b.conta, 'pt-BR', { numeric: true })),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  function toggleDraft(scope: 'shared' | AnaliseBrand, group: CirculanteGroup, conta: string) {
    setDraftConfig((prev) => {
      const base = prev[scope][group] ?? [];
      const exists = base.includes(conta);
      const updated = exists ? base.filter((item) => item !== conta) : [...base, conta];
      return {
        ...prev,
        [scope]: {
          ...prev[scope],
          [group]: uniqueSorted(updated),
        },
      };
    });
  }

  async function handleSaveConfig() {
    setSavingConfig(true);
    try {
      await saveRateioCirculanteConfig(draftConfig);
      setConfig(draftConfig);
      setShowConfig(false);
    } finally {
      setSavingConfig(false);
    }
  }

  function applyResultsUpdate(
    brand: AnaliseBrand,
    updater: (current: RateioResultadosBrandYearData) => RateioResultadosBrandYearData,
  ) {
    const current = brand === 'vw' ? vwResults : audiResults;
    const next = updater(cloneResultsByMonth(current));
    if (brand === 'vw') {
      setVwResults(next);
    } else {
      setAudiResults(next);
    }
    void saveRateioResultados(brand, selectedYear, next);
  }

  function handleAddResultLine(brand: AnaliseBrand, month: number, label: string, value: number) {
    const cleanLabel = label.trim();
    if (!cleanLabel) return;

    applyResultsUpdate(brand, (current) => {
      const lineTemplate: RateioResultadoLinha = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: cleanLabel,
        value,
      };

      for (let m = month; m <= 12; m++) {
        current[m] = [...(current[m] ?? []), { ...lineTemplate }];
      }

      return current;
    });
  }

  function handleChangeResultLineValue(
    brand: AnaliseBrand,
    month: number,
    lineId: string,
    value: number,
  ) {
    applyResultsUpdate(brand, (current) => {
      current[month] = (current[month] ?? []).map((line) =>
        line.id === lineId ? { ...line, value } : line,
      );
      return current;
    });
  }

  function handleRemoveResultLine(brand: AnaliseBrand, month: number, lineId: string) {
    const data = brand === 'vw' ? vwResults : audiResults;
    const firstMonth = MONTHS.find((m) => (data[m] ?? []).some((line) => line.id === lineId));
    if (firstMonth == null || month !== firstMonth) {
      toast.warning('Esta linha so pode ser excluida no mes em que foi criada.');
      return;
    }

    applyResultsUpdate(brand, (current) => {
      for (let m = month; m <= 12; m++) {
        current[m] = (current[m] ?? []).filter((line) => line.id !== lineId);
      }
      return current;
    });
  }

  function canRemoveResultLine(brand: AnaliseBrand, month: number, lineId: string) {
    const data = brand === 'vw' ? vwResults : audiResults;
    const firstMonth = MONTHS.find((m) => (data[m] ?? []).some((line) => line.id === lineId));
    return firstMonth != null && month === firstMonth;
  }

  function applyEndividamentoUpdate(
    brand: AnaliseBrand,
    updater: (current: RateioEndividamentoBrandYearData) => RateioEndividamentoBrandYearData,
  ) {
    const current = brand === 'vw' ? vwEndividamento : audiEndividamento;
    const next = updater(cloneEndividamentoByMonth(current));
    if (brand === 'vw') {
      setVwEndividamento(next);
    } else {
      setAudiEndividamento(next);
    }
    void saveRateioEndividamento(brand, selectedYear, next);
  }

  function handleAddEndividamentoConta(brand: AnaliseBrand, month: number, conta: string) {
    if (!conta) return;
    applyEndividamentoUpdate(brand, (current) => {
      current[month] = uniqueSorted([...(current[month] ?? []), conta]);
      return current;
    });
  }

  function handleRemoveEndividamentoConta(brand: AnaliseBrand, month: number, conta: string) {
    applyEndividamentoUpdate(brand, (current) => {
      current[month] = (current[month] ?? []).filter((item) => item !== conta);
      return current;
    });
  }

  function applyDepartamentoUpdate(
    brand: AnaliseBrand,
    updater: (current: RateioDepartamentoBrandYearData) => RateioDepartamentoBrandYearData,
  ) {
    const current = brand === 'vw' ? vwDepartamento : audiDepartamento;
    const next = updater(cloneDepartamentoByMonth(current));
    if (brand === 'vw') {
      setVwDepartamento(next);
    } else {
      setAudiDepartamento(next);
    }
    void saveRateioDepartamento(brand, selectedYear, next);
  }

  function handleDepartamentoChange(
    brand: AnaliseBrand,
    month: number,
    conta: string,
    departamento: DepartmentKey,
    value: number,
  ) {
    applyDepartamentoUpdate(brand, (current) => {
      const monthData = { ...(current[month] ?? {}) };
      const existing = cloneDepartamentoValores(monthData[conta]);
      monthData[conta] = {
        ...existing,
        [departamento]: value,
      };
      current[month] = monthData;
      return current;
    });
  }

  function handleApplyTaxaFromMonth(month: number, taxaPercent: number) {
    const sanitized = Number.isFinite(taxaPercent) ? Math.max(0, taxaPercent) : 0;
    const next: RateioTaxaJurosYearData = { ...taxaJurosByMonth };
    for (let m = month; m <= 12; m++) {
      next[m] = sanitized;
    }
    setTaxaJurosByMonth(next);
    void saveRateioTaxaJuros(selectedYear, next);
  }

  function applyOutrosBancosUpdate(
    updater: (current: RateioOutrosBancosYearData) => RateioOutrosBancosYearData,
  ) {
    const next = updater(cloneOutrosBancosByMonth(outrosBancosByMonth));
    setOutrosBancosByMonth(next);
    void saveRateioContabilOutrosBancos(selectedYear, next);
  }

  function handleAddOutrosBancosLinha(month: number) {
    const instituicao = (newInstituicaoByMonth[month] ?? '').trim();
    const juros = parseManualValue(newJurosByMonth[month] ?? '0');
    if (!instituicao) {
      toast.error('Informe a instituição financeira.');
      return;
    }

    const newRow: RateioOutrosBancosLinha = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      instituicao,
      juros,
    };

    applyOutrosBancosUpdate((current) => {
      current[month] = [...(current[month] ?? []), newRow];
      return current;
    });

    setNewInstituicaoByMonth((prev) => ({ ...prev, [month]: '' }));
    setNewJurosByMonth((prev) => ({ ...prev, [month]: '0' }));
  }

  function handleRemoveOutrosBancosLinha(month: number, lineId: string) {
    applyOutrosBancosUpdate((current) => {
      current[month] = (current[month] ?? []).filter((row) => row.id !== lineId);
      return current;
    });
  }

  function handleChangeOutrosBancosLinha(
    month: number,
    lineId: string,
    field: 'instituicao' | 'juros',
    value: string,
  ) {
    applyOutrosBancosUpdate((current) => {
      current[month] = (current[month] ?? []).map((row) => {
        if (row.id !== lineId) return row;
        if (field === 'instituicao') {
          return { ...row, instituicao: value };
        }
        return { ...row, juros: parseManualValue(value) };
      });
      return current;
    });
  }

  function applyOutrosBancosDepartmentsUpdate(
    updater: (current: RateioOutrosBancosDepartamentosYearData) => RateioOutrosBancosDepartamentosYearData,
  ) {
    const next = updater(cloneOutrosBancosDepartmentsByMonth(outrosBancosDepartamentosByMonth));
    setOutrosBancosDepartamentosByMonth(next);
    void saveRateioContabilOutrosBancosDepartamentos(selectedYear, next);
  }

  function handleToggleOutrosBancosDepartamento(month: number, brand: AnaliseBrand, dept: DepartmentKey) {
    applyOutrosBancosDepartmentsUpdate((current) => {
      const monthData = current[month] ?? { vw: [], audi: [] };
      const currentList = brand === 'vw' ? monthData.vw : monthData.audi;
      const exists = currentList.includes(dept);
      const nextList = exists ? currentList.filter((item) => item !== dept) : [...currentList, dept];
      current[month] = {
        ...monthData,
        [brand]: DEPARTMENT_ORDER.filter((item) => nextList.includes(item)),
      };
      return current;
    });
  }

  function allocateByRebasedPercent(
    brandTotal: number,
    selectedDepartments: DepartmentKey[],
    departmentTotals: Record<DepartmentKey, number>,
  ): Record<DepartmentKey, { percentRebased: number; valorRateado: number }> {
    const result = DEPARTMENT_ORDER.reduce((acc, dept) => {
      acc[dept] = { percentRebased: 0, valorRateado: 0 };
      return acc;
    }, {} as Record<DepartmentKey, { percentRebased: number; valorRateado: number }>);

    if (selectedDepartments.length === 0) return result;

    const baseSelecionada = selectedDepartments.reduce((sum, dept) => sum + (departmentTotals[dept] || 0), 0);
    if (baseSelecionada === 0) return result;

    const rows = selectedDepartments.map((dept) => {
      const percentRebased = (departmentTotals[dept] / baseSelecionada) * 100;
      return {
        dept,
        percentRebased,
        valorRateadoRaw: brandTotal * (percentRebased / 100),
      };
    });

    const roundedValues = rows.map((row) => roundCurrency(row.valorRateadoRaw));
    const sumRounded = roundedValues.reduce((sum, value) => sum + value, 0);
    const ajuste = roundCurrency(brandTotal - sumRounded);

    rows.forEach((row, index) => {
      const valorRateado = index === rows.length - 1 ? roundCurrency(roundedValues[index] + ajuste) : roundedValues[index];
      result[row.dept] = {
        percentRebased: row.percentRebased,
        valorRateado,
      };
    });

    return result;
  }

  const monthsToRender = useMemo(() => {
    if (selectedMonth === 'all') return MONTHS;
    return [selectedMonth];
  }, [selectedMonth]);

  const printSignatureText = useMemo(() => {
    const signatures = monthsToRender
      .map((month) => assinaturasFinanceiroByMonth[month])
      .filter((item): item is RateioAssinaturaDigital => !!item);

    if (signatures.length === 0) {
      return 'Documento sem assinatura financeira registrada para o período selecionado.';
    }

    const uniqueKeys = new Set(signatures.map((ass) => `${ass.username}|${ass.dataHora}`));
    if (uniqueKeys.size === 1) {
      const ass = signatures[0];
      const signedBy = ass.name && ass.name !== ass.username ? `${ass.name} (${ass.username})` : ass.username;
      return `Assinado eletronicamente (Financeiro) por ${signedBy} em ${new Date(ass.dataHora).toLocaleString('pt-BR')}.`;
    }

    return 'Documento assinado eletronicamente pelo Financeiro. Existem múltiplas assinaturas para as competências selecionadas.';
  }, [monthsToRender, assinaturasFinanceiroByMonth]);

  const hasFinancialSignatureForPrint = useMemo(() => {
    return monthsToRender.some((month) => !!assinaturasFinanceiroByMonth[month]);
  }, [monthsToRender, assinaturasFinanceiroByMonth]);

  const resultadoPeriodoByBrandMonth = useMemo(() => {
    const vw: Record<number, number> = {};
    const audi: Record<number, number> = {};

    let vwAcumulado = 0;
    let audiAcumulado = 0;

    for (const month of MONTHS) {
      vwAcumulado += vwLucroLiquidoMensal[month] ?? 0;
      audiAcumulado += audiLucroLiquidoMensal[month] ?? 0;
      vw[month] = vwAcumulado;
      audi[month] = audiAcumulado;
    }

    return { vw, audi };
  }, [vwLucroLiquidoMensal, audiLucroLiquidoMensal]);

  const monthTotals = useMemo(() => {
    const out: Record<number, { vw: number; audi: number; total: number }> = {};
    for (const month of MONTHS) {
      const audiTotal = getBrandMonthTotal(
        'audi',
        month,
        config,
        audiData,
        audiResults[month] ?? [],
        resultadoPeriodoByBrandMonth.audi[month] ?? 0,
      );
      const vwTotalComResultado = getBrandMonthTotal(
        'vw',
        month,
        config,
        vwData,
        vwResults[month] ?? [],
        resultadoPeriodoByBrandMonth.vw[month] ?? 0,
      );
      out[month] = {
        vw: vwTotalComResultado,
        audi: audiTotal,
        total: vwTotalComResultado + audiTotal,
      };
    }
    return out;
  }, [config, vwData, audiData, vwResults, audiResults, resultadoPeriodoByBrandMonth]);

  const monthFinancials = useMemo(() => {
    const out: Record<number, {
      taxaPercent: number;
      vwEndividamento: number;
      audiEndividamento: number;
      vwEndividamentoBase: number;
      audiEndividamentoBase: number;
      vwJurosCalculado: number;
      audiJurosCalculado: number;
      vwAReceberDaAudi: number;
      vwAPagarParaAudi: number;
      vwSaldoLiquido: number;
      audiAReceberDaVw: number;
      audiAPagarParaVw: number;
      audiSaldoLiquido: number;
      vwPercent: number;
      audiPercent: number;
    }> = {};

    for (const month of MONTHS) {
      const vwEnd = getBrandMonthEndividamentoTotal('vw', month, vwEndividamento[month] ?? [], vwData);
      const audiEnd = getBrandMonthEndividamentoTotal('audi', month, audiEndividamento[month] ?? [], audiData);
      const vwEndividamentoBase = Math.abs(Math.min(0, vwEnd));
      const audiEndividamentoBase = Math.abs(Math.min(0, audiEnd));
      const taxaPercent = Number(taxaJurosByMonth[month] ?? 0);
      const vwJurosCalculado = vwEndividamentoBase * (taxaPercent / 100);
      const audiJurosCalculado = audiEndividamentoBase * (taxaPercent / 100);
      const vwTotalGeral = getBrandMonthTotalGeral(
        'vw',
        month,
        config,
        vwData,
        vwResults[month] ?? [],
        resultadoPeriodoByBrandMonth.vw[month] ?? 0,
      );
      const audiTotalGeral = getBrandMonthTotalGeral(
        'audi',
        month,
        config,
        audiData,
        audiResults[month] ?? [],
        resultadoPeriodoByBrandMonth.audi[month] ?? 0,
      );
      const totalGeralMes = vwTotalGeral + audiTotalGeral;
      const vwPercent = totalGeralMes ? (vwTotalGeral / totalGeralMes) * 100 : 0;
      const audiPercent = totalGeralMes ? (audiTotalGeral / totalGeralMes) * 100 : 0;
      const vwAReceberDaAudi = vwJurosCalculado * (audiPercent / 100);
      const vwAPagarParaAudi = audiJurosCalculado * (vwPercent / 100);
      const vwSaldoLiquido = vwAReceberDaAudi - vwAPagarParaAudi;
      const audiAReceberDaVw = audiJurosCalculado * (vwPercent / 100);
      const audiAPagarParaVw = vwJurosCalculado * (audiPercent / 100);
      const audiSaldoLiquido = audiAReceberDaVw - audiAPagarParaVw;

      out[month] = {
        taxaPercent,
        vwEndividamento: vwEnd,
        audiEndividamento: audiEnd,
        vwEndividamentoBase,
        audiEndividamentoBase,
        vwJurosCalculado,
        audiJurosCalculado,
        vwAReceberDaAudi,
        vwAPagarParaAudi,
        vwSaldoLiquido,
        audiAReceberDaVw,
        audiAPagarParaVw,
        audiSaldoLiquido,
        vwPercent,
        audiPercent,
      };
    }

    return out;
  }, [
    taxaJurosByMonth,
    vwEndividamento,
    audiEndividamento,
    config,
    vwData,
    audiData,
    vwResults,
    audiResults,
    resultadoPeriodoByBrandMonth,
  ]);

  const departmentMonthData = useMemo(() => {
    const mapData = (brand: AnaliseBrand, month: number) => {
      const selectedActive = getSelectedAccounts(config, brand, 'ativo');
      const selectedPassivo = getSelectedAccounts(config, brand, 'passivo');
      const monthAccounts = brand === 'vw' ? vwData[month] ?? {} : audiData[month] ?? {};
      const allocations = brand === 'vw' ? (vwDepartamento[month] ?? {}) : (audiDepartamento[month] ?? {});

      const buildRows = (contas: string[]) => contas.map((conta) => ({
        conta,
        desc: monthAccounts[conta]?.desc || descriptions[conta] || 'Conta não encontrada no balancete do mês',
        saldoAtual: monthAccounts[conta]?.saldoAtual ?? 0,
      }));

      return {
        ativo: buildRows(selectedActive),
        passivo: buildRows(selectedPassivo),
        allocations,
      };
    };

    return {
      vw: MONTHS.reduce((acc, month) => {
        acc[month] = mapData('vw', month);
        return acc;
      }, {} as Record<number, ReturnType<typeof mapData>>),
      audi: MONTHS.reduce((acc, month) => {
        acc[month] = mapData('audi', month);
        return acc;
      }, {} as Record<number, ReturnType<typeof mapData>>),
    };
  }, [config, vwData, audiData, vwDepartamento, audiDepartamento, descriptions]);

  function handleAbrirAssinaturaFinanceiro(month: number) {
    if (!session) return;
    setAssinaFinanceiroDialog({ month, senha: '', loading: false, erro: null });
  }

  async function handleConfirmarAssinaturaFinanceiro() {
    if (!assinaFinanceiroDialog || !session) return;

    setAssinaFinanceiroDialog((prev) => (prev ? { ...prev, loading: true, erro: null } : prev));
    try {
      const result = await apiLogin(session.username, assinaFinanceiroDialog.senha);
      if ('error' in result) {
        setAssinaFinanceiroDialog((prev) => (prev ? { ...prev, loading: false, erro: 'Senha incorreta. Tente novamente.' } : prev));
        return;
      }

      const assinatura: RateioAssinaturaDigital = {
        username: session.username,
        name: (result.session.name ?? '') || undefined,
        dataHora: new Date().toISOString(),
      };

      const next: RateioContabilAssinaturasYearData = {
        ...assinaturasFinanceiroByMonth,
        [assinaFinanceiroDialog.month]: assinatura,
      };

      setAssinaturasFinanceiroByMonth(next);
      await saveRateioContabilAssinaturas(selectedYear, next);
      toast.success('Assinatura do Financeiro registrada com sucesso!');
      setAssinaFinanceiroDialog(null);
    } catch {
      setAssinaFinanceiroDialog((prev) => (prev ? { ...prev, loading: false, erro: 'Erro ao salvar. Verifique sua conexão e tente novamente.' } : prev));
    }
  }

  function handleAbrirReabrirAssinaturaFinanceiro(month: number) {
    if (!session) return;
    setReabrirAssinaturaDialog({ month, senha: '', loading: false, erro: null });
  }

  async function handleConfirmarReabrirAssinaturaFinanceiro() {
    if (!reabrirAssinaturaDialog || !session) return;

    setReabrirAssinaturaDialog((prev) => (prev ? { ...prev, loading: true, erro: null } : prev));
    try {
      const result = await apiLogin(session.username, reabrirAssinaturaDialog.senha);
      if ('error' in result) {
        setReabrirAssinaturaDialog((prev) => (prev ? { ...prev, loading: false, erro: 'Senha incorreta. Tente novamente.' } : prev));
        return;
      }

      const next: RateioContabilAssinaturasYearData = {
        ...assinaturasFinanceiroByMonth,
        [reabrirAssinaturaDialog.month]: null,
      };

      setAssinaturasFinanceiroByMonth(next);
      await saveRateioContabilAssinaturas(selectedYear, next);
      toast.success('Assinatura do Financeiro reaberta com sucesso!');
      setReabrirAssinaturaDialog(null);
    } catch {
      setReabrirAssinaturaDialog((prev) => (prev ? { ...prev, loading: false, erro: 'Erro ao reabrir. Verifique sua conexão e tente novamente.' } : prev));
    }
  }

  function handleAbrirAssinaturaFinanceiroOutrosBancos(month: number) {
    if (!session) return;
    setAssinaFinanceiroOutrosBancosDialog({ month, senha: '', loading: false, erro: null });
  }

  async function handleConfirmarAssinaturaFinanceiroOutrosBancos() {
    if (!assinaFinanceiroOutrosBancosDialog || !session) return;

    setAssinaFinanceiroOutrosBancosDialog((prev) => (prev ? { ...prev, loading: true, erro: null } : prev));
    try {
      const result = await apiLogin(session.username, assinaFinanceiroOutrosBancosDialog.senha);
      if ('error' in result) {
        setAssinaFinanceiroOutrosBancosDialog((prev) => (prev ? { ...prev, loading: false, erro: 'Senha incorreta. Tente novamente.' } : prev));
        return;
      }

      const assinatura: RateioAssinaturaDigital = {
        username: session.username,
        name: (result.session.name ?? '') || undefined,
        dataHora: new Date().toISOString(),
      };

      const next: RateioContabilAssinaturasYearData = {
        ...assinaturasFinanceiroOutrosBancosByMonth,
        [assinaFinanceiroOutrosBancosDialog.month]: assinatura,
      };

      setAssinaturasFinanceiroOutrosBancosByMonth(next);
      await saveRateioContabilOutrosBancosAssinaturas(selectedYear, next);
      toast.success('Assinatura do Financeiro (Outros Bancos) registrada com sucesso!');
      setAssinaFinanceiroOutrosBancosDialog(null);
    } catch {
      setAssinaFinanceiroOutrosBancosDialog((prev) => (prev ? { ...prev, loading: false, erro: 'Erro ao salvar. Verifique sua conexão e tente novamente.' } : prev));
    }
  }

  function handleAbrirReabrirAssinaturaFinanceiroOutrosBancos(month: number) {
    if (!session) return;
    setReabrirAssinaturaOutrosBancosDialog({ month, senha: '', loading: false, erro: null });
  }

  async function handleConfirmarReabrirAssinaturaFinanceiroOutrosBancos() {
    if (!reabrirAssinaturaOutrosBancosDialog || !session) return;

    setReabrirAssinaturaOutrosBancosDialog((prev) => (prev ? { ...prev, loading: true, erro: null } : prev));
    try {
      const result = await apiLogin(session.username, reabrirAssinaturaOutrosBancosDialog.senha);
      if ('error' in result) {
        setReabrirAssinaturaOutrosBancosDialog((prev) => (prev ? { ...prev, loading: false, erro: 'Senha incorreta. Tente novamente.' } : prev));
        return;
      }

      const next: RateioContabilAssinaturasYearData = {
        ...assinaturasFinanceiroOutrosBancosByMonth,
        [reabrirAssinaturaOutrosBancosDialog.month]: null,
      };

      setAssinaturasFinanceiroOutrosBancosByMonth(next);
      await saveRateioContabilOutrosBancosAssinaturas(selectedYear, next);
      toast.success('Assinatura do Financeiro (Outros Bancos) reaberta com sucesso!');
      setReabrirAssinaturaOutrosBancosDialog(null);
    } catch {
      setReabrirAssinaturaOutrosBancosDialog((prev) => (prev ? { ...prev, loading: false, erro: 'Erro ao reabrir. Verifique sua conexão e tente novamente.' } : prev));
    }
  }

  function renderLiquidezEntreMarcasTable(month: number) {
    const financial = monthFinancials[month];
    if (!financial) return null;

    const transferencia = financial.vwSaldoLiquido > 0
      ? { de: 'Audi', para: 'VW', valor: financial.vwSaldoLiquido }
      : financial.vwSaldoLiquido < 0
        ? { de: 'VW', para: 'Audi', valor: Math.abs(financial.vwSaldoLiquido) }
        : { de: '-', para: '-', valor: 0 };

    return (
      <div className="mt-4 bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <h4 className="text-sm font-bold text-slate-700 mb-2">Liquidação entre Marcas</h4>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Marca</th>
                <th className="text-right px-3 py-2 font-semibold">Juros Calculado</th>
                <th className="text-right px-3 py-2 font-semibold">% Uso Circulante</th>
                <th className="text-right px-3 py-2 font-semibold">A Receber da Outra Marca</th>
                <th className="text-right px-3 py-2 font-semibold">A Pagar</th>
                <th className="text-right px-3 py-2 font-semibold">Saldo Líquido</th>
              </tr>
            </thead>
            <tbody>
              {([
                { brand: 'VW', juros: financial.vwJurosCalculado, percent: financial.vwPercent, receber: financial.vwAReceberDaAudi, pagar: financial.vwAPagarParaAudi, saldo: financial.vwSaldoLiquido },
                { brand: 'Audi', juros: financial.audiJurosCalculado, percent: financial.audiPercent, receber: financial.audiAReceberDaVw, pagar: financial.audiAPagarParaVw, saldo: financial.audiSaldoLiquido },
              ]).map((row) => (
                <tr key={row.brand} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-800">{row.brand}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(row.juros)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">{row.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatCurrency(row.receber)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-red-700">{formatCurrency(row.pagar)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${row.saldo >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatCurrency(Math.abs(row.saldo))} {row.saldo >= 0 ? 'a receber' : 'a pagar'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-amber-50">
                <td colSpan={4} className="px-3 py-2 text-right font-bold text-slate-800">Liquidação Final do Mês</td>
                <td colSpan={3} className="px-3 py-2 text-right font-bold text-slate-900">
                  {transferencia.valor > 0 ? `${transferencia.de} paga para ${transferencia.para} ${formatCurrency(transferencia.valor)}` : 'Sem transferência entre marcas'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  function renderDepartamentoBrandPanel(brand: AnaliseBrand, month: number) {
    const monthData = departmentMonthData[brand][month];
    const financial = monthFinancials[month];
    const ativoRows = monthData.ativo;
    const passivoRows = monthData.passivo;
    const allocations = monthData.allocations;
    const brandLabel = BRAND_LABEL[brand];
    const baseCirculante = [...ativoRows, ...passivoRows].reduce((sum, row) => sum + row.saldoAtual, 0);
    const baseCirculantePercent = Math.abs(baseCirculante);
    const combinedRows = [...ativoRows, ...passivoRows];
    const combinedDepartmentTotals = DEPARTMENT_ORDER.reduce((acc, dept) => {
      acc[dept] = combinedRows.reduce((sum, row) => sum + (Number(allocations[row.conta]?.[dept]) || 0), 0);
      return acc;
    }, {} as Record<DepartmentKey, number>);
    const combinedPercentSum = DEPARTMENT_ORDER.reduce((sum, dept) => {
      if (baseCirculantePercent <= 0) return sum;
      return sum + (combinedDepartmentTotals[dept] / baseCirculantePercent) * 100;
    }, 0);
    const jurosReconhecido = brand === 'vw' ? (financial?.vwJurosCalculado ?? 0) : (financial?.audiJurosCalculado ?? 0);
    const valorAReceber = brand === 'vw' ? (financial?.vwAReceberDaAudi ?? 0) : (financial?.audiAReceberDaVw ?? 0);
    const valorAPagar = brand === 'vw' ? (financial?.vwAPagarParaAudi ?? 0) : (financial?.audiAPagarParaVw ?? 0);
    const jurosRatear = jurosReconhecido + valorAPagar - valorAReceber;
    const jurosDeptos = DEPARTMENT_ORDER.reduce((acc, dept) => {
      const pct = baseCirculantePercent > 0 ? (combinedDepartmentTotals[dept] / baseCirculantePercent) : 0;
      acc[dept] = jurosRatear * pct;
      return acc;
    }, {} as Record<DepartmentKey, number>);
    const totalJurosDeptos = DEPARTMENT_ORDER.reduce((sum, dept) => sum + jurosDeptos[dept], 0);

    return (
      <div className={`bg-white border-2 ${BRAND_PANEL_BORDER_CLASS[brand]} rounded-xl shadow-sm p-4 space-y-4`}>
        <h3 className="text-base font-bold text-slate-800">{brandLabel} - {MONTH_NAMES[month - 1]}</h3>
        <DepartamentoLinhasTable
          brand={brand}
          month={month}
          title="Ativo Circulante"
          rows={ativoRows}
          allocations={allocations}
          onChangeAllocation={handleDepartamentoChange}
        />
        <DepartamentoLinhasTable
          brand={brand}
          month={month}
          title="Passivo Circulante"
          rows={passivoRows}
          allocations={allocations}
          onChangeAllocation={handleDepartamentoChange}
        />
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Departamento</th>
                <th className="text-right px-3 py-2 font-semibold">Total Alocado</th>
                <th className="text-right px-3 py-2 font-semibold">% Uso do Circulante</th>
              </tr>
            </thead>
            <tbody>
              {DEPARTMENT_ORDER.map((dept) => (
                <tr key={dept} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700 font-semibold">{DEPARTMENT_LABELS[dept]}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(combinedDepartmentTotals[dept])}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">
                    {baseCirculantePercent > 0 ? `${((combinedDepartmentTotals[dept] / baseCirculantePercent) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '0,00%'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-3 py-2 text-right font-bold text-slate-800">Total da Marca</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(combinedRows.reduce((sum, row) => sum + row.saldoAtual, 0))}</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">
                  Soma %: {combinedPercentSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Rateio de Juros por Departamento</th>
                <th className="text-right px-3 py-2 font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700">Juros Reconhecido da Marca</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(jurosReconhecido)}</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700">(+ ) Valor a Pagar na Liquidação</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(valorAPagar)}</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700">(-) Valor a Receber na Liquidação</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(valorAReceber)}</td>
              </tr>
              <tr className="border-t border-slate-100 bg-violet-50">
                <td className="px-3 py-2 text-right font-bold text-slate-800">Juros a Ratear por Departamento</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(jurosRatear)}</td>
              </tr>
              {DEPARTMENT_ORDER.map((dept) => {
                const deptPct = baseCirculantePercent > 0 ? (combinedDepartmentTotals[dept] / baseCirculantePercent) * 100 : 0;
                return (
                  <tr key={dept} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">
                      {DEPARTMENT_LABELS[dept]} ({deptPct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(jurosDeptos[dept])}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-3 py-2 text-right font-bold text-slate-800">Soma Rateada dos Departamentos</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(totalJurosDeptos)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  function getDepartamentoResumo(brand: AnaliseBrand, month: number) {
    const monthData = departmentMonthData[brand][month];
    const ativoRows = monthData.ativo;
    const passivoRows = monthData.passivo;
    const allocations = monthData.allocations;
    const combinedRows = [...ativoRows, ...passivoRows];
    const baseCirculante = combinedRows.reduce((sum, row) => sum + row.saldoAtual, 0);
    const baseCirculantePercent = Math.abs(baseCirculante);
    const departmentTotals = DEPARTMENT_ORDER.reduce((acc, dept) => {
      acc[dept] = combinedRows.reduce((sum, row) => sum + (Number(allocations[row.conta]?.[dept]) || 0), 0);
      return acc;
    }, {} as Record<DepartmentKey, number>);
    const departmentPercents = DEPARTMENT_ORDER.reduce((acc, dept) => {
      acc[dept] = baseCirculantePercent > 0 ? (departmentTotals[dept] / baseCirculantePercent) * 100 : 0;
      return acc;
    }, {} as Record<DepartmentKey, number>);

    const financial = monthFinancials[month];
    const jurosReconhecido = brand === 'vw' ? (financial?.vwJurosCalculado ?? 0) : (financial?.audiJurosCalculado ?? 0);
    const valorAReceber = brand === 'vw' ? (financial?.vwAReceberDaAudi ?? 0) : (financial?.audiAReceberDaVw ?? 0);
    const valorAPagar = brand === 'vw' ? (financial?.vwAPagarParaAudi ?? 0) : (financial?.audiAPagarParaVw ?? 0);
    const saldoLiquido = brand === 'vw' ? (financial?.vwSaldoLiquido ?? 0) : (financial?.audiSaldoLiquido ?? 0);
    const valorDebitoLiquidacao = saldoLiquido < 0 ? Math.abs(saldoLiquido) : 0;
    const valorCreditoLiquidacao = saldoLiquido > 0 ? saldoLiquido : 0;
    const jurosRatear = jurosReconhecido + valorAPagar - valorAReceber;
    const jurosDeptos = DEPARTMENT_ORDER.reduce((acc, dept) => {
      acc[dept] = jurosRatear * (departmentPercents[dept] / 100);
      return acc;
    }, {} as Record<DepartmentKey, number>);
    const creditoNovosPorRateio = DEPARTMENT_ORDER.reduce((sum, dept) => sum + (jurosDeptos[dept] ?? 0), 0);

    return {
      jurosReconhecido,
      valorAReceber,
      valorAPagar,
      saldoLiquido,
      valorDebitoLiquidacao,
      valorCreditoLiquidacao,
      jurosRatear,
      departmentTotals,
      departmentPercents,
      jurosDeptos,
      creditoNovosPorRateio,
      somaJurosDeptos: DEPARTMENT_ORDER.reduce((sum, dept) => sum + jurosDeptos[dept], 0),
    };
  }

  function renderContabilBrandSection(brand: AnaliseBrand, month: number) {
    const resumo = getDepartamentoResumo(brand, month);
    const brandLabel = BRAND_LABEL[brand];
    const launchDebitRows = DEPARTMENT_ORDER.map((dept) => ({
      departamento: DEPARTMENT_LABELS[dept],
      conta: JUROS_CONTA_CONTABIL,
      natureza: 'Débito' as const,
      valor: resumo.jurosDeptos[dept] ?? 0,
    }));
    if (resumo.valorDebitoLiquidacao > 0) {
      launchDebitRows.push({
        departamento: 'Novos - Débito Liquidação Entre Marcas',
        conta: JUROS_CONTA_CONTABIL,
        natureza: 'Débito' as const,
        valor: resumo.valorDebitoLiquidacao,
      });
    }

    const launchCreditRows: Array<{
      departamento: string;
      conta: string;
      natureza: 'Crédito';
      valor: number;
    }> = [];

    if (resumo.creditoNovosPorRateio !== 0) {
      launchCreditRows.push({
        departamento: 'Novos',
        conta: JUROS_CONTA_CONTABIL,
        natureza: 'Crédito',
        valor: resumo.creditoNovosPorRateio,
      });
    }

    if (resumo.valorCreditoLiquidacao > 0) {
      launchCreditRows.push({
        departamento: 'Novos - Crédito Liquidação Entre Marcas',
        conta: JUROS_CONTA_CONTABIL,
        natureza: 'Crédito',
        valor: resumo.valorCreditoLiquidacao,
      });
    }

    const totalDebitoLancamentos = launchDebitRows.reduce((sum, row) => sum + row.valor, 0);
    const totalCreditoLancamentos = launchCreditRows.reduce((sum, row) => sum + row.valor, 0);

    const fallbackCreditRow = {
      departamento: 'Novos',
      conta: JUROS_CONTA_CONTABIL,
      natureza: 'Crédito' as const,
      valor: 0,
    };

    return (
      <div className={`contabil-brand-print-block bg-white border-2 ${BRAND_PANEL_BORDER_CLASS[brand]} rounded-xl p-5 print:p-3 space-y-4 print:space-y-2`}>
        <div>
          <h3 className="text-lg font-bold text-slate-900">{brandLabel} - Demonstrativo Contábil</h3>
          <p className="text-xs text-slate-600">Período: {MONTH_NAMES[month - 1]}/{selectedYear}</p>
          <p className="text-xs text-slate-600">Conta Contábil: {JUROS_CONTA_CONTABIL}</p>
        </div>

        {hasFinancialSignatureForPrint && (
          <div className="hidden print:block border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2 print:py-1 text-[10px] print:text-[9px] font-semibold text-emerald-800 print:mb-1">
            {printSignatureText}
          </div>
        )}

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Memória de Cálculo</th>
                <th className="text-right px-3 py-2 font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2">Juros Reconhecido da Marca</td>
                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(resumo.jurosReconhecido)}</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2">(+ ) Valor a Pagar na Liquidação</td>
                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(resumo.valorAPagar)}</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2">(-) Valor a Receber na Liquidação</td>
                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(resumo.valorAReceber)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-violet-50">
                <td className="px-3 py-2 text-right font-bold">Juros a Ratear</td>
                <td className="px-3 py-2 text-right font-bold">{formatCurrency(resumo.jurosRatear)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Marca</th>
                <th className="text-left px-3 py-2 font-semibold">Departamento</th>
                <th className="text-left px-3 py-2 font-semibold">Conta</th>
                <th className="text-left px-3 py-2 font-semibold">Natureza</th>
                <th className="text-right px-3 py-2 font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {launchDebitRows.map((row) => (
                <tr key={`${brand}-${month}-${row.departamento}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-800">{brandLabel}</td>
                  <td className="px-3 py-2 text-slate-700">{row.departamento}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.conta}</td>
                  <td className="px-3 py-2 font-semibold text-red-700">{row.natureza}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatCurrency(row.valor)}</td>
                </tr>
              ))}
              {(launchCreditRows.length > 0 ? launchCreditRows : [fallbackCreditRow]).map((row, index) => (
                <tr key={`${brand}-${month}-credit-${row.departamento}-${index}`} className="border-t-2 border-slate-200 bg-emerald-50">
                  <td className="px-3 py-2 font-semibold text-slate-800">{brandLabel}</td>
                  <td className="px-3 py-2 text-slate-700">{row.departamento}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.conta}</td>
                  <td className="px-3 py-2 font-semibold text-emerald-700">{row.natureza}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(row.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={4} className="px-3 py-2 text-right font-bold text-slate-800">Total Débito Departamentos</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">
                  {formatCurrency(totalDebitoLancamentos)}
                </td>
              </tr>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td colSpan={4} className="px-3 py-2 text-right font-bold text-slate-800">Total Crédito Novos</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(totalCreditoLancamentos)}</td>
              </tr>
              <tr className="border-t border-slate-200 bg-sky-50">
                <td colSpan={4} className="px-3 py-2 text-right font-bold text-slate-800">Diferença (Débito - Crédito)</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">
                  {formatCurrency(totalDebitoLancamentos - totalCreditoLancamentos)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Departamento</th>
                <th className="text-right px-3 py-2 font-semibold">% Utilização</th>
                <th className="text-right px-3 py-2 font-semibold">Débito</th>
                <th className="text-right px-3 py-2 font-semibold">Crédito</th>
              </tr>
            </thead>
            <tbody>
              {DEPARTMENT_ORDER.map((dept) => (
                <tr key={dept} className="border-t border-slate-100">
                  <td className="px-3 py-2">{DEPARTMENT_LABELS[dept]}</td>
                  <td className="px-3 py-2 text-right">{resumo.departmentPercents[dept].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(resumo.jurosDeptos[dept])}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {dept === 'novos' && resumo.creditoNovosPorRateio !== 0 ? formatCurrency(resumo.creditoNovosPorRateio) : '-'}
                  </td>
                </tr>
              ))}
              {resumo.valorDebitoLiquidacao > 0 && (
                <tr className="border-t border-slate-100 bg-amber-50">
                  <td className="px-3 py-2">Novos - Débito Liquidação Entre Marcas</td>
                  <td className="px-3 py-2 text-right">-</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(resumo.valorDebitoLiquidacao)}</td>
                  <td className="px-3 py-2 text-right">-</td>
                </tr>
              )}
              {resumo.valorCreditoLiquidacao > 0 && (
                <tr className="border-t border-slate-100 bg-emerald-50">
                  <td className="px-3 py-2">Novos - Crédito Liquidação Entre Marcas</td>
                  <td className="px-3 py-2 text-right">-</td>
                  <td className="px-3 py-2 text-right">-</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(resumo.valorCreditoLiquidacao)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-3 py-2 text-right font-bold">Totais</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-bold">{formatCurrency(resumo.somaJurosDeptos + resumo.valorDebitoLiquidacao)}</td>
                <td className="px-3 py-2 text-right font-bold">{formatCurrency(resumo.valorCreditoLiquidacao + resumo.creditoNovosPorRateio)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>
    );
  }

  function renderFinanceiroAssinaturaSection(month: number) {
    const assinatura = assinaturasFinanceiroByMonth[month];

    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden print:break-before-page">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assinaturas</p>
        </div>
        <div className="px-4 py-4">
          <div className="max-w-[360px] flex flex-col gap-1.5">
            <p className="text-xs text-slate-500 font-medium">Financeiro</p>
            {assinatura ? (
              <>
                <div className="border border-emerald-200 rounded-lg px-4 py-3 bg-emerald-50 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div className="flex flex-col">
                      {assinatura.name && assinatura.name !== assinatura.username && (
                        <span className="text-sm font-bold text-emerald-900">{assinatura.name}</span>
                      )}
                      <span className="text-xs text-emerald-700">{assinatura.username}</span>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-600">{new Date(assinatura.dataHora).toLocaleString('pt-BR')}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-700" />
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Assinatura Eletrônica</p>
                  </div>
                </div>
                <button
                  onClick={() => handleAbrirReabrirAssinaturaFinanceiro(month)}
                  className="w-fit text-xs text-amber-700 hover:text-amber-800 border border-amber-300 rounded px-3 py-1.5 hover:bg-amber-50 transition-colors flex items-center gap-1.5"
                >
                  <LockOpen className="w-3.5 h-3.5" />
                  Reabrir assinatura
                </button>
              </>
            ) : (
              <button
                onClick={() => handleAbrirAssinaturaFinanceiro(month)}
                className="border-2 border-dashed border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-400 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50 transition-colors flex items-center gap-2 justify-center"
              >
                <PenLine className="w-4 h-4" />
                Assinar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderFinanceiroAssinaturaOutrosBancosSection(month: number) {
    const assinatura = assinaturasFinanceiroOutrosBancosByMonth[month];

    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assinaturas</p>
        </div>
        <div className="px-4 py-4">
          <div className="max-w-[360px] flex flex-col gap-1.5">
            <p className="text-xs text-slate-500 font-medium">Financeiro</p>
            {assinatura ? (
              <>
                <div className="border border-emerald-200 rounded-lg px-4 py-3 bg-emerald-50 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div className="flex flex-col">
                      {assinatura.name && assinatura.name !== assinatura.username && (
                        <span className="text-sm font-bold text-emerald-900">{assinatura.name}</span>
                      )}
                      <span className="text-xs text-emerald-700">{assinatura.username}</span>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-600">{new Date(assinatura.dataHora).toLocaleString('pt-BR')}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-700" />
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Assinatura Eletrônica</p>
                  </div>
                </div>
                <button
                  onClick={() => handleAbrirReabrirAssinaturaFinanceiroOutrosBancos(month)}
                  className="w-fit text-xs text-amber-700 hover:text-amber-800 border border-amber-300 rounded px-3 py-1.5 hover:bg-amber-50 transition-colors flex items-center gap-1.5"
                >
                  <LockOpen className="w-3.5 h-3.5" />
                  Reabrir assinatura
                </button>
              </>
            ) : (
              <button
                onClick={() => handleAbrirAssinaturaFinanceiroOutrosBancos(month)}
                className="border-2 border-dashed border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-400 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50 transition-colors flex items-center gap-2 justify-center"
              >
                <PenLine className="w-4 h-4" />
                Assinar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderOutrosBancosSection(month: number) {
    const rows = outrosBancosByMonth[month] ?? [];
    const totalDespesaRateio = roundCurrency(rows.reduce((sum, row) => sum + (Number(row.juros) || 0), 0));
    const vwCapital = monthTotals[month]?.vw ?? 0;
    const audiCapital = monthTotals[month]?.audi ?? 0;
    const vwPercent = monthFinancials[month]?.vwPercent ?? 0;
    const audiPercent = monthFinancials[month]?.audiPercent ?? 0;

    const vwRateio = roundCurrency(totalDespesaRateio * (vwPercent / 100));
    const audiRateio = roundCurrency(totalDespesaRateio - vwRateio);

    const vwDepartamentoResumo = getDepartamentoResumo('vw', month);
    const audiDepartamentoResumo = getDepartamentoResumo('audi', month);

    const monthDepartmentSelection = outrosBancosDepartamentosByMonth[month] ?? {
      vw: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS],
      audi: [...DEFAULT_OUTROS_BANCOS_DEPARTMENTS],
    };

    const selectedVwDepartments = DEPARTMENT_ORDER.filter((dept) => monthDepartmentSelection.vw.includes(dept));
    const selectedAudiDepartments = DEPARTMENT_ORDER.filter((dept) => monthDepartmentSelection.audi.includes(dept));

    const vwDeptRateio = allocateByRebasedPercent(vwRateio, selectedVwDepartments, vwDepartamentoResumo.departmentTotals);
    const audiDeptRateio = allocateByRebasedPercent(audiRateio, selectedAudiDepartments, audiDepartamentoResumo.departmentTotals);

    const vwDeptTotalRateado = roundCurrency(
      DEPARTMENT_ORDER.reduce((sum, dept) => sum + (vwDeptRateio[dept]?.valorRateado ?? 0), 0),
    );
    const audiDeptTotalRateado = roundCurrency(
      DEPARTMENT_ORDER.reduce((sum, dept) => sum + (audiDeptRateio[dept]?.valorRateado ?? 0), 0),
    );
    const totalDebitoDepartamentos = roundCurrency(vwDeptTotalRateado + audiDeptTotalRateado);
    const totalCreditoAdministracaoVw = totalDebitoDepartamentos;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? selectedYear + 1 : selectedYear;
    const assinaturaOutrosBancos = assinaturasFinanceiroOutrosBancosByMonth[month];
    const printSignatureTextOutrosBancos = assinaturaOutrosBancos
      ? `Assinado eletronicamente (Financeiro) por ${assinaturaOutrosBancos.name && assinaturaOutrosBancos.name !== assinaturaOutrosBancos.username ? `${assinaturaOutrosBancos.name} (${assinaturaOutrosBancos.username})` : assinaturaOutrosBancos.username} em ${new Date(assinaturaOutrosBancos.dataHora).toLocaleString('pt-BR')}.`
      : 'Documento sem assinatura financeira registrada para o período selecionado.';

    const lancamentosDebito = [
      ...selectedVwDepartments.map((dept) => ({
        marca: 'VW' as const,
        departamento: DEPARTMENT_LABELS[dept],
        conta: OUTROS_BANCOS_DEBITO_CONTA,
        natureza: 'Débito' as const,
        valor: vwDeptRateio[dept]?.valorRateado ?? 0,
      })),
      ...selectedAudiDepartments.map((dept) => ({
        marca: 'Audi' as const,
        departamento: DEPARTMENT_LABELS[dept],
        conta: OUTROS_BANCOS_DEBITO_CONTA,
        natureza: 'Débito' as const,
        valor: audiDeptRateio[dept]?.valorRateado ?? 0,
      })),
    ];

    return (
      <section key={month} className="space-y-4 outros-bancos-print-section">
        <h2 className="text-lg font-bold text-slate-800">
          <span className="print:hidden">Demonstrativo Contábil Outros Bancos - {MONTH_NAMES[month - 1]} / {selectedYear}</span>
          <span className="hidden print:inline">Rateio Despesas Financeiras Outros Bancos</span>
        </h2>

        {!!assinaturaOutrosBancos && (
          <div className="hidden print:block border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2 text-[10px] font-semibold text-emerald-800 print:mb-1">
            {printSignatureTextOutrosBancos}
          </div>
        )}

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-900">
            Reconhecimento contábil: a despesa apurada em {MONTH_NAMES[month - 1]}/{selectedYear} deve ser reconhecida no mês subsequente,
            em {MONTH_NAMES[nextMonth - 1]}/{nextYear}. O valor da despesa é o que foi cobrado no mês subsequente,
            em {MONTH_NAMES[nextMonth - 1]}/{nextYear}.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 outros-bancos-print-main">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Valor de Despesa Financeira de Rateio</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(totalDespesaRateio)}</p>
              <p className="text-xs text-slate-500 mt-1">Total calculado automaticamente pela soma dos juros das instituições.</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">% Uso de Capital Circulante (mês)</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                  <p className="text-xs font-semibold text-blue-700">VW</p>
                  <p className="text-sm font-bold text-blue-900">{formatCurrency(vwCapital)}</p>
                  <p className="text-xs text-blue-800">{vwPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p>
                </div>
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-xs font-semibold text-red-700">Audi</p>
                  <p className="text-sm font-bold text-red-900">{formatCurrency(audiCapital)}</p>
                  <p className="text-xs text-red-800">{audiPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">Valores e percentuais trazidos da Tabela de Total do Rotativo no mesmo mês.</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80">
              <h3 className="text-sm font-bold text-slate-800">Instituições Financeiras e Juros</h3>
              <p className="text-xs text-slate-500 mt-0.5">Inclua as instituições com seus respectivos juros para formar a base de rateio.</p>
            </div>
            <div className="p-4 border-b border-slate-200 bg-slate-50/60 no-print">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 items-center">
                <input
                  type="text"
                  value={newInstituicaoByMonth[month] ?? ''}
                  onChange={(e) => setNewInstituicaoByMonth((prev) => ({ ...prev, [month]: e.target.value }))}
                  className="xl:col-span-7 h-10 px-3 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Instituição financeira"
                />
                <div className="xl:col-span-3 h-10 rounded-md border border-slate-300 bg-white flex items-center overflow-hidden">
                  <span className="px-3 text-xs font-semibold text-slate-500 border-r border-slate-200 bg-slate-50">R$</span>
                  <input
                    type="text"
                    value={newJurosByMonth[month] ?? '0'}
                    onChange={(e) => setNewJurosByMonth((prev) => ({ ...prev, [month]: e.target.value }))}
                    className="h-full w-full px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                    placeholder="0,00"
                  />
                </div>
                <button
                  onClick={() => handleAddOutrosBancosLinha(month)}
                  className="xl:col-span-2 h-10 px-3 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  Incluir
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Instituição Financeira</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Juros</th>
                    <th className="text-right px-4 py-2.5 font-semibold no-print">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr className="border-t border-slate-100">
                      <td colSpan={2} className="px-4 py-4 text-center text-slate-500">Sem lançamentos para o mês.</td>
                    </tr>
                  ) : rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={row.instituicao}
                          onChange={(e) => handleChangeOutrosBancosLinha(month, row.id, 'instituicao', e.target.value)}
                          className="w-full h-9 px-2.5 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="ml-auto h-9 w-44 rounded-md border border-slate-300 bg-white flex items-center overflow-hidden">
                          <span className="px-2.5 text-xs font-semibold text-slate-500 border-r border-slate-200 bg-slate-50">R$</span>
                          <input
                            type="text"
                            defaultValue={Number(row.juros || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            onBlur={(e) => handleChangeOutrosBancosLinha(month, row.id, 'juros', e.target.value)}
                            className="h-full w-full px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 text-right"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right no-print">
                        <button
                          onClick={() => handleRemoveOutrosBancosLinha(month, row.id)}
                          className="inline-flex items-center h-8 px-2.5 text-xs font-semibold text-red-600 border border-red-200 rounded-md hover:text-red-700 hover:bg-red-50"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-100">
                    <td className="px-4 py-2.5 text-right font-bold text-slate-800">Total</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">{formatCurrency(totalDespesaRateio)}</td>
                    <td className="px-4 py-2.5 no-print" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden outros-bancos-rateio-marca-block">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-700">Rateio da Despesa por Marca</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Marca</th>
                    <th className="text-right px-3 py-2 font-semibold">Capital Circulante</th>
                    <th className="text-right px-3 py-2 font-semibold">% Uso Circulante</th>
                    <th className="text-right px-3 py-2 font-semibold">Despesa Rateada</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-blue-900">VW</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(vwCapital)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{vwPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
                    <td className="px-3 py-2 text-right font-bold text-blue-900">{formatCurrency(vwRateio)}</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-red-900">Audi</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(audiCapital)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{audiPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
                    <td className="px-3 py-2 text-right font-bold text-red-900">{formatCurrency(audiRateio)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-emerald-50">
                    <td className="px-3 py-2 text-right font-bold text-slate-800">Total Rateado</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right font-bold text-slate-800">
                      {(vwPercent + audiPercent).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(vwRateio + audiRateio)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden outros-bancos-rateio-entre-dept-block">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-700">Rateio entre Departamentos (Base: % Uso do Circulante)</h3>
            </div>

            {!!assinaturaOutrosBancos && (
              <div className="hidden print:block border-b border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-800">
                {printSignatureTextOutrosBancos}
              </div>
            )}

            <div className="px-3 py-2 border-b border-slate-200 bg-amber-50 flex flex-wrap gap-2 items-center">
              <span className="text-xs font-semibold text-amber-800">Débito dos departamentos:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded border border-amber-300 bg-white text-xs font-bold text-amber-900">Conta {OUTROS_BANCOS_DEBITO_CONTA}</span>
              <span className="text-xs font-semibold text-amber-800 ml-2">Crédito na Administração VW:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded border border-amber-300 bg-white text-xs font-bold text-amber-900">Conta {OUTROS_BANCOS_CREDITO_CONTA}</span>
            </div>

            <div className="p-3 grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="border border-blue-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-blue-200 bg-blue-50">
                  <p className="text-sm font-bold text-blue-900">VW - Rateio por Departamento</p>
                </div>
                <div className="px-3 py-2 border-b border-blue-200 bg-blue-50/60 space-y-1.5 no-print">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-800">Selecionar departamentos VW</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DEPARTMENT_ORDER.map((dept) => {
                      const selected = selectedVwDepartments.includes(dept);
                      return (
                        <button
                          key={`vw-inline-${dept}`}
                          onClick={() => handleToggleOutrosBancosDepartamento(month, 'vw', dept)}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors ${selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                        >
                          {DEPARTMENT_LABELS[dept]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold">Departamento</th>
                        <th className="text-right px-3 py-2 font-semibold">% Recalculado</th>
                        <th className="text-right px-3 py-2 font-semibold">Despesa Rateada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DEPARTMENT_ORDER.map((dept) => {
                        const selected = selectedVwDepartments.includes(dept);
                        return (
                          <tr key={`vw-dept-row-${dept}`} className="border-t border-slate-100">
                            <td className={`px-3 py-2 font-semibold ${selected ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{DEPARTMENT_LABELS[dept]}</td>
                            <td className={`px-3 py-2 text-right font-semibold ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
                              {selected
                                ? `${(vwDeptRateio[dept]?.percentRebased ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                                : '-'}
                            </td>
                            <td className={`px-3 py-2 text-right font-semibold ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
                              {selected ? formatCurrency(vwDeptRateio[dept]?.valorRateado ?? 0) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td className="px-3 py-2 text-right font-bold text-slate-800">Total</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-800">
                          {selectedVwDepartments.length > 0
                            ? `${selectedVwDepartments.reduce((sum, dept) => sum + (vwDeptRateio[dept]?.percentRebased ?? 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                            : '0,00%'}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(vwDeptTotalRateado)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="border border-red-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-red-200 bg-red-50">
                  <p className="text-sm font-bold text-red-900">Audi - Rateio por Departamento</p>
                </div>
                <div className="px-3 py-2 border-b border-red-200 bg-red-50/60 space-y-1.5 no-print">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-red-800">Selecionar departamentos Audi</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DEPARTMENT_ORDER.map((dept) => {
                      const selected = selectedAudiDepartments.includes(dept);
                      return (
                        <button
                          key={`audi-inline-${dept}`}
                          onClick={() => handleToggleOutrosBancosDepartamento(month, 'audi', dept)}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors ${selected ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-200 hover:bg-red-100'}`}
                        >
                          {DEPARTMENT_LABELS[dept]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold">Departamento</th>
                        <th className="text-right px-3 py-2 font-semibold">% Recalculado</th>
                        <th className="text-right px-3 py-2 font-semibold">Despesa Rateada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DEPARTMENT_ORDER.map((dept) => {
                        const selected = selectedAudiDepartments.includes(dept);
                        return (
                          <tr key={`audi-dept-row-${dept}`} className="border-t border-slate-100">
                            <td className={`px-3 py-2 font-semibold ${selected ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{DEPARTMENT_LABELS[dept]}</td>
                            <td className={`px-3 py-2 text-right font-semibold ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
                              {selected
                                ? `${(audiDeptRateio[dept]?.percentRebased ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                                : '-'}
                            </td>
                            <td className={`px-3 py-2 text-right font-semibold ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
                              {selected ? formatCurrency(audiDeptRateio[dept]?.valorRateado ?? 0) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td className="px-3 py-2 text-right font-bold text-slate-800">Total</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-800">
                          {selectedAudiDepartments.length > 0
                            ? `${selectedAudiDepartments.reduce((sum, dept) => sum + (audiDeptRateio[dept]?.percentRebased ?? 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                            : '0,00%'}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(audiDeptTotalRateado)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 p-3 outros-bancos-lancamentos-block">
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                  <h4 className="text-sm font-bold text-slate-700">Lançamentos Contábeis de Fechamento</h4>
                </div>

                {!!assinaturaOutrosBancos && (
                  <div className="hidden print:block border-b border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-800">
                    {printSignatureTextOutrosBancos}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold">Marca</th>
                        <th className="text-left px-3 py-2 font-semibold">Departamento</th>
                        <th className="text-left px-3 py-2 font-semibold">Conta</th>
                        <th className="text-left px-3 py-2 font-semibold">Natureza</th>
                        <th className="text-right px-3 py-2 font-semibold">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lancamentosDebito.map((row, idx) => (
                        <tr key={`lcto-debito-${idx}`} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-semibold text-slate-800">{row.marca}</td>
                          <td className="px-3 py-2 text-slate-700">{row.departamento}</td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.conta}</td>
                          <td className="px-3 py-2 font-semibold text-red-700">{row.natureza}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatCurrency(row.valor)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-200 bg-emerald-50">
                        <td className="px-3 py-2 font-semibold text-slate-800">VW</td>
                        <td className="px-3 py-2 text-slate-700">Administração</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-700">{OUTROS_BANCOS_CREDITO_CONTA}</td>
                        <td className="px-3 py-2 font-semibold text-emerald-700">Crédito</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(totalCreditoAdministracaoVw)}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td colSpan={4} className="px-3 py-2 text-right font-bold text-slate-800">Total Débito Departamentos</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(totalDebitoDepartamentos)}</td>
                      </tr>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td colSpan={4} className="px-3 py-2 text-right font-bold text-slate-800">Total Crédito Administração VW</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(totalCreditoAdministracaoVw)}</td>
                      </tr>
                      <tr className="border-t border-slate-200 bg-sky-50">
                        <td colSpan={4} className="px-3 py-2 text-right font-bold text-slate-800">Diferença (Débito - Crédito)</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(totalDebitoDepartamentos - totalCreditoAdministracaoVw)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {renderFinanceiroAssinaturaOutrosBancosSection(month)}
        </div>
      </section>
    );
  }

  function handlePrintContabil() {
    const printRoot = document.getElementById('print-root');
    const area = document.getElementById('rateio-contabil-print-area');

    if (!printRoot || !area) {
      window.print();
      return;
    }

    const clone = area.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.no-print').forEach((el) => el.remove());
    printRoot.innerHTML = '';
    printRoot.appendChild(clone);

    const orientationStyle = document.createElement('style');
    orientationStyle.setAttribute('data-print-orientation', 'contabil-portrait');
    orientationStyle.textContent = '@page { size: A4 portrait; margin: 0.5cm 0.5cm; }';
    document.head.appendChild(orientationStyle);

    try {
      window.print();
    } finally {
      orientationStyle.remove();
      printRoot.innerHTML = '';
    }
  }

  function handlePrintContabilOutrosBancos() {
    const printRoot = document.getElementById('print-root');
    const area = document.getElementById('rateio-contabil-outros-bancos-print-area');

    if (!printRoot || !area) {
      window.print();
      return;
    }

    const clone = area.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.no-print').forEach((el) => el.remove());
    printRoot.innerHTML = '';
    printRoot.appendChild(clone);

    const orientationStyle = document.createElement('style');
    orientationStyle.setAttribute('data-print-orientation', 'outros-bancos-portrait');
    orientationStyle.textContent = '@page { size: A4 portrait; margin: 0.8cm 0.7cm; }';
    document.head.appendChild(orientationStyle);

    try {
      window.print();
    } finally {
      orientationStyle.remove();
      printRoot.innerHTML = '';
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Rateio Despesas Financeiras - (Rotativo Banco Volks e outros Bancos)</h1>
          <p className="text-xs text-slate-500 mt-0.5">Ativo circulante (1.1) e passivo circulante (2.1) por mês e por marca</p>
        </div>
        <div className="flex items-center gap-2">
          {(activeTab === 'contabil' || activeTab === 'contabilOutrosBancos') && (
            <button
              onClick={activeTab === 'contabil' ? handlePrintContabil : handlePrintContabilOutrosBancos}
              className="inline-flex items-center gap-1.5 text-xs border border-slate-300 rounded px-3 py-1.5 text-slate-700 bg-white hover:bg-slate-50"
            >
              Imprimir / PDF
            </button>
          )}
          <button
            onClick={() => {
              setDraftConfig(config);
              setShowConfig(true);
            }}
            className="inline-flex items-center gap-1.5 text-xs border border-slate-300 rounded px-3 py-1.5 text-slate-700 bg-white hover:bg-slate-50"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Configurar contas
          </button>
          <button
            onClick={onBackToRateios}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
          >
            ← Voltar para Rateios
          </button>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-bold text-slate-700">ANO</span>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="h-9 px-3 text-sm font-semibold rounded-md border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <div className="w-px h-5 bg-slate-200" />

        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setSelectedMonth('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedMonth === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Ano todo
          </button>
          {MONTH_NAMES.map((monthName, index) => {
            const value = index + 1;
            const active = selectedMonth === value;
            return (
              <button
                key={monthName}
                onClick={() => setSelectedMonth(value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {monthName}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('rotativo')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${activeTab === 'rotativo' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
        >
          Rotativo Banco Volks
        </button>
        <button
          onClick={() => setActiveTab('departamento')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${activeTab === 'departamento' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
        >
          Rateio Departamento (Rot.Volks)
        </button>
        <button
          onClick={() => setActiveTab('contabil')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${activeTab === 'contabil' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
        >
          Demonstrativo Contabil (Rot.Volks)
        </button>
        <button
          onClick={() => setActiveTab('contabilOutrosBancos')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${activeTab === 'contabilOutrosBancos' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
        >
          Demonstrativo Contábil Outros Bancos
        </button>
      </div>

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 py-16 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
          </div>
        ) : (
          activeTab === 'rotativo' ? monthsToRender.map((month) => (
            <section key={month} className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800">{MONTH_NAMES[month - 1]} / {selectedYear}</h2>
              <MonthTaxaJurosControl
                month={month}
                taxaPercent={monthFinancials[month]?.taxaPercent ?? 0}
                onApply={handleApplyTaxaFromMonth}
              />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <BrandMonthTable
                  brand="vw"
                  month={month}
                  config={config}
                  accountsByMonth={vwData}
                  descriptions={descriptions}
                  resultadoPeriodo={resultadoPeriodoByBrandMonth.vw[month] ?? 0}
                  resultRows={vwResults[month] ?? []}
                  endividamentoContas={vwEndividamento[month] ?? []}
                  onAddResultLine={handleAddResultLine}
                  onRemoveResultLine={handleRemoveResultLine}
                  canRemoveResultLine={canRemoveResultLine}
                  onChangeResultLineValue={handleChangeResultLineValue}
                  onAddEndividamentoConta={handleAddEndividamentoConta}
                  onRemoveEndividamentoConta={handleRemoveEndividamentoConta}
                  circulantePercent={monthFinancials[month]?.vwPercent ?? 0}
                  taxaJurosPercent={monthFinancials[month]?.taxaPercent ?? 0}
                  endividamentoBaseMarca={monthFinancials[month]?.vwEndividamentoBase ?? 0}
                  jurosCalculadoMarca={monthFinancials[month]?.vwJurosCalculado ?? 0}
                />
                <BrandMonthTable
                  brand="audi"
                  month={month}
                  config={config}
                  accountsByMonth={audiData}
                  descriptions={descriptions}
                  resultadoPeriodo={resultadoPeriodoByBrandMonth.audi[month] ?? 0}
                  resultRows={audiResults[month] ?? []}
                  endividamentoContas={audiEndividamento[month] ?? []}
                  onAddResultLine={handleAddResultLine}
                  onRemoveResultLine={handleRemoveResultLine}
                  canRemoveResultLine={canRemoveResultLine}
                  onChangeResultLineValue={handleChangeResultLineValue}
                  onAddEndividamentoConta={handleAddEndividamentoConta}
                  onRemoveEndividamentoConta={handleRemoveEndividamentoConta}
                  circulantePercent={monthFinancials[month]?.audiPercent ?? 0}
                  taxaJurosPercent={monthFinancials[month]?.taxaPercent ?? 0}
                  endividamentoBaseMarca={monthFinancials[month]?.audiEndividamentoBase ?? 0}
                  jurosCalculadoMarca={monthFinancials[month]?.audiJurosCalculado ?? 0}
                />
              </div>
              {renderLiquidezEntreMarcasTable(month)}
            </section>
          )) : activeTab === 'departamento' ? monthsToRender.map((month) => (
            <section key={month} className="space-y-4">
              <h2 className="text-lg font-bold text-slate-800">Rateio Departamento - {MONTH_NAMES[month - 1]} / {selectedYear}</h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {renderDepartamentoBrandPanel('vw', month)}
                {renderDepartamentoBrandPanel('audi', month)}
              </div>
            </section>
          )) : activeTab === 'contabil' ? (
            <div id="rateio-contabil-print-area" className="space-y-4 print:space-y-2">
              {monthsToRender.map((month) => {
                const nextMonth = month === 12 ? 1 : month + 1;
                const nextYear = month === 12 ? selectedYear + 1 : selectedYear;

                return (
                  <section key={month} className="space-y-4 print:space-y-2">
                    <h2 className="contabil-print-month-title text-lg font-bold text-slate-800">
                      <span className="print:hidden">Demonstrativo Contábil - {MONTH_NAMES[month - 1]} / {selectedYear}</span>
                      <span className="hidden print:inline">Rateio Despesa Financeira Credito Rotativo Banco Volks.</span>
                    </h2>

                    <div className="contabil-print-warning rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-xs font-semibold text-amber-900">
                        Reconhecimento contábil: a despesa apurada em {MONTH_NAMES[month - 1]}/{selectedYear} deve ser reconhecida no mês subsequente,
                        em {MONTH_NAMES[nextMonth - 1]}/{nextYear}.
                      </p>
                    </div>

                    <div className="contabil-print-brands space-y-4">
                      {renderContabilBrandSection('vw', month)}
                      {renderContabilBrandSection('audi', month)}
                      {renderFinanceiroAssinaturaSection(month)}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div id="rateio-contabil-outros-bancos-print-area" className="space-y-4 print:space-y-2">
              {monthsToRender.map((month) => renderOutrosBancosSection(month))}
            </div>
          )
        )}
      </div>

      {assinaFinanceiroDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-800">Assinar - Financeiro</h3>
              </div>
              <button onClick={() => setAssinaFinanceiroDialog(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">X</button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuário</label>
                <div className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-slate-50 select-none">
                  {session?.username ?? '-'}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Senha</label>
                <input
                  type="password"
                  autoFocus
                  value={assinaFinanceiroDialog.senha}
                  onChange={(e) => setAssinaFinanceiroDialog((prev) => (prev ? { ...prev, senha: e.target.value, erro: null } : prev))}
                  onKeyDown={(e) => e.key === 'Enter' && !assinaFinanceiroDialog.loading && handleConfirmarAssinaturaFinanceiro()}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="Digite sua senha"
                />
                {assinaFinanceiroDialog.erro && (
                  <p className="text-xs text-red-500 mt-0.5">{assinaFinanceiroDialog.erro}</p>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setAssinaFinanceiroDialog(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarAssinaturaFinanceiro}
                disabled={assinaFinanceiroDialog.loading || !assinaFinanceiroDialog.senha}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                <PenLine className="w-3.5 h-3.5" />
                {assinaFinanceiroDialog.loading ? 'Assinando...' : 'Assinar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reabrirAssinaturaDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <LockOpen className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-800">Reabrir assinatura - Financeiro</h3>
              </div>
              <button onClick={() => setReabrirAssinaturaDialog(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">X</button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <p className="text-sm text-slate-600">
                Isso irá remover a assinatura atual do Financeiro para {MONTH_NAMES[reabrirAssinaturaDialog.month - 1]}/{selectedYear}.
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Senha</label>
                <input
                  type="password"
                  autoFocus
                  value={reabrirAssinaturaDialog.senha}
                  onChange={(e) => setReabrirAssinaturaDialog((prev) => (prev ? { ...prev, senha: e.target.value, erro: null } : prev))}
                  onKeyDown={(e) => e.key === 'Enter' && !reabrirAssinaturaDialog.loading && handleConfirmarReabrirAssinaturaFinanceiro()}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Digite sua senha"
                />
                {reabrirAssinaturaDialog.erro && (
                  <p className="text-xs text-red-500 mt-0.5">{reabrirAssinaturaDialog.erro}</p>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setReabrirAssinaturaDialog(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarReabrirAssinaturaFinanceiro}
                disabled={reabrirAssinaturaDialog.loading || !reabrirAssinaturaDialog.senha}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                <LockOpen className="w-3.5 h-3.5" />
                {reabrirAssinaturaDialog.loading ? 'Reabrindo...' : 'Reabrir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {assinaFinanceiroOutrosBancosDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-800">Assinar - Financeiro (Outros Bancos)</h3>
              </div>
              <button onClick={() => setAssinaFinanceiroOutrosBancosDialog(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">X</button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuário</label>
                <div className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-slate-50 select-none">
                  {session?.username ?? '-'}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Senha</label>
                <input
                  type="password"
                  autoFocus
                  value={assinaFinanceiroOutrosBancosDialog.senha}
                  onChange={(e) => setAssinaFinanceiroOutrosBancosDialog((prev) => (prev ? { ...prev, senha: e.target.value, erro: null } : prev))}
                  onKeyDown={(e) => e.key === 'Enter' && !assinaFinanceiroOutrosBancosDialog.loading && handleConfirmarAssinaturaFinanceiroOutrosBancos()}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="Digite sua senha"
                />
                {assinaFinanceiroOutrosBancosDialog.erro && (
                  <p className="text-xs text-red-500 mt-0.5">{assinaFinanceiroOutrosBancosDialog.erro}</p>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setAssinaFinanceiroOutrosBancosDialog(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarAssinaturaFinanceiroOutrosBancos}
                disabled={assinaFinanceiroOutrosBancosDialog.loading || !assinaFinanceiroOutrosBancosDialog.senha}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                <PenLine className="w-3.5 h-3.5" />
                {assinaFinanceiroOutrosBancosDialog.loading ? 'Assinando...' : 'Assinar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reabrirAssinaturaOutrosBancosDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <LockOpen className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-800">Reabrir assinatura - Financeiro (Outros Bancos)</h3>
              </div>
              <button onClick={() => setReabrirAssinaturaOutrosBancosDialog(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">X</button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <p className="text-sm text-slate-600">
                Isso irá remover a assinatura atual do Financeiro para {MONTH_NAMES[reabrirAssinaturaOutrosBancosDialog.month - 1]}/{selectedYear}.
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Senha</label>
                <input
                  type="password"
                  autoFocus
                  value={reabrirAssinaturaOutrosBancosDialog.senha}
                  onChange={(e) => setReabrirAssinaturaOutrosBancosDialog((prev) => (prev ? { ...prev, senha: e.target.value, erro: null } : prev))}
                  onKeyDown={(e) => e.key === 'Enter' && !reabrirAssinaturaOutrosBancosDialog.loading && handleConfirmarReabrirAssinaturaFinanceiroOutrosBancos()}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Digite sua senha"
                />
                {reabrirAssinaturaOutrosBancosDialog.erro && (
                  <p className="text-xs text-red-500 mt-0.5">{reabrirAssinaturaOutrosBancosDialog.erro}</p>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setReabrirAssinaturaOutrosBancosDialog(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarReabrirAssinaturaFinanceiroOutrosBancos}
                disabled={reabrirAssinaturaOutrosBancosDialog.loading || !reabrirAssinaturaOutrosBancosDialog.senha}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                <LockOpen className="w-3.5 h-3.5" />
                {reabrirAssinaturaOutrosBancosDialog.loading ? 'Reabrindo...' : 'Reabrir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfig && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Configurar contas do circulante</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Compartilhado aplica automaticamente em VW e Audi. Use os blocos individuais para exceções por marca.
                </p>
              </div>
              <button
                onClick={() => setShowConfig(false)}
                className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5"
              >
                Fechar
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-auto max-h-[calc(90vh-130px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ConfigSection
                  title="Compartilhado - Ativo Circulante (1.1)"
                  contas={ativoOptions}
                  selected={draftConfig.shared.ativo}
                  onToggle={(conta) => toggleDraft('shared', 'ativo', conta)}
                />
                <ConfigSection
                  title="Compartilhado - Passivo Circulante (2.1)"
                  contas={passivoOptions}
                  selected={draftConfig.shared.passivo}
                  onToggle={(conta) => toggleDraft('shared', 'passivo', conta)}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-blue-900">Ajustes individuais VW</h4>
                  <ConfigSection
                    title="VW - Ativo Circulante"
                    contas={ativoOptions}
                    selected={draftConfig.vw.ativo}
                    onToggle={(conta) => toggleDraft('vw', 'ativo', conta)}
                  />
                  <ConfigSection
                    title="VW - Passivo Circulante"
                    contas={passivoOptions}
                    selected={draftConfig.vw.passivo}
                    onToggle={(conta) => toggleDraft('vw', 'passivo', conta)}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-red-800">Ajustes individuais Audi</h4>
                  <ConfigSection
                    title="Audi - Ativo Circulante"
                    contas={ativoOptions}
                    selected={draftConfig.audi.ativo}
                    onToggle={(conta) => toggleDraft('audi', 'ativo', conta)}
                  />
                  <ConfigSection
                    title="Audi - Passivo Circulante"
                    contas={passivoOptions}
                    selected={draftConfig.audi.passivo}
                    onToggle={(conta) => toggleDraft('audi', 'passivo', conta)}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setDraftConfig(config);
                  setShowConfig(false);
                }}
                className="text-xs text-slate-600 hover:text-slate-800 border border-slate-200 rounded px-3 py-1.5"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="text-xs text-white bg-blue-600 hover:bg-blue-700 rounded px-3 py-1.5 disabled:opacity-50"
              >
                {savingConfig ? 'Salvando...' : 'Salvar configuração'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
