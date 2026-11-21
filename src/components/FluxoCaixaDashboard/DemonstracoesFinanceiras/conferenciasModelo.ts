import {
  calcularDfcIndireto,
  calcularLinhas,
  calcularSaldoPatrimonial,
  calcularSaldosCaixaEquivalentes,
  distribuirContasDfc,
  identificarContasIncompletas,
  listarContasDaLinha,
  linhaPai,
  type CadastroDemonstracoes,
  type ContasBalancete,
  type LinhaDemonstracao,
  type ResultadoDfcIndireto,
} from './modelo';
import { PREFIXOS_COMPENSACAO, type ConferenciasConfig } from './conferenciasStorage';
import { LINHA_PL_ID, LINHA_RESULTADO_PERIODO_ID } from './modelo';
import { DFC_INDIRETO_AJUSTES, DFC_INDIRETO_VARIACOES } from './dfcMetodoIndireto';

export type EstadoConferencia = 'ok' | 'atencao' | 'erro' | 'informativo' | 'indisponivel';

export interface ContaConferencia {
  conta: string;
  descricao: string;
  saldoAnterior: number;
  debitos: number;
  creditos: number;
  saldoAtual: number;
  movimento: number;
  detalhe?: string;
  destaque?: boolean;
  efeitoDfc?: number;
}

export interface GrupoConferencia {
  nome: string;
  esperado: number | null;
  somaLinhas: number | null;
  diferenca: number | null;
  modoContas?: 'saldos' | 'movimentos';
  contas?: ContaConferencia[];
}

export interface ResultadoConferencia {
  id: string;
  titulo: string;
  estado: EstadoConferencia;
  resumo: string;
  contas?: ContaConferencia[];
  grupos?: GrupoConferencia[];
  observacoes?: string[];
  contasMesSeguinte?: ContaConferencia[];
  variacoesAtipicas?: AlteracaoAtipica[];
  movimentosPL?: Array<{ grupo: string; variacao: number; estado: string }>;
  conciliacoesDfc?: Array<{
    metodo: 'DFC Direta' | 'DFC Indireta';
    diferenca: number | null;
    efeitoSemLinha: number;
    naoExplicado: number | null;
  }>;
  arrendamentos?: {
    aumentoPassivoCentavos: number;
    variacaoDireitoUsoCentavos: number;
    fluxoDfcCentavos: number;
    contasPassivo: Array<ContasBalancete[string]>;
    contasDireitoUso: Array<ContasBalancete[string]>;
  };
}

export interface PeriodoComContas {
  ano: number;
  mes: number;
  contas: ContasBalancete | null;
}

export interface EntradaConferencias {
  ano: number;
  mes: number;
  atual: ContasBalancete | null;
  anterior: ContasBalancete | null;
  proximo: ContasBalancete | null;
  acumulado: Array<ContasBalancete | null>;
  mesesDoAno: PeriodoComContas[];
  mesesAnteriores: PeriodoComContas[];
  cadastro: CadastroDemonstracoes;
  config: ConferenciasConfig;
}

export interface AlteracaoAtipica {
  demonstracao: string;
  linha: string;
  valorMes: number;
  mediaAnterior: number;
  variacao: number;
  variacaoPercentual: number | null;
  contas: ContaConferencia[];
  motivo: string;
}

export interface ComparacaoContaSnapshot {
  conta: string;
  descricao: string;
  antes: ContasBalancete[string] | null;
  depois: ContasBalancete[string] | null;
}

const centavos = (valor: number) => Math.round(valor * 100);
const reais = (valorCentavos: number) => Math.round(valorCentavos) / 100;
const moedas = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatarMoeda = (valor: number | null | undefined) => valor === null || valor === undefined
  ? 'indisponível' : moedas.format(valor);
const prefixoDe = (conta: string, prefixo: string) => conta === prefixo || conta.startsWith(`${prefixo}.`);
const algumPrefixo = (conta: string, prefixos: string[]) => prefixos.some(prefixo => prefixoDe(conta, prefixo));
const movimentoConta = (conta: { valDeb: number; valCred: number }) => conta.valCred - conta.valDeb;
const normalizarTexto = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

function contasAnaliticas(periodo: ContasBalancete | null): Array<ContasBalancete[string]> {
  if (!periodo) return [];
  const incompletas = identificarContasIncompletas([periodo]);
  return Object.values(periodo).filter(conta => !incompletas.has(conta.conta));
}

function somarCampo(
  contas: Array<ContasBalancete[string]>,
  campo: 'saldoAnt' | 'saldoAtual' | 'valDeb' | 'valCred',
): number {
  return contas.reduce((total, conta) => total + centavos(conta[campo]), 0) / 100;
}

function somarSaldos(
  periodo: ContasBalancete | null,
  incluir: (conta: string) => boolean,
  excluir: (conta: string) => boolean = () => false,
): number | null {
  if (!periodo) return null;
  return contasAnaliticas(periodo)
    .filter(conta => incluir(conta.conta) && !excluir(conta.conta))
    .reduce((total, conta) => total + centavos(conta.saldoAtual), 0) / 100;
}

function somarMovimentos(
  periodos: Array<ContasBalancete | null>,
  incluir: (conta: string) => boolean,
): number | null {
  if (!periodos.length || periodos.some(periodo => !periodo)) return null;
  const centavosTotal = periodos.reduce((total, periodo) => total + contasAnaliticas(periodo)
    .filter(conta => incluir(conta.conta))
    .reduce((subtotal, conta) => subtotal + centavos(movimentoConta(conta)), 0), 0);
  return centavosTotal / 100;
}

function isGrupo(conta: string, grupo: string) {
  return conta === grupo || conta.startsWith(`${grupo}.`);
}

function totalRaizes(
  linhas: LinhaDemonstracao[],
  valores: Map<string, number | null>,
  excluirIds = new Set<string>(),
): number | null {
  const raizes = linhas.filter(linha => !linhaPai(linha) && !excluirIds.has(linha.id));
  const totalizadas = new Set(raizes.filter(linha => linha.tipo === 'total')
    .flatMap(linha => linha.itens.map(item => item.referencia)));
  const finais = raizes.filter(linha => !totalizadas.has(linha.id));
  if (!finais.length) return null;
  let total = 0;
  for (const linha of finais) {
    const valor = valores.get(linha.id);
    if (valor === null || valor === undefined) return null;
    total += centavos(valor);
  }
  return total / 100;
}

function linhaCorrespondente(linha: LinhaDemonstracao, conta: string) {
  if (linha.tipo !== 'contas' || linha.calculo) return [];
  return linha.itens.filter(item => linha.contasPorPrefixo
    ? prefixoDe(conta, item.referencia)
    : item.referencia === conta);
}

function valorContaNaLinha(
  linha: LinhaDemonstracao,
  conta: ContasBalancete[string],
): number {
  if (linha.demonstracao === 'dfc' || linha.demonstracao === 'dre') return reais(centavos(movimentoConta(conta)));
  return reais(centavos(calcularSaldoPatrimonial(conta.saldoAtual, linha.demonstracao)));
}

function valorLinhasPorGrupo(
  linhas: LinhaDemonstracao[],
  periodo: ContasBalancete | null,
  incluiConta: (codigo: string) => boolean,
  incluiLinha: (linha: LinhaDemonstracao) => boolean = () => true,
): number | null {
  if (!periodo) return null;
  const contas = contasAnaliticas(periodo).filter(conta => incluiConta(conta.conta));
  let total = 0;
  for (const conta of contas) {
    for (const linha of linhas) {
      if (!incluiLinha(linha) || linha.demonstracao === 'dfc' && linha.foraDfc) continue;
      if (linha.calculo === 'resultadoBalancete' && isGrupo(conta.conta, '3')
        || linha.calculo === 'resultadoBalancete' && isGrupo(conta.conta, '4')
        || linha.calculo === 'resultadoBalancete' && isGrupo(conta.conta, '5')
        || linha.calculo === 'resultadoBalancete' && isGrupo(conta.conta, '6')) {
        total -= centavos(conta.saldoAtual);
        continue;
      }
      total += linhaCorrespondente(linha, conta.conta).length * centavos(valorContaNaLinha(linha, conta));
    }
  }
  return total / 100;
}

