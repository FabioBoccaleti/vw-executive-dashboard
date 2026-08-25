import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import {
  getAllImportedSemestresData,
  loadRegrasDeptos,
  saveRegrasDeptos,
  loadContasTipoItem,
  type RegraDepto,
  type DeptoClassificacao,
  DEPTO_CLASSIFICACAO_LABELS,
  DEPTO_CLASSIFICACOES_ORDENADAS,
} from './ieoStorage';

interface Departamento {
  prefix: string; // Ex: "101 -"
  fullName: string; // Ex: "101 - VEÍCULOS NOVOS (CCusto)"
  temContaCom3ou4: boolean; // Se este departamento aparece em contas que começam com 3 ou 4
}

export function RegrasDepartamentosTab() {
  const [loading, setLoading] = useState(true);
  const [deptos, setDeptos] = useState<Departamento[]>([]);
  const [regras, setRegras] = useState<Record<string, RegraDepto>>({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'classified'>('all');

  useEffect(() => {
    Promise.all([getAllImportedSemestresData(), loadRegrasDeptos(), loadContasTipoItem()])
      .then(([allData, savedRegras, contasTipoItemRaw]) => {
        // null = nunca configurado → usa fallback legado (prefixo 3 ou 4)
        const contasTipoItemNums: Set<string> | null = contasTipoItemRaw !== null
          ? new Set(contasTipoItemRaw.map(c => c.match(/^(\d+)/)?.[1] ?? '').filter(Boolean))
          : null;

        const deptosMap = new Map<string, { fullName: string; temContaCom3ou4: boolean }>();
        
        for (const data of allData) {
          let contaPrincipalAtual: string | null = null;
          
          for (const row of data.rows) {
            if (row.isMain) {
              const match = row.conta.match(/^(\d+)\s+-/);
              if (match) {
                contaPrincipalAtual = match[1];
              }
              continue;
            }
            
            const ccustoMatch = row.conta.match(/^(\d{3,})\s*-\s*[^(]+\(CCusto\)/i);
            if (!ccustoMatch) continue;
            
            const ccustoNum = ccustoMatch[1];
            const prefix = `${ccustoNum} -`;
            
            // Usar lista configurável; se não configurado, fallback para prefixo 3/4
            const contaComecaCom3ou4 = contaPrincipalAtual
              ? contasTipoItemNums !== null
                ? contasTipoItemNums.has(contaPrincipalAtual)
                : (contaPrincipalAtual.startsWith('3') || contaPrincipalAtual.startsWith('4'))
              : false;
            
            if (!deptosMap.has(prefix)) {
              deptosMap.set(prefix, {
                fullName: row.conta,
                temContaCom3ou4: contaComecaCom3ou4,
              });
            } else {
              const existing = deptosMap.get(prefix)!;
              if (contaComecaCom3ou4 && !existing.temContaCom3ou4) {
                existing.temContaCom3ou4 = true;
              }
            }
          }
        }
        
        const sorted = [...deptosMap.entries()]
          .map(([prefix, data]) => ({
            prefix,
            fullName: data.fullName,
            temContaCom3ou4: data.temContaCom3ou4,
          }))
          .sort((a, b) => parseInt(a.prefix) - parseInt(b.prefix));
        
        setDeptos(sorted);
        setRegras(savedRegras);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleClassifyDefault(prefix: string, classificacao: DeptoClassificacao | '') {
    const next = { ...regras };
    if (classificacao === '') {
      if (next[prefix]) {
        delete next[prefix].default;
        // Se não tem mais nada, remove a regra inteira
        if (!next[prefix].byTipoItem || Object.keys(next[prefix].byTipoItem!).length === 0) {
          delete next[prefix];
        }
      }
    } else {
      if (!next[prefix]) next[prefix] = {};
      next[prefix].default = classificacao as DeptoClassificacao;
    }
    setRegras(next);
    setSaving(true);
    try {
      await saveRegrasDeptos(next);
    } finally {
      setSaving(false);
    }
  }

  async function handleClassifyTipoItem(prefix: string, tipoItem: 'P' | 'S' | 'V', classificacao: DeptoClassificacao | '') {
    const next = { ...regras };
    if (!next[prefix]) next[prefix] = {};
    if (!next[prefix].byTipoItem) next[prefix].byTipoItem = {};
    
    if (classificacao === '') {
      delete next[prefix].byTipoItem![tipoItem];
      // Se não tem mais nada, remove a regra inteira
      if (Object.keys(next[prefix].byTipoItem!).length === 0) {
        delete next[prefix].byTipoItem;
        if (!next[prefix].default) {
          delete next[prefix];
        }
      }
    } else {
      next[prefix].byTipoItem![tipoItem] = classificacao as DeptoClassificacao;
    }
    
    setRegras(next);
    setSaving(true);
    try {
      await saveRegrasDeptos(next);
    } finally {
      setSaving(false);
    }
  }

  function isDeptoPending(depto: Departamento): boolean {
    const regra = regras[depto.prefix];
    if (!regra) return true;
    
    // Se tem contas com 3 ou 4, precisa ter classificações específicas por tipo item
    if (depto.temContaCom3ou4) {
      const hasTipoItemRules = regra.byTipoItem && (
        regra.byTipoItem.P || regra.byTipoItem.S || regra.byTipoItem.V
      );
      if (!hasTipoItemRules) return true;
    }
    
    // Para todos, precisa ter default
    return !regra.default;
  }

  const pending = deptos.filter(isDeptoPending);
  const classified = deptos.filter(d => !isDeptoPending(d));
  const displayed =
    filter === 'pending' ? pending :
    filter === 'classified' ? classified :
    [...pending, ...classified];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (deptos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center space-y-2">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-slate-500 font-medium">Nenhum dado importado ainda</p>
          <p className="text-slate-400 text-sm">
            Importe ao menos um semestre para configurar as regras de departamentos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Info sobre Tipo Item */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700">
          <p className="font-semibold mb-1">Regra especial para contas 3 e 4:</p>
          <p>
            Departamentos que aparecem em contas começando com <strong>3 ou 4</strong> podem ter classificações 
            diferentes baseadas no <strong>Tipo Item (P/S/V)</strong>. Exemplo: Departamento 104 + Tipo P = Oficina, 
            mas 104 + Tipo S = Peças.
          </p>
        </div>
      </div>

      {/* Resumo + filtro */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {pending.length > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-700">
              <AlertCircle className="w-3.5 h-3.5" />
              {pending.length} departamento{pending.length !== 1 ? 's' : ''} sem classificação completa
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs font-semibold text-green-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Todos os departamentos classificados
            </div>
          )}
          <span className="text-xs text-slate-400">
            {classified.length}/{deptos.length} classificados
          </span>
          {saving && <span className="text-xs text-slate-400 italic">Salvando...</span>}
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'pending', 'classified'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                filter === f ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : 'Classificados'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-200">
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Departamento (CCusto)</th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-56">Classificação Padrão</th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-56 bg-blue-50">Tipo P (contas 3/4)</th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-56 bg-blue-50">Tipo S (contas 3/4)</th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-56 bg-blue-50">Tipo V (contas 3/4)</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((depto, i) => {
              const isPending = isDeptoPending(depto);
              const regra = regras[depto.prefix];
              
              return (
                <tr
                  key={depto.prefix}
                  className={`border-b last:border-0 ${
                    isPending
                      ? 'bg-amber-50 border-amber-100'
                      : i % 2 === 0 ? 'bg-white border-slate-100' : 'bg-slate-50/50 border-slate-100'
                  }`}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold shrink-0">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Classificar
                        </span>
                      )}
                      <div>
                        <div className={`font-${isPending ? 'semibold' : 'medium'} ${isPending ? 'text-slate-800' : 'text-slate-600'}`}>
                          {depto.fullName}
                        </div>
                        {depto.temContaCom3ou4 && (
                          <div className="text-[10px] text-blue-600 font-medium mt-0.5">
                            Aparece em contas 3 ou 4 → permite classificação por Tipo Item
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  {/* Classificação Padrão */}
                  <td className="px-4 py-2">
                    <select
                      value={regra?.default ?? ''}
                      onChange={e => handleClassifyDefault(depto.prefix, e.target.value as DeptoClassificacao | '')}
                      className={`w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
                        isPending && !regra?.default
                          ? 'border-amber-300 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <option value="">— Selecione —</option>
                      {DEPTO_CLASSIFICACOES_ORDENADAS.map(c => (
                        <option key={c} value={c}>{DEPTO_CLASSIFICACAO_LABELS[c]}</option>
                      ))}
                    </select>
                  </td>
                  
                  {/* Tipo P */}
                  <td className="px-4 py-2 bg-blue-50/30">
                    {depto.temContaCom3ou4 ? (
                      <select
                        value={regra?.byTipoItem?.P ?? ''}
                        onChange={e => handleClassifyTipoItem(depto.prefix, 'P', e.target.value as DeptoClassificacao | '')}
                        className={`w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                          isPending && !regra?.byTipoItem?.P
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : 'border-blue-200 bg-white text-slate-700'
                        }`}
                      >
                        <option value="">— Selecione —</option>
                        {DEPTO_CLASSIFICACOES_ORDENADAS.map(c => (
                          <option key={c} value={c}>{DEPTO_CLASSIFICACAO_LABELS[c]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-400 text-[10px]">N/A</span>
                    )}
                  </td>
                  
                  {/* Tipo S */}
                  <td className="px-4 py-2 bg-blue-50/30">
                    {depto.temContaCom3ou4 ? (
                      <select
                        value={regra?.byTipoItem?.S ?? ''}
                        onChange={e => handleClassifyTipoItem(depto.prefix, 'S', e.target.value as DeptoClassificacao | '')}
                        className={`w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                          isPending && !regra?.byTipoItem?.S
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : 'border-blue-200 bg-white text-slate-700'
                        }`}
                      >
                        <option value="">— Selecione —</option>
                        {DEPTO_CLASSIFICACOES_ORDENADAS.map(c => (
                          <option key={c} value={c}>{DEPTO_CLASSIFICACAO_LABELS[c]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-400 text-[10px]">N/A</span>
                    )}
                  </td>
                  
                  {/* Tipo V */}
                  <td className="px-4 py-2 bg-blue-50/30">
                    {depto.temContaCom3ou4 ? (
                      <select
                        value={regra?.byTipoItem?.V ?? ''}
                        onChange={e => handleClassifyTipoItem(depto.prefix, 'V', e.target.value as DeptoClassificacao | '')}
                        className={`w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                          isPending && !regra?.byTipoItem?.V
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : 'border-blue-200 bg-white text-slate-700'
                        }`}
                      >
                        <option value="">— Selecione —</option>
                        {DEPTO_CLASSIFICACOES_ORDENADAS.map(c => (
                          <option key={c} value={c}>{DEPTO_CLASSIFICACAO_LABELS[c]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-400 text-[10px]">N/A</span>
                    )}
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
