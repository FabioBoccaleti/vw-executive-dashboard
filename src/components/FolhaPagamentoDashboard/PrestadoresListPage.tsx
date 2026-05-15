import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X, ChevronRight, UserCheck, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadPrestadores,
  savePrestadores,
  addPrestador,
  updatePrestador,
  deletePrestador,
  loadDescricaoExtras,
  addDescricaoExtra,
  removeDescricaoExtra,
  DESCRICAO_PADRAO,
  DESCRICAO_TRIMESTRAL,
  LUCRO_TRIMESTRAL_DEPARTAMENTOS,
  type LucroTrimestralDepartamento,
  type PrestadorPJ,
  type ItemRemuneracao,
  type KpiPrestador,
  type PjBrand,
  type TipoRemuneracao,
  type BaseCalculoVariavel,
  BASE_CALCULO_LABELS,
} from './remPjStorage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRAND_LABEL: Record<PjBrand, string> = { vw: 'VW', audi: 'Audi' };
const TIPO_LABEL: Record<TipoRemuneracao, string> = { fixa: 'Fixa', variavel: 'Variável' };

const BASE_CALCULO_OPTIONS = Object.entries(BASE_CALCULO_LABELS) as [BaseCalculoVariavel, string][];

// Auto-preenchimento de base ao selecionar descrição de departamento
const DESCRICAO_TO_BASE: Record<string, BaseCalculoVariavel> = {
  'Lucro Operacional Veic. Novos Varejo': 'lucro_novos',
  'Lucro Operacional Veic. Novos VD / Direta': 'lucro_vd_direta',
  'Lucro Operacional Veic. Usados': 'lucro_usados',
  'Lucro Operacional Veíc. Novos Varejo e Veíc. Usados': 'lucro_novos_usados',
  'Lucro Operacional Peças e Oficina': 'lucro_pecas_oficina',
  'Lucro Operacional Peças': 'lucro_pecas',
  'Lucro Operacional Oficina': 'lucro_oficina',
  'Lucro Operacional Funilaria': 'lucro_funilaria',
};

function newItem(): ItemRemuneracao {
  return { id: crypto.randomUUID(), descricao: '', tipo: 'fixa', valorBase: 0 };
}

// ─── Dialog de Cadastro / Edição ──────────────────────────────────────────────

