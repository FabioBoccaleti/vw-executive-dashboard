import { useState, useEffect } from 'react';
import {
  FileSpreadsheet, FileText, FileDown, ChevronDown, ChevronUp,
  MapPin, Hash, Settings, ListOrdered, BookOpen,
  Pencil, Save, X, Plus, Trash2, PlusCircle,
} from 'lucide-react';

type TipoArquivo = 'Excel' | 'TXT' | 'PDF';

interface Relatorio {
  aba: string;
  nome: string;
  tipo: TipoArquivo;
  ondeGerar: string;
  transacoes: string[];
  parametros: string[];
  passos: string[];
}

const TODAS_ABAS = [
  'Importar PDF',
  'Tabela de Dados',
  'Registro de Vendas',
  'Bonus Varejo',
  'Bonus Trade IN',
  'Juros Rotativo',
  'V. Pecas',
  'Veiculos Novos',
  'Veiculos VD / Frotista',
  'Veiculos Usados',
  'V. Pecas (Registro)',
  'Itens de Pecas',
  'Pecas Seg. Balcao',
  'Pecas Mercado Livre',
  'Pecas E-Pecas',
];

const STORAGE_KEY = 'vw-guia-relatorios-v1';

function loadFromStorage(): Relatorio[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Relatorio[];
  } catch { /* ignore */ }
  return [];
}

