import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  DFC_PREFIXOS_CAIXA_EQUIVALENTES_PADRAO, MESES, calcularConta, calcularDfcIndireto, calcularLinhas,
  calcularSaldosCaixaEquivalentes, chavePeriodo, encontrarLinhaBasePercentualDre, identificarContasIncompletas, linhaPai,
  type CadastroDemonstracoes, type DadosDemonstracoes, type LinhaDemonstracao, type PeriodoDemonstracao, type TipoDemonstracao,
} from './modelo';
import { criarLinhasDfcIndiretoTabela } from './dfcTabela';
import type { EscopoNotaDfc, NotaDfc } from './storage';

const CORES = {
  verde: 'FF00843D',
  verdeEscuro: 'FF006B35',
  verdeClaro: 'FFE8F3EC',
  cinzaClaro: 'FFF3F5F4',
  texto: 'FF24312A',
  borda: 'FFD7DFDA',
  branco: 'FFFFFFFF',
  vermelho: 'FFB42318',
};
const FORMATO_MOEDA = '"R$" #,##0.00;[Red]("R$" #,##0.00);-';
const FORMATO_PERCENTUAL = '0.0%;[Red]-0.0%;-';
const BORDA_FINA = { style: 'thin' as const, color: { argb: CORES.borda } };

type ColunaExportacao = {
  ano: number;
  mes: number;
  acumulada: boolean;
  periodo: PeriodoDemonstracao[];
};
type ColunaPlanilha = { coluna: ColunaExportacao; tipo: 'moeda' | 'percentual'; indice: number };
type FormatoValor = 'moeda' | 'percentual';
type EstiloLinha = 'normal' | 'secao' | 'subtotal' | 'total';
type LinhaExportacao = {
  id: string;
  nome: string;
  estilo: EstiloLinha;
  recuo?: boolean;
  ocultarValores?: boolean;
};
export interface NotasDfcExportacao {
  escopo: EscopoNotaDfc;
  notas: NotaDfc[];
}
export interface ParametrosExportacaoExcel {
  cadastro: CadastroDemonstracoes;
  dados: DadosDemonstracoes;
  anos: number[];
  mesLimite: number;
  incluirNotasAnuais: boolean;
  notas: NotasDfcExportacao[];
}

function criarColunas(anos: number[], mesLimite: number, acumulado: boolean): ColunaExportacao[] {
  return anos.flatMap(ano => [
    ...Array.from({ length: mesLimite }, (_, index) => {
      const mes = index + 1;
      return { ano, mes, acumulada: false, periodo: [{ ano, mes }] };
    }),
    ...(acumulado ? [{
      ano, mes: mesLimite, acumulada: true,
      periodo: Array.from({ length: mesLimite }, (_, index) => ({ ano, mes: index + 1 })),
    }] : []),
  ]);
}

function periodosDaColuna(dados: DadosDemonstracoes, coluna: ColunaExportacao) {
  return coluna.periodo.map(periodo => dados[chavePeriodo(periodo)] ?? null);
}

function criarColunasPlanilha(colunas: ColunaExportacao[], incluirPercentuais: boolean): ColunaPlanilha[] {
  return colunas.flatMap((coluna, indice) => [
    { coluna, tipo: 'moeda' as const, indice },
    ...(incluirPercentuais ? [{ coluna, tipo: 'percentual' as const, indice }] : []),
  ]);
}

