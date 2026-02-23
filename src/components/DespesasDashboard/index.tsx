/**
 * Dashboard de Sistema de Gerenciamento e Aprovação de Despesas
 */

import { useState, useEffect } from 'react';
import { DespesasLayout, type MenuItem } from './Layout';
import { DashboardHome } from './DashboardHome';
import { TodasDespesas } from './TodasDespesas';
import { NovaDespesa } from './NovaDespesa';
import { PorDepartamento } from './PorDepartamento';

interface DespesasDashboardProps {
  onChangeBrand?: () => void;
}

export function DespesasDashboard({ onChangeBrand }: DespesasDashboardProps) {
  const [currentPage, setCurrentPage] = useState<MenuItem>('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardHome />;
      case 'todas-despesas':
        return <TodasDespesas />;
      case 'nova-despesa':
        return <NovaDespesa onSuccess={() => setCurrentPage('todas-despesas')} />;
      case 'departamento':
        return <PorDepartamento />;
      case 'integracao':
      case 'relatorios':
      case 'configuracoes':
        return (
          <div className="p-6">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Em Desenvolvimento
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                Esta funcionalidade será implementada em breve.
              </p>
            </div>
          </div>
        );
      default:
        return <DashboardHome />;
    }
  };

  return (
    <DespesasLayout
      currentPage={currentPage}
      onPageChange={setCurrentPage}
      onChangeBrand={onChangeBrand}
    >
      {renderPage()}
    </DespesasLayout>
  );
}
