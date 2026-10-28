import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Save, Landmark, CreditCard } from 'lucide-react';
import {
  getRegras,
  EMPTY_REGRAS,
  type ControleVeiculosRegras,
} from './controleVeiculosRegrasStorage';
import {
  getLimites,
  setLimites,
  ABATER_JUROS_DEFAULT,
} from './controleVeiculosLimitesStorage';
import {
  listGarantia,
  type VeiculoGarantiaEntry,
} from './veiculosGarantiaStorage';
import { fmtBRL, parseNum } from './estoqueUsadosStorage';
import { todayISO, diffDaysISO, estimativaJuros } from './controleVeiculosCalc';

/** Soma o valor de garantia e a provisão de juros de uma lista de veículos. */
function somarTotais(entries: VeiculoGarantiaEntry[], taxaPct: number | null): { utilizado: number; juros: number } {
  let utilizado = 0;
  let juros = 0;
  entries.forEach(entry => {
    utilizado += entry.valorGarantia;
    const dias = diffDaysISO(entry.dataInclusao, todayISO());
    const j = estimativaJuros(entry.valorGarantia, taxaPct, dias);
    if (j != null) juros += j;
  });
  return { utilizado, juros };
}

/** Saldo disponível = Limite − Utilizado − (abater ? Juros : 0). */
function calcSaldo(limite: number | null, utilizado: number, juros: number, abater: boolean): number {
  return (limite ?? 0) - utilizado - (abater ? juros : 0);
}

function CurrencyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1 border border-slate-300 rounded px-2 py-1 w-36 focus-within:ring-2 focus-within:ring-sky-200">
      <span className="text-xs text-slate-400">R$</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0,00"
        className="flex-1 min-w-0 text-sm text-right focus:outline-none"
      />
    </div>
  );
}

function AbaterToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex rounded border border-slate-300 overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-1 text-xs font-medium transition-colors ${value ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
      >
        Sim
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-1 text-xs font-medium transition-colors ${!value ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
      >
        Não
      </button>
    </div>
  );
}

