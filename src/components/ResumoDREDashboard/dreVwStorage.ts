import { kvGet, kvSet } from '@/lib/kvClient';

// Chave no KV: "resumo_dre:vw:{YYYY-MM}"
const key = (year: number, month: number) =>
  `resumo_dre:vw:${year}-${String(month).padStart(2, '0')}`;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DreVwDept {
  quant: string;
  receitaOperacionalLiquida: string;
  custoOperacionalReceita: string;
  lucroPrejOperacionalBruto: string;
  outrasReceitasOperacionais: string;
  outrasDespesasOperacionais: string;
  margemContribuicao: string;
  despPessoal: string;
  despServTerceiros: string;
  despOcupacao: string;
  despFuncionamento: string;
  despVendas: string;
  lucroPrejOperacionalLiquido: string;
  amortizacoesDepreciacoes: string;
  outrasReceitasFinanceiras: string;
  despFinanceirasNaoOperacional: string;
  despesasNaoOperacionais: string;
  outrasRendasNaoOperacionais: string;
  lucroPrejAntesImpostos: string;
  provisoesIrpjCs: string;
  participacoes: string;
  lucroLiquidoExercicio: string;
}

export interface DreVwRow {
  /** Período: "YYYY-MM" */
  periodo: string;

  novos: DreVwDept;
  usados: DreVwDept;
  direta: DreVwDept;
  pecas: DreVwDept;
  oficina: DreVwDept;
  funilaria: DreVwDept;
  adm: DreVwDept;

  ajustes: VwAjusteRow[];
}

// ─── Ajuste Row ───────────────────────────────────────────────────────────────

export interface VwAjusteRow {
  id: string;
  label: string;
  values: {
    novos: string; usados: string; direta: string; pecas: string;
    oficina: string; funilaria: string; adm: string;
  };
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const EMPTY_AJUSTE_VALUES: VwAjusteRow['values'] = {
  novos: '', usados: '', direta: '', pecas: '', oficina: '', funilaria: '', adm: '',
};

export const DEFAULT_VW_AJUSTE_ROWS: VwAjusteRow[] = [
  { id: 'icmsSt',     label: '(-) ICMS ST recebido do fabricante',           values: { ...EMPTY_AJUSTE_VALUES } },
  { id: 'honorarios', label: '(+) Honorários advogados s/ ICMS ST recebido', values: { ...EMPTY_AJUSTE_VALUES } },
];

/** Migra formato legado (objeto) para array de linhas. */
export function migrateVwAjustes(raw: unknown): VwAjusteRow[] {
  if (Array.isArray(raw)) return raw as VwAjusteRow[];
  const depts = ['novos', 'usados', 'direta', 'pecas', 'oficina', 'funilaria', 'adm'] as const;
  const legacy = raw as Record<string, { icmsSt?: string; honorariosAdvogados?: string }>;
  return [
    {
      id: 'icmsSt',
      label: '(-) ICMS ST recebido do fabricante',
      values: Object.fromEntries(depts.map(d => [d, legacy?.[d]?.icmsSt ?? ''])) as VwAjusteRow['values'],
    },
    {
      id: 'honorarios',
      label: '(+) Honorários advogados s/ ICMS ST recebido',
      values: Object.fromEntries(depts.map(d => [d, legacy?.[d]?.honorariosAdvogados ?? ''])) as VwAjusteRow['values'],
    },
  ];
}

function emptyDept(): DreVwDept {
  return {
    quant: '',
    receitaOperacionalLiquida: '',
    custoOperacionalReceita: '',
    lucroPrejOperacionalBruto: '',
    outrasReceitasOperacionais: '',
    outrasDespesasOperacionais: '',
    margemContribuicao: '',
    despPessoal: '',
    despServTerceiros: '',
    despOcupacao: '',
    despFuncionamento: '',
    despVendas: '',
    lucroPrejOperacionalLiquido: '',
    amortizacoesDepreciacoes: '',
    outrasReceitasFinanceiras: '',
    despFinanceirasNaoOperacional: '',
    despesasNaoOperacionais: '',
    outrasRendasNaoOperacionais: '',
    lucroPrejAntesImpostos: '',
    provisoesIrpjCs: '',
    participacoes: '',
    lucroLiquidoExercicio: '',
  };
}

export function createEmptyDreVwRow(year: number, month: number): DreVwRow {
  return {
    periodo: `${year}-${String(month).padStart(2, '0')}`,
    novos: emptyDept(),
    usados: emptyDept(),
    direta: emptyDept(),
    pecas: emptyDept(),
    oficina: emptyDept(),
    funilaria: emptyDept(),
    adm: emptyDept(),
    ajustes: DEFAULT_VW_AJUSTE_ROWS.map(r => ({ ...r, values: { ...r.values } })),
  };
}

// ─── Load / Save ──────────────────────────────────────────────────────────────

export async function loadDreVw(year: number, month: number): Promise<DreVwRow | null> {
  try {
    const data = await kvGet<DreVwRow>(key(year, month));
    return data ?? null;
  } catch {
    return null;
  }
}

export async function saveDreVw(row: DreVwRow): Promise<boolean> {
  const [yr, mo] = row.periodo.split('-').map(Number);
  try {
    await kvSet(key(yr, mo), row);
    return true;
  } catch {
    return false;
  }
}
