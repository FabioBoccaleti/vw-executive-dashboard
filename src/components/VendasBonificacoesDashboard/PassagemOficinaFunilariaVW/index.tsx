import { useState, useRef, useEffect, useCallback, useMemo, Fragment } from 'react';
import { TableProperties, Upload, BookOpen, Ruler, BarChart2, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { getPassagemMes, setPassagemMes, type PassagemRow } from './passagemStorage';
import { RegraAnoChassiSection } from './RegraAnoChassiSection';

interface Props {
  onBack: () => void;
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

type ColType = 'text' | 'currency';
interface ColDef { key: keyof PassagemRow; label: string; type: ColType; }

const COLUMNS: ColDef[] = [
  { key: 'nroOs',             label: 'Nº OS',             type: 'text' },
  { key: 'nomeDepartamento',  label: 'Departamento',     type: 'text' },
  { key: 'dtaEmissao',        label: 'Dt. Emissão',      type: 'text' },
  { key: 'dtaEncerramento',   label: 'Dt. Encerramento', type: 'text' },
  { key: 'nomeVendedor',      label: 'Vendedor',         type: 'text' },
  { key: 'categoriaOs',       label: 'Categoria OS',     type: 'text' },
  { key: 'chassi',            label: 'Chassi',           type: 'text' },
  { key: 'valTotalOs',        label: 'Total OS',         type: 'currency' },
  { key: 'valTotalPecas',     label: 'Total Peças',      type: 'currency' },
  { key: 'valTotalServicos',  label: 'Total Serviços',   type: 'currency' },
  { key: 'totalDesconto',     label: 'Total Desconto',   type: 'currency' },
  { key: 'valPecaExterno',    label: 'Peça Externo',     type: 'currency' },
  { key: 'valServicoExterno', label: 'Serviço Externo',  type: 'currency' },
  { key: 'valPecaInterno',    label: 'Peça Interno',     type: 'currency' },
  { key: 'valServicoInterno', label: 'Serviço Interno',  type: 'currency' },
  { key: 'valPecaGarantia',   label: 'Peça Garantia',    type: 'currency' },
  { key: 'valServicoGarantia',label: 'Serviço Garantia', type: 'currency' },
  { key: 'valPecaRevisao',    label: 'Peça Revisão',     type: 'currency' },
  { key: 'valServicoRevisao', label: 'Serviço Revisão',  type: 'currency' },
  { key: 'descontoPeca',      label: 'Desconto Peça',    type: 'currency' },
  { key: 'descontoServ',      label: 'Desconto Serviço', type: 'currency' },
];

// Mapeia a coluna do TXT (header) para a chave da linha e se é numérica.
const FIELD_MAP: Record<string, { key: keyof PassagemRow; numeric: boolean }> = {
  NRO_OS:               { key: 'nroOs',              numeric: false },
  NOME_DEPARTAMENTO:    { key: 'nomeDepartamento',   numeric: false },
  DTA_EMISSAO:          { key: 'dtaEmissao',         numeric: false },
  DTA_ENCERRAMENTO:     { key: 'dtaEncerramento',    numeric: false },
  NOME_VENDEDOR:        { key: 'nomeVendedor',       numeric: false },
  CATEGORIA_OS:         { key: 'categoriaOs',        numeric: false },
  CHASSI:               { key: 'chassi',             numeric: false },
  VAL_TOTAL_OS:         { key: 'valTotalOs',         numeric: true  },
  VAL_TOTAL_PECAS:      { key: 'valTotalPecas',      numeric: true  },
  VAL_TOTAL_SERVICOS:   { key: 'valTotalServicos',   numeric: true  },
  TOTAL_DESCONTO:       { key: 'totalDesconto',      numeric: true  },
  VAL_PECA_EXTERNO:     { key: 'valPecaExterno',     numeric: true  },
  VAL_SERVICO_EXTERNO:  { key: 'valServicoExterno',  numeric: true  },
  VAL_PECA_INTERNO:     { key: 'valPecaInterno',     numeric: true  },
  VAL_SERVICO_INTERNO:  { key: 'valServicoInterno',  numeric: true  },
  VAL_PECA_GARANTIA:    { key: 'valPecaGarantia',    numeric: true  },
  VAL_SERVICO_GARANTIA: { key: 'valServicoGarantia', numeric: true  },
  VAL_PECA_REVISAO:     { key: 'valPecaRevisao',     numeric: true  },
  VAL_SERVICO_REVISAO:  { key: 'valServicoRevisao',  numeric: true  },
  DESCONTO_PECA:        { key: 'descontoPeca',       numeric: true  },
  DESCONTO_SERV:        { key: 'descontoServ',       numeric: true  },
};

function parseBRNumber(s: string): number {
  if (!s) return 0;
  let clean = s.trim().replace(/R\$\s*/g, '');
  if (clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function emptyRow(): PassagemRow {
  return {
    nroOs: '', nomeDepartamento: '', dtaEmissao: '', dtaEncerramento: '', nomeVendedor: '',
    categoriaOs: '', chassi: '', valTotalOs: 0, valTotalPecas: 0, valTotalServicos: 0,
    totalDesconto: 0, valPecaExterno: 0, valServicoExterno: 0, valPecaInterno: 0,
    valServicoInterno: 0, valPecaGarantia: 0, valServicoGarantia: 0, valPecaRevisao: 0,
    valServicoRevisao: 0, descontoPeca: 0, descontoServ: 0,
  };
}

function parseTxt(text: string): PassagemRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) return [];
  const header = lines[0].split(';').map(h => h.trim().toUpperCase());
  const idxByName: Record<string, number> = {};
  header.forEach((h, i) => { if (h) idxByName[h] = i; });

  const rows: PassagemRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    const row = emptyRow();
    let hasData = false;
    for (const [colName, { key, numeric }] of Object.entries(FIELD_MAP)) {
      const idx = idxByName[colName];
      if (idx === undefined) continue;
      const raw = (cols[idx] ?? '').trim();
      if (numeric) {
        (row[key] as number) = parseBRNumber(raw);
      } else {
        (row[key] as string) = raw;
      }
      if (raw) hasData = true;
    }
    if (hasData) rows.push(row);
  }
  return rows;
}

function fmtCurrency(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type CadastroSectionId = 'regraAnoChassi';
interface CadastroMenuItem { id: CadastroSectionId; label: string; description: string; icon: React.ReactNode; }
const CADASTRO_MENU: CadastroMenuItem[] = [
  { id: 'regraAnoChassi', label: 'Regra Ano / Chassi', description: 'Regras por ano e chassi', icon: <Ruler className="w-5 h-5" /> },
];

export function PassagemOficinaFunilariaVWDashboard({ onBack }: Props) {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<'passagens' | 'situacoes' | 'cadastro' | 'analise'>('passagens');
  const [cadastroSection, setCadastroSection] = useState<CadastroSectionId>('regraAnoChassi');
  const currentCadastro = CADASTRO_MENU.find(m => m.id === cadastroSection);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [rows, setRows] = useState<PassagemRow[]>([]);
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Arquivo aguardando confirmação de mês/ano antes de importar
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const loadMonth = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      const data = await getPassagemMes(year, month);
      setRows(data?.rows ?? []);
      setFileName(data?.fileName);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMonth(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth, loadMonth]);

  // Grupos de chassi repetido (>1 ocorrência) no mês, ignorando chassi vazio
  const chassiGroups = useMemo(() => {
    const map = new Map<string, PassagemRow[]>();
    for (const r of rows) {
      const c = r.chassi?.trim();
      if (!c) continue;
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(r);
    }
    return Array.from(map.entries())
      .filter(([, rs]) => rs.length > 1)
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function confirmImport() {
    const file = pendingFile;
    setPendingFile(null);
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseTxt(text);
      if (parsed.length === 0) {
        toast.error('Nenhum registro encontrado no arquivo.');
      } else {
        await setPassagemMes(selectedYear, selectedMonth, {
          rows: parsed,
          fileName: file.name,
          timestamp: Date.now(),
        });
        setRows(parsed);
        setFileName(file.name);
        toast.success(`${parsed.length} registro${parsed.length !== 1 ? 's' : ''} importado${parsed.length !== 1 ? 's' : ''} para ${MONTHS[selectedMonth - 1]}/${selectedYear}.`);
      }
    } catch {
      toast.error('Falha ao ler o arquivo TXT.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Passagem Oficina e Funilaria VW</h1>
          <p className="text-xs text-slate-500 mt-0.5">Demonstrativo de Vendas e Bonificações</p>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
        >
          ← Voltar
        </button>
      </header>

      {/* ── Abas ── */}
      <div className="flex border-b border-slate-200 bg-white px-4">
        <button
          onClick={() => setActiveTab('passagens')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'passagens' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <TableProperties className="w-4 h-4" />
          Passagens
        </button>
        <button
          onClick={() => setActiveTab('situacoes')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'situacoes' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          Situações
        </button>
        <button
          onClick={() => setActiveTab('cadastro')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'cadastro' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Cadastro
        </button>
        <button
          onClick={() => setActiveTab('analise')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'analise' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Análise
        </button>
      </div>

      {/* ── Content ── */}
      {activeTab === 'passagens' && (
        <div className="flex-1 flex flex-col p-4 gap-4 min-h-0">
          {/* Seletor de ano e mês + importar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ano</span>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Mês</span>
                {MONTHS.map((m, mi) => {
                  const month = mi + 1;
                  return (
                    <button
                      key={month}
                      onClick={() => setSelectedMonth(month)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                        selectedMonth === month
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {fileName && (
                  <span className="text-xs text-slate-400 max-w-[220px] truncate" title={fileName}>
                    {fileName}
                  </span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Importar TXT
                </button>
              </div>
            </div>
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                  <Upload className="w-8 h-8 text-blue-500" />
                </div>
                <p className="text-lg font-semibold text-slate-700">Nenhum dado importado</p>
                <p className="text-sm text-slate-400">
                  Importe o arquivo TXT de {MONTHS[selectedMonth - 1]}/{selectedYear} para carregar a tabela.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto flex-1"
              style={{ maxHeight: 'calc(100vh - 220px)' }}
            >
              <table className="border-collapse text-sm" style={{ width: 'max-content', minWidth: '100%' }}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-blue-50">
                    {COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className={`px-3 py-2 font-semibold text-blue-900 border-b border-blue-200 whitespace-nowrap ${
                          col.type === 'currency' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-blue-50/50 border-b border-slate-100">
                      {COLUMNS.map(col => (
                        <td
                          key={col.key}
                          className={`px-3 py-1.5 whitespace-nowrap text-slate-700 ${
                            col.type === 'currency' ? 'text-right tabular-nums' : 'text-left'
                          }`}
                        >
                          {col.type === 'currency'
                            ? fmtCurrency(row[col.key] as number)
                            : ((row[col.key] as string) || '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Situações ── */}
      {activeTab === 'situacoes' && (
        <div className="flex-1 flex flex-col p-4 gap-4 min-h-0">
          {/* Seletor de ano e mês (mesmo estado das Passagens) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ano</span>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Mês</span>
                {MONTHS.map((m, mi) => {
                  const month = mi + 1;
                  return (
                    <button
                      key={month}
                      onClick={() => setSelectedMonth(month)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                        selectedMonth === month
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Carregando…</div>
          ) : chassiGroups.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                  <ListChecks className="w-8 h-8 text-blue-500" />
                </div>
                <p className="text-lg font-semibold text-slate-700">Nenhum chassi repetido</p>
                <p className="text-sm text-slate-400">
                  Não há chassis com mais de uma passagem em {MONTHS[selectedMonth - 1]}/{selectedYear}.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto flex-1"
              style={{ maxHeight: 'calc(100vh - 220px)' }}
            >
              <table className="border-collapse text-sm" style={{ width: 'max-content', minWidth: '100%' }}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-blue-50">
                    {COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className={`px-3 py-2 font-semibold text-blue-900 border-b border-blue-200 whitespace-nowrap ${
                          col.type === 'currency' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chassiGroups.map(([chassi, groupRows]) => (
                    <Fragment key={chassi}>
                      <tr className="bg-slate-100">
                        <td colSpan={COLUMNS.length} className="px-3 py-1.5 text-xs font-bold text-slate-600 border-y border-slate-200">
                          Chassi {chassi} — {groupRows.length} passagens
                        </td>
                      </tr>
                      {groupRows.map((row, ri) => (
                        <tr key={`${chassi}-${ri}`} className="hover:bg-blue-50/50 border-b border-slate-100">
                          {COLUMNS.map(col => (
                            <td
                              key={col.key}
                              className={`px-3 py-1.5 whitespace-nowrap text-slate-700 ${
                                col.type === 'currency' ? 'text-right tabular-nums' : 'text-left'
                              }`}
                            >
                              {col.type === 'currency'
                                ? fmtCurrency(row[col.key] as number)
                                : ((row[col.key] as string) || '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Cadastro ── */}
      {activeTab === 'cadastro' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 overflow-y-auto">
            <nav className="p-3 space-y-1">
              {CADASTRO_MENU.map(item => (
                <button
                  key={item.id}
                  onClick={() => setCadastroSection(item.id)}
                  className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-lg transition-all ${
                    cadastroSection === item.id ? 'text-white shadow-sm bg-blue-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className={`mt-0.5 flex-shrink-0 ${cadastroSection === item.id ? 'text-white' : 'text-slate-400'}`}>
                    {item.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{item.label}</p>
                    <p className={`text-xs mt-0.5 ${cadastroSection === item.id ? 'text-white/70' : 'text-slate-400'}`}>
                      {item.description}
                    </p>
                  </div>
                </button>
              ))}
            </nav>
          </aside>

          {/* Content area */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              {currentCadastro && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-slate-400">{currentCadastro.icon}</span>
                    <h2 className="text-lg font-bold text-slate-800">{currentCadastro.label}</h2>
                  </div>
                  <p className="text-sm text-slate-500">{currentCadastro.description}</p>
                </div>
              )}

              {cadastroSection === 'regraAnoChassi' && <RegraAnoChassiSection />}
            </div>
          </main>
        </div>
      )}

      {/* ── Análise ── */}
      {activeTab === 'analise' && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
              <BarChart2 className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-lg font-semibold text-slate-700">Em desenvolvimento</p>
            <p className="text-sm text-slate-400">Este módulo estará disponível em breve.</p>
          </div>
        </div>
      )}

      {/* Dialog de confirmação de mês/ano */}
      <AlertDialog open={pendingFile !== null} onOpenChange={(open) => { if (!open) setPendingFile(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar importação</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div>
                  Importar o arquivo{pendingFile ? <strong> “{pendingFile.name}”</strong> : ''} para{' '}
                  <strong>{MONTHS[selectedMonth - 1]}/{selectedYear}</strong>?
                </div>
                {rows.length > 0 && (
                  <div className="text-amber-600 font-medium">
                    Atenção: já existem {rows.length} registro{rows.length !== 1 ? 's' : ''} neste mês. Eles serão substituídos.
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImport} className="bg-blue-600 hover:bg-blue-700">
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
