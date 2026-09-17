'use client';

import { useEffect, useState } from 'react';
import type { OccupationPayload } from '@/lib/occupation-types';
import { SemaineWidget, type OptionsSemaineWidget } from '@/components/widget/SemaineWidget';
import { annoncerHauteurEmbed } from '@/lib/embed-height';

/**
 * Charge l'occupation réelle et rend le widget. Le clic sur un créneau
 * libre est confié au script hôte (postMessage) quand on est dans une
 * iframe ; en accès direct, on ouvre le tunnel de réservation du pro.
 */
export function SemaineEmbed({ slug, member, pas, options }: { slug: string; member: string | null; pas: number; options: OptionsSemaineWidget }) {
  const [semaine, setSemaine] = useState(0);
  const [donnees, setDonnees] = useState<OccupationPayload | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    const params = new URLSearchParams({ slug, semaine: String(semaine), pas: String(pas) });
    if (member) params.set('member', member);
    fetch(`/api/occupation?${params}`)
      .then(async (res) => { if (!res.ok) throw new Error(String(res.status)); return (await res.json()) as OccupationPayload; })
      .then((corps) => { if (!annule) { setDonnees(corps); setErreur(false); } })
      .catch(() => { if (!annule) setErreur(true); })
      .finally(() => { if (!annule) { setChargement(false); setTimeout(annoncerHauteurEmbed, 50); } });
    return () => { annule = true; };
  }, [slug, semaine, member, pas]);

  const choisir = (date: string, heure: string) => {
    const dansIframe = typeof window !== 'undefined' && window.parent !== window;
    if (dansIframe) {
      window.parent.postMessage({ type: 'opatam-embed-reserver', slug, date, time: heure, member: member ?? null }, '*');
      return;
    }
    const params = new URLSearchParams({ date, time: heure });
    if (member) params.set('member', member);
    window.location.href = `/p/${encodeURIComponent(slug)}/reserver?${params}`;
  };

  return <SemaineWidget donnees={donnees} chargement={chargement} erreur={erreur} options={options} semaine={semaine} onSemaine={setSemaine} onChoisir={choisir} aujourdhui={donnees ? undefined : undefined} />;
}
