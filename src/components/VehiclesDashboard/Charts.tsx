import React from 'react'
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer } from '@/components/ui/chart'
import { vehiclesSalesData, MonthlyData } from '@/data/vehiclesSalesData'

// Cores corporativas profissionais
const COLORS = {
  primary: '#1F2937',
  secondary: '#3B82F6',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#06B6D4',
  light: '#F3F4F6',
  accent: '#8B5CF6',
}

// Formatador de moeda
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('pt-BR').format(value)
}

// ============================================
// 1. GRÁFICO: Evolução de Receita e Custos
// ============================================
export const RevenueChart: React.FC = () => {
  const data = vehiclesSalesData.monthlyData.filter(d => d.month !== '12/25')

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Receita Operacional vs. Custos</CardTitle>
        <CardDescription>
          Análise mensal de receita e custos operacionais
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{}} className="h-[350px] w-full">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.light} />
            <XAxis dataKey="month" />
            <YAxis 
              tickFormatter={(value) => `R$ ${(value / 1_000_000).toFixed(1)}M`}
              width={80}
            />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={() => ''}
              contentStyle={{ backgroundColor: '#fff', border: `1px solid ${COLORS.light}` }}
            />
            <Legend />
            <Bar 
              dataKey="receita" 
              fill={COLORS.success}
              radius={[8, 8, 0, 0]}
              name="Receita Operacional"
            />
            <Bar 
              dataKey="custo" 
              fill={COLORS.danger}
              radius={[8, 8, 0, 0]}
              name="Custo Operacional"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ============================================
// 2. GRÁFICO: Tendência de Lucro Operacional
// ============================================
export const ProfitTrendChart: React.FC = () => {
  const data = vehiclesSalesData.monthlyData.filter(d => d.month !== '12/25')

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Tendência de Lucros</CardTitle>
        <CardDescription>
          Evolução de lucro operacional líquido e lucro líquido
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{}} className="h-[320px] w-full">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.light} />
            <XAxis dataKey="month" />
            <YAxis 
              tickFormatter={(value) => `R$ ${(value / 1_000_000).toFixed(1)}M`}
              width={80}
            />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={() => ''}
              contentStyle={{ backgroundColor: '#fff', border: `1px solid ${COLORS.light}` }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="lucroOperacionalLiq" 
              stroke={COLORS.secondary}
              strokeWidth={3}
              dot={{ fill: COLORS.secondary, r: 5 }}
              activeDot={{ r: 7 }}
              name="Lucro Operacional Líquido"
            />
            <Line 
              type="monotone" 
              dataKey="lucroLiquido" 
              stroke={COLORS.accent}
              strokeWidth={3}
              dot={{ fill: COLORS.accent, r: 5 }}
              activeDot={{ r: 7 }}
              name="Lucro Líquido"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ============================================
// 3. GRÁFICO: Área - Margem de Contribuição
// ============================================
export const ContributionMarginChart: React.FC = () => {
  const data = vehiclesSalesData.monthlyData.filter(d => d.month !== '12/25')

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Margem de Contribuição</CardTitle>
        <CardDescription>
          Evolução da margem de contribuição ao longo dos meses
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{}} className="h-[300px] w-full">
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.light} />
            <XAxis dataKey="month" />
            <YAxis 
              tickFormatter={(value) => `R$ ${(value / 1_000_000).toFixed(1)}M`}
              width={80}
            />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={() => ''}
              contentStyle={{ backgroundColor: '#fff', border: `1px solid ${COLORS.light}` }}
            />
            <Area 
              type="monotone" 
              dataKey="margemContrib" 
              fill={COLORS.info}
              stroke={COLORS.secondary}
              strokeWidth={2}
              fillOpacity={0.3}
              name="Margem de Contribuição"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ============================================
// 4. GRÁFICO: Volume de Vendas
// ============================================
export const VolumeChart: React.FC = () => {
  const data = vehiclesSalesData.monthlyData.filter(d => d.month !== '12/25')

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Volume de Vendas</CardTitle>
        <CardDescription>
          Total de {vehiclesSalesData.totals.volume} unidades
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{}} className="h-[300px] w-full">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.light} />
            <XAxis dataKey="month" />
            <YAxis width={50} />
            <Tooltip 
              formatter={(value: number) => value}
              labelFormatter={() => ''}
              contentStyle={{ backgroundColor: '#fff', border: `1px solid ${COLORS.light}` }}
            />
            <Bar 
              dataKey="volume" 
              fill={COLORS.warning}
              radius={[8, 8, 0, 0]}
              name="Volume"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ============================================
