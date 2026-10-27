import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Upload, Trash2, AlertCircle, ShieldCheck, Plus, History, Banknote, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteControleVeiculos,
  getControleVeiculos,
  setControleVeiculos,
  extractVehicleTable,
  isSitHeader,
  buildRowRecord,
  rowIdentity,
  type ControleVeiculosBrand,
  type ControleVeiculosData,
  type VehicleTable,
} from './controleVeiculosStorage';
import {
  getRegras,
  EMPTY_REGRAS,
  type ControleVeiculosRegras,
} from './controleVeiculosRegrasStorage';
import {
  addGarantia,
  listGarantia,
  removeGarantia,
  addHistorico,
  listHistorico,
  removeHistorico,
  GARANTIA_BANCO_LABEL,
  type GarantiaBanco,
  type VeiculoGarantiaEntry,
  type VeiculoHistoricoEntry,
} from './veiculosGarantiaStorage';
import { fmtBRL, parseNum, formatDateBR } from './estoqueUsadosStorage';

function todayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** Extrai um ano (4 dígitos) de uma célula como 2013, "2.013", "2013" etc. */
function parseYear(value: unknown): number | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  const n = parseInt(digits.slice(0, 4), 10);
  return Number.isFinite(n) ? n : null;
}

/** Soma dias a uma data ISO 'YYYY-MM-DD' e retorna outra data ISO. */
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

type SubTab = 'importar' | 'disponiveis' | 'garantia';

const SUB_TABS: { value: SubTab; label: string }[] = [
  { value: 'importar', label: 'Importar Arquivo' },
  { value: 'disponiveis', label: 'Veículos Disponíveis' },
  { value: 'garantia', label: 'Veículos em Garantia' },
];

const BRAND_LABEL: Record<ControleVeiculosBrand, string> = { vw: 'VW', audi: 'Audi' };

function formatCell(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString('pt-BR');
  if (typeof value === 'number') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(value);
  return String(value);
}

function parseWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
  brand: ControleVeiculosBrand,
): ControleVeiculosData {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheets = workbook.SheetNames.map(name => ({
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      defval: '',
      raw: true,
    }) as unknown[][],
  }));
  if (sheets.length === 0) {
    throw new Error('O arquivo não possui abas legíveis.');
  }
  return { brand, fileName, importedAt: new Date().toISOString(), sheets };
}

// ─── Painel de importação por marca ───────────────────────────────────────────

