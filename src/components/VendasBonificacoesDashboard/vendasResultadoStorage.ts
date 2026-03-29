import { kvGet, kvSet } from '@/lib/kvClient';

export type VendasResultadoSubTab = 'novos' | 'direta' | 'usados';

const KEY: Record<VendasResultadoSubTab, string> = {
  novos:  'vendas_resultado_novos',
  direta: 'vendas_resultado_direta',
  usados: 'vendas_resultado_usados',
};

export interface VendasResultadoRow {
  id: string;
  // Identificação
  notaCompra:       string;
  chassi:           string;
  modelo:           string;
  cor:              string;
  nfVenda:          string;
  dataVenda:        string;
  diasEstoque:      string;
  diasCarencia:     string;
  vendedor:         string;
  transacao:        string;
  // Financeiro base
  valorVenda:       string;
  pctComissao:      string;  // direta: % comissão informado pelo usuário
  impostos:         string;
  // direta: comissaoBruta = valorVenda * pctComissao / 100 (calculado)
  // receitaLiquida = (direta: comissaoBruta - impostos | normal: valorVenda - impostos) (calculado)
  valorCusto:       string;
  bonusVarejo:      string;
  bonusTradeIn:     string;  // novos: Bônus Trade IN
  // lucroBruto = receitaLiquida - valorCusto + bonusVarejo + bonusTradeIn (calculado)
  // lucroBrutoPct = lucroBruto / receitaLiquida * 100 (calculado)
  // Bônus
  bonusPIV:         string;
  bonusSIQ:         string;
  bonusPIVE:        string;
  bonusAdic1:       string;
  bonusAdic2:       string;
  bonusAdic3:       string;
  // lucroComBon = lucroBruto + PIV + SIQ + PIVE + Adic1 + Adic2 + Adic3 (calculado)
  // lucroComBonPct = lucroComBon / receitaLiquida * 100 (calculado)
  // Receitas extras
  recBlindagem:     string;
  recFinanciamento: string;
  recDespachante:   string;
  // Despesas
  jurosEstoque:          string;
  ciDesconto:            string;
  cortesiaEmplacamento:  string;
  cortesiaTransferencia: string;
  comissaoVenda:         string;
  dsr:              string;
  provisoes:        string;
  encargos:         string;
  outrasDespesas:   string;
  // resultadoVenda = lucroComBon + recBlindagem + recFinanciamento + recDespachante
  //                  - jurosEstoque - comissaoVenda - dsr - provisoes - encargos - outrasDespesas (calculado)
  // resultadoVendaPct = resultadoVenda / receitaLiquida * 100 (calculado)
  highlight?:           boolean;
  annotation?:          string;
  syncedFromRegistro?:  boolean;
}

export async function loadVendasResultadoRows(tab: VendasResultadoSubTab): Promise<VendasResultadoRow[]> {
  try {
    const data = await kvGet(KEY[tab]);
    if (Array.isArray(data)) return data as VendasResultadoRow[];
    return [];
  } catch { return []; }
}

export async function saveVendasResultadoRows(tab: VendasResultadoSubTab, rows: VendasResultadoRow[]): Promise<void> {
  try { await kvSet(KEY[tab], rows); } catch { /* ignore */ }
}

// ─── Mapeamento de abas ──────────────────────────────────────────────────────
const REGISTRO_TO_VENDAS_TAB: Record<'novos' | 'frotista' | 'usados', VendasResultadoSubTab> = {
  novos:    'novos',
  frotista: 'direta',
  usados:   'usados',
};

// ─── Sync Registro → Vendas ───────────────────────────────────────────────────
export interface RegistroSyncRow {
  chassi:       string;
  modelo:       string;
  nomeCor:      string;
  nfVenda:      string;
  nfEntrada:    string;
  dtaVenda:     string;
  valVenda:     string;
  valCusto:     string;
  nomeVendedor: string;
  transacao:    string;
}

export async function syncVendasFromRegistro(
  registroTab: 'novos' | 'frotista' | 'usados',
  registroRows: RegistroSyncRow[],
): Promise<void> {
  const vendaTab = REGISTRO_TO_VENDAS_TAB[registroTab];
  const current  = await loadVendasResultadoRows(vendaTab);

  const registroChassisSet = new Set(registroRows.map(r => r.chassi).filter(Boolean));

  // Remove linhas sincronizadas cujo chassi não existe mais no registro
  const kept = current.filter(r =>
    !r.syncedFromRegistro || (r.chassi && registroChassisSet.has(r.chassi))
  );

  // Mapa chassi → linha em vendas (para upsert)
  const keptMap = new Map(kept.map(r => [r.chassi, r]));

  const result: VendasResultadoRow[] = [...kept];

  for (const reg of registroRows) {
    if (!reg.chassi) continue;
    const existing = keptMap.get(reg.chassi);
    if (existing) {
      // Atualiza apenas os campos compartilhados
      existing.notaCompra  = reg.nfEntrada;
      existing.chassi      = reg.chassi;
      existing.modelo      = reg.modelo;
      existing.cor         = reg.nomeCor;
      existing.nfVenda     = reg.nfVenda;
      existing.dataVenda   = reg.dtaVenda;
      existing.valorVenda  = reg.valVenda;
      existing.valorCusto  = reg.valCusto;
      existing.vendedor    = reg.nomeVendedor;
      existing.transacao   = reg.transacao;
      existing.syncedFromRegistro = true;
    } else {
      // Cria nova linha com campos financeiros em branco
      const newRow: VendasResultadoRow = {
        ...emptyVendasResultadoRow(),
        id:                 crypto.randomUUID(),
        notaCompra:         reg.nfEntrada,
        chassi:             reg.chassi,
        modelo:             reg.modelo,
        cor:                reg.nomeCor,
        nfVenda:            reg.nfVenda,
        dataVenda:          reg.dtaVenda,
        valorVenda:         reg.valVenda,
        valorCusto:         reg.valCusto,
        vendedor:           reg.nomeVendedor,
        transacao:          reg.transacao,
        syncedFromRegistro: true,
      };
      result.push(newRow);
    }
  }

  await saveVendasResultadoRows(vendaTab, result);
}

