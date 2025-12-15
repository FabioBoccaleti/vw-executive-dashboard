import { useMemo } from 'react'
import { Transaction, CATEGORY_LABELS } from '@/lib/types'
import { Card } from '@/components/ui/card'
import * as d3 from 'd3'

interface CategoryChartProps {
  transactions: Transaction[]
}

export function CategoryChart({ transactions }: CategoryChartProps) {
  const categoryData = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === 'expense')
    const categoryTotals = expenses.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {} as Record<string, number>)

    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        label: CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS],
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [transactions])

  const total = categoryData.reduce((sum, d) => sum + d.amount, 0)
  const colorScale = d3.scaleOrdinal(d3.schemeTableau10)

  if (categoryData.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Despesas por Categoria</h3>
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          Sem despesas para exibir
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-6">Top 5 Categorias de Despesas</h3>
      <div className="space-y-4">
        {categoryData.map((data, index) => {
          const percentage = (data.amount / total) * 100
          return (
            <div key={data.category}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colorScale(index.toString()) }}
                  />
                  <span className="text-sm font-medium">{data.label}</span>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  R$ {data.amount.toFixed(2)}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-500 ease-out"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: colorScale(index.toString()),
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {percentage.toFixed(1)}% do total
              </p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
