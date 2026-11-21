import type { LinhaDemonstracao } from './modelo';
import { linhaPai } from './modelo';
import { DFC_INDIRETO_AJUSTES, DFC_INDIRETO_VARIACOES } from './dfcMetodoIndireto';

export function deveExibirLinhaDfc(valores: ReadonlyArray<number | null | undefined>): boolean {
  return valores.length === 0 || valores.some(valor => valor !== 0);
}

export type LinhaDfcIndiretoTabela = {
  id: string;
  nome: string;
  tipo: 'titulo' | 'grupo' | 'conta' | 'subtotal' | 'total';
};

export function criarLinhasDfcIndiretoTabela(linhas: LinhaDemonstracao[]): LinhaDfcIndiretoTabela[] {
  return [
    { id: 'titulo-operacional', nome: 'ATIVIDADES OPERACIONAIS', tipo: 'titulo' },
    { id: 'RES', nome: 'Resultado líquido do período (lucro + / prejuízo –)', tipo: 'conta' },
    { id: 'grupo-ajustes', nome: 'Ajustes ao resultado', tipo: 'grupo' },
    ...DFC_INDIRETO_AJUSTES.map(({ codigo, nome }) => ({ id: codigo, nome, tipo: 'conta' as const })),
    { id: 'resultado-ajustado', nome: 'Resultado ajustado', tipo: 'subtotal' },
    { id: 'grupo-variacoes', nome: 'Variações de ativos e passivos operacionais', tipo: 'grupo' },
    ...DFC_INDIRETO_VARIACOES.map(({ codigo, nome }) => ({ id: codigo, nome, tipo: 'conta' as const })),
    { id: 'variacoes-capital-giro', nome: 'Variações do capital de giro', tipo: 'subtotal' },
    { id: 'dfc-operacional', nome: 'CAIXA LÍQUIDO DAS ATIVIDADES OPERACIONAIS', tipo: 'total' },
    { id: 'titulo-investimento', nome: 'ATIVIDADES DE INVESTIMENTO', tipo: 'titulo' },
    ...linhas.filter(linha => linhaPai(linha) === 'dfc-investimento').map(linha => ({
      id: linha.id, nome: linha.nome, tipo: 'conta' as const,
    })),
    { id: 'dfc-investimento', nome: 'CAIXA LÍQUIDO DAS ATIVIDADES DE INVESTIMENTO', tipo: 'total' },
    { id: 'titulo-financiamento', nome: 'ATIVIDADES DE FINANCIAMENTO', tipo: 'titulo' },
    ...linhas.filter(linha => linhaPai(linha) === 'dfc-financiamento').map(linha => ({
      id: linha.id, nome: linha.nome, tipo: 'conta' as const,
    })),
    { id: 'dfc-financiamento', nome: 'CAIXA LÍQUIDO DAS ATIVIDADES DE FINANCIAMENTO', tipo: 'total' },
    { id: 'dfc-total', nome: 'VARIAÇÃO DE CAIXA PELA DFC', tipo: 'total' },
  ];
}