function configurarPlanilha(
  workbook: ExcelJS.Workbook,
  nomeAba: string,
  titulo: string,
  cadastro: CadastroDemonstracoes,
  colunas: ColunaExportacao[],
  incluirPercentualDre = false,
): ExcelJS.Worksheet {
  const ws = workbook.addWorksheet(nomeAba, { properties: { tabColor: { argb: CORES.verde } } });
  const colunasPlanilha = criarColunasPlanilha(colunas, incluirPercentualDre);
  const ultimaColuna = colunasPlanilha.length + 1;
  ws.columns = [{ width: 48 }, ...colunasPlanilha.map(() => ({ width: 15 }))];
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 7, topLeftCell: 'B8', activeCell: 'B8' }];
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws.headerFooter.oddFooter = 'Página &P de &N';

  const linhaMesclada = (numero: number, texto: string, fill: string, font: Partial<ExcelJS.Font>) => {
    ws.mergeCells(numero, 1, numero, ultimaColuna);
    const linha = ws.getRow(numero);
    linha.height = numero === 1 ? 27 : 21;
    for (let coluna = 1; coluna <= ultimaColuna; coluna++) {
      const celula = linha.getCell(coluna);
      celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      celula.font = font;
      celula.alignment = { vertical: 'middle', horizontal: 'left' };
    }
    linha.getCell(1).value = texto;
  };
  linhaMesclada(1, cadastro.empresa.nome || 'Demonstrações financeiras', CORES.verdeEscuro, {
    bold: true, size: 14, color: { argb: CORES.branco },
  });
  linhaMesclada(2, `CNPJ: ${cadastro.empresa.cnpj || '—'}${cadastro.empresa.nire ? `  |  NIRE: ${cadastro.empresa.nire}` : ''}`,
    CORES.cinzaClaro, { size: 10, color: { argb: CORES.texto } });
  linhaMesclada(3, titulo, CORES.cinzaClaro, { bold: true, size: 13, color: { argb: CORES.texto } });
  linhaMesclada(4, incluirPercentualDre
    ? 'Valores em R$  |  % RL Vendas = percentual sobre Receita Líquida de Vendas  |  Células vazias indicam balancete ausente ou cálculo indisponível.'
    : 'Valores em R$  |  Valores em branco indicam balancete ausente ou cálculo indisponível.',
    CORES.cinzaClaro, { italic: true, size: 9, color: { argb: CORES.texto } });
  ws.getRow(5).height = 8;

  ws.mergeCells(6, 1, 7, 1);
  const descricao = ws.getCell(6, 1);
  descricao.value = 'Descrição';
  descricao.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.verdeEscuro } };
  descricao.font = { bold: true, color: { argb: CORES.branco } };
  descricao.alignment = { vertical: 'middle', horizontal: 'left' };
  descricao.border = { top: BORDA_FINA, bottom: BORDA_FINA, left: BORDA_FINA, right: BORDA_FINA };

  let colunaInicial = 2;
  for (const ano of [...new Set(colunas.map(coluna => coluna.ano))]) {
    const grupo = colunasPlanilha.filter(coluna => coluna.coluna.ano === ano);
    const colunaFinal = colunaInicial + grupo.length - 1;
    if (colunaFinal > colunaInicial) ws.mergeCells(6, colunaInicial, 6, colunaFinal);
    const celulaAno = ws.getCell(6, colunaInicial);
    celulaAno.value = `Ano ${ano}`;
    celulaAno.alignment = { vertical: 'middle', horizontal: 'center' };
    for (let coluna = colunaInicial; coluna <= colunaFinal; coluna++) {
      const celula = ws.getCell(6, coluna);
      celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.verdeEscuro } };
      celula.font = { bold: true, color: { argb: CORES.branco } };
      celula.border = { top: BORDA_FINA, bottom: BORDA_FINA, left: BORDA_FINA, right: BORDA_FINA };
    }
    for (let index = 0; index < grupo.length; index++) {
      const { coluna, tipo } = grupo[index];
      const rotuloPeriodo = coluna.acumulada
        ? `Acum. Jan–${MESES[coluna.mes]}/${ano}`
        : `${MESES[coluna.mes]}/${ano}`;
      const celula = ws.getCell(7, colunaInicial + index);
      celula.value = incluirPercentualDre ? `${rotuloPeriodo}\n${tipo === 'percentual' ? '% RL Vendas' : 'R$'}` : rotuloPeriodo;
      celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.verde } };
      celula.font = { bold: true, color: { argb: CORES.branco }, size: 9 };
      celula.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      celula.border = { top: BORDA_FINA, bottom: BORDA_FINA, left: BORDA_FINA, right: BORDA_FINA };
    }
    colunaInicial = colunaFinal + 1;
  }
  ws.getRow(6).height = 21;
  ws.getRow(7).height = incluirPercentualDre ? 42 : 32;
  return ws;
}

