import type { VeiculoRow } from './veiculosStorage';

// ─── Faixas de aging (dias em estoque) ──────────────────────────────────────────
export interface AgingBucketDef {
  label: string;
  min: number;
  max: number | null; // null = sem limite superior
}

export const AGING_BUCKETS: AgingBucketDef[] = [
  { label: '0–30', min: 0, max: 30 },
  { label: '31–60', min: 31, max: 60 },
  { label: '61–90', min: 61, max: 90 },
  { label: '91–180', min: 91, max: 180 },
  { label: '181–365', min: 181, max: 365 },
  { label: '366–730', min: 366, max: 730 },
  { label: '> 730', min: 731, max: null },
];

export function bucketForDias(dias: number): AgingBucketDef | null {
  for (const b of AGING_BUCKETS) {
    if (dias >= b.min && (b.max === null || dias <= b.max)) return b;
  }
  return null;
}

// ─── Mapeamento modelo → marca ──────────────────────────────────────────────────

/** Marcas reconhecidas quando aparecem como primeira palavra do modelo. */
const BRANDS = new Set<string>([
  'VW', 'VOLKSWAGEN', 'FIAT', 'HYUNDAI', 'GM', 'CHEVROLET', 'TOYOTA', 'HONDA',
  'JEEP', 'RENAULT', 'NISSAN', 'AUDI', 'VOLVO', 'KIA', 'FORD', 'CHERY',
  'PEUGEOT', 'BMW', 'MERCEDES', 'MITSUBISHI', 'CITROEN', 'CAOA', 'RAM',
  'LAND', 'SUZUKI', 'MINI', 'DODGE',
]);

/** Normaliza nomes de marca que têm variações para um rótulo único. */
const BRAND_ALIAS: Record<string, string> = {
  VOLKSWAGEN: 'VW',
  CHEVROLET: 'GM',
};

