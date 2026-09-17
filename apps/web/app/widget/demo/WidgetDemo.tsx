'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Calendar, ChevronDown, ChevronUp, LayoutGrid, X } from 'lucide-react';
import { PROVIDER_THEMES } from '@booking-app/shared/constants';
import d from '../../ecran/demo/demo.module.css';
import s from './widget.module.css';

/**
 * Données fictives, mais stables : la même grille à chaque rendu, pour
 * pouvoir en discuter. Aucune donnée réelle, aucun appel réseau.
 */

type Mode = 'solo' | 'equipe' | 'membre';
type Etat = 'ferme' | 'passe' | 'libre' | 'partiel' | 'complet';
type Cellule = { etat: Etat; libres: number; total: number; categorie: string | null; heure: string };

const COULEURS_DEMO = ['bleu', 'noir', 'emeraude', 'terracotta', 'rouge', 'prune'];
const MEMBRES = ['Camille', 'Inès', 'Sofia'];
const CATEGORIES = [
  { id: 'coupe', label: 'Coupe & coiffage', color: '#2563eb' },
  { id: 'couleur', label: 'Couleur', color: '#db2777' },
  { id: 'soin', label: 'Soins', color: '#059669' },
  { id: 'ongles', label: 'Ongles', color: '#d97706' },
];
const PRESTATIONS = ['Coupe + brushing · 45 min', 'Couleur · 1 h 30', 'Soin profond · 30 min'];
const JOURS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

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

function lundi(decalageSemaines: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + decalageSemaines * 7);
  return d;
}

