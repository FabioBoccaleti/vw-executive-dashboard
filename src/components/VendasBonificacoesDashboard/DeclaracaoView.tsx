import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Users, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { VendasRow } from './vendasStorage';
import {
  loadPrestadores, savePrestadores, type PrestadorServico,
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
            </tr>
          </thead>
          <tbody>
            {relacao.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-slate-400 text-sm py-12">
                  Nenhuma venda com data em {MONTHS[month - 1]}/{year}.
                </td>
              </tr>
            ) : relacao.map((r, i) => (
              <tr key={r.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                <td className="px-4 py-2 text-slate-700">{r.veiculo || '—'}</td>
                <td className="px-4 py-2 font-mono text-slate-600">{r.chassi || '—'}</td>
                <td className="px-4 py-2 text-slate-700">{r.revenda || '—'}</td>
                <td className="px-4 py-2 text-slate-700">{r.blindadora || '—'}</td>
                <td className="px-4 py-2 font-mono text-slate-600 whitespace-nowrap">{fmtDate(r.dataVenda)}</td>
                <td className="px-4 py-2 text-slate-300">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
