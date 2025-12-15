import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Transaction, TransactionType, CATEGORY_LABELS, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/lib/types'
import { toast } from 'sonner'

interface TransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void
  editTransaction?: Transaction
}

export function TransactionDialog({ open, onOpenChange, onSave, editTransaction }: TransactionDialogProps) {
  const [type, setType] = useState<TransactionType>(editTransaction?.type || 'expense')
  const [amount, setAmount] = useState(editTransaction?.amount.toString() || '')
  const [category, setCategory] = useState(editTransaction?.category || '')
  const [description, setDescription] = useState(editTransaction?.description || '')
  const [date, setDate] = useState(editTransaction?.date || new Date().toISOString().split('T')[0])

  const availableCategories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!amount || !category || !description || !date) {
      toast.error('Por favor, preencha todos os campos')
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Por favor, insira um valor válido')
      return
    }

    onSave({
      type,
      amount: amountNum,
      category: category as any,
      description,
      date,
    })

    setAmount('')
    setCategory('')
    setDescription('')
    setDate(new Date().toISOString().split('T')[0])
    onOpenChange(false)
    toast.success(editTransaction ? 'Transação atualizada' : 'Transação adicionada')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editTransaction ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select value={type} onValueChange={(val) => {
              setType(val as TransactionType)
              setCategory('')
            }}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Supermercado, Aluguel..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {editTransaction ? 'Atualizar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
