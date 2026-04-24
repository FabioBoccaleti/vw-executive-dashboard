import { useCallback, useEffect, useRef, useState } from 'react';
import { Construction, Upload, FileText, X, Loader2, CheckCircle2 } from 'lucide-react';
import {
  getVPecasRelatorio,
  setVPecasRelatorio,
  parsePdfRelatorio,
  isBRLValue,
  type VPecasRelatorioData,
  type VPecasRelMarca,
  type VPecasRelSection,
} from './vpecasRelatoriosStorage';

type Tab       = 'relatorios' | 'resumo';
type Marca     = 'audi' | 'vw';
type SubRelat  = 'pecas' | 'acessorios' | 'oficina' | 'funilaria';

const CURRENT_YEAR   = new Date().getFullYear();
const YEARS          = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);
const MONTHS_SHORT   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ── Formatting helpers ────────────────────────────────────────────────────────
function parseBRL(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}
function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const SUB_RELAT_LABELS: Record<SubRelat, string> = {
  pecas:       'Peças',
  acessorios:  'Acessórios',
  oficina:     'Oficina',
  funilaria:   'Funilaria',
};

interface Props {
  onBack: () => void;
}

// ── Empty/placeholder used only for "Resumo" tab ─────────────────────────────
function EmDesenvolvimento({ label }: { label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center gap-5 max-w-md w-full text-center">
        <div className="p-5 rounded-full bg-orange-50">
          <Construction className="w-12 h-12 text-orange-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">Em desenvolvimento</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            A aba <strong>{label}</strong> está sendo desenvolvida e em breve estará disponível.
          </p>
        </div>
      </div>
    </div>
  );
}

interface MonthSelectorProps {
  year: number;
  month: number;
  onYearChange: (y: number) => void;
  onMonthChange: (m: number) => void;
}

