import { useEffect, useMemo, useState } from 'react';
import {
  loadRegrasDre,
  saveRegrasDre,
  TIPO_CONTA_LABELS,
  TIPOS_CONTA_ORDENADOS,
  type BaseGerencialDreLine,
  type BaseGerencialDreRules,
  type TipoContaClassificacao,
} from './baseGerencialStorage';

const DRE_BASE_LINES: Array<{ id: BaseGerencialDreLine; label: string }> = [
  { id: 'receita_operacional_liquida', label: 'Receita Operacional Líquida' },
  { id: 'custo_operacional_receita', label: 'Custo Operacional da Receita' },
  { id: 'outras_receitas_operacionais', label: 'Outras Receitas Operacionais' },
  { id: 'outras_despesas_operacionais', label: 'Outras Despesas Operacionais' },
  { id: 'despesas_pessoal', label: 'Despesas c/ Pessoal' },
  { id: 'despesas_servicos_terceiros', label: 'Despesas c/ Serviços de Terceiros' },
  { id: 'despesas_ocupacao', label: 'Despesas c/ Ocupação' },
  { id: 'despesas_funcionamento', label: 'Despesas de Funcionamento' },
  { id: 'despesas_vendas', label: 'Despesas c/ Vendas' },
  { id: 'amortizacoes_depreciacoes', label: 'Amortizações e Depreciações' },
  { id: 'outras_receitas_financeiras', label: 'Outras Receitas Financeiras' },
  { id: 'despesas_financeiras_nao_operacional', label: 'Despesas Financeiras Não Operacional' },
  { id: 'despesas_nao_operacionais', label: 'Despesas Não Operacionais' },
  { id: 'outras_rendas_nao_operacionais', label: 'Outras Rendas Não Operacionais' },
  { id: 'provisoes_irpj_cs', label: 'Provisões IRPJ e C.S.' },
  { id: 'participacoes', label: 'Participações' },
];

export function RegrasDreTab() {
  const [rules, setRules] = useState<BaseGerencialDreRules>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRegrasDre()
      .then(setRules)
      .finally(() => setLoading(false));
  }, []);

  const assignedTo = useMemo(() => {
    const result = new Map<TipoContaClassificacao, BaseGerencialDreLine>();
    for (const [line, groups] of Object.entries(rules) as Array<[BaseGerencialDreLine, TipoContaClassificacao[]]>) {
      for (const group of groups ?? []) result.set(group, line);
    }
    return result;
  }, [rules]);

  async function toggleGroup(line: BaseGerencialDreLine, group: TipoContaClassificacao) {
    const current = rules[line] ?? [];
    const nextGroups = current.includes(group)
      ? current.filter(item => item !== group)
      : [...current, group];
    const next: BaseGerencialDreRules = { ...rules, [line]: nextGroups };
    if (nextGroups.length === 0) delete next[line];
    setRules(next);
    setSaving(true);
    try {
      await saveRegrasDre(next);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  const assignedCount = assignedTo.size;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600">
            {assignedCount}/{TIPOS_CONTA_ORDENADOS.length} grupos vinculados
          </div>
          {saving && <span className="text-xs text-slate-400 italic">Salvando...</span>}
        </div>
        <p className="text-xs text-slate-400">Uma regra vale para VW, Audi e todos os departamentos.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-200">
              <th className="w-72 text-left px-4 py-2.5 font-semibold text-slate-600">Linha da DRE</th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Grupos de contas vinculados</th>
            </tr>
          </thead>
          <tbody>
            {DRE_BASE_LINES.map((line, index) => {
              const selected = rules[line.id] ?? [];
              return (
                <tr key={line.id} className={`align-top border-b last:border-0 border-slate-100 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3 font-semibold text-slate-700">{line.label}</td>
                  <td className="px-4 py-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                      {TIPOS_CONTA_ORDENADOS.map(group => {
                        const owner = assignedTo.get(group);
                        const checked = selected.includes(group);
                        const disabled = owner !== undefined && owner !== line.id;
                        return (
                          <label
                            key={group}
                            className={`flex items-start gap-2 rounded border px-2.5 py-2 ${
                              disabled ? 'border-slate-100 bg-slate-100/70 text-slate-400 cursor-not-allowed' :
                              checked ? 'border-emerald-300 bg-emerald-50 text-emerald-800 cursor-pointer' :
                              'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 cursor-pointer'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleGroup(line.id, group)}
                              className="mt-0.5 accent-emerald-600"
                            />
                            <span className="leading-tight">
                              <span className="font-medium">{TIPO_CONTA_LABELS[group]}</span>
                              {disabled && <span className="block text-[10px] text-slate-400">Já utilizado em outra linha</span>}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {selected.length === 0 && <p className="mt-2 text-[11px] text-amber-600">Nenhum grupo vinculado.</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
