import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Line, Cell, PieChart, Pie,
  LabelList, ReferenceLine, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Download, AlertTriangle,
  ChevronDown, ChevronUp, Plus, Trash2, BarChart2, DollarSign,
  Percent, ShoppingCart,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { loadVendasResultadoRows, type VendasResultadoRow } from './vendasResultadoStorage';
import {
  loadAliquotas, loadVendasDsr, loadRemuneracao,
  type VendasDsrConfig, type RemuneracaoModalidade, type FaixaBonus,
} from './vendedoresRemuneracaoStorage';
import { loadModelos, loadRegras, getRegra, type VeiculoModelo, type VeiculoRegra } from './veiculosRegrasStorage';
import { loadJurosRotativoRows, type JurosRotativoRow } from './jurosRotativoStorage';
import { loadVendasRows, type VendasRow as BlindagemRow } from './vendasStorage';
import { loadRegistroRows, type RegistroVendasRow } from './registroVendasStorage';

// ─── Dias de Estoque auto-calc ───────────────────────────────────────────────
function parseDMY(s: string): Date | null {
  if (!s) return null;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [d, m, y] = s.split('/').map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return null;
}
function buildRegistroMap(regs: RegistroVendasRow[]): Map<string, RegistroVendasRow> {
  const m = new Map<string, RegistroVendasRow>();
  for (const r of regs) m.set((r.chassi ?? '').trim().toUpperCase(), r);
  return m;
}
function applyDiasEstoqueFromRegistros(
  rows: VendasResultadoRow[],
  registroMap: Map<string, RegistroVendasRow>,
): VendasResultadoRow[] {
  return rows.map(r => {
    if (n(r.diasEstoque) > 0) return r; // já preenchido manualmente
    const reg = registroMap.get((r.chassi ?? '').trim().toUpperCase());
    if (!reg) return r;
    const entrada = parseDMY(reg.dtaEntrada);
    const venda   = parseDMY(reg.dtaVenda);
    if (!entrada || !venda) return r;
    const dias = Math.round((venda.getTime() - entrada.getTime()) / 86_400_000);
    if (dias < 0) return r;
    return { ...r, diasEstoque: String(dias) };
  });
}

// ─── Paleta ───────────────────────────────────────────────────────────────────
const MS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const PALETTE = ['#f59e0b','#3b82f6','#10b981','#8b5cf6','#06b6d4','#f97316','#84cc16','#e879f9','#34d399','#fb7185','#fbbf24','#a78bfa'];
const AVATAR_BG = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#f97316','#e879f9','#84cc16'];
const MEDAL_COLOR = ['#f59e0b','#9ca3af','#cd7f32'];

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────
type ModelMetric        = 'vol' | 'lb' | 'res' | 'ticket' | 'marg' | 'bubble';
type VendorSort         = 'res' | 'vol' | 'lb' | 'marg';
type ComissaoMode       = 'total' | 'com' | 'dsr' | 'provEnc';
type JurosGrouping      = 'familia' | 'modelo';
type ComissoesGrouping  = 'familia' | 'modelo';
type ComissoesScenario  = 'custoUn' | 'comp' | 'pct';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const n  = (v?: string | null) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtBRLF = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct  = (v: number, d = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';

function getYr(r: VendasResultadoRow) {
  if (r.periodoImport) {
    const [y] = r.periodoImport.split('-').map(Number);
    if (y > 2000) return y;
  }
  const d = r.dataVenda;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[2];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[0];
  return 0;
}
function getMo(r: VendasResultadoRow) {
  if (r.periodoImport) {
    const [, m] = r.periodoImport.split('-').map(Number);
    if (m >= 1 && m <= 12) return m;
  }
  const d = r.dataVenda;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[1];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[1];
  return 0;
}
function getDiaVenda(r: VendasResultadoRow): number {
  const d = r.dataVenda;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[2];
  return 0;
}
function dsrFor(cfgs: VendasDsrConfig[], dateStr: string) {
  let a = 0, m = 0;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) { a = +dateStr.split('/')[2]; m = +dateStr.split('/')[1]; }
  else if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) { a = +dateStr.split('-')[0]; m = +dateStr.split('-')[1]; }
  const c = cfgs.find(x => x.ano === a && x.mes === m);
  return c ? parseFloat(c.percentual) || 0 : 0;
}

// ─── Vendedores sem comissão ─────────────────────────────────────────────────
const NO_COMMISSION_VENDORS = [
  'thiago de oliveira domingos',
  'orlando chodin neto',
];
function applyZeroComissao(rows: VendasResultadoRow[]): VendasResultadoRow[] {
  return rows.map(r => {
    const name = (r.vendedor ?? '').trim().toLowerCase();
    if (!NO_COMMISSION_VENDORS.includes(name)) return r;
    return { ...r, comissaoVenda: '0', dsr: '0' };
  });
}

// ─── Auto-fill comissão ───────────────────────────────────────────────────────
function buildVendorMonthCounts(rows: VendasResultadoRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const v = (r.vendedor ?? '').trim().toLowerCase();
    const d = r.dataVenda;
    let a = 0, m = 0;
    if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) { a = +d.split('/')[2]; m = +d.split('/')[1]; }
    else if (/^\d{4}-\d{2}-\d{2}/.test(d)) { a = +d.split('-')[0]; m = +d.split('-')[1]; }
    if (!v || !a || !m) continue;
    const key = `${v}|${a}|${m}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}
function findFaixaBonus(faixas: FaixaBonus[], qtd: number): FaixaBonus | null {
  for (const f of faixas) {
    const de = parseInt(f.de) || 0;
    const ate = f.ate ? parseInt(f.ate) : Infinity;
    if (qtd >= de && qtd <= ate) return f;
  }
  return null;
}
function applyComissaoAutoFill(rows: VendasResultadoRow[], modalidade: RemuneracaoModalidade): VendasResultadoRow[] {
  const counts = buildVendorMonthCounts(rows);
  return rows.map(row => {
    if (row.comissaoVenda !== '') return row;
    const vv = n(row.valorVenda);
    if (vv === 0) return row;
    const recLiq = vv - n(row.impostos);
    const lb = recLiq - n(row.valorCusto) + n(row.bonusVarejo) + n(row.bonusTradeIn ?? '');
    const pct1 = parseFloat(String(modalidade.comissaoVenda).replace(',', '.')) || 0;
    const com1 = vv * pct1 / 100;
    const vend = (row.vendedor ?? '').trim().toLowerCase();
    const d = row.dataVenda;
    let a = 0, m = 0;
    if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) { a = +d.split('/')[2]; m = +d.split('/')[1]; }
    else if (/^\d{4}-\d{2}-\d{2}/.test(d)) { a = +d.split('-')[0]; m = +d.split('-')[1]; }
    let com2 = 0;
    if (vend && a && m) {
      const key = `${vend}|${a}|${m}`;
      const qtd = counts.get(key) ?? 0;
      const faixa = findFaixaBonus(modalidade.faixasBonus, qtd);
      if (faixa) com2 = vv * (parseFloat(String(faixa.percentual).replace(',', '.')) || 0) / 100;
    }
    const pct3 = parseFloat(String(modalidade.comissaoLucroBruto).replace(',', '.')) || 0;
    const com3 = lb * pct3 / 100;
    const total = com1 + com2 + com3;
    if (total === 0) return row;
    return { ...row, comissaoVenda: total.toFixed(2) };
  });
}

// ─── Auto-fill: PIV/SIQ/PIVE via cadastro de regras ─────────────────────────
function applyAutoFill(
  rows: VendasResultadoRow[],
  modelos: VeiculoModelo[],
  regras: VeiculoRegra[],
): VendasResultadoRow[] {
  return rows.map(row => {
    if (row.bonusPIV !== '' && row.bonusSIQ !== '' && row.bonusPIVE !== '') return row;
    const d = row.dataVenda;
    let ano: number | null = null, mes: number | null = null;
    if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) { ano = parseInt(d.split('/')[2]); mes = parseInt(d.split('/')[1]); }
    else if (/^\d{4}-\d{2}-\d{2}/.test(d)) { ano = parseInt(d.split('-')[0]); mes = parseInt(d.split('-')[1]); }
    if (!ano || !mes) return row;
    const modelo = modelos.find(m => m.modelo.trim().toLowerCase() === (row.modelo ?? '').trim().toLowerCase());
    if (!modelo) return row;
    const regra = getRegra(regras, modelo.id, ano, mes);
    if (!regra) return row;
    const preco = parseFloat(String(regra.precoPublico).replace(',', '.')) || 0;
    const sign = row.transacao === 'V07' ? -1 : 1;
    return {
      ...row,
      bonusPIV:  row.bonusPIV  === '' ? (preco * (parseFloat(String(regra.piv).replace(',',  '.')) || 0) / 100 * sign).toFixed(2) : row.bonusPIV,
      bonusSIQ:  row.bonusSIQ  === '' ? (preco * (parseFloat(String(regra.siq).replace(',',  '.')) || 0) / 100 * sign).toFixed(2) : row.bonusSIQ,
      bonusPIVE: row.bonusPIVE === '' ? (preco * (parseFloat(String(regra.pive).replace(',', '.')) || 0) / 100 * sign).toFixed(2) : row.bonusPIVE,
    };
  });
}

// ─── Auto-fill: recBlindagem via dados de películas/blindagem ────────────────
function buildBlindagemMap(blindagemRows: BlindagemRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of blindagemRows) {
    if (!r.revenda || r.revenda.trim().toUpperCase() !== 'VW') continue;
    const chassi = r.chassi?.trim();
    if (!chassi || !r.comissaoBrutaSorana) continue;
    map.set(chassi.slice(-7).toUpperCase(), r.comissaoBrutaSorana);
  }
  return map;
}

function applyBlindagemAutoFill(
  rows: VendasResultadoRow[],
  blindagemMap: Map<string, string>,
): VendasResultadoRow[] {
  if (blindagemMap.size === 0) return rows;
  return rows.map(row => {
    if (row.recBlindagem !== '') return row;
    const chassi = row.chassi?.trim();
    if (!chassi) return row;
    const valor = blindagemMap.get(chassi.slice(-7).toUpperCase());
    if (valor === undefined) return row;
    const liquido = (parseFloat(valor) || 0) * (1 - 0.1425);
    return { ...row, recBlindagem: liquido.toFixed(2) };
  });
}

// ─── Auto-fill: jurosEstoque via juros rotativos ─────────────────────────────
function buildJurosMap(jurosRows: JurosRotativoRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const jr of jurosRows) {
    const nota = jr.notaFiscal.trim();
    if (!nota) continue;
    const val = parseFloat(String(jr.jurosPagos).replace(',', '.')) || 0;
    map.set(nota, (map.get(nota) ?? 0) + val);
  }
  return map;
}

function applyJurosAutoFill(
  rows: VendasResultadoRow[],
  jurosMap: Map<string, number>,
): VendasResultadoRow[] {
  return rows.map(row => {
    if (row.jurosEstoque !== '') return row;
    const nota = (row.notaCompra ?? '').trim();
    if (!nota) return row;
    const total = jurosMap.get(nota);
    if (total === undefined) return row;
    return { ...row, jurosEstoque: total.toFixed(2) };
  });
}

// ─── Normalização modelo → família ────────────────────────────────────────────
function normalizeModelo(raw: string): string {
  const u = (raw || '').toUpperCase()
    .replace(/[ÀÁÂÃÄ]/g,'A').replace(/[ÈÉÊË]/g,'E')
    .replace(/[ÌÍÎÏ]/g,'I').replace(/[ÒÓÔÕÖ]/g,'O').replace(/[ÙÚÛÜ]/g,'U');
  if (u.includes('NIVUS'))  return 'Nivus';
  if (u.includes('T-CROSS') || u.includes('T CROSS') || u.includes('TCROSS')) return 'T-Cross';
  if (u.includes('TAOS'))   return 'Taos';
  if (u.includes('TERA'))   return 'Tera';
  if (u.includes('TIGUAN')) return 'Tiguan';
  if (u.includes('AMAROK')) return 'Amarok';
  if (u.includes('POLO TRACK')) return 'Polo Track';
  if (u.includes('POLO'))   return 'Polo';
  if (u.includes('VIRTUS')) return 'Virtus';
  if (u.includes('SAVEIRO')) return 'Saveiro';
  if (u.includes('VOYAGE')) return 'Voyage';
  if (/\bGOL\b/.test(u))   return 'Gol';
  if (u.includes('JETTA'))  return 'Jetta';
  if (u.includes('PASSAT')) return 'Passat';
  if (u.includes('ARTEON')) return 'Arteon';
  if (u.includes('ID.4') || u.includes('ID4')) return 'ID.4';
  if (u.includes('Q5'))     return 'Audi Q5';
  if (/\bA3\b/.test(u))    return 'Audi A3';
  if (/\bA4\b/.test(u))    return 'Audi A4';
  if (/\bA6\b/.test(u))    return 'Audi A6';
  if (u.includes('Q3'))     return 'Audi Q3';
  if (u.includes('Q7'))     return 'Audi Q7';
  if (u.includes('Q8'))     return 'Audi Q8';
  return raw.trim() || '(sem modelo)';
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length];
}

// ─── Cálculo por linha ────────────────────────────────────────────────────────
function calcNovos(r: VendasResultadoRow, aliqBon: number, dsrPct: number) {
  const recLiq = n(r.valorVenda) - n(r.impostos);
  const bv = n(r.bonusVarejo), bt = n(r.bonusTradeIn);
  const lb  = recLiq - n(r.valorCusto) + bv + bt - (bv + bt) * aliqBon / 100;
  const bon = n(r.bonusPIV) + n(r.bonusSIQ) + n(r.bonusPIVE) + n(r.bonusAdic1) + n(r.bonusAdic2) + n(r.bonusAdic3);
  const lcb = lb + bon - bon * aliqBon / 100;
  const dsr = n(r.comissaoVenda) * dsrPct / 100;
  const base = n(r.comissaoVenda) + dsr;
  const prov = base * 7 / 36;
  const enc  = (base + prov) * 0.358;
  const resultado = lcb + n(r.recBlindagem) + n(r.recFinanciamento) + n(r.recDespachante)
    - n(r.jurosEstoque) - n(r.ciDesconto) - n(r.cortesiaEmplacamento)
    - n(r.comissaoVenda) - dsr - prov - enc - n(r.outrasDespesas);
  return { recLiq, lb, bon, lcb, dsr, prov, enc, resultado, com: n(r.comissaoVenda) };
}

// ─── Agregador ────────────────────────────────────────────────────────────────
interface Agg {
  v07: number; netVol: number; receita: number; custo: number; recLiq: number;
  lb: number; lbPct: number; bon: number; lcb: number;
  dsr: number; prov: number; enc: number; res: number; marg: number;
  ticket: number; ticketReceita: number;
  juros: number; ci: number; cort: number; com: number; outras: number;
  blind: number; fin: number; desp: number; mediaDias: number; medianaDias: number;
  remVendedor: number;
}
function agg(rows: VendasResultadoRow[], aliqBon: number, dsrCfg: VendasDsrConfig[]): Agg | null {
  if (!rows.length) return null;
  const v07 = rows.filter(r => r.transacao === 'V07').length;
  const netVol = rows.length - v07;
  let receita = 0, custo = 0, recLiq = 0, lb = 0, bon = 0, lcb = 0;
  let dsr = 0, prov = 0, enc = 0, res = 0, remV = 0;
  let juros = 0, ci = 0, cort = 0, com = 0, outras = 0, blind = 0, fin = 0, desp = 0;
  let diasSum = 0; const diasArr: number[] = [];
  for (const r of rows) {
    const d = dsrFor(dsrCfg, r.dataVenda);
    const c = calcNovos(r, aliqBon, d);
    receita += n(r.valorVenda); custo += n(r.valorCusto);
    recLiq += c.recLiq; lb += c.lb; bon += c.bon; lcb += c.lcb;
    dsr += c.dsr; prov += c.prov; enc += c.enc; res += c.resultado; com += c.com;
    remV += c.com + c.dsr + c.prov + c.enc;
    juros += n(r.jurosEstoque); ci += n(r.ciDesconto); cort += n(r.cortesiaEmplacamento);
    outras += n(r.outrasDespesas);
    blind += n(r.recBlindagem); fin += n(r.recFinanciamento); desp += n(r.recDespachante);
    const dias = n(r.diasEstoque);
    if (dias > 0) { diasSum += dias; diasArr.push(dias); }
  }
  const diasCnt = diasArr.length;
  const diasSorted = [...diasArr].sort((a, b) => a - b);
  const mid = Math.floor(diasSorted.length / 2);
  const medianaDias = diasSorted.length === 0 ? 0
    : diasSorted.length % 2 === 1 ? diasSorted[mid]
    : (diasSorted[mid - 1] + diasSorted[mid]) / 2;
  return {
    v07, netVol, receita, custo, recLiq,
    lb, lbPct: recLiq ? lb / recLiq * 100 : 0,
    bon, lcb, dsr, prov, enc, res, marg: recLiq ? res / recLiq * 100 : 0,
    ticket: netVol ? res / netVol : 0,
    ticketReceita: netVol ? receita / netVol : 0,
    juros, ci, cort, com, outras, blind, fin, desp,
    mediaDias: diasCnt ? diasSum / diasCnt : 0,
    medianaDias,
    remVendedor: remV,
  };
}

// ─── Período comparativo ──────────────────────────────────────────────────────
interface PeriodCfg { id: string; year: number; gran: 'mes' | 'ano'; month: number; vendedor: string; familia: string; modelo: string; }

// ─── Sub-componentes UI ───────────────────────────────────────────────────────
function SH({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
      {right}
    </div>
  );
}

function Pill({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold transition-all border ${
        active
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
          : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
      }`}>
      {icon}{label}
    </button>
  );
}

