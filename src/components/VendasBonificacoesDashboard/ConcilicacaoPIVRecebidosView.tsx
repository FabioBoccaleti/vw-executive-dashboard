import React, { useEffect, useMemo, useState } from 'react';
import { kvGet } from '@/lib/kvClient';
import { loadVendasResultadoRows, type VendasResultadoRow } from './vendasResultadoStorage';
import { loadArquivoPivStore } from './arquivoPivStorage';
import { periodoKey } from './provisaoPivStorage';

type RecebidoChassiData = { piv: number; siq: number; mesRecebimento: string | null };
type RecebidoOverridesStore = Record<string, Record<string, RecebidoChassiData>>;

type RecebidosByPeriodo = Record<string, Record<string, RecebidoChassiData>>;

const RECEBIDOS_OVERRIDE_KEY = 'provisao_piv_recebidos_overrides';

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

function normalizeMesRecebimento(v?: string | null): string | null {
  const raw = String(v ?? '').trim();
  if (!raw) return null;

  const mSlash = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (mSlash) return `${mSlash[1].padStart(2, '0')}/${mSlash[2]}`;

  const mDash = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (mDash) return `${mDash[2].padStart(2, '0')}/${mDash[1]}`;

  return raw;
}

interface Props {
  filterYear: number;
  filterMonth: number | null;
}

