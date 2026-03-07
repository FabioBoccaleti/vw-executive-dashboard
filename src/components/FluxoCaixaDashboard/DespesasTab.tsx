import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { loadDespesasTipos, saveDespesasTipos } from './despesasStorage';
import { ComparativoDespesas } from './ComparativoDespesas';

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Grupos de Despesas ───────────────────────────────────────────────────────

export const GRUPOS_CONFIG = [
  {
    id: 'pessoal',
    label: 'Despesas c/ Pessoal',
    descricao: 'Salários · Encargos · Benefícios · Indenizações',
    icon: '👥',
    borderClass: 'border-t-4 border-t-blue-500',
    headerBg: 'bg-blue-50 dark:bg-blue-950/20',
    headerText: 'text-blue-700 dark:text-blue-300',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    totalColor: 'text-blue-700 dark:text-blue-300',
    rowHover: 'hover:bg-blue-50/50 dark:hover:bg-blue-950/10',
    keywords: /sal[aá]rio|inss|fgts|f[eé]ria|13[°º ]|d[eé]cimo.ter|benefi[cç]|assist.*m[eé]d|m[eé]d.*assist|indeniz|trabalhist|encargo|rescis|vale.transp|vale.aliment|labore|aviso.pr[eé]v|folha|pr[eê]mio|hora.*extra|extra.*hora|funcion[aá]rio|uniform|vestu[aá]rio|comiss(?!.*mercado|.*pessoa|.*jur[ií]d)|seguro.de.vida|vida.*seguro|forma[cç][aã]o.profis|treinamento|capacita[cç]/i,
  },
  {
    id: 'veiculosEstoque',
    label: 'Despesas c/ Veículos (Estoque e Vendas)',
    descricao: 'Reparos · Garantias · Preparação · Combustível',
    icon: '🚗',
    borderClass: 'border-t-4 border-t-cyan-500',
    headerBg: 'bg-cyan-50 dark:bg-cyan-950/20',
    headerText: 'text-cyan-700 dark:text-cyan-300',
    badgeBg: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
    totalColor: 'text-cyan-700 dark:text-cyan-300',
    rowHover: 'hover:bg-cyan-50/50 dark:hover:bg-cyan-950/10',
    keywords: /reparo.*ve[ií]c|ve[ií]c.*reparo|imposto.*taxa|taxa.*imposto|cortesia|garantia|combust[ií]ve[il]|prepara[cç].*ve[ií]c|ve[ií]c.*prepara[cç]|despesas?\s*divers|lavagem|est[eé]tica.*ve[ií]c|ve[ií]c.*est[eé]tica|guincho|estacionamento/i,
  },
  {
    id: 'imoveis',
    label: 'Imóveis e Veículos Frota',
    descricao: 'Aluguéis · Água/Luz · Seguros · Frota',
    icon: '🏢',
    borderClass: 'border-t-4 border-t-amber-500',
    headerBg: 'bg-amber-50 dark:bg-amber-950/20',
    headerText: 'text-amber-700 dark:text-amber-300',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    totalColor: 'text-amber-700 dark:text-amber-300',
    rowHover: 'hover:bg-amber-50/50 dark:hover:bg-amber-950/10',
    keywords: /alugu[eé][il]|loca[cç].*im[oó]vel|[áa]gua|energia.el[ée]|energia.luz|tarifa.luz|ilumina|seguro|frota|iptu|condom[ií]nio|manuten[cç].*pred|deprecia[cç]|amortiza[cç]|conserva[cç].*im[oó]vel|conserva[cç].*m[áa]q|im[oó]vel.*conserva[cç]|m[áa]q.*conserva[cç]|estacionamento|telefone|celular|alugu[eé][il].*equip|equip.*alugu[eé][il]|aquisi[cç][ãa]o.*n[ãa]o.imob|n[ãa]o.imob/i,
  },
  {
    id: 'terceiros',
    label: 'Serviços de Terceiros',
    descricao: 'Fretes · Comissões · PJ · Terceirizados',
    icon: '🤝',
    borderClass: 'border-t-4 border-t-violet-500',
    headerBg: 'bg-violet-50 dark:bg-violet-950/20',
    headerText: 'text-violet-700 dark:text-violet-300',
    badgeBg: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
    totalColor: 'text-violet-700 dark:text-violet-300',
    rowHover: 'hover:bg-violet-50/50 dark:hover:bg-violet-950/10',
    keywords: /pessoa.jur[ií]d|jur[ií]d.*pessoa|comiss.*mercado|mercado.*livre|comiss.*pj|comiss.*jur[ií]d|frete|honor[aá]rio|consultori|portaria|vigil[aâ]nci|limpeza|conserva[cç][aã]o|m[aã]o.de.obra|servi[cç].*terceiro|terceiro.*servi[cç]|outros servi|processamento.de.dado|lavagem|est[eé]tica.*ve[ií]c|ve[ií]c.*est[eé]tica|advogado|mercado.livre|guincho|isen[cç][aã]o.*vd|vd.*isen[cç][aã]o|instala[cç].*acess[oó]|acess[oó].*instala[cç]|cont[aá]b[ei]|emplacamento|auditoria/i,
  },
  {
    id: 'financeiras',
    label: 'Despesas Financeiras',
    descricao: 'Juros · IOF · Tarifas Bancárias · Empréstimos',
    icon: '🏦',
    borderClass: 'border-t-4 border-t-rose-500',
    headerBg: 'bg-rose-50 dark:bg-rose-950/20',
    headerText: 'text-rose-700 dark:text-rose-300',
    badgeBg: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
    totalColor: 'text-rose-700 dark:text-rose-300',
    rowHover: 'hover:bg-rose-50/50 dark:hover:bg-rose-950/10',
    keywords: /juros|iof|tarifa.banc|spread|encargo.financ|multa.financ|emprestimo|financiamento|refis|cdi|taxa.adm|juro.mora|juro.prot|juro.desc|desconto.*financ|financ.*desconto|cart[aã]o.cr[eé]d|taxa.*cart[aã]o|cart[aã]o.*taxa|despesa.*banc[aá]|banc[aá].*despesa|desconto.*concedido|concedido.*desconto/i,
  },
  {
    id: 'marketing',
    label: 'Despesas c/ Marketing',
    descricao: 'Publicidade · Propaganda · Eventos',
    icon: '📣',
    borderClass: 'border-t-4 border-t-pink-500',
    headerBg: 'bg-pink-50 dark:bg-pink-950/20',
    headerText: 'text-pink-700 dark:text-pink-300',
    badgeBg: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
    totalColor: 'text-pink-700 dark:text-pink-300',
    rowHover: 'hover:bg-pink-50/50 dark:hover:bg-pink-950/10',
    keywords: /publicidade|propaganda|evento/i,
  },
  {
    id: 'outras',
    label: 'Outras Despesas',
    descricao: 'Impostos · Publicidade · Depreciações · Outras',
    icon: '📋',
    borderClass: 'border-t-4 border-t-slate-400',
    headerBg: 'bg-slate-50 dark:bg-slate-800/20',
    headerText: 'text-slate-700 dark:text-slate-300',
    badgeBg: 'bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400',
    totalColor: 'text-slate-700 dark:text-slate-300',
    rowHover: 'hover:bg-slate-50/50 dark:hover:bg-slate-800/10',
    keywords: null as null | RegExp,
  },
] as const;

