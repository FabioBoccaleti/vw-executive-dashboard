import { useState, useEffect, useMemo, Fragment } from 'react';
import { useAuth } from '@/contexts/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, Key, BookOpen, TableProperties, BarChart2, Search, FilePlus, X, Trash2, Pencil, Lock, LockOpen, Coins, Download, FileText, Truck, Plus } from 'lucide-react';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
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
  { key: 'numeroPedido',            label: 'Número do Pedido',             type: 'text',     width: 150 },
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
  { key: 'dataEntrega',             label: 'Data de Entrega',              type: 'date',     width: 140 },
  { key: 'nfComissao',              label: 'Nº NF de Comissão',            type: 'text',     width: 150 },
  { key: 'situacaoComissao',        label: 'Situação da Comissão',         type: 'text',     width: 160 },
  { key: 'situacaoComissaoVendedor', label: 'Sit. Comissão vendedor',      type: 'text',     width: 170 },
  { key: 'estimativaComissaoVendedor', label: 'Estimativa Comissão Vendedor', type: 'text',   width: 200 },
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
  dataVenda: string; numeroPedido: string; cliente: string; produto: string; veiculo: string;
  chassi: string; placa: string; vendedor: string; valorContrato: string;
  pctComissaoVendaOverride: string;
};
const emptyDraft = (): RegisterDraft => ({
  dataVenda: todayISO(), numeroPedido: '', cliente: '', produto: '', veiculo: '',
  chassi: '', placa: '', vendedor: '', valorContrato: '',
  pctComissaoVendaOverride: '',
});

// Produto que permite alterar o % de comissão da venda no registro (desconto)
const PRODUTO_COMISSAO_EDITAVEL = 'Sign and Drive Empresas';
// Produto em que o Número do Pedido e o Chassi não são obrigatórios.
// Comparação robusta (ignora maiúsculas/minúsculas e espaços) com o produto cadastrado.
const isEmNegociacao = (produto: string): boolean => (produto ?? '').trim().toLowerCase().startsWith('em negocia');

