import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { YearModeGroupSection } from './AdmTabShared';
import {
  getDespesasAdmMes,
  loadClassificacoes,
  loadObsOficina,
  saveObsOficina,
  extractByDeptoRule,
  loadRegrasDeptos,
  mergeAssistenciaMedica,
  mergeSalariosOrdenados,
  mergeHorasExtras,
  mergeAdicionais,
  mergeIndenizacoesTrabalistas,
  merge13Salario,
  mergeFeriasIndenizadas,
  mergeFerias,
  mergeInss,
  mergeFgts,
  mergeFgtsMulta,
  mergeAssistenciaMedicaNova,
  mergeValeTransporte,
  mergePremiosGratificacoes,
  type DespesasAdmMesData,
  type TipoClassificacao,
  TIPO_LABELS,
  TIPOS_ORDENADOS,
} from './despesasDeptoAudiStorage';


const MONTHS_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const GRUPO_CONFIG: Record<TipoClassificacao, { color: string; light: string; badge: string }> = {
  pessoal:             { color: '#1e40af', light: '#eff6ff', badge: '#dbeafe' },
  servicos_terceiros:  { color: '#5b21b6', light: '#faf5ff', badge: '#ede9fe' },
  ocupacao:            { color: '#92400e', light: '#fffbeb', badge: '#fef3c7' },
  funcionamento:       { color: '#0f766e', light: '#f0fdfa', badge: '#ccfbf1' },
  vendas:              { color: '#c2410c', light: '#fff7ed', badge: '#ffedd5' },
  amort_deprec:        { color: '#334155', light: '#f8fafc', badge: '#e2e8f0' },
  financeiras:         { color: '#991b1b', light: '#fef2f2', badge: '#fee2e2' },
  outras_operacionais: { color: '#374151', light: '#fafafa', badge: '#f3f4f6' },
};

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Célula de Observação ─────────────────────────────────────────────────────

function ObsCell({
  conta, obs, onSave,
}: {
  conta: string;
  obs: Record<string, string>;
  onSave: (newObs: Record<string, string>) => Promise<void>;
}) {
  const [value, setValue] = useState(obs[conta] ?? '');

  useEffect(() => { setValue(obs[conta] ?? ''); }, [obs, conta]);

  async function handleBlur() {
    const newObs = { ...obs };
    if (value.trim() === '') delete newObs[conta];
    else newObs[conta] = value.trim();
    if (newObs[conta] !== obs[conta]) await onSave(newObs);
  }

  return (
    <input
      type="text"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="Adicionar observação..."
      className="w-full text-xs text-slate-600 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-slate-400 focus:outline-none placeholder-slate-300 py-0.5 transition-colors"
    />
  );
}

// ─── Seção de Grupo ───────────────────────────────────────────────────────────

interface ContaRow { conta: string; valor: number; }

