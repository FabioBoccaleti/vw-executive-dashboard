import { useMemo } from 'react';
import { ComparativoPeriodo } from '@/components/DespesasDeptoComparativo/ComparativoPeriodoView';
import type { ComparativoStorageAdapter } from '@/components/DespesasDeptoComparativo/comparativoPeriodo';
import {
  getDespesasAdmMes,
  loadClassificacoes,
  loadRegrasDeptos,
  extractByDeptoRule,
  extractByDeptoRuleAll,
  applyAllMerges,
  getImportedMonths,
} from './despesasDeptoAudiStorage';

// year/month mantidos por compatibilidade com o index; o comparativo seleciona
// automaticamente o mês mais recente com dados.
interface ComparativosTabProps {
  year?: number;
  month?: number;
}

export function ComparativosTab(_props: ComparativosTabProps) {
  const adapter = useMemo<ComparativoStorageAdapter>(() => ({
    getDespesasAdmMes,
    loadClassificacoes,
    loadRegrasDeptos,
    extractByDeptoRule,
    extractByDeptoRuleAll,
    applyAllMerges,
    getImportedMonths,
  }), []);

  return <ComparativoPeriodo adapter={adapter} accent="#bb0a30" />;
}
