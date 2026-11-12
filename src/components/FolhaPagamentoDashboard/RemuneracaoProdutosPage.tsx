import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BookOpen, TableProperties, FileText, FilePlus, X, Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { RemuneracaoProdutosCadastro } from './RemuneracaoProdutosCadastro';
import { DemonstrativoProdutosView } from './DemonstrativoProdutosView';
import {
  loadMarcasRP, saveMarcasRP,
  loadProdutosRP, saveProdutosRP,
  loadVendedoresRP, saveVendedoresRP,
  loadModelosRP, saveModelosRP,
  loadRegistrosRP, saveRegistrosRP,
  loadDemoMetaRP, saveDemoMetaRP, demoMetaKey,
  type MarcaRP, type ProdutoRP, type VendedorRP, type ModeloRP, type RegistroVendaRP,
  type DemonstrativoMetaRP, type CampoAssinaturaRP, type AssinaturaDigitalRP,
} from './remuneracaoProdutosStorage';

interface RemuneracaoProdutosPageProps {
  onBack: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
const todayISO = (): string => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const isoToBR = (iso: string): string => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return y && m && d ? `${d}/${m}/${y}` : ''; };
const fmtCurrency = (raw: string): string => { const n = parseFloat(raw); return isNaN(n) ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };

type Draft = {
  data: string;
  marcaId: string;
  vendedorId: string;
  cliente: string;
  modeloId: string;
  produtoId: string;
};
const emptyDraft = (): Draft => ({ data: todayISO(), marcaId: '', vendedorId: '', cliente: '', modeloId: '', produtoId: '' });

const inputCls = 'border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400';

/** Mapeia o nome da marca (cadastro livre) para VW/Audi. */
function brandOfMarca(marca: string): 'vw' | 'audi' | null {
  const n = (marca ?? '').trim().toLowerCase();
  if (n === 'audi') return 'audi';
  if (n === 'vw' || n === 'volkswagen') return 'vw';
  return null;
}

