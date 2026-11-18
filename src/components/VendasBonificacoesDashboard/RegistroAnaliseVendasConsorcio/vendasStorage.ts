import { kvCompareAndSet, kvGet, kvKeys } from '@/lib/kvClient';
import { parsePercentualCadastro, type CadastroConsorcio, type ProdutoConsorcio, type RegraComissaoConsorcio, type VendedorConsorcio } from './cadastroStorage';
import { calcularComissaoVendedor } from './comissaoVendedor';
import { dataValida, emCentavos } from './valores';

const PREFIX = 'consorcio_venda_';

export interface RecebimentoConsorcio {
  id: string;
  data: string;
  valorCentavos: number;
}

export interface ParcelaConsorcio {
  numero: number;
  valorCentavos: number;
  recebimentos: RecebimentoConsorcio[];
}

export interface VendaConsorcio {
  id: string;
  version: string;
  criadaEm: string;
  dataVenda: string;
  cliente: string;
  grupoCota: string;
  valorCartaCentavos: number;
  produto: ProdutoConsorcio;
  vendedor: VendedorConsorcio;
  cargoNome: string;
  regraComissao: RegraComissaoConsorcio;
  aliquotaImposto: string;
  comissaoBrutaCentavos: number;
  impostoCentavos: number;
  comissaoLiquidaCentavos: number;
  remuneracaoVendedorCentavos: number;
  parcelas: ParcelaConsorcio[];
}

export interface DadosNovaVendaConsorcio {
  id: string;
  dataVenda: string;
  cliente: string;
  grupoCota: string;
  valorCarta: number;
  produtoId: string;
  vendedorId: string;
}

function percentualValido(value: string, label: string): number {
  const parsed = parsePercentualCadastro(value);
  if (parsed === null || parsed < 0 || parsed > 100) throw new Error(`${label}: informe um percentual entre 0 e 100%.`);
  return parsed;
}

export function criarVendaConsorcio(dados: DadosNovaVendaConsorcio, cadastro: CadastroConsorcio): VendaConsorcio {
  if (!dados.id || !dataValida(dados.dataVenda) || !dados.cliente.trim() || !dados.grupoCota.trim()) {
    throw new Error('Informe a data da venda, o cliente e o grupo / cota.');
  }
  const valorCartaCentavos = emCentavos(dados.valorCarta);
  if (valorCartaCentavos <= 0) throw new Error('O valor da carta deve ser maior que zero.');
  const produto = cadastro.produtos.find(item => item.id === dados.produtoId);
  const vendedor = cadastro.vendedores.find(item => item.id === dados.vendedorId);
  if (!produto || !vendedor) throw new Error('Selecione um produto e um vendedor cadastrados.');
  const cargo = cadastro.cargos.find(item => item.id === vendedor.cargoId);
  const regra = cadastro.regrasComissao.find(item => item.produtoId === produto.id && item.cargoId === vendedor.cargoId);
  if (!cargo || !regra) throw new Error('Configure o cargo e a regra de comissão para este vendedor e produto.');
  if (!Number.isInteger(produto.parcelasSorana) || produto.parcelasSorana < 1 || produto.parcelasSorana > 10) {
    throw new Error('O produto deve ter entre 1 e 10 parcelas.');
  }
  const percentual = percentualValido(produto.percentualSorana, 'Comissão da Sorana');
  const aliquota = percentualValido(cadastro.aliquotaImposto, 'Alíquota de imposto');
  if (regra.pagamento !== 'cronograma') percentualValido(regra.percentual, 'Comissão do vendedor');
  const comissao = calcularComissaoVendedor(regra, produto, valorCartaCentavos / 100, aliquota);
  const comissaoBrutaCentavos = Math.round(valorCartaCentavos * percentual / 100);
  const impostoCentavos = Math.round(comissaoBrutaCentavos * aliquota / 100);
  const valorParcela = Math.floor(comissaoBrutaCentavos / produto.parcelasSorana);
  return {
    id: dados.id,
    dataVenda: dados.dataVenda,
    version: crypto.randomUUID(),
    criadaEm: new Date().toISOString(),
    cliente: dados.cliente.trim(),
    grupoCota: dados.grupoCota.trim(),
    valorCartaCentavos,
    produto: { ...produto },
    vendedor: { ...vendedor },
    cargoNome: cargo.nome,
    regraComissao: { ...regra, ...(regra.percentuaisParcelas ? { percentuaisParcelas: [...regra.percentuaisParcelas] } : {}) },
    aliquotaImposto: cadastro.aliquotaImposto,
    comissaoBrutaCentavos,
    impostoCentavos,
    comissaoLiquidaCentavos: comissaoBrutaCentavos - impostoCentavos,
    remuneracaoVendedorCentavos: emCentavos(comissao.total),
    parcelas: Array.from({ length: produto.parcelasSorana }, (_, index) => ({
      numero: index + 1,
      valorCentavos: valorParcela + (index === produto.parcelasSorana - 1 ? comissaoBrutaCentavos % produto.parcelasSorana : 0),
      recebimentos: [],
    })),
  };
}

