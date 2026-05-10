import { useState, useEffect, useRef } from 'react';
import { Upload } from 'lucide-react';
import { DespesasTab } from '@/components/FluxoCaixaDashboard/DespesasTab';
import {
  saveAnaliseDespesas,
  loadAnaliseDespesasRaw,
  loadAnaliseDespesasTipos,
  saveAnaliseDespesasTipos,
  loadMultipleMonthsAnaliseDespesas,
  loadAnaliseDespesasIndex,
  type AnaliseBrand,
} from './analiseDespesasStorage';

// ─── Constantes ───────────────────────────────────────────────────────────────

const YEARS = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028];
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── Parser (mesmo formato do FluxoCaixa) ────────────────────────────────────

function parseBalancete(text: string): { accounts: Record<string, any> } {
  const lines = text.split('\n').filter((l) => l.trim());
  const accounts: Record<string, any> = {};

  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, desc, saldoAnt, valDeb, valCred, saldoAtual] = parts;
    if (nivel?.trim() === 'T') continue;
    const parse = (v: string) =>
      parseFloat((v || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
    const id = conta?.trim();
    if (!id) continue;
    accounts[id] = {
      nivel: nivel?.trim(),
      conta: id,
      desc: desc?.trim(),
      saldoAnt: parse(saldoAnt),
      valDeb: parse(valDeb),
      valCred: parse(valCred),
      saldoAtual: parse(saldoAtual),
    };
  }

  return { accounts };
}

// ─── Helpers visuais ──────────────────────────────────────────────────────────

