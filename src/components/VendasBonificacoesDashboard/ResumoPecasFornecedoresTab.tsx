import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { loadAndAggregateResumo, type EntradaPecasResumo } from './entradaPecasStorage';

interface Props {
  filterYear: number;
  filterMonth: number | null;
}

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ResumoPecasFornecedoresTab({ filterYear, filterMonth }: Props) {
  const [resumo, setResumo] = useState<EntradaPecasResumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadAndAggregateResumo(filterMonth, filterYear).then(data => {
      setResumo(data);
      setLoading(false);
    });
  }, [filterYear, filterMonth]);

  const periodLabel = filterMonth !== null
    ? `${MONTH_NAMES[filterMonth - 1]}/${filterYear}`
    : `${filterYear}`;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!resumo || resumo.byFornecedor.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Nenhum dado para {periodLabel}</p>
          <p className="text-xs text-slate-400">Importe um arquivo TXT na aba "ImportaÃ§Ã£o de Arquivo de Compra".</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Cards por Tipo de TransaÃ§Ã£o */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex gap-3 flex-shrink-0 overflow-x-auto">
        {resumo.byTipo.map(card => {
          const isDevolucao = card.tipo === 'P27';
          return (
            <div
              key={card.tipo}
              className={`flex-shrink-0 rounded-xl border px-5 py-3 min-w-[180px] flex flex-col gap-1 ${
                isDevolucao ? 'bg-red-50 border-red-200' : 'bg-white border-emerald-200'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                isDevolucao ? 'text-red-400' : 'text-emerald-600'
              }`}>
                Tipo {card.tipo}
                {isDevolucao && <span className="ml-1 normal-case font-medium">(devoluÃ§Ã£o)</span>}
              </span>
              <span className={`text-lg font-bold leading-tight ${
                isDevolucao ? 'text-red-700' : 'text-slate-800'
              }`}>
                {fmtBRL(card.totalCusto)}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Custo MÃ©dio Total</span>
              <div className={`mt-1 pt-1 border-t text-xs font-semibold ${
                isDevolucao ? 'border-red-100 text-red-600' : 'border-slate-100 text-slate-600'
              }`}>
                {card.nfs} NF{card.nfs !== 1 ? 's' : ''} distintas
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra de totais */}
      <div className="bg-white border-b border-slate-100 px-6 py-2.5 flex items-center gap-4 text-xs flex-shrink-0">
        <span><strong className="text-slate-700">{resumo.byFornecedor.length}</strong> <span className="text-slate-400">fornecedores</span></span>
        <span className="w-px h-4 bg-slate-200" />
        <span><strong className="text-slate-700">{resumo.totalNFs}</strong> <span className="text-slate-400">NFs</span></span>
        <span className="w-px h-4 bg-slate-200" />
        <span>Total de Compras: <strong className="text-slate-800">{fmtBRL(resumo.totalCusto)}</strong></span>
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
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">NÂº NFs</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Total de Compras (R$)</th>
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap border-b border-slate-200">Dev. (P27)</th>
              </tr>
            </thead>
            <tbody>
              {resumo.byFornecedor.map((f, i) => (
                <tr
                  key={f.nomeCliente}
                  className={`border-b border-slate-100 hover:bg-emerald-50/40 transition-colors ${
                    i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <td className="px-3 py-2 text-center text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 text-slate-800 font-medium">{f.nomeCliente}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{f.nfs}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${
                    f.totalCusto < 0 ? 'text-red-600' : 'text-slate-800'
                  }`}>
                    {fmtBRL(f.totalCusto)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {f.temDevolucao ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">Sim</span>
                    ) : (
                      <span className="text-slate-300">â€”</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* RodapÃ© */}
          <div className="sticky bottom-0 bg-white border-t-2 border-slate-200 px-6 py-3 flex items-center gap-6 text-xs shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Fornecedores:</span>
              <span className="font-bold text-slate-700">{resumo.byFornecedor.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">NFs:</span>
              <span className="font-bold text-slate-700">{resumo.totalNFs}</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Total de Compras:</span>
              <span className="font-bold text-slate-800">{fmtBRL(resumo.totalCusto)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
