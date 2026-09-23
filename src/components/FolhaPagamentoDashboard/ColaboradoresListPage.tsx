import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X, ChevronRight, Users, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadColaboradores,
  addColaborador,
  updateColaborador,
  deleteColaborador,
  loadDescricaoExtras,
  addDescricaoExtra,
  removeDescricaoExtra,
  DESCRICAO_PADRAO,
  type Colaborador,
  type ItemRemuneracaoRV,
  type KpiColaborador,
  type RvBrand,
  type TipoRemuneracao,
} from './remVariaveisStorage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRAND_LABEL: Record<RvBrand, string> = { vw: 'VW', audi: 'Audi' };

function newItem(): ItemRemuneracaoRV {
  return { id: crypto.randomUUID(), descricao: '', tipo: 'fixa', valorBase: 0 };
}

// ─── Dialog de Cadastro / Edição ──────────────────────────────────────────────

function ColaboradorDialog({
  initial,
  onConfirm,
  onCancel,
  descricaoOpcoes,
  onAddDescricao,
}: {
  initial?: Colaborador;
  onConfirm: (c: Colaborador) => void;
  onCancel: () => void;
  descricaoOpcoes: string[];
  onAddDescricao: (d: string) => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    nome: initial?.nome ?? '',
    cargo: initial?.cargo ?? '',
    departamento: initial?.departamento ?? '',
    brand: (initial?.brand ?? 'vw') as RvBrand,
  });
  const [itens, setItens] = useState<ItemRemuneracaoRV[]>(
    initial?.itens?.length ? initial.itens.map(i => ({ ...i })) : [newItem()]
  );
  const [kpis, setKpis] = useState<KpiColaborador[]>(initial?.kpis ?? []);
  const [novaDescricao, setNovaDescricao] = useState('');
  const [showNovaDescricao, setShowNovaDescricao] = useState(false);

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function addItemRow() {
    setItens(prev => [...prev, newItem()]);
  }

  function updateItem(id: string, patch: Partial<ItemRemuneracaoRV>) {
    setItens(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }

  function removeItem(id: string) {
    setItens(prev => prev.filter(it => it.id !== id));
  }

  function handleConfirmNovaDescricao() {
    const val = novaDescricao.trim();
    if (!val) return;
    if (descricaoOpcoes.includes(val)) {
      toast.error('Essa descrição já existe na lista.');
      return;
    }
    onAddDescricao(val);
    setNovaDescricao('');
    setShowNovaDescricao(false);
    toast.success(`"${val}" adicionado à lista.`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) { toast.error('Informe o nome do colaborador.'); return; }
    if (itens.length === 0) { toast.error('Adicione ao menos um item de remuneração.'); return; }
    for (const it of itens) {
      if (!it.descricao.trim()) { toast.error('Preencha a descrição de todos os itens.'); return; }
    }
    onConfirm({
      id: initial?.id ?? crypto.randomUUID(),
      nome: form.nome,
      cargo: form.cargo || undefined,
      departamento: form.departamento || undefined,
      brand: form.brand,
      ativo: initial?.ativo ?? true,
      itens: itens.map(item => ({
        id: item.id,
        descricao: item.descricao,
        tipo: item.tipo,
        valorBase: item.tipo === 'fixa' ? (item.valorBase ?? 0) : undefined,
        percentual: item.tipo === 'variavel' ? item.percentual : undefined,
      })),
      kpis,
      ordem: initial?.ordem,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <p className="font-semibold text-slate-800 text-sm">
            {isEdit ? 'Editar Colaborador' : 'Cadastrar Colaborador'}
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
                placeholder="Nome completo do colaborador"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cargo / Função</label>
              <input
                value={form.cargo}
                onChange={e => setField('cargo', e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="ex: Consultor de Vendas"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Departamento</label>
              <input
                value={form.departamento}
                onChange={e => setField('departamento', e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="ex: Comercial"
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNovaDescricao(v => !v)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-semibold border border-slate-200 rounded px-2 py-1 hover:bg-slate-50"
                  title="Cadastrar nova opção de descrição"
                >
                  <Plus className="w-3 h-3" />
                  Nova opção
                </button>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar item
                </button>
              </div>
            </div>

            {/* Painel inline para cadastrar nova opção de descrição */}
            {showNovaDescricao && (
              <div className="mb-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <input
                  value={novaDescricao}
                  onChange={e => setNovaDescricao(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleConfirmNovaDescricao(); } }}
                  className="flex-1 border border-blue-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  placeholder="Nome da nova opção..."
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleConfirmNovaDescricao}
                  className="flex items-center gap-1 text-xs bg-blue-600 text-white rounded px-3 py-1.5 font-semibold hover:bg-blue-700"
                >
                  <Check className="w-3.5 h-3.5" />
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNovaDescricao(false); setNovaDescricao(''); }}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {itens.map((item, idx) => (
                <div key={item.id} className="flex flex-col gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                  {/* Linha principal */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-5 text-center select-none">{idx + 1}</span>

                    <select
                      value={item.descricao}
                      onChange={e => updateItem(item.id, { descricao: e.target.value })}
                      className="flex-1 border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                    >
                      <option value="">Selecione a descrição...</option>
                      {descricaoOpcoes.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>

                    <select
                      value={item.tipo}
                      onChange={e => updateItem(item.id, {
                        tipo: e.target.value as TipoRemuneracao,
                        valorBase: e.target.value === 'variavel' ? undefined : (item.valorBase ?? 0),
                        percentual: e.target.value === 'variavel' ? (item.percentual ?? undefined) : undefined,
                      })}
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

                  {/* Linha extra para variável */}
                  {item.tipo === 'variavel' && (
                    <div className="flex items-center gap-2 pl-7">
                      <span className="text-xs text-slate-500 whitespace-nowrap">% sobre a base:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.percentual ?? ''}
                        onChange={e => updateItem(item.id, { percentual: parseFloat(e.target.value) || undefined })}
                        className="w-20 border border-amber-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="0,00"
                      />
                      <span className="text-xs text-slate-400">%</span>
                      <span className="text-[10px] text-slate-400 italic">
                        A base é informada mês a mês no demonstrativo.
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">KPIs de Remuneração</p>
              <button
                type="button"
                onClick={() => setKpis(prev => [...prev, { id: crypto.randomUUID(), descricao: '', itemRemuneracaoId: '', percentualBonus: 0 }])}
                className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar KPI
              </button>
            </div>
            {kpis.length === 0 && (
              <p className="text-xs text-slate-400 italic">Nenhum KPI cadastrado. KPIs permitem aumentar o % de itens variáveis ao serem atingidos.</p>
            )}
            {kpis.map((kpi, idx) => {
              const itensVariaveis = itens.filter(it => it.tipo === 'variavel' && it.descricao);
              return (
                <div key={kpi.id} className="flex flex-col gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-teal-500 font-bold w-5 text-center">{idx + 1}</span>
                    <input
                      value={kpi.descricao}
                      onChange={e => setKpis(prev => prev.map(k => k.id === kpi.id ? { ...k, descricao: e.target.value } : k))}
                      placeholder="Descrição do KPI (ex: CSI acima de 90%)"
                      className="flex-1 border border-teal-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setKpis(prev => prev.filter(k => k.id !== kpi.id))}
                      className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <span className="text-xs text-slate-500 whitespace-nowrap">Item afetado:</span>
                    <select
                      value={kpi.itemRemuneracaoId}
                      onChange={e => setKpis(prev => prev.map(k => k.id === kpi.id ? { ...k, itemRemuneracaoId: e.target.value } : k))}
                      className="flex-1 border border-teal-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                    >
                      <option value="">Selecione o item variável...</option>
                      {itensVariaveis.map(it => (
                        <option key={it.id} value={it.id}>{it.descricao}</option>
                      ))}
                    </select>
                    <span className="text-xs text-slate-500 whitespace-nowrap">Bônus:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={kpi.percentualBonus || ''}
                      onChange={e => setKpis(prev => prev.map(k => k.id === kpi.id ? { ...k, percentualBonus: parseFloat(e.target.value) || 0 } : k))}
                      className="w-20 border border-teal-300 rounded px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                      placeholder="0,00"
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <span className="text-xs text-slate-500 whitespace-nowrap">Objetivo:</span>
                    <select
                      value={kpi.condicao ?? '>='}
                      onChange={e => setKpis(prev => prev.map(k => k.id === kpi.id ? { ...k, condicao: e.target.value as '>=' | '<=' } : k))}
                      className="border border-teal-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                    >
                      <option value=">=">≥ Maior ou igual</option>
                      <option value="<=">≤ Menor ou igual</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={kpi.objetivo ?? ''}
                      onChange={e => setKpis(prev => prev.map(k => k.id === kpi.id ? { ...k, objetivo: parseFloat(e.target.value) || undefined } : k))}
                      className="w-28 border border-teal-300 rounded px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                      placeholder="ex: 90"
                    />
                    <input
                      value={kpi.unidade ?? ''}
                      onChange={e => setKpis(prev => prev.map(k => k.id === kpi.id ? { ...k, unidade: e.target.value || undefined } : k))}
                      className="w-20 border border-teal-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                      placeholder="unid."
                    />
                    <span className="text-xs text-slate-400 italic">(unidade opcional, ex: %, R$, unid.)</span>
                  </div>
                </div>
              );
            })}
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

// ─── Card de Colaborador ──────────────────────────────────────────────────────

function ColaboradorCard({
  colaborador,
  isAdmin,
  onClick,
  onEdit,
  onDelete,
  onToggleAtivo,
}: {
  colaborador: Colaborador;
  isAdmin: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAtivo: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const brandColor = colaborador.brand === 'vw' ? '#001e50' : '#bb0a30';
  const brandBg    = colaborador.brand === 'vw' ? 'bg-blue-50'  : 'bg-red-50';
  const brandText  = colaborador.brand === 'vw' ? 'text-blue-700' : 'text-red-700';

  return (
    <div
      className={`bg-white rounded-xl border-2 shadow-sm transition-all duration-200 ${
        colaborador.ativo ? 'border-slate-200 hover:border-teal-300 hover:shadow-md' : 'border-slate-100 opacity-60'
      }`}
    >
      <div className="h-1 rounded-t-xl" style={{ backgroundColor: brandColor }} />

      <div className="p-4 flex flex-col gap-3">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${brandBg} ${brandText}`}>
                {BRAND_LABEL[colaborador.brand]}
              </span>
              {!colaborador.ativo && (
                <span className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  Inativo
                </span>
              )}
            </div>
            <p className="font-semibold text-slate-800 text-sm mt-1 truncate">{colaborador.nome}</p>
            {colaborador.cargo && (
              <p className="text-xs text-slate-500 truncate">{colaborador.cargo}</p>
            )}
            {colaborador.departamento && (
              <p className="text-xs text-slate-400 truncate">{colaborador.departamento}</p>
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
                  <button onClick={onToggleAtivo} className="text-slate-300 hover:text-teal-500 p-1 rounded hover:bg-teal-50" title={colaborador.ativo ? 'Desativar' : 'Ativar'}>
                    {colaborador.ativo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
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
          {colaborador.itens.map(item => (
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
                : item.tipo === 'variavel'
                  ? ` · ${item.percentual != null ? item.percentual + '%' : 'var.'}`
                  : ''}
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

interface ColaboradoresListPageProps {
  isAdmin: boolean;
  onOpenColaborador: (colaborador: Colaborador) => void;
}

export function ColaboradoresListPage({ isAdmin, onOpenColaborador }: ColaboradoresListPageProps) {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showDialog, setShowDialog]   = useState(false);
  const [editTarget, setEditTarget]   = useState<Colaborador | undefined>();
  const [filterBrand, setFilterBrand] = useState<'todos' | 'vw' | 'audi'>('todos');
  const [showInativos, setShowInativos] = useState(false);
  const [descricaoExtras, setDescricaoExtras] = useState<string[]>([]);

  useEffect(() => {
    loadColaboradores().then(list => {
      setColaboradores(list);
      setLoading(false);
    });
    loadDescricaoExtras().then(setDescricaoExtras);
  }, []);

  const todasDescricoes = [...DESCRICAO_PADRAO, ...descricaoExtras];

  async function handleAddDescricao(d: string) {
    await addDescricaoExtra(d);
    setDescricaoExtras(prev => [...prev, d]);
  }

  async function handleAdd(c: Colaborador) {
    await addColaborador(c);
    setColaboradores(prev => [...prev, c]);
    setShowDialog(false);
    toast.success(`Colaborador "${c.nome}" cadastrado.`);
  }

  async function handleUpdate(c: Colaborador) {
    await updateColaborador(c);
    setColaboradores(prev => prev.map(x => x.id === c.id ? c : x));
    setEditTarget(undefined);
    setShowDialog(false);
    toast.success('Colaborador atualizado.');
  }

  async function handleDelete(id: string) {
    const nome = colaboradores.find(c => c.id === id)?.nome ?? '';
    await deleteColaborador(id);
    setColaboradores(prev => prev.filter(c => c.id !== id));
    toast.success(`Colaborador "${nome}" excluído.`);
  }

  async function handleToggleAtivo(c: Colaborador) {
    const updated = { ...c, ativo: !c.ativo };
    await updateColaborador(updated);
    setColaboradores(prev => prev.map(x => x.id === c.id ? updated : x));
    toast.success(`${updated.nome} ${updated.ativo ? 'ativado' : 'desativado'}.`);
  }

  const filtered = colaboradores
    .filter(c => filterBrand === 'todos' || c.brand === filterBrand)
    .filter(c => showInativos || c.ativo);

  const vwCount   = colaboradores.filter(c => c.brand === 'vw'   && c.ativo).length;
  const audiCount = colaboradores.filter(c => c.brand === 'audi' && c.ativo).length;

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
              <span className="text-xs text-slate-400">colaborador{k.value !== 1 ? 'es' : ''} ativo{k.value !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
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
              Cadastrar Colaborador
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
            <Users className="w-10 h-10 opacity-30" />
            <p className="text-sm">
              {colaboradores.length === 0 ? 'Nenhum colaborador cadastrado ainda.' : 'Nenhum colaborador encontrado com esse filtro.'}
            </p>
            {isAdmin && colaboradores.length === 0 && (
              <button
                onClick={() => { setEditTarget(undefined); setShowDialog(true); }}
                className="text-xs text-teal-600 hover:underline font-medium"
              >
                Cadastrar o primeiro colaborador
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => (
              <ColaboradorCard
                key={c.id}
                colaborador={c}
                isAdmin={isAdmin}
                onClick={() => onOpenColaborador(c)}
                onEdit={() => { setEditTarget(c); setShowDialog(true); }}
                onDelete={() => handleDelete(c.id)}
                onToggleAtivo={() => handleToggleAtivo(c)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      {showDialog && (
        <ColaboradorDialog
          initial={editTarget}
          onConfirm={editTarget ? handleUpdate : handleAdd}
          onCancel={() => { setShowDialog(false); setEditTarget(undefined); }}
          descricaoOpcoes={todasDescricoes}
          onAddDescricao={handleAddDescricao}
        />
      )}
    </div>
  );
}
