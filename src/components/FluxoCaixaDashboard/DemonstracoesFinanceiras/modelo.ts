import { z } from 'zod';
import type { ContaBalancete } from '../balanceteParser';
import { DFC_LINHAS_PADRAO, DFC_PREFIXOS_PADRAO, DFC_SECOES_PADRAO } from './dfcModeloPadrao';
import {
  DFC_INDIRETO_AJUSTES,
  DFC_INDIRETO_CATEGORIAS_MAPEAVEIS,
  DFC_INDIRETO_REGRAS_PADRAO,
  DFC_INDIRETO_VARIACOES,
} from './dfcMetodoIndireto';

export const TIPOS = { dre: 'DRE', ativo: 'Ativo', passivo: 'Passivo', dfc: 'DFC', endividamento: 'Endividamento' } as const;
export type TipoDemonstracao = keyof typeof TIPOS;
export const DFC_PREFIXOS_CAIXA_EQUIVALENTES_PADRAO = ['1.1.1'] as const;
export const MESES = ['Anual', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const DFC_SUBTOTAIS_PADRAO = new Map<string, string>(DFC_SECOES_PADRAO.map(secao => [
  `dfc-${secao.id}`,
  `CAIXA LÍQUIDO DAS ${secao.nome.toLocaleUpperCase('pt-BR')}`,
] as const));

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
  itens: z.array(itemSchema),
  bancoDe: z.string().min(1).optional(),
  sublinhaDe: z.string().min(1).optional(),
  foraDfc: z.boolean().optional(),
  dfcSubtotalNome: z.string().trim().min(1).optional(),
  captacao: captacaoSchema.optional(),
  contasPorPrefixo: z.boolean().optional(),
  saldoInvertido: z.boolean().optional(),
  calculo: z.enum(['resultadoBalancete']).optional(),
  modeloProtegido: z.boolean().optional(),
}).refine(linha => linha.calculo
  ? linha.tipo === 'contas' && linha.demonstracao === 'passivo' && linha.itens.length === 0
  : linha.itens.length > 0);
const dfcIndiretoRegraSchema = z.object({
  referencia: z.string().trim().regex(/^\d+(?:\.\d+)*$/),
  linha: z.string().refine(linha => DFC_INDIRETO_CATEGORIAS_MAPEAVEIS.some(categoria => categoria.codigo === linha)),
});
export const cadastroSchema = z.object({
  version: z.string(),
  empresa: z.object({ nome: z.string(), cnpj: z.string(), nire: z.string() }),
  linhas: z.array(linhaSchema),
  assinantes: z.array(z.object({ id: z.string(), nome: z.string(), cargo: z.string(), registro: z.string() })),
  dfcModeloInicializado: z.boolean().optional(),
  dfcContasCaixaEquivalentes: z.array(z.string().trim().min(1)).min(1).optional(),
  dfcIndiretoModeloInicializado: z.boolean().optional(),
  dfcIndiretoRegras: z.array(dfcIndiretoRegraSchema).optional(),
  modeloBalancoSoranaAplicado: z.boolean().optional(),
});
export type CadastroDemonstracoes = z.infer<typeof cadastroSchema>;
export type RegraDfcIndireto = z.infer<typeof dfcIndiretoRegraSchema>;
export type LinhaDemonstracao = z.infer<typeof linhaSchema>;
export type ItemDemonstracao = z.infer<typeof itemSchema>;
export type ContasBalancete = Record<string, ContaBalancete>;
export interface PeriodoDemonstracao { ano: number; mes: number }
export type DadosDemonstracoes = Record<string, ContasBalancete | null>;
export const linhaPai = (linha: LinhaDemonstracao) => linha.bancoDe ?? linha.sublinhaDe;
export const LINHA_PL_ID = 'passivo-pl';
export const LINHA_RESULTADO_PERIODO_ID = 'passivo-resultado-periodo';

const PREFIXOS_PL_SORANA = ['2.3.1', '2.3.2.01', '2.3.2.02', '2.3.2.03', '2.3.3'];

const normalizarNomeLinhaDre = (nome: string) =>
  nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');

export function encontrarLinhaDrePorNomes(linhas: LinhaDemonstracao[], nomes: string[]): LinhaDemonstracao | undefined {
  for (const nome of nomes) {
    const nomeNormalizado = normalizarNomeLinhaDre(nome);
    const correspondencias = linhas.filter(linha => linha.demonstracao === 'dre' && !linhaPai(linha)
      && normalizarNomeLinhaDre(linha.nome) === nomeNormalizado);
    if (correspondencias.length > 0) return correspondencias.length === 1 ? correspondencias[0] : undefined;
  }
  return undefined;
}

