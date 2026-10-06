// Impressão com auto-ajuste: antes de abrir o diálogo de impressão, cada página
// (`.print-page`) do #print-root é medida e a sua tabela é ajustada para
// preencher a folha A4 paisagem de forma consistente, independentemente da
// quantidade de meses/colunas:
//   1. A fonte da tabela é reduzida (quando necessário) só o suficiente para que
//      todas as colunas caibam na largura da página — assim as colunas, que já
//      têm largura igual (table-layout: fixed), ocupam toda a largura.
//   2. A altura da tabela é esticada para preencher toda a altura útil da página,
//      evitando o espaço vazio no rodapé quando há muitos meses.
// O resultado é visualmente igual para qualquer mês selecionado.

const PX_PER_CM = 96 / 2.54; // ~37.7953 px por cm a 96 dpi

// Área útil da página — precisa espelhar o @page de public/print.css
// (size A4 landscape; margin 0.8cm 0.7cm).
const A4_LANDSCAPE_W_CM = 29.7;
const A4_LANDSCAPE_H_CM = 21;
const MARGIN_X_CM = 0.7;
const MARGIN_Y_CM = 0.8;

// Fonte base das tabelas de impressão (igual ao markup das PrintDeptTable).
const BASE_FONT_PT = 7.5;

// Margens de segurança para evitar estouro por arredondamento de layout.
const WIDTH_SAFETY = 0.985;
const FILL_SAFETY = 0.98;

export function printWithAutoFit(): void {
  const root = document.getElementById('print-root');
  if (!root) {
    window.print();
    return;
  }

  const pages = Array.from(root.querySelectorAll<HTMLElement>('.print-page'));
  if (pages.length === 0) {
    window.print();
    return;
  }

  const pageW = (A4_LANDSCAPE_W_CM - 2 * MARGIN_X_CM) * PX_PER_CM;
  const pageH = (A4_LANDSCAPE_H_CM - 2 * MARGIN_Y_CM) * PX_PER_CM;

  // Guarda estilos inline do container para restaurar depois da medição.
  const prev = {
    display: root.style.display,
    position: root.style.position,
    left: root.style.left,
    top: root.style.top,
    width: root.style.width,
    visibility: root.style.visibility,
  };

  // Torna o #print-root mensurável fora da tela, na largura real da página.
  root.style.display = 'block';
  root.style.position = 'fixed';
  root.style.left = '-10000px';
  root.style.top = '0';
  root.style.width = `${pageW}px`;
  root.style.visibility = 'hidden';

  pages.forEach(p => p.style.removeProperty('zoom'));

  const tables: HTMLTableElement[] = [];

  pages.forEach(page => {
    const table = page.querySelector('table') as HTMLTableElement | null;
    if (!table) return;
    tables.push(table);

    table.style.removeProperty('height');
    table.style.fontSize = `${BASE_FONT_PT}pt`;

    // 1) Largura natural do conteúdo (layout automático respeita o conteúdo).
    table.style.tableLayout = 'auto';
    const naturalW = table.scrollWidth;

    // 2) Layout fixo: colunas de largura igual ocupando 100% da largura.
    table.style.tableLayout = 'fixed';

    // Reduz a fonte só o necessário para o conteúdo caber na largura da página.
    const widthScale = naturalW > 0 ? (pageW / naturalW) * WIDTH_SAFETY : 1;
    if (widthScale < 1) {
      table.style.fontSize = `${(BASE_FONT_PT * widthScale).toFixed(2)}pt`;
    }

    // Altura disponível para a tabela = página útil menos cabeçalho/rodapé.
    let tableH = table.offsetHeight;
    let availH = pageH * FILL_SAFETY - (page.offsetHeight - tableH);

    // 3a) Se ainda estiver mais alta que o disponível, reduz mais a fonte.
    if (availH > 0 && tableH > availH) {
      const curPt = parseFloat(table.style.fontSize) || BASE_FONT_PT;
      table.style.fontSize = `${(curPt * (availH / tableH)).toFixed(2)}pt`;
      tableH = table.offsetHeight;
      availH = pageH * FILL_SAFETY - (page.offsetHeight - tableH);
    }

    // 3b) Estica a tabela para preencher toda a altura útil da página.
    if (availH > tableH) {
      table.style.height = `${availH}px`;
    }
  });

  // Restaura o container (os ajustes das tabelas permanecem para a impressão).
  root.style.display = prev.display;
  root.style.position = prev.position;
  root.style.left = prev.left;
  root.style.top = prev.top;
  root.style.width = prev.width;
  root.style.visibility = prev.visibility;

  const cleanup = () => {
    pages.forEach(p => p.style.removeProperty('height'));
    tables.forEach(t => {
      t.style.removeProperty('height');
      t.style.removeProperty('font-size');
      t.style.removeProperty('table-layout');
    });
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  window.print();
}
