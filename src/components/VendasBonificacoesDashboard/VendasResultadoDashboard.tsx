import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Download, Pencil, Check, X, MessageSquare, Highlighter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  type VendasResultadoSubTab,
  type VendasResultadoRow,
  loadVendasResultadoRows,
  saveVendasResultadoRows,
  emptyVendasResultadoRow,
} from './vendasResultadoStorage';
import { loadAliquotas, loadRemuneracao, loadVendasDsr, type RemuneracaoData, type RemuneracaoModalidade, type FaixaBonus, type VendasDsrConfig } from './vendedoresRemuneracaoStorage';
import { loadModelos, loadRegras, getRegra, type VeiculoModelo, type VeiculoRegra } from './veiculosRegrasStorage';
import { loadJurosRotativoRows, type JurosRotativoRow } from './jurosRotativoStorage';
import { loadVendasRows, type VendasRow as BlindagemRow } from './vendasStorage';
import { loadRegistroRows, type RegistroVendasRow } from './registroVendasStorage';

// ─── Helpers numéricos ────────────────────────────────────────────────────────
function n(v: string): number { return parseFloat(String(v).replace(',', '.')) || 0; }
function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

// ─── Impostos automáticos – Veículos Usados ──────────────────────────────────
// Parte 1 (sempre): Vlr de Venda × 1,8%
// Parte 2 (condicional): se (Vlr de Venda − Valor Custo − Parte1) > 0 → base × 3,65%
function calcImpostosUsados(valorVenda: number, valorCusto: number): number {
  const parte1 = valorVenda * 0.018;
  const base   = valorVenda - valorCusto - parte1;
  return parte1 + (base > 0 ? base * 0.0365 : 0);
}

// ─── Dias de Estoque: calcula a partir de dtaEntrada e dtaVenda do Registros ─
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

