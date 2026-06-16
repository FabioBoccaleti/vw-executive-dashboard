import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Printer, Loader2, Calculator, FileText, AlertTriangle } from 'lucide-react';
import { buildLancamentoVazio, loadLancamento, type LancamentoPJ, type PrestadorPJ, type PrestadorSnapshotPJ } from './remPjStorage';
import { buildRateioTitulo, calcularRateioPJ } from './rateioPjUtils';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 3 + i);

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function nextMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function PeriodSelector({
  year,
  month,
  onPrev,
  onNext,
  onYearChange,
  onMonthChange,
}: {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onYearChange: (value: number) => void;
  onMonthChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
      <button onClick={onPrev} className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <select
        value={month}
        onChange={e => onMonthChange(Number(e.target.value))}
        className="text-sm font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
      >
        {MONTHS.map((m, index) => <option key={m} value={index + 1}>{m}</option>)}
      </select>
      <select
        value={year}
        onChange={e => onYearChange(Number(e.target.value))}
        className="text-sm font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
      >
        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <button onClick={onNext} className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

interface PrestadorRateioPageProps {
  prestador: PrestadorPJ;
  onBack: () => void;
  initialYear?: number;
  initialMonth?: number;
  initialLancamento?: LancamentoPJ | null;
  initialPrestador?: PrestadorPJ | PrestadorSnapshotPJ | null;
}

type FonteRateio = 'contexto' | 'salvo' | 'vazio';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function totalLancamentoBruto(lanc: LancamentoPJ | null | undefined): number {
  if (!lanc) return 0;
  return round2((lanc.itens ?? []).reduce((sum, item) => sum + Number(item.valor || 0), 0));
}

function lancamentoSignature(lanc: LancamentoPJ | null | undefined): string {
  if (!lanc) return '';
  return JSON.stringify({
    prestadorId: lanc.prestadorId,
    year: lanc.year,
    month: lanc.month,
    status: lanc.status,
    itensPremioIds: [...(lanc.itensPremioIds ?? [])].sort(),
    itens: (lanc.itens ?? [])
      .map(item => ({
        itemId: item.itemId,
        descricao: item.descricao,
        tipo: item.tipo,
        valor: round2(Number(item.valor || 0)),
        valorBaseCalculo: round2(Number(item.valorBaseCalculo || 0)),
        percentualUsado: round2(Number(item.percentualUsado || 0)),
        rateioBases: item.rateioBases ?? {},
      }))
      .sort((a, b) => `${a.itemId}-${a.tipo}`.localeCompare(`${b.itemId}-${b.tipo}`)),
  });
}

export function PrestadorRateioPage({
  prestador,
  onBack,
  initialYear,
  initialMonth,
  initialLancamento,
  initialPrestador,
}: PrestadorRateioPageProps) {
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth() + 1);
  const [lanc, setLanc] = useState<LancamentoPJ | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [fonteRateio, setFonteRateio] = useState<FonteRateio>('vazio');
  const [conflitoContextoSalvo, setConflitoContextoSalvo] = useState<{ totalContexto: number; totalSalvo: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLanc(null);
    setFonteRateio('vazio');
    setConflitoContextoSalvo(null);
    loadLancamento(prestador.id, year, month).then(result => {
      if (!cancelled) {
        const isInitialMatch =
          initialLancamento &&
          initialLancamento.prestadorId === prestador.id &&
          initialLancamento.year === year &&
          initialLancamento.month === month;

        // Prioriza o contexto vindo do demonstrativo para manter consistência
        // com o que o usuário acabou de visualizar/editar.
        if (isInitialMatch) {
          setLanc(initialLancamento);
          setFonteRateio('contexto');
          if (result && lancamentoSignature(result) !== lancamentoSignature(initialLancamento)) {
            setConflitoContextoSalvo({
              totalContexto: totalLancamentoBruto(initialLancamento),
              totalSalvo: totalLancamentoBruto(result),
            });
          }
        } else if (result) {
          setLanc(result);
          setFonteRateio('salvo');
        } else {
          setLanc(buildLancamentoVazio(prestador, year, month));
          setFonteRateio('vazio');
        }
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [prestador, year, month, initialLancamento]);

  const effectivePrestador = initialPrestador ?? lanc?.snapshotPrestador ?? prestador;
  const rateio = useMemo(() => {
    if (!lanc) return null;
    return calcularRateioPJ(effectivePrestador, lanc);
  }, [effectivePrestador, lanc]);

  const origemDisponivel = !!(
    initialLancamento &&
    initialLancamento.prestadorId === prestador.id &&
    initialLancamento.year === year &&
    initialLancamento.month === month
  );
  const totalOrigem = totalLancamentoBruto(origemDisponivel ? initialLancamento : null);
  const diferencaOrigem = rateio ? round2(rateio.totalDemonstrativo - totalOrigem) : 0;
  const conferenciaInternaOk = rateio ? Math.abs(rateio.diferenca) < 0.01 : false;
  const conferenciaOrigemOk = !origemDisponivel || Math.abs(diferencaOrigem) < 0.01;
  const conferenciaOk = conferenciaInternaOk && conferenciaOrigemOk;

  const title = buildRateioTitulo(effectivePrestador, year, month);

  function handlePrev() {
    const value = prevMonth(year, month);
    setYear(value.year);
    setMonth(value.month);
  }

  function handleNext() {
    const value = nextMonth(year, month);
    setYear(value.year);
    setMonth(value.month);
  }

  function handlePrint() {
    const printSource = document.getElementById('rateio-print-area');
    const root = document.getElementById('print-root');
    if (!printSource || !root) {
      window.print();
      return;
    }

    const clone = printSource.cloneNode(true) as HTMLElement;
    clone.style.display = 'block';
    root.innerHTML = clone.outerHTML;

    const style = document.createElement('style');
    style.id = 'rateio-print-override';
    style.textContent = `
      @page { size: A4 portrait; margin: 0.45cm !important; }
      #print-root {
        zoom: 0.92;
        font-family: Inter, sans-serif;
      }
      #print-root, #print-root * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
        color-scheme: light !important;
      }
      #print-root table {
        width: 100%;
        border-collapse: collapse;
      }
      #print-root th, #print-root td {
        font-size: 9px !important;
        padding: 3px 5px !important;
      }
      #print-root .no-print {
        display: none !important;
      }
      #print-root .rateio-print-columns {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 8px !important;
      }
      #print-root .print-page-break {
        break-before: page;
      }
    `;
    document.head.appendChild(style);

    window.onafterprint = () => {
      document.head.removeChild(style);
      root.innerHTML = '';
      window.onafterprint = null;
    };

    window.print();
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!lanc || !rateio) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-6xl mx-auto p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Rateio do demonstrativo</h2>
              <p className="text-sm text-slate-500">{title}</p>
            </div>
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center text-slate-500">
            Nenhum demonstrativo encontrado para a competência selecionada.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-7xl mx-auto p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3 no-print">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Rateio do demonstrativo</h2>
            <p className="text-sm text-slate-500">{title}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <PeriodSelector
              year={year}
              month={month}
              onPrev={handlePrev}
              onNext={handleNext}
              onYearChange={setYear}
              onMonthChange={setMonth}
            />
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Imprimir PDF
            </button>
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao demonstrativo
            </button>
          </div>
        </div>

        <div id="rateio-print-area" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 text-white" style={{ backgroundColor: effectivePrestador.brand === 'vw' ? '#001e50' : '#bb0a30' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold opacity-75 uppercase tracking-wider mb-0.5">Rateio automático do demonstrativo</p>
                <h3 className="text-lg font-bold no-print">{effectivePrestador.nome}</h3>
                {effectivePrestador.empresa && <p className="text-sm opacity-80">{effectivePrestador.empresa}</p>}
                {effectivePrestador.cargo && <p className="text-xs opacity-70 mt-0.5">{effectivePrestador.cargo}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs opacity-75 uppercase tracking-wider">Competência</p>
                <p className="text-base font-bold mt-0.5">{MONTHS[month - 1]} de {year}</p>
                {effectivePrestador.cnpjCpf && <p className="text-xs opacity-70 mt-1">{effectivePrestador.cnpjCpf}</p>}
              </div>
            </div>
          </div>

          <div className="p-6 flex flex-col gap-4">
            {conflitoContextoSalvo && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Divergência entre demonstrativo atual e lançamento salvo
                </p>
                <p className="text-xs">
                  O rateio está usando a versão atual do demonstrativo desta tela.
                  Total atual: {fmtBRL(conflitoContextoSalvo.totalContexto)} · Total salvo: {fmtBRL(conflitoContextoSalvo.totalSalvo)}.
                </p>
              </div>
            )}

            {fonteRateio === 'salvo' && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
                Rateio exibindo a versão salva do lançamento para esta competência.
              </div>
            )}

            {fonteRateio === 'contexto' && !conflitoContextoSalvo && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                Rateio exibindo a versão atual do demonstrativo aberto nesta tela.
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider">Total demonstrativo</p>
                <p className="text-xl font-extrabold text-slate-800 mt-1">{fmtBRL(rateio.totalDemonstrativo)}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider">Total rateado</p>
                <p className="text-xl font-extrabold text-slate-800 mt-1">{fmtBRL(rateio.totalRateado)}</p>
              </div>
              <div className={`border rounded-xl p-4 ${conferenciaOk ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">Conferência</p>
                <p className={`text-xl font-extrabold mt-1 ${conferenciaOk ? 'text-emerald-700' : 'text-red-700'}`}>
                  {conferenciaOk
                    ? 'OK'
                    : fmtBRL(conferenciaInternaOk ? diferencaOrigem : rateio.diferenca)}
                </p>
                <p className={`text-[0.6rem] mt-0.5 ${conferenciaOk ? 'text-emerald-500' : 'text-red-500'}`}>
                  {conferenciaOk
                    ? 'Soma dos rateios bate com o total'
                    : (conferenciaInternaOk
                      ? 'Diferença entre total exibido no rateio e total da origem do demonstrativo'
                      : 'Diferença apurada entre total e rateio')}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider">Itens sem rateio</p>
                <p className="text-xl font-extrabold text-slate-800 mt-1">{rateio.itensSemRateioTotal}</p>
                <p className="text-[0.6rem] text-slate-400 mt-0.5">Devem ser configurados no cadastro</p>
              </div>
            </div>

            {rateio.itensSemRateio.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <p className="font-semibold mb-1 flex items-center gap-2"><FileText className="w-4 h-4" />Atenção</p>
                <p className="text-xs">Os itens abaixo ainda não possuem rateio configurado no cadastro: {rateio.itensSemRateio.join(', ')}.</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 rateio-print-columns">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Calculator className="w-4 h-4" />Resumo por departamento
                  </p>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">Departamento</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">Base</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">Prêmio</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rateio.departamentos.map(dep => (
                        <tr key={dep.departamento} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-700 font-medium">{dep.departamento}</td>
                          <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{fmtBRL(dep.base)}</td>
                          <td className="px-3 py-2 text-right text-purple-700 tabular-nums">{fmtBRL(dep.premio)}</td>
                          <td className="px-3 py-2 text-right text-slate-800 font-semibold tabular-nums">{fmtBRL(dep.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-slate-50">
                      <tr>
                        <td className="px-3 py-2 text-xs font-bold text-slate-700">TOTAL</td>
                        <td className="px-3 py-2 text-right text-xs font-bold tabular-nums">{fmtBRL(rateio.departamentos.reduce((sum, dep) => sum + dep.base, 0))}</td>
                        <td className="px-3 py-2 text-right text-xs font-bold tabular-nums">{fmtBRL(rateio.departamentos.reduce((sum, dep) => sum + dep.premio, 0))}</td>
                        <td className="px-3 py-2 text-right text-xs font-bold tabular-nums">{fmtBRL(rateio.departamentos.reduce((sum, dep) => sum + dep.total, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4" />Memória de cálculo
                  </p>
                </div>
                <div className="overflow-auto max-h-[780px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">Item</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">Departamento</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">%</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">Valor rateado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rateio.linhas.map((linha, index) => (
                        <tr key={`${linha.itemId}-${linha.departamento}-${index}`} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-700">
                            <div className="font-medium">{linha.itemDescricao}</div>
                            <div className="text-[10px] text-slate-400">{linha.formula}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{linha.departamento}</td>
                          <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{linha.percentual.toFixed(2)}%</td>
                          <td className="px-3 py-2 text-right text-slate-800 font-semibold tabular-nums">{fmtBRL(linha.valorRateado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
