import { periodoKey } from './comissoesCalculoPeriodoStorage';
import {
  DEPTO_LABELS, DEPTOS, tituloEfetivo, type PlantaoDepto,
  loadColaboradores as loadPlantaoColaboradores,
  loadSelecao, loadTitulos as loadPlantaoTitulos, loadLancamentos as loadPlantaoLancamentos,
} from './plantaoSabadoStorage';
import {
  loadColaboradores as loadPesquisaColaboradores,
  loadRespostas, loadTitulos as loadPesquisaTitulos, loadLancamentos as loadPesquisaLancamentos,
} from './pesquisaCemStorage';
import {
  loadColaboradores as loadDiversosColaboradores,
  loadPremiacoes, loadTitulos as loadDiversosTitulos, loadLancamentos as loadDiversosLancamentos,
} from './diversosStorage';
import type { CampoAssinaturaComissao } from './comissoesLancamentosStorage';

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const CAMPO_LABELS: Record<CampoAssinaturaComissao, string> = {
  financeiro:         'Financeiro',
  gerenciaComercial:  'Gerência Comercial',
  diretoriaComercial: 'Diretoria Comercial',
  diretoria:          'Diretoria',
};
const CAMPOS_ASSINATURA = Object.keys(CAMPO_LABELS) as CampoAssinaturaComissao[];

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

type AssinaturasMap = Partial<Record<CampoAssinaturaComissao, { username: string; name?: string; dataHora: string }>>;

function headerHtml(titulo: string, competencia: string, pago: boolean, totalGeral: number): string {
  return `<div style="background:#1e293b;color:white;border-radius:10px;overflow:hidden;margin-bottom:10px;">
    <div style="padding:14px 18px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div><p style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 3px;">Demonstrativo de Prêmio</p>
        <p style="font-size:15px;font-weight:700;margin:0;">${escapeHtml(titulo || '(sem título)')}</p></div>
      <div style="text-align:right;"><p style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 3px;">Competência</p>
        <p style="font-size:15px;font-weight:700;margin:0;">${competencia}</p></div>
    </div>
    <div style="background:#0f172a;padding:6px 18px;"><span style="background:${pago ? '#d1fae5' : '#fef3c7'};color:${pago ? '#065f46' : '#92400e'};padding:2px 8px;border-radius:20px;font-size:7.5px;font-weight:700;">${pago ? 'Pago' : 'Pendente'}</span>
      <span style="margin-left:8px;font-size:8px;color:#cbd5e1;">Total: R$ ${fmtBRL(totalGeral)}</span></div>
  </div>`;
}

function assinaturasHtml(assinaturas: AssinaturasMap | undefined): string {
  const camposHtml = CAMPOS_ASSINATURA.map(key => {
    const ass = assinaturas?.[key];
    if (ass) {
      const dt = new Date(ass.dataHora).toLocaleString('pt-BR');
      return `<div><p style="font-size:7px;font-weight:600;color:#475569;margin:0 0 4px;">${CAMPO_LABELS[key]}</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:6px 8px;">
          <p style="font-size:7.5px;color:#15803d;font-weight:600;margin:0;">${escapeHtml(ass.name || ass.username)}</p>
          <p style="font-size:7px;color:#16a34a;margin:2px 0 0;">${dt}</p>
          <p style="font-size:6.5px;font-weight:700;color:#15803d;margin:3px 0 0;">&#10003; ASSINATURA ELETRÔNICA</p>
        </div></div>`;
    }
    return `<div><p style="font-size:7px;font-weight:600;color:#475569;margin:0 0 4px;">${CAMPO_LABELS[key]}</p>
      <div style="border:1.5px dashed #cbd5e1;border-radius:6px;padding:8px;text-align:center;"><p style="font-size:7px;color:#94a3b8;margin:0;">—</p></div></div>`;
  }).join('');
  return `<div style="margin-top:12px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;">
    <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 8px;">ASSINATURAS</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">${camposHtml}</div>
  </div>`;
}

const tdB = 'padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:9px;';
const thS = (align = 'left') => `background:#334155;color:white;padding:5px 8px;font-size:8px;font-weight:600;text-align:${align};`;
const tfB = 'background:#1e293b;color:white;padding:6px 8px;font-size:9px;font-weight:700;';

// ─── Plantão aos Sábados ──────────────────────────────────────────────────────
interface LinhaValorDepto { nome: string; funcao: string; departamento: PlantaoDepto; unidades: number; total: number; }

