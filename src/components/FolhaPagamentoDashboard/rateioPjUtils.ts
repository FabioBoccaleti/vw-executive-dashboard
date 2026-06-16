import { DESCRICAO_TRIMESTRAL, LUCRO_TRIMESTRAL_DEPARTAMENTOS, type LancamentoItem, type LancamentoPJ, type PrestadorPJ, type PrestadorSnapshotPJ, type RateioDepartamentoRateio, type TipoRemuneracao, type LucroTrimestralDepartamento } from './remPjStorage';

export interface RateioLinhaMemoria {
  itemId: string;
  itemDescricao: string;
  tipo: TipoRemuneracao;
  departamento: LucroTrimestralDepartamento;
  percentual: number;
  valorItem: number;
  valorRateado: number;
  formula: string;
}

export interface RateioDepartamentoResumo {
  departamento: LucroTrimestralDepartamento;
  base: number;
  premio: number;
  total: number;
}

export interface RateioResultado {
  totalDemonstrativo: number;
  totalRateado: number;
  diferenca: number;
  linhas: RateioLinhaMemoria[];
  departamentos: RateioDepartamentoResumo[];
  itensSemRateio: string[];
  itensSemRateioTotal: number;
}

const DEPARTAMENTOS = [...LUCRO_TRIMESTRAL_DEPARTAMENTOS];
const BASES_COM_RATEIO_AUTOMATICO = new Set(['lucro_novos_usados', 'lucro_pecas_oficina']);

function isBaseComRateioAutomatico(baseCalculo?: string): boolean {
  return !!baseCalculo && BASES_COM_RATEIO_AUTOMATICO.has(baseCalculo);
}

function parseBRL(value: number): number {
  return Math.round(value * 100) / 100;
}

function clonePrestador(prestador: PrestadorPJ | PrestadorSnapshotPJ): PrestadorPJ | PrestadorSnapshotPJ {
  return {
    ...prestador,
    itens: prestador.itens.map(item => ({
      ...item,
      rateio: item.rateio ? item.rateio.map(row => ({ ...row })) : undefined,
      departamentos: item.departamentos ? [...item.departamentos] : undefined,
    })),
    kpis: prestador.kpis ? prestador.kpis.map(kpi => ({ ...kpi })) : undefined,
    itensPremioIds: prestador.itensPremioIds ? [...prestador.itensPremioIds] : undefined,
  };
}

