import { z } from 'zod';
import { kvCompareAndSet, kvGet } from '@/lib/kvClient';
import { extractAccounts } from '../balanceteParser';
import { loadFluxoCaixaRaw } from '../fluxoCaixaStorage';
import {
  aplicarModeloBalancoSorana, aplicarModeloDfcPadrao, cadastroSchema, cadastroVazio, chavePeriodo, rotuloPeriodo, validarCadastro,
  type CadastroDemonstracoes, type DadosDemonstracoes, type PeriodoDemonstracao,
} from './modelo';

const KEY = 'fluxo_caixa_demonstracoes_cadastro';
const NOTAS_DFC_KEY = 'fluxo_caixa_dfc_notas';

const escopoNotaDfcSchema = z.object({
  ano: z.number().int().min(1900).max(9999),
  mes: z.number().int().min(0).max(12),
  periodo: z.enum(['mes', 'acumulado', 'anual']),
  metodo: z.enum(['direto', 'indireto']),
});
const notaDfcSchema = z.object({
  id: z.string().min(1),
  linhaId: z.string().min(1).optional(),
  linhaNome: z.string().trim().min(1).optional(),
  texto: z.string().trim().min(1).max(5000),
});
const documentoNotasDfcSchema = z.object({
  version: z.string().min(1),
  notas: z.array(notaDfcSchema).max(50),
});

export type EscopoNotaDfc = z.infer<typeof escopoNotaDfcSchema>;
export type NotaDfc = z.infer<typeof notaDfcSchema>;
export type DocumentoNotasDfc = { version: string | null; notas: NotaDfc[] };

function chaveNotasDfc(escopo: EscopoNotaDfc) {
  const valido = escopoNotaDfcSchema.safeParse(escopo);
  if (!valido.success) throw new Error('O período ou método das notas da DFC é inválido.');
  const { ano, mes, periodo, metodo } = valido.data;
  return `${NOTAS_DFC_KEY}_${ano}_${mes}_${periodo}_${metodo}`;
}

export async function loadNotasDfc(escopo: EscopoNotaDfc): Promise<DocumentoNotasDfc> {
  const data = await kvGet<unknown>(chaveNotasDfc(escopo), { throwOnError: true });
  if (data === null) return { version: null, notas: [] };
  const parsed = documentoNotasDfcSchema.safeParse(data);
  if (!parsed.success) throw new Error('As notas explicativas salvas da DFC estão inválidas.');
  return parsed.data;
}

export async function saveNotasDfc(
  escopo: EscopoNotaDfc,
  documento: DocumentoNotasDfc,
): Promise<DocumentoNotasDfc> {
  const atualizadas = documentoNotasDfcSchema.safeParse({
    version: crypto.randomUUID(),
    notas: documento.notas,
  });
  if (!atualizadas.success) throw new Error('Revise o texto das notas e tente salvar novamente.');
  await kvCompareAndSet(chaveNotasDfc(escopo), atualizadas.data, documento.version);
  return atualizadas.data;
}

export async function loadCadastroDemonstracoes(): Promise<CadastroDemonstracoes> {
  const data = await kvGet<unknown>(KEY, { throwOnError: true });
  if (data === null) return aplicarModeloBalancoSorana(aplicarModeloDfcPadrao(cadastroVazio()));
  const parsed = cadastroSchema.safeParse(data);
  if (!parsed.success) throw new Error('O cadastro salvo de demonstrações está inválido.');
  const cadastro = aplicarModeloBalancoSorana(aplicarModeloDfcPadrao(parsed.data));
  const erro = validarCadastro(cadastro);
  if (erro) throw new Error(erro);
  return cadastro;
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
  comparacoes: PeriodoDemonstracao | PeriodoDemonstracao[],
  escopo: 'dre' | 'dfc' | 'patrimonial' | 'balanco' | 'cadastros' = 'dre',
  acumulado = true,
): Promise<DadosDemonstracoes> {
  const periodos = new Map<string, PeriodoDemonstracao>();
  const periodosComparacao = Array.isArray(comparacoes) ? comparacoes : [comparacoes];
  const adicionais = escopo === 'dre' || escopo === 'dfc'
    ? principal.mes === 0
      ? periodosComparacao
      : periodosComparacao.flatMap(periodo => acumulado
        ? Array.from({ length: periodo.mes }, (_, index) => ({ ano: periodo.ano, mes: index + 1 }))
        : [periodo])
    : escopo === 'balanco'
      ? [...new Map(
        [principal, ...periodosComparacao].map(periodo => [chavePeriodo(periodo), periodo] as const),
      ).values()].flatMap(periodo => [
        periodo,
        ...Array.from({ length: periodo.mes }, (_, index) => ({ ano: periodo.ano, mes: index + 1 })),
      ])
      : escopo === 'patrimonial' ? periodosComparacao : [];
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