function saveToStorage(data: Relatorio[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const TIPO_CONFIG: Record<TipoArquivo, { label: string; color: string; icon: React.ReactNode }> = {
  Excel: { label: 'Excel', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200', icon: <FileSpreadsheet className="w-3 h-3" /> },
  TXT:   { label: 'TXT',   color: 'bg-slate-100 text-slate-600 border border-slate-200',     icon: <FileText className="w-3 h-3" /> },
  PDF:   { label: 'PDF',   color: 'bg-red-100 text-red-600 border border-red-200',           icon: <FileDown className="w-3 h-3" /> },
};

function CardLeitura({ r, onEdit, onDelete }: { r: Relatorio; onEdit: () => void; onDelete: () => void }) {
  const [aberto, setAberto] = useState(false);
  const tipo = TIPO_CONFIG[r.tipo];
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center">
        <button onClick={() => setAberto(v => !v)} className="flex-1 flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${tipo.color}`}>{tipo.icon} {tipo.label}</span>
            <span className="text-sm font-semibold text-slate-800 truncate">{r.nome || <span className="text-slate-400 italic">sem nome</span>}</span>
          </div>
          {aberto ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        </button>
        <div className="flex items-center gap-1 pr-3">
          <button onClick={onEdit} title="Editar" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} title="Excluir" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {aberto && (
        <div className="px-5 pb-5 border-t border-slate-100 grid gap-4 pt-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5"><MapPin className="w-3.5 h-3.5" /> Onde Gerar</div>
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 font-mono whitespace-pre-wrap">{r.ondeGerar || <span className="text-slate-400 italic">nao preenchido</span>}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5"><Hash className="w-3.5 h-3.5" /> Transacoes</div>
            <div className="flex flex-wrap gap-1.5">
              {r.transacoes.filter(Boolean).map((t, i) => <span key={i} className="text-xs font-mono bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md">{t}</span>)}
              {!r.transacoes.filter(Boolean).length && <span className="text-slate-400 italic text-sm">nao preenchido</span>}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5"><Settings className="w-3.5 h-3.5" /> Parametros</div>
            <ul className="space-y-1">
              {r.parametros.filter(Boolean).map((p, i) => <li key={i} className="text-sm text-slate-700 flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />{p}</li>)}
              {!r.parametros.filter(Boolean).length && <span className="text-slate-400 italic text-sm">nao preenchido</span>}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5"><ListOrdered className="w-3.5 h-3.5" /> Passo a Passo</div>
            <ol className="space-y-1.5">
              {r.passos.filter(Boolean).map((p, i) => (
                <li key={i} className="text-sm text-slate-700 flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  {p}
                </li>
              ))}
              {!r.passos.filter(Boolean).length && <span className="text-slate-400 italic text-sm">nao preenchido</span>}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function CardEdicao({ r, onSave, onCancel }: { r: Relatorio; onSave: (updated: Relatorio) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Relatorio>({ ...r, transacoes: [...r.transacoes], parametros: [...r.parametros], passos: [...r.passos] });
  function updateList(field: 'transacoes' | 'parametros' | 'passos', idx: number, value: string) {
    setDraft(d => { const arr = [...d[field]]; arr[idx] = value; return { ...d, [field]: arr }; });
  }
  function addItem(field: 'transacoes' | 'parametros' | 'passos') {
    setDraft(d => ({ ...d, [field]: [...d[field], ''] }));
  }
  function removeItem(field: 'transacoes' | 'parametros' | 'passos', idx: number) {
    setDraft(d => { const arr = d[field].filter((_, i) => i !== idx); return { ...d, [field]: arr.length ? arr : [''] }; });
  }
  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";
  return (
    <div className="bg-blue-50 border-2 border-blue-300 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-blue-200 flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Editando relatorio</span>
        <div className="flex gap-2">
          <button onClick={() => onSave(draft)} className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"><Save className="w-3.5 h-3.5" /> Salvar</button>
          <button onClick={onCancel} className="flex items-center gap-1.5 text-xs font-semibold border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-white transition-colors"><X className="w-3.5 h-3.5" /> Cancelar</button>
        </div>
      </div>
      <div className="px-5 py-4 grid gap-5">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Aba</label>
            <select value={draft.aba} onChange={e => setDraft(d => ({ ...d, aba: e.target.value }))} className={inputCls}>
              {TODAS_ABAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Tipo de Arquivo</label>
            <select value={draft.tipo} onChange={e => setDraft(d => ({ ...d, tipo: e.target.value as TipoArquivo }))} className={inputCls}>
              <option value="Excel">Excel</option>
              <option value="TXT">TXT</option>
              <option value="PDF">PDF</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Nome do Relatorio</label>
            <input value={draft.nome} onChange={e => setDraft(d => ({ ...d, nome: e.target.value }))} placeholder="Ex: Espelho de Vendas" className={inputCls} />
          </div>
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1"><MapPin className="w-3 h-3" /> Onde Gerar</label>
          <input value={draft.ondeGerar} onChange={e => setDraft(d => ({ ...d, ondeGerar: e.target.value }))} placeholder="Ex: DMS > Relatorios > Vendas > Espelho" className={inputCls} />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2"><Hash className="w-3 h-3" /> Transacoes</label>
          <div className="flex flex-col gap-2">
            {draft.transacoes.map((t, i) => (
              <div key={i} className="flex gap-2">
                <input value={t} onChange={e => updateList('transacoes', i, e.target.value)} placeholder="Ex: V21" className={inputCls} />
                <button onClick={() => removeItem('transacoes', i)} className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"><X className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={() => addItem('transacoes')} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"><Plus className="w-3.5 h-3.5" /> Adicionar transacao</button>
          </div>
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2"><Settings className="w-3 h-3" /> Parametros</label>
          <div className="flex flex-col gap-2">
            {draft.parametros.map((p, i) => (
              <div key={i} className="flex gap-2">
                <input value={p} onChange={e => updateList('parametros', i, e.target.value)} placeholder="Ex: Data inicio: primeiro dia do mes" className={inputCls} />
                <button onClick={() => removeItem('parametros', i)} className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"><X className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={() => addItem('parametros')} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"><Plus className="w-3.5 h-3.5" /> Adicionar parametro</button>
          </div>
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2"><ListOrdered className="w-3 h-3" /> Passo a Passo</label>
          <div className="flex flex-col gap-2">
            {draft.passos.map((p, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center mt-2">{i + 1}</span>
                <input value={p} onChange={e => updateList('passos', i, e.target.value)} placeholder={`Passo ${i + 1}`} className={inputCls} />
                <button onClick={() => removeItem('passos', i)} className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0 mt-1.5"><X className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={() => addItem('passos')} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"><Plus className="w-3.5 h-3.5" /> Adicionar passo</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GuiaRelatoriosPage({ filterAbas }: { filterAbas?: string[] } = {}) {
  const [relatorios, setRelatorios] = useState<Relatorio[]>(() => loadFromStorage());
  const [abaAtiva, setAbaAtiva] = useState<string>('Todas');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  useEffect(() => { saveToStorage(relatorios); }, [relatorios]);

  const ordemAtiva = filterAbas ?? [
    'Importar PDF', 'Tabela de Dados', 'Registro de Vendas',
    'Bonus Varejo', 'Bonus Trade IN', 'Juros Rotativo', 'V. Pecas',
  ];

  const baseRelatorios = filterAbas
    ? relatorios.filter(r => filterAbas.includes(r.aba))
    : relatorios;

  const abas = ['Todas', ...ordemAtiva];
  const filtrados = abaAtiva === 'Todas' ? baseRelatorios : baseRelatorios.filter(r => r.aba === abaAtiva);

  const grupos = ordemAtiva.reduce<Record<string, { rel: Relatorio; idx: number }[]>>((acc, aba) => {
    const lista = filtrados
      .map(r => ({ rel: r, idx: relatorios.indexOf(r) }))
      .filter(({ rel }) => rel.aba === aba);
    if (lista.length > 0) acc[aba] = lista;
    return acc;
  }, {});

  function handleSave(idx: number, updated: Relatorio) {
    setRelatorios(prev => prev.map((r, i) => i === idx ? updated : r));
    setEditingIdx(null);
  }

  function handleDelete(idx: number) {
    setRelatorios(prev => prev.filter((_, i) => i !== idx));
    setEditingIdx(null);
  }

  function handleAdd() {
    const novoRel: Relatorio = {
      aba: filterAbas?.[0] ?? ordemAtiva[0] ?? 'Registro de Vendas',
      nome: '',
      tipo: 'Excel',
      ondeGerar: '',
      transacoes: [''],
      parametros: [''],
      passos: [''],
    };
    setRelatorios(prev => {
      const next = [...prev, novoRel];
      setEditingIdx(next.length - 1);
      return next;
    });
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Guia de Relatorios</h2>
            <p className="text-xs text-slate-500">Clique no lapis para editar qualquer relatorio</p>
          </div>
        </div>
        <button onClick={handleAdd} className="flex items-center gap-2 text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <PlusCircle className="w-4 h-4" /> Novo Relatorio
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {abas.map(aba => (
          <button key={aba} onClick={() => setAbaAtiva(aba)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${abaAtiva === aba ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
            {aba}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {Object.entries(grupos).map(([aba, lista]) => (
          <div key={aba}>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 pl-1">{aba}</h3>
            <div className="space-y-3">
              {lista.map(({ rel, idx }) =>
                editingIdx === idx
                  ? <CardEdicao key={idx} r={rel} onSave={updated => handleSave(idx, updated)} onCancel={() => setEditingIdx(null)} />
                  : <CardLeitura key={idx} r={rel} onEdit={() => setEditingIdx(idx)} onDelete={() => handleDelete(idx)} />
              )}
            </div>
          </div>
        ))}

        {filtrados.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm flex flex-col items-center gap-3">
            <BookOpen className="w-10 h-10 text-slate-200" />
            <span>Nenhum relatorio encontrado. Clique em <strong>Novo Relatorio</strong> para adicionar.</span>
          </div>
        )}
      </div>
    </div>
  );
}