function applyDiasEstoqueFromRegistros(
  rows: VendasResultadoRow[],
  registroMap: Map<string, RegistroVendasRow>,
): VendasResultadoRow[] {
  return rows.map(r => {
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

function buildRegistroMap(regs: RegistroVendasRow[]): Map<string, RegistroVendasRow> {
  const m = new Map<string, RegistroVendasRow>();
  for (const r of regs) m.set((r.chassi ?? '').trim().toUpperCase(), r);
  return m;
}

// ─── Cálculos derivados ───────────────────────────────────────────────────────
// ─── Helper DSR ───────────────────────────────────────────────────────────────
function getDsrPct(configs: VendasDsrConfig[], dateStr: string): number {
  let ano: number | null = null, mes: number | null = null;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
    ano = parseInt(dateStr.split('/')[2]);
    mes = parseInt(dateStr.split('/')[1]);
  } else if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    ano = parseInt(dateStr.split('-')[0]);
    mes = parseInt(dateStr.split('-')[1]);
  }
  if (!ano || !mes) return 0;
  const cfg = configs.find(c => c.ano === ano && c.mes === mes);
  return cfg ? (parseFloat(cfg.percentual) || 0) : 0;
}

function calcRow(r: VendasResultadoRow, isDireta = false, isUsados = false, aliquotaBonPct = 0, dsrPct = 0) {
  const comissaoBruta      = isDireta ? n(r.valorVenda) * n(r.pctComissao) / 100 : 0;
  const impostosBase       = isUsados ? calcImpostosUsados(n(r.valorVenda), n(r.valorCusto)) : n(r.impostos);
  const recLiq             = isDireta ? comissaoBruta - impostosBase : n(r.valorVenda) - impostosBase;
  const comissaoLiquidaPct = n(r.valorVenda) !== 0 ? (recLiq / n(r.valorVenda)) * 100 : 0;
  const impostosBonus      = !isDireta && !isUsados ? (n(r.bonusVarejo) + n(r.bonusTradeIn ?? '')) * (aliquotaBonPct / 100) : 0;
  const impostosTradeIn    = isUsados ? n(r.bonusVarejo) * (aliquotaBonPct / 100) : 0;
  const lucroBruto         = recLiq - n(r.valorCusto) + n(r.bonusVarejo) + (!isDireta && !isUsados ? n(r.bonusTradeIn ?? '') : 0) - (!isDireta && !isUsados ? impostosBonus : 0) - (isUsados ? impostosTradeIn : 0);
  const lucroBrutoPct      = recLiq !== 0 ? (lucroBruto / recLiq) * 100 : 0;
  const bonuses            = n(r.bonusPIV) + n(r.bonusSIQ) + n(r.bonusPIVE)
                           + n(r.bonusAdic1) + n(r.bonusAdic2) + n(r.bonusAdic3);
  const impostosBonificacoes = !isDireta && !isUsados ? bonuses * (aliquotaBonPct / 100) : 0;
  const lucroComBon        = (isDireta ? recLiq : lucroBruto) + bonuses - (!isDireta && !isUsados ? impostosBonificacoes : 0);
  const lucroComBonPct     = recLiq !== 0 ? (lucroComBon / recLiq) * 100 : 0;
  const dsr                = n(r.comissaoVenda) * dsrPct / 100;
  // Provisões: Férias(base/12) + 13°(base/12) + 1/3 Férias(base/36) = base * 7/36
  const baseProvEnc        = n(r.comissaoVenda) + dsr;
  const provisoes          = baseProvEnc * (7 / 36);
  // Encargos: (base + provisões) * 35,8%  (27,8% INSS + 8% FGTS)
  const encargos           = (baseProvEnc + provisoes) * 0.358;
  // Blindagem: valor já armazenado líquido (bruto - 14,25%)
  const resultado          = (isUsados ? lucroBruto : lucroComBon) + n(r.recBlindagem) + n(r.recFinanciamento) + n(r.recDespachante)
                           - (isDireta ? 0 : n(r.jurosEstoque))
                           - (!isUsados ? n(r.ciDesconto) + n(r.cortesiaEmplacamento) : 0)
                           - (isUsados ? n(r.cortesiaTransferencia) : 0)
                           - n(r.comissaoVenda) - dsr
                           - provisoes - encargos - n(r.outrasDespesas);
  const resultadoPct       = recLiq !== 0 ? (resultado / recLiq) * 100 : 0;
  return { comissaoBruta, impostosBase, recLiq, comissaoLiquidaPct, impostosBonus, impostosTradeIn, lucroBruto, lucroBrutoPct, impostosBonificacoes, lucroComBon, lucroComBonPct, dsr, provisoes, encargos, resultado, resultadoPct };
}

// ─── Auto-preenchimento PIV/SIQ/PIVE ────────────────────────────────────────
function applyAutoFill(
  rows: VendasResultadoRow[],
  modelos: VeiculoModelo[],
  regras: VeiculoRegra[],
): VendasResultadoRow[] {
  return rows.map(row => {
    // Só aplica se pelo menos um campo estiver vazio
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

// Inverte o sinal de PIV/SIQ/PIVE de uma linha ao mudar a transação
function applyTransacaoSign(rows: VendasResultadoRow[], changedId: string, newTransacao: string): VendasResultadoRow[] {
  return rows.map(row => {
    if (row.id !== changedId) return row;
    const factor = newTransacao === 'V07' ? -1 : 1;
    const applySign = (v: string) => {
      if (!v) return v;
      const num = Math.abs(parseFloat(v));
      if (isNaN(num)) return v;
      return (num * factor).toFixed(2);
    };
    return {
      ...row,
      bonusPIV:  applySign(row.bonusPIV),
      bonusSIQ:  applySign(row.bonusSIQ),
      bonusPIVE: applySign(row.bonusPIVE),
    };
  });
}

// ─── Auto-preenchimento Juros Estoque ─────────────────────────────────────────
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

// ─── Auto-preenchimento Comissão de Venda ────────────────────────────────────
function getDateParts(dateStr: string): { year: number; month: number } | null {
  if (!dateStr) return null;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
    return { year: parseInt(dateStr.split('/')[2]), month: parseInt(dateStr.split('/')[1]) };
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return { year: parseInt(dateStr.split('-')[0]), month: parseInt(dateStr.split('-')[1]) };
  }
  return null;
}

function findFaixaBonus(faixas: FaixaBonus[], qtd: number): FaixaBonus | null {
  for (const f of faixas) {
    const de = parseInt(f.de) || 0;
    const ate = f.ate ? parseInt(f.ate) : Infinity;
    if (qtd >= de && qtd <= ate) return f;
  }
  return null;
}

function buildVendorMonthCounts(rows: VendasResultadoRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const vendedor = (row.vendedor ?? '').trim().toLowerCase();
    if (!vendedor) continue;
    const period = getDateParts(row.dataVenda);
    if (!period) continue;
    const key = `${vendedor}|${period.year}|${period.month}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function applyComissaoAutoFill(
  rows: VendasResultadoRow[],
  modalidade: RemuneracaoModalidade,
  isUsados: boolean,
): VendasResultadoRow[] {
  const vendorMonthCounts = buildVendorMonthCounts(rows);
  return rows.map(row => {
    if (row.comissaoVenda !== '') return row;
    const vv = n(row.valorVenda);
    if (vv === 0) return row;
    const recLiq = isUsados ? vv - calcImpostosUsados(vv, n(row.valorCusto)) : vv - n(row.impostos);
    const lb = recLiq - n(row.valorCusto) + n(row.bonusVarejo) + (!isUsados ? n(row.bonusTradeIn ?? '') : 0);
    // 1. Comissão s/ Venda
    const pct1 = parseFloat(String(modalidade.comissaoVenda).replace(',', '.')) || 0;
    const com1 = vv * pct1 / 100;
    // 2. Bônus de Produtividade (qtd vendas do vendedor no mesmo mês/aba)
    const vendedor = (row.vendedor ?? '').trim().toLowerCase();
    const period = getDateParts(row.dataVenda);
    let com2 = 0;
    if (vendedor && period) {
      const key = `${vendedor}|${period.year}|${period.month}`;
      const qtd = vendorMonthCounts.get(key) ?? 0;
      const faixa = findFaixaBonus(modalidade.faixasBonus, qtd);
      if (faixa) {
        com2 = vv * (parseFloat(String(faixa.percentual).replace(',', '.')) || 0) / 100;
      }
    }
    // 3. Comissão s/ Lucro Bruto (sem descontar impostos sobre bônus)
    const pct3 = parseFloat(String(modalidade.comissaoLucroBruto).replace(',', '.')) || 0;
    const com3 = lb * pct3 / 100;
    const total = com1 + com2 + com3;
    if (total === 0) return row;
    return { ...row, comissaoVenda: total.toFixed(2) };
  });
}

// ─── Blindagem auto-fill ─────────────────────────────────────────────────────────────────
function buildBlindagemMap(blindagemRows: BlindagemRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of blindagemRows) {
    if (!r.revenda || r.revenda.trim().toUpperCase() !== 'VW') continue;
    const chassi = r.chassi?.trim();
    if (!chassi || !r.comissaoBrutaSorana) continue;
    // Indexa pelos últimos 7 caracteres (maiúsculo)
    const key = chassi.slice(-7).toUpperCase();
    map.set(key, r.comissaoBrutaSorana);
  }
  return map;
}

function applyBlindagemAutoFill(
  rows: VendasResultadoRow[],
  blindagemMap: Map<string, string>,
): VendasResultadoRow[] {
  if (blindagemMap.size === 0) return rows;
  return rows.map(row => {
    const chassi = row.chassi?.trim();
    if (!chassi) return row;
    const key = chassi.slice(-7).toUpperCase();
    const valor = blindagemMap.get(key);
    if (valor === undefined) return row;
    // Armazena já o valor líquido: bruto - 14,25% de impostos
    const liquido = (parseFloat(valor) || 0) * (1 - 0.1425);
    return { ...row, recBlindagem: liquido.toFixed(2) };
  });
}

// ─── Auto-preenchimento Comissão Venda p/ aba Direta/Frotista ────────────────
function applyComissaoAutoFillDireta(
  rows: VendasResultadoRow[],
  modalidade: RemuneracaoModalidade,
): VendasResultadoRow[] {
  const vendorMonthCounts = buildVendorMonthCounts(rows);
  return rows.map(row => {
    const vv = n(row.valorVenda);
    if (vv === 0) return row;
    // Lucro bruto para cálculo da comissão: Comissão Bruta - CI Desconto - Cort. Emplacamento - Outras Despesas
    // Se % Comissão não estiver preenchido, lb = 0 e com3 = 0, mas com1 (% s/ Venda) ainda é calculado
    const pctComissao = n(row.pctComissao);
    const comissaoBruta = vv * pctComissao / 100;
    const lb = comissaoBruta - n(row.ciDesconto) - n(row.cortesiaEmplacamento) - n(row.outrasDespesas);
    // 1. Comissão s/ Venda
    const pct1 = parseFloat(String(modalidade.comissaoVenda).replace(',', '.')) || 0;
    const com1 = vv * pct1 / 100;
    // 2. Bônus de Produtividade
    const vendedor = (row.vendedor ?? '').trim().toLowerCase();
    const period = getDateParts(row.dataVenda);
    let com2 = 0;
    if (vendedor && period) {
      const key = `${vendedor}|${period.year}|${period.month}`;
      const qtd = vendorMonthCounts.get(key) ?? 0;
      const faixa = findFaixaBonus(modalidade.faixasBonus, qtd);
      if (faixa) {
        com2 = vv * (parseFloat(String(faixa.percentual).replace(',', '.')) || 0) / 100;
      }
    }
    // 3. Comissão s/ Lucro Bruto
    const pct3 = parseFloat(String(modalidade.comissaoLucroBruto).replace(',', '.')) || 0;
    const com3 = lb * pct3 / 100;
    const total = com1 + com2 + com3;
    if (total === 0) return row;
    return { ...row, comissaoVenda: total.toFixed(2) };
  });
}

// ─── Meses ────────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTH_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const SUB_TABS: { id: VendasResultadoSubTab; label: string }[] = [
  { id: 'novos',  label: 'Vendas Veículos Novos' },
  { id: 'direta', label: 'Vendas Venda Direta / Frotista' },
  { id: 'usados', label: 'Vendas Veículos Usados' },
];

// ─── Colunas editáveis ────────────────────────────────────────────────────────
type EditableKey = keyof Omit<VendasResultadoRow, 'id' | 'highlight' | 'annotation'>;

interface ColDef {
  key: EditableKey;
  label: string;
  type: 'text' | 'date' | 'number' | 'currency';
  calc?: true;
  w?: string;
}

const COLS: ColDef[] = [
  { key: 'chassi',           label: 'Chassi',                  type: 'text',     w: 'min-w-[130px]' },
  { key: 'modelo',           label: 'Modelo',                  type: 'text',     w: 'min-w-[160px]' },
  { key: 'cor',              label: 'Cor',                     type: 'text',     w: 'min-w-[100px]' },
  { key: 'dataVenda',        label: 'Data da Venda',           type: 'date',     w: 'min-w-[110px]' },
  { key: 'diasEstoque',      label: 'Dias em Estoque',         type: 'number',   w: 'min-w-[90px]' },
  { key: 'diasCarencia',     label: 'Dias de Carência',        type: 'number',   w: 'min-w-[90px]' },
  { key: 'vendedor',         label: 'Vendedor',                type: 'text',     w: 'min-w-[130px]' },
  { key: 'transacao',        label: 'Transação',               type: 'text',     w: 'min-w-[90px]' },
  { key: 'valorVenda',       label: 'Valor de Venda',          type: 'currency', w: 'min-w-[120px]' },
  { key: 'impostos',         label: 'Impostos',                type: 'currency', w: 'min-w-[110px]' },
  // calculada: Receita Líquida
  { key: 'valorCusto',       label: 'Valor de Custo',          type: 'currency', w: 'min-w-[120px]' },
  { key: 'bonusVarejo',      label: 'Bônus Varejo',            type: 'currency', w: 'min-w-[110px]' },
  { key: 'bonusTradeIn',     label: 'Bônus Trade IN',          type: 'currency', w: 'min-w-[110px]' },
  // calculadas: Lucro Bruto, Lucro Bruto %
  { key: 'bonusPIV',         label: 'Bônus PIV',               type: 'currency', w: 'min-w-[100px]' },
  { key: 'bonusSIQ',         label: 'Bônus SIQ',               type: 'currency', w: 'min-w-[100px]' },
  { key: 'bonusPIVE',        label: 'Bônus PIVE',              type: 'currency', w: 'min-w-[100px]' },
  { key: 'bonusAdic1',       label: 'Bônus Adic 1',            type: 'currency', w: 'min-w-[100px]' },
  { key: 'bonusAdic2',       label: 'Bônus Adic 2',            type: 'currency', w: 'min-w-[100px]' },
  { key: 'bonusAdic3',       label: 'Bônus Adic 3',            type: 'currency', w: 'min-w-[100px]' },
  // calculadas: Lucro c/ Bon, % Lucro c/ Bon
  { key: 'recBlindagem',     label: 'Rec. Blindagem',          type: 'currency', w: 'min-w-[120px]' },
  { key: 'recFinanciamento', label: 'Rec. Financiamento',      type: 'currency', w: 'min-w-[140px]' },
  { key: 'recDespachante',   label: 'Rec. Despachante',        type: 'currency', w: 'min-w-[130px]' },
  { key: 'jurosEstoque',     label: 'Juros s/ Estoque',        type: 'currency', w: 'min-w-[120px]' },
  { key: 'comissaoVenda',    label: 'Comissão de Venda',       type: 'currency', w: 'min-w-[130px]' },
  { key: 'dsr',              label: 'DSR',                     type: 'currency', w: 'min-w-[90px]' },
  { key: 'provisoes',        label: 'Provisões',               type: 'currency', w: 'min-w-[100px]' },
  { key: 'encargos',         label: 'Encargos',                type: 'currency', w: 'min-w-[100px]' },
  { key: 'outrasDespesas',   label: 'Outras Despesas',         type: 'currency', w: 'min-w-[120px]' },
  // calculadas: Resultado da Venda, % Resultado
];

// ─── Célula editável ──────────────────────────────────────────────────────────
function EditCell({
  value, type, onSave,
}: { value: string; type: ColDef['type']; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => { onSave(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-0">
        <input
          autoFocus
          type={type === 'date' ? 'text' : type === 'currency' || type === 'number' ? 'text' : 'text'}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          className="border border-emerald-400 rounded px-1 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button onClick={commit} className="text-emerald-600 hover:text-emerald-700 flex-shrink-0"><Check className="w-3 h-3" /></button>
        <button onClick={cancel} className="text-slate-400 hover:text-slate-600 flex-shrink-0"><X className="w-3 h-3" /></button>
      </div>
    );
  }

  const display = (type === 'currency' && value)
    ? `R$ ${fmt(n(value))}`
    : value || <span className="text-slate-300">—</span>;

  return (
    <div
      className="group flex items-center justify-between gap-1 cursor-pointer hover:bg-emerald-50 rounded px-1 py-0.5 min-w-0"
      onClick={() => { setDraft(value); setEditing(true); }}
    >
      <span className={`truncate text-xs ${type === 'currency' ? 'font-mono' : ''}`}>{display}</span>
      <Pencil className="w-2.5 h-2.5 text-slate-300 group-hover:text-emerald-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// ─── Célula calculada (somente leitura) ──────────────────────────────────────
function CalcCell({ value, pct, negative }: { value: number; pct?: boolean; negative?: boolean }) {
  const color = value > 0 ? 'text-emerald-700' : value < 0 ? 'text-red-600' : 'text-slate-400';
  const text = pct ? fmtPct(value) : `R$ ${fmt(value)}`;
  return (
    <div className={`text-xs font-semibold font-mono px-1 py-0.5 ${color} ${negative && value < 0 ? 'bg-red-50 rounded' : ''}`}>
      {text}
    </div>
  );
}

// ─── Export Excel ─────────────────────────────────────────────────────────────
async function exportToExcel(rows: VendasResultadoRow[], sheetName: string, filename: string, isDireta: boolean, isUsados: boolean, aliquotaBonPct = 0) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard'; wb.created = new Date();
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: 'FF10B981' } },
  });

  const headers = isDireta ? [
    'Chassi','Modelo','Cor','Data da Venda','Vendedor','Transação',
    'Valor de Venda','% Comissão','Comissão Bruta','Impostos','Comissão Líquida','% Comissão Líquida',
    'Bônus PIV','Bônus SIQ','Bônus PIVE','Bônus Adic 1','Bônus Adic 2','Bônus Adic 3',
    'Lucro c/ Bon.','% Lucro c/ Bon.',
    'Rec. Blindagem','Rec. Financiamento','Rec. Despachante',
    'CI de Desconto','Cortesia Emplacamento/IPVA','Comissão Venda','DSR','Provisões','Encargos','Outras Despesas',
    'Resultado da Venda','% Resultado da Venda',
  ] : isUsados ? [
    'Nota de Compra','Chassi','Modelo','Cor','NF de Venda','Data da Venda','Dias Estoque',
    'Vendedor','Transação','Valor de Venda','Impostos','Receita Líquida',
    'Valor de Custo','Trade IN','Lucro Bruto','Lucro Bruto %',
    'Rec. Blindagem','Rec. Financiamento','Rec. Despachante',
    'Juros s/ Estoque','Cortesia Transferência','Comissão Venda','DSR','Provisões','Encargos','Outras Despesas',
    'Resultado da Venda','% Resultado da Venda',
  ] : [
    'Nota de Compra','Chassi','Modelo','Cor','NF de Venda','Data da Venda','Dias Estoque','Dias Carência',
    'Vendedor','Transação','Valor de Venda','Impostos','Receita Líquida',
    'Valor de Custo','Bônus Varejo','Bônus Trade IN','Lucro Bruto','Lucro Bruto %',
    'Bônus PIV','Bônus SIQ','Bônus PIVE','Bônus Adic 1','Bônus Adic 2','Bônus Adic 3',
    'Lucro c/ Bon.','% Lucro c/ Bon.',
    'Rec. Blindagem','Rec. Financiamento','Rec. Despachante',
    'Juros s/ Estoque','CI de Desconto','Cortesia Emplacamento/IPVA','Comissão Venda','DSR','Provisões','Encargos','Outras Despesas',
    'Resultado da Venda','% Resultado da Venda',
  ];

  ws.columns = headers.map(() => ({ width: 18 }));

  const today = new Date().toLocaleDateString('pt-BR');
  const titleRow = ws.addRow([`${sheetName} — ${today}`]);
  ws.mergeCells(1, 1, 1, headers.length);
  titleRow.height = 30;
  titleRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 13 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const headerRow = ws.addRow(headers);
  headerRow.height = 36;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: headers.length } };

  const BTHIN = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const BRL = '"R$"\\ #,##0.00';
  const PCT = '#,##0.00"%"';

  rows.forEach((row, ri) => {
    const c = calcRow(row, isDireta, isUsados, aliquotaBonPct);
    const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF0FDF4';
    const vals = isDireta ? [
      row.chassi, row.modelo, row.cor, row.dataVenda, row.vendedor, row.transacao,
      n(row.valorVenda), n(row.pctComissao), c.comissaoBruta, n(row.impostos), c.recLiq, c.comissaoLiquidaPct,
      n(row.bonusPIV), n(row.bonusSIQ), n(row.bonusPIVE),
      n(row.bonusAdic1), n(row.bonusAdic2), n(row.bonusAdic3),
      c.lucroComBon, c.lucroComBonPct,
      n(row.recBlindagem), n(row.recFinanciamento), n(row.recDespachante),
      n(row.ciDesconto), n(row.cortesiaEmplacamento), n(row.comissaoVenda), n(row.dsr),
      c.provisoes, c.encargos, n(row.outrasDespesas),
      c.resultado, c.resultadoPct,
    ] : isUsados ? [
      row.notaCompra, row.chassi, row.modelo, row.cor, row.nfVenda, row.dataVenda,
      n(row.diasEstoque),
      row.vendedor, row.transacao,
      n(row.valorVenda), c.impostosBase, c.recLiq,
      n(row.valorCusto), n(row.bonusVarejo), c.lucroBruto, c.lucroBrutoPct,
      n(row.recBlindagem), n(row.recFinanciamento), n(row.recDespachante),
      n(row.jurosEstoque), n(row.cortesiaTransferencia), n(row.comissaoVenda), n(row.dsr),
      c.provisoes, c.encargos, n(row.outrasDespesas),
      c.resultado, c.resultadoPct,
    ] : [
      row.notaCompra, row.chassi, row.modelo, row.cor, row.nfVenda, row.dataVenda,
      n(row.diasEstoque), n(row.diasCarencia),
      row.vendedor, row.transacao,
      n(row.valorVenda), n(row.impostos), c.recLiq,
      n(row.valorCusto), n(row.bonusVarejo), n(row.bonusTradeIn ?? ''), c.lucroBruto, c.lucroBrutoPct,
      n(row.bonusPIV), n(row.bonusSIQ), n(row.bonusPIVE),
      n(row.bonusAdic1), n(row.bonusAdic2), n(row.bonusAdic3),
      c.lucroComBon, c.lucroComBonPct,
      n(row.recBlindagem), n(row.recFinanciamento), n(row.recDespachante),
      n(row.jurosEstoque), n(row.ciDesconto), n(row.cortesiaEmplacamento), n(row.comissaoVenda), n(row.dsr),
      c.provisoes, c.encargos, n(row.outrasDespesas),
      c.resultado, c.resultadoPct,
    ];
    const dr = ws.addRow(vals);
    dr.height = 17;
    // índices 1-based das colunas de moeda/percentual
    const currencyCols = isDireta
      ? [7,9,10,11,13,14,15,16,17,18,19,21,22,23,24,25,26,27,28,29,30,31]
      : isUsados
        ? [10,11,12,13,14,15,17,18,19,20,21,22,23,24,25,26,27]
        : [11,12,13,14,15,16,17,19,20,21,22,23,24,25,27,28,29,30,31,32,33,34,35,36,37,38];
    const pctCols = isDireta ? [8,12,20,32] : isUsados ? [16,28] : [18,26,39];
    dr.eachCell({ includeEmpty: true }, (cell, ci) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { top: BTHIN, bottom: BTHIN, left: BTHIN, right: BTHIN };
      cell.font = { size: 9 };
      if (currencyCols.includes(ci)) {
        cell.numFmt = BRL;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { size: 9, name: 'Courier New' };
      } else if (pctCols.includes(ci)) {
        cell.numFmt = PCT;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { size: 9, name: 'Courier New' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function VendasResultadoDashboard() {
  const [activeTab, setActiveTab]     = useState<VendasResultadoSubTab>('novos');
  const [rows, setRows]               = useState<VendasResultadoRow[]>([]);
  const [filterYear, setFilterYear]   = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [annotationDraft, setAnnotationDraft]     = useState('');
  const [aliquotaBonPct, setAliquotaBonPct] = useState(0);
  const [dsrConfigs, setDsrConfigs] = useState<VendasDsrConfig[]>([]);
  const [modelos, setModelos] = useState<VeiculoModelo[]>([]);
  const [regras,  setRegras]  = useState<VeiculoRegra[]>([]);
  const [jurosMap, setJurosMap] = useState<Map<string, number>>(new Map());
  const [blindagemMap, setBlindagemMap] = useState<Map<string, string>>(new Map());
  const blindagemMapRef = useRef<Map<string, string>>(new Map());
  const [remuneracao, setRemuneracao] = useState<RemuneracaoData | null>(null);
  const remuneracaoRef = useRef<RemuneracaoData | null>(null);

  useEffect(() => {
    if (activeTab === 'novos') {
      // Carrega linhas + modelos/regras/juros em paralelo para evitar condição de corrida
      Promise.all([
        loadVendasResultadoRows(activeTab),
        loadModelos(),
        loadRegras(),
        loadJurosRotativoRows(),
        loadRegistroRows('novos'),
      ]).then(([loaded, m, r, jr, regs]) => {
        setModelos(m);
        setRegras(r);
        const jMap = buildJurosMap(jr);
        setJurosMap(jMap);
        const regMap = buildRegistroMap(regs);
        const rem = remuneracaoRef.current;
        const modalidade = rem?.[activeTab as 'novos' | 'usados'];
        let rows = modalidade
          ? applyComissaoAutoFill(loaded, modalidade, false)
          : loaded;
        const withJuros = applyJurosAutoFill(rows, jMap);
        rows = m.length > 0 ? applyAutoFill(withJuros, m, r) : withJuros;
        rows = applyBlindagemAutoFill(rows, blindagemMapRef.current);
        rows = applyDiasEstoqueFromRegistros(rows, regMap);
        setRows(rows);
      });
    } else {
      setModelos([]); setRegras([]); setJurosMap(new Map());
      const regTab = activeTab === 'usados' ? 'usados' : null;
      Promise.all([
        loadVendasResultadoRows(activeTab),
        regTab ? loadRegistroRows(regTab) : Promise.resolve([] as RegistroVendasRow[]),
      ]).then(([loaded, regs]) => {
        const rem = remuneracaoRef.current;
        const bMap = blindagemMapRef.current;
        let rows = loaded;
        if (rem && activeTab === 'direta') {
          rows = applyBlindagemAutoFill(applyComissaoAutoFillDireta(loaded, rem.vd_frotista), bMap);
        } else if (rem && activeTab === 'usados') {
          rows = applyComissaoAutoFill(loaded, rem.usados, true);
        }
        if (regTab && regs.length > 0) {
          rows = applyDiasEstoqueFromRegistros(rows, buildRegistroMap(regs));
        }
        setRows(rows);
      });
    }
  }, [activeTab]);

  // Carrega modelos/regras/juros – mantido vazio pois foi unificado acima
  // (kept para não quebrar o effect de auto-fill abaixo)

  // Aplica auto-preenchimento de PIV/SIQ/PIVE e Juros Estoque quando cadastros são recarregados fora do mount
  useEffect(() => {
    if (activeTab !== 'novos' || (modelos.length === 0 && jurosMap.size === 0)) return;
    setRows(prev => {
      const withJuros = applyJurosAutoFill(prev, jurosMap);
      if (modelos.length === 0) return withJuros;
      return applyAutoFill(withJuros, modelos, regras);
    });
  }, [modelos, regras, jurosMap, activeTab]);

  useEffect(() => {
    loadAliquotas().then(items => {
      const soma = items
        .filter(i => i.tipo.toLowerCase().includes('bonificações'))
        .reduce((acc, i) => acc + (parseFloat(i.aliquota) || 0), 0);
      setAliquotaBonPct(soma);
    });
    loadRemuneracao().then(r => { remuneracaoRef.current = r; setRemuneracao(r); });
    loadVendasDsr().then(setDsrConfigs);
    loadVendasRows().then(bRows => {
      const bMap = buildBlindagemMap(bRows);
      blindagemMapRef.current = bMap;
      setBlindagemMap(bMap);
    });
  }, []);

  // Aplica auto-preenchimento de Comissão quando a remuneração é carregada
  useEffect(() => {
    if (!remuneracao) return;
    if (activeTab === 'direta') {
      setRows(prev => applyComissaoAutoFillDireta(prev, remuneracao.vd_frotista));
    } else {
      const modalidade = remuneracao[activeTab as 'novos' | 'usados'];
      setRows(prev => applyComissaoAutoFill(prev, modalidade, activeTab === 'usados'));
    }
  }, [remuneracao, activeTab]);

  // Re-aplica blindagem quando o mapa é atualizado (aba novos ou direta)
  useEffect(() => {
    if (blindagemMap.size === 0) return;
    if (activeTab !== 'novos' && activeTab !== 'direta') return;
    setRows(prev => applyBlindagemAutoFill(prev, blindagemMap));
  }, [blindagemMap, activeTab]);

  const save = useCallback(async (updated: VendasResultadoRow[]) => {
    setRows(updated);
    await saveVendasResultadoRows(activeTab, updated);
  }, [activeTab]);

  // Anos disponíveis
  const availableYears = useMemo(() => {
    const yrs = new Set(rows.map(r => {
      const d = r.dataVenda;
      if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return parseInt(d.split('/')[2]);
      if (/^\d{4}-\d{2}-\d{2}/.test(d)) return parseInt(d.split('-')[0]);
      return null;
    }).filter(Boolean) as number[]);
    const cur = new Date().getFullYear();
    [cur - 1, cur, cur + 1].forEach(y => yrs.add(y));
    return [...yrs].sort();
  }, [rows]);

  // Registros filtrados
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const d = r.dataVenda;
      let yr: number | null = null, mo: number | null = null;
      if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) { yr = parseInt(d.split('/')[2]); mo = parseInt(d.split('/')[1]); }
      else if (/^\d{4}-\d{2}-\d{2}/.test(d)) { yr = parseInt(d.split('-')[0]); mo = parseInt(d.split('-')[1]); }
      if (yr !== filterYear) return false;
      if (filterMonth !== null && mo !== filterMonth) return false;
      return true;
    });
  }, [rows, filterYear, filterMonth]);

  // Contagem por mês
  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    rows.filter(r => {
      const d = r.dataVenda;
      if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return parseInt(d.split('/')[2]) === filterYear;
      if (/^\d{4}-\d{2}-\d{2}/.test(d)) return parseInt(d.split('-')[0]) === filterYear;
      return false;
    }).forEach(r => {
      const d = r.dataVenda;
      const mo = /^\d{2}\/\d{2}\/\d{4}/.test(d) ? parseInt(d.split('/')[1])
               : /^\d{4}-\d{2}-\d{2}/.test(d) ? parseInt(d.split('-')[1]) : null;
      if (mo) counts[mo] = (counts[mo] || 0) + 1;
    });
    return counts;
  }, [rows, filterYear]);

  function updateField(id: string, key: EditableKey, value: string) {
    let updated = rows.map(r => r.id === id ? { ...r, [key]: value } : r);
    if (activeTab === 'novos') {
      // Se o modelo foi alterado, tenta auto-preencher PIV/SIQ/PIVE que ainda estejam vazios
      if (key === 'modelo' && modelos.length > 0) {
        updated = applyAutoFill(updated, modelos, regras);
      }
      // Se a nota de compra foi alterada, tenta auto-preencher Juros Estoque vazio
      if (key === 'notaCompra') {
        updated = applyJurosAutoFill(updated, jurosMap);
      }
      // Se a transação foi alterada, ajusta o sinal de PIV/SIQ/PIVE (V07 = negativo, demais = positivo)
      if (key === 'transacao') {
        updated = applyTransacaoSign(updated, id, value);
      }
    }
    if (activeTab === 'direta' && remuneracao &&
        (key === 'valorVenda' || key === 'pctComissao' || key === 'ciDesconto' ||
         key === 'cortesiaEmplacamento' || key === 'outrasDespesas' || key === 'vendedor' || key === 'dataVenda')) {
      // Limpa comissaoVenda da linha editada para forçar recalculo
      updated = updated.map(r => r.id === id ? { ...r, comissaoVenda: '' } : r);
      updated = applyComissaoAutoFillDireta(updated, remuneracao.vd_frotista);
    }
    // Se o chassi foi alterado em novos ou direta, re-aplica blindagem nessa linha
    if ((activeTab === 'novos' || activeTab === 'direta') && key === 'chassi' && blindagemMap.size > 0) {
      updated = applyBlindagemAutoFill(updated, blindagemMap);
    }
    save(updated);
  }

  function addRow() {
    const newRow: VendasResultadoRow = { id: crypto.randomUUID(), ...emptyVendasResultadoRow() };
    if (filterMonth) {
      const mo = String(filterMonth).padStart(2, '0');
      newRow.dataVenda = `01/${mo}/${filterYear}`;
    }
    save([...rows, newRow]);
  }

  function deleteRow(id: string) {
    save(rows.filter(r => r.id !== id));
  }

  function toggleHighlight(id: string) {
    const updated = rows.map(r => r.id === id ? { ...r, highlight: !r.highlight } : r);
    save(updated);
  }

  async function handleExport() {
    try {
      const tabLabel = SUB_TABS.find(t => t.id === activeTab)?.label ?? activeTab;
      const monthLabel = filterMonth ? MONTHS[filterMonth - 1] : 'Ano-todo';
      const sheetName = `${tabLabel.slice(0, 20)} - ${monthLabel}-${filterYear}`.slice(0, 31);
      await exportToExcel(filteredRows, sheetName, `${activeTab}_resultado_${filterYear}_${monthLabel}.xlsx`, isDireta, isUsados, aliquotaBonPct, totals, filteredRows.length);
      toast.success('Arquivo Excel gerado!');
    } catch (err) {
      console.error(err);
      toast.error(`Erro ao gerar Excel: ${String(err)}`);
    }
  }

  // Totais do período filtrado
  const totals = useMemo(() => {
    const isDireta = activeTab === 'direta';
    const isUsados = activeTab === 'usados';
    const sum = (key: EditableKey) => filteredRows.reduce((a, r) => a + n((r as unknown as Record<string, string>)[key] ?? ''), 0);
    const valorVenda       = sum('valorVenda');
    const impostos         = isUsados
      ? filteredRows.reduce((a, r) => a + calcImpostosUsados(n(r.valorVenda), n(r.valorCusto)), 0)
      : sum('impostos');
    const comissaoBruta    = isDireta
      ? filteredRows.reduce((a, r) => a + n(r.valorVenda) * n(r.pctComissao) / 100, 0)
      : 0;
    const pctComissaoMedia = valorVenda !== 0 ? (comissaoBruta / valorVenda) * 100 : 0;
    const recLiq           = isDireta ? comissaoBruta - impostos : valorVenda - impostos;
    const comissaoLiquidaPct = valorVenda !== 0 ? (recLiq / valorVenda) * 100 : 0;
    const custo      = sum('valorCusto');
    const bVarejo    = sum('bonusVarejo');
    const bTradeIn   = sum('bonusTradeIn');
    const impostosBonus    = !isDireta && !isUsados ? (bVarejo + bTradeIn) * aliquotaBonPct / 100 : 0;
    const impostosTradeIn  = isUsados ? bVarejo * aliquotaBonPct / 100 : 0;
    const lb         = recLiq - custo + bVarejo + (!isDireta && !isUsados ? bTradeIn : 0) - impostosBonus - impostosTradeIn;
    const lbPct      = recLiq !== 0 ? (lb / recLiq) * 100 : 0;
    const bPIV   = sum('bonusPIV');
    const bSIQ   = sum('bonusSIQ');
    const bPIVE  = sum('bonusPIVE');
    const bAdic1 = sum('bonusAdic1');
    const bAdic2 = sum('bonusAdic2');
    const bAdic3 = sum('bonusAdic3');
    const bonuses = bPIV + bSIQ + bPIVE + bAdic1 + bAdic2 + bAdic3;
    const impostosBonificacoes = !isDireta && !isUsados ? bonuses * aliquotaBonPct / 100 : 0;
    const lcb        = (isDireta ? recLiq : lb) + bonuses - impostosBonificacoes;
    const lcbPct     = recLiq !== 0 ? (lcb / recLiq) * 100 : 0;
    const totRecBlindagem          = sum('recBlindagem');
    const totRecFinanciamento      = sum('recFinanciamento');
    const totRecDespachante        = sum('recDespachante');
    const totJurosEstoque          = isDireta ? 0 : sum('jurosEstoque');
    const totCiDesconto            = isUsados ? 0 : sum('ciDesconto');
    const totCortesiaEmplacamento  = isUsados ? 0 : sum('cortesiaEmplacamento');
    const totCortesiaTransferencia = isUsados ? sum('cortesiaTransferencia') : 0;
    const totComissaoVenda         = sum('comissaoVenda');
    const totDsr                   = filteredRows.reduce((acc, r) => {
      const pct = getDsrPct(dsrConfigs, r.dataVenda);
      return acc + n(r.comissaoVenda) * pct / 100;
    }, 0);
    const totProvisoes             = filteredRows.reduce((acc, r) => {
      const pct = getDsrPct(dsrConfigs, r.dataVenda);
      const dsr = n(r.comissaoVenda) * pct / 100;
      const base = n(r.comissaoVenda) + dsr;
      return acc + base * (7 / 36);
    }, 0);
    const totEncargos              = filteredRows.reduce((acc, r) => {
      const pct = getDsrPct(dsrConfigs, r.dataVenda);
      const dsr = n(r.comissaoVenda) * pct / 100;
      const base = n(r.comissaoVenda) + dsr;
      const provisoes = base * (7 / 36);
      return acc + (base + provisoes) * 0.358;
    }, 0);
    const totOutrasDespesas        = sum('outrasDespesas');
    const resultado  = (isUsados ? lb : lcb) + totRecBlindagem + totRecFinanciamento + totRecDespachante
                     - totJurosEstoque - totCiDesconto - totCortesiaEmplacamento - totCortesiaTransferencia
                     - totComissaoVenda - totDsr - totProvisoes - totEncargos - totOutrasDespesas;
    const resPct     = recLiq !== 0 ? (resultado / recLiq) * 100 : 0;
    return {
      valorVenda, impostos, comissaoBruta, pctComissaoMedia, recLiq, comissaoLiquidaPct,
      custo, bVarejo, bTradeIn, impostosBonus, impostosTradeIn, lb, lbPct,
      bPIV, bSIQ, bPIVE, bAdic1, bAdic2, bAdic3, impostosBonificacoes, lcb, lcbPct,
      totRecBlindagem, totRecFinanciamento, totRecDespachante,
      totJurosEstoque, totCiDesconto, totCortesiaEmplacamento, totCortesiaTransferencia,
      totComissaoVenda, totDsr, totProvisoes, totEncargos, totOutrasDespesas,
      resultado, resPct,
    };
  }, [filteredRows, activeTab, aliquotaBonPct, dsrConfigs]);

  const isDireta = activeTab === 'direta';
  const isUsados = activeTab === 'usados';
  const tabLabel = SUB_TABS.find(t => t.id === activeTab)?.label ?? '';

  // ─── Scroll sync (barra horizontal fixa) ─────────────────────────────────────────
  const tableRef       = useRef<HTMLDivElement>(null);
  const scrollbarRef   = useRef<HTMLDivElement>(null);
  const scrollDummyRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => {
      if (scrollDummyRef.current && tableRef.current)
        scrollDummyRef.current.style.width = tableRef.current.scrollWidth + 'px';
    }, 50);
    return () => clearTimeout(t);
  });

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
      {/* Sub-abas */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-0 flex-shrink-0">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-slate-100 px-6 py-2 flex items-center justify-between flex-shrink-0">
        {/* Filtro Ano / Mês */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
            ANO
            <select
              value={filterYear}
              onChange={e => setFilterYear(+e.target.value)}
              className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterMonth(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterMonth === null ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Ano todo
            </button>
            {MONTHS.map((m, i) => (
              <button
                key={m}
                onClick={() => setFilterMonth(i + 1)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterMonth === i + 1 ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                } ${monthCounts[i + 1] ? 'font-semibold' : ''}`}
              >
                {m}
                {monthCounts[i + 1] ? <span className="ml-0.5 text-[10px] opacity-70">({monthCounts[i + 1]})</span> : null}
              </button>
            ))}
          </div>
        </div>
        {/* Ações */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{filteredRows.length} registro{filteredRows.length !== 1 ? 's' : ''}</span>
          <Button size="sm" onClick={addRow} className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nova linha
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} className="h-8 text-xs gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50">
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
        <div ref={tableRef} onScroll={() => { if (scrollbarRef.current && tableRef.current) scrollbarRef.current.scrollLeft = tableRef.current.scrollLeft; }} className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
        <table className="w-full border-separate border-spacing-0 text-xs" style={{ minWidth: 2800 }}>
          <thead className="sticky top-0 z-10">
            {/* Grupo de cabeçalho */}
            <tr>
              <th colSpan={isDireta ? 6 : isUsados ? 9 : 10} className="bg-slate-700 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-r border-slate-600">IDENTIFICAÇÃO</th>
              <th colSpan={isDireta ? 6 : 3} className="bg-emerald-800 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-r border-emerald-700">FINANCEIRO BASE</th>
              {!isDireta && <th colSpan={isUsados ? 5 : 6} className="bg-teal-700 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-r border-teal-600">LUCRO BRUTO</th>}
              {!isDireta && !isUsados && <th colSpan={9} className="bg-cyan-700 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-r border-cyan-600">BONIFICAÇÕES</th>}
              <th colSpan={3} className="bg-blue-700 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-r border-blue-600">RECEITAS EXTRAS</th>
              <th colSpan={isDireta ? 7 : isUsados ? 7 : 8} className="bg-orange-700 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-r border-orange-600">DESPESAS</th>
              <th colSpan={2} className="bg-slate-800 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide border-r border-slate-700">RESULTADO</th>
              <th className="bg-slate-600 text-white text-center py-1.5 text-[10px] font-semibold tracking-wide">AÇÕES</th>
            </tr>
            {/* Colunas */}
            <tr className="text-[10px] font-bold text-white">
              {/* Identificação */}
              {(isDireta
                ? ['Chassi','Modelo','Cor','Data Venda','Vendedor','Transação']
                : isUsados
                  ? ['Nota Compra','Chassi','Modelo','Cor','NF Venda','Data Venda','Dias Est.','Vendedor','Transação']
                  : ['Nota Compra','Chassi','Modelo','Cor','NF Venda','Data Venda','Dias Est.','Dias Car.','Vendedor','Transação']
              ).map((h,i) => {
                const frozenStyle = i === 0
                  ? { position: 'sticky' as const, left: 0, zIndex: 21 }
                  : (!isDireta && i === 1) ? { position: 'sticky' as const, left: 110, zIndex: 21 }
                  : undefined;
                return <th key={i} style={frozenStyle} className="bg-slate-700 px-3 py-2 text-left whitespace-nowrap border-b border-slate-600 border-r border-slate-600">{h}</th>;
              })}
              {/* Financeiro base */}
              {(isDireta
                ? ['Valor Venda','% Comissão','Com. Bruta','Impostos','Com. Líquida','% Com. Líq.']
                : ['Valor Venda','Impostos','Rec. Líquida']
              ).map((h,i) => (
                <th key={i} className="bg-emerald-800 px-3 py-2 text-right whitespace-nowrap border-b border-emerald-700 border-r border-emerald-700">{h}</th>
              ))}
              {/* Lucro bruto */}
              {!isDireta && (isUsados
                ? ['Valor Custo', 'Trade IN', '(-) Imp. s/ Trade IN', 'Lucro Bruto', 'LB %']
                : ['Valor Custo', 'Bônus Varejo', 'Bônus Trade IN', '(-) Imp. s/ Bônus', 'Lucro Bruto', 'LB %']
              ).map((h,i) => (
                <th key={i} className="bg-teal-700 px-3 py-2 text-right whitespace-nowrap border-b border-teal-600 border-r border-teal-600">{h}</th>
              ))}
              {/* Bonificações */}
              {!isDireta && !isUsados && ['PIV','SIQ','PIVE','Adic 1','Adic 2','Adic 3','(-) Imp. s/ Bon.','Lucro c/ Bon.','% c/ Bon.'].map((h,i) => (
                <th key={i} className="bg-cyan-700 px-3 py-2 text-right whitespace-nowrap border-b border-cyan-600 border-r border-cyan-600">{h}</th>
              ))}
              {/* Receitas extras */}
              {['Blindagem','Financiamento','Despachante'].map((h,i) => (
                <th key={i} className="bg-blue-700 px-3 py-2 text-right whitespace-nowrap border-b border-blue-600 border-r border-blue-600">{h}</th>
              ))}
              {/* Despesas */}
              {(isDireta
                ? ['CI Desconto','Cort. Emplacamento','Comissão','DSR','Provisões','Encargos','Outras Desp.']
                : isUsados
                  ? ['Juros Est.','Cort. Transferência','Comissão','DSR','Provisões','Encargos','Outras Desp.']
                  : ['Juros Est.','CI Desconto','Cort. Emplacamento','Comissão','DSR','Provisões','Encargos','Outras Desp.']
              ).map((h,i) => (
                <th key={i} className="bg-orange-700 px-3 py-2 text-right whitespace-nowrap border-b border-orange-600 border-r border-orange-600">{h}</th>
              ))}
              {/* Resultado */}
              {['Resultado','% Result.'].map((h,i) => (
                <th key={i} className="bg-slate-800 px-3 py-2 text-right whitespace-nowrap border-b border-slate-700 border-r border-slate-700">{h}</th>
              ))}
              <th className="bg-slate-600 px-3 py-2 text-center whitespace-nowrap border-b border-slate-500 sticky right-0">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={isDireta ? 25 : isUsados ? 30 : 42} className="text-center py-16 text-slate-300 text-sm">
                  Nenhum registro — clique em "Nova linha" para adicionar
                </td>
              </tr>
            )}
            {filteredRows.map((row, ri) => {
              const dsrPct = getDsrPct(dsrConfigs, row.dataVenda);
              const c = calcRow(row, isDireta, isUsados, aliquotaBonPct, dsrPct);
              const bg = row.highlight ? 'bg-yellow-50' : ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
              const td = `${bg} border-b border-slate-100 align-middle`;
              const tdR = `${td} text-right`;

              const EC = (key: EditableKey, type: ColDef['type'] = 'text') => (
                <EditCell value={(row as unknown as Record<string, string>)[key] ?? ''} type={type}
                  onSave={v => updateField(row.id, key, v)} />
              );

              return (
                <tr key={row.id} className={`group transition-colors hover:bg-emerald-50/30`}>
                  {/* Identificação */}
                  {!isDireta && (
                    <td className={`${td} px-2 min-w-[110px]`} style={{ position: 'sticky', left: 0, zIndex: 4, background: row.highlight ? '#fef9c3' : ri % 2 === 0 ? '#ffffff' : '#f1f5f9' }}>
                      {EC('notaCompra')}
                    </td>
                  )}
                  <td
                    className={`${td} px-2 min-w-[130px]`}
                    style={{ position: 'sticky', left: isDireta ? 0 : 110, zIndex: 4, background: row.highlight ? '#fef9c3' : ri % 2 === 0 ? '#ffffff' : '#f1f5f9' }}>
                    {EC('chassi')}
                  </td>
                  <td className={`${td} px-2 min-w-[150px]`}>{EC('modelo')}</td>
                  <td className={`${td} px-2 min-w-[90px]`}>{EC('cor')}</td>
                  {!isDireta && <td className={`${td} px-2 min-w-[110px]`}>{EC('nfVenda')}</td>}
                  <td className={`${td} px-2 min-w-[100px]`}>{EC('dataVenda', 'date')}</td>
                  {!isDireta && <td className={`${tdR} px-2 min-w-[80px]`}>{EC('diasEstoque', 'number')}</td>}
                  {!isDireta && !isUsados && <td className={`${tdR} px-2 min-w-[80px]`}>{EC('diasCarencia', 'number')}</td>}
                  <td className={`${td} px-2 min-w-[120px]`}>{EC('vendedor')}</td>
                  <td className={`${td} px-2 min-w-[80px]`}>{EC('transacao')}</td>
                  {/* Financeiro base */}
                  <td className={`${tdR} px-2 min-w-[110px]`}>{EC('valorVenda', 'currency')}</td>
                  {isDireta && <td className={`${tdR} px-2 min-w-[80px]`}>{EC('pctComissao', 'number')}</td>}
                  {isDireta && <td className={`${tdR} px-2 min-w-[110px]`}><CalcCell value={c.comissaoBruta} /></td>}
                  <td className={`${tdR} px-2 min-w-[100px]`}>{isUsados ? <CalcCell value={c.impostosBase} /> : EC('impostos', 'currency')}</td>
                  <td className={`${tdR} px-2 min-w-[110px]`}><CalcCell value={c.recLiq} /></td>
                  {isDireta && <td className={`${tdR} px-2 min-w-[90px]`}><CalcCell value={c.comissaoLiquidaPct} pct /></td>}
                  {/* Lucro bruto */}
                  {!isDireta && <td className={`${tdR} px-2 min-w-[110px]`}>{EC('valorCusto', 'currency')}</td>}
                  {!isDireta && <td className={`${tdR} px-2 min-w-[100px]`}>{EC('bonusVarejo', 'currency')}</td>}
                  {!isDireta && !isUsados && <td className={`${tdR} px-2 min-w-[110px]`}>{EC('bonusTradeIn', 'currency')}</td>}
                  {!isDireta && !isUsados && <td className={`${tdR} px-2 min-w-[120px]`}><CalcCell value={c.impostosBonus} negative /></td>}
                  {isUsados && <td className={`${tdR} px-2 min-w-[130px]`}><CalcCell value={c.impostosTradeIn} negative /></td>}
                  {!isDireta && <td className={`${tdR} px-2 min-w-[110px]`}><CalcCell value={c.lucroBruto} negative /></td>}
                  {!isDireta && <td className={`${tdR} px-2 min-w-[80px]`}><CalcCell value={c.lucroBrutoPct} pct negative /></td>}
                  {/* Bonificações */}
                  {!isDireta && !isUsados && <td className={`${tdR} px-2 min-w-[90px]`}>{EC('bonusPIV', 'currency')}</td>}
                  {!isDireta && !isUsados && <td className={`${tdR} px-2 min-w-[90px]`}>{EC('bonusSIQ', 'currency')}</td>}
                  {!isDireta && !isUsados && <td className={`${tdR} px-2 min-w-[90px]`}>{EC('bonusPIVE', 'currency')}</td>}
                  {!isDireta && !isUsados && <td className={`${tdR} px-2 min-w-[90px]`}>{EC('bonusAdic1', 'currency')}</td>}
                  {!isDireta && !isUsados && <td className={`${tdR} px-2 min-w-[90px]`}>{EC('bonusAdic2', 'currency')}</td>}
                  {!isDireta && !isUsados && <td className={`${tdR} px-2 min-w-[90px]`}>{EC('bonusAdic3', 'currency')}</td>}
                  {!isDireta && !isUsados && <td className={`${tdR} px-2 min-w-[140px]`}><CalcCell value={c.impostosBonificacoes} negative /></td>}
                  {!isDireta && !isUsados && <td className={`${tdR} px-2 min-w-[110px]`}><CalcCell value={c.lucroComBon} negative /></td>}
                  {!isDireta && !isUsados && <td className={`${tdR} px-2 min-w-[80px]`}><CalcCell value={c.lucroComBonPct} pct negative /></td>}
                  {/* Receitas extras */}
                  <td className={`${tdR} px-2 min-w-[100px]`}>{EC('recBlindagem', 'currency')}</td>
                  <td className={`${tdR} px-2 min-w-[120px]`}>{EC('recFinanciamento', 'currency')}</td>
                  <td className={`${tdR} px-2 min-w-[110px]`}>{EC('recDespachante', 'currency')}</td>
                  {/* Despesas */}
                  {!isDireta && <td className={`${tdR} px-2 min-w-[100px]`}>{EC('jurosEstoque', 'currency')}</td>}
                  {!isUsados && <td className={`${tdR} px-2 min-w-[110px]`}>{EC('ciDesconto', 'currency')}</td>}
                  {!isUsados && <td className={`${tdR} px-2 min-w-[130px]`}>{EC('cortesiaEmplacamento', 'currency')}</td>}
                  {isUsados && <td className={`${tdR} px-2 min-w-[130px]`}>{EC('cortesiaTransferencia', 'currency')}</td>}
                  <td className={`${tdR} px-2 min-w-[110px]`}>{EC('comissaoVenda', 'currency')}</td>
                  <td className={`${tdR} px-2 min-w-[80px]`}><CalcCell value={c.dsr} negative /></td>
                  <td className={`${tdR} px-2 min-w-[90px]`}><CalcCell value={c.provisoes} negative /></td>
                  <td className={`${tdR} px-2 min-w-[90px]`}><CalcCell value={c.encargos} negative /></td>
                  <td className={`${tdR} px-2 min-w-[100px]`}>{EC('outrasDespesas', 'currency')}</td>
                  {/* Resultado */}
                  <td className={`${tdR} px-2 min-w-[110px]`}><CalcCell value={c.resultado} negative /></td>
                  <td className={`${tdR} px-2 min-w-[80px]`}><CalcCell value={c.resultadoPct} pct negative /></td>
                  {/* Ações */}
                  <td className={`${td} px-2 text-center sticky right-0 bg-white border-l border-slate-100 min-w-[110px]`}>
                    <div className="flex items-center justify-center gap-1">
                      <button title="Destacar" onClick={() => toggleHighlight(row.id)}
                        className={`p-1 rounded hover:bg-yellow-100 transition-colors ${row.highlight ? 'text-yellow-500' : 'text-slate-300 hover:text-yellow-400'}`}>
                        <Highlighter className="w-3.5 h-3.5" />
                      </button>
                      <button title="Anotação" onClick={() => { setEditingAnnotation(row.id); setAnnotationDraft(row.annotation ?? ''); }}
                        className={`p-1 rounded hover:bg-blue-50 transition-colors ${row.annotation ? 'text-blue-500' : 'text-slate-300 hover:text-blue-400'}`}>
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                      <button title="Excluir" onClick={() => deleteRow(row.id)}
                        className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Linha de totais */}
          {filteredRows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-800 text-white text-xs font-bold">
                <td colSpan={isDireta ? 6 : isUsados ? 9 : 10} className="px-3 py-2 text-left">TOTAIS ({filteredRows.length} registros)</td>
                <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.valorVenda)}</td>
                {isDireta ? (
                  <>
                    <td className="px-2 py-2 text-right font-mono">{fmtPct(totals.pctComissaoMedia)}</td>
                    <td className="px-2 py-2 text-right font-mono text-emerald-300">R$ {fmt(totals.comissaoBruta)}</td>
                    <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.impostos)}</td>
                    <td className="px-2 py-2 text-right font-mono text-emerald-300">R$ {fmt(totals.recLiq)}</td>
                    <td className="px-2 py-2 text-right font-mono text-emerald-300">{fmtPct(totals.comissaoLiquidaPct)}</td>
                  </>
                ) : (
                  <>
                    <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.impostos)}</td>
                    <td className="px-2 py-2 text-right font-mono text-emerald-300">R$ {fmt(totals.recLiq)}</td>
                    <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.custo)}</td>
                    <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.bVarejo)}</td>
                    {!isUsados && <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.bTradeIn)}</td>}
                    {!isDireta && !isUsados && <td className="px-2 py-2 text-right font-mono text-red-300">R$ {fmt(totals.impostosBonus)}</td>}
                    {isUsados && <td className="px-2 py-2 text-right font-mono text-red-300">R$ {fmt(totals.impostosTradeIn)}</td>}
                    <td className={`px-2 py-2 text-right font-mono ${totals.lb >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>R$ {fmt(totals.lb)}</td>
                    <td className={`px-2 py-2 text-right font-mono ${totals.lbPct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{fmtPct(totals.lbPct)}</td>
                  </>
                )}
                {!isDireta && !isUsados && (
                  <>
                    <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.bPIV)}</td>
                    <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.bSIQ)}</td>
                    <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.bPIVE)}</td>
                    <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.bAdic1)}</td>
                    <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.bAdic2)}</td>
                    <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.bAdic3)}</td>
                    <td className="px-2 py-2 text-right font-mono text-red-300">R$ {fmt(totals.impostosBonificacoes)}</td>
                    <td className={`px-2 py-2 text-right font-mono ${totals.lcb >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>R$ {fmt(totals.lcb)}</td>
                    <td className={`px-2 py-2 text-right font-mono ${totals.lcbPct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{fmtPct(totals.lcbPct)}</td>
                  </>
                )}
                <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.totRecBlindagem)}</td>
                <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.totRecFinanciamento)}</td>
                <td className="px-2 py-2 text-right font-mono">R$ {fmt(totals.totRecDespachante)}</td>
                {!isDireta && <td className="px-2 py-2 text-right font-mono text-red-300">R$ {fmt(totals.totJurosEstoque)}</td>}
                {!isUsados && <td className="px-2 py-2 text-right font-mono text-red-300">R$ {fmt(totals.totCiDesconto)}</td>}
                {!isUsados && <td className="px-2 py-2 text-right font-mono text-red-300">R$ {fmt(totals.totCortesiaEmplacamento)}</td>}
                {isUsados && <td className="px-2 py-2 text-right font-mono text-red-300">R$ {fmt(totals.totCortesiaTransferencia)}</td>}
                <td className="px-2 py-2 text-right font-mono text-red-300">R$ {fmt(totals.totComissaoVenda)}</td>
                <td className="px-2 py-2 text-right font-mono text-red-300">R$ {fmt(totals.totDsr)}</td>
                <td className="px-2 py-2 text-right font-mono text-red-300">R$ {fmt(totals.totProvisoes)}</td>
                <td className="px-2 py-2 text-right font-mono text-red-300">R$ {fmt(totals.totEncargos)}</td>
                <td className="px-2 py-2 text-right font-mono text-red-300">R$ {fmt(totals.totOutrasDespesas)}</td>
                <td className={`px-2 py-2 text-right font-mono ${totals.resultado >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>R$ {fmt(totals.resultado)}</td>
                <td className={`px-2 py-2 text-right font-mono ${totals.resPct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{fmtPct(totals.resPct)}</td>
                <td className="px-2 py-2" />
              </tr>
            </tfoot>
          )}
        </table>
        </div>
        <div ref={scrollbarRef} onScroll={() => { if (tableRef.current && scrollbarRef.current) tableRef.current.scrollLeft = scrollbarRef.current.scrollLeft; }}
          className="overflow-x-auto overflow-y-hidden shrink-0 border-t border-slate-100 bg-white" style={{ height: 14 }}>
          <div ref={scrollDummyRef} style={{ height: 1 }} />
        </div>
      </div>

      {/* Modal de anotação */}
      {editingAnnotation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
            <h3 className="font-semibold text-slate-800 mb-3">Anotação</h3>
            <textarea
              autoFocus
              value={annotationDraft}
              onChange={e => setAnnotationDraft(e.target.value)}
              rows={4}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              placeholder="Digite uma anotação..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setEditingAnnotation(null)}>Cancelar</Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => {
                const updated = rows.map(r => r.id === editingAnnotation ? { ...r, annotation: annotationDraft } : r);
                save(updated);
                setEditingAnnotation(null);
              }}>Salvar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