function classificarContas(
  atual: ContasBalancete | null,
  cadastro: CadastroDemonstracoes,
  indireto: ResultadoDfcIndireto,
  diferencasDfc: { direta: number | null; indireta: number | null },
  toleranciaCentavos: number,
): {
  naoClassificadas: ContaConferencia[];
  duplicadas: ContaConferencia[];
  conciliacoesDfc: NonNullable<ResultadoConferencia['conciliacoesDfc']>;
} {
  const contas = contasAnaliticas(atual).filter(conta =>
    !algumPrefixo(conta.conta, PREFIXOS_COMPENSACAO)
    && (centavos(conta.saldoAtual) !== 0 || centavos(conta.valDeb) !== 0 || centavos(conta.valCred) !== 0));
  const demos = [
    { id: 'Ativo', codigo: 'ativo' as const, filtro: (conta: string) => isGrupo(conta, '1') },
    { id: 'Passivo + PL', codigo: 'passivo' as const, filtro: (conta: string) => isGrupo(conta, '2') },
    { id: 'DRE', codigo: 'dre' as const, filtro: (conta: string) => ['3', '4', '5', '6'].some(grupo => isGrupo(conta, grupo)) },
  ];
  const contasPorLinha = new Map(cadastro.linhas.filter(linha => linha.demonstracao !== 'dfc' && linha.tipo === 'contas' && !linha.calculo)
    .map(linha => [linha.id, new Set(listarContasDaLinha(linha, [atual]).map(item => item.conta.conta))]));
  const linhasDfc = cadastro.linhas.filter(linha => linha.demonstracao === 'dfc');
  const distribuicao = distribuirContasDfc(linhasDfc, [atual]);
  const diretas = new Set<string>();
  const indiretas = new Set<string>();
  const foraDfc = new Set<string>();
  for (const linha of linhasDfc.filter(linha => linha.tipo === 'contas')) {
    const codigos = (distribuicao.porLinha.get(linha.id) ?? []).map(conta => conta.conta);
    if (linha.foraDfc) codigos.forEach(codigo => foraDfc.add(codigo));
    else {
      codigos.forEach(codigo => diretas.add(codigo));
      if (['dfc-investimento', 'dfc-financiamento'].includes(linhaPai(linha) ?? linha.id)) {
        codigos.forEach(codigo => indiretas.add(codigo));
      }
    }
  }
  for (const codigo of ['RES', ...DFC_INDIRETO_AJUSTES.map(item => item.codigo), ...DFC_INDIRETO_VARIACOES.map(item => item.codigo)]) {
    (indireto.contasPorLinha.get(codigo) ?? []).forEach(conta => indiretas.add(conta.conta));
  }
  const naoClassificadas: ContaConferencia[] = [];
  const duplicadas: ContaConferencia[] = [];
  for (const conta of contas) {
    const movimento = centavos(conta.valDeb) !== 0 || centavos(conta.valCred) !== 0 ? 'com movimento' : 'sem movimento';
    for (const demo of demos) {
      if (!demo.filtro(conta.conta)) continue;
      const correspondencias = cadastro.linhas.filter(linha =>
        linha.demonstracao === demo.codigo && contasPorLinha.get(linha.id)?.has(conta.conta));
      if (correspondencias.length === 0) {
        naoClassificadas.push(montarConta(conta, `${demo.id} — ${movimento}`));
      } else if (correspondencias.length > 1) {
        duplicadas.push(montarConta(conta, `${demo.id}: ${correspondencias.map(item => item.nome).join('; ')}`));
      }
    }
    if (!/^[1-6](?:\.|$)/.test(conta.conta)
      || algumPrefixo(conta.conta, ['1.1.1', ...(cadastro.dfcContasCaixaEquivalentes ?? ['1.1.1'])])
      || foraDfc.has(conta.conta)) continue;
    for (const metodo of [
      { nome: 'DFC Direta', classificadas: diretas, diferenca: diferencasDfc.direta, efeito: -centavos(movimentoConta(conta)) },
      { nome: 'DFC Indireta', classificadas: indiretas, diferenca: diferencasDfc.indireta,
        efeito: /^[12](?:\.|$)/.test(conta.conta)
          ? centavos(conta.saldoAtual) - centavos(conta.saldoAnt) : -centavos(movimentoConta(conta)) },
    ]) {
      if (!metodo.classificadas.has(conta.conta)
        && (metodo.diferenca === null || Math.abs(centavos(metodo.diferenca)) > toleranciaCentavos)) {
        naoClassificadas.push({
          ...montarConta(conta, `${metodo.nome} — ${movimento}`),
          efeitoDfc: reais(metodo.efeito),
        });
      }
    }
  }
  const conciliacoesDfc = [
    { metodo: 'DFC Direta' as const, diferenca: diferencasDfc.direta },
    { metodo: 'DFC Indireta' as const, diferenca: diferencasDfc.indireta },
  ].map(item => {
    const efeitoCentavos = naoClassificadas.filter(conta => conta.detalhe?.startsWith(`${item.metodo} —`))
      .reduce((total, conta) => total + centavos(conta.efeitoDfc ?? 0), 0);
    return {
      ...item,
      efeitoSemLinha: reais(efeitoCentavos),
      naoExplicado: item.diferenca === null ? null : reais(centavos(item.diferenca) - efeitoCentavos),
    };
  });
  return { naoClassificadas, duplicadas, conciliacoesDfc };
}

function linhasAlvo(
  linhas: LinhaDemonstracao[],
  demo: 'dre' | 'ativo' | 'passivo' | 'dfc',
  periodos: Array<ContasBalancete | null>,
): Map<string, number | null> {
  return calcularLinhas(linhas, demo, periodos);
}

function contasDoGrupo(
  periodo: ContasBalancete | null,
  prefixos: string[],
  excluidos: string[] = [],
): Array<ContasBalancete[string]> {
  return contasAnaliticas(periodo).filter(conta => algumPrefixo(conta.conta, prefixos)
    && !algumPrefixo(conta.conta, excluidos));
}

function montarConta(conta: ContasBalancete[string], detalhe?: string): ContaConferencia {
  return {
    conta: conta.conta,
    descricao: conta.desc,
    saldoAnterior: conta.saldoAnt,
    debitos: conta.valDeb,
    creditos: conta.valCred,
    saldoAtual: conta.saldoAtual,
    movimento: reais(centavos(movimentoConta(conta))),
    detalhe,
  };
}

function montarContasDeMovimento(
  periodos: Array<ContasBalancete | null>,
  inclui: (codigo: string) => boolean,
): ContaConferencia[] {
  const porConta = new Map<string, { conta: ContasBalancete[string]; debitos: number; creditos: number; movimento: number }>();
  for (const periodo of periodos) {
    for (const conta of contasAnaliticas(periodo)) {
      if (!inclui(conta.conta)) continue;
      const acumulada = porConta.get(conta.conta) ?? { conta, debitos: 0, creditos: 0, movimento: 0 };
      acumulada.debitos += centavos(conta.valDeb);
      acumulada.creditos += centavos(conta.valCred);
      acumulada.movimento += centavos(movimentoConta(conta));
      porConta.set(conta.conta, acumulada);
    }
  }
  return [...porConta.values()].map(({ conta, debitos, creditos, movimento }) => ({
    conta: conta.conta,
    descricao: conta.desc,
    saldoAnterior: 0,
    debitos: reais(debitos),
    creditos: reais(creditos),
    saldoAtual: 0,
    movimento: reais(movimento),
  })).sort((a, b) => Math.abs(b.movimento) - Math.abs(a.movimento)).slice(0, 10);
}

function montarContasDeSaldo(
  periodo: ContasBalancete | null,
  inclui: (codigo: string) => boolean,
  exclui: (codigo: string) => boolean = () => false,
): ContaConferencia[] {
  return contasAnaliticas(periodo).filter(conta => inclui(conta.conta) && !exclui(conta.conta))
    .map(conta => montarConta(conta))
    .sort((a, b) => Math.abs(b.saldoAtual) - Math.abs(a.saldoAtual))
    .slice(0, 10);
}

function diferencasPorConta(
  atual: ContasBalancete | null,
  anterior: ContasBalancete | null,
  limiteCentavos: number,
  usarSaldoAtual: boolean,
): ContaConferencia[] {
  if (!atual || !anterior) return [];
  const codigos = new Set([...Object.keys(atual), ...Object.keys(anterior)]);
  const divergentes: ContaConferencia[] = [];
  for (const codigo of codigos) {
    const contaAtual = atual[codigo];
    const contaAnterior = anterior[codigo];
    const saldoAtual = contaAtual?.saldoAnt ?? 0;
    const saldoFechamentoAnterior = contaAnterior?.saldoAtual ?? 0;
    if (Math.abs(centavos(saldoAtual) - centavos(saldoFechamentoAnterior)) <= limiteCentavos) continue;
    divergentes.push({
      conta: codigo,
      descricao: contaAtual?.desc ?? contaAnterior?.desc ?? '',
      saldoAnterior: saldoAtual,
      debitos: contaAtual?.valDeb ?? 0,
      creditos: contaAtual?.valCred ?? 0,
      saldoAtual: saldoFechamentoAnterior,
      movimento: reais(centavos(saldoAtual) - centavos(saldoFechamentoAnterior)),
      detalhe: usarSaldoAtual ? 'Saldo anterior do mês seguinte difere do saldo reimportado.' : undefined,
    });
  }
  return divergentes.sort((a, b) => a.conta.localeCompare(b.conta, 'pt-BR', { numeric: true }));
}

