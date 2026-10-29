import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface Props {
  /** Descrição do conjunto a remover (ex.: "o inventário de Outubro de 2026"). */
  alvo: string;
  onConfirm: () => Promise<void> | void;
}

export function RemoverDadosButton({ alvo, onConfirm }: Props) {
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleConfirm = async () => {
    setRemoving(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-red-600 border border-red-300 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Remover dados
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover dados importados?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação vai apagar {alvo}. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirm(); }}
              disabled={removing}
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
            >
              {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
