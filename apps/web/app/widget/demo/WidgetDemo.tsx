'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, LayoutGrid, X } from 'lucide-react';
import { PROVIDER_THEMES } from '@booking-app/shared/constants';
import type { CaseOccupation, EtatCase, OccupationPayload } from '@/lib/occupation-types';
import { SemaineWidget } from '@/components/widget/SemaineWidget';
import d from '../../ecran/demo/demo.module.css';
import s from './widget.module.css';

/**
 * Démonstration du widget « vue semaine » : le même composant que la page
 * embarquée, nourri de données fictives mais stables, dans un faux site de
 * salon, avec un panneau pour essayer les options.
 */

type Mode = 'solo' | 'equipe' | 'membre';

const COULEURS_DEMO = ['bleu', 'noir', 'emeraude', 'terracotta', 'rouge', 'prune'];
const MEMBRES = ['Camille', 'Inès', 'Sofia'];
const CATEGORIES = [
  { id: 'coupe', label: 'Coupe & coiffage', color: '#2563eb' },
  { id: 'couleur', label: 'Couleur', color: '#db2777' },
  { id: 'soin', label: 'Soins', color: '#059669' },
  { id: 'ongles', label: 'Ongles', color: '#d97706' },
];
const PRESTATIONS = ['Coupe + brushing · 45 min', 'Couleur · 1 h 30', 'Soin profond · 30 min'];

/** Ouverture par jour (0 = lundi) : plages en minutes. Dimanche fermé. */
const OUVERTURE: [number, number][][] = [
  [[9 * 60, 13 * 60], [14 * 60, 19 * 60]],
  [[9 * 60, 13 * 60], [14 * 60, 19 * 60]],
  [[9 * 60, 13 * 60], [14 * 60, 19 * 60]],
  [[9 * 60, 13 * 60], [14 * 60, 20 * 60]],
  [[9 * 60, 13 * 60], [14 * 60, 19 * 60]],
  [[9 * 60, 17 * 60]],
  [],
];

