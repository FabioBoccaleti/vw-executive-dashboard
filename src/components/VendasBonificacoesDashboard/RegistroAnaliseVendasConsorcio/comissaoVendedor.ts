import { parsePercentualCadastro, type ProdutoConsorcio, type RegraComissaoConsorcio } from './cadastroStorage';

export function validarCronograma(regra: RegraComissaoConsorcio, parcelasSorana: number): string | null {
  if (regra.pagamento !== 'cronograma') return null;
  if (regra.percentuaisParcelas?.length !== parcelasSorana) {
    return 'Configure o percentual de cada parcela do cronograma conforme o produto.';
  }
  if (regra.percentuaisParcelas.some(value => {
    const percentual = parsePercentualCadastro(value);
    return percentual === null || percentual < 0 || percentual > 100;
  })) {
    return 'Informe percentuais entre 0 e 100% em todas as parcelas. Use 0% nas parcelas sem comissão.';
  }
  return null;
}

export function calcularComissaoVendedor(
  regra: RegraComissaoConsorcio,
  produto: ProdutoConsorcio,
  valorCarta: number,
  aliquotaImposto: number,
): { total: number; parcelas: number[] } {
  const erro = validarCronograma(regra, produto.parcelasSorana);
  if (erro) throw new Error(erro);
  const percentualSorana = parsePercentualCadastro(produto.percentualSorana);
  if (percentualSorana === null) throw new Error('Percentual da Sorana inválido.');
  const bruta = valorCarta * percentualSorana / 100;
  const base = regra.base === 'valor_carta'
    ? valorCarta
    : regra.base === 'bruta' ? bruta : bruta * (1 - aliquotaImposto / 100);

  if (regra.pagamento === 'cronograma' && regra.percentuaisParcelas) {
    const baseParcela = regra.base === 'valor_carta' ? base : base / produto.parcelasSorana;
    const parcelas = regra.percentuaisParcelas.map(value => {
      const percentual = parsePercentualCadastro(value);
      if (percentual === null) throw new Error('Percentual da parcela inválido.');
      return baseParcela * percentual / 100;
    });
    return { total: parcelas.reduce((sum, value) => sum + value, 0), parcelas };
  }

  const percentual = parsePercentualCadastro(regra.percentual);
  if (percentual === null) throw new Error('Percentual de comissão do vendedor inválido.');
  const total = base * percentual / 100;
  const parcelas = Array.from({ length: produto.parcelasSorana }, (_, index) =>
    regra.pagamento === 'unica' ? (index === 0 ? total : 0) : total / produto.parcelasSorana);
  return { total, parcelas };
}
