import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Tag } from 'lucide-react';
import { toast } from 'sonner';
import type { DuplicatasMarca } from './DuplicatasReceberDashboard';
import {
  DEPARTAMENTOS,
  getAvailableMonths,
  getDuplicatas,
  getDepartamentoMap,
  saveDepartamentoMap,
  type DepartamentoCustom,
  type DepartamentoMap,
} from './duplicatasStorage';
import { distinctDepartamentosArquivo } from './duplicatasAnalise';

interface Props {
  marca: DuplicatasMarca;
}

interface DeptArquivo {
  numero: string;
  nome: string;
  qtd: number;
}

const brInteger = new Intl.NumberFormat('pt-BR');

export function DepartamentosTab({ marca }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [depts, setDepts] = useState<DeptArquivo[]>([]);
  const [map, setMap] = useState<DepartamentoMap>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const months = await getAvailableMonths(marca.id);
      const imports = await Promise.all(months.map((m) => getDuplicatas(marca.id, m)));
      const merged = new Map<string, DeptArquivo>();
      for (const imp of imports) {
        if (!imp) continue;
        for (const d of distinctDepartamentosArquivo(imp)) {
          const acc = merged.get(d.numero);
          if (acc) {
            acc.qtd += d.qtd;
            if (!acc.nome && d.nome) acc.nome = d.nome;
          } else {
            merged.set(d.numero, { ...d });
          }
        }
      }
      const list = Array.from(merged.values()).sort((a, b) =>
        a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }),
      );
      setDepts(list);
      setMap(await getDepartamentoMap(marca.id));
    } finally {
      setLoading(false);
    }
  }, [marca.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (numero: string, value: string) => {
    setMap((prev) => {
      const next = { ...prev };
      if (!value) delete next[numero];
      else next[numero] = value as DepartamentoCustom;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ok = await saveDepartamentoMap(marca.id, map);
      if (ok) toast.success('Classificação de departamentos salva.');
      else toast.error('Não foi possível salvar a classificação.');
    } finally {
      setSaving(false);
    }
  };

  const { classificados, naoClassificados } = useMemo(() => {
    let c = 0;
    for (const d of depts) if (map[d.numero]) c += 1;
    return { classificados: c, naoClassificados: depts.length - c };
  }, [depts, map]);

  return (
    <div className="mt-4 space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: marca.primaryLight, color: marca.primary }}
            >
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Classificação de Departamentos — {marca.name}</h3>
              <p className="text-xs text-slate-500">
                Classifique cada departamento do arquivo em um dos grupos abaixo. A classificação vale para todos os meses
                importados desta marca.
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
            Salvar classificação
          </button>
        </div>
        {!loading && depts.length > 0 && (
          <p className="text-xs text-slate-500 mt-3">
            {brInteger.format(classificados)} classificados · {brInteger.format(naoClassificados)} não classificados
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando...
        </div>
      ) : depts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm py-16 text-center">
          <p className="text-slate-600 font-medium">Nenhum departamento encontrado.</p>
          <p className="text-sm text-slate-400 mt-1">Importe um arquivo de duplicatas para listar os departamentos.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[62vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-left font-semibold text-white px-3 py-2 whitespace-nowrap" style={{ backgroundColor: marca.primary }}>
                    Departamento (arquivo)
                  </th>
                  <th className="text-left font-semibold text-white px-3 py-2 whitespace-nowrap" style={{ backgroundColor: marca.primary }}>
                    Nome no arquivo
                  </th>
                  <th className="text-right font-semibold text-white px-3 py-2 whitespace-nowrap" style={{ backgroundColor: marca.primary }}>
                    Duplicatas
                  </th>
                  <th className="text-left font-semibold text-white px-3 py-2 whitespace-nowrap" style={{ backgroundColor: marca.primary }}>
                    Classificar como
                  </th>
                </tr>
              </thead>
              <tbody>
                {depts.map((d, i) => (
                  <tr key={d.numero} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap border-b border-slate-100 font-medium">{d.numero}</td>
                    <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap border-b border-slate-100">{d.nome || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-700 text-right tabular-nums whitespace-nowrap border-b border-slate-100">
                      {brInteger.format(d.qtd)}
                    </td>
                    <td className="px-3 py-1.5 border-b border-slate-100">
                      <select
                        value={map[d.numero] ?? ''}
                        onChange={(e) => handleChange(d.numero, e.target.value)}
                        className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 w-full max-w-[220px]"
                        style={{ ['--tw-ring-color' as string]: marca.primary }}
                      >
                        <option value="">— não classificado —</option>
                        {DEPARTAMENTOS.map((dep) => (
                          <option key={dep} value={dep}>{dep}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
