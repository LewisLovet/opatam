import type { Metadata } from 'next';
import { EmbedShell, type EmbedTheme } from '../EmbedShell';
import { SemaineEmbed } from './SemaineEmbed';
import type { LangueWidget } from '@/components/widget/SemaineWidget';

/**
 * Widget « vue semaine » — /p/[slug]/embed/semaine
 *
 * La page chargée dans l'iframe de `embed.js` (attribut data-opatam-semaine).
 * Elle lit l'occupation publique via /api/occupation (mise en cache CDN) et
 * remonte sa hauteur au script hôte comme le widget de réservation. Un clic
 * sur un créneau libre demande au script hôte d'ouvrir la modale de
 * réservation sur ce jour et cette heure. Jamais indexée.
 */

export const metadata: Metadata = {
  title: 'Disponibilités',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ primary?: string; radius?: string; theme?: string; member?: string; pas?: string; legend?: string; lang?: string }>;
}

function parseRadius(raw?: string): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.min(32, n)) : 12;
}

export default async function SemainePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const theme: EmbedTheme = sp.theme === 'dark' ? 'dark' : 'light';
  const lang: LangueWidget = sp.lang === 'en' || sp.lang === 'it' || sp.lang === 'pt' || sp.lang === 'de' ? sp.lang : 'fr';
  const radius = parseRadius(sp.radius);
  const primaryColor = sp.primary || null;
  return (
    <EmbedShell primaryColor={primaryColor} radius={radius} theme={theme}>
      <SemaineEmbed
        slug={slug}
        member={sp.member || null}
        pas={sp.pas === '60' ? 60 : 30}
        options={{ theme, primaire: primaryColor ? `#${primaryColor.replace(/^#/, '')}` : 'rgb(var(--color-primary-600))', rayon: radius, legende: sp.legend !== '0', lang }}
      />
    </EmbedShell>
  );
}
