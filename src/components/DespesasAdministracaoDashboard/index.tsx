import { useRef, useState, useEffect, useCallback } from 'react';
import { Upload, Trash2, FileText, Tag, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getDespesasAdmMes,
  setDespesasAdmMes,
  deleteDespesasAdmMes,
  loadClassificacoes,
  saveClassificacoes,
  getAllImportedMonthsData,
  type DespesaAdmRow,
  type DespesasAdmMesData,
  type DespesasAdmTotalRow,
  type TipoClassificacao,
  TIPO_LABELS,
  TIPOS_ORDENADOS,
} from './despesasAdmStorage';
import { AdmVwTab } from './AdmVwTab';
import { AdmAudiTab } from './AdmAudiTab';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

function parseNum(s: string): number {
  const cleaned = (s ?? '0').trim().replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function isAllZero(row: DespesaAdmRow): boolean {
  return (
    row.saldoAnterior === 0 &&
    row.valDebito === 0 &&
    row.valCredito === 0 &&
    row.saldoPeriodo === 0 &&
    row.saldoAtual === 0
  );
}

function parseTxt(text: string, fileName: string): DespesasAdmMesData {
  // strip BOM if present
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = clean.split('\n');
  const rows: DespesaAdmRow[] = [];
  let totalRow: DespesasAdmTotalRow | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(';');
    const nivel = parts[0].trim();

    if (nivel === 'T') {
      totalRow = {
        saldoAnterior: parseNum(parts[2]),
        valDebito: parseNum(parts[3]),
        valCredito: parseNum(parts[4]),
        saldoPeriodo: parseNum(parts[5]),
        saldoAtual: parseNum(parts[6]),
      };
      continue;
    }

    if (nivel !== 'A') continue;
    if (parts.length < 7) continue;

    const contaRaw = parts[1];
    const isMain = contaRaw === contaRaw.trimStart(); // leading spaces = sub-company

    rows.push({
      conta: contaRaw.trim(),
      isMain,
      saldoAnterior: parseNum(parts[2]),
      valDebito: parseNum(parts[3]),
      valCredito: parseNum(parts[4]),
      saldoPeriodo: parseNum(parts[5]),
      saldoAtual: parseNum(parts[6]),
    });
  }

  return { rows, totalRow, importedAt: new Date().toISOString(), fileName };
}