function analisarBalancete(periodo: ContasBalancete | null, toleranciaCentavos: number) {
  if (!periodo) return null;
  const contas = contasAnaliticas(periodo);
  const debitos = somarCampo(contas, 'valDeb');
  const creditos = somarCampo(contas, 'valCred');
  const diferencaDebitosCreditos = reais(centavos(debitos) - centavos(creditos));
  const somaSaldos = somarCampo(contas, 'saldoAtual');
  return {
    debitos, creditos, diferencaDebitosCreditos, somaSaldos,
    fecha: Math.abs(centavos(diferencaDebitosCreditos)) <= toleranciaCentavos
      && Math.abs(centavos(somaSaldos)) <= toleranciaCentavos,
  };
}

function naturezaEsperada(conta: ContasBalancete[string], config: ConferenciasConfig): 'devedora' | 'credora' | null {
  if (algumPrefixo(conta.conta, PREFIXOS_COMPENSACAO)) return null;
  const excecao = [...config.naturezaExcecoes]
    .sort((a, b) => b.prefixo.length - a.prefixo.length)
    .find(item => prefixoDe(conta.conta, item.prefixo));
  const exclusao = [...config.prefixosExcluidosSinal]
    .sort((a, b) => b.length - a.length)
    .find(prefixo => prefixoDe(conta.conta, prefixo));
  if (exclusao && (!excecao || exclusao.length >= excecao.prefixo.length)) return null;
  let natureza = excecao?.natureza ?? config.naturezaPorGrupo[conta.conta.split('.')[0]] ?? null;
  if (!natureza) return null;
  if (!excecao && config.palavrasRedutoras.some(palavra => normalizarTexto(conta.desc).includes(normalizarTexto(palavra)))) {
    natureza = natureza === 'devedora' ? 'credora' : 'devedora';
  }
  return natureza;
}

function contaComSinalInvertido(conta: ContasBalancete[string], natureza: 'devedora' | 'credora') {
  return natureza === 'devedora' ? conta.saldoAtual < 0 : conta.saldoAtual > 0;
}

function conferirNatureza(
  atual: ContasBalancete | null,
  anterior: ContasBalancete | null,
  config: ConferenciasConfig,
) {
  if (!atual) return { divergentes: [], semNatureza: [], redutorasSugeridas: [] };
  const analiticas = contasAnaliticas(atual);
  const divergentes: ContaConferencia[] = [];
  const semNatureza: ContaConferencia[] = [];
  const redutorasSugeridas: ContaConferencia[] = [];
  const prefixosComNaturezaConfigurada = config.naturezaExcecoes.map(item => item.prefixo);
  for (const conta of analiticas) {
    const natureza = naturezaEsperada(conta, config);
    const saldoAnterior = anterior?.[conta.conta]?.saldoAtual ?? 0;
    if (!natureza) {
      if (!config.prefixosExcluidosSinal.some(prefixo => prefixoDe(conta.conta, prefixo))
        && conta.conta.startsWith('6.') && !['6.1', '6.2', '6.3', '6.5'].some(prefixo => prefixoDe(conta.conta, prefixo))) {
        semNatureza.push(montarConta(conta, 'Natureza a definir'));
      }
      continue;
    }
    if (centavos(conta.saldoAtual) !== 0
      && contaComSinalInvertido(conta, natureza)) {
      const destaque = Math.abs(centavos(conta.saldoAtual)) > config.limiteSinalCentavos;
      divergentes.push({
        ...montarConta(conta, `Esperada ${natureza}${destaque ? ' · Acima do limite de destaque' : ''}`),
        saldoAnterior,
        destaque,
      });
    }
    const correspondePalavraRedutora = config.palavrasRedutoras.some(palavra =>
      normalizarTexto(conta.desc).includes(normalizarTexto(palavra)));
    if (correspondePalavraRedutora && !prefixosComNaturezaConfigurada.some(prefixo => prefixoDe(conta.conta, prefixo))) {
      redutorasSugeridas.push(montarConta(conta, 'Sugestão de conta redutora'));
    }
  }
  return { divergentes, semNatureza, redutorasSugeridas };
}

function movimentoNoGrupo(periodo: ContasBalancete | null, prefixo: string) {
  const contas = contasDoGrupo(periodo, [prefixo]);
  return contas.reduce((total, conta) => total + centavos(movimentoConta(conta)), 0) / 100;
}

function conferirPatrimonioLiquido(
  atual: ContasBalancete | null,
  anterior: ContasBalancete | null,
  mes: number,
  balanceteFecha: boolean | null,
  balancoFecha: boolean | null,
  limiteCentavos: number,
): { alertas: ContaConferencia[]; movimentos: Array<{ grupo: string; variacao: number; estado: string }> } {
  if (!atual) return { alertas: [], movimentos: [] };
  const grupos = ['2.3.1', '2.3.2', '2.3.3'];
  const movimentos = grupos.map(grupo => ({
    grupo,
    variacao: movimentoNoGrupo(atual, grupo),
    estado: 'Informativo',
  })).filter(item => Math.abs(centavos(item.variacao)) > limiteCentavos);
  const zerados = contasAnaliticas(atual).filter(conta => ['3', '4', '5', '6'].some(grupo => isGrupo(conta.conta, grupo)))
    .every(conta => Math.abs(centavos(conta.saldoAtual)) <= 100);
  const saldoResultadoAnterior = somarSaldos(anterior, conta => ['3', '4', '5', '6'].some(grupo => isGrupo(conta, grupo)));
  const fechamento = mes === 12 || mes === 0;
  const pl233 = movimentoNoGrupo(atual, '2.3.3');
  const resultadoTransferido = fechamento && zerados && saldoResultadoAnterior !== null
    && Math.abs(centavos(pl233) - centavos(-saldoResultadoAnterior)) <= 100;
  const contas = contasDoGrupo(atual, grupos);
  const alertas = movimentos.flatMap(movimento => contas
    .filter(conta => prefixoDe(conta.conta, movimento.grupo)
      && Math.abs(centavos(movimentoConta(conta))) > 0)
    .map(conta => ({
      ...montarConta(conta, movimento.grupo === '2.3.3'
        ? resultadoTransferido ? 'Esperado: encerramento do resultado' : 'Atenção: revisar distribuição ou ajuste de exercícios'
        : 'Informativo: confirmar alteração contratual ou deliberação dos sócios'),
      detalhe: `Variação líquida do grupo ${movimento.grupo}: ${formatarMoeda(movimento.variacao)}`,
    })));
  const movimentosClassificados = movimentos.map(movimento => {
    if (balanceteFecha === false || balancoFecha === false) return { ...movimento, estado: 'Erro: movimento no PL sem contrapartida' };
    if (movimento.grupo === '2.3.3') {
      return { ...movimento, estado: resultadoTransferido ? 'Esperado: encerramento do resultado' : 'Atenção: revisar distribuição ou ajuste de exercícios' };
    }
    return movimento;
  });
  return { alertas, movimentos: movimentosClassificados };
}

function obterVariacoesCaixa(
  cadastro: CadastroDemonstracoes,
  atual: ContasBalancete | null,
  acumulado: Array<ContasBalancete | null>,
) {
  const prefixos = cadastro.dfcContasCaixaEquivalentes ?? ['1.1.1'];
  const caixas = calcularSaldosCaixaEquivalentes(prefixos, atual ? [atual] : []);
  const fluxoDiretoLinhas = calcularLinhas(cadastro.linhas, 'dfc', atual ? [atual] : []);
  const raizDireta = (id: string) => fluxoDiretoLinhas.get(id) ?? null;
  const fluxoDireto = ['dfc-operacional', 'dfc-investimento', 'dfc-financiamento']
    .map(raizDireta);
  const indireto = calcularDfcIndireto(cadastro.linhas, cadastro.dfcIndiretoRegras ?? [], atual ? [atual] : []);
  const fluxoIndireto = indireto.valores.get('dfc-total') ?? null;
  const diretoTotal = fluxoDireto.some(valor => valor === null)
    ? null
    : reais(fluxoDireto.reduce<number>((total, valor) => total + centavos(valor ?? 0), 0));
  const balancoCaixa = somarSaldos(atual, conta => algumPrefixo(conta, prefixos));
  const dreYtd = calcularLinhas(cadastro.linhas, 'dre', acumulado);
  const lucroDre = totalRaizes(cadastro.linhas.filter(linha => linha.demonstracao === 'dre'), dreYtd);
  const indiretoYtd = calcularDfcIndireto(cadastro.linhas, cadastro.dfcIndiretoRegras ?? [], acumulado);
  const diretoYtd = calcularLinhas(cadastro.linhas, 'dfc', acumulado);
  return {
    caixas,
    balancoCaixa,
    diretoTotal,
    indiretoTotal: fluxoIndireto,
    diretoOperacional: raizDireta('dfc-operacional'),
    indiretoOperacional: indireto.valores.get('dfc-operacional') ?? null,
    diretoOperacionalYtd: diretoYtd.get('dfc-operacional') ?? null,
    indiretoOperacionalYtd: indiretoYtd.valores.get('dfc-operacional') ?? null,
    lucroDre,
    indiretoYtd,
    indireto,
  };
}

