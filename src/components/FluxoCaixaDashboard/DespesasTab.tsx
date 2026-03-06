import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { loadDespesasTipos, saveDespesasTipos } from './despesasStorage';

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Retorna as contas folha do grupo 5 (sem filhos) com valDeb e valCred */
function grupo5Leaves(accounts: Record<string, any>) {
  const allKeys = Object.keys(accounts).filter((k) => k.startsWith('5.'));
  const leaves = allKeys.filter(
    (k) => !allKeys.some((other) => other !== k && other.startsWith(k + '.'))
  );
  return leaves
    .sort()
    .map((k) => {
      const acc = accounts[k];
      return {
        conta: k,
        desc: acc.desc as string,
        valDeb: acc.valDeb as number,
        valCred: acc.valCred as number,
        valor: (acc.valDeb as number) - (acc.valCred as number),
      };
    });
}

interface DespesasTabProps {
  data: any;
  fmtBRL: (v: number, abs?: boolean) => string;
  SectionTitle: React.ComponentType<{ icon?: string; children: React.ReactNode }>;
  KPI: React.ComponentType<any>;
  showTabela: boolean;
  setShowTabela: (v: (prev: boolean) => boolean) => void;
}

export function DespesasTab({ data, fmtBRL, SectionTitle, KPI, showTabela, setShowTabela }: DespesasTabProps) {
  const accounts = data.accounts as Record<string, any>;
  const rows = grupo5Leaves(accounts);

  const [tipos, setTipos] = useState<Record<string, string>>({});
  const [loadingTipos, setLoadingTipos] = useState(true);
  const [saving, setSaving] = useState(false);
  // Ref para debounce do save
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carrega tipos ao montar
  useEffect(() => {
    loadDespesasTipos()
      .then(setTipos)
      .finally(() => setLoadingTipos(false));
  }, []);

  const handleTipoChange = useCallback(
    (conta: string, value: string) => {
      setTipos((prev) => {
        const next = { ...prev, [conta]: value };
        // Debounce: salva 800ms após a última digitação
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => {
          setSaving(true);
          saveDespesasTipos(next).finally(() => setSaving(false));
        }, 800);
        return next;
      });
    },
    []
  );

  const totalValor = rows.reduce((sum, r) => sum + r.valor, 0);
  const totalDeb = rows.reduce((sum, r) => sum + r.valDeb, 0);
  const totalCred = rows.reduce((sum, r) => sum + r.valCred, 0);

  const visibleRows = rows.filter((r) => r.valor !== 0);

  return (
    <div className="space-y-4">
      {/* Botão toggle no topo da área branca */}
      <div>
        <button
          onClick={() => setShowTabela((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition-colors text-foreground shadow-sm"
        >
          <span>{showTabela ? '▲' : '▼'}</span>
          Tabela de Despesas
        </button>
      </div>

      {showTabela && (
      <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI
          label="Total de Despesas (Grupo 5)"
          value={fmtBRL(totalValor)}
          sub={`${rows.length} contas`}
          color="red"
          icon="💸"
        />
        <KPI
          label="Total Movto Débito"
          value={fmtBRL(totalDeb)}
          sub="Soma dos débitos do grupo 5"
          color="orange"
          icon="📤"
        />
        <KPI
          label="Total Movto Crédito"
          value={fmtBRL(totalCred)}
          sub="Soma dos créditos do grupo 5"
          color="emerald"
          icon="📥"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon="💸">Despesas — Grupo 5 (Débito − Crédito)</SectionTitle>
            {saving && (
              <span className="text-xs text-muted-foreground animate-pulse">Salvando...</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    Conta
                  </th>
                  <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    Descrição
                  </th>
                  <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    Tipo de Despesa
                  </th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">
                    Movto Débito
                  </th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">
                    Movto Crédito
                  </th>
                  <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">
                    Valor (Déb − Créd)
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma conta do grupo 5 encontrada no balancete
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((r) => (
                    <tr
                      key={r.conta}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-2 px-3">
                        <span className="text-xs font-mono text-muted-foreground">{r.conta}</span>
                      </td>
                      <td className="py-2 px-3 text-sm text-foreground">
                        {r.desc ? toTitleCase(r.desc) : '—'}
                      </td>
                      <td className="py-2 px-3">
                        {loadingTipos ? (
                          <span className="text-xs text-muted-foreground">...</span>
                        ) : (
                          <input
                            type="text"
                            value={tipos[r.conta] ?? ''}
                            onChange={(e) => handleTipoChange(r.conta, e.target.value)}
                            placeholder="Informe o tipo"
                            className={`w-full min-w-[160px] px-2 py-1 text-sm rounded-md border focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground ${
                              r.valor !== 0 && !(tipos[r.conta]?.trim())
                                ? 'bg-yellow-200 dark:bg-yellow-600/50 border-yellow-400 dark:border-yellow-500'
                                : 'bg-background border-border'
                            }`}
                          />
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">
                        {fmtBRL(r.valDeb)}
                      </td>
                      <td className="py-2 px-3 text-right text-sm font-mono text-muted-foreground">
                        {fmtBRL(r.valCred)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right text-sm font-mono font-semibold ${
                          r.valor > 0
                            ? 'text-red-600 dark:text-red-400'
                            : r.valor < 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {fmtBRL(r.valor)}
                      </td>
                    </tr>
                  ))
                )}
                {/* Linha de total */}
                <tr className="bg-muted/50 font-bold">
                  <td colSpan={3} className="py-2.5 px-3 text-sm font-bold text-foreground">
                    TOTAL DESPESAS
                  </td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">
                    {fmtBRL(totalDeb)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-muted-foreground">
                    {fmtBRL(totalCred)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-red-600 dark:text-red-400">
                    {fmtBRL(totalValor)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>
      )}
    </div>
  );
}
