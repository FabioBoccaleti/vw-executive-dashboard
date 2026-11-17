import {
  analyze, computeKpis, parseDuplicatas, resumoPorDepartamento, topClientesPorValor,
  type Duplicata,
} from '@/components/DuplicatasReceberDashboard/duplicatasAnalise';
import type { MultasImport } from './multasStorage';

export function parseMultas(data: Pick<MultasImport, 'headers' | 'rows'>, referenceDate: Date): Duplicata[] {
  return parseDuplicatas(data, {}, referenceDate).map(titulo => ({
    ...titulo,
    departamento: titulo.deptNomeArquivo || titulo.deptNumero || 'Não informado',
  }));
}

export function analisarMultas(titulos: Duplicata[]) {
  const dated = analyze(titulos.filter(titulo => titulo.vencimento !== null));
  const semVencimento = titulos.filter(titulo => titulo.vencimento === null);
  return {
    ...dated,
    kpis: { ...computeKpis(titulos), totalAVencer: dated.kpis.totalAVencer },
    semVencimento: {
      qtd: semVencimento.length,
      valor: semVencimento.reduce((total, titulo) => total + titulo.valor, 0),
    },
    departamentos: resumoPorDepartamento(titulos).map(departamento => ({
      ...departamento,
      aVencer: departamento.duplicatas.filter(titulo => titulo.vencimento && !titulo.vencido)
        .reduce((total, titulo) => total + titulo.valor, 0),
      semVencimento: departamento.duplicatas.filter(titulo => !titulo.vencimento)
        .reduce((total, titulo) => total + titulo.valor, 0),
    })),
    topClientes: topClientesPorValor(titulos),
  };
}

export const fmtMultasBRL = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtMultasInt = (valor: number) => valor.toLocaleString('pt-BR');
