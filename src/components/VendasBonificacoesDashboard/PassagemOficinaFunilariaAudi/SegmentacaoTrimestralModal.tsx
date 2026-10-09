import { Fragment, useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  getPassagensPeriodo,
  analisarPorSegmento,
  SEGMENTO_SEM_SEGMENTO,
  SEGMENTO_SEM_SEGMENTO_LABEL,
  type Segmento,
  type RegraDepartamento,
  type RegraAnoChassi,
  type SegmentoAnalise,
} from './passagemStorage';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type MetricKey = 'passagens' | 'totalOs' | 'totalPecas' | 'totalServicos';

const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'passagens', label: 'Passagens' },
  { key: 'totalOs', label: 'Total OS' },
  { key: 'totalPecas', label: 'Total Peças' },
  { key: 'totalServicos', label: 'Total Serviços' },
];

const fmtCurrency = (n: number): string =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtInt = (n: number): string => n.toLocaleString('pt-BR');

export function SegmentacaoTrimestralModal({
  open,
  onClose,
  year,
  periodo,
  vendedor,
  grupos,
  segmentos,
  regrasAnoChassi,
}: {
  open: boolean;
  onClose: () => void;
  year: number;
  periodo: number | 'ano';
  vendedor: string;
  grupos: RegraDepartamento[];
  segmentos: Segmento[];
  regrasAnoChassi: RegraAnoChassi[];
}) {
  const [metric, setMetric] = useState<MetricKey>('passagens');
  const [loading, setLoading] = useState(false);
  const [monthData, setMonthData] = useState<Record<number, SegmentoAnalise[]>>({});

  // Trimestres exibidos: até o trimestre do mês selecionado. "Ano todo" → 4 trimestres.
  const numTrimestres = periodo === 'ano' ? 4 : Math.ceil((periodo as number) / 3);
  const lastMonth = numTrimestres * 3;

  const monthsToShow = useMemo(
    () => Array.from({ length: lastMonth }, (_, i) => i + 1),
    [lastMonth],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    Promise.all(monthsToShow.map(m => getPassagensPeriodo(year, m)))
      .then(perMonth => {
        if (cancelled) return;
        const data: Record<number, SegmentoAnalise[]> = {};
        monthsToShow.forEach((m, idx) => {
          const rowsM = vendedor === 'todos'
            ? perMonth[idx]
            : perMonth[idx].filter(r => r.nomeVendedor?.trim() === vendedor);
          data[m] = analisarPorSegmento(rowsM, grupos, segmentos, regrasAnoChassi);
        });
        setMonthData(data);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, year, vendedor, grupos, segmentos, regrasAnoChassi, monthsToShow]);

  // Linhas de segmento (ordem do cadastro + "Sem segmento")
  const segRows = useMemo(
    () => [
      ...segmentos.map(s => ({ id: s.id, nome: s.nome })),
      { id: SEGMENTO_SEM_SEGMENTO, nome: SEGMENTO_SEM_SEGMENTO_LABEL },
    ],
    [segmentos],
  );

  const valorCelula = (mes: number, segId: string): number => {
    const row = monthData[mes]?.find(s => s.id === segId);
    return row ? row[metric] : 0;
  };

  const totalMesTodos = (mes: number): number =>
    segRows.reduce((acc, seg) => acc + valorCelula(mes, seg.id), 0);

  const mesesDoTrimestre = (t: number): number[] => [t * 3 - 2, t * 3 - 1, t * 3];

  const isMoeda = metric !== 'passagens';
  const fmt = (n: number): string => {
    if (n === 0) return '—';
    return isMoeda ? fmtCurrency(n) : fmtInt(n);
  };

  const trimestres = Array.from({ length: numTrimestres }, (_, i) => i + 1);

  function handlePrint() {
    const metricLabel = METRICS.find(m => m.key === metric)?.label ?? '';
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const thBase = 'border:1px solid #cbd5e1;padding:5px 7px;font-size:10px;';
    const tdBase = 'border:1px solid #e2e8f0;padding:4px 7px;font-size:10px;';

    const groupTh = trimestres
      .map(t => `<th colspan="4" style="${thBase}text-align:center;background:#f1f5f9;font-weight:700;">${t}º Trimestre</th>`)
      .join('');
    const monthTh = trimestres
      .map(t => mesesDoTrimestre(t)
        .map(mes => `<th style="${thBase}text-align:right;background:#f8fafc;">${MONTHS[mes - 1]}</th>`)
        .join('') + `<th style="${thBase}text-align:right;background:#e2e8f0;font-weight:700;">Total</th>`)
      .join('');

    const bodyRows = segRows.map(seg => {
      const cells = trimestres.map(t => {
        const meses = mesesDoTrimestre(t);
        const trimTotal = meses.reduce((acc, mes) => acc + valorCelula(mes, seg.id), 0);
        return meses
          .map(mes => `<td style="${tdBase}text-align:right;">${fmt(valorCelula(mes, seg.id))}</td>`)
          .join('') + `<td style="${tdBase}text-align:right;background:#f8fafc;font-weight:600;">${fmt(trimTotal)}</td>`;
      }).join('');
      const anoTotal = monthsToShow.reduce((acc, mes) => acc + valorCelula(mes, seg.id), 0);
      return `<tr><td style="${tdBase}font-weight:600;">${esc(seg.nome)}</td>${cells}<td style="${tdBase}text-align:right;font-weight:700;background:#eff6ff;">${fmt(anoTotal)}</td></tr>`;
    }).join('');

    const totalCells = trimestres.map(t => {
      const meses = mesesDoTrimestre(t);
      const trimTotal = meses.reduce((acc, mes) => acc + totalMesTodos(mes), 0);
      return meses
        .map(mes => `<td style="${tdBase}text-align:right;">${fmt(totalMesTodos(mes))}</td>`)
        .join('') + `<td style="${tdBase}text-align:right;font-weight:700;">${fmt(trimTotal)}</td>`;
    }).join('');
    const totalAno = monthsToShow.reduce((acc, mes) => acc + totalMesTodos(mes), 0);
    const totalRow = `<tr style="background:#1e293b;color:#fff;font-weight:700;">
      <td style="${tdBase}border-color:#334155;">Total</td>${totalCells}
      <td style="${tdBase}border-color:#334155;text-align:right;">${fmt(totalAno)}</td></tr>`;

    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Visão trimestral ${year} — ${esc(metricLabel)}</title>
<style>
  @page { size: A4 landscape; margin: 1cm; }
  body { font-family: Arial, sans-serif; color: #1e293b; margin: 18px; }
  h1 { font-size: 15px; margin: 0 0 2px; }
  .sub { font-size: 11px; color: #64748b; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  @media print { body { margin: 0; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
</style></head><body>
<h1>Visão trimestral — ${year}</h1>
<p class="sub">Indicador: <strong>${esc(metricLabel)}</strong>${periodo !== 'ano' && numTrimestres < 4 ? ` &nbsp;|&nbsp; até o ${numTrimestres}º trimestre` : ''} &nbsp;|&nbsp; Impresso em: ${new Date().toLocaleString('pt-BR')}</p>
<table>
  <thead>
    <tr><th rowspan="2" style="${thBase}text-align:left;background:#f1f5f9;font-weight:700;">Segmento</th>${groupTh}<th rowspan="2" style="${thBase}text-align:right;background:#dbeafe;font-weight:700;">Total Ano</th></tr>
    <tr>${monthTh}</tr>
  </thead>
  <tbody>${bodyRows}</tbody>
  <tfoot>${totalRow}</tfoot>
</table>
<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
</body></html>`);
    win.document.close();
  }

  const thMes = 'px-2 py-1.5 text-right text-[11px] font-semibold text-slate-500 whitespace-nowrap';
  const tdNum = 'px-2 py-1.5 text-right tabular-nums whitespace-nowrap';

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[96vw] w-[96vw] sm:max-w-[96vw] max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Visão trimestral — {year}</DialogTitle>
          <DialogDescription>
            Detalhe por segmento, mês a mês, agrupado por trimestre
            {periodo !== 'ano' && numTrimestres < 4 ? ` (até o ${numTrimestres}º trimestre)` : ''}.
          </DialogDescription>
        </DialogHeader>

        {/* Seletor de métrica + imprimir */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 mr-1">Indicador:</span>
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                metric === m.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
          <button
            onClick={handlePrint}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir PDF
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Carregando dados dos meses…</div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th rowSpan={2} className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 border-r border-slate-200 sticky left-0 bg-slate-50 z-10">
                    Segmento
                  </th>
                  {trimestres.map(t => (
                    <th
                      key={t}
                      colSpan={4}
                      className="px-2 py-1.5 text-center text-[11px] font-bold text-slate-600 border-l border-slate-200"
                    >
                      {t}º Trimestre
                    </th>
                  ))}
                  <th rowSpan={2} className="px-2 py-1.5 text-right text-[11px] font-bold text-blue-700 border-l-2 border-slate-300 whitespace-nowrap">
                    Total Ano
                  </th>
                </tr>
                <tr className="bg-slate-50">
                  {trimestres.map(t => (
                    <Fragment key={t}>
                      {mesesDoTrimestre(t).map((mes, idx) => (
                        <th key={mes} className={`${thMes} ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                          {MONTHS[mes - 1]}
                        </th>
                      ))}
                      <th className={`${thMes} font-bold text-slate-600 bg-slate-100`}>Total</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {segRows.map(seg => {
                  const isSem = seg.id === SEGMENTO_SEM_SEGMENTO;
                  const anoTotal = monthsToShow.reduce((acc, mes) => acc + valorCelula(mes, seg.id), 0);
                  return (
                    <tr key={seg.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className={`px-3 py-1.5 font-medium border-r border-slate-200 sticky left-0 bg-white z-10 ${isSem ? 'text-slate-400' : 'text-slate-700'}`}>
                        {seg.nome}
                      </td>
                      {trimestres.map(t => {
                        const meses = mesesDoTrimestre(t);
                        const trimTotal = meses.reduce((acc, mes) => acc + valorCelula(mes, seg.id), 0);
                        return (
                          <Fragment key={t}>
                            {meses.map((mes, idx) => (
                              <td key={mes} className={`${tdNum} text-slate-600 ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                                {fmt(valorCelula(mes, seg.id))}
                              </td>
                            ))}
                            <td className={`${tdNum} font-semibold text-slate-700 bg-slate-50`}>{fmt(trimTotal)}</td>
                          </Fragment>
                        );
                      })}
                      <td className={`${tdNum} font-bold text-slate-800 border-l-2 border-slate-300`}>{fmt(anoTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                  <td className="px-3 py-2 text-slate-800 border-r border-slate-200 sticky left-0 bg-slate-50 z-10">Total</td>
                  {trimestres.map(t => {
                    const meses = mesesDoTrimestre(t);
                    const trimTotal = meses.reduce((acc, mes) => acc + totalMesTodos(mes), 0);
                    return (
                      <Fragment key={t}>
                        {meses.map((mes, idx) => (
                          <td key={mes} className={`${tdNum} text-slate-800 ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                            {fmt(totalMesTodos(mes))}
                          </td>
                        ))}
                        <td className={`${tdNum} text-slate-800 bg-slate-100`}>{fmt(trimTotal)}</td>
                      </Fragment>
                    );
                  })}
                  <td className={`${tdNum} text-blue-700 border-l-2 border-slate-300`}>
                    {fmt(monthsToShow.reduce((acc, mes) => acc + totalMesTodos(mes), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
