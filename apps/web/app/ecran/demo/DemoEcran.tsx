'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Monitor } from 'lucide-react';
import { PROVIDER_THEMES, THEME_FAMILIES } from '@booking-app/shared/constants';
import type { EcranPayload, EcranRendezVous } from '@/lib/ecran';
import { ProviderThemeStyle } from '@/components/theme/ProviderThemeStyle';
import { EcranClient } from '../[id]/EcranClient';
import s from './demo.module.css';

const HEURE_SIMULEE = '14:32';
const JOUR = new Date().toISOString().slice(0, 10);

const MEMBRES = [
  { id: 'm1', name: 'Camille', color: '#db2777', horaires: [{ start: '09:00', end: '19:00' }] },
  { id: 'm2', name: 'Inès', color: '#2563eb', horaires: [{ start: '10:00', end: '18:00' }] },
  { id: 'm3', name: 'Sofia', color: '#059669', horaires: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '19:00' }] },
  { id: 'm4', name: 'Mehdi', color: '#d97706', horaires: [{ start: '11:00', end: '20:00' }] },
  { id: 'm5', name: 'Léa', color: '#7c3aed', horaires: [{ start: '09:00', end: '17:00' }] },
  { id: 'm6', name: 'Yasmine', color: '#0891b2', horaires: [{ start: '09:00', end: '18:00' }] },
  { id: 'm7', name: 'Thomas', color: '#dc2626', horaires: [{ start: '10:00', end: '19:00' }] },
  { id: 'm8', name: 'Aminata', color: '#4f46e5', horaires: [{ start: '09:00', end: '16:00' }] },
  { id: 'm9', name: 'Hugo', color: '#65a30d', horaires: [{ start: '12:00', end: '20:00' }] },
  { id: 'm10', name: 'Clara', color: '#ea580c', horaires: [{ start: '09:00', end: '19:00' }] },
];

const SERVICES = ['Coupe + brushing', 'Couleur', 'Balayage', 'Soin profond', 'Coupe homme', 'Lissage', 'Tresses', 'Manucure', 'Pose gel', 'Massage 60 min'];
const CLIENTS = ['Sarah M.', 'Julie D.', 'Nadia B.', 'Élise R.', 'Manon L.', 'Aïcha K.', 'Chloé P.', 'Fatou S.', 'Emma V.', 'Lina T.', 'Marc A.', 'Théo G.'];

// Une journée type par membre : heures de début et durées en minutes.
const AGENDAS: [number, number][][] = [
  [[9 * 60, 60], [10 * 60 + 30, 90], [12 * 60 + 30, 45], [14 * 60, 60], [15 * 60 + 30, 90], [17 * 60 + 30, 60]],
  [[10 * 60, 45], [11 * 60, 60], [13 * 60, 60], [14 * 60 + 15, 45], [16 * 60, 120]],
  [[9 * 60 + 30, 60], [11 * 60, 90], [14 * 60, 60], [15 * 60 + 15, 45], [17 * 60, 90]],
  [[11 * 60, 60], [12 * 60 + 30, 30], [14 * 60 + 30, 90], [16 * 60 + 30, 60], [18 * 60, 90]],
  [[9 * 60, 90], [11 * 60, 60], [13 * 60 + 30, 60], [15 * 60, 90]],
  [[9 * 60, 30], [9 * 60 + 30, 15], [10 * 60, 60], [12 * 60, 45], [14 * 60, 30], [14 * 60 + 30, 15], [15 * 60, 90], [17 * 60, 60]],
  [[10 * 60, 60], [11 * 60 + 30, 30], [13 * 60, 90], [15 * 60, 60], [16 * 60 + 30, 120]],
  [[9 * 60, 45], [10 * 60, 60], [11 * 60 + 30, 30], [13 * 60, 60], [14 * 60 + 30, 45]],
  [[12 * 60, 60], [13 * 60 + 30, 30], [14 * 60 + 30, 90], [16 * 60 + 30, 60], [18 * 60, 90]],
  [[9 * 60, 60], [10 * 60 + 15, 30], [11 * 60, 90], [14 * 60, 60], [15 * 60 + 30, 45], [17 * 60, 90]],
];

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const iso = (m: number) => `${JOUR}T${hhmm(m)}:00+02:00`;

