import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { processDepartamentoData } from './baseGerencialDataProcessor';
import { getAllImportedMesesData, type Marca, type DeptoClassificacao } from './baseGerencialStorage';

// Contas de custos de rescisões a demonstrar (contas principais, 10 dígitos).
const ACCOUNTS = [
  '4150101008',
  '4150102002',
  '4150102004',
  '5520101008',
  '5510102002',
  '5510102004',
  '5510102008',
  '5520102013',
];

// Departamentos (colunas) — seguem as regras por departamento já existentes.
const DEPTS: { key: DeptoClassificacao; label: string }[] = [
  { key: 'veiculos_novos', label: 'Novos' },
  { key: 'venda_direta', label: 'Venda Direta' },
  { key: 'veiculos_usados', label: 'Usados' },
  { key: 'pecas', label: 'Peças' },
  { key: 'oficina', label: 'Oficina' },
  { key: 'funilaria', label: 'Funilaria' },
  { key: 'administracao', label: 'Administração' },
  { key: 'diretoria', label: 'Diretoria' },
];

interface Props {
  marca: Marca;
  year: number;
}

interface RowData {
  conta: string;
  descricao: string;
  values: Record<string, number>;
  total: number;
}

function fmt(v: number): string {
  if (Math.abs(v) < 0.005) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CustosRescisoesTab({ marca, year }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Processa cada departamento no ano todo (mes = 0), respeitando a
        // classificação de revenda e as regras por departamento. Em paralelo,
        // carrega todos os meses importados (de qualquer ano) para obter a
        // descrição completa das contas mesmo quando o ano selecionado não tem
        // movimento.
        const [results, allMeses] = await Promise.all([
          Promise.all(DEPTS.map(d => processDepartamentoData(marca, d.key, year, 0))),
          getAllImportedMesesData(),
        ]);
        if (!active) return;

        const valueByAccount: Record<string, Record<string, number>> = {};
        const descByAccount: Record<string, string> = {};
        ACCOUNTS.forEach(a => { valueByAccount[a] = {}; });

        // Descrição a partir de qualquer mês importado (independe do ano).
        for (const mesData of allMeses) {
          for (const row of mesData.rows) {
            const m = row.conta.match(/^(\d{6,})\s*-\s*(.+)$/);
            if (!m) continue;
            const num = m[1];
            if (!valueByAccount[num] || descByAccount[num]) continue;
            descByAccount[num] = m[2].replace(/\s*\((?:Revenda|CCusto|Tipo)\).*$/i, '').trim();
          }
        }

        results.forEach((data, di) => {
          const deptKey = DEPTS[di].key;
          for (const grupo of Object.values(data.grupos)) {
            for (const c of grupo.contas) {
              const num = c.conta.match(/^(\d+)/)?.[1];
              if (!num || !valueByAccount[num]) continue;
              valueByAccount[num][deptKey] = (valueByAccount[num][deptKey] ?? 0) + c.valor;
              if (!descByAccount[num]) {
                const idx = c.conta.indexOf('-');
                descByAccount[num] = idx >= 0 ? c.conta.slice(idx + 1).trim() : '';
              }
            }
          }
        });

        const built: RowData[] = ACCOUNTS.map(a => {
          const values = valueByAccount[a] ?? {};
          const total = DEPTS.reduce((s, d) => s + (values[d.key] ?? 0), 0);
          const descricao = descByAccount[a] ? `${a} - ${descByAccount[a]}` : a;
          return { conta: a, descricao, values, total };
        });

        setRows(built);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Erro ao carregar dados');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [marca, year]);

  const columnTotals: Record<string, number> = {};
  DEPTS.forEach(d => { columnTotals[d.key] = rows.reduce((s, r) => s + (r.values[d.key] ?? 0), 0); });
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  const marcaLabel = marca === 'vw' ? 'VW' : 'Audi';

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-red-200 shadow-sm">
        <div className="text-center space-y-2 px-6">
          <p className="text-red-600 font-semibold">Erro ao carregar os dados</p>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Custos de Rescisões</h2>
          <p className="text-xs text-slate-500">{marcaLabel} · Ano {year} · Valores em R$</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 shrink-0"
        >
          <Printer className="h-3.5 w-3.5" /> Imprimir PDF
        </button>
      </div>

      <table className="w-full min-w-[1000px] border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="w-72 border-r border-slate-600 px-2 py-2 text-left font-bold">Conta / Descrição</th>
            {DEPTS.map(d => (
              <th key={d.key} className="border-r border-slate-600 px-2 py-2 text-right font-bold whitespace-nowrap">{d.label}</th>
            ))}
            <th className="px-2 py-2 text-right font-bold">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.conta} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="border-r border-slate-200 px-2 py-1.5 text-left">{r.descricao}</td>
              {DEPTS.map(d => {
                const v = r.values[d.key] ?? 0;
                return (
                  <td key={d.key} className={`border-r border-slate-100 px-2 py-1.5 text-right tabular-nums ${v < 0 ? 'text-red-600' : ''}`}>
                    {fmt(v)}
                  </td>
                );
              })}
              <td className={`px-2 py-1.5 text-right tabular-nums font-semibold ${r.total < 0 ? 'text-red-600' : ''}`}>{fmt(r.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold">
            <td className="border-r border-slate-200 px-2 py-2 text-left">Total</td>
            {DEPTS.map(d => {
              const v = columnTotals[d.key];
              return (
                <td key={d.key} className={`border-r border-slate-200 px-2 py-2 text-right tabular-nums ${v < 0 ? 'text-red-600' : ''}`}>
                  {fmt(v)}
                </td>
              );
            })}
            <td className={`px-2 py-2 text-right tabular-nums ${grandTotal < 0 ? 'text-red-600' : ''}`}>{fmt(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {typeof document !== 'undefined' && document.getElementById('print-root') &&
        createPortal(
          <PrintView
            rows={rows}
            columnTotals={columnTotals}
            grandTotal={grandTotal}
            marcaLabel={marcaLabel}
            year={year}
          />,
          document.getElementById('print-root')!,
        )}
    </div>
  );
}

function PrintView({ rows, columnTotals, grandTotal, marcaLabel, year }: {
  rows: RowData[];
  columnTotals: Record<string, number>;
  grandTotal: number;
  marcaLabel: string;
  year: number;
}) {
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', colorScheme: 'only light' as React.CSSProperties['colorScheme'] }}>
      <div className="print-page">
        <div style={{ backgroundColor: '#065f46', color: 'white', padding: '8px 12px', marginBottom: '6px' }}>
          <div style={{ fontWeight: 700, fontSize: '12pt' }}>Custos de Rescisões — {marcaLabel}</div>
          <div style={{ fontSize: '8pt', opacity: 0.85 }}>Ano {year} · Valores em R$</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
              <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 700, width: '24%' }}>Conta / Descrição</th>
              {DEPTS.map(d => (
                <th key={d.key} style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 700 }}>{d.label}</th>
              ))}
              <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 700 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.conta} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ textAlign: 'left', padding: '3px 6px' }}>{r.descricao}</td>
                {DEPTS.map(d => {
                  const v = r.values[d.key] ?? 0;
                  return (
                    <td key={d.key} style={{ textAlign: 'right', padding: '3px 6px', color: v < 0 ? '#b91c1c' : '#111' }}>{fmt(v)}</td>
                  );
                })}
                <td style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 700, color: r.total < 0 ? '#b91c1c' : '#111' }}>{fmt(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 700 }}>
              <td style={{ textAlign: 'left', padding: '4px 6px' }}>Total</td>
              {DEPTS.map(d => {
                const v = columnTotals[d.key];
                return (
                  <td key={d.key} style={{ textAlign: 'right', padding: '4px 6px', color: v < 0 ? '#b91c1c' : '#111' }}>{fmt(v)}</td>
                );
              })}
              <td style={{ textAlign: 'right', padding: '4px 6px', color: grandTotal < 0 ? '#b91c1c' : '#111' }}>{fmt(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
