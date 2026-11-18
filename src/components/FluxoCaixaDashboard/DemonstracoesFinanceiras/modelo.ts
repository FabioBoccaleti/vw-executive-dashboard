import { z } from 'zod';
import type { ContaBalancete } from '../balanceteParser';

export const TIPOS = { dre: 'DRE', ativo: 'Ativo', passivo: 'Passivo' } as const;
export type TipoDemonstracao = keyof typeof TIPOS;
export const MESES = ['Anual', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const itemSchema = z.object({ referencia: z.string().min(1), operacao: z.union([z.literal(1), z.literal(-1)]) });
const linhaSchema = z.object({
  id: z.string().min(1),
  nome: z.string().trim().min(1),
  demonstracao: z.enum(['dre', 'ativo', 'passivo']),
  tipo: z.enum(['contas', 'total']),
  itens: z.array(itemSchema).min(1),
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
  const anteriores = new Map<string, LinhaDemonstracao>();
  const composicoes = new Map<string, Set<string>>();
  for (const linha of linhas) {
    if (!linhaSchema.safeParse(linha).success) return 'Preencha o nome e selecione ao menos uma conta ou grupo em cada linha.';
    if (ids.has(linha.id)) return 'Existem linhas com identificadores repetidos.';
    ids.add(linha.id);
    if (linhas.some(item => item.id !== linha.id && item.demonstracao === linha.demonstracao && item.nome.trim().toLocaleLowerCase() === linha.nome.trim().toLocaleLowerCase())) {
      return `Já existe uma linha chamada "${linha.nome}" nesta demonstração.`;
    }
    const referencias = new Set<string>();
    const composicao = new Set<string>();
    for (const item of linha.itens) {
      if (referencias.has(item.referencia)) return `Referência repetida em "${linha.nome}".`;
      referencias.add(item.referencia);
      if (linha.tipo === 'contas') {
        const duplicada = contas.find(conta => conta.demonstracao === linha.demonstracao && mesmaHierarquia(conta.conta, item.referencia));
        if (duplicada) return `A conta ${item.referencia} se sobrepõe à conta ${duplicada.conta}, no grupo "${duplicada.grupo}". Não selecione uma conta totalizadora junto com suas subcontas.`;
        contas.push({ conta: item.referencia, grupo: linha.nome, demonstracao: linha.demonstracao });
        composicao.add(linha.id);
      } else {
        const origem = anteriores.get(item.referencia);
        if (!origem || origem.demonstracao !== linha.demonstracao) return `A totalização "${linha.nome}" deve usar somente grupos anteriores da mesma demonstração.`;
        for (const id of composicoes.get(origem.id) ?? []) {
          if (composicao.has(id)) return `A totalização "${linha.nome}" inclui o mesmo grupo mais de uma vez, diretamente ou por outro subtotal.`;
          composicao.add(id);
        }
      }
    }
    anteriores.set(linha.id, linha);
    composicoes.set(linha.id, composicao);
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
  const resultado = new Map<string, number | null>();
  const erro = validarLinhas(linhas);
  if (erro) throw new Error(erro);
  const incompletas = identificarContasIncompletas(periodos);
  for (const linha of linhas.filter(item => item.demonstracao === demonstracao)) {
    let total = 0;
    let disponivel = periodos.length > 0 && periodos.every(periodo => periodo !== null);
    for (const item of linha.itens) {
      if (linha.tipo === 'total') {
        const valor = resultado.get(item.referencia);
        if (valor === null || valor === undefined) disponivel = false;
        else total += Math.round(valor * 100) * (demonstracao === 'dre' ? 1 : item.operacao);
      } else {
        if (incompletas.has(item.referencia)) { disponivel = false; continue; }
        let valor = 0;
        for (const periodo of periodos) {
          const conta = periodo?.[item.referencia];
          if (!conta) { disponivel = false; continue; }
          valor += demonstracao === 'dre' ? conta.valCred - conta.valDeb : conta.saldoAtual;
        }
        total += demonstracao === 'dre'
          ? Math.round(valor * 100)
          : Math.round(Math.abs(valor) * 100) * item.operacao;
      }
    }
    resultado.set(linha.id, disponivel ? total / 100 : null);
  }
  return resultado;
}
