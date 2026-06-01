/**
 * Persistência dos dados de Análise Evolutiva de Despesas por marca (VW / Audi).
 * Chaveamento: analise_despesas_{brand}_{YYYY}_{MM}
 * Tipos:       analise_despesas_tipos_{brand}
 */

import { kvGet, kvSet, kvKeys, kvBulkGet } from '@/lib/kvClient';

export type AnaliseBrand = 'vw' | 'audi';

export interface AnaliseDespesasRaw {
  rawText: string;
  fileName?: string;
  timestamp?: number;
}

export interface RateioCirculanteConfig {
  shared: {
    ativo: string[];
    passivo: string[];
  };
  vw: {
    ativo: string[];
    passivo: string[];
  };
  audi: {
    ativo: string[];
    passivo: string[];
  };
}

export interface RateioResultadoLinha {
  id: string;
  label: string;
  value: number;
}

export type RateioResultadosBrandYearData = Record<number, RateioResultadoLinha[]>;
export type RateioEndividamentoBrandYearData = Record<number, string[]>;
export type RateioTaxaJurosYearData = Record<number, number>;
export type RateioDepartamentoName = 'novos' | 'vendaDireta' | 'usados' | 'pecas' | 'oficina' | 'funilaria';

export interface RateioDepartamentoValores {
  novos: number;
  vendaDireta: number;
  usados: number;
  pecas: number;
  oficina: number;
  funilaria: number;
}

export type RateioDepartamentoBrandYearData = Record<number, Record<string, RateioDepartamentoValores>>;

export interface RateioAssinaturaDigital {
  username: string;
  name?: string;
  dataHora: string;
}

export type RateioContabilAssinaturasYearData = Record<number, RateioAssinaturaDigital | null>;

export interface RateioOutrosBancosLinha {
  id: string;
  instituicao: string;
  juros: number;
}

export type RateioOutrosBancosYearData = Record<number, RateioOutrosBancosLinha[]>;

export interface RateioOutrosBancosDepartamentosMonthData {
  vw: RateioDepartamentoName[];
  audi: RateioDepartamentoName[];
}

export type RateioOutrosBancosDepartamentosYearData = Record<number, RateioOutrosBancosDepartamentosMonthData>;

function getKey(brand: AnaliseBrand, year: number, month: number): string {
  const mm = String(month).padStart(2, '0');
  return `analise_despesas_${brand}_${year}_${mm}`;
}

function getTiposKey(brand: AnaliseBrand): string {
  return `analise_despesas_tipos_${brand}`;
}

function getRateioConfigKey(): string {
  return 'analise_despesas_rateio_circulante_config';
}

function getRateioResultadosKey(brand: AnaliseBrand, year: number): string {
  return `analise_despesas_rateio_resultados_${brand}_${year}`;
}

function getRateioEndividamentoKey(brand: AnaliseBrand, year: number): string {
  return `analise_despesas_rateio_endividamento_${brand}_${year}`;
}

function getRateioTaxaJurosKey(year: number): string {
  return `analise_despesas_rateio_taxa_juros_${year}`;
}

function getRateioDepartamentoKey(brand: AnaliseBrand, year: number): string {
  return `analise_despesas_rateio_departamento_${brand}_${year}`;
}

function getRateioContabilAssinaturasKey(year: number): string {
  return `analise_despesas_rateio_contabil_assinaturas_${year}`;
}

function getRateioContabilOutrosBancosAssinaturasKey(year: number): string {
  return `analise_despesas_rateio_contabil_outros_bancos_assinaturas_${year}`;
}

function getRateioContabilOutrosBancosKey(year: number): string {
  return `analise_despesas_rateio_contabil_outros_bancos_${year}`;
}

function getRateioContabilOutrosBancosDepartamentosKey(year: number): string {
  return `analise_despesas_rateio_contabil_outros_bancos_departamentos_${year}`;
}

function getDefaultRateioConfig(): RateioCirculanteConfig {
  return {
    shared: { ativo: [], passivo: [] },
    vw: { ativo: [], passivo: [] },
    audi: { ativo: [], passivo: [] },
  };
}