export function RemuneracaoProdutosPage({ onBack }: RemuneracaoProdutosPageProps) {
  const [view, setView] = useState<'tabela' | 'demonstrativo' | 'cadastro'>('tabela');
  const [loading, setLoading] = useState(true);

  const [marcas, setMarcas] = useState<MarcaRP[]>([]);
  const [produtos, setProdutos] = useState<ProdutoRP[]>([]);
  const [vendedores, setVendedores] = useState<VendedorRP[]>([]);
  const [modelos, setModelos] = useState<ModeloRP[]>([]);
  const [registros, setRegistros] = useState<RegistroVendaRP[]>([]);
  const [demoMeta, setDemoMeta] = useState<Record<string, DemonstrativoMetaRP>>({});

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [ma, pr, ve, mo, re, dm] = await Promise.all([
        loadMarcasRP(), loadProdutosRP(), loadVendedoresRP(), loadModelosRP(), loadRegistrosRP(), loadDemoMetaRP(),
      ]);
      setMarcas(ma); setProdutos(pr); setVendedores(ve); setModelos(mo); setRegistros(re); setDemoMeta(dm);
      setLoading(false);
    })();
  }, []);

  // ── Persistência dos cadastros ──
  const persistMarcas = (items: MarcaRP[]) => { setMarcas(items); saveMarcasRP(items); };
  const persistProdutos = (items: ProdutoRP[]) => { setProdutos(items); saveProdutosRP(items); };
  const persistVendedores = (items: VendedorRP[]) => { setVendedores(items); saveVendedoresRP(items); };
  const persistModelos = (items: ModeloRP[]) => { setModelos(items); saveModelosRP(items); };

  // ── Opções filtradas pela marca selecionada no formulário ──
  const vendedoresFiltrados = useMemo(() => vendedores.filter(v => v.marcaId === draft.marcaId), [vendedores, draft.marcaId]);
  const modelosFiltrados = useMemo(() => modelos.filter(m => m.marcaId === draft.marcaId), [modelos, draft.marcaId]);
  const produtosFiltrados = useMemo(() => produtos.filter(p => p.marcaId === draft.marcaId), [produtos, draft.marcaId]);
  const produtoSel = useMemo(() => produtos.find(p => p.id === draft.produtoId), [produtos, draft.produtoId]);
  const premioPreview = produtoSel ? produtoSel.premio : '';

  const openNew = () => { setEditId(null); setDraft(emptyDraft()); setShowModal(true); };
  const openEdit = (row: RegistroVendaRP) => {
    setEditId(row.id);
    setDraft({ data: row.data, marcaId: row.marcaId, vendedorId: row.vendedorId, cliente: row.cliente, modeloId: row.modeloId, produtoId: row.produtoId });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditId(null); setDraft(emptyDraft()); };

  // Ao trocar a marca, limpa os campos dependentes.
  const onChangeMarca = (marcaId: string) => setDraft(p => ({ ...p, marcaId, vendedorId: '', modeloId: '', produtoId: '' }));

  const saveRegistro = async () => {
    if (!draft.marcaId) { toast.error('Selecione a marca.'); return; }
    if (!draft.data) { toast.error('Informe a data.'); return; }
    if (!draft.vendedorId) { toast.error('Selecione o vendedor.'); return; }
    if (!draft.cliente.trim()) { toast.error('Informe o cliente.'); return; }
    if (!draft.modeloId) { toast.error('Selecione o modelo do veículo.'); return; }
    if (!draft.produtoId) { toast.error('Selecione o produto.'); return; }

    const marca = marcas.find(m => m.id === draft.marcaId);
    const vendedor = vendedores.find(v => v.id === draft.vendedorId);
    const modelo = modelos.find(m => m.id === draft.modeloId);
    const produto = produtos.find(p => p.id === draft.produtoId);
    if (!marca || !vendedor || !modelo || !produto) { toast.error('Dados do cadastro não encontrados.'); return; }

    setSaving(true);
    let next: RegistroVendaRP[];
    if (editId) {
      next = registros.map(r => r.id === editId ? {
        ...r,
        data: draft.data,
        marcaId: marca.id, marca: marca.nome,
        vendedorId: vendedor.id, vendedor: vendedor.nome,
        cliente: draft.cliente.trim(),
        modeloId: modelo.id, modelo: modelo.nome,
        produtoId: produto.id, produto: produto.nome,
        valorPremio: produto.premio,
      } : r);
    } else {
      const novo: RegistroVendaRP = {
        id: crypto.randomUUID(),
        data: draft.data,
        marcaId: marca.id, marca: marca.nome,
        vendedorId: vendedor.id, vendedor: vendedor.nome,
        cliente: draft.cliente.trim(),
        modeloId: modelo.id, modelo: modelo.nome,
        produtoId: produto.id, produto: produto.nome,
        valorPremio: produto.premio,
        dataPagamento: '',
      };
      next = [novo, ...registros];
    }
    setRegistros(next);
    await saveRegistrosRP(next);
    setSaving(false);
    closeModal();
    toast.success(editId ? 'Venda atualizada.' : 'Venda registrada.');
  };

  const removeRegistro = async (id: string) => {
    if (!window.confirm('Excluir esta venda?')) return;
    const next = registros.filter(r => r.id !== id);
    setRegistros(next);
    await saveRegistrosRP(next);
    toast.success('Venda excluída.');
  };

  // Marca como pago: grava a data de hoje nas vendas pendentes do vendedor (daquela marca).
  const handleMarkPaid = async (brand: 'vw' | 'audi', vendedorId: string) => {
    const hoje = todayISO();
    const matches = (r: RegistroVendaRP) =>
      !r.dataPagamento && brandOfMarca(r.marca) === brand && (r.vendedorId === vendedorId || (!r.vendedorId && r.vendedor === vendedorId));
    if (!registros.some(matches)) return;
    const nextReg = registros.map(r => matches(r) ? { ...r, dataPagamento: hoje } : r);
    setRegistros(nextReg);
    await saveRegistrosRP(nextReg);
  };

  // Reabre o demonstrativo (senha 1985): esvazia a data de pagamento das vendas
  // pagas na competência e apaga as assinaturas.
  const handleReopen = async (brand: 'vw' | 'audi', vendedorId: string, year: number, month: number) => {
    const compPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const matches = (r: RegistroVendaRP) =>
      !!r.dataPagamento && r.dataPagamento.startsWith(compPrefix) && brandOfMarca(r.marca) === brand
      && (r.vendedorId === vendedorId || (!r.vendedorId && r.vendedor === vendedorId));
    const nextReg = registros.map(r => matches(r) ? { ...r, dataPagamento: '' } : r);
    setRegistros(nextReg);
    await saveRegistrosRP(nextReg);

    const key = demoMetaKey(brand, vendedorId, year, month);
    const nextMeta = { ...demoMeta };
    nextMeta[key] = { assinaturas: {} };
    setDemoMeta(nextMeta);
    await saveDemoMetaRP(nextMeta);
  };

  // Assinatura do demonstrativo (persistida por marca/vendedor/competência).
  const handleSaveSign = async (key: string, campo: CampoAssinaturaRP, assinatura: AssinaturaDigitalRP | null) => {
    const next = { ...demoMeta };
    const meta = { ...(next[key] ?? {}) };
    const assinaturas = { ...(meta.assinaturas ?? {}) };
    if (assinatura) assinaturas[campo] = assinatura;
    else delete assinaturas[campo];
    meta.assinaturas = assinaturas;
    next[key] = meta;
    setDemoMeta(next);
    await saveDemoMetaRP(next);
  };

  const columns = ['Data', 'Marca', 'Vendedor', 'Cliente', 'Modelo Veículo', 'Produto', 'Valor do Prêmio', 'Data do Pagamento'];

  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Remuneração Produtos</h1>
          <p className="text-xs text-slate-500 mt-0.5">Folha de Pagamento</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setView('tabela')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === 'tabela' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <TableProperties className="w-3.5 h-3.5" /> Registro de Vendas
            </button>
            <button
              onClick={() => setView('demonstrativo')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === 'demonstrativo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FileText className="w-3.5 h-3.5" /> Demonstrativo de Pagamento
            </button>
            <button
              onClick={() => setView('cadastro')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === 'cadastro' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Cadastro
            </button>
          </div>
          <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50">
            ← Voltar
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Carregando...</div>
      ) : view === 'cadastro' ? (
        <RemuneracaoProdutosCadastro
          marcas={marcas} produtos={produtos} vendedores={vendedores} modelos={modelos}
          onChangeMarcas={persistMarcas} onChangeProdutos={persistProdutos}
          onChangeVendedores={persistVendedores} onChangeModelos={persistModelos}
        />
      ) : view === 'demonstrativo' ? (
        <DemonstrativoProdutosView
          registros={registros}
          vendedores={vendedores}
          demoMeta={demoMeta}
          onMarkPaid={handleMarkPaid}
          onReopen={handleReopen}
          onSaveSign={handleSaveSign}
        />
      ) : (
        <>
          {/* Tabela */}
          <div className="flex-1 overflow-auto p-6">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 w-10">#</th>
                    {columns.map(c => <th key={c} className="px-3 py-3 text-left text-xs font-bold text-slate-500 whitespace-nowrap">{c}</th>)}
                    <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 w-24">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registros.length === 0 && (
                    <tr>
                      <td colSpan={columns.length + 2} className="px-3 py-10 text-center text-sm text-slate-400">
                        Nenhuma venda registrada. Clique em "Registrar Venda" para incluir.
                      </td>
                    </tr>
                  )}
                  {registros.map((r, i) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{isoToBR(r.data) || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{r.marca || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{r.vendedor || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-700">{r.cliente || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{r.modelo || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{r.produto || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{fmtCurrency(r.valorPremio)}</td>
                      <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{isoToBR(r.dataPagamento) || '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(r)} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50" title="Editar"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => removeRegistro(r.id)} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Barra inferior */}
          <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
            <Button onClick={openNew} className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5">
              <Plus className="w-4 h-4" /> Registrar Venda
            </Button>
            <span className="text-xs text-slate-500">{registros.length} {registros.length === 1 ? 'registro' : 'registros'}</span>
          </div>
        </>
      )}

      {/* Modal Registrar / Editar Venda */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-teal-100 rounded-xl flex-shrink-0">
                  <FilePlus className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">{editId ? 'Editar Venda' : 'Registrar Venda'}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Selecione a marca para liberar vendedor, modelo e produto.</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Data <span className="text-red-500">*</span></label>
                <input type="date" value={draft.data} onChange={e => setDraft(p => ({ ...p, data: e.target.value }))} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Marca <span className="text-red-500">*</span></label>
                <select value={draft.marcaId} onChange={e => onChangeMarca(e.target.value)} className={`${inputCls} bg-white`}>
                  <option value="">Selecione...</option>
                  {marcas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Vendedor <span className="text-red-500">*</span></label>
                <select value={draft.vendedorId} onChange={e => setDraft(p => ({ ...p, vendedorId: e.target.value }))} disabled={!draft.marcaId} className={`${inputCls} bg-white disabled:bg-slate-100 disabled:text-slate-400`}>
                  <option value="">{draft.marcaId ? 'Selecione...' : 'Selecione a marca primeiro'}</option>
                  {vendedoresFiltrados.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Cliente <span className="text-red-500">*</span></label>
                <input type="text" value={draft.cliente} onChange={e => setDraft(p => ({ ...p, cliente: e.target.value }))} placeholder="Nome do cliente" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Modelo Veículo <span className="text-red-500">*</span></label>
                <select value={draft.modeloId} onChange={e => setDraft(p => ({ ...p, modeloId: e.target.value }))} disabled={!draft.marcaId} className={`${inputCls} bg-white disabled:bg-slate-100 disabled:text-slate-400`}>
                  <option value="">{draft.marcaId ? 'Selecione...' : 'Selecione a marca primeiro'}</option>
                  {modelosFiltrados.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Produto <span className="text-red-500">*</span></label>
                <select value={draft.produtoId} onChange={e => setDraft(p => ({ ...p, produtoId: e.target.value }))} disabled={!draft.marcaId} className={`${inputCls} bg-white disabled:bg-slate-100 disabled:text-slate-400`}>
                  <option value="">{draft.marcaId ? 'Selecione...' : 'Selecione a marca primeiro'}</option>
                  {produtosFiltrados.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Valor do Prêmio</label>
                <div className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700">{fmtCurrency(premioPreview)}</div>
                <span className="text-[11px] text-slate-400">Preenchido automaticamente pelo produto.</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-1 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={closeModal} className="border-slate-300 text-slate-600">Cancelar</Button>
              <Button size="sm" onClick={saveRegistro} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5">
                <FilePlus className="w-4 h-4" />
                {editId ? 'Salvar' : 'Registrar Venda'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