const fmtBRL = (v: number, _abs?: boolean) =>
  'R$ ' +
  Math.abs(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function SectionTitle({
  icon,
  children,
}: {
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
      {icon && <span>{icon}</span>}
      {children}
    </h3>
  );
}

const COLOR_MAP: Record<string, string> = {
  red: 'text-red-600 dark:text-red-400',
  orange: 'text-orange-600 dark:text-orange-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  blue: 'text-blue-600 dark:text-blue-400',
};

function KPI({
  label,
  value,
  sub,
  color = 'blue',
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-lg font-bold font-mono ${COLOR_MAP[color] ?? COLOR_MAP.blue}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface AnaliseDespesasSubPageProps {
  brand: AnaliseBrand;
  onBack: () => void;
}

export function AnaliseDespesasSubPage({ brand, onBack }: AnaliseDespesasSubPageProps) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const [data, setData] = useState<{ accounts: Record<string, any> } | null>(null);
  const [ytdAccountsSums, setYtdAccountsSums] = useState<Record<string, number>>({});
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showTabela, setShowTabela] = useState(false);
  const [despesasView, setDespesasView] = useState<'normal' | 'comparativo'>('normal');

  const fileRef = useRef<HTMLInputElement | null>(null);

  const brandLabel = brand === 'vw' ? 'VW' : 'Audi';
  const brandColor = brand === 'vw' ? '#001e50' : '#bb0a30';

  // ── Storage overrides vinculados à marca ─────────────────────────────────
  const storageOverrides = {
    loadTipos: () => loadAnaliseDespesasTipos(brand),
    saveTipos: (t: Record<string, string>) => saveAnaliseDespesasTipos(brand, t),
    loadMultiple: (year: number, months: number[]) =>
      loadMultipleMonthsAnaliseDespesas(brand, year, months),
    loadIndex: () => loadAnaliseDespesasIndex(brand),
    loadRaw: (year: number, month: number) =>
      loadAnaliseDespesasRaw(brand, year, month) as Promise<{ rawText: string } | null>,
  };

  // ── Computa YTD (Jan → mês anterior) ─────────────────────────────────────
  async function computeYtd(year: number, month: number) {
    if (month <= 1) {
      setYtdAccountsSums({});
      return;
    }
    const months = Array.from({ length: month - 1 }, (_, i) => i + 1);
    const rawMap = await loadMultipleMonthsAnaliseDespesas(brand, year, months);
    const sums: Record<string, number> = {};
    for (const rawText of Object.values(rawMap)) {
      const parsed = parseBalancete(rawText);
      for (const [k, acc] of Object.entries(parsed.accounts)) {
        if (!k.startsWith('5.')) continue;
        sums[k] = (sums[k] ?? 0) + acc.saldoAtual;
      }
    }
    setYtdAccountsSums(sums);
  }

  // ── Carrega dados ao mudar marca/ano/mês ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      setFileName(null);
      setYtdAccountsSums({});
      setShowTabela(false);
      setDespesasView('normal');
      try {
        const raw = await loadAnaliseDespesasRaw(brand, selectedYear, selectedMonth);
        if (cancelled) return;
        if (raw?.rawText) {
          setData(parseBalancete(raw.rawText));
          setFileName(raw.fileName ?? null);
          await computeYtd(selectedYear, selectedMonth);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, selectedYear, selectedMonth]);

  // ── Importação de arquivo ─────────────────────────────────────────────────
  async function processFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const validLines = text.split('\n').filter((l) => l.split(';').length >= 7);
      if (validLines.length === 0) {
        setError(
          'Arquivo inválido. Verifique o formato (campos separados por ponto-e-vírgula).',
        );
        return;
      }

      setSaving(true);
      await saveAnaliseDespesas(brand, text, file.name, selectedYear, selectedMonth);
      setSaving(false);

      const parsed = parseBalancete(text);
      setData(parsed);
      setFileName(file.name);
      setShowTabela(false);
      setDespesasView('normal');
      await computeYtd(selectedYear, selectedMonth);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao processar arquivo.');
      setSaving(false);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header
        className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm"
        style={{ borderLeftWidth: 4, borderLeftColor: brandColor }}
      >
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            Análise Evolutiva de Despesas —{' '}
            <span style={{ color: brandColor }}>{brandLabel}</span>
          </h1>
          {fileName && (
            <p className="text-xs text-slate-500 mt-0.5">📄 {fileName}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Importar Balancete */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading || saving}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {saving ? 'Salvando…' : 'Importar Balancete'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv"
            className="hidden"
            onChange={(e) => processFile(e.target.files?.[0])}
          />

          {/* Seletor de Ano */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="h-8 px-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {/* Seletor de Mês */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="h-8 px-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
            ))}
          </select>

          {/* Voltar */}
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
          >
            ← Voltar
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="max-w-xl mx-auto mt-12 p-6 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">⚠️ {error}</p>
          </div>
        ) : !data ? (
          /* Placeholder de upload quando não há dados */
          <div className="max-w-2xl mx-auto py-20 px-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Nenhum balancete importado
              </h2>
              <p className="text-slate-500">
                Importe o arquivo de balancete para{' '}
                <strong style={{ color: brandColor }}>{brandLabel}</strong> —{' '}
                {MONTH_NAMES[selectedMonth - 1]}/{selectedYear}.
              </p>
            </div>

            <div
              className="border-2 border-dashed border-slate-300 rounded-2xl p-16 flex flex-col items-center gap-4 cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                <Upload className="w-8 h-8 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-700">
                  Clique para selecionar o arquivo
                </p>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  Nível; Conta; Descrição; Saldo Anterior; Déb; Créd; Saldo Atual
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* DespesasTab completo com todos os recursos */
          <div className="p-6 space-y-4">
            <DespesasTab
              data={data}
              fmtBRL={fmtBRL}
              SectionTitle={SectionTitle}
              KPI={KPI}
              showTabela={showTabela}
              setShowTabela={setShowTabela}
              despesasView={despesasView}
              setDespesasView={setDespesasView}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              ytdAccountsSums={ytdAccountsSums}
              storageOverrides={storageOverrides}
            />
          </div>
        )}
      </div>
    </div>
  );
}