function getDefaultRateioResultadosData(): RateioResultadosBrandYearData {
  const out: RateioResultadosBrandYearData = {};
  for (let month = 1; month <= 12; month++) {
    out[month] = [];
  }
  return out;
}

function getDefaultRateioEndividamentoData(): RateioEndividamentoBrandYearData {
  const out: RateioEndividamentoBrandYearData = {};
  for (let month = 1; month <= 12; month++) {
    out[month] = [];
  }
  return out;
}

function getDefaultRateioTaxaJurosData(): RateioTaxaJurosYearData {
  const out: RateioTaxaJurosYearData = {};
  for (let month = 1; month <= 12; month++) {
    out[month] = 0;
  }
  return out;
}

function getDefaultRateioDepartamentoValores(): RateioDepartamentoValores {
  return {
    novos: 0,
    vendaDireta: 0,
    usados: 0,
    pecas: 0,
    oficina: 0,
    funilaria: 0,
  };
}

function getDefaultRateioDepartamentoData(): RateioDepartamentoBrandYearData {
  const out: RateioDepartamentoBrandYearData = {};
  for (let month = 1; month <= 12; month++) {
    out[month] = {};
  }
  return out;
}

function getDefaultRateioContabilAssinaturasData(): RateioContabilAssinaturasYearData {
  const out: RateioContabilAssinaturasYearData = {};
  for (let month = 1; month <= 12; month++) {
    out[month] = null;
  }
  return out;
}

function getDefaultRateioContabilOutrosBancosData(): RateioOutrosBancosYearData {
  const out: RateioOutrosBancosYearData = {};
  for (let month = 1; month <= 12; month++) {
    out[month] = [];
  }
  return out;
}

function getDefaultRateioOutrosBancosDepartamentosMonthData(): RateioOutrosBancosDepartamentosMonthData {
  return {
    vw: ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria'],
    audi: ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria'],
  };
}

function getDefaultRateioOutrosBancosDepartamentosYearData(): RateioOutrosBancosDepartamentosYearData {
  const out: RateioOutrosBancosDepartamentosYearData = {};
  for (let month = 1; month <= 12; month++) {
    out[month] = getDefaultRateioOutrosBancosDepartamentosMonthData();
  }
  return out;
}

/** Salva o texto bruto do balancete para marca/mês/ano. */
export async function saveAnaliseDespesas(
  brand: AnaliseBrand,
  rawText: string,
  fileName: string | undefined,
  year: number,
  month: number,
): Promise<boolean> {
  try {
    const payload: AnaliseDespesasRaw = { rawText, fileName, timestamp: Date.now() };
    return await kvSet(getKey(brand, year, month), payload);
  } catch (err) {
    console.error('Erro ao salvar análise despesas:', err);
    return false;
  }
}

/** Carrega o texto bruto do balancete para marca/mês/ano. */
export async function loadAnaliseDespesasRaw(
  brand: AnaliseBrand,
  year: number,
  month: number,
): Promise<AnaliseDespesasRaw | null> {
  try {
    return await kvGet<AnaliseDespesasRaw>(getKey(brand, year, month));
  } catch (err) {
    console.error('Erro ao carregar análise despesas:', err);
    return null;
  }
}

/** Retorna mapa de quais períodos têm dados: "YYYY_MM" -> true */
export async function loadAnaliseDespesasIndex(
  brand: AnaliseBrand,
): Promise<Record<string, boolean>> {
  try {
    const prefix = `analise_despesas_${brand}_`;
    const allKeys = await kvKeys(`${prefix}*`);
    const index: Record<string, boolean> = {};
    for (const key of allKeys) {
      const suffix = key.replace(prefix, '');
      if (/^\d{4}_\d{2}$/.test(suffix)) {
        index[suffix] = true;
      }
    }
    return index;
  } catch (err) {
    console.error('Erro ao carregar índice análise despesas:', err);
    return {};
  }
}

