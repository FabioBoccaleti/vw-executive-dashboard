import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Car, ClipboardList, LayoutGrid, X, CheckCircle2, AlertTriangle, TrendingUp, Download } from 'lucide-react';
import {
  CLASSIFICACAO_LABELS,
  CONDICAO_PAGAMENTO_LABELS,
  MODELOS,
  PRAZO_COMERCIALIZACAO_PADRAO,
  PRAZO_ELEGIBILIDADE_PADRAO,
  calcularRentabilidade,
  diasEntreISO,
  firstDayOfQuarterISO,
  getGrades,
  getVeiculos,
  lastDayOfQuarterISO,
  liberadoVendaVeiculo,
  quarterOfISO,
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
import { exportGestaoGradeExcel, exportResultadoVendasExcel } from './gradeTestDriveExport';

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
  const [activeTab, setActiveTab] = useState<'grade' | 'veiculos' | 'gestao' | 'resultado'>('gestao');
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
          <TabButton active={activeTab === 'resultado'} onClick={() => setActiveTab('resultado')} icon={<TrendingUp className="w-4 h-4" />}>
            Resultado das Vendas
          </TabButton>
        </div>

        <section className="bg-white rounded-b-lg shadow-sm p-4 md:p-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400">Carregando…</div>
          ) : activeTab === 'gestao' ? (
            <GestaoTab grades={grades} veiculos={veiculos} />
          ) : activeTab === 'grade' ? (
            <GradeExigidaTab grades={grades} onSave={persistGrades} />
          ) : activeTab === 'resultado' ? (
            <ResultadoVendasTab veiculos={veiculos} />
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
        valorVenda: null,
        valorImpostos: null,
        creditoICMS: null,
        custoEmplacamento: null,
        custoIPVA: null,
        jurosEstoque: null,
        cortesia: null,
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
  }

  async function confirmarVenda(dados: VendaFormValues) {
    if (!vendaAlvo) return;
    const next = veiculos.map(v => v.id === vendaAlvo.id ? {
      ...v,
      vendido: true,
      dataVenda: dados.dataVenda,
      valorVenda: dados.valorVenda,
      valorImpostos: dados.valorImpostos,
      creditoICMS: dados.creditoICMS,
      custoEmplacamento: dados.custoEmplacamento,
      custoIPVA: dados.custoIPVA,
      jurosEstoque: dados.jurosEstoque,
      cortesia: dados.cortesia,
    } : v);
    await onSave(next);
    setVendaAlvo(null);
    toast.success('Venda registrada.');
  }

  async function desfazerVenda(veiculo: VeiculoGrade) {
    const next = veiculos.map(v => v.id === veiculo.id ? {
      ...v,
      vendido: false,
      dataVenda: null,
      valorVenda: null,
      valorImpostos: null,
      creditoICMS: null,
      custoEmplacamento: null,
      custoIPVA: null,
      jurosEstoque: null,
      cortesia: null,
    } : v);
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
                        ? <>
                            <button onClick={() => abrirVenda(veiculo)} className="text-[11px] text-cyan-600 hover:text-cyan-800 underline">Editar venda</button>
                            <button onClick={() => void desfazerVenda(veiculo)} className="text-[11px] text-slate-500 hover:text-slate-700 underline">Desfazer</button>
                          </>
                        : <button onClick={() => abrirVenda(veiculo)} className="text-[11px] text-cyan-600 hover:text-cyan-800 underline">Registrar venda</button>}
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
        <RegistrarVendaModal veiculo={vendaAlvo} onClose={() => setVendaAlvo(null)} onConfirm={confirmarVenda} />
      )}
    </div>
  );
}

// ─── Modal: Registrar / editar venda ────────────────────────────────────────

interface VendaFormValues {
  dataVenda: string;
  valorVenda: number;
  valorImpostos: number;
  creditoICMS: number;
  custoEmplacamento: number;
  custoIPVA: number;
  jurosEstoque: number;
  cortesia: number;
}

const CAMPOS_VENDA: Array<{ key: keyof Omit<VendaFormValues, 'dataVenda'>; label: string }> = [
  { key: 'valorVenda', label: 'Valor da Venda' },
  { key: 'valorImpostos', label: 'Valor dos Impostos' },
  { key: 'custoEmplacamento', label: 'Custo de Emplacamento' },
  { key: 'custoIPVA', label: 'Custo de IPVA' },
  { key: 'jurosEstoque', label: 'Juros de Estoque' },
  { key: 'cortesia', label: 'Cortesias' },
  { key: 'creditoICMS', label: 'Crédito de ICMS' },
];