// Petit générateur déterministe : la même case donne toujours le même résultat.
function hasard(...graines: number[]): number {
  let h = 2166136261;
  for (const g of graines) { h ^= g + 1; h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const cleJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function lundi(decalageSemaines: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + decalageSemaines * 7);
  return d;
}

function construire(semaine: number, mode: Mode, membreFixe: number, pas: number, nom: string, maintenant: Date): OccupationPayload {
  const debutSemaine = lundi(semaine);
  const membres = mode === 'equipe' ? MEMBRES.map((name, i) => ({ id: `m${i}`, name })) : [{ id: `m${mode === 'membre' ? membreFixe : 0}`, name: MEMBRES[mode === 'membre' ? membreFixe : 0] }];
  const nb = membres.length;
  const creneaux: number[] = [];
  for (let m = 9 * 60; m < 20 * 60; m += pas) creneaux.push(m);
  const minNow = maintenant.getHours() * 60 + maintenant.getMinutes();
  const aujourdhui = cleJour(maintenant);
  const jours = Array.from({ length: 7 }, (_, j) => {
    const date = new Date(debutSemaine); date.setDate(date.getDate() + j);
    const cle = cleJour(date);
    const plages = OUVERTURE[j];
    const cases: CaseOccupation[] = creneaux.map((m) => {
      const ouvert = plages.some(([a, b]) => m >= a && m + pas <= b);
      if (!ouvert) return { etat: 'ferme', libres: 0, total: 0, cat: null };
      if (cle < aujourdhui || (cle === aujourdhui && m < minNow)) return { etat: 'passe', libres: 0, total: nb, cat: null };
      let libres = 0; let cat: string | null = null;
      for (let k = 0; k < nb; k++) {
        const idx = mode === 'equipe' ? k : mode === 'membre' ? membreFixe : 0;
        const seuil = 0.42 + (m > 15 * 60 ? 0.15 : 0) + (j === 5 ? 0.15 : 0);
        if (hasard(semaine, j, m, idx) < seuil) cat = CATEGORIES[Math.floor(hasard(semaine, j, m, idx, 7) * CATEGORIES.length)].id;
        else libres++;
      }
      const etat: EtatCase = libres === 0 ? 'complet' : libres === nb ? 'libre' : 'partiel';
      return { etat, libres, total: nb, cat: libres === 0 ? cat : null };
    });
    return { date: cle, ouvert: plages.length > 0, cases };
  });
  return {
    slug: 'demo', businessName: nom, themeId: null, membres, membreFixe: mode === 'membre' ? `m${membreFixe}` : null,
    semaine, lundi: cleJour(debutSemaine), pas, creneaux: creneaux.map(hhmm), jours, categories: nb === 1 ? CATEGORIES : [], genereLe: maintenant.toISOString(),
  };
}

export function WidgetDemo() {
  const [mode, setMode] = useState<Mode>('equipe');
  const [membreFixe, setMembreFixe] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [themeId, setThemeId] = useState('bleu');
  const [rayon, setRayon] = useState(14);
  const [pas, setPas] = useState(30);
  const [legende, setLegende] = useState(true);
  const [semaine, setSemaine] = useState(0);
  const [ouvert, setOuvert] = useState(true);
  const [choix, setChoix] = useState<{ date: string; heure: string } | null>(null);
  const [maintenant] = useState(() => new Date());
  // Sur téléphone, le panneau d'options démarre replié : il couvrirait le widget.
  useEffect(() => { if (window.innerWidth < 640) setOuvert(false); }, []);
  const primaire = `rgb(${PROVIDER_THEMES.find((t) => t.id === themeId)?.ramp[5] ?? '37 99 235'})`;
  const donnees = useMemo(() => construire(semaine, mode, membreFixe, pas, 'Maison Amélie', maintenant), [semaine, mode, membreFixe, pas, maintenant]);
  const jourChoisi = choix ? (() => { const l = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(`${choix.date}T12:00:00`)); return l.charAt(0).toUpperCase() + l.slice(1); })() : '';

  return <div className={s.site} data-theme={theme}>
    {/* Le faux site du salon, pour voir le widget là où il vivra. */}
    <header className={s.siteEntete}><strong>Maison Amélie</strong><nav><span>Le salon</span><span>Prestations</span><span>Réserver</span><span>Contact</span></nav></header>
    <section className={s.siteHero}><h1>Un créneau libre ? Il est à vous.</h1><p>Consultez nos disponibilités de la semaine et réservez en deux clics. Sans compte, sans appel.</p></section>

    <div className={s.cadre}>
      <SemaineWidget donnees={donnees} options={{ theme, primaire, rayon, legende, lang: 'fr' }} semaine={semaine} onSemaine={setSemaine} onChoisir={(date, heure) => setChoix({ date, heure })} aujourdhui={cleJour(maintenant)} />
      {choix && <div className={s.voile} role="dialog" aria-label="Réservation" style={{ '--p': primaire } as React.CSSProperties}>
        <div className={s.modale}>
          <button type="button" className={s.fermer} onClick={() => setChoix(null)} aria-label="Fermer"><X size={18} /></button>
          <p className={s.modaleSur}>Réserver</p>
          <h3>{jourChoisi} · {choix.heure}</h3>
          <p>Choisissez votre prestation :</p>
          <div className={s.prestations}>{PRESTATIONS.map((p) => <button type="button" key={p} onClick={() => setChoix(null)}>{p}<ArrowRight size={16} /></button>)}</div>
          <small>Dans la vraie version, c'est la modale de réservation Opatam qui s'ouvre ici, déjà positionnée sur ce créneau ; la prestation, puis le nom et le téléphone, comme aujourd'hui.</small>
        </div>
      </div>}
    </div>

    <section className={s.siteSuite}><h2>Le salon</h2><p>Trois coiffeuses, un même souci du détail. Coupes, couleurs, soins et ongles, du mardi au samedi dans le centre.</p></section>

    <aside className={`${d.panneau} ${s.optionsCote}`} data-ouvert={ouvert} aria-label="Options de démonstration">
      <button type="button" className={d.poignee} onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}><LayoutGrid size={16} /> Options du widget {ouvert ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</button>
      {ouvert && <div className={d.options}>
        <div className={d.groupe}><span>Ce que le widget montre</span><div className={d.segments}>
          <button type="button" aria-pressed={mode === 'equipe'} onClick={() => setMode('equipe')}>Toute l’équipe</button>
          <button type="button" aria-pressed={mode === 'membre'} onClick={() => setMode('membre')}>Un membre</button>
          <button type="button" aria-pressed={mode === 'solo'} onClick={() => setMode('solo')}>Solo</button>
        </div>
          <p>{mode === 'equipe' ? 'Vue agrégée : le niveau de remplissage, sans dire qui. Couleurs par catégorie masquées.' : mode === 'membre' ? 'Widget fixé sur une personne (attribut data-member) : couleur par catégorie de prestation.' : 'Prestataire seul : couleur par catégorie de prestation.'}</p></div>
        {mode === 'membre' && <div className={d.groupe}><span>Membre</span><div className={d.segments}>{MEMBRES.map((m, i) => <button type="button" key={m} aria-pressed={membreFixe === i} onClick={() => setMembreFixe(i)}>{m}</button>)}</div></div>}
        <div className={d.groupe}><span>Thème</span><div className={d.segments}>
          <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Clair</button>
          <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Sombre</button>
        </div></div>
        <div className={d.groupe}><span>Couleur principale <small>{PROVIDER_THEMES.find((t) => t.id === themeId)?.label}</small></span><div className={d.couleurs}>
          {COULEURS_DEMO.map((id) => PROVIDER_THEMES.find((t) => t.id === id)).filter((t): t is (typeof PROVIDER_THEMES)[number] => Boolean(t)).map((t) => <button type="button" key={t.id} title={t.label} aria-label={t.label} aria-pressed={themeId === t.id} onClick={() => setThemeId(t.id)} style={{ background: `rgb(${t.ramp[5]})` }} />)}
        </div></div>
        <div className={d.groupe}><span>Pas de la grille</span><div className={d.segments}>
          <button type="button" aria-pressed={pas === 30} onClick={() => setPas(30)}>30 min</button>
          <button type="button" aria-pressed={pas === 60} onClick={() => setPas(60)}>1 h</button>
        </div></div>
        <label>Arrondi des angles <b>{rayon} px</b><input type="range" min={0} max={24} value={rayon} onChange={(e) => setRayon(Number(e.target.value))} /></label>
        <label className={d.case}><input type="checkbox" checked={legende} onChange={(e) => setLegende(e.target.checked)} /> Afficher la légende</label>
        <p>Données fictives. Le vrai widget lit l'occupation réelle, mise en cache quelques minutes.</p>
      </div>}
    </aside>
  </div>;
}