function adicionarLinhaDados(
  ws: ExcelJS.Worksheet,
  nome: string,
  valores: Array<number | null>,
  estilo: EstiloLinha = 'normal',
  recuo = false,
  formatos: FormatoValor[] = [],
) {
  const linha = ws.addRow([nome, ...valores]);
  linha.height = estilo === 'secao' ? 21 : estilo === 'total' ? 22 : 19;
  const fill = estilo === 'total' ? CORES.verdeEscuro
    : estilo === 'subtotal' ? CORES.verdeClaro
      : estilo === 'secao' ? CORES.cinzaClaro : CORES.branco;
  linha.eachCell({ includeEmpty: true }, (celula, indice) => {
    celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    celula.border = { top: BORDA_FINA, bottom: BORDA_FINA, left: BORDA_FINA, right: BORDA_FINA };
    celula.font = {
      size: 10,
      bold: estilo !== 'normal',
      color: { argb: estilo === 'total' ? CORES.branco : CORES.texto },
    };
    celula.alignment = indice === 1
      ? { vertical: 'middle', horizontal: 'left', indent: recuo ? 1 : 0, wrapText: true }
      : { vertical: 'middle', horizontal: 'right' };
    if (indice > 1) celula.numFmt = formatos[indice - 2] === 'percentual' ? FORMATO_PERCENTUAL : FORMATO_MOEDA;
  });
  return linha;
}

function adicionarSecao(ws: ExcelJS.Worksheet, titulo: string, ultimaColuna: number) {
  const linha = ws.addRow([titulo]);
  ws.mergeCells(linha.number, 1, linha.number, ultimaColuna);
  const celula = linha.getCell(1);
  celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.verdeClaro } };
  celula.font = { bold: true, color: { argb: CORES.verdeEscuro }, size: 11 };
  celula.alignment = { vertical: 'middle' };
  linha.height = 22;
  return linha;
}

function linhasTabela(cadastro: CadastroDemonstracoes, demonstracao: TipoDemonstracao): LinhaExportacao[] {
  const linhas = cadastro.linhas.filter(linha =>
    linha.demonstracao === demonstracao && !(demonstracao === 'dfc' && linha.foraDfc));
  const raizes = linhas.filter(linha => !linhaPai(linha));
  return raizes.flatMap(raiz => {
    const temSubtotal = demonstracao === 'dfc' && Boolean(raiz.dfcSubtotalNome);
    const resultado: LinhaExportacao[] = [{
      id: raiz.id,
      nome: raiz.nome,
      estilo: temSubtotal ? 'secao' : raiz.tipo === 'total' ? 'total' : 'normal',
      ocultarValores: temSubtotal,
    }];
    resultado.push(...linhas.filter(linha => linhaPai(linha) === raiz.id).map(linha => ({
      id: linha.id,
      nome: linha.nome,
      estilo: linha.tipo === 'total' ? 'total' as const : 'normal' as const,
      recuo: true,
    })));
    if (temSubtotal) resultado.push({
      id: raiz.id,
      nome: raiz.dfcSubtotalNome!,
      estilo: 'subtotal',
    });
    return resultado;
  });
}

function adicionarDemonstracao(
  ws: ExcelJS.Worksheet,
  cadastro: CadastroDemonstracoes,
  dados: DadosDemonstracoes,
  demonstracao: TipoDemonstracao,
  colunas: ColunaExportacao[],
) {
  const incluirPercentualDre = demonstracao === 'dre';
  const colunasPlanilha = criarColunasPlanilha(colunas, incluirPercentualDre);
  const linhaBasePercentualDre = incluirPercentualDre
    ? encontrarLinhaBasePercentualDre(cadastro.linhas)
    : undefined;
  const resultados = colunas.map(coluna => calcularLinhas(
    cadastro.linhas,
    demonstracao,
    periodosDaColuna(dados, coluna),
  ));
  for (const linha of linhasTabela(cadastro, demonstracao)) {
    const valores = colunasPlanilha.map(({ tipo, indice }) => {
      const valor = linha.ocultarValores ? null : resultados[indice].get(linha.id) ?? null;
      if (tipo === 'moeda') return valor;
      const receitaLiquida = linhaBasePercentualDre
        ? resultados[indice].get(linhaBasePercentualDre.id) ?? null
        : null;
      return valor === null || receitaLiquida === null || receitaLiquida === 0
        ? null
        : valor / receitaLiquida;
    });
    adicionarLinhaDados(
      ws, linha.nome, valores, linha.estilo, linha.recuo,
      colunasPlanilha.map(({ tipo }) => tipo),
    );
  }
  return resultados;
}