function ImportarBrandPanel({ brand }: { brand: ControleVeiculosBrand }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<ControleVeiculosData | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getControleVeiculos(brand)
      .then(loaded => {
        if (cancelled) return;
        setData(loaded);
        setActiveSheet(0);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brand]);

  async function importFile(file: File) {
    setLoading(true);
    try {
      const parsed = parseWorkbook(await file.arrayBuffer(), file.name, brand);
      await setControleVeiculos(parsed);
      setData(parsed);
      setActiveSheet(0);
      toast.success(`Arquivo importado para ${BRAND_LABEL[brand]}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ler o arquivo Excel.');
    } finally {
      setLoading(false);
      setPendingFile(null);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (data) {
      setPendingFile(file);
      setConfirmReplace(true);
      return;
    }
    await importFile(file);
  }

  async function handleDelete() {
    setConfirmDelete(false);
    setLoading(true);
    try {
      await deleteControleVeiculos(brand);
      setData(null);
      toast.success(`Dados de ${BRAND_LABEL[brand]} removidos.`);
    } finally {
      setLoading(false);
    }
  }

  const sheets = useMemo(() => data?.sheets ?? [], [data]);
  const selectedSheet = sheets[activeSheet];

  return (
    <div className="space-y-5">
      {/* Área de importação */}
      <div className="border border-dashed border-sky-300 bg-sky-50 rounded-lg p-8 text-center">
        <FileSpreadsheet className="w-10 h-10 text-sky-600 mx-auto mb-3" />
        <h2 className="font-bold text-slate-800">Importar arquivo Excel — {BRAND_LABEL[brand]}</h2>
        <p className="text-sm text-slate-500 mt-1">
          Selecione o arquivo Excel. Todas as abas serão lidas.
        </p>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-sky-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />{loading ? 'Processando...' : 'Selecionar Excel'}
          </button>
          {data && (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 border border-red-300 text-red-600 rounded px-4 py-2 text-sm hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />Remover dados
            </button>
          )}
        </div>
        {data && (
          <p className="text-xs text-slate-500 mt-4">
            Arquivo atual: <strong>{data.fileName}</strong>, importado em {new Date(data.importedAt).toLocaleString('pt-BR')}.
          </p>
        )}
      </div>

      {/* Pré-visualização dos dados importados */}
      <div>
        {!data ? (
          <div className="py-16 text-center text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            Nenhum dado importado para {BRAND_LABEL[brand]}.
          </div>
        ) : (
          <>
            <div className="flex gap-1 overflow-x-auto border-b border-slate-200 mb-4">
              {sheets.map((sheet, index) => (
                <button
                  key={`${sheet.name}-${index}`}
                  onClick={() => setActiveSheet(index)}
                  className={`whitespace-nowrap px-3 py-2 text-xs font-semibold border-b-2 ${
                    activeSheet === index ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500'
                  }`}
                >
                  {sheet.name}
                </button>
              ))}
            </div>
            <div className="overflow-auto max-h-[calc(100vh-430px)] border border-slate-200">
              <table className="min-w-max text-xs border-collapse">
                <tbody>
                  {(selectedSheet?.rows ?? []).map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex === 0 ? 'bg-sky-50 font-semibold' : 'odd:bg-white even:bg-slate-50'}>
                      {row.map((cell, columnIndex) => (
                        <td key={columnIndex} className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">
                          {formatCell(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {confirmReplace && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
            <h2 className="font-bold text-slate-800">Substituir dados?</h2>
            <p className="text-sm text-slate-600 mt-2">
              Já existem dados importados para {BRAND_LABEL[brand]}. A nova importação substituirá o arquivo anterior.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setConfirmReplace(false); setPendingFile(null); }} className="px-3 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => { setConfirmReplace(false); if (pendingFile) void importFile(pendingFile); }} className="px-3 py-2 text-sm bg-sky-600 text-white rounded">Substituir</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
            <h2 className="font-bold text-slate-800">Remover dados?</h2>
            <p className="text-sm text-slate-600 mt-2">Os dados importados de {BRAND_LABEL[brand]} serão excluídos.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => void handleDelete()} className="px-3 py-2 text-sm bg-red-600 text-white rounded">Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Painel: Veículos Disponíveis por marca ───────────────────────────────────

interface IncluirTarget {
  banco: GarantiaBanco;
  id: string;
  record: Record<string, string>;
  modelo: string;
}

function DisponiveisBrandPanel({ brand }: { brand: ControleVeiculosBrand }) {
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState<VehicleTable | null>(null);
  const [regras, setRegras] = useState<ControleVeiculosRegras>(EMPTY_REGRAS);
  // Mapa id da linha -> banco em que já foi incluído.
  const [incluidos, setIncluidos] = useState<Record<string, GarantiaBanco>>({});

  const [target, setTarget] = useState<IncluirTarget | null>(null);
  const [valorStr, setValorStr] = useState('');
  const [dataInclusao, setDataInclusao] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  async function refreshIncluidos() {
    const [itau, volks] = await Promise.all([listGarantia('itau'), listGarantia('volks')]);
    const map: Record<string, GarantiaBanco> = {};
    itau.forEach(e => { map[e.id] = 'itau'; });
    volks.forEach(e => { map[e.id] = 'volks'; });
    setIncluidos(map);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [data, loadedRegras, itau, volks] = await Promise.all([
        getControleVeiculos(brand),
        getRegras(),
        listGarantia('itau'),
        listGarantia('volks'),
      ]);
      if (cancelled) return;
      setTable(extractVehicleTable(data));
      setRegras(loadedRegras);
      const map: Record<string, GarantiaBanco> = {};
      itau.forEach(e => { map[e.id] = 'itau'; });
      volks.forEach(e => { map[e.id] = 'volks'; });
      setIncluidos(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [brand]);

  // Índices das colunas a exibir: "Sit" (sempre) + colunas das regras, na ordem do arquivo.
  const columnIndices = useMemo(() => {
    if (!table) return [];
    const selected = new Set(regras.colunas);
    const indices: number[] = [];
    table.headers.forEach((header, index) => {
      if (index === table.sitIndex || selected.has(header)) indices.push(index);
    });
    return indices;
  }, [table, regras]);

  const filteredRows = useMemo(() => {
    if (!table || regras.situacoes.length === 0) return [];
    const wanted = new Set(regras.situacoes.map(s => s.trim().toLowerCase()));
    return table.rows.filter(row => {
      const sit = String(row[table.sitIndex] ?? '').trim().toLowerCase();
      return wanted.has(sit);
    });
  }, [table, regras]);

  function openIncluir(banco: GarantiaBanco, row: unknown[]) {
    if (!table) return;
    const record = buildRowRecord(table.headers, row);
    const id = rowIdentity(record);
    const modeloKey = table.headers.find(h => h.toLowerCase().startsWith('modelo')) ?? '';
    const modelo = modeloKey ? record[modeloKey] : '';
    setTarget({ banco, id, record, modelo });
    setValorStr('');
    setDataInclusao(todayISO());
  }

  // Regra de ano por banco: habilita o botão apenas se o veículo estiver dentro da regra.
  function bankEnabled(banco: GarantiaBanco, row: unknown[]): boolean {
    if (!table) return false;
    const ano = banco === 'itau' ? regras.anoItau : regras.anoVolks;
    if (ano == null) return true; // sem ano configurado → sem restrição
    const base = banco === 'itau' ? regras.baseAnoItau : regras.baseAnoVolks;
    const colIndex = table.headers.findIndex(h => h.toLowerCase().replace(/\.+$/, '') === base);
    if (colIndex < 0) return false; // coluna base ausente → desabilitado
    const year = parseYear(row[colIndex]);
    if (year == null) return false; // ano inválido → desabilitado
    return year >= ano;
  }

  async function confirmIncluir() {
    if (!target) return;
    setSaving(true);
    try {
      const entry: VeiculoGarantiaEntry = {
        id: target.id,
        brand,
        record: target.record,
        valorGarantia: parseNum(valorStr),
        dataInclusao,
        diasVencimento: target.banco === 'itau' ? regras.diasVencimentoItau : regras.diasVencimentoVolks,
        includedAt: new Date().toISOString(),
      };
      const ok = await addGarantia(target.banco, entry);
      if (ok) {
        await refreshIncluidos();
        toast.success(`Veículo incluído em ${GARANTIA_BANCO_LABEL[target.banco]}.`);
        setTarget(null);
      } else {
        toast.error('Erro ao incluir o veículo.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-400 py-20">
        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Carregando...</span>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="py-16 text-center text-slate-500">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
        Nenhum arquivo importado para {BRAND_LABEL[brand]}. Importe em “Importar Arquivo”.
      </div>
    );
  }

  if (regras.situacoes.length === 0) {
    return (
      <div className="py-16 text-center text-slate-500">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
        Nenhuma situação (Sit) cadastrada nas Regras. Configure em “Regras” para listar os veículos.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        {filteredRows.length} veículo(s) · situações: {regras.situacoes.join(', ')}
      </p>
      <div className="overflow-auto max-h-[calc(100vh-430px)] border border-slate-200">
        <table className="min-w-max text-xs border-collapse">
          <thead>
            <tr className="bg-sky-50 font-semibold">
              {columnIndices.map(index => (
                <th key={index} className="border border-slate-200 px-3 py-1.5 text-left whitespace-nowrap">
                  {table.headers[index]}
                </th>
              ))}
              <th className="border border-slate-200 px-3 py-1.5 text-left whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={columnIndices.length + 1} className="border border-slate-200 px-3 py-6 text-center text-slate-400">
                  Nenhum veículo corresponde às situações cadastradas.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, rowIndex) => {
                const id = rowIdentity(buildRowRecord(table.headers, row));
                const incluidoEm = incluidos[id];
                return (
                  <tr key={rowIndex} className="odd:bg-white even:bg-slate-50">
                    {columnIndices.map(index => (
                      <td key={index} className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">
                        {formatCell(row[index])}
                      </td>
                    ))}
                    <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">
                      {incluidoEm ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Já incluído ({GARANTIA_BANCO_LABEL[incluidoEm]})
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {(() => {
                            const enItau = bankEnabled('itau', row);
                            const enVolks = bankEnabled('volks', row);
                            return (
                              <>
                                <button
                                  onClick={() => openIncluir('itau', row)}
                                  disabled={!enItau}
                                  title={!enItau ? 'Fora da regra de ano (Banco Itau)' : undefined}
                                  className="inline-flex items-center gap-1 border border-sky-300 text-sky-700 rounded px-2.5 py-1 font-medium hover:bg-sky-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                >
                                  <Plus className="w-3.5 h-3.5" />Incluir Banco Itau
                                </button>
                                <button
                                  onClick={() => openIncluir('volks', row)}
                                  disabled={!enVolks}
                                  title={!enVolks ? 'Fora da regra de ano (Banco Volks)' : undefined}
                                  className="inline-flex items-center gap-1 border border-sky-300 text-sky-700 rounded px-2.5 py-1 font-medium hover:bg-sky-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                >
                                  <Plus className="w-3.5 h-3.5" />Incluir Banco Volks
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: preencher valor da garantia e data de inclusão */}
      {target && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="font-bold text-slate-800">Incluir em {GARANTIA_BANCO_LABEL[target.banco]}</h2>
            {target.modelo && <p className="text-sm text-slate-500 mt-1">{target.modelo}</p>}

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Valor da Garantia</label>
                <div className="flex items-center gap-2 border border-slate-300 rounded px-3 py-2">
                  <span className="text-xs text-slate-400">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={valorStr}
                    onChange={e => setValorStr(e.target.value)}
                    placeholder="0,00"
                    className="flex-1 text-sm focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Data de inclusão</label>
                <input
                  type="date"
                  value={dataInclusao}
                  onChange={e => setDataInclusao(e.target.value)}
                  className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setTarget(null)} className="px-3 py-2 text-sm text-slate-600">Cancelar</button>
              <button
                onClick={() => void confirmIncluir()}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-50"
              >
                {saving ? 'Incluindo...' : 'Incluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Painel: Veículos em Garantia por banco ───────────────────────────────────

const GARANTIA_BANCOS: { value: GarantiaBanco; label: string }[] = [
  { value: 'itau', label: GARANTIA_BANCO_LABEL.itau },
  { value: 'volks', label: GARANTIA_BANCO_LABEL.volks },
];

function GarantiaBancoPanel({ banco }: { banco: GarantiaBanco }) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<VeiculoGarantiaEntry[]>([]);
  const [regras, setRegras] = useState<ControleVeiculosRegras>(EMPTY_REGRAS);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmPayId, setConfirmPayId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [list, loadedRegras] = await Promise.all([listGarantia(banco), getRegras()]);
    setEntries(list);
    setRegras(loadedRegras);
    setLoading(false);
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [banco]);

  async function handleRemove(id: string) {
    setConfirmRemoveId(null);
    const ok = await removeGarantia(banco, id);
    if (ok) {
      toast.success('Veículo removido da garantia.');
      void load();
    } else {
      toast.error('Erro ao remover o veículo.');
    }
  }

  async function handlePay(id: string) {
    setConfirmPayId(null);
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const historicoEntry: VeiculoHistoricoEntry = { ...entry, dataPagamento: todayISO() };
    const okAdd = await addHistorico(banco, historicoEntry);
    const okRemove = okAdd && await removeGarantia(banco, id);
    if (okAdd && okRemove) {
      toast.success('Veículo pago e movido para o Histórico de Movimentação.');
      void load();
    } else {
      toast.error('Erro ao registrar o pagamento.');
    }
  }

  // Colunas das regras (Sit sempre + colunas selecionadas), na ordem da linha.
  const ruleCols = useMemo(() => {
    if (entries.length === 0) return [];
    const keys = Object.keys(entries[0].record);
    const sitKey = keys.find(isSitHeader);
    const selected = new Set(regras.colunas);
    return keys.filter(key => key === sitKey || selected.has(key));
  }, [entries, regras]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-400 py-20">
        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Carregando...</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-16 text-center text-slate-500">
        <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
        Nenhum veículo incluído em {GARANTIA_BANCO_LABEL[banco]}.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{entries.length} veículo(s) em garantia.</p>
      <div className="overflow-auto max-h-[calc(100vh-430px)] border border-slate-200">
        <table className="min-w-max text-xs border-collapse">
          <thead>
            <tr className="bg-sky-50 font-semibold">
              {ruleCols.map(col => (
                <th key={col} className="border border-slate-200 px-3 py-1.5 text-left whitespace-nowrap">{col}</th>
              ))}
              <th className="border border-slate-200 px-3 py-1.5 text-left whitespace-nowrap">Marca</th>
              <th className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">Valor da Garantia</th>
              <th className="border border-slate-200 px-3 py-1.5 text-left whitespace-nowrap">Data de inclusão</th>
              <th className="border border-slate-200 px-3 py-1.5 text-left whitespace-nowrap">Data de vencimento</th>
              <th className="border border-slate-200 px-3 py-1.5 text-left whitespace-nowrap">Status</th>
              <th className="border border-slate-200 px-3 py-1.5 text-left whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => {
              const dias = entry.diasVencimento ?? null;
              const vencimentoISO = dias != null ? addDaysISO(entry.dataInclusao, dias) : null;
              const vencido = vencimentoISO != null && todayISO() > vencimentoISO;
              return (
                <tr key={entry.id} className={vencido ? 'bg-yellow-100' : 'odd:bg-white even:bg-slate-50'}>
                  {ruleCols.map(col => (
                    <td key={col} className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">{entry.record[col] ?? ''}</td>
                  ))}
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">{BRAND_LABEL[entry.brand]}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">R$ {fmtBRL(entry.valorGarantia)}</td>
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">{formatDateBR(entry.dataInclusao)}</td>
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">{vencimentoISO ? formatDateBR(vencimentoISO) : '—'}</td>
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">
                    {vencimentoISO == null ? (
                      <span className="text-slate-400">—</span>
                    ) : vencido ? (
                      <span className="inline-flex items-center rounded-full bg-amber-200 text-amber-800 px-2 py-0.5 font-semibold">Vencido</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 font-semibold">A vencer</span>
                    )}
                  </td>
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setConfirmPayId(entry.id)}
                        className="inline-flex items-center gap-1 border border-emerald-300 text-emerald-700 rounded px-2.5 py-1 font-medium hover:bg-emerald-50"
                      >
                        <Banknote className="w-3.5 h-3.5" />Pagar
                      </button>
                      <button
                        onClick={() => setConfirmRemoveId(entry.id)}
                        className="inline-flex items-center gap-1 border border-red-300 text-red-600 rounded px-2.5 py-1 font-medium hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />Remover
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmRemoveId && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
            <h2 className="font-bold text-slate-800">Remover da garantia?</h2>
            <p className="text-sm text-slate-600 mt-2">O veículo será removido de {GARANTIA_BANCO_LABEL[banco]}.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmRemoveId(null)} className="px-3 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => void handleRemove(confirmRemoveId)} className="px-3 py-2 text-sm bg-red-600 text-white rounded">Remover</button>
            </div>
          </div>
        </div>
      )}

      {confirmPayId && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
            <h2 className="font-bold text-slate-800">Registrar pagamento?</h2>
            <p className="text-sm text-slate-600 mt-2">
              O veículo será pago com a data de hoje ({formatDateBR(todayISO())}) e movido para o Histórico de Movimentação de {GARANTIA_BANCO_LABEL[banco]}.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmPayId(null)} className="px-3 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => void handlePay(confirmPayId)} className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700">Pagar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoricoBancoPanel({ banco }: { banco: GarantiaBanco }) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<VeiculoHistoricoEntry[]>([]);
  const [regras, setRegras] = useState<ControleVeiculosRegras>(EMPTY_REGRAS);
  const [confirmEstornoId, setConfirmEstornoId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [list, loadedRegras] = await Promise.all([listHistorico(banco), getRegras()]);
    setEntries(list);
    setRegras(loadedRegras);
    setLoading(false);
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [banco]);

  async function handleEstorno(id: string) {
    setConfirmEstornoId(null);
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const { dataPagamento: _dataPagamento, ...garantiaEntry } = entry;
    const okAdd = await addGarantia(banco, garantiaEntry);
    const okRemove = okAdd && await removeHistorico(banco, id);
    if (okAdd && okRemove) {
      toast.success('Pagamento estornado. Veículo devolvido à garantia.');
      void load();
    } else {
      toast.error('Erro ao estornar o pagamento.');
    }
  }

  const ruleCols = useMemo(() => {
    if (entries.length === 0) return [];
    const keys = Object.keys(entries[0].record);
    const sitKey = keys.find(isSitHeader);
    const selected = new Set(regras.colunas);
    return keys.filter(key => key === sitKey || selected.has(key));
  }, [entries, regras]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-400 py-20">
        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Carregando...</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-16 text-center text-slate-500">
        <History className="w-10 h-10 mx-auto mb-2 text-slate-300" />
        Nenhuma movimentação registrada em {GARANTIA_BANCO_LABEL[banco]}.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{entries.length} veículo(s) pago(s).</p>
      <div className="overflow-auto max-h-[calc(100vh-430px)] border border-slate-200">
        <table className="min-w-max text-xs border-collapse">
          <thead>
            <tr className="bg-sky-50 font-semibold">
              {ruleCols.map(col => (
                <th key={col} className="border border-slate-200 px-3 py-1.5 text-left whitespace-nowrap">{col}</th>
              ))}
              <th className="border border-slate-200 px-3 py-1.5 text-left whitespace-nowrap">Marca</th>
              <th className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">Valor da Garantia</th>
              <th className="border border-slate-200 px-3 py-1.5 text-left whitespace-nowrap">Data de inclusão</th>
              <th className="border border-slate-200 px-3 py-1.5 text-left whitespace-nowrap">Data de vencimento</th>
              <th className="border border-slate-200 px-3 py-1.5 text-left whitespace-nowrap">Data de pagamento</th>
              <th className="border border-slate-200 px-3 py-1.5 text-left whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => {
              const dias = entry.diasVencimento ?? null;
              const vencimentoISO = dias != null ? addDaysISO(entry.dataInclusao, dias) : null;
              return (
                <tr key={entry.id} className="odd:bg-white even:bg-slate-50">
                  {ruleCols.map(col => (
                    <td key={col} className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">{entry.record[col] ?? ''}</td>
                  ))}
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">{BRAND_LABEL[entry.brand]}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right whitespace-nowrap">R$ {fmtBRL(entry.valorGarantia)}</td>
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">{formatDateBR(entry.dataInclusao)}</td>
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">{vencimentoISO ? formatDateBR(vencimentoISO) : '—'}</td>
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">{formatDateBR(entry.dataPagamento)}</td>
                  <td className="border border-slate-200 px-3 py-1.5 whitespace-nowrap">
                    <button
                      onClick={() => setConfirmEstornoId(entry.id)}
                      className="inline-flex items-center gap-1 border border-amber-300 text-amber-700 rounded px-2.5 py-1 font-medium hover:bg-amber-50"
                    >
                      <Undo2 className="w-3.5 h-3.5" />Estornar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmEstornoId && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
            <h2 className="font-bold text-slate-800">Estornar pagamento?</h2>
            <p className="text-sm text-slate-600 mt-2">O veículo voltará para a aba de garantia de {GARANTIA_BANCO_LABEL[banco]}.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmEstornoId(null)} className="px-3 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => void handleEstorno(confirmEstornoId)} className="px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded hover:bg-amber-700">Estornar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoricoMovimentacaoPanel() {
  const [banco, setBanco] = useState<GarantiaBanco>('volks');

  return (
    <div className="space-y-4">
      {/* Sub-abas por banco */}
      <div className="flex gap-2">
        {([['volks', GARANTIA_BANCO_LABEL.volks], ['itau', GARANTIA_BANCO_LABEL.itau]] as [GarantiaBanco, string][]).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setBanco(value)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
              banco === value ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <HistoricoBancoPanel key={banco} banco={banco} />
    </div>
  );
}

function GarantiaPanel() {
  const [view, setView] = useState<GarantiaBanco | 'historico'>('itau');

  return (
    <div className="space-y-5">
      {/* Abas: Banco Itau / Banco Volks / Histórico de Movimentação */}
      <div className="flex border-b border-slate-200">
        {GARANTIA_BANCOS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setView(value)}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              view === value ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setView('historico')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            view === 'historico' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Histórico de Movimentação
        </button>
      </div>

      {view === 'historico'
        ? <HistoricoMovimentacaoPanel />
        : <GarantiaBancoPanel key={view} banco={view} />}
    </div>
  );
}

// ─── Aba: Controle de Veículos ────────────────────────────────────────────────

export function ControleVeiculosTab() {
  const [subTab, setSubTab] = useState<SubTab>('importar');
  const [brand, setBrand] = useState<ControleVeiculosBrand>('vw');

  return (
    <div className="flex-1 bg-slate-50 overflow-auto p-4 md:p-6">
      <div className="bg-white rounded-lg shadow-sm">
        {/* Sub-abas: Importar Arquivo / Veículos Disponíveis / Veículos em Garantia */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 md:px-6 pt-4">
          {SUB_TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSubTab(value)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                subTab === value ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Seletores de marca VW / Audi (importação e disponíveis) */}
        {(subTab === 'importar' || subTab === 'disponiveis') && (
          <div className="flex border-b border-slate-200 px-4 md:px-6">
            {(['vw', 'audi'] as ControleVeiculosBrand[]).map(item => (
              <button
                key={item}
                onClick={() => setBrand(item)}
                className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  brand === item ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {BRAND_LABEL[item]}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 md:p-6">
          {subTab === 'importar' && <ImportarBrandPanel key={brand} brand={brand} />}
          {subTab === 'disponiveis' && <DisponiveisBrandPanel key={brand} brand={brand} />}
          {subTab === 'garantia' && <GarantiaPanel />}
        </div>
      </div>
    </div>
  );
}
