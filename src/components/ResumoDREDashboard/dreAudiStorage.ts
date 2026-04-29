import { kvGet, kvSet } from '@/lib/kvClient';

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