function adicionarAberturaDemonstracao(
  ws: ExcelJS.Worksheet,
  cadastro: CadastroDemonstracoes,
  dados: DadosDemonstracoes,
  demonstracao: 'dre' | 'ativo' | 'passivo',
  colunas: ColunaExportacao[],
) {
  const periodosPorColuna = colunas.map(coluna => periodosDaColuna(dados, coluna));
  const resultadosPorColuna = periodosPorColuna.map(periodos =>
    calcularLinhas(cadastro.linhas, demonstracao, periodos));
  const incompletasPorColuna = periodosPorColuna.map(identificarContasIncompletas);
  const descricoes = new Map<string, string>();
  for (const periodo of periodosPorColuna.flat()) {
    for (const conta of Object.values(periodo ?? {})) {
      if (conta.desc.trim() && !descricoes.has(conta.conta)) descricoes.set(conta.conta, conta.desc);
    }
  }

  for (const linhaExportacao of linhasTabela(cadastro, demonstracao)) {
    adicionarLinhaDados(
      ws,
      linhaExportacao.nome,
      colunas.map((_, indice) => linhaExportacao.ocultarValores
        ? null
        : resultadosPorColuna[indice].get(linhaExportacao.id) ?? null),
      linhaExportacao.estilo,
      linhaExportacao.recuo,
    );

    const linha = cadastro.linhas.find(item =>
      item.id === linhaExportacao.id && item.demonstracao === demonstracao && item.tipo === 'contas');
    if (!linha) continue;

    for (const item of linha.itens) {
      const valores = periodosPorColuna.map((periodos, indice) =>
        calcularConta(item, demonstracao, periodos, incompletasPorColuna[indice]));
      if (valores.every(valor => valor !== null && valor === 0)) continue;
      const descricao = descricoes.get(item.referencia);
      adicionarLinhaDados(
        ws,
        descricao ? `${item.referencia} — ${descricao}` : item.referencia,
        valores,
        'normal',
        true,
      );
    }
  }
}

function variacaoDireta(linhas: LinhaDemonstracao[], valores: Map<string, number | null>): number | null {
  const raizes = linhas.filter(linha => linha.demonstracao === 'dfc' && !linhaPai(linha) && !linha.foraDfc);
  const totalizadas = new Set(raizes.filter(linha => linha.tipo === 'total')
    .flatMap(linha => linha.itens.map(item => item.referencia)));
  const atividades = raizes.filter(linha => !totalizadas.has(linha.id)).map(linha => valores.get(linha.id) ?? null);
  if (!atividades.length || atividades.some(valor => valor === null)) return null;
  return Math.round(atividades.reduce<number>((total, valor) => total + Math.round((valor ?? 0) * 100), 0)) / 100;
}

function escopoIgual(a: EscopoNotaDfc, b: EscopoNotaDfc) {
  return a.ano === b.ano && a.mes === b.mes && a.periodo === b.periodo && a.metodo === b.metodo;
}

