import { Fragment, useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, TrendingUp, Pencil, Trash2, Check, X, Plus, Search, FilterX, BookOpen, BarChart2, TableProperties, Download, Upload, RefreshCw, Package, ListRestart, FileText, Lock, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import { loadVendasRows, saveVendasRows, createEmptyRow, type VendasRow } from './vendasStorage';
import { loadCatalogo, type CatalogoVeiculos } from './catalogoStorage';
import { loadRevendas, loadBlinadadoras, loadRegras, loadVendedores, type Revenda, type Blindadora, type RegraRemuneracao, type Vendedor } from '@/components/CadastrosPage/cadastrosStorage';
import { VendasAnalise } from './VendasAnalise';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

// ─── Campos calculados automaticamente (somente leitura no modo edição) ────────
const CALC_READONLY_KEYS = new Set<string>(['lucroOperacao', 'remuneracaoVendedor', 'remuneracaoGerencia', 'remuneracaoDiretoria', 'remuneracaoGerenciaSupervisorUsados', 'comissaoBrutaSorana', 'situacaoComissao', 'valorAPagarBlindadora', 'valorAReceberBlindadora']);
const RESULTADO_KEYS        = new Set<string>(['lucroOperacao', 'comissaoBrutaSorana']);
const REMUNERACAO_KEYS      = new Set<string>(['remuneracaoVendedor', 'remuneracaoGerencia', 'remuneracaoDiretoria', 'remuneracaoGerenciaSupervisorUsados']);
const BLINDADORA_PAGTO_KEYS = new Set<string>(['valorAPagarBlindadora', 'valorAReceberBlindadora']);

// Converte número no formato pt-BR ("1.200,50") ou número simples ("1200.5") para number
function parseBR(s: string): number {
  if (!s) return 0;
  const hasComma = s.includes(',');
  const hasDot   = s.includes('.');
  let clean = s.trim().replace(/R\$\s*/g, '');
  if (hasComma) {
    // "1.200,50" → 1200.50
    clean = clean.replace(/\./g, '').replace(',', '.');
  }
  return parseFloat(clean) || 0;
}

function getBaseValue(row: VendasRow, baseCalculo: string): number {
  switch (baseCalculo) {
    case 'Lucro da Operação':          return parseFloat(row.lucroOperacao) || 0;
    case 'Valor da Venda da Blindagem': return parseFloat(row.valorVendaBlindagem) || 0;
    case 'Custo da Blindagem':         return parseFloat(row.custoBlindagem) || 0;
    default: return 0;
  }
}

function calcRemuneracaoField(row: VendasRow, cargo: string, regras: RegraRemuneracao[], revendas: Revenda[] = []): string {
  // Prioridade: regra específica para a revenda da linha; fallback para regra com revendaId vazio (todas)
  const revendaIdDaLinha = revendas.find(rv => rv.nome === row.revenda)?.id ?? '';
  const regra =
    regras.find(r => r.cargo === cargo && r.revendaId && r.revendaId === revendaIdDaLinha) ??
    regras.find(r => r.cargo === cargo && !r.revendaId);
  if (!regra) return '';
  const base = getBaseValue(row, regra.baseCalculo);
  if (regra.tipoPremio === 'percentual') {
    const pct = parseBR(regra.percentual);
    return String(base * pct / 100);
  }
  // faixas: encontra a faixa onde base se encaixa
  for (const faixa of regra.faixas) {
    const de  = parseBR(faixa.de);
    const ate = faixa.ate ? parseBR(faixa.ate) : Infinity;
    if (base >= de && (faixa.ate === '' || base < ate)) {
      return String(parseBR(faixa.premio));
    }
  }
  return '';
}

// ─── Column definitions ────────────────────────────────────────────────────────
type ColType = 'text' | 'currency' | 'date' | 'calc';
interface ColDef { key: keyof VendasRow; label: string; type: ColType; width: number; calc?: (row: VendasRow) => string; }

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
  { key: 'lucroOperacao',                       label: '% Lucro da Operação',                                                   type: 'calc',     width: 100,
    calc: (row) => {
      const venda = parseFloat(row.valorVendaBlindagem);
      const custo = parseFloat(row.custoBlindagem);
      if (!venda || isNaN(venda) || isNaN(custo)) return '';
      const lucro = venda - custo;
      return (lucro / venda * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    },
  } as unknown as ColDef,
  { key: 'localPgtoBlindagem',                  label: 'Local de Pgto da Blindagem',                                            type: 'text',     width: 155 },
  { key: 'nomeVendedor',                        label: 'Nome do Vendedor',                                                      type: 'text',     width: 150 },
  { key: 'remuneracaoVendedor',                 label: 'Remuneração Vendedor',                                                  type: 'currency', width: 135 },
  { key: 'remuneracaoGerencia',                 label: 'Remuneração Gerência',                                                  type: 'currency', width: 135 },
  { key: 'remuneracaoDiretoria',                label: 'Remuneração Diretoria Comercial',                                                 type: 'currency', width: 135 },
  { key: 'remuneracaoGerenciaSupervisorUsados', label: 'Remuneração Gerência / Supervisor de Usados',                           type: 'currency', width: 160 },
  { key: 'comissaoBrutaSorana',                 label: 'Comissão Bruta Sorana',                                                 type: 'currency', width: 145 },
  { key: 'comissaoBrutaSorana',                 label: '% Rentabilidade Bruta Sorana',                                          type: 'calc',     width: 115,
    calc: (row) => {
      const venda = parseFloat(row.valorVendaBlindagem);
      const comissao = parseFloat(row.comissaoBrutaSorana);
      if (!venda || isNaN(venda) || isNaN(comissao)) return '';
      return (comissao / venda * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    },
  } as unknown as ColDef,
  { key: 'numeroNFComissao',                    label: 'Nº NF de Comissão',                                                     type: 'text',     width: 120 },
  { key: 'situacaoComissao',                    label: 'Situação da Comissão',                                                  type: 'text',     width: 155 },
  { key: 'valorAPagarBlindadora',               label: 'Valor a Pagar p/ Blindadora',                                           type: 'currency', width: 145 },
  { key: 'valorAReceberBlindadora',             label: 'Valor a Receber da Blindadora pela Antecipação da Blindagem',            type: 'currency', width: 185 },
  { key: 'dataAcerto',                           label: 'Data de Acerto',                                                         type: 'date',     width: 130 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(raw: string): string {
  if (!raw) return '—';
  const n = parseFloat(raw);
  return isNaN(n) ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

function calcValoresPagamento(draft: VendasRow): void {
  if (draft.situacaoNegociacaoBlindadora !== 'Pagamento Antecipado p/ Blindadora') {
    draft.valorAPagarBlindadora   = '';
    draft.valorAReceberBlindadora = '';
    return;
  }
  const custo = parseFloat(draft.custoBlindagem) || 0;
  const venda = parseFloat(draft.valorVendaBlindagem) || 0;
  if (draft.localPgtoBlindagem === 'Sorana') {
    draft.valorAPagarBlindadora   = String(venda - custo);
    draft.valorAReceberBlindadora = '';
  } else if (draft.localPgtoBlindagem && draft.localPgtoBlindagem !== 'Sorana') {
    draft.valorAReceberBlindadora = String(custo);
    draft.valorAPagarBlindadora   = '';
  }
}

function calcSituacaoComissao(row: Pick<VendasRow, 'numeroNFComissao' | 'comissaoBrutaSorana'>): string {
  if (row.numeroNFComissao) return 'Nota de Intermediação Emitida';
  if (row.comissaoBrutaSorana) return 'Emitir Nota de Intermediação';
  return '';
}

// ─── Today in YYYY-MM-DD ──────────────────────────────────────────────────────
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Export Tabela to Excel ───────────────────────────────────────────────────
async function exportTabelaExcel(exportRows: VendasRow[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();

  const ws = wb.addWorksheet('Demonstrativo de Vendas', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: 'FFF59E0B' } },
  });

  ws.columns = COLUMNS.map(col => ({ width: Math.max(10, Math.round(col.width / 6.5)) }));

  // ── Row 1: Merged title ──────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('pt-BR');
  const titleRow = ws.addRow([`Demonstrativo de Vendas e Bonificações — ${today}`]);
  ws.mergeCells(1, 1, 1, COLUMNS.length);
  titleRow.height = 30;
  titleRow.eachCell(cell => {
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.font  = { color: { argb: 'FFFFFFFF' }, bold: true, size: 13 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1E293B' } }, bottom: { style: 'thin', color: { argb: 'FF1E293B' } },
      left: { style: 'thin', color: { argb: 'FF1E293B' } }, right: { style: 'thin', color: { argb: 'FF1E293B' } },
    };
  });

  // ── Row 2: Headers ───────────────────────────────────────────────────────────
  const headerRow = ws.addRow(COLUMNS.map(c => c.label));
  headerRow.height = 38;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9.5 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top:    { style: 'thin',   color: { argb: 'FF475569' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      left:   { style: 'thin',   color: { argb: 'FF475569' } },
      right:  { style: 'thin',   color: { argb: 'FF475569' } },
    };
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: COLUMNS.length } };

  // ── Data rows ────────────────────────────────────────────────────────────────
  const BTHIN = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const BRL_FMT = '"R$"\\ #,##0.00';

  exportRows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    const values = COLUMNS.map(col => {
      if (col.type === 'calc')     return col.calc ? col.calc(row) : '';
      if (col.type === 'currency') return parseFloat(row[col.key] as string) || null;
      if (col.type === 'date') {
        const v = row[col.key] as string;
        if (!v) return null;
        const [y, m, d] = v.split('-');
        return (y && m && d) ? new Date(+y, +m - 1, +d) : v;
      }
      return (row[col.key] as string) || '';
    });

    const dr = ws.addRow(values);
    dr.height = 17;

    dr.eachCell({ includeEmpty: true }, (cell, ci) => {
      const col = COLUMNS[ci - 1];
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { top: BTHIN, bottom: BTHIN, left: BTHIN, right: BTHIN };
      if (!col) return;
      if (col.type === 'currency') {
        cell.numFmt = BRL_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { size: 9.5, name: 'Courier New' };
      } else if (col.type === 'date') {
        if (cell.value instanceof Date) cell.numFmt = 'DD/MM/YYYY';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { size: 9.5 };
      } else if (col.type === 'calc') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { size: 9.5 };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
        cell.font = { size: 9.5 };
      }
    });
  });

  // ── Totals row ───────────────────────────────────────────────────────────────
  const totals = COLUMNS.map((col, i) => {
    if (i === 0) return 'TOTAL';
    if (col.type === 'currency')
      return exportRows.reduce((s, r) => s + (parseFloat(r[col.key] as string) || 0), 0);
    return null;
  });

  const totalRow = ws.addRow(totals);
  totalRow.height = 22;
  totalRow.eachCell({ includeEmpty: true }, (cell, ci) => {
    const col = COLUMNS[ci - 1];
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.border = {
      top:    { style: 'medium', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF334155' } },
      left:   { style: 'thin',   color: { argb: 'FF475569' } },
      right:  { style: 'thin',   color: { argb: 'FF475569' } },
    };
    if (!col) return;
    if (col.type === 'currency') {
      cell.numFmt = BRL_FMT;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.font = { bold: true, size: 10, color: { argb: 'FFFBBF24' }, name: 'Courier New' };
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    }
  });

  // ── Save ──────────────────────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `demonstrativo-vendas-${dateStr}.xlsx`
  );
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
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

