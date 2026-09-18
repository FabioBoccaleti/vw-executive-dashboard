import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Car, ClipboardList, LayoutGrid, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  CLASSIFICACAO_LABELS,
  CONDICAO_PAGAMENTO_LABELS,
  MODELOS,
  PRAZO_COMERCIALIZACAO_PADRAO,
  PRAZO_ELEGIBILIDADE_PADRAO,
  firstDayOfQuarterISO,
  getGrades,
  getVeiculos,
  lastDayOfQuarterISO,
  liberadoVendaVeiculo,
  saveGrades,
  saveVeiculos,
  situacaoVendaVeiculo,
  veiculoGaranteGrade,
  vencimentoGradeVeiculo,
  type Classificacao,
  type CondicaoPagamento,
  type GradeExigenciaItem,
  type GradeTrimestre,
  type Modelo,
  type VeiculoGrade,
} from './gradeTestDriveStorage';

interface Props {
  onBack: () => void;
}

const TRIMESTRES = [1, 2, 3, 4];
const CLASSIFICACOES: Classificacao[] = ['test_drive', 'courtesy_car'];
const CONDICOES: CondicaoPagamento[] = [
  'a_vista',
  'a_prazo',
  'financiamento_banco_volks',
  'floor_plan_banco_volks',
  'floor_plan_itau',
  'financiamento_outros',
];

function currentYear() {
  return new Date().getFullYear();
}

