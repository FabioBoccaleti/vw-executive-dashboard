// Impressão com auto-ajuste: antes de abrir o diálogo de impressão, mede cada
// página (`.print-page`) do #print-root e aplica um fator de escala (`zoom`)
// para que o conteúdo caiba sempre em exatamente uma folha A4 paisagem,
// independentemente da quantidade de colunas/meses. Dessa forma todos os meses
// ficam consistentes — o sistema ajusta a escala automaticamente.

const PX_PER_CM = 96 / 2.54; // ~37.7953 px por cm a 96 dpi

// Área útil da página — precisa espelhar o @page de public/print.css
// (size A4 landscape; margin 0.8cm 0.7cm).
const A4_LANDSCAPE_W_CM = 29.7;
const A4_LANDSCAPE_H_CM = 21;
const MARGIN_X_CM = 0.7;
const MARGIN_Y_CM = 0.8;

// Margem de segurança para evitar estouro por arredondamento de layout.
const SAFETY = 0.985;

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

  // Mede cada página em tamanho natural e calcula a escala de encaixe.
  const scales = pages.map(p => {
    const h = p.scrollHeight;
    const w = p.scrollWidth;
    const scale = Math.min(1, (pageH / h) * SAFETY, (pageW / w) * SAFETY);
    return scale < 0.999 ? scale : 1;
  });

  pages.forEach((p, i) => {
    if (scales[i] < 1) {
      p.style.setProperty('zoom', String(scales[i]));
    }
  });

  // Restaura o container (o zoom das páginas permanece para a impressão).
  root.style.display = prev.display;
  root.style.position = prev.position;
  root.style.left = prev.left;
  root.style.top = prev.top;
  root.style.width = prev.width;
  root.style.visibility = prev.visibility;

  const cleanup = () => {
    pages.forEach(p => p.style.removeProperty('zoom'));
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  window.print();
}
