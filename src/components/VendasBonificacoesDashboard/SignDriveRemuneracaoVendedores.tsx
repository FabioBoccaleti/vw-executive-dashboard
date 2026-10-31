import { useEffect, useMemo, useState } from 'react';
import {
  loadSignDriveSalariosFixos,
  loadSignDriveRegras,
  loadSignDriveVendedores,
  loadSignDriveTiposVenda,
  type SalarioFixoSignDrive,
  type VigenciaSalarioSignDrive,
  type RegraRemuneracaoSignDrive,
  type Vendedor,
  type TipoVendaSignDrive,
} from '@/components/CadastrosPage/cadastrosStorage';
import { loadVendasDsr, type VendasDsrConfig } from './vendedoresRemuneracaoStorage';
import { computeEstimativas, comissaoVendedorValor, parseBR } from './signDriveComissaoVendedor';
import type { AssinaturaRow } from './assinaturaStorage';

function fmtCurrency(n: number): string {
  return (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseDataBR(s: string): { d: number; m: number; y: number } | null {
  const mm = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s ?? '').trim());
  if (!mm) return null;
  return { d: +mm[1], m: +mm[2], y: +mm[3] };
}

const toComparable = (ano: number, mes: number) => ano * 12 + mes;

function sortVigencias(vigs: VigenciaSalarioSignDrive[]): VigenciaSalarioSignDrive[] {
  return [...vigs].sort((a, b) => toComparable(a.anoInicio, a.mesInicio) - toComparable(b.anoInicio, b.mesInicio));
}

/** Vigência vigente no mês (a mais recente cujo início já ocorreu); null se nenhuma. */
function vigenciaForMonth(item: SalarioFixoSignDrive, ano: number, mes: number): VigenciaSalarioSignDrive | null {
  const ref = toComparable(ano, mes);
  let current: VigenciaSalarioSignDrive | null = null;
  for (const v of sortVigencias(item.vigencias ?? [])) {
    if (toComparable(v.anoInicio, v.mesInicio) <= ref) current = v;
  }
  return current;
}

/** Colaborador está ativo no mês (período de validade cobre o mês). */
function isActiveInMonth(item: SalarioFixoSignDrive, ano: number, mes: number): boolean {
  const ref = toComparable(ano, mes);
  const start = item.anoInicio && item.mesInicio ? toComparable(item.anoInicio, item.mesInicio) : -Infinity;
  const end = item.anoFim && item.mesFim ? toComparable(item.anoFim, item.mesFim) : Infinity;
  return ref >= start && ref <= end;
}

function dsrPctFor(configs: VendasDsrConfig[], ano: number, mes: number): number {
  const cfg = configs.find(c => c.ano === ano && c.mes === mes);
  return cfg ? (parseFloat(cfg.percentual) || 0) : 0;
}

export interface RemuneracaoRow {
  name: string;
  hasCadastro: boolean;
  salary: number;
  commission: number;
  dsr: number;
  comissoesDSR: number;
  benefits: number;
  encCadastrados: number;
  encComissao: number;
  encargosTotal: number;
  total: number;
}

export interface RemuneracaoTotals {
  salary: number;
  benefits: number;
  encCadastrados: number;
  commission: number;
  dsr: number;
  comissoesDSR: number;
  encComissao: number;
  encargosTotal: number;
  total: number;
}

/**
 * Calcula a remuneração por vendedor do Sign&Drive para o período (mês ou ano):
 * salário fixo/benefícios/encargos conforme vigência do cadastro de Salário Fixo,
 * comissões pela Data da Venda, DSR e encargos sobre comissões conforme Central de Vendas VW.
 */
