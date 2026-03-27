import { useState, useEffect, useMemo, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, ChevronDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  type RegistroSubTab,
  type RegistroVendasRow,
  loadRegistroRows,
  appendRegistroRows,
  replaceRegistroRows,
  parseTxtLines,
  TRANSACAO_MAP,
} from './registroVendasStorage';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const SUB_TABS: { id: RegistroSubTab; label: string }[] = [
  { id: 'novos',    label: 'Veículos Novos' },
  { id: 'frotista', label: 'Veículos VD / Frotista' },
  { id: 'usados',   label: 'Veículos Usados' },
];

function parseDate(raw: string): { year: number; month: number } | null {
  if (!raw) return null;
  // Suporta DD/MM/YYYY ou YYYY-MM-DD
  let d: Date | null = null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('/');
    d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  } else if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    d = new Date(raw);
  }
  if (!d || isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function fmtCurrency(raw: string): string {
  const n = parseFloat(raw.replace(',', '.'));
  if (isNaN(n)) return raw || '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function sumField(rows: RegistroVendasRow[], field: 'valVenda' | 'valCusto'): number {
  return rows.reduce((acc, r) => {
    const n = parseFloat(r[field].replace(',', '.'));
    return acc + (isNaN(n) ? 0 : n);
  }, 0);
}

// ─── Exporta para Excel ────────────────────────────────────────────────────────
function exportToExcel(rows: RegistroVendasRow[], filename: string) {
  const data = rows.map(r => ({
    Chassi:        r.chassi,
    Modelo:        r.modelo,
    'Val. Venda':  r.valVenda,
    'NF Venda':    r.nfVenda,
    'NF Entrada':  r.nfEntrada,
    'Val. Custo':  r.valCusto,
    'Dt. Entrada': r.dtaEntrada,
    'Dt. Venda':   r.dtaVenda,
    Cor:           r.nomeCor,
    Vendedor:      r.nomeVendedor,
    Transação:     r.transacao,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registro');
  XLSX.writeFile(wb, filename);
}

// ─── Lê Excel e converte para rows ────────────────────────────────────────────
function parseExcelFile(
  buffer: ArrayBuffer,
  tab: RegistroSubTab,
): Omit<RegistroVendasRow, 'id'>[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return raw.map(r => ({
    chassi:       String(r['Chassi'] ?? r['CHASSI'] ?? ''),
    modelo:       String(r['Modelo'] ?? r['DES_MODELO'] ?? ''),
    valVenda:     String(r['Val. Venda'] ?? r['VAL_VENDA'] ?? ''),
    nfVenda:      String(r['NF Venda'] ?? r['NUMERO_NOTA_FISCAL'] ?? ''),
    nfEntrada:    String(r['NF Entrada'] ?? r['NUMERO_NOTA_NFENTRADA'] ?? ''),
    valCusto:     String(r['Val. Custo'] ?? r['VAL_CUSTO_CONTABIL'] ?? ''),
    dtaEntrada:   String(r['Dt. Entrada'] ?? r['DTA_ENTRADA'] ?? ''),
    dtaVenda:     String(r['Dt. Venda'] ?? r['DTA_VENDA'] ?? ''),
    nomeCor:      String(r['Cor'] ?? r['NOME_COR'] ?? ''),
    nomeVendedor: String(r['Vendedor'] ?? r['NOME_VENDEDOR'] ?? ''),
    transacao:    String(r['Transação'] ?? r['TIPO_TRANSACAO'] ?? TRANSACAO_MAP[tab][0]),
  }));
}

// ─── Componente principal ──────────────────────────────────────────────────────
export function RegistroVendasDashboard() {
  const [activeTab, setActiveTab]       = useState<RegistroSubTab>('novos');
  const [rows, setRows]                 = useState<RegistroVendasRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterYear, setFilterYear]     = useState<number>(new Date().getFullYear());
  const [filterMonth, setFilterMonth]   = useState<number | null>(new Date().getMonth() + 1);

  const txtInputRef   = useRef<HTMLInputElement>(null);
  const xlsxInputRef  = useRef<HTMLInputElement>(null);
  const [confirmImport, setConfirmImport] = useState(false);

  // Carrega dados ao trocar de aba
  useEffect(() => {
    setLoading(true);
    loadRegistroRows(activeTab).then(data => {
      setRows(data);
      setLoading(false);
    });
  }, [activeTab]);

  // Anos disponíveis
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    rows.forEach(r => {
      const d = parseDate(r.dtaVenda);
      if (d) years.add(d.year);
    });
    const sorted = Array.from(years).sort((a, b) => b - a);
    return sorted.length ? sorted : [new Date().getFullYear()];
  }, [rows]);

  // Contagem por mês para o filtro
  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    rows.forEach(r => {
      const d = parseDate(r.dtaVenda);
      if (d && d.year === filterYear) counts[d.month] = (counts[d.month] ?? 0) + 1;
    });
    return counts;
  }, [rows, filterYear]);

  // Linhas filtradas
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const d = parseDate(r.dtaVenda);
      if (!d) return false;
      if (d.year !== filterYear) return false;
      if (filterMonth !== null && d.month !== filterMonth) return false;
      return true;
    });
  }, [rows, filterYear, filterMonth]);

  // KPIs
  const totalVenda = useMemo(() => sumField(filteredRows, 'valVenda'), [filteredRows]);
  const totalCusto = useMemo(() => sumField(filteredRows, 'valCusto'), [filteredRows]);

  // ─── Importar TXT (alimenta as 3 abas simultaneamente) ─────────────────────
  async function handleTxtImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseTxtLines(text);

    const total = parsed.novos.length + parsed.frotista.length + parsed.usados.length;
    if (total === 0) {
      toast.warning('Nenhum registro reconhecido no arquivo.');
      if (txtInputRef.current) txtInputRef.current.value = '';
      return;
    }

    const tabs: RegistroSubTab[] = ['novos', 'frotista', 'usados'];
    await Promise.all(tabs.map(t => parsed[t].length > 0 ? appendRegistroRows(t, parsed[t]) : Promise.resolve({ added: 0 })));

    // Recarrega a aba atual
    const updated = await loadRegistroRows(activeTab);
    setRows(updated);

    const parts = [
      parsed.novos.length    > 0 ? `${parsed.novos.length} Novos`       : null,
      parsed.frotista.length > 0 ? `${parsed.frotista.length} VD/Frotista` : null,
      parsed.usados.length   > 0 ? `${parsed.usados.length} Usados`     : null,
    ].filter(Boolean);
    toast.success(`Importado: ${parts.join(' · ')}`);
    if (txtInputRef.current) txtInputRef.current.value = '';
  }

  // ─── Importar Excel ───────────────────────────────────────────────────────────
  function handleXlsxClick() {
    setConfirmImport(true);
  }

  function handleConfirmImport() {
    setConfirmImport(false);
    xlsxInputRef.current?.click();
  }

  async function handleXlsxImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const parsed = parseExcelFile(buffer, activeTab);
    if (parsed.length === 0) {
      toast.warning('Nenhum registro encontrado no Excel.');
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';
      return;
    }
    const { total } = await replaceRegistroRows(activeTab, parsed);
    const updated = await loadRegistroRows(activeTab);
    setRows(updated);
    toast.success(`${total} registro(s) importado(s) (dados anteriores substituídos).`);
    if (xlsxInputRef.current) xlsxInputRef.current.value = '';
  }

  // ─── Exportar Excel ───────────────────────────────────────────────────────────
  function handleExport() {
    if (filteredRows.length === 0) { toast.warning('Nenhum dado para exportar.'); return; }
    const monthLabel = filterMonth ? MONTHS[filterMonth - 1] : 'Ano-todo';
    exportToExcel(filteredRows, `registro_${activeTab}_${filterYear}_${monthLabel}.xlsx`);
    toast.success('Arquivo Excel gerado!');
  }

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
      {/* Inputs ocultos */}
      <input ref={txtInputRef}  type="file" accept=".txt"            className="hidden" onChange={handleTxtImport} />
      <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls,.ods" className="hidden" onChange={handleXlsxImport} />

      {/* Dialog de confirmação de importação Excel */}
      {confirmImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Importar Excel — {SUB_TABS.find(t => t.id === activeTab)?.label}</p>
                <p className="text-slate-500 text-xs mt-1">Os dados atuais de <strong>{SUB_TABS.find(t => t.id === activeTab)?.label}</strong> serão <strong>substituídos</strong> pelo conteúdo do arquivo. As outras abas não serão afetadas.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmImport(false)}>Cancelar</Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConfirmImport}>Confirmar importação</Button>
            </div>
          </div>
        </div>
      )}

      {/* Barra superior — Importar TXT (único, alimenta as 3 abas) */}
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <Button
          size="sm"
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => txtInputRef.current?.click()}
        >
          <Upload className="w-4 h-4" />
          Importar TXT
        </Button>
        <span className="text-xs text-slate-400">Os dados serão distribuídos automaticamente entre as abas pelo tipo de transação.</span>
      </div>

      {/* Sub-abas + botões de Excel por aba */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex gap-0">
          {SUB_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 py-1.5">
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 h-8 text-xs"
            onClick={handleXlsxClick}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Importar · {SUB_TABS.find(t => t.id === activeTab)?.label}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs"
            onClick={handleExport}
          >
            <Download className="w-3.5 h-3.5" />
            Exportar · {SUB_TABS.find(t => t.id === activeTab)?.label}
          </Button>
        </div>
      </div>

      {/* Filtro Ano / Mês */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 flex-shrink-0 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">ANO</span>
        <div className="relative mr-2">
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            className="appearance-none text-sm font-bold text-slate-700 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="w-px h-5 bg-slate-200 mr-1" />
        <button
          onClick={() => setFilterMonth(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterMonth === null
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
        >
          Ano todo
        </button>
        {MONTHS.map((name, idx) => {
          const m = idx + 1;
          const count = monthCounts[m] ?? 0;
          const isActive = filterMonth === m;
          const hasData = count > 0;
          return (
            <button
              key={m}
              onClick={() => hasData ? setFilterMonth(m) : undefined}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : hasData
                  ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  : 'text-slate-300 cursor-default'
              }`}
            >
              {name}
              {hasData && (
                <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 rounded-full leading-none py-0.5 ${
                  isActive ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* KPIs */}
      <div className="bg-white border-b border-slate-100 px-6 py-2 flex items-center gap-6 flex-shrink-0">
        <span className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{filteredRows.length}</span> registro{filteredRows.length !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-slate-500">
          Val. Venda: <span className="font-semibold text-slate-700 font-mono">{totalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </span>
        <span className="text-xs text-slate-500">
          Val. Custo: <span className="font-semibold text-slate-700 font-mono">{totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </span>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Carregando...</div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-2">
            <FileSpreadsheet className="w-10 h-10" />
            <span className="text-sm">Nenhum registro — importe um arquivo TXT ou Excel</span>
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                {['Chassi','Modelo','Val. Venda','NF Venda','NF Entrada','Val. Custo','Dt. Entrada','Dt. Venda','Cor','Vendedor','Transação'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row, i) => (
                <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                  <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">{row.chassi || '-'}</td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.modelo || '-'}</td>
                  <td className="px-3 py-2 font-mono text-emerald-700 whitespace-nowrap">{fmtCurrency(row.valVenda)}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.nfVenda || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.nfEntrada || '-'}</td>
                  <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">{fmtCurrency(row.valCusto)}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.dtaEntrada || '-'}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.dtaVenda || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.nomeCor || '-'}</td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.nomeVendedor || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                      {row.transacao || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
