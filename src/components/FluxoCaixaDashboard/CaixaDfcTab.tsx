import { Fragment, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  calcularConta,
  calcularDfcIndireto,
  calcularLinhas,
  chavePeriodo,
  listarContasDfcDaLinha,
  linhaPai,
  type CadastroDemonstracoes,
  type ContasBalancete,
  type DadosDemonstracoes,
  type LinhaDemonstracao,
  type PeriodoDemonstracao,
  type ResultadoDfcIndireto,
} from './DemonstracoesFinanceiras/modelo';
import { criarLinhasDfcIndiretoTabela } from './DemonstracoesFinanceiras/dfcTabela';
import { loadCadastroDemonstracoes, loadDadosDemonstracoes } from './DemonstracoesFinanceiras/storage';
import { CaixaDfcCharts } from './CaixaDfcCharts';

type MetodoDfc = 'direto' | 'indireto';

interface Calculation {
  values: Map<string, number | null>;
  indirect?: ResultadoDfcIndireto;
}

interface TableRow {
  id: string;
  lineId: string;
  label: string;
  type: 'heading' | 'group' | 'line' | 'subtotal' | 'total';
  indent: number;
  hideValue?: boolean;
}

interface Props {
  method: MetodoDfc;
  title: string;
  selectedYear: number;
  selectedMonth: number;
  colAtual: string;
  fmtBRL: (value: number, compact?: boolean) => string;
  SectionTitle: any;
}

function sumValues(values: Map<string, number | null>, ids: string[]): number | null {
  const amounts = ids.map(id => values.get(id) ?? null);
  if (amounts.length === 0 || amounts.some(amount => amount === null)) return null;
  return Math.round(amounts.reduce<number>((total, amount) => total + Math.round((amount ?? 0) * 100), 0)) / 100;
}

