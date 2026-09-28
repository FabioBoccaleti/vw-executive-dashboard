import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Users, FileText, Leaf, LockOpen, Printer } from 'lucide-react';
import { toast } from 'sonner';
import type { VendasRow } from './vendasStorage';
import {
  loadPrestadores, savePrestadores, type PrestadorServico,
  loadPagamentos, savePagamentos, type PagamentosMap, type DeclaracaoPagamento,
} from './declaracaoStorage';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function rowYear(r: VendasRow): number {
  return r.dataVenda ? parseInt(r.dataVenda.split('-')[0]) || 0 : 0;
}
function rowMonth(r: VendasRow): number {
  return r.dataVenda ? parseInt(r.dataVenda.split('-')[1]) || 0 : 0;
}
function fmtDate(v: string): string {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return y && m && d ? `${d}/${m}/${y}` : v;
}
function fmtBRL(raw: string): string {
  const n = parseFloat(raw);
  return isNaN(n) ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function DeclaracaoView({ rows }: { rows: VendasRow[] }) {
  const [subView, setSubView] = useState<'cadastro' | 'relacao'>('relacao');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sub-abas */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-4">
        {([
          { id: 'cadastro' as const, label: 'Cadastro', icon: Users },
          { id: 'relacao'  as const, label: 'Relação',  icon: FileText },
        ]).map(t => (
          <button key={t.id} onClick={() => setSubView(t.id)}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              subView === t.id ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50">
        {subView === 'cadastro' ? <CadastroTab /> : <RelacaoTab rows={rows} />}
      </div>
    </div>
  );
}

// ─── Aba Cadastro ─────────────────────────────────────────────────────────────
function CadastroTab() {
  const [prestadores, setPrestadores] = useState<PrestadorServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editValor, setEditValor] = useState('');

  useEffect(() => {
    loadPrestadores().then(setPrestadores).finally(() => setLoading(false));
  }, []);

  async function persist(next: PrestadorServico[]) {
    setPrestadores(next);
    await savePrestadores(next);
  }

  async function handleAdd() {
    const nome = novoNome.trim();
    if (!nome) { toast.error('Informe o nome do prestador.'); return; }
    const valor = novoValor.trim().replace(/\./g, '').replace(',', '.');
    await persist([...prestadores, { id: crypto.randomUUID(), nome, valor }]);
    setNovoNome('');
    setNovoValor('');
    toast.success('Prestador cadastrado.');
  }

  function startEdit(p: PrestadorServico) {
    setEditId(p.id);
    setEditNome(p.nome);
    setEditValor(p.valor);
  }
  async function saveEdit() {
    if (!editId) return;
    const nome = editNome.trim();
    if (!nome) { toast.error('Informe o nome do prestador.'); return; }
    const valor = editValor.trim().replace(/\./g, '').replace(',', '.');
    await persist(prestadores.map(p => p.id === editId ? { ...p, nome, valor } : p));
    setEditId(null);
    toast.success('Prestador atualizado.');
  }
  async function handleDelete(id: string) {
    await persist(prestadores.filter(p => p.id !== id));
    toast.success('Prestador excluído.');
  }

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-slate-800">Prestadores de Serviço</h3>
        <p className="text-xs text-slate-400">Cadastre o nome do prestador e o valor do serviço.</p>
      </div>

      {/* Adicionar */}
      <div className="flex items-end gap-2 bg-white border border-slate-200 rounded-lg px-4 py-3">
        <div className="flex-1">
          <label className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Prestador de Serviço</label>
          <input value={novoNome} onChange={e => setNovoNome(e.target.value)}
            placeholder="Nome do prestador"
            className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div className="w-40">
          <label className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Valor do Serviço</label>
          <input value={novoValor} onChange={e => setNovoValor(e.target.value)}
            placeholder="0,00" inputMode="decimal"
            className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <button onClick={handleAdd}
          className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-2 font-semibold">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center text-slate-400 text-sm py-12">Carregando...</div>
      ) : prestadores.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-12">Nenhum prestador cadastrado.</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Prestador de Serviço</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor do Serviço</th>
                <th className="px-4 py-2.5 w-24" />
              </tr>
            </thead>
            <tbody>
              {prestadores.map((p, i) => {
                const editing = editId === p.id;
                return (
                  <tr key={p.id} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                    <td className="px-4 py-2">
                      {editing
                        ? <input value={editNome} onChange={e => setEditNome(e.target.value)}
                            className="w-full border border-amber-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
                        : <span className="text-slate-700 font-medium">{p.nome}</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {editing
                        ? <input value={editValor} onChange={e => setEditValor(e.target.value)} inputMode="decimal"
                            className="w-32 border border-amber-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-amber-400" />
                        : <span className="font-mono text-slate-700">{fmtBRL(p.valor)}</span>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {editing ? (
                          <>
                            <button onClick={saveEdit} title="Salvar" className="text-emerald-500 hover:text-emerald-700 p-1 rounded hover:bg-emerald-50"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditId(null)} title="Cancelar" className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100"><X className="w-3.5 h-3.5" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(p)} title="Editar" className="text-slate-300 hover:text-slate-600 p-1 rounded hover:bg-slate-100"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(p.id)} title="Excluir" className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
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

// ─── Aba Relação ──────────────────────────────────────────────────────────────
function RelacaoTab({ rows }: { rows: VendasRow[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [prestadores, setPrestadores] = useState<PrestadorServico[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentosMap>({});
  const [dialogRowId, setDialogRowId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadPrestadores(), loadPagamentos()]).then(([p, pg]) => {
      setPrestadores(p);
      setPagamentos(pg);
    });
  }, []);

  async function persistPagamentos(next: PagamentosMap) {
    setPagamentos(next);
    await savePagamentos(next);
  }

  // Apenas linhas com Data da Venda alimentada
  const rowsComVenda = useMemo(() => rows.filter(r => !!r.dataVenda), [rows]);

  const availYears = useMemo(() => {
    const s = new Set<number>(rowsComVenda.map(rowYear).filter(y => y > 2000));
    s.add(now.getFullYear());
    return [...s].sort((a, b) => a - b);
  }, [rowsComVenda]);

  const relacao = useMemo(() =>
    rowsComVenda
      .filter(r => rowYear(r) === year && rowMonth(r) === month)
      .sort((a, b) => a.dataVenda.localeCompare(b.dataVenda)),
    [rowsComVenda, year, month]);

  const dialogRow = dialogRowId ? rowsComVenda.find(r => r.id === dialogRowId) ?? null : null;

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-4">
      {/* Seletor Ano + Mês */}
      <div className="flex items-center gap-3 flex-wrap bg-white border border-slate-200 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ano</span>
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
            {availYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="w-px h-6 bg-slate-200" />
        <div className="flex items-center gap-1 flex-wrap">
          {MONTHS.map((m, i) => {
            const mi = i + 1;
            return (
              <button key={mi} onClick={() => setMonth(mi)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  month === mi ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['Veículo', 'Chassi', 'Revenda', 'Blindadora', 'Data da Venda', 'Situação'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
              <th className="px-4 py-2.5 w-16" />
            </tr>
          </thead>
          <tbody>
            {relacao.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-slate-400 text-sm py-12">
                  Nenhuma venda com data em {MONTHS[month - 1]}/{year}.
                </td>
              </tr>
            ) : relacao.map((r, i) => {
              const pago = pagamentos[r.id]?.pago ?? false;
              return (
                <tr key={r.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                  <td className="px-4 py-2 text-slate-700">{r.veiculo || '—'}</td>
                  <td className="px-4 py-2 font-mono text-slate-600">{r.chassi || '—'}</td>
                  <td className="px-4 py-2 text-slate-700">{r.revenda || '—'}</td>
                  <td className="px-4 py-2 text-slate-700">{r.blindadora || '—'}</td>
                  <td className="px-4 py-2 font-mono text-slate-600 whitespace-nowrap">{fmtDate(r.dataVenda)}</td>
                  <td className="px-4 py-2">
                    {pago ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                        <Check className="w-3 h-3" /> Pago
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                        Pendente de Pagamento
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => setDialogRowId(r.id)} title="Demonstrativo de pagamento"
                      className={`p-1.5 rounded-lg transition-colors ${pago ? 'text-emerald-500 hover:bg-emerald-50' : 'text-amber-500 hover:bg-amber-50'}`}>
                      <Leaf className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dialogRow && (
        <DemonstrativoDialog
          row={dialogRow}
          prestadores={prestadores}
          pagamento={pagamentos[dialogRow.id]}
          onClose={() => setDialogRowId(null)}
          onSave={async (pg) => { await persistPagamentos({ ...pagamentos, [dialogRow.id]: pg }); }}
        />
      )}
    </div>
  );
}

// ─── Demonstrativo de Pagamento (por linha) ───────────────────────────────────
function DemonstrativoDialog({
  row, prestadores, pagamento, onClose, onSave,
}: {
  row: VendasRow;
  prestadores: PrestadorServico[];
  pagamento?: DeclaracaoPagamento;
  onClose: () => void;
  onSave: (pg: DeclaracaoPagamento) => Promise<void>;
}) {
  const pago = pagamento?.pago ?? false;

  // Seleção inicial: se pago usa o congelado; senão persistido; senão auto (único)
  const initialPrestador = pago
    ? (pagamento?.prestadorId ?? '')
    : (pagamento?.prestadorId ?? (prestadores.length === 1 ? prestadores[0].id : ''));
  const [prestadorId, setPrestadorId] = useState(initialPrestador);
  const [codigoCliente, setCodigoCliente] = useState(pagamento?.codigoCliente ?? '');
  const [nomeCliente, setNomeCliente] = useState(pagamento?.nomeCliente ?? '');
  const [reabrir, setReabrir] = useState(false);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const prestadorSel = prestadores.find(p => p.id === prestadorId);
  const valorAtual = pago ? (pagamento?.valor ?? '') : (prestadorSel?.valor ?? '');
  const nomeExibido = pago ? (pagamento?.prestadorNome ?? prestadorSel?.nome ?? '') : (prestadorSel?.nome ?? '');

  async function persistPendente(patch: Partial<DeclaracaoPagamento>) {
    if (pago) return;
    await onSave({ ...(pagamento ?? { pago: false }), pago: false, prestadorId, codigoCliente, nomeCliente, ...patch });
  }

  async function persistSelecao(id: string) {
    setPrestadorId(id);
    await persistPendente({ prestadorId: id });
  }

  async function marcarPago() {
    if (prestadores.length === 0) { toast.error('Cadastre um prestador de serviço na aba Cadastro antes de pagar.'); return; }
    if (!prestadorSel) { toast.error('Selecione um prestador de serviço.'); return; }
    await onSave({
      pago: true,
      prestadorId: prestadorSel.id,
      prestadorNome: prestadorSel.nome,
      valor: prestadorSel.valor,
      codigoCliente,
      nomeCliente,
      dataPagamento: new Date().toISOString().split('T')[0],
    });
    toast.success('Demonstrativo marcado como pago.');
  }

  async function confirmarReabrir() {
    if (senha !== '1985') { setErro('Senha incorreta.'); return; }
    await onSave({ pago: false, prestadorId: pagamento?.prestadorId, codigoCliente, nomeCliente });
    setReabrir(false);
    setSenha('');
    setErro(null);
    toast.success('Pagamento reaberto.');
  }


  function handlePrint() {
    if (!pago) return;
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const dado = (label: string, value: string) =>
      `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;">
        <p style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin:0 0 3px;">${label}</p>
        <p style="font-size:12px;font-weight:600;color:#1e293b;margin:0;">${esc(value || '—')}</p>
      </div>`;
    const html = `<div style="font-family:Inter,system-ui,sans-serif;">
      <div style="background:#1e293b;color:white;border-radius:10px;overflow:hidden;margin-bottom:14px;padding:16px 20px;">
        <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 4px;">Demonstrativo de Pagamento</p>
        <p style="font-size:16px;font-weight:700;margin:0;">Pagamento prestador de Serviço — Emissão de Declaração de Blindagem.</p>
      </div>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin-bottom:14px;">
        <p style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#b45309;margin:0 0 4px;">Prestador de Serviço</p>
        <p style="font-size:15px;font-weight:700;color:#1e293b;margin:0;">${esc(nomeExibido || '—')}</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
        ${dado('Data da Venda', fmtDate(row.dataVenda))}
        ${dado('Chassi', row.chassi)}
        ${dado('Blindadora', row.blindadora)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px;margin-bottom:14px;">
        ${dado('Código Cliente', codigoCliente)}
        ${dado('Nome do Cliente', nomeCliente)}
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <span style="font-size:12px;font-weight:600;color:#475569;">Valor a pagar pela Prestação de Serviço</span>
        <span style="font-size:18px;font-weight:700;color:#1e293b;">${valorAtual ? fmtBRL(valorAtual) : '—'}</span>
      </div>
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:12px 16px;">
        <span style="font-size:13px;font-weight:700;color:#065f46;">&#10003; Pago${pagamento?.dataPagamento ? ` em ${fmtDate(pagamento.dataPagamento)}` : ''}</span>
      </div>
    </div>`;

    const root = document.getElementById('print-root');
    if (!root) { window.print(); return; }
    root.innerHTML = html;
    const style = document.createElement('style');
    style.textContent = `@page { size: A4 portrait; margin: 1.5cm; } #print-root { font-family: Inter, system-ui, sans-serif; }
      #print-root, #print-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; forced-color-adjust: none !important; color-scheme: light !important; }`;
    document.head.appendChild(style);
    window.onafterprint = () => { document.head.removeChild(style); root.innerHTML = ''; window.onafterprint = null; };
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-slate-800 text-white px-6 py-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Demonstrativo de Pagamento</p>
            <h3 className="text-sm font-bold leading-snug">Pagamento prestador de Serviço — Emissão de Declaração de Blindagem.</h3>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Prestador (destaque) */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <label className="block text-[10px] text-amber-700 font-bold uppercase tracking-wide mb-1.5">Prestador de Serviço</label>
            {pago ? (
              <p className="text-sm font-bold text-slate-800">{nomeExibido || '—'}</p>
            ) : prestadores.length === 0 ? (
              <p className="text-xs text-red-500">Nenhum prestador cadastrado. Cadastre na aba Cadastro.</p>
            ) : (
              <select value={prestadorId} onChange={e => persistSelecao(e.target.value)}
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                <option value="">Selecione…</option>
                {prestadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            )}
          </div>

          {/* Dados da venda */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Data da Venda', value: fmtDate(row.dataVenda) || '—' },
              { label: 'Chassi', value: row.chassi || '—' },
              { label: 'Blindadora', value: row.blindadora || '—' },
            ].map(d => (
              <div key={d.label} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">{d.label}</p>
                <p className="text-sm font-medium text-slate-700 break-words">{d.value}</p>
              </div>
            ))}
          </div>

          {/* Cliente (preenchido pelo usuário) */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Código Cliente</label>
              {pago ? (
                <p className="text-sm font-medium text-slate-700 border border-slate-100 bg-slate-50/60 rounded-lg px-3 py-2">{codigoCliente || '—'}</p>
              ) : (
                <input value={codigoCliente} onChange={e => setCodigoCliente(e.target.value)} onBlur={() => persistPendente({ codigoCliente })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Nome do Cliente</label>
              {pago ? (
                <p className="text-sm font-medium text-slate-700 border border-slate-100 bg-slate-50/60 rounded-lg px-3 py-2">{nomeCliente || '—'}</p>
              ) : (
                <input value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} onBlur={() => persistPendente({ nomeCliente })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              )}
            </div>
          </div>

          {/* Valor a pagar */}
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Valor a pagar pela Prestação de Serviço</span>
            <span className="text-lg font-bold font-mono text-slate-800">{valorAtual ? fmtBRL(valorAtual) : '—'}</span>
          </div>

          {/* Status */}
          <div className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${pago ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-300'}`}>
            {pago
              ? <span className="flex items-center gap-1.5"><Check className="w-4 h-4" /> Pago{pagamento?.dataPagamento ? ` em ${fmtDate(pagamento.dataPagamento)}` : ''}</span>
              : 'Pendente de Pagamento'}
          </div>

          {/* Reabrir (senha) */}
          {reabrir && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex flex-col gap-2">
              <p className="text-xs text-slate-600">Digite a senha para reabrir o pagamento.</p>
              <div className="flex items-center gap-2">
                <input type="password" value={senha} onChange={e => { setSenha(e.target.value); setErro(null); }}
                  className="flex-1 border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                <button onClick={confirmarReabrir} className="text-xs bg-amber-500 hover:bg-amber-600 text-white rounded px-3 py-1.5 font-semibold">Confirmar</button>
                <button onClick={() => { setReabrir(false); setSenha(''); setErro(null); }} className="text-xs text-slate-400 hover:text-slate-600 px-2">Cancelar</button>
              </div>
              {erro && <p className="text-xs text-red-500">{erro}</p>}
            </div>
          )}
        </div>

        {/* Footer ações */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button onClick={handlePrint} disabled={!pago}
            className="flex items-center gap-1.5 text-xs bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-3 py-2 font-semibold">
            <Printer className="w-3.5 h-3.5" /> Imprimir PDF
          </button>
          {pago ? (
            <button onClick={() => setReabrir(true)}
              className="flex items-center gap-1.5 text-xs bg-white border border-amber-300 text-amber-600 hover:bg-amber-50 rounded-lg px-3 py-2 font-semibold">
              <LockOpen className="w-3.5 h-3.5" /> Reabrir pagamento
            </button>
          ) : (
            <button onClick={marcarPago}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 font-semibold">
              <Check className="w-3.5 h-3.5" /> Marcar como pago
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

