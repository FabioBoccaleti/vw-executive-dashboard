import { kvGet, kvSet } from '@/lib/kvClient';

// Chave no KV: "resumo_dre:audi:{YYYY-MM}"
const key = (year: number, month: number) =>
  `resumo_dre:audi:${year}-${String(month).padStart(2, '0')}`;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DreAudiDept {
  quant: string;
  receitaBruta: string;
  impostosDevol: string;
  vendasLiquidas: string;
  custos: string;
  lucroBruto: string;
  rendasOperacionais: string;
  resultadoOperacionalBruto: string;
  despesasVendas: string;
  margemContribuicao: string;
  despPessoal: string;
  despServTerceiros: string;
  despOcupacao: string;
  despFuncionamento: string;
  totalDespesasFixas: string;
  resultadoAntesFinanceiro: string;
  receitasFinanceiras: string;
  despesasFinanceiras: string;
  resultadoAntesImpostos: string;
  irCs: string;
  resultadoLiquido: string;
}

export interface DreAudiRow {
  /** Período: "YYYY-MM" */
  periodo: string;

  // Departamentos da Página 1 (resumo)
  novos: DreAudiDept;
  usados: DreAudiDept;
  pecas: DreAudiDept;
  oficina: DreAudiDept;
  funilaria: DreAudiDept;
  adm: DreAudiDept;

  // Ajustes esporádicos (Página 8)
  ajustes: {
    icmsSt: string;
    honorariosAdvogados: string;
  };
}

function emptyDept(): DreAudiDept {
  return {
    quant: '',
    receitaBruta: '',
    impostosDevol: '',
    vendasLiquidas: '',
    custos: '',
    lucroBruto: '',
    rendasOperacionais: '',
    resultadoOperacionalBruto: '',
    despesasVendas: '',
    margemContribuicao: '',
    despPessoal: '',
    despServTerceiros: '',
    despOcupacao: '',
    despFuncionamento: '',
    totalDespesasFixas: '',
    resultadoAntesFinanceiro: '',
    receitasFinanceiras: '',
    despesasFinanceiras: '',
    resultadoAntesImpostos: '',
    irCs: '',
    resultadoLiquido: '',
  };
}

export function createEmptyDreAudiRow(year: number, month: number): DreAudiRow {
  return {
    periodo: `${year}-${String(month).padStart(2, '0')}`,
    novos: emptyDept(),
    usados: emptyDept(),
    pecas: emptyDept(),
    oficina: emptyDept(),
    funilaria: emptyDept(),
    adm: emptyDept(),
    ajustes: { icmsSt: '', honorariosAdvogados: '' },
  };
}

// ─── Load / Save ──────────────────────────────────────────────────────────────

export async function loadDreAudi(year: number, month: number): Promise<DreAudiRow | null> {
  try {
    const data = await kvGet<DreAudiRow>(key(year, month));
    return data ?? null;
  } catch {
    return null;
  }
}

export async function saveDreAudi(row: DreAudiRow): Promise<boolean> {
  const [yr, mo] = row.periodo.split('-').map(Number);
  try {
    await kvSet(key(yr, mo), row);
    return true;
  } catch {
    return false;
  }
}