function fmtNum(n: number): string {
  if (n === 0) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function NumCell({ value }: { value: number }) {
  const text = fmtNum(value);
  return (
    <td className={`px-4 py-1.5 text-right font-mono text-xs tabular-nums ${value < 0 ? 'text-red-600' : value === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
      {text}
    </td>
  );
}

interface Props {
  onChangeBrand: () => void;
}

type ActiveTab = 'importar' | 'adm_vw' | 'adm_audi' | 'consolidado';
type ImportarSubTab = 'dados' | 'classificacao';

// ─── Seletor de Ano e Mês (estilo pill) ─────────────────────────────────────

interface YearMonthSelectorProps {
  year: number;
  month: number; // 0 = Ano todo, 1-12
  onYearChange: (y: number) => void;
  onMonthChange: (m: number) => void;
}

function YearMonthSelector({ year, month, onYearChange, onMonthChange }: YearMonthSelectorProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap py-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ANO</span>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
          <button
            onClick={() => onYearChange(year - 1)}
            className="text-slate-400 hover:text-slate-700 font-bold px-0.5 transition-colors"
          >
            ‹
          </button>
          <span className="text-sm font-bold text-slate-700 min-w-[38px] text-center select-none">
            {year}
          </span>
          <button
            onClick={() => onYearChange(year + 1)}
            className="text-slate-400 hover:text-slate-700 font-bold px-0.5 transition-colors"
          >
            ›
          </button>
        </div>
      </div>
      <div className="w-px h-5 bg-slate-200 shrink-0" />
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => onMonthChange(0)}
          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
            month === 0 ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          Ano todo
        </button>
        {MONTHS_SHORT.map((m, i) => (
          <button
            key={i}
            onClick={() => onMonthChange(i + 1)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-colors ${
              month === i + 1
                ? 'bg-[#475569] text-white'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}



function ClassificacaoTab() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [classificacoes, setClassificacoes] = useState<Record<string, TipoClassificacao>>({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'classified'>('all');

  useEffect(() => {
    Promise.all([getAllImportedMonthsData(), loadClassificacoes()])
      .then(([allData, classif]) => {
        // Coleta contas principais com pelo menos um valor não-zero em qualquer mês
        const seen = new Map<string, boolean>();
        for (const data of allData) {
          for (const row of data.rows) {
            if (!row.isMain) continue;
            if (!isAllZero(row)) seen.set(row.conta, true);
            else if (!seen.has(row.conta)) seen.set(row.conta, false);
          }
        }
        const accs = [...seen.entries()]
          .filter(([, hasValue]) => hasValue)
          .map(([conta]) => conta)
          .sort();
        setAccounts(accs);
        setClassificacoes(classif);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleClassify(conta: string, tipo: TipoClassificacao | '') {
    const next = { ...classificacoes };
    if (tipo === '') {
      delete next[conta];
    } else {
      next[conta] = tipo as TipoClassificacao;
    }
    setClassificacoes(next);
    setSaving(true);
    try {
      await saveClassificacoes(next);
    } finally {
      setSaving(false);
    }
  }

  const pending   = accounts.filter(a => !classificacoes[a]);
  const classified = accounts.filter(a =>  classificacoes[a]);

  const displayed = filter === 'pending'    ? pending
                  : filter === 'classified' ? classified
                  : [...pending, ...classified]; // pendentes primeiro

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center space-y-2">
          <Tag className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-slate-500 font-medium">Nenhum dado importado ainda</p>
          <p className="text-slate-400 text-sm">Importe ao menos um mês para classificar as contas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Resumo + filtro */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {pending.length > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-700">
              <AlertCircle className="w-3.5 h-3.5" />
              {pending.length} conta{pending.length !== 1 ? 's' : ''} sem classificação
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs font-semibold text-green-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Todas as contas classificadas
            </div>
          )}
          <span className="text-xs text-slate-400">{classified.length}/{accounts.length} classificadas</span>
          {saving && <span className="text-xs text-slate-400 italic">Salvando...</span>}
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'pending', 'classified'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                filter === f
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : 'Classificadas'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-200">
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Conta / Descrição</th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-72">Tipo de Despesa</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((conta, i) => {
              const isPending = !classificacoes[conta];
              return (
                <tr
                  key={conta}
                  className={`border-b last:border-0 ${
                    isPending
                      ? 'bg-amber-50 border-amber-100'
                      : i % 2 === 0 ? 'bg-white border-slate-100' : 'bg-slate-50/50 border-slate-100'
                  }`}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold shrink-0">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Classificar
                        </span>
                      )}
                      <span className={`font-${isPending ? 'semibold' : 'medium'} ${isPending ? 'text-slate-800' : 'text-slate-600'}`}>
                        {conta}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={classificacoes[conta] ?? ''}
                      onChange={e => handleClassify(conta, e.target.value as TipoClassificacao | '')}
                      className={`w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 ${
                        isPending
                          ? 'border-amber-300 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <option value="">— Selecione —</option>
                      {TIPOS_ORDENADOS.map(tipo => (
                        <option key={tipo} value={tipo}>{TIPO_LABELS[tipo]}</option>
                      ))}
                    </select>
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

export function DespesasAdministracaoDashboard({ onChangeBrand }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('importar');
  const [importarSubTab, setImportarSubTab] = useState<ImportarSubTab>('dados');
  const [admYear, setAdmYear] = useState(CURRENT_YEAR);
  const [admMonth, setAdmMonth] = useState(new Date().getMonth() + 1); // compartilhado entre ADM VW, ADM Audi, Consolidado
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [mesData, setMesData] = useState<DespesasAdmMesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadMes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDespesasAdmMes(selectedYear, selectedMonth);
      setMesData(data);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadMes();
  }, [loadMes]);

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        // fallback para Windows-1252 (encoding comum em software contábil BR)
        text = new TextDecoder('windows-1252').decode(buffer);
      }
      const data = parseTxt(text, file.name);
      await setDespesasAdmMes(selectedYear, selectedMonth, data);
      setMesData(data);
      const nonZero = data.rows.filter(r => !isAllZero(r)).length;
      toast.success(`Dados importados: ${nonZero} registros com valores.`);
    } catch {
      toast.error('Erro ao importar arquivo. Verifique o formato TXT.');
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    setLoading(true);
    try {
      await deleteDespesasAdmMes(selectedYear, selectedMonth);
      setMesData(null);
      toast.success('Dados removidos com sucesso.');
    } catch {
      toast.error('Erro ao remover dados.');
    } finally {
      setLoading(false);
    }
  }

  const displayRows = mesData?.rows.filter(r => !isAllZero(r)) ?? [];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header
        className="px-6 py-3 flex items-center justify-between shadow-md shrink-0"
        style={{ backgroundColor: '#475569' }}
      >
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">Despesas na Administração</h1>
          <p className="text-xs text-slate-300 mt-0.5">Demonstrativo de Resultados</p>
        </div>
        <button
          onClick={onChangeBrand}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-600 transition-colors"
        >
          ← Voltar
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 p-6 flex flex-col gap-4 min-h-0">
        {/* Tab bar */}
        <div className="flex items-center gap-0 border-b border-slate-200">
          {([
            { id: 'importar',   label: 'Importar Dados',             icon: <FileText className="w-3.5 h-3.5" /> },
            { id: 'adm_vw',     label: 'ADM VW',                     icon: null },
            { id: 'adm_audi',   label: 'ADM Audi',                   icon: null },
            { id: 'consolidado',label: 'Consolidado ADM (Audi / VW)', icon: null },
          ] as { id: ActiveTab; label: string; icon: React.ReactNode }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-slate-700 border-slate-600'
                  : 'text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sub-tabs da aba Importar */}
        {activeTab === 'importar' && (
          <div className="flex items-center gap-0 border-b border-slate-100 -mt-2">
            {([
              { id: 'dados',         label: 'Dados do Mês' },
              { id: 'classificacao', label: 'Classificação de Tipo de Despesas' },
            ] as { id: ImportarSubTab; label: string }[]).map(sub => (
              <button
                key={sub.id}
                onClick={() => setImportarSubTab(sub.id)}
                className={`px-4 py-1.5 text-xs font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  importarSubTab === sub.id
                    ? 'text-slate-700 border-slate-500'
                    : 'text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-300'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}

        {/* Seletor + placeholder para as abas ADM */}
        {activeTab !== 'importar' && (
          <div className="flex flex-col gap-4 flex-1">
            <div className="bg-white rounded-xl border border-slate-200 px-4 shadow-sm">
              <YearMonthSelector
                year={admYear}
                month={admMonth}
                onYearChange={setAdmYear}
                onMonthChange={setAdmMonth}
              />
            </div>
            {activeTab === 'adm_vw' && (
              <AdmVwTab year={admYear} month={admMonth} />
            )}
            {activeTab === 'adm_audi' && (
              <AdmAudiTab year={admYear} month={admMonth} />
            )}
            {activeTab === 'consolidado' && (
            <div className="flex-1 flex items-center justify-center py-16">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.653-4.655m5.24-6.029-.79 2.895M5.28 8.28l2.895-.79M15 3h2.25M15 3v2.25M3 15h2.25M3 15v2.25" />
                  </svg>
                </div>
                <p className="text-slate-500 font-medium">Em desenvolvimento</p>
                <p className="text-slate-400 text-sm">O conteúdo desta aba estará disponível em breve.</p>
              </div>
            </div>
            )}
          </div>
        )}
        {activeTab === 'importar' && (
        <>
        {importarSubTab === 'classificacao' && <ClassificacaoTab />}
        {importarSubTab === 'dados' && (
        <>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {mesData && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover dados
              </button>
            )}
            <button
              onClick={handleImportClick}
              disabled={importing || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded transition-colors disabled:opacity-50"
              style={{ backgroundColor: importing ? '#94a3b8' : '#475569' }}
            >
              <Upload className="w-3.5 h-3.5" />
              {importing ? 'Importando...' : 'Importar TXT'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Content area */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500" />
          </div>
        ) : !mesData ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <FileText className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-slate-500 font-medium">
                Nenhum dado importado para {MONTHS[selectedMonth - 1]}/{selectedYear}
              </p>
              <p className="text-slate-400 text-sm">
                Clique em "Importar TXT" para carregar os dados.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
            {/* Import meta info */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 flex items-center justify-between shrink-0">
              <span>
                Arquivo: <strong className="text-slate-700">{mesData.fileName}</strong>
              </span>
              <span>
                Importado em: {new Date(mesData.importedAt).toLocaleString('pt-BR')}
              </span>
            </div>

            {/* Table */}
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 border-b-2 border-slate-200">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600 min-w-[320px]">
                      Conta / Descrição
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                      Saldo Anterior
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                      Val. Débito
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                      Val. Crédito
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                      Saldo Período
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                      Saldo Atual
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row, i) => (
                    <tr
                      key={i}
                      className={
                        row.isMain
                          ? 'bg-slate-50 border-b border-slate-200'
                          : 'bg-white border-b border-slate-100 hover:bg-slate-50/50 transition-colors'
                      }
                    >
                      <td
                        className={`px-4 py-1.5 text-xs ${
                          row.isMain
                            ? 'font-semibold text-slate-800'
                            : 'text-slate-600 pl-10'
                        }`}
                      >
                        {row.conta}
                      </td>
                      <NumCell value={row.saldoAnterior} />
                      <NumCell value={row.valDebito} />
                      <NumCell value={row.valCredito} />
                      <NumCell value={row.saldoPeriodo} />
                      <NumCell value={row.saldoAtual} />
                    </tr>
                  ))}
                </tbody>
                {mesData.totalRow && (
                  <tfoot>
                    <tr className="bg-slate-700 border-t-2 border-slate-600">
                      <td className="px-4 py-2 text-xs font-bold text-white">TOTAL GERAL</td>
                      {(
                        [
                          mesData.totalRow.saldoAnterior,
                          mesData.totalRow.valDebito,
                          mesData.totalRow.valCredito,
                          mesData.totalRow.saldoPeriodo,
                          mesData.totalRow.saldoAtual,
                        ] as number[]
                      ).map((val, vi) => (
                        <td
                          key={vi}
                          className={`px-4 py-2 text-right font-mono text-xs font-bold tabular-nums ${val < 0 ? 'text-red-300' : 'text-white'}`}
                        >
                          {val === 0 ? '—' : val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
        </> // fim do bloco da sub-aba dados
        )}
        </> // fim do bloco da aba importar
        )}
      </div>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-bold text-slate-800 mb-2">
              Remover dados do mês?
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Isso irá remover todos os dados de{' '}
              <strong>
                {MONTHS[selectedMonth - 1]}/{selectedYear}
              </strong>
              . Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
