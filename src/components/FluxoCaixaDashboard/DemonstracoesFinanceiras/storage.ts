import { kvCompareAndSet, kvGet } from '@/lib/kvClient';
import { extractAccounts } from '../balanceteParser';
import { loadFluxoCaixaRaw } from '../fluxoCaixaStorage';
import {
  cadastroSchema, cadastroVazio, chavePeriodo, rotuloPeriodo, validarCadastro,
  type CadastroDemonstracoes, type DadosDemonstracoes, type PeriodoDemonstracao,
} from './modelo';

const KEY = 'fluxo_caixa_demonstracoes_cadastro';

export async function loadCadastroDemonstracoes(): Promise<CadastroDemonstracoes> {
  const data = await kvGet<unknown>(KEY, { throwOnError: true });
  if (data === null) return cadastroVazio();
  const parsed = cadastroSchema.safeParse(data);
  if (!parsed.success) throw new Error('O cadastro salvo de demonstrações está inválido.');
  const erro = validarCadastro(parsed.data);
  if (erro) throw new Error(erro);
  return parsed.data;
}

export async function saveCadastroDemonstracoes(cadastro: CadastroDemonstracoes): Promise<CadastroDemonstracoes> {
  const erro = validarCadastro(cadastro);
  if (erro) throw new Error(erro);
  const atualizada = { ...cadastro, version: crypto.randomUUID() };
  await kvCompareAndSet(KEY, atualizada, cadastro.version || null);
  return atualizada;
}

export async function loadDadosDemonstracoes(
  principal: PeriodoDemonstracao,
  comparacao: PeriodoDemonstracao,
  escopo: 'dre' | 'patrimonial' | 'cadastros' = 'dre',
): Promise<DadosDemonstracoes> {
  const periodos = new Map<string, PeriodoDemonstracao>();
  const adicionais = escopo === 'dre'
    ? Array.from({ length: principal.mes }, (_, index) => ({ ano: principal.ano, mes: index + 1 }))
    : escopo === 'patrimonial' ? [comparacao] : [];
  for (const periodo of [
    principal, ...adicionais,
  ]) {
    periodos.set(chavePeriodo(periodo), periodo);
  }
  const entradas = await Promise.all([...periodos].map(async ([key, periodo]) => {
    const raw = await loadFluxoCaixaRaw(periodo.ano, periodo.mes, { throwOnError: true });
    if (!raw) return [key, null] as const;
    try {
      const contas = extractAccounts(raw.rawText, { strict: true });
      if (Object.keys(contas).length === 0) throw new Error('O arquivo não contém contas.');
      return [key, contas] as const;
    } catch (error) {
      throw new Error(`Balancete ${rotuloPeriodo(periodo)}: ${error instanceof Error ? error.message : String(error)} Corrija o arquivo e importe-o novamente em Novo Arquivo.`);
    }
  }));
  return Object.fromEntries(entradas);
}
