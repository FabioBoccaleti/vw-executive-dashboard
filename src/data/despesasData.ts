/**
 * Dados do Sistema de Gerenciamento e Aprovação de Despesas
 */

export interface Despesa {
  id: string;
  identificacaoEmitente: string;
  numeroNotaFiscal: string;
  imagemNotaFiscal?: string;
  titulo: string;
  descricao: string;
  valor: number;
  status: 'aguardando' | 'aprovado' | 'reprovado' | 'pendente';
  solicitante: string;
  gerenteAprovador: string;
  diretorAprovador: string;
  departamento: string;
  marca: string;
  categoria: string;
  data: string;
  dataAprovacao?: string;
  aprovador?: string;
  observacao?: string;
}

export interface AtividadeRecente {
  id: string;
  tipo: 'aprovado' | 'reprovado' | 'submetido';
  titulo: string;
  solicitante: string;
  departamento: string;
  valor: number;
  data: string;
}

export const despesas: Despesa[] = [];

export const atividadesRecentes: AtividadeRecente[] = [];

// Estatísticas agregadas
export const estatisticas = {
  aguardando: {
    quantidade: 0,
    valor: 0.00,
    percentual: 0,
    tipo: 'mes_anterior' as const,
  },
  aprovado: {
    quantidade: 0,
    valor: 0.00,
    percentual: 0,
    tipo: 'mes_anterior' as const,
  },
  reprovado: {
    quantidade: 0,
    valor: 0.00,
    percentual: 0,
    tipo: 'mes_anterior' as const,
  },
  total: {
    quantidade: 0,
    valor: 0.00,
    percentual: 0,
    tipo: 'mes_anterior' as const,
  },
};

// Despesas por marca
export const despesasPorMarca: { marca: string; valor: number }[] = [];

// Despesas por categoria
export const despesasPorCategoria: { categoria: string; valor: number }[] = [];

// Despesas por departamento
export const despesasPorDepartamento: { departamento: string; valor: number }[] = [];
