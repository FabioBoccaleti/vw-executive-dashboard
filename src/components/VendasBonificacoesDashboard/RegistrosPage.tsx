import { useState } from 'react';
import { Upload, TableProperties, ClipboardList, Tag, TrendingDown, Package } from 'lucide-react';
import { ImportarPDFPage } from './ImportarPDFPage';
import { TabelaDadosDashboard } from './TabelaDadosDashboard';
import { RegistroVendasDashboard } from './RegistroVendasDashboard';
import { BonusVarejoDashboard } from './BonusVarejoDashboard';
import { BonusTradeInDashboard } from './BonusTradeInDashboard';
import { JurosRotativoDashboard } from './JurosRotativoDashboard';
import { VPecasDashboard } from './VPecasDashboard';

export function RegistrosPage({ onBack }: { onBack?: () => void }) {
  const [activeTab, setActiveTab] = useState<'importar' | 'tabela' | 'registro' | 'bonus' | 'tradein' | 'juros' | 'vpecas'>('importar');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Registros</h1>
          <p className="text-xs text-slate-500 mt-0.5">Gerencie importação, tabelas e registros de vendas</p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
          >
            ← Voltar
          </button>
        )}
      </header>

      {/* Abas internas */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-0 flex-shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('importar')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'importar'
              ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Upload className="w-4 h-4" />
          Importar PDF
        </button>
        <button
          onClick={() => setActiveTab('tabela')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'tabela'
              ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <TableProperties className="w-4 h-4" />
          Tabela de Dados
        </button>
        <button
          onClick={() => setActiveTab('registro')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'registro'
              ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Registro de Vendas
        </button>
        <button
          onClick={() => setActiveTab('bonus')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'bonus'
              ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Tag className="w-4 h-4" />
          Bônus Varejo
        </button>
        <button
          onClick={() => setActiveTab('tradein')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'tradein'
              ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Tag className="w-4 h-4" />
          Bônus Trade IN
        </button>
        <button
          onClick={() => setActiveTab('juros')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'juros'
              ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          Juros Rotativo
        </button>
        <button
          onClick={() => setActiveTab('vpecas')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'vpecas'
              ? 'border-violet-500 text-violet-700 bg-violet-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Package className="w-4 h-4" />
          V. Peças
        </button>
      </div>

      {/* Conteúdo da aba */}
      {activeTab === 'importar' && <ImportarPDFPage onBack={() => {}} />}
      {activeTab === 'tabela' && <div className="flex-1" style={{ minHeight: 0 }}><TabelaDadosDashboard onBack={() => {}} embedded /></div>}
      {activeTab === 'registro' && <RegistroVendasDashboard />}
      {activeTab === 'bonus' && <BonusVarejoDashboard />}
      {activeTab === 'tradein' && <BonusTradeInDashboard />}
      {activeTab === 'juros' && <JurosRotativoDashboard />}
      {activeTab === 'vpecas' && <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}><VPecasDashboard /></div>}
    </div>
  );
}
