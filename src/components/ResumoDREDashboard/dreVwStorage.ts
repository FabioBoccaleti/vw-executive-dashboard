import { kvGet, kvSet, kvBulkGet } from '@/lib/kvClient';

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

// ─── Compatibilidade com formato legado (vw_dre_YYYY_dept) ───────────────────

type LegacyLine = { label?: string; descricao?: string; meses?: number[]; values?: number[] };

const LEGACY_VW_DEPTS: Array<{ legacyKey: string; dreKey: keyof Omit<DreVwRow, 'periodo' | 'ajustes'> }> = [
  { legacyKey: 'novos',         dreKey: 'novos'     },
  { legacyKey: 'vendaDireta',   dreKey: 'direta'    },
  { legacyKey: 'usados',        dreKey: 'usados'    },
  { legacyKey: 'pecas',         dreKey: 'pecas'     },
  { legacyKey: 'oficina',       dreKey: 'oficina'   },
  { legacyKey: 'funilaria',     dreKey: 'funilaria' },
  { legacyKey: 'administracao', dreKey: 'adm'       },
];

const LEGACY_LABEL_TO_FIELD_VW: Record<string, keyof DreVwDept> = {
  'VOLUME DE VENDAS':                      'quant',
  'RECEITA OPERACIONAL LIQUIDA':           'receitaOperacionalLiquida',
  'CUSTO OPERACIONAL DA RECEITA':          'custoOperacionalReceita',
  'LUCRO (PREJUIZO) OPERACIONAL BRUTO':   'lucroPrejOperacionalBruto',
  'OUTRAS RECEITAS OPERACIONAIS':          'outrasReceitasOperacionais',
  'OUTRAS DESPESAS OPERACIONAIS':          'outrasDespesasOperacionais',
  'MARGEM DE CONTRIBUIÇÃO':               'margemContribuicao',
  'MARGEM DE CONTRIBUICAO':               'margemContribuicao',
  'DESPESAS C/ PESSOAL':                  'despPessoal',
  'DESPESAS C/ SERV. DE TERCEIROS':       'despServTerceiros',
  'DESPESAS C/ OCUPAÇÃO':                 'despOcupacao',
  'DESPESAS C/ OCUPACAO':                 'despOcupacao',
  'DESPESAS C/ FUNCIONAMENTO':            'despFuncionamento',
  'DESPESAS C/ VENDAS':                   'despVendas',
  'LUCRO (PREJUIZO) OPERACIONAL LIQUIDO': 'lucroPrejOperacionalLiquido',
  'AMORTIZAÇÕES E DEPRECIAÇÕES':          'amortizacoesDepreciacoes',
  'AMORTIZACOES E DEPRECIACOES':          'amortizacoesDepreciacoes',
  'OUTRAS RECEITAS FINANCEIRAS':          'outrasReceitasFinanceiras',
  'DESPESAS FINANCEIRAS NÃO OPERACIONAL': 'despFinanceirasNaoOperacional',
  'DESPESAS FINANCEIRAS NAO OPERACIONAL': 'despFinanceirasNaoOperacional',
  'DESPESAS NÃO OPERACIONAIS':            'despesasNaoOperacionais',
  'DESPESAS NAO OPERACIONAIS':            'despesasNaoOperacionais',
  'OUTRAS RENDAS NÃO OPERACIONAIS':       'outrasRendasNaoOperacionais',
  'OUTRAS RENDAS NAO OPERACIONAIS':       'outrasRendasNaoOperacionais',
  'LUCRO (PREJUIZO) ANTES IMPOSTOS':      'lucroPrejAntesImpostos',
  'PROVISÕES IRPJ E C.S.':               'provisoesIrpjCs',
  'PROVISOES IRPJ E C.S.':               'provisoesIrpjCs',
  'PARTICIPAÇÕES':                        'participacoes',
  'PARTICIPACOES':                        'participacoes',
  'LUCRO LIQUIDO DO EXERCICIO':           'lucroLiquidoExercicio',
};

function buildVwDeptFromLegacy(lines: LegacyLine[] | null, monthIndex: number): DreVwDept {
  const dept = emptyDept();
  if (!lines) return dept;
  for (const line of lines) {
    const label = ((line.label ?? line.descricao ?? '') as string).toUpperCase().trim();
    const field = LEGACY_LABEL_TO_FIELD_VW[label];
    if (field) {
      const vals = line.meses ?? line.values ?? [];
      const val = vals[monthIndex];
      if (val !== undefined && val !== null && val !== 0) dept[field] = val.toString();
    }
  }
  return dept;
}

async function loadAllDreVwFromLegacy(year: number): Promise<(DreVwRow | null)[]> {
  const legacyKeys = LEGACY_VW_DEPTS.map(d => `vw_dre_${year}_${d.legacyKey}`);
  const results = await kvBulkGet(legacyKeys);
  const hasAny = legacyKeys.some(k => results[k] !== null);
  if (!hasAny) return Array(12).fill(null);
  return Array.from({ length: 12 }, (_, monthIdx) => {
    const row = createEmptyDreVwRow(year, monthIdx + 1);
    let hasDeptData = false;
    for (const { legacyKey, dreKey } of LEGACY_VW_DEPTS) {
      const lines = results[`vw_dre_${year}_${legacyKey}`] as LegacyLine[] | null;
      const dept = buildVwDeptFromLegacy(lines, monthIdx);
      if (Object.values(dept).some(v => v !== '')) { row[dreKey] = dept; hasDeptData = true; }
    }
    return hasDeptData ? row : null;
  });
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

/** Carrega os 12 meses de um ano em uma única chamada bulk.
 *  Tenta primeiro o formato novo (resumo_dre:vw:YYYY-MM).
 *  Se não houver dados, cai no formato legado (vw_dre_YYYY_dept). */
export async function loadAllDreVw(year: number): Promise<(DreVwRow | null)[]> {
  try {
    const keys = Array.from({ length: 12 }, (_, i) => key(year, i + 1));
    const results = await kvBulkGet(keys);
    const rows = keys.map(k => (results[k] as DreVwRow) ?? null);
    if (rows.some(r => r !== null)) return rows;
    return loadAllDreVwFromLegacy(year);
  } catch {
    return Array(12).fill(null);
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
