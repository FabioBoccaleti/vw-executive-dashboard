import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { loadFluxoCaixaRaw } from '../fluxoCaixaStorage';
import type { ImportActor, ImportSnapshot } from '../importHistoryStorage';
import {
  loadImportSnapshots,
  loadImportSnapshotText,
  markImportSnapshotEmitted,
} from '../importHistoryStorage';
import { extractAccounts } from '../balanceteParser';
import type { CadastroDemonstracoes, ContasBalancete } from './modelo';
import {
  calcularDiferencaLinhasSnapshots,
  compararSnapshotsBalancete,
  construirConferencias,
  type ComparacaoContaSnapshot,
  type EntradaConferencias,
  type ResultadoConferencia,
} from './conferenciasModelo';
import {
  loadConferenciasConfig,
  saveConferenciasConfig,
  type ConferenciasConfig,
} from './conferenciasStorage';

type Props = {
  selectedYear: number;
  selectedMonth: number;
  cadastro: CadastroDemonstracoes;
  currentUser?: ImportActor;
};

type DadosPainel = {
  entrada: EntradaConferencias;
  currentTimestamp: number | null;
  currentSnapshotId: string | null;
};

type ComparacaoSnapshots = {
  rotulo: string;
  referencia: ImportSnapshot;
  contas: ComparacaoContaSnapshot[];
  linhas: ReturnType<typeof calcularDiferencaLinhasSnapshots>;
};

const moedas = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const estados: Record<ResultadoConferencia['estado'], { rotulo: string; classe: string }> = {
  ok: { rotulo: 'OK', classe: 'bg-green-100 text-green-800' },
  atencao: { rotulo: 'Atenção', classe: 'bg-amber-100 text-amber-900' },
  erro: { rotulo: 'Erro', classe: 'bg-red-100 text-red-800' },
  informativo: { rotulo: 'Informativo', classe: 'bg-blue-100 text-blue-800' },
  indisponivel: { rotulo: 'Indisponível', classe: 'bg-slate-100 text-slate-700' },
};

const mensagem = (error: unknown) => error instanceof Error ? error.message : String(error);
const rotuloPeriodo = (ano: number, mes: number) => `${mes === 0 ? 'Anual' : String(mes).padStart(2, '0')}/${ano}`;
const dataHora = (timestamp: number) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(timestamp);
const linhasTexto = (valores: string[]) => valores.join('\n');

function listarLinhas(texto: string): string[] {
  return texto.split('\n').map(item => item.trim()).filter(Boolean);
}

function lerNaturezas(texto: string, campo: string): Array<{ prefixo: string; natureza: 'devedora' | 'credora' }> {
  return listarLinhas(texto).map((linha, indice) => {
    const [prefixo, natureza, ...extra] = linha.split('=').map(parte => parte.trim());
    if (!prefixo || extra.length || (natureza !== 'devedora' && natureza !== 'credora')) {
      throw new Error(`${campo}, linha ${indice + 1}: use prefixo=devedora ou prefixo=credora.`);
    }
    return { prefixo, natureza };
  });
}

function contaBalancete(rawText: string | null, periodo: string): ContasBalancete | null {
  if (rawText === null) return null;
  try {
    const contas = extractAccounts(rawText, { strict: true });
    if (Object.keys(contas).length === 0) throw new Error('Nenhuma conta válida foi encontrada.');
    return contas;
  } catch (error) {
    throw new Error(`Balancete ${periodo}: ${mensagem(error)}`);
  }
}

