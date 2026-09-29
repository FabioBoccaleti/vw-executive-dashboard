import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, Key, BookOpen, TableProperties, BarChart2, Search, FilePlus, X, Trash2, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import { loadAssinaturaRows, saveAssinaturaRows, type AssinaturaRow } from './assinaturaStorage';
import { loadSignDriveCatalogo, type CatalogoVeiculos } from './catalogoStorage';
import { loadSignDriveVendedores, loadSignDriveTiposVenda, type Vendedor, type TipoVendaSignDrive } from '@/components/CadastrosPage/cadastrosStorage';

interface AssinaturaSignDriveDashboardProps {
  onChangeBrand: () => void;
  onOpenCadastros: () => void;
}

// ─── Column definitions ────────────────────────────────────────
type ColType = 'text' | 'currency' | 'percent' | 'date';
interface ColDef { key: string; label: string; type: ColType; width: number; }

const COLUMNS: ColDef[] = [
  { key: 'dataRegistro',            label: 'Registro da Venda',            type: 'date',     width: 140 },
  { key: 'dataVenda',               label: 'Data da Venda',                type: 'date',     width: 130 },
  { key: 'cliente',                 label: 'Cliente',                      type: 'text',     width: 185 },
  { key: 'tipoVenda',              label: 'Produto',                      type: 'text',     width: 150 },
  { key: 'veiculo',                 label: 'Veículo',                      type: 'text',     width: 160 },
  { key: 'chassi',                  label: 'Chassi',                       type: 'text',     width: 150 },
  { key: 'placa',                   label: 'Placa',                        type: 'text',     width: 120 },
  { key: 'vendedor',                label: 'Vendedor',                     type: 'text',     width: 160 },
  { key: 'valorContrato',           label: 'Valor do Contrato',            type: 'currency', width: 150 },
  { key: 'comissaoEntrega',         label: 'Valor da Comissão de Entrega', type: 'currency', width: 180 },
  { key: 'comissaoVenda',           label: 'Valor da Comissão de Venda',   type: 'currency', width: 180 },
  { key: 'totalComissoesBruta',     label: 'Total das Comissões Bruta',    type: 'currency', width: 175 },
  { key: 'pctRentabilidadeBruta',   label: '% Rentabilidade Bruta',        type: 'percent',  width: 150 },
  { key: 'impostosComissao',        label: 'Impostos s/ Comissão',         type: 'currency', width: 150 },
  { key: 'totalComissaoLiquida',    label: 'Total das Comissão Líquida',  type: 'currency', width: 175 },
  { key: 'pctRentabilidadeLiquida', label: '% Rentabilidade Líquida',      type: 'percent',  width: 150 },
  { key: 'nfComissao',              label: 'Nº NF de Comissão',            type: 'text',     width: 150 },
  { key: 'situacaoComissao',        label: 'Situação da Comissão',         type: 'text',     width: 160 },
  { key: 'situacaoComissaoVendedor', label: 'Sit. Comissão vendedor',      type: 'text',     width: 170 },
];

