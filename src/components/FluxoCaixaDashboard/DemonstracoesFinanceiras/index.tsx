import { Fragment, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  TIPOS, MESES, LINHA_PL_ID, LINHA_RESULTADO_PERIODO_ID, calcularConta, calcularDfcIndireto, calcularLinhas, calcularSaldosCaixaEquivalentes, captacaoSchema, chavePeriodo, rotuloPeriodo, validarCadastro, validarLinhas, validarRegrasDfcIndireto, identificarContasIncompletas, validarContasCompletas, mesmaHierarquia, linhaPai, encontrarLinhaBasePercentualDre, encontrarLinhaDrePorNomes, identificarContasNaoClassificadas, listarContasDaLinha, listarContasDfcDaLinha, identificarContasDfcPendentes,
  type CadastroDemonstracoes, type DadosDemonstracoes, type ItemDemonstracao,
  type ContaDfcPendente, type LinhaDemonstracao, type PeriodoDemonstracao, type RegraDfcIndireto, type TipoDemonstracao,
} from './modelo';
import { DFC_INDIRETO_CATEGORIAS_MAPEAVEIS } from './dfcMetodoIndireto';
import { criarLinhasDfcIndiretoTabela } from './dfcTabela';
import { ConferenciasTab } from './ConferenciasTab';
import { carregarConferenciasPeriodosExportacao } from './conferenciasDados';
import type { ImportActor } from '../importHistoryStorage';
import {
  loadCadastroDemonstracoes, loadDadosDemonstracoes, loadNotasDfc, saveCadastroDemonstracoes, saveNotasDfc,
  type DocumentoNotasDfc, type EscopoNotaDfc, type NotaDfc,
} from './storage';

const moeda = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const moedaComCentavos = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentual = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatarMoedaComCentavos = (valor: number | null) => valor === null
  ? '—'
  : valor < 0 ? `(${moedaComCentavos.format(Math.abs(valor))})` : moedaComCentavos.format(valor);
function totalizarRaizes(linhas: LinhaDemonstracao[], valores: Map<string, number | null>, excluidas = new Set<string>()) {
  const raizes = linhas.filter(linha => !linhaPai(linha) && !excluidas.has(linha.id));
  const totalizadas = new Set(raizes.filter(linha => linha.tipo === 'total')
    .flatMap(linha => linha.itens.map(item => item.referencia)));
  const raizesFinais = raizes.filter(linha => !totalizadas.has(linha.id));
  if (!raizesFinais.length) return null;
  const valoresRaizes = raizesFinais.map(linha => valores.get(linha.id));
  const valoresNumericos = valoresRaizes.filter((valor): valor is number => valor !== null && valor !== undefined);
  if (valoresNumericos.length !== raizesFinais.length) return null;
  return valoresNumericos.reduce((total, valor) => total + Math.round(valor * 100), 0) / 100;
}
const titulosDemonstracoes: Record<TipoDemonstracao, string> = {
  dre: 'Demonstração do Resultado do Exercício',
  ativo: 'Balanço Patrimonial — Ativo',
  passivo: 'Balanço Patrimonial — Passivo',
  dfc: 'Demonstração dos Fluxos de Caixa — Método Direto',
  endividamento: 'Demonstrativo de Endividamento',
};
const selectClass = 'h-10 rounded-md border border-input bg-background px-3 text-sm';
const mensagem = (error: unknown) => error instanceof Error ? error.message : String(error);
const formatarMoeda = (valor: number) => valor < 0 ? `(${moeda.format(Math.abs(valor))})` : moeda.format(valor);
function lerCentavos(texto: string): number | undefined | null {
  const valor = texto.trim();
  if (!valor) return undefined;
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(valor)) return null;
  const [reais, centavos = ''] = valor.replace(/\./g, '').split(',');
  const total = Number(reais) * 100 + Number(centavos.padEnd(2, '0'));
  return Number.isSafeInteger(total) ? total : null;
}
const camposCaptacao = [
  { campo: 'data', rotulo: 'Data da captação', tipo: 'date' },
  { campo: 'valor', rotulo: 'Valor da captação (R$)', tipo: 'text', placeholder: 'Ex.: 1.000,00' },
  { campo: 'taxa', rotulo: 'Taxa', tipo: 'text', placeholder: 'Ex.: CDI + 2% a.a.' },
  { campo: 'total', rotulo: 'Total de parcelas', tipo: 'number', min: 1 },
  { campo: 'restantes', rotulo: 'Parcelas restantes', tipo: 'number', min: 0 },
  { campo: 'juros', rotulo: 'Juros Provisionados (R$)', tipo: 'text', placeholder: 'Ex.: 1.000,00' },
] as const;
type EditorCaptacao = {
  id: string;
  nome: string;
  periodo: PeriodoDemonstracao;
  campos: Record<(typeof camposCaptacao)[number]['campo'], string>;
};
type EditorNotaDfc = { id?: string; linhaId: string; linhaNome?: string; texto: string };

