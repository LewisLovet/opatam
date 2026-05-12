'use client';

/**
 * CamBeautyBookingButton — opens Cam Beauty Studio's real Opatam
 * booking popup, the same way her own site (cambeautystudio.com)
 * does. Used twice on the nail-artist landing: as the "Réserver"
 * button inside the browser-frame mockup, and as the standalone
 * "Tester en live" CTA next to the case-study copy.
 *
 * Implementation:
 *  - The page loads `/embed.js` via <Script strategy="afterInteractive">.
 *    Once loaded, `window.Opatam.open(slug)` is available.
 *  - On click we call that API. If for any reason the script hasn't
 *    landed yet (slow network, blocker, etc.) we fall back to opening
 *    her real website in a new tab so the visitor still gets value.
 *
 * The popup mirrors exactly what runs on her site — same iframe,
 * same booking flow, same Opatam-powered experience. The visitor
 * effectively "test drives" the product through a real boutique.
 */
import { useCallback } from 'react';
import type { ReactNode } from 'react';

/** Cam Beauty Studio's Opatam slug — drives `opatam.com/p/<slug>/embed`
 *  via the embed.js modal. Confirmed against the live page at
 *  https://opatam.com/p/cam-beauty-studio. */
export const CAM_BEAUTY_SLUG = 'cam-beauty-studio';

/** Accent color used inside the embedded booking flow. Cam Beauty
 *  Studio's site identity is black-on-cream, so we override the
 *  default Opatam blue to keep the visual continuity from our page
 *  → her popup → her booking flow. embed.js accepts the value with
 *  or without `#`. */
const DEFAULT_EMBED_OPTIONS = { primary: '000000' } as const;

interface CamBeautyBookingButtonProps {
  /** Visual class for the button — lets each call site bring its own
   *  look (one is a dark pill, the other a subtle text-link). */
  className?: string;
  children: ReactNode;
  /** Optional Opatam embed options forwarded to `Opatam.open`. */
  options?: { primary?: string; radius?: number; theme?: 'light' | 'dark' | 'auto' };
}

interface OpatamGlobal {
  open: (slug: string, options?: Record<string, unknown>) => void;
}

export function CamBeautyBookingButton({
  className,
  children,
  options,
}: CamBeautyBookingButtonProps) {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const opatam = (window as unknown as { Opatam?: OpatamGlobal }).Opatam;
      if (opatam?.open) {
        opatam.open(CAM_BEAUTY_SLUG, { ...DEFAULT_EMBED_OPTIONS, ...(options ?? {}) });
        return;
      }
      // Fallback if embed.js hasn't loaded (network issue, ad blocker,
      // user pre-hydration): open her real website in a new tab. The
      // visitor still gets a working booking flow, just one click
      // further away.
      window.open('https://cambeautystudio.com', '_blank', 'noopener,noreferrer');
    },
    [options],
  );

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
