/**
 * Dashboard Home - Página Principal
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  User,
  Calendar,
  Building2,
  Tag,
  X,
} from 'lucide-react';
import { type Despesa } from '@/data/despesasData';
import { loadDespesas, aprovarDespesa, rejeitarDespesa } from '@/lib/despesasStorage';
import { toast } from 'sonner';

export function DashboardHome() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedImageTitle, setSelectedImageTitle] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    
    // Atualização automática a cada 5 segundos para sincronizar com outros usuários
    const interval = setInterval(() => {
      loadData(true);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadData = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const data = await loadDespesas();
      setDespesas(data);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  const handleAprovar = async (id: string) => {
    try {
      await aprovarDespesa(id, 'Fabio Boccaleti');
      await loadData();
      toast.success('Despesa aprovada! Sincronizando com outros usuários...');
    } catch (error) {
      toast.error('Erro ao aprovar despesa');
      console.error(error);
    }
  };

  const handleRejeitar = async (id: string) => {
    try {
      await rejeitarDespesa(id, 'Fabio Boccaleti');
      await loadData();
      toast.success('Despesa rejeitada! Sincronizando com outros usuários...');
    } catch (error) {
      toast.error('Erro ao rejeitar despesa');
      console.error(error);
    }
  };

  const despesasPendentes = despesas.filter((d) => d.status === 'pendente');
  
  // Calcular estatísticas
  const aguardando = despesas.filter(d => d.status === 'aguardando' || d.status === 'pendente');
  const aprovados = despesas.filter(d => d.status === 'aprovado');
  const reprovados = despesas.filter(d => d.status === 'reprovado');
  
  const estatisticas = {
    aguardando: {
      quantidade: aguardando.length,
      valor: aguardando.reduce((sum, d) => sum + d.valor, 0),
    },
    aprovado: {
      quantidade: aprovados.length,
      valor: aprovados.reduce((sum, d) => sum + d.valor, 0),
    },
    reprovado: {
      quantidade: reprovados.length,
      valor: reprovados.reduce((sum, d) => sum + d.valor, 0),
    },
    total: {
      quantidade: despesas.length,
      valor: despesas.reduce((sum, d) => sum + d.valor, 0),
    },
  };

  // Calcular despesas por marca
  const despesasPorMarcaMap = despesas.reduce((acc, d) => {
    acc[d.marca] = (acc[d.marca] || 0) + d.valor;
    return acc;
  }, {} as Record<string, number>);
  
  const despesasPorMarca = Object.entries(despesasPorMarcaMap)
    .map(([marca, valor]) => ({ marca, valor }))
    .sort((a, b) => b.valor - a.valor);

  // Calcular despesas por categoria
  const despesasPorCategoriaMap = despesas.reduce((acc, d) => {
    acc[d.categoria] = (acc[d.categoria] || 0) + d.valor;
    return acc;
  }, {} as Record<string, number>);
  
  const despesasPorCategoria = Object.entries(despesasPorCategoriaMap)
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);

  // Calcular despesas por departamento
  const despesasPorDepartamentoMap = despesas.reduce((acc, d) => {
    acc[d.departamento] = (acc[d.departamento] || 0) + d.valor;
    return acc;
  }, {} as Record<string, number>);
  
  const despesasPorDepartamento = Object.entries(despesasPorDepartamentoMap)
    .map(([departamento, valor]) => ({ departamento, valor }))
    .sort((a, b) => b.valor - a.valor);

  // Gerar atividades recentes (últimas 5 despesas aprovadas/reprovadas)
  const atividadesRecentes = despesas
    .filter(d => d.status === 'aprovado' || d.status === 'reprovado')
    .sort((a, b) => {
      const dataA = new Date(a.dataAprovacao || a.data);
      const dataB = new Date(b.dataAprovacao || b.data);
      return dataB.getTime() - dataA.getTime();
    })
    .slice(0, 5)
    .map(d => ({
      id: d.id,
      tipo: d.status as 'aprovado' | 'reprovado',
      titulo: d.status === 'aprovado' ? 'Despesa aprovada' : 'Despesa reprovada',
      solicitante: d.solicitante,
      departamento: `${d.departamento} - ${d.categoria}`,
      valor: d.valor,
      data: d.dataAprovacao ? new Date(d.dataAprovacao).toLocaleDateString('pt-BR') : new Date(d.data).toLocaleDateString('pt-BR'),
    }));

  return (
    <div className="p-6 space-y-6">
      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Aguardando */}
        <Card className="border-l-4 border-amber-500">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Aguardando Aprovação
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  {estatisticas.aguardando.quantidade}
                </p>
                <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                  R$ {estatisticas.aguardando.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full">
                <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aprovado */}
        <Card className="border-l-4 border-green-500">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Aprovado - MÊS</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  {estatisticas.aprovado.quantidade}
                </p>
                <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                  R$ {estatisticas.aprovado.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reprovado */}
        <Card className="border-l-4 border-red-500">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Reprovado - MÊS</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  {estatisticas.reprovado.quantidade}
                </p>
                <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                  R$ {estatisticas.reprovado.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total do Mês */}
        <Card className="border-l-4 border-slate-500">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total do Mês</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  {estatisticas.total.quantidade}
                </p>
                <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                  R$ {estatisticas.total.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-full">
                <DollarSign className="w-8 h-8 text-slate-600 dark:text-slate-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Despesas por Marca */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Despesas por Marca
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {despesasPorMarca.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Nenhum dado disponível</p>
              ) : (
                despesasPorMarca.map((item) => {
                const maxValor = Math.max(...despesasPorMarca.map((d) => d.valor));
                const porcentagem = (item.valor / maxValor) * 100;
                
                let barColor = 'bg-blue-600';
                if (item.marca.includes('Audi')) barColor = 'bg-red-500';

                return (
                  <div key={item.marca}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {item.marca}
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                      <div
                        className={`${barColor} h-2.5 rounded-full transition-all duration-500`}
                        style={{ width: `${porcentagem}%` }}
                      />
                    </div>
                  </div>
                );
              })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Despesas por Categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {despesasPorCategoria.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Nenhum dado disponível</p>
              ) : (
                despesasPorCategoria.map((item) => {
                const maxValor = Math.max(...despesasPorCategoria.map((d) => d.valor));
                const porcentagem = (item.valor / maxValor) * 100;

                return (
                  <div key={item.categoria}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {item.categoria}
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                      <div
                        className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${porcentagem}%` }}
                      />
                    </div>
                  </div>
                );
              })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabelas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por Departamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Por Departamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {despesasPorDepartamento.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Nenhum dado disponível</p>
              ) : (
                despesasPorDepartamento.map((item) => (
                <div
                  key={item.departamento}
                  className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700 last:border-0"
                >
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {item.departamento}
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    R$ {item.valor.toLocaleString('pt-BR')}
                  </span>
                </div>
              ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Atividade Recente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {atividadesRecentes.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Nenhuma atividade recente</p>
              ) : (
                atividadesRecentes.map((atividade) => (
                <div key={atividade.id} className="flex gap-3">
                  <div className="flex-shrink-0">
                    {atividade.tipo === 'aprovado' && (
                      <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                    )}
                    {atividade.tipo === 'reprovado' && (
                      <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </div>
                    )}
                    {atividade.tipo === 'submetido' && (
                      <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {atividade.titulo}
                      {atividade.tipo === 'aprovado' && (
                        <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-300">
                          Aprovado
                        </Badge>
                      )}
                      {atividade.tipo === 'reprovado' && (
                        <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-300">
                          Recusado
                        </Badge>
                      )}
                      {atividade.tipo === 'submetido' && (
                        <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-300">
                          Novo
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {atividade.solicitante} - {atividade.departamento}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500">R$ {atividade.valor.toLocaleString('pt-BR')}</span>
                      <span className="text-xs text-slate-500">{atividade.data}</span>
                    </div>
                  </div>
                </div>
              ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Despesas Pendentes de Aprovação */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Despesas Pendentes de Aprovação
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  console.log('Teste: Abrindo dialog com imagem de teste');
                  setSelectedImage('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'300\'%3E%3Crect fill=\'%2334D399\' width=\'400\' height=\'300\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' font-family=\'Arial\' font-size=\'24\' fill=\'white\'%3EImagem de Teste%3C/text%3E%3C/svg%3E');
                  setSelectedImageTitle('Teste de Dialog');
                  setImageDialogOpen(true);
                }}
                className="text-xs"
              >
                Testar Dialog
              </Button>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {despesasPendentes.length} pendente{despesasPendentes.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {despesasPendentes.map((despesa) => (
              <div
                key={despesa.id}
                className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Imagem/PDF da Nota Fiscal */}
                  {despesa.imagemNotaFiscal && (
                    <div className="flex-shrink-0 w-32 h-32">
                      {despesa.imagemNotaFiscal.startsWith('data:application/pdf') ? (
                        <div className="relative w-full h-full rounded-lg border-2 border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer hover:border-emerald-500 transition-colors"
                          onClick={() => {
                            console.log('Clicou na imagem PDF:', despesa.titulo);
                            console.log('URL da imagem:', despesa.imagemNotaFiscal.substring(0, 50) + '...');
                            setSelectedImage(despesa.imagemNotaFiscal);
                            setSelectedImageTitle(despesa.titulo);
                            setImageDialogOpen(true);
                            console.log('Dialog aberto:', true);
                          }}
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
                          alt="Nota Fiscal"
                          className="w-full h-full object-cover rounded-lg border-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:border-emerald-500 transition-colors"
                          onClick={() => {
                            console.log('Clicou na imagem:', despesa.titulo);
                            console.log('URL da imagem:', despesa.imagemNotaFiscal.substring(0, 50) + '...');
                            setSelectedImage(despesa.imagemNotaFiscal);
                            setSelectedImageTitle(despesa.titulo);
                            setImageDialogOpen(true);
                            console.log('Dialog aberto:', true);
                          }}
                          title="Clique para ampliar"
                          onError={(e) => console.error('Erro ao carregar imagem:', e)}
                        />
                      )}
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-full flex-shrink-0">
                        <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
                          {despesa.titulo}
                          <Badge
                            variant="outline"
                            className="ml-2 bg-amber-50 text-amber-700 border-amber-300"
                          >
                            Pendente
                          </Badge>
                        </h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400 mt-2">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {despesa.solicitante}
                          </div>
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {despesa.departamento}
                          </div>
                          <div className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {despesa.categoria}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(despesa.data).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        {despesa.descricao && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                            {despesa.descricao}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-xl font-bold text-slate-900 dark:text-white">
                      R$ {despesa.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleAprovar(despesa.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRejeitar(despesa.id)}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {despesasPendentes.length === 0 && (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                Nenhuma despesa pendente de aprovação
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog para visualizar imagem */}
      {imageDialogOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => {
            console.log('Clicou no overlay - fechando dialog');
            setImageDialogOpen(false);
          }}
        >
          <div 
            className="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {selectedImageTitle || 'Visualizar Imagem'}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  console.log('Clicou no botão fechar');
                  setImageDialogOpen(false);
                }}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Conteúdo */}
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              {selectedImage ? (
                selectedImage.startsWith('data:application/pdf') ? (
                  <iframe
                    src={selectedImage}
                    className="w-full h-[70vh] border-0 rounded"
                    title="Visualização PDF"
                    onLoad={() => console.log('PDF carregado com sucesso')}
                    onError={(e) => {
                      console.error('Erro ao carregar PDF:', e);
                      alert('Erro ao carregar PDF. Verifique o console.');
                    }}
                  />
                ) : (
                  <img
                    src={selectedImage}
                    alt={selectedImageTitle}
                    className="w-full h-auto rounded-lg"
                    onLoad={() => console.log('Imagem carregada com sucesso')}
                    onError={(e) => {
                      console.error('Erro ao carregar imagem:', e);
                      alert('Erro ao carregar imagem. Verifique o console.');
                    }}
                  />
                )
              ) : (
                <div className="text-center py-12 text-slate-500">
                  Nenhuma imagem selecionada
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