// ─── Helpers ───────────────────────────────────────────────────
function parseBR(s: string): number {
  if (!s) return 0;
  let clean = s.trim().replace(/R\$\s*/g, '');
  if (clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function fmtCurrency(raw: string): string {
  if (raw === '' || raw == null) return '—';
  const n = parseFloat(raw);
  return isNaN(n) ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(raw: string): string {
  if (raw === '' || raw == null) return '—';
  const n = parseFloat(raw);
  return isNaN(n) ? '—' : `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

const pad = (n: number) => String(n).padStart(2, '0');
function todayISO(): string { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayBR(): string { const d = new Date(); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; }
function isoToBR(iso: string): string { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function brToISO(br: string): string { if (!br) return ''; const [d, m, y] = br.split('/'); return d && m && y ? `${y}-${m}-${d}` : ''; }

type RegisterDraft = {
  dataVenda: string; cliente: string; produto: string; veiculo: string;
  chassi: string; placa: string; vendedor: string; valorContrato: string;
  pctComissaoVendaOverride: string;
};
const emptyDraft = (): RegisterDraft => ({
  dataVenda: todayISO(), cliente: '', produto: '', veiculo: '',
  chassi: '', placa: '', vendedor: '', valorContrato: '',
  pctComissaoVendaOverride: '',
});

// Produto que permite alterar o % de comissão da venda no registro (desconto)
const PRODUTO_COMISSAO_EDITAVEL = 'Sign and Drive Empresas';

export function AssinaturaSignDriveDashboard({ onChangeBrand, onOpenCadastros }: AssinaturaSignDriveDashboardProps) {
  const { canAccessVendasSub, isAdmin } = useAuth();
  const canTabela  = isAdmin() || canAccessVendasSub('assinatura_signdrive.tabela');
  const canAnalise = isAdmin() || canAccessVendasSub('assinatura_signdrive.analise');
  const canCadastro = isAdmin() || canAccessVendasSub('assinatura_signdrive.cadastro');

  const [activeTab, setActiveTab] = useState<'tabela' | 'analise'>(canTabela ? 'tabela' : 'analise');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const setFilter = (key: string, value: string) => setFilters(prev => ({ ...prev, [key]: value }));

  const [rows, setRows] = useState<AssinaturaRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Cadastros (dropdowns)
  const [catalogo, setCatalogo] = useState<CatalogoVeiculos>({ marcas: [], modelos: [] });
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [tiposVenda, setTiposVenda] = useState<TipoVendaSignDrive[]>([]);

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [draft, setDraft] = useState<RegisterDraft>(emptyDraft());

  // Edição inline
  type EditDraft = {
    dataVenda: string; cliente: string; produto: string; veiculo: string;
    chassi: string; placa: string; vendedor: string; valorContrato: string;
    comissaoVenda: string; nfComissao: string;
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    dataVenda: '', cliente: '', produto: '', veiculo: '', chassi: '', placa: '', vendedor: '', valorContrato: '', comissaoVenda: '', nfComissao: '',
  });

  useEffect(() => {
    loadAssinaturaRows().then(setRows);
    loadSignDriveCatalogo().then(setCatalogo);
    loadSignDriveVendedores().then(setVendedores);
    loadSignDriveTiposVenda().then(setTiposVenda);
  }, []);

  const veiculoOptions = useMemo(() => {
    const marcaNome = (id: string) => catalogo.marcas.find(m => m.id === id)?.nome ?? '';
    return catalogo.modelos.map(m => `${marcaNome(m.marcaId)} ${m.modelo}`.trim());
  }, [catalogo]);

  // Comissões calculadas a partir do % do produto (Tipo da Venda) sobre o Valor do Contrato
  const preview = useMemo(() => {
    const prod = tiposVenda.find(t => t.descricao === draft.produto);
    const valor = parseBR(draft.valorContrato);
    const isEditavel = draft.produto === PRODUTO_COMISSAO_EDITAVEL;
    const pctVendaCad = prod ? parseBR(prod.pctComissaoVenda) : 0;
    const pctVenda = isEditavel && draft.pctComissaoVendaOverride.trim() !== '' ? parseBR(draft.pctComissaoVendaOverride) : pctVendaCad;
    const pctEntrega = prod ? parseBR(prod.pctComissaoEntrega) : 0;
    const pctImpostos = prod ? parseBR(prod.pctImpostos) : 0;
    const comissaoVenda = valor * pctVenda / 100;
    const comissaoEntrega = valor * pctEntrega / 100;
    const total = comissaoVenda + comissaoEntrega;
    const rentBruta = valor > 0 ? total / valor * 100 : 0;
    const impostos = total * pctImpostos / 100;
    const totalLiquida = total - impostos;
    const rentLiquida = valor > 0 ? totalLiquida / valor * 100 : 0;
    return { comissaoVenda, comissaoEntrega, total, rentBruta, impostos, totalLiquida, rentLiquida };
  }, [draft.produto, draft.valorContrato, draft.pctComissaoVendaOverride, tiposVenda]);

  const persist = async (updated: AssinaturaRow[]) => {
    setSaving(true);
    try {
      const ok = await saveAssinaturaRows(updated);
      if (!ok) toast.error('Erro ao salvar.');
      else setRows(updated);
    } finally {
      setSaving(false);
    }
  };

  const registerVenda = async () => {
    if (!draft.cliente.trim() || !draft.produto || !draft.veiculo || !draft.chassi.trim() || !draft.vendedor || !draft.valorContrato.trim()) {
      toast.error('Preencha Cliente, Produto, Veículo, Chassi, Vendedor e Valor do Contrato.');
      return;
    }
    const valor = parseBR(draft.valorContrato);
    const newRow: AssinaturaRow = {
      id: crypto.randomUUID(),
      dataRegistro: todayBR(),
      dataVenda: isoToBR(draft.dataVenda) || todayBR(),
      cliente: draft.cliente.trim(),
      tipoVenda: draft.produto,
      veiculo: draft.veiculo,
      chassi: draft.chassi.trim(),
      placa: draft.placa.trim(),
      vendedor: draft.vendedor,
      valorContrato: String(valor),
      comissaoEntrega: String(preview.comissaoEntrega),
      comissaoVenda: String(preview.comissaoVenda),
      totalComissoesBruta: String(preview.total),
      pctRentabilidadeBruta: String(preview.rentBruta),
      impostosComissao: String(preview.impostos),
      totalComissaoLiquida: String(preview.totalLiquida),
      pctRentabilidadeLiquida: String(preview.rentLiquida),
      nfComissao: '',
      situacaoComissao: '',
      situacaoComissaoVendedor: '',
    };
    await persist([newRow, ...rows]);
    setShowRegisterModal(false);
    setDraft(emptyDraft());
    toast.success('Venda registrada');
  };

  const deleteRow = async (id: string) => {
    await persist(rows.filter(r => r.id !== id));
    toast.success('Registro removido');
  };

  // Cálculos da linha em edição (para Empresas, a comissão de venda é editada direto)
  const editPreview = useMemo(() => {
    const prod = tiposVenda.find(t => t.descricao === editDraft.produto);
    const valor = parseBR(editDraft.valorContrato);
    const isEmpresas = editDraft.produto === PRODUTO_COMISSAO_EDITAVEL;
    const pctVenda = prod ? parseBR(prod.pctComissaoVenda) : 0;
    const pctEntrega = prod ? parseBR(prod.pctComissaoEntrega) : 0;
    const pctImpostos = prod ? parseBR(prod.pctImpostos) : 0;
    const comissaoVenda = isEmpresas ? parseBR(editDraft.comissaoVenda) : valor * pctVenda / 100;
    const comissaoEntrega = valor * pctEntrega / 100;
    const total = comissaoVenda + comissaoEntrega;
    const rentBruta = valor > 0 ? total / valor * 100 : 0;
    const impostos = total * pctImpostos / 100;
    const totalLiquida = total - impostos;
    const rentLiquida = valor > 0 ? totalLiquida / valor * 100 : 0;
    return { comissaoVenda, comissaoEntrega, total, rentBruta, impostos, totalLiquida, rentLiquida };
  }, [editDraft, tiposVenda]);

  const startEdit = (row: AssinaturaRow) => {
    setEditingId(row.id);
    setEditDraft({
      dataVenda: brToISO(row.dataVenda),
      cliente: row.cliente,
      produto: row.tipoVenda,
      veiculo: row.veiculo,
      chassi: row.chassi,
      placa: row.placa,
      vendedor: row.vendedor,
      valorContrato: row.valorContrato,
      comissaoVenda: row.comissaoVenda,
      nfComissao: row.nfComissao ?? '',
    });
  };

  const saveEditRow = async () => {
    if (!editingId) return;
    if (!editDraft.cliente.trim() || !editDraft.produto || !editDraft.veiculo || !editDraft.chassi.trim() || !editDraft.vendedor || !editDraft.valorContrato.trim()) {
      toast.error('Preencha Cliente, Produto, Veículo, Chassi, Vendedor e Valor do Contrato.');
      return;
    }
    const valor = parseBR(editDraft.valorContrato);
    const updated = rows.map(r => r.id === editingId ? {
      ...r,
      dataVenda: isoToBR(editDraft.dataVenda) || r.dataVenda,
      cliente: editDraft.cliente.trim(),
      tipoVenda: editDraft.produto,
      veiculo: editDraft.veiculo,
      chassi: editDraft.chassi.trim(),
      placa: editDraft.placa.trim(),
      vendedor: editDraft.vendedor,
      valorContrato: String(valor),
      comissaoEntrega: String(editPreview.comissaoEntrega),
      comissaoVenda: String(editPreview.comissaoVenda),
      totalComissoesBruta: String(editPreview.total),
      pctRentabilidadeBruta: String(editPreview.rentBruta),
      impostosComissao: String(editPreview.impostos),
      totalComissaoLiquida: String(editPreview.totalLiquida),
      pctRentabilidadeLiquida: String(editPreview.rentLiquida),
      nfComissao: editDraft.nfComissao.trim(),
    } : r);
    await persist(updated);
    setEditingId(null);
    toast.success('Registro atualizado');
  };

  const filteredRows = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v.trim() !== '');
    if (active.length === 0) return rows;
    return rows.filter(row =>
      active.every(([key, v]) => String((row as unknown as Record<string, string>)[key] ?? '').toLowerCase().includes(v.toLowerCase())),
    );
  }, [rows, filters]);

  const fmtCell = (col: ColDef, value: string): string => {
    if (col.type === 'currency') return fmtCurrency(value);
    if (col.type === 'percent') return fmtPct(value);
    return value || '—';
  };

  const editInputClass = 'w-full min-w-0 bg-white border border-blue-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400';

  const renderCellContent = (col: ColDef, row: AssinaturaRow) => {
    const editing = editingId === row.id;
    const val = (row as unknown as Record<string, string>)[col.key] ?? '';
    if (!editing) {
      if (col.key === 'situacaoComissao') return (row.nfComissao ?? '').trim() ? 'Nota Fiscal Emitida' : 'Comissão a Receber';
      return fmtCell(col, val);
    }
    switch (col.key) {
      case 'dataVenda':
        return <input type="date" value={editDraft.dataVenda} onChange={e => setEditDraft(p => ({ ...p, dataVenda: e.target.value }))} className={editInputClass} />;
      case 'cliente':
        return <input type="text" value={editDraft.cliente} onChange={e => setEditDraft(p => ({ ...p, cliente: e.target.value }))} className={editInputClass} />;
      case 'tipoVenda':
        return (
          <select value={editDraft.produto} onChange={e => setEditDraft(p => ({ ...p, produto: e.target.value }))} className={editInputClass}>
            <option value="">Selecione...</option>
            {tiposVenda.map(t => <option key={t.id} value={t.descricao}>{t.descricao}</option>)}
          </select>
        );
      case 'veiculo':
        return (
          <select value={editDraft.veiculo} onChange={e => setEditDraft(p => ({ ...p, veiculo: e.target.value }))} className={editInputClass}>
            <option value="">Selecione...</option>
            {veiculoOptions.map((v, i) => <option key={`${v}-${i}`} value={v}>{v}</option>)}
          </select>
        );
      case 'chassi':
        return <input type="text" value={editDraft.chassi} onChange={e => setEditDraft(p => ({ ...p, chassi: e.target.value }))} className={editInputClass} />;
      case 'placa':
        return <input type="text" value={editDraft.placa} onChange={e => setEditDraft(p => ({ ...p, placa: e.target.value }))} className={editInputClass} />;
      case 'vendedor':
        return (
          <select value={editDraft.vendedor} onChange={e => setEditDraft(p => ({ ...p, vendedor: e.target.value }))} className={editInputClass}>
            <option value="">Selecione...</option>
            {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
          </select>
        );
      case 'valorContrato':
        return <input type="text" value={editDraft.valorContrato} onChange={e => setEditDraft(p => ({ ...p, valorContrato: e.target.value }))} className={`${editInputClass} text-right`} />;
      case 'comissaoVenda':
        if (editDraft.produto === PRODUTO_COMISSAO_EDITAVEL)
          return <input type="text" value={editDraft.comissaoVenda} onChange={e => setEditDraft(p => ({ ...p, comissaoVenda: e.target.value }))} className={`${editInputClass} text-right`} />;
        return fmtCurrency(String(editPreview.comissaoVenda));
      case 'comissaoEntrega':      return fmtCurrency(String(editPreview.comissaoEntrega));
      case 'totalComissoesBruta':  return fmtCurrency(String(editPreview.total));
      case 'pctRentabilidadeBruta': return fmtPct(String(editPreview.rentBruta));
      case 'impostosComissao':     return fmtCurrency(String(editPreview.impostos));
      case 'totalComissaoLiquida': return fmtCurrency(String(editPreview.totalLiquida));
      case 'pctRentabilidadeLiquida': return fmtPct(String(editPreview.rentLiquida));
      case 'nfComissao':
        return <input type="text" value={editDraft.nfComissao} onChange={e => setEditDraft(p => ({ ...p, nfComissao: e.target.value }))} className={editInputClass} />;
      case 'situacaoComissao':
        return editDraft.nfComissao.trim() ? 'Nota Fiscal Emitida' : 'Comissão a Receber';
      default:
        return fmtCell(col, val);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ── Header ── */}
      <header
        className="text-white shadow-lg flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' }}
      >
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-lg">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight">
                Vendas de Carro por Assinatura (Sign&amp;Drive)
              </h1>
              <p className="text-blue-200 text-xs mt-0.5">{rows.length} {rows.length === 1 ? 'registro' : 'registros'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Abas */}
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 gap-0.5">
              {canTabela && (
              <button
                onClick={() => setActiveTab('tabela')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === 'tabela'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <TableProperties className="w-3.5 h-3.5" />
                Tabela
              </button>
              )}
              {canAnalise && (
              <button
                onClick={() => setActiveTab('analise')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === 'analise'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Análise
              </button>
              )}
            </div>
            {canCadastro && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenCadastros}
              className="text-white border border-white/30 hover:bg-white/15 gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Cadastro
            </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onChangeBrand}
              className="text-white border border-white/30 hover:bg-white/15 gap-2"
            >
              <LogOut className="w-4 h-4" />
              Trocar painel
            </Button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      {activeTab === 'tabela' && canTabela && (
        <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
          <div
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto flex-1"
            style={{ maxHeight: 'calc(100vh - 180px)' }}
          >
            <table className="border-collapse text-sm" style={{ width: 'max-content', minWidth: '100%' }}>
              <colgroup>
                <col style={{ width: 56, minWidth: 56 }} />
                {COLUMNS.map(c => (
                  <col key={c.key} style={{ width: c.width, minWidth: c.width }} />
                ))}
                <col style={{ width: 110, minWidth: 110 }} /> {/* Ações */}
              </colgroup>

              {/* ── THEAD ── */}
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-40 text-white text-center text-xs font-semibold px-2 py-3 border-r border-blue-900" style={{ background: '#1e3a8a' }}>#</th>
                  {COLUMNS.map((col, ci) => (
                    <th key={`h-${col.key}-${ci}`} className="sticky top-0 z-30 text-white text-xs font-semibold px-3 py-3 border-r border-blue-500 align-top leading-snug text-center" style={{ background: '#2563eb' }}>
                      {col.label}
                    </th>
                  ))}
                  <th className="sticky right-0 top-0 z-40 text-white text-center text-xs font-semibold px-2 py-3 border-l border-blue-900 whitespace-nowrap" style={{ background: '#1e3a8a' }}>Ações</th>
                </tr>

                {/* Filter row */}
                <tr>
                  <th className="sticky left-0 z-40 bg-slate-50 border-r border-b border-slate-200 px-1 py-1.5" style={{ top: 'var(--header-height, 44px)' }} />
                  {COLUMNS.map((col, ci) => (
                    <th key={`f-${col.key}-${ci}`} className="sticky z-30 bg-slate-50 border-r border-b border-slate-200 px-1.5 py-1.5" style={{ top: 'var(--header-height, 44px)' }}>
                      <div className="relative flex items-center">
                        <Search className="absolute left-1.5 w-3 h-3 text-slate-300 pointer-events-none" />
                        <input
                          type="text"
                          value={filters[col.key] ?? ''}
                          onChange={e => setFilter(col.key, e.target.value)}
                          className={`w-full min-w-0 bg-white border rounded pl-5 pr-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 ${(filters[col.key]?.length ?? 0) > 0 ? 'border-blue-400 ring-1 ring-blue-300' : 'border-slate-200'}`}
                        />
                      </div>
                    </th>
                  ))}
                  <th className="sticky right-0 z-40 bg-slate-50 border-l border-b border-slate-200 px-1 py-1.5" style={{ top: 'var(--header-height, 44px)' }} />
                </tr>
              </thead>

              {/* ── TBODY ── */}
              <tbody>
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length + 2} className="text-center text-sm text-slate-400 py-10">
                      Nenhum registro cadastrado
                    </td>
                  </tr>
                )}
                {filteredRows.map((row, idx) => {
                  const editing = editingId === row.id;
                  const isEven = idx % 2 === 0;
                  const rowBg = editing ? '#eff6ff' : isEven ? '#ffffff' : '#f8fafc';
                  const nf = editing ? editDraft.nfComissao : (row.nfComissao ?? '');
                  return (
                    <tr key={row.id} style={{ background: rowBg }} className="transition-colors">
                      <td className="sticky left-0 z-20 text-center border-r border-slate-200 px-1 py-1" style={{ background: rowBg }}>
                        <span className="text-xs text-slate-400 font-mono">{idx + 1}</span>
                      </td>
                      {COLUMNS.map((col, ci) => {
                        const isRight = col.type === 'currency' || col.type === 'percent';
                        const isSituacao = col.key === 'situacaoComissao';
                        return (
                          <td key={`c-${col.key}-${ci}`} className={`px-3 py-1.5 text-xs border-r border-slate-100 whitespace-nowrap ${isRight && !editing ? 'text-right' : ''} ${isSituacao ? 'font-semibold ' + (nf.trim() ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-700'}`}>
                            {renderCellContent(col, row)}
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-20 text-center border-l border-slate-200 px-1 py-1" style={{ background: rowBg }}>
                        {editing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={saveEditRow} disabled={saving} className="text-green-600 hover:text-green-700 p-1 rounded" title="Salvar"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded" title="Cancelar"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => startEdit(row)} className="text-blue-500 hover:text-blue-700 p-1 rounded" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deleteRow(row.id)} disabled={saving} className="text-red-400 hover:text-red-600 p-1 rounded" title="Remover"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Footer ── */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => { setDraft(emptyDraft()); setShowRegisterModal(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              <FilePlus className="w-4 h-4" />
              Registrar Venda
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'analise' && canAnalise && (
        <div className="flex-1 overflow-auto p-6" />
      )}

      {/* ── Modal Registrar Venda ── */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-blue-100 rounded-xl flex-shrink-0">
                  <FilePlus className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Registrar Venda</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Preencha os dados da venda. A data de registro será definida automaticamente.</p>
                </div>
              </div>
              <button onClick={() => { setShowRegisterModal(false); setDraft(emptyDraft()); }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Fields grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Data da Venda <span className="text-red-500">*</span></label>
                <input type="date" value={draft.dataVenda} onChange={e => setDraft(p => ({ ...p, dataVenda: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Cliente <span className="text-red-500">*</span></label>
                <input type="text" value={draft.cliente} onChange={e => setDraft(p => ({ ...p, cliente: e.target.value }))} placeholder="Nome do cliente" className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Produto <span className="text-red-500">*</span></label>
                <select value={draft.produto} onChange={e => { const prod = tiposVenda.find(t => t.descricao === e.target.value); setDraft(p => ({ ...p, produto: e.target.value, pctComissaoVendaOverride: e.target.value === PRODUTO_COMISSAO_EDITAVEL ? (prod?.pctComissaoVenda ?? '') : '' })); }} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                  <option value="">Selecione...</option>
                  {tiposVenda.map(t => <option key={t.id} value={t.descricao}>{t.descricao}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Veículo <span className="text-red-500">*</span></label>
                <select value={draft.veiculo} onChange={e => setDraft(p => ({ ...p, veiculo: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                  <option value="">Selecione...</option>
                  {veiculoOptions.map((v, i) => <option key={`${v}-${i}`} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Chassi <span className="text-red-500">*</span></label>
                <input type="text" value={draft.chassi} onChange={e => setDraft(p => ({ ...p, chassi: e.target.value }))} placeholder="Ex: 9BWZZZ377VT004251" className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Placa</label>
                <input type="text" value={draft.placa} onChange={e => setDraft(p => ({ ...p, placa: e.target.value }))} placeholder="Ex: ABC1D23" className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Vendedor <span className="text-red-500">*</span></label>
                <select value={draft.vendedor} onChange={e => setDraft(p => ({ ...p, vendedor: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                  <option value="">Selecione...</option>
                  {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Valor do Contrato <span className="text-red-500">*</span></label>
                <input type="text" value={draft.valorContrato} onChange={e => setDraft(p => ({ ...p, valorContrato: e.target.value }))} placeholder="Ex: 1.500,00" className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              {draft.produto === PRODUTO_COMISSAO_EDITAVEL && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">% Comissão da Venda <span className="text-red-500">*</span></label>
                <input type="text" value={draft.pctComissaoVendaOverride} onChange={e => setDraft(p => ({ ...p, pctComissaoVendaOverride: e.target.value }))} placeholder="Ex: 2" className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <span className="text-[11px] text-slate-400">Ajuste conforme o desconto concedido.</span>
              </div>
              )}
            </div>

            {/* Comissões calculadas (somente leitura) */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 bg-slate-50 rounded-xl p-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Valor da Comissão de Entrega</label>
                <div className="text-sm font-semibold text-slate-700">{fmtCurrency(String(preview.comissaoEntrega))}</div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Valor da Comissão de Venda</label>
                <div className="text-sm font-semibold text-slate-700">{fmtCurrency(String(preview.comissaoVenda))}</div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Total das Comissões Bruta</label>
                <div className="text-sm font-semibold text-slate-700">{fmtCurrency(String(preview.total))}</div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">% Rentabilidade Bruta</label>
                <div className="text-sm font-semibold text-slate-700">{fmtPct(String(preview.rentBruta))}</div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Impostos s/ Comissão</label>
                <div className="text-sm font-semibold text-slate-700">{fmtCurrency(String(preview.impostos))}</div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Total das Comissão Líquida</label>
                <div className="text-sm font-semibold text-slate-700">{fmtCurrency(String(preview.totalLiquida))}</div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">% Rentabilidade Líquida</label>
                <div className="text-sm font-semibold text-slate-700">{fmtPct(String(preview.rentLiquida))}</div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex gap-3 justify-end pt-1 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => { setShowRegisterModal(false); setDraft(emptyDraft()); }} className="border-slate-300 text-slate-600">Cancelar</Button>
              <Button size="sm" onClick={registerVenda} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                <FilePlus className="w-4 h-4" />
                Registrar Venda
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
