import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, X, Check, CreditCard, FileText, AlertCircle, Settings, Printer } from 'lucide-react';
import { kvGet, kvSet } from '@/lib/kvClient';
import { toast } from 'sonner';
import { PasswordDialog } from '@/components/PasswordDialog';

// ─── Tipos ────────────────────────────────────────────────────────────────────

const DESCRICOES_PADRAO = [
  'Pagamentos de Honorários de Despachantes',
  'Pagamento de Serviço de Vistoria',
];

export interface EvoraPagamento {
  id: string;
  data: string; // YYYY-MM-DD
  descricao: string;
  valor: number;
  criadoEm: number;
}

const KEY_VALOR      = 'evora:contrato_valor';
const KEY_PAGAMENTOS = 'evora:pagamentos';
const KEY_DESCRICOES = 'evora:descricoes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const parseValor = (s: string) =>
  parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;

function formatDateBR(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Storage ──────────────────────────────────────────────────────────────────

async function loadValorContrato(): Promise<number> {
  return (await kvGet<number>(KEY_VALOR)) ?? 0;
}

async function saveValorContrato(valor: number): Promise<boolean> {
  return kvSet(KEY_VALOR, valor);
}

async function loadPagamentos(): Promise<EvoraPagamento[]> {
  return (await kvGet<EvoraPagamento[]>(KEY_PAGAMENTOS)) ?? [];
}

async function savePagamentos(items: EvoraPagamento[]): Promise<boolean> {
  return kvSet(KEY_PAGAMENTOS, items);
}

async function loadDescricoes(): Promise<string[]> {
  return (await kvGet<string[]>(KEY_DESCRICOES)) ?? DESCRICOES_PADRAO;
}

async function saveDescricoes(items: string[]): Promise<boolean> {
  return kvSet(KEY_DESCRICOES, items);
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  onChangeBrand: () => void;
}

export function ControlePagamentosEvoraDashboard({ onChangeBrand }: Props) {
  const [valorContrato, setValorContrato]       = useState(0);
  const [valorContratoInput, setValorContratoInput] = useState('');
  const [editandoContrato, setEditandoContrato] = useState(false);
  const [savingContrato, setSavingContrato]     = useState(false);
  const [showSenhaDialog, setShowSenhaDialog]   = useState(false);
  // ação pendente a executar após confirmação da senha
  const [senhaAction, setSenhaAction]           = useState<(() => void) | null>(null);

  function promptSenha(action: () => void) {
    setSenhaAction(() => action);
    setShowSenhaDialog(true);
  }

  function handleSenhaSuccess() {
    senhaAction?.();
    setSenhaAction(null);
  }

  const [pagamentos, setPagamentos] = useState<EvoraPagamento[]>([]);
  const [loading, setLoading]       = useState(true);

  // Formulário de novo pagamento
  const [formData, setFormData]   = useState('');
  const [formDesc, setFormDesc]   = useState('');
  const [formValor, setFormValor] = useState('');
  const [salvando, setSalvando]   = useState(false);

  // Gerenciamento de descrições
  const [descricoes, setDescricoes]         = useState<string[]>(DESCRICOES_PADRAO);
  const [novaDescricao, setNovaDescricao]   = useState('');
  const [salvandoDesc, setSalvandoDesc]     = useState(false);

  // Edição inline
  const [editId, setEditId]         = useState<string | null>(null);
  const [editData, setEditData]     = useState('');
  const [editDesc, setEditDesc]     = useState('');
  const [editValorStr, setEditValorStr] = useState('');

  useEffect(() => {
    async function init() {
      const [v, p, d] = await Promise.all([loadValorContrato(), loadPagamentos(), loadDescricoes()]);
      setValorContrato(v);
      setValorContratoInput(
        v > 0 ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
      );
      setPagamentos(p);
      setDescricoes(d);
      setFormDesc(d[0] ?? '');
      setLoading(false);
    }
    init();
  }, []);

  // ── Contrato ────────────────────────────────────────────────────────────────

  async function handleSalvarContrato() {
    const v = parseValor(valorContratoInput);
    if (v <= 0) { toast.error('Informe um valor válido para o contrato.'); return; }
    setSavingContrato(true);
    const ok = await saveValorContrato(v);
    if (ok) { setValorContrato(v); setEditandoContrato(false); toast.success('Valor do contrato salvo.'); }
    else toast.error('Erro ao salvar valor do contrato.');
    setSavingContrato(false);
  }

  // ── Incluir pagamento ───────────────────────────────────────────────────────

  async function handleIncluir() {
    if (!formData) { toast.error('Informe a data.'); return; }
    const v = parseValor(formValor);
    if (v <= 0) { toast.error('Informe um valor válido.'); return; }

    const novo: EvoraPagamento = {
      id: crypto.randomUUID(),
      data: formData,
      descricao: formDesc,
      valor: v,
      criadoEm: Date.now(),
    };

    setSalvando(true);
    const updated = [...pagamentos, novo].sort((a, b) => a.data.localeCompare(b.data));
    const ok = await savePagamentos(updated);
    if (ok) {
      setPagamentos(updated);
      setFormData('');
      setFormValor('');
      toast.success('Pagamento registrado.');
    } else {
      toast.error('Erro ao salvar pagamento.');
    }
    setSalvando(false);
  }

  // ── Excluir ─────────────────────────────────────────────────────────────────

  async function handleExcluir(id: string) {
    const updated = pagamentos.filter(p => p.id !== id);
    const ok = await savePagamentos(updated);
    if (ok) { setPagamentos(updated); toast.success('Pagamento removido.'); }
    else toast.error('Erro ao remover pagamento.');
  }

  // ── Editar ──────────────────────────────────────────────────────────────────

  function startEdit(p: EvoraPagamento) {
    setEditId(p.id);
    setEditData(p.data);
    setEditDesc(p.descricao);
    setEditValorStr(p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }

  async function handleSalvarEdit() {
    if (!editId) return;
    if (!editData) { toast.error('Informe a data.'); return; }
    const v = parseValor(editValorStr);
    if (v <= 0) { toast.error('Informe um valor válido.'); return; }

    const updated = pagamentos
      .map(p => p.id === editId ? { ...p, data: editData, descricao: editDesc, valor: v } : p)
      .sort((a, b) => a.data.localeCompare(b.data));

    const ok = await savePagamentos(updated);
    if (ok) { setPagamentos(updated); setEditId(null); toast.success('Pagamento atualizado.'); }
    else toast.error('Erro ao atualizar pagamento.');
  }

  // ── Adicionar descrição ──────────────────────────────────────────────────────

  async function handleAdicionarDescricao() {
    const nome = novaDescricao.trim();
    if (!nome) { toast.error('Digite uma descrição.'); return; }
    if (descricoes.some(d => d.toLowerCase() === nome.toLowerCase())) {
      toast.error('Essa descrição já existe.'); return;
    }
    setSalvandoDesc(true);
    const updated = [...descricoes, nome];
    const ok = await saveDescricoes(updated);
    if (ok) { setDescricoes(updated); setNovaDescricao(''); toast.success('Descrição adicionada.'); }
    else toast.error('Erro ao salvar descrição.');
    setSalvandoDesc(false);
  }

  // ── Cálculos ────────────────────────────────────────────────────────────────

  const totalPago = pagamentos.reduce((s, p) => s + p.valor, 0);
  const saldo     = valorContrato - totalPago;
  // ── Print ─────────────────────────────────────────────────────────────

  function handlePrint() {
    const printSource = document.getElementById('evora-print-area');
    const root = document.getElementById('print-root');
    if (!printSource || !root) { window.print(); return; }

    const clone = printSource.cloneNode(true) as HTMLElement;
    clone.style.display = 'block';
    root.innerHTML = clone.outerHTML;

    const style = document.createElement('style');
    style.textContent = `
      @page { size: A4 portrait; margin: 1cm; }
      #print-root {
        font-family: Inter, sans-serif;
        background: white;
      }
      #print-root, #print-root * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
        color-scheme: light !important;
      }
    `;
    document.head.appendChild(style);

    window.onafterprint = () => {
      document.head.removeChild(style);
      root.innerHTML = '';
      window.onafterprint = null;
    };

    window.print();
  }
  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100">
            <CreditCard className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Controle de Pagamentos Evora</h1>
            <p className="text-xs text-slate-500 mt-0.5">Controle Financeiro Sorana</p>
          </div>
        </div>
        <button
          onClick={onChangeBrand}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
        >
          ← Voltar ao menu
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded text-xs font-semibold hover:bg-violet-700 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Imprimir PDF
        </button>
      </header>

      <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">

        {/* Área de impressão */}
        <div id="evora-print-area">
          {/* Título visível apenas na impressão */}
          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-bold text-slate-800">Controle de Pagamentos Evora</h1>
            <p className="text-sm text-slate-500 mt-1">Controle Financeiro Sorana</p>
          </div>

        {/* ── Valor do Contrato ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Valor do Contrato</h2>
            {!editandoContrato && (
              <button
                onClick={() => promptSenha(() => setEditandoContrato(true))}
                className="no-print flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
            )}
          </div>

          {editandoContrato ? (
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={valorContratoInput}
                  onChange={e => setValorContratoInput(e.target.value)}
                  placeholder="1.000.000,00"
                  className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  onKeyDown={e => e.key === 'Enter' && handleSalvarContrato()}
                />
              </div>
              <button
                onClick={handleSalvarContrato}
                disabled={savingContrato}
                className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                <Check className="w-4 h-4" /> Salvar
              </button>
              <button
                onClick={() => { setEditandoContrato(false); setValorContratoInput(valorContrato > 0 ? valorContrato.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''); }}
                className="p-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              {valorContrato > 0 ? (
                <span className="text-2xl font-bold text-slate-800">{fmtBRL(valorContrato)}</span>
              ) : (
                <span className="text-sm text-slate-400 italic flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Valor do contrato não definido. Clique em "Editar" para definir.
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Resumo financeiro ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          <SummaryCard label="Valor do Contrato" value={fmtBRL(valorContrato)} color="violet" />
          <SummaryCard label="Total Pago" value={fmtBRL(totalPago)} color="red" />
          <SummaryCard
            label="Saldo a Receber"
            value={fmtBRL(saldo)}
            color={saldo < 0 ? 'red' : 'green'}
          />
        </div>

        {/* ── Registrar Pagamento — oculto na impressão ─────────────────────── */}
        <div className="no-print bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Registrar Pagamento</h2>
          <div className="flex flex-wrap gap-3 items-end">
            {/* Data */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</label>
              <input
                type="date"
                value={formData}
                onChange={e => setFormData(e.target.value)}
                max={todayISO()}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
              />
            </div>

            {/* Descrição */}
            <div className="flex flex-col gap-1 flex-1 min-w-[260px]">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Descrição</label>
              <select
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
              >
                {descricoes.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Valor */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formValor}
                  onChange={e => setFormValor(e.target.value)}
                  placeholder="0,00"
                  className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  onKeyDown={e => e.key === 'Enter' && handleIncluir()}
                />
              </div>
            </div>

            {/* Botão incluir */}
            <button
              onClick={handleIncluir}
              disabled={salvando}
              className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Incluir
            </button>
          </div>
        </div>

        {/* ── Tabela de pagamentos ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-500" />
              Pagamentos Efetuados
            </h2>
            <span className="text-xs text-slate-400">{pagamentos.length} registro{pagamentos.length !== 1 ? 's' : ''}</span>
          </div>

          {pagamentos.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-slate-400">
              <CreditCard className="w-10 h-10 opacity-30" />
              <p className="text-sm">Nenhum pagamento registrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-5 py-3 text-left">Data</th>
                    <th className="px-5 py-3 text-left">Descrição</th>
                    <th className="px-5 py-3 text-right">Valor</th>
                    <th className="px-5 py-3 text-center w-24">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagamentos.map(p => (
                    editId === p.id ? (
                      /* ── Linha em edição ── */
                      <tr key={p.id} className="bg-violet-50">
                        <td className="px-4 py-2">
                          <input
                            type="date"
                            value={editData}
                            max={todayISO()}
                            onChange={e => setEditData(e.target.value)}
                            className="border border-violet-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={editDesc}
                            onChange={e => setEditDesc(e.target.value)}
                            className="border border-violet-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white w-full"
                          >
                            {descricoes.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <div className="relative flex justify-end">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editValorStr}
                              onChange={e => setEditValorStr(e.target.value)}
                              className="border border-violet-300 rounded pl-8 pr-2 py-1 text-sm text-right w-32 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={handleSalvarEdit} className="p-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-700">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditId(null)} className="p-1.5 rounded-md bg-slate-200 text-slate-600 hover:bg-slate-300">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      /* ── Linha normal ── */
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{formatDateBR(p.data)}</td>
                        <td className="px-5 py-3 text-slate-700">{p.descricao}</td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">{fmtBRL(p.valor)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => promptSenha(() => startEdit(p))}
                              className="p-1.5 rounded-md text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => promptSenha(() => handleExcluir(p.id))}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>

                {/* ── Totalizador ── */}
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={2} className="px-5 py-3 text-sm font-bold text-slate-700 text-right">Total Pago</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-800 whitespace-nowrap">{fmtBRL(totalPago)}</td>
                    <td />
                  </tr>
                  <tr className={`border-t border-slate-200 ${saldo < 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                    <td colSpan={2} className="px-5 py-3 text-sm font-bold text-slate-700 text-right">Saldo a Receber do Contrato</td>
                    <td className={`px-5 py-3 text-right font-bold text-lg whitespace-nowrap ${saldo < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {fmtBRL(saldo)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
        </div> {/* fim evora-print-area */}

        {/* ── Registrar Pagamento — fora da área de impressão ──────────────── */}
        {/* ── Gerenciar Descrições ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400" />
            Gerenciar Descrições
          </h2>

          {/* Lista de descrições existentes */}
          <div className="flex flex-wrap gap-2 mb-4">
            {descricoes.map(d => (
              <span
                key={d}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200"
              >
                {d}
              </span>
            ))}
          </div>

          {/* Formulário para nova descrição */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={novaDescricao}
              onChange={e => setNovaDescricao(e.target.value)}
              placeholder="Nova descrição..."
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              onKeyDown={e => e.key === 'Enter' && promptSenha(handleAdicionarDescricao)}
            />
            <button
              onClick={() => promptSenha(handleAdicionarDescricao)}
              disabled={salvandoDesc}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        </div>
      </div>

      <PasswordDialog
        open={showSenhaDialog}
        onOpenChange={setShowSenhaDialog}
        onSuccess={handleSenhaSuccess}
        title="Ação Protegida"
        description="Digite a senha para continuar:"
      />
    </div>
  );
}

// ─── Card de resumo ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string; color: 'violet' | 'red' | 'green' }) {
  const styles = {
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    red:    'border-red-200 bg-red-50 text-red-700',
    green:  'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${styles[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