export function ConcilicacaoPIVRecebidosView({ filterYear, filterMonth }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<VendasResultadoRow[]>([]);
  const [recebidosByPeriodo, setRecebidosByPeriodo] = useState<RecebidosByPeriodo>({});

  useEffect(() => {
    setLoading(true);

    Promise.all([
      loadVendasResultadoRows('novos'),
      loadArquivoPivStore(),
      kvGet(RECEBIDOS_OVERRIDE_KEY),
    ]).then(([vendasRows, arquivoStore, overridesRaw]) => {
      setRows(vendasRows);

      const importadosByPeriodo: RecebidosByPeriodo = {};

      for (const [pk, arquivoPivData] of Object.entries(arquivoStore ?? {})) {
        const periodMap: Record<string, RecebidoChassiData> = {};
        const mesRecebimentoDefault =
          (arquivoPivData?.header?.mesApurado ?? '').trim() ||
          formatPeriodoKeyToMesAno(arquivoPivData?.periodoKey);

        for (const row of arquivoPivData?.rows ?? []) {
          const chassi = normalizeChassi(row.chassi);
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

        importadosByPeriodo[pk] = periodMap;
      }

      const overridesStore = (overridesRaw as RecebidoOverridesStore | null) ?? {};
      const mergedByPeriodo: RecebidosByPeriodo = {};

      const allPeriodKeys = new Set<string>([
        ...Object.keys(importadosByPeriodo),
        ...Object.keys(overridesStore),
      ]);

      for (const pk of allPeriodKeys) {
        mergedByPeriodo[pk] = {
          ...(importadosByPeriodo[pk] ?? {}),
          ...(overridesStore[pk] ?? {}),
        };
      }

      setRecebidosByPeriodo(mergedByPeriodo);
      setLoading(false);
    });
  }, []);

  const targetMesRecebimento = useMemo(() => {
    if (filterMonth === null) return null;
    return `${String(filterMonth).padStart(2, '0')}/${filterYear}`;
  }, [filterYear, filterMonth]);

  const detalheRecebidos = useMemo(() => {
    return rows
      .filter(r => n(r.bonusPIV) !== 0 || n(r.bonusSIQ) !== 0)
      .map(r => {
        const piv = n(r.bonusPIV);
        const siq = n(r.bonusSIQ);
        const yr = getYr(r);
        const mo = getMo(r);
        const pk = yr > 0 && mo > 0 ? periodoKey(yr, mo) : null;

        const chassiNorm = normalizeChassi(r.chassi);
        const recebido = pk && chassiNorm ? recebidosByPeriodo[pk]?.[chassiNorm] : null;

        const recebidoPiv = recebido?.piv ?? null;
        const recebidoSiq = recebido?.siq ?? null;
        const mesRecebimento = normalizeMesRecebimento(recebido?.mesRecebimento);

        const diferenca = (piv + siq) - ((recebidoPiv ?? 0) + (recebidoSiq ?? 0));

        return {
          id: r.id,
          modelo: r.modelo || '-',
          chassi: r.chassi || '-',
          data: r.dataVenda || r.periodoImport || '-',
          dataYear: yr,
          dataMonth: mo,
          piv,
          siq,
          total: piv + siq,
          recebidoPiv,
          recebidoSiq,
          diferenca,
          mesRecebimento,
        };
      })
      .filter(row => {
        if (!row.mesRecebimento) return false;
        if (targetMesRecebimento) return row.mesRecebimento === targetMesRecebimento;
        return row.mesRecebimento.endsWith(`/${filterYear}`);
      });
  }, [rows, recebidosByPeriodo, targetMesRecebimento, filterYear]);

  const resumoPorCompetenciaData = useMemo(() => {
    const map = new Map<string, {
      competencia: string;
      piv: number;
      siq: number;
      recebidoPiv: number;
      recebidoSiq: number;
      diferenca: number;
      linhas: number;
    }>();

    for (const row of detalheRecebidos) {
      if (!row.dataYear || !row.dataMonth) continue;
      const competencia = `${String(row.dataMonth).padStart(2, '0')}/${row.dataYear}`;
      const current = map.get(competencia);
      if (current) {
        current.piv += row.piv;
        current.siq += row.siq;
        current.recebidoPiv += row.recebidoPiv ?? 0;
        current.recebidoSiq += row.recebidoSiq ?? 0;
        current.diferenca += row.diferenca;
        current.linhas += 1;
      } else {
        map.set(competencia, {
          competencia,
          piv: row.piv,
          siq: row.siq,
          recebidoPiv: row.recebidoPiv ?? 0,
          recebidoSiq: row.recebidoSiq ?? 0,
          diferenca: row.diferenca,
          linhas: 1,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const [aM, aY] = a.competencia.split('/').map(Number);
      const [bM, bY] = b.competencia.split('/').map(Number);
      return bY - aY || bM - aM;
    });
  }, [detalheRecebidos]);

  const totalRecebidos = useMemo(
    () => detalheRecebidos.reduce((acc, row) => acc + (row.recebidoPiv ?? 0) + (row.recebidoSiq ?? 0), 0),
    [detalheRecebidos],
  );

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
          <h3 className="text-sm font-bold text-slate-700">Recebidos - Detalhe por Veiculo</h3>
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{detalheRecebidos.length}</span> linha{detalheRecebidos.length !== 1 ? 's' : ''}
            {' · '}
            Recebido {fmtBRL(totalRecebidos)}
          </div>
        </div>

        {detalheRecebidos.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            Nenhuma linha com Mês Recebimento compatível com o filtro selecionado.
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="overflow-x-auto border-b border-slate-200">
              <table className="w-full min-w-[900px] text-xs">
                <thead className="bg-blue-50 text-blue-800 uppercase tracking-wide text-[10px]">
                  <tr>
                    <th className="text-left px-3 py-2">Data (Mês/Ano)</th>
                    <th className="text-right px-3 py-2">PIV</th>
                    <th className="text-right px-3 py-2">SIQ</th>
                    <th className="text-right px-3 py-2">Valor Recebido PIV</th>
                    <th className="text-right px-3 py-2">Valor Recebido SIQ</th>
                    <th className="text-right px-3 py-2">Diferença</th>
                    <th className="text-right px-3 py-2">Linhas</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoPorCompetenciaData.map(item => (
                    <tr key={item.competencia} className="border-t border-blue-100 bg-blue-50/40">
                      <td className="px-3 py-2 font-semibold text-slate-700">{item.competencia}</td>
                      <td className="px-3 py-2 text-right font-semibold text-indigo-600">{fmtBRL(item.piv)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-violet-600">{fmtBRL(item.siq)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-600">{fmtBRL(item.recebidoPiv)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-teal-600">{fmtBRL(item.recebidoSiq)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-amber-600">{fmtBRL(item.diferenca)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{item.linhas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px]">
                  <tr>
                    <th className="text-left px-3 py-2">Modelo</th>
                    <th className="text-left px-3 py-2">Chassi</th>
                    <th className="text-left px-3 py-2">Data</th>
                    <th className="text-right px-3 py-2">PIV</th>
                    <th className="text-right px-3 py-2">SIQ</th>
                    <th className="text-right px-3 py-2">Total</th>
                    <th className="text-right px-3 py-2">Valor Recebido PIV</th>
                    <th className="text-right px-3 py-2">Valor Recebido SIQ</th>
                    <th className="text-right px-3 py-2">Diferenca</th>
                    <th className="text-left px-3 py-2">Mes Recebimento</th>
                  </tr>
                </thead>
                <tbody>
                  {detalheRecebidos.map(row => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-3 py-2 font-medium text-slate-700">{row.modelo}</td>
                      <td className="px-3 py-2 text-slate-500">{row.chassi}</td>
                      <td className="px-3 py-2 text-slate-500">{row.data}</td>
                      <td className="px-3 py-2 text-right font-semibold text-indigo-600">{fmtBRL(row.piv)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-violet-600">{fmtBRL(row.siq)}</td>
                      <td className="px-3 py-2 text-right font-bold text-slate-700">{fmtBRL(row.total)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                        {row.recebidoPiv !== null ? fmtBRL(row.recebidoPiv) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-teal-600">
                        {row.recebidoSiq !== null ? fmtBRL(row.recebidoSiq) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-amber-600">{fmtBRL(row.diferenca)}</td>
                      <td className="px-3 py-2 text-slate-500">{row.mesRecebimento || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
