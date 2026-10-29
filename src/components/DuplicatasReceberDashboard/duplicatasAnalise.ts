import {
  DEPARTAMENTOS,
  DEPARTAMENTO_NAO_CLASSIFICADO,
  type DepartamentoMap,
  type DuplicatasImport,
} from './duplicatasStorage';

// ─── Parsing ──────────────────────────────────────────────────────────────────

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

export function parseNumberBR(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const normalized = text.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

/** Converte 'DD/MM/AAAA' (ou variações) em Date local, ou null. */
export function parseDateBR(value: unknown): Date | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const m = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Zera horas/minutos para comparação por dia. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffInDays(later: Date, earlier: Date): number {
  return Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / 86400000);
}

// ─── Modelo de uma duplicata ────────────────────────────────────────────────

export interface Duplicata {
  deptNumero: string;
  deptNomeArquivo: string;
  /** Departamento de classificação (um dos DEPARTAMENTOS ou "Não classificado"). */
  departamento: string;
  clienteId: string;
  clienteNome: string;
  cgccpf: string;
  titulo: string;
  duplicata: string;
  valor: number;
  vencimento: Date | null;
  /** True se o vencimento é anterior à data de referência. */
  vencido: boolean;
  /** Dias de atraso (>0) quando vencida; 0 caso contrário. */
  diasAtraso: number;
  /** Dias até vencer (>=0) quando a vencer; 0 caso contrário. */
  diasAteVencer: number;
}

interface ColumnMap {
  departamento: number;
  nomeDepartamento: number;
  cliente: number;
  nomeCliente: number;
  cgccpf: number;
  titulo: number;
  duplicata: number;
  vencido: number;
  avencer: number;
  dtaVencimento: number;
}

function detectColumns(headers: string[]): ColumnMap {
  const norm = headers.map(normalizeHeader);
  const idx = (name: string) => norm.indexOf(name);
  return {
    departamento: idx('departamento'),
    nomeDepartamento: idx('nomedepartamento'),
    cliente: idx('cliente'),
    nomeCliente: idx('nomecliente'),
    cgccpf: idx('cgccpf'),
    titulo: idx('titulo'),
    duplicata: idx('duplicata'),
    vencido: idx('vencido'),
    avencer: idx('avencer'),
    dtaVencimento: idx('dtavencimento'),
  };
}

/** Converte as linhas importadas em duplicatas, classificando o departamento e calculando o aging. */
export function parseDuplicatas(
  data: DuplicatasImport,
  map: DepartamentoMap,
  referenceDate: Date,
): Duplicata[] {
  const cols = detectColumns(data.headers);
  const ref = startOfDay(referenceDate);
  const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? '') : '');

  return data.rows.map((row) => {
    const deptNumero = String(cell(row, cols.departamento)).trim();
    const deptNomeArquivo = String(cell(row, cols.nomeDepartamento)).trim();
    const departamento = map[deptNumero] ?? DEPARTAMENTO_NAO_CLASSIFICADO;
    const clienteNome = String(cell(row, cols.nomeCliente)).trim() || '(sem nome)';
    const cgccpf = String(cell(row, cols.cgccpf)).trim();
    const clienteCod = String(cell(row, cols.cliente)).trim();
    const clienteId = cgccpf || clienteCod || clienteNome;
    const valor = parseNumberBR(cell(row, cols.vencido)) + parseNumberBR(cell(row, cols.avencer));
    const vencimento = parseDateBR(cell(row, cols.dtaVencimento));

    let vencido = false;
    let diasAtraso = 0;
    let diasAteVencer = 0;
    if (vencimento) {
      const d = diffInDays(ref, vencimento); // >0 => venceu há d dias
      if (d > 0) {
        vencido = true;
        diasAtraso = d;
      } else {
        diasAteVencer = -d;
      }
    }

    return {
      deptNumero,
      deptNomeArquivo,
      departamento,
      clienteId,
      clienteNome,
      cgccpf,
      titulo: String(cell(row, cols.titulo)).trim(),
      duplicata: String(cell(row, cols.duplicata)).trim(),
      valor,
      vencimento,
      vencido,
      diasAtraso,
      diasAteVencer,
    };
  });
}

