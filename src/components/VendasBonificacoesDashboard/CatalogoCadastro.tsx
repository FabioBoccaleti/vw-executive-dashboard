import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  saveCatalogo,
  type CatalogoVeiculos,
  type MarcaVeiculo,
  type ModeloVeiculo,
} from './catalogoStorage';

interface CatalogoCadastroProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogo: CatalogoVeiculos;
  onCatalogoChange: (catalogo: CatalogoVeiculos) => void;
}

export function CatalogoCadastro({ open, onOpenChange, catalogo, onCatalogoChange }: CatalogoCadastroProps) {
  const [saving, setSaving] = useState(false);

  // Marcas
  const [novaMarca, setNovaMarca] = useState('');
  const [editingMarcaId, setEditingMarcaId] = useState<string | null>(null);
  const [editMarcaNome, setEditMarcaNome] = useState('');

  // Modelos
  const [novoModeloMarcaId, setNovoModeloMarcaId] = useState('');
  const [novoModeloNome, setNovoModeloNome] = useState('');
  const [editingModeloId, setEditingModeloId] = useState<string | null>(null);
  const [editModeloMarcaId, setEditModeloMarcaId] = useState('');
  const [editModeloNome, setEditModeloNome] = useState('');

  const persist = async (updated: CatalogoVeiculos) => {
    setSaving(true);
    try {
      const ok = await saveCatalogo(updated);
      if (!ok) {
        toast.error('Erro ao salvar. Verifique sua conexão.');
      } else {
        onCatalogoChange(updated);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Marcas CRUD ──────────────────────────────────────────────────────────────

  const addMarca = async () => {
    const nome = novaMarca.trim();
    if (!nome) return;
    const updated: CatalogoVeiculos = {
      ...catalogo,
      marcas: [...catalogo.marcas, { id: crypto.randomUUID(), nome }],
    };
    await persist(updated);
    setNovaMarca('');
    toast.success('Marca cadastrada com sucesso');
  };

  const startEditMarca = (marca: MarcaVeiculo) => {
    setEditingMarcaId(marca.id);
    setEditMarcaNome(marca.nome);
  };

  const saveEditMarca = async () => {
    const nome = editMarcaNome.trim();
    if (!nome || !editingMarcaId) return;
    const updated: CatalogoVeiculos = {
      ...catalogo,
      marcas: catalogo.marcas.map(m => m.id === editingMarcaId ? { ...m, nome } : m),
    };
    await persist(updated);
    setEditingMarcaId(null);
    toast.success('Marca atualizada com sucesso');
  };

  const deleteMarca = async (id: string) => {
    const updated: CatalogoVeiculos = {
      marcas: catalogo.marcas.filter(m => m.id !== id),
      modelos: catalogo.modelos.filter(m => m.marcaId !== id),
    };
    await persist(updated);
    toast.success('Marca removida');
  };

  // ── Modelos CRUD ─────────────────────────────────────────────────────────────

  const addModelo = async () => {
    const modelo = novoModeloNome.trim();
    if (!modelo || !novoModeloMarcaId) return;
    const updated: CatalogoVeiculos = {
      ...catalogo,
      modelos: [...catalogo.modelos, { id: crypto.randomUUID(), marcaId: novoModeloMarcaId, modelo }],
    };
    await persist(updated);
    setNovoModeloNome('');
    toast.success('Modelo cadastrado com sucesso');
  };

  const startEditModelo = (mod: ModeloVeiculo) => {
    setEditingModeloId(mod.id);
    setEditModeloMarcaId(mod.marcaId);
    setEditModeloNome(mod.modelo);
  };

  const saveEditModelo = async () => {
    const modelo = editModeloNome.trim();
    if (!modelo || !editingModeloId || !editModeloMarcaId) return;
    const updated: CatalogoVeiculos = {
      ...catalogo,
      modelos: catalogo.modelos.map(m =>
        m.id === editingModeloId ? { ...m, marcaId: editModeloMarcaId, modelo } : m
      ),
    };
    await persist(updated);
    setEditingModeloId(null);
    toast.success('Modelo atualizado com sucesso');
  };

  const deleteModelo = async (id: string) => {
    const updated: CatalogoVeiculos = {
      ...catalogo,
      modelos: catalogo.modelos.filter(m => m.id !== id),
    };
    await persist(updated);
    toast.success('Modelo removido');
  };

  const getMarcaNome = (marcaId: string) =>
    catalogo.marcas.find(m => m.id === marcaId)?.nome ?? '—';

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col overflow-hidden p-0">
        <SheetHeader
          className="px-6 py-4 border-b flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)' }}
        >
          <SheetTitle className="text-white text-lg font-bold">
            Cadastro de Veículos
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Tabs defaultValue="marcas">
            <TabsList className="mb-5">
              <TabsTrigger value="marcas">Marcas</TabsTrigger>
              <TabsTrigger value="modelos">Modelos</TabsTrigger>
            </TabsList>

            {/* ── MARCAS ──────────────────────────────────────────────────── */}
            <TabsContent value="marcas">
              <div className="flex gap-2 mb-5">
                <Input
                  placeholder="Nome da marca..."
                  value={novaMarca}
                  onChange={e => setNovaMarca(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addMarca(); }}
                  className="flex-1"
                />
                <Button
                  onClick={addMarca}
                  disabled={saving || !novaMarca.trim()}
                  size="sm"
                  style={{ background: '#1f2937' }}
                  className="text-white hover:opacity-90"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#1f2937' }}>
                      <th className="text-white text-left px-4 py-3 text-xs font-semibold">Marca</th>
                      <th className="text-white text-center px-4 py-3 text-xs font-semibold w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogo.marcas.length === 0 && (
                      <tr>
                        <td colSpan={2} className="text-center text-slate-400 text-xs py-8">
                          Nenhuma marca cadastrada
                        </td>
                      </tr>
                    )}
                    {catalogo.marcas.map((marca, idx) => (
                      <tr key={marca.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-2 text-xs text-slate-700">
                          {editingMarcaId === marca.id ? (
                            <Input
                              value={editMarcaNome}
                              onChange={e => setEditMarcaNome(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEditMarca();
                                if (e.key === 'Escape') setEditingMarcaId(null);
                              }}
                              className="h-7 text-xs"
                              autoFocus
                            />
                          ) : (
                            marca.nome
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-center gap-1.5">
                            {editingMarcaId === marca.id ? (
                              <>
                                <button
                                  onClick={saveEditMarca}
                                  disabled={saving}
                                  className="text-green-600 hover:text-green-700 p-1 rounded transition-colors"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingMarcaId(null)}
                                  className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditMarca(marca)}
                                  className="text-blue-500 hover:text-blue-700 p-1 rounded transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteMarca(marca.id)}
                                  className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ── MODELOS ─────────────────────────────────────────────────── */}
            <TabsContent value="modelos">
              <div className="flex gap-2 mb-5">
                <select
                  value={novoModeloMarcaId}
                  onChange={e => setNovoModeloMarcaId(e.target.value)}
                  className="flex-1 border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  <option value="">Selecione a marca...</option>
                  {catalogo.marcas.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
                <Input
                  placeholder="Nome do modelo..."
                  value={novoModeloNome}
                  onChange={e => setNovoModeloNome(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addModelo(); }}
                  className="flex-1"
                />
                <Button
                  onClick={addModelo}
                  disabled={saving || !novoModeloNome.trim() || !novoModeloMarcaId}
                  size="sm"
                  style={{ background: '#1f2937' }}
                  className="text-white hover:opacity-90"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {catalogo.marcas.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
                  Cadastre ao menos uma marca antes de adicionar modelos.
                </p>
              )}

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#1f2937' }}>
                      <th className="text-white text-left px-4 py-3 text-xs font-semibold">Marca</th>
                      <th className="text-white text-left px-4 py-3 text-xs font-semibold">Modelo</th>
                      <th className="text-white text-center px-4 py-3 text-xs font-semibold w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogo.modelos.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center text-slate-400 text-xs py-8">
                          Nenhum modelo cadastrado
                        </td>
                      </tr>
                    )}
                    {catalogo.modelos.map((mod, idx) => (
                      <tr key={mod.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-2 text-xs text-slate-700">
                          {editingModeloId === mod.id ? (
                            <select
                              value={editModeloMarcaId}
                              onChange={e => setEditModeloMarcaId(e.target.value)}
                              className="w-full border rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-gray-400"
                            >
                              {catalogo.marcas.map(m => (
                                <option key={m.id} value={m.id}>{m.nome}</option>
                              ))}
                            </select>
                          ) : (
                            getMarcaNome(mod.marcaId)
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-700">
                          {editingModeloId === mod.id ? (
                            <Input
                              value={editModeloNome}
                              onChange={e => setEditModeloNome(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEditModelo();
                                if (e.key === 'Escape') setEditingModeloId(null);
                              }}
                              className="h-7 text-xs"
                              autoFocus
                            />
                          ) : (
                            mod.modelo
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-center gap-1.5">
                            {editingModeloId === mod.id ? (
                              <>
                                <button
                                  onClick={saveEditModelo}
                                  disabled={saving}
                                  className="text-green-600 hover:text-green-700 p-1 rounded transition-colors"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingModeloId(null)}
                                  className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditModelo(mod)}
                                  className="text-blue-500 hover:text-blue-700 p-1 rounded transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteModelo(mod.id)}
                                  className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
