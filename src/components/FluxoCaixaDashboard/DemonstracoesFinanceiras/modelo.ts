import { z } from 'zod';
import type { ContaBalancete } from '../balanceteParser';

export const TIPOS = { dre: 'DRE', ativo: 'Ativo', passivo: 'Passivo', endividamento: 'Endividamento' } as const;
export type TipoDemonstracao = keyof typeof TIPOS;
export const MESES = ['Anual', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const itemSchema = z.object({ referencia: z.string().min(1), operacao: z.union([z.literal(1), z.literal(-1)]) });
const mesCaptacaoSchema = z.string().regex(/^\d{4}_(?:[1-9]|1[0-2])$/);
export const captacaoSchema = z.object({
  data: z.string().date('Informe uma data de captação válida.').optional(),
  valorCentavos: z.number().int().safe().nonnegative('Informe um valor de captação válido.').optional(),
  taxa: z.string().trim().min(1).optional(),
  parcelasTotais: z.number().int('Informe um número inteiro de parcelas.').positive('O total de parcelas deve ser maior que zero.').safe().optional(),
  restantesPorMes: z.record(mesCaptacaoSchema, z.number().int().nonnegative().safe()),
  jurosProvisionadosPorMes: z.record(mesCaptacaoSchema, z.number().int().nonnegative().safe()).optional(),
}).refine(
  ({ parcelasTotais, restantesPorMes }) => parcelasTotais === undefined || Object.values(restantesPorMes).every(restantes => restantes <= parcelasTotais),
  'As parcelas restantes de cada mês não podem exceder o total de parcelas.',
);
export type Captacao = z.infer<typeof captacaoSchema>;

const linhaSchema = z.object({
  id: z.string().min(1),
  nome: z.string().trim().min(1),
  demonstracao: z.enum(['dre', 'ativo', 'passivo', 'endividamento']),
  tipo: z.enum(['contas', 'total']),
  itens: z.array(itemSchema).min(1),
  bancoDe: z.string().min(1).optional(),
  sublinhaDe: z.string().min(1).optional(),
  captacao: captacaoSchema.optional(),
});
export const cadastroSchema = z.object({
  version: z.string(),
  empresa: z.object({ nome: z.string(), cnpj: z.string(), nire: z.string() }),
  linhas: z.array(linhaSchema),
  assinantes: z.array(z.object({ id: z.string(), nome: z.string(), cargo: z.string(), registro: z.string() })),
});
export type CadastroDemonstracoes = z.infer<typeof cadastroSchema>;
export type LinhaDemonstracao = z.infer<typeof linhaSchema>;
export type ItemDemonstracao = z.infer<typeof itemSchema>;
export type ContasBalancete = Record<string, ContaBalancete>;
export interface PeriodoDemonstracao { ano: number; mes: number }
export type DadosDemonstracoes = Record<string, ContasBalancete | null>;
export const linhaPai = (linha: LinhaDemonstracao) => linha.bancoDe ?? linha.sublinhaDe;

export const chavePeriodo = ({ ano, mes }: PeriodoDemonstracao) => `${ano}_${mes}`;
export const rotuloPeriodo = ({ ano, mes }: PeriodoDemonstracao) => `${MESES[mes]}/${String(ano).slice(-2)}`;
export const mesmaHierarquia = (a: string, b: string) => a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);

export function identificarContasIncompletas(periodos: Array<ContasBalancete | null>): Set<string> {
  const codigos = new Set<string>();
  const incompletas = new Set<string>();
  for (const periodo of periodos) {
    for (const conta of Object.values(periodo ?? {})) {
      codigos.add(conta.conta);
      if (conta.nivel.toUpperCase() === 'S') incompletas.add(conta.conta);
    }
  }
  for (const codigo of codigos) {
    const partes = codigo.split('.');
    while (partes.length > 1) {
      partes.pop();
      const prefixo = partes.join('.');
      if (codigos.has(prefixo)) incompletas.add(prefixo);
    }
  }
  return incompletas;
}

export function validarContasCompletas(linhas: LinhaDemonstracao[], incompletas: Set<string>): string | null {
  const conta = linhas.filter(linha => linha.tipo === 'contas')
    .flatMap(linha => linha.itens).find(item => incompletas.has(item.referencia));
  return conta ? `A conta ${conta.referencia} está incompleta ou é agrupadora. Selecione apenas contas completas (analíticas).` : null;
}

export function cadastroVazio(): CadastroDemonstracoes {
  return { version: '', empresa: { nome: '', cnpj: '', nire: '' }, linhas: [], assinantes: [] };
}

