import {
  calcularDfcIndireto,
  calcularLinhas,
  calcularSaldosCaixaEquivalentes,
  identificarContasIncompletas,
  linhaPai,
  type CadastroDemonstracoes,
  type ContasBalancete,
  type LinhaDemonstracao,
} from './modelo';
import type { ConferenciasConfig } from './conferenciasStorage';
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
const reais = (valor: number) => centavos(valor) / 100;
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
  operacao: 1 | -1,
): number {
  if (linha.demonstracao === 'dfc' || linha.demonstracao === 'dre') return reais(movimentoConta(conta));
  if (linha.contasPorPrefixo) {
    return reais((linha.saldoInvertido ? -centavos(conta.saldoAtual) : centavos(Math.abs(conta.saldoAtual))) * operacao / 100);
  }
  return reais((linha.saldoInvertido ? centavos(conta.saldoAtual) : centavos(Math.abs(conta.saldoAtual))) * operacao / 100);
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
      for (const item of linhaCorrespondente(linha, conta.conta)) {
        total += centavos(valorContaNaLinha(linha, conta, item.operacao));
      }
    }
  }
  return total / 100;
}

function contaEmDemonstracao(
  linhas: LinhaDemonstracao[],
  demonstracao: 'dre' | 'ativo' | 'passivo' | 'dfc',
  conta: string,
): Array<{ linha: LinhaDemonstracao; descricao: string }> {
  const correspondencias = linhas.filter(linha => linha.demonstracao === demonstracao && linha.tipo === 'contas')
    .flatMap(linha => linhaCorrespondente(linha, conta).map(() => ({ linha, descricao: linha.nome })));
  if (demonstracao === 'passivo' && ['3', '4', '5', '6'].some(grupo => isGrupo(conta, grupo))
    && !correspondencias.some(item => item.linha.calculo === 'resultadoBalancete')) {
    const resultado = linhas.find(linha => linha.id === LINHA_RESULTADO_PERIODO_ID);
    if (resultado) correspondencias.push({ linha: resultado, descricao: resultado.nome });
  }
  return correspondencias;
}

function contaEmDfcIndireto(
  cadastro: CadastroDemonstracoes,
  conta: ContasBalancete[string],
): Array<{ descricao: string }> {
  const linhas = cadastro.linhas.filter(linha => linha.demonstracao === 'dfc');
  const diretas = contaEmDemonstracao(linhas, 'dfc', conta.conta);
  const linhaDireta = diretas.find(item => !item.linha.foraDfc)?.linha;
  const raizDireta = linhaDireta ? linhas.find(linha => linha.id === (linhaPai(linhaDireta) ?? linhaDireta.id)) : undefined;
  const codigo = conta.conta;
  const resultado = /^(?:3|4|5)(?:\.|$)/.test(codigo) || /^6\.4(?:\.|$)/.test(codigo);
  if (resultado) return [{ descricao: 'RES — Resultado do período' }];
  if (diretas.some(item => item.linha.foraDfc)) return [{ descricao: 'Fora da DFC' }];
  const regras = [...(cadastro.dfcIndiretoRegras ?? [])].sort((a, b) => b.referencia.length - a.referencia.length);
  const regrasCorrespondentes = regras.filter(regra => prefixoDe(codigo, regra.referencia));
  const regra = regrasCorrespondentes[0];
  if (/^[12](?:\.|$)/.test(codigo)) {
    if (raizDireta?.id !== 'dfc-operacional') {
      return linhaDireta ? [{ descricao: `${linhaDireta.nome} — ${raizDireta?.nome ?? 'DFC indireta'}` }] : [];
    }
    return regra?.linha.startsWith('V') ? [{ descricao: `${regra.linha} — Variação patrimonial` }] : [];
  }
  if (linhaDireta && ['dfc-investimento', 'dfc-financiamento'].includes(raizDireta?.id ?? '')) {
    if (regrasCorrespondentes.filter(item => item.linha.startsWith('AJ')).length > 1) {
      return regrasCorrespondentes.filter(item => item.linha.startsWith('AJ')).map(item => ({ descricao: `${item.linha} — Ajuste indireto` }));
    }
    return [{ descricao: regra?.linha.startsWith('AJ') ? `${regra.linha} — Ajuste indireto` : 'AJ06 — Ajuste residual automático' }];
  }
  return [];
}

