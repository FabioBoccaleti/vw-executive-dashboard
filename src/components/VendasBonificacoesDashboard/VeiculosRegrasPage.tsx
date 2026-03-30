import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Pencil, Trash2, Check, X, AlertTriangle, Copy, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  type MarcaVeiculo,
  type VeiculoModelo,
  type VeiculoRegra,
  INDICADOR_FIELDS,
  loadModelos,
  saveModelos,
  loadRegras,
  saveRegras,
  getRegra,
  createEmptyRegra,
} from './veiculosRegrasStorage';
import { loadRegistroRows } from './registroVendasStorage';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtCurrency(val: string): string {
  const n = parseFloat(String(val).replace(/[^\d.,\-]/g, '').replace(',', '.'));
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPercent(val: string): string {
  if (!val || val.trim() === '') return '—';
  const n = parseFloat(String(val).replace(',', '.'));
  if (isNaN(n)) return val;
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

const EMPTY_MODELO: Omit<VeiculoModelo, 'id'> = { marca: 'VW', modelo: '', ativo: true };

type ModeloExibir = VeiculoModelo & { fromSales?: boolean };

export function VeiculosRegrasPage() {
  const [subTab, setSubTab] = useState<'modelos' | 'regras'>('modelos');
  const [loading, setLoading] = useState(true);

  // ─── Modelos ─────────────────────────────────────────────────────────────
  const [modelos, setModelos] = useState<VeiculoModelo[]>([]);
  const [newModelo, setNewModelo] = useState<Omit<VeiculoModelo, 'id'>>({ ...EMPTY_MODELO });
  const [editingModeloId, setEditingModeloId]   = useState<string | null>(null);
  const [editModeloValues, setEditModeloValues] = useState<VeiculoModelo | null>(null);
  const [confirmDeleteModeloId, setConfirmDeleteModeloId] = useState<string | null>(null);

  // ─── Regras ──────────────────────────────────────────────────────────────
  const [regras, setRegras]         = useState<VeiculoRegra[]>([]);
  const [filterBrand, setFilterBrand]   = useState<MarcaVeiculo>('VW');
  const [filterYear, setFilterYear]     = useState<number>(new Date().getFullYear());
  const [filterMonth, setFilterMonth]   = useState<number>(new Date().getMonth() + 1);
  const [editingRegraModeloId, setEditingRegraModeloId] = useState<string | null>(null);
  const [editRegraValues, setEditRegraValues]           = useState<VeiculoRegra | null>(null);
  const [confirmCopyPrev, setConfirmCopyPrev] = useState(false);
  const [novosSales, setNovosSales] = useState<Array<{ modelo: string; dtaVenda: string; periodoImport?: string }>>([]);

  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadModelos(), loadRegras()]).then(([m, r]) => {
      setModelos(m);
      setRegras(r);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (filterBrand === 'VW') {
      loadRegistroRows('novos').then(rows =>
        setNovosSales(rows.map(r => ({ modelo: r.modelo, dtaVenda: r.dtaVenda, periodoImport: r.periodoImport })))
      );
    } else {
      setNovosSales([]);
    }
  }, [filterBrand]);

  // ─── Anos disponíveis ──────────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    regras.forEach(r => years.add(r.ano));
    const cur = new Date().getFullYear();
    [cur - 1, cur, cur + 1].forEach(y => years.add(y));
    return Array.from(years).sort((a, b) => b - a);
  }, [regras]);

  // ─── Modelos filtrados pela marca selecionada ──────────────────────────────
  const modelosFiltrados = useMemo(
    () => modelos.filter(m => m.marca === filterBrand && m.ativo).sort((a, b) => a.modelo.localeCompare(b.modelo)),
    [modelos, filterBrand],
  );

  // ─── Indicadores visíveis para a marca selecionada ───────────────────────────
  const indicadoresFiltrados = useMemo(
    () => INDICADOR_FIELDS.filter(f => f.marcas.includes(filterBrand)),
    [filterBrand],
  );

  // ─── Helpers: período de uma linha de venda ───────────────────────────────
  function rowPeriodo(dtaVenda: string, periodoImport?: string): string | null {
    if (periodoImport) return periodoImport;
    if (!dtaVenda) return null;
    const m1 = dtaVenda.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m1) return `${m1[3]}-${m1[2]}`;
    const m2 = dtaVenda.match(/^(\d{4})-(\d{2})/);
    if (m2) return `${m2[1]}-${m2[2]}`;
    return null;
  }

  // ─── Modelos das vendas do mês selecionado (apenas VW Novos) ─────────────
  const modelosFromSales = useMemo((): string[] => {
    if (filterBrand !== 'VW') return [];
    const target = `${filterYear}-${String(filterMonth).padStart(2, '0')}`;
    const names = new Set<string>();
    novosSales.forEach(r => {
      if (rowPeriodo(r.dtaVenda, r.periodoImport) === target) {
        const nome = r.modelo?.trim();
        if (nome) names.add(nome);
      }
    });
    return Array.from(names).sort();
  }, [novosSales, filterYear, filterMonth, filterBrand]);

  // ─── Modelos para exibir na grade (cadastrados + novos das vendas) ────────
  const modelosParaExibir = useMemo((): ModeloExibir[] => {
    const knownNames = new Set(modelosFiltrados.map(m => m.modelo.trim().toLowerCase()));
    const extras: ModeloExibir[] = modelosFromSales
      .filter(nome => !knownNames.has(nome.toLowerCase()))
      .map(nome => ({ id: `__sales__${nome}`, marca: 'VW' as MarcaVeiculo, modelo: nome, ativo: true, fromSales: true }));
    return [...modelosFiltrados, ...extras].sort((a, b) => a.modelo.localeCompare(b.modelo));
  }, [modelosFiltrados, modelosFromSales]);

  // ─── Handlers: Modelos ─────────────────────────────────────────────────────
  async function handleAddModelo() {
    if (!newModelo.modelo.trim()) { toast.warning('Informe o nome do modelo.'); return; }
    const created: VeiculoModelo = { ...newModelo, id: crypto.randomUUID(), modelo: newModelo.modelo.trim() };
    const updated = [...modelos, created];
    setModelos(updated);
    await saveModelos(updated);
    setNewModelo({ ...EMPTY_MODELO });
    toast.success('Modelo cadastrado.');
  }

  async function handleSaveModelo() {
    if (!editModeloValues) return;
    const updated = modelos.map(m => m.id === editModeloValues.id ? editModeloValues : m);
    setModelos(updated);
    await saveModelos(updated);
    setEditingModeloId(null);
    toast.success('Modelo salvo.');
  }

  async function handleDeleteModelo() {
    if (!confirmDeleteModeloId) return;
    const updated = modelos.filter(m => m.id !== confirmDeleteModeloId);
    const updatedRegras = regras.filter(r => r.modeloId !== confirmDeleteModeloId);
    setModelos(updated);
    setRegras(updatedRegras);
    await Promise.all([saveModelos(updated), saveRegras(updatedRegras)]);
    setConfirmDeleteModeloId(null);
    toast.success('Modelo excluído.');
  }

  // ─── Handlers: Regras ─────────────────────────────────────────────────────
  async function handleEditRegra(m: ModeloExibir) {
    let modeloId = m.id;
    if (m.fromSales) {
      const created: VeiculoModelo = { id: crypto.randomUUID(), marca: 'VW', modelo: m.modelo, ativo: true };
      const updated = [...modelos, created];
      setModelos(updated);
      await saveModelos(updated);
      modeloId = created.id;
      toast.success(`"${created.modelo}" adicionado aos modelos cadastrados.`);
    }
    const existing = getRegra(regras, modeloId, filterYear, filterMonth);
    setEditingRegraModeloId(modeloId);
    setEditRegraValues(existing ? { ...existing } : createEmptyRegra(modeloId, filterYear, filterMonth));
  }

  async function handleSaveRegra() {
    if (!editRegraValues) return;
    const exists = regras.some(r => r.id === editRegraValues.id);
    const updated = exists
      ? regras.map(r => r.id === editRegraValues.id ? editRegraValues : r)
      : [...regras, editRegraValues];
    setRegras(updated);
    await saveRegras(updated);
    setEditingRegraModeloId(null);
    toast.success('Regra salva.');
  }

  async function handleCopyPrevMonth() {
    const prevMonth = filterMonth === 1 ? 12 : filterMonth - 1;
    const prevYear  = filterMonth === 1 ? filterYear - 1 : filterYear;
    const prevRegras = regras.filter(r => r.ano === prevYear && r.mes === prevMonth);
    if (prevRegras.length === 0) {
      toast.warning(`Nenhum dado em ${MONTHS[prevMonth - 1]}/${prevYear}.`);
      setConfirmCopyPrev(false);
      return;
    }
    const copied: VeiculoRegra[] = prevRegras.map(r => ({
      ...r,
      id: crypto.randomUUID(),
      ano: filterYear,
      mes: filterMonth,
    }));
    const updated = [
      ...regras.filter(r => !(r.ano === filterYear && r.mes === filterMonth)),
      ...copied,
    ];
    setRegras(updated);
    await saveRegras(updated);
    setConfirmCopyPrev(false);
    toast.success(`${copied.length} regra(s) copiada(s) de ${MONTHS[prevMonth - 1]}/${prevYear}.`);
  }

  // ─── Prev month labels ─────────────────────────────────────────────────────
  const prevMonth = filterMonth === 1 ? 12 : filterMonth - 1;
  const prevYear  = filterMonth === 1 ? filterYear - 1 : filterYear;

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Carregando...</div>
  );

  return (
    <div className="flex flex-col" style={{ minHeight: 0 }}>

      {/* ── Modais ── */}
      {confirmDeleteModeloId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Excluir modelo</p>
                <p className="text-slate-500 text-xs mt-1">Todas as regras mensais deste modelo também serão excluídas. Ação irreversível.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteModeloId(null)}>Cancelar</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteModelo}>Excluir</Button>
            </div>
          </div>
        </div>
      )}

      {confirmCopyPrev && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Copiar mês anterior</p>
                <p className="text-slate-500 text-xs mt-1">
                  Os dados de <strong>{MONTHS[prevMonth - 1]}/{prevYear}</strong> serão copiados para{' '}
                  <strong>{MONTHS[filterMonth - 1]}/{filterYear}</strong>. Dados já existentes neste mês serão substituídos.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmCopyPrev(false)}>Cancelar</Button>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleCopyPrevMonth}>Copiar</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-abas ── */}
      <div className="flex gap-0 border-b border-slate-200 mb-5">
        {([['modelos', 'Modelos Cadastrados'], ['regras', 'Regras Mensais']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              subTab === id
                ? 'border-slate-800 text-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
          SUB-ABA: MODELOS CADASTRADOS
      ══════════════════════════════════════════════════════════ */}
      {subTab === 'modelos' && (
        <div>
          {/* Formulário de adição */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Marca</label>
              <select
                value={newModelo.marca}
                onChange={e => setNewModelo(p => ({ ...p, marca: e.target.value as MarcaVeiculo }))}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="VW">VW</option>
                <option value="Audi">Audi</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modelo</label>
              <input
                value={newModelo.modelo}
                onChange={e => setNewModelo(p => ({ ...p, modelo: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAddModelo()}
                placeholder="Ex: Polo, Golf, A3..."
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <Button onClick={handleAddModelo} className="bg-slate-800 hover:bg-slate-700 text-white h-9 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
          </div>

          {/* Tabela de modelos */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-4 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide w-24">Marca</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide">Modelo</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide w-20">Ativo</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide w-20">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {modelos.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">Nenhum modelo cadastrado. Adicione acima.</td></tr>
                ) : modelos.sort((a, b) => `${a.marca}${a.modelo}`.localeCompare(`${b.marca}${b.modelo}`)).map((m, i) => {
                  const isEditing = editingModeloId === m.id;
                  const ev = isEditing ? editModeloValues! : m;
                  return (
                    <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      <td className="px-4 py-2">
                        {isEditing ? (
                          <select
                            value={ev.marca}
                            onChange={e => setEditModeloValues(p => ({ ...p!, marca: e.target.value as MarcaVeiculo }))}
                            className="border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                          >
                            <option value="VW">VW</option>
                            <option value="Audi">Audi</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${m.marca === 'VW' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}`}>
                            {m.marca}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-700 font-medium">
                        {isEditing ? (
                          <input
                            value={ev.modelo}
                            onChange={e => setEditModeloValues(p => ({ ...p!, modelo: e.target.value }))}
                            className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        ) : m.modelo}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={ev.ativo}
                            onChange={e => setEditModeloValues(p => ({ ...p!, ativo: e.target.checked }))}
                            className="w-4 h-4 accent-emerald-600"
                          />
                        ) : (
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${m.ativo ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {isEditing ? (
                          <div className="flex justify-center gap-1">
                            <button onClick={handleSaveModelo} className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingModeloId(null)} className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition-colors"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <div className="flex justify-center gap-1">
                            <button onClick={() => { setEditingModeloId(m.id); setEditModeloValues({ ...m }); }} className="p-1.5 rounded text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setConfirmDeleteModeloId(m.id)} className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          SUB-ABA: REGRAS MENSAIS
      ══════════════════════════════════════════════════════════ */}
      {subTab === 'regras' && (
        <div className="flex flex-col gap-4">
          {/* Barra de controles */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Marca */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {(['VW', 'Audi'] as MarcaVeiculo[]).map(marca => (
                <button
                  key={marca}
                  onClick={() => setFilterBrand(marca)}
                  className={`px-5 py-1.5 text-sm font-bold transition-colors ${
                    filterBrand === marca ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50'
                  }`}
                >
                  {marca}
                </button>
              ))}
            </div>

            {/* Ano */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ANO</span>
              <div className="relative">
                <select
                  value={filterYear}
                  onChange={e => setFilterYear(Number(e.target.value))}
                  className="appearance-none border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer"
                >
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Mês */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MÊS</span>
              <div className="relative">
                <select
                  value={filterMonth}
                  onChange={e => setFilterMonth(Number(e.target.value))}
                  className="appearance-none border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer"
                >
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Copiar mês anterior */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmCopyPrev(true)}
              className="border-amber-300 text-amber-700 hover:bg-amber-50 h-8 text-xs flex items-center gap-1.5 ml-auto"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar de {MONTHS[prevMonth - 1]}/{prevYear}
            </Button>
          </div>

          {/* Tabela de regras */}
          <div ref={tableRef} className="overflow-auto bg-white border border-slate-200 rounded-xl">
            <table className="border-collapse text-xs" style={{ minWidth: 'max-content' }}>
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-800 text-white">
                  <th className="sticky left-0 z-30 bg-slate-800 px-4 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide min-w-[160px] border-r border-slate-700">
                    Modelo
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-[10px] uppercase tracking-wide min-w-[130px]">Preço Público</th>
                  {indicadoresFiltrados.map(f => (
                    <th key={f.key} className="px-3 py-2.5 text-right font-semibold text-[10px] uppercase tracking-wide min-w-[90px]">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide min-w-[60px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {modelosParaExibir.length === 0 ? (
                  <tr>
                    <td colSpan={2 + indicadoresFiltrados.length + 1} className="px-4 py-10 text-center text-slate-400">
                      Nenhum modelo ativo para {filterBrand}. Cadastre modelos na aba "Modelos Cadastrados"{filterBrand === 'VW' ? ' ou importe as vendas do mês' : ''}.
                    </td>
                  </tr>
                ) : modelosParaExibir.map((m, i) => {
                  const isVirtual = !!m.fromSales;
                  const regra = isVirtual ? undefined : getRegra(regras, m.id, filterYear, filterMonth);
                  const isEditing = editingRegraModeloId === m.id;
                  const ev = isEditing ? editRegraValues! : regra;
                  const rowBg = isVirtual ? 'bg-amber-50' : (i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60');
                  return (
                    <tr key={m.id} className={`${rowBg} hover:bg-yellow-50/30 transition-colors`}>
                      {/* Coluna modelo — sticky */}
                      <td className={`sticky left-0 z-10 ${rowBg} px-4 py-2 font-semibold text-slate-700 border-r border-slate-100 whitespace-nowrap`}>
                        {m.modelo}
                        {isVirtual && !isEditing && (
                          <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Novo · Sem regra
                          </span>
                        )}
                        {!isVirtual && !regra && !isEditing && (
                          <span className="ml-2 text-[9px] text-slate-300 font-normal">sem dados</span>
                        )}
                      </td>

                      {/* Preço Público */}
                      <td className="px-3 py-2 text-right font-mono text-slate-700 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            value={ev?.precoPublico ?? ''}
                            onChange={e => setEditRegraValues(p => ({ ...p!, precoPublico: e.target.value }))}
                            placeholder="0,00"
                            className="w-28 border border-slate-300 rounded px-1.5 py-0.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        ) : (
                          ev?.precoPublico
                            ? <span className="text-emerald-700">{fmtCurrency(ev.precoPublico)}</span>
                            : <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* % indicadores filtrados por marca */}
                      {indicadoresFiltrados.map(f => (
                        <td key={f.key} className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">
                          {isEditing ? (
                            <input
                              value={(ev as unknown as Record<string, string>)?.[f.key] ?? ''}
                              onChange={e => setEditRegraValues(p => ({ ...p!, [f.key]: e.target.value }))}
                              placeholder="0"
                              className="w-16 border border-slate-300 rounded px-1.5 py-0.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                          ) : (
                            ev
                              ? fmtPercent((ev as unknown as Record<string, string>)[f.key])
                              : <span className="text-slate-300">—</span>
                          )}
                        </td>
                      ))}

                      {/* Ações */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex justify-center gap-1">
                            <button onClick={handleSaveRegra} title="Salvar" className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingRegraModeloId(null)} title="Cancelar" className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition-colors"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditRegra(m)}
                            title={isVirtual ? 'Cadastrar e definir regra' : 'Editar'}
                            className={`p-1.5 rounded transition-colors ${isVirtual ? 'text-amber-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-300 hover:text-indigo-600 hover:bg-indigo-50'}`}
                          >
                            {isVirtual ? <Plus className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-400">
            Dica: campos em branco são tratados como zero no cálculo. Clique no lápis para editar um modelo. Use "Copiar mês anterior" para aproveitar os dados do mês passado e ajustar apenas as diferenças.
          </p>
        </div>
      )}
    </div>
  );
}
