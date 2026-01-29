/**
 * Componente exibido quando não há dados importados no sistema
 * 
 * Mostra uma mensagem amigável pedindo para o usuário importar dados
 * e fornece um botão para abrir o diálogo de importação.
 */

import { FileUp, CloudOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface NoDataPlaceholderProps {
  /** Callback para abrir o diálogo de importação */
  onImportClick: () => void
  /** Se está carregando dados */
  isLoading?: boolean
  /** Se a API está disponível */
  isApiAvailable?: boolean
  /** Callback para tentar recarregar */
  onRetry?: () => void
  /** Mensagem de erro, se houver */
  error?: string | null
}

export function NoDataPlaceholder({
  onImportClick,
  isLoading = false,
  isApiAvailable = true,
  onRetry,
  error
}: NoDataPlaceholderProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-12 w-12 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    )
  }

  if (!isApiAvailable) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 bg-destructive/10 rounded-full w-fit">
              <CloudOff className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-xl">Serviço Indisponível</CardTitle>
            <CardDescription>
              Não foi possível conectar ao servidor de dados
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Alert variant="destructive">
              <AlertTitle>Erro de Conexão</AlertTitle>
              <AlertDescription>
                O serviço de banco de dados está temporariamente indisponível. 
                Por favor, tente novamente em alguns instantes.
              </AlertDescription>
            </Alert>
            {onRetry && (
              <Button onClick={onRetry} variant="outline" className="mt-4">
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar Novamente
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 bg-destructive/10 rounded-full w-fit">
              <CloudOff className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-xl">Erro ao Carregar Dados</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            {onRetry && (
              <Button onClick={onRetry} variant="outline" className="mt-4">
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar Novamente
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-fit">
            <FileUp className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Nenhum dado encontrado</CardTitle>
          <CardDescription className="text-base mt-2">
            Para visualizar o dashboard, você precisa importar os dados financeiros.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
            <p className="mb-2">
              <strong>Como funciona:</strong>
            </p>
            <ol className="text-left list-decimal list-inside space-y-1">
              <li>Clique no botão abaixo para abrir o menu de configurações</li>
              <li>Selecione "Importar Dados" ou arraste um arquivo JSON</li>
              <li>Os dados serão salvos e compartilhados com todos os usuários</li>
            </ol>
          </div>
          
          <Button onClick={onImportClick} size="lg" className="w-full sm:w-auto">
            <FileUp className="mr-2 h-5 w-5" />
            Importar Dados
          </Button>
          
          <p className="text-xs text-muted-foreground">
            Os dados importados ficam salvos na nuvem e são automaticamente 
            compartilhados com todos os usuários que acessam este dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