function buildBlocoUnidades(titulo: string, competencia: string, pago: boolean, assinaturas: AssinaturasMap | undefined, linhas: LinhaValorDepto[], unidadesLabel: string): string {
  const deptosPresentes = DEPTOS.filter(dep => linhas.some(l => l.departamento === dep));
  const showTotal = deptosPresentes.length >= 2;
  const totaisDep: Record<string, number> = {};
  deptosPresentes.forEach(d => { totaisDep[d] = 0; });
  let totalGeral = 0;
  let totalUnid = 0;
  const rowsHtml = linhas.map(l => {
    totalGeral += l.total; totaisDep[l.departamento] += l.total; totalUnid += l.unidades;
    const depCells = deptosPresentes.map(d => `<td style="${tdB}text-align:right;">${l.departamento === d ? 'R$ ' + fmtBRL(l.total) : '<span style=\"color:#cbd5e1\">—</span>'}</td>`).join('');
    const totalCell = showTotal ? `<td style="${tdB}text-align:right;font-weight:700;color:#6d28d9;">R$ ${fmtBRL(l.total)}</td>` : '';
    return `<tr>
      <td style="${tdB}">${escapeHtml(l.nome)}</td>
      <td style="${tdB}color:#64748b;">${escapeHtml(l.funcao || '—')}</td>
      <td style="${tdB}text-align:center;color:#64748b;">${l.unidades}</td>
      ${depCells}${totalCell}
    </tr>`;
  }).join('');
  const depTh = deptosPresentes.map(d => `<th style="${thS('right')}">Prêmio ${DEPTO_LABELS[d]}</th>`).join('');
  const totalTh = showTotal ? `<th style="${thS('right')}">Prêmio Total</th>` : '';
  const depTf = deptosPresentes.map(d => `<td style="${tfB}text-align:right;">R$ ${fmtBRL(totaisDep[d])}</td>`).join('');
  const totalTf = showTotal ? `<td style="${tfB}text-align:right;">R$ ${fmtBRL(totalGeral)}</td>` : '';

  return `${headerHtml(titulo, competencia, pago, totalGeral)}
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr><th style="${thS()}">Colaborador</th><th style="${thS()}">Função</th><th style="${thS('center')}">${unidadesLabel}</th>${depTh}${totalTh}</tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr><td style="${tfB}" colspan="2">Total</td><td style="${tfB}text-align:center;">${totalUnid}</td>${depTf}${totalTf}</tr></tfoot>
    </table>
    ${assinaturasHtml(assinaturas)}`;
}

async function buildPlantaoBlock(year: number, month: number): Promise<string> {
  const pk = periodoKey(year, month);
  const [colaboradores, selecao, titulos, lancamentos] = await Promise.all([
    loadPlantaoColaboradores(), loadSelecao(), loadPlantaoTitulos(), loadPlantaoLancamentos(),
  ]);
  const lancamento = lancamentos[pk];
  const pago = lancamento?.pago ?? false;
  const selForPk = selecao[pk] ?? {};
  const linhasLive: LinhaValorDepto[] = colaboradores
    .map(c => { const dias = selForPk[c.id] ?? []; return { nome: c.nome, funcao: c.funcao, departamento: c.departamento, unidades: dias.length, total: c.valorPorSabado * dias.length }; })
    .filter(l => l.unidades > 0);
  const linhas: LinhaValorDepto[] = pago && lancamento?.snapshotLinhas?.length
    ? lancamento.snapshotLinhas.map(s => ({ nome: s.nome, funcao: s.funcao, departamento: s.departamento, unidades: s.dias.length, total: s.total }))
    : linhasLive;
  if (linhas.length === 0) return '';
  const titulo = pago && lancamento?.titulo ? lancamento.titulo : tituloEfetivo(titulos, year, month);
  const competencia = `${MONTH_NAMES[month - 1]} de ${year}`;
  return buildBlocoUnidades(titulo, competencia, pago, lancamento?.assinaturas, linhas.sort((a, b) => a.nome.localeCompare(b.nome)), 'Dias');
}

// ─── Pesquisa CEM ─────────────────────────────────────────────────────────────
async function buildPesquisaBlock(year: number, month: number): Promise<string> {
  const pk = periodoKey(year, month);
  const [colaboradores, respostas, titulos, lancamentos] = await Promise.all([
    loadPesquisaColaboradores(), loadRespostas(), loadPesquisaTitulos(), loadPesquisaLancamentos(),
  ]);
  const lancamento = lancamentos[pk];
  const pago = lancamento?.pago ?? false;
  const respForPk = respostas[pk] ?? {};
  const linhasLive: LinhaValorDepto[] = colaboradores
    .map(c => { const qtd = respForPk[c.id] ?? 0; return { nome: c.nome, funcao: c.funcao, departamento: c.departamento, unidades: qtd, total: c.valorPorPesquisa * qtd }; })
    .filter(l => l.unidades > 0);
  const linhas: LinhaValorDepto[] = pago && lancamento?.snapshotLinhas?.length
    ? lancamento.snapshotLinhas.map(s => ({ nome: s.nome, funcao: s.funcao, departamento: s.departamento, unidades: s.qtd, total: s.total }))
    : linhasLive;
  if (linhas.length === 0) return '';
  const titulo = pago && lancamento?.titulo ? lancamento.titulo : tituloEfetivo(titulos, year, month);
  const competencia = `${MONTH_NAMES[month - 1]} de ${year}`;
  return buildBlocoUnidades(titulo, competencia, pago, lancamento?.assinaturas, linhas.sort((a, b) => a.nome.localeCompare(b.nome)), 'Pesquisas');
}

