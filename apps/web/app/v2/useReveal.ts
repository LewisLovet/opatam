'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Révèle un élément à son entrée dans le viewport, une seule fois.
 *
 * Un `IntersectionObserver` plutôt qu'un écouteur de défilement : le
 * navigateur fait le calcul hors du fil principal, et une page qui compte
 * une trentaine d'éléments révélés ne paie donc rien à chaque pixel
 * défilé.
 *
 * `rootMargin` négatif en bas : l'élément se révèle quand il est
 * franchement entré, pas dès que son premier pixel affleure — sinon
 * l'animation se joue hors du regard.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Sans IntersectionObserver (navigateur ancien), on montre tout de
    // suite : mieux vaut perdre l'animation que le contenu.
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, shown };
}

/**
 * Compte de 0 à `to` à l'entrée dans le viewport.
 *
 * L'animation avance avec `requestAnimationFrame` et une courbe
 * d'atténuation : un incrément linéaire par intervalle donnerait une
 * progression mécanique, et un `setInterval` dériverait sur les écrans à
 * 120 Hz.
 */
export function useCountUp(to: number, durationMs = 1400) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!shown) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      // easeOutCubic : démarre vite, se pose doucement sur la valeur finale.
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, to, durationMs]);

  return { ref, value };
}
