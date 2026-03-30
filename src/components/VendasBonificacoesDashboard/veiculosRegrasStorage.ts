import { kvGet, kvSet } from '@/lib/kvClient';

const KEY_MODELOS = 'veiculos_modelos';
const KEY_REGRAS  = 'veiculos_regras';

export type MarcaVeiculo = 'VW' | 'Audi';

// ─── Modelo (cadastro fixo) ───────────────────────────────────────────────────
export interface VeiculoModelo {
  id: string;
  marca: MarcaVeiculo;
  modelo: string;
  ativo: boolean;
}

// ─── Regra mensal (varia por mês/ano) ────────────────────────────────────────
export interface VeiculoRegra {
  id: string;
  modeloId: string;
  ano: number;
  mes: number; // 1–12
  precoPublico: string;  // valor bruto, ex: "85000.00"
  piv: string;           // %, ex: "2.5"  — vazio = 0 no cálculo
  siq: string;
  pive: string;
  bonusVolume: string;
  cssVendas: string;
  cssPosVendas: string;
  are: string;
  audiSport: string;
}

// ─── Modelos ─────────────────────────────────────────────────────────────────
export async function loadModelos(): Promise<VeiculoModelo[]> {
  try {
    const data = await kvGet(KEY_MODELOS);
    if (Array.isArray(data)) return data as VeiculoModelo[];
    return [];
  } catch { return []; }
}

export async function saveModelos(rows: VeiculoModelo[]): Promise<void> {
  await kvSet(KEY_MODELOS, rows);
}

// ─── Regras ──────────────────────────────────────────────────────────────────
export async function loadRegras(): Promise<VeiculoRegra[]> {
  try {
    const data = await kvGet(KEY_REGRAS);
    if (Array.isArray(data)) return data as VeiculoRegra[];
    return [];
  } catch { return []; }
}

export async function saveRegras(rows: VeiculoRegra[]): Promise<void> {
  await kvSet(KEY_REGRAS, rows);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function getRegra(
  regras: VeiculoRegra[],
  modeloId: string,
  ano: number,
  mes: number,
): VeiculoRegra | null {
  return regras.find(r => r.modeloId === modeloId && r.ano === ano && r.mes === mes) ?? null;
}

export function createEmptyRegra(modeloId: string, ano: number, mes: number): VeiculoRegra {
  return {
    id: crypto.randomUUID(),
    modeloId,
    ano,
    mes,
    precoPublico: '',
    piv: '',
    siq: '',
    pive: '',
    bonusVolume: '',
    cssVendas: '',
    cssPosVendas: '',
    are: '',
    audiSport: '',
  };
}

/** Campos de percentual (para iteração) */
export const INDICADOR_FIELDS = [
  { key: 'piv',          label: '% PIV',           marcas: ['VW']   as MarcaVeiculo[] },
  { key: 'siq',          label: '% SIQ',           marcas: ['VW']   as MarcaVeiculo[] },
  { key: 'pive',         label: '% PIVE',          marcas: ['VW']   as MarcaVeiculo[] },
  { key: 'bonusVolume',  label: '% Bônus Vol.',    marcas: ['Audi'] as MarcaVeiculo[] },
  { key: 'cssVendas',    label: '% CSS Vendas',    marcas: ['Audi'] as MarcaVeiculo[] },
  { key: 'cssPosVendas', label: '% CSS Pós Vnd.',  marcas: ['Audi'] as MarcaVeiculo[] },
  { key: 'are',          label: '% ARE',           marcas: ['Audi'] as MarcaVeiculo[] },
  { key: 'audiSport',    label: '% Audi Sport',    marcas: ['Audi'] as MarcaVeiculo[] },
] as const;
