import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  EstoqueUsadosEntry, EstoqueUsadosMeta,
  saveEntry, loadEntry, saveMeta,
  EMPTY_FIELDS, fmtBRL, parseNum,
} from './estoqueUsadosStorage';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  meta: EstoqueUsadosMeta;
  initialDate?: string;
  onSaved: (entry: EstoqueUsadosEntry) => void;
  onMetaChanged: (meta: EstoqueUsadosMeta) => void;
}

type FieldKey = keyof Omit<EstoqueUsadosEntry, 'date' | 'updatedAt'>;

// ─── Campo de Moeda ───────────────────────────────────────────────────────────

function CurrencyField({
  label, fieldKey, values, onChange,
}: {
  label: string;
  fieldKey: FieldKey;
  values: Record<FieldKey, number>;
  onChange: (key: FieldKey, v: number) => void;
}) {
  const num = values[fieldKey];
  const [display, setDisplay] = useState(fmtBRL(num));

  // Sync display when value changes externally (e.g., on load)
  useEffect(() => { setDisplay(fmtBRL(num)); }, [num]);

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-700 pr-4 flex-1">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-slate-400">R$</span>
        <input
          type="text"
          inputMode="decimal"
          value={display}
          onFocus={e => { e.target.select(); setDisplay(num === 0 ? '' : String(num).replace('.', ',')); }}
          onChange={e => setDisplay(e.target.value)}
          onBlur={e => {
            const parsed = parseNum(e.target.value);
            onChange(fieldKey, parsed);
            setDisplay(fmtBRL(parsed));
          }}
          className="w-36 text-right text-sm border border-slate-200 rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent tabular-nums"
        />
      </div>
    </div>
  );
}

// ─── Seção do formulário ──────────────────────────────────────────────────────

function FormSection({
  cor, titulo, children,
}: {
  cor: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2" style={{ borderLeftColor: cor, borderLeftWidth: 3 }}>
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: cor }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cor }}>{titulo}</span>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

// ─── Modal de Meta ────────────────────────────────────────────────────────────