export function encontrarLinhaBasePercentualDre(linhas: LinhaDemonstracao[]): LinhaDemonstracao | undefined {
  return encontrarLinhaDrePorNomes(linhas, ['Receita Líquida de Vendas', 'Receita Operacional Líquida', 'Receita Líquida']);
}

export function listarLinhasDre(linhas: LinhaDemonstracao[]): Array<{ linha: LinhaDemonstracao; recuo: boolean }> {
  const linhasDre = linhas.filter(linha => linha.demonstracao === 'dre');
  return linhasDre.filter(linha => !linhaPai(linha)).flatMap(raiz => [
    { linha: raiz, recuo: false },
    ...linhasDre.filter(linha => linhaPai(linha) === raiz.id).map(linha => ({ linha, recuo: true })),
  ]);
}

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
  const conta = linhas.filter(linha => linha.tipo === 'contas' && linha.demonstracao !== 'dfc' && !linha.contasPorPrefixo)
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
    dfcIndiretoModeloInicializado: false,
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
      dfcSubtotalNome: DFC_SUBTOTAIS_PADRAO.get(idSecao),
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

function migrarNomesSubtotaisDfc(linhas: LinhaDemonstracao[]): LinhaDemonstracao[] {
  return linhas.map(linha => {
    const nome = DFC_SUBTOTAIS_PADRAO.get(linha.id);
    return linha.demonstracao === 'dfc' && nome && !linha.dfcSubtotalNome
      ? { ...linha, dfcSubtotalNome: nome }
      : linha;
  });
}

export function aplicarModeloDfcPadrao(cadastro: CadastroDemonstracoes): CadastroDemonstracoes {
  const dfcContasCaixaEquivalentes = cadastro.dfcContasCaixaEquivalentes
    ?? [...DFC_PREFIXOS_CAIXA_EQUIVALENTES_PADRAO];
  const linhas = migrarNomesSubtotaisDfc(cadastro.linhas);
  const linhasAlteradas = linhas.some((linha, index) => linha !== cadastro.linhas[index]);
  let atualizado = cadastro;
  if (cadastro.dfcModeloInicializado) {
    if (!cadastro.dfcContasCaixaEquivalentes || linhasAlteradas) {
      atualizado = { ...cadastro, linhas, dfcContasCaixaEquivalentes };
    }
  } else {
    const jaConfigurada = linhas.some(linha => linha.demonstracao === 'dfc');
    atualizado = {
      ...cadastro,
      linhas: jaConfigurada ? linhas : [...linhas, ...criarLinhasDfcPadrao()],
      dfcModeloInicializado: true,
      dfcContasCaixaEquivalentes,
    };
  }
  if (atualizado.dfcIndiretoModeloInicializado) return atualizado;
  return {
    ...atualizado,
    dfcIndiretoModeloInicializado: true,
    dfcIndiretoRegras: atualizado.dfcIndiretoRegras ?? [...DFC_INDIRETO_REGRAS_PADRAO],
  };
}

