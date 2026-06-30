import { useState, useEffect, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { loadEntradaPecasRows } from './entradaPecasStorage';

interface Props {
  filterYear: number;
  filterMonth: number | null;
}

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface FornecedorResumo {
  nomeCliente: string;
  nfs: number;
  totalCustoMedio: number;
  temDevolucao: boolean;
}

interface TipoTransacaoCard {
  tipo: string;
  totalCustoMedio: number;
  nfs: number;
}

export function ResumoPecasFornecedoresTab({ filterYear, filterMonth }: Props) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof loadEntradaPecasRows>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEntradaPecasRows().then(data => {
      setRows(data);
      setLoading(false);
    });
  }, []);

  // ─── Filtro por período ──────────────────────────────────────────────────────
  const filtered = useMemo(() => rows.filter(row => {
    if (row.ano !== filterYear) return false;
    if (filterMonth !== null && row.mes !== filterMonth) return false;
    return true;
  }), [rows, filterYear, filterMonth]);

  // ─── Agrupamento por Tipo Transação ─────────────────────────────────────────
  const porTipo = useMemo((): TipoTransacaoCard[] => {
    const map = new Map<string, { total: number; nfsSet: Set<string> }>();
    for (const row of filtered) {
      const key = row.tipoTransacao || '(sem tipo)';
      if (!map.has(key)) map.set(key, { total: 0, nfsSet: new Set() });
      const entry = map.get(key)!;
      entry.total += row.custoMedio;
      entry.nfsSet.add(row.numeroNF);
    }
    return Array.from(map.entries())
      .map(([tipo, data]) => ({ tipo, totalCustoMedio: data.total, nfs: data.nfsSet.size }))
      .sort((a, b) => b.totalCustoMedio - a.totalCustoMedio);
  }, [filtered]);

  // ─── Agrupamento por Fornecedor ──────────────────────────────────────────────
  const resumo = useMemo((): FornecedorResumo[] => {
    const map = new Map<string, { nfsSet: Set<string>; total: number; temDevolucao: boolean }>();

    for (const row of filtered) {
      const key = row.nomeCliente || '(sem nome)';
      if (!map.has(key)) {
        map.set(key, { nfsSet: new Set(), total: 0, temDevolucao: false });
      }
      const entry = map.get(key)!;
      entry.nfsSet.add(row.numeroNF);

      if (row.tipoTransacao === 'P27') {
        entry.total -= row.custoMedio;
        entry.temDevolucao = true;
      } else {
        entry.total += row.custoMedio;
      }
    }

    return Array.from(map.entries())
      .map(([nomeCliente, data]) => ({
        nomeCliente,
        nfs: data.nfsSet.size,
        totalCustoMedio: data.total,
        temDevolucao: data.temDevolucao,
      }))
      .sort((a, b) => b.totalCustoMedio - a.totalCustoMedio);
  }, [filtered]);

  const totals = useMemo(() => ({
    fornecedores: resumo.length,
    nfs: resumo.reduce((s, r) => s + r.nfs, 0),
    total: resumo.reduce((s, r) => s + r.totalCustoMedio, 0),
  }), [resumo]);

  const periodLabel = filterMonth !== null
    ? `${MONTH_NAMES[filterMonth - 1]}/${filterYear}`
    : `${filterYear}`;

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (resumo.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Nenhum dado para {periodLabel}</p>
          <p className="text-xs text-slate-400">Importe um arquivo TXT na aba "Importação de Arquivo de Compra".</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Cards por Tipo de Transação */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex gap-3 flex-shrink-0 overflow-x-auto">
        {porTipo.map(card => {
          const isDevolucao = card.tipo === 'P27';
          return (
            <div
              key={card.tipo}
              className={`flex-shrink-0 rounded-xl border px-5 py-3 min-w-[180px] flex flex-col gap-1 ${
                isDevolucao
                  ? 'bg-red-50 border-red-200'
                  : 'bg-white border-emerald-200'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                isDevolucao ? 'text-red-400' : 'text-emerald-600'
              }`}>
                Tipo {card.tipo}
                {isDevolucao && <span className="ml-1 normal-case font-medium">(devolução)</span>}
              </span>
              <span className={`text-lg font-bold leading-tight ${
                isDevolucao ? 'text-red-700' : 'text-slate-800'
              }`}>
                {fmtBRL(card.totalCustoMedio)}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Custo Médio Total
              </span>
              <div className={`mt-1 pt-1 border-t text-xs font-semibold ${
                isDevolucao ? 'border-red-100 text-red-600' : 'border-slate-100 text-slate-600'
              }`}>
                {card.nfs} NF{card.nfs !== 1 ? 's' : ''} distintas
              </div>
            </div>
          );
        })}
      </div>

      {/* Cabeçalho da tabela */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4 flex-shrink-0 text-xs text-slate-500">
        <span><strong className="text-slate-700">{totals.fornecedores}</strong> fornecedores</span>
        <span className="w-px h-4 bg-slate-200" />
        <span><strong className="text-slate-700">{totals.nfs}</strong> NFs</span>
        <span className="w-px h-4 bg-slate-200" />
        <span>Total de Compras: <strong className="text-slate-800">{fmtBRL(totals.total)}</strong></span>
        <span className="ml-auto text-slate-400">{periodLabel}</span>
      </div>

      {/* Tabela */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <div className="absolute inset-0 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap border-b border-slate-200 w-10">#</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">Fornecedor</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Nº NFs</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Total de Compras (R$)</th>
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap border-b border-slate-200">Dev. (P27)</th>
              </tr>
            </thead>
            <tbody>
              {resumo.map((r, i) => (
                <tr
                  key={r.nomeCliente}
                  className={`border-b border-slate-100 hover:bg-emerald-50/40 transition-colors ${
                    i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <td className="px-3 py-2 text-center text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 text-slate-800 font-medium">{r.nomeCliente}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{r.nfs}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${
                    r.totalCustoMedio < 0 ? 'text-red-600' : 'text-slate-800'
                  }`}>
                    {fmtBRL(r.totalCustoMedio)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.temDevolucao ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">Sim</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Rodapé de totais */}
          <div className="sticky bottom-0 bg-white border-t-2 border-slate-200 px-6 py-3 flex items-center gap-6 text-xs shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Fornecedores:</span>
              <span className="font-bold text-slate-700">{totals.fornecedores}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">NFs:</span>
              <span className="font-bold text-slate-700">{totals.nfs}</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Total de Compras:</span>
              <span className="font-bold text-slate-800">{fmtBRL(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