function MetaModal({
  meta, onSave, onClose,
}: {
  meta: EstoqueUsadosMeta;
  onSave: (m: EstoqueUsadosMeta) => void;
  onClose: () => void;
}) {
  const [vw, setVw]   = useState(fmtBRL(meta.metaVW));
  const [audi, setAudi] = useState(fmtBRL(meta.metaAudi));

  const handleSave = () => {
    onSave({ metaVW: parseNum(vw), metaAudi: parseNum(audi) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-base font-bold text-slate-800">Configurar Meta de Estoque</h3>
          <p className="text-xs text-slate-500 mt-0.5">Define o objetivo de valor máximo de estoque por marca.</p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">Meta VW (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={vw}
              onFocus={e => e.target.select()}
              onChange={e => setVw(e.target.value)}
              onBlur={e => setVw(fmtBRL(parseNum(e.target.value)))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-right tabular-nums"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">Meta Audi (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={audi}
              onFocus={e => e.target.select()}
              onChange={e => setAudi(e.target.value)}
              onBlur={e => setAudi(fmtBRL(parseNum(e.target.value)))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-right tabular-nums"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 font-medium">
            Salvar Meta
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function LancarDadosTab({ meta, initialDate, onSaved, onMetaChanged }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate]         = useState(initialDate ?? today);
  const [values, setValues]     = useState<Record<FieldKey, number>>({ ...EMPTY_FIELDS });
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [showMeta, setShowMeta] = useState(false);

  // Carrega entrada existente quando a data muda
  const loadForDate = useCallback(async (d: string) => {
    setLoading(true);
    const existing = await loadEntry(d);
    if (existing) {
      const { date: _d, updatedAt: _u, ...fields } = existing;
      // Merge com EMPTY_FIELDS para garantir que campos novos ausentes em dados antigos fiquem como 0
      setValues({ ...EMPTY_FIELDS, ...(fields as Record<FieldKey, number>) });
    } else {
      setValues({ ...EMPTY_FIELDS });
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadForDate(date); }, [date, loadForDate]);

  const handleChange = (key: FieldKey, v: number) => {
    setValues(prev => ({ ...prev, [key]: v }));
  };

  const handleSave = async () => {
    setSaving(true);
    const entry: EstoqueUsadosEntry = { date, updatedAt: Date.now(), ...values };
    const ok = await saveEntry(entry);
    setSaving(false);
    if (ok) {
      toast.success('Lançamento salvo com sucesso!');
      onSaved(entry);
    } else {
      toast.error('Erro ao salvar. Tente novamente.');
    }
  };

  const handleSaveMeta = async (m: EstoqueUsadosMeta) => {
    const ok = await saveMeta(m);
    if (ok) {
      toast.success('Meta atualizada!');
      onMetaChanged(m);
    } else {
      toast.error('Erro ao salvar meta.');
    }
    setShowMeta(false);
  };

  return (
    <div className="flex-1 bg-slate-50 overflow-auto">
      {showMeta && (
        <MetaModal meta={meta} onSave={handleSaveMeta} onClose={() => setShowMeta(false)} />
      )}

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        {/* Seleção de data + ações */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Data do lançamento
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            {loading && <span className="text-xs text-slate-400 animate-pulse mt-4">Carregando dados...</span>}
          </div>
          <button
            onClick={() => setShowMeta(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.653-4.655m5.24-6.029l-.79 2.895M5.28 8.28l2.895-.79M15 3h2.25M15 3v2.25M3 15h2.25M3 15v2.25" />
            </svg>
            Configurar Meta
          </button>
        </div>

        {/* ESTOQUE VW / OUTROS */}
        <FormSection cor="#001e50" titulo="ESTOQUE VW / OUTROS">
          <CurrencyField label="Estoque de Veículos Usados VW Pagos"    fieldKey="vwUsadosPagos"          values={values} onChange={handleChange} />
          <CurrencyField label="Estoque de Veículos Novos VW Pagos"     fieldKey="vwNovosPagos"           values={values} onChange={handleChange} />
          <CurrencyField label="Valores em Cheque VW"                   fieldKey="vwValoresCheque"        values={values} onChange={handleChange} />
          <CurrencyField label="Estoque Veículos Usados VW LM Vendido a Pagar"  fieldKey="vwUsadosLMaPagar"       values={values} onChange={handleChange} />
          <CurrencyField label="Veículos Usados Pendente de Entrada"    fieldKey="vwUsadosPendenteEntrada" values={values} onChange={handleChange} />
        </FormSection>

        {/* ESTOQUE AUDI / OUTROS */}
        <FormSection cor="#bb0a30" titulo="ESTOQUE AUDI / OUTROS">
          <CurrencyField label="Estoque de Veículos Usados Audi Pago"   fieldKey="audiUsadosPago"           values={values} onChange={handleChange} />
          <CurrencyField label="Estoque de Veículos Novos Audi Pagos"   fieldKey="audiNovosPagos"           values={values} onChange={handleChange} />
          <CurrencyField label="Veículos Usados Pendente de Entrada"    fieldKey="audiUsadosPendenteEntrada" values={values} onChange={handleChange} />
        </FormSection>

        {/* ESTOQUE A PAGAR VW */}
        <FormSection cor="#001e50" titulo="ESTOQUE A PAGAR VW">
          <div className="pb-1">
            <CurrencyField label="Estoque Veículos Usados VW LM a Pagar" fieldKey="vwUsadosLMVendidoaPagar" values={values} onChange={handleChange} />
          </div>
          {/* Campo informativo — destaque âmbar */}
          <div className="mx-0 mb-3 rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-amber-200 bg-amber-100/60 flex items-center gap-1">
              <svg className="w-3 h-3 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Informativo</span>
            </div>
            <div className="px-3">
              <CurrencyField label="Valores próximos do vencimento (em até 30 dias)" fieldKey="vwVencimento30Dias" values={values} onChange={handleChange} />
            </div>
          </div>
          <p className="text-xs text-amber-600 pb-3">ⓘ Este valor não compõe o total de Estoque VW / Outros.</p>
        </FormSection>

        {/* ESTOQUE A PAGAR AUDI */}
        <FormSection cor="#bb0a30" titulo="ESTOQUE A PAGAR AUDI">
          <div className="pb-1">
            <CurrencyField label="Estoque Veículos Usados Montadora a Pagar" fieldKey="audiUsadosMontadoraaPagar" values={values} onChange={handleChange} />
          </div>
          {/* Campo informativo — destaque âmbar */}
          <div className="mx-0 mb-3 rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-amber-200 bg-amber-100/60 flex items-center gap-1">
              <svg className="w-3 h-3 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Informativo</span>
            </div>
            <div className="px-3">
              <CurrencyField label="Valores próximos do vencimento (em até 30 dias)" fieldKey="audiVencimento30Dias" values={values} onChange={handleChange} />
            </div>
          </div>
          <p className="text-xs text-amber-600 pb-3">ⓘ Este valor não compõe o total de Estoque Audi / Outros.</p>
        </FormSection>

        {/* NOVOS PRÓX. VENCIMENTO VW */}
        <FormSection cor="#001e50" titulo="NOVOS PRÓXIMO VENCIMENTO (180 DIAS) VW">
          <div className="pb-1">
            <CurrencyField label="Estoque de Veículos Novos próximo do vencimento (180 dias)" fieldKey="vwNovosProximoVencimento" values={values} onChange={handleChange} />
          </div>
          <p className="text-xs text-amber-600 pb-3">ⓘ Este valor não compõe o total de Estoque VW / Outros.</p>
        </FormSection>

        {/* NOVOS PRÓX. VENCIMENTO AUDI */}
        <FormSection cor="#bb0a30" titulo="NOVOS PRÓXIMO VENCIMENTO (180 DIAS) AUDI">
          <div className="pb-1">
            <CurrencyField label="Estoque de Veículos Novos próximo do vencimento (180 dias)" fieldKey="audiNovosProximoVencimento" values={values} onChange={handleChange} />
          </div>
          <p className="text-xs text-amber-600 pb-3">ⓘ Este valor não compõe o total de Estoque Audi / Outros.</p>
        </FormSection>

        {/* Salvar */}
        <div className="flex justify-end pb-4">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {saving ? 'Salvando...' : 'Salvar Lançamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