function RegistrarVendaModal({ veiculo, onClose, onConfirm }: { veiculo: VeiculoGrade; onClose: () => void; onConfirm: (dados: VendaFormValues) => Promise<void> }) {
  const [dataVenda, setDataVenda] = useState(veiculo.dataVenda ?? new Date().toISOString().slice(0, 10));
  const [valores, setValores] = useState<Record<keyof Omit<VendaFormValues, 'dataVenda'>, string>>({
    valorVenda: veiculo.valorVenda != null ? String(veiculo.valorVenda) : '',
    valorImpostos: veiculo.valorImpostos != null ? String(veiculo.valorImpostos) : '',
    custoEmplacamento: veiculo.custoEmplacamento != null ? String(veiculo.custoEmplacamento) : '',
    custoIPVA: veiculo.custoIPVA != null ? String(veiculo.custoIPVA) : '',
    jurosEstoque: veiculo.jurosEstoque != null ? String(veiculo.jurosEstoque) : '',
    cortesia: veiculo.cortesia != null ? String(veiculo.cortesia) : '',
    creditoICMS: veiculo.creditoICMS != null ? String(veiculo.creditoICMS) : '',
  });

  const num = (v: string) => Number(v);
  const previa = useMemo(() => calcularRentabilidade({
    ...veiculo,
    valorVenda: num(valores.valorVenda) || 0,
    valorImpostos: num(valores.valorImpostos) || 0,
    creditoICMS: num(valores.creditoICMS) || 0,
    custoEmplacamento: num(valores.custoEmplacamento) || 0,
    custoIPVA: num(valores.custoIPVA) || 0,
    jurosEstoque: num(valores.jurosEstoque) || 0,
    cortesia: num(valores.cortesia) || 0,
  }), [veiculo, valores]);

  async function confirmar() {
    if (!dataVenda) { toast.error('Informe a data da venda.'); return; }
    for (const campo of CAMPOS_VENDA) {
      const raw = valores[campo.key];
      if (raw.trim() === '' || !Number.isFinite(Number(raw))) {
        toast.error(`Informe o campo "${campo.label}" (use 0,00 se não houver).`);
        return;
      }
    }
    await onConfirm({
      dataVenda,
      valorVenda: num(valores.valorVenda),
      valorImpostos: num(valores.valorImpostos),
      creditoICMS: num(valores.creditoICMS),
      custoEmplacamento: num(valores.custoEmplacamento),
      custoIPVA: num(valores.custoIPVA),
      jurosEstoque: num(valores.jurosEstoque),
      cortesia: num(valores.cortesia),
    });
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full shadow-xl space-y-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">{veiculo.vendido ? 'Editar venda' : 'Registrar venda'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-slate-600">{veiculo.modelo} — <span className="font-mono">{veiculo.chassi}</span> · Compra {formatDate(veiculo.dataCompra)} · Custo {formatCurrency(veiculo.valorCompra)}</p>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">Data da venda
            <input type="date" value={dataVenda} onChange={event => setDataVenda(event.target.value)} className="block mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
          </label>
          {CAMPOS_VENDA.map(campo => (
            <label key={campo.key} className="text-xs font-semibold text-slate-600">{campo.label}
              <input type="number" step="0.01" value={valores[campo.key]} onChange={event => setValores(v => ({ ...v, [campo.key]: event.target.value }))} className="block mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
            </label>
          ))}
        </div>

        <div className="border border-slate-200 rounded-lg bg-slate-50 p-4">
          <h4 className="text-xs font-bold text-slate-700 mb-2">Prévia da rentabilidade</h4>
          <div className="space-y-1 text-sm">
            <LinhaWaterfall label="Valor da Venda" valor={previa.valorVenda} />
            <LinhaWaterfall label="(-) Impostos" valor={-previa.impostos} />
            <LinhaWaterfall label="(=) Receita Líquida" valor={previa.receitaLiquida} destaque />
            <LinhaWaterfall label="(-) Custo de Compra" valor={-previa.custoCompra} />
            <LinhaWaterfall label="(=) Lucro Bruto" valor={previa.lucroBruto} destaque />
            <LinhaWaterfall label="(-) Custo de Emplacamento" valor={-previa.custoEmplacamento} />
            <LinhaWaterfall label="(-) Custo de IPVA" valor={-previa.custoIPVA} />
            <LinhaWaterfall label="(-) Juros de Estoque" valor={-previa.jurosEstoque} />
            <LinhaWaterfall label="(-) Cortesia" valor={-previa.cortesia} />
            <LinhaWaterfall label="(+) Crédito de ICMS" valor={previa.creditoICMS} />
            <LinhaWaterfall label="(=) Lucro Líquido (Rentabilidade)" valor={previa.lucroLiquido} destaque total />
            <div className="flex justify-between pt-1 text-xs text-slate-500"><span>Margem</span><span>{previa.margem.toFixed(1)}%</span></div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm text-slate-600 px-3 py-2">Cancelar</button>
          <button onClick={() => void confirmar()} className="bg-cyan-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-cyan-700">{veiculo.vendido ? 'Salvar venda' : 'Registrar venda'}</button>
        </div>
      </div>
    </div>
  );
}

