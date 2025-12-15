import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FinancialGoal } from '@/lib/types'
import { toast } from 'sonner'

interface GoalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (goal: Omit<FinancialGoal, 'id' | 'createdAt'>) => void
}

export function GoalDialog({ open, onOpenChange, onSave }: GoalDialogProps) {
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [currentAmount, setCurrentAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name || !targetAmount || !currentAmount || !targetDate) {
      toast.error('Por favor, preencha todos os campos')
      return
    }

    const target = parseFloat(targetAmount)
    const current = parseFloat(currentAmount)

    if (isNaN(target) || target <= 0) {
      toast.error('Por favor, insira um valor de meta válido')
      return
    }

    if (isNaN(current) || current < 0) {
      toast.error('Por favor, insira um valor inicial válido')
      return
    }

    onSave({
      name,
      targetAmount: target,
      currentAmount: current,
      targetDate,
    })

    setName('')
    setTargetAmount('')
    setCurrentAmount('')
    setTargetDate('')
    onOpenChange(false)
    toast.success('Meta criada com sucesso')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Meta Financeira</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="goal-name">Nome da Meta</Label>
            <Input
              id="goal-name"
              placeholder="Ex: Viagem, Reserva de emergência..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-amount">Valor da Meta (R$)</Label>
            <Input
              id="target-amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="current-amount">Valor Atual (R$)</Label>
            <Input
              id="current-amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={currentAmount}
              onChange={(e) => setCurrentAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-date">Data Alvo</Label>
            <Input
              id="target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Criar Meta</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
