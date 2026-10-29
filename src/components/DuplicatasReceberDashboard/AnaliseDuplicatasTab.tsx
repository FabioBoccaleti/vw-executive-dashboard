import { BarChart3 } from 'lucide-react';
import type { DuplicatasMarca } from './DuplicatasReceberDashboard';

interface Props {
  marca: DuplicatasMarca;
}

export function AnaliseDuplicatasTab({ marca }: Props) {
  return (
    <div className="mt-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm py-16">
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: marca.primaryLight, color: marca.primary }}
          >
            <BarChart3 className="w-8 h-8" />
          </div>
          <p className="text-slate-600 font-medium">Análise de Duplicatas a Receber — {marca.name}</p>
          <p className="text-sm text-slate-400">
            Esta análise será construída em uma próxima etapa. Primeiro, importe os arquivos na aba
            "Importação de Arquivo".
          </p>
        </div>
      </div>
    </div>
  );
}
