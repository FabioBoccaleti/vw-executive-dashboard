/**
 * Persistência das Passagens de Oficina e Funilaria VW por ano/mês.
 * Chaveamento: passagem_oficina_funilaria_vw_{YYYY}_{MM}
 */

import { kvGet, kvSet, kvKeys, kvBulkGet } from '@/lib/kvClient';

export interface PassagemRow {
  nroOs: string;
  nomeDepartamento: string;
  dtaEmissao: string;
  dtaEncerramento: string;
  nomeVendedor: string;
  categoriaOs: string;
  chassi: string;
  valTotalOs: number;
  valTotalPecas: number;
  valTotalServicos: number;
  totalDesconto: number;
  valPecaExterno: number;
  valServicoExterno: number;
  valPecaInterno: number;
  valServicoInterno: number;
  valPecaGarantia: number;
  valServicoGarantia: number;
  valPecaRevisao: number;
  valServicoRevisao: number;
  descontoPeca: number;
  descontoServ: number;
}

export interface PassagemMesData {
  rows: PassagemRow[];
  fileName?: string;
  timestamp?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const key = (year: number, month: number) => `passagem_oficina_funilaria_vw_${year}_${pad(month)}`;

export async function getPassagemMes(year: number, month: number): Promise<PassagemMesData | null> {
  return kvGet<PassagemMesData>(key(year, month));
}

export async function setPassagemMes(year: number, month: number, data: PassagemMesData): Promise<boolean> {
  return kvSet(key(year, month), data);
}

// ─── Regra Ano / Chassi (de-para letra da posição 10 → ano) ──────────────────
export interface RegraAnoChassi {
  id: string;
  letra: string;  // 1 caractere A-Z (posição 10 do chassi)
  ano: number;
}

const REGRA_ANO_CHASSI_KEY = 'passagem_oficina_funilaria_vw_regra_ano_chassi';

export async function getRegrasAnoChassi(): Promise<RegraAnoChassi[]> {
  return (await kvGet<RegraAnoChassi[]>(REGRA_ANO_CHASSI_KEY)) ?? [];
}

export async function setRegrasAnoChassi(regras: RegraAnoChassi[]): Promise<boolean> {
  return kvSet(REGRA_ANO_CHASSI_KEY, regras);
}

// ─── Categoria (de-para código → categoria) ──────────────────────────────────
export interface CategoriaOS {
  id: string;
  codigo: string;  // número (código da CATEGORIA_OS)
  categoria: string;
}

const CATEGORIA_KEY = 'passagem_oficina_funilaria_vw_categoria';

export async function getCategorias(): Promise<CategoriaOS[]> {
  return (await kvGet<CategoriaOS[]>(CATEGORIA_KEY)) ?? [];
}

export async function setCategorias(categorias: CategoriaOS[]): Promise<boolean> {
  return kvSet(CATEGORIA_KEY, categorias);
}

// ─── Regra Departamentos (agrupamento de departamentos brutos) ───────────────

/** Filtro de elegibilidade pela coluna Total OS. */
export type FiltroValorOS = 'todas' | 'zero' | 'positivo';

/** Como contar passagens dentro de um grupo. */
export type ModoContagem = 'porDia' | 'porMes' | 'porOs';

/** Regra de contagem de passagens de um grupo de departamento. */
export interface RegraContagem {
  filtroValor: FiltroValorOS;        // quais OS entram na contagem (Total OS)
  modoContagem: ModoContagem;        // o que define "a mesma passagem"
  categoriasExcluidas: string[];     // códigos de Categoria OS que NÃO contam (filtro)
  considerarCategoria: boolean;      // categorias diferentes contam como passagens diferentes
}

export interface RegraDepartamento {
  id: string;
  nome: string;             // nome do grupo (ex. Oficina, Funilaria)
  departamentos: string[];  // nomeDepartamento brutos que compõem o grupo
  contagem?: RegraContagem; // regra de contagem (opcional p/ retrocompatibilidade)
}

export function defaultRegraContagem(): RegraContagem {
  return { filtroValor: 'todas', modoContagem: 'porDia', categoriasExcluidas: [], considerarCategoria: false };
}

/**
 * Diz se uma OS é elegível para a contagem/valores de um grupo, conforme os
 * filtros de entrada da regra (valor Total OS e categorias excluídas).
 * Obs.: não checa departamento — isso é feito por quem chama.
 */
export function osElegivel(row: PassagemRow, regra: RegraContagem): boolean {
  if (regra.filtroValor === 'zero' && (row.valTotalOs ?? 0) !== 0) return false;
  if (regra.filtroValor === 'positivo' && (row.valTotalOs ?? 0) <= 0) return false;
  if ((regra.categoriasExcluidas ?? []).includes((row.categoriaOs ?? '').trim())) return false;
  return true;
}

/**
 * Conta as passagens de um conjunto de linhas (já filtradas para o grupo)
 * aplicando a regra de contagem. Função pura — reutilizável pela aba Análise.
 *
 * Filtros de entrada (descartam OS antes de contar): valor Total OS e
 * categorias excluídas. Em seguida o modo de contagem define o agrupamento;
 * com "considerarCategoria" ligado, categorias diferentes separam a passagem.
 */
export function contarPassagensGrupo(rows: PassagemRow[], regra: RegraContagem): number {
  const elegiveis = rows.filter(r => osElegivel(r, regra));

  if (regra.modoContagem === 'porOs') return elegiveis.length;

  const chaves = new Set<string>();
  for (const r of elegiveis) {
    const partes = [r.chassi?.trim() ?? ''];
    if (regra.modoContagem === 'porDia') partes.push(r.dtaEmissao?.trim() ?? '');
    if (regra.considerarCategoria) partes.push(r.categoriaOs?.trim() ?? '');
    chaves.add(partes.join('|'));
  }
  return chaves.size;
}

/** Resultado agregado de um grupo de departamento para a aba Análise. */
export interface GrupoAnalise {
  id: string;
  nome: string;
  departamentos: string[];
  passagens: number;      // quantidade de passagens (modo de contagem)
  totalPecas: number;     // Total Peças líquido (bruto − Desconto Peça)
  totalServicos: number;  // Total Serviços líquido (bruto − Desconto Serviço)
  totalOs: number;        // totalPecas + totalServicos
}

/**
 * Agrega as linhas por grupo de departamento, seguindo as regras cadastradas.
 * Passagens usam o modo de contagem; os valores somam apenas OS elegíveis
 * (filtro de valor + categorias) com desconto abatido. Departamentos que não
 * pertencem a nenhum grupo são ignorados.
 */
export function analisarGrupos(rows: PassagemRow[], grupos: RegraDepartamento[]): GrupoAnalise[] {
  return grupos.map(g => {
    const regra = g.contagem ?? defaultRegraContagem();
    const deps = new Set(g.departamentos);
    const doGrupo = rows.filter(r => deps.has((r.nomeDepartamento ?? '').trim()));

    let totalPecas = 0;
    let totalServicos = 0;
    for (const r of doGrupo) {
      if (!osElegivel(r, regra)) continue;
      totalPecas += (r.valTotalPecas ?? 0) - (r.descontoPeca ?? 0);
      totalServicos += (r.valTotalServicos ?? 0) - (r.descontoServ ?? 0);
    }

    return {
      id: g.id,
      nome: g.nome,
      departamentos: g.departamentos,
      passagens: contarPassagensGrupo(doGrupo, regra),
      totalPecas,
      totalServicos,
      totalOs: totalPecas + totalServicos,
    };
  });
}

/** Resultado agregado por ano do veículo (derivado da Regra Ano / Chassi). */
export interface AnoAnalise {
  ano: string;            // "2020" ou "Não identificado"
  anoNum: number;         // para ordenação (Infinity = não identificado)
  passagens: number;
  totalPecas: number;
  totalServicos: number;
  totalOs: number;
}

export const ANO_NAO_IDENTIFICADO = 'Não identificado';

/**
 * Agrega passagens e valores por ano do veículo, usando a Regra Ano / Chassi
 * (posição 10 do chassi → ano). Aplica as mesmas regras por departamento
 * (elegibilidade + modo de contagem). Chassis sem ano determinável caem no
 * grupo "Não identificado".
 */
export function analisarPorAno(
  rows: PassagemRow[],
  grupos: RegraDepartamento[],
  regrasAnoChassi: RegraAnoChassi[],
): AnoAnalise[] {
  const anoByLetra = new Map<string, number>();
  for (const r of regrasAnoChassi) anoByLetra.set(r.letra.toUpperCase(), r.ano);

  const anoDoChassi = (chassi: string): string => {
    const c = (chassi ?? '').trim();
    if (c.length < 10) return ANO_NAO_IDENTIFICADO;
    const ano = anoByLetra.get(c.charAt(9).toUpperCase());
    return ano != null ? String(ano) : ANO_NAO_IDENTIFICADO;
  };

  const acc = new Map<string, { passagens: number; totalPecas: number; totalServicos: number }>();
  const ensure = (label: string) => {
    let v = acc.get(label);
    if (!v) { v = { passagens: 0, totalPecas: 0, totalServicos: 0 }; acc.set(label, v); }
    return v;
  };

  for (const g of grupos) {
    const regra = g.contagem ?? defaultRegraContagem();
    const deps = new Set(g.departamentos);
    const elegiveis = rows.filter(r => deps.has((r.nomeDepartamento ?? '').trim()) && osElegivel(r, regra));

    // Valores por ano (soma de todas as OS elegíveis)
    for (const r of elegiveis) {
      const v = ensure(anoDoChassi(r.chassi));
      v.totalPecas += (r.valTotalPecas ?? 0) - (r.descontoPeca ?? 0);
      v.totalServicos += (r.valTotalServicos ?? 0) - (r.descontoServ ?? 0);
    }

    // Passagens por ano (dedup conforme o modo de contagem)
    if (regra.modoContagem === 'porOs') {
      for (const r of elegiveis) ensure(anoDoChassi(r.chassi)).passagens += 1;
    } else {
      const keyToLabel = new Map<string, string>();
      for (const r of elegiveis) {
        const partes = [r.chassi?.trim() ?? ''];
        if (regra.modoContagem === 'porDia') partes.push(r.dtaEmissao?.trim() ?? '');
        if (regra.considerarCategoria) partes.push(r.categoriaOs?.trim() ?? '');
        const key = partes.join('|');
        if (!keyToLabel.has(key)) keyToLabel.set(key, anoDoChassi(r.chassi));
      }
      for (const label of keyToLabel.values()) ensure(label).passagens += 1;
    }
  }

  return [...acc.entries()]
    .map(([ano, v]) => ({
      ano,
      anoNum: ano === ANO_NAO_IDENTIFICADO ? Number.POSITIVE_INFINITY : Number(ano),
      passagens: v.passagens,
      totalPecas: v.totalPecas,
      totalServicos: v.totalServicos,
      totalOs: v.totalPecas + v.totalServicos,
    }))
    .sort((a, b) => a.anoNum - b.anoNum);
}

/** Um chassi que caiu no grupo "Não identificado" (sem ano determinável). */
export interface ChassiNaoIdentificado {
  chassi: string;        // chassi (pode ser vazio)
  codigoPos10: string;   // caractere da posição 10, ou '—' se chassi curto/vazio
  qtdOs: number;         // nº de OS elegíveis desse chassi
  departamentos: string[];
}

/**
 * Lista os chassis distintos que caem em "Não identificado" (posição 10 sem
 * regra, ou chassi curto/vazio), respeitando as mesmas regras por departamento
 * (elegibilidade). Útil para descobrir quais códigos cadastrar na Regra Ano/Chassi.
 */
export function listarChassisNaoIdentificados(
  rows: PassagemRow[],
  grupos: RegraDepartamento[],
  regrasAnoChassi: RegraAnoChassi[],
): ChassiNaoIdentificado[] {
  const anoByLetra = new Map<string, number>();
  for (const r of regrasAnoChassi) anoByLetra.set(r.letra.toUpperCase(), r.ano);

  const isNaoIdentificado = (chassi: string): boolean => {
    if (chassi.length < 10) return true;
    return !anoByLetra.has(chassi.charAt(9).toUpperCase());
  };

  const map = new Map<string, { qtdOs: number; deps: Set<string> }>();
  for (const g of grupos) {
    const regra = g.contagem ?? defaultRegraContagem();
    const deps = new Set(g.departamentos);
    for (const r of rows) {
      const dep = (r.nomeDepartamento ?? '').trim();
      if (!deps.has(dep) || !osElegivel(r, regra)) continue;
      const chassi = (r.chassi ?? '').trim();
      if (!isNaoIdentificado(chassi)) continue;
      let e = map.get(chassi);
      if (!e) { e = { qtdOs: 0, deps: new Set() }; map.set(chassi, e); }
      e.qtdOs += 1;
      if (dep) e.deps.add(dep);
    }
  }

  return [...map.entries()]
    .map(([chassi, e]) => ({
      chassi,
      codigoPos10: chassi.length >= 10 ? chassi.charAt(9).toUpperCase() : '—',
      qtdOs: e.qtdOs,
      departamentos: [...e.deps].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    }))
    .sort((a, b) => b.qtdOs - a.qtdOs || a.chassi.localeCompare(b.chassi));
}

const REGRA_DEPARTAMENTOS_KEY = 'passagem_oficina_funilaria_vw_regra_departamentos';

export async function getRegrasDepartamentos(): Promise<RegraDepartamento[]> {
  return (await kvGet<RegraDepartamento[]>(REGRA_DEPARTAMENTOS_KEY)) ?? [];
}

export async function setRegrasDepartamentos(regras: RegraDepartamento[]): Promise<boolean> {
  return kvSet(REGRA_DEPARTAMENTOS_KEY, regras);
}

/**
 * Carrega as linhas de um período: um mês específico (1-12) ou o ano inteiro
 * ('ano' agrega os 12 meses do ano).
 */
export async function getPassagensPeriodo(year: number, month: number | 'ano'): Promise<PassagemRow[]> {
  if (month === 'ano') {
    const keys = Array.from({ length: 12 }, (_, i) => key(year, i + 1));
    const data = await kvBulkGet<PassagemMesData>(keys);
    const rows: PassagemRow[] = [];
    for (const v of Object.values(data)) if (v?.rows) rows.push(...v.rows);
    return rows;
  }
  const d = await getPassagemMes(year, month);
  return d?.rows ?? [];
}

/**
 * Varre todos os meses/anos já importados e retorna a lista de
 * departamentos (nomeDepartamento) distintos, ordenados alfabeticamente.
 * O padrão `..._2*` casa apenas as chaves de dados mensais (ano começa com 2),
 * ignorando as chaves de regras/categoria.
 */
export async function getDepartamentosDistintos(): Promise<string[]> {
  const keys = await kvKeys(`passagem_oficina_funilaria_vw_2*`);
  if (keys.length === 0) return [];
  const data = await kvBulkGet<PassagemMesData>(keys);
  const set = new Set<string>();
  for (const value of Object.values(data)) {
    for (const row of value?.rows ?? []) {
      const dep = row.nomeDepartamento?.trim();
      if (dep) set.add(dep);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Varre todos os meses/anos já importados e retorna os códigos de
 * Categoria OS distintos, ordenados numericamente quando possível.
 */
export async function getCategoriasDistintas(): Promise<string[]> {
  const keys = await kvKeys(`passagem_oficina_funilaria_vw_2*`);
  if (keys.length === 0) return [];
  const data = await kvBulkGet<PassagemMesData>(keys);
  const set = new Set<string>();
  for (const value of Object.values(data)) {
    for (const row of value?.rows ?? []) {
      const cat = row.categoriaOs?.trim();
      if (cat) set.add(cat);
    }
  }
  return [...set].sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b, 'pt-BR');
  });
}