function construire(opts: { theme: 'dark' | 'light'; themeId: string; nbMembres: number; upcomingCount: number; showCounters: boolean; nom: string }): EcranPayload {
  const membres = MEMBRES.slice(0, opts.nbMembres).map((m) => ({ ...m, photoURL: null }));
  const rendezVous: EcranRendezVous[] = [];
  let k = 0;
  membres.forEach((m, i) => {
    for (const [debut, duree] of AGENDAS[i]) {
      const service = SERVICES[k % SERVICES.length];
      rendezVous.push({
        id: `r${k}`, memberId: m.id,
        debut: iso(debut), fin: iso(debut + duree), debutLocal: hhmm(debut), finLocal: hhmm(debut + duree),
        service, services: [service], color: m.color, client: CLIENTS[k % CLIENTS.length],
        statut: k % 7 === 3 ? 'pending' : 'confirmed',
      });
      k++;
    }
  });
  rendezVous.sort((a, b) => a.debut.localeCompare(b.debut));
  return {
    ecran: { id: 'demo', label: 'TV de l’accueil', upcomingCount: opts.upcomingCount, showCounters: opts.showCounters, theme: opts.theme },
    provider: { businessName: opts.nom, photoURL: null, themeId: opts.themeId, slug: 'demo' },
    lieu: { id: 'l1', name: 'Salon du centre' },
    fuseau: 'Europe/Paris',
    jour: JOUR,
    membres,
    rendezVous,
    indispos: opts.nbMembres >= 3 ? [{ id: 'i1', memberId: 'm3', debutLocal: '13:00', finLocal: '14:00', titre: 'Pause' }] : [],
    genereLe: new Date().toISOString(),
  };
}

export function DemoEcran() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [themeId, setThemeId] = useState('bleu');
  const [nbMembres, setNbMembres] = useState(4);
  const [upcomingCount, setUpcomingCount] = useState(6);
  const [showCounters, setShowCounters] = useState(true);
  const [nom, setNom] = useState('Maison Amélie');
  const [ouvert, setOuvert] = useState(true);
  const donnees = useMemo(() => construire({ theme, themeId, nbMembres, upcomingCount, showCounters, nom }), [theme, themeId, nbMembres, upcomingCount, showCounters, nom]);

  return <div data-provider-theme>
    <ProviderThemeStyle themeId={themeId} />
    <EcranClient initial={donnees} id="demo" secret="" demo={{ heure: HEURE_SIMULEE }} />
    <aside className={s.panneau} data-ouvert={ouvert} aria-label="Options de démonstration">
      <button type="button" className={s.poignee} onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>
        <Monitor size={16} /> Options de l’écran {ouvert ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
      {ouvert && <div className={s.options}>
        <label>Nom du salon<input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} /></label>
        <div className={s.groupe}><span>Thème</span><div className={s.segments}>
          <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Sombre</button>
          <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Clair</button>
        </div></div>
        {/* Les mêmes 24 gammes que le sélecteur de thème du profil, par famille. */}
        <div className={s.groupe}><span>Couleur du salon <small>{PROVIDER_THEMES.find((t) => t.id === themeId)?.label}</small></span>
          {THEME_FAMILIES.map((famille) => <div key={famille.id} className={s.famille}><em>{famille.label}</em><div className={s.couleurs}>
            {PROVIDER_THEMES.filter((t) => t.family === famille.id).map((t) => <button type="button" key={t.id} title={t.label} aria-label={t.label} aria-pressed={themeId === t.id} onClick={() => setThemeId(t.id)} style={{ background: `rgb(${t.ramp[5]})` }} />)}
          </div></div>)}
        </div>
        <label>Membres affichés <b>{nbMembres}</b><input type="range" min={1} max={10} value={nbMembres} onChange={(e) => setNbMembres(Number(e.target.value))} /></label>
        <label>Prochains rendez-vous <b>{upcomingCount}</b><input type="range" min={4} max={10} value={upcomingCount} onChange={(e) => setUpcomingCount(Number(e.target.value))} /></label>
        <label className={s.case}><input type="checkbox" checked={showCounters} onChange={(e) => setShowCounters(e.target.checked)} /> Chiffres du jour</label>
        <p>Heure simulée : {HEURE_SIMULEE}. Sur un vrai écran, la page se rafraîchit toutes les minutes.</p>
      </div>}
    </aside>
  </div>;
}
