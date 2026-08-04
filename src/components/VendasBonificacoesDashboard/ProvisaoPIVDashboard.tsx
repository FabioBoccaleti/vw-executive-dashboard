import React, { useEffect, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { kvGet, kvSet } from '@/lib/kvClient';
import { loadVendasResultadoRows, type VendasResultadoRow } from './vendasResultadoStorage';
import { loadProvisaoPivConfig, saveProvisaoPivConfig, periodoKey } from './provisaoPivStorage';
import { loadArquivoPivStore } from './arquivoPivStorage';
import {
  loadSnapshotStore,
  saveSnapshotForPeriod,
  deleteSnapshotForPeriod,
  verifyUnlockPassword,
  type ProvisaoPivSnapshot,
} from './provisaoPivSnapshotStorage';
import { Wrench, Car, Layers, ArrowRight, ChevronDown, ChevronUp, Printer, Download, Lock, LockOpen } from 'lucide-react';

type RecebidoChassiData = { piv: number; siq: number; mesRecebimento: string | null };
type RecebidoOverridesStore = Record<string, Record<string, RecebidoChassiData>>;
const RECEBIDOS_OVERRIDE_KEY = 'provisao_piv_recebidos_overrides';
const CHASSI_ALIASES_KEY = 'provisao_piv_chassi_aliases';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const n = (v?: string | null) => {
  const raw = String(v ?? '').trim();
  if (!raw) return 0;
  const cleaned = raw
    .replace(/\s+/g, '')
    .replace(/R\$/gi, '')
    .replace(/[^\d,.-]/g, '');
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  return parseFloat(normalized) || 0;
};

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function getYr(r: VendasResultadoRow): number {
  if (r.periodoImport) {
    const [y] = r.periodoImport.split('-').map(Number);
    if (y > 2000) return y;
  }
  const d = r.dataVenda;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[2];
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return +d.split('-')[0];
  return 0;
}
function getMo(r: VendasResultadoRow): number {
  if (r.periodoImport) {
    const [, m] = r.periodoImport.split('-').map(Number);
    if (m >= 1 && m <= 12) return m;
  }
  const d = r.dataVenda;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[1];
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return +d.split('-')[1];
  return 0;
}

const MODEL_BASE_RULES: Array<{ pattern: RegExp; model: string }> = [
  { pattern: /\bT[\s-]?CROSS\b/, model: 'T-CROSS' },
  { pattern: /\bTIGUAN\b/, model: 'TIGUAN' },
  { pattern: /\bNIVUS\b/, model: 'NIVUS' },
  { pattern: /\bTAOS\b/, model: 'TAOS' },
  { pattern: /\bTERA\b/, model: 'TERA' },
  { pattern: /\bPOLO\b/, model: 'POLO' },
  { pattern: /\bJETTA\b/, model: 'JETTA' },
  { pattern: /\bVIRTUS\b/, model: 'VIRTUS' },
  { pattern: /\bSAVEIRO\b/, model: 'SAVEIRO' },
  { pattern: /\bAMAROK\b/, model: 'AMAROK' },
];

function normalizeModelBase(modelo?: string | null): string {
  const raw = String(modelo ?? '').trim().toUpperCase();
  if (!raw) return 'SEM MODELO';

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const rule of MODEL_BASE_RULES) {
    if (rule.pattern.test(normalized)) return rule.model;
  }

  const ignoredPrefixes = new Set(['NOVO', 'NOVA']);
  const tokens = normalized.split(' ').filter(Boolean);
  const base = tokens.find(token => !ignoredPrefixes.has(token));

  return base || normalized;
}

function normalizeChassi(v?: string | null): string {
  return String(v ?? '').trim().toUpperCase();
}

function isAmbiguousVinPair(a: string, b: string): boolean {
  const pair = `${a}${b}`;
  return new Set([
    '1I', 'I1', '1L', 'L1', '1T', 'T1',
    '0O', 'O0', '0Q', 'Q0',
    '5S', 'S5', '2Z', 'Z2', '8B', 'B8',
  ]).has(pair);
}

function findNearVinKey(
  query: string,
  availableKeys: string[],
): string | null {
  if (!query || query.length < 10) return null;

  let found: string | null = null;

  for (const key of availableKeys) {
    if (key.length !== query.length) continue;

    let diffCount = 0;
    let ambiguousOnly = true;

    for (let i = 0; i < query.length; i++) {
      if (query[i] === key[i]) continue;
      diffCount += 1;
      if (diffCount > 1) break;
      if (!isAmbiguousVinPair(query[i], key[i])) {
        ambiguousOnly = false;
        break;
      }
    }

    if (diffCount === 1 && ambiguousOnly) {
      if (found && found !== key) return null;
      found = key;
    }
  }

  return found;
}

function normalizeMesRecebimentoInput(v: string): string | null {
  const raw = String(v ?? '').trim();
  if (!raw) return null;

  const mSlash = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (mSlash) return `${mSlash[1].padStart(2, '0')}/${mSlash[2]}`;

  const mDash = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (mDash) return `${mDash[2].padStart(2, '0')}/${mDash[1]}`;

  return raw;
}

function formatPeriodoKeyToMesAno(pk?: string): string | null {
  if (!pk) return null;
  const m = pk.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return null;
  const yyyy = m[1];
  const mm = m[2].padStart(2, '0');
  return `${mm}/${yyyy}`;
}

function mesRecebimentoSortKey(v?: string | null): number {
  const raw = String(v ?? '').trim();
  if (!raw) return -1;
  const mSlash = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (mSlash) {
    const month = Number(mSlash[1]);
    const year = Number(mSlash[2]);
    if (month >= 1 && month <= 12) return year * 100 + month;
  }
  const mDash = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (mDash) {
    const year = Number(mDash[1]);
    const month = Number(mDash[2]);
    if (month >= 1 && month <= 12) return year * 100 + month;
  }
  return -1;
}

