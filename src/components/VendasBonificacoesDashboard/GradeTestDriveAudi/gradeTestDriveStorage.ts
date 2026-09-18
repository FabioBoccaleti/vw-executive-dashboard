import { kvGet, kvSet } from '@/lib/kvClient';

// ─── Constantes de domínio ──────────────────────────────────────────────────

export const MODELOS = ['A1', 'A3', 'Q3', 'A4', 'A5', 'Q5', 'Q6', 'Q7', 'Q8'] as const;
export type Modelo = (typeof MODELOS)[number];

export type Classificacao = 'test_drive' | 'courtesy_car';
export const CLASSIFICACAO_LABELS: Record<Classificacao, string> = {
  test_drive: 'Test Drive',
  courtesy_car: 'Courtesy Car',
};

export type CondicaoPagamento =
  | 'a_vista'
  | 'a_prazo'
  | 'financiamento_banco_volks'
  | 'floor_plan_banco_volks'
  | 'floor_plan_itau'
  | 'financiamento_outros';

export const CONDICAO_PAGAMENTO_LABELS: Record<CondicaoPagamento, string> = {
  a_vista: 'À Vista',
  a_prazo: 'A Prazo',
  financiamento_banco_volks: 'Financiamento Banco Volks',
  floor_plan_banco_volks: 'Floor Plan Banco Volks',
  floor_plan_itau: 'Floor Plan Itaú',
  financiamento_outros: 'Financiamento Outros',
};

export const PRAZO_COMERCIALIZACAO_PADRAO = 120;
export const PRAZO_ELEGIBILIDADE_PADRAO = 180;

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface GradeExigenciaItem {
  modelo: Modelo;
  classificacao: Classificacao;
  quantidade: number;
}

export interface GradeTrimestre {
  ano: number;
  trimestre: number; // 1..4
  prazoComercializacaoDias: number;
  prazoElegibilidadeDias: number;
  exigencias: GradeExigenciaItem[];
}

export interface VeiculoGrade {
  id: string;
  modelo: Modelo;
  chassi: string;
  dataCompra: string; // yyyy-mm-dd
  valorCompra: number;
  classificacao: Classificacao;
  condicaoPagamento: CondicaoPagamento;
  dataVencimentoPagamento: string | null; // yyyy-mm-dd, apenas quando não for à vista
  vendido: boolean;
  dataVenda: string | null; // yyyy-mm-dd
  criadoEm: string;
}

// ─── Chaves de armazenamento ────────────────────────────────────────────────

const GRADES_KEY = 'grade-test-drive-audi:grades';
const VEICULOS_KEY = 'grade-test-drive-audi:veiculos';

// ─── Grades ─────────────────────────────────────────────────────────────────

export async function getGrades(): Promise<GradeTrimestre[]> {
  return (await kvGet<GradeTrimestre[]>(GRADES_KEY)) ?? [];
}

export async function saveGrades(grades: GradeTrimestre[]): Promise<boolean> {
  return kvSet(GRADES_KEY, grades);
}

// ─── Veículos ───────────────────────────────────────────────────────────────

export async function getVeiculos(): Promise<VeiculoGrade[]> {
  return (await kvGet<VeiculoGrade[]>(VEICULOS_KEY)) ?? [];
}

export async function saveVeiculos(veiculos: VeiculoGrade[]): Promise<boolean> {
  return kvSet(VEICULOS_KEY, veiculos);
}

// ─── Helpers de data e elegibilidade ────────────────────────────────────────

function toISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

export function lastDayOfQuarterISO(ano: number, trimestre: number): string {
  const endMonth = trimestre * 3; // 3, 6, 9, 12
  return toISO(new Date(ano, endMonth, 0)); // dia 0 do mês seguinte = último dia do mês final
}

export function firstDayOfQuarterISO(ano: number, trimestre: number): string {
  const startMonth = (trimestre - 1) * 3 + 1; // 1, 4, 7, 10
  return `${ano}-${String(startMonth).padStart(2, '0')}-01`;
}

/** Disponível para venda quando a data de referência já passou do prazo de comercialização. */
export function situacaoVendaVeiculo(
  veiculo: VeiculoGrade,
  grades: GradeTrimestre[],
  referenciaISO: string,
): 'disponivel' | 'bloqueado' {
  return referenciaISO >= liberadoVendaVeiculo(veiculo, grades) ? 'disponivel' : 'bloqueado';
}

export function quarterOfISO(iso: string): { ano: number; trimestre: number } {
  const [year, month] = iso.split('-').map(Number);
  return { ano: year, trimestre: Math.floor((month - 1) / 3) + 1 };
}

/** Retorna os prazos vigentes no trimestre informado (ou os padrões). */
export function getPrazosTrimestre(grades: GradeTrimestre[], ano: number, trimestre: number) {
  const grade = grades.find(item => item.ano === ano && item.trimestre === trimestre);
  return {
    comercializacao: grade?.prazoComercializacaoDias ?? PRAZO_COMERCIALIZACAO_PADRAO,
    elegibilidade: grade?.prazoElegibilidadeDias ?? PRAZO_ELEGIBILIDADE_PADRAO,
  };
}

/** Vencimento na grade = data da compra + prazo de elegibilidade do trimestre da compra. */
export function vencimentoGradeVeiculo(veiculo: VeiculoGrade, grades: GradeTrimestre[]): string {
  const periodo = quarterOfISO(veiculo.dataCompra);
  const prazos = getPrazosTrimestre(grades, periodo.ano, periodo.trimestre);
  return addDaysISO(veiculo.dataCompra, prazos.elegibilidade);
}

/** Data a partir da qual o veículo pode ser comercializado. */
export function liberadoVendaVeiculo(veiculo: VeiculoGrade, grades: GradeTrimestre[]): string {
  const periodo = quarterOfISO(veiculo.dataCompra);
  const prazos = getPrazosTrimestre(grades, periodo.ano, periodo.trimestre);
  return addDaysISO(veiculo.dataCompra, prazos.comercializacao);
}

/** Elegível quando o vencimento é maior ou igual ao último dia do trimestre + 1. */
export function vencimentoElegivelNoTrimestre(vencimentoISO: string, ano: number, trimestre: number): boolean {
  const limite = addDaysISO(lastDayOfQuarterISO(ano, trimestre), 1);
  return vencimentoISO >= limite;
}

/**
 * Indica se o veículo garante a grade no trimestre:
 * comprado até o fim do trimestre, ainda em estoque no período e com vencimento válido.
 */
export function veiculoGaranteGrade(
  veiculo: VeiculoGrade,
  grades: GradeTrimestre[],
  ano: number,
  trimestre: number,
): boolean {
  const ultimoDia = lastDayOfQuarterISO(ano, trimestre);
  if (veiculo.dataCompra > ultimoDia) return false;
  if (veiculo.vendido && veiculo.dataVenda && veiculo.dataVenda <= ultimoDia) return false;
  const vencimento = vencimentoGradeVeiculo(veiculo, grades);
  return vencimentoElegivelNoTrimestre(vencimento, ano, trimestre);
}
