import { useState, useEffect, useMemo } from 'react';
import { Pencil, Trash2, Check, X, Plus, RefreshCw, FolderTree } from 'lucide-react';
import { toast } from 'sonner';
import {
  getSegmentos,
  setSegmentos,
  getAnosCadastrados,
  getRegrasDepartamentos,
  getSegmentacaoConfig,
  setSegmentacaoConfig,
  type Segmento,
  type RegraDepartamento,
} from './passagemStorage';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function SegmentacaoSection() {
  const [segmentos, setSegmentosState] = useState<Segmento[]>([]);
  const [anos, setAnos] = useState<number[]>([]);
  const [departamentos, setDepartamentos] = useState<RegraDepartamento[]>([]);
  const [departamentoIds, setDepartamentoIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [novoNome, setNovoNome] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');

  useEffect(() => {
    Promise.all([
      getSegmentos(),
      getAnosCadastrados(),
      getRegrasDepartamentos(),
      getSegmentacaoConfig(),
    ]).then(([s, a, deps, cfg]) => {
      setSegmentosState(s);
      setAnos(a);
      setDepartamentos(deps.filter(d => d.departamentos.length > 0));
      setDepartamentoIds(cfg.departamentoIds);
      setLoading(false);
    });
  }, []);

  // Mapa: ano → id do segmento que o contém
  const ownerByAno = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of segmentos) for (const ano of s.anos) map.set(ano, s.id);
    return map;
  }, [segmentos]);

  const nomeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of segmentos) map.set(s.id, s.nome);
    return map;
  }, [segmentos]);

  const naoSegmentados = useMemo(
    () => anos.filter(a => !ownerByAno.has(a)).length,
    [anos, ownerByAno],
  );

  const sugestaoNome = useMemo(() => `Segmento ${segmentos.length + 1}`, [segmentos.length]);

  const persist = async (updated: Segmento[]) => {
    setSaving(true);
    try {
      const ok = await setSegmentos(updated);
      if (!ok) toast.error('Erro ao salvar.');
      else setSegmentosState(updated);
      return ok;
    } finally {
      setSaving(false);
    }
  };

  const refreshAnos = async () => {
    setRefreshing(true);
    try {
      const [a, deps] = await Promise.all([getAnosCadastrados(), getRegrasDepartamentos()]);
      setAnos(a);
      setDepartamentos(deps.filter(d => d.departamentos.length > 0));
      toast.success(`${a.length} ano(s) encontrado(s) na Regra Ano / Chassi.`);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleDepartamento = async (id: string) => {
    const atual = new Set(departamentoIds);
    if (atual.has(id)) atual.delete(id); else atual.add(id);
    const updated = [...atual];
    setDepartamentoIds(updated);
    const ok = await setSegmentacaoConfig({ departamentoIds: updated });
    if (!ok) toast.error('Erro ao salvar departamentos.');
  };

  const addSegmento = async () => {
    const nome = (novoNome.trim() || sugestaoNome);
    if (segmentos.some(s => s.nome.toLowerCase() === nome.toLowerCase())) {
      toast.error(`O segmento "${nome}" já existe.`); return;
    }
    const ok = await persist([...segmentos, { id: newId(), nome, anos: [] }]);
    if (ok) { setNovoNome(''); toast.success('Segmento criado.'); }
  };

  const saveEditNome = async () => {
    if (!editingId) return;
    const nome = editNome.trim();
    if (!nome) { toast.error('Informe o nome do segmento.'); return; }
    if (segmentos.some(s => s.nome.toLowerCase() === nome.toLowerCase() && s.id !== editingId)) {
      toast.error(`O segmento "${nome}" já existe.`); return;
    }
    const ok = await persist(segmentos.map(s => s.id === editingId ? { ...s, nome } : s));
    if (ok) { setEditingId(null); toast.success('Segmento atualizado.'); }
  };

  const removeSegmento = async (id: string) => {
    const ok = await persist(segmentos.filter(s => s.id !== id));
    if (ok) toast.success('Segmento removido.');
  };

  const toggleAno = async (segmentoId: string, ano: number) => {
    const owner = ownerByAno.get(ano);
    // Exclusividade: um ano não pode estar em mais de um segmento
    if (owner && owner !== segmentoId) {
      toast.error(`O ano ${ano} já pertence ao "${nomeById.get(owner)}".`);
      return;
    }
    const updated = segmentos.map(s => {
      if (s.id !== segmentoId) return s;
      const has = s.anos.includes(ano);
      return {
        ...s,
        anos: has
          ? s.anos.filter(a => a !== ano)
          : [...s.anos, ano].sort((a, b) => a - b),
      };
    });
    await persist(updated);
  };

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Carregando...</div>;

  return (
    <div>
      {/* Departamentos considerados no cálculo (global) */}
      <div className="mb-5 border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-3 border-b">
          <FolderTree className="w-4 h-4 text-slate-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-800">Departamentos considerados</h3>
            <p className="text-xs text-slate-400">Define quais departamentos entram no cálculo da segmentação (vale para todos os segmentos).</p>
          </div>
        </div>
        <div className="p-4">
          {departamentos.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              Nenhum departamento criado. Crie grupos em "Regra Departamentos".
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {departamentos.map(dep => {
                  const checked = departamentoIds.includes(dep.id);
                  return (
                    <label
                      key={dep.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors cursor-pointer ${
                        checked
                          ? 'border-blue-300 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDepartamento(dep.id)}
                        className="accent-blue-600"
                      />
                      <span className="font-semibold truncate">{dep.nome}</span>
                    </label>
                  );
                })}
              </div>
              {departamentoIds.length === 0 && (
                <p className="text-xs text-amber-600 mt-3">
                  Nenhum departamento marcado — a análise de segmentação ficará zerada. Marque ao menos um.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Criar segmento */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          placeholder={`Nome do segmento (ex. ${sugestaoNome})`}
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addSegmento(); }}
          className="flex-1 min-w-[220px] border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={addSegmento}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Criar segmento
        </button>
      </div>

      {/* Info de anos detectados */}
      <div className="flex items-center justify-between mb-5 text-xs text-slate-500">
        <span>
          {anos.length} ano(s) cadastrado(s) na Regra Ano / Chassi
          {anos.length > 0 && <> · <span className="font-semibold text-slate-600">{naoSegmentados}</span> sem segmento</>}
        </span>
        <button
          onClick={refreshAnos}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar anos
        </button>
      </div>

      {segmentos.length === 0 && (
        <div className="text-center text-slate-400 text-sm py-10 border border-dashed rounded-lg">
          Nenhum segmento criado. Crie um segmento (ex. Segmento 1, Segmento 2) para começar.
        </div>
      )}

      {/* Cards de segmentos */}
      <div className="space-y-4">
        {segmentos.map(segmento => (
          <div key={segmento.id} className="border rounded-lg overflow-hidden">
            {/* Cabeçalho do segmento */}
            <div className="flex items-center justify-between bg-slate-50 px-4 py-3 border-b">
              {editingId === segmento.id ? (
                <input
                  value={editNome}
                  onChange={e => setEditNome(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEditNome(); if (e.key === 'Escape') setEditingId(null); }}
                  autoFocus
                  className="h-8 w-64 border border-slate-200 rounded px-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              ) : (
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-bold text-slate-800">{segmento.nome}</h3>
                  <span className="text-xs text-slate-400">{segmento.anos.length} ano(s)</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                {editingId === segmento.id ? (
                  <>
                    <button onClick={saveEditNome} disabled={saving} className="text-green-600 hover:text-green-700 p-1 rounded"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded"><X className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditingId(segmento.id); setEditNome(segmento.nome); }} className="text-blue-500 hover:text-blue-700 p-1 rounded"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => removeSegmento(segmento.id)} className="text-red-400 hover:text-red-600 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            </div>

            {/* Lista de anos (checkboxes) */}
            <div className="p-4">
              {anos.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Nenhum ano cadastrado. Cadastre anos em "Regra Ano / Chassi" e clique em "Atualizar anos".
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {anos.map(ano => {
                    const owner = ownerByAno.get(ano);
                    const checked = owner === segmento.id;
                    const lockedByOther = !!owner && owner !== segmento.id;
                    return (
                      <label
                        key={ano}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
                          checked
                            ? 'border-blue-300 bg-blue-50 text-blue-800'
                            : lockedByOther
                              ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer'
                        }`}
                        title={lockedByOther ? `Já pertence ao "${nomeById.get(owner!)}"` : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving || lockedByOther}
                          onChange={() => toggleAno(segmento.id, ano)}
                          className="accent-blue-600"
                        />
                        <span className="font-semibold">{ano}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
