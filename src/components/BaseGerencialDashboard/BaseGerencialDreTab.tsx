import { useState } from 'react';
import type { Marca } from './baseGerencialStorage';

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const DRE_ROWS = [
  { label: 'VOLUME DE VENDAS', kind: 'normal' },
  { label: 'RECEITA OPERACIONAL LÍQUIDA', kind: 'bold' },
  { label: 'CUSTO OPERACIONAL DA RECEITA', kind: 'negative' },
  { label: 'LUCRO (PREJUÍZO) OPERACIONAL BRUTO', kind: 'subtotal' },
  { label: 'OUTRAS RECEITAS OPERACIONAIS', kind: 'normal' },
  { label: 'OUTRAS DESPESAS OPERACIONAIS', kind: 'negative' },
  { label: 'MARGEM DE CONTRIBUIÇÃO', kind: 'subtotal' },
  { label: 'DESPESAS C/ PESSOAL', kind: 'negative' },
  { label: 'DESPESAS C/ SERV. DE TERCEIROS', kind: 'negative' },
  { label: 'DESPESAS C/ OCUPAÇÃO', kind: 'negative' },
  { label: 'DESPESAS C/ FUNCIONAMENTO', kind: 'negative' },
  { label: 'DESPESAS C/ VENDAS', kind: 'negative' },
  { label: 'LUCRO (PREJUÍZO) OPERACIONAL LÍQUIDO', kind: 'subtotal' },
  { label: 'AMORTIZAÇÕES E DEPRECIAÇÕES', kind: 'negative' },
  { label: 'OUTRAS RECEITAS FINANCEIRAS', kind: 'normal' },
  { label: 'DESPESAS FINANCEIRAS NÃO OPERACIONAL', kind: 'negative' },
  { label: 'DESPESAS NÃO OPERACIONAIS', kind: 'negative' },
  { label: 'OUTRAS RENDAS NÃO OPERACIONAIS', kind: 'normal' },
  { label: 'LUCRO (PREJUÍZO) ANTES IMPOSTOS', kind: 'subtotal' },
  { label: 'PROVISÕES IRPJ E C.S.', kind: 'negative' },
  { label: 'PARTICIPAÇÕES', kind: 'negative' },
  { label: 'LUCRO LÍQUIDO DO EXERCÍCIO', kind: 'total' },
] as const;

const DEPARTMENTS = [
  'Veículos Novos',
  'Venda Direta',
  'Veículos Usados',
  'Peças',
  'Oficina',
  'Funilaria',
  'Administração',
  'Diretoria',
  'Consolidado (Total)',
] as const;

interface Props {
  marca: Marca;
  year: number;
  years: number[];
  onYearChange: (year: number) => void;
}

function valueText(label: string): string {
  return label === 'VOLUME DE VENDAS' ? '0' : 'R$ 0';
}

function totalText(label: string): string {
  const monthlyValues = MONTHS.map(() => 0);
  const total = monthlyValues.reduce((sum, value) => sum + value, 0);
  return label === 'VOLUME DE VENDAS' ? String(total) : `R$ ${total}`;
}

export function BaseGerencialDreTab({
  marca,
  year,
  years,
  onYearChange,
}: Props) {
  const [activeDepartment, setActiveDepartment] = useState<(typeof DEPARTMENTS)[number]>('Veículos Novos');
  const isAudiVendaDireta = marca === 'audi' && activeDepartment === 'Venda Direta';

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <div className="bg-white rounded-xl border border-slate-200 px-4 shadow-sm">
        <div className="flex items-center gap-3 py-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ANO</span>
          <select
            value={year}
            onChange={event => onYearChange(Number(event.target.value))}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded bg-white text-slate-700 font-semibold"
          >
            {years.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-0 border-b border-slate-200 overflow-x-auto">
        {DEPARTMENTS.map(department => (
          <button
            key={department}
            onClick={() => setActiveDepartment(department)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeDepartment === department
                ? 'text-slate-700 border-emerald-600'
                : 'text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-300'
            }`}
          >
            {department}
          </button>
        ))}
      </div>

      {isAudiVendaDireta ? (
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-center space-y-2">
            <p className="text-slate-500 font-medium">Dados incluídos em Veículos Novos</p>
            <p className="text-slate-400 text-sm">
              Na Audi, os dados de Venda Direta são somados e exibidos junto ao departamento Veículos Novos.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="mb-3">
            <h2 className="text-base font-bold text-slate-800">Demonstrativo de Resultados (DRE)</h2>
            <p className="text-xs text-slate-500">{activeDepartment} - Ano Fiscal {year}</p>
          </div>
          <table className="w-full min-w-[1120px] border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="w-64 border-r border-slate-600 px-2 py-2 text-left font-bold">DESCRIÇÃO</th>
                <th className="w-32 min-w-32 border-r border-slate-600 px-3 py-2 text-right font-bold">TOTAL</th>
                <th className="w-14 border-r border-slate-600 px-2 py-2 text-right font-bold">%</th>
                {MONTHS.map(month => (
                  <th key={month} className="min-w-16 border-r border-slate-600 px-2 py-2 text-right font-bold">{month}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DRE_ROWS.map((row, index) => {
                const isTotal = row.kind === 'total';
                const isSubtotal = row.kind === 'subtotal';
                const isNegative = row.kind === 'negative';
                return (
                  <tr
                    key={row.label}
                    className={`${isTotal ? 'bg-purple-100 text-purple-900 font-bold' : isSubtotal ? 'bg-slate-100 font-semibold' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b border-slate-200`}
                  >
                    <td className="px-2 py-1.5 font-medium">{row.label}</td>
                    <td className={`w-32 min-w-32 px-3 py-1.5 text-right tabular-nums ${isNegative ? 'text-red-600' : ''}`}>{totalText(row.label)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">-</td>
                    {MONTHS.map(month => (
                      <td key={`${row.label}-${month}`} className={`border-l border-slate-200 px-2 py-1.5 text-right tabular-nums ${isNegative ? 'text-red-600' : ''}`}>
                        {valueText(row.label)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
