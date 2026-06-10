import React, { useEffect, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Download } from 'lucide-react';
import { kvGet } from '@/lib/kvClient';
import { Button } from '@/components/ui/button';
import { loadVendasResultadoRows, type VendasResultadoRow } from './vendasResultadoStorage';
import { loadArquivoPivData } from './arquivoPivStorage';
import { periodoKey } from './provisaoPivStorage';

type RecebidoChassiData = { piv: number; siq: number; mesRecebimento: string | null };
type RecebidoOverridesStore = Record<string, Record<string, RecebidoChassiData>>;

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

interface Props {
  filterYear: number;
  filterMonth: number | null;
}

export function ConcilicacaoPIVAReceberView({ filterYear, filterMonth }: Props) {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [rows, setRows] = useState<VendasResultadoRow[]>([]);
  const [importadosByChassi, setImportadosByChassi] = useState<Record<string, RecebidoChassiData>>({});
  const [overridesByChassi, setOverridesByChassi] = useState<Record<string, RecebidoChassiData>>({});

  const recebidosByChassi = useMemo(
    () => ({ ...importadosByChassi, ...overridesByChassi }),
    [importadosByChassi, overridesByChassi],
  );

  useEffect(() => {
    setLoading(true);
    const key = periodoKey(filterYear, filterMonth);

    Promise.all([
      loadVendasResultadoRows('novos'),
      loadArquivoPivData(key),
      kvGet(RECEBIDOS_OVERRIDE_KEY),
    ]).then(([vendasRows, arquivoPivData, overridesRaw]) => {
      setRows(vendasRows);

      const nextRecebidosByChassi: Record<string, RecebidoChassiData> = {};
      const mesRecebimentoDefault =
        (arquivoPivData?.header?.mesApurado ?? '').trim() ||
        formatPeriodoKeyToMesAno(arquivoPivData?.periodoKey);

      for (const row of arquivoPivData?.rows ?? []) {
        const chassi = normalizeChassi(row.chassi);
        if (!chassi) continue;
        const piv = n(row.valorBonusAtacado);
        const siq = n(row.valorBonusSatisfacao);
        const current = nextRecebidosByChassi[chassi];

        if (current) {
          current.piv += piv;
          current.siq += siq;
        } else {
          nextRecebidosByChassi[chassi] = {
            piv,
            siq,
            mesRecebimento: mesRecebimentoDefault || null,
          };
        }
      }
      setImportadosByChassi(nextRecebidosByChassi);

      const overridesStore = (overridesRaw as RecebidoOverridesStore | null) ?? {};
      setOverridesByChassi(overridesStore[key] ?? {});
      setLoading(false);
    });
  }, [filterYear, filterMonth]);

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

  const rowsWithBonus = useMemo(
    () => filtered.filter(r => n(r.bonusPIV) !== 0 || n(r.bonusSIQ) !== 0),
    [filtered],
  );

  const detalheAReceber = useMemo(() => {
    return rowsWithBonus
      .map(r => {
        const piv = n(r.bonusPIV);
        const siq = n(r.bonusSIQ);
        const chassi = normalizeChassi(r.chassi);
        const recebido = chassi ? recebidosByChassi[chassi] : null;
        const recebidoPiv = recebido?.piv ?? null;
        const recebidoSiq = recebido?.siq ?? null;
        const mesRecebimento = recebido?.mesRecebimento ?? null;
        const diferenca = (piv + siq) - ((recebidoPiv ?? 0) + (recebidoSiq ?? 0));

        return {
          id: r.id,
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
        };
      })
      .filter(item => !String(item.mesRecebimento ?? '').trim());
  }, [rowsWithBonus, recebidosByChassi]);

  const totalAReceber = useMemo(
    () => detalheAReceber.reduce((acc, row) => acc + row.total, 0),
    [detalheAReceber],
  );

  const handleExportExcel = async () => {
    if (detalheAReceber.length === 0 || exporting) return;

    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Sorana Executive Dashboard';
      workbook.created = new Date();

      const ws = workbook.addWorksheet('A Receber');
      ws.columns = [
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

      const headerRow = ws.getRow(1);
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      });

      detalheAReceber.forEach(row => {
        ws.addRow({
          modelo: row.modelo,
          chassi: row.chassi,
          data: row.data,
          piv: row.piv,
          siq: row.siq,
          total: row.total,
          recebidoPiv: row.recebidoPiv,
          recebidoSiq: row.recebidoSiq,
          diferenca: row.diferenca,
          mesRecebimento: row.mesRecebimento || '-',
        });
      });

      const totalRow = ws.addRow({
        modelo: 'TOTAL',
        chassi: '',
        data: '',
        piv: detalheAReceber.reduce((acc, row) => acc + row.piv, 0),
        siq: detalheAReceber.reduce((acc, row) => acc + row.siq, 0),
        total: detalheAReceber.reduce((acc, row) => acc + row.total, 0),
        recebidoPiv: detalheAReceber.reduce((acc, row) => acc + (row.recebidoPiv ?? 0), 0),
        recebidoSiq: detalheAReceber.reduce((acc, row) => acc + (row.recebidoSiq ?? 0), 0),
        diferenca: detalheAReceber.reduce((acc, row) => acc + row.diferenca, 0),
        mesRecebimento: '',
      });
      totalRow.font = { bold: true };

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
        `Conciliacao_PIV_A_Receber_${periodoFile}.xlsx`,
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
          <h3 className="text-sm font-bold text-slate-700">A Receber - Detalhe por Veiculo</h3>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{detalheAReceber.length}</span> linha{detalheAReceber.length !== 1 ? 's' : ''}
              {' · '}
              Total {fmtBRL(totalAReceber)}
            </div>
            <Button
              onClick={handleExportExcel}
              size="sm"
              variant="outline"
              disabled={detalheAReceber.length === 0 || exporting}
              className="flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Gerando...' : 'Exportar Excel'}
            </Button>
          </div>
        </div>

        {detalheAReceber.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            Nenhuma linha com Mês Recebimento vazio para o filtro selecionado.
          </div>
        ) : (
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
                {detalheAReceber.map(row => (
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
        )}
      </div>
    </div>
  );
}