// ─── Zona de inserção de linha (hover entre as linhas) ─────────────────────
function InsertZoneRow({ colSpan, onInsert }: { colSpan: number; onInsert: () => void }) {
  return (
    <tr className="group/ins" style={{ height: '10px' }}>
      <td colSpan={colSpan} className="p-0 relative" style={{ height: '10px' }}>
        <div className="absolute inset-x-0 inset-y-0 flex items-center justify-center z-30 opacity-0 group-hover/ins:opacity-100 pointer-events-none group-hover/ins:pointer-events-auto transition-all duration-150">
          <div className="absolute inset-x-0 top-1/2 h-px bg-blue-400" />
          <button
            onClick={onInsert}
            className="relative z-10 flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 active:scale-95 transition-all"
          >
            <Plus className="w-3 h-3" />
            Inserir linha aqui
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Export Tabela to Excel (mesmo layout da Blindagem) ───────────────────────
async function exportTabelaExcel(exportRows: AssinaturaRow[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sorana Executive Dashboard';
  wb.created = new Date();

  const ws = wb.addWorksheet('Sign&Drive', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: 'FF2563EB' } },
  });

  ws.columns = COLUMNS.map(col => ({ width: Math.max(10, Math.round(col.width / 6.5)) }));

  // ── Row 1: título mesclado ──
  const today = new Date().toLocaleDateString('pt-BR');
  const titleRow = ws.addRow([`Vendas de Carro por Assinatura (Sign&Drive) — ${today}`]);
  ws.mergeCells(1, 1, 1, COLUMNS.length);
  titleRow.height = 30;
  titleRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 13 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1E3A8A' } }, bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } },
      left: { style: 'thin', color: { argb: 'FF1E3A8A' } }, right: { style: 'thin', color: { argb: 'FF1E3A8A' } },
    };
  });

  // ── Row 2: cabeçalho ──
  const headerRow = ws.addRow(COLUMNS.map(c => c.label));
  headerRow.height = 38;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9.5 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top:    { style: 'thin',   color: { argb: 'FF3B82F6' } },
      bottom: { style: 'medium', color: { argb: 'FF93C5FD' } },
      left:   { style: 'thin',   color: { argb: 'FF3B82F6' } },
      right:  { style: 'thin',   color: { argb: 'FF3B82F6' } },
    };
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: COLUMNS.length } };

  // ── Linhas de dados ──
  const BTHIN = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const BRL_FMT = '"R$"\\ #,##0.00';
  const PCT_FMT = '0.00"%"';

  const cellValue = (row: AssinaturaRow, col: ColDef): string | number | Date | null => {
    if (col.key === 'situacaoComissao') return row.anulada ? 'Anulada' : isEmNegociacao(row.tipoVenda) ? 'Em Negociação' : (row.nfComissao ?? '').trim() ? 'Nota Fiscal Emitida' : 'Comissão a Receber';
    const raw = (row as unknown as Record<string, string>)[col.key] ?? '';
    if (col.type === 'currency') return raw === '' ? null : (parseFloat(raw) || 0);
    if (col.type === 'percent')  return raw === '' ? null : (parseFloat(raw) || 0);
    if (col.type === 'date') {
      if (!raw) return null;
      const [d, m, y] = raw.split('/');
      return (d && m && y) ? new Date(+y, +m - 1, +d) : raw;
    }
    return raw || '';
  };

  exportRows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    const dr = ws.addRow(COLUMNS.map(col => cellValue(row, col)));
    dr.height = 17;
    dr.eachCell({ includeEmpty: true }, (cell, ci) => {
      const col = COLUMNS[ci - 1];
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { top: BTHIN, bottom: BTHIN, left: BTHIN, right: BTHIN };
      if (!col) return;
      if (col.type === 'currency') {
        cell.numFmt = BRL_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { size: 9.5, name: 'Courier New' };
      } else if (col.type === 'percent') {
        cell.numFmt = PCT_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { size: 9.5, name: 'Courier New' };
      } else if (col.type === 'date') {
        if (cell.value instanceof Date) cell.numFmt = 'DD/MM/YYYY';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { size: 9.5 };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
        cell.font = { size: 9.5 };
      }
    });
  });

  // ── Linha de total ──
  const totals = COLUMNS.map((col, i) => {
    if (i === 0) return 'TOTAL';
    if (col.type === 'currency') return exportRows.reduce((s, r) => s + (parseFloat((r as unknown as Record<string, string>)[col.key]) || 0), 0);
    return null;
  });
  const totalRow = ws.addRow(totals);
  totalRow.height = 22;
  totalRow.eachCell({ includeEmpty: true }, (cell, ci) => {
    const col = COLUMNS[ci - 1];
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.border = {
      top:    { style: 'medium', color: { argb: 'FF93C5FD' } },
      bottom: { style: 'medium', color: { argb: 'FF3B82F6' } },
      left:   { style: 'thin',   color: { argb: 'FF3B82F6' } },
      right:  { style: 'thin',   color: { argb: 'FF3B82F6' } },
    };
    if (!col) return;
    if (col.type === 'currency') {
      cell.numFmt = BRL_FMT;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.font = { bold: true, size: 10, color: { argb: 'FFBFDBFE' }, name: 'Courier New' };
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `vendas-sign-drive-${dateStr}.xlsx`,
  );
}

export function AssinaturaSignDriveDashboard({ onChangeBrand, onOpenCadastros }: AssinaturaSignDriveDashboardProps) {
  const { canAccessVendasSub, isAdmin } = useAuth();
  const canTabela  = isAdmin() || canAccessVendasSub('assinatura_signdrive.tabela');
  const canAnalise = isAdmin() || canAccessVendasSub('assinatura_signdrive.analise');
  const canCadastro = isAdmin() || canAccessVendasSub('assinatura_signdrive.cadastro');

  const [activeTab, setActiveTab] = useState<'tabela' | 'analise'>(canTabela ? 'tabela' : 'analise');
  const [viewMode, setViewMode] = useState<'todas' | 'comissoes' | 'pendente'>('todas');
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
  const [insertIndex, setInsertIndex] = useState<number | null>(null);

  // Edição inline
  type EditDraft = {
    dataVenda: string; numeroPedido: string; cliente: string; produto: string; veiculo: string;
    chassi: string; placa: string; vendedor: string; valorContrato: string;
    dataEntrega: string; nfComissao: string;
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    dataVenda: '', numeroPedido: '', cliente: '', produto: '', veiculo: '', chassi: '', placa: '', vendedor: '', valorContrato: '', dataEntrega: '', nfComissao: '',
  });

  // Edição das comissões (com senha)
  const [editComissaoId, setEditComissaoId] = useState<string | null>(null);
  const [editComissao, setEditComissao] = useState<{ comissaoEntrega: string; comissaoVenda: string }>({ comissaoEntrega: '', comissaoVenda: '' });
  const [comissaoPromptId, setComissaoPromptId] = useState<string | null>(null);
  const [comissaoPassword, setComissaoPassword] = useState('');

  // Exclusão / anulação / cadeado de edição
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePasswordPromptId, setDeletePasswordPromptId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [lockPromptId, setLockPromptId] = useState<string | null>(null);
  const [lockPassword, setLockPassword] = useState('');

  const isRowLocked = (row: AssinaturaRow) => !!((row.dataEntrega ?? '').trim() || (row.nfComissao ?? '').trim() || (row.situacaoComissaoVendedor ?? '').trim());

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
    const emNegociacao = isEmNegociacao(draft.produto);
    if (!draft.cliente.trim() || !draft.produto || !draft.veiculo || !draft.vendedor || !draft.valorContrato.trim()) {
      toast.error('Preencha Cliente, Produto, Veículo, Vendedor e Valor do Contrato.');
      return;
    }
    if (!emNegociacao && !draft.chassi.trim()) {
      toast.error('Informe o Chassi.');
      return;
    }
    if (!emNegociacao && !draft.numeroPedido.trim()) {
      toast.error('Informe o Número do Pedido.');
      return;
    }
    const valor = parseBR(draft.valorContrato);
    const newRow: AssinaturaRow = {
      id: crypto.randomUUID(),
      dataRegistro: todayBR(),
      dataVenda: isoToBR(draft.dataVenda) || todayBR(),
      numeroPedido: draft.numeroPedido.trim(),
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
      dataEntrega: '',
      nfComissao: '',
      situacaoComissao: '',
      situacaoComissaoVendedor: '',
      anulada: false,
      comissaoEditada: false,
    };
    const idx = insertIndex ?? 0;
    const updated = [...rows];
    updated.splice(idx, 0, newRow);
    await persist(updated);
    setShowRegisterModal(false);
    setDraft(emptyDraft());
    setInsertIndex(null);
    toast.success('Venda registrada');
  };

  const deleteRow = async (id: string) => {
    await persist(rows.filter(r => r.id !== id));
    setDeleteId(null);
    setDeletePasswordPromptId(null);
    setDeletePassword('');
    toast.success('Registro removido');
  };

  const anularRow = async (id: string) => {
    await persist(rows.map(r => r.id === id ? { ...r, anulada: true } : r));
    setDeleteId(null);
    toast.success('Registro anulado');
  };

  // Abre a edição — pede senha se algum dos campos de controle estiver preenchido
  const requestEdit = (row: AssinaturaRow) => {
    if (isRowLocked(row)) { setLockPromptId(row.id); setLockPassword(''); }
    else startEdit(row);
  };

  const confirmLock = (row: AssinaturaRow) => {
    if (lockPassword === '1985') { startEdit(row); setLockPromptId(null); setLockPassword(''); }
    else { toast.error('Senha incorreta'); setLockPassword(''); }
  };

  // ─ Edição das comissões (requer senha) ─
  const requestEditComissao = (row: AssinaturaRow) => { setComissaoPromptId(row.id); setComissaoPassword(''); };
  const confirmComissao = (row: AssinaturaRow) => {
    if (comissaoPassword === '1985') {
      setEditComissaoId(row.id);
      setEditComissao({ comissaoEntrega: row.comissaoEntrega, comissaoVenda: row.comissaoVenda });
      setComissaoPromptId(null); setComissaoPassword('');
    } else { toast.error('Senha incorreta'); setComissaoPassword(''); }
  };
  const saveEditComissao = async () => {
    if (!editComissaoId) return;
    const updated = rows.map(r => r.id === editComissaoId ? {
      ...r,
      comissaoEntrega: String(comissaoPreview.comissaoEntrega),
      comissaoVenda: String(comissaoPreview.comissaoVenda),
      totalComissoesBruta: String(comissaoPreview.total),
      pctRentabilidadeBruta: String(comissaoPreview.rentBruta),
      impostosComissao: String(comissaoPreview.impostos),
      totalComissaoLiquida: String(comissaoPreview.totalLiquida),
      pctRentabilidadeLiquida: String(comissaoPreview.rentLiquida),
      comissaoEditada: true,
    } : r);
    await persist(updated);
    setEditComissaoId(null);
    toast.success('Comissões atualizadas');
  };

  // Cálculos da linha em edição normal (comissões sempre pelo % do cadastro)
  const editPreview = useMemo(() => {
    const prod = tiposVenda.find(t => t.descricao === editDraft.produto);
    const valor = parseBR(editDraft.valorContrato);
    const pctVenda = prod ? parseBR(prod.pctComissaoVenda) : 0;
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
  }, [editDraft, tiposVenda]);

  // Cálculos ao editar manualmente as comissões
  const comissaoPreview = useMemo(() => {
    const row = rows.find(r => r.id === editComissaoId);
    const valor = row ? parseBR(row.valorContrato) : 0;
    const prod = row ? tiposVenda.find(t => t.descricao === row.tipoVenda) : undefined;
    const pctImpostos = prod ? parseBR(prod.pctImpostos) : 0;
    const comissaoEntrega = parseBR(editComissao.comissaoEntrega);
    const comissaoVenda = parseBR(editComissao.comissaoVenda);
    const total = comissaoEntrega + comissaoVenda;
    const rentBruta = valor > 0 ? total / valor * 100 : 0;
    const impostos = total * pctImpostos / 100;
    const totalLiquida = total - impostos;
    const rentLiquida = valor > 0 ? totalLiquida / valor * 100 : 0;
    return { comissaoEntrega, comissaoVenda, total, rentBruta, impostos, totalLiquida, rentLiquida };
  }, [editComissao, editComissaoId, rows, tiposVenda]);

  const startEdit = (row: AssinaturaRow) => {
    setEditingId(row.id);
    setEditDraft({
      dataVenda: brToISO(row.dataVenda),
      numeroPedido: row.numeroPedido ?? '',
      cliente: row.cliente,
      produto: row.tipoVenda,
      veiculo: row.veiculo,
      chassi: row.chassi,
      placa: row.placa,
      vendedor: row.vendedor,
      valorContrato: row.valorContrato,
      dataEntrega: brToISO(row.dataEntrega ?? ''),
      nfComissao: row.nfComissao ?? '',
    });
  };

  const saveEditRow = async () => {
    if (!editingId) return;
    const emNegociacao = isEmNegociacao(editDraft.produto);
    if (!editDraft.cliente.trim() || !editDraft.produto || !editDraft.veiculo || !editDraft.vendedor || !editDraft.valorContrato.trim()) {
      toast.error('Preencha Cliente, Produto, Veículo, Vendedor e Valor do Contrato.');
      return;
    }
    if (!emNegociacao && !editDraft.chassi.trim()) {
      toast.error('Informe o Chassi.');
      return;
    }
    if (!emNegociacao && !editDraft.numeroPedido.trim()) {
      toast.error('Informe o Número do Pedido.');
      return;
    }
    const valor = parseBR(editDraft.valorContrato);
    const updated = rows.map(r => r.id === editingId ? {
      ...r,
      dataVenda: isoToBR(editDraft.dataVenda) || r.dataVenda,
      numeroPedido: editDraft.numeroPedido.trim(),
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
      dataEntrega: emNegociacao ? '' : isoToBR(editDraft.dataEntrega),
      nfComissao: emNegociacao ? '' : editDraft.nfComissao.trim(),
      comissaoEditada: false,
    } : r);
    await persist(updated);
    setEditingId(null);
    toast.success('Registro atualizado');
  };

  const viewRows = useMemo(() => {
    if (viewMode === 'comissoes') return rows.filter(r => !(r.nfComissao ?? '').trim() && !r.anulada && !isEmNegociacao(r.tipoVenda));
    if (viewMode === 'pendente') return rows.filter(r => !(r.dataEntrega ?? '').trim() && !r.anulada && !isEmNegociacao(r.tipoVenda));
    return rows;
  }, [rows, viewMode]);

  const filteredRows = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v.trim() !== '');
    if (active.length === 0) return viewRows;
    return viewRows.filter(row =>
      active.every(([key, v]) => String((row as unknown as Record<string, string>)[key] ?? '').toLowerCase().includes(v.toLowerCase())),
    );
  }, [viewRows, filters]);

  const counts = useMemo(() => ({
    todas: rows.length,
    comissoes: rows.filter(r => !(r.nfComissao ?? '').trim() && !r.anulada && !isEmNegociacao(r.tipoVenda)).length,
    pendente: rows.filter(r => !(r.dataEntrega ?? '').trim() && !r.anulada && !isEmNegociacao(r.tipoVenda)).length,
  }), [rows]);

  const hasActiveFilters = Object.values(filters).some(v => v.trim() !== '');
  const canInsert = viewMode === 'todas' && !hasActiveFilters;
  const openInsert = (i: number) => { setInsertIndex(i); setDraft(emptyDraft()); setShowRegisterModal(true); };


  const fmtCell = (col: ColDef, value: string): string => {
    if (col.type === 'currency') return fmtCurrency(value);
    if (col.type === 'percent') return fmtPct(value);
    return value || '—';
  };

  const editInputClass = 'w-full min-w-0 bg-white border border-blue-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400';
  const comissaoInputClass = 'w-full min-w-0 bg-white border border-emerald-400 rounded px-1.5 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-emerald-400';

  const situacaoText = (row: AssinaturaRow, nf: string) => row.anulada ? 'Anulada' : isEmNegociacao(row.tipoVenda) ? 'Em Negociação' : nf.trim() ? 'Nota Fiscal Emitida' : 'Comissão a Receber';

  const renderCellContent = (col: ColDef, row: AssinaturaRow) => {
    const editing = editingId === row.id;
    const editingComissao = editComissaoId === row.id;
    const val = (row as unknown as Record<string, string>)[col.key] ?? '';

    // ── Modo edição das comissões ──
    if (editingComissao) {
      switch (col.key) {
        case 'comissaoEntrega':
          return <input type="text" value={editComissao.comissaoEntrega} onChange={e => setEditComissao(p => ({ ...p, comissaoEntrega: e.target.value }))} className={comissaoInputClass} />;
        case 'comissaoVenda':
          return <input type="text" value={editComissao.comissaoVenda} onChange={e => setEditComissao(p => ({ ...p, comissaoVenda: e.target.value }))} className={comissaoInputClass} />;
        case 'totalComissoesBruta':     return fmtCurrency(String(comissaoPreview.total));
        case 'pctRentabilidadeBruta':   return fmtPct(String(comissaoPreview.rentBruta));
        case 'impostosComissao':        return fmtCurrency(String(comissaoPreview.impostos));
        case 'totalComissaoLiquida':    return fmtCurrency(String(comissaoPreview.totalLiquida));
        case 'pctRentabilidadeLiquida': return fmtPct(String(comissaoPreview.rentLiquida));
        case 'situacaoComissao':        return situacaoText(row, row.nfComissao ?? '');
        default:                        return fmtCell(col, val);
      }
    }

    // ── Modo exibição ──
    if (!editing) {
      if (col.key === 'situacaoComissao') return situacaoText(row, row.nfComissao ?? '');
      if ((col.key === 'comissaoEntrega' || col.key === 'comissaoVenda') && row.comissaoEditada) {
        return (
          <span className="inline-flex items-center gap-1">
            {fmtCurrency(val)}
            <span title="Comissão editada manualmente" className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
          </span>
        );
      }
      return fmtCell(col, val);
    }

    // ── Modo edição normal (comissões são somente leitura, recalculadas pelo cadastro) ──
    switch (col.key) {
      case 'dataVenda':
        return <input type="date" value={editDraft.dataVenda} onChange={e => setEditDraft(p => ({ ...p, dataVenda: e.target.value }))} className={editInputClass} />;
      case 'numeroPedido':
        return <input type="text" value={editDraft.numeroPedido} onChange={e => setEditDraft(p => ({ ...p, numeroPedido: e.target.value }))} className={editInputClass} />;
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
      case 'comissaoEntrega':      return fmtCurrency(String(editPreview.comissaoEntrega));
      case 'comissaoVenda':        return fmtCurrency(String(editPreview.comissaoVenda));
      case 'totalComissoesBruta':  return fmtCurrency(String(editPreview.total));
      case 'pctRentabilidadeBruta': return fmtPct(String(editPreview.rentBruta));
      case 'impostosComissao':     return fmtCurrency(String(editPreview.impostos));
      case 'totalComissaoLiquida': return fmtCurrency(String(editPreview.totalLiquida));
      case 'pctRentabilidadeLiquida': return fmtPct(String(editPreview.rentLiquida));
      case 'dataEntrega':
        return isEmNegociacao(editDraft.produto)
          ? <input type="text" value="—" disabled className={`${editInputClass} bg-slate-100 text-slate-400 text-center cursor-not-allowed`} />
          : <input type="date" value={editDraft.dataEntrega} onChange={e => setEditDraft(p => ({ ...p, dataEntrega: e.target.value }))} className={editInputClass} />;
      case 'nfComissao':
        return isEmNegociacao(editDraft.produto)
          ? <input type="text" value="—" disabled className={`${editInputClass} bg-slate-100 text-slate-400 text-center cursor-not-allowed`} />
          : <input type="text" value={editDraft.nfComissao} onChange={e => setEditDraft(p => ({ ...p, nfComissao: e.target.value }))} className={editInputClass} />;
      case 'situacaoComissao':
        return isEmNegociacao(editDraft.produto) ? 'Em Negociação' : editDraft.nfComissao.trim() ? 'Nota Fiscal Emitida' : 'Comissão a Receber';
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
                <col style={{ width: 150, minWidth: 150 }} /> {/* Ações */}
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
                      {viewMode === 'comissoes' ? 'Nenhuma venda com comissão a receber' : viewMode === 'pendente' ? 'Nenhuma venda pendente de entrega' : 'Nenhum registro cadastrado'}
                    </td>
                  </tr>
                )}
                {filteredRows.length > 0 && canInsert && (
                  <InsertZoneRow colSpan={COLUMNS.length + 2} onInsert={() => openInsert(0)} />
                )}
                {filteredRows.map((row, idx) => {
                  const editing = editingId === row.id;
                  const editingComissao = editComissaoId === row.id;
                  const isComissaoPrompt = comissaoPromptId === row.id;
                  const isDelete = deleteId === row.id;
                  const isLocking = lockPromptId === row.id;
                  const isEven = idx % 2 === 0;
                  const rowBg = editing ? '#eff6ff' : editingComissao ? '#ecfdf5' : isComissaoPrompt ? '#ecfdf5' : isLocking ? '#fffbeb' : isDelete ? '#fef2f2' : row.anulada ? '#f1f5f9' : isEven ? '#ffffff' : '#f8fafc';
                  const nf = editing ? editDraft.nfComissao : (row.nfComissao ?? '');
                  const produtoAtual = editing ? editDraft.produto : row.tipoVenda;
                  return (
                    <Fragment key={row.id}>
                    <tr style={{ background: rowBg }} className="transition-colors">
                      <td className="sticky left-0 z-20 text-center border-r border-slate-200 px-1 py-1" style={{ background: rowBg }}>
                        <span className="text-xs text-slate-400 font-mono">{idx + 1}</span>
                      </td>
                      {COLUMNS.map((col, ci) => {
                        const isRight = col.type === 'currency' || col.type === 'percent';
                        const isSituacao = col.key === 'situacaoComissao';
                        const situacaoColor = row.anulada ? 'text-slate-500' : isEmNegociacao(produtoAtual) ? 'text-blue-600' : nf.trim() ? 'text-emerald-600' : 'text-amber-600';
                        return (
                          <td key={`c-${col.key}-${ci}`} className={`px-3 py-1.5 text-xs border-r border-slate-100 whitespace-nowrap ${isRight && !editing ? 'text-right' : ''} ${isSituacao ? 'font-semibold ' + situacaoColor : row.anulada && !editing ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                            {renderCellContent(col, row)}
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-20 text-center border-l border-slate-200 px-1 py-1" style={{ background: rowBg }}>
                        {editing ? (
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <button onClick={saveEditRow} disabled={saving} className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 font-semibold transition-colors">Salvar</button>
                            <button onClick={() => setEditingId(null)} className="px-2.5 py-1 bg-slate-200 text-slate-600 text-xs rounded-md hover:bg-slate-300 font-semibold transition-colors">Cancelar</button>
                          </div>
                        ) : editingComissao ? (
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <button onClick={saveEditComissao} disabled={saving} className="px-2.5 py-1 bg-emerald-600 text-white text-xs rounded-md hover:bg-emerald-700 font-semibold transition-colors">Salvar</button>
                            <button onClick={() => setEditComissaoId(null)} className="px-2.5 py-1 bg-slate-200 text-slate-600 text-xs rounded-md hover:bg-slate-300 font-semibold transition-colors">Cancelar</button>
                          </div>
                        ) : isComissaoPrompt ? (
                          <div className="flex flex-col items-center gap-1.5 py-0.5">
                            <p className="text-xs text-emerald-700 font-semibold text-center leading-tight"><Coins className="w-3 h-3 inline-block mb-0.5" /> Senha</p>
                            <input
                              type="password"
                              autoComplete="new-password"
                              value={comissaoPassword}
                              onChange={e => setComissaoPassword(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') confirmComissao(row); if (e.key === 'Escape') { setComissaoPromptId(null); setComissaoPassword(''); } }}
                              placeholder="Senha"
                              autoFocus
                              className="w-full border border-emerald-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                            <div className="flex gap-1">
                              <button onClick={() => confirmComissao(row)} className="px-2 py-0.5 bg-emerald-600 text-white text-xs rounded-md hover:bg-emerald-700 font-semibold transition-colors">OK</button>
                              <button onClick={() => { setComissaoPromptId(null); setComissaoPassword(''); }} className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-md hover:bg-slate-300 font-semibold transition-colors">Cancelar</button>
                            </div>
                          </div>
                        ) : isLocking ? (
                          <div className="flex flex-col items-center gap-1.5 py-0.5">
                            <p className="text-xs text-amber-700 font-semibold text-center leading-tight"><LockOpen className="w-3 h-3 inline-block mb-0.5" /> Senha</p>
                            <input
                              type="password"
                              autoComplete="new-password"
                              value={lockPassword}
                              onChange={e => setLockPassword(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') confirmLock(row); if (e.key === 'Escape') { setLockPromptId(null); setLockPassword(''); } }}
                              placeholder="Senha"
                              autoFocus
                              className="w-full border border-amber-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                            <div className="flex gap-1">
                              <button onClick={() => confirmLock(row)} className="px-2 py-0.5 bg-amber-600 text-white text-xs rounded-md hover:bg-amber-700 font-semibold transition-colors">OK</button>
                              <button onClick={() => { setLockPromptId(null); setLockPassword(''); }} className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-md hover:bg-slate-300 font-semibold transition-colors">Cancelar</button>
                            </div>
                          </div>
                        ) : isDelete ? (
                          <div className="flex flex-col items-center gap-1.5 py-0.5">
                            <p className="text-xs text-red-600 font-semibold text-center leading-tight">Remover este<br />registro?</p>
                            <div className="flex gap-1 flex-wrap justify-center">
                              <button onClick={() => { setDeletePasswordPromptId(row.id); setDeletePassword(''); setDeleteId(null); }} className="px-2.5 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 font-semibold transition-colors">Excluir</button>
                              {!isRowLocked(row) && !row.anulada && (
                                <button onClick={() => anularRow(row.id)} className="px-2.5 py-1 bg-orange-500 text-white text-xs rounded-md hover:bg-orange-600 font-semibold transition-colors">Anular</button>
                              )}
                              <button onClick={() => setDeleteId(null)} className="px-2.5 py-1 bg-slate-200 text-slate-600 text-xs rounded-md hover:bg-slate-300 font-semibold transition-colors">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-0.5">
                            {!row.anulada && (
                              isRowLocked(row) ? (
                                <button onClick={() => { setLockPromptId(row.id); setLockPassword(''); }} title="Editar (requer senha)" className="p-1.5 rounded-md text-amber-600 hover:bg-amber-50 transition-colors"><Lock className="w-3.5 h-3.5" /></button>
                              ) : (
                                <button onClick={() => requestEdit(row)} title="Editar" className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                              )
                            )}
                            {!row.anulada && (
                              <button onClick={() => requestEditComissao(row)} title="Editar comissões (requer senha)" className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"><Coins className="w-3.5 h-3.5" /></button>
                            )}
                            <button onClick={() => { setEditingId(null); setDeleteId(row.id); }} title="Excluir linha" className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {canInsert && (
                      <InsertZoneRow colSpan={COLUMNS.length + 2} onInsert={() => openInsert(idx + 1)} />
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Footer ── */}
          <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => { setInsertIndex(null); setDraft(emptyDraft()); setShowRegisterModal(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              <FilePlus className="w-4 h-4" />
              Registrar Venda
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportTabelaExcel(filteredRows)}
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1.5 font-medium"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </Button>
            <div className="inline-flex bg-slate-200 rounded-lg p-0.5 gap-0.5">
              {([
                { v: 'todas' as const, label: 'Todas', icon: null, count: counts.todas },
                { v: 'comissoes' as const, label: 'Comissões a Receber', icon: <FileText className="w-3.5 h-3.5" />, count: counts.comissoes },
                { v: 'pendente' as const, label: 'Pendente de Entrega', icon: <Truck className="w-3.5 h-3.5" />, count: counts.pendente },
              ]).map(opt => {
                const active = viewMode === opt.v;
                return (
                  <button
                    key={opt.v}
                    onClick={() => setViewMode(opt.v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-300'}`}
                  >
                    {opt.icon}
                    {opt.label}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${active ? 'bg-white/25 text-white' : 'bg-slate-300 text-slate-600'}`}>{opt.count}</span>
                  </button>
                );
              })}
            </div>
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
              <button onClick={() => { setShowRegisterModal(false); setDraft(emptyDraft()); setInsertIndex(null); }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
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
                <label className="text-xs font-semibold text-slate-600">Número do Pedido {!isEmNegociacao(draft.produto) && <span className="text-red-500">*</span>}</label>
                <input type="text" value={draft.numeroPedido} onChange={e => setDraft(p => ({ ...p, numeroPedido: e.target.value }))} placeholder="Ex: 123456" className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
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
                <label className="text-xs font-semibold text-slate-600">Chassi {!isEmNegociacao(draft.produto) && <span className="text-red-500">*</span>}</label>
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
              <Button variant="outline" size="sm" onClick={() => { setShowRegisterModal(false); setDraft(emptyDraft()); setInsertIndex(null); }} className="border-slate-300 text-slate-600">Cancelar</Button>
              <Button size="sm" onClick={registerVenda} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                <FilePlus className="w-4 h-4" />
                Registrar Venda
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal senha exclusão ── */}
      {deletePasswordPromptId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 rounded-xl flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Excluir registro</h3>
                <p className="text-sm text-slate-500 mt-1">Digite a senha para excluir permanentemente este registro.</p>
              </div>
            </div>
            <input
              type="password"
              autoComplete="new-password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (deletePassword === '1985') deleteRow(deletePasswordPromptId!);
                  else { toast.error('Senha incorreta'); setDeletePassword(''); }
                }
                if (e.key === 'Escape') { setDeletePasswordPromptId(null); setDeletePassword(''); }
              }}
              placeholder="Senha"
              autoFocus
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setDeletePasswordPromptId(null); setDeletePassword(''); }} className="border-slate-300 text-slate-600">Cancelar</Button>
              <Button size="sm" onClick={() => {
                if (deletePassword === '1985') deleteRow(deletePasswordPromptId!);
                else { toast.error('Senha incorreta'); setDeletePassword(''); }
              }} className="bg-red-600 hover:bg-red-700 text-white">Excluir</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
