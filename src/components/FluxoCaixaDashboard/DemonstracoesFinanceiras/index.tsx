import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  TIPOS, MESES, calcularLinhas, chavePeriodo, rotuloPeriodo, validarLinhas, identificarContasIncompletas, validarContasCompletas, mesmaHierarquia,
  type CadastroDemonstracoes, type DadosDemonstracoes, type ItemDemonstracao,
  type LinhaDemonstracao, type PeriodoDemonstracao, type TipoDemonstracao,
} from './modelo';
import { loadCadastroDemonstracoes, loadDadosDemonstracoes, saveCadastroDemonstracoes } from './storage';

const moeda = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const selectClass = 'h-10 rounded-md border border-input bg-background px-3 text-sm';
const mensagem = (error: unknown) => error instanceof Error ? error.message : String(error);

export function DemonstracoesFinanceiras({ selectedYear, selectedMonth }: { selectedYear: number; selectedMonth: number }) {
  const [aba, setAba] = useState<TipoDemonstracao | 'cadastros'>('dre');
  const [cadastro, setCadastro] = useState<CadastroDemonstracoes | null>(null);
  const [erroCadastro, setErroCadastro] = useState('');
  const [tentativaCadastro, setTentativaCadastro] = useState(0);
  const [alterado, setAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [erroAcao, setErroAcao] = useState('');
  const [dados, setDados] = useState<DadosDemonstracoes | null>(null);
  const [erroDados, setErroDados] = useState('');
  const [tentativaDados, setTentativaDados] = useState(0);
  const [comparacao, setComparacao] = useState<PeriodoDemonstracao>({ ano: selectedYear - 1, mes: 12 });
  const [anoComparacao, setAnoComparacao] = useState(String(selectedYear - 1));
  const [mesComparacao, setMesComparacao] = useState(12);
  const [editor, setEditor] = useState<LinhaDemonstracao | null>(null);
  const [erroEditor, setErroEditor] = useState('');
  const [busca, setBusca] = useState('');
  const [tipoCadastro, setTipoCadastro] = useState<TipoDemonstracao>('dre');
  const escopoDados = aba === 'ativo' || aba === 'passivo' ? 'patrimonial' : aba;

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
    loadDadosDemonstracoes({ ano: selectedYear, mes: selectedMonth }, comparacao, escopoDados).then(value => {
      if (ativo) setDados(value);
    }).catch(error => { if (ativo) setErroDados(mensagem(error)); });
    return () => { ativo = false; };
  }, [selectedYear, selectedMonth, comparacao, tentativaDados, escopoDados]);

  const catalogo = useMemo(() => {
    const contas = new Map<string, string>();
    for (const periodo of Object.values(dados ?? {})) {
      for (const conta of Object.values(periodo ?? {})) contas.set(conta.conta, conta.desc);
    }
    return [...contas].map(([codigo, descricao]) => ({ codigo, descricao }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
  }, [dados]);
  const contasIncompletas = useMemo(() => identificarContasIncompletas(Object.values(dados ?? {})), [dados]);

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

  async function salvar() {
    if (!cadastro) return;
    const erro = validarContasCompletas(cadastro.linhas, contasIncompletas);
    if (erro) { setErroAcao(erro); return; }
    setSalvando(true);
    setErroAcao('');
    setAviso('');
    try {
      const salva = await saveCadastroDemonstracoes(cadastro);
      setCadastro(salva);
      setAlterado(false);
      setAviso('Cadastro salvo com sucesso.');
    } catch (error) {
      setErroAcao(mensagem(error));
    } finally {
      setSalvando(false);
    }
  }

  function abrirEditor(linha?: LinhaDemonstracao) {
    setEditor(linha ?? { id: crypto.randomUUID(), nome: '', demonstracao: tipoCadastro, tipo: 'contas', itens: [] });
    setErroEditor('');
    setBusca('');
  }

  function confirmarLinha() {
    if (!editor || !cadastro) return;
    const linhas = cadastro.linhas.some(item => item.id === editor.id)
      ? cadastro.linhas.map(item => item.id === editor.id ? { ...editor, nome: editor.nome.trim() } : item)
      : [...cadastro.linhas, { ...editor, nome: editor.nome.trim() }];
    const erro = validarLinhas(linhas) ?? validarContasCompletas([editor], contasIncompletas);
    if (erro) { setErroEditor(erro); return; }
    atualizar({ ...cadastro, linhas });
    setEditor(null);
  }

  function moverLinha(id: string, direcao: number) {
    if (!cadastro) return;
    const visiveis = cadastro.linhas.filter(item => item.demonstracao === tipoCadastro);
    const destino = visiveis[visiveis.findIndex(item => item.id === id) + direcao];
    if (!destino) return;
    const linhas = [...cadastro.linhas];
    const origemIndex = linhas.findIndex(item => item.id === id);
    const destinoIndex = linhas.findIndex(item => item.id === destino.id);
    [linhas[origemIndex], linhas[destinoIndex]] = [linhas[destinoIndex], linhas[origemIndex]];
    atualizarLinhas(linhas);
  }

  function selecionar(referencia: string, marcado: boolean) {
    if (!editor) return;
    if (marcado && editor.tipo === 'contas' && contasIncompletas.has(referencia)) {
      setErroEditor(`A conta ${referencia} está incompleta ou é agrupadora. Selecione uma conta completa.`);
      return;
    }
    if (marcado && editor.tipo === 'contas') {
      const grupoExistente = grupoDaConta(referencia);
      if (grupoExistente) {
        setErroEditor(`A conta ${referencia} já está vinculada ao grupo "${grupoExistente.nome}" nesta demonstração.`);
        return;
      }
    }
    setEditor({ ...editor, itens: marcado ? [...editor.itens, { referencia, operacao: 1 }] : editor.itens.filter(item => item.referencia !== referencia) });
  }

  function operacao(item: ItemDemonstracao) {
    return (
      <select aria-label={`Operação de ${item.referencia}`} className={selectClass} value={item.operacao}
        onChange={event => {
          if (editor) setEditor({ ...editor, itens: editor.itens.map(value => value.referencia === item.referencia ? { ...value, operacao: event.target.value === '1' ? 1 : -1 } : value) });
        }}>
        <option value="1">+ Somar</option><option value="-1">− Subtrair</option>
      </select>
    );
  }

  const principal = { ano: selectedYear, mes: selectedMonth };
  const linhas = cadastro?.linhas.filter(item => item.demonstracao === aba) ?? [];
  const periodosAcumulados = selectedMonth === 0 ? [principal]
    : Array.from({ length: selectedMonth }, (_, index) => ({ ano: selectedYear, mes: index + 1 }));
  const colunas = aba === 'dre'
    ? selectedMonth === 0
      ? [{ titulo: `Ano/${selectedYear}`, periodos: [principal] }]
      : [
        { titulo: rotuloPeriodo(principal), periodos: [principal] },
        { titulo: `Jan–${MESES[selectedMonth]}/${String(selectedYear).slice(-2)}`, periodos: periodosAcumulados },
      ]
    : [{ titulo: rotuloPeriodo(principal), periodos: [principal] }, { titulo: rotuloPeriodo(comparacao), periodos: [comparacao] }];
  const valores = aba !== 'cadastros' && cadastro && dados
    ? colunas.map(coluna => calcularLinhas(cadastro.linhas, aba, coluna.periodos.map(periodo => dados[chavePeriodo(periodo)] ?? null)))
    : [];
  const faltantes = [...new Map(colunas.flatMap(coluna => coluna.periodos).filter(periodo => dados && !dados[chavePeriodo(periodo)]).map(periodo => [chavePeriodo(periodo), periodo])).values()];
  const contasAusentes = aba !== 'cadastros' && dados
    ? [...new Set(linhas.filter(linha => linha.tipo === 'contas').flatMap(linha => linha.itens.map(item => item.referencia)))]
      .filter(codigo => colunas.some(coluna => coluna.periodos.some(periodo => dados[chavePeriodo(periodo)] && !dados[chavePeriodo(periodo)]?.[codigo])))
    : [];
  const contasIncompletasVinculadas = linhas.filter(linha => linha.tipo === 'contas')
    .flatMap(linha => linha.itens).filter(item => contasIncompletas.has(item.referencia));
  const linhasDisponiveisEditor = editor && cadastro
    ? cadastro.linhas.filter(item => item.id !== editor.id && item.demonstracao === editor.demonstracao)
    : [];

  function grupoDaConta(referencia: string) {
    if (!editor || !cadastro || editor.tipo !== 'contas') return undefined;
    return cadastro.linhas.find(linha =>
      linha.id !== editor.id && linha.demonstracao === editor.demonstracao && linha.tipo === 'contas' &&
      linha.itens.some(item => mesmaHierarquia(item.referencia, referencia)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Emissão de Demonstrações Financeiras</h2></CardTitle>
        <p className="text-sm text-muted-foreground">Demonstrações gerenciais a partir dos balancetes importados. Impressão e PDF serão disponibilizados posteriormente.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div role="tablist" aria-label="Demonstrações financeiras" className="flex flex-wrap gap-2 border-b pb-3">
          {([...Object.keys(TIPOS), 'cadastros'] as Array<TipoDemonstracao | 'cadastros'>).map(tipo => (
            <Button key={tipo} role="tab" aria-selected={aba === tipo} variant={aba === tipo ? 'default' : 'outline'} onClick={() => setAba(tipo)}>
              {tipo === 'cadastros' ? 'Cadastros' : TIPOS[tipo]}
            </Button>
          ))}
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
            {aba === 'cadastros' ? (
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
                    <Button onClick={() => abrirEditor()}>Adicionar linha</Button>
                  </div>
                  <p className="text-sm text-muted-foreground">Cadastre grupos de contas e totalizações das linhas desejadas. Use as setas para definir a posição de cada linha na demonstração; a posição não altera o cálculo.</p>
                  <div className="space-y-2">
                    {cadastro.linhas.filter(item => item.demonstracao === tipoCadastro).map((linha, index, lista) => (
                      <div key={linha.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                        <div><p className="font-medium">{linha.nome}</p><p className="text-xs text-muted-foreground">{linha.tipo === 'total' ? 'Totalização' : 'Grupo de contas'} · {linha.itens.length} itens</p></div>
                        <div className="flex flex-wrap gap-1">
                          <Button variant="outline" size="sm" aria-label={`Subir ${linha.nome}`} disabled={index === 0} onClick={() => moverLinha(linha.id, -1)}>↑</Button>
                          <Button variant="outline" size="sm" aria-label={`Descer ${linha.nome}`} disabled={index === lista.length - 1} onClick={() => moverLinha(linha.id, 1)}>↓</Button>
                          <Button variant="outline" size="sm" onClick={() => abrirEditor(linha)}>Editar {linha.nome}</Button>
                          <Button variant="outline" size="sm" onClick={() => atualizarLinhas(cadastro.linhas.filter(item => item.id !== linha.id))}>Excluir {linha.nome}</Button>
                        </div>
                      </div>
                    ))}
                    {!cadastro.linhas.some(item => item.demonstracao === tipoCadastro) && <p className="text-sm text-muted-foreground">Nenhuma linha cadastrada para {TIPOS[tipoCadastro]}.</p>}
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
                <Button onClick={salvar}>{salvando ? 'Salvando...' : 'Salvar cadastro'}</Button>
              </fieldset>
            ) : (
              <section className="space-y-4" aria-label={`Demonstração ${TIPOS[aba]}`}>
                {(aba === 'ativo' || aba === 'passivo') && <div className="flex flex-wrap items-end gap-3 rounded border bg-muted/30 p-3">
                  <label className="space-y-1 text-sm"><span className="block">Mês de comparação</span>
                    <select className={selectClass} value={mesComparacao} onChange={event => setMesComparacao(Number(event.target.value))}>
                      {MESES.map((mes, index) => <option key={mes} value={index}>{mes}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm"><span className="block">Ano de comparação</span><Input type="number" min={1900} max={9999} value={anoComparacao} onChange={event => setAnoComparacao(event.target.value)} className="w-28" /></label>
                  <Button variant="outline" onClick={() => {
                    const ano = Number(anoComparacao);
                    if (!Number.isInteger(ano) || ano < 1900 || ano > 9999) { setErroAcao('Informe um ano de comparação entre 1900 e 9999.'); return; }
                    setErroAcao('');
                    setComparacao({ ano, mes: mesComparacao });
                  }}>Comparar</Button>
                </div>}
                <header className="space-y-1 py-3 text-center">
                  <h3 className="text-lg font-semibold">{cadastro.empresa.nome || 'Cadastre o nome da empresa'}</h3>
                  {cadastro.empresa.cnpj && <p className="text-sm">CNPJ: {cadastro.empresa.cnpj}{cadastro.empresa.nire && ` · NIRE: ${cadastro.empresa.nire}`}</p>}
                  <p className="font-medium">{aba === 'dre' ? 'Demonstração do Resultado do Exercício' : aba === 'ativo' ? 'Balanço Patrimonial — Ativo' : 'Balanço Patrimonial — Passivo'}</p>
                  <p className="text-xs text-muted-foreground">Valores em R$</p>
                </header>
                {faltantes.length > 0 && <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Balancetes não importados: {faltantes.map(rotuloPeriodo).join(', ')}. As colunas afetadas ficam indisponíveis.</p>}
                {contasAusentes.length > 0 && <p role="alert" className="text-sm text-amber-800">Contas cadastradas ausentes em algum período: {contasAusentes.join(', ')}. Grupos e totalizações afetados são exibidos com —, não como zero.</p>}
                {contasIncompletasVinculadas.length > 0 && <p role="alert" className="text-sm text-amber-800">Existem contas incompletas/agrupadoras vinculadas: {contasIncompletasVinculadas.map(item => item.referencia).join(', ')}. Substitua-as por contas completas em Cadastros. Os valores afetados ficam indisponíveis.</p>}
                {!dados && !erroDados ? <p role="status">Carregando balancetes...</p> : !erroDados && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">{TIPOS[aba]} — {colunas.map(coluna => coluna.titulo).join(' e ')}</caption>
                      <thead><tr className="border-y bg-muted/50"><th scope="col" className="p-3 text-left">Descrição</th>{colunas.map((coluna, index) => <th key={index} scope="col" className="whitespace-nowrap p-3 text-right">{coluna.titulo}</th>)}</tr></thead>
                      <tbody>
                        {linhas.map(linha => <tr key={linha.id} className={linha.tipo === 'total' ? 'border-y bg-muted/40 font-semibold' : 'border-b'}>
                          <th scope="row" className="p-3 text-left font-inherit">{linha.nome}</th>
                          {colunas.map((_, index) => {
                            const valor = valores[index]?.get(linha.id);
                            return <td key={index} className={`whitespace-nowrap p-3 text-right tabular-nums ${valor !== null && valor !== undefined && valor < 0 ? 'text-red-700' : ''}`}>{valor === null || valor === undefined ? '—' : moeda.format(valor)}</td>;
                          })}
                        </tr>)}
                        {linhas.length === 0 && <tr><td colSpan={colunas.length + 1} className="p-6 text-center text-muted-foreground">Nenhum grupo cadastrado. Configure as linhas na aba Cadastros.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{aba === 'dre'
                  ? 'DRE: movimento líquido (créditos − débitos), preservando o sinal contábil e os estornos; acumulado calculado de janeiro até o mês selecionado. Grupos e totalizações somam os valores com seus sinais automaticamente.'
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
        <Dialog open={editor !== null} onOpenChange={open => { if (!open) setEditor(null); }}>
          <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-6xl">
            <DialogHeader><DialogTitle>Configurar linha — {editor ? TIPOS[editor.demonstracao] : ''}</DialogTitle><DialogDescription>{editor?.tipo === 'total'
              ? editor.demonstracao === 'dre'
                ? 'Selecione linhas já cadastradas. Na DRE, os sinais são automáticos e as totalizações somam os valores com seus respectivos sinais.'
                : 'Selecione linhas já cadastradas e defina se cada item soma ou subtrai.'
              : editor?.demonstracao === 'dre'
                ? 'Selecione contas completas. Na DRE, os sinais seguem o movimento do balancete automaticamente.'
                : 'Selecione contas completas e defina se cada item soma ou subtrai.'}</DialogDescription></DialogHeader>
            {editor && <>
              <label className="space-y-1 text-sm"><span>Nome da linha *</span><Input value={editor.nome} onChange={event => setEditor({ ...editor, nome: event.target.value })} /></label>
              <label className="space-y-1 text-sm"><span className="block">Tipo de linha</span>
                <select className={selectClass} value={editor.tipo} onChange={event => setEditor({ ...editor, tipo: event.target.value === 'total' ? 'total' : 'contas', itens: [] })}>
                  <option value="contas">Grupo de contas do balancete</option><option value="total">Totalização de linhas selecionadas</option>
                </select>
              </label>
              {editor.tipo === 'contas' ? <>
                <p className="text-xs text-muted-foreground">Selecione apenas contas completas (analíticas). Contas incompletas/agrupadoras ficam desabilitadas para evitar dupla contagem. Uma conta não pode pertencer a dois grupos da mesma demonstração. {editor.demonstracao === 'dre'
                  ? 'O sinal segue o movimento da conta no balancete, inclusive estornos, sem escolha manual.'
                  : 'Os sinais são aplicados aos valores absolutos das contas.'}</p>
                <Input aria-label="Pesquisar contas" placeholder="Pesquisar por código ou descrição" value={busca} onChange={event => setBusca(event.target.value)} />
                <div className="h-[45vh] min-h-64 space-y-1 overflow-y-auto rounded border p-2">
                  {catalogo.filter(conta => `${conta.codigo} ${conta.descricao}`.toLocaleLowerCase().includes(busca.toLocaleLowerCase())).map(conta => {
                    const grupoExistente = grupoDaConta(conta.codigo);
                    const incompleta = contasIncompletas.has(conta.codigo);
                    const indisponivel = incompleta || Boolean(grupoExistente);
                    return (
                      <label key={conta.codigo} className="flex min-h-11 cursor-pointer items-center gap-3 rounded px-3 py-2 text-base hover:bg-muted">
                        <input type="checkbox" className="size-5 shrink-0" disabled={indisponivel} checked={editor.itens.some(item => item.referencia === conta.codigo)} onChange={event => selecionar(conta.codigo, event.target.checked)} />
                        <span className={indisponivel ? 'text-muted-foreground' : ''}>{conta.codigo} — {conta.descricao}{incompleta
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
                <h4 className="text-sm font-semibold">Itens selecionados ({editor.itens.length})</h4>
                {editor.itens.map(item => <div key={item.referencia} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                  <span>{editor.tipo === 'contas' ? `${item.referencia} — ${catalogo.find(conta => conta.codigo === item.referencia)?.descricao ?? 'Conta não encontrada nos períodos carregados'}` : cadastro?.linhas.find(linha => linha.id === item.referencia)?.nome}</span>
                  <div className="flex gap-2">{editor.demonstracao !== 'dre' && operacao(item)}<Button variant="outline" size="sm" aria-label={`Remover item ${item.referencia}`} onClick={() => selecionar(item.referencia, false)}>Remover</Button></div>
                </div>)}
              </div>
              {erroEditor && <p role="alert" className="text-sm text-red-700">{erroEditor}</p>}
              <DialogFooter><Button variant="outline" onClick={() => setEditor(null)}>Cancelar</Button><Button onClick={confirmarLinha}>Aplicar linha</Button></DialogFooter>
            </>}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