/** Modelos cujo primeiro token NÃO é a marca → mapeamento explícito. */
const MODEL_TO_BRAND: Record<string, string> = {
  // Jeep
  RENEGADE: 'JEEP', COMPASS: 'JEEP', COMMANDER: 'JEEP', GLADIATOR: 'JEEP',
  // Honda
  CIVIC: 'HONDA', HRV: 'HONDA', FIT: 'HONDA', CITY: 'HONDA', WRV: 'HONDA', ACCORD: 'HONDA',
  // Hyundai
  HB20: 'HYUNDAI', HB20S: 'HYUNDAI', CRETA: 'HYUNDAI', TUCSON: 'HYUNDAI', IX35: 'HYUNDAI',
  SANTA: 'HYUNDAI', AZERA: 'HYUNDAI', ELANTRA: 'HYUNDAI', I30: 'HYUNDAI', SONATA: 'HYUNDAI',
  // GM / Chevrolet
  ONIX: 'GM', CRUZE: 'GM', TRACKER: 'GM', SPIN: 'GM', COBALT: 'GM', PRISMA: 'GM',
  S10: 'GM', MONTANA: 'GM', JOY: 'GM', CELTA: 'GM', CLASSIC: 'GM', AGILE: 'GM',
  CAMARO: 'GM', EQUINOX: 'GM', TRAILBLAZER: 'GM', BOLT: 'GM',
  // VW
  VIRTUS: 'VW', GOL: 'VW', POLO: 'VW', 'T-CROSS': 'VW', TCROSS: 'VW', NIVUS: 'VW',
  SAVEIRO: 'VW', FOX: 'VW', VOYAGE: 'VW', JETTA: 'VW', TIGUAN: 'VW', AMAROK: 'VW',
  UP: 'VW', GOLF: 'VW', PASSAT: 'VW', FUSCA: 'VW', SPACEFOX: 'VW', CROSSFOX: 'VW', BORA: 'VW',
  // Fiat
  ARGO: 'FIAT', STRADA: 'FIAT', TORO: 'FIAT', MOBI: 'FIAT', PULSE: 'FIAT', FASTBACK: 'FIAT',
  CRONOS: 'FIAT', PALIO: 'FIAT', UNO: 'FIAT', SIENA: 'FIAT', DOBLO: 'FIAT', FIORINO: 'FIAT',
  IDEA: 'FIAT', PUNTO: 'FIAT', LINEA: 'FIAT', BRAVO: 'FIAT', STILO: 'FIAT', MAREA: 'FIAT',
  // BMW
  '320I': 'BMW', '320': 'BMW', '118I': 'BMW', '118': 'BMW', X1: 'BMW', X3: 'BMW', X5: 'BMW',
  X6: 'BMW', '328I': 'BMW', '530I': 'BMW', M3: 'BMW', M4: 'BMW',
  // Toyota
  COROLLA: 'TOYOTA', HILUX: 'TOYOTA', YARIS: 'TOYOTA', ETIOS: 'TOYOTA', SW4: 'TOYOTA',
  RAV4: 'TOYOTA', CAMRY: 'TOYOTA',
  // Nissan
  KICKS: 'NISSAN', VERSA: 'NISSAN', SENTRA: 'NISSAN', FRONTIER: 'NISSAN', MARCH: 'NISSAN',
  LIVINA: 'NISSAN', TIIDA: 'NISSAN',
  // Renault
  KWID: 'RENAULT', SANDERO: 'RENAULT', LOGAN: 'RENAULT', DUSTER: 'RENAULT', CAPTUR: 'RENAULT',
  OROCH: 'RENAULT', STEPWAY: 'RENAULT', FLUENCE: 'RENAULT', CLIO: 'RENAULT', MEGANE: 'RENAULT',
  // Ford
  KA: 'FORD', FIESTA: 'FORD', FOCUS: 'FORD', ECOSPORT: 'FORD', RANGER: 'FORD', FUSION: 'FORD',
  EDGE: 'FORD', TERRITORY: 'FORD',
  // Chery / Caoa
  TIGGO: 'CHERY', ARRIZO: 'CHERY', QQ: 'CHERY', CELER: 'CHERY',
  // Peugeot
  '208': 'PEUGEOT', '2008': 'PEUGEOT', '3008': 'PEUGEOT', '308': 'PEUGEOT', '207': 'PEUGEOT',
  '206': 'PEUGEOT', '307': 'PEUGEOT', '408': 'PEUGEOT',
  // Kia
  SPORTAGE: 'KIA', SORENTO: 'KIA', CERATO: 'KIA', PICANTO: 'KIA', CADENZA: 'KIA', STONIC: 'KIA',
  // Volvo
  XC40: 'VOLVO', XC60: 'VOLVO', XC90: 'VOLVO', S60: 'VOLVO', V40: 'VOLVO',
};

/** Marca de fallback quando nada é reconhecido. */
export const MARCA_DESCONHECIDA = 'OUTROS';

/**
 * Deriva a marca a partir da descrição do modelo.
 * Percorre os tokens: usa o primeiro que for uma marca conhecida, ou um modelo
 * com marca mapeada. Caso contrário, retorna o primeiro token (ou OUTROS).
 */
export function deriveMarca(modelo: string): string {
  const raw = (modelo || '').toUpperCase().trim();
  if (!raw) return MARCA_DESCONHECIDA;
  const tokens = raw.split(/[^A-Z0-9]+/).filter(Boolean);
  for (const token of tokens) {
    if (BRANDS.has(token)) return BRAND_ALIAS[token] ?? token;
    if (MODEL_TO_BRAND[token]) return MODEL_TO_BRAND[token];
  }
  return tokens[0] ?? MARCA_DESCONHECIDA;
}

// ─── Análise ────────────────────────────────────────────────────────────────────

export interface VeiculoAnaliseItem extends VeiculoRow {
  dias: number | null;
  faixa: string | null;
  parado: boolean;
}

