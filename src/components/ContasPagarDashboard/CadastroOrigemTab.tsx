import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Save, ListChecks, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { ContasPagarMarca } from './ContasPagarDashboard';
import {
  getAvailableMonths,
  getDuplicatas,
  getOrigemMap,
  saveOrigemMap,
  type OrigemMap,
} from './contasPagarStorage';
import { distinctOrigensArquivo } from './contasPagarAnalise';

interface Props {
  marca: ContasPagarMarca;
}

interface OrigemArquivo {
  numero: string;
  nome: string;
  qtd: number;
}

const brInteger = new Intl.NumberFormat('pt-BR');

export function CadastroOrigemTab({ marca }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [origens, setOrigens] = useState<OrigemArquivo[]>([]);
  const [map, setMap] = useState<OrigemMap>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const months = await getAvailableMonths(marca.id);
      const imports = await Promise.all(months.map((m) => getDuplicatas(marca.id, m)));
      const merged = new Map<string, OrigemArquivo>();
      for (const imp of imports) {
        if (!imp) continue;
        for (const o of distinctOrigensArquivo(imp)) {
          const acc = merged.get(o.numero);
          if (acc) {
            acc.qtd += o.qtd;
            if (!acc.nome && o.nome) acc.nome = o.nome;
          } else {
            merged.set(o.numero, { ...o });
          }
        }
      }
      const list = Array.from(merged.values()).sort((a, b) =>
        a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }),
      );
      setOrigens(list);
      setMap(await getOrigemMap(marca.id));
    } finally {
      setLoading(false);
    }
  }, [marca.id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleOrigem = (numero: string, checked: boolean) => {
    setMap((prev) => {
      const next = { ...prev };
      if (checked) next[numero] = true;
      else delete next[numero];
      return next;
    });
  };

  const setTodas = (checked: boolean) => {
    setMap(() => {
      if (!checked) return {};
      const next: OrigemMap = {};
      for (const o of origens) next[o.numero] = true;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ok = await saveOrigemMap(marca.id, map);
      if (ok) toast.success('Cadastro de origens salvo.');
      else toast.error('Não foi possível salvar o cadastro de origens.');
    } finally {
      setSaving(false);
    }
  };

  const { cadastradas, pendentes } = useMemo(() => {
    let c = 0;
    for (const o of origens) if (map[o.numero]) c += 1;
    return { cadastradas: c, pendentes: origens.length - c };
  }, [origens, map]);

  const todasMarcadas = origens.length > 0 && cadastradas === origens.length;

  return (
    <div className="mt-4 space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: marca.primaryLight, color: marca.primary }}
            >
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Cadastro de origens — {marca.name}</h3>
              <p className="text-xs text-slate-500 max-w-2xl">
                Selecione as origens que devem aparecer na aba Análise. Apenas as origens cadastradas (marcadas) têm seus
                valores somados na análise. As não selecionadas ficam pendentes e são excluídas dos totais. O cadastro
                vale para todos os meses importados desta marca.
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: marca.primary }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar cadastro
          </button>
        </div>
        {!loading && origens.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> {brInteger.format(cadastradas)} cadastradas
            </span>
            <span className="inline-flex items-center gap-1 text-amber-600">
              <Clock className="w-3.5 h-3.5" /> {brInteger.format(pendentes)} pendentes
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando...
        </div>
      ) : origens.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm py-16 text-center">
          <p className="text-slate-600 font-medium">Nenhuma origem encontrada.</p>
          <p className="text-sm text-slate-400 mt-1">Importe um arquivo de contas a pagar para listar as origens.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[62vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-center font-semibold text-white px-3 py-2 whitespace-nowrap w-28" style={{ backgroundColor: marca.primary }}>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={todasMarcadas}
                        onChange={(e) => setTodas(e.target.checked)}
                        className="w-4 h-4 cursor-pointer"
                      />
                      Cadastrar
                    </label>
                  </th>
                  <th className="text-left font-semibold text-white px-3 py-2 whitespace-nowrap" style={{ backgroundColor: marca.primary }}>
                    Origem (número)
                  </th>
                  <th className="text-left font-semibold text-white px-3 py-2 whitespace-nowrap" style={{ backgroundColor: marca.primary }}>
                    Nome da origem
                  </th>
                  <th className="text-right font-semibold text-white px-3 py-2 whitespace-nowrap" style={{ backgroundColor: marca.primary }}>
                    Títulos
                  </th>
                  <th className="text-left font-semibold text-white px-3 py-2 whitespace-nowrap" style={{ backgroundColor: marca.primary }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {origens.map((o, i) => {
                  const cadastrada = !!map[o.numero];
                  return (
                    <tr key={o.numero} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-3 py-1.5 text-center border-b border-slate-100">
                        <input
                          type="checkbox"
                          checked={cadastrada}
                          onChange={(e) => toggleOrigem(o.numero, e.target.checked)}
                          className="w-4 h-4 cursor-pointer"
                          style={{ accentColor: marca.primary }}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap border-b border-slate-100 font-medium">{o.numero}</td>
                      <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap border-b border-slate-100">{o.nome || '—'}</td>
                      <td className="px-3 py-1.5 text-slate-700 text-right tabular-nums whitespace-nowrap border-b border-slate-100">
                        {brInteger.format(o.qtd)}
                      </td>
                      <td className="px-3 py-1.5 border-b border-slate-100">
                        {cadastrada ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Cadastrada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                            <Clock className="w-3.5 h-3.5" /> Pendente
                          </span>
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
    </div>
  );
}
