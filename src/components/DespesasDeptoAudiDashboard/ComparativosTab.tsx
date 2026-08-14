import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, Minus, AlertCircle, BarChart3, LayoutGrid, Table2, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  getDespesasAdmMes,
  loadClassificacoes,
  loadRegrasDeptos,
  extractByDeptoRule,
  extractByDeptoRuleAll,
  type TipoClassificacao,
  type DeptoTab,
  TIPO_LABELS,
  TIPOS_ORDENADOS,
  mergeAssistenciaMedica,
  mergeSalariosOrdenados,
  mergeComissoesEmpregados,
  mergeHorasExtras,
  mergeAdicionais,
  mergeIndenizacoesTrabalistas,
  merge13Salario,
  merge13SalarioIndenizado,
  mergeFeriasIndenizadas,
  mergeFerias,
  mergeInss,
  mergeFgts,
  mergeFgtsMulta,
  mergeAssistenciaMedicaNova,
  mergeValeTransporte,
  mergePremiosGratificacoes,
} from './despesasDeptoAudiStorage';

interface ComparativosTabProps {
  year: number;
  month: number;
}

interface PeriodoConfig {
  id: string;
  ano: number;
  meses: boolean[]; // 12 posições, true = selecionado
  todosMeses: boolean;
  ativo: boolean;
}

type Departamento = 'veiculos_novos' | 'venda_direta' | 'veiculos_usados' | 'pecas' | 'oficina' | 'funilaria' | 'administracao' | 'diretoria' | 'consolidado';

const DEPARTAMENTO_TO_DEPTO_TAB: Record<Departamento, DeptoTab | 'all'> = {
  veiculos_novos: 'veiculos_novos',
  venda_direta: 'venda_direta',
  veiculos_usados: 'veiculos_usados',
  pecas: 'pecas',
  oficina: 'oficina',
  funilaria: 'funilaria',
  administracao: 'administracao',
  diretoria: 'diretoria',
  consolidado: 'all',
};

const DEPARTAMENTOS_INFO: { id: Departamento; label: string }[] = [
  { id: 'veiculos_novos', label: 'Veículos Novos' },
  { id: 'venda_direta', label: 'Venda Direta' },
  { id: 'veiculos_usados', label: 'Veículos Usados' },
  { id: 'pecas', label: 'Peças' },
  { id: 'oficina', label: 'Oficina' },
  { id: 'funilaria', label: 'Funilaria' },
  { id: 'administracao', label: 'Administração' },
  { id: 'diretoria', label: 'Diretoria' },
  { id: 'consolidado', label: 'Consolidado (Total)' },
];

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type VisualizationType = 'tabela' | 'cards' | 'grafico';
type DetalhamentoType = 'total' | 'departamento' | 'tipo' | 'conta';

// Labels locais incluindo "Sem Classificação"
const TIPO_LABELS_LOCAL: Record<string, string> = {
  ...TIPO_LABELS,
  sem_classificacao: 'Sem Classificação',
};

// Função helper para aplicar todas as regras de merge
function applyAllMerges(valorMap: Map<string, number>): void {
  mergeAssistenciaMedica(valorMap);
  mergeSalariosOrdenados(valorMap);
  mergeComissoesEmpregados(valorMap);
  mergeHorasExtras(valorMap);
  mergeAdicionais(valorMap);
  mergeIndenizacoesTrabalistas(valorMap);
  merge13Salario(valorMap);
  merge13SalarioIndenizado(valorMap);
  mergeFeriasIndenizadas(valorMap);
  mergeFerias(valorMap);
  mergeInss(valorMap);
  mergeFgts(valorMap);
  mergeFgtsMulta(valorMap);
  mergeAssistenciaMedicaNova(valorMap);
  mergeValeTransporte(valorMap);
  mergePremiosGratificacoes(valorMap);
}