function LinhaWaterfall({ label, valor, destaque = false, total = false }: { label: string; valor: number; destaque?: boolean; total?: boolean }) {
  return (
    <div className={`flex justify-between ${destaque ? 'font-semibold' : ''} ${total ? 'border-t border-slate-300 pt-1 mt-1 text-cyan-700' : 'text-slate-700'}`}>
      <span>{label}</span>
      <span className={valor < 0 ? 'text-red-600' : ''}>{formatCurrency(valor)}</span>
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
        <button
          onClick={() => void exportGestaoGradeExcel({ ano, trimestre, obrigacoes, elegiveis: classificados.elegiveis, emEstoqueNaoElegiveis: classificados.emEstoqueNaoElegiveis, vendidos: classificados.vendidos, grades, hoje })}
          className="ml-auto flex items-center gap-2 border border-emerald-300 text-emerald-700 rounded px-3 py-2 text-sm font-semibold hover:bg-emerald-50"
        >
          <Download className="w-4 h-4" />Exportar Excel
        </button>
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
              <tfoot>
                <tr className="bg-slate-100 font-semibold text-slate-700">
                  <td className="px-3 py-2" colSpan={2}>Total</td>
                  <td className="px-3 py-2 text-right">{obrigacoes.reduce((sum, item) => sum + item.quantidade, 0)}</td>
                  <td className="px-3 py-2 text-right">{obrigacoes.reduce((sum, item) => sum + item.elegiveis, 0)}</td>
                  <td className={`px-3 py-2 text-right ${totalFaltam > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{totalFaltam}</td>
                </tr>
              </tfoot>
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

// ─── Aba: Resultado das Vendas ──────────────────────────────────────────────

function ResultadoVendasTab({ veiculos }: { veiculos: VeiculoGrade[] }) {
  const [subView, setSubView] = useState<'trimestre' | 'anual'>('trimestre');
  const [ano, setAno] = useState(currentYear());
  const [trimestre, setTrimestre] = useState(currentQuarter());

  const vendidos = useMemo(
    () => veiculos.filter(v => v.vendido && v.dataVenda),
    [veiculos],
  );

  const porTrimestre = useMemo(() => {
    return vendidos
      .filter(v => {
        const periodo = quarterOfISO(v.dataCompra);
        return periodo.ano === ano && periodo.trimestre === trimestre;
      })
      .sort((a, b) => (b.dataVenda ?? '').localeCompare(a.dataVenda ?? ''));
  }, [vendidos, ano, trimestre]);

  const anuais = useMemo(() => {
    return vendidos
      .filter(v => (v.dataVenda ?? '').slice(0, 4) === String(ano))
      .sort((a, b) => (b.dataVenda ?? '').localeCompare(a.dataVenda ?? ''));
  }, [vendidos, ano]);

  const kpisAnuais = useMemo(() => {
    let totalVenda = 0;
    let totalLucro = 0;
    anuais.forEach(v => {
      const r = calcularRentabilidade(v);
      totalVenda += r.valorVenda;
      totalLucro += r.lucroLiquido;
    });
    const margem = totalVenda > 0 ? (totalLucro / totalVenda) * 100 : 0;
    return { totalVenda, totalLucro, margem, quantidade: anuais.length };
  }, [anuais]);

  return (
    <div className="space-y-5">
      <div className="flex border border-slate-200 rounded-lg overflow-hidden w-fit">
        <button onClick={() => setSubView('trimestre')} className={`px-4 py-2 text-sm font-semibold ${subView === 'trimestre' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Por Trimestre da Grade</button>
        <button onClick={() => setSubView('anual')} className={`px-4 py-2 text-sm font-semibold ${subView === 'anual' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Anual</button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-slate-600">Ano
          <input type="number" value={ano} onChange={event => setAno(Number(event.target.value))} className="block mt-1 w-28 border border-slate-300 rounded px-3 py-2 text-sm" />
        </label>
        {subView === 'trimestre' && (
          <label className="text-xs font-semibold text-slate-600">Trimestre de aquisição
            <select value={trimestre} onChange={event => setTrimestre(Number(event.target.value))} className="block mt-1 border border-slate-300 rounded px-3 py-2 text-sm">
              {TRIMESTRES.map(t => <option key={t} value={t}>{t}º trimestre</option>)}
            </select>
          </label>
        )}
        <button
          onClick={() => {
            if (subView === 'trimestre') {
              if (porTrimestre.length === 0) { toast.error('Não há vendas para exportar.'); return; }
              void exportResultadoVendasExcel({ titulo: `Resultado das Vendas — ${trimestre}º trimestre de ${ano} (aquisição)`, filename: `resultado-vendas-${ano}-T${trimestre}.xlsx`, veiculos: porTrimestre });
            } else {
              if (anuais.length === 0) { toast.error('Não há vendas para exportar.'); return; }
              void exportResultadoVendasExcel({ titulo: `Resultado das Vendas — Ano ${ano}`, filename: `resultado-vendas-anual-${ano}.xlsx`, veiculos: anuais });
            }
          }}
          className="ml-auto flex items-center gap-2 border border-emerald-300 text-emerald-700 rounded px-3 py-2 text-sm font-semibold hover:bg-emerald-50"
        >
          <Download className="w-4 h-4" />Exportar Excel
        </button>
      </div>

      {subView === 'anual' && anuais.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard label="Veículos vendidos" valor={String(kpisAnuais.quantidade)} />
          <KpiCard label="Lucro líquido total" valor={formatCurrency(kpisAnuais.totalLucro)} destaque={kpisAnuais.totalLucro >= 0} />
          <KpiCard label="Margem média" valor={`${kpisAnuais.margem.toFixed(1)}%`} />
        </div>
      )}

      {subView === 'trimestre' ? (
        porTrimestre.length === 0
          ? <p className="text-sm text-slate-400">Nenhuma venda de veículo adquirido no {trimestre}º trimestre de {ano}.</p>
          : <ResultadoTable veiculos={porTrimestre} mostrarDiasEstoque />
      ) : (
        anuais.length === 0
          ? <p className="text-sm text-slate-400">Nenhum veículo vendido em {ano}.</p>
          : <ResultadoTable veiculos={anuais} mostrarDiasEstoque />
      )}
    </div>
  );
}

function KpiCard({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold mt-1 ${destaque === undefined ? 'text-slate-800' : destaque ? 'text-emerald-600' : 'text-red-600'}`}>{valor}</p>
    </div>
  );
}

function ResultadoTable({ veiculos, mostrarDiasEstoque = false }: { veiculos: VeiculoGrade[]; mostrarDiasEstoque?: boolean }) {
  const linhas = veiculos.map(v => ({ veiculo: v, r: calcularRentabilidade(v) }));
  const totais = linhas.reduce(
    (acc, { r }) => {
      acc.valorVenda += r.valorVenda;
      acc.impostos += r.impostos;
      acc.receitaLiquida += r.receitaLiquida;
      acc.custoCompra += r.custoCompra;
      acc.lucroBruto += r.lucroBruto;
      acc.custoEmplacamento += r.custoEmplacamento;
      acc.custoIPVA += r.custoIPVA;
      acc.jurosEstoque += r.jurosEstoque;
      acc.cortesia += r.cortesia;
      acc.creditoICMS += r.creditoICMS;
      acc.lucroLiquido += r.lucroLiquido;
      return acc;
    },
    { valorVenda: 0, impostos: 0, receitaLiquida: 0, custoCompra: 0, lucroBruto: 0, custoEmplacamento: 0, custoIPVA: 0, jurosEstoque: 0, cortesia: 0, creditoICMS: 0, lucroLiquido: 0 },
  );
  const margemTotal = totais.valorVenda > 0 ? (totais.lucroLiquido / totais.valorVenda) * 100 : 0;

  return (
    <div className="overflow-auto border border-slate-200 rounded-lg">
      <table className="min-w-[1400px] w-full text-[11px]">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-2 py-2 text-left">Modelo</th>
            <th className="px-2 py-2 text-left">Chassi</th>
            <th className="px-2 py-2 text-left">Compra</th>
            <th className="px-2 py-2 text-left">Venda</th>
            {mostrarDiasEstoque && <th className="px-2 py-2 text-right">Dias estoque</th>}
            <th className="px-2 py-2 text-right">Venda R$</th>
            <th className="px-2 py-2 text-right">Impostos</th>
            <th className="px-2 py-2 text-right">Receita Líq.</th>
            <th className="px-2 py-2 text-right">Custo Compra</th>
            <th className="px-2 py-2 text-right">Lucro Bruto</th>
            <th className="px-2 py-2 text-right">Emplac.</th>
            <th className="px-2 py-2 text-right">IPVA</th>
            <th className="px-2 py-2 text-right">Juros</th>
            <th className="px-2 py-2 text-right">Cortesia</th>
            <th className="px-2 py-2 text-right">Créd. ICMS</th>
            <th className="px-2 py-2 text-right">Lucro Líq.</th>
            <th className="px-2 py-2 text-right">Margem</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ veiculo, r }) => (
            <tr key={veiculo.id} className="odd:bg-white even:bg-slate-50">
              <td className="px-2 py-1.5 font-medium">{veiculo.modelo}</td>
              <td className="px-2 py-1.5 font-mono">{veiculo.chassi}</td>
              <td className="px-2 py-1.5">{formatDate(veiculo.dataCompra)}</td>
              <td className="px-2 py-1.5">{formatDate(veiculo.dataVenda)}</td>
              {mostrarDiasEstoque && <td className="px-2 py-1.5 text-right">{veiculo.dataVenda ? diasEntreISO(veiculo.dataCompra, veiculo.dataVenda) : '—'}</td>}
              <td className="px-2 py-1.5 text-right">{formatCurrency(r.valorVenda)}</td>
              <td className="px-2 py-1.5 text-right">{formatCurrency(r.impostos)}</td>
              <td className="px-2 py-1.5 text-right">{formatCurrency(r.receitaLiquida)}</td>
              <td className="px-2 py-1.5 text-right">{formatCurrency(r.custoCompra)}</td>
              <td className="px-2 py-1.5 text-right">{formatCurrency(r.lucroBruto)}</td>
              <td className="px-2 py-1.5 text-right">{formatCurrency(r.custoEmplacamento)}</td>
              <td className="px-2 py-1.5 text-right">{formatCurrency(r.custoIPVA)}</td>
              <td className="px-2 py-1.5 text-right">{formatCurrency(r.jurosEstoque)}</td>
              <td className="px-2 py-1.5 text-right">{formatCurrency(r.cortesia)}</td>
              <td className="px-2 py-1.5 text-right">{formatCurrency(r.creditoICMS)}</td>
              <td className={`px-2 py-1.5 text-right font-semibold ${r.lucroLiquido >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(r.lucroLiquido)}</td>
              <td className="px-2 py-1.5 text-right">{r.margem.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-semibold text-slate-700">
            <td className="px-2 py-2" colSpan={mostrarDiasEstoque ? 5 : 4}>Total ({linhas.length})</td>
            <td className="px-2 py-2 text-right">{formatCurrency(totais.valorVenda)}</td>
            <td className="px-2 py-2 text-right">{formatCurrency(totais.impostos)}</td>
            <td className="px-2 py-2 text-right">{formatCurrency(totais.receitaLiquida)}</td>
            <td className="px-2 py-2 text-right">{formatCurrency(totais.custoCompra)}</td>
            <td className="px-2 py-2 text-right">{formatCurrency(totais.lucroBruto)}</td>
            <td className="px-2 py-2 text-right">{formatCurrency(totais.custoEmplacamento)}</td>
            <td className="px-2 py-2 text-right">{formatCurrency(totais.custoIPVA)}</td>
            <td className="px-2 py-2 text-right">{formatCurrency(totais.jurosEstoque)}</td>
            <td className="px-2 py-2 text-right">{formatCurrency(totais.cortesia)}</td>
            <td className="px-2 py-2 text-right">{formatCurrency(totais.creditoICMS)}</td>
            <td className={`px-2 py-2 text-right ${totais.lucroLiquido >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(totais.lucroLiquido)}</td>
            <td className="px-2 py-2 text-right">{margemTotal.toFixed(1)}%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
