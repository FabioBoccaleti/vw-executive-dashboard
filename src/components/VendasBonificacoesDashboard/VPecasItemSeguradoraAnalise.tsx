import { useEffect, useMemo, useState } from 'react';
import { loadVPecasItemRows, loadVPecasItemDevolucaoRows, type VPecasItemRow } from './vPecasItemStorage';
import { loadVPecasSegRows } from './vPecasSeguradoraStorage';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const n = (v?: string | null) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
const fmtBRLF = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct  = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

// Departamentos válidos para Seguradora Balcão (103 e 108 consolidado em 103)
const DEPT_SEG = new Set(['103', '108']);

function getItemYr(row: VPecasItemRow): number {
  if (row.periodoImport) { const [y] = row.periodoImport.split('-').map(Number); if (y > 2000) return y; }
  const d = row.data['DTA_ENTRADA_SAIDA'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[2];
  return 0;
}
function getItemMo(row: VPecasItemRow): number {
  if (row.periodoImport) { const [,m] = row.periodoImport.split('-').map(Number); if (m >= 1 && m <= 12) return m; }
  const d = row.data['DTA_ENTRADA_SAIDA'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[1];
  return 0;
}
function calcItem(d: Record<string, string>) {
  const valorVenda = n(d['VAL_VENDA']);
  const impostos   = n(d['VAL_IMPOSTOS']);
  const custo      = n(d['CUSTO_MEDIO']);
  const recLiq     = valorVenda - impostos;
  const lucroBruto = recLiq - custo;
  const lbPct      = recLiq !== 0 ? (lucroBruto / recLiq) * 100 : 0;
  return { recLiq, custo, lucroBruto, lbPct };
}

function SH({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
      {right}
    </div>
  );
}

export default function VPecasItemSeguradoraAnalise() {
  const curYear = new Date().getFullYear();
  const [allItemRows, setAllItemRows] = useState<VPecasItemRow[]>([]);
  const [segNomes, setSegNomes]       = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);
  const [year, setYear]               = useState(curYear);
  const [month, setMonth]             = useState<number | null>(new Date().getMonth() + 1);
  const [prejExpanded, setPrejExpanded] = useState(false);
  const [lucroExpanded, setLucroExpanded] = useState(false);

  useEffect(() => {
    Promise.all([
      loadVPecasItemRows(),
      loadVPecasItemDevolucaoRows(),
      loadVPecasSegRows(),
    ]).then(([rows, devol, segRows]) => {
      const allItems = [...rows, ...devol];
      setAllItemRows(allItems);

      // Extrai nomes únicos de seguradoras do registro_vpecas_seg
      const nomes = new Set(segRows.map(r => r.data['NOME_CLIENTE']?.trim()).filter(Boolean) as string[]);
      setSegNomes(nomes);

      if (allItems.length > 0) {
        const yr = Math.max(...allItems.map(getItemYr).filter(y => y > 2000));
        const mo = Math.max(...allItems.filter(r => getItemYr(r) === yr).map(getItemMo).filter(m => m >= 1 && m <= 12));
        setYear(yr);
        setMonth(mo);
      }
      setLoading(false);
    });
  }, []);

  const availYears = useMemo(() => {
    const s = new Set(allItemRows.map(getItemYr).filter(y => y > 2000));
    [curYear - 1, curYear].forEach(y => s.add(y));
    return [...s].sort();
  }, [allItemRows, curYear]);

  // Filtra: ano/mês + seguradora + departamento 103/108
  const filteredRows = useMemo(() =>
    allItemRows.filter(r => {
      if (getItemYr(r) !== year) return false;
      if (month !== null && getItemMo(r) !== month) return false;
      const dept  = r.data['DEPARTAMENTO']?.trim() || '';
      const nome  = r.data['NOME_CLIENTE']?.trim() || '';
      if (!DEPT_SEG.has(dept)) return false;
      if (segNomes.size > 0 && !segNomes.has(nome)) return false;
      return true;
    })
  , [allItemRows, year, month, segNomes]);

  const kpis = useMemo(() => {
    let comLucro = 0, comPrejuizo = 0, lucroBrutoTotal = 0, recLiqTotal = 0;
    for (const r of filteredRows) {
      const c = calcItem(r.data);
      recLiqTotal     += c.recLiq;
      lucroBrutoTotal += c.lucroBruto;
      if (c.lucroBruto > 0) comLucro++;
      else if (c.lucroBruto < 0) comPrejuizo++;
    }
    const total = filteredRows.length;
    return {
      total, comLucro, comPrejuizo,
      lucroBrutoTotal, recLiqTotal,
      lbPctTotal: recLiqTotal !== 0 ? (lucroBrutoTotal / recLiqTotal) * 100 : 0,
    };
  }, [filteredRows]);

  const prejData = useMemo(() =>
    filteredRows
      .map(r => {
        const c = calcItem(r.data);
        return {
          codigo:    r.data['ITEM_ESTOQUE_PUB']?.trim() || '—',
          descricao: r.data['DES_ITEM_ESTOQUE']?.trim() || '—',
          cliente:   r.data['NOME_CLIENTE']?.trim() || '—',
          vendedor:  r.data['NOME_VENDEDOR']?.trim() || '—',
          nf:        r.data['NUMERO_NOTA_FISCAL']?.trim() || '—',
          transacao: r.data['TIPO_TRANSACAO']?.trim() || '—',
          qtd:       r.data['QUANTIDADE']?.trim() || '0',
          recLiq:    c.recLiq,
          custo:     n(r.data['CUSTO_MEDIO']),
          lucroBruto: c.lucroBruto,
          lbPct:     c.lbPct,
        };
      })
      .filter(r => r.lucroBruto < 0)
      .sort((a, b) => a.lucroBruto - b.lucroBruto)
  , [filteredRows]);

  const lucroData = useMemo(() =>
    filteredRows
      .map(r => {
        const c = calcItem(r.data);
        return {
          codigo:    r.data['ITEM_ESTOQUE_PUB']?.trim() || '—',
          descricao: r.data['DES_ITEM_ESTOQUE']?.trim() || '—',
          cliente:   r.data['NOME_CLIENTE']?.trim() || '—',
          vendedor:  r.data['NOME_VENDEDOR']?.trim() || '—',
          nf:        r.data['NUMERO_NOTA_FISCAL']?.trim() || '—',
          transacao: r.data['TIPO_TRANSACAO']?.trim() || '—',
          qtd:       r.data['QUANTIDADE']?.trim() || '0',
          recLiq:    c.recLiq,
          custo:     n(r.data['CUSTO_MEDIO']),
          lucroBruto: c.lucroBruto,
          lbPct:     c.lbPct,
        };
      })
      .filter(r => r.lucroBruto > 0)
      .sort((a, b) => b.lucroBruto - a.lucroBruto)
  , [filteredRows]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-300">
        <span className="text-sm animate-pulse">Carregando itens de seguradora...</span>
      </div>
    );
  }

  const COLS = 'grid-cols-[auto_1.2fr_2fr_1.5fr_1fr_1fr_0.5fr_1fr_1fr_1.2fr]';

  function ItemRow({ item, i, colorClass }: { item: typeof prejData[0]; i: number; colorClass: string }) {
    return (
      <div className={`grid ${COLS} gap-2 items-center px-2 py-1.5 rounded-lg ${colorClass} transition-colors`}>
        <span className="w-5 text-[11px] font-bold text-slate-300 text-center">{i + 1}</span>
        <span className="text-xs font-mono text-slate-600 truncate">{item.codigo}</span>
        <span className="text-xs text-slate-700 truncate">{item.descricao}</span>
        <span className="text-xs text-slate-500 truncate">{item.cliente}</span>
        <div className="flex flex-col gap-0">
          <span className="text-xs font-mono text-slate-600 truncate">{item.nf}</span>
          <span className="text-[10px] text-slate-400">{item.transacao}</span>
        </div>
        <span className="text-xs text-slate-500 truncate">{item.vendedor}</span>
        <span className="text-right text-xs font-mono text-slate-600">{item.qtd}</span>
        <span className="text-right text-xs font-mono text-slate-600">{fmtBRLF(item.recLiq)}</span>
        <span className="text-right text-xs font-mono text-slate-600">{fmtBRLF(item.custo)}</span>
        <span className={`text-right text-xs font-mono font-bold ${item.lucroBruto < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
          {fmtBRLF(item.lucroBruto)} <span className="text-[10px] opacity-70">({fmtPct(item.lbPct)})</span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50 px-6 py-5 space-y-6" style={{ minHeight: 0 }}>

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          ANO
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-sky-400">
            {availYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setMonth(null)}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${month === null ? 'bg-sky-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            Ano todo
          </button>
          {MS.map((m, i) => (
            <button key={m} onClick={() => setMonth(i + 1)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${month === i + 1 ? 'bg-sky-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {m}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-[11px] text-slate-400">
          <span>{filteredRows.length} item(s)</span>
          <span className="text-slate-200">|</span>
          <span>Deptos: 103 + 108</span>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Itens',     value: kpis.total.toLocaleString('pt-BR'),       color: 'text-slate-700', accent: '#94a3b8' },
          { label: 'c/ Lucro',        value: kpis.comLucro.toLocaleString('pt-BR'),    color: 'text-emerald-700', accent: '#10b981' },
          { label: 'c/ Prejuízo',     value: kpis.comPrejuizo.toLocaleString('pt-BR'), color: 'text-rose-700',    accent: '#f43f5e' },
          { label: 'Rec. Líquida',    value: fmtBRLF(kpis.recLiqTotal),                color: 'text-slate-700', accent: '#7c3aed' },
          { label: 'Lucro Bruto',     value: fmtBRLF(kpis.lucroBrutoTotal),            color: kpis.lucroBrutoTotal >= 0 ? 'text-emerald-700' : 'text-rose-600', accent: kpis.lucroBrutoTotal >= 0 ? '#10b981' : '#f43f5e' },
          { label: '% Margem',        value: fmtPct(kpis.lbPctTotal),                  color: kpis.lbPctTotal >= 0 ? 'text-emerald-700' : 'text-rose-600', accent: kpis.lbPctTotal >= 0 ? '#10b981' : '#f43f5e' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col gap-1" style={{ borderLeft: `4px solid ${card.accent}` }}>
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{card.label}</span>
            <span className={`font-bold text-base leading-tight truncate ${card.color}`}>{card.value}</span>
          </div>
        ))}
      </div>

      {filteredRows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
          <span className="text-sm">Nenhum item encontrado para seguradoras nos deptos 103/108 no período</span>
        </div>
      )}

      {/* ── Top 40 Itens com Prejuízo ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5" style={{ borderLeft: '4px solid #fb7185' }}>
        <SH right={<span className="text-[10px] text-slate-400">{prejData.length} item(s) com prejuízo</span>}>
          Itens com Prejuízo — Seguradora (Deptos 103/108)
        </SH>
        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 mb-3 text-xs text-blue-700">
          <span className="shrink-0 mt-0.5">ℹ️</span>
          <span>Exibe <strong>todos os itens com prejuízo</strong> vendidos para seguradoras nos departamentos 103 e 108.</span>
        </div>
        {prejData.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-xs text-emerald-600 font-semibold">
            Nenhum item com prejuízo no período 🎉
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className={`grid ${COLS} gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-1 border-b border-slate-100`}>
              <span className="w-5">#</span>
              <span>Código</span><span>Descrição</span><span>Cliente</span>
              <span>NF / Transação</span><span>Vendedor</span>
              <span className="text-right">Qtd</span>
              <span className="text-right">Rec. Líq.</span>
              <span className="text-right">Custo</span>
              <span className="text-right">Lucro Bruto</span>
            </div>
            {(prejExpanded ? prejData : prejData.slice(0, 5)).map((item, i) => (
              <ItemRow key={i} item={item} i={i} colorClass="bg-rose-50/40 hover:bg-rose-50" />
            ))}
            {prejData.length > 5 && (
              <button onClick={() => setPrejExpanded(e => !e)}
                className="mt-1 self-center px-4 py-1 rounded-full text-[11px] font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 transition-all">
                {prejExpanded ? 'Mostrar menos' : `Mostrar mais (${prejData.length - 5} restantes)`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Top 40 Itens com Lucro ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5" style={{ borderLeft: '4px solid #10b981' }}>
        <SH right={<span className="text-[10px] text-slate-400">{lucroData.length} item(s) com lucro</span>}>
          Itens com Lucro — Seguradora (Deptos 103/108)
        </SH>
        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 mb-3 text-xs text-blue-700">
          <span className="shrink-0 mt-0.5">ℹ️</span>
          <span>Exibe <strong>todos os itens com lucro</strong> vendidos para seguradoras nos departamentos 103 e 108.</span>
        </div>
        {lucroData.length === 0 ? (
          <div className="text-center text-sm text-slate-300 py-8">Nenhum item com lucro no período</div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className={`grid ${COLS} gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-1 border-b border-slate-100`}>
              <span className="w-5">#</span>
              <span>Código</span><span>Descrição</span><span>Cliente</span>
              <span>NF / Transação</span><span>Vendedor</span>
              <span className="text-right">Qtd</span>
              <span className="text-right">Rec. Líq.</span>
              <span className="text-right">Custo</span>
              <span className="text-right">Lucro Bruto</span>
            </div>
            {(lucroExpanded ? lucroData : lucroData.slice(0, 5)).map((item, i) => (
              <ItemRow key={i} item={item} i={i} colorClass="bg-emerald-50/40 hover:bg-emerald-50" />
            ))}
            {lucroData.length > 5 && (
              <button onClick={() => setLucroExpanded(e => !e)}
                className="mt-1 self-center px-4 py-1 rounded-full text-[11px] font-bold text-emerald-600 border border-emerald-200 hover:bg-emerald-50 transition-all">
                {lucroExpanded ? 'Mostrar menos' : `Mostrar mais (${lucroData.length - 5} restantes)`}
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