export function recebidoParcela(parcela: ParcelaConsorcio): number {
  return parcela.recebimentos.reduce((total, item) => total + item.valorCentavos, 0);
}

export function saldoParcela(parcela: ParcelaConsorcio): number {
  return parcela.valorCentavos - recebidoParcela(parcela);
}

export function resumoVenda(venda: VendaConsorcio) {
  const recebidoCentavos = venda.parcelas.reduce((total, parcela) => total + recebidoParcela(parcela), 0);
  const saldoCentavos = venda.comissaoBrutaCentavos - recebidoCentavos;
  return {
    recebidoCentavos,
    saldoCentavos,
    quitada: venda.parcelas.every(parcela => saldoParcela(parcela) === 0),
    parcelasRecebidas: venda.parcelas.filter(parcela => saldoParcela(parcela) === 0).length,
  };
}

export async function loadVendasConsorcio(): Promise<VendaConsorcio[]> {
  const keys = await kvKeys(`${PREFIX}*`, { throwOnError: true });
  const vendas: VendaConsorcio[] = [];
  for (let index = 0; index < keys.length; index += 20) {
    const batch = await Promise.all(keys.slice(index, index + 20).map(async key => {
      const venda = await kvGet<VendaConsorcio>(key, { throwOnError: true });
      if (!venda) throw new Error('Uma venda não foi encontrada. Atualize a listagem.');
      return venda;
    }));
    vendas.push(...batch);
  }
  return vendas.sort((a, b) => b.dataVenda.localeCompare(a.dataVenda) || b.criadaEm.localeCompare(a.criadaEm));
}

export async function saveNovaVendaConsorcio(venda: VendaConsorcio): Promise<void> {
  await kvCompareAndSet(`${PREFIX}${venda.id}`, venda, null);
}

export async function registrarRecebimentoConsorcio(
  vendaId: string,
  numeroParcela: number,
  recebimento: RecebimentoConsorcio,
): Promise<VendaConsorcio> {
  const key = `${PREFIX}${vendaId}`;
  const venda = await kvGet<VendaConsorcio>(key, { throwOnError: true });
  if (!venda) throw new Error('Venda não encontrada. Atualize a listagem.');
  const parcela = venda.parcelas.find(item => item.numero === numeroParcela);
  if (!parcela) throw new Error('Parcela não encontrada.');
  if (!recebimento.id || !dataValida(recebimento.data)) throw new Error('Informe uma data de recebimento válida.');
  const existente = venda.parcelas.flatMap(item => item.recebimentos).find(item => item.id === recebimento.id);
  if (existente) {
    if (parcela.recebimentos.some(item => item.id === existente.id) && existente.data === recebimento.data && existente.valorCentavos === recebimento.valorCentavos) return venda;
    throw new Error('Este recebimento já foi registrado com outros dados. Atualize a listagem.');
  }
  if (!Number.isSafeInteger(recebimento.valorCentavos) || recebimento.valorCentavos <= 0 || recebimento.valorCentavos > saldoParcela(parcela)) {
    throw new Error('O recebimento deve ser maior que zero e não pode ultrapassar o saldo da parcela.');
  }
  const atualizada: VendaConsorcio = {
    ...venda,
    version: crypto.randomUUID(),
    parcelas: venda.parcelas.map(item => item.numero === numeroParcela
      ? { ...item, recebimentos: [...item.recebimentos, { ...recebimento }] }
      : item),
  };
  await kvCompareAndSet(key, atualizada, venda.version);
  return atualizada;
}