interface FilterCellProps {
  col: ColDef;
  value: string;
  onChange: (v: string) => void;
  // Para Revenda / Blindadora / Situação da Comissão
  options?: string[];
  // Para Data da Venda
  filterYear?: number | null;
  filterMonth?: number | null;
  availableYears?: number[];
  onYearChange?: (y: number | null) => void;
  onMonthChange?: (m: number | null) => void;
  // Para Valor da Venda da Blindagem
  blindagemMode?: '' | 'com_valor' | 'vazia';
  onBlindagemModeChange?: (m: '' | 'com_valor' | 'vazia') => void;
}
function FilterCell({ col, value, onChange, options, filterYear, filterMonth, availableYears, onYearChange, onMonthChange, blindagemMode, onBlindagemModeChange }: FilterCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = value.length > 0;
  const hasQuickFilter = (filterYear != null) || (filterMonth != null);

  // ── Data da Venda: ano/mês + campo de texto ─────────────────────────────────
  if (col.key === 'dataVenda' && onYearChange && onMonthChange) {
    return (
      <div className="flex flex-col gap-1">
        {/* Selects rápidos de ano/mês */}
        <div className="flex gap-1">
          <select
            value={filterYear ?? ''}
            onChange={e => onYearChange(e.target.value ? Number(e.target.value) : null)}
            className={`flex-1 min-w-0 bg-white border rounded px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 ${
              filterYear != null ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'
            }`}
          >
            <option value="">Ano</option>
            {(availableYears ?? []).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={filterMonth ?? ''}
            onChange={e => onMonthChange(e.target.value ? Number(e.target.value) : null)}
            className={`flex-1 min-w-0 bg-white border rounded px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 ${
              filterMonth != null ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'
            }`}
          >
            <option value="">Mês</option>
            {MONTHS_PT.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          {(hasQuickFilter) && (
            <button onClick={() => { onYearChange(null); onMonthChange(null); }} className="flex-shrink-0 text-slate-300 hover:text-red-400 transition-colors" title="Limpar ano/mês">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        {/* Campo de texto livre */}
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
            value={value ? (() => { const p = value.split('/'); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : ''; })() : ''}
            defaultValue={todayISO()}
            onChange={e => { const [y, m, d] = e.target.value.split('-'); if (y && m && d) onChange(`${d}/${m}/${y}`); }}
            onClick={e => { if (!(e.currentTarget as HTMLInputElement).value) (e.currentTarget as HTMLInputElement).value = todayISO(); }}
            className="w-6 h-6 opacity-0 absolute pointer-events-none"
            id={`datepicker-${col.key}`}
          />
          <label
            htmlFor={`datepicker-${col.key}`}
            title="Selecionar data"
            className="flex-shrink-0 cursor-pointer text-slate-400 hover:text-amber-600 transition-colors"
            onClick={() => { const el = document.getElementById(`datepicker-${col.key}`) as HTMLInputElement | null; if (el) { if (!el.value) el.value = todayISO(); el.showPicker?.(); } }}
          >
            <Search className="w-3.5 h-3.5" />
          </label>
          {hasValue && (
            <button onClick={() => onChange('')} className="flex-shrink-0 text-slate-300 hover:text-red-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Date genérica (sem ano/mês) ──────────────────────────────────────────────
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

  // ── Valor da Venda da Blindagem: dropdown Com valor / Vazia ──────────────────
  if (col.key === 'valorVendaBlindagem' && onBlindagemModeChange !== undefined) {
    return (
      <div className="flex flex-col gap-1">
        <select
          value={blindagemMode ?? ''}
          onChange={e => onBlindagemModeChange(e.target.value as '' | 'com_valor' | 'vazia')}
          className={`w-full min-w-0 bg-white border rounded px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 ${
            blindagemMode ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'
          }`}
        >
          <option value="">Todas</option>
          <option value="com_valor">Com valor</option>
          <option value="vazia">Vazia</option>
        </select>
        <div className="relative flex items-center">
          <Search className="absolute left-1.5 w-3 h-3 text-slate-300 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Busca livre…"
            className={`w-full min-w-0 bg-white border rounded pl-5 pr-5 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-amber-400 ${
              hasValue ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'
            }`}
          />
          {hasValue && (
            <button onClick={() => onChange('')} className="absolute right-1.5 text-slate-300 hover:text-red-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Texto com dropdown de opções (Revenda / Blindadora / Situação Comissão) ──
  if (options && options.length > 0) {
    return (
      <div className="flex flex-col gap-1">
        {/* Dropdown rápido */}
        <select
          value={hasValue && options.includes(value) ? value : ''}
          onChange={e => onChange(e.target.value)}
          className={`w-full min-w-0 bg-white border rounded px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 ${
            hasValue && options.includes(value) ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'
          }`}
        >
          <option value="">Todas</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {/* Campo de texto livre */}
        <div className="relative flex items-center">
          <Search className="absolute left-1.5 w-3 h-3 text-slate-300 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Busca livre…"
            className={`w-full min-w-0 bg-white border rounded pl-5 pr-5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 ${
              hasValue ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'
            }`}
          />
          {hasValue && (
            <button onClick={() => onChange('')} className="absolute right-1.5 text-slate-300 hover:text-red-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Texto genérico ───────────────────────────────────────────────────────────
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
      className="w-full text-right bg-white border border-amber-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono tabular-nums"
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

// ─── Modal field helpers ──────────────────────────────────────────────────────
type ModalHighlight = 'green' | 'sky' | 'orange' | 'amber' | 'slate';
const MODAL_HL: Record<ModalHighlight, string> = {
  green:  'bg-emerald-50 text-emerald-800 font-semibold border-emerald-200',
  sky:    'bg-sky-50 text-sky-800 font-semibold border-sky-200',
  orange: 'bg-orange-50 text-orange-800 font-semibold border-orange-200',
  amber:  'bg-amber-50 text-amber-800 border-amber-200',
  slate:  'bg-slate-100 text-slate-500 border-slate-200',
};
function ModalReadonly({ label, value, highlight }: { label: string; value: string; highlight?: ModalHighlight }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <div className={`px-3 py-2 rounded-lg text-sm border font-mono tabular-nums ${highlight ? MODAL_HL[highlight] : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{value}</div>
    </div>
  );
}
function ModalInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white" />
    </div>
  );
}
function ModalInputCurrency({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const focused = useRef(false);
  const [display, setDisplay] = useState(() => {
    const n = parseFloat(value);
    return isNaN(n) ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });
  useEffect(() => {
    if (!focused.current) {
      const n = parseFloat(value);
      if (!isNaN(n)) setDisplay(n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      else if (!value) setDisplay('');
    }
  }, [value]);
  function handleChange(raw: string) {
    setDisplay(raw);
    const parsed = parseBrazilianNumber(raw);
    onChange(parsed);
  }
  function handleBlur() {
    focused.current = false;
    const n = parseFloat(parseBrazilianNumber(display));
    if (!isNaN(n)) setDisplay(n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    else setDisplay('');
  }
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input type="text" inputMode="decimal" value={display}
        onChange={e => handleChange(e.target.value)}
        onFocus={e => { focused.current = true; e.target.select(); }}
        onBlur={handleBlur}
        className="w-full px-3 py-2 rounded-lg text-sm border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white font-mono" />
    </div>
  );
}
function ModalInputDate({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input type="date" value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        className={`w-full px-3 py-2 rounded-lg text-sm border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'}`} />
    </div>
  );
}
function ModalSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white">
        <option value="">— Selecione —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function ModalSelectGrouped({ label, value, onChange, marcas, modelos }: { label: string; value: string; onChange: (v: string) => void; marcas: import('./catalogoStorage').MarcaVeiculo[]; modelos: import('./catalogoStorage').ModeloVeiculo[] }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white">
        <option value="">— Selecione —</option>
        {marcas.map(marca => (
          <optgroup key={marca.id} label={marca.nome}>
            {modelos.filter(m => m.marcaId === marca.id).map(m => (
              <option key={m.id} value={`${marca.nome} ${m.modelo}`}>{m.modelo}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
function ModalDatalist({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  const listId = `mdl-${label.replace(/\W/g, '')}`;
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input list={listId} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white" />
      <datalist id={listId}>{options.map(o => <option key={o} value={o} />)}</datalist>
    </div>
  );
}
function ModalSectionTitle({ num, color, children }: { num: number; color: string; children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
      <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${color}`}>{num}</span>
      {children}
    </h3>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
interface VendasBonificacoesDashboardProps {
  onChangeBrand: () => void;
  onOpenCadastros: () => void;
}

export function VendasBonificacoesDashboard({ onChangeBrand, onOpenCadastros }: VendasBonificacoesDashboardProps) {
  const [rows, setRows]           = useState<VendasRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<VendasRow | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [filters, setFilters]             = useState<FilterValues>({});
  const [filterYear, setFilterYear]         = useState<number | null>(null);
  const [filterMonth, setFilterMonth]       = useState<number | null>(null);
  const [filterBlindagemMode, setFilterBlindagemMode] = useState<'' | 'com_valor' | 'vazia'>('');
  const [catalogo, setCatalogo]     = useState<CatalogoVeiculos>({ marcas: [], modelos: [] });
  const [revendas, setRevendas]       = useState<Revenda[]>([]);
  const [blindadoras, setBlinadadoras] = useState<Blindadora[]>([]);
  const [regras, setRegras]           = useState<RegraRemuneracao[]>([]);
  const [vendedores, setVendedores]   = useState<Vendedor[]>([]);
  const [inlineNFId, setInlineNFId]   = useState<string | null>(null);
  const [inlineNFValue, setInlineNFValue] = useState('');
  const [inlineAcertoId, setInlineAcertoId] = useState<string | null>(null);
  const [inlineAcertoValue, setInlineAcertoValue] = useState('');
  const [activeTab, setActiveTab] = useState<'tabela' | 'analise'>('analise');
  const { canAccessVendasSub, isAdmin } = useAuth();
  const canTabela = isAdmin() || canAccessVendasSub('blindagem.tabela');
  const canAnalise = isAdmin() || canAccessVendasSub('blindagem.analise');
  const [importPreview, setImportPreview] = useState<VendasRow[] | null>(null);
  const [recalcConfirm, setRecalcConfirm] = useState(false);
  type RevendaFilter = 'Todas' | 'VW' | 'Audi';
  const [revendaFilter, setRevendaFilter] = useState<RevendaFilter>('Todas');
  const [modalDraft, setModalDraft] = useState<VendasRow | null>(null);
  const [unlockedRowId, setUnlockedRowId] = useState<string | null>(null);
  const [lockPendingRow, setLockPendingRow] = useState<VendasRow | null>(null);
  const [lockPassword, setLockPassword] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'tabela' && tableContainerRef.current) {
      // Aguarda o DOM renderizar antes de rolar
      requestAnimationFrame(() => {
        if (tableContainerRef.current)
          tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
      });
    }
  }, [activeTab]);

  useEffect(() => {
    Promise.all([loadVendasRows(), loadCatalogo(), loadRevendas(), loadBlinadadoras(), loadRegras(), loadVendedores()]).then(([r, c, rv, bl, rg, vd]) => {
      setRows(r);
      setCatalogo(c as CatalogoVeiculos);
      setRevendas(rv as Revenda[]);
      setBlinadadoras(bl as Blindadora[]);
      setRegras(rg as RegraRemuneracao[]);
      setVendedores(vd as Vendedor[]);
      setLoading(false);
    });
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

  const startEdit = (row: VendasRow, keepRemuneracoes = false) => {
    setDeleteId(null);
    setEditingId(row.id);
    const draft = { ...row };
    // Garante valor padrão para situacaoNegociacaoBlindadora
    if (!draft.situacaoNegociacaoBlindadora) draft.situacaoNegociacaoBlindadora = 'Negociação Direta';
    // Lucro da Operação = Valor da Venda - Custo (vazio se venda não informada)
    const venda = parseFloat(draft.valorVendaBlindagem) || 0;
    const custo = parseFloat(draft.custoBlindagem) || 0;
    draft.lucroOperacao = draft.valorVendaBlindagem ? String(venda - custo) : '';
    // Remunerações e Sorana: congeladas se NF já foi emitida ou se keepRemuneracoes (edição manual)
    if (!draft.numeroNFComissao && !keepRemuneracoes) {
      draft.remuneracaoVendedor  = calcRemuneracaoField(draft, 'Vendedor', regras, revendas);
      draft.remuneracaoGerencia  = calcRemuneracaoField(draft, 'Gerência', regras, revendas);
      draft.remuneracaoDiretoria = calcRemuneracaoField(draft, 'Diretoria', regras, revendas);
      draft.remuneracaoGerenciaSupervisorUsados = calcRemuneracaoField(draft, 'Supervisor de Usados', regras, revendas);
      draft.comissaoBrutaSorana = String(
        (parseFloat(draft.lucroOperacao) || 0)
        - (parseFloat(draft.remuneracaoVendedor) || 0)
        - (parseFloat(draft.remuneracaoGerencia) || 0)
        - (parseFloat(draft.remuneracaoDiretoria) || 0)
        - (parseFloat(draft.remuneracaoGerenciaSupervisorUsados) || 0)
      );
    }
    draft.situacaoComissao = calcSituacaoComissao(draft);
    // Local de Pgto: se Negociação Direta, preenche com o nome da blindadora
    if (draft.situacaoNegociacaoBlindadora === 'Negociação Direta') {
      draft.localPgtoBlindagem = draft.blindadora;
    }
    calcValoresPagamento(draft);
    setEditDraft(draft);
  };

  const cancelEdit = () => { setEditingId(null); setEditDraft(null); setUnlockedRowId(null); };

  const saveEdit = async () => {
    if (!editDraft) return;
    const updated = rows.map(r => r.id === editDraft.id ? editDraft : r);
    setRows(updated);
    setEditingId(null);
    setEditDraft(null);
    setUnlockedRowId(null);
    await persist(updated);
    toast.success('Linha salva com sucesso');
  };

  const handleUnlockConfirm = () => {
    if (lockPassword !== '1985') {
      toast.error('Senha incorreta');
      setLockPassword('');
      return;
    }
    if (!lockPendingRow) return;
    setUnlockedRowId(lockPendingRow.id);
    startEdit(lockPendingRow, true);
    setLockPendingRow(null);
    setLockPassword('');
  };

  const openModal = (row: VendasRow) => {
    const draft = { ...row };
    if (!draft.situacaoNegociacaoBlindadora) draft.situacaoNegociacaoBlindadora = 'Negociação Direta';
    const venda = parseFloat(draft.valorVendaBlindagem) || 0;
    const custo = parseFloat(draft.custoBlindagem) || 0;
    draft.lucroOperacao = draft.valorVendaBlindagem ? String(venda - custo) : '';
    if (!draft.numeroNFComissao) {
      draft.remuneracaoVendedor  = calcRemuneracaoField(draft, 'Vendedor', regras, revendas);
      draft.remuneracaoGerencia  = calcRemuneracaoField(draft, 'Gerência', regras, revendas);
      draft.remuneracaoDiretoria = calcRemuneracaoField(draft, 'Diretoria', regras, revendas);
      draft.remuneracaoGerenciaSupervisorUsados = calcRemuneracaoField(draft, 'Supervisor de Usados', regras, revendas);
      draft.comissaoBrutaSorana = String(
        (parseFloat(draft.lucroOperacao) || 0)
        - (parseFloat(draft.remuneracaoVendedor) || 0)
        - (parseFloat(draft.remuneracaoGerencia) || 0)
        - (parseFloat(draft.remuneracaoDiretoria) || 0)
        - (parseFloat(draft.remuneracaoGerenciaSupervisorUsados) || 0)
      );
    }
    draft.situacaoComissao = calcSituacaoComissao(draft);
    if (draft.situacaoNegociacaoBlindadora === 'Negociação Direta') draft.localPgtoBlindagem = draft.blindadora;
    calcValoresPagamento(draft);
    setModalDraft(draft);
  };

  const closeModal = () => setModalDraft(null);

  const changeModalField = (field: keyof VendasRow, value: string) =>
    setModalDraft(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      if (field === 'valorVendaBlindagem' || field === 'custoBlindagem') {
        const vendaStr = field === 'valorVendaBlindagem' ? value : prev.valorVendaBlindagem;
        const venda = parseFloat(vendaStr) || 0;
        const custo = parseFloat(field === 'custoBlindagem' ? value : prev.custoBlindagem) || 0;
        updated.lucroOperacao = vendaStr ? String(venda - custo) : '';
        if (!updated.numeroNFComissao) {
          updated.remuneracaoVendedor  = calcRemuneracaoField(updated, 'Vendedor',  regras, revendas);
          updated.remuneracaoGerencia  = calcRemuneracaoField(updated, 'Gerência',  regras, revendas);
          updated.remuneracaoDiretoria = calcRemuneracaoField(updated, 'Diretoria', regras, revendas);
          updated.remuneracaoGerenciaSupervisorUsados = calcRemuneracaoField(updated, 'Supervisor de Usados', regras, revendas);
          updated.comissaoBrutaSorana = String(
            (parseFloat(updated.lucroOperacao) || 0)
            - (parseFloat(updated.remuneracaoVendedor) || 0)
            - (parseFloat(updated.remuneracaoGerencia) || 0)
            - (parseFloat(updated.remuneracaoDiretoria) || 0)
            - (parseFloat(updated.remuneracaoGerenciaSupervisorUsados) || 0)
          );
        }
      }
      if (field === 'numeroNFComissao' || field === 'comissaoBrutaSorana' || field === 'valorVendaBlindagem' || field === 'custoBlindagem') {
        updated.situacaoComissao = calcSituacaoComissao(updated);
      }
      if (field === 'situacaoNegociacaoBlindadora' || field === 'blindadora') {
        updated.localPgtoBlindagem = updated.situacaoNegociacaoBlindadora === 'Negociação Direta' ? updated.blindadora : '';
      }
      if (field === 'situacaoNegociacaoBlindadora' || field === 'blindadora' || field === 'localPgtoBlindagem' || field === 'valorVendaBlindagem' || field === 'custoBlindagem') {
        calcValoresPagamento(updated);
      }
      return updated;
    });

  const saveModal = async () => {
    if (!modalDraft) return;
    // Se NF preenchida, garante situação correta
    const toSave: VendasRow = modalDraft.numeroNFComissao?.trim()
      ? { ...modalDraft, situacaoComissao: 'Nota de Intermediação Emitida' }
      : modalDraft;
    const updated = rows.map(r => r.id === toSave.id ? toSave : r);
    setRows(updated);
    setModalDraft(null);
    await persist(updated);
    toast.success('Registro salvo com sucesso');
  };

  const changeField = (field: keyof VendasRow, value: string) =>
    setEditDraft(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      if (field === 'valorVendaBlindagem' || field === 'custoBlindagem') {
        const vendaStr = field === 'valorVendaBlindagem' ? value : prev.valorVendaBlindagem;
        const venda = parseFloat(vendaStr) || 0;
        const custo = parseFloat(field === 'custoBlindagem' ? value : prev.custoBlindagem) || 0;
        updated.lucroOperacao = vendaStr ? String(venda - custo) : '';
        // Remunerações e Sorana: congeladas se NF já foi emitida
        if (!updated.numeroNFComissao) {
          updated.remuneracaoVendedor  = calcRemuneracaoField(updated, 'Vendedor',  regras, revendas);
          updated.remuneracaoGerencia  = calcRemuneracaoField(updated, 'Gerência',  regras, revendas);
          updated.remuneracaoDiretoria = calcRemuneracaoField(updated, 'Diretoria', regras, revendas);
          updated.remuneracaoGerenciaSupervisorUsados = calcRemuneracaoField(updated, 'Supervisor de Usados', regras, revendas);
          updated.comissaoBrutaSorana = String(
            (parseFloat(updated.lucroOperacao) || 0)
            - (parseFloat(updated.remuneracaoVendedor) || 0)
            - (parseFloat(updated.remuneracaoGerencia) || 0)
            - (parseFloat(updated.remuneracaoDiretoria) || 0)
            - (parseFloat(updated.remuneracaoGerenciaSupervisorUsados) || 0)
          );
        }
      }
      if (field === 'numeroNFComissao' || field === 'comissaoBrutaSorana' || field === 'valorVendaBlindagem' || field === 'custoBlindagem') {
        updated.situacaoComissao = calcSituacaoComissao(updated);
      }
      if (REMUNERACAO_KEYS.has(field)) {
        // Remuneração editada manualmente: recalcula Comissão Bruta em cascata
        updated.comissaoBrutaSorana = String(
          (parseFloat(updated.lucroOperacao) || 0)
          - (parseFloat(updated.remuneracaoVendedor) || 0)
          - (parseFloat(updated.remuneracaoGerencia) || 0)
          - (parseFloat(updated.remuneracaoDiretoria) || 0)
          - (parseFloat(updated.remuneracaoGerenciaSupervisorUsados) || 0)
        );
        updated.situacaoComissao = calcSituacaoComissao(updated);
      }
      if (field === 'situacaoNegociacaoBlindadora' || field === 'blindadora') {
        if (updated.situacaoNegociacaoBlindadora === 'Negociação Direta') {
          updated.localPgtoBlindagem = updated.blindadora;
        } else {
          // Ao mudar para Pagamento Antecipado, limpa para forçar seleção no dropdown
          updated.localPgtoBlindagem = '';
        }
      }
      if (field === 'situacaoNegociacaoBlindadora' || field === 'blindadora' || field === 'localPgtoBlindagem' || field === 'valorVendaBlindagem' || field === 'custoBlindagem') {
        calcValoresPagamento(updated);
      }
      return updated;
    });

  const saveInlineNF = async (rowId: string) => {
    const nf = inlineNFValue.trim();
    if (!nf) return;
    const updated = rows.map(r => {
      if (r.id !== rowId) return r;
      const next = { ...r, numeroNFComissao: nf };
      next.situacaoComissao = calcSituacaoComissao(next);
      return next;
    });
    setRows(updated);
    setInlineNFId(null);
    setInlineNFValue('');
    await persist(updated);
    toast.success('Nº NF salvo com sucesso');
  };

  const saveInlineAcerto = async (rowId: string) => {
    const dateVal = inlineAcertoValue;
    if (!dateVal) return;
    const updated = rows.map(r => r.id === rowId ? { ...r, dataAcerto: dateVal } : r);
    setRows(updated);
    setInlineAcertoId(null);
    setInlineAcertoValue('');
    await persist(updated);
    toast.success('Data de Acerto salva com sucesso');
  };

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

  const recalcularRemuneracoes = async () => {
    const updated = rows.map(row => {
      // Registros com NF emitida ficam congelados
      if (row.numeroNFComissao) return row;
      const draft = { ...row };
      const venda = parseFloat(draft.valorVendaBlindagem) || 0;
      const custo = parseFloat(draft.custoBlindagem) || 0;
      draft.lucroOperacao = draft.valorVendaBlindagem ? String(venda - custo) : '';
      draft.remuneracaoVendedor                 = calcRemuneracaoField(draft, 'Vendedor',            regras, revendas);
      draft.remuneracaoGerencia                 = calcRemuneracaoField(draft, 'Gerência',            regras, revendas);
      draft.remuneracaoDiretoria                = calcRemuneracaoField(draft, 'Diretoria',           regras, revendas);
      draft.remuneracaoGerenciaSupervisorUsados = calcRemuneracaoField(draft, 'Supervisor de Usados', regras, revendas);
      draft.comissaoBrutaSorana = String(
        (parseFloat(draft.lucroOperacao) || 0)
        - (parseFloat(draft.remuneracaoVendedor) || 0)
        - (parseFloat(draft.remuneracaoGerencia) || 0)
        - (parseFloat(draft.remuneracaoDiretoria) || 0)
        - (parseFloat(draft.remuneracaoGerenciaSupervisorUsados) || 0)
      );
      draft.situacaoComissao = calcSituacaoComissao(draft);
      return draft;
    });
    setRows(updated);
    setRecalcConfirm(false);
    await persist(updated);
    const qtd = updated.filter(r => !r.numeroNFComissao).length;
    toast.success(`Remunerações recalculadas em ${qtd} ${qtd === 1 ? 'registro' : 'registros'} (sem NF emitida)`);
  };

  const setFilter = (key: keyof VendasRow, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const clearFilters = () => { setFilters({}); setFilterYear(null); setFilterMonth(null); setFilterBlindagemMode(''); };

  // ── Import Excel ──────────────────────────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { cellDates: true });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { toast.error('Planilha não encontrada no arquivo.'); return; }

      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

      // Row 0 = título mesclado, Row 1 = cabeçalhos, Row 2+ = dados, última = total
      const dataRaws = (raw as unknown[][]).slice(2).filter(row => {
        const first = String(row[0] ?? '').trim();
        const hasData = row.some(c => c !== '' && c !== null && c !== undefined);
        return hasData && first !== 'TOTAL';
      });

      if (dataRaws.length === 0) { toast.error('Nenhum dado encontrado no arquivo.'); return; }

      const str = (v: unknown): string => {
        if (v === null || v === undefined || v === '') return '';
        return String(v).trim();
      };
      const cur = (v: unknown): string => {
        if (v === null || v === undefined || v === '') return '';
        const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.,-]/g, '').replace(',', '.'));
        return isNaN(n) ? '' : String(n);
      };
      const dat = (v: unknown): string => {
        if (!v) return '';
        if (v instanceof Date) {
          const y = v.getFullYear();
          const m = String(v.getMonth() + 1).padStart(2, '0');
          const d = String(v.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
        const s = String(v).trim();
        // DD/MM/YYYY
        const parts = s.split('/');
        if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        // YYYY-MM-DD passthrough
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        return '';
      };

      // Mapeamento de colunas conforme COLUMNS (índice 0..23):
      // 0:veiculo 1:chassi 2:revenda 3:blindadora 4:custoBlindagem
      // 5:dataPagamentoBlindadora 6:situacaoNegociacaoBlindadora 7:dataVenda
      // 8:valorVendaBlindagem 9:lucroOperacao(calc) 10:%lucro(calc)
      // 11:localPgtoBlindagem 12:nomeVendedor
      // 13:remVendedor(calc) 14:remGerencia(calc) 15:remDiretoria(calc) 16:remSupervisor(calc)
      // 17:comissaoBruta(calc) 18:%rentabilidade(calc)
      // 19:numeroNFComissao 20:situacaoComissao(calc) 21:valorAPagar(calc) 22:valorAReceber(calc) 23:dataAcerto
      const imported: VendasRow[] = dataRaws.map(row => {
        const draft: VendasRow = {
          id: crypto.randomUUID(),
          veiculo:                             str(row[0]),
          chassi:                              str(row[1]),
          revenda:                             str(row[2]),
          blindadora:                          str(row[3]),
          custoBlindagem:                      cur(row[4]),
          dataPagamentoBlindadora:             dat(row[5]),
          situacaoNegociacaoBlindadora:        str(row[6]) || 'Negociação Direta',
          dataVenda:                           dat(row[7]),
          valorVendaBlindagem:                 cur(row[8]),
          lucroOperacao:                       '',
          localPgtoBlindagem:                  str(row[11]),
          nomeVendedor:                        str(row[12]),
          remuneracaoVendedor:                 '',
          remuneracaoGerencia:                 '',
          remuneracaoDiretoria:                '',
          remuneracaoGerenciaSupervisorUsados: '',
          comissaoBrutaSorana:                 '',
          numeroNFComissao:                    str(row[19]),
          situacaoComissao:                    '',
          valorAPagarBlindadora:               '',
          valorAReceberBlindadora:             '',
          dataAcerto:                          dat(row[23]),
        };

        // Recalcular tudo do zero
        const venda = parseFloat(draft.valorVendaBlindagem) || 0;
        const custo = parseFloat(draft.custoBlindagem) || 0;
        draft.lucroOperacao = draft.valorVendaBlindagem ? String(venda - custo) : '';
        draft.remuneracaoVendedor                 = calcRemuneracaoField(draft, 'Vendedor',            regras, revendas);
        draft.remuneracaoGerencia                 = calcRemuneracaoField(draft, 'Gerência',            regras, revendas);
        draft.remuneracaoDiretoria                = calcRemuneracaoField(draft, 'Diretoria',           regras, revendas);
        draft.remuneracaoGerenciaSupervisorUsados = calcRemuneracaoField(draft, 'Supervisor de Usados', regras, revendas);
        draft.comissaoBrutaSorana = String(
          (parseFloat(draft.lucroOperacao) || 0)
          - (parseFloat(draft.remuneracaoVendedor) || 0)
          - (parseFloat(draft.remuneracaoGerencia) || 0)
          - (parseFloat(draft.remuneracaoDiretoria) || 0)
          - (parseFloat(draft.remuneracaoGerenciaSupervisorUsados) || 0)
        );
        draft.situacaoComissao = calcSituacaoComissao(draft);
        if (draft.situacaoNegociacaoBlindadora === 'Negociação Direta') {
          draft.localPgtoBlindagem = draft.blindadora;
        }
        calcValoresPagamento(draft);
        return draft;
      }).filter(r => r.veiculo || r.chassi || r.revenda || r.blindadora);

      setImportPreview(imported);
    } catch {
      toast.error('Erro ao ler o arquivo. Verifique se é um Excel válido exportado por esta tela.');
    }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setRows(importPreview);
    setImportPreview(null);
    await persist(importPreview);
    toast.success(`${importPreview.length} ${importPreview.length === 1 ? 'registro importado' : 'registros importados'} com sucesso`);
  };

  const availableRevendas          = useMemo(() => [...new Set(rows.map(r => r.revenda).filter(Boolean))].sort() as string[], [rows]);
  const availableBlindadoras        = useMemo(() => [...new Set(rows.map(r => r.blindadora).filter(Boolean))].sort() as string[], [rows]);
  const availableSituacoesComissao  = useMemo(() => [...new Set(rows.map(r => r.situacaoComissao).filter(Boolean))].sort() as string[], [rows]);
  const availableYears              = useMemo(() => [...new Set(rows.map(r => r.dataVenda?.split('-')[0]).filter(Boolean))].map(Number).sort((a,b)=>b-a), [rows]);

  const hasActiveFilters = Object.values(filters).some(v => v && v.length > 0) || filterYear != null || filterMonth != null || !!filterBlindagemMode;
  const revendaBaseRows = revendaFilter === 'VW'
    ? rows.filter(r => r.revenda.toLowerCase().includes('vw'))
    : revendaFilter === 'Audi'
      ? rows.filter(r => r.revenda.toLowerCase().includes('audi'))
      : rows;
  const filteredRows     = hasActiveFilters
    ? revendaBaseRows.filter(r => {
        if (!rowMatchesFilters(r, filters)) return false;
        if (filterYear != null) {
          const y = r.dataVenda ? parseInt(r.dataVenda.split('-')[0]) : 0;
          if (y !== filterYear) return false;
        }
        if (filterMonth != null) {
          const m = r.dataVenda ? parseInt(r.dataVenda.split('-')[1]) : 0;
          if (m !== filterMonth) return false;
        }
        if (filterBlindagemMode === 'com_valor') {
          if (!r.valorVendaBlindagem || !parseFloat(r.valorVendaBlindagem)) return false;
        }
        if (filterBlindagemMode === 'vazia') {
          if (r.valorVendaBlindagem && parseFloat(r.valorVendaBlindagem)) return false;
        }
        return true;
      })
    : revendaBaseRows;

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
                Análise e Controle das Vendas de Blindagem
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
            {hasActiveFilters && activeTab === 'tabela' && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs text-amber-100 border border-amber-400/50 bg-amber-700/40 hover:bg-amber-700/70 rounded-md px-2.5 py-1 transition-colors"
              >
                <FilterX className="w-3.5 h-3.5" />
                Limpar filtros
              </button>
            )}
            {/* Abas */}
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 gap-0.5">
              {canTabela && (
              <button
                onClick={() => setActiveTab('tabela')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === 'tabela'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <TableProperties className="w-3.5 h-3.5" />
                Tabela
              </button>
              )}
              {canAnalise && (
              <button
                onClick={() => setActiveTab('analise')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === 'analise'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Análise
              </button>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenCadastros}
              className="text-white border border-white/30 hover:bg-white/15 gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Cadastro
            </Button>
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
      <div className="flex-1 flex flex-col min-h-0">

        {/* ── ABA ANÁLISE ── */}
        {activeTab === 'analise' && canAnalise && (
          <div className="flex-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 72px)' }}>
            <VendasAnalise
              rows={rows}
              onUpdateRow={async (updated) => {
                const next = rows.map(r => r.id === updated.id ? updated : r);
                setRows(next);
                await persist(next);
              }}
            />
          </div>
        )}

        {/* ── ABA TABELA ── */}
        {activeTab === 'tabela' && canTabela && (
        <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
        {/* Table card */}
        <div
          ref={tableContainerRef}
          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto flex-1"
          style={{ maxHeight: 'calc(100vh - 180px)' }}
        >
          <table className="border-collapse text-sm" style={{ width: 'max-content', minWidth: '100%' }}>
            <colgroup>
              <col style={{ width: 56, minWidth: 56 }} />
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
                {COLUMNS.map((col, ci) => (
                  <th
                    key={`h-${col.key}-${ci}`}
                    className="sticky top-0 z-30 text-white text-xs font-semibold px-3 py-3 border-r border-gray-600 align-top leading-snug text-center"
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
                {COLUMNS.map((col, ci) => (
                  <th
                    key={`f-${col.key}-${ci}`}
                    className="sticky z-30 bg-slate-50 border-r border-b border-slate-200 px-1.5 py-1.5"
                    style={{ top: 'var(--header-height, 44px)' }}
                  >
                    {col.type !== 'calc' && (
                      <FilterCell
                        col={col}
                        value={filters[col.key] ?? ''}
                        onChange={v => setFilter(col.key, v)}
                        options={col.key === 'revenda' ? availableRevendas : col.key === 'blindadora' ? availableBlindadoras : col.key === 'situacaoComissao' ? availableSituacoesComissao : undefined}
                        filterYear={col.key === 'dataVenda' ? filterYear : undefined}
                        filterMonth={col.key === 'dataVenda' ? filterMonth : undefined}
                        availableYears={col.key === 'dataVenda' ? availableYears : undefined}
                        onYearChange={col.key === 'dataVenda' ? setFilterYear : undefined}
                        onMonthChange={col.key === 'dataVenda' ? setFilterMonth : undefined}
                        blindagemMode={col.key === 'valorVendaBlindagem' ? filterBlindagemMode : undefined}
                        onBlindagemModeChange={col.key === 'valorVendaBlindagem' ? setFilterBlindagemMode : undefined}
                      />
                    )}
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

                      {/* Row number + open modal button */}
                      <td
                        className="sticky left-0 z-20 text-center border-r border-slate-200 px-1 py-1"
                        style={{ background: rowBg, minWidth: '52px' }}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => openModal(row)}
                            className="w-6 h-6 rounded-md bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95 flex items-center justify-center text-sm font-bold leading-none transition-all shadow-sm"
                            title="Abrir formulário completo de edição"
                          >+</button>
                          <span className="text-xs text-slate-400 font-mono">{realIdx + 1}</span>
                        </div>
                      </td>

                      {/* Data cells */}
                      {COLUMNS.map((col, ci) => {
                        const val = (draft as VendasRow)[col.key] as string;
                        const isRight = col.type === 'currency' || col.type === 'calc';
                        if (col.type === 'calc') {
                          const displayed = col.calc ? col.calc(row) : '';
                          const calcHighlight = displayed && RESULTADO_KEYS.has(col.key)
                            ? 'bg-emerald-50 text-emerald-800 font-semibold'
                            : 'text-slate-500 bg-slate-50/60';
                          return (
                            <td
                              key={`${col.key}-calc-${ci}`}
                              className={`border-r border-slate-100 px-2 py-2.5 text-sm text-right font-mono tabular-nums ${calcHighlight}`}
                              style={{ verticalAlign: 'middle' }}
                            >
                              {displayed || <span className="text-slate-300 select-none">—</span>}
                            </td>
                          );
                        }
                        const isBlindadoraPagoCol = BLINDADORA_PAGTO_KEYS.has(col.key);
                        const rowHasAcerto = !!row.dataAcerto;
                        const cellHighlight = val && RESULTADO_KEYS.has(col.key)
                          ? 'bg-emerald-50 text-emerald-800 font-semibold'
                          : val && REMUNERACAO_KEYS.has(col.key)
                          ? 'bg-sky-50 text-sky-800 font-semibold'
                          : val && isBlindadoraPagoCol && rowHasAcerto
                          ? 'bg-emerald-100 text-emerald-800 font-bold ring-1 ring-emerald-300'
                          : val && isBlindadoraPagoCol
                          ? 'bg-orange-100 text-orange-900 font-bold ring-1 ring-orange-300'
                          : col.key === 'situacaoComissao' && val === 'Emitir Nota de Intermediação'
                          ? 'bg-amber-50 text-amber-800'
                          : col.key === 'situacaoComissao' && val === 'Nota de Intermediação Emitida'
                          ? 'text-slate-500'
                          : 'text-slate-700';
                        return (
                          <td
                            key={`${col.key}-${ci}`}
                            className={`border-r border-slate-100 px-2 py-2.5 text-sm ${isRight ? 'text-right' : 'text-left'} ${cellHighlight}`}
                            style={{ verticalAlign: 'middle' }}
                          >
                            {isEditing ? (
                              CALC_READONLY_KEYS.has(col.key) && !(REMUNERACAO_KEYS.has(col.key) && unlockedRowId === row.id) ? (
                                // Campo calculado automaticamente: exibe somente leitura
                                <span className={`italic text-sm font-mono tabular-nums ${
                                  val && RESULTADO_KEYS.has(col.key)         ? 'text-emerald-700 font-semibold' :
                                  val && REMUNERACAO_KEYS.has(col.key)       ? 'text-sky-700 font-semibold' :
                                  val && BLINDADORA_PAGTO_KEYS.has(col.key)  ? 'text-orange-800 font-bold not-italic' :
                                  col.key === 'situacaoComissao' && val === 'Emitir Nota de Intermediação' ? 'text-amber-700 font-bold not-italic' :
                                  col.key === 'situacaoComissao' && val === 'Nota de Intermediação Emitida' ? 'text-slate-500 not-italic' :
                                  'text-slate-400'
                                }`}>
                                  {col.type === 'currency' ? fmtCurrency(val) : val || '—'}
                                </span>
                              ) : col.type === 'currency' ? (
                                <CurrencyCell value={val} onChange={v => changeField(col.key, v)} />
                              ) : col.type === 'date' ? (
                                <input
                                  type="date"
                                  value={val}
                                  disabled={
                                    (col.key === 'dataAcerto' && !draft.valorAPagarBlindadora && !draft.valorAReceberBlindadora) ||
                                    (col.key === 'dataPagamentoBlindadora' && draft.situacaoNegociacaoBlindadora === 'Negociação Direta')
                                  }
                                  onChange={e => changeField(col.key, e.target.value)}
                                  title={
                                    col.key === 'dataAcerto' && !draft.valorAPagarBlindadora && !draft.valorAReceberBlindadora
                                      ? 'Preencha Valor a Pagar ou Valor a Receber da Blindadora primeiro'
                                      : col.key === 'dataPagamentoBlindadora' && draft.situacaoNegociacaoBlindadora === 'Negociação Direta'
                                      ? 'Indisponível para Negociação Direta'
                                      : undefined
                                  }
                                  className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 ${
                                    (col.key === 'dataAcerto' && !draft.valorAPagarBlindadora && !draft.valorAReceberBlindadora) ||
                                    (col.key === 'dataPagamentoBlindadora' && draft.situacaoNegociacaoBlindadora === 'Negociação Direta')
                                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                      : 'bg-white border-amber-300 focus:ring-amber-400'
                                  }`}
                                />
                              ) : col.key === 'nomeVendedor' && vendedores.length > 0 ? (
                                <select
                                  value={val}
                                  onChange={e => changeField(col.key, e.target.value)}
                                  className="w-full bg-white border border-amber-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                  <option value="">— Selecione —</option>
                                  {vendedores.map(v => (
                                    <option key={v.id} value={v.nome}>{v.nome}</option>
                                  ))}
                                </select>
                              ) : col.key === 'veiculo' && catalogo.modelos.length > 0 ? (
                                <select
                                  value={val}
                                  onChange={e => changeField(col.key, e.target.value)}
                                  className="w-full bg-white border border-amber-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                  <option value="">— Selecione —</option>
                                  {catalogo.marcas.map(marca => (
                                    <optgroup key={marca.id} label={marca.nome}>
                                      {catalogo.modelos
                                        .filter(m => m.marcaId === marca.id)
                                        .map(m => (
                                          <option key={m.id} value={`${marca.nome} ${m.modelo}`}>
                                            {m.modelo}
                                          </option>
                                        ))}
                                    </optgroup>
                                  ))}
                                </select>
                              ) : col.key === 'revenda' && revendas.length > 0 ? (
                                <select
                                  value={val}
                                  onChange={e => changeField(col.key, e.target.value)}
                                  className="w-full bg-white border border-amber-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                  <option value="">— Selecione —</option>
                                  {revendas.map(r => (
                                    <option key={r.id} value={r.nome}>{r.nome}</option>
                                  ))}
                                </select>
                              ) : col.key === 'localPgtoBlindagem' ? (
                                editDraft!.situacaoNegociacaoBlindadora === 'Negociação Direta' ? (
                                  <span className="text-slate-500 italic text-sm">
                                    {editDraft!.blindadora || <span className="text-slate-300">—</span>}
                                  </span>
                                ) : (
                                  <select
                                    value={val}
                                    onChange={e => changeField(col.key, e.target.value)}
                                    className="w-full bg-white border border-amber-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                  >
                                    <option value="">— Selecione —</option>
                                    <option value="Sorana">Sorana</option>
                                    {editDraft!.blindadora && (
                                      <option value={editDraft!.blindadora}>{editDraft!.blindadora}</option>
                                    )}
                                  </select>
                                )
                              ) : col.key === 'situacaoNegociacaoBlindadora' ? (
                                <select
                                  value={val || 'Negociação Direta'}
                                  onChange={e => changeField(col.key, e.target.value)}
                                  className="w-full bg-white border border-amber-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                  <option value="Negociação Direta">Negociação Direta</option>
                                  <option value="Pagamento Antecipado p/ Blindadora">Pagamento Antecipado p/ Blindadora</option>
                                </select>
                              ) : col.key === 'blindadora' && blindadoras.length > 0 ? (
                                <select
                                  value={val}
                                  onChange={e => changeField(col.key, e.target.value)}
                                  className="w-full bg-white border border-amber-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                  <option value="">— Selecione —</option>
                                  {blindadoras.map(b => (
                                    <option key={b.id} value={b.nome}>{b.nome}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={val}
                                  onChange={e => changeField(col.key, e.target.value)}
                                  className="w-full bg-white border border-amber-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                  placeholder="—"
                                />
                              )
                            ) : (
                              col.type === 'currency' && isBlindadoraPagoCol && rowHasAcerto && val ? (
                                <span className="font-bold text-emerald-700">Concluído</span>
                              ) : col.type === 'currency' && col.key === 'lucroOperacao' && !row.valorVendaBlindagem ? (
                                <span className="text-slate-300 select-none">—</span>
                              ) : col.type === 'currency' ? (
                                <span className="font-mono tabular-nums">{fmtCurrency(val)}</span>
                              ) : col.key === 'dataAcerto' && !isEditing && (row.valorAPagarBlindadora || row.valorAReceberBlindadora) ? (
                                // Quick-edit inline: Data de Acerto editável direto na célula quando habilitada
                                <div className="flex items-center gap-1">
                                  <input
                                    type="date"
                                    value={inlineAcertoId === row.id ? inlineAcertoValue : (val || '')}
                                    onFocus={() => { setInlineAcertoId(row.id); setInlineAcertoValue(val || ''); }}
                                    onChange={e => { setInlineAcertoId(row.id); setInlineAcertoValue(e.target.value); }}
                                    onKeyDown={e => { if (e.key === 'Enter') saveInlineAcerto(row.id); if (e.key === 'Escape') { setInlineAcertoId(null); setInlineAcertoValue(''); } }}
                                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                                  />
                                  {inlineAcertoId === row.id && inlineAcertoValue && inlineAcertoValue !== val && (
                                    <button
                                      onClick={() => saveInlineAcerto(row.id)}
                                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors"
                                      title="Salvar Data de Acerto"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ) : col.type === 'date' ? (
                                <span>{fmtDate(val)}</span>
                              ) : col.key === 'numeroNFComissao' && !val ? (
                                // Quick-edit inline: célula vazia permite digitar sem abrir modo edição
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={inlineNFId === row.id ? inlineNFValue : ''}
                                    onFocus={() => { setInlineNFId(row.id); setInlineNFValue(''); }}
                                    onChange={e => { setInlineNFId(row.id); setInlineNFValue(e.target.value); }}
                                    onKeyDown={e => { if (e.key === 'Enter') saveInlineNF(row.id); if (e.key === 'Escape') { setInlineNFId(null); setInlineNFValue(''); } }}
                                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                                    placeholder="Digitar Nº NF…"
                                  />
                                  {inlineNFId === row.id && inlineNFValue.trim() && (
                                    <button
                                      onClick={() => saveInlineNF(row.id)}
                                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors"
                                      title="Salvar Nº NF"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                val
                                  ? col.key === 'situacaoComissao' && val === 'Emitir Nota de Intermediação'
                                    ? <span className="font-bold text-amber-700">{val}</span>
                                    : <span>{val}</span>
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
                            {unlockedRowId === row.id && (
                              <span title="Remunerações desbloqueadas para edição manual" className="text-sky-500 flex-shrink-0">
                                <LockOpen className="w-3.5 h-3.5" />
                              </span>
                            )}
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
                              onClick={() => { setLockPendingRow(row); setLockPassword(''); }}
                              title="Editar remunerações manualmente (requer senha)"
                              className="p-1.5 rounded-md text-sky-500 hover:bg-sky-50 transition-colors"
                            >
                              <Lock className="w-3.5 h-3.5" />
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportTabelaExcel(filteredRows)}
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1.5 font-medium"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
              className="text-blue-700 border-blue-300 hover:bg-blue-50 gap-1.5 font-medium"
            >
              <Upload className="w-4 h-4" />
              Importar Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRecalcConfirm(true)}
              className="text-violet-700 border-violet-300 hover:bg-violet-50 gap-1.5 font-medium"
              title="Recalcula remunerações com as regras atuais. Registros com NF emitida não são alterados."
            >
              <RefreshCw className="w-4 h-4" />
              Recalcular Remunerações
            </Button>
            {/* Filtro Revenda */}
            {(() => {
              const canTodas      = isAdmin() || canAccessVendasSub('blindagem.todas');
              const canRevendaVW   = isAdmin() || canAccessVendasSub('blindagem.revenda_vw');
              const canRevendaAudi = isAdmin() || canAccessVendasSub('blindagem.revenda_audi');
              const revendaCounts = {
                todas: rows.length,
                vw: rows.filter(r => r.revenda.toLowerCase().includes('vw')).length,
                audi: rows.filter(r => r.revenda.toLowerCase().includes('audi')).length,
              };
              const allOpts: { value: RevendaFilter; label: string; color: string; count: number; allowed: boolean }[] = [
                { value: 'Todas', label: 'Todas',       color: '#f59e0b', count: revendaCounts.todas, allowed: canTodas },
                { value: 'VW',    label: 'Revenda VW',  color: '#001E50', count: revendaCounts.vw,   allowed: canRevendaVW },
                { value: 'Audi',  label: 'Revenda Audi',color: '#BB0A21', count: revendaCounts.audi, allowed: canRevendaAudi },
              ];
              const opts = allOpts.filter(o => o.allowed);
              if (opts.length === 0) return null;
              return (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Visualizar por</span>
                  <div className="inline-flex bg-white/10 rounded-xl p-0.5 gap-0.5">
                    {opts.map(opt => {
                      const active = revendaFilter === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setRevendaFilter(opt.value)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                          style={active ? { background: opt.color, color: '#fff', boxShadow: `0 2px 8px ${opt.color}66` } : { color: 'rgba(255,255,255,0.7)' }}
                        >
                          <span>{opt.label}</span>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full font-bold tabular-nums"
                            style={active ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#fff' } : { backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
                          >
                            {opt.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportFile}
            />
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
        )}

      </div>

      {/* ── Modal de confirmação de recálculo ── */}
      {recalcConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-violet-100 rounded-xl flex-shrink-0">
                <RefreshCw className="w-5 h-5 text-violet-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Recalcular Remunerações</h3>
                <p className="text-sm text-slate-500 mt-1">Aplica as regras de remuneração atuais a todos os registros.</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Registros que serão recalculados:</span>
                <span className="font-bold text-violet-700">{rows.filter(r => !r.numeroNFComissao).length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Registros congelados (Nº NF emitida):</span>
                <span className="font-bold text-slate-500">{rows.filter(r => !!r.numeroNFComissao).length}</span>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Os campos <strong>Remuneração Gerência / Supervisor</strong>, demais remunerações e
              a <strong>Comissão Bruta Sorana</strong> serão atualizados conforme as regras
              cadastradas atualmente. Registros com Nº NF preenchido não serão alterados.
            </p>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRecalcConfirm(false)}
                className="border-slate-300 text-slate-600"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={recalcularRemuneracoes}
                className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                Confirmar Recálculo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de confirmação de importação ── */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-blue-100 rounded-xl flex-shrink-0">
                <Upload className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Confirmar Importação</h3>
                <p className="text-sm text-slate-500 mt-1">Esta ação é irreversível.</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Registros no arquivo:</span>
                <span className="font-bold text-blue-700">{importPreview.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Registros atuais (serão substituídos):</span>
                <span className="font-bold text-red-600">{rows.length}</span>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Todos os <strong>{rows.length}</strong> registros existentes serão apagados e
              substituídos pelos <strong>{importPreview.length}</strong> do arquivo.
              Os campos calculados serão recalculados pelas regras atuais.
            </p>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportPreview(null)}
                className="border-slate-300 text-slate-600"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={confirmImport}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                <Check className="w-4 h-4" />
                Confirmar Importação
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de senha para edição manual de remunerações ── */}
      {lockPendingRow && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-sky-100 rounded-xl flex-shrink-0">
                <Lock className="w-5 h-5 text-sky-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Editar Remunerações</h3>
                <p className="text-sm text-slate-500 mt-1">Digite a senha para liberar a edição manual das remunerações desta linha.</p>
              </div>
            </div>
            <input
              type="password"
              value={lockPassword}
              autoFocus
              autoComplete="off"
              onChange={e => setLockPassword(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleUnlockConfirm();
                if (e.key === 'Escape') { setLockPendingRow(null); setLockPassword(''); }
              }}
              placeholder="Senha"
              className="w-full px-3 py-2 rounded-lg text-sm border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400"
            />
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setLockPendingRow(null); setLockPassword(''); }}
                className="border-slate-300 text-slate-600"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleUnlockConfirm}
                className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5"
              >
                <LockOpen className="w-4 h-4" />
                Desbloquear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE EDIÇÃO COMPLETA ── */}
      {modalDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50 rounded-t-xl shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-800">Editar Registro</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {modalDraft.veiculo || '—'} &bull; Chassi: <span className="font-mono">{modalDraft.chassi || '—'}</span>
                </p>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-6 overflow-y-auto">

              {/* Seção 1: Identificação */}
              <section>
                <ModalSectionTitle num={1} color="bg-indigo-100 text-indigo-600">Identificação do Veículo</ModalSectionTitle>
                <div className="grid grid-cols-2 gap-4">
                  {catalogo.modelos.length > 0 ? (
                    <ModalSelectGrouped label="Veículo" value={modalDraft.veiculo} onChange={v => changeModalField('veiculo', v)} marcas={catalogo.marcas} modelos={catalogo.modelos} />
                  ) : (
                    <ModalInput label="Veículo" value={modalDraft.veiculo} onChange={v => changeModalField('veiculo', v)} />
                  )}
                  <ModalInput label="Chassi" value={modalDraft.chassi} onChange={v => changeModalField('chassi', v)} />
                  <ModalSelect label="Revenda" value={modalDraft.revenda} onChange={v => changeModalField('revenda', v)} options={availableRevendas} />
                  <ModalSelect label="Blindadora" value={modalDraft.blindadora} onChange={v => changeModalField('blindadora', v)} options={availableBlindadoras} />
                </div>
              </section>

              {/* Seção 2: Negociação com Blindadora */}
              <section>
                <ModalSectionTitle num={2} color="bg-amber-100 text-amber-600">Negociação com Blindadora</ModalSectionTitle>
                <div className="grid grid-cols-2 gap-4">
                  <ModalSelect
                    label="Situação da Negociação"
                    value={modalDraft.situacaoNegociacaoBlindadora}
                    onChange={v => changeModalField('situacaoNegociacaoBlindadora', v)}
                    options={['Negociação Direta', 'Pagamento Antecipado p/ Blindadora']}
                  />
                  <ModalInputCurrency label="Custo da Blindagem (R$)" value={modalDraft.custoBlindagem} onChange={v => changeModalField('custoBlindagem', v)} />
                  <ModalInputDate label="Data do Pagamento Blindadora" value={modalDraft.dataPagamentoBlindadora} onChange={v => changeModalField('dataPagamentoBlindadora', v)} disabled={modalDraft.situacaoNegociacaoBlindadora === 'Negociação Direta'} />
                  {modalDraft.situacaoNegociacaoBlindadora === 'Negociação Direta' ? (
                    <ModalReadonly label="Local de Pgto Blindagem" value={modalDraft.localPgtoBlindagem || '—'} />
                  ) : (
                    <ModalSelect
                      label="Local de Pgto Blindagem"
                      value={modalDraft.localPgtoBlindagem}
                      onChange={v => changeModalField('localPgtoBlindagem', v)}
                      options={['Sorana', ...availableBlindadoras]}
                    />
                  )}
                  {!!modalDraft.valorAPagarBlindadora && (
                    <ModalReadonly label="Valor a Pagar p/ Blindadora" value={fmtCurrency(modalDraft.valorAPagarBlindadora)} highlight="orange" />
                  )}
                  {!!modalDraft.valorAReceberBlindadora && (
                    <ModalReadonly label="Valor a Receber da Blindadora" value={fmtCurrency(modalDraft.valorAReceberBlindadora)} highlight="orange" />
                  )}
                </div>
              </section>

              {/* Seção 3: Venda */}
              <section>
                <ModalSectionTitle num={3} color="bg-emerald-100 text-emerald-600">Venda</ModalSectionTitle>
                <div className="grid grid-cols-2 gap-4">
                  <ModalInputDate label="Data da Venda" value={modalDraft.dataVenda} onChange={v => changeModalField('dataVenda', v)} />
                  <ModalInputCurrency label="Valor da Venda da Blindagem (R$)" value={modalDraft.valorVendaBlindagem} onChange={v => changeModalField('valorVendaBlindagem', v)} />
                </div>
                {!!modalDraft.lucroOperacao && (
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <ModalReadonly label="Lucro da Operação" value={fmtCurrency(modalDraft.lucroOperacao)} highlight="green" />
                    <ModalReadonly
                      label="% Lucro da Operação"
                      highlight="green"
                      value={(() => {
                        const venda = parseFloat(modalDraft.valorVendaBlindagem);
                        const lucro = parseFloat(modalDraft.lucroOperacao);
                        if (!venda || isNaN(lucro)) return '—';
                        return (lucro / venda * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
                      })()}
                    />
                  </div>
                )}
              </section>

              {/* Seção 4: Remunerações */}
              <section>
                <ModalSectionTitle num={4} color="bg-sky-100 text-sky-600">Remunerações (calculadas automaticamente)</ModalSectionTitle>
                <div className="grid grid-cols-2 gap-4">
                  <ModalReadonly label="Remuneração Vendedor" value={fmtCurrency(modalDraft.remuneracaoVendedor)} highlight="sky" />
                  <ModalReadonly label="Remuneração Gerência" value={fmtCurrency(modalDraft.remuneracaoGerencia)} highlight="sky" />
                  <ModalReadonly label="Remuneração Diretoria Comercial" value={fmtCurrency(modalDraft.remuneracaoDiretoria)} highlight="sky" />
                  <ModalReadonly label="Remuneração Gerência / Supervisor de Usados" value={fmtCurrency(modalDraft.remuneracaoGerenciaSupervisorUsados)} highlight="sky" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <ModalReadonly label="Comissão Bruta Sorana" value={fmtCurrency(modalDraft.comissaoBrutaSorana)} highlight="green" />
                  <ModalReadonly
                    label="% Rentabilidade Bruta Sorana"
                    highlight="green"
                    value={(() => {
                      const venda = parseFloat(modalDraft.valorVendaBlindagem);
                      const comissao = parseFloat(modalDraft.comissaoBrutaSorana);
                      if (!venda || isNaN(comissao)) return '—';
                      return (comissao / venda * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
                    })()}
                  />
                </div>
              </section>

              {/* Seção 5: Faturamento */}
              <section>
                <ModalSectionTitle num={5} color="bg-violet-100 text-violet-600">Faturamento</ModalSectionTitle>
                <div className="grid grid-cols-2 gap-4">
                  <ModalDatalist
                    label="Nome do Vendedor"
                    value={modalDraft.nomeVendedor}
                    onChange={v => changeModalField('nomeVendedor', v)}
                    options={vendedores.map(v => v.nome)}
                  />
                  <ModalInput label="Nº NF de Comissão" value={modalDraft.numeroNFComissao} onChange={v => changeModalField('numeroNFComissao', v)} placeholder="Ex: 001" />
                  <ModalReadonly
                    label="Situação da Comissão"
                    value={modalDraft.situacaoComissao || '—'}
                    highlight={
                      modalDraft.situacaoComissao === 'Emitir Nota de Intermediação' ? 'amber' :
                      modalDraft.situacaoComissao === 'Nota de Intermediação Emitida' ? 'slate' :
                      undefined
                    }
                  />
                  <ModalInputDate label="Data de Acerto" value={modalDraft.dataAcerto} onChange={v => changeModalField('dataAcerto', v)} disabled={modalDraft.situacaoNegociacaoBlindadora === 'Negociação Direta'} />
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-xl shrink-0">
              <Button variant="outline" size="sm" onClick={closeModal} className="border-slate-300 text-slate-600">
                <X className="w-4 h-4 mr-1.5" />
                Cancelar
              </Button>
              <Button size="sm" onClick={saveModal} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                <Check className="w-4 h-4" />
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
