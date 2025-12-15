export type TransactionType = 'income' | 'expense'

export type TransactionCategory = 
  | 'salary'
  | 'freelance'
  | 'investment'
  | 'other-income'
  | 'food'
  | 'transport'
  | 'housing'
  | 'utilities'
  | 'entertainment'
  | 'healthcare'
  | 'shopping'
  | 'education'
  | 'other-expense'

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  category: TransactionCategory
  description: string
  date: string
  createdAt: string
}

export interface Budget {
  category: TransactionCategory
  limit: number
  spent: number
}

export interface FinancialGoal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate: string
  createdAt: string
}

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  salary: 'Salário',
  freelance: 'Freelance',
  investment: 'Investimento',
  'other-income': 'Outra Receita',
  food: 'Alimentação',
  transport: 'Transporte',
  housing: 'Habitação',
  utilities: 'Contas',
  entertainment: 'Entretenimento',
  healthcare: 'Saúde',
  shopping: 'Compras',
  education: 'Educação',
  'other-expense': 'Outra Despesa',
}

export const INCOME_CATEGORIES: TransactionCategory[] = [
  'salary',
  'freelance',
  'investment',
  'other-income',
]

export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'food',
  'transport',
  'housing',
  'utilities',
  'entertainment',
  'healthcare',
  'shopping',
  'education',
  'other-expense',
]
