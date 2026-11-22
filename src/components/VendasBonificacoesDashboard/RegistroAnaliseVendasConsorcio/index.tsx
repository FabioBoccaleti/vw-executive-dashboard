import { useState } from 'react';
import { useAuth } from '@/contexts/useAuth';
import { Button } from '@/components/ui/button';
import { Handshake, TableProperties, BarChart2, BookOpen, LogOut, ShoppingCart, Clock, CheckCircle2, FilePlus2 } from 'lucide-react';
import { LancarVendaForm } from './LancarVendaForm';
import { VendasReceber } from './VendasReceber';

interface RegistroAnaliseVendasConsorcioDashboardProps {
  onChangeBrand: () => void;
  onOpenCadastros: () => void;
}

interface ColDef { key: string; label: string; width: number; align?: 'right' }

// Colunas-folha da tabela (as duas de parcelas ficam sob o grupo "Quantidade de Parcelas")
const COLUMNS: ColDef[] = [
  { key: 'dataBordero',             label: 'Data do Borderô',             width: 140 },
  { key: 'tipoVenda',               label: 'Tipo da Venda',               width: 160 },
  { key: 'parcelasTotal',           label: 'Total de Parcelas',           width: 120 },
  { key: 'parcelaRecebida',         label: 'Parcela Recebida',            width: 120 },
  { key: 'grupoCota',               label: 'Grupo / Cota',                width: 130 },
  { key: 'cliente',                 label: 'Cliente',                     width: 190 },
  { key: 'valorCota',               label: 'Valor da Cota de Consorcio',  width: 180, align: 'right' },
  { key: 'pctComissaoVenda',        label: '% Comissão s/ Venda',         width: 150, align: 'right' },
  { key: 'valorComissaoVenda',      label: 'Valor da Parcela de Comissão de Venda', width: 185, align: 'right' },
  { key: 'pctRentabilidadeBruta',   label: '% Rentabilidade Bruta da Parcela',      width: 150, align: 'right' },
  { key: 'impostosComissao',        label: 'Impostos s/ a Parcela da Comissão',    width: 150, align: 'right' },
  { key: 'totalComissaoLiquida',    label: 'Total da Parcela da Comissão Líquida', width: 180, align: 'right' },
  { key: 'pctRentabilidadeLiquida', label: '% Rentabilidade Líquida da Parcela',    width: 150, align: 'right' },
];

export function RegistroAnaliseVendasConsorcioDashboard({ onChangeBrand, onOpenCadastros }: RegistroAnaliseVendasConsorcioDashboardProps) {
  const { canAccessVendasSub, isAdmin } = useAuth();
  const canTabela   = isAdmin() || canAccessVendasSub('consorcio.tabela');
  const canVendas   = isAdmin() || canAccessVendasSub('consorcio.vendas');
  const canAnalise  = isAdmin() || canAccessVendasSub('consorcio.analise');
  const canCadastro = isAdmin() || canAccessVendasSub('consorcio.cadastro');

  const [activeTab, setActiveTab] = useState<'tabela' | 'vendas' | 'lancar' | 'analise'>(
    canTabela ? 'tabela' : canVendas ? 'vendas' : 'analise',
  );
  const [vendasSubTab, setVendasSubTab] = useState<'a_receber' | 'recebida'>('a_receber');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ── Header ── */}
      <header
        className="text-white shadow-lg flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)' }}
      >
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-lg">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight">
                Registro e Análise de Vendas de Consorcio
              </h1>
              <p className="text-cyan-100 text-xs mt-0.5">Demonstrativo de Vendas e Bonificações</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Abas */}
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 gap-0.5">
              {canVendas && (
              <button
                onClick={() => setActiveTab('lancar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === 'lancar'
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                Lançar Vendas
              </button>
              )}
              {canVendas && (
              <button
                onClick={() => setActiveTab('vendas')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === 'vendas'
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Vendas
              </button>
              )}
              {canTabela && (
              <button
                onClick={() => setActiveTab('tabela')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === 'tabela'
                    ? 'bg-cyan-500 text-white shadow-sm'
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
                    ? 'bg-cyan-500 text-white shadow-sm'
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
              </colgroup>

              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 top-0 z-40 text-white text-center text-xs font-semibold px-2 py-3 border-r border-cyan-900 align-middle"
                    style={{ background: '#0e7490' }}
                  >
                    #
                  </th>
                  {COLUMNS.map(col => {
                    if (col.key === 'parcelasTotal') {
                      return (
                        <th
                          key="grp-parcelas"
                          colSpan={2}
                          className="sticky top-0 z-30 text-white text-xs font-semibold px-3 py-2 border-r border-b border-cyan-500 text-center"
                          style={{ background: '#0891b2' }}
                        >
                          Quantidade de Parcelas
                        </th>
                      );
                    }
                    if (col.key === 'parcelaRecebida') return null;
                    return (
                      <th
                        key={`h-${col.key}`}
                        rowSpan={2}
                        className="sticky top-0 z-30 text-white text-xs font-semibold px-3 py-3 border-r border-cyan-500 align-middle leading-snug text-center"
                        style={{ background: '#0891b2' }}
                      >
                        {col.label}
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  {COLUMNS.filter(c => c.key === 'parcelasTotal' || c.key === 'parcelaRecebida').map(col => (
                    <th
                      key={`sub-${col.key}`}
                      className="sticky z-30 text-white text-xs font-semibold px-3 py-2 border-r border-cyan-500 text-center leading-snug"
                      style={{ background: '#0891b2', top: 'var(--parcelas-group-height, 37px)' }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="text-center text-sm text-slate-400 py-10">
                    Nenhum registro cadastrado
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'vendas' && canVendas && (
        <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
          <div className="inline-flex self-start bg-slate-200 rounded-lg p-0.5 gap-0.5">
            {([
              { v: 'a_receber' as const, label: 'A Receber', icon: <Clock className="w-3.5 h-3.5" /> },
              { v: 'recebida' as const, label: 'Recebida', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
            ]).map(opt => (
              <button
                key={opt.v}
                onClick={() => setVendasSubTab(opt.v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  vendasSubTab === opt.v ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-300'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
          <VendasReceber situacao={vendasSubTab} />
        </div>
      )}

      {activeTab === 'lancar' && canVendas && (
        <LancarVendaForm onOpenCadastros={onOpenCadastros} onVendaRegistrada={() => {
          setVendasSubTab('a_receber');
          setActiveTab('vendas');
        }} />
      )}

      {activeTab === 'analise' && canAnalise && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-5 rounded-full bg-cyan-50">
              <BarChart2 className="w-12 h-12 text-cyan-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Em desenvolvimento</h2>
          </div>
        </div>
      )}
    </div>
  );
}