function GroupSection({
  tipo, rows, obs, year, month, isYearMode, onObsChange,
}: {
  tipo: TipoClassificacao;
  rows: ContaRow[];
  obs: Record<string, string>;
  year: number;
  month: number;
  isYearMode: boolean;
  onObsChange: (newObs: Record<string, string>) => Promise<void>;
}) {
  const cfg = GRUPO_CONFIG[tipo];
  const subtotal = rows.reduce((acc, r) => acc + r.valor, 0);
  const [saving, setSaving] = useState(false);

  async function handleObsSave(newObs: Record<string, string>) {
    setSaving(true);
    await onObsChange(newObs);
    setSaving(false);
  }

  return (
    <div
      className="bg-white rounded-xl overflow-hidden shadow-sm"
      style={{ border: `1px solid ${cfg.badge}`, borderLeft: `4px solid ${cfg.color}` }}
    >
      {/* Cabeçalho do grupo */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ backgroundColor: cfg.light }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
          <span className="text-sm font-bold" style={{ color: cfg.color }}>
            {TIPO_LABELS[tipo]}
          </span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: cfg.badge, color: cfg.color }}
          >
            {rows.length} conta{rows.length !== 1 ? 's' : ''}
          </span>
          {saving && <span className="text-[10px] text-slate-400 italic">Salvando...</span>}
        </div>
        <span className="text-sm font-bold tabular-nums" style={{ color: cfg.color }}>
          R$&nbsp;{fmtBRL(subtotal)}
        </span>
      </div>

      {/* Tabela de contas */}
      <div className="overflow-x-auto">
      <table className="table-fixed w-full text-xs">
        <colgroup>
          <col style={{ width: '40%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '45%' }} />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60">
            <th className="text-left px-4 py-2 font-semibold text-slate-500">Conta / Descrição</th>
            <th className="text-right px-4 py-2 font-semibold text-slate-500 w-40">
              Valor (R$)
            </th>
            {!isYearMode && (
              <th className="text-left px-4 py-2 font-semibold text-slate-500 w-72">
                Observação
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.conta}
              className={`border-b border-slate-50 transition-colors hover:bg-slate-50/50 ${
                i % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'
              }`}
            >
              <td className="px-4 py-2 text-slate-700 font-medium truncate" title={row.conta}>{row.conta}</td>
              <td
                className={`px-4 py-2 text-right font-mono tabular-nums font-semibold ${
                  row.valor < 0 ? 'text-red-600' : 'text-slate-800'
                }`}
              >
                {fmtBRL(row.valor)}
              </td>
              {!isYearMode && (
                <td className="px-4 py-2">
                  <ObsCell conta={row.conta} obs={obs} onSave={handleObsSave} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {/* subtotal */}
        <tfoot>
          <tr style={{ backgroundColor: cfg.badge }}>
            <td className="px-4 py-2 text-xs font-bold" style={{ color: cfg.color }}>
              Subtotal — {TIPO_LABELS[tipo]}
            </td>
            <td
              className="px-4 py-2 text-right text-xs font-bold tabular-nums"
              style={{ color: cfg.color }}
            >
              {fmtBRL(subtotal)}
            </td>
            {!isYearMode && <td />}
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  year: number;
  month: number;
}

export function OficinaTab({ year, month }: Props) {
  const isYearMode = month === 0;

  const [loading, setLoading] = useState(true);
  const [valorMap, setValorMap] = useState<Map<string, number>>(new Map());
  const [monthMaps, setMonthMaps] = useState<Map<string, number>[]>(Array.from({ length: 12 }, () => new Map()));
  const [monthsWithData, setMonthsWithData] = useState<number[]>([]);
  const [classificacoes, setClassificacoes] = useState<Record<string, TipoClassificacao>>({});
  const [obs, setObs] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      const [classif, regras] = await Promise.all([loadClassificacoes(), loadRegrasDeptos()]);

      let valMap: Map<string, number>;
      if (isYearMode) {
        const allMonths = await Promise.all(
          Array.from({ length: 12 }, (_, i) => getDespesasAdmMes(year, i + 1))
        );
        const maps: Map<string, number>[] = Array.from({ length: 12 }, () => new Map());
        const withData: number[] = [];
        valMap = new Map();
        for (let i = 0; i < 12; i++) {
          const data = allMonths[i];
          if (!data) continue;
          const mMap = extractByDeptoRule(data, 'oficina', regras);
          mergeAssistenciaMedica(mMap);
          mergeSalariosOrdenados(mMap);
          mergeHorasExtras(mMap);
          mergeAdicionais(mMap);
          mergeIndenizacoesTrabalistas(mMap);
          merge13Salario(mMap);
          mergeFeriasIndenizadas(mMap);
          mergeFerias(mMap);
          mergeInss(mMap);
          mergeFgts(mMap);
          mergeFgtsMulta(mMap);
          mergeAssistenciaMedicaNova(mMap);
          mergeValeTransporte(mMap);
          mergePremiosGratificacoes(mMap);
          maps[i] = mMap;
          withData.push(i + 1);
          for (const [conta, val] of mMap) valMap.set(conta, (valMap.get(conta) ?? 0) + val);
        }
        // Aplica merges no valMap acumulado
        mergeAssistenciaMedica(valMap);
        mergeSalariosOrdenados(valMap);
        mergeHorasExtras(valMap);
        mergeAdicionais(valMap);
        mergeIndenizacoesTrabalistas(valMap);
        merge13Salario(valMap);
        mergeFeriasIndenizadas(valMap);
        mergeFerias(valMap);
        mergeInss(valMap);
        mergeFgts(valMap);
        mergeFgtsMulta(valMap);
        mergeAssistenciaMedicaNova(valMap);
        mergeValeTransporte(valMap);
        mergePremiosGratificacoes(valMap);
        setMonthMaps(maps);
        setMonthsWithData(withData);
        setObs({});
      } else {
        const [data, obsData] = await Promise.all([
          getDespesasAdmMes(year, month),
          loadObsOficina(year, month),
        ]);
        valMap = data ? extractByDeptoRule(data, 'oficina', regras) : new Map();
        mergeAssistenciaMedica(valMap);
        mergeSalariosOrdenados(valMap);
        mergeHorasExtras(valMap);
        mergeAdicionais(valMap);
        mergeIndenizacoesTrabalistas(valMap);
        merge13Salario(valMap);
        mergeFeriasIndenizadas(valMap);
        mergeFerias(valMap);
        mergeInss(valMap);
        mergeFgts(valMap);
        mergeFgtsMulta(valMap);
        mergeAssistenciaMedicaNova(valMap);
        mergeValeTransporte(valMap);
        mergePremiosGratificacoes(valMap);
        setObs(obsData);
      }

      setValorMap(valMap);
      setClassificacoes(classif);
    };
    load().finally(() => setLoading(false));
  }, [year, month]);

  async function handleObsChange(newObs: Record<string, string>) {
    setObs(newObs);
    if (!isYearMode) await saveObsOficina(year, month, newObs);
  }

  // Agrupa contas classificadas com valor != 0
  const groups = new Map<TipoClassificacao, ContaRow[]>();
  for (const tipo of TIPOS_ORDENADOS) groups.set(tipo, []);

  let grandTotal = 0;
  let totalContas = 0;

  for (const [conta, valor] of valorMap) {
    if (valor === 0) continue;
    const tipo = classificacoes[conta];
    if (!tipo) continue;
    groups.get(tipo)!.push({ conta, valor });
    grandTotal += valor;
    totalContas++;
  }

  // Ordena contas dentro de cada grupo pelo código
  for (const rows of groups.values()) {
    rows.sort((a, b) => a.conta.localeCompare(b.conta));
  }

  const activeGroups = TIPOS_ORDENADOS.filter(t => (groups.get(t)?.length ?? 0) > 0);

  const periodoLabel = isYearMode
    ? `Ano ${year}`
    : `${MONTHS_FULL[month - 1]} / ${year}`;

  const topGroup = activeGroups.reduce<{ tipo: TipoClassificacao | null; total: number }>(
    (acc, t) => {
      const s = groups.get(t)!.reduce((a, r) => a + r.valor, 0);
      return s > acc.total ? { tipo: t, total: s } : acc;
    },
    { tipo: null, total: 0 }
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500" />
      </div>
    );
  }

  if (valorMap.size === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center space-y-2">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-slate-500 font-medium">
            Nenhum dado importado para {periodoLabel}
          </p>
          <p className="text-slate-400 text-sm">
            Importe os dados na aba "Importar Dados" para visualizar.
          </p>
        </div>
      </div>
    );
  }

  if (totalContas === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center space-y-2">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-slate-500 font-medium">
            Nenhuma conta classificada para {periodoLabel}
          </p>
          <p className="text-slate-400 text-sm">
            Classifique as contas em "Importar Dados" → "Classificação de Tipo de Despesas".
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Período</p>
          <p className="text-lg font-bold text-slate-800 mt-1">{periodoLabel}</p>
          <p className="text-xs text-slate-400 mt-0.5">Oficina — Sorana Audi</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            Total de Despesas
          </p>
          <p className="text-lg font-bold text-slate-800 mt-1 tabular-nums">
            R$&nbsp;{fmtBRL(grandTotal)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeGroups.length} grupos · {totalContas} conta{totalContas !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            Maior Grupo
          </p>
          {topGroup.tipo ? (
            <>
              <p
                className="text-sm font-bold mt-1 leading-tight"
                style={{ color: GRUPO_CONFIG[topGroup.tipo].color }}
              >
                {TIPO_LABELS[topGroup.tipo]}
              </p>
              <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                R$&nbsp;{fmtBRL(topGroup.total)}
              </p>
            </>
          ) : null}
        </div>
      </div>

      {/* Grupos de despesa */}
      {isYearMode
        ? activeGroups.map(tipo => (
            <YearModeGroupSection
              key={tipo}
              tipo={tipo}
              rows={groups.get(tipo)!}
              monthMaps={monthMaps}
              monthsWithData={monthsWithData}
            />
          ))
        : activeGroups.map(tipo => (
            <GroupSection
              key={tipo}
              tipo={tipo}
              rows={groups.get(tipo)!}
              obs={obs}
              year={year}
              month={month}
              isYearMode={false}
              onObsChange={handleObsChange}
            />
          ))
      }

      {/* Rodapé — Total Geral */}
      <div className="bg-slate-800 rounded-xl px-5 py-3.5 flex items-center justify-between shadow-md">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            Total Geral de Despesas
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {periodoLabel} · Oficina · {totalContas} conta{totalContas !== 1 ? 's' : ''} em {activeGroups.length} grupo{activeGroups.length !== 1 ? 's' : ''}
          </p>
        </div>
        <p className="text-2xl font-bold text-white tabular-nums">
          R$&nbsp;{fmtBRL(grandTotal)}
        </p>
      </div>
    </div>
  );
}
