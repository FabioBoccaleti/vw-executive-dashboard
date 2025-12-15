import { useState, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { Transaction, FinancialGoal } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Wallet, TrendUp, TrendDown, Target } from '@phosphor-icons/react'
import { MetricCard } from '@/components/MetricCard'
import { TransactionDialog } from '@/components/TransactionDialog'
import { TransactionList } from '@/components/TransactionList'
import { CategoryChart } from '@/components/CategoryChart'
import { GoalCard } from '@/components/GoalCard'
import { GoalDialog } from '@/components/GoalDialog'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'

function App() {
  const [transactions, setTransactions] = useKV<Transaction[]>('transactions', [])
  const [goals, setGoals] = useKV<FinancialGoal[]>('financial-goals', [])
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>()

  const metrics = useMemo(() => {
    const totalIncome = (transactions || [])
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)

    const totalExpenses = (transactions || [])
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)

    const balance = totalIncome - totalExpenses

    return { totalIncome, totalExpenses, balance }
  }, [transactions])

  const sortedTransactions = useMemo(() => {
    return [...(transactions || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [transactions])

  const handleSaveTransaction = (transactionData: Omit<Transaction, 'id' | 'createdAt'>) => {
    if (editingTransaction) {
      setTransactions((current) =>
        (current || []).map((t) =>
          t.id === editingTransaction.id
            ? { ...transactionData, id: t.id, createdAt: t.createdAt }
            : t
        )
      )
      setEditingTransaction(undefined)
    } else {
      const newTransaction: Transaction = {
        ...transactionData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      setTransactions((current) => [...(current || []), newTransaction])
    }
  }

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setTransactionDialogOpen(true)
  }

  const handleDeleteTransaction = (id: string) => {
    setTransactions((current) => (current || []).filter((t) => t.id !== id))
    toast.success('Transação excluída')
  }

  const handleSaveGoal = (goalData: Omit<FinancialGoal, 'id' | 'createdAt'>) => {
    const newGoal: FinancialGoal = {
      ...goalData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    setGoals((current) => [...(current || []), newGoal])
  }

  const handleDeleteGoal = (id: string) => {
    setGoals((current) => (current || []).filter((g) => g.id !== id))
    toast.success('Meta excluída')
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Gestão Financeira Sorana
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas finanças pessoais com facilidade
          </p>
        </header>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="transactions">Transações</TabsTrigger>
            <TabsTrigger value="goals">Metas</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                title="Saldo Atual"
                value={`R$ ${metrics.balance.toFixed(2)}`}
                icon={Wallet}
              />
              <MetricCard
                title="Receitas"
                value={`R$ ${metrics.totalIncome.toFixed(2)}`}
                icon={TrendUp}
                className="border-l-4 border-l-success"
              />
              <MetricCard
                title="Despesas"
                value={`R$ ${metrics.totalExpenses.toFixed(2)}`}
                icon={TrendDown}
                className="border-l-4 border-l-destructive"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <CategoryChart transactions={transactions || []} />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Transações Recentes</h3>
                  <Button
                    onClick={() => {
                      setEditingTransaction(undefined)
                      setTransactionDialogOpen(true)
                    }}
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
                {sortedTransactions.length > 0 ? (
                  <TransactionList
                    transactions={sortedTransactions.slice(0, 5)}
                    onEdit={handleEditTransaction}
                    onDelete={handleDeleteTransaction}
                  />
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-12 text-center">
                    <p className="text-muted-foreground mb-4">
                      Nenhuma transação registrada ainda
                    </p>
                    <Button
                      onClick={() => {
                        setEditingTransaction(undefined)
                        setTransactionDialogOpen(true)
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Primeira Transação
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Todas as Transações</h2>
              <Button
                onClick={() => {
                  setEditingTransaction(undefined)
                  setTransactionDialogOpen(true)
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Transação
              </Button>
            </div>
            <TransactionList
              transactions={sortedTransactions}
              onEdit={handleEditTransaction}
              onDelete={handleDeleteTransaction}
            />
          </TabsContent>

          <TabsContent value="goals" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Metas Financeiras</h2>
              <Button onClick={() => setGoalDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Meta
              </Button>
            </div>
            {(goals || []).length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {(goals || []).map((goal) => (
                  <GoalCard key={goal.id} goal={goal} onDelete={handleDeleteGoal} />
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-12 text-center">
                <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Nenhuma meta financeira criada ainda
                </p>
                <Button onClick={() => setGoalDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Meta
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <TransactionDialog
        open={transactionDialogOpen}
        onOpenChange={(open) => {
          setTransactionDialogOpen(open)
          if (!open) setEditingTransaction(undefined)
        }}
        onSave={handleSaveTransaction}
        editTransaction={editingTransaction}
      />

      <GoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        onSave={handleSaveGoal}
      />

      <Toaster />
    </div>
  )
}

export default App