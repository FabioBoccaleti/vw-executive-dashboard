import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Upload, BarChart3, TrendingUp, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadScreenProps {
  dragOver: boolean;
  loading: boolean;
  error: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  processFile: (file: File | undefined) => void;
}

export function UploadScreen({
  dragOver,
  loading,
  error,
  fileRef,
  onDrop,
  onDragOver,
  onDragLeave,
  processFile
}: UploadScreenProps) {
  return (
    <div className="max-w-4xl mx-auto py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
          Análise de Balancete 
          <span className="block mt-2 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            em segundos
          </span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Importe seu arquivo de balancete (.txt ou .csv) e obtenha análise completa do ativo, passivo, resultado e geração de caixa automaticamente.
        </p>
      </div>

      <Card
        className={cn(
          "border-2 border-dashed cursor-pointer transition-all",
          dragOver
            ? "border-green-500 bg-green-50 dark:bg-green-950/20"
            : "border-muted-foreground/25 hover:border-green-500/50 hover:bg-muted/50"
        )}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-16 px-8">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv"
            className="hidden"
            onChange={e => processFile(e.target.files?.[0])}
          />
          
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mb-6">
            <Upload className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>

          <h3 className="text-xl font-bold text-foreground mb-2">
            {dragOver ? 'Solte o arquivo aqui' : 'Arraste seu Balancete'}
          </h3>
          
          <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
            Formato suportado: arquivo .txt ou .csv com campos separados por ponto-e-vírgula (;)
            <br />
            <span className="font-mono text-xs">Nível; Conta; Descrição; Saldo Anterior; Déb; Créd; Saldo Atual</span>
          </p>

          <Button className="bg-green-600 hover:bg-green-700">
            <FileText className="w-4 h-4 mr-2" />
            Selecionar Arquivo
          </Button>

          {loading && (
            <div className="mt-6 flex items-center gap-2 text-green-600 dark:text-green-400">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
              <span className="text-sm font-medium">Processando arquivo...</span>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                ⚠️ {error}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        {[
          { icon: BarChart3, label: 'Ativo e Passivo', color: 'text-blue-600 dark:text-blue-400' },
          { icon: TrendingUp, label: 'DRE do Período', color: 'text-emerald-600 dark:text-emerald-400' },
          { icon: DollarSign, label: 'Fluxo de Caixa', color: 'text-amber-600 dark:text-amber-400' }
        ].map((feature, i) => {
          const Icon = feature.icon;
          return (
            <Card key={i} className="bg-muted/50">
              <CardContent className="flex flex-col items-center py-6">
                <Icon className={cn("w-8 h-8 mb-3", feature.color)} />
                <span className="text-sm font-medium text-muted-foreground">{feature.label}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