export function CaixaDfcTab({
  method,
  title,
  selectedYear,
  selectedMonth,
  colAtual,
  fmtBRL,
  SectionTitle,
}: Props) {
  const [showCharts, setShowCharts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [cadastro, setCadastro] = useState<CadastroDemonstracoes | null>(null);
  const [dados, setDados] = useState<DadosDemonstracoes | null>(null);
  const [current, setCurrent] = useState<Calculation | null>(null);
  const [accumulated, setAccumulated] = useState<Calculation | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const principal = { ano: selectedYear, mes: selectedMonth };
    setLoading(true);
    setErro('');
    setCadastro(null);
    setDados(null);
    setCurrent(null);
    setAccumulated(null);
    setExpandedRows(new Set());

    Promise.all([
      loadCadastroDemonstracoes(),
      loadDadosDemonstracoes(principal, [principal], 'dfc', selectedMonth > 0),
    ]).then(([nextCadastro, nextDados]) => {
      if (!active) return;
      const calculate = (periodos: Array<ContasBalancete | null>): Calculation => {
        if (method === 'indireto') {
          const indirect = calcularDfcIndireto(
            nextCadastro.linhas,
            nextCadastro.dfcIndiretoRegras ?? [],
            periodos,
          );
          return { values: indirect.valores, indirect };
        }
        return {
          values: calcularLinhas(nextCadastro.linhas, 'dfc', periodos),
        };
      };
      const currentPeriods = [nextDados[chavePeriodo(principal)] ?? null];
      const accumulatedPeriods = selectedMonth > 0
        ? Array.from({ length: selectedMonth }, (_, index) => (
          nextDados[chavePeriodo({ ano: selectedYear, mes: index + 1 })] ?? null
        ))
        : [];
      setCadastro(nextCadastro);
      setDados(nextDados);
      setCurrent(calculate(currentPeriods));
      setAccumulated(selectedMonth > 1 ? calculate(accumulatedPeriods) : null);
    }).catch(error => {
      if (active) setErro(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [method, selectedMonth, selectedYear]);

  const hasAccumulated = selectedMonth > 1 && Boolean(dados?.[chavePeriodo({ ano: selectedYear, mes: 1 })]);
  const headerAccumulated = selectedMonth > 0
    ? `Jan–${['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][selectedMonth]}/${String(selectedYear).slice(-2)}`
    : '';
  const periodosAtuais: PeriodoDemonstracao[] = selectedMonth > 0
    ? [{ ano: selectedYear, mes: selectedMonth }]
    : [{ ano: selectedYear, mes: 0 }];
  const periodosAcumulados: PeriodoDemonstracao[] = selectedMonth > 0
    ? Array.from({ length: selectedMonth }, (_, index) => ({ ano: selectedYear, mes: index + 1 }))
    : [];
  const periodosAtuaisDados = periodosAtuais.map(periodo => dados?.[chavePeriodo(periodo)] ?? null);
  const periodosAcumuladosDados = periodosAcumulados.map(periodo => dados?.[chavePeriodo(periodo)] ?? null);
  const periodosDetalheDados = [...periodosAtuaisDados, ...periodosAcumuladosDados];

  const linhasDfc = cadastro?.linhas.filter(linha => linha.demonstracao === 'dfc') ?? [];
  const linhasRaiz = linhasDfc.filter(linha => !linhaPai(linha) && !linha.foraDfc);
  const linhasDiretas: TableRow[] = linhasRaiz.flatMap(raiz => [
    {
      id: raiz.id,
      lineId: raiz.id,
      label: raiz.nome,
      type: raiz.tipo === 'total' ? 'heading' : 'line',
      indent: 0,
      hideValue: Boolean(raiz.dfcSubtotalNome),
    },
    ...linhasDfc.filter(linha => linhaPai(linha) === raiz.id).map(linha => ({
      id: linha.id,
      lineId: linha.id,
      label: linha.nome,
      type: 'line' as const,
      indent: 1,
    })),
    ...(raiz.dfcSubtotalNome ? [{
      id: `${raiz.id}-subtotal`,
      lineId: raiz.id,
      label: raiz.dfcSubtotalNome,
      type: 'subtotal' as const,
      indent: 0,
    }] : []),
  ]);
  const linhasIndiretas = method === 'indireto'
    ? criarLinhasDfcIndiretoTabela(linhasDfc)
    : [];
  const rows: TableRow[] = method === 'indireto'
    ? linhasIndiretas.map(linha => ({
      id: linha.id,
      lineId: linha.id,
      label: linha.nome,
      type: linha.tipo === 'titulo' ? 'heading' : linha.tipo === 'grupo' ? 'group' : linha.tipo === 'conta' ? 'line' : linha.tipo,
      indent: linha.tipo === 'conta' ? 1 : 0,
    }))
    : linhasDiretas;

  const linhaOperacional = linhasRaiz.find(linha => linha.id === 'dfc-operacional');
  const linhaInvestimento = linhasRaiz.find(linha => linha.id === 'dfc-investimento');
  const linhaFinanciamento = linhasRaiz.find(linha => linha.id === 'dfc-financiamento');
  const valor = (calculation: Calculation | null, id: string) => calculation?.values.get(id) ?? null;
  const totalDireto = (calculation: Calculation | null) => calculation
    ? sumValues(calculation.values, ['dfc-operacional', 'dfc-investimento', 'dfc-financiamento'])
    : null;
  const cardValues = [
    {
      label: linhaOperacional?.dfcSubtotalNome ?? linhaOperacional?.nome ?? 'Fluxo Operacional',
      icon: '⚙️',
      current: valor(current, 'dfc-operacional'),
      accumulated: valor(accumulated, 'dfc-operacional'),
    },
    {
      label: linhaInvestimento?.dfcSubtotalNome ?? linhaInvestimento?.nome ?? 'Fluxo de Investimento',
      icon: '🏗️',
      current: valor(current, 'dfc-investimento'),
      accumulated: valor(accumulated, 'dfc-investimento'),
    },
    {
      label: linhaFinanciamento?.dfcSubtotalNome ?? linhaFinanciamento?.nome ?? 'Fluxo de Financiamento',
      icon: '🏛️',
      current: valor(current, 'dfc-financiamento'),
      accumulated: valor(accumulated, 'dfc-financiamento'),
    },
    {
      label: 'Variação Total de Caixa',
      icon: '💰',
      current: method === 'indireto' ? valor(current, 'dfc-total') : totalDireto(current),
      accumulated: method === 'indireto' ? valor(accumulated, 'dfc-total') : totalDireto(accumulated),
    },
  ];

  const formatValue = (amount: number | null) => amount === null
    ? '—'
    : amount < 0 ? `(${fmtBRL(Math.abs(amount))})` : fmtBRL(amount);
  const formatSignedValue = (amount: number | null) => amount === null
    ? '—'
    : `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${fmtBRL(Math.abs(amount), true)}`;
  const lineForRow = (id: string) => linhasDfc.find(linha => linha.id === id);
  const directAccountsForLine = (id: string) => cadastro
    ? listarContasDfcDaLinha(cadastro.linhas, id, periodosDetalheDados)
      .map(item => periodosDetalheDados.map(periodo => periodo?.[item.referencia])
        .find(conta => conta !== undefined))
      .filter((conta): conta is ContasBalancete[string] => conta !== undefined)
    : [];
  const accountsForRow = (row: TableRow) => method === 'indireto'
    ? current?.indirect?.contasPorLinha.get(row.lineId) ?? []
    : directAccountsForLine(row.lineId);
  const hasAcum = hasAccumulated && accumulated !== null;

  const toggleExpanded = (id: string) => {
    setExpandedRows(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const valuesForAccount = (row: TableRow, account: ContasBalancete[string]) => {
    if (method === 'indireto') {
      return {
        current: current?.indirect?.valoresContasPorLinha.get(row.lineId)?.get(account.conta) ?? null,
        accumulated: accumulated?.indirect?.valoresContasPorLinha.get(row.lineId)?.get(account.conta) ?? null,
      };
    }
    return {
      current: dados ? calcularConta(
        { referencia: account.conta, operacao: 1 },
        'dfc',
        periodosAtuaisDados,
      ) : null,
      accumulated: dados && periodosAcumulados.length > 0 ? calcularConta(
        { referencia: account.conta, operacao: 1 },
        'dfc',
        periodosAcumuladosDados,
      ) : null,
    };
  };

  const handlePDF = () => {
    const printSource = printRef.current;
    const root = document.getElementById('print-root');
    if (!printSource || !root) return;

    setPrinting(true);
    const clone = printSource.cloneNode(true) as HTMLElement;
    clone.style.display = 'block';
    root.innerHTML = clone.outerHTML;
    const styleId = method === 'direto' ? '__dfc-direto-print-override__' : '__dfc-indireto-print-override__';
    document.head.querySelector(`#${styleId}`)?.remove();
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @page { size: A4 portrait; margin: 1cm; }
      body > *:not(#print-root) { display: none !important; }
      #print-root { display: block !important; font-family: Inter, system-ui, sans-serif; font-size: 10px; }
      #print-root, #print-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-scheme: light !important; }
      #print-root .overflow-auto, #print-root [class*="overflow-auto"], #print-root [class*="overflow-y"] {
        overflow: visible !important; max-height: none !important; height: auto !important;
      }
      #print-root .dfc-table { width: 100%; border-collapse: collapse; }
      #print-root .dfc-table th, #print-root .dfc-table td { font-size: 8px !important; padding: 3px 6px !important; }
    `;
    document.head.appendChild(style);
    setPrinting(false);
    window.onafterprint = () => {
      document.head.querySelector(`#${styleId}`)?.remove();
      root.innerHTML = '';
      window.onafterprint = null;
    };
    window.print();
  };

  if (showCharts) {
    return (
      <CaixaDfcCharts
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onClose={() => setShowCharts(false)}
        title={title}
        method={method}
      />
    );
  }

  return (
    <div>
      {erro && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {!erro && loading && <p role="status" className="mb-4 text-sm text-muted-foreground">Carregando DFC cadastrada...</p>}
      <div className="mb-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowCharts(true)}
          className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
        >
          <span>📈</span> Evolução Mensal
        </button>
        <button
          type="button"
          onClick={handlePDF}
          disabled={printing}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>🖨️</span> {printing ? 'Preparando...' : 'Imprimir / Salvar PDF'}
        </button>
      </div>
      <div ref={printRef}>
        {!erro && !loading && rows.length === 0 && (
          <p role="status" className="mb-4 text-sm text-amber-800">Nenhuma linha DFC cadastrada na Emissão de Demonstrações Financeiras.</p>
        )}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cardValues.map((card, index) => (
            <Card key={index}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {card.icon} {card.label}
                </div>
              </CardHeader>
              <CardContent>
                {hasAccumulated ? (
                  <div className="space-y-2">
                    <div>
                      <div className="mb-0.5 text-[10px] uppercase tracking-wider text-foreground">{colAtual}</div>
                      <div className={cn(
                        'text-lg font-bold',
                        card.current === null ? 'text-muted-foreground' : card.current >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                      )}>{formatSignedValue(card.current)}</div>
                    </div>
                    <div className="border-t border-border/50 pt-2">
                      <div className="mb-0.5 text-[10px] uppercase tracking-wider text-foreground">{headerAccumulated}</div>
                      <div className={cn(
                        'text-xl font-bold',
                        card.accumulated === null ? 'text-muted-foreground' : card.accumulated >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                      )}>{formatSignedValue(card.accumulated)}</div>
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    'text-2xl font-bold',
                    card.current === null ? 'text-muted-foreground' : card.current >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                  )}>{formatSignedValue(card.current)}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            <SectionTitle icon="💰">{title === 'FC Indireto' ? 'Demonstração do Fluxo de Caixa — Método Indireto' : 'DFC — Método Direto (NBC TG 03)'}</SectionTitle>
            <div className="overflow-x-auto">
              <table className="dfc-table w-full border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-3 py-2.5 text-left text-xs uppercase tracking-wider text-muted-foreground">Descrição</th>
                    <th className={cn('w-[20%] px-3 py-2.5 text-right text-xs uppercase tracking-wider', hasAcum ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-muted-foreground')}>
                      {hasAcum ? colAtual : 'Valor (R$)'}
                    </th>
                    {hasAcum && <th className="w-[20%] border-l border-border/30 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{headerAccumulated}</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const line = lineForRow(row.lineId);
                    const accounts = row.type === 'line' && (method === 'direto' ? line?.tipo === 'contas' : true)
                      ? accountsForRow(row)
                      : [];
                    const expanded = expandedRows.has(row.id);
                    const isTitle = row.type === 'heading' || row.type === 'group';
                    const isTotal = row.type === 'subtotal' || row.type === 'total';
                    const hideValue = row.hideValue || isTitle || row.type === 'group';
                    const currentValue = hideValue ? null : valor(current, row.lineId);
                    const accumulatedValue = hideValue ? null : valor(accumulated, row.lineId);
                    return (
                      <Fragment key={row.id}>
                        <tr className={cn(
                          'border-b border-border',
                          isTitle && 'bg-muted/40 font-semibold',
                          isTotal && 'border-y bg-muted/60 font-bold',
                        )}>
                          <th scope="row" className="px-3 py-2.5 text-left" style={{ paddingLeft: 12 + row.indent * 20 }}>
                            {accounts.length > 0 && (
                              <button
                                type="button"
                                className="mr-1 inline-flex rounded p-1 align-middle hover:bg-muted focus-visible:outline focus-visible:outline-2"
                                aria-label={`${expanded ? 'Ocultar' : 'Exibir'} contas de ${row.label}`}
                                aria-expanded={expanded}
                                onClick={() => toggleExpanded(row.id)}
                              >
                                {expanded ? <ChevronDown aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}
                              </button>
                            )}
                            {row.label}
                          </th>
                          <td className={cn('px-3 py-2.5 text-right font-mono text-sm tabular-nums', isTotal && 'font-bold', currentValue !== null && currentValue < 0 && 'text-red-700')}>
                            {!hideValue && formatValue(currentValue)}
                          </td>
                          {hasAcum && <td className={cn('border-l border-border/30 px-3 py-2.5 text-right font-mono text-sm tabular-nums', isTotal && 'font-bold', accumulatedValue !== null && accumulatedValue < 0 && 'text-red-700')}>
                            {!hideValue && formatValue(accumulatedValue)}
                          </td>}
                        </tr>
                        {expanded && accounts.map(account => {
                          const detailValues = valuesForAccount(row, account);
                          return (
                            <tr key={`${row.id}-${account.conta}`} className="border-b border-border/50 bg-muted/20">
                              <th scope="row" className="px-3 py-2 text-left text-xs font-normal text-muted-foreground" style={{ paddingLeft: 32 + row.indent * 20 }}>
                                {account.conta} — {account.desc}
                              </th>
                              <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{formatValue(detailValues.current)}</td>
                              {hasAcum && <td className="border-l border-border/30 px-3 py-2 text-right font-mono text-xs tabular-nums">{formatValue(detailValues.accumulated)}</td>}
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={hasAcum ? 3 : 2} className="p-6 text-center text-sm text-muted-foreground">Nenhuma linha DFC cadastrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground/70">
              {method === 'indireto'
                ? '* Valores calculados com as linhas e regras do método indireto cadastradas em Emissão de Demonstrações Financeiras.'
                : '* Valores calculados pelas linhas e prefixos cadastrados em Emissão de Demonstrações Financeiras.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