export function aplicarModeloBalancoSorana(cadastro: CadastroDemonstracoes): CadastroDemonstracoes {
  if (cadastro.modeloBalancoSoranaAplicado) return cadastro;

  const idsPlLegados = new Set<string>();
  const linhasPlLegadas = cadastro.linhas.filter(linha => linha.demonstracao === 'passivo'
    && (linha.id === LINHA_PL_ID
      || normalizarNomeLinhaDre(linha.nome) === normalizarNomeLinhaDre('Patrimônio Líquido')));
  for (const linha of linhasPlLegadas) {
    idsPlLegados.add(linha.id);
    for (const filha of cadastro.linhas.filter(item => linhaPai(item) === linha.id)) idsPlLegados.add(filha.id);
  }

  let linhas = cadastro.linhas
    .filter(linha => !idsPlLegados.has(linha.id))
    .map(linha => {
      if (linha.demonstracao !== 'passivo') return linha;
      if (linha.tipo === 'contas') {
        const itens = linha.itens.filter(item => !PREFIXOS_PL_SORANA.some(prefixo =>
          mesmaHierarquia(item.referencia, prefixo)));
        return itens.length === linha.itens.length ? linha : { ...linha, itens };
      }
      const itens = linha.itens.filter(item => !idsPlLegados.has(item.referencia));
      return itens.length === linha.itens.length ? linha : { ...linha, itens };
    });

  let alterou = true;
  while (alterou) {
    const ids = new Set(linhas.map(linha => linha.id));
    const filtradas = linhas
      .filter(linha => linha.calculo || linha.itens.length > 0)
      .map(linha => {
        if (linha.tipo !== 'total') return linha;
        const itens = linha.itens.filter(item => ids.has(item.referencia));
        return itens.length === linha.itens.length ? linha : { ...linha, itens };
      });
    const validas = filtradas.filter(linha => linha.calculo || linha.itens.length > 0);
    alterou = validas.length !== linhas.length || validas.some((linha, index) => linha !== linhas[index]);
    linhas = validas;
  }

  const filhosPl: LinhaDemonstracao[] = [
    {
      id: 'passivo-pl-capital',
      nome: 'Capital Social',
      demonstracao: 'passivo',
      tipo: 'contas',
      sublinhaDe: LINHA_PL_ID,
      contasPorPrefixo: true,
      modeloProtegido: true,
      itens: [{ referencia: '2.3.1', operacao: 1 }],
    },
    {
      id: 'passivo-pl-reservas-capital',
      nome: 'Reservas de Capital',
      demonstracao: 'passivo',
      tipo: 'contas',
      sublinhaDe: LINHA_PL_ID,
      contasPorPrefixo: true,
      modeloProtegido: true,
      itens: [{ referencia: '2.3.2.01', operacao: 1 }],
    },
    {
      id: 'passivo-pl-reservas-lucros',
      nome: 'Reservas de Lucros',
      demonstracao: 'passivo',
      tipo: 'contas',
      sublinhaDe: LINHA_PL_ID,
      contasPorPrefixo: true,
      modeloProtegido: true,
      itens: [
        { referencia: '2.3.2.02', operacao: 1 },
        { referencia: '2.3.2.03', operacao: 1 },
      ],
    },
    {
      id: 'passivo-pl-lucros-acumulados',
      nome: 'Lucros (Prejuízos) Acumulados',
      demonstracao: 'passivo',
      tipo: 'contas',
      sublinhaDe: LINHA_PL_ID,
      contasPorPrefixo: true,
      modeloProtegido: true,
      itens: [{ referencia: '2.3.3', operacao: 1 }],
    },
    {
      id: LINHA_RESULTADO_PERIODO_ID,
      nome: 'Resultado do Período',
      demonstracao: 'passivo',
      tipo: 'contas',
      sublinhaDe: LINHA_PL_ID,
      calculo: 'resultadoBalancete',
      modeloProtegido: true,
      itens: [],
    },
  ];
  const linhaPl: LinhaDemonstracao = {
    id: LINHA_PL_ID,
    nome: 'Patrimônio Líquido',
    demonstracao: 'passivo',
    tipo: 'total',
    modeloProtegido: true,
    itens: filhosPl.map(linha => ({ referencia: linha.id, operacao: 1 })),
  };
  linhas = [...linhas, linhaPl, ...filhosPl];
  return { ...cadastro, linhas, modeloBalancoSoranaAplicado: true };
}

export function validarRegrasDfcIndireto(regras: RegraDfcIndireto[]): string | null {
  const referencias = new Set<string>();
  for (const regra of regras) {
    if (!dfcIndiretoRegraSchema.safeParse(regra).success) return 'Selecione uma conta e uma linha válida para cada regra da DFC indireta.';
    if (referencias.has(regra.referencia)) return `A conta ${regra.referencia} está repetida no mapeamento da DFC indireta.`;
    referencias.add(regra.referencia);
  }
  return null;
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
  return validarLinhas(cadastro.linhas) ?? validarRegrasDfcIndireto(cadastro.dfcIndiretoRegras ?? []);
}

export interface ResultadoDfcIndireto {
  valores: Map<string, number | null>;
  contasPorLinha: Map<string, ContaBalancete[]>;
  valoresContasPorLinha: Map<string, Map<string, number | null>>;
  contasOperacionaisSemLinha: number | null;
}

const codigoDeResultado = (codigo: string) =>
  /^(?:3|4|5)(?:\.|$)/.test(codigo) || /^6\.4(?:\.|$)/.test(codigo);

const ordenarContas = (a: ContaBalancete, b: ContaBalancete) =>
  a.conta.localeCompare(b.conta, undefined, { numeric: true });

function somarValoresDfcIndireto(valores: Array<number | null>): number | null {
  if (valores.some(valor => valor === null)) return null;
  return Math.round(valores.reduce<number>((total, valor) => total + Math.round((valor ?? 0) * 100), 0)) / 100;
}