function compararAcumuladoComMeses(
  cadastro: CadastroDemonstracoes,
  periodos: PeriodoComContas[],
  acumulado: Array<ContasBalancete | null>,
): { diferencas: Array<{ demonstracao: string; linha: string; valorAcumulado: number; somaMeses: number; diferenca: number }>; disponivel: boolean } {
  if (!periodos.length || periodos.some(periodo => !periodo.contas) || acumulado.some(periodo => !periodo)) {
    return { diferencas: [], disponivel: false };
  }
  const demos: Array<{ id: 'dre' | 'dfc'; nome: string }> = [
    { id: 'dre', nome: 'DRE' },
    { id: 'dfc', nome: 'DFC Direta' },
  ];
  const diferencas: Array<{ demonstracao: string; linha: string; valorAcumulado: number; somaMeses: number; diferenca: number }> = [];
  for (const demo of demos) {
    const linhaDemos = cadastro.linhas.filter(linha => linha.demonstracao === demo.id);
    const total = calcularLinhas(cadastro.linhas, demo.id, acumulado);
    const porMes = periodos.map(periodo => calcularLinhas(cadastro.linhas, demo.id, [periodo.contas]));
    for (const linha of linhaDemos) {
      const valorAcumulado = total.get(linha.id);
      const somaMeses = porMes.reduce((soma, mapa) => soma + centavos(mapa.get(linha.id) ?? 0), 0) / 100;
      if (valorAcumulado === null || valorAcumulado === undefined) continue;
      const diferenca = reais(centavos(valorAcumulado) - centavos(somaMeses));
      if (Math.abs(centavos(diferenca)) > 0) {
        diferencas.push({ demonstracao: demo.nome, linha: linha.nome, valorAcumulado, somaMeses, diferenca });
      }
    }
  }
  const todosMeses = periodos.length > 0 && periodos.every((periodo, index) => periodo.mes === index + 1);
  return { diferencas, disponivel: todosMeses };
}

function identificarContasNovas(atual: ContasBalancete | null, anterior: ContasBalancete | null) {
  if (!atual || !anterior) return [];
  const codigosAnteriores = new Set(contasAnaliticas(anterior).map(conta => conta.conta));
  return contasAnaliticas(atual).filter(conta => !codigosAnteriores.has(conta.conta)).map(conta => montarConta(conta));
}

function conferirGrupos(
  cadastro: CadastroDemonstracoes,
  atual: ContasBalancete | null,
  periodosDre: Array<ContasBalancete | null>,
) {
  if (!atual) return [];
  const linhasAtivo = cadastro.linhas.filter(linha => linha.demonstracao === 'ativo');
  const linhasPassivo = cadastro.linhas.filter(linha => linha.demonstracao === 'passivo');
  const valoresAtivo = calcularLinhas(cadastro.linhas, 'ativo', [atual]);
  const valoresPassivo = calcularLinhas(cadastro.linhas, 'passivo', [atual]);
  const valoresDre = calcularLinhas(cadastro.linhas, 'dre', periodosDre);
  const movimentosDre = somarMovimentos(periodosDre, conta => ['3', '4', '5', '6'].some(grupo => isGrupo(conta, grupo)));
  const resultadoPeriodo = valoresPassivo.get(LINHA_RESULTADO_PERIODO_ID) ?? null;
  const valorAtivo = totalRaizes(linhasAtivo, valoresAtivo);
  const valorPassivo = totalRaizes(linhasPassivo, valoresPassivo, new Set([LINHA_PL_ID]));
  const patrimonioLiquido = valoresPassivo.get(LINHA_PL_ID) ?? null;
  const valoresDfc = calcularLinhas(cadastro.linhas, 'dfc', [atual]);
  const gruposDfc = ['dfc-operacional', 'dfc-investimento', 'dfc-financiamento']
    .map(id => valoresDfc.get(id) ?? null);
  const totalDfc = gruposDfc.some(valor => valor === null)
    ? null
    : gruposDfc.reduce<number>((total, valor) => total + centavos(valor ?? 0), 0) / 100;
  const caixa = calcularSaldosCaixaEquivalentes(cadastro.dfcContasCaixaEquivalentes ?? ['1.1.1'], [atual]);
  const diferencaDfc = totalDfc === null || caixa.variacaoReal === null
    ? null
    : reais(centavos(totalDfc) - centavos(caixa.variacaoReal));
  const somaLinhaAtivo = valorAtivo;
  const ativoGrupo = somarSaldos(atual, conta => isGrupo(conta, '1'), conta => isGrupo(conta, '1.3') || isGrupo(conta, '1.9'));
  const ativoCirculante = somarSaldos(atual, conta => isGrupo(conta, '1.1'));
  const ativoNaoCirculante = somarSaldos(atual, conta => isGrupo(conta, '1.5'));
  const passivoCirculante = somarSaldos(atual, conta => isGrupo(conta, '2.1'));
  const passivoNaoCirculante = somarSaldos(atual, conta => isGrupo(conta, '2.2'));
  const plSemResultado = somarSaldos(atual, conta => isGrupo(conta, '2.3'));
  const saldoResultado = somarSaldos(atual, conta => ['3', '4', '5', '6'].some(grupo => isGrupo(conta, grupo)));
  const grupos: GrupoConferencia[] = [
    { nome: 'Ativo — grupo 1 (sem 1.3 e 1.9)', esperado: ativoGrupo, somaLinhas: somaLinhaAtivo, diferenca: ativoGrupo === null || somaLinhaAtivo === null ? null : reais(centavos(somaLinhaAtivo) - centavos(ativoGrupo)), contas: montarContasDeSaldo(atual, conta => isGrupo(conta, '1'), conta => isGrupo(conta, '1.3') || isGrupo(conta, '1.9')) },
    { nome: 'Ativo Circulante — 1.1', esperado: ativoCirculante, somaLinhas: valorLinhasPorGrupo(cadastro.linhas, atual, conta => isGrupo(conta, '1.1'), linha => linha.demonstracao === 'ativo'), diferenca: null, contas: montarContasDeSaldo(atual, conta => isGrupo(conta, '1.1')) },
    { nome: 'Ativo Não Circulante — 1.5', esperado: ativoNaoCirculante, somaLinhas: valorLinhasPorGrupo(cadastro.linhas, atual, conta => isGrupo(conta, '1.5'), linha => linha.demonstracao === 'ativo'), diferenca: null, contas: montarContasDeSaldo(atual, conta => isGrupo(conta, '1.5')) },
    { nome: 'Passivo Circulante — −2.1', esperado: passivoCirculante === null ? null : -passivoCirculante, somaLinhas: valorLinhasPorGrupo(cadastro.linhas, atual, conta => isGrupo(conta, '2.1'), linha => linha.demonstracao === 'passivo'), diferenca: null, contas: montarContasDeSaldo(atual, conta => isGrupo(conta, '2.1')) },
    { nome: 'Passivo Não Circulante — −2.2', esperado: passivoNaoCirculante === null ? null : -passivoNaoCirculante, somaLinhas: valorLinhasPorGrupo(cadastro.linhas, atual, conta => isGrupo(conta, '2.2'), linha => linha.demonstracao === 'passivo'), diferenca: null, contas: montarContasDeSaldo(atual, conta => isGrupo(conta, '2.2')) },
    { nome: 'PL sem resultado — −2.3', esperado: plSemResultado === null ? null : -plSemResultado, somaLinhas: valorLinhasPorGrupo(cadastro.linhas, atual, conta => isGrupo(conta, '2.3'), linha => linha.demonstracao === 'passivo'), diferenca: null, contas: montarContasDeSaldo(atual, conta => isGrupo(conta, '2.3')) },
    { nome: 'Resultado do período — −(3+4+5+6)', esperado: saldoResultado === null ? null : -saldoResultado, somaLinhas: resultadoPeriodo, diferenca: null, contas: montarContasDeSaldo(atual, conta => ['3', '4', '5', '6'].some(grupo => isGrupo(conta, grupo))) },
    { nome: 'DRE — lucro líquido vs grupos 3 a 6', esperado: movimentosDre, somaLinhas: totalRaizes(cadastro.linhas.filter(linha => linha.demonstracao === 'dre'), valoresDre), diferenca: null, modoContas: 'movimentos', contas: montarContasDeMovimento(periodosDre, conta => ['3', '4', '5', '6'].some(grupo => isGrupo(conta, grupo))) },
    { nome: 'DFC — seções − variação de caixa', esperado: caixa.variacaoReal, somaLinhas: totalDfc, diferenca: diferencaDfc, modoContas: 'movimentos', contas: montarContasDeMovimento([atual], conta => /^[1-6](?:\.|$)/.test(conta)) },
  ];
  for (const grupo of grupos) {
    if (grupo.diferenca === null && grupo.esperado !== null && grupo.somaLinhas !== null) {
      grupo.diferenca = reais(centavos(grupo.somaLinhas) - centavos(grupo.esperado));
    }
  }
  return grupos;
}

