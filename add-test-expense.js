// Script para adicionar uma despesa de teste com imagem
// Cole este código no console do navegador (F12 -> Console)

// Imagem de teste pequena (um quadrado verde com texto)
const testImage = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'800\' height=\'600\'%3E%3Crect fill=\'%2334D399\' width=\'800\' height=\'600\'/%3E%3Ctext x=\'50%25\' y=\'40%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' font-family=\'Arial\' font-size=\'48\' fill=\'white\' font-weight=\'bold\'%3ENOTA FISCAL%3C/text%3E%3Ctext x=\'50%25\' y=\'55%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' font-family=\'Arial\' font-size=\'24\' fill=\'white\'%3EImagem de Teste%3C/text%3E%3Ctext x=\'50%25\' y=\'65%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' font-family=\'Arial\' font-size=\'18\' fill=\'white\'%3EClique para ver em tamanho maior%3C/text%3E%3C/svg%3E';

// Carregar dados existentes
const storageKey = 'aprovacao_despesas_data';
let state = JSON.parse(localStorage.getItem(storageKey) || '{"despesas":[],"lastUpdate":""}');

// Adicionar nova despesa de teste
const newExpense = {
  id: String(Math.max(...state.despesas.map(d => parseInt(d.id) || 0), 0) + 1),
  identificacaoEmitente: 'Empresa Teste Ltda',
  numeroNotaFiscal: '99999999',
  imagemNotaFiscal: testImage,
  titulo: 'Blindagem Veiculo Diretoria',
  descricao: 'PRESTACAO DE SERVICOS NO VEICULO AUDI Q5 25/25 AZUL - CHASSI WAUAKDGU4S2097111',
  valor: 1000.00,
  status: 'pendente',
  solicitante: 'Fabio Boccaleti',
  gerenteAprovador: 'Orlando Chodin',
  diretorAprovador: 'Gabriela S Mateus',
  departamento: 'Diretoria',
  marca: 'Audi',
  categoria: 'Administrativo',
  data: '2026-02-22'
};

state.despesas.unshift(newExpense);
state.lastUpdate = new Date().toISOString();

localStorage.setItem(storageKey, JSON.stringify(state));

console.log('✅ Despesa de teste adicionada com sucesso!');
console.log('Recarregue a página para ver a nova despesa');
console.log('Despesa:', newExpense);