export interface BucketResumo { label: string; n: number; valor: number; }
export interface MarcaResumo { marca: string; n: number; valor: number; }
export interface ModeloResumo { modelo: string; n: number; valor: number; }

export interface AnaliseVeiculosResult {
  totalVeiculos: number;
  totalValor: number;
  ticketMedio: number;
  idadeMedia: number | null;
  parados: number;
  valorParado: number;
  pctParados: number;
  threshold: number;
  buckets: BucketResumo[];
  marcas: MarcaResumo[];
  modelos: ModeloResumo[];
  itens: VeiculoAnaliseItem[];
}

/** Diferença em dias inteiros entre a data-base e a data de entrada (ISO). */
function diasEmEstoque(entradaISO: string | null, baseISO: string): number | null {
  if (!entradaISO) return null;
  const entrada = new Date(`${entradaISO}T00:00:00`);
  const base = new Date(`${baseISO}T00:00:00`);
  if (Number.isNaN(entrada.getTime()) || Number.isNaN(base.getTime())) return null;
  return Math.floor((base.getTime() - entrada.getTime()) / 86_400_000);
}

export function buildAnaliseVeiculos(
  veiculos: VeiculoRow[],
  baseISO: string,
  threshold: number,
): AnaliseVeiculosResult {
  // Veículos com valor unitário zerado (ou negativo) não entram na análise.
  const considerados = veiculos.filter((v) => v.valor > 0);

  const itens: VeiculoAnaliseItem[] = considerados.map((v) => {
    const dias = diasEmEstoque(v.entrada, baseISO);
    const faixa = dias != null ? bucketForDias(dias)?.label ?? null : null;
    const parado = dias != null && dias >= threshold;
    return { ...v, dias, faixa, parado };
  });

  const totalVeiculos = itens.length;
  const totalValor = itens.reduce((s, it) => s + it.valor, 0);
  const ticketMedio = totalVeiculos > 0 ? totalValor / totalVeiculos : 0;

  const comDias = itens.filter((it) => it.dias != null);
  const idadeMedia = comDias.length > 0
    ? comDias.reduce((s, it) => s + (it.dias as number), 0) / comDias.length
    : null;

  const paradosItens = itens.filter((it) => it.parado);
  const parados = paradosItens.length;
  const valorParado = paradosItens.reduce((s, it) => s + it.valor, 0);
  const pctParados = totalVeiculos > 0 ? (parados / totalVeiculos) * 100 : 0;

  // Resumo por faixa
  const buckets: BucketResumo[] = AGING_BUCKETS.map((b) => {
    const naFaixa = itens.filter((it) => it.faixa === b.label);
    return { label: b.label, n: naFaixa.length, valor: naFaixa.reduce((s, it) => s + it.valor, 0) };
  });

  // Resumo por marca
  const marcaMap = new Map<string, MarcaResumo>();
  for (const it of itens) {
    const cur = marcaMap.get(it.marca) ?? { marca: it.marca, n: 0, valor: 0 };
    cur.n += 1;
    cur.valor += it.valor;
    marcaMap.set(it.marca, cur);
  }
  const marcas = Array.from(marcaMap.values()).sort((a, b) => b.valor - a.valor);

  // Resumo por modelo
  const modeloMap = new Map<string, ModeloResumo>();
  for (const it of itens) {
    const key = it.modelo || '—';
    const cur = modeloMap.get(key) ?? { modelo: key, n: 0, valor: 0 };
    cur.n += 1;
    cur.valor += it.valor;
    modeloMap.set(key, cur);
  }
  const modelos = Array.from(modeloMap.values()).sort((a, b) => b.n - a.n || b.valor - a.valor);

  return {
    totalVeiculos,
    totalValor,
    ticketMedio,
    idadeMedia,
    parados,
    valorParado,
    pctParados,
    threshold,
    buckets,
    marcas,
    modelos,
    itens,
  };
}
