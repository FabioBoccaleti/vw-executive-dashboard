import { useState, useEffect } from 'react';
import {
  processDepartamentoData,
  processConsolidadoData,
  type DepartamentoData,
} from './ieoDataProcessor';
import {
  type Marca,
  type DeptoClassificacao,
  type TipoContaClassificacao,
  TIPO_CONTA_LABELS,
  TIPOS_CONTA_ORDENADOS,
  DEPTO_CLASSIFICACAO_LABELS,
} from './ieoStorage';

interface Props {
  marca: Marca;
  departamento: DeptoClassificacao | 'consolidado';
  year: number;
  semestre: number; // 0 = ano todo, 1 = 1º sem, 2 = 2º sem
}

function fmtNum(n: number): string {
  if (n === 0) return '—';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtCurrency(n: number): string {
  return `R$ ${fmtNum(n)}`;
}

export function DepartamentoTab({ marca, departamento, year, semestre }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DepartamentoData | null>(null);

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      try {
        const result =
          departamento === 'consolidado'
            ? await processConsolidadoData(marca, year, semestre)
            : await processDepartamentoData(marca, departamento, year, semestre);
        setData(result);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [marca, departamento, year, semestre]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center space-y-2">
          <p className="text-slate-500 font-medium">Erro ao carregar dados</p>
          <p className="text-slate-400 text-sm">
            Verifique se os dados foram importados e as classificações foram configuradas.
          </p>
        </div>
      </div>
    );
  }

  // Determinar período para exibição
  const periodoLabel =
    semestre === 0
      ? `Ano ${year} (todo)`
      : semestre === 1
      ? `1º Semestre / ${year}`
      : `2º Semestre / ${year}`;

  const deptoLabel =
    departamento === 'consolidado'
      ? 'Consolidado (Total)'
      : DEPTO_CLASSIFICACAO_LABELS[departamento];

  // Filtrar apenas grupos com valores
  const gruposComValores = TIPOS_CONTA_ORDENADOS.filter(
    (tipo) => data.grupos[tipo].subtotal !== 0
  );

  // Determinar maior grupo
  const maiorGrupo = gruposComValores.reduce(
    (max, tipo) =>
      Math.abs(data.grupos[tipo].subtotal) > Math.abs(data.grupos[max]?.subtotal || 0)
        ? tipo
        : max,
    gruposComValores[0] as TipoContaClassificacao | undefined
  );

  if (gruposComValores.length === 0) {
    return (
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-slate-500 font-medium">Nenhum dado encontrado</p>
            <p className="text-slate-400 text-sm">
              Não há valores para este departamento no período selecionado.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      {/* Cabeçalho */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Período */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
            Período
          </div>
          <div className="text-lg font-bold text-slate-700">{periodoLabel}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {deptoLabel} — {marca === 'vw' ? 'VW' : 'Audi'}
          </div>
        </div>

        {/* Total */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
            Total
          </div>
          <div
            className={`text-lg font-bold ${
              data.total < 0 ? 'text-red-600' : 'text-emerald-600'
            }`}
          >
            {fmtCurrency(data.total)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {gruposComValores.length} grupo{gruposComValores.length !== 1 ? 's' : ''} ·{' '}
            {Object.values(data.grupos).reduce((sum, g) => sum + g.contas.length, 0)} conta
            {Object.values(data.grupos).reduce((sum, g) => sum + g.contas.length, 0) !== 1
              ? 's'
              : ''}
          </div>
        </div>

        {/* Maior Grupo */}
        {maiorGrupo && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Maior Grupo
            </div>
            <div className="text-sm font-bold text-slate-700">
              {TIPO_CONTA_LABELS[maiorGrupo]}
            </div>
            <div
              className={`text-lg font-bold ${
                data.grupos[maiorGrupo].subtotal < 0 ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              {fmtCurrency(data.grupos[maiorGrupo].subtotal)}
            </div>
          </div>
        )}
      </div>

      {/* Lista de Grupos */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto">
        <div className="p-6 space-y-6">
          {gruposComValores.map((tipo) => {
            const grupo = data.grupos[tipo];
            return (
              <div key={tipo} className="space-y-2">
                {/* Cabeçalho do Grupo */}
                <div className="flex items-center justify-between pb-2 border-b-2 border-emerald-500">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h3 className="text-sm font-bold text-slate-700">
                      {TIPO_CONTA_LABELS[tipo]}
                    </h3>
                    <span className="text-xs text-slate-400">
                      {grupo.contas.length} conta{grupo.contas.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div
                    className={`text-base font-bold ${
                      grupo.subtotal < 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {fmtCurrency(grupo.subtotal)}
                  </div>
                </div>

                {/* Lista de Contas */}
                <div className="space-y-1">
                  {grupo.contas.map((conta, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1.5 px-3 hover:bg-slate-50 rounded transition-colors"
                    >
                      <div className="flex-1 text-xs text-slate-600">{conta.conta}</div>
                      <div
                        className={`text-xs font-mono tabular-nums ${
                          conta.valor < 0 ? 'text-red-600' : 'text-slate-700'
                        }`}
                      >
                        {fmtCurrency(conta.valor)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal do Grupo */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 bg-emerald-50 px-3 py-1.5 rounded">
                  <div className="text-xs font-bold text-emerald-800">
                    Subtotal — {TIPO_CONTA_LABELS[tipo]}
                  </div>
                  <div className="text-xs font-bold font-mono tabular-nums text-emerald-800">
                    {fmtCurrency(grupo.subtotal)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