/** Carrega vários meses de uma vez (bulk). Retorna { month -> rawText }. */
export async function loadMultipleMonthsAnaliseDespesas(
  brand: AnaliseBrand,
  year: number,
  months: number[],
): Promise<Record<number, string>> {
  try {
    const keys = months.map((m) => getKey(brand, year, m));
    const result = await kvBulkGet<AnaliseDespesasRaw>(keys);
    const out: Record<number, string> = {};
    for (let i = 0; i < months.length; i++) {
      const val = result[keys[i]];
      if (val?.rawText) out[months[i]] = val.rawText;
    }
    return out;
  } catch (err) {
    console.error('Erro ao carregar múltiplos meses análise despesas:', err);
    return {};
  }
}

/** Carrega o mapa de tipos de despesas para a marca. */
export async function loadAnaliseDespesasTipos(
  brand: AnaliseBrand,
): Promise<Record<string, string>> {
  try {
    return (await kvGet<Record<string, string>>(getTiposKey(brand))) ?? {};
  } catch (err) {
    return {};
  }
}

/** Salva o mapa de tipos de despesas para a marca. */
export async function saveAnaliseDespesasTipos(
  brand: AnaliseBrand,
  tipos: Record<string, string>,
): Promise<void> {
  try {
    await kvSet(getTiposKey(brand), tipos);
  } catch (err) {
    console.error('Erro ao salvar tipos análise despesas:', err);
  }
}

/** Carrega configuração de contas do módulo de rateio circulante. */
export async function loadRateioCirculanteConfig(): Promise<RateioCirculanteConfig> {
  try {
    const saved = await kvGet<RateioCirculanteConfig>(getRateioConfigKey());
    if (!saved) return getDefaultRateioConfig();
    return {
      shared: {
        ativo: saved.shared?.ativo ?? [],
        passivo: saved.shared?.passivo ?? [],
      },
      vw: {
        ativo: saved.vw?.ativo ?? [],
        passivo: saved.vw?.passivo ?? [],
      },
      audi: {
        ativo: saved.audi?.ativo ?? [],
        passivo: saved.audi?.passivo ?? [],
      },
    };
  } catch (err) {
    console.error('Erro ao carregar configuração de rateio circulante:', err);
    return getDefaultRateioConfig();
  }
}

/** Salva configuração de contas do módulo de rateio circulante. */
export async function saveRateioCirculanteConfig(config: RateioCirculanteConfig): Promise<void> {
  try {
    await kvSet(getRateioConfigKey(), config);
  } catch (err) {
    console.error('Erro ao salvar configuração de rateio circulante:', err);
  }
}

/** Carrega linhas de resultados (manuais) do módulo de rateio por marca/ano. */
export async function loadRateioResultados(
  brand: AnaliseBrand,
  year: number,
): Promise<RateioResultadosBrandYearData> {
  try {
    const saved = await kvGet<Record<string, RateioResultadoLinha[]>>(getRateioResultadosKey(brand, year));
    const base = getDefaultRateioResultadosData();
    if (!saved) return base;

    for (let month = 1; month <= 12; month++) {
      const monthRows = saved[String(month)];
      if (!Array.isArray(monthRows)) continue;
      base[month] = monthRows
        .filter((row) => row && typeof row.id === 'string' && typeof row.label === 'string')
        .map((row) => ({
          id: row.id,
          label: row.label,
          value: Number.isFinite(Number(row.value)) ? Number(row.value) : 0,
        }));
    }

    return base;
  } catch (err) {
    console.error('Erro ao carregar resultados de rateio:', err);
    return getDefaultRateioResultadosData();
  }
}

/** Salva linhas de resultados (manuais) do módulo de rateio por marca/ano. */
export async function saveRateioResultados(
  brand: AnaliseBrand,
  year: number,
  data: RateioResultadosBrandYearData,
): Promise<void> {
  try {
    const payload: Record<string, RateioResultadoLinha[]> = {};
    for (let month = 1; month <= 12; month++) {
      payload[String(month)] = data[month] ?? [];
    }
    await kvSet(getRateioResultadosKey(brand, year), payload);
  } catch (err) {
    console.error('Erro ao salvar resultados de rateio:', err);
  }
}

