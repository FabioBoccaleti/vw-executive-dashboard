import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Printer, CheckCircle, Clock, ShieldCheck, Loader2 } from 'lucide-react';
import {
  loadColaboradores,
  loadLancamento,
  buildLancamentoVazio,
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

// ─── Linha de resumo de um colaborador ───────────────────────────────────────

function ColaboradorRow({
  colaborador,
  lanc,
  onClick,
}: {
  colaborador: Colaborador;
  lanc: LancamentoRV | null;
  onClick: () => void;
}) {
  const lancPreview = lanc ? buildLancamentoPreview(colaborador, lanc) : null;
  const total = lancPreview ? totalLancamento(lancPreview) : null;
  const pago = lanc?.status === 'pago';
  const finAssinou = !!lanc?.assinaturas?.financeiro;
  const rhAssinou  = !!lanc?.assinaturas?.rh;
  const brandColor = colaborador.brand === 'vw' ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-red-700 bg-red-50 border-red-200';

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-5 py-4 hover:shadow-md hover:border-teal-300 transition-all group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${brandColor}`}>
            {colaborador.brand.toUpperCase()}
          </span>
          <span className="text-sm font-semibold text-slate-800 truncate">{colaborador.nome}</span>
          {colaborador.departamento && (
            <span className="text-xs text-slate-400 truncate hidden sm:block">· {colaborador.departamento}</span>
          )}
          {colaborador.cargo && (
            <span className="text-xs text-slate-500 truncate">{colaborador.cargo}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <AssinaturaIcon label="Fin" assinado={finAssinou} />
        <AssinaturaIcon label="RH"  assinado={rhAssinou} />
      </div>

      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
        pago ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`}>
        {pago ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
        {pago ? 'Pago' : 'Pendente'}
      </div>

      <div className="text-right flex-shrink-0 w-32">
        {total != null ? (
          <span className="text-sm font-bold text-slate-800 tabular-nums">{fmtBRL(total)}</span>
        ) : (
          <span className="text-xs text-slate-400">Sem lançamento</span>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500 flex-shrink-0 transition-colors" />
    </button>
  );
}

function AssinaturaIcon({ label, assinado }: { label: string; assinado: boolean }) {
  return (
    <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
      assinado
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-slate-50 text-slate-400 border-slate-200'
    }`}>
      {assinado && <ShieldCheck className="w-3 h-3" />}
      {label}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

interface DemonstrativosVariaveisListPageProps {
  onOpenColaborador: (colaborador: Colaborador, year: number, month: number) => void;
}

export function DemonstrativosVariaveisListPage({ onOpenColaborador }: DemonstrativosVariaveisListPageProps) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [lancamentos, setLancamentos] = useState<Record<string, LancamentoRV | null>>({});
  const [loadingColab, setLoadingColab] = useState(true);
  const [loadingLanc,  setLoadingLanc]  = useState(false);
  const [printing, setPrinting] = useState(false);
  const [filterBrand, setFilterBrand] = useState<'todos' | 'vw' | 'audi'>('todos');

  useEffect(() => {
    loadColaboradores().then(list => {
      setColaboradores(list.filter(c => c.ativo));
      setLoadingColab(false);
    });
  }, []);

  const carregarLancamentos = useCallback(async (cList: Colaborador[], y: number, m: number) => {
    setLoadingLanc(true);
    const entries = await Promise.all(
      cList.map(async c => {
        const lanc = await loadLancamento(c.id, y, m);
        return [c.id, lanc] as [string, LancamentoRV | null];
      })
    );
    setLancamentos(Object.fromEntries(entries));
    setLoadingLanc(false);
  }, []);

  useEffect(() => {
    if (colaboradores.length > 0) {
      carregarLancamentos(colaboradores, year, month);
    }
  }, [colaboradores, year, month, carregarLancamentos]);

  function handlePrev() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function handleNext() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const filtered = colaboradores.filter(c => filterBrand === 'todos' || c.brand === filterBrand);

  const totalGeral = filtered.reduce((sum, c) => {
    const l = lancamentos[c.id];
    return sum + (l ? totalLancamento(buildLancamentoPreview(c, l)) : 0);
  }, 0);

  async function handleImprimirTodos() {
    if (filtered.length === 0) return;
    setPrinting(true);

    const lancMap: Record<string, LancamentoRV> = {};
    filtered.forEach(c => {
      const l = lancamentos[c.id] ?? buildLancamentoVazio(c, year, month);
      lancMap[c.id] = buildLancamentoPreview(c, l);
    });

    const brandColor = (brand: string) => brand === 'vw' ? '#001e50' : '#bb0a30';
    const brandDark  = (brand: string) => brand === 'vw' ? '#001238' : '#9a0827';
    const periodLabel = `${MONTHS[month - 1]} de ${year}`;

    const htmlPages = filtered.map(c => {
      const l = lancMap[c.id];
      const total = totalLancamento(l);
      const rows = l.itens.map(item => `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:8px 12px;font-size:12px;color:#1e293b;">${item.descricao}</td>
          <td style="padding:8px 12px;text-align:center;font-size:11px;">
            <span style="padding:2px 8px;border-radius:999px;border:1px solid;${
              item.tipo === 'fixa' ? 'background:#f0fdf4;color:#166534;border-color:#bbf7d0;'
              : 'background:#fffbeb;color:#92400e;border-color:#fde68a;'
            }">${item.tipo === 'fixa' ? 'Fixo' : 'Variável'}</span>
            ${item.tipo === 'variavel' && item.percentualUsado != null ? `<br/><span style="font-size:10px;color:#b45309;">${item.percentualUsado}% s/ base</span>` : ''}
          </td>
          <td style="padding:8px 12px;text-align:right;font-size:12px;color:#475569;">
            ${item.valorBaseCalculo ? fmtBRL(item.valorBaseCalculo) : '—'}
          </td>
          <td style="padding:8px 12px;text-align:right;font-size:12px;font-weight:600;color:#0f172a;">
            ${item.valor ? fmtBRL(item.valor) : '—'}
          </td>
        </tr>
      `).join('');

      const assinaturas = (['financeiro', 'rh'] as const).map(campo => {
        const ass = l.assinaturas?.[campo];
        const label = campo === 'financeiro' ? 'Financeiro' : 'Recursos Humanos';
        return ass ? `
          <div style="border:1px solid #bbf7d0;border-radius:8px;padding:10px 12px;background:#f0fdf4;">
            <div style="font-size:11px;color:#15803d;font-weight:700;margin-bottom:2px;">${label}</div>
            ${ass.name && ass.name !== ass.username ? `<div style="font-size:12px;font-weight:700;color:#166534;">${ass.name}</div>` : ''}
            <div style="font-size:11px;color:#16a34a;">${ass.username}</div>
            <div style="font-size:10px;color:#15803d;">${new Date(ass.dataHora).toLocaleString('pt-BR')}</div>
            <div style="font-size:10px;font-weight:700;color:#15803d;margin-top:4px;">✓ ASSINATURA ELETRÔNICA</div>
          </div>` : `
          <div style="border:1px dashed #cbd5e1;border-radius:8px;padding:10px 12px;background:#f8fafc;">
            <div style="font-size:11px;color:#94a3b8;font-weight:700;">${label}</div>
            <div style="font-size:10px;color:#cbd5e1;margin-top:16px;border-top:1px solid #e2e8f0;padding-top:4px;">Aguardando assinatura</div>
          </div>`;
      }).join('');

      return `
        <div style="page-break-after:always;font-family:Inter,sans-serif;max-width:700px;margin:0 auto;">
          <div style="background:${brandColor(c.brand)};padding:16px 24px;border-radius:8px 8px 0 0;color:white;display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-size:10px;font-weight:700;opacity:.7;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Demonstrativo de Remuneração Variável</div>
              <div style="font-size:18px;font-weight:700;">${c.nome}</div>
              ${c.departamento ? `<div style="font-size:12px;opacity:.8;">${c.departamento}</div>` : ''}
              ${c.cargo ? `<div style="font-size:11px;opacity:.7;">${c.cargo}</div>` : ''}
            </div>
            <div style="text-align:right;">
              <div style="font-size:10px;opacity:.7;text-transform:uppercase;">Competência</div>
              <div style="font-size:16px;font-weight:700;">${periodLabel}</div>
            </div>
          </div>
          <div style="background:${l.status === 'pago' ? '#f0fdf4' : '#fffbeb'};border-left:1px solid ${l.status === 'pago' ? '#bbf7d0' : '#fde68a'};border-right:1px solid ${l.status === 'pago' ? '#bbf7d0' : '#fde68a'};padding:6px 24px;font-size:11px;font-weight:700;color:${l.status === 'pago' ? '#166534' : '#92400e'};">
            ${l.status === 'pago' ? '● Pago' : '● Pendente'}
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;">
            <thead>
              <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                <th style="padding:10px 12px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Descrição</th>
                <th style="padding:10px 12px;text-align:center;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;width:120px;">Tipo / %</th>
                <th style="padding:10px 12px;text-align:right;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;width:150px;">Base de Cálculo</th>
                <th style="padding:10px 12px;text-align:right;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;width:130px;">Valor</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr style="background:${brandDark(c.brand)};">
                <td colspan="3" style="padding:12px 16px;font-size:13px;font-weight:700;color:white;">Total</td>
                <td style="padding:12px 16px;text-align:right;font-size:16px;font-weight:700;color:white;">${fmtBRL(total)}</td>
              </tr>
            </tfoot>
          </table>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:16px 24px;border-radius:0 0 8px 8px;background:white;">
            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">Assinaturas</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${assinaturas}</div>
          </div>
        </div>
      `;
    }).join('');

    const root = document.getElementById('print-root');
    if (root) {
      root.innerHTML = htmlPages;
      const style = document.createElement('style');
      style.textContent = `
        @page { size: A4 portrait; margin: 1cm; }
        @media print { body > *:not(#print-root) { display: none !important; } }
        #print-root { font-family: Inter, sans-serif; }
        #print-root div[style*="page-break-after:always"]:last-child { page-break-after: auto !important; }
      `;
      document.head.appendChild(style);
      window.onafterprint = () => {
        document.head.removeChild(style);
        root.innerHTML = '';
        window.onafterprint = null;
        setPrinting(false);
      };
      window.print();
    }
    setPrinting(false);
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
            onClick={handleImprimirTodos}
            disabled={printing || filtered.length === 0 || loadingLanc}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {printing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
            Imprimir Todos
          </button>
        </div>

        {/* Resumo do mês */}
        {!loadingColab && filtered.length > 0 && (
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-sm">
            <span className="text-xs text-slate-500 font-medium">
              {MONTHS[month - 1]} de {year} · {filtered.length} colaborador{filtered.length !== 1 ? 'es' : ''}
            </span>
            <span className="text-sm font-bold text-slate-800 tabular-nums">
              Total: {fmtBRL(totalGeral)}
            </span>
          </div>
        )}

        {/* Lista */}
        {loadingColab ? (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando colaboradores...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <p className="text-sm">Nenhum colaborador ativo encontrado.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 relative">
            {loadingLanc && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl z-10">
                <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
              </div>
            )}
            {filtered.map(c => (
              <ColaboradorRow
                key={c.id}
                colaborador={c}
                lanc={lancamentos[c.id] ?? null}
                onClick={() => onOpenColaborador(c, year, month)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
