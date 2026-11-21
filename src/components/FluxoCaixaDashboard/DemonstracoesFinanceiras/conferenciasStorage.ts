import { z } from 'zod';
import { kvCompareAndSet, kvGet } from '@/lib/kvClient';

const KEY = 'fluxo_caixa_demonstracoes_conferencias';

const naturezaSchema = z.enum(['devedora', 'credora']);
const conferenciaConfigSchema = z.object({
  version: z.string(),
  naturezaPorGrupo: z.record(z.string(), naturezaSchema),
  naturezaExcecoes: z.array(z.object({ prefixo: z.string().trim().min(1), natureza: naturezaSchema })),
  prefixosExcluidosSinal: z.array(z.string().trim().min(1)),
  palavrasRedutoras: z.array(z.string().trim().min(1)),
  limiteSinalCentavos: z.number().int().nonnegative(),
  toleranciaConferenciaCentavos: z.number().int().nonnegative(),
  toleranciaContinuidadeCentavos: z.number().int().nonnegative(),
  limiteVariacaoPercentual: z.number().nonnegative(),
  limiteVariacaoCentavos: z.number().int().nonnegative(),
  limiteVariacaoSempreCentavos: z.number().int().nonnegative(),
  limiteCapitalGiroCentavos: z.number().int().nonnegative(),
  linhasCapitalGiro: z.array(z.string().trim().min(1)),
  prefixosPassivoArrendamento: z.array(z.string().trim().min(1)),
  prefixosAtivoDireitoUso: z.array(z.string().trim().min(1)),
  limiteArrendamentoCentavos: z.number().int().nonnegative(),
  limiteMovimentoPlCentavos: z.number().int().nonnegative(),
});

export type ConferenciasConfig = z.infer<typeof conferenciaConfigSchema>;

export const CONFERENCIAS_CONFIG_PADRAO: ConferenciasConfig = {
  version: '',
  naturezaPorGrupo: {
    '1': 'devedora',
    '2': 'credora',
    '3': 'credora',
    '4': 'devedora',
    '5': 'devedora',
  },
  naturezaExcecoes: [
    ...['1.1.8', '1.2.1.07', '1.2.4.02', '1.2.5.02', '1.5.5.02', '1.5.7.02', '1.5.8.02']
      .map(prefixo => ({ prefixo, natureza: 'credora' as const })),
    ...['2.1.2.03.02.099', '2.2.1.15.20.099', '2.3.1.02', '2.3.3.02', '3.2', '3.3', '3.4.4', '3.5.9']
      .map(prefixo => ({ prefixo, natureza: 'devedora' as const })),
    { prefixo: '6.4', natureza: 'devedora' },
  ],
  prefixosExcluidosSinal: ['1.1.1', '1.1.3.01.02', '1.1.4', '1.4', '2.1.3.09', '2.3.3.01', '2.5'],
  palavrasRedutoras: ['(-)', 'REDUTORA', 'ACUMULADA', 'A INCORRER'],
  limiteSinalCentavos: 1_000_000,
  toleranciaConferenciaCentavos: 100,
  toleranciaContinuidadeCentavos: 100,
  limiteVariacaoPercentual: 50,
  limiteVariacaoCentavos: 30_000_000,
  limiteVariacaoSempreCentavos: 200_000_000,
  limiteCapitalGiroCentavos: 500_000_000,
  linhasCapitalGiro: [
    'Recebimentos de clientes',
    'Pagamentos a fornecedores e floor plan',
    'Estoques',
    'Floor plan',
    'Clientes e créditos de vendas',
    'Adiantamentos a fornecedores',
    'Adiantamentos de clientes',
  ],
  prefixosPassivoArrendamento: ['2.1.2.03.02', '2.2.1.15', '2.1.2.03.01.009', '2.2.1.15.20.055'],
  prefixosAtivoDireitoUso: ['1.5.5.01.30', '1.5.7.01.01.055', '1.5.7.02.01.055'],
  limiteArrendamentoCentavos: 10_000_000,
  limiteMovimentoPlCentavos: 100_000,
};

export async function loadConferenciasConfig(): Promise<ConferenciasConfig> {
  const saved = await kvGet<unknown>(KEY, { throwOnError: true });
  if (saved === null) return CONFERENCIAS_CONFIG_PADRAO;
  const parsed = conferenciaConfigSchema.safeParse(saved);
  if (!parsed.success) throw new Error('Os parâmetros salvos das conferências estão inválidos.');
  return parsed.data;
}

export async function saveConferenciasConfig(config: ConferenciasConfig): Promise<ConferenciasConfig> {
  const parsed = conferenciaConfigSchema.safeParse({ ...config, version: crypto.randomUUID() });
  if (!parsed.success) throw new Error('Revise os parâmetros das conferências antes de salvar.');
  await kvCompareAndSet(KEY, parsed.data, config.version || null);
  return parsed.data;
}
