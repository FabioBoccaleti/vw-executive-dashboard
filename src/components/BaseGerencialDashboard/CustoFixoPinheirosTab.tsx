import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  processCustoFixoPinheirosData,
  type CustoFixoPinheirosData,
} from './baseGerencialDataProcessor';
import { TIPO_CONTA_LABELS, loadPinheirosContasFixas, savePinheirosContasFixas } from './baseGerencialStorage';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function fmtCurrency(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function contaCodigo(conta: string): string {
  return conta.match(/^\d+/)?.[0] ?? conta;
}

export function CustoFixoPinheirosTab({ year, mes }: { year: number; mes: number }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CustoFixoPinheirosData | null>(null);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [rascunho, setRascunho] = useState<string[]>([]);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(null);
    setEditando(false);
    Promise.all([processCustoFixoPinheirosData(year, mes), loadPinheirosContasFixas()])
      .then(([result, contas]) => {
        if (!active) return;
        setSelecionadas(contas);
        setRascunho(contas);
        setData(result);
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

  async function salvarSelecao() {
    setSalvando(true);
    try {
      await savePinheirosContasFixas(rascunho);
      setSelecionadas(rascunho);
      setEditando(false);
      toast.success('Seleção de despesas fixas salva.');
    } catch (error) {
      console.error('Erro ao salvar despesas fixas de Pinheiros:', error);
      toast.error('Não foi possível salvar a seleção. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

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

  const selecionadasSet = new Set(editando ? rascunho : selecionadas);
  const grupos = data.grupos.map(grupo => {
    const contasFixas = grupo.contas.filter(conta => selecionadasSet.has(contaCodigo(conta.conta)));
    return {
      ...grupo,
      contas: editando ? grupo.contas : contasFixas,
      contasFixas,
      subtotal: contasFixas.reduce((sum, conta) => sum + conta.valor, 0),
    };
  }).filter(grupo => grupo.contas.length > 0);
  const contas = grupos.flatMap(grupo => grupo.contasFixas);
  const total = grupos.reduce((sum, grupo) => sum + grupo.subtotal, 0);
  const gruposSelecionados = grupos.filter(grupo => grupo.contasFixas.length > 0).length;
  const departamentos = new Set(contas.flatMap(conta =>
    conta.departamentos.map(item => item.departamento)
  ));
  const periodo = mes === 0 ? `Ano ${year} (todo)` : `${MESES[mes - 1]} / ${year}`;

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <p className="text-xs text-slate-500">
          {editando
            ? 'Marque as contas de despesa fixa e salve. Os totais abaixo são uma prévia da seleção.'
            : 'Somente contas marcadas entram nas despesas fixas. A seleção vale para todos os períodos e usuários.'}
        </p>
        <div className="flex items-center gap-2">
          {editando ? (
            <>
              <button type="button" disabled={salvando} onClick={() => setEditando(false)} className="px-3 py-1.5 rounded text-xs font-semibold border border-slate-200 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" disabled={salvando} onClick={salvarSelecao} className="px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600 text-white disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Salvar seleção'}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => { setRascunho(selecionadas); setEditando(true); }} className="px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600 text-white">
              Selecionar despesas fixas
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Período</div>
          <div className="text-lg font-bold text-slate-700">{periodo}</div>
          <div className="text-xs text-slate-500 mt-0.5">Custo Fixo Pinheiros — Audi · Revendas 4 e 5</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total das Despesas Fixas</div>
          <div className={`text-lg font-bold ${total < 0 ? 'text-red-600' : 'text-emerald-600'}`} data-testid="pinheiros-total">
            {fmtCurrency(total)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Sem receitas nem custos operacionais</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Contas de Despesas</div>
          <div className="text-lg font-bold text-slate-700">{contas.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">{gruposSelecionados} grupos selecionados no período</div>
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
      ) : grupos.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-slate-500 font-medium">Nenhuma despesa fixa selecionada neste período</p>
          <p className="text-slate-400 text-sm">Clique em Selecionar despesas fixas para marcar as contas desejadas.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <p className="text-xs text-slate-500">
            Expanda as contas com mais de um departamento para ver a distribuição das despesas.
            Centros de custo sem regra são identificados como sem classificação.
          </p>
          {grupos.map(grupo => (
            <section key={grupo.tipo} className="space-y-2" aria-label={TIPO_CONTA_LABELS[grupo.tipo]}>
              <div className="flex items-center justify-between gap-3 pb-2 border-b-2 border-emerald-500">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <h3 className="text-sm font-bold text-slate-700">{TIPO_CONTA_LABELS[grupo.tipo]}</h3>
                  <span className="text-xs text-slate-400">
                    {editando ? `${grupo.contasFixas.length} de ${grupo.contas.length} contas selecionadas` : `${grupo.contas.length} contas`}
                  </span>
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
                  return (
                    <div key={conta.conta} className="flex items-start gap-2">
                      {editando && (
                        <input
                          type="checkbox"
                          aria-label={`Considerar ${conta.conta} como despesa fixa`}
                          checked={selecionadasSet.has(contaCodigo(conta.conta))}
                          disabled={salvando}
                          onChange={event => {
                            const codigo = contaCodigo(conta.conta);
                            const checked = event.target.checked;
                            setRascunho(current => checked
                              ? [...current, codigo]
                              : current.filter(item => item !== codigo));
                          }}
                          className="mt-2.5 accent-emerald-600"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        {conta.departamentos.length > 1 ? (
                          <details className="rounded bg-slate-50">
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
                          <div className="flex items-center justify-between gap-3 py-2 px-3 rounded hover:bg-slate-50">
                            <div className="text-xs text-slate-600">
                              <div>{conta.conta}</div>
                              <div className="text-slate-400 mt-0.5">{conta.departamentos[0]?.departamento}</div>
                            </div>
                            {valor}
                          </div>
                        )}
                      </div>
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
