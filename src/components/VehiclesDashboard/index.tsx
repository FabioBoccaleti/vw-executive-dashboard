import React from 'react'
import {
  RevenueChart,
  ProfitTrendChart,
  ContributionMarginChart,
  VolumeChart,
  ResultsCompositionChart,
  KPISection,
  MonthlyComparisonTable,
} from './Charts'
import { vehiclesSalesData } from '@/data/vehiclesSalesData'

// Ícone personalizado para cabeçalho
const CarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.8C18.4 10.8 17.2 10 16 10H8c-1.2 0-2.4.8-2.5 1.8C4.7 12.3 4 13.1 4 14v3c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" />
    <circle cx="17" cy="17" r="2" />
    <path d="M7 14h10" />
    <path d="M5 8h14" />
    <path d="M8 8L6 6M16 8l2-2" />
  </svg>
)

export const VehiclesDashboard: React.FC = () => {
  const currentYear = new Date().getFullYear()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Título principal */}
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-600 p-3 rounded-lg">
              <CarIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              {vehiclesSalesData.title}
            </h1>
          </div>

          {/* Subtítulo e período */}
          <p className="text-gray-600 ml-12">
            Dashboard de Análises Financeiras e Operacionais
          </p>
          <p className="text-sm text-gray-500 ml-12 mt-1">
            Período: {vehiclesSalesData.period}
          </p>

          {/* Aviso para apresentação executiva */}
          <div className="mt-4 ml-12 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-2xl">
            <p className="text-sm text-blue-900 font-medium">
              ℹ️ Documento preparado para apresentação à Diretoria e Conselho de Administração
            </p>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* SEÇÃO 1: KPIs PRINCIPAIS */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Indicadores Principais (KPIs)
          </h2>
          <KPISection />
        </section>

        {/* SEÇÃO 2: Gráficos Principais */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Análises Gráficas
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <RevenueChart />
          </div>
        </section>

        {/* SEÇÃO 3: Gráficos de Tendência */}
        <section className="mb-8">
          <div className="grid grid-cols-1 gap-6">
            <ProfitTrendChart />
            <ContributionMarginChart />
          </div>
        </section>

        {/* SEÇÃO 4: Gráficos Complementares */}
        <section className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <VolumeChart />
            <ResultsCompositionChart />
          </div>
        </section>

        {/* SEÇÃO 5: Tabela Detalhada */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Análise Comparativa Mensal
          </h2>
          <MonthlyComparisonTable />
        </section>

        {/* RODAPÉ DO DASHBOARD */}
        <section className="mt-12 pt-8 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600">
            <div>
              <p className="font-semibold text-gray-900 mb-2">Resumo Executivo</p>
              <ul className="space-y-1">
                <li>• {vehiclesSalesData.totals.volume} unidades vendidas</li>
                <li>• Receita acumulada de R$ {(vehiclesSalesData.totals.receita / 1_000_000).toFixed(1)}M</li>
                <li>• Margem média de {vehiclesSalesData.totals.percentualMargem.toFixed(2)}%</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-2">Performance</p>
              <ul className="space-y-1">
                <li>• Lucro operacional: {vehiclesSalesData.totals.percentualLucroOpLiq.toFixed(2)}%</li>
                <li>• Eficiência de custos: {Math.abs(vehiclesSalesData.totals.percentualCusto).toFixed(2)}%</li>
                <li>• Rentabilidade: {vehiclesSalesData.totals.percentualLucroLiq.toFixed(2)}%</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-2">Período de Análise</p>
              <ul className="space-y-1">
                <li>• Janeiro a Novembro de {currentYear}</li>
                <li>• 11 meses operacionais</li>
                <li>• Dados em tempo real</li>
              </ul>
            </div>
          </div>

          {/* Nota de rodapé */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-600">
              <strong>Observação:</strong> Este dashboard apresenta dados consolidados de janeiro a novembro de {currentYear}. 
              Dezembro está marcado como período em aberto. Todos os valores estão em Reais (R$) e representam 
              a performance real do segmento de Veículos Usados.
            </p>
          </div>
        </section>
      </main>

      {/* Print Styles */}
      <style>{`
        @media print {
          .bg-gradient-to-br {
            background: white !important;
          }
        }
      `}</style>
    </div>
  )
}