function MonthSelector({ year, month, onYearChange, onMonthChange }: MonthSelectorProps) {
  return (
    <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-3 flex-wrap shrink-0">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ANO</span>
      <select
        value={year}
        onChange={e => onYearChange(Number(e.target.value))}
        className="appearance-none text-sm font-bold text-slate-700 border border-slate-200 rounded-lg pl-3 pr-6 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
      >
        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      <div className="w-px h-5 bg-slate-200" />

      <div className="flex items-center gap-1 flex-wrap">
        {MONTHS_SHORT.map((m, i) => {
          const monthNum = i + 1;
          const isActive = month === monthNum;
          return (
            <button
              key={monthNum}
              onClick={() => onMonthChange(monthNum)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function VPecasCondicaoPagamentoDashboard({ onBack }: Props) {
  const [activeTab,    setActiveTab]    = useState<Tab>('relatorios');
  const [activeMarca,  setActiveMarca]  = useState<Marca>('audi');
  const [activeSubRel, setActiveSubRel] = useState<SubRelat>('pecas');
  const [selYear,      setSelYear]      = useState(CURRENT_YEAR);
  const [selMonth,     setSelMonth]     = useState(new Date().getMonth() + 1);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [tableData,    setTableData]    = useState<VPecasRelatorioData | null>(null);
  const [loadingData,  setLoadingData]  = useState(false);

  // ── Import modal state ──────────────────────────────────────────────────────
  const [importOpen,    setImportOpen]    = useState(false);
  const [importStep,    setImportStep]    = useState<'select' | 'processing' | 'preview'>('select');
  const [importProgress, setImportProgress] = useState('');
  const [importError,   setImportError]   = useState('');
  const [previewData,   setPreviewData]   = useState<{ headers: string[]; rows: string[][]; fileName: string } | null>(null);
  const [saving,        setSaving]        = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver,      setDragOver]      = useState(false);

  // ── Load from KV whenever context changes ──────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'relatorios') return;
    let cancelled = false;
    setTableData(null);
    setLoadingData(true);
    getVPecasRelatorio(
      activeMarca  as VPecasRelMarca,
      activeSubRel as VPecasRelSection,
      selYear,
      selMonth,
    ).then(data => {
      if (!cancelled) {
        setTableData(data);
        setLoadingData(false);
      }
    }).catch(() => { if (!cancelled) setLoadingData(false); });
    return () => { cancelled = true; };
  }, [activeTab, activeMarca, activeSubRel, selYear, selMonth]);

  // ── PDF processing ──────────────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setImportError('Selecione um arquivo PDF.');
      return;
    }
    setImportError('');
    setImportStep('processing');
    setImportProgress('Iniciando leitura...');
    try {
      const result = await parsePdfRelatorio(file, msg => setImportProgress(msg));
      setPreviewData({ ...result, fileName: file.name });
      setImportStep('preview');
    } catch (e) {
      setImportError(`Erro ao processar PDF: ${e instanceof Error ? e.message : String(e)}`);
      setImportStep('select');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleSave = async () => {
    if (!previewData) return;
    setSaving(true);
    await setVPecasRelatorio(
      activeMarca  as VPecasRelMarca,
      activeSubRel as VPecasRelSection,
      selYear,
      selMonth,
      { headers: previewData.headers, rows: previewData.rows, importedAt: new Date().toISOString(), fileName: previewData.fileName },
    );
    setSaving(false);
    setTableData({ headers: previewData.headers, rows: previewData.rows, importedAt: new Date().toISOString(), fileName: previewData.fileName });
    closeModal();
  };

  const openModal = () => {
    setImportStep('select');
    setImportError('');
    setPreviewData(null);
    setImportOpen(true);
  };

  const closeModal = () => {
    setImportOpen(false);
    setImportStep('select');
    setImportError('');
    setPreviewData(null);
  };

  const marcaLabel  = activeMarca === 'audi' ? 'Audi' : 'VW';
  const monthLabel  = MONTHS_SHORT[selMonth - 1];
  const sectionLabel = SUB_RELAT_LABELS[activeSubRel];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-6 shadow-sm shrink-0">
        <div className="flex items-center justify-between py-3">
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-tight">
              Vendas Peças, Oficina e Funilaria por Condição de Pagamento
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Demonstrativo de Vendas e Bonificações</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-end gap-0">
              {(['relatorios', 'resumo'] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab === 'relatorios' ? 'Relatórios' : 'Resumo por Condição de Pagamento'}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-slate-200" />
            <button
              onClick={onBack}
              className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
            >
              ← Voltar
            </button>
          </div>
        </div>
      </header>

      {/* ── ABA RELATÓRIOS ─────────────────────────────────────────────────── */}
      {activeTab === 'relatorios' && (
        <>
          {/* Nível 2: Audi / VW */}
          <div className="bg-white border-b border-slate-200 px-6 flex items-end gap-0 shrink-0">
            {(['audi', 'vw'] as Marca[]).map(marca => (
              <button
                key={marca}
                onClick={() => setActiveMarca(marca)}
                className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                  activeMarca === marca
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {marca === 'audi' ? 'Audi' : 'VW'}
              </button>
            ))}
          </div>

          {/* Nível 3: Peças / Acessórios / Oficina / Funilaria */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 flex items-end gap-0 shrink-0">
            {(Object.keys(SUB_RELAT_LABELS) as SubRelat[]).map(sub => (
              <button
                key={sub}
                onClick={() => setActiveSubRel(sub)}
                className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeSubRel === sub
                    ? 'border-orange-400 text-orange-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {SUB_RELAT_LABELS[sub]}
              </button>
            ))}
          </div>

          {/* Seletor de mês */}
          <MonthSelector
            year={selYear}
            month={selMonth}
            onYearChange={setSelYear}
            onMonthChange={setSelMonth}
          />

          {/* ── Conteúdo principal ─────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {loadingData ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
              </div>
            ) : tableData ? (
              /* ── Tabela com dados importados ─────────────────────────────── */
              (() => {
                // Detect which columns are numeric (BRL values) for formatting + totals
                const valueCols = tableData.headers.map((_, ci) =>
                  tableData.rows.some(row => isBRLValue(row[ci] ?? ''))
                );
                const colTotals = tableData.headers.map((_, ci) =>
                  valueCols[ci]
                    ? tableData.rows.reduce((sum, row) => sum + parseBRL(row[ci] ?? '0'), 0)
                    : null
                );

                return (
                  <div className="flex-1 flex flex-col min-h-0 p-4 gap-3">
                    {/* Barra de ação */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span>{tableData.fileName}</span>
                        <span className="text-slate-300">·</span>
                        <span>Importado em {new Date(tableData.importedAt).toLocaleString('pt-BR')}</span>
                        <span className="text-slate-300">·</span>
                        <span>{tableData.rows.length} linhas</span>
                      </div>
                      <button
                        onClick={openModal}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Substituir PDF
                      </button>
                    </div>

                    {/* Tabela */}
                    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto">
                      <table className="text-xs w-full border-collapse">
                        <thead className="sticky top-0 bg-slate-50 z-10">
                          <tr>
                            {tableData.headers.map((h, i) => (
                              <th
                                key={i}
                                className={`px-3 py-2 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap ${valueCols[i] ? 'text-right' : 'text-left'}`}
                              >
                                {h || `Col ${i + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.rows.map((row, ri) => (
                            <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              {row.map((cell, ci) => (
                                <td
                                  key={ci}
                                  className={`px-3 py-1.5 border-b border-slate-100 whitespace-nowrap ${valueCols[ci] ? 'text-right tabular-nums text-slate-700' : 'text-slate-700 max-w-[320px] truncate'}`}
                                  title={cell}
                                >
                                  {valueCols[ci] ? formatBRL(parseBRL(cell)) : cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                        {/* ── Rodapé com totais ── */}
                        <tfoot className="sticky bottom-0 bg-slate-100 z-10">
                          <tr className="border-t-2 border-slate-300">
                            {tableData.headers.map((_, ci) => {
                              const total = colTotals[ci];
                              if (ci === 0 && !valueCols[ci]) {
                                return (
                                  <td key={ci} className="px-3 py-2 font-bold text-slate-700 text-xs whitespace-nowrap">
                                    Total Geral
                                  </td>
                                );
                              }
                              return (
                                <td
                                  key={ci}
                                  className="px-3 py-2 font-bold text-slate-700 text-xs tabular-nums text-right whitespace-nowrap"
                                >
                                  {total !== null ? formatBRL(total) : ''}
                                </td>
                              );
                            })}
                          </tr>
                        </tfoot>
                      </table>
                      {tableData.rows.length === 0 && (
                        <div className="flex items-center justify-center p-12 text-sm text-slate-400">
                          Nenhuma linha encontrada no arquivo.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* ── Estado vazio: sem dados ─────────────────────────────────── */
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center gap-5 max-w-md w-full text-center">
                  <div className="p-5 rounded-full bg-slate-50">
                    <FileText className="w-12 h-12 text-slate-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-700 mb-1">
                      {marcaLabel} › {sectionLabel}
                    </h2>
                    <p className="text-sm text-slate-500 mb-1">
                      {monthLabel}/{selYear}
                    </p>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Nenhum dado importado para este período.
                    </p>
                  </div>
                  <button
                    onClick={openModal}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Importar PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ABA RESUMO ─────────────────────────────────────────────────────── */}
      {activeTab === 'resumo' && (
        <EmDesenvolvimento label="Resumo por Condição de Pagamento" />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL DE IMPORTAÇÃO
      ══════════════════════════════════════════════════════════════════════ */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            {/* Cabeçalho do modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Importar PDF — {marcaLabel} › {sectionLabel}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Período: {monthLabel}/{selYear}
                </p>
              </div>
              <button
                onClick={closeModal}
                disabled={saving}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do modal */}
            <div className="flex-1 overflow-auto p-6">

              {/* STEP: selecionar arquivo */}
              {importStep === 'select' && (
                <div className="flex flex-col gap-4">
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                      dragOver
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                    }`}
                  >
                    <Upload className="w-10 h-10 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">
                      Clique ou arraste um arquivo PDF aqui
                    </p>
                    <p className="text-xs text-slate-400">
                      O arquivo deve conter a tabela de {sectionLabel} — {marcaLabel} referente a {monthLabel}/{selYear}
                    </p>
                  </div>

                  {importError && (
                    <p className="text-xs text-red-600 text-center">{importError}</p>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              )}

              {/* STEP: processando */}
              {importStep === 'processing' && (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                  <p className="text-sm font-medium text-slate-600">{importProgress}</p>
                  <p className="text-xs text-slate-400">Aguarde — extraindo texto do PDF...</p>
                </div>
              )}

              {/* STEP: preview */}
              {importStep === 'preview' && previewData && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <span>
                      <strong>{previewData.headers.length}</strong> colunas e{' '}
                      <strong>{previewData.rows.length}</strong> linhas encontradas em{' '}
                      <span className="font-medium">{previewData.fileName}</span>
                    </span>
                  </div>

                  {/* Preview table */}
                  <div className="overflow-auto max-h-64 rounded-xl border border-slate-200">
                    <table className="text-xs w-full border-collapse">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr>
                          {previewData.headers.map((h, i) => (
                            <th
                              key={i}
                              className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap"
                            >
                              {h || `Col ${i + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.rows.slice(0, 50).map((row, ri) => (
                          <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            {row.map((cell, ci) => (
                              <td
                                key={ci}
                                className="px-3 py-1.5 text-slate-700 border-b border-slate-100 whitespace-nowrap max-w-[200px] truncate"
                                title={cell}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewData.rows.length > 50 && (
                      <p className="text-center text-xs text-slate-400 py-2">
                        … e mais {previewData.rows.length - 50} linha(s) não exibidas no preview
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Verifique se os dados estão corretos antes de salvar. Os dados anteriores deste período serão substituídos.
                  </p>
                </div>
              )}
            </div>

            {/* Rodapé do modal */}
            {importStep === 'preview' && (
              <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 shrink-0">
                <button
                  onClick={() => setImportStep('select')}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  ← Voltar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition-colors"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Salvando...' : 'Confirmar e Salvar'}
                </button>
              </div>
            )}

            {importStep === 'select' && (
              <div className="flex justify-end px-6 py-4 border-t border-slate-200 shrink-0">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
