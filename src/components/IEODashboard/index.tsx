import { useRef, useState, useEffect, useCallback } from 'react';
import { Upload, Trash2, FileText, AlertCircle, Printer, CheckCircle2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { kvKeys } from '@/lib/kvClient';
import {
  getIEOSemestre,
  setIEOSemestre,
  deleteIEOSemestre,
  getAllImportedSemestresData,
  type IEORow,
  type IEOSemestreData,
  type IEOTotalRow,
  type TipoContaClassificacao,
  TIPO_CONTA_LABELS,
  TIPOS_CONTA_ORDENADOS,
  loadClassificacoesConta,
  saveClassificacoesConta,
} from './ieoStorage';
import { ClassificacaoRevendasTab } from './ClassificacaoRevendasTab';
import { RegrasDepartamentosTab } from './RegrasDepartamentosTab';

const SEMESTRES = ['1º Semestre', '2º Semestre'];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function parseNum(s: string): number {
  const cleaned = (s ?? '0').trim().replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function isAllZero(row: IEORow): boolean {
  return (
    row.saldoAnterior === 0 &&
    row.valDebito === 0 &&
    row.valCredito === 0 &&
    row.saldoPeriodo === 0 &&
    row.saldoAtual === 0
  );
}

function parseTxt(text: string, fileName: string): IEOSemestreData {
  // strip BOM if present
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = clean.split('\n');
  const rows: IEORow[] = [];
  let totalRow: IEOTotalRow | null = null;

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
    const isMain = contaRaw === contaRaw.trimStart();

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

function ClassificacaoTipoContaTab() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [classificacoes, setClassificacoes] = useState<Record<string, TipoContaClassificacao>>({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'classified'>('all');

  useEffect(() => {
    Promise.all([getAllImportedSemestresData(), loadClassificacoesConta()])
      .then(([allData, classif]) => {
        // Coleta contas principais com pelo menos um valor não-zero em qualquer semestre
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

  async function handleClassify(conta: string, tipo: TipoContaClassificacao | '') {
    const next = { ...classificacoes };
    if (tipo === '') {
      delete next[conta];
    } else {
      next[conta] = tipo as TipoContaClassificacao;
    }
    setClassificacoes(next);
    setSaving(true);
    try {
      await saveClassificacoesConta(next);
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center space-y-2">
          <Tag className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-slate-500 font-medium">Nenhum dado importado ainda</p>
          <p className="text-slate-400 text-sm">Importe ao menos um semestre para classificar as contas.</p>
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
                  ? 'bg-emerald-600 text-white'
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
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-72">Classificação de Conta</th>
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
                      onChange={e => handleClassify(conta, e.target.value as TipoContaClassificacao | '')}
                      className={`w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
                        isPending
                          ? 'border-amber-300 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <option value="">— Selecione —</option>
                      {TIPOS_CONTA_ORDENADOS.map(tipo => (
                        <option key={tipo} value={tipo}>{TIPO_CONTA_LABELS[tipo]}</option>
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

interface Props {
  onChangeBrand: () => void;
}

type ActiveTab = 'importar' | 'vw' | 'audi';
type ImportarSubTab = 'dados' | 'classificacao' | 'revendas' | 'departamentos';
type DepartamentoSubTab = 'veiculos_novos' | 'venda_direta' | 'veiculos_usados' | 'pecas' | 'oficina' | 'funilaria' | 'administracao' | 'diretoria' | 'consolidado';

// ─── Seletor de Ano e Mês ───────────────────────────────────────────────────

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
                ? 'bg-emerald-600 text-white'
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

export function IEODashboard({ onChangeBrand }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('importar');
  const [importarSubTab, setImportarSubTab] = useState<ImportarSubTab>('dados');
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedSemestre, setSelectedSemestre] = useState(1); // 1 ou 2
  const [semestreData, setSemestreData] = useState<IEOSemestreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [printing, setPrinting] = useState(false);
  
  // States para abas VW e Audi
  const [vwSubTab, setVwSubTab] = useState<DepartamentoSubTab>('veiculos_novos');
  const [audiSubTab, setAudiSubTab] = useState<DepartamentoSubTab>('veiculos_novos');
  const [vwYear, setVwYear] = useState(CURRENT_YEAR);
  const [vwMonth, setVwMonth] = useState(0); // 0 = ano todo
  const [audiYear, setAudiYear] = useState(CURRENT_YEAR);
  const [audiMonth, setAudiMonth] = useState(0);

  async function handlePrint() {
    setPrinting(true);
    try {
      toast.info('Funcionalidade de impressão será implementada em breve.');
    } finally {
      setPrinting(false);
    }
  }

  // Detecta último semestre com dado importado
  useEffect(() => {
    kvKeys('ieo:*').then(keys => {
      const semestreKeys = keys.filter(k => /^ieo:\d{4}:S[12]$/.test(k));
      if (semestreKeys.length === 0) return;
      const parsed = semestreKeys.map(k => {
        const [, y, s] = k.split(':'); // ieo:2026:S1 → ['ieo','2026','S1']
        return { year: Number(y), semestre: Number(s.replace('S', '')) };
      });
      const last = parsed.reduce((acc, cur) =>
        cur.year > acc.year || (cur.year === acc.year && cur.semestre > acc.semestre) ? cur : acc
      );
      setSelectedYear(last.year);
      setSelectedSemestre(last.semestre);
    });
  }, []);

  const loadSemestre = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getIEOSemestre(selectedYear, selectedSemestre);
      setSemestreData(data);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedSemestre]);

  useEffect(() => {
    loadSemestre();
  }, [loadSemestre]);

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
        text = new TextDecoder('windows-1252').decode(buffer);
      }
      const data = parseTxt(text, file.name);
      await setIEOSemestre(selectedYear, selectedSemestre, data);
      setSemestreData(data);
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
      await deleteIEOSemestre(selectedYear, selectedSemestre);
      setSemestreData(null);
      toast.success('Dados removidos com sucesso.');
    } catch {
      toast.error('Erro ao remover dados.');
    } finally {
      setLoading(false);
    }
  }

  const displayRows = semestreData?.rows.filter(r => !isAllZero(r)) ?? [];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header
        className="px-6 py-3 flex items-center justify-between shadow-md shrink-0"
        style={{ backgroundColor: '#10b981' }}
      >
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">Índice de Eficiência Operacional (IEO)</h1>
          <p className="text-xs text-slate-100 mt-0.5">Demonstrativo de Resultados</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white transition-colors disabled:opacity-50 hover:bg-emerald-700"
          >
            <Printer className="w-3.5 h-3.5" />
            {printing ? 'Gerando...' : 'Imprimir PDF'}
          </button>
          <button
            onClick={onChangeBrand}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-slate-200 hover:text-white hover:bg-emerald-700 transition-colors"
          >
            ← Voltar
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 p-6 flex flex-col gap-4 min-h-0">
        {/* Tab bar */}
        <div className="flex items-center gap-0 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('importar')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'importar'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Importar Dados
          </button>
          <button
            onClick={() => setActiveTab('vw')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'vw'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            VW
          </button>
          <button
            onClick={() => setActiveTab('audi')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'audi'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Audi
          </button>
        </div>

        {/* Content */}
        {activeTab === 'importar' && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Sub-tabs */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setImportarSubTab('dados')}
                className={`px-4 py-2 text-xs font-semibold rounded transition-colors ${
                  importarSubTab === 'dados'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Dados do Semestre
              </button>
              <button
                onClick={() => setImportarSubTab('classificacao')}
                className={`px-4 py-2 text-xs font-semibold rounded transition-colors ${
                  importarSubTab === 'classificacao'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Classificação de Tipo de Conta
              </button>
              <button
                onClick={() => setImportarSubTab('revendas')}
                className={`px-4 py-2 text-xs font-semibold rounded transition-colors ${
                  importarSubTab === 'revendas'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Classificação de Revendas
              </button>
              <button
                onClick={() => setImportarSubTab('departamentos')}
                className={`px-4 py-2 text-xs font-semibold rounded transition-colors ${
                  importarSubTab === 'departamentos'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Regra por Departamento
              </button>
            </div>

            {/* Dados do Semestre */}
            {importarSubTab === 'dados' && (
              <div className="flex-1 flex flex-col gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Seletor Ano + Semestre */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">ANO</span>
                    <select
                      value={selectedYear}
                      onChange={e => setSelectedYear(Number(e.target.value))}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded bg-white text-slate-700 font-semibold"
                    >
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>

                    <div className="w-px h-5 bg-slate-200" />

                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">SEMESTRE</span>
                    <div className="flex items-center gap-1">
                      {SEMESTRES.map((label, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedSemestre(idx + 1)}
                          className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                            selectedSemestre === idx + 1
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleImportClick}
                      disabled={importing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {importing ? 'Importando...' : 'Importar TXT'}
                    </button>
                    {semestreData && (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-red-600 border border-red-300 bg-white hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover dados
                      </button>
                    )}
                  </div>
                </div>

                {/* Aviso sobre filtros do arquivo */}
                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                  <svg className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    O arquivo gerado deve considerar Revendas: <strong>1.1 - 1.6 · 1.4 - 1.9</strong>
                    &nbsp;&nbsp;|&nbsp;&nbsp;
                    Divisões: <strong>Centro de Custo - Revenda' - Tipo Item</strong>
                  </span>
                </div>

                {/* Content area */}
                {loading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                  </div>
                ) : !semestreData ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-slate-500 font-medium">Nenhum dado importado para este semestre</p>
                      <p className="text-slate-400 text-sm">Clique em "Importar TXT" para começar.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto">
                    <div className="space-y-2 mb-3">
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold">Arquivo:</span> {semestreData.fileName}
                      </p>
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold">Importado em:</span>{' '}
                        {new Date(semestreData.importedAt).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold">Registros:</span> {displayRows.length} (exibindo apenas com valores)
                      </p>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-100 border-b-2 border-slate-200">
                            <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Conta / Descrição</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 w-32">Saldo Anterior</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 w-32">Val. Débito</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 w-32">Val. Crédito</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 w-32">Saldo Período</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 w-32">Saldo Atual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayRows.map((row, i) => (
                            <tr
                              key={i}
                              className={`border-b last:border-0 ${
                                i % 2 === 0 ? 'bg-white border-slate-100' : 'bg-slate-50/50 border-slate-100'
                              }`}
                            >
                              <td className="px-4 py-1.5">
                                <span className={`${row.isMain ? 'font-semibold text-slate-700' : 'font-normal text-slate-600 pl-4'}`}>
                                  {row.conta}
                                </span>
                              </td>
                              <NumCell value={row.saldoAnterior} />
                              <NumCell value={row.valDebito} />
                              <NumCell value={row.valCredito} />
                              <NumCell value={row.saldoPeriodo} />
                              <NumCell value={row.saldoAtual} />
                            </tr>
                          ))}
                        </tbody>
                        {semestreData.totalRow && (
                          <tfoot>
                            <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                              <td className="px-4 py-2 font-bold text-emerald-800">TOTAL</td>
                              <NumCell value={semestreData.totalRow.saldoAnterior} />
                              <NumCell value={semestreData.totalRow.valDebito} />
                              <NumCell value={semestreData.totalRow.valCredito} />
                              <NumCell value={semestreData.totalRow.saldoPeriodo} />
                              <NumCell value={semestreData.totalRow.saldoAtual} />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Classificação de Tipo de Conta */}
            {importarSubTab === 'classificacao' && (
              <div className="flex-1 flex flex-col gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-0 overflow-auto">
                <ClassificacaoTipoContaTab />
              </div>
            )}

            {/* Classificação de Revendas */}
            {importarSubTab === 'revendas' && (
              <div className="flex-1 flex flex-col gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-0 overflow-auto">
                <ClassificacaoRevendasTab />
              </div>
            )}

            {/* Regra por Departamento */}
            {importarSubTab === 'departamentos' && (
              <div className="flex-1 flex flex-col gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-0 overflow-auto">
                <RegrasDepartamentosTab />
              </div>
            )}
          </div>
        )}

        {/* Tab VW */}
        {activeTab === 'vw' && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Sub-tabs VW */}
            <div className="flex items-center gap-0 border-b border-slate-200 overflow-x-auto">
              {([
                { id: 'veiculos_novos', label: 'Veículos Novos' },
                { id: 'venda_direta', label: 'Venda Direta' },
                { id: 'veiculos_usados', label: 'Veículos Usados' },
                { id: 'pecas', label: 'Peças' },
                { id: 'oficina', label: 'Oficina' },
                { id: 'funilaria', label: 'Funilaria' },
                { id: 'administracao', label: 'Administração' },
                { id: 'diretoria', label: 'Diretoria' },
                { id: 'consolidado', label: 'Consolidado (Total)' },
              ] as { id: DepartamentoSubTab; label: string }[]).map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setVwSubTab(sub.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                    vwSubTab === sub.id
                      ? 'text-slate-700 border-emerald-600'
                      : 'text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Seletor de Ano e Mês */}
            <div className="bg-white rounded-xl border border-slate-200 px-4 shadow-sm">
              <YearMonthSelector
                year={vwYear}
                month={vwMonth}
                onYearChange={setVwYear}
                onMonthChange={setVwMonth}
              />
            </div>

            {/* Conteúdo das sub-abas VW */}
            <div className="flex-1 flex flex-col gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-0 overflow-auto">
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm">Conteúdo de <strong>{[
                  { id: 'veiculos_novos', label: 'Veículos Novos' },
                  { id: 'venda_direta', label: 'Venda Direta' },
                  { id: 'veiculos_usados', label: 'Veículos Usados' },
                  { id: 'pecas', label: 'Peças' },
                  { id: 'oficina', label: 'Oficina' },
                  { id: 'funilaria', label: 'Funilaria' },
                  { id: 'administracao', label: 'Administração' },
                  { id: 'diretoria', label: 'Diretoria' },
                  { id: 'consolidado', label: 'Consolidado (Total)' },
                ].find(s => s.id === vwSubTab)?.label}</strong> - VW</p>
                <p className="text-slate-400 text-xs mt-2">
                  {vwMonth === 0 ? `Ano ${vwYear} (todo)` : `${MONTHS_SHORT[vwMonth - 1]}/${vwYear}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Audi */}
        {activeTab === 'audi' && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Sub-tabs Audi */}
            <div className="flex items-center gap-0 border-b border-slate-200 overflow-x-auto">
              {([
                { id: 'veiculos_novos', label: 'Veículos Novos' },
                { id: 'venda_direta', label: 'Venda Direta' },
                { id: 'veiculos_usados', label: 'Veículos Usados' },
                { id: 'pecas', label: 'Peças' },
                { id: 'oficina', label: 'Oficina' },
                { id: 'funilaria', label: 'Funilaria' },
                { id: 'administracao', label: 'Administração' },
                { id: 'diretoria', label: 'Diretoria' },
                { id: 'consolidado', label: 'Consolidado (Total)' },
              ] as { id: DepartamentoSubTab; label: string }[]).map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setAudiSubTab(sub.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                    audiSubTab === sub.id
                      ? 'text-slate-700 border-emerald-600'
                      : 'text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Seletor de Ano e Mês */}
            <div className="bg-white rounded-xl border border-slate-200 px-4 shadow-sm">
              <YearMonthSelector
                year={audiYear}
                month={audiMonth}
                onYearChange={setAudiYear}
                onMonthChange={setAudiMonth}
              />
            </div>

            {/* Conteúdo das sub-abas Audi */}
            <div className="flex-1 flex flex-col gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-0 overflow-auto">
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm">Conteúdo de <strong>{[
                  { id: 'veiculos_novos', label: 'Veículos Novos' },
                  { id: 'venda_direta', label: 'Venda Direta' },
                  { id: 'veiculos_usados', label: 'Veículos Usados' },
                  { id: 'pecas', label: 'Peças' },
                  { id: 'oficina', label: 'Oficina' },
                  { id: 'funilaria', label: 'Funilaria' },
                  { id: 'administracao', label: 'Administração' },
                  { id: 'diretoria', label: 'Diretoria' },
                  { id: 'consolidado', label: 'Consolidado (Total)' },
                ].find(s => s.id === audiSubTab)?.label}</strong> - Audi</p>
                <p className="text-slate-400 text-xs mt-2">
                  {audiMonth === 0 ? `Ano ${audiYear} (todo)` : `${MONTHS_SHORT[audiMonth - 1]}/${audiYear}`}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Delete Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-red-100">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800">Confirmar remoção</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Tem certeza que deseja remover os dados do <strong>{SEMESTRES[selectedSemestre - 1]}</strong> de <strong>{selectedYear}</strong>?
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Sim, remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