export function useSignDriveRemuneracao(
  rows: AssinaturaRow[],
  year: number,
  periodo: number | 'ano',
): { data: RemuneracaoRow[]; totals: RemuneracaoTotals } {
  const [salarios, setSalarios] = useState<SalarioFixoSignDrive[]>([]);
  const [regras, setRegras] = useState<RegraRemuneracaoSignDrive[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [tiposVenda, setTiposVenda] = useState<TipoVendaSignDrive[]>([]);
  const [dsrConfigs, setDsrConfigs] = useState<VendasDsrConfig[]>([]);

  useEffect(() => {
    loadSignDriveSalariosFixos().then(setSalarios);
    loadSignDriveRegras().then(setRegras);
    loadSignDriveVendedores().then(setVendedores);
    loadSignDriveTiposVenda().then(setTiposVenda);
    loadVendasDsr().then(setDsrConfigs);
  }, []);

  const { values } = useMemo(
    () => computeEstimativas(rows, regras, vendedores, tiposVenda),
    [rows, regras, vendedores, tiposVenda],
  );

  const data = useMemo<RemuneracaoRow[]>(() => {
    const months = periodo === 'ano' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [periodo];

    // Comissão por vendedor por mês (atribuída pela Data da Venda).
    const commByVM = new Map<string, Map<number, number>>();
    for (const row of rows) {
      const p = parseDataBR(row.dataVenda);
      if (!p || p.y !== year) continue;
      if (periodo !== 'ano' && p.m !== periodo) continue;
      const name = (row.vendedor ?? '').trim();
      if (!name) continue;
      const val = comissaoVendedorValor(row, values);
      if (!val) continue;
      if (!commByVM.has(name)) commByVM.set(name, new Map());
      const mm = commByVM.get(name)!;
      mm.set(p.m, (mm.get(p.m) ?? 0) + val);
    }

    const colabByName = new Map(salarios.map(c => [c.nome.trim(), c] as const));

    // Nomes a exibir: colaboradores ativos em algum mês do período + vendedores com comissão.
    const names = new Set<string>();
    for (const colab of salarios) {
      if (months.some(m => isActiveInMonth(colab, year, m))) names.add(colab.nome.trim());
    }
    for (const name of commByVM.keys()) names.add(name);

    const result: RemuneracaoRow[] = [];
    for (const name of names) {
      const colab = colabByName.get(name) ?? null;
      let salary = 0, benefits = 0, encCadastrados = 0, commission = 0, dsr = 0, encComissao = 0;

      for (const m of months) {
        if (colab && isActiveInMonth(colab, year, m)) {
          const vig = vigenciaForMonth(colab, year, m);
          if (vig) {
            salary += parseBR(vig.salarioFixo);
            benefits += parseBR(vig.planoSaude) + parseBR(vig.valeTransporte);
            encCadastrados += parseBR(vig.encargosProvisoes);
          }
        }
        const commMonth = commByVM.get(name)?.get(m) ?? 0;
        const pct = dsrPctFor(dsrConfigs, year, m);
        const dsrMonth = commMonth * pct / 100;
        const base = commMonth + dsrMonth;
        // Mesma lógica do Central de Vendas VW: Provisões = base * 7/36; Encargos = (base + provisões) * 35,8%.
        const provisoes = base * (7 / 36);
        const encargos = (base + provisoes) * 0.358;
        commission += commMonth;
        dsr += dsrMonth;
        encComissao += provisoes + encargos;
      }

      const comissoesDSR = commission + dsr;
      const encargosTotal = encCadastrados + encComissao;
      const total = salary + comissoesDSR + benefits + encargosTotal;

      if (total === 0 && commission === 0 && salary === 0) continue;
      result.push({ name, hasCadastro: !!colab, salary, commission, dsr, comissoesDSR, benefits, encCadastrados, encComissao, encargosTotal, total });
    }

    return result.sort((a, b) => b.total - a.total);
  }, [rows, values, salarios, dsrConfigs, year, periodo]);

  const totals = useMemo<RemuneracaoTotals>(() => data.reduce((acc, r) => ({
    salary: acc.salary + r.salary,
    benefits: acc.benefits + r.benefits,
    encCadastrados: acc.encCadastrados + r.encCadastrados,
    commission: acc.commission + r.commission,
    dsr: acc.dsr + r.dsr,
    comissoesDSR: acc.comissoesDSR + r.comissoesDSR,
    encComissao: acc.encComissao + r.encComissao,
    encargosTotal: acc.encargosTotal + r.encargosTotal,
    total: acc.total + r.total,
  }), { salary: 0, benefits: 0, encCadastrados: 0, commission: 0, dsr: 0, comissoesDSR: 0, encComissao: 0, encargosTotal: 0, total: 0 }), [data]);

  return { data, totals };
}

export function SignDriveRemuneracaoVendedores({
  data,
  totals,
  periodoLabel,
}: {
  data: RemuneracaoRow[];
  totals: RemuneracaoTotals;
  periodoLabel: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-700">
          Remuneração por vendedor <span className="text-xs font-normal text-slate-400">· {periodoLabel}</span>
        </h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Salário fixo e benefícios conforme cadastro (vigência do mês); comissões pela Data da Venda; DSR e encargos sobre comissões conforme Central de Vendas VW.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500">Vendedor</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Salário Fixo</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Comissões + DSR</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Benefícios</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Encargos</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-400 text-xs py-8">Nenhum vendedor com salário cadastrado ou comissão no período.</td></tr>
            ) : data.map(r => (
              <tr key={r.name} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-5 py-2.5 font-medium text-slate-700">
                  {r.name}
                  {!r.hasCadastro && <span className="ml-2 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 align-middle">sem cadastro</span>}
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{fmtCurrency(r.salary)}</td>
                <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">
                  {fmtCurrency(r.comissoesDSR)}
                  {(r.commission > 0 || r.dsr > 0) && (
                    <span className="block text-[10px] text-slate-400">com. {fmtCurrency(r.commission)} · DSR {fmtCurrency(r.dsr)}</span>
                  )}
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{fmtCurrency(r.benefits)}</td>
                <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">
                  {fmtCurrency(r.encargosTotal)}
                  {(r.encCadastrados > 0 || r.encComissao > 0) && (
                    <span className="block text-[10px] text-slate-400">cad. {fmtCurrency(r.encCadastrados)} · s/ com. {fmtCurrency(r.encComissao)}</span>
                  )}
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-slate-800">{fmtCurrency(r.total)}</td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                <td className="px-5 py-3 text-slate-800">Total</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-800">{fmtCurrency(totals.salary)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-800">{fmtCurrency(totals.comissoesDSR)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-800">{fmtCurrency(totals.benefits)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-800">{fmtCurrency(totals.encargosTotal)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-blue-700">{fmtCurrency(totals.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