function verificarNaturezaGrupo6(
  atual: ContasBalancete | null,
  mes: number,
): ContaConferencia[] {
  if (!atual || mes === 0 || mes === 12) return [];
  return contasAnaliticas(atual)
    .filter(conta => ['6.1', '6.2', '6.3', '6.5'].some(prefixo => prefixoDe(conta.conta, prefixo))
      && Math.abs(centavos(conta.saldoAtual)) > 0)
    .map(conta => montarConta(conta, 'Atenção: conta de apuração com saldo durante o ano'));
}

function analisarArrendamentos(
  atual: ContasBalancete | null,
  cadastro: CadastroDemonstracoes,
  periodosParaSugestao: Array<ContasBalancete | null>,
  config: ConferenciasConfig,
) {
  if (!atual) return { contasPassivo: [], contasDireitoUso: [], candidatos: [], aumentoPassivoCentavos: 0, variacaoDireitoUsoCentavos: 0, fluxoDfcCentavos: 0 };
  const contasPassivo = contasDoGrupo(atual, config.prefixosPassivoArrendamento);
  const contasDireitoUso = contasDoGrupo(atual, config.prefixosAtivoDireitoUso);
  const aumentoPassivoCentavos = contasPassivo.reduce((total, conta) =>
    total + centavos(movimentoConta(conta)), 0);
  const variacaoDireitoUsoCentavos = contasDireitoUso.reduce((total, conta) =>
    total + centavos(conta.saldoAtual) - centavos(conta.saldoAnt), 0);
  const linhasDfc = cadastro.linhas.filter(linha => linha.demonstracao === 'dfc');
  const contasDfc = linhasDfc.filter(linha => linha.tipo === 'contas' && !linha.foraDfc)
    .flatMap(linha => linha.itens.flatMap(item => contasAnaliticas(atual)
      .filter(conta => (linha.contasPorPrefixo
        ? prefixoDe(conta.conta, item.referencia)
        : conta.conta === item.referencia)
        && algumPrefixo(conta.conta, config.prefixosPassivoArrendamento))
      .map(conta => centavos(movimentoConta(conta)) * item.operacao)));
  const fluxoDfcCentavos = contasDfc.reduce((total, movimento) => total + movimento, 0);
  const palavras = ['arrendamento', 'leasing', 'direito de uso', 'aluguéis a pagar', 'aluguéis'];
  const candidatos = [...new Map(periodosParaSugestao.flatMap(contasAnaliticas)
    .filter(conta => palavras.some(palavra => normalizarTexto(conta.desc).includes(normalizarTexto(palavra))))
    .filter(conta => !algumPrefixo(conta.conta, config.prefixosPassivoArrendamento)
      && !algumPrefixo(conta.conta, config.prefixosAtivoDireitoUso))
    .map(conta => [conta.conta, conta] as const)).values()].map(conta => montarConta(conta));
  return { contasPassivo, contasDireitoUso, candidatos, aumentoPassivoCentavos, variacaoDireitoUsoCentavos, fluxoDfcCentavos };
}

function ehLinhaCapitalGiro(
  linha: LinhaDemonstracao,
  linhas: LinhaDemonstracao[],
  config: ConferenciasConfig,
): boolean {
  const nomes = [linha.nome];
  const pai = linhas.find(item => item.id === linhaPai(linha));
  if (pai) nomes.push(pai.nome);
  const normalizados = nomes.map(nome => normalizarTexto(nome).trim().replace(/\s+/g, ' '));
  if (config.linhasCapitalGiro.some(nome => normalizados.includes(normalizarTexto(nome).trim().replace(/\s+/g, ' ')))) return true;
  if (linha.demonstracao !== 'ativo' && linha.demonstracao !== 'passivo') return false;
  if (normalizados.some(nome => /^(estoques?|contas? a receber|fornecedores?|contas? correntes?|adiantamentos (?:com|de|a) clientes?)\b/.test(nome))) return true;
  return normalizados.some(nome => /^(emprestimos(?: e financiamentos)?|financiamentos|floor plan)\b/.test(nome))
    && linha.itens.every(item => prefixoDe(item.referencia, '2.1'));
}

function analisarVariacoes(
  cadastro: CadastroDemonstracoes,
  atual: ContasBalancete | null,
  mesesAnteriores: PeriodoComContas[],
  config: ConferenciasConfig,
): AlteracaoAtipica[] {
  if (!atual || mesesAnteriores.filter(periodo => periodo.contas).length < 2) return [];
  const demos: Array<{ codigo: 'dre' | 'ativo' | 'passivo' | 'dfc'; nome: string }> = [
    { codigo: 'dre', nome: 'DRE' },
    { codigo: 'ativo', nome: 'Ativo' },
    { codigo: 'passivo', nome: 'Passivo + PL' },
    { codigo: 'dfc', nome: 'DFC Direta' },
  ];
  const alteracoes: AlteracaoAtipica[] = [];
  for (const demo of demos) {
    const linhas = cadastro.linhas.filter(linha => linha.demonstracao === demo.codigo);
    const distribuicaoDfc = demo.codigo === 'dfc' ? distribuirContasDfc(linhas, [atual]) : null;
    const valoresAtual = calcularLinhas(cadastro.linhas, demo.codigo, [atual]);
    const valoresAnteriores = mesesAnteriores.filter(periodo => periodo.contas);
    const valoresPorMes = valoresAnteriores.map(periodo => ({
      periodo,
      valores: calcularLinhas(cadastro.linhas, demo.codigo, [periodo.contas]),
    }));
    for (const linha of linhas) {
      if (linha.tipo !== 'contas' || linha.calculo || linha.foraDfc) continue;
      const valorMes = valoresAtual.get(linha.id);
      const anteriores = valoresPorMes.map(item => item.valores.get(linha.id))
        .filter((valor): valor is number => valor !== null && valor !== undefined);
      if (valorMes === null || valorMes === undefined || anteriores.length < 2) continue;
      const mediaAnterior = reais(anteriores.reduce((total, valor) => total + centavos(valor), 0) / anteriores.length);
      const variacao = reais(centavos(valorMes) - centavos(mediaAnterior));
      const variacaoCentavos = Math.abs(centavos(variacao));
      const mediaCentavos = Math.abs(centavos(mediaAnterior));
      const variacaoPercentual = mediaCentavos === 0 ? null : variacaoCentavos / mediaCentavos * 100;
      const linhaCapitalGiro = ehLinhaCapitalGiro(linha, linhas, config);
      const limiteCentavos = linhaCapitalGiro ? config.limiteCapitalGiroCentavos : config.limiteVariacaoCentavos;
      const ultrapassaSempre = !linhaCapitalGiro && variacaoCentavos > config.limiteVariacaoSempreCentavos;
      const ultrapassaNormal = variacaoCentavos > limiteCentavos
        && (variacaoPercentual === null ? !linhaCapitalGiro : variacaoPercentual > config.limiteVariacaoPercentual);
      const inverteSinal = mediaCentavos > 0 && Math.sign(valorMes) !== Math.sign(mediaAnterior)
        && (linhaCapitalGiro ? ultrapassaNormal : Math.abs(centavos(valorMes)) > config.limiteVariacaoCentavos);
      if (!ultrapassaSempre && !inverteSinal && !ultrapassaNormal) continue;

      const contasDaLinha = distribuicaoDfc
        ? distribuicaoDfc.porLinha.get(linha.id) ?? []
        : listarContasDaLinha(linha, [atual]).map(item => item.conta);
      const contribuicoes = contasDaLinha.map(conta => {
        const metricasAnteriores = valoresPorMes.map(({ periodo }) => {
          const item = periodo.contas?.[conta.conta];
          if (!item) return 0;
          return demo.codigo === 'ativo' || demo.codigo === 'passivo'
            ? centavos(calcularSaldoPatrimonial(item.saldoAtual, demo.codigo))
            : centavos(movimentoConta(item));
        });
        const valorAtualConta = demo.codigo === 'ativo' || demo.codigo === 'passivo'
          ? centavos(calcularSaldoPatrimonial(conta.saldoAtual, demo.codigo))
          : centavos(movimentoConta(conta));
        const mediaConta = metricasAnteriores.length
          ? metricasAnteriores.reduce((total, valor) => total + valor, 0) / metricasAnteriores.length
          : 0;
        const variacaoConta = valorAtualConta - mediaConta;
        return { conta, variacaoConta };
      }).sort((a, b) => Math.abs(b.variacaoConta) - Math.abs(a.variacaoConta))
        .slice(0, 5)
        .map(({ conta, variacaoConta }) => ({
          ...montarConta(conta),
          detalhe: `Contribuição à variação: ${formatarMoeda(reais(variacaoConta))}`,
        }));
      alteracoes.push({
        demonstracao: demo.nome,
        linha: linha.nome,
        valorMes,
        mediaAnterior,
        variacao,
        variacaoPercentual,
        contas: contribuicoes,
        motivo: ultrapassaSempre
          ? 'Variação superior ao limite absoluto.'
          : inverteSinal
            ? 'Inversão de sinal em relação à média.'
            : `Variação acima dos limites de ${config.limiteVariacaoPercentual}% e ${formatarMoeda(reais(limiteCentavos))}.`,
      });
    }
  }
  return alteracoes.sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao));
}