/** Lista os departamentos do arquivo (número + nome), distintos, com a contagem de duplicatas. */
export function distinctDepartamentosArquivo(data: DuplicatasImport): Array<{ numero: string; nome: string; qtd: number }> {
  const cols = detectColumns(data.headers);
  const map = new Map<string, { nome: string; qtd: number }>();
  for (const row of data.rows) {
    const numero = String(cols.departamento >= 0 ? row[cols.departamento] ?? '' : '').trim();
    if (!numero) continue;
    const nome = String(cols.nomeDepartamento >= 0 ? row[cols.nomeDepartamento] ?? '' : '').trim();
    const acc = map.get(numero) ?? { nome, qtd: 0 };
    acc.qtd += 1;
    if (!acc.nome && nome) acc.nome = nome;
    map.set(numero, acc);
  }
  return Array.from(map.entries())
    .map(([numero, { nome, qtd }]) => ({ numero, nome, qtd }))
    .sort((a, b) => a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }));
}

// ─── Faixas de aging ───────────────────────────────────────────────────────

export interface Faixa {
  label: string;
  min: number;
  max: number;
}

export const FAIXAS_VENCIDO: Faixa[] = [
  { label: '1 a 30 dias', min: 1, max: 30 },
  { label: '31 a 60 dias', min: 31, max: 60 },
  { label: '61 a 90 dias', min: 61, max: 90 },
  { label: '91 a 120 dias', min: 91, max: 120 },
  { label: 'Acima de 120 dias', min: 121, max: Infinity },
];

export const FAIXAS_AVENCER: Faixa[] = [
  { label: '0 a 30 dias', min: 0, max: 30 },
  { label: '31 a 60 dias', min: 31, max: 60 },
  { label: '61 a 90 dias', min: 61, max: 90 },
  { label: '91 a 120 dias', min: 91, max: 120 },
  { label: 'Acima de 120 dias', min: 121, max: Infinity },
];

function faixaIndex(faixas: Faixa[], dias: number): number {
  for (let i = 0; i < faixas.length; i++) {
    if (dias >= faixas[i].min && dias <= faixas[i].max) return i;
  }
  return faixas.length - 1;
}

export interface ClienteValor {
  clienteId: string;
  clienteNome: string;
  qtd: number;
  valor: number;
}

export interface FaixaResult {
  label: string;
  qtd: number;
  valor: number;
  /** Clientes da faixa, agregados e ordenados por valor desc. */
  clientes: ClienteValor[];
}

function buildFaixas(duplicatas: Duplicata[], faixas: Faixa[], tipo: 'vencido' | 'avencer'): FaixaResult[] {
  const buckets = faixas.map((f) => ({ label: f.label, qtd: 0, valor: 0, clientes: new Map<string, ClienteValor>() }));
  for (const d of duplicatas) {
    const dias = tipo === 'vencido' ? d.diasAtraso : d.diasAteVencer;
    const b = buckets[faixaIndex(faixas, dias)];
    b.qtd += 1;
    b.valor += d.valor;
    const c = b.clientes.get(d.clienteId) ?? { clienteId: d.clienteId, clienteNome: d.clienteNome, qtd: 0, valor: 0 };
    c.qtd += 1;
    c.valor += d.valor;
    b.clientes.set(d.clienteId, c);
  }
  return buckets.map((b) => ({
    label: b.label,
    qtd: b.qtd,
    valor: b.valor,
    clientes: Array.from(b.clientes.values()).sort((a, z) => z.valor - a.valor),
  }));
}

// ─── Resumos ───────────────────────────────────────────────────────────────

export interface Kpis {
  totalReceber: number;
  totalVencido: number;
  totalAVencer: number;
  qtdDuplicatas: number;
  qtdClientes: number;
  ticketMedio: number;
  maiorDuplicata: number;
  percVencido: number;
}

export function computeKpis(duplicatas: Duplicata[]): Kpis {
  let totalReceber = 0;
  let totalVencido = 0;
  let totalAVencer = 0;
  let maiorDuplicata = 0;
  const clientes = new Set<string>();
  for (const d of duplicatas) {
    totalReceber += d.valor;
    if (d.vencido) totalVencido += d.valor;
    else totalAVencer += d.valor;
    if (d.valor > maiorDuplicata) maiorDuplicata = d.valor;
    clientes.add(d.clienteId);
  }
  return {
    totalReceber,
    totalVencido,
    totalAVencer,
    qtdDuplicatas: duplicatas.length,
    qtdClientes: clientes.size,
    ticketMedio: duplicatas.length > 0 ? totalReceber / duplicatas.length : 0,
    maiorDuplicata,
    percVencido: totalReceber > 0 ? (totalVencido / totalReceber) * 100 : 0,
  };
}

