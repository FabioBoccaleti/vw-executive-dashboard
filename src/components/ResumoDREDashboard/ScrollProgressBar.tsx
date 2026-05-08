import { useEffect, RefObject } from 'react';

interface ScrollProgressBarProps {
  scrollRef: RefObject<HTMLDivElement>;
  color: string;
}

/**
 * Barra de progresso de scroll usando position:fixed com coordenadas dinamicas.
 * Bypassa overflow:hidden dos containers pais.
 */
export function ScrollProgressBar({ scrollRef, color }: ScrollProgressBarProps) {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const track = document.createElement('div');
    track.className = 'scroll-progress-track';
    track.style.cssText = 'position:fixed;top:0;left:0;width:5px;z-index:9999;pointer-events:none;background-color:#e2e8f0;';

    const bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;top:0;left:0;right:0;height:0%;background-color:' + color + ';transition:height 80ms linear;';
    track.appendChild(bar);
    document.body.appendChild(track);

    const update = () => {
      const rect = el.getBoundingClientRect();
      track.style.left = rect.left + 'px';
      track.style.top = rect.top + 'px';
      track.style.height = rect.height + 'px';
      const max = el.scrollHeight - el.clientHeight;
      bar.style.height = (max > 0 ? (el.scrollTop / max) * 100 : 0) + '%';
    };

    const ro = new ResizeObserver(update);
    ro.observe(el);
    ro.observe(document.body);
    update();
    el.addEventListener('scroll', update, { passive: true });

    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      if (track.parentNode) track.parentNode.removeChild(track);
    };
  }, [scrollRef, color]);

  return null;
}
