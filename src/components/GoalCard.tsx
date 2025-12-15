import { FinancialGoal } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Trash, Target } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface GoalCardProps {
  goal: FinancialGoal
  onDelete: (id: string) => void
}

export function GoalCard({ goal, onDelete }: GoalCardProps) {
  const progress = (goal.currentAmount / goal.targetAmount) * 100
  const isComplete = progress >= 100
  const remaining = goal.targetAmount - goal.currentAmount

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isComplete ? 'bg-success/10' : 'bg-primary/10'}`}>
            <Target className={`w-5 h-5 ${isComplete ? 'text-success' : 'text-primary'}`} />
          </div>
          <div>
            <h3 className="font-semibold">{goal.name}</h3>
            <p className="text-sm text-muted-foreground">
              Meta até {format(new Date(goal.targetDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(goal.id)}
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <Trash className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <Progress value={Math.min(progress, 100)} className="h-3" />
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium tabular-nums">
            R$ {goal.currentAmount.toFixed(2)} de R$ {goal.targetAmount.toFixed(2)}
          </span>
          <span className={`font-semibold ${isComplete ? 'text-success' : 'text-primary'}`}>
            {Math.min(progress, 100).toFixed(0)}%
          </span>
        </div>
        {!isComplete && (
          <p className="text-xs text-muted-foreground">
            Faltam R$ {remaining.toFixed(2)} para atingir sua meta
          </p>
        )}
        {isComplete && (
          <p className="text-xs text-success font-medium">
            🎉 Meta atingida! Parabéns!
          </p>
        )}
      </div>
    </Card>
  )
}
