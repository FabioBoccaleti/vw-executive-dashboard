import { useState } from 'react';
import { Car, Building2, Copy, CheckCircle2, ArrowRightLeft, Landmark } from 'lucide-react';
import { AnaliseDespesasSubPage } from './AnaliseDespesasSubPage';
import { RateioDespesasFinanceirasPage } from './RateioDespesasFinanceirasPage';
import type { AnaliseBrand } from './analiseDespesasStorage';
import { saveAnaliseDespesasTipos } from './analiseDespesasStorage';
import { loadDespesasTipos } from '@/components/FluxoCaixaDashboard/despesasStorage';

type SubPage = null | AnaliseBrand | 'rateios' | 'rateio_despesas_financeiras';

interface AnaliseDespesasDashboardProps {
  onChangeBrand: () => void;
}

export function AnaliseDespesasDashboard({ onChangeBrand }: AnaliseDespesasDashboardProps) {
  const [subPage, setSubPage] = useState<SubPage>(null);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopyTipos() {
    setCopying(true);
    setCopied(false);
    try {
      const tipos = await loadDespesasTipos();
      await Promise.all([
        saveAnaliseDespesasTipos('vw', tipos),
        saveAnaliseDespesasTipos('audi', tipos),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Erro ao copiar tipos:', err);
    } finally {
      setCopying(false);
    }
  }

  function renderHeader(title: string, subtitle: string) {
    return (
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onChangeBrand}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
          >
            ← Voltar ao menu
          </button>
        </div>
      </header>
    );
  }

  if (subPage === 'rateio_despesas_financeiras') {
    return (
      <RateioDespesasFinanceirasPage onBackToRateios={() => setSubPage('rateios')} />
    );
  }

  if (subPage === 'rateios') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        {renderHeader('Análise Evolutiva de Despesas', 'Selecione o rateio desejado')}

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-sm">
            <button
              onClick={() => setSubPage('rateio_despesas_financeiras')}
              className="w-full bg-white rounded-2xl border-2 border-amber-600 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
            >
              <div className="p-4 rounded-full bg-amber-50 group-hover:bg-amber-100 transition-colors">
                <Landmark className="w-10 h-10 text-amber-700" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-800 leading-snug">Rateio Despesas Financeiras - (Rotativo Banco Volks e outros Bancos)</h2>
                <p className="text-sm text-slate-500">Abrir módulo</p>
              </div>
            </button>

            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setSubPage(null)}
                className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
              >
                ← Voltar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (subPage === 'vw' || subPage === 'audi') {
    return (
      <AnaliseDespesasSubPage
        brand={subPage}
        onBack={() => setSubPage(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Análise Evolutiva de Despesas</h1>
          <p className="text-xs text-slate-500 mt-0.5">Selecione o módulo desejado</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyTipos}
            disabled={copying}
            className="flex items-center gap-1.5 text-xs border rounded px-3 py-1.5 transition-colors disabled:opacity-50"
            style={
              copied
                ? { borderColor: '#16a34a', color: '#16a34a', background: '#f0fdf4' }
                : { borderColor: '#cbd5e1', color: '#64748b', background: 'white' }
            }
            title="Copia os tipos de despesa cadastrados no Fluxo de Caixa para VW e Audi"
          >
            {copied ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? 'Tipos copiados!' : copying ? 'Copiando…' : 'Copiar tipos do Fluxo de Caixa'}
          </button>
          <button
            onClick={onChangeBrand}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
          >
            ← Voltar ao menu
          </button>
        </div>
      </header>

      {/* Cards */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-5xl">

          {/* Card — VW */}
          <button
            onClick={() => setSubPage('vw')}
            className="flex-1 bg-white rounded-2xl border-2 border-blue-900 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-blue-50 group-hover:bg-blue-100 transition-colors">
              <Car className="w-10 h-10 text-blue-900" />
            </div>
            <h2 className="text-base font-bold text-slate-800 leading-snug">VW</h2>
          </button>

          {/* Card — Audi */}
          <button
            onClick={() => setSubPage('audi')}
            className="flex-1 bg-white rounded-2xl border-2 border-red-700 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-red-50 group-hover:bg-red-100 transition-colors">
              <Building2 className="w-10 h-10 text-red-700" />
            </div>
            <h2 className="text-base font-bold text-slate-800 leading-snug">Audi</h2>
          </button>

          {/* Card — Rateios */}
          <button
            onClick={() => setSubPage('rateios')}
            className="flex-1 bg-white rounded-2xl border-2 border-amber-600 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-200 p-8 flex flex-col items-center gap-4 text-center group"
          >
            <div className="p-4 rounded-full bg-amber-50 group-hover:bg-amber-100 transition-colors">
              <ArrowRightLeft className="w-10 h-10 text-amber-700" />
            </div>
            <h2 className="text-base font-bold text-slate-800 leading-snug">Rateios</h2>
          </button>

        </div>
      </div>
    </div>
  );
}
