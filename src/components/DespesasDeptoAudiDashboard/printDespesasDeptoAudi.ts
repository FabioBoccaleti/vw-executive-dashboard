import {
  getDespesasAdmMes,
  extractByDeptoRule,
  extractByDeptoRuleAll,
  loadClassificacoes,
  loadRegrasDeptos,
  loadObsVw,
  loadObsVendaDireta,
  loadObsAudi,
  loadObsPecas,
  loadObsOficina,
  loadObsFunilaria,
  loadObsAdministracao,
  loadObsDiretoria,
  loadObsConsolidado,
  mergeAssistenciaMedica,
  TIPO_LABELS,
  TIPOS_ORDENADOS,
  DEPTO_TAB_LABELS,
  type TipoClassificacao,
  type DeptoTab,
} from './despesasDeptoAudiStorage';

const MONTHS_FULL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const GRUPO_STYLE: Record<TipoClassificacao, { bg: string; text: string }> = {
  pessoal:             { bg: '#dbeafe', text: '#1e40af' },
  servicos_terceiros:  { bg: '#ede9fe', text: '#5b21b6' },
  ocupacao:            { bg: '#fef3c7', text: '#92400e' },
  funcionamento:       { bg: '#ccfbf1', text: '#0f766e' },
  vendas:              { bg: '#ffedd5', text: '#c2410c' },
  amort_deprec:        { bg: '#e2e8f0', text: '#334155' },
  financeiras:         { bg: '#fee2e2', text: '#991b1b' },
  outras_operacionais: { bg: '#f3f4f6', text: '#374151' },
};

interface TabConfig {
  label: string;
  deptoTab: DeptoTab | 'consolidado';
  color: string;
  loadObs: (year: number, month: number) => Promise<Record<string, string>>;
}

const TABS_CONFIG: TabConfig[] = [
  { label: 'Veículos Novos',  deptoTab: 'veiculos_novos',  color: '#1e40af', loadObs: loadObsVw            },
  { label: 'Venda Direta',    deptoTab: 'venda_direta',    color: '#059669', loadObs: loadObsVendaDireta   },
  { label: 'Veículos Usados', deptoTab: 'veiculos_usados', color: '#b91c1c', loadObs: loadObsAudi          },
  { label: 'Peças',           deptoTab: 'pecas',           color: '#d97706', loadObs: loadObsPecas         },
  { label: 'Oficina',         deptoTab: 'oficina',         color: '#7c3aed', loadObs: loadObsOficina       },
  { label: 'Funilaria',       deptoTab: 'funilaria',       color: '#0891b2', loadObs: loadObsFunilaria     },
  { label: 'Administração',   deptoTab: 'administracao',   color: '#be185d', loadObs: loadObsAdministracao },
  { label: 'Diretoria',       deptoTab: 'diretoria',       color: '#15803d', loadObs: loadObsDiretoria     },
  { label: 'Consolidado (Total)', deptoTab: 'consolidado', color: '#6d28d9', loadObs: loadObsConsolidado  },
];

type ContaRow = { conta: string; valor: number };

function buildGroups(
  valorMap: Map<string, number>,
  classif: Record<string, TipoClassificacao>,
): { activeGroups: TipoClassificacao[]; groups: Map<TipoClassificacao, ContaRow[]>; grandTotal: number } {
  const groups = new Map<TipoClassificacao, ContaRow[]>();
  for (const t of TIPOS_ORDENADOS) groups.set(t, []);
  let grandTotal = 0;
  for (const [conta, valor] of valorMap) {
    if (valor === 0) continue;
    const tipo = classif[conta];
    if (!tipo) continue;
    groups.get(tipo)!.push({ conta, valor });
    grandTotal += valor;
  }
  for (const rows of groups.values()) rows.sort((a, b) => a.conta.localeCompare(b.conta));
  const activeGroups = TIPOS_ORDENADOS.filter(t => (groups.get(t)?.length ?? 0) > 0);
  return { activeGroups, groups, grandTotal };
}

