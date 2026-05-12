import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X, ChevronRight, UserCheck, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadPrestadores,
  savePrestadores,
  addPrestador,
  updatePrestador,
  deletePrestador,
  type PrestadorPJ,
  type ItemRemuneracao,
  type PjBrand,
  type TipoRemuneracao,
} from './remPjStorage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRAND_LABEL: Record<PjBrand, string> = { vw: 'VW', audi: 'Audi' };
const TIPO_LABEL: Record<TipoRemuneracao, string> = { fixa: 'Fixa', variavel: 'Variável' };

function newItem(): ItemRemuneracao {
  return { id: crypto.randomUUID(), descricao: '', tipo: 'fixa', valorBase: 0 };
}

// ─── Dialog de Cadastro / Edição ──────────────────────────────────────────────

function PrestadorDialog({
  initial,
  onConfirm,
  onCancel,
}: {
  initial?: PrestadorPJ;
  onConfirm: (p: PrestadorPJ) => void;
  onCancel: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState<Omit<PrestadorPJ, 'id' | 'ativo' | 'itens'>>({
    nome: initial?.nome ?? '',
    cnpjCpf: initial?.cnpjCpf ?? '',
    empresa: initial?.empresa ?? '',
    cargo: initial?.cargo ?? '',
    brand: initial?.brand ?? 'vw',
    dataInicio: initial?.dataInicio ?? '',
  });
  const [itens, setItens] = useState<ItemRemuneracao[]>(
    initial?.itens?.length ? initial.itens : [newItem()]
  );

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function addItemRow() {
    setItens(prev => [...prev, newItem()]);
  }

  function updateItem(id: string, patch: Partial<ItemRemuneracao>) {
    setItens(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }

  function removeItem(id: string) {
    setItens(prev => prev.filter(it => it.id !== id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) { toast.error('Informe o nome do prestador.'); return; }
    if (itens.length === 0) { toast.error('Adicione ao menos um item de remuneração.'); return; }
    for (const it of itens) {
      if (!it.descricao.trim()) { toast.error('Preencha a descrição de todos os itens.'); return; }
    }
    onConfirm({
      id: initial?.id ?? crypto.randomUUID(),
      ...form,
      ativo: initial?.ativo ?? true,
      itens,
      ordem: initial?.ordem,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <p className="font-semibold text-slate-800 text-sm">
            {isEdit ? 'Editar Prestador' : 'Cadastrar Prestador'}
          </p>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-5">
          {/* Dados básicos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                value={form.nome}
                onChange={e => setField('nome', e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="Nome completo do prestador"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CNPJ / CPF</label>
              <input
                value={form.cnpjCpf}
                onChange={e => setField('cnpjCpf', e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="00.000.000/0001-00"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</label>
              <input
                value={form.empresa}
                onChange={e => setField('empresa', e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="Razão social ou nome fantasia"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cargo / Função</label>
              <input
                value={form.cargo}
                onChange={e => setField('cargo', e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="ex: Consultor de TI"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data de Início</label>
              <input
                value={form.dataInicio}
                onChange={e => setField('dataInicio', e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="DD/MM/AAAA"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Marca <span className="text-red-500">*</span>
              </label>
              <select
                value={form.brand}
                onChange={e => setField('brand', e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                <option value="vw">VW</option>
                <option value="audi">Audi</option>
              </select>
            </div>
          </div>

          {/* Itens de remuneração */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Itens de Remuneração <span className="text-red-500">*</span>
              </p>
              <button
                type="button"
                onClick={addItemRow}
                className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar item
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {itens.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                  <span className="text-xs text-slate-400 w-5 text-center select-none">{idx + 1}</span>

                  <input
                    value={item.descricao}
                    onChange={e => updateItem(item.id, { descricao: e.target.value })}
                    className="flex-1 border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    placeholder="Descrição (ex: Honorários, Comissão)"
                  />

                  <select
                    value={item.tipo}
                    onChange={e => updateItem(item.id, { tipo: e.target.value as TipoRemuneracao, valorBase: e.target.value === 'variavel' ? undefined : (item.valorBase ?? 0) })}
                    className="border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="fixa">Fixa</option>
                    <option value="variavel">Variável</option>
                  </select>

                  {item.tipo === 'fixa' && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.valorBase ?? ''}
                        onChange={e => updateItem(item.id, { valorBase: parseFloat(e.target.value) || 0 })}
                        className="w-28 border border-slate-300 rounded px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-400"
                        placeholder="0,00"
                      />
                    </div>
                  )}

                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-5 py-2 font-semibold"
            >
              {isEdit ? 'Salvar alterações' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Card de Prestador ────────────────────────────────────────────────────────

function PrestadorCard({
  prestador,
  isAdmin,
  onClick,
  onEdit,
  onDelete,
  onToggleAtivo,
}: {
  prestador: PrestadorPJ;
  isAdmin: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAtivo: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const brandColor = prestador.brand === 'vw' ? '#001e50' : '#bb0a30';
  const brandBg    = prestador.brand === 'vw' ? 'bg-blue-50'  : 'bg-red-50';
  const brandText  = prestador.brand === 'vw' ? 'text-blue-700' : 'text-red-700';

  return (
    <div
      className={`bg-white rounded-xl border-2 shadow-sm transition-all duration-200 ${
        prestador.ativo ? 'border-slate-200 hover:border-teal-300 hover:shadow-md' : 'border-slate-100 opacity-60'
      }`}
    >
      {/* Barra de marca */}
      <div className="h-1 rounded-t-xl" style={{ backgroundColor: brandColor }} />

      <div className="p-4 flex flex-col gap-3">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${brandBg} ${brandText}`}
              >
                {BRAND_LABEL[prestador.brand]}
              </span>
              {!prestador.ativo && (
                <span className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  Inativo
                </span>
              )}
            </div>
            <p className="font-semibold text-slate-800 text-sm mt-1 truncate">{prestador.nome}</p>
            {prestador.empresa && (
              <p className="text-xs text-slate-500 truncate">{prestador.empresa}</p>
            )}
            {prestador.cargo && (
              <p className="text-xs text-slate-400 truncate">{prestador.cargo}</p>
            )}
          </div>

          {/* Ações admin */}
          {isAdmin && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {confirmDelete ? (
                <>
                  <span className="text-xs text-red-500">Excluir?</span>
                  <button onClick={onDelete} className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={onToggleAtivo} className="text-slate-300 hover:text-teal-500 p-1 rounded hover:bg-teal-50" title={prestador.ativo ? 'Desativar' : 'Ativar'}>
                    {prestador.ativo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button onClick={onEdit} className="text-slate-300 hover:text-slate-600 p-1 rounded hover:bg-slate-100" title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setConfirmDelete(true)} className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50" title="Excluir">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Itens de remuneração (resumo) */}
        <div className="flex flex-wrap gap-1.5">
          {prestador.itens.map(item => (
            <span
              key={item.id}
              className={`text-[0.65rem] px-2 py-0.5 rounded-full font-medium ${
                item.tipo === 'fixa'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {item.descricao}
              {item.tipo === 'fixa' && item.valorBase
                ? ` · R$${item.valorBase.toLocaleString('pt-BR')}`
                : item.tipo === 'variavel' ? ' (var.)' : ''}
            </span>
          ))}
        </div>

        {/* Botão abrir */}
        <button
          onClick={onClick}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 transition-colors text-xs font-semibold text-slate-600 hover:text-teal-700 mt-1"
        >
          <span>Ver demonstrativo</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

interface PrestadoresListPageProps {
  isAdmin: boolean;
  onOpenPrestador: (prestador: PrestadorPJ) => void;
}

export function PrestadoresListPage({ isAdmin, onOpenPrestador }: PrestadoresListPageProps) {
  const [prestadores, setPrestadores] = useState<PrestadorPJ[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showDialog, setShowDialog]   = useState(false);
  const [editTarget, setEditTarget]   = useState<PrestadorPJ | undefined>();
  const [filterBrand, setFilterBrand] = useState<'todos' | 'vw' | 'audi'>('todos');
  const [showInativos, setShowInativos] = useState(false);

  useEffect(() => {
    loadPrestadores().then(list => {
      setPrestadores(list);
      setLoading(false);
    });
  }, []);

  async function handleAdd(p: PrestadorPJ) {
    await addPrestador(p);
    setPrestadores(prev => [...prev, p]);
    setShowDialog(false);
    toast.success(`Prestador "${p.nome}" cadastrado.`);
  }

  async function handleUpdate(p: PrestadorPJ) {
    await updatePrestador(p);
    setPrestadores(prev => prev.map(x => x.id === p.id ? p : x));
    setEditTarget(undefined);
    toast.success('Prestador atualizado.');
  }

  async function handleDelete(id: string) {
    const nome = prestadores.find(p => p.id === id)?.nome ?? '';
    await deletePrestador(id);
    setPrestadores(prev => prev.filter(p => p.id !== id));
    toast.success(`Prestador "${nome}" excluído.`);
  }

  async function handleToggleAtivo(p: PrestadorPJ) {
    const updated = { ...p, ativo: !p.ativo };
    await updatePrestador(updated);
    setPrestadores(prev => prev.map(x => x.id === p.id ? updated : x));
    toast.success(`${updated.nome} ${updated.ativo ? 'ativado' : 'desativado'}.`);
  }

  const filtered = prestadores
    .filter(p => filterBrand === 'todos' || p.brand === filterBrand)
    .filter(p => showInativos || p.ativo);

  const vwCount   = prestadores.filter(p => p.brand === 'vw'   && p.ativo).length;
  const audiCount = prestadores.filter(p => p.brand === 'audi' && p.ativo).length;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-6xl mx-auto p-6 flex flex-col gap-6">

        {/* KPIs rápidos */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Ativos', value: vwCount + audiCount, bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
            { label: 'VW',           value: vwCount,             bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
            { label: 'Audi',         value: audiCount,           bg: 'bg-red-50',  text: 'text-red-700',  border: 'border-red-200'  },
          ].map(k => (
            <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-4 flex flex-col gap-1`}>
              <span className={`text-xs font-semibold uppercase tracking-wider ${k.text}`}>{k.label}</span>
              <span className={`text-2xl font-bold ${k.text}`}>{k.value}</span>
              <span className="text-xs text-slate-400">prestador{k.value !== 1 ? 'es' : ''} ativo{k.value !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filtro marca */}
          <div className="flex items-center bg-white rounded-lg border border-slate-200 overflow-hidden">
            {(['todos', 'vw', 'audi'] as const).map(b => (
              <button
                key={b}
                onClick={() => setFilterBrand(b)}
                className={`px-4 py-2 text-xs font-semibold transition-colors ${
                  filterBrand === b ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {b === 'todos' ? 'Todos' : b === 'vw' ? 'VW' : 'Audi'}
              </button>
            ))}
          </div>

          {/* Toggle inativos */}
          <button
            onClick={() => setShowInativos(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
              showInativos ? 'bg-slate-700 text-white border-slate-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {showInativos ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
            Mostrar inativos
          </button>

          <div className="flex-1" />

          {isAdmin && (
            <button
              onClick={() => { setEditTarget(undefined); setShowDialog(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Prestador
            </button>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <UserCheck className="w-10 h-10 opacity-30" />
            <p className="text-sm">
              {prestadores.length === 0 ? 'Nenhum prestador cadastrado ainda.' : 'Nenhum prestador encontrado com esse filtro.'}
            </p>
            {isAdmin && prestadores.length === 0 && (
              <button
                onClick={() => { setEditTarget(undefined); setShowDialog(true); }}
                className="text-xs text-teal-600 hover:underline font-medium"
              >
                Cadastrar o primeiro prestador
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <PrestadorCard
                key={p.id}
                prestador={p}
                isAdmin={isAdmin}
                onClick={() => onOpenPrestador(p)}
                onEdit={() => { setEditTarget(p); setShowDialog(true); }}
                onDelete={() => handleDelete(p.id)}
                onToggleAtivo={() => handleToggleAtivo(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      {showDialog && (
        <PrestadorDialog
          initial={editTarget}
          onConfirm={editTarget ? handleUpdate : handleAdd}
          onCancel={() => { setShowDialog(false); setEditTarget(undefined); }}
        />
      )}
    </div>
  );
}