export function compararSnapshotsBalancete(
  anterior: ContasBalancete,
  atual: ContasBalancete,
  limiteCentavos = 100,
): ComparacaoContaSnapshot[] {
  const antigos = new Map(contasAnaliticas(anterior).map(conta => [conta.conta, conta]));
  const novos = new Map(contasAnaliticas(atual).map(conta => [conta.conta, conta]));
  const codigos = new Set([...antigos.keys(), ...novos.keys()]);
  return [...codigos].flatMap(codigo => {
    const antigo = antigos.get(codigo) ?? null;
    const novo = novos.get(codigo) ?? null;
    if (antigo && novo && (['saldoAnt', 'valDeb', 'valCred', 'saldoAtual'] as const)
      .every(campo => Math.abs(centavos(novo[campo]) - centavos(antigo[campo])) <= limiteCentavos)) return [];
    return [{
      conta: codigo,
      descricao: novo?.desc ?? antigo?.desc ?? '',
      antes: antigo,
      depois: novo,
    }];
  }).sort((a, b) => {
    const maiorAlteracao = (item: ComparacaoContaSnapshot) => {
      if (!item.antes || !item.depois) return Number.POSITIVE_INFINITY;
      return Math.max(...(['saldoAnt', 'valDeb', 'valCred', 'saldoAtual'] as const)
        .map(campo => Math.abs(centavos(item.depois?.[campo] ?? 0) - centavos(item.antes?.[campo] ?? 0))));
    };
    return maiorAlteracao(b) - maiorAlteracao(a);
  });
}

export function calcularDiferencaLinhasSnapshots(
  cadastro: CadastroDemonstracoes,
  anterior: ContasBalancete,
  atual: ContasBalancete,
  limiteCentavos = 100,
): Array<{ demonstracao: string; linha: string; antes: number | null; depois: number | null; diferenca: number }> {
  const demos: Array<{ codigo: 'dre' | 'ativo' | 'passivo' | 'dfc'; nome: string }> = [
    { codigo: 'dre', nome: 'DRE' },
    { codigo: 'ativo', nome: 'Ativo' },
    { codigo: 'passivo', nome: 'Passivo + PL' },
    { codigo: 'dfc', nome: 'DFC Direta' },
  ];
  const saida: Array<{ demonstracao: string; linha: string; antes: number | null; depois: number | null; diferenca: number }> = [];
  for (const demo of demos) {
    const linhas = cadastro.linhas.filter(linha => linha.demonstracao === demo.codigo);
    const valoresAntes = calcularLinhas(cadastro.linhas, demo.codigo, [anterior]);
    const valoresDepois = calcularLinhas(cadastro.linhas, demo.codigo, [atual]);
    for (const linha of linhas) {
      const antes = valoresAntes.get(linha.id) ?? null;
      const depois = valoresDepois.get(linha.id) ?? null;
      if (antes === null || depois === null) continue;
      const diferenca = reais(centavos(depois) - centavos(antes));
      if (Math.abs(centavos(diferenca)) <= limiteCentavos) continue;
      saida.push({ demonstracao: demo.nome, linha: linha.nome, antes, depois, diferenca });
    }
  }
  const dfcAntes = calcularDfcIndireto(cadastro.linhas, cadastro.dfcIndiretoRegras ?? [], [anterior]);
  const dfcDepois = calcularDfcIndireto(cadastro.linhas, cadastro.dfcIndiretoRegras ?? [], [atual]);
  const nomesDfcIndireto: Record<string, string> = {
    RES: 'Resultado líquido',
    ...Object.fromEntries(DFC_INDIRETO_AJUSTES.map(item => [item.codigo, item.nome])),
    ...Object.fromEntries(DFC_INDIRETO_VARIACOES.map(item => [item.codigo, item.nome])),
    'resultado-ajustado': 'Resultado ajustado',
    'variacoes-capital-giro': 'Variações de capital de giro',
    'dfc-operacional': 'Fluxo operacional',
    'dfc-investimento': 'Fluxo de investimento',
    'dfc-financiamento': 'Fluxo de financiamento',
    'dfc-total': 'Variação líquida da caixa',
    'diferenca-operacional': 'Diferença operacional',
    'diferenca-total': 'Diferença total',
  };
  const idsLinhasDiretas = new Set(cadastro.linhas.filter(linha => linha.demonstracao === 'dfc' && linha.tipo === 'contas').map(linha => linha.id));
  const idsDfcIndireto = new Set([...dfcAntes.valores.keys(), ...dfcDepois.valores.keys()]);
  for (const id of idsDfcIndireto) {
    if (!nomesDfcIndireto[id] || idsLinhasDiretas.has(id)) continue;
    const antes = dfcAntes.valores.get(id) ?? null;
    const depois = dfcDepois.valores.get(id) ?? null;
    if (antes === null || depois === null) continue;
    const diferenca = reais(centavos(depois) - centavos(antes));
    if (Math.abs(centavos(diferenca)) <= limiteCentavos) continue;
    saida.push({ demonstracao: 'DFC Indireta', linha: nomesDfcIndireto[id], antes, depois, diferenca });
  }
  return saida;
}