function PrestadorDialog({
  initial,
  onConfirm,
  onCancel,
  descricaoOpcoes,
  onAddDescricao,
  onRemoveDescricao,
}: {
  initial?: PrestadorPJ;
  onConfirm: (p: PrestadorPJ) => void;
  onCancel: () => void;
  descricaoOpcoes: string[];
  onAddDescricao: (d: string) => void;
  onRemoveDescricao: (d: string) => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState<Omit<PrestadorPJ, 'id' | 'ativo' | 'itens' | 'kpis'>>(
    {
      nome: initial?.nome ?? '',
      cnpjCpf: initial?.cnpjCpf ?? '',
      empresa: initial?.empresa ?? '',
      cargo: initial?.cargo ?? '',
      brand: initial?.brand ?? 'vw',
      dataInicio: initial?.dataInicio ?? '',
      temPremio: initial?.temPremio ?? false,
      percentualPremio: initial?.percentualPremio ?? undefined,
      itensPremioIds: initial?.itensPremioIds ?? [],
      deducaoBasePremio: initial?.deducaoBasePremio ?? undefined,
    }
  );
  const [itens, setItens] = useState<ItemRemuneracao[]>(
    initial?.itens?.length ? initial.itens : [newItem()]
  );
  const [kpis, setKpis] = useState<KpiPrestador[]>(initial?.kpis ?? []);
  const [novaDescricao, setNovaDescricao] = useState('');
  const [showNovaDescricao, setShowNovaDescricao] = useState(false);

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
      kpis,
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

          {/* Toggle Prêmio Adicional */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setForm(prev => ({ ...prev, temPremio: !prev.temPremio }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  form.temPremio ? 'bg-purple-600' : 'bg-slate-300'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  form.temPremio ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
              <span className="text-sm text-slate-700 font-medium">
                Tem direito a Prêmio Adicional
              </span>
            </label>
            {form.temPremio && (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.percentualPremio ?? ''}
                  onChange={e => setForm(prev => ({ ...prev, percentualPremio: parseFloat(e.target.value) || undefined }))}
                  className="w-20 border border-purple-300 rounded px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="0,00"
                />
                <span className="text-xs text-slate-500">%</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold border border-purple-200">
                  linha adicionada no demonstrativo
                </span>
              </div>
            )}
            {form.temPremio && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">Dedução da base:</span>
                <span className="text-xs text-slate-400">R$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.deducaoBasePremio ?? ''}
                  onChange={e => setForm(prev => ({ ...prev, deducaoBasePremio: parseFloat(e.target.value) || undefined }))}
                  className="w-32 border border-purple-300 rounded px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="0,00"
                />
                <span className="text-xs text-slate-400 italic">(opcional)</span>
              </div>
            )}
          </div>

          {/* Seleção de itens que compõem a base do prêmio */}
          {form.temPremio && itens.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 flex flex-col gap-2">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Base do Prêmio — itens incidentes</p>
              <div className="flex flex-wrap gap-2">
                {itens.filter(it => it.descricao).map(it => {
                  const marcado = (form.itensPremioIds ?? []).includes(it.id);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setForm(prev => ({
                        ...prev,
                        itensPremioIds: marcado
                          ? (prev.itensPremioIds ?? []).filter(id => id !== it.id)
                          : [...(prev.itensPremioIds ?? []), it.id],
                      }))}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                        marcado
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-slate-500 border-slate-300 hover:border-purple-400 hover:text-purple-600'
                      }`}
                    >
                      {it.descricao}
                      {marcado && form.percentualPremio != null && (
                        <span className="text-[10px] font-bold opacity-80">P {form.percentualPremio}%</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-purple-500">Clique para marcar os itens cujo valor entra na base de cálculo do Prêmio.</p>
            </div>
          )}

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
                      onChange={e => {
                        const desc = e.target.value;
                        const autoBase = DESCRICAO_TO_BASE[desc];
                        updateItem(item.id, {
                          descricao: desc,
                          ...(autoBase ? { tipo: 'variavel', baseCalculo: autoBase } : {}),
                        });
                      }}
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
                        descricao: item.descricao === 'Prêmio Adicional' ? '' : item.descricao,
                        valorBase: e.target.value === 'variavel' ? undefined : (item.valorBase ?? 0),
                        percentual: e.target.value === 'variavel' ? (item.percentual ?? undefined) : undefined,
                        baseCalculo: e.target.value === 'variavel' ? (item.baseCalculo ?? undefined) : undefined,
                        departamentos: e.target.value === 'variavel' ? item.departamentos : undefined,
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
                      <div className="flex items-center gap-1">
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
                      </div>
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-xs text-slate-500 whitespace-nowrap">Sobre:</span>
                        {item.descricao === DESCRICAO_TRIMESTRAL ? (
                          <span className="flex-1 border border-amber-200 rounded px-2.5 py-1.5 text-sm bg-amber-50 text-amber-800 font-medium">
                            Lucro Líquido do Trimestre
                          </span>
                        ) : (
                          <select
                            value={item.baseCalculo ?? ''}
                            onChange={e => updateItem(item.id, { baseCalculo: e.target.value as BaseCalculoVariavel || undefined })}
                            className="flex-1 border border-amber-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          >
                            <option value="">Selecione a base...</option>
                            {BASE_CALCULO_OPTIONS.map(([key, label]) => (
                              <option key={key} value={key}>{label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Chips de departamento — apenas para Lucro Operacional Trimestral */}
                  {item.descricao === DESCRICAO_TRIMESTRAL && (
                    <div className="pl-7 flex flex-col gap-1.5">
                      <span className="text-xs text-slate-500 font-medium">Departamentos considerados:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {LUCRO_TRIMESTRAL_DEPARTAMENTOS.map(dep => {
                          const ativo = (item.departamentos ?? []).includes(dep);
                          return (
                            <button
                              key={dep}
                              type="button"
                              onClick={() => {
                                const atual = item.departamentos ?? [];
                                const novos = ativo
                                  ? atual.filter(d => d !== dep)
                                  : [...atual, dep];
                                updateItem(item.id, { departamentos: novos as LucroTrimestralDepartamento[] });
                              }}
                              className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
                                ativo
                                  ? 'bg-teal-600 text-white border-teal-600'
                                  : 'bg-white text-slate-500 border-slate-300 hover:border-teal-400 hover:text-teal-600'
                              }`}
                            >
                              {dep}
                            </button>
                          );
                        })}
                      </div>
                      {(item.departamentos ?? []).length === 0 && (
                        <p className="text-[10px] text-amber-600">Selecione ao menos um departamento.</p>
                      )}
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
                  : item.tipo === 'premio'
                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
              title={item.tipo === 'variavel' && item.baseCalculo ? BASE_CALCULO_LABELS[item.baseCalculo] : undefined}
            >
              {item.descricao}
              {item.tipo === 'fixa' && item.valorBase
                ? ` · R$${item.valorBase.toLocaleString('pt-BR')}`
                : item.tipo === 'variavel'
                  ? ` · ${item.percentual != null ? item.percentual + '%' : 'var.'}${item.baseCalculo ? ' / ' + BASE_CALCULO_LABELS[item.baseCalculo].replace('LUCRO LÍQUIDO DO EXERCÍCIO - ', '') : ''}${item.descricao === DESCRICAO_TRIMESTRAL && item.departamentos?.length ? ' [' + item.departamentos.join(', ') + ']' : ''}`
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
  const [descricaoExtras, setDescricaoExtras] = useState<string[]>([]);

  useEffect(() => {
    loadPrestadores().then(list => {
      setPrestadores(list);
      setLoading(false);
    });
    loadDescricaoExtras().then(setDescricaoExtras);
  }, []);

  const todasDescricoes = [...DESCRICAO_PADRAO, ...descricaoExtras];

  async function handleAddDescricao(d: string) {
    await addDescricaoExtra(d);
    setDescricaoExtras(prev => [...prev, d]);
  }

  async function handleRemoveDescricao(d: string) {
    await removeDescricaoExtra(d);
    setDescricaoExtras(prev => prev.filter(e => e !== d));
  }

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
          descricaoOpcoes={todasDescricoes}
          onAddDescricao={handleAddDescricao}
          onRemoveDescricao={handleRemoveDescricao}
        />
      )}
    </div>
  );
}