function KpiCard({ label, value, sub, color = 'text-slate-800', accent, hero, onClick, pinned, info }: {
  label: string; value: string; sub?: string; color?: string; accent?: string;
  hero?: boolean; onClick?: () => void; pinned?: boolean; info?: string;
}) {
  return (
    <div
      className={`bg-white rounded-xl border shadow-sm flex flex-col gap-1 relative group select-none transition-all duration-150 ${
        hero ? 'px-5 py-5 border-slate-200' : 'px-3 py-3 border-slate-200 cursor-pointer hover:border-blue-300 hover:shadow-md'
      }`}
      style={accent ? { borderLeft: `4px solid ${accent}` } : undefined}
      onClick={onClick}
      title={onClick ? (pinned ? 'Remover do destaque' : 'Fixar como destaque') : undefined}
    >
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide leading-tight">{label}</span>
        {info && <span className="text-[10px] text-slate-300 hover:text-slate-500 cursor-help" title={info}>ⓘ</span>}
      </div>
      <span className={`font-bold leading-tight truncate ${color} ${hero ? 'text-2xl' : 'text-lg'}`}>{value}</span>
      {sub && <span className="text-[11px] text-slate-400 leading-tight">{sub}</span>}
      {onClick && (
        <span className={`absolute top-2 right-2 text-sm transition-colors ${pinned ? 'text-blue-500' : 'text-slate-200 group-hover:text-blue-300'}`}>★</span>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-slate-200 gap-2">
      <TrendingUp className="w-6 h-6" />
      <span className="text-xs">Sem dados</span>
    </div>
  );
}

function TipBRL({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[180px]">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p, i) => p.value !== 0 && (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-mono text-slate-700">{fmtBRLF(p.value)}</span>
        </div>
      ))}
      {payload.length > 1 && total !== 0 && (
        <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
          <span className="font-bold text-slate-600">Total</span>
          <span className="font-mono font-bold text-slate-700">{fmtBRLF(total)}</span>
        </div>
      )}
    </div>
  );
}