/** Carrega seleção de contas de endividamento por marca/ano. */
export async function loadRateioEndividamento(
  brand: AnaliseBrand,
  year: number,
): Promise<RateioEndividamentoBrandYearData> {
  try {
    const saved = await kvGet<Record<string, string[]>>(getRateioEndividamentoKey(brand, year));
    const base = getDefaultRateioEndividamentoData();
    if (!saved) return base;

    for (let month = 1; month <= 12; month++) {
      const contas = saved[String(month)];
      if (!Array.isArray(contas)) continue;
      base[month] = Array.from(new Set(contas.filter((conta) => typeof conta === 'string')));
    }

    return base;
  } catch (err) {
    console.error('Erro ao carregar endividamento de rateio:', err);
    return getDefaultRateioEndividamentoData();
  }
}

/** Salva seleção de contas de endividamento por marca/ano. */
export async function saveRateioEndividamento(
  brand: AnaliseBrand,
  year: number,
  data: RateioEndividamentoBrandYearData,
): Promise<void> {
  try {
    const payload: Record<string, string[]> = {};
    for (let month = 1; month <= 12; month++) {
      payload[String(month)] = Array.from(new Set(data[month] ?? []));
    }
    await kvSet(getRateioEndividamentoKey(brand, year), payload);
  } catch (err) {
    console.error('Erro ao salvar endividamento de rateio:', err);
  }
}

/** Carrega taxa de juros mensal do rateio (compartilhada entre marcas) por ano. */
export async function loadRateioTaxaJuros(year: number): Promise<RateioTaxaJurosYearData> {
  try {
    const saved = await kvGet<Record<string, number>>(getRateioTaxaJurosKey(year));
    const base = getDefaultRateioTaxaJurosData();
    if (!saved) return base;

    for (let month = 1; month <= 12; month++) {
      const value = Number(saved[String(month)]);
      base[month] = Number.isFinite(value) ? value : 0;
    }

    return base;
  } catch (err) {
    console.error('Erro ao carregar taxa de juros do rateio:', err);
    return getDefaultRateioTaxaJurosData();
  }
}

/** Salva taxa de juros mensal do rateio (compartilhada entre marcas) por ano. */
export async function saveRateioTaxaJuros(
  year: number,
  data: RateioTaxaJurosYearData,
): Promise<void> {
  try {
    const payload: Record<string, number> = {};
    for (let month = 1; month <= 12; month++) {
      const value = Number(data[month]);
      payload[String(month)] = Number.isFinite(value) ? value : 0;
    }
    await kvSet(getRateioTaxaJurosKey(year), payload);
  } catch (err) {
    console.error('Erro ao salvar taxa de juros do rateio:', err);
  }
}

/** Carrega o rateio por departamento por marca/ano. */
export async function loadRateioDepartamento(
  brand: AnaliseBrand,
  year: number,
): Promise<RateioDepartamentoBrandYearData> {
  try {
    const saved = await kvGet<Record<string, Record<string, RateioDepartamentoValores>>>(getRateioDepartamentoKey(brand, year));
    const base = getDefaultRateioDepartamentoData();
    if (!saved) return base;

    for (let month = 1; month <= 12; month++) {
      const monthData = saved[String(month)];
      if (!monthData || typeof monthData !== 'object') continue;
      const rows: Record<string, RateioDepartamentoValores> = {};
      for (const [conta, valores] of Object.entries(monthData)) {
        rows[conta] = {
          novos: Number(valores?.novos) || 0,
          vendaDireta: Number(valores?.vendaDireta) || 0,
          usados: Number(valores?.usados) || 0,
          pecas: Number(valores?.pecas) || 0,
          oficina: Number(valores?.oficina) || 0,
          funilaria: Number(valores?.funilaria) || 0,
        };
      }
      base[month] = rows;
    }

    return base;
  } catch (err) {
    console.error('Erro ao carregar rateio por departamento:', err);
    return getDefaultRateioDepartamentoData();
  }
}