function adicionarNotas(
  ws: ExcelJS.Worksheet,
  parametros: ParametrosExportacaoExcel,
  metodo: 'direto' | 'indireto',
  nomesLinhas: Map<string, string>,
  ultimaColuna: number,
) {
  adicionarSecao(ws, `Notas explicativas — Método ${metodo === 'direto' ? 'Direto' : 'Indireto'}`, ultimaColuna);
  let quantidade = 0;
  const adicionarEscopo = (escopo: EscopoNotaDfc, rotulo: string) => {
    const documento = parametros.notas.find(item => escopoIgual(item.escopo, escopo));
    for (const nota of documento?.notas ?? []) {
      const linha = nota.linhaId
        ? nomesLinhas.get(nota.linhaId) ?? nota.linhaNome ?? 'Linha da DFC'
        : 'Nota geral';
      const numero = ws.rowCount + 1;
      ws.mergeCells(numero, 1, numero, ultimaColuna);
      const celula = ws.getCell(numero, 1);
      celula.value = `${rotulo} | ${linha}: ${nota.texto}`;
      celula.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      celula.font = { size: 10, color: { argb: CORES.texto } };
      celula.border = { bottom: BORDA_FINA };
      ws.getRow(numero).height = Math.min(120, Math.max(24, Math.ceil(celula.value.toString().length / 130) * 15));
      quantidade++;
    }
  };

  for (const ano of parametros.anos) {
    for (let mes = 1; mes <= parametros.mesLimite; mes++) {
      adicionarEscopo({ ano, mes, periodo: 'mes', metodo }, `${MESES[mes]}/${ano}`);
    }
    adicionarEscopo(
      { ano, mes: parametros.mesLimite, periodo: 'acumulado', metodo },
      `Acumulado Jan–${MESES[parametros.mesLimite]}/${ano}`,
    );
    if (parametros.incluirNotasAnuais) adicionarEscopo({ ano, mes: 0, periodo: 'anual', metodo }, `Ano/${ano}`);
  }
  if (quantidade === 0) {
    const numero = ws.rowCount + 1;
    ws.mergeCells(numero, 1, numero, ultimaColuna);
    ws.getCell(numero, 1).value = 'Nenhuma nota explicativa cadastrada para os períodos exportados.';
    ws.getCell(numero, 1).font = { italic: true, color: { argb: 'FF64748B' }, size: 9 };
  }
}

function adicionarCaixaEEquivalentes(
  ws: ExcelJS.Worksheet,
  parametros: ParametrosExportacaoExcel,
  colunas: ColunaExportacao[],
  resultadosDiretos: Array<Map<string, number | null>>,
  resultadosIndiretos?: ReturnType<typeof calcularDfcIndireto>[],
) {
  const ultimaColuna = colunas.length + 1;
  adicionarSecao(ws, 'Caixa e equivalentes — conciliação', ultimaColuna);
  const prefixos = parametros.cadastro.dfcContasCaixaEquivalentes ?? [...DFC_PREFIXOS_CAIXA_EQUIVALENTES_PADRAO];
  const conciliacoes = colunas.map(coluna =>
    calcularSaldosCaixaEquivalentes(prefixos, periodosDaColuna(parametros.dados, coluna)));
  const linhas = [
    {
      nome: 'Variação de caixa pela DFC',
      valores: colunas.map((_, index) => resultadosIndiretos
        ? resultadosIndiretos[index].valores.get('dfc-total') ?? null
        : variacaoDireta(parametros.cadastro.linhas, resultadosDiretos[index])),
      estilo: 'total' as const,
    },
    { nome: 'Saldo de caixa — início', valores: conciliacoes.map(item => item.saldoInicial), estilo: 'normal' as const },
    { nome: 'Saldo de caixa — fim', valores: conciliacoes.map(item => item.saldoFinal), estilo: 'normal' as const },
    { nome: 'Variação real de caixa (balancete)', valores: conciliacoes.map(item => item.variacaoReal), estilo: 'total' as const },
  ];
  for (const linha of linhas) adicionarLinhaDados(ws, linha.nome, linha.valores, linha.estilo);
}