function currentQuarter() {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function GradeTestDriveAudiDashboard({ onBack }: Props) {
  const [activeTab, setActiveTab] = useState<'grade' | 'veiculos' | 'gestao'>('gestao');
  const [grades, setGrades] = useState<GradeTrimestre[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoGrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [loadedGrades, loadedVeiculos] = await Promise.all([getGrades(), getVeiculos()]);
      if (cancelled) return;
      setGrades(loadedGrades);
      setVeiculos(loadedVeiculos);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function persistGrades(next: GradeTrimestre[]) {
    setGrades(next);
    await saveGrades(next);
  }

  async function persistVeiculos(next: VeiculoGrade[]) {
    setVeiculos(next);
    await saveVeiculos(next);
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Grade de Test Drive Audi e Rentabilidade</h1>
          <p className="text-xs text-slate-500 mt-0.5">Demonstrativo de Vendas e Bonificações</p>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
        >
          ← Voltar
        </button>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <div className="flex border-b border-slate-200 bg-white rounded-t-lg">
          <TabButton active={activeTab === 'gestao'} onClick={() => setActiveTab('gestao')} icon={<LayoutGrid className="w-4 h-4" />}>
            Gestão da Grade
          </TabButton>
          <TabButton active={activeTab === 'grade'} onClick={() => setActiveTab('grade')} icon={<ClipboardList className="w-4 h-4" />}>
            Grade Exigida
          </TabButton>
          <TabButton active={activeTab === 'veiculos'} onClick={() => setActiveTab('veiculos')} icon={<Car className="w-4 h-4" />}>
            Veículos
          </TabButton>
        </div>

        <section className="bg-white rounded-b-lg shadow-sm p-4 md:p-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400">Carregando…</div>
          ) : activeTab === 'gestao' ? (
            <GestaoTab grades={grades} veiculos={veiculos} />
          ) : activeTab === 'grade' ? (
            <GradeExigidaTab grades={grades} onSave={persistGrades} />
          ) : (
            <VeiculosTab veiculos={veiculos} grades={grades} onSave={persistVeiculos} />
          )}
        </section>
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${active ? 'border-cyan-600 text-cyan-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── Aba: Grade Exigida ─────────────────────────────────────────────────────

function GradeExigidaTab({ grades, onSave }: { grades: GradeTrimestre[]; onSave: (next: GradeTrimestre[]) => Promise<void> }) {
  const [ano, setAno] = useState(currentYear());
  const [trimestre, setTrimestre] = useState(currentQuarter());

  const grade = useMemo(
    () => grades.find(item => item.ano === ano && item.trimestre === trimestre) ?? null,
    [grades, ano, trimestre],
  );

  const [prazoComercializacao, setPrazoComercializacao] = useState(PRAZO_COMERCIALIZACAO_PADRAO);
  const [prazoElegibilidade, setPrazoElegibilidade] = useState(PRAZO_ELEGIBILIDADE_PADRAO);
  const [exigencias, setExigencias] = useState<GradeExigenciaItem[]>([]);

  useEffect(() => {
    setPrazoComercializacao(grade?.prazoComercializacaoDias ?? PRAZO_COMERCIALIZACAO_PADRAO);
    setPrazoElegibilidade(grade?.prazoElegibilidadeDias ?? PRAZO_ELEGIBILIDADE_PADRAO);
    setExigencias(grade?.exigencias ?? []);
  }, [grade]);

  const [novoModelo, setNovoModelo] = useState<Modelo>(MODELOS[0]);
  const [novaClassificacao, setNovaClassificacao] = useState<Classificacao>('test_drive');
  const [novaQuantidade, setNovaQuantidade] = useState(1);

  function addExigencia() {
    if (novaQuantidade < 1) {
      toast.error('A quantidade exigida deve ser pelo menos 1.');
      return;
    }
    const existe = exigencias.some(item => item.modelo === novoModelo && item.classificacao === novaClassificacao);
    if (existe) {
      toast.error('Já existe uma exigência para esse modelo e classificação.');
      return;
    }
    setExigencias(current => [...current, { modelo: novoModelo, classificacao: novaClassificacao, quantidade: novaQuantidade }]);
  }

  function removeExigencia(index: number) {
    setExigencias(current => current.filter((_, i) => i !== index));
  }

  async function salvar() {
    if (prazoComercializacao < 1 || prazoElegibilidade < 1) {
      toast.error('Os prazos devem ser maiores que zero.');
      return;
    }
    const proximo: GradeTrimestre = {
      ano,
      trimestre,
      prazoComercializacaoDias: prazoComercializacao,
      prazoElegibilidadeDias: prazoElegibilidade,
      exigencias,
    };
    const outros = grades.filter(item => !(item.ano === ano && item.trimestre === trimestre));
    await onSave([...outros, proximo].sort((a, b) => a.ano - b.ano || a.trimestre - b.trimestre));
    toast.success(`Grade do ${trimestre}º trimestre de ${ano} salva.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-slate-600">Ano
          <input type="number" value={ano} onChange={event => setAno(Number(event.target.value))} className="block mt-1 w-28 border border-slate-300 rounded px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-slate-600">Trimestre
          <select value={trimestre} onChange={event => setTrimestre(Number(event.target.value))} className="block mt-1 border border-slate-300 rounded px-3 py-2 text-sm">
            {TRIMESTRES.map(t => <option key={t} value={t}>{t}º trimestre</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">Prazo de comercialização (dias)
          <input type="number" value={prazoComercializacao} onChange={event => setPrazoComercializacao(Number(event.target.value))} className="block mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
          <span className="block mt-1 text-[11px] font-normal text-slate-400">A partir de compra + este prazo o veículo pode ser vendido.</span>
        </label>
        <label className="text-xs font-semibold text-slate-600">Prazo de elegibilidade (dias)
          <input type="number" value={prazoElegibilidade} onChange={event => setPrazoElegibilidade(Number(event.target.value))} className="block mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
          <span className="block mt-1 text-[11px] font-normal text-slate-400">Compra + este prazo define o vencimento na grade.</span>
        </label>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Exigências por modelo e classificação</h3>
        <div className="flex flex-wrap items-end gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <label className="text-xs font-semibold text-slate-600">Modelo
            <select value={novoModelo} onChange={event => setNovoModelo(event.target.value as Modelo)} className="block mt-1 border border-slate-300 rounded px-3 py-2 text-sm">
              {MODELOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Classificação
            <select value={novaClassificacao} onChange={event => setNovaClassificacao(event.target.value as Classificacao)} className="block mt-1 border border-slate-300 rounded px-3 py-2 text-sm">
              {CLASSIFICACOES.map(c => <option key={c} value={c}>{CLASSIFICACAO_LABELS[c]}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Quantidade exigida
            <input type="number" min={1} value={novaQuantidade} onChange={event => setNovaQuantidade(Number(event.target.value))} className="block mt-1 w-28 border border-slate-300 rounded px-3 py-2 text-sm" />
          </label>
          <button onClick={addExigencia} className="flex items-center gap-1 bg-cyan-600 text-white rounded px-3 py-2 text-sm font-semibold hover:bg-cyan-700">
            <Plus className="w-4 h-4" />Adicionar
          </button>
        </div>

        {exigencias.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma exigência cadastrada para este trimestre.</p>
        ) : (
          <div className="overflow-auto border border-slate-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Modelo</th>
                  <th className="px-3 py-2 text-left">Classificação</th>
                  <th className="px-3 py-2 text-right">Quantidade</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {exigencias.map((item, index) => (
                  <tr key={`${item.modelo}-${item.classificacao}`} className="odd:bg-white even:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{item.modelo}</td>
                    <td className="px-3 py-2">{CLASSIFICACAO_LABELS[item.classificacao]}</td>
                    <td className="px-3 py-2 text-right">{item.quantidade}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeExigencia(index)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={() => void salvar()} className="bg-cyan-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-cyan-700">Salvar grade do trimestre</button>
      </div>
    </div>
  );
}

// ─── Aba: Veículos ──────────────────────────────────────────────────────────

const EMPTY_VEICULO_FORM = {
  modelo: MODELOS[0] as Modelo,
  chassi: '',
  dataCompra: '',
  valorCompra: '',
  classificacao: 'test_drive' as Classificacao,
  condicaoPagamento: 'a_vista' as CondicaoPagamento,
  dataVencimentoPagamento: '',
};

function VeiculosTab({ veiculos, grades, onSave }: { veiculos: VeiculoGrade[]; grades: GradeTrimestre[]; onSave: (next: VeiculoGrade[]) => Promise<void> }) {
  const [form, setForm] = useState({ ...EMPTY_VEICULO_FORM });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [vendaAlvo, setVendaAlvo] = useState<VeiculoGrade | null>(null);
  const [dataVenda, setDataVenda] = useState('');

  const precisaVencimento = form.condicaoPagamento !== 'a_vista';

  function resetForm() {
    setForm({ ...EMPTY_VEICULO_FORM });
    setEditandoId(null);
  }

  async function salvar() {
    if (!form.chassi.trim()) { toast.error('Informe o chassi.'); return; }
    if (!form.dataCompra) { toast.error('Informe a data da compra.'); return; }
    const valor = Number(form.valorCompra);
    if (!Number.isFinite(valor) || valor < 0) { toast.error('Informe um valor de compra válido.'); return; }
    if (precisaVencimento && !form.dataVencimentoPagamento) { toast.error('Informe a data de vencimento do pagamento.'); return; }

    const chassiNormalizado = form.chassi.trim().toUpperCase();
    const duplicado = veiculos.some(v => v.chassi.toUpperCase() === chassiNormalizado && v.id !== editandoId);
    if (duplicado) { toast.error('Já existe um veículo com esse chassi.'); return; }

    if (editandoId) {
      const next = veiculos.map(v => v.id === editandoId ? {
        ...v,
        modelo: form.modelo,
        chassi: chassiNormalizado,
        dataCompra: form.dataCompra,
        valorCompra: valor,
        classificacao: form.classificacao,
        condicaoPagamento: form.condicaoPagamento,
        dataVencimentoPagamento: precisaVencimento ? form.dataVencimentoPagamento : null,
      } : v);
      await onSave(next);
      toast.success('Veículo atualizado.');
    } else {
      const veiculo: VeiculoGrade = {
        id: newId(),
        modelo: form.modelo,
        chassi: chassiNormalizado,
        dataCompra: form.dataCompra,
        valorCompra: valor,
        classificacao: form.classificacao,
        condicaoPagamento: form.condicaoPagamento,
        dataVencimentoPagamento: precisaVencimento ? form.dataVencimentoPagamento : null,
        vendido: false,
        dataVenda: null,
        criadoEm: new Date().toISOString(),
      };
      await onSave([...veiculos, veiculo]);
      toast.success('Veículo cadastrado.');
    }
    resetForm();
  }

  function editar(veiculo: VeiculoGrade) {
    setEditandoId(veiculo.id);
    setForm({
      modelo: veiculo.modelo,
      chassi: veiculo.chassi,
      dataCompra: veiculo.dataCompra,
      valorCompra: String(veiculo.valorCompra),
      classificacao: veiculo.classificacao,
      condicaoPagamento: veiculo.condicaoPagamento,
      dataVencimentoPagamento: veiculo.dataVencimentoPagamento ?? '',
    });
  }

  async function excluir(id: string) {
    await onSave(veiculos.filter(v => v.id !== id));
    if (editandoId === id) resetForm();
    toast.success('Veículo removido.');
  }

  function abrirVenda(veiculo: VeiculoGrade) {
    setVendaAlvo(veiculo);
    setDataVenda(veiculo.dataVenda ?? new Date().toISOString().slice(0, 10));
  }

  async function confirmarVenda() {
    if (!vendaAlvo) return;
    if (!dataVenda) { toast.error('Informe a data da venda.'); return; }
    const next = veiculos.map(v => v.id === vendaAlvo.id ? { ...v, vendido: true, dataVenda } : v);
    await onSave(next);
    setVendaAlvo(null);
    toast.success('Veículo marcado como vendido.');
  }

  async function desfazerVenda(veiculo: VeiculoGrade) {
    const next = veiculos.map(v => v.id === veiculo.id ? { ...v, vendido: false, dataVenda: null } : v);
    await onSave(next);
    toast.success('Venda desfeita.');
  }

  const ordenados = useMemo(
    () => [...veiculos].sort((a, b) => b.dataCompra.localeCompare(a.dataCompra)),
    [veiculos],
  );

  return (
    <div className="space-y-6">
      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-4">
        <h3 className="text-sm font-bold text-slate-800">{editandoId ? 'Editar veículo' : 'Cadastrar veículo'}</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-xs font-semibold text-slate-600">Modelo
            <select value={form.modelo} onChange={event => setForm(f => ({ ...f, modelo: event.target.value as Modelo }))} className="block mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm">
              {MODELOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Chassi
            <input value={form.chassi} onChange={event => setForm(f => ({ ...f, chassi: event.target.value }))} className="block mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Classificação
            <select value={form.classificacao} onChange={event => setForm(f => ({ ...f, classificacao: event.target.value as Classificacao }))} className="block mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm">
              {CLASSIFICACOES.map(c => <option key={c} value={c}>{CLASSIFICACAO_LABELS[c]}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Data da compra
            <input type="date" value={form.dataCompra} onChange={event => setForm(f => ({ ...f, dataCompra: event.target.value }))} className="block mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Valor da compra
            <input type="number" min={0} step="0.01" value={form.valorCompra} onChange={event => setForm(f => ({ ...f, valorCompra: event.target.value }))} className="block mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Condição de pagamento
            <select value={form.condicaoPagamento} onChange={event => setForm(f => ({ ...f, condicaoPagamento: event.target.value as CondicaoPagamento }))} className="block mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm">
              {CONDICOES.map(c => <option key={c} value={c}>{CONDICAO_PAGAMENTO_LABELS[c]}</option>)}
            </select>
          </label>
          {precisaVencimento && (
            <label className="text-xs font-semibold text-slate-600">Vencimento do pagamento
              <input type="date" value={form.dataVencimentoPagamento} onChange={event => setForm(f => ({ ...f, dataVencimentoPagamento: event.target.value }))} className="block mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2">
          {editandoId && <button onClick={resetForm} className="text-sm text-slate-600 px-3 py-2">Cancelar</button>}
          <button onClick={() => void salvar()} className="flex items-center gap-1 bg-cyan-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-cyan-700">
            <Plus className="w-4 h-4" />{editandoId ? 'Salvar alterações' : 'Adicionar veículo'}
          </button>
        </div>
      </div>

      {ordenados.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum veículo cadastrado.</p>
      ) : (
        <div className="overflow-auto border border-slate-200 rounded-lg">
          <table className="min-w-[1100px] w-full text-xs">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Modelo</th>
                <th className="px-3 py-2 text-left">Chassi</th>
                <th className="px-3 py-2 text-left">Classificação</th>
                <th className="px-3 py-2 text-left">Compra</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 text-left">Pagamento</th>
                <th className="px-3 py-2 text-left">Venc. pgto</th>
                <th className="px-3 py-2 text-left">Liberado p/ venda</th>
                <th className="px-3 py-2 text-left">Venc. grade</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {ordenados.map(veiculo => (
                <tr key={veiculo.id} className="odd:bg-white even:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{veiculo.modelo}</td>
                  <td className="px-3 py-2 font-mono">{veiculo.chassi}</td>
                  <td className="px-3 py-2">{CLASSIFICACAO_LABELS[veiculo.classificacao]}</td>
                  <td className="px-3 py-2">{formatDate(veiculo.dataCompra)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(veiculo.valorCompra)}</td>
                  <td className="px-3 py-2">{CONDICAO_PAGAMENTO_LABELS[veiculo.condicaoPagamento]}</td>
                  <td className="px-3 py-2">{formatDate(veiculo.dataVencimentoPagamento)}</td>
                  <td className="px-3 py-2">{formatDate(liberadoVendaVeiculo(veiculo, grades))}</td>
                  <td className="px-3 py-2">{formatDate(vencimentoGradeVeiculo(veiculo, grades))}</td>
                  <td className="px-3 py-2">
                    {veiculo.vendido
                      ? <span className="inline-flex items-center rounded-full bg-slate-200 text-slate-700 px-2 py-0.5 text-[11px] font-semibold">Vendido {formatDate(veiculo.dataVenda)}</span>
                      : <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[11px] font-semibold">Em estoque</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      {veiculo.vendido
                        ? <button onClick={() => void desfazerVenda(veiculo)} className="text-[11px] text-slate-500 hover:text-slate-700 underline">Desfazer venda</button>
                        : <button onClick={() => abrirVenda(veiculo)} className="text-[11px] text-cyan-600 hover:text-cyan-800 underline">Marcar vendido</button>}
                      <button onClick={() => editar(veiculo)} className="text-slate-500 hover:text-slate-700"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => void excluir(veiculo.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vendaAlvo && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Marcar como vendido</h3>
              <button onClick={() => setVendaAlvo(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-slate-600">{vendaAlvo.modelo} — {vendaAlvo.chassi}</p>
            <label className="text-xs font-semibold text-slate-600 block">Data da venda
              <input type="date" value={dataVenda} onChange={event => setDataVenda(event.target.value)} className="block mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setVendaAlvo(null)} className="text-sm text-slate-600 px-3 py-2">Cancelar</button>
              <button onClick={() => void confirmarVenda()} className="bg-cyan-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-cyan-700">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Aba: Gestão da Grade ───────────────────────────────────────────────────

function GestaoTab({ grades, veiculos }: { grades: GradeTrimestre[]; veiculos: VeiculoGrade[] }) {
  const [ano, setAno] = useState(currentYear());
  const [trimestre, setTrimestre] = useState(currentQuarter());

  const grade = useMemo(
    () => grades.find(item => item.ano === ano && item.trimestre === trimestre) ?? null,
    [grades, ano, trimestre],
  );

  const ultimoDia = useMemo(() => lastDayOfQuarterISO(ano, trimestre), [ano, trimestre]);
  const primeiroDia = useMemo(() => firstDayOfQuarterISO(ano, trimestre), [ano, trimestre]);
  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const classificados = useMemo(() => {
    const elegiveis: VeiculoGrade[] = [];
    const emEstoqueNaoElegiveis: VeiculoGrade[] = [];
    const vendidos: VeiculoGrade[] = [];
    veiculos.forEach(veiculo => {
      if (veiculo.dataCompra > ultimoDia) return; // ainda não comprado neste trimestre
      if (veiculo.vendido) {
        if (!veiculo.dataVenda) { vendidos.push(veiculo); return; }
        if (veiculo.dataVenda < primeiroDia) return; // vendido em trimestre anterior — não aparece
        if (veiculo.dataVenda <= ultimoDia) { vendidos.push(veiculo); return; } // vendido neste trimestre
        // vendido em trimestre futuro — ainda em estoque neste trimestre
      }
      if (veiculoGaranteGrade(veiculo, grades, ano, trimestre)) elegiveis.push(veiculo);
      else emEstoqueNaoElegiveis.push(veiculo);
    });
    return { elegiveis, emEstoqueNaoElegiveis, vendidos };
  }, [veiculos, grades, ano, trimestre, primeiroDia, ultimoDia]);

  const obrigacoes = useMemo(() => {
    const exigencias = grade?.exigencias ?? [];
    return exigencias.map(item => {
      const elegiveis = classificados.elegiveis.filter(v => v.modelo === item.modelo && v.classificacao === item.classificacao).length;
      const faltam = Math.max(0, item.quantidade - elegiveis);
      return { ...item, elegiveis, faltam };
    });
  }, [grade, classificados.elegiveis]);

  const totalFaltam = obrigacoes.reduce((sum, item) => sum + item.faltam, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-slate-600">Ano
          <input type="number" value={ano} onChange={event => setAno(Number(event.target.value))} className="block mt-1 w-28 border border-slate-300 rounded px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-slate-600">Trimestre
          <select value={trimestre} onChange={event => setTrimestre(Number(event.target.value))} className="block mt-1 border border-slate-300 rounded px-3 py-2 text-sm">
            {TRIMESTRES.map(t => <option key={t} value={t}>{t}º trimestre</option>)}
          </select>
        </label>
      </div>

      {/* Obrigação de compra */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-800">Obrigação de compra</h3>
          {totalFaltam > 0
            ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-semibold"><AlertTriangle className="w-3 h-3" />{totalFaltam} veículo(s) a comprar</span>
            : grade && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[11px] font-semibold"><CheckCircle2 className="w-3 h-3" />Grade completa</span>}
        </div>
        {!grade ? (
          <p className="text-sm text-slate-400">Nenhuma grade cadastrada para o {trimestre}º trimestre de {ano}. Cadastre em “Grade Exigida”.</p>
        ) : obrigacoes.length === 0 ? (
          <p className="text-sm text-slate-400">A grade deste trimestre não possui exigências.</p>
        ) : (
          <div className="overflow-auto border border-slate-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Modelo</th>
                  <th className="px-3 py-2 text-left">Classificação</th>
                  <th className="px-3 py-2 text-right">Exigido</th>
                  <th className="px-3 py-2 text-right">Elegíveis</th>
                  <th className="px-3 py-2 text-right">Faltam comprar</th>
                </tr>
              </thead>
              <tbody>
                {obrigacoes.map(item => (
                  <tr key={`${item.modelo}-${item.classificacao}`} className="odd:bg-white even:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{item.modelo}</td>
                    <td className="px-3 py-2">{CLASSIFICACAO_LABELS[item.classificacao]}</td>
                    <td className="px-3 py-2 text-right">{item.quantidade}</td>
                    <td className="px-3 py-2 text-right">{item.elegiveis}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${item.faltam > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{item.faltam}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Listas de veículos */}
      <VeiculosSituacaoLista titulo="Elegíveis (garantem a grade)" cor="emerald" veiculos={classificados.elegiveis} grades={grades} hoje={hoje} mostrarSituacao />
      <VeiculosSituacaoLista titulo="Em estoque, não elegíveis no trimestre" cor="amber" veiculos={classificados.emEstoqueNaoElegiveis} grades={grades} hoje={hoje} mostrarSituacao />
      <VeiculosSituacaoLista titulo="Vendidos" cor="slate" veiculos={classificados.vendidos} grades={grades} hoje={hoje} />
    </div>
  );
}

function VeiculosSituacaoLista({ titulo, cor, veiculos, grades, hoje, mostrarSituacao = false }: { titulo: string; cor: 'emerald' | 'amber' | 'slate'; veiculos: VeiculoGrade[]; grades: GradeTrimestre[]; hoje: string; mostrarSituacao?: boolean }) {
  const dot = cor === 'emerald' ? 'bg-emerald-500' : cor === 'amber' ? 'bg-amber-500' : 'bg-slate-400';
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <h3 className="text-sm font-bold text-slate-800">{titulo}</h3>
        <span className="text-xs text-slate-400">({veiculos.length})</span>
      </div>
      {veiculos.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum veículo nesta situação.</p>
      ) : (
        <div className="overflow-auto border border-slate-200 rounded-lg">
          <table className="min-w-[760px] w-full text-xs">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Modelo</th>
                <th className="px-3 py-2 text-left">Chassi</th>
                <th className="px-3 py-2 text-left">Classificação</th>
                <th className="px-3 py-2 text-left">Compra</th>
                <th className="px-3 py-2 text-left">Venc. grade</th>
                {mostrarSituacao && <th className="px-3 py-2 text-left">Situação</th>}
                <th className="px-3 py-2 text-left">Venda</th>
              </tr>
            </thead>
            <tbody>
              {veiculos.map(veiculo => {
                const situacao = situacaoVendaVeiculo(veiculo, grades, hoje);
                return (
                  <tr key={veiculo.id} className="odd:bg-white even:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{veiculo.modelo}</td>
                    <td className="px-3 py-2 font-mono">{veiculo.chassi}</td>
                    <td className="px-3 py-2">{CLASSIFICACAO_LABELS[veiculo.classificacao]}</td>
                    <td className="px-3 py-2">{formatDate(veiculo.dataCompra)}</td>
                    <td className="px-3 py-2">{formatDate(vencimentoGradeVeiculo(veiculo, grades))}</td>
                    {mostrarSituacao && (
                      <td className="px-3 py-2">
                        {situacao === 'disponivel'
                          ? <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[11px] font-semibold">Disponível para Venda</span>
                          : <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-semibold">Bloqueado para venda</span>}
                      </td>
                    )}
                    <td className="px-3 py-2">{formatDate(veiculo.dataVenda)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