// 5. GRÁFICO: Pizza - Composição de Resultados
// ============================================
export const ResultsCompositionChart: React.FC = () => {
  // Montando dados para o gráfico de pizza
  const compositionData = [
    {
      name: 'Lucro Líquido',
      value: vehiclesSalesData.totals.lucroLiquido,
      percentage: vehiclesSalesData.totals.percentualLucroLiq,
    },
    {
      name: 'Lucro Operacional',
      value: vehiclesSalesData.totals.lucroOperacionalLiq,
      percentage: vehiclesSalesData.totals.percentualLucroOpLiq,
    },
  ]

  const CHART_COLORS = [COLORS.success, COLORS.secondary]

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Composição de Resultados</CardTitle>
        <CardDescription>
          Proporção da receita total
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{}} className="h-[300px] w-full">
          <PieChart>
            <Pie
              data={compositionData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {compositionData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{ backgroundColor: '#fff', border: `1px solid ${COLORS.light}` }}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ============================================
// 6. KPI CARDS
// ============================================
export const KPICard: React.FC<{
  title: string
  value: string | number
  description?: string
  trend?: number
  icon?: React.ReactNode
  variant?: 'default' | 'success' | 'danger'
}> = ({ title, value, description, trend, variant = 'default' }) => {
  const bgColor = {
    default: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
    danger: 'bg-red-50 border-red-200',
  }[variant]

  return (
    <Card className={`${bgColor}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">
          {value}
        </div>
        {description && (
          <p className="text-xs text-gray-500 mt-1">
            {description}
          </p>
        )}
        {trend !== undefined && (
          <div className={`text-sm mt-2 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(2)}%
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const KPISection: React.FC = () => {
  const totals = vehiclesSalesData.totals

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="Receita Total"
        value={formatCurrency(totals.receita)}
        description={`${totals.percentualReceita.toFixed(2)}% do total`}
        variant="success"
      />
      <KPICard
        title="Custo Total"
        value={formatCurrency(Math.abs(totals.custo))}
        description={`${Math.abs(totals.percentualCusto).toFixed(2)}% da receita`}
        variant="danger"
      />
      <KPICard
        title="Margem de Contribuição"
        value={formatCurrency(totals.margemContrib)}
        description={`${totals.percentualMargem.toFixed(2)}% da receita`}
        variant="success"
      />
      <KPICard
        title="Lucro Líquido"
        value={formatCurrency(totals.lucroLiquido)}
        description={`${totals.percentualLucroLiq.toFixed(2)}% da receita`}
        variant="success"
      />
    </div>
  )
}

// ============================================
// 7. Tabela de Comparativos Mensais
// ============================================
export const MonthlyComparisonTable: React.FC = () => {
  const data = vehiclesSalesData.monthlyData.filter(d => d.month !== '12/25')

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Análise Mensal Detalhada</CardTitle>
        <CardDescription>
          Métricas operacionais e financeiras por mês
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Mês</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Volume</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Receita</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Custo</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Margem %</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Lucro Op. Liq.</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Lucro Líquido</th>
              </tr>
            </thead>
            <tbody>
              {data.map((month, idx) => (
                <tr 
                  key={month.month}
                  className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                >
                  <td className="py-3 px-4 font-medium text-gray-900">{month.month}</td>
                  <td className="text-right py-3 px-4 text-gray-700">{month.volume}</td>
                  <td className="text-right py-3 px-4 text-gray-700">
                    {formatCurrency(month.receita)}
                  </td>
                  <td className="text-right py-3 px-4 text-red-600">
                    {formatCurrency(month.custo)}
                  </td>
                  <td className="text-right py-3 px-4 font-semibold text-gray-900">
                    {((Math.abs(month.custo) / month.receita) * 100).toFixed(2)}%
                  </td>
                  <td className="text-right py-3 px-4 text-green-600 font-medium">
                    {formatCurrency(month.lucroOperacionalLiq)}
                  </td>
                  <td className="text-right py-3 px-4 text-green-700 font-semibold">
                    {formatCurrency(month.lucroLiquido)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