function Saldo({ value }: { value: number }) {
  return (
    <span className={value < 0 ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
      R$ {fmtBRL(value)}
    </span>
  );
}

const TH = 'border border-slate-200 px-3 py-2 text-left whitespace-nowrap bg-sky-50 font-semibold';
const TD = 'border border-slate-200 px-3 py-2 whitespace-nowrap';

export function CadastroLimitesTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regras, setRegras] = useState<ControleVeiculosRegras>(EMPTY_REGRAS);
  const [garantiaItau, setGarantiaItau] = useState<VeiculoGarantiaEntry[]>([]);
  const [garantiaVolks, setGarantiaVolks] = useState<VeiculoGarantiaEntry[]>([]);

  const [limiteItauInput, setLimiteItauInput] = useState('');
  const [abaterItau, setAbaterItau] = useState(ABATER_JUROS_DEFAULT);
  const [limitesVolksInput, setLimitesVolksInput] = useState<Record<string, string>>({});
  const [abaterVolks, setAbaterVolks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [loadedRegras, loadedLimites, itau, volks] = await Promise.all([
        getRegras(),
        getLimites(),
        listGarantia('itau'),
        listGarantia('volks'),
      ]);
      if (cancelled) return;
      setRegras(loadedRegras);
      setGarantiaItau(itau);
      setGarantiaVolks(volks);
      setLimiteItauInput(loadedLimites.limiteItau != null ? fmtBRL(loadedLimites.limiteItau) : '');
      setAbaterItau(loadedLimites.abaterJurosItau);
      const volksInputs: Record<string, string> = {};
      const volksAbater: Record<string, boolean> = {};
      loadedRegras.linhasCreditoDNVolks.forEach(dn => {
        const v = loadedLimites.limitesVolksPorDN[dn];
        volksInputs[dn] = v != null ? fmtBRL(v) : '';
        volksAbater[dn] = loadedLimites.abaterJurosVolksPorDN[dn] ?? ABATER_JUROS_DEFAULT;
      });
      setLimitesVolksInput(volksInputs);
      setAbaterVolks(volksAbater);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const dns = regras.linhasCreditoDNVolks;

  // Banco Itaú (linha única).
  const itauCalc = useMemo(() => {
    const { utilizado, juros } = somarTotais(garantiaItau, regras.taxaJurosItau);
    const limite = limiteItauInput.trim() === '' ? null : parseNum(limiteItauInput);
    return { limite, utilizado, juros, saldo: calcSaldo(limite, utilizado, juros, abaterItau) };
  }, [garantiaItau, regras.taxaJurosItau, limiteItauInput, abaterItau]);

  // Banco Volks por DN.
  const volksCalc = useMemo(() => {
    return dns.map(dn => {
      const entries = garantiaVolks.filter(e => e.linhaCreditoDN === dn);
      const { utilizado, juros } = somarTotais(entries, regras.taxaJurosVolks);
      const limite = (limitesVolksInput[dn] ?? '').trim() === '' ? null : parseNum(limitesVolksInput[dn]);
      const abater = abaterVolks[dn] ?? ABATER_JUROS_DEFAULT;
      return { dn, limite, utilizado, juros, abater, saldo: calcSaldo(limite, utilizado, juros, abater) };
    });
  }, [dns, garantiaVolks, regras.taxaJurosVolks, limitesVolksInput, abaterVolks]);

  const volksTotal = useMemo(() => {
    return volksCalc.reduce(
      (acc, r) => ({
        limite: acc.limite + (r.limite ?? 0),
        utilizado: acc.utilizado + r.utilizado,
        juros: acc.juros + r.juros,
        saldo: acc.saldo + r.saldo,
      }),
      { limite: 0, utilizado: 0, juros: 0, saldo: 0 },
    );
  }, [volksCalc]);

  async function handleSave() {
    setSaving(true);
    try {
      const limiteItau = limiteItauInput.trim() === '' ? null : parseNum(limiteItauInput);
      const limitesVolksPorDN: Record<string, number> = {};
      const abaterJurosVolksPorDN: Record<string, boolean> = {};
      dns.forEach(dn => {
        const s = (limitesVolksInput[dn] ?? '').trim();
        if (s !== '') limitesVolksPorDN[dn] = parseNum(s);
        abaterJurosVolksPorDN[dn] = abaterVolks[dn] ?? ABATER_JUROS_DEFAULT;
      });
      const ok = await setLimites({
        limiteItau,
        abaterJurosItau: abaterItau,
        limitesVolksPorDN,
        abaterJurosVolksPorDN,
      });
      if (ok) toast.success('Limites salvos com sucesso.');
      else toast.error('Erro ao salvar os limites.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-slate-400">
        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Carregando limites...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 overflow-auto p-4 md:p-6">
      <div className="bg-white rounded-lg shadow-sm max-w-5xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700">Cadastro de Limites — Linhas de Crédito</h2>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-sky-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />{saving ? 'Salvando...' : 'Salvar limites'}
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-8">
          {/* Banco Itaú */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Landmark className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-700">Banco Itaú</h3>
            </div>
            <div className="overflow-auto border border-slate-200 rounded">
              <table className="min-w-max w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>Linha de Crédito</th>
                    <th className={TH}>Limite</th>
                    <th className={`${TH} text-right`}>Limite Utilizado</th>
                    <th className={`${TH} text-right`}>Provisão de Juros</th>
                    <th className={TH}>Abater juros no saldo</th>
                    <th className={`${TH} text-right`}>Saldo Disponível</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className={`${TD} font-medium`}>Banco Itaú</td>
                    <td className={TD}>
                      <CurrencyInput value={limiteItauInput} onChange={setLimiteItauInput} />
                    </td>
                    <td className={`${TD} text-right`}>R$ {fmtBRL(itauCalc.utilizado)}</td>
                    <td className={`${TD} text-right`}>R$ {fmtBRL(itauCalc.juros)}</td>
                    <td className={TD}>
                      <AbaterToggle value={abaterItau} onChange={setAbaterItau} />
                    </td>
                    <td className={`${TD} text-right`}><Saldo value={itauCalc.saldo} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <div className="border-t border-slate-100" />

          {/* Banco Volks (por DN) */}
          <section>
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-700">Banco Volks — por Linha de Crédito (DN)</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Um limite por DN. O limite utilizado e a provisão de juros consideram apenas os veículos em garantia com o DN correspondente.
            </p>
            {dns.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded">
                Nenhuma linha de crédito (DN) cadastrada. Cadastre em <span className="font-semibold">Regras → Banco Volks</span>.
              </div>
            ) : (
              <div className="overflow-auto border border-slate-200 rounded">
                <table className="min-w-max w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className={TH}>DN</th>
                      <th className={TH}>Limite</th>
                      <th className={`${TH} text-right`}>Limite Utilizado</th>
                      <th className={`${TH} text-right`}>Provisão de Juros</th>
                      <th className={TH}>Abater juros no saldo</th>
                      <th className={`${TH} text-right`}>Saldo Disponível</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volksCalc.map(row => (
                      <tr key={row.dn} className="odd:bg-white even:bg-slate-50">
                        <td className={`${TD} font-medium`}>{row.dn}</td>
                        <td className={TD}>
                          <CurrencyInput
                            value={limitesVolksInput[row.dn] ?? ''}
                            onChange={v => setLimitesVolksInput(prev => ({ ...prev, [row.dn]: v }))}
                          />
                        </td>
                        <td className={`${TD} text-right`}>R$ {fmtBRL(row.utilizado)}</td>
                        <td className={`${TD} text-right`}>R$ {fmtBRL(row.juros)}</td>
                        <td className={TD}>
                          <AbaterToggle
                            value={row.abater}
                            onChange={v => setAbaterVolks(prev => ({ ...prev, [row.dn]: v }))}
                          />
                        </td>
                        <td className={`${TD} text-right`}><Saldo value={row.saldo} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-sky-100 font-semibold text-slate-700">
                      <td className={TD}>Total (Banco Volks)</td>
                      <td className={`${TD} text-right`}>R$ {fmtBRL(volksTotal.limite)}</td>
                      <td className={`${TD} text-right`}>R$ {fmtBRL(volksTotal.utilizado)}</td>
                      <td className={`${TD} text-right`}>R$ {fmtBRL(volksTotal.juros)}</td>
                      <td className={`${TD} text-center text-slate-400`}>—</td>
                      <td className={`${TD} text-right`}><Saldo value={volksTotal.saldo} /></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