export function calcularDfcIndireto(
  linhas: LinhaDemonstracao[],
  regras: RegraDfcIndireto[],
  periodos: Array<ContasBalancete | null>,
): ResultadoDfcIndireto {
  const valores = new Map<string, number | null>();
  const contasPorLinha = new Map<string, ContaBalancete[]>();
  const valoresContasPorLinha = new Map<string, Map<string, number | null>>();
  const codigos = [
    'RES',
    ...DFC_INDIRETO_AJUSTES.map(({ codigo }) => codigo),
    ...DFC_INDIRETO_VARIACOES.map(({ codigo }) => codigo),
    'resultado-ajustado',
    'variacoes-capital-giro',
    'dfc-operacional',
    'dfc-investimento',
    'dfc-financiamento',
    'dfc-total',
    'diferenca-operacional',
    'diferenca-total',
    ...linhas.filter(linha => linha.demonstracao === 'dfc').map(linha => linha.id),
  ];
  const disponivel = periodos.length > 0 && periodos.every(periodo => periodo !== null);
  if (!disponivel) {
    for (const codigo of codigos) valores.set(codigo, null);
    return { valores, contasPorLinha, valoresContasPorLinha, contasOperacionaisSemLinha: null };
  }

  const periodosValidos = periodos as ContasBalancete[];
  const linhasDiretas = linhas.filter(linha => linha.demonstracao === 'dfc');
  const calculosDiretos = calcularLinhas(linhasDiretas, 'dfc', periodos);
  const distribuicaoDireta = distribuirContasDfc(linhasDiretas, periodos);
  const incompletas = identificarContasIncompletas(periodos);
  const contasBalancete = new Map<string, ContaBalancete>();
  for (const periodo of periodosValidos) {
    for (const conta of Object.values(periodo)) {
      if (!incompletas.has(conta.conta)) contasBalancete.set(conta.conta, conta);
    }
  }
  const contasResultado = [...contasBalancete.values()].filter(conta => codigoDeResultado(conta.conta)).sort(ordenarContas);
  const linhasAjustes = new Map<string, ContaBalancete[]>();
  const linhasVariacoes = new Map<string, ContaBalancete[]>();
  for (const { codigo } of DFC_INDIRETO_AJUSTES) linhasAjustes.set(codigo, []);
  for (const { codigo } of DFC_INDIRETO_VARIACOES) linhasVariacoes.set(codigo, []);
  const regrasOrdenadas = [...regras].sort((a, b) => b.referencia.length - a.referencia.length);
  const encontrarRegra = (codigo: string) => regrasOrdenadas.find(regra =>
    codigo === regra.referencia || codigo.startsWith(`${regra.referencia}.`));
  const linhaEstaNaSecao = (linha: LinhaDemonstracao, secao: string) =>
    linhaPai(linha) === secao && !linha.foraDfc;

  for (const linha of linhasDiretas.filter(item => item.tipo === 'contas' && !item.foraDfc)) {
    const secaoPai = linhaPai(linha);
    const contasDaLinha = distribuicaoDireta.porLinha.get(linha.id) ?? [];
    if (secaoPai === 'dfc-operacional') {
      for (const conta of contasDaLinha) {
        if (!/^[12](?:\.|$)/.test(conta.conta)) continue;
        const regra = encontrarRegra(conta.conta);
        if (regra?.linha.startsWith('V')) linhasVariacoes.get(regra.linha)?.push(conta);
      }
    } else if (secaoPai === 'dfc-investimento' || secaoPai === 'dfc-financiamento') {
      for (const conta of contasDaLinha.filter(item => codigoDeResultado(item.conta))) {
        const regra = encontrarRegra(conta.conta);
        const codigo = regra?.linha.startsWith('AJ') && regra.linha !== 'AJ06' ? regra.linha : 'AJ06';
        linhasAjustes.get(codigo)?.push(conta);
      }
    }
  }

  const contasOperacionais = linhasDiretas
    .filter(linha => linha.tipo === 'contas' && linhaEstaNaSecao(linha, 'dfc-operacional'))
    .flatMap(linha => distribuicaoDireta.porLinha.get(linha.id) ?? [])
    .filter(conta => /^[12](?:\.|$)/.test(conta.conta));
  const linhasVariacoesMapeadas = new Set([...linhasVariacoes.values()].flat().map(conta => conta.conta));
  const contasOperacionaisSemLinha = contasOperacionais.filter(conta => !linhasVariacoesMapeadas.has(conta.conta)).length;

  const centavosMovimento = (conta: ContaBalancete) =>
    periodosValidos.reduce((total, periodo) => {
      const atual = periodo[conta.conta];
      return total + Math.round(((atual?.valCred ?? 0) - (atual?.valDeb ?? 0)) * 100);
    }, 0);
  const centavosVariacao = (conta: ContaBalancete) => {
    const primeiro = periodosValidos[0]![conta.conta]?.saldoAnt ?? 0;
    const ultimo = periodosValidos[periodosValidos.length - 1]![conta.conta]?.saldoAtual ?? 0;
    return -Math.round((ultimo - primeiro) * 100);
  };
  const guardarLinha = (codigo: string, contas: ContaBalancete[], calcularCentavos: (conta: ContaBalancete) => number) => {
    const contasOrdenadas = [...new Map(contas.map(conta => [conta.conta, conta])).values()].sort(ordenarContas);
    contasPorLinha.set(codigo, contasOrdenadas);
    const porConta = new Map(contasOrdenadas.map(conta => [conta.conta, calcularCentavos(conta) / 100]));
    valoresContasPorLinha.set(codigo, porConta);
    valores.set(codigo, Math.round([...porConta.values()].reduce((total, valor) => total + Math.round(valor * 100), 0)) / 100);
  };

  guardarLinha('RES', contasResultado, conta => centavosMovimento(conta));
  for (const { codigo } of DFC_INDIRETO_AJUSTES) {
    if (codigo === 'AJ06') continue;
    guardarLinha(codigo, linhasAjustes.get(codigo) ?? [], conta => -centavosMovimento(conta));
  }
  const contasAjusteManual = [...linhasAjustes.values()].flat();
  const idsAjustesMapeados = new Set(contasAjusteManual.map(conta => conta.conta));
  const contasAjusteResidual = linhasDiretas
    .filter(linha => linha.tipo === 'contas' && !linha.foraDfc
      && (linhaPai(linha) === 'dfc-investimento' || linhaPai(linha) === 'dfc-financiamento'))
    .flatMap(linha => distribuicaoDireta.porLinha.get(linha.id) ?? [])
    .filter(conta => codigoDeResultado(conta.conta) && !idsAjustesMapeados.has(conta.conta));
  guardarLinha('AJ06', contasAjusteResidual, conta => -centavosMovimento(conta));

  for (const { codigo } of DFC_INDIRETO_VARIACOES) {
    guardarLinha(codigo, linhasVariacoes.get(codigo) ?? [], conta => centavosVariacao(conta));
  }

  for (const linha of linhasDiretas) {
    valores.set(linha.id, calculosDiretos.get(linha.id) ?? null);
    if (linha.tipo === 'contas' && !linha.foraDfc) {
      const contas = distribuicaoDireta.porLinha.get(linha.id) ?? [];
      contasPorLinha.set(linha.id, contas);
      valoresContasPorLinha.set(linha.id, new Map(contas.map(conta => [
        conta.conta,
        calcularConta({ referencia: conta.conta, operacao: 1 }, 'dfc', periodos, incompletas),
      ])));
    }
  }

  const resultadoAjustado = somarValoresDfcIndireto([
    valores.get('RES') ?? null,
    ...DFC_INDIRETO_AJUSTES.map(({ codigo }) => valores.get(codigo) ?? null),
  ]);
  const variacoesCapitalGiro = somarValoresDfcIndireto(
    DFC_INDIRETO_VARIACOES.map(({ codigo }) => valores.get(codigo) ?? null),
  );
  const operacional = somarValoresDfcIndireto([resultadoAjustado, variacoesCapitalGiro]);
  const investimento = calculosDiretos.get('dfc-investimento') ?? null;
  const financiamento = calculosDiretos.get('dfc-financiamento') ?? null;
  const total = somarValoresDfcIndireto([operacional, investimento, financiamento]);
  const diretoOperacional = calculosDiretos.get('dfc-operacional') ?? null;
  const diretoTotal = somarValoresDfcIndireto([
    diretoOperacional,
    investimento,
    financiamento,
  ]);
  valores.set('resultado-ajustado', resultadoAjustado);
  valores.set('variacoes-capital-giro', variacoesCapitalGiro);
  valores.set('dfc-operacional', operacional);
  valores.set('dfc-investimento', investimento);
  valores.set('dfc-financiamento', financiamento);
  valores.set('dfc-total', total);
  valores.set('diferenca-operacional', diretoOperacional === null || operacional === null ? null : Math.round((operacional - diretoOperacional) * 100) / 100);
  valores.set('diferenca-total', diretoTotal === null || total === null ? null : Math.round((total - diretoTotal) * 100) / 100);
  return { valores, contasPorLinha, valoresContasPorLinha, contasOperacionaisSemLinha };
}

