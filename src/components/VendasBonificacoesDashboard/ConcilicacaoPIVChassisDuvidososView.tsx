import React, { useEffect, useMemo, useState } from 'react';
import { kvGet, kvSet } from '@/lib/kvClient';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { loadVendasResultadoRows, type VendasResultadoRow } from './vendasResultadoStorage';
import { loadArquivoPivStore } from './arquivoPivStorage';
import { periodoKey } from './provisaoPivStorage';

const CHASSI_ALIASES_KEY = 'provisao_piv_chassi_aliases';

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

function normalizeChassi(v?: string | null): string {
  return String(v ?? '').trim().toUpperCase();
}

function formatPeriodoKeyToMesAno(pk?: string): string | null {
  if (!pk) return null;
  const m = pk.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return null;
  const yyyy = m[1];
  const mm = m[2].padStart(2, '0');
  return `${mm}/${yyyy}`;
}

function vinDistance(a: string, b: string): number {
  if (!a || !b) return 99;
  if (a.length === b.length) {
    let dif = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) dif += 1;
    }
    return dif;
  }

  const al = a.length;
  const bl = b.length;
  const dp: number[][] = Array.from({ length: al + 1 }, () => Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) dp[i][0] = i;
  for (let j = 0; j <= bl; j++) dp[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[al][bl];
}

function commonPrefixLen(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  let i = 0;
  while (i < len && a[i] === b[i]) i += 1;
  return i;
}

function suffixEqualCount(a: string, b: string, tailLen = 6): number {
  const len = Math.min(a.length, b.length, tailLen);
  let eq = 0;
  for (let i = 0; i < len; i++) {
    if (a[a.length - 1 - i] === b[b.length - 1 - i]) eq += 1;
  }
  return eq;
}

type ProvisionCandidate = {
  chassi: string;
  modelo: string;
  data: string;
  piv: number;
  siq: number;
  total: number;
};

type DuvidosoRow = {
  id: string;
  arquivoPk: string;
  arquivoChassi: string;
  sugestaoChassi: string;
  sugestaoModelo: string;
  sugestaoData: string;
  arquivoTotal: number;
  sugestaoTotal: number;
  arquivoPiv: number;
  arquivoSiq: number;
  mesRecebimento: string;
  distancia: number;
  matchTipo: 'typo' | 'truncado';
};

interface Props {
  filterYear: number;
  filterMonth: number | null;
  onConfirmed?: () => void;
  dataVersion?: number;
}

