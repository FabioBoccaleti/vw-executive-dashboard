import { kvGet, kvSet, kvBulkGet } from '@/lib/kvClient';

// Chave no KV: "resumo_dre:audi:{YYYY-MM}"
const key = (year: number, month: number) =>
  `resumo_dre:audi:${year}-${String(month).padStart(2, '0')}`;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DreAudiDept {
  quant: string;                        // VOLUME DE VENDAS
  receitaOperacionalLiquida: string;    // RECEITA OPERACIONAL LIQUIDA
  custoOperacionalReceita: string;      // CUSTO OPERACIONAL DA RECEITA
  lucroPrejOperacionalBruto: string;    // LUCRO (PREJUÍZO) OPERACIONAL BRUTO
  outrasReceitasOperacionais: string;   // OUTRAS RECEITAS OPERACIONAIS
  outrasDespesasOperacionais: string;   // OUTRAS DESPESAS OPERACIONAIS
  margemContribuicao: string;           // MARGEM DE CONTRIBUIÇÃO
  despPessoal: string;                  // DESPESAS C/ PESSOAL
  despServTerceiros: string;            // DESPESAS C/ SERV. DE TERCEIROS
  despOcupacao: string;                 // DESPESAS C/ OCUPAÇÃO
  despFuncionamento: string;            // DESPESAS C/ FUNCIONAMENTO
  despVendas: string;                   // DESPESAS C/ VENDAS
  lucroPrejOperacionalLiquido: string;  // LUCRO (PREJUÍZO) OPERACIONAL LÍQUIDO
  amortizacoesDepreciacoes: string;     // AMORTIZAÇÕES E DEPRECIAÇÕES
  outrasReceitasFinanceiras: string;    // OUTRAS RECEITAS FINANCEIRAS
  despFinanceirasNaoOperacional: string;// DESPESAS FINANCEIRAS NÃO OPERACIONAL
  despesasNaoOperacionais: string;      // DESPESAS NÃO OPERACIONAIS
  outrasRendasNaoOperacionais: string;  // OUTRAS RENDAS NÃO OPERACIONAIS
  lucroPrejAntesImpostos: string;       // LUCRO (PREJUÍZO) ANTES IMPOSTOS
  provisoesIrpjCs: string;              // PROVISÕES IRPJ E C.S.
  participacoes: string;                // PARTICIPAÇÕES
  lucroLiquidoExercicio: string;        // LUCRO LÍQUIDO DO EXERCÍCIO
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

  // Ajustes esporádicos (Página 8) — linhas dinâmicas
  ajustes: AjusteRow[];
}

// ─── Ajuste Row ───────────────────────────────────────────────────────────────

export interface AjusteRow {
  id: string;
  label: string;
  values: {
    novos: string; usados: string; pecas: string;
    oficina: string; funilaria: string; adm: string;
  };
}

const EMPTY_AJUSTE_VALUES = { novos: '', usados: '', pecas: '', oficina: '', funilaria: '', adm: '' };

export const DEFAULT_AJUSTE_ROWS: AjusteRow[] = [
  { id: 'icmsSt',     label: '(-) ICMS ST recebido do fabricante',          values: { ...EMPTY_AJUSTE_VALUES } },
  { id: 'honorarios', label: '(+) Honorários advogados s/ ICMS ST recebido', values: { ...EMPTY_AJUSTE_VALUES } },
];

/** Migra o formato antigo (objeto por dept) para o novo (array de linhas). */
export function migrateAjustes(raw: unknown): AjusteRow[] {
  if (Array.isArray(raw)) return raw as AjusteRow[];
  // Formato legado: { novos: { icmsSt, honorariosAdvogados }, ... }
  const depts = ['novos', 'usados', 'pecas', 'oficina', 'funilaria', 'adm'] as const;
  const legacy = raw as Record<string, { icmsSt?: string; honorariosAdvogados?: string }>;
  return [
    {
      id: 'icmsSt',
      label: '(-) ICMS ST recebido do fabricante',
      values: Object.fromEntries(depts.map(d => [d, legacy?.[d]?.icmsSt ?? ''])) as AjusteRow['values'],
    },
    {
      id: 'honorarios',
      label: '(+) Honorários advogados s/ ICMS ST recebido',
      values: Object.fromEntries(depts.map(d => [d, legacy?.[d]?.honorariosAdvogados ?? ''])) as AjusteRow['values'],
    },
  ];
}

