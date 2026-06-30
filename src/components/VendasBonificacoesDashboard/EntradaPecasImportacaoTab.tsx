import { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, X, ChevronDown, AlertCircle, FileDown, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  type EntradaPecasItemLite,
  loadEntradaPecasItens,
  saveEntradaPecasPeriod,
  parseEntradaPecasTXT,
  clearEntradaPecasByPeriod,
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
  const [itens, setItens]         = useState<EntradaPecasItemLite[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef                   = useRef<HTMLInputElement>(null);
  const pendingPeriod             = useRef<{ mes: number; ano: number } | null>(null);

  // ─── Carrega dados ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (filterMonth === null) { setItens([]); setLoading(false); return; }
    setLoading(true);
    loadEntradaPecasItens(filterMonth, filterYear).then(data => {
      setItens(data);
      setLoading(false);
    });
  }, [filterYear, filterMonth]);

  // ─── Filtra por período ─────────────────────────────────────────────────────
  const filtered = itens;

  // ─── Totais ─────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const nfs = new Set(itens.map(r => r.nf));
    return {
      nfs:   nfs.size,
      itens: itens.length,
      custo: itens.reduce((s, r) => s + r.custo, 0),
    };
  }, [itens]);

  // ─── Export Excel ─────────────────────────────────────────────────────────
  function handleExportExcel() {
    const data = itens.map(row => ({
      'NF':               row.nf,
      'Fornecedor':       row.forn,
      'Tipo Trans.':      row.tipo,
      'Cód. Peça':        row.cod,
      'NCM':              row.ncm,
      'Descrição':        row.desc,
      'Qtde':             row.qtde,
      'Vl. Unit. (R$)':   row.unit,
      'Custo Médio (R$)': row.custo,
      'Liq. NF (R$)':     row.liqNF,
      'Mês':              row.mes,
      'Ano':              row.ano,
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
      const { itens: parsed, resumo } = parseEntradaPecasTXT(text, mes, ano);

      if (parsed.length === 0) {
        toast.warning('Nenhum item encontrado no arquivo TXT.');
        return;
      }

      await saveEntradaPecasPeriod(mes, ano, parsed, resumo);

      if (filterMonth === mes && filterYear === ano) {
        setItens(parsed);
      }

      toast.success(`${parsed.length} itens importados para ${MONTH_NAMES[mes - 1]}/${ano}.`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar o arquivo TXT.');
    } finally {
      setImporting(false);
    }
  }

  // ─── Limpar mês ──────────────────────────────────────────────────────────────
  async function handleClearMonth() {
    if (filterMonth === null) return;
    const label = `${MONTH_NAMES[filterMonth - 1]}/${filterYear}`;
    const confirmed = window.confirm(`Deseja apagar todos os itens importados de ${label}? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;
    await clearEntradaPecasByPeriod(filterMonth, filterYear);
    setItens([]);
    toast.success(`Dados de ${label} removidos com sucesso.`);
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

        <Button
          onClick={handleClearMonth}
          disabled={filterMonth === null || importing}
          variant="outline"
          className="ml-auto text-xs h-8 px-4 gap-1.5 border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          title={filterMonth === null ? 'Selecione um mês específico para limpar' : `Apagar dados de ${periodLabel}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Limpar Mês
        </Button>
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
          <table className="text-xs border-collapse" style={{ minWidth: '900px', width: '100%' }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">NF</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200 min-w-[200px]">Fornecedor</th>
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap border-b border-slate-200">Tipo Trans.</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">Cód. Peça</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200">NCM</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200 min-w-[160px]">Descrição</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Qtde</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Vl. Unit. (R$)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Custo Médio (R$)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-b border-slate-200">Liq. NF (R$)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr
                  key={`${row.nf}-${row.cod}-${i}`}
                  className={`border-b border-slate-100 hover:bg-violet-50/30 transition-colors ${
                    i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <td className="px-3 py-1.5 font-mono text-slate-700 whitespace-nowrap">{row.nf}</td>
                  <td className="px-3 py-1.5 text-slate-700 max-w-[220px] truncate" title={row.forn}>{row.forn}</td>
                  <td className="px-3 py-1.5 text-center whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      row.tipo === 'P27' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>{row.tipo || '—'}</span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-slate-600 whitespace-nowrap">{row.cod}</td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{row.ncm}</td>
                  <td className="px-3 py-1.5 text-slate-700 max-w-[200px] truncate" title={row.desc}>{row.desc}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600 whitespace-nowrap">{row.qtde}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600 whitespace-nowrap">{fmt(row.unit)}</td>
                  <td className="px-3 py-1.5 text-right font-medium text-slate-700 whitespace-nowrap">{fmt(row.custo)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600 whitespace-nowrap">{fmt(row.liqNF)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Rodapé de totais */}
          <div className="sticky bottom-0 bg-white border-t-2 border-slate-200 px-6 py-2.5 flex items-center gap-6 text-xs shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
            <span><strong className="text-slate-700">{totals.nfs}</strong> <span className="text-slate-400">NFs</span></span>
            <span className="w-px h-4 bg-slate-200" />
            <span><strong className="text-slate-700">{totals.itens}</strong> <span className="text-slate-400">itens</span></span>
            <span className="w-px h-4 bg-slate-200" />
            <span className="text-slate-400">Total Custo Médio: <strong className="text-slate-800">{fmtBRL(totals.custo)}</strong></span>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