export function construirConferencias(entrada: EntradaConferencias): ResultadoConferencia[] {
  const { mes, atual, anterior, proximo, acumulado, mesesDoAno, mesesAnteriores, cadastro, config } = entrada;
  const resumo = analisarBalancete(atual, config.toleranciaConferenciaCentavos);
  const dadosBalanco = atual ? calcularLinhas(cadastro.linhas, 'ativo', [atual]) : new Map();
  const dadosPassivo = atual ? calcularLinhas(cadastro.linhas, 'passivo', [atual]) : new Map();
  const valorAtivo = atual ? totalRaizes(cadastro.linhas.filter(linha => linha.demonstracao === 'ativo'), dadosBalanco) : null;
  const valorPassivo = atual
    ? totalRaizes(cadastro.linhas.filter(linha => linha.demonstracao === 'passivo'), dadosPassivo, new Set([LINHA_PL_ID]))
    : null;
  const valorPl = dadosPassivo.get(LINHA_PL_ID) ?? null;
  const diferencaBalanco = valorAtivo === null || valorPassivo === null || valorPl === null
    ? null
    : reais(centavos(valorAtivo) - centavos(valorPassivo) - centavos(valorPl));
  const balancoFecha = diferencaBalanco === null
    ? null
    : Math.abs(centavos(diferencaBalanco)) <= config.toleranciaConferenciaCentavos;
  const resultadoPorDre = acumularDre(cadastro, acumulado);
  const resultadoPorGrupo = somarMovimentos(acumulado, conta => ['3', '4', '5', '6'].some(grupo => isGrupo(conta, grupo)));
  const diferencaResultado = resultadoPorDre.valor === null || resultadoPorGrupo === null
    ? null
    : reais(centavos(resultadoPorDre.valor) - centavos(resultadoPorGrupo));
  const variacoesCaixa = obterVariacoesCaixa(cadastro, atual, acumulado);
  const diferencaDfcDireta = variacoesCaixa.caixas.variacaoReal === null || variacoesCaixa.diretoTotal === null
    ? null
    : reais(centavos(variacoesCaixa.diretoTotal) - centavos(variacoesCaixa.caixas.variacaoReal));
  const diferencaDfcIndireta = variacoesCaixa.caixas.variacaoReal === null || variacoesCaixa.indiretoTotal === null
    ? null
    : reais(centavos(variacoesCaixa.indiretoTotal) - centavos(variacoesCaixa.caixas.variacaoReal));
  const diferencaCaixaBalanco = variacoesCaixa.balancoCaixa === null || variacoesCaixa.caixas.saldoFinal === null
    ? null
    : reais(centavos(variacoesCaixa.caixas.saldoFinal) - centavos(variacoesCaixa.balancoCaixa));
  const diferencaOperacionalMes = variacoesCaixa.diretoOperacional === null || variacoesCaixa.indiretoOperacional === null
    ? null
    : reais(centavos(variacoesCaixa.diretoOperacional) - centavos(variacoesCaixa.indiretoOperacional));
  const diferencaOperacionalAcumulada = variacoesCaixa.diretoOperacionalYtd === null || variacoesCaixa.indiretoOperacionalYtd === null
    ? null
    : reais(centavos(variacoesCaixa.diretoOperacionalYtd) - centavos(variacoesCaixa.indiretoOperacionalYtd));
  const saldoAnterior = diferencasPorConta(atual, anterior, config.toleranciaContinuidadeCentavos, false);
  const saldoSeguinte = diferencasPorConta(proximo, atual, config.toleranciaContinuidadeCentavos, true);
  const saldoBalancete = resumo ? Math.abs(centavos(resumo.diferencaDebitosCreditos)) <= config.toleranciaConferenciaCentavos
    && Math.abs(centavos(resumo.somaSaldos)) <= config.toleranciaConferenciaCentavos : false;
  const resultadoPL = conferirPatrimonioLiquido(atual, anterior, mes, saldoBalancete, balancoFecha, config.limiteMovimentoPlCentavos);
  const sinais = conferirNatureza(atual, anterior, config);
  const contasNovas = identificarContasNovas(atual, anterior);
  const contasNovasSemNatureza = contasNovas.filter(conta => {
    const registro = atual?.[conta.conta];
    if (!registro || algumPrefixo(conta.conta, PREFIXOS_COMPENSACAO) || naturezaEsperada(registro, config)
      || config.prefixosExcluidosSinal.some(prefixo => prefixoDe(conta.conta, prefixo))) return false;
    return !['6.1', '6.2', '6.3', '6.5'].some(prefixo => prefixoDe(conta.conta, prefixo));
  });
  const classes = classificarContas(atual, cadastro, variacoesCaixa.indireto, {
    direta: diferencaDfcDireta, indireta: diferencaDfcIndireta,
  }, config.toleranciaConferenciaCentavos);
  const classificacaoNaoExplicada = classes.conciliacoesDfc.some(item =>
    item.naoExplicado !== null && Math.abs(centavos(item.naoExplicado)) > config.toleranciaConferenciaCentavos);
  const grupos = conferirGrupos(cadastro, atual, acumulado);
  const variacoesAtipicas = analisarVariacoes(cadastro, atual, mesesAnteriores, config);
  const movimentos6 = verificarNaturezaGrupo6(atual, mes);
  const arrendamentos = analisarArrendamentos(atual, cadastro, [
    atual, anterior, proximo, ...mesesDoAno.map(periodo => periodo.contas), ...mesesAnteriores.map(periodo => periodo.contas),
  ], config);
  const plErro = resultadoPL.movimentos.some(item => item.estado.startsWith('Erro'));
  const aumentoArrendamentoSemCaixa = arrendamentos.aumentoPassivoCentavos > config.limiteArrendamentoCentavos
    && arrendamentos.fluxoDfcCentavos >= 0;
  const arrendamentoSemAtivo = aumentoArrendamentoSemCaixa && arrendamentos.variacaoDireitoUsoCentavos <= 0;
  const mesesDoAcumulado = mes === 0 ? mesesDoAno : mesesDoAno.filter(periodo => periodo.mes <= mes);
  const acumuladoMensal = compararAcumuladoComMeses(cadastro, mesesDoAcumulado, acumulado);
  const gruposErrados = grupos.filter(grupo => grupo.diferenca !== null
    && Math.abs(centavos(grupo.diferenca)) > config.toleranciaConferenciaCentavos);
  const estadoGrupo = gruposErrados.length ? 'erro' : grupos.some(grupo => grupo.diferenca === null) ? 'indisponivel' : 'ok';
  const contaUsadaNoDre = resultadoPorDre.contaLucro;
  const sinalEstado: EstadoConferencia = sinais.divergentes.length ? 'atencao'
    : sinais.semNatureza.length ? 'informativo' : atual ? 'ok' : 'indisponivel';
  const estadoPL: EstadoConferencia = plErro ? 'erro'
    : resultadoPL.movimentos.some(item => item.estado.startsWith('Atenção')) ? 'atencao'
      : resultadoPL.movimentos.length ? 'informativo' : atual ? 'ok' : 'indisponivel';
  const estadoArrendamento: EstadoConferencia = arrendamentoSemAtivo ? 'erro'
    : aumentoArrendamentoSemCaixa ? 'atencao'
      : arrendamentos.candidatos.length ? 'informativo' : atual ? 'ok' : 'indisponivel';
  const temBaseAtipica = mesesAnteriores.filter(periodo => periodo.contas !== null).length >= 2;
  const estadoAtypical: EstadoConferencia = variacoesAtipicas.length ? 'atencao' : temBaseAtipica ? 'ok' : 'indisponivel';

  return [
    {
      id: 'fechamento-balancete',
      titulo: '1. Balancete fecha',
      estado: resumo ? resumo.fecha ? 'ok' : 'erro' : 'indisponivel',
      resumo: resumo
        ? `Débitos ${formatarMoeda(resumo.debitos)}; créditos ${formatarMoeda(resumo.creditos)}; diferença ${formatarMoeda(resumo.diferencaDebitosCreditos)}; soma dos saldos ${formatarMoeda(resumo.somaSaldos)}.`
        : 'Balancete não disponível para o período.',
    },
    {
      id: 'continuidade-saldos',
      titulo: '2. Continuidade dos saldos anteriores',
      estado: atual && anterior ? saldoAnterior.length ? 'erro' : 'ok' : 'indisponivel',
      resumo: atual && anterior ? `${saldoAnterior.length} contas divergem do saldo atual do mês anterior.` : 'O balancete do mês anterior não está disponível.',
      contas: saldoAnterior,
      contasMesSeguinte: saldoSeguinte,
      observacoes: proximo ? [`Após esta importação, ${saldoSeguinte.length} contas do mês seguinte ficam com saldo anterior divergente.`] : [],
    },
    {
      id: 'reimportacao',
      titulo: '3. Alterações em versões importadas',
      estado: 'informativo',
      resumo: 'Consulte o histórico para comparar com a importação anterior e a versão marcada como emitida.',
    },
    {
      id: 'fechamento-balanco',
      titulo: '4. Ativo − (Passivo + PL)',
      estado: diferencaBalanco === null ? 'indisponivel'
        : Math.abs(centavos(diferencaBalanco)) <= config.toleranciaConferenciaCentavos ? 'ok' : 'erro',
      resumo: diferencaBalanco === null ? 'Não foi possível calcular o balanço.' : `Diferença: ${formatarMoeda(diferencaBalanco)}.`,
    },
    {
      id: 'resultado-dre',
      titulo: '5. Lucro líquido da DRE = grupos 3 a 6',
      estado: !resultadoPorDre.contaLucro ? 'atencao' : diferencaResultado === null ? 'indisponivel'
        : Math.abs(centavos(diferencaResultado)) <= config.toleranciaConferenciaCentavos ? 'ok' : 'erro',
      resumo: diferencaResultado === null
        ? `Não foi possível calcular a conferência${contaUsadaNoDre ? '' : ': verifique a linha Lucro Líquido do Exercício na DRE'}.`
        : !resultadoPorDre.contaLucro
          ? 'Cadastre a linha principal Lucro Líquido do Exercício para validar a conferência.'
        : `DRE ${formatarMoeda(resultadoPorDre.valor)}; grupos 3 a 6 ${formatarMoeda(resultadoPorGrupo)}; diferença ${formatarMoeda(diferencaResultado)}.`,
    },
    {
      id: 'caixa-dfc',
      titulo: '6. DFC, variação real e caixa do balanço',
      estado: [diferencaDfcDireta, diferencaDfcIndireta, diferencaCaixaBalanco].some(valor => valor !== null
        && Math.abs(centavos(valor)) > config.toleranciaConferenciaCentavos) ? 'erro'
        : diferencaDfcDireta === null || diferencaDfcIndireta === null || diferencaCaixaBalanco === null ? 'indisponivel' : 'ok',
      resumo: `DFC Direta − caixa: ${formatarMoeda(diferencaDfcDireta)}; DFC Indireta − caixa: ${formatarMoeda(diferencaDfcIndireta)}; Caixa DFC − caixa do balanço: ${formatarMoeda(diferencaCaixaBalanco)}.`,
    },
    {
      id: 'direto-indireto',
      titulo: '7. Caixa operacional Direto = Indireto',
      estado: [diferencaOperacionalMes, diferencaOperacionalAcumulada].some(valor => valor !== null
        && Math.abs(centavos(valor)) > config.toleranciaConferenciaCentavos) ? 'erro'
        : diferencaOperacionalMes === null || diferencaOperacionalAcumulada === null ? 'indisponivel' : 'ok',
      resumo: `Mês: ${formatarMoeda(diferencaOperacionalMes)}; acumulado: ${formatarMoeda(diferencaOperacionalAcumulada)}.`,
    },
    {
      id: 'acumulado-mensal',
      titulo: '8. Acumulado = soma dos meses',
      estado: !acumuladoMensal.disponivel ? 'indisponivel' : acumuladoMensal.diferencas.length ? 'erro' : 'ok',
      resumo: !acumuladoMensal.disponivel
        ? 'São necessários os 12 balancetes mensais para validar as linhas acumuladas.'
        : acumuladoMensal.diferencas.length
          ? `${acumuladoMensal.diferencas.length} linhas de DRE/DFC diferem da soma dos meses.`
          : 'As linhas de movimento da DRE e DFC acumulam corretamente; balanço continua sendo posição na data.',
      contas: [],
    },
    {
      id: 'classificacao',
      titulo: '9. Contas sem classificação ou duplicadas',
      estado: classes.duplicadas.length || classificacaoNaoExplicada ? 'erro'
        : classes.naoClassificadas.length ? 'atencao'
          : !atual || classes.conciliacoesDfc.some(item => item.diferenca === null) ? 'indisponivel' : 'ok',
      resumo: `${classes.naoClassificadas.length} contas sem linha; ${classes.duplicadas.length} contas em mais de uma linha.${classificacaoNaoExplicada ? ' Há diferença de caixa não explicada pelas contas sem linha.' : ''}`,
      contas: [...classes.naoClassificadas, ...classes.duplicadas],
      conciliacoesDfc: classes.conciliacoesDfc,
      observacoes: [
        'Somente contas analíticas com saldo atual ou débitos/créditos. Compensações são excluídas; contas de balanço não são exigidas na DRE e contas de resultado entram no Resultado do Período do balanço.',
        'A DFC reutiliza a classificação das demonstrações. Quando a diferença do método no item 6 está dentro da tolerância, sua lista fica vazia. Caixa e contas cadastradas fora da DFC não são exigidos.',
        'Efeito na diferença = parcela da diferença do item 6 atribuível à conta sem linha. Valores não explicados exigem revisar o balancete, os saldos de caixa e a classificação, sem atribuição artificial a contas.',
      ],
    },
    {
      id: 'contas-novas',
      titulo: '10. Contas novas no plano',
      estado: contasNovas.length ? 'informativo' : atual && anterior ? 'ok' : 'indisponivel',
      resumo: contasNovas.length ? `${contasNovas.length} contas analíticas novas em relação ao mês anterior.` : 'Nenhuma conta analítica nova.',
      contas: contasNovas,
    },
    {
      id: 'soma-linhas-grupos',
      titulo: '11. Soma das linhas = total dos grupos',
      estado: estadoGrupo,
      resumo: gruposErrados.length
        ? `${gruposErrados.length} grupos apresentam diferença superior à tolerância de ${formatarMoeda(reais(config.toleranciaConferenciaCentavos))}.`
        : 'Os grupos e as linhas conferem dentro da tolerância configurada.',
      grupos,
    },
    {
      id: 'alertas',
      titulo: '12. Alertas de sinal, PL, variação e arrendamento',
      estado: sinais.divergentes.length || movimentos6.length || variacoesAtipicas.length
        || contasNovasSemNatureza.length || aumentoArrendamentoSemCaixa
        ? plErro || arrendamentoSemAtivo ? 'erro' : 'atencao'
        : sinais.semNatureza.length || sinais.redutorasSugeridas.length || arrendamentos.candidatos.length || resultadoPL.movimentos.length
          ? 'informativo' : atual ? 'ok' : 'indisponivel',
      resumo: `${sinais.divergentes.length} saldos com sinal invertido; ${sinais.semNatureza.length} contas do grupo 6 com natureza a definir; ${contasNovasSemNatureza.length} contas novas sem natureza definida; ${resultadoPL.movimentos.length} grupos de PL com variação; ${variacoesAtipicas.length} linhas com variação atípica; ${aumentoArrendamentoSemCaixa ? 'aumento de arrendamento sem saída de caixa' : 'sem aumento atípico de arrendamento'}${temBaseAtipica ? '' : '; série histórica insuficiente para variações atípicas'}.`,
      contas: [
        ...sinais.divergentes,
        ...sinais.semNatureza,
        ...sinais.redutorasSugeridas,
        ...movimentos6,
        ...resultadoPL.alertas,
      ],
      grupos: grupos.filter(grupo => grupo.nome.includes('PL')),
      variacoesAtipicas,
      movimentosPL: resultadoPL.movimentos,
      arrendamentos: {
        aumentoPassivoCentavos: arrendamentos.aumentoPassivoCentavos,
        variacaoDireitoUsoCentavos: arrendamentos.variacaoDireitoUsoCentavos,
        fluxoDfcCentavos: arrendamentos.fluxoDfcCentavos,
        contasPassivo: arrendamentos.contasPassivo,
        contasDireitoUso: arrendamentos.contasDireitoUso,
      },
      observacoes: [
        `Todos os saldos não zero contrários à natureza esperada são listados. ${sinais.divergentes.filter(conta => conta.destaque).length} acima do limite de destaque de ${formatarMoeda(reais(config.limiteSinalCentavos))}.`,
        ...resultadoPL.movimentos.map(item => `${item.estado}: ${item.grupo}, variação líquida ${formatarMoeda(item.variacao)}.`),
        ...variacoesAtipicas.map(item => `${item.demonstracao} · ${item.linha}: ${item.motivo}`),
        ...arrendamentos.candidatos.map(conta => `Possível conta de arrendamento para revisar: ${conta.conta} — ${conta.descricao}.`),
        ...(aumentoArrendamentoSemCaixa ? [`Créditos em passivos de arrendamento: ${formatarMoeda(reais(arrendamentos.aumentoPassivoCentavos))}; variação DFC direta das contas: ${formatarMoeda(reais(arrendamentos.fluxoDfcCentavos))}.`] : []),
        ...(arrendamentoSemAtivo ? [`Contrato sem ativo correspondente: variação líquida de direito de uso ${formatarMoeda(reais(arrendamentos.variacaoDireitoUsoCentavos))}.`] : []),
        ...arrendamentos.contasDireitoUso.map(conta => `Direito de uso ${conta.conta} — ${conta.desc}: saldo anterior ${formatarMoeda(conta.saldoAnt)}, débito ${formatarMoeda(conta.valDeb)}, crédito ${formatarMoeda(conta.valCred)}, saldo atual ${formatarMoeda(conta.saldoAtual)}.`),
        ...variacoesAtipicas.map(item => `Variação ${item.demonstracao} · ${item.linha}: mês ${formatarMoeda(item.valorMes)}, média ${formatarMoeda(item.mediaAnterior)}, diferença ${formatarMoeda(item.variacao)}, percentual ${item.variacaoPercentual?.toFixed(1) ?? 'n/a'}%.`),
      ],
    },
  ];
}

function acumularDre(cadastro: CadastroDemonstracoes, periodos: Array<ContasBalancete | null>) {
  if (!periodos.length || periodos.some(periodo => !periodo)) return { valor: null, contaLucro: false };
  const linhas = cadastro.linhas.filter(linha => linha.demonstracao === 'dre');
  const valores = calcularLinhas(cadastro.linhas, 'dre', periodos);
  const norm = (texto: string) => normalizarTexto(texto).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const linhaLucro = linhas.find(linha => !linhaPai(linha) && [
    'lucro liquido do exercicio',
    'lucro liquido do exercício',
  ].includes(norm(linha.nome)));
  const valorLinha = linhaLucro ? valores.get(linhaLucro.id) : null;
  return { valor: valorLinha ?? totalRaizes(linhas, valores), contaLucro: Boolean(linhaLucro) };
}
