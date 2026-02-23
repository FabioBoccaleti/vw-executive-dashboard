/**
 * Tela de Todas as Despesas
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Eye,
} from 'lucide-react';
import { loadDespesas, deleteDespesa, aprovarDespesa, rejeitarDespesa } from '@/lib/despesasStorage';
import type { Despesa } from '@/data/despesasData';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function TodasDespesas() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [filteredDespesas, setFilteredDespesas] = useState<Despesa[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [departamentoFilter, setDepartamentoFilter] = useState<string>('todos');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterDespesas();
  }, [searchTerm, statusFilter, departamentoFilter, despesas]);

  const loadData = () => {
    const data = loadDespesas();
    setDespesas(data);
  };

  const filterDespesas = () => {
    let filtered = [...despesas];

    // Filtro de busca
    if (searchTerm) {
      filtered = filtered.filter(
        (d) =>
          d.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.solicitante.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.departamento.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro de status
    if (statusFilter !== 'todos') {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }

    // Filtro de departamento
    if (departamentoFilter !== 'todos') {
      filtered = filtered.filter((d) => d.departamento === departamentoFilter);
    }

    setFilteredDespesas(filtered);
  };

  const handleAprovar = (id: string) => {
    aprovarDespesa(id, 'Fabio Boccaleti');
    loadData();
    toast.success('Despesa aprovada com sucesso!');
  };

  const handleRejeitar = (id: string) => {
    rejeitarDespesa(id, 'Fabio Boccaleti', 'Rejeitado pelo sistema');
    loadData();
    toast.success('Despesa rejeitada');
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteDespesa(deleteId);
      loadData();
      toast.success('Despesa excluída');
      setDeleteId(null);
    }
  };

  const getStatusBadge = (status: Despesa['status']) => {
    const variants = {
      pendente: { className: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Pendente' },
      aguardando: { className: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Aguardando' },
      aprovado: { className: 'bg-green-100 text-green-700 border-green-300', label: 'Aprovado' },
      reprovado: { className: 'bg-red-100 text-red-700 border-red-300', label: 'Reprovado' },
    };

    const variant = variants[status] || variants.pendente;

    return (
      <Badge variant="outline" className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  const departamentos = Array.from(new Set(despesas.map((d) => d.departamento))).sort();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="w-8 h-8" />
          Todas as Despesas
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Visualize e gerencie todas as solicitações de despesa
        </p>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Busca */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Título, solicitante..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="reprovado">Reprovado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Departamento */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Departamento
              </label>
              <Select value={departamentoFilter} onValueChange={setDepartamentoFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {departamentos.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>
              Mostrando {filteredDespesas.length} de {despesas.length} despesas
            </span>
            {(searchTerm || statusFilter !== 'todos' || departamentoFilter !== 'todos') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('todos');
                  setDepartamentoFilter('todos');
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    NF
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Despesa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Solicitante
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Departamento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredDespesas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      Nenhuma despesa encontrada
                    </td>
                  </tr>
                ) : (
                  filteredDespesas.map((despesa) => (
                    <tr
                      key={despesa.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-4">
                        {despesa.imagemNotaFiscal ? (
                          despesa.imagemNotaFiscal.startsWith('data:application/pdf') ? (
                            <div className="relative w-16 h-16 rounded border-2 border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer hover:border-emerald-500 transition-colors"
                              onClick={() => window.open(despesa.imagemNotaFiscal, '_blank')}
                              title="Clique para abrir PDF">
                              <iframe
                                src={despesa.imagemNotaFiscal}
                                className="w-full h-full pointer-events-none scale-150 origin-top-left"
                                title="Preview PDF"
                              />
                            </div>
                          ) : (
                            <img
                              src={despesa.imagemNotaFiscal}
                              alt="NF"
                              className="w-16 h-16 object-cover rounded border-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:border-emerald-500 transition-colors"
                              onClick={() => window.open(despesa.imagemNotaFiscal, '_blank')}
                              title="Clique para ampliar"
                            />
                          )
                        ) : (
                          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
                            <span className="text-xs text-slate-400">Sem NF</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {despesa.titulo}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {despesa.categoria}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                        {despesa.solicitante}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                        {despesa.departamento}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          R$ {despesa.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                        {new Date(despesa.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-4">{getStatusBadge(despesa.status)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {despesa.status === 'pendente' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleAprovar(despesa.id)}
                                title="Aprovar"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleRejeitar(despesa.id)}
                                title="Rejeitar"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-600 hover:text-slate-700 hover:bg-slate-100"
                            onClick={() => handleDelete(despesa.id)}
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
