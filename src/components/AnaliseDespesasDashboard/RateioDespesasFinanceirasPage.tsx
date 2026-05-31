import { useEffect, useMemo, useState } from 'react';
import { Loader2, Settings2 } from 'lucide-react';
import {
  type AnaliseBrand,
  type RateioCirculanteConfig,
  type RateioResultadoLinha,
  type RateioResultadosBrandYearData,
  loadMultipleMonthsAnaliseDespesas,
  loadRateioCirculanteConfig,
  loadRateioResultados,
  saveRateioCirculanteConfig,
  saveRateioResultados,
} from './analiseDespesasStorage';

type CirculanteGroup = 'ativo' | 'passivo';
type MonthChoice = 'all' | number;

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

function parseManualValue(raw: string): number {
  if (!raw.trim()) return 0;
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const resultadoAjustado = resultRows.reduce((sum, row) => sum + row.value, 0);
  return ativoTotal + passivoTotal + resultadoAjustado;
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
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <h4 className="text-sm font-semibold text-slate-700 mb-2">{title}</h4>
      <div className="max-h-64 overflow-auto space-y-1 pr-1">
        {contas.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma conta disponível neste grupo para o ano selecionado.</p>
        ) : (
          contas.map((item) => (
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

function BrandMonthTable({
  brand,
  month,
  config,
  accountsByMonth,
  descriptions,
  resultRows,
  onAddResultLine,
  onChangeResultLineValue,
  circulantePercent,
}: {
  brand: AnaliseBrand;
  month: number;
  config: RateioCirculanteConfig;
  accountsByMonth: AccountsByMonth;
  descriptions: Record<string, string>;
  resultRows: RateioResultadoLinha[];
  onAddResultLine: (brand: AnaliseBrand, month: number, label: string, value: number) => void;
  onChangeResultLineValue: (brand: AnaliseBrand, month: number, lineId: string, value: number) => void;
  circulantePercent: number;
}) {
  const [newLineName, setNewLineName] = useState('');
  const [newLineValue, setNewLineValue] = useState('0');

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
  const resultadoPeriodo = 0;
  const totalExtras = resultRows.reduce((sum, row) => sum + row.value, 0);
  const resultadoAjustado = resultadoPeriodo + totalExtras;
  const totalGeral = ativoData.total + passivoData.total + resultadoAjustado;

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
                    <input
                      type="text"
                      value={String(row.value).replace('.', ',')}
                      onChange={(e) => onChangeResultLineValue(brand, month, row.id, parseManualValue(e.target.value))}
                      className="w-36 h-8 px-2 text-sm text-right rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
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
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(resultadoAjustado)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-emerald-50">
                <td className="px-3 py-2 text-right font-bold text-slate-800">Total Geral</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(totalGeral)}</td>
              </tr>
              <tr className="border-t border-slate-200 bg-sky-50">
                <td className="px-3 py-2 text-right font-semibold text-slate-700">% Uso Circulante (VW + Audi)</td>
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

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <h3 className="text-base font-bold text-slate-800 mb-3">
        {BRAND_LABEL[brand]} - {MONTH_NAMES[month - 1]}
      </h3>
      {renderGroup('Ativo Circulante', ativoData.rows, ativoData.total)}
      {renderGroup('Passivo Circulante', passivoData.rows, passivoData.total)}
      {renderResultadosTable()}
      {renderTotalTable()}
    </div>
  );
}

export function RateioDespesasFinanceirasPage({ onBackToRateios }: RateioDespesasFinanceirasPageProps) {
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

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
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [ativoOptions, setAtivoOptions] = useState<Array<{ conta: string; desc: string }>>([]);
  const [passivoOptions, setPassivoOptions] = useState<Array<{ conta: string; desc: string }>>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      try {
        const [savedConfig, rawVwMonths, rawAudiMonths, savedVwResults, savedAudiResults] = await Promise.all([
          loadRateioCirculanteConfig(),
          loadMultipleMonthsAnaliseDespesas('vw', selectedYear, MONTHS),
          loadMultipleMonthsAnaliseDespesas('audi', selectedYear, MONTHS),
          loadRateioResultados('vw', selectedYear),
          loadRateioResultados('audi', selectedYear),
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

        setConfig(savedConfig);
        setDraftConfig(savedConfig);
        setVwData(nextVwData);
        setAudiData(nextAudiData);
        setVwResults(cloneResultsByMonth(savedVwResults));
        setAudiResults(cloneResultsByMonth(savedAudiResults));
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

  const monthsToRender = useMemo(() => {
    if (selectedMonth === 'all') return MONTHS;
    return [selectedMonth];
  }, [selectedMonth]);

  const monthTotals = useMemo(() => {
    const out: Record<number, { vw: number; audi: number; total: number }> = {};
    for (const month of MONTHS) {
      const vwTotal = getBrandMonthTotal('vw', month, config, vwData, vwResults[month] ?? []);
      const audiTotal = getBrandMonthTotal('audi', month, config, audiData, audiResults[month] ?? []);
      out[month] = {
        vw: vwTotal,
        audi: audiTotal,
        total: vwTotal + audiTotal,
      };
    }
    return out;
  }, [config, vwData, audiData, vwResults, audiResults]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Rateio Despesa Financeiras - (Rotativo Banco Volks)</h1>
          <p className="text-xs text-slate-500 mt-0.5">Ativo circulante (1.1) e passivo circulante (2.1) por mês e por marca</p>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 py-16 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
          </div>
        ) : (
          monthsToRender.map((month) => (
            <section key={month} className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800">{MONTH_NAMES[month - 1]} / {selectedYear}</h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <BrandMonthTable
                  brand="vw"
                  month={month}
                  config={config}
                  accountsByMonth={vwData}
                  descriptions={descriptions}
                  resultRows={vwResults[month] ?? []}
                  onAddResultLine={handleAddResultLine}
                  onChangeResultLineValue={handleChangeResultLineValue}
                  circulantePercent={monthTotals[month]?.total ? (monthTotals[month].vw / monthTotals[month].total) * 100 : 0}
                />
                <BrandMonthTable
                  brand="audi"
                  month={month}
                  config={config}
                  accountsByMonth={audiData}
                  descriptions={descriptions}
                  resultRows={audiResults[month] ?? []}
                  onAddResultLine={handleAddResultLine}
                  onChangeResultLineValue={handleChangeResultLineValue}
                  circulantePercent={monthTotals[month]?.total ? (monthTotals[month].audi / monthTotals[month].total) * 100 : 0}
                />
              </div>
            </section>
          ))
        )}
      </div>

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