function construireSemaine(semaine: number, mode: Mode, membreFixe: number, pas: number, maintenant: Date) {
  const debutSemaine = lundi(semaine);
  const membres = mode === 'equipe' ? MEMBRES.length : 1;
  const jours = JOURS.map((nom, j) => {
    const date = new Date(debutSemaine); date.setDate(date.getDate() + j);
    const estAujourdhui = date.toDateString() === maintenant.toDateString();
    const estPasse = date < new Date(maintenant.toDateString());
    return { nom, date, estAujourdhui, estPasse, plages: OUVERTURE[j] };
  });
  // Amplitude de la grille : de la première ouverture à la dernière fermeture.
  let debut = 24 * 60, fin = 0;
  for (const j of jours) for (const [a, b] of j.plages) { debut = Math.min(debut, a); fin = Math.max(fin, b); }
  const creneaux: number[] = [];
  for (let m = debut; m < fin; m += pas) creneaux.push(m);
  const minNow = maintenant.getHours() * 60 + maintenant.getMinutes();
  const cellules: Cellule[][] = jours.map((jour, j) => creneaux.map((m) => {
    const ouvert = jour.plages.some(([a, b]) => m >= a && m + pas <= b);
    if (!ouvert) return { etat: 'ferme', libres: 0, total: 0, categorie: null, heure: hhmm(m) };
    if (jour.estPasse || (jour.estAujourdhui && m < minNow)) return { etat: 'passe', libres: 0, total: 0, categorie: null, heure: hhmm(m) };
    let libres = 0; let categorie: string | null = null;
    for (let k = 0; k < membres; k++) {
      const idx = mode === 'equipe' ? k : mode === 'membre' ? membreFixe : 0;
      const r = hasard(semaine, j, m, idx);
      // Plus rempli en fin de journée et le samedi : ça se voit dans la grille.
      const seuil = 0.42 + (m > 15 * 60 ? 0.15 : 0) + (j === 5 ? 0.15 : 0);
      if (r < seuil) categorie = CATEGORIES[Math.floor(hasard(semaine, j, m, idx, 7) * CATEGORIES.length)].id;
      else libres++;
    }
    const etat: Etat = libres === 0 ? 'complet' : libres === membres ? 'libre' : 'partiel';
    return { etat, libres, total: membres, categorie: libres === 0 ? categorie : null, heure: hhmm(m) };
  }));
  return { jours, creneaux, cellules, membres };
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
  // Sur téléphone, le panneau d'options démarre replié : il couvrirait le widget.
  useEffect(() => { if (window.innerWidth < 640) setOuvert(false); }, []);
  const [choix, setChoix] = useState<{ jour: string; heure: string } | null>(null);
  // Vue téléphone : un jour à la fois, choisi dans la bande du haut.
  const [jourSel, setJourSel] = useState<number | null>(null);
  const [maintenant] = useState(() => new Date());
  // Sur un écran étroit, la grille défile d'elle-même jusqu'à aujourd'hui :
  // les jours passés de la semaine ne doivent pas cacher les créneaux utiles.
  const defilement = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const zone = defilement.current;
    const cible = zone?.querySelector<HTMLElement>('[data-aujourdhui="true"]');
    if (!zone || !cible || zone.scrollWidth <= zone.clientWidth) return;
    zone.scrollTo({ left: Math.max(0, cible.offsetLeft - 60), behavior: 'auto' });
  }, [semaine, pas]);
  const primaire = `rgb(${PROVIDER_THEMES.find((t) => t.id === themeId)?.ramp[5] ?? '37 99 235'})`;

  const { jours, creneaux, cellules, membres } = useMemo(() => construireSemaine(semaine, mode, membreFixe, pas, maintenant), [semaine, mode, membreFixe, pas, maintenant]);
  const parCategorie = mode !== 'equipe';
  // Jour affiché sur téléphone : aujourd'hui s'il est dans la semaine, sinon
  // le premier jour ouvert ; remis à zéro quand on change de semaine.
  const jourParDefaut = Math.max(0, jours.findIndex((j) => j.estAujourdhui) >= 0 ? jours.findIndex((j) => j.estAujourdhui) : jours.findIndex((j) => j.plages.length && !j.estPasse));
  const jourMobile = jourSel ?? jourParDefaut;
  const resumeJour = (c: number) => {
    const ouverts = cellules[c].filter((x) => x.etat !== 'ferme' && x.etat !== 'passe');
    const libres = ouverts.filter((x) => x.etat === 'libre' || x.etat === 'partiel').length;
    return { ouverts: ouverts.length, libres, taux: ouverts.length ? 1 - libres / ouverts.length : 0 };
  };
  const libelleEtat = (cel: Cellule) => cel.etat === 'libre' ? 'Libre' : cel.etat === 'partiel' ? `${cel.libres} place${cel.libres > 1 ? 's' : ''} sur ${cel.total}` : cel.etat === 'complet' ? 'Complet' : cel.etat === 'passe' ? 'Passé' : '';
  const libelleSemaine = `${jours[0].date.getDate()} ${MOIS[jours[0].date.getMonth()]} – ${jours[6].date.getDate()} ${MOIS[jours[6].date.getMonth()]}`;
  const libelleJour = (j: (typeof jours)[number]) => `${['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][(j.date.getDay() + 6) % 7]} ${j.date.getDate()} ${MOIS[j.date.getMonth()]}`;

  return <div className={s.site} data-theme={theme}>
    {/* Le faux site du salon, pour voir le widget là où il vivra. */}
    <header className={s.siteEntete}><strong>Maison Amélie</strong><nav><span>Le salon</span><span>Prestations</span><span>Réserver</span><span>Contact</span></nav></header>
    <section className={s.siteHero}><h1>Un créneau libre ? Il est à vous.</h1><p>Consultez nos disponibilités de la semaine et réservez en deux clics. Sans compte, sans appel.</p></section>

    <div className={s.widget} style={{ '--p': primaire, '--r': `${rayon}px` } as React.CSSProperties}>
      <div className={s.barre}>
        <div className={s.titre}><Calendar size={18} /><div><strong>Disponibilités</strong><span>{mode === 'membre' ? `Avec ${MEMBRES[membreFixe]}` : mode === 'equipe' ? `${membres} professionnelles` : 'Maison Amélie'}</span></div></div>
        <div className={s.nav}>
          <button type="button" onClick={() => { setSemaine(0); setJourSel(null); }} aria-pressed={semaine === 0}>Cette semaine</button>
          <button type="button" onClick={() => { setSemaine(1); setJourSel(null); }} aria-pressed={semaine === 1}>La suivante</button>
          <span>{libelleSemaine}</span>
          <button type="button" className={s.fleche} onClick={() => { setSemaine(0); setJourSel(null); }} disabled={semaine === 0} aria-label="Semaine précédente"><ArrowLeft size={16} /></button>
          <button type="button" className={s.fleche} onClick={() => { setSemaine(1); setJourSel(null); }} disabled={semaine === 1} aria-label="Semaine suivante"><ArrowRight size={16} /></button>
        </div>
      </div>

      {/* Téléphone : la bande des jours, puis les créneaux du jour choisi en
          grandes lignes tactiles. Le même contenu que la grille, présenté
          pour un pouce et un écran étroit. */}
      <div className={s.mobile}>
        <div className={s.jourBande} role="tablist" aria-label="Jour">
          {jours.map((j, c) => { const r = resumeJour(c); return <button type="button" role="tab" key={j.nom} aria-selected={jourMobile === c} data-aujourdhui={j.estAujourdhui} data-ferme={!j.plages.length || j.estPasse} onClick={() => setJourSel(c)}>
            <span>{j.nom}</span><strong>{j.date.getDate()}</strong>
            {j.plages.length && !j.estPasse ? <i aria-hidden="true"><b style={{ width: `${Math.round(r.taux * 100)}%` }} /></i> : <em>{j.estPasse ? 'passé' : 'fermé'}</em>}
          </button>; })}
        </div>
        {(() => {
          const j = jours[jourMobile]; const r = resumeJour(jourMobile);
          const toutes = cellules[jourMobile].map((cel, i) => ({ cel, m: creneaux[i] })).filter((x) => x.cel.etat !== 'ferme');
          // Aujourd'hui, les créneaux déjà passés ne font que pousser les
          // utiles hors de l'écran : on les résume en une ligne.
          const passees = toutes.filter((x) => x.cel.etat === 'passe').length;
          const lignes = toutes.filter((x) => x.cel.etat !== 'passe');
          if (!toutes.length) return <p className={s.mobileVide}>{j.estPasse ? 'Ce jour est passé.' : 'Fermé ce jour.'}</p>;
          if (!lignes.length) return <p className={s.mobileVide}>La journée est terminée.</p>;
          const matin = lignes.filter((x) => x.m < 13 * 60), aprem = lignes.filter((x) => x.m >= 13 * 60);
          return <div className={s.mobileJour}>
            <p className={s.mobileTitre}><strong>{libelleJour(j)}</strong><span>{r.ouverts ? `${r.libres} créneau${r.libres > 1 ? 'x' : ''} disponible${r.libres > 1 ? 's' : ''}` : ''}</span></p>
            {passees > 0 && <p className={s.mobilePasse}>{passees} créneau{passees > 1 ? 'x' : ''} déjà passé{passees > 1 ? 's' : ''} aujourd’hui</p>}
            {[['Matin', matin], ['Après-midi', aprem]].map(([titre, groupe]) => (groupe as typeof lignes).length ? <div key={String(titre)} className={s.mobileGroupe}>
              <h4>{String(titre)}</h4>
              {(groupe as typeof lignes).map(({ cel }) => { const cat = cel.categorie ? CATEGORIES.find((x) => x.id === cel.categorie) : null; const cliquable = cel.etat === 'libre' || cel.etat === 'partiel';
                return <button type="button" key={cel.heure} className={s.mobileLigne} data-etat={cel.etat} disabled={!cliquable} onClick={() => setChoix({ jour: libelleJour(j), heure: cel.heure })} style={parCategorie && cat ? { '--cat': cat.color } as React.CSSProperties : undefined}>
                  <time>{cel.heure}</time><span>{parCategorie && cat ? cat.label : libelleEtat(cel)}</span>{cliquable && <ArrowRight size={16} />}
                </button>; })}
            </div> : null)}
          </div>;
        })()}
      </div>

      <div className={`${s.defilement} ${s.bureau}`} ref={defilement}>
        <div className={s.grille} style={{ gridTemplateColumns: `3.4rem repeat(7, minmax(4.6rem, 1fr))` }}>
          <div />
          {jours.map((j) => <div key={j.nom} className={s.jour} data-aujourdhui={j.estAujourdhui} data-ferme={!j.plages.length}><span>{j.nom}</span><strong>{j.date.getDate()}</strong></div>)}
          {creneaux.map((m, r) => <div key={m} className={s.ligne} style={{ display: 'contents' }}>
            <div className={s.heure}>{m % 60 === 0 ? hhmm(m) : ''}</div>
            {jours.map((j, c) => {
              const cel = cellules[c][r];
              const cat = cel.categorie ? CATEGORIES.find((x) => x.id === cel.categorie) : null;
              const cliquable = cel.etat === 'libre' || cel.etat === 'partiel';
              return <button type="button" key={j.nom} className={s.cellule} data-etat={cel.etat} data-aujourdhui={j.estAujourdhui} disabled={!cliquable} onClick={() => setChoix({ jour: libelleJour(j), heure: cel.heure })}
                style={parCategorie && cat ? { '--cat': cat.color } as React.CSSProperties : undefined}
                aria-label={cliquable ? `${libelleJour(j)} ${cel.heure} : ${cel.etat === 'libre' ? 'libre' : `${cel.libres} sur ${cel.total} disponibles`}` : `${libelleJour(j)} ${cel.heure} : ${cel.etat === 'complet' ? 'complet' : cel.etat === 'passe' ? 'passé' : 'fermé'}`}>
                {cel.etat === 'partiel' && <span>{cel.libres}/{cel.total}</span>}
              </button>;
            })}
          </div>)}
        </div>
      </div>

      {legende && <div className={s.legende}>
        <span><i data-etat="libre" /> Libre</span>
        {!parCategorie && <span><i data-etat="partiel" /> Partiellement pris</span>}
        {parCategorie
          ? CATEGORIES.map((c) => <span key={c.id}><i style={{ background: c.color }} /> {c.label}</span>)
          : <span><i data-etat="complet" /> Complet</span>}
        <span><i data-etat="passe" /> Passé</span>
      </div>}
      <div className={s.pied}><span>Cliquez un créneau libre pour réserver.</span><span>Propulsé par <b>Opatam</b></span></div>

      {choix && <div className={s.voile} role="dialog" aria-label="Réservation">
        <div className={s.modale}>
          <button type="button" className={s.fermer} onClick={() => setChoix(null)} aria-label="Fermer"><X size={18} /></button>
          <p className={s.modaleSur}>Réserver</p>
          <h3>{choix.jour} · {choix.heure}</h3>
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
        <p>Données fictives. Le vrai widget lira l'occupation réelle, mise en cache quelques minutes.</p>
      </div>}
    </aside>
  </div>;
}
