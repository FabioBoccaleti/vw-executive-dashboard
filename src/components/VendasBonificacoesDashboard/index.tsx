import { Fragment, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, TrendingUp, Pencil, Trash2, Check, X, Plus, Search, FilterX } from 'lucide-react';
import { toast } from 'sonner';
import { loadVendasRows, saveVendasRows, createEmptyRow, type VendasRow } from './vendasStorage';

// ─── Column definitions ────────────────────────────────────────────────────────
type ColType = 'text' | 'currency' | 'date';
interface ColDef { key: keyof VendasRow; label: string; type: ColType; width: number; }

const COLUMNS: ColDef[] = [
  { key: 'veiculo',                             label: 'Veículo',                                                               type: 'text',     width: 140 },
  { key: 'chassi',                              label: 'Chassi',                                                                type: 'text',     width: 150 },
  { key: 'revenda',                             label: 'Revenda',                                                               type: 'text',     width: 140 },
  { key: 'blindadora',                          label: 'Blindadora',                                                            type: 'text',     width: 140 },
  { key: 'custoBlindagem',                      label: 'Custo Blindagem',                                                       type: 'currency', width: 135 },
  { key: 'dataPagamentoBlindadora',             label: 'Data do Pagamento (Compra Blindadora)',                                  type: 'date',     width: 140 },
  { key: 'situacaoNegociacaoBlindadora',        label: 'Situação da Negociação com a Blindadora',                               type: 'text',     width: 175 },
  { key: 'dataVenda',                           label: 'Data da Venda',                                                         type: 'date',     width: 130 },
  { key: 'valorVendaBlindagem',                 label: 'Valor da Venda da Blindagem',                                           type: 'currency', width: 145 },
  { key: 'lucroOperacao',                       label: 'Lucro da Operação',                                                     type: 'currency', width: 135 },
  { key: 'localPgtoBlindagem',                  label: 'Local de Pgto da Blindagem',                                            type: 'text',     width: 155 },
  { key: 'nomeVendedor',                        label: 'Nome do Vendedor',                                                      type: 'text',     width: 150 },
  { key: 'remuneracaoVendedor',                 label: 'Remuneração Vendedor',                                                  type: 'currency', width: 135 },
  { key: 'remuneracaoGerencia',                 label: 'Remuneração Gerência',                                                  type: 'currency', width: 135 },
  { key: 'remuneracaoDiretoria',                label: 'Remuneração Diretoria',                                                 type: 'currency', width: 135 },
  { key: 'remuneracaoGerenciaSupervisorUsados', label: 'Remuneração Gerência / Supervisor de Usados',                           type: 'currency', width: 160 },
  { key: 'comissaoBrutaSorana',                 label: 'Comissão Bruta Sorana',                                                 type: 'currency', width: 145 },
  { key: 'numeroNFComissao',                    label: 'Nº NF de Comissão',                                                     type: 'text',     width: 120 },
  { key: 'situacaoComissao',                    label: 'Situação da Comissão',                                                  type: 'text',     width: 155 },
  { key: 'valorAPagarBlindadora',               label: 'Valor a Pagar p/ Blindadora',                                           type: 'currency', width: 145 },
  { key: 'valorAReceberBlindadora',             label: 'Valor a Receber da Blindadora pela Antecipação da Blindagem',            type: 'currency', width: 185 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(raw: string): string {
  if (!raw) return '';
  const n = parseFloat(raw);
  return isNaN(n) ? '' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function toDisplayNumber(raw: string): string {
  if (!raw) return '';
  const n = parseFloat(raw);
  return isNaN(n) ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBrazilianNumber(input: string): string {
  const s = input.trim().replace(/R\$\s*/g, '');
  if (!s) return '';
  const lastComma = s.lastIndexOf(',');
  const lastPeriod = s.lastIndexOf('.');
  const normalized = lastComma > lastPeriod
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/,/g, '');
  const n = parseFloat(normalized);
  return isNaN(n) ? '' : String(n);
}

function fmtDate(v: string): string {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return y && m && d ? `${d}/${m}/${y}` : v;
}

// ─── Today in YYYY-MM-DD ──────────────────────────────────────────────────────
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Filter helpers ───────────────────────────────────────────────────────────
type FilterValues = Partial<Record<keyof VendasRow, string>>;

function rowMatchesFilters(row: VendasRow, filters: FilterValues): boolean {
  for (const [key, term] of Object.entries(filters) as [keyof VendasRow, string][]) {
    if (!term) continue;
    const cell = (row[key] ?? '').toString().toLowerCase();
    const t    = term.toLowerCase().trim();
    if (!cell.includes(t)) return false;
  }
  return true;
}

// ─── FilterCell ───────────────────────────────────────────────────────────────
interface FilterCellProps {
  col: ColDef;
  value: string;
  onChange: (v: string) => void;
}
function FilterCell({ col, value, onChange }: FilterCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = value.length > 0;

  if (col.type === 'date') {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="DD/MM/AAAA"
          className={`w-full min-w-0 bg-white border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 ${
            hasValue ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'
          }`}
        />
        <input
          type="date"
          value={value ? (() => {
            const parts = value.split('/');
            if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
            return '';
          })() : ''}
          defaultValue={todayISO()}
          onChange={e => {
            const [y, m, d] = e.target.value.split('-');
            if (y && m && d) onChange(`${d}/${m}/${y}`);
          }}
          onClick={e => { if (!(e.currentTarget as HTMLInputElement).value) (e.currentTarget as HTMLInputElement).value = todayISO(); }}
          className="w-6 h-6 opacity-0 absolute pointer-events-none"
          id={`datepicker-${col.key}`}
        />
        <label
          htmlFor={`datepicker-${col.key}`}
          title="Selecionar data"
          className="flex-shrink-0 cursor-pointer text-slate-400 hover:text-amber-600 transition-colors"
          onClick={() => {
            const el = document.getElementById(`datepicker-${col.key}`) as HTMLInputElement | null;
            if (el) { if (!el.value) el.value = todayISO(); el.showPicker?.(); }
          }}
        >
          <Search className="w-3.5 h-3.5" />
        </label>
        {hasValue && (
          <button onClick={() => onChange('')} className="flex-shrink-0 text-slate-300 hover:text-red-400 transition-colors">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-1.5 w-3 h-3 text-slate-300 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Filtrar…"
        className={`w-full min-w-0 bg-white border rounded pl-5 pr-5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 ${
          col.type === 'currency' ? 'text-right' : 'text-left'
        } ${hasValue ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'}`}
      />
      {hasValue && (
        <button
          onClick={() => onChange('')}
          className="absolute right-1.5 text-slate-300 hover:text-red-400 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── CurrencyCell (defined outside to avoid remount on parent re-render) ──────
interface CurrencyCellProps { value: string; onChange: (v: string) => void; }
function CurrencyCell({ value, onChange }: CurrencyCellProps) {
  const [local, setLocal] = useState(() => toDisplayNumber(value));
  return (
    <input
      type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={e => e.target.select()}
      onBlur={() => {
        const parsed = parseBrazilianNumber(local);
        onChange(parsed);
        setLocal(toDisplayNumber(parsed));
      }}
      className="w-full text-right bg-white border border-amber-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono tabular-nums"
      placeholder="0,00"
    />
  );
}

// ─── InsertZoneTr ─────────────────────────────────────────────────────────────
function InsertZoneTr({ colSpan, onInsert }: { colSpan: number; onInsert: () => void }) {
  return (
    <tr className="group/ins" style={{ height: '10px' }}>
      <td colSpan={colSpan} className="p-0 relative" style={{ height: '10px' }}>
        <div className="absolute inset-x-0 inset-y-0 flex items-center justify-center z-30 opacity-0 group-hover/ins:opacity-100 pointer-events-none group-hover/ins:pointer-events-auto transition-all duration-150">
          <div className="absolute inset-x-0 top-1/2 h-px bg-amber-400" />
          <button
            onClick={onInsert}
            className="relative z-10 flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-amber-500 text-white rounded-full shadow-md hover:bg-amber-600 active:scale-95 transition-all"
          >
            <Plus className="w-3 h-3" />
            Inserir linha aqui
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
interface VendasBonificacoesDashboardProps {
  onChangeBrand: () => void;
}

export function VendasBonificacoesDashboard({ onChangeBrand }: VendasBonificacoesDashboardProps) {
  const [rows, setRows]           = useState<VendasRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<VendasRow | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [filters, setFilters]     = useState<FilterValues>({});

  useEffect(() => {
    loadVendasRows().then(r => { setRows(r); setLoading(false); });
  }, []);

  const persist = async (updated: VendasRow[]) => {
    setSaving(true);
    try {
      const ok = await saveVendasRows(updated);
      if (!ok) toast.error('Erro ao salvar. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: VendasRow) => {
    setDeleteId(null);
    setEditingId(row.id);
    setEditDraft({ ...row });
  };

  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };

  const saveEdit = async () => {
    if (!editDraft) return;
    const updated = rows.map(r => r.id === editDraft.id ? editDraft : r);
    setRows(updated);
    setEditingId(null);
    setEditDraft(null);
    await persist(updated);
    toast.success('Linha salva com sucesso');
  };

  const changeField = (field: keyof VendasRow, value: string) =>
    setEditDraft(prev => prev ? { ...prev, [field]: value } : prev);

  const insertAt = async (index: number) => {
    const row = createEmptyRow();
    const updated = [...rows];
    updated.splice(index, 0, row);
    setRows(updated);
    await persist(updated);
    startEdit(row);
  };

  const deleteRow = async (id: string) => {
    const updated = rows.filter(r => r.id !== id);
    setRows(updated);
    setDeleteId(null);
    if (editingId === id) { setEditingId(null); setEditDraft(null); }
    await persist(updated);
    toast.success('Registro removido com sucesso');
  };

  const setFilter = (key: keyof VendasRow, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const clearFilters = () => setFilters({});

  const hasActiveFilters = Object.values(filters).some(v => v && v.length > 0);
  const filteredRows     = hasActiveFilters ? rows.filter(r => rowMatchesFilters(r, filters)) : rows;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Carregando dados...</p>
        </div>
      </div>
    );
  }

  const totalCols = COLUMNS.length + 2;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ── Header ── */}
      <header
        className="text-white shadow-lg flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)' }}
      >
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight">
                Demonstrativo de Vendas e Bonificações
              </h1>
              <p className="text-amber-200 text-xs mt-0.5">
                {hasActiveFilters
                  ? `${filteredRows.length} de ${rows.length} ${rows.length === 1 ? 'registro' : 'registros'}`
                  : `${rows.length} ${rows.length === 1 ? 'registro' : 'registros'}`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saving && (
              <span className="flex items-center gap-1.5 text-amber-200 text-xs">
                <span className="w-3 h-3 border-2 border-amber-200 border-t-transparent rounded-full animate-spin" />
                Salvando...
              </span>
            )}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs text-amber-100 border border-amber-400/50 bg-amber-700/40 hover:bg-amber-700/70 rounded-md px-2.5 py-1 transition-colors"
              >
                <FilterX className="w-3.5 h-3.5" />
                Limpar filtros
              </button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onChangeBrand}
              className="text-white border border-white/30 hover:bg-white/15 gap-2"
            >
              <LogOut className="w-4 h-4" />
              Trocar painel
            </Button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">

        {/* Table card */}
        <div
          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto flex-1"
          style={{ maxHeight: 'calc(100vh - 180px)' }}
        >
          <table className="border-collapse text-sm" style={{ width: 'max-content', minWidth: '100%' }}>
            <colgroup>
              <col style={{ width: 44, minWidth: 44 }} />
              {COLUMNS.map(c => <col key={c.key} style={{ width: c.width, minWidth: c.width }} />)}
              <col style={{ width: 130, minWidth: 130 }} />
            </colgroup>

            {/* ── THEAD ── */}
            <thead>
              <tr>
                <th
                  className="sticky left-0 top-0 z-40 text-white text-center text-xs font-semibold px-2 py-3 border-r border-gray-600"
                  style={{ background: '#1f2937' }}
                >
                  #
                </th>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className={`sticky top-0 z-30 text-white text-xs font-semibold px-3 py-3 border-r border-gray-600 align-top leading-snug ${
                      col.type === 'currency' ? 'text-right' : 'text-left'
                    }`}
                    style={{ background: '#374151' }}
                  >
                    {col.label}
                  </th>
                ))}
                <th
                  className="sticky right-0 top-0 z-40 text-white text-center text-xs font-semibold px-2 py-3 border-l border-gray-600 whitespace-nowrap"
                  style={{ background: '#1f2937' }}
                >
                  Ações
                </th>
              </tr>

              {/* ── FILTER ROW ── */}
              <tr>
                <th
                  className="sticky left-0 z-40 bg-slate-50 border-r border-b border-slate-200 px-1 py-1.5"
                  style={{ top: 'var(--header-height, 44px)' }}
                />
                {COLUMNS.map(col => (
                  <th
                    key={`f-${col.key}`}
                    className="sticky z-30 bg-slate-50 border-r border-b border-slate-200 px-1.5 py-1.5"
                    style={{ top: 'var(--header-height, 44px)' }}
                  >
                    <FilterCell
                      col={col}
                      value={filters[col.key] ?? ''}
                      onChange={v => setFilter(col.key, v)}
                    />
                  </th>
                ))}
                <th
                  className="sticky right-0 z-40 bg-slate-50 border-l border-b border-slate-200 px-1 py-1.5"
                  style={{ top: 'var(--header-height, 44px)' }}
                />
              </tr>
            </thead>

            {/* ── TBODY ── */}
            <tbody>
              {!hasActiveFilters && (
                <InsertZoneTr colSpan={totalCols} onInsert={() => insertAt(0)} />
              )}

              {filteredRows.map((row, idx) => {
                const isEditing = editingId === row.id;
                const isDelete  = deleteId === row.id;
                const isEven    = idx % 2 === 0;
                const rowBg     = isEditing ? '#fffbeb' : isEven ? '#ffffff' : '#f8fafc';
                const draft     = isEditing ? editDraft! : row;
                // real index in full array for insert operations
                const realIdx   = rows.indexOf(row);

                return (
                  <Fragment key={row.id}>
                    <tr style={{ background: rowBg }} className="transition-colors group/row">

                      {/* Row number */}
                      <td
                        className="sticky left-0 z-20 text-center text-xs text-slate-400 font-mono border-r border-slate-200 px-2 py-2"
                        style={{ background: rowBg }}
                      >
                        {realIdx + 1}
                      </td>

                      {/* Data cells */}
                      {COLUMNS.map(col => {
                        const val = (draft as VendasRow)[col.key] as string;
                        const isRight = col.type === 'currency';
                        return (
                          <td
                            key={col.key}
                            className={`border-r border-slate-100 px-2 py-1.5 text-xs ${isRight ? 'text-right' : 'text-left'} text-slate-700`}
                            style={{ verticalAlign: 'middle' }}
                          >
                            {isEditing ? (
                              col.type === 'currency' ? (
                                <CurrencyCell value={val} onChange={v => changeField(col.key, v)} />
                              ) : col.type === 'date' ? (
                                <input
                                  type="date"
                                  value={val}
                                  onChange={e => changeField(col.key, e.target.value)}
                                  className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={val}
                                  onChange={e => changeField(col.key, e.target.value)}
                                  className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                                  placeholder="—"
                                />
                              )
                            ) : (
                              col.type === 'currency' ? (
                                <span className="font-mono tabular-nums">{fmtCurrency(val)}</span>
                              ) : col.type === 'date' ? (
                                <span>{fmtDate(val)}</span>
                              ) : (
                                val
                                  ? <span>{val}</span>
                                  : <span className="text-slate-300 select-none">—</span>
                              )
                            )}
                          </td>
                        );
                      })}

                      {/* Actions */}
                      <td
                        className="sticky right-0 z-20 border-l border-slate-200 px-2 py-1.5"
                        style={{ background: rowBg, minWidth: 130 }}
                      >
                        {isDelete ? (
                          /* ── Delete confirmation ── */
                          <div className="flex flex-col items-center gap-1.5 py-0.5">
                            <p className="text-xs text-red-600 font-semibold text-center leading-tight">
                              Remover este<br />registro?
                            </p>
                            <div className="flex gap-1">
                              <button
                                onClick={() => deleteRow(row.id)}
                                className="px-2.5 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 font-semibold transition-colors"
                              >
                                Excluir
                              </button>
                              <button
                                onClick={() => setDeleteId(null)}
                                className="px-2.5 py-1 bg-slate-200 text-slate-600 text-xs rounded-md hover:bg-slate-300 font-semibold transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : isEditing ? (
                          /* ── Edit mode actions ── */
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={saveEdit}
                              title="Salvar linha"
                              className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white text-xs rounded-md hover:bg-amber-700 font-semibold transition-colors"
                            >
                              <Check className="w-3 h-3" />
                              Salvar
                            </button>
                            <button
                              onClick={cancelEdit}
                              title="Cancelar edição"
                              className="p-1.5 rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          /* ── View mode actions ── */
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              onClick={() => startEdit(row)}
                              title="Editar linha"
                              className="p-1.5 rounded-md text-amber-600 hover:bg-amber-50 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setEditDraft(null); setDeleteId(row.id); }}
                              title="Excluir linha"
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {!hasActiveFilters && (
                      <InsertZoneTr colSpan={totalCols} onInsert={() => insertAt(realIdx + 1)} />
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Footer bar ── */}
        <div className="flex items-center justify-between flex-shrink-0 px-1">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => insertAt(rows.length)}
              disabled={hasActiveFilters}
              title={hasActiveFilters ? 'Limpe os filtros para adicionar linhas' : ''}
              className="text-amber-700 border-amber-300 hover:bg-amber-50 gap-1.5 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Adicionar linha
            </Button>
            {hasActiveFilters && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <Search className="w-3 h-3" />
                {filteredRows.length === 0
                  ? 'Nenhum registro encontrado'
                  : `${filteredRows.length} de ${rows.length} registros`}
                {' · '}
                <button onClick={clearFilters} className="underline hover:text-amber-800">Limpar filtros</button>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Pencil className="w-3 h-3 inline-block" />
            Clique para editar · Passe o cursor entre linhas para inserir
          </p>
        </div>

      </div>
    </div>
  );
}
