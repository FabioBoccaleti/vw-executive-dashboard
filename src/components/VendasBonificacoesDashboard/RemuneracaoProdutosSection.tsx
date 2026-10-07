import { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, RefreshCw, Boxes, Trash2, Layers, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { loadProdutosMonitoradosCodes } from './produtosMonitoradosStorage';
import {
  loadRemuneracaoProdutos,
  saveRemuneracaoProdutos,
  type RemuneracaoProdutosMap,
  type TipoRemuneracao,
} from './remuneracaoProdutosStorage';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseNum(val: string): number {
  const n = parseFloat(val.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? NaN : n;
}

function fmtValor(tipo: TipoRemuneracao, val: string): string {
  const n = parseNum(val);
  if (isNaN(n)) return '—';
  if (tipo === 'premio') {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

const TIPOS: { id: TipoRemuneracao; label: string }[] = [
  { id: 'premio', label: 'Prêmio (R$)' },
  { id: 'comissao', label: 'Comissão (%)' },
];

// ─── Componente ───────────────────────────────────────────────────────────────
export function RemuneracaoProdutosSection() {
  const [codes, setCodes] = useState<string[]>([]);
  const [map, setMap] = useState<RemuneracaoProdutosMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Painel "Aplicar a todos"
  const [bulkTipo, setBulkTipo] = useState<TipoRemuneracao>('comissao');
  const [bulkValor, setBulkValor] = useState('');

  useEffect(() => {
    Promise.all([loadProdutosMonitoradosCodes(), loadRemuneracaoProdutos()]).then(([c, m]) => {
      setCodes(c);
      setMap(m);
      setLoading(false);
    });
  }, []);

  const configuradosCount = useMemo(
    () => codes.filter(c => map[c] && map[c].valor.trim() !== '').length,
    [codes, map]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Persiste apenas produtos que ainda são monitorados e têm valor preenchido.
      const clean: RemuneracaoProdutosMap = {};
      codes.forEach(c => {
        const e = map[c];
        if (e && e.valor.trim() !== '') clean[c] = { tipo: e.tipo, valor: e.valor.trim() };
      });
      await saveRemuneracaoProdutos(clean);
      setMap(prev => ({ ...prev, ...clean }));
      setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      toast.success('Remunerações salvas.');
    } catch (err) {
      toast.error(`Erro ao salvar: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }, [codes, map]);

  function setTipo(code: string, tipo: TipoRemuneracao) {
    setMap(prev => ({ ...prev, [code]: { tipo, valor: prev[code]?.valor ?? '' } }));
  }

  function setValor(code: string, valor: string) {
    setMap(prev => ({ ...prev, [code]: { tipo: prev[code]?.tipo ?? 'comissao', valor } }));
  }

  function clearProduto(code: string) {
    setMap(prev => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  }

  function applyToAll() {
    if (bulkValor.trim() === '') {
      toast.warning('Informe o valor para aplicar a todos.');
      return;
    }
    setMap(() => {
      const next: RemuneracaoProdutosMap = {};
      codes.forEach(c => { next[c] = { tipo: bulkTipo, valor: bulkValor.trim() }; });
      return next;
    });
    toast.success(`Aplicado a ${codes.length} produto(s). Clique em Salvar para confirmar.`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner informativo */}
      <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs text-violet-800">
        <Boxes className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Produtos sincronizados automaticamente a partir dos <strong>Códigos Monitorados</strong> em{' '}
          <strong>Registros → Registro de Vendas → Produtos</strong>. Novos produtos cadastrados lá aparecem
          aqui automaticamente.
        </span>
      </div>

      {/* Painel: Aplicar a todos */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-bold text-slate-700">Aplicar a todos os produtos</h3>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Define a mesma remuneração para todos os produtos de uma vez. Você ainda pode ajustar cada um individualmente abaixo.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo</label>
            <div className="flex rounded-lg border border-slate-300 overflow-hidden">
              {TIPOS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setBulkTipo(t.id)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    bulkTipo === t.id ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              {bulkTipo === 'premio' ? 'Valor (R$)' : 'Percentual (%)'}
            </label>
            <div className="flex items-center gap-1.5">
              {bulkTipo === 'premio' && <span className="text-sm text-slate-500">R$</span>}
              <input
                type="text"
                inputMode="decimal"
                value={bulkValor}
                onChange={e => setBulkValor(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') applyToAll(); }}
                placeholder="0,00"
                className="w-28 border border-slate-300 rounded px-2.5 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
              {bulkTipo === 'comissao' && <span className="text-sm text-slate-500">%</span>}
            </div>
          </div>
          <Button
            size="sm"
            className="bg-violet-600 hover:bg-violet-700 text-white"
            onClick={applyToAll}
          >
            Aplicar a todos
          </Button>
        </div>
      </section>

      {/* Lista de produtos */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-700">Produtos</h3>
          <span className="text-xs text-slate-400">
            {configuradosCount} de {codes.length} com remuneração
          </span>
        </div>

        {codes.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            Nenhum produto monitorado. Cadastre códigos em Registros → Registro de Vendas → Produtos.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400 bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-2.5 font-semibold">Produto</th>
                <th className="px-5 py-2.5 font-semibold">Tipo de remuneração</th>
                <th className="px-5 py-2.5 font-semibold text-right">Valor</th>
                <th className="px-5 py-2.5 font-semibold text-right">Resumo</th>
                <th className="px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {codes.map(code => {
                const entry = map[code];
                const tipo = entry?.tipo;
                const valor = entry?.valor ?? '';
                return (
                  <tr key={code} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <span className="font-mono font-semibold text-violet-800">{code}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex rounded-lg border border-slate-300 overflow-hidden w-max">
                        {TIPOS.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setTipo(code, t.id)}
                            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                              tipo === t.id ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {tipo === 'premio' && <span className="text-sm text-slate-500">R$</span>}
                        <input
                          type="text"
                          inputMode="decimal"
                          value={valor}
                          disabled={!tipo}
                          onChange={e => setValor(code, e.target.value)}
                          placeholder={tipo ? '0,00' : 'Selecione o tipo'}
                          className="w-28 border border-slate-300 rounded px-2.5 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:placeholder:text-slate-300"
                        />
                        {tipo === 'comissao' && <span className="text-sm text-slate-500">%</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {tipo && valor.trim() !== '' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {fmtValor(tipo, valor)}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">não cadastrado</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-right">
                      {entry && (
                        <button
                          onClick={() => clearProduto(code)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                          title="Limpar remuneração deste produto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Ações */}
      <div className="flex items-center justify-end gap-3">
        {savedAt && <span className="text-xs text-slate-400">Salvo às {savedAt}</span>}
        <Button
          className="bg-slate-800 hover:bg-slate-900 text-white flex items-center gap-2"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