async function carregarDadosPainel(
  selectedYear: number,
  selectedMonth: number,
  cadastro: CadastroDemonstracoes,
  config: ConferenciasConfig,
): Promise<DadosPainel> {
  const mesesDoAno = Array.from({ length: 12 }, (_, index) => ({ ano: selectedYear, mes: index + 1 }));
  const mesesAnteriores = selectedMonth > 0
    ? Array.from({ length: 3 }, (_, index) => {
      const offset = selectedMonth - 4 + index;
      const date = new Date(selectedYear, offset, 1);
      return { ano: date.getFullYear(), mes: date.getMonth() + 1 };
    })
    : [];
  const periodoAnterior = selectedMonth > 0
    ? (() => {
      const date = new Date(selectedYear, selectedMonth - 2, 1);
      return { ano: date.getFullYear(), mes: date.getMonth() + 1 };
    })()
    : { ano: selectedYear - 1, mes: 0 };
  const periodoSeguinte = selectedMonth > 0
    ? (() => {
      const date = new Date(selectedYear, selectedMonth, 1);
      return { ano: date.getFullYear(), mes: date.getMonth() + 1 };
    })()
    : null;
  const periodosExtras = [periodoAnterior, ...(periodoSeguinte ? [periodoSeguinte] : []), ...mesesAnteriores];
  const chaves = new Map<string, { ano: number; mes: number }>();
  for (const periodo of [...mesesDoAno, ...periodosExtras, ...(selectedMonth === 0 ? [{ ano: selectedYear, mes: 0 }] : [])]) {
    chaves.set(`${periodo.ano}_${periodo.mes}`, periodo);
  }
  const dados = new Map<string, ContasBalancete | null>();
  const pares = await Promise.all([...chaves].map(async ([chave, periodo]) => {
    const raw = await loadFluxoCaixaRaw(periodo.ano, periodo.mes, { throwOnError: true });
    return [chave, contaBalancete(raw?.rawText ?? null, rotuloPeriodo(periodo.ano, periodo.mes))] as const;
  }));
  for (const [chave, contas] of pares) dados.set(chave, contas);
  const obter = (ano: number, mes: number) => dados.get(`${ano}_${mes}`) ?? null;
  const rawAtual = await loadFluxoCaixaRaw(selectedYear, selectedMonth, { throwOnError: true });
  const atual = obter(selectedYear, selectedMonth);
  const mesesDoAnoComContas = mesesDoAno.map(periodo => ({ ...periodo, contas: obter(periodo.ano, periodo.mes) }));
  const mesesAnterioresComContas = mesesAnteriores.map(periodo => ({ ...periodo, contas: obter(periodo.ano, periodo.mes) }));

  return {
    entrada: {
      ano: selectedYear,
      mes: selectedMonth,
      atual,
      anterior: obter(periodoAnterior.ano, periodoAnterior.mes),
      proximo: periodoSeguinte ? obter(periodoSeguinte.ano, periodoSeguinte.mes) : null,
      acumulado: selectedMonth === 0
        ? [atual]
        : mesesDoAnoComContas.slice(0, selectedMonth).map(periodo => periodo.contas),
      mesesDoAno: mesesDoAnoComContas,
      mesesAnteriores: mesesAnterioresComContas,
      cadastro,
      config,
    },
    currentTimestamp: rawAtual?.timestamp ?? null,
    currentSnapshotId: rawAtual?.snapshotId ?? null,
  };
}

function formatarContaSnapshot(conta: ContasBalancete[string] | null, campo: 'saldoAnt' | 'valDeb' | 'valCred' | 'saldoAtual') {
  return conta ? moedas.format(conta[campo]) : '—';
}

