'use client';

/**
 * StudioDemoButton — ouvre le tunnel de réservation d'un studio de
 * démonstration, dans la fenêtre modale servie par `/embed.js`.
 *
 * Même mécanique que CamBeautyBookingButton sur /nail-artist : la page
 * charge `/embed.js` en `afterInteractive`, ce qui expose
 * `window.Opatam.open(slug)`. Le visiteur essaie donc le produit réel,
 * avec de vraies salles et de vrais tarifs, sans créer de compte.
 *
 * La différence avec le nail art : Cam Beauty est une cliente réelle, on
 * pouvait retomber sur son site en cas d'échec du script. Ici le repli
 * est la page publique du studio de démonstration — elle rend le même
 * tunnel, une navigation plus loin.
 */
import { useCallback } from 'react';
import type { ReactNode } from 'react';

/** Studio de démonstration, alimenté par scripts/seed-demo-studio.mjs. */
export const DEMO_STUDIO_SLUG = 'studio-harmonie';

/** On ne surcharge PAS la couleur : le bleu Opatam par défaut est
 *  exactement celui de la page, et la fenêtre doit ressembler à ce que
 *  verront les clients du studio. Seul le thème sombre est forcé, pour la
 *  continuité avec le fond noir. */
const DEFAULT_EMBED_OPTIONS = { theme: 'dark' } as const;

interface StudioDemoButtonProps {
  className?: string;
  children: ReactNode;
  options?: { primary?: string; radius?: number; theme?: 'light' | 'dark' | 'auto' };
}

interface OpatamGlobal {
  open: (slug: string, options?: Record<string, unknown>) => void;
}

export function StudioDemoButton({ className, children, options }: StudioDemoButtonProps) {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const opatam = (window as unknown as { Opatam?: OpatamGlobal }).Opatam;
      if (opatam?.open) {
        opatam.open(DEMO_STUDIO_SLUG, { ...DEFAULT_EMBED_OPTIONS, ...(options ?? {}) });
        return;
      }
      // Repli si embed.js n'a pas chargé (réseau lent, bloqueur, clic
      // avant hydratation) : la page publique du studio, qui sert le
      // même tunnel de réservation.
      window.open(`/p/${DEMO_STUDIO_SLUG}`, '_blank', 'noopener,noreferrer');
    },
    [options],
  );

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