export function calcularSaldoPatrimonial(
  saldo: number,
  demonstracao: 'ativo' | 'passivo' | 'endividamento',
): number {
  return demonstracao === 'ativo' ? saldo : -saldo;
}

export function calcularConta(
  item: ItemDemonstracao,
  demonstracao: TipoDemonstracao,
  periodos: Array<ContasBalancete | null>,
  incompletas = identificarContasIncompletas(periodos),
  opcoes: { contasPorPrefixo?: boolean } = {},
): number | null {
  if (!periodos.length || periodos.some(periodo => periodo === null)
    || (!opcoes.contasPorPrefixo && incompletas.has(item.referencia))) return null;
  if (demonstracao === 'dfc') {
    const movimento = periodos.reduce((total, periodo) => {
      const conta = periodo?.[item.referencia];
      return total + (conta?.valCred ?? 0) - (conta?.valDeb ?? 0);
    }, 0);
    return Math.round(movimento * 100) / 100;
  }
  let valor = 0;
  for (const periodo of periodos) {
    if (opcoes.contasPorPrefixo) {
      for (const conta of Object.values(periodo ?? {})) {
        if (incompletas.has(conta.conta) || !(conta.conta === item.referencia || conta.conta.startsWith(`${item.referencia}.`))) continue;
        valor += conta.saldoAtual;
      }
    } else {
      const conta = periodo?.[item.referencia];
      if (!conta) continue;
      valor += demonstracao === 'dre' ? conta.valCred - conta.valDeb : conta.saldoAtual;
    }
  }
  if (demonstracao === 'dre') return Math.round(valor * 100) / 100;
  return Math.round(calcularSaldoPatrimonial(valor, demonstracao) * 100) / 100;
}

