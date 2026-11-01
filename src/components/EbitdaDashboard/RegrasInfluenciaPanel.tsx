/**
 * Painel de configuração da regra de influência das Despesas Financeiras
 * sobre a DRE do Ebitda VW. Regra única para todo o grupo: escolhe-se a
 * linha-alvo da DRE e o sinal (positivo soma / negativo deduz). Salvo em KV.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Settings, Loader2 } from 'lucide-react';
import {
  loadInfluenciaDF,
  saveInfluenciaDF,
  loadFinanceirasContas,
  DRE_TARGET_LINES,
  ZEROABLE_LINES,
  type InfluenciaDFRule,
  type DreTargetField,
} from './ebitdaInfluenciaStorage';

interface RegrasInfluenciaPanelProps {
  /** Carrega a regra salva. Padrão: Ebitda VW. */
  loadRule?: () => Promise<InfluenciaDFRule>;
  /** Salva a regra. Padrão: Ebitda VW. */
  saveRule?: (rule: InfluenciaDFRule) => Promise<void>;
  /** Lista as contas de Despesas Financeiras. Padrão: Ebitda VW. */
  loadContas?: () => Promise<string[]>;
}

export function RegrasInfluenciaPanel({
  loadRule = loadInfluenciaDF,
  saveRule = saveInfluenciaDF,
  loadContas = loadFinanceirasContas,
}: RegrasInfluenciaPanelProps = {}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rule, setRule] = useState<InfluenciaDFRule>({ targetField: '', sign: -1, zeroedLines: [], selectedContas: [] });
  const [contas, setContas] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([loadRule(), loadContas()])
      .then(([saved, contasList]) => {
        setContas(contasList);
        // undefined = regra antiga/nova → marca todas as contas por padrão.
        setRule({
          ...saved,
          selectedContas: saved.selectedContas ?? [...contasList],
        });
      })
      .finally(() => setLoading(false));
  }, [loadRule, loadContas]);

  function toggleZeroedLine(field: DreTargetField) {
    setRule(r => {
      const current = r.zeroedLines ?? [];
      const exists = current.includes(field);
      return {
        ...r,
        zeroedLines: exists ? current.filter(f => f !== field) : [...current, field],
      };
    });
  }

  function toggleConta(conta: string) {
    setRule(r => {
      const current = r.selectedContas ?? [];
      const exists = current.includes(conta);
      return {
        ...r,
        selectedContas: exists ? current.filter(c => c !== conta) : [...current, conta],
      };
    });
  }

  function setAllContas(checked: boolean) {
    setRule(r => ({ ...r, selectedContas: checked ? [...contas] : [] }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveRule(rule);
      toast.success('Regra salva. Abra a aba DRE para ver o resultado.');
    } catch {
      toast.error('Erro ao salvar a regra.');
    } finally {
      setSaving(false);
    }
  }

  const selectedContasCount = (rule.selectedContas ?? []).length;

  const alvoLabel = rule.targetField
    ? DRE_TARGET_LINES.find(l => l.field === rule.targetField)?.label ?? '—'
    : 'Nenhuma (sem influência)';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-[#059669]" />
          <span className="text-sm font-bold text-slate-700">Regra de influência na DRE</span>
          <span className="text-xs text-slate-400">
            {loading
              ? 'carregando...'
              : `${rule.sign === 1 ? 'Soma' : 'Deduz'} · ${alvoLabel}`}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 flex flex-col gap-3">
          <p className="text-xs text-slate-500">
            Define como o subtotal de <strong>Despesas Financeiras</strong> de cada departamento
            influencia a DRE (aba DRE deste Ebitda VW). O valor de cada departamento é aplicado na
            sua própria coluna; Diretoria é somada em Administração. Os totais são recalculados.
            Não altera o Resumo DRE original.
          </p>

          <div className="flex flex-wrap items-end gap-4">
            {/* Linha-alvo */}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Linha da DRE</span>
              <select
                value={rule.targetField}
                onChange={e => setRule(r => ({ ...r, targetField: e.target.value as DreTargetField | '' }))}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 min-w-[18rem]"
              >
                <option value="">Nenhuma (sem influência)</option>
                {DRE_TARGET_LINES.map(l => (
                  <option key={l.field} value={l.field}>{l.label}</option>
                ))}
              </select>
            </label>

            {/* Sinal */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Efeito</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRule(r => ({ ...r, sign: 1 }))}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    rule.sign === 1
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Positivo (soma)
                </button>
                <button
                  onClick={() => setRule(r => ({ ...r, sign: -1 }))}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    rule.sign === -1
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Negativo (deduz)
                </button>
              </div>
            </div>
          </div>

          {/* Contas que influenciam */}
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Contas que influenciam ({selectedContasCount}/{contas.length})
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setAllContas(true)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Marcar todas
                </button>
                <button
                  onClick={() => setAllContas(false)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Desmarcar todas
                </button>
              </div>
            </div>
            {contas.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                Nenhuma conta classificada como Despesas Financeiras encontrada.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {contas.map(conta => {
                  const checked = (rule.selectedContas ?? []).includes(conta);
                  return (
                    <label key={conta} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleConta(conta)}
                        className="w-4 h-4 accent-[#059669] cursor-pointer shrink-0"
                      />
                      <span className="font-mono text-xs">{conta}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {selectedContasCount === 0 && (
              <p className="text-[11px] text-amber-600">
                Nenhuma conta marcada: a linha-alvo não receberá influência.
              </p>
            )}
          </div>

          {/* Zerar linhas */}
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Zerar linhas (ficam 0,00 e os totais abaixo recalculam)
            </span>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {ZEROABLE_LINES.map(l => {
                const checked = (rule.zeroedLines ?? []).includes(l.field);
                return (
                  <label key={l.field} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleZeroedLine(l.field)}
                      className="w-4 h-4 accent-[#059669] cursor-pointer"
                    />
                    {l.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Salvar */}
          <div>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#059669' }}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'Salvando...' : 'Salvar regra'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