function buildMonthHTML(
  tabLabel: string, tabColor: string, year: number, month: number,
  valorMap: Map<string, number>, classif: Record<string, TipoClassificacao>,
  obs: Record<string, string>,
): string {
  const { activeGroups, groups, grandTotal } = buildGroups(valorMap, classif);
  if (activeGroups.length === 0) return '';

  const periodoLabel = `${MONTHS_FULL[month - 1]} / ${year}`;
  let html = `<div class="header" style="background:${tabColor}"><h1>Despesas por Departamento na Sorana Audi &ndash; ${tabLabel}</h1><h2>${tabLabel} — ${periodoLabel}</h2></div><div class="content">`;

  for (const tipo of activeGroups) {
    const rows = groups.get(tipo)!;
    const subtotal = rows.reduce((s, r) => s + r.valor, 0);
    const { bg, text } = GRUPO_STYLE[tipo];
    html += `<div class="group-block">`;
    html += `<table>
      <colgroup><col class="col-desc"><col class="col-val"><col></colgroup>
      <thead><tr style="background:${bg}">
        <th class="desc" style="color:${text}">${TIPO_LABELS[tipo]}</th>
        <th class="val" style="color:${text}">Valor (R$)</th>
        <th class="obs" style="color:${text}">Observação</th>
      </tr></thead>
      <tbody>`;
    for (const r of rows) {
      const obsText = obs[r.conta] ?? '';
      html += `<tr><td class="desc">${r.conta}</td><td class="val${r.valor < 0 ? ' neg' : ''}">${fmtBRL(r.valor)}</td><td class="obs">${obsText}</td></tr>`;
    }
    html += `</tbody>
      <tfoot><tr style="background:${bg}">
        <td class="desc" style="color:${text};font-weight:700">Subtotal — ${TIPO_LABELS[tipo]}</td>
        <td class="val" style="color:${text};font-weight:700">${fmtBRL(subtotal)}</td>
        <td class="obs"></td>
      </tr></tfoot>
    </table>`;
    html += `</div>`;
  }
  html += `<div class="grand-total"><span>${tabLabel} — ${periodoLabel}</span><span>R$&nbsp;${fmtBRL(grandTotal)}</span></div></div>`;
  return html;
}

function buildYearHTML(
  tabLabel: string, tabColor: string, year: number,
  yearMaps: Map<string, number>[], monthsWithData: number[],
  yearTotal: Map<string, number>, classif: Record<string, TipoClassificacao>,
): string {
  const { activeGroups, groups, grandTotal } = buildGroups(yearTotal, classif);
  if (activeGroups.length === 0) return '';

  let html = `<div class="header" style="background:${tabColor}"><h1>Despesas por Departamento na Sorana Audi &ndash; ${tabLabel}</h1><h2>${tabLabel} — Ano ${year} — Evolução Mensal</h2></div><div class="content">`;

  for (const tipo of activeGroups) {
    const rows = groups.get(tipo)!;
    const subtotal = rows.reduce((s, r) => s + r.valor, 0);
    const { bg, text } = GRUPO_STYLE[tipo];
    // Força nova página antes de "Outras Despesas Operacionais"
    if (tipo === 'outras_operacionais') {
      html += `<div style="page-break-before:always;break-before:page"></div>`;
    }
    html += `<div class="group-block">`;
    html += `<table>
      <thead><tr style="background:${bg}">
        <th class="desc" style="color:${text}">${TIPO_LABELS[tipo]}</th>
        ${monthsWithData.map(m => `<th class="mon" style="color:${text}">${MONTHS_SHORT[m - 1]}</th>`).join('')}
        <th class="tot" style="color:${text}">Total</th>
      </tr></thead>
      <tbody>`;
    for (const r of rows) {
      html += `<tr><td class="desc">${r.conta}</td>`;
      for (const m of monthsWithData) {
        const v = yearMaps[m - 1].get(r.conta) ?? 0;
        html += `<td class="mon${v < 0 ? ' neg' : v === 0 ? ' zero' : ''}">${v === 0 ? '—' : fmtBRL(v)}</td>`;
      }
      html += `<td class="tot${r.valor < 0 ? ' neg' : ''}">${fmtBRL(r.valor)}</td></tr>`;
    }
    // Subtotal row
    html += `<tr style="background:${bg}"><td class="desc" style="color:${text};font-weight:700">Subtotal — ${TIPO_LABELS[tipo]}</td>`;
    for (const m of monthsWithData) {
      const sub = rows.reduce((s, r) => s + (yearMaps[m - 1].get(r.conta) ?? 0), 0);
      html += `<td class="mon" style="color:${text};font-weight:700">${sub === 0 ? '—' : fmtBRL(sub)}</td>`;
    }
    html += `<td class="tot" style="color:${text};font-weight:700">${fmtBRL(subtotal)}</td></tr>`;
    html += `</tbody></table>`;
    html += `</div>`;
  }
  html += `<div class="grand-total"><span>${tabLabel} — Ano ${year}</span><span>R$&nbsp;${fmtBRL(grandTotal)}</span></div></div>`;
  return html;
}