function adicionarDetalhesCaptacoes(
  ws: ExcelJS.Worksheet,
  cadastro: CadastroDemonstracoes,
  anos: number[],
  mesLimite: number,
  ultimaColuna: number,
) {
  const linhas = cadastro.linhas.filter(linha => linha.demonstracao === 'endividamento' && linha.captacao);
  if (!linhas.length) return;
  adicionarSecao(ws, 'Detalhes das captações', ultimaColuna);
  const cabecalho = ws.addRow([
    'Linha / banco', 'Período', 'Data da captação', 'Valor captado (R$)', 'Taxa',
    'Parcelas totais', 'Parcelas restantes', 'Juros provisionados (R$)',
  ]);
  cabecalho.eachCell(celula => {
    celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.verde } };
    celula.font = { bold: true, color: { argb: CORES.branco }, size: 9 };
    celula.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    celula.border = { top: BORDA_FINA, bottom: BORDA_FINA, left: BORDA_FINA, right: BORDA_FINA };
  });
  for (const linha of linhas) {
    const captacao = linha.captacao!;
    for (const ano of anos) {
      for (let mes = 1; mes <= mesLimite; mes++) {
        const chave = chavePeriodo({ ano, mes });
        const juros = captacao.jurosProvisionadosPorMes?.[chave];
        const row = ws.addRow([
          linha.nome,
          `${MESES[mes]}/${ano}`,
          captacao.data ? captacao.data.split('-').reverse().join('/') : '',
          captacao.valorCentavos === undefined ? null : captacao.valorCentavos / 100,
          captacao.taxa ?? '',
          captacao.parcelasTotais ?? null,
          captacao.restantesPorMes[chave] ?? null,
          juros === undefined ? null : juros / 100,
        ]);
        row.eachCell({ includeEmpty: true }, (celula, indice) => {
          celula.border = { bottom: BORDA_FINA };
          celula.alignment = { vertical: 'middle', horizontal: indice < 4 || indice === 5 ? 'left' : 'right', wrapText: indice === 1 || indice === 5 };
          if (indice === 4 || indice === 8) celula.numFmt = FORMATO_MOEDA;
        });
      }
    }
  }
}

function adicionarRodape(ws: ExcelJS.Worksheet, ultimaColuna: number) {
  const numero = ws.rowCount + 1;
  ws.mergeCells(numero, 1, numero, ultimaColuna);
  const celula = ws.getCell(numero, 1);
  celula.value = 'Documento gerencial preparado a partir dos balancetes importados. Valores em branco indicam período sem informação suficiente; não representam saldo zero.';
  celula.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  celula.alignment = { wrapText: true, vertical: 'middle' };
  ws.getRow(numero).height = 30;
}

function adicionarPlanilhaFluxo(
  workbook: ExcelJS.Workbook,
  parametros: ParametrosExportacaoExcel,
  metodo: 'direto' | 'indireto',
  colunas: ColunaExportacao[],
) {
  const titulo = `Demonstração dos Fluxos de Caixa — Método ${metodo === 'direto' ? 'Direto' : 'Indireto'}`;
  const ws = configurarPlanilha(workbook, metodo === 'direto' ? 'DFC Direto' : 'DFC Indireto', titulo, parametros.cadastro, colunas);
  const ultimaColuna = colunas.length + 1;
  const resultadosDiretos = colunas.map(coluna => calcularLinhas(
    parametros.cadastro.linhas,
    'dfc',
    periodosDaColuna(parametros.dados, coluna),
  ));
  const resultadosIndiretos = metodo === 'indireto'
    ? colunas.map(coluna => calcularDfcIndireto(
      parametros.cadastro.linhas,
      parametros.cadastro.dfcIndiretoRegras ?? [],
      periodosDaColuna(parametros.dados, coluna),
    ))
    : undefined;

  const linhas = metodo === 'indireto'
    ? criarLinhasDfcIndiretoTabela(parametros.cadastro.linhas).map(linha => ({
      id: linha.id,
      nome: linha.nome,
      estilo: linha.tipo === 'titulo' || linha.tipo === 'grupo' ? 'secao' as const
        : linha.tipo === 'total' ? 'total' as const
          : linha.tipo === 'subtotal' ? 'subtotal' as const : 'normal' as const,
      ocultarValores: linha.tipo === 'titulo' || linha.tipo === 'grupo',
    }))
    : linhasTabela(parametros.cadastro, 'dfc');
  for (const linha of linhas) {
    const valores = colunas.map((_, index) => linha.ocultarValores ? null : metodo === 'indireto'
      ? resultadosIndiretos?.[index].valores.get(linha.id) ?? null
      : resultadosDiretos[index].get(linha.id) ?? null);
    adicionarLinhaDados(ws, linha.nome, valores, linha.estilo, 'recuo' in linha ? linha.recuo : false);
  }

  adicionarCaixaEEquivalentes(ws, parametros, colunas, resultadosDiretos, resultadosIndiretos);
  const nomesLinhas = new Map(parametros.cadastro.linhas
    .filter(linha => linha.demonstracao === 'dfc')
    .map(linha => [linha.id, linha.nome]));
  if (metodo === 'indireto') {
    for (const linha of criarLinhasDfcIndiretoTabela(parametros.cadastro.linhas)) {
      nomesLinhas.set(linha.id, linha.nome);
    }
  }
  adicionarNotas(ws, parametros, metodo, nomesLinhas, ultimaColuna);
  adicionarRodape(ws, ultimaColuna);
  return ws;
}

