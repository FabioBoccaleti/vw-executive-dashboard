import { Transaction, CATEGORY_LABELS } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Trash } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface TransactionListProps {
  transactions: Transaction[]
  onEdit: (transaction: Transaction) => void
  onDelete: (id: string) => void
}

export function TransactionList({ transactions, onEdit, onDelete }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">Nenhuma transação encontrada</p>
        <p className="text-sm text-muted-foreground mt-2">Adicione sua primeira transação para começar</p>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {transactions.map((transaction) => (
        <Card
          key={transaction.id}
          className="p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={transaction.type === 'income' ? 'default' : 'secondary'}>
                  {CATEGORY_LABELS[transaction.category]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(transaction.date), "dd 'de' MMMM", { locale: ptBR })}
                </span>
              </div>
              <p className="text-sm font-medium truncate">{transaction.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <p
                className={`text-lg font-semibold tabular-nums ${
                  transaction.type === 'income' ? 'text-success' : 'text-foreground'
                }`}
              >
                {transaction.type === 'income' ? '+' : '-'} R$ {transaction.amount.toFixed(2)}
              </p>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onEdit(transaction)}
                  className="h-8 w-8"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete(transaction.id)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
