import { useState } from 'react';
import { TrendingUp } from 'lucide-react';

type VendasSubTab = 'pecas' | 'oficina' | 'funilaria' | 'acessorios' | 'produto';

interface CalculoComissoesVWPosVendasPageProps {
  onBack: () => void;
}

const TABLE_TABS: VendasSubTab[] = ['pecas', 'oficina', 'funilaria', 'acessorios'];

const TABLE_COLUMNS = [
  'NF',
  'Série',
  'Transação',
  'Data Venda',
  'Departamento',
  'Vendedor',
  'Cond. Pagamento',
  'Cliente',
  'Valor Venda',
  'ISS',
  'ICMS',
  'PIS',
  'COFINS',
  'Difal',
  'Rec. Líquida',
  'Taxa Mercado Livre',
  'Taxa E-Peças',
  'Custo Médio',
  'Lucro Bruto',
  'LB %',
  'Valor Comissão',
  'Situação da Comissão',
  'Data Pgto Comissão',
] as const;

const VENDAS_SUB_TABS: Array<{ id: VendasSubTab; label: string }> = [
  { id: 'pecas', label: 'Peças' },
  { id: 'oficina', label: 'Oficina' },
  { id: 'funilaria', label: 'Funilaria' },
  { id: 'acessorios', label: 'Acessórios' },
  { id: 'produto', label: 'Produto' },
];

export function CalculoComissoesVWPosVendasPage({ onBack }: CalculoComissoesVWPosVendasPageProps) {
  const [vendasSubTab, setVendasSubTab] = useState<VendasSubTab>('pecas');

  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Cálculo de Comissões VW - Pós Vendas</h1>
          <p className="text-xs text-slate-500 mt-0.5">Folha de Pagamento</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors bg-white text-slate-800 shadow-sm">
              <TrendingUp className="w-3.5 h-3.5" />
              Vendas
            </button>
          </div>

          <button
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
          >
            ← Voltar
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
        <div className="bg-white border-b border-slate-200 px-6 flex gap-0 flex-shrink-0 overflow-x-auto">
          {VENDAS_SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setVendasSubTab(tab.id)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                vendasSubTab === tab.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {TABLE_TABS.includes(vendasSubTab) ? (
          <div className="flex-1 p-6" style={{ minHeight: 0 }}>
            <div className="h-full bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="h-full overflow-auto">
                <table className="min-w-[2600px] w-full text-xs text-slate-700">
                  <thead className="bg-slate-800 text-white sticky top-0 z-10">
                    <tr>
                      {TABLE_COLUMNS.map((column) => (
                        <th
                          key={column}
                          className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-slate-700 last:border-r-0"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td
                        colSpan={TABLE_COLUMNS.length}
                        className="px-3 py-8 text-center text-slate-400 border-t border-slate-100"
                      >
                        Tabela pronta. Aguardando origem dos dados.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Conteúdo da aba em desenvolvimento.
          </div>
        )}
      </div>
    </div>
  );
}
