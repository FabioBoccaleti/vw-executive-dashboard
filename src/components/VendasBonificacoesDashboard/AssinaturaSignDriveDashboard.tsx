import { useState } from 'react';
import { useAuth } from '@/contexts/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, Key, BookOpen, TableProperties, BarChart2, Search } from 'lucide-react';

interface AssinaturaSignDriveDashboardProps {
  onChangeBrand: () => void;
  onOpenCadastros: () => void;
}

// ─── Column definitions ────────────────────────────────────────
type ColType = 'text' | 'currency' | 'percent' | 'date';
interface ColDef { key: string; label: string; type: ColType; width: number; }

const COLUMNS: ColDef[] = [
  { key: 'dataRegistro',            label: 'Registro da Venda',            type: 'date',     width: 140 },
  { key: 'dataVenda',               label: 'Data da Venda',                type: 'date',     width: 130 },
  { key: 'cliente',                 label: 'Cliente',                      type: 'text',     width: 185 },
  { key: 'tipoVenda',              label: 'Produto',                      type: 'text',     width: 150 },
  { key: 'veiculo',                 label: 'Veículo',                      type: 'text',     width: 160 },
  { key: 'chassi',                  label: 'Chassi',                       type: 'text',     width: 150 },
  { key: 'placa',                   label: 'Placa',                        type: 'text',     width: 120 },
  { key: 'vendedor',                label: 'Vendedor',                     type: 'text',     width: 160 },
  { key: 'valorContrato',           label: 'Valor do Contrato',            type: 'currency', width: 150 },
  { key: 'pctComissaoSorana',       label: '% Comissão Sorana',            type: 'percent',  width: 140 },
  { key: 'comissaoEntrega',         label: 'Valor da Comissão de Entrega', type: 'currency', width: 180 },
  { key: 'comissaoVenda',           label: 'Valor da Comissão de Venda',   type: 'currency', width: 180 },
  { key: 'totalComissoesBruta',     label: 'Total das Comissões Bruta',    type: 'currency', width: 175 },
  { key: 'pctRentabilidadeBruta',   label: '% Rentabilidade Bruta',        type: 'percent',  width: 150 },
  { key: 'pctImpostosComissao',     label: '% Impostos s/ Comissão',       type: 'percent',  width: 150 },
  { key: 'totalComissaoLiquida',    label: '% Total das Comissão Líquida', type: 'percent',  width: 175 },
  { key: 'pctRentabilidadeLiquida', label: '% Rentabilidade Líquida',      type: 'percent',  width: 150 },
  { key: 'nfComissao',              label: 'Nº NF de Comissão',            type: 'text',     width: 150 },
  { key: 'situacaoComissao',        label: 'Situação da Comissão',         type: 'text',     width: 160 },
];

export function AssinaturaSignDriveDashboard({ onChangeBrand, onOpenCadastros }: AssinaturaSignDriveDashboardProps) {
  const { canAccessVendasSub, isAdmin } = useAuth();
  const canTabela  = isAdmin() || canAccessVendasSub('assinatura_signdrive.tabela');
  const canAnalise = isAdmin() || canAccessVendasSub('assinatura_signdrive.analise');
  const canCadastro = isAdmin() || canAccessVendasSub('assinatura_signdrive.cadastro');

  const [activeTab, setActiveTab] = useState<'tabela' | 'analise'>(canTabela ? 'tabela' : 'analise');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const setFilter = (key: string, value: string) => setFilters(prev => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ── Header ── */}
      <header
        className="text-white shadow-lg flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)' }}
      >
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-lg">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight">
                Vendas de Carro por Assinatura (Sign&amp;Drive)
              </h1>
              <p className="text-rose-200 text-xs mt-0.5">0 registros</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Abas */}
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 gap-0.5">
              {canTabela && (
              <button
                onClick={() => setActiveTab('tabela')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === 'tabela'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <TableProperties className="w-3.5 h-3.5" />
                Tabela
              </button>
              )}
              {canAnalise && (
              <button
                onClick={() => setActiveTab('analise')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === 'analise'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Análise
              </button>
              )}
            </div>
            {canCadastro && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenCadastros}
              className="text-white border border-white/30 hover:bg-white/15 gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Cadastro
            </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onChangeBrand}
              className="text-white border border-white/30 hover:bg-white/15 gap-2"
            >
              <LogOut className="w-4 h-4" />
              Trocar painel
            </Button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      {activeTab === 'tabela' && canTabela && (
        <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
          <div
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto flex-1"
            style={{ maxHeight: 'calc(100vh - 180px)' }}
          >
            <table className="border-collapse text-sm" style={{ width: 'max-content', minWidth: '100%' }}>
              <colgroup>
                <col style={{ width: 56, minWidth: 56 }} />
                {COLUMNS.map(c => (
                  <col key={c.key} style={{ width: c.width, minWidth: c.width }} />
                ))}
                <col style={{ width: 110, minWidth: 110 }} /> {/* Ações */}
              </colgroup>

              {/* ── THEAD ── */}
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-40 text-white text-center text-xs font-semibold px-2 py-3 border-r border-rose-800" style={{ background: '#881337' }}>#</th>
                  {COLUMNS.map((col, ci) => (
                    <th key={`h-${col.key}-${ci}`} className="sticky top-0 z-30 text-white text-xs font-semibold px-3 py-3 border-r border-rose-600 align-top leading-snug text-center" style={{ background: '#be123c' }}>
                      {col.label}
                    </th>
                  ))}
                  <th className="sticky right-0 top-0 z-40 text-white text-center text-xs font-semibold px-2 py-3 border-l border-rose-800 whitespace-nowrap" style={{ background: '#881337' }}>Ações</th>
                </tr>

                {/* Filter row */}
                <tr>
                  <th className="sticky left-0 z-40 bg-slate-50 border-r border-b border-slate-200 px-1 py-1.5" style={{ top: 'var(--header-height, 44px)' }} />
                  {COLUMNS.map((col, ci) => (
                    <th key={`f-${col.key}-${ci}`} className="sticky z-30 bg-slate-50 border-r border-b border-slate-200 px-1.5 py-1.5" style={{ top: 'var(--header-height, 44px)' }}>
                      <div className="relative flex items-center">
                        <Search className="absolute left-1.5 w-3 h-3 text-slate-300 pointer-events-none" />
                        <input
                          type="text"
                          value={filters[col.key] ?? ''}
                          onChange={e => setFilter(col.key, e.target.value)}
                          className={`w-full min-w-0 bg-white border rounded pl-5 pr-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-rose-400 ${(filters[col.key]?.length ?? 0) > 0 ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-200'}`}
                        />
                      </div>
                    </th>
                  ))}
                  <th className="sticky right-0 z-40 bg-slate-50 border-l border-b border-slate-200 px-1 py-1.5" style={{ top: 'var(--header-height, 44px)' }} />
                </tr>
              </thead>

              {/* ── TBODY ── */}
              <tbody>
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="text-center text-sm text-slate-400 py-10">
                    Nenhum registro cadastrado
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'analise' && canAnalise && (
        <div className="flex-1 overflow-auto p-6" />
      )}
    </div>
  );
}