function buildRecebidosByChassiGlobal(
  arquivoStore: Record<string, { header?: { mesApurado?: string }; periodoKey?: string; rows?: Array<{ chassi?: string; valorBonusAtacado?: string; valorBonusSatisfacao?: string }> }>,
  overridesStore: RecebidoOverridesStore,
  aliasesStore: Record<string, string>,
): Record<string, RecebidoChassiData> {
  const mergedByPeriodo: Record<string, Record<string, RecebidoChassiData>> = {};

  const resolveAlias = (rawChassi?: string | null): string => {
    const normalized = normalizeChassi(rawChassi);
    return normalized && aliasesStore[normalized] ? normalizeChassi(aliasesStore[normalized]) : normalized;
  };

  for (const [pk, arquivoPivData] of Object.entries(arquivoStore ?? {})) {
    const periodMap: Record<string, RecebidoChassiData> = {};
    const mesRecebimentoDefault =
      String(arquivoPivData?.header?.mesApurado ?? '').trim() ||
      formatPeriodoKeyToMesAno(arquivoPivData?.periodoKey || pk);

    for (const row of arquivoPivData?.rows ?? []) {
      const chassi = resolveAlias(row.chassi);
      if (!chassi) continue;
      const piv = n(row.valorBonusAtacado);
      const siq = n(row.valorBonusSatisfacao);
      const current = periodMap[chassi];

      if (current) {
        current.piv += piv;
        current.siq += siq;
      } else {
        periodMap[chassi] = {
          piv,
          siq,
          mesRecebimento: mesRecebimentoDefault || null,
        };
      }
    }

    mergedByPeriodo[pk] = {
      ...periodMap,
      ...(overridesStore[pk] ?? {}),
    };
  }

  for (const [pk, periodOverrides] of Object.entries(overridesStore)) {
    if (!mergedByPeriodo[pk]) {
      mergedByPeriodo[pk] = { ...periodOverrides };
    }
  }

  const globalByChassi: Record<string, RecebidoChassiData> = {};
  for (const periodMap of Object.values(mergedByPeriodo)) {
    for (const [chassi, recebido] of Object.entries(periodMap)) {
      const current = globalByChassi[chassi];
      if (current) {
        current.piv += recebido.piv;
        current.siq += recebido.siq;
        if (mesRecebimentoSortKey(recebido.mesRecebimento) > mesRecebimentoSortKey(current.mesRecebimento)) {
          current.mesRecebimento = recebido.mesRecebimento ?? null;
        }
      } else {
        globalByChassi[chassi] = {
          piv: recebido.piv,
          siq: recebido.siq,
          mesRecebimento: recebido.mesRecebimento ?? null,
        };
      }
    }
  }

  return globalByChassi;
}

// ─── Barra bicolor animada ────────────────────────────────────────────────────
function RatioBiBar({ pctOficina }: { pctOficina: number }) {
  const clampedOficina = Math.min(100, Math.max(0, pctOficina));
  const clampedNovos   = 100 - clampedOficina;
  return (
    <div className="relative w-full h-3 rounded-full overflow-hidden bg-slate-100 flex">
      <div
        className="h-full bg-blue-500 transition-all duration-500 ease-out"
        style={{ width: `${clampedNovos}%` }}
      />
      <div
        className="h-full bg-orange-400 transition-all duration-500 ease-out"
        style={{ width: `${clampedOficina}%` }}
      />
    </div>
  );
}

// ─── Card de fonte (PIV ou SIQ) ───────────────────────────────────────────────
function SourceCard({
  label,
  value,
  count,
  color,
  pct,
}: {
  label: string;
  value: number;
  count: number;
  color: 'indigo' | 'violet';
  pct: number;
}) {
  const colorMap = {
    indigo: {
      border: 'border-indigo-200',
      bg: 'bg-indigo-50',
      badge: 'bg-indigo-100 text-indigo-700',
      label: 'text-indigo-600',
      value: 'text-indigo-900',
      dot: 'bg-indigo-500',
    },
    violet: {
      border: 'border-violet-200',
      bg: 'bg-violet-50',
      badge: 'bg-violet-100 text-violet-700',
      label: 'text-violet-600',
      value: 'text-violet-900',
      dot: 'bg-violet-500',
    },
  }[color];

  return (
    <div className={`rounded-xl border ${colorMap.border} ${colorMap.bg} p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold uppercase tracking-widest ${colorMap.label}`}>{label}</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colorMap.badge}`}>
          {count} registro{count !== 1 ? 's' : ''}
        </span>
      </div>
      <p className={`text-2xl font-black tabular-nums ${colorMap.value}`}>{fmtBRL(value)}</p>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${colorMap.dot}`} />
        <span className="text-[11px] text-slate-500">
          {pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% do total
        </span>
      </div>
    </div>
  );
}

