import { useState, useEffect, useMemo, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, ChevronDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  type BonusVarejoRow,
  loadBonusVarejoRows,
  replaceBonusVarejoRows,
} from './bonusVarejoStorage';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function parseDate(raw: string): { year: number; month: number } | null {
  if (!raw) return null;
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
  const n = parseFloat(String(raw).replace(',', '.'));
  if (isNaN(n)) return raw || '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function sumValor(rows: BonusVarejoRow[]): number {
  return rows.reduce((acc, r) => {
    const n = parseFloat(String(r.valor).replace(',', '.'));
    return acc + (isNaN(n) ? 0 : n);
  }, 0);
}

// ─── Exporta para Excel ────────────────────────────────────────────────────────
function exportToExcel(rows: BonusVarejoRow[], filename: string) {
  const data = rows.map(r => ({
    Chassi:           r.chassi,
    'Data da Venda':   r.data,
    'Nota Fiscal':     r.notaFiscal,
    Valor:         r.valor,    Vendedor:          r.vendedor,  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bônus Varejo');
  XLSX.writeFile(wb, filename);
}

// ─── Lê Excel e converte para rows ────────────────────────────────────────────
function parseExcelFile(buffer: ArrayBuffer): Omit<BonusVarejoRow, 'id'>[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return raw.map(r => ({
    chassi:     String(r['Chassi']      ?? r['CHASSI']       ?? ''),
    data:       String(r['Data da Venda'] ?? r['Data']        ?? r['DATA']         ?? ''),
    notaFiscal: String(r['Nota Fiscal'] ?? r['NOTA_FISCAL']  ?? r['NF'] ?? ''),
    valor:      String(r['Valor']       ?? r['VALOR']        ?? ''),
    vendedor:   String(r['Vendedor']    ?? r['VENDEDOR']     ?? ''),
  }));
}

// ─── Componente principal ──────────────────────────────────────────────────────
export function BonusVarejoDashboard() {
  const [rows, setRows]               = useState<BonusVarejoRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filterYear, setFilterYear]   = useState<number>(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [confirmImport, setConfirmImport] = useState(false);

  const xlsxInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    loadBonusVarejoRows().then(data => {
      setRows(data);
      setLoading(false);
    });
  }, []);

  // Anos disponíveis
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    rows.forEach(r => {
      const d = parseDate(r.data);
      if (d) years.add(d.year);
    });
    const sorted = Array.from(years).sort((a, b) => b - a);
    return sorted.length ? sorted : [new Date().getFullYear()];
  }, [rows]);

  // Contagem por mês para o filtro
  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    rows.forEach(r => {
      const d = parseDate(r.data);
      if (d && d.year === filterYear) counts[d.month] = (counts[d.month] ?? 0) + 1;
    });
    return counts;
  }, [rows, filterYear]);

  // Linhas filtradas
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const d = parseDate(r.data);
      if (!d) return false;
      if (d.year !== filterYear) return false;
      if (filterMonth !== null && d.month !== filterMonth) return false;
      return true;
    });
  }, [rows, filterYear, filterMonth]);

  const totalValor = useMemo(() => sumValor(filteredRows), [filteredRows]);

  // ─── Importar Excel ──────────────────────────────────────────────────────────
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
    const parsed = parseExcelFile(buffer);
    if (parsed.length === 0) {
      toast.warning('Nenhum registro encontrado no Excel.');
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';
      return;
    }
    const { total } = await replaceBonusVarejoRows(parsed);
    const updated = await loadBonusVarejoRows();
    setRows(updated);
    toast.success(`${total} registro(s) importado(s) (dados anteriores substituídos).`);
    if (xlsxInputRef.current) xlsxInputRef.current.value = '';
  }

  // ─── Exportar Excel ──────────────────────────────────────────────────────────
  function handleExport() {
    if (filteredRows.length === 0) { toast.warning('Nenhum dado para exportar.'); return; }
    const monthLabel = filterMonth ? MONTHS[filterMonth - 1] : 'Ano-todo';
    exportToExcel(filteredRows, `bonus_varejo_${filterYear}_${monthLabel}.xlsx`);
    toast.success('Arquivo Excel gerado!');
  }

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
      {/* Input oculto */}
      <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls,.ods" className="hidden" onChange={handleXlsxImport} />

      {/* Dialog de confirmação de importação */}
      {confirmImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Importar Excel — Bônus Varejo</p>
                <p className="text-slate-500 text-xs mt-1">
                  Os dados atuais de <strong>Bônus Varejo</strong> serão <strong>substituídos</strong> pelo conteúdo do arquivo.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmImport(false)}>Cancelar</Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConfirmImport}>
                Confirmar importação
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de ações */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex gap-0">
          <span className="px-5 py-3 text-sm font-medium border-b-2 border-emerald-500 text-emerald-700 bg-emerald-50/50">
            Bônus Varejo
          </span>
        </div>
        <div className="flex items-center gap-2 py-1.5">
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 h-8 text-xs"
            onClick={handleXlsxClick}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Importar · Bônus Varejo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs"
            onClick={handleExport}
          >
            <Download className="w-3.5 h-3.5" />
            Exportar · Bônus Varejo
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
          Total Valor: <span className="font-semibold text-slate-700 font-mono">{totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </span>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Carregando...</div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-2">
            <FileSpreadsheet className="w-10 h-10" />
            <span className="text-sm">Nenhum registro — importe um arquivo Excel</span>
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                {['Chassi', 'Data da Venda', 'Nota Fiscal', 'Valor', 'Vendedor'].map(h => (
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
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.data || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.notaFiscal || '-'}</td>
                  <td className="px-3 py-2 font-mono text-emerald-700 whitespace-nowrap">{fmtCurrency(row.valor)}</td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.vendedor || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