function classificarContas(
  atual: ContasBalancete | null,
  cadastro: CadastroDemonstracoes,
): { naoClassificadas: ContaConferencia[]; duplicadas: ContaConferencia[] } {
  if (!atual) return { naoClassificadas: [], duplicadas: [] };
  const contas = contasAnaliticas(atual);
  const demos = [
    { id: 'Ativo', codigo: 'ativo' as const, filtro: (conta: string) => isGrupo(conta, '1') },
    { id: 'Passivo + PL', codigo: 'passivo' as const, filtro: (conta: string) => isGrupo(conta, '2') || ['3', '4', '5', '6'].some(grupo => isGrupo(conta, grupo)) },
    { id: 'DRE', codigo: 'dre' as const, filtro: (conta: string) => ['3', '4', '5', '6'].some(grupo => isGrupo(conta, grupo)) },
    { id: 'DFC Direta', codigo: 'dfc' as const, filtro: (conta: string) => /^[1-6](?:\.|$)/.test(conta) },
  ];
  const naoClassificadas: ContaConferencia[] = [];
  const duplicadas: ContaConferencia[] = [];
  for (const conta of contas) {
    for (const demo of demos) {
      if (!demo.filtro(conta.conta)) continue;
      const correspondencias = contaEmDemonstracao(cadastro.linhas, demo.codigo, conta.conta);
      if (correspondencias.length === 0) {
        naoClassificadas.push({
          conta: conta.conta, descricao: conta.desc, saldoAnterior: conta.saldoAnt,
          debitos: conta.valDeb, creditos: conta.valCred, saldoAtual: conta.saldoAtual,
          movimento: movimentoConta(conta), detalhe: `${demo.id} — ${Math.abs(conta.valDeb) + Math.abs(conta.valCred) === 0 ? 'sem movimento' : 'com movimento'}`,
        });
      } else if (correspondencias.length > 1) {
        duplicadas.push({
          conta: conta.conta, descricao: conta.desc, saldoAnterior: conta.saldoAnt,
          debitos: conta.valDeb, creditos: conta.valCred, saldoAtual: conta.saldoAtual,
          movimento: movimentoConta(conta), detalhe: `${demo.id}: ${correspondencias.map(item => item.descricao).join('; ')}`,
        });
      }
    }
    if (/^[1-6](?:\.|$)/.test(conta.conta)) {
      const indiretas = contaEmDfcIndireto(cadastro, conta);
      if (indiretas.length === 0) {
        naoClassificadas.push({
          conta: conta.conta, descricao: conta.desc, saldoAnterior: conta.saldoAnt,
          debitos: conta.valDeb, creditos: conta.valCred, saldoAtual: conta.saldoAtual,
          movimento: movimentoConta(conta), detalhe: `DFC Indireta — ${Math.abs(conta.valDeb) + Math.abs(conta.valCred) === 0 ? 'sem movimento' : 'com movimento'}`,
        });
      } else if (indiretas.length > 1) {
        duplicadas.push({
          conta: conta.conta, descricao: conta.desc, saldoAnterior: conta.saldoAnt,
          debitos: conta.valDeb, creditos: conta.valCred, saldoAtual: conta.saldoAtual,
          movimento: movimentoConta(conta), detalhe: `DFC Indireta: ${indiretas.map(item => item.descricao).join('; ')}`,
        });
      }
    }
  }
  return { naoClassificadas, duplicadas };
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
    movimento: reais(movimentoConta(conta)),
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
  const excluida = config.prefixosExcluidosSinal.some(prefixo => prefixoDe(conta.conta, prefixo));
  if (excluida) return null;
  const excecao = [...config.naturezaExcecoes]
    .sort((a, b) => b.prefixo.length - a.prefixo.length)
    .find(item => prefixoDe(conta.conta, item.prefixo));
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
  const prefixosRedutoresConfigurados = config.naturezaExcecoes
    .filter(item => item.natureza === 'credora' && isGrupo(item.prefixo, '1'))
    .map(item => item.prefixo);
  for (const conta of analiticas) {
    const natureza = naturezaEsperada(conta, config);
    const saldoAnterior = anterior?.[conta.conta]?.saldoAtual ?? 0;
    if (!natureza && !config.prefixosExcluidosSinal.some(prefixo => prefixoDe(conta.conta, prefixo))) {
      if (conta.conta.startsWith('6.') && !['6.1', '6.2', '6.3', '6.5'].some(prefixo => prefixoDe(conta.conta, prefixo))) {
        semNatureza.push(montarConta(conta, 'Natureza a definir'));
      }
      continue;
    }
    if (natureza && Math.abs(centavos(conta.saldoAtual)) > config.limiteSinalCentavos
      && contaComSinalInvertido(conta, natureza)) {
      divergentes.push({
        ...montarConta(conta, `Esperada ${natureza}`),
        saldoAnterior,
      });
    }
    const correspondePalavraRedutora = config.palavrasRedutoras.some(palavra =>
      normalizarTexto(conta.desc).includes(normalizarTexto(palavra)));
    if (correspondePalavraRedutora && !prefixosRedutoresConfigurados.some(prefixo => prefixoDe(conta.conta, prefixo))) {
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
      detalhe: `Variação líquida do grupo ${movimento.grupo}: ${movimento.variacao}`,
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
    : reais(fluxoDireto.reduce<number>((total, valor) => total + centavos(valor ?? 0), 0) / 100);
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
  config: ConferenciasConfig,
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
  const foraDfc = cadastro.linhas.filter(linha => linha.demonstracao === 'dfc' && linha.tipo === 'contas' && linha.foraDfc)
    .reduce((total, linha) => total + centavos(valoresDfc.get(linha.id) ?? 0), 0) / 100;
  const debitosCreditos = analisarBalancete(atual, config.toleranciaConferenciaCentavos);
  const diferencaDfc = totalDfc === null || caixa.variacaoReal === null || !debitosCreditos
    ? null
    : reais(centavos(totalDfc) - centavos(caixa.variacaoReal) - centavos(foraDfc) - centavos(debitosCreditos.diferencaDebitosCreditos));
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
    { nome: 'DFC — seções − variação de caixa − itens fora DFC', esperado: debitosCreditos?.diferencaDebitosCreditos ?? null, somaLinhas: diferencaDfc === null ? null : (debitosCreditos?.diferencaDebitosCreditos ?? 0) + diferencaDfc, diferenca: diferencaDfc, modoContas: 'movimentos', contas: montarContasDeMovimento([atual], conta => /^[1-6](?:\.|$)/.test(conta)) },
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
    const valoresAtual = calcularLinhas(cadastro.linhas, demo.codigo, [atual]);
    const valoresAnteriores = mesesAnteriores.filter(periodo => periodo.contas);
    const valoresPorMes = valoresAnteriores.map(periodo => ({
      periodo,
      valores: calcularLinhas(cadastro.linhas, demo.codigo, [periodo.contas]),
    }));
    for (const linha of linhas) {
      const valorMes = valoresAtual.get(linha.id);
      const anteriores = valoresPorMes.map(item => item.valores.get(linha.id))
        .filter((valor): valor is number => valor !== null && valor !== undefined);
      if (valorMes === null || valorMes === undefined || anteriores.length < 2) continue;
      const mediaAnterior = reais(anteriores.reduce((total, valor) => total + centavos(valor), 0) / anteriores.length);
      const variacao = reais(centavos(valorMes) - centavos(mediaAnterior));
      const variacaoCentavos = Math.abs(centavos(variacao));
      const mediaCentavos = Math.abs(centavos(mediaAnterior));
      const variacaoPercentual = mediaCentavos === 0 ? null : variacaoCentavos / mediaCentavos * 100;
      const linhaCapitalGiro = config.linhasCapitalGiro.some(nome => normalizarTexto(nome) === normalizarTexto(linha.nome));
      const limiteReais = linhaCapitalGiro ? config.limiteCapitalGiroCentavos : config.limiteVariacaoCentavos;
      const ultrapassaSempre = variacaoCentavos > config.limiteVariacaoSempreCentavos;
      const inverteSinal = mediaCentavos > 0 && Math.sign(valorMes) !== Math.sign(mediaAnterior)
        && Math.abs(centavos(valorMes)) > config.limiteVariacaoCentavos;
      const ultrapassaNormal = mediaCentavos === 0
        ? variacaoCentavos > limiteReais
        : variacaoCentavos > limiteReais && (variacaoPercentual ?? 0) > config.limiteVariacaoPercentual;
      if (!ultrapassaSempre && !inverteSinal && !ultrapassaNormal) continue;

      const idsLinha = new Set([linha.id]);
      let mudou = true;
      while (mudou) {
        mudou = false;
        for (const candidata of linhas) {
          const pai = linhaPai(candidata);
          if (pai && idsLinha.has(pai) && !idsLinha.has(candidata.id)) {
            idsLinha.add(candidata.id);
            mudou = true;
          }
        }
      }
      const linhasDaLinha = cadastro.linhas.filter(candidata => idsLinha.has(candidata.id));
      const contasDaLinha = contasAnaliticas(atual).filter(conta => linhasDaLinha.some(candidata =>
        linhaCorrespondente(candidata, conta.conta).length > 0
        || candidata.calculo === 'resultadoBalancete' && ['3', '4', '5', '6'].some(grupo => isGrupo(conta.conta, grupo))));
      const contribuicoes = contasDaLinha.map(conta => {
        const metricasAnteriores = valoresPorMes.map(({ periodo }) => {
          const item = periodo.contas?.[conta.conta];
          if (!item) return 0;
          return demo.codigo === 'ativo' || demo.codigo === 'passivo'
            || linha.calculo === 'resultadoBalancete'
            ? centavos(item.saldoAtual)
            : centavos(movimentoConta(item));
        });
        const valorAtualConta = demo.codigo === 'ativo' || demo.codigo === 'passivo'
          || linha.calculo === 'resultadoBalancete'
          ? centavos(conta.saldoAtual)
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
          detalhe: `Contribuição à variação: ${variacaoConta / 100}`,
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
            : `Variação acima dos limites de ${config.limiteVariacaoPercentual}% e R$ ${(limiteReais / 100).toLocaleString('pt-BR')}.`,
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
    if (!registro || naturezaEsperada(registro, config)
      || config.prefixosExcluidosSinal.some(prefixo => prefixoDe(conta.conta, prefixo))) return false;
    return !['6.1', '6.2', '6.3', '6.5'].some(prefixo => prefixoDe(conta.conta, prefixo));
  });
  const classes = classificarContas(atual, cadastro);
  const grupos = conferirGrupos(cadastro, atual, acumulado, config);
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
        ? `Débitos ${resumo.debitos.toFixed(2)}; créditos ${resumo.creditos.toFixed(2)}; diferença ${resumo.diferencaDebitosCreditos.toFixed(2)}; soma dos saldos ${resumo.somaSaldos.toFixed(2)}.`
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
      resumo: diferencaBalanco === null ? 'Não foi possível calcular o balanço.' : `Diferença: R$ ${diferencaBalanco.toFixed(2)}.`,
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
        : `DRE ${resultadoPorDre.valor?.toFixed(2)}; grupos 3 a 6 ${resultadoPorGrupo?.toFixed(2)}; diferença ${diferencaResultado.toFixed(2)}.`,
    },
    {
      id: 'caixa-dfc',
      titulo: '6. DFC, variação real e caixa do balanço',
      estado: [diferencaDfcDireta, diferencaDfcIndireta, diferencaCaixaBalanco].some(valor => valor !== null
        && Math.abs(centavos(valor)) > config.toleranciaConferenciaCentavos) ? 'erro'
        : diferencaDfcDireta === null || diferencaDfcIndireta === null || diferencaCaixaBalanco === null ? 'indisponivel' : 'ok',
      resumo: `DFC Direta − caixa: ${diferencaDfcDireta?.toFixed(2) ?? 'indisponível'}; DFC Indireta − caixa: ${diferencaDfcIndireta?.toFixed(2) ?? 'indisponível'}; Caixa DFC − caixa do balanço: ${diferencaCaixaBalanco?.toFixed(2) ?? 'indisponível'}.`,
    },
    {
      id: 'direto-indireto',
      titulo: '7. Caixa operacional Direto = Indireto',
      estado: [diferencaOperacionalMes, diferencaOperacionalAcumulada].some(valor => valor !== null
        && Math.abs(centavos(valor)) > config.toleranciaConferenciaCentavos) ? 'erro'
        : diferencaOperacionalMes === null || diferencaOperacionalAcumulada === null ? 'indisponivel' : 'ok',
      resumo: `Mês: ${diferencaOperacionalMes?.toFixed(2) ?? 'indisponível'}; acumulado: ${diferencaOperacionalAcumulada?.toFixed(2) ?? 'indisponível'}.`,
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
      estado: classes.duplicadas.length ? 'erro' : classes.naoClassificadas.length ? 'atencao' : atual ? 'ok' : 'indisponivel',
      resumo: `${classes.naoClassificadas.length} contas sem linha; ${classes.duplicadas.length} contas em mais de uma linha.`,
      contas: [...classes.naoClassificadas, ...classes.duplicadas],
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
        ? `${gruposErrados.length} grupos apresentam diferença superior à tolerância de R$ ${(config.toleranciaConferenciaCentavos / 100).toFixed(2)}.`
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
        ...resultadoPL.movimentos.map(item => `${item.estado}: ${item.grupo}, variação líquida R$ ${item.variacao.toFixed(2)}.`),
        ...variacoesAtipicas.map(item => `${item.demonstracao} · ${item.linha}: ${item.motivo}`),
        ...arrendamentos.candidatos.map(conta => `Possível conta de arrendamento para revisar: ${conta.conta} — ${conta.descricao}.`),
        ...(aumentoArrendamentoSemCaixa ? [`Créditos em passivos de arrendamento: R$ ${(arrendamentos.aumentoPassivoCentavos / 100).toFixed(2)}; variação DFC direta das contas: R$ ${(arrendamentos.fluxoDfcCentavos / 100).toFixed(2)}.`] : []),
        ...(arrendamentoSemAtivo ? [`Contrato sem ativo correspondente: variação líquida de direito de uso R$ ${(arrendamentos.variacaoDireitoUsoCentavos / 100).toFixed(2)}.`] : []),
        ...arrendamentos.contasDireitoUso.map(conta => `Direito de uso ${conta.conta} — ${conta.desc}: saldo anterior ${conta.saldoAnt.toFixed(2)}, débito ${conta.valDeb.toFixed(2)}, crédito ${conta.valCred.toFixed(2)}, saldo atual ${conta.saldoAtual.toFixed(2)}.`),
        ...variacoesAtipicas.map(item => `Variação ${item.demonstracao} · ${item.linha}: mês ${item.valorMes.toFixed(2)}, média ${item.mediaAnterior.toFixed(2)}, diferença ${item.variacao.toFixed(2)}, percentual ${item.variacaoPercentual?.toFixed(1) ?? 'n/a'}%.`),
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