export function validarLinhas(linhas: LinhaDemonstracao[]): string | null {
  const ids = new Set<string>();
  const contas: Array<{ conta: string; grupo: string; demonstracao: TipoDemonstracao }> = [];
  const porId = new Map<string, LinhaDemonstracao>();
  for (const linha of linhas) {
    if (!linhaSchema.safeParse(linha).success) return 'Preencha o nome e selecione ao menos uma conta ou grupo em cada linha.';
    if (ids.has(linha.id)) return 'Existem linhas com identificadores repetidos.';
    ids.add(linha.id);
    porId.set(linha.id, linha);
    if (linhas.some(item => item.id !== linha.id && item.demonstracao === linha.demonstracao && linhaPai(item) === linhaPai(linha) && item.nome.trim().toLocaleLowerCase() === linha.nome.trim().toLocaleLowerCase())) {
      return `Já existe uma linha chamada "${linha.nome}" nesta demonstração.`;
    }
    const referencias = new Set<string>();
    for (const item of linha.itens) {
      if (referencias.has(item.referencia)) return `Referência repetida em "${linha.nome}".`;
      referencias.add(item.referencia);
      if (linha.tipo === 'contas') {
        const duplicada = contas.find(conta => conta.demonstracao === linha.demonstracao && mesmaHierarquia(conta.conta, item.referencia));
        if (duplicada) return `A conta ${item.referencia} se sobrepõe à conta ${duplicada.conta}, no grupo "${duplicada.grupo}". Não selecione uma conta totalizadora junto com suas subcontas.`;
        contas.push({ conta: item.referencia, grupo: linha.nome, demonstracao: linha.demonstracao });
      }
    }
  }

  for (const linha of linhas) {
    const pai = linhaPai(linha);
    if (!pai) continue;
    const principal = porId.get(pai);
    const demonstracao = linha.demonstracao;
    if ((linha.bancoDe && linha.sublinhaDe) || (linha.bancoDe ? demonstracao !== 'endividamento' : demonstracao === 'endividamento')
      || linha.tipo !== 'contas' || principal?.demonstracao !== demonstracao
      || linhaPai(principal) || principal.tipo !== 'total' || !principal.itens.every(item => {
        const filha = porId.get(item.referencia);
        return filha && linhaPai(filha) === principal.id && item.operacao === 1;
      })
      || !principal.itens.some(item => item.referencia === linha.id)) {
      return `A sublinha "${linha.nome}" deve fazer parte da soma da sua linha principal de ${TIPOS[demonstracao]}.`;
    }
  }

  const composicoes = new Map<string, Set<string>>();
  const visitando = new Set<string>();
  function resolverComposicao(linha: LinhaDemonstracao): string | null {
    if (composicoes.has(linha.id)) return null;
    if (visitando.has(linha.id)) return `A totalização "${linha.nome}" não pode criar uma dependência circular.`;
    visitando.add(linha.id);
    const composicao = new Set<string>();
    if (linha.tipo === 'contas') composicao.add(linha.id);
    else {
      for (const item of linha.itens) {
        const origem = porId.get(item.referencia);
        if (!origem || origem.demonstracao !== linha.demonstracao || (linhaPai(origem) && linhaPai(origem) !== linha.id)) {
          return `A totalização "${linha.nome}" deve usar somente linhas cadastradas na mesma demonstração.`;
        }
        const erro = resolverComposicao(origem);
        if (erro) return erro;
        for (const id of composicoes.get(origem.id) ?? []) {
          if (composicao.has(id)) return `A totalização "${linha.nome}" inclui o mesmo grupo mais de uma vez, diretamente ou por outro subtotal.`;
          composicao.add(id);
        }
      }
    }
    visitando.delete(linha.id);
    composicoes.set(linha.id, composicao);
    return null;
  }
  for (const linha of linhas) {
    const erro = resolverComposicao(linha);
    if (erro) return erro;
  }
  return null;
}

export function validarCadastro(cadastro: CadastroDemonstracoes): string | null {
  if (!cadastroSchema.safeParse(cadastro).success) return 'Cadastro de demonstrações inválido.';
  if (!cadastro.empresa.nome.trim() || !cadastro.empresa.cnpj.trim()) return 'Informe o nome da empresa e o CNPJ.';
  if (cadastro.assinantes.some(item => !item.nome.trim() || !item.cargo.trim())) return 'Informe nome e cargo de todos os assinantes.';
  return validarLinhas(cadastro.linhas);
}

export function calcularLinhas(
  linhas: LinhaDemonstracao[],
  demonstracao: TipoDemonstracao,
  periodos: Array<ContasBalancete | null>,
): Map<string, number | null> {
  const erro = validarLinhas(linhas);
  if (erro) throw new Error(erro);
  const incompletas = identificarContasIncompletas(periodos);
  const linhasDemonstracao = linhas.filter(item => item.demonstracao === demonstracao);
  const porId = new Map(linhasDemonstracao.map(linha => [linha.id, linha]));
  const resultado = new Map<string, number | null>();
  function calcular(linha: LinhaDemonstracao): number | null {
    if (resultado.has(linha.id)) return resultado.get(linha.id) ?? null;
    let total = 0;
    let disponivel = periodos.length > 0 && periodos.every(periodo => periodo !== null);
    for (const item of linha.itens) {
      if (linha.tipo === 'total') {
        const origem = porId.get(item.referencia);
        const valor = origem ? calcular(origem) : null;
        if (valor === null || valor === undefined) disponivel = false;
        else total += Math.round(valor * 100) * (demonstracao === 'dre' ? 1 : item.operacao);
      } else {
        if (incompletas.has(item.referencia)) { disponivel = false; continue; }
        let valor = 0;
        for (const periodo of periodos) {
          const conta = periodo?.[item.referencia];
          if (!conta) continue;
          valor += demonstracao === 'dre' ? conta.valCred - conta.valDeb : conta.saldoAtual;
        }
        total += demonstracao === 'dre'
          ? Math.round(valor * 100)
          : Math.round(Math.abs(valor) * 100) * item.operacao;
      }
    }
    const valor = disponivel ? total / 100 : null;
    resultado.set(linha.id, valor);
    return valor;
  }
  return new Map(linhasDemonstracao.map(linha => [linha.id, calcular(linha)]));
}
