import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Printer, Loader2 } from 'lucide-react';
import {
  loadColaboradores,
  loadLancamento,
  buildLancamentoPreview,
  totalLancamento,
  type Colaborador,
  type LancamentoRV,
} from './remVariaveisStorage';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 3 + i);

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface LinhaResumo {
  colaborador: Colaborador;
  total: number;
  pago: boolean;
  temLancamento: boolean;
}

export function ResumoRemuneracoesVariaveisPage() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filterBrand, setFilterBrand] = useState<'todos' | 'vw' | 'audi'>('todos');

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [linhas, setLinhas] = useState<LinhaResumo[]>([]);
  const [loadingColab, setLoadingColab] = useState(true);
  const [loadingLanc, setLoadingLanc] = useState(false);

  useEffect(() => {
    loadColaboradores().then(list => {
      setColaboradores(list.filter(c => c.ativo));
      setLoadingColab(false);
    });
  }, []);

  const carregar = useCallback(async (cList: Colaborador[], y: number, m: number) => {
    setLoadingLanc(true);
    const results = await Promise.all(
      cList.map(async c => {
        const lanc = await loadLancamento(c.id, y, m);
        const preview = lanc ? buildLancamentoPreview(c, lanc) : null;
        const linha: LinhaResumo = {
          colaborador: c,
          total: preview ? totalLancamento(preview) : 0,
          pago: lanc?.status === 'pago',
          temLancamento: !!lanc,
        };
        return linha;
      })
    );
    setLinhas(results);
    setLoadingLanc(false);
  }, []);

  useEffect(() => {
    if (colaboradores.length > 0) carregar(colaboradores, year, month);
    else setLinhas([]);
  }, [colaboradores, year, month, carregar]);

  function handlePrev() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function handleNext() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const filtered = linhas.filter(l => filterBrand === 'todos' || l.colaborador.brand === filterBrand);
  const totalGeral = filtered.reduce((s, l) => s + l.total, 0);
  const totalVW = linhas.filter(l => l.colaborador.brand === 'vw').reduce((s, l) => s + l.total, 0);
  const totalAudi = linhas.filter(l => l.colaborador.brand === 'audi').reduce((s, l) => s + l.total, 0);

  function handleImprimir() {
    const periodLabel = `${MONTHS[month - 1]} de ${year}`;
    const rows = filtered.map(l => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:8px 12px;font-size:12px;color:#1e293b;">
          <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;margin-right:6px;${
            l.colaborador.brand === 'vw' ? 'background:#eff6ff;color:#1d4ed8;' : 'background:#fef2f2;color:#b91c1c;'
          }">${l.colaborador.brand.toUpperCase()}</span>
          ${l.colaborador.nome}
        </td>
        <td style="padding:8px 12px;font-size:11px;color:#64748b;">${l.colaborador.departamento ?? '—'}</td>
        <td style="padding:8px 12px;text-align:center;font-size:11px;">
          <span style="padding:2px 8px;border-radius:999px;${
            l.pago ? 'background:#f0fdf4;color:#166534;' : 'background:#fffbeb;color:#92400e;'
          }">${l.pago ? 'Pago' : 'Pendente'}</span>
        </td>
        <td style="padding:8px 12px;text-align:right;font-size:12px;font-weight:600;color:#0f172a;">${fmtBRL(l.total)}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family:Inter,sans-serif;max-width:760px;margin:0 auto;">
        <div style="background:#0f766e;padding:16px 24px;border-radius:8px 8px 0 0;color:white;">
          <div style="font-size:10px;font-weight:700;opacity:.7;text-transform:uppercase;letter-spacing:.05em;">Remunerações Variáveis · Resumo</div>
          <div style="font-size:18px;font-weight:700;">${periodLabel}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
              <th style="padding:10px 12px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase;">Colaborador</th>
              <th style="padding:10px 12px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase;">Departamento</th>
              <th style="padding:10px 12px;text-align:center;font-size:10px;color:#64748b;text-transform:uppercase;">Status</th>
              <th style="padding:10px 12px;text-align:right;font-size:10px;color:#64748b;text-transform:uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:#0f172a;">
              <td colspan="3" style="padding:12px 16px;font-size:13px;font-weight:700;color:white;">Total Geral</td>
              <td style="padding:12px 16px;text-align:right;font-size:16px;font-weight:700;color:white;">${fmtBRL(totalGeral)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    const root = document.getElementById('print-root');
    if (root) {
      root.innerHTML = html;
      const style = document.createElement('style');
      style.textContent = `
        @page { size: A4 portrait; margin: 1cm; }
        @media print { body > *:not(#print-root) { display: none !important; } }
        #print-root { font-family: Inter, sans-serif; }
        #print-root, #print-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      `;
      document.head.appendChild(style);
      window.onafterprint = () => {
        document.head.removeChild(style);
        root.innerHTML = '';
        window.onafterprint = null;
      };
      window.print();
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto p-6 flex flex-col gap-5">

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <button onClick={handlePrev} className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="text-sm font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
            >
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="text-sm font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={handleNext} className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center bg-white rounded-lg border border-slate-200 overflow-hidden">
            {(['todos', 'vw', 'audi'] as const).map(b => (
              <button
                key={b}
                onClick={() => setFilterBrand(b)}
                className={`px-4 py-2 text-xs font-semibold transition-colors ${
                  filterBrand === b ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {b === 'todos' ? 'Todos' : b === 'vw' ? 'VW' : 'Audi'}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <button
            onClick={handleImprimir}
            disabled={filtered.length === 0 || loadingLanc}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir Resumo
          </button>
        </div>

        {/* Cards de total por marca */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Geral', value: totalGeral, bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
            { label: 'VW',          value: totalVW,    bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
            { label: 'Audi',        value: totalAudi,  bg: 'bg-red-50',  text: 'text-red-700',  border: 'border-red-200'  },
          ].map(k => (
            <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-4 flex flex-col gap-1`}>
              <span className={`text-xs font-semibold uppercase tracking-wider ${k.text}`}>{k.label}</span>
              <span className={`text-xl font-bold ${k.text} tabular-nums`}>{fmtBRL(k.value)}</span>
            </div>
          ))}
        </div>

        {/* Tabela */}
        {loadingColab ? (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <p className="text-sm">Nenhum colaborador ativo encontrado.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm relative">
            {loadingLanc && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
                <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
              </div>
            )}
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Colaborador</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Departamento</th>
                  <th className="text-center px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider w-32">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider w-40">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.colaborador.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          l.colaborador.brand === 'vw' ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-red-700 bg-red-50 border-red-200'
                        }`}>
                          {l.colaborador.brand.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-slate-800">{l.colaborador.nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{l.colaborador.departamento ?? '—'}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        l.pago ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {l.pago ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-slate-800 tabular-nums">{fmtBRL(l.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900">
                  <td colSpan={3} className="px-5 py-3 text-sm font-bold text-white">Total Geral</td>
                  <td className="px-5 py-3 text-right text-base font-bold text-white tabular-nums">{fmtBRL(totalGeral)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