function TipBonFam({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const gross = payload.find(p => p.dataKey === 'gross')?.value ?? 0;
  const deduc = payload.find(p => p.dataKey === 'deduc')?.value ?? 0;
  const liq   = gross - deduc;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[200px]">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      <div className="flex justify-between gap-4">
        <span className="font-medium text-indigo-500">Bônus Bruto</span>
        <span className="font-mono text-slate-700">{fmtBRLF(gross)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="font-medium text-red-500">Imp. s/ Bônus</span>
        <span className="font-mono text-red-600">-{fmtBRLF(deduc)}</span>
      </div>
      <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
        <span className="font-bold text-slate-600">Total</span>
        <span className="font-mono font-bold text-slate-700">{fmtBRLF(liq)}</span>
      </div>
    </div>
  );
}

function TipJurosTotal({ active, payload, label }: { active?: boolean; payload?: { payload: { juros: number; vol: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const { juros, vol } = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[190px]">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      <div className="flex justify-between gap-4">
        <span className="font-medium text-orange-500">Juros</span>
        <span className="font-mono text-slate-700">{fmtBRLF(juros)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="font-medium text-slate-500">Qtd. veíc. c/ juros</span>
        <span className="font-mono text-slate-700">{vol}</span>
      </div>
    </div>
  );
}

function TipJurosUnit({ active, payload, label }: { active?: boolean; payload?: { payload: { jurosPorUnidade: number; vol: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const { jurosPorUnidade, vol } = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[200px]">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      <div className="flex justify-between gap-4">
        <span className="font-medium text-orange-500">Juros / un.</span>
        <span className="font-mono text-slate-700">{fmtBRLF(jurosPorUnidade)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="font-medium text-slate-500">Qtd. veíc. considerados</span>
        <span className="font-mono text-slate-700">{vol}</span>
      </div>
    </div>
  );
}

function TipWF({ active, payload, label }: { active?: boolean; payload?: { payload: { value: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.payload?.value ?? 0;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      <p className={`font-mono font-bold ${v >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtBRLF(v)}</p>
    </div>
  );
}

function DonutLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number;
}) {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + r * Math.cos(-midAngle * Math.PI / 180);
  const y = cy + r * Math.sin(-midAngle * Math.PI / 180);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ─── Config de métricas de modelo ────────────────────────────────────────────
const MODEL_METRIC_CFG: Record<ModelMetric, {
  label: string; donutKey: string; barKey: string; barLabel: string;
  fmt: (v: number) => string; icon: React.ReactNode;
}> = {
  vol:    { label: 'Volume',       donutKey: 'vol',    barKey: 'vol',    barLabel: 'Unidades',     fmt: v => String(v),            icon: <BarChart2 className="w-3 h-3" /> },
  ticket: { label: 'Ticket Médio', donutKey: 'receita', barKey: 'ticket', barLabel: 'Ticket Médio', fmt: fmtBRL,                    icon: <ShoppingCart className="w-3 h-3" /> },
  lb:     { label: 'Lucro Bruto',  donutKey: 'lb',     barKey: 'lb',     barLabel: 'Lucro Bruto',  fmt: fmtBRL,                    icon: <DollarSign className="w-3 h-3" /> },
  marg:   { label: 'Margem %',     donutKey: 'lb',     barKey: 'marg',   barLabel: 'Margem',       fmt: v => fmtPct(v),            icon: <Percent className="w-3 h-3" /> },
  bubble: { label: 'Análise 2D',   donutKey: 'vol',    barKey: 'vol',    barLabel: 'Vol × Marg',   fmt: v => String(v),            icon: <span style={{ fontSize: 11, lineHeight: 1 }}>⬤</span> },
  res:    { label: 'Resultado',    donutKey: 'res',     barKey: 'res',    barLabel: 'Resultado',    fmt: fmtBRL,                    icon: <TrendingUp className="w-3 h-3" /> },
};

const VENDOR_SORT_CFG: Record<VendorSort, { label: string }> = {
  res:  { label: 'Resultado' },
  vol:  { label: 'Volume' },
  lb:   { label: 'Lucro Bruto' },
  marg: { label: 'Margem %' },
};

// ─── Export Excel ─────────────────────────────────────────────────────────────
async function exportExcel(
  vendorData: { name: string; vol: number; res: number; marg: number; lb: number; lbPct: number; remVendedor: number }[],
  monthlyData: { label: string; vol: number; recLiq: number; lb: number; lcb: number; res: number; marg: number }[],
  modelData: { name: string; vol: number; lb: number; res: number; marg: number }[],
  periodLabel: string,
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard'; wb.created = new Date();
  const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
  const addSheet = (name: string, tab: string, headers: string[], rows: (string | number)[][], widths: number[]) => {
    const ws = wb.addWorksheet(name, { properties: { tabColor: { argb: tab } } });
    const t = ws.addRow([`Análise Novos — ${periodLabel} — ${name}`]);
    ws.mergeCells(1, 1, 1, headers.length);
    t.height = 26; t.eachCell(c => { c.fill = fill('FF1E3A5F'); c.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 }; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
    const h = ws.addRow(headers);
    h.height = 22; h.eachCell(c => { c.fill = fill('FF2563EB'); c.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
    ws.columns = widths.map(w => ({ width: w }));
    rows.forEach((row, i) => {
      const dr = ws.addRow(row); dr.height = 16;
      dr.eachCell({ includeEmpty: true }, (cell, ci) => {
        cell.fill = fill(i % 2 === 0 ? 'FFFFFFFF' : 'FFF0F9FF');
        if (typeof row[ci - 1] === 'number') { cell.numFmt = '"R$"\\ #,##0.00'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.font = { size: 9.5, name: 'Courier New' }; }
        else { cell.alignment = { horizontal: ci === 1 ? 'left' : 'center', vertical: 'middle' }; cell.font = { size: 9.5 }; }
      });
    });
  };
  addSheet('Vendedores', 'FF3B82F6', ['Vendedor', 'Vol. Líq.', 'Resultado (R$)', 'Margem %', 'Lucro Bruto (R$)', 'LB %', 'Rem. Vendedor (R$)'],
    vendorData.map(v => [v.name, v.vol, v.res, v.marg, v.lb, v.lbPct, v.remVendedor]), [28, 10, 18, 12, 18, 12, 18]);
  addSheet('Evolução Mensal', 'FF10B981', ['Mês', 'Vol. Líq.', 'Receita Líq.', 'Lucro Bruto', 'Lucro c/ Bôn.', 'Resultado', 'Margem %'],
    monthlyData.map(m => [m.label, m.vol, m.recLiq, m.lb, m.lcb, m.res, m.marg]), [10, 10, 18, 18, 18, 18, 12]);
  addSheet('Mix por Modelo', 'FFF59E0B', ['Modelo', 'Vol.', 'Lucro Bruto', 'Margem %', 'Resultado'],
    modelData.map(m => [m.name, m.vol, m.lb, m.marg, m.res]), [22, 10, 18, 12, 18]);
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `analise-novos-${periodLabel.toLowerCase().replace(/\//g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export function VendasNovoAnalise() {
  const today    = new Date();
  const curYear  = today.getFullYear();
  const curMonth = today.getMonth() + 1;

  const [allRows, setAllRows] = useState<VendasResultadoRow[]>([]);
  const [aliqBon, setAliqBon] = useState(0);
  const [dsrCfg,  setDsrCfg]  = useState<VendasDsrConfig[]>([]);
  const [loading, setLoading]  = useState(true);

  // Filtros
  const [year,     setYear]     = useState(curYear);
  const [month,    setMonth]    = useState<number | null>(curMonth);
  const [vendedor, setVendedor] = useState('Todos');
  const [modelo,   setModelo]   = useState('Todos');

  // UI
  const [showDevol,     setShowDevol]     = useState(false);
  const [pinned,        setPinned]        = useState<string[]>(['resultado', 'margemRes', 'volumeLiq']);
  const [modelMetric,   setModelMetric]   = useState<ModelMetric>('vol');
  const [vendorSort,    setVendorSort]    = useState<VendorSort>('res');
  const [showAllVendors,   setShowAllVendors]   = useState(false);
  const [comissaoMode,        setComissaoMode]        = useState<ComissaoMode>('total');
  const [jurosGrouping,       setJurosGrouping]       = useState<JurosGrouping>('familia');
  const [giroGrouping,        setGiroGrouping]        = useState<JurosGrouping>('familia');
  const [receitasView,        setReceitasView]        = useState<'fonte' | 'familia'>('fonte');
  const [comissoesGrouping,   setComissoesGrouping]   = useState<ComissoesGrouping>('familia');
  const [comissoesScenario,   setComissoesScenario]   = useState<ComissoesScenario>('custoUn');
  const [showAllComissoes,    setShowAllComissoes]    = useState(false);

  // Evolução Diária
  const [dailyVendedor,  setDailyVendedor]  = useState('Todos');
  const [dailyFamilia,   setDailyFamilia]   = useState('Todas');
  const [dailyMetric,    setDailyMetric]    = useState<'receita' | 'qtd'>('receita');

  // Tabela Pivot
  const [pivotGrouping, setPivotGrouping] = useState<'familia' | 'modelo'>('familia');
  const [pivotMetric,   setPivotMetric]   = useState<'vol' | 'lbPct' | 'margPct' | 'mediaDias' | 'medianaDias'>('vol');

  // Comparativo de períodos
  const [periods, setPeriods] = useState<PeriodCfg[]>([
    { id: 'base', year: curYear, gran: 'mes', month: curMonth, vendedor: 'Todos', familia: 'Todas', modelo: 'Todos' },
  ]);

  // ─── Carga ────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      loadVendasResultadoRows('novos'),
      loadAliquotas(),
      loadVendasDsr(),
      loadRemuneracao(),
      loadModelos(),
      loadRegras(),
      loadJurosRotativoRows(),
      loadVendasRows(),
      loadRegistroRows('novos'),
    ]).then(([rows, aliq, dsr, rem, modelos, regras, jurosRows, blindRows, regRows]) => {
      const jurosMap = buildJurosMap(jurosRows as JurosRotativoRow[]);
      const blindMap = buildBlindagemMap(blindRows as BlindagemRow[]);
      const regMap   = buildRegistroMap(regRows as RegistroVendasRow[]);
      let filledRows = applyComissaoAutoFill(rows as VendasResultadoRow[], (rem as { novos: RemuneracaoModalidade }).novos);
      filledRows = applyZeroComissao(filledRows);
      filledRows = applyJurosAutoFill(filledRows, jurosMap);
      if ((modelos as VeiculoModelo[]).length > 0) {
        filledRows = applyAutoFill(filledRows, modelos as VeiculoModelo[], regras as VeiculoRegra[]);
      }
      filledRows = applyBlindagemAutoFill(filledRows, blindMap);
      filledRows = applyDiasEstoqueFromRegistros(filledRows, regMap);
      setAllRows(filledRows);
      setAliqBon((aliq as { tipo: string; aliquota: string }[])
        .filter(i => i.tipo.toLowerCase().includes('bonificações'))
        .reduce((s, i) => s + (parseFloat(i.aliquota) || 0), 0));
      setDsrCfg(dsr as VendasDsrConfig[]);

      // Detectar último mês com dados e inicializar filtros + comparativo
      if ((filledRows as VendasResultadoRow[]).length > 0) {
        const yr = Math.max(...(filledRows as VendasResultadoRow[]).map(getYr).filter(y => y > 2000));
        const mo = Math.max(...(filledRows as VendasResultadoRow[]).filter(r => getYr(r) === yr).map(getMo).filter(m => m >= 1 && m <= 12));
        setYear(yr);
        setMonth(mo);
        const prevMo = mo === 1 ? 12 : mo - 1;
        const prevYr = mo === 1 ? yr - 1 : yr;
        setPeriods([
          { id: 'base', year: prevYr, gran: 'mes', month: prevMo, vendedor: 'Todos', familia: 'Todas', modelo: 'Todos' },
          { id: crypto.randomUUID(), year: yr,    gran: 'mes', month: mo,     vendedor: 'Todos', familia: 'Todas', modelo: 'Todos' },
        ]);
      }

      setLoading(false);
    });
  }, []);

  const availYears = useMemo(() => {
    const s = new Set(allRows.map(getYr).filter(y => y > 2000));
    [curYear - 1, curYear].forEach(y => s.add(y));
    return [...s].sort();
  }, [allRows, curYear]);

  const yearRows = useMemo(() => allRows.filter(r => getYr(r) === year), [allRows, year]);

  const availVendedores = useMemo(() =>
    ['Todos', ...[...new Set(yearRows.map(r => r.vendedor?.trim()).filter(Boolean) as string[])].sort()],
    [yearRows]);

  const availModelos = useMemo(() =>
    ['Todos', ...[...new Set(yearRows.map(r => r.modelo?.trim()).filter(Boolean) as string[])].sort()],
    [yearRows]);

  const filteredRows = useMemo(() => yearRows.filter(r => {
    if (month !== null && getMo(r) !== month) return false;
    if (vendedor !== 'Todos' && (r.vendedor?.trim() || '') !== vendedor) return false;
    if (modelo !== 'Todos' && (r.modelo?.trim() || '') !== modelo) return false;
    return true;
  }), [yearRows, month, vendedor, modelo]);

  const devolucoes = useMemo(() => filteredRows.filter(r => r.transacao === 'V07'), [filteredRows]);
  const metrics    = useMemo(() => agg(filteredRows, aliqBon, dsrCfg), [filteredRows, aliqBon, dsrCfg]);

  const prevMetrics = useMemo(() => {
    if (month === null) return null;
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    return agg(allRows.filter(r => getYr(r) === py && getMo(r) === pm), aliqBon, dsrCfg);
  }, [allRows, month, year, aliqBon, dsrCfg]);

  // Dados mensais
  const monthlyData = useMemo(() => MS.map((label, i) => {
    const m  = i + 1;
    const mr = yearRows.filter(r => getMo(r) === m);
    const a  = agg(mr, aliqBon, dsrCfg);
    return { label, vol: a?.netVol ?? 0, recLiq: a?.recLiq ?? 0, lb: a?.lb ?? 0, lcb: a?.lcb ?? 0, res: a?.res ?? 0, marg: a?.marg ?? 0 };
  }), [yearRows, aliqBon, dsrCfg]);

  // Por vendedor (todas as ordenações)
  const vendorDataRaw = useMemo(() => {
    const map = new Map<string, VendasResultadoRow[]>();
    for (const r of filteredRows) {
      const k = r.vendedor?.trim() || '(sem nome)';
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].flatMap(([name, rows]) => {
      const a = agg(rows, aliqBon, dsrCfg);
      if (!a) return [];
      return [{ name, vol: a.netVol, res: a.res, marg: a.marg, lb: a.lb, lbPct: a.lbPct, recLiq: a.recLiq, remVendedor: a.remVendedor, com: a.com, dsr: a.dsr, prov: a.prov, enc: a.enc }];
    });
  }, [filteredRows, aliqBon, dsrCfg]);

  const vendorData = useMemo(() =>
    [...vendorDataRaw].sort((a, b) => b[vendorSort] - a[vendorSort]),
    [vendorDataRaw, vendorSort]);

  const totalVol = useMemo(() => vendorData.reduce((s, v) => s + v.vol, 0), [vendorData]);
  const avgMarg  = useMemo(() => vendorData.length ? vendorData.reduce((s, v) => s + v.marg, 0) / vendorData.length : 0, [vendorData]);

  // Por família de modelo
  const modelFamilyData = useMemo(() => {
    const map = new Map<string, VendasResultadoRow[]>();
    for (const r of filteredRows) {
      const k = normalizeModelo(r.modelo ?? '');
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].flatMap(([name, rows]) => {
      const a = agg(rows, aliqBon, dsrCfg);
      if (!a) return [];
      return [{ name, vol: a.netVol, lb: a.lb, res: a.res, marg: a.marg, receita: a.receita, ticket: a.ticketReceita }];
    }).sort((a, b) => b.vol - a.vol);
  }, [filteredRows, aliqBon, dsrCfg]);

  // Ticket médio geral para linha de referência
  const avgTicket = useMemo(() =>
    modelFamilyData.length ? modelFamilyData.reduce((s, d) => s + d.ticket, 0) / modelFamilyData.length : 0,
    [modelFamilyData]);

  // ── Evolução Diária ────────────────────────────────────────────────────────
  const dailyFamilias = useMemo(() => {
    if (month === null) return [];
    const s = new Set<string>();
    for (const r of filteredRows) s.add(normalizeModelo(r.modelo ?? ''));
    return ['Todas', ...[...s].sort()];
  }, [filteredRows, month]);

  const dailyVendedores = useMemo(() => {
    if (month === null) return ['Todos'];
    const s = new Set<string>();
    for (const r of filteredRows) s.add(r.vendedor?.trim() || '(sem nome)');
    return ['Todos', ...[...s].sort()];
  }, [filteredRows, month]);

  const daysInMonthNovos = useMemo(() => {
    if (month === null) return [];
    return Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1);
  }, [year, month]);

  const dailyNovosData = useMemo(() => {
    if (month === null) return [];
    const baseRows = filteredRows.filter(r =>
      (dailyVendedor === 'Todos' || (r.vendedor?.trim() || '') === dailyVendedor) &&
      (dailyFamilia  === 'Todas' || normalizeModelo(r.modelo ?? '') === dailyFamilia)
    );
    let cumReceita = 0, cumQtd = 0;
    return daysInMonthNovos.map(day => {
      const dayRows = baseRows.filter(r => getDiaVenda(r) === day && r.transacao !== 'V07');
      const receita = dayRows.reduce((s, r) => s + n(r.valorVenda), 0);
      const qtd     = dayRows.length;
      cumReceita += receita;
      cumQtd     += qtd;
      return { dia: String(day).padStart(2, '0'), receita, qtd, cumReceita, cumQtd };
    });
  }, [filteredRows, month, dailyVendedor, dailyFamilia, daysInMonthNovos]);

  // ── Tabela Pivot Família/Modelo × Meses ─────────────────────────────────
  const pivotActiveMeses = useMemo(() => {
    const s = new Set<number>();
    for (const r of yearRows) {
      const m = getMo(r);
      if (m >= 1 && m <= 12) s.add(m);
    }
    return [...s].sort((a, b) => a - b);
  }, [yearRows]);

  const pivotData = useMemo(() => {
    if (!pivotActiveMeses.length) return { rows: [], totals: {} as Record<number, { vol: number; lbPct: number; margPct: number; mediaDias: number; medianaDias: number }>, grandTotal: null };
    const getKey = (r: VendasResultadoRow) =>
      pivotGrouping === 'familia' ? normalizeModelo(r.modelo ?? '') : (r.modelo?.trim() || '(sem modelo)');

    // Agrupar por chave e mês
    const map = new Map<string, Map<number, VendasResultadoRow[]>>();
    for (const r of yearRows) {
      if (r.transacao === 'V07') continue;
      const key = getKey(r);
      const mo  = getMo(r);
      if (!map.has(key)) map.set(key, new Map());
      const byMo = map.get(key)!;
      byMo.set(mo, [...(byMo.get(mo) ?? []), r]);
    }

    // Calcular métricas por célula
    type Cell = { vol: number; lbPct: number; margPct: number; mediaDias: number; medianaDias: number };
    const rows: { name: string; cells: Record<number, Cell>; total: Cell }[] = [];

    for (const [name, byMo] of map) {
      const cells: Record<number, Cell> = {};
      let totalVol = 0, totalRecLiq = 0, totalLb = 0, totalRes = 0;
      const allDias: number[] = [];
      for (const mo of pivotActiveMeses) {
        const mr = byMo.get(mo) ?? [];
        const a  = agg(mr, aliqBon, dsrCfg);
        const cell: Cell = a
          ? { vol: a.netVol, lbPct: a.lbPct, margPct: a.marg, mediaDias: a.mediaDias, medianaDias: a.medianaDias }
          : { vol: 0, lbPct: 0, margPct: 0, mediaDias: 0, medianaDias: 0 };
        cells[mo] = cell;
        totalVol    += cell.vol;
        totalRecLiq += a?.recLiq ?? 0;
        totalLb     += a?.lb ?? 0;
        totalRes    += a?.res ?? 0;
        mr.forEach(r => { const d = n(r.diasEstoque); if (d > 0) allDias.push(d); });
      }
      const sorted = [...allDias].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const mediana = sorted.length === 0 ? 0
        : sorted.length % 2 === 1 ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
      rows.push({
        name,
        cells,
        total: {
          vol: totalVol,
          lbPct:     totalRecLiq > 0 ? totalLb  / totalRecLiq * 100 : 0,
          margPct:   totalRecLiq > 0 ? totalRes / totalRecLiq * 100 : 0,
          mediaDias:   allDias.length > 0 ? allDias.reduce((s, d) => s + d, 0) / allDias.length : 0,
          medianaDias: mediana,
        },
      });
    }

    rows.sort((a, b) => b.total.vol - a.total.vol);

    // Linha de totais
    const totals: Record<number, Cell> = {};
    let gVol = 0, gRecLiq = 0, gLb = 0, gRes = 0;
    const gAllDias: number[] = [];
    for (const mo of pivotActiveMeses) {
      const mr = yearRows.filter(r => getMo(r) === mo && r.transacao !== 'V07');
      const a  = agg(mr, aliqBon, dsrCfg);
      totals[mo] = a
        ? { vol: a.netVol, lbPct: a.lbPct, margPct: a.marg, mediaDias: a.mediaDias, medianaDias: a.medianaDias }
        : { vol: 0, lbPct: 0, margPct: 0, mediaDias: 0, medianaDias: 0 };
      gVol    += totals[mo].vol;
      gRecLiq += a?.recLiq ?? 0;
      gLb     += a?.lb ?? 0;
      gRes    += a?.res ?? 0;
      mr.forEach(r => { const d = n(r.diasEstoque); if (d > 0) gAllDias.push(d); });
    }
    const gSorted = [...gAllDias].sort((a, b) => a - b);
    const gMid = Math.floor(gSorted.length / 2);
    const grandTotal: Cell = {
      vol: gVol,
      lbPct:     gRecLiq > 0 ? gLb  / gRecLiq * 100 : 0,
      margPct:   gRecLiq > 0 ? gRes / gRecLiq * 100 : 0,
      mediaDias:   gAllDias.length > 0 ? gAllDias.reduce((s, d) => s + d, 0) / gAllDias.length : 0,
      medianaDias: gSorted.length === 0 ? 0 : gSorted.length % 2 === 1 ? gSorted[gMid] : (gSorted[gMid - 1] + gSorted[gMid]) / 2,
    };

    return { rows, totals, grandTotal };
  }, [yearRows, pivotGrouping, pivotActiveMeses, aliqBon, dsrCfg]);

  // Bônus mensais
  const bonusMonthly = useMemo(() => MS.map((label, i) => {
    const m   = i + 1;
    const mr  = yearRows.filter(r => getMo(r) === m);
    const net = 1 - aliqBon / 100;
    const pivG  = mr.reduce((s, r) => s + n(r.bonusPIV), 0);
    const siqG  = mr.reduce((s, r) => s + n(r.bonusSIQ), 0);
    const piveG = mr.reduce((s, r) => s + n(r.bonusPIVE), 0);
    const adicsG = mr.reduce((s, r) => s + n(r.bonusAdic1) + n(r.bonusAdic2) + n(r.bonusAdic3), 0);
    const gross = pivG + siqG + piveG + adicsG;
    const deduc = gross * (aliqBon / 100);
    return {
      label,
      piv:   pivG  * net,
      siq:   siqG  * net,
      pive:  piveG * net,
      adics: adicsG * net,
      gross, deduc, liq: gross - deduc,
    };
  }), [yearRows, aliqBon]);

  // Bonificações líquidas por família
  const bonFamilyData = useMemo(() => {
    const map = new Map<string, VendasResultadoRow[]>();
    for (const r of filteredRows) {
      const k = normalizeModelo(r.modelo ?? '');
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].map(([name, rows]) => {
      const gross = rows.reduce((s, r) => s + n(r.bonusPIV) + n(r.bonusSIQ) + n(r.bonusPIVE) + n(r.bonusAdic1) + n(r.bonusAdic2) + n(r.bonusAdic3), 0);
      const deduc = gross * (aliqBon / 100);
      return { name, gross, deduc, liq: gross - deduc };
    }).filter(d => d.gross > 0).sort((a, b) => b.liq - a.liq);
  }, [filteredRows, aliqBon]);

  // Receitas por fonte por mês
  const receitasFonteData = useMemo(() => MS.map((label, i) => {
    const m  = i + 1;
    const mr = yearRows.filter(r => getMo(r) === m);
    return {
      label,
      blind:  mr.reduce((s, r) => s + n(r.recBlindagem), 0),
      fin:    mr.reduce((s, r) => s + n(r.recFinanciamento), 0),
      desp:   mr.reduce((s, r) => s + n(r.recDespachante), 0),
    };
  }), [yearRows]);

  // Totais de receitas extras
  const totaisReceitas = useMemo(() => ({
    blind: receitasFonteData.reduce((s, d) => s + d.blind, 0),
    fin:   receitasFonteData.reduce((s, d) => s + d.fin, 0),
    desp:  receitasFonteData.reduce((s, d) => s + d.desp, 0),
  }), [receitasFonteData]);

  // Receitas por família (período filtrado)
  const receitasFamiliaData = useMemo(() => {
    const map = new Map<string, { blind: number; fin: number; desp: number }>();
    for (const r of filteredRows) {
      const k = normalizeModelo(r.modelo ?? '');
      const prev = map.get(k) ?? { blind: 0, fin: 0, desp: 0 };
      map.set(k, {
        blind: prev.blind + n(r.recBlindagem),
        fin:   prev.fin   + n(r.recFinanciamento),
        desp:  prev.desp  + n(r.recDespachante),
      });
    }
    return [...map.entries()]
      .map(([name, d]) => ({ name, ...d, total: d.blind + d.fin + d.desp }))
      .filter(d => d.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredRows]);

  const totaisReceitasFamilia = useMemo(() => ({
    blind: receitasFamiliaData.reduce((s, d) => s + d.blind, 0),
    fin:   receitasFamiliaData.reduce((s, d) => s + d.fin, 0),
    desp:  receitasFamiliaData.reduce((s, d) => s + d.desp, 0),
  }), [receitasFamiliaData]);

  // Comissões ranking
  const comissoesData = useMemo(() =>
    [...vendorData]
      .sort((a, b) => (b.com + b.dsr + b.prov + b.enc) - (a.com + a.dsr + a.prov + a.enc))
      .map(v => ({
        name: v.name,
        com: v.com,
        dsr: v.dsr,
        provEnc: v.prov + v.enc,
        total: v.com + v.dsr + v.prov + v.enc,
      })),
    [vendorData]);

  // Juros por Família/Modelo
  const jurosData = useMemo(() => {
    const map = new Map<string, { juros: number; vol: number }>();
    for (const r of filteredRows) {
      const k = jurosGrouping === 'familia' ? normalizeModelo(r.modelo ?? '') : (r.modelo?.trim() || '(sem modelo)');
      const j = n(r.jurosEstoque);
      const prev = map.get(k) ?? { juros: 0, vol: 0 };
      map.set(k, { juros: prev.juros + j, vol: prev.vol + (j > 0 ? 1 : 0) });
    }
    return [...map.entries()]
      .map(([name, d]) => ({ name, juros: d.juros, vol: d.vol, jurosPorUnidade: d.vol > 0 ? d.juros / d.vol : 0 }))
      .filter(d => Math.round(d.juros) > 0)
      .sort((a, b) => b.juros - a.juros);
  }, [filteredRows, jurosGrouping]);

  // Giro de Estoque (mediana de diasEstoque) por Família/Modelo
  const giroEstoqueData = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const r of filteredRows) {
      const dias = n(r.diasEstoque);
      if (dias <= 0) continue;
      const k = giroGrouping === 'familia' ? normalizeModelo(r.modelo ?? '') : (r.modelo?.trim() || '(sem modelo)');
      const arr = map.get(k) ?? [];
      arr.push(dias);
      map.set(k, arr);
    }
    return [...map.entries()]
      .map(([name, arr]) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const mediana = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        const media = arr.reduce((s, v) => s + v, 0) / arr.length;
        const pct90 = Math.round((arr.filter(v => v > 90).length / arr.length) * 100);
        return { name, mediana: Math.round(mediana), media: Math.round(media), vol: arr.length, pct90 };
      })
      .sort((a, b) => a.mediana - b.mediana);
  }, [filteredRows, giroGrouping]);

  // Análise de Cores — ranking e heatmap família × cor
  const coresData = useMemo(() => {
    const map = new Map<string, { vol: number; lb: number }>();
    for (const r of filteredRows) {
      const cor = (r.cor ?? '').trim() || '(sem cor)';
      const dsrPct = dsrFor(dsrCfg, r.dataVenda);
      const c = calcNovos(r, aliqBon, dsrPct);
      const prev = map.get(cor) ?? { vol: 0, lb: 0 };
      map.set(cor, { vol: prev.vol + 1, lb: prev.lb + c.lb });
    }
    return [...map.entries()]
      .map(([name, d]) => ({ name, vol: d.vol, lb: d.lb, lbPerUnit: d.vol > 0 ? d.lb / d.vol : 0 }))
      .sort((a, b) => b.vol - a.vol);
  }, [filteredRows, aliqBon, dsrCfg]);

  const coresStackedData = useMemo(() => {
    const topCores = coresData.slice(0, 8).map(c => c.name);
    const famMap = new Map<string, Record<string, number>>();
    for (const r of filteredRows) {
      const fam = normalizeModelo(r.modelo ?? '');
      const cor = (r.cor ?? '').trim() || '(sem cor)';
      if (!topCores.includes(cor)) continue;
      if (!famMap.has(fam)) famMap.set(fam, {});
      const row = famMap.get(fam)!;
      row[cor] = (row[cor] ?? 0) + 1;
    }
    const rows = [...famMap.entries()]
      .map(([name, cols]) => ({
        name,
        ...cols,
        total: Object.values(cols).reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => b.total - a.total);
    return { topCores, rows };
  }, [coresData, filteredRows]);

  // Comissões por Família / Modelo
  const comissoesPorGrupoData = useMemo(() => {
    const map = new Map<string, { com: number; dsr: number; provEnc: number; recLiq: number; vol: number }>();
    for (const r of filteredRows) {
      const k = comissoesGrouping === 'familia'
        ? normalizeModelo(r.modelo ?? '')
        : (r.modelo?.trim() || '(sem modelo)');
      const dsrPct = dsrFor(dsrCfg, r.dataVenda);
      const c = calcNovos(r, aliqBon, dsrPct);
      const prev = map.get(k) ?? { com: 0, dsr: 0, provEnc: 0, recLiq: 0, vol: 0 };
      map.set(k, {
        com:     prev.com     + c.com,
        dsr:     prev.dsr     + c.dsr,
        provEnc: prev.provEnc + c.prov + c.enc,
        recLiq:  prev.recLiq  + c.recLiq,
        vol:     prev.vol     + 1,
      });
    }
    return [...map.entries()]
      .map(([name, d]) => ({
        name, ...d,
        total: d.com + d.dsr + d.provEnc,
        pct:   d.recLiq > 0 ? (d.com + d.dsr + d.provEnc) / d.recLiq * 100 : 0,
      }))
      .filter(d => d.total > 0)
      .sort((a, b) => b.total - a.total)
      .map(d => ({ ...d, custoUn: d.vol > 0 ? d.total / d.vol : 0 }));
  }, [filteredRows, aliqBon, dsrCfg, comissoesGrouping]);

  // Tendência de Margem — 12 meses rolantes
  const tendenciaData = useMemo(() => {
    const anchor = month ?? 12;
    const result: { label: string; marg: number | null; vol: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(year, anchor - 1 - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const mr = allRows.filter(r => getYr(r) === y && getMo(r) === m);
      const a = mr.length ? agg(mr, aliqBon, dsrCfg) : null;
      result.push({ label: `${MS[m - 1]}/${String(y).slice(2)}`, marg: a ? a.marg : null, vol: a ? a.netVol : 0 });
    }
    return result;
  }, [allRows, year, month, aliqBon, dsrCfg]);

  // Waterfall
  const waterfallData = useMemo(() => {
    if (!metrics) return [];
    const steps: { name: string; base: number; bar: number; value: number; type: 'pos' | 'neg' | 'total' }[] = [];
    let run = 0;
    const push = (name: string, value: number, type: 'pos' | 'neg' | 'total') => {
      const bar  = Math.abs(value);
      const base = type === 'total' ? 0 : (value >= 0 ? run : run + value);
      steps.push({ name, base, bar, value, type });
      if (type !== 'total') run += value;
    };
    push('Lucro c/ Bônus', metrics.lcb, 'pos');
    const ext = metrics.blind + metrics.fin + metrics.desp;
    if (ext > 0) push('Rec. Extras', ext, 'pos');
    if (metrics.juros > 0) push('Juros Estoque', -metrics.juros, 'neg');
    if (metrics.ci + metrics.cort > 0) push('CI / Cortesias', -(metrics.ci + metrics.cort), 'neg');
    const comTot = metrics.com + metrics.dsr + metrics.prov + metrics.enc;
    if (comTot > 0) push('Comissões+Enc.', -comTot, 'neg');
    if (metrics.outras > 0) push('Outras Desp.', -metrics.outras, 'neg');
    push('Resultado', metrics.res, 'total');
    return steps;
  }, [metrics]);

  // Comparativo de períodos
  const periodMetrics = useMemo(() => periods.map(p => {
    const pr = allRows.filter(r => {
      if (getYr(r) !== p.year) return false;
      if (p.gran === 'mes' && getMo(r) !== p.month) return false;
      if (p.vendedor !== 'Todos' && (r.vendedor?.trim() || '') !== p.vendedor) return false;
      if (p.familia !== 'Todas' && normalizeModelo(r.modelo ?? '') !== p.familia) return false;
      if (p.modelo !== 'Todos' && (r.modelo?.trim() || '') !== p.modelo) return false;
      return true;
    });
    return agg(pr, aliqBon, dsrCfg);
  }), [periods, allRows, aliqBon, dsrCfg]);

  const periodLabels = useMemo(() =>
    periods.map(p => {
      const base = p.gran === 'mes' ? `${MS[p.month - 1]}/${p.year}` : String(p.year);
      if (p.familia !== 'Todas' && p.modelo !== 'Todos') return `${base} · ${p.familia} / ${p.modelo}`;
      if (p.familia !== 'Todas') return `${base} · ${p.familia}`;
      return base;
    }),
    [periods]);

  function addPeriod() { setPeriods(prev => [...prev, { id: crypto.randomUUID(), year: curYear, gran: 'mes', month: curMonth, vendedor: 'Todos', familia: 'Todas', modelo: 'Todos' }]); }
  function removePeriod(id: string) { setPeriods(prev => prev.filter(p => p.id !== id)); }
  function updatePeriod(id: string, patch: Partial<PeriodCfg>) { setPeriods(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p)); }

  // KPIs
  const kpiDefs = useMemo(() => {
    if (!metrics) return [];
    const momRes = prevMetrics ? metrics.res - prevMetrics.res : null;
    const momVol = prevMetrics ? metrics.netVol - prevMetrics.netVol : null;
    return [
      { id: 'volumeLiq',  label: 'Volume Líquido', value: String(metrics.netVol),
        sub: [metrics.v07 > 0 ? `${metrics.v07} devolução(ões)` : null, momVol !== null ? `${momVol >= 0 ? '+' : ''}${momVol} vs mês ant.` : null].filter(Boolean).join(' — ') || undefined,
        color: 'text-blue-700', accent: '#3b82f6' },
      { id: 'recLiq',     label: 'Receita Líquida', value: fmtBRL(metrics.recLiq),
        sub: metrics.netVol > 0 ? `Ticket: ${fmtBRL(metrics.recLiq / metrics.netVol)}` : undefined,
        color: 'text-slate-800', accent: '#64748b' },
      { id: 'resultado',  label: 'Resultado Sorana', value: fmtBRL(metrics.res),
        sub: momRes !== null ? `${momRes >= 0 ? '+' : ''}${fmtBRL(momRes)} vs mês ant.` : undefined,
        color: metrics.res >= 0 ? 'text-emerald-700' : 'text-red-600',
        accent: metrics.res >= 0 ? '#10b981' : '#ef4444' },
      { id: 'margemRes',  label: 'Margem Resultado', value: fmtPct(metrics.marg), sub: 'sobre Receita Líquida',
        color: metrics.marg >= 2 ? 'text-emerald-700' : metrics.marg >= 0 ? 'text-amber-600' : 'text-red-600',
        accent: metrics.marg >= 2 ? '#10b981' : metrics.marg >= 0 ? '#f59e0b' : '#ef4444' },
      { id: 'lucroBruto', label: 'Lucro Bruto', value: fmtBRL(metrics.lb), sub: fmtPct(metrics.lbPct) + ' da receita',
        color: 'text-indigo-700', accent: '#6366f1' },
      { id: 'totalBon',   label: 'Total de Bônus (líquido)', value: fmtBRL(metrics.bon * (1 - aliqBon / 100)),
        sub: metrics.recLiq > 0 ? fmtPct(metrics.bon * (1 - aliqBon / 100) / metrics.recLiq * 100) + ' da receita' : undefined,
        color: 'text-amber-700', accent: '#f59e0b',
        info: metrics.bon === 0 ? 'PIV/SIQ/PIVE não preenchidos na aba Vendas → Novos' : undefined },
      { id: 'ticket',     label: 'Ticket (Resultado)', value: metrics.netVol > 0 ? fmtBRL(metrics.res / metrics.netVol) : '—',
        color: 'text-violet-700', accent: '#8b5cf6' },
      { id: 'juros',      label: 'Juros de Estoque', value: fmtBRL(metrics.juros),
        sub: metrics.juros === 0 ? 'não preenchido na aba Vendas' : (metrics.recLiq > 0 ? fmtPct(metrics.juros / metrics.recLiq * 100) + ' da receita' : undefined),
        color: metrics.juros > metrics.recLiq * 0.02 ? 'text-red-600' : 'text-slate-400', accent: '#ef4444',
        info: 'Campo "Juros Estoque" — preencher manualmente em Vendas → Novos' },
      { id: 'mediaDias',  label: 'Giro Médio (dias)', value: metrics.mediaDias > 0 ? metrics.mediaDias.toFixed(0) + ' dias' : '—',
        sub: metrics.mediaDias === 0 ? 'não preenchido na aba Vendas' : 'tempo médio até venda',
        color: metrics.mediaDias > 60 ? 'text-red-600' : metrics.mediaDias > 30 ? 'text-amber-600' : metrics.mediaDias > 0 ? 'text-emerald-700' : 'text-slate-400',
        accent: '#06b6d4',
        info: 'Campo "Dias Estoque" — preencher manualmente em Vendas → Novos' },
    ];
  }, [metrics, prevMetrics]);

  const heroKpis = kpiDefs.filter(k => pinned.includes(k.id));
  const secKpis  = kpiDefs.filter(k => !pinned.includes(k.id));
  function togglePin(id: string) {
    if (pinned.includes(id)) { setPinned(p => p.filter(x => x !== id)); return; }
    setPinned(p => p.length < 3 ? [...p, id] : [...p.slice(1), id]);
  }

  const periodLabel    = month !== null ? `${MS[month - 1]}/${year}` : String(year);
  const mmCfg          = MODEL_METRIC_CFG[modelMetric];
  const familyColorMap = useMemo(() => Object.fromEntries(
    modelFamilyData.map((d, i) => [d.name, PALETTE[i % PALETTE.length]])
  ), [modelFamilyData]);
  const vendorsVisible = showAllVendors ? vendorData : vendorData.slice(0, 5 + 3); // top3 + 5 na tabela
  const comissoesVisible = showAllComissoes ? comissoesData : comissoesData.slice(0, 8);

  // Projeção para o mês corrente
  const projFactor = (() => {
    if (month === null) return null;
    const now = new Date();
    if (now.getFullYear() === year && now.getMonth() + 1 === month) {
      const day = now.getDate();
      const daysInMonth = new Date(year, month, 0).getDate();
      return day < daysInMonth ? daysInMonth / day : null;
    }
    return null;
  })();

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-6" style={{ minHeight: 0 }}>

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Ano</span>
          {availYears.map(y => (
            <button key={y} onClick={() => { setYear(y); setMonth(null); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${year === y ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {y}
            </button>
          ))}
        </div>
        <div className="w-px h-6 bg-slate-200" />
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setMonth(null)}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${month === null ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            Todos
          </button>
          {MS.map((m, i) => {
            const mi    = i + 1;
            const count = yearRows.filter(r => getMo(r) === mi).length;
            return (
              <button key={mi} onClick={() => setMonth(month === mi ? null : mi)}
                className={`w-9 h-9 rounded-full text-[11px] font-bold transition-all relative ${
                  month === mi ? 'bg-blue-600 text-white shadow-md'
                  : count > 0  ? 'bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-700'
                               : 'bg-slate-50 text-slate-300'
                }`}>
                {m}
                {count > 0 && month !== mi && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-400 text-white text-[8px] rounded-full flex items-center justify-center font-bold">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="w-px h-6 bg-slate-200" />
        <div className="flex items-center gap-2">
          <select value={vendedor} onChange={e => setVendedor(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
            {availVendedores.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={modelo} onChange={e => setModelo(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
            {availModelos.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {(vendedor !== 'Todos' || modelo !== 'Todos') && (
            <button onClick={() => { setVendedor('Todos'); setModelo('Todos'); }}
              className="text-[11px] text-slate-400 hover:text-red-400 transition-colors">✕ limpar</button>
          )}
        </div>
        <div className="ml-auto">
          <button onClick={() => exportExcel(vendorData, monthlyData, modelFamilyData, periodLabel)} disabled={!metrics}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors disabled:opacity-40">
            <Download className="w-3.5 h-3.5" /> Exportar Excel
          </button>
        </div>
      </div>

      {/* ── Loading / sem dados ──────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-56 text-slate-300">
          <div className="flex flex-col items-center gap-3">
            <TrendingUp className="w-10 h-10 animate-pulse" />
            <span className="text-sm">Carregando dados...</span>
          </div>
        </div>
      )}
      {!loading && !metrics && (
        <div className="flex items-center justify-center h-56 text-slate-300">
          <div className="flex flex-col items-center gap-3">
            <TrendingUp className="w-10 h-10" />
            <p className="text-sm font-semibold">Sem dados para {periodLabel}</p>
            <p className="text-xs text-slate-400">Registros aparecem após cadastramento em Vendas → Veículos Novos</p>
          </div>
        </div>
      )}

      {!loading && metrics && (
        <>
          {/* ── KPIs Hero ──────────────────────────────────────────────────── */}
          {heroKpis.length > 0 && (
            <div className={`grid gap-4 ${heroKpis.length === 1 ? 'grid-cols-1' : heroKpis.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {heroKpis.map(k => <KpiCard key={k.id} {...k} hero pinned onClick={() => togglePin(k.id)} />)}
            </div>
          )}

          {/* ── KPIs Secundários ────────────────────────────────────────────── */}
          {secKpis.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {secKpis.map(k => <KpiCard key={k.id} {...k} onClick={() => togglePin(k.id)} />)}
            </div>
          )}
          <p className="text-[10px] text-slate-400 text-right -mt-4">
            ★ clique em qualquer card para fixar como destaque (máx. 3) — ⓘ = campo não preenchido
          </p>

          {/* ── Evolução Diária ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <SH right={
              <div className="flex items-center gap-2 flex-wrap">
                {/* Seletor de vendedor */}
                <select
                  value={dailyVendedor}
                  onChange={e => setDailyVendedor(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-[200px]"
                >
                  {dailyVendedores.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                {/* Seletor de família */}
                <select
                  value={dailyFamilia}
                  onChange={e => setDailyFamilia(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-[200px]"
                >
                  {dailyFamilias.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                {/* Métrica */}
                <div className="flex gap-1 ml-1">
                  {(['receita', 'qtd'] as const).map(m => {
                    const labels = { receita: 'Receita', qtd: 'Quantidade' };
                    return (
                      <button
                        key={m}
                        onClick={() => setDailyMetric(m)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
                          dailyMetric === m
                            ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        {labels[m]}
                      </button>
                    );
                  })}
                </div>
              </div>
            }>
              Evolução Diária{month !== null ? ` — ${MS[month - 1]}/${year}` : ''}
              {dailyVendedor !== 'Todos' && <span className="text-blue-500 normal-case ml-1 text-[11px]">· {dailyVendedor}</span>}
            </SH>
            {month === null ? (
              <div className="h-24 flex items-center justify-center text-slate-300 text-xs">
                Selecione um mês para ver a evolução diária
              </div>
            ) : dailyNovosData.every(d => d.receita === 0 && d.qtd === 0) ? (
              <div className="h-24 flex items-center justify-center text-slate-300 text-xs">Sem dados no período</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailyNovosData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} angle={-45} textAnchor="end" height={36} />
                  <YAxis
                    tickFormatter={v => dailyMetric === 'receita'
                      ? (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))
                      : String(v)
                    }
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    width={52}
                  />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      const moStr = MS[(month as number) - 1];
                      return (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-3 py-2.5 text-xs min-w-[210px]">
                          <p className="font-bold text-slate-700 mb-1.5">Dia {label} — {moStr}/{year}</p>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Receita Bruta</span>
                            <span className="font-mono text-slate-700">{fmtBRL(d?.receita ?? 0)}</span>
                          </div>
                          <div className="flex justify-between gap-4 mt-0.5">
                            <span className="text-slate-500">Quantidade</span>
                            <span className="font-mono text-slate-700">{d?.qtd ?? 0} un.</span>
                          </div>
                          <div className="mt-2 pt-1.5 border-t-2 border-slate-200">
                            <p className="text-[10px] text-slate-400 font-bold mb-1">Acumulado até dia {label}</p>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-500">Receita Bruta</span>
                              <span className="font-mono text-slate-600">{fmtBRL(d?.cumReceita ?? 0)}</span>
                            </div>
                            <div className="flex justify-between gap-4 mt-0.5">
                              <span className="text-slate-500">Quantidade</span>
                              <span className="font-mono text-slate-600">{d?.cumQtd ?? 0} un.</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey={dailyMetric}
                    name={dailyMetric === 'receita' ? 'Receita Bruta' : 'Quantidade'}
                    fill="#3b82f6"
                    fillOpacity={0.85}
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Vendas por Modelo (família) — botões dinâmicos ──────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <SH right={
              <div className="flex items-center gap-1.5 flex-wrap">
                {(Object.entries(MODEL_METRIC_CFG) as [ModelMetric, (typeof MODEL_METRIC_CFG)[ModelMetric]][]).map(([k, cfg]) => (
                  <Pill key={k} label={cfg.label} active={modelMetric === k} onClick={() => setModelMetric(k)} icon={cfg.icon} />
                ))}
              </div>
            }>
              Vendas por Modelo (Família) — {periodLabel}
            </SH>
            {modelFamilyData.length === 0 ? <Empty /> : modelMetric === 'bubble' ? (
              /* ── Bubble: Volume × Margem × Resultado ── */
              <div>
                <p className="text-[10px] text-slate-400 text-center mb-3">
                  Eixo X = Volume · Eixo Y = Margem % · 🔵 Tamanho = Resultado absoluto
                </p>
                <ResponsiveContainer width="100%" height={340}>
                  <ScatterChart margin={{ top: 24, right: 40, left: 20, bottom: 28 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" dataKey="vol" name="Volume"
                      label={{ value: 'Volume (unidades)', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#94a3b8' }}
                      tick={{ fontSize: 9 }} />
                    <YAxis type="number" dataKey="marg" name="Margem %"
                      label={{ value: 'Margem %', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }}
                      tick={{ fontSize: 9 }} tickFormatter={v => v.toFixed(1) + '%'} />
                    <ZAxis type="number" dataKey="res" range={[80, 1400]} name="Resultado" />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as typeof modelFamilyData[0];
                      return (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[190px]">
                          <p className="font-bold text-slate-700 mb-2">{d.name}</p>
                          <div className="flex justify-between gap-4"><span className="text-slate-400">Volume</span><span className="font-mono font-semibold">{d.vol} un.</span></div>
                          <div className="flex justify-between gap-4"><span className="text-slate-400">Margem</span><span className="font-mono font-semibold">{fmtPct(d.marg)}</span></div>
                          <div className="flex justify-between gap-4"><span className="text-slate-400">Resultado</span><span className={`font-mono font-bold ${d.res >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtBRLF(d.res)}</span></div>
                          <div className="flex justify-between gap-4"><span className="text-slate-400">Lucro Bruto</span><span className="font-mono text-indigo-600">{fmtBRLF(d.lb)}</span></div>
                        </div>
                      );
                    }} />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" />
                    <ReferenceLine y={avgMarg} stroke="#f59e0b" strokeDasharray="4 2"
                      label={{ value: `Média ${fmtPct(avgMarg)}`, position: 'insideTopRight', fontSize: 9, fill: '#f59e0b' }} />
                    <Scatter data={modelFamilyData} name="Modelos" fillOpacity={0.8}>
                      {modelFamilyData.map((d, i) => (
                        <Cell key={i} fill={d.res < 0 ? '#ef4444' : d.marg >= avgMarg ? '#10b981' : '#3b82f6'} />
                      ))}
                      <LabelList dataKey="name" position="right" style={{ fontSize: 9, fill: '#475569', fontWeight: 600 }} />
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="flex gap-4 justify-center mt-2 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block opacity-80" />Acima da margem média</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block opacity-80" />Abaixo da margem média</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block opacity-80" />Resultado negativo</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Donut */}
                <div>
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">
                    {mmCfg.label} por Modelo
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={modelFamilyData} dataKey={mmCfg.donutKey} nameKey="name"
                        cx="50%" cy="50%" outerRadius={110} innerRadius={60}
                        labelLine={false}
                        label={DonutLabel as unknown as (props: object) => React.ReactElement | null}>
                        {modelFamilyData.map((d, i) => <Cell key={i} fill={familyColorMap[d.name] ?? PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number, name: string, props: { payload?: { marg?: number } }) => {
                        const display = modelMetric === 'marg'
                          ? fmtPct(props.payload?.marg ?? 0)
                          : mmCfg.fmt(v);
                        return [display, name];
                      }} />
                      <Legend wrapperStyle={{ fontSize: 11 }}
                        formatter={(value, entry) => (
                          <span style={{ color: '#475569' }}>
                            {value}: {modelMetric === 'marg'
                              ? fmtPct((entry as { payload?: { marg?: number } }).payload?.marg ?? 0)
                              : mmCfg.fmt((entry as { payload?: { [key: string]: number } }).payload?.[mmCfg.donutKey] ?? 0)}
                          </span>
                        )} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Barra horizontal */}
                <div>
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">
                    {mmCfg.barLabel} por Família
                    {modelMetric === 'ticket' && avgTicket > 0 && (
                      <span className="ml-2 text-slate-400 font-normal">— Média: {fmtBRL(avgTicket)}</span>
                    )}
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={[...modelFamilyData].sort((a, b) => (b[mmCfg.barKey as keyof typeof b] as number) - (a[mmCfg.barKey as keyof typeof a] as number))}
                      layout="vertical" margin={{ left: 4, right: 72, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tickFormatter={v => mmCfg.fmt(v)} tick={{ fontSize: 9 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={86} />
                      <Tooltip formatter={(v: number) => [mmCfg.fmt(v), mmCfg.barLabel]} />
                      {modelMetric === 'ticket' && avgTicket > 0 && (
                        <ReferenceLine x={avgTicket} stroke="#94a3b8" strokeDasharray="4 2"
                          label={{ value: 'Média', position: 'top', fontSize: 9, fill: '#94a3b8' }} />
                      )}
                      <Bar dataKey={mmCfg.barKey} name={mmCfg.barLabel} radius={[0, 5, 5, 0]}>
                        {[...modelFamilyData].sort((a, b) => (b[mmCfg.barKey as keyof typeof b] as number) - (a[mmCfg.barKey as keyof typeof a] as number))
                          .map((d, i) => <Cell key={i} fill={(d[mmCfg.barKey as keyof typeof d] as number) < 0 ? '#ef4444' : (familyColorMap[d.name] ?? PALETTE[i % PALETTE.length])} />)}
                        {modelMetric !== 'ticket' && (
                          <LabelList dataKey="marg" position="right"
                            formatter={(v: number) => fmtPct(v)}
                            style={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
                        )}
                        {modelMetric === 'ticket' && (
                          <LabelList dataKey="vol" position="right"
                            formatter={(v: number) => `${v} un.`}
                            style={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
                        )}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* ── Giro de Estoque por Família/Modelo ─────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <SH right={
              <div className="flex items-center gap-1">
                {(['familia', 'modelo'] as JurosGrouping[]).map(g => (
                  <button key={g} onClick={() => setGiroGrouping(g)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      giroGrouping === g
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}>
                    {g === 'familia' ? 'Família' : 'Modelo'}
                  </button>
                ))}
              </div>
            }>
              Giro de Estoque por {giroGrouping === 'familia' ? 'Família' : 'Modelo'} — {periodLabel}
            </SH>
            {giroEstoqueData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <p className="text-sm">Sem dados de dias de estoque para o período</p>
                <p className="text-xs mt-1">Os dias são calculados automaticamente via Registros de Vendas</p>
              </div>
            ) : (
              <>
                <div className="flex gap-4 mb-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded bg-cyan-500 inline-block" />Mediana (dias)</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded bg-slate-300 inline-block" />Média (dias)</span>
                  <span className="ml-auto">ordenado por mediana crescente (menor = gira mais rápido)</span>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(200, giroEstoqueData.length * 38)}>
                  <BarChart data={giroEstoqueData} layout="vertical" margin={{ left: 4, right: 80, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `${v}d`} />
                    <YAxis type="category" dataKey="name" width={100}
                      tick={({ x, y, payload }: any) => {
                        const entry = giroEstoqueData.find(d => d.name === payload.value);
                        const warn = entry ? (entry.media / entry.mediana) >= 1.4 : false;
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text x={-4} y={0} dy={4} textAnchor="end" fontSize={10}
                              fill={warn ? '#b45309' : '#64748b'}
                              fontWeight={warn ? 600 : 400}>
                              {warn ? `⚠ ${payload.value}` : payload.value}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload as { name: string; mediana: number; media: number; vol: number; pct90: number };
                        const ratio = d.media / d.mediana;
                        const distortion = ratio >= 1.4;
                        const insight = distortion
                          ? d.pct90 > 0
                            ? `Maioria vende em ${d.mediana}d, mas ${d.pct90}% do estoque está há +90 dias`
                            : `Poucos veículos encalhados puxam a média para cima (+${Math.round((ratio - 1) * 100)}%)`
                          : null;
                        return (
                          <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[200px]">
                            <p className="font-bold text-slate-700 mb-2">{distortion ? `⚠ ${d.name}` : d.name}</p>
                            <div className="flex justify-between gap-4"><span className="text-cyan-600">Mediana</span><span className="font-mono font-bold">{d.mediana} dias</span></div>
                            <div className="flex justify-between gap-4"><span className="text-slate-400">Média</span><span className="font-mono">{d.media} dias</span></div>
                            <div className="flex justify-between gap-4"><span className="text-slate-400">Unidades</span><span className="font-mono">{d.vol}</span></div>
                            {d.pct90 > 0 && (
                              <div className="flex justify-between gap-4"><span className="text-red-500">&gt; 90 dias</span><span className="font-mono text-red-500 font-bold">{d.pct90}%</span></div>
                            )}
                            {distortion && (
                              <div className="flex justify-between gap-4"><span className="text-amber-600">Distorção</span><span className="font-mono text-amber-600 font-bold">+{Math.round((ratio - 1) * 100)}%</span></div>
                            )}
                            {insight && (
                              <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-amber-700 italic leading-tight">{insight}</div>
                            )}
                          </div>
                        );
                      }}
                    />
                    {(() => {
                      const avgMediana = Math.round(giroEstoqueData.reduce((s, d) => s + d.mediana, 0) / giroEstoqueData.length);
                      return <ReferenceLine x={avgMediana} stroke="#f59e0b" strokeDasharray="4 2"
                        label={{ value: `Média geral ${avgMediana}d`, position: 'top', fontSize: 9, fill: '#f59e0b' }} />;
                    })()}
                    <Bar dataKey="mediana" name="Mediana" radius={[0, 4, 4, 0]} barSize={14}>
                      {giroEstoqueData.map((d, i) => (
                        <Cell key={i} fill={d.mediana <= 30 ? '#10b981' : d.mediana <= 60 ? '#f59e0b' : '#ef4444'} />
                      ))}
                      <LabelList dataKey="mediana" position="right"
                        formatter={(v: number) => `${v}d`}
                        style={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
                    </Bar>
                    <Bar dataKey="media" name="Média" radius={[0, 4, 4, 0]} barSize={6} fill="#cbd5e1" opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 justify-center mt-3 text-[10px] text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />até 30 dias</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />31–60 dias</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />acima de 60 dias</span>
                  <span className="flex items-center gap-1 text-amber-700 font-semibold"><span className="text-amber-600">⚠</span>outliers (média/mediana ≥ 1.4×)</span>
                </div>
              </>
            )}
          </div>

          {/* ── Tendência de Margem — 12 meses rolantes ─────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <SH>Tendência de Margem — 12 meses rolantes</SH>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={tendenciaData} margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                <YAxis yAxisId="left" tickFormatter={v => v.toFixed(1) + '%'} tick={{ fontSize: 9 }} width={44} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} width={32} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const margVal = payload.find(p => p.dataKey === 'marg')?.value as number | undefined;
                  const volVal  = payload.find(p => p.dataKey === 'vol')?.value as number | undefined;
                  return (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[150px]">
                      <p className="font-bold text-slate-700 mb-1">{label}</p>
                      {margVal !== undefined && (
                        <div className="flex justify-between gap-4">
                          <span className="text-amber-500">Margem</span>
                          <span className="font-mono font-bold">{fmtPct(margVal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-4">
                        <span className="text-indigo-400">Volume</span>
                        <span className="font-mono">{volVal ?? '—'} un.</span>
                      </div>
                    </div>
                  );
                }} />
                <ReferenceLine yAxisId="left" y={0} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />
                <Bar yAxisId="right" dataKey="vol" name="Volume" fill="#e0e7ff" opacity={0.65} radius={[2, 2, 0, 0]} />
                <Line yAxisId="left" type="monotone" dataKey="marg" name="Margem %" stroke="#f59e0b" strokeWidth={2.5}
                  connectNulls={false}
                  dot={(props: { cx?: number; cy?: number; payload?: { marg: number | null }; index?: number }) => {
                    const { cx = 0, cy = 0, payload, index = 0 } = props;
                    if (payload?.marg === null || payload?.marg === undefined) return <circle key={index} cx={cx} cy={cy} r={0} />;
                    const col = payload.marg < 0 ? '#ef4444' : payload.marg < 2 ? '#f59e0b' : '#10b981';
                    return <circle key={index} cx={cx} cy={cy} r={4} fill={col} stroke="white" strokeWidth={1.5} />;
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-center mt-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />Margem ≥ 2%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />0% – 2%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Negativa</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-200 inline-block" />Volume (dir.)</span>
            </div>
          </div>

          {/* ── Waterfall + Evolução Mensal ──────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <SH>Decomposição do Resultado — {periodLabel}</SH>
              {waterfallData.length === 0 ? <Empty /> : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={waterfallData} margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9.5 }} />
                      <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 9 }} width={88} />
                      <Tooltip content={({ active, payload, label }: { active?: boolean; payload?: { payload: { value: number; type: string } }[]; label?: string }) => {
                        if (!active || !payload?.length) return null;
                        const e = payload[0]?.payload;
                        const v = e?.value ?? 0;
                        const recLiq = metrics?.recLiq ?? 0;
                        const pct = recLiq > 0 ? Math.abs(v) / recLiq * 100 : null;
                        return (
                          <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[190px]">
                            <p className="font-semibold text-slate-700 mb-1">{label}</p>
                            <p className={`font-mono font-bold ${v >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtBRLF(v)}</p>
                            {pct !== null && (
                              <p className="text-slate-400 mt-0.5">{fmtPct(pct)} da rec. líquida</p>
                            )}
                          </div>
                        );
                      }} />
                      <Bar dataKey="base" stackId="s" fill="transparent" legendType="none" isAnimationActive={false} />
                      <Bar dataKey="bar"  stackId="s" radius={[4, 4, 0, 0]}>
                        {waterfallData.map((e, i) => <Cell key={i} fill={e.type === 'total' ? '#3b82f6' : e.type === 'pos' ? '#10b981' : '#ef4444'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 justify-center mt-3 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Positivo</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500   inline-block" />Dedução</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500  inline-block" />Resultado Final</span>
                  </div>
                </>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <SH>Evolução Mensal — {year}</SH>
              <ResponsiveContainer width="100%" height={290}>
                <ComposedChart data={monthlyData} margin={{ top: 8, right: 58, left: 8, bottom: 0 }} barCategoryGap="22%" barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 9 }} width={88} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={v => v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + 'M' : fmtBRL(v)} tick={{ fontSize: 9 }} width={55} axisLine={false} tickLine={false} />
                  <Tooltip content={({ active, payload, label }: { active?: boolean; payload?: { payload?: { recLiq: number; lb: number; res: number } }[]; label?: string }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3.5 text-xs min-w-[240px]" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}>
                        <p className="font-bold text-slate-700 mb-2 text-sm">{label}</p>
                        <div className="flex justify-between items-center gap-4 py-1 border-b border-slate-100">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#38bdf8' }} />Receita Líquida</span>
                          <span className="font-mono font-medium text-sky-600">{fmtBRLF(d.recLiq)}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4 py-1 border-b border-slate-100">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />Lucro Bruto</span>
                          <span className="font-mono font-medium text-indigo-600">
                            {fmtBRLF(d.lb)}
                            {d.recLiq > 0 && <span className="text-slate-400 font-normal ml-1.5">({fmtPct(d.lb / d.recLiq * 100)})</span>}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-4 py-1">
                          <span className={`flex items-center gap-1.5 ${d.res < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                            <span className={`w-2.5 h-2.5 rounded-sm inline-block ${d.res < 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />Resultado
                          </span>
                          <span className={`font-mono font-medium ${d.res < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                            {fmtBRLF(d.res)}
                            {d.recLiq > 0 && <span className="text-slate-400 font-normal ml-1.5">({fmtPct(d.res / d.recLiq * 100)})</span>}
                          </span>
                        </div>
                      </div>
                    );
                  }} />
                  <Bar yAxisId="right" dataKey="recLiq" name="Receita Líquida" radius={[4, 4, 0, 0]}>
                    {monthlyData.map((_, i) => <Cell key={i} fill="#38bdf8" opacity={month !== null && month !== i + 1 ? 0.45 : 0.75} />)}
                  </Bar>
                  <Bar yAxisId="left" dataKey="lb" name="Lucro Bruto" radius={[4, 4, 0, 0]}>
                    {monthlyData.map((_, i) => <Cell key={i} fill="#6366f1" opacity={month !== null && month !== i + 1 ? 0.55 : 1} />)}
                  </Bar>
                  <Bar yAxisId="left" dataKey="res" name="Resultado" radius={[4, 4, 0, 0]}>
                    {monthlyData.map((d, i) => <Cell key={i} fill={d.res < 0 ? '#ef4444' : '#10b981'} opacity={month !== null && month !== i + 1 ? 0.55 : 1} />)}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 justify-center mt-3 text-[10.5px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#38bdf8', opacity: 0.7 }} />Receita Líquida <span className="text-slate-400">(eixo dir.)</span></span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />Lucro Bruto</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Resultado (+)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Resultado (−)</span>
              </div>
            </div>
          </div>

          {/* ── Bonificações por Mês + Líquidas por Família ─────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Bônus mensais */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <SH>Composição de Bônus — {periodLabel}</SH>
                </div>
                {metrics.bon > 0 && (
                  <div className="text-right -mt-1">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Acumulado</p>
                    <p className="text-base font-bold text-amber-600 font-mono">{fmtBRL(metrics.bon * (1 - aliqBon / 100))}</p>
                    {aliqBon > 0 && <p className="text-[10px] text-slate-400">Imp. s/ bônus: {fmtPct(aliqBon, 2)}</p>}
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={bonusMonthly} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 9 }} width={88} />
                  <Tooltip content={<TipBRL />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="piv"   name="PIV"        stackId="b" fill="#3b82f6" />
                  <Bar dataKey="siq"   name="SIQ"        stackId="b" fill="#f97316" />
                  <Bar dataKey="pive"  name="PIVE"       stackId="b" fill="#a855f7" />
                  <Bar dataKey="adics" name="Adicionais" stackId="b" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Bônus líquidas por família */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <SH>Bonificações Líquidas por Família — {periodLabel}</SH>
              {bonFamilyData.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={Math.max(200, bonFamilyData.length * 36 + 40)}>
                  <BarChart data={bonFamilyData} layout="vertical" margin={{ left: 4, right: 72, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 9 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={86} />
                    <Tooltip content={<TipBonFam />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="gross" name="Bônus Bruto" stackId="n" fill="#6366f1" opacity={0.4} />
                    <Bar dataKey="deduc" name="Imp. s/ Bônus" stackId="n" fill="#ef4444" opacity={0.7} radius={[0, 3, 3, 0]}>
                      <LabelList dataKey="liq" position="right"
                        formatter={(v: number) => fmtBRL(v)}
                        style={{ fontSize: 9, fill: '#475569', fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Receitas por Fonte ───────────────────────────────────────────── */}
          {(totaisReceitas.blind + totaisReceitas.fin + totaisReceitas.desp) > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-1">
                <SH right={
                  <div className="flex items-center gap-1">
                    {(['fonte', 'familia'] as const).map(v => (
                      <button key={v} onClick={() => setReceitasView(v)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                          receitasView === v
                            ? 'bg-cyan-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}>
                        {v === 'fonte' ? 'Fonte' : 'Família'}
                      </button>
                    ))}
                  </div>
                }>
                  {receitasView === 'fonte'
                    ? `Receitas por Fonte — ${periodLabel}`
                    : `Receitas por Família — ${periodLabel}`}
                </SH>
                <div className="flex gap-4 -mt-1">
                  {(() => {
                    const t = receitasView === 'familia' ? totaisReceitasFamilia : totaisReceitas;
                    return [
                      { label: 'Blindagem',      value: t.blind, color: '#3b82f6' },
                      { label: 'Financiamento',  value: t.fin,   color: '#10b981' },
                      { label: 'Despachante',    value: t.desp,  color: '#f59e0b' },
                    ];
                  })().map(item => item.value > 0 && (
                    <div key={item.label} className="text-right">
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: item.color }}>{item.label}</p>
                      <p className="text-sm font-bold font-mono" style={{ color: item.color }}>{fmtBRL(item.value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {receitasView === 'fonte' ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={receitasFonteData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 9 }} width={88} />
                    <Tooltip content={<TipBRL />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="blind" name="Blindagem"     radius={[3, 3, 0, 0]} fill="#3b82f6" />
                    <Bar dataKey="fin"   name="Financiamento" radius={[3, 3, 0, 0]} fill="#10b981" />
                    <Bar dataKey="desp"  name="Despachante"   radius={[3, 3, 0, 0]} fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              ) : receitasFamiliaData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <p className="text-sm">Sem receitas extras no período</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, receitasFamiliaData.length * 40)}>
                  <BarChart data={receitasFamiliaData} layout="vertical" margin={{ left: 4, right: 80, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => fmtBRL(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload as { name: string; blind: number; fin: number; desp: number; total: number };
                        return (
                          <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[200px]">
                            <p className="font-bold text-slate-700 mb-2">{d.name}</p>
                            {d.blind > 0 && <div className="flex justify-between gap-4"><span className="text-blue-500">Blindagem</span><span className="font-mono font-bold">{fmtBRL(d.blind)}</span></div>}
                            {d.fin   > 0 && <div className="flex justify-between gap-4"><span className="text-emerald-500">Financiamento</span><span className="font-mono">{fmtBRL(d.fin)}</span></div>}
                            {d.desp  > 0 && <div className="flex justify-between gap-4"><span className="text-amber-500">Despachante</span><span className="font-mono">{fmtBRL(d.desp)}</span></div>}
                            <div className="flex justify-between gap-4 pt-2 mt-1 border-t border-slate-100"><span className="text-slate-600 font-semibold">Total</span><span className="font-mono font-bold text-slate-800">{fmtBRL(d.total)}</span></div>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="blind" name="Blindagem"     stackId="a" radius={[0, 0, 0, 0]} fill="#3b82f6">
                      <LabelList dataKey="total" position="right" formatter={(v: number) => fmtBRL(v)} style={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} />
                    </Bar>
                    <Bar dataKey="fin"   name="Financiamento" stackId="a" fill="#10b981" />
                    <Bar dataKey="desp"  name="Despachante"   stackId="a" radius={[0, 4, 4, 0]} fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* ── Análise de Custos ────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <SH>Análise de Custos — {periodLabel}</SH>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Comissão + DSR + Encargos', value: metrics.com + metrics.dsr + metrics.prov + metrics.enc, color: '#ef4444', sub: 'pessoal de vendas' },
                { label: 'Juros de Estoque',           value: metrics.juros,                                          color: '#f97316', sub: 'custo financeiro flooring' },
                { label: 'CI Desc. + Cortesias',       value: metrics.ci + metrics.cort,                              color: '#f59e0b', sub: 'descontos operacionais' },
                { label: 'Outras Despesas',            value: metrics.outras,                                         color: '#8b5cf6', sub: 'diversas' },
              ].map((item, i) => (
                <div key={i} className="rounded-xl border border-slate-100 p-4 bg-slate-50/50" style={{ borderLeft: `3px solid ${item.color}` }}>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">{item.label}</p>
                  <p className="text-base font-bold font-mono" style={{ color: item.color }}>{fmtBRLF(item.value)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.sub}</p>
                  {metrics.recLiq > 0 && item.value > 0 && (
                    <p className="text-[10px] text-slate-500 font-semibold mt-1">{fmtPct(item.value / metrics.recLiq * 100)} da receita</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Análise de Cores ──────────────────────────────────────────── */}
          {coresData.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-start justify-between mb-5">
                <SH>Análise de Cores — {periodLabel}</SH>
                <span className="bg-slate-50 border border-slate-200 rounded-full px-3 py-1 text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                  {coresData.length} cores distintas
                </span>
              </div>

              {/* KPI Strip */}
              {(() => {
                const topVol  = coresData[0];
                const topLbPU = [...coresData].sort((a, b) => b.lbPerUnit - a.lbPerUnit)[0];
                const topFam  = coresStackedData.rows[0];
                return (
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                      { label: 'Cor Líder em Volume',   value: topVol?.name  ?? '—', sub: topVol  ? `${topVol.vol} unidades` : '—' },
                      { label: 'Melhor LB por Unidade', value: topLbPU?.name ?? '—', sub: topLbPU ? fmtBRLF(topLbPU.lbPerUnit) : '—' },
                      { label: 'Família Mais Vendida',  value: topFam?.name  ?? '—', sub: topFam  ? `${topFam.total} unidades` : '—' },
                    ].map((kpi, i) => (
                      <div key={i} className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5">{kpi.label}</p>
                        <p className="text-sm font-bold text-slate-800 leading-tight truncate">{kpi.value}</p>
                        <p className="text-[11px] text-slate-500 font-mono mt-1">{kpi.sub}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Donut + Barras Empilhadas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Donut — volume por cor */}
                <div>
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">Volume por Cor</p>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={coresData.slice(0, 8)}
                        dataKey="vol"
                        nameKey="name"
                        cx="50%" cy="50%"
                        outerRadius={110} innerRadius={60}
                        labelLine={false}
                        label={DonutLabel as unknown as (props: object) => React.ReactElement | null}
                      >
                        {coresData.slice(0, 8).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number, name: string) => [`${v} un.`, name]} />
                      <Legend
                        wrapperStyle={{ fontSize: 11 }}
                        formatter={(value, entry) => (
                          <span style={{ color: '#475569' }}>
                            {value}: {(entry as { payload?: { vol?: number } }).payload?.vol ?? 0} un.
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Barras empilhadas — composição de cores por família */}
                <div>
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">Composição por Família</p>
                  {coresStackedData.rows.length === 0 ? <Empty /> : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={coresStackedData.rows}
                        layout="vertical"
                        margin={{ left: 4, right: 56, top: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 9 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={72} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const total = (payload[0]?.payload as { total?: number })?.total ?? 0;
                            return (
                              <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[200px]">
                                <p className="font-bold text-slate-700 mb-2">{label} — {total} un.</p>
                                {[...payload].reverse().map(p => (
                                  p.value ? (
                                    <div key={p.dataKey as string} className="flex justify-between gap-4">
                                      <span style={{ color: p.color as string }}>{p.dataKey as string}</span>
                                      <span className="font-mono font-semibold text-slate-700">{p.value as number} un.</span>
                                    </div>
                                  ) : null
                                ))}
                              </div>
                            );
                          }}
                        />
                        {coresStackedData.topCores.map((cor, i) => (
                          <Bar key={cor} dataKey={cor} stackId="a" fill={PALETTE[i % PALETTE.length]} name={cor}
                            radius={i === coresStackedData.topCores.length - 1 ? [0, 4, 4, 0] : undefined}>
                            {i === coresStackedData.topCores.length - 1 && (
                              <LabelList dataKey="total" position="right"
                                formatter={(v: number) => `${v} un.`}
                                style={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
                            )}
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Juros de Estoque por Modelo/Família ─────────────────────────── */}
          {jurosData.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
                <SH>Juros de Estoque por {jurosGrouping === 'familia' ? 'Família' : 'Modelo'} — {periodLabel}</SH>
                <div className="flex items-center gap-2">
                  {(['familia', 'modelo'] as JurosGrouping[]).map(g => (
                    <button key={g} onClick={() => setJurosGrouping(g)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                        jurosGrouping === g
                          ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300 hover:text-orange-600'
                      }`}>
                      {g === 'familia' ? '🏷 Família' : '🔍 Modelo'}
                    </button>
                  ))}
                  <div className="ml-2 text-right">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total</p>
                    <p className="text-sm font-bold font-mono text-orange-600">{fmtBRL(jurosData.reduce((s, d) => s + d.juros, 0))}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
                <div>
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Juros Total por {jurosGrouping === 'familia' ? 'Família' : 'Modelo'}</p>
                  <ResponsiveContainer width="100%" height={Math.max(200, jurosData.length * 32 + 40)}>
                    <BarChart data={jurosData} layout="vertical" margin={{ left: 4, right: 88, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 9 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={92} />
                      <Tooltip content={<TipJurosTotal />} />
                      <Bar dataKey="juros" name="Juros Total" radius={[0, 5, 5, 0]}>
                        {jurosData.map((d, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                        <LabelList dataKey="juros" position="right"
                          formatter={(v: number) => fmtBRL(v)}
                          style={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Juros por Unidade Vendida</p>
                  <ResponsiveContainer width="100%" height={Math.max(200, jurosData.length * 32 + 40)}>
                    <BarChart data={[...jurosData].sort((a, b) => b.jurosPorUnidade - a.jurosPorUnidade)} layout="vertical" margin={{ left: 4, right: 88, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 9 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={92} />
                      <Tooltip content={<TipJurosUnit />} />
                      <Bar dataKey="jurosPorUnidade" name="Juros / Unidade" radius={[0, 5, 5, 0]}>
                        {[...jurosData].sort((a, b) => b.jurosPorUnidade - a.jurosPorUnidade).map((d, i) => {
                          const origIdx = jurosData.findIndex(x => x.name === d.name);
                          return <Cell key={i} fill={PALETTE[origIdx % PALETTE.length]} />;
                        })}
                        <LabelList dataKey="jurosPorUnidade" position="right"
                          formatter={(v: number) => fmtBRL(v)}
                          style={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ── Comissões por Família / Modelo ──────────────────────────────── */}
          {comissoesPorGrupoData.length > 0 && (() => {
            const totTotal = comissoesPorGrupoData.reduce((s, d) => s + d.total, 0);
            const totRec   = comissoesPorGrupoData.reduce((s, d) => s + d.recLiq, 0);
            const totVol   = comissoesPorGrupoData.reduce((s, d) => s + d.vol, 0);
            const avgPct   = totRec > 0 ? totTotal / totRec * 100 : 0;
            const topByUn  = [...comissoesPorGrupoData].sort((a, b) => b.custoUn - a.custoUn)[0];
            const sorted   = comissoesScenario === 'custoUn'
              ? [...comissoesPorGrupoData].sort((a, b) => b.custoUn - a.custoUn)
              : comissoesScenario === 'pct'
              ? [...comissoesPorGrupoData].sort((a, b) => b.pct - a.pct)
              : [...comissoesPorGrupoData].sort((a, b) => b.total - a.total);

            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <SH>Remuneração de Vendas — {periodLabel}</SH>
                    <p className="text-[11px] text-slate-400 mt-0.5">Comissão · DSR · Provisões e Encargos</p>
                  </div>
                  <div className="flex gap-1.5">
                    {(['familia', 'modelo'] as ComissoesGrouping[]).map(g => (
                      <Pill key={g} label={g === 'familia' ? 'Família' : 'Modelo'}
                        active={comissoesGrouping === g} onClick={() => setComissoesGrouping(g)} />
                    ))}
                  </div>
                </div>

                {/* KPI Strip */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { label: 'Custo Total',          value: fmtBRL(totTotal),           sub: `${totVol} unidades vendidas` },
                    { label: 'Maior Custo / Unidade', value: topByUn?.name ?? '—',       sub: topByUn ? fmtBRLF(topByUn.custoUn) + ' / un.' : '—' },
                    { label: '% Médio s/ Rec. Líq.',  value: fmtPct(avgPct),             sub: 'custo sobre receita' },
                  ].map((kpi, i) => (
                    <div key={i} className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5">{kpi.label}</p>
                      <p className="text-sm font-bold text-slate-800 leading-tight truncate">{kpi.value}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-1">{kpi.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Scenario pills */}
                <div className="flex gap-2 mb-5">
                  <Pill label="Custo / Unidade" active={comissoesScenario === 'custoUn'} onClick={() => setComissoesScenario('custoUn')} />
                  <Pill label="Composição"      active={comissoesScenario === 'comp'}    onClick={() => setComissoesScenario('comp')} />
                  <Pill label="% Receita"        active={comissoesScenario === 'pct'}     onClick={() => setComissoesScenario('pct')} />
                </div>

                {/* Chart — único, troca conforme cenário */}
                <ResponsiveContainer key={comissoesScenario} width="100%" height={Math.max(200, sorted.length * 44 + 40)}>
                  <BarChart data={sorted} layout="vertical" margin={{ left: 4, right: 80, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number"
                      tickFormatter={v => comissoesScenario === 'pct' ? fmtPct(v) : fmtBRL(v)}
                      tick={{ fontSize: 9 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }}
                      width={comissoesGrouping === 'familia' ? 80 : 160} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as typeof comissoesPorGrupoData[number];
                      return (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[220px]">
                          <p className="font-bold text-slate-700 mb-2">{label} — {d.vol} un.</p>
                          <div className="flex justify-between gap-4"><span className="text-violet-500">Comissão</span><span className="font-mono">{fmtBRLF(d.com)}</span></div>
                          <div className="flex justify-between gap-4"><span className="text-indigo-400">DSR</span><span className="font-mono">{fmtBRLF(d.dsr)}</span></div>
                          <div className="flex justify-between gap-4"><span className="text-blue-400">Prov.+Enc.</span><span className="font-mono">{fmtBRLF(d.provEnc)}</span></div>
                          <div className="flex justify-between gap-4 mt-1.5 pt-1.5 border-t border-slate-100">
                            <span className="font-semibold text-slate-600">Total</span>
                            <span className="font-mono font-bold text-slate-800">{fmtBRLF(d.total)}</span>
                          </div>
                          <div className="flex justify-between gap-4 mt-1">
                            <span className="text-slate-400">Custo / un.</span>
                            <span className="font-mono text-violet-600 font-semibold">{fmtBRLF(d.custoUn)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">% Rec. Líq.</span>
                            <span className="font-mono text-amber-600 font-semibold">{fmtPct(d.pct)}</span>
                          </div>
                        </div>
                      );
                    }} />

                    {comissoesScenario === 'comp' && (
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    )}

                    {comissoesScenario === 'pct' && (
                      <ReferenceLine x={avgPct} stroke="#f59e0b" strokeDasharray="4 2"
                        label={{ value: `Média ${fmtPct(avgPct)}`, position: 'insideTopRight', fontSize: 9, fill: '#f59e0b' }} />
                    )}

                    {comissoesScenario === 'comp' && (
                      <Bar dataKey="com" name="Comissão" stackId="s" fill="#8b5cf6" />
                    )}
                    {comissoesScenario === 'comp' && (
                      <Bar dataKey="dsr" name="DSR" stackId="s" fill="#6366f1" />
                    )}
                    {comissoesScenario === 'comp' && (
                      <Bar dataKey="provEnc" name="Prov.+Enc." stackId="s" fill="#a5b4fc" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="total" position="right"
                          formatter={(v: number) => fmtBRL(v)}
                          style={{ fontSize: 9, fill: '#475569', fontWeight: 600 }} />
                      </Bar>
                    )}
                    {comissoesScenario === 'custoUn' && (
                      <Bar dataKey="custoUn" name="Custo/Un." radius={[0, 5, 5, 0]}>
                        {sorted.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                        <LabelList dataKey="custoUn" position="right"
                          formatter={(v: number) => fmtBRL(v)}
                          style={{ fontSize: 9, fill: '#475569', fontWeight: 600 }} />
                      </Bar>
                    )}
                    {comissoesScenario === 'pct' && (
                      <Bar dataKey="pct" name="% Receita" radius={[0, 5, 5, 0]}>
                        {sorted.map((d, i) => <Cell key={i} fill={d.pct > avgPct ? '#ef4444' : PALETTE[i % PALETTE.length]} />)}
                        <LabelList dataKey="pct" position="right"
                          formatter={(v: number) => fmtPct(v)}
                          style={{ fontSize: 9, fill: '#475569', fontWeight: 600 }} />
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {/* ── Tabela Pivot: Família/Modelo × Meses ────────────────────────── */}
          {month === null && pivotData.rows.length > 0 && (() => {
            const { rows, totals, grandTotal } = pivotData;
            const meses = pivotActiveMeses;

            const fmtCell = (cell: { vol: number; lbPct: number; margPct: number; mediaDias: number; medianaDias: number }) => {
              if (pivotMetric === 'vol')        return cell.vol > 0 ? String(cell.vol) : '—';
              if (pivotMetric === 'lbPct')      return cell.vol > 0 ? cell.lbPct.toFixed(1)      + '%' : '—';
              if (pivotMetric === 'margPct')    return cell.vol > 0 ? cell.margPct.toFixed(1)    + '%' : '—';
              if (pivotMetric === 'mediaDias')  return cell.vol > 0 ? cell.mediaDias.toFixed(0)  + 'd' : '—';
              if (pivotMetric === 'medianaDias')return cell.vol > 0 ? cell.medianaDias.toFixed(0) + 'd' : '—';
              return '—';
            };
            const isDias = pivotMetric === 'mediaDias' || pivotMetric === 'medianaDias';
            const cellColor = (cell: { vol: number; lbPct: number; margPct: number; mediaDias: number; medianaDias: number }) => {
              if (pivotMetric === 'vol' || cell.vol === 0) return '';
              if (isDias) {
                const d = pivotMetric === 'mediaDias' ? cell.mediaDias : cell.medianaDias;
                if (d === 0)   return 'text-slate-300';
                if (d <= 30)   return 'text-emerald-600 font-semibold';
                if (d <= 60)   return 'text-sky-600';
                if (d <= 90)   return 'text-amber-600';
                return 'text-red-600 font-semibold';
              }
              const v = pivotMetric === 'lbPct' ? cell.lbPct : cell.margPct;
              if (v < 0)    return 'text-red-600 font-semibold';
              if (v < 2)    return 'text-amber-600';
              if (v < 5)    return 'text-sky-600';
              return 'text-emerald-600 font-semibold';
            };
            const cellBg = (cell: { vol: number; lbPct: number; margPct: number; mediaDias: number; medianaDias: number }) => {
              if (pivotMetric === 'vol' || cell.vol === 0) return '';
              if (isDias) {
                const d = pivotMetric === 'mediaDias' ? cell.mediaDias : cell.medianaDias;
                if (d === 0)  return '';
                if (d <= 30)  return 'bg-emerald-50';
                if (d <= 60)  return 'bg-sky-50';
                if (d <= 90)  return 'bg-amber-50';
                return 'bg-red-50';
              }
              const v = pivotMetric === 'lbPct' ? cell.lbPct : cell.margPct;
              if (v < 0)  return 'bg-red-50';
              if (v < 2)  return 'bg-amber-50';
              if (v < 5)  return 'bg-sky-50';
              return 'bg-emerald-50';
            };

            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <SH right={
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Agrupamento */}
                    <div className="flex gap-1">
                      {(['familia', 'modelo'] as const).map(g => (
                        <button key={g} onClick={() => setPivotGrouping(g)}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
                            pivotGrouping === g
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                          }`}>
                          {g === 'familia' ? 'Família' : 'Modelo'}
                        </button>
                      ))}
                    </div>
                    <div className="w-px h-4 bg-slate-200" />
                    {/* Métrica */}
                    {([['vol', 'Volume'], ['lbPct', '% L. Bruto'], ['margPct', '% Resultado'], ['mediaDias', 'Dias (média)'], ['medianaDias', 'Dias (mediana)']] as const).map(([k, label]) => (
                      <button key={k} onClick={() => setPivotMetric(k)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
                          pivotMetric === k
                            ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                }>
                  Comparativo Mensal por {pivotGrouping === 'familia' ? 'Família' : 'Modelo'} — {year}
                </SH>

                {/* Legenda de cores */}
                {pivotMetric !== 'vol' && (
                  <div className="flex gap-4 text-[10px] mb-3 flex-wrap">
                    {isDias ? (
                      <>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300 inline-block" />≤ 30 dias</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sky-100 border border-sky-300 inline-block" />31 – 60 dias</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300 inline-block" />61 – 90 dias</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300 inline-block" />&gt; 90 dias</span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300 inline-block" />≥ 5%</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sky-100 border border-sky-300 inline-block" />2% – 5%</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300 inline-block" />0% – 2%</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300 inline-block" />Negativo</span>
                      </>
                    )}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="sticky left-0 bg-white z-10 text-left py-2 pr-3 font-semibold text-slate-500 uppercase tracking-wide text-[10px] min-w-[120px]">
                          {pivotGrouping === 'familia' ? 'Família' : 'Modelo'}
                        </th>
                        {meses.map(mo => (
                          <th key={mo} className="text-center py-2 px-2 font-semibold text-slate-400 uppercase tracking-wide text-[10px] min-w-[56px]">
                            {MS[mo - 1]}
                          </th>
                        ))}
                        <th className="text-center py-2 px-2 font-semibold text-slate-600 uppercase tracking-wide text-[10px] min-w-[56px]">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, ri) => (
                        <tr key={row.name} className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${ri % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                          <td className="sticky left-0 bg-inherit z-10 py-2 pr-3 font-medium text-slate-700 truncate max-w-[160px]" title={row.name}>
                            {row.name}
                          </td>
                          {meses.map(mo => {
                            const cell = row.cells[mo] ?? { vol: 0, lbPct: 0, margPct: 0 };
                            return (
                              <td key={mo} className={`text-center py-2 px-2 tabular-nums ${cellBg(cell)} ${cellColor(cell)}`}>
                                {fmtCell(cell)}
                              </td>
                            );
                          })}
                          <td className={`text-center py-2 px-2 tabular-nums font-bold ${cellBg(row.total)} ${cellColor(row.total)}`}>
                            {fmtCell(row.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-50">
                        <td className="sticky left-0 bg-slate-50 z-10 py-2 pr-3 font-bold text-slate-700 uppercase text-[10px] tracking-wide">
                          Total
                        </td>
                        {meses.map(mo => {
                          const cell = (totals as Record<number, { vol: number; lbPct: number; margPct: number; mediaDias: number; medianaDias: number }>)[mo] ?? { vol: 0, lbPct: 0, margPct: 0, mediaDias: 0, medianaDias: 0 };
                          return (
                            <td key={mo} className={`text-center py-2 px-2 tabular-nums font-bold ${cellBg(cell)} ${cellColor(cell)}`}>
                              {fmtCell(cell)}
                            </td>
                          );
                        })}
                        <td className={`text-center py-2 px-2 tabular-nums font-bold text-slate-800 ${grandTotal ? cellBg(grandTotal) : ''}`}>
                          {grandTotal ? fmtCell(grandTotal) : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ── Performance por Vendedor ────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            {/* Header com sort dinâmico */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Performance por Vendedor — {periodLabel}</span>
                {vendorData.length > 0 && (
                  <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">{vendorData.length} vendedor(es)</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 mr-1">Ordenar por:</span>
                {(Object.entries(VENDOR_SORT_CFG) as [VendorSort, { label: string }][]).map(([k, cfg]) => (
                  <Pill key={k} label={cfg.label} active={vendorSort === k} onClick={() => setVendorSort(k)} />
                ))}
              </div>
            </div>

            {vendorData.length === 0 ? <Empty /> : (
              <>
                {/* Top 3 — Cards executivos */}
                <div className={`grid gap-4 mb-5 ${vendorData.length === 1 ? 'grid-cols-1' : vendorData.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {vendorData.slice(0, 3).map((v, i) => {
                    const volPct   = totalVol > 0 ? v.vol / totalVol * 100 : 0;
                    const bestVal  = (vendorData[0]?.[vendorSort] ?? 1) as number;
                    const barPct   = bestVal > 0 ? Math.max(0, (v[vendorSort] as number) / bestVal * 100) : 0;
                    const aboveAvg = v.marg >= avgMarg;
                    const bg = i === 0 ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50'
                      : i === 1    ? 'border-slate-300 bg-gradient-to-br from-slate-50 to-gray-50'
                                   : 'border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50';
                    return (
                      <div key={v.name} className={`rounded-2xl border-2 p-5 relative overflow-hidden ${bg}`}>
                        <div className="absolute top-3 right-3 text-2xl select-none">{['🥇','🥈','🥉'][i]}</div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shadow-md flex-shrink-0"
                            style={{ background: avatarColor(v.name) }}>
                            {getInitials(v.name)}
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MEDAL_COLOR[i] }}>#{i + 1}</p>
                            <p className="text-sm font-bold text-slate-800 leading-tight">{v.name}</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-0.5">Resultado Sorana</p>
                        <p className={`text-xl font-bold font-mono mb-1 ${v.res >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmtBRLF(v.res)}</p>
                        <div className="w-full bg-white/60 rounded-full h-1.5 mb-3">
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${barPct}%`, background: MEDAL_COLOR[i] }} />
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                          <div>
                            <p className="text-slate-400 text-[10px]">Volume</p>
                            <p className="font-semibold text-slate-700">{v.vol} <span className="text-slate-400 font-normal">({fmtPct(volPct, 1)} vol.)</span></p>
                            {projFactor !== null && (
                              <p className="text-[10px] text-blue-500 font-semibold mt-0.5">≈ {Math.round(v.vol * projFactor)} proj. mês</p>
                            )}
                          </div>
                          <div>
                            <p className="text-slate-400 text-[10px]">% Rentabilidade</p>
                            <p className={`font-bold flex items-center gap-1 ${v.marg < 0 ? 'text-red-600' : aboveAvg ? 'text-emerald-600' : 'text-amber-600'}`}>
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${v.marg < 0 ? 'bg-red-500' : aboveAvg ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                              {v.marg < 0 ? <TrendingDown className="w-3 h-3" /> : aboveAvg ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {fmtPct(v.marg)}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400 text-[10px]">Lucro Bruto</p>
                            <p className="font-semibold text-indigo-700">{fmtBRLF(v.lb)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 text-[10px]">Rem. Vendedor</p>
                            <p className="font-semibold text-slate-600">{fmtBRLF(v.remVendedor)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tabela colapsável (a partir do #4) */}
                {vendorData.length > 3 && (
                  <>
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            {['#', 'Vendedor', 'Vol.', '% Grupo', 'Lucro Bruto', 'Resultado', 'Margem', 'Rem. Vendedor'].map(h => (
                              <th key={h} className={`px-3 py-2.5 text-slate-500 font-semibold ${h === 'Vendedor' ? 'text-left' : 'text-right'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {vendorsVisible.slice(3).map((v, i) => {
                            const aboveAvg = v.marg >= avgMarg;
                            return (
                              <tr key={v.name} className={`border-b border-slate-100 hover:bg-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                                <td className="px-3 py-2 text-slate-400 font-medium text-right">#{i + 4}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                      style={{ background: avatarColor(v.name) }}>
                                      {getInitials(v.name)}
                                    </div>
                                    <span className="text-slate-700 font-medium">{v.name}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right text-slate-600">{v.vol}</td>
                                <td className="px-3 py-2 text-right text-slate-500">{totalVol > 0 ? fmtPct(v.vol / totalVol * 100) : '—'}</td>
                                <td className="px-3 py-2 text-right font-mono text-indigo-600">{fmtBRL(v.lb)}</td>
                                <td className={`px-3 py-2 text-right font-mono font-semibold ${v.res >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtBRL(v.res)}</td>
                                <td className={`px-3 py-2 text-right font-semibold ${aboveAvg ? 'text-emerald-600' : 'text-amber-600'}`}>
                                  <span className="flex items-center justify-end gap-0.5">
                                    {aboveAvg ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {fmtPct(v.marg)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-slate-500">{fmtBRL(v.remVendedor)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Botão mostrar mais / menos */}
                    {vendorData.length > 8 && (
                      <button onClick={() => setShowAllVendors(!showAllVendors)}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-all">
                        {showAllVendors
                          ? <><ChevronUp className="w-3.5 h-3.5" /> Mostrar menos</>
                          : <><ChevronDown className="w-3.5 h-3.5" /> Ver mais {vendorData.length - 8} vendedor(es)</>}
                      </button>
                    )}
                  </>
                )}
                <p className="text-[10px] text-slate-400 mt-2 text-right">
                  ▲▼ vs margem média do grupo: <strong>{fmtPct(avgMarg)}</strong>
                </p>
              </>
            )}
          </div>

          {/* ── Remunerações e Comissões — ranking ───────────────────────────── */}
          {comissoesData.length > 0 && comissoesData[0].total > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              {/* Header + pills */}
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <SH>Remunerações e Comissões — {periodLabel}</SH>
                <div className="flex items-center gap-2 flex-wrap">
                  {([
                    { key: 'total',   label: 'Total Folha' },
                    { key: 'com',     label: 'Comissão' },
                    { key: 'dsr',     label: 'DSR' },
                    { key: 'provEnc', label: 'Prov.+Enc.' },
                  ] as { key: ComissaoMode; label: string }[]).map(opt => (
                    <button key={opt.key} onClick={() => setComissaoMode(opt.key)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                        comissaoMode === opt.key
                          ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Sub-totais */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Total Folha', value: metrics.remVendedor, color: '#ef4444', bcolor: 'border-red-300' },
                  { label: 'Comissão',   value: comissoesData.reduce((s, d) => s + d.com, 0),     color: '#3b82f6', bcolor: 'border-blue-300' },
                  { label: 'DSR',        value: comissoesData.reduce((s, d) => s + d.dsr, 0),     color: '#10b981', bcolor: 'border-emerald-300' },
                  { label: 'Prov.+Enc.', value: comissoesData.reduce((s, d) => s + d.provEnc, 0), color: '#64748b', bcolor: 'border-slate-300' },
                ].map(item => (
                  <div key={item.label} className={`rounded-xl bg-slate-50 border ${item.bcolor} border-l-4 px-4 py-3`}>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-1">{item.label}</p>
                    <p className="text-sm font-bold font-mono" style={{ color: item.color }}>{fmtBRL(item.value)}</p>
                    {item.label !== 'Total Folha' && metrics.remVendedor > 0 && (
                      <p className="text-[10px] text-slate-400 mt-0.5">{fmtPct(item.value / metrics.remVendedor * 100)} do total</p>
                    )}
                    {item.label === 'Total Folha' && metrics.recLiq > 0 && (
                      <p className="text-[10px] text-slate-400 mt-0.5">{fmtPct(item.value / metrics.recLiq * 100)} da receita</p>
                    )}
                  </div>
                ))}
              </div>
              {/* Ranking */}
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Ranking individual</p>
              <div className="space-y-0.5">
                {comissoesVisible.map((v, i) => {
                  const barColors: Record<ComissaoMode, string> = { total: '#ef4444', com: '#3b82f6', dsr: '#10b981', provEnc: '#64748b' };
                  const displayVal = comissaoMode === 'com' ? v.com : comissaoMode === 'dsr' ? v.dsr : comissaoMode === 'provEnc' ? v.provEnc : v.total;
                  const topVal = (comissoesData[0]?.[comissaoMode] ?? 1) as number;
                  const barPct = topVal > 0 ? Math.min(100, (displayVal / topVal) * 100) : 0;
                  const barColor = barColors[comissaoMode];
                  return (
                    <div key={v.name} className="flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-slate-50 transition-colors group">
                      <span className="text-xs font-bold text-slate-300 w-5 text-right flex-shrink-0">{i + 1}</span>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                        style={{ background: avatarColor(v.name) }}>
                        {getInitials(v.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-700 truncate">{v.name}</span>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {comissaoMode === 'total' && (
                              <div className="hidden sm:flex gap-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] text-blue-500 font-mono tabular-nums">Com {fmtBRL(v.com)}</span>
                                <span className="text-[10px] text-emerald-500 font-mono tabular-nums">DSR {fmtBRL(v.dsr)}</span>
                                <span className="text-[10px] text-slate-400 font-mono tabular-nums">Enc {fmtBRL(v.provEnc)}</span>
                              </div>
                            )}
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400 leading-none mb-0.5">
                                {comissaoMode === 'total' ? 'Total Folha' : comissaoMode === 'com' ? 'Comissão' : comissaoMode === 'dsr' ? 'DSR' : 'Prov.+Enc.'}
                              </p>
                              <p className="text-xs font-mono font-bold tabular-nums" style={{ color: barColor }}>{fmtBRL(displayVal)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1">
                          <div className="h-1 rounded-full transition-all duration-300" style={{ width: `${barPct}%`, background: barColor }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {comissoesData.length > 8 && (
                <button onClick={() => setShowAllComissoes(v => !v)}
                  className="mt-3 w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-700 py-2 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5">
                  {showAllComissoes
                    ? <><ChevronUp className="w-3.5 h-3.5" /> Mostrar menos</>
                    : <><ChevronDown className="w-3.5 h-3.5" /> Ver todos os {comissoesData.length} vendedores</>}
                </button>
              )}
            </div>
          )}

          {/* ── Comparativo de Períodos ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <SH>Comparativo de Períodos</SH>
              <button onClick={addPeriod}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm">
                <Plus className="w-3.5 h-3.5" /> Adicionar Período
              </button>
            </div>
            <div className="flex flex-wrap gap-3 mb-5">
              {periods.map((p, pi) => (
                <div key={p.id} className={`flex flex-col gap-1.5 rounded-xl border px-3 py-2 text-xs ${pi === 0 ? 'border-amber-300 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
                  {/* Linha 1: Período + Vendedor */}
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${pi === 0 ? 'bg-amber-200 text-amber-800' : 'bg-blue-200 text-blue-800'}`}>
                      {pi === 0 ? 'Base' : `#${pi}`}
                    </span>
                    <select value={p.year} onChange={e => updatePeriod(p.id, { year: +e.target.value })}
                      className="border border-slate-200 rounded-lg px-1.5 py-1 bg-white text-slate-700 text-xs focus:outline-none">
                      {availYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={p.gran} onChange={e => updatePeriod(p.id, { gran: e.target.value as 'mes' | 'ano' })}
                      className="border border-slate-200 rounded-lg px-1.5 py-1 bg-white text-slate-700 text-xs focus:outline-none">
                      <option value="mes">Mês</option>
                      <option value="ano">Ano</option>
                    </select>
                    {p.gran === 'mes' && (
                      <select value={p.month} onChange={e => updatePeriod(p.id, { month: +e.target.value })}
                        className="border border-slate-200 rounded-lg px-1.5 py-1 bg-white text-slate-700 text-xs focus:outline-none">
                        {MS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                      </select>
                    )}
                    <select value={p.vendedor} onChange={e => updatePeriod(p.id, { vendedor: e.target.value })}
                      className="border border-slate-200 rounded-lg px-1.5 py-1 bg-white text-slate-700 text-xs max-w-[130px] focus:outline-none">
                      {availVendedores.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    {pi > 0 && (
                      <button onClick={() => removePeriod(p.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Linha 2: Família + Modelo */}
                  {(() => {
                    const periodoFamilias = ['Todas', ...Array.from(new Set(
                      allRows.filter(r => getYr(r) === p.year).map(r => normalizeModelo(r.modelo ?? '')).filter(f => f !== '(sem modelo)')
                    )).sort()];
                    const periodoModelos = p.familia === 'Todas' ? [] : ['Todos', ...Array.from(new Set(
                      allRows.filter(r => getYr(r) === p.year && normalizeModelo(r.modelo ?? '') === p.familia).map(r => r.modelo?.trim() || '').filter(Boolean)
                    )).sort()];
                    return (
                      <div className="flex items-center gap-2 pl-1">
                        <span className="text-slate-400 text-[10px]">Família</span>
                        <select value={p.familia} onChange={e => updatePeriod(p.id, { familia: e.target.value, modelo: 'Todos' })}
                          className="border border-slate-200 rounded-lg px-1.5 py-1 bg-white text-slate-600 text-xs focus:outline-none">
                          {periodoFamilias.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <span className="text-slate-400 text-[10px]">Modelo</span>
                        <select value={p.modelo} onChange={e => updatePeriod(p.id, { modelo: e.target.value })}
                          disabled={p.familia === 'Todas'}
                          className={`border border-slate-200 rounded-lg px-1.5 py-1 text-xs focus:outline-none ${p.familia === 'Todas' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-600'}`}>
                          {periodoModelos.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-700 to-slate-600">
                    <th className="text-left px-4 py-3 text-white font-semibold w-52">Métrica</th>
                    {periodLabels.map((lbl, i) => (
                      <th key={i} className="text-right px-4 py-3 font-semibold" style={{ color: i === 0 ? '#fcd34d' : '#93c5fd' }}>
                        {i === 0 ? '● ' : '○ '}{lbl}
                      </th>
                    ))}
                    {periods.length > 1 && <th className="text-right px-4 py-3 text-slate-300 font-semibold">Δ vs Base</th>}
                  </tr>
                </thead>
                <tbody>
                  {([
                    { label: 'Qtd. de Vendas',    get: (m: Agg) => m.netVol,        fmt: (v: number) => String(v), hl: false },
                    { label: 'Giro de Estoque',    get: (m: Agg) => m.medianaDias,   fmt: (v: number, pm: Agg) => v > 0 ? `Md: ${Math.round(v)}d · μ: ${Math.round(pm.mediaDias)}d` : '—', hl: false },
                    { label: 'Receita Bruta',      get: (m: Agg) => m.receita,       fmt: fmtBRLF, hl: false },
                    { label: 'Receita Líquida',    get: (m: Agg) => m.recLiq,        fmt: fmtBRLF, hl: false },
                    { label: 'Custo',              get: (m: Agg) => m.custo,         fmt: fmtBRLF, hl: false },
                    { label: 'Lucro Bruto',        get: (m: Agg) => m.lb,            fmt: fmtBRLF, hl: false },
                    { label: 'Margem Bruta %',     get: (m: Agg) => m.lbPct,        fmt: (v: number) => fmtPct(v), hl: false },
                    { label: 'Ticket Médio',       get: (m: Agg) => m.ticketReceita, fmt: (v: number, pm: Agg) => pm.netVol > 0 ? fmtBRLF(v) : '—', hl: false },
                    { label: 'Lucro c/ Bônus',     get: (m: Agg) => m.lcb,          fmt: fmtBRLF, hl: false },
                    { label: 'Resultado Sorana',   get: (m: Agg) => m.res,           fmt: fmtBRLF, hl: true },
                    { label: '% Resultado Sorana', get: (m: Agg) => m.marg,          fmt: (v: number) => fmtPct(v), hl: true },
                    { label: 'Total Folha Vendedor', get: (m: Agg) => m.remVendedor,   fmt: fmtBRLF, hl: false },
                    { label: 'Total Bônus',        get: (m: Agg) => m.bon,           fmt: fmtBRLF, hl: false },
                    { label: 'Juros de Estoque',   get: (m: Agg) => m.juros,         fmt: fmtBRLF, hl: false },
                  ] as { label: string; get: (m: Agg) => number; fmt: (v: number, m: Agg) => string; hl: boolean }[]).map((row, ri) => {
                    const base = periodMetrics[0];
                    const comp = periodMetrics[1];
                    const bVal = base ? row.get(base) : null;
                    const cVal = comp ? row.get(comp) : null;
                    const delta = bVal !== null && cVal !== null ? cVal - bVal : null;
                    const deltaPct = bVal !== null && bVal !== 0 && delta !== null ? delta / Math.abs(bVal) * 100 : null;
                    return (
                      <tr key={ri} className={`border-b border-slate-100 hover:bg-slate-100/60 ${row.hl ? 'bg-blue-50/60' : ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                        <td className={`px-4 py-2.5 font-semibold ${row.hl ? 'text-blue-700' : 'text-slate-600'}`}>{row.label}</td>
                        {periodMetrics.map((pm, pi) => (
                          <td key={pi} className={`px-4 py-2.5 text-right font-mono ${row.hl ? 'font-bold text-blue-700' : 'text-slate-700'}`}>
                            {pm ? row.fmt(row.get(pm), pm) : <span className="text-slate-300">—</span>}
                          </td>
                        ))}
                        {periods.length > 1 && (
                          <td className="px-4 py-2.5 text-right font-mono">
                            {delta !== null && deltaPct !== null ? (
                              <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold rounded px-1.5 py-0.5 ${delta > 0 ? 'bg-emerald-100 text-emerald-700' : delta < 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                {delta > 0 ? '+' : ''}{deltaPct.toFixed(1)}%
                              </span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Devoluções V07 ──────────────────────────────────────────────── */}
          {devolucoes.length > 0 && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
              <button onClick={() => setShowDevol(!showDevol)}
                className="w-full flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-800">
                    Devoluções (V07) — {devolucoes.length} registro(s) deduzido(s) do volume
                  </span>
                </div>
                {showDevol ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
              </button>
              {showDevol && (
                <div className="px-5 pb-4 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-amber-200 text-amber-700">
                        {['Chassi', 'Modelo', 'Vendedor', 'Data', 'Valor Venda', 'Resultado'].map((h, i) => (
                          <th key={h} className={`py-1.5 px-2 font-semibold ${i >= 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {devolucoes.map(r => {
                        const c = calcNovos(r, aliqBon, dsrFor(dsrCfg, r.dataVenda));
                        return (
                          <tr key={r.id} className="border-b border-amber-100 hover:bg-amber-100/40">
                            <td className="py-1.5 px-2 font-mono text-slate-500">{r.chassi || '—'}</td>
                            <td className="py-1.5 px-2 text-slate-700">{r.modelo || '—'}</td>
                            <td className="py-1.5 px-2 text-slate-700">{r.vendedor || '—'}</td>
                            <td className="py-1.5 px-2 font-mono text-slate-500">{r.dataVenda || '—'}</td>
                            <td className="py-1.5 px-2 text-right font-mono text-slate-600">{fmtBRLF(n(r.valorVenda))}</td>
                            <td className={`py-1.5 px-2 text-right font-mono font-semibold ${c.resultado < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                              {fmtBRLF(c.resultado)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </>
      )}
    </div>
  );
}
