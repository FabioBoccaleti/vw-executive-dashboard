import { Button } from '@/components/ui/button';
import { LogOut, TrendingUp, Wrench } from 'lucide-react';

interface VendasBonificacoesDashboardProps {
  onChangeBrand: () => void;
}

export function VendasBonificacoesDashboard({ onChangeBrand }: VendasBonificacoesDashboardProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-[#b45309] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6" />
            <span className="text-lg font-bold">Demonstrativo de Vendas e Bonificações</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onChangeBrand}
            className="text-white hover:bg-white/20 gap-2"
          >
            <LogOut className="w-4 h-4" />
            Trocar painel
          </Button>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 mb-6">
            <Wrench className="w-10 h-10 text-[#b45309]" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">
            Em desenvolvimento
          </h2>
          <p className="text-slate-500 text-base leading-relaxed">
            O módulo <strong>Demonstrativo de Vendas e Bonificações</strong> está em desenvolvimento e estará disponível em breve.
          </p>
          <Button
            className="mt-8 bg-[#b45309] hover:bg-[#92400e] text-white"
            onClick={onChangeBrand}
          >
            Voltar ao menu principal
          </Button>
        </div>
      </div>
    </div>
  );
}