function TabelaContas({
  contas,
  modo = 'saldos',
}: {
  contas: Array<{ conta: string; descricao: string; saldoAnterior: number; debitos: number; creditos: number; saldoAtual: number; movimento: number; detalhe?: string }>;
  modo?: 'saldos' | 'movimentos';
}) {
  if (!contas.length) return <p className="text-sm text-muted-foreground">Nenhuma conta nesta conferência.</p>;
  return <div className="overflow-x-auto">
    <table className={`w-full ${modo === 'movimentos' ? 'min-w-[560px]' : 'min-w-[820px]'} text-left text-xs`}>
      <thead><tr className="border-b text-muted-foreground">
        <th className="p-2">Conta</th><th className="p-2">Descrição / motivo</th>
        {modo === 'saldos' && <th className="p-2 text-right">Saldo anterior</th>}
        <th className="p-2 text-right">Débitos</th><th className="p-2 text-right">Créditos</th>
        {modo === 'saldos' && <th className="p-2 text-right">Saldo atual</th>}
        <th className="p-2 text-right">Movimento</th>
      </tr></thead>
      <tbody>{contas.map(conta => <tr key={`${conta.conta}-${conta.detalhe ?? ''}`} className="border-b last:border-0">
        <td className="p-2 font-mono">{conta.conta}</td><td className="p-2">{conta.descricao}{conta.detalhe && <span className="block text-muted-foreground">{conta.detalhe}</span>}</td>
        {modo === 'saldos' && <td className="p-2 text-right tabular-nums">{moedas.format(conta.saldoAnterior)}</td>}
        <td className="p-2 text-right tabular-nums">{moedas.format(conta.debitos)}</td>
        <td className="p-2 text-right tabular-nums">{moedas.format(conta.creditos)}</td>
        {modo === 'saldos' && <td className="p-2 text-right tabular-nums">{moedas.format(conta.saldoAtual)}</td>}
        <td className="p-2 text-right tabular-nums">{moedas.format(conta.movimento)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function CampoLista({
  titulo,
  descricao,
  texto,
  onChange,
}: {
  titulo: string;
  descricao: string;
  texto: string;
  onChange: (texto: string) => void;
}) {
  return <label className="space-y-1 text-sm">
    <span className="block font-medium">{titulo}</span>
    <span className="block text-xs text-muted-foreground">{descricao}</span>
    <Textarea rows={4} value={texto} onChange={event => onChange(event.target.value)} />
  </label>;
}

export function ConferenciasTab({ selectedYear, selectedMonth, cadastro, currentUser }: Props) {
  const [config, setConfig] = useState<ConferenciasConfig | null>(null);
  const [dados, setDados] = useState<DadosPainel | null>(null);
  const [snapshots, setSnapshots] = useState<ImportSnapshot[]>([]);
  const [comparacoes, setComparacoes] = useState<ComparacaoSnapshots[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [marcandoSnapshot, setMarcandoSnapshot] = useState('');
  const [erro, setErro] = useState('');
  const [erroHistorico, setErroHistorico] = useState('');
  const [erroConfig, setErroConfig] = useState('');
  const [erroAcao, setErroAcao] = useState('');
  const [aviso, setAviso] = useState('');
  const [textoNaturezaGrupo, setTextoNaturezaGrupo] = useState('');
  const [textoExcecoes, setTextoExcecoes] = useState('');
  const [textoExclusoes, setTextoExclusoes] = useState('');
  const [textoPalavrasRedutoras, setTextoPalavrasRedutoras] = useState('');
  const [textoCapitalGiro, setTextoCapitalGiro] = useState('');
  const [textoPassivoArrendamento, setTextoPassivoArrendamento] = useState('');
  const [textoAtivoDireitoUso, setTextoAtivoDireitoUso] = useState('');
  const [textosValores, setTextosValores] = useState<Record<string, string>>({});
  const [tentativa, setTentativa] = useState(0);
  const [tentativaConfig, setTentativaConfig] = useState(0);

  useEffect(() => {
    let ativo = true;
    setConfig(null);
    setErroConfig('');
    loadConferenciasConfig().then(value => {
      if (!ativo) return;
      setConfig(value);
      setTextoNaturezaGrupo(Object.entries(value.naturezaPorGrupo).map(([grupo, natureza]) => `${grupo}=${natureza}`).join('\n'));
      setTextoExcecoes(value.naturezaExcecoes.map(item => `${item.prefixo}=${item.natureza}`).join('\n'));
      setTextoExclusoes(linhasTexto(value.prefixosExcluidosSinal));
      setTextoPalavrasRedutoras(linhasTexto(value.palavrasRedutoras));
      setTextoCapitalGiro(linhasTexto(value.linhasCapitalGiro));
      setTextoPassivoArrendamento(linhasTexto(value.prefixosPassivoArrendamento));
      setTextoAtivoDireitoUso(linhasTexto(value.prefixosAtivoDireitoUso));
      setTextosValores({
        limiteSinal: String(value.limiteSinalCentavos / 100),
        toleranciaConferencia: String(value.toleranciaConferenciaCentavos / 100),
        toleranciaContinuidade: String(value.toleranciaContinuidadeCentavos / 100),
        limiteVariacaoPercentual: String(value.limiteVariacaoPercentual),
        limiteVariacao: String(value.limiteVariacaoCentavos / 100),
        limiteVariacaoSempre: String(value.limiteVariacaoSempreCentavos / 100),
        limiteCapitalGiro: String(value.limiteCapitalGiroCentavos / 100),
        limiteArrendamento: String(value.limiteArrendamentoCentavos / 100),
        limiteMovimentoPl: String(value.limiteMovimentoPlCentavos / 100),
      });
    }).catch(error => { if (ativo) setErroConfig(mensagem(error)); });
    return () => { ativo = false; };
  }, [tentativaConfig]);

  useEffect(() => {
    if (!config) return;
    let ativo = true;
    setCarregando(true);
    setErro('');
    setDados(null);
    carregarDadosPainel(selectedYear, selectedMonth, cadastro, config).then(value => {
      if (ativo) setDados(value);
    }).catch(error => { if (ativo) setErro(mensagem(error)); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [selectedYear, selectedMonth, cadastro, config, tentativa]);

  const resultados = useMemo(() => dados && config
    ? construirConferencias(dados.entrada)
    : [], [dados, config]);

  useEffect(() => {
    let ativo = true;
    setSnapshots([]);
    setComparacoes([]);
    setErroHistorico('');
    if (!dados) return () => { ativo = false; };
    setCarregandoHistorico(true);
    loadImportSnapshots(selectedYear, selectedMonth).then(async historico => {
      if (!ativo) return;
      setSnapshots(historico);
      const importadas = historico.filter(item => item.status === 'imported');
      const emitida = importadas.filter(item => item.emittedAt)
        .sort((a, b) => (b.emittedAt ?? 0) - (a.emittedAt ?? 0))[0];
      const importacaoAtual = historico.find(item => item.id === dados.currentSnapshotId) ?? importadas[0];
      const importacaoAnterior = importadas.find(item => item.id !== importacaoAtual?.id);
      const comparacaoSecundaria = importacaoAtual?.status === 'imported'
        ? importacaoAnterior
        : importadas.find(item => item.id !== importacaoAtual?.id) ?? importadas[0];
      const candidatos = emitida
        ? [{ rotulo: `Versão emitida · ${dataHora(emitida.emittedAt!)}`, referencia: emitida },
          ...(comparacaoSecundaria && comparacaoSecundaria.id !== emitida.id
            ? [{ rotulo: `Importação anterior · ${dataHora(comparacaoSecundaria.importedAt)}`, referencia: comparacaoSecundaria }]
            : [])]
        : comparacaoSecundaria
          ? [{ rotulo: `Importação anterior · ${dataHora(comparacaoSecundaria.importedAt)}`, referencia: comparacaoSecundaria }]
          : [];
      const comparacoesCarregadas = await Promise.all(candidatos.map(async candidato => {
        const [texto, atual] = await Promise.all([
          loadImportSnapshotText(candidato.referencia),
          Promise.resolve(dados.entrada.atual),
        ]);
        if (!atual) return null;
        const contasReferencia = contaBalancete(texto, `snapshot ${dataHora(candidato.referencia.importedAt)}`);
        if (!contasReferencia) return null;
        return {
          rotulo: candidato.rotulo,
          referencia: candidato.referencia,
          contas: compararSnapshotsBalancete(contasReferencia, atual, 100),
          linhas: calcularDiferencaLinhasSnapshots(cadastro, contasReferencia, atual, 100),
        };
      }));
      if (ativo) setComparacoes(comparacoesCarregadas.filter((item): item is ComparacaoSnapshots => item !== null));
    }).catch(error => { if (ativo) setErroHistorico(mensagem(error)); })
      .finally(() => { if (ativo) setCarregandoHistorico(false); });
    return () => { ativo = false; };
  }, [selectedYear, selectedMonth, dados, cadastro, tentativa]);

  async function salvarConfiguracao() {
    if (!config) return;
    setErroConfig('');
    setErroAcao('');
    setAviso('');
    setSalvandoConfig(true);
    const toCentavos = (campo: string) => {
      const valor = Number(textosValores[campo]);
      if (!Number.isFinite(valor) || valor < 0) throw new Error(`O parâmetro ${campo} deve ser um número não negativo.`);
      const centavos = Math.round(valor * 100);
      if (!Number.isSafeInteger(centavos)) throw new Error(`O parâmetro ${campo} excede o limite permitido.`);
      return centavos;
    };
    try {
      const naturezaPorGrupo: Record<string, 'devedora' | 'credora'> = {};
      for (const item of lerNaturezas(textoNaturezaGrupo, 'Natureza por grupo')) naturezaPorGrupo[item.prefixo] = item.natureza;
      const percentual = Number(textosValores.limiteVariacaoPercentual);
      if (!Number.isFinite(percentual) || percentual < 0) throw new Error('O limite percentual deve ser um número não negativo.');
      const atualizado = await saveConferenciasConfig({
        ...config,
        naturezaPorGrupo,
        naturezaExcecoes: lerNaturezas(textoExcecoes, 'Exceções de natureza'),
        prefixosExcluidosSinal: listarLinhas(textoExclusoes),
        palavrasRedutoras: listarLinhas(textoPalavrasRedutoras),
        linhasCapitalGiro: listarLinhas(textoCapitalGiro),
        prefixosPassivoArrendamento: listarLinhas(textoPassivoArrendamento),
        prefixosAtivoDireitoUso: listarLinhas(textoAtivoDireitoUso),
        limiteSinalCentavos: toCentavos('limiteSinal'),
        toleranciaConferenciaCentavos: toCentavos('toleranciaConferencia'),
        toleranciaContinuidadeCentavos: toCentavos('toleranciaContinuidade'),
        limiteVariacaoPercentual: percentual,
        limiteVariacaoCentavos: toCentavos('limiteVariacao'),
        limiteVariacaoSempreCentavos: toCentavos('limiteVariacaoSempre'),
        limiteCapitalGiroCentavos: toCentavos('limiteCapitalGiro'),
        limiteArrendamentoCentavos: toCentavos('limiteArrendamento'),
        limiteMovimentoPlCentavos: toCentavos('limiteMovimentoPl'),
      });
      setConfig(atualizado);
      setAviso('Parâmetros das conferências salvos.');
    } catch (error) {
      setErroConfig(mensagem(error));
    } finally {
      setSalvandoConfig(false);
    }
  }

  async function marcarComoEmitida(snapshot: ImportSnapshot) {
    if (!currentUser) {
      setErroAcao('Não foi possível registrar quem marcou o demonstrativo como emitido.');
      return;
    }
    setMarcandoSnapshot(snapshot.id);
    setErroAcao('');
    setAviso('');
    try {
      await markImportSnapshotEmitted(snapshot, currentUser);
      setTentativa(value => value + 1);
      setAviso('Versão marcada como emitida.');
    } catch (error) {
      setErroAcao(mensagem(error));
    } finally {
      setMarcandoSnapshot('');
    }
  }

  function atualizarValor(campo: string, valor: string) {
    setTextosValores(atuais => ({ ...atuais, [campo]: valor }));
  }

  function renderizarDetalhes(resultado: ResultadoConferencia) {
    if (resultado.id === 'reimportacao') {
      return <div className="space-y-3">
        {erroHistorico && <p role="alert" className="text-sm text-red-700">{erroHistorico}</p>}
        {carregandoHistorico ? <p role="status" className="text-sm">Carregando histórico...</p>
          : comparacoes.length === 0
            ? <p className="text-sm text-muted-foreground">Ainda não há uma versão anterior ou emitida para comparar.</p>
            : comparacoes.map(comparacao => <section key={comparacao.referencia.id} className="space-y-2 rounded border p-3">
              <h4 className="font-medium">Comparação com {comparacao.rotulo}</h4>
              <p className="text-sm">{comparacao.contas.length} contas e {comparacao.linhas.length} linhas tiveram alterações superiores a R$ 1,00.</p>
              {comparacao.contas.length > 0 && <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead><tr className="border-b text-muted-foreground"><th className="p-2">Conta</th><th className="p-2">Descrição</th>
                    {(['saldoAnt', 'valDeb', 'valCred', 'saldoAtual'] as const).map(campo => <th key={campo} className="p-2 text-right">{campo === 'saldoAnt' ? 'Saldo ant.' : campo === 'valDeb' ? 'Débitos' : campo === 'valCred' ? 'Créditos' : 'Saldo atual'} antes / depois</th>)}</tr></thead>
                  <tbody>{comparacao.contas.map(conta => <tr key={conta.conta} className="border-b last:border-0">
                    <td className="p-2 font-mono">{conta.conta}</td><td className="p-2">{conta.descricao}</td>
                    {(['saldoAnt', 'valDeb', 'valCred', 'saldoAtual'] as const).map(campo => <td key={campo} className="p-2 text-right tabular-nums">{formatarContaSnapshot(conta.antes, campo)} / {formatarContaSnapshot(conta.depois, campo)}</td>)}
                  </tr>)}</tbody>
                </table>
              </div>}
              {comparacao.linhas.length > 0 && <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-xs">
                  <thead><tr className="border-b text-muted-foreground"><th className="p-2">Demonstração</th><th className="p-2">Linha</th><th className="p-2 text-right">Antes</th><th className="p-2 text-right">Depois</th><th className="p-2 text-right">Diferença</th></tr></thead>
                  <tbody>{comparacao.linhas.map((linha, index) => <tr key={`${linha.demonstracao}-${linha.linha}-${index}`} className="border-b last:border-0">
                    <td className="p-2">{linha.demonstracao}</td><td className="p-2">{linha.linha}</td><td className="p-2 text-right">{moedas.format(linha.antes ?? 0)}</td><td className="p-2 text-right">{moedas.format(linha.depois ?? 0)}</td><td className="p-2 text-right">{moedas.format(linha.diferenca)}</td>
                  </tr>)}</tbody>
                </table>
              </div>}
            </section>)}
        <section className="space-y-2">
          <h4 className="font-medium">Histórico de importações · {rotuloPeriodo(selectedYear, selectedMonth)}</h4>
          {!snapshots.length ? <p className="text-sm text-muted-foreground">Nenhuma importação registrada para este período.</p>
            : snapshots.map(snapshot => <div key={snapshot.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
              <div>
                <p className="font-medium">{snapshot.fileName ?? 'Balancete'} · {dataHora(snapshot.importedAt)} · {snapshot.importedBy.name ?? snapshot.importedBy.username}</p>
                <p className="text-muted-foreground">Estado: {snapshot.status}{snapshot.emittedAt ? ` · Emitida em ${dataHora(snapshot.emittedAt)} por ${snapshot.emittedBy?.name ?? snapshot.emittedBy?.username ?? 'usuário'}` : ''}</p>
              </div>
              {snapshot.status === 'imported' && !snapshot.emittedAt && <Button variant="outline" size="sm" disabled={marcandoSnapshot === snapshot.id} onClick={() => { void marcarComoEmitida(snapshot); }}>
                {marcandoSnapshot === snapshot.id ? 'Marcando...' : 'Marcar como emitida'}
              </Button>}
            </div>)}
        </section>
      </div>;
    }
    if (resultado.id === 'continuidade-saldos' && resultado.contasMesSeguinte?.length) {
      return <div className="space-y-3">
        <TabelaContas contas={resultado.contas ?? []} />
        <h4 className="font-medium">Divergências no saldo anterior do mês seguinte</h4>
        <TabelaContas contas={resultado.contasMesSeguinte} />
      </div>;
    }
    if (resultado.id === 'soma-linhas-grupos' && resultado.grupos) {
      return <div className="space-y-2">
        {resultado.grupos.map(grupo => <details key={grupo.nome} className="rounded border p-3">
          <summary className="cursor-pointer font-medium">{grupo.nome} · diferença {grupo.diferenca === null ? 'indisponível' : moedas.format(grupo.diferenca)}</summary>
          <p className="mt-2 text-sm text-muted-foreground">Balancete: {grupo.esperado === null ? 'indisponível' : moedas.format(grupo.esperado)} · Linhas: {grupo.somaLinhas === null ? 'indisponível' : moedas.format(grupo.somaLinhas)}</p>
          {grupo.contas && <TabelaContas contas={grupo.contas} modo={grupo.modoContas} />}
        </details>)}
      </div>;
    }
    if (resultado.id === 'alertas') {
      const detalhesArrendamento = resultado.arrendamentos;
      return <div className="space-y-3">
        {resultado.observacoes?.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{resultado.observacoes.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : null}
        <TabelaContas contas={resultado.contas ?? []} />
        {resultado.movimentosPL?.length ? <div className="space-y-1">
          <h4 className="font-medium">Movimentos do Patrimônio Líquido</h4>
          {resultado.movimentosPL.map(item => <p key={item.grupo} className="text-sm">{item.grupo}: {moedas.format(item.variacao)} · {item.estado}</p>)}
        </div> : null}
        {resultado.variacoesAtipicas?.map(item => <details key={`${item.demonstracao}-${item.linha}`} className="rounded border p-3">
          <summary className="cursor-pointer font-medium">{item.demonstracao} · {item.linha}: {item.motivo}</summary>
          <p className="mt-2 text-sm">Mês {moedas.format(item.valorMes)} · média anterior {moedas.format(item.mediaAnterior)} · variação {moedas.format(item.variacao)} · percentual {item.variacaoPercentual === null ? 'indisponível' : `${item.variacaoPercentual.toFixed(1)}%`}</p>
          <TabelaContas contas={item.contas} />
        </details>)}
        {detalhesArrendamento && <section className="space-y-2 rounded border p-3">
          <h4 className="font-medium">Passivos de arrendamento e direitos de uso</h4>
          <p className="text-sm">Aumento líquido do passivo: {moedas.format(detalhesArrendamento.aumentoPassivoCentavos / 100)} · variação de direito de uso: {moedas.format(detalhesArrendamento.variacaoDireitoUsoCentavos / 100)} · movimento mapeado na DFC: {moedas.format(detalhesArrendamento.fluxoDfcCentavos / 100)}</p>
          <h5 className="text-sm font-medium">Contas do passivo de arrendamento</h5>
          <TabelaContas contas={detalhesArrendamento.contasPassivo.map(conta => ({
            conta: conta.conta, descricao: conta.desc, saldoAnterior: conta.saldoAnt, debitos: conta.valDeb,
            creditos: conta.valCred, saldoAtual: conta.saldoAtual, movimento: conta.valCred - conta.valDeb,
          }))} />
          <h5 className="text-sm font-medium">Contas do ativo de direito de uso</h5>
          <TabelaContas contas={detalhesArrendamento.contasDireitoUso.map(conta => ({
            conta: conta.conta, descricao: conta.desc, saldoAnterior: conta.saldoAnt, debitos: conta.valDeb,
            creditos: conta.valCred, saldoAtual: conta.saldoAtual, movimento: conta.valCred - conta.valDeb,
          }))} />
        </section>}
      </div>;
    }
    if (resultado.contas?.length) return <TabelaContas contas={resultado.contas} />;
    if (resultado.grupos?.length) return <div className="space-y-2">{resultado.grupos.map(grupo =>
      <p key={grupo.nome} className="text-sm">{grupo.nome}: {grupo.diferenca === null ? 'indisponível' : moedas.format(grupo.diferenca)}</p>)}</div>;
    return resultado.observacoes?.length
      ? <ul className="list-disc space-y-1 pl-5 text-sm">{resultado.observacoes.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
      : null;
  }

  if (!config && erroConfig) return <section aria-label="Painel de conferências" className="space-y-3 rounded-lg border p-5">
    <h3 className="text-lg font-semibold">Painel de conferências</h3>
    <p role="alert" className="text-sm text-red-700">Não foi possível carregar os parâmetros: {erroConfig}</p>
    <Button variant="outline" onClick={() => setTentativaConfig(value => value + 1)}>Tentar novamente</Button>
  </section>;

  return <section aria-label="Painel de conferências" className="space-y-5 rounded-lg border p-4 md:p-5">
    <header className="space-y-1">
      <h3 className="text-lg font-semibold">Painel de conferências · {rotuloPeriodo(selectedYear, selectedMonth)}</h3>
      <p className="text-sm text-muted-foreground">Verificações dos balancetes e das demonstrações; divergências de continuidade e versões ignoram diferenças de até R$ 1,00.</p>
    </header>
    {aviso && <p role="status" className="text-sm text-green-700">{aviso}</p>}
    {erroAcao && <p role="alert" className="text-sm text-red-700">{erroAcao}</p>}
    {erro && <div role="alert" className="space-y-2 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      <p>Não foi possível carregar os dados das conferências: {erro}</p>
      <Button variant="outline" size="sm" onClick={() => setTentativa(value => value + 1)}>Tentar carregar novamente</Button>
    </div>}
    {carregando && <p role="status" className="text-sm">Carregando balancetes para as conferências...</p>}
    {!carregando && !erro && <div className="space-y-2">
      {resultados.map(resultado => {
        const estado = estados[resultado.estado];
        const conteudo = renderizarDetalhes(resultado);
        return <details key={resultado.id} open={resultado.estado === 'erro' || resultado.estado === 'atencao'} className="rounded border">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-3">
            <span className="font-medium">{resultado.titulo}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estado.classe}`} aria-label={`Estado: ${estado.rotulo}`}>{estado.rotulo}</span>
          </summary>
          <div className="space-y-3 border-t px-3 py-3">
            <p className="text-sm">{resultado.resumo}</p>
            {conteudo}
          </div>
        </details>;
      })}
    </div>}
    {dados?.currentTimestamp && <p className="text-xs text-muted-foreground">Balancete carregado em {dataHora(dados.currentTimestamp)}.</p>}

    <details className="rounded border">
      <summary className="cursor-pointer p-3 font-medium">Parâmetros das conferências</summary>
      {erroConfig && <p role="alert" className="px-3 text-sm text-red-700">{erroConfig}</p>}
      <div className="grid gap-4 border-t p-3 md:grid-cols-2">
        <CampoLista titulo="Natureza padrão por grupo" descricao="Uma linha por grupo: código=devedora ou código=credora." texto={textoNaturezaGrupo} onChange={setTextoNaturezaGrupo} />
        <label className="space-y-1 text-sm"><span className="block font-medium">Exceções de natureza</span><span className="block text-xs text-muted-foreground">Prefixo mais longo prevalece; formato prefixo=devedora ou prefixo=credora.</span><Textarea rows={5} value={textoExcecoes} onChange={event => setTextoExcecoes(event.target.value)} /></label>
        <CampoLista titulo="Prefixos excluídos da checagem de sinal" descricao="Uma conta ou prefixo por linha." texto={textoExclusoes} onChange={setTextoExclusoes} />
        <CampoLista titulo="Palavras que indicam contas redutoras" descricao="Uma expressão por linha." texto={textoPalavrasRedutoras} onChange={setTextoPalavrasRedutoras} />
        <CampoLista titulo="Linhas de capital de giro" descricao="Nomes exatos das linhas sujeitos ao limite maior." texto={textoCapitalGiro} onChange={setTextoCapitalGiro} />
        <CampoLista titulo="Prefixos do passivo de arrendamento" descricao="Uma conta ou prefixo por linha." texto={textoPassivoArrendamento} onChange={setTextoPassivoArrendamento} />
        <CampoLista titulo="Prefixos do ativo de direito de uso" descricao="Uma conta ou prefixo por linha." texto={textoAtivoDireitoUso} onChange={setTextoAtivoDireitoUso} />
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['limiteSinal', 'Sinal invertido (R$)'],
            ['toleranciaConferencia', 'Tolerância de conferência (R$)'],
            ['toleranciaContinuidade', 'Tolerância de continuidade (R$)'],
            ['limiteVariacaoPercentual', 'Variação percentual (%)'],
            ['limiteVariacao', 'Variação normal (R$)'],
            ['limiteVariacaoSempre', 'Variação absoluta (R$)'],
            ['limiteCapitalGiro', 'Capital de giro (R$)'],
            ['limiteArrendamento', 'Aumento de arrendamento (R$)'],
            ['limiteMovimentoPl', 'Movimento de PL (R$)'],
          ].map(([campo, titulo]) => <label key={campo} className="space-y-1 text-sm">
            <span className="block font-medium">{titulo}</span>
            <Input type="number" min="0" step={campo === 'limiteVariacaoPercentual' ? '0.1' : '0.01'} value={textosValores[campo] ?? ''} onChange={event => atualizarValor(campo, event.target.value)} />
          </label>)}
        </div>
        <div className="flex items-end">
          <Button disabled={!config || salvandoConfig} onClick={() => { void salvarConfiguracao(); }}>{salvandoConfig ? 'Salvando...' : 'Salvar parâmetros'}</Button>
        </div>
      </div>
    </details>
  </section>;
}