/** Salva o rateio por departamento por marca/ano. */
export async function saveRateioDepartamento(
  brand: AnaliseBrand,
  year: number,
  data: RateioDepartamentoBrandYearData,
): Promise<void> {
  try {
    await kvSet(getRateioDepartamentoKey(brand, year), data);
  } catch (err) {
    console.error('Erro ao salvar rateio por departamento:', err);
  }
}

/** Carrega assinaturas do financeiro do demonstrativo contábil por ano. */
export async function loadRateioContabilAssinaturas(
  year: number,
): Promise<RateioContabilAssinaturasYearData> {
  try {
    const saved = await kvGet<Record<string, RateioAssinaturaDigital | null>>(getRateioContabilAssinaturasKey(year));
    const base = getDefaultRateioContabilAssinaturasData();
    if (!saved) return base;

    for (let month = 1; month <= 12; month++) {
      const assinatura = saved[String(month)];
      if (!assinatura || typeof assinatura !== 'object') continue;
      if (typeof assinatura.username !== 'string' || typeof assinatura.dataHora !== 'string') continue;
      base[month] = {
        username: assinatura.username,
        name: typeof assinatura.name === 'string' && assinatura.name.trim() ? assinatura.name : undefined,
        dataHora: assinatura.dataHora,
      };
    }

    return base;
  } catch (err) {
    console.error('Erro ao carregar assinaturas do demonstrativo contábil:', err);
    return getDefaultRateioContabilAssinaturasData();
  }
}

/** Salva assinaturas do financeiro do demonstrativo contábil por ano. */
export async function saveRateioContabilAssinaturas(
  year: number,
  data: RateioContabilAssinaturasYearData,
): Promise<void> {
  try {
    const payload: Record<string, RateioAssinaturaDigital | null> = {};
    for (let month = 1; month <= 12; month++) {
      payload[String(month)] = data[month] ?? null;
    }
    await kvSet(getRateioContabilAssinaturasKey(year), payload);
  } catch (err) {
    console.error('Erro ao salvar assinaturas do demonstrativo contábil:', err);
  }
}

/** Carrega assinaturas do financeiro do demonstrativo contábil - outros bancos por ano. */
export async function loadRateioContabilOutrosBancosAssinaturas(
  year: number,
): Promise<RateioContabilAssinaturasYearData> {
  try {
    const saved = await kvGet<Record<string, RateioAssinaturaDigital | null>>(getRateioContabilOutrosBancosAssinaturasKey(year));
    const base = getDefaultRateioContabilAssinaturasData();
    if (!saved) return base;

    for (let month = 1; month <= 12; month++) {
      const assinatura = saved[String(month)];
      if (!assinatura || typeof assinatura !== 'object') continue;
      if (typeof assinatura.username !== 'string' || typeof assinatura.dataHora !== 'string') continue;
      base[month] = {
        username: assinatura.username,
        name: typeof assinatura.name === 'string' && assinatura.name.trim() ? assinatura.name : undefined,
        dataHora: assinatura.dataHora,
      };
    }

    return base;
  } catch (err) {
    console.error('Erro ao carregar assinaturas do demonstrativo contábil - outros bancos:', err);
    return getDefaultRateioContabilAssinaturasData();
  }
}

/** Salva assinaturas do financeiro do demonstrativo contábil - outros bancos por ano. */
export async function saveRateioContabilOutrosBancosAssinaturas(
  year: number,
  data: RateioContabilAssinaturasYearData,
): Promise<void> {
  try {
    const payload: Record<string, RateioAssinaturaDigital | null> = {};
    for (let month = 1; month <= 12; month++) {
      payload[String(month)] = data[month] ?? null;
    }
    await kvSet(getRateioContabilOutrosBancosAssinaturasKey(year), payload);
  } catch (err) {
    console.error('Erro ao salvar assinaturas do demonstrativo contábil - outros bancos:', err);
  }
}

