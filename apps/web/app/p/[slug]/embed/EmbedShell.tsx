'use client';

import { useEffect, useMemo } from 'react';
import { generatePrimaryPalette, paletteToCss } from '@/lib/embed-palette';
import { providerThemeVars, providerThemeDarkVars } from '@/lib/providerTheme';

interface EmbedShellProps {
  /** Hex color (with or without #) for the primary palette override. */
  primaryColor?: string | null;
  /**
   * Thème choisi par le professionnel. Sert de DÉFAUT quand l'intégration
   * ne porte pas de `?primaryColor` : les codes d'intégration déjà collés
   * sur les sites des pros continuent de gagner, mais un nouvel embed hérite
   * de la couleur de la vitrine sans rien à configurer.
   */
  themeId?: string | null;
  /** Border radius in px (0-24). Default: 12. */
  radius?: number | null;
  /** Force a theme regardless of host prefers-color-scheme. Default: 'light'. */
  theme?: 'light' | 'dark' | 'auto';
  /** Provider id, used to report an embed view analytics event. */
  providerId?: string;
  children: React.ReactNode;
}

// Non-literal type widens from the string union — helps when reading from URL.
export type EmbedTheme = 'light' | 'dark' | 'auto';

/**
 * Wrapper for the embeddable booking widget page. Responsibilities:
 *  1. Inject CSS variables that override the primary palette + border radius.
 *  2. Post the content height to the parent window so embed.js can auto-size the iframe.
 *  3. Toggle the `dark` class on <html> based on the theme param.
 *  4. Track an "embed view" analytics event (separate from direct page views).
 */
export function EmbedShell({
  primaryColor,
  themeId,
  radius = 12,
  theme = 'light',
  providerId,
  children,
}: EmbedShellProps) {

  // Generate and inject the primary palette as CSS variables
  const paletteCss = useMemo(() => {
    // Le paramètre explicite l'emporte : il vient d'un code d'intégration
    // déjà en place sur le site d'un professionnel, le casser serait une
    // régression visible chez lui. À défaut, on sert la gamme curatée du
    // thème — dessinée et éprouvée, là où `generatePrimaryPalette` déduit
    // ses nuances de paliers de luminosité fixes.
    if (primaryColor) return paletteToCss(generatePrimaryPalette(primaryColor));
    // `paletteToCss` renvoie une RÈGLE complète (`:root { … }`) là où
    // `providerThemeVars` ne renvoie que des déclarations. Les injecter
    // telles quelles produisait un CSS invalide — sans erreur, sans effet.
    const base = `:root{${providerThemeVars(themeId)}}`;

    // Les gammes trop sombres pour un fond sombre — le thème « Noir » — ont
    // des nuances de remplacement. Sans elles, l'aplat primary-600 se confond
    // avec le fond du widget et le bouton disparaît.
    //
    // Ciblé par la CLASSE `dark` et non par une media query : c'est ainsi que
    // cet écran bascule, et pour les TROIS modes. `theme=dark` l'ajoute,
    // `theme=light` la retire, `theme=auto` la suit du site hôte. Une media
    // query aurait appliqué le correctif sur un widget forcé en clair chez un
    // visiteur dont le système est sombre.
    const dark = providerThemeDarkVars(themeId);
    return dark ? `${base}:root.dark{${dark}}` : base;
  }, [primaryColor, themeId]);

  // Clamp radius to [0, 32]
  const clampedRadius = Math.max(0, Math.min(32, typeof radius === 'number' ? radius : 12));

  // Toggle dark mode based on theme param
  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else if (theme === 'light') {
      html.classList.remove('dark');
    } else {
      // 'auto' → follow host prefers-color-scheme
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = () => {
        if (mq.matches) html.classList.add('dark');
        else html.classList.remove('dark');
      };
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  // Report height to parent on every layout change via ResizeObserver
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sendHeight = () => {
      const h = document.documentElement.scrollHeight;
      try {
        window.parent.postMessage(
          { type: 'opatam-embed-height', height: h },
          '*'
        );
      } catch {
        // Parent is cross-origin and doesn't accept this message — ignore silently.
      }
    };

    // Send once on mount + an initial delayed send to catch images/fonts loaded later
    sendHeight();
    const initialTimer = setTimeout(sendHeight, 250);
    const secondTimer = setTimeout(sendHeight, 1000);

    const ro = new ResizeObserver(() => sendHeight());
    ro.observe(document.documentElement);
    ro.observe(document.body);

    // Also listen for images finishing load
    const imgs = document.querySelectorAll('img');
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener('load', sendHeight, { once: true });
    });

    // Announce we're ready so embed.js can stop showing its loading skeleton
    try {
      window.parent.postMessage({ type: 'opatam-embed-ready' }, '*');
    } catch { /* no-op */ }

    return () => {
      ro.disconnect();
      clearTimeout(initialTimer);
      clearTimeout(secondTimer);
    };
  }, []);

  // Report a single "embed view" event for the provider
  useEffect(() => {
    if (!providerId) return;
    const key = `embed_pv_${providerId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    fetch('/api/analytics/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, source: 'embed' }),
    }).catch(() => {});
  }, [providerId]);

  return (
    <>
      {/* Override primary palette for the whole page */}
      <style dangerouslySetInnerHTML={{ __html: paletteCss }} />
      {/* Expose the configured radius as a CSS variable components can opt into */}
      <style
        dangerouslySetInnerHTML={{
          __html: `:root { --embed-radius: ${clampedRadius}px; }`,
        }}
      />
      <div>{children}</div>
    </>
  );
}
