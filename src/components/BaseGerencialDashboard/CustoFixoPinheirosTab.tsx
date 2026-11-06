import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  processCustoFixoPinheirosData,
  type CustoFixoPinheirosData,
} from './baseGerencialDataProcessor';
import { TIPO_CONTA_LABELS } from './baseGerencialStorage';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function fmtCurrency(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CustoFixoPinheirosTab({ year, mes }: { year: number; mes: number }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CustoFixoPinheirosData | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(null);
    processCustoFixoPinheirosData(year, mes)
      .then(result => {
        if (active) setData(result);
      })
      .catch(error => {
        if (!active) return;
        console.error('Erro ao carregar Custo Fixo Pinheiros:', error);
        toast.error('Erro ao carregar Custo Fixo Pinheiros.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [year, mes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-label="Carregando despesas">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 space-y-2" role="alert">
        <p className="text-slate-500 font-medium">Erro ao carregar Custo Fixo Pinheiros</p>
        <p className="text-slate-400 text-sm">Tente abrir a aba novamente.</p>
      </div>
    );
  }

  const contas = data.grupos.flatMap(grupo => grupo.contas);
  const departamentos = new Set(contas.flatMap(conta =>
    conta.departamentos.map(item => item.departamento)
  ));
  const periodo = mes === 0 ? `Ano ${year} (todo)` : `${MESES[mes - 1]} / ${year}`;

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Período</div>
          <div className="text-lg font-bold text-slate-700">{periodo}</div>
          <div className="text-xs text-slate-500 mt-0.5">Custo Fixo Pinheiros — Audi · Revendas 4 e 5</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total das Despesas</div>
          <div className={`text-lg font-bold ${data.total < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {fmtCurrency(data.total)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Sem receitas nem custos operacionais</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Contas de Despesas</div>
          <div className="text-lg font-bold text-slate-700">{contas.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">{data.grupos.length} grupos no período</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Departamentos</div>
          <div className="text-lg font-bold text-slate-700">{departamentos.size}</div>
          <div className="text-xs text-slate-500 mt-0.5">Valores somados das duas revendas</div>
        </div>
      </div>

      {data.grupos.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-slate-500 font-medium">Nenhuma despesa encontrada</p>
          <p className="text-slate-400 text-sm">
            Verifique os dados das revendas 4 e 5 e a classificação das contas em Importar Dados para este período.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <p className="text-xs text-slate-500">
            Expanda as contas com mais de um departamento para ver a distribuição das despesas.
            Centros de custo sem regra são identificados como sem classificação.
          </p>
          {data.grupos.map(grupo => (
            <section key={grupo.tipo} className="space-y-2" aria-label={TIPO_CONTA_LABELS[grupo.tipo]}>
              <div className="flex items-center justify-between gap-3 pb-2 border-b-2 border-emerald-500">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <h3 className="text-sm font-bold text-slate-700">{TIPO_CONTA_LABELS[grupo.tipo]}</h3>
                  <span className="text-xs text-slate-400">{grupo.contas.length} contas</span>
                </div>
                <span className={`text-base font-bold whitespace-nowrap ${grupo.subtotal < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {fmtCurrency(grupo.subtotal)}
                </span>
              </div>
              <div className="space-y-1">
                {grupo.contas.map(conta => {
                  const valor = (
                    <span className={`text-xs font-mono tabular-nums whitespace-nowrap ${conta.valor < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                      {fmtCurrency(conta.valor)}
                    </span>
                  );
                  return conta.departamentos.length > 1 ? (
                    <details key={conta.conta} className="rounded bg-slate-50">
                      <summary className="cursor-pointer py-2 px-3 text-xs text-slate-600 rounded hover:bg-slate-100 focus-visible:outline-emerald-600">
                        <span className="inline-flex items-center justify-between gap-3 w-[calc(100%-1rem)] align-middle">
                          <span>{conta.conta} <span className="text-slate-400">· {conta.departamentos.length} departamentos</span></span>
                          {valor}
                        </span>
                      </summary>
                      <ul className="border-t border-slate-200 px-6 py-2 space-y-2" aria-label={`Departamentos de ${conta.conta}`}>
                        {conta.departamentos.map(item => (
                          <li key={item.departamento} className="flex justify-between gap-3 text-xs text-slate-500">
                            <span>{item.departamento}</span>
                            <span className={`font-mono tabular-nums whitespace-nowrap ${item.valor < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                              {fmtCurrency(item.valor)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <div key={conta.conta} className="flex items-center justify-between gap-3 py-2 px-3 rounded hover:bg-slate-50">
                      <div className="text-xs text-slate-600">
                        <div>{conta.conta}</div>
                        <div className="text-slate-400 mt-0.5">{conta.departamentos[0]?.departamento}</div>
                      </div>
                      {valor}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-3 bg-emerald-50 px-3 py-1.5 rounded text-xs font-bold text-emerald-800">
                <span>Subtotal — {TIPO_CONTA_LABELS[grupo.tipo]}</span>
                <span className="font-mono tabular-nums whitespace-nowrap">{fmtCurrency(grupo.subtotal)}</span>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