/** Carrega lançamentos de instituições/juros do demonstrativo contábil - outros bancos por ano. */
export async function loadRateioContabilOutrosBancos(
  year: number,
): Promise<RateioOutrosBancosYearData> {
  try {
    const saved = await kvGet<Record<string, RateioOutrosBancosLinha[]>>(getRateioContabilOutrosBancosKey(year));
    const base = getDefaultRateioContabilOutrosBancosData();
    if (!saved) return base;

    for (let month = 1; month <= 12; month++) {
      const rows = saved[String(month)];
      if (!Array.isArray(rows)) continue;
      base[month] = rows
        .filter((row) => row && typeof row.id === 'string')
        .map((row) => ({
          id: row.id,
          instituicao: typeof row.instituicao === 'string' ? row.instituicao : '',
          juros: Number.isFinite(Number(row.juros)) ? Number(row.juros) : 0,
        }));
    }

    return base;
  } catch (err) {
    console.error('Erro ao carregar dados de outros bancos do demonstrativo contábil:', err);
    return getDefaultRateioContabilOutrosBancosData();
  }
}

/** Salva lançamentos de instituições/juros do demonstrativo contábil - outros bancos por ano. */
export async function saveRateioContabilOutrosBancos(
  year: number,
  data: RateioOutrosBancosYearData,
): Promise<void> {
  try {
    const payload: Record<string, RateioOutrosBancosLinha[]> = {};
    for (let month = 1; month <= 12; month++) {
      payload[String(month)] = (data[month] ?? []).map((row) => ({
        id: row.id,
        instituicao: String(row.instituicao ?? '').trim(),
        juros: Number.isFinite(Number(row.juros)) ? Number(row.juros) : 0,
      }));
    }
    await kvSet(getRateioContabilOutrosBancosKey(year), payload);
  } catch (err) {
    console.error('Erro ao salvar dados de outros bancos do demonstrativo contábil:', err);
  }
}

/** Carrega seleção de departamentos por marca para rateio de outros bancos por ano. */
export async function loadRateioContabilOutrosBancosDepartamentos(
  year: number,
): Promise<RateioOutrosBancosDepartamentosYearData> {
  try {
    const saved = await kvGet<Record<string, RateioOutrosBancosDepartamentosMonthData>>(getRateioContabilOutrosBancosDepartamentosKey(year));
    const base = getDefaultRateioOutrosBancosDepartamentosYearData();
    if (!saved) return base;

    for (let month = 1; month <= 12; month++) {
      const monthData = saved[String(month)];
      if (!monthData || typeof monthData !== 'object') continue;

      const vw = Array.isArray(monthData.vw)
        ? monthData.vw.filter((dept): dept is RateioDepartamentoName => typeof dept === 'string')
        : [];
      const audi = Array.isArray(monthData.audi)
        ? monthData.audi.filter((dept): dept is RateioDepartamentoName => typeof dept === 'string')
        : [];

      base[month] = {
        vw: Array.from(new Set(vw)),
        audi: Array.from(new Set(audi)),
      };
    }

    return base;
  } catch (err) {
    console.error('Erro ao carregar seleção de departamentos de outros bancos:', err);
    return getDefaultRateioOutrosBancosDepartamentosYearData();
  }
}

/** Salva seleção de departamentos por marca para rateio de outros bancos por ano. */
export async function saveRateioContabilOutrosBancosDepartamentos(
  year: number,
  data: RateioOutrosBancosDepartamentosYearData,
): Promise<void> {
  try {
    const payload: Record<string, RateioOutrosBancosDepartamentosMonthData> = {};
    for (let month = 1; month <= 12; month++) {
      const monthData = data[month] ?? getDefaultRateioOutrosBancosDepartamentosMonthData();
      payload[String(month)] = {
        vw: Array.from(new Set(monthData.vw ?? [])),
        audi: Array.from(new Set(monthData.audi ?? [])),
      };
    }

    await kvSet(getRateioContabilOutrosBancosDepartamentosKey(year), payload);
  } catch (err) {
    console.error('Erro ao salvar seleção de departamentos de outros bancos:', err);
  }
}