// ─── Diversos ─────────────────────────────────────────────────────────────────
interface LinhaDiversos { nome: string; funcao: string; motivo: string; departamento: PlantaoDepto; valor: number; }

async function buildDiversosBlock(year: number, month: number): Promise<string> {
  const pk = periodoKey(year, month);
  const [colaboradores, premiacoes, titulos, lancamentos] = await Promise.all([
    loadDiversosColaboradores(), loadPremiacoes(), loadDiversosTitulos(), loadDiversosLancamentos(),
  ]);
  const lancamento = lancamentos[pk];
  const pago = lancamento?.pago ?? false;
  const premForPk = premiacoes[pk] ?? {};
  const linhasLive: LinhaDiversos[] = colaboradores
    .map(c => { const p = premForPk[c.id]; return { nome: c.nome, funcao: c.funcao, motivo: p?.motivo ?? '', departamento: p?.departamento ?? 'novos', valor: p?.valor ?? 0 }; })
    .filter(l => l.valor > 0);
  const linhas: LinhaDiversos[] = pago && lancamento?.snapshotLinhas?.length
    ? lancamento.snapshotLinhas.map(s => ({ nome: s.nome, funcao: s.funcao, motivo: s.motivo, departamento: s.departamento, valor: s.valor }))
    : linhasLive;
  if (linhas.length === 0) return '';
  const titulo = pago && lancamento?.titulo ? lancamento.titulo : tituloEfetivo(titulos, year, month);
  const competencia = `${MONTH_NAMES[month - 1]} de ${year}`;
  linhas.sort((a, b) => a.nome.localeCompare(b.nome));

  let totalGeral = 0;
  const rowsHtml = linhas.map(l => {
    totalGeral += l.valor;
    return `<tr>
      <td style="${tdB}">${escapeHtml(l.nome)}</td>
      <td style="${tdB}color:#64748b;">${escapeHtml(l.funcao || '—')}</td>
      <td style="${tdB}color:#64748b;">${escapeHtml(l.motivo || '—')}</td>
      <td style="${tdB}">${DEPTO_LABELS[l.departamento]}</td>
      <td style="${tdB}text-align:right;font-weight:700;color:#6d28d9;">R$ ${fmtBRL(l.valor)}</td>
    </tr>`;
  }).join('');

  return `${headerHtml(titulo, competencia, pago, totalGeral)}
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr><th style="${thS()}">Colaborador</th><th style="${thS()}">Função</th><th style="${thS()}">Motivo da Bonificação</th><th style="${thS()}">Departamento</th><th style="${thS('right')}">Valor</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr><td style="${tfB}" colspan="4">Total</td><td style="${tfB}text-align:right;">R$ ${fmtBRL(totalGeral)}</td></tr></tfoot>
    </table>
    ${assinaturasHtml(lancamento?.assinaturas)}`;
}

/**
 * Imprime todos os demonstrativos de Prêmios (Plantão, Pesquisa CEM, Diversos)
 * para a competência informada, um por página. Retorna quantos foram impressos.
 */
export async function printAllPremios(year: number, month: number): Promise<number> {
  const blocks = (await Promise.all([
    buildPlantaoBlock(year, month),
    buildPesquisaBlock(year, month),
    buildDiversosBlock(year, month),
  ])).filter(b => b.length > 0);

  if (blocks.length === 0) return 0;

  const html = blocks
    .map((b, i) => `<div style="${i < blocks.length - 1 ? 'page-break-after: always;' : ''}">${b}</div>`)
    .join('');

  const root = document.getElementById('print-root');
  if (!root) { window.print(); return blocks.length; }
  root.innerHTML = `<div style="font-family:Inter,system-ui,sans-serif;">${html}</div>`;
  const style = document.createElement('style');
  style.textContent = `@page { size: A4 portrait; margin: 1cm; } #print-root { font-family: Inter, system-ui, sans-serif; }
    #print-root, #print-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; forced-color-adjust: none !important; color-scheme: light !important; }`;
  document.head.appendChild(style);
  window.onafterprint = () => { document.head.removeChild(style); root.innerHTML = ''; window.onafterprint = null; };
  window.print();
  return blocks.length;
}
