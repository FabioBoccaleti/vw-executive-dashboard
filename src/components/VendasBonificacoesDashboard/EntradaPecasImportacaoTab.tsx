import { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, X, ChevronDown, AlertCircle, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  type EntradaPecasRow,
  loadEntradaPecasRows,
  mergeEntradaPecasByPeriod,
  parseEntradaPecasTXT,
} from './entradaPecasStorage';

interface Props {
  filterYear: number;
  filterMonth: number | null;
}

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTH_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Modal de seleção de período ─────────────────────────────────────────────
interface PeriodModalProps {
  onConfirm: (mes: number, ano: number) => void;
  onCancel: () => void;
}
function PeriodModal({ onConfirm, onCancel }: PeriodModalProps) {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-violet-100">
            <Upload className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Importar TXT — Período?</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Os registros serão classificados no mês/ano informado.
            </p>
          </div>
          <button onClick={onCancel} className="ml-auto text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Seletores */}
        <div className="flex gap-4">
          {/* Mês */}
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MÊS</label>
            <div className="relative">
              <select
                value={mes}
                onChange={e => setMes(Number(e.target.value))}
                className="w-full appearance-none text-sm font-medium text-slate-700 border border-slate-200 rounded-lg pl-3 pr-7 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
              >
                {MONTH_FULL.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>{name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
          {/* Ano */}
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ANO</label>
            <div className="relative">
              <select
                value={ano}
                onChange={e => setAno(Number(e.target.value))}
                className="w-full appearance-none text-sm font-medium text-slate-700 border border-slate-200 rounded-lg pl-3 pr-7 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3 pt-1">
          <Button
            variant="outline"
            className="flex-1 text-sm"
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 text-sm bg-violet-600 hover:bg-violet-700"
            onClick={() => onConfirm(mes, ano)}
          >
            Confirmar e selecionar arquivo
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function EntradaPecasImportacaoTab({ filterYear, filterMonth }: Props) {
  const [rows, setRows]           = useState<EntradaPecasRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef                   = useRef<HTMLInputElement>(null);
  const pendingPeriod             = useRef<{ mes: number; ano: number } | null>(null);

  // ─── Carrega dados ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    loadEntradaPecasRows().then(all => {
      setRows(all);
      setLoading(false);
    });
  }, []);

  // ─── Filtra por período ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (r.ano !== filterYear) return false;
      if (filterMonth !== null && r.mes !== filterMonth) return false;
      return true;
    });
  }, [rows, filterYear, filterMonth]);

  // ─── Totais ─────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const nfs = new Set(filtered.map(r => `${r.numeroNF}-${r.serieNF}`));
    return {
      nfs:        nfs.size,
      itens:      filtered.length,
      mercadoria: filtered.reduce((s, r) => s + r.valTotalItem, 0),
      icmsST:     filtered.reduce((s, r) => s + r.valIcmsRetidoItem, 0),
      ipi:        filtered.reduce((s, r) => s + r.valIpiItem, 0),
      desconto:   filtered.reduce((s, r) => s + r.valDescontoItem, 0),
    };
  }, [filtered]);

  // ─── Export Excel ─────────────────────────────────────────────────────────
  function handleExportExcel() {
    const data = filtered.map(row => ({
      'NF':                row.numeroNF,
      'Série':             row.serieNF,
      'Tipo Trans.':       row.tipoTransacao,
      'Chave NFe':         row.nfeChaveAcesso,
      'Data Entrada':      row.dtaEntrada,
      'Data Documento':    row.dtaDocumento,
      'Modalidade':        row.modalidade,
      'Departamento':      row.nomeDepartamento,
      'Usuário':           row.nomeUsuario,
      'Fonte':             row.nomeFonte,
      'Fornecedor':        row.nomeCliente,
      'CNPJ':              row.cgccpf,
      'Cidade':            row.cidade,
      'UF':                row.estado,
      'Status':            row.status,
      'Categoria Fornec.': row.nomeCategoriaCliente,
      'Cód. Peça':         row.codItem,
      'NCM':               row.ncm,
      'Descrição':         row.descricao,
      'Qtde':              row.qtde,
      'Vl. Unit. (R$)':    row.valUnitario,
      'Custo Médio (R$)':  row.custoMedio,
      'Vl. Total (R$)':    row.valTotalItem,
      'Liq. Item (R$)':    row.liqTotalItem ?? 0,
      'Desconto (R$)':     row.valDescontoItem,
      'Base ICMS (R$)':    row.baseIcms ?? 0,
      'Alíq. ICMS (%)':   row.aliquotaIcms ?? 0,
      'ICMS (R$)':         row.valIcmsItem,
      'ICMS-ST (R$)':      row.valIcmsRetidoItem,
      'ICMS Total (R$)':   row.valIcmsAuxItem,
      'IPI (R$)':          row.valIpiItem,
      'PIS (R$)':          row.valPisItem,
      'COFINS (R$)':       row.valCofinsItem,
      'Frete NF (R$)':     row.valFrete,
      'Liq. NF (R$)':      row.liqNotaFiscal,
      'CFOP':              row.cfop,
      'Operação CFOP':     row.cfopOperacao,
      'Mês':               row.mes,
      'Ano':               row.ano,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Entrada de Peças');

    const monthName = filterMonth !== null ? MONTH_NAMES[filterMonth - 1] : 'Todos';
    XLSX.writeFile(wb, `EntradaPecas_${monthName}_${filterYear}.xlsx`);
  }

  // ─── Import: modal → arquivo ────────────────────────────────────────────────
  function handleImportClick() {
    setShowModal(true);
  }

  function handleModalConfirm(mes: number, ano: number) {
    setShowModal(false);
    pendingPeriod.current = { mes, ano };
    fileRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingPeriod.current) return;
    if (fileRef.current) fileRef.current.value = '';

    const { mes, ano } = pendingPeriod.current;
    pendingPeriod.current = null;

    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseEntradaPecasTXT(text, mes, ano);

      if (parsed.length === 0) {
        toast.warning('Nenhum item encontrado no arquivo TXT.');
        return;
      }

      const { added, replaced } = await mergeEntradaPecasByPeriod(parsed);
      const allRows = await loadEntradaPecasRows();
      setRows(allRows);

      toast.success(
        replaced > 0
          ? `${added} itens importados — ${replaced} itens anteriores de ${MONTH_NAMES[mes - 1]}/${ano} substituídos.`
          : `${added} itens importados para ${MONTH_NAMES[mes - 1]}/${ano}.`,
      );
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar o arquivo TXT.');
    } finally {
      setImporting(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  const periodLabel = filterMonth !== null
    ? `${MONTH_NAMES[filterMonth - 1]}/${filterYear}`
    : `${filterYear}`;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {showModal && (
        <PeriodModal
          onConfirm={handleModalConfirm}
          onCancel={() => setShowModal(false)}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".txt"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <Button
          onClick={handleImportClick}
          disabled={importing}
          className="bg-violet-600 hover:bg-violet-700 text-white text-xs h-8 px-4 gap-1.5"
        >
          <Upload className="w-3.5 h-3.5" />
          {importing ? 'Importando...' : 'Importar TXT'}
        </Button>

        {filtered.length > 0 && (
          <>
            <Button
              onClick={handleExportExcel}
              variant="outline"
              className="text-xs h-8 px-4 gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <FileDown className="w-3.5 h-3.5" />
              Exportar Excel
            </Button>
            <span className="text-xs text-slate-500">
              {totals.itens} {totals.itens === 1 ? 'item' : 'itens'} em{' '}
              {totals.nfs} {totals.nfs === 1 ? 'NF' : 'NFs'} — {periodLabel}
            </span>
          </>
        )}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-600">Nenhum registro para {periodLabel}</p>
            <p className="text-xs text-slate-400">Importe um arquivo TXT para visualizar os dados.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative" style={{ minHeight: 0 }}>
          <div className="absolute inset-0 overflow-auto">
          {/* Tabela */}
          <table className="min-w-max text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 text-slate-600">
                {/* Identificação NF */}
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">NF</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">Série</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">Tipo Trans.</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200 min-w-[140px]">Chave NFe</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">Data Entrada</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">Data Documento</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">Modalidade</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">Departamento</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">Usuário</th>
                {/* Fornecedor */}
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">Fonte</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200 min-w-[200px]">Fornecedor</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">CNPJ</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">Cidade</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">UF</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">Status</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">Categoria Fornec.</th>
                {/* Item */}
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">Cód. Peça</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">NCM</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200 min-w-[140px]">Descrição</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Qtde</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Vl. Unit. (R$)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Custo Médio (R$)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Vl. Total (R$)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Liq. Item (R$)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Desconto (R$)</th>
                {/* Fiscal */}
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Base ICMS (R$)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Alíq. ICMS (%)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">ICMS (R$)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">ICMS-ST (R$)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">ICMS Total (R$)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">IPI (R$)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">PIS (R$)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">COFINS (R$)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Frete NF (R$)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Liq. NF (R$)</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">CFOP</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200 min-w-[180px]">Operação CFOP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr
                  key={row.id}
                  className={`border-b border-slate-100 hover:bg-violet-50/40 transition-colors ${
                    i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  {/* Identificação NF */}
                  <td className="px-3 py-1.5 font-medium text-slate-800 whitespace-nowrap">{row.numeroNF}</td>
                  <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{row.serieNF}</td>
                  <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap font-mono">{row.tipoTransacao || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-400 font-mono text-[10px] whitespace-nowrap max-w-[140px] truncate" title={row.nfeChaveAcesso}>{row.nfeChaveAcesso || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{row.dtaEntrada}</td>
                  <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{row.dtaDocumento}</td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{row.modalidade || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{row.nomeDepartamento || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{row.nomeUsuario || '—'}</td>
                  {/* Fornecedor */}
                  <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap max-w-[120px] truncate" title={row.nomeFonte}>{row.nomeFonte}</td>
                  <td className="px-3 py-1.5 text-slate-700 max-w-[200px] truncate" title={row.nomeCliente}>{row.nomeCliente}</td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{row.cgccpf}</td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{row.cidade}</td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{row.estado}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      row.status === 'FECHADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>{row.status || '—'}</span>
                  </td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap max-w-[120px] truncate" title={row.nomeCategoriaCliente}>{row.nomeCategoriaCliente || '—'}</td>
                  {/* Item */}
                  <td className="px-3 py-1.5 font-mono text-slate-700 whitespace-nowrap">{row.codItem}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-600 whitespace-nowrap">{row.ncm || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-700 max-w-[160px] truncate" title={row.descricao}>{row.descricao}</td>
                  <td className="px-3 py-1.5 text-right text-slate-700 whitespace-nowrap">{fmt(row.qtde)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-700 whitespace-nowrap">{fmt(row.valUnitario)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-500 whitespace-nowrap">{fmt(row.custoMedio)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-slate-800 whitespace-nowrap">{fmt(row.valTotalItem)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-700 whitespace-nowrap">{fmt(row.liqTotalItem ?? 0)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-500 whitespace-nowrap">
                    {row.valDescontoItem > 0 ? fmt(row.valDescontoItem) : '—'}
                  </td>
                  {/* Fiscal */}
                  <td className="px-3 py-1.5 text-right text-slate-600 whitespace-nowrap">
                    {row.baseIcms > 0 ? fmt(row.baseIcms) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-600 whitespace-nowrap">
                    {row.aliquotaIcms > 0 ? `${fmt(row.aliquotaIcms)}%` : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-600 whitespace-nowrap">
                    {row.valIcmsItem > 0 ? fmt(row.valIcmsItem) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-amber-700 whitespace-nowrap">
                    {row.valIcmsRetidoItem > 0 ? fmt(row.valIcmsRetidoItem) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-amber-800 font-medium whitespace-nowrap">
                    {row.valIcmsAuxItem > 0 ? fmt(row.valIcmsAuxItem) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-blue-700 whitespace-nowrap">
                    {row.valIpiItem > 0 ? fmt(row.valIpiItem) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-500 whitespace-nowrap">
                    {row.valPisItem > 0 ? fmt(row.valPisItem) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-500 whitespace-nowrap">
                    {row.valCofinsItem > 0 ? fmt(row.valCofinsItem) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-500 whitespace-nowrap">
                    {row.valFrete > 0 ? fmt(row.valFrete) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-600 whitespace-nowrap">
                    {row.liqNotaFiscal > 0 ? fmt(row.liqNotaFiscal) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{row.cfop}</td>
                  <td className="px-3 py-1.5 text-slate-500 max-w-[200px] truncate" title={row.cfopOperacao}>{row.cfopOperacao}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Rodapé de totais */}
          <div className="sticky bottom-0 bg-white border-t-2 border-slate-200 px-6 py-3 flex items-center gap-6 text-xs flex-wrap shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">NFs:</span>
              <span className="font-bold text-slate-700">{totals.nfs}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Itens:</span>
              <span className="font-bold text-slate-700">{totals.itens}</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Total Mercadoria:</span>
              <span className="font-bold text-slate-800">{fmtBRL(totals.mercadoria)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Desconto:</span>
              <span className="font-bold text-slate-600">{fmtBRL(totals.desconto)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">ICMS-ST:</span>
              <span className="font-bold text-amber-700">{fmtBRL(totals.icmsST)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">IPI:</span>
              <span className="font-bold text-blue-700">{fmtBRL(totals.ipi)}</span>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
