import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Pencil, Check, X, Tag, Package, Users, Car } from 'lucide-react';
import { toast } from 'sonner';
import {
  type MarcaRP, type ProdutoRP, type VendedorRP, type ModeloRP,
} from './remuneracaoProdutosStorage';

type CadastroTab = 'marcas' | 'produtos' | 'vendedores' | 'modelos';

interface RemuneracaoProdutosCadastroProps {
  marcas: MarcaRP[];
  produtos: ProdutoRP[];
  vendedores: VendedorRP[];
  modelos: ModeloRP[];
  onChangeMarcas: (items: MarcaRP[]) => void;
  onChangeProdutos: (items: ProdutoRP[]) => void;
  onChangeVendedores: (items: VendedorRP[]) => void;
  onChangeModelos: (items: ModeloRP[]) => void;
}

const parseBR = (s: string): number => {
  if (!s) return 0;
  let clean = s.trim().replace(/R\$\s*/g, '');
  if (clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
};
const fmtCurrency = (raw: string): string => {
  const n = parseFloat(raw);
  return isNaN(n) ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const inputCls = 'border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400';

export function RemuneracaoProdutosCadastro({
  marcas, produtos, vendedores, modelos,
  onChangeMarcas, onChangeProdutos, onChangeVendedores, onChangeModelos,
}: RemuneracaoProdutosCadastroProps) {
  const [tab, setTab] = useState<CadastroTab>('marcas');

  const tabs = [
    { id: 'marcas' as const, label: 'Marcas', icon: Tag },
    { id: 'produtos' as const, label: 'Produtos e Prêmios', icon: Package },
    { id: 'vendedores' as const, label: 'Vendedores', icon: Users },
    { id: 'modelos' as const, label: 'Modelos de Veículo', icon: Car },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-100">
      {/* Sub-abas */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-0 flex-shrink-0 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          {tab === 'marcas' && (
            <MarcasSection marcas={marcas} onChange={onChangeMarcas}
              produtos={produtos} vendedores={vendedores} modelos={modelos}
              onChangeProdutos={onChangeProdutos} onChangeVendedores={onChangeVendedores} onChangeModelos={onChangeModelos} />
          )}
          {tab === 'produtos' && (
            <ProdutosSection marcas={marcas} produtos={produtos} onChange={onChangeProdutos} />
          )}
          {tab === 'vendedores' && (
            <VendedoresSection marcas={marcas} vendedores={vendedores} onChange={onChangeVendedores} />
          )}
          {tab === 'modelos' && (
            <ModelosSection marcas={marcas} modelos={modelos} onChange={onChangeModelos} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Seletor de marca reutilizável ───────────────────────────────────────────
function MarcaPicker({ marcas, value, onChange }: { marcas: MarcaRP[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-1 mb-4">
      <label className="text-xs font-semibold text-slate-600">Marca</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={`${inputCls} bg-white max-w-xs`}>
        <option value="">Selecione a marca...</option>
        {marcas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>
    </div>
  );
}

// ── Marcas ──────────────────────────────────────────────────────────────────
function MarcasSection({
  marcas, onChange, produtos, vendedores, modelos, onChangeProdutos, onChangeVendedores, onChangeModelos,
}: {
  marcas: MarcaRP[]; onChange: (items: MarcaRP[]) => void;
  produtos: ProdutoRP[]; vendedores: VendedorRP[]; modelos: ModeloRP[];
  onChangeProdutos: (items: ProdutoRP[]) => void; onChangeVendedores: (items: VendedorRP[]) => void; onChangeModelos: (items: ModeloRP[]) => void;
}) {
  const [nome, setNome] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');

  const add = () => {
    const n = nome.trim();
    if (!n) { toast.error('Informe o nome da marca.'); return; }
    if (marcas.some(m => m.nome.toLowerCase() === n.toLowerCase())) { toast.error('Marca já cadastrada.'); return; }
    onChange([...marcas, { id: crypto.randomUUID(), nome: n }]);
    setNome('');
  };
  const saveEdit = (id: string) => {
    const n = editNome.trim();
    if (!n) { toast.error('Informe o nome da marca.'); return; }
    onChange(marcas.map(m => m.id === id ? { ...m, nome: n } : m));
    setEditId(null); setEditNome('');
  };
  const remove = (id: string) => {
    const usadoEm = produtos.filter(p => p.marcaId === id).length + vendedores.filter(v => v.marcaId === id).length + modelos.filter(mo => mo.marcaId === id).length;
    if (usadoEm > 0 && !window.confirm('Excluir esta marca também removerá seus produtos, vendedores e modelos cadastrados. Continuar?')) return;
    onChange(marcas.filter(m => m.id !== id));
    onChangeProdutos(produtos.filter(p => p.marcaId !== id));
    onChangeVendedores(vendedores.filter(v => v.marcaId !== id));
    onChangeModelos(modelos.filter(mo => mo.marcaId !== id));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-800">Marcas</h2>
      <div className="flex gap-2">
        <input value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Nome da marca (ex: Volkswagen)" className={`${inputCls} flex-1`} />
        <Button onClick={add} className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"><Plus className="w-4 h-4" /> Adicionar</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {marcas.length === 0 && <p className="text-sm text-slate-400 p-4 text-center">Nenhuma marca cadastrada.</p>}
        {marcas.map(m => (
          <div key={m.id} className="flex items-center gap-2 px-4 py-2.5">
            {editId === m.id ? (
              <>
                <input value={editNome} onChange={e => setEditNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit(m.id)} className={`${inputCls} flex-1`} />
                <button onClick={() => saveEdit(m.id)} className="p-1.5 rounded text-teal-600 hover:bg-teal-50"><Check className="w-4 h-4" /></button>
                <button onClick={() => { setEditId(null); setEditNome(''); }} className="p-1.5 rounded text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-slate-700">{m.nome}</span>
                <button onClick={() => { setEditId(m.id); setEditNome(m.nome); }} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(m.id)} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Produtos e Prêmios ──────────────────────────────────────────────────────
function ProdutosSection({ marcas, produtos, onChange }: { marcas: MarcaRP[]; produtos: ProdutoRP[]; onChange: (items: ProdutoRP[]) => void }) {
  const [marcaId, setMarcaId] = useState('');
  const [nome, setNome] = useState('');
  const [premio, setPremio] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editPremio, setEditPremio] = useState('');

  const filtered = useMemo(() => produtos.filter(p => p.marcaId === marcaId), [produtos, marcaId]);

  const add = () => {
    if (!marcaId) { toast.error('Selecione a marca.'); return; }
    const n = nome.trim();
    if (!n) { toast.error('Informe o nome do produto.'); return; }
    if (filtered.some(p => p.nome.toLowerCase() === n.toLowerCase())) { toast.error('Produto já cadastrado para esta marca.'); return; }
    onChange([...produtos, { id: crypto.randomUUID(), marcaId, nome: n, premio: String(parseBR(premio)) }]);
    setNome(''); setPremio('');
  };
  const saveEdit = (id: string) => {
    const n = editNome.trim();
    if (!n) { toast.error('Informe o nome do produto.'); return; }
    onChange(produtos.map(p => p.id === id ? { ...p, nome: n, premio: String(parseBR(editPremio)) } : p));
    setEditId(null);
  };
  const remove = (id: string) => onChange(produtos.filter(p => p.id !== id));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-800">Produtos e Prêmios</h2>
      <MarcaPicker marcas={marcas} value={marcaId} onChange={id => { setMarcaId(id); setEditId(null); }} />

      {marcaId && (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do produto" className={`${inputCls} flex-1`} />
            <input value={premio} onChange={e => setPremio(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Prêmio (ex: 1.500,00)" className={`${inputCls} sm:w-44`} />
            <Button onClick={add} className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"><Plus className="w-4 h-4" /> Adicionar</Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {filtered.length === 0 && <p className="text-sm text-slate-400 p-4 text-center">Nenhum produto cadastrado para esta marca.</p>}
            {filtered.map(p => (
              <div key={p.id} className="flex items-center gap-2 px-4 py-2.5">
                {editId === p.id ? (
                  <>
                    <input value={editNome} onChange={e => setEditNome(e.target.value)} className={`${inputCls} flex-1`} />
                    <input value={editPremio} onChange={e => setEditPremio(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit(p.id)} className={`${inputCls} w-36`} />
                    <button onClick={() => saveEdit(p.id)} className="p-1.5 rounded text-teal-600 hover:bg-teal-50"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditId(null)} className="p-1.5 rounded text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-slate-700">{p.nome}</span>
                    <span className="text-sm font-semibold text-slate-600 w-32 text-right">{fmtCurrency(p.premio)}</span>
                    <button onClick={() => { setEditId(p.id); setEditNome(p.nome); setEditPremio(p.premio); }} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(p.id)} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Lista simples vinculada à marca (vendedores / modelos) ──────────────────
function SimpleByMarcaSection<T extends { id: string; marcaId: string; nome: string }>({
  titulo, placeholder, marcas, items, onChange, make,
}: {
  titulo: string; placeholder: string; marcas: MarcaRP[]; items: T[];
  onChange: (items: T[]) => void; make: (marcaId: string, nome: string) => T;
}) {
  const [marcaId, setMarcaId] = useState('');
  const [nome, setNome] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');

  const filtered = useMemo(() => items.filter(i => i.marcaId === marcaId), [items, marcaId]);

  const add = () => {
    if (!marcaId) { toast.error('Selecione a marca.'); return; }
    const n = nome.trim();
    if (!n) { toast.error('Informe o nome.'); return; }
    if (filtered.some(i => i.nome.toLowerCase() === n.toLowerCase())) { toast.error('Já cadastrado para esta marca.'); return; }
    onChange([...items, make(marcaId, n)]);
    setNome('');
  };
  const saveEdit = (id: string) => {
    const n = editNome.trim();
    if (!n) { toast.error('Informe o nome.'); return; }
    onChange(items.map(i => i.id === id ? { ...i, nome: n } : i));
    setEditId(null);
  };
  const remove = (id: string) => onChange(items.filter(i => i.id !== id));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-800">{titulo}</h2>
      <MarcaPicker marcas={marcas} value={marcaId} onChange={id => { setMarcaId(id); setEditId(null); }} />

      {marcaId && (
        <>
          <div className="flex gap-2">
            <input value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder={placeholder} className={`${inputCls} flex-1`} />
            <Button onClick={add} className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"><Plus className="w-4 h-4" /> Adicionar</Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {filtered.length === 0 && <p className="text-sm text-slate-400 p-4 text-center">Nenhum registro para esta marca.</p>}
            {filtered.map(i => (
              <div key={i.id} className="flex items-center gap-2 px-4 py-2.5">
                {editId === i.id ? (
                  <>
                    <input value={editNome} onChange={e => setEditNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit(i.id)} className={`${inputCls} flex-1`} />
                    <button onClick={() => saveEdit(i.id)} className="p-1.5 rounded text-teal-600 hover:bg-teal-50"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditId(null)} className="p-1.5 rounded text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-slate-700">{i.nome}</span>
                    <button onClick={() => { setEditId(i.id); setEditNome(i.nome); }} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(i.id)} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function VendedoresSection({ marcas, vendedores, onChange }: { marcas: MarcaRP[]; vendedores: VendedorRP[]; onChange: (items: VendedorRP[]) => void }) {
  const [marcaId, setMarcaId] = useState('');
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editMatricula, setEditMatricula] = useState('');

  const filtered = useMemo(() => vendedores.filter(v => v.marcaId === marcaId), [vendedores, marcaId]);

  const add = () => {
    if (!marcaId) { toast.error('Selecione a marca.'); return; }
    const n = nome.trim();
    const mat = matricula.trim();
    if (!n) { toast.error('Informe o nome do vendedor.'); return; }
    if (!mat) { toast.error('Informe a matrícula.'); return; }
    if (filtered.some(v => v.nome.toLowerCase() === n.toLowerCase())) { toast.error('Vendedor já cadastrado para esta marca.'); return; }
    onChange([...vendedores, { id: crypto.randomUUID(), marcaId, nome: n, matricula: mat }]);
    setNome(''); setMatricula('');
  };
  const saveEdit = (id: string) => {
    const n = editNome.trim();
    const mat = editMatricula.trim();
    if (!n) { toast.error('Informe o nome do vendedor.'); return; }
    if (!mat) { toast.error('Informe a matrícula.'); return; }
    onChange(vendedores.map(v => v.id === id ? { ...v, nome: n, matricula: mat } : v));
    setEditId(null);
  };
  const remove = (id: string) => onChange(vendedores.filter(v => v.id !== id));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-800">Vendedores</h2>
      <MarcaPicker marcas={marcas} value={marcaId} onChange={id => { setMarcaId(id); setEditId(null); }} />

      {marcaId && (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do vendedor" className={`${inputCls} flex-1`} />
            <input value={matricula} onChange={e => setMatricula(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Matrícula" className={`${inputCls} sm:w-44`} />
            <Button onClick={add} className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"><Plus className="w-4 h-4" /> Adicionar</Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {filtered.length === 0 && <p className="text-sm text-slate-400 p-4 text-center">Nenhum vendedor cadastrado para esta marca.</p>}
            {filtered.map(v => (
              <div key={v.id} className="flex items-center gap-2 px-4 py-2.5">
                {editId === v.id ? (
                  <>
                    <input value={editNome} onChange={e => setEditNome(e.target.value)} className={`${inputCls} flex-1`} />
                    <input value={editMatricula} onChange={e => setEditMatricula(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit(v.id)} placeholder="Matrícula" className={`${inputCls} w-36`} />
                    <button onClick={() => saveEdit(v.id)} className="p-1.5 rounded text-teal-600 hover:bg-teal-50"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditId(null)} className="p-1.5 rounded text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-slate-700">{v.nome}</span>
                    <span className="text-sm text-slate-500 w-32 text-right">Mat. {v.matricula}</span>
                    <button onClick={() => { setEditId(v.id); setEditNome(v.nome); setEditMatricula(v.matricula); }} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(v.id)} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ModelosSection({ marcas, modelos, onChange }: { marcas: MarcaRP[]; modelos: ModeloRP[]; onChange: (items: ModeloRP[]) => void }) {
  return (
    <SimpleByMarcaSection<ModeloRP>
      titulo="Modelos de Veículo" placeholder="Modelo do veículo (ex: T-Cross)" marcas={marcas} items={modelos} onChange={onChange}
      make={(marcaId, nome) => ({ id: crypto.randomUUID(), marcaId, nome })}
    />
  );
}
