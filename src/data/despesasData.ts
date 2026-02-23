/**
 * Dados do Sistema de Aprovação de Despesas
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

export const despesas: Despesa[] = [
  {
    id: '1',
    identificacaoEmitente: 'Posto Shell Center',
    numeroNotaFiscal: '45672301',
    titulo: 'Test Drive - Combustível A3 Sedan',
    descricao: 'Abastecimento para test drives realizados no mês',
    valor: 250.00,
    status: 'pendente',
    solicitante: 'Roberto Martins',
    gerenteAprovador: 'Gabriela S Mateus',
    diretorAprovador: 'Gabriela S Mateus',
    departamento: 'Veículos Novos',
    marca: 'Audi',
    categoria: 'Combustível',
    data: '2025-02-20',
  },
  {
    id: '2',
    identificacaoEmitente: 'Auto Peças Brasil Ltda',
    numeroNotaFiscal: '78934512',
    titulo: 'Peças de Reposição - Óleo Sintético',
    descricao: 'Compra de óleo sintético para estoque da oficina',
    valor: 1850.00,
    status: 'pendente',
    solicitante: 'Fernando Lima',
    gerenteAprovador: 'Orlando Chodin',
    diretorAprovador: 'Orlando Chodin',
    departamento: 'Oficina',
    marca: 'Volkswagen',
    categoria: 'Manutenção/Oficina',
    data: '2025-02-19',
  },
  {
    id: '3',
    identificacaoEmitente: 'Hotel Sede 982 Eventos',
    numeroNotaFiscal: '00298345',
    titulo: 'Evento de Lançamento Q5 Sportback',
    descricao: 'Buffet de Luxo - Hotel Sede 982',
    valor: 8500.00,
    status: 'pendente',
    solicitante: 'Camila Silvestre',
    gerenteAprovador: 'Norival Junior',
    diretorAprovador: 'Gabriela S Mateus',
    departamento: 'Administração',
    marca: 'Audi',
    categoria: 'Marketing',
    data: '2025-02-18',
  },
  {
    id: '4',
    identificacaoEmitente: 'AGÊNCIA DIGITAL VORTEX',
    numeroNotaFiscal: '56129870',
    titulo: 'Campanha Digital Tiguan',
    descricao: 'Anúncios Google Ads e Meta Ads - Janeiro 2025',
    valor: 4500.00,
    status: 'aprovado',
    solicitante: 'Carlos Andrade',
    gerenteAprovador: 'Sergio Ribeiro',
    diretorAprovador: 'Orlando Chodin',
    departamento: 'Veículos Novos',
    marca: 'Volkswagen',
    categoria: 'Marketing',
    data: '2025-01-15',
    dataAprovacao: '2025-01-16',
    aprovador: 'Diretoria',
  },
  {
    id: '5',
    identificacaoEmitente: 'Gráfica Rápida Express',
    numeroNotaFiscal: '33298776',
    titulo: 'Materiais Promocionais',
    descricao: 'Impressão de folders e banners para showroom',
    valor: 1200.00,
    status: 'aprovado',
    solicitante: 'Marina Costa',
    gerenteAprovador: 'Thiago Correira',
    diretorAprovador: 'Gabriela S Mateus',
    departamento: 'Veículos Usados',
    marca: 'Volkswagen',
    categoria: 'Marketing',
    data: '2025-01-20',
    dataAprovacao: '2025-01-21',
    aprovador: 'Diretoria',
  },
  {
    id: '6',
    identificacaoEmitente: 'TechAuto Solutions',
    numeroNotaFiscal: '90234561',
    titulo: 'Ferramentas de Diagnóstico',
    descricao: 'Atualização de software de diagnóstico',
    valor: 3200.00,
    status: 'aprovado',
    solicitante: 'João Santos',
    gerenteAprovador: 'Fabio Boccaleti',
    diretorAprovador: 'Orlando Chodin',
    departamento: 'Oficina',
    marca: 'Audi',
    categoria: 'Manutenção/Oficina',
    data: '2025-01-10',
    dataAprovacao: '2025-01-12',
    aprovador: 'Diretoria',
  },
  {
    id: '7',
    identificacaoEmitente: 'Instituto Capacitar Treinamentos',
    numeroNotaFiscal: '44567890',
    titulo: 'Treinamento Equipe Vendas',
    descricao: 'Curso de técnicas de vendas consultivas',
    valor: 2800.00,
    status: 'reprovado',
    solicitante: 'Patricia Oliveira',
    gerenteAprovador: 'Andre Simoni',
    diretorAprovador: 'Gabriela S Mateus',
    departamento: 'Venda Direta / Frotista',
    marca: 'Audi',
    categoria: 'RH',
    data: '2025-01-25',
    dataAprovacao: '2025-01-27',
    aprovador: 'Diretoria',
    observacao: 'Solicitar novo orçamento com fornecedor alternativo',
  },
  {
    id: '8',
    identificacaoEmitente: 'Papelaria Office Plus',
    numeroNotaFiscal: '11223344',
    titulo: 'Material de Escritório',
    descricao: 'Papelaria e material de expediente',
    valor: 450.00,
    status: 'aprovado',
    solicitante: 'Lucas Ferreira',
    gerenteAprovador: 'Daniel Fanti',
    diretorAprovador: 'Orlando Chodin',
    departamento: 'Administração',
    marca: 'Volkswagen',
    categoria: 'Administrativo',
    data: '2025-02-01',
    dataAprovacao: '2025-02-02',
    aprovador: 'Diretoria',
  },
  {
    id: '9',
    identificacaoEmitente: 'Auto Center Manutenção',
    numeroNotaFiscal: '88765432',
    titulo: 'Manutenção Preventiva Frota',
    descricao: 'Revisão de veículos de demonstração',
    valor: 5200.00,
    status: 'aguardando',
    solicitante: 'Ricardo Mendes',
    gerenteAprovador: 'Alexandre D Auria',
    diretorAprovador: 'Gabriela S Mateus',
    departamento: 'Oficina',
    marca: 'Volkswagen',
    categoria: 'Manutenção/Oficina',
    data: '2025-02-10',
  },
  {
    id: '10',
    identificacaoEmitente: 'Editora Abril S.A.',
    numeroNotaFiscal: '99887766',
    titulo: 'Anúncio Revista Especializada',
    descricao: 'Página dupla na revista Quatro Rodas',
    valor: 15000.00,
    status: 'aprovado',
    solicitante: 'Amanda Silva',
    gerenteAprovador: 'Gabriela S Mateus',
    diretorAprovador: 'Orlando Chodin',
    departamento: 'Diretoria',
    marca: 'Audi',
    categoria: 'Marketing',
    data: '2025-01-05',
    dataAprovacao: '2025-01-08',
    aprovador: 'Diretoria',
  },
];

export const atividadesRecentes: AtividadeRecente[] = [
  {
    id: '1',
    tipo: 'aprovado',
    titulo: 'Despesa aprovada',
    solicitante: 'Carlos Andrade',
    departamento: 'Veículos Novos - Campanha Digital',
    valor: 4500.00,
    data: '08:10:25',
  },
  {
    id: '2',
    tipo: 'reprovado',
    titulo: 'Despesa reprovada',
    solicitante: 'Patricia Oliveira',
    departamento: 'Venda Direta / Frotista - Treinamento',
    valor: 2800.00,
    data: '18:17:00 - Ontem',
  },
  {
    id: '3',
    tipo: 'aprovado',
    titulo: 'Despesa aprovada',
    solicitante: 'André Pereira',
    departamento: 'Oficina - Manutenção',
    valor: 1450.00,
    data: '13:18:05 - 17/02',
  },
  {
    id: '4',
    tipo: 'submetido',
    titulo: 'Nova despesa submetida',
    solicitante: 'Juliana Santos',
    departamento: 'Administração - Marketing Digital',
    valor: 9200.00,
    data: '22:38:40 - 17/02',
  },
];

// Estatísticas agregadas
export const estatisticas = {
  aguardando: {
    quantidade: 3,
    valor: 8990.00,
    percentual: 8.8,
    tipo: 'mes_anterior' as const,
  },
  aprovado: {
    quantidade: 6,
    valor: 450.00,
    percentual: 4.7,
    tipo: 'mes_anterior' as const,
  },
  reprovado: {
    quantidade: 1,
    valor: 5220.00,
    percentual: 9.54,
    tipo: 'mes_anterior' as const,
  },
  total: {
    quantidade: 10,
    valor: 5220.00,
    percentual: 9.54,
    tipo: 'mes_anterior' as const,
  },
};

// Despesas por marca
export const despesasPorMarca = [
  { marca: 'Volkswagen', valor: 12500.00 },
  { marca: 'Audi', valor: 9250.00 },
];

// Despesas por categoria
export const despesasPorCategoria = [
  { categoria: 'Marketing', valor: 4500.00 },
  { categoria: 'Vendas', valor: 2400.00 },
  { categoria: 'Manutenção/Oficina', valor: 2100.00 },
  { categoria: 'RH', valor: 900.00 },
  { categoria: 'Combustível', valor: 850.00 },
  { categoria: 'Administrativo', valor: 300.00 },
];

// Despesas por departamento
export const despesasPorDepartamento = [
  { departamento: 'Veículos Novos', valor: 8500 },
  { departamento: 'Veículos Usados', valor: 6200 },
  { departamento: 'Venda Direta / Frotista', valor: 4800 },
  { departamento: 'Peças', valor: 3500 },
  { departamento: 'Oficina', valor: 5100 },
  { departamento: 'Funilaria', valor: 2900 },
  { departamento: 'Acessórios', valor: 1800 },
  { departamento: 'Administração', valor: 4200 },
  { departamento: 'Diretoria', valor: 7500 },
];