function normalizeRateioRows(rows?: RateioDepartamentoRateio[]): RateioDepartamentoRateio[] {
  return (rows ?? [])
    .map(row => ({
      departamento: row.departamento,
      percentual: Number.isFinite(row.percentual) ? Number(row.percentual) : 0,
    }))
    .filter(row => row.departamento && row.percentual > 0);
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeText(value: string): string {
  return (value || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPrestacaoServicoItem(item: LancamentoItem): boolean {
  return normalizeText(item.descricao).includes('PRESTACAO DE SERVICO');
}

function splitByPercentages(total: number, rows: RateioDepartamentoRateio[]): Record<LucroTrimestralDepartamento, number> {
  const result = Object.fromEntries(DEPARTAMENTOS.map(dep => [dep, 0])) as Record<LucroTrimestralDepartamento, number>;
  const normalized = normalizeRateioRows(rows);
  if (normalized.length === 0 || total === 0) return result;

  const totalPercent = normalized.reduce((sum, row) => sum + row.percentual, 0) || 100;
  let allocated = 0;

  normalized.forEach((row, index) => {
    const isLast = index === normalized.length - 1;
    const amount = isLast
      ? roundToCents(total - allocated)
      : roundToCents(total * (row.percentual / totalPercent));
    allocated += amount;
    result[row.departamento] = roundToCents((result[row.departamento] ?? 0) + amount);
  });

  return result;
}

function splitByGeneratedBases(
  item: LancamentoItem,
  prestadorItem?: PrestadorPJ['itens'][number],
): Record<LucroTrimestralDepartamento, number> | null {
  if (item.tipo !== 'variavel') return null;
  const pct = Number(item.percentualUsado ?? 0);
  const bases = item.rateioBases ?? {};
  const allowNegative = isBaseComRateioAutomatico(prestadorItem?.baseCalculo);
  const entries = (Object.entries(bases) as Array<[LucroTrimestralDepartamento, number]>)
    .map(([dep, base]) => [dep, Number(base) || 0] as const)
    .filter(([, base]) => (allowNegative ? base !== 0 : base > 0));

  if (!entries.length || pct <= 0) return null;

  const result = Object.fromEntries(DEPARTAMENTOS.map(dep => [dep, 0])) as Record<LucroTrimestralDepartamento, number>;
  const generated = entries.map(([dep, base]) => ({
    dep,
    valor: roundToCents((base * pct) / 100),
  }));
  const generatedTotal = roundToCents(generated.reduce((sum, row) => sum + row.valor, 0));
  const targetTotal = roundToCents(item.valor || generatedTotal);
  const diff = roundToCents(targetTotal - generatedTotal);

  if (generated.length > 0 && Math.abs(diff) > 0) {
    let adjustIdx = 0;
    if (diff > 0) {
      adjustIdx = generated.reduce((best, row, idx, arr) => (row.valor > arr[best].valor ? idx : best), 0);
    } else {
      adjustIdx = generated.reduce((best, row, idx, arr) => (row.valor < arr[best].valor ? idx : best), 0);
    }
    generated[adjustIdx].valor = roundToCents(generated[adjustIdx].valor + diff);
  }

  generated.forEach(row => {
    result[row.dep] = roundToCents((result[row.dep] ?? 0) + row.valor);
  });

  return result;
}

function getItemRateio(item: LancamentoItem, prestadorItem?: PrestadorPJ['itens'][number]): RateioDepartamentoRateio[] {
  if (prestadorItem?.tipo === 'variavel' && isBaseComRateioAutomatico(prestadorItem.baseCalculo)) {
    return [];
  }

  const rateioCadastro = normalizeRateioRows(prestadorItem?.rateio);
  if (rateioCadastro.length > 0) return rateioCadastro;

  if (item.descricao === DESCRICAO_TRIMESTRAL && prestadorItem?.departamentos?.length) {
    const percentual = roundToCents(100 / prestadorItem.departamentos.length);
    return prestadorItem.departamentos.map(dep => ({ departamento: dep, percentual }));
  }

  return [];
}

export function calcularRateioPJ(
  prestador: PrestadorPJ | PrestadorSnapshotPJ,
  lanc: LancamentoPJ,
): RateioResultado {
  const prestadorClone = clonePrestador(prestador);
  const linhas: RateioLinhaMemoria[] = [];
  const departamentos = Object.fromEntries(
    DEPARTAMENTOS.map(dep => [dep, { departamento: dep, base: 0, premio: 0, total: 0 }])
  ) as Record<LucroTrimestralDepartamento, RateioDepartamentoResumo>;

  const itensSemRateio: string[] = [];
  const itensPremioIds = new Set(lanc.itensPremioIds ?? []);
  const premioBaseByDept = Object.fromEntries(DEPARTAMENTOS.map(dep => [dep, 0])) as Record<LucroTrimestralDepartamento, number>;
  let deducaoPremioRestante = roundToCents(Math.max(0, Number((prestador as PrestadorPJ).deducaoBasePremio ?? 0)));
  let totalDemonstrativo = 0;
  let totalRateado = 0;

  const itensNormais = lanc.itens.filter(item => item.tipo !== 'premio');
  const itemPremio = lanc.itens.find(item => item.tipo === 'premio');

  for (const item of itensNormais) {
    const basePrestador = prestadorClone.itens.find(pItem => pItem.id === item.itemId);
    const rateio = getItemRateio(item, basePrestador);
    const valorItem = parseBRL(item.valor || 0);
    totalDemonstrativo += valorItem;

    const generatedByBase = splitByGeneratedBases(item, basePrestador);
    if (generatedByBase) {
      let allocationForPremio = generatedByBase;
      if (itensPremioIds.has(item.itemId)) {
        for (const dep of DEPARTAMENTOS) {
          premioBaseByDept[dep] = roundToCents(premioBaseByDept[dep] + (allocationForPremio[dep] ?? 0));
        }
      }

      const basesMap = item.rateioBases ?? {};
      for (const [departamento, valorRateado] of Object.entries(generatedByBase) as Array<[LucroTrimestralDepartamento, number]>) {
        if (valorRateado === 0) continue;
        const baseDept = Number(basesMap[departamento] ?? 0);
        const percentual = valorItem > 0 ? roundToCents((valorRateado / valorItem) * 100) : 0;
        departamentos[departamento].base = roundToCents(departamentos[departamento].base + valorRateado);
        departamentos[departamento].total = roundToCents(departamentos[departamento].total + valorRateado);
        totalRateado = roundToCents(totalRateado + valorRateado);
        linhas.push({
          itemId: item.itemId,
          itemDescricao: item.descricao,
          tipo: item.tipo,
          departamento,
          percentual,
          valorItem,
          valorRateado,
          formula: `${item.descricao} · ${item.percentualUsado ?? 0}% sobre base ${baseDept.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        });
      }
      continue;
    }

    if (rateio.length === 0) {
      itensSemRateio.push(item.descricao);
      continue;
    }

    const allocation = splitByPercentages(valorItem, rateio);
    let allocationForPremio = allocation;
    if (itensPremioIds.has(item.itemId)) {
      if (deducaoPremioRestante > 0 && isPrestacaoServicoItem(item)) {
        const deducaoAplicada = Math.min(valorItem, deducaoPremioRestante);
        const valorLiquidoParaPremio = roundToCents(Math.max(0, valorItem - deducaoAplicada));
        deducaoPremioRestante = roundToCents(deducaoPremioRestante - deducaoAplicada);
        allocationForPremio = splitByPercentages(valorLiquidoParaPremio, rateio);
      }
      for (const dep of DEPARTAMENTOS) {
        premioBaseByDept[dep] = roundToCents(premioBaseByDept[dep] + (allocationForPremio[dep] ?? 0));
      }
    }

    for (const [departamento, valorRateado] of Object.entries(allocation) as Array<[LucroTrimestralDepartamento, number]>) {
      if (valorRateado <= 0) continue;
      const percentual = rateio.find(row => row.departamento === departamento)?.percentual ?? 0;
      departamentos[departamento].base = roundToCents(departamentos[departamento].base + valorRateado);
      departamentos[departamento].total = roundToCents(departamentos[departamento].total + valorRateado);
      totalRateado = roundToCents(totalRateado + valorRateado);
      linhas.push({
        itemId: item.itemId,
        itemDescricao: item.descricao,
        tipo: item.tipo,
        departamento,
        percentual,
        valorItem,
        valorRateado,
        formula: `${item.descricao} · ${percentual}% de ${valorItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      });
    }
  }

  if (itemPremio) {
    const valorPremio = parseBRL(itemPremio.valor || 0);
    totalDemonstrativo += valorPremio;

    const baseTotal = roundToCents(DEPARTAMENTOS.reduce((sum, dep) => sum + (premioBaseByDept[dep] ?? 0), 0));
    const departamentosElegiveis = DEPARTAMENTOS
      .map(dep => ({ departamento: dep, basePremio: premioBaseByDept[dep] ?? 0 }))
      .filter(dep => dep.basePremio !== 0);

    if (valorPremio > 0 && baseTotal !== 0 && departamentosElegiveis.length > 0) {
      let allocatedPremio = 0;
      departamentosElegiveis.forEach((dep, index) => {
        const isLast = index === departamentosElegiveis.length - 1;
        const amount = isLast
          ? roundToCents(valorPremio - allocatedPremio)
          : roundToCents(valorPremio * (dep.basePremio / baseTotal));
        allocatedPremio = roundToCents(allocatedPremio + amount);
        departamentos[dep.departamento].premio = roundToCents(departamentos[dep.departamento].premio + amount);
        departamentos[dep.departamento].total = roundToCents(departamentos[dep.departamento].total + amount);
        totalRateado = roundToCents(totalRateado + amount);
        linhas.push({
          itemId: itemPremio.itemId,
          itemDescricao: itemPremio.descricao,
          tipo: itemPremio.tipo,
          departamento: dep.departamento,
          percentual: baseTotal > 0 ? roundToCents((dep.basePremio / baseTotal) * 100) : 0,
          valorItem: valorPremio,
          valorRateado: amount,
          formula: `${itemPremio.descricao} · proporcional à base elegível de ${dep.departamento}`,
        });
      });
    } else if (valorPremio > 0) {
      itensSemRateio.push(itemPremio.descricao);
    }
  }

  const totalRateadoFinal = roundToCents(totalRateado);
  const diferenca = roundToCents(totalDemonstrativo - totalRateadoFinal);

  return {
    totalDemonstrativo: roundToCents(totalDemonstrativo),
    totalRateado: totalRateadoFinal,
    diferenca,
    linhas,
    departamentos: Object.values(departamentos),
    itensSemRateio,
    itensSemRateioTotal: itensSemRateio.length,
  };
}

export function buildRateioTitulo(prestador: PrestadorPJ | PrestadorSnapshotPJ, year: number, month: number) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${prestador.nome} · ${months[month - 1]}/${year}`;
}