export function classificarTipo(tipo: string): number {
  for (let i = 0; i < GRUPOS_CONFIG.length - 1; i++) {
    if (GRUPOS_CONFIG[i].keywords!.test(tipo)) return i;
  }
  return GRUPOS_CONFIG.length - 1;
}

// ─── Fim Grupos ───────────────────────────────────────────────────────────────

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
  despesasView?: 'normal' | 'comparativo';
  setDespesasView?: (v: 'normal' | 'comparativo') => void;
}

export function DespesasTab({ data, fmtBRL, SectionTitle, KPI, showTabela, setShowTabela, despesasView = 'normal', setDespesasView }: DespesasTabProps) {
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

  // Resumo agrupado por Tipo de Despesa (ignora linhas sem tipo)
  const resumoMap = visibleRows.reduce<Record<string, number>>((acc, r) => {
    const tipo = tipos[r.conta]?.trim();
    if (!tipo) return acc;
    acc[tipo] = (acc[tipo] ?? 0) + r.valor;
    return acc;
  }, {});
  const resumoRows = Object.entries(resumoMap).sort((a, b) => b[1] - a[1]);

  // Agrupar resumoRows nos 4 grupos
  const totalGeral = resumoRows.reduce((s, [, v]) => s + v, 0);
  const gruposData = GRUPOS_CONFIG.map((g, idx) => {
    const itens = resumoRows
      .filter(([tipo]) => classificarTipo(tipo) === idx)
      .sort((a, b) => b[1] - a[1]);
    const total = itens.reduce((s, [, v]) => s + v, 0);
    const pct = totalGeral !== 0 ? (total / totalGeral) * 100 : 0;
    return { ...g, itens, total, pct };
  });

  if (despesasView === 'comparativo') {
    return (
      <div className="space-y-4">
        {setDespesasView && (
          <button
            onClick={() => setDespesasView('normal')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-border bg-muted/40 hover:bg-muted/70 transition-colors text-foreground shadow-sm"
          >
            ← Voltar para Despesas
          </button>
        )}
        <ComparativoDespesas fmtBRL={fmtBRL} />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Cards de Resumo por Grupo (sempre visíveis) ── */}
      {resumoRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base font-semibold text-foreground">Resumo por Grupo de Despesa</span>
            <span className="text-xs text-muted-foreground">— competência do período</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gruposData.map((grupo, idx) => (
              <Card key={grupo.id} className={`overflow-hidden shadow-sm ${grupo.borderClass}${gruposData.length % 2 !== 0 && idx === gruposData.length - 1 ? ' md:col-span-2' : ''}`}>
                {/* Cabeçalho do card */}
                <div className={`px-4 py-3 ${grupo.headerBg} flex items-start justify-between`}>
                  <div>
                    <div className={`flex items-center gap-2 font-semibold text-sm ${grupo.headerText}`}>
                      <span className="text-base">{grupo.icon}</span>
                      {grupo.label}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold font-mono ${grupo.totalColor}`}>
                      {fmtBRL(grupo.total)}
                    </div>
                    <div className={`text-xs font-semibold mt-0.5 px-1.5 py-0.5 rounded-full inline-block ${grupo.badgeBg}`}>
                      {grupo.pct.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Tabela de itens */}
                <CardContent className="p-0">
                  {grupo.itens.length === 0 ? (
                    <div className="py-4 px-4 text-xs text-muted-foreground italic">
                      Nenhuma despesa classificada neste grupo
                    </div>
                  ) : (
                    <table className="w-full">
                      <tbody>
                        {grupo.itens.map(([tipo, valor], i) => {
                          const pctItem = grupo.total !== 0 ? (valor / grupo.total) * 100 : 0;
                          return (
                            <tr
                              key={tipo}
                              className={`${grupo.rowHover} transition-colors ${i < grupo.itens.length - 1 ? 'border-b border-border/40' : ''}`}
                            >
                              <td className="py-2 pl-4 pr-2 text-sm text-foreground w-full">
                                {tipo}
                              </td>
                              <td className="py-2 px-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                                {pctItem.toFixed(1)}%
                              </td>
                              <td className="py-2 pl-2 pr-4 text-right text-sm font-mono font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                                {fmtBRL(valor)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className={`border-t border-border/50 ${grupo.headerBg}`}>
                          <td className={`py-2 pl-4 text-xs font-bold uppercase tracking-wide ${grupo.headerText}`}>
                            Total
                          </td>
                          <td></td>
                          <td className={`py-2 pr-4 text-right text-sm font-mono font-bold ${grupo.totalColor} whitespace-nowrap`}>
                            {fmtBRL(grupo.total)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Barra de composição total */}
          <Card className="shadow-sm">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Composição do Total de Despesas</span>
                <span className="text-sm font-bold font-mono text-red-600 dark:text-red-400">{fmtBRL(totalGeral)}</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden gap-px">
                {gruposData.filter(g => g.pct > 0).map((g) => {
                  const barColors: Record<string, string> = {
                    pessoal: 'bg-blue-500',
                    veiculosEstoque: 'bg-cyan-500',
                    imoveis: 'bg-amber-500',
                    terceiros: 'bg-violet-500',
                    financeiras: 'bg-rose-500',
                    marketing: 'bg-pink-500',
                    outras: 'bg-slate-400',
                  };
                  return (
                    <div
                      key={g.id}
                      title={`${g.label}: ${g.pct.toFixed(1)}%`}
                      className={`${barColors[g.id]} transition-all`}
                      style={{ width: `${g.pct}%` }}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {gruposData.filter(g => g.pct > 0).map((g) => {
                  const dotColors: Record<string, string> = {
                    pessoal: 'bg-blue-500',
                    veiculosEstoque: 'bg-cyan-500',
                    imoveis: 'bg-amber-500',
                    terceiros: 'bg-violet-500',
                    financeiras: 'bg-rose-500',
                    marketing: 'bg-pink-500',
                    outras: 'bg-slate-400',
                  };
                  return (
                    <div key={g.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={`w-2.5 h-2.5 rounded-full inline-block ${dotColors[g.id]}`} />
                      {g.label}
                      <span className="font-semibold text-foreground">{g.pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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

      {/* Resumo por Tipo de Despesa */}
      {resumoRows.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4">
              <SectionTitle icon="📊">Resumo por Tipo de Despesa</SectionTitle>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="py-2.5 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      Tipo de Despesa
                    </th>
                    <th className="py-2.5 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">
                      Valor (Déb − Créd)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resumoRows.map(([tipo, valor]) => (
                    <tr key={tipo} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 text-sm text-foreground">{tipo}</td>
                      <td className={`py-2 px-3 text-right text-sm font-mono font-semibold ${
                        valor > 0
                          ? 'text-red-600 dark:text-red-400'
                          : valor < 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground'
                      }`}>
                        {fmtBRL(valor)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/50">
                    <td className="py-2.5 px-3 text-sm font-bold text-foreground">TOTAL</td>
                    <td className="py-2.5 px-3 text-right text-sm font-mono font-bold text-red-600 dark:text-red-400">
                      {fmtBRL(resumoRows.reduce((s, [, v]) => s + v, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* ── Card Comparativo de Despesas ── */}
      <ComparativoDespesas fmtBRL={fmtBRL} />

    </div>
  );
}
