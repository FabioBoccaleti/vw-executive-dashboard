import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Save, Plus, X, AlertCircle, Landmark } from 'lucide-react';
import {
  getControleVeiculos,
  extractVehicleTable,
} from './controleVeiculosStorage';
import {
  getRegras,
  setRegras,
  EMPTY_REGRAS,
  type ControleVeiculosRegras,
  type BaseAnoColuna,
} from './controleVeiculosRegrasStorage';

type Banco = 'itau' | 'volks';

const BASE_ANO_OPCOES: { value: BaseAnoColuna; label: string }[] = [
  { value: 'fab', label: 'Fabricação (Fab)' },
  { value: 'mod', label: 'Modelo (Mod.)' },
];

const BANCOS: { value: Banco; label: string }[] = [
  { value: 'itau', label: 'Banco Itau' },
  { value: 'volks', label: 'Banco Volks' },
];

export function RegrasTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banco, setBanco] = useState<Banco>('itau');
  const [regras, setRegrasState] = useState<ControleVeiculosRegras>(EMPTY_REGRAS);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [novaSituacao, setNovaSituacao] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [loadedRegras, vwData, audiData] = await Promise.all([
        getRegras(),
        getControleVeiculos('vw'),
        getControleVeiculos('audi'),
      ]);
      if (cancelled) return;
      setRegrasState(loadedRegras);

      // Colunas disponíveis = união dos cabeçalhos dos arquivos importados (exceto Sit).
      const cols: string[] = [];
      for (const data of [vwData, audiData]) {
        const table = extractVehicleTable(data);
        if (!table) continue;
        table.headers.forEach((header, index) => {
          if (index === table.sitIndex) return;
          if (header && !cols.includes(header)) cols.push(header);
        });
      }
      setAvailableColumns(cols);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const anoValue = banco === 'itau' ? regras.anoItau : regras.anoVolks;
  const baseValue = banco === 'itau' ? regras.baseAnoItau : regras.baseAnoVolks;

  function setAno(value: number | null) {
    setRegrasState(prev =>
      banco === 'itau' ? { ...prev, anoItau: value } : { ...prev, anoVolks: value },
    );
  }

  function setBase(value: BaseAnoColuna) {
    setRegrasState(prev =>
      banco === 'itau' ? { ...prev, baseAnoItau: value } : { ...prev, baseAnoVolks: value },
    );
  }

  function addSituacao() {
    const value = novaSituacao.trim();
    if (!value) return;
    setRegrasState(prev =>
      prev.situacoes.some(s => s.toLowerCase() === value.toLowerCase())
        ? prev
        : { ...prev, situacoes: [...prev.situacoes, value] },
    );
    setNovaSituacao('');
  }

  function removeSituacao(value: string) {
    setRegrasState(prev => ({ ...prev, situacoes: prev.situacoes.filter(s => s !== value) }));
  }

  function toggleColuna(coluna: string) {
    setRegrasState(prev =>
      prev.colunas.includes(coluna)
        ? { ...prev, colunas: prev.colunas.filter(c => c !== coluna) }
        : { ...prev, colunas: [...prev.colunas, coluna] },
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const ok = await setRegras(regras);
      if (ok) toast.success('Regras salvas com sucesso.');
      else toast.error('Erro ao salvar as regras.');
    } finally {
      setSaving(false);
    }
  }

  const bancoLabel = useMemo(() => BANCOS.find(b => b.value === banco)?.label ?? '', [banco]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-slate-400">
        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Carregando regras...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 overflow-auto p-4 md:p-6">
      <div className="bg-white rounded-lg shadow-sm max-w-4xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700">Regras — Controle de Veículos</h2>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-sky-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />{saving ? 'Salvando...' : 'Salvar regras'}
          </button>
        </div>

        {/* Sub-abas por banco */}
        <div className="flex border-b border-slate-200 px-4 md:px-6">
          {BANCOS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setBanco(value)}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                banco === value ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6 space-y-8">
          {/* Regra de ano (por banco) */}
          <section>
            <div className="flex items-center gap-2 mb-1">
              <Landmark className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-700">Ano a partir de — {bancoLabel}</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Ano a partir do qual os veículos ficam disponíveis para inclusão. (O filtro por ano será aplicado posteriormente.)
            </p>
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Ano a partir de</label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex.: 2015"
                  value={anoValue ?? ''}
                  onChange={e => {
                    const raw = e.target.value.trim();
                    setAno(raw === '' ? null : Number(raw));
                  }}
                  className="w-40 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Considerar o ano da coluna</label>
                <div className="inline-flex rounded border border-slate-300 overflow-hidden">
                  {BASE_ANO_OPCOES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBase(value)}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${
                        baseValue === value ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="border-t border-slate-100" />

          {/* Regra geral — vale para ambos os bancos */}
          <section>
            <h3 className="text-sm font-bold text-slate-700">Situações (Sit) que devem aparecer</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              Aplicável a ambos os bancos. Apenas veículos com estas situações serão listados em “Veículos Disponíveis”.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={novaSituacao}
                onChange={e => setNovaSituacao(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSituacao(); } }}
                placeholder="Ex.: ER"
                className="w-40 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
              <button
                onClick={addSituacao}
                className="inline-flex items-center gap-1 border border-sky-300 text-sky-700 rounded px-3 py-2 text-sm font-medium hover:bg-sky-50"
              >
                <Plus className="w-4 h-4" />Adicionar
              </button>
            </div>
            {regras.situacoes.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-3">
                {regras.situacoes.map(sit => (
                  <span key={sit} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 rounded-full pl-3 pr-1.5 py-1 text-xs font-medium">
                    {sit}
                    <button onClick={() => removeSituacao(sit)} className="text-slate-400 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-3">Nenhuma situação cadastrada.</p>
            )}
          </section>

          <div className="border-t border-slate-100" />

          {/* Colunas que devem aparecer */}
          <section>
            <h3 className="text-sm font-bold text-slate-700">Colunas que devem aparecer</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              Aplicável a ambos os bancos. Marque as colunas do arquivo importado que devem ser exibidas (a coluna “Sit” sempre aparece).
            </p>
            {availableColumns.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-3">
                <AlertCircle className="w-4 h-4 text-slate-400" />
                Importe um arquivo em “Importar Arquivo” para listar as colunas disponíveis.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {availableColumns.map(coluna => (
                  <label key={coluna} className="flex items-center gap-2 text-sm text-slate-700 border border-slate-200 rounded px-3 py-2 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={regras.colunas.includes(coluna)}
                      onChange={() => toggleColuna(coluna)}
                      className="accent-sky-600"
                    />
                    <span className="truncate" title={coluna}>{coluna}</span>
                  </label>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