// ─── Card de resultado do rateio ─────────────────────────────────────────────
function RateioCard({
  label,
  icon,
  value,
  pct,
  color,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  pct: number;
  color: 'blue' | 'orange';
}) {
  const colorMap = {
    blue: {
      border: 'border-blue-200',
      bg: 'from-blue-50 to-white',
      header: 'bg-blue-600',
      value: 'text-blue-900',
      badge: 'bg-blue-100 text-blue-700',
    },
    orange: {
      border: 'border-orange-200',
      bg: 'from-orange-50 to-white',
      header: 'bg-orange-500',
      value: 'text-orange-900',
      badge: 'bg-orange-100 text-orange-700',
    },
  }[color];

  return (
    <div className={`rounded-xl border ${colorMap.border} bg-gradient-to-b ${colorMap.bg} overflow-hidden flex flex-col`}>
      <div className={`${colorMap.header} px-4 py-2 flex items-center gap-2`}>
        <div className="text-white/90">{icon}</div>
        <span className="text-white text-xs font-bold uppercase tracking-widest">{label}</span>
        <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${colorMap.badge}`}>
          {pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
        </span>
      </div>
      <div className="px-4 py-4">
        <p className={`text-3xl font-black tabular-nums ${colorMap.value}`}>{fmtBRL(value)}</p>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
interface Props {
  filterYear: number;
  filterMonth: number | null;
}

export function ProvisaoPIVDashboard({ filterYear, filterMonth }: Props) {
  const [rows, setRows]           = useState<VendasResultadoRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [pctInput, setPctInput]   = useState('');
  const [saved, setSaved]         = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [expanded, setExpanded]   = useState(false); // detalhe por veículo
  const [resumoExpanded, setResumoExpanded] = useState(false);
  const [exportingDetalhe, setExportingDetalhe] = useState(false);
  const [recebidosByChassi, setRecebidosByChassi] = useState<Record<string, RecebidoChassiData>>({});
  const [editingChassi, setEditingChassi] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ piv: string; siq: string; mesRecebimento: string }>({
    piv: '',
    siq: '',
    mesRecebimento: '',
  });
  // ── Lock / Provisão ───────────────────────────────────────────────────────
  const [snapshot, setSnapshot]                     = useState<ProvisaoPivSnapshot | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput]           = useState('');
  const [passwordError, setPasswordError]           = useState('');
  const [verifying, setVerifying]                   = useState(false);

  // ── Carrega dados e config ────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const key = periodoKey(filterYear, filterMonth);
    Promise.all([
      loadVendasResultadoRows('novos'),
      loadProvisaoPivConfig(),
      loadArquivoPivStore(),
      kvGet(RECEBIDOS_OVERRIDE_KEY),
      kvGet(CHASSI_ALIASES_KEY),
      loadSnapshotStore(),
    ]).then(([vendasRows, cfg, arquivoStore, overridesRaw, aliasesRaw, snapStoreRaw]) => {
      setRows(vendasRows);
      setPctInput(cfg.rateios[key] ?? '');

      const overridesStore = (overridesRaw as RecebidoOverridesStore | null) ?? {};
      const aliasesStore = (aliasesRaw as Record<string, string> | null) ?? {};
      setRecebidosByChassi(buildRecebidosByChassiGlobal(arquivoStore, overridesStore, aliasesStore));
      setEditingChassi(null);
      setEditDraft({ piv: '', siq: '', mesRecebimento: '' });
      setSnapshot((snapStoreRaw as Record<string, ProvisaoPivSnapshot> | null)?.[key] ?? null);

      setConfigLoaded(true);
      setLoading(false);
    });
  }, [filterYear, filterMonth]);

  // ── Filtra por ano/mês ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter(r => {
      const yr = getYr(r);
      const mo = getMo(r);
      if (!yr) return false;
      if (yr !== filterYear) return false;
      if (filterMonth !== null && mo !== filterMonth) return false;
      return true;
    });
  }, [rows, filterYear, filterMonth]);

  // ── Totais ────────────────────────────────────────────────────────────────
  const { totalPiv, totalSiq, countPiv, countSiq } = useMemo(() => {
    let totalPiv = 0, totalSiq = 0, countPiv = 0, countSiq = 0;
    for (const r of filtered) {
      const piv = n(r.bonusPIV);
      const siq = n(r.bonusSIQ);
      if (piv !== 0) { totalPiv += piv; countPiv++; }
      if (siq !== 0) { totalSiq += siq; countSiq++; }
    }
    return { totalPiv, totalSiq, countPiv, countSiq };
  }, [filtered]);

  const totalGeral = totalPiv + totalSiq;

  // ── Rateio ────────────────────────────────────────────────────────────────
  const pctOficina = Math.min(100, Math.max(0, parseFloat(pctInput.replace(',', '.')) || 0));
  const valorOficina = (totalGeral * pctOficina) / 100;
  const valorNovos   = totalGeral - valorOficina;
  const pctNovos     = 100 - pctOficina;

  // ── Salvar % ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const cfg = await loadProvisaoPivConfig();
    const key = periodoKey(filterYear, filterMonth);
    cfg.rateios[key] = pctInput;
    await saveProvisaoPivConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // ── Detalhe por veículo ───────────────────────────────────────────────────
  const rowsWithBonus = useMemo(() =>
    filtered.filter(r => n(r.bonusPIV) !== 0 || n(r.bonusSIQ) !== 0),
    [filtered],
  );

  const getValorRecebidoPiv = (row: VendasResultadoRow): number | null => {
    const chassi = normalizeChassi(row.chassi);
    if (!chassi) return null;
    const recebido = recebidosByChassi[chassi]
      ?? (() => {
        const nearKey = findNearVinKey(chassi, Object.keys(recebidosByChassi));
        return nearKey ? recebidosByChassi[nearKey] : null;
      })();
    return recebido ? recebido.piv : null;
  };

  const getValorRecebidoSiq = (row: VendasResultadoRow): number | null => {
    const chassi = normalizeChassi(row.chassi);
    if (!chassi) return null;
    const recebido = recebidosByChassi[chassi]
      ?? (() => {
        const nearKey = findNearVinKey(chassi, Object.keys(recebidosByChassi));
        return nearKey ? recebidosByChassi[nearKey] : null;
      })();
    return recebido ? recebido.siq : null;
  };

  const getMesRecebimento = (row: VendasResultadoRow): string | null => {
    const chassi = normalizeChassi(row.chassi);
    if (!chassi) return null;
    const recebido = recebidosByChassi[chassi]
      ?? (() => {
        const nearKey = findNearVinKey(chassi, Object.keys(recebidosByChassi));
        return nearKey ? recebidosByChassi[nearKey] : null;
      })();
    return recebido?.mesRecebimento ?? null;
  };

  const startEditRow = (row: VendasResultadoRow) => {
    const chassi = normalizeChassi(row.chassi);
    if (!chassi) return;
    const recebidoPiv = getValorRecebidoPiv(row);
    const recebidoSiq = getValorRecebidoSiq(row);
    const mes = getMesRecebimento(row) ?? '';
    setEditingChassi(chassi);
    setEditDraft({
      piv: recebidoPiv !== null
        ? recebidoPiv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '',
      siq: recebidoSiq !== null
        ? recebidoSiq.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '',
      mesRecebimento: mes,
    });
  };

  const cancelEditRow = () => {
    setEditingChassi(null);
    setEditDraft({ piv: '', siq: '', mesRecebimento: '' });
  };

  const saveEditRow = async (row: VendasResultadoRow) => {
    const chassi = normalizeChassi(row.chassi);
    if (!chassi) return;

    const pivStr = editDraft.piv.trim();
    const siqStr = editDraft.siq.trim();
    const mesNorm = normalizeMesRecebimentoInput(editDraft.mesRecebimento);

    const hasAny = !!pivStr || !!siqStr || !!mesNorm;
    const pk = periodoKey(filterYear, filterMonth);
    const raw = await kvGet(RECEBIDOS_OVERRIDE_KEY);
    const store = ((raw as RecebidoOverridesStore | null) ?? {}) as RecebidoOverridesStore;
    const periodMap = { ...(store[pk] ?? {}) };

    if (hasAny) {
      periodMap[chassi] = {
        piv: n(pivStr),
        siq: n(siqStr),
        mesRecebimento: mesNorm,
      };
    } else {
      delete periodMap[chassi];
    }

    store[pk] = periodMap;
    await kvSet(RECEBIDOS_OVERRIDE_KEY, store);
    const [arquivoStore, aliasesRaw] = await Promise.all([
      loadArquivoPivStore(),
      kvGet(CHASSI_ALIASES_KEY),
    ]);
    const aliasesStore = (aliasesRaw as Record<string, string> | null) ?? {};
    setRecebidosByChassi(buildRecebidosByChassiGlobal(arquivoStore, store, aliasesStore));
    cancelEditRow();
  };

  const detalheRecebidoTotais = useMemo(() => {
    let recebidoPiv = 0;
    let recebidoSiq = 0;
    let hasRecebido = false;
    const mesesSet = new Set<string>();

    for (const r of rowsWithBonus) {
      const piv = getValorRecebidoPiv(r);
      const siq = getValorRecebidoSiq(r);
      const mes = getMesRecebimento(r);
      if (piv !== null) {
        recebidoPiv += piv;
        hasRecebido = true;
      }
      if (siq !== null) {
        recebidoSiq += siq;
        hasRecebido = true;
      }
      if (mes) mesesSet.add(mes);
    }

    const diferenca = hasRecebido
      ? totalGeral - (recebidoPiv + recebidoSiq)
      : null;

    let mesRecebimentoResumo: string | null = null;
    if (mesesSet.size === 1) mesRecebimentoResumo = [...mesesSet][0];
    else if (mesesSet.size > 1) mesRecebimentoResumo = 'Vários';

    return { recebidoPiv, recebidoSiq, diferenca, hasRecebido, mesRecebimentoResumo };
  }, [rowsWithBonus, totalGeral, recebidosByChassi]);

  // ── Resumo por modelo (sem versão) ──────────────────────────────────────
  const resumoPorModelo = useMemo(() => {
    const map = new Map<string, { modelo: string; piv: number; siq: number; total: number; bonusVarejo: number }>();

    for (const r of rowsWithBonus) {
      const modeloBase = normalizeModelBase(r.modelo);
      const piv = n(r.bonusPIV);
      const siq = n(r.bonusSIQ);
      const total = piv + siq;
      const bonusVarejo = n(r.bonusVarejo) + n(r.bonusTradeIn);

      const current = map.get(modeloBase);
      if (current) {
        current.piv += piv;
        current.siq += siq;
        current.total += total;
        current.bonusVarejo += bonusVarejo;
      } else {
        map.set(modeloBase, { modelo: modeloBase, piv, siq, total, bonusVarejo });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.modelo.localeCompare(b.modelo, 'pt-BR'));
  }, [rowsWithBonus]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Carregando...
      </div>
    );
  }

  const periodoLabel = filterMonth === null
    ? String(filterYear)
    : `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][filterMonth - 1]}/${filterYear}`;

  const isLocked = snapshot !== null;

  const display = {
    totalPiv:              isLocked ? snapshot!.totalPiv              : totalPiv,
    totalSiq:              isLocked ? snapshot!.totalSiq              : totalSiq,
    totalGeral:            isLocked ? snapshot!.totalGeral            : totalGeral,
    pctOficina:            isLocked ? snapshot!.pctOficina            : pctOficina,
    pctNovos:              isLocked ? snapshot!.pctNovos              : pctNovos,
    valorOficina:          isLocked ? snapshot!.valorOficina          : valorOficina,
    valorNovos:            isLocked ? snapshot!.valorNovos            : valorNovos,
    countPiv:              isLocked ? snapshot!.countPiv              : countPiv,
    countSiq:              isLocked ? snapshot!.countSiq              : countSiq,
    filteredCount:         isLocked ? snapshot!.filteredCount         : filtered.length,
    resumoPorModelo:       isLocked ? snapshot!.resumoPorModelo       : resumoPorModelo,
    detalheRecebidoTotais: isLocked ? snapshot!.detalheRecebidoTotais : detalheRecebidoTotais,
    rowsWithBonusCount:    isLocked ? snapshot!.rowsWithBonus.length  : rowsWithBonus.length,
  };

  // ── Travar provisão ───────────────────────────────────────────────────────
  const handleLock = async () => {
    const snapshotRowsData = rowsWithBonus.map(r => {
      const pivVal = n(r.bonusPIV);
      const siqVal = n(r.bonusSIQ);
      const tot    = pivVal + siqVal;
      const recPiv = getValorRecebidoPiv(r);
      const recSiq = getValorRecebidoSiq(r);
      const mes    = getMesRecebimento(r);
      return {
        id:             String(r.id ?? Math.random()),
        modelo:         r.modelo ?? '',
        chassi:         r.chassi ?? '',
        date:           r.dataVenda || r.periodoImport || '',
        piv:            pivVal,
        siq:            siqVal,
        total:          tot,
        recebidoPiv:    recPiv,
        recebidoSiq:    recSiq,
        mesRecebimento: mes,
        diferenca:      (recPiv !== null || recSiq !== null)
          ? tot - ((recPiv ?? 0) + (recSiq ?? 0))
          : null,
      };
    });

    const snap: ProvisaoPivSnapshot = {
      lockedAt:              new Date().toISOString(),
      periodoLabel,
      totalPiv,
      totalSiq,
      totalGeral,
      pctInput,
      pctOficina,
      pctNovos,
      valorOficina,
      valorNovos,
      countPiv,
      countSiq,
      filteredCount:         filtered.length,
      rowsWithBonus:         snapshotRowsData,
      resumoPorModelo,
      detalheRecebidoTotais,
    };

    const key = periodoKey(filterYear, filterMonth);
    await saveSnapshotForPeriod(key, snap);
    setSnapshot(snap);
  };

  const handleUnlockConfirm = async () => {
    setVerifying(true);
    setPasswordError('');
    const ok = await verifyUnlockPassword(passwordInput);
    if (!ok) {
      setPasswordError('Senha incorreta.');
      setVerifying(false);
      return;
    }
    const key = periodoKey(filterYear, filterMonth);
    await deleteSnapshotForPeriod(key);
    setSnapshot(null);
    setShowPasswordDialog(false);
    setPasswordInput('');
    setVerifying(false);
  };

  const handlePrintResumoModelo = () => {
    const printRoot = document.getElementById('print-root');
    if (!printRoot) {
      window.print();
      return;
    }

    const rowsHtml = display.resumoPorModelo.map(item => {
      return `
        <tr>
          <td>${escapeHtml(item.modelo)}</td>
          <td class="r">${fmtBRL(item.piv)}</td>
          <td class="r">${fmtBRL(item.siq)}</td>
          <td class="r strong">${fmtBRL(item.total)}</td>
          <td class="r">${fmtBRL(item.bonusVarejo)}</td>
        </tr>`;
    }).join('');

    const totalBonusVarejo = display.resumoPorModelo.reduce((acc, item) => acc + item.bonusVarejo, 0);

    printRoot.innerHTML = `
      <div class="print-page provisao-piv-print-page">
        <div class="provisao-piv-print-wrap">
          <h1>Provisao PIV + SIQ - Resumo por Modelo</h1>
          <p>Periodo: ${escapeHtml(periodoLabel)}</p>

          <table>
            <thead>
              <tr>
                <th>Modelo</th>
                <th class="r">PIV</th>
                <th class="r">SIQ</th>
                <th class="r">Total</th>
                <th class="r">Bônus Varejo</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="total-row">
                <td>Total</td>
                <td class="r">${fmtBRL(display.totalPiv)}</td>
                <td class="r">${fmtBRL(display.totalSiq)}</td>
                <td class="r strong">${fmtBRL(display.totalGeral)}</td>
                <td class="r">${fmtBRL(totalBonusVarejo)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <style>
        .provisao-piv-print-wrap {
          font-family: Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px;
        }
        .provisao-piv-print-wrap h1 {
          font-size: 16px;
          margin: 0 0 4px;
        }
        .provisao-piv-print-wrap p {
          font-size: 12px;
          color: #475569;
          margin: 0 0 12px;
        }
        .provisao-piv-print-wrap table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .provisao-piv-print-wrap th,
        .provisao-piv-print-wrap td {
          border: 1px solid #e2e8f0;
          padding: 6px 8px;
        }
        .provisao-piv-print-wrap th {
          background: #f8fafc;
          text-align: left;
          font-weight: 700;
          color: #334155;
        }
        .provisao-piv-print-wrap .r { text-align: right; }
        .provisao-piv-print-wrap .strong { font-weight: 800; }
        .provisao-piv-print-wrap .total-row td {
          background: #f1f5f9;
          font-weight: 700;
        }
      </style>
    `;

    window.print();
    printRoot.innerHTML = '';
  };

  const handleExportDetalheExcel = async () => {
    if (display.rowsWithBonusCount === 0) return;

    setExportingDetalhe(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Sorana Executive Dashboard';
      workbook.created = new Date();

      const ws = workbook.addWorksheet('Detalhe PIV');
      ws.columns = [
        { header: 'Modelo', key: 'modelo', width: 34 },
        { header: 'Chassi', key: 'chassi', width: 22 },
        { header: 'Data', key: 'data', width: 14 },
        { header: 'PIV', key: 'piv', width: 15 },
        { header: 'SIQ', key: 'siq', width: 15 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Valor Recebido PIV', key: 'recebidoPiv', width: 18 },
        { header: 'Valor Recebido SIQ', key: 'recebidoSiq', width: 18 },
        { header: 'Diferença', key: 'diferenca', width: 15 },
        { header: 'Mês Recebimento', key: 'mesRecebimento', width: 16 },
      ];

      const headerRow = ws.getRow(1);
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      });

      if (isLocked && snapshot) {
        snapshot.rowsWithBonus.forEach(sr => {
          ws.addRow({
            modelo:         sr.modelo || '—',
            chassi:         sr.chassi || '—',
            data:           sr.date || '—',
            piv:            sr.piv,
            siq:            sr.siq,
            total:          sr.total,
            recebidoPiv:    sr.recebidoPiv,
            recebidoSiq:    sr.recebidoSiq,
            diferenca:      sr.diferenca,
            mesRecebimento: sr.mesRecebimento,
          });
        });
      } else {
        rowsWithBonus.forEach(r => {
          const piv = n(r.bonusPIV);
          const siq = n(r.bonusSIQ);
          const recebidoPiv = getValorRecebidoPiv(r);
          const recebidoSiq = getValorRecebidoSiq(r);
          const mesRecebimento = getMesRecebimento(r);
          const hasRecebido = recebidoPiv !== null || recebidoSiq !== null;
          const diferenca = hasRecebido
            ? (piv + siq) - ((recebidoPiv ?? 0) + (recebidoSiq ?? 0))
            : null;
          ws.addRow({
            modelo: r.modelo || '—',
            chassi: r.chassi || '—',
            data: r.dataVenda || r.periodoImport || '—',
            piv,
            siq,
            total: piv + siq,
            recebidoPiv,
            recebidoSiq,
            diferenca,
            mesRecebimento,
          });
        });
      }

      const totalRow = ws.addRow({
        modelo: 'TOTAL',
        chassi: '',
        data: '',
        piv:            display.totalPiv,
        siq:            display.totalSiq,
        total:          display.totalGeral,
        recebidoPiv:    display.detalheRecebidoTotais.hasRecebido ? display.detalheRecebidoTotais.recebidoPiv : null,
        recebidoSiq:    display.detalheRecebidoTotais.hasRecebido ? display.detalheRecebidoTotais.recebidoSiq : null,
        diferenca:      display.detalheRecebidoTotais.diferenca,
        mesRecebimento: display.detalheRecebidoTotais.mesRecebimentoResumo,
      });
      totalRow.font = { bold: true };
      totalRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });

      const moneyFmt = '"R$"\ #,##0.00';
      ws.getColumn('piv').numFmt = moneyFmt;
      ws.getColumn('siq').numFmt = moneyFmt;
      ws.getColumn('total').numFmt = moneyFmt;
      ws.getColumn('recebidoPiv').numFmt = moneyFmt;
      ws.getColumn('recebidoSiq').numFmt = moneyFmt;
      ws.getColumn('diferenca').numFmt = moneyFmt;

      ws.eachRow((row, rowNumber) => {
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          if (rowNumber > 1 && cell.col >= 4 && cell.col <= 9) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }
        });
      });

      const periodoFile = filterMonth === null
        ? `${filterYear}`
        : `${filterYear}-${String(filterMonth).padStart(2, '0')}`;
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        `Detalhe_PIV_${periodoFile}.xlsx`,
      );
    } finally {
      setExportingDetalhe(false);
    }
  };

  return (
    <>
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="w-full max-w-[1680px] mx-auto px-4 lg:px-6 py-6 flex flex-col gap-6">

        {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Provisão PIV + SIQ</h2>
              {isLocked && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-widest">
                  <Lock className="w-3 h-3" />
                  Valores Provisionados
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Período: <span className="font-semibold text-slate-700">{periodoLabel}</span>
              {' · '}
              {display.filteredCount} venda{display.filteredCount !== 1 ? 's' : ''} no período
            </p>
          </div>
          <div className="flex items-center gap-3">
            {display.totalGeral > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Total Geral</p>
                <p className="text-2xl font-black text-slate-900 tabular-nums">{fmtBRL(display.totalGeral)}</p>
              </div>
            )}
            <button
              onClick={isLocked ? () => setShowPasswordDialog(true) : handleLock}
              title={isLocked ? 'Destravar provisão' : 'Travar provisão'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                isLocked
                  ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
              {isLocked ? 'Travado' : 'Travar'}
            </button>
          </div>
        </div>

        {/* ── Fontes: PIV + SIQ ────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Fontes de Bônus</p>
          <div className="grid grid-cols-2 gap-4">
            <SourceCard
              label="PIV"
              value={display.totalPiv}
              count={display.countPiv}
              color="indigo"
              pct={display.totalGeral > 0 ? (display.totalPiv / display.totalGeral) * 100 : 0}
            />
            <SourceCard
              label="SIQ"
              value={display.totalSiq}
              count={display.countSiq}
              color="violet"
              pct={display.totalGeral > 0 ? (display.totalSiq / display.totalGeral) * 100 : 0}
            />
          </div>

          {/* Barra proporcional PIV vs SIQ */}
          {display.totalGeral > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              <div className="relative w-full h-2.5 rounded-full overflow-hidden bg-slate-100 flex">
                <div
                  className="h-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${(display.totalPiv / display.totalGeral) * 100}%` }}
                />
                <div
                  className="h-full bg-violet-500 transition-all duration-500"
                  style={{ width: `${(display.totalSiq / display.totalGeral) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                  PIV {display.totalGeral > 0 ? ((display.totalPiv / display.totalGeral) * 100).toFixed(0) : 0}%
                </span>
                <span className="flex items-center gap-1">
                  SIQ {display.totalGeral > 0 ? ((display.totalSiq / display.totalGeral) * 100).toFixed(0) : 0}%
                  <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Separador com seta ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <div className="flex items-center gap-1.5 text-slate-400">
            <Layers className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Rateio</span>
          </div>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* ── Controle de rateio ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start gap-6">
            {/* Input % Oficina */}
            <div className="flex flex-col gap-2 min-w-[180px]">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                % destinado à Oficina
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={isLocked ? snapshot!.pctInput : pctInput}
                    onChange={e => { if (!isLocked) { setPctInput(e.target.value); setSaved(false); } }}
                    placeholder="0"
                    disabled={isLocked}
                    className={`w-24 text-2xl font-black text-slate-800 border-2 rounded-xl px-3 py-2 focus:outline-none text-center tabular-nums appearance-none ${
                      isLocked ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed' : 'border-slate-200 focus:border-orange-400'
                    }`}
                    style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                  />
                  <span className="ml-1.5 text-xl font-black text-slate-400">%</span>
                </div>
                <button
                  onClick={handleSave}
                  disabled={!configLoaded || isLocked}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    saved
                      ? 'bg-emerald-500 text-white'
                      : isLocked
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  {saved ? '✓ Salvo' : 'Salvar'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Novos receberá <span className="font-semibold text-blue-600">{display.pctNovos.toFixed(1)}%</span>
              </p>
            </div>

            {/* Preview da barra + legenda */}
            <div className="flex-1 flex flex-col gap-3 pt-5">
              <RatioBiBar pctOficina={display.pctOficina} />
              <div className="flex justify-between text-[10px] font-semibold">
                <span className="flex items-center gap-1 text-blue-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  Novos — {display.pctNovos.toFixed(1)}%
                </span>
                <span className="flex items-center gap-1 text-orange-500">
                  Oficina — {display.pctOficina.toFixed(1)}%
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Seta de fluxo ───────────────────────────────────────────────── */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-1 text-slate-300">
            <div className="w-px h-4 bg-slate-200" />
            <ArrowRight className="w-4 h-4 rotate-90" />
          </div>
        </div>

        {/* ── Cards de resultado ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <RateioCard
            label="Novos"
            icon={<Car className="w-4 h-4" />}
            value={display.valorNovos}
            pct={display.pctNovos}
            color="blue"
          />
          <RateioCard
            label="Oficina"
            icon={<Wrench className="w-4 h-4" />}
            value={display.valorOficina}
            pct={display.pctOficina}
            color="orange"
          />
        </div>

        {/* ── Resumo total ─────────────────────────────────────────────────── */}
        <div className="bg-slate-800 rounded-2xl px-5 py-4 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Conferência Total
          </span>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-blue-300 font-semibold tabular-nums">{fmtBRL(display.valorNovos)}</span>
            <span className="text-slate-500 text-xs">+</span>
            <span className="text-orange-300 font-semibold tabular-nums">{fmtBRL(display.valorOficina)}</span>
            <span className="text-slate-500 text-xs">=</span>
            <span className="text-white font-black text-base tabular-nums">{fmtBRL(display.totalGeral)}</span>
          </div>
        </div>

        {/* ── Resumo por modelo (sem versão) ─────────────────────────────── */}
        {display.resumoPorModelo.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => setResumoExpanded(v => !v)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Resumo por Modelo</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">
                  {display.resumoPorModelo.length} modelo{display.resumoPorModelo.length !== 1 ? 's' : ''}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${resumoExpanded ? 'rotate-180' : ''}`} />
            </button>

            {resumoExpanded && (
              <div className="border-t border-slate-100">
                <div className="px-5 py-2.5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">
                    Agrupado sem versão
                  </span>
                  <button
                    onClick={handlePrintResumoModelo}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir Resumo PDF
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-2.5 text-left font-semibold text-slate-500 text-[10px] uppercase tracking-wide">Modelo</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-indigo-600 text-[10px] uppercase tracking-wide">PIV</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-violet-600 text-[10px] uppercase tracking-wide">SIQ</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-slate-600 text-[10px] uppercase tracking-wide">Total</th>
                            <th className="px-4 py-2.5 text-right font-semibold text-emerald-600 text-[10px] uppercase tracking-wide">Bônus Varejo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {display.resumoPorModelo.map((item, i) => (
                        <tr key={item.modelo} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="px-4 py-2.5 font-medium text-slate-700">{item.modelo}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-indigo-700 tabular-nums">{fmtBRL(item.piv)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-violet-700 tabular-nums">{fmtBRL(item.siq)}</td>
                          <td className="px-4 py-2.5 text-right font-black text-slate-800 tabular-nums">{fmtBRL(item.total)}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-emerald-700 tabular-nums">{fmtBRL(item.bonusVarejo)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 border-t-2 border-slate-300">
                        <td className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Total</td>
                        <td className="px-4 py-2.5 text-right font-black text-indigo-700 tabular-nums">{fmtBRL(display.totalPiv)}</td>
                        <td className="px-4 py-2.5 text-right font-black text-violet-700 tabular-nums">{fmtBRL(display.totalSiq)}</td>
                        <td className="px-4 py-2.5 text-right font-black text-slate-900 tabular-nums">{fmtBRL(display.totalGeral)}</td>
                            <td className="px-4 py-2.5 text-right font-black text-emerald-700 tabular-nums">
                              {fmtBRL(display.resumoPorModelo.reduce((acc, item) => acc + item.bonusVarejo, 0))}
                            </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Detalhe por veículo (colapsável) ────────────────────────────── */}
        {display.rowsWithBonusCount > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors">
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex-1 flex items-center gap-2 text-left"
              >
                <span className="text-xs font-bold text-slate-700">Detalhe por Veículo</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">
                  {display.rowsWithBonusCount} veículo{display.rowsWithBonusCount !== 1 ? 's' : ''}
                </span>
              </button>

              <div className="flex items-center gap-2 ml-3">
                <button
                  onClick={handleExportDetalheExcel}
                  disabled={exportingDetalhe}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5" />
                  {exportingDetalhe ? 'Exportando...' : 'Exportar Excel'}
                </button>
                <button onClick={() => setExpanded(v => !v)}>
                  {expanded
                    ? <ChevronUp className="w-4 h-4 text-slate-400" />
                    : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
              </div>
            </div>

            {expanded && (
              <div className="overflow-x-auto border-t border-slate-100">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-500 text-[10px] uppercase tracking-wide">Modelo</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-500 text-[10px] uppercase tracking-wide">Chassi</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-500 text-[10px] uppercase tracking-wide">Data</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-indigo-600 text-[10px] uppercase tracking-wide">PIV</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-violet-600 text-[10px] uppercase tracking-wide">SIQ</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-slate-600 text-[10px] uppercase tracking-wide">Total</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-emerald-600 text-[10px] uppercase tracking-wide">Valor Recebido PIV</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-teal-600 text-[10px] uppercase tracking-wide">Valor Recebido SIQ</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-amber-600 text-[10px] uppercase tracking-wide">Diferença</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-sky-600 text-[10px] uppercase tracking-wide">Mês Recebimento</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-slate-500 text-[10px] uppercase tracking-wide">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLocked ? (
                      snapshot!.rowsWithBonus.map((sr, i) => (
                        <tr key={sr.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="px-4 py-2.5 font-medium text-slate-700">{sr.modelo || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono">{sr.chassi || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-400">{sr.date || '—'}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-indigo-700 tabular-nums">
                            {sr.piv !== 0 ? fmtBRL(sr.piv) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-violet-700 tabular-nums">
                            {sr.siq !== 0 ? fmtBRL(sr.siq) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-black text-slate-800 tabular-nums">{fmtBRL(sr.total)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-emerald-700 tabular-nums">
                            {sr.recebidoPiv !== null ? fmtBRL(sr.recebidoPiv) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-teal-700 tabular-nums">
                            {sr.recebidoSiq !== null ? fmtBRL(sr.recebidoSiq) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-amber-700 tabular-nums">
                            {sr.diferenca !== null ? fmtBRL(sr.diferenca) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-sky-700 font-medium">
                            {sr.mesRecebimento ?? <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="text-slate-300 text-[10px]">—</span>
                          </td>
                        </tr>
                      ))
                    ) : rowsWithBonus.map((r, i) => {
                      const chassi = normalizeChassi(r.chassi);
                      const isEditing = !!chassi && editingChassi === chassi;
                      const piv = n(r.bonusPIV);
                      const siq = n(r.bonusSIQ);
                      const tot = piv + siq;
                      const recebidoPiv = getValorRecebidoPiv(r);
                      const recebidoSiq = getValorRecebidoSiq(r);
                      const mesRecebimento = getMesRecebimento(r);
                      const hasRecebido = recebidoPiv !== null || recebidoSiq !== null;
                      const diferenca = hasRecebido
                        ? tot - ((recebidoPiv ?? 0) + (recebidoSiq ?? 0))
                        : null;
                      return (
                        <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="px-4 py-2.5 font-medium text-slate-700">{r.modelo || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono">{r.chassi || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-400">{r.dataVenda || r.periodoImport || '—'}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-indigo-700 tabular-nums">
                            {piv !== 0 ? fmtBRL(piv) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-violet-700 tabular-nums">
                            {siq !== 0 ? fmtBRL(siq) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-black text-slate-800 tabular-nums">
                            {fmtBRL(tot)}
                          </td>
                          {isEditing ? (
                            <>
                              <td className="px-4 py-2.5">
                                <input
                                  value={editDraft.piv}
                                  onChange={e => setEditDraft(prev => ({ ...prev, piv: e.target.value }))}
                                  placeholder="0,00"
                                  className="w-28 border border-slate-200 rounded px-2 py-1 text-xs text-right text-slate-700 focus:outline-none focus:border-emerald-400"
                                />
                              </td>
                              <td className="px-4 py-2.5">
                                <input
                                  value={editDraft.siq}
                                  onChange={e => setEditDraft(prev => ({ ...prev, siq: e.target.value }))}
                                  placeholder="0,00"
                                  className="w-28 border border-slate-200 rounded px-2 py-1 text-xs text-right text-slate-700 focus:outline-none focus:border-teal-400"
                                />
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2.5 text-right font-semibold text-emerald-700 tabular-nums">
                                {recebidoPiv !== null ? fmtBRL(recebidoPiv) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-teal-700 tabular-nums">
                                {recebidoSiq !== null ? fmtBRL(recebidoSiq) : <span className="text-slate-300">—</span>}
                              </td>
                            </>
                          )}
                          <td className="px-4 py-2.5 text-right font-semibold text-amber-700 tabular-nums">
                            {diferenca !== null ? fmtBRL(diferenca) : <span className="text-slate-300">—</span>}
                          </td>
                          {isEditing ? (
                            <td className="px-4 py-2.5">
                              <input
                                value={editDraft.mesRecebimento}
                                onChange={e => setEditDraft(prev => ({ ...prev, mesRecebimento: e.target.value }))}
                                placeholder="MM/AAAA"
                                className="w-24 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-sky-400"
                              />
                            </td>
                          ) : (
                            <td className="px-4 py-2.5 text-sky-700 font-medium">
                              {mesRecebimento ?? <span className="text-slate-300">—</span>}
                            </td>
                          )}
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-center gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => saveEditRow(r)}
                                    className="px-2 py-1 rounded border border-emerald-200 text-emerald-700 text-[10px] font-semibold hover:bg-emerald-50"
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    onClick={cancelEditRow}
                                    className="px-2 py-1 rounded border border-slate-200 text-slate-500 text-[10px] font-semibold hover:bg-slate-50"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => startEditRow(r)}
                                  disabled={!chassi}
                                  className="px-2 py-1 rounded border border-slate-200 text-slate-600 text-[10px] font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  Editar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-100 border-t-2 border-slate-300">
                      <td colSpan={3} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Total</td>
                      <td className="px-4 py-2.5 text-right font-black text-indigo-700 tabular-nums">{fmtBRL(display.totalPiv)}</td>
                      <td className="px-4 py-2.5 text-right font-black text-violet-700 tabular-nums">{fmtBRL(display.totalSiq)}</td>
                      <td className="px-4 py-2.5 text-right font-black text-slate-900 tabular-nums">{fmtBRL(display.totalGeral)}</td>
                      <td className="px-4 py-2.5 text-right font-black text-emerald-700 tabular-nums">
                        {display.detalheRecebidoTotais.hasRecebido ? fmtBRL(display.detalheRecebidoTotais.recebidoPiv) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-black text-teal-700 tabular-nums">
                        {display.detalheRecebidoTotais.hasRecebido ? fmtBRL(display.detalheRecebidoTotais.recebidoSiq) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-black text-amber-700 tabular-nums">
                        {display.detalheRecebidoTotais.diferenca !== null ? fmtBRL(display.detalheRecebidoTotais.diferenca) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-sky-700 font-black">
                        {display.detalheRecebidoTotais.mesRecebimentoResumo ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5" />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Estado vazio ─────────────────────────────────────────────────── */}
        {display.totalGeral === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-300 gap-3">
            <Layers className="w-12 h-12" />
            <p className="text-sm">Nenhum valor de PIV ou SIQ no período selecionado.</p>
          </div>
        )}

      </div>
    </div>

    {/* ── Diálogo de senha para destravar ──────────────────────────────────── */}
    {showPasswordDialog && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={() => { setShowPasswordDialog(false); setPasswordInput(''); setPasswordError(''); }}
      >
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Destravar Provisão</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {periodoLabel} · Digite a senha para destravar.
              </p>
            </div>
          </div>
          <input
            type="password"
            value={passwordInput}
            onChange={e => { setPasswordInput(e.target.value); setPasswordError(''); }}
            onKeyDown={e => e.key === 'Enter' && !verifying && handleUnlockConfirm()}
            placeholder="Senha"
            autoFocus
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-amber-400 text-center tracking-widest"
          />
          {passwordError && (
            <p className="text-xs text-red-500 text-center font-semibold -mt-2">{passwordError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setShowPasswordDialog(false); setPasswordInput(''); setPasswordError(''); }}
              className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleUnlockConfirm}
              disabled={verifying || !passwordInput}
              className="flex-1 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {verifying ? 'Verificando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