export function DemonstracoesFinanceiras({
  selectedYear,
  selectedMonth,
  currentUser,
}: {
  selectedYear: number;
  selectedMonth: number;
  currentUser?: ImportActor;
}) {
  const [aba, setAba] = useState<TipoDemonstracao | 'cadastros' | 'conferencias'>('dre');
  const [cadastro, setCadastro] = useState<CadastroDemonstracoes | null>(null);
  const [erroCadastro, setErroCadastro] = useState('');
  const [tentativaCadastro, setTentativaCadastro] = useState(0);
  const [alterado, setAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [aviso, setAviso] = useState('');
  const [erroAcao, setErroAcao] = useState('');
  const [dados, setDados] = useState<DadosDemonstracoes | null>(null);
  const [erroDados, setErroDados] = useState('');
  const [tentativaDados, setTentativaDados] = useState(0);
  const [anosComparados, setAnosComparados] = useState<number[] | null>(null);
  const [anoAdicionar, setAnoAdicionar] = useState(String(selectedYear - 1));
  const [periodoDre, setPeriodoDre] = useState<'mes' | 'acumulado'>('mes');
  const [mostrarPercentualDre, setMostrarPercentualDre] = useState(true);
  const [periodoDfc, setPeriodoDfc] = useState<'mes' | 'acumulado'>('mes');
  const [metodoDfc, setMetodoDfc] = useState<'direto' | 'indireto'>('direto');
  const [documentoNotasDfc, setDocumentoNotasDfc] = useState<DocumentoNotasDfc | null>(null);
  const [carregandoNotasDfc, setCarregandoNotasDfc] = useState(false);
  const [salvandoNotasDfc, setSalvandoNotasDfc] = useState(false);
  const [erroNotasDfc, setErroNotasDfc] = useState('');
  const [tentativaNotasDfc, setTentativaNotasDfc] = useState(0);
  const [editorNotaDfc, setEditorNotaDfc] = useState<EditorNotaDfc | null>(null);
  const [notaExcluirId, setNotaExcluirId] = useState<string | null>(null);
  const [modoCadastroDfc, setModoCadastroDfc] = useState<'direto' | 'indireto'>('direto');
  const [editorDfcIndireto, setEditorDfcIndireto] = useState<{ linha: string; referencias: string[] } | null>(null);
  const [buscaDfcIndireto, setBuscaDfcIndireto] = useState('');
  const [erroDfcIndireto, setErroDfcIndireto] = useState('');
  const [naoClassificadasAberto, setNaoClassificadasAberto] = useState(false);
  const [contasDfcPendentesAberto, setContasDfcPendentesAberto] = useState(false);
  const [contasCaixaEditor, setContasCaixaEditor] = useState<string[] | null>(null);
  const [buscaCaixa, setBuscaCaixa] = useState('');
  const [erroCaixaEditor, setErroCaixaEditor] = useState('');
  const [editor, setEditor] = useState<LinhaDemonstracao | null>(null);
  const [linhaExcluir, setLinhaExcluir] = useState<LinhaDemonstracao | null>(null);
  const [editorCaptacao, setEditorCaptacao] = useState<EditorCaptacao | null>(null);
  const [erroCaptacao, setErroCaptacao] = useState('');
  const [bancosEditor, setBancosEditor] = useState<LinhaDemonstracao[] | null>(null);
  const [bancoAtivo, setBancoAtivo] = useState('');
  const alvoEditor = bancosEditor ? bancosEditor.find(banco => banco.id === bancoAtivo) : editor;
  const [erroEditor, setErroEditor] = useState('');
  const [busca, setBusca] = useState('');
  const [tipoCadastro, setTipoCadastro] = useState<TipoDemonstracao>('dre');
  const [cadastrosExpandidos, setCadastrosExpandidos] = useState<Set<string>>(new Set());
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());
  const escopoDados = aba === 'cadastros' || aba === 'conferencias' ? 'cadastros'
    : aba === 'dre' || aba === 'dfc' ? aba
      : aba === 'passivo' ? 'balanco' : 'patrimonial';
  const periodosComparados = useMemo(
    () => (anosComparados ?? [selectedYear]).map(ano => ({ ano, mes: selectedMonth })),
    [anosComparados, selectedYear, selectedMonth],
  );
  const chaveAnosComparados = periodosComparados.map(periodo => periodo.ano).sort((a, b) => a - b).join(',');
  const periodosParaCarregar = useMemo(
    () => chaveAnosComparados.split(',').map(ano => ({ ano: Number(ano), mes: selectedMonth })),
    [chaveAnosComparados, selectedMonth],
  );
  const acumuladoDre = aba === 'dre' && selectedMonth > 0 && periodoDre === 'acumulado';
  const acumuladoDfc = aba === 'dfc' && selectedMonth > 0 && periodoDfc === 'acumulado';
  const acumuladoDados = acumuladoDre || acumuladoDfc;
  const escopoNotaDfc = useMemo(() => ({
    ano: selectedYear,
    mes: selectedMonth,
    periodo: selectedMonth === 0 ? 'anual' as const : periodoDfc,
    metodo: metodoDfc,
  }), [selectedYear, selectedMonth, periodoDfc, metodoDfc]);

  useEffect(() => {
    let ativo = true;
    setErroCadastro('');
    loadCadastroDemonstracoes().then(value => {
      if (ativo) setCadastro(value);
    }).catch(error => { if (ativo) setErroCadastro(mensagem(error)); });
    return () => { ativo = false; };
  }, [tentativaCadastro]);

  useEffect(() => {
    let ativo = true;
    setDados(null);
    setErroDados('');
    if (aba === 'conferencias') return () => { ativo = false; };
    const principal = periodosParaCarregar[0] ?? { ano: selectedYear, mes: selectedMonth };
    loadDadosDemonstracoes(principal, periodosParaCarregar, escopoDados, acumuladoDados).then(value => {
      if (ativo) setDados(value);
    }).catch(error => { if (ativo) setErroDados(mensagem(error)); });
    return () => { ativo = false; };
  }, [aba, selectedYear, selectedMonth, periodosParaCarregar, tentativaDados, escopoDados, acumuladoDados]);

  useEffect(() => {
    if (aba !== 'dfc') return;
    let ativo = true;
    setDocumentoNotasDfc(null);
    setCarregandoNotasDfc(true);
    setErroNotasDfc('');
    loadNotasDfc(escopoNotaDfc).then(value => {
      if (ativo) setDocumentoNotasDfc(value);
    }).catch(error => {
      if (ativo) setErroNotasDfc(mensagem(error));
    }).finally(() => {
      if (ativo) setCarregandoNotasDfc(false);
    });
    return () => { ativo = false; };
  }, [aba, escopoNotaDfc, tentativaNotasDfc]);

  const catalogo = useMemo(() => {
    const contas = new Map<string, string>();
    for (const periodo of Object.values(dados ?? {})) {
      for (const conta of Object.values(periodo ?? {})) contas.set(conta.conta, conta.desc);
    }
    return [...contas].map(([codigo, descricao]) => ({ codigo, descricao }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
  }, [dados]);
  const contasIncompletas = useMemo(() => identificarContasIncompletas(Object.values(dados ?? {})), [dados]);
  const descricoes = useMemo(() => new Map(catalogo.map(conta => [conta.codigo, conta.descricao])), [catalogo]);

  function alternarExpandido(id: string, atualizar: Dispatch<SetStateAction<Set<string>>>) {
    atualizar(atuais => {
      const novos = new Set(atuais);
      if (novos.has(id)) novos.delete(id);
      else novos.add(id);
      return novos;
    });
  }

  function descricaoConta(item: ItemDemonstracao) {
    return `${item.referencia} — ${descricoes.get(item.referencia) ?? 'Descrição indisponível no balancete carregado'}`;
  }

  function atualizar(novo: CadastroDemonstracoes) {
    setCadastro(novo);
    setAlterado(true);
    setAviso('');
    setErroAcao('');
  }

  function atualizarLinhas(linhas: LinhaDemonstracao[]): boolean {
    if (!cadastro) return false;
    const erro = validarLinhas(linhas);
    if (erro) { setErroAcao(erro); return false; }
    atualizar({ ...cadastro, linhas });
    return true;
  }

  function confirmarExclusaoLinha() {
    if (!cadastro || !linhaExcluir) {
      setErroAcao('Não foi possível localizar a linha para exclusão.');
      return;
    }
    if (atualizarLinhas(cadastro.linhas.filter(item => item.id !== linhaExcluir.id && linhaPai(item) !== linhaExcluir.id))) {
      setLinhaExcluir(null);
    }
  }

  async function salvar(novo: CadastroDemonstracoes, informarErro = setErroAcao) {
    const erro = validarContasCompletas(novo.linhas, contasIncompletas);
    if (erro) { informarErro(erro); return false; }
    setSalvando(true);
    setErroAcao('');
    setAviso('');
    try {
      const salva = await saveCadastroDemonstracoes(novo);
      setCadastro(salva);
      setAlterado(false);
      setAviso('Cadastro salvo com sucesso.');
      return true;
    } catch (error) {
      informarErro(mensagem(error));
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function exportarExcel() {
    if (!cadastro || exportandoExcel) return;
    const erro = validarCadastro(cadastro);
    if (erro) { setErroAcao(erro); return; }
    const anos = periodosComparados.map(periodo => periodo.ano);
    const mesLimite = selectedMonth === 0 ? 12 : selectedMonth;
    if (!Number.isInteger(mesLimite) || mesLimite < 1 || mesLimite > 12) {
      setErroAcao('Selecione um mês válido antes de exportar as demonstrações.');
      return;
    }

    setExportandoExcel(true);
    setErroAcao('');
    setAviso('');
    try {
      const conferencias = await carregarConferenciasPeriodosExportacao(anos, mesLimite, cadastro);
      const periodos = anos.map(ano => ({ ano, mes: mesLimite }));
      const dadosExportacao = await loadDadosDemonstracoes(
        periodos[0] ?? { ano: selectedYear, mes: mesLimite },
        periodos,
        'dfc',
        true,
      );
      const escopos: EscopoNotaDfc[] = [];
      for (const ano of anos) {
        for (const metodo of ['direto', 'indireto'] as const) {
          for (let mes = 1; mes <= mesLimite; mes++) escopos.push({ ano, mes, periodo: 'mes', metodo });
          escopos.push({ ano, mes: mesLimite, periodo: 'acumulado', metodo });
          if (selectedMonth === 0) escopos.push({ ano, mes: 0, periodo: 'anual', metodo });
        }
      }
      const notas: Array<{ escopo: EscopoNotaDfc; notas: NotaDfc[] }> = [];
      for (let indice = 0; indice < escopos.length; indice += 12) {
        const lote = escopos.slice(indice, indice + 12);
        notas.push(...await Promise.all(lote.map(async escopo => ({
          escopo,
          notas: (await loadNotasDfc(escopo)).notas,
        }))));
      }

      const { exportarDemonstracoesFinanceirasExcel } = await import('./exportacaoExcel');
      const periodoArquivo = selectedMonth === 0 ? 'Jan-Dez' : `Jan-${MESES[mesLimite]}`;
      const nomeArquivo = `Demonstracoes_Financeiras_${selectedYear}_${periodoArquivo}.xlsx`;
      await exportarDemonstracoesFinanceirasExcel({
        cadastro,
        dados: dadosExportacao,
        anos,
        mesLimite,
        incluirNotasAnuais: selectedMonth === 0,
        notas,
        conferencias,
      }, nomeArquivo);
      setAviso('Arquivo Excel gerado com sucesso.');
    } catch (error) {
      setErroAcao(`Não foi possível exportar as demonstrações: ${mensagem(error)}`);
    } finally {
      setExportandoExcel(false);
    }
  }

  function abrirCaptacao(linha: LinhaDemonstracao) {
    const captacao = linha.captacao;
    const chave = chavePeriodo(principal);
    const juros = captacao?.jurosProvisionadosPorMes?.[chave];
    setErroCaptacao('');
    setEditorCaptacao({ id: linha.id, nome: linha.nome, periodo: principal, campos: {
      data: captacao?.data ?? '',
      valor: captacao?.valorCentavos === undefined ? '' : moedaComCentavos.format(captacao.valorCentavos / 100),
      taxa: captacao?.taxa ?? '',
      total: captacao?.parcelasTotais?.toString() ?? '',
      restantes: captacao?.restantesPorMes[chave]?.toString() ?? '',
      juros: juros === undefined ? '' : moedaComCentavos.format(juros / 100),
    } });
  }

  async function salvarCaptacao() {
    if (!editorCaptacao || !cadastro || salvando) return;
    const { id, periodo, campos } = editorCaptacao;
    const linha = cadastro.linhas.find(item => item.id === id);
    if (!linha?.bancoDe) { setErroCaptacao('O banco ou dívida não está mais no cadastro.'); return; }
    const valorCentavos = lerCentavos(campos.valor);
    if (valorCentavos === null) {
      setErroCaptacao('Informe o valor da captação no formato 1.000,00.');
      return;
    }
    const juros = lerCentavos(campos.juros);
    if (juros === null) {
      setErroCaptacao('Informe os juros provisionados no formato 1.000,00.');
      return;
    }
    const chave = chavePeriodo(periodo);
    const restantesPorMes = { ...linha.captacao?.restantesPorMes };
    if (campos.restantes === '') delete restantesPorMes[chave];
    else restantesPorMes[chave] = Number(campos.restantes);
    const jurosProvisionadosPorMes = { ...linha.captacao?.jurosProvisionadosPorMes };
    if (juros === undefined) delete jurosProvisionadosPorMes[chave];
    else jurosProvisionadosPorMes[chave] = juros;
    const resultado = captacaoSchema.safeParse({
      data: campos.data || undefined,
      valorCentavos,
      taxa: campos.taxa.trim() || undefined,
      parcelasTotais: campos.total === '' ? undefined : Number(campos.total),
      restantesPorMes,
      jurosProvisionadosPorMes,
    });
    if (!resultado.success) {
      setErroCaptacao(resultado.error.issues[0]?.message ?? 'Confira os dados da captação.');
      return;
    }
    setErroCaptacao('');
    if (await salvar({ ...cadastro, linhas: cadastro.linhas.map(item => item.id === id ? { ...item, captacao: resultado.data } : item) }, setErroCaptacao)) {
      setEditorCaptacao(null);
    }
  }

  function abrirEditor(linha?: LinhaDemonstracao) {
    const nova = linha ?? { id: crypto.randomUUID(), nome: '', demonstracao: tipoCadastro, tipo: 'contas', itens: [] };
    const bancos = linha ? (cadastro?.linhas ?? []).filter(item => linhaPai(item) === linha.id) : [];
    setEditor(nova);
    setBancosEditor(bancos.length || (!linha && tipoCadastro === 'endividamento') ? bancos : null);
    setBancoAtivo(bancos[0]?.id ?? '');
    setErroEditor('');
    setBusca('');
  }

  function adicionarBanco() {
    if (!editor || !bancosEditor) return;
    const banco: LinhaDemonstracao = editor.demonstracao === 'endividamento'
      ? { id: crypto.randomUUID(), nome: '', demonstracao: 'endividamento', tipo: 'contas', itens: [], bancoDe: editor.id }
      : {
        id: crypto.randomUUID(), nome: '', demonstracao: editor.demonstracao, tipo: 'contas', itens: [], sublinhaDe: editor.id,
        ...(editor.id === LINHA_PL_ID ? { contasPorPrefixo: true } : {}),
      };
    setBancosEditor([...bancosEditor, banco]);
    escolherBanco(banco.id);
  }

  function escolherBanco(id: string) {
    setBancoAtivo(id);
    setBusca('');
    setErroEditor('');
  }

  function atualizarAlvo(linha: LinhaDemonstracao) {
    if (bancosEditor) setBancosEditor(bancosEditor.map(banco => banco.id === linha.id ? linha : banco));
    else setEditor(linha);
  }

  function confirmarLinha() {
    if (!editor || !cadastro) return;
    if (bancosEditor && (!editor.nome.trim() || !bancosEditor.length || bancosEditor.some(banco => !banco.nome.trim() || (!banco.calculo && !banco.itens.length)))) {
      setErroEditor(editor.demonstracao === 'endividamento'
        ? 'Preencha o nome da linha principal e informe o nome e ao menos uma conta para cada banco ou dívida.'
        : 'Preencha o nome da linha principal e informe o nome e ao menos uma conta para cada sublinha.');
      return;
    }
    const nomeSubtotal = editor.dfcSubtotalNome?.trim();
    if (editor.dfcSubtotalNome !== undefined && !nomeSubtotal) {
      setErroEditor('Informe um nome para o subtotal.');
      return;
    }
    const principal = {
      ...editor,
      nome: editor.nome.trim(),
      ...(nomeSubtotal ? { dfcSubtotalNome: nomeSubtotal } : {}),
    };
    if (bancosEditor) {
      principal.tipo = 'total';
      principal.itens = bancosEditor.map(banco => ({ referencia: banco.id, operacao: 1 }));
    }
    const novos = [principal, ...(bancosEditor ?? []).map(banco => ({ ...banco, nome: banco.nome.trim() }))];
    const linhas = cadastro.linhas.filter(item => linhaPai(item) !== editor.id);
    const indice = linhas.findIndex(item => item.id === editor.id);
    if (indice < 0) linhas.push(...novos);
    else linhas.splice(indice, 1, ...novos);
    const erro = validarLinhas(linhas) ?? validarContasCompletas(novos, contasIncompletas);
    if (erro) { setErroEditor(erro); return; }
    atualizar({ ...cadastro, linhas });
    setEditor(null);
  }

  function moverLinha(id: string, direcao: number) {
    if (!cadastro) return;
    const visiveis = cadastro.linhas.filter(item => item.demonstracao === tipoCadastro && !linhaPai(item));
    const destino = visiveis[visiveis.findIndex(item => item.id === id) + direcao];
    if (!destino) return;
    const linhas = [...cadastro.linhas];
    const origemIndex = linhas.findIndex(item => item.id === id);
    const destinoIndex = linhas.findIndex(item => item.id === destino.id);
    [linhas[origemIndex], linhas[destinoIndex]] = [linhas[destinoIndex], linhas[origemIndex]];
    atualizarLinhas(linhas);
  }

  function editarContasCaixaEquivalentes() {
    setContasCaixaEditor([...(cadastro?.dfcContasCaixaEquivalentes ?? [])]);
    setBuscaCaixa('');
    setErroCaixaEditor('');
  }

  function salvarContasCaixaEquivalentes() {
    if (!cadastro || !contasCaixaEditor || salvando) return;
    const prefixos = [...new Set(contasCaixaEditor)];
    if (!prefixos.length) {
      setErroCaixaEditor('Selecione ao menos uma conta ou prefixo de caixa/equivalentes.');
      return;
    }
    void salvar({ ...cadastro, dfcContasCaixaEquivalentes: prefixos }, setErroCaixaEditor)
      .then(salvou => { if (salvou) setContasCaixaEditor(null); });
  }

  function selecionarContaCaixa(conta: string, marcada: boolean) {
    setContasCaixaEditor(atuais => {
      if (!atuais) return atuais;
      return marcada ? [...atuais, conta] : atuais.filter(item => item !== conta);
    });
  }

  function editarRegrasDfcIndireto(linha: string) {
    setEditorDfcIndireto({
      linha,
      referencias: (cadastro?.dfcIndiretoRegras ?? []).filter(regra => regra.linha === linha).map(regra => regra.referencia),
    });
    setBuscaDfcIndireto('');
    setErroDfcIndireto('');
  }

  function selecionarRegraDfcIndireto(referencia: string, marcada: boolean) {
    setEditorDfcIndireto(atual => {
      if (!atual) return atual;
      return {
        ...atual,
        referencias: marcada
          ? [...new Set([...atual.referencias, referencia])]
          : atual.referencias.filter(item => item !== referencia),
      };
    });
  }

  function aplicarRegrasDfcIndireto() {
    if (!cadastro || !editorDfcIndireto || salvando) return;
    const regras: RegraDfcIndireto[] = [
      ...(cadastro.dfcIndiretoRegras ?? []).filter(regra => regra.linha !== editorDfcIndireto.linha),
      ...editorDfcIndireto.referencias.map(referencia => ({ referencia, linha: editorDfcIndireto.linha })),
    ];
    const erro = validarRegrasDfcIndireto(regras);
    if (erro) { setErroDfcIndireto(erro); return; }
    atualizar({ ...cadastro, dfcIndiretoRegras: regras });
    setEditorDfcIndireto(null);
  }

  async function aceitarSugestaoDfc(conta: ContaDfcPendente) {
    if (!cadastro || salvando) return;
    let linhas = cadastro.linhas;
    if (conta.sugestaoDireta) {
      const destino = linhas.find(linha => linha.id === conta.sugestaoDireta?.codigo
        && linha.demonstracao === 'dfc' && linha.tipo === 'contas');
      if (!destino) {
        setErroAcao('A linha indicada pela sugestão direta não está mais disponível.');
        return;
      }
      linhas = linhas.map(linha => linha.id === destino.id
        ? { ...linha, itens: [...linha.itens.filter(item => item.referencia !== conta.conta), { referencia: conta.conta, operacao: 1 }] }
        : linha);
      const erro = validarLinhas(linhas);
      if (erro) { setErroAcao(erro); return; }
    }

    let regras = cadastro.dfcIndiretoRegras ?? [];
    if (conta.sugestaoIndireta) {
      regras = [
        ...regras.filter(regra => regra.referencia !== conta.conta),
        { referencia: conta.conta, linha: conta.sugestaoIndireta.codigo },
      ];
      const erro = validarRegrasDfcIndireto(regras);
      if (erro) { setErroAcao(erro); return; }
    }
    await salvar({ ...cadastro, linhas, dfcIndiretoRegras: regras });
  }

  function adicionarAnoComparacao() {
    const ano = Number(anoAdicionar);
    if (!Number.isInteger(ano) || ano < 1900 || ano > 9999) {
      setErroAcao('Informe um ano entre 1900 e 9999.');
      return;
    }
    const atuais = anosComparados ?? [selectedYear];
    if (atuais.includes(ano)) {
      setErroAcao(`Ano/${ano} já está incluído na comparação.`);
      return;
    }
    if (atuais.length >= 3) {
      setErroAcao('A comparação anual permite no máximo três anos.');
      return;
    }
    setAnosComparados([...atuais, ano]);
    setAnoAdicionar(String(ano - 1));
    setErroAcao('');
  }

  function moverAnoComparacao(ano: number, direcao: number) {
    const atuais = anosComparados ?? [selectedYear];
    const origem = atuais.indexOf(ano);
    const destino = origem + direcao;
    if (origem < 0 || destino < 0 || destino >= atuais.length) return;
    const atualizados = [...atuais];
    [atualizados[origem], atualizados[destino]] = [atualizados[destino], atualizados[origem]];
    setAnosComparados(atualizados);
  }

  function removerAnoComparacao(ano: number) {
    const atuais = anosComparados ?? [selectedYear];
    if (atuais.length <= 1) return;
    setAnosComparados(atuais.filter(item => item !== ano));
  }

  function selecionar(referencia: string, marcado: boolean) {
    if (!alvoEditor) return;
    if (marcado && alvoEditor.tipo === 'contas' && alvoEditor.demonstracao !== 'dfc' && !alvoEditor.contasPorPrefixo && contasIncompletas.has(referencia)) {
      setErroEditor(`A conta ${referencia} está incompleta ou é agrupadora. Selecione uma conta completa.`);
      return;
    }
    if (marcado && alvoEditor.tipo === 'contas') {
      const grupoExistente = grupoDaConta(referencia);
      if (grupoExistente) {
        setErroEditor(`A conta ${referencia} já está vinculada ao grupo "${grupoExistente.nome}" nesta demonstração.`);
        return;
      }
    }
    atualizarAlvo({ ...alvoEditor, itens: marcado ? [...alvoEditor.itens, { referencia, operacao: 1 }] : alvoEditor.itens.filter(item => item.referencia !== referencia) });
  }

  const principal = { ano: selectedYear, mes: selectedMonth };
  const linhas = cadastro?.linhas.filter(item => item.demonstracao === aba) ?? [];
  const linhasRaizDfc = aba === 'dfc' ? linhas.filter(linha => !linhaPai(linha) && !linha.foraDfc) : [];
  const referenciasTotalizadasDfc = new Set(linhasRaizDfc.filter(linha => linha.tipo === 'total')
    .flatMap(linha => linha.itens.map(item => item.referencia)));
  const linhasAtividadesDfc = linhasRaizDfc.filter(linha => !referenciasTotalizadasDfc.has(linha.id));
  const linhasTabela = linhas.filter(linha => !linhaPai(linha) && !(aba === 'dfc' && linha.foraDfc))
    .flatMap(linha => [
      { linha, subtotal: false },
      ...linhas.filter(filha => linhaPai(filha) === linha.id).map(filha => ({ linha: filha, subtotal: false })),
      ...(aba === 'dfc' && linha.dfcSubtotalNome ? [{ linha, subtotal: true }] : []),
    ]);
  const linhaBasePercentualDre = encontrarLinhaBasePercentualDre(linhas);
  const linhasForaTabela = aba === 'dfc'
    ? linhas.filter(linha => linha.foraDfc && !linhaPai(linha))
      .flatMap(linha => [linha, ...linhas.filter(filha => linhaPai(filha) === linha.id)])
    : [];
  const acumuladoSelecionado = aba === 'dre' ? periodoDre === 'acumulado' : periodoDfc === 'acumulado';
  const colunas = selectedMonth === 0
    ? periodosComparados.map(periodo => ({ titulo: `Ano/${periodo.ano}`, periodos: [periodo] }))
    : aba === 'dre' || aba === 'dfc'
      ? periodosComparados.map(periodo => ({
        titulo: !acumuladoSelecionado
          ? rotuloPeriodo(periodo)
          : `Jan–${MESES[periodo.mes]}/${String(periodo.ano).slice(-2)}`,
        periodos: !acumuladoSelecionado
          ? [periodo]
          : Array.from({ length: periodo.mes }, (_, index) => ({ ano: periodo.ano, mes: index + 1 })),
      }))
      : periodosComparados.map(periodo => ({ titulo: rotuloPeriodo(periodo), periodos: [periodo] }));
  const valores = aba !== 'cadastros' && aba !== 'conferencias' && cadastro && dados
    ? colunas.map(coluna => calcularLinhas(cadastro.linhas, aba, coluna.periodos.map(periodo => dados[chavePeriodo(periodo)] ?? null)))
    : [];
  const linhaLucroDre = cadastro
    ? encontrarLinhaDrePorNomes(cadastro.linhas, ['LUCRO LÍQUIDO DO EXERCÍCIO'])
    : undefined;
  const periodosDreAcumulados = aba === 'passivo' && dados
    ? colunas.map(coluna => {
      const periodo = coluna.periodos[0];
      if (periodo.mes === 0) return [dados[chavePeriodo(periodo)] ?? null];
      return Array.from({ length: periodo.mes }, (_, index) =>
        dados[chavePeriodo({ ano: periodo.ano, mes: index + 1 })] ?? null);
    })
    : [];
  const periodosDreFaltantes = [...new Set(periodosDreAcumulados.flatMap((periodos, index) =>
    periodos.flatMap((contas, mes) => contas === null
      ? [colunas[index].periodos[0].mes === 0
        ? `Ano/${colunas[index].periodos[0].ano}`
        : `${MESES[mes + 1]}/${colunas[index].periodos[0].ano}`]
      : [])))];
  const contasResultadoSemDre = aba === 'passivo' && cadastro
    ? identificarContasNaoClassificadas(cadastro.linhas, periodosDreAcumulados)
    : [];
  const conferenciasBalanco = aba === 'passivo' && cadastro && dados
    ? colunas.map((coluna, index) => {
      const periodosColuna = coluna.periodos.map(periodo => dados[chavePeriodo(periodo)] ?? null);
      const valoresAtivo = calcularLinhas(cadastro.linhas, 'ativo', periodosColuna);
      const totalAtivo = totalizarRaizes(cadastro.linhas.filter(linha => linha.demonstracao === 'ativo'), valoresAtivo);
      const valoresPassivo = valores[index];
      const totalPassivo = valoresPassivo
        ? totalizarRaizes(
          cadastro.linhas.filter(linha => linha.demonstracao === 'passivo'),
          valoresPassivo,
          new Set([LINHA_PL_ID]),
        )
        : null;
      const patrimonioLiquido = valoresPassivo?.get(LINHA_PL_ID) ?? null;
      const resultadoBalancete = valoresPassivo?.get(LINHA_RESULTADO_PERIODO_ID) ?? null;
      const periodosDre = periodosDreAcumulados[index] ?? [];
      const lucroDre = linhaLucroDre
        ? calcularLinhas(cadastro.linhas, 'dre', periodosDre).get(linhaLucroDre.id) ?? null
        : null;
      return {
        balanco: totalAtivo === null || totalPassivo === null || patrimonioLiquido === null
          ? null
          : Math.round((totalAtivo - totalPassivo - patrimonioLiquido) * 100) / 100,
        resultado: resultadoBalancete === null || lucroDre === null
          ? null
          : Math.round((resultadoBalancete - lucroDre) * 100) / 100,
      };
    })
    : [];
  const detalhesColunas = dados ? colunas.map(coluna => {
    const periodos = coluna.periodos.map(periodo => dados[chavePeriodo(periodo)] ?? null);
    return { periodos, incompletas: identificarContasIncompletas(periodos) };
  }) : [];
  const faltantes = [...new Map(colunas.flatMap(coluna => coluna.periodos).filter(periodo => dados && !dados[chavePeriodo(periodo)]).map(periodo => [chavePeriodo(periodo), periodo])).values()];
  const contasAusentes = aba !== 'cadastros' && aba !== 'dfc' && dados
    ? [...new Set(linhas.filter(linha => linha.tipo === 'contas' && !linha.contasPorPrefixo)
      .flatMap(linha => linha.itens.map(item => item.referencia)))]
      .filter(codigo => colunas.some(coluna => coluna.periodos.some(periodo => dados[chavePeriodo(periodo)] && !dados[chavePeriodo(periodo)]?.[codigo])))
    : [];
  const contasNaoClassificadas = aba === 'dre' && cadastro && dados
    ? identificarContasNaoClassificadas(cadastro.linhas, detalhesColunas.map(detalhe => detalhe.periodos))
    : [];
  const contasDfcPendentes = aba === 'dfc' && cadastro && dados
    ? identificarContasDfcPendentes(cadastro.linhas, cadastro.dfcIndiretoRegras ?? [], detalhesColunas.map(detalhe => detalhe.periodos))
    : [];
  const resultadosDfcIndireto = aba === 'dfc' && metodoDfc === 'indireto' && cadastro && dados
    ? colunas.map(coluna => calcularDfcIndireto(
      cadastro.linhas,
      cadastro.dfcIndiretoRegras ?? [],
      coluna.periodos.map(periodo => dados[chavePeriodo(periodo)] ?? null),
    ))
    : [];
  const periodosDetalhamento = detalhesColunas.flatMap(detalhe => detalhe.periodos);
  const contasDfcPorLinha = aba === 'dfc'
    ? new Map(linhas.filter(linha => linha.tipo === 'contas')
      .map(linha => [linha.id, listarContasDfcDaLinha(cadastro?.linhas ?? [], linha.id, periodosDetalhamento)]))
    : new Map<string, ItemDemonstracao[]>();
  const conciliacoesCaixa = aba === 'dfc' && cadastro && dados
    ? detalhesColunas.map(detalhe => calcularSaldosCaixaEquivalentes(cadastro.dfcContasCaixaEquivalentes ?? [], detalhe.periodos))
    : [];
  const variacoesDfc = aba === 'dfc'
    ? metodoDfc === 'indireto'
      ? resultadosDfcIndireto.map(resultado => resultado.valores.get('dfc-total') ?? null)
      : valores.map(resultado => {
        const atividades = linhasAtividadesDfc.map(linha => resultado.get(linha.id) ?? null);
        return !atividades.length || atividades.some(valor => valor === null)
          ? null
          : Math.round(atividades.reduce<number>((total, valor) => total + Math.round((valor ?? 0) * 100), 0)) / 100;
      })
    : [];
  const contasIncompletasVinculadas = linhas.filter(linha => aba !== 'dfc' && linha.tipo === 'contas' && !linha.contasPorPrefixo)
    .flatMap(linha => linha.itens).filter(item => contasIncompletas.has(item.referencia));
  const linhasDisponiveisEditor = editor && cadastro
    ? cadastro.linhas.filter(item => item.id !== editor.id && item.demonstracao === editor.demonstracao && !linhaPai(item))
    : [];
  const linhasConciliacaoCaixa = [
    { nome: 'Variação de caixa pela DFC', valores: variacoesDfc },
    { nome: 'Saldo de caixa — início', valores: conciliacoesCaixa.map(item => item.saldoInicial) },
    { nome: 'Saldo de caixa — fim', valores: conciliacoesCaixa.map(item => item.saldoFinal) },
    { nome: 'Variação real de caixa (balancete)', valores: conciliacoesCaixa.map(item => item.variacaoReal) },
  ];
  const linhasDfcIndiretoTabela = criarLinhasDfcIndiretoTabela(linhas);
  const linhasDisponiveisNotaDfc = metodoDfc === 'indireto'
    ? linhasDfcIndiretoTabela.filter(linha => linha.tipo !== 'titulo' && linha.tipo !== 'grupo')
      .map(({ id, nome }) => ({ id, nome }))
    : [...new Map(linhasTabela.filter(({ subtotal }) => !subtotal)
      .map(({ linha }) => [linha.id, { id: linha.id, nome: linha.nome }])).values()];
  const tituloPeriodoNotaDfc = selectedMonth === 0
    ? `Ano/${selectedYear}`
    : periodoDfc === 'acumulado'
      ? `Acumulado (Jan–${MESES[selectedMonth]}/${String(selectedYear).slice(-2)})`
      : rotuloPeriodo(principal);

  function abrirEditorNotaDfc(nota?: NotaDfc) {
    setErroNotasDfc('');
    setEditorNotaDfc(nota
      ? { id: nota.id, linhaId: nota.linhaId ?? '', linhaNome: nota.linhaNome, texto: nota.texto }
      : { linhaId: '', texto: '' });
  }

  async function salvarNotaDfc() {
    if (!editorNotaDfc) return;
    const texto = editorNotaDfc.texto.trim();
    if (!texto) { setErroNotasDfc('Escreva o conteúdo da nota antes de salvar.'); return; }
    if (texto.length > 5000) { setErroNotasDfc('A nota deve ter no máximo 5.000 caracteres.'); return; }
    if (!documentoNotasDfc) { setErroNotasDfc('As notas ainda não foram carregadas. Tente novamente.'); return; }
    const linha = linhasDisponiveisNotaDfc.find(item => item.id === editorNotaDfc.linhaId);
    if (editorNotaDfc.linhaId && !linha && !editorNotaDfc.linhaNome) {
      setErroNotasDfc('A linha selecionada não está disponível nesta DFC.');
      return;
    }
    const nota: NotaDfc = {
      id: editorNotaDfc.id ?? crypto.randomUUID(),
      linhaId: editorNotaDfc.linhaId || undefined,
      linhaNome: linha?.nome ?? (editorNotaDfc.linhaId ? editorNotaDfc.linhaNome : undefined),
      texto,
    };
    const indiceExistente = documentoNotasDfc.notas.findIndex(item => item.id === nota.id);
    const notas = [...documentoNotasDfc.notas];
    if (indiceExistente < 0) notas.push(nota);
    else notas[indiceExistente] = nota;
    setSalvandoNotasDfc(true);
    setErroNotasDfc('');
    try {
      const salva = await saveNotasDfc(escopoNotaDfc, { ...documentoNotasDfc, notas });
      setDocumentoNotasDfc(salva);
      setEditorNotaDfc(null);
    } catch (error) {
      setErroNotasDfc(mensagem(error));
    } finally {
      setSalvandoNotasDfc(false);
    }
  }

  async function excluirNotaDfc() {
    if (!notaExcluirId || !documentoNotasDfc) {
      setErroNotasDfc('Não foi possível localizar a nota para exclusão.');
      return;
    }
    setSalvandoNotasDfc(true);
    setErroNotasDfc('');
    try {
      const salva = await saveNotasDfc(escopoNotaDfc, {
        ...documentoNotasDfc,
        notas: documentoNotasDfc.notas.filter(nota => nota.id !== notaExcluirId),
      });
      setDocumentoNotasDfc(salva);
      setNotaExcluirId(null);
    } catch (error) {
      setErroNotasDfc(mensagem(error));
    } finally {
      setSalvandoNotasDfc(false);
    }
  }

  function grupoDaConta(referencia: string) {
    if (!editor || !alvoEditor || !cadastro || alvoEditor.tipo !== 'contas') return undefined;
    const disponiveis = [...cadastro.linhas.filter(linha => linhaPai(linha) !== editor.id && linha.id !== editor.id), ...(bancosEditor ?? [])];
    return disponiveis.find(linha =>
      linha.id !== alvoEditor.id && linha.demonstracao === alvoEditor.demonstracao && linha.tipo === 'contas' &&
      linha.itens.some(item => alvoEditor.demonstracao === 'dfc'
        ? item.referencia === referencia
        : mesmaHierarquia(item.referencia, referencia)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Emissão de Demonstrações Financeiras</h2></CardTitle>
        <p className="text-sm text-muted-foreground">Demonstrações gerenciais a partir dos balancetes importados. Impressão e PDF serão disponibilizados posteriormente.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div role="tablist" aria-label="Demonstrações financeiras" className="flex flex-wrap gap-2">
            {([...Object.keys(TIPOS), 'cadastros', 'conferencias'] as Array<TipoDemonstracao | 'cadastros' | 'conferencias'>).map(tipo => (
              <Button key={tipo} role="tab" aria-selected={aba === tipo} variant={aba === tipo ? 'default' : 'outline'} onClick={() => setAba(tipo)}>
                {tipo === 'cadastros' ? 'Cadastros' : tipo === 'conferencias' ? 'Conferências' : TIPOS[tipo]}
              </Button>
            ))}
          </div>
          <Button variant="outline" disabled={!cadastro || exportandoExcel} onClick={() => { void exportarExcel(); }}>
            {exportandoExcel ? 'Gerando Excel...' : 'Exportar Excel'}
          </Button>
        </div>
        {alterado && <p role="status" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Alterações não salvas. As demonstrações exibem o cadastro em edição; salve antes de sair desta página.</p>}
        {aviso && <p role="status" className="text-sm text-green-700">{aviso}</p>}
        {erroAcao && <p role="alert" className="text-sm text-red-700">{erroAcao}</p>}
        {erroCadastro ? (
          <div role="alert" className="space-y-3 text-red-700">
            <p>Não foi possível carregar o cadastro: {erroCadastro}</p>
            <Button variant="outline" onClick={() => setTentativaCadastro(value => value + 1)}>Tentar carregar cadastro novamente</Button>
          </div>
        ) : !cadastro ? <p role="status">Carregando cadastro...</p> : (
          <>
            {erroDados && <div role="alert" className="space-y-2 text-sm text-red-700">
              <p>Não foi possível carregar os balancetes: {erroDados}</p>
              <Button variant="outline" onClick={() => setTentativaDados(value => value + 1)}>Tentar carregar balancetes novamente</Button>
            </div>}
            {aba === 'conferencias' ? (
              <ConferenciasTab selectedYear={selectedYear} selectedMonth={selectedMonth} cadastro={cadastro} currentUser={currentUser} />
            ) : aba === 'cadastros' ? (
              <fieldset disabled={salvando} className="space-y-6">
                <section className="space-y-3">
                  <h3 className="font-semibold">Empresa</h3>
                  <p className="text-sm text-muted-foreground">Identificação para o cabeçalho. Não altera a empresa ou a base dos balancetes importados.</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    {(['nome', 'cnpj', 'nire'] as const).map(campo => (
                      <label key={campo} className="space-y-1 text-sm">
                        <span>{campo === 'nome' ? 'Nome da empresa *' : campo === 'cnpj' ? 'CNPJ *' : 'NIRE (opcional)'}</span>
                        <Input value={cadastro.empresa[campo]} onChange={event => atualizar({ ...cadastro, empresa: { ...cadastro.empresa, [campo]: event.target.value } })} />
                      </label>
                    ))}
                  </div>
                </section>
                <section className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <label className="space-y-1 text-sm"><span className="block font-semibold">Grupos e totalizações</span>
                      <select aria-label="Demonstração do cadastro" className={selectClass} value={tipoCadastro} onChange={event => setTipoCadastro(event.target.value as TipoDemonstracao)}>
                        {Object.entries(TIPOS).map(([key, titulo]) => <option key={key} value={key}>{titulo}</option>)}
                      </select>
                    </label>
                    {tipoCadastro === 'dfc' && <div role="group" aria-label="Método da DFC nos cadastros" className="flex gap-2">
                      <Button type="button" variant={modoCadastroDfc === 'direto' ? 'default' : 'outline'} aria-pressed={modoCadastroDfc === 'direto'} onClick={() => setModoCadastroDfc('direto')}>Método Direto</Button>
                      <Button type="button" variant={modoCadastroDfc === 'indireto' ? 'default' : 'outline'} aria-pressed={modoCadastroDfc === 'indireto'} onClick={() => setModoCadastroDfc('indireto')}>Método Indireto</Button>
                    </div>}
                    {!(tipoCadastro === 'dfc' && modoCadastroDfc === 'indireto') && <Button onClick={() => abrirEditor()}>Adicionar linha</Button>}
                  </div>
                  <p className="text-sm text-muted-foreground">{tipoCadastro === 'dfc' && modoCadastroDfc === 'indireto'
                    ? 'A DFC indireta usa o de-para da planilha. Variações de ativos e passivos consideram somente contas operacionais do método direto; o prefixo mais longo prevalece. AJ06 reúne automaticamente resultados de investimento/financiamento não classificados nos ajustes AJ01–AJ05.'
                    : tipoCadastro === 'dfc'
                    ? 'A DFC usa prefixos: o mais longo cadastrado prevalece. O efeito de cada conta é Crédito − Débito. Edite as linhas para reclassificar prefixos; use “Contas fora da DFC” para guardar contas de apoio.'
                    : 'Cadastre grupos de contas e totalizações das linhas desejadas. Use as setas para definir a posição de cada linha na demonstração; a posição não altera o cálculo.'}</p>
                  <div className="space-y-2">
                    {tipoCadastro === 'dfc' && modoCadastroDfc === 'indireto' ? (
                      <div className="space-y-3">
                        {DFC_INDIRETO_CATEGORIAS_MAPEAVEIS.map(({ codigo, nome }) => {
                          const regras = (cadastro.dfcIndiretoRegras ?? []).filter(regra => regra.linha === codigo);
                          return <div key={codigo} className="rounded border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div><p className="font-medium">{codigo} · {nome}</p><p className="text-xs text-muted-foreground">{regras.length} {regras.length === 1 ? 'prefixo cadastrado' : 'prefixos cadastrados'}</p></div>
                              <Button variant="outline" size="sm" onClick={() => editarRegrasDfcIndireto(codigo)}>Editar regras {codigo}</Button>
                            </div>
                            {regras.length > 0 && <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                              {regras.map(regra => <li key={regra.referencia} className="flex items-center justify-between gap-2">
                                <span>{descricaoConta({ referencia: regra.referencia, operacao: 1 })}</span>
                                <Button variant="ghost" size="sm" aria-label={`Remover regra ${regra.referencia} de ${codigo}`}
                                  onClick={() => atualizar({ ...cadastro, dfcIndiretoRegras: (cadastro.dfcIndiretoRegras ?? []).filter(item => item.referencia !== regra.referencia) })}>Remover</Button>
                              </li>)}
                            </ul>}
                          </div>;
                        })}
                        <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">
                          AJ06 é calculado automaticamente para neutralizar os demais resultados classificados em investimento ou financiamento no método direto.
                        </div>
                      </div>
                    ) : <>
                    {cadastro.linhas.filter(item => item.demonstracao === tipoCadastro && !linhaPai(item)).map((linha, index, lista) => {
                      const filhas = cadastro.linhas.filter(item => linhaPai(item) === linha.id);
                      const podeExpandir = linha.tipo === 'contas' || filhas.length > 0;
                      const expandido = cadastrosExpandidos.has(linha.id);
                      return <div key={linha.id} className="rounded border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div><p className="font-medium">{linha.nome}{linha.foraDfc ? ' · Fora da DFC' : ''}</p><p className="text-xs text-muted-foreground">{linha.calculo === 'resultadoBalancete'
                            ? 'Calculado pelo saldo das contas dos grupos 3, 4, 5 e 6'
                            : filhas.length ? `${linha.itens.length} ${linha.demonstracao === 'endividamento' ? 'bancos ou dívidas' : 'sublinhas'}` : `${linha.tipo === 'total' ? 'Totalização' : 'Grupo de contas'} · ${linha.itens.length} itens`}</p></div>
                          <div className="flex flex-wrap gap-1">
                            {podeExpandir && <Button variant="outline" size="sm" aria-expanded={expandido} onClick={() => alternarExpandido(linha.id, setCadastrosExpandidos)}>{expandido ? 'Ocultar' : 'Exibir'} contas de {linha.nome}</Button>}
                            {(!linha.modeloProtegido || linha.id === LINHA_PL_ID) && <>
                              <Button variant="outline" size="sm" aria-label={`Subir ${linha.nome}`} disabled={index === 0} onClick={() => moverLinha(linha.id, -1)}>↑</Button>
                              <Button variant="outline" size="sm" aria-label={`Descer ${linha.nome}`} disabled={index === lista.length - 1} onClick={() => moverLinha(linha.id, 1)}>↓</Button>
                              <Button variant="outline" size="sm" onClick={() => abrirEditor(linha)}>Editar {linha.nome}</Button>
                              <Button variant="outline" size="sm" onClick={() => { setErroAcao(''); setLinhaExcluir(linha); }}>Excluir {linha.nome}</Button>
                            </>}
                          </div>
                        </div>
                        {podeExpandir && expandido && <div className="mt-3 space-y-3 border-t pt-3 text-sm">
                          {(filhas.length ? filhas : [linha]).map(grupo => <div key={grupo.id}>
                            {filhas.length > 0 && <p className="font-medium">{grupo.nome}</p>}
                            <ul className="space-y-1 pl-4 text-muted-foreground">
                              {grupo.calculo === 'resultadoBalancete'
                                ? <li>− saldo atual das contas analíticas dos grupos 3, 4, 5 e 6</li>
                                : grupo.contasPorPrefixo && dados
                                  ? (listarContasDaLinha(grupo, periodosDetalhamento).length > 0
                                    ? listarContasDaLinha(grupo, periodosDetalhamento).map(({ conta }) => <li key={conta.conta}>{conta.conta} — {conta.desc}</li>)
                                    : grupo.itens.map(item => <li key={item.referencia}>{descricaoConta(item)}</li>))
                                  : grupo.itens.map(item => <li key={item.referencia}>{descricaoConta(item)}</li>)}
                            </ul>
                          </div>)}
                        </div>}
                      </div>;
                    })}
                    {!cadastro.linhas.some(item => item.demonstracao === tipoCadastro) && <p className="text-sm text-muted-foreground">Nenhuma linha cadastrada para {TIPOS[tipoCadastro]}.</p>}
                    </>}
                  </div>
                </section>
                <section className="space-y-3">
                  <h3 className="font-semibold">Assinantes</h3>
                  {cadastro.assinantes.map(assinante => (
                    <div key={assinante.id} className="grid items-end gap-3 rounded border p-3 md:grid-cols-4">
                      {(['nome', 'cargo', 'registro'] as const).map(campo => (
                        <label key={campo} className="space-y-1 text-sm"><span>{campo === 'nome' ? 'Nome do assinante *' : campo === 'cargo' ? 'Cargo *' : 'Registro profissional (opcional)'}</span>
                          <Input value={assinante[campo]} onChange={event => atualizar({ ...cadastro, assinantes: cadastro.assinantes.map(item => item.id === assinante.id ? { ...item, [campo]: event.target.value } : item) })} />
                        </label>
                      ))}
                      <Button variant="outline" onClick={() => atualizar({ ...cadastro, assinantes: cadastro.assinantes.filter(item => item.id !== assinante.id) })}>Remover assinante</Button>
                    </div>
                  ))}
                  <Button variant="outline" onClick={() => atualizar({ ...cadastro, assinantes: [...cadastro.assinantes, { id: crypto.randomUUID(), nome: '', cargo: '', registro: '' }] })}>Adicionar assinante</Button>
                </section>
                <Button onClick={() => salvar(cadastro)}>{salvando ? 'Salvando...' : 'Salvar cadastro'}</Button>
              </fieldset>
            ) : (
              <section className="space-y-4" aria-label={`Demonstração ${TIPOS[aba]}`}>
                {aba === 'dfc' && <div role="group" aria-label="Método da DFC" className="flex flex-wrap items-center gap-2 rounded border bg-muted/30 p-3">
                  <span className="mr-2 text-sm font-medium">Método:</span>
                  <Button variant={metodoDfc === 'direto' ? 'default' : 'outline'} aria-pressed={metodoDfc === 'direto'} onClick={() => setMetodoDfc('direto')}>Direto</Button>
                  <Button variant={metodoDfc === 'indireto' ? 'default' : 'outline'} aria-pressed={metodoDfc === 'indireto'} onClick={() => setMetodoDfc('indireto')}>Indireto</Button>
                </div>}
                {aba === 'dre' && selectedMonth !== 0 && <div role="group" aria-label="Período da DRE" className="flex flex-wrap items-center gap-2 rounded border bg-muted/30 p-3">
                  <span className="mr-2 text-sm font-medium">Período da DRE:</span>
                  <Button variant={periodoDre === 'mes' ? 'default' : 'outline'} aria-pressed={periodoDre === 'mes'} onClick={() => setPeriodoDre('mes')}>
                    Mês ({rotuloPeriodo(principal)})
                  </Button>
                  <Button variant={periodoDre === 'acumulado' ? 'default' : 'outline'} aria-pressed={periodoDre === 'acumulado'} onClick={() => setPeriodoDre('acumulado')}>
                    Acumulado (Jan–{MESES[selectedMonth]}/{String(selectedYear).slice(-2)})
                  </Button>
                </div>}
                {aba === 'dre' && <Button variant={mostrarPercentualDre ? 'default' : 'outline'} aria-pressed={mostrarPercentualDre}
                  onClick={() => setMostrarPercentualDre(value => !value)}>
                  {mostrarPercentualDre ? 'Ocultar % da Receita Líquida de Vendas' : 'Mostrar % da Receita Líquida de Vendas'}
                </Button>}
                {aba === 'dfc' && selectedMonth !== 0 && <div role="group" aria-label="Período da DFC" className="flex flex-wrap items-center gap-2 rounded border bg-muted/30 p-3">
                  <span className="mr-2 text-sm font-medium">Período da DFC:</span>
                  <Button variant={periodoDfc === 'mes' ? 'default' : 'outline'} aria-pressed={periodoDfc === 'mes'} onClick={() => setPeriodoDfc('mes')}>
                    Mês ({rotuloPeriodo(principal)})
                  </Button>
                  <Button variant={periodoDfc === 'acumulado' ? 'default' : 'outline'} aria-pressed={periodoDfc === 'acumulado'} onClick={() => setPeriodoDfc('acumulado')}>
                    Acumulado (Jan–{MESES[selectedMonth]}/{String(selectedYear).slice(-2)})
                  </Button>
                </div>}
                <div className="space-y-3 rounded border bg-muted/30 p-3">
                  <p className="text-sm font-medium">{selectedMonth === 0 ? 'Comparação anual' : 'Comparação por ano'} — inclua até três anos e ajuste a ordem das colunas.</p>
                  {['ativo', 'passivo', 'endividamento'].includes(aba) && <p className="text-xs text-muted-foreground">Os valores patrimoniais são saldos na data correspondente de cada ano; não são acumulados.</p>}
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="space-y-1 text-sm"><span className="block">Ano para adicionar</span>
                      <Input aria-label="Ano para adicionar à comparação" type="number" min={1900} max={9999} value={anoAdicionar} onChange={event => setAnoAdicionar(event.target.value)} className="w-32" />
                    </label>
                    <Button variant="outline" onClick={adicionarAnoComparacao} disabled={periodosComparados.length >= 3}>Adicionar ano</Button>
                  </div>
                  <div className="space-y-2">
                    {periodosComparados.map((periodo, index) => (
                      <div key={periodo.ano} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background p-2 text-sm">
                        <span className="font-medium">{selectedMonth === 0 ? `Ano/${periodo.ano}` : `${MESES[selectedMonth]}/${String(periodo.ano).slice(-2)}`}</span>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" aria-label={`Subir ${periodo.ano}`} disabled={index === 0} onClick={() => moverAnoComparacao(periodo.ano, -1)}>↑</Button>
                          <Button variant="outline" size="sm" aria-label={`Descer ${periodo.ano}`} disabled={index === periodosComparados.length - 1} onClick={() => moverAnoComparacao(periodo.ano, 1)}>↓</Button>
                          <Button variant="outline" size="sm" aria-label={`Remover ${periodo.ano}`} disabled={periodosComparados.length <= 1} onClick={() => removerAnoComparacao(periodo.ano)}>Remover</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <header className="space-y-1 py-3 text-center">
                  <h3 className="text-lg font-semibold">{cadastro.empresa.nome || 'Cadastre o nome da empresa'}</h3>
                  {cadastro.empresa.cnpj && <p className="text-sm">CNPJ: {cadastro.empresa.cnpj}{cadastro.empresa.nire && ` · NIRE: ${cadastro.empresa.nire}`}</p>}
                  <p className="font-medium">{aba === 'dfc' && metodoDfc === 'indireto'
                    ? 'Demonstração dos Fluxos de Caixa — Método Indireto'
                    : titulosDemonstracoes[aba]}</p>
                  <p className="text-xs text-muted-foreground">Valores em R$</p>
                </header>
                {faltantes.length > 0 && <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Balancetes não importados: {faltantes.map(rotuloPeriodo).join(', ')}. As colunas afetadas ficam indisponíveis.</p>}
                {contasAusentes.length > 0 && <p role="alert" className="text-sm text-amber-800">Contas cadastradas ausentes em algum período: {contasAusentes.join(', ')}. O saldo dessas contas é considerado zero nos períodos em que não constam.</p>}
                {contasIncompletasVinculadas.length > 0 && <p role="alert" className="text-sm text-amber-800">Existem contas incompletas/agrupadoras vinculadas: {contasIncompletasVinculadas.map(item => item.referencia).join(', ')}. Substitua-as por contas completas em Cadastros. Os valores afetados ficam indisponíveis.</p>}
                {aba === 'dre' && mostrarPercentualDre && !linhaBasePercentualDre && <p role="status" className="text-sm text-amber-800">
                  Não foi possível identificar uma única linha “Receita Líquida de Vendas” para calcular os percentuais. Confira o nome da linha na aba Cadastros.
                </p>}
                {contasNaoClassificadas.length > 0 && <p role="status" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  {contasNaoClassificadas.length === 1 ? 'Existe 1 conta de resultado' : `Existem ${contasNaoClassificadas.length} contas de resultado`} com movimento que não {contasNaoClassificadas.length === 1 ? 'está' : 'estão'} em nenhum grupo da DRE. Veja o quadro "Contas com movimento não classificadas" abaixo da tabela.
                </p>}
                {aba === 'dfc' && cadastro && dados && !erroDados && <p role="status" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  {contasDfcPendentes.length === 0
                    ? faltantes.length > 0
                      ? 'Importe os balancetes pendentes para confirmar se há contas sem classificação na DFC.'
                      : 'Nenhuma conta com movimento pendente de classificação na DFC.'
                    : `${contasDfcPendentes.length} ${contasDfcPendentes.length === 1 ? 'conta com movimento' : 'contas com movimento'} precisam de revisão. Veja o quadro de classificação abaixo da demonstração.`}
                </p>}
                {!dados && !erroDados ? <p role="status">Carregando balancetes...</p> : !erroDados && (
                  aba === 'dfc' && metodoDfc === 'indireto' ? <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">DFC Indireto — {colunas.map(coluna => coluna.titulo).join(' e ')}</caption>
                      <thead><tr className="border-y bg-muted/50"><th scope="col" className="p-3 text-left">Descrição</th>{colunas.map((coluna, index) => <th key={index} scope="col" className="whitespace-nowrap p-3 text-right">{coluna.titulo}</th>)}</tr></thead>
                      <tbody>
                        {linhasDfcIndiretoTabela.map(linha => {
                          const tipoLinha = linha.tipo === 'titulo' || linha.tipo === 'grupo';
                          const contas = linha.tipo === 'conta'
                            ? [...new Map(resultadosDfcIndireto.flatMap(resultado => resultado.contasPorLinha.get(linha.id) ?? [])
                              .map(conta => [conta.conta, conta])).values()].sort((a, b) => a.conta.localeCompare(b.conta, 'pt-BR', { numeric: true }))
                            : [];
                          const expandido = gruposExpandidos.has(linha.id);
                          return <Fragment key={linha.id}>
                            <tr className={linha.tipo === 'total' || linha.tipo === 'subtotal'
                              ? 'border-y bg-muted/60 font-bold'
                              : linha.tipo === 'titulo' ? 'border-y bg-muted/40 font-semibold' : 'border-b'}>
                              <th scope="row" className={`p-3 text-left ${linha.tipo === 'conta' ? 'font-normal' : ''}`}>
                                {linha.tipo === 'conta' && contas.length > 0 && <button type="button" className="mr-2 inline-flex rounded p-1 hover:bg-muted focus-visible:outline focus-visible:outline-2"
                                  aria-label={`${expandido ? 'Ocultar' : 'Exibir'} contas de ${linha.nome}`}
                                  aria-expanded={expandido} onClick={() => alternarExpandido(linha.id, setGruposExpandidos)}>
                                  {expandido ? <ChevronDown aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}
                                </button>}
                                {linha.nome}
                              </th>
                              {colunas.map((_, index) => {
                                const valor = tipoLinha ? null : resultadosDfcIndireto[index]?.valores.get(linha.id) ?? null;
                                return <td key={index} className={`whitespace-nowrap p-3 text-right tabular-nums ${valor !== null && valor < 0 ? 'text-red-700' : ''}`}>
                                  {tipoLinha || valor === null ? '' : formatarMoeda(valor)}
                                </td>;
                              })}
                            </tr>
                            {linha.tipo === 'conta' && expandido && contas.map(conta => (
                              <tr key={`${linha.id}-${conta.conta}`} className="border-b bg-muted/20">
                                <th scope="row" className="p-3 pl-12 text-left font-normal text-muted-foreground">{conta.conta} — {conta.desc}</th>
                                {colunas.map((_, colunaIndex) => {
                                  const contaDaColuna = resultadosDfcIndireto[colunaIndex]?.valoresContasPorLinha.get(linha.id)?.get(conta.conta) ?? null;
                                  return <td key={colunaIndex} className={`whitespace-nowrap p-3 text-right tabular-nums ${contaDaColuna !== null && contaDaColuna < 0 ? 'text-red-700' : ''}`}>
                                    {contaDaColuna === null ? '—' : formatarMoeda(contaDaColuna)}
                                  </td>;
                                })}
                              </tr>
                            ))}
                          </Fragment>;
                        })}
                      </tbody>
                    </table>
                  </div> : <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">{TIPOS[aba]} — {colunas.map(coluna => coluna.titulo).join(' e ')}</caption>
                      <thead><tr className="border-y bg-muted/50"><th scope="col" className="p-3 text-left">Descrição</th>{colunas.map((coluna, index) => <th key={index} scope="col" className="whitespace-nowrap p-3 text-right">{coluna.titulo}</th>)}</tr></thead>
                      <tbody>
                        {linhasTabela.map(({ linha, subtotal }) => {
                          const ocultarValor = aba === 'dfc' && Boolean(linha.dfcSubtotalNome) && !subtotal;
                          const contasPrefixadas = linha.contasPorPrefixo && dados
                            ? listarContasDaLinha(linha, detalhesColunas.flatMap(detalhe => detalhe.periodos))
                            : [];
                          const itensDetalhe = contasPrefixadas.length > 0
                            ? contasPrefixadas.map(({ item, conta }) => ({
                              referencia: conta.conta,
                              operacao: item.operacao,
                              descricao: conta.desc,
                            }))
                            : linha.itens.map(item => ({
                              ...item,
                              descricao: descricoes.get(item.referencia) ?? 'Descrição indisponível no balancete carregado',
                            }));
                          return <Fragment key={subtotal ? `${linha.id}-subtotal` : linha.id}><tr className={subtotal ? 'border-y bg-muted/60 font-bold' : linha.tipo === 'total' ? 'border-y bg-muted/40 font-semibold' : 'border-b'}>
                            <th scope="row" aria-label={subtotal ? linha.dfcSubtotalNome ?? linha.nome : linha.nome} className={`p-3 text-left font-inherit ${linhaPai(linha) ? 'pl-8' : ''}`}>
                              {linha.tipo === 'contas' && !linha.calculo && <button type="button" className="mr-2 inline-flex rounded p-1 hover:bg-muted focus-visible:outline focus-visible:outline-2"
                                aria-label={`${gruposExpandidos.has(linha.id) ? 'Ocultar' : 'Exibir'} contas de ${linha.nome}`}
                                aria-expanded={gruposExpandidos.has(linha.id)} onClick={() => alternarExpandido(linha.id, setGruposExpandidos)}>
                                {gruposExpandidos.has(linha.id) ? <ChevronDown aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}
                              </button>}
                              {subtotal ? linha.dfcSubtotalNome : linha.nome}
                            </th>
                            {colunas.map((coluna, index) => {
                              const valor = valores[index]?.get(linha.id);
                              const periodo = coluna.periodos[0];
                              const podeEditarCaptacao = aba === 'endividamento' && linha.bancoDe && principal.mes > 0
                                && periodo.ano === principal.ano && periodo.mes === principal.mes;
                              const captacao = linha.captacao;
                              const restantes = captacao?.restantesPorMes[chavePeriodo(principal)];
                              const juros = captacao?.jurosProvisionadosPorMes?.[chavePeriodo(principal)];
                              const receitaLiquida = linhaBasePercentualDre
                                ? valores[index]?.get(linhaBasePercentualDre.id)
                                : null;
                              const percentualReceitaLiquida = aba === 'dre' && mostrarPercentualDre
                                && linhaBasePercentualDre && valor !== null && valor !== undefined
                                ? receitaLiquida !== null && receitaLiquida !== undefined && receitaLiquida !== 0
                                  ? `${percentual.format((valor / receitaLiquida) * 100)}%`
                                  : '—'
                                : null;
                              return <td key={index} className="whitespace-nowrap p-3 text-right tabular-nums">
                                {!ocultarValor && <span className={valor !== null && valor !== undefined && valor < 0 ? 'text-red-700' : undefined}>{valor === null || valor === undefined ? '—' : formatarMoeda(valor)}</span>}
                                {percentualReceitaLiquida && <div className="text-xs font-normal text-muted-foreground">{percentualReceitaLiquida}</div>}
                                {podeEditarCaptacao && <>
                                  {captacao && <div className="mt-1 whitespace-normal text-xs text-muted-foreground">
                                    {captacao.data && <p>Data da captação: {captacao.data.split('-').reverse().join('/')}</p>}
                                    {captacao.valorCentavos !== undefined && <p>Valor da captação: R$ {moedaComCentavos.format(captacao.valorCentavos / 100)}</p>}
                                    {captacao.taxa && <p>Taxa: {captacao.taxa}</p>}
                                    {captacao.parcelasTotais !== undefined && <p>Total de parcelas: {captacao.parcelasTotais}</p>}
                                    {restantes !== undefined && <p>Parcelas restantes: {restantes}</p>}
                                    {juros !== undefined && <p>Juros Provisionados: R$ {moedaComCentavos.format(juros / 100)}</p>}
                                  </div>}
                                  <Button variant="ghost" size="sm" aria-label={`Editar captação de ${linha.nome}`} onClick={() => abrirCaptacao(linha)}>Editar captação</Button>
                                </>}
                              </td>;
                            })}
                          </tr>
                          {linha.tipo === 'contas' && !linha.calculo && !subtotal && gruposExpandidos.has(linha.id) && (aba === 'dfc'
                            ? contasDfcPorLinha.get(linha.id) ?? []
                            : itensDetalhe).map(item => <tr key={item.referencia} className="border-b bg-muted/20">
                            <th scope="row" className={`p-3 text-left font-normal text-muted-foreground ${linhaPai(linha) ? 'pl-16' : 'pl-12'}`}>
                              {aba === 'dfc' ? descricaoConta(item) : `${item.referencia} — ${'descricao' in item ? item.descricao : ''}`}
                            </th>
                            {colunas.map((_, index) => {
                              const detalhe = detalhesColunas[index];
                              const valor = detalhe ? calcularConta(item, aba, detalhe.periodos, detalhe.incompletas) : null;
                              return <td key={index} className={`whitespace-nowrap p-3 text-right tabular-nums ${valor !== null && valor < 0 ? 'text-red-700' : ''}`}>{valor === null ? '—' : formatarMoeda(valor)}</td>;
                            })}
                          </tr>)}
                          </Fragment>;
                        })}
                        {linhasTabela.length === 0 && <tr><td colSpan={colunas.length + 1} className="p-6 text-center text-muted-foreground">Nenhum grupo cadastrado. Configure as linhas na aba Cadastros.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
                {aba === 'passivo' && cadastro && dados && <section aria-label="Conferências do balanço" className="space-y-3 rounded border p-3">
                  <div>
                    <h3 className="font-semibold">Conferências do balanço</h3>
                    <p className="text-sm text-muted-foreground">O resultado do período integra o Patrimônio Líquido. A conferência da DRE compara o resultado do balancete com o lucro líquido acumulado desde janeiro.</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    {[
                      { nome: 'Ativo – (Passivo + PL)', campo: 'balanco' as const },
                      { nome: 'Resultado do balancete – Lucro líquido da DRE', campo: 'resultado' as const },
                    ].map(conferencia => <div key={conferencia.campo} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
                      <span className="font-medium">{conferencia.nome}</span>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                        {colunas.map((coluna, index) => <span key={index}>{coluna.titulo}: {formatarMoedaComCentavos(conferenciasBalanco[index]?.[conferencia.campo] ?? null)}</span>)}
                      </div>
                    </div>)}
                  </div>
                  {!linhaLucroDre && <p role="alert" className="text-sm text-amber-800">Não foi encontrada uma linha principal da DRE chamada “LUCRO LÍQUIDO DO EXERCÍCIO”. Cadastre essa linha para habilitar a conferência do resultado.</p>}
                  {periodosDreFaltantes.length > 0 && <p role="status" className="text-sm text-amber-800">A conferência da DRE aguarda balancetes de: {periodosDreFaltantes.join(', ')}.</p>}
                  {contasResultadoSemDre.length > 0 && <details className="rounded border border-amber-300 p-3">
                    <summary className="cursor-pointer text-sm font-medium">Contas de resultado sem linha na DRE ({contasResultadoSemDre.length})</summary>
                    <ul className="mt-3 space-y-2 text-sm">
                      {contasResultadoSemDre.map(conta => <li key={conta.conta} className="border-b pb-2">
                        <span className="font-medium">{conta.conta} — {conta.desc}</span>
                        <div className="flex flex-wrap gap-x-4 text-muted-foreground tabular-nums">
                          {conta.valores.map((valor, index) => <span key={index}>{colunas[index].titulo}: {formatarMoedaComCentavos(valor)}</span>)}
                        </div>
                      </li>)}
                    </ul>
                  </details>}
                </section>}
                {aba === 'dfc' && cadastro && dados && <section aria-label="Caixa e equivalentes" className="space-y-3 rounded border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Caixa e equivalentes</h3>
                      <p className="text-sm text-muted-foreground">A variação real compara o saldo anterior do primeiro mês exibido com o saldo atual do último. O prefixo 1.1.1 vem pré-selecionado; você pode alterar e salvar as contas consideradas neste quadro.</p>
                    </div>
                    <Button variant="outline" onClick={editarContasCaixaEquivalentes}>Editar contas de caixa/equivalentes</Button>
                  </div>
                  {conciliacoesCaixa.every(item => item.saldoInicial === null) && <p role="status" className="text-sm text-amber-800">
                    Confira se há contas de caixa/equivalentes selecionadas e balancetes disponíveis para o período.
                  </p>}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-y bg-muted/50"><th scope="col" className="p-3 text-left">Descrição</th>{colunas.map((coluna, index) => <th key={index} scope="col" className="whitespace-nowrap p-3 text-right">{coluna.titulo}</th>)}</tr></thead>
                      <tbody>{linhasConciliacaoCaixa.map((linha, linhaIndex) => (
                        <tr key={linha.nome} className={linhaIndex === 0 || linhaIndex === linhasConciliacaoCaixa.length - 1 ? 'border-y bg-muted/40 font-semibold' : 'border-b'}>
                          <th scope="row" className="p-3 text-left">{linha.nome}</th>
                          {colunas.map((_, index) => <td key={index} className="whitespace-nowrap p-3 text-right tabular-nums">
                            {formatarMoedaComCentavos(linha.valores[index] ?? null)}
                          </td>)}
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </section>}
                {aba === 'dfc' && metodoDfc === 'indireto' && resultadosDfcIndireto.length > 0 && <section aria-label="Conferência da DFC indireta" className="space-y-3 rounded border p-3">
                  <div>
                    <h3 className="font-semibold">Conferência com o método direto</h3>
                    <p className="text-sm text-muted-foreground">As diferenças entre os métodos devem ser zero. Contas operacionais sem linha no indireto precisam ser classificadas para fechar a ponte entre o resultado e o caixa.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-y bg-muted/50"><th scope="col" className="p-3 text-left">Descrição</th>{colunas.map((coluna, index) => <th key={index} scope="col" className="whitespace-nowrap p-3 text-right">{coluna.titulo}</th>)}</tr></thead>
                      <tbody>
                        {[
                          { nome: 'Caixa operacional: indireto − direto', chave: 'diferenca-operacional', tipo: 'valor' },
                          { nome: 'Variação de caixa: indireto − direto', chave: 'diferenca-total', tipo: 'valor' },
                          { nome: 'Contas operacionais sem linha no indireto', chave: 'contas-sem-linha', tipo: 'quantidade' },
                        ].map(linha => <tr key={linha.chave} className="border-b">
                          <th scope="row" className="p-3 text-left">{linha.nome}</th>
                          {colunas.map((_, index) => {
                            const resultado = resultadosDfcIndireto[index];
                            const valor = linha.tipo === 'quantidade'
                              ? resultado?.contasOperacionaisSemLinha ?? null
                              : resultado?.valores.get(linha.chave) ?? null;
                            return <td key={index} className="whitespace-nowrap p-3 text-right tabular-nums">
                              {valor === null ? '—' : linha.tipo === 'quantidade' ? valor : formatarMoedaComCentavos(valor)}
                            </td>;
                          })}
                        </tr>)}
                        <tr className="border-y bg-muted/40 font-semibold">
                          <th scope="row" className="p-3 text-left">Status</th>
                          {colunas.map((_, index) => {
                            const resultado = resultadosDfcIndireto[index];
                            const operacional = resultado?.valores.get('diferenca-operacional');
                            const total = resultado?.valores.get('diferenca-total');
                            return <td key={index} className="p-3 text-right">
                              {operacional === null || operacional === undefined || total === null || total === undefined
                                ? '—'
                                : operacional === 0 && total === 0 ? 'OK — métodos convergem' : 'Verificar mapeamento'}
                            </td>;
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>}
                {aba === 'dfc' && <section aria-label="Notas explicativas da DFC" className="space-y-3 rounded border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Notas explicativas</h3>
                      <p className="text-sm text-muted-foreground">
                        {metodoDfc === 'direto' ? 'Método Direto' : 'Método Indireto'} · {tituloPeriodoNotaDfc}.
                        {' '}As notas não alteram os valores da demonstração.
                      </p>
                    </div>
                    <Button variant="outline" disabled={carregandoNotasDfc || !documentoNotasDfc || salvandoNotasDfc || documentoNotasDfc.notas.length >= 50}
                      onClick={() => abrirEditorNotaDfc()}>
                      Adicionar nota
                    </Button>
                  </div>
                  {documentoNotasDfc?.notas.length === 50 && <p className="text-xs text-muted-foreground">Limite de 50 notas atingido para este método e período.</p>}
                  {carregandoNotasDfc && <p role="status" className="text-sm text-muted-foreground">Carregando notas...</p>}
                  {erroNotasDfc && <div className="flex flex-wrap items-center gap-3">
                    <p role="alert" className="text-sm text-red-700">{erroNotasDfc}</p>
                    {!documentoNotasDfc && <Button variant="outline" size="sm" onClick={() => setTentativaNotasDfc(value => value + 1)}>Tentar novamente</Button>}
                  </div>}
                  {documentoNotasDfc && documentoNotasDfc.notas.length === 0 && !carregandoNotasDfc && <p className="text-sm text-muted-foreground">Nenhuma nota explicativa cadastrada para este método e período.</p>}
                  {documentoNotasDfc && documentoNotasDfc.notas.length > 0 && <ol className="space-y-2">
                    {documentoNotasDfc.notas.map((nota, index) => {
                      const linha = linhasDisponiveisNotaDfc.find(item => item.id === nota.linhaId);
                      const referencia = linha?.nome ?? nota.linhaNome ?? 'Linha da DFC não disponível';
                      return <li key={nota.id} className="flex flex-wrap items-start justify-between gap-3 rounded border bg-muted/20 p-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm font-medium">{index + 1}. {nota.linhaId ? referencia : 'Nota geral'}</p>
                          <p className="whitespace-pre-wrap break-words text-sm">{nota.texto}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={salvandoNotasDfc}
                            aria-label={`Editar nota ${index + 1}`} onClick={() => abrirEditorNotaDfc(nota)}>Editar</Button>
                          <Button variant="outline" size="sm" disabled={salvandoNotasDfc}
                            aria-label={`Excluir nota ${index + 1}`} onClick={() => { setErroNotasDfc(''); setNotaExcluirId(nota.id); }}>Excluir</Button>
                        </div>
                      </li>;
                    })}
                  </ol>}
                </section>}
                {contasNaoClassificadas.length > 0 && <section aria-label="Contas com movimento não classificadas" className="rounded border border-amber-300">
                  <button type="button" aria-expanded={naoClassificadasAberto} onClick={() => setNaoClassificadasAberto(value => !value)}
                    className="flex w-full items-center gap-2 bg-amber-50 p-3 text-left text-sm font-semibold text-amber-900 hover:bg-amber-100">
                    {naoClassificadasAberto ? <ChevronDown aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}
                    Contas com movimento não classificadas ({contasNaoClassificadas.length})
                  </button>
                  {naoClassificadasAberto && <div className="overflow-x-auto">
                    <p className="p-3 text-xs text-muted-foreground">Contas analíticas dos grupos 3, 4, 5 e 6 com movimento líquido (créditos − débitos) no período exibido que não estão vinculadas a nenhum grupo da DRE. Inclua-as em Cadastros para que entrem na demonstração.</p>
                    <table className="w-full text-sm">
                      <thead><tr className="border-y bg-muted/50"><th scope="col" className="p-3 text-left">Conta</th>{colunas.map((coluna, index) => <th key={index} scope="col" className="whitespace-nowrap p-3 text-right">{coluna.titulo}</th>)}</tr></thead>
                      <tbody>
                        {contasNaoClassificadas.map(conta => <tr key={conta.conta} className="border-b">
                          <th scope="row" className="p-3 text-left font-normal">{conta.conta} — {conta.desc}</th>
                          {conta.valores.map((valor, index) => <td key={index} className={`whitespace-nowrap p-3 text-right tabular-nums ${valor !== null && valor < 0 ? 'text-red-700' : ''}`}>{valor === null ? '—' : formatarMoeda(valor)}</td>)}
                        </tr>)}
                        <tr className="border-y bg-muted/40 font-semibold">
                          <th scope="row" className="p-3 text-left">Total não classificado</th>
                          {colunas.map((_, index) => {
                            const valores = contasNaoClassificadas.map(conta => conta.valores[index]);
                            const total = valores.some(valor => valor === null) ? null : valores.reduce<number>((soma, valor) => soma + Math.round((valor ?? 0) * 100), 0) / 100;
                            return <td key={index} className={`whitespace-nowrap p-3 text-right tabular-nums ${total !== null && total < 0 ? 'text-red-700' : ''}`}>{total === null ? '—' : formatarMoeda(total)}</td>;
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>}
                </section>}
                {aba === 'dfc' && linhasForaTabela.length > 0 && <section aria-label="Contas fora da DFC" className="space-y-3 rounded border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Contas fora da DFC</h3>
                      <p className="text-sm text-muted-foreground">Caixa, PL e compensações ficam visíveis para conferência, mas não entram nos totais das atividades.</p>
                    </div>
                    <Button variant="outline" onClick={() => { setTipoCadastro('dfc'); setAba('cadastros'); }}>Editar contas fora da DFC</Button>
                  </div>
                  {linhasForaTabela.filter(linha => !linhaPai(linha)).map(raiz => (
                    <div key={raiz.id} className="space-y-2">
                      <h4 className="font-medium">{raiz.nome}</h4>
                      {linhasForaTabela.filter(linha => linhaPai(linha) === raiz.id).map(grupo => {
                        const contas = contasDfcPorLinha.get(grupo.id) ?? [];
                        return <details key={grupo.id} className="rounded border px-3">
                          <summary className="cursor-pointer py-2 text-sm font-medium">{grupo.nome} ({contas.length} {contas.length === 1 ? 'conta' : 'contas'})</summary>
                          {contas.length === 0 ? <p className="pb-3 text-sm text-muted-foreground">Nenhuma conta correspondente no balancete carregado.</p>
                            : <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead><tr className="border-y bg-muted/50"><th scope="col" className="p-3 text-left">Conta</th>{colunas.map((coluna, index) => <th key={index} scope="col" className="whitespace-nowrap p-3 text-right">{coluna.titulo}</th>)}</tr></thead>
                                <tbody>{contas.map(item => <tr key={item.referencia} className="border-b">
                                  <th scope="row" className="p-3 text-left font-normal">{descricaoConta(item)}</th>
                                  {colunas.map((_, index) => {
                                    const detalhe = detalhesColunas[index];
                                    const valor = detalhe ? calcularConta(item, 'dfc', detalhe.periodos, detalhe.incompletas) : null;
                                    return <td key={index} className={`whitespace-nowrap p-3 text-right tabular-nums ${valor !== null && valor < 0 ? 'text-red-700' : ''}`}>{valor === null ? '—' : formatarMoeda(valor)}</td>;
                                  })}
                                </tr>)}</tbody>
                              </table>
                            </div>}
                        </details>;
                      })}
                    </div>
                  ))}
                </section>}
                {aba === 'dfc' && contasDfcPendentes.length > 0 && <section aria-label="Contas com movimento sem classificação na DFC" className="rounded border border-amber-300">
                  <button type="button" aria-expanded={contasDfcPendentesAberto} onClick={() => setContasDfcPendentesAberto(value => !value)}
                    className="flex w-full items-center gap-2 bg-amber-50 p-3 text-left text-sm font-semibold text-amber-900 hover:bg-amber-100">
                    {contasDfcPendentesAberto ? <ChevronDown aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}
                    Contas com movimento sem classificação na DFC ({contasDfcPendentes.length})
                  </button>
                  {contasDfcPendentesAberto && <div className="overflow-x-auto">
                    <p className="p-3 text-xs text-muted-foreground">
                      A lista inclui contas com movimento que não têm classificação no método direto ou contas operacionais sem linha de variação no indireto. As sugestões usam contas próximas no plano de contas; confira a evidência antes de aceitar. Para excluir uma conta intencionalmente, classifique-a como “Fora da DFC”.
                    </p>
                    <table className="w-full text-sm">
                      <thead><tr className="border-y bg-muted/50">
                        <th scope="col" className="p-3 text-left">Conta</th>
                        <th scope="col" className="min-w-52 p-3 text-left">DFC Direto</th>
                        <th scope="col" className="min-w-64 p-3 text-left">DFC Indireto</th>
                        <th scope="col" className="min-w-72 p-3 text-left">Sugestão de classificação</th>
                        {colunas.map((coluna, index) => <th key={index} scope="col" className="whitespace-nowrap p-3 text-right">{coluna.titulo}</th>)}
                      </tr></thead>
                      <tbody>{contasDfcPendentes.map(conta => {
                        const temSugestao = Boolean(conta.sugestaoDireta || conta.sugestaoIndireta);
                        return <tr key={conta.conta} className="border-b align-top">
                          <th scope="row" className="min-w-56 p-3 text-left font-normal">{conta.conta} — {conta.desc}</th>
                          <td className="min-w-52 p-3">{conta.statusDireto}</td>
                          <td className="min-w-64 p-3">{conta.statusIndireto}</td>
                          <td className="min-w-72 space-y-2 p-3">
                            {conta.sugestaoDireta && <div>
                              <p><span className="font-medium">Direto:</span> {conta.sugestaoDireta.nome}</p>
                              <p className="text-xs text-muted-foreground">Semelhante a: {conta.sugestaoDireta.contasSemelhantes.map(item => `${item.conta} — ${item.desc}`).join('; ')}</p>
                            </div>}
                            {conta.sugestaoIndireta && <div>
                              <p><span className="font-medium">Indireto:</span> {conta.sugestaoIndireta.nome}</p>
                              <p className="text-xs text-muted-foreground">Semelhante a: {conta.sugestaoIndireta.contasSemelhantes.map(item => `${item.conta} — ${item.desc}`).join('; ')}</p>
                            </div>}
                            {temSugestao
                              ? <Button size="sm" disabled={salvando} onClick={() => { void aceitarSugestaoDfc(conta); }}>Aceitar e salvar</Button>
                              : <p className="text-xs text-muted-foreground">Sem sugestão confiável; classifique manualmente em Cadastros → DFC.</p>}
                          </td>
                          {conta.valores.map((valor, index) => <td key={index} className={`whitespace-nowrap p-3 text-right tabular-nums ${valor !== null && valor < 0 ? 'text-red-700' : ''}`}>{valor === null ? '—' : formatarMoeda(valor)}</td>)}
                        </tr>;
                      })}</tbody>
                    </table>
                  </div>}
                </section>}
                <p className="text-xs text-muted-foreground">{aba === 'dre'
                  ? `DRE: movimento líquido (créditos − débitos), preservando o sinal contábil e os estornos; ${selectedMonth === 0 || periodoDre === 'acumulado' ? 'acumulado de janeiro até o mês selecionado' : 'somente o mês selecionado'}. Grupos e totalizações somam os valores com seus sinais automaticamente.`
                  : aba === 'dfc'
                    ? metodoDfc === 'indireto'
                      ? `DFC Indireto: resultado líquido mais ajustes e variações do balanço; investimento e financiamento acompanham as linhas do método direto. ${selectedMonth === 0 || periodoDfc === 'acumulado' ? 'Acumulado de janeiro até o mês selecionado.' : 'Somente o mês selecionado.'}`
                      : `DFC Direto: cada conta analítica usa Crédito − Débito; ${selectedMonth === 0 || periodoDfc === 'acumulado' ? 'acumulado de janeiro até o mês selecionado' : 'somente o mês selecionado'}. A linha é definida pelo prefixo cadastrado mais longo.`
                    : 'Patrimonial: valor absoluto do saldo atual de cada conta em cada data, sem somar saldos mensais. O sinal de cada conta é definido por Somar/Subtrair no cadastro.'}</p>
                {cadastro.assinantes.length > 0 && <div className="grid gap-8 pt-12 sm:grid-cols-2">
                  {cadastro.assinantes.map(assinante => <div key={assinante.id} className="border-t pt-2 text-center text-sm">
                    <p className="font-medium">{assinante.nome}</p><p>{assinante.cargo}</p>{assinante.registro && <p>{assinante.registro}</p>}
                  </div>)}
                </div>}
              </section>
            )}
          </>
        )}
        <Dialog open={editorNotaDfc !== null} onOpenChange={open => {
          if (!open && !salvandoNotasDfc) { setEditorNotaDfc(null); setErroNotasDfc(''); }
        }}>
          {editorNotaDfc && <DialogContent>
            <DialogHeader>
              <DialogTitle>{editorNotaDfc.id ? 'Editar nota explicativa' : 'Adicionar nota explicativa'}</DialogTitle>
              <DialogDescription>A nota será salva para {metodoDfc === 'direto' ? 'o método Direto' : 'o método Indireto'} e {tituloPeriodoNotaDfc}. Ela não altera os valores da DFC.</DialogDescription>
            </DialogHeader>
            <fieldset disabled={salvandoNotasDfc} className="space-y-4">
              <label className="space-y-1 text-sm">
                <span className="block">Linha da DFC (opcional)</span>
                <select className={`${selectClass} w-full`} value={editorNotaDfc.linhaId}
                  onChange={event => {
                    const linhaId = event.target.value;
                    const linhaNome = linhasDisponiveisNotaDfc.find(item => item.id === linhaId)?.nome;
                    setEditorNotaDfc({ ...editorNotaDfc, linhaId, linhaNome });
                  }}>
                  <option value="">Nota geral — sem linha específica</option>
                  {editorNotaDfc.linhaId && !linhasDisponiveisNotaDfc.some(item => item.id === editorNotaDfc.linhaId)
                    && <option value={editorNotaDfc.linhaId}>{editorNotaDfc.linhaNome ?? 'Linha não disponível'}</option>}
                  {linhasDisponiveisNotaDfc.map(linha => <option key={linha.id} value={linha.id}>{linha.nome}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="block">Texto da nota</span>
                <Textarea aria-label="Texto da nota explicativa" maxLength={5000} rows={6} value={editorNotaDfc.texto}
                  onChange={event => setEditorNotaDfc({ ...editorNotaDfc, texto: event.target.value })}
                  placeholder="Descreva o evento, a variação ou o contexto que deseja explicar." />
                <span className="block text-right text-xs text-muted-foreground">{editorNotaDfc.texto.length}/5.000 caracteres</span>
              </label>
            </fieldset>
            {erroNotasDfc && <p role="alert" className="text-sm text-red-700">{erroNotasDfc}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={salvandoNotasDfc} onClick={() => { setEditorNotaDfc(null); setErroNotasDfc(''); }}>Cancelar</Button>
              <Button disabled={salvandoNotasDfc} onClick={() => { void salvarNotaDfc(); }}>{salvandoNotasDfc ? 'Salvando...' : 'Salvar nota'}</Button>
            </DialogFooter>
          </DialogContent>}
        </Dialog>
        <AlertDialog open={notaExcluirId !== null} onOpenChange={open => {
          if (!open && !salvandoNotasDfc) setNotaExcluirId(null);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir nota explicativa?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            {erroNotasDfc && <p role="alert" className="text-sm text-red-700">{erroNotasDfc}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={salvandoNotasDfc}>Cancelar</AlertDialogCancel>
              <Button type="button" disabled={salvandoNotasDfc} className="bg-red-600 hover:bg-red-700"
                onClick={() => { void excluirNotaDfc(); }}>
                {salvandoNotasDfc ? 'Excluindo...' : 'Excluir nota'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={linhaExcluir !== null} onOpenChange={open => {
          if (!open && !salvando) setLinhaExcluir(null);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir linha?</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja excluir a linha “{linhaExcluir?.nome}”?
                {linhaExcluir && cadastro?.linhas.some(item => linhaPai(item) === linhaExcluir.id)
                  && ' As sublinhas ou bancos vinculados também serão removidos.'}
                {' A alteração será aplicada ao cadastro em edição. Clique em “Salvar cadastro” para gravá-la. Os balancetes importados não serão excluídos.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {erroAcao && <p role="alert" className="text-sm text-red-700">{erroAcao}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
              <Button type="button" disabled={salvando} className="bg-red-600 hover:bg-red-700" onClick={confirmarExclusaoLinha}>
                Excluir linha
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Dialog open={editorCaptacao !== null} onOpenChange={open => { if (!open && !salvando) setEditorCaptacao(null); }}>
          {editorCaptacao && <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar captação — {editorCaptacao.nome}</DialogTitle>
              <DialogDescription>As parcelas restantes e os juros provisionados são registrados para {rotuloPeriodo(editorCaptacao.periodo)}. Os demais dados valem para a captação.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={event => { event.preventDefault(); void salvarCaptacao(); }}>
              <fieldset disabled={salvando} className="grid gap-3 sm:grid-cols-2">
                {camposCaptacao.map(config => <label key={config.campo} className="space-y-1 text-sm">
                  <span>{config.rotulo}</span>
                  <Input type={config.tipo} min={'min' in config ? config.min : undefined}
                    inputMode={config.campo === 'valor' || config.campo === 'juros' ? 'decimal' : undefined}
                    placeholder={'placeholder' in config ? config.placeholder : undefined} value={editorCaptacao.campos[config.campo]}
                    onChange={event => setEditorCaptacao({ ...editorCaptacao, campos: { ...editorCaptacao.campos, [config.campo]: event.target.value } })} />
                </label>)}
              </fieldset>
              {erroCaptacao && <p role="alert" className="text-sm text-red-700">{erroCaptacao}</p>}
              {alterado && <p className="text-sm text-muted-foreground">Salvar a captação também salva as alterações pendentes do cadastro.</p>}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={salvando} onClick={() => setEditorCaptacao(null)}>Cancelar</Button>
                <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar captação'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>}
        </Dialog>
        <Dialog open={editor !== null} onOpenChange={open => { if (!open) setEditor(null); }}>
          <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-6xl">
            <DialogHeader><DialogTitle>Configurar linha — {editor ? TIPOS[editor.demonstracao] : ''}</DialogTitle><DialogDescription>{bancosEditor
              ? editor?.demonstracao === 'endividamento'
                ? 'Informe o nome da linha principal e adicione os bancos ou dívidas. A linha principal soma os saldos de todos eles.'
                : 'Informe o nome da linha principal e adicione sublinhas com suas contas. A linha principal soma os valores com seus sinais.'
              : editor?.tipo === 'total'
              ? editor.demonstracao === 'dre'
                ? 'Selecione linhas já cadastradas. Na DRE, os sinais são automáticos e as totalizações somam os valores com seus respectivos sinais.'
                : 'Selecione linhas já cadastradas. As totalizações somam os valores com seus sinais contábeis.'
              : editor?.demonstracao === 'dre'
                ? 'Selecione contas completas. Na DRE, os sinais seguem o movimento do balancete automaticamente.'
                : 'Selecione contas completas. O Ativo mantém o saldo do balancete; o Passivo, PL e Endividamento invertem o saldo, sem eliminar seu sinal.'}</DialogDescription></DialogHeader>
            {editor && <>
              <label className="space-y-1 text-sm"><span>{bancosEditor ? 'Nome da linha principal *' : 'Nome da linha *'}</span><Input value={editor.nome} onChange={event => setEditor({ ...editor, nome: event.target.value })} /></label>
              {editor.demonstracao === 'dfc' && !editor.foraDfc && bancosEditor && <label className="space-y-1 text-sm">
                <span>Nome da linha de subtotal após as sublinhas</span>
                <Input aria-label="Nome da linha de subtotal" value={editor.dfcSubtotalNome ?? ''} onChange={event => setEditor({ ...editor, dfcSubtotalNome: event.target.value })} />
              </label>}
              {(editor.demonstracao !== 'endividamento' || !cadastro?.linhas.some(item => item.bancoDe === editor.id)) && <label className="space-y-1 text-sm"><span className="block">Tipo de linha</span>
                <select className={selectClass} value={bancosEditor ? 'bancos' : editor.tipo} onChange={event => {
                  const tipo = event.target.value;
                  if (tipo !== 'bancos' && bancosEditor?.some(banco => banco.calculo)) {
                    setErroEditor('Mantenha a linha principal com sublinhas para preservar o cálculo automático do Resultado do Período.');
                    return;
                  }
                  if (editor.demonstracao !== 'endividamento' && tipo === 'bancos' && editor.tipo === 'total' && !bancosEditor && editor.itens.length) {
                    setErroEditor('Esta totalização já contém linhas. Remova suas referências antes de transformá-la em uma linha com sublinhas.');
                    return;
                  }
                  if (editor.demonstracao !== 'endividamento' && tipo === 'bancos' && editor.tipo === 'contas' && editor.itens.length) {
                    const sublinha: LinhaDemonstracao = { ...editor, id: crypto.randomUUID(), nome: `${editor.nome.trim() || 'Linha'} — contas existentes`, sublinhaDe: editor.id };
                    setBancosEditor([sublinha]);
                    setBancoAtivo(sublinha.id);
                    setErroEditor('');
                    setBusca('');
                    return;
                  }
                  const itens = editor.demonstracao !== 'endividamento' && bancosEditor && tipo === 'contas'
                    ? bancosEditor.flatMap(banco => banco.itens) : [];
                  setBancosEditor(tipo === 'bancos' ? [] : null);
                  escolherBanco('');
                  setEditor({ ...editor, tipo: tipo === 'total' ? 'total' : 'contas', itens });
                }}>
                  {editor.demonstracao === 'endividamento' && <option value="bancos">Linha principal com bancos ou dívidas</option>}
                  {editor.demonstracao !== 'endividamento' && <option value="bancos">Linha principal com sublinhas</option>}
                  <option value="contas">Grupo de contas do balancete</option><option value="total" disabled={editor.demonstracao !== 'endividamento' && Boolean(bancosEditor)}>Totalização de linhas selecionadas</option>
                </select>
              </label>}
              {bancosEditor && <div className="space-y-3 rounded border p-3">
                <div className="flex flex-wrap gap-2">
                  {bancosEditor.map((banco, index) => <Button key={banco.id} variant={banco.id === bancoAtivo ? 'default' : 'outline'} aria-pressed={banco.id === bancoAtivo} onClick={() => escolherBanco(banco.id)}>{banco.nome.trim() || `${editor.demonstracao === 'endividamento' ? 'Banco ou dívida' : 'Sublinha'} ${index + 1}`}</Button>)}
                  <Button variant="outline" onClick={adicionarBanco}>{editor.demonstracao === 'endividamento' ? 'Adicionar banco ou dívida' : 'Adicionar sublinha'}</Button>
                </div>
                {alvoEditor && <div className="flex flex-wrap items-end gap-2">
                  <label className="flex-1 space-y-1 text-sm"><span>{editor.demonstracao === 'endividamento' ? 'Nome do banco ou dívida *' : 'Nome da sublinha *'}</span><Input value={alvoEditor.nome} onChange={event => atualizarAlvo({ ...alvoEditor, nome: event.target.value })} /></label>
                  <Button variant="outline" onClick={() => {
                    const restantes = bancosEditor.filter(banco => banco.id !== bancoAtivo);
                    setBancosEditor(restantes);
                    escolherBanco(restantes[0]?.id ?? '');
                  }}>{editor.demonstracao === 'endividamento' ? 'Remover banco ou dívida' : 'Remover sublinha'}</Button>
                </div>}
              </div>}
              {alvoEditor && (alvoEditor.calculo === 'resultadoBalancete'
                ? <p className="text-sm text-muted-foreground">Resultado calculado automaticamente pelo saldo das contas dos grupos 3, 4, 5 e 6. O nome pode ser alterado; o cálculo não exige seleção manual de contas.</p>
                : <>{alvoEditor.tipo === 'contas' ? <>
                <p className="text-xs text-muted-foreground">{editor.demonstracao === 'dfc'
                  ? 'Configure prefixos para classificar as contas. Se houver mais de um prefixo correspondente, vence o mais longo. O efeito é sempre Crédito − Débito.'
                  : alvoEditor.contasPorPrefixo
                    ? 'Selecione contas ou prefixos. Um prefixo soma os saldos com sinal das contas analíticas abaixo dele, sem somar contas agrupadoras. O Ativo mantém o saldo importado; Passivo, PL e Endividamento invertem o saldo.'
                  : `Selecione apenas contas completas (analíticas). Contas incompletas/agrupadoras ficam desabilitadas para evitar dupla contagem. Uma conta não pode pertencer a dois grupos da mesma demonstração. ${editor.demonstracao === 'dre'
                    ? 'O sinal segue o movimento da conta no balancete, inclusive estornos, sem escolha manual.'
                    : 'O Ativo mantém o saldo importado; Passivo, PL e Endividamento invertem o saldo. Redutoras e saldos contrários à natureza reduzem os totais, sem valor absoluto ou sinais manuais.'}`}</p>
                <Input aria-label="Pesquisar contas" placeholder="Pesquisar por código ou descrição" value={busca} onChange={event => setBusca(event.target.value)} />
                <div className="h-[45vh] min-h-64 space-y-1 overflow-y-auto rounded border p-2">
                  {catalogo.filter(conta => `${conta.codigo} ${conta.descricao}`.toLocaleLowerCase().includes(busca.toLocaleLowerCase())).map(conta => {
                    const grupoExistente = grupoDaConta(conta.codigo);
                    const incompleta = contasIncompletas.has(conta.codigo);
                    const incompletaNaoSelecionavel = incompleta && editor.demonstracao !== 'dfc' && !alvoEditor.contasPorPrefixo;
                    const indisponivel = incompletaNaoSelecionavel || Boolean(grupoExistente);
                    return (
                      <label key={conta.codigo} className="flex min-h-11 cursor-pointer items-center gap-3 rounded px-3 py-2 text-base hover:bg-muted">
                        <input type="checkbox" className="size-5 shrink-0" disabled={indisponivel} checked={alvoEditor.itens.some(item => item.referencia === conta.codigo)} onChange={event => selecionar(conta.codigo, event.target.checked)} />
                        <span className={indisponivel ? 'text-muted-foreground' : ''}>{conta.codigo} — {conta.descricao}{incompletaNaoSelecionavel
                          ? ' (incompleta/agrupadora — não selecionável)'
                          : grupoExistente ? ` (já vinculada ao grupo "${grupoExistente.nome}")` : ''}</span>
                      </label>
                    );
                  })}
                  {catalogo.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta disponível. Importe um balancete ou corrija o erro de carregamento.</p>}
                </div>
              </> : <div className="space-y-2 rounded border p-3">
                {linhasDisponiveisEditor.map(linha => <label key={linha.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editor.itens.some(item => item.referencia === linha.id)} onChange={event => selecionar(linha.id, event.target.checked)} />{linha.nome}</label>)}
                {linhasDisponiveisEditor.length === 0 && <p className="text-sm text-muted-foreground">Cadastre primeiro as linhas que formarão esta totalização.</p>}
              </div>}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Itens selecionados ({alvoEditor.itens.length})</h4>
                {alvoEditor.itens.map(item => <div key={item.referencia} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                  <span>{alvoEditor.tipo === 'contas' ? `${item.referencia} — ${catalogo.find(conta => conta.codigo === item.referencia)?.descricao ?? 'Conta não encontrada nos períodos carregados'}` : cadastro?.linhas.find(linha => linha.id === item.referencia)?.nome}</span>
                  <Button variant="outline" size="sm" aria-label={`Remover item ${item.referencia}`} onClick={() => selecionar(item.referencia, false)}>Remover</Button>
                </div>)}
              </div>
              </>)}
              {erroEditor && <p role="alert" className="text-sm text-red-700">{erroEditor}</p>}
              <DialogFooter><Button variant="outline" onClick={() => setEditor(null)}>Cancelar</Button><Button onClick={confirmarLinha}>Aplicar linha</Button></DialogFooter>
            </>}
          </DialogContent>
        </Dialog>
        <Dialog open={contasCaixaEditor !== null} onOpenChange={open => { if (!open && !salvando) setContasCaixaEditor(null); }}>
          <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Contas de caixa e equivalentes</DialogTitle>
              <DialogDescription>Selecione contas analíticas ou prefixos. Um prefixo inclui as contas abaixo dele; para restringir a seleção, remova o prefixo abrangente e marque apenas as contas desejadas. As alterações só passam a valer após salvar.</DialogDescription>
            </DialogHeader>
            {contasCaixaEditor && <>
              <Input aria-label="Pesquisar contas de caixa/equivalentes" placeholder="Pesquisar por código ou descrição" value={buscaCaixa} onChange={event => setBuscaCaixa(event.target.value)} />
              <div className="max-h-64 space-y-1 overflow-y-auto rounded border p-2">
                {catalogo.filter(conta => `${conta.codigo} ${conta.descricao}`.toLocaleLowerCase().includes(buscaCaixa.toLocaleLowerCase())).map(conta => {
                  const prefixoAplicado = contasCaixaEditor
                    .filter(prefixo => conta.codigo === prefixo || conta.codigo.startsWith(`${prefixo}.`))
                    .sort((a, b) => b.length - a.length)[0];
                  const selecionada = contasCaixaEditor.includes(conta.codigo);
                  const incluidaPorPrefixo = Boolean(prefixoAplicado && prefixoAplicado !== conta.codigo);
                  return <label key={conta.codigo} className="flex min-h-11 cursor-pointer items-center gap-3 rounded px-3 py-2 text-sm hover:bg-muted">
                    <input type="checkbox" className="size-5 shrink-0" disabled={incluidaPorPrefixo} checked={selecionada}
                      onChange={event => selecionarContaCaixa(conta.codigo, event.target.checked)} />
                    <span>{conta.codigo} — {conta.descricao}{incluidaPorPrefixo ? ` (incluída pelo prefixo ${prefixoAplicado})` : ''}</span>
                  </label>;
                })}
                {catalogo.length === 0 && <p className="p-2 text-sm text-muted-foreground">Importe um balancete para selecionar contas analíticas.</p>}
              </div>
              <section className="space-y-2 rounded border p-3">
                <h3 className="text-sm font-semibold">Contas e prefixos selecionados ({contasCaixaEditor.length})</h3>
                {contasCaixaEditor.map(conta => <div key={conta} className="flex items-center justify-between gap-2 text-sm">
                  <span>{conta}{descricoes.has(conta) ? ` — ${descricoes.get(conta)}` : ' — prefixo'}</span>
                  <Button variant="outline" size="sm" aria-label={`Remover regra ${conta}`}
                    onClick={() => selecionarContaCaixa(conta, false)}>Remover</Button>
                </div>)}
              </section>
            </>}
            {erroCaixaEditor && <p role="alert" className="text-sm text-red-700">{erroCaixaEditor}</p>}
            <DialogFooter>
              <Button variant="outline" disabled={salvando} onClick={() => setContasCaixaEditor(null)}>Cancelar</Button>
              <Button disabled={salvando || contasCaixaEditor === null} onClick={salvarContasCaixaEquivalentes}>Salvar contas</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={editorDfcIndireto !== null} onOpenChange={open => { if (!open) setEditorDfcIndireto(null); }}>
          <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Mapear contas — {DFC_INDIRETO_CATEGORIAS_MAPEAVEIS.find(item => item.codigo === editorDfcIndireto?.linha)?.nome}</DialogTitle>
              <DialogDescription>Selecione contas ou prefixos para esta linha da DFC indireta. O prefixo mais longo prevalece quando houver regras sobrepostas; depois, salve o cadastro para aplicar as alterações.</DialogDescription>
            </DialogHeader>
            {editorDfcIndireto && <>
              <Input aria-label="Pesquisar contas da DFC indireta" placeholder="Pesquisar por código ou descrição" value={buscaDfcIndireto} onChange={event => setBuscaDfcIndireto(event.target.value)} />
              <div className="max-h-64 space-y-1 overflow-y-auto rounded border p-2">
                {catalogo.filter(conta => `${conta.codigo} ${conta.descricao}`.toLocaleLowerCase().includes(buscaDfcIndireto.toLocaleLowerCase())).map(conta => {
                  const regraExistente = (cadastro?.dfcIndiretoRegras ?? []).find(regra =>
                    regra.referencia === conta.codigo && regra.linha !== editorDfcIndireto.linha);
                  const selecionada = editorDfcIndireto.referencias.includes(conta.codigo);
                  return <label key={conta.codigo} className="flex min-h-11 cursor-pointer items-center gap-3 rounded px-3 py-2 text-sm hover:bg-muted">
                    <input type="checkbox" className="size-5 shrink-0" disabled={Boolean(regraExistente)} checked={selecionada}
                      onChange={event => selecionarRegraDfcIndireto(conta.codigo, event.target.checked)} />
                    <span>{conta.codigo} — {conta.descricao}{regraExistente ? ` (já mapeada em ${regraExistente.linha})` : ''}</span>
                  </label>;
                })}
                {catalogo.length === 0 && <p className="p-2 text-sm text-muted-foreground">Importe um balancete para selecionar contas ou prefixos.</p>}
              </div>
              <section className="space-y-2 rounded border p-3">
                <h3 className="text-sm font-semibold">Prefixos selecionados ({editorDfcIndireto.referencias.length})</h3>
                {editorDfcIndireto.referencias.map(referencia => <div key={referencia} className="flex items-center justify-between gap-2 text-sm">
                  <span>{descricaoConta({ referencia, operacao: 1 })}</span>
                  <Button variant="outline" size="sm" aria-label={`Remover prefixo ${referencia}`}
                    onClick={() => selecionarRegraDfcIndireto(referencia, false)}>Remover</Button>
                </div>)}
              </section>
            </>}
            {erroDfcIndireto && <p role="alert" className="text-sm text-red-700">{erroDfcIndireto}</p>}
            <DialogFooter>
              <Button variant="outline" disabled={salvando} onClick={() => setEditorDfcIndireto(null)}>Cancelar</Button>
              <Button disabled={salvando || editorDfcIndireto === null} onClick={aplicarRegrasDfcIndireto}>Aplicar mapeamento</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
