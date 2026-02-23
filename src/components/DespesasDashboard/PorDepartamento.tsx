/**
 * Análise de Despesas por Departamento
 * Visão multidimensional: Marca × Departamento × Tipo de Despesa
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  AlertCircle,
} from 'lucide-react';
import { loadDespesas } from '@/lib/despesasStorage';
import type { Despesa } from '@/data/despesasData';
import { Badge } from '@/components/ui/badge';

interface DepartamentoStats {
  departamento: string;
  total: number;
  aprovadas: number;
  pendentes: number;
  rejeitadas: number;
  porMarca: Record<string, number>;
  porCategoria: Record<string, number>;
}

export function PorDepartamento() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [marcaFilter, setMarcaFilter] = useState<string>('todas');
  const [anoFilter, setAnoFilter] = useState<string>('2026');
  const [mesFilter, setMesFilter] = useState<string>('todos');
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    
    // Atualização automática a cada 5 segundos
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    const data = await loadDespesas();
    setDespesas(data);
  };

  // Filtrar despesas por marca e período
  const despesasFiltradas = useMemo(() => {
    let filtered = [...despesas];

    // Filtro de marca
    if (marcaFilter !== 'todas') {
      filtered = filtered.filter(d => d.marca === marcaFilter);
    }

    // Filtro de ano e mês
    const anoSelecionado = parseInt(anoFilter);
    
    filtered = filtered.filter(d => {
      const despesaDate = new Date(d.data);
      const despesaAno = despesaDate.getFullYear();
      
      // Filtro de ano
      if (despesaAno !== anoSelecionado) {
        return false;
      }
      
      // Filtro de mês (se não for "todos")
      if (mesFilter !== 'todos') {
        const mesSelecionado = parseInt(mesFilter);
        const despesaMes = despesaDate.getMonth();
        return despesaMes === mesSelecionado;
      }
      
      return true;
    });

    return filtered;
  }, [despesas, marcaFilter, anoFilter, mesFilter]);

  // Calcular estatísticas por departamento
  const departamentoStats = useMemo(() => {
    const stats: Record<string, DepartamentoStats> = {};

    despesasFiltradas.forEach(despesa => {
      const dept = despesa.departamento;
      
      if (!stats[dept]) {
        stats[dept] = {
          departamento: dept,
          total: 0,
          aprovadas: 0,
          pendentes: 0,
          rejeitadas: 0,
          porMarca: {},
          porCategoria: {},
        };
      }

      stats[dept].total += despesa.valor;

      if (despesa.status === 'aprovado') {
        stats[dept].aprovadas += despesa.valor;
      } else if (despesa.status === 'pendente' || despesa.status === 'aguardando') {
        stats[dept].pendentes += despesa.valor;
      } else if (despesa.status === 'reprovado') {
        stats[dept].rejeitadas += despesa.valor;
      }

      // Por marca
      stats[dept].porMarca[despesa.marca] = 
        (stats[dept].porMarca[despesa.marca] || 0) + despesa.valor;

      // Por categoria
      stats[dept].porCategoria[despesa.categoria] = 
        (stats[dept].porCategoria[despesa.categoria] || 0) + despesa.valor;
    });

    return Object.values(stats).sort((a, b) => b.total - a.total);
  }, [despesasFiltradas]);

  // Totais gerais
  const totais = useMemo(() => {
    return {
      geral: despesasFiltradas.reduce((sum, d) => sum + d.valor, 0),
      aprovadas: despesasFiltradas
        .filter(d => d.status === 'aprovado')
        .reduce((sum, d) => sum + d.valor, 0),
      pendentes: despesasFiltradas
        .filter(d => d.status === 'pendente' || d.status === 'aguardando')
        .reduce((sum, d) => sum + d.valor, 0),
    };
  }, [despesasFiltradas]);

  // Obter marcas únicas
  const marcas = useMemo(() => {
    const uniqueMarcas = new Set(despesas.map(d => d.marca));
    return Array.from(uniqueMarcas).sort();
  }, [despesas]);

  // Calcular média de gastos por departamento para alertas
  const mediaDepartamento = useMemo(() => {
    if (departamentoStats.length === 0) return 0;
    const total = departamentoStats.reduce((sum, d) => sum + d.total, 0);
    return total / departamentoStats.length;
  }, [departamentoStats]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const exportarDados = () => {
    // Preparar dados para CSV
    const csvData = departamentoStats.map(dept => {
      const marcasStr = Object.entries(dept.porMarca)
        .map(([marca, valor]) => `${marca}: ${formatCurrency(valor)}`)
        .join(' | ');
      
      const categoriasStr = Object.entries(dept.porCategoria)
        .map(([cat, valor]) => `${cat}: ${formatCurrency(valor)}`)
        .join(' | ');

      return {
        Departamento: dept.departamento,
        Total: formatCurrency(dept.total),
        Aprovadas: formatCurrency(dept.aprovadas),
        Pendentes: formatCurrency(dept.pendentes),
        Rejeitadas: formatCurrency(dept.rejeitadas),
        'Por Marca': marcasStr,
        'Por Categoria': categoriasStr,
      };
    });

    // Converter para CSV
    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `analise-departamentos-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getAlertLevel = (valor: number) => {
    if (valor > mediaDepartamento * 1.5) {
      return { color: 'text-red-600', icon: '🔴', text: 'Muito acima da média' };
    } else if (valor > mediaDepartamento * 1.2) {
      return { color: 'text-orange-600', icon: '🟠', text: 'Acima da média' };
    } else if (valor < mediaDepartamento * 0.5) {
      return { color: 'text-blue-600', icon: '🔵', text: 'Abaixo da média' };
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-emerald-600" />
              <CardTitle>Filtros de Análise</CardTitle>
            </div>
            <Button
              onClick={exportarDados}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Marca</label>
              <Select value={marcaFilter} onValueChange={setMarcaFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Marcas</SelectItem>
                  {marcas.map(marca => (
                    <SelectItem key={marca} value={marca}>
                      {marca}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ano</label>
              <Select value={anoFilter} onValueChange={setAnoFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                  <SelectItem value="2028">2028</SelectItem>
                  <SelectItem value="2029">2029</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mês</label>
              <Select value={mesFilter} onValueChange={setMesFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Meses</SelectItem>
                  <SelectItem value="0">Janeiro</SelectItem>
                  <SelectItem value="1">Fevereiro</SelectItem>
                  <SelectItem value="2">Março</SelectItem>
                  <SelectItem value="3">Abril</SelectItem>
                  <SelectItem value="4">Maio</SelectItem>
                  <SelectItem value="5">Junho</SelectItem>
                  <SelectItem value="6">Julho</SelectItem>
                  <SelectItem value="7">Agosto</SelectItem>
                  <SelectItem value="8">Setembro</SelectItem>
                  <SelectItem value="9">Outubro</SelectItem>
                  <SelectItem value="10">Novembro</SelectItem>
                  <SelectItem value="11">Dezembro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Geral</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(totais.geral)}
                </p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                <Building2 className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Aprovadas</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totais.aprovadas)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pendentes</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatCurrency(totais.pendentes)}
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Barras e Análise Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Análise por Departamento</CardTitle>
          <p className="text-sm text-slate-500">
            Clique em um departamento para ver detalhes por categoria
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {departamentoStats.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma despesa encontrada para os filtros selecionados</p>
              </div>
            ) : (
              departamentoStats.map((dept) => {
                const isExpanded = expandedDept === dept.departamento;
                const maxValor = Math.max(...departamentoStats.map(d => d.total));
                const barWidth = (dept.total / maxValor) * 100;
                const alert = getAlertLevel(dept.total);

                return (
                  <div key={dept.departamento} className="space-y-2">
                    {/* Barra Principal do Departamento */}
                    <div
                      className="cursor-pointer hover:bg-slate-50 p-4 rounded-lg transition-colors border border-slate-200"
                      onClick={() => setExpandedDept(isExpanded ? null : dept.departamento)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          )}
                          <span className="font-semibold text-slate-900">
                            {dept.departamento}
                          </span>
                          {alert && (
                            <Badge variant="outline" className={alert.color}>
                              {alert.icon} {alert.text}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {formatCurrency(dept.total)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {((dept.total / totais.geral) * 100).toFixed(1)}% do total
                          </p>
                        </div>
                      </div>

                      {/* Barra de Progresso */}
                      <div className="relative h-8 bg-slate-100 rounded-lg overflow-hidden">
                        <div
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all"
                          style={{ width: `${barWidth}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-medium">
                          <span className="text-white drop-shadow">
                            {marcaFilter === 'todas' 
                              ? Object.keys(dept.porMarca).join(' | ')
                              : marcaFilter
                            }
                          </span>
                        </div>
                      </div>

                      {/* Mini-stats */}
                      <div className="flex gap-4 mt-2 text-xs">
                        <span className="text-green-600">
                          ✓ {formatCurrency(dept.aprovadas)}
                        </span>
                        <span className="text-amber-600">
                          ⏳ {formatCurrency(dept.pendentes)}
                        </span>
                        <span className="text-red-600">
                          ✗ {formatCurrency(dept.rejeitadas)}
                        </span>
                      </div>
                    </div>

                    {/* Detalhamento por Categoria (Expansível) */}
                    {isExpanded && (
                      <div className="ml-8 pl-4 border-l-2 border-emerald-200 space-y-2">
                        <p className="text-sm font-semibold text-slate-700 mb-3">
                          📋 Detalhamento por Tipo de Despesa
                        </p>
                        {Object.entries(dept.porCategoria)
                          .sort(([, a], [, b]) => b - a)
                          .map(([categoria, valor]) => {
                            const percentage = (valor / dept.total) * 100;
                            return (
                              <div
                                key={categoria}
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-slate-700">
                                      {categoria}
                                    </span>
                                    <span className="text-sm font-bold text-slate-900">
                                      {formatCurrency(valor)}
                                    </span>
                                  </div>
                                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {percentage.toFixed(1)}% do departamento
                                  </p>
                                </div>
                              </div>
                            );
                          })}

                        {/* Distribuição por Marca (se filtro "todas") */}
                        {marcaFilter === 'todas' && Object.keys(dept.porMarca).length > 1 && (
                          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm font-semibold text-blue-900 mb-2">
                              🏢 Distribuição por Marca
                            </p>
                            <div className="space-y-1">
                              {Object.entries(dept.porMarca)
                                .sort(([, a], [, b]) => b - a)
                                .map(([marca, valor]) => (
                                  <div key={marca} className="flex justify-between text-sm">
                                    <span className="text-blue-700">{marca}</span>
                                    <span className="font-semibold text-blue-900">
                                      {formatCurrency(valor)} ({((valor / dept.total) * 100).toFixed(1)}%)
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alertas e Insights */}
      {departamentoStats.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-blue-900">Insights Automáticos</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-blue-800">
              💡 <strong>Departamento com maior gasto:</strong> {departamentoStats[0].departamento} (
              {formatCurrency(departamentoStats[0].total)})
            </p>
            <p className="text-blue-800">
              📊 <strong>Média por departamento:</strong> {formatCurrency(mediaDepartamento)}
            </p>
            {departamentoStats.filter(d => d.total > mediaDepartamento * 1.5).length > 0 && (
              <p className="text-orange-800">
                ⚠️ <strong>Alerta:</strong>{' '}
                {departamentoStats.filter(d => d.total > mediaDepartamento * 1.5).length}{' '}
                departamento(s) com gastos muito acima da média
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
