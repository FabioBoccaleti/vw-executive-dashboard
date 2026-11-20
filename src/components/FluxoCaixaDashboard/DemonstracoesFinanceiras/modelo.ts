import { z } from 'zod';
import type { ContaBalancete } from '../balanceteParser';
import { DFC_LINHAS_PADRAO, DFC_PREFIXOS_PADRAO, DFC_SECOES_PADRAO } from './dfcModeloPadrao';

export const TIPOS = { dre: 'DRE', ativo: 'Ativo', passivo: 'Passivo', dfc: 'DFC', endividamento: 'Endividamento' } as const;
export type TipoDemonstracao = keyof typeof TIPOS;
export const DFC_PREFIXOS_CAIXA_EQUIVALENTES_PADRAO = ['1.1.1'] as const;
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
  demonstracao: z.enum(['dre', 'ativo', 'passivo', 'dfc', 'endividamento']),
  tipo: z.enum(['contas', 'total']),
  itens: z.array(itemSchema).min(1),
  bancoDe: z.string().min(1).optional(),
  sublinhaDe: z.string().min(1).optional(),
  foraDfc: z.boolean().optional(),
  captacao: captacaoSchema.optional(),
});
export const cadastroSchema = z.object({
  version: z.string(),
  empresa: z.object({ nome: z.string(), cnpj: z.string(), nire: z.string() }),
  linhas: z.array(linhaSchema),
  assinantes: z.array(z.object({ id: z.string(), nome: z.string(), cargo: z.string(), registro: z.string() })),
  dfcModeloInicializado: z.boolean().optional(),
  dfcContasCaixaEquivalentes: z.array(z.string().trim().min(1)).min(1).optional(),
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
  const conta = linhas.filter(linha => linha.tipo === 'contas' && linha.demonstracao !== 'dfc')
    .flatMap(linha => linha.itens).find(item => incompletas.has(item.referencia));
  return conta ? `A conta ${conta.referencia} está incompleta ou é agrupadora. Selecione apenas contas completas (analíticas).` : null;
}

export const GRUPOS_RESULTADO = ['3', '4', '5', '6'];

export interface ContaNaoClassificada { conta: string; desc: string; valores: Array<number | null> }

export function identificarContasNaoClassificadas(
  linhas: LinhaDemonstracao[],
  colunas: Array<Array<ContasBalancete | null>>,
): ContaNaoClassificada[] {
  const incompletas = identificarContasIncompletas(colunas.flat());
  const referencias = linhas.filter(linha => linha.demonstracao === 'dre' && linha.tipo === 'contas')
    .flatMap(linha => linha.itens.map(item => item.referencia));
  const contas = new Map<string, string>();
  for (const periodo of colunas.flat()) {
    for (const conta of Object.values(periodo ?? {})) {
      if (GRUPOS_RESULTADO.includes(conta.conta.split('.')[0]) && !incompletas.has(conta.conta)
        && !referencias.some(referencia => conta.conta === referencia || conta.conta.startsWith(`${referencia}.`))) {
        contas.set(conta.conta, conta.desc);
      }
    }
  }
  return [...contas]
    .map(([conta, desc]) => ({
      conta,
      desc,
      valores: colunas.map(periodos => periodos.length === 0 || periodos.some(periodo => periodo === null)
        ? null
        : Math.round(periodos.reduce((total, periodo) => {
          const item = periodo?.[conta];
          return item ? total + Math.round((item.valCred - item.valDeb) * 100) : total;
        }, 0)) / 100),
    }))
    .filter(conta => conta.valores.some(valor => valor !== null && valor !== 0))
    .sort((a, b) => a.conta.localeCompare(b.conta, undefined, { numeric: true }));
}

export function cadastroVazio(): CadastroDemonstracoes {
  return {
    version: '', empresa: { nome: '', cnpj: '', nire: '' }, linhas: [], assinantes: [],
    dfcModeloInicializado: false, dfcContasCaixaEquivalentes: [...DFC_PREFIXOS_CAIXA_EQUIVALENTES_PADRAO],
  };
}

export function criarLinhasDfcPadrao(): LinhaDemonstracao[] {
  const linhas: LinhaDemonstracao[] = [];
  for (const secao of DFC_SECOES_PADRAO) {
    const sublinhas = DFC_LINHAS_PADRAO.filter(linha => linha.secao === secao.id);
    const idSecao = `dfc-${secao.id}`;
    linhas.push({
      id: idSecao,
      nome: secao.nome,
      demonstracao: 'dfc',
      tipo: 'total',
      itens: sublinhas.map(linha => ({ referencia: `dfc-${linha.codigo.toLowerCase()}`, operacao: 1 })),
    });
    for (const linha of sublinhas) {
      linhas.push({
        id: `dfc-${linha.codigo.toLowerCase()}`,
        nome: linha.nome,
        demonstracao: 'dfc',
        tipo: 'contas',
        sublinhaDe: idSecao,
        itens: DFC_PREFIXOS_PADRAO
          .filter(prefixo => prefixo.linha === linha.codigo)
          .map(prefixo => ({ referencia: prefixo.referencia, operacao: 1 })),
      });
    }
  }

  const gruposFora = [
    { codigo: 'CAIXA', id: 'dfc-fora-caixa', nome: 'Caixa' },
    { codigo: 'PL', id: 'dfc-fora-pl', nome: 'Patrimônio Líquido' },
    { codigo: 'COMP', id: 'dfc-fora-compensacoes', nome: 'Compensações' },
  ] as const;
  const idFora = 'dfc-fora';
  linhas.push({
    id: idFora,
    nome: 'Contas fora da DFC',
    demonstracao: 'dfc',
    tipo: 'total',
    foraDfc: true,
    itens: gruposFora.map(grupo => ({ referencia: grupo.id, operacao: 1 })),
  });
  for (const grupo of gruposFora) {
    linhas.push({
      id: grupo.id,
      nome: grupo.nome,
      demonstracao: 'dfc',
      tipo: 'contas',
      sublinhaDe: idFora,
      foraDfc: true,
      itens: DFC_PREFIXOS_PADRAO
        .filter(prefixo => prefixo.linha === grupo.codigo)
        .map(prefixo => ({ referencia: prefixo.referencia, operacao: 1 })),
    });
  }
  return linhas;
}

export function aplicarModeloDfcPadrao(cadastro: CadastroDemonstracoes): CadastroDemonstracoes {
  const dfcContasCaixaEquivalentes = cadastro.dfcContasCaixaEquivalentes
    ?? [...DFC_PREFIXOS_CAIXA_EQUIVALENTES_PADRAO];
  if (cadastro.dfcModeloInicializado) {
    return cadastro.dfcContasCaixaEquivalentes ? cadastro : { ...cadastro, dfcContasCaixaEquivalentes };
  }
  const jaConfigurada = cadastro.linhas.some(linha => linha.demonstracao === 'dfc');
  return {
    ...cadastro,
    linhas: jaConfigurada ? cadastro.linhas : [...cadastro.linhas, ...criarLinhasDfcPadrao()],
    dfcModeloInicializado: true,
    dfcContasCaixaEquivalentes,
  };
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
        const duplicada = contas.find(conta => conta.demonstracao === linha.demonstracao
          && (linha.demonstracao === 'dfc'
            ? conta.conta === item.referencia
            : mesmaHierarquia(conta.conta, item.referencia)));
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
      || (demonstracao === 'dfc' && Boolean(linha.foraDfc) !== Boolean(principal?.foraDfc))
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
        if (!origem || origem.demonstracao !== linha.demonstracao || (linhaPai(origem) && linhaPai(origem) !== linha.id)
          || (linha.demonstracao === 'dfc' && Boolean(origem.foraDfc) !== Boolean(linha.foraDfc))) {
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

export function calcularConta(
  item: ItemDemonstracao,
  demonstracao: TipoDemonstracao,
  periodos: Array<ContasBalancete | null>,
  incompletas = identificarContasIncompletas(periodos),
): number | null {
  if (!periodos.length || periodos.some(periodo => periodo === null) || incompletas.has(item.referencia)) return null;
  if (demonstracao === 'dfc') {
    const movimento = periodos.reduce((total, periodo) => {
      const conta = periodo?.[item.referencia];
      return total + (conta?.valCred ?? 0) - (conta?.valDeb ?? 0);
    }, 0);
    return Math.round(movimento * 100) / 100;
  }
  let valor = 0;
  for (const periodo of periodos) {
    const conta = periodo?.[item.referencia];
    if (!conta) continue;
    valor += demonstracao === 'dre' ? conta.valCred - conta.valDeb : conta.saldoAtual;
  }
  return demonstracao === 'dre'
    ? Math.round(valor * 100) / 100
    : Math.round(Math.abs(valor) * 100) * item.operacao / 100;
}

interface ContasDfcDistribuidas {
  porLinha: Map<string, ContaBalancete[]>;
  naoMapeadas: ContaBalancete[];
}

function distribuirContasDfc(linhas: LinhaDemonstracao[], periodos: Array<ContasBalancete | null>): ContasDfcDistribuidas {
  const regras = linhas.filter(linha => linha.demonstracao === 'dfc' && linha.tipo === 'contas')
    .flatMap(linha => linha.itens.map(item => ({ prefixo: item.referencia, linha: linha.id })))
    .sort((a, b) => b.prefixo.length - a.prefixo.length);
  const incompletas = identificarContasIncompletas(periodos);
  const contas = new Map<string, ContaBalancete>();
  for (const periodo of periodos) {
    for (const conta of Object.values(periodo ?? {})) {
      if (!incompletas.has(conta.conta)) contas.set(conta.conta, conta);
    }
  }

  const porLinha = new Map<string, ContaBalancete[]>();
  const naoMapeadas: ContaBalancete[] = [];
  for (const conta of contas.values()) {
    const regra = regras.find(({ prefixo }) => conta.conta === prefixo || conta.conta.startsWith(`${prefixo}.`));
    if (!regra) {
      naoMapeadas.push(conta);
      continue;
    }
    const grupo = porLinha.get(regra.linha) ?? [];
    grupo.push(conta);
    porLinha.set(regra.linha, grupo);
  }
  const ordenar = (a: ContaBalancete, b: ContaBalancete) =>
    a.conta.localeCompare(b.conta, undefined, { numeric: true });
  for (const contasDaLinha of porLinha.values()) contasDaLinha.sort(ordenar);
  naoMapeadas.sort(ordenar);
  return { porLinha, naoMapeadas };
}

export function listarContasDfcDaLinha(
  linhas: LinhaDemonstracao[],
  linhaId: string,
  periodos: Array<ContasBalancete | null>,
): ItemDemonstracao[] {
  return (distribuirContasDfc(linhas, periodos).porLinha.get(linhaId) ?? [])
    .map(conta => ({ referencia: conta.conta, operacao: 1 }));
}

export interface SaldosCaixaEquivalentes {
  saldoInicial: number | null;
  saldoFinal: number | null;
  variacaoReal: number | null;
}

export function calcularSaldosCaixaEquivalentes(
  prefixos: string[],
  periodos: Array<ContasBalancete | null>,
): SaldosCaixaEquivalentes {
  const indisponivel = { saldoInicial: null, saldoFinal: null, variacaoReal: null };
  if (!prefixos.length || !periodos.length || periodos.some(periodo => periodo === null)) {
    return indisponivel;
  }

  const incompletas = identificarContasIncompletas(periodos);
  const contas = new Map<string, ContaBalancete>();
  for (const periodo of periodos) {
    for (const conta of Object.values(periodo ?? {})) {
      if (!incompletas.has(conta.conta)
        && prefixos.some(prefixo => conta.conta === prefixo || conta.conta.startsWith(`${prefixo}.`))) {
        contas.set(conta.conta, conta);
      }
    }
  }
  const primeiro = periodos[0]!;
  const ultimo = periodos[periodos.length - 1]!;
  const somarSaldo = (periodo: ContasBalancete, campo: 'saldoAnt' | 'saldoAtual') =>
    [...contas.keys()].reduce((total, conta) => total + Math.round((periodo[conta]?.[campo] ?? 0) * 100), 0);
  const saldoInicialCentavos = somarSaldo(primeiro, 'saldoAnt');
  const saldoFinalCentavos = somarSaldo(ultimo, 'saldoAtual');
  const saldoInicial = saldoInicialCentavos / 100;
  const saldoFinal = saldoFinalCentavos / 100;
  return {
    saldoInicial,
    saldoFinal,
    variacaoReal: (saldoFinalCentavos - saldoInicialCentavos) / 100,
  };
}

export function identificarContasDfcNaoMapeadas(
  linhas: LinhaDemonstracao[],
  colunas: Array<Array<ContasBalancete | null>>,
): ContaNaoClassificada[] {
  const distribuidas = distribuirContasDfc(linhas, colunas.flat());
  return distribuidas.naoMapeadas.map(conta => ({
    conta: conta.conta,
    desc: conta.desc,
    valores: colunas.map(periodos => periodos.length === 0 || periodos.some(periodo => periodo === null)
      ? null
      : Math.round(periodos.reduce((total, periodo) => {
        const item = periodo?.[conta.conta];
        return total + (item?.valCred ?? 0) - (item?.valDeb ?? 0);
      }, 0) * 100) / 100),
  }));
}

export function calcularLinhas(
  linhas: LinhaDemonstracao[],
  demonstracao: TipoDemonstracao,
  periodos: Array<ContasBalancete | null>,
): Map<string, number | null> {
  const erro = validarLinhas(linhas);
  if (erro) throw new Error(erro);
  if (demonstracao === 'dfc') {
    const distribuidas = distribuirContasDfc(linhas, periodos);
    const linhasDfc = linhas.filter(item => item.demonstracao === 'dfc');
    const porId = new Map(linhasDfc.map(linha => [linha.id, linha]));
    const resultado = new Map<string, number | null>();
    function calcular(linha: LinhaDemonstracao): number | null {
      if (resultado.has(linha.id)) return resultado.get(linha.id) ?? null;
      let total = 0;
      let disponivel = periodos.length > 0 && periodos.every(periodo => periodo !== null);
      if (linha.tipo === 'total') {
        for (const item of linha.itens) {
          const origem = porId.get(item.referencia);
          const valor = origem ? calcular(origem) : null;
          if (valor === null || valor === undefined) disponivel = false;
          else total += Math.round(valor * 100);
        }
      } else {
        for (const conta of distribuidas.porLinha.get(linha.id) ?? []) {
          for (const periodo of periodos) {
            const atual = periodo?.[conta.conta];
            total += Math.round(((atual?.valCred ?? 0) - (atual?.valDeb ?? 0)) * 100);
          }
        }
      }
      const valor = disponivel ? total / 100 : null;
      resultado.set(linha.id, valor);
      return valor;
    }
    return new Map(linhasDfc.map(linha => [linha.id, calcular(linha)]));
  }
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
        const valor = calcularConta(item, demonstracao, periodos, incompletas);
        if (valor === null) disponivel = false;
        else total += Math.round(valor * 100);
      }
    }
    const valor = disponivel ? total / 100 : null;
    resultado.set(linha.id, valor);
    return valor;
  }
  return new Map(linhasDemonstracao.map(linha => [linha.id, calcular(linha)]));
}
