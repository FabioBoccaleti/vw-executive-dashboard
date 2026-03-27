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
  chassi:           string;
  modelo:           string;
  cor:              string;
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
  // lucroBruto = receitaLiquida - valorCusto + bonusVarejo (calculado)
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
  jurosEstoque:     string;
  comissaoVenda:    string;
  dsr:              string;
  provisoes:        string;
  encargos:         string;
  outrasDespesas:   string;
  // resultadoVenda = lucroComBon + recBlindagem + recFinanciamento + recDespachante
  //                  - jurosEstoque - comissaoVenda - dsr - provisoes - encargos - outrasDespesas (calculado)
  // resultadoVendaPct = resultadoVenda / receitaLiquida * 100 (calculado)
  highlight?:  boolean;
  annotation?: string;
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

export function emptyVendasResultadoRow(): Omit<VendasResultadoRow, 'id'> {
  return {
    chassi: '', modelo: '', cor: '', dataVenda: '', diasEstoque: '', diasCarencia: '',
    vendedor: '', transacao: '', valorVenda: '', pctComissao: '', impostos: '', valorCusto: '',
    bonusVarejo: '', bonusPIV: '', bonusSIQ: '', bonusPIVE: '',
    bonusAdic1: '', bonusAdic2: '', bonusAdic3: '',
    recBlindagem: '', recFinanciamento: '', recDespachante: '',
    jurosEstoque: '', comissaoVenda: '', dsr: '', provisoes: '', encargos: '', outrasDespesas: '',
  };
}
