import { Card } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
}

export function MetricCard({ title, value, icon: Icon, trend, className }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`p-6 ${className}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-2">
              {title}
            </p>
            <motion.p
              className="text-3xl font-semibold tabular-nums"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {value}
            </motion.p>
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <span
                  className={`text-sm font-medium ${
                    trend.isPositive ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                </span>
                <span className="text-xs text-muted-foreground">vs último mês</span>
              </div>
            )}
          </div>
          <div className="p-3 bg-primary/10 rounded-lg">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
