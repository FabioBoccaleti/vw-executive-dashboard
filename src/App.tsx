import { Toaster } from '@/components/ui/sonner'
import { VWFinancialDashboard } from '@/components/VWFinancialDashboard'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <VWFinancialDashboard />
      <Toaster />
    </div>
  )
}

export default App