export interface DeptResumo {
  departamento: string;
  qtd: number;
  total: number;
  vencido: number;
  aVencer: number;
  percVencido: number;
}

/** Ordem canônica dos departamentos de classificação (+ "Não classificado" por último). */
export function departamentosOrdenados(): string[] {
  return [...DEPARTAMENTOS, DEPARTAMENTO_NAO_CLASSIFICADO];
}

export function resumoPorDepartamento(duplicatas: Duplicata[]): DeptResumo[] {
  const ordem = departamentosOrdenados();
  const map = new Map<string, DeptResumo>();
  for (const dep of ordem) {
    map.set(dep, { departamento: dep, qtd: 0, total: 0, vencido: 0, aVencer: 0, percVencido: 0 });
  }
  for (const d of duplicatas) {
    const r = map.get(d.departamento) ?? { departamento: d.departamento, qtd: 0, total: 0, vencido: 0, aVencer: 0, percVencido: 0 };
    r.qtd += 1;
    r.total += d.valor;
    if (d.vencido) r.vencido += d.valor;
    else r.aVencer += d.valor;
    map.set(d.departamento, r);
  }
  return Array.from(map.values())
    .map((r) => ({ ...r, percVencido: r.total > 0 ? (r.vencido / r.total) * 100 : 0 }))
    .filter((r) => r.qtd > 0);
}

export interface ClienteResumo {
  clienteId: string;
  clienteNome: string;
  qtd: number;
  total: number;
  vencido: number;
  aVencer: number;
  departamentos: string[];
  duplicatas: Duplicata[];
}

function agruparPorCliente(duplicatas: Duplicata[]): ClienteResumo[] {
  const map = new Map<string, ClienteResumo>();
  for (const d of duplicatas) {
    const r = map.get(d.clienteId) ?? {
      clienteId: d.clienteId,
      clienteNome: d.clienteNome,
      qtd: 0,
      total: 0,
      vencido: 0,
      aVencer: 0,
      departamentos: [],
      duplicatas: [],
    };
    r.qtd += 1;
    r.total += d.valor;
    if (d.vencido) r.vencido += d.valor;
    else r.aVencer += d.valor;
    if (!r.departamentos.includes(d.departamento)) r.departamentos.push(d.departamento);
    r.duplicatas.push(d);
    map.set(d.clienteId, r);
  }
  for (const r of map.values()) {
    r.duplicatas.sort((a, z) => {
      const av = a.vencimento ? a.vencimento.getTime() : Infinity;
      const zv = z.vencimento ? z.vencimento.getTime() : Infinity;
      return av - zv;
    });
  }
  return Array.from(map.values());
}

/** Top clientes por valor total a receber (desc). */
export function topClientesPorValor(duplicatas: Duplicata[]): ClienteResumo[] {
  return agruparPorCliente(duplicatas).sort((a, b) => b.total - a.total);
}

/** Top clientes por valor VENCIDO (desc), apenas quem tem algo vencido. */
export function topClientesPorVencido(duplicatas: Duplicata[]): ClienteResumo[] {
  return agruparPorCliente(duplicatas)
    .filter((c) => c.vencido > 0)
    .sort((a, b) => b.vencido - a.vencido);
}

export interface DuplicatasAnalysis {
  kpis: Kpis;
  faixasVencido: FaixaResult[];
  faixasAVencer: FaixaResult[];
  topClientes: ClienteResumo[];
  topClientesVencido: ClienteResumo[];
}

/** Análise de um conjunto de duplicatas (já filtrado por departamento, se for o caso). */
export function analyze(duplicatas: Duplicata[]): DuplicatasAnalysis {
  const vencidas = duplicatas.filter((d) => d.vencido);
  const aVencer = duplicatas.filter((d) => !d.vencido);
  return {
    kpis: computeKpis(duplicatas),
    faixasVencido: buildFaixas(vencidas, FAIXAS_VENCIDO, 'vencido'),
    faixasAVencer: buildFaixas(aVencer, FAIXAS_AVENCER, 'avencer'),
    topClientes: topClientesPorValor(duplicatas),
    topClientesVencido: topClientesPorVencido(duplicatas),
  };
}