export function ConcilicacaoPIVChassisDuvidososView({
  filterYear,
  filterMonth,
  onConfirmed,
  dataVersion = 0,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [duvidosos, setDuvidosos] = useState<DuvidosoRow[]>([]);

  useEffect(() => {
    setLoading(true);

    Promise.all([
      loadVendasResultadoRows('novos'),
      loadArquivoPivStore(),
      kvGet(CHASSI_ALIASES_KEY),
    ]).then(([vendasRows, arquivoStore, aliasesRaw]) => {
      const aliases = (aliasesRaw as Record<string, string> | null) ?? {};

      const provisionRows: ProvisionCandidate[] = vendasRows
        .filter(r => {
          const yr = getYr(r);
          const mo = getMo(r);
          if (!yr || yr !== filterYear) return false;
          if (filterMonth !== null && mo !== filterMonth) return false;
          return n(r.bonusPIV) !== 0 || n(r.bonusSIQ) !== 0;
        })
        .map(r => {
          const piv = n(r.bonusPIV);
          const siq = n(r.bonusSIQ);
          return {
            chassi: normalizeChassi(r.chassi),
            modelo: r.modelo || '-',
            data: r.dataVenda || r.periodoImport || '-',
            piv,
            siq,
            total: piv + siq,
          };
        })
        .filter(r => r.chassi.length >= 8);

      const exactSet = new Set(provisionRows.map(r => r.chassi));
      const nextDuvidosos: DuvidosoRow[] = [];

      for (const [pk, arquivoPivData] of Object.entries(arquivoStore ?? {})) {
        const mesRecebimento =
          String(arquivoPivData?.header?.mesApurado ?? '').trim()
          || formatPeriodoKeyToMesAno(arquivoPivData?.periodoKey || pk)
          || '';

        for (const item of arquivoPivData?.rows ?? []) {
          const arquivoChassiRaw = normalizeChassi(item.chassi);
          if (!arquivoChassiRaw || arquivoChassiRaw.length < 8) continue;

          if (aliases[arquivoChassiRaw]) continue;
          if (exactSet.has(arquivoChassiRaw)) continue;

          const arquivoPiv = n(item.valorBonusAtacado);
          const arquivoSiq = n(item.valorBonusSatisfacao);
          const arquivoTotal = arquivoPiv + arquivoSiq;

          const scored = provisionRows
            .map(c => {
              const distance = vinDistance(arquivoChassiRaw, c.chassi);
              const prefixLen = commonPrefixLen(arquivoChassiRaw, c.chassi);
              const suffixEq = suffixEqualCount(arquivoChassiRaw, c.chassi, 6);
              const lenDiff = Math.abs(arquivoChassiRaw.length - c.chassi.length);
              const isSuffixMatch =
                arquivoChassiRaw.endsWith(c.chassi)
                || c.chassi.endsWith(arquivoChassiRaw);
              const totalBase = Math.max(1, Math.abs(c.total), Math.abs(arquivoTotal));
              const totalDiffRatio = Math.abs(c.total - arquivoTotal) / totalBase;
              const typoLike = distance >= 2
                && distance <= 3
                && prefixLen >= 10
                && suffixEq >= 4
                && (distance === 3 ? totalDiffRatio <= 0.18 && suffixEq >= 5 : totalDiffRatio <= 0.35);

              const truncatedLike = isSuffixMatch
                && lenDiff >= 5
                && suffixEq >= 6
                && totalDiffRatio <= 0.08;

              const shiftedSuffixLike = !isSuffixMatch
                && lenDiff >= 1
                && lenDiff <= 3
                && suffixEq >= 8
                && totalDiffRatio <= 0.08;

              const baseScore = (distance * 100) + (totalDiffRatio * 100) - (prefixLen * 3) - (suffixEq * 2);
              const score = (truncatedLike || shiftedSuffixLike) ? (baseScore - 500) : baseScore;

              return {
                c,
                distance,
                totalDiffRatio,
                prefixLen,
                suffixEq,
                lenDiff,
                isSuffixMatch,
                typoLike,
                truncatedLike,
                shiftedSuffixLike,
                score,
              };
            })
            .filter(s => s.typoLike || s.truncatedLike || s.shiftedSuffixLike)
            .sort((a, b) => a.score - b.score);

          if (!scored.length) continue;

          const best = scored[0];
          const hasTie = scored.length > 1 && Math.abs(scored[1].score - best.score) < 0.0001;
          if (hasTie) continue;

          nextDuvidosos.push({
            id: `${pk}|${arquivoChassiRaw}|${best.c.chassi}`,
            arquivoPk: pk,
            arquivoChassi: arquivoChassiRaw,
            sugestaoChassi: best.c.chassi,
            sugestaoModelo: best.c.modelo,
            sugestaoData: best.c.data,
            arquivoTotal,
            sugestaoTotal: best.c.total,
            arquivoPiv,
            arquivoSiq,
            mesRecebimento,
            distancia: best.distance,
            matchTipo: (best.truncatedLike || best.shiftedSuffixLike) ? 'truncado' : 'typo',
          });
        }
      }

      setDuvidosos(nextDuvidosos);
      setLoading(false);
    });
  }, [filterYear, filterMonth, dataVersion]);

  const totalSugestoes = useMemo(() => duvidosos.length, [duvidosos]);

  const handleConfirm = async (item: DuvidosoRow) => {
    setConfirmingId(item.id);
    try {
      const rawAliases = await kvGet(CHASSI_ALIASES_KEY);
      const aliases = (rawAliases as Record<string, string> | null) ?? {};
      aliases[item.arquivoChassi] = item.sugestaoChassi;
      await kvSet(CHASSI_ALIASES_KEY, aliases);

      setDuvidosos(prev => prev.filter(d => d.id !== item.id));
      toast.success(`Confirmado: ${item.arquivoChassi} -> ${item.sugestaoChassi}`);
      onConfirmed?.();
    } catch (err) {
      console.error(err);
      toast.error('Nao foi possivel confirmar o chassi duvidoso.');
    } finally {
      setConfirmingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 bg-slate-50/40">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-700">Chassis Duvidosos</h3>
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{totalSugestoes}</span> sugestao{totalSugestoes !== 1 ? 'es' : ''}
          </div>
        </div>

        {duvidosos.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            Nenhum chassi duvidoso encontrado para o filtro selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px]">
                <tr>
                  <th className="text-left px-3 py-2">Chassi Arquivo PIV</th>
                  <th className="text-left px-3 py-2">Chassi Provisao (Sugestao)</th>
                  <th className="text-left px-3 py-2">Modelo</th>
                  <th className="text-left px-3 py-2">Data</th>
                  <th className="text-right px-3 py-2">Total Arquivo</th>
                  <th className="text-right px-3 py-2">Total Provisao</th>
                  <th className="text-center px-3 py-2">Distancia</th>
                  <th className="text-center px-3 py-2">Tipo</th>
                  <th className="text-left px-3 py-2">Mes Recebimento</th>
                  <th className="text-center px-3 py-2">Acao</th>
                </tr>
              </thead>
              <tbody>
                {duvidosos.map(item => (
                  <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-mono text-slate-700">{item.arquivoChassi}</td>
                    <td className="px-3 py-2 font-mono text-blue-700 font-semibold">{item.sugestaoChassi}</td>
                    <td className="px-3 py-2 text-slate-700">{item.sugestaoModelo}</td>
                    <td className="px-3 py-2 text-slate-500">{item.sugestaoData}</td>
                    <td className="px-3 py-2 text-right font-semibold text-indigo-600">{fmtBRL(item.arquivoTotal)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-violet-600">{fmtBRL(item.sugestaoTotal)}</td>
                    <td className="px-3 py-2 text-center text-amber-700 font-semibold">{item.distancia}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={item.matchTipo === 'truncado'
                          ? 'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800'
                          : 'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-800'}
                      >
                        {item.matchTipo === 'truncado' ? 'Truncado' : 'Typo'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{item.mesRecebimento || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={confirmingId === item.id}
                        onClick={() => handleConfirm(item)}
                        className="inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {confirmingId === item.id ? 'Confirmando...' : 'Confirmar'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
