import { loadFluxoCaixaRaw, type FluxoCaixaRaw } from '../fluxoCaixaStorage';
import { loadImportSnapshots, loadImportSnapshotText, type ImportSnapshot } from '../importHistoryStorage';
import { extractAccounts } from '../balanceteParser';
import type { CadastroDemonstracoes, ContasBalancete } from './modelo';
import {
  calcularDiferencaLinhasSnapshots, compararSnapshotsBalancete, construirConferencias,
  type ComparacaoContaSnapshot, type EntradaConferencias, type ResultadoConferencia,
} from './conferenciasModelo';
import { loadConferenciasConfig, type ConferenciasConfig } from './conferenciasStorage';

export interface DadosPainelConferencias {
  entrada: EntradaConferencias;
  currentTimestamp: number | null;
  currentSnapshotId: string | null;
}

export interface ComparacaoSnapshots {
  rotulo: string;
  referencia: ImportSnapshot;
  contas: ComparacaoContaSnapshot[];
  linhas: ReturnType<typeof calcularDiferencaLinhasSnapshots>;
}

export interface ConferenciasExportacao {
  ano: number;
  mes: number;
  config: ConferenciasConfig;
  resultados: ResultadoConferencia[];
  snapshots: ImportSnapshot[];
  comparacoes: ComparacaoSnapshots[];
}

type CacheBalancetes = Map<string, Promise<{ raw: FluxoCaixaRaw | null; contas: ContasBalancete | null }>>;

const dataHora = (timestamp: number) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short',
}).format(timestamp);

function contaBalancete(rawText: string | null, periodo: string): ContasBalancete | null {
  if (rawText === null) return null;
  try {
    const contas = extractAccounts(rawText, { strict: true });
    if (Object.keys(contas).length === 0) throw new Error('Nenhuma conta válida foi encontrada.');
    return contas;
  } catch (error) {
    throw new Error(`Balancete ${periodo}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function carregarDadosPainel(
  selectedYear: number,
  selectedMonth: number,
  cadastro: CadastroDemonstracoes,
  config: ConferenciasConfig,
  cache: CacheBalancetes = new Map(),
): Promise<DadosPainelConferencias> {
  const mesesDoAno = Array.from({ length: 12 }, (_, index) => ({ ano: selectedYear, mes: index + 1 }));
  const mesesAnteriores = selectedMonth > 0
    ? Array.from({ length: 3 }, (_, index) => {
      const date = new Date(selectedYear, selectedMonth - 4 + index, 1);
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
  const pares = await Promise.all([...chaves].map(async ([chave, periodo]) => {
    let carregamento = cache.get(chave);
    if (!carregamento) {
      carregamento = loadFluxoCaixaRaw(periodo.ano, periodo.mes, { throwOnError: true }).then(raw => ({
        raw, contas: contaBalancete(raw?.rawText ?? null, chave),
      }));
      cache.set(chave, carregamento);
    }
    return [chave, await carregamento] as const;
  }));
  const dados = new Map(pares);
  const obter = (ano: number, mes: number) => dados.get(`${ano}_${mes}`)?.contas ?? null;
  const rawAtual = dados.get(`${selectedYear}_${selectedMonth}`)?.raw;
  const atual = obter(selectedYear, selectedMonth);
  const mesesDoAnoComContas = mesesDoAno.map(periodo => ({ ...periodo, contas: obter(periodo.ano, periodo.mes) }));

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
      mesesAnteriores: mesesAnteriores.map(periodo => ({ ...periodo, contas: obter(periodo.ano, periodo.mes) })),
      cadastro,
      config,
    },
    currentTimestamp: rawAtual?.timestamp ?? null,
    currentSnapshotId: rawAtual?.snapshotId ?? null,
  };
}

export async function carregarComparacoesSnapshots(
  historico: ImportSnapshot[],
  dados: DadosPainelConferencias,
  cadastro: CadastroDemonstracoes,
): Promise<ComparacaoSnapshots[]> {
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
  const atual = dados.entrada.atual;
  if (!atual) return [];
  return Promise.all(candidatos.map(async candidato => {
    const texto = await loadImportSnapshotText(candidato.referencia);
    const contasReferencia = contaBalancete(texto, `snapshot ${dataHora(candidato.referencia.importedAt)}`)!;
    return {
      ...candidato,
      contas: compararSnapshotsBalancete(contasReferencia, atual, 100),
      linhas: calcularDiferencaLinhasSnapshots(cadastro, contasReferencia, atual, 100),
    };
  }));
}

export async function carregarConferenciasExportacao(
  ano: number, mes: number, cadastro: CadastroDemonstracoes,
): Promise<ConferenciasExportacao> {
  const [config, snapshots] = await Promise.all([loadConferenciasConfig(), loadImportSnapshots(ano, mes)]);
  const dados = await carregarDadosPainel(ano, mes, cadastro, config);
  const comparacoes = await carregarComparacoesSnapshots(snapshots, dados, cadastro);
  return { ano, mes, config, resultados: construirConferencias(dados.entrada), snapshots, comparacoes };
}

export async function carregarConferenciasPeriodosExportacao(
  anos: number[], mesLimite: number, cadastro: CadastroDemonstracoes,
): Promise<ConferenciasExportacao[]> {
  if (!anos.length || new Set(anos).size !== anos.length) {
    throw new Error('Selecione ao menos um ano, sem duplicidades, para exportar.');
  }
  if (!Number.isInteger(mesLimite) || mesLimite < 1 || mesLimite > 12) {
    throw new Error('O mês final da exportação deve estar entre janeiro e dezembro.');
  }
  const config = await loadConferenciasConfig();
  const cache: CacheBalancetes = new Map();
  const conferencias: ConferenciasExportacao[] = [];
  for (const ano of anos) {
    for (let mes = 1; mes <= mesLimite; mes++) {
      const [dados, snapshots] = await Promise.all([
        carregarDadosPainel(ano, mes, cadastro, config, cache),
        loadImportSnapshots(ano, mes),
      ]);
      const comparacoes = await carregarComparacoesSnapshots(snapshots, dados, cadastro);
      conferencias.push({ ano, mes, config, resultados: construirConferencias(dados.entrada), snapshots, comparacoes });
    }
  }
  return conferencias;
}
