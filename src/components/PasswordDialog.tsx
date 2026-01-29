import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, AlertCircle } from "lucide-react";

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

const CORRECT_PASSWORD = "1985";

export function PasswordDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  title = "Autorização Necessária",
  description = "Esta ação requer autorização. Digite a senha para prosseguir:"
}: PasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === CORRECT_PASSWORD) {
      setError(false);
      setPassword("");
      onOpenChange(false);
      onSuccess();
    } else {
      setError(true);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setPassword("");
    }
  };

  const handleClose = () => {
    setPassword("");
    setError(false);
    setIsShaking(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
              <Lock className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className={`transition-all duration-200 ${isShaking ? 'animate-shake' : ''}`}>
            <Input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              placeholder="Digite a senha"
              className={`text-center text-lg tracking-widest ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              autoFocus
            />
            {error && (
              <div className="flex items-center gap-2 mt-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>Senha incorreta. Tente novamente.</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirmar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