export function listarContasDaLinha(
  linha: LinhaDemonstracao,
  periodos: Array<ContasBalancete | null>,
): Array<{ item: ItemDemonstracao; conta: ContaBalancete }> {
  const incompletas = identificarContasIncompletas(periodos);
  const contas = new Map<string, { item: ItemDemonstracao; conta: ContaBalancete }>();
  for (const periodo of periodos) {
    for (const item of linha.itens) {
      const correspondentes = linha.contasPorPrefixo
        ? Object.values(periodo ?? {}).filter(conta => conta.conta === item.referencia
          || conta.conta.startsWith(`${item.referencia}.`))
        : [periodo?.[item.referencia]].filter((conta): conta is ContaBalancete => Boolean(conta));
      for (const conta of correspondentes) {
        if (!incompletas.has(conta.conta)) contas.set(conta.conta, { item, conta });
      }
    }
  }
  return [...contas.values()].sort((a, b) => a.conta.conta.localeCompare(b.conta.conta, 'pt-BR', { numeric: true }));
}

function calcularResultadoBalancete(periodos: Array<ContasBalancete | null>): number | null {
  if (!periodos.length || periodos.some(periodo => periodo === null)) return null;
  const incompletas = identificarContasIncompletas(periodos);
  const centavos = periodos.reduce((total, periodo) => total + Object.values(periodo ?? {})
    .filter(conta => ['3', '4', '5', '6'].includes(conta.conta.split('.')[0]) && !incompletas.has(conta.conta))
    .reduce((subtotal, conta) => subtotal + Math.round(conta.saldoAtual * 100), 0), 0);
  return -centavos / 100;
}

interface ContasDfcDistribuidas {
  porLinha: Map<string, ContaBalancete[]>;
  naoMapeadas: ContaBalancete[];
}