export function emptyVendasResultadoRow(): Omit<VendasResultadoRow, 'id'> {
  return {
    notaCompra: '', chassi: '', modelo: '', cor: '', nfVenda: '', dataVenda: '', diasEstoque: '', diasCarencia: '',
    vendedor: '', transacao: '', valorVenda: '', pctComissao: '', impostos: '', valorCusto: '',
    bonusVarejo: '', bonusTradeIn: '', bonusPIV: '', bonusSIQ: '', bonusPIVE: '',
    bonusAdic1: '', bonusAdic2: '', bonusAdic3: '',
    recBlindagem: '', recFinanciamento: '', recDespachante: '',
    jurosEstoque: '', ciDesconto: '', cortesiaEmplacamento: '', cortesiaTransferencia: '',
    comissaoVenda: '', dsr: '', provisoes: '', encargos: '', outrasDespesas: '',
  };
}

// ─── Sync Bônus Varejo → Vendas Novos ────────────────────────────────────────
function parseYMFromStr(raw: string): { year: number; month: number } | null {
  if (!raw) return null;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
    const p = raw.split('/');
    return { year: parseInt(p[2]), month: parseInt(p[1]) };
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const p = raw.split('-');
    return { year: parseInt(p[0]), month: parseInt(p[1]) };
  }
  return null;
}

// ─── Sync Bônus Trade IN → Vendas Novos ──────────────────────────────────────
export async function syncBonusTradeInToNovos(
  tradeInRows: { chassi: string; dataVenda: string; valorTradeIn: string }[]
): Promise<void> {
  // Monta mapa "chassi|ano|mês" → valor do último registro
  const tradeInMap = new Map<string, string>();
  for (const b of tradeInRows) {
    if (!b.chassi?.trim()) continue;
    const d = parseYMFromStr(b.dataVenda);
    if (!d) continue;
    const key = `${b.chassi.trim()}|${d.year}|${d.month}`;
    tradeInMap.set(key, b.valorTradeIn ?? '');
  }

  const novosRows = await loadVendasResultadoRows('novos');
  let changed = false;
  const updated = novosRows.map(r => {
    if (!r.chassi?.trim()) return r;
    const d = parseYMFromStr(r.dataVenda);
    if (!d) return r;
    const key = `${r.chassi.trim()}|${d.year}|${d.month}`;
    if (!tradeInMap.has(key)) return r;
    const newVal = (() => {
      const raw = tradeInMap.get(key)!;
      const n = parseFloat(String(raw).replace(',', '.'));
      return isNaN(n) ? raw : n.toFixed(2);
    })();
    if (r.bonusTradeIn === newVal) return r;
    changed = true;
    return { ...r, bonusTradeIn: newVal };
  });
  if (changed) await saveVendasResultadoRows('novos', updated);
}

export async function syncBonusVarejoToNovos(
  bonusRows: { notaFiscal: string; data: string; valor: string }[]
): Promise<void> {
  // Monta mapa "nf|ano|mês" → soma dos valores
  const bonusMap = new Map<string, number>();
  for (const b of bonusRows) {
    if (!b.notaFiscal?.trim()) continue;
    const d = parseYMFromStr(b.data);
    if (!d) continue;
    const key = `${b.notaFiscal.trim()}|${d.year}|${d.month}`;
    const val = parseFloat(String(b.valor).replace(',', '.')) || 0;
    bonusMap.set(key, (bonusMap.get(key) ?? 0) + val);
  }

  const novosRows = await loadVendasResultadoRows('novos');
  let changed = false;
  const updated = novosRows.map(r => {
    if (!r.nfVenda?.trim()) return r;
    const d = parseYMFromStr(r.dataVenda);
    if (!d) return r;
    const key = `${r.nfVenda.trim()}|${d.year}|${d.month}`;
    if (!bonusMap.has(key)) return r;
    const soma = bonusMap.get(key)!;
    const newVal = soma.toFixed(2);
    if (r.bonusVarejo === newVal) return r;
    changed = true;
    return { ...r, bonusVarejo: newVal };
  });
  if (changed) await saveVendasResultadoRows('novos', updated);
}
