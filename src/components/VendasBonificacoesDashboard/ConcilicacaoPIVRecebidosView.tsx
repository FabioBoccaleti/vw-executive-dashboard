import React, { useEffect, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Download } from 'lucide-react';
import { kvGet } from '@/lib/kvClient';
import { Button } from '@/components/ui/button';
import { loadVendasResultadoRows, type VendasResultadoRow } from './vendasResultadoStorage';
import { loadArquivoPivStore } from './arquivoPivStorage';

type RecebidoChassiData = { piv: number; siq: number; mesRecebimento: string | null };
type RecebidoOverridesStore = Record<string, Record<string, RecebidoChassiData>>;

type RecebidosByPeriodo = Record<string, Record<string, RecebidoChassiData>>;
type RecebidosByChassiGlobal = Record<string, RecebidoChassiData>;

const RECEBIDOS_OVERRIDE_KEY = 'provisao_piv_recebidos_overrides';
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
  dataVersion?: number;
}

export function ConcilicacaoPIVRecebidosView({ filterYear, filterMonth, dataVersion = 0 }: Props) {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [rows, setRows] = useState<VendasResultadoRow[]>([]);
  const [recebidosByChassiGlobal, setRecebidosByChassiGlobal] = useState<RecebidosByChassiGlobal>({});

  const mesSortKey = (v?: string | null): number => {
    const raw = String(v ?? '').trim();
    if (!raw) return -1;
    const mSlash = raw.match(/^(\d{1,2})\/(\d{4})$/);
    if (mSlash) {
      const m = Number(mSlash[1]);
      const y = Number(mSlash[2]);
      if (m >= 1 && m <= 12) return y * 100 + m;
    }
    const mDash = raw.match(/^(\d{4})-(\d{1,2})$/);
    if (mDash) {
      const y = Number(mDash[1]);
      const m = Number(mDash[2]);
      if (m >= 1 && m <= 12) return y * 100 + m;
    }
    return -1;
  };

  useEffect(() => {
    setLoading(true);

    Promise.all([
      loadVendasResultadoRows('novos'),
      loadArquivoPivStore(),
      kvGet(RECEBIDOS_OVERRIDE_KEY),
      kvGet(CHASSI_ALIASES_KEY),
    ]).then(([vendasRows, arquivoStore, overridesRaw, aliasesRaw]) => {
      setRows(vendasRows);

      const aliases = (aliasesRaw as Record<string, string> | null) ?? {};
      const resolveAlias = (rawChassi?: string | null): string => {
        const normalized = normalizeChassi(rawChassi);
        return normalized && aliases[normalized] ? normalizeChassi(aliases[normalized]) : normalized;
      };

      const importadosByPeriodo: RecebidosByPeriodo = {};

      for (const [pk, arquivoPivData] of Object.entries(arquivoStore ?? {})) {
        const periodMap: Record<string, RecebidoChassiData> = {};
        const mesRecebimentoDefault =
          (arquivoPivData?.header?.mesApurado ?? '').trim() ||
          formatPeriodoKeyToMesAno(arquivoPivData?.periodoKey);

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

      const globalByChassi: RecebidosByChassiGlobal = {};
      for (const periodMap of Object.values(mergedByPeriodo)) {
        for (const [chassi, recebido] of Object.entries(periodMap)) {
          const current = globalByChassi[chassi];
          if (current) {
            current.piv += recebido.piv;
            current.siq += recebido.siq;
            if (mesSortKey(recebido.mesRecebimento) > mesSortKey(current.mesRecebimento)) {
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

      setRecebidosByChassiGlobal(globalByChassi);
      setLoading(false);
    });
  }, [dataVersion]);

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

        const chassiNorm = normalizeChassi(r.chassi);
        const recebido = chassiNorm ? recebidosByChassiGlobal[chassiNorm] : null;

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
  }, [rows, recebidosByChassiGlobal, targetMesRecebimento, filterYear]);

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

  const resumoTotais = useMemo(() => {
    return resumoPorCompetenciaData.reduce(
      (acc, item) => {
        acc.piv += item.piv;
        acc.siq += item.siq;
        acc.recebidoPiv += item.recebidoPiv;
        acc.recebidoSiq += item.recebidoSiq;
        acc.diferenca += item.diferenca;
        acc.linhas += item.linhas;
        return acc;
      },
      { piv: 0, siq: 0, recebidoPiv: 0, recebidoSiq: 0, diferenca: 0, linhas: 0 },
    );
  }, [resumoPorCompetenciaData]);

  const totalRecebidos = useMemo(
    () => detalheRecebidos.reduce((acc, row) => acc + (row.recebidoPiv ?? 0) + (row.recebidoSiq ?? 0), 0),
    [detalheRecebidos],
  );

  const handleExportExcel = async () => {
    if (detalheRecebidos.length === 0 || exporting) return;

    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Sorana Executive Dashboard';
      workbook.created = new Date();

      const wsResumo = workbook.addWorksheet('Resumo Data');
      wsResumo.columns = [
        { header: 'Data (Mes/Ano)', key: 'competencia', width: 18 },
        { header: 'PIV', key: 'piv', width: 16 },
        { header: 'SIQ', key: 'siq', width: 16 },
        { header: 'Valor Recebido PIV', key: 'recebidoPiv', width: 20 },
        { header: 'Valor Recebido SIQ', key: 'recebidoSiq', width: 20 },
        { header: 'Diferenca', key: 'diferenca', width: 16 },
        { header: 'Linhas', key: 'linhas', width: 10 },
      ];
      const resumoHeader = wsResumo.getRow(1);
      resumoHeader.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      });
      resumoPorCompetenciaData.forEach(item => {
        wsResumo.addRow(item);
      });
      wsResumo.addRow({
        competencia: 'TOTAL',
        piv: resumoPorCompetenciaData.reduce((acc, item) => acc + item.piv, 0),
        siq: resumoPorCompetenciaData.reduce((acc, item) => acc + item.siq, 0),
        recebidoPiv: resumoPorCompetenciaData.reduce((acc, item) => acc + item.recebidoPiv, 0),
        recebidoSiq: resumoPorCompetenciaData.reduce((acc, item) => acc + item.recebidoSiq, 0),
        diferenca: resumoPorCompetenciaData.reduce((acc, item) => acc + item.diferenca, 0),
        linhas: resumoPorCompetenciaData.reduce((acc, item) => acc + item.linhas, 0),
      }).font = { bold: true };

      const wsDetalhe = workbook.addWorksheet('Recebidos');
      wsDetalhe.columns = [
        { header: 'Modelo', key: 'modelo', width: 34 },
        { header: 'Chassi', key: 'chassi', width: 22 },
        { header: 'Data', key: 'data', width: 14 },
        { header: 'PIV', key: 'piv', width: 15 },
        { header: 'SIQ', key: 'siq', width: 15 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Valor Recebido PIV', key: 'recebidoPiv', width: 18 },
        { header: 'Valor Recebido SIQ', key: 'recebidoSiq', width: 18 },
        { header: 'Diferenca', key: 'diferenca', width: 15 },
        { header: 'Mes Recebimento', key: 'mesRecebimento', width: 16 },
      ];
      const detalheHeader = wsDetalhe.getRow(1);
      detalheHeader.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      });
      detalheRecebidos.forEach(row => {
        wsDetalhe.addRow({
          ...row,
          mesRecebimento: row.mesRecebimento || '-',
        });
      });
      wsDetalhe.addRow({
        modelo: 'TOTAL',
        chassi: '',
        data: '',
        piv: detalheRecebidos.reduce((acc, row) => acc + row.piv, 0),
        siq: detalheRecebidos.reduce((acc, row) => acc + row.siq, 0),
        total: detalheRecebidos.reduce((acc, row) => acc + row.total, 0),
        recebidoPiv: detalheRecebidos.reduce((acc, row) => acc + (row.recebidoPiv ?? 0), 0),
        recebidoSiq: detalheRecebidos.reduce((acc, row) => acc + (row.recebidoSiq ?? 0), 0),
        diferenca: detalheRecebidos.reduce((acc, row) => acc + row.diferenca, 0),
        mesRecebimento: '',
      }).font = { bold: true };

      const moneyFmt = '"R$"\ #,##0.00';
      ['piv', 'siq', 'recebidoPiv', 'recebidoSiq', 'diferenca'].forEach(col => {
        wsResumo.getColumn(col).numFmt = moneyFmt;
        wsDetalhe.getColumn(col).numFmt = moneyFmt;
      });
      wsDetalhe.getColumn('total').numFmt = moneyFmt;

      [wsResumo, wsDetalhe].forEach(ws => {
        ws.eachRow((row, rowNumber) => {
          row.eachCell(cell => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
            if (rowNumber > 1 && cell.col >= 2) {
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }
          });
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
        `Conciliacao_PIV_Recebidos_${periodoFile}.xlsx`,
      );
    } finally {
      setExporting(false);
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
          <h3 className="text-sm font-bold text-slate-700">Recebidos - Detalhe por Veiculo</h3>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{detalheRecebidos.length}</span> linha{detalheRecebidos.length !== 1 ? 's' : ''}
              {' · '}
              Recebido {fmtBRL(totalRecebidos)}
            </div>
            <Button
              onClick={handleExportExcel}
              size="sm"
              variant="outline"
              disabled={detalheRecebidos.length === 0 || exporting}
              className="flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Gerando...' : 'Exportar Excel'}
            </Button>
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
                  <tr className="border-t-2 border-blue-200 bg-blue-100/70">
                    <td className="px-3 py-2 font-black text-slate-800 uppercase">Total</td>
                    <td className="px-3 py-2 text-right font-black text-indigo-700">{fmtBRL(resumoTotais.piv)}</td>
                    <td className="px-3 py-2 text-right font-black text-violet-700">{fmtBRL(resumoTotais.siq)}</td>
                    <td className="px-3 py-2 text-right font-black text-emerald-700">{fmtBRL(resumoTotais.recebidoPiv)}</td>
                    <td className="px-3 py-2 text-right font-black text-teal-700">{fmtBRL(resumoTotais.recebidoSiq)}</td>
                    <td className="px-3 py-2 text-right font-black text-amber-700">{fmtBRL(resumoTotais.diferenca)}</td>
                    <td className="px-3 py-2 text-right font-black text-slate-700">{resumoTotais.linhas}</td>
                  </tr>
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