export async function printDespesasDeptoAudi(year: number, month: number): Promise<void> {
  const [classif, regras, ...allMonthDatas] = await Promise.all([
    loadClassificacoes(),
    loadRegrasDeptos(),
    ...Array.from({ length: 12 }, (_, i) => getDespesasAdmMes(year, i + 1)),
  ]);

  const currentData = month > 0 ? allMonthDatas[month - 1] : null;

  const pages: string[] = [];

  for (const tab of TABS_CONFIG) {
    const extract = (data: NonNullable<typeof currentData>) => {
      let m: Map<string, number>;
      if (tab.deptoTab === 'consolidado') {
        m = extractByDeptoRuleAll(data, regras);
      } else {
        m = extractByDeptoRule(data, tab.deptoTab, regras);
      }
      mergeAssistenciaMedica(m);
      return m;
    };

    // Observações do mês selecionado para esta aba
    const obsData = month > 0 ? await tab.loadObs(year, month) : {};

    // Página do mês selecionado
    if (month > 0 && currentData) {
      const html = buildMonthHTML(tab.label, tab.color, year, month, extract(currentData), classif, obsData);
      if (html) pages.push(`<div class="page portrait">${html}</div>`);
    }

    // Página do ano todo (pivot)
    const yearMaps: Map<string, number>[] = Array.from({ length: 12 }, () => new Map());
    const yearTotal = new Map<string, number>();
    const monthsWithData: number[] = [];
    for (let i = 0; i < 12; i++) {
      const data = allMonthDatas[i];
      if (!data) continue;
      const mMap = extract(data);
      yearMaps[i] = mMap;
      monthsWithData.push(i + 1);
      for (const [k, v] of mMap) yearTotal.set(k, (yearTotal.get(k) ?? 0) + v);
    }
    const htmlYear = buildYearHTML(tab.label, tab.color, year, yearMaps, monthsWithData, yearTotal, classif);
    if (htmlYear) pages.push(`<div class="page landscape">${htmlYear}</div>`);
  }

  if (pages.length === 0) return;

  const win = window.open('', '_blank');
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Despesas por Departamento na Sorana Audi — ${year}</title>
  <style>
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 9pt; color: #1e293b; background: white; margin: 0; padding: 0; }

    .page { padding: 1cm; box-sizing: border-box; }
    .page.portrait  { padding: 1cm 1.5cm; width: 210mm; }
    .page.landscape { padding: 1cm; width: 297mm; }
    @media print {
      .page.portrait  { page-break-after: always; break-after: page; }
      .page.landscape { page-break-after: always; break-after: page; }
      .page:last-child { page-break-after: avoid; break-after: avoid; }
      @page           { margin: 0; }
      .page.portrait  { width: 210mm; min-height: 297mm; }
      .page.landscape { width: 297mm; min-height: 210mm; }
    }

    .header { margin-bottom: 10px; padding: 8px 12px; border-bottom: none; border-radius: 3px; }
    .header h1 { font-size: 14pt; font-weight: 800; margin: 0 0 2px; color: white; }
    .header h2 { font-size: 9pt; font-weight: 500; color: rgba(255,255,255,0.8); margin: 0; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 8pt; table-layout: fixed; }
    col.col-desc { width: 220px; }
    col.col-val  { width: 80px; }
    th, td { padding: 3px 6px; border-bottom: 1px solid #e2e8f0; overflow: hidden; }
    th { font-weight: 700; }
    td.desc, th.desc { text-align: left; white-space: nowrap; text-overflow: ellipsis; }
    td.val,  th.val  { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    td.mon,  th.mon  { text-align: right; width: 64px; white-space: nowrap; font-variant-numeric: tabular-nums; }
    td.tot,  th.tot  { text-align: right; width: 86px; white-space: nowrap; font-weight: 700; font-variant-numeric: tabular-nums; }
    td.obs,  th.obs  { text-align: left; white-space: normal; word-wrap: break-word; }
    td.neg { color: #dc2626; }
    td.zero { color: #94a3b8; }
    tfoot td { font-weight: 700; }

    .grand-total {
      display: flex; justify-content: space-between; align-items: center;
      background: #1e293b; color: white;
      padding: 5px 8px; border-radius: 4px;
      font-weight: 700; font-size: 9pt; margin-top: 4px;
    }
    .content { }
    .group-block { page-break-inside: avoid; break-inside: avoid; margin-bottom: 2px; }
    .page.portrait .content { max-width: 160mm; margin: 0 auto; }
    .page.portrait .header  { max-width: 160mm; margin-left: auto; margin-right: auto; }
  </style>
</head>
<body>
  ${pages.join('\n')}
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 700); };<\/script>
</body>
</html>`);
  win.document.close();
}
