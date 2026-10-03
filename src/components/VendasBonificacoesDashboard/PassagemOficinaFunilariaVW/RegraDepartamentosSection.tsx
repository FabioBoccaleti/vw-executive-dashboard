import { useState, useEffect, useMemo } from 'react';
import { Pencil, Trash2, Check, X, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import {
  getRegrasDepartamentos,
  setRegrasDepartamentos,
  getDepartamentosDistintos,
  defaultRegraContagem,
  type RegraDepartamento,
  type RegraContagem,
  type FiltroValorOS,
  type ModoContagem,
} from './passagemStorage';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function RegraDepartamentosSection() {
  const [grupos, setGrupos] = useState<RegraDepartamento[]>([]);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [novoNome, setNovoNome] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');

  useEffect(() => {
    Promise.all([getRegrasDepartamentos(), getDepartamentosDistintos()]).then(([g, d]) => {
      setGrupos(g);
      setDepartamentos(d);
      setLoading(false);
    });
  }, []);

  // Mapa: departamento bruto → id do grupo que o contém
  const ownerByDepartamento = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of grupos) for (const d of g.departamentos) map.set(d, g.id);
    return map;
  }, [grupos]);

  const nomeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of grupos) map.set(g.id, g.nome);
    return map;
  }, [grupos]);

  // Departamentos que ainda não existem em nenhum grupo (para exibir mesmo sem import)
  const naoAgrupados = useMemo(
    () => departamentos.filter(d => !ownerByDepartamento.has(d)).length,
    [departamentos, ownerByDepartamento],
  );

  const persist = async (updated: RegraDepartamento[]) => {
    setSaving(true);
    try {
      const ok = await setRegrasDepartamentos(updated);
      if (!ok) toast.error('Erro ao salvar.');
      else setGrupos(updated);
      return ok;
    } finally {
      setSaving(false);
    }
  };

  const refreshDepartamentos = async () => {
    setRefreshing(true);
    try {
      const d = await getDepartamentosDistintos();
      setDepartamentos(d);
      toast.success(`${d.length} departamento(s) encontrado(s).`);
    } finally {
      setRefreshing(false);
    }
  };

  const addGrupo = async () => {
    const nome = novoNome.trim();
    if (!nome) { toast.error('Informe o nome do departamento.'); return; }
    if (grupos.some(g => g.nome.toLowerCase() === nome.toLowerCase())) {
      toast.error(`O grupo "${nome}" já existe.`); return;
    }
    const ok = await persist([...grupos, { id: newId(), nome, departamentos: [], contagem: defaultRegraContagem() }]);
    if (ok) { setNovoNome(''); toast.success('Grupo criado.'); }
  };

  const saveEditNome = async () => {
    if (!editingId) return;
    const nome = editNome.trim();
    if (!nome) { toast.error('Informe o nome do departamento.'); return; }
    if (grupos.some(g => g.nome.toLowerCase() === nome.toLowerCase() && g.id !== editingId)) {
      toast.error(`O grupo "${nome}" já existe.`); return;
    }
    const ok = await persist(grupos.map(g => g.id === editingId ? { ...g, nome } : g));
    if (ok) { setEditingId(null); toast.success('Grupo atualizado.'); }
  };

  const removeGrupo = async (id: string) => {
    const ok = await persist(grupos.filter(g => g.id !== id));
    if (ok) toast.success('Grupo removido.');
  };

  const toggleDepartamento = async (grupoId: string, dep: string) => {
    const owner = ownerByDepartamento.get(dep);
    // Exclusividade: não deixa marcar se já pertence a outro grupo
    if (owner && owner !== grupoId) {
      toast.error(`"${dep}" já pertence ao grupo "${nomeById.get(owner)}".`);
      return;
    }
    const updated = grupos.map(g => {
      if (g.id !== grupoId) return g;
      const has = g.departamentos.includes(dep);
      return {
        ...g,
        departamentos: has
          ? g.departamentos.filter(d => d !== dep)
          : [...g.departamentos, dep],
      };
    });
    await persist(updated);
  };

  const updateContagem = async (grupoId: string, patch: Partial<RegraContagem>) => {
    const updated = grupos.map(g =>
      g.id === grupoId
        ? { ...g, contagem: { ...(g.contagem ?? defaultRegraContagem()), ...patch } }
        : g,
    );
    await persist(updated);
  };

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>;

  return (
    <div>
      {/* Criar grupo */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          placeholder="Nome do departamento (ex. Oficina)"
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addGrupo(); }}
          className="flex-1 min-w-[220px] border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={addGrupo}
          disabled={saving || !novoNome.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Criar departamento
        </button>
      </div>

      {/* Info de departamentos detectados */}
      <div className="flex items-center justify-between mb-5 text-xs text-slate-500">
        <span>
          {departamentos.length} departamento(s) detectado(s) nas passagens importadas
          {departamentos.length > 0 && <> · <span className="font-semibold text-slate-600">{naoAgrupados}</span> sem grupo</>}
        </span>
        <button
          onClick={refreshDepartamentos}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar lista
        </button>
      </div>

      {grupos.length === 0 && (
        <div className="text-center text-slate-400 text-sm py-10 border border-dashed rounded-lg">
          Nenhum departamento criado. Crie um grupo (ex. Oficina, Funilaria) para começar.
        </div>
      )}

      {/* Cards de grupos */}
      <div className="space-y-4">
        {grupos.map(grupo => (
          <div key={grupo.id} className="border rounded-lg overflow-hidden">
            {/* Cabeçalho do grupo */}
            <div className="flex items-center justify-between bg-slate-50 px-4 py-3 border-b">
              {editingId === grupo.id ? (
                <input
                  value={editNome}
                  onChange={e => setEditNome(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEditNome(); if (e.key === 'Escape') setEditingId(null); }}
                  autoFocus
                  className="h-8 w-64 border border-slate-200 rounded px-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              ) : (
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-bold text-slate-800">{grupo.nome}</h3>
                  <span className="text-xs text-slate-400">{grupo.departamentos.length} departamento(s)</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                {editingId === grupo.id ? (
                  <>
                    <button onClick={saveEditNome} disabled={saving} className="text-green-600 hover:text-green-700 p-1 rounded"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded"><X className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditingId(grupo.id); setEditNome(grupo.nome); }} className="text-blue-500 hover:text-blue-700 p-1 rounded"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => removeGrupo(grupo.id)} className="text-red-400 hover:text-red-600 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            </div>

            {/* Lista de departamentos (checkboxes) */}
            <div className="p-4">
              {departamentos.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Nenhum departamento detectado. Importe passagens e clique em "Atualizar lista".
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {departamentos.map(dep => {
                    const owner = ownerByDepartamento.get(dep);
                    const checked = owner === grupo.id;
                    const lockedByOther = !!owner && owner !== grupo.id;
                    return (
                      <label
                        key={dep}
                        className={`flex items-start gap-2 px-3 py-2 rounded-md border text-xs transition-colors ${
                          checked
                            ? 'border-blue-300 bg-blue-50'
                            : lockedByOther
                              ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                              : 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving || lockedByOther}
                          onChange={() => toggleDepartamento(grupo.id, dep)}
                          className="mt-0.5 accent-blue-600"
                        />
                        <span className="flex-1">
                          <span className={checked ? 'font-semibold text-blue-800' : 'text-slate-700'}>{dep}</span>
                          {lockedByOther && (
                            <span className="block text-[10px] text-slate-400 mt-0.5">já em: {nomeById.get(owner!)}</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Regra de contagem de passagens */}
            {(() => {
              const regra: RegraContagem = grupo.contagem ?? defaultRegraContagem();
              const filtroOpcoes: { value: FiltroValorOS; label: string }[] = [
                { value: 'todas', label: 'Todas' },
                { value: 'zero', label: 'Somente = R$ 0,00' },
                { value: 'positivo', label: 'Somente > R$ 0,00' },
              ];
              const modoOpcoes: { value: ModoContagem; label: string; hint: string }[] = [
                { value: 'porDia', label: '1 por dia', hint: 'OS no mesmo dia = 1 passagem' },
                { value: 'porMes', label: '1 no mês', hint: 'Todo o chassi no mês = 1 passagem' },
                { value: 'porOs', label: '1 por OS', hint: 'Cada OS conta como passagem' },
              ];
              return (
                <div className="border-t bg-slate-50/60 px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-3">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Regra de contagem</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    {/* Filtro de valor */}
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Filtro de valor (Total OS)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {filtroOpcoes.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => updateContagem(grupo.id, { filtroValor: opt.value })}
                            disabled={saving}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors disabled:opacity-50 ${
                              regra.filtroValor === opt.value
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Modo de contagem */}
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Modo de contagem</p>
                      <div className="flex flex-wrap gap-1.5">
                        {modoOpcoes.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => updateContagem(grupo.id, { modoContagem: opt.value })}
                            disabled={saving}
                            title={opt.hint}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors disabled:opacity-50 ${
                              regra.modoContagem === opt.value
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {modoOpcoes.find(o => o.value === regra.modoContagem)?.hint}
                      </p>
                    </div>
                  </div>

                  {/* Considerar categoria */}
                  <label className={`inline-flex items-center gap-2 mt-3 text-[11px] ${regra.modoContagem === 'porOs' ? 'opacity-50' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={regra.considerarCategoria}
                      disabled={saving || regra.modoContagem === 'porOs'}
                      onChange={e => updateContagem(grupo.id, { considerarCategoria: e.target.checked })}
                      className="accent-blue-600"
                    />
                    <span className="text-slate-600 font-medium">Considerar categoria</span>
                    <span className="text-slate-400">— categorias diferentes contam como passagens diferentes</span>
                  </label>
                </div>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