// Helpers
const fmtBRL = (v: number) => {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const calcularVariacao = (atual: number, base: number) => {
  if (base === 0) return { absoluta: atual, percentual: atual > 0 ? 100 : 0 };
  const absoluta = atual - base;
  const percentual = (absoluta / Math.abs(base)) * 100;
  return { absoluta, percentual };
};

// Componente de indicador de variação
function VariacaoIndicador({ atual, base }: { atual: number; base: number }) {
  const { absoluta, percentual } = calcularVariacao(atual, base);
  
  let cor = 'text-slate-400';
  let Icone = Minus;
  
  if (percentual > 2) {
    cor = 'text-green-600';
    Icone = TrendingUp;
  } else if (percentual < -2) {
    cor = 'text-red-600';
    Icone = TrendingDown;
  }

  return (
    <div className="flex items-center gap-2">
      <Icone className={`w-4 h-4 ${cor}`} />
      <div className="text-right">
        <div className={`text-sm font-semibold ${cor}`}>
          {percentual > 0 ? '+' : ''}{percentual.toFixed(1)}%
        </div>
        <div className={`text-xs ${cor}`}>
          {absoluta > 0 ? '+' : ''}R$ {fmtBRL(Math.abs(absoluta))}
        </div>
      </div>
    </div>
  );
}

interface ResultadoPeriodo {
  periodo: PeriodoConfig;
  label: string;
  total: number;
  porDepartamento: Record<string, number>;
  porTipo: Record<string, number>;
  porConta: Record<string, number>;
  contas: string[];
}

export function ComparativosTab({ year, month }: ComparativosTabProps) {
  const [periodos, setPeriodos] = useState<PeriodoConfig[]>([]);
  const [periodoBase, setPeriodoBase] = useState<string | null>(null);
  
  const [departamentosSelecionados, setDepartamentosSelecionados] = useState<Departamento[]>([]);
  const [tiposSelecionados, setTiposSelecionados] = useState<TipoClassificacao[]>([]);
  const [contasSelecionadas, setContasSelecionadas] = useState<string[]>([]);
  const [todasContas, setTodasContas] = useState<string[]>([]);
  const [buscaConta, setBuscaConta] = useState('');
  const [classificacoes, setClassificacoes] = useState<Record<string, TipoClassificacao>>({});
  
  const [visualizacao, setVisualizacao] = useState<VisualizationType>('tabela');
  const [detalhamento, setDetalhamento] = useState<DetalhamentoType>('total');
  
  const [comparando, setComparando] = useState(false);
  const [resultados, setResultados] = useState<any>(null);

  // Carregar classificações ao montar
  useEffect(() => {
    loadClassificacoes().then(cls => setClassificacoes(cls));
  }, []);

  // Filtrar contas com base nos tipos selecionados
  const contasFiltradas = useMemo(() => {
    if (todasContas.length === 0) return [];
    
    // Se todos os tipos estão selecionados, mostrar todas as contas
    const todosOsTiposSelecionados = tiposSelecionados.length === TIPOS_ORDENADOS.length;
    if (todosOsTiposSelecionados) return todasContas;
    
    // Filtrar apenas contas dos tipos selecionados
    return todasContas.filter(conta => {
      const prefix = conta.match(/^(\d+ -)/)?.[1] ?? '';
      const tipoConta = classificacoes[prefix];
      // Incluir contas sem classificação ou contas do tipo selecionado
      return !tipoConta || tiposSelecionados.includes(tipoConta);
    });
  }, [todasContas, tiposSelecionados, classificacoes]);

  // Atualizar contas selecionadas quando filtro de tipos mudar
  useEffect(() => {
    // Remover contas selecionadas que não estão mais na lista filtrada
    setContasSelecionadas(prev => prev.filter(conta => contasFiltradas.includes(conta)));
  }, [contasFiltradas]);

  const adicionarPeriodo = () => {
    if (periodos.length >= 4) {
      toast.error('Máximo de 4 períodos permitidos');
      return;
    }
    const novoPeriodo: PeriodoConfig = {
      id: `periodo-${Date.now()}`,
      ano: new Date().getFullYear(),
      meses: Array(12).fill(false),
      todosMeses: false,
      ativo: true,
    };
    setPeriodos([...periodos, novoPeriodo]);
    
    if (periodos.length === 0) {
      setPeriodoBase(novoPeriodo.id);
    }
  };

  const removerPeriodo = (id: string) => {
    setPeriodos(periodos.filter(p => p.id !== id));
    if (periodoBase === id) {
      const restantes = periodos.filter(p => p.id !== id);
      setPeriodoBase(restantes.length > 0 ? restantes[0].id : null);
    }
  };

  const atualizarPeriodo = (id: string, updates: Partial<PeriodoConfig>) => {
    setPeriodos(periodos.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const toggleMes = (periodoId: string, mesIdx: number) => {
    setPeriodos(periodos.map(p => {
      if (p.id === periodoId) {
        const novosMeses = [...p.meses];
        novosMeses[mesIdx] = !novosMeses[mesIdx];
        return { ...p, meses: novosMeses, todosMeses: false };
      }
      return p;
    }));
  };

  const toggleTodosMeses = (periodoId: string) => {
    setPeriodos(periodos.map(p => {
      if (p.id === periodoId) {
        const novoTodosMeses = !p.todosMeses;
        return {
          ...p,
          todosMeses: novoTodosMeses,
          meses: novoTodosMeses ? Array(12).fill(true) : Array(12).fill(false)
        };
      }
      return p;
    }));
  };

  const getLabelPeriodo = (periodo: PeriodoConfig): string => {
    if (periodo.todosMeses) return `Ano ${periodo.ano}`;
    
    const mesesSelecionados = periodo.meses
      .map((sel, idx) => sel ? idx : -1)
      .filter(idx => idx !== -1);
    
    if (mesesSelecionados.length === 0) return `${periodo.ano} (sem meses)`;
    if (mesesSelecionados.length === 12) return `Ano ${periodo.ano}`;
    
    const primeiro = MONTHS_SHORT[mesesSelecionados[0]];
    const ultimo = MONTHS_SHORT[mesesSelecionados[mesesSelecionados.length - 1]];
    
    if (mesesSelecionados.length <= 3) {
      return `${mesesSelecionados.map(i => MONTHS_SHORT[i]).join(', ')} ${periodo.ano}`;
    }
    
    return `${primeiro}-${ultimo} ${periodo.ano}`;
  };

  const executarComparacao = async () => {
    // Validações
    if (periodos.length === 0) {
      toast.error('Adicione pelo menos um período para comparar');
      return;
    }

    const periodosAtivos = periodos.filter(p => p.ativo);
    if (periodosAtivos.length === 0) {
      toast.error('Ative pelo menos um período');
      return;
    }

    if (departamentosSelecionados.length === 0) {
      toast.error('Selecione pelo menos um departamento');
      return;
    }

    if (tiposSelecionados.length === 0) {
      toast.error('Selecione pelo menos um tipo de despesa');
      return;
    }

    setComparando(true);
    try {
      // Carregar regras
      const regras = await loadRegrasDeptos();

      const resultadosPeriodos: ResultadoPeriodo[] = [];
      const todasContasSet = new Set<string>();

      // Processar cada período
      for (const periodo of periodosAtivos) {
        const mesesParaCarregar = periodo.meses
          .map((sel, idx) => (sel ? idx + 1 : -1))
          .filter(m => m !== -1);

        if (mesesParaCarregar.length === 0) {
          toast.warning(`Período ${periodo.ano} não tem meses selecionados`);
          continue;
        }

        // Agregar dados de todos os meses do período
        const valorMapConsolidado = new Map<string, number>();

        for (const mes of mesesParaCarregar) {
          const data = await getDespesasAdmMes(periodo.ano, mes);
          if (!data) {
            console.log(`⚠️ Sem dados para ${periodo.ano}/${mes}`);
            continue;
          }

          console.log(`✅ Dados encontrados para ${periodo.ano}/${mes}:`, data.rows.length, 'linhas');

          // Extrair dados por cada departamento selecionado
          for (const depto of departamentosSelecionados) {
            const deptoTab = DEPARTAMENTO_TO_DEPTO_TAB[depto];
            let valorMap: Map<string, number>;

            if (deptoTab === 'all') {
              valorMap = extractByDeptoRuleAll(data, regras);
            } else {
              valorMap = extractByDeptoRule(data, deptoTab as DeptoTab, regras);
            }

            // Aplicar regras de merge
            applyAllMerges(valorMap);

            console.log(`📊 Após merges para ${depto}:`, valorMap.size, 'contas');

            // Filtrar por tipos de despesa usando classificações
            const todosOsTiposSelecionados = tiposSelecionados.length === TIPOS_ORDENADOS.length;

            for (const [conta, valor] of valorMap) {
              let incluirConta = false;

              if (todosOsTiposSelecionados) {
                // Se todos os tipos estão selecionados, incluir todas as contas
                incluirConta = true;
              } else {
                // Se tipos específicos, filtrar por classificação
                // Contas sem classificação são SEMPRE incluídas
                const prefix = conta.match(/^(\d+ -)/)?.[1] ?? '';
                const tipoConta = classificacoes[prefix];
                incluirConta = tipoConta ? tiposSelecionados.includes(tipoConta) : true;
              }

              if (incluirConta) {
                // Se há contas específicas selecionadas, aplicar mais um filtro
                if (contasSelecionadas.length > 0) {
                  if (contasSelecionadas.includes(conta)) {
                    valorMapConsolidado.set(conta, (valorMapConsolidado.get(conta) ?? 0) + valor);
                    todasContasSet.add(conta);
                  }
                } else {
                  valorMapConsolidado.set(conta, (valorMapConsolidado.get(conta) ?? 0) + valor);
                  todasContasSet.add(conta);
                }
              }
            }
          }
        }

        console.log(`💰 Consolidado para período ${periodo.ano}:`, valorMapConsolidado.size, 'contas');
        console.log('Total consolidado:', Array.from(valorMapConsolidado.values()).reduce((a, b) => a + b, 0));

        // Calcular totais
        let total = 0;
        const porDepartamento: Record<string, number> = {};
        const porTipo: Record<string, number> = {};
        const porConta: Record<string, number> = {};
        const contas: string[] = [];

        for (const [conta, valor] of valorMapConsolidado) {
          total += valor;
          porConta[conta] = valor;
          contas.push(conta);

          // Agrupar por tipo (se a conta tiver classificação)
          const prefix = conta.match(/^(\d+ -)/)?.[1] ?? '';
          const tipoConta = classificacoes[prefix];
          if (tipoConta) {
            porTipo[tipoConta] = (porTipo[tipoConta] ?? 0) + valor;
          } else {
            // Contas sem classificação vão para "Sem Classificação"
            porTipo['sem_classificacao'] = (porTipo['sem_classificacao'] ?? 0) + valor;
          }

          // Não agrupamos por departamento aqui pois já somamos tudo
        }

        resultadosPeriodos.push({
          periodo,
          label: getLabelPeriodo(periodo),
          total,
          porDepartamento,
          porTipo,
          porConta,
          contas,
        });
      }

      // Atualizar lista de contas disponíveis
      setTodasContas(Array.from(todasContasSet).sort((a, b) => {
        const nomeA = a.split(' - ')[1] || a;
        const nomeB = b.split(' - ')[1] || b;
        return nomeA.localeCompare(nomeB);
      }));

      // Calcular variações
      const periodoBaseObj = resultadosPeriodos.find(r => r.periodo.id === periodoBase);
      const periodoBaseIdx = periodoBaseObj ? resultadosPeriodos.indexOf(periodoBaseObj) : 0;

      setResultados({
        periodos: resultadosPeriodos,
        periodoBase: periodoBaseIdx,
      });

      toast.success('Comparação realizada com sucesso!');
    } catch (error) {
      toast.error('Erro ao realizar comparação');
      console.error(error);
    } finally {
      setComparando(false);
    }
  };

  return (
    <div className="flex gap-6 p-6">
      {/* Painel de Configuração */}
      <div className="w-80 flex-shrink-0 space-y-4">
        
        {/* Períodos */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Períodos</h3>
            <button
              onClick={adicionarPeriodo}
              disabled={periodos.length >= 4}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:text-slate-300 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>

          {periodos.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">
              Nenhum período configurado
            </p>
          )}

          <div className="space-y-3">
            {periodos.map((periodo, idx) => (
              <div
                key={periodo.id}
                className={`border rounded-lg p-3 ${
                  periodoBase === periodo.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600">
                    PERÍODO {idx + 1}
                    {periodoBase === periodo.id && (
                      <span className="ml-1.5 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">BASE</span>
                    )}
                  </span>
                  <button
                    onClick={() => removerPeriodo(periodo.id)}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Seletor de Ano */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  <button
                    onClick={() => atualizarPeriodo(periodo.id, { ano: periodo.ano - 1 })}
                    className="text-slate-400 hover:text-slate-700 font-bold"
                  >
                    ‹
                  </button>
                  <span className="text-sm font-bold text-slate-700 min-w-[45px] text-center">
                    {periodo.ano}
                  </span>
                  <button
                    onClick={() => atualizarPeriodo(periodo.id, { ano: periodo.ano + 1 })}
                    className="text-slate-400 hover:text-slate-700 font-bold"
                  >
                    ›
                  </button>
                </div>

                {/* Checkbox Todos os Meses */}
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={periodo.todosMeses}
                    onChange={() => toggleTodosMeses(periodo.id)}
                    className="rounded"
                  />
                  <span className="text-xs font-semibold text-slate-600">Todos os meses</span>
                </label>

                {/* Grid de Meses */}
                <div className="grid grid-cols-3 gap-1">
                  {MONTHS_SHORT.map((mes, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleMes(periodo.id, idx)}
                      disabled={periodo.todosMeses}
                      className={`text-xs py-1 rounded font-semibold transition-colors ${
                        periodo.meses[idx]
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      } ${periodo.todosMeses ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {mes}
                    </button>
                  ))}
                </div>

                {/* Botão Usar como Base */}
                {periodoBase !== periodo.id && (
                  <button
                    onClick={() => setPeriodoBase(periodo.id)}
                    className="w-full mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 py-1"
                  >
                    📍 Usar como Base
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Filtro Departamentos */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Departamentos</h3>
          
          <label className="flex items-center gap-2 mb-2 cursor-pointer border-b border-slate-100 pb-2">
            <input
              type="checkbox"
              checked={departamentosSelecionados.length === DEPARTAMENTOS_INFO.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setDepartamentosSelecionados(DEPARTAMENTOS_INFO.map(d => d.id));
                } else {
                  setDepartamentosSelecionados([]);
                }
              }}
              className="rounded"
            />
            <span className="text-xs font-bold text-slate-700">Todos</span>
          </label>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {DEPARTAMENTOS_INFO.map(depto => (
              <label key={depto.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={departamentosSelecionados.includes(depto.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDepartamentosSelecionados([...departamentosSelecionados, depto.id]);
                    } else {
                      setDepartamentosSelecionados(departamentosSelecionados.filter(d => d !== depto.id));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-xs text-slate-600">{depto.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Filtro Tipos de Despesa */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Tipos de Despesa</h3>
          
          <label className="flex items-center gap-2 mb-2 cursor-pointer border-b border-slate-100 pb-2">
            <input
              type="checkbox"
              checked={tiposSelecionados.length === TIPOS_ORDENADOS.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setTiposSelecionados([...TIPOS_ORDENADOS]);
                } else {
                  setTiposSelecionados([]);
                }
              }}
              className="rounded"
            />
            <span className="text-xs font-bold text-slate-700">Todos</span>
          </label>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {TIPOS_ORDENADOS.map(tipo => (
              <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tiposSelecionados.includes(tipo)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setTiposSelecionados([...tiposSelecionados, tipo]);
                    } else {
                      setTiposSelecionados(tiposSelecionados.filter(t => t !== tipo));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-xs text-slate-600">{TIPO_LABELS[tipo]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Filtro Contas Específicas */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Contas Específicas</h3>
          
          {/* Campo de Busca */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar conta..."
              value={buscaConta}
              onChange={(e) => setBuscaConta(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <label className="flex items-center gap-2 mb-2 cursor-pointer border-b border-slate-100 pb-2">
            <input
              type="checkbox"
              checked={contasSelecionadas.length === contasFiltradas.length && contasFiltradas.length > 0}
              onChange={(e) => {
                if (e.target.checked) {
                  setContasSelecionadas([...contasFiltradas]);
                } else {
                  setContasSelecionadas([]);
                }
              }}
              className="rounded"
            />
            <span className="text-xs font-bold text-slate-700">
              Todas as contas {contasFiltradas.length > 0 && `(${contasFiltradas.length})`}
            </span>
          </label>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {contasFiltradas.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                Configure os filtros e compare para ver as contas
              </p>
            ) : (
              contasFiltradas
                .filter(conta => 
                  buscaConta === '' || 
                  conta.toLowerCase().includes(buscaConta.toLowerCase())
                )
                .sort((a, b) => {
                  const nomeA = a.split(' - ')[1] || a;
                  const nomeB = b.split(' - ')[1] || b;
                  return nomeA.localeCompare(nomeB);
                })
                .map(conta => (
                  <label key={conta} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={contasSelecionadas.includes(conta)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setContasSelecionadas([...contasSelecionadas, conta]);
                        } else {
                          setContasSelecionadas(contasSelecionadas.filter(c => c !== conta));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-[11px] text-slate-600 leading-tight">{conta}</span>
                  </label>
                ))
            )}
          </div>
        </div>

        {/* Botão Comparar */}
        <button
          onClick={executarComparacao}
          disabled={comparando}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {comparando ? 'Comparando...' : 'Comparar Períodos'}
        </button>
      </div>

      {/* Área de Resultados */}
      <div className="flex-1">
        {resultados === null ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 shadow-sm text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Configure e Compare</h3>
            <p className="text-sm text-slate-500">
              Adicione períodos, selecione os filtros e clique em "Comparar Períodos" para visualizar os resultados.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            {/* Controles de Visualização */}
            <div className="border-b border-slate-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setVisualizacao('tabela')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded transition-colors ${
                    visualizacao === 'tabela'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Table2 className="w-4 h-4" />
                  Tabela
                </button>
                <button
                  onClick={() => setVisualizacao('cards')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded transition-colors ${
                    visualizacao === 'cards'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Cards
                </button>
                <button
                  onClick={() => setVisualizacao('grafico')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded transition-colors ${
                    visualizacao === 'grafico'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Gráfico
                </button>
              </div>

              <select
                value={detalhamento}
                onChange={(e) => setDetalhamento(e.target.value as DetalhamentoType)}
                className="text-xs font-semibold border border-slate-200 rounded px-3 py-2"
              >
                <option value="total">Sem detalhamento</option>
                <option value="departamento">Por Departamento</option>
                <option value="tipo">Por Tipo de Despesa</option>
                <option value="conta">Por Conta Específica</option>
              </select>
            </div>

            {/* Conteúdo */}
            <div className="p-6">
              {visualizacao === 'tabela' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-slate-300">
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-600 uppercase tracking-wide">
                          Período
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-600 uppercase tracking-wide">
                          Valor Total
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-600 uppercase tracking-wide">
                          Variação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.periodos.map((resultado: ResultadoPeriodo, idx: number) => {
                        const isBase = idx === resultados.periodoBase;
                        const baseValor = resultados.periodos[resultados.periodoBase]?.total ?? 0;
                        
                        return (
                          <tr key={resultado.periodo.id} className={`border-b border-slate-100 ${isBase ? 'bg-blue-50' : ''}`}>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-700">
                                  {resultado.label}
                                </span>
                                {isBase && (
                                  <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">
                                    BASE
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-lg font-bold text-slate-700 tabular-nums">
                                R$ {fmtBRL(resultado.total)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {!isBase && (
                                <VariacaoIndicador atual={resultado.total} base={baseValor} />
                              )}
                              {isBase && (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Detalhamento */}
                  {detalhamento !== 'total' && (
                    <div className="mt-8 pt-6 border-t border-slate-200">
                      <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
                        Detalhamento por {
                          detalhamento === 'departamento' ? 'Departamento' :
                          detalhamento === 'tipo' ? 'Tipo de Despesa' :
                          'Conta'
                        }
                      </h4>
                      
                      {detalhamento === 'tipo' && resultados.periodos.length > 0 && (
                        <div className="space-y-4">
                          {[...TIPOS_ORDENADOS.filter(tipo => tiposSelecionados.includes(tipo)), 'sem_classificacao' as any]
                            .map(tipo => {
                              const temDados = resultados.periodos.some((r: ResultadoPeriodo) => (r.porTipo[tipo] ?? 0) > 0);
                              if (!temDados) return null;

                              return (
                                <div key={tipo} className="bg-slate-50 rounded-lg p-4">
                                  <h5 className="text-xs font-bold text-slate-600 mb-3">{TIPO_LABELS_LOCAL[tipo] || tipo}</h5>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {resultados.periodos.map((resultado: ResultadoPeriodo, idx: number) => {
                                      const valor = resultado.porTipo[tipo] ?? 0;
                                      const isBase = idx === resultados.periodoBase;
                                      const baseValor = resultados.periodos[resultados.periodoBase]?.porTipo[tipo] ?? 0;
                                      
                                      return (
                                        <div key={resultado.periodo.id} className="bg-white rounded border border-slate-200 p-3">
                                          <div className="text-[10px] text-slate-500 mb-1">{resultado.label}</div>
                                          <div className="text-sm font-bold text-slate-700 tabular-nums">
                                            R$ {fmtBRL(valor)}
                                          </div>
                                          {!isBase && baseValor > 0 && (
                                            <div className="mt-1 text-xs">
                                              <VariacaoIndicador atual={valor} base={baseValor} />
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}

                      {detalhamento === 'conta' && resultados.periodos.length > 0 && (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {Array.from(new Set(resultados.periodos.flatMap((r: ResultadoPeriodo) => r.contas)))
                            .sort((a, b) => {
                              const nomeA = a.split(' - ')[1] || a;
                              const nomeB = b.split(' - ')[1] || b;
                              return nomeA.localeCompare(nomeB);
                            })
                            .map(conta => (
                              <div key={conta} className="bg-slate-50 rounded p-3">
                                <div className="text-xs font-semibold text-slate-600 mb-2">{conta}</div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {resultados.periodos.map((resultado: ResultadoPeriodo, idx: number) => {
                                    const valor = resultado.porConta[conta] ?? 0;
                                    const isBase = idx === resultados.periodoBase;
                                    const baseValor = resultados.periodos[resultados.periodoBase]?.porConta[conta] ?? 0;
                                    
                                    return (
                                      <div key={resultado.periodo.id} className="text-xs">
                                        <div className="text-[10px] text-slate-400">{resultado.label}</div>
                                        <div className="font-bold text-slate-700 tabular-nums">
                                          R$ {fmtBRL(valor)}
                                        </div>
                                        {!isBase && baseValor > 0 && valor > 0 && (
                                          <div className="text-[10px] mt-0.5">
                                            {calcularVariacao(valor, baseValor).percentual.toFixed(1)}%
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {visualizacao === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {resultados.periodos.map((resultado: ResultadoPeriodo, idx: number) => {
                    const isBase = idx === resultados.periodoBase;
                    const baseValor = resultados.periodos[resultados.periodoBase]?.total ?? 0;
                    
                    return (
                      <div
                        key={resultado.periodo.id}
                        className={`rounded-lg border-2 p-6 ${
                          isBase ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                            Período {idx + 1}
                          </span>
                          {isBase && (
                            <span className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-bold">
                              BASE
                            </span>
                          )}
                        </div>
                        
                        <h3 className="text-sm font-semibold text-slate-700 mb-4">
                          {resultado.label}
                        </h3>
                        
                        <div className="text-2xl font-bold text-slate-900 tabular-nums mb-4">
                          R$ {fmtBRL(resultado.total)}
                        </div>
                        
                        {!isBase && (
                          <div className="pt-4 border-t border-slate-200">
                            <VariacaoIndicador atual={resultado.total} base={baseValor} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {visualizacao === 'grafico' && (
                <div className="text-center py-12">
                  <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-sm text-slate-500">
                    Visualização em gráfico em desenvolvimento...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