export function criarWorkbookDemonstracoesFinanceiras(parametros: ParametrosExportacaoExcel): ExcelJS.Workbook {
  if (!parametros.anos.length || new Set(parametros.anos).size !== parametros.anos.length) {
    throw new Error('Selecione ao menos um ano, sem duplicidades, para exportar.');
  }
  if (!Number.isInteger(parametros.mesLimite) || parametros.mesLimite < 1 || parametros.mesLimite > 12) {
    throw new Error('O mês final da exportação deve estar entre janeiro e dezembro.');
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sorana Executive Dashboard';
  workbook.created = new Date();
  const colunasFluxo = criarColunas(parametros.anos, parametros.mesLimite, true);
  const colunasSaldo = criarColunas(parametros.anos, parametros.mesLimite, false);

  const criarAba = (nome: string, titulo: string, tipo: TipoDemonstracao, colunas: ColunaExportacao[]) => {
    const incluirPercentualDre = tipo === 'dre';
    const ws = configurarPlanilha(workbook, nome, titulo, parametros.cadastro, colunas, incluirPercentualDre);
    adicionarDemonstracao(ws, parametros.cadastro, parametros.dados, tipo, colunas);
    if (tipo === 'endividamento') adicionarDetalhesCaptacoes(ws, parametros.cadastro, parametros.anos, parametros.mesLimite, colunas.length + 1);
    adicionarRodape(ws, (incluirPercentualDre ? colunas.length * 2 : colunas.length) + 1);
  };
  const criarAbaAbertura = (
    nome: string,
    titulo: string,
    demonstracao: 'dre' | 'ativo' | 'passivo',
    colunas: ColunaExportacao[],
  ) => {
    const ws = configurarPlanilha(workbook, nome, titulo, parametros.cadastro, colunas);
    adicionarAberturaDemonstracao(ws, parametros.cadastro, parametros.dados, demonstracao, colunas);
    adicionarRodape(ws, colunas.length + 1);
  };
  criarAba('DRE', 'Demonstração do Resultado do Exercício', 'dre', colunasFluxo);
  adicionarPlanilhaFluxo(workbook, parametros, 'direto', colunasFluxo);
  adicionarPlanilhaFluxo(workbook, parametros, 'indireto', colunasFluxo);
  criarAba('Endividamento', 'Demonstrativo de Endividamento', 'endividamento', colunasSaldo);
  criarAba('Ativo', 'Balanço Patrimonial — Ativo', 'ativo', colunasSaldo);
  criarAba('Passivo + PL', 'Balanço Patrimonial — Passivo + Patrimônio Líquido', 'passivo', colunasSaldo);
  criarAbaAbertura('DRE - Abertura', 'Demonstração do Resultado do Exercício — Abertura de contas', 'dre', colunasFluxo);
  criarAbaAbertura('Ativo - Abertura', 'Balanço Patrimonial — Ativo — Abertura de contas', 'ativo', colunasSaldo);
  criarAbaAbertura('Passivo + PL - Abertura', 'Balanço Patrimonial — Passivo + Patrimônio Líquido — Abertura de contas', 'passivo', colunasSaldo);
  return workbook;
}

export async function exportarDemonstracoesFinanceirasExcel(parametros: ParametrosExportacaoExcel, nomeArquivo: string) {
  const workbook = criarWorkbookDemonstracoesFinanceiras(parametros);
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nomeArquivo);
}