export function distribuirContasDfc(linhas: LinhaDemonstracao[], periodos: Array<ContasBalancete | null>): ContasDfcDistribuidas {
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

export interface SugestaoClassificacaoDfc {
  codigo: string;
  nome: string;
  contasSemelhantes: Array<{ conta: string; desc: string }>;
}

export interface ContaDfcPendente extends ContaNaoClassificada {
  statusDireto: string;
  statusIndireto: string;
  sugestaoDireta: SugestaoClassificacaoDfc | null;
  sugestaoIndireta: SugestaoClassificacaoDfc | null;
}

export function identificarContasDfcPendentes(
  linhas: LinhaDemonstracao[],
  regrasIndiretas: RegraDfcIndireto[],
  colunas: Array<Array<ContasBalancete | null>>,
): ContaDfcPendente[] {
  const periodos = colunas.flat();
  const incompletas = identificarContasIncompletas(periodos);
  const contas = new Map<string, ContaBalancete>();
  for (const periodo of periodos) {
    for (const conta of Object.values(periodo ?? {})) {
      if (!incompletas.has(conta.conta)) contas.set(conta.conta, conta);
    }
  }
  const distribuicao = distribuirContasDfc(linhas, periodos);
  const linhasPorId = new Map(linhas.map(linha => [linha.id, linha]));
  const linhaDiretaPorConta = new Map<string, LinhaDemonstracao>();
  for (const [linhaId, contasDaLinha] of distribuicao.porLinha) {
    const linha = linhasPorId.get(linhaId);
    if (linha) for (const conta of contasDaLinha) linhaDiretaPorConta.set(conta.conta, linha);
  }
  const raizDfc = (linha?: LinhaDemonstracao) => {
    let atual = linha;
    let foraDfc = false;
    while (atual) {
      foraDfc ||= Boolean(atual.foraDfc);
      const pai = linhaPai(atual);
      if (!pai) return { linha: atual, foraDfc };
      atual = linhasPorId.get(pai);
    }
    return { linha: undefined, foraDfc };
  };
  const nomeLinhaDireta = (linha: LinhaDemonstracao) => {
    const raiz = raizDfc(linha);
    const caminho = raiz.linha && raiz.linha.id !== linha.id ? `${linha.nome} — ${raiz.linha.nome}` : linha.nome;
    return raiz.foraDfc ? `${caminho} (Fora da DFC)` : caminho;
  };
  const regrasOrdenadas = [...regrasIndiretas].sort((a, b) => b.referencia.length - a.referencia.length);
  const encontrarRegraIndireta = (codigo: string) => regrasOrdenadas.find(regra =>
    codigo === regra.referencia || codigo.startsWith(`${regra.referencia}.`));
  const codigoBalance = (codigo: string) => /^[12](?:\.|$)/.test(codigo);
  const codigoResultadoIncluido = (codigo: string) => codigoDeResultado(codigo);
  const codigoResultado = (codigo: string) =>
    /^(?:3|4|5|6)(?:\.|$)/.test(codigo);
  const valoresDaConta = (codigo: string) => colunas.map(periodosDaColuna => {
    if (!periodosDaColuna.length || periodosDaColuna.some(periodo => periodo === null)) return null;
    const centavos = periodosDaColuna.reduce((total, periodo) => {
      const conta = periodo?.[codigo];
      return total + Math.round(((conta?.valCred ?? 0) - (conta?.valDeb ?? 0)) * 100);
    }, 0);
    return centavos / 100;
  });
  const temMovimento = (codigo: string) =>
    valoresDaConta(codigo).some(valor => valor !== null && valor !== 0);
  const pendencias = new Set(distribuicao.naoMapeadas
    .filter(conta => temMovimento(conta.conta))
    .map(conta => conta.conta));
  for (const linha of linhas.filter(item => item.demonstracao === 'dfc'
    && item.tipo === 'contas' && !item.foraDfc && raizDfc(item).linha?.id === 'dfc-operacional')) {
    for (const conta of distribuicao.porLinha.get(linha.id) ?? []) {
      if (!codigoBalance(conta.conta) || encontrarRegraIndireta(conta.conta)?.linha.startsWith('V')) continue;
      if (temMovimento(conta.conta)) pendencias.add(conta.conta);
    }
  }

  const sugerir = (
    codigo: string,
    candidatos: Array<{ referencia: string; codigo: string; nome: string; desc: string }>,
  ): SugestaoClassificacaoDfc | null => {
    const partes = codigo.split('.');
    const proximos = candidatos
      .filter(candidato => candidato.referencia !== codigo)
      .map(candidato => {
        const partesCandidato = candidato.referencia.split('.');
        let profundidade = 0;
        while (profundidade < partes.length && profundidade < partesCandidato.length
          && partes[profundidade] === partesCandidato[profundidade]) profundidade++;
        return { candidato, profundidade };
      });
    const maiorProfundidade = Math.max(0, ...proximos.map(item => item.profundidade));
    if (maiorProfundidade < 3) return null;
    const semelhantes = proximos.filter(item => item.profundidade === maiorProfundidade);
    const destinos = new Set(semelhantes.map(item => item.candidato.codigo));
    if (destinos.size !== 1 || (semelhantes.length < 2 && maiorProfundidade < 4)) return null;
    const primeiro = semelhantes[0]!.candidato;
    return {
      codigo: primeiro.codigo,
      nome: primeiro.nome,
      contasSemelhantes: semelhantes.slice(0, 3).map(({ candidato }) => ({
        conta: candidato.referencia,
        desc: candidato.desc,
      })),
    };
  };

  const candidatosDiretos = [...contas.values()].flatMap(conta => {
    const linha = linhaDiretaPorConta.get(conta.conta);
    return linha ? [{
      referencia: conta.conta,
      codigo: linha.id,
      nome: nomeLinhaDireta(linha),
      desc: conta.desc,
    }] : [];
  });
  const candidatosIndiretos = [...contas.values()].flatMap(conta => {
    const regra = encontrarRegraIndireta(conta.conta);
    const linhaDireta = linhaDiretaPorConta.get(conta.conta);
    const secaoDireta = raizDfc(linhaDireta).linha?.id;
    const elegivel = codigoBalance(conta.conta)
      ? secaoDireta === 'dfc-operacional' && regra?.linha.startsWith('V')
      : codigoResultadoIncluido(conta.conta)
        && (secaoDireta === 'dfc-investimento' || secaoDireta === 'dfc-financiamento')
        && regra?.linha.startsWith('AJ');
    const categoria = DFC_INDIRETO_CATEGORIAS_MAPEAVEIS.find(item => item.codigo === regra?.linha);
    return elegivel && regra && categoria ? [{
      referencia: conta.conta,
      codigo: regra.linha,
      nome: `${regra.linha} · ${categoria.nome}`,
      desc: conta.desc,
    }] : [];
  });
  const porCodigo = new Map([...contas.values()].map(conta => [conta.conta, conta]));

  return [...pendencias].flatMap(codigo => {
    const conta = porCodigo.get(codigo);
    if (!conta) return [];
    const linhaDireta = linhaDiretaPorConta.get(codigo);
    const raizDireta = raizDfc(linhaDireta);
    const sugestaoDireta = linhaDireta ? null : sugerir(codigo, candidatosDiretos);
    const linhaDiretaSugerida = sugestaoDireta ? linhasPorId.get(sugestaoDireta.codigo) : undefined;
    const secaoEfetiva = raizDireta.linha?.id ?? raizDfc(linhaDiretaSugerida).linha?.id;
    const regraIndireta = encontrarRegraIndireta(codigo);
    const isBalanco = codigoBalance(codigo);
    const isResultadoDfc = codigoResultadoIncluido(codigo);
    let statusIndireto: string;
    let sugestaoIndireta: SugestaoClassificacaoDfc | null = null;
    if (isBalanco) {
      if (secaoEfetiva === 'dfc-investimento' || secaoEfetiva === 'dfc-financiamento') {
        statusIndireto = 'Variação operacional não aplicável a esta classificação direta.';
      } else {
        const regraVariacao = regraIndireta?.linha.startsWith('V') ? regraIndireta : undefined;
        if (regraVariacao) {
          const categoria = DFC_INDIRETO_VARIACOES.find(item => item.codigo === regraVariacao.linha);
          statusIndireto = `${regraVariacao.linha} · ${categoria?.nome ?? 'Regra cadastrada'} (depende de classificação no Direto operacional)`;
        } else {
          statusIndireto = regraIndireta
            ? `Regra ${regraIndireta.linha} cadastrada, mas esta conta patrimonial precisa de uma linha V.`
            : 'Sem linha de variação do capital de giro.';
          sugestaoIndireta = sugerir(codigo, candidatosIndiretos.filter(item => item.codigo.startsWith('V')));
        }
      }
    } else if (isResultadoDfc) {
      if (secaoEfetiva === 'dfc-investimento' || secaoEfetiva === 'dfc-financiamento') {
        const regraAjuste = regraIndireta?.linha.startsWith('AJ') ? regraIndireta : undefined;
        if (regraAjuste) {
          const categoria = DFC_INDIRETO_AJUSTES.find(item => item.codigo === regraAjuste.linha);
          statusIndireto = `${regraAjuste.linha} · ${categoria?.nome ?? 'Ajuste cadastrado'}`;
        } else {
          statusIndireto = 'AJ06 · Ajuste residual automático.';
        }
        sugestaoIndireta = regraAjuste ? null : sugerir(codigo, candidatosIndiretos.filter(item => item.codigo.startsWith('AJ')));
      } else {
        statusIndireto = 'Incluída automaticamente em RES; ajustes dependem de classificação direta em Investimento ou Financiamento.';
      }
    } else if (codigoResultado(codigo)) {
      statusIndireto = 'Não entra automaticamente em RES; o método considera os grupos 3, 4, 5 e 6.4.';
    } else {
      statusIndireto = 'Sem tratamento automático no método indireto.';
    }
    return [{
      conta: conta.conta,
      desc: conta.desc,
      valores: valoresDaConta(conta.conta),
      statusDireto: linhaDireta ? nomeLinhaDireta(linhaDireta) : 'Sem classificação',
      statusIndireto,
      sugestaoDireta,
      sugestaoIndireta,
    }];
  }).sort((a, b) => a.conta.localeCompare(b.conta, undefined, { numeric: true }));
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
    if (linha.calculo === 'resultadoBalancete') {
      const valor = calcularResultadoBalancete(periodos);
      resultado.set(linha.id, valor);
      return valor;
    }
    let total = 0;
    let disponivel = periodos.length > 0 && periodos.every(periodo => periodo !== null);
    for (const item of linha.itens) {
      if (linha.tipo === 'total') {
        const origem = porId.get(item.referencia);
        const valor = origem ? calcular(origem) : null;
        if (valor === null || valor === undefined) disponivel = false;
        else total += Math.round(valor * 100);
      } else {
        const valor = calcularConta(item, demonstracao, periodos, incompletas, {
          contasPorPrefixo: linha.contasPorPrefixo,
        });
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