function emptyDept(): DreAudiDept {
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

export function createEmptyDreAudiRow(year: number, month: number): DreAudiRow {
  return {
    periodo: `${year}-${String(month).padStart(2, '0')}`,
    novos: emptyDept(),
    usados: emptyDept(),
    pecas: emptyDept(),
    oficina: emptyDept(),
    funilaria: emptyDept(),
    adm: emptyDept(),
    ajustes: DEFAULT_AJUSTE_ROWS.map(r => ({ ...r, values: { ...r.values } })),
  };
}

// ─── Compatibilidade com formato legado (audi_dre_YYYY_dept) ─────────────────

type LegacyLine = { label?: string; descricao?: string; meses?: number[]; values?: number[] };

const LEGACY_AUDI_DEPTS: Array<{ legacyKey: string; dreKey: keyof Omit<DreAudiRow, 'periodo' | 'ajustes'> }> = [
  { legacyKey: 'novos',         dreKey: 'novos'     },
  { legacyKey: 'usados',        dreKey: 'usados'    },
  { legacyKey: 'pecas',         dreKey: 'pecas'     },
  { legacyKey: 'oficina',       dreKey: 'oficina'   },
  { legacyKey: 'funilaria',     dreKey: 'funilaria' },
  { legacyKey: 'administracao', dreKey: 'adm'       },
];

const LEGACY_LABEL_TO_FIELD_AUDI: Record<string, keyof DreAudiDept> = {
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

function buildAudiDeptFromLegacy(lines: LegacyLine[] | null, monthIndex: number): DreAudiDept {
  const dept = emptyDept();
  if (!lines) return dept;
  for (const line of lines) {
    const label = ((line.label ?? line.descricao ?? '') as string).toUpperCase().trim();
    const field = LEGACY_LABEL_TO_FIELD_AUDI[label];
    if (field) {
      const vals = line.meses ?? line.values ?? [];
      const val = vals[monthIndex];
      if (val !== undefined && val !== null && val !== 0) dept[field] = val.toString();
    }
  }
  return dept;
}

async function loadAllDreAudiFromLegacy(year: number): Promise<(DreAudiRow | null)[]> {
  const legacyKeys = LEGACY_AUDI_DEPTS.map(d => `audi_dre_${year}_${d.legacyKey}`);
  const results = await kvBulkGet(legacyKeys);
  const hasAny = legacyKeys.some(k => results[k] !== null);
  if (!hasAny) return Array(12).fill(null);
  return Array.from({ length: 12 }, (_, monthIdx) => {
    const row = createEmptyDreAudiRow(year, monthIdx + 1);
    let hasDeptData = false;
    for (const { legacyKey, dreKey } of LEGACY_AUDI_DEPTS) {
      const lines = results[`audi_dre_${year}_${legacyKey}`] as LegacyLine[] | null;
      const dept = buildAudiDeptFromLegacy(lines, monthIdx);
      if (Object.values(dept).some(v => v !== '')) { row[dreKey] = dept; hasDeptData = true; }
    }
    return hasDeptData ? row : null;
  });
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

/** Carrega os 12 meses de um ano em uma única chamada bulk.
 *  Tenta primeiro o formato novo (resumo_dre:audi:YYYY-MM).
 *  Se não houver dados, cai no formato legado (audi_dre_YYYY_dept). */
export async function loadAllDreAudi(year: number): Promise<(DreAudiRow | null)[]> {
  try {
    const keys = Array.from({ length: 12 }, (_, i) => key(year, i + 1));
    const results = await kvBulkGet(keys);
    const rows = keys.map(k => (results[k] as DreAudiRow) ?? null);
    if (rows.some(r => r !== null)) return rows;
    return loadAllDreAudiFromLegacy(year);
  } catch {
    return Array(12).fill(null);
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
